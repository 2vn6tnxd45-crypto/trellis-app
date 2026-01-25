// src/features/contractor-pro/components/DragDropCalendar.jsx
// ============================================
// DRAG & DROP CALENDAR
// ============================================
// Visual calendar where contractors can drag unscheduled jobs onto time slots
// UPDATED: Displays pending/offered slots

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar, Clock, MapPin,
    User, GripVertical, Check, X, AlertCircle, Sparkles,
    Navigation, Users as UsersIcon, Globe, RotateCcw, UserPlus, CheckCircle, AlertTriangle
} from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import { isRecurringJob } from '../../recurring';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';
import { getTimezoneAbbreviation, isSameDayInTimezone, createDateInTimezone } from '../lib/timezoneUtils';
import { isMultiDayJob, jobIsMultiDay, getSegmentForDate } from '../lib/multiDayUtils';
import { validateProposedCrew } from '../lib/crewRequirementsService';

// ============================================
// HELPERS
// ============================================

/**
 * Format duration from minutes into human-readable format
 */
const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return 'TBD';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.ceil(minutes / 480); // 8-hour work days
    return `~${days} days (${hours}h)`;
};

/**
 * Normalize a date value to ensure proper timezone handling
 * Handles date-only strings (YYYY-MM-DD) which JavaScript parses as UTC midnight
 * by treating them as local dates instead
 */
const normalizeDateForTimezone = (dateValue, timezone) => {
    if (!dateValue) return null;

    // If it's already a Date object, return it
    if (dateValue instanceof Date) return dateValue;

    // Handle Firestore Timestamp
    if (dateValue?.toDate) return dateValue.toDate();

    // Handle string dates
    if (typeof dateValue === 'string') {
        // Check if it's a date-only string (YYYY-MM-DD) without time component
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateOnlyRegex.test(dateValue)) {
            // Parse as local date components to avoid UTC midnight issue
            const [year, month, day] = dateValue.split('-').map(Number);
            // Create date at noon in target timezone to ensure correct day
            return createDateInTimezone(year, month - 1, day, 12, 0, timezone || 'UTC');
        }
        // Otherwise it has time info, parse normally
        return new Date(dateValue);
    }

    return null;
};

/**
 * Check if a specific day is a closed business day
 * @param {Date} date - The date to check
 * @param {Object} workingHours - Working hours configuration
 * @returns {boolean} True if the day is closed (business is not operating)
 */
const isDayClosedForBusiness = (date, workingHours) => {
    if (!workingHours) return false; // If no config, assume open (permissive default)

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayConfig = workingHours[dayName];

    // Day is closed if it's explicitly disabled or not configured
    return !dayConfig?.enabled;
};

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

// Extract hour from date in a specific timezone (timezone-aware)
const getHourFromDate = (dateStr, timeZone) => {
    if (!dateStr) return 8;
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (timeZone) {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                hour12: false,
                timeZone
            }).formatToParts(date);
            const hourPart = parts.find(p => p.type === 'hour');
            return parseInt(hourPart.value) % 24;
        } catch (e) {
            console.warn('Failed to get hour in timezone:', e);
        }
    }
    return date.getHours();
};

// Extract minutes from date in a specific timezone
const getMinutesFromDate = (dateStr, timeZone) => {
    if (!dateStr) return 0;
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (timeZone) {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                minute: 'numeric',
                timeZone
            }).formatToParts(date);
            const minutePart = parts.find(p => p.type === 'minute');
            return parseInt(minutePart.value);
        } catch (e) {
            console.warn('Failed to get minutes in timezone:', e);
        }
    }
    return date.getMinutes();
};

// Format time from ISO date string to readable format (e.g., "9:00 AM")
const formatTimeFromDate = (dateStr, timeZone) => {
    if (!dateStr) return '';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    try {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timeZone || undefined
        }).format(date);
    } catch (e) {
        return '';
    }
};

// Calculate duration in minutes between start and end times
const getDurationMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return 60;
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.max(30, Math.round((end - start) / (1000 * 60)));
};

// Check for scheduling conflicts with existing jobs
const checkScheduleConflicts = (newStart, newEnd, existingJobs, assignedTechIds, excludeJobId = null) => {
    const newStartTime = new Date(newStart).getTime();
    const newEndTime = new Date(newEnd).getTime();
    const conflicts = [];

    for (const job of existingJobs) {
        // Skip the job being rescheduled
        if (job.id === excludeJobId) continue;

        // Check if this job has overlapping tech assignment
        const jobTechIds = job.crew?.map(c => c.techId) || (job.assignedTo ? [job.assignedTo] : []);
        const hasOverlappingTech = assignedTechIds.some(id => jobTechIds.includes(id));

        if (!hasOverlappingTech) continue;

        // Get job time window
        // FIXED: Also check scheduledStartTime field (BUG-020)
        const jobStart = job.scheduledTime || job.scheduledStartTime || job.scheduledDate;
        const jobEnd = job.scheduledEndTime || (jobStart ? new Date(new Date(jobStart).getTime() + (job.estimatedDuration || 60) * 60000).toISOString() : null);

        if (!jobStart) continue;

        const jobStartTime = new Date(jobStart).getTime();
        const jobEndTime = new Date(jobEnd).getTime();

        // Check for overlap: new job starts before existing ends AND new job ends after existing starts
        if (newStartTime < jobEndTime && newEndTime > jobStartTime) {
            conflicts.push({
                job,
                conflictType: 'time_overlap',
                message: `Conflicts with "${job.title || job.customer?.name || 'Job'}" (${formatTimeFromDate(jobStart)} - ${formatTimeFromDate(jobEnd)})`
            });
        }
    }

    return conflicts;
};

const getJobsForDate = (jobs, date, timezone) => {
    // Helper: get date string in business timezone for comparison
    const getDateStr = (d) => {
        if (timezone) {
            const parts = new Intl.DateTimeFormat('en-CA', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                timeZone: timezone
            }).format(d);
            return parts; // Returns YYYY-MM-DD format
        }
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper: find segment for a date with timezone awareness
    const findSegmentForDate = (targetDate, multiDaySchedule) => {
        if (!multiDaySchedule?.segments?.length) {
            return { isInSchedule: false, segment: null, dayNumber: null };
        }
        const targetStr = getDateStr(targetDate);
        const segments = multiDaySchedule.segments;
        const idx = segments.findIndex(s => s.date === targetStr);
        if (idx === -1) {
            return { isInSchedule: false, segment: null, dayNumber: null };
        }
        const segment = segments[idx];
        // Derive dayNumber from index if not present on segment
        const dayNumber = segment.dayNumber || (idx + 1);
        // Derive startHour from startTime if not present
        const startHour = typeof segment.startHour === 'number'
            ? segment.startHour
            : (segment.startTime ? parseInt(segment.startTime.split(':')[0]) : null);
        return {
            isInSchedule: true,
            segment: { ...segment, dayNumber, startHour },
            dayNumber
        };
    };

    return jobs.filter(job => {
        // For multi-day jobs, ONLY use segment dates to avoid duplicates
        if (jobIsMultiDay(job)) {
            const { isInSchedule } = findSegmentForDate(date, job.multiDaySchedule);
            return isInSchedule;
        }

        // For regular single-day jobs, check scheduled date
        // FIXED: Also check scheduledStartTime field (BUG-020)
        const rawJobDate = job.scheduledTime || job.scheduledStartTime || job.scheduledDate;
        if (rawJobDate) {
            const normalizedJobDate = normalizeDateForTimezone(rawJobDate, timezone);
            if (normalizedJobDate && isSameDayInTimezone(normalizedJobDate, date, timezone)) {
                return true;
            }
        }

        return false;
    }).map(job => {
        // Add multi-day context if applicable
        if (jobIsMultiDay(job)) {
            const { segment, dayNumber } = findSegmentForDate(date, job.multiDaySchedule);
            const totalDays = job.multiDaySchedule.totalDays || job.multiDaySchedule.segments?.length || 1;
            const displayDayNumber = dayNumber || 1;
            return {
                ...job,
                _multiDayInfo: {
                    dayNumber: displayDayNumber,
                    totalDays,
                    segment: segment || null,
                    label: `Day ${displayDayNumber}/${totalDays}`
                }
            };
        }
        return job;
    });
};

// ============================================
// DRAGGABLE JOB CARD (Sidebar)
// ============================================

const DraggableJobCard = React.memo(({ job, onDragStart, onDragEnd, onAcceptProposal, onDeclineProposal }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);

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

    const hasProposal = job.hasHomeownerProposal || job.proposedTimes?.some(p => p.proposedBy === 'homeowner');

    // Get the latest homeowner proposal for display
    const latestHomeownerProposal = job.proposedTimes?.filter(p => p.proposedBy === 'homeowner').slice(-1)[0];
    const proposedDate = latestHomeownerProposal?.date ? new Date(latestHomeownerProposal.date) : null;
    const proposedDateStr = proposedDate ? proposedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }) : null;
    const proposedTimeStr = proposedDate ? proposedDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    }) : null;

    const handleAccept = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!latestHomeownerProposal || isAccepting) return;

        setIsAccepting(true);
        try {
            await onAcceptProposal?.(job, latestHomeownerProposal);
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDecline = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!latestHomeownerProposal || isDeclining) return;

        setIsDeclining(true);
        try {
            await onDeclineProposal?.(job, latestHomeownerProposal);
        } finally {
            setIsDeclining(false);
        }
    };

    return (
        <div
            draggable // Always allow drag - contractor can also drag to propose a different time
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${hasProposal
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                : 'bg-white border-slate-200'
                } ${isDragging ? 'opacity-50 scale-95 shadow-lg' : 'hover:shadow-md hover:border-emerald-300'}`}
        >
            {hasProposal && (
                <div className="mb-2 px-2 py-1.5 bg-blue-100 rounded-lg text-blue-700">
                    <div className="text-[10px] font-bold flex items-center gap-1">
                        <Clock size={10} />
                        Customer proposed:
                    </div>
                    {proposedDateStr && (
                        <div className="text-xs font-bold mt-0.5">
                            {proposedDateStr} at {proposedTimeStr}
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-start gap-2">
                <GripVertical size={16} className="text-slate-300 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-slate-800 text-sm truncate" title={job.title || job.description || 'Service'}>
                            {job.title || job.description || 'Service'}
                        </h4>
                        {isRecurringJob(job) && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded shrink-0">
                                <RotateCcw size={8} />
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 truncate" title={job.customer?.name || 'Customer'}>
                        {job.customer?.name || 'Customer'}
                    </p>
                    {job.customer?.address && (
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-1" title={job.customer.address}>
                            <MapPin size={10} />
                            {job.customer.address.split(',')[0]}
                        </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                            {formatDuration(job.estimatedDuration || 120)}
                        </span>
                        {job.total > 0 && (
                            <span className="text-xs font-bold text-emerald-600">
                                ${job.total.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {/* Accept/Decline buttons for homeowner proposals */}
            {hasProposal && latestHomeownerProposal && (
                <div className="mt-2 flex gap-2">
                    <button
                        onClick={handleAccept}
                        disabled={isAccepting || isDeclining}
                        className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        {isAccepting ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ...
                            </>
                        ) : (
                            <>
                                <Check size={12} />
                                Accept
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleDecline}
                        disabled={isAccepting || isDeclining}
                        className="flex-1 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        {isDeclining ? (
                            <>
                                <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                                ...
                            </>
                        ) : (
                            <>
                                <X size={12} />
                                Decline
                            </>
                        )}
                    </button>
                </div>
            )}
            {hasProposal && (
                <p className="mt-1.5 text-[10px] text-slate-500 text-center">
                    Or drag to propose a different time
                </p>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for performance
    return prevProps.job.id === nextProps.job.id &&
        prevProps.job.status === nextProps.job.status &&
        prevProps.job.title === nextProps.job.title &&
        prevProps.job.hasHomeownerProposal === nextProps.job.hasHomeownerProposal &&
        prevProps.job.proposedTimes?.length === nextProps.job.proposedTimes?.length;
});

// ============================================
// TIME SLOT (Drop Zone)
// ============================================

const TimeSlot = React.memo(({
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
    onSlotClick,  // NEW: Handler for clicking empty slot
    preferences,
    timezone: timezoneProp  // Explicit timezone prop from parent
}) => {
    const timezone = timezoneProp || preferences?.businessTimezone || preferences?.timezone;

    // Filter jobs that START in this hour (not just any job for the day)
    const slotJobs = jobs.filter(job => {
        // For multi-day jobs, check if this is a segment day and use segment's start hour
        if (job._multiDayInfo?.segment) {
            const segmentStartHour = job._multiDayInfo.segment.startHour;
            // If segment has explicit startHour, use it
            if (typeof segmentStartHour === 'number') {
                return segmentStartHour === hour;
            }
            // Fallback: parse from startTime string
            const startTimeParts = job._multiDayInfo.segment.startTime?.split(':');
            if (startTimeParts) {
                return parseInt(startTimeParts[0]) === hour;
            }
        }
        // For regular jobs, use the scheduled time with timezone awareness
        // FIXED: Also check scheduledStartTime field (BUG-020)
        const jobTime = job.scheduledTime || job.scheduledStartTime || job.scheduledDate;
        const jobHour = getHourFromDate(jobTime, timezone);
        return jobHour === hour;
    }).map(job => {
        // Calculate how many hour slots this job spans
        // Use actual end time if available, otherwise fall back to estimatedDuration
        let durationMinutes = job.estimatedDuration || 60;

        // If we have both scheduledTime and scheduledEndTime, calculate actual duration
        if (job._multiDayInfo?.segment) {
            const seg = job._multiDayInfo.segment;
            if (seg.durationMinutes) {
                durationMinutes = seg.durationMinutes;
            } else if (seg.startTime && seg.endTime) {
                // Compute from segment start/end times
                const [sH, sM] = seg.startTime.split(':').map(Number);
                const [eH, eM] = seg.endTime.split(':').map(Number);
                durationMinutes = (eH * 60 + (eM || 0)) - (sH * 60 + (sM || 0));
            }
        } else if (job.scheduledTime && job.scheduledEndTime) {
            durationMinutes = getDurationMinutes(job.scheduledTime, job.scheduledEndTime);
        }

        const durationHours = Math.max(1, Math.ceil(durationMinutes / 60));
        return { ...job, _durationHours: durationHours, _durationMinutes: durationMinutes };
    });

    // Filter pending slots for this hour (timezone-aware)
    const slotPending = pendingSlots.filter(slot => {
        const isSameDay = timezone
            ? isSameDayInTimezone(slot.slotStart, date, timezone)
            : isSameDayInTimezone(slot.slotStart, date, 'UTC');
        const slotHour = getHourFromDate(slot.slotStart, timezone);
        return isSameDay && slotHour === hour;
    });

    // Filter evaluations for this hour (timezone-aware)
    const slotEvaluations = evaluations.filter(evaluation => {
        const isSameDay = timezone
            ? isSameDayInTimezone(evaluation.scheduledTime, date, timezone)
            : isSameDayInTimezone(evaluation.scheduledTime, date, 'UTC');
        const evalHour = getHourFromDate(evaluation.scheduledTime, timezone);
        return isSameDay && evalHour === hour;
    });

    // Check if this hour is within working hours
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayPrefs = preferences?.workingHours?.[dayName];

    // Day is closed if workingHours is configured AND this day is explicitly disabled
    // If no workingHours config at all, default to open (permissive)
    const isDayClosed = preferences?.workingHours && dayPrefs?.enabled === false;
    const isWorkingDay = !isDayClosed;

    let startHour = 8, endHour = 17;
    if (dayPrefs?.start) startHour = parseInt(dayPrefs.start.split(':')[0]);
    if (dayPrefs?.end) endHour = parseInt(dayPrefs.end.split(':')[0]);

    const isWithinWorkingHours = isWorkingDay && hour >= startHour && hour < endHour;

    // Handle click on empty slot
    const handleSlotClick = (e) => {
        // Only trigger if clicking on the slot background, not a job
        if (e.target === e.currentTarget && onSlotClick && slotJobs.length === 0 && isWithinWorkingHours) {
            onSlotClick(date, hour);
        }
    };

    // Don't allow dropping on closed days
    const handleDrop = isDayClosed ? (e) => { e.preventDefault(); } : (e) => onDrop(e, date, hour);
    const handleDragOver = isDayClosed ? (e) => { e.preventDefault(); } : onDragOver;

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={onDragLeave}
            onClick={handleSlotClick}
            className={`h-[60px] border-b border-r border-slate-100 transition-colors relative ${isDayClosed
                ? 'bg-slate-100/80 cursor-not-allowed'
                : isDropTarget
                    ? 'bg-emerald-100 border-emerald-300'
                    : isWithinWorkingHours
                        ? 'bg-white hover:bg-slate-50 cursor-pointer'
                        : 'bg-slate-50'
                }`}
            title={isDayClosed ? 'Business closed - scheduling not allowed' : undefined}
        >
            {/* Confirmed Jobs - Height scaled by duration, positioned absolutely to overlap cells */}
            {slotJobs.map((job, jobIndex) => {
                // Calculate visual height: each hour = 60px
                const heightPx = Math.max(52, (job._durationHours || 1) * 60 - 4); // -4 for gap
                const showDuration = (job._durationMinutes || 60) >= 30;
                // Offset for multiple jobs starting at same hour
                const horizontalOffset = jobIndex * 12; // Cascade effect
                // Multi-day/full-day jobs get lower z-index so shorter jobs aren't hidden
                const isFullDay = job._multiDayInfo || (job._durationHours || 1) >= 8;
                const zIndex = isFullDay ? 5 + jobIndex : 10 + jobIndex;

                // For multi-day jobs, use segment times instead of job scheduledTime
                let startMinutes, startTimeStr, endTimeStr;
                if (job._multiDayInfo?.segment?.startTime) {
                    const seg = job._multiDayInfo.segment;
                    const [sH, sM] = seg.startTime.split(':').map(Number);
                    startMinutes = sM || 0;
                    const startAmPm = sH >= 12 ? 'PM' : 'AM';
                    const startHr = sH % 12 || 12;
                    startTimeStr = `${startHr}:${(sM || 0).toString().padStart(2, '0')} ${startAmPm}`;
                    if (seg.endTime) {
                        const [eH, eM] = seg.endTime.split(':').map(Number);
                        const endAmPm = eH >= 12 ? 'PM' : 'AM';
                        const endHr = eH % 12 || 12;
                        endTimeStr = `${endHr}:${(eM || 0).toString().padStart(2, '0')} ${endAmPm}`;
                    } else {
                        endTimeStr = null;
                    }
                } else {
                    // Regular job: use scheduledTime with timezone awareness
                    // FIXED: Also check scheduledStartTime field (BUG-020)
                    startMinutes = getMinutesFromDate(job.scheduledTime || job.scheduledStartTime || job.scheduledDate, timezone);
                    startTimeStr = formatTimeFromDate(job.scheduledTime || job.scheduledStartTime || job.scheduledDate, timezone);
                    endTimeStr = job.scheduledEndTime ? formatTimeFromDate(job.scheduledEndTime, timezone) : null;
                }
                // Formula: startMinutes/60 * 100%
                const topPosition = `${(startMinutes / 60) * 100}%`;
                const timeDisplay = endTimeStr ? `${startTimeStr} - ${endTimeStr}` : startTimeStr;

                // Get customer name
                const customerName = job.customer?.name || job.customerName || '';

                // Determine background color based on status/priority
                const isSuggested = job._isSuggested;
                let bgClass = 'bg-emerald-500 hover:bg-emerald-600';
                if (isSuggested) {
                    bgClass = 'bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-400';
                } else if (job._multiDayInfo) {
                    bgClass = 'bg-indigo-500 hover:bg-indigo-600';
                } else if (job.priority === 'urgent' || job.priority === 'high') {
                    bgClass = 'bg-red-500 hover:bg-red-600';
                } else if (job.status === 'in_progress') {
                    bgClass = 'bg-blue-500 hover:bg-blue-600';
                }

                // FIX: Make scheduled jobs draggable for reschedule with duration preservation
                const handleCalendarJobDragStart = (e, dragJob) => {
                    e.dataTransfer.setData('jobId', dragJob.id);
                    // FIX: Include original duration in drag data for preservation
                    // FIXED: Also check scheduledStartTime field (BUG-020)
                    e.dataTransfer.setData('jobData', JSON.stringify({
                        ...dragJob,
                        _originalDuration: dragJob.estimatedDuration || dragJob._durationMinutes || 60,
                        _isReschedule: true, // Flag to indicate this is a reschedule, not new scheduling
                        _originalStart: dragJob.scheduledTime || dragJob.scheduledStartTime || dragJob.scheduledDate,
                        _originalEnd: dragJob.scheduledEndTime
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                };

                return (
                    <div
                        key={job.id}
                        draggable={!isSuggested} // Allow dragging confirmed jobs for reschedule
                        onDragStart={(e) => handleCalendarJobDragStart(e, job)}
                        onClick={() => onJobClick?.(job)}
                        style={{
                            height: `${heightPx}px`,
                            top: topPosition,
                            zIndex
                        }}
                        className={`absolute left-1 right-1 p-2 rounded-lg text-xs text-left transition-colors overflow-hidden cursor-grab active:cursor-grabbing ${isSuggested ? bgClass + ' opacity-75' : bgClass + ' text-white shadow-md'}`}
                    >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={`font-bold truncate flex-1 ${isSuggested ? 'text-slate-700' : ''}`} title={job.title || job.description || 'Job'}>{job.title || job.description || 'Job'}</p>
                            {isSuggested && (
                                <span className="text-[9px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                    Suggested
                                </span>
                            )}
                            {isRecurringJob(job) && (
                                <span className="text-[9px] bg-white/30 px-1 py-0.5 rounded font-bold shrink-0 flex items-center gap-0.5">
                                    <RotateCcw size={8} />
                                </span>
                            )}
                            {job.scheduleHistory?.length > 0 && (
                                <span className="text-[9px] bg-amber-300/50 px-1 py-0.5 rounded font-bold shrink-0" title={`Rescheduled ${job.scheduleHistory.length}x`}>
                                    R
                                </span>
                            )}
                            {job._multiDayInfo && (
                                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                                    {job._multiDayInfo.label}
                                </span>
                            )}
                        </div>
                        {/* Customer name */}
                        {customerName && (
                            <p className={`truncate ${isSuggested ? 'text-slate-600' : 'opacity-90'}`} title={customerName}>{customerName}</p>
                        )}
                        {/* Time and duration info */}
                        <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${isSuggested ? 'text-slate-500' : 'opacity-80'}`}>
                            {startTimeStr && (
                                <span className="flex items-center gap-0.5">
                                    <Clock size={8} />
                                    {timeDisplay}
                                </span>
                            )}
                            {showDuration && !endTimeStr && (
                                <span>
                                    ({job._durationMinutes >= 60
                                        ? `${Math.floor(job._durationMinutes / 60)}h${job._durationMinutes % 60 > 0 ? `${job._durationMinutes % 60}m` : ''}`
                                        : `${job._durationMinutes}m`
                                    })
                                </span>
                            )}
                        </div>
                        {/* Tech assignment if available */}
                        {job.assignedTo && heightPx > 70 && (
                            <p className="text-[9px] opacity-70 mt-0.5 truncate flex items-center gap-0.5">
                                <User size={8} />
                                {job.assignedToName || job.assignedTo}
                            </p>
                        )}
                    </div>
                );
            })}

            {/* NEW: Pending/Offered Slots - positioned after jobs */}
            {slotPending.map((slot, idx) => {
                const topOffset = 4 + (slotJobs.length * 4) + (idx * 4);
                const isHomeownerProposal = slot.isHomeownerProposal;
                return (
                    <button
                        key={`${slot.id}-${slot.slotId || 'proposal'}-${idx}`}
                        onClick={() => onJobClick?.({ ...slot, _isProposal: true })}
                        style={{ top: `${topOffset}px`, zIndex: 5 + idx }}
                        className={`absolute left-1 right-1 h-[52px] p-2 border border-dashed rounded-lg text-xs text-left opacity-90 cursor-pointer hover:opacity-100 transition-opacity ${isHomeownerProposal
                            ? 'bg-blue-50 border-blue-400 hover:bg-blue-100'
                            : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
                            }`}
                        title={isHomeownerProposal ? 'Click to accept or counter-propose' : 'Offered time slot (Pending confirmation)'}
                    >
                        <div className="flex items-center gap-1 mb-0.5">
                            <Clock size={10} className={isHomeownerProposal ? 'text-blue-600' : 'text-amber-600'} />
                            <span className={`font-bold truncate ${isHomeownerProposal ? 'text-blue-700' : 'text-amber-700'}`}>
                                {isHomeownerProposal ? 'Customer Proposed' : (slot.title || 'Pending')}
                            </span>
                        </div>
                        <p className={`truncate ${isHomeownerProposal ? 'text-blue-600' : 'text-amber-600'}`}>
                            {slot.customerName}
                        </p>
                    </button>
                );
            })}

            {/* NEW: Scheduled Evaluations - positioned after jobs and pending */}
            {slotEvaluations.map((evaluation, idx) => {
                const topOffset = 4 + (slotJobs.length * 4) + (slotPending.length * 4) + (idx * 4);
                return (
                    <button
                        key={evaluation.id}
                        onClick={() => onEvaluationClick?.(evaluation._original || evaluation)}
                        style={{ top: `${topOffset}px`, zIndex: 5 + slotPending.length + idx }}
                        className="absolute left-1 right-1 h-[52px] p-2 bg-purple-500 text-white rounded-lg text-xs text-left hover:bg-purple-600 transition-colors shadow-sm overflow-hidden"
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
                    </button>
                );
            })}
        </div>
    );
});

// ============================================
// DROP CONFIRMATION MODAL
// ============================================

const DropConfirmModal = ({ job, date, hour, onConfirm, onCancel, teamMembers, timezone, onSetupTeam, existingJobs = [], preferences, vehicles = [] }) => {
    const [selectedTime, setSelectedTime] = useState(`${hour.toString().padStart(2, '0')}:00`);
    const [selectedCrew, setSelectedCrew] = useState([]); // Multi-select crew
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [duration, setDuration] = useState(job.estimatedDuration || 120);
    const [customerConfirmed, setCustomerConfirmed] = useState(false);

    // Detect if this is a closed business day with crew available
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const isClosedBusinessDay = isDayClosedForBusiness(date, preferences?.workingHours);
    const availableCrewOnClosedDay = isClosedBusinessDay
        ? (teamMembers || []).filter(m => m.workingHours?.[dayName]?.enabled)
        : [];

    // Sync selectedTime when hour prop changes (prevents stale state from previous drag)
    useEffect(() => {
        setSelectedTime(`${hour.toString().padStart(2, '0')}:00`);
    }, [hour]);

    // Multi-day detection
    const isMultiDay = isMultiDayJob(duration);
    const estimatedDays = Math.ceil(duration / 480);

    // Get crew requirements from job
    const crewRequirements = job.crewRequirements || null;
    const requiredCrew = crewRequirements?.required || 1;
    const minimumCrew = crewRequirements?.minimum || 1;
    const requiresMultipleTechs = crewRequirements?.requiresMultipleTechs || requiredCrew > 1;

    // Validate current crew selection
    const crewValidation = useMemo(() => {
        if (!requiresMultipleTechs && selectedCrew.length <= 1) {
            return { isValid: true, meetsRequirement: true };
        }
        const proposedCrew = selectedCrew.map(id => ({ techId: id }));
        return validateProposedCrew(proposedCrew, job);
    }, [selectedCrew, job, requiresMultipleTechs]);

    // Check for schedule conflicts
    const conflicts = useMemo(() => {
        if (selectedCrew.length === 0) return [];

        const [hours, minutes] = selectedTime.split(':').map(Number);
        let scheduledDateTime;
        if (timezone) {
            // Extract date components in the business timezone
            const dateParts = new Intl.DateTimeFormat('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                timeZone: timezone
            }).formatToParts(date);
            const getPart = (type) => parseInt(dateParts.find(p => p.type === type)?.value || '0', 10);
            scheduledDateTime = createDateInTimezone(
                getPart('year'),
                getPart('month') - 1,
                getPart('day'),
                hours,
                minutes,
                timezone
            );
        } else {
            scheduledDateTime = new Date(date);
            scheduledDateTime.setHours(hours, minutes, 0, 0);
        }

        const endDateTime = new Date(scheduledDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + duration);

        return checkScheduleConflicts(
            scheduledDateTime.toISOString(),
            endDateTime.toISOString(),
            existingJobs,
            selectedCrew,
            job.id
        );
    }, [selectedTime, duration, date, timezone, selectedCrew, existingJobs, job.id]);

    const hasConflicts = conflicts.length > 0;

    const hasTeamMembers = teamMembers && teamMembers.length > 0;
    const needsTeamButNoMembers = requiresMultipleTechs && !hasTeamMembers;

    const timeOptions = [];
    for (let h = 6; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            timeOptions.push({ value: time, label });
        }
    }

    const toggleCrewMember = (memberId) => {
        setSelectedCrew(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleConfirm = () => {
        const [hours, minutes] = selectedTime.split(':').map(Number);

        let scheduledDateTime;

        if (timezone) {
            // Extract date components in the business timezone to avoid
            // mismatch when browser timezone differs from business timezone
            const dateParts = new Intl.DateTimeFormat('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                timeZone: timezone
            }).formatToParts(date);
            const getPart = (type) => parseInt(dateParts.find(p => p.type === type)?.value || '0', 10);
            const tzYear = getPart('year');
            const tzMonth = getPart('month') - 1; // 0-indexed
            const tzDay = getPart('day');

            scheduledDateTime = createDateInTimezone(
                tzYear,
                tzMonth,
                tzDay,
                hours,
                minutes,
                timezone
            );
        } else {
            scheduledDateTime = new Date(date);
            scheduledDateTime.setHours(hours, minutes, 0, 0);
        }

        // Prevent scheduling in the past
        if (scheduledDateTime < new Date()) {
            toast.error('Cannot schedule a job in the past. Please select a future date and time.');
            return;
        }

        const endDateTime = new Date(scheduledDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + duration);

        // Build crew array for multi-assign
        const crewArray = selectedCrew.map(techId => {
            const member = teamMembers?.find(m => m.id === techId);
            return {
                techId,
                name: member?.name || 'Unknown',
                role: member?.role || 'Technician',
                assignedAt: new Date().toISOString()
            };
        });

        const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
        onConfirm({
            scheduledTime: scheduledDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            assignedTo: selectedCrew.length === 1 ? selectedCrew[0] : null,
            crew: crewArray.length > 0 ? crewArray : null,
            estimatedDuration: duration,
            isDirectSchedule: customerConfirmed,
            isMultiDay,
            estimatedDays,
            vehicleId: selectedVehicle || null,
            vehicleName: selectedVehicleObj?.name || null
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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

                {/* Closed Business Day Info Banner */}
                {isClosedBusinessDay && availableCrewOnClosedDay.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-800">
                                    Business normally closed on {date.toLocaleDateString('en-US', { weekday: 'long' })}s
                                </p>
                                <p className="text-xs text-blue-600 mt-0.5">
                                    {availableCrewOnClosedDay.length} crew member{availableCrewOnClosedDay.length !== 1 ? 's' : ''} available to work
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Crew Requirements Banner */}
                {requiresMultipleTechs && (
                    <div className={`mb-4 p-3 rounded-xl border ${crewValidation.meetsRequirement
                        ? 'bg-emerald-50 border-emerald-200'
                        : crewValidation.isValid
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-start gap-2">
                            <UsersIcon size={16} className={`mt-0.5 shrink-0 ${crewValidation.meetsRequirement
                                ? 'text-emerald-600'
                                : crewValidation.isValid
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                                }`} />
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <p className={`font-medium ${crewValidation.meetsRequirement
                                        ? 'text-emerald-800'
                                        : crewValidation.isValid
                                            ? 'text-amber-800'
                                            : 'text-red-800'
                                        }`}>
                                        Crew Required: {requiredCrew} {requiredCrew === 1 ? 'person' : 'people'}
                                    </p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${crewValidation.meetsRequirement
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : crewValidation.isValid
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {selectedCrew.length}/{requiredCrew} selected
                                    </span>
                                </div>
                                {crewRequirements?.source === 'specified' && crewRequirements?.notes?.length > 0 && (
                                    <p className="text-xs text-slate-600 mt-1">
                                        From quote: {crewRequirements.notes[0]}
                                    </p>
                                )}
                                {!crewValidation.meetsRequirement && selectedCrew.length > 0 && (
                                    <p className="text-xs mt-1 flex items-center gap-1">
                                        <AlertCircle size={10} />
                                        {crewValidation.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Date Display */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <div className="px-4 py-2.5 bg-slate-100 rounded-xl text-slate-800 font-medium">
                        {date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            timeZone: timezone || undefined
                        })}
                    </div>
                    {timezone && (
                        <p className="text-xs text-slate-400 mt-1">Timezone: {timezone}</p>
                    )}
                </div>

                {/* Time Selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                    <Select
                        value={selectedTime}
                        onChange={(val) => setSelectedTime(val)}
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

                {/* Multi-day info with segment preview */}
                {isMultiDay && (() => {
                    // Generate day-by-day preview segments
                    const segments = [];
                    const startDate = new Date(date);
                    const dailyMinutes = 480; // 8-hour workday
                    let remainingMinutes = duration;
                    let dayNum = 0;

                    while (remainingMinutes > 0 && dayNum < 10) {
                        const segDate = new Date(startDate);
                        segDate.setDate(startDate.getDate() + dayNum);
                        const segDayName = segDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                        const dayPrefs = preferences?.workingHours?.[segDayName];

                        // Skip closed days
                        if (dayPrefs?.enabled === false) {
                            dayNum++;
                            continue;
                        }

                        const startHour = dayPrefs?.start || '08:00';
                        const endHour = dayPrefs?.end || '17:00';
                        const dayMinutes = Math.min(remainingMinutes, dailyMinutes);
                        segments.push({
                            date: segDate,
                            dayNumber: segments.length + 1,
                            startTime: startHour,
                            endTime: endHour,
                            minutes: dayMinutes
                        });
                        remainingMinutes -= dayMinutes;
                        dayNum++;
                    }

                    return (
                        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <div className="flex items-start gap-2">
                                <Calendar size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="font-medium text-indigo-800">
                                        Multi-Day Job: {segments.length} work days
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {segments.map(seg => (
                                            <div key={seg.dayNumber} className="flex items-center justify-between text-xs text-indigo-700">
                                                <span className="font-medium">
                                                    Day {seg.dayNumber}: {seg.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                                <span className="text-indigo-500">
                                                    {seg.startTime} - {seg.endTime} ({Math.round(seg.minutes / 60)}h)
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-indigo-500 mt-2">
                                        Calendar will be blocked across all days automatically.
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Schedule Conflict Warning */}
                {hasConflicts && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-red-800">Schedule Conflict</p>
                                <p className="text-xs text-red-600 mt-1">
                                    The selected crew has overlapping appointments:
                                </p>
                                <ul className="text-xs text-red-600 mt-1 list-disc list-inside">
                                    {conflicts.slice(0, 3).map((conflict, i) => (
                                        <li key={i}>{conflict.message}</li>
                                    ))}
                                </ul>
                                {conflicts.length > 3 && (
                                    <p className="text-xs text-red-500 mt-1">
                                        +{conflicts.length - 3} more conflicts
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Crew Assignment - Multi-select */}
                {hasTeamMembers && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Assign Crew {requiresMultipleTechs && <span className="text-slate-400">(select {requiredCrew})</span>}
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {teamMembers.map(member => {
                                const isSelected = selectedCrew.includes(member.id);
                                return (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => toggleCrewMember(member.id)}
                                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${isSelected
                                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-slate-300'
                                            }`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                                                {member.name}
                                            </p>
                                            <p className="text-xs text-slate-500">{member.role}</p>
                                        </div>
                                        {member.color && (
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0"
                                                style={{ backgroundColor: member.color }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* No Team Members - Prompt to Set Up */}
                {needsTeamButNoMembers && (
                    <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <UserPlus size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-amber-800">Team Setup Needed</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    This job requires {requiredCrew} crew members, but you haven't set up your team yet.
                                </p>
                                {onSetupTeam && (
                                    <button
                                        onClick={onSetupTeam}
                                        className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors"
                                    >
                                        Set Up Team
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Single Tech (no team) or Solo Assignment */}
                {!hasTeamMembers && !requiresMultipleTechs && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2">
                            <User size={16} className="text-slate-500" />
                            <p className="text-sm text-slate-600">Job will be assigned to you</p>
                        </div>
                    </div>
                )}

                {/* Vehicle Assignment */}
                {vehicles.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle</label>
                        <select
                            value={selectedVehicle}
                            onChange={(e) => setSelectedVehicle(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="">No vehicle assigned</option>
                            {vehicles.map(v => {
                                // Check if vehicle is busy at this time
                                const vehicleBusy = existingJobs.some(ej => {
                                    if (ej.assignedVehicleId !== v.id) return false;
                                    if (!ej.scheduledTime) return false;
                                    const ejDate = new Date(ej.scheduledTime);
                                    return isSameDayInTimezone(ejDate, date, timezone);
                                });
                                return (
                                    <option key={v.id} value={v.id} disabled={vehicleBusy}>
                                        {v.name}{v.type ? ` (${v.type})` : ''}{vehicleBusy ? ' - Busy' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

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

                {/* Understaffed Warning */}
                {requiresMultipleTechs && !crewValidation.isValid && selectedCrew.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700">
                                <span className="font-bold">Warning:</span> Scheduling with fewer crew members than required may impact job quality or completion time.
                            </p>
                        </div>
                    </div>
                )}

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
// ACCEPT PROPOSAL MODAL
// ============================================

const AcceptProposalModal = ({ job, allJobs = [], onAccept, onCounter, onCancel, isProcessing, timezone }) => {
    const [showCounterForm, setShowCounterForm] = useState(false);
    const [counterDate, setCounterDate] = useState('');
    const [counterTime, setCounterTime] = useState('09:00');

    // Get the latest homeowner proposal
    const latestProposal = job.proposedTimes?.filter(p => p.proposedBy === 'homeowner').pop();
    const proposedDate = latestProposal?.date ? new Date(latestProposal.date) : null;
    const proposalCreatedAt = latestProposal?.createdAt ? new Date(latestProposal.createdAt) : null;

    // Check if proposal is in the past
    const isPastProposal = proposedDate && proposedDate < new Date();

    // Check if proposal is stale (created more than 7 days ago)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isStaleProposal = proposalCreatedAt && proposalCreatedAt < sevenDaysAgo;

    // Check if proposal conflicts with any scheduled job
    const hasConflict = useMemo(() => {
        if (!proposedDate || isPastProposal) return null;

        const proposedStart = proposedDate.getTime();
        const jobDuration = job.estimatedDuration || 120;
        const proposedEnd = proposedStart + jobDuration * 60 * 1000;

        for (const otherJob of allJobs) {
            // Skip this job, unscheduled jobs, and completed/cancelled jobs
            if (otherJob.id === job.id) continue;
            if (!otherJob.scheduledTime) continue;
            if (['completed', 'cancelled'].includes(otherJob.status)) continue;

            const otherStart = new Date(otherJob.scheduledTime).getTime();
            const otherDuration = otherJob.estimatedDuration || 120;
            const otherEnd = otherStart + otherDuration * 60 * 1000;

            // Check for overlap
            if (proposedStart < otherEnd && proposedEnd > otherStart) {
                return otherJob;
            }
        }
        return null;
    }, [proposedDate, job, allJobs, isPastProposal]);

    const formatProposedTime = () => {
        if (!proposedDate) return 'Unknown time';
        return proposedDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const handleCounter = () => {
        if (!counterDate || !counterTime) {
            toast.error('Please select a date and time');
            return;
        }
        const counterDateTime = new Date(`${counterDate}T${counterTime}:00`);
        if (counterDateTime < new Date()) {
            toast.error('Cannot propose a time in the past');
            return;
        }
        onCounter(counterDateTime.toISOString());
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                <h3 className="font-bold text-lg text-slate-800 mb-2">Customer Proposed a Time</h3>

                {/* Job Info */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-slate-800">
                        {job.title || job.description || 'Service'}
                    </h4>
                    <p className="text-sm text-slate-500">{job.customer?.name || job.customerName}</p>
                    {job.customer?.address && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin size={12} />
                            {job.customer.address}
                        </p>
                    )}
                </div>

                {/* Proposed Time */}
                <div className={`p-4 rounded-xl mb-4 ${isPastProposal ? 'bg-red-50 border border-red-200' : hasConflict ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                    <p className={`text-xs font-bold uppercase mb-1 ${isPastProposal ? 'text-red-800' : hasConflict ? 'text-amber-800' : 'text-blue-800'}`}>Proposed Time</p>
                    <p className={`text-lg font-bold ${isPastProposal ? 'text-red-700' : hasConflict ? 'text-amber-900' : 'text-blue-900'}`}>
                        {formatProposedTime()}
                    </p>
                    {isPastProposal && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle size={12} />
                            This time has passed - please counter-propose
                        </p>
                    )}
                    {hasConflict && !isPastProposal && (
                        <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Conflicts with "{hasConflict.title || 'another job'}" - consider counter-proposing
                        </p>
                    )}
                    {isStaleProposal && !isPastProposal && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock size={12} />
                            Proposal was made over a week ago - customer may have moved on
                        </p>
                    )}
                </div>

                {/* Counter Proposal Form */}
                {showCounterForm ? (
                    <div className="p-4 border border-amber-200 rounded-xl bg-amber-50 mb-4 animate-in slide-in-from-bottom-2">
                        <p className="text-xs font-bold text-amber-800 uppercase mb-2">Counter-Propose</p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="date"
                                className="flex-1 p-2 rounded-lg border border-amber-200 outline-none focus:ring-2 focus:ring-amber-500"
                                value={counterDate}
                                onChange={e => setCounterDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <input
                                type="time"
                                className="w-28 p-2 rounded-lg border border-amber-200 outline-none focus:ring-2 focus:ring-amber-500"
                                value={counterTime}
                                onChange={e => setCounterTime(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCounter}
                                disabled={isProcessing}
                                className="flex-1 bg-amber-500 text-white font-bold py-2.5 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                                {isProcessing ? 'Sending...' : 'Send Counter'}
                            </button>
                            <button
                                onClick={() => setShowCounterForm(false)}
                                className="px-4 bg-white text-slate-500 font-bold py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => setShowCounterForm(true)}
                            className="flex-1 px-4 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 flex items-center justify-center gap-2"
                        >
                            <Clock size={18} />
                            Counter
                        </button>
                        {!isPastProposal && (
                            <button
                                onClick={() => onAccept(latestProposal.date)}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Check size={18} />
                                {isProcessing ? 'Accepting...' : 'Accept'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// CLICK-TO-SCHEDULE MODAL
// ============================================

const ClickScheduleModal = ({ date, hour, unscheduledJobs, onSelect, onCancel, timezone }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: timezone || undefined
    });

    const formattedTime = formatTime(hour);

    // Filter jobs by search term
    const filteredJobs = unscheduledJobs.filter(job => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (job.title || '').toLowerCase().includes(term) ||
            (job.description || '').toLowerCase().includes(term) ||
            (job.customer?.name || '').toLowerCase().includes(term) ||
            (job.customer?.address || '').toLowerCase().includes(term)
        );
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                <h3 className="font-bold text-lg text-slate-800 mb-1">Schedule a Job</h3>
                <p className="text-sm text-slate-500 mb-4">
                    {formattedDate} at {formattedTime}
                </p>

                {/* Search */}
                {unscheduledJobs.length > 3 && (
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                )}

                {/* Job List */}
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                    {filteredJobs.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <Calendar size={24} className="mx-auto mb-2" />
                            <p className="text-sm">
                                {searchTerm ? 'No matching jobs found' : 'No unscheduled jobs'}
                            </p>
                        </div>
                    ) : (
                        filteredJobs.map(job => (
                            <button
                                key={job.id}
                                onClick={() => onSelect(job)}
                                className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-emerald-700" title={job.title || job.description || 'Service'}>
                                            {job.title || job.description || 'Service'}
                                        </h4>
                                        <p className="text-xs text-slate-500 truncate" title={job.customer?.name || 'Customer'}>
                                            {job.customer?.name || 'Customer'}
                                        </p>
                                        {job.customer?.address && (
                                            <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-1" title={job.customer.address}>
                                                <MapPin size={10} />
                                                {job.customer.address.split(',')[0]}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs text-slate-400">
                                            {formatDuration(job.estimatedDuration || 120)}
                                        </span>
                                        {job.total > 0 && (
                                            <p className="text-xs font-bold text-emerald-600 mt-0.5">
                                                ${job.total.toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Cancel Button */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
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
    onEvaluationClick,  // Handler for evaluation clicks
    onSetupTeam,  // Handler to navigate to team management
    onAcceptProposal,  // Handler for accepting homeowner proposals
    onDeclineProposal,  // Handler for declining homeowner proposals
    vehicles = []  // Available vehicles for assignment
}) => {
    // Get timezone abbreviation for display
    const timezoneAbbr = timezone ? getTimezoneAbbreviation(timezone) : null;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [draggedJob, setDraggedJob] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [confirmDrop, setConfirmDrop] = useState(null);
    const [proposalJob, setProposalJob] = useState(null); // For Accept/Counter modal
    const [isProcessingProposal, setIsProcessingProposal] = useState(false);
    const [clickScheduleTarget, setClickScheduleTarget] = useState(null); // NEW: For click-to-schedule

    // FIX: Track optimistic updates for instant UI feedback (prevents snap-back)
    const [optimisticUpdates, setOptimisticUpdates] = useState({}); // { jobId: { scheduledTime, scheduledEndTime, ... } }
    const [originalJobData, setOriginalJobData] = useState(null); // For rollback on API failure

    const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // NEW: Separate scheduled, unscheduled, and pending (offered) slots
    const { scheduledJobs, unscheduledJobs, pendingSlots } = useMemo(() => {
        const scheduled = [];
        const unscheduled = [];
        const pending = [];

        jobs.forEach(job => {
            // Skip completed/cancelled jobs
            if (['completed', 'cancelled'].includes(job.status)) return;

            // Job is SCHEDULED if it has a scheduledTime or scheduledDate AND status is 'scheduled'
            // FIXED: Also check scheduledStartTime field (BUG-020)
            const hasSchedule = job.scheduledTime || job.scheduledStartTime || job.scheduledDate;
            const isScheduledStatus = job.status === 'scheduled' || job.status === 'in_progress';
            const hasCrew = (job.assignedCrew?.length > 0) || job.assignedTechId;
            const isSuggestedSchedule = hasSchedule && !hasCrew && (
                job.status === 'pending_schedule' ||
                (job.status === 'pending' && job.scheduling?.suggestedTime)
            );

            if (hasSchedule && (isScheduledStatus || hasCrew)) {
                // Fully scheduled OR has crew assigned - show on calendar as confirmed, NOT in sidebar
                scheduled.push(job);
            } else if (isSuggestedSchedule) {
                // Has a date but not confirmed and no crew - show on calendar with "Suggested" indicator only
                // Do NOT show in sidebar to avoid confusion about whether job is scheduled
                scheduled.push({ ...job, _isSuggested: true });
            } else {
                // Check for homeowner proposals first - they need contractor action
                const homeownerProposals = job.proposedTimes?.filter(p => p.proposedBy === 'homeowner') || [];
                const latestHomeownerProposal = homeownerProposals.length > 0 ? homeownerProposals[homeownerProposals.length - 1] : null;

                // Check for contractor offered slots
                const offeredSlots = job.scheduling?.offeredSlots?.filter(s => s.status === 'offered') || [];

                // Debug logging for homeowner proposals
                if (homeownerProposals.length > 0) {
                    console.log('[DragDropCalendar] Job with homeowner proposals:', {
                        jobId: job.id,
                        status: job.status,
                        proposedTimes: job.proposedTimes,
                        homeownerProposals,
                        latestHomeownerProposal,
                        willShow: latestHomeownerProposal?.date && job.status === 'scheduling'
                    });
                }

                // Priority: Homeowner proposals need action, then offered slots, then unscheduled
                if (latestHomeownerProposal?.date && (job.status === 'scheduling' || job.status === 'slots_offered')) {
                    // Homeowner proposed a time - show in pending on calendar AND sidebar
                    pending.push({
                        ...job,
                        id: job.id,
                        isPendingSlot: true,
                        isHomeownerProposal: true,
                        slotStart: latestHomeownerProposal.date,
                        slotEnd: null,
                        proposedBy: latestHomeownerProposal.proposedBy,
                        customerName: job.customer?.name || 'Customer'
                    });
                    // Also show in sidebar with special flag
                    unscheduled.push({ ...job, hasHomeownerProposal: true });
                } else if (offeredSlots.length > 0) {
                    // Has offered slots but not confirmed - show in pending AND sidebar
                    offeredSlots.forEach(slot => {
                        pending.push({
                            ...job,
                            id: job.id,
                            isPendingSlot: true,
                            slotStart: slot.start,
                            slotEnd: slot.end,
                            slotId: slot.id,
                            customerName: job.customer?.name || 'Customer'
                        });
                    });
                    // Still show in sidebar until customer confirms
                    unscheduled.push(job);
                } else if (hasSchedule && job.status === 'pending') {
                    // Has a schedule but status is still pending - show on calendar
                    scheduled.push(job);
                } else {
                    // No schedule at all - show in sidebar
                    unscheduled.push(job);
                }
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

    // Working hours range - expands to fit late-day jobs
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

        // Auto-expand grid to fit jobs that extend past business hours
        // FIXED: Also check scheduledStartTime field (BUG-020)
        if (jobs?.length) {
            jobs.forEach(job => {
                const startTime = job.scheduledTime || job.scheduledStartTime || job.scheduledDate;
                if (!startTime) return;
                const startHour = getHourFromDate(startTime, timezone);
                const durationMinutes = job.estimatedDuration || 60;
                const jobEndHour = startHour + Math.ceil(durationMinutes / 60);
                if (startHour < minHour) minHour = Math.max(0, startHour);
                if (jobEndHour > maxHour) maxHour = Math.min(23, jobEndHour);
            });
        }

        const hours = [];
        for (let h = minHour; h <= maxHour; h++) {
            hours.push(h);
        }
        return hours;
    }, [preferences, jobs, timezone]);

    // Auto-scroll to current time on mount
    const scrollContainerRef = useRef(null);
    useEffect(() => {
        if (scrollContainerRef.current && workingHours.length > 0) {
            const now = new Date();
            const currentHour = now.getHours();
            const slotHeight = 60; // px per hour slot
            const scrollTo = Math.max(0, (currentHour - workingHours[0]) * slotHeight - slotHeight);
            scrollContainerRef.current.scrollTop = scrollTo;
        }
    }, [workingHours]);

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
        let jobData = null;
        try {
            const rawData = e.dataTransfer.getData('jobData');
            jobData = rawData ? JSON.parse(rawData) : null;
        } catch (err) {
            console.error('Failed to parse job data from drag:', err);
        }

        // Prevent dropping on past dates/times
        let slotDateTime;
        if (timezone) {
            const dateParts = new Intl.DateTimeFormat('en-US', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                timeZone: timezone
            }).formatToParts(date);
            const getPart = (type) => parseInt(dateParts.find(p => p.type === type)?.value || '0', 10);
            slotDateTime = createDateInTimezone(getPart('year'), getPart('month') - 1, getPart('day'), hour, 0, timezone);
        } else {
            slotDateTime = new Date(date);
            slotDateTime.setHours(hour, 0, 0, 0);
        }
        if (slotDateTime < new Date()) {
            toast.error('Cannot schedule a job in the past.', { icon: '⏰', duration: 3000 });
            setDropTarget(null);
            setDraggedJob(null);
            return;
        }

        // Check if the target day is a closed business day
        if (isDayClosedForBusiness(date, preferences?.workingHours)) {
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const crewAvailable = preferences?.teamMembers?.some(m => m.workingHours?.[dayName]?.enabled);

            if (!crewAvailable) {
                toast.error(`Cannot schedule on ${date.toLocaleDateString('en-US', { weekday: 'long' })} - business is closed and no crew available`, {
                    icon: '🚫',
                    duration: 4000
                });
                setDropTarget(null);
                setDraggedJob(null);
                return;
            }
            // Crew is available on this closed day - allow scheduling with warning shown in modal
        }

        if (jobId && jobData) {
            setConfirmDrop({ job: jobData, date, hour });
        }

        setDropTarget(null);
        setDraggedJob(null);
    }, [preferences?.workingHours, timezone]);

    // Confirm scheduling
    // Confirm scheduling (propose or direct)
    // FIX 1 & 2: Optimistic UI updates + Duration preservation
    const handleConfirmSchedule = async (scheduleData) => {
        if (!confirmDrop?.job) return;

        const jobId = confirmDrop.job.id;
        const isReschedule = confirmDrop.job._isReschedule;

        // FIX 2: Preserve original duration for rescheduled jobs
        // Do NOT trust the calendar's default end time on drop - it often defaults to 1 hour
        let actualDuration = scheduleData.estimatedDuration;
        let calculatedEndTime = scheduleData.endTime;

        if (isReschedule && confirmDrop.job._originalDuration) {
            // Use the original duration from the dragged job
            actualDuration = confirmDrop.job._originalDuration;
            // Recalculate end time based on preserved duration
            const startMs = new Date(scheduleData.scheduledTime).getTime();
            calculatedEndTime = new Date(startMs + (actualDuration * 60 * 1000)).toISOString();
            console.log('[DragDropCalendar] Reschedule: Preserved duration', actualDuration, 'mins, calculated end:', calculatedEndTime);
        }

        // FIX 1: Store original job data for rollback
        const originalJob = isReschedule ? {
            id: jobId,
            scheduledTime: confirmDrop.job._originalStart,
            scheduledEndTime: confirmDrop.job._originalEnd,
            estimatedDuration: confirmDrop.job._originalDuration
        } : null;

        // FIX 1: Apply optimistic update IMMEDIATELY (before API call)
        // This prevents the "snap back" visual bug
        setOptimisticUpdates(prev => ({
            ...prev,
            [jobId]: {
                scheduledTime: scheduleData.scheduledTime,
                scheduledDate: scheduleData.scheduledTime,
                scheduledEndTime: calculatedEndTime,
                estimatedDuration: actualDuration,
                status: scheduleData.isDirectSchedule ? 'scheduled' : 'slots_offered'
            }
        }));

        // Store original for potential rollback
        if (originalJob) {
            setOriginalJobData(originalJob);
        }

        try {
            if (scheduleData.isDirectSchedule) {
                // Build update data with preserved duration
                const updateData = {
                    scheduledTime: scheduleData.scheduledTime,
                    scheduledDate: scheduleData.scheduledTime,
                    scheduledEndTime: calculatedEndTime, // FIX 2: Use calculated end time
                    estimatedDuration: actualDuration,   // FIX 2: Use preserved duration
                    assignedTo: scheduleData.assignedTo,
                    status: 'scheduled',
                    lastActivity: serverTimestamp()
                };

                // Track reschedule history
                if (isReschedule) {
                    updateData.scheduleHistory = arrayUnion({
                        previousStart: confirmDrop.job._originalStart,
                        previousEnd: confirmDrop.job._originalEnd,
                        rescheduledAt: new Date().toISOString(),
                        reason: 'drag_drop_reschedule'
                    });
                }

                // Add crew array if multiple techs assigned
                if (scheduleData.crew && scheduleData.crew.length > 0) {
                    updateData.crew = scheduleData.crew;
                    updateData.assignedCrew = scheduleData.crew;
                }

                // Add vehicle if selected
                if (scheduleData.vehicleId) {
                    updateData.assignedVehicleId = scheduleData.vehicleId;
                    updateData.assignedVehicleName = scheduleData.vehicleName;
                }

                // Handle multi-day jobs
                if (scheduleData.isMultiDay) {
                    const { createMultiDaySchedule } = await import('../lib/multiDayUtils');
                    const multiDaySchedule = createMultiDaySchedule(
                        new Date(scheduleData.scheduledTime),
                        actualDuration, // FIX 2: Use preserved duration
                        preferences?.workingHours || {}
                    );
                    updateData.multiDaySchedule = multiDaySchedule;
                }

                // DIRECT SCHEDULE - Customer already confirmed
                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, confirmDrop.job.id), updateData);

                // FIX 1: Clear optimistic update on success (real data will come from listener)
                setOptimisticUpdates(prev => {
                    const { [jobId]: _, ...rest } = prev;
                    return rest;
                });

                toast.success(scheduleData.isMultiDay
                    ? `Job scheduled for ${scheduleData.estimatedDays} days!`
                    : isReschedule ? 'Job rescheduled!' : 'Job scheduled!');

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
                            estimatedDuration: actualDuration || null,
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
                    end: calculatedEndTime, // FIX 2: Use calculated end time
                    status: 'offered',
                    createdAt: new Date().toISOString()
                };

                const proposeUpdateData = {
                    'scheduling.offeredSlots': [offeredSlot],
                    'scheduling.offeredAt': serverTimestamp(),
                    assignedTo: scheduleData.assignedTo,
                    estimatedDuration: actualDuration, // FIX 2: Use preserved duration
                    status: 'slots_offered',
                    lastActivity: serverTimestamp()
                };

                // Add crew array if multiple techs assigned
                if (scheduleData.crew && scheduleData.crew.length > 0) {
                    proposeUpdateData.crew = scheduleData.crew;
                }

                await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, confirmDrop.job.id), proposeUpdateData);

                // Clear optimistic update on success
                setOptimisticUpdates(prev => {
                    const { [jobId]: _, ...rest } = prev;
                    return rest;
                });

                toast.success('Time proposed! Waiting for customer confirmation.');
            }

            if (onJobUpdate) onJobUpdate();
        } catch (error) {
            console.error('Error scheduling job:', error);

            // FIX 1: ROLLBACK optimistic update on failure
            setOptimisticUpdates(prev => {
                const { [jobId]: _, ...rest } = prev;
                return rest;
            });

            // If this was a reschedule, the visual should snap back automatically
            // since we removed the optimistic update

            toast.error('Failed to schedule job');
        }

        setConfirmDrop(null);
        setOriginalJobData(null);
    };

    // Handle accepting a homeowner's proposed time
    const handleAcceptProposal = async (proposedDate) => {
        if (!proposalJob) return;
        setIsProcessingProposal(true);

        try {
            // Calculate end time based on job duration
            const startTime = new Date(proposedDate);
            const durationMinutes = proposalJob.estimatedDuration || 120;
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + durationMinutes);

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, proposalJob.id), {
                scheduledTime: proposedDate,
                scheduledDate: proposedDate,
                scheduledEndTime: endTime.toISOString(),
                status: 'scheduled',
                'scheduling.confirmedSlot': {
                    start: proposedDate,
                    end: endTime.toISOString(),
                    confirmedAt: new Date().toISOString(),
                    confirmedBy: 'contractor'
                },
                lastActivity: serverTimestamp()
            });

            toast.success('Time accepted! Job scheduled.');
            setProposalJob(null);
            if (onJobUpdate) onJobUpdate();
        } catch (error) {
            console.error('Error accepting proposal:', error);
            toast.error('Failed to accept proposed time');
        } finally {
            setIsProcessingProposal(false);
        }
    };

    // Handle counter-proposing a different time
    const handleCounterProposal = async (counterDate) => {
        if (!proposalJob) return;
        setIsProcessingProposal(true);

        try {
            const newProposal = {
                date: counterDate,
                proposedBy: 'contractor',
                createdAt: new Date().toISOString()
            };

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, proposalJob.id), {
                proposedTimes: [...(proposalJob.proposedTimes || []), newProposal],
                status: 'scheduling',
                lastActivity: serverTimestamp()
            });

            toast.success('Counter-proposal sent!');
            setProposalJob(null);
            if (onJobUpdate) onJobUpdate();
        } catch (error) {
            console.error('Error sending counter-proposal:', error);
            toast.error('Failed to send counter-proposal');
        } finally {
            setIsProcessingProposal(false);
        }
    };

    // Internal click handler that routes to proposal modal or external handler
    const handleInternalJobClick = useCallback((job) => {
        // Check if this is a homeowner proposal that needs accept/counter
        if (job._isProposal && job.isHomeownerProposal) {
            setProposalJob(job);
        } else {
            // Pass to external handler
            onJobClick?.(job);
        }
    }, [onJobClick]);

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
                    {/* Badge for jobs with customer proposals */}
                    {(() => {
                        const proposalCount = unscheduledJobs.filter(j => j.hasHomeownerProposal || j.proposedTimes?.some(p => p.proposedBy === 'homeowner')).length;
                        if (proposalCount > 0) {
                            return (
                                <div className="mt-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs font-bold text-blue-700 flex items-center gap-1">
                                        <Clock size={12} />
                                        {proposalCount} {proposalCount === 1 ? 'customer' : 'customers'} proposed times
                                    </p>
                                </div>
                            );
                        }
                        return null;
                    })()}
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
                                onAcceptProposal={onAcceptProposal}
                                onDeclineProposal={onDeclineProposal}
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
                        const isClosed = isDayClosedForBusiness(date, preferences?.workingHours);
                        const headerOptions = timezone ? { timeZone: timezone } : undefined;
                        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', ...headerOptions });
                        const dayNumber = timezone
                            ? new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: timezone }).format(date)
                            : date.getDate();
                        return (
                            <div
                                key={idx}
                                className={`p-2 text-center border-l border-slate-100 ${isToday ? 'bg-emerald-50' : ''} ${isClosed ? 'bg-slate-100' : ''}`}
                            >
                                <p className={`text-xs font-medium ${isToday ? 'text-emerald-600' : isClosed ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {dayLabel}
                                </p>
                                <p className={`text-lg font-bold ${isToday ? 'text-emerald-600' : isClosed ? 'text-slate-400' : 'text-slate-800'}`}>
                                    {dayNumber}
                                </p>
                                {isClosed && (
                                    <span className="text-[10px] text-slate-400 font-medium">Closed</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Time Grid */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
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
                                        onJobClick={handleInternalJobClick}
                                        onEvaluationClick={onEvaluationClick}
                                        onSlotClick={(date, hour) => setClickScheduleTarget({ date, hour })}
                                        preferences={preferences}
                                        timezone={timezone}
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
                    existingJobs={scheduledJobs}
                    preferences={preferences}
                    vehicles={vehicles}
                    onConfirm={handleConfirmSchedule}
                    onCancel={() => setConfirmDrop(null)}
                    onSetupTeam={onSetupTeam ? () => {
                        setConfirmDrop(null);
                        onSetupTeam();
                    } : null}
                />
            )}

            {/* Accept/Counter Proposal Modal */}
            {proposalJob && (
                <AcceptProposalModal
                    job={proposalJob}
                    allJobs={scheduledJobs}
                    onAccept={handleAcceptProposal}
                    onCounter={handleCounterProposal}
                    onCancel={() => setProposalJob(null)}
                    isProcessing={isProcessingProposal}
                    timezone={timezone}
                />
            )}

            {/* Click-to-Schedule Modal */}
            {clickScheduleTarget && (
                <ClickScheduleModal
                    date={clickScheduleTarget.date}
                    hour={clickScheduleTarget.hour}
                    unscheduledJobs={unscheduledJobs}
                    timezone={timezone}
                    onSelect={(job) => {
                        // Open the drop confirmation modal with the selected job
                        setConfirmDrop({
                            job,
                            date: clickScheduleTarget.date,
                            hour: clickScheduleTarget.hour
                        });
                        setClickScheduleTarget(null);
                    }}
                    onCancel={() => setClickScheduleTarget(null)}
                />
            )}
        </div>
    );
};

export default DragDropCalendar;
