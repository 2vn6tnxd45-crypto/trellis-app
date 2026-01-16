// src/features/dashboard/components/SchedulingRequiredBanner.jsx
// ============================================
// SCHEDULING REQUIRED BANNER - Prominent time slot selection notification
// ============================================
// Displays at top of dashboard when homeowner has jobs with time slots to choose

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, X, Clock, Briefcase } from 'lucide-react';

// Helper to format slot time
const formatSlotTime = (slot) => {
    if (!slot?.start) return 'Time available';

    const start = new Date(slot.start);
    const end = slot.end ? new Date(slot.end) : null;

    const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    const startTime = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    if (end) {
        const endTime = end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${dateStr}, ${startTime} - ${endTime}`;
    }

    return `${dateStr}, ${startTime}`;
};

// Helper to get contractor initials
const getInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

// Get the slots from a job (handles both nested and top-level)
const getOfferedSlots = (job) => {
    return job?.scheduling?.offeredSlots ||
           job?.offeredTimeSlots ||
           [];
};

export const SchedulingRequiredBanner = ({ jobs = [], onJobClick }) => {
    const [dismissed, setDismissed] = useState(false);

    // Check sessionStorage on mount for dismissal state
    useEffect(() => {
        const isDismissed = sessionStorage.getItem('schedulingBannerDismissed') === 'true';
        setDismissed(isDismissed);
    }, []);

    // Filter jobs that need scheduling (status = slots_offered)
    const jobsNeedingScheduling = jobs.filter(j => j.status === 'slots_offered');

    // Don't render if no jobs need scheduling or dismissed
    if (jobsNeedingScheduling.length === 0 || dismissed) {
        return null;
    }

    const handleDismiss = (e) => {
        e.stopPropagation();
        sessionStorage.setItem('schedulingBannerDismissed', 'true');
        setDismissed(true);
    };

    const handleJobClick = (job) => {
        if (onJobClick) {
            onJobClick(job);
        } else {
            // Default: navigate to job via URL param
            window.location.href = `/app?jobId=${job.id}`;
        }
    };

    // Single job view
    if (jobsNeedingScheduling.length === 1) {
        const job = jobsNeedingScheduling[0];
        const slots = getOfferedSlots(job);
        const slotCount = slots.length;
        const contractorName = job.contractorName || 'Your contractor';
        const contractorMessage = job.scheduling?.offeredMessage || job.contractorMessage;

        return (
            <div className="relative bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Dismiss button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                    title="Dismiss for this session"
                >
                    <X size={16} />
                </button>

                <div className="flex items-start gap-4">
                    {/* Icon with pulse */}
                    <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                        {/* Pulsing dot */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-blue-900">
                                {slotCount} Time{slotCount !== 1 ? 's' : ''} Available!
                            </h3>
                            <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                                Action Required
                            </span>
                        </div>

                        <p className="text-sm text-blue-700 mb-2">
                            <strong>{contractorName}</strong> has sent times for:
                        </p>

                        <div className="bg-white/80 rounded-lg p-3 border border-blue-200 mb-3">
                            <p className="font-medium text-blue-900 text-sm">
                                {job.title || job.description || 'Service Request'}
                            </p>
                            {/* Show first 2 slots as preview */}
                            {slots.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {slots.slice(0, 2).map((slot, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs text-blue-600">
                                            <Clock size={12} />
                                            <span>{formatSlotTime(slot)}</span>
                                        </div>
                                    ))}
                                    {slots.length > 2 && (
                                        <p className="text-xs text-blue-500 ml-5">
                                            +{slots.length - 2} more option{slots.length - 2 !== 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Contractor message if provided */}
                        {contractorMessage && (
                            <div className="bg-blue-100/50 rounded-lg p-2 mb-3 border border-blue-200">
                                <p className="text-xs text-blue-600 italic">
                                    "{contractorMessage}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action button */}
                    <button
                        onClick={() => handleJobClick(job)}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                    >
                        Pick a Time
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    // Multiple jobs view
    return (
        <div className="relative bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4 mb-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                title="Dismiss for this session"
            >
                <X size={16} />
            </button>

            <div className="flex items-start gap-4">
                {/* Icon with count badge */}
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    {/* Badge with count */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                        <span className="text-[10px] font-bold text-white">{jobsNeedingScheduling.length}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-8">
                    <h3 className="font-bold text-blue-900 mb-2">
                        {jobsNeedingScheduling.length} jobs need scheduling
                    </h3>

                    {/* Job list */}
                    <div className="space-y-2">
                        {jobsNeedingScheduling.slice(0, 3).map((job) => {
                            const slots = getOfferedSlots(job);
                            const contractorName = job.contractorName || 'Contractor';

                            return (
                                <button
                                    key={job.id}
                                    onClick={() => handleJobClick(job)}
                                    className="w-full flex items-center gap-3 p-2 bg-white/80 hover:bg-white rounded-lg border border-blue-200 hover:border-blue-400 transition-colors text-left group"
                                >
                                    {/* Contractor avatar */}
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                                        {getInitials(contractorName)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-blue-800 truncate">
                                            {job.title || job.description || 'Service Request'}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-blue-600">
                                            <span>{contractorName}</span>
                                            <span className="text-blue-300">|</span>
                                            <span className="flex items-center gap-0.5">
                                                <Clock size={10} />
                                                {slots.length} option{slots.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>

                                    <ChevronRight size={16} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                                </button>
                            );
                        })}

                        {jobsNeedingScheduling.length > 3 && (
                            <p className="text-xs text-blue-600 text-center pt-1">
                                +{jobsNeedingScheduling.length - 3} more job{jobsNeedingScheduling.length - 3 !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchedulingRequiredBanner;
