// src/features/contractor-pro/components/ContractorCalendar.jsx
// ============================================
// CONTRACTOR CALENDAR - Week & Month View
// ============================================
// Visual schedule management for contractors
// UPDATED: Shows pending slots in amber

import React, { useState, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar, Clock, MapPin,
    Plus, Filter, List, Grid3X3, AlertCircle, CheckCircle,
    User, DollarSign, ArrowRight, Sparkles, X, ClipboardList, Video, Truck
} from 'lucide-react';
import { isSameDayInTimezone, createDateInTimezone, formatDateInTimezone, formatTimeInTimezone } from '../lib/timezoneUtils';

// ============================================
// HELPER FUNCTIONS
// ============================================

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

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(date);
};

const formatTime = (dateStr, timezone) => {
    if (!dateStr) return '';
    if (timezone) {
        return formatTimeInTimezone(dateStr, timezone);
    }
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};



const getWeekDates = (date, timezone) => {
    // Ensure we start from the correct day in the target timezone
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Start from Sunday

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);

        // Reconstruction in target timezone if needed, but since we are just deriving
        // 7 consecutive days from a valid 'date' object (which we assume is already valid in TZ due to navigation)
        // we might just need to ensure consistency. 
        // Better: Explicitly construct them.
        // However, 'start' is a timestamp. 
        // Let's rely on the input 'date' being already "centered" in the right timezone (handled by navigation/init).
        dates.push(d);
    }
    return dates;
};

// UPDATED: Helper to generate consistent keys for the event map
const getDateKey = (date, timezone) => {
    // using 'medium' format from timezoneUtils (which matches isSameDayInTimezone logic)
    // We could use isSameDayInTimezone logic directly but we need a string key.
    // formatDateInTimezone(..., 'medium') returns "Jan 1, 2024" type string which is a stable key.
    // We import formatDateInTimezone for this.
    return formatDateInTimezone(date, timezone, 'medium');
};

// NOTE: calculateEventsForDate logic moved to efficient Map generation inside component
// providing backward compat if needed, but intended to be replaced.

const getEventStatus = (event) => {
    // Handle evaluations
    if (event.type === 'evaluation') return 'evaluation';

    // Handle jobs
    if (event.status === 'in_progress') return 'in_progress';

    // Confirmed = has crew assigned OR manually assigned OR status is 'scheduled' with crew
    const hasAssignedCrew = event.assignedCrew?.length > 0 || !!event.assignedTechId;
    const isManuallyAssigned = event.assignedBy === 'manual' || event.assignedBy === 'owner';

    // FIXED: Also check scheduledStartTime field (BUG-020)
    if (hasAssignedCrew && (event.scheduledTime || event.scheduledStartTime || event.scheduledDate || event.status === 'scheduled')) {
        return 'confirmed';
    }

    // AI-suggested = has scheduled time but assigned by AI without crew confirmation
    if ((event.scheduledTime || event.scheduledStartTime || event.scheduledDate || event.status === 'scheduled') &&
        (event.assignedBy === 'ai' || !hasAssignedCrew)) {
        return 'suggested';
    }

    // Pending = offered slots or proposed times awaiting homeowner response
    if (event.scheduling?.offeredSlots?.some(s => s.status === 'offered')) return 'pending';
    if (event.proposedTimes?.length > 0) return 'pending';

    return 'unscheduled';
};

// Backward compatibility alias
const getJobStatus = getEventStatus;

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_STYLES = {
    confirmed: {
        bg: 'bg-emerald-500',
        bgLight: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        label: 'Assigned'
    },
    suggested: {
        bg: 'bg-amber-500',
        bgLight: 'bg-amber-50/60',
        border: 'border-amber-300',
        borderDashed: 'border-dashed border-2',
        text: 'text-amber-700',
        label: 'Suggested',
        style: {
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.08) 0px, rgba(245, 158, 11, 0.08) 10px, transparent 10px, transparent 20px)'
        }
    },
    pending: {
        bg: 'bg-orange-500',
        bgLight: 'bg-orange-50',
        border: 'border-orange-200',
        borderDashed: 'border-dashed border-2',
        text: 'text-orange-700',
        label: 'Awaiting Response',
        style: {
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(249, 115, 22, 0.1) 0px, rgba(249, 115, 22, 0.1) 10px, transparent 10px, transparent 20px)'
        }
    },
    in_progress: {
        bg: 'bg-blue-500',
        bgLight: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        label: 'In Progress'
    },
    unscheduled: {
        bg: 'bg-slate-400',
        bgLight: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-600',
        label: 'Unscheduled'
    },
    evaluation: {
        bg: 'bg-purple-500',
        bgLight: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        label: 'Site Visit'
    }
};

// ============================================
// WEEK VIEW COMPONENT
// ============================================

const WeekView = ({ currentDate, getEvents, onSelectDate, onSelectJob, selectedDate, timezone }) => {
    const weekDates = getWeekDates(currentDate, timezone);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-slate-100">
                {weekDates.map((date, idx) => {
                    const isToday = isSameDayInTimezone(date, today, timezone);
                    const isSelected = isSameDayInTimezone(date, selectedDate, timezone);
                    const dayEvents = getEvents(date);
                    const hasConfirmed = dayEvents.some(e => getJobStatus(e) === 'confirmed');
                    const hasPending = dayEvents.some(e => getJobStatus(e) === 'pending');
                    const hasEvaluation = dayEvents.some(e => e.type === 'evaluation');
                    const hasInProgress = dayEvents.some(e => getJobStatus(e) === 'in_progress');

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectDate(date)}
                            className={`p-3 text-center transition-colors relative ${isSelected
                                ? 'bg-emerald-50'
                                : 'hover:bg-slate-50'
                                }`}
                        >
                            <p className={`text-xs font-medium ${isToday ? 'text-emerald-600' : 'text-slate-500'
                                }`}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                            </p>
                            <p className={`text-lg font-bold mt-1 ${isToday
                                ? 'bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto'
                                : isSelected
                                    ? 'text-emerald-600'
                                    : 'text-slate-800'
                                }`}>
                                {date.getDate()}
                            </p>
                            {/* Event indicators */}
                            {dayEvents.length > 0 && (
                                <div className="flex justify-center gap-1 mt-2">
                                    {hasConfirmed && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                                    {hasPending && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                    {hasEvaluation && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                                    {hasInProgress && !hasConfirmed && !hasPending && !hasEvaluation && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Day Detail */}
            {selectedDate && (
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-800">
                            {formatDate(selectedDate)}
                        </h3>
                        <span className="text-xs text-slate-500">
                            {getEvents(selectedDate).length} events
                        </span>
                    </div>

                    <div className="space-y-2">
                        {getEvents(selectedDate).length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Calendar size={24} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No events scheduled</p>
                            </div>
                        ) : (
                            getEvents(selectedDate)
                                .sort((a, b) => {
                                    // FIXED: Also check scheduledStartTime field (BUG-020)
                                    const timeA = a.start || a.scheduledTime || a.scheduledStartTime || a.scheduledDate ||
                                        (a.scheduling?.offeredSlots?.find(s => isSameDayInTimezone(s.start, selectedDate, timezone))?.start);
                                    const timeB = b.start || b.scheduledTime || b.scheduledStartTime || b.scheduledDate ||
                                        (b.scheduling?.offeredSlots?.find(s => isSameDayInTimezone(s.start, selectedDate, timezone))?.start);
                                    return new Date(timeA) - new Date(timeB);
                                })
                                .map(event => {
                                    const status = getJobStatus(event);
                                    const styles = STATUS_STYLES[status];
                                    const isEvaluation = event.type === 'evaluation';

                                    // Get display time
                                    // FIXED: Also check scheduledStartTime field (BUG-020)
                                    let displayTime = event.start || event.scheduledTime || event.scheduledStartTime;
                                    if (status === 'pending') {
                                        const slot = event.scheduling?.offeredSlots?.find(s =>
                                            s.status === 'offered' && isSameDayInTimezone(s.start, selectedDate, timezone)
                                        );
                                        displayTime = slot?.start;
                                    }

                                    // Multi-day info for Detail View
                                    let multiDayInfo = null;
                                    if (event.isMultiDay && event.multiDaySchedule) {
                                        const start = new Date(event.multiDaySchedule.startDate);
                                        const current = new Date(selectedDate);
                                        // Normalize to midnight UTC for diff
                                        const startMidnight = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
                                        const currentMidnight = new Date(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()));

                                        const diffTime = Math.abs(currentMidnight - startMidnight);
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                                        multiDayInfo = `Day ${diffDays} of ${event.multiDaySchedule.totalDays}`;
                                    }

                                    return (
                                        <button
                                            key={event.id}
                                            onClick={() => onSelectJob(event)}
                                            style={styles.style || {}}
                                            className={`w-full p-3 rounded-xl border ${styles.border} ${styles.borderDashed || ''} ${styles.bgLight} text-left hover:shadow-md transition-all`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${styles.bg}`} />
                                                        <span className="text-xs font-medium text-slate-500">
                                                            {displayTime ? formatTime(displayTime, timezone) : 'TBD'}
                                                        </span>
                                                        {status === 'suggested' && (
                                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                                                SUGG
                                                            </span>
                                                        )}
                                                        {status === 'confirmed' && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                                                                ASSIGNED
                                                            </span>
                                                        )}
                                                        {status === 'pending' && (
                                                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                                                OFFERED
                                                            </span>
                                                        )}
                                                        {multiDayInfo && (
                                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                                                {multiDayInfo}
                                                            </span>
                                                        )}
                                                        {isEvaluation && (
                                                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                                                {event.evaluationType === 'virtual' ? <Video size={10} /> : <ClipboardList size={10} />}
                                                                {event.evaluationType === 'virtual' ? 'VIRTUAL' : 'SITE VISIT'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-bold text-slate-800 mt-1 truncate" title={event.title || event.description || 'Service'}>
                                                        {event.title || event.description || 'Service'}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 truncate mt-0.5" title={event.customer?.name || 'Customer'}>
                                                        {event.customer?.name || 'Customer'}
                                                    </p>
                                                    {/* Crew & Vehicle indicators */}
                                                    {!isEvaluation && (event.assignedCrew?.length > 0 || event.assignedVehicleName) && (
                                                        <div className="flex items-center gap-1 mt-1">
                                                            {event.assignedCrew?.length > 0 && (
                                                                <div className="flex -space-x-1">
                                                                    {event.assignedCrew.slice(0, 3).map((member, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-white"
                                                                            style={{ backgroundColor: member.color || '#64748B' }}
                                                                            title={member.techName}
                                                                        >
                                                                            {member.techName?.charAt(0) || '?'}
                                                                        </div>
                                                                    ))}
                                                                    {event.assignedCrew.length > 3 && (
                                                                        <div className="w-4 h-4 rounded-full bg-slate-500 text-white flex items-center justify-center text-[8px] font-bold border border-white">
                                                                            +{event.assignedCrew.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {(event.assignedVehicleName || event.assignedCrew?.some(m => m.vehicleName)) && (
                                                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title={event.assignedVehicleName || event.assignedCrew?.find(m => m.vehicleName)?.vehicleName}>
                                                                    <Truck size={10} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {isEvaluation && event.customer?.address && (
                                                        <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1" title={event.customer.address}>
                                                            <MapPin size={10} />
                                                            {event.customer.address}
                                                        </p>
                                                    )}
                                                </div>
                                                {!isEvaluation && event.total > 0 && (
                                                    <span className="text-sm font-bold text-slate-700">
                                                        ${event.total.toLocaleString()}
                                                    </span>
                                                )}
                                                {isEvaluation && event.duration && (
                                                    <span className="text-xs text-purple-600 font-medium">
                                                        {event.duration}min
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MONTH VIEW COMPONENT
// ============================================

const MonthView = ({ currentDate, getEvents, onSelectDate, onSelectJob, selectedDate, timezone }) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="p-2 h-24" />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        // Use noon in the target timezone to avoid DST midnight edge cases
        // and ensure the date "lands" on the correct day in that zone
        const date = createDateInTimezone(year, month, day, 12, 0, timezone || 'UTC');
        const isToday = isSameDayInTimezone(date, today, timezone);
        const isSelected = isSameDayInTimezone(date, selectedDate, timezone);
        const dayJobs = getEvents(date);

        days.push(
            <button
                key={day}
                onClick={() => onSelectDate(date)}
                className={`p-2 h-24 border-b border-r border-slate-100 text-left hover:bg-slate-50 transition-colors relative flex flex-col ${isSelected ? 'bg-emerald-50' : ''
                    }`}
            >
                <span className={`text-sm font-medium shrink-0 ${isToday
                    ? 'bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                    : 'text-slate-700'
                    }`}>
                    {day}
                </span>

                {/* Event pills - flex-1 and overflow-hidden on events only, not "+more" */}
                <div className="mt-1 flex-1 min-h-0 flex flex-col">
                    <div className="space-y-0.5 overflow-hidden flex-1">
                    {dayJobs.slice(0, 2).map((event, idx) => {
                        const status = getJobStatus(event);
                        const styles = STATUS_STYLES[status];
                        const isEvaluation = event.type === 'evaluation';

                        // Get display time
                        // FIXED: Also check scheduledStartTime field (BUG-020)
                        let displayTime = event.start || event.scheduledTime || event.scheduledStartTime;
                        if (status === 'pending') {
                            const slot = event.scheduling?.offeredSlots?.find(s =>
                                s.status === 'offered' && isSameDayInTimezone(s.start, date, timezone)
                            );
                            displayTime = slot?.start;
                        }

                        // Multi-day styling logic
                        let multiDayClasses = 'rounded';
                        let marginClass = '';

                        if (event.isMultiDay && event.multiDaySchedule) {
                            const isStart = isSameDayInTimezone(date, event.multiDaySchedule.startDate, timezone);
                            const isEnd = isSameDayInTimezone(date, event.multiDaySchedule.endDate, timezone);

                            if (!isStart && !isEnd) {
                                multiDayClasses = 'rounded-none opacity-90';
                                marginClass = '-mx-2.5';
                            }
                            else if (isStart && !isEnd) {
                                multiDayClasses = 'rounded-l rounded-r-none';
                                marginClass = '-mr-2.5';
                            }
                            else if (!isStart && isEnd) {
                                multiDayClasses = 'rounded-l-none rounded-r opacity-90';
                                marginClass = '-ml-2.5';
                            }
                        }

                        return (
                            <button
                                key={`${event.id}-${idx}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectJob?.(event);
                                }}
                                style={status === 'pending' ? styles.style : {}}
                                className={`text-[10px] px-1.5 py-0.5 mt-0.5 truncate ${styles.bg} text-white ${status === 'pending' ? 'opacity-90' : ''} ${multiDayClasses} ${marginClass} relative w-full text-left hover:opacity-80 cursor-pointer`}
                                title={event.title || event.description || 'Job'}
                            >
                                {formatTime(displayTime, timezone)} {isEvaluation ? 'Eval' : (event.customer?.name?.split(' ')[0] || 'Job')}
                            </button>
                        );
                    })}
                    </div>
                    {dayJobs.length > 2 && (
                        <p className="text-[10px] text-slate-400 font-medium shrink-0 mt-0.5">
                            +{dayJobs.length - 2} more
                        </p>
                    )}
                </div>
            </button>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-xs font-bold text-slate-500">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
                {days}
            </div>
        </div>
    );
};

// ============================================
// UNSCHEDULED JOBS PANEL
// ============================================

const UnscheduledJobsPanel = ({ jobs, onSelectJob, onOfferTimes }) => {
    // Only show jobs that have NO confirmed time AND NO pending offers
    // If pending, they show on calendar now (in amber)
    // FIXED: Also check scheduledStartTime field (BUG-020)
    const unscheduledJobs = jobs.filter(job =>
        !job.scheduledTime &&
        !job.scheduledStartTime &&
        !job.scheduledDate &&
        (!job.scheduling?.offeredSlots?.some(s => s.status === 'offered')) &&
        !['completed', 'cancelled'].includes(job.status)
    );

    // Jobs where customer requested new times (Urgent)
    const needsNewTimes = jobs.filter(job =>
        job.scheduling?.requestedNewTimes || job.schedulingStatus === 'needs_new_times'
    );

    // Jobs awaiting customer response (but maybe not showing on calendar if data malformed, keeping safe)
    // FIXED: Also check scheduledStartTime field (BUG-020)
    const awaitingResponse = jobs.filter(job =>
        (job.proposedTimes?.length > 0 || job.scheduling?.offeredSlots?.length > 0) &&
        !job.scheduledTime &&
        !job.scheduledStartTime &&
        !job.scheduling?.requestedNewTimes
    );

    if (unscheduledJobs.length === 0 && needsNewTimes.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                <CheckCircle size={32} className="mx-auto mb-2 text-emerald-500" />
                <p className="font-bold text-slate-800">All caught up!</p>
                <p className="text-sm text-slate-500">No jobs need scheduling</p>
            </div>
        );
    }

    const JobCard = ({ job, urgent }) => {
        const customerName = job.customer?.name || 'Customer';
        const address = job.serviceAddress?.formatted || job.customer?.address || '';

        return (
            <div className={`p-4 rounded-xl border ${urgent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 truncate" title={job.title || job.description || 'Service Request'}>
                            {job.title || job.description || 'Service Request'}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <User size={12} />
                            <span className="truncate" title={customerName}>{customerName}</span>
                        </div>
                    </div>
                    {job.total > 0 && (
                        <span className="text-sm font-bold text-emerald-600">
                            ${job.total.toLocaleString()}
                        </span>
                    )}
                </div>

                {address && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
                        <MapPin size={12} />
                        <span className="truncate" title={address}>{address}</span>
                    </div>
                )}

                {urgent && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-lg mb-3">
                        <AlertCircle size={12} />
                        <span className="font-medium">Customer requested new times</span>
                    </div>
                )}

                <div className="flex gap-2">
                    {onOfferTimes && (
                        <button
                            onClick={() => onOfferTimes(job)}
                            className="flex-1 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
                        >
                            <Calendar size={14} />
                            Offer Times
                        </button>
                    )}
                    <button
                        onClick={() => onSelectJob(job)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${onOfferTimes
                            ? 'text-slate-600 border border-slate-200 hover:bg-slate-50'
                            : 'flex-1 bg-emerald-600 text-white font-bold hover:bg-emerald-700'
                            }`}
                    >
                        {onOfferTimes ? 'Details' : 'View Details'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Urgent: Customer requested new times */}
            {needsNewTimes.length > 0 && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                    <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-3">
                        <AlertCircle size={18} />
                        Needs New Times ({needsNewTimes.length})
                    </h3>
                    <div className="space-y-3">
                        {needsNewTimes.map(job => (
                            <JobCard key={job.id} job={job} urgent />
                        ))}
                    </div>
                </div>
            )}

            {/* New Jobs */}
            {unscheduledJobs.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <Plus size={18} className="text-emerald-500" />
                        Ready to Schedule ({unscheduledJobs.length})
                    </h3>
                    <div className="space-y-3">
                        {unscheduledJobs.map(job => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN CALENDAR COMPONENT
// ============================================

export const ContractorCalendar = ({
    jobs = [],
    onSelectJob,
    onOfferTimes,
    onCreateJob,
    timezone,
    viewMode: controlledViewMode, // NEW: Controlled view mode
    onViewModeChange, // NEW: Handler for view mode change
    hideHeader = false // NEW: Option to hide the main header
}) => {
    const [internalViewMode, setInternalViewMode] = useState('week'); // 'week' | 'month'

    // Use controlled mode if provided, otherwise internal state
    const viewMode = controlledViewMode || internalViewMode;
    const setViewMode = (mode) => {
        if (onViewModeChange) {
            onViewModeChange(mode);
        } else {
            setInternalViewMode(mode);
        }
    };

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // PERFORMANCE: Create O(1) lookup map for events
    const eventMap = useMemo(() => {
        const map = new Map();
        const addToMap = (dateValue, event) => {
            if (!dateValue) return;
            // Normalize date to handle date-only strings properly
            const normalizedDate = normalizeDateForTimezone(dateValue, timezone);
            if (!normalizedDate) return;
            // Key must be in target timezone
            const key = formatDateInTimezone(normalizedDate, timezone, 'medium');
            if (!map.has(key)) map.set(key, []);

            // Deduplicate: Check if event already in list for this key
            const list = map.get(key);
            if (!list.some(e => e.id === event.id)) {
                list.push(event);
            }
        };

        jobs.forEach(event => {
            // 1. Confirmed Time
            // FIXED: Also check scheduledStartTime field (BUG-020)
            if (event.start || event.scheduledTime || event.scheduledStartTime || event.scheduledDate) {
                // Resolve the best date value, handling time-only scheduledTime strings
                let start = event.start || event.scheduledTime || event.scheduledStartTime || event.scheduledDate;
                // If scheduledTime is a time-only string (no date component), use scheduledDate instead
                if ((start === event.scheduledTime || start === event.scheduledStartTime) && typeof start === 'string' &&
                    !start.includes('T') && !/^\d{4}-\d{2}-\d{2}/.test(start)) {
                    start = event.scheduledDate || start;
                }
                addToMap(start, event);

                // 2. Multi-day Segments
                if (event.isMultiDay && event.multiDaySchedule?.segments) {
                    event.multiDaySchedule.segments.forEach(seg => {
                        addToMap(seg.date, event);
                    });
                }
            }

            // 3. Pending Slots
            if (event.scheduling?.offeredSlots?.length > 0) {
                event.scheduling.offeredSlots.forEach(slot => {
                    if (slot.status === 'offered') {
                        addToMap(slot.start, event);
                    }
                });
            }
        });

        return map;
    }, [jobs, timezone]);

    // Efficient lookup function passed to views
    const getEvents = (date) => {
        const key = getDateKey(date, timezone);
        return eventMap.get(key) || [];
    };

    // Navigation
    const navigatePrev = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setMonth(newDate.getMonth() - 1);
        }
        setCurrentDate(newDate);
    };

    const navigateNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today);
    };

    // Get month/year label
    const getHeaderLabel = () => {
        if (viewMode === 'week') {
            const weekDates = getWeekDates(currentDate, timezone || 'UTC');
            const startMonth = weekDates[0].toLocaleDateString('en-US', { month: 'short' });
            const endMonth = weekDates[6].toLocaleDateString('en-US', { month: 'short' });
            const year = weekDates[0].getFullYear();

            if (startMonth === endMonth) {
                return `${startMonth} ${year}`;
            }
            return `${startMonth} - ${endMonth} ${year}`;
        }
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // Count pure unscheduled (not pending, not assigned)
    const unscheduledCount = jobs.filter(job => {
        // Skip completed/cancelled
        if (['completed', 'cancelled'].includes(job.status)) return false;
        // Skip jobs with assigned crew
        if (job.assignedCrew?.length > 0 || job.assignedTechId) return false;
        // Skip jobs with a scheduled date/time
        // FIXED: Also check scheduledStartTime field (BUG-020)
        if (job.scheduledTime || job.scheduledStartTime || job.scheduledDate) return false;
        // Skip jobs with offered slots
        if (job.scheduling?.offeredSlots?.some(s => s.status === 'offered')) return false;
        return true;
    }).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            {!hideHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Schedule</h1>
                        <p className="text-slate-500">Manage your jobs and availability</p>
                    </div>
                    {onCreateJob && (
                        <button
                            onClick={onCreateJob}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2"
                        >
                            <Plus size={18} />
                            New Job
                        </button>
                    )}
                </div>
            )}

            {/* Calendar Controls */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={navigatePrev}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} className="text-slate-600" />
                    </button>
                    <button
                        onClick={navigateNext}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ChevronRight size={20} className="text-slate-600" />
                    </button>
                    <h2 className="text-lg font-bold text-slate-800 ml-2">
                        {getHeaderLabel()}
                    </h2>
                </div>

                {/* Only show Today/Week/Month when not in controlled mode (hideHeader=false) */}
                {!hideHeader && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Today
                        </button>

                        {/* View Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'week'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Week
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'month'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Month
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600">Awaiting Response</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-600">In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-slate-600">Site Visit / Evaluation</span>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar View */}
                <div className="lg:col-span-2">
                    {viewMode === 'week' ? (
                        <WeekView
                            currentDate={currentDate}
                            getEvents={getEvents}
                            onSelectDate={setSelectedDate}
                            onSelectJob={onSelectJob}
                            selectedDate={selectedDate}
                            timezone={timezone}
                        />
                    ) : (
                        <MonthView
                            currentDate={currentDate}
                            getEvents={getEvents}
                            onSelectDate={setSelectedDate}
                            onSelectJob={onSelectJob}
                            selectedDate={selectedDate}
                            timezone={timezone}
                        />
                    )}
                </div>

                {/* Unscheduled Jobs Sidebar */}
                <div className="lg:col-span-1">
                    <div className="sticky top-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                Needs Scheduling
                                {unscheduledCount > 0 && (
                                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {unscheduledCount}
                                    </span>
                                )}
                            </h3>
                        </div>
                        <UnscheduledJobsPanel
                            jobs={jobs}
                            onSelectJob={onSelectJob}
                            onOfferTimes={onOfferTimes}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContractorCalendar;
