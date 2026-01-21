// src/features/jobs/components/HomeownerUpcomingServices.jsx
// ============================================
// HOMEOWNER UPCOMING SERVICES
// ============================================
// Shows upcoming jobs linked to homeowner's account
// Works with jobs created directly by contractors (via email link)

import React, { useState, useEffect } from 'react';
import {
    Calendar, Clock, ChevronRight, Building2, MapPin,
    Wrench, AlertCircle, CheckCircle, CalendarDays,
    RefreshCw, Loader2, CalendarClock
} from 'lucide-react';
import { getUpcomingJobsForHomeowner, getJobsForHomeowner } from '../lib/jobService';

// Status configuration for display
const STATUS_CONFIG = {
    pending: {
        label: 'Pending',
        description: 'Waiting to be scheduled',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        icon: Clock
    },
    scheduled: {
        label: 'Scheduled',
        description: 'Appointment confirmed',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        icon: Calendar
    },
    in_progress: {
        label: 'In Progress',
        description: 'Work is underway',
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: Wrench
    },
    on_hold: {
        label: 'On Hold',
        description: 'Temporarily paused',
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Clock
    },
    completed: {
        label: 'Completed',
        description: 'Job finished',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        icon: CheckCircle
    }
};

// Helper to calculate countdown to appointment
const getCountdown = (scheduledTime) => {
    if (!scheduledTime) return null;

    const scheduled = new Date(scheduledTime.toDate ? scheduledTime.toDate() : scheduledTime);
    const now = new Date();
    const diffMs = scheduled - now;

    // If past, return null
    if (diffMs < 0) return null;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const scheduledHour = scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (diffDays === 0) {
        return {
            text: `Today at ${scheduledHour}`,
            urgency: 'today',
            color: 'text-emerald-700',
            bgColor: 'bg-emerald-100'
        };
    } else if (diffDays === 1) {
        return {
            text: `Tomorrow at ${scheduledHour}`,
            urgency: 'tomorrow',
            color: 'text-amber-700',
            bgColor: 'bg-amber-100'
        };
    } else if (diffDays <= 3) {
        return {
            text: `In ${diffDays} days`,
            urgency: 'soon',
            color: 'text-amber-600',
            bgColor: 'bg-amber-50'
        };
    } else if (diffDays <= 7) {
        return {
            text: `In ${diffDays} days`,
            urgency: 'upcoming',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
        };
    } else {
        return {
            text: `In ${diffDays} days`,
            urgency: 'later',
            color: 'text-slate-600',
            bgColor: 'bg-slate-50'
        };
    }
};

// Format date for display
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.toDate ? dateStr.toDate() : dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.toDate ? dateStr.toDate() : dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// Single job card component
const UpcomingJobCard = ({ job, onSelect }) => {
    const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
    const StatusIcon = statusConfig.icon;
    const countdown = job.scheduledTime ? getCountdown(job.scheduledTime) : null;

    // Check if multi-day
    const isMultiDay = job.multiDaySchedule?.totalDays > 1;

    return (
        <div
            onClick={() => onSelect?.(job)}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-800 truncate">
                            {job.title || job.description || 'Service'}
                        </h4>
                        {isMultiDay && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md">
                                <CalendarDays size={10} />
                                {job.multiDaySchedule.totalDays}-Day
                            </span>
                        )}
                    </div>
                    {/* Contractor name */}
                    {job.contractorName && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <Building2 size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-500 truncate">
                                {job.contractorName}
                            </span>
                        </div>
                    )}
                </div>

                {/* Status badge */}
                <span className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${statusConfig.bg} ${statusConfig.text}`}>
                    <StatusIcon size={12} />
                    {statusConfig.label}
                </span>
            </div>

            {/* Address */}
            {job.propertyAddress && (
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <MapPin size={14} className="shrink-0 text-slate-400" />
                    <span className="truncate">{job.propertyAddress}</span>
                </div>
            )}

            {/* Scheduling info */}
            <div className="pt-3 border-t border-slate-100">
                {/* Countdown badge for scheduled jobs */}
                {countdown && job.status === 'scheduled' && (
                    <div className={`flex items-center justify-center gap-2 py-2 rounded-lg mb-2 ${countdown.bgColor}`}>
                        <Clock size={14} className={countdown.color} />
                        <span className={`text-sm font-bold ${countdown.color}`}>
                            {countdown.text}
                        </span>
                    </div>
                )}

                {/* Scheduled time */}
                {job.scheduledTime && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Scheduled:</span>
                        <span className="font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-sm">
                            {formatDate(job.scheduledTime)} • {formatTime(job.scheduledTime)}
                        </span>
                    </div>
                )}

                {/* Pending - no date yet */}
                {!job.scheduledTime && job.status === 'pending' && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                        <CalendarClock size={14} />
                        <span className="text-sm font-medium">Waiting for scheduling</span>
                    </div>
                )}

                {/* In Progress */}
                {job.status === 'in_progress' && (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                        <Wrench size={14} className="animate-pulse" />
                        <span className="text-sm font-medium">Work in progress</span>
                        {job.startedAt && (
                            <span className="text-xs text-blue-500 ml-auto">
                                Started {formatTime(job.startedAt)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Price if available */}
            {job.price && job.price > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Estimated:</span>
                    <span className="font-bold text-slate-800">${job.price.toLocaleString()}</span>
                </div>
            )}

            {/* Tap to view indicator */}
            <div className="mt-3 flex items-center justify-end text-emerald-600 text-xs font-medium">
                <span>View details</span>
                <ChevronRight size={14} />
            </div>
        </div>
    );
};

// Main component
const HomeownerUpcomingServices = ({
    userEmail,
    userId,
    onJobSelect,
    showCompleted = false,
    maxItems = 5,
    className = ''
}) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchJobs = async () => {
            if (!userEmail && !userId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                let result;

                if (showCompleted) {
                    // Get all jobs including completed
                    result = userId
                        ? await getJobsForHomeowner(userId, 'userId')
                        : await getJobsForHomeowner(userEmail, 'email');
                } else {
                    // Get only upcoming jobs
                    result = userId
                        ? await getUpcomingJobsForHomeowner(userId, 'userId')
                        : await getUpcomingJobsForHomeowner(userEmail, 'email');
                }

                if (result.success) {
                    // Sort by scheduled date (soonest first)
                    const sortedJobs = result.jobs.sort((a, b) => {
                        const dateA = a.scheduledTime?.toDate?.() || new Date(a.scheduledTime || a.createdAt);
                        const dateB = b.scheduledTime?.toDate?.() || new Date(b.scheduledTime || b.createdAt);
                        return dateA - dateB;
                    });

                    setJobs(sortedJobs.slice(0, maxItems));
                } else {
                    setError(result.error || 'Failed to load services');
                }
            } catch (err) {
                console.error('[HomeownerUpcomingServices] Error fetching jobs:', err);
                setError('Unable to load scheduled services');
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [userEmail, userId, showCompleted, maxItems]);

    // Loading state
    if (loading) {
        return (
            <div className={`bg-white rounded-2xl border border-slate-200 p-6 ${className}`}>
                <div className="flex items-center justify-center gap-2 text-slate-400">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm">Loading services...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`bg-white rounded-2xl border border-red-200 p-6 ${className}`}>
                <div className="flex items-center justify-center gap-2 text-red-500">
                    <AlertCircle size={20} />
                    <span className="text-sm">{error}</span>
                </div>
            </div>
        );
    }

    // Empty state
    if (jobs.length === 0) {
        return (
            <div className={`bg-white rounded-2xl border border-slate-200 p-6 ${className}`}>
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                        <Calendar size={24} className="text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">No scheduled services</p>
                    <p className="text-sm text-slate-400 mt-1">
                        Services booked with contractors will appear here
                    </p>
                </div>
            </div>
        );
    }

    // Jobs list
    return (
        <div className={className}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CalendarClock size={18} className="text-emerald-600" />
                    {showCompleted ? 'Service History' : 'Upcoming Services'}
                </h3>
                {jobs.length > 0 && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                        {jobs.length} {jobs.length === 1 ? 'service' : 'services'}
                    </span>
                )}
            </div>

            {/* Jobs list */}
            <div className="space-y-3">
                {jobs.map(job => (
                    <UpcomingJobCard
                        key={job.id}
                        job={job}
                        onSelect={onJobSelect}
                    />
                ))}
            </div>

            {/* View all link if showing limited items */}
            {jobs.length >= maxItems && (
                <button
                    onClick={() => onJobSelect?.({ viewAll: true })}
                    className="w-full mt-4 py-2.5 text-emerald-600 font-medium text-sm hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                    View all services
                    <ChevronRight size={16} />
                </button>
            )}
        </div>
    );
};

export default HomeownerUpcomingServices;
