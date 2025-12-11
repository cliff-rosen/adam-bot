"""
Profile API Router

Endpoints for managing user profile and preferences.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from database import get_db
from models import User
from routers.auth import get_current_user
from services.profile_service import ProfileService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profile", tags=["profile"])


# =============================================================================
# Request/Response Models
# =============================================================================

class ProfileResponse(BaseModel):
    user_id: int
    email: str
    full_name: Optional[str]
    display_name: Optional[str]
    bio: Optional[str]
    preferences: Dict[str, Any]

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None


class PreferencesUpdate(BaseModel):
    preferences: Dict[str, Any]


# =============================================================================
# Endpoints
# =============================================================================

@router.get("", response_model=ProfileResponse)
async def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current user's profile."""
    service = ProfileService(db, current_user.user_id)
    user = service.get_user_with_profile()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return ProfileResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        display_name=user.profile.display_name if user.profile else None,
        bio=user.profile.bio if user.profile else None,
        preferences=user.profile.preferences if user.profile and user.profile.preferences else {}
    )


@router.patch("", response_model=ProfileResponse)
async def update_profile(
    update: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the current user's profile."""
    service = ProfileService(db, current_user.user_id)
    user = service.get_user_with_profile()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update user fields
    if update.full_name is not None:
        user.full_name = update.full_name

    # Ensure profile exists
    if not user.profile:
        from models import UserProfile
        user.profile = UserProfile(user_id=user.user_id, preferences={})
        db.add(user.profile)

    # Update profile fields
    if update.display_name is not None:
        user.profile.display_name = update.display_name
    if update.bio is not None:
        user.profile.bio = update.bio

    db.commit()
    db.refresh(user)

    return ProfileResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        display_name=user.profile.display_name if user.profile else None,
        bio=user.profile.bio if user.profile else None,
        preferences=user.profile.preferences if user.profile and user.profile.preferences else {}
    )


@router.get("/preferences", response_model=Dict[str, Any])
async def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user preferences."""
    service = ProfileService(db, current_user.user_id)
    profile = service.get_profile()
    return profile.preferences if profile and profile.preferences else {}


@router.patch("/preferences", response_model=Dict[str, Any])
async def update_preferences(
    update: PreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user preferences (merges with existing)."""
    service = ProfileService(db, current_user.user_id)
    profile = service.update_preferences(update.preferences)
    return profile.preferences


@router.put("/preferences/{key}")
async def set_preference(
    key: str,
    value: Any,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set a single preference value."""
    service = ProfileService(db, current_user.user_id)
    profile = service.set_preference(key, value)
    return {"key": key, "value": profile.preferences.get(key)}


@router.get("/preferences/{key}")
async def get_preference(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single preference value."""
    service = ProfileService(db, current_user.user_id)
    value = service.get_preference(key)
    if value is None:
        raise HTTPException(status_code=404, detail=f"Preference '{key}' not found")
    return {"key": key, "value": value}
