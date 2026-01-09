// src/features/contractor-pro/components/NeedsAttention.jsx
// ============================================
// NEEDS ATTENTION - SMART ALERTS SYSTEM
// ============================================
// Surfaces actionable items that need contractor attention:
// - Stale quotes (sent but not viewed)
// - Follow-up opportunities (viewed, no response)
// - Unscheduled jobs
// - Overdue invoices
// - Today's schedule
// - Expiring quotes
// - Pending evaluations

import React, { useState, useMemo } from 'react';
import {
    AlertCircle, Clock, Calendar, DollarSign, Eye, Send,
    FileText, Briefcase, Users, ChevronRight, CheckCircle,
    XCircle, AlertTriangle, Bell, Filter, X, ExternalLink,
    Phone, Mail, MapPin, TrendingUp, Zap, Star, MessageSquare,
    RefreshCw, ChevronDown, ChevronUp, Flame, Target, Award
} from 'lucide-react';

// ============================================
// CONSTANTS
// ============================================
const ALERT_TYPES = {
    STALE_QUOTE: 'stale_quote',
    VIEWED_NO_RESPONSE: 'viewed_no_response',
    EXPIRING_QUOTE: 'expiring_quote',
    UNSCHEDULED_JOB: 'unscheduled_job',
    TODAYS_JOB: 'todays_job',
    OVERDUE_INVOICE: 'overdue_invoice',
    PENDING_EVALUATION: 'pending_evaluation',
    NEW_MESSAGE: 'new_message',
    JOB_NEEDS_COMPLETION: 'job_needs_completion',
};

const PRIORITY_CONFIG = {
    urgent: {
        color: 'red',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        badge: 'bg-red-500',
    },
    warning: {
        color: 'amber',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        textColor: 'text-amber-700',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        badge: 'bg-amber-500',
    },
    info: {
        color: 'blue',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        textColor: 'text-blue-700',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        badge: 'bg-blue-500',
    },
    success: {
        color: 'emerald',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        textColor: 'text-emerald-700',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        badge: 'bg-emerald-500',
    },
};

const CATEGORY_CONFIG = {
    quotes: {
        label: 'Quotes',
        icon: FileText,
        color: 'blue',
    },
    jobs: {
        label: 'Jobs',
        icon: Briefcase,
        color: 'purple',
    },
    invoices: {
        label: 'Invoices',
        icon: DollarSign,
        color: 'emerald',
    },
    schedule: {
        label: 'Schedule',
        icon: Calendar,
        color: 'amber',
    },
    evaluations: {
        label: 'Evaluations',
        icon: Eye,
        color: 'pink',
    },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const formatCurrency = (value) => {
    return `$${(value || 0).toLocaleString()}`;
};

const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

const getDaysDiff = (timestamp) => {
    if (!timestamp) return 0;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
};

const isSameDay = (d1, d2) => {
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = d2.toDate ? d2.toDate() : new Date(d2);
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
};

// ============================================
// ALERT CARD COMPONENT
// ============================================
const AlertCard = ({ alert, onAction, onDismiss, expanded, onToggleExpand }) => {
    const config = PRIORITY_CONFIG[alert.priority];
    const Icon = alert.icon;

    return (
        <div className={`${config.bgColor} ${config.borderColor} border rounded-xl overflow-hidden transition-all hover:shadow-md`}>
            {/* Main Content */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`${config.iconBg} p-2 rounded-lg flex-shrink-0`}>
                        <Icon size={18} className={config.iconColor} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className={`font-semibold ${config.textColor}`}>
                                    {alert.title}
                                </h4>
                                <p className="text-sm text-slate-600 mt-0.5">
                                    {alert.subtitle}
                                </p>
                            </div>
                            
                            {/* Value/Badge */}
                            {alert.value && (
                                <span className="font-bold text-slate-800 whitespace-nowrap">
                                    {alert.value}
                                </span>
                            )}
                        </div>

                        {/* Meta info */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            {alert.time && (
                                <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {alert.time}
                                </span>
                            )}
                            {alert.customer && (
                                <span className="flex items-center gap-1">
                                    <Users size={12} />
                                    {alert.customer}
                                </span>
                            )}
                        </div>

                        {/* Expanded Details */}
                        {expanded && alert.details && (
                            <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-2">
                                {alert.details.map((detail, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                        <detail.icon size={14} className="text-slate-400" />
                                        <span>{detail.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={() => onAction(alert)}
                                className={`px-3 py-1.5 ${config.badge} text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1`}
                            >
                                {alert.actionLabel}
                                <ChevronRight size={14} />
                            </button>
                            
                            {alert.secondaryAction && (
                                <button
                                    onClick={() => alert.secondaryAction.onClick(alert)}
                                    className="px-3 py-1.5 bg-white text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
                                >
                                    {alert.secondaryAction.label}
                                </button>
                            )}

                            {alert.details && (
                                <button
                                    onClick={onToggleExpand}
                                    className="ml-auto p-1 text-slate-400 hover:text-slate-600"
                                >
                                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// SUMMARY STAT CARD
// ============================================
const SummaryStat = ({ icon: Icon, label, value, color, onClick }) => {
    const colors = {
        red: 'bg-red-50 text-red-600 border-red-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
    };

    return (
        <button
            onClick={onClick}
            className={`${colors[color]} border rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all w-full text-left`}
        >
            <Icon size={20} />
            <div>
                <p className="text-2xl font-black">{value}</p>
                <p className="text-xs opacity-75">{label}</p>
            </div>
        </button>
    );
};

// ============================================
// CATEGORY FILTER PILL
// ============================================
const CategoryPill = ({ category, count, active, onClick }) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;

    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                active 
                    ? 'bg-slate-800 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
            <Icon size={14} />
            {config.label}
            {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    active ? 'bg-white text-slate-800' : 'bg-slate-300 text-slate-700'
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = () => (
    <div className="text-center py-12">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">All Caught Up! 🎉</h3>
        <p className="text-slate-500 max-w-sm mx-auto">
            You have no items needing attention right now. Great job staying on top of things!
        </p>
    </div>
);

// ============================================
// MAIN NEEDS ATTENTION COMPONENT
// ============================================
export const NeedsAttention = ({
    quotes = [],
    jobs = [],
    invoices = [],
    evaluations = [],
    onNavigate,
    variant = 'full' // 'full' | 'compact' | 'widget'
}) => {
    const [activeFilter, setActiveFilter] = useState('all');
    const [expandedAlerts, setExpandedAlerts] = useState(new Set());
    const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

    // Generate all alerts
    const alerts = useMemo(() => {
        const items = [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // ============================================
        // QUOTE ALERTS
        // ============================================
        
        // Stale quotes (sent 7+ days ago, never viewed)
        quotes.forEach(quote => {
            if (quote.status === 'sent' && quote.sentAt) {
                const daysSinceSent = getDaysDiff(quote.sentAt);
                if (daysSinceSent >= 7) {
                    items.push({
                        id: `stale-${quote.id}`,
                        type: ALERT_TYPES.STALE_QUOTE,
                        category: 'quotes',
                        priority: daysSinceSent >= 14 ? 'urgent' : 'warning',
                        icon: Send,
                        title: 'Quote Not Viewed',
                        subtitle: `Sent ${daysSinceSent} days ago - customer hasn't opened it`,
                        customer: quote.customer?.name || 'Customer',
                        value: formatCurrency(quote.total),
                        time: formatTimeAgo(quote.sentAt),
                        actionLabel: 'Follow Up',
                        data: quote,
                        details: [
                            { icon: FileText, text: `Quote #${quote.quoteNumber || quote.id.slice(-6)}` },
                            { icon: Mail, text: quote.customer?.email || 'No email' },
                            { icon: Phone, text: quote.customer?.phone || 'No phone' },
                        ],
                        secondaryAction: {
                            label: 'Resend',
                            onClick: (alert) => console.log('Resend quote:', alert.data.id),
                        },
                    });
                }
            }
        });

        // Viewed but no response (3+ days)
        quotes.forEach(quote => {
            if (quote.status === 'viewed' && quote.viewedAt) {
                const daysSinceViewed = getDaysDiff(quote.viewedAt);
                if (daysSinceViewed >= 3) {
                    items.push({
                        id: `viewed-${quote.id}`,
                        type: ALERT_TYPES.VIEWED_NO_RESPONSE,
                        category: 'quotes',
                        priority: daysSinceViewed >= 7 ? 'urgent' : 'warning',
                        icon: Eye,
                        title: 'Awaiting Response',
                        subtitle: `Customer viewed ${daysSinceViewed} days ago but hasn't responded`,
                        customer: quote.customer?.name || 'Customer',
                        value: formatCurrency(quote.total),
                        time: formatTimeAgo(quote.viewedAt),
                        actionLabel: 'Follow Up',
                        data: quote,
                        details: [
                            { icon: Eye, text: `Viewed ${quote.viewCount || 1} time(s)` },
                            { icon: Mail, text: quote.customer?.email || 'No email' },
                            { icon: Phone, text: quote.customer?.phone || 'No phone' },
                        ],
                    });
                }
            }
        });

        // Expiring soon (within 3 days)
        quotes.forEach(quote => {
            if (['sent', 'viewed'].includes(quote.status) && quote.expiresAt) {
                const expiresDate = quote.expiresAt.toDate ? quote.expiresAt.toDate() : new Date(quote.expiresAt);
                const daysUntilExpiry = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry > 0 && daysUntilExpiry <= 3) {
                    items.push({
                        id: `expiring-${quote.id}`,
                        type: ALERT_TYPES.EXPIRING_QUOTE,
                        category: 'quotes',
                        priority: daysUntilExpiry <= 1 ? 'urgent' : 'warning',
                        icon: Clock,
                        title: 'Quote Expiring Soon',
                        subtitle: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
                        customer: quote.customer?.name || 'Customer',
                        value: formatCurrency(quote.total),
                        actionLabel: 'Extend',
                        data: quote,
                    });
                }
            }
        });

        // ============================================
        // JOB ALERTS
        // ============================================

        // Unscheduled jobs
        jobs.forEach(job => {
            if (['pending_schedule', 'slots_offered', 'quoted', 'accepted'].includes(job.status)) {
                const daysSinceCreated = getDaysDiff(job.createdAt);
                items.push({
                    id: `unscheduled-${job.id}`,
                    type: ALERT_TYPES.UNSCHEDULED_JOB,
                    category: 'jobs',
                    priority: daysSinceCreated >= 7 ? 'urgent' : daysSinceCreated >= 3 ? 'warning' : 'info',
                    icon: Calendar,
                    title: 'Job Needs Scheduling',
                    subtitle: job.title || 'Untitled Job',
                    customer: job.customer?.name || 'Customer',
                    value: formatCurrency(job.total),
                    time: formatTimeAgo(job.createdAt),
                    actionLabel: 'Schedule',
                    data: job,
                    details: [
                        { icon: MapPin, text: job.customer?.address || 'No address' },
                        { icon: Phone, text: job.customer?.phone || 'No phone' },
                    ],
                });
            }
        });

        // Today's jobs
        jobs.forEach(job => {
            if (job.status === 'scheduled' && job.scheduledDate) {
                const scheduledDate = job.scheduledDate.toDate ? job.scheduledDate.toDate() : new Date(job.scheduledDate);
                if (isSameDay(scheduledDate, today)) {
                    items.push({
                        id: `today-${job.id}`,
                        type: ALERT_TYPES.TODAYS_JOB,
                        category: 'schedule',
                        priority: 'success',
                        icon: Briefcase,
                        title: "Today's Job",
                        subtitle: job.title || 'Scheduled Job',
                        customer: job.customer?.name || 'Customer',
                        time: job.scheduledTime ? new Date(job.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time TBD',
                        actionLabel: 'View Details',
                        data: job,
                        details: [
                            { icon: MapPin, text: job.customer?.address || 'No address' },
                            { icon: Phone, text: job.customer?.phone || 'No phone' },
                        ],
                    });
                }
            }
        });

        // Jobs that might need completion marking
        jobs.forEach(job => {
            if (job.status === 'scheduled' && job.scheduledDate) {
                const scheduledDate = job.scheduledDate.toDate ? job.scheduledDate.toDate() : new Date(job.scheduledDate);
                const daysSinceScheduled = Math.floor((now - scheduledDate) / (1000 * 60 * 60 * 24));
                if (daysSinceScheduled >= 1) {
                    items.push({
                        id: `complete-${job.id}`,
                        type: ALERT_TYPES.JOB_NEEDS_COMPLETION,
                        category: 'jobs',
                        priority: daysSinceScheduled >= 3 ? 'warning' : 'info',
                        icon: CheckCircle,
                        title: 'Mark Job Complete?',
                        subtitle: `Scheduled for ${formatTimeAgo(job.scheduledDate)}`,
                        customer: job.customer?.name || 'Customer',
                        value: formatCurrency(job.total),
                        actionLabel: 'Complete',
                        data: job,
                    });
                }
            }
        });

        // ============================================
        // INVOICE ALERTS
        // ============================================

        // Overdue invoices
        invoices.forEach(invoice => {
            if (invoice.status === 'sent' && invoice.dueDate) {
                const dueDate = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
                const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
                if (daysOverdue > 0) {
                    items.push({
                        id: `overdue-${invoice.id}`,
                        type: ALERT_TYPES.OVERDUE_INVOICE,
                        category: 'invoices',
                        priority: daysOverdue >= 30 ? 'urgent' : daysOverdue >= 14 ? 'warning' : 'info',
                        icon: DollarSign,
                        title: 'Overdue Invoice',
                        subtitle: `${daysOverdue} days past due`,
                        customer: invoice.customer?.name || 'Customer',
                        value: formatCurrency(invoice.total),
                        actionLabel: 'Send Reminder',
                        data: invoice,
                        details: [
                            { icon: FileText, text: `Invoice #${invoice.invoiceNumber || invoice.id.slice(-6)}` },
                            { icon: Calendar, text: `Due: ${dueDate.toLocaleDateString()}` },
                        ],
                    });
                }
            }
        });

        // ============================================
        // EVALUATION ALERTS
        // ============================================

        // Pending evaluations
        evaluations.forEach(evaluation => {
            if (evaluation.status === 'pending' || evaluation.status === 'info_requested') {
                const daysSinceCreated = getDaysDiff(evaluation.createdAt);
                items.push({
                    id: `eval-${evaluation.id}`,
                    type: ALERT_TYPES.PENDING_EVALUATION,
                    category: 'evaluations',
                    priority: daysSinceCreated >= 5 ? 'warning' : 'info',
                    icon: Eye,
                    title: evaluation.status === 'info_requested' ? 'Info Requested' : 'Pending Evaluation',
                    subtitle: evaluation.title || 'Evaluation Request',
                    customer: evaluation.customer?.name || 'Customer',
                    time: formatTimeAgo(evaluation.createdAt),
                    actionLabel: 'Review',
                    data: evaluation,
                });
            }
        });

        // Sort by priority and recency
        const priorityOrder = { urgent: 0, warning: 1, info: 2, success: 3 };
        return items
            .filter(item => !dismissedAlerts.has(item.id))
            .sort((a, b) => {
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return 0;
            });
    }, [quotes, jobs, invoices, evaluations, dismissedAlerts]);

    // Filter alerts by category
    const filteredAlerts = useMemo(() => {
        if (activeFilter === 'all') return alerts;
        return alerts.filter(alert => alert.category === activeFilter);
    }, [alerts, activeFilter]);

    // Category counts
    const categoryCounts = useMemo(() => {
        const counts = { all: alerts.length };
        Object.keys(CATEGORY_CONFIG).forEach(cat => {
            counts[cat] = alerts.filter(a => a.category === cat).length;
        });
        return counts;
    }, [alerts]);

    // Summary stats
    const summaryStats = useMemo(() => ({
        urgent: alerts.filter(a => a.priority === 'urgent').length,
        warning: alerts.filter(a => a.priority === 'warning').length,
        todaysJobs: alerts.filter(a => a.type === ALERT_TYPES.TODAYS_JOB).length,
        pendingRevenue: alerts
            .filter(a => ['quotes', 'invoices'].includes(a.category) && a.data?.total)
            .reduce((sum, a) => sum + (a.data.total || 0), 0),
    }), [alerts]);

    // Handle actions
    const handleAction = (alert) => {
        switch (alert.category) {
            case 'quotes':
                onNavigate?.('quote-detail', { quote: alert.data });
                break;
            case 'jobs':
                onNavigate?.('jobs', { job: alert.data });
                break;
            case 'invoices':
                onNavigate?.('invoices', { invoice: alert.data });
                break;
            case 'evaluations':
                onNavigate?.('evaluation-detail', { evaluation: alert.data });
                break;
            case 'schedule':
                onNavigate?.('schedule');
                break;
            default:
                break;
        }
    };

    const handleDismiss = (alertId) => {
        setDismissedAlerts(prev => new Set([...prev, alertId]));
    };

    const toggleExpanded = (alertId) => {
        setExpandedAlerts(prev => {
            const next = new Set(prev);
            if (next.has(alertId)) {
                next.delete(alertId);
            } else {
                next.add(alertId);
            }
            return next;
        });
    };

    // ============================================
    // WIDGET VARIANT (Small dashboard card)
    // ============================================
    if (variant === 'widget') {
        const topAlerts = alerts.slice(0, 3);
        const urgentCount = summaryStats.urgent + summaryStats.warning;

        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${urgentCount > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
                            <Bell size={18} className={urgentCount > 0 ? 'text-red-600' : 'text-emerald-600'} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Needs Attention</h3>
                            <p className="text-xs text-slate-500">{alerts.length} items</p>
                        </div>
                    </div>
                    {urgentCount > 0 && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                            {urgentCount} urgent
                        </span>
                    )}
                </div>

                {topAlerts.length === 0 ? (
                    <div className="text-center py-4">
                        <CheckCircle className="mx-auto text-emerald-500 mb-2" size={24} />
                        <p className="text-sm text-slate-500">All caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {topAlerts.map(alert => {
                            const config = PRIORITY_CONFIG[alert.priority];
                            const Icon = alert.icon;
                            
                            return (
                                <button
                                    key={alert.id}
                                    onClick={() => handleAction(alert)}
                                    className={`w-full flex items-center gap-3 p-2 rounded-lg ${config.bgColor} hover:opacity-80 transition-opacity text-left`}
                                >
                                    <Icon size={16} className={config.iconColor} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${config.textColor} truncate`}>
                                            {alert.title}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            {alert.customer}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-400" />
                                </button>
                            );
                        })}
                    </div>
                )}

                {alerts.length > 3 && (
                    <button
                        onClick={() => onNavigate?.('attention')}
                        className="w-full mt-3 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1"
                    >
                        View All ({alerts.length})
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>
        );
    }

    // ============================================
    // COMPACT VARIANT (Medium size)
    // ============================================
    if (variant === 'compact') {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-slate-600" />
                        <h3 className="font-bold text-slate-800">Needs Attention</h3>
                    </div>
                    <span className="text-sm text-slate-500">{alerts.length} items</span>
                </div>
                
                <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                    {filteredAlerts.length === 0 ? (
                        <EmptyState />
                    ) : (
                        filteredAlerts.slice(0, 5).map(alert => (
                            <AlertCard
                                key={alert.id}
                                alert={alert}
                                onAction={handleAction}
                                onDismiss={handleDismiss}
                                expanded={expandedAlerts.has(alert.id)}
                                onToggleExpand={() => toggleExpanded(alert.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        );
    }

    // ============================================
    // FULL VARIANT (Complete view)
    // ============================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Needs Attention</h1>
                    <p className="text-slate-500">Items requiring your action</p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryStat
                    icon={AlertCircle}
                    label="Urgent"
                    value={summaryStats.urgent}
                    color="red"
                    onClick={() => setActiveFilter('all')}
                />
                <SummaryStat
                    icon={AlertTriangle}
                    label="Warnings"
                    value={summaryStats.warning}
                    color="amber"
                    onClick={() => setActiveFilter('all')}
                />
                <SummaryStat
                    icon={Calendar}
                    label="Today's Jobs"
                    value={summaryStats.todaysJobs}
                    color="blue"
                    onClick={() => setActiveFilter('schedule')}
                />
                <SummaryStat
                    icon={DollarSign}
                    label="Pending Revenue"
                    value={formatCurrency(summaryStats.pendingRevenue)}
                    color="emerald"
                    onClick={() => setActiveFilter('quotes')}
                />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveFilter('all')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        activeFilter === 'all' 
                            ? 'bg-slate-800 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    All
                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        activeFilter === 'all' ? 'bg-white text-slate-800' : 'bg-slate-300 text-slate-700'
                    }`}>
                        {categoryCounts.all}
                    </span>
                </button>
                
                {Object.keys(CATEGORY_CONFIG).map(category => (
                    <CategoryPill
                        key={category}
                        category={category}
                        count={categoryCounts[category]}
                        active={activeFilter === category}
                        onClick={() => setActiveFilter(category)}
                    />
                ))}
            </div>

            {/* Alerts List */}
            {filteredAlerts.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="space-y-4">
                    {filteredAlerts.map(alert => (
                        <AlertCard
                            key={alert.id}
                            alert={alert}
                            onAction={handleAction}
                            onDismiss={handleDismiss}
                            expanded={expandedAlerts.has(alert.id)}
                            onToggleExpand={() => toggleExpanded(alert.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NeedsAttention;
