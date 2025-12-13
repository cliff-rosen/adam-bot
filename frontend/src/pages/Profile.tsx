import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { oauthApi, OAuthConnections } from '../lib/api';

export default function Profile() {
    const { user } = useAuth();
    const { userProfile, isLoading, error, updateProfile, clearError } = useProfile();
    const [searchParams, setSearchParams] = useSearchParams();

    // Form state
    const [userForm, setUserForm] = useState({
        display_name: '',
        bio: ''
    });

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // OAuth state
    const [oauthConnections, setOauthConnections] = useState<OAuthConnections | null>(null);
    const [oauthLoading, setOauthLoading] = useState(true);
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [connectingGoogle, setConnectingGoogle] = useState(false);

    // Sync form with profile data when it loads
    useEffect(() => {
        if (userProfile) {
            setUserForm({
                display_name: userProfile.display_name || '',
                bio: userProfile.bio || ''
            });
        }
    }, [userProfile]);

    // Load OAuth connections
    useEffect(() => {
        loadOAuthConnections();
    }, []);

    // Handle OAuth callback redirect
    useEffect(() => {
        const oauth = searchParams.get('oauth');
        const provider = searchParams.get('provider');

        if (oauth === 'success' && provider === 'google') {
            // Refresh connections after successful OAuth
            loadOAuthConnections();
            // Clear the URL params
            setSearchParams({});
        } else if (oauth === 'error') {
            setOauthError(searchParams.get('message') || 'OAuth connection failed');
            setSearchParams({});
        }
    }, [searchParams, setSearchParams]);

    const loadOAuthConnections = async () => {
        try {
            setOauthLoading(true);
            const connections = await oauthApi.getConnections();
            setOauthConnections(connections);
        } catch (err) {
            console.error('Failed to load OAuth connections:', err);
        } finally {
            setOauthLoading(false);
        }
    };

    const handleConnectGoogle = async () => {
        try {
            setConnectingGoogle(true);
            setOauthError(null);
            const { authorization_url } = await oauthApi.getGoogleAuthUrl();
            // Redirect to Google OAuth
            window.location.href = authorization_url;
        } catch (err) {
            setOauthError('Failed to initiate Google connection');
            setConnectingGoogle(false);
        }
    };

    const handleDisconnectGoogle = async () => {
        if (!confirm('Are you sure you want to disconnect your Google account? This will disable Gmail integration.')) {
            return;
        }

        try {
            setOauthLoading(true);
            await oauthApi.disconnectGoogle();
            await loadOAuthConnections();
        } catch (err) {
            setOauthError('Failed to disconnect Google account');
        } finally {
            setOauthLoading(false);
        }
    };

    const handleUserFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveStatus('saving');

        try {
            await updateProfile({
                display_name: userForm.display_name || undefined,
                bio: userForm.bio || undefined
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Profile
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Manage your account settings and connected services
                </p>
            </div>

            {/* User Profile Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                        User Profile
                    </h2>

                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-4">
                            <p className="text-red-800 dark:text-red-200">{error}</p>
                            <button
                                onClick={clearError}
                                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {saveStatus === 'saved' && (
                        <div className="mb-4 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded-lg p-4">
                            <p className="text-green-800 dark:text-green-200">Profile saved successfully!</p>
                        </div>
                    )}

                    {saveStatus === 'error' && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-4">
                            <p className="text-red-800 dark:text-red-200">Failed to save profile. Please try again.</p>
                        </div>
                    )}

                    <form onSubmit={handleUserFormSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Email cannot be changed after registration
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Display Name
                            </label>
                            <input
                                type="text"
                                placeholder="How you want to be addressed"
                                value={userForm.display_name}
                                onChange={(e) => setUserForm({ ...userForm, display_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Bio
                            </label>
                            <textarea
                                placeholder="Tell us a bit about yourself..."
                                rows={3}
                                value={userForm.bio}
                                onChange={(e) => setUserForm({ ...userForm, bio: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isLoading || saveStatus === 'saving'}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {saveStatus === 'saving' ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Connected Accounts Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Connected Accounts
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Connect third-party services to enable additional features
                    </p>

                    {oauthError && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-4">
                            <p className="text-red-800 dark:text-red-200">{oauthError}</p>
                            <button
                                onClick={() => setOauthError(null)}
                                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Google / Gmail */}
                        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm">
                                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900 dark:text-white">Google</h3>
                                    {oauthLoading ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                                    ) : oauthConnections?.google?.connected ? (
                                        <p className="text-sm text-green-600 dark:text-green-400">
                                            Connected as {oauthConnections.google.email}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Connect to enable Gmail features
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                {oauthLoading ? (
                                    <span className="text-sm text-gray-400">...</span>
                                ) : oauthConnections?.google?.connected ? (
                                    <button
                                        onClick={handleDisconnectGoogle}
                                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        Disconnect
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleConnectGoogle}
                                        disabled={connectingGoogle}
                                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {connectingGoogle ? 'Connecting...' : 'Connect'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
