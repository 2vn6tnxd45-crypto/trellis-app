// src/features/dashboard/components/ActionRequiredBanner.jsx
// ============================================
// ACTION REQUIRED BANNER - Prominent quote review notification
// ============================================
// Displays at top of dashboard when homeowner has quotes needing attention

import React, { useState, useEffect } from 'react';
import { Bell, FileText, ChevronRight, X, Clock } from 'lucide-react';

// Helper to format currency
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Helper to get days until expiry
const getDaysUntilExpiry = (validUntil) => {
    if (!validUntil) return null;
    const expiryDate = new Date(validUntil);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
};

// Helper to get contractor initials
const getInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

export const ActionRequiredBanner = ({ quotes = [], onQuoteClick }) => {
    const [dismissed, setDismissed] = useState(false);

    // Check sessionStorage on mount for dismissal state
    useEffect(() => {
        const isDismissed = sessionStorage.getItem('quotesBannerDismissed') === 'true';
        setDismissed(isDismissed);
    }, []);

    // Filter to only actionable quotes (sent or viewed)
    const actionableQuotes = quotes.filter(q => ['sent', 'viewed'].includes(q.status));

    // Don't render if no actionable quotes or dismissed
    if (actionableQuotes.length === 0 || dismissed) {
        return null;
    }

    const handleDismiss = (e) => {
        e.stopPropagation();
        sessionStorage.setItem('quotesBannerDismissed', 'true');
        setDismissed(true);
    };

    const handleQuoteClick = (quote) => {
        if (onQuoteClick) {
            onQuoteClick(quote);
        } else {
            // Default: navigate to quote URL
            window.location.href = `/app/?quote=${quote.contractorId}_${quote.id}`;
        }
    };

    // Single quote view
    if (actionableQuotes.length === 1) {
        const quote = actionableQuotes[0];
        const daysLeft = getDaysUntilExpiry(quote.validUntil);
        const isNew = quote.status === 'sent';
        const contractorName = quote.contractorName || quote.contractor?.companyName || 'Contractor';

        return (
            <div className="relative bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Dismiss button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-full transition-colors"
                    title="Dismiss for this session"
                >
                    <X size={16} />
                </button>

                <div className="flex items-start gap-4">
                    {/* Pulsing indicator + icon */}
                    <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Bell className="w-6 h-6 text-amber-600" />
                        </div>
                        {/* Pulsing dot */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-amber-900">
                                {isNew ? 'New Quote Received!' : 'Quote Waiting for Review'}
                            </h3>
                            {isNew && (
                                <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                                    New
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-amber-700 mb-2">
                            {/* Contractor avatar */}
                            {quote.contractorLogo ? (
                                <img
                                    src={quote.contractorLogo}
                                    alt={contractorName}
                                    className="w-5 h-5 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-[10px] font-bold text-amber-700">
                                    {getInitials(contractorName)}
                                </div>
                            )}
                            <span className="font-medium">{contractorName}</span>
                            <span className="text-amber-400">|</span>
                            <span>{quote.title}</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-lg font-bold text-amber-800">
                                {formatCurrency(quote.total || 0)}
                            </span>
                            {daysLeft && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                                    <Clock size={12} />
                                    Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Action button */}
                    <button
                        onClick={() => handleQuoteClick(quote)}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                    >
                        Review Quote
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // Multiple quotes view
    return (
        <div className="relative bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-full transition-colors"
                title="Dismiss for this session"
            >
                <X size={16} />
            </button>

            <div className="flex items-start gap-4">
                {/* Pulsing indicator + icon */}
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Bell className="w-6 h-6 text-amber-600" />
                    </div>
                    {/* Badge with count */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center animate-pulse">
                        <span className="text-[10px] font-bold text-white">{actionableQuotes.length}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-8">
                    <h3 className="font-bold text-amber-900 mb-2">
                        You have {actionableQuotes.length} quotes to review
                    </h3>

                    {/* Quote list preview */}
                    <div className="space-y-2">
                        {actionableQuotes.slice(0, 3).map((quote) => {
                            const contractorName = quote.contractorName || quote.contractor?.companyName || 'Contractor';
                            const isNew = quote.status === 'sent';
                            const daysLeft = getDaysUntilExpiry(quote.validUntil);

                            return (
                                <button
                                    key={quote.id}
                                    onClick={() => handleQuoteClick(quote)}
                                    className="w-full flex items-center gap-3 p-2 bg-white/80 hover:bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition-colors text-left group"
                                >
                                    {/* Contractor avatar */}
                                    {quote.contractorLogo ? (
                                        <img
                                            src={quote.contractorLogo}
                                            alt={contractorName}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-xs font-bold text-amber-700">
                                            {getInitials(contractorName)}
                                        </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-amber-800 truncate">
                                                {quote.title}
                                            </span>
                                            {isNew && (
                                                <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full uppercase">
                                                    New
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-amber-600">
                                            <span>{contractorName}</span>
                                            {daysLeft && (
                                                <>
                                                    <span className="text-amber-300">|</span>
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock size={10} />
                                                        {daysLeft}d left
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <span className="font-bold text-amber-700">
                                        {formatCurrency(quote.total || 0)}
                                    </span>

                                    <ChevronRight size={16} className="text-amber-400 group-hover:text-amber-600 transition-colors" />
                                </button>
                            );
                        })}

                        {actionableQuotes.length > 3 && (
                            <p className="text-xs text-amber-600 text-center pt-1">
                                +{actionableQuotes.length - 3} more quote{actionableQuotes.length - 3 !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionRequiredBanner;
