/**
 * Conversation API client
 *
 * Handles CRUD operations for conversations and message retrieval.
 */

import { api } from './index';

export interface Message {
    message_id: number;
    conversation_id: number;
    role: 'user' | 'assistant';
    content: string;
    tool_calls?: any[];
    suggested_values?: any[];
    suggested_actions?: any[];
    custom_payload?: any;
    created_at: string;
}

export interface Conversation {
    conversation_id: number;
    user_id: number;
    title: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
    message_count?: number;
}

export interface ConversationWithMessages extends Conversation {
    messages: Message[];
}

export const conversationApi = {
    /**
     * List user's conversations
     */
    async list(limit = 20, offset = 0, includeArchived = false): Promise<Conversation[]> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            include_archived: includeArchived.toString(),
        });

        const response = await api.get(`/api/conversations?${params}`);
        return response.data;
    },

    /**
     * Create a new conversation
     */
    async create(title?: string): Promise<Conversation> {
        const response = await api.post('/api/conversations', { title });
        return response.data;
    },

    /**
     * Get a specific conversation with messages
     */
    async get(conversationId: number): Promise<ConversationWithMessages> {
        const response = await api.get(`/api/conversations/${conversationId}`);
        return response.data;
    },

    /**
     * Update a conversation (title, archive status)
     */
    async update(
        conversationId: number,
        updates: { title?: string; is_archived?: boolean }
    ): Promise<Conversation> {
        const response = await api.put(`/api/conversations/${conversationId}`, updates);
        return response.data;
    },

    /**
     * Delete a conversation
     */
    async delete(conversationId: number): Promise<void> {
        await api.delete(`/api/conversations/${conversationId}`);
    },

    /**
     * Get messages for a conversation
     */
    async getMessages(conversationId: number, limit = 100, offset = 0): Promise<Message[]> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });

        const response = await api.get(`/api/conversations/${conversationId}/messages?${params}`);
        return response.data;
    },
};
