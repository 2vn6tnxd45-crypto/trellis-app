// src/features/jobs/SlotPicker.jsx
// ============================================
// SLOT PICKER - Homeowner selects from offered times
// ============================================
// Displays offered time slots and lets homeowner pick one

import React, { useState } from 'react';
import { 
    Calendar, Clock, CheckCircle, X, MapPin, 
    User, DollarSign, ArrowRight, AlertCircle
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric' 
    });
};

const formatTimeRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const startTime = startDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
    });
    const endTime = endDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
    });
    
    return `${startTime} - ${endTime}`;
};

export const SlotPicker = ({ 
    job, 
    onClose, 
    onSuccess,
    onRequestNewTimes 
}) => {
    const [selectedSlotId, setSelectedSlotId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const offeredSlots = job.scheduling?.offeredSlots?.filter(s => s.status === 'offered') || [];
    const contractorMessage = job.scheduling?.offeredMessage;

    // Handle slot selection confirmation
    const handleConfirm = async () => {
        if (!selectedSlotId) {
            toast.error('Please select a time slot');
            return;
        }

        const selectedSlot = offeredSlots.find(s => s.id === selectedSlotId);
        if (!selectedSlot) return;

        setIsSubmitting(true);
        try {
            // Update all slots - mark selected one, expire others
            const updatedSlots = job.scheduling.offeredSlots.map(slot => ({
                ...slot,
                status: slot.id === selectedSlotId ? 'selected' : 'expired'
            }));

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                // Update scheduling
                'scheduling.offeredSlots': updatedSlots,
                'scheduling.selectedSlotId': selectedSlotId,
                'scheduling.selectedAt': serverTimestamp(),
                'scheduling.confirmedSlot': {
                    start: selectedSlot.start,
                    end: selectedSlot.end
                },
                'scheduling.confirmedAt': serverTimestamp(),
                
                // Set the confirmed time
                scheduledTime: selectedSlot.start,
                scheduledDate: selectedSlot.start,
                
                // Update status
                status: 'scheduled',
                
                lastActivity: serverTimestamp()
            });

            toast.success('Appointment confirmed!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error confirming slot:', error);
            toast.error('Failed to confirm appointment');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (offeredSlots.length === 0) {
        return (
            <div className="p-6 text-center">
                <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
                <p className="font-bold text-slate-800">No time slots available</p>
                <p className="text-sm text-slate-500 mt-1">
                    The contractor hasn't offered any times yet.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                        <Calendar className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Pick a Time</h3>
                        <p className="text-xs text-slate-500">Select the option that works best</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Job Info */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-slate-800">
                        {job.title || job.description || 'Service'}
                    </h4>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                        {job.contractorName && (
                            <span className="flex items-center gap-1">
                                <User size={12} />
                                {job.contractorName}
                            </span>
                        )}
                        {job.total > 0 && (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                <DollarSign size={12} />
                                {job.total.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Contractor Message */}
                {contractorMessage && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                        <p className="text-sm text-blue-800 italic">"{contractorMessage}"</p>
                    </div>
                )}

                {/* Time Slots */}
                <p className="text-sm font-bold text-slate-700 mb-3">Available Times:</p>
                <div className="space-y-2">
                    {offeredSlots.map(slot => {
                        const isSelected = selectedSlotId === slot.id;
                        
                        return (
                            <button
                                key={slot.id}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={`font-bold ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>
                                            {formatDate(slot.start)}
                                        </p>
                                        <p className={`text-sm mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            {formatTimeRange(slot.start, slot.end)}
                                        </p>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                        isSelected
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-slate-300'
                                    }`}>
                                        {isSelected && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* None work option */}
                <button
                    onClick={onRequestNewTimes}
                    className="w-full mt-4 py-3 text-slate-500 text-sm font-medium hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
                >
                    <AlertCircle size={16} />
                    None of these times work for me
                </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button
                    onClick={handleConfirm}
                    disabled={isSubmitting || !selectedSlotId}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Confirming...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={18} />
                            Confirm Appointment
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SlotPicker;
