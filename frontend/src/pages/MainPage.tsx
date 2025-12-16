import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    DocumentTextIcon,
    UserCircleIcon,
    SparklesIcon,
    UserGroupIcon,
    MagnifyingGlassIcon,
    DocumentDuplicateIcon,
    ChevronRightIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    items: string[];
    status: 'not_started' | 'in_progress' | 'complete';
    onClick?: () => void;
}

function FeatureCard({ icon, title, description, items, status, onClick }: FeatureCardProps) {
    const statusColors = {
        not_started: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
        in_progress: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        complete: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    };

    const statusBadge = {
        not_started: null,
        in_progress: (
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full">
                In Progress
            </span>
        ),
        complete: (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full flex items-center gap-1">
                <CheckCircleIcon className="h-3 w-3" />
                Complete
            </span>
        )
    };

    return (
        <div
            className={`p-6 rounded-xl border-2 ${statusColors[status]} hover:shadow-lg transition-all cursor-pointer group`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                    {icon}
                </div>
                {statusBadge[status]}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {description}
            </p>
            <ul className="space-y-2">
                {items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function MainPage() {
    const { user } = useAuth();
    const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

    const features: FeatureCardProps[] = [
        {
            icon: <DocumentTextIcon className="h-6 w-6 text-blue-600" />,
            title: "Profile & Materials",
            description: "Import and organize your professional materials",
            items: [
                "Upload resume/CV",
                "Connect LinkedIn profile",
                "Add work samples & portfolio",
                "Consolidate experience history"
            ],
            status: 'not_started'
        },
        {
            icon: <UserCircleIcon className="h-6 w-6 text-purple-600" />,
            title: "Job Mandate",
            description: "Define what you're looking for in your next role",
            items: [
                "What you like to do",
                "What you're good at",
                "Must-haves in a new role",
                "Deal-breakers to avoid"
            ],
            status: 'not_started'
        },
        {
            icon: <SparklesIcon className="h-6 w-6 text-amber-600" />,
            title: "Candidate Market Fit",
            description: "Align your strengths with market opportunities",
            items: [
                "Match skills to in-demand roles",
                "Identify positioning angles",
                "Tune resume for target roles",
                "Optimize LinkedIn presence"
            ],
            status: 'not_started'
        },
        {
            icon: <UserGroupIcon className="h-6 w-6 text-green-600" />,
            title: "Networking Strategy",
            description: "Build connections at target companies",
            items: [
                "Identify target companies",
                "Find warm intro paths",
                "Prepare talking points",
                "Track outreach & follow-ups"
            ],
            status: 'not_started'
        },
        {
            icon: <MagnifyingGlassIcon className="h-6 w-6 text-red-600" />,
            title: "Opportunity Discovery",
            description: "Find and track relevant job opportunities",
            items: [
                "Automated job search",
                "Prioritized opportunity list",
                "Hot/warm/cold rankings",
                "Custom search criteria"
            ],
            status: 'not_started'
        },
        {
            icon: <DocumentDuplicateIcon className="h-6 w-6 text-indigo-600" />,
            title: "Application Support",
            description: "Prepare materials for specific opportunities",
            items: [
                "Tailored cover letters",
                "Company research briefs",
                "Interview talking points",
                "Questions to ask"
            ],
            status: 'not_started'
        }
    ];

    return (
        <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900">
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Welcome{user?.username ? `, ${user.username}` : ''}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                        Your AI-powered job search assistant. Let's find your next opportunity.
                    </p>
                </div>

                {/* Progress Overview */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-8 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Your Job Search Journey
                        </h2>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            0 of 6 steps completed
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: '0%' }}
                        />
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        Start by uploading your resume and defining what you're looking for.
                    </p>
                </div>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, idx) => (
                        <FeatureCard
                            key={idx}
                            {...feature}
                            onClick={() => setSelectedFeature(feature.title)}
                        />
                    ))}
                </div>

                {/* Getting Started CTA */}
                <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">
                                Ready to get started?
                            </h3>
                            <p className="text-blue-100">
                                Begin by uploading your resume or connecting your LinkedIn profile.
                            </p>
                        </div>
                        <button className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg">
                            Start Setup
                        </button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Upload Resume</span>
                    </button>
                    <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left">
                        <UserCircleIcon className="h-5 w-5 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Connect LinkedIn</span>
                    </button>
                    <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Browse Jobs</span>
                    </button>
                    <button className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left">
                        <SparklesIcon className="h-5 w-5 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">AI Chat</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
