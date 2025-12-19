import { useState, useRef, useEffect, useCallback } from 'react';
import {
    jobMandateApi,
    MandateSectionType,
    MandateSections,
    MandateItem,
    SectionStatus,
    InterviewStreamEvent
} from '../lib/api/jobMandateApi';

interface Message {
    id: string;
    role: 'interviewer' | 'user';
    content: string;
}

interface SectionState {
    id: MandateSectionType;
    title: string;
    status: SectionStatus;
    items: MandateItem[];
    isExpanded: boolean;
}

const SECTION_TITLES: Record<MandateSectionType, string> = {
    energizes: 'What Energizes You',
    strengths: 'Your Strengths',
    must_haves: 'Must-Haves',
    deal_breakers: 'Deal-Breakers'
};

const SECTION_ORDER: MandateSectionType[] = ['energizes', 'strengths', 'must_haves', 'deal_breakers'];

export default function JobMandateInterview() {
    const [mandateId, setMandateId] = useState<number | null>(null);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sections, setSections] = useState<SectionState[]>(
        SECTION_ORDER.map((id, index) => ({
            id,
            title: SECTION_TITLES[id],
            status: index === 0 ? 'in_progress' : 'not_started',
            items: [],
            isExpanded: index === 0
        }))
    );
    const [isComplete, setIsComplete] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize interview on mount
    useEffect(() => {
        const initInterview = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await jobMandateApi.startInterview();

                setMandateId(response.mandate_id);
                setConversationId(response.conversation_id ?? null);

                // Set initial message
                setMessages([{
                    id: '1',
                    role: 'interviewer',
                    content: response.opening_message
                }]);

                // Update sections from interview state
                updateSectionsFromState(response.interview_state.sections, response.interview_state.current_section);

            } catch (err) {
                console.error('Failed to start interview:', err);
                setError(err instanceof Error ? err.message : 'Failed to start interview');
            } finally {
                setIsLoading(false);
            }
        };

        initInterview();

        return () => {
            // Cleanup: abort any pending request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const updateSectionsFromState = (
        stateSections: MandateSections,
        currentSection: MandateSectionType
    ) => {
        setSections(prev => prev.map(section => {
            const stateSection = stateSections[section.id];
            return {
                ...section,
                status: stateSection.status,
                items: stateSection.items,
                isExpanded: section.id === currentSection || stateSection.status === 'in_progress'
            };
        }));
    };

    const toggleSection = (sectionId: MandateSectionType) => {
        setSections(prev => prev.map(section =>
            section.id === sectionId
                ? { ...section, isExpanded: !section.isExpanded }
                : section
        ));
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking || !mandateId) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsThinking(true);
        setError(null);

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        try {
            let responseText = '';
            const assistantMessageId = (Date.now() + 1).toString();

            // Add placeholder for assistant message
            setMessages(prev => [...prev, {
                id: assistantMessageId,
                role: 'interviewer',
                content: ''
            }]);

            for await (const event of jobMandateApi.streamMessage(
                mandateId,
                userMessage.content,
                conversationId ?? undefined,
                abortControllerRef.current.signal
            )) {
                handleStreamEvent(event, assistantMessageId, (text) => {
                    responseText += text;
                    // Update the assistant message with accumulated text
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, content: responseText }
                            : msg
                    ));
                });
            }

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('Request aborted');
            } else {
                console.error('Stream error:', err);
                setError(err instanceof Error ? err.message : 'Failed to send message');
            }
        } finally {
            setIsThinking(false);
            abortControllerRef.current = null;
        }
    }, [input, isThinking, mandateId, conversationId]);

    const handleStreamEvent = (
        event: InterviewStreamEvent,
        messageId: string,
        onTextDelta: (text: string) => void
    ) => {
        switch (event.type) {
            case 'text_delta':
                onTextDelta(event.text);
                break;

            case 'mandate_update':
                // Update sections with new data
                setSections(prev => prev.map(section => {
                    const updatedSection = event.mandate.sections[section.id];
                    const isCurrentSection = section.id === event.mandate.current_section;
                    const wasCompleted = event.section_completed === section.id;

                    return {
                        ...section,
                        status: updatedSection.status,
                        items: updatedSection.items,
                        // Collapse completed sections, expand current
                        isExpanded: wasCompleted ? false : (isCurrentSection || section.isExpanded)
                    };
                }));
                break;

            case 'complete':
                if (event.payload.conversation_id) {
                    setConversationId(event.payload.conversation_id);
                }
                if (event.payload.custom_payload?.data?.is_complete) {
                    setIsComplete(true);
                }
                break;

            case 'error':
                setError(event.message);
                break;

            case 'status':
                // Could show status indicator, but we already have isThinking
                break;
        }
    };

    const getStatusIcon = (status: SectionStatus) => {
        switch (status) {
            case 'completed':
                return (
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'in_progress':
                return (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                );
            default:
                return (
                    <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0" />
                );
        }
    };

    const getChevron = (isExpanded: boolean) => (
        <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Starting interview...</p>
                </div>
            </div>
        );
    }

    if (error && messages.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex">
            {/* Chat Section */}
            <div className="flex-1 flex flex-col border-r dark:border-gray-700">
                {/* Header */}
                <div className="p-4 border-b dark:border-gray-700">
                    <h1 className="text-xl font-semibold dark:text-white">Job Mandate Interview</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Let's clarify what you're looking for in your next role
                    </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(message => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-100'
                                    }`}
                            >
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {message.content.split('**').map((part, i) =>
                                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isThinking && messages[messages.length - 1]?.content === '' && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex justify-center">
                            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm">
                                {error}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={isComplete ? "Interview complete!" : "Type your response..."}
                            className="flex-1 rounded-lg border dark:border-gray-600 dark:bg-gray-800 dark:text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isThinking || isComplete}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isThinking || isComplete}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>

            {/* Mandate Panel */}
            <div className="w-96 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 overflow-y-auto">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="font-semibold dark:text-white">Your Job Mandate</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {isComplete ? 'Complete!' : 'Building as we talk...'}
                    </p>
                </div>

                <div className="p-4 space-y-3">
                    {sections.map(section => (
                        <div
                            key={section.id}
                            className={`rounded-lg border transition-all ${section.status === 'not_started'
                                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-50'
                                    : section.status === 'in_progress'
                                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                }`}
                        >
                            {/* Section Header - Clickable */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full p-3 flex items-center justify-between text-left"
                                disabled={section.status === 'not_started'}
                            >
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(section.status)}
                                    <h3 className="font-medium text-sm dark:text-white">{section.title}</h3>
                                    {section.status === 'completed' && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            ({section.items.length})
                                        </span>
                                    )}
                                </div>
                                {section.status !== 'not_started' && getChevron(section.isExpanded)}
                            </button>

                            {/* Section Content - Collapsible */}
                            {section.isExpanded && (
                                <div className="px-3 pb-3">
                                    {section.items.length > 0 ? (
                                        <ul className="space-y-2 ml-7">
                                            {section.items.map((item) => (
                                                <li key={item.id} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                                    <span className="text-gray-400 mt-0.5">•</span>
                                                    <span>{item.content}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 ml-7 italic">
                                            Listening...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Summary when all complete */}
                {isComplete && (
                    <div className="p-4 border-t dark:border-gray-700">
                        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
                            <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                                Mandate complete!
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {sections.reduce((acc, s) => acc + s.items.length, 0)} insights captured
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
