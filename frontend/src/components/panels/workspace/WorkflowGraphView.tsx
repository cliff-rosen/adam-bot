/**
 * WorkflowGraphView
 *
 * Displays a designed workflow graph from the design_workflow tool.
 * Shows nodes, edges, and allows the user to test the workflow.
 */

import { useState, useMemo } from 'react';
import {
    BeakerIcon,
    CpuChipIcon,
    PauseCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ArrowLongRightIcon,
    WrenchScrewdriverIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import {
    WorkflowNode,
    WorkflowEdge,
    WorkflowGraphData,
} from '../../../types/chat';
import { PayloadViewProps } from '../../../lib/workspace/workspaceMode';

interface WorkflowGraphViewProps extends PayloadViewProps {
    // Callback for testing the workflow with inputs
    onTest?: (workflow: WorkflowGraphData, inputs: Record<string, any>) => void;
}

// Node type styling
function getNodeStyle(nodeType: 'execute' | 'checkpoint') {
    if (nodeType === 'execute') {
        return {
            icon: CpuChipIcon,
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            border: 'border-blue-200 dark:border-blue-800',
            iconColor: 'text-blue-600 dark:text-blue-400',
            label: 'Execute',
            labelBg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        };
    }
    return {
        icon: PauseCircleIcon,
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        iconColor: 'text-amber-600 dark:text-amber-400',
        label: 'Checkpoint',
        labelBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    };
}

// Individual node component
function NodeCard({
    node,
    isExpanded,
    onToggle,
    isEntry,
}: {
    node: WorkflowNode;
    isExpanded: boolean;
    onToggle: () => void;
    isEntry: boolean;
}) {
    const style = getNodeStyle(node.node_type);
    const Icon = style.icon;

    return (
        <div
            className={`rounded-lg border-2 ${style.bg} ${style.border} ${
                isEntry ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900' : ''
            }`}
        >
            <button
                onClick={onToggle}
                className="w-full p-3 text-left flex items-start gap-3"
            >
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white">
                            {node.name}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${style.labelBg}`}>
                            {style.label}
                        </span>
                        {isEntry && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                Entry
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {node.description}
                    </p>
                </div>
                {isExpanded ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
            </button>

            {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 mt-1 pt-3 ml-8">
                    {node.node_type === 'execute' && node.step_definition && (
                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Goal:</span>
                                <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                                    {node.step_definition.goal}
                                </p>
                            </div>
                            {node.step_definition.tools && node.step_definition.tools.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Tools:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {node.step_definition.tools.map((tool) => (
                                            <span
                                                key={tool}
                                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded"
                                            >
                                                <WrenchScrewdriverIcon className="h-3 w-3" />
                                                {tool}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {node.step_definition.input_fields && node.step_definition.input_fields.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Inputs:</span>
                                    <span className="text-gray-600 dark:text-gray-400 ml-1">
                                        {node.step_definition.input_fields.join(', ')}
                                    </span>
                                </div>
                            )}
                            {node.step_definition.output_field && (
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Output:</span>
                                    <span className="text-gray-600 dark:text-gray-400 ml-1">
                                        {node.step_definition.output_field}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    {node.node_type === 'checkpoint' && node.checkpoint_config && (
                        <div className="space-y-2 text-sm">
                            <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Title:</span>
                                <span className="text-gray-600 dark:text-gray-400 ml-1">
                                    {node.checkpoint_config.title}
                                </span>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">Actions:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {node.checkpoint_config.allowed_actions.map((action) => (
                                        <span
                                            key={action}
                                            className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded capitalize"
                                        >
                                            {action}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {node.checkpoint_config.editable_fields && node.checkpoint_config.editable_fields.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Editable:</span>
                                    <span className="text-gray-600 dark:text-gray-400 ml-1">
                                        {node.checkpoint_config.editable_fields.join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Edge component
function EdgeDisplay({ edge, nodes }: { edge: WorkflowEdge; nodes: Record<string, WorkflowNode> }) {
    const fromNode = nodes[edge.from_node];
    const toNode = nodes[edge.to_node];

    return (
        <div className="flex items-center gap-2 py-1 px-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium">{fromNode?.name || edge.from_node}</span>
            <ArrowLongRightIcon className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{toNode?.name || edge.to_node}</span>
            {edge.condition_expr && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded ml-1">
                    if: {edge.condition_expr}
                </span>
            )}
            {edge.label && !edge.condition_expr && (
                <span className="text-xs text-gray-400 ml-1">({edge.label})</span>
            )}
        </div>
    );
}

export default function WorkflowGraphView({ payload, onTest }: WorkflowGraphViewProps) {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [showAllEdges, setShowAllEdges] = useState(false);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});

    const workflow = payload.workflow_graph_data;

    // Initialize input values from schema
    const inputFields = useMemo(() => {
        const schema = workflow?.input_schema;
        if (!schema?.properties) return [];
        return Object.entries(schema.properties).map(([key, prop]: [string, any]) => ({
            key,
            type: prop.type || 'string',
            description: prop.description || '',
            required: schema.required?.includes(key) ?? false,
        }));
    }, [workflow]);

    // Handle test - runs the workflow with provided inputs
    const handleTest = () => {
        if (workflow && onTest) {
            onTest(workflow, inputValues);
        }
    };

    // Check if all required inputs are filled
    const canTest = useMemo(() => {
        if (!workflow?.input_schema?.required) return true;
        return workflow.input_schema.required.every(
            (key: string) => inputValues[key]?.trim()
        );
    }, [workflow, inputValues]);

    // Validate workflow data
    if (!workflow) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400">
                <ExclamationTriangleIcon className="h-12 w-12 mb-4 opacity-50" />
                <p>No workflow data available</p>
            </div>
        );
    }

    const toggleNode = (nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    // Get ordered list of nodes based on graph traversal from entry
    const orderedNodes = useMemo(() => {
        const visited = new Set<string>();
        const order: string[] = [];
        const queue = [workflow.entry_node];

        while (queue.length > 0) {
            const nodeId = queue.shift()!;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            order.push(nodeId);

            // Find outgoing edges
            const outgoing = workflow.edges.filter((e) => e.from_node === nodeId);
            for (const edge of outgoing) {
                if (!visited.has(edge.to_node)) {
                    queue.push(edge.to_node);
                }
            }
        }

        // Add any orphaned nodes
        for (const nodeId of Object.keys(workflow.nodes)) {
            if (!visited.has(nodeId)) {
                order.push(nodeId);
            }
        }

        return order;
    }, [workflow]);

    const nodeCount = Object.keys(workflow.nodes).length;
    const executeCount = Object.values(workflow.nodes).filter((n) => n.node_type === 'execute').length;
    const checkpointCount = nodeCount - executeCount;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                {workflow.name}
                            </h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {workflow.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{nodeCount} nodes</span>
                            <span className="text-blue-600 dark:text-blue-400">{executeCount} execute</span>
                            <span className="text-amber-600 dark:text-amber-400">{checkpointCount} checkpoints</span>
                            {workflow.category && (
                                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                    {workflow.category}
                                </span>
                            )}
                        </div>
                    </div>
                    {onTest && (
                        <button
                            onClick={handleTest}
                            disabled={!canTest}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                                canTest
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <BeakerIcon className="h-4 w-4" />
                            Test
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Nodes */}
                <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Workflow Steps
                    </h3>
                    <div className="space-y-2">
                        {orderedNodes.map((nodeId) => {
                            const node = workflow.nodes[nodeId];
                            if (!node) return null;
                            return (
                                <NodeCard
                                    key={nodeId}
                                    node={node}
                                    isExpanded={expandedNodes.has(nodeId)}
                                    onToggle={() => toggleNode(nodeId)}
                                    isEntry={nodeId === workflow.entry_node}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Edges */}
                <div>
                    <button
                        onClick={() => setShowAllEdges(!showAllEdges)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                    >
                        {showAllEdges ? (
                            <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                        )}
                        Flow Connections ({workflow.edges.length})
                    </button>
                    {showAllEdges && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 space-y-1">
                            {workflow.edges.map((edge, idx) => (
                                <EdgeDisplay key={idx} edge={edge} nodes={workflow.nodes} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Test Inputs Form */}
                {inputFields.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Test Inputs
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-3">
                            {inputFields.map((field) => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {field.key}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {field.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            {field.description}
                                        </p>
                                    )}
                                    <textarea
                                        value={inputValues[field.key] || ''}
                                        onChange={(e) => setInputValues(prev => ({
                                            ...prev,
                                            [field.key]: e.target.value
                                        }))}
                                        placeholder={`Enter ${field.key}...`}
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
