// src/features/contractor-pro/components/TechAssignmentPanel.jsx
// ============================================
// TECH ASSIGNMENT PANEL
// ============================================
// Assign jobs to team members and view workload distribution

import React, { useState, useMemo, useCallback } from 'react';
import {
    Users, User, Calendar, Clock, MapPin,
    ChevronDown, ChevronUp, Check, AlertCircle,
    Briefcase, TrendingUp, Filter, Sparkles, Loader2, Truck
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';
import { getAssignedTechIds, assignCrewToJob, removeTechFromCrew, createCrewMember, CREW_ROLES } from '../lib/crewService';
import { autoAssignAll } from '../lib/schedulingAI';

// ============================================
// HELPERS
// ============================================

// Helper to format duration in minutes to "Xh Ym" format (BUG-029 fix)
const formatDurationMinutes = (minutes) => {
    if (!minutes || minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

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
// WORKLOAD CHART
// ============================================

const WorkloadChart = ({ teamMembers, jobs, dateRange }) => {
    // Calculate workload per team member
    const workload = useMemo(() => {
        const stats = {};

        // Initialize all team members
        teamMembers.forEach(member => {
            stats[member.id] = {
                member,
                jobCount: 0,
                totalMinutes: 0,
                totalRevenue: 0,
                jobs: []
            };
        });

        // Add unassigned bucket
        stats['unassigned'] = {
            member: { id: 'unassigned', name: 'Unassigned', color: '#94A3B8' },
            jobCount: 0,
            totalMinutes: 0,
            totalRevenue: 0,
            jobs: []
        };

        // Count jobs
        jobs.forEach(job => {
            const assignedTechIds = getAssignedTechIds(job);

            if (assignedTechIds.length > 0) {
                // Job is assigned to one or more techs
                let assignedToKnownTech = false;
                assignedTechIds.forEach(techId => {
                    if (stats[techId]) {
                        assignedToKnownTech = true;
                        stats[techId].jobCount++;
                        // For multi-tech jobs, we might want to split or duplicate stats.
                        // Duplicating for now to show load on schedule.
                        stats[techId].totalMinutes += job.estimatedDuration || 120;

                        // Revenue might be split, but usually we just show total value associated
                        stats[techId].totalRevenue += job.total || 0;
                        stats[techId].jobs.push(job);
                    }
                });
                // BUG-027/028 fix: Jobs assigned to non-existent team members should show as unassigned
                if (!assignedToKnownTech) {
                    stats['unassigned'].jobCount++;
                    stats['unassigned'].totalMinutes += job.estimatedDuration || 120;
                    stats['unassigned'].totalRevenue += job.total || 0;
                    stats['unassigned'].jobs.push(job);
                }
            } else {
                // Job is completely unassigned
                stats['unassigned'].jobCount++;
                stats['unassigned'].totalMinutes += job.estimatedDuration || 120;
                stats['unassigned'].totalRevenue += job.total || 0;
                stats['unassigned'].jobs.push(job);
            }
        });

        return Object.values(stats);
    }, [teamMembers, jobs]);

    const maxJobs = Math.max(...workload.map(w => w.jobCount), 1);

    return (
        <div className="space-y-3">
            {workload.map(({ member, jobCount, totalMinutes, totalRevenue }) => (
                <div key={member.id} className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: member.color || '#64748B' }}
                    >
                        {member.name?.charAt(0) || '?'}
                    </div>

                    {/* Name and stats */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-800 truncate">
                                {member.name}
                            </span>
                            <span className="text-xs text-slate-500">
                                {jobCount} jobs • {formatDurationMinutes(totalMinutes)}
                            </span>
                        </div>

                        {/* Bar */}
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${(jobCount / maxJobs) * 100}%`,
                                    backgroundColor: member.color || '#64748B'
                                }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// UNASSIGNED JOBS LIST
// ============================================

const UnassignedJobsList = ({ jobs, teamMembers, onAssign, vehicles = [], preferences = {}, recentlyAssigned = new Set() }) => {
    const [expandedJob, setExpandedJob] = useState(null);
    const [selectedMembers, setSelectedMembers] = useState({}); // { jobId: [{ techId, role }] }
    const [selectedVehicles, setSelectedVehicles] = useState({}); // { jobId: vehicleId }
    const [assigning, setAssigning] = useState(null); // jobId currently being assigned

    const toggleMember = (jobId, techId) => {
        setSelectedMembers(prev => {
            const current = prev[jobId] || [];
            const exists = current.find(m => m.techId === techId);
            if (exists) {
                return { ...prev, [jobId]: current.filter(m => m.techId !== techId) };
            } else {
                const role = current.length === 0 ? 'lead' : 'helper';
                return { ...prev, [jobId]: [...current, { techId, role }] };
            }
        });
    };

    const updateRole = (jobId, techId, role) => {
        setSelectedMembers(prev => {
            const current = prev[jobId] || [];
            return { ...prev, [jobId]: current.map(m => m.techId === techId ? { ...m, role } : m) };
        });
    };

    const handleMultiAssign = async (jobId) => {
        const members = selectedMembers[jobId] || [];
        if (members.length === 0) return;

        setAssigning(jobId);
        try {
            const crew = members.map(m => {
                const tech = teamMembers.find(t => t.id === m.techId);
                return createCrewMember(tech, m.role);
            });

            // Include vehicle if selected
            const vehicleId = selectedVehicles[jobId];
            if (vehicleId && crew.length > 0) {
                const vehicle = vehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                    crew[0].vehicleId = vehicle.id;
                    crew[0].vehicleName = vehicle.name;
                }
            }

            // BUG-042 Fix: Pass workingHours so multi-day schedule can be created
            await assignCrewToJob(jobId, crew, 'manual', { workingHours: preferences?.workingHours });

            // BUG-043 Fix: Update job status to 'scheduled' if it has a date
            const job = jobs.find(j => j.id === jobId);
            if (job && (job.scheduledTime || job.scheduledDate)) {
                const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
                await updateDoc(jobRef, {
                    status: 'scheduled',
                    lastActivity: serverTimestamp()
                });
            }

            toast.success(`Crew of ${crew.length} assigned!`);
            setSelectedMembers(prev => { const next = { ...prev }; delete next[jobId]; return next; });
            setSelectedVehicles(prev => { const next = { ...prev }; delete next[jobId]; return next; });
            onAssign(jobId, members[0].techId, true); // signal success for animation
        } catch (error) {
            console.error('Error assigning crew:', error);
            toast.error('Failed to assign crew');
        } finally {
            setAssigning(null);
        }
    };

    if (jobs.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <Check size={24} className="mx-auto mb-2" />
                <p className="text-sm">All jobs assigned!</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {jobs.map(job => {
                const isRecentlyAssigned = recentlyAssigned.has(job.id);
                const isAssigning = assigning === job.id;
                const jobMembers = selectedMembers[job.id] || [];

                // Calculate availability for each team member based on job's scheduled date
                const jobDate = job.scheduledTime || job.scheduledDate
                    ? new Date(job.scheduledTime || job.scheduledDate)
                    : null;
                const jobDayName = jobDate
                    ? jobDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
                    : null;

                const membersWithAvailability = teamMembers.map(member => {
                    if (!jobDayName) return { ...member, isAvailable: true, hours: 'Date TBD' };
                    const dayConfig = member.workingHours?.[jobDayName];
                    const isAvailable = dayConfig?.enabled !== false;
                    const hours = isAvailable
                        ? `${dayConfig?.start || '8:00'} - ${dayConfig?.end || '17:00'}`
                        : 'Off';
                    return { ...member, isAvailable, hours };
                }).sort((a, b) => (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0));

                return (
                    <div
                        key={job.id}
                        className={`bg-white border rounded-xl overflow-hidden transition-all duration-500 ${
                            isRecentlyAssigned
                                ? 'border-emerald-300 bg-emerald-50 scale-[0.98] opacity-60'
                                : 'border-slate-200'
                        }`}
                    >
                        <button
                            onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                            className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    isRecentlyAssigned ? 'bg-emerald-100' : 'bg-amber-100'
                                }`}>
                                    {isRecentlyAssigned
                                        ? <Check size={16} className="text-emerald-600" />
                                        : <AlertCircle size={16} className="text-amber-600" />
                                    }
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="font-medium text-slate-800 truncate">
                                        {job.title || job.description || 'Service'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {job.scheduledTime
                                            ? new Date(job.scheduledTime).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            })
                                            : 'Not scheduled'
                                        }
                                        {job.crewRequirements?.required > 1 && (
                                            <span className="ml-2 text-amber-600 font-medium">
                                                • {job.crewRequirements.required} crew needed
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            {expandedJob === job.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {expandedJob === job.id && !isRecentlyAssigned && (
                            <div className="p-3 pt-0 border-t border-slate-100">
                                <p className="text-xs font-medium text-slate-500 mb-2">
                                    Select crew {job.crewRequirements?.required > 1 && (
                                        <span className="text-amber-600">({jobMembers.length}/{job.crewRequirements.required} selected)</span>
                                    )}
                                </p>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {membersWithAvailability.map(member => {
                                        const isSelected = jobMembers.some(m => m.techId === member.id);
                                        const memberRole = jobMembers.find(m => m.techId === member.id)?.role || 'helper';

                                        return (
                                            <div
                                                key={member.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                                                    isSelected
                                                        ? 'bg-emerald-50 border border-emerald-200'
                                                        : member.isAvailable
                                                            ? 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                                                            : 'bg-slate-50 opacity-50 border border-transparent'
                                                }`}
                                            >
                                                <button
                                                    onClick={() => member.isAvailable && toggleMember(job.id, member.id)}
                                                    disabled={!member.isAvailable}
                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                        isSelected
                                                            ? 'border-emerald-500 bg-emerald-500'
                                                            : member.isAvailable
                                                                ? 'border-slate-300 hover:border-emerald-400'
                                                                : 'border-slate-200 cursor-not-allowed'
                                                    }`}
                                                >
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </button>
                                                <div
                                                    className="w-4 h-4 rounded-full shrink-0"
                                                    style={{ backgroundColor: member.color || '#64748B' }}
                                                />
                                                <span className={`text-sm flex-1 ${isSelected ? 'text-emerald-800 font-medium' : 'text-slate-700'}`}>
                                                    {member.name}
                                                </span>
                                                <span className={`text-[10px] ${member.isAvailable ? 'text-slate-400' : 'text-red-400 font-medium'}`}>
                                                    {member.hours}
                                                </span>
                                                {isSelected && (
                                                    <select
                                                        value={memberRole}
                                                        onChange={(e) => updateRole(job.id, member.id, e.target.value)}
                                                        className="text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {CREW_ROLES.map(r => (
                                                            <option key={r.id} value={r.id}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Vehicle selector */}
                                {vehicles.length > 0 && (
                                    <div className="mt-3">
                                        <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                                            <Truck size={10} /> Vehicle
                                        </label>
                                        <select
                                            value={selectedVehicles[job.id] || ''}
                                            onChange={(e) => setSelectedVehicles(prev => ({ ...prev, [job.id]: e.target.value }))}
                                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                                        >
                                            <option value="">None</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name}{v.type ? ` (${v.type})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Assign Button */}
                                <button
                                    onClick={() => handleMultiAssign(job.id)}
                                    disabled={jobMembers.length === 0 || isAssigning}
                                    className="mt-3 w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                                >
                                    {isAssigning ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Assigning...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            Assign {jobMembers.length} Member{jobMembers.length !== 1 ? 's' : ''}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ============================================
// TEAM MEMBER SCHEDULE
// ============================================

const TeamMemberSchedule = ({ member, jobs, onUnassign }) => {
    const [expanded, setExpanded] = useState(false);

    // Sort jobs by time
    const sortedJobs = [...jobs].sort((a, b) => {
        const timeA = new Date(a.scheduledTime || a.scheduledDate || 0);
        const timeB = new Date(b.scheduledTime || b.scheduledDate || 0);
        return timeA - timeB;
    });

    const totalMinutes = jobs.reduce((sum, j) => sum + (j.estimatedDuration || 120), 0);
    const totalRevenue = jobs.reduce((sum, j) => sum + (j.total || 0), 0);

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: member.color || '#64748B' }}
                    >
                        {member.name?.charAt(0) || '?'}
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-slate-800">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.role || 'Technician'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">{jobs.length} jobs</p>
                        <p className="text-xs text-slate-500">{formatDurationMinutes(totalMinutes)} work</p>
                    </div>
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100">
                    {sortedJobs.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            No jobs assigned
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {sortedJobs.map(job => (
                                <div key={job.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 text-sm truncate">
                                            {job.title || job.description || 'Service'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                            <Clock size={10} />
                                            <span>
                                                {job.scheduledTime
                                                    ? new Date(job.scheduledTime).toLocaleTimeString('en-US', {
                                                        hour: 'numeric',
                                                        minute: '2-digit'
                                                    })
                                                    : 'TBD'
                                                }
                                            </span>
                                            {safeAddress(job.customer?.address) && (
                                                <>
                                                    <MapPin size={10} />
                                                    <span className="truncate">{safeAddress(job.customer.address).split(',')[0]}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onUnassign(job.id, member.id)}
                                        className="px-2 py-1 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    <div className="p-3 bg-slate-50 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Total Revenue</span>
                        <span className="font-bold text-emerald-600">${totalRevenue.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN TECH ASSIGNMENT PANEL
// ============================================

export const TechAssignmentPanel = ({
    jobs = [],
    teamMembers = [],
    vehicles = [],
    preferences = {},
    onJobUpdate
}) => {
    const [view, setView] = useState('overview'); // 'overview' | 'unassigned' | 'team'
    const [recentlyAssigned, setRecentlyAssigned] = useState(new Set());
    const [autoAssignResults, setAutoAssignResults] = useState(null);
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);

    // Separate jobs by assignment status
    const { assignedJobs, unassignedJobs, jobsByMember } = useMemo(() => {
        const assigned = [];
        const unassigned = [];
        const byMember = {};

        // Initialize member buckets
        teamMembers.forEach(m => {
            byMember[m.id] = [];
        });

        jobs.forEach(job => {
            if (['completed', 'cancelled'].includes(job.status)) return;

            const assignedTechIds = getAssignedTechIds(job);

            if (assignedTechIds.length > 0) {
                assigned.push(job);
                assignedTechIds.forEach(techId => {
                    if (byMember[techId]) {
                        byMember[techId].push(job);
                    }
                });
            } else {
                unassigned.push(job);
            }
        });

        return { assignedJobs: assigned, unassignedJobs: unassigned, jobsByMember: byMember };
    }, [jobs, teamMembers]);

    // Handle assignment with success animation
    const handleAssign = useCallback((jobId, memberId, isMultiAssign = false) => {
        // Add to recently assigned for animation
        setRecentlyAssigned(prev => new Set([...prev, jobId]));
        setTimeout(() => {
            setRecentlyAssigned(prev => {
                const next = new Set(prev);
                next.delete(jobId);
                return next;
            });
            if (onJobUpdate) onJobUpdate();
        }, 1500);
    }, [onJobUpdate]);

    // Auto-assign all unassigned jobs
    // Handles both scheduled (has date) and unscheduled (needs date) jobs
    const handleAutoAssign = useCallback(async () => {
        if (unassignedJobs.length === 0) {
            toast.error('No unassigned jobs to assign');
            return;
        }

        setIsAutoAssigning(true);
        try {
            // Find the next available working day (skip days where all techs are off)
            const findNextWorkingDay = (startDate) => {
                let candidate = new Date(startDate);
                for (let i = 0; i < 14; i++) { // Look up to 2 weeks ahead
                    const dayName = candidate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    // Check if at least one tech works this day
                    const anyTechAvailable = teamMembers.some(tech => {
                        if (!tech.workingHours) return true; // No schedule = available
                        const dayConfig = tech.workingHours[dayName];
                        if (dayConfig === undefined) return true; // Not configured = available
                        return dayConfig.enabled !== false;
                    });
                    if (anyTechAvailable) return candidate;
                    candidate = new Date(candidate);
                    candidate.setDate(candidate.getDate() + 1);
                }
                return startDate; // Fallback to original date
            };

            // For jobs without a scheduled date, assign the next available working day
            const jobsToAssign = unassignedJobs.map(job => {
                if (job.scheduledTime || job.scheduledDate) return job;
                // No date set — find the next working day starting from today
                const nextDay = findNextWorkingDay(new Date());
                return {
                    ...job,
                    _autoAssignDate: nextDay // Temporary field for scheduling
                };
            });

            // Group jobs by their target date and run autoAssignAll for each date
            const jobsByDate = {};
            jobsToAssign.forEach(job => {
                const targetDate = job._autoAssignDate ||
                    (job.scheduledTime ? new Date(job.scheduledTime) :
                     job.scheduledDate ? new Date(job.scheduledDate) : new Date());
                const dateKey = targetDate.toISOString().split('T')[0];
                if (!jobsByDate[dateKey]) jobsByDate[dateKey] = { date: targetDate, jobs: [] };
                jobsByDate[dateKey].jobs.push(job);
            });

            // Spread jobs across multiple days if too many for one day
            const allResults = { assignments: [], successful: [], failed: [], summary: { total: 0, assigned: 0, unassigned: 0 } };
            const maxJobsPerDay = teamMembers.reduce((sum, t) => sum + (t.maxJobsPerDay || 4), 0);

            let currentDate = findNextWorkingDay(new Date());
            let dayJobCount = 0;
            const spreadJobs = [];

            for (const job of jobsToAssign) {
                if (dayJobCount >= maxJobsPerDay) {
                    // Move to next working day
                    const nextDay = new Date(currentDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    currentDate = findNextWorkingDay(nextDay);
                    dayJobCount = 0;
                }
                spreadJobs.push({ ...job, _autoAssignDate: new Date(currentDate) });
                dayJobCount++;
            }

            // Group spread jobs by date
            const spreadByDate = {};
            spreadJobs.forEach(job => {
                const dateKey = job._autoAssignDate.toISOString().split('T')[0];
                if (!spreadByDate[dateKey]) spreadByDate[dateKey] = { date: job._autoAssignDate, jobs: [] };
                spreadByDate[dateKey].jobs.push(job);
            });

            for (const [, { date, jobs: dateJobs }] of Object.entries(spreadByDate)) {
                const result = autoAssignAll(dateJobs, teamMembers, assignedJobs, date);
                allResults.assignments.push(...result.assignments);
                allResults.successful.push(...result.successful);
                allResults.failed.push(...result.failed);
            }

            allResults.summary = {
                total: allResults.assignments.length,
                assigned: allResults.successful.length,
                unassigned: allResults.failed.length
            };

            setAutoAssignResults(allResults);
        } catch (error) {
            console.error('Auto-assign error:', error);
            toast.error('Failed to generate assignments');
        } finally {
            setIsAutoAssigning(false);
        }
    }, [unassignedJobs, teamMembers, assignedJobs]);

    // Apply auto-assign results
    const applyAutoAssignments = useCallback(async (assignments) => {
        let successCount = 0;
        for (const assignment of assignments) {
            if (assignment.failed) continue;
            try {
                const crew = (assignment.techIds || [assignment.techId]).map((techId, i) => {
                    const tech = teamMembers.find(t => t.id === techId);
                    if (!tech) return null;
                    return createCrewMember(tech, i === 0 ? 'lead' : 'helper');
                }).filter(Boolean);

                if (crew.length > 0) {
                    // BUG-042 Fix: Pass workingHours so multi-day schedule can be created
                    await assignCrewToJob(assignment.jobId, crew, 'ai', { workingHours: preferences?.workingHours });

                    // Update job status and date info
                    const job = assignment.job;
                    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, assignment.jobId);

                    if (job && !job.scheduledTime && !job.scheduledDate && job._autoAssignDate) {
                        // Job didn't have a scheduled date - set one from the auto-assign
                        await updateDoc(jobRef, {
                            scheduledDate: job._autoAssignDate.toISOString().split('T')[0],
                            scheduledTime: job._autoAssignDate.toISOString(),
                            assignedBy: 'ai',
                            status: 'scheduled',
                            lastActivity: serverTimestamp()
                        });
                    } else if (job && (job.scheduledTime || job.scheduledDate)) {
                        // BUG-043 Fix: Job already had a date but was unassigned - update status to scheduled
                        await updateDoc(jobRef, {
                            assignedBy: 'ai',
                            status: 'scheduled',
                            lastActivity: serverTimestamp()
                        });
                    }

                    successCount++;
                    setRecentlyAssigned(prev => new Set([...prev, assignment.jobId]));
                }
            } catch (error) {
                console.error(`Failed to assign job ${assignment.jobId}:`, error);
            }
        }
        toast.success(`${successCount} job${successCount !== 1 ? 's' : ''} assigned!`);
        setAutoAssignResults(null);
        setTimeout(() => {
            setRecentlyAssigned(new Set());
            if (onJobUpdate) onJobUpdate();
        }, 1500);
    }, [teamMembers, preferences, onJobUpdate]);

    // Handle unassignment
    const handleUnassign = async (jobId, memberId) => {
        // Find the job to get current crew context (needed for removeTechFromCrew logic)
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        try {
            await removeTechFromCrew(jobId, job, memberId);
            toast.success('Job unassigned');
            if (onJobUpdate) onJobUpdate();
        } catch (error) {
            console.error('Error unassigning job:', error);
            toast.error('Failed to unassign job');
        }
    };

    if (teamMembers.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-2xl">
                <Users size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-600">No team members</p>
                <p className="text-sm text-slate-400 mt-1">
                    Add team members in Settings to enable assignment
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Team Assignments</h2>
                    <p className="text-sm text-slate-500">
                        {unassignedJobs.length} unassigned • {assignedJobs.length} assigned
                    </p>
                </div>
                {unassignedJobs.length > 0 && (
                    <button
                        onClick={handleAutoAssign}
                        disabled={isAutoAssigning || unassignedJobs.filter(j => j.scheduledTime || j.scheduledDate).length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                        {isAutoAssigning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        Auto-Assign
                    </button>
                )}
            </div>

            {/* View Tabs */}
            <div className="flex bg-slate-100 rounded-xl p-1">
                <button
                    onClick={() => setView('overview')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${view === 'overview'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <TrendingUp size={14} className="inline mr-2" />
                    Overview
                </button>
                <button
                    onClick={() => setView('unassigned')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${view === 'unassigned'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <AlertCircle size={14} className="inline mr-2" />
                    Unassigned
                    {unassignedJobs.length > 0 && (
                        <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                            {unassignedJobs.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setView('team')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${view === 'team'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Users size={14} className="inline mr-2" />
                    By Team
                </button>
            </div>

            {/* Content */}
            {view === 'overview' && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="font-bold text-slate-800 mb-4">Workload Distribution</h3>
                    <WorkloadChart
                        teamMembers={teamMembers}
                        jobs={[...assignedJobs, ...unassignedJobs]}
                    />
                </div>
            )}

            {view === 'unassigned' && (
                <UnassignedJobsList
                    jobs={unassignedJobs}
                    teamMembers={teamMembers}
                    vehicles={vehicles}
                    preferences={preferences}
                    recentlyAssigned={recentlyAssigned}
                    onAssign={handleAssign}
                />
            )}

            {view === 'team' && (
                <div className="space-y-3">
                    {teamMembers.map(member => (
                        <TeamMemberSchedule
                            key={member.id}
                            member={member}
                            jobs={jobsByMember[member.id] || []}
                            onUnassign={handleUnassign}
                        />
                    ))}
                </div>
            )}

            {/* Auto-Assign Results Modal */}
            {autoAssignResults && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAutoAssignResults(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Sparkles size={18} className="text-purple-600" />
                                    AI Assignment Suggestions
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {autoAssignResults.summary?.assigned || 0} of {autoAssignResults.summary?.total || 0} jobs can be assigned
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            {(autoAssignResults.assignments || []).map((assignment, idx) => {
                                const tech = teamMembers.find(t => t.id === (assignment.techId || assignment.techIds?.[0]));
                                const job = unassignedJobs.find(j => j.id === assignment.jobId);
                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-xl border ${
                                            assignment.failed
                                                ? 'border-red-200 bg-red-50'
                                                : 'border-emerald-200 bg-emerald-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-slate-800 text-sm truncate flex-1">
                                                {job?.title || job?.description || 'Job'}
                                            </p>
                                            {!assignment.failed && (
                                                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                    Score: {assignment.score || 0}
                                                </span>
                                            )}
                                        </div>
                                        {assignment.failed ? (
                                            <p className="text-xs text-red-600 mt-1">
                                                {assignment.warnings?.[0] || assignment.reason || 'No suitable tech available'}
                                            </p>
                                        ) : (
                                            <div className="mt-1">
                                                <p className="text-xs text-emerald-700 flex items-center gap-1">
                                                    <User size={10} />
                                                    {assignment.techName || tech?.name || 'Unknown'}
                                                    {assignment.techIds?.length > 1 && ` + ${assignment.techIds.length - 1} more`}
                                                </p>
                                                {assignment.reasons?.length > 0 && (
                                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                        {assignment.reasons[0]}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setAutoAssignResults(null)}
                                className="flex-1 px-4 py-2.5 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => applyAutoAssignments(autoAssignResults.assignments || [])}
                                disabled={(autoAssignResults.assignments || []).filter(a => !a.failed).length === 0}
                                className="flex-1 px-4 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Check size={16} />
                                Apply {(autoAssignResults.assignments || []).filter(a => !a.failed).length} Assignments
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechAssignmentPanel;
