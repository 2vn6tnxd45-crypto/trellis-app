// src/features/archive/HomeArchive.jsx
// ============================================
// HOME ARCHIVE COMPONENT
// ============================================
// Displays historical/closed items for homeowners:
// - Completed jobs (with ability to view details)
// - Declined quotes
// - Expired quotes
// - Canceled jobs
//
// This is the homeowner's "history vault" - valuable for
// resale, insurance claims, or tracking home spending.

import React, { useState, useMemo } from 'react';
import {
    Archive,
    CheckCircle,
    XCircle,
    Clock,
    Ban,
    FileText,
    Briefcase,
    DollarSign,
    Calendar,
    ChevronRight,
    ChevronDown,
    Filter,
    Search,
    TrendingUp,
    User,
    MapPin,
    Phone,
    Mail,
    MessageSquare,
    ExternalLink,
    Loader2,
    Package,
    AlertTriangle
} from 'lucide-react';
import { useHomeArchive, ARCHIVE_TYPES } from './useHomeArchive';
import { RebookProButton } from '../../components/common/RebookProButton';

// ============================================
// HELPERS
// ============================================
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(amount);
};

const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
};

const formatRelativeDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
};

// ============================================
// FILTER TABS
// ============================================
const FILTERS = [
    { id: 'all', label: 'All History', icon: Archive },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
    { id: 'declined', label: 'Declined', icon: XCircle },
    { id: 'expired', label: 'Expired', icon: Clock },
    { id: 'canceled', label: 'Canceled', icon: Ban },
];

// ============================================
// STATUS BADGE COMPONENT
// ============================================
const StatusBadge = ({ type }) => {
    const config = {
        [ARCHIVE_TYPES.COMPLETED_JOB]: {
            label: 'Completed',
            icon: CheckCircle,
            className: 'bg-emerald-100 text-emerald-700 border-emerald-200'
        },
        [ARCHIVE_TYPES.CANCELED_JOB]: {
            label: 'Canceled',
            icon: Ban,
            className: 'bg-slate-100 text-slate-600 border-slate-200'
        },
        [ARCHIVE_TYPES.DECLINED_QUOTE]: {
            label: 'Declined',
            icon: XCircle,
            className: 'bg-red-50 text-red-600 border-red-200'
        },
        [ARCHIVE_TYPES.EXPIRED_QUOTE]: {
            label: 'Expired',
            icon: Clock,
            className: 'bg-amber-50 text-amber-600 border-amber-200'
        },
        [ARCHIVE_TYPES.ACCEPTED_QUOTE]: {
            label: 'Accepted',
            icon: CheckCircle,
            className: 'bg-blue-50 text-blue-600 border-blue-200'
        },
    };

    const { label, icon: Icon, className } = config[type] || config[ARCHIVE_TYPES.COMPLETED_JOB];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
            <Icon size={10} />
            {label}
        </span>
    );
};

// ============================================
// ARCHIVE ITEM CARD
// ============================================
const ArchiveItemCard = ({ 
    item, 
    userId, 
    userProfile, 
    propertyAddress,
    onViewDetails 
}) => {
    const [expanded, setExpanded] = useState(false);
    
    const isJob = item.itemType === 'job';
    const isQuote = item.itemType === 'quote';
    const isCompleted = item.archiveType === ARCHIVE_TYPES.COMPLETED_JOB;
    
    // Get the title
    const title = item.title || item.description || (isQuote ? `Quote #${item.quoteNumber}` : 'Service');
    
    // Get contractor info
    const contractorName = item.contractorName || item.contractor || 'Contractor';
    const contractorId = item.contractorId;
    const contractorPhone = item.contractorPhone;
    const contractorEmail = item.contractorEmail;
    
    // Get the relevant date
    const dateLabel = isCompleted ? 'Completed' : 
                      item.archiveType === ARCHIVE_TYPES.DECLINED_QUOTE ? 'Declined' :
                      item.archiveType === ARCHIVE_TYPES.EXPIRED_QUOTE ? 'Expired' :
                      item.archiveType === ARCHIVE_TYPES.CANCELED_JOB ? 'Canceled' : 'Closed';
    
    const relevantDate = item.completedAt || item.declinedAt || item.cancelledAt || item.updatedAt;

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            {/* Main Row */}
            <div 
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Icon */}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-emerald-100' : 
                    item.archiveType === ARCHIVE_TYPES.DECLINED_QUOTE ? 'bg-red-50' :
                    item.archiveType === ARCHIVE_TYPES.EXPIRED_QUOTE ? 'bg-amber-50' :
                    'bg-slate-100'
                }`}>
                    {isJob ? (
                        <Briefcase size={20} className={
                            isCompleted ? 'text-emerald-600' : 'text-slate-400'
                        } />
                    ) : (
                        <FileText size={20} className={
                            item.archiveType === ARCHIVE_TYPES.DECLINED_QUOTE ? 'text-red-500' :
                            item.archiveType === ARCHIVE_TYPES.EXPIRED_QUOTE ? 'text-amber-500' :
                            'text-slate-400'
                        } />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-800 truncate">{title}</h4>
                        <StatusBadge type={item.archiveType} />
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                        {contractorName} • {dateLabel} {formatRelativeDate(relevantDate)}
                    </p>
                </div>

                {/* Amount & Chevron */}
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                    {item.total > 0 && (
                        <p className={`font-bold ${isCompleted ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {formatCurrency(item.total)}
                        </p>
                    )}
                    <ChevronDown 
                        size={20} 
                        className={`text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                                {isJob ? 'Job #' : 'Quote #'}
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                                {item.jobNumber || item.quoteNumber || '—'}
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                                {dateLabel}
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                                {formatDate(relevantDate)}
                            </p>
                        </div>
                    </div>

                    {/* Line Items Preview (if available) */}
                    {item.lineItems && item.lineItems.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                                Items ({item.lineItems.length})
                            </p>
                            <div className="space-y-1">
                                {item.lineItems.slice(0, 3).map((lineItem, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-slate-600 truncate flex-1">
                                            {lineItem.description || 'Item'}
                                        </span>
                                        <span className="text-slate-800 font-medium ml-2">
                                            {formatCurrency((lineItem.quantity || 1) * (lineItem.unitPrice || 0))}
                                        </span>
                                    </div>
                                ))}
                                {item.lineItems.length > 3 && (
                                    <p className="text-xs text-slate-400">
                                        +{item.lineItems.length - 3} more items
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Contractor Section with Rebook Button */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold mb-1">
                                    {isCompleted ? 'Work Performed By' : 'Quote From'}
                                </p>
                                <p className="text-sm font-bold text-slate-800">{contractorName}</p>
                                {contractorPhone && (
                                    <p className="text-xs text-slate-500 mt-0.5">{contractorPhone}</p>
                                )}
                            </div>
                            
                            {/* Rebook Button - only for completed jobs */}
                            {isCompleted && contractorName && (
                                <RebookProButton
                                    contractor={contractorName}
                                    contractorId={contractorId}
                                    contractorPhone={contractorPhone}
                                    contractorEmail={contractorEmail}
                                    itemName={title}
                                    userId={userId}
                                    userProfile={userProfile}
                                    propertyAddress={propertyAddress}
                                    variant="default"
                                />
                            )}
                        </div>
                        
                        {/* Quick contact for non-completed items */}
                        {!isCompleted && (contractorPhone || contractorEmail) && (
                            <div className="flex gap-2 mt-3">
                                {contractorPhone && (
                                    <a 
                                        href={`tel:${contractorPhone}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                                    >
                                        <Phone size={12} />
                                        Call
                                    </a>
                                )}
                                {contractorEmail && (
                                    <a 
                                        href={`mailto:${contractorEmail}`}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                                    >
                                        <Mail size={12} />
                                        Email
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Decline Reason (if applicable) */}
                    {item.declineReason && (
                        <div className="mt-4 bg-red-50 rounded-lg p-3 border border-red-100">
                            <p className="text-[10px] uppercase tracking-wider text-red-500 font-bold mb-1">
                                Decline Reason
                            </p>
                            <p className="text-sm text-red-700">{item.declineReason}</p>
                        </div>
                    )}

                    {/* Cancellation Reason (if applicable) */}
                    {item.cancellationReason && (
                        <div className="mt-4 bg-slate-100 rounded-lg p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                                Cancellation Reason
                            </p>
                            <p className="text-sm text-slate-700">{item.cancellationReason}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// STATS CARD
// ============================================
const StatCard = ({ icon: Icon, value, label, color = 'emerald' }) => {
    const colors = {
        emerald: 'bg-emerald-100 text-emerald-600',
        blue: 'bg-blue-100 text-blue-600',
        red: 'bg-red-100 text-red-600',
        amber: 'bg-amber-100 text-amber-600',
        slate: 'bg-slate-100 text-slate-600',
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colors[color]}`}>
                    <Icon size={18} />
                </div>
                <div>
                    <p className="text-xl font-bold text-slate-800">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ filter }) => {
    const messages = {
        all: {
            title: 'No history yet',
            subtitle: 'Your completed jobs, quotes, and evaluations will appear here.'
        },
        completed: {
            title: 'No completed jobs',
            subtitle: 'Jobs you complete with contractors will be saved here.'
        },
        declined: {
            title: 'No declined quotes',
            subtitle: "Quotes you've passed on will appear here for reference."
        },
        expired: {
            title: 'No expired quotes',
            subtitle: 'Quotes that timed out will be listed here.'
        },
        canceled: {
            title: 'No canceled jobs',
            subtitle: 'Jobs that were canceled will appear here.'
        },
    };

    const { title, subtitle } = messages[filter] || messages.all;

    return (
        <div className="text-center py-12">
            <div className="bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Archive className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="font-bold text-slate-700 text-lg mb-2">{title}</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">{subtitle}</p>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const HomeArchive = ({ 
    userId, 
    userProfile, 
    propertyAddress,
    variant = 'full' // 'full' | 'compact' | 'section'
}) => {
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    const { 
        allItems, 
        completedJobs, 
        canceledJobs, 
        declinedQuotes, 
        expiredQuotes,
        stats,
        loading, 
        error 
    } = useHomeArchive(userId);

    // Filter items based on active filter and search
    const filteredItems = useMemo(() => {
        let items = allItems;
        
        // Apply filter
        switch (activeFilter) {
            case 'completed':
                items = items.filter(i => i.archiveType === ARCHIVE_TYPES.COMPLETED_JOB);
                break;
            case 'declined':
                items = items.filter(i => i.archiveType === ARCHIVE_TYPES.DECLINED_QUOTE);
                break;
            case 'expired':
                items = items.filter(i => i.archiveType === ARCHIVE_TYPES.EXPIRED_QUOTE);
                break;
            case 'canceled':
                items = items.filter(i => i.archiveType === ARCHIVE_TYPES.CANCELED_JOB);
                break;
            default:
                // 'all' - no filter
                break;
        }

        // Apply search
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            items = items.filter(item => 
                item.title?.toLowerCase().includes(search) ||
                item.description?.toLowerCase().includes(search) ||
                item.contractorName?.toLowerCase().includes(search) ||
                item.quoteNumber?.toLowerCase().includes(search) ||
                item.jobNumber?.toLowerCase().includes(search)
            );
        }

        return items;
    }, [allItems, activeFilter, searchTerm]);

    // Get counts for filter badges
    const filterCounts = useMemo(() => ({
        all: allItems.length,
        completed: completedJobs.length,
        declined: declinedQuotes.length,
        expired: expiredQuotes.length,
        canceled: canceledJobs.length,
    }), [allItems, completedJobs, declinedQuotes, expiredQuotes, canceledJobs]);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    // Compact variant (for dashboard section)
    if (variant === 'section') {
        if (allItems.length === 0) return null;
        
        return (
            <div className="space-y-3">
                {/* Quick Stats */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                        {stats.totalItems} items in history
                    </span>
                    {stats.totalSpent > 0 && (
                        <span className="text-emerald-600 font-medium">
                            {formatCurrency(stats.totalSpent)} spent
                        </span>
                    )}
                </div>
                
                {/* Recent 3 items */}
                <div className="space-y-2">
                    {filteredItems.slice(0, 3).map(item => (
                        <ArchiveItemCard
                            key={`${item.itemType}-${item.id}`}
                            item={item}
                            userId={userId}
                            userProfile={userProfile}
                            propertyAddress={propertyAddress}
                        />
                    ))}
                </div>
                
                {allItems.length > 3 && (
                    <p className="text-center text-sm text-slate-400">
                        +{allItems.length - 3} more in history
                    </p>
                )}
            </div>
        );
    }

    // Full variant
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <Archive className="text-emerald-600" />
                    History & Archive
                </h2>
                <p className="text-slate-500 mt-1">
                    Your complete record of jobs, quotes, and evaluations
                </p>
            </div>

            {/* Stats Row */}
            {stats.totalItems > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard 
                        icon={CheckCircle} 
                        value={stats.completedJobs} 
                        label="Completed Jobs" 
                        color="emerald" 
                    />
                    <StatCard 
                        icon={DollarSign} 
                        value={formatCurrency(stats.totalSpent)} 
                        label="Total Spent" 
                        color="blue" 
                    />
                    <StatCard 
                        icon={XCircle} 
                        value={stats.declinedQuotes} 
                        label="Declined Quotes" 
                        color="red" 
                    />
                    <StatCard 
                        icon={Clock} 
                        value={stats.expiredQuotes + stats.canceledJobs} 
                        label="Expired/Canceled" 
                        color="amber" 
                    />
                </div>
            )}

            {/* Search & Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search history..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-200 rounded-xl outline-none text-sm transition-all"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {FILTERS.map(filter => {
                        const count = filterCounts[filter.id] || 0;
                        const isActive = activeFilter === filter.id;
                        const Icon = filter.icon;
                        
                        return (
                            <button
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                    isActive
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Icon size={14} />
                                {filter.label}
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                        isActive 
                                            ? 'bg-emerald-200 text-emerald-800' 
                                            : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Items List */}
            {filteredItems.length === 0 ? (
                <EmptyState filter={activeFilter} />
            ) : (
                <div className="space-y-3">
                    {filteredItems.map(item => (
                        <ArchiveItemCard
                            key={`${item.itemType}-${item.id}`}
                            item={item}
                            userId={userId}
                            userProfile={userProfile}
                            propertyAddress={propertyAddress}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomeArchive;
