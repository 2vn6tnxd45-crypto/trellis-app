// src/features/jobs/HomeownerJobCard.jsx
// ============================================
// HOMEOWNER JOB CARD
// ============================================
// Enhanced job card with proper status display and action buttons

import React, { useState, useMemo } from 'react';
import {
    Calendar, Clock, ChevronRight, CheckCircle, XCircle,
    Building2, MapPin, Phone, Mail, MoreVertical,
    AlertTriangle, Wrench, Info, MessageSquare,
    ClipboardCheck, RotateCcw, CalendarDays, CalendarPlus, RefreshCw
} from 'lucide-react';
import { isRecurringJob } from '../recurring/lib/recurringService';
import {
    jobIsMultiDay,
    isMultiDayJob as checkIsMultiDay,
    calculateDaysNeeded
} from '../contractor-pro/lib/multiDayUtils';
import { formatInTimezone, detectTimezone } from '../contractor-pro/lib/timezoneUtils';
import { JobProgressStepper } from './components/JobProgressStepper';
import { getNextStepGuidance } from './lib/jobProgressStages';

// Helper to calculate countdown to appointment
const getCountdown = (scheduledTime) => {
    if (!scheduledTime) return null;

    const scheduled = new Date(scheduledTime.toDate ? scheduledTime.toDate() : scheduledTime);
    const now = new Date();
    const diffMs = scheduled - now;

    // If past, return null
    if (diffMs < 0) return null;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const scheduledHour = scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (diffDays === 0) {
        // Today
        return {
            text: `Today at ${scheduledHour}`,
            urgency: 'today',
            color: 'text-emerald-700',
            bgColor: 'bg-emerald-100'
        };
    } else if (diffDays === 1) {
        // Tomorrow
        return {
            text: `Tomorrow at ${scheduledHour}`,
            urgency: 'tomorrow',
            color: 'text-amber-700',
            bgColor: 'bg-amber-100'
        };
    } else if (diffDays <= 3) {
        // 2-3 days
        return {
            text: `In ${diffDays} days`,
            urgency: 'soon',
            color: 'text-amber-600',
            bgColor: 'bg-amber-50'
        };
    } else if (diffDays <= 7) {
        // Within a week
        return {
            text: `In ${diffDays} days`,
            urgency: 'upcoming',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
        };
    } else {
        // More than a week
        return {
            text: `In ${diffDays} days`,
            urgency: 'later',
            color: 'text-slate-600',
            bgColor: 'bg-slate-50'
        };
    }
};

// Helper to safely extract address string (prevents React Error #310)
const safeAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
        // Handle structured address objects
        if (addr.formatted) return addr.formatted;
        if (addr.full) return addr.full;
        if (addr.street) return addr.street;
        // Don't render objects directly
        return '';
    }
    return String(addr);
};

// Status configuration
const STATUS_CONFIG = {
    pending_schedule: {
        label: 'Pending',
        description: 'Waiting for contractor to offer times',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        icon: Clock
    },
    slots_offered: {
        label: 'Times Available',
        description: 'Pick a time that works for you',
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Calendar
    },
    scheduling: {
        label: 'Scheduling',
        description: 'Time proposed - awaiting confirmation',
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Clock
    },
    scheduled: {
        label: 'Scheduled',
        description: 'Appointment confirmed',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        icon: CheckCircle
    },
    in_progress: {
        label: 'In Progress',
        description: 'Work is underway',
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: Wrench
    },
    // NEW: Pending completion status
    pending_completion: {
        label: 'Review Required',
        description: 'Contractor submitted - needs your review',
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        icon: ClipboardCheck
    },
    // NEW: Revision requested status
    revision_requested: {
        label: 'Revision Requested',
        description: 'Waiting for contractor to update',
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        icon: Clock
    },
    cancellation_requested: {
        label: 'Cancellation Pending',
        description: 'Waiting for contractor to approve cancellation',
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        icon: Clock
    },
    completed: {
        label: 'Completed',
        description: 'Job finished',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        icon: CheckCircle
    },
    cancelled: {
        label: 'Cancelled',
        description: 'Job was cancelled',
        bg: 'bg-red-100',
        text: 'text-red-600',
        icon: XCircle
    },
    quoted: {
        label: 'Quote Accepted',
        description: 'Ready for scheduling',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        icon: CheckCircle
    }
};

export const HomeownerJobCard = ({
    job,
    onSelect,
    onCancel,
    onRequestNewTimes,
    onMessage, // New prop for messaging
    compact = false,
    timezone // New prop for timezone awareness
}) => {
    const [showActions, setShowActions] = useState(false);

    // Safe usage of useMemo before conditional return
    const multiDayInfo = useMemo(() => {
        if (!job) return { isMultiDay: false, totalDays: 1 };

        // Method 1: Check if job already has multi-day schedule
        if (jobIsMultiDay(job)) {
            return {
                isMultiDay: true,
                totalDays: job.multiDaySchedule?.totalDays || 2,
                endDate: job.multiDaySchedule?.endDate
            };
        }

        // Method 2: Check explicit scheduling flags (set when contractor offers slots)
        if (job.scheduling?.isMultiDay) {
            return {
                isMultiDay: true,
                totalDays: job.scheduling.totalDays || 2
            };
        }

        // Method 3: Check estimated duration from multiple sources
        const duration = job.estimatedDuration
            || job.scheduling?.estimatedDuration
            || job.quote?.estimatedDuration
            || 0;

        if (checkIsMultiDay(duration)) {
            return {
                isMultiDay: true,
                totalDays: calculateDaysNeeded(duration)
            };
        }

        return { isMultiDay: false, totalDays: 1 };
    }, [job]);

    // Fallback to detected timezone if none provided
    const displayTimezone = timezone || detectTimezone();

    // EDGE CASE: Handle null/undefined job
    if (!job) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                <p className="text-slate-500">No job data</p>
            </div>
        );
    }

    // Determine effective status
    const getEffectiveStatus = () => {
        // NEW: Handle completion statuses first
        if (job.status === 'pending_completion') {
            return 'pending_completion';
        }
        if (job.status === 'revision_requested') {
            return 'revision_requested';
        }

        // Existing logic
        if (job.status === 'quoted' && job.estimate?.status === 'approved') {
            return 'pending_schedule';
        }
        if (job.scheduling?.offeredSlots?.length > 0 && !job.scheduledTime) {
            return 'slots_offered';
        }
        return job.status || 'pending_schedule';
    };

    const effectiveStatus = getEffectiveStatus();
    const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending_schedule;
    const StatusIcon = statusConfig.icon;

    // Get contractor display name
    const getContractorName = () => {
        return job.contractorName
            || job.contractorCompany
            || job.contractor?.companyName
            || job.contractor?.name
            || 'Contractor';
    };

    // Get latest proposed time (legacy model)
    const getLatestProposal = () => {
        if (job.proposedTimes?.length > 0) {
            return job.proposedTimes[job.proposedTimes.length - 1];
        }
        return null;
    };

    // Get offered time slots (new model)
    const getOfferedSlots = () => {
        return job.scheduling?.offeredSlots?.filter(s => s.status === 'offered') || [];
    };

    const latestProposal = getLatestProposal();
    const offeredSlots = getOfferedSlots();
    const hasNewTimeRequest = job.scheduling?.requestedNewTimes;



    // Format date for display (Timezone Aware!)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return formatInTimezone(dateStr, displayTimezone, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        return formatInTimezone(dateStr, displayTimezone, { hour: 'numeric', minute: '2-digit' });
    };

    const formatTimeRange = (start, end) => {
        return `${formatTime(start)} - ${formatTime(end)}`;
    };

    // Can show actions based on status - UPDATED: exclude pending_completion from cancel
    const canCancel = !['completed', 'cancelled', 'in_progress', 'pending_completion'].includes(job.status);
    const canRequestNewTimes = ['scheduling', 'slots_offered', 'pending_schedule'].includes(effectiveStatus);

    // Show message button when chat channel likely exists (after slots offered, scheduled, in progress, etc.)
    const canMessage = onMessage && job.contractorId && !['cancelled'].includes(job.status) &&
        (job.status !== 'pending_schedule' || offeredSlots.length > 0);

    // Check for contractor message with offered slots
    const contractorMessage = job.scheduling?.offeredMessage || job.contractorMessage;
    const isSlotsOffered = effectiveStatus === 'slots_offered';

    // Show progress stepper for active jobs (not completed or cancelled)
    const showProgressStepper = !['completed', 'cancelled'].includes(effectiveStatus);

    return (
        <div
            className={`rounded-2xl border overflow-hidden transition-all hover:shadow-md relative ${isSlotsOffered
                ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400 ring-2 ring-amber-100'
                : 'bg-white border-slate-200 hover:border-slate-300'
                } ${compact ? '' : ''}`}
        >
            {/* Pulsing action indicator for slots offered */}
            {isSlotsOffered && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-pulse z-10" />
            )}

            {/* Main Card Content */}
            <div
                className="p-4 cursor-pointer"
                onClick={() => onSelect?.(job)}
            >
                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-800 truncate">
                                {job.title || job.description || 'Service Request'}
                            </h3>
                            {/* Multi-Day Badge */}
                            {multiDayInfo.isMultiDay && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md shrink-0">
                                    <CalendarDays size={10} />
                                    {multiDayInfo.totalDays}-Day Job
                                </span>
                            )}
                            {/* Recurring Badge */}
                            {isRecurringJob(job) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md shrink-0">
                                    <RotateCcw size={10} />
                                    Recurring
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Building2 size={14} className="text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-600 truncate">
                                {getContractorName()}
                            </span>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.text}`}>
                            <StatusIcon size={12} />
                            {statusConfig.label}
                        </span>

                        {/* Rescheduled Indicator */}
                        {job.scheduleHistory?.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                                <RefreshCw size={10} />
                                Rescheduled
                            </span>
                        )}

                        {/* Reschedule Request Pending */}
                        {job.rescheduleRequest && !job.rescheduleRequest.resolved && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                                Reschedule Requested
                            </span>
                        )}

                        {/* Message Button (standalone when prominent) */}
                        {canMessage && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMessage(job);
                                }}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Message contractor"
                            >
                                <MessageSquare size={16} />
                            </button>
                        )}

                        {/* Actions Menu */}
                        {(canCancel || canRequestNewTimes) && (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowActions(!showActions);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <MoreVertical size={16} />
                                </button>

                                {showActions && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowActions(false);
                                            }}
                                        />
                                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 min-w-[180px]">
                                            {canRequestNewTimes && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowActions(false);
                                                        onRequestNewTimes?.(job);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <Calendar size={16} className="text-slate-400" />
                                                    Request Different Times
                                                </button>
                                            )}
                                            {canCancel && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowActions(false);
                                                        onCancel?.(job);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <XCircle size={16} />
                                                    Cancel Job
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Service Address (if available) */}
                {(safeAddress(job.serviceAddress) || safeAddress(job.customer?.address)) && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                        <MapPin size={14} className="shrink-0" />
                        <span className="truncate">
                            {safeAddress(job.serviceAddress) || safeAddress(job.customer?.address)}
                        </span>
                    </div>
                )}

                {/* Progress Stepper */}
                {showProgressStepper && !compact && (
                    <div className="mb-3">
                        <JobProgressStepper
                            currentStatus={effectiveStatus}
                            variant="compact"
                            showLabels={true}
                        />
                    </div>
                )}

                {/* Scheduling Info */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                    {/* Confirmed Time with Countdown */}
                    {job.scheduledTime && (() => {
                        const countdown = getCountdown(job.scheduledTime);
                        return (
                            <div className="space-y-2">
                                {/* Countdown Badge - only for upcoming appointments */}
                                {countdown && effectiveStatus === 'scheduled' && (
                                    <div className={`flex items-center justify-center gap-2 py-2 rounded-lg ${countdown.bgColor}`}>
                                        <Clock size={14} className={countdown.color} />
                                        <span className={`text-sm font-bold ${countdown.color}`}>
                                            {countdown.text}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Scheduled:</span>
                                    {multiDayInfo.isMultiDay ? (
                                        // Multi-day: Show date range with day count
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-sm">
                                                {formatDate(job.scheduledTime)}
                                                {multiDayInfo.endDate && ` - ${formatDate(multiDayInfo.endDate)}`}
                                            </span>
                                            <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                                {multiDayInfo.totalDays} days
                                            </span>
                                        </div>
                                    ) : (
                                        // Single-day: Show date + time info
                                        <span className="font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg text-sm">
                                            {formatDate(job.scheduledTime)} • {formatTime(job.scheduledTime)}
                                            {job.scheduledEndTime && ` - ${formatTime(job.scheduledEndTime)}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Offered Slots (new model) */}
                    {!job.scheduledTime && offeredSlots.length > 0 && (
                        <div>
                            {/* Contractor message if provided */}
                            {contractorMessage && isSlotsOffered && (
                                <div className="mb-3 p-2 bg-amber-100/50 rounded-lg border border-amber-200">
                                    <p className="text-xs text-amber-700 italic">
                                        "{contractorMessage}"
                                    </p>
                                </div>
                            )}
                            <p className="text-sm text-slate-500 mb-2">Available times:</p>
                            <div className="space-y-1.5">
                                {offeredSlots.slice(0, 3).map((slot, idx) => (
                                    <div
                                        key={slot.id || idx}
                                        className="flex items-center justify-between bg-amber-50 px-3 py-2 rounded-lg border border-amber-200"
                                    >
                                        <span className="text-sm font-medium text-amber-800">
                                            {formatDate(slot.start)}
                                        </span>
                                        <span className="text-sm text-amber-600">
                                            {formatTimeRange(slot.start, slot.end)}
                                        </span>
                                    </div>
                                ))}
                                {offeredSlots.length > 3 && (
                                    <p className="text-xs text-amber-600 text-center">
                                        +{offeredSlots.length - 3} more options
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Latest Proposal (legacy model) */}
                    {!job.scheduledTime && !offeredSlots.length && latestProposal && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">
                                {latestProposal.proposedBy === 'contractor' ? 'Proposed:' : 'You proposed:'}
                            </span>
                            <span className="font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-lg text-sm">
                                {formatDate(latestProposal.date)} at {formatTime(latestProposal.date)}
                            </span>
                        </div>
                    )}

                    {/* New Times Requested */}
                    {hasNewTimeRequest && !job.scheduledTime && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2">
                            <MessageSquare size={14} />
                            <span className="text-sm font-medium">New times requested</span>
                        </div>
                    )}

                    {/* No scheduling activity - UPDATED: exclude completion statuses */}
                    {!job.scheduledTime && !offeredSlots.length && !latestProposal && !hasNewTimeRequest && effectiveStatus !== 'pending_completion' && effectiveStatus !== 'revision_requested' && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Scheduling:</span>
                            <span className="text-amber-600 font-medium text-sm flex items-center gap-1">
                                Awaiting times <ChevronRight size={14} />
                            </span>
                        </div>
                    )}

                    {/* NEW: Pending Completion Info with Countdown */}
                    {effectiveStatus === 'pending_completion' && (() => {
                        const completion = job.completion || {};
                        const itemCount = completion.itemsToImport?.length || 0;
                        const autoCloseAt = completion.autoCloseAt;

                        // Calculate days remaining
                        let daysRemaining = null;
                        let isUrgent = false;
                        if (autoCloseAt) {
                            const closeDate = autoCloseAt?.toDate ? autoCloseAt.toDate() : new Date(autoCloseAt);
                            const now = new Date();
                            daysRemaining = Math.ceil((closeDate - now) / (1000 * 60 * 60 * 24));
                            isUrgent = daysRemaining <= 2;
                        }

                        return (
                            <div className="space-y-2">
                                {/* Countdown badge */}
                                {daysRemaining !== null && (
                                    <div className={`flex items-center justify-center gap-2 py-2 rounded-lg ${isUrgent ? 'bg-red-100' : 'bg-amber-100'
                                        }`}>
                                        <AlertTriangle size={14} className={isUrgent ? 'text-red-600' : 'text-amber-600'} />
                                        <span className={`text-sm font-bold ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
                                            {daysRemaining <= 0
                                                ? 'Auto-approval today!'
                                                : daysRemaining === 1
                                                    ? '1 day left to review'
                                                    : `${daysRemaining} days left to review`
                                            }
                                        </span>
                                    </div>
                                )}

                                {/* Status info */}
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isUrgent ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'
                                    }`}>
                                    <ClipboardCheck size={14} />
                                    <span className="text-sm font-medium flex-1">
                                        Review required
                                    </span>
                                    {itemCount > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-100' : 'bg-purple-100'
                                            }`}>
                                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* NEW: Revision Requested Info */}
                    {effectiveStatus === 'revision_requested' && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                            <Clock size={14} />
                            <span className="text-sm font-medium">Waiting for contractor to update</span>
                        </div>
                    )}
                </div>

                {/* Price (if available) */}
                {/* EDGE CASE: Validate price is a valid number before display */}
                {typeof job.total === 'number' && job.total > 0 && isFinite(job.total) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm text-slate-500">Total:</span>
                        <span className="font-bold text-slate-800">
                            ${job.total.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick Action Bar (for jobs needing action) */}
            {effectiveStatus === 'slots_offered' && offeredSlots.length > 0 && (
                <div className={`px-4 py-3 border-t ${multiDayInfo.isMultiDay
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-amber-50 border-amber-100'
                    }`}>
                    {/* Multi-day prominent notice */}
                    {multiDayInfo.isMultiDay && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-indigo-100 rounded-lg">
                            <CalendarDays size={16} className="text-indigo-600" />
                            <p className="text-sm font-bold text-indigo-700">
                                {multiDayInfo.totalDays}-Day Job
                            </p>
                            <span className="text-xs text-indigo-600">
                                (consecutive days)
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => onSelect?.(job)}
                        className={`w-full py-2.5 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${multiDayInfo.isMultiDay
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-amber-500 hover:bg-amber-600'
                            }`}
                    >
                        <Calendar size={16} />
                        {multiDayInfo.isMultiDay
                            ? `Select Start Date (${multiDayInfo.totalDays} days)`
                            : 'Pick a Time'
                        }
                    </button>
                </div>
            )}

            {effectiveStatus === 'scheduling' && latestProposal?.proposedBy === 'contractor' && (
                <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100">
                    <button
                        onClick={() => onSelect?.(job)}
                        className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={16} />
                        Review & Confirm
                    </button>
                </div>
            )}

            {/* NEW: Review Completion Action */}
            {effectiveStatus === 'pending_completion' && (
                <div className="px-4 py-3 bg-purple-50 border-t border-purple-100">
                    <button
                        onClick={() => onSelect?.(job)}
                        className="w-full py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <ClipboardCheck size={16} />
                        Review Completion
                    </button>
                </div>
            )}
        </div>
    );
};

export default HomeownerJobCard;
