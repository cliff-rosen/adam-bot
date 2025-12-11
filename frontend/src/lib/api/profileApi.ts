/**
 * Profile API client
 *
 * Handles user profile and preferences management.
 */

import { api } from './index';

export interface Profile {
    user_id: number;
    email: string;
    full_name: string | null;
    display_name: string | null;
    bio: string | null;
    preferences: Record<string, any>;
}

export interface ProfileUpdate {
    full_name?: string;
    display_name?: string;
    bio?: string;
}

export const profileApi = {
    /**
     * Get current user's profile
     */
    async get(): Promise<Profile> {
        const response = await api.get('/api/profile');
        return response.data;
    },

    /**
     * Update profile fields
     */
    async update(data: ProfileUpdate): Promise<Profile> {
        const response = await api.patch('/api/profile', data);
        return response.data;
    },

    /**
     * Get all preferences
     */
    async getPreferences(): Promise<Record<string, any>> {
        const response = await api.get('/api/profile/preferences');
        return response.data;
    },

    /**
     * Update preferences (merges with existing)
     */
    async updatePreferences(preferences: Record<string, any>): Promise<Record<string, any>> {
        const response = await api.patch('/api/profile/preferences', { preferences });
        return response.data;
    },

    /**
     * Set a single preference
     */
    async setPreference(key: string, value: any): Promise<{ key: string; value: any }> {
        const response = await api.put(`/api/profile/preferences/${key}`, value);
        return response.data;
    },

    /**
     * Get a single preference
     */
    async getPreference(key: string): Promise<{ key: string; value: any }> {
        const response = await api.get(`/api/profile/preferences/${key}`);
        return response.data;
    }
};
