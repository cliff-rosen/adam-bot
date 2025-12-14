"""
Workflow Engine Package

Provides a deterministic workflow execution engine.
Workflows are defined as a sequence of steps with conditionals and loops.
Individual steps may use LLMs or tools, but the orchestration is code-based.
"""

from schemas.workflow import (
    StepType,
    CheckpointAction,
    StepOutput,
    CheckpointConfig,
    StepDefinition,
    WorkflowDefinition,
    WorkflowStatus,
    StepState,
    WorkflowContext,
    WorkflowInstance,
)
from .registry import workflow_registry, WorkflowRegistry
from .engine import workflow_engine, WorkflowEngine, EngineEvent

__all__ = [
    # Schema types
    "StepType",
    "CheckpointAction",
    "StepOutput",
    "CheckpointConfig",
    "StepDefinition",
    "WorkflowDefinition",
    "WorkflowStatus",
    "StepState",
    "WorkflowContext",
    "WorkflowInstance",
    # Registry
    "workflow_registry",
    "WorkflowRegistry",
    # Engine
    "workflow_engine",
    "WorkflowEngine",
    "EngineEvent",
]
