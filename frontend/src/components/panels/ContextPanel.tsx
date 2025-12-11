import { useState } from 'react';
import {
    WrenchScrewdriverIcon, XMarkIcon, PlusIcon, DocumentIcon,
    CpuChipIcon, LightBulbIcon, BookmarkIcon, Cog6ToothIcon,
    UserIcon, HeartIcon, BuildingOfficeIcon, FolderIcon, ClockIcon
} from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutlineIcon } from '@heroicons/react/24/outline';
import { Memory, MemoryType, Asset } from '../../lib/api';
import { ToolCall } from '../../types/chat';

interface ContextPanelProps {
    memories: Memory[];
    assets: Asset[];
    lastToolHistory: ToolCall[] | undefined;
    conversationId: number | null;
    onAddWorkingMemory: (content: string) => void;
    onToggleMemoryPinned: (memId: number) => void;
    onDeleteMemory: (memId: number) => void;
    onToggleAssetContext: (assetId: number) => void;
    onToolHistoryClick: (toolHistory: ToolCall[]) => void;
}

// Helper to get memory type icon and color
const getMemoryTypeInfo = (type: MemoryType) => {
    switch (type) {
        case 'fact':
            return { icon: UserIcon, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Fact' };
        case 'preference':
            return { icon: HeartIcon, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30', label: 'Preference' };
        case 'entity':
            return { icon: BuildingOfficeIcon, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Entity' };
        case 'project':
            return { icon: FolderIcon, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Project' };
        case 'working':
            return { icon: ClockIcon, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Session' };
        default:
            return { icon: LightBulbIcon, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-900/30', label: type };
    }
};

export default function ContextPanel({
    memories,
    assets,
    lastToolHistory,
    conversationId,
    onAddWorkingMemory,
    onToggleMemoryPinned,
    onDeleteMemory,
    onToggleAssetContext,
    onToolHistoryClick
}: ContextPanelProps) {
    const [newMemoryInput, setNewMemoryInput] = useState('');
    const [memoryFilter, setMemoryFilter] = useState<MemoryType | 'all' | 'pinned'>('all');

    // Derived data
    const filteredMemories = memories.filter(m => {
        if (!m.is_active) return false;
        if (memoryFilter === 'all') return true;
        if (memoryFilter === 'pinned') return m.is_pinned;
        return m.memory_type === memoryFilter;
    });

    const memoryCounts = {
        all: memories.filter(m => m.is_active).length,
        pinned: memories.filter(m => m.is_pinned && m.is_active).length,
        fact: memories.filter(m => m.memory_type === 'fact' && m.is_active).length,
        preference: memories.filter(m => m.memory_type === 'preference' && m.is_active).length,
        entity: memories.filter(m => m.memory_type === 'entity' && m.is_active).length,
        project: memories.filter(m => m.memory_type === 'project' && m.is_active).length,
        working: memories.filter(m => m.memory_type === 'working' && m.is_active).length,
    };

    const contextAssets = assets.filter(a => a.is_in_context);
    const otherAssets = assets.filter(a => !a.is_in_context);

    const handleAddMemory = () => {
        if (newMemoryInput.trim()) {
            onAddWorkingMemory(newMemoryInput.trim());
            setNewMemoryInput('');
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Context Panel Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 min-w-[280px]">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Context
                </h2>
                <Cog6ToothIcon className="h-5 w-5 text-gray-400" />
            </div>

            {/* Context Panel Content */}
            <div className="flex-1 overflow-y-auto min-w-[280px]">
                {/* Active Tools Section */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                            <WrenchScrewdriverIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                                Available Tools
                            </span>
                        </div>
                    </div>
                    <div className="p-3 space-y-1">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            web_search
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            fetch_webpage
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            save_memory
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            search_memory
                        </div>
                    </div>
                </div>

                {/* Memories Section */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LightBulbIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                                    Memories
                                </span>
                                <span className="text-xs text-gray-500">({memoryCounts.all})</span>
                            </div>
                        </div>
                    </div>

                    {/* Memory Type Filter Tabs */}
                    <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                        <div className="flex gap-1 min-w-max">
                            <button
                                onClick={() => setMemoryFilter('all')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                    memoryFilter === 'all'
                                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setMemoryFilter('pinned')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                                    memoryFilter === 'pinned'
                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <BookmarkIcon className="h-3 w-3" />
                                {memoryCounts.pinned > 0 && memoryCounts.pinned}
                            </button>
                            <button
                                onClick={() => setMemoryFilter('fact')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                                    memoryFilter === 'fact'
                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <UserIcon className="h-3 w-3" />
                                {memoryCounts.fact > 0 && memoryCounts.fact}
                            </button>
                            <button
                                onClick={() => setMemoryFilter('preference')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                                    memoryFilter === 'preference'
                                        ? 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <HeartIcon className="h-3 w-3" />
                                {memoryCounts.preference > 0 && memoryCounts.preference}
                            </button>
                            <button
                                onClick={() => setMemoryFilter('entity')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                                    memoryFilter === 'entity'
                                        ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <BuildingOfficeIcon className="h-3 w-3" />
                                {memoryCounts.entity > 0 && memoryCounts.entity}
                            </button>
                            <button
                                onClick={() => setMemoryFilter('project')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                                    memoryFilter === 'project'
                                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <FolderIcon className="h-3 w-3" />
                                {memoryCounts.project > 0 && memoryCounts.project}
                            </button>
                            <button
                                onClick={() => setMemoryFilter('working')}
                                className={`px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                                    memoryFilter === 'working'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <ClockIcon className="h-3 w-3" />
                                {memoryCounts.working > 0 && memoryCounts.working}
                            </button>
                        </div>
                    </div>

                    {/* Quick add working memory */}
                    {memoryFilter === 'working' && (
                        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    value={newMemoryInput}
                                    onChange={(e) => setNewMemoryInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                                    placeholder="Add session note..."
                                    className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={handleAddMemory}
                                    className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Memory list */}
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                        {filteredMemories.length === 0 ? (
                            <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-4">
                                {memoryFilter === 'all'
                                    ? "No memories yet. The AI will remember important things you share."
                                    : `No ${memoryFilter === 'pinned' ? 'pinned' : memoryFilter} memories`}
                            </div>
                        ) : (
                            filteredMemories.map((mem) => {
                                const typeInfo = getMemoryTypeInfo(mem.memory_type);
                                const TypeIcon = typeInfo.icon;
                                return (
                                    <div
                                        key={mem.memory_id}
                                        className={`flex items-start gap-2 px-2 py-1.5 rounded ${typeInfo.bg}`}
                                    >
                                        <TypeIcon className={`h-3 w-3 mt-0.5 flex-shrink-0 ${typeInfo.color}`} />
                                        <span className="flex-1 text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                                            {mem.content}
                                        </span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => onToggleMemoryPinned(mem.memory_id)}
                                                className={`${mem.is_pinned ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
                                                title={mem.is_pinned ? "Unpin" : "Pin memory"}
                                            >
                                                {mem.is_pinned ? (
                                                    <BookmarkIcon className="h-3 w-3" />
                                                ) : (
                                                    <BookmarkOutlineIcon className="h-3 w-3" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => onDeleteMemory(mem.memory_id)}
                                                className="text-gray-400 hover:text-red-500"
                                                title="Delete memory"
                                            >
                                                <XMarkIcon className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Assets in Context Section */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                            <DocumentIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                                Assets in Context
                            </span>
                        </div>
                    </div>
                    <div className="p-3 space-y-1">
                        {contextAssets.length === 0 ? (
                            <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-2">
                                No assets loaded
                            </div>
                        ) : (
                            contextAssets.map((asset) => (
                                <div key={asset.asset_id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-orange-50 dark:bg-orange-900/20 text-sm">
                                    <span className="flex-1 text-gray-700 dark:text-gray-300 text-xs truncate">{asset.name}</span>
                                    <button
                                        onClick={() => onToggleAssetContext(asset.asset_id)}
                                        className="text-gray-400 hover:text-red-500"
                                        title="Remove from context"
                                    >
                                        <XMarkIcon className="h-3 w-3" />
                                    </button>
                                </div>
                            ))
                        )}
                        {/* Show other assets that can be added */}
                        {otherAssets.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-xs text-gray-500 mb-1">Available:</div>
                                {otherAssets.slice(0, 3).map((asset) => (
                                    <button
                                        key={asset.asset_id}
                                        onClick={() => onToggleAssetContext(asset.asset_id)}
                                        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <PlusIcon className="h-3 w-3" />
                                        {asset.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Tool Calls Section */}
                {lastToolHistory && lastToolHistory.length > 0 && (
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800">
                            <div className="flex items-center gap-2">
                                <CpuChipIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                                    Recent Tool Calls
                                </span>
                            </div>
                        </div>
                        <div className="p-3 space-y-2">
                            {lastToolHistory.slice(0, 5).map((tool, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => onToolHistoryClick(lastToolHistory)}
                                    className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 truncate"
                                >
                                    {tool.tool_name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
