// src/features/contractor-pro/components/DragDropCalendar.jsx
// ============================================
// DRAG & DROP CALENDAR
// ============================================
// Visual calendar where contractors can drag unscheduled jobs onto time slots
// UPDATED: Displays pending/offered slots

import React, { useState, useMemo, useCallback } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar, Clock, MapPin,
    User, GripVertical, Check, X, AlertCircle, Sparkles,
    Navigation, Users as UsersIcon, Globe, RotateCcw
} from 'lucide-react';
import { isRecurringJob } from '../../recurring';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';
import { getTimezoneAbbreviation, isSameDayInTimezone, createDateInTimezone } from '../lib/timezoneUtils';

// ============================================
// HELPERS
// ============================================

const getWeekDates = (date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
    }
    return dates;
};



const formatTime = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h} ${ampm}`;
};

const getJobsForDate = (jobs, date, timezone) => {
    return jobs.filter(job => {
        // Check regular scheduled date
        const jobDate = job.scheduledTime || job.scheduledDate;
        if (jobDate && isSameDayInTimezone(jobDate, date, timezone)) {
            return true;
        }

        // Check multi-day job segments
        if (jobIsMultiDay(job)) {
            const { isInSchedule } = getSegmentForDate(date, job.multiDaySchedule);
            return isInSchedule;
        }

        return false;
    }).map(job => {
        // Add multi-day context if applicable
        if (jobIsMultiDay(job)) {
            const { segment, dayNumber } = getSegmentForDate(date, job.multiDaySchedule);
            return {
                ...job,
                _multiDayInfo: {
                    dayNumber,
                    totalDays: job.multiDaySchedule.totalDays,
                    segment,
                    label: `Day ${dayNumber}/${job.multiDaySchedule.totalDays}`
                }
            };
        }
        return job;
    });
};

// ============================================
// DRAGGABLE JOB CARD (Sidebar)
// ============================================

const DraggableJobCard = ({ job, onDragStart, onDragEnd }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = (e) => {
        setIsDragging(true);
        e.dataTransfer.setData('jobId', job.id);
        e.dataTransfer.setData('jobData', JSON.stringify(job));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(job);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        onDragEnd?.();
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`p-3 bg-white rounded-xl border border-slate-200 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-50 scale-95 shadow-lg' : 'hover:shadow-md hover:border-emerald-300'
                }`}
        >
            <div className="flex items-start gap-2">
                <GripVertical size={16} className="text-slate-300 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-slate-800 text-sm truncate">
                            {job.title || job.description || 'Service'}
                        </h4>
                        {isRecurringJob(job) && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded shrink-0">
                                <RotateCcw size={8} />
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                        {job.customer?.name || 'Customer'}
                    </p>
                    {job.customer?.address && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-1">
                            <MapPin size={10} />
                            {job.customer.address.split(',')[0]}
                        </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                            ~{job.estimatedDuration || 120} min
                        </span>
                        {job.total > 0 && (
                            <span className="text-xs font-bold text-emerald-600">
                                ${job.total.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// TIME SLOT (Drop Zone)
// ============================================

const TimeSlot = ({
    date,
    hour,
    jobs,
    pendingSlots, // NEW: Receive pending slots
    evaluations = [],  // NEW: Scheduled evaluations
    isDropTarget,
    onDrop,
    onDragOver,
    onDragLeave,
    onJobClick,
    onEvaluationClick,  // NEW: Handler for evaluation clicks
    preferences
}) => {
    // Filter jobs for this hour
    const slotJobs = jobs.filter(job => {
        const jobDate = new Date(job.scheduledTime || job.scheduledDate);
        return jobDate.getHours() === hour;
    });

    // NEW: Filter pending slots for this hour
    const slotPending = pendingSlots.filter(slot => {
        const slotDate = new Date(slot.slotStart);
        // Use timezone aware check if timezone is provided
        // Note: slotDate is typically ISO UTC, date is current view date (local). 
        // We rely on getHourFromDate logic usually, but here we just check day/hour match
        // For robustness, we should use isSameDayInTimezone if timezone is available
        const isSameDay = preferences?.businessTimezone
            ? isSameDayInTimezone(slotDate, date, preferences.businessTimezone)
            : isSameDayInTimezone(slotDate, date, 'UTC'); // fallback

        return isSameDay && slotDate.getHours() === hour;
    });

    // NEW: Filter evaluations for this hour
    const slotEvaluations = evaluations.filter(evaluation => {
        const evalDate = new Date(evaluation.scheduledTime);
        const isSameDay = preferences?.businessTimezone
            ? isSameDayInTimezone(evalDate, date, preferences.businessTimezone)
            : isSameDayInTimezone(evalDate, date, 'UTC');

        return isSameDay && evalDate.getHours() === hour;
    });

    // Check if this hour is within working hours
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayPrefs = preferences?.workingHours?.[dayName];
    const isWorkingHour = dayPrefs?.enabled !== false;

    let startHour = 8, endHour = 17;
    if (dayPrefs?.start) startHour = parseInt(dayPrefs.start.split(':')[0]);
    if (dayPrefs?.end) endHour = parseInt(dayPrefs.end.split(':')[0]);

    const isWithinWorkingHours = hour >= startHour && hour < endHour && isWorkingHour;

    return (
        <div
            onDrop={(e) => onDrop(e, date, hour)}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`min-h-[60px] border-b border-r border-slate-100 p-1 transition-colors flex flex-col gap-1 ${isDropTarget
                ? 'bg-emerald-100 border-emerald-300'
                : isWithinWorkingHours
                    ? 'bg-white hover:bg-slate-50'
                    : 'bg-slate-50'
                }`}
        >
            {/* Confirmed Jobs */}
            {slotJobs.map(job => (
                <button
                    key={job.id}
                    onClick={() => onJobClick?.(job)}
                    className={`w-full mb-1 p-2 text-white rounded-lg text-xs text-left transition-colors shadow-sm ${job._multiDayInfo ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'
                        }`}
                >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="font-bold truncate flex-1">{job.title || job.description || 'Job'}</p>
                        {isRecurringJob(job) && (
                            <span className="text-[9px] bg-white/30 px-1 py-0.5 rounded font-bold shrink-0 flex items-center gap-0.5">
                                <RotateCcw size={8} />
                            </span>
                        )}
                        {job._multiDayInfo && (
                            <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                                {job._multiDayInfo.label}
                            </span>
                        )}
                    </div>
                    <p className="truncate opacity-80">{job.customer?.name}</p>
                </button>
            ))}

            {/* NEW: Pending/Offered Slots */}
            {slotPending.map((slot, idx) => (
                <div
                    key={`${slot.id}-${slot.slotId}-${idx}`}
                    className="w-full mb-1 p-2 bg-amber-50 border border-amber-300 border-dashed rounded-lg text-xs text-left opacity-90"
                    title="Offered time slot (Pending confirmation)"
                >
                    <div className="flex items-center gap-1 mb-0.5">
                        <Clock size={10} className="text-amber-600" />
                        <span className="font-bold text-amber-700 truncate">{slot.title || 'Pending'}</span>
                    </div>
                    <p className="truncate text-amber-600">{slot.customerName}</p>
                </div>
            ))}

            {/* NEW: Scheduled Evaluations */}
            {slotEvaluations.map(evaluation => (
                <button
                    key={evaluation.id}
                    onClick={() => onEvaluationClick?.(evaluation._original || evaluation)}
                    className="w-full mb-1 p-2 bg-purple-500 text-white rounded-lg text-xs text-left hover:bg-purple-600 transition-colors shadow-sm"
                >
                    <div className="flex items-center gap-1 mb-0.5">
                        {evaluation.evaluationType === 'virtual' ? (
                            <span className="text-[10px] bg-purple-400 px-1 rounded">VIDEO</span>
                        ) : (
                            <span className="text-[10px] bg-purple-400 px-1 rounded">SITE</span>
                        )}
                        <p className="font-bold truncate flex-1">{evaluation.title}</p>
                    </div>
                    <p className="truncate opacity-80">{evaluation.customer?.name}</p>
                    {evaluation.duration && (
                        <p className="text-[10px] opacity-70">{evaluation.duration}min</p>
                    )}
                </button>
            ))}
        </div>
    );
};

// ============================================
// DROP CONFIRMATION MODAL
// ============================================

const DropConfirmModal = ({ job, date, hour, onConfirm, onCancel, teamMembers, timezone }) => {
    const [selectedTime, setSelectedTime] = useState(`${hour.toString().padStart(2, '0')}:00`);
    const [selectedTech, setSelectedTech] = useState('');
    const [duration, setDuration] = useState(job.estimatedDuration || 120);
    const [customerConfirmed, setCustomerConfirmed] = useState(false);

    // Multi-day detection
    const isMultiDay = isMultiDayJob(duration);
    const estimatedDays = Math.ceil(duration / 480);

    const timeOptions = [];
    for (let h = 6; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            timeOptions.push({ value: time, label });
        }
    }

    const handleConfirm = () => {
        const [hours, minutes] = selectedTime.split(':').map(Number);

        let scheduledDateTime;

        if (timezone) {
            // Use timezone utility if timezone is provided
            scheduledDateTime = createDateInTimezone(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                hours,
                minutes,
                timezone
            );
        } else {
            // Fallback to local time (naive)
            scheduledDateTime = new Date(date);
            scheduledDateTime.setHours(hours, minutes, 0, 0);
        }

        // Calculate end time based on duration
        const endDateTime = new Date(scheduledDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + duration);

        onConfirm({
            scheduledTime: scheduledDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            assignedTo: selectedTech || null,
            estimatedDuration: duration,
            isDirectSchedule: customerConfirmed,
            isMultiDay,
            estimatedDays
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Schedule Job</h3>

                {/* Job Info */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-slate-800">
                        {job.title || job.description || 'Service'}
                    </h4>
                    <p className="text-sm text-slate-500">{job.customer?.name}</p>
                    {job.customer?.address && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin size={12} />
                            {job.customer.address}
                        </p>
                    )}
                </div>

                {/* Date Display */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-slate-800 font-medium">
                        {date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </div>
                </div>

                {/* Time Selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                    <select
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                        {timeOptions.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Duration */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                    <select
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                        <option value={180}>3 hours</option>
                        <option value={240}>4 hours</option>
                        <option value={480}>Full day (8 hours)</option>
                        <option value={960}>2 days</option>
                        <option value={1440}>3 days</option>
                        <option value={1920}>4 days</option>
                        <option value={2400}>5 days</option>
                    </select>
                </div>

                {/* Multi-day info */}
                {isMultiDay && (
                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <Calendar size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-indigo-800">Multi-Day Job</p>
                                <p className="text-xs text-indigo-600">
                                    This job spans ~{estimatedDays} work days starting from{' '}
                                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.
                                    It will automatically be blocked on your calendar across all days.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tech Assignment (if team) */}
                {teamMembers && teamMembers.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Assign To
                        </label>
                        <select
                            value={selectedTech}
                            onChange={(e) => setSelectedTech(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">Unassigned</option>
                            {teamMembers.map(member => (
                                <option key={member.id} value={member.id}>
                                    {member.name} ({member.role})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Actions */}
                {/* Customer Confirmed Checkbox */}
                <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={customerConfirmed}
                            onChange={(e) => setCustomerConfirmed(e.target.checked)}
                            className="mt-1 h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                        />
                        <div>
                            <p className="font-medium text-slate-700">Customer already confirmed</p>
                            <p className="text-xs text-slate-500">Check this if you've already spoken with the customer and they agreed to this time</p>
                        </div>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`flex-1 px-4 py-3 font-bold rounded-xl flex items-center justify-center gap-2 ${customerConfirmed
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                    >
                        <Check size={18} />
                        {customerConfirmed ? 'Schedule' : 'Propose Time'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN DRAG & DROP CALENDAR
// ============================================

export const DragDropCalendar = ({
    jobs = [],
    evaluations = [],  // Scheduled evaluations to display
    preferences = {},
    timezone,  // IANA timezone identifier
    onJobUpdate,
    onJobClick,
    onEvaluationClick  // Handler for evaluation clicks
}) => {
    // Get timezone abbreviation for display
    const timezoneAbbr = timezone ? getTimezoneAbbreviation(timezone) : null;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [draggedJob, setDraggedJob] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [confirmDrop, setConfirmDrop] = useState(null);

    const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // NEW: Separate scheduled, unscheduled, and pending (offered) slots
    const { scheduledJobs, unscheduledJobs, pendingSlots } = useMemo(() => {
        const scheduled = [];
        const unscheduled = [];
        const pending = [];

        jobs.forEach(job => {
            if (['completed', 'cancelled'].includes(job.status)) return;

            if (job.scheduledTime || job.scheduledDate) {
                scheduled.push(job);
            } else if (job.scheduling?.offeredSlots?.length > 0) {
                // Extract offered slots as "pending" calendar items (Item #12)
                job.scheduling.offeredSlots
                    .filter(slot => slot.status === 'offered')
                    .forEach(slot => {
                        pending.push({
                            ...job,
                            id: job.id,
                            isPendingSlot: true,
                            slotStart: slot.start, // ISO string
                            slotEnd: slot.end,
                            slotId: slot.id,
                            customerName: job.customer?.name || 'Customer'
                        });
                    });
                unscheduled.push(job); // Still technically unscheduled until confirmed
            } else {
                unscheduled.push(job);
            }
        });

        return { scheduledJobs: scheduled, unscheduledJobs: unscheduled, pendingSlots: pending };
    }, [jobs]);

    // NEW: Transform evaluations into calendar-displayable format
    const scheduledEvaluations = useMemo(() => {
        return evaluations
            .filter(evaluation =>
                evaluation.scheduling?.scheduledFor &&
                evaluation.status !== 'cancelled' &&
                evaluation.status !== 'expired'
            )
            .map(evaluation => ({
                id: evaluation.id,
                type: 'evaluation',
                title: `Eval: ${evaluation.jobDescription || evaluation.jobCategory || 'Site Visit'}`,
                scheduledTime: evaluation.scheduling.scheduledFor,
                duration: evaluation.scheduling?.duration || 30,
                evaluationType: evaluation.type, // 'virtual' or 'site_visit'
                customer: {
                    name: evaluation.customerName,
                    address: evaluation.propertyAddress,
                    phone: evaluation.customerPhone
                },
                videoCallLink: evaluation.scheduling?.videoCallLink,
                _original: evaluation
            }));
    }, [evaluations]);

    // Working hours range
    const workingHours = useMemo(() => {
        let minHour = 8, maxHour = 18;

        if (preferences?.workingHours) {
            Object.values(preferences.workingHours).forEach(day => {
                if (day?.enabled && day?.start) {
                    const start = parseInt(day.start.split(':')[0]);
                    const end = parseInt(day.end.split(':')[0]);
                    if (start < minHour) minHour = start;
                    if (end > maxHour) maxHour = end;
                }
            });
        }

        const hours = [];
        for (let h = minHour; h <= maxHour; h++) {
            hours.push(h);
        }
        return hours;
    }, [preferences]);

    // Navigation
    const navigatePrev = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const navigateNext = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Drag handlers
    const handleDragStart = useCallback((job) => {
        setDraggedJob(job);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggedJob(null);
        setDropTarget(null);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDragEnter = useCallback((date, hour) => {
        setDropTarget({ date, hour });
    }, []);

    const handleDragLeave = useCallback(() => {
        // Small delay to prevent flicker
        setTimeout(() => setDropTarget(null), 50);
    }, []);

    const handleDrop = useCallback((e, date, hour) => {
        e.preventDefault();

        const jobId = e.dataTransfer.getData('jobId');
        const jobData = JSON.parse(e.dataTransfer.getData('jobData') || '{}');

        if (jobId && jobData) {
            setConfirmDrop({ job: jobData, date, hour });
        }

        setDropTarget(null);
        setDraggedJob(null);
    }, []);

    // Confirm scheduling
    // Confirm scheduling (propose or direct)
    const handleConfirmSchedule = async (scheduleData) => {
        if (!confirmDrop?.job) return;

        try {
            if (scheduleData.isDirectSchedule) {
                // Build update data
                const updateData = {
                    scheduledTime: scheduleData.scheduledTime,
                    scheduledDate: scheduleData.scheduledTime,
                    scheduledEndTime: scheduleData.endTime,
                    estimatedDuration: scheduleData.estimatedDuration,
                    assignedTo: scheduleData.assignedTo,
                    status: 'scheduled',
                    lastActivity: serverTimestamp()
                };

                // Handle multi-day jobs
                if (scheduleData.isMultiDay) {
                    const { createMultiDaySchedule } = await import('../lib/multiDayUtils');
                    const multiDaySchedule = createMultiDaySchedule(
                        new Date(scheduleData.scheduledTime),
                        scheduleData.estimatedDuration,
                        preferences?.workingHours || {}
                    );
                    updateData.multiDaySchedule = multiDaySchedule;
                }

                // DIRECT SCHEDULE - Customer already confirmed
                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, confirmDrop.job.id), updateData);

                toast.success(scheduleData.isMultiDay
                    ? `Job scheduled for ${scheduleData.estimatedDays} days!`
                    : 'Job scheduled!');

                // Send email notification to customer (non-blocking)
                if (confirmDrop.job.customer?.email) {
                    fetch('/api/send-job-scheduled', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customerEmail: confirmDrop.job.customer.email,
                            customerName: confirmDrop.job.customer.name || 'there',
                            contractorName: confirmDrop.job.contractorName || 'Your contractor',
                            contractorPhone: confirmDrop.job.contractorPhone || null,
                            contractorEmail: confirmDrop.job.contractorEmail || null,
                            jobTitle: confirmDrop.job.title || 'Service',
                            jobNumber: confirmDrop.job.jobNumber || null,
                            scheduledDate: scheduleData.scheduledTime,
                            scheduledTime: new Date(scheduleData.scheduledTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                            estimatedDuration: scheduleData.estimatedDuration || null,
                            serviceAddress: confirmDrop.job.serviceAddress?.formatted || confirmDrop.job.customer?.address || null,
                            notes: null,
                            jobLink: 'https://mykrib.app/app/'
                        })
                    }).then(res => {
                        if (res.ok) console.log('[DragDropCalendar] Schedule email sent');
                    }).catch(err => console.warn('[DragDropCalendar] Email error:', err));
                }
            } else {
                // PROPOSE TIME - Customer needs to confirm
                const slotId = `slot_${Date.now()}`;
                const offeredSlot = {
                    id: slotId,
                    start: scheduleData.scheduledTime,
                    end: scheduleData.endTime,
                    status: 'offered',
                    createdAt: new Date().toISOString()
                };

                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, confirmDrop.job.id), {
                    'scheduling.offeredSlots': [offeredSlot],
                    'scheduling.offeredAt': serverTimestamp(),
                    assignedTo: scheduleData.assignedTo,
                    estimatedDuration: scheduleData.estimatedDuration,
                    status: 'slots_offered',
                    lastActivity: serverTimestamp()
                });
                toast.success('Time proposed! Waiting for customer confirmation.');
            }

            if (onJobUpdate) onJobUpdate();
        } catch (error) {
            console.error('Error scheduling job:', error);
            toast.error('Failed to schedule job');
        }

        setConfirmDrop(null);
    };

    const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className="flex h-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Sidebar - Unscheduled Jobs */}
            <div className="w-72 border-r border-slate-200 flex flex-col bg-slate-50">
                <div className="p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        Unscheduled
                        {unscheduledJobs.length > 0 && (
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {unscheduledJobs.length}
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Drag jobs onto the calendar
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {unscheduledJobs.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <Check size={24} className="mx-auto mb-2" />
                            <p className="text-sm">All jobs scheduled!</p>
                        </div>
                    ) : (
                        unscheduledJobs.map(job => (
                            <DraggableJobCard
                                key={job.id}
                                job={job}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={navigatePrev}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                        >
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <button
                            onClick={navigateNext}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                        >
                            <ChevronRight size={20} className="text-slate-600" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-800 ml-2">{monthLabel}</h2>
                        {timezoneAbbr && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1">
                                <Globe size={12} />
                                {timezoneAbbr}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={goToToday}
                        className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    >
                        Today
                    </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-8 border-b border-slate-200">
                    <div className="w-16 shrink-0 bg-slate-50" /> {/* Time column header */}
                    {weekDates.map((date, idx) => {
                        const isToday = isSameDayInTimezone(date, today, timezone);
                        return (
                            <div
                                key={idx}
                                className={`p-2 text-center border-l border-slate-100 ${isToday ? 'bg-emerald-50' : ''}`}
                            >
                                <p className={`text-xs font-medium ${isToday ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                </p>
                                <p className={`text-lg font-bold ${isToday ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {date.getDate()}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Time Grid */}
                <div className="flex-1 overflow-y-auto">
                    {workingHours.map(hour => (
                        <div key={hour} className="grid grid-cols-8">
                            {/* Time Label */}
                            <div className="w-16 shrink-0 p-2 text-xs text-slate-400 text-right pr-3 bg-slate-50 border-b border-slate-100">
                                {formatTime(hour)}
                            </div>

                            {/* Day Slots */}
                            {weekDates.map((date, idx) => {
                                const isTarget = dropTarget &&
                                    isSameDayInTimezone(dropTarget.date, date, timezone) &&
                                    dropTarget.hour === hour;

                                return (
                                    <TimeSlot
                                        key={idx}
                                        date={date}
                                        hour={hour}
                                        jobs={getJobsForDate(scheduledJobs, date, timezone)}
                                        pendingSlots={pendingSlots}
                                        evaluations={scheduledEvaluations}
                                        isDropTarget={isTarget}
                                        onDrop={handleDrop}
                                        onDragOver={(e) => {
                                            handleDragOver(e);
                                            handleDragEnter(date, hour);
                                        }}
                                        onDragLeave={handleDragLeave}
                                        onJobClick={onJobClick}
                                        onEvaluationClick={onEvaluationClick}
                                        preferences={preferences}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Drop Confirmation Modal */}
            {confirmDrop && (
                <DropConfirmModal
                    job={confirmDrop.job}
                    date={confirmDrop.date}
                    hour={confirmDrop.hour}
                    teamMembers={preferences?.teamMembers}
                    timezone={timezone}
                    onConfirm={handleConfirmSchedule}
                    onCancel={() => setConfirmDrop(null)}
                />
            )}
        </div>
    );
};

export default DragDropCalendar;
