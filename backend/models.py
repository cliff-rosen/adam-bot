"""
JobForge Database Models

Simplified models for the personal AI agent system.
Core entities: Users, Profiles, Conversations, Messages, Memories, Assets
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, JSON, Enum, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum


class MemoryType(str, PyEnum):
    """Types of memory entries"""
    WORKING = "working"      # Session-scoped, auto-expires
    FACT = "fact"            # Persistent knowledge about user
    PREFERENCE = "preference" # User preferences
    ENTITY = "entity"        # People, projects, systems
    PROJECT = "project"      # Active project context


class AssetType(str, PyEnum):
    """Types of assets"""
    FILE = "file"
    DOCUMENT = "document"
    DATA = "data"
    CODE = "code"
    LINK = "link"
    LIST = "list"  # Iterable list of items (JSON array in content field)


class OAuthProvider(str, PyEnum):
    """Supported OAuth providers"""
    GOOGLE = "google"


class AgentLifecycle(str, PyEnum):
    """Lifecycle types for autonomous agents"""
    ONE_SHOT = "one_shot"      # Run once to completion
    SCHEDULED = "scheduled"    # Run on a schedule (cron)
    MONITOR = "monitor"        # Watch for conditions, sleep between checks


class AgentStatus(str, PyEnum):
    """Status of an autonomous agent"""
    ACTIVE = "active"          # Agent is active and will run
    PAUSED = "paused"          # Agent is paused by user
    COMPLETED = "completed"    # One-shot agent that finished
    FAILED = "failed"          # Agent encountered unrecoverable error


class AgentRunStatus(str, PyEnum):
    """Status of a single agent run"""
    PENDING = "pending"        # Queued, waiting to start
    RUNNING = "running"        # Currently executing
    SLEEPING = "sleeping"      # Waiting for next check (monitor type)
    COMPLETED = "completed"    # Finished successfully
    FAILED = "failed"          # Run failed


class AgentRunEventType(str, PyEnum):
    """Types of events during agent run execution"""
    STATUS = "status"              # General status update
    THINKING = "thinking"          # Agent is thinking/planning
    TOOL_START = "tool_start"      # Starting a tool call
    TOOL_PROGRESS = "tool_progress"  # Progress update from tool
    TOOL_COMPLETE = "tool_complete"  # Tool call completed
    TOOL_ERROR = "tool_error"      # Tool call failed
    MESSAGE = "message"            # Agent produced a message
    ERROR = "error"                # General error
    WARNING = "warning"            # Warning (non-fatal)

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


class Memory(Base):
    """User memory for context enhancement"""
    __tablename__ = "memories"

    memory_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)

    # Classification
    memory_type = Column(Enum(MemoryType, name='memorytype'), nullable=False)
    category = Column(String(100), nullable=True)  # e.g., "work", "personal"

    # Content
    content = Column(Text, nullable=False)
    source_conversation_id = Column(Integer, ForeignKey("conversations.conversation_id", ondelete="SET NULL"), nullable=True)

    # Embedding for semantic search (stored as JSON array)
    embedding = Column(JSON, nullable=True)

    # Temporal
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # For working memory auto-cleanup
    last_accessed_at = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0)

    # Control
    is_active = Column(Boolean, default=True)  # Include in context
    is_pinned = Column(Boolean, default=False)  # Always include
    confidence = Column(Float, default=1.0)  # For auto-extracted memories

    # Relationships
    user = relationship("User")
    source_conversation = relationship("Conversation")


class Asset(Base):
    """User assets for context enhancement"""
    __tablename__ = "assets"

    asset_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)

    # Identity
    name = Column(String(255), nullable=False)
    asset_type = Column(Enum(AssetType, name='assettype'), nullable=False)
    mime_type = Column(String(100), nullable=True)

    # Content (choose based on size/type)
    content = Column(Text, nullable=True)  # For small text content
    file_path = Column(String(500), nullable=True)  # For file storage reference
    external_url = Column(String(500), nullable=True)  # For links

    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)  # Array of tags for filtering
    extra_data = Column(JSON, default=dict)  # Flexible extra data

    # Context control
    is_in_context = Column(Boolean, default=False)  # Currently active in context
    context_summary = Column(Text, nullable=True)  # Compressed version for context

    # Source tracking
    source_conversation_id = Column(Integer, ForeignKey("conversations.conversation_id", ondelete="SET NULL"), nullable=True)
    created_by_agent_id = Column(Integer, ForeignKey("autonomous_agents.agent_id", ondelete="SET NULL"), nullable=True)
    agent_run_id = Column(Integer, ForeignKey("agent_runs.run_id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    source_conversation = relationship("Conversation")
    created_by_agent = relationship("AutonomousAgent")
    source_run = relationship("AgentRun")


class AutonomousAgent(Base):
    """Definition of an autonomous background agent"""
    __tablename__ = "autonomous_agents"

    agent_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)

    # Identity
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Configuration
    lifecycle = Column(Enum(AgentLifecycle, name='agentlifecycle'), nullable=False)
    instructions = Column(Text, nullable=False)  # The prompt/task for the agent
    tools = Column(JSON, default=list)  # List of tool names the agent can use

    # Schedule (for scheduled/monitor types)
    schedule = Column(String(100), nullable=True)  # Cron expression or interval like "every 6 hours"
    monitor_interval_minutes = Column(Integer, nullable=True)  # For monitor type: minutes between checks

    # Status
    status = Column(Enum(AgentStatus, name='agentstatus'), default=AgentStatus.ACTIVE)

    # Stats
    total_runs = Column(Integer, default=0)
    total_assets_created = Column(Integer, default=0)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
    runs = relationship("AgentRun", back_populates="agent", cascade="all, delete-orphan")


class AgentRun(Base):
    """A single execution/run of an autonomous agent"""
    __tablename__ = "agent_runs"

    run_id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("autonomous_agents.agent_id", ondelete="CASCADE"), nullable=False, index=True)

    # Status
    status = Column(Enum(AgentRunStatus, name='agentrunstatus'), default=AgentRunStatus.PENDING)

    # Execution details
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    next_wake_at = Column(DateTime, nullable=True)  # For sleeping runs

    # Results
    result_summary = Column(Text, nullable=True)  # Brief summary of what happened
    result_data = Column(JSON, nullable=True)  # Structured result data
    error = Column(Text, nullable=True)  # Error message if failed

    # Tool usage
    tool_calls = Column(JSON, default=list)  # Array of tool calls made

    # Assets created during this run
    assets_created = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    agent = relationship("AutonomousAgent", back_populates="runs")
    events = relationship("AgentRunEvent", back_populates="run", cascade="all, delete-orphan", order_by="AgentRunEvent.created_at")


class AgentRunEvent(Base):
    """Telemetry event from an agent run execution"""
    __tablename__ = "agent_run_events"

    event_id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("agent_runs.run_id", ondelete="CASCADE"), nullable=False, index=True)

    # Event classification
    event_type = Column(Enum(AgentRunEventType, name='agentruneventtype'), nullable=False)

    # Human-readable message
    message = Column(Text, nullable=False)

    # Structured data (tool name, input, output, error details, etc.)
    data = Column(JSON, nullable=True)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    run = relationship("AgentRun", back_populates="events")


class OAuthToken(Base):
    """OAuth tokens for third-party service integrations"""
    __tablename__ = "oauth_tokens"

    token_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    provider = Column(Enum(OAuthProvider, name='oauthprovider'), nullable=False)

    # Token data
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_type = Column(String(50), default="Bearer")

    # Token metadata
    expires_at = Column(DateTime, nullable=True)
    scopes = Column(JSON, default=list)  # List of granted scopes

    # Provider-specific data (e.g., email address)
    provider_data = Column(JSON, default=dict)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User")
