"""
Gmail Service

Provides Gmail API access using stored OAuth tokens.
Handles token refresh automatically.
"""

import base64
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from config import settings
from models import OAuthToken, OAuthProvider

logger = logging.getLogger(__name__)


@dataclass
class EmailMessage:
    """Represents an email message."""
    id: str
    thread_id: str
    subject: str
    sender: str
    recipient: str
    date: str
    snippet: str
    body: Optional[str] = None
    labels: List[str] = None

    def __post_init__(self):
        if self.labels is None:
            self.labels = []


@dataclass
class EmailThread:
    """Represents an email thread."""
    id: str
    subject: str
    snippet: str
    messages: List[EmailMessage]
    message_count: int


class GmailServiceError(Exception):
    """Base exception for Gmail service errors."""
    pass


class NotConnectedError(GmailServiceError):
    """User has not connected their Gmail account."""
    pass


class TokenExpiredError(GmailServiceError):
    """OAuth token has expired and could not be refreshed."""
    pass


class GmailService:
    """Service for interacting with Gmail API."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self._credentials: Optional[Credentials] = None
        self._service = None

    def _get_token(self) -> Optional[OAuthToken]:
        """Get the stored OAuth token for this user."""
        return self.db.query(OAuthToken).filter(
            OAuthToken.user_id == self.user_id,
            OAuthToken.provider == OAuthProvider.GOOGLE
        ).first()

    def _get_credentials(self) -> Credentials:
        """Get valid Google credentials, refreshing if necessary."""
        token = self._get_token()
        if not token:
            raise NotConnectedError("Gmail account not connected. Please connect your Google account in settings.")

        # Create credentials object
        credentials = Credentials(
            token=token.access_token,
            refresh_token=token.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=token.scopes
        )

        # Check if token needs refresh
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Update stored token
                token.access_token = credentials.token
                token.expires_at = credentials.expiry
                token.updated_at = datetime.utcnow()
                self.db.commit()
                logger.info(f"Refreshed Google OAuth token for user {self.user_id}")
            except Exception as e:
                logger.error(f"Failed to refresh Google token: {e}")
                raise TokenExpiredError("Failed to refresh Google token. Please reconnect your account.")

        return credentials

    def _get_service(self):
        """Get or create Gmail API service."""
        if self._service is None:
            credentials = self._get_credentials()
            self._service = build("gmail", "v1", credentials=credentials)
        return self._service

    def is_connected(self) -> bool:
        """Check if user has connected Gmail."""
        return self._get_token() is not None

    def get_connected_email(self) -> Optional[str]:
        """Get the connected Gmail address."""
        token = self._get_token()
        if token and token.provider_data:
            return token.provider_data.get("email")
        return None

    def list_messages(
        self,
        query: str = "",
        max_results: int = 10,
        label_ids: Optional[List[str]] = None
    ) -> List[EmailMessage]:
        """
        List messages matching the query.

        Args:
            query: Gmail search query (same syntax as Gmail search box)
            max_results: Maximum number of messages to return
            label_ids: Filter by label IDs (e.g., ["INBOX", "UNREAD"])

        Returns:
            List of EmailMessage objects
        """
        service = self._get_service()
        connected_email = self.get_connected_email()
        logger.info(f"Listing messages for account {connected_email}, query: {query}")

        try:
            # Build request parameters
            params = {
                "userId": "me",
                "maxResults": max_results,
            }
            if query:
                params["q"] = query
            if label_ids:
                params["labelIds"] = label_ids

            # Get message list
            results = service.users().messages().list(**params).execute()
            messages = results.get("messages", [])

            # Fetch details for each message
            email_messages = []
            for msg in messages:
                try:
                    full_msg = service.users().messages().get(
                        userId="me",
                        id=msg["id"],
                        format="metadata",
                        metadataHeaders=["Subject", "From", "To", "Date"]
                    ).execute()

                    email_messages.append(self._parse_message(full_msg))
                except HttpError as e:
                    logger.warning(f"Failed to fetch message {msg['id']}: {e}")

            return email_messages

        except HttpError as e:
            logger.error(f"Gmail API error: {e}")
            raise GmailServiceError(f"Failed to list messages: {e}")

    def get_message(self, message_id: str, include_body: bool = True) -> EmailMessage:
        """
        Get a single message by ID.

        Args:
            message_id: The message ID
            include_body: Whether to include the full message body

        Returns:
            EmailMessage object
        """
        service = self._get_service()
        connected_email = self.get_connected_email()
        logger.info(f"Getting message {message_id} for account {connected_email}")

        try:
            format_type = "full" if include_body else "metadata"
            msg = service.users().messages().get(
                userId="me",
                id=message_id,
                format=format_type
            ).execute()

            return self._parse_message(msg, include_body=include_body)

        except HttpError as e:
            logger.error(f"Gmail API error: {e}")
            raise GmailServiceError(f"Failed to get message: {e}")

    def search_messages(
        self,
        query: str,
        max_results: int = 10
    ) -> List[EmailMessage]:
        """
        Search for messages using Gmail query syntax.

        Args:
            query: Gmail search query
            max_results: Maximum results to return

        Returns:
            List of matching EmailMessage objects
        """
        return self.list_messages(query=query, max_results=max_results)

    def send_message(
        self,
        to: str,
        subject: str,
        body: str,
        html: bool = False
    ) -> Dict[str, Any]:
        """
        Send an email message.

        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body (plain text or HTML)
            html: Whether body is HTML

        Returns:
            Sent message metadata
        """
        service = self._get_service()

        try:
            # Create message
            if html:
                message = MIMEMultipart("alternative")
                message.attach(MIMEText(body, "html"))
            else:
                message = MIMEText(body)

            message["to"] = to
            message["subject"] = subject

            # Encode message
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

            # Send
            result = service.users().messages().send(
                userId="me",
                body={"raw": raw}
            ).execute()

            logger.info(f"Sent email to {to}, message ID: {result['id']}")
            return result

        except HttpError as e:
            logger.error(f"Gmail API error sending message: {e}")
            raise GmailServiceError(f"Failed to send message: {e}")

    def get_labels(self) -> List[Dict[str, str]]:
        """Get all Gmail labels for the user."""
        service = self._get_service()

        try:
            results = service.users().labels().list(userId="me").execute()
            return results.get("labels", [])
        except HttpError as e:
            logger.error(f"Gmail API error: {e}")
            raise GmailServiceError(f"Failed to get labels: {e}")

    def _parse_message(self, msg: Dict, include_body: bool = False) -> EmailMessage:
        """Parse a Gmail API message into an EmailMessage object."""
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}

        body = None
        if include_body:
            body = self._extract_body(msg.get("payload", {}))

        return EmailMessage(
            id=msg["id"],
            thread_id=msg.get("threadId", ""),
            subject=headers.get("Subject", "(no subject)"),
            sender=headers.get("From", ""),
            recipient=headers.get("To", ""),
            date=headers.get("Date", ""),
            snippet=msg.get("snippet", ""),
            body=body,
            labels=msg.get("labelIds", [])
        )

    def _extract_body(self, payload: Dict) -> str:
        """Extract the body text from a message payload."""
        # Check for simple body
        if "body" in payload and payload["body"].get("data"):
            return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

        # Check for multipart
        parts = payload.get("parts", [])
        for part in parts:
            mime_type = part.get("mimeType", "")
            if mime_type == "text/plain":
                if part.get("body", {}).get("data"):
                    return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
            elif mime_type.startswith("multipart/"):
                # Recursively check nested parts
                nested = self._extract_body(part)
                if nested:
                    return nested

        # Fallback to HTML if no plain text
        for part in parts:
            if part.get("mimeType") == "text/html":
                if part.get("body", {}).get("data"):
                    return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")

        return ""
