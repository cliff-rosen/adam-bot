import { useState } from 'react';
import {
    XMarkIcon, BookmarkIcon, TrashIcon, LightBulbIcon,
    UserIcon, HeartIcon, BuildingOfficeIcon, FolderIcon, ClockIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkOutlineIcon } from '@heroicons/react/24/outline';
import { Memory, MemoryType } from '../../lib/api';

interface MemoryBrowserModalProps {
    isOpen: boolean;
    memories: Memory[];
    onClose: () => void;
    onTogglePinned: (memId: number) => void;
    onDelete: (memId: number) => void;
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

type FilterType = 'all' | 'pinned' | MemoryType;

export default function MemoryBrowserModal({
    isOpen,
    memories,
    onClose,
    onTogglePinned,
    onDelete
}: MemoryBrowserModalProps) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    if (!isOpen) return null;

    // Filter memories
    const filteredMemories = memories
        .filter(m => m.is_active)
        .filter(m => {
            if (filter === 'all') return true;
            if (filter === 'pinned') return m.is_pinned;
            return m.memory_type === filter;
        })
        .filter(m => {
            if (!searchQuery.trim()) return true;
            return m.content.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .sort((a, b) => {
            // Pinned first, then by date
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    // Count by type
    const counts = {
        all: memories.filter(m => m.is_active).length,
        pinned: memories.filter(m => m.is_active && m.is_pinned).length,
        fact: memories.filter(m => m.is_active && m.memory_type === 'fact').length,
        preference: memories.filter(m => m.is_active && m.memory_type === 'preference').length,
        entity: memories.filter(m => m.is_active && m.memory_type === 'entity').length,
        project: memories.filter(m => m.is_active && m.memory_type === 'project').length,
        working: memories.filter(m => m.is_active && m.memory_type === 'working').length,
    };

    const handleDelete = (memId: number) => {
        if (confirmDelete === memId) {
            onDelete(memId);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(memId);
            // Auto-cancel after 3 seconds
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    const filterButtons: { key: FilterType; label: string; icon?: React.ComponentType<{ className?: string }>; color?: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'pinned', label: 'Pinned', icon: BookmarkIcon, color: 'text-blue-500' },
        { key: 'fact', label: 'Facts', icon: UserIcon, color: 'text-blue-500' },
        { key: 'preference', label: 'Preferences', icon: HeartIcon, color: 'text-pink-500' },
        { key: 'entity', label: 'Entities', icon: BuildingOfficeIcon, color: 'text-purple-500' },
        { key: 'project', label: 'Projects', icon: FolderIcon, color: 'text-green-500' },
        { key: 'working', label: 'Session', icon: ClockIcon, color: 'text-yellow-500' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[90vw] h-[85vh] max-w-5xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <LightBulbIcon className="h-6 w-6 text-yellow-500" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Memories
                        </h2>
                        <span className="text-sm text-gray-500">({counts.all} total)</span>
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
                            placeholder="Search memories..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex flex-wrap gap-2">
                        {filterButtons.map(({ key, label, icon: Icon, color }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                                    filter === key
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                                {Icon && <Icon className={`h-3.5 w-3.5 ${filter === key ? '' : color}`} />}
                                {label}
                                {counts[key] > 0 && (
                                    <span className={`text-xs ${filter === key ? 'opacity-70' : 'text-gray-500'}`}>
                                        {counts[key]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Memory list */}
                <div className="flex-1 overflow-y-auto p-6">
                    {filteredMemories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                            <LightBulbIcon className="h-12 w-12 mb-3 opacity-50" />
                            <p className="text-lg">No memories found</p>
                            {searchQuery && (
                                <p className="text-sm mt-1">Try a different search term</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredMemories.map((mem) => {
                                const typeInfo = getMemoryTypeInfo(mem.memory_type);
                                const TypeIcon = typeInfo.icon;
                                const isConfirmingDelete = confirmDelete === mem.memory_id;

                                return (
                                    <div
                                        key={mem.memory_id}
                                        className={`flex items-start gap-3 p-4 rounded-lg border ${
                                            mem.is_pinned
                                                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                        }`}
                                    >
                                        {/* Type icon */}
                                        <div className={`p-2 rounded-lg ${typeInfo.bg}`}>
                                            <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 dark:text-white">
                                                {mem.content}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                <span className={`px-2 py-0.5 rounded ${typeInfo.bg} ${typeInfo.color}`}>
                                                    {typeInfo.label}
                                                </span>
                                                {mem.category && (
                                                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                                                        {mem.category}
                                                    </span>
                                                )}
                                                <span>
                                                    {new Date(mem.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => onTogglePinned(mem.memory_id)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    mem.is_pinned
                                                        ? 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                                                        : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={mem.is_pinned ? 'Unpin' : 'Pin'}
                                            >
                                                {mem.is_pinned ? (
                                                    <BookmarkIcon className="h-5 w-5" />
                                                ) : (
                                                    <BookmarkOutlineIcon className="h-5 w-5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(mem.memory_id)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    isConfirmingDelete
                                                        ? 'bg-red-500 text-white'
                                                        : 'text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={isConfirmingDelete ? 'Click again to confirm' : 'Delete'}
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
