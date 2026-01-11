// src/features/jobs/CancellationApprovalModal.jsx
// ============================================
// CANCELLATION APPROVAL MODAL
// ============================================
// Allows contractors to approve or deny cancellation requests
// from homeowners who have paid a deposit

import React, { useState } from 'react';
import { 
    X, AlertTriangle, CheckCircle, XCircle, 
    DollarSign, Clock, MessageSquare, User,
    Calendar, FileText, Loader2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

// ============================================
// MAIN COMPONENT
// ============================================
export const CancellationApprovalModal = ({ job, onClose, onSuccess }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [action, setAction] = useState(null); // 'approve' | 'deny'
    const [contractorMessage, setContractorMessage] = useState('');
    const [refundAmount, setRefundAmount] = useState(
        job.cancellationRequest?.depositAmount || 
        job.depositAmount || 
        job.deposit?.amount || 
        0
    );

    const cancellationRequest = job.cancellationRequest || {};
    const depositAmount = cancellationRequest.depositAmount || job.depositAmount || job.deposit?.amount || 0;

    // Send notification email to homeowner
    const notifyHomeowner = async (approved) => {
        const customerEmail = job.customer?.email || job.customerEmail;
        if (!customerEmail) {
            console.warn('[CancellationApproval] No customer email - skipping notification');
            return;
        }

        try {
            const response = await fetch('/api/send-cancellation-response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerEmail,
                    customerName: job.customer?.name || job.customerName || 'there',
                    contractorName: job.contractorName || 'Your contractor',
                    jobTitle: job.title || job.description || 'Service Job',
                    jobNumber: job.jobNumber || null,
                    approved,
                    refundAmount: approved ? refundAmount : 0,
                    contractorMessage: contractorMessage || null,
                    dashboardLink: 'https://mykrib.app/app'
                })
            });

            if (response.ok) {
                console.log('[CancellationApproval] Notification sent to homeowner');
            } else {
                console.warn('[CancellationApproval] Failed to send notification');
            }
        } catch (err) {
            console.warn('[CancellationApproval] Error sending notification:', err);
        }
    };

    // Handle approval
    const handleApprove = async () => {
        setIsSubmitting(true);
        setAction('approve');

        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                status: 'cancelled',
                cancellation: {
                    cancelledAt: serverTimestamp(),
                    cancelledBy: 'contractor_approved',
                    originalRequestedBy: 'homeowner',
                    reason: cancellationRequest.reason || 'Customer requested',
                    refundAmount: refundAmount,
                    contractorMessage: contractorMessage || null,
                    approvedAt: serverTimestamp()
                },
                'cancellationRequest.status': 'approved',
                'cancellationRequest.resolvedAt': serverTimestamp(),
                'cancellationRequest.refundAmount': refundAmount,
                lastActivity: serverTimestamp()
            });

            // Notify homeowner (non-blocking)
            notifyHomeowner(true);

            toast.success('Cancellation approved');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error approving cancellation:', error);
            toast.error('Failed to approve cancellation');
        } finally {
            setIsSubmitting(false);
            setAction(null);
        }
    };

    // Handle denial
    const handleDeny = async () => {
        if (!contractorMessage.trim()) {
            toast.error('Please provide a reason for denying');
            return;
        }

        setIsSubmitting(true);
        setAction('deny');

        try {
            // Get the previous status before cancellation was requested
            const previousStatus = job.previousStatus || job.statusBeforeCancellation || 'scheduled';

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                status: previousStatus,
                'cancellationRequest.status': 'denied',
                'cancellationRequest.resolvedAt': serverTimestamp(),
                'cancellationRequest.denialReason': contractorMessage,
                lastActivity: serverTimestamp()
            });

            // Notify homeowner (non-blocking)
            notifyHomeowner(false);

            toast.success('Cancellation denied - job restored');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error denying cancellation:', error);
            toast.error('Failed to deny cancellation');
        } finally {
            setIsSubmitting(false);
            setAction(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Cancellation Request</h3>
                            <p className="text-xs text-slate-500">Customer is requesting to cancel</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    {/* Job Summary */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-bold text-slate-800">
                                    {job.title || job.description || 'Service Job'}
                                </p>
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                    <User size={14} />
                                    {job.customer?.name || job.customerName || 'Customer'}
                                </p>
                                {job.jobNumber && (
                                    <p className="text-xs text-slate-400 mt-1">
                                        #{job.jobNumber}
                                    </p>
                                )}
                            </div>
                            {job.total > 0 && (
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Job Total</p>
                                    <p className="font-bold text-slate-800">{formatCurrency(job.total)}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cancellation Details */}
                    <div className="space-y-3">
                        <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider">
                            Cancellation Details
                        </h4>
                        
                        {/* Reason */}
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
                                Reason Given
                            </p>
                            <p className="text-slate-800">
                                {cancellationRequest.reason || 'No reason provided'}
                            </p>
                            {cancellationRequest.additionalMessage && (
                                <p className="text-sm text-slate-600 mt-2 italic">
                                    "{cancellationRequest.additionalMessage}"
                                </p>
                            )}
                        </div>

                        {/* Request Time */}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Clock size={14} />
                            Requested: {formatDate(cancellationRequest.requestedAt)}
                        </div>
                    </div>

                    {/* Deposit Info */}
                    {depositAmount > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <DollarSign className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-bold text-amber-800">
                                        Deposit Paid: {formatCurrency(depositAmount)}
                                    </p>
                                    <p className="text-sm text-amber-700 mt-1">
                                        If you approve, specify the refund amount below.
                                    </p>
                                    
                                    {/* Refund Amount Input */}
                                    <div className="mt-3">
                                        <label className="block text-xs font-bold text-amber-700 mb-1">
                                            Refund Amount
                                        </label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={depositAmount}
                                                value={refundAmount}
                                                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                                                className="w-full pl-9 pr-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                                            />
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                type="button"
                                                onClick={() => setRefundAmount(depositAmount)}
                                                className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                            >
                                                Full Refund
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRefundAmount(depositAmount / 2)}
                                                className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                            >
                                                50% Refund
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRefundAmount(0)}
                                                className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                                            >
                                                No Refund
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Message to Customer */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            <MessageSquare size={14} className="inline mr-1" />
                            Message to Customer
                            <span className="text-slate-400 font-normal ml-1">
                                (required if denying)
                            </span>
                        </label>
                        <textarea
                            value={contractorMessage}
                            onChange={(e) => setContractorMessage(e.target.value)}
                            placeholder="e.g., I've already purchased materials for this job..."
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="p-5 border-t border-slate-100 bg-slate-50">
                    <div className="flex gap-3">
                        {/* Deny Button */}
                        <button
                            onClick={handleDeny}
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {isSubmitting && action === 'deny' ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <XCircle size={18} />
                            )}
                            Deny Request
                        </button>

                        {/* Approve Button */}
                        <button
                            onClick={handleApprove}
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {isSubmitting && action === 'approve' ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <CheckCircle size={18} />
                            )}
                            Approve & Cancel
                        </button>
                    </div>
                    
                    <p className="text-xs text-center text-slate-400 mt-3">
                        The customer will be notified of your decision
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CancellationApprovalModal;
