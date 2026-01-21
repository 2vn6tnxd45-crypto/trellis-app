// src/features/ratings/components/RateContractorModal.jsx
// ============================================
// RATE CONTRACTOR MODAL
// ============================================
// Modal for homeowners to rate contractors after job completion
// Ratings are PUBLIC and visible on contractor profiles

import React, { useState } from 'react';
import {
    Star, X, Loader2, CheckCircle, MessageSquare,
    ThumbsUp, Clock, MessageCircle, DollarSign,
    Wrench, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StarRating, CategoryRatingInput } from './StarRating';
import { rateContractor } from '../../jobs/lib/jobCompletionService';

// ============================================
// RATING CATEGORIES
// ============================================
const CONTRACTOR_RATING_CATEGORIES = [
    { 
        key: 'quality', 
        label: 'Quality of Work', 
        description: 'Was the work done well?',
        icon: Wrench
    },
    { 
        key: 'timeliness', 
        label: 'Timeliness', 
        description: 'Did they arrive and finish on time?',
        icon: Clock
    },
    { 
        key: 'communication', 
        label: 'Communication', 
        description: 'Were they responsive and clear?',
        icon: MessageCircle
    },
    { 
        key: 'value', 
        label: 'Value for Money', 
        description: 'Was the price fair for the work?',
        icon: DollarSign
    }
];

// ============================================
// MAIN COMPONENT
// ============================================
export const RateContractorModal = ({
    job,
    contractorId,
    userId,
    onClose,
    onSuccess
}) => {
    // Rating state
    const [overallRating, setOverallRating] = useState(0);
    const [categoryRatings, setCategoryRatings] = useState({
        quality: 0,
        timeliness: 0,
        communication: 0,
        value: 0
    });
    const [review, setReview] = useState('');
    const [useDetailedRating, setUseDetailedRating] = useState(false);
    
    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    
    // Calculate overall from categories if using detailed rating
    const calculatedOverall = useDetailedRating
        ? Object.values(categoryRatings).reduce((a, b) => a + b, 0) / 4
        : overallRating;
    
    // Handle submit
    const handleSubmit = async () => {
        if (calculatedOverall === 0) {
            toast.error('Please provide a rating');
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            const rating = {
                overall: useDetailedRating ? calculatedOverall : overallRating,
                quality: categoryRatings.quality || overallRating,
                timeliness: categoryRatings.timeliness || overallRating,
                communication: categoryRatings.communication || overallRating,
                value: categoryRatings.value || overallRating,
                review: review.trim()
            };
            
            await rateContractor(job.id, contractorId, userId, rating);
            
            toast.success('Thank you for your feedback!');
            setSubmitted(true);
            
            // Delay before closing to show success
            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 1500);
            
        } catch (error) {
            console.error('Rating error:', error);
            toast.error('Failed to submit rating');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Handle skip
    const handleSkip = () => {
        if (onClose) onClose();
    };
    
    // Success State
    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
                    <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Thanks for your feedback!</h3>
                    <p className="text-slate-600">
                        Your rating helps other homeowners find great contractors.
                    </p>
                </div>
            </div>
        );
    }
    
    // Safely extract contractor name from string or object to prevent React Error #310
    const getContractorName = () => {
        if (job.contractorName) return job.contractorName;
        if (job.contractorCompany) return job.contractorCompany;
        if (job.contractor) {
            if (typeof job.contractor === 'string') return job.contractor;
            if (typeof job.contractor === 'object') {
                return job.contractor.companyName || job.contractor.name || job.contractor.businessName || 'the contractor';
            }
        }
        return 'the contractor';
    };
    const contractorName = getContractorName();
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleSkip} />
            
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-100 p-2 rounded-xl">
                                <Award className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Rate Your Experience</h3>
                                <p className="text-sm text-slate-500">
                                    How was {contractorName}?
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow">
                    {/* Quick Rating */}
                    {!useDetailedRating && (
                        <div className="text-center mb-6">
                            <p className="text-sm text-slate-600 mb-3">Tap to rate</p>
                            <div className="flex justify-center">
                                <StarRating
                                    value={overallRating}
                                    onChange={setOverallRating}
                                    size="xl"
                                />
                            </div>
                            
                            {overallRating > 0 && (
                                <button
                                    onClick={() => setUseDetailedRating(true)}
                                    className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    + Add detailed ratings
                                </button>
                            )}
                        </div>
                    )}
                    
                    {/* Detailed Ratings */}
                    {useDetailedRating && (
                        <div className="space-y-6 mb-6">
                            <div className="flex items-center justify-between">
                                <p className="font-bold text-slate-800">Rate each category</p>
                                <button
                                    onClick={() => setUseDetailedRating(false)}
                                    className="text-sm text-slate-500 hover:text-slate-700"
                                >
                                    Simple rating
                                </button>
                            </div>
                            
                            <div className="space-y-5">
                                {CONTRACTOR_RATING_CATEGORIES.map(cat => {
                                    const Icon = cat.icon;
                                    return (
                                        <div key={cat.key} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-100 p-2 rounded-lg">
                                                    <Icon size={16} className="text-slate-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-700 text-sm">{cat.label}</p>
                                                </div>
                                            </div>
                                            <StarRating
                                                value={categoryRatings[cat.key]}
                                                onChange={(val) => setCategoryRatings(prev => ({
                                                    ...prev,
                                                    [cat.key]: val
                                                }))}
                                                size="sm"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* Average Display */}
                            {calculatedOverall > 0 && (
                                <div className="bg-amber-50 rounded-xl p-4 text-center">
                                    <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Overall Rating</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <Star className="fill-amber-400 text-amber-400" size={24} />
                                        <span className="text-2xl font-bold text-amber-700">
                                            {calculatedOverall.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Review Text */}
                    {(overallRating > 0 || calculatedOverall > 0) && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Write a review (optional)
                            </label>
                            <textarea
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                                placeholder="Share your experience with other homeowners..."
                                rows={3}
                                maxLength={500}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">
                                {review.length}/500
                            </p>
                        </div>
                    )}
                    
                    {/* Public Notice */}
                    <div className="mt-4 bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                        <ThumbsUp size={16} className="text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600">
                            Your rating will be visible on {contractorName}'s profile to help other homeowners.
                        </p>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={handleSkip}
                        className="flex-1 py-3 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-white transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (calculatedOverall === 0)}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            'Submit Rating'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RateContractorModal;
