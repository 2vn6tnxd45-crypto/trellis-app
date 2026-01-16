// src/features/ratings/RatingPromptCard.jsx
// ============================================
// RATING PROMPT CARD
// ============================================
// Prompts homeowner to rate completed jobs

import React, { useState } from 'react';
import { Star, ChevronDown, ChevronUp, CheckCircle, X, Building2 } from 'lucide-react';
import { rateContractor, dismissRatingPrompt } from '../jobs/lib/jobCompletionService';
import toast from 'react-hot-toast';

/**
 * Interactive star rating component
 */
const StarRating = ({ value, onChange, size = 24, readOnly = false }) => {
    const [hoverValue, setHoverValue] = useState(0);

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= (hoverValue || value);
                return (
                    <button
                        key={star}
                        type="button"
                        disabled={readOnly}
                        onClick={() => !readOnly && onChange(star)}
                        onMouseEnter={() => !readOnly && setHoverValue(star)}
                        onMouseLeave={() => !readOnly && setHoverValue(0)}
                        className={`transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                    >
                        <Star
                            size={size}
                            className={`transition-colors ${
                                isFilled
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-300'
                            }`}
                        />
                    </button>
                );
            })}
        </div>
    );
};

/**
 * RatingPromptCard - Prompts for rating a completed job
 *
 * @param {Object} props
 * @param {Object} props.job - Completed job object
 * @param {Function} props.onRate - Callback when rating submitted
 * @param {Function} props.onDismiss - Callback when user dismisses
 */
export const RatingPromptCard = ({ job, onRate, onDismiss }) => {
    const [rating, setRating] = useState(0);
    const [showComment, setShowComment] = useState(false);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);

    // Get contractor info
    const contractorName = job?.contractorName
        || job?.contractorCompany
        || job?.contractor?.companyName
        || 'Contractor';

    const contractorInitial = contractorName.charAt(0).toUpperCase();

    // Get job info
    const jobTitle = job?.title || job?.description || 'Service';
    const completedAt = job?.completedAt || job?.completion?.completedAt;
    const completedDate = completedAt
        ? new Date(completedAt?.toDate ? completedAt.toDate() : completedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        })
        : 'Recently';

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        try {
            await rateContractor(
                job.id,
                job.contractorId,
                job.createdBy,
                {
                    overall: rating,
                    review: comment.trim()
                }
            );

            setSubmitted(true);
            toast.success('Thanks for your feedback!');

            // Notify parent after brief delay for animation
            setTimeout(() => {
                onRate?.(job.id, rating);
            }, 1500);

        } catch (error) {
            console.error('Error submitting rating:', error);
            toast.error('Failed to submit rating');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDismiss = async () => {
        setIsDismissing(true);
        try {
            await dismissRatingPrompt(job.id);
            onDismiss?.(job.id);
        } catch (error) {
            console.error('Error dismissing:', error);
            // Still call onDismiss to hide the card
            onDismiss?.(job.id);
        } finally {
            setIsDismissing(false);
        }
    };

    // Show success state
    if (submitted) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-full">
                        <CheckCircle className="text-emerald-600" size={20} />
                    </div>
                    <div>
                        <p className="font-bold text-emerald-800">Thanks for your feedback!</p>
                        <p className="text-sm text-emerald-600">
                            Your rating helps other homeowners find great contractors.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    {/* Contractor Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {contractorInitial}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800">{contractorName}</p>
                        </div>
                        <p className="text-xs text-slate-500">
                            {jobTitle} • Completed {completedDate}
                        </p>
                    </div>
                </div>

                {/* Dismiss Button */}
                <button
                    onClick={handleDismiss}
                    disabled={isDismissing}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Maybe later"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Rating Prompt */}
            <div className="text-center py-3">
                <p className="text-sm font-medium text-slate-700 mb-3">
                    How was your experience?
                </p>

                {/* Star Rating */}
                <div className="flex justify-center mb-2">
                    <StarRating
                        value={rating}
                        onChange={setRating}
                        size={32}
                    />
                </div>

                {/* Rating Label */}
                {rating > 0 && (
                    <p className="text-xs text-slate-500 animate-in fade-in">
                        {rating === 5 && 'Excellent!'}
                        {rating === 4 && 'Great!'}
                        {rating === 3 && 'Good'}
                        {rating === 2 && 'Fair'}
                        {rating === 1 && 'Poor'}
                    </p>
                )}
            </div>

            {/* Comment Section (expandable) */}
            {rating > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => setShowComment(!showComment)}
                        className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700 py-2"
                        type="button"
                    >
                        {showComment ? (
                            <>
                                <ChevronUp size={14} />
                                Hide comment
                            </>
                        ) : (
                            <>
                                <ChevronDown size={14} />
                                Add a comment (optional)
                            </>
                        )}
                    </button>

                    {showComment && (
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share your experience..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            rows={2}
                            maxLength={500}
                        />
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3">
                <button
                    onClick={handleDismiss}
                    disabled={isDismissing}
                    className="flex-1 px-4 py-2 text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
                >
                    {isDismissing ? 'Dismissing...' : 'Maybe Later'}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={rating === 0 || isSubmitting}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Submitting...
                        </>
                    ) : (
                        'Submit'
                    )}
                </button>
            </div>

            {/* Value Proposition */}
            <p className="text-center text-[10px] text-slate-400 mt-3">
                Help other homeowners find great contractors
            </p>
        </div>
    );
};

export default RatingPromptCard;
