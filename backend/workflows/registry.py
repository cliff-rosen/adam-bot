"""
Workflow Registry

Central registry for all available workflow templates.
"""

from typing import Dict, List, Optional
from schemas.workflow import WorkflowDefinition


class WorkflowRegistry:
    """
    Registry for workflow definitions.

    Workflows are registered at startup and can be retrieved by ID.
    """

    _instance: Optional["WorkflowRegistry"] = None

    def __init__(self):
        self._workflows: Dict[str, WorkflowDefinition] = {}

    @classmethod
    def get_instance(cls) -> "WorkflowRegistry":
        """Get the singleton registry instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, workflow: WorkflowDefinition) -> None:
        """Register a workflow definition."""
        if workflow.id in self._workflows:
            raise ValueError(f"Workflow '{workflow.id}' is already registered")
        self._workflows[workflow.id] = workflow

    def get(self, workflow_id: str) -> Optional[WorkflowDefinition]:
        """Get a workflow definition by ID."""
        return self._workflows.get(workflow_id)

    def get_all(self) -> List[WorkflowDefinition]:
        """Get all registered workflow definitions."""
        return list(self._workflows.values())

    def get_by_category(self, category: str) -> List[WorkflowDefinition]:
        """Get all workflows in a category."""
        return [w for w in self._workflows.values() if w.category == category]

    def list_categories(self) -> List[str]:
        """Get all unique categories."""
        return list(set(w.category for w in self._workflows.values()))

    def to_dict(self, workflow_id: str) -> Optional[Dict]:
        """Get a workflow definition as a dict for API responses."""
        workflow = self.get(workflow_id)
        if not workflow:
            return None

        return {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "icon": workflow.icon,
            "category": workflow.category,
            "input_schema": workflow.input_schema,
            "output_schema": workflow.output_schema,
            "steps": [
                {
                    "id": step.id,
                    "name": step.name,
                    "description": step.description,
                    "step_type": step.step_type.value,
                    "ui_component": step.ui_component,
                    "checkpoint_config": {
                        "title": step.checkpoint_config.title,
                        "description": step.checkpoint_config.description,
                        "allowed_actions": [a.value for a in step.checkpoint_config.allowed_actions],
                        "editable_fields": step.checkpoint_config.editable_fields,
                    } if step.checkpoint_config else None
                }
                for step in workflow.steps
            ]
        }

    def list_all_dict(self) -> List[Dict]:
        """Get all workflows as dicts for API responses."""
        return [
            {
                "id": w.id,
                "name": w.name,
                "description": w.description,
                "icon": w.icon,
                "category": w.category,
            }
            for w in self._workflows.values()
        ]


# Global registry instance
workflow_registry = WorkflowRegistry.get_instance()
