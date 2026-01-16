// src/features/jobs/components/completion/JobCompletionReview.jsx
// ============================================
// JOB COMPLETION REVIEW - HOMEOWNER SIDE
// ============================================
// Allows homeowners to review contractor's completion submission

import React, { useState } from 'react';
import {
    X, CheckCircle, AlertTriangle, Camera, FileText, Wrench,
    MessageSquare, Star, Loader2, ChevronDown, ChevronUp,
    ExternalLink, Clock, User, Calendar, DollarSign, Download, Package
} from 'lucide-react';
import { acceptJobCompletion, requestRevision } from '../../lib/jobCompletionService';
import toast from 'react-hot-toast';
import { createPaymentCheckout } from '../../../../lib/stripeService';
import { InventoryPreviewSection } from './InventoryPreviewSection';
import { EditInventoryItemModal } from './EditInventoryItemModal';

// ============================================
// MAIN COMPONENT
// ============================================
export const JobCompletionReview = ({ job, userId, propertyId, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState('summary');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);

    // Item selection and editing state
    const [itemSelections, setItemSelections] = useState({});
    const [editingItem, setEditingItem] = useState(null);

    // Get completion data from job
    const completion = job.completion || {};
    const photos = completion.photos || [];
    const items = completion.itemsToImport || [];
    const invoice = completion.invoice;
    
    // Calculate auto-close date
    const autoCloseDate = completion.autoCloseAt?.toDate?.() || 
        (completion.autoCloseAt ? new Date(completion.autoCloseAt) : null);
    const daysUntilAutoClose = autoCloseDate 
        ? Math.max(0, Math.ceil((autoCloseDate - new Date()) / (1000 * 60 * 60 * 24)))
        : null;
    
    // Payment state
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    
    // Calculate balance due
    const jobTotal = job.total || 0;
    const depositPaid = job.payment?.depositPaid ? (job.payment?.deposit?.amount || 0) : 0;
    const balanceDue = jobTotal - depositPaid;
    const hasBalanceDue = balanceDue > 0 && !job.payment?.balancePaid;
    
    // Check if contractor has Stripe connected
    const contractorStripeId = job.contractor?.stripe?.accountId || job.stripeAccountId;
    const contractorStripeReady = job.contractor?.stripe?.isComplete || job.stripeReady;
    const canPayOnline = hasBalanceDue && contractorStripeId && contractorStripeReady;
    
    // ============================================
    // HANDLERS
    // ============================================

    // Handle approve with payment
    const handleApproveWithPayment = async () => {
        setIsProcessingPayment(true);
        const loadingToast = toast.loading('Processing...');
        
        try {
            // First accept the job completion
            await acceptJobCompletion(job.id, userId, propertyId);
            
            toast.dismiss(loadingToast);
            
            // Then redirect to Stripe Checkout for balance
            const checkoutResult = await createPaymentCheckout({
                stripeAccountId: contractorStripeId,
                amount: balanceDue,
                type: 'balance',
                quoteId: job.sourceQuoteId || null,
                jobId: job.id,
                contractorId: job.contractorId,
                title: job.title || job.description || 'Service',
                description: `Balance for Job #${job.jobNumber || job.id.slice(-6)}`,
                customerEmail: job.customer?.email,
                customerName: job.customer?.name
            });
            
            // Redirect to Stripe Checkout
            window.location.href = checkoutResult.checkoutUrl;
            
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Failed to process payment');
            console.error(error);
            setIsProcessingPayment(false);
        }
    };
    
    const handleApprove = async () => {
        setIsSubmitting(true);
        const loadingToast = toast.loading('Approving completion...');

        try {
            // Pass item selections with skip/modifications to acceptJobCompletion
            await acceptJobCompletion(job.id, userId, propertyId, itemSelections);

            toast.dismiss(loadingToast);

            // Calculate imported count
            const skippedCount = Object.values(itemSelections).filter(s => s.skip).length;
            const importedCount = items.length - skippedCount;

            if (importedCount > 0) {
                toast.success(`Job approved! ${importedCount} item${importedCount !== 1 ? 's' : ''} added to your inventory.`);
            } else {
                toast.success('Job approved!');
            }

            // Show rating modal after approval
            setShowRatingModal(true);

        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Failed to approve completion');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle item include/exclude toggle
    const handleItemToggle = (itemId) => {
        setItemSelections(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                skip: !prev[itemId]?.skip
            }
        }));
    };

    // Handle item modifications from edit modal
    const handleItemModifications = (itemId, modifications) => {
        setItemSelections(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                modifications: {
                    ...(prev[itemId]?.modifications || {}),
                    ...modifications
                }
            }
        }));
    };

    const handleRequestRevision = async (reason) => {
        setIsSubmitting(true);
        const loadingToast = toast.loading('Sending revision request...');
        
        try {
            await requestRevision(job.id, userId, reason);
            
            toast.dismiss(loadingToast);
            toast.success('Revision requested. The contractor will be notified.');
            
            if (onSuccess) onSuccess();
            onClose();
            
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Failed to request revision');
            console.error(error);
        } finally {
            setIsSubmitting(false);
            setShowRevisionModal(false);
        }
    };
    
    const handleRatingComplete = () => {
        setShowRatingModal(false);
        if (onSuccess) onSuccess();
        onClose();
    };
    
    // ============================================
    // RENDER
    // ============================================
    return (
        <>
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    onClick={onClose} 
                />
                
                {/* Modal */}
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Review Completion</h2>
                                <p className="text-purple-100 text-sm mt-0.5">
                                    {job.description || job.title || 'Service Request'}
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        
                        {/* Auto-close warning */}
                        {daysUntilAutoClose !== null && daysUntilAutoClose <= 3 && (
                            <div className="mt-3 bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-white" />
                                <span className="text-white text-sm">
                                    Auto-approves in {daysUntilAutoClose} day{daysUntilAutoClose !== 1 ? 's' : ''} if no action taken
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {/* Tabs */}
                    <div className="px-6 py-3 bg-gray-50 border-b flex gap-2">
                        {[
                            { id: 'summary', label: 'Summary', icon: ClipboardIcon },
                            { id: 'photos', label: `Photos (${photos.length})`, icon: Camera },
                            { id: 'items', label: `Items (${items.length})`, icon: Wrench },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                    activeTab === tab.id
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* SUMMARY TAB */}
                        {activeTab === 'summary' && (
                            <div className="space-y-6">
                                {/* Contractor Info */}
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {job.contractorName || job.contractor || 'Contractor'}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Submitted {completion.submittedAt?.toDate?.()?.toLocaleDateString() || 'recently'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Completion Notes */}
                                {completion.notes && (
                                    <div>
                                        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4" />
                                            Contractor Notes
                                        </h3>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <p className="text-gray-700 whitespace-pre-wrap">{completion.notes}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Recommendations */}
                                {completion.recommendations && (
                                    <div>
                                        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            Recommendations
                                        </h3>
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <p className="text-amber-800 whitespace-pre-wrap">{completion.recommendations}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Invoice */}
                                {invoice?.url && (
                                    <div>
                                        <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Invoice
                                        </h3>
                                        <a
                                            href={invoice.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-5 h-5 text-blue-600" />
                                                <span className="font-medium text-blue-800">
                                                    {invoice.fileName || 'Invoice'}
                                                </span>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-blue-600" />
                                        </a>
                                    </div>
                                )}
                                
                                {/* Quick Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                                        <Camera className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-gray-900">{photos.length}</p>
                                        <p className="text-xs text-gray-500">Photos</p>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                                        <Wrench className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-gray-900">{items.length}</p>
                                        <p className="text-xs text-gray-500">Items</p>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                                        <Clock className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                                        <p className="text-2xl font-bold text-gray-900">{daysUntilAutoClose || '—'}</p>
                                        <p className="text-xs text-gray-500">Days left</p>
                                    </div>
                                </div>
                                
                                {/* Payment Summary */}
                                {jobTotal > 0 && (
                                    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4" />
                                            Payment Summary
                                        </h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Job Total</span>
                                                <span className="font-medium">${jobTotal.toLocaleString()}</span>
                                            </div>
                                            {depositPaid > 0 && (
                                                <div className="flex justify-between text-green-600">
                                                    <span>Deposit Paid</span>
                                                    <span>-${depositPaid.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {hasBalanceDue && (
                                                <div className="flex justify-between pt-2 border-t border-slate-200 text-base">
                                                    <span className="font-bold text-gray-900">Balance Due</span>
                                                    <span className="font-bold text-emerald-600">${balanceDue.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {job.payment?.balancePaid && (
                                                <div className="flex items-center gap-2 text-green-600 mt-2">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span className="font-medium">Fully Paid</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* PHOTOS TAB */}
                        {activeTab === 'photos' && (
                            <div className="space-y-4">
                                {photos.length > 0 ? (
                                    <>
                                        {/* Group by type */}
                                        {['before', 'after', 'work'].map(type => {
                                            const typePhotos = photos.filter(p => p.type === type);
                                            if (typePhotos.length === 0) return null;
                                            
                                            return (
                                                <div key={type}>
                                                    <h3 className="font-medium text-gray-900 mb-3 capitalize">
                                                        {type === 'work' ? 'Work in Progress' : type} Photos
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {typePhotos.map((photo, idx) => (
                                                            <div key={idx} className="relative group">
                                                                <img
                                                                    src={photo.url}
                                                                    alt={`${type} photo ${idx + 1}`}
                                                                    className="w-full h-40 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                                                                    onClick={() => window.open(photo.url, '_blank')}
                                                                />
                                                                {photo.caption && (
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-3 py-2 rounded-b-xl">
                                                                        {photo.caption}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <div className="text-center py-12">
                                        <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No photos uploaded</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* ITEMS TAB - Enhanced with InventoryPreviewSection */}
                        {activeTab === 'items' && (
                            <InventoryPreviewSection
                                items={items}
                                editable={true}
                                itemSelections={itemSelections}
                                onItemToggle={handleItemToggle}
                                onEditItem={(item) => setEditingItem(item)}
                                showMaintenanceInfo={true}
                            />
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setShowRevisionModal(true)}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 border border-amber-300 text-amber-700 rounded-xl font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
                            >
                                Request Changes
                            </button>
                            
                            {/* Show Pay & Approve if balance due and Stripe connected */}
                            {canPayOnline ? (
                                <button
                                    onClick={handleApproveWithPayment}
                                    disabled={isSubmitting || isProcessingPayment}
                                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isProcessingPayment ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <DollarSign className="w-4 h-4" />
                                            Approve & Pay ${balanceDue.toLocaleString()}
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handleApprove}
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Approve & Complete
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Revision Request Modal */}
            {showRevisionModal && (
                <RevisionModal
                    onSubmit={handleRequestRevision}
                    onClose={() => setShowRevisionModal(false)}
                    isSubmitting={isSubmitting}
                />
            )}
            
            {/* Rating Modal */}
            {showRatingModal && (
                <RatingModal
                    job={job}
                    userId={userId}
                    onComplete={handleRatingComplete}
                    onSkip={handleRatingComplete}
                />
            )}

            {/* Edit Inventory Item Modal */}
            <EditInventoryItemModal
                item={editingItem}
                isOpen={!!editingItem}
                onClose={() => setEditingItem(null)}
                onSave={handleItemModifications}
            />
        </>
    );
};

// ============================================
// HELPER COMPONENTS
// ============================================

// Simple clipboard icon since it's not in the main import
const ClipboardIcon = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
);

// Item Review Card
const ItemReviewCard = ({ item }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{item.item}</p>
                        <p className="text-sm text-gray-500">
                            {[item.brand, item.model].filter(Boolean).join(' • ') || item.category || 'Equipment'}
                        </p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
            </div>
            
            {expanded && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                    <div className="grid grid-cols-2 gap-4 pt-4 text-sm">
                        {item.brand && (
                            <div>
                                <span className="text-gray-500 block text-xs">Brand</span>
                                <span className="text-gray-900">{item.brand}</span>
                            </div>
                        )}
                        {item.model && (
                            <div>
                                <span className="text-gray-500 block text-xs">Model</span>
                                <span className="text-gray-900">{item.model}</span>
                            </div>
                        )}
                        {item.serialNumber && (
                            <div>
                                <span className="text-gray-500 block text-xs">Serial Number</span>
                                <span className="text-gray-900 font-mono">{item.serialNumber}</span>
                            </div>
                        )}
                        {item.category && (
                            <div>
                                <span className="text-gray-500 block text-xs">Category</span>
                                <span className="text-gray-900">{item.category}</span>
                            </div>
                        )}
                        {item.cost && (
                            <div>
                                <span className="text-gray-500 block text-xs">Cost</span>
                                <span className="text-gray-900">${item.cost}</span>
                            </div>
                        )}
                        {item.warranty && (
                            <div>
                                <span className="text-gray-500 block text-xs">Warranty</span>
                                <span className="text-gray-900">{item.warranty}</span>
                            </div>
                        )}
                        {item.maintenanceFrequency && item.maintenanceFrequency !== 'none' && (
                            <div className="col-span-2">
                                <span className="text-gray-500 block text-xs">Maintenance Schedule</span>
                                <span className="text-gray-900 capitalize">{item.maintenanceFrequency}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Revision Request Modal
const RevisionModal = ({ onSubmit, onClose, isSubmitting }) => {
    const [reason, setReason] = useState('');
    
    const handleSubmit = () => {
        if (!reason.trim()) {
            toast.error('Please provide a reason for the revision request');
            return;
        }
        onSubmit(reason);
    };
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Request Changes</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Let the contractor know what needs to be fixed or updated.
                </p>
                
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please describe what changes are needed..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all resize-none"
                    autoFocus
                />
                
                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !reason.trim()}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <AlertTriangle className="w-4 h-4" />
                        )}
                        Request Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// Rating Modal (simplified - can be expanded later)
const RatingModal = ({ job, userId, onComplete, onSkip }) => {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            // Import dynamically to avoid circular dependencies
            const { rateContractor } = await import('../../lib/jobCompletionService');
            
            await rateContractor(job.id, job.contractorId, userId, {
                overall: rating,
                quality: rating,
                timeliness: rating,
                communication: rating,
                value: rating,
                review
            });
            
            toast.success('Thanks for your feedback!');
            onComplete();
            
        } catch (error) {
            toast.error('Failed to submit rating');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Job Completed!</h3>
                    <p className="text-gray-500 mt-1">How was your experience?</p>
                </div>
                
                {/* Star Rating */}
                <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="transition-transform hover:scale-110"
                        >
                            <Star
                                className={`w-10 h-10 ${
                                    star <= rating
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-gray-300'
                                }`}
                            />
                        </button>
                    ))}
                </div>
                
                {/* Review Text */}
                <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Write a review (optional)..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all resize-none mb-4"
                />
                
                <div className="flex gap-3">
                    <button
                        onClick={onSkip}
                        className="flex-1 px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-xl hover:bg-gray-50"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || rating === 0}
                        className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            'Submit Rating'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobCompletionReview;
