"""
CMR-Bot Database Models

Simplified models for the personal AI agent system.
Core entities: Users, Profiles, Conversations, Messages
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum

Base = declarative_base()


class UserRole(str, PyEnum):
    """User privilege levels"""
    ADMIN = "admin"
    USER = "user"


class User(Base):
    """User authentication and basic information"""
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password = Column(String(255))
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(UserRole, name='userrole'), default=UserRole.USER, nullable=False)
    login_token = Column(String(255), nullable=True, index=True)  # One-time login token
    login_token_expires = Column(DateTime, nullable=True)  # Token expiration time
    registration_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)


class UserProfile(Base):
    """User profile and preferences"""
    __tablename__ = "user_profiles"

    profile_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)

    # Basic info
    display_name = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)

    # Preferences stored as JSON for flexibility
    preferences = Column(JSON, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="profile")


class Conversation(Base):
    """Chat conversation container"""
    __tablename__ = "conversations"

    conversation_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    title = Column(String(255), nullable=True)  # Auto-generated or user-set
    is_archived = Column(Boolean, default=False)
    extra_data = Column(JSON, default=dict)  # Flexible storage for future needs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Individual chat message"""
    __tablename__ = "messages"

    message_id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.conversation_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)

    # Tool usage tracking
    tool_calls = Column(JSON, nullable=True)  # Array of {tool_name, input, output}

    # Rich response data (for assistant messages)
    suggested_values = Column(JSON, nullable=True)
    suggested_actions = Column(JSON, nullable=True)
    custom_payload = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
