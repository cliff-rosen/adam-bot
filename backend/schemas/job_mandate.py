"""
Job Mandate Schema

Defines the structure for capturing a user's job search criteria through
an LLM-guided interview process.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from enum import Enum


# ============================================================================
# Enums
# ============================================================================

class MandateSectionStatus(str, Enum):
    """Status of a mandate section"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class MandateStatus(str, Enum):
    """Overall status of a job mandate"""
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class MandateItemSource(str, Enum):
    """How a mandate item was created"""
    EXTRACTED = "extracted"      # LLM extracted from conversation
    USER_ADDED = "user_added"    # User manually added
    USER_EDITED = "user_edited"  # User modified an extracted item


class MandateSectionType(str, Enum):
    """The four sections of a job mandate"""
    ENERGIZES = "energizes"
    STRENGTHS = "strengths"
    MUST_HAVES = "must_haves"
    DEAL_BREAKERS = "deal_breakers"


# ============================================================================
# Item Schema
# ============================================================================

class MandateItemBase(BaseModel):
    """Base schema for a mandate item"""
    content: str = Field(..., description="The insight text")
    category: Optional[str] = Field(None, description="Optional grouping within section")


class MandateItemCreate(MandateItemBase):
    """Schema for creating a new mandate item"""
    source: MandateItemSource = MandateItemSource.EXTRACTED
    source_message_id: Optional[int] = None


class MandateItem(MandateItemBase):
    """Full mandate item with all fields"""
    id: int
    source: MandateItemSource
    source_message_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# Section Schema
# ============================================================================

class MandateSectionBase(BaseModel):
    """Base schema for a mandate section"""
    section_type: MandateSectionType
    status: MandateSectionStatus = MandateSectionStatus.NOT_STARTED


class MandateSection(MandateSectionBase):
    """Full mandate section with items"""
    items: List[MandateItem] = []

    class Config:
        from_attributes = True


# ============================================================================
# Mandate Schema
# ============================================================================

class JobMandateBase(BaseModel):
    """Base schema for job mandate"""
    status: MandateStatus = MandateStatus.IN_PROGRESS


class JobMandateCreate(JobMandateBase):
    """Schema for creating a new job mandate"""
    pass


class JobMandate(JobMandateBase):
    """Full job mandate with all sections"""
    id: int
    user_id: int
    conversation_id: Optional[int] = None
    current_section: MandateSectionType = MandateSectionType.ENERGIZES

    # The four sections
    energizes: MandateSection
    strengths: MandateSection
    must_haves: MandateSection
    deal_breakers: MandateSection

    # Summary generated after completion
    summary: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# API Request/Response Schemas
# ============================================================================

class StartInterviewRequest(BaseModel):
    """Request to start a new job mandate interview"""
    mandate_id: Optional[int] = None  # Resume existing mandate, or None for new


class InterviewMessageRequest(BaseModel):
    """Request to send a message in the interview"""
    mandate_id: int
    message: str
    conversation_id: Optional[int] = None


class AddMandateItemRequest(BaseModel):
    """Request to manually add an item to a section"""
    mandate_id: int
    section: MandateSectionType
    content: str
    category: Optional[str] = None


class UpdateMandateItemRequest(BaseModel):
    """Request to update an existing item"""
    content: str
    category: Optional[str] = None


class DeleteMandateItemRequest(BaseModel):
    """Request to delete an item"""
    pass  # Item ID comes from path


# ============================================================================
# LLM Integration Schemas
# ============================================================================

class ExtractedInsight(BaseModel):
    """An insight extracted by the LLM from user response"""
    content: str
    category: Optional[str] = None


class ExtractionResult(BaseModel):
    """Result of LLM extraction from a user message"""
    section: MandateSectionType
    insights: List[ExtractedInsight]
    section_complete: bool = False  # LLM thinks we have enough for this section
    reasoning: Optional[str] = None  # Why the LLM made these extractions


class InterviewState(BaseModel):
    """Current state of the interview, passed to LLM for context"""
    current_section: MandateSectionType
    sections: dict[MandateSectionType, MandateSection]

    def format_for_prompt(self) -> str:
        """Format the current state for inclusion in LLM prompt"""
        lines = ["## Current Job Mandate State\n"]

        section_titles = {
            MandateSectionType.ENERGIZES: "What Energizes You",
            MandateSectionType.STRENGTHS: "Your Strengths",
            MandateSectionType.MUST_HAVES: "Must-Haves",
            MandateSectionType.DEAL_BREAKERS: "Deal-Breakers"
        }

        for section_type in MandateSectionType:
            section = self.sections.get(section_type)
            title = section_titles[section_type]

            if section:
                status_icon = {
                    MandateSectionStatus.NOT_STARTED: "[ ]",
                    MandateSectionStatus.IN_PROGRESS: "[~]",
                    MandateSectionStatus.COMPLETED: "[x]"
                }[section.status]

                is_current = " <-- CURRENT" if section_type == self.current_section else ""
                lines.append(f"{status_icon} **{title}**{is_current}")

                if section.items:
                    for item in section.items:
                        lines.append(f"    - {item.content}")
                elif section.status == MandateSectionStatus.IN_PROGRESS:
                    lines.append("    (gathering insights...)")
                else:
                    lines.append("    (not yet discussed)")
                lines.append("")

        return "\n".join(lines)


# ============================================================================
# Stream Events (extends general chat events)
# ============================================================================

class MandateSectionUpdate(BaseModel):
    """Lightweight section data for stream updates"""
    status: str
    items: List[dict]  # Simplified item dicts


class MandateStateUpdate(BaseModel):
    """Lightweight mandate state for stream updates"""
    id: int
    user_id: int
    status: str
    current_section: str
    sections: dict[str, MandateSectionUpdate]


class MandateUpdateEvent(BaseModel):
    """Event when mandate is updated during interview"""
    type: Literal["mandate_update"] = "mandate_update"
    mandate: MandateStateUpdate
    new_items: List[dict] = []
    section_completed: Optional[MandateSectionType] = None
