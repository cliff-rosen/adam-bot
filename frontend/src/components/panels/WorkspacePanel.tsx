import { WrenchScrewdriverIcon, XMarkIcon, ArchiveBoxArrowDownIcon } from '@heroicons/react/24/solid';
import { JsonRenderer } from '../common';
import { ToolCall } from '../../types/chat';

interface WorkspacePanelProps {
    selectedToolHistory: ToolCall[] | null;
    onClose: () => void;
    onSaveAsAsset: (toolCall: ToolCall) => void;
}

export default function WorkspacePanel({
    selectedToolHistory,
    onClose,
    onSaveAsAsset
}: WorkspacePanelProps) {
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
            {/* Workspace Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedToolHistory ? 'Tool History' : 'Workspace'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedToolHistory ? `${selectedToolHistory.length} tool call(s)` : 'Collaborative space'}
                    </p>
                </div>
                {selectedToolHistory && (
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Workspace Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {selectedToolHistory ? (
                    <div className="space-y-4">
                        {selectedToolHistory.map((toolCall, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center gap-2">
                                        <WrenchScrewdriverIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {toolCall.tool_name}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Input</h4>
                                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-sm">
                                            <JsonRenderer data={toolCall.input} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Output</h4>
                                            <button
                                                onClick={() => onSaveAsAsset(toolCall)}
                                                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                title="Save output as asset"
                                            >
                                                <ArchiveBoxArrowDownIcon className="h-3 w-3" />
                                                Save as Asset
                                            </button>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-sm max-h-64 overflow-y-auto">
                                            {typeof toolCall.output === 'string' ? (
                                                <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{toolCall.output}</pre>
                                            ) : (
                                                <JsonRenderer data={toolCall.output} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-gray-400 dark:text-gray-500">
                            <div className="text-6xl mb-4">Workspace</div>
                            <h3 className="text-xl font-medium mb-2">Content TBD</h3>
                            <p className="text-sm max-w-md">
                                This collaborative workspace will display assets, documents,
                                and other content generated during your conversations with the agent.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
