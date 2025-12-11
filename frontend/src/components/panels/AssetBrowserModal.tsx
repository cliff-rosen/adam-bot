import { useState } from 'react';
import {
    XMarkIcon, DocumentIcon, TrashIcon, PlusIcon, MinusIcon,
    MagnifyingGlassIcon, DocumentTextIcon, CodeBracketIcon,
    LinkIcon, TableCellsIcon, PhotoIcon
} from '@heroicons/react/24/solid';
import { Asset, AssetType } from '../../lib/api';

interface AssetBrowserModalProps {
    isOpen: boolean;
    assets: Asset[];
    onClose: () => void;
    onToggleContext: (assetId: number) => void;
    onDelete: (assetId: number) => void;
}

// Helper to get asset type icon
const getAssetTypeInfo = (type: AssetType) => {
    switch (type) {
        case 'document':
            return { icon: DocumentTextIcon, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Document' };
        case 'code':
            return { icon: CodeBracketIcon, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Code' };
        case 'data':
            return { icon: TableCellsIcon, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Data' };
        case 'link':
            return { icon: LinkIcon, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30', label: 'Link' };
        case 'file':
            return { icon: PhotoIcon, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'File' };
        default:
            return { icon: DocumentIcon, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-900/30', label: type };
    }
};

type FilterType = 'all' | 'in_context' | AssetType;

export default function AssetBrowserModal({
    isOpen,
    assets,
    onClose,
    onToggleContext,
    onDelete
}: AssetBrowserModalProps) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [expandedAsset, setExpandedAsset] = useState<number | null>(null);

    if (!isOpen) return null;

    // Filter assets
    const filteredAssets = assets
        .filter(a => {
            if (filter === 'all') return true;
            if (filter === 'in_context') return a.is_in_context;
            return a.asset_type === filter;
        })
        .filter(a => {
            if (!searchQuery.trim()) return true;
            return a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   a.description?.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .sort((a, b) => {
            // In context first, then by date
            if (a.is_in_context && !b.is_in_context) return -1;
            if (!a.is_in_context && b.is_in_context) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    // Count by type
    const counts: Record<string, number> = {
        all: assets.length,
        in_context: assets.filter(a => a.is_in_context).length,
        document: assets.filter(a => a.asset_type === 'document').length,
        code: assets.filter(a => a.asset_type === 'code').length,
        data: assets.filter(a => a.asset_type === 'data').length,
        link: assets.filter(a => a.asset_type === 'link').length,
        file: assets.filter(a => a.asset_type === 'file').length,
    };

    const handleDelete = (assetId: number) => {
        if (confirmDelete === assetId) {
            onDelete(assetId);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(assetId);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    const filterButtons: { key: FilterType; label: string; icon?: React.ComponentType<{ className?: string }>; color?: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'in_context', label: 'In Context', icon: PlusIcon, color: 'text-orange-500' },
        { key: 'document', label: 'Documents', icon: DocumentTextIcon, color: 'text-blue-500' },
        { key: 'code', label: 'Code', icon: CodeBracketIcon, color: 'text-green-500' },
        { key: 'data', label: 'Data', icon: TableCellsIcon, color: 'text-purple-500' },
        { key: 'link', label: 'Links', icon: LinkIcon, color: 'text-cyan-500' },
        { key: 'file', label: 'Files', icon: PhotoIcon, color: 'text-orange-500' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-[90vw] h-[85vh] max-w-5xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <DocumentIcon className="h-6 w-6 text-orange-500" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Assets
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
                            placeholder="Search assets..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Filter tabs */}
                    <div className="flex flex-wrap gap-2">
                        {filterButtons.map(({ key, label, icon: Icon, color }) => (
                            counts[key] > 0 || key === 'all' || key === 'in_context' ? (
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
                            ) : null
                        ))}
                    </div>
                </div>

                {/* Asset list */}
                <div className="flex-1 overflow-y-auto p-6">
                    {filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                            <DocumentIcon className="h-12 w-12 mb-3 opacity-50" />
                            <p className="text-lg">No assets found</p>
                            {searchQuery && (
                                <p className="text-sm mt-1">Try a different search term</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredAssets.map((asset) => {
                                const typeInfo = getAssetTypeInfo(asset.asset_type);
                                const TypeIcon = typeInfo.icon;
                                const isConfirmingDelete = confirmDelete === asset.asset_id;
                                const isExpanded = expandedAsset === asset.asset_id;

                                return (
                                    <div
                                        key={asset.asset_id}
                                        className={`rounded-lg border overflow-hidden ${
                                            asset.is_in_context
                                                ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                        }`}
                                    >
                                        {/* Asset header */}
                                        <div className="flex items-start gap-3 p-4">
                                            {/* Type icon */}
                                            <div className={`p-2 rounded-lg ${typeInfo.bg}`}>
                                                <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {asset.name}
                                                </p>
                                                {asset.description && (
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                                        {asset.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                    <span className={`px-2 py-0.5 rounded ${typeInfo.bg} ${typeInfo.color}`}>
                                                        {typeInfo.label}
                                                    </span>
                                                    {asset.is_in_context && (
                                                        <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400">
                                                            In Context
                                                        </span>
                                                    )}
                                                    <span>
                                                        {new Date(asset.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1">
                                                {asset.content && (
                                                    <button
                                                        onClick={() => setExpandedAsset(isExpanded ? null : asset.asset_id)}
                                                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                                        title={isExpanded ? 'Collapse' : 'Expand'}
                                                    >
                                                        {isExpanded ? (
                                                            <MinusIcon className="h-5 w-5" />
                                                        ) : (
                                                            <PlusIcon className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onToggleContext(asset.asset_id)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        asset.is_in_context
                                                            ? 'text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                                                            : 'text-gray-400 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                                    title={asset.is_in_context ? 'Remove from context' : 'Add to context'}
                                                >
                                                    {asset.is_in_context ? (
                                                        <XMarkIcon className="h-5 w-5" />
                                                    ) : (
                                                        <PlusIcon className="h-5 w-5" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(asset.asset_id)}
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

                                        {/* Expanded content */}
                                        {isExpanded && asset.content && (
                                            <div className="px-4 pb-4">
                                                <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                                                    {asset.content}
                                                </pre>
                                            </div>
                                        )}
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
