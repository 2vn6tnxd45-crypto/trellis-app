// src/features/jobs/CancelJobModal.jsx
// ============================================
// CANCEL JOB MODAL
// ============================================
// Allows homeowners to cancel a job with an optional reason

import React, { useState } from 'react';
import { X, AlertTriangle, XCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';

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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCancel = async () => {
        if (!selectedReason) {
            toast.error('Please select a reason');
            return;
        }

        setIsSubmitting(true);
        try {
            const reason = selectedReason === 'other' 
                ? customReason || 'Other' 
                : CANCEL_REASONS.find(r => r.id === selectedReason)?.label;

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                status: 'cancelled',
                cancellation: {
                    cancelledAt: serverTimestamp(),
                    cancelledBy: 'homeowner',
                    reason: reason
                },
                lastActivity: serverTimestamp()
            });

            toast.success('Job cancelled');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error cancelling job:', error);
            toast.error('Failed to cancel job');
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
                        <div className="bg-red-100 p-2 rounded-xl">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Cancel Job</h3>
                            <p className="text-xs text-slate-500">This action cannot be undone</p>
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
                <div className="p-5">
                    {/* Job Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-5">
                        <p className="font-bold text-slate-800">
                            {job.title || job.description || 'Service Request'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {job.contractorName || job.customer?.name || 'Contractor'}
                        </p>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            The contractor will be notified that you've cancelled this job. 
                            If you'd like to reschedule instead, consider requesting different times.
                        </p>
                    </div>

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
                                        ? 'border-red-300 bg-red-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="cancelReason"
                                    value={reason.id}
                                    checked={selectedReason === reason.id}
                                    onChange={(e) => setSelectedReason(e.target.value)}
                                    className="text-red-600 focus:ring-red-500"
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
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-red-500 outline-none"
                                rows={3}
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
                        className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                Cancelling...
                            </>
                        ) : (
                            'Cancel Job'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancelJobModal;
