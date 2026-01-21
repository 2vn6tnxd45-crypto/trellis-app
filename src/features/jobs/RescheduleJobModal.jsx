// src/features/jobs/RescheduleJobModal.jsx
// ============================================
// RESCHEDULE JOB MODAL
// ============================================
// Allows contractors to reschedule a scheduled job to a new date/time
// Tracks schedule history, notifies homeowner, handles multi-day jobs

import React, { useState, useMemo } from 'react';
import {
    Calendar, Clock, AlertCircle, Check, X, MapPin,
    History, Users, RefreshCw
} from 'lucide-react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';
import { Select } from '../../components/ui/Select';
import { createDateInTimezone, detectTimezone, formatInTimezone } from '../contractor-pro/lib/timezoneUtils';
import { isMultiDayJob, createMultiDaySchedule } from '../contractor-pro/lib/multiDayUtils';

// ============================================
// HELPERS
// ============================================

// Helper to safely extract address string (prevents React Error #310)
const safeAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
        if (addr.formatted) return addr.formatted;
        if (addr.full) return addr.full;
        if (addr.street) return addr.street;
        return '';
    }
    return String(addr);
};

// ============================================
// RESCHEDULE REASONS
// ============================================

const RESCHEDULE_REASONS = [
    { value: 'weather', label: 'Weather conditions' },
    { value: 'crew_unavailable', label: 'Crew unavailable' },
    { value: 'equipment_issue', label: 'Equipment issue' },
    { value: 'scheduling_conflict', label: 'Scheduling conflict' },
    { value: 'customer_request', label: 'Customer requested' },
    { value: 'material_delay', label: 'Material delay' },
    { value: 'other', label: 'Other reason' }
];

// ============================================
// MAIN COMPONENT
// ============================================

export const RescheduleJobModal = ({
    job,
    onClose,
    onSuccess,
    teamMembers = [],
    timezone,
    workingHours = {},
    allJobs = [] // For conflict detection
}) => {
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [rescheduleTime, setRescheduleTime] = useState('09:00');
    const [duration, setDuration] = useState(job.estimatedDuration || 120);
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [notifyCustomer, setNotifyCustomer] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const displayTimezone = timezone || detectTimezone();

    // Multi-day detection
    const isMultiDay = isMultiDayJob(duration);
    const estimatedDays = Math.ceil(duration / 480);

    // Time options
    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 6; h <= 20; h++) {
            for (let m = 0; m < 60; m += 30) {
                const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                options.push({ value: time, label });
            }
        }
        return options;
    }, []);

    // Format original scheduled time for display
    const originalTimeDisplay = useMemo(() => {
        if (!job.scheduledTime) return 'Not scheduled';

        if (job.multiDaySchedule?.isMultiDay) {
            const startStr = formatInTimezone(job.scheduledTime, displayTimezone, {
                month: 'short', day: 'numeric'
            });
            const endStr = formatInTimezone(job.multiDaySchedule.endDate, displayTimezone, {
                month: 'short', day: 'numeric'
            });
            return `${startStr} - ${endStr} (${job.multiDaySchedule.totalDays} days)`;
        }

        return formatInTimezone(job.scheduledTime, displayTimezone, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }, [job, displayTimezone]);

    // Check for conflicts with new time
    const conflictWarning = useMemo(() => {
        if (!rescheduleDate || !rescheduleTime) return null;

        const [year, month, day] = rescheduleDate.split('-').map(Number);
        const [hours, minutes] = rescheduleTime.split(':').map(Number);
        const newStartTime = createDateInTimezone(year, month - 1, day, hours, minutes, displayTimezone);
        const newEndTime = new Date(newStartTime);
        newEndTime.setMinutes(newEndTime.getMinutes() + duration);

        // Check against other scheduled jobs
        for (const otherJob of allJobs) {
            if (otherJob.id === job.id) continue;
            if (!otherJob.scheduledTime) continue;
            if (['completed', 'cancelled'].includes(otherJob.status)) continue;

            const otherStart = new Date(otherJob.scheduledTime).getTime();
            const otherDuration = otherJob.estimatedDuration || 120;
            const otherEnd = otherStart + otherDuration * 60 * 1000;

            // Check for overlap
            if (newStartTime.getTime() < otherEnd && newEndTime.getTime() > otherStart) {
                return {
                    job: otherJob,
                    message: `Conflicts with "${otherJob.title || 'another job'}" for ${otherJob.customer?.name || 'customer'}`
                };
            }
        }

        return null;
    }, [rescheduleDate, rescheduleTime, duration, allJobs, job.id, displayTimezone]);

    // Handle reschedule submission
    const handleReschedule = async () => {
        if (!rescheduleDate || !rescheduleTime) {
            toast.error('Please select a new date and time');
            return;
        }

        if (!reason) {
            toast.error('Please select a reason for rescheduling');
            return;
        }

        const finalReason = reason === 'other' ? customReason : RESCHEDULE_REASONS.find(r => r.value === reason)?.label;
        if (reason === 'other' && !customReason.trim()) {
            toast.error('Please enter a reason');
            return;
        }

        setIsSubmitting(true);

        try {
            const [year, month, day] = rescheduleDate.split('-').map(Number);
            const [hours, minutes] = rescheduleTime.split(':').map(Number);

            const newScheduledTime = createDateInTimezone(year, month - 1, day, hours, minutes, displayTimezone);
            const newEndTime = new Date(newScheduledTime);
            newEndTime.setMinutes(newEndTime.getMinutes() + duration);

            // Build history entry
            const historyEntry = {
                previousTime: job.scheduledTime,
                previousEndTime: job.scheduledEndTime || null,
                previousMultiDay: job.multiDaySchedule || null,
                newTime: newScheduledTime.toISOString(),
                newEndTime: newEndTime.toISOString(),
                changedBy: 'contractor',
                reason: finalReason,
                changedAt: new Date().toISOString()
            };

            // Build update data
            const updateData = {
                scheduledTime: newScheduledTime.toISOString(),
                scheduledDate: newScheduledTime.toISOString(),
                scheduledEndTime: newEndTime.toISOString(),
                estimatedDuration: duration,
                scheduleHistory: arrayUnion(historyEntry),
                lastRescheduledAt: serverTimestamp(),
                lastRescheduledBy: 'contractor',
                lastActivity: serverTimestamp()
            };

            // Handle multi-day schedule
            if (isMultiDay) {
                const multiDaySchedule = createMultiDaySchedule(
                    newScheduledTime,
                    duration,
                    workingHours
                );
                updateData.multiDaySchedule = multiDaySchedule;
            } else {
                // Clear multi-day if it was previously multi-day but now isn't
                if (job.multiDaySchedule) {
                    updateData.multiDaySchedule = null;
                }
            }

            // Update the job
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), updateData);

            // Send notification to customer (non-blocking)
            if (notifyCustomer && job.customer?.email) {
                sendRescheduleNotification(job, newScheduledTime, finalReason, isMultiDay, estimatedDays)
                    .catch(err => console.warn('[RescheduleJobModal] Email error:', err));
            }

            toast.success(isMultiDay
                ? `Job rescheduled to ${estimatedDays} days starting ${rescheduleDate}!`
                : 'Job rescheduled successfully!'
            );

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error rescheduling job:', error);
            toast.error('Failed to reschedule job');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-amber-100 rounded-full">
                        <RefreshCw className="text-amber-600" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Reschedule Job</h3>
                        <p className="text-sm text-slate-500">Move this appointment to a new time</p>
                    </div>
                </div>

                {/* Job Info */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-slate-800">
                        {job.title || job.description || 'Service'}
                    </h4>
                    <p className="text-sm text-slate-500">{job.customer?.name || job.customerName}</p>
                    {safeAddress(job.customer?.address) && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin size={12} />
                            {safeAddress(job.customer.address)}
                        </p>
                    )}
                </div>

                {/* Original Schedule */}
                <div className="mb-4 p-3 bg-slate-100 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-600">
                        <History size={16} />
                        <span className="text-sm font-medium">Currently scheduled:</span>
                    </div>
                    <p className="text-slate-800 font-bold mt-1">{originalTimeDisplay}</p>
                </div>

                {/* Schedule History (if any) */}
                {job.scheduleHistory?.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                            <AlertCircle size={12} />
                            This job has been rescheduled {job.scheduleHistory.length} time{job.scheduleHistory.length > 1 ? 's' : ''} before
                        </p>
                    </div>
                )}

                {/* New Date */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Date</label>
                    <input
                        type="date"
                        className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        value={rescheduleDate}
                        onChange={e => setRescheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                    />
                </div>

                {/* New Time */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">New Time</label>
                    <Select
                        value={rescheduleTime}
                        onChange={(val) => setRescheduleTime(val)}
                        options={timeOptions}
                    />
                </div>

                {/* Duration */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                    <Select
                        value={duration}
                        onChange={(val) => setDuration(parseInt(val))}
                        options={[
                            { value: 30, label: '30 minutes' },
                            { value: 60, label: '1 hour' },
                            { value: 90, label: '1.5 hours' },
                            { value: 120, label: '2 hours' },
                            { value: 180, label: '3 hours' },
                            { value: 240, label: '4 hours' },
                            { value: 480, label: 'Full day (8 hours)' },
                            { value: 960, label: '2 days' },
                            { value: 1440, label: '3 days' },
                            { value: 1920, label: '4 days' },
                            { value: 2400, label: '5 days' }
                        ]}
                    />
                </div>

                {/* Multi-day info */}
                {isMultiDay && (
                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <Calendar size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-indigo-800">Multi-Day Job</p>
                                <p className="text-xs text-indigo-600">
                                    This job will span ~{estimatedDays} work days.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Conflict Warning */}
                {conflictWarning && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-red-800">Schedule Conflict</p>
                                <p className="text-xs text-red-600">{conflictWarning.message}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reason */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Rescheduling</label>
                    <Select
                        value={reason}
                        onChange={(val) => setReason(val)}
                        options={[
                            { value: '', label: 'Select a reason...' },
                            ...RESCHEDULE_REASONS
                        ]}
                    />
                </div>

                {/* Custom Reason */}
                {reason === 'other' && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Please specify</label>
                        <input
                            type="text"
                            className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="Enter reason..."
                            value={customReason}
                            onChange={e => setCustomReason(e.target.value)}
                        />
                    </div>
                )}

                {/* Notify Customer */}
                <div className="mb-6 p-3 bg-slate-50 rounded-xl">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={notifyCustomer}
                            onChange={(e) => setNotifyCustomer(e.target.checked)}
                            className="mt-1 h-4 w-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                        />
                        <div>
                            <p className="font-medium text-slate-700">Notify customer</p>
                            <p className="text-xs text-slate-500">
                                Send an email to {job.customer?.email || 'the customer'} about the new schedule
                            </p>
                        </div>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleReschedule}
                        disabled={isSubmitting || !rescheduleDate || !rescheduleTime || !reason}
                        className="flex-1 px-4 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="animate-spin">⏳</span>
                                Rescheduling...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Reschedule
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// NOTIFICATION HELPER
// ============================================

async function sendRescheduleNotification(job, newScheduledTime, reason, isMultiDay, totalDays) {
    try {
        const response = await fetch('/api/send-job-rescheduled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerEmail: job.customer?.email,
                customerName: job.customer?.name || 'there',
                contractorName: job.contractorName || 'Your contractor',
                contractorPhone: job.contractorPhone || null,
                contractorEmail: job.contractorEmail || null,
                jobTitle: job.title || job.description || 'Service',
                jobNumber: job.jobNumber || null,
                previousDate: job.scheduledTime,
                newDate: newScheduledTime.toISOString(),
                newTime: newScheduledTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                reason: reason,
                isMultiDay,
                totalDays,
                serviceAddress: job.serviceAddress?.formatted || job.customer?.address || null,
                jobLink: 'https://mykrib.app/app/'
            })
        });

        if (response.ok) {
            console.log('[RescheduleJobModal] Reschedule email sent');
        } else {
            console.warn('[RescheduleJobModal] Email API returned non-ok status');
        }
    } catch (error) {
        console.warn('[RescheduleJobModal] Failed to send email:', error);
    }
}

export default RescheduleJobModal;
