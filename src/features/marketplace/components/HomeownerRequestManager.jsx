// src/features/marketplace/components/HomeownerRequestManager.jsx
// ============================================
// HOMEOWNER REQUEST MANAGER
// ============================================
// Shows homeowner's active service requests and
// contractor responses. Allows selection/comparison.

import React, { useState, useEffect } from 'react';
import { 
    Megaphone, MessageSquare, Star, Phone, Mail, Clock, MapPin,
    ChevronRight, Check, X, Loader2, Eye, DollarSign, Shield,
    Award, User, Calendar, AlertTriangle, Trash2, CheckCircle
} from 'lucide-react';
import { 
    SERVICE_CATEGORIES,
    URGENCY_LEVELS,
    REQUEST_STATUS,
    getHomeownerRequests,
    getRequestResponses,
    selectContractor,
    cancelRequest
} from '../lib/serviceRequestService';

const HomeownerRequestManager = ({ 
    userId,
    onCreateNew,
    onMessageContractor,
    onScheduleJob 
}) => {
    // State
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [responses, setResponses] = useState([]);
    const [loadingResponses, setLoadingResponses] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(null);
    
    // ============================================
    // LOAD DATA
    // ============================================
    
    useEffect(() => {
        loadRequests();
    }, [userId]);
    
    const loadRequests = async () => {
        setLoading(true);
        const result = await getHomeownerRequests(userId);
        if (result.success) {
            setRequests(result.requests);
        }
        setLoading(false);
    };
    
    const loadResponses = async (requestId) => {
        setLoadingResponses(true);
        const result = await getRequestResponses(requestId);
        if (result.success) {
            setResponses(result.responses);
        }
        setLoadingResponses(false);
    };
    
    // ============================================
    // ACTIONS
    // ============================================
    
    const handleViewRequest = async (request) => {
        setSelectedRequest(request);
        await loadResponses(request.id);
    };
    
    const handleSelectContractor = async (contractorId) => {
        if (!selectedRequest) return;
        
        const result = await selectContractor(selectedRequest.id, contractorId, userId);
        if (result.success) {
            // Update local state
            setSelectedRequest(prev => ({
                ...prev,
                status: REQUEST_STATUS.SELECTED,
                selectedContractorId: contractorId
            }));
            setRequests(prev => prev.map(r => 
                r.id === selectedRequest.id 
                    ? { ...r, status: REQUEST_STATUS.SELECTED, selectedContractorId: contractorId }
                    : r
            ));
            
            // Optionally start scheduling flow
            const selectedResponse = responses.find(r => r.contractorId === contractorId);
            if (selectedResponse) {
                onScheduleJob?.(selectedRequest, selectedResponse);
            }
        }
    };
    
    const handleCancelRequest = async (requestId) => {
        const result = await cancelRequest(requestId, userId);
        if (result.success) {
            setRequests(prev => prev.map(r => 
                r.id === requestId 
                    ? { ...r, status: REQUEST_STATUS.CANCELLED }
                    : r
            ));
            setConfirmCancel(null);
            if (selectedRequest?.id === requestId) {
                setSelectedRequest(null);
            }
        }
    };
    
    // ============================================
    // CATEGORIZE REQUESTS
    // ============================================
    
    const activeRequests = requests.filter(r => 
        r.status === REQUEST_STATUS.OPEN || r.status === REQUEST_STATUS.REVIEWING
    );
    const selectedRequests = requests.filter(r => 
        r.status === REQUEST_STATUS.SELECTED || r.status === REQUEST_STATUS.SCHEDULED
    );
    const pastRequests = requests.filter(r => 
        r.status === REQUEST_STATUS.COMPLETED || 
        r.status === REQUEST_STATUS.CANCELLED || 
        r.status === REQUEST_STATUS.EXPIRED
    );
    
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
                    <Megaphone className="text-emerald-600 mr-3" size={28} />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">My Service Requests</h1>
                        <p className="text-slate-500">Track requests and view contractor responses</p>
                    </div>
                </div>
                <button
                    onClick={onCreateNew}
                    className="flex items-center px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition"
                >
                    <Megaphone size={18} className="mr-2" />
                    New Request
                </button>
            </div>
            
            {/* No Requests */}
            {requests.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                    <Megaphone className="mx-auto text-slate-300 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">No Requests Yet</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                        Need help with something? Create a service request and local contractors will respond with quotes.
                    </p>
                    <button
                        onClick={onCreateNew}
                        className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition"
                    >
                        Create Your First Request
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Active Requests */}
                    {activeRequests.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                                Active Requests
                            </h2>
                            <div className="space-y-4">
                                {activeRequests.map(request => (
                                    <RequestCard
                                        key={request.id}
                                        request={request}
                                        onClick={() => handleViewRequest(request)}
                                        onCancel={() => setConfirmCancel(request.id)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                    
                    {/* Selected/Scheduled */}
                    {selectedRequests.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                                <CheckCircle size={18} className="text-emerald-500 mr-2" />
                                Contractor Selected
                            </h2>
                            <div className="space-y-4">
                                {selectedRequests.map(request => (
                                    <RequestCard
                                        key={request.id}
                                        request={request}
                                        onClick={() => handleViewRequest(request)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                    
                    {/* Past Requests */}
                    {pastRequests.length > 0 && (
                        <section>
                            <h2 className="text-lg font-bold text-slate-500 mb-4">Past Requests</h2>
                            <div className="space-y-4 opacity-75">
                                {pastRequests.map(request => (
                                    <RequestCard
                                        key={request.id}
                                        request={request}
                                        onClick={() => handleViewRequest(request)}
                                        compact
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
            
            {/* Request Detail / Responses View */}
            {selectedRequest && (
                <RequestDetailView
                    request={selectedRequest}
                    responses={responses}
                    loading={loadingResponses}
                    onClose={() => setSelectedRequest(null)}
                    onSelectContractor={handleSelectContractor}
                    onMessageContractor={onMessageContractor}
                />
            )}
            
            {/* Cancel Confirmation Modal */}
            {confirmCancel && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Cancel Request?</h3>
                        <p className="text-slate-600 mb-6">
                            This will remove your request from the marketplace. Contractors will no longer be able to respond.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmCancel(null)}
                                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50"
                            >
                                Keep It
                            </button>
                            <button
                                onClick={() => handleCancelRequest(confirmCancel)}
                                className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700"
                            >
                                Cancel Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// REQUEST CARD
// ============================================

const RequestCard = ({ request, onClick, onCancel, compact }) => {
    const category = SERVICE_CATEGORIES.find(c => c.id === request.category);
    const isEmergency = request.urgency === URGENCY_LEVELS.EMERGENCY;
    const isOpen = request.status === REQUEST_STATUS.OPEN;
    const hasResponses = (request.responseCount || 0) > 0;
    
    const getStatusBadge = () => {
        switch (request.status) {
            case REQUEST_STATUS.OPEN:
                return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Open</span>;
            case REQUEST_STATUS.REVIEWING:
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">Reviewing</span>;
            case REQUEST_STATUS.SELECTED:
                return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">Selected</span>;
            case REQUEST_STATUS.SCHEDULED:
                return <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">Scheduled</span>;
            case REQUEST_STATUS.COMPLETED:
                return <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">Completed</span>;
            case REQUEST_STATUS.CANCELLED:
                return <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">Cancelled</span>;
            case REQUEST_STATUS.EXPIRED:
                return <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-bold rounded-full">Expired</span>;
            default:
                return null;
        }
    };
    
    return (
        <div 
            className={`
                bg-white border rounded-2xl p-5 cursor-pointer transition hover:shadow-md
                ${isEmergency && isOpen ? 'border-red-200' : 'border-slate-200'}
            `}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge()}
                        {isEmergency && isOpen && (
                            <span className="flex items-center px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                                <AlertTriangle size={12} className="mr-1" />
                                Emergency
                            </span>
                        )}
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                            {category?.label || request.category}
                        </span>
                    </div>
                    
                    {/* Title */}
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{request.title}</h3>
                    
                    {/* Description (if not compact) */}
                    {!compact && request.description && (
                        <p className="text-slate-600 text-sm line-clamp-2 mb-3">{request.description}</p>
                    )}
                    
                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center">
                            <Clock size={14} className="mr-1" />
                            {formatDate(request.createdAt?.toDate?.())}
                        </span>
                        <span className="flex items-center">
                            <Eye size={14} className="mr-1" />
                            {request.viewCount || 0} views
                        </span>
                        <span className={`flex items-center ${hasResponses ? 'text-emerald-600 font-medium' : ''}`}>
                            <MessageSquare size={14} className="mr-1" />
                            {request.responseCount || 0} {request.responseCount === 1 ? 'response' : 'responses'}
                        </span>
                    </div>
                </div>
                
                {/* Response indicator */}
                {hasResponses && isOpen && (
                    <div className="ml-4 flex flex-col items-center">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <span className="text-emerald-600 font-bold">{request.responseCount}</span>
                        </div>
                        <span className="text-xs text-emerald-600 mt-1">New</span>
                    </div>
                )}
                
                <ChevronRight className="ml-2 text-slate-400" size={20} />
            </div>
            
            {/* Cancel button for open requests */}
            {isOpen && onCancel && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        className="flex items-center text-sm text-red-500 hover:text-red-700"
                    >
                        <Trash2 size={14} className="mr-1" />
                        Cancel Request
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================
// REQUEST DETAIL VIEW (WITH RESPONSES)
// ============================================

const RequestDetailView = ({ 
    request, 
    responses, 
    loading, 
    onClose, 
    onSelectContractor,
    onMessageContractor 
}) => {
    const category = SERVICE_CATEGORIES.find(c => c.id === request.category);
    const isOpen = request.status === REQUEST_STATUS.OPEN || request.status === REQUEST_STATUS.REVIEWING;
    
    // Sort responses: selected first, then by date
    const sortedResponses = [...responses].sort((a, b) => {
        if (a.contractorId === request.selectedContractorId) return -1;
        if (b.contractorId === request.selectedContractorId) return 1;
        return new Date(b.createdAt?.toDate?.()) - new Date(a.createdAt?.toDate?.());
    });
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="border-b border-slate-200 p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase mb-2">
                                {category?.label}
                            </span>
                            <h2 className="text-xl font-bold text-slate-800">{request.title}</h2>
                            {request.description && (
                                <p className="text-slate-600 mt-1">{request.description}</p>
                            )}
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>
                    
                    {/* Photos */}
                    {request.photos?.length > 0 && (
                        <div className="flex gap-2 mt-4">
                            {request.photos.map((photo, i) => (
                                <img 
                                    key={i}
                                    src={photo}
                                    alt=""
                                    className="w-20 h-20 object-cover rounded-lg"
                                />
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Responses */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">
                        Contractor Responses ({responses.length})
                    </h3>
                    
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-emerald-600" size={24} />
                        </div>
                    ) : responses.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare className="mx-auto text-slate-300 mb-4" size={40} />
                            <p className="text-slate-500">No responses yet</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Contractors in your area will see your request and respond with quotes
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedResponses.map(response => (
                                <ResponseCard
                                    key={response.id}
                                    response={response}
                                    isSelected={response.contractorId === request.selectedContractorId}
                                    canSelect={isOpen}
                                    onSelect={() => onSelectContractor(response.contractorId)}
                                    onMessage={() => onMessageContractor?.(response.contractorId, request.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="border-t border-slate-200 p-6">
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// RESPONSE CARD
// ============================================

const ResponseCard = ({ response, isSelected, canSelect, onSelect, onMessage }) => {
    const contractor = response.contractorSnapshot || {};
    
    return (
        <div 
            className={`
                border rounded-xl p-5 transition
                ${isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-200 bg-white'}
            `}
        >
            {/* Selected Badge */}
            {isSelected && (
                <div className="flex items-center text-emerald-600 font-medium mb-3">
                    <CheckCircle size={18} className="mr-2" />
                    You selected this contractor
                </div>
            )}
            
            {/* Contractor Info */}
            <div className="flex items-start gap-4 mb-4">
                {contractor.photoUrl ? (
                    <img 
                        src={contractor.photoUrl}
                        alt={contractor.businessName}
                        className="w-14 h-14 rounded-xl object-cover"
                    />
                ) : (
                    <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <User size={24} className="text-emerald-600" />
                    </div>
                )}
                
                <div className="flex-1">
                    <h4 className="font-bold text-slate-800">
                        {contractor.businessName || contractor.name || 'Contractor'}
                    </h4>
                    
                    <div className="flex items-center gap-3 mt-1">
                        {contractor.averageRating && (
                            <span className="flex items-center text-sm">
                                <Star size={14} className="text-amber-400 mr-1" fill="currentColor" />
                                {contractor.averageRating}
                                <span className="text-slate-400 ml-1">({contractor.reviewCount})</span>
                            </span>
                        )}
                        {contractor.yearsInBusiness && (
                            <span className="text-sm text-slate-500">
                                {contractor.yearsInBusiness} yrs exp
                            </span>
                        )}
                    </div>
                    
                    {/* Badges */}
                    <div className="flex gap-2 mt-2">
                        {contractor.insured && (
                            <span className="flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                                <Shield size={10} className="mr-1" /> Insured
                            </span>
                        )}
                        {contractor.licensed && (
                            <span className="flex items-center px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">
                                <Award size={10} className="mr-1" /> Licensed
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Estimate */}
                {response.estimateRange && (
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase">Estimate</p>
                        <p className="text-lg font-bold text-emerald-600">
                            {formatEstimate(response.estimateRange, response.estimateType)}
                        </p>
                    </div>
                )}
            </div>
            
            {/* Message */}
            {response.message && (
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <p className="text-slate-700 whitespace-pre-wrap">{response.message}</p>
                </div>
            )}
            
            {/* Availability */}
            {(response.canDoEmergency || response.estimatedDuration) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {response.canDoEmergency && (
                        <span className="flex items-center px-3 py-1 bg-red-50 text-red-600 text-sm rounded-full">
                            <Clock size={14} className="mr-1" />
                            Available Today
                        </span>
                    )}
                    {response.estimatedDuration && (
                        <span className="flex items-center px-3 py-1 bg-slate-100 text-slate-600 text-sm rounded-full">
                            <Calendar size={14} className="mr-1" />
                            {response.estimatedDuration}
                        </span>
                    )}
                </div>
            )}
            
            {/* Response Time */}
            <p className="text-xs text-slate-400 mb-4">
                Responded {formatDate(response.createdAt?.toDate?.())}
            </p>
            
            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={onMessage}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50"
                >
                    <MessageSquare size={16} className="mr-2" />
                    Message
                </button>
                
                {contractor.phone && (
                    <a
                        href={`tel:${contractor.phone}`}
                        className="flex items-center justify-center px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
                    >
                        <Phone size={16} />
                    </a>
                )}
                
                {canSelect && !isSelected && (
                    <button
                        onClick={onSelect}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700"
                    >
                        <Check size={16} className="mr-2" />
                        Select
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================
// UTILITIES
// ============================================

const formatDate = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
};

const formatEstimate = (range, type) => {
    if (type === 'need_evaluation') return 'TBD';
    if (!range) return 'TBD';
    
    const { min, max } = range;
    if (min === max) return `$${min}`;
    if (min && max) return `$${min} - $${max}`;
    if (min) return `$${min}+`;
    if (max) return `Up to $${max}`;
    return 'TBD';
};

export default HomeownerRequestManager;
