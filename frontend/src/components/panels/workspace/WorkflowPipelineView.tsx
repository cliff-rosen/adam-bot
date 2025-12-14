/**
 * WorkflowPipelineView - Visual pipeline for workflow execution
 *
 * Displays the entire workflow as a horizontal pipeline with:
 * - Visual step nodes showing status (pending/running/complete)
 * - Connectors between steps showing data flow
 * - Detail panel below showing current step info/output
 * - All actions happen within this view - no panel jumping
 */

import { useState, useEffect } from 'react';
import {
    CheckIcon,
    PlayIcon,
    ClockIcon,
    ArrowRightIcon,
    PencilIcon,
    XMarkIcon,
    UserIcon
} from '@heroicons/react/24/solid';
import { MarkdownRenderer } from '../../common';
import { WorkflowPlan, WorkflowStep, WorkspacePayload } from '../../../types/chat';
import { ToolCallRecord, ToolProgressUpdate } from '../../../lib/api';
import IteratorProgress from './IteratorProgress';
import MapReduceProgress from './MapReduceProgress';
import ToolProgress from './ToolProgress';

interface WorkflowPipelineViewProps {
    // For proposed plans (not yet accepted)
    proposedPlan?: WorkspacePayload;
    onAcceptPlan?: (payload: WorkspacePayload) => void;
    onRejectPlan?: () => void;

    // For active workflows
    workflow?: WorkflowPlan | null;
    executingStep?: WorkflowStep | null;
    stepStatus?: string;
    stepToolCalls?: ToolCallRecord[];
    currentToolName?: string | null;
    currentToolProgress?: ToolProgressUpdate[];

    // Step output for review
    stepOutput?: WorkspacePayload | null;
    onAcceptStep?: (payload: WorkspacePayload) => void;
    onEditStep?: (payload: WorkspacePayload) => void;
    onRejectStep?: () => void;
    onPayloadEdit?: (payload: WorkspacePayload) => void;

    // Final workflow completion
    onAcceptFinal?: (payload: WorkspacePayload) => void;
    onDismissFinal?: () => void;

    // Abandon workflow
    onAbandon?: () => void;
}

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export default function WorkflowPipelineView({
    proposedPlan,
    onAcceptPlan,
    onRejectPlan,
    workflow,
    executingStep,
    stepStatus = '',
    stepToolCalls = [],
    currentToolName,
    currentToolProgress = [],
    stepOutput,
    onAcceptStep,
    onEditStep,
    onRejectStep,
    onPayloadEdit,
    onAcceptFinal,
    onDismissFinal,
    onAbandon
}: WorkflowPipelineViewProps) {
    const [selectedStepNumber, setSelectedStepNumber] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');

    // Determine what mode we're in
    const isProposed = !!proposedPlan && !workflow;
    const isActive = !!workflow && workflow.status === 'active';
    const isCompleted = !!workflow && workflow.status === 'completed';
    const isFinal = stepOutput?.type === 'final';

    // Get steps from either proposed plan or active workflow
    const steps = isProposed
        ? proposedPlan?.steps?.map((s, idx) => ({
            step_number: idx + 1,
            description: s.description,
            input_description: s.input_description,
            input_sources: s.input_sources || [(s as any).input_source || 'user'],
            output_description: s.output_description,
            method: s.method,
            status: 'pending' as StepStatus,
            wip_output: undefined
        }))
        : workflow?.steps;

    const title = isProposed ? proposedPlan?.title : workflow?.title;
    const goal = isProposed ? proposedPlan?.goal : workflow?.goal;
    const initialInput = isProposed ? proposedPlan?.initial_input : workflow?.initial_input;

    // Auto-select the executing step or step with output to review
    useEffect(() => {
        if (executingStep) {
            setSelectedStepNumber(executingStep.step_number);
        } else if (stepOutput?.step_number) {
            setSelectedStepNumber(stepOutput.step_number);
        }
    }, [executingStep, stepOutput]);

    // Reset editing state when step output changes
    useEffect(() => {
        setIsEditing(false);
        if (stepOutput) {
            setEditContent(stepOutput.content);
        }
    }, [stepOutput]);

    const getStepStatus = (step: WorkflowStep): StepStatus => {
        if (executingStep?.step_number === step.step_number) {
            return 'in_progress';
        }
        return step.status;
    };

    const getStatusIcon = (status: StepStatus) => {
        switch (status) {
            case 'completed':
                return <CheckIcon className="h-4 w-4 text-white" />;
            case 'in_progress':
                return (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                );
            default:
                return <ClockIcon className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStatusStyles = (status: StepStatus, isSelected: boolean) => {
        const base = 'transition-all duration-200';
        const selected = isSelected ? 'ring-2 ring-offset-2 ring-indigo-500' : '';

        switch (status) {
            case 'completed':
                return `${base} ${selected} bg-green-500 text-white border-green-500`;
            case 'in_progress':
                return `${base} ${selected} bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/30`;
            default:
                return `${base} ${selected} bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600`;
        }
    };

    const selectedStep = steps?.find(s => s.step_number === selectedStepNumber);
    const isReviewingOutput = stepOutput && stepOutput.step_number === selectedStepNumber && !executingStep;

    const handleStartEdit = () => {
        if (stepOutput) {
            setEditContent(stepOutput.content);
            setIsEditing(true);
        }
    };

    const handleSaveEdit = () => {
        if (stepOutput && editContent !== stepOutput.content && onPayloadEdit) {
            onPayloadEdit({ ...stepOutput, content: editContent });
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        if (stepOutput) {
            setEditContent(stepOutput.content);
        }
        setIsEditing(false);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                        {goal && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                {goal}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isProposed && (
                            <>
                                <button
                                    onClick={onRejectPlan}
                                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => proposedPlan && onAcceptPlan?.(proposedPlan)}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <PlayIcon className="h-4 w-4" />
                                    Start Workflow
                                </button>
                            </>
                        )}
                        {(isActive || isCompleted) && onAbandon && !isFinal && (
                            <button
                                onClick={onAbandon}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                                title="Abandon workflow"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Pipeline visualization */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-max">
                    {/* User input node */}
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center border-2 border-blue-500">
                            <UserIcon className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-[60px] text-center truncate">
                            Input
                        </span>
                    </div>

                    {/* Connector */}
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />

                    {/* Step nodes */}
                    {steps?.map((step, idx) => {
                        const status = getStepStatus(step as WorkflowStep);
                        const isSelected = selectedStepNumber === step.step_number;

                        return (
                            <div key={step.step_number} className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedStepNumber(step.step_number)}
                                    className="flex flex-col items-center group"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 cursor-pointer ${getStatusStyles(status, isSelected)}`}>
                                        {getStatusIcon(status)}
                                    </div>
                                    <span className={`text-xs mt-1.5 max-w-[80px] text-center truncate transition-colors ${
                                        isSelected
                                            ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                                    }`}>
                                        {step.description.length > 20
                                            ? step.description.slice(0, 20) + '...'
                                            : step.description}
                                    </span>
                                </button>

                                {/* Connector to next step */}
                                {idx < (steps?.length || 0) - 1 && (
                                    <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detail panel */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Initial input display (when nothing selected or for context) */}
                {initialInput && !selectedStep && !isFinal && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1">
                            Initial Input
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{initialInput}</p>
                    </div>
                )}

                {/* Final output view */}
                {isFinal && stepOutput && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                Workflow Complete
                            </h3>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {stepOutput.steps_completed} steps completed
                            </span>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                {stepOutput.title}
                            </h4>
                            {stepOutput.content_type === 'code' ? (
                                <pre className="p-3 bg-gray-900 dark:bg-black rounded-lg text-sm text-gray-100 overflow-x-auto whitespace-pre-wrap">
                                    {stepOutput.content}
                                </pre>
                            ) : stepOutput.content_type === 'data' ? (
                                <pre className="p-3 bg-white dark:bg-gray-900 rounded border text-sm overflow-x-auto whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                    {stepOutput.content}
                                </pre>
                            ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <MarkdownRenderer content={stepOutput.content} />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onDismissFinal}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={() => stepOutput && onAcceptFinal?.(stepOutput)}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                                Save as Asset
                            </button>
                        </div>
                    </div>
                )}

                {/* Selected step detail */}
                {selectedStep && !isFinal && (
                    <div className="space-y-4">
                        {/* Step header */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-medium text-gray-900 dark:text-white">
                                Step {selectedStep.step_number}: {selectedStep.description}
                            </h3>
                            {isReviewingOutput && !isEditing && (
                                <button
                                    onClick={handleStartEdit}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                >
                                    <PencilIcon className="h-3 w-3" />
                                    Edit
                                </button>
                            )}
                        </div>

                        {/* Step metadata (when not executing) */}
                        {!executingStep && !isReviewingOutput && (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Input</span>
                                    <p className="text-gray-700 dark:text-gray-300 mt-0.5">
                                        {selectedStep.input_description}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        From: {(selectedStep.input_sources || []).map(s =>
                                            s === 'user' ? 'User input' : `Step ${s}`
                                        ).join(', ')}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Output</span>
                                    <p className="text-gray-700 dark:text-gray-300 mt-0.5">
                                        {selectedStep.output_description}
                                    </p>
                                </div>
                                {selectedStep.method.tools.length > 0 && (
                                    <div className="col-span-2">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tools</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedStep.method.tools.map((tool, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                                                    {tool}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Completed step output preview */}
                        {selectedStep.status === 'completed' && selectedStep.wip_output && !isReviewingOutput && (
                            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase mb-2">
                                    Completed Output
                                </h4>
                                <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4">
                                    {selectedStep.wip_output.content.slice(0, 300)}
                                    {selectedStep.wip_output.content.length > 300 && '...'}
                                </div>
                            </div>
                        )}

                        {/* Executing step view */}
                        {executingStep?.step_number === selectedStep.step_number && (
                            <div className="space-y-4">
                                {/* Status message */}
                                <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                    <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
                                    <span className="text-sm text-indigo-700 dark:text-indigo-300">
                                        {stepStatus || 'Starting...'}
                                    </span>
                                </div>

                                {/* Tool activity */}
                                {(stepToolCalls.length > 0 || currentToolName) && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                            Tool Activity
                                        </h4>

                                        {/* Completed tool calls */}
                                        {stepToolCalls.map((tc, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <CheckIcon className="h-4 w-4 text-green-500" />
                                                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                                                        {tc.tool_name}
                                                    </span>
                                                </div>
                                                {tc.output && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {tc.output.slice(0, 150)}...
                                                    </p>
                                                )}
                                            </div>
                                        ))}

                                        {/* Currently running tool */}
                                        {currentToolName && (
                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                                    <span className="font-medium text-sm text-indigo-700 dark:text-indigo-300">
                                                        {currentToolName}
                                                    </span>
                                                </div>

                                                {/* Tool-specific progress */}
                                                {currentToolName === 'iterate' && currentToolProgress.length > 0 ? (
                                                    <IteratorProgress progressUpdates={currentToolProgress} />
                                                ) : currentToolName === 'map_reduce' && currentToolProgress.length > 0 ? (
                                                    <MapReduceProgress progressUpdates={currentToolProgress} />
                                                ) : currentToolProgress.length > 0 ? (
                                                    <ToolProgress progressUpdates={currentToolProgress} />
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step output review */}
                        {isReviewingOutput && stepOutput && (
                            <div className="space-y-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full h-64 p-3 text-sm font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveEdit}
                                                className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                                            >
                                                Save Changes
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                        {stepOutput.content_type === 'code' ? (
                                            <pre className="p-3 bg-gray-900 dark:bg-black rounded-lg text-sm text-gray-100 overflow-x-auto whitespace-pre-wrap">
                                                {stepOutput.content}
                                            </pre>
                                        ) : stepOutput.content_type === 'data' ? (
                                            <pre className="p-3 bg-white dark:bg-gray-900 rounded border text-sm overflow-x-auto whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                                {stepOutput.content}
                                            </pre>
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <MarkdownRenderer content={stepOutput.content} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action buttons */}
                                {!isEditing && (
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={onRejectStep}
                                            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            Redo Step
                                        </button>
                                        <button
                                            onClick={() => stepOutput && onEditStep?.(stepOutput)}
                                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                        >
                                            Request Changes
                                        </button>
                                        <button
                                            onClick={() => stepOutput && onAcceptStep?.(stepOutput)}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            Accept & Continue
                                            <ArrowRightIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state for proposed plan */}
                {isProposed && !selectedStep && (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <p className="text-sm">Click on a step to see its details</p>
                        <p className="text-xs mt-1">Or click "Start Workflow" to begin execution</p>
                    </div>
                )}
            </div>
        </div>
    );
}
