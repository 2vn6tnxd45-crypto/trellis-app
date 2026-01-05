// src/features/marketplace/components/ContractorLeadDashboard.jsx
// ============================================
// CONTRACTOR LEAD DASHBOARD
// ============================================
// Shows incoming service requests that match contractor's profile.
// Free to view, competitive bidding model.

import React, { useState, useEffect } from 'react';
import { 
    Bell, MapPin, Clock, DollarSign, ChevronRight, Filter,
    AlertTriangle, Shield, Award, Eye, MessageSquare, Send,
    Loader2, RefreshCw, Star, X, CheckCircle, Camera
} from 'lucide-react';
import { 
    SERVICE_CATEGORIES,
    URGENCY_LEVELS,
    getOpenRequestsForContractor,
    subscribeToOpenRequests,
    submitContractorResponse,
    incrementRequestView
} from '../lib/serviceRequestService';

const ContractorLeadDashboard = ({ 
    contractorId,
    contractorProfile,
    onStartChat 
}) => {
    // State
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showResponseModal, setShowResponseModal] = useState(false);
    
    // ============================================
    // LOAD REQUESTS
    // ============================================
    
    useEffect(() => {
        if (!contractorProfile) return;
        
        // Real-time subscription
        const unsubscribe = subscribeToOpenRequests(contractorProfile, (newRequests) => {
            setRequests(newRequests);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [contractorProfile]);
    
    // Filter by category
    const filteredRequests = selectedCategory
        ? requests.filter(r => r.category === selectedCategory)
        : requests;
    
    // Sort by urgency (emergencies first)
    const sortedRequests = [...filteredRequests].sort((a, b) => {
        const urgencyOrder = { emergency: 0, this_week: 1, flexible: 2 };
        return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
    });
    
    // ============================================
    // VIEW REQUEST DETAIL
    // ============================================
    
    const handleViewRequest = async (request) => {
        setSelectedRequest(request);
        // Increment view count
        await incrementRequestView(request.id);
    };
    
    // ============================================
    // RENDER
    // ============================================
    
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
        );
    }
    
    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <Bell className="text-emerald-600 mr-3" size={28} />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Available Leads</h1>
                        <p className="text-slate-500">Service requests in your area</p>
                    </div>
                </div>
                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-full">
                    {requests.length} {requests.length === 1 ? 'Lead' : 'Leads'}
                </span>
            </div>
            
            {/* Category Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => setSelectedCategory(null)}
                    className={`
                        px-4 py-2 rounded-full font-medium whitespace-nowrap transition
                        ${!selectedCategory 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                    `}
                >
                    All
                </button>
                {SERVICE_CATEGORIES.slice(0, 8).map(cat => {
                    const count = requests.filter(r => r.category === cat.id).length;
                    if (count === 0) return null;
                    
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`
                                px-4 py-2 rounded-full font-medium whitespace-nowrap transition flex items-center
                                ${selectedCategory === cat.id 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }
                            `}
                        >
                            {cat.label}
                            <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
            
            {/* Request List */}
            {sortedRequests.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                    <Bell className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">No Leads Right Now</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                        When homeowners in your area post requests that match your services, 
                        they'll appear here. Check back soon!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedRequests.map(request => (
                        <RequestCard 
                            key={request.id}
                            request={request}
                            onView={() => handleViewRequest(request)}
                            onRespond={() => {
                                setSelectedRequest(request);
                                setShowResponseModal(true);
                            }}
                        />
                    ))}
                </div>
            )}
            
            {/* Request Detail Modal */}
            {selectedRequest && !showResponseModal && (
                <RequestDetailModal
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onRespond={() => setShowResponseModal(true)}
                    onMessage={() => onStartChat?.(selectedRequest.homeownerId, selectedRequest.id)}
                />
            )}
            
            {/* Response Modal */}
            {showResponseModal && selectedRequest && (
                <ResponseModal
                    request={selectedRequest}
                    contractorId={contractorId}
                    contractorProfile={contractorProfile}
                    onClose={() => {
                        setShowResponseModal(false);
                        setSelectedRequest(null);
                    }}
                    onSuccess={() => {
                        setShowResponseModal(false);
                        setSelectedRequest(null);
                    }}
                />
            )}
        </div>
    );
};

// ============================================
// REQUEST CARD COMPONENT
// ============================================

const RequestCard = ({ request, onView, onRespond }) => {
    const category = SERVICE_CATEGORIES.find(c => c.id === request.category);
    const isEmergency = request.urgency === URGENCY_LEVELS.EMERGENCY;
    const isThisWeek = request.urgency === URGENCY_LEVELS.THIS_WEEK;
    
    const timeAgo = getTimeAgo(request.createdAt?.toDate?.() || new Date());
    
    return (
        <div 
            className={`
                bg-white border rounded-2xl p-5 hover:shadow-md transition cursor-pointer
                ${isEmergency ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}
            `}
            onClick={onView}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    {/* Urgency Badge */}
                    <div className="flex items-center gap-2 mb-2">
                        {isEmergency && (
                            <span className="flex items-center px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                                <AlertTriangle size={12} className="mr-1" />
                                EMERGENCY
                            </span>
                        )}
                        {isThisWeek && (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                                THIS WEEK
                            </span>
                        )}
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                            {category?.label || request.category}
                        </span>
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-lg font-bold text-slate-800 mb-1">
                        {request.title}
                    </h3>
                    
                    {/* Description Preview */}
                    {request.description && (
                        <p className="text-slate-600 text-sm line-clamp-2 mb-3">
                            {request.description}
                        </p>
                    )}
                    
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center">
                            <MapPin size={14} className="mr-1" />
                            {request.city || request.zipCode}
                        </span>
                        <span className="flex items-center">
                            <Clock size={14} className="mr-1" />
                            {timeAgo}
                        </span>
                        {request.showBudget && request.budgetRange && (
                            <span className="flex items-center text-emerald-600">
                                <DollarSign size={14} className="mr-1" />
                                {formatBudget(request.budgetRange)}
                            </span>
                        )}
                        <span className="flex items-center">
                            <Eye size={14} className="mr-1" />
                            {request.viewCount || 0} views
                        </span>
                        <span className="flex items-center">
                            <MessageSquare size={14} className="mr-1" />
                            {request.responseCount || 0} responses
                        </span>
                    </div>
                    
                    {/* Requirements */}
                    {(request.requirements?.mustBeInsured || request.requirements?.mustBeLicensed) && (
                        <div className="flex gap-2 mt-3">
                            {request.requirements.mustBeInsured && (
                                <span className="flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                    <Shield size={12} className="mr-1" /> Insured
                                </span>
                            )}
                            {request.requirements.mustBeLicensed && (
                                <span className="flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                    <Award size={12} className="mr-1" /> Licensed
                                </span>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Photos Preview */}
                {request.photos?.length > 0 && (
                    <div className="ml-4 flex-shrink-0">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                            <img 
                                src={request.photos[0]} 
                                alt=""
                                className="w-full h-full object-cover"
                            />
                            {request.photos.length > 1 && (
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-xs rounded">
                                    +{request.photos.length - 1}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <ChevronRight className="ml-4 text-slate-400" size={20} />
            </div>
            
            {/* Quick Action */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRespond();
                    }}
                    className="flex items-center px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition"
                >
                    <Send size={16} className="mr-2" />
                    Respond
                </button>
            </div>
        </div>
    );
};

// ============================================
// REQUEST DETAIL MODAL
// ============================================

const RequestDetailModal = ({ request, onClose, onRespond, onMessage }) => {
    const category = SERVICE_CATEGORIES.find(c => c.id === request.category);
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-start justify-between">
                    <div>
                        <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase mb-2">
                            {category?.label}
                        </span>
                        <h2 className="text-xl font-bold text-slate-800">{request.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Urgency */}
                    <div className={`
                        p-4 rounded-xl
                        ${request.urgency === URGENCY_LEVELS.EMERGENCY ? 'bg-red-50 border border-red-100' : ''}
                        ${request.urgency === URGENCY_LEVELS.THIS_WEEK ? 'bg-amber-50 border border-amber-100' : ''}
                        ${request.urgency === URGENCY_LEVELS.FLEXIBLE ? 'bg-slate-50 border border-slate-100' : ''}
                    `}>
                        <div className="flex items-center">
                            <Clock size={20} className={`mr-2 ${request.urgency === URGENCY_LEVELS.EMERGENCY ? 'text-red-600' : 'text-slate-500'}`} />
                            <span className="font-medium">
                                {request.urgency === URGENCY_LEVELS.EMERGENCY && 'Emergency - Same Day'}
                                {request.urgency === URGENCY_LEVELS.THIS_WEEK && 'Needed This Week'}
                                {request.urgency === URGENCY_LEVELS.FLEXIBLE && 'Flexible Timing'}
                            </span>
                        </div>
                    </div>
                    
                    {/* Description */}
                    {request.description && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Details</h3>
                            <p className="text-slate-700 whitespace-pre-wrap">{request.description}</p>
                        </div>
                    )}
                    
                    {/* Photos */}
                    {request.photos?.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Photos</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {request.photos.map((photo, i) => (
                                    <img 
                                        key={i}
                                        src={photo}
                                        alt=""
                                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Location */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Location</h3>
                        <div className="flex items-center text-slate-700">
                            <MapPin size={18} className="mr-2 text-slate-400" />
                            {request.city && request.state 
                                ? `${request.city}, ${request.state}` 
                                : `ZIP: ${request.zipCode}`
                            }
                        </div>
                    </div>
                    
                    {/* Budget */}
                    {request.showBudget && request.budgetRange && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Budget Range</h3>
                            <div className="flex items-center text-emerald-600 font-medium">
                                <DollarSign size={18} className="mr-2" />
                                {formatBudget(request.budgetRange)}
                            </div>
                        </div>
                    )}
                    
                    {/* Requirements */}
                    {(request.requirements?.mustBeInsured || request.requirements?.mustBeLicensed) && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Requirements</h3>
                            <div className="flex gap-3">
                                {request.requirements.mustBeInsured && (
                                    <div className="flex items-center bg-slate-100 px-3 py-2 rounded-lg">
                                        <Shield size={16} className="mr-2 text-slate-500" />
                                        <span className="text-slate-700">Must be Insured</span>
                                    </div>
                                )}
                                {request.requirements.mustBeLicensed && (
                                    <div className="flex items-center bg-slate-100 px-3 py-2 rounded-lg">
                                        <Award size={16} className="mr-2 text-slate-500" />
                                        <span className="text-slate-700">Must be Licensed</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Contact Preferences */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Contact Preferences</h3>
                        <div className="flex flex-wrap gap-2">
                            {request.contactPreferences?.allowMessages && (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                                    Messages OK
                                </span>
                            )}
                            {request.contactPreferences?.allowCalls && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                    Calls OK
                                </span>
                            )}
                            {request.contactPreferences?.allowTexts && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                                    Texts OK
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm text-slate-500 pt-4 border-t border-slate-100">
                        <span className="flex items-center">
                            <Eye size={16} className="mr-1" />
                            {request.viewCount || 0} contractors viewed
                        </span>
                        <span className="flex items-center">
                            <MessageSquare size={16} className="mr-1" />
                            {request.responseCount || 0} responses
                        </span>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition"
                    >
                        Close
                    </button>
                    <button
                        onClick={onRespond}
                        className="flex-1 flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition"
                    >
                        <Send size={18} className="mr-2" />
                        Submit Response
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// RESPONSE MODAL
// ============================================

const ResponseModal = ({ request, contractorId, contractorProfile, onClose, onSuccess }) => {
    const [message, setMessage] = useState('');
    const [estimateType, setEstimateType] = useState('range');
    const [estimateMin, setEstimateMin] = useState('');
    const [estimateMax, setEstimateMax] = useState('');
    const [estimateFixed, setEstimateFixed] = useState('');
    const [canDoEmergency, setCanDoEmergency] = useState(request.urgency === URGENCY_LEVELS.EMERGENCY);
    const [availabilityNote, setAvailabilityNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    
    const handleSubmit = async () => {
        if (!message.trim()) {
            setError('Please include a message');
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const result = await submitContractorResponse(request.id, contractorId, {
                message: message.trim(),
                estimateType,
                estimateRange: estimateType === 'range' ? {
                    min: estimateMin ? parseInt(estimateMin) : null,
                    max: estimateMax ? parseInt(estimateMax) : null
                } : estimateType === 'fixed' ? {
                    min: parseInt(estimateFixed),
                    max: parseInt(estimateFixed)
                } : null,
                canDoEmergency,
                availableDates: [], // Could add a date picker
                estimatedDuration: availabilityNote,
                
                // Contractor info for snapshot
                contractorName: contractorProfile?.name || contractorProfile?.ownerName,
                businessName: contractorProfile?.businessName,
                phone: contractorProfile?.phone,
                email: contractorProfile?.email,
                averageRating: contractorProfile?.averageRating,
                reviewCount: contractorProfile?.reviewCount,
                yearsInBusiness: contractorProfile?.yearsInBusiness,
                insured: contractorProfile?.insured,
                licensed: contractorProfile?.licensed,
                photoUrl: contractorProfile?.photoUrl || contractorProfile?.logoUrl
            });
            
            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || 'Failed to submit response');
            }
        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800">Respond to Lead</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-slate-500 mt-1">{request.title}</p>
                </div>
                
                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}
                    
                    {/* Message */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Your Message *
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Introduce yourself and let them know you can help. Be specific about your experience with this type of work..."
                            rows={4}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                        />
                    </div>
                    
                    {/* Estimate */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Estimate
                        </label>
                        
                        <div className="flex gap-2 mb-3">
                            {['range', 'fixed', 'need_evaluation'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setEstimateType(type)}
                                    className={`
                                        px-3 py-2 rounded-lg text-sm font-medium transition
                                        ${estimateType === type 
                                            ? 'bg-emerald-100 text-emerald-700' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }
                                    `}
                                >
                                    {type === 'range' && 'Price Range'}
                                    {type === 'fixed' && 'Fixed Price'}
                                    {type === 'need_evaluation' && 'Need to Evaluate'}
                                </button>
                            ))}
                        </div>
                        
                        {estimateType === 'range' && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center flex-1">
                                    <DollarSign size={16} className="text-slate-400" />
                                    <input
                                        type="number"
                                        value={estimateMin}
                                        onChange={(e) => setEstimateMin(e.target.value)}
                                        placeholder="Min"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <span className="text-slate-400">to</span>
                                <div className="flex items-center flex-1">
                                    <DollarSign size={16} className="text-slate-400" />
                                    <input
                                        type="number"
                                        value={estimateMax}
                                        onChange={(e) => setEstimateMax(e.target.value)}
                                        placeholder="Max"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}
                        
                        {estimateType === 'fixed' && (
                            <div className="flex items-center">
                                <DollarSign size={16} className="text-slate-400" />
                                <input
                                    type="number"
                                    value={estimateFixed}
                                    onChange={(e) => setEstimateFixed(e.target.value)}
                                    placeholder="Fixed price"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        )}
                        
                        {estimateType === 'need_evaluation' && (
                            <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                                You'll provide an estimate after evaluating the job in person or via photos/video.
                            </p>
                        )}
                    </div>
                    
                    {/* Emergency Availability */}
                    {request.urgency === URGENCY_LEVELS.EMERGENCY && (
                        <label className="flex items-center p-4 bg-red-50 rounded-xl cursor-pointer">
                            <input
                                type="checkbox"
                                checked={canDoEmergency}
                                onChange={(e) => setCanDoEmergency(e.target.checked)}
                                className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                            />
                            <AlertTriangle size={20} className="ml-3 text-red-500" />
                            <span className="ml-3 font-medium text-red-700">
                                I can respond to this emergency today
                            </span>
                        </label>
                    )}
                    
                    {/* Availability Note */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Availability Note <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={availabilityNote}
                            onChange={(e) => setAvailabilityNote(e.target.value)}
                            placeholder="e.g., Available tomorrow afternoon, Job takes 2-3 hours"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    
                    {/* Your Profile Preview */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-3">Your Profile (Shown to Homeowner)</p>
                        <div className="flex items-center">
                            {contractorProfile?.photoUrl || contractorProfile?.logoUrl ? (
                                <img 
                                    src={contractorProfile.photoUrl || contractorProfile.logoUrl}
                                    alt=""
                                    className="w-12 h-12 rounded-full object-cover mr-3"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mr-3">
                                    <span className="text-emerald-600 font-bold">
                                        {(contractorProfile?.businessName || 'C')[0]}
                                    </span>
                                </div>
                            )}
                            <div>
                                <p className="font-bold text-slate-800">
                                    {contractorProfile?.businessName || contractorProfile?.name}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-slate-500">
                                    {contractorProfile?.averageRating && (
                                        <span className="flex items-center">
                                            <Star size={14} className="text-amber-400 mr-1" fill="currentColor" />
                                            {contractorProfile.averageRating}
                                        </span>
                                    )}
                                    {contractorProfile?.yearsInBusiness && (
                                        <span>{contractorProfile.yearsInBusiness} yrs exp</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} className="mr-2" />
                                Submit Response
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

const formatBudget = (range) => {
    if (!range) return 'Not specified';
    const { min, max } = range;
    if (min && max) return `$${min} - $${max}`;
    if (min) return `$${min}+`;
    if (max) return `Up to $${max}`;
    return 'Not specified';
};

export default ContractorLeadDashboard;
