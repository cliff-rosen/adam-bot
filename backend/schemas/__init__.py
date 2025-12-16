"""
Schemas package for JobForge API
"""

from .auth import (
    UserBase,
    UserCreate,
    UserResponse,
    Token,
    TokenData
)

__all__ = [
    # Auth schemas
    'UserBase',
    'UserCreate',
    'UserResponse',
    'Token',
    'TokenData',
]
