/**
 * Workflow Engine Types (Graph-Based)
 *
 * Frontend types for the graph-based workflow engine.
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

// Node definition for display
export interface NodeInfo {
    id: string;
    name: string;
    description: string;
    node_type: 'execute' | 'checkpoint';
    ui_component?: string;
    checkpoint_config?: CheckpointConfig;
}

// Edge definition
export interface EdgeInfo {
    from_node: string;
    to_node: string;
    label?: string;
    has_condition: boolean;
}

// Full workflow template (graph-based)
export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
    entry_node: string;
    nodes: Record<string, NodeInfo>;
    edges: EdgeInfo[];
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

// Node state
export interface NodeState {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    execution_count: number;
    error?: string;
}

// Current node info
export interface CurrentNode {
    id: string;
    name: string;
    description: string;
    node_type: string;
    ui_component?: string;
}

// Workflow instance state
export interface WorkflowInstanceState {
    id: string;
    workflow_id: string;
    status: WorkflowInstanceStatus;
    current_node?: CurrentNode;
    step_data: Record<string, any>;  // Keep as step_data for backwards compat with step functions
    node_states: Record<string, NodeState>;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

// Engine event from SSE stream
export interface WorkflowEvent {
    event_type: 'step_start' | 'step_complete' | 'checkpoint' | 'error' | 'complete' | 'cancelled';
    instance_id: string;
    node_id?: string;
    node_name?: string;
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

// =============================================================================
// Backwards Compatibility Aliases
// =============================================================================

// These allow gradual migration of components
export type StepInfo = NodeInfo;
export type StepState = NodeState;
export type CurrentStep = CurrentNode;
