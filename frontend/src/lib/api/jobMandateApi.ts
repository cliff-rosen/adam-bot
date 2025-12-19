import settings from '../../config/settings';
import { makeStreamRequest } from './streamUtils';

// ============================================================================
// Types
// ============================================================================

export type MandateSectionType = 'energizes' | 'strengths' | 'must_haves' | 'deal_breakers';
export type MandateStatus = 'in_progress' | 'completed' | 'archived';
export type SectionStatus = 'not_started' | 'in_progress' | 'completed';

export interface MandateItem {
    id: number;
    content: string;
    category?: string;
    source: 'extracted' | 'user_added' | 'user_edited';
}

export interface MandateSection {
    status: SectionStatus;
    items: MandateItem[];
}

export interface MandateSections {
    energizes: MandateSection;
    strengths: MandateSection;
    must_haves: MandateSection;
    deal_breakers: MandateSection;
}

export interface JobMandate {
    id: number;
    user_id: number;
    status: MandateStatus;
    current_section: MandateSectionType | null;
    conversation_id?: number;
    sections: MandateSections;
    summary?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

export interface InterviewState {
    current_section: MandateSectionType;
    sections: MandateSections;
}

export interface StartInterviewResponse {
    mandate_id: number;
    conversation_id?: number;
    is_new: boolean;
    opening_message: string;
    interview_state: InterviewState;
}

export interface MandateListItem {
    id: number;
    status: MandateStatus;
    current_section?: MandateSectionType;
    item_count: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

// ============================================================================
// Stream Event Types
// ============================================================================

export interface TextDeltaEvent {
    type: 'text_delta';
    text: string;
}

export interface StatusEvent {
    type: 'status';
    message: string;
}

export interface MandateUpdateEvent {
    type: 'mandate_update';
    mandate: {
        id: number;
        status: MandateStatus;
        current_section: MandateSectionType;
        sections: MandateSections;
    };
    new_items: MandateItem[];
    section_completed?: MandateSectionType;
}

export interface CompleteEvent {
    type: 'complete';
    payload: {
        message: string;
        conversation_id?: number;
        custom_payload?: {
            type: string;
            mandate_id: number;
            is_complete: boolean;
            current_section?: MandateSectionType;
            action: 'extract' | 'clarify';
            insights_added: number;
            section_advanced: boolean;
        };
    };
}

export interface ErrorEvent {
    type: 'error';
    message: string;
}

export type InterviewStreamEvent =
    | TextDeltaEvent
    | StatusEvent
    | MandateUpdateEvent
    | CompleteEvent
    | ErrorEvent;

// ============================================================================
// API Functions
// ============================================================================

const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const jobMandateApi = {
    /**
     * Start a new interview or resume an existing one
     */
    async startInterview(mandateId?: number): Promise<StartInterviewResponse> {
        const url = new URL(`${settings.apiUrl}/api/job-mandate/start`);
        if (mandateId) {
            url.searchParams.set('mandate_id', mandateId.toString());
        }

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to start interview: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Stream interview chat messages
     */
    async* streamMessage(
        mandateId: number,
        message: string,
        conversationId?: number,
        signal?: AbortSignal
    ): AsyncGenerator<InterviewStreamEvent> {
        try {
            const rawStream = makeStreamRequest(
                `/api/job-mandate/${mandateId}/chat/stream`,
                {
                    message,
                    conversation_id: conversationId
                },
                'POST',
                signal
            );

            let buffer = '';

            for await (const update of rawStream) {
                buffer += update.data;

                let newlineIndex: number;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);

                    if (!line.trim() || !line.startsWith('data: ')) {
                        continue;
                    }

                    const jsonStr = line.slice(6);
                    if (jsonStr === '' || jsonStr === 'ping') {
                        continue;
                    }

                    try {
                        const data = JSON.parse(jsonStr) as InterviewStreamEvent;
                        if (data.type !== 'text_delta') {
                            console.log('[Interview SSE] Event:', data.type);
                        }
                        yield data;
                    } catch (e) {
                        buffer = line + '\n' + buffer;
                        break;
                    }
                }
            }

            if (buffer.trim() && buffer.startsWith('data: ')) {
                const jsonStr = buffer.slice(6);
                try {
                    const data = JSON.parse(jsonStr) as InterviewStreamEvent;
                    yield data;
                } catch (e) {
                    console.error('Failed to parse final stream data:', e);
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw error;
            }
            yield {
                type: 'error',
                message: `Stream error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    },

    /**
     * Get all mandates for the current user
     */
    async listMandates(): Promise<MandateListItem[]> {
        const response = await fetch(`${settings.apiUrl}/api/job-mandate/list`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to list mandates: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Get a specific mandate with all items
     */
    async getMandate(mandateId: number): Promise<JobMandate> {
        const response = await fetch(`${settings.apiUrl}/api/job-mandate/${mandateId}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to get mandate: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Add an item manually to a section
     */
    async addItem(
        mandateId: number,
        section: MandateSectionType,
        content: string,
        category?: string
    ): Promise<MandateItem> {
        const response = await fetch(`${settings.apiUrl}/api/job-mandate/${mandateId}/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ section, content, category })
        });

        if (!response.ok) {
            throw new Error(`Failed to add item: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Update an existing item
     */
    async updateItem(
        mandateId: number,
        itemId: number,
        content: string,
        category?: string
    ): Promise<MandateItem> {
        const response = await fetch(
            `${settings.apiUrl}/api/job-mandate/${mandateId}/items/${itemId}`,
            {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ content, category })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update item: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Delete an item
     */
    async deleteItem(mandateId: number, itemId: number): Promise<void> {
        const response = await fetch(
            `${settings.apiUrl}/api/job-mandate/${mandateId}/items/${itemId}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to delete item: ${response.statusText}`);
        }
    },

    /**
     * Manually advance to the next section
     */
    async advanceSection(mandateId: number, currentSection: MandateSectionType): Promise<{
        mandate_id: number;
        previous_section: MandateSectionType;
        current_section?: MandateSectionType;
        status: MandateStatus;
    }> {
        const response = await fetch(
            `${settings.apiUrl}/api/job-mandate/${mandateId}/sections/${currentSection}/advance`,
            {
                method: 'POST',
                headers: getAuthHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to advance section: ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Archive a mandate
     */
    async archiveMandate(mandateId: number): Promise<void> {
        const response = await fetch(`${settings.apiUrl}/api/job-mandate/${mandateId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`Failed to archive mandate: ${response.statusText}`);
        }
    }
};
