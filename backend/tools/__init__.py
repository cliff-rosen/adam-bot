"""
Tools Package for JobForge

This package contains the tool registry and built-in tools for the primary agent.
Tools are capabilities the agent can invoke during conversations.
"""

from .registry import (
    ToolConfig,
    ToolResult,
    ToolProgress,
    register_tool,
    get_tool,
    get_all_tools,
    get_tools_by_category,
    get_tools_for_anthropic
)

from .executor import (
    execute_tool,
    execute_streaming_tool,
    run_async
)

from .builtin import register_all_builtin_tools

__all__ = [
    # Registry types and functions
    'ToolConfig',
    'ToolResult',
    'ToolProgress',
    'register_tool',
    'get_tool',
    'get_all_tools',
    'get_tools_by_category',
    'get_tools_for_anthropic',
    # Execution utilities
    'execute_tool',
    'execute_streaming_tool',
    'run_async',
    # Registration
    'register_all_builtin_tools'
]
