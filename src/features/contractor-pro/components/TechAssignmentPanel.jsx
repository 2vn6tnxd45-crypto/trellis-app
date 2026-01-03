// src/features/contractor-pro/components/TechAssignmentPanel.jsx
// ============================================
// TECH ASSIGNMENT PANEL
// ============================================
// Assign jobs to team members and view workload distribution

import React, { useState, useMemo } from 'react';
import { 
    Users, User, Calendar, Clock, MapPin,
    ChevronDown, ChevronUp, Check, AlertCircle,
    Briefcase, TrendingUp, Filter
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';

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
            const assignee = job.assignedTo || 'unassigned';
            if (stats[assignee]) {
                stats[assignee].jobCount++;
                stats[assignee].totalMinutes += job.estimatedDuration || 120;
                stats[assignee].totalRevenue += job.total || 0;
                stats[assignee].jobs.push(job);
            } else {
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
                                {jobCount} jobs • {Math.round(totalMinutes / 60)}h
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

const UnassignedJobsList = ({ jobs, teamMembers, onAssign }) => {
    const [expandedJob, setExpandedJob] = useState(null);

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
            {jobs.map(job => (
                <div key={job.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <AlertCircle size={16} className="text-amber-600" />
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
                                </p>
                            </div>
                        </div>
                        {expandedJob === job.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    
                    {expandedJob === job.id && (
                        <div className="p-3 pt-0 border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-500 mb-2">Assign to:</p>
                            <div className="flex flex-wrap gap-2">
                                {teamMembers.map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => onAssign(job.id, member.id)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        <div 
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: member.color || '#64748B' }}
                                        />
                                        <span className="text-sm text-slate-700">{member.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
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
                        <p className="text-xs text-slate-500">{Math.round(totalMinutes / 60)}h work</p>
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
                                            {job.customer?.address && (
                                                <>
                                                    <MapPin size={10} />
                                                    <span className="truncate">{job.customer.address.split(',')[0]}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onUnassign(job.id)}
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
    onJobUpdate
}) => {
    const [view, setView] = useState('overview'); // 'overview' | 'unassigned' | 'team'

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
            
            if (job.assignedTo && byMember[job.assignedTo]) {
                assigned.push(job);
                byMember[job.assignedTo].push(job);
            } else {
                unassigned.push(job);
            }
        });
        
        return { assignedJobs: assigned, unassignedJobs: unassigned, jobsByMember: byMember };
    }, [jobs, teamMembers]);

    // Handle assignment
    const handleAssign = async (jobId, memberId) => {
        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, jobId), {
                assignedTo: memberId,
                lastActivity: serverTimestamp()
            });
            toast.success('Job assigned!');
            if (onJobUpdate) onJobUpdate();
        } catch (error) {
            console.error('Error assigning job:', error);
            toast.error('Failed to assign job');
        }
    };

    // Handle unassignment
    const handleUnassign = async (jobId) => {
        try {
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, jobId), {
                assignedTo: null,
                lastActivity: serverTimestamp()
            });
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
            </div>

            {/* View Tabs */}
            <div className="flex bg-slate-100 rounded-xl p-1">
                <button
                    onClick={() => setView('overview')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        view === 'overview' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <TrendingUp size={14} className="inline mr-2" />
                    Overview
                </button>
                <button
                    onClick={() => setView('unassigned')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        view === 'unassigned' 
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
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        view === 'team' 
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
        </div>
    );
};

export default TechAssignmentPanel;
