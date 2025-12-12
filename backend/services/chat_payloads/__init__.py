"""
Chat Tools Package for CMR Bot

This package contains the tool registry and built-in tools for the primary agent.
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

from .tools import register_builtin_tools

__all__ = [
    'ToolConfig',
    'ToolResult',
    'ToolProgress',
    'register_tool',
    'get_tool',
    'get_all_tools',
    'get_tools_by_category',
    'get_tools_for_anthropic',
    'register_builtin_tools'
]
