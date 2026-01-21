// src/features/jobs/CancelJobModal.jsx
// ============================================
// CANCEL JOB MODAL - UPDATED WITH DEPOSIT HANDLING
// ============================================
// - No deposit: Immediate cancel, notify contractor
// - Has deposit: Request cancellation, contractor must approve

import React, { useState } from 'react';
import { X, AlertTriangle, XCircle, DollarSign, Clock, MessageSquare } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';
import { markQuoteJobCancelled } from '../quotes/lib/quoteService';
import { archiveChatChannel } from '../../lib/chatService';
import { cleanupCancelledJobSchedule } from '../contractor-pro/lib/schedulingAI';

const CANCEL_REASONS = [
    { id: 'found_another', label: 'Found another contractor' },
    { id: 'no_longer_needed', label: 'Service no longer needed' },
    { id: 'too_expensive', label: 'Cost is too high' },
    { id: 'scheduling', label: "Can't find a time that works" },
    { id: 'changed_mind', label: 'Changed my mind' },
    { id: 'other', label: 'Other reason' }
];

export const CancelJobModal = ({ job, onClose, onSuccess }) => {
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [additionalMessage, setAdditionalMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Check if deposit was paid
    const depositPaid = job.depositAmount > 0 || job.depositPaid > 0 || job.deposit?.amount > 0;
    const depositAmount = job.depositAmount || job.depositPaid || job.deposit?.amount || 0;
    
    // Determine if this is a request or immediate cancel
    const isRequest = depositPaid;

    // Get reason text
    const getReasonText = () => {
        if (selectedReason === 'other') {
            return customReason || 'Other';
        }
        return CANCEL_REASONS.find(r => r.id === selectedReason)?.label || '';
    };

    // Send email notification to contractor
    const notifyContractor = async (reason, isRequestType) => {
        if (!job.contractorEmail) {
            console.warn('[CancelJobModal] No contractor email - skipping notification');
            return;
        }

        try {
            const response = await fetch('/api/send-job-cancelled', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorEmail: job.contractorEmail,
                    contractorName: job.contractorName || 'there',
                    customerName: job.customer?.name || 'A customer',
                    customerEmail: job.customer?.email || null,
                    customerPhone: job.customer?.phone || null,
                    jobTitle: job.title || job.description || 'Service Job',
                    jobNumber: job.jobNumber || null,
                    jobTotal: job.total || 0,
                    depositPaid: depositAmount > 0 ? depositAmount : null,
                    cancellationReason: reason,
                    isRequest: isRequestType,
                    dashboardLink: 'https://mykrib.app/app/?pro'
                })
            });

            if (response.ok) {
                console.log('[CancelJobModal] Notification sent to contractor');
            } else {
                console.warn('[CancelJobModal] Failed to send notification:', response.status);
            }
        } catch (err) {
            console.warn('[CancelJobModal] Error sending notification:', err);
        }
    };

    // Handle cancel/request cancellation
    const handleCancel = async () => {
        if (!selectedReason) {
            toast.error('Please select a reason');
            return;
        }

        setIsSubmitting(true);
        const reason = getReasonText();

        try {
            if (isRequest) {
                // REQUEST CANCELLATION - Contractor must approve
                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                    status: 'cancellation_requested',
                    cancellationRequest: {
                        requestedAt: serverTimestamp(),
                        requestedBy: 'homeowner',
                        reason: reason,
                        additionalMessage: additionalMessage || null,
                        depositAmount: depositAmount,
                        status: 'pending' // pending, approved, denied
                    },
                    lastActivity: serverTimestamp()
                });

                // Notify contractor (non-blocking)
                notifyContractor(reason, true);

                toast.success('Cancellation request sent to contractor');
            } else {
                // IMMEDIATE CANCEL - No deposit
                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                    status: 'cancelled',
                    cancellation: {
                        cancelledAt: serverTimestamp(),
                        cancelledBy: 'homeowner',
                        reason: reason
                    },
                    lastActivity: serverTimestamp()
                });

                // Update the source quote status if this job came from a quote
                if (job.sourceQuoteId && job.contractorId) {
                    markQuoteJobCancelled(job.contractorId, job.sourceQuoteId, 'homeowner', reason)
                        .catch(err => console.warn('Failed to update quote status:', err));
                }

                // Cleanup calendar/scheduling (non-blocking)
                if (job.contractorId && job.scheduledDate) {
                    cleanupCancelledJobSchedule(job.contractorId, job.id, job)
                        .catch(err => console.warn('Failed to cleanup schedule:', err));
                }

                // Archive chat channel (non-blocking)
                if (job.chatChannelId) {
                    archiveChatChannel(job.chatChannelId, job.id, 'cancelled')
                        .catch(err => console.warn('Failed to archive chat channel:', err));
                }

                // Notify contractor (non-blocking)
                notifyContractor(reason, false);

                toast.success('Job cancelled');
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error cancelling job:', error);
            toast.error('Failed to process cancellation');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isRequest ? 'bg-amber-100' : 'bg-red-100'}`}>
                            {isRequest ? (
                                <Clock className="h-5 w-5 text-amber-600" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">
                                {isRequest ? 'Request Cancellation' : 'Cancel Job'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isRequest ? 'Contractor approval required' : 'This action cannot be undone'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    {/* Job Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-5">
                        <p className="font-bold text-slate-800">
                            {job.title || job.description || 'Service Request'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {job.contractorName || 'Contractor'}
                        </p>
                        {job.total > 0 && (
                            <p className="text-sm font-bold text-emerald-600 mt-2">
                                Total: ${job.total.toLocaleString()}
                            </p>
                        )}
                    </div>

                    {/* Deposit Warning */}
                    {isRequest && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                            <DollarSign className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-800">
                                    Deposit Paid: ${depositAmount.toLocaleString()}
                                </p>
                                <p className="text-xs text-amber-700 mt-1">
                                    Since you've paid a deposit, your cancellation will be sent to the contractor for approval. 
                                    They will contact you about any refund based on their cancellation policy.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Standard Warning (no deposit) */}
                    {!isRequest && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">
                                The contractor will be notified that you've cancelled this job. 
                                If you'd like to reschedule instead, consider requesting different times.
                            </p>
                        </div>
                    )}

                    {/* Reason Selection */}
                    <div className="space-y-2 mb-5">
                        <p className="text-sm font-bold text-slate-700">
                            Why are you cancelling? <span className="text-red-500">*</span>
                        </p>
                        {CANCEL_REASONS.map(reason => (
                            <label 
                                key={reason.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    selectedReason === reason.id 
                                        ? isRequest 
                                            ? 'border-amber-300 bg-amber-50' 
                                            : 'border-red-300 bg-red-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="cancelReason"
                                    value={reason.id}
                                    checked={selectedReason === reason.id}
                                    onChange={(e) => setSelectedReason(e.target.value)}
                                    className={isRequest ? 'text-amber-600 focus:ring-amber-500' : 'text-red-600 focus:ring-red-500'}
                                />
                                <span className="text-sm text-slate-700">{reason.label}</span>
                            </label>
                        ))}
                    </div>

                    {/* Custom Reason Input */}
                    {selectedReason === 'other' && (
                        <div className="mb-5">
                            <textarea
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder="Please describe your reason..."
                                className={`w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:ring-2 outline-none ${
                                    isRequest ? 'focus:ring-amber-500' : 'focus:ring-red-500'
                                }`}
                                rows={3}
                            />
                        </div>
                    )}

                    {/* Additional Message (for requests) */}
                    {isRequest && (
                        <div className="mb-5">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare size={14} className="text-slate-400" />
                                <p className="text-sm font-bold text-slate-700">
                                    Message to contractor (optional)
                                </p>
                            </div>
                            <textarea
                                value={additionalMessage}
                                onChange={(e) => setAdditionalMessage(e.target.value)}
                                placeholder="Any additional details or requests for the contractor..."
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-amber-500 outline-none"
                                rows={2}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Keep Job
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={isSubmitting || !selectedReason}
                        className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                            isRequest 
                                ? 'bg-amber-500 hover:bg-amber-600' 
                                : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                {isRequest ? 'Sending...' : 'Cancelling...'}
                            </>
                        ) : (
                            isRequest ? 'Request Cancellation' : 'Cancel Job'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancelJobModal;
