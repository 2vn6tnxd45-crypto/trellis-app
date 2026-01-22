// src/features/contractor-pro/components/TeamCalendarView.jsx
// ============================================
// TEAM CALENDAR VIEW
// ============================================
// Shows all team members' schedules in a unified calendar view
// Supports daily and weekly views with drag-drop assignment

import React, { useState, useMemo, useCallback } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar, Clock, MapPin,
    User, Users, AlertCircle, CheckCircle, Sparkles,
    GripVertical, Filter, Eye, EyeOff, Loader2,
    Video, ClipboardList, MoreHorizontal, RotateCcw
} from 'lucide-react';
import { isRecurringJob } from '../../recurring';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';
import { parseDurationToMinutes } from '../lib/schedulingAI';
import { jobIsMultiDay, getSegmentForDate } from '../lib/multiDayUtils';
import { analyzeRescheduleImpact } from '../lib/scheduleImpactAnalysis';
import { useCascadeWarning } from './CascadeWarningModal';
import { isSameDayInTimezone, createDateInTimezone } from '../lib/timezoneUtils';

// ============================================
// HELPERS
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

const formatTime = (dateStr, timeZone) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone
    });
};

const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getHourFromDate = (dateStr, timeZone) => {
    if (!dateStr) return 8;
    // Create date object in target timezone to get correct hour
    const date = new Date(dateStr);
    if (timeZone) {
        const parts = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone
        }).formatToParts(date);
        const hourPart = parts.find(p => p.type === 'hour');
        return parseInt(hourPart.value) % 24;
    }
    return date.getHours();
};

// ============================================
// EVENT STATUS STYLES
// ============================================

const STATUS_STYLES = {
    confirmed: { bg: 'bg-emerald-500', bgLight: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    pending: { bg: 'bg-amber-500', bgLight: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    in_progress: { bg: 'bg-blue-500', bgLight: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    evaluation: { bg: 'bg-purple-500', bgLight: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    unassigned: { bg: 'bg-slate-400', bgLight: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
    multi_day: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' }
};

const getEventStatus = (event) => {
    if (event.type === 'evaluation') return 'evaluation';
    if (jobIsMultiDay(event)) return 'multi_day';
    if (event.status === 'scheduled' || event.scheduledTime) return 'confirmed';
    if (event.status === 'in_progress') return 'in_progress';
    if (event.scheduling?.offeredSlots?.some(s => s.status === 'offered')) return 'pending';
    return 'unassigned';
};

// Get jobs for a date including multi-day segment info
const getJobsForDateWithMultiDay = (jobs, date, timeZone) => {
    return jobs.filter(job => {
        // Regular scheduled date check - normalize to handle date-only strings
        const rawJobDate = job.scheduledTime || job.scheduledDate;
        if (rawJobDate) {
            const normalizedJobDate = normalizeDateForTimezone(rawJobDate, timeZone);
            if (normalizedJobDate && isSameDayInTimezone(normalizedJobDate, date, timeZone)) {
                return true;
            }
        }

        // Multi-day segment check
        if (jobIsMultiDay(job)) {
            const { isInSchedule } = getSegmentForDate(date, job.multiDaySchedule);
            return isInSchedule;
        }

        return false;
    }).map(job => {
        // Add multi-day context
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
// TECH COLUMN HEADER
// ============================================

const TechColumnHeader = ({ tech, jobCount, isVisible, onToggleVisibility }) => {
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const worksToday = tech.workingHours?.[dayName]?.enabled !== false;

    return (
        <div className="sticky top-0 bg-white z-10 border-b border-slate-200 p-2">
            <div className="flex items-center gap-2">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: tech.color || '#10B981' }}
                >
                    {tech.name?.charAt(0) || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{tech.name}</p>
                    <p className="text-xs text-slate-500">
                        {jobCount} job{jobCount !== 1 ? 's' : ''}
                        {!worksToday && <span className="ml-1 text-amber-600">(Off today)</span>}
                    </p>
                </div>
                <button
                    onClick={() => onToggleVisibility(tech.id)}
                    className="p-1 hover:bg-slate-100 rounded"
                    title={isVisible ? 'Hide column' : 'Show column'}
                >
                    {isVisible ? <Eye size={14} className="text-slate-400" /> : <EyeOff size={14} className="text-slate-300" />}
                </button>
            </div>
        </div>
    );
};

// ============================================
// EVENT CARD (for calendar cells)
// ============================================

const EventCard = ({ event, onClick, compact = false, isDragging, onDragStart, onDragEnd, timeZone }) => {
    const status = getEventStatus(event);
    const styles = STATUS_STYLES[status];
    const isEvaluation = event.type === 'evaluation';
    const isMultiDay = event._multiDayInfo != null;
    const isRecurring = isRecurringJob(event);
    const duration = event.duration || parseDurationToMinutes(event.estimatedDuration) || 60;

    return (
        <div
            draggable={!isEvaluation}
            onDragStart={(e) => {
                if (isEvaluation) return;
                e.dataTransfer.setData('eventId', event.id);
                e.dataTransfer.setData('eventData', JSON.stringify(event));
                onDragStart?.(event);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onClick?.(event)}
            className={`
                ${styles.bgLight} ${styles.border} border rounded-lg p-2 cursor-pointer
                hover:shadow-md transition-all text-left w-full
                ${isDragging ? 'opacity-50' : ''}
                ${!isEvaluation ? 'cursor-grab active:cursor-grabbing' : ''}
            `}
        >
            <div className="flex items-start gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${styles.bg} mt-1.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                        <p className={`font-medium ${styles.text} text-xs truncate`}>
                            {formatTime(event.start || event.scheduledTime, timeZone)}
                        </p>
                        {isRecurring && (
                            <span className="text-[9px] bg-emerald-200 text-emerald-700 px-1 py-0.5 rounded font-bold flex items-center gap-0.5">
                                <RotateCcw size={8} />
                            </span>
                        )}
                        {isMultiDay && (
                            <span className="text-[9px] bg-indigo-200 text-indigo-700 px-1 py-0.5 rounded font-bold">
                                {event._multiDayInfo.label}
                            </span>
                        )}
                    </div>
                    <p className="font-bold text-slate-800 text-sm truncate mt-0.5">
                        {event.title || event.description || 'Job'}
                    </p>
                    {!compact && (
                        <>
                            <p className="text-xs text-slate-500 truncate">
                                {event.customer?.name || 'Customer'}
                            </p>
                            {isEvaluation && (
                                <div className="flex items-center gap-1 mt-1">
                                    {event.evaluationType === 'virtual' ? (
                                        <Video size={10} className="text-purple-600" />
                                    ) : (
                                        <ClipboardList size={10} className="text-purple-600" />
                                    )}
                                    <span className="text-[10px] text-purple-600 font-medium">
                                        {event.evaluationType === 'virtual' ? 'Virtual' : 'Site Visit'}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <span className="text-[10px] text-slate-400">{duration}m</span>
            </div>
        </div>
    );
};

// ============================================
// TIME SLOT CELL
// ============================================

const TimeSlotCell = ({
    date,
    hour,
    tech,
    events,
    isDropTarget,
    onDrop,
    onDragOver,
    onDragLeave,
    onEventClick,
    timeZone // Add timeZone prop
}) => {
    // Filter events for this hour
    const slotEvents = events.filter(event => {
        const eventHour = getHourFromDate(event.start || event.scheduledTime, timeZone);
        return eventHour === hour;
    });

    // Check if within tech's working hours
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech?.workingHours?.[dayName];
    const isWorkingHour = techHours?.enabled !== false;

    let startHour = 8, endHour = 17;
    if (techHours?.start) startHour = parseInt(techHours.start.split(':')[0]);
    if (techHours?.end) endHour = parseInt(techHours.end.split(':')[0]);

    const isWithinWorkingHours = hour >= startHour && hour < endHour && isWorkingHour;

    return (
        <div
            onDrop={(e) => onDrop(e, tech?.id, date, hour)}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`
                min-h-[50px] border-b border-r border-slate-100 p-1 transition-colors
                ${isDropTarget ? 'bg-emerald-100 border-emerald-300' : ''}
                ${isWithinWorkingHours ? 'bg-white' : 'bg-slate-50/50'}
            `}
        >
            {slotEvents.map(event => (
                <EventCard
                    key={event.id}
                    event={event}
                    onClick={onEventClick}
                    compact
                    timeZone={timeZone}
                />
            ))}
        </div>
    );
};

// ============================================
// UNASSIGNED JOBS SIDEBAR
// ============================================

const UnassignedJobsSidebar = ({ jobs, evaluations, onEventClick, draggedEvent, onDragStart, onDragEnd }) => {
    const unassignedJobs = jobs.filter(job =>
        !job.assignedTo && !job.assignedTechId &&
        !['completed', 'cancelled'].includes(job.status)
    );

    const unscheduledEvaluations = evaluations.filter(evaluation =>
        !evaluation.assignedTo &&
        evaluation.status !== 'cancelled' &&
        evaluation.status !== 'completed'
    );

    const allUnassigned = [
        ...unassignedJobs.map(j => ({ ...j, _type: 'job' })),
        ...unscheduledEvaluations.map(e => ({ ...e, type: 'evaluation', _type: 'evaluation' }))
    ];

    if (allUnassigned.length === 0) return null;

    return (
        <div className="w-64 shrink-0 bg-amber-50 border-l border-amber-200 p-3 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-amber-600" />
                <h3 className="font-bold text-amber-800 text-sm">Unassigned ({allUnassigned.length})</h3>
            </div>
            <div className="space-y-2">
                {allUnassigned.map(item => (
                    <EventCard
                        key={item.id}
                        event={item}
                        onClick={onEventClick}
                        isDragging={draggedEvent?.id === item.id}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                ))}
            </div>
        </div>
    );
};

export const TeamCalendarView = ({
    jobs = [],
    evaluations = [],
    teamMembers = [],
    preferences = {},
    onJobClick,
    onEvaluationClick,
    onJobUpdate
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'
    const [visibleTechs, setVisibleTechs] = useState(new Set(teamMembers.map(t => t.id)));
    const [draggedEvent, setDraggedEvent] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [assigning, setAssigning] = useState(false);

    // Add warning modal hook
    const { showWarning, WarningModal } = useCascadeWarning();

    // Get business timezone
    const businessTimezone = preferences?.businessTimezone || 'America/Los_Angeles';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Navigation
    const navigatePrev = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setDate(newDate.getDate() - 1);
        }
        setCurrentDate(newDate);
    };

    const navigateNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        setCurrentDate(newDate);
    };

    const goToToday = () => setCurrentDate(new Date());

    // Toggle tech visibility
    const toggleTechVisibility = (techId) => {
        setVisibleTechs(prev => {
            const next = new Set(prev);
            if (next.has(techId)) {
                next.delete(techId);
            } else {
                next.add(techId);
            }
            return next;
        });
    };

    // Get events for a specific tech and date (including multi-day job segments)
    const getEventsForTechAndDate = useCallback((techId, date) => {
        // Get jobs for this date (including multi-day segments)
        const dateJobs = getJobsForDateWithMultiDay(jobs, date, businessTimezone);

        // Filter to just this tech's jobs
        const techJobs = dateJobs.filter(job => {
            return job.assignedTo === techId || job.assignedTechId === techId;
        });

        const techEvaluations = evaluations.filter(evaluation => {
            const isAssigned = evaluation.assignedTo === techId;
            const evalDate = evaluation.scheduling?.scheduledFor;
            return isAssigned && evalDate && isSameDayInTimezone(evalDate, date, businessTimezone);
        }).map(e => ({
            ...e,
            type: 'evaluation',
            start: e.scheduling?.scheduledFor,
            duration: e.scheduling?.duration || 30
        }));

        return [...techJobs, ...techEvaluations];
    }, [jobs, evaluations, businessTimezone]);

    // Working hours
    const workingHours = useMemo(() => {
        let minHour = 7, maxHour = 19;

        teamMembers.forEach(tech => {
            if (tech.workingHours) {
                Object.values(tech.workingHours).forEach(day => {
                    if (day?.enabled && day?.start && day?.end) {
                        const start = parseInt(day.start.split(':')[0]);
                        const end = parseInt(day.end.split(':')[0]);
                        if (start < minHour) minHour = start;
                        if (end > maxHour) maxHour = end;
                    }
                });
            }
        });

        const hours = [];
        for (let h = minHour; h <= maxHour; h++) {
            hours.push(h);
        }
        return hours;
    }, [teamMembers]);

    // Drag and drop handlers
    const handleDragStart = (event) => {
        setDraggedEvent(event);
    };

    const handleDragEnd = () => {
        setDraggedEvent(null);
        setDropTarget(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (techId, date, hour) => {
        setDropTarget({ techId, date, hour });
    };

    const handleDragLeave = () => {
        setDropTarget(null);
    };

    const handleDrop = async (e, techId, date, hour) => {
        e.preventDefault();
        setDropTarget(null);

        if (!draggedEvent || !techId) {
            setDraggedEvent(null);
            return;
        }

        // Don't allow assigning evaluations via drag-drop for now
        if (draggedEvent.type === 'evaluation') {
            toast.error('Evaluations must be assigned through the evaluation management screen');
            setDraggedEvent(null);
            return;
        }

        // Calculate new time
        const scheduledDate = new Date(date);
        scheduledDate.setHours(hour, 0, 0, 0);

        // Analyze impact
        const impact = analyzeRescheduleImpact(
            draggedEvent,
            scheduledDate,
            jobs,
            teamMembers.find(t => t.id === techId)?.workingHours
        );

        if (impact.hasConflicts || impact.severity === 'high' || impact.severity === 'medium') {
            showWarning(
                impact,
                draggedEvent,
                'reschedule',
                async () => {
                    await performAssignment(draggedEvent, techId, scheduledDate);
                }
            );
            return;
        }

        // Proceed directly if no conflicts
        await performAssignment(draggedEvent, techId, scheduledDate);
    };

    const performAssignment = async (event, techId, scheduledDate) => {
        setAssigning(true);
        try {
            // Create scheduled time (ensure it's preserved)

            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, event.id);
            await updateDoc(jobRef, {
                assignedTo: techId,
                assignedTechId: techId,
                assignedTechName: teamMembers.find(t => t.id === techId)?.name || 'Technician',
                scheduledTime: scheduledDate.toISOString(),
                scheduledDate: scheduledDate.toISOString(),
                status: 'scheduled',
                updatedAt: serverTimestamp()
            });

            toast.success(`Job assigned to ${teamMembers.find(t => t.id === techId)?.name}`);
            onJobUpdate?.();
        } catch (error) {
            console.error('Failed to assign job:', error);
            toast.error('Failed to assign job');
        } finally {
            setAssigning(false);
            setDraggedEvent(null);
        }
    };

    // Handle event clicks
    const handleEventClick = (event) => {
        if (event.type === 'evaluation') {
            onEvaluationClick?.(event._original || event);
        } else {
            onJobClick?.(event);
        }
    };

    // Visible team members
    const displayTechs = teamMembers.filter(t => visibleTechs.has(t.id));

    // Date label
    const dateLabel = viewMode === 'week'
        ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : formatDate(currentDate);

    return (
        <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
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
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">{dateLabel}</h2>
                        <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        >
                            Today
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('day')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'day'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Day
                            </button>
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'week'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Week
                            </button>
                        </div>

                        {/* Team Filter */}
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-slate-500" />
                            <span className="text-sm text-slate-600">
                                {displayTechs.length}/{teamMembers.length} shown
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tech Visibility Toggles */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {teamMembers.map(tech => (
                        <button
                            key={tech.id}
                            onClick={() => toggleTechVisibility(tech.id)}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0
                                ${visibleTechs.has(tech.id)
                                    ? 'bg-opacity-20 border-2'
                                    : 'bg-slate-100 text-slate-400 border-2 border-transparent'
                                }
                            `}
                            style={{
                                backgroundColor: visibleTechs.has(tech.id) ? `${tech.color}30` : undefined,
                                borderColor: visibleTechs.has(tech.id) ? tech.color : undefined,
                                color: visibleTechs.has(tech.id) ? tech.color : undefined
                            }}
                        >
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tech.color }}
                            />
                            {tech.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Calendar Area */}
                <div className="flex-1 overflow-auto">
                    {viewMode === 'day' ? (
                        /* Day View */
                        <div className="min-w-max">
                            {/* Tech Headers */}
                            <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
                                <div className="w-16 shrink-0 bg-slate-50 border-r border-slate-200" />
                                {displayTechs.map(tech => (
                                    <div key={tech.id} className="w-48 shrink-0 border-r border-slate-200">
                                        <TechColumnHeader
                                            tech={tech}
                                            jobCount={getEventsForTechAndDate(tech.id, currentDate).length}
                                            isVisible={visibleTechs.has(tech.id)}
                                            onToggleVisibility={toggleTechVisibility}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Time Rows */}
                            {workingHours.map(hour => (
                                <div key={hour} className="flex">
                                    {/* Time Label */}
                                    <div className="w-16 shrink-0 bg-slate-50 border-r border-b border-slate-200 p-2 text-xs text-slate-500 text-right">
                                        {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                                    </div>
                                    {/* Tech Cells */}
                                    {displayTechs.map(tech => {
                                        const isTarget = dropTarget &&
                                            dropTarget.techId === tech.id &&
                                            dropTarget.hour === hour &&
                                            isSameDayInTimezone(dropTarget.date, currentDate, businessTimezone);

                                        return (
                                            <div key={tech.id} className="w-48 shrink-0">
                                                <TimeSlotCell
                                                    date={currentDate}
                                                    hour={hour}
                                                    tech={tech}
                                                    events={getEventsForTechAndDate(tech.id, currentDate)}
                                                    isDropTarget={isTarget}
                                                    onDrop={handleDrop}
                                                    onDragOver={(e) => {
                                                        handleDragOver(e);
                                                        handleDragEnter(tech.id, currentDate, hour);
                                                    }}
                                                    onDragLeave={handleDragLeave}
                                                    onEventClick={handleEventClick}
                                                    timeZone={businessTimezone}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Week View */
                        <div className="min-w-max">
                            {displayTechs.map(tech => {
                                const weekDates = getWeekDates(currentDate);

                                return (
                                    <div key={tech.id} className="border-b border-slate-200">
                                        {/* Tech Row Header */}
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-100 sticky left-0">
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                                style={{ backgroundColor: tech.color }}
                                            >
                                                {tech.name?.charAt(0)}
                                            </div>
                                            <span className="font-bold text-slate-800">{tech.name}</span>
                                        </div>

                                        {/* Week Days */}
                                        <div className="flex">
                                            {weekDates.map((date, idx) => {
                                                const events = getEventsForTechAndDate(tech.id, date);
                                                const isToday = isSameDayInTimezone(date, today, businessTimezone);

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`
                                                            flex-1 min-w-[120px] p-2 border-r border-slate-100
                                                            ${isToday ? 'bg-emerald-50' : 'bg-white'}
                                                        `}
                                                    >
                                                        <p className={`text-xs font-medium mb-2 ${isToday ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                            {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                                                        </p>
                                                        <div className="space-y-1">
                                                            {events.slice(0, 3).map(event => (
                                                                <EventCard
                                                                    key={event.id}
                                                                    event={event}
                                                                    onClick={handleEventClick}
                                                                    compact
                                                                    timeZone={businessTimezone}
                                                                />
                                                            ))}
                                                            {events.length > 3 && (
                                                                <p className="text-xs text-slate-400 text-center">
                                                                    +{events.length - 3} more
                                                                </p>
                                                            )}
                                                            {events.length === 0 && (
                                                                <p className="text-xs text-slate-300 text-center py-2">
                                                                    No events
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Unassigned Jobs Sidebar */}
                <UnassignedJobsSidebar
                    jobs={jobs}
                    evaluations={evaluations}
                    onEventClick={handleEventClick}
                    draggedEvent={draggedEvent}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                />
            </div>

            {/* Assigning Overlay */}
            {assigning && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-lg">
                        <Loader2 size={18} className="animate-spin text-emerald-600" />
                        <span className="font-medium text-slate-700">Assigning job...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamCalendarView;
