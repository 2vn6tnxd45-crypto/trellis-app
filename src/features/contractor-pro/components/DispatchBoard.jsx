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
    Users, Loader2, Info, AlertCircle
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
    parseDurationToMinutes
} from '../lib/schedulingAI';
import { isSameDayInTimezone } from '../lib/timezoneUtils';
import { CrewAssignmentModal } from './CrewAssignmentModal';
import {
    getAssignedTechIds,
    assignCrewToJob,
    unassignAllCrew,
    createCrewMember,
    removeTechFromCrew
} from '../lib/crewService';

// ============================================
// HELPERS
// ============================================

const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
};

const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
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
    isAssigned,
    compact = false
}) => {
    const [expanded, setExpanded] = useState(false);
    const duration = parseDurationToMinutes(job.estimatedDuration);
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationStr = hours > 0
        ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
        : `${mins}m`;

    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('jobId', job.id);
                onDragStart?.(job);
            }}
            onDragEnd={onDragEnd}
            className={`
                bg-white rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing
                ${isDragging ? 'opacity-50 border-emerald-400 shadow-lg' : 'border-slate-200 hover:border-slate-300'}
                ${compact ? 'p-2' : 'p-3'}
            `}
        >
            {/* Header */}
            <div className="flex items-start gap-2">
                <GripVertical size={16} className="text-slate-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className={`font-bold text-slate-800 truncate ${compact ? 'text-sm' : ''}`}>
                        {job.title || job.serviceType || 'Job'}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                        {job.customer?.name || job.customerName || 'Customer'}
                    </p>

                    {/* Crew Avatars (if multiple techs assigned) */}
                    {job.assignedCrew && job.assignedCrew.length > 1 && (
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
                                {job.assignedCrew.length > 4 && (
                                    <div className="w-5 h-5 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold">
                                        +{job.assignedCrew.length - 4}
                                    </div>
                                )}
                            </div>
                            <span className="text-xs text-slate-500">
                                {job.assignedCrew.length} techs
                            </span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Crew Assignment Button */}
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

            {/* Details */}
            <div className={`mt-2 flex flex-wrap gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
                {job.scheduledTime && (
                    <span className="flex items-center gap-1 text-slate-600">
                        <Clock size={12} />
                        {formatTime(job.scheduledTime)}
                    </span>
                )}
                <span className="flex items-center gap-1 text-slate-600">
                    <Wrench size={12} />
                    {durationStr}
                </span>
                {job.customer?.address && (
                    <span className="flex items-center gap-1 text-slate-500 truncate max-w-[150px]">
                        <MapPin size={12} />
                        {job.customer.address.split(',')[0]}
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
    isDropTarget,
    allJobs
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

    // Check if tech works today
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const worksToday = tech.workingHours?.[dayName]?.enabled !== false;

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
                ${!worksToday ? 'opacity-60' : ''}
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
                        <p className="text-xs text-slate-500">{tech.role || 'Technician'}</p>
                    </div>
                    {!worksToday && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">
                            Off
                        </span>
                    )}
                </div>

                {/* Capacity Bars */}
                {worksToday && (
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
                            compact={true}
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
    isAutoAssigning
}) => {
    const [draggingJob, setDraggingJob] = useState(null);

    // Get suggestions for each job
    const jobsWithSuggestions = useMemo(() => {
        return jobs.map(job => {
            const { suggestions } = suggestAssignments(job, techs, allJobs, date);
            return { job, suggestions };
        });
    }, [jobs, techs, allJobs, date]);

    return (
        <div className="flex flex-col bg-amber-50 rounded-xl border-2 border-amber-200 min-w-[300px] max-w-[350px]">
            {/* Header */}
            <div className="p-3 border-b border-amber-200 bg-amber-100/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="text-amber-600" size={20} />
                        <div>
                            <p className="font-bold text-amber-800">Unassigned</p>
                            <p className="text-xs text-amber-600">{jobs.length} jobs</p>
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
    timezone
}) => {
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    const [crewModalJob, setCrewModalJob] = useState(null);

    // Filter jobs for selected date
    const jobsForDate = useMemo(() => {
        return jobs.filter(job => {
            if (!job.scheduledDate) return false;
            const jobDate = job.scheduledDate.toDate ? job.scheduledDate.toDate() : new Date(job.scheduledDate);
            return isSameDayInTimezone(jobDate, selectedDate, timezone);
        });
    }, [jobs, selectedDate, timezone]);

    // Also include unscheduled jobs that need assignment
    const unscheduledJobs = useMemo(() => {
        return jobs.filter(job =>
            !job.scheduledDate &&
            ['pending_schedule', 'slots_offered', 'accepted', 'quoted'].includes(job.status)
        );
    }, [jobs]);

    // Identify overdue/backlog jobs (unassigned and in the past)
    const backlogJobs = useMemo(() => {
        return jobs.filter(job => {
            if (['completed', 'cancelled', 'draft'].includes(job.status)) return false;

            // Check if already assigned
            const assignedTechIds = getAssignedTechIds(job);
            if (assignedTechIds.length > 0) return false;

            // Must have a date that is strictly BEFORE the selected date (midnight)
            if (!job.scheduledDate && !job.scheduledTime) return false;

            const jobDateRaw = job.scheduledDate || job.scheduledTime;
            const jobDate = jobDateRaw.toDate ? jobDateRaw.toDate() : new Date(jobDateRaw);

            // Normalize to midnight for comparison
            const jobMidnight = new Date(jobDate);
            jobMidnight.setHours(0, 0, 0, 0);

            const selectedMidnight = new Date(selectedDate);
            selectedMidnight.setHours(0, 0, 0, 0);

            return jobMidnight < selectedMidnight;
        });
    }, [jobs, selectedDate]);

    // Split into assigned and unassigned
    const { assignedJobs, unassignedJobs } = useMemo(() => {
        const assigned = [];
        const unassigned = [];
        const seenIds = new Set(); // Prevent duplicates across categories

        // 1. Process jobs for the selected date
        jobsForDate.forEach(job => {
            if (seenIds.has(job.id)) return;
            seenIds.add(job.id);

            const assignedTechIds = getAssignedTechIds(job);
            if (assignedTechIds.length > 0) {
                assigned.push(job);
            } else {
                unassigned.push(job);
            }
        });

        // 2. Add backlog jobs to unassigned
        backlogJobs.forEach(job => {
            if (seenIds.has(job.id)) return;
            seenIds.add(job.id);
            unassigned.push({ ...job, isOverdue: true }); // Mark as overdue for UI
        });

        // 3. Add unscheduled jobs to unassigned
        unscheduledJobs.forEach(job => {
            if (seenIds.has(job.id)) return;
            seenIds.add(job.id);
            unassigned.push(job);
        });

        // Sort unassigned: Overdue first, then Today, then Unscheduled
        // Actually, maybe better to sort by Date?
        unassigned.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            return 0; // Keep existing order
        });

        return { assignedJobs: assigned, unassignedJobs: unassigned };
    }, [jobsForDate, backlogJobs, unscheduledJobs]);

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

    // Navigation
    const goToDate = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const goToToday = () => {
        setSelectedDate(new Date());
    };

    // Assignment handlers
    const handleAssign = useCallback(async (job, techId, techName) => {
        const tech = teamMembers.find(t => t.id === techId);
        if (!tech) return;

        try {
            // Check if job already has a crew (e.g. dragging an already assigned job to another tech)
            // Decisions:
            // 1. If unassigned -> Create new crew with this tech as lead
            // 2. If assigned -> Add this tech to existing crew? Or Transfer lead?
            //    Standard drag-drop usually implies "Assign this job to X".
            //    If we want "Add X to crew", we use the modal.
            //    But if I drag from Unassigned -> Tech A, it's a new assignment.

            // Simpler approach for Board Drag-Drop: 
            // - If unassigned: New Crew (Tech A as Lead)
            // - If assigned:
            //   - If tech is already in crew: Do nothing?
            //   - If tech is NOT in crew: Add to crew?
            //     Let's default to "Add to or Update Crew" logic.

            // Actually, for the Dispatch Board day view, dragging usually means "Make this person do the job".
            // If I drag a job from Unassigned to Tech A, I expect Tech A to do it.
            // If I drag a job from Tech A to Tech B, I might expect Transfer? 
            // But let's stick to "Add/Assign" via the crew service helper which handles "Assign full crew".

            // Re-creating crew with just this tech (standard single-assign behavior)
            // UNLESS we want to support building crews by dragging?
            // "Add tech to crew" seems safer if we want to support multi-tech.
            // BUT if I drag to Tech B, do I want Tech A removed?
            // Standard behavior usually: replace assignment. 
            // However, the user specifically wants MULTI-TECH support.

            // Let's use `assignCrewToJob` with a SINGLE member for now if it's from unassigned.
            // If it's already assigned, we probably shouldn't be dragging it around easily without clarification.
            // BUT, `handleAssign` is called by `UnassignedColumn`. So it's mostly "Unassigned -> Assigned".

            const newMember = createCrewMember(tech, 'lead');
            // We overwrite existing crew if dragging from unassigned (which implies no crew).
            // If calling from somewhere else, we might need care.
            await assignCrewToJob(job.id, [newMember], 'manual');

            toast.success(`Assigned to ${techName}`);
            onJobUpdate?.();
        } catch (error) {
            console.error('Assign error:', error);
            toast.error('Failed to assign job');
        }
    }, [teamMembers, onJobUpdate]);

    const handleDrop = useCallback(async (jobId, techId, techName) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        // Check for conflicts
        const tech = teamMembers.find(t => t.id === techId);
        if (tech) {
            const { hasErrors, conflicts } = checkConflicts(tech, job, jobsForDate, selectedDate, timezone);
            if (hasErrors) {
                toast.error(conflicts.find(c => c.severity === 'error')?.message || 'Cannot assign');
                return;
            }
            if (conflicts.length > 0) {
                // Show warning but allow
                toast(conflicts[0].message, { icon: '⚠️' });
            }
        }

        // Determine intent:
        // If job is already assigned to someone else, are we adding or moving?
        // Dispatch boards usually 'move' (reassign).
        // To add multiple, use the modal.
        await handleAssign(job, techId, techName);
    }, [jobs, teamMembers, jobsForDate, selectedDate, timezone, handleAssign]);

    const handleUnassign = useCallback(async (job) => {
        try {
            await unassignAllCrew(job.id);
            toast.success('Job unassigned');
            onJobUpdate?.();
        } catch (error) {
            console.error('Unassign error:', error);
            toast.error('Failed to unassign');
        }
    }, [onJobUpdate]);

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

            // Bulk assign using new crew logic
            const batchPromises = result.successful.map(async (assignment) => {
                const tech = teamMembers.find(t => t.id === assignment.techId);
                if (!tech) return; // Should not happen
                const newMember = createCrewMember(tech, 'lead');
                return assignCrewToJob(assignment.jobId, [newMember], 'ai');
            });

            await Promise.all(batchPromises);

            toast.success(
                `Assigned ${result.summary.assigned} of ${result.summary.total} jobs`,
                { duration: 3000 }
            );

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

    const isToday = isSameDayInTimezone(selectedDate, new Date(), timezone);

    return (
        <div className="space-y-4">
            {/* Header */}
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
                        <Calendar size={16} />
                        <span>{jobsForDate.length} scheduled</span>
                    </div>
                    {unassignedJobs.length > 0 && (
                        <div className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle size={16} />
                            <span>{unassignedJobs.length} unassigned</span>
                        </div>
                    )}
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
                />

                {/* Tech Columns */}
                {teamMembers.map(tech => (
                    <TechColumn
                        key={tech.id}
                        tech={tech}
                        jobs={jobsByTech[tech.id] || []}
                        date={selectedDate}
                        allJobs={jobsForDate}
                        onDrop={handleDrop}
                        onUnassign={handleUnassign}
                        onOpenCrewModal={setCrewModalJob}
                    />
                ))}

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
        </div>
    );
};

export default DispatchBoard;
