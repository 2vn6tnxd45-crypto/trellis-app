// src/features/quotes/components/PublicQuoteView.jsx
// ============================================
// PUBLIC QUOTE VIEW
// ============================================
// Customer-facing quote view accessed via share link
// URL format: /quote/{contractorId}_{quoteId}

import React, { useState, useEffect } from 'react';
import { 
    Building2, Calendar, CheckCircle, XCircle, 
    Loader2, AlertTriangle, Mail, Phone, MapPin,
    FileText, Clock, UserPlus, Save, ArrowLeft // <--- ADDED ArrowLeft
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { 
    getQuoteByShareToken, 
    markQuoteViewed, 
    acceptQuote, 
    declineQuote,
    claimQuote
} from '../lib/quoteService';
import { AuthScreen } from '../../auth/AuthScreen';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '../../../config/firebase';

// ============================================
// LOADING STATE
// ============================================
const LoadingState = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
            <Loader2 className="h-12 w-12 text-emerald-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading quote...</p>
        </div>
    </div>
);

// ============================================
// ERROR STATE
// ============================================
const ErrorState = ({ message }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="bg-red-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Quote Not Found</h1>
            <p className="text-slate-600 mb-6">{message}</p>
            <a 
                href="/"
                className="inline-block px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
            >
                Go to Homepage
            </a>
        </div>
    </div>
);

// ============================================
// EXPIRED STATE
// ============================================
const ExpiredState = ({ quote, contractor }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="bg-amber-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Clock className="h-10 w-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Quote Expired</h1>
            <p className="text-slate-600 mb-6">
                This quote has expired. Please contact {contractor?.companyName || 'the contractor'} 
                for an updated quote.
            </p>
            {contractor?.phone && (
                <a 
                    href={`tel:${contractor.phone}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                >
                    <Phone size={18} />
                    Call {contractor.companyName}
                </a>
            )}
        </div>
    </div>
);

// ============================================
// SUCCESS STATE (After accepting)
// ============================================
const SuccessState = ({ quote, contractor }) => {
    const handleGoToDashboard = () => {
        // Remove the quote param and redirect to the app
        window.location.href = window.location.origin + '/app';
    };

    return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="bg-emerald-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Quote Accepted!</h1>
                <p className="text-slate-600 mb-6">
                    {contractor?.companyName || 'The contractor'} has been notified and will be in touch 
                    to schedule your service.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                    <p className="text-sm text-slate-500 mb-2">Quote Total</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        ${(quote.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
                
                {/* Navigation Button */}
                <button
                    onClick={handleGoToDashboard}
                    className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowLeft size={18} />
                    Go to Dashboard
                </button>
                
                {/* Footer */}
                <p className="text-xs text-slate-400 mt-6">
                    Powered by <a href="/" className="text-emerald-600 hover:underline">Krib</a>
                </p>
            </div>
        </div>
    );
};

// ============================================
// DECLINE MODAL
// ============================================
const DeclineModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
    const [reason, setReason] = useState('');
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Decline Quote</h2>
                <p className="text-slate-600 mb-4">
                    Are you sure you want to decline this quote? 
                    You can optionally provide a reason.
                </p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for declining (optional)"
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none mb-4"
                />
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <XCircle size={18} />
                        )}
                        Decline Quote
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN QUOTE VIEW
// ============================================
const QuoteContent = ({ quote, contractor, contractorId, user, onAccept, onDecline, onSave }) => {
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    };
    
    const isExpiringSoon = () => {
        if (!quote.expiresAt) return false;
        const expiresDate = quote.expiresAt.toDate ? quote.expiresAt.toDate() : new Date(quote.expiresAt);
        const daysUntil = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 3 && daysUntil > 0;
    };
    
    const handleAccept = async () => {
        setIsAccepting(true);
        try {
            await onAccept();
        } finally {
            setIsAccepting(false);
        }
    };
    
    const handleDecline = async (reason) => {
        setIsDeclining(true);
        try {
            await onDecline(reason);
            setShowDeclineModal(false);
        } finally {
            setIsDeclining(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave();
        } finally {
            setIsSaving(false);
        }
    };
    
    const canRespond = ['sent', 'viewed'].includes(quote.status);

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <Toaster position="top-center" />
            <DeclineModal 
                isOpen={showDeclineModal}
                onClose={() => setShowDeclineModal(false)}
                onConfirm={handleDecline}
                isSubmitting={isDeclining}
            />
            
            <div className="max-w-3xl mx-auto">
                {/* --- NEW: BACK BUTTON (Only visible to logged-in users) --- */}
                {(user || quote.status === 'accepted' || quote.customerId) && (
                    <button 
                       onClick={() => window.location.href = '/app?from=quote'}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Dashboard
                    </button>
                )}

                {/* NEW: Onboarding Call-to-Action (Only if not already claimed/owned by this user) */}
                {(!quote.customerId || (user && quote.customerId !== user.uid)) && (
                    <div className="bg-emerald-900 rounded-2xl p-6 mb-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <UserPlus size={20} className="text-emerald-400" />
                                Save this Quote to Krib
                            </h3>
                            <p className="text-emerald-100 text-sm mt-1">
                                Create a free account or add to existing account to track this project.
                            </p>
                        </div>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="whitespace-nowrap px-6 py-3 bg-white text-emerald-900 font-bold rounded-xl hover:bg-emerald-50 transition-colors flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {user ? 'Save to My Account' : 'Create Free Account or Add to Existing'}
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
                    <div className="bg-emerald-600 text-white p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                <Building2 size={28} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">
                                    {contractor?.companyName || 'Service Quote'}
                                </h1>
                                {contractor?.phone && (
                                    <p className="text-emerald-100 text-sm flex items-center gap-2 mt-1">
                                        <Phone size={14} />
                                        {contractor.phone}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Quote Info Bar */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-500">Quote #{quote.quoteNumber}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-500">Created {formatDate(quote.createdAt)}</span>
                        </div>
                        {isExpiringSoon() && (
                            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-3 py-1 rounded-full font-medium">
                                <AlertTriangle size={12} />
                                Expires {formatDate(quote.expiresAt)}
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Quote Content */}
                <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
                    {/* Title */}
                    <div className="mb-6">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Service Description</p>
                        <h2 className="text-xl font-bold text-slate-800">{quote.title}</h2>
                    </div>
                    
                    {/* Line Items */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left text-xs font-bold text-slate-500 uppercase px-4 py-3">Item</th>
                                    <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-20">Qty</th>
                                    <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-24">Price</th>
                                    <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-24">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(quote.lineItems || []).map((item, idx) => (
                                    <tr key={item.id || idx}>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-800">{item.description}</p>
                                            <p className="text-xs text-slate-400 capitalize">{item.type}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">
                                            ${(item.unitPrice || 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                                            ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Totals */}
                    <div className="flex justify-end mb-6">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="font-medium">${(quote.subtotal || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Tax ({quote.taxRate || 0}%)</span>
                                <span className="font-medium">${(quote.taxAmount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xl pt-3 border-t border-slate-200">
                                <span className="font-bold text-slate-800">Total</span>
                                <span className="font-bold text-emerald-600">
                                    ${(quote.total || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Notes */}
                    {quote.notes && (
                        <div className="bg-slate-50 rounded-xl p-4 mb-6">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Notes</p>
                            <p className="text-sm text-slate-600">{quote.notes}</p>
                        </div>
                    )}
                    
                    {/* Terms */}
                    {quote.terms && (
                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Terms & Conditions</p>
                            <p className="text-xs text-slate-500">{quote.terms}</p>
                        </div>
                    )}
                </div>
                
                {/* Action Buttons */}
                {canRespond && (
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <p className="text-center text-slate-600 mb-4">
                            Ready to proceed? Accept this quote to schedule your service.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowDeclineModal(true)}
                                disabled={isDeclining}
                                className="flex-1 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle size={18} />
                                Decline
                            </button>
                            <button
                                onClick={handleAccept}
                                disabled={isAccepting}
                                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                            >
                                {isAccepting ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <CheckCircle size={18} />
                                )}
                                Accept Quote
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Already Responded States */}
                {quote.status === 'accepted' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                        <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                        <p className="font-bold text-emerald-800">You've accepted this quote</p>
                        <p className="text-sm text-emerald-700 mt-1">
                            {contractor?.companyName || 'The contractor'} will be in touch soon.
                        </p>
                    </div>
                )}
                
                {quote.status === 'declined' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                        <XCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                        <p className="font-bold text-slate-600">Quote Declined</p>
                        <p className="text-sm text-slate-500 mt-1">
                            You declined this quote on {formatDate(quote.declinedAt)}.
                        </p>
                    </div>
                )}
                
                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-slate-400">
                        Powered by <a href="/" className="text-emerald-600 hover:underline">Krib</a> — 
                        The smart way to manage your home
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const PublicQuoteView = ({ shareToken, user }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [accepted, setAccepted] = useState(false);
    
    // NEW: Auth Modal State
    const [showAuth, setShowAuth] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [alreadyClaimed, setAlreadyClaimed] = useState(false);

    // Check if already claimed on mount
    useEffect(() => {
        if (user && data?.quote?.customerId === user.uid) {
            setAlreadyClaimed(true);
        }
    }, [user, data]);

    useEffect(() => {
        let isMounted = true;
        let hasSetLoading = false; // Track if we've finished loading

        const loadQuote = async () => {
            try {
                console.log("Loading quote for token:", shareToken);
                const result = await getQuoteByShareToken(shareToken);
                
                if (!isMounted) return;

                if (!result || !result.quote) {
                    console.error("Quote not found in DB");
                    setError('This quote could not be found. It may have been deleted.');
                    setLoading(false);
                    hasSetLoading = true;
                    return;
                }
                
                setData(result);
                setLoading(false); // STOP LOADING HERE (Don't wait for view count)
                hasSetLoading = true;
                
                // Fire-and-forget view count update
                if (result.quote.status === 'sent') {
                    markQuoteViewed(result.contractorId, result.quote.id)
                        .catch(e => console.warn("Background view update failed:", e));
                }
            } catch (err) {
                if (!isMounted) return;
                console.error('Error loading quote:', err);
                setError('Unable to load this quote. Please try again later.');
                setLoading(false);
                hasSetLoading = true;
            }
        };
        
        loadQuote();

        // Safety Timeout: Force stop loading if it hangs for 10s
        const timeout = setTimeout(() => {
            if (isMounted && !hasSetLoading) {
                setLoading(false);
                setError('Request timed out. Please refresh the page.');
            }
        }, 10000);

        return () => {
            isMounted = false;
            clearTimeout(timeout);
        };
    }, [shareToken]);

    // Handle Save/Claim
    const handleSaveQuote = async () => {
        // If not logged in, show auth modal and set pending flag
        if (!user) {
            setPendingSave(true);
            setShowAuth(true);
            
            // NEW: Store quote address for potential new user onboarding
            if (data?.quote?.customer?.address) {
                try {
                    localStorage.setItem('pendingQuoteAddress', data.quote.customer.address);
                } catch (e) {
                    console.warn('Failed to save pending quote address', e);
                }
            }
            return;
        }

        // Prevent double-claiming
        if (alreadyClaimed) {
            toast.info('This quote is already in your account');
            window.location.href = window.location.origin + '/app?from=quote';
            return;
        }

        // Prevent multiple clicks
        if (isClaiming) return;

        setIsClaiming(true);

        try {
            await claimQuote(data.contractorId, data.quote.id, user.uid);
            toast.success('Quote saved to your account!');
            
            // Clear pending address now that we claimed
            localStorage.removeItem('pendingQuoteAddress');
            
            // FIX: Properly wait for Firestore to sync all pending writes
            try {
                await waitForPendingWrites(db);
            } catch (syncErr) {
                console.warn('waitForPendingWrites skipped:', syncErr.message);
            }
            
            // Small additional buffer for IndexedDB transaction completion
            await new Promise(r => setTimeout(r, 300));
            
            // REDIRECT TO DASHBOARD
            window.location.href = window.location.origin + '/app?from=quote';
            
        } catch (err) {
            console.error('Error saving quote:', err);
            toast.error('Failed to save quote.');
            setIsClaiming(false); 
        }
    };

    // Effect to trigger save AFTER login
    useEffect(() => {
        if (user && pendingSave && data && !isClaiming) {
            setPendingSave(false);
            setShowAuth(false);
            handleSaveQuote();
        }
    }, [user, pendingSave, data, isClaiming]);
    
    const handleAccept = async () => {
    try {
        const result = await acceptQuote(data.contractorId, data.quote.id);
        setAccepted(true);
        toast.success('Quote accepted! The contractor will be in touch to schedule.');
        
        // Optional: log for debugging
        console.log('Job created:', result.jobId);
    } catch (err) {
        console.error('Error accepting quote:', err);
        toast.error('Failed to accept quote. Please try again.');
        throw err;
    }
};
    
    const handleDecline = async (reason) => {
        try {
            await declineQuote(data.contractorId, data.quote.id, reason);
            // Reload the quote to show declined state
            const result = await getQuoteByShareToken(shareToken);
            setData(result);
            toast.success('Quote declined');
        } catch (err) {
            console.error('Error declining quote:', err);
            toast.error('Failed to decline quote. Please try again.');
            throw err;
        }
    };
    
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} />;
    if (!data) return <ErrorState message="Quote not found" />;
    
    // Check if expired
    if (data.quote.status === 'expired') {
        return <ExpiredState quote={data.quote} contractor={data.contractor} />;
    }
    
    // Show success state after accepting
    if (accepted) {
        return <SuccessState quote={data.quote} contractor={data.contractor} />;
    }
    
    return (
        <>
            {/* Login Modal Overlay */}
            {showAuth && (
                <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
                    <div className="absolute top-4 right-4 z-50">
                        <button onClick={() => setShowAuth(false)} className="p-2 bg-white rounded-full shadow-sm">
                            <XCircle size={24} className="text-slate-400" />
                        </button>
                    </div>
                    {/* Reuse existing AuthScreen in modal mode */}
                    <AuthScreen isModal={true} /> 
                </div>
            )}

            <QuoteContent
                quote={data.quote}
                contractor={data.contractor}
                contractorId={data.contractorId}
                user={user}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onSave={handleSaveQuote}
            />
        </>
    );
};

export default PublicQuoteView;
