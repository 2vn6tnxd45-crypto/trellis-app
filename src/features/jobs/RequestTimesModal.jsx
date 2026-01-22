// src/features/jobs/RequestTimesModal.jsx
// ============================================
// REQUEST DIFFERENT TIMES MODAL
// ============================================
// Allows homeowners to request new time options or reschedule a scheduled job

import React, { useState, useMemo } from 'react';
import { X, Clock, Calendar, Send, Sun, Moon, Coffee, AlertCircle, RefreshCw } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';
import { formatInTimezone, detectTimezone, createDateInTimezone } from '../contractor-pro/lib/timezoneUtils';

const TIME_PREFERENCES = [
    { id: 'morning', label: 'Mornings', sublabel: '8 AM - 12 PM', icon: Coffee },
    { id: 'afternoon', label: 'Afternoons', sublabel: '12 PM - 5 PM', icon: Sun },
    { id: 'evening', label: 'Evenings', sublabel: '5 PM - 8 PM', icon: Moon },
    { id: 'flexible', label: 'Flexible', sublabel: 'Any time works', icon: Clock }
];

const DAY_PREFERENCES = [
    { id: 'weekdays', label: 'Weekdays', sublabel: 'Mon - Fri' },
    { id: 'weekends', label: 'Weekends', sublabel: 'Sat - Sun' },
    { id: 'any', label: 'Any Day', sublabel: 'Flexible' }
];

const RESCHEDULE_REASONS = [
    { id: 'conflict', label: 'I have a scheduling conflict' },
    { id: 'emergency', label: 'Emergency came up' },
    { id: 'illness', label: 'Illness' },
    { id: 'travel', label: 'Will be traveling' },
    { id: 'work', label: 'Work obligations' },
    { id: 'other', label: 'Other reason' }
];

export const RequestTimesModal = ({ job, onClose, onSuccess, timezone }) => {
    const [timePrefs, setTimePrefs] = useState([]);
    const [dayPref, setDayPref] = useState('');
    const [message, setMessage] = useState('');
    const [specificDates, setSpecificDates] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reschedule-specific state
    const [proposedDate, setProposedDate] = useState('');
    const [proposedTime, setProposedTime] = useState('09:00');
    const [rescheduleReason, setRescheduleReason] = useState('');

    const displayTimezone = timezone || detectTimezone();

    // Check if this is a reschedule request (job is already scheduled)
    const isReschedule = Boolean(job.scheduledTime && job.status === 'scheduled');

    // Current schedule display
    const currentScheduleDisplay = useMemo(() => {
        if (!job.scheduledTime) return null;

        if (job.multiDaySchedule?.isMultiDay) {
            return formatInTimezone(job.scheduledTime, displayTimezone, {
                weekday: 'short', month: 'short', day: 'numeric'
            }) + ` - ${job.multiDaySchedule.totalDays} days`;
        }

        return formatInTimezone(job.scheduledTime, displayTimezone, {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    }, [job, displayTimezone]);

    const toggleTimePref = (id) => {
        setTimePrefs(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        // Different validation for reschedule vs new request
        if (isReschedule) {
            if (!rescheduleReason) {
                toast.error('Please select a reason for rescheduling');
                return;
            }
            if (!proposedDate && !message && timePrefs.length === 0) {
                toast.error('Please propose a new time or provide availability');
                return;
            }
        } else {
            if (timePrefs.length === 0 && !dayPref && !message && !specificDates) {
                toast.error('Please provide some scheduling preferences');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            if (isReschedule) {
                // Build reschedule request
                const rescheduleRequest = {
                    type: 'reschedule',
                    previousTime: job.scheduledTime,
                    reason: rescheduleReason === 'other' ? message : RESCHEDULE_REASONS.find(r => r.id === rescheduleReason)?.label,
                    requestedAt: new Date().toISOString(),
                    requestedBy: 'homeowner'
                };

                // Add proposed time if specified
                if (proposedDate && proposedTime) {
                    const [year, month, day] = proposedDate.split('-').map(Number);
                    const [hours, minutes] = proposedTime.split(':').map(Number);
                    const proposedDateTime = createDateInTimezone(year, month - 1, day, hours, minutes, displayTimezone);

                    rescheduleRequest.proposedTime = proposedDateTime.toISOString();
                }

                // Add availability preferences if provided
                if (timePrefs.length > 0 || dayPref) {
                    rescheduleRequest.availability = {
                        timeOfDay: timePrefs.map(id => TIME_PREFERENCES.find(t => t.id === id)?.label).filter(Boolean),
                        dayPreference: DAY_PREFERENCES.find(d => d.id === dayPref)?.label || null
                    };
                }

                if (message && rescheduleReason !== 'other') {
                    rescheduleRequest.additionalNotes = message;
                }

                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                    rescheduleRequest,
                    rescheduleRequestedAt: serverTimestamp(),
                    rescheduleRequestedBy: 'homeowner',
                    // Add to history
                    schedulingRequests: arrayUnion(rescheduleRequest),
                    lastActivity: serverTimestamp()
                });

                // Send notification email to contractor (non-blocking)
                sendRescheduleRequestNotification(job, rescheduleRequest)
                    .catch(err => console.warn('[RequestTimesModal] Email error:', err));

                toast.success('Reschedule request sent to contractor');
            } else {
                // Original new times request flow
                const preferences = {
                    type: 'new_times',
                    timeOfDay: timePrefs.map(id => TIME_PREFERENCES.find(t => t.id === id)?.label).filter(Boolean),
                    dayPreference: DAY_PREFERENCES.find(d => d.id === dayPref)?.label || null,
                    specificDates: specificDates || null,
                    additionalNotes: message || null,
                    requestedAt: new Date().toISOString(),
                    requestedBy: 'homeowner'
                };

                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                    schedulingRequests: arrayUnion(preferences),
                    schedulingStatus: 'needs_new_times',
                    lastActivity: serverTimestamp(),
                    'scheduling.requestedNewTimes': true,
                    'scheduling.requestedNewTimesAt': serverTimestamp()
                });

                toast.success('Request sent to contractor');
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error submitting request:', error);
            toast.error('Failed to send request');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Time options for proposed time
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

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isReschedule ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                            {isReschedule ? (
                                <RefreshCw className="h-5 w-5 text-amber-600" />
                            ) : (
                                <Calendar className="h-5 w-5 text-emerald-600" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">
                                {isReschedule ? 'Request Reschedule' : 'Request Different Times'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isReschedule ? 'Ask the contractor to move your appointment' : 'Let the contractor know your availability'}
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

                {/* Content - Scrollable */}
                <div className="p-5 overflow-y-auto flex-1">
                    {/* Job Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-5">
                        <p className="font-bold text-slate-800">
                            {job.title || job.description || 'Service Request'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {job.contractorName || 'Contractor'}
                        </p>
                    </div>

                    {/* Current Schedule (for reschedule requests) */}
                    {isReschedule && currentScheduleDisplay && (
                        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={16} className="text-amber-600" />
                                <span className="text-sm font-medium text-amber-800">Currently scheduled:</span>
                            </div>
                            <p className="text-amber-900 font-bold mt-1">{currentScheduleDisplay}</p>
                        </div>
                    )}

                    {/* Reschedule Reason (for reschedule requests) */}
                    {isReschedule && (
                        <div className="mb-5">
                            <p className="text-sm font-bold text-slate-700 mb-3">
                                Why do you need to reschedule?
                            </p>
                            <div className="space-y-2">
                                {RESCHEDULE_REASONS.map(reason => (
                                    <button
                                        key={reason.id}
                                        onClick={() => setRescheduleReason(reason.id)}
                                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                                            rescheduleReason === reason.id
                                                ? 'border-amber-300 bg-amber-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className={`text-sm font-medium ${rescheduleReason === reason.id ? 'text-amber-700' : 'text-slate-700'}`}>
                                            {reason.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proposed New Time (for reschedule) */}
                    {isReschedule && (
                        <div className="mb-5 p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm font-bold text-slate-700 mb-3">
                                Propose a new time <span className="text-slate-400 font-normal">(optional)</span>
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={proposedDate}
                                    onChange={(e) => setProposedDate(e.target.value)}
                                    min={(() => {
                                        const today = new Date();
                                        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                    })()}
                                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                                <select
                                    value={proposedTime}
                                    onChange={(e) => setProposedTime(e.target.value)}
                                    className="w-32 px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                >
                                    {timeOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Or leave blank and share your availability below
                            </p>
                        </div>
                    )}

                    {/* Time of Day Preferences */}
                    <div className="mb-5">
                        <p className="text-sm font-bold text-slate-700 mb-3">
                            {isReschedule ? 'What times generally work for you?' : 'What times work best?'}{' '}
                            <span className="text-slate-400 font-normal">(select all that apply)</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {TIME_PREFERENCES.map(pref => {
                                const Icon = pref.icon;
                                const isSelected = timePrefs.includes(pref.id);
                                const accentColor = isReschedule ? 'amber' : 'emerald';
                                return (
                                    <button
                                        key={pref.id}
                                        onClick={() => toggleTimePref(pref.id)}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            isSelected
                                                ? `border-${accentColor}-300 bg-${accentColor}-50`
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon size={16} className={isSelected ? `text-${accentColor}-600` : 'text-slate-400'} />
                                            <span className={`text-sm font-medium ${isSelected ? `text-${accentColor}-700` : 'text-slate-700'}`}>
                                                {pref.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">{pref.sublabel}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Day Preferences */}
                    <div className="mb-5">
                        <p className="text-sm font-bold text-slate-700 mb-3">
                            What days work best?
                        </p>
                        <div className="flex gap-2">
                            {DAY_PREFERENCES.map(pref => {
                                const accentColor = isReschedule ? 'amber' : 'emerald';
                                return (
                                    <button
                                        key={pref.id}
                                        onClick={() => setDayPref(pref.id)}
                                        className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                                            dayPref === pref.id
                                                ? `border-${accentColor}-300 bg-${accentColor}-50`
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className={`text-sm font-medium block ${dayPref === pref.id ? `text-${accentColor}-700` : 'text-slate-700'}`}>
                                            {pref.label}
                                        </span>
                                        <span className="text-xs text-slate-500">{pref.sublabel}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Specific Dates (for non-reschedule) */}
                    {!isReschedule && (
                        <div className="mb-5">
                            <p className="text-sm font-bold text-slate-700 mb-2">
                                Any specific dates that work? <span className="text-slate-400 font-normal">(optional)</span>
                            </p>
                            <input
                                type="text"
                                value={specificDates}
                                onChange={(e) => setSpecificDates(e.target.value)}
                                placeholder="e.g., Jan 15, Jan 18, or anytime next week"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    )}

                    {/* Additional Message */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 mb-2">
                            {rescheduleReason === 'other' ? 'Please explain:' : 'Anything else the contractor should know?'}{' '}
                            {rescheduleReason !== 'other' && <span className="text-slate-400 font-normal">(optional)</span>}
                        </p>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={isReschedule ? 'e.g., I apologize for the inconvenience...' : 'e.g., I work from home on Tuesdays, so that would be ideal...'}
                            className={`w-full px-4 py-3 border border-slate-200 rounded-xl resize-none outline-none ${
                                isReschedule ? 'focus:ring-2 focus:ring-amber-500' : 'focus:ring-2 focus:ring-emerald-500'
                            }`}
                            rows={3}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                            isReschedule ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                {isReschedule ? 'Request Reschedule' : 'Send Request'}
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

async function sendRescheduleRequestNotification(job, rescheduleRequest) {
    try {
        const response = await fetch('/api/send-reschedule-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contractorEmail: job.contractorEmail,
                contractorName: job.contractorName || 'there',
                customerName: job.customer?.name || 'Customer',
                customerPhone: job.customer?.phone || null,
                jobTitle: job.title || job.description || 'Service',
                jobNumber: job.jobNumber || null,
                currentScheduledTime: job.scheduledTime,
                proposedTime: rescheduleRequest.proposedTime || null,
                reason: rescheduleRequest.reason,
                availability: rescheduleRequest.availability || null,
                additionalNotes: rescheduleRequest.additionalNotes || null,
                jobLink: `https://mykrib.app/pro/jobs/${job.id}`
            })
        });

        if (response.ok) {
            console.log('[RequestTimesModal] Reschedule request email sent');
        }
    } catch (error) {
        console.warn('[RequestTimesModal] Failed to send email:', error);
    }
}

export default RequestTimesModal;
