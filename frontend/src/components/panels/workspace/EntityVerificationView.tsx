/**
 * EntityVerificationView
 *
 * Displays the results of an entity verification workflow,
 * showing the iterative search/analyze/fetch/verify steps.
 */

import React, { useState } from 'react';
import {
    CheckCircleIcon,
    XCircleIcon,
    MagnifyingGlassIcon,
    GlobeAltIcon,
    CpuChipIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon
} from '@heroicons/react/24/solid';
import type { PayloadViewProps } from '../../../lib/workspace';

interface VerificationStep {
    iteration: number;
    action: 'search' | 'fetch' | 'llm_guess' | 'llm_verify';
    input: string;
    output: string;
    duration_ms: number;
}

interface Entity {
    name: string;
    url: string;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
}

interface VerificationData {
    status: 'confirmed' | 'not_found' | 'ambiguous' | 'gave_up' | 'error';
    entity: Entity | null;
    steps: VerificationStep[];
    total_duration_ms: number;
    message: string;
}

// Status badge component
const StatusBadge: React.FC<{ status: VerificationData['status'] }> = ({ status }) => {
    const config = {
        confirmed: {
            icon: CheckCircleIcon,
            color: 'text-green-600 dark:text-green-400',
            bg: 'bg-green-100 dark:bg-green-900/30',
            label: 'Verified'
        },
        not_found: {
            icon: XCircleIcon,
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-100 dark:bg-red-900/30',
            label: 'Not Found'
        },
        ambiguous: {
            icon: ExclamationTriangleIcon,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            label: 'Ambiguous'
        },
        gave_up: {
            icon: XCircleIcon,
            color: 'text-gray-600 dark:text-gray-400',
            bg: 'bg-gray-100 dark:bg-gray-800',
            label: 'Could Not Verify'
        },
        error: {
            icon: XCircleIcon,
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-100 dark:bg-red-900/30',
            label: 'Error'
        }
    }[status];

    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
            <Icon className="w-4 h-4" />
            {config.label}
        </span>
    );
};

// Confidence badge
const ConfidenceBadge: React.FC<{ confidence: Entity['confidence'] }> = ({ confidence }) => {
    const config = {
        high: {
            color: 'text-green-700 dark:text-green-300',
            bg: 'bg-green-100 dark:bg-green-900/40',
            label: 'High confidence'
        },
        medium: {
            color: 'text-amber-700 dark:text-amber-300',
            bg: 'bg-amber-100 dark:bg-amber-900/40',
            label: 'Medium confidence'
        },
        low: {
            color: 'text-red-700 dark:text-red-300',
            bg: 'bg-red-100 dark:bg-red-900/40',
            label: 'Low confidence'
        }
    }[confidence];

    return (
        <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
            {config.label}
        </span>
    );
};

// Action icon for steps
const ActionIcon: React.FC<{ action: VerificationStep['action'] }> = ({ action }) => {
    const icons = {
        search: MagnifyingGlassIcon,
        fetch: GlobeAltIcon,
        llm_guess: CpuChipIcon,
        llm_verify: CheckCircleIcon
    };
    const Icon = icons[action];
    return <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
};

// Action label
const actionLabels: Record<VerificationStep['action'], string> = {
    search: 'Search',
    fetch: 'Fetch page',
    llm_guess: 'Analyze results',
    llm_verify: 'Verify identity'
};

// Step component
const StepItem: React.FC<{ step: VerificationStep; index: number }> = ({ step, index }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-r">
            <button
                className="w-full text-left flex items-center gap-2"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? (
                    <ChevronDownIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                ) : (
                    <ChevronRightIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                )}
                <ActionIcon action={step.action} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {actionLabels[step.action]}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {step.duration_ms}ms
                </span>
            </button>

            {expanded && (
                <div className="mt-2 ml-5 space-y-1">
                    <div className="text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Input: </span>
                        <span className="text-gray-700 dark:text-gray-300 font-mono break-all">
                            {step.input.length > 100 ? step.input.slice(0, 100) + '...' : step.input}
                        </span>
                    </div>
                    <div className="text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Output: </span>
                        <span className="text-gray-700 dark:text-gray-300 font-mono break-all">
                            {step.output.length > 150 ? step.output.slice(0, 150) + '...' : step.output}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Iteration group
const IterationGroup: React.FC<{ iteration: number; steps: VerificationStep[] }> = ({ iteration, steps }) => {
    const [expanded, setExpanded] = useState(iteration === 1);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-750"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? (
                    <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                ) : (
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
                <ArrowPathIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Iteration {iteration}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {steps.length} steps
                </span>
            </button>

            {expanded && (
                <div className="p-2 space-y-1 bg-white dark:bg-gray-900">
                    {steps.map((step, idx) => (
                        <StepItem key={idx} step={step} index={idx} />
                    ))}
                </div>
            )}
        </div>
    );
};

// Main component
const EntityVerificationView: React.FC<PayloadViewProps> = ({ payload }) => {
    const data = payload.data as VerificationData;

    if (!data) {
        return (
            <div className="p-4 text-gray-500 dark:text-gray-400">
                No verification data available
            </div>
        );
    }

    // Group steps by iteration
    const stepsByIteration = data.steps.reduce((acc, step) => {
        if (!acc[step.iteration]) {
            acc[step.iteration] = [];
        }
        acc[step.iteration].push(step);
        return acc;
    }, {} as Record<number, VerificationStep[]>);

    const iterations = Object.keys(stepsByIteration).map(Number).sort((a, b) => a - b);

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Entity Verification</h3>
                <StatusBadge status={data.status} />
            </div>

            {/* Entity card (if found) */}
            {data.entity && (
                <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{data.entity.name}</h4>
                            <a
                                href={data.entity.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                            >
                                {data.entity.url}
                            </a>
                        </div>
                        <ConfidenceBadge confidence={data.entity.confidence} />
                    </div>
                    {data.entity.reason && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">
                            "{data.entity.reason}"
                        </p>
                    )}
                </div>
            )}

            {/* Not found message */}
            {!data.entity && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                    <p className="text-gray-600 dark:text-gray-300">{data.message}</p>
                </div>
            )}

            {/* Summary stats */}
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                    <ArrowPathIcon className="w-4 h-4" />
                    {iterations.length} iteration{iterations.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {(data.total_duration_ms / 1000).toFixed(1)}s total
                </span>
            </div>

            {/* Workflow steps */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Journey</h4>
                {iterations.map(iteration => (
                    <IterationGroup
                        key={iteration}
                        iteration={iteration}
                        steps={stepsByIteration[iteration]}
                    />
                ))}
            </div>
        </div>
    );
};

export default EntityVerificationView;
