// src/features/ratings/components/RateHomeownerModal.jsx
// ============================================
// RATE HOMEOWNER MODAL
// ============================================
// Modal for contractors to rate homeowners after job completion
// Ratings are PRIVATE - only visible to the contractor

import React, { useState } from 'react';
import {
    Star, X, Loader2, CheckCircle, Lock,
    Home, MessageCircle, CreditCard, Key,
    User, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StarRating } from './StarRating';
import { rateHomeowner } from '../../jobs/lib/jobCompletionService';

// ============================================
// RATING CATEGORIES
// ============================================
const HOMEOWNER_RATING_CATEGORIES = [
    { 
        key: 'propertyAccess', 
        label: 'Property Access', 
        description: 'Was the site ready and accessible?',
        icon: Key
    },
    { 
        key: 'communication', 
        label: 'Communication', 
        description: 'Were they responsive and clear?',
        icon: MessageCircle
    },
    { 
        key: 'payment', 
        label: 'Payment', 
        description: 'Was payment handled promptly?',
        icon: CreditCard
    }
];

// ============================================
// MAIN COMPONENT
// ============================================
export const RateHomeownerModal = ({
    job,
    contractorId,
    onClose,
    onSuccess
}) => {
    // Rating state
    const [overallRating, setOverallRating] = useState(0);
    const [categoryRatings, setCategoryRatings] = useState({
        propertyAccess: 0,
        communication: 0,
        payment: 0
    });
    const [notes, setNotes] = useState('');
    const [useDetailedRating, setUseDetailedRating] = useState(false);
    
    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    
    // Calculate overall from categories if using detailed rating
    const calculatedOverall = useDetailedRating
        ? Object.values(categoryRatings).reduce((a, b) => a + b, 0) / 3
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
                propertyAccess: categoryRatings.propertyAccess || overallRating,
                communication: categoryRatings.communication || overallRating,
                payment: categoryRatings.payment || overallRating,
                notes: notes.trim()
            };
            
            await rateHomeowner(job.id, contractorId, rating);
            
            toast.success('Rating saved!');
            setSubmitted(true);
            
            // Delay before closing to show success
            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 1500);
            
        } catch (error) {
            console.error('Rating error:', error);
            toast.error('Failed to save rating');
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
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Rating Saved!</h3>
                    <p className="text-slate-600">
                        This will help you remember this customer for future jobs.
                    </p>
                </div>
            </div>
        );
    }
    
    const customerName = job.customerName || job.propertyName || 'this customer';
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleSkip} />
            
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded-xl">
                                <User className="h-6 w-6 text-slate-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Rate Customer</h3>
                                <p className="text-sm text-slate-500">
                                    How was working with {customerName}?
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
                    {/* Private Notice */}
                    <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2 mb-6">
                        <Lock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            <strong>Private rating</strong> — Only you can see this. It won't be shown to the customer or anyone else.
                        </p>
                    </div>
                    
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
                                {HOMEOWNER_RATING_CATEGORIES.map(cat => {
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
                                <div className="bg-slate-100 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Overall Rating</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <Star className="fill-amber-400 text-amber-400" size={24} />
                                        <span className="text-2xl font-bold text-slate-700">
                                            {calculatedOverall.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Private Notes */}
                    {(overallRating > 0 || calculatedOverall > 0) && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Private notes (optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notes for your reference only..."
                                rows={3}
                                maxLength={500}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">
                                {notes.length}/500
                            </p>
                        </div>
                    )}
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
                            'Save Rating'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RateHomeownerModal;
