"""
Workflow Templates

Pre-built workflow templates that users can instantiate.
"""

from .research import research_workflow


def register_all_workflows():
    """Register all built-in workflow templates."""
    from ..registry import workflow_registry

    workflow_registry.register(research_workflow)


__all__ = [
    "research_workflow",
    "register_all_workflows",
]
