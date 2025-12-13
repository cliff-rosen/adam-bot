/**
 * OAuth API client
 *
 * Handles OAuth connections for third-party services.
 */

import { api } from './index';

// ============================================================================
// Types
// ============================================================================

export interface OAuthConnectionStatus {
    provider: string;
    connected: boolean;
    email?: string;
    scopes: string[];
    expires_at?: string;
}

export interface OAuthConnections {
    google?: OAuthConnectionStatus;
}

export interface GoogleAuthResponse {
    authorization_url: string;
    state: string;
}

// ============================================================================
// API
// ============================================================================

export const oauthApi = {
    /**
     * Get all OAuth connections for the current user
     */
    async getConnections(): Promise<OAuthConnections> {
        const response = await api.get('/api/oauth/connections');
        return response.data;
    },

    /**
     * Get Google OAuth authorization URL
     */
    async getGoogleAuthUrl(): Promise<GoogleAuthResponse> {
        const response = await api.get('/api/oauth/google/authorize');
        return response.data;
    },

    /**
     * Disconnect Google account
     */
    async disconnectGoogle(): Promise<{ success: boolean; message: string }> {
        const response = await api.delete('/api/oauth/google/disconnect');
        return response.data;
    }
};
