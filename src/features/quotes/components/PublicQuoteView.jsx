// src/features/quotes/components/PublicQuoteView.jsx
// ============================================
// PUBLIC QUOTE VIEW
// ============================================
// Customer-facing quote view accessed via share link
// URL format: /quote/{contractorId}_{quoteId}
// UPDATED: Now uses QuoteAuthScreen for contextual auth experience

import React, { useState, useEffect } from 'react';
import { 
    Building2, Calendar, CheckCircle, XCircle, 
    Loader2, AlertTriangle, Mail, Phone, MapPin,
    FileText, Clock, UserPlus, Save, ArrowLeft, Shield, Users,
    Sparkles, Home, Plus
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { 
    getQuoteByShareToken, 
    markQuoteViewed, 
    acceptQuote, 
    declineQuote,
    claimQuote
} from '../lib/quoteService';
// UPDATED: Import QuoteAuthScreen instead of generic AuthScreen
import { QuoteAuthScreen } from './QuoteAuthScreen';
import { waitForPendingWrites, doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';

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
            <p className="text-slate-500">{message}</p>
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
            <p className="text-slate-500 mb-6">
                This quote from {contractor?.companyName || 'your contractor'} has expired. 
                Please contact them for an updated quote.
            </p>
            {contractor?.email && (
                <a 
                    href={`mailto:${contractor.email}`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                    <Mail size={18} />
                    Contact {contractor.companyName || 'Contractor'}
                </a>
            )}
        </div>
    </div>
);

// ============================================
// SUCCESS STATE (After acceptance)
// ============================================
const SuccessState = ({ quote, contractor }) => {
    const handleGoToDashboard = () => {
        window.location.href = window.location.origin + '/app?from=quote';
    };

    return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="bg-emerald-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Quote Accepted!</h1>
                <p className="text-slate-500 mb-6">
                    {contractor?.companyName || 'The contractor'} has been notified. 
                    They'll reach out to schedule your service.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                    <p className="text-sm text-slate-500 mb-2">Quote Total</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        ${(quote.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
                
                <button
                    onClick={handleGoToDashboard}
                    className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowLeft size={18} />
                    Go to Dashboard
                </button>
                
                <p className="text-xs text-slate-400 mt-6">
                    Powered by <a href="/" className="text-emerald-600 hover:underline">Krib</a>
                </p>
            </div>
        </div>
    );
};

// ============================================
// PROPERTY SELECTION MODAL
// ============================================
const PropertySelectionModal = ({ 
    isOpen, 
    onClose, 
    properties, 
    quoteAddress,
    onSelect,
    onCreateNew 
}) => {
    const [selectedId, setSelectedId] = useState(null);
    
    useEffect(() => {
        if (quoteAddress && properties.length > 0) {
            const match = properties.find(p => 
                p.address?.street?.toLowerCase().includes(quoteAddress.toLowerCase()) ||
                quoteAddress.toLowerCase().includes(p.address?.street?.toLowerCase())
            );
            if (match) {
                setSelectedId(match.id);
            }
        }
    }, [quoteAddress, properties]);
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800">
                        Which property is this quote for?
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Select an existing property or add a new one.
                    </p>
                </div>
                
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                    {properties.map(prop => (
                        <button
                            key={prop.id}
                            onClick={() => setSelectedId(prop.id)}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                selectedId === prop.id
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Home className={selectedId === prop.id ? 'text-emerald-600' : 'text-slate-400'} />
                                <div>
                                    <p className="font-bold text-slate-800">{prop.name}</p>
                                    <p className="text-sm text-slate-500">
                                        {prop.address?.street}, {prop.address?.city}
                                    </p>
                                </div>
                                {selectedId === prop.id && (
                                    <CheckCircle className="ml-auto text-emerald-600" />
                                )}
                            </div>
                        </button>
                    ))}
                    
                    <button
                        onClick={() => onCreateNew()}
                        className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 
                                   text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                    >
                        <div className="flex items-center gap-3 text-slate-600">
                            <Plus />
                            <span className="font-medium">Add this as a new property</span>
                        </div>
                    </button>
                </div>
                
                <div className="p-4 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSelect(selectedId)}
                        disabled={!selectedId}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold 
                                   disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                    >
                        Add Quote
                    </button>
                </div>
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
                    Are you sure you want to decline this quote? You can optionally provide a reason.
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
// MAIN QUOTE CONTENT VIEW
// ============================================
const QuoteContent = ({ quote, contractor, contractorId, user, onAccept, onDecline, onSave, isSaving, alreadyClaimed }) => {
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);
    
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
    
    const canRespond = ['sent', 'viewed'].includes(quote.status);

    // Calculate Deposit logic if present
    const depositAmount = quote.depositAmount || 0;
    const balanceDue = (quote.total || 0) - depositAmount;

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
                {/* Back Button (Only visible to logged-in users) */}
                {(user || quote.status === 'accepted' || quote.customerId) && (
                    <button 
                       onClick={() => window.location.href = '/app?from=quote'}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-6 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Dashboard
                    </button>
                )}

                {/* Sticky CTA Banner */}
                {!alreadyClaimed && (
                    <div className="sticky top-0 z-20 bg-gradient-to-br from-emerald-800 to-emerald-900 
                                    text-white p-4 rounded-xl mb-6 flex flex-col sm:flex-row justify-between items-center shadow-lg gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-emerald-300" />
                                <p className="font-bold">
                                    {user ? 'Add to Your Krib' : 'Save this Quote to Krib'}
                                </p>
                            </div>
                            <p className="text-emerald-200 text-sm mt-1">
                                {user 
                                    ? 'Track this job, chat with your contractor, and store warranties.'
                                    : 'Create a free account to track quotes, jobs, and home records.'
                                }
                            </p>
                        </div>
                        <button
                            onClick={onSave}
                            disabled={isSaving}
                            className="px-6 py-3 bg-white text-emerald-800 font-bold rounded-xl hover:bg-emerald-50 
                                       transition-colors flex items-center gap-2 whitespace-nowrap shadow-lg"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {user ? 'Add to My Krib' : 'Save to Krib'}
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
                    <div className="bg-emerald-600 text-white p-6">
                        <div className="flex items-center gap-4">
                            {contractor?.logoUrl ? (
                                <img src={contractor.logoUrl} alt="Logo" className="w-14 h-14 rounded-xl bg-white object-contain p-1" />
                            ) : (
                                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Building2 size={28} />
                                </div>
                            )}
                            <div>
                                <h1 className="text-xl font-bold">
                                    {contractor?.companyName || 'Service Quote'}
                                </h1>
                                {contractor?.licenseNumber && (
                                    <p className="text-emerald-200 text-xs font-medium uppercase tracking-wide mb-1">
                                        License #: {contractor.licenseNumber}
                                    </p>
                                )}
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
                    {/* Customer Info & Title Row */}
                    <div className="flex flex-col md:flex-row md:justify-between gap-6 mb-6 pb-6 border-b border-slate-100">
                        {/* Customer Info */}
                        {quote.customer && (quote.customer.name || quote.customer.address) && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Quote For</p>
                                {quote.customer.name && (
                                    <p className="font-bold text-slate-800">{quote.customer.name}</p>
                                )}
                                {quote.customer.address && (
                                    <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                        <MapPin size={14} className="text-slate-400" />
                                        {quote.customer.address}
                                    </p>
                                )}
                                {quote.customer.email && (
                                    <p className="text-sm text-slate-500 mt-1">{quote.customer.email}</p>
                                )}
                                {quote.customer.phone && (
                                    <p className="text-sm text-slate-500">{quote.customer.phone}</p>
                                )}
                            </div>
                        )}
                        
                        {/* Service Title */}
                        <div className={quote.customer && (quote.customer.name || quote.customer.address) ? 'md:text-right' : ''}>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Service Description</p>
                            <h2 className="text-xl font-bold text-slate-800">{quote.title}</h2>
                        </div>
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
                                            <p className="font-medium text-slate-800">{item.description}</p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                <p className="text-xs text-slate-400 capitalize inline-block">{item.type}</p>
                                                {/* Conditional Fields based on Item Type */}
                                                {item.type === 'material' && (
                                                    <>
                                                        {item.brand && <span className="text-xs text-slate-500">Brand: {item.brand}</span>}
                                                        {item.model && <span className="text-xs text-slate-500">Model: {item.model}</span>}
                                                        {item.warranty && <span className="text-xs text-emerald-600 flex items-center gap-1"><Shield size={10} /> Mfr Warranty: {item.warranty}</span>}
                                                    </>
                                                )}
                                                {item.type === 'labor' && (
                                                    <>
                                                        {item.crewSize && <span className="text-xs text-slate-500 flex items-center gap-1"><Users size={10} /> {item.crewSize} Techs</span>}
                                                        {item.warranty && <span className="text-xs text-emerald-600 flex items-center gap-1"><Shield size={10} /> Labor Warranty: {item.warranty}</span>}
                                                    </>
                                                )}
                                            </div>
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
                        <div className="w-72 space-y-2">
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
                            
                            {/* Deposit Display */}
                            {depositAmount > 0 && (
                                <div className="mt-4 pt-3 border-t border-dashed border-slate-300">
                                    <div className="flex justify-between text-sm font-bold text-emerald-700">
                                        <span>Required Deposit</span>
                                        <span>${depositAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-500 mt-1">
                                        <span>Balance Due Upon Completion</span>
                                        <span>${balanceDue.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Notes & Exclusions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {quote.notes && (
                            <div className="bg-slate-50 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Scope Notes</p>
                                <p className="text-sm text-slate-600">{quote.notes}</p>
                            </div>
                        )}
                        {quote.exclusions && (
                            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                <p className="text-xs font-bold text-red-500 uppercase mb-2">Exclusions</p>
                                <p className="text-sm text-slate-600">{quote.exclusions}</p>
                            </div>
                        )}
                        {/* Global Warranty Display */}
                        {quote.clientWarranty && (
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 col-span-1 md:col-span-2">
                                <p className="text-xs font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                                    <Shield size={14} /> Workmanship Warranty
                                </p>
                                <p className="text-sm text-slate-700 font-medium">{quote.clientWarranty}</p>
                            </div>
                        )}
                    </div>
                    
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
                                {depositAmount > 0 ? `Accept & Pay Deposit` : 'Accept Quote'}
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
    
    // Auth Modal & Claim State
    const [showAuth, setShowAuth] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);
    const [pendingAccept, setPendingAccept] = useState(false); // NEW: Track if user wanted to accept
    const [isClaiming, setIsClaiming] = useState(false);
    const [alreadyClaimed, setAlreadyClaimed] = useState(false);
    
    // Multi-property state
    const [showPropertySelection, setShowPropertySelection] = useState(false);
    const [userProperties, setUserProperties] = useState([]);

    // Check if already claimed on mount
    useEffect(() => {
        if (user && data?.quote?.customerId === user.uid) {
            setAlreadyClaimed(true);
        }
    }, [user, data]);

    useEffect(() => {
        let isMounted = true;
        let hasSetLoading = false;

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
                setLoading(false); 
                hasSetLoading = true;
                
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

    // Perform the actual claim operation
    const executeClaim = async (propertyId = null) => {
        setIsClaiming(true);
        try {
            await claimQuote(data.contractorId, data.quote.id, user.uid, propertyId);
            
            // Mark welcome seen
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { 
                    hasSeenWelcome: true 
                });
            } catch (e) {
                console.warn("Could not mark welcome as seen", e);
            }

            toast.success('Quote saved to your account!');
            localStorage.removeItem('pendingQuoteAddress');
            setShowPropertySelection(false);
            
            try {
                await waitForPendingWrites(db);
            } catch (syncErr) {
                console.warn('waitForPendingWrites skipped:', syncErr.message);
            }
            
            await new Promise(r => setTimeout(r, 300));
            window.location.href = window.location.origin + '/app?from=quote';
            
        } catch (err) {
            console.error('Error saving quote:', err);
            toast.error('Failed to save quote.');
            setIsClaiming(false); 
        }
    };

    // Handle Save/Claim
    const handleSaveQuote = async () => {
        if (!user) {
            setPendingSave(true);
            setShowAuth(true);
            
            if (data?.quote?.customer?.address) {
                try {
                    localStorage.setItem('pendingQuoteAddress', data.quote.customer.address);
                } catch (e) {
                    console.warn('Failed to save pending quote address', e);
                }
            }
            return;
        }

        if (alreadyClaimed) {
            toast.info('This quote is already in your account');
            window.location.href = window.location.origin + '/app?from=quote';
            return;
        }

        if (isClaiming) return;

        // Check user properties
        try {
            const propertiesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'properties');
            const snapshot = await getDocs(propertiesRef);
            const properties = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setUserProperties(properties);

            if (properties.length > 1) {
                setShowPropertySelection(true);
            } else {
                const propertyId = properties[0]?.id || null;
                await executeClaim(propertyId);
            }
        } catch (err) {
            console.error('Error checking properties:', err);
            await executeClaim(null);
        }
    };

    // Trigger save or accept after login if pending
    useEffect(() => {
        if (user && data && !isClaiming) {
            // Handle pending accept (user wanted to accept quote)
            if (pendingAccept) {
                setPendingAccept(false);
                setShowAuth(false);
                handleAccept();
                return;
            }
            
            // Handle pending save (user wanted to save to Krib)
            if (pendingSave) {
                setPendingSave(false);
                setShowAuth(false);
                handleSaveQuote();
            }
        }
    }, [user, pendingSave, pendingAccept, data, isClaiming]);
    
    const handleAccept = async () => {
        // NEW: Require auth before accepting
        if (!user) {
            setPendingAccept(true);
            setShowAuth(true);
            return;
        }
        
        try {
            const result = await acceptQuote(data.contractorId, data.quote.id);
            setAccepted(true);
            toast.success('Quote accepted! The contractor will be in touch to schedule.');
        } catch (err) {
            console.error('Error accepting quote:', err);
            toast.error('Failed to accept quote. Please try again.');
        }
    };
    
    const handleDecline = async (reason) => {
        try {
            await declineQuote(data.contractorId, data.quote.id, reason);
            const result = await getQuoteByShareToken(shareToken);
            setData(result);
            toast.success('Quote declined');
        } catch (err) {
            console.error('Error declining quote:', err);
            toast.error('Failed to decline quote. Please try again.');
        }
    };
    
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} />;
    if (!data) return <ErrorState message="Quote not found" />;
    
    if (data.quote.status === 'expired') {
        return <ExpiredState quote={data.quote} contractor={data.contractor} />;
    }
    
    if (accepted) {
        return <SuccessState quote={data.quote} contractor={data.contractor} />;
    }
    
    return (
        <>
            {/* UPDATED: Use QuoteAuthScreen instead of generic AuthScreen */}
            {showAuth && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <QuoteAuthScreen
                        quote={data.quote}
                        contractor={data.contractor}
                        action={pendingAccept ? 'accept' : 'save'}
                        onSuccess={() => {
                            // Auth success - useEffect will handle the save/accept
                        }}
                        onClose={() => {
                            setShowAuth(false);
                            setPendingSave(false);
                            setPendingAccept(false);
                        }}
                    />
                </div>
            )}

            <PropertySelectionModal
                isOpen={showPropertySelection}
                onClose={() => setShowPropertySelection(false)}
                properties={userProperties}
                quoteAddress={data.quote.customer?.address}
                onSelect={(propId) => executeClaim(propId)}
                onCreateNew={() => executeClaim(null)}
            />

            <QuoteContent
                quote={data.quote}
                contractor={data.contractor}
                contractorId={data.contractorId}
                user={user}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onSave={handleSaveQuote}
                isSaving={isClaiming}
                alreadyClaimed={alreadyClaimed}
            />
        </>
    );
};

export default PublicQuoteView;
