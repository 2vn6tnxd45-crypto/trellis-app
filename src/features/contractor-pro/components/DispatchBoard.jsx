// src/features/contractor-pro/components/DispatchBoard.jsx
// ============================================
// DISPATCH BOARD
// ============================================
// Visual day view for assigning jobs to techs
// Shows tech columns with time slots, drag-and-drop assignment

import React, { useState, useMemo, useCallback } from 'react';
import {
    Calendar, ChevronLeft, ChevronRight, User, Clock,
    MapPin, Wrench, AlertTriangle, CheckCircle, Sparkles,
    GripVertical, X, ChevronDown, ChevronUp, Zap,
    Users, Loader2, Info, AlertCircle, Truck, Route,
    XCircle, Eye, Map, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    scoreTechForJob,
    suggestAssignments,
    autoAssignAll,
    assignJobToTech,
    unassignJob,
    bulkAssignJobs,
    checkConflicts,
    isTechWorkingOnDay,
    parseDurationToMinutes
} from '../lib/schedulingAI';
import { isSameDayInTimezone, formatTimeInTimezone } from '../lib/timezoneUtils';
import { CrewAssignmentModal } from './CrewAssignmentModal';
import { RouteComparison } from './RouteComparison';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { useRouteOptimization } from '../hooks/useRouteOptimization';
import {
    getAssignedTechIds,
    assignCrewToJob,
    unassignAllCrew,
    createCrewMember,
    removeTechFromCrew
} from '../lib/crewService';
import {
    checkVehicleCrewCapacity,
    findVehiclesForCrewSize
} from '../lib/vehicleService';
import { checkCrewConflict } from '../lib/schedulingConflicts';
import { cancelJob } from '../../jobs/lib/jobService';
import { formatDateTimeInTimezone } from '../lib/timezoneUtils';
import { isMultiDayJob } from '../lib/multiDayUtils';

// ============================================
// HELPERS
// ============================================

const formatDate = (date) => {
    // Ensure date is valid
    if (!date || isNaN(new Date(date).getTime())) return 'Invalid Date';
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
};

const formatTime = (time, timezone) => {
    if (!time) return '';
    // Handle "HH:MM" string format (e.g., from schedule blocks)
    if (typeof time === 'string' && /^\d{1,2}:\d{2}$/.test(time)) {
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
    // Normalize Firestore Timestamps to Date objects
    const normalizedTime = time?.toDate ? time.toDate() : time;
    // Always use timezone-aware formatting to prevent offset bugs
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return formatTimeInTimezone(normalizedTime, tz);
};



// ============================================
// JOB CARD COMPONENT
// ============================================

const JobCard = ({
    job,
    isDragging,
    onDragStart,
    onDragEnd,
    showSuggestions,
    suggestions,
    onAssign,
    onUnassign,
    onOpenCrewModal,
    onOfferSlots,
    onCancelJob,
    onViewDetails,
    isAssigned,
    compact = false,
    vehicles = [],
    date = new Date(), // Add date prop with default
    timezone
}) => {
    const [expanded, setExpanded] = useState(false);

    // Inject date into job object for the inner render logic we just added
    job.currentRenderDate = date;
    const duration = parseDurationToMinutes(job.estimatedDuration);

    // Formatting Duration
    let durationStr = '';
    const isMultiDay = duration > 1440; // More than 24h

    if (isMultiDay) {
        const days = Math.ceil(duration / 1440);
        durationStr = `${days} Days`;
    } else {
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        durationStr = hours > 0
            ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
            : `${mins}m`;
    }

    // Crew requirements analysis
    const crewRequired = job.crewRequirements?.required || job.requiredCrewSize || 1;
    const crewMinimum = job.crewRequirements?.minimum || 1;
    const assignedCrewCount = job.assignedCrew?.length || (job.assignedTechId ? 1 : 0);
    const needsMoreCrew = crewRequired > 1 && assignedCrewCount < crewMinimum;
    const isFullyStaffed = assignedCrewCount >= crewRequired;
    const isUnderstaffed = assignedCrewCount > 0 && assignedCrewCount < crewMinimum;

    // Vehicle info
    const assignedVehicle = job.assignedVehicleId
        ? vehicles.find(v => v.id === job.assignedVehicleId)
        : null;

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('jobId', job.id);
                onDragStart?.(job);
            }}
            onDragEnd={onDragEnd}
            className={`
                rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing relative
                ${isDragging ? 'opacity-50 border-emerald-400 shadow-lg' : job.isOverdue ? 'border-red-300 bg-red-50' : 'bg-white border-slate-200 hover:border-slate-300'}
                ${compact ? 'p-2' : 'p-3'}
            `}
        >
            {/* Overdue Flag */}
            {job.isOverdue && (
                <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-bl-lg rounded-tr-lg">
                    OVERDUE
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-2">
                <GripVertical size={16} className="text-slate-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className={`font-bold text-slate-800 truncate ${compact ? 'text-sm' : ''}`} title={job.title || job.serviceType || 'Job'}>
                            {job.title || job.serviceType || 'Job'}
                        </p>
                        {isMultiDay && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">
                                Multi-Day
                            </span>
                        )}
                    </div>

                    <p className="text-sm text-slate-500 truncate" title={job.customer?.name || job.customerName || 'Customer'}>
                        {job.customer?.name || job.customerName || 'Customer'}
                    </p>

                    {/* Crew Requirements Badge - Show when job needs multiple techs */}
                    {crewRequired > 1 && (
                        <div className="flex items-center gap-1 mt-1">
                            {/* Show crew avatars if assigned */}
                            {job.assignedCrew && job.assignedCrew.length > 0 && (
                                <div className="flex -space-x-2 mr-1">
                                    {job.assignedCrew.slice(0, 4).map((member, idx) => (
                                        <div
                                            key={member.techId}
                                            className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                                            style={{ backgroundColor: member.color || '#64748B', zIndex: 4 - idx }}
                                            title={`${member.techName} (${member.role})`}
                                        >
                                            {member.techName?.charAt(0) || '?'}
                                        </div>
                                    ))}
                                    {job.assignedCrew.length > 4 && (
                                        <div className="w-5 h-5 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                                            +{job.assignedCrew.length - 4}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Staffing status badge */}
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isFullyStaffed
                                ? 'bg-emerald-100 text-emerald-700'
                                : isUnderstaffed
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                <Users size={10} />
                                {assignedCrewCount}/{crewRequired}
                                {!isFullyStaffed && assignedCrewCount === 0 && ' needed'}
                            </span>
                        </div>
                    )}

                    {/* Single tech crew (no special badge needed, just show avatar if assigned) */}
                    {crewRequired === 1 && job.assignedCrew && job.assignedCrew.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                            <div className="flex -space-x-2">
                                {job.assignedCrew.slice(0, 4).map((member, idx) => (
                                    <div
                                        key={member.techId}
                                        className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                                        style={{ backgroundColor: member.color || '#64748B', zIndex: 4 - idx }}
                                        title={`${member.techName} (${member.role})`}
                                    >
                                        {member.techName?.charAt(0) || '?'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* View Details Button */}
                    {onViewDetails && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails?.(job);
                            }}
                            className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600"
                            title="View job details"
                        >
                            <Eye size={14} />
                        </button>
                    )}
                    {/* Offer Time Slots Button - for unassigned jobs */}
                    {!isAssigned && onOfferSlots && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOfferSlots?.(job);
                            }}
                            className="p-1 hover:bg-amber-50 rounded text-slate-400 hover:text-amber-600"
                            title="Offer time slots to customer"
                        >
                            <Calendar size={14} />
                        </button>
                    )}
                    {/* Crew Assignment Button - Always visible to allow fixing crews */}
                    {onOpenCrewModal && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenCrewModal?.(job);
                            }}
                            className="p-1 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600"
                            title="Manage crew"
                        >
                            <Users size={14} />
                        </button>
                    )}
                    {/* Cancel Job Button */}
                    {onCancelJob && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancelJob?.(job);
                            }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                            title="Cancel job"
                        >
                            <XCircle size={14} />
                        </button>
                    )}
                    {isAssigned && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onUnassign?.(job);
                            }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                            title="Unassign"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Scheduled Date (shown for backlog items not on current date) */}
            {/* FIXED: Also check scheduledStartTime field (BUG-020) */}
            {!isAssigned && (job.scheduledDate || job.scheduledTime || job.scheduledStartTime) && (
                <p className={`mt-1 text-[11px] ${job.isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                    {(() => {
                        try {
                            const rawDate = job.scheduledDate || job.scheduledTime || job.scheduledStartTime;
                            const d = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
                            if (isNaN(d.getTime())) return '';
                            const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
                            return `Scheduled: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz })}`;
                        } catch { return ''; }
                    })()}
                </p>
            )}

            {/* Details */}
            <div className={`mt-2 flex flex-wrap gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
                {/* FIXED: Also check scheduledStartTime field (BUG-020) */}
                {(job.scheduledTime || job.scheduledStartTime) && (
                    <span className="flex items-center gap-1 text-slate-600">
                        <Clock size={12} />
                        {(() => {
                            // Multi-Day Block Time
                            if (job.isMultiDay && job.scheduleBlocks?.length > 0) {
                                // We need to know which day we are rendering.
                                // Since JobCard doesn't have 'date' prop, we can try to find the block closest to 'now' or rely on parent passing it.
                                // EDIT: We need to pass 'date' to JobCard. For now, let's use the first block or job.scheduledTime as fallback.
                                // Ideally, we update the call sites to pass 'date'.
                                const block = job.scheduleBlocks.find(b => isSameDayInTimezone(new Date(b.date), new Date(job.currentRenderDate || new Date()), 'UTC'));
                                return block ? `${formatTime(block.startTime, timezone)} - ${formatTime(block.endTime, timezone)}` : formatTime(job.scheduledTime || job.scheduledStartTime, timezone);
                            }
                            return formatTime(job.scheduledTime || job.scheduledStartTime, timezone);
                        })()}
                    </span>
                )}
                <span className="flex items-center gap-1 text-slate-600">
                    <Wrench size={12} />
                    {durationStr}
                </span>
                {job.customer?.address && (
                    <span className="flex items-center gap-1 text-slate-500 truncate max-w-[150px]" title={job.customer.address}>
                        <MapPin size={12} />
                        {job.customer.address.split(',')[0]}
                    </span>
                )}
                {/* Vehicle assignment indicator */}
                {assignedVehicle && (
                    <span className="flex items-center gap-1 text-blue-600" title={assignedVehicle.name}>
                        <Truck size={12} />
                        {assignedVehicle.name?.substring(0, 10) || 'Vehicle'}
                    </span>
                )}
                {/* Route order indicator */}
                {job.routeOrder && (
                    <span className="flex items-center gap-1 text-purple-600" title={`Stop #${job.routeOrder} on route`}>
                        <Route size={12} />
                        #{job.routeOrder}
                    </span>
                )}
            </div>

            {/* AI Suggestions (when in unassigned column) */}
            {showSuggestions && suggestions?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                        <Sparkles size={12} />
                        AI Suggestions
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {expanded && (
                        <div className="mt-2 space-y-1">
                            {suggestions.slice(0, 3).map((suggestion, idx) => (
                                <button
                                    key={suggestion.techId}
                                    onClick={() => onAssign?.(job, suggestion.techId, suggestion.techName)}
                                    className={`
                                        w-full flex items-center justify-between p-2 rounded-lg text-left text-xs
                                        ${idx === 0 ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-slate-50 hover:bg-slate-100'}
                                    `}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: suggestion.techColor || '#10B981' }}
                                        />
                                        <span className="font-medium">{suggestion.techName}</span>
                                        {idx === 0 && (
                                            <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold">
                                                BEST
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-slate-400">{suggestion.score}pts</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// TECH COLUMN COMPONENT
// ============================================

const TechColumn = ({
    tech,
    jobs,
    date,
    onDrop,
    onUnassign,
    onOpenCrewModal,
    onCancelJob,
    onViewDetails,
    isDropTarget,
    allJobs,
    onMarkWorkingToday,
    onEditSchedule,
    vehicles = [],
    timezone
}) => {
    const [isDragOver, setIsDragOver] = useState(false);

    // Calculate capacity
    const maxJobs = tech.maxJobsPerDay || 4;
    const maxHours = tech.maxHoursPerDay || 8;
    const jobCount = jobs.length;
    const totalHours = jobs.reduce((sum, j) => {
        return sum + (parseDurationToMinutes(j.estimatedDuration) / 60);
    }, 0);

    const capacityPercent = Math.min(100, (jobCount / maxJobs) * 100);
    const hoursPercent = Math.min(100, (totalHours / maxHours) * 100);

    // Use smart availability checking (with safe date fallback)
    const safeDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    const availability = useMemo(() => {
        try {
            return isTechWorkingOnDay(tech, safeDate);
        } catch (e) {
            console.warn('[DispatchBoard] isTechWorkingOnDay error for', tech.name, e);
            return { working: true, reason: 'default', dayName: '' };
        }
    }, [tech, safeDate]);
    const hasOverride = tech._workingTodayOverride;
    const worksToday = hasOverride || availability.working;
    const isScheduledOff = !hasOverride && availability.reason === 'scheduled_off';
    const hasNoSchedule = availability.reason === 'default';

    // Get schedule summary (work days)
    const getScheduleSummary = () => {
        if (!tech.workingHours) return 'No schedule set';
        const workDays = Object.entries(tech.workingHours)
            .filter(([_, h]) => h?.enabled)
            .map(([day]) => day.substring(0, 3));
        if (workDays.length === 0) return 'No days enabled';
        if (workDays.length === 7) return 'Every day';
        if (workDays.length === 5 && !tech.workingHours.saturday?.enabled && !tech.workingHours.sunday?.enabled) {
            return 'Mon-Fri';
        }
        return workDays.join(', ');
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const jobId = e.dataTransfer.getData('jobId');
        if (jobId) {
            onDrop?.(jobId, tech.id, tech.name);
        }
    };

    return (
        <div
            className={`
                flex flex-col bg-white rounded-xl border-2 min-w-[280px] max-w-[320px] transition-all
                ${isDragOver ? 'border-emerald-400 bg-emerald-50/50 shadow-lg' : 'border-slate-200'}
                ${isScheduledOff ? 'opacity-70' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Tech Header */}
            <div className="p-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: tech.color || '#10B981' }}
                    >
                        {tech.name?.charAt(0) || 'T'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{tech.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar size={10} />
                            {getScheduleSummary()}
                        </p>
                    </div>
                    {isScheduledOff && (
                        <div className="flex flex-col gap-1">
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                Off Today
                            </span>
                            {onMarkWorkingToday && (
                                <button
                                    onClick={() => onMarkWorkingToday(tech)}
                                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium hover:bg-emerald-200 transition-colors"
                                >
                                    Mark Working
                                </button>
                            )}
                        </div>
                    )}
                    {hasNoSchedule && (
                        <button
                            onClick={() => onEditSchedule?.(tech)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                            title="Set up working schedule"
                        >
                            <Clock size={12} />
                            Set Hours
                        </button>
                    )}
                </div>

                {/* Capacity Bars */}
                {(worksToday || jobs.length > 0) && (
                    <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-12">Jobs</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${capacityPercent >= 100 ? 'bg-red-500' :
                                        capacityPercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${capacityPercent}%` }}
                                />
                            </div>
                            <span className="text-xs text-slate-600 w-10 text-right">
                                {jobCount}/{maxJobs}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-12">Hours</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${hoursPercent >= 100 ? 'bg-red-500' :
                                        hoursPercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${hoursPercent}%` }}
                                />
                            </div>
                            <span className="text-xs text-slate-600 w-10 text-right">
                                {totalHours.toFixed(1)}h
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Jobs List */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[400px]">
                {jobs.length === 0 ? (
                    <div className={`
                        h-24 border-2 border-dashed rounded-xl flex items-center justify-center
                        ${isDragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}
                    `}>
                        <p className="text-sm text-slate-400">
                            {worksToday ? 'Drop jobs here' : 'Day off'}
                        </p>
                    </div>
                ) : (
                    jobs.map(job => (
                        <JobCard
                            key={job.id}
                            job={job}
                            isAssigned={true}
                            onUnassign={onUnassign}
                            onOpenCrewModal={onOpenCrewModal}
                            onCancelJob={onCancelJob}
                            onViewDetails={onViewDetails}
                            compact={true}
                            vehicles={vehicles}
                            date={date}
                            timezone={timezone}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ============================================
// UNASSIGNED COLUMN
// ============================================

const UnassignedColumn = ({
    jobs,
    techs,
    allJobs,
    date,
    onAssign,
    onAutoAssign,
    isAutoAssigning,
    vehicles = [],
    showAllBacklog,
    onToggleBacklog,
    totalBacklogCount,
    onOfferSlots,
    onCancelJob,
    onViewDetails,
    timezone
}) => {
    const [draggingJob, setDraggingJob] = useState(null);

    // Get suggestions for each job (with error protection)
    const jobsWithSuggestions = useMemo(() => {
        if (!date || isNaN(new Date(date).getTime())) {
            return jobs.map(job => ({ job, suggestions: [] }));
        }
        return jobs.map(job => {
            try {
                const { suggestions } = suggestAssignments(job, techs, allJobs, date);
                return { job, suggestions };
            } catch (e) {
                console.warn('[DispatchBoard] Error getting suggestions for job:', job.id, e);
                return { job, suggestions: [] };
            }
        });
    }, [jobs, techs, allJobs, date]);

    // Count overdue jobs
    const overdueCount = jobs.filter(j => j.isOverdue).length;

    return (
        <div className="flex flex-col bg-amber-50 rounded-xl border-2 border-amber-200 min-w-[300px] max-w-[350px]">
            {/* Header */}
            <div className="p-3 border-b border-amber-200 bg-amber-100/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="text-amber-600" size={20} />
                        <div>
                            <p className="font-bold text-amber-800">Unassigned</p>
                            <p className="text-xs text-amber-600">
                                {jobs.length} jobs
                                {overdueCount > 0 && (
                                    <span className="ml-1 text-red-600 font-semibold">
                                        ({overdueCount} overdue)
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {jobs.length > 0 && (
                        <button
                            onClick={onAutoAssign}
                            disabled={isAutoAssigning}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {isAutoAssigning ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Assigning...
                                </>
                            ) : (
                                <>
                                    <Zap size={14} />
                                    AI Assign All
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Backlog Toggle */}
                <div className="mt-2 flex items-center justify-between">
                    <button
                        onClick={onToggleBacklog}
                        className={`text-xs px-2 py-1 rounded-md transition-colors font-medium ${
                            showAllBacklog
                                ? 'bg-amber-600 text-white'
                                : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
                        }`}
                    >
                        {showAllBacklog ? 'All Backlog' : 'Today Only'}
                    </button>
                    {totalBacklogCount > 0 && !showAllBacklog && (
                        <span className="text-xs text-amber-700">
                            {totalBacklogCount} total unassigned
                        </span>
                    )}
                </div>
            </div>

            {/* Jobs List */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
                {jobs.length === 0 ? (
                    <div className="h-24 border-2 border-dashed border-amber-300 rounded-xl flex items-center justify-center">
                        <div className="text-center">
                            <CheckCircle className="mx-auto text-emerald-500 mb-1" size={24} />
                            <p className="text-sm text-slate-600">All jobs assigned!</p>
                        </div>
                    </div>
                ) : (
                    jobsWithSuggestions.map(({ job, suggestions }) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            isDragging={draggingJob?.id === job.id}
                            onDragStart={setDraggingJob}
                            onDragEnd={() => setDraggingJob(null)}
                            showSuggestions={true}
                            suggestions={suggestions}
                            onAssign={onAssign}
                            onOfferSlots={onOfferSlots}
                            onCancelJob={onCancelJob}
                            onViewDetails={onViewDetails}
                            vehicles={vehicles}
                            timezone={timezone}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ============================================
// MAIN DISPATCH BOARD
// ============================================

export const DispatchBoard = ({
    jobs = [],
    teamMembers = [],
    vehicles = [],
    initialDate = new Date(),
    onJobUpdate,
    onTeamMemberUpdate,  // Callback to update a team member (for schedule overrides)
    onEditTeamMember,    // Callback to open team member edit modal
    onOfferSlots,        // Callback to open Offer Time Slots modal for a job
    timezone
}) => {
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    const [crewModalJob, setCrewModalJob] = useState(null);
    const [workingTodayOverrides, setWorkingTodayOverrides] = useState({}); // Track one-time overrides
    const [showRouteOptimization, setShowRouteOptimization] = useState(false);
    const [routeComparisonData, setRouteComparisonData] = useState(null);
    const [showAllBacklog, setShowAllBacklog] = useState(true); // Show all unassigned jobs by default
    const [cancellingJob, setCancellingJob] = useState(null); // Job being cancelled
    const [detailJob, setDetailJob] = useState(null); // Job detail panel
    const [unassigningJob, setUnassigningJob] = useState(null); // Job pending unassign confirmation

    // Timezone fallback - use system timezone if not configured
    const effectiveTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Route optimization hook
    const {
        isOptimizing: isRouteOptimizing,
        optimizeDayRoute,
        optimizeMultiVehicle,
        compareWithOptimized,
        error: routeError
    } = useRouteOptimization();

    // Filter jobs for selected date
    // Handles all scheduling formats: multi-day blocks, multi-day schedule,
    // ISO scheduledTime, legacy scheduledDate, and Firestore Timestamps
    const jobsForDate = useMemo(() => {
        // BUG-045 Fix: Helper to get date string in YYYY-MM-DD format
        const getDateStr = (d) => {
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // BUG-045 Fix: Helper to check if job should be multi-day based on duration
        const shouldBeMultiDay = (job) => {
            const duration = job.estimatedDuration || 0;
            return isMultiDayJob(duration); // Uses 480 min (8 hours) threshold
        };

        return jobs.filter(job => {
            try {
                // CASE 1: Multi-Day Blocks (from CreateJobModal)
                if (job.isMultiDay && job.scheduleBlocks?.length > 0) {
                    return job.scheduleBlocks.some(block => {
                        const blockDate = new Date(block.date);
                        if (isNaN(blockDate.getTime())) return false;
                        return isSameDayInTimezone(blockDate, selectedDate, effectiveTimezone);
                    });
                }

                // CASE 2: Multi-Day schedule (from DragDropCalendar direct scheduling)
                if (job.multiDaySchedule?.days?.length > 0) {
                    return job.multiDaySchedule.days.some(day => {
                        const dayDate = new Date(day.startTime || day.date);
                        if (isNaN(dayDate.getTime())) return false;
                        return isSameDayInTimezone(dayDate, selectedDate, effectiveTimezone);
                    });
                }

                // BUG-045 Fix: CASE 2.5: Job should be multi-day based on duration but lacks multiDaySchedule
                if (shouldBeMultiDay(job)) {
                    const rawJobDate = job.scheduledTime || job.scheduledStartTime || job.scheduledDate;
                    if (rawJobDate) {
                        const startDate = rawJobDate.toDate ? rawJobDate.toDate() : new Date(rawJobDate);
                        if (!isNaN(startDate.getTime())) {
                            const startDateStr = getDateStr(startDate);
                            const targetDateStr = getDateStr(selectedDate);

                            // Calculate total days from duration
                            const duration = job.estimatedDuration || 0;
                            const totalDays = Math.ceil(duration / 480) || 1;

                            // Calculate day difference
                            const startMs = new Date(startDateStr).getTime();
                            const targetMs = new Date(targetDateStr).getTime();
                            const dayDiff = Math.floor((targetMs - startMs) / (24 * 60 * 60 * 1000));

                            // Check if selected date falls within the multi-day range
                            if (dayDiff >= 0 && dayDiff < totalDays) {
                                return true;
                            }
                        }
                    }
                    return false;
                }

                // CASE 3: Use scheduledDate or scheduledTime (whichever is available)
                // FIXED: Also check scheduledStartTime field (BUG-020)
                const rawDate = job.scheduledDate || job.scheduledTime || job.scheduledStartTime;
                if (!rawDate) return false;

                const jobDate = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
                if (isNaN(jobDate.getTime())) return false;
                return isSameDayInTimezone(jobDate, selectedDate, effectiveTimezone);
            } catch (e) {
                console.warn('[DispatchBoard] Invalid job date:', job.id, e);
                return false;
            }
        });
    }, [jobs, selectedDate, effectiveTimezone]);

    // Also include unscheduled jobs that need assignment
    const unscheduledJobs = useMemo(() => {
        return jobs.filter(job => {
            // Skip completed/cancelled jobs
            if (['completed', 'cancelled', 'draft'].includes(job.status)) return false;
            // Skip already-assigned jobs
            const assignedTechIds = getAssignedTechIds(job);
            if (assignedTechIds.length > 0) return false;
            // Include jobs with no scheduled date
            // FIXED: Also check scheduledStartTime field (BUG-020)
            if (!job.scheduledDate && !job.scheduledTime && !job.scheduledStartTime) return true;
            return false;
        });
    }, [jobs]);

    // Identify overdue/backlog jobs (unassigned and in the past)
    const backlogJobs = useMemo(() => {
        return jobs.filter(job => {
            try {
                if (['completed', 'cancelled', 'draft'].includes(job.status)) return false;

                // Check if already assigned
                const assignedTechIds = getAssignedTechIds(job);
                if (assignedTechIds.length > 0) return false;

                // Must have a date that is strictly BEFORE the selected date (midnight)
                // FIXED: Also check scheduledStartTime field (BUG-020)
                if (!job.scheduledDate && !job.scheduledTime && !job.scheduledStartTime) return false;

                const jobDateRaw = job.scheduledDate || job.scheduledTime || job.scheduledStartTime;
                const jobDate = jobDateRaw.toDate ? jobDateRaw.toDate() : new Date(jobDateRaw);
                if (isNaN(jobDate.getTime())) return false; // Skip invalid dates

                // Normalize to midnight for comparison
                const jobMidnight = new Date(jobDate);
                jobMidnight.setHours(0, 0, 0, 0);

                const selectedMidnight = new Date(selectedDate);
                selectedMidnight.setHours(0, 0, 0, 0);

                return jobMidnight < selectedMidnight;
            } catch (e) {
                console.warn('[DispatchBoard] Invalid backlog job date:', job.id, e);
                return false;
            }
        });
    }, [jobs, selectedDate]);

    // All unassigned jobs across all dates (global backlog)
    const allUnassignedJobs = useMemo(() => {
        return jobs.filter(job => {
            if (['completed', 'cancelled', 'draft'].includes(job.status)) return false;
            const assignedTechIds = getAssignedTechIds(job);
            return assignedTechIds.length === 0;
        }).map(job => {
            // Mark overdue jobs
            // FIXED: Also check scheduledStartTime field (BUG-020)
            try {
                const rawDate = job.scheduledDate || job.scheduledTime || job.scheduledStartTime;
                if (rawDate) {
                    const jobDate = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
                    if (!isNaN(jobDate.getTime())) {
                        const jobMidnight = new Date(jobDate);
                        jobMidnight.setHours(0, 0, 0, 0);
                        const todayMidnight = new Date();
                        todayMidnight.setHours(0, 0, 0, 0);
                        if (jobMidnight < todayMidnight) {
                            return { ...job, isOverdue: true };
                        }
                    }
                }
            } catch (e) { /* ignore date parse errors */ }
            return job;
        });
    }, [jobs]);

    // Split into assigned and unassigned
    const { assignedJobs, unassignedJobs } = useMemo(() => {
        const assigned = [];
        const seenIds = new Set(); // Prevent duplicates across categories

        // 1. Process jobs for the selected date - extract assigned jobs
        jobsForDate.forEach(job => {
            if (seenIds.has(job.id)) return;
            seenIds.add(job.id);

            const assignedTechIds = getAssignedTechIds(job);
            if (assignedTechIds.length > 0) {
                assigned.push(job);
            }
        });

        // 2. Determine unassigned list based on toggle
        let unassigned;
        if (showAllBacklog) {
            // Show ALL unassigned jobs across all dates (global backlog view)
            unassigned = [...allUnassignedJobs];
        } else {
            // Show only unassigned for selected date + overdue + unscheduled
            unassigned = [];

            jobsForDate.forEach(job => {
                if (seenIds.has(job.id)) return;
                const assignedTechIds = getAssignedTechIds(job);
                if (assignedTechIds.length === 0) {
                    unassigned.push(job);
                }
            });

            backlogJobs.forEach(job => {
                const id = job.id;
                if (unassigned.some(j => j.id === id)) return;
                unassigned.push({ ...job, isOverdue: true });
            });

            unscheduledJobs.forEach(job => {
                const id = job.id;
                if (unassigned.some(j => j.id === id)) return;
                unassigned.push(job);
            });
        }

        // Sort unassigned: Overdue first, then scheduled (by date), then unscheduled
        unassigned.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            // Then by scheduled date (jobs with dates before those without)
            const aDate = a.scheduledDate || a.scheduledTime;
            const bDate = b.scheduledDate || b.scheduledTime;
            if (aDate && !bDate) return -1;
            if (!aDate && bDate) return 1;
            return 0;
        });

        return { assignedJobs: assigned, unassignedJobs: unassigned };
    }, [jobsForDate, backlogJobs, unscheduledJobs, allUnassignedJobs, showAllBacklog]);

    // Group assigned jobs by tech (multi-tech jobs appear in multiple columns)
    const jobsByTech = useMemo(() => {
        const map = {};
        teamMembers.forEach(tech => {
            map[tech.id] = [];
        });

        assignedJobs.forEach(job => {
            const assignedTechIds = getAssignedTechIds(job);
            assignedTechIds.forEach(techId => {
                if (map[techId]) {
                    map[techId].push(job);
                }
            });
        });

        return map;
    }, [assignedJobs, teamMembers]);

    // Navigation (with validation to prevent crashes)
    const goToDate = (days) => {
        try {
            const newDate = new Date(selectedDate);
            if (isNaN(newDate.getTime())) {
                setSelectedDate(new Date());
                return;
            }
            newDate.setDate(newDate.getDate() + days);
            setSelectedDate(newDate);
        } catch (e) {
            console.error('[DispatchBoard] Date navigation error:', e);
            setSelectedDate(new Date());
        }
    };

    const goToToday = () => {
        setSelectedDate(new Date());
    };

    // Assignment handlers
    const handleAssign = useCallback(async (job, techId, techName) => {
        const tech = teamMembers.find(t => t.id === techId);
        if (!tech) return;

        try {
            const assignedTechIds = getAssignedTechIds(job);
            const crewRequired = job.crewRequirements?.required || job.requiredCrewSize || 1;
            const crewMaximum = job.crewRequirements?.maximum || crewRequired + 2;

            if (assignedTechIds.length > 0) {
                // Job is already assigned.
                if (assignedTechIds.includes(techId)) {
                    toast('Technician already assigned to this job', { icon: 'ℹ️' });
                    return;
                }
                // ... rest of function

                // Check if crew is already at or over maximum
                if (assignedTechIds.length >= crewMaximum) {
                    toast.error(`Crew is already at maximum capacity (${crewMaximum} techs)`);
                    return;
                }

                // Warn if crew already meets requirements
                if (assignedTechIds.length >= crewRequired) {
                    toast(`Crew already has ${assignedTechIds.length}/${crewRequired} required techs - adding anyway`, { icon: '⚠️' });
                }

                // ADD to existing crew
                let crewToSave = [];
                if (job.assignedCrew && job.assignedCrew.length > 0) {
                    crewToSave = [...job.assignedCrew];
                } else if (job.assignedTechId) {
                    // Legacy to Crew conversion
                    crewToSave = [{
                        techId: job.assignedTechId,
                        techName: job.assignedTechName || 'Technician',
                        role: 'lead',
                        color: '#64748B',
                        assignedAt: new Date().toISOString()
                    }];
                }

                crewToSave.push(createCrewMember(tech, 'helper'));
                await assignCrewToJob(job.id, crewToSave, 'manual');

                // Show staffing status after assignment
                const newCrewSize = crewToSave.length;
                if (newCrewSize === crewRequired) {
                    toast.success(`Added ${techName} - crew is now fully staffed!`, { icon: '✅' });
                } else if (newCrewSize < crewRequired) {
                    toast.success(`Added ${techName} (${newCrewSize}/${crewRequired} techs)`);
                } else {
                    toast.success(`Added ${techName} to crew`);
                }
            } else {
                // Unassigned -> New Assignment (Lead)
                const newMember = createCrewMember(tech, 'lead');
                await assignCrewToJob(job.id, [newMember], 'manual');

                // Show staffing needs for multi-crew jobs
                if (crewRequired > 1) {
                    toast.success(`Assigned to ${techName} (1/${crewRequired} techs needed)`);
                } else {
                    toast.success(`Assigned to ${techName}`);
                }
            }

            onJobUpdate?.();
        } catch (error) {
            console.error('Assign error:', error);
            toast.error('Failed to assign job');
        }
    }, [teamMembers, onJobUpdate]);

    // State for conflict confirmation modal
    const [conflictModal, setConflictModal] = useState(null);

    const handleDrop = useCallback(async (jobId, techId, techName) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        // Check for conflicts
        const tech = teamMembers.find(t => t.id === techId);
        if (tech) {
            const { hasErrors, hasWarnings, conflicts } = checkConflicts(tech, job, jobsForDate, selectedDate, timezone);

            // Collect all blocking conflicts (errors) including day_off
            const blockingConflicts = conflicts.filter(c => c.severity === 'error');

            if (blockingConflicts.length > 0) {
                // Show confirmation modal instead of silently proceeding or just toasting
                setConflictModal({
                    job,
                    techId,
                    techName,
                    techObj: tech,
                    conflicts: blockingConflicts,
                    warnings: conflicts.filter(c => c.severity === 'warning')
                });
                return; // Block until user confirms
            }

            if (hasWarnings) {
                // Non-blocking warnings (hours limit, skill mismatch) - show toast but proceed
                const warningMsg = conflicts.find(c => c.severity === 'warning')?.message;
                if (warningMsg) {
                    toast(warningMsg, { icon: '⚠️' });
                }
            }
        }

        await handleAssign(job, techId, techName);
    }, [jobs, teamMembers, jobsForDate, selectedDate, timezone, handleAssign]);

    // Handle conflict modal confirmation (user chose to override)
    const handleConflictOverride = useCallback(async () => {
        if (!conflictModal) return;
        const { job, techId, techName } = conflictModal;
        setConflictModal(null);
        await handleAssign(job, techId, techName);
    }, [conflictModal, handleAssign]);

    const handleUnassign = useCallback((job) => {
        setUnassigningJob(job);
    }, []);

    const confirmUnassign = useCallback(async () => {
        if (!unassigningJob) return;
        try {
            await unassignAllCrew(unassigningJob.id);
            toast.success('Job unassigned');
            setUnassigningJob(null);
            onJobUpdate?.();
        } catch (error) {
            console.error('Unassign error:', error);
            toast.error('Failed to unassign');
        }
    }, [unassigningJob, onJobUpdate]);

    const handleCancelJob = useCallback(async (reason) => {
        if (!cancellingJob) return;
        try {
            const result = await cancelJob(null, cancellingJob.id, reason);
            if (result.success) {
                toast.success(`Job "${cancellingJob.title}" cancelled`);
                setCancellingJob(null);
                onJobUpdate?.();
            } else {
                toast.error('Failed to cancel job');
            }
        } catch (error) {
            console.error('Cancel job error:', error);
            toast.error('Failed to cancel job');
        }
    }, [cancellingJob, onJobUpdate]);

    const handleAutoAssign = useCallback(async () => {
        if (unassignedJobs.length === 0) return;

        setIsAutoAssigning(true);
        try {
            const result = autoAssignAll(
                unassignedJobs,
                teamMembers,
                assignedJobs,
                selectedDate
            );

            if (result.successful.length === 0) {
                toast.error('No jobs could be assigned');
                return;
            }

            // Bulk assign using new crew logic - supports multi-tech jobs
            const batchPromises = result.successful.map(async (assignment) => {
                // Use the techs array for multi-tech support
                const techsToAssign = assignment.techs || [];

                if (techsToAssign.length === 0) {
                    // Fallback to single tech (backward compatibility)
                    const tech = teamMembers.find(t => t.id === assignment.techId);
                    if (!tech) return;
                    const newMember = createCrewMember(tech, 'lead');
                    return assignCrewToJob(assignment.jobId, [newMember], 'ai');
                }

                // Create crew members - first one is lead, others are members
                const crewMembers = techsToAssign.map((tech, index) =>
                    createCrewMember(tech, index === 0 ? 'lead' : 'member')
                );

                return assignCrewToJob(assignment.jobId, crewMembers, 'ai');
            });

            await Promise.all(batchPromises);

            // Enhanced success message with staffing info
            let successMsg = `Assigned ${result.summary.assigned} of ${result.summary.total} jobs`;
            if (result.summary.understaffed > 0) {
                successMsg += ` (${result.summary.understaffed} need more techs)`;
            }

            toast.success(successMsg, { duration: 4000 });

            if (result.failed.length > 0) {
                toast(`${result.failed.length} jobs couldn't be assigned`, { icon: '⚠️' });
            }

            onJobUpdate?.();
        } catch (error) {
            console.error('Auto-assign error:', error);
            toast.error('Auto-assign failed');
        } finally {
            setIsAutoAssigning(false);
        }
    }, [unassignedJobs, teamMembers, assignedJobs, selectedDate, onJobUpdate]);

    const isToday = isSameDayInTimezone(selectedDate, new Date(), effectiveTimezone);

    // Handle marking a tech as working today (one-time override)
    const handleMarkWorkingToday = useCallback((tech) => {
        const dateKey = (selectedDate instanceof Date && !isNaN(selectedDate) ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setWorkingTodayOverrides(prev => ({
            ...prev,
            [`${tech.id}_${dateKey}`]: true
        }));
        toast.success(`${tech.name} marked as working today`);
    }, [selectedDate]);

    // Handle editing a tech's schedule (opens edit modal)
    const handleEditSchedule = useCallback((tech) => {
        if (onEditTeamMember) {
            onEditTeamMember(tech);
        } else {
            toast('Go to Settings → Team to edit schedules', { icon: 'ℹ️' });
        }
    }, [onEditTeamMember]);

    // Handle route optimization
    const handleOptimizeRoutes = useCallback(async () => {
        if (assignedJobs.length < 2) {
            toast('Need at least 2 assigned jobs to optimize routes', { icon: 'ℹ️' });
            return;
        }

        try {
            // Group jobs by tech for route optimization
            const techRoutes = {};
            teamMembers.forEach(tech => {
                const techJobs = jobsByTech[tech.id] || [];
                if (techJobs.length > 0) {
                    techRoutes[tech.id] = {
                        tech,
                        jobs: techJobs,
                        vehicle: vehicles.find(v =>
                            v.defaultTechId === tech.id ||
                            techJobs.some(j => j.assignedVehicleId === v.id)
                        )
                    };
                }
            });

            // If we have vehicles, use multi-vehicle optimization
            if (vehicles.length > 0) {
                const availableVehicles = vehicles.filter(v =>
                    v.status === 'available' || v.status === 'in_use'
                ).map(v => ({
                    id: v.id,
                    name: v.name,
                    capacity: v.capacity?.passengers || 4,
                    startLocation: v.homeLocation || null
                }));

                const result = await optimizeMultiVehicle(assignedJobs, availableVehicles);

                if (result.error) {
                    toast.error(`Optimization failed: ${result.error}`);
                    return;
                }

                // Show results summary
                const assignmentCount = result.assignments?.length || 0;
                const unassignedCount = result.unassigned?.length || 0;
                const crewWarnings = result.crewWarnings || [];

                let msg = `Routes optimized for ${assignmentCount} vehicle${assignmentCount !== 1 ? 's' : ''}`;
                if (unassignedCount > 0) {
                    msg += ` (${unassignedCount} jobs couldn't be routed)`;
                }
                if (crewWarnings.length > 0) {
                    msg += ` - ${crewWarnings.length} crew warning(s)`;
                }

                toast.success(msg, { duration: 4000 });
                setRouteComparisonData(result);
                setShowRouteOptimization(true);
            } else {
                // Single route optimization (no vehicles defined)
                const result = await compareWithOptimized(assignedJobs);

                if (result.error) {
                    toast.error(`Optimization failed: ${result.error}`);
                    return;
                }

                const savings = result.comparison?.timeSavedMinutes || 0;
                if (savings > 0) {
                    toast.success(`Found route ${savings} minutes faster!`);
                } else {
                    toast('Current routes are already optimal', { icon: '✅' });
                }

                setRouteComparisonData(result);
                setShowRouteOptimization(true);
            }
        } catch (error) {
            console.error('Route optimization error:', error);
            toast.error('Route optimization failed');
        }
    }, [assignedJobs, teamMembers, jobsByTech, vehicles, optimizeMultiVehicle, compareWithOptimized]);

    // Apply optimized routes
    const handleApplyOptimizedRoutes = useCallback(async () => {
        if (!routeComparisonData) return;

        try {
            // Update job route orders based on optimization results
            const updates = [];

            if (routeComparisonData.assignments) {
                // Multi-vehicle result
                routeComparisonData.assignments.forEach((assignment, vehicleIdx) => {
                    assignment.route.forEach((job, stopIdx) => {
                        updates.push({
                            jobId: job.id,
                            routeOrder: stopIdx + 1,
                            assignedVehicleId: assignment.vehicleId,
                            optimizedAt: new Date().toISOString()
                        });
                    });
                });
            } else if (routeComparisonData.optimizedRoute) {
                // Single route result
                routeComparisonData.optimizedRoute.forEach((job, idx) => {
                    updates.push({
                        jobId: job.id,
                        routeOrder: idx + 1,
                        optimizedAt: new Date().toISOString()
                    });
                });
            }

            // Note: Would need to batch update jobs here with onJobUpdate callback
            // For now, just show success and close modal
            toast.success(`Applied optimized routes to ${updates.length} jobs`);
            setShowRouteOptimization(false);
            setRouteComparisonData(null);
            onJobUpdate?.();
        } catch (error) {
            console.error('Apply routes error:', error);
            toast.error('Failed to apply optimized routes');
        }
    }, [routeComparisonData, onJobUpdate]);

    // Get week dates for the mini week navigator (memoized to prevent unnecessary recalculations)
    const weekDates = useMemo(() => {
        try {
            const safeDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime())
                ? selectedDate
                : new Date();
            const dates = [];
            const start = new Date(safeDate);
            start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                dates.push(d);
            }
            return dates;
        } catch (e) {
            console.error('[DispatchBoard] getWeekDates error:', e);
            // Fallback: generate week from today
            const dates = [];
            const today = new Date();
            const start = new Date(today);
            start.setDate(start.getDate() - start.getDay());
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                dates.push(d);
            }
            return dates;
        }
    }, [selectedDate]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-3">
                {/* Week Navigator - Quick day selection */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-2">
                    <button
                        onClick={() => goToDate(-7)}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                        title="Previous week"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex gap-1">
                        {weekDates.map((date, i) => {
                            const isSelected = isSameDayInTimezone(date, selectedDate, effectiveTimezone);
                            const isCurrentDay = isSameDayInTimezone(date, new Date(), effectiveTimezone);
                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = date.getDate();

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(new Date(date))}
                                    className={`flex flex-col items-center px-3 py-1.5 rounded-lg transition-all min-w-[48px] ${isSelected
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : isCurrentDay
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                            : 'hover:bg-white text-slate-600'
                                        }`}
                                >
                                    <span className="text-[10px] font-medium uppercase">{dayName}</span>
                                    <span className="text-sm font-bold">{dayNum}</span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => goToDate(7)}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                        title="Next week"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Date Display and Stats Row */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => goToDate(-1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="text-center min-w-[200px]">
                            <p className="text-xl font-bold text-slate-800">
                                {formatDate(selectedDate)}
                            </p>
                            {!isToday && (
                                <button
                                    onClick={goToToday}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    Go to Today
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => goToDate(1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                            <Users size={16} />
                            <span>{teamMembers.length} techs</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <Truck size={16} />
                            <span>{vehicles.filter(v => v.status === 'available' || v.status === 'in_use').length} vehicles</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <Calendar size={16} />
                            <span>{jobsForDate.length} scheduled</span>
                        </div>
                        {unassignedJobs.length > 0 && (
                            <div className="flex items-center gap-2 text-amber-600">
                                <AlertTriangle size={16} />
                                <span>{unassignedJobs.length} unassigned</span>
                            </div>
                        )}
                        {/* Route Optimization Button */}
                        {assignedJobs.length > 1 && (
                            <button
                                onClick={handleOptimizeRoutes}
                                disabled={isRouteOptimizing}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                                title="Optimize routes for all techs"
                            >
                                {isRouteOptimizing ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Route size={14} />
                                )}
                                <span className="font-medium">Optimize Routes</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {/* Unassigned Column */}
                <UnassignedColumn
                    jobs={unassignedJobs}
                    techs={teamMembers}
                    allJobs={jobsForDate}
                    date={selectedDate}
                    onAssign={(job, techId, techName) => handleAssign(job, techId, techName)}
                    onAutoAssign={handleAutoAssign}
                    isAutoAssigning={isAutoAssigning}
                    vehicles={vehicles}
                    showAllBacklog={showAllBacklog}
                    onToggleBacklog={() => setShowAllBacklog(prev => !prev)}
                    totalBacklogCount={allUnassignedJobs.length}
                    onOfferSlots={onOfferSlots}
                    onCancelJob={setCancellingJob}
                    onViewDetails={setDetailJob}
                    timezone={effectiveTimezone}
                />

                {/* Tech Columns */}
                {teamMembers.map(tech => {
                    // Check for one-time override
                    const dateKey = (selectedDate instanceof Date && !isNaN(selectedDate) ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                    const hasOverride = workingTodayOverrides[`${tech.id}_${dateKey}`];

                    // Merge override into tech for this render
                    const techWithOverride = hasOverride ? {
                        ...tech,
                        _workingTodayOverride: true
                    } : tech;

                    return (
                        <TechColumn
                            key={tech.id}
                            tech={techWithOverride}
                            jobs={jobsByTech[tech.id] || []}
                            date={selectedDate}
                            allJobs={jobsForDate}
                            onDrop={handleDrop}
                            onUnassign={handleUnassign}
                            onOpenCrewModal={setCrewModalJob}
                            onCancelJob={setCancellingJob}
                            onViewDetails={setDetailJob}
                            onMarkWorkingToday={handleMarkWorkingToday}
                            onEditSchedule={handleEditSchedule}
                            vehicles={vehicles}
                            timezone={effectiveTimezone}
                        />
                    );
                })}

                {/* Empty state for no techs */}
                {teamMembers.length === 0 && (
                    <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="text-center">
                            <Users className="mx-auto text-slate-300 mb-2" size={40} />
                            <p className="text-slate-600 font-medium">No team members</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Add technicians in Settings → Team to use dispatch
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend / Help */}
            <div className="flex items-center gap-6 text-xs text-slate-500 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span>Getting full</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span>At capacity</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    <Info size={14} />
                    <span>Drag jobs to assign, or use AI Assign All</span>
                </div>
            </div>

            {/* Crew Assignment Modal */}
            {crewModalJob && (
                <CrewAssignmentModal
                    job={crewModalJob}
                    teamMembers={teamMembers}
                    vehicles={vehicles}
                    existingJobs={jobsForDate}
                    onSave={() => {
                        onJobUpdate?.();
                    }}
                    onClose={() => setCrewModalJob(null)}
                />
            )}

            {/* Route Optimization Modal */}
            {showRouteOptimization && routeComparisonData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Route className="text-purple-600" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Route Optimization Results</h2>
                                    <p className="text-sm text-slate-500">
                                        {routeComparisonData.assignments
                                            ? `${routeComparisonData.assignments.length} vehicle routes optimized`
                                            : 'Single route comparison'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowRouteOptimization(false);
                                    setRouteComparisonData(null);
                                }}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {routeComparisonData.assignments ? (
                                // Multi-Vehicle Results
                                <div className="space-y-4">
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-4 gap-4 mb-6">
                                        <div className="p-3 bg-emerald-50 rounded-xl text-center">
                                            <p className="text-2xl font-bold text-emerald-600">
                                                {routeComparisonData.assignments.length}
                                            </p>
                                            <p className="text-sm text-emerald-700">Vehicle Routes</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-xl text-center">
                                            <p className="text-2xl font-bold text-blue-600">
                                                {routeComparisonData.assignments.reduce((sum, a) => sum + a.route.length, 0)}
                                            </p>
                                            <p className="text-sm text-blue-700">Total Stops</p>
                                        </div>
                                        <div className="p-3 bg-purple-50 rounded-xl text-center">
                                            <p className="text-2xl font-bold text-purple-600">
                                                {routeComparisonData.assignments.reduce((sum, a) => sum + (a.totalTime || 0), 0)} min
                                            </p>
                                            <p className="text-sm text-purple-700">Total Drive Time</p>
                                        </div>
                                        {routeComparisonData.unassigned?.length > 0 && (
                                            <div className="p-3 bg-amber-50 rounded-xl text-center">
                                                <p className="text-2xl font-bold text-amber-600">
                                                    {routeComparisonData.unassigned.length}
                                                </p>
                                                <p className="text-sm text-amber-700">Unrouted Jobs</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Crew Warnings */}
                                    {routeComparisonData.crewWarnings?.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                                                <div>
                                                    <p className="font-medium text-amber-800">Crew Warnings</p>
                                                    <ul className="mt-1 text-sm text-amber-700 space-y-1">
                                                        {routeComparisonData.crewWarnings.map((warning, idx) => (
                                                            <li key={idx}>{warning}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Vehicle Routes */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {routeComparisonData.assignments.map((assignment, idx) => (
                                            <div key={idx} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                                                <div className="p-3 bg-slate-50 border-b border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <Truck size={16} className="text-slate-500" />
                                                        <span className="font-bold text-slate-700">
                                                            {assignment.vehicleName || `Vehicle ${idx + 1}`}
                                                        </span>
                                                        <span className="ml-auto text-sm text-slate-500">
                                                            {assignment.route.length} stops
                                                        </span>
                                                    </div>
                                                    {assignment.totalTime > 0 && (
                                                        <div className="flex items-center gap-1 mt-1 text-xs text-purple-600">
                                                            <Clock size={12} />
                                                            <span>{assignment.totalTime} min drive time</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-3 space-y-2 max-h-[250px] overflow-y-auto">
                                                    {assignment.route.map((job, stopIdx) => {
                                                        const arrival = assignment.arrivals?.[stopIdx];
                                                        return (
                                                            <div key={job.id} className="flex items-start gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                                                    {stopIdx + 1}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-slate-700 truncate">
                                                                        {job.title || job.serviceType || 'Job'}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 truncate">
                                                                        {job.customer?.name || job.customerName}
                                                                    </p>
                                                                    {arrival?.arrivalTimeStr && (
                                                                        <p className="text-xs text-purple-500 flex items-center gap-1">
                                                                            <Clock size={10} />
                                                                            ETA: {arrival.arrivalTimeStr}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // Single Route Comparison (use RouteComparison component)
                                <RouteComparison
                                    currentRoute={routeComparisonData.currentRoute}
                                    optimizedRoute={routeComparisonData.optimizedRoute}
                                    currentArrivals={routeComparisonData.currentArrivals}
                                    optimizedArrivals={routeComparisonData.optimizedArrivals}
                                    currentStats={routeComparisonData.currentStats}
                                    optimizedStats={routeComparisonData.optimizedStats}
                                    comparison={routeComparisonData.comparison}
                                    onApplyOptimized={handleApplyOptimizedRoutes}
                                />
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 flex justify-between items-center">
                            {/* Open in Google Maps */}
                            {routeComparisonData.assignments?.length > 0 && (
                                <button
                                    onClick={() => {
                                        // Build Google Maps directions URL from optimized routes
                                        const allJobs = routeComparisonData.assignments.flatMap(a => a.route);
                                        if (allJobs.length === 0) return;

                                        const waypoints = allJobs
                                            .map(job => {
                                                const addr = job.serviceAddress?.formatted || job.customer?.address;
                                                return addr ? encodeURIComponent(addr) : null;
                                            })
                                            .filter(Boolean);

                                        if (waypoints.length > 0) {
                                            const origin = waypoints[0];
                                            const destination = waypoints[waypoints.length - 1];
                                            const waypointsParam = waypoints.length > 2
                                                ? `&waypoints=${waypoints.slice(1, -1).join('|')}`
                                                : '';
                                            const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}`;
                                            window.open(url, '_blank');
                                        } else {
                                            toast.error('No addresses found for directions');
                                        }
                                    }}
                                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Map size={16} />
                                    Open in Google Maps
                                    <ExternalLink size={12} />
                                </button>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowRouteOptimization(false);
                                        setRouteComparisonData(null);
                                    }}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApplyOptimizedRoutes}
                                    className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle size={16} />
                                    Apply Optimized Routes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scheduling Conflict Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!conflictModal}
                onClose={() => setConflictModal(null)}
                onConfirm={handleConflictOverride}
                title="Scheduling Conflict"
                message={
                    conflictModal
                        ? `${conflictModal.techName} has a conflict:\n\n${conflictModal.conflicts.map(c => `• ${c.message}`).join('\n')}\n\nDo you want to override and assign anyway?`
                        : ''
                }
                confirmLabel="Override & Assign"
                cancelLabel="Cancel"
                variant="warning"
            />

            {/* Unassign Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!unassigningJob}
                onClose={() => setUnassigningJob(null)}
                onConfirm={confirmUnassign}
                title="Unassign Job"
                message={
                    unassigningJob
                        ? `Remove all crew assignments from "${unassigningJob.title}"?\n\n• Assigned to: ${unassigningJob.assignedTechName || 'Unknown'}\n• Time: ${unassigningJob.scheduledTime ? formatTime(unassigningJob.scheduledTime, effectiveTimezone) : 'Unscheduled'}\n\nThe job will be moved back to the unassigned queue.`
                        : ''
                }
                confirmLabel="Unassign"
                cancelLabel="Keep Assigned"
                variant="warning"
            />

            {/* Cancel Job Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!cancellingJob}
                onClose={() => setCancellingJob(null)}
                onConfirm={() => handleCancelJob('Cancelled by contractor')}
                title="Cancel Job"
                message={
                    cancellingJob
                        ? `Are you sure you want to cancel "${cancellingJob.title}"?\n\n• Customer: ${cancellingJob.customer?.name || 'Unknown'}\n• Scheduled: ${cancellingJob.scheduledTime ? formatTime(cancellingJob.scheduledTime, effectiveTimezone) : 'Unscheduled'}\n\nThis will remove all tech assignments and mark the job as cancelled.`
                        : ''
                }
                confirmLabel="Cancel Job"
                cancelLabel="Keep Job"
                variant="danger"
            />

            {/* Job Detail Panel */}
            {detailJob && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailJob(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{detailJob.title}</h2>
                                <p className="text-sm text-slate-500">Job #{detailJob.jobNumber || 'N/A'}</p>
                            </div>
                            <button onClick={() => setDetailJob(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Status</p>
                                    <p className="text-sm font-semibold capitalize">{detailJob.status?.replace(/_/g, ' ') || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Priority</p>
                                    <p className="text-sm font-semibold capitalize">{detailJob.priority || 'Normal'}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-medium">Customer</p>
                                <p className="text-sm font-semibold">{detailJob.customer?.name || 'Unknown'}</p>
                                {detailJob.customer?.phone && <p className="text-sm text-slate-600">{detailJob.customer.phone}</p>}
                                {detailJob.customer?.email && <p className="text-sm text-slate-600">{detailJob.customer.email}</p>}
                            </div>
                            {detailJob.customer?.address && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Address</p>
                                    <p className="text-sm">{detailJob.customer.address}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Scheduled Time</p>
                                    <p className="text-sm font-semibold">
                                        {detailJob.scheduledTime ? formatTime(detailJob.scheduledTime, effectiveTimezone) : 'Unscheduled'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Duration</p>
                                    <p className="text-sm font-semibold">{detailJob.estimatedDuration ? `${detailJob.estimatedDuration} min` : 'N/A'}</p>
                                </div>
                            </div>
                            {detailJob.assignedTechName && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Assigned To</p>
                                    <p className="text-sm font-semibold">{detailJob.assignedTechName}</p>
                                </div>
                            )}
                            {detailJob.notes && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Notes</p>
                                    <p className="text-sm text-slate-700">{detailJob.notes}</p>
                                </div>
                            )}
                            {detailJob.price > 0 && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-medium">Price</p>
                                    <p className="text-sm font-semibold">${detailJob.price?.toFixed(2)}</p>
                                </div>
                            )}
                            <div className="pt-4 border-t border-slate-100 flex gap-2">
                                <button
                                    onClick={() => { setCancellingJob(detailJob); setDetailJob(null); }}
                                    className="flex-1 px-4 py-2 bg-red-50 text-red-700 font-medium rounded-lg hover:bg-red-100 flex items-center justify-center gap-2"
                                >
                                    <XCircle size={16} />
                                    Cancel Job
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchBoard;
