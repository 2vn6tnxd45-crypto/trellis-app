// src/features/dashboard/components/CompletionReviewBanner.jsx
// ============================================
// COMPLETION REVIEW BANNER - Prominent review reminder
// ============================================
// Shows at top of dashboard when homeowner has jobs pending completion review

import React, { useState, useMemo } from 'react';
import {
    ClipboardCheck, Clock, ChevronRight, Package, AlertTriangle,
    CheckCircle, Building2, X, RotateCcw
} from 'lucide-react';
import { CountdownTimer } from '../../../components/common/CountdownTimer';

// Helper to get time remaining info
const getTimeRemaining = (autoCloseAt) => {
    if (!autoCloseAt) return null;

    const target = autoCloseAt?.toDate ? autoCloseAt.toDate() : new Date(autoCloseAt);
    const now = new Date();
    const diffMs = target - now;

    if (diffMs <= 0) return { isExpired: true };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return { days, hours, isExpired: false };
};

// Helper to get urgency level
const getUrgencyLevel = (autoCloseAt) => {
    const timeRemaining = getTimeRemaining(autoCloseAt);
    if (!timeRemaining || timeRemaining.isExpired) return 'expired';
    if (timeRemaining.days < 1) return 'critical'; // Less than 24 hours
    if (timeRemaining.days < 2) return 'urgent';   // Less than 2 days
    if (timeRemaining.days < 4) return 'warning';  // Less than 4 days
    return 'normal';
};

// Item preview component
const ItemPreview = ({ items, maxShow = 3 }) => {
    if (!items || items.length === 0) {
        return (
            <p className="text-sm text-slate-500 italic">No items to add</p>
        );
    }

    const displayItems = items.slice(0, maxShow);
    const remainingCount = items.length - maxShow;

    return (
        <div className="space-y-1.5">
            {displayItems.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2 text-sm">
                    <Package size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-slate-700 truncate">
                        {item.item || item.description || 'Item'}
                    </span>
                    {item.brand && (
                        <span className="text-slate-400 text-xs truncate">
                            ({item.brand})
                        </span>
                    )}
                </div>
            ))}
            {remainingCount > 0 && (
                <p className="text-xs text-slate-500 ml-6">
                    +{remainingCount} more item{remainingCount !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
};

// Single job card within banner
const JobReviewCard = ({ job, onReviewClick, onRequestRevision }) => {
    const completion = job.completion || {};
    const itemsToImport = completion.itemsToImport || [];
    const autoCloseAt = completion.autoCloseAt;
    const urgencyLevel = getUrgencyLevel(autoCloseAt);

    const contractorName = job.contractorName || job.contractor?.companyName || 'Contractor';

    // Urgency-based border styles
    const borderStyles = {
        critical: 'border-l-4 border-l-red-500',
        urgent: 'border-l-4 border-l-amber-500',
        warning: 'border-l-4 border-l-amber-400',
        normal: 'border-l-4 border-l-emerald-500',
        expired: 'border-l-4 border-l-red-500'
    };

    return (
        <div className={`bg-white rounded-xl p-4 shadow-sm ${borderStyles[urgencyLevel]}`}>
            {/* Header with contractor */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">
                        {job.title || job.description || 'Service Job'}
                    </h4>
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                        <Building2 size={12} />
                        <span className="truncate">{contractorName}</span>
                    </div>
                </div>

                {/* Countdown */}
                <CountdownTimer
                    targetDate={autoCloseAt}
                    format="short"
                    variant="badge"
                    urgencyThreshold={2}
                    expiredText="Expired"
                />
            </div>

            {/* Items preview */}
            <div className="mb-3 p-2 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 font-medium mb-2 flex items-center gap-1">
                    <Package size={12} />
                    {itemsToImport.length} item{itemsToImport.length !== 1 ? 's' : ''} ready to add
                </p>
                <ItemPreview items={itemsToImport} maxShow={2} />
            </div>

            {/* Auto-close warning */}
            {urgencyLevel === 'critical' || urgencyLevel === 'urgent' ? (
                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg mb-3 border border-amber-200">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                        Items will be auto-added if you don't review in time
                    </p>
                </div>
            ) : (
                <p className="text-xs text-slate-500 mb-3">
                    Items will be automatically added to your home inventory if not reviewed
                </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => onReviewClick(job)}
                    className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                    <CheckCircle size={16} />
                    Review & Approve
                </button>
                <button
                    onClick={() => onRequestRevision(job)}
                    className="px-4 py-2.5 text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    title="Request Revision"
                >
                    <RotateCcw size={16} />
                </button>
            </div>
        </div>
    );
};

export const CompletionReviewBanner = ({ jobs = [], onReviewClick, onRequestRevision }) => {
    const [dismissed, setDismissed] = useState(false);

    // Check session storage on mount
    React.useEffect(() => {
        const wasDismissed = sessionStorage.getItem('completionReviewBannerDismissed');
        if (wasDismissed === 'true') {
            setDismissed(true);
        }
    }, []);

    // Filter to only pending_completion jobs
    const pendingJobs = useMemo(() => {
        return jobs.filter(job => job.status === 'pending_completion');
    }, [jobs]);

    // Sort by auto-close date (soonest first)
    const sortedJobs = useMemo(() => {
        return [...pendingJobs].sort((a, b) => {
            const aClose = a.completion?.autoCloseAt?.toDate?.() || new Date(a.completion?.autoCloseAt);
            const bClose = b.completion?.autoCloseAt?.toDate?.() || new Date(b.completion?.autoCloseAt);
            return aClose - bClose;
        });
    }, [pendingJobs]);

    // Check if any are urgent
    const hasUrgent = sortedJobs.some(job => {
        const level = getUrgencyLevel(job.completion?.autoCloseAt);
        return level === 'critical' || level === 'urgent';
    });

    // Total items count
    const totalItems = sortedJobs.reduce((sum, job) => {
        return sum + (job.completion?.itemsToImport?.length || 0);
    }, 0);

    // Don't render if no jobs or dismissed
    if (pendingJobs.length === 0 || dismissed) {
        return null;
    }

    // Handle dismiss (session-only)
    const handleDismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('completionReviewBannerDismissed', 'true');
    };



    // Single job view
    if (sortedJobs.length === 1) {
        const job = sortedJobs[0];
        const urgencyLevel = getUrgencyLevel(job.completion?.autoCloseAt);

        const bgStyles = {
            critical: 'bg-gradient-to-br from-red-50 to-amber-50 border-red-200',
            urgent: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200',
            warning: 'bg-emerald-50 border-emerald-200',
            normal: 'bg-emerald-50 border-emerald-200',
            expired: 'bg-red-50 border-red-200'
        };

        return (
            <div className={`relative rounded-2xl border-2 p-5 mb-6 ${bgStyles[urgencyLevel]}`}>
                {/* Dismiss button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-lg transition-colors"
                    title="Dismiss for this session"
                >
                    <X size={16} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${hasUrgent ? 'bg-amber-100' : 'bg-emerald-100'
                        }`}>
                        <ClipboardCheck size={24} className={
                            hasUrgent ? 'text-amber-600' : 'text-emerald-600'
                        } />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">
                            Job Completed - Review Required
                        </h3>
                        <p className="text-sm text-slate-600">
                            {totalItems} item{totalItems !== 1 ? 's' : ''} ready to add to your home record
                        </p>
                    </div>
                </div>

                <JobReviewCard
                    job={job}
                    onReviewClick={onReviewClick}
                    onRequestRevision={onRequestRevision}
                />
            </div>
        );
    }

    // Multiple jobs view
    return (
        <div className={`relative rounded-2xl border-2 p-5 mb-6 ${hasUrgent
            ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200'
            }`}>
            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-lg transition-colors"
                title="Dismiss for this session"
            >
                <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${hasUrgent ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}>
                    <ClipboardCheck size={24} className={
                        hasUrgent ? 'text-amber-600' : 'text-emerald-600'
                    } />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">
                        {sortedJobs.length} Jobs Completed - Review Required
                    </h3>
                    <p className="text-sm text-slate-600">
                        {totalItems} total item{totalItems !== 1 ? 's' : ''} ready to add to your home records
                    </p>
                </div>
            </div>

            {/* Job cards */}
            <div className="space-y-3">
                {sortedJobs.slice(0, 3).map(job => (
                    <JobReviewCard
                        key={job.id}
                        job={job}
                        onReviewClick={onReviewClick}
                        onRequestRevision={onRequestRevision}
                    />
                ))}

                {sortedJobs.length > 3 && (
                    <button
                        onClick={() => onReviewClick(sortedJobs[0])}
                        className="w-full py-2.5 text-emerald-600 font-medium rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                    >
                        View All {sortedJobs.length} Jobs
                        <ChevronRight size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default CompletionReviewBanner;
