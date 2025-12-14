"""
Workflow Engine Schema

Defines the core types for workflow definitions and execution state.
"""

from typing import Any, Callable, Dict, List, Optional, Literal, Union, Awaitable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import uuid


class StepType(str, Enum):
    """Types of workflow steps."""
    EXECUTE = "execute"      # Run a function, may use LLM/tools
    CHECKPOINT = "checkpoint"  # Pause for user review/input
    CONDITIONAL = "conditional"  # Branch based on condition
    LOOP = "loop"            # Repeat until condition met


class CheckpointAction(str, Enum):
    """Actions a user can take at a checkpoint."""
    APPROVE = "approve"      # Accept and continue
    EDIT = "edit"            # Modify the data, then continue
    REJECT = "reject"        # Go back or abort
    SKIP = "skip"            # Skip this step


@dataclass
class StepOutput:
    """Output from a step execution."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    # For UI display
    display_title: Optional[str] = None
    display_content: Optional[str] = None
    content_type: Literal["text", "markdown", "json", "table"] = "markdown"


@dataclass
class CheckpointConfig:
    """Configuration for a checkpoint step."""
    title: str
    description: str
    allowed_actions: List[CheckpointAction] = field(default_factory=lambda: [
        CheckpointAction.APPROVE,
        CheckpointAction.EDIT,
        CheckpointAction.REJECT
    ])
    # Field that can be edited at this checkpoint
    editable_fields: List[str] = field(default_factory=list)
    # Whether to auto-proceed if no user action within timeout
    auto_proceed: bool = False
    auto_proceed_timeout_seconds: Optional[int] = None


@dataclass
class StepDefinition:
    """Definition of a single step in a workflow."""
    id: str
    name: str
    description: str
    step_type: StepType

    # For EXECUTE steps: the function to run
    # Signature: async (context: WorkflowContext) -> StepOutput
    execute_fn: Optional[Callable[["WorkflowContext"], Awaitable[StepOutput]]] = None

    # For CHECKPOINT steps
    checkpoint_config: Optional[CheckpointConfig] = None

    # For CONDITIONAL steps: function that returns the next step ID
    # Signature: (context: WorkflowContext) -> str
    condition_fn: Optional[Callable[["WorkflowContext"], str]] = None

    # For LOOP steps: function that returns True to continue looping
    # Signature: (context: WorkflowContext) -> bool
    loop_condition_fn: Optional[Callable[["WorkflowContext"], bool]] = None
    loop_step_id: Optional[str] = None  # Step to loop back to

    # Default next step (for EXECUTE and CHECKPOINT after approval)
    next_step_id: Optional[str] = None  # None means end of workflow

    # For UI: which component to show in workspace
    ui_component: Optional[str] = None


@dataclass
class WorkflowDefinition:
    """Definition of a complete workflow template."""
    id: str
    name: str
    description: str
    icon: str  # Icon identifier for UI
    category: str  # e.g., "research", "data", "content"

    # The steps in this workflow
    steps: List[StepDefinition] = field(default_factory=list)

    # ID of the first step
    initial_step_id: str = ""

    # Schema for the initial input this workflow needs
    input_schema: Dict[str, Any] = field(default_factory=dict)

    # Schema for the final output this workflow produces
    output_schema: Dict[str, Any] = field(default_factory=dict)

    def get_step(self, step_id: str) -> Optional[StepDefinition]:
        """Get a step by ID."""
        for step in self.steps:
            if step.id == step_id:
                return step
        return None


class WorkflowStatus(str, Enum):
    """Status of a workflow instance."""
    PENDING = "pending"          # Created but not started
    RUNNING = "running"          # Currently executing a step
    WAITING = "waiting"          # At a checkpoint, waiting for user
    PAUSED = "paused"            # User paused execution
    COMPLETED = "completed"      # Successfully finished
    FAILED = "failed"            # Error occurred
    CANCELLED = "cancelled"      # User cancelled


@dataclass
class StepState:
    """Runtime state of a step execution."""
    step_id: str
    status: Literal["pending", "running", "completed", "failed", "skipped"]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output: Optional[StepOutput] = None
    error: Optional[str] = None
    # Number of times this step has been executed (for loops)
    execution_count: int = 0


@dataclass
class WorkflowContext:
    """
    Runtime context passed to step functions.
    Contains all state needed to execute a step.
    """
    # The workflow instance ID
    instance_id: str

    # The workflow definition
    definition: WorkflowDefinition

    # Initial input provided when starting the workflow
    initial_input: Dict[str, Any]

    # Accumulated data from previous steps
    # Key is step_id, value is the step's output data
    step_data: Dict[str, Any] = field(default_factory=dict)

    # Current step being executed
    current_step_id: Optional[str] = None

    # State of all steps
    step_states: Dict[str, StepState] = field(default_factory=dict)

    # User edits made at checkpoints
    user_edits: Dict[str, Any] = field(default_factory=dict)

    # Variables that can be set/read by steps (like loop counters)
    variables: Dict[str, Any] = field(default_factory=dict)

    def get_step_output(self, step_id: str) -> Optional[Any]:
        """Get the output data from a previous step."""
        return self.step_data.get(step_id)

    def set_variable(self, name: str, value: Any):
        """Set a context variable."""
        self.variables[name] = value

    def get_variable(self, name: str, default: Any = None) -> Any:
        """Get a context variable."""
        return self.variables.get(name, default)


@dataclass
class WorkflowInstance:
    """
    A running instance of a workflow.
    This is what gets persisted and tracks execution state.
    """
    id: str
    workflow_id: str  # References WorkflowDefinition.id
    status: WorkflowStatus

    # The context containing all runtime state
    context: WorkflowContext

    # Current step (for quick access)
    current_step_id: Optional[str] = None

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    # For associating with a conversation
    conversation_id: Optional[int] = None

    # Final output when completed
    final_output: Optional[Any] = None

    @classmethod
    def create(
        cls,
        workflow_def: WorkflowDefinition,
        initial_input: Dict[str, Any],
        conversation_id: Optional[int] = None
    ) -> "WorkflowInstance":
        """Create a new workflow instance from a definition."""
        instance_id = str(uuid.uuid4())

        context = WorkflowContext(
            instance_id=instance_id,
            definition=workflow_def,
            initial_input=initial_input,
            step_data={},
            current_step_id=workflow_def.initial_step_id,
            step_states={},
            user_edits={},
            variables={}
        )

        return cls(
            id=instance_id,
            workflow_id=workflow_def.id,
            status=WorkflowStatus.PENDING,
            context=context,
            current_step_id=workflow_def.initial_step_id,
            conversation_id=conversation_id
        )
