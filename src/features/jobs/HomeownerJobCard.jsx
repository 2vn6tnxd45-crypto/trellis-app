// src/features/jobs/HomeownerJobCard.jsx
// ============================================
// HOMEOWNER JOB CARD
// ============================================
// Enhanced job card with proper status display and action buttons

import React, { useState } from 'react';
import { 
    Calendar, Clock, ChevronRight, CheckCircle, XCircle,
    Building2, MapPin, Phone, Mail, MoreVertical,
    AlertTriangle, Wrench, Info, MessageSquare
} from 'lucide-react';

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
    compact = false 
}) => {
    const [showActions, setShowActions] = useState(false);

    // Determine effective status
    const getEffectiveStatus = () => {
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

    // Format date for display
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString([], { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { 
            hour: 'numeric', 
            minute: '2-digit' 
        });
    };

    const formatTimeRange = (start, end) => {
        return `${formatTime(start)} - ${formatTime(end)}`;
    };

    // Can show actions based on status
    const canCancel = !['completed', 'cancelled', 'in_progress'].includes(job.status);
    const canRequestNewTimes = ['scheduling', 'slots_offered', 'pending_schedule'].includes(effectiveStatus);

    return (
        <div 
            className={`bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all hover:shadow-md hover:border-slate-300 ${
                compact ? '' : ''
            }`}
        >
            {/* Main Card Content */}
            <div 
                className="p-4 cursor-pointer"
                onClick={() => onSelect?.(job)}
            >
                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">
                            {job.title || job.description || 'Service Request'}
                        </h3>
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
                {(job.serviceAddress?.formatted || job.customer?.address) && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                        <MapPin size={14} className="shrink-0" />
                        <span className="truncate">
                            {job.serviceAddress?.formatted || job.customer?.address}
                        </span>
                    </div>
                )}

                {/* Scheduling Info */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                    {/* Confirmed Time */}
                    {job.scheduledTime && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Scheduled:</span>
                            <span className="font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg text-sm">
                                {formatDate(job.scheduledTime)} at {formatTime(job.scheduledTime)}
                            </span>
                        </div>
                    )}

                    {/* Offered Slots (new model) */}
                    {!job.scheduledTime && offeredSlots.length > 0 && (
                        <div>
                            <p className="text-sm text-slate-500 mb-2">Available times:</p>
                            <div className="space-y-1.5">
                                {offeredSlots.slice(0, 3).map((slot, idx) => (
                                    <div 
                                        key={slot.id || idx}
                                        className="flex items-center justify-between bg-amber-50 px-3 py-2 rounded-lg"
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

                    {/* No scheduling activity */}
                    {!job.scheduledTime && !offeredSlots.length && !latestProposal && !hasNewTimeRequest && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-500">Scheduling:</span>
                            <span className="text-amber-600 font-medium text-sm flex items-center gap-1">
                                Awaiting times <ChevronRight size={14} />
                            </span>
                        </div>
                    )}
                </div>

                {/* Price (if available) */}
                {job.total > 0 && (
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
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                    <button
                        onClick={() => onSelect?.(job)}
                        className="w-full py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Calendar size={16} />
                        Pick a Time
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
        </div>
    );
};

export default HomeownerJobCard;
