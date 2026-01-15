// src/features/jobs/SlotPicker.jsx
// ============================================
// SLOT PICKER - Homeowner selects from offered times
// ============================================
// Displays offered time slots and lets homeowner pick one
// UPDATED: Use ISO time storage

import React, { useState, useMemo, useEffect } from 'react';
import {
    Calendar, Clock, CheckCircle, X, MapPin,
    User, DollarSign, ArrowRight, AlertCircle, CalendarDays, Info, Loader2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';
import {
    jobIsMultiDay,
    isMultiDayJob as checkIsMultiDay,
    calculateDaysNeeded,
    getMultiDaySummary
} from '../contractor-pro/lib/multiDayUtils';

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

// NEW: Helper for displaying confirmed times consistently
const formatScheduledTime = (isoString) => {
    if (!isoString) return 'Not set';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

export const SlotPicker = ({
    job,
    onClose,
    onSuccess,
    onRequestNewTimes
}) => {
    const [selectedSlotIds, setSelectedSlotIds] = useState([]); // Changed to array for multi-selection
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [acknowledgedMultiDay, setAcknowledgedMultiDay] = useState(false);

    // EDGE CASE: Handle null/undefined job
    if (!job) {
        return (
            <div className="p-6 text-center">
                <AlertCircle size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-slate-600">No job data available</p>
            </div>
        );
    }

    // EDGE CASE: Validate job has required ID
    if (!job.id) {
        return (
            <div className="p-6 text-center">
                <AlertCircle size={32} className="mx-auto mb-2 text-amber-500" />
                <p className="text-slate-600">Invalid job reference</p>
            </div>
        );
    }

    const offeredSlots = job.scheduling?.offeredSlots?.filter(s => s.status === 'offered') || [];
    const contractorMessage = job.scheduling?.offeredMessage;

    // Detect multi-day job - check multiple sources
    const multiDayInfo = useMemo(() => {
        // Method 1: Check if job already has multi-day schedule
        if (jobIsMultiDay(job)) {
            return {
                isMultiDay: true,
                totalDays: job.multiDaySchedule?.totalDays || 2,
                summary: getMultiDaySummary(job.multiDaySchedule)
            };
        }

        // Method 2: Check explicit scheduling flags (set when contractor offers slots)
        if (job.scheduling?.isMultiDay) {
            const days = job.scheduling.totalDays || 2;
            const hours = Math.round((job.scheduling.estimatedDuration || 0) / 60);
            return {
                isMultiDay: true,
                totalDays: days,
                summary: `${days} work days (~${hours} hours total)`
            };
        }

        // Method 3: Check estimated duration from multiple sources
        const duration = job.estimatedDuration
            || job.scheduling?.estimatedDuration
            || job.quote?.estimatedDuration
            || 0;

        if (checkIsMultiDay(duration)) {
            const days = calculateDaysNeeded(duration);
            const hours = Math.round(duration / 60);
            return {
                isMultiDay: true,
                totalDays: days,
                summary: `${days} work days (~${hours} hours total)`
            };
        }

        return { isMultiDay: false, totalDays: 1, summary: '' };
    }, [job]);

    // Debug log to help troubleshoot multi-day detection
    useEffect(() => {
        console.log('[SlotPicker] Multi-day detection:', {
            jobId: job.id,
            multiDayInfo,
            estimatedDuration: job.estimatedDuration,
            schedulingDuration: job.scheduling?.estimatedDuration,
            schedulingIsMultiDay: job.scheduling?.isMultiDay,
            schedulingTotalDays: job.scheduling?.totalDays
        });
    }, [job, multiDayInfo]);

    // Handle slot selection confirmation
    const handleConfirm = async () => {
        if (selectedSlotIds.length === 0) {
            toast.error('Please select at least one time slot');
            return;
        }

        const selectedSlots = offeredSlots.filter(s => selectedSlotIds.includes(s.id));
        if (selectedSlots.length === 0) return;

        setIsSubmitting(true);
        try {
            // Update all slots - mark selected ones, expire others
            const updatedSlots = job.scheduling.offeredSlots.map(slot => ({
                ...slot,
                status: selectedSlotIds.includes(slot.id) ? 'selected' : 'expired'
            }));

            // For multiple slots, we'll store all of them
            const confirmedSlots = selectedSlots.map(slot => ({
                id: slot.id,
                start: new Date(slot.start).toISOString(),
                end: new Date(slot.end).toISOString()
            }));

            // Use the first slot's start time as the primary scheduledTime
            const primarySlot = selectedSlots[0];
            const startISO = new Date(primarySlot.start).toISOString();
            const endISO = new Date(primarySlot.end).toISOString();

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                // Update scheduling object
                'scheduling.offeredSlots': updatedSlots,
                'scheduling.selectedSlotIds': selectedSlotIds, // Array of selected IDs
                'scheduling.selectedAt': serverTimestamp(),
                'scheduling.confirmedSlots': confirmedSlots, // Array of all selected slots
                'scheduling.confirmedSlot': { // Keep single slot for backward compatibility
                    start: startISO,
                    end: endISO
                },
                'scheduling.confirmedAt': serverTimestamp(),

                // Set the top-level scheduled fields for easier queries (use first slot)
                scheduledTime: startISO,
                scheduledDate: startISO,

                // Update status
                status: 'scheduled',

                lastActivity: serverTimestamp()
            });

            const successMessage = selectedSlotIds.length === 1
                ? 'Appointment confirmed!'
                : `${selectedSlotIds.length} appointments confirmed!`;
            toast.success(successMessage);

            // Send email notification to customer (non-blocking)
            if (job.customer?.email) {
                // Send email for each selected slot
                selectedSlots.forEach(slot => {
                    const slotStartISO = new Date(slot.start).toISOString();

                    fetch('/api/send-job-scheduled', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customerEmail: job.customer.email,
                            customerName: job.customer.name || 'there',
                            contractorName: job.contractorName || 'Your contractor',
                            contractorPhone: job.contractorPhone || null,
                            contractorEmail: job.contractorEmail || null,
                            jobTitle: job.title || 'Service',
                            jobNumber: job.jobNumber || null,
                            scheduledDate: slotStartISO,
                            scheduledTime: new Date(slotStartISO).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                            estimatedDuration: null,
                            serviceAddress: job.serviceAddress?.formatted || job.customer?.address || null,
                            notes: selectedSlotIds.length > 1 ? `This is ${selectedSlots.indexOf(slot) + 1} of ${selectedSlotIds.length} scheduled appointments` : null,
                            jobLink: 'https://mykrib.app/app/'
                        })
                    }).then(res => {
                        if (res.ok) console.log('[SlotPicker] Confirmation email sent');
                    }).catch(err => console.warn('[SlotPicker] Email error:', err));
                });
            }

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
                        <h3 className="font-bold text-slate-800">Pick Your Times</h3>
                        <p className="text-xs text-slate-500">
                            {selectedSlotIds.length === 0
                                ? 'Select one or more time slots'
                                : `${selectedSlotIds.length} slot${selectedSlotIds.length > 1 ? 's' : ''} selected`
                            }
                        </p>
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

                {/* Multi-Day Job Warning Banner - ENHANCED */}
                {multiDayInfo.isMultiDay && (
                    <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-3">
                            <div className="bg-indigo-500 p-2 rounded-lg shrink-0">
                                <CalendarDays size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-indigo-900">
                                    ⚠️ This is a {multiDayInfo.totalDays}-Day Job
                                </h4>
                                <p className="text-sm text-indigo-700 mt-1">
                                    {multiDayInfo.summary || `Work will span ${multiDayInfo.totalDays} consecutive days`}
                                </p>

                                {/* Explicit Confirmation Box */}
                                <div className="mt-3 p-3 bg-white rounded-lg border-2 border-indigo-200">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                                        <div className="text-sm text-indigo-800">
                                            <p className="font-bold mb-1">Please Note:</p>
                                            <ul className="list-disc list-inside space-y-1 text-xs">
                                                <li>You're selecting a <strong>START date</strong></li>
                                                <li>Work continues for <strong>{multiDayInfo.totalDays} consecutive days</strong></li>
                                                <li>The contractor needs access each day to complete the job</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Acknowledgment Checkbox */}
                        <div className="mt-4 flex items-start gap-3 p-3 bg-indigo-100 rounded-lg">
                            <input
                                type="checkbox"
                                id="acknowledge-multiday"
                                checked={acknowledgedMultiDay}
                                onChange={(e) => setAcknowledgedMultiDay(e.target.checked)}
                                className="mt-1 h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                            />
                            <label htmlFor="acknowledge-multiday" className="text-sm text-indigo-800">
                                I understand this is a <strong>{multiDayInfo.totalDays}-day job</strong> and
                                I'll be available for all {multiDayInfo.totalDays} consecutive days starting from my selected date.
                            </label>
                        </div>
                    </div>
                )}

                {/* Contractor Message */}
                {contractorMessage && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
                        <p className="text-sm text-blue-800 italic">"{contractorMessage}"</p>
                    </div>
                )}

                {/* Time Slots */}
                <p className="text-sm font-bold text-slate-700 mb-3">
                    {multiDayInfo.isMultiDay ? 'Select a Start Date:' : 'Available Times:'}
                </p>
                <div className="space-y-2">
                    {offeredSlots.map(slot => {
                        const isSelected = selectedSlotIds.includes(slot.id);

                        // Calculate end date for multi-day jobs
                        const slotStartDate = new Date(slot.start);
                        let endDateStr = '';
                        if (multiDayInfo.isMultiDay && multiDayInfo.totalDays > 1) {
                            const endDate = new Date(slotStartDate);
                            endDate.setDate(endDate.getDate() + multiDayInfo.totalDays - 1);
                            endDateStr = endDate.toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            });
                        }

                        return (
                            <button
                                key={slot.id}
                                onClick={() => {
                                    // Toggle selection
                                    if (isSelected) {
                                        setSelectedSlotIds(selectedSlotIds.filter(id => id !== slot.id));
                                    } else {
                                        setSelectedSlotIds([...selectedSlotIds, slot.id]);
                                    }
                                }}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isSelected
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className={`font-bold ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>
                                            {formatDate(slot.start)}
                                        </p>
                                        <p className={`text-sm mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`}>
                                            {formatTimeRange(slot.start, slot.end)}
                                        </p>

                                        {/* Show date range for multi-day jobs - PROMINENT */}
                                        {multiDayInfo.isMultiDay && endDateStr && (
                                            <div className={`mt-2 flex items-center gap-2 ${
                                                isSelected ? 'text-indigo-600' : 'text-indigo-500'
                                            }`}>
                                                <CalendarDays size={14} />
                                                <p className="text-sm font-medium">
                                                    Through {endDateStr} ({multiDayInfo.totalDays} days)
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ml-3 ${isSelected
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
                {/* Multi-day confirmation reminder */}
                {multiDayInfo.isMultiDay && selectedSlotIds.length > 0 && (
                    <p className="text-xs text-center text-indigo-600 mb-2 font-medium">
                        Confirming {multiDayInfo.totalDays} consecutive work days
                    </p>
                )}
                <button
                    onClick={handleConfirm}
                    disabled={
                        isSubmitting ||
                        selectedSlotIds.length === 0 ||
                        (multiDayInfo.isMultiDay && !acknowledgedMultiDay)
                    }
                    className={`w-full py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        multiDayInfo.isMultiDay
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Confirming...
                        </>
                    ) : selectedSlotIds.length === 0 ? (
                        'Select a Time Slot'
                    ) : multiDayInfo.isMultiDay && !acknowledgedMultiDay ? (
                        <>
                            <AlertCircle size={18} />
                            Please acknowledge above
                        </>
                    ) : multiDayInfo.isMultiDay ? (
                        <>
                            <CheckCircle size={18} />
                            Confirm {multiDayInfo.totalDays}-Day Appointment
                        </>
                    ) : selectedSlotIds.length === 1 ? (
                        <>
                            <CheckCircle size={18} />
                            Confirm Appointment
                        </>
                    ) : (
                        <>
                            <CheckCircle size={18} />
                            Confirm {selectedSlotIds.length} Appointments
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SlotPicker;
