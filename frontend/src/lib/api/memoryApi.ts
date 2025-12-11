/**
 * Memory API client
 *
 * Handles CRUD operations for user memories.
 */

import { api } from './index';

export type MemoryType = 'working' | 'fact' | 'preference' | 'entity' | 'project';

export interface Memory {
    memory_id: number;
    user_id: number;
    memory_type: MemoryType;
    category: string | null;
    content: string;
    source_conversation_id: number | null;
    created_at: string;
    expires_at: string | null;
    is_active: boolean;
    is_pinned: boolean;
    confidence: number;
}

export interface MemoryCreate {
    content: string;
    memory_type: MemoryType;
    category?: string;
    is_pinned?: boolean;
    source_conversation_id?: number;
}

export interface MemoryUpdate {
    content?: string;
    category?: string;
    is_active?: boolean;
    is_pinned?: boolean;
}

export const memoryApi = {
    /**
     * List user's memories
     */
    async list(
        memoryType?: MemoryType,
        category?: string,
        activeOnly = true,
        limit = 100,
        offset = 0
    ): Promise<Memory[]> {
        const params = new URLSearchParams({
            active_only: activeOnly.toString(),
            limit: limit.toString(),
            offset: offset.toString(),
        });

        if (memoryType) params.set('memory_type', memoryType);
        if (category) params.set('category', category);

        const response = await api.get(`/api/memories?${params}`);
        return response.data;
    },

    /**
     * Create a new memory
     */
    async create(memory: MemoryCreate): Promise<Memory> {
        const response = await api.post('/api/memories', memory);
        return response.data;
    },

    /**
     * Get a specific memory
     */
    async get(memoryId: number): Promise<Memory> {
        const response = await api.get(`/api/memories/${memoryId}`);
        return response.data;
    },

    /**
     * Update a memory
     */
    async update(memoryId: number, updates: MemoryUpdate): Promise<Memory> {
        const response = await api.put(`/api/memories/${memoryId}`, updates);
        return response.data;
    },

    /**
     * Delete a memory
     */
    async delete(memoryId: number): Promise<void> {
        await api.delete(`/api/memories/${memoryId}`);
    },

    /**
     * Toggle memory active status
     */
    async toggleActive(memoryId: number): Promise<{ memory_id: number; is_active: boolean }> {
        const response = await api.post(`/api/memories/${memoryId}/toggle`);
        return response.data;
    },

    /**
     * Toggle memory pinned status
     */
    async togglePinned(memoryId: number): Promise<{ memory_id: number; is_pinned: boolean }> {
        const response = await api.post(`/api/memories/${memoryId}/pin`);
        return response.data;
    },

    /**
     * Clear all working memories
     */
    async clearWorkingMemory(): Promise<{ status: string; count: number }> {
        const response = await api.delete('/api/memories/working/clear');
        return response.data;
    },
};
