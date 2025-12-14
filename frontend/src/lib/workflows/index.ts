/**
 * Workflow Engine Module
 *
 * Frontend integration for the workflow engine.
 */

// Types (re-exported from types folder)
export type {
    WorkflowSummary,
    WorkflowTemplate,
    WorkflowInstanceState,
    WorkflowEvent,
    CheckpointAction,
    CheckpointConfig,
    StepInfo,
    StepState,
    CurrentStep,
    ResumeRequest,
} from '../../types/workflow';

// API functions (re-exported from lib/api)
export {
    listWorkflows,
    getWorkflowTemplate,
    startWorkflow,
    runWorkflow,
    resumeWorkflow,
    getWorkflowState,
    cancelWorkflow,
    pauseWorkflow,
} from '../api/workflowEngineApi';

// Registry
export type {
    WorkflowDeps,
    WorkflowHandlers,
    WorkflowViewProps,
    WorkflowUIConfig,
} from './registry';

export {
    registerWorkflowUI,
    getWorkflowUI,
    createWorkflowHandlers,
    startWorkflowWithUI,
} from './registry';
