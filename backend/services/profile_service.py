"""
Profile Service

Handles user profile data access and formatting.
"""

from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import logging

from models import User, UserProfile

logger = logging.getLogger(__name__)


class ProfileService:
    """Service for managing user profile information."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def get_user_with_profile(self) -> Optional[User]:
        """Get user with their profile loaded."""
        return self.db.query(User).filter(User.user_id == self.user_id).first()

    def get_profile(self) -> Optional[UserProfile]:
        """Get user's profile."""
        user = self.get_user_with_profile()
        return user.profile if user else None

    def format_for_prompt(self) -> str:
        """
        Format user profile information for inclusion in system prompt.

        Returns formatted string or empty string if no profile data.
        """
        user = self.get_user_with_profile()
        if not user:
            return ""

        profile_parts = []

        # Basic user info
        if user.full_name:
            profile_parts.append(f"- Name: {user.full_name}")

        # Profile-specific info
        if user.profile:
            if user.profile.display_name:
                profile_parts.append(f"- Display name: {user.profile.display_name}")
            if user.profile.bio:
                profile_parts.append(f"- Bio: {user.profile.bio}")

            # Include any custom preferences
            if user.profile.preferences:
                prefs = user.profile.preferences
                if isinstance(prefs, dict):
                    for key, value in prefs.items():
                        # Format key nicely (e.g., "timezone" -> "Timezone")
                        formatted_key = key.replace("_", " ").title()
                        profile_parts.append(f"- {formatted_key}: {value}")

        if not profile_parts:
            return ""

        return "## User Profile\n" + "\n".join(profile_parts)

    def update_preferences(self, preferences: Dict[str, Any]) -> UserProfile:
        """Update user's preferences (merges with existing)."""
        user = self.get_user_with_profile()
        if not user:
            raise ValueError(f"User {self.user_id} not found")

        if not user.profile:
            # Create profile if it doesn't exist
            user.profile = UserProfile(user_id=self.user_id, preferences={})
            self.db.add(user.profile)

        # Merge preferences
        existing_prefs = user.profile.preferences or {}
        existing_prefs.update(preferences)
        user.profile.preferences = existing_prefs

        self.db.commit()
        self.db.refresh(user.profile)
        return user.profile

    def set_preference(self, key: str, value: Any) -> UserProfile:
        """Set a single preference value."""
        return self.update_preferences({key: value})

    def get_preference(self, key: str, default: Any = None) -> Any:
        """Get a single preference value."""
        profile = self.get_profile()
        if not profile or not profile.preferences:
            return default
        return profile.preferences.get(key, default)
