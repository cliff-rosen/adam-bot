/**
 * Asset API client
 *
 * Handles CRUD operations for user assets.
 */

import { api } from './index';

export type AssetType = 'file' | 'document' | 'data' | 'code' | 'link' | 'list';

export interface Asset {
    asset_id: number;
    user_id: number;
    name: string;
    asset_type: AssetType;
    mime_type: string | null;
    content: string | null;
    external_url: string | null;
    description: string | null;
    tags: string[];
    is_in_context: boolean;
    context_summary: string | null;
    source_conversation_id: number | null;
    created_at: string;
    updated_at: string;
}

export interface AssetCreate {
    name: string;
    asset_type: AssetType;
    content?: string;
    external_url?: string;
    mime_type?: string;
    description?: string;
    tags?: string[];
    context_summary?: string;
    source_conversation_id?: number;
}

export interface AssetUpdate {
    name?: string;
    content?: string;
    description?: string;
    tags?: string[];
    context_summary?: string;
}

export const assetApi = {
    /**
     * List user's assets
     */
    async list(
        assetType?: AssetType,
        inContextOnly = false,
        limit = 100,
        offset = 0
    ): Promise<Asset[]> {
        const params = new URLSearchParams({
            in_context_only: inContextOnly.toString(),
            limit: limit.toString(),
            offset: offset.toString(),
        });

        if (assetType) params.set('asset_type', assetType);

        const response = await api.get(`/api/assets?${params}`);
        return response.data;
    },

    /**
     * Create a new asset
     */
    async create(asset: AssetCreate): Promise<Asset> {
        const response = await api.post('/api/assets', asset);
        return response.data;
    },

    /**
     * Get a specific asset
     */
    async get(assetId: number): Promise<Asset> {
        const response = await api.get(`/api/assets/${assetId}`);
        return response.data;
    },

    /**
     * Update an asset
     */
    async update(assetId: number, updates: AssetUpdate): Promise<Asset> {
        const response = await api.put(`/api/assets/${assetId}`, updates);
        return response.data;
    },

    /**
     * Delete an asset
     */
    async delete(assetId: number): Promise<void> {
        await api.delete(`/api/assets/${assetId}`);
    },

    /**
     * Toggle asset in-context status
     */
    async toggleContext(assetId: number): Promise<{ asset_id: number; is_in_context: boolean }> {
        const response = await api.post(`/api/assets/${assetId}/context`);
        return response.data;
    },

    /**
     * Clear all assets from context
     */
    async clearContext(): Promise<{ status: string; count: number }> {
        const response = await api.delete('/api/assets/context/clear');
        return response.data;
    },
};
