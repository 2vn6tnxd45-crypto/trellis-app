// src/features/jobs/components/completion/CompletionSuccessModal.jsx
// ============================================
// COMPLETION SUCCESS MODAL - Post-acceptance celebration
// ============================================
// Shows after homeowner accepts job completion with summary, rating, and next steps

import React, { useState, useEffect } from 'react';
import {
    CheckCircle, Star, Package, Bell, Shield, Calendar,
    ChevronRight, ExternalLink, MessageSquare, Loader2,
    Sparkles, Home, RefreshCw, X, ArrowRight
} from 'lucide-react';
import { rateContractor } from '../../lib/jobCompletionService';
import toast from 'react-hot-toast';

// Category icon mapping
const CATEGORY_ICONS = {
    'HVAC': '🌡️',
    'Plumbing': '🚿',
    'Electrical': '⚡',
    'Appliances': '🏠',
    'Heating': '🔥',
    'Exterior': '🏡',
    'Service & Repairs': '🔧',
    'default': '📦'
};

// Get emoji for category
const getCategoryEmoji = (category) => {
    // Ensure category is a string (defensive against object fields)
    const categoryStr = typeof category === 'string' ? category : String(category || '');
    return CATEGORY_ICONS[categoryStr] || CATEGORY_ICONS['default'];
};

// Safely convert any value to a displayable string
const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        // Handle Firestore Timestamps
        if (value.toDate) return value.toDate().toLocaleDateString();
        // Handle Date objects
        if (value instanceof Date) return value.toLocaleDateString();
        // For other objects, return empty string to prevent React error #310
        console.warn('[CompletionSuccessModal] Attempted to render object:', value);
        return '';
    }
    return String(value);
};

// Confetti animation component (CSS-based, subtle)
const Confetti = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
            <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-confetti"
                style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5],
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`
                }}
            />
        ))}
        <style>{`
            @keyframes confetti {
                0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            .animate-confetti {
                animation: confetti 3s ease-out forwards;
            }
        `}</style>
    </div>
);

// Star Rating Component
const StarRating = ({ rating, onRatingChange, disabled = false }) => {
    const [hoverRating, setHoverRating] = useState(0);

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => !disabled && onRatingChange(star)}
                    onMouseEnter={() => !disabled && setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    disabled={disabled}
                    className={`transition-transform ${disabled ? 'cursor-default' : 'hover:scale-110'}`}
                >
                    <Star
                        size={32}
                        className={`${
                            star <= (hoverRating || rating)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300'
                        } transition-colors`}
                    />
                </button>
            ))}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const CompletionSuccessModal = ({
    isOpen,
    onClose,
    job,
    importedItems = [],
    importedRecordIds = [],
    contractor,
    userId,
    onNavigateToInventory,
    onBookAgain
}) => {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [isSubmittingRating, setIsSubmittingRating] = useState(false);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const [showConfetti, setShowConfetti] = useState(true);

    // Hide confetti after animation
    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const contractorName = job?.contractorName || contractor?.companyName || 'Your Contractor';
    const jobTitle = job?.title || job?.description || 'Service Job';
    const jobTotal = job?.total || 0;
    const completionDate = job?.completion?.submittedAt?.toDate?.()
        || (job?.completion?.submittedAt ? new Date(job.completion.submittedAt) : new Date());

    // Check if already rated
    const alreadyRated = !!job?.ratings?.homeownerToContractor;

    // Handle rating submission
    const handleSubmitRating = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmittingRating(true);

        try {
            await rateContractor(job.id, job.contractorId, userId, {
                overall: rating,
                quality: rating,
                timeliness: rating,
                communication: rating,
                value: rating,
                review
            });

            setRatingSubmitted(true);
            toast.success('Thanks for your feedback!');
        } catch (error) {
            console.error('Error submitting rating:', error);
            toast.error('Failed to submit rating');
        } finally {
            setIsSubmittingRating(false);
        }
    };

    // Handle navigation to inventory item
    const handleViewItem = (recordId) => {
        if (onNavigateToInventory) {
            onNavigateToInventory(recordId);
        } else {
            // Default: navigate via URL
            window.location.href = `/app?tab=inventory&highlight=${recordId}`;
        }
        onClose();
    };

    // Handle view all items
    const handleViewAllItems = () => {
        if (onNavigateToInventory) {
            onNavigateToInventory();
        } else {
            window.location.href = '/app?tab=inventory';
        }
        onClose();
    };

    // Handle book again
    const handleBookAgain = () => {
        if (onBookAgain) {
            onBookAgain(job.contractorId, contractorName);
        } else {
            // Default: open new request with contractor pre-selected
            window.location.href = `/app?tab=requests&contractorId=${job.contractorId}`;
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Confetti */}
                {showConfetti && <Confetti />}

                {/* Success Header */}
                <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-8 text-center">
                    {/* Animated checkmark */}
                    <div className="relative inline-block mb-4">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce-once">
                            <CheckCircle size={48} className="text-emerald-500" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-md">
                            <Sparkles size={16} className="text-white" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">Job Complete!</h2>
                    <p className="text-emerald-100">
                        Your home inventory has been updated
                    </p>

                    <style>{`
                        @keyframes bounce-once {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.1); }
                        }
                        .animate-bounce-once {
                            animation: bounce-once 0.5s ease-out;
                        }
                    `}</style>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Job Summary Card */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                                <CheckCircle size={24} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate">{jobTitle}</h3>
                                <p className="text-sm text-slate-500">{contractorName}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        {completionDate.toLocaleDateString()}
                                    </span>
                                    {jobTotal > 0 && (
                                        <span className="font-medium text-emerald-600">
                                            ${jobTotal.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Added Section */}
                    {importedItems.length > 0 && (
                        <div>
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Package size={18} className="text-emerald-600" />
                                Added to Your Home Inventory
                            </h3>

                            <div className="space-y-2">
                                {importedItems.slice(0, 3).map((item, index) => (
                                    <button
                                        key={item.id || index}
                                        onClick={() => importedRecordIds[index] && handleViewItem(importedRecordIds[index])}
                                        className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl transition-colors group text-left"
                                    >
                                        <span className="text-xl">{getCategoryEmoji(item.category)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 truncate group-hover:text-emerald-700">
                                                {safeString(item.item) || safeString(item.description) || 'Item'}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {[safeString(item.brand), safeString(item.model)].filter(Boolean).join(' • ') || safeString(item.category)}
                                            </p>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-600" />
                                    </button>
                                ))}

                                {importedItems.length > 3 && (
                                    <button
                                        onClick={handleViewAllItems}
                                        className="w-full py-2 text-sm text-emerald-600 font-medium hover:text-emerald-700"
                                    >
                                        View all {importedItems.length} items →
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* What's Next Section */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                        <h3 className="font-bold text-slate-800 mb-3">What's Next</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Bell size={16} className="text-amber-600" />
                                </div>
                                <p className="text-sm text-slate-600">
                                    <strong className="text-slate-800">Maintenance reminders</strong> will notify you when service is due
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Shield size={16} className="text-blue-600" />
                                </div>
                                <p className="text-sm text-slate-600">
                                    <strong className="text-slate-800">Warranty info</strong> has been saved for easy reference
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Rating Section */}
                    {!alreadyRated && !ratingSubmitted && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                            <h3 className="font-bold text-slate-800 mb-2">
                                How was your experience?
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Rate your experience with {contractorName}
                            </p>

                            {/* Star Rating */}
                            <div className="flex justify-center mb-4">
                                <StarRating
                                    rating={rating}
                                    onRatingChange={setRating}
                                    disabled={isSubmittingRating}
                                />
                            </div>

                            {/* Review text (optional, shown after selecting stars) */}
                            {rating > 0 && (
                                <div className="space-y-3">
                                    <textarea
                                        value={review}
                                        onChange={(e) => setReview(e.target.value)}
                                        placeholder="Share your experience (optional)..."
                                        rows={2}
                                        disabled={isSubmittingRating}
                                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none disabled:opacity-50"
                                    />
                                    <button
                                        onClick={handleSubmitRating}
                                        disabled={isSubmittingRating}
                                        className="w-full py-2.5 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingRating ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Star size={16} />
                                                Submit Rating
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rating Submitted Confirmation */}
                    {ratingSubmitted && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
                            <CheckCircle size={24} className="text-emerald-600 mx-auto mb-2" />
                            <p className="font-medium text-emerald-800">Thanks for your feedback!</p>
                            <p className="text-sm text-emerald-600 mt-1">
                                Your rating helps others find great contractors
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 space-y-3">
                    {/* Primary: Done */}
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Home size={18} />
                        Done
                    </button>

                    {/* Secondary actions */}
                    <div className="flex gap-2">
                        {importedItems.length > 0 && (
                            <button
                                onClick={handleViewAllItems}
                                className="flex-1 py-2.5 text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <Package size={16} />
                                View Inventory
                            </button>
                        )}
                        <button
                            onClick={handleBookAgain}
                            className="flex-1 py-2.5 text-emerald-600 font-medium rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Book Again
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompletionSuccessModal;
