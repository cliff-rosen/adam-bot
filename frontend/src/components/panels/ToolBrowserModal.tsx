import { useState, useEffect } from 'react';
import {
    XMarkIcon, WrenchScrewdriverIcon, MagnifyingGlassIcon,
    BoltIcon, GlobeAltIcon, DocumentTextIcon, CpuChipIcon,
    EnvelopeIcon, CalendarIcon, CloudIcon, BeakerIcon,
    ArrowPathIcon, ChevronRightIcon, CheckCircleIcon
} from '@heroicons/react/24/solid';
import { toolsApi, ToolInfo } from '../../lib/api/toolsApi';

interface ToolBrowserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Category icons and colors
const getCategoryInfo = (category: string) => {
    switch (category.toLowerCase()) {
        case 'research':
            return { icon: BeakerIcon, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' };
        case 'web':
            return { icon: GlobeAltIcon, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
        case 'memory':
            return { icon: CpuChipIcon, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' };
        case 'assets':
            return { icon: DocumentTextIcon, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
        case 'email':
            return { icon: EnvelopeIcon, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
        case 'calendar':
            return { icon: CalendarIcon, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
        case 'workflow':
            return { icon: ArrowPathIcon, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' };
        case 'integration':
            return { icon: CloudIcon, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30' };
        default:
            return { icon: BoltIcon, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-900/30' };
    }
};

// Format parameter type for display
const formatParamType = (param: any): string => {
    if (param.enum) {
        return param.enum.map((v: string) => `"${v}"`).join(' | ');
    }
    if (param.type === 'array' && param.items) {
        return `${param.items.type}[]`;
    }
    return param.type;
};

export default function ToolBrowserModal({ isOpen, onClose }: ToolBrowserModalProps) {
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedTool, setSelectedTool] = useState<ToolInfo | null>(null);

    // Load tools on open
    useEffect(() => {
        if (!isOpen) return;

        const loadTools = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await toolsApi.listTools();
                setTools(response.tools);
                setCategories(response.categories);
            } catch (err) {
                setError('Failed to load tools');
                console.error('Error loading tools:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadTools();
    }, [isOpen]);

    if (!isOpen) return null;

    // Filter tools
    const filteredTools = tools
        .filter(tool => {
            if (selectedCategory && tool.category !== selectedCategory) return false;
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            return tool.name.toLowerCase().includes(query) ||
                   tool.description.toLowerCase().includes(query);
        });

    // Group tools by category
    const toolsByCategory = filteredTools.reduce((acc, tool) => {
        if (!acc[tool.category]) {
            acc[tool.category] = [];
        }
        acc[tool.category].push(tool);
        return acc;
    }, {} as Record<string, ToolInfo[]>);

    // Get counts by category
    const categoryCounts = tools.reduce((acc, tool) => {
        acc[tool.category] = (acc[tool.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Tool detail view
    if (selectedTool) {
        const categoryInfo = getCategoryInfo(selectedTool.category);
        const CategoryIcon = categoryInfo.icon;
        const schema = selectedTool.input_schema;
        const properties = schema.properties || {};
        const required = schema.required || [];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[90vw] h-[85vh] max-w-4xl flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedTool(null)}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                            >
                                <ChevronRightIcon className="h-5 w-5 rotate-180" />
                            </button>
                            <div className={`p-2 rounded-lg ${categoryInfo.bg}`}>
                                <CategoryIcon className={`h-5 w-5 ${categoryInfo.color}`} />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white font-mono">
                                    {selectedTool.name}
                                </h2>
                                <span className={`text-xs px-2 py-0.5 rounded ${categoryInfo.bg} ${categoryInfo.color}`}>
                                    {selectedTool.category}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedTool.streaming && (
                                <span className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-2 py-1 rounded">
                                    <ArrowPathIcon className="h-3 w-3" />
                                    Streaming
                                </span>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Description */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                            <p className="text-gray-900 dark:text-white leading-relaxed">
                                {selectedTool.description}
                            </p>
                        </div>

                        {/* Parameters */}
                        {Object.keys(properties).length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Parameters</h3>
                                <div className="space-y-3">
                                    {Object.entries(properties).map(([name, param]: [string, any]) => {
                                        const isRequired = required.includes(name);
                                        return (
                                            <div
                                                key={name}
                                                className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-sm font-semibold text-gray-900 dark:text-white">
                                                            {name}
                                                        </code>
                                                        <code className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                                            {formatParamType(param)}
                                                        </code>
                                                        {isRequired && (
                                                            <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                                                                required
                                                            </span>
                                                        )}
                                                    </div>
                                                    {param.default !== undefined && (
                                                        <span className="text-xs text-gray-500">
                                                            default: <code className="text-gray-700 dark:text-gray-300">{JSON.stringify(param.default)}</code>
                                                        </span>
                                                    )}
                                                </div>
                                                {param.description && (
                                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                                        {param.description}
                                                    </p>
                                                )}
                                                {param.enum && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {param.enum.map((value: string) => (
                                                            <code
                                                                key={value}
                                                                className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded"
                                                            >
                                                                {value}
                                                            </code>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* No parameters */}
                        {Object.keys(properties).length === 0 && (
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                    This tool takes no parameters
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[90vw] h-[85vh] max-w-5xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <WrenchScrewdriverIcon className="h-6 w-6 text-teal-500" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Tools
                        </h2>
                        <span className="text-sm text-gray-500">({tools.length} available)</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
                    {/* Search */}
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Category tabs */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                                selectedCategory === null
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            All
                            <span className={`ml-1 text-xs ${selectedCategory === null ? 'opacity-70' : 'text-gray-500'}`}>
                                {tools.length}
                            </span>
                        </button>
                        {categories.map(category => {
                            const info = getCategoryInfo(category);
                            const Icon = info.icon;
                            return (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                                        selectedCategory === category
                                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <Icon className={`h-3.5 w-3.5 ${selectedCategory === category ? '' : info.color}`} />
                                    {category}
                                    <span className={`text-xs ${selectedCategory === category ? 'opacity-70' : 'text-gray-500'}`}>
                                        {categoryCounts[category]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tool list */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                            <ArrowPathIcon className="h-8 w-8 animate-spin mb-3" />
                            <p>Loading tools...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-red-500">
                            <p>{error}</p>
                        </div>
                    ) : filteredTools.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                            <WrenchScrewdriverIcon className="h-12 w-12 mb-3 opacity-50" />
                            <p className="text-lg">No tools found</p>
                            {searchQuery && (
                                <p className="text-sm mt-1">Try a different search term</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {(selectedCategory ? [selectedCategory] : Object.keys(toolsByCategory).sort()).map(category => (
                                <div key={category}>
                                    {/* Category header */}
                                    {!selectedCategory && (
                                        <div className="flex items-center gap-2 mb-3">
                                            {(() => {
                                                const info = getCategoryInfo(category);
                                                const Icon = info.icon;
                                                return (
                                                    <>
                                                        <div className={`p-1.5 rounded ${info.bg}`}>
                                                            <Icon className={`h-4 w-4 ${info.color}`} />
                                                        </div>
                                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                            {category}
                                                        </h3>
                                                        <span className="text-xs text-gray-400">
                                                            {toolsByCategory[category]?.length || 0} tools
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Tools grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(toolsByCategory[category] || []).map(tool => {
                                            const info = getCategoryInfo(tool.category);
                                            const Icon = info.icon;
                                            const paramCount = Object.keys(tool.input_schema.properties || {}).length;
                                            const requiredCount = (tool.input_schema.required || []).length;

                                            return (
                                                <button
                                                    key={tool.name}
                                                    onClick={() => setSelectedTool(tool)}
                                                    className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-lg ${info.bg} group-hover:scale-110 transition-transform`}>
                                                            <Icon className={`h-4 w-4 ${info.color}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white font-mono truncate">
                                                                    {tool.name}
                                                                </h4>
                                                                {tool.streaming && (
                                                                    <ArrowPathIcon className="h-3 w-3 text-teal-500 flex-shrink-0" title="Streaming" />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                                {tool.description}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                {paramCount > 0 && (
                                                                    <span className="text-xs text-gray-400">
                                                                        {paramCount} param{paramCount !== 1 ? 's' : ''}
                                                                        {requiredCount > 0 && ` (${requiredCount} required)`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ChevronRightIcon className="h-4 w-4 text-gray-400 group-hover:text-teal-500 flex-shrink-0" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
