"""
Job Mandate API endpoints

Handles job mandate CRUD and the interview chat flow.
"""

import asyncio
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from database import get_db
from models import User, MandateSectionType
from routers.auth import get_current_user
from schemas.job_mandate import (
    JobMandate as JobMandateSchema,
    MandateItem,
    MandateSection,
    AddMandateItemRequest,
    UpdateMandateItemRequest,
    MandateSectionStatus,
    MandateStatus,
    InterviewState,
)
from schemas.general_chat import (
    TextDeltaEvent,
    StatusEvent,
    CompleteEvent,
    ErrorEvent,
)
from services.job_mandate_service import JobMandateService
from services.job_mandate_chat_service import JobMandateChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/job-mandate", tags=["job-mandate"])


# ============================================================================
# Request/Response Models
# ============================================================================

class StartInterviewResponse(BaseModel):
    """Response when starting/resuming an interview"""
    mandate_id: int
    conversation_id: Optional[int]
    is_new: bool
    opening_message: str
    interview_state: Dict[str, Any]


class InterviewMessageRequest(BaseModel):
    """Request to send a message in the interview"""
    message: str
    conversation_id: Optional[int] = None


class MandateListItem(BaseModel):
    """Summary of a mandate for list views"""
    id: int
    status: str
    current_section: Optional[str]
    item_count: int
    created_at: str
    updated_at: str
    completed_at: Optional[str]


class MandateResponse(BaseModel):
    """Full mandate response"""
    id: int
    user_id: int
    status: str
    current_section: Optional[str]
    conversation_id: Optional[int]
    sections: Dict[str, Any]
    summary: Optional[str]
    created_at: str
    updated_at: str
    completed_at: Optional[str]


# ============================================================================
# Interview Endpoints
# ============================================================================

@router.post("/start", response_model=StartInterviewResponse)
async def start_interview(
    mandate_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start a new interview or resume an existing one.

    If mandate_id is provided, resumes that mandate.
    If not provided, creates a new mandate (or returns existing in-progress one).
    """
    mandate_service = JobMandateService(db, current_user.user_id)
    chat_service = JobMandateChatService(db, current_user.user_id)

    if mandate_id:
        # Resume existing mandate
        mandate = mandate_service.get_mandate(mandate_id)
        if not mandate:
            raise HTTPException(status_code=404, detail="Mandate not found")
        is_new = False
    else:
        # Check for existing in-progress mandate
        mandate = mandate_service.get_active_mandate()
        if mandate:
            is_new = False
        else:
            # Create new mandate
            mandate = mandate_service.create_mandate()
            is_new = True

    # Get opening message
    opening_message = await chat_service.get_opening_message(mandate.mandate_id)

    # Get interview state
    interview_state = mandate_service.get_interview_state(mandate.mandate_id)

    return StartInterviewResponse(
        mandate_id=mandate.mandate_id,
        conversation_id=mandate.conversation_id,
        is_new=is_new,
        opening_message=opening_message,
        interview_state=_format_interview_state(interview_state)
    )


@router.post("/{mandate_id}/chat/stream", response_class=EventSourceResponse)
async def interview_chat_stream(
    mandate_id: int,
    chat_request: InterviewMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Stream interview chat responses.

    Processes user message, extracts insights, updates mandate, and streams response.
    """
    chat_service = JobMandateChatService(db, current_user.user_id)

    async def generate():
        try:
            async for event in chat_service.stream_interview_message(
                mandate_id=mandate_id,
                user_message=chat_request.message,
                conversation_id=chat_request.conversation_id
            ):
                # Check for client disconnect
                if await request.is_disconnected():
                    logger.info("Client disconnected from interview stream")
                    break
                yield {"data": event}
        except asyncio.CancelledError:
            logger.info("Interview stream cancelled")
        except Exception as e:
            logger.error(f"Interview stream error: {e}", exc_info=True)
            yield {"data": ErrorEvent(message=str(e)).model_dump_json()}

    return EventSourceResponse(generate())


# ============================================================================
# Mandate CRUD Endpoints
# ============================================================================

@router.get("/list", response_model=List[MandateListItem])
async def list_mandates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all mandates for the current user."""
    mandate_service = JobMandateService(db, current_user.user_id)
    mandates = mandate_service.get_all_mandates()

    return [
        MandateListItem(
            id=m.mandate_id,
            status=m.status.value,
            current_section=m.current_section.value if m.status.value != "completed" else None,
            item_count=len(m.items),
            created_at=m.created_at.isoformat(),
            updated_at=m.updated_at.isoformat(),
            completed_at=m.completed_at.isoformat() if m.completed_at else None
        )
        for m in mandates
    ]


@router.get("/{mandate_id}", response_model=MandateResponse)
async def get_mandate(
    mandate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific mandate with all its items."""
    mandate_service = JobMandateService(db, current_user.user_id)
    mandate = mandate_service.get_mandate(mandate_id)

    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    interview_state = mandate_service.get_interview_state(mandate_id)

    return MandateResponse(
        id=mandate.mandate_id,
        user_id=mandate.user_id,
        status=mandate.status.value,
        current_section=mandate.current_section.value if mandate.status.value != "completed" else None,
        conversation_id=mandate.conversation_id,
        sections=_format_interview_state(interview_state)["sections"],
        summary=mandate.summary,
        created_at=mandate.created_at.isoformat(),
        updated_at=mandate.updated_at.isoformat(),
        completed_at=mandate.completed_at.isoformat() if mandate.completed_at else None
    )


@router.delete("/{mandate_id}")
async def delete_mandate(
    mandate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Archive a mandate (soft delete)."""
    mandate_service = JobMandateService(db, current_user.user_id)
    mandate = mandate_service.archive_mandate(mandate_id)

    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    return {"status": "archived", "mandate_id": mandate_id}


# ============================================================================
# Item Management Endpoints
# ============================================================================

@router.post("/{mandate_id}/items")
async def add_item(
    mandate_id: int,
    request: AddMandateItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually add an item to a mandate section."""
    from models import MandateItemSource

    mandate_service = JobMandateService(db, current_user.user_id)

    # Verify mandate exists
    mandate = mandate_service.get_mandate(mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    item = mandate_service.add_item(
        mandate_id=mandate_id,
        section=request.section,
        content=request.content,
        category=request.category,
        source=MandateItemSource.USER_ADDED
    )

    if not item:
        raise HTTPException(status_code=400, detail="Failed to add item")

    return {
        "id": item.item_id,
        "content": item.content,
        "category": item.category,
        "section": item.section.value,
        "source": item.source.value,
        "created_at": item.created_at.isoformat()
    }


@router.put("/{mandate_id}/items/{item_id}")
async def update_item(
    mandate_id: int,
    item_id: int,
    request: UpdateMandateItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing item."""
    mandate_service = JobMandateService(db, current_user.user_id)

    # Verify mandate exists
    mandate = mandate_service.get_mandate(mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    item = mandate_service.update_item(
        item_id=item_id,
        content=request.content,
        category=request.category
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return {
        "id": item.item_id,
        "content": item.content,
        "category": item.category,
        "section": item.section.value,
        "source": item.source.value,
        "updated_at": item.updated_at.isoformat()
    }


@router.delete("/{mandate_id}/items/{item_id}")
async def delete_item(
    mandate_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an item from a mandate."""
    mandate_service = JobMandateService(db, current_user.user_id)

    # Verify mandate exists
    mandate = mandate_service.get_mandate(mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    success = mandate_service.delete_item(item_id)

    if not success:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"status": "deleted", "item_id": item_id}


# ============================================================================
# Section Management Endpoints
# ============================================================================

@router.post("/{mandate_id}/sections/{section}/advance")
async def advance_section(
    mandate_id: int,
    section: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually advance to the next section."""
    mandate_service = JobMandateService(db, current_user.user_id)

    mandate = mandate_service.get_mandate(mandate_id)
    if not mandate:
        raise HTTPException(status_code=404, detail="Mandate not found")

    # Verify current section matches
    if mandate.current_section.value != section:
        raise HTTPException(
            status_code=400,
            detail=f"Current section is {mandate.current_section.value}, not {section}"
        )

    updated = mandate_service.advance_to_next_section(mandate_id)

    return {
        "mandate_id": mandate_id,
        "previous_section": section,
        "current_section": updated.current_section.value if updated.status.value != "completed" else None,
        "status": updated.status.value
    }


# ============================================================================
# Helpers
# ============================================================================

def _format_interview_state(state: InterviewState) -> Dict[str, Any]:
    """Format interview state for API response."""
    return {
        "current_section": state.current_section.value,
        "sections": {
            section_type.value: {
                "status": section.status.value,
                "items": [
                    {
                        "id": item.id,
                        "content": item.content,
                        "category": item.category,
                        "source": item.source.value if hasattr(item.source, 'value') else item.source
                    }
                    for item in section.items
                ]
            }
            for section_type, section in state.sections.items()
        }
    }
