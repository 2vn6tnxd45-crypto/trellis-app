// src/features/quotes/components/QuotesListView.jsx
// ============================================
// QUOTES LIST VIEW
// ============================================
// Displays all quotes with filtering and search

import React, { useState, useMemo } from 'react';
import { 
    FileText, Plus, Search, Clock, CheckCircle, 
    DollarSign, ChevronRight, Eye, XCircle,
    AlertTriangle, Filter
} from 'lucide-react';

// ============================================
// STATUS BADGE
// ============================================
export const QuoteStatusBadge = ({ status }) => {
    const styles = {
        draft: 'bg-slate-100 text-slate-600',
        sent: 'bg-blue-100 text-blue-700',
        viewed: 'bg-purple-100 text-purple-700',
        accepted: 'bg-emerald-100 text-emerald-700',
        declined: 'bg-red-100 text-red-700',
        expired: 'bg-amber-100 text-amber-700',
    };
    
    const labels = {
        draft: 'Draft',
        sent: 'Sent',
        viewed: 'Viewed',
        accepted: 'Accepted',
        declined: 'Declined',
        expired: 'Expired',
    };
    
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || styles.draft}`}>
            {labels[status] || status}
        </span>
    );
};

// ============================================
// STAT CARD
// ============================================
const StatCard = ({ icon: Icon, value, label, iconBg, iconColor }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${iconBg}`}>
                <Icon size={20} className={iconColor} />
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
            </div>
        </div>
    </div>
);

// ============================================
// QUOTE ROW
// ============================================
const QuoteRow = ({ quote, onClick }) => {
    // Format date safely
    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    };
    
    // Check if quote is expiring soon (within 3 days)
    const isExpiringSoon = () => {
        if (!quote.expiresAt || !['sent', 'viewed'].includes(quote.status)) return false;
        const expiresDate = quote.expiresAt.toDate ? quote.expiresAt.toDate() : new Date(quote.expiresAt);
        const daysUntil = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 3 && daysUntil > 0;
    };

    return (
        <div 
            onClick={() => onClick(quote)}
            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group"
        >
            <div className="flex items-center gap-4">
                {/* Quote Icon */}
                <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-emerald-100 transition-colors">
                    <FileText size={20} className="text-slate-400 group-hover:text-emerald-600" />
                </div>
                
                {/* Quote Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-bold text-slate-800 truncate">{quote.title || 'Untitled Quote'}</p>
                        <QuoteStatusBadge status={quote.status} />
                        {isExpiringSoon() && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={12} />
                                Expiring soon
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-sm text-slate-500">
                            {quote.customer?.name || 'No customer'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-400">{quote.quoteNumber}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-400">
                            Created {formatDate(quote.createdAt)}
                        </span>
                        {quote.viewCount > 0 && (
                            <>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-purple-600 flex items-center gap-1">
                                    <Eye size={12} />
                                    {quote.viewCount} view{quote.viewCount !== 1 ? 's' : ''}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Amount & Arrow */}
                <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-800">
                        ${(quote.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {quote.expiresAt && ['sent', 'viewed'].includes(quote.status) && (
                        <p className="text-xs text-slate-400">
                            Expires {formatDate(quote.expiresAt)}
                        </p>
                    )}
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 flex-shrink-0" />
            </div>
        </div>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ onCreateQuote, filter }) => (
    <div className="p-12 text-center">
        <div className="bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-slate-300" />
        </div>
        {filter === 'all' ? (
            <>
                <h3 className="font-bold text-slate-800 text-lg mb-2">No quotes yet</h3>
                <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                    Create your first quote to start winning more jobs and tracking customer proposals.
                </p>
                <button
                    onClick={onCreateQuote}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
                >
                    <Plus size={18} />
                    Create Your First Quote
                </button>
            </>
        ) : (
            <>
                <h3 className="font-bold text-slate-800 text-lg mb-2">No {filter} quotes</h3>
                <p className="text-slate-500">
                    {filter === 'draft' && "You don't have any draft quotes."}
                    {filter === 'sent' && "No quotes are currently awaiting a response."}
                    {filter === 'viewed' && "No quotes have been viewed by customers yet."}
                    {filter === 'accepted' && "No quotes have been accepted yet."}
                    {filter === 'declined' && "Good news! No quotes have been declined."}
                    {filter === 'expired' && "No expired quotes."}
                </p>
            </>
        )}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const QuotesListView = ({ 
    quotes = [],
    loading = false,
    stats = {},
    onCreateQuote,
    onSelectQuote
}) => {
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter quotes based on status and search term
    const filteredQuotes = useMemo(() => {
        return quotes.filter(q => {
            // Status filter
            if (filter !== 'all' && q.status !== filter) return false;
            
            // Search filter
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                const matchesTitle = q.title?.toLowerCase().includes(search);
                const matchesCustomer = q.customer?.name?.toLowerCase().includes(search);
                const matchesNumber = q.quoteNumber?.toLowerCase().includes(search);
                if (!matchesTitle && !matchesCustomer && !matchesNumber) return false;
            }
            
            return true;
        });
    }, [quotes, filter, searchTerm]);
    
    // Calculate stats from quotes if not provided
    const displayStats = useMemo(() => ({
        pending: stats.pending ?? quotes.filter(q => ['sent', 'viewed'].includes(q.status)).length,
        accepted: stats.accepted ?? quotes.filter(q => q.status === 'accepted').length,
        acceptedValue: stats.acceptedValue ?? quotes
            .filter(q => q.status === 'accepted')
            .reduce((sum, q) => sum + (q.total || 0), 0)
    }), [quotes, stats]);

    const filterTabs = [
        { id: 'all', label: 'All' },
        { id: 'draft', label: 'Drafts' },
        { id: 'sent', label: 'Sent' },
        { id: 'viewed', label: 'Viewed' },
        { id: 'accepted', label: 'Accepted' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quotes</h1>
                    <p className="text-slate-500">Create and manage customer quotes</p>
                </div>
                <button 
                    onClick={onCreateQuote}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={18} />
                    New Quote
                </button>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard 
                    icon={Clock}
                    value={displayStats.pending}
                    label="Awaiting Response"
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                />
                <StatCard 
                    icon={CheckCircle}
                    value={displayStats.accepted}
                    label="Accepted This Month"
                    iconBg="bg-emerald-100"
                    iconColor="text-emerald-600"
                />
                <StatCard 
                    icon={DollarSign}
                    value={`$${displayStats.acceptedValue.toLocaleString()}`}
                    label="Won Revenue"
                    iconBg="bg-amber-100"
                    iconColor="text-amber-600"
                />
            </div>
            
            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search quotes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                filter === tab.id 
                                    ? 'bg-white text-slate-800 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Quotes List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-500">Loading quotes...</p>
                    </div>
                ) : filteredQuotes.length === 0 ? (
                    <EmptyState onCreateQuote={onCreateQuote} filter={filter} />
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredQuotes.map(quote => (
                            <QuoteRow 
                                key={quote.id} 
                                quote={quote} 
                                onClick={onSelectQuote}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuotesListView;
