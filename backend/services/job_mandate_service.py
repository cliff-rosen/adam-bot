"""
Job Mandate Service

Handles CRUD operations and business logic for job mandates.
"""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import logging

from models import (
    JobMandate,
    JobMandateItem,
    MandateStatus,
    MandateSectionStatus,
    MandateSectionType,
    MandateItemSource,
)
from schemas.job_mandate import (
    MandateSection,
    MandateItem as MandateItemSchema,
    InterviewState,
    ExtractedInsight,
)

logger = logging.getLogger(__name__)


class JobMandateService:
    """Service for managing job mandates."""

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # =========================================================================
    # Mandate CRUD
    # =========================================================================

    def create_mandate(self, conversation_id: Optional[int] = None) -> JobMandate:
        """Create a new job mandate."""
        mandate = JobMandate(
            user_id=self.user_id,
            conversation_id=conversation_id,
            status=MandateStatus.IN_PROGRESS,
            current_section=MandateSectionType.ENERGIZES,
            section_statuses={
                "energizes": "in_progress",
                "strengths": "not_started",
                "must_haves": "not_started",
                "deal_breakers": "not_started"
            }
        )
        self.db.add(mandate)
        self.db.commit()
        self.db.refresh(mandate)
        logger.info(f"Created job mandate {mandate.mandate_id} for user {self.user_id}")
        return mandate

    def get_mandate(self, mandate_id: int) -> Optional[JobMandate]:
        """Get a mandate by ID."""
        return self.db.query(JobMandate).filter(
            JobMandate.mandate_id == mandate_id,
            JobMandate.user_id == self.user_id
        ).first()

    def get_active_mandate(self) -> Optional[JobMandate]:
        """Get the user's current in-progress mandate, if any."""
        return self.db.query(JobMandate).filter(
            JobMandate.user_id == self.user_id,
            JobMandate.status == MandateStatus.IN_PROGRESS
        ).order_by(JobMandate.created_at.desc()).first()

    def get_all_mandates(self) -> List[JobMandate]:
        """Get all mandates for the user."""
        return self.db.query(JobMandate).filter(
            JobMandate.user_id == self.user_id
        ).order_by(JobMandate.created_at.desc()).all()

    def update_mandate_conversation(self, mandate_id: int, conversation_id: int) -> Optional[JobMandate]:
        """Associate a conversation with a mandate."""
        mandate = self.get_mandate(mandate_id)
        if mandate:
            mandate.conversation_id = conversation_id
            mandate.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(mandate)
        return mandate

    def complete_mandate(self, mandate_id: int, summary: Optional[str] = None) -> Optional[JobMandate]:
        """Mark a mandate as completed."""
        mandate = self.get_mandate(mandate_id)
        if mandate:
            mandate.status = MandateStatus.COMPLETED
            mandate.completed_at = datetime.utcnow()
            mandate.updated_at = datetime.utcnow()
            if summary:
                mandate.summary = summary
            # Mark all sections as completed
            mandate.section_statuses = {
                "energizes": "completed",
                "strengths": "completed",
                "must_haves": "completed",
                "deal_breakers": "completed"
            }
            self.db.commit()
            self.db.refresh(mandate)
            logger.info(f"Completed job mandate {mandate_id}")
        return mandate

    def archive_mandate(self, mandate_id: int) -> Optional[JobMandate]:
        """Archive a mandate."""
        mandate = self.get_mandate(mandate_id)
        if mandate:
            mandate.status = MandateStatus.ARCHIVED
            mandate.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(mandate)
        return mandate

    # =========================================================================
    # Section Management
    # =========================================================================

    def get_section_status(self, mandate_id: int, section: MandateSectionType) -> Optional[MandateSectionStatus]:
        """Get the status of a specific section."""
        mandate = self.get_mandate(mandate_id)
        if mandate and mandate.section_statuses:
            status_str = mandate.section_statuses.get(section.value)
            if status_str:
                return MandateSectionStatus(status_str)
        return None

    def update_section_status(
        self,
        mandate_id: int,
        section: MandateSectionType,
        status: MandateSectionStatus
    ) -> Optional[JobMandate]:
        """Update the status of a section."""
        mandate = self.get_mandate(mandate_id)
        if mandate:
            statuses = dict(mandate.section_statuses) if mandate.section_statuses else {}
            statuses[section.value] = status.value
            mandate.section_statuses = statuses
            mandate.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(mandate)
        return mandate

    def advance_to_next_section(self, mandate_id: int) -> Optional[JobMandate]:
        """
        Mark current section as complete and advance to the next.
        Returns the updated mandate, or None if already at the end.
        """
        mandate = self.get_mandate(mandate_id)
        if not mandate:
            return None

        section_order = [
            MandateSectionType.ENERGIZES,
            MandateSectionType.STRENGTHS,
            MandateSectionType.MUST_HAVES,
            MandateSectionType.DEAL_BREAKERS,
        ]

        current_idx = section_order.index(mandate.current_section)

        # Mark current section as completed
        self.update_section_status(mandate_id, mandate.current_section, MandateSectionStatus.COMPLETED)

        # Move to next section if there is one
        if current_idx < len(section_order) - 1:
            next_section = section_order[current_idx + 1]
            mandate.current_section = next_section
            self.update_section_status(mandate_id, next_section, MandateSectionStatus.IN_PROGRESS)
            logger.info(f"Mandate {mandate_id} advanced to section {next_section.value}")
        else:
            # All sections complete - mark mandate as completed
            self.complete_mandate(mandate_id)
            logger.info(f"Mandate {mandate_id} all sections complete")

        self.db.commit()
        self.db.refresh(mandate)
        return mandate

    # =========================================================================
    # Item Management
    # =========================================================================

    def add_item(
        self,
        mandate_id: int,
        section: MandateSectionType,
        content: str,
        category: Optional[str] = None,
        source: MandateItemSource = MandateItemSource.EXTRACTED,
        source_message_id: Optional[int] = None
    ) -> Optional[JobMandateItem]:
        """Add an item to a mandate section."""
        mandate = self.get_mandate(mandate_id)
        if not mandate:
            return None

        item = JobMandateItem(
            mandate_id=mandate_id,
            section=section,
            content=content,
            category=category,
            source=source,
            source_message_id=source_message_id
        )
        self.db.add(item)
        mandate.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(item)
        logger.debug(f"Added item to mandate {mandate_id} section {section.value}: {content[:50]}...")
        return item

    def add_items_bulk(
        self,
        mandate_id: int,
        section: MandateSectionType,
        insights: List[ExtractedInsight],
        source_message_id: Optional[int] = None
    ) -> List[JobMandateItem]:
        """Add multiple items to a mandate section at once."""
        mandate = self.get_mandate(mandate_id)
        if not mandate:
            return []

        items = []
        for insight in insights:
            item = JobMandateItem(
                mandate_id=mandate_id,
                section=section,
                content=insight.content,
                category=insight.category,
                source=MandateItemSource.EXTRACTED,
                source_message_id=source_message_id
            )
            self.db.add(item)
            items.append(item)

        mandate.updated_at = datetime.utcnow()
        self.db.commit()

        for item in items:
            self.db.refresh(item)

        logger.info(f"Added {len(items)} items to mandate {mandate_id} section {section.value}")
        return items

    def get_items(self, mandate_id: int, section: Optional[MandateSectionType] = None) -> List[JobMandateItem]:
        """Get items from a mandate, optionally filtered by section."""
        query = self.db.query(JobMandateItem).filter(JobMandateItem.mandate_id == mandate_id)
        if section:
            query = query.filter(JobMandateItem.section == section)
        return query.order_by(JobMandateItem.created_at).all()

    def update_item(
        self,
        item_id: int,
        content: Optional[str] = None,
        category: Optional[str] = None
    ) -> Optional[JobMandateItem]:
        """Update an existing item."""
        item = self.db.query(JobMandateItem).filter(JobMandateItem.item_id == item_id).first()
        if not item:
            return None

        # Verify ownership
        mandate = self.get_mandate(item.mandate_id)
        if not mandate:
            return None

        if content is not None:
            item.content = content
            item.source = MandateItemSource.USER_EDITED
        if category is not None:
            item.category = category

        item.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_item(self, item_id: int) -> bool:
        """Delete an item."""
        item = self.db.query(JobMandateItem).filter(JobMandateItem.item_id == item_id).first()
        if not item:
            return False

        # Verify ownership
        mandate = self.get_mandate(item.mandate_id)
        if not mandate:
            return False

        self.db.delete(item)
        self.db.commit()
        return True

    # =========================================================================
    # Interview State
    # =========================================================================

    def get_interview_state(self, mandate_id: int) -> Optional[InterviewState]:
        """Get the current interview state for LLM context."""
        mandate = self.get_mandate(mandate_id)
        if not mandate:
            return None

        items = self.get_items(mandate_id)

        # Build sections dict
        sections = {}
        for section_type in MandateSectionType:
            section_items = [item for item in items if item.section == section_type]
            status_str = mandate.section_statuses.get(section_type.value, "not_started")

            sections[section_type] = MandateSection(
                section_type=section_type,
                status=MandateSectionStatus(status_str),
                items=[
                    MandateItemSchema(
                        id=item.item_id,
                        content=item.content,
                        category=item.category,
                        source=item.source,
                        source_message_id=item.source_message_id,
                        created_at=item.created_at,
                        updated_at=item.updated_at
                    )
                    for item in section_items
                ]
            )

        return InterviewState(
            current_section=mandate.current_section,
            sections=sections
        )

    def get_section_item_count(self, mandate_id: int, section: MandateSectionType) -> int:
        """Get the number of items in a section."""
        return self.db.query(JobMandateItem).filter(
            JobMandateItem.mandate_id == mandate_id,
            JobMandateItem.section == section
        ).count()
