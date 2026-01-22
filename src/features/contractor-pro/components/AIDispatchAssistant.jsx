// src/features/contractor-pro/components/AIDispatchAssistant.jsx
// ============================================
// AI DISPATCH ASSISTANT COMPONENT
// ============================================
// Priority 2.3: AI-powered schedule proposals

import React, { useState } from 'react';
import {
    Sparkles, Calendar, Users, Clock, MapPin, Check, X,
    AlertTriangle, ChevronRight, RefreshCw, Play, Zap,
    TrendingUp, TrendingDown, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAIDispatch } from '../hooks/useAIDispatch';
import { useTeam } from '../hooks/useTeam';
import { useJobs } from '../hooks/useJobs';

// ============================================
// PROPOSAL ASSIGNMENT CARD
// ============================================
const AssignmentCard = ({ assignment, onApprove, onReject }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <p className="font-bold text-slate-800">{assignment.jobNumber || 'New Job'}</p>
                    <p className="text-sm text-slate-500">{assignment.title}</p>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => onApprove(assignment)}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    >
                        <Check size={16} />
                    </button>
                    <button
                        onClick={() => onReject(assignment)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                    <Users size={14} />
                    <span className="font-medium">{assignment.techName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                    <Clock size={14} />
                    <span>{assignment.scheduledStartTime} - {assignment.scheduledEndTime}</span>
                </div>
                {assignment.address && (
                    <div className="flex items-center gap-2 text-slate-500">
                        <MapPin size={14} />
                        <span className="truncate">{assignment.address}</span>
                    </div>
                )}
            </div>

            {assignment.reason && (
                <div className="mt-3 p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">{assignment.reason}</p>
                </div>
            )}

            {assignment.warnings && assignment.warnings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {assignment.warnings.map((warning, i) => (
                        <span key={i} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full text-xs">
                            {warning.message}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// CONFLICT CARD
// ============================================
const ConflictCard = ({ conflict }) => {
    return (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                <div>
                    <p className="font-medium text-red-800">{conflict.jobId}</p>
                    <p className="text-sm text-red-600 mt-1">{conflict.issue}</p>
                    {conflict.suggestion && (
                        <p className="text-sm text-red-500 mt-2 italic">{conflict.suggestion}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// METRICS DISPLAY
// ============================================
const MetricsDisplay = ({ metrics }) => {
    if (!metrics) return null;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Jobs Assigned</p>
                <p className="text-2xl font-bold text-emerald-600">{metrics.totalJobsAssigned}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Conflicts</p>
                <p className={`text-2xl font-bold ${metrics.conflictCount > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                    {metrics.conflictCount}
                </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Avg Utilization</p>
                <p className="text-2xl font-bold text-slate-800">{metrics.averageUtilization}%</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Scheduled Time</p>
                <p className="text-2xl font-bold text-slate-800">
                    {Math.round(metrics.totalScheduledMinutes / 60)}h
                </p>
            </div>
        </div>
    );
};

// ============================================
// TECH BREAKDOWN
// ============================================
const TechBreakdown = ({ breakdown }) => {
    if (!breakdown) return null;

    const techs = Object.values(breakdown);

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-3">Tech Workload</h3>
            <div className="space-y-3">
                {techs.map(tech => (
                    <div key={tech.name} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                            {tech.name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-slate-800">{tech.name}</p>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                <span>{tech.assignedJobs} jobs</span>
                                <span>{Math.round(tech.totalMinutes / 60)}h scheduled</span>
                            </div>
                        </div>
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.round(tech.totalMinutes / 480 * 100))}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const AIDispatchAssistant = ({ contractorId }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [approvedAssignments, setApprovedAssignments] = useState([]);
    const [rejectedAssignments, setRejectedAssignments] = useState([]);

    const {
        loading,
        error,
        currentProposal,
        generateProposal,
        applyProposal,
        clearProposal
    } = useAIDispatch(contractorId);

    const { members } = useTeam(contractorId);
    const { stats: jobStats } = useJobs(contractorId, { date: selectedDate });

    // Generate proposal
    const handleGenerateProposal = async () => {
        try {
            setApprovedAssignments([]);
            setRejectedAssignments([]);
            await generateProposal(selectedDate, { includeUnscheduled: true });
            toast.success('Schedule proposal generated');
        } catch (err) {
            toast.error('Failed to generate proposal');
        }
    };

    // Approve single assignment
    const handleApproveAssignment = (assignment) => {
        setApprovedAssignments([...approvedAssignments, assignment.jobId]);
        setRejectedAssignments(rejectedAssignments.filter(id => id !== assignment.jobId));
    };

    // Reject single assignment
    const handleRejectAssignment = (assignment) => {
        setRejectedAssignments([...rejectedAssignments, assignment.jobId]);
        setApprovedAssignments(approvedAssignments.filter(id => id !== assignment.jobId));
    };

    // Approve all
    const handleApproveAll = () => {
        const allIds = currentProposal?.proposal?.assignments?.map(a => a.jobId) || [];
        setApprovedAssignments(allIds);
        setRejectedAssignments([]);
    };

    // Apply approved assignments
    const handleApplyProposal = async () => {
        if (approvedAssignments.length === 0) {
            toast.error('No assignments approved');
            return;
        }

        try {
            // Filter proposal to only approved assignments
            const filteredProposal = {
                ...currentProposal.proposal,
                assignments: currentProposal.proposal.assignments.filter(a =>
                    approvedAssignments.includes(a.jobId)
                )
            };

            await applyProposal(selectedDate, filteredProposal);
            toast.success(`Applied ${approvedAssignments.length} assignments`);
            clearProposal();
        } catch (err) {
            toast.error('Failed to apply proposal');
        }
    };

    const proposal = currentProposal?.proposal;
    const metrics = currentProposal?.metrics;
    const assignments = proposal?.assignments || [];
    const conflicts = proposal?.conflicts || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                        <Sparkles className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">AI Dispatch Assistant</h1>
                        <p className="text-slate-500">Let AI optimize your daily schedule</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                        onClick={handleGenerateProposal}
                        disabled={loading}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            <Zap size={18} />
                        )}
                        Generate Schedule
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Available Techs</p>
                    <p className="text-2xl font-bold text-slate-800">{members.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Scheduled Jobs</p>
                    <p className="text-2xl font-bold text-slate-800">{jobStats.scheduled}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Unscheduled</p>
                    <p className="text-2xl font-bold text-orange-500">{jobStats.unscheduled}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Running Late</p>
                    <p className={`text-2xl font-bold ${jobStats.runningLate > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                        {jobStats.runningLate}
                    </p>
                </div>
            </div>

            {/* No Proposal State */}
            {!proposal && !loading && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-8 text-center">
                    <Sparkles className="mx-auto h-12 w-12 text-purple-400 mb-4" />
                    <h3 className="font-bold text-slate-800 mb-2">Ready to optimize your schedule</h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                        The AI assistant will analyze your unscheduled jobs, team skills, and existing appointments
                        to create an optimal schedule for {new Date(selectedDate).toLocaleDateString()}.
                    </p>
                    <button
                        onClick={handleGenerateProposal}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700"
                    >
                        Generate Schedule Proposal
                    </button>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                    <div className="animate-pulse">
                        <div className="flex justify-center mb-4">
                            <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <Sparkles className="text-purple-500 animate-spin" size={24} />
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-800 mb-2">AI is analyzing your schedule...</h3>
                        <p className="text-slate-500">
                            Checking skills, certifications, travel times, and SLAs
                        </p>
                    </div>
                </div>
            )}

            {/* Proposal Results */}
            {proposal && !loading && (
                <div className="space-y-6">
                    {/* AI Reasoning */}
                    {currentProposal.aiReasoning && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 p-4">
                            <div className="flex items-start gap-3">
                                <Sparkles className="text-purple-500 flex-shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="font-medium text-purple-800">AI Reasoning</p>
                                    <p className="text-sm text-purple-700 mt-1">{currentProposal.aiReasoning}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Metrics */}
                    <MetricsDisplay metrics={metrics} />

                    {/* Tech Breakdown */}
                    <TechBreakdown breakdown={metrics?.techBreakdown} />

                    {/* Action Bar */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-500">
                                {approvedAssignments.length} of {assignments.length} approved
                            </span>
                            <button
                                onClick={handleApproveAll}
                                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Approve All
                            </button>
                            <button
                                onClick={clearProposal}
                                className="text-sm text-slate-500 hover:text-slate-700"
                            >
                                Clear
                            </button>
                        </div>
                        <button
                            onClick={handleApplyProposal}
                            disabled={approvedAssignments.length === 0}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Play size={18} />
                            Apply {approvedAssignments.length} Assignments
                        </button>
                    </div>

                    {/* Assignments */}
                    {assignments.length > 0 && (
                        <div>
                            <h3 className="font-bold text-slate-800 mb-3">
                                Proposed Assignments ({assignments.length})
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {assignments.map((assignment, index) => (
                                    <div
                                        key={assignment.jobId || index}
                                        className={`transition-opacity ${rejectedAssignments.includes(assignment.jobId) ? 'opacity-40' : ''
                                            } ${approvedAssignments.includes(assignment.jobId) ? 'ring-2 ring-emerald-500 rounded-xl' : ''
                                            }`}
                                    >
                                        <AssignmentCard
                                            assignment={assignment}
                                            onApprove={handleApproveAssignment}
                                            onReject={handleRejectAssignment}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conflicts */}
                    {conflicts.length > 0 && (
                        <div>
                            <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                                <AlertCircle size={18} />
                                Conflicts ({conflicts.length})
                            </h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                {conflicts.map((conflict, index) => (
                                    <ConflictCard key={index} conflict={conflict} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-4">
                    <div className="flex items-center gap-3 text-red-700">
                        <AlertTriangle size={20} />
                        <p>{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIDispatchAssistant;
