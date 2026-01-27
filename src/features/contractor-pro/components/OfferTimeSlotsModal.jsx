// src/features/contractor-pro/components/OfferTimeSlotsModal.jsx
// ============================================
// OFFER TIME SLOTS MODAL - WITH AI + CALENDAR PICKER
// ============================================
// Full featured time slot offering with:
// - AI-powered suggestions
// - Visual calendar date picker
// - Quick presets
// - Conflict checking (Schedule & Resource Capacity)

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    X, Calendar, Clock, Plus, Trash2, Send,
    Sparkles, MapPin, User, DollarSign, AlertCircle,
    Sun, Coffee, Moon, ChevronDown, ChevronUp, CheckCircle, CalendarDays
} from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { createJobChatChannel } from '../../../lib/chatService';
import toast from 'react-hot-toast';
import { AISuggestionPanel } from './AISuggestionPanel';
import { CalendarPicker } from '../../../components/common/CalendarPicker';
// Import existing conflict checker
import { checkForConflicts } from '../lib/schedulingAI';
// Import multi-day utilities
import { isMultiDayJob as checkIsMultiDay, calculateDaysNeeded } from '../lib/multiDayUtils';
// Import quote service for updating quote status on cancellation
import { markQuoteJobCancelled } from '../../quotes/lib/quoteService';
// Import activity log service for tracking job events
import { logTimeSlotsOffered, logStatusChange } from '../../jobs/lib/activityLogService';
// Import duration formatting utility
import { formatMinutesToHuman } from '../lib/timeClockService';

// Quick time presets
const TIME_PRESETS = [
    { id: 'morning', label: 'Morning', icon: Coffee, start: '08:00', end: '12:00' },
    { id: 'afternoon', label: 'Afternoon', icon: Sun, start: '12:00', end: '17:00' },
    { id: 'evening', label: 'Evening', icon: Moon, start: '17:00', end: '20:00' }
];

// Generate time options
const generateTimeOptions = () => {
    const options = [];
    for (let h = 6; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = h.toString().padStart(2, '0');
            const min = m.toString().padStart(2, '0');
            const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${min} ${h >= 12 ? 'PM' : 'AM'}`;
            options.push({ value: `${hour}:${min}`, label });
        }
    }
    return options;
};

const TIME_OPTIONS = generateTimeOptions();

// Get dates that have scheduled jobs
const getScheduledDates = (jobs) => {
    return jobs
        .filter(job => job.scheduledTime || job.scheduledDate)
        .map(job => new Date(job.scheduledTime || job.scheduledDate));
};

// Check for resource conflicts (Fix 5b)
const checkResourceConflicts = (selectedSlot, allJobs, preferences) => {
    if (!selectedSlot.date || !selectedSlot.startTime) return null;

    const selectedDate = new Date(selectedSlot.date);
    const selectedStart = selectedSlot.startTime;
    const selectedEnd = selectedSlot.endTime;

    // Get jobs on the same date
    const sameDateJobs = allJobs.filter(job => {
        if (!job.scheduledTime && !job.scheduledDate) return false;
        const jobDate = job.scheduledTime
            ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
            : new Date(job.scheduledDate.toDate ? job.scheduledDate.toDate() : job.scheduledDate);

        return jobDate.getDate() === selectedDate.getDate() &&
            jobDate.getMonth() === selectedDate.getMonth() &&
            jobDate.getFullYear() === selectedDate.getFullYear();
    });

    // Check for actual time overlaps
    const overlappingJobs = sameDateJobs.filter(job => {
        const jobStartRaw = job.scheduledTime || job.scheduledDate;
        if (!jobStartRaw) return false;
        const jobStartDate = new Date(jobStartRaw.toDate ? jobStartRaw.toDate() : jobStartRaw);
        const jobDurationMin = job.estimatedDuration || job.duration || 60;
        const jobEndDate = new Date(jobStartDate.getTime() + jobDurationMin * 60000);

        // Parse selected slot times (HH:MM format)
        const [startH, startM] = (selectedStart || '08:00').split(':').map(Number);
        const [endH, endM] = (selectedEnd || '17:00').split(':').map(Number);
        const slotStart = new Date(selectedDate);
        slotStart.setHours(startH, startM, 0, 0);
        const slotEnd = new Date(selectedDate);
        slotEnd.setHours(endH, endM, 0, 0);

        // Overlap: slot starts before job ends AND slot ends after job starts
        return slotStart < jobEndDate && slotEnd > jobStartDate;
    });

    if (overlappingJobs.length === 0) return null;

    // Get resource capacity from preferences
    const vehicles = preferences?.vehicles || 1;
    const teamSize = preferences?.teamSize || 1;
    const maxConcurrent = Math.max(1, vehicles);

    // Count how many resources are already committed
    const resourcesInUse = overlappingJobs.length;

    // FIX: Changed from const to let to allow reassignment
    let availableResources = maxConcurrent - resourcesInUse;

    if (availableResources < 0) availableResources = 0; // Safety

    // If we have resources, no conflict. If 0 or less, conflict.
    if (availableResources > 0) return null;

    return {
        hasConflict: true,
        overlappingJobs,
        resourcesInUse,
        maxConcurrent,
        availableResources,
        canProceed: false,
        message: `All ${maxConcurrent} crews/vehicles are booked on this day.`
    };
};

// --- AI Prerequisite Check Component ---
const AIPrerequisiteCheck = ({ preferences, allJobs }) => {
    // Check if we have a home base address (from scheduling.homeBase OR profile.address fallback)
    const hasHomeBase = !!(preferences?.homeBase?.address || preferences?.address);

    // Check if working hours are configured with at least one enabled day
    const hasWorkingHours = preferences?.workingHours &&
        Object.values(preferences.workingHours).some(d => d?.enabled);

    const checks = [
        {
            label: 'Home Base Location',
            passed: hasHomeBase,
            fix: 'Go to Settings → Business Address'
        },
        {
            label: 'Working Hours',
            passed: hasWorkingHours,
            fix: 'Go to Settings → Working Hours'
        }
    ];

    const allPassed = checks.every(c => c.passed);

    if (allPassed) return null;

    return (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                    <p className="font-medium text-amber-800 mb-1">AI suggestions work better with:</p>
                    <ul className="text-amber-700 space-y-0.5">
                        {checks.filter(c => !c.passed).map((check, idx) => (
                            <li key={idx} className="text-xs">• {check.label} - {check.fix}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const OfferTimeSlotsModal = ({
    job,
    allJobs = [],
    schedulingPreferences = {},
    onClose,
    onSuccess,
    onNavigate   // ← ADD THIS
}) => {
    const [slots, setSlots] = useState([
        { id: 'slot_1', date: '', startTime: '09:00', endTime: '12:00', showCalendar: false }
    ]);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAISuggestions, setShowAISuggestions] = useState(true);
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [slotConflicts, setSlotConflicts] = useState({});
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // Customer preferences from job
    const customerPrefs = useMemo(() => {
        return job?.schedulingPreferences || job?.customerPreferences || null;
    }, [job]);

    // Multi-day job detection
    const multiDayInfo = useMemo(() => {
        // Check multiple sources for duration
        const duration = job?.estimatedDuration
            || job?.scheduling?.estimatedDuration
            || job?.quote?.estimatedDuration
            || job?.duration
            || 0;

        const isMultiDay = checkIsMultiDay(duration);
        const totalDays = isMultiDay ? calculateDaysNeeded(duration) : 1;

        return {
            duration,
            isMultiDay,
            totalDays
        };
    }, [job]);

    // Get scheduled dates for calendar highlighting
    const scheduledDates = useMemo(() => {
        return getScheduledDates(allJobs);
    }, [allJobs]);

    // Get disabled days based on working hours
    const disabledDays = useMemo(() => {
        const workingHours = schedulingPreferences?.workingHours;
        if (!workingHours) return [0]; // Default: Sunday off

        const dayMap = {
            sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
            thursday: 4, friday: 5, saturday: 6
        };

        const disabled = [];
        Object.entries(workingHours).forEach(([day, config]) => {
            if (!config?.enabled && dayMap[day] !== undefined) {
                disabled.push(dayMap[day]);
            }
        });

        return disabled.length > 0 ? disabled : [0]; // Default: Sunday off
    }, [schedulingPreferences]);

    // Compute busy time ranges per date for graying out conflicting time options
    const getBusyTimesForDate = useCallback((dateStr) => {
        if (!dateStr || !allJobs?.length) return [];
        const targetDate = new Date(dateStr);
        return allJobs
            .filter(job => {
                const jobDateRaw = job.scheduledTime || job.scheduledDate;
                if (!jobDateRaw) return false;
                const jobDate = new Date(jobDateRaw.toDate ? jobDateRaw.toDate() : jobDateRaw);
                return jobDate.getDate() === targetDate.getDate() &&
                    jobDate.getMonth() === targetDate.getMonth() &&
                    jobDate.getFullYear() === targetDate.getFullYear();
            })
            .map(job => {
                const jobStart = new Date((job.scheduledTime || job.scheduledDate).toDate
                    ? (job.scheduledTime || job.scheduledDate).toDate()
                    : (job.scheduledTime || job.scheduledDate));
                const durationMin = job.estimatedDuration || job.duration || 60;
                return {
                    startHour: jobStart.getHours(),
                    startMin: jobStart.getMinutes(),
                    endHour: Math.floor((jobStart.getHours() * 60 + jobStart.getMinutes() + durationMin) / 60),
                    endMin: (jobStart.getMinutes() + durationMin) % 60
                };
            });
    }, [allJobs]);

    // Get time options with busy slots marked as disabled
    const getTimeOptionsForSlot = useCallback((slotDate) => {
        const busyTimes = getBusyTimesForDate(slotDate);
        if (busyTimes.length === 0) return TIME_OPTIONS;
        return TIME_OPTIONS.map(option => {
            const [h, m] = option.value.split(':').map(Number);
            const isBusy = busyTimes.some(busy =>
                (h > busy.startHour || (h === busy.startHour && m >= busy.startMin)) &&
                (h < busy.endHour || (h === busy.endHour && m < busy.endMin))
            );
            return isBusy ? { ...option, disabled: true, disabledReason: 'Busy' } : option;
        });
    }, [getBusyTimesForDate]);

    // DEBUG LOG (Fix 5c)
    useEffect(() => {
        console.log('[OfferTimeSlotsModal] Preferences:', schedulingPreferences);
        if (schedulingPreferences?.workingHours) {
            console.log('[OfferTimeSlotsModal] Working Hours:', schedulingPreferences.workingHours);
        }
    }, [schedulingPreferences]);

    // CONFLICT CHECK EFFECT (Fix 5b)
    useEffect(() => {
        const conflicts = {};
        slots.forEach(slot => {
            if (slot.date && slot.startTime) {
                const conflict = checkResourceConflicts(slot, allJobs, schedulingPreferences);
                if (conflict) {
                    conflicts[slot.id] = conflict;
                }
            }
        });
        setSlotConflicts(conflicts);
    }, [slots, allJobs, schedulingPreferences]);

    // Add a new slot
    const addSlot = () => {
        if (slots.length >= 5) {
            toast.error('Maximum 5 time slots');
            return;
        }
        setSlots(prev => [...prev, {
            id: `slot_${Date.now()}`,
            date: '',
            startTime: '09:00',
            endTime: '12:00',
            showCalendar: true
        }]);
    };

    // Remove a slot
    const removeSlot = (id) => {
        if (slots.length === 1) {
            // Reset first slot instead of removing
            setSlots([{ id: 'slot_1', date: '', startTime: '09:00', endTime: '12:00', showCalendar: false }]);
            return;
        }
        setSlots(prev => prev.filter(s => s.id !== id));
    };

    // Update a slot
    const updateSlot = (id, field, value) => {
        setSlots(prev => prev.map(s =>
            s.id === id ? { ...s, [field]: value } : s
        ));
    };

    // Toggle calendar for a slot
    const toggleCalendar = (id) => {
        setSlots(prev => prev.map(s =>
            s.id === id ? { ...s, showCalendar: !s.showCalendar } : s
        ));
    };

    // Handle date selection from calendar
    const handleDateSelect = (slotId, date) => {
        const dateStr = date.toISOString().split('T')[0];
        setSlots(prev => prev.map(s =>
            s.id === slotId ? { ...s, date: dateStr, showCalendar: false } : s
        ));
    };

    // Apply preset to a slot
    const applyPreset = (slotId, preset) => {
        setSlots(prev => prev.map(s =>
            s.id === slotId
                ? { ...s, startTime: preset.start, endTime: preset.end }
                : s
        ));
    };

    // Apply AI suggestion
    const applyAISuggestion = (suggestion) => {
        const dateStr = suggestion.date.toISOString().split('T')[0];

        // Check if we already have this slot
        const existingSlot = slots.find(s =>
            s.date === dateStr && s.startTime === suggestion.startTime
        );

        if (existingSlot) {
            toast('This time is already added');
            return;
        }

        // If first slot is empty, update it
        if (slots.length === 1 && !slots[0].date) {
            setSlots([{
                id: 'slot_1',
                date: dateStr,
                startTime: suggestion.startTime,
                endTime: suggestion.endTime,
                showCalendar: false
            }]);
        } else if (slots.length < 5) {
            // Add as new slot
            setSlots(prev => [...prev, {
                id: `slot_${Date.now()}`,
                date: dateStr,
                startTime: suggestion.startTime,
                endTime: suggestion.endTime,
                showCalendar: false
            }]);
        } else {
            toast.error('Maximum 5 slots - remove one first');
        }

        toast.success(`Added ${suggestion.dateFormatted}`);
    };

    // Validate a single slot (used for UI feedback)
    const validateSlot = (slot) => {
        if (!slot.date) return { valid: false, error: 'Select a date' };

        const startDateTime = new Date(`${slot.date}T${slot.startTime}`);
        const endDateTime = new Date(`${slot.date}T${slot.endTime}`);

        // Basic check
        if (endDateTime <= startDateTime) {
            return { valid: false, error: 'End time must be after start' };
        }

        // Check for conflicts with existing scheduled jobs (Original logic preserved)
        if (checkForConflicts) {
            const conflicts = checkForConflicts(
                startDateTime.toISOString(),
                endDateTime.toISOString(),
                allJobs,
                schedulingPreferences
            );

            if (conflicts && conflicts.length > 0) {
                return {
                    valid: false,
                    error: `Conflicts with: ${conflicts.map(c => c.message).join(', ')}`,
                    conflicts
                };
            }
        }

        return { valid: true };
    };

    // Validate all slots before submit
    const validateAllSlots = () => {
        const filledSlots = slots.filter(s => s.date);
        if (filledSlots.length === 0) {
            toast.error('Please select at least one date');
            return false;
        }

        for (const slot of filledSlots) {
            const validation = validateSlot(slot);
            if (!validation.valid && validation.error !== 'Select a date') {
                toast.error(`Slot on ${slot.date}: ${validation.error}`);
                return false;
            }
        }

        return true;
    };

    // Submit slots
    // Submit slots
    const handleSubmit = async () => {
        if (!validateAllSlots()) return;

        setIsSubmitting(true);
        try {
            const filledSlots = slots.filter(s => s.date);

            // ========================================
            // FIX: Format slots correctly for SlotPicker
            // ========================================
            // SlotPicker expects: { id, start, end, status }
            // Where start/end are ISO datetime strings
            const formattedSlots = filledSlots.map((slot, index) => {
                // Combine date + time into full ISO datetime strings
                const startDateTime = new Date(`${slot.date}T${slot.startTime}:00`);
                const endDateTime = new Date(`${slot.date}T${slot.endTime}:00`);

                return {
                    id: slot.id || `slot_${Date.now()}_${index}`,  // Unique ID for tracking
                    start: startDateTime.toISOString(),            // Full ISO string
                    end: endDateTime.toISOString(),                // Full ISO string
                    status: 'offered'
                };
            });

            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);

            // ========================================
            // FIX: Write to scheduling.offeredSlots (where readers look)
            // Include multi-day information for homeowner
            // ========================================
            await updateDoc(jobRef, {
                // Write to the NESTED path that SlotPicker reads from
                'scheduling.offeredSlots': formattedSlots,
                'scheduling.offeredMessage': message || null,
                'scheduling.offeredAt': serverTimestamp(),

                // CRITICAL: Include multi-day information for homeowner
                'scheduling.estimatedDuration': multiDayInfo.duration,
                'scheduling.isMultiDay': multiDayInfo.isMultiDay,
                'scheduling.totalDays': multiDayInfo.totalDays,

                // Also keep top-level for backwards compatibility
                offeredTimeSlots: formattedSlots,
                estimatedDuration: multiDayInfo.duration,

                // Update status
                status: 'slots_offered',
                contractorMessage: message || null,
                slotsOfferedAt: serverTimestamp(),
                lastActivity: serverTimestamp()
            });

            // Log activity for audit trail
            logTimeSlotsOffered(job.id, filledSlots.length, schedulingPreferences?.companyName || 'Contractor')
                .catch(err => console.warn('[OfferTimeSlotsModal] Activity log failed:', err));

            // ========================================
            // Send email notification to customer (non-blocking)
            // ========================================
            const customerEmail = job.customer?.email || job.customerEmail;
            if (customerEmail) {
                fetch('/api/send-slots-offered', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerEmail,
                        customerName: job.customer?.name || job.customerName || null,
                        contractorName: job.contractorName || schedulingPreferences?.companyName || 'Your contractor',
                        contractorPhone: job.contractorPhone || schedulingPreferences?.phone || null,
                        jobTitle: job.title || job.description || 'Service Request',
                        jobId: job.id,
                        slots: formattedSlots,
                        message: message || null
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        console.log('[OfferTimeSlotsModal] Email notification sent:', data.id);
                    } else {
                        console.warn('[OfferTimeSlotsModal] Email send warning:', data.error);
                    }
                })
                .catch(err => {
                    // Non-blocking - log but don't fail the main operation
                    console.warn('[OfferTimeSlotsModal] Email notification failed:', err.message);
                });
            } else {
                console.log('[OfferTimeSlotsModal] No customer email - skipping notification');
            }

            // ========================================
            // Create chat channel (non-blocking)
            // ========================================
            if (job.createdBy && job.contractorId) {
                createJobChatChannel(
                    job.createdBy,
                    job.contractorId,
                    job.contractorName || schedulingPreferences?.companyName || 'Contractor',
                    job.customer?.name || job.customerName || 'Customer',
                    job.id,
                    job.title || job.serviceType || 'Service Request'
                ).then(result => {
                    if (result.created) {
                        console.log('[OfferTimeSlotsModal] Chat channel created:', result.channelId);
                    } else {
                        console.log('[OfferTimeSlotsModal] Chat channel already exists:', result.channelId);
                    }
                }).catch(err => {
                    console.warn('[OfferTimeSlotsModal] Chat channel creation failed:', err.message);
                });
            }

            toast.success(`Sent ${filledSlots.length} time option${filledSlots.length !== 1 ? 's' : ''} to customer`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error offering time slots:', error);
            toast.error('Failed to send time slots');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancel job handler
    const handleCancelJob = async () => {
        if (isCancelling) return;
        setIsCancelling(true);

        try {
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
            await updateDoc(jobRef, {
                status: 'cancelled',
                cancellation: {
                    cancelledAt: serverTimestamp(),
                    cancelledBy: 'contractor',
                    reason: 'Cancelled by contractor'
                },
                scheduledTime: null,
                scheduledDate: null,
                scheduledEndTime: null,
                multiDaySchedule: null,
                'scheduling.offeredSlots': null,
                lastActivity: serverTimestamp()
            });

            // Update the source quote status if this job came from a quote
            if (job.sourceQuoteId && job.contractorId) {
                markQuoteJobCancelled(job.contractorId, job.sourceQuoteId, 'contractor')
                    .catch(err => console.warn('Failed to update quote status:', err));
            }

            // Log activity for audit trail
            logStatusChange(job.id, job.status, 'cancelled', 'contractor')
                .catch(err => console.warn('[OfferTimeSlotsModal] Activity log failed:', err));

            toast.success('Job cancelled');
            setShowCancelConfirm(false);
            onClose();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error cancelling job:', error);
            toast.error('Failed to cancel job');
        } finally {
            setIsCancelling(false);
        }
    };

    const filledSlotsCount = slots.filter(s => s.date).length;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <Calendar className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Offer Time Slots</h3>
                            <p className="text-xs text-slate-500">Send availability to customer</p>
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
                        <h4 className="font-bold text-slate-800 mb-1">
                            {job?.title || job?.serviceType || 'Service Request'}
                        </h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                            {job?.customer?.name && (
                                <span className="flex items-center gap-1">
                                    <User size={12} />
                                    {job.customer.name}
                                </span>
                            )}
                            {(job?.customer?.address || job?.serviceAddress) && (
                                <span className="flex items-center gap-1">
                                    <MapPin size={12} />
                                    {(job.customer?.address || job.serviceAddress)?.split(',')[0]}
                                </span>
                            )}
                            {job?.estimatedDuration && (
                                <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    ~{formatMinutesToHuman(job.estimatedDuration)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Multi-Day Job Banner */}
                    {multiDayInfo.isMultiDay && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <div className="bg-indigo-500 p-2 rounded-lg shrink-0">
                                    <CalendarDays size={18} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-indigo-900 text-sm">
                                        This is a {multiDayInfo.totalDays}-Day Job
                                    </h4>
                                    <p className="text-xs text-indigo-700 mt-1">
                                        {multiDayInfo.totalDays} work days (~{Math.round(multiDayInfo.duration / 60)} hours total)
                                    </p>
                                    <p className="text-xs text-indigo-600 mt-2">
                                        Suggestions show potential <strong>start dates</strong>. The customer will be informed
                                        they need to be available for {multiDayInfo.totalDays} consecutive days.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Customer Preferences (if any) */}
                    {customerPrefs && (
                        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex items-start gap-2">
                                <User size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium text-amber-800 mb-1">Customer Preferences:</p>
                                    {customerPrefs.timePreference && (
                                        <p className="text-amber-700">Time: {customerPrefs.timePreference}</p>
                                    )}
                                    {customerPrefs.dayPreference && (
                                        <p className="text-amber-700">Days: {customerPrefs.dayPreference}</p>
                                    )}
                                    {customerPrefs.specificDates && (
                                        <p className="text-amber-700">Dates: {customerPrefs.specificDates}</p>
                                    )}
                                    {customerPrefs.additionalNotes && (
                                        <p className="text-amber-600 mt-1 italic">"{customerPrefs.additionalNotes}"</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI Prerequisite Check */}
                    <AIPrerequisiteCheck preferences={schedulingPreferences} allJobs={allJobs} />

                    {/* AI Suggestions Section */}
                    <div className="mb-5">
                        <button
                            onClick={() => setShowAISuggestions(!showAISuggestions)}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl hover:from-violet-100 hover:to-purple-100 transition-colors"
                            type="button"
                        >
                            <div className="flex items-center gap-2">
                                <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-1.5 rounded-lg">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <span className="font-bold text-violet-800">AI Suggestions</span>
                            </div>
                            {showAISuggestions ? (
                                <ChevronUp size={18} className="text-violet-600" />
                            ) : (
                                <ChevronDown size={18} className="text-violet-600" />
                            )}
                        </button>

                        {showAISuggestions && (
                            <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                                <AISuggestionPanel
                                    job={job}
                                    allJobs={allJobs}
                                    preferences={schedulingPreferences}
                                    customerPreferences={customerPrefs}
                                    onSelectSuggestion={applyAISuggestion}
                                    selectedSlots={slots.filter(s => s.date)}
                                    compact={true}
                                    onNavigate={onNavigate}
                                />
                            </div>
                        )}
                    </div>

                    {/* Selected Slots Section */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-500 uppercase">
                                Selected Times ({filledSlotsCount}/5)
                            </p>
                            <button
                                onClick={() => setShowManualEntry(!showManualEntry)}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                type="button"
                            >
                                <Plus size={14} />
                                Add manually
                            </button>
                        </div>

                        {/* Display selected slots */}
                        {filledSlotsCount > 0 && (
                            <div className="space-y-2 mb-3">
                                {slots.filter(s => s.date).map((slot) => {
                                    const date = new Date(slot.date + 'T00:00:00');
                                    const dateLabel = date.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    });
                                    const startLabel = TIME_OPTIONS.find(t => t.value === slot.startTime)?.label || slot.startTime;
                                    const endLabel = TIME_OPTIONS.find(t => t.value === slot.endTime)?.label || slot.endTime;

                                    // Validation Check
                                    const validation = validateSlot(slot);

                                    return (
                                        <div key={slot.id}>
                                            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle size={14} className="text-emerald-600" />
                                                        <span className="font-medium text-slate-800">{dateLabel}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 ml-6">
                                                        {startLabel} - {endLabel}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeSlot(slot.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    type="button"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Show resource conflict warning - made more prominent */}
                                            {slotConflicts[slot.id] && (
                                                <div className={`mt-2 p-3 rounded-xl text-sm flex items-start gap-2 animate-pulse ${slotConflicts[slot.id].canProceed
                                                        ? 'bg-amber-100 text-amber-800 border-2 border-amber-300 shadow-sm'
                                                        : 'bg-red-100 text-red-800 border-2 border-red-300 shadow-sm'
                                                    }`}>
                                                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="font-bold">{slotConflicts[slot.id].canProceed ? 'Warning' : 'Conflict'}</p>
                                                        <p className="text-xs mt-0.5 opacity-90">{slotConflicts[slot.id].message}</p>
                                                        {slotConflicts[slot.id].canProceed && (
                                                            <p className="text-xs mt-1 opacity-75">You can still proceed, but consider another time.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {filledSlotsCount === 0 && !showManualEntry && (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <Calendar size={24} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-sm text-slate-500">No times selected</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Click an AI suggestion or add manually
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Manual Entry Section with Calendar */}
                    {showManualEntry && (
                        <div className="mb-5 p-4 bg-slate-50 rounded-xl">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Add Time Slot</p>

                            <div className="space-y-4">
                                {slots.map((slot, idx) => (
                                    <div
                                        key={slot.id}
                                        className="bg-white border border-slate-200 rounded-xl p-4"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500">
                                                    Option {idx + 1}
                                                </span>
                                                {/* Validation Indicator */}
                                                {slot.date && (
                                                    <CheckCircle size={12} className="text-emerald-500" />
                                                )}
                                            </div>
                                            {slots.length > 1 && (
                                                <button
                                                    onClick={() => removeSlot(slot.id)}
                                                    className="p-1 text-slate-400 hover:text-red-500"
                                                    type="button"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Date Selection */}
                                        <div className="mb-3">
                                            {!slot.date ? (
                                                <button
                                                    onClick={() => toggleCalendar(slot.id)}
                                                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                                                    type="button"
                                                >
                                                    <Calendar size={16} />
                                                    Click to select date...
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => toggleCalendar(slot.id)}
                                                    className="w-full py-2 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium flex items-center justify-between"
                                                    type="button"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <Calendar size={14} />
                                                        {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                    <span className="text-xs text-emerald-500">Change</span>
                                                </button>
                                            )}

                                            {/* Calendar Picker */}
                                            {slot.showCalendar && (
                                                <div className="mt-2">
                                                    <CalendarPicker
                                                        selectedDate={slot.date}
                                                        onSelectDate={(date) => handleDateSelect(slot.id, date)}
                                                        disabledDays={disabledDays}
                                                        highlightedDates={scheduledDates}
                                                        compact={true}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Time Selection - only show if date selected */}
                                        {slot.date && (
                                            <>
                                                {/* Time presets */}
                                                <div className="flex gap-2 mb-3">
                                                    {TIME_PRESETS.map(preset => {
                                                        const Icon = preset.icon;
                                                        const isActive = slot.startTime === preset.start && slot.endTime === preset.end;
                                                        return (
                                                            <button
                                                                key={preset.id}
                                                                onClick={() => applyPreset(slot.id, preset)}
                                                                type="button"
                                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${isActive
                                                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                <Icon size={14} />
                                                                {preset.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Custom time range */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-medium text-slate-500 mb-1">From</label>
                                                        <Select
                                                            value={slot.startTime}
                                                            onChange={(val) => updateSlot(slot.id, 'startTime', val)}
                                                            options={getTimeOptionsForSlot(slot.date)}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-medium text-slate-500 mb-1">To</label>
                                                        <Select
                                                            value={slot.endTime}
                                                            onChange={(val) => updateSlot(slot.id, 'endTime', val)}
                                                            options={getTimeOptionsForSlot(slot.date)}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Add Another Button */}
                                {slots.length < 5 && slots.some(s => s.date) && (
                                    <button
                                        onClick={addSlot}
                                        type="button"
                                        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} />
                                        Add Another Time Option
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Optional Message */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Message <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g., Let me know which time works best!"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                            rows={2}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0">
                    <div className="flex gap-3 mb-3">
                        <button
                            onClick={onClose}
                            type="button"
                            className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || filledSlotsCount === 0}
                            type="button"
                            className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Sending...
                                </>
                            ) : filledSlotsCount === 0 ? (
                                <>
                                    <Calendar size={16} />
                                    Select Time Slots
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Send {filledSlotsCount} Option{filledSlotsCount !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                    {/* Cancel Job Button */}
                    <button
                        onClick={() => setShowCancelConfirm(true)}
                        type="button"
                        className="w-full py-2.5 text-red-600 font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} />
                        Cancel This Job
                    </button>
                </div>
            </div>

            {/* Cancel Job Confirmation Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancelConfirm(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <Trash2 className="text-red-600" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Cancel Job?</h3>
                                <p className="text-sm text-slate-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 mb-4">
                            <p className="font-medium text-slate-800">{job?.title || job?.serviceType || 'This job'}</p>
                            <p className="text-sm text-slate-500">{job?.customer?.name || job?.customerName || 'Customer'}</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100"
                            >
                                Keep Job
                            </button>
                            <button
                                onClick={handleCancelJob}
                                disabled={isCancelling}
                                className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isCancelling ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                        Cancelling...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={18} />
                                        Cancel Job
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfferTimeSlotsModal;
