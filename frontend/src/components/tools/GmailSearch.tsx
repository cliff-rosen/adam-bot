import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toolsApi, GmailMessage, GmailSearchResponse } from '../../lib/api/toolsApi';
import { oauthApi } from '../../lib/api/oauthApi';

export default function GmailSearch() {
    const [query, setQuery] = useState('');
    const [maxResults, setMaxResults] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<GmailSearchResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Check if Gmail is connected
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            const connections = await oauthApi.getConnections();
            setIsConnected(connections.google?.connected ?? false);
            setConnectedEmail(connections.google?.email ?? null);
        } catch (err) {
            console.error('Failed to check Gmail connection:', err);
            setIsConnected(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await toolsApi.searchGmail({
                query: query.trim(),
                max_results: maxResults
            });
            setResult(response);
            if (!response.success && response.error) {
                setError(response.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Gmail Search
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Test the Gmail service directly
                </p>
            </div>

            <div className="p-6">
                {/* Connection status */}
                {isConnected === false && (
                    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                        <p className="text-yellow-800 dark:text-yellow-200">
                            Gmail is not connected. Please{' '}
                            <Link to="/profile" className="underline font-medium">
                                connect your Google account
                            </Link>{' '}
                            in your profile settings to use this feature.
                        </p>
                    </div>
                )}

                {isConnected && connectedEmail && (
                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        Connected as: <span className="font-medium">{connectedEmail}</span>
                    </div>
                )}

                <form onSubmit={handleSearch} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Search Query
                        </label>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., from:john@example.com, subject:meeting, is:unread"
                            disabled={!isConnected}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Uses Gmail search syntax
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Max Results
                            </label>
                            <select
                                value={maxResults}
                                onChange={(e) => setMaxResults(Number(e.target.value))}
                                disabled={!isConnected}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading || !query.trim() || !isConnected}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </form>

                {error && (
                    <div className="mt-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-4">
                        <p className="text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                {result && result.success && (
                    <div className="mt-6">
                        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                            Found <span className="font-semibold">{result.count}</span> messages
                        </div>

                        <div className="space-y-3">
                            {result.messages.map((message) => (
                                <MessageCard key={message.id} message={message} />
                            ))}
                        </div>

                        {result.count === 0 && (
                            <p className="text-gray-500 dark:text-gray-400">
                                No messages found matching "{result.query}"
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageCard({ message }: { message: GmailMessage }) {
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                        {message.subject || '(no subject)'}
                    </h3>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        From: {message.sender}
                    </p>

                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {message.date}
                    </p>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                        {message.snippet}
                    </p>

                    {message.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {message.labels.map((label) => (
                                <span
                                    key={label}
                                    className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
