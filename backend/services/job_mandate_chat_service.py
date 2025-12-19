"""
Job Mandate Chat Service

Handles the LLM-guided interview process for building a job mandate.
Uses a unified LLM call that decides whether to extract insights or ask
clarifying questions, and generates the response in one step.
"""

from typing import Dict, Any, AsyncGenerator, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import anthropic
import os
import json
import logging

from models import MandateSectionType, MandateSectionStatus
from schemas.job_mandate import (
    ExtractedInsight,
    InterviewState,
    MandateUpdateEvent,
)
from schemas.general_chat import (
    ChatResponsePayload,
    TextDeltaEvent,
    StatusEvent,
    CompleteEvent,
    ErrorEvent,
)
from services.job_mandate_service import JobMandateService
from services.conversation_service import ConversationService

logger = logging.getLogger(__name__)

CHAT_MODEL = "claude-sonnet-4-20250514"
CHAT_MAX_TOKENS = 2048

# Minimum items per section before we consider it "sufficient"
MIN_ITEMS_PER_SECTION = 3
# Maximum items per section before we suggest moving on
MAX_ITEMS_PER_SECTION = 10


# Tool definition for structured interview response
INTERVIEW_RESPONSE_TOOL = {
    "name": "interview_response",
    "description": "Submit your interview response with optional insight extraction",
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["extract", "clarify"],
                "description": "Whether you're extracting clear insights ('extract') or asking for clarification ('clarify')"
            },
            "insights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "A clear, standalone insight (under 50 words)"
                        },
                        "category": {
                            "type": "string",
                            "description": "Optional category for grouping"
                        }
                    },
                    "required": ["content"]
                },
                "description": "Insights extracted from user's message (only if action is 'extract')"
            },
            "section_complete": {
                "type": "boolean",
                "description": "Whether the current section has enough insights to move on (only relevant if action is 'extract')"
            },
            "response": {
                "type": "string",
                "description": "Your conversational response to the user"
            }
        },
        "required": ["action", "response"]
    }
}


class JobMandateChatService:
    """Service for job mandate interview interactions."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.async_client = anthropic.AsyncAnthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.mandate_service = JobMandateService(db, user_id)
        self.conv_service = ConversationService(db, user_id)

    # =========================================================================
    # Public API
    # =========================================================================

    async def stream_interview_message(
        self,
        mandate_id: int,
        user_message: str,
        conversation_id: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """
        Process a user message in the interview and stream the response.

        Uses a unified LLM call that:
        1. Evaluates if the user's message contains clear, extractable insights
        2. If clear: extracts insights and determines if section is complete
        3. If unclear: asks a clarifying question
        4. Returns the conversational response
        """
        try:
            # Get or validate mandate
            mandate = self.mandate_service.get_mandate(mandate_id)
            if not mandate:
                yield ErrorEvent(message="Mandate not found").model_dump_json()
                return

            # Set up conversation if needed
            if conversation_id:
                conv = self.conv_service.get_conversation(conversation_id)
                if not conv:
                    yield ErrorEvent(message="Conversation not found").model_dump_json()
                    return
            else:
                conv = self.conv_service.create_conversation()
                conversation_id = conv.conversation_id
                self.mandate_service.update_mandate_conversation(mandate_id, conversation_id)

            # Save user message
            user_msg = self.conv_service.add_message(
                conversation_id=conversation_id,
                role="user",
                content=user_message
            )

            yield StatusEvent(message="Thinking...").model_dump_json()

            # Get current interview state
            interview_state = self.mandate_service.get_interview_state(mandate_id)

            # Build system prompt and messages
            system_prompt = self._build_unified_system_prompt(interview_state)
            messages = self._load_message_history(conversation_id)

            # Make unified LLM call with tool use
            response = await self.async_client.messages.create(
                model=CHAT_MODEL,
                max_tokens=CHAT_MAX_TOKENS,
                system=system_prompt,
                messages=messages,
                tools=[INTERVIEW_RESPONSE_TOOL],
                tool_choice={"type": "tool", "name": "interview_response"},
                temperature=0.7
            )

            # Parse the tool use response
            tool_use_block = None
            for block in response.content:
                if block.type == "tool_use" and block.name == "interview_response":
                    tool_use_block = block
                    break

            if not tool_use_block:
                yield ErrorEvent(message="Failed to get structured response").model_dump_json()
                return

            result = tool_use_block.input
            action = result.get("action", "clarify")
            insights = result.get("insights", [])
            section_complete = result.get("section_complete", False)
            response_text = result.get("response", "")

            # Process based on action
            new_items = []
            section_advanced = False

            if action == "extract" and insights:
                # Add extracted insights to mandate
                extracted = [ExtractedInsight(content=i["content"], category=i.get("category")) for i in insights]
                items = self.mandate_service.add_items_bulk(
                    mandate_id=mandate_id,
                    section=mandate.current_section,
                    insights=extracted,
                    source_message_id=user_msg.message_id
                )
                new_items = items

                # Emit mandate update event
                updated_state = self.mandate_service.get_interview_state(mandate_id)
                yield MandateUpdateEvent(
                    mandate=self._state_to_mandate_response(mandate_id, updated_state),
                    new_items=[self._item_to_schema(item) for item in new_items]
                ).model_dump_json()

                # Check if we should advance to next section
                if section_complete:
                    current_count = self.mandate_service.get_section_item_count(
                        mandate_id, mandate.current_section
                    )
                    if current_count >= MIN_ITEMS_PER_SECTION:
                        self.mandate_service.advance_to_next_section(mandate_id)
                        section_advanced = True
                        mandate = self.mandate_service.get_mandate(mandate_id)

                        # Emit another mandate update for section advance
                        updated_state = self.mandate_service.get_interview_state(mandate_id)
                        yield MandateUpdateEvent(
                            mandate=self._state_to_mandate_response(mandate_id, updated_state),
                            new_items=[],
                            section_completed=MandateSectionType(mandate.current_section.value)
                        ).model_dump_json()

            # Stream the response text
            for chunk in self._chunk_text(response_text, chunk_size=20):
                yield TextDeltaEvent(text=chunk).model_dump_json()

            # Save assistant message
            self.conv_service.add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=response_text
            )

            # Check if mandate is now complete
            mandate = self.mandate_service.get_mandate(mandate_id)
            is_complete = mandate.status.value == "completed"

            # Build final payload
            final_payload = ChatResponsePayload(
                message=response_text,
                conversation_id=conversation_id,
                custom_payload={
                    "type": "mandate_interview",
                    "mandate_id": mandate_id,
                    "is_complete": is_complete,
                    "current_section": mandate.current_section.value if not is_complete else None,
                    "action": action,
                    "insights_added": len(new_items),
                    "section_advanced": section_advanced
                }
            )

            yield CompleteEvent(payload=final_payload).model_dump_json()

        except Exception as e:
            logger.error(f"Error in interview chat: {str(e)}", exc_info=True)
            yield ErrorEvent(message=f"Interview error: {str(e)}").model_dump_json()

    async def get_opening_message(self, mandate_id: int) -> str:
        """Generate the opening message for an interview."""
        mandate = self.mandate_service.get_mandate(mandate_id)
        if not mandate:
            return "I couldn't find your job mandate. Let's start fresh."

        interview_state = self.mandate_service.get_interview_state(mandate_id)

        # Check if this is a fresh start or resumption
        total_items = sum(len(section.items) for section in interview_state.sections.values())

        if total_items == 0:
            return self._get_fresh_start_message()
        else:
            return self._get_resumption_message(interview_state)

    # =========================================================================
    # System Prompt
    # =========================================================================

    def _build_unified_system_prompt(self, interview_state: InterviewState) -> str:
        """Build the system prompt for the unified interview LLM call."""
        current_section = interview_state.current_section
        current_items = interview_state.sections[current_section].items
        current_count = len(current_items)

        # Check overall progress
        all_complete = all(
            s.status.value == "completed"
            for s in interview_state.sections.values()
        )

        section_info = self._get_section_info(current_section)
        state_summary = interview_state.format_for_prompt()

        return f"""You are a warm, professional career coach conducting a job mandate interview.

        Your goal is to help the user articulate what they're looking for in their next role.

        {state_summary}

        ## Current Section: {section_info['title']}

        **Focus:** {section_info['description']}

        **Items captured so far ({current_count}):**
        {self._format_current_items(current_items)}

        **Target:** {MIN_ITEMS_PER_SECTION}-{MAX_ITEMS_PER_SECTION} insights per section

        ## Your Task

        For each user message, you must decide:

        1. **If the user's response contains clear, actionable insights** → Use action "extract"
        - Extract 1-4 distinct insights from their message
        - Each insight should be a clear, standalone statement relevant to "{section_info['title']}"
        - Avoid duplicating insights already captured above
        - Determine if the section is complete (we have enough insights AND the user seems ready to move on)

        2. **If the user's response is vague, off-topic, or you need more detail** → Use action "clarify"
        - Ask a focused follow-up question to get clearer information
        - Do NOT extract anything

        ## Response Guidelines

        - Be conversational and warm, not robotic
        - Ask ONE clear question at a time
        - Use **bold** for emphasis on key questions
        - When transitioning sections, acknowledge the completion and introduce the new topic
        - Keep responses concise (2-4 sentences typically)

        ## Section Completion

        Mark section_complete=true when:
        - We have at least {MIN_ITEMS_PER_SECTION} good insights AND
        - The user's response suggests they've covered the topic OR they explicitly want to move on

        When a section completes, your response should acknowledge this and transition to the next section:
        {self._get_next_section_intro(current_section)}

        {"## INTERVIEW COMPLETE" + chr(10) + "All sections are done. Wrap up warmly and let them know their mandate is ready for the next steps." if all_complete else ""}

        ## Areas to Explore for This Section

        {chr(10).join(f"- {probe}" for probe in section_info['probes'])}

        You MUST use the interview_response tool to submit your response."""

    def _get_section_info(self, section: MandateSectionType) -> Dict[str, Any]:
        """Get information about a section."""
        info = {
            MandateSectionType.ENERGIZES: {
                "title": "What Energizes You",
                "description": "Understanding what kind of work makes them come alive and engaged",
                "probes": [
                    "What tasks make them lose track of time?",
                    "When do they feel most engaged at work?",
                    "What problems do they love solving?",
                    "How do they prefer to collaborate?",
                    "What achievements are they most proud of?"
                ]
            },
            MandateSectionType.STRENGTHS: {
                "title": "Your Strengths",
                "description": "Identifying what they're genuinely good at - skills, abilities, expertise",
                "probes": [
                    "What do colleagues come to them for?",
                    "What feedback do they consistently receive?",
                    "What technical skills set them apart?",
                    "What soft skills are their strongest?",
                    "What have they been recognized or promoted for?"
                ]
            },
            MandateSectionType.MUST_HAVES: {
                "title": "Must-Haves",
                "description": "Clarifying non-negotiable requirements for their next role",
                "probes": [
                    "Work arrangement preferences (remote, hybrid, office)?",
                    "Team culture and environment needs?",
                    "Compensation and benefits requirements?",
                    "Growth and learning opportunities?",
                    "Company stage, size, or industry preferences?"
                ]
            },
            MandateSectionType.DEAL_BREAKERS: {
                "title": "Deal-Breakers",
                "description": "Identifying absolute red flags that would make them reject an opportunity",
                "probes": [
                    "Past experiences they refuse to repeat?",
                    "Management styles that don't work for them?",
                    "Work conditions that are unacceptable?",
                    "Cultural elements to avoid?",
                    "Logistical constraints (travel, hours, on-call)?"
                ]
            }
        }
        return info[section]

    def _format_current_items(self, items: List) -> str:
        """Format current items for the prompt."""
        if not items:
            return "(none yet)"
        return "\n".join(f"- {item.content}" for item in items)

    def _get_next_section_intro(self, current_section: MandateSectionType) -> str:
        """Get the intro text for transitioning to the next section."""
        transitions = {
            MandateSectionType.ENERGIZES: "Next section: **Your Strengths** - What you're particularly good at",
            MandateSectionType.STRENGTHS: "Next section: **Must-Haves** - Non-negotiables for your next role",
            MandateSectionType.MUST_HAVES: "Next section: **Deal-Breakers** - Things that would make you walk away",
            MandateSectionType.DEAL_BREAKERS: "This is the final section. After this, the mandate is complete."
        }
        return transitions[current_section]

    # =========================================================================
    # Message Templates
    # =========================================================================

    def _get_fresh_start_message(self) -> str:
        """Opening message for a new interview."""
        return """Hi! I'm here to help you clarify what you're looking for in your next role.

        Think of this as a casual conversation - there are no wrong answers. I'll ask you some questions to help you articulate your job mandate: what energizes you, what you're good at, and what's non-negotiable in your next position.

        **Let's start simple: What kind of work energizes you?** Think about times when you've been so engaged that you lost track of time."""

    def _get_resumption_message(self, interview_state: InterviewState) -> str:
        """Opening message when resuming an existing interview."""
        current = interview_state.current_section
        section_names = {
            MandateSectionType.ENERGIZES: "what energizes you",
            MandateSectionType.STRENGTHS: "your strengths",
            MandateSectionType.MUST_HAVES: "your must-haves",
            MandateSectionType.DEAL_BREAKERS: "your deal-breakers"
        }

        items_so_far = sum(len(s.items) for s in interview_state.sections.values())
        current_items = len(interview_state.sections[current].items)

        return f"""Welcome back! We've captured {items_so_far} insights so far.

        We were working on **{section_names[current]}** and have {current_items} items there.

        **Would you like to continue where we left off, or is there anything you'd like to add or change?**"""

    # =========================================================================
    # Helpers
    # =========================================================================

    def _load_message_history(self, conversation_id: int) -> List[Dict[str, str]]:
        """Load message history from database."""
        db_messages = self.conv_service.get_messages(conversation_id)
        return [
            {"role": msg.role, "content": msg.content}
            for msg in db_messages
        ]

    def _chunk_text(self, text: str, chunk_size: int = 20) -> List[str]:
        """Split text into chunks for streaming simulation."""
        words = text.split(' ')
        chunks = []
        current_chunk = []

        for word in words:
            current_chunk.append(word)
            if len(current_chunk) >= chunk_size:
                chunks.append(' '.join(current_chunk) + ' ')
                current_chunk = []

        if current_chunk:
            chunks.append(' '.join(current_chunk))

        return chunks if chunks else [text]

    def _state_to_mandate_response(self, mandate_id: int, state: InterviewState) -> Dict[str, Any]:
        """Convert interview state to API response format."""
        mandate = self.mandate_service.get_mandate(mandate_id)
        return {
            "id": mandate_id,
            "user_id": self.user_id,
            "status": mandate.status.value,
            "current_section": state.current_section.value,
            "sections": {
                st.value: {
                    "status": s.status.value,
                    "items": [{"id": i.id, "content": i.content, "category": i.category} for i in s.items]
                }
                for st, s in state.sections.items()
            }
        }

    def _item_to_schema(self, item) -> Dict[str, Any]:
        """Convert a mandate item to dict."""
        return {
            "id": item.item_id,
            "content": item.content,
            "category": item.category,
            "source": item.source.value,
            "created_at": item.created_at.isoformat()
        }
