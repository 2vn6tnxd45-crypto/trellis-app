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

const isSameDay = (d1, d2) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
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
                </div>
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
                                    className={`h-full rounded-full transition-all ${
                                        capacityPercent >= 100 ? 'bg-red-500' : 
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
                                    className={`h-full rounded-full transition-all ${
                                        hoursPercent >= 100 ? 'bg-red-500' : 
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
    initialDate = new Date(),
    onJobUpdate
}) => {
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    
    // Filter jobs for selected date
    const jobsForDate = useMemo(() => {
        return jobs.filter(job => {
            if (!job.scheduledDate) return false;
            const jobDate = job.scheduledDate.toDate ? job.scheduledDate.toDate() : new Date(job.scheduledDate);
            return isSameDay(jobDate, selectedDate);
        });
    }, [jobs, selectedDate]);
    
    // Also include unscheduled jobs that need assignment
    const unscheduledJobs = useMemo(() => {
        return jobs.filter(job => 
            !job.scheduledDate && 
            ['pending_schedule', 'slots_offered', 'accepted', 'quoted'].includes(job.status)
        );
    }, [jobs]);
    
    // Split into assigned and unassigned
    const { assignedJobs, unassignedJobs } = useMemo(() => {
        const assigned = jobsForDate.filter(j => j.assignedTechId);
        const unassigned = [...jobsForDate.filter(j => !j.assignedTechId), ...unscheduledJobs];
        return { assignedJobs: assigned, unassignedJobs: unassigned };
    }, [jobsForDate, unscheduledJobs]);
    
    // Group assigned jobs by tech
    const jobsByTech = useMemo(() => {
        const map = {};
        teamMembers.forEach(tech => {
            map[tech.id] = assignedJobs.filter(j => j.assignedTechId === tech.id);
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
        try {
            await assignJobToTech(job.id, techId, techName, 'manual');
            toast.success(`Assigned to ${techName}`);
            onJobUpdate?.();
        } catch (error) {
            toast.error('Failed to assign job');
        }
    }, [onJobUpdate]);
    
    const handleDrop = useCallback(async (jobId, techId, techName) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;
        
        // Check for conflicts
        const tech = teamMembers.find(t => t.id === techId);
        if (tech) {
            const { hasErrors, conflicts } = checkConflicts(tech, job, jobsForDate, selectedDate);
            if (hasErrors) {
                toast.error(conflicts.find(c => c.severity === 'error')?.message || 'Cannot assign');
                return;
            }
            if (conflicts.length > 0) {
                // Show warning but allow
                toast(conflicts[0].message, { icon: '⚠️' });
            }
        }
        
        await handleAssign(job, techId, techName);
    }, [jobs, teamMembers, jobsForDate, selectedDate, handleAssign]);
    
    const handleUnassign = useCallback(async (job) => {
        try {
            await unassignJob(job.id);
            toast.success('Job unassigned');
            onJobUpdate?.();
        } catch (error) {
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
            
            await bulkAssignJobs(result.successful);
            
            toast.success(
                `Assigned ${result.summary.assigned} of ${result.summary.total} jobs`,
                { duration: 3000 }
            );
            
            if (result.failed.length > 0) {
                toast(`${result.failed.length} jobs couldn't be assigned`, { icon: '⚠️' });
            }
            
            onJobUpdate?.();
        } catch (error) {
            toast.error('Auto-assign failed');
        } finally {
            setIsAutoAssigning(false);
        }
    }, [unassignedJobs, teamMembers, assignedJobs, selectedDate, onJobUpdate]);
    
    const isToday = isSameDay(selectedDate, new Date());
    
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
        </div>
    );
};

export default DispatchBoard;
