/**
 * Workflow Engine Types
 *
 * Frontend types for the workflow engine.
 */

// Workflow template summary for listing
export interface WorkflowSummary {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
}

// Checkpoint configuration
export interface CheckpointConfig {
    title: string;
    description: string;
    allowed_actions: ('approve' | 'edit' | 'reject' | 'skip')[];
    editable_fields: string[];
}

// Step definition for display
export interface StepInfo {
    id: string;
    name: string;
    description: string;
    step_type: 'execute' | 'checkpoint' | 'conditional' | 'loop';
    ui_component?: string;
    checkpoint_config?: CheckpointConfig;
}

// Full workflow template
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
    steps: StepInfo[];
}

// Workflow instance status
export type WorkflowInstanceStatus =
    | 'pending'
    | 'running'
    | 'waiting'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled';

// Step state
export interface StepState {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    execution_count: number;
    error?: string;
}

// Current step info
export interface CurrentStep {
    id: string;
    name: string;
    description: string;
    step_type: string;
    ui_component?: string;
}

// Workflow instance state
export interface WorkflowInstanceState {
    id: string;
    workflow_id: string;
    status: WorkflowInstanceStatus;
    current_step?: CurrentStep;
    step_data: Record<string, any>;
    step_states: Record<string, StepState>;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

// Engine event from SSE stream
export interface WorkflowEvent {
    event_type: 'step_start' | 'step_complete' | 'checkpoint' | 'error' | 'complete' | 'cancelled';
    instance_id: string;
    step_id?: string;
    step_name?: string;
    data?: Record<string, any>;
    error?: string;
}

// Checkpoint action
export type CheckpointAction = 'approve' | 'edit' | 'reject' | 'skip';

// Resume request
export interface ResumeRequest {
    action: CheckpointAction;
    user_data?: Record<string, any>;
}
