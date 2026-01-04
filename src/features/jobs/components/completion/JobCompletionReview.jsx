// src/features/jobs/components/completion/JobCompletionReview.jsx
// ============================================
// JOB COMPLETION REVIEW - HOMEOWNER SIDE
// ============================================
// Component for homeowners to review contractor's completion submission:
// - View invoice and costs
// - Review items to be added to inventory
// - Accept or request revision
// - Rate contractor

import React, { useState, useMemo } from 'react';
import {
    CheckCircle, XCircle, AlertTriangle, FileText, Package,
    DollarSign, Calendar, Clock, ChevronDown, ChevronUp,
    Star, MessageSquare, Camera, Download, ExternalLink,
    Loader2, Shield, Bell, Wrench, User, Info, X,
    CheckSquare, Square, Edit3, AlertCircle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { 
    acceptJobCompletion, 
    requestRevision 
} from '../../lib/jobCompletionService';
import { RateContractorModal } from '../../../ratings/components/RateContractorModal';

// ============================================
// HELPERS
// ============================================

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    } catch {
        return dateStr;
    }
};

const getDaysUntilAutoClose = (autoCloseAt) => {
    if (!autoCloseAt) return null;
    const closeDate = autoCloseAt.toDate ? autoCloseAt.toDate() : new Date(autoCloseAt);
    const now = new Date();
    const diffTime = closeDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

// ============================================
// INVOICE PREVIEW CARD
// ============================================
const InvoicePreview = ({ invoice }) => {
    if (!invoice?.url) return null;
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <FileText className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">Invoice</p>
                            <p className="text-sm text-slate-500">{invoice.fileName || 'invoice.pdf'}</p>
                        </div>
                    </div>
                    <a
                        href={invoice.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition-colors"
                    >
                        <ExternalLink size={16} />
                        View
                    </a>
                </div>
            </div>
            
            {/* Cost Summary */}
            {invoice.parsedData && (
                <div className="p-4 bg-slate-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Total</p>
                            <p className="text-lg font-bold text-slate-800">
                                {formatCurrency(invoice.parsedData.totalAmount)}
                            </p>
                        </div>
                        {invoice.parsedData.laborCost && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Labor</p>
                                <p className="text-lg font-bold text-slate-600">
                                    {formatCurrency(invoice.parsedData.laborCost)}
                                </p>
                            </div>
                        )}
                        {invoice.parsedData.partsCost && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Parts</p>
                                <p className="text-lg font-bold text-slate-600">
                                    {formatCurrency(invoice.parsedData.partsCost)}
                                </p>
                            </div>
                        )}
                        {invoice.parsedData.taxAmount && (
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide">Tax</p>
                                <p className="text-lg font-bold text-slate-600">
                                    {formatCurrency(invoice.parsedData.taxAmount)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// ITEM PREVIEW CARD
// ============================================
const ItemPreviewCard = ({ 
    item, 
    index, 
    isSelected, 
    onToggle, 
    onModify,
    isExpanded,
    onToggleExpand 
}) => {
    const hasMaintenanceTasks = item.maintenanceTasks?.some(t => t.selected !== false);
    
    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${
            isSelected 
                ? 'border-emerald-300 bg-emerald-50/50' 
                : 'border-slate-200 bg-white opacity-60'
        }`}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className="shrink-0"
                >
                    {isSelected ? (
                        <CheckSquare size={22} className="text-emerald-600" />
                    ) : (
                        <Square size={22} className="text-slate-300" />
                    )}
                </button>
                
                <div 
                    className="flex-grow cursor-pointer"
                    onClick={() => onToggleExpand(item.id)}
                >
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{item.item || 'Unnamed Item'}</p>
                        {hasMaintenanceTasks && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Bell size={10} />
                                Reminders
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500">
                        {item.category || 'Uncategorized'} • {item.area || 'General'}
                    </p>
                </div>
                
                <div className="text-right">
                    <p className="font-bold text-slate-800">{formatCurrency(item.cost)}</p>
                    {item.warranty && (
                        <p className="text-xs text-emerald-600">Has warranty</p>
                    )}
                </div>
                
                <button onClick={() => onToggleExpand(item.id)}>
                    {isExpanded ? (
                        <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                        <ChevronDown size={20} className="text-slate-400" />
                    )}
                </button>
            </div>
            
            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4 ml-10">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {item.brand && (
                            <div>
                                <p className="text-xs text-slate-400 uppercase">Brand</p>
                                <p className="text-slate-700">{item.brand}</p>
                            </div>
                        )}
                        {item.model && (
                            <div>
                                <p className="text-xs text-slate-400 uppercase">Model</p>
                                <p className="text-slate-700">{item.model}</p>
                            </div>
                        )}
                        {item.serialNumber && (
                            <div>
                                <p className="text-xs text-slate-400 uppercase">Serial #</p>
                                <p className="text-slate-700">{item.serialNumber}</p>
                            </div>
                        )}
                        {item.dateInstalled && (
                            <div>
                                <p className="text-xs text-slate-400 uppercase">Installed</p>
                                <p className="text-slate-700">{formatDate(item.dateInstalled)}</p>
                            </div>
                        )}
                        {item.warranty && (
                            <div className="col-span-2">
                                <p className="text-xs text-slate-400 uppercase">Warranty</p>
                                <p className="text-emerald-700">{item.warranty}</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Maintenance Tasks Preview */}
                    {hasMaintenanceTasks && (
                        <div className="mt-4 bg-amber-50 rounded-lg p-3">
                            <p className="text-xs font-bold text-amber-800 uppercase mb-2">
                                Scheduled Reminders
                            </p>
                            <div className="space-y-1">
                                {item.maintenanceTasks
                                    .filter(t => t.selected !== false)
                                    .map((task, idx) => (
                                        <p key={idx} className="text-sm text-amber-700 flex items-center gap-2">
                                            <Bell size={12} />
                                            {task.task} ({task.frequency})
                                        </p>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// PHOTOS GALLERY
// ============================================
const PhotosGallery = ({ photos }) => {
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    
    if (!photos?.length) return null;
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-4">
                <Camera size={18} className="text-slate-600" />
                <p className="font-bold text-slate-800">Job Photos</p>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSelectedPhoto(photo)}
                        className="aspect-square rounded-xl overflow-hidden relative group"
                    >
                        <img
                            src={photo.url || photo.preview}
                            alt={photo.caption || `Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 left-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                photo.type === 'before' ? 'bg-amber-500 text-white' :
                                photo.type === 'after' ? 'bg-emerald-500 text-white' :
                                'bg-slate-500 text-white'
                            }`}>
                                {photo.type || 'Work'}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
            
            {/* Lightbox */}
            {selectedPhoto && (
                <div 
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 bg-white/10 rounded-full"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X size={24} className="text-white" />
                    </button>
                    <img
                        src={selectedPhoto.url || selectedPhoto.preview}
                        alt={selectedPhoto.caption || 'Photo'}
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                    />
                </div>
            )}
        </div>
    );
};

// ============================================
// REVISION REQUEST MODAL
// ============================================
const RevisionRequestModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
    const [reason, setReason] = useState('');
    
    if (!isOpen) return null;
    
    const handleSubmit = () => {
        if (!reason.trim()) {
            toast.error('Please explain what needs to be changed');
            return;
        }
        onSubmit(reason);
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-amber-100 p-2 rounded-xl">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Request Revision</h3>
                    </div>
                    
                    <p className="text-slate-600 mb-4">
                        Let the contractor know what needs to be corrected or updated.
                    </p>
                    
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Please describe what needs to be changed..."
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                    />
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            'Send Request'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const JobCompletionReview = ({
    job,
    userId,
    propertyId,
    onSuccess,
    onClose
}) => {
    const completion = job.completion || {};
    const items = completion.itemsToImport || [];
    
    // Item selection state
    const [selectedItems, setSelectedItems] = useState(() => {
        // Default: all items selected
        const selected = {};
        items.forEach(item => {
            selected[item.id] = { selected: true };
        });
        return selected;
    });
    
    const [expandedItems, setExpandedItems] = useState({});
    
    // UI State
    const [isAccepting, setIsAccepting] = useState(false);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [isRequestingRevision, setIsRequestingRevision] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [acceptedSuccessfully, setAcceptedSuccessfully] = useState(false);
    
    // Calculate days until auto-close
    const daysUntilAutoClose = getDaysUntilAutoClose(completion.autoCloseAt);
    
    // Count selected items
    const selectedCount = useMemo(() => {
        return Object.values(selectedItems).filter(s => s.selected).length;
    }, [selectedItems]);
    
    // Toggle item selection
    const toggleItemSelection = (itemId) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: { 
                ...prev[itemId], 
                selected: !prev[itemId]?.selected 
            }
        }));
    };
    
    // Toggle item expansion
    const toggleItemExpansion = (itemId) => {
        setExpandedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };
    
    // Accept completion
    const handleAccept = async () => {
        setIsAccepting(true);
        
        try {
            // Prepare item selections
            const itemSelections = {};
            items.forEach(item => {
                itemSelections[item.id] = {
                    skip: !selectedItems[item.id]?.selected
                };
            });
            
            const result = await acceptJobCompletion(
                job.id,
                userId,
                propertyId,
                itemSelections
            );
            
            toast.success(`${result.importedCount} item(s) added to your inventory!`);
            setAcceptedSuccessfully(true);
            
            // Show rating modal
            setShowRatingModal(true);
            
        } catch (error) {
            console.error('Accept error:', error);
            toast.error('Failed to accept: ' + error.message);
        } finally {
            setIsAccepting(false);
        }
    };
    
    // Request revision
    const handleRequestRevision = async (reason) => {
        setIsRequestingRevision(true);
        
        try {
            await requestRevision(job.id, userId, reason);
            toast.success('Revision request sent to contractor');
            setShowRevisionModal(false);
            if (onClose) onClose();
        } catch (error) {
            console.error('Revision request error:', error);
            toast.error('Failed to send request: ' + error.message);
        } finally {
            setIsRequestingRevision(false);
        }
    };
    
    // Handle rating completion
    const handleRatingComplete = () => {
        setShowRatingModal(false);
        if (onSuccess) onSuccess();
    };
    
    // If already accepted, show rating
    if (acceptedSuccessfully && !showRatingModal) {
        if (onSuccess) onSuccess();
        return null;
    }
    
    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <Toaster position="top-center" />
            
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>
                        )}
                        <div>
                            <h1 className="font-bold text-slate-800">Review Completion</h1>
                            <p className="text-sm text-slate-500">
                                {job.contractorName || job.contractor || 'Contractor'} has completed this job
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {/* Auto-close Warning */}
                {daysUntilAutoClose !== null && daysUntilAutoClose <= 3 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-amber-800">
                                Auto-acceptance in {daysUntilAutoClose} day{daysUntilAutoClose !== 1 ? 's' : ''}
                            </p>
                            <p className="text-sm text-amber-700">
                                If no action is taken, this completion will be automatically accepted.
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Job Summary */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-3 rounded-xl">
                            <Wrench className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="flex-grow">
                            <p className="font-bold text-slate-800">{job.description || job.item || 'Service Job'}</p>
                            <p className="text-sm text-slate-500">
                                Completed {formatDate(completion.submittedAt)}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                                <CheckCircle size={14} />
                                Complete
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Invoice */}
                <InvoicePreview invoice={completion.invoice} />
                
                {/* Items to Import */}
                {items.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Package size={18} className="text-emerald-600" />
                                    <p className="font-bold text-slate-800">Items to Add to Inventory</p>
                                </div>
                                <span className="text-sm text-slate-500">
                                    {selectedCount} of {items.length} selected
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                These items will be added to your home inventory with warranty tracking
                            </p>
                        </div>
                        
                        <div className="p-4 space-y-3">
                            {items.map((item, idx) => (
                                <ItemPreviewCard
                                    key={item.id || idx}
                                    item={item}
                                    index={idx}
                                    isSelected={selectedItems[item.id]?.selected}
                                    onToggle={toggleItemSelection}
                                    isExpanded={expandedItems[item.id]}
                                    onToggleExpand={toggleItemExpansion}
                                />
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Photos */}
                <PhotosGallery photos={completion.photos} />
                
                {/* Notes & Recommendations */}
                {(completion.notes || completion.recommendations) && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                        {completion.notes && (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare size={16} className="text-slate-600" />
                                    <p className="font-bold text-slate-800">Contractor Notes</p>
                                </div>
                                <p className="text-slate-600 text-sm whitespace-pre-wrap">
                                    {completion.notes}
                                </p>
                            </div>
                        )}
                        
                        {completion.recommendations && (
                            <div className="bg-blue-50 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info size={16} className="text-blue-600" />
                                    <p className="font-bold text-blue-800">Recommendations</p>
                                </div>
                                <p className="text-blue-700 text-sm whitespace-pre-wrap">
                                    {completion.recommendations}
                                </p>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Partial Completion Notice */}
                {completion.partialCompletion?.isPartial && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-amber-800">Partial Completion</p>
                                <p className="text-sm text-amber-700 mt-1">
                                    {completion.partialCompletion.reason || 'Some work remains to be completed.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Action Buttons */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-lg z-50">
                <div className="max-w-2xl mx-auto space-y-3">
                    <button
                        onClick={handleAccept}
                        disabled={isAccepting}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                    >
                        {isAccepting ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Accepting...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={20} />
                                Accept & Add {selectedCount} Item{selectedCount !== 1 ? 's' : ''} to Inventory
                            </>
                        )}
                    </button>
                    
                    <button
                        onClick={() => setShowRevisionModal(true)}
                        className="w-full py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <AlertTriangle size={18} />
                        Request Revision
                    </button>
                </div>
            </div>
            
            {/* Revision Modal */}
            <RevisionRequestModal
                isOpen={showRevisionModal}
                onClose={() => setShowRevisionModal(false)}
                onSubmit={handleRequestRevision}
                isSubmitting={isRequestingRevision}
            />
            
            {/* Rating Modal */}
            {showRatingModal && (
                <RateContractorModal
                    job={job}
                    contractorId={completion.contractorId || job.contractorId}
                    userId={userId}
                    onClose={handleRatingComplete}
                    onSuccess={handleRatingComplete}
                />
            )}
        </div>
    );
};

export default JobCompletionReview;
