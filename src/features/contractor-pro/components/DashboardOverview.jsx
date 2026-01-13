// src/features/contractor-pro/components/DashboardOverview.jsx
// ============================================
// CONTRACTOR DASHBOARD OVERVIEW
// ============================================
// Main dashboard showing stats, recent activity, and quick actions
// FIXED: Added defensive null checking for stats prop

import React, { useState } from 'react';
import {
    Users, FileText, TrendingUp, Clock, Plus,
    CheckCircle, AlertCircle, ChevronRight, Copy,
    ExternalLink, Bell, Settings, LogOut, Sparkles,
    Building2, ArrowUpRight, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../../utils/formatCurrency';

// Native helper to replace date-fns formatDistanceToNow
const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
};

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ icon: Icon, label, value, subtext, color = 'emerald', trend }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100'
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
                    <Icon size={20} />
                </div>
                {trend && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <p className="text-3xl font-extrabold text-slate-800 mb-1">{value}</p>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    );
};

// ============================================
// ACTIVITY ITEM COMPONENT
// ============================================
const ActivityItem = ({ invitation, onClick }) => {
    const isClaimed = invitation.status === 'claimed';
    const isPending = invitation.status === 'pending';

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return formatTimeAgo(date);
    };

    const copyLink = (e) => {
        e.stopPropagation();
        if (invitation.link) {
            navigator.clipboard.writeText(invitation.link);
            toast.success('Link copied!');
        }
    };

    return (
        <div
            onClick={onClick}
            className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all cursor-pointer"
        >
            <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className={`p-2 rounded-lg flex-shrink-0 ${isClaimed
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                    }`}>
                    {isClaimed ? <CheckCircle size={18} /> : <Clock size={18} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-800 truncate">
                            {isClaimed
                                ? (invitation.customerName || invitation.customerPropertyName || 'New Customer')
                                : 'Pending Invitation'
                            }
                        </p>
                        <span className="text-xs text-slate-400">
                            {getTimeAgo(isClaimed ? invitation.claimedAt : invitation.createdAt)}
                        </span>
                    </div>

                    <p className="text-sm text-slate-500">
                        {invitation.recordCount || 0} item{invitation.recordCount !== 1 ? 's' : ''}
                        {invitation.totalValue > 0 && (
                            <span className="ml-2 font-medium text-slate-600">
                                {formatCurrency(invitation.totalValue)}
                            </span>
                        )}
                    </p>

                    {/* Record summary */}
                    {invitation.recordSummary?.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1 truncate">
                            {invitation.recordSummary.map(r => r.item).join(', ')}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isPending && (
                        <button
                            onClick={copyLink}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Copy link"
                        >
                            <Copy size={16} />
                        </button>
                    )}
                    <ChevronRight size={18} className="text-slate-300" />
                </div>
            </div>
        </div>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ onCreateInvitation }) => (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-8 text-center">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 inline-block mb-4">
            <Sparkles className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
            Welcome to Krib Pro!
        </h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Create your first customer invitation to start building your digital portfolio
            and tracking relationships.
        </p>
        <button
            onClick={onCreateInvitation}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
        >
            <Plus size={20} />
            Create First Invitation
        </button>
    </div>
);

// ============================================
// QUICK TIP CARD
// ============================================
// ============================================
// QUICK TIP CARD
// ============================================
const QuickTip = ({ tip, onDismiss }) => (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 flex-shrink-0">
            <Sparkles size={16} />
        </div>
        <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">{tip.title}</p>
            <p className="text-sm text-blue-600 mt-0.5">{tip.message}</p>
        </div>
        {onDismiss && (
            <button
                onClick={onDismiss}
                className="text-blue-400 hover:text-blue-600"
            >
                ×
            </button>
        )}
    </div>
);

// ============================================
// CUSTOMER JOURNEY PIPELINE
// ============================================
const CustomerJourneyPipeline = ({ quotes = [], jobs = [], customers = [] }) => {
    // Calculate journey stages
    const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'pending' || q.status === 'draft');
    const acceptedQuotes = quotes.filter(q => q.status === 'accepted' || q.status === 'approved');

    const activeJobs = jobs.filter(j =>
        j.status !== 'completed' &&
        j.status !== 'cancelled' &&
        j.status !== 'archived'
    );
    const completedJobs = jobs.filter(j => j.status === 'completed');

    // Calculate revenue
    const pendingQuoteValue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const activeJobValue = activeJobs.reduce((sum, j) => sum + (j.total || j.estimate?.amount || 0), 0);
    const completedJobValue = completedJobs.reduce((sum, j) => sum + (j.total || j.estimate?.amount || 0), 0);

    // Unique customer counts by stage
    const uniqueQuotedCustomers = new Set(pendingQuotes.map(q => q.customer?.email || q.customerId)).size;
    const uniqueActiveCustomers = new Set(activeJobs.map(j => j.customer?.email || j.customerId)).size;
    const uniqueCompletedCustomers = new Set(completedJobs.map(j => j.customer?.email || j.customerId)).size;

    const stages = [
        {
            id: 'leads',
            label: 'Leads',
            sublabel: 'Connected',
            count: customers.length,
            icon: Users,
            color: 'slate',
            bgColor: 'bg-slate-100',
            textColor: 'text-slate-600',
            borderColor: 'border-slate-200'
        },
        {
            id: 'quoted',
            label: 'Quoted',
            sublabel: 'Pending response',
            count: pendingQuotes.length,
            value: pendingQuoteValue,
            uniqueCustomers: uniqueQuotedCustomers,
            icon: FileText,
            color: 'amber',
            bgColor: 'bg-amber-50',
            textColor: 'text-amber-600',
            borderColor: 'border-amber-200'
        },
        {
            id: 'active',
            label: 'Active',
            sublabel: 'Jobs in progress',
            count: activeJobs.length,
            value: activeJobValue,
            uniqueCustomers: uniqueActiveCustomers,
            icon: Clock,
            color: 'blue',
            bgColor: 'bg-blue-50',
            textColor: 'text-blue-600',
            borderColor: 'border-blue-200'
        },
        {
            id: 'completed',
            label: 'Completed',
            sublabel: 'Finished jobs',
            count: completedJobs.length,
            value: completedJobValue,
            uniqueCustomers: uniqueCompletedCustomers,
            icon: CheckCircle,
            color: 'emerald',
            bgColor: 'bg-emerald-50',
            textColor: 'text-emerald-600',
            borderColor: 'border-emerald-200'
        }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Customer Journey</h3>
                <span className="text-xs text-slate-400">Pipeline overview</span>
            </div>

            {/* Pipeline stages */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stages.map((stage, idx) => {
                    const Icon = stage.icon;
                    return (
                        <div
                            key={stage.id}
                            className={`relative p-4 rounded-xl border-2 ${stage.bgColor} ${stage.borderColor}`}
                        >
                            {/* Arrow connector (hidden on first item and mobile) */}
                            {idx > 0 && (
                                <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
                                    <ChevronRight size={16} className="text-slate-300" />
                                </div>
                            )}

                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-lg ${stage.textColor} bg-white/60`}>
                                    <Icon size={14} />
                                </div>
                                <span className={`text-xs font-bold uppercase tracking-wide ${stage.textColor}`}>
                                    {stage.label}
                                </span>
                            </div>

                            <p className="text-2xl font-extrabold text-slate-800">
                                {stage.count}
                            </p>

                            {stage.value !== undefined && stage.value > 0 && (
                                <p className={`text-sm font-medium ${stage.textColor} mt-1`}>
                                    {formatCurrency(stage.value)}
                                </p>
                            )}

                            <p className="text-xs text-slate-500 mt-1">
                                {stage.sublabel}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Summary stats */}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-lg font-bold text-slate-800">
                        {formatCurrency(pendingQuoteValue + activeJobValue)}
                    </p>
                    <p className="text-xs text-slate-500">Pipeline Value</p>
                </div>
                <div>
                    <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(completedJobValue)}
                    </p>
                    <p className="text-xs text-slate-500">Completed Revenue</p>
                </div>
                <div>
                    <p className="text-lg font-bold text-slate-800">
                        {completedJobs.length > 0 && quotes.length > 0
                            ? Math.round((completedJobs.length / quotes.length) * 100)
                            : 0}%
                    </p>
                    <p className="text-xs text-slate-500">Win Rate</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ONBOARDING CHECKLIST
// ============================================
const OnboardingChecklist = ({ profile, quotes = [], jobs = [], onNavigate }) => {
    const [dismissed, setDismissed] = useState(false);

    // Define checklist items with completion checks
    const checklistItems = [
        {
            id: 'account',
            label: 'Create your account',
            completed: true, // Always true if they're here
            action: null,
        },
        {
            id: 'company',
            label: 'Add company name',
            completed: !!profile?.profile?.companyName,
            action: () => onNavigate('profile'),
        },
        {
            id: 'logo',
            label: 'Upload your logo',
            completed: !!profile?.profile?.logoUrl,
            action: () => onNavigate('profile'),
        },
        {
            id: 'phone',
            label: 'Add business phone',
            completed: !!profile?.profile?.phone,
            action: () => onNavigate('profile'),
        },
        {
            id: 'quote',
            label: 'Create your first quote',
            completed: quotes.length > 0,
            action: () => onNavigate('create-quote'),
        },
    ];

    const completedCount = checklistItems.filter(item => item.completed).length;
    const totalCount = checklistItems.length;
    const progressPercent = Math.round((completedCount / totalCount) * 100);
    const allComplete = completedCount === totalCount;

    // Don't show if dismissed or all complete
    if (dismissed || allComplete) return null;

    return (
        <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-2xl border-2 border-emerald-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Get started with Krib Pro</h3>
                    <p className="text-slate-500 text-sm">Complete your profile to look professional to customers</p>
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="Dismiss"
                >
                    ×
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-600">{completedCount} of {totalCount} complete</span>
                    <span className="font-bold text-emerald-600">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
                {checklistItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={item.action && !item.completed ? item.action : undefined}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${item.completed
                            ? 'bg-emerald-50/50'
                            : item.action
                                ? 'bg-white hover:bg-slate-50 cursor-pointer border border-slate-200 hover:border-emerald-300'
                                : 'bg-white'
                            }`}
                    >
                        {/* Checkbox */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.completed
                            ? 'bg-emerald-500 text-white'
                            : 'border-2 border-slate-300'
                            }`}>
                            {item.completed && <CheckCircle size={14} />}
                        </div>

                        {/* Label */}
                        <span className={`flex-1 text-sm font-medium ${item.completed ? 'text-slate-500 line-through' : 'text-slate-700'
                            }`}>
                            {item.label}
                        </span>

                        {/* Action arrow */}
                        {!item.completed && item.action && (
                            <ChevronRight size={16} className="text-slate-400" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
export const DashboardOverview = ({
    profile,
    stats = { totalCustomers: 0, totalInvitations: 0, claimRate: 0, pendingInvitations: 0 },
    invitations = [],
    customers = [],
    quotes = [],
    jobs = [],
    loading,
    onCreateInvitation,
    onViewAllInvitations,
    onViewAllCustomers,
    onViewInvitation,
    onNavigate
}) => {
    const [showTip, setShowTip] = useState(true);

    const companyName = profile?.profile?.companyName || profile?.profile?.displayName || 'Your Business';
    // Updated: Include quotes and jobs in hasData check
    const hasData = invitations.length > 0 || customers.length > 0 || quotes.length > 0 || jobs.length > 0;

    // Format claim rate as percentage - FIX: Added optional chaining
    const claimRatePercent = Math.round((stats?.claimRate || 0) * 100);

    // Recent activity (claimed invitations first, then pending)
    const recentActivity = [...invitations]
        .sort((a, b) => {
            // Claimed first
            if (a.status === 'claimed' && b.status !== 'claimed') return -1;
            if (b.status === 'claimed' && a.status !== 'claimed') return 1;
            // Then by date
            const aDate = (a.claimedAt || a.createdAt)?.toDate?.() || new Date(0);
            const bDate = (b.claimedAt || b.createdAt)?.toDate?.() || new Date(0);
            return bDate - aDate;
        })
        .slice(0, 5);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-500">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Welcome back!
                    </h1>
                    <p className="text-slate-500">{companyName}</p>
                </div>
                <button
                    onClick={onCreateInvitation}
                    className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={18} />
                    New Invitation
                </button>
            </div>

            {/* Onboarding Checklist - shows until complete */}
            <OnboardingChecklist
                profile={profile}
                quotes={quotes}
                jobs={jobs}
                onNavigate={onNavigate}
            />

            {/* Quick Tip - only show after onboarding complete and has data */}
            {showTip && hasData && (
                <QuickTip
                    tip={{
                        title: 'Pro Tip',
                        message: "Share your invitation link via text or email after completing a job. When customers need service again, you're one tap away!"
                    }}
                    onDismiss={() => setShowTip(false)}
                />
            )}

            {/* Stats Grid - FIX: Added optional chaining for all stats properties */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={Users}
                    label="Customers"
                    value={stats?.totalCustomers || 0}
                    subtext="have your info saved"
                    color="emerald"
                />
                <StatCard
                    icon={FileText}
                    label="Invitations"
                    value={stats?.totalInvitations || 0}
                    subtext={`${stats?.pendingInvitations || 0} pending`}
                    color="blue"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Claim Rate"
                    value={`${claimRatePercent}%`}
                    subtext="of invitations claimed"
                    color="purple"
                />
                <StatCard
                    icon={Clock}
                    label="Pending"
                    value={stats?.pendingInvitations || 0}
                    subtext="awaiting claim"
                    color="amber"
                />
            </div>

            {/* Customer Journey Pipeline - Shows quote/job progression */}
            {hasData && (
                <CustomerJourneyPipeline
                    quotes={quotes}
                    jobs={jobs}
                    customers={customers}
                />
            )}

            {/* Main Content */}
            {!hasData ? (
                <EmptyState onCreateInvitation={onCreateInvitation} />
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800">Recent Activity</h2>
                            <button
                                onClick={onViewAllInvitations}
                                className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                            >
                                View All <ArrowUpRight size={14} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {recentActivity.length > 0 ? (
                                recentActivity.map(invitation => (
                                    <ActivityItem
                                        key={invitation.id}
                                        invitation={invitation}
                                        onClick={() => onViewInvitation?.(invitation)}
                                    />
                                ))
                            ) : (
                                <p className="text-center text-slate-400 py-8">
                                    No activity yet
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Top Customers */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800">Your Customers</h2>
                            <button
                                onClick={onViewAllCustomers}
                                className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                            >
                                View All <ArrowUpRight size={14} />
                            </button>
                        </div>
                        <div className="p-4">
                            {customers.length > 0 ? (
                                <div className="space-y-3">
                                    {customers.slice(0, 5).map(customer => (
                                        <div
                                            key={customer.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                                        >
                                            <div className="bg-slate-100 p-2 rounded-full">
                                                <Users size={16} className="text-slate-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-800 truncate">
                                                    {customer.customerName || customer.propertyName || 'Customer'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {customer.totalJobs || 1} job{customer.totalJobs !== 1 ? 's' : ''}
                                                    {customer.totalSpend > 0 && (
                                                        <span className="ml-2">
                                                            • {formatCurrency(customer.totalSpend)}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-8">
                                    No customers yet
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile FAB */}
            <button
                onClick={onCreateInvitation}
                className="md:hidden fixed bottom-24 right-4 p-4 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-colors z-50"
            >
                <Plus size={24} />
            </button>
        </div>
    );
};

export default DashboardOverview;
