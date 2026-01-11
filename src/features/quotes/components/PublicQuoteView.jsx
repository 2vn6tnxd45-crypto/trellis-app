// src/features/quotes/components/PublicQuoteView.jsx
// ============================================
// PUBLIC QUOTE VIEW - IMPROVED PROPERTY FLOW
// ============================================
// Handles:
// - Property confirmation/creation when claiming quote
// - Address mismatch warnings
// - Multi-property user support
// - New user property setup

import React, { useState, useEffect, useRef } from 'react';
import { 
    FileText, CheckCircle, XCircle, Clock, Eye, Send,
    User, Phone, Mail, MapPin, Calendar, DollarSign,
    ArrowLeft, Building2, Shield, AlertTriangle, Loader2,
    Home, Plus, ChevronRight, Info, Package, Wrench, Users, Timer, BookmarkPlus
} from 'lucide-react';
import { 
    doc, 
    getDoc, 
    setDoc,
    getDocs, 
    updateDoc, 
    collection,
    serverTimestamp,
    waitForPendingWrites
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId, googleMapsApiKey } from '../../../config/constants';
import { 
    getQuoteByShareToken, 
    markQuoteViewed, 
    acceptQuote, 
    declineQuote,
    claimQuote,
    addContractorToProsList,
    createQuoteChatChannel
} from '../lib/quoteService';
import { QuoteAuthScreen } from './QuoteAuthScreen';
import toast from 'react-hot-toast';
import { createPaymentCheckout, formatCurrency as formatStripeCurrency } from '../../../lib/stripeService';

// ============================================
// HELPERS
// ============================================
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
};

// Check if two addresses are similar (fuzzy match)
const addressesMatch = (addr1, addr2) => {
    if (!addr1 || !addr2) return false;
    
    const normalize = (str) => {
        if (!str) return '';
        if (typeof str === 'object') {
            str = str.street || str.formatted || '';
        }
        return str.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd/g, '');
    };
    
    const n1 = normalize(addr1);
    const n2 = normalize(addr2);
    
    return n1.includes(n2) || n2.includes(n1) || n1 === n2;
};

// ============================================
// LOADING STATE
// ============================================
const LoadingState = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading quote...</p>
        </div>
    </div>
);

// ============================================
// ERROR STATE
// ============================================
const ErrorState = ({ message }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Quote Not Found</h2>
            <p className="text-slate-600">{message}</p>
        </div>
    </div>
);

// ============================================
// EXPIRED STATE
// ============================================
const ExpiredState = ({ quote, contractor }) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Quote Expired</h2>
            <p className="text-slate-600 mb-4">
                This quote from {contractor?.companyName || 'the contractor'} has expired.
            </p>
            <p className="text-sm text-slate-500">
                Please contact {contractor?.phone || 'the contractor'} for an updated quote.
            </p>
        </div>
    </div>
);

// ============================================
// SUCCESS STATE (After Acceptance)
// ============================================
const SuccessState = ({ quote, contractor }) => {
    const handleGoToDashboard = () => {
        window.location.href = window.location.origin + '/app?from=quote';
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-6">
                    <CheckCircle className="h-12 w-12 text-emerald-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Quote Accepted!</h2>
                <p className="text-slate-600 mb-6">
                    {contractor?.companyName || 'The contractor'} will be in touch to schedule your service.
                </p>
                
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                    <p className="text-sm text-slate-500 mb-2">Quote Total</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        {formatCurrency(quote.total)}
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
// ADDRESS MISMATCH WARNING
// ============================================
const AddressMismatchWarning = ({ quoteAddress, propertyAddress }) => {
    const quoteAddrStr = typeof quoteAddress === 'string' ? quoteAddress : quoteAddress?.street || '';
    const propAddrStr = typeof propertyAddress === 'string' ? propertyAddress : propertyAddress?.street || '';
    
    if (!quoteAddrStr || !propAddrStr) return null;
    if (addressesMatch(quoteAddrStr, propAddrStr)) return null;
    
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-medium text-amber-800 mb-1">Address Mismatch</p>
                    <p className="text-amber-700">
                        The quote address <span className="font-medium">"{quoteAddrStr}"</span> doesn't match 
                        your property address <span className="font-medium">"{propAddrStr}"</span>.
                    </p>
                    <p className="text-amber-600 mt-1 text-xs">
                        Make sure you're selecting the correct property for this quote.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// PROPERTY CREATION FORM (for new users)
// ============================================
const PropertyCreationForm = ({ 
    quoteAddress, 
    onComplete, 
    isSaving 
}) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '', placeId: '' });
    const [coordinates, setCoordinates] = useState(null);
    const [useQuoteAddress, setUseQuoteAddress] = useState(true);
    const autocompleteRef = useRef(null);
    const inputRef = useRef(null);

    // Pre-fill with quote address
    useEffect(() => {
        if (quoteAddress && useQuoteAddress) {
            setAddress({ 
                street: quoteAddress, 
                city: '', 
                state: '', 
                zip: '',
                placeId: '' 
            });
        }
    }, [quoteAddress, useQuoteAddress]);

    // Initialize Google Maps Autocomplete
    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google?.maps?.places) {
                initAutocomplete();
                return;
            }
            if (!googleMapsApiKey) return;
            
            const existingScript = document.getElementById('googleMapsScript');
            if (existingScript) {
                const checkInterval = setInterval(() => {
                    if (window.google?.maps?.places) {
                        clearInterval(checkInterval);
                        initAutocomplete();
                    }
                }, 100);
                return;
            }
            
            const script = document.createElement('script');
            script.id = 'googleMapsScript';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = initAutocomplete;
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!inputRef.current || autocompleteRef.current) return;
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'],
                    componentRestrictions: { country: 'us' },
                });
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (!place.address_components) return;
                    
                    if (place.geometry?.location) {
                        setCoordinates({
                            lat: place.geometry.location.lat(),
                            lon: place.geometry.location.lng()
                        });
                    }

                    const get = (type) => place.address_components.find(c => c.types.includes(type))?.short_name || '';
                    setAddress({
                        street: `${get('street_number')} ${get('route')}`.trim(),
                        city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
                        state: get('administrative_area_level_1'),
                        zip: get('postal_code'),
                        placeId: place.place_id || '',
                    });
                    setUseQuoteAddress(false);
                });
            } catch (err) {
                console.error('Autocomplete init error:', err);
            }
        };

        loadGoogleMaps();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!address.street && !quoteAddress) {
            toast.error("Please enter your property address");
            return;
        }
        
        onComplete({
            name: name || address.street || quoteAddress || 'My Home',
            address: address.street ? address : { street: quoteAddress, city: '', state: '', zip: '' },
            coordinates
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Property Nickname (optional)
                </label>
                <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. My Home, Beach House"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Property Address *
                </label>
                
                {quoteAddress && (
                    <div className="mb-3">
                        <button
                            type="button"
                            onClick={() => {
                                setUseQuoteAddress(true);
                                setAddress({ street: quoteAddress, city: '', state: '', zip: '', placeId: '' });
                            }}
                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                useQuoteAddress 
                                    ? 'border-emerald-500 bg-emerald-50' 
                                    : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <MapPin className={`h-4 w-4 ${useQuoteAddress ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <span className="text-sm font-medium text-slate-700">Use address from quote:</span>
                            </div>
                            <p className="text-slate-600 text-sm mt-1 ml-6">{quoteAddress}</p>
                        </button>
                    </div>
                )}
                
                <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={useQuoteAddress ? '' : (address.street || '')}
                        onChange={(e) => {
                            setUseQuoteAddress(false);
                            setAddress(prev => ({ ...prev, street: e.target.value }));
                        }}
                        placeholder={useQuoteAddress ? "Or type a different address..." : "Start typing your address..."}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
                
                {!useQuoteAddress && address.street && address.city && (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm">
                        <p className="font-medium text-emerald-900">{address.street}</p>
                        <p className="text-emerald-700">{address.city}, {address.state} {address.zip}</p>
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isSaving ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <CheckCircle size={18} />
                        Confirm & Save Quote
                    </>
                )}
            </button>
        </form>
    );
};

// ============================================
// PROPERTY CONFIRMATION MODAL
// ============================================
const PropertyConfirmationModal = ({ 
    isOpen, 
    onClose, 
    properties, 
    quoteAddress,
    onSelectProperty,
    onCreateProperty,
    isSaving,
    userName
}) => {
    const [mode, setMode] = useState('select'); // 'select' | 'create'
    const [selectedId, setSelectedId] = useState(null);
    
    // Auto-select matching property
    useEffect(() => {
        if (properties.length === 1) {
            setSelectedId(properties[0].id);
        } else if (quoteAddress && properties.length > 0) {
            const match = properties.find(p => addressesMatch(quoteAddress, p.address));
            if (match) {
                setSelectedId(match.id);
            }
        }
    }, [quoteAddress, properties]);

    // Reset mode when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode(properties.length === 0 ? 'create' : 'select');
        }
    }, [isOpen, properties.length]);
    
    if (!isOpen) return null;
    
    const selectedProperty = properties.find(p => p.id === selectedId);
    const hasAddressMismatch = selectedProperty && quoteAddress && 
        !addressesMatch(quoteAddress, selectedProperty.address);
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800">
                        {mode === 'create' 
                            ? (properties.length === 0 ? 'Set Up Your Property' : 'Add New Property')
                            : 'Confirm Property'
                        }
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {mode === 'create'
                            ? 'Tell us where this quote is for'
                            : 'Which property is this quote for?'
                        }
                    </p>
                </div>
                
                <div className="p-6">
                    {/* Quote Address Reference */}
                    {quoteAddress && (
                        <div className="bg-slate-50 rounded-xl p-4 mb-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                                Quote Service Address
                            </p>
                            <p className="text-slate-800 font-medium">{quoteAddress}</p>
                        </div>
                    )}
                    
                    {mode === 'select' ? (
                        <>
                            {/* Property Selection */}
                            <div className="space-y-3 mb-4">
                                {properties.map((prop) => {
                                    const propAddress = typeof prop.address === 'string' 
                                        ? prop.address 
                                        : prop.address?.street;
                                    const mismatch = quoteAddress && !addressesMatch(quoteAddress, prop.address);
                                    
                                    return (
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
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800">{prop.name}</p>
                                                    <p className="text-sm text-slate-500">{propAddress}</p>
                                                </div>
                                                {selectedId === prop.id && (
                                                    <CheckCircle className="text-emerald-600" />
                                                )}
                                            </div>
                                            {mismatch && selectedId === prop.id && (
                                                <div className="mt-2 flex items-center gap-2 text-amber-600 text-xs">
                                                    <AlertTriangle size={14} />
                                                    <span>Address doesn't match quote</span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                                
                                {/* Add New Property Option */}
                                <button
                                    onClick={() => setMode('create')}
                                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 
                                               text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                                >
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <Plus />
                                        <span className="font-medium">Add as a new property</span>
                                    </div>
                                </button>
                            </div>
                            
                            {/* Mismatch Warning */}
                            {hasAddressMismatch && (
                                <AddressMismatchWarning 
                                    quoteAddress={quoteAddress} 
                                    propertyAddress={selectedProperty?.address} 
                                />
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => onSelectProperty(selectedId)}
                                    disabled={!selectedId || isSaving}
                                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold 
                                               disabled:opacity-50 hover:bg-emerald-700 transition-colors
                                               flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        'Save Quote'
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Property Creation Form */}
                            <PropertyCreationForm
                                quoteAddress={quoteAddress}
                                onComplete={onCreateProperty}
                                isSaving={isSaving}
                            />
                            
                            {properties.length > 0 && (
                                <button
                                    onClick={() => setMode('select')}
                                    className="w-full mt-4 py-2 text-slate-600 text-sm hover:text-emerald-600 transition-colors"
                                >
                                    ← Back to property selection
                                </button>
                            )}
                        </>
                    )}
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
                    Are you sure you want to decline this quote? The contractor will be notified.
                </p>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Reason (optional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Let them know why..."
                        className="w-full p-3 border border-slate-200 rounded-xl resize-none h-24 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Decline Quote'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// LINE ITEM TYPE BADGE
// ============================================
const LineItemTypeBadge = ({ type }) => {
    if (type === 'labor') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                <Wrench size={10} />
                Labor
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            <Package size={10} />
            Material
        </span>
    );
};

// ============================================
// QUOTE CONTENT
// ============================================
const QuoteContent = ({ 
    quote, 
    contractor, 
    contractorId,
    user,
    onAccept, 
    onDecline,
    onSaveToKrib,
    isSaving,
    isAccepting,
    alreadyClaimed,
    onPayDeposit,
    isProcessingPayment
}) => {
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);
    
    const handleDecline = async (reason) => {
        setIsSubmittingDecline(true);
        try {
            await onDecline(reason);
            setShowDeclineModal(false);
        } finally {
            setIsSubmittingDecline(false);
        }
    };

    const statusConfig = {
        draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600' },
        sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
        viewed: { label: 'Viewed', bg: 'bg-purple-100', text: 'text-purple-700' },
        accepted: { label: 'Accepted', bg: 'bg-emerald-100', text: 'text-emerald-700' },
        declined: { label: 'Declined', bg: 'bg-red-100', text: 'text-red-700' },
        expired: { label: 'Expired', bg: 'bg-amber-100', text: 'text-amber-700' }
    };

    const status = statusConfig[quote.status] || statusConfig.draft;
    const canAccept = ['sent', 'viewed'].includes(quote.status);
    const isAccepted = quote.status === 'accepted';
    
    return (
        <div className="min-h-screen bg-slate-50 pb-40">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 py-8">
                <div className="max-w-2xl mx-auto">
                    {contractor?.logoUrl ? (
                        <img 
                            src={contractor.logoUrl} 
                            alt={contractor.companyName} 
                            className="h-12 w-auto mb-4 rounded-lg"
                        />
                    ) : (
                        <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                            <Building2 className="h-6 w-6 text-white/60" />
                        </div>
                    )}
                    
                    <h1 className="text-2xl font-bold mb-1">
                        {contractor?.companyName || 'Service Quote'}
                    </h1>
                    <p className="text-white/70">Quote #{quote.quoteNumber}</p>
                    
                    <div className="flex items-center gap-4 mt-4 text-sm">
                        <span className={`px-3 py-1 rounded-full ${status.bg} ${status.text} font-medium`}>
                            {status.label}
                        </span>
                        <span className="text-white/60">
                            Created {formatDate(quote.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Content */}
            <div className="max-w-2xl mx-auto px-4 -mt-4">
                {/* Main Quote Card */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
                    {/* Quote Title */}
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-800">{quote.title || 'Service Quote'}</h2>
                        {quote.estimatedDuration && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                                <Timer size={16} className="text-slate-400" />
                                <span>Estimated Duration: {quote.estimatedDuration}</span>
                            </div>
                        )}
                        {quote.notes && (
                            <p className="text-slate-600 mt-3">{quote.notes}</p>
                        )}
                    </div>
                    
                    {/* Customer Info */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
                            Service For
                        </h3>
                        <div className="space-y-2">
                            {quote.customer?.name && (
                                <div className="flex items-center gap-2 text-slate-700">
                                    <User size={16} className="text-slate-400" />
                                    <span>{quote.customer.name}</span>
                                </div>
                            )}
                            {quote.customer?.address && (
                                <div className="flex items-center gap-2 text-slate-700">
                                    <MapPin size={16} className="text-slate-400" />
                                    <span>{quote.customer.address}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Line Items - FULL DETAILS */}
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                            Quote Details
                        </h3>
                        <div className="space-y-4">
                            {(quote.lineItems || []).map((item, idx) => (
                                <div key={idx} className="py-3 border-b border-slate-100 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            {/* Type Badge */}
                                            <div className="mb-1">
                                                <LineItemTypeBadge type={item.type} />
                                            </div>
                                            
                                            {/* Description */}
                                            <p className="font-medium text-slate-800">{item.description}</p>
                                            
                                            {/* Brand and Model (for materials) */}
                                            {item.type === 'material' && (item.brand || item.model) && (
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {item.brand}{item.brand && item.model && ' • '}{item.model}
                                                </p>
                                            )}
                                            
                                            {/* Crew Size (for labor) */}
                                            {item.type === 'labor' && item.crewSize && (
                                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                                    <Users size={12} />
                                                    {item.crewSize} technician{item.crewSize > 1 ? 's' : ''}
                                                </p>
                                            )}
                                            
                                            {/* Item-specific Warranty */}
{item.warranty && (
    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
        <Shield size={12} />
        {item.warranty.toLowerCase().includes('warranty') 
            ? item.warranty 
            : `${item.warranty} Warranty`}
    </p>
)}
                                            
                                            {/* Quantity */}
                                            {item.quantity > 1 && (
                                                <p className="text-sm text-slate-500 mt-1">
                                                    {item.quantity} × {formatCurrency(item.unitPrice)}
                                                </p>
                                            )}
                                        </div>
                                        <p className="font-semibold text-slate-800">
                                            {formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Totals */}
                    <div className="p-6 bg-slate-50">
                        <div className="space-y-2">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span>{formatCurrency(quote.subtotal)}</span>
                            </div>
                            {quote.taxAmount > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Tax ({quote.taxRate}%)</span>
                                    <span>{formatCurrency(quote.taxAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-bold text-slate-800 pt-2 border-t border-slate-200">
                                <span>Total</span>
                                <span className="text-emerald-600">{formatCurrency(quote.total)}</span>
                            </div>
                        </div>
                        
                        {quote.depositRequired && quote.depositAmount > 0 && (
                            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-amber-800">Deposit Required</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            {formatCurrency(quote.depositAmount)} due upon acceptance
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-amber-800">
                                            {formatCurrency(quote.depositAmount)}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Show payment status if already paid */}
                                {quote.payment?.depositPaid && (
                                    <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-100 px-3 py-2 rounded-lg">
                                        <CheckCircle size={16} />
                                        <span className="text-sm font-medium">Deposit Paid</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Exclusions */}
                {quote.exclusions && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-amber-500" />
                            Not Included
                        </h3>
                        <p className="text-slate-600 text-sm">{quote.exclusions}</p>
                    </div>
                )}
                
                {/* Terms & Warranty */}
                {(quote.terms || quote.clientWarranty) && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        {quote.terms && (
                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">
                                    Terms & Conditions
                                </h3>
                                <p className="text-slate-600 text-sm">{quote.terms}</p>
                            </div>
                        )}
                        {quote.clientWarranty && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <Shield size={14} className="text-emerald-600" />
                                    Labor/Workmanship Warranty
                                </h3>
                                <p className="text-slate-600 text-sm">{quote.clientWarranty}</p>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Contractor Contact */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                        Questions? Contact Us
                    </h3>
                    <div className="space-y-3">
                        {contractor?.phone && (
                            <a href={`tel:${contractor.phone}`} className="flex items-center gap-3 text-slate-700 hover:text-emerald-600">
                                <Phone size={18} className="text-slate-400" />
                                {contractor.phone}
                            </a>
                        )}
                        {contractor?.email && (
                            <a href={`mailto:${contractor.email}`} className="flex items-center gap-3 text-slate-700 hover:text-emerald-600">
                                <Mail size={18} className="text-slate-400" />
                                {contractor.email}
                            </a>
                        )}
                    </div>
                </div>
                
                {/* Status Messages */}
                {isAccepted && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center mb-6">
                        <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                        <p className="font-bold text-emerald-800">Quote Accepted</p>
                        <p className="text-sm text-emerald-600 mt-1">
                            Accepted on {formatDate(quote.acceptedAt)}
                        </p>
                    </div>
                )}
                
                {quote.status === 'declined' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center mb-6">
                        <XCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                        <p className="font-bold text-slate-600">Quote Declined</p>
                        <p className="text-sm text-slate-500 mt-1">
                            Declined on {formatDate(quote.declinedAt)}
                        </p>
                    </div>
                )}
            </div>
            
            {/* Fixed Bottom Actions - SAVE TO KRIB PRIMARY */}
            {canAccept && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg">
                    <div className="max-w-2xl mx-auto">
                        {/* Primary CTA: Save to Krib */}
                        {!alreadyClaimed && (
                            <button
                                onClick={onSaveToKrib}
                                disabled={isSaving}
                                className="w-full py-4 mb-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <BookmarkPlus size={20} />
                                        Save to Krib — Track This Quote
                                    </>
                                )}
                            </button>
                        )}
                        
                        {/* Secondary: Accept / Decline */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeclineModal(true)}
                                className="flex-1 py-3 border-2 border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Decline
                            </button>
                            
                            {/* Accept with Deposit Payment */}
                            {quote.depositRequired && quote.depositAmount > 0 && contractor?.stripe?.accountId && contractor?.stripe?.isComplete ? (
                                <button
                                    onClick={onPayDeposit}
                                    disabled={isAccepting || isProcessingPayment}
                                    className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessingPayment ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <DollarSign size={18} />
                                            Accept & Pay {formatCurrency(quote.depositAmount)}
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={onAccept}
                                    disabled={isAccepting}
                                    className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isAccepting ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            Accept
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                        
                        <p className="text-center text-xs text-slate-400 mt-3">
                            Powered by <a href="/" className="text-emerald-600 hover:underline">Krib</a>
                        </p>
                    </div>
                </div>
            )}
            
            <DeclineModal
                isOpen={showDeclineModal}
                onClose={() => setShowDeclineModal(false)}
                onConfirm={handleDecline}
                isSubmitting={isSubmittingDecline}
            />
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
    
    // Auth & Action State
    const [showAuth, setShowAuth] = useState(false);
    const [authAction, setAuthAction] = useState('save'); // 'save' | 'accept'
    const [pendingAction, setPendingAction] = useState(null); // 'save' | 'accept'
    const [isClaiming, setIsClaiming] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [alreadyClaimed, setAlreadyClaimed] = useState(false);
    
    // Property State
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [userProperties, setUserProperties] = useState([]);
    const [userProfile, setUserProfile] = useState(null);

    // Check if already claimed
    useEffect(() => {
        if (user && data?.quote?.customerId === user.uid) {
            setAlreadyClaimed(true);
        }
    }, [user, data]);

    // Load quote with proper timeout handling
    useEffect(() => {
        let isMounted = true;
        let timeoutId = null;

        const loadQuote = async () => {
            try {
                const result = await getQuoteByShareToken(shareToken);
                
                if (!isMounted) return;
                
                // Clear timeout on successful load
                if (timeoutId) clearTimeout(timeoutId);

                if (!result || !result.quote) {
                    setError('This quote could not be found.');
                    setLoading(false);
                    return;
                }
                
                setData(result);
                setLoading(false);
                
                if (result.quote.status === 'sent') {
                    markQuoteViewed(result.contractorId, result.quote.id)
                        .catch(e => console.warn("View update failed:", e));
                }
            } catch (err) {
                if (!isMounted) return;
                if (timeoutId) clearTimeout(timeoutId);
                console.error('Error loading quote:', err);
                setError('Unable to load this quote.');
                setLoading(false);
            }
        };
        
        loadQuote();

        timeoutId = setTimeout(() => {
            if (isMounted) {
                setLoading(false);
                setError('Request timed out. Please refresh.');
            }
        }, 10000);

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [shareToken]);

    // Load user profile and properties when user logs in
    useEffect(() => {
        if (!user) return;
        
        const loadUserData = async () => {
            try {
                const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);
                
                if (profileSnap.exists()) {
                    const profileData = profileSnap.data();
                    setUserProfile(profileData);
                    
                    let props = profileData.properties || [];

// Add legacy property if no properties exist but address does
if (props.length === 0 && profileData.address) {
    props.push({
        id: 'legacy',
        name: profileData.name || 'My Home',
        address: profileData.address,
        coordinates: profileData.coordinates
    });
}

// Deduplicate properties by ID (in case of duplicates in database)
const seen = new Set();
props = props.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
});

setUserProperties(props);
                }
            } catch (err) {
                console.error('Error loading user data:', err);
            }
        };
        
        loadUserData();
    }, [user]);

    // Handle auth success - continue pending action
    // Handle auth success - continue pending action
    // Note: We use a small delay to allow the user state to propagate from parent
    const handleAuthSuccess = () => {
        setShowAuth(false);
        const action = pendingAction;
        setPendingAction(null);
        
        // Small delay to allow auth state to propagate, then trigger action
        setTimeout(() => {
            if (action === 'accept') {
                // Directly accept without re-checking user (we just authenticated)
                setIsAccepting(true);
                acceptQuote(data.contractorId, data.quote.id)
                    .then(() => {
                        setAccepted(true);
                        toast.success('Quote accepted! The contractor will be in touch to schedule.');
                    })
                    .catch((err) => {
                        console.error('Error accepting quote:', err);
                        toast.error('Failed to accept quote. Please try again.');
                    })
                    .finally(() => setIsAccepting(false));
            } else if (action === 'save') {
                // Open property modal directly (we just authenticated)
                setShowPropertyModal(true);
            }
        }, 100);
    };

    // Create property and claim quote
    const handleCreateProperty = async (propertyData) => {
        setIsClaiming(true);
        
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);
            const existingProfile = profileSnap.exists() ? profileSnap.data() : {};
            
            const newPropertyId = Date.now().toString();
            const newProperty = {
                id: newPropertyId,
                name: propertyData.name,
                address: propertyData.address,
                coordinates: propertyData.coordinates || null
            };
            
            const existingProperties = existingProfile.properties || [];
            const updatedProperties = [...existingProperties, newProperty];
            
            await setDoc(profileRef, {
                ...existingProfile,
                properties: updatedProperties,
                activePropertyId: newPropertyId,
                hasSeenWelcome: true,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            await claimQuote(data.contractorId, data.quote.id, user.uid, newPropertyId);
            
            // Add contractor to homeowner's Pros list for messaging
            await addContractorToProsList(user.uid, {
                contractorId: data.contractorId,
                companyName: data.contractor?.companyName,
                email: data.contractor?.email,
                phone: data.contractor?.phone,
                logoUrl: data.contractor?.logoUrl
            }, data.quote?.title);
            
            // Create chat channel for quote discussion
            await createQuoteChatChannel(
                user.uid,
                data.contractorId,
                data.contractor?.companyName || 'Contractor',
                propertyData.name || 'Homeowner',
                data.quote.id,
                data.quote?.title
            );
            
            toast.success('Quote saved to your account!');
            setShowPropertyModal(false);
            setAlreadyClaimed(true);
            
            await waitForPendingWrites(db).catch(() => {});
            await new Promise(r => setTimeout(r, 300));
            
            window.location.href = window.location.origin + '/app?from=quote';
            
        } catch (err) {
            console.error('Error creating property:', err);
            toast.error('Failed to save. Please try again.');
            setIsClaiming(false);
        }
    };

    // Select existing property and claim quote
    const handleSelectProperty = async (propertyId) => {
        setIsClaiming(true);
        
        try {
            await claimQuote(data.contractorId, data.quote.id, user.uid, propertyId);
            
            // Add contractor to homeowner's Pros list for messaging
            await addContractorToProsList(user.uid, {
                contractorId: data.contractorId,
                companyName: data.contractor?.companyName,
                email: data.contractor?.email,
                phone: data.contractor?.phone,
                logoUrl: data.contractor?.logoUrl
            }, data.quote?.title);
            
            // Create chat channel for quote discussion
            await createQuoteChatChannel(
                user.uid,
                data.contractorId,
                data.contractor?.companyName || 'Contractor',
                userProfile?.name || 'Homeowner',
                data.quote.id,
                data.quote?.title
            );
            
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            await updateDoc(profileRef, { 
                hasSeenWelcome: true,
                updatedAt: serverTimestamp()
            }).catch(() => {});
            
            toast.success('Quote saved to your account!');
            setShowPropertyModal(false);
            setAlreadyClaimed(true);
            
            await waitForPendingWrites(db).catch(() => {});
            await new Promise(r => setTimeout(r, 300));
            
            window.location.href = window.location.origin + '/app?from=quote';
            
        } catch (err) {
            console.error('Error claiming quote:', err);
            toast.error('Failed to save quote.');
            setIsClaiming(false);
        }
    };

    // Handle Save to Krib button click
    const handleSaveToKrib = async () => {
        if (!user) {
            setPendingAction('save');
            setAuthAction('save');
            setShowAuth(true);
            
            if (data?.quote?.customer?.address) {
                try {
                    localStorage.setItem('pendingQuoteAddress', data.quote.customer.address);
                } catch (e) {}
            }
            return;
        }

        if (alreadyClaimed) {
            toast.info('This quote is already in your account');
            window.location.href = window.location.origin + '/app?from=quote';
            return;
        }

        if (isClaiming) return;

        setShowPropertyModal(true);
    };

    // Handle Pay Deposit (Accept + Pay)
    const handlePayDeposit = async () => {
        if (!user) {
            setPendingAction('accept');
            setAuthAction('accept');
            setShowAuth(true);
            return;
        }

        setIsProcessingPayment(true);
        
        try {
            // First accept the quote
            await acceptQuote(data.contractorId, data.quote.id);
            
            // Then redirect to Stripe Checkout for deposit
            const checkoutResult = await createPaymentCheckout({
                stripeAccountId: data.contractor?.stripe?.accountId,
                amount: data.quote.depositAmount,
                type: 'deposit',
                quoteId: data.quote.id,
                jobId: null, // Job will be created, but we don't have ID yet
                contractorId: data.contractorId,
                title: data.quote.title || 'Service Quote',
                description: `Deposit for Quote #${data.quote.quoteNumber}`,
                customerEmail: user.email || data.quote.customer?.email,
                customerName: data.quote.customer?.name
            });
            
            // Redirect to Stripe Checkout
            window.location.href = checkoutResult.checkoutUrl;
            
        } catch (err) {
            console.error('Error processing payment:', err);
            toast.error(err.message || 'Failed to process payment. Please try again.');
            setIsProcessingPayment(false);
        }
    };

    // Handle Accept Quote button click
    const handleAccept = async () => {
        if (!user) {
            setPendingAction('accept');
            setAuthAction('accept');
            setShowAuth(true);
            return;
        }

        setIsAccepting(true);
        
        try {
            await acceptQuote(data.contractorId, data.quote.id);
            setAccepted(true);
            toast.success('Quote accepted! The contractor will be in touch to schedule.');
        } catch (err) {
            console.error('Error accepting quote:', err);
            toast.error('Failed to accept quote. Please try again.');
        } finally {
            setIsAccepting(false);
        }
    };

    // Handle Decline Quote
    const handleDecline = async (reason) => {
        try {
            await declineQuote(data.contractorId, data.quote.id, reason);
            const result = await getQuoteByShareToken(shareToken);
            setData(result);
            toast.success('Quote declined');
        } catch (err) {
            console.error('Error declining quote:', err);
            toast.error('Failed to decline quote.');
        }
    };
    
    // Render states
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} />;
    if (!data) return <ErrorState message="Quote not found" />;
    if (data.quote.status === 'expired') return <ExpiredState quote={data.quote} contractor={data.contractor} />;
    if (accepted) return <SuccessState quote={data.quote} contractor={data.contractor} />;
    
    return (
        <>
            {/* Auth Modal - using QuoteAuthScreen */}
            {showAuth && (
                <QuoteAuthScreen
                    quote={data.quote}
                    contractor={data.contractor}
                    action={authAction}
                    onSuccess={handleAuthSuccess}
                    onClose={() => {
                        setShowAuth(false);
                        setPendingAction(null);
                    }}
                />
            )}

            {/* Property Confirmation Modal */}
            <PropertyConfirmationModal
                isOpen={showPropertyModal}
                onClose={() => setShowPropertyModal(false)}
                properties={userProperties}
                quoteAddress={data.quote.customer?.address}
                onSelectProperty={handleSelectProperty}
                onCreateProperty={handleCreateProperty}
                isSaving={isClaiming}
                userName={userProfile?.name || user?.displayName}
            />

            {/* Main Quote Content */}
            <QuoteContent
                quote={data.quote}
                contractor={data.contractor}
                contractorId={data.contractorId}
                user={user}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onSaveToKrib={handleSaveToKrib}
                isSaving={isClaiming}
                isAccepting={isAccepting}
                alreadyClaimed={alreadyClaimed}
                onPayDeposit={handlePayDeposit}
                isProcessingPayment={isProcessingPayment}
            />
        </>
    );
};

export default PublicQuoteView;
