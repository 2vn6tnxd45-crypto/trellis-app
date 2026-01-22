// src/features/contractor-pro/components/JobCard.jsx
// ============================================
// JOB CARD COMPONENT
// ============================================
// Displays job info with travel time, status, and quick actions

import React, { useState, useEffect } from 'react';
import {
    Clock, MapPin, User, Phone, Mail, ChevronDown, ChevronUp,
    Navigation, AlertTriangle, CheckCircle, Play, Pause, Car,
    Calendar, DollarSign, Wrench, MoreVertical, ExternalLink
} from 'lucide-react';
import { JOB_STATUSES, JOB_STATUS_LABELS } from '../lib/jobService';
import { estimateTravelTime } from '../lib/schedulingEngine';

// Status badge configuration
const STATUS_CONFIG = {
    [JOB_STATUSES.PENDING_SCHEDULE]: {
        color: 'bg-slate-100 text-slate-700',
        icon: Clock
    },
    [JOB_STATUSES.SCHEDULED]: {
        color: 'bg-blue-100 text-blue-700',
        icon: Calendar
    },
    [JOB_STATUSES.EN_ROUTE]: {
        color: 'bg-purple-100 text-purple-700',
        icon: Car
    },
    [JOB_STATUSES.ON_SITE]: {
        color: 'bg-emerald-100 text-emerald-700',
        icon: MapPin
    },
    [JOB_STATUSES.IN_PROGRESS]: {
        color: 'bg-emerald-100 text-emerald-700',
        icon: Play
    },
    [JOB_STATUSES.RUNNING_LATE]: {
        color: 'bg-orange-100 text-orange-700',
        icon: AlertTriangle
    },
    [JOB_STATUSES.WAITING]: {
        color: 'bg-yellow-100 text-yellow-700',
        icon: Pause
    },
    [JOB_STATUSES.COMPLETED]: {
        color: 'bg-green-100 text-green-700',
        icon: CheckCircle
    },
    [JOB_STATUSES.CANCELLED]: {
        color: 'bg-red-100 text-red-700',
        icon: AlertTriangle
    }
};

// Priority badge
const PriorityBadge = ({ priority }) => {
    const config = {
        urgent: 'bg-red-500 text-white',
        high: 'bg-orange-500 text-white',
        normal: 'bg-slate-200 text-slate-700',
        low: 'bg-slate-100 text-slate-500'
    };

    if (priority === 'normal') return null;

    return (
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${config[priority] || config.normal}`}>
            {priority}
        </span>
    );
};

// Travel time indicator
const TravelTimeIndicator = ({ minutes, distance, isEstimate = true }) => {
    if (!minutes && !distance) return null;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    return (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Car size={12} />
            <span>{timeStr}</span>
            {distance && <span>({distance.toFixed(1)} mi)</span>}
            {isEstimate && <span className="text-slate-400">est.</span>}
        </div>
    );
};

// Status badge component
const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG[JOB_STATUSES.PENDING_SCHEDULE];
    const Icon = config.icon;
    const label = JOB_STATUS_LABELS[status] || status;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            <Icon size={12} />
            {label}
        </span>
    );
};

// Main JobCard component
export const JobCard = ({
    job,
    previousJob = null,
    onStatusChange,
    onAssign,
    onReschedule,
    onViewDetails,
    onStartNavigation,
    showTravelTime = true,
    showActions = true,
    compact = false
}) => {
    const [expanded, setExpanded] = useState(false);
    const [travelInfo, setTravelInfo] = useState(null);
    const [loadingTravel, setLoadingTravel] = useState(false);

    // Calculate travel time from previous job
    useEffect(() => {
        if (!showTravelTime || !previousJob?.serviceLocation || !job.serviceLocation) {
            return;
        }

        const calculateTravel = async () => {
            setLoadingTravel(true);
            try {
                const result = await estimateTravelTime(
                    previousJob.serviceLocation,
                    job.serviceLocation
                );
                setTravelInfo(result);
            } catch (err) {
                console.error('Travel calculation error:', err);
            } finally {
                setLoadingTravel(false);
            }
        };

        calculateTravel();
    }, [previousJob?.id, job.id, showTravelTime]);

    // Format time
    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    // Quick status actions
    const getQuickActions = () => {
        switch (job.status) {
            case JOB_STATUSES.SCHEDULED:
                return [
                    { label: 'Start Route', action: () => onStatusChange?.(job.id, JOB_STATUSES.EN_ROUTE), icon: Car },
                ];
            case JOB_STATUSES.EN_ROUTE:
                return [
                    { label: 'Arrived', action: () => onStatusChange?.(job.id, JOB_STATUSES.ON_SITE), icon: MapPin },
                    { label: 'Running Late', action: () => onStatusChange?.(job.id, JOB_STATUSES.RUNNING_LATE), icon: AlertTriangle, danger: true },
                ];
            case JOB_STATUSES.ON_SITE:
                return [
                    { label: 'Start Work', action: () => onStatusChange?.(job.id, JOB_STATUSES.IN_PROGRESS), icon: Play },
                ];
            case JOB_STATUSES.IN_PROGRESS:
                return [
                    { label: 'Complete', action: () => onStatusChange?.(job.id, JOB_STATUSES.COMPLETED), icon: CheckCircle },
                    { label: 'Waiting', action: () => onStatusChange?.(job.id, JOB_STATUSES.WAITING), icon: Pause },
                ];
            case JOB_STATUSES.RUNNING_LATE:
            case JOB_STATUSES.WAITING:
                return [
                    { label: 'Resume', action: () => onStatusChange?.(job.id, JOB_STATUSES.IN_PROGRESS), icon: Play },
                ];
            default:
                return [];
        }
    };

    const quickActions = showActions ? getQuickActions() : [];

    // Compact view
    if (compact) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-3 hover:border-emerald-300 transition-colors">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800 truncate">{job.title || job.jobNumber}</p>
                            <PriorityBadge priority={job.priority} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">{job.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">
                            {formatTime(job.scheduledStartTime)}
                        </span>
                        <StatusBadge status={job.status} />
                    </div>
                </div>
                {travelInfo && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                        <TravelTimeIndicator
                            minutes={travelInfo.durationMinutes}
                            distance={travelInfo.distanceMiles}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Full view
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            {/* Travel time banner (if coming from previous job) */}
            {travelInfo && (
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <TravelTimeIndicator
                        minutes={travelInfo.durationMinutes}
                        distance={travelInfo.distanceMiles}
                    />
                    {onStartNavigation && job.serviceAddress && (
                        <button
                            onClick={() => onStartNavigation(job.serviceAddress)}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                        >
                            <Navigation size={12} />
                            Navigate
                        </button>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800">{job.title || 'Service Call'}</p>
                            <PriorityBadge priority={job.priority} />
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">#{job.jobNumber}</p>
                    </div>
                    <StatusBadge status={job.status} />
                </div>

                {/* Time & Tech */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock size={14} />
                        <span className="font-medium">
                            {formatTime(job.scheduledStartTime)} - {formatTime(job.scheduledEndTime)}
                        </span>
                    </div>
                    {job.assignedTechName && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                            <User size={14} />
                            <span>{job.assignedTechName}</span>
                        </div>
                    )}
                    {job.estimatedDurationMinutes && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Wrench size={14} />
                            <span>{job.estimatedDurationMinutes} min</span>
                        </div>
                    )}
                </div>

                {/* Address */}
                {job.serviceAddress && (
                    <div className="mt-3 flex items-start gap-1.5 text-sm text-slate-600">
                        <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{job.serviceAddress}</span>
                    </div>
                )}

                {/* Customer */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {job.customerName && (
                        <span className="font-medium text-slate-700">{job.customerName}</span>
                    )}
                    {job.customerPhone && (
                        <a href={`tel:${job.customerPhone}`} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700">
                            <Phone size={12} />
                            {job.customerPhone}
                        </a>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {quickActions.map((action, i) => (
                        <button
                            key={i}
                            onClick={action.action}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                                action.danger
                                    ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            }`}
                        >
                            <action.icon size={14} />
                            {action.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Expandable Details */}
            <div className="border-t border-slate-100">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-500 hover:bg-slate-50"
                >
                    <span>{expanded ? 'Hide details' : 'Show details'}</span>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {expanded && (
                    <div className="px-4 pb-4 space-y-3 text-sm">
                        {/* Description */}
                        {job.description && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Description</p>
                                <p className="text-slate-700">{job.description}</p>
                            </div>
                        )}

                        {/* Requirements */}
                        {(job.requiredSkills?.length > 0 || job.requiredCertifications?.length > 0) && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Requirements</p>
                                <div className="flex flex-wrap gap-1">
                                    {job.requiredSkills?.map(skill => (
                                        <span key={skill} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                            {skill.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                    {job.requiredCertifications?.map(cert => (
                                        <span key={cert} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                                            {cert.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Financial */}
                        {job.estimatedCost > 0 && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                                <DollarSign size={14} />
                                <span>Estimated: ${job.estimatedCost.toLocaleString()}</span>
                            </div>
                        )}

                        {/* SLA */}
                        {job.slaDeadline && (
                            <div className="flex items-center gap-1.5 text-orange-600">
                                <AlertTriangle size={14} />
                                <span>SLA Deadline: {new Date(job.slaDeadline).toLocaleDateString()}</span>
                            </div>
                        )}

                        {/* Notes */}
                        {job.notes && (
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Notes</p>
                                <p className="text-slate-600">{job.notes}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            {onViewDetails && (
                                <button
                                    onClick={() => onViewDetails(job)}
                                    className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 flex items-center justify-center gap-1"
                                >
                                    <ExternalLink size={14} />
                                    View Full Details
                                </button>
                            )}
                            {onReschedule && job.status !== JOB_STATUSES.COMPLETED && (
                                <button
                                    onClick={() => onReschedule(job)}
                                    className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50"
                                >
                                    Reschedule
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobCard;
