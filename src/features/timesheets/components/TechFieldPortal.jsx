// src/features/timesheets/components/TechFieldPortal.jsx
// ============================================
// TECH FIELD PORTAL
// ============================================
// Main dashboard for field technicians to:
// - See today's assigned jobs
// - Clock in/out linked to specific jobs
// - Track time and status
// - Navigate between jobs

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Clock, MapPin, Navigation, Phone, MessageSquare,
    ChevronRight, ChevronDown, ChevronUp, Play, Square,
    Coffee, Car, Wrench, CheckCircle, AlertCircle,
    Calendar, Briefcase, User, Home, Settings,
    RefreshCw, Loader2, Sun, Moon, ExternalLink,
    Route, Sparkles, ArrowDown, Timer, ToggleLeft, ToggleRight,
    Camera, Image as ImageIcon, X
} from 'lucide-react';
import { useTimeClock } from '../hooks/useTimesheet';
import { formatDuration } from '../lib/timesheetService';
import { startJob, completeJob, pauseJob, resumeJob } from '../../jobs/lib/jobService';
import { optimizeRoute, minutesToTime } from '../../contractor-pro/lib/routeOptimizer';
import { FieldPhotoCaptureModal } from './FieldPhotoCapture';
import { PHOTO_TYPES, getJobPhotos, validatePhotoRequirements } from '../../jobs/lib/jobPhotoService';

// ============================================
// JOB STATUS HELPERS
// ============================================

const JOB_FIELD_STATUS = {
    NOT_STARTED: 'not_started',
    EN_ROUTE: 'en_route',
    ARRIVED: 'arrived',
    IN_PROGRESS: 'in_progress',
    PAUSED: 'paused',
    COMPLETED: 'completed'
};

const getJobFieldStatus = (job, activeJobId) => {
    if (job.status === 'completed') return JOB_FIELD_STATUS.COMPLETED;
    if (job.status === 'in_progress') {
        if (job.pausedAt && !job.resumedAt) return JOB_FIELD_STATUS.PAUSED;
        return JOB_FIELD_STATUS.IN_PROGRESS;
    }
    if (job.id === activeJobId) return JOB_FIELD_STATUS.IN_PROGRESS;
    if (job.enRouteAt) return JOB_FIELD_STATUS.EN_ROUTE;
    return JOB_FIELD_STATUS.NOT_STARTED;
};

const STATUS_DISPLAY = {
    [JOB_FIELD_STATUS.NOT_STARTED]: { label: 'Scheduled', bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock },
    [JOB_FIELD_STATUS.EN_ROUTE]: { label: 'En Route', bg: 'bg-blue-100', text: 'text-blue-700', icon: Car },
    [JOB_FIELD_STATUS.ARRIVED]: { label: 'Arrived', bg: 'bg-purple-100', text: 'text-purple-700', icon: MapPin },
    [JOB_FIELD_STATUS.IN_PROGRESS]: { label: 'Working', bg: 'bg-amber-100', text: 'text-amber-700', icon: Wrench },
    [JOB_FIELD_STATUS.PAUSED]: { label: 'Paused', bg: 'bg-orange-100', text: 'text-orange-700', icon: Coffee },
    [JOB_FIELD_STATUS.COMPLETED]: { label: 'Done', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle }
};

// ============================================
// TIME DISPLAY COMPONENT
// ============================================

const LiveTimeDisplay = ({ startTime, isPaused }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime || isPaused) return;

        const start = startTime?.toDate ? startTime.toDate() : new Date(startTime);

        const updateElapsed = () => {
            setElapsed(Date.now() - start.getTime());
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [startTime, isPaused]);

    if (!startTime) return null;

    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

    return (
        <span className="font-mono font-bold">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
    );
};

// ============================================
// CURRENT TIME STATUS BAR
// ============================================

const TimeStatusBar = ({ isClockedIn, isOnBreak, elapsedTime, currentJobTitle }) => {
    const getStatusColor = () => {
        if (isOnBreak) return 'bg-orange-500';
        if (isClockedIn) return 'bg-emerald-500';
        return 'bg-slate-400';
    };

    const getStatusText = () => {
        if (isOnBreak) return 'On Break';
        if (isClockedIn) return 'Clocked In';
        return 'Clocked Out';
    };

    return (
        <div className={`${getStatusColor()} text-white px-4 py-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Clock size={20} />
                        {isClockedIn && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-sm">{getStatusText()}</p>
                        {currentJobTitle && (
                            <p className="text-xs opacity-90">{currentJobTitle}</p>
                        )}
                    </div>
                </div>
                {isClockedIn && (
                    <div className="text-right">
                        <p className="text-2xl font-mono font-bold">{elapsedTime || '00:00:00'}</p>
                        <p className="text-[10px] uppercase tracking-wider opacity-75">Time Today</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// TRAVEL TIME INDICATOR
// ============================================

const TravelIndicator = ({ travelMinutes, fromLabel = 'Previous' }) => {
    if (!travelMinutes || travelMinutes <= 0) return null;

    const formatTravelTime = (mins) => {
        if (mins < 60) return `${Math.round(mins)} min`;
        const hours = Math.floor(mins / 60);
        const remaining = Math.round(mins % 60);
        return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
    };

    return (
        <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                <Car size={14} />
                <span className="text-xs font-medium">{formatTravelTime(travelMinutes)} drive</span>
            </div>
        </div>
    );
};

// ============================================
// ROUTE OPTIMIZATION SUMMARY
// ============================================

const RouteOptimizationBanner = ({
    isOptimized,
    totalTravelTime,
    timeSaved,
    onToggle,
    onOptimize,
    isOptimizing
}) => {
    const formatTime = (mins) => {
        if (!mins || mins <= 0) return '0 min';
        if (mins < 60) return `${Math.round(mins)} min`;
        const hours = Math.floor(mins / 60);
        const remaining = Math.round(mins % 60);
        return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOptimized ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Route size={18} className={isOptimized ? 'text-emerald-600' : 'text-slate-500'} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">
                            {isOptimized ? 'Optimized Route' : 'Scheduled Order'}
                        </p>
                        <p className="text-xs text-slate-500">
                            {totalTravelTime > 0 && `Total drive: ${formatTime(totalTravelTime)}`}
                            {isOptimized && timeSaved > 0 && (
                                <span className="text-emerald-600 ml-1">
                                    (saving {formatTime(timeSaved)})
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {isOptimizing ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs">Optimizing...</span>
                    </div>
                ) : isOptimized ? (
                    <button
                        onClick={onToggle}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                    >
                        <ToggleRight size={16} />
                        Original
                    </button>
                ) : (
                    <button
                        onClick={onOptimize}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                    >
                        <Sparkles size={14} />
                        Optimize
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================
// JOB CARD COMPONENT
// ============================================

const TechJobCard = ({
    job,
    isActive,
    fieldStatus,
    onStartRoute,
    onArrived,
    onStartWork,
    onPauseWork,
    onResumeWork,
    onCompleteWork,
    onOpenPhotoCapture,
    loading,
    stopNumber,
    estimatedArrival,
    travelTimeFromPrev,
    contractorId,
    techId,
    techName,
    photoRequirements
}) => {
    const [expanded, setExpanded] = useState(isActive);
    const [jobPhotos, setJobPhotos] = useState({ before: [], progress: [], after: [] });
    const statusDisplay = STATUS_DISPLAY[fieldStatus];
    const StatusIcon = statusDisplay?.icon || Clock;

    // Load existing photos for this job
    useEffect(() => {
        const loadPhotos = async () => {
            try {
                const photos = await getJobPhotos(job.id);
                setJobPhotos({
                    before: photos.filter(p => p.type === PHOTO_TYPES.BEFORE),
                    progress: photos.filter(p => p.type === PHOTO_TYPES.PROGRESS),
                    after: photos.filter(p => p.type === PHOTO_TYPES.AFTER)
                });
            } catch (err) {
                console.warn('[TechJobCard] Error loading photos:', err);
            }
        };
        if (job.id) loadPhotos();
    }, [job.id]);

    // Format scheduled time
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr?.toDate ? dateStr.toDate() : dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // Check if before photos are required and not taken yet
    const needsBeforePhotos = photoRequirements?.beforePhotosRequired &&
        jobPhotos.before.length < (photoRequirements?.minBeforePhotos || 1);

    // Check if after photos are required
    const needsAfterPhotos = photoRequirements?.afterPhotosRequired &&
        jobPhotos.after.length < (photoRequirements?.minAfterPhotos || 1);

    // Get action button based on status
    const getActionButton = () => {
        if (loading) {
            return (
                <button disabled className="w-full py-3 bg-slate-200 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Processing...
                </button>
            );
        }

        switch (fieldStatus) {
            case JOB_FIELD_STATUS.NOT_STARTED:
                return (
                    <button
                        onClick={onStartRoute}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all"
                    >
                        <Navigation size={18} />
                        Start Route
                    </button>
                );
            case JOB_FIELD_STATUS.EN_ROUTE:
                return (
                    <button
                        onClick={onArrived}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 active:scale-[0.98] transition-all"
                    >
                        <MapPin size={18} />
                        I've Arrived
                    </button>
                );
            case JOB_FIELD_STATUS.ARRIVED:
                return (
                    <div className="space-y-2">
                        {/* Before photos prompt */}
                        {needsBeforePhotos && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <Camera size={16} className="text-orange-600" />
                                    <span className="text-sm font-medium text-orange-700">Before Photos Required</span>
                                </div>
                                <button
                                    onClick={() => onOpenPhotoCapture?.(PHOTO_TYPES.BEFORE)}
                                    className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
                                >
                                    <Camera size={16} />
                                    Take Before Photos ({jobPhotos.before.length}/{photoRequirements?.minBeforePhotos || 1})
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onStartWork}
                            disabled={needsBeforePhotos}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                                needsBeforePhotos
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                        >
                            <Play size={18} />
                            Start Work (Clock In)
                        </button>
                    </div>
                );
            case JOB_FIELD_STATUS.IN_PROGRESS:
                return (
                    <div className="space-y-2">
                        {/* Photo buttons row */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => onOpenPhotoCapture?.(PHOTO_TYPES.PROGRESS)}
                                className="flex-1 py-2.5 bg-blue-100 text-blue-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-200 transition-colors"
                            >
                                <Camera size={16} />
                                Progress
                                {jobPhotos.progress.length > 0 && (
                                    <span className="px-1.5 py-0.5 bg-blue-200 rounded text-xs">{jobPhotos.progress.length}</span>
                                )}
                            </button>
                            <button
                                onClick={() => onOpenPhotoCapture?.(PHOTO_TYPES.AFTER)}
                                className="flex-1 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-200 transition-colors"
                            >
                                <Sparkles size={16} />
                                After
                                {jobPhotos.after.length > 0 && (
                                    <span className="px-1.5 py-0.5 bg-emerald-200 rounded text-xs">{jobPhotos.after.length}</span>
                                )}
                            </button>
                        </div>

                        {/* After photos warning */}
                        {needsAfterPhotos && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 flex items-center gap-2">
                                <AlertCircle size={14} className="text-emerald-600 shrink-0" />
                                <span className="text-xs text-emerald-700">
                                    Take {photoRequirements?.minAfterPhotos || 1} after photo{(photoRequirements?.minAfterPhotos || 1) > 1 ? 's' : ''} before completing
                                </span>
                            </div>
                        )}

                        <button
                            onClick={onCompleteWork}
                            disabled={needsAfterPhotos}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                                needsAfterPhotos
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                        >
                            <CheckCircle size={18} />
                            Complete Job
                        </button>
                        <button
                            onClick={onPauseWork}
                            className="w-full py-2 border-2 border-orange-300 text-orange-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-orange-50 active:scale-[0.98] transition-all"
                        >
                            <Coffee size={16} />
                            Take Break
                        </button>
                    </div>
                );
            case JOB_FIELD_STATUS.PAUSED:
                return (
                    <button
                        onClick={onResumeWork}
                        className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-[0.98] transition-all"
                    >
                        <Play size={18} />
                        Resume Work
                    </button>
                );
            case JOB_FIELD_STATUS.COMPLETED:
                return (
                    <div className="space-y-2">
                        {/* Show photo counts for completed job */}
                        {(jobPhotos.before.length > 0 || jobPhotos.after.length > 0) && (
                            <div className="flex gap-2 justify-center">
                                {jobPhotos.before.length > 0 && (
                                    <button
                                        onClick={() => onOpenPhotoCapture?.(PHOTO_TYPES.BEFORE)}
                                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                    >
                                        <Camera size={12} />
                                        {jobPhotos.before.length} Before
                                    </button>
                                )}
                                {jobPhotos.after.length > 0 && (
                                    <button
                                        onClick={() => onOpenPhotoCapture?.(PHOTO_TYPES.AFTER)}
                                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1"
                                    >
                                        <Sparkles size={12} />
                                        {jobPhotos.after.length} After
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="py-3 bg-emerald-100 text-emerald-700 rounded-xl font-bold flex items-center justify-center gap-2">
                            <CheckCircle size={18} />
                            Completed
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    // Open navigation
    const openNavigation = () => {
        const address = job.propertyAddress || job.customer?.address;
        if (address) {
            // Try Apple Maps first on iOS, fallback to Google Maps
            const encodedAddress = encodeURIComponent(address);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            if (isIOS) {
                window.open(`maps://maps.apple.com/?daddr=${encodedAddress}`);
            } else {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
            }
        }
    };

    return (
        <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
            isActive ? 'border-emerald-400 shadow-lg shadow-emerald-100' : 'border-slate-200'
        }`}>
            {/* Card Header - Always Visible */}
            <div
                className="p-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        {/* Stop Number & Time Badge */}
                        <div className="flex items-center gap-2 mb-2">
                            {stopNumber && (
                                <span className="w-6 h-6 flex items-center justify-center bg-slate-800 text-white text-xs font-bold rounded-full">
                                    {stopNumber}
                                </span>
                            )}
                            <span className="text-sm font-bold text-slate-800">
                                {estimatedArrival || formatTime(job.scheduledTime || job.scheduledDate)}
                            </span>
                            {job.estimatedDuration && (
                                <span className="text-xs text-slate-500">
                                    ({Math.round(job.estimatedDuration / 60)}h job)
                                </span>
                            )}
                        </div>

                        {/* Job Title */}
                        <h3 className="font-bold text-slate-800 truncate">
                            {job.title || job.description || 'Service Call'}
                        </h3>

                        {/* Customer & Address */}
                        <p className="text-sm text-slate-600 truncate mt-1">
                            {job.customerName || job.customer?.name}
                        </p>
                    </div>

                    {/* Status Badge & Expand */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${statusDisplay.bg} ${statusDisplay.text}`}>
                            <StatusIcon size={12} />
                            {statusDisplay.label}
                        </span>
                        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                </div>

                {/* Active Job Timer */}
                {isActive && fieldStatus === JOB_FIELD_STATUS.IN_PROGRESS && job.startedAt && (
                    <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between">
                        <span className="text-sm text-emerald-700">Time on job:</span>
                        <div className="text-lg text-emerald-700">
                            <LiveTimeDisplay startTime={job.startedAt} isPaused={fieldStatus === JOB_FIELD_STATUS.PAUSED} />
                        </div>
                    </div>
                )}
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Address with navigation */}
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <MapPin size={18} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">
                                {job.propertyAddress || job.customer?.address || 'No address'}
                            </p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); openNavigation(); }}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                            <ExternalLink size={16} />
                        </button>
                    </div>

                    {/* Customer Contact */}
                    {(job.customerPhone || job.customer?.phone) && (
                        <div className="flex gap-2">
                            <a
                                href={`tel:${job.customerPhone || job.customer?.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 py-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-200 transition-colors"
                            >
                                <Phone size={16} />
                                Call
                            </a>
                            <a
                                href={`sms:${job.customerPhone || job.customer?.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 py-2.5 bg-blue-100 text-blue-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-200 transition-colors"
                            >
                                <MessageSquare size={16} />
                                Text
                            </a>
                        </div>
                    )}

                    {/* Notes/Description */}
                    {job.notes && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-xs font-bold text-amber-700 uppercase mb-1">Notes</p>
                            <p className="text-sm text-amber-800">{job.notes}</p>
                        </div>
                    )}

                    {/* Price */}
                    {job.price && (
                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                            <span className="text-sm text-slate-500">Job Total:</span>
                            <span className="font-bold text-slate-800">${job.price.toLocaleString()}</span>
                        </div>
                    )}

                    {/* Action Button */}
                    <div onClick={(e) => e.stopPropagation()}>
                        {getActionButton()}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

const TechFieldPortal = ({
    contractorId,
    techId,
    techName,
    jobs = [],
    startLocation = null, // Tech's starting location (home base or current location)
    onRefresh,
    onJobComplete
}) => {
    const [activeJobId, setActiveJobId] = useState(null);
    const [jobStatuses, setJobStatuses] = useState({});
    const [loading, setLoading] = useState({});
    const [refreshing, setRefreshing] = useState(false);

    // Route optimization state
    const [useOptimizedRoute, setUseOptimizedRoute] = useState(false);
    const [optimizedResult, setOptimizedResult] = useState(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [originalTravelTime, setOriginalTravelTime] = useState(0);

    // Photo capture modal state
    const [photoModalOpen, setPhotoModalOpen] = useState(false);
    const [photoModalJob, setPhotoModalJob] = useState(null);
    const [photoModalType, setPhotoModalType] = useState(null);
    const [photoRequirements, setPhotoRequirements] = useState({
        beforePhotosRequired: true,
        minBeforePhotos: 1,
        afterPhotosRequired: true,
        minAfterPhotos: 1
    });

    // Time clock hook
    const {
        isClockedIn,
        isOnBreak,
        elapsedTimeFormatted,
        currentJobId,
        clockIn,
        clockOut,
        startBreak,
        endBreak
    } = useTimeClock(contractorId, techId);

    // Load photo requirements from contractor settings
    useEffect(() => {
        const loadPhotoRequirements = async () => {
            try {
                const requirements = await import('../../jobs/lib/jobPhotoService').then(m => m.getPhotoRequirements(contractorId));
                if (requirements) {
                    setPhotoRequirements(requirements);
                }
            } catch (err) {
                console.warn('[TechFieldPortal] Error loading photo requirements:', err);
            }
        };
        if (contractorId) loadPhotoRequirements();
    }, [contractorId]);

    // Open photo capture modal
    const handleOpenPhotoCapture = useCallback((job, photoType) => {
        setPhotoModalJob(job);
        setPhotoModalType(photoType);
        setPhotoModalOpen(true);
    }, []);

    // Close photo capture modal
    const handleClosePhotoModal = useCallback(() => {
        setPhotoModalOpen(false);
        setPhotoModalJob(null);
        setPhotoModalType(null);
    }, []);

    // Handle photo capture completion
    const handlePhotoCaptureComplete = useCallback((photos) => {
        console.log('[TechFieldPortal] Photos captured:', photos.length);
        handleClosePhotoModal();
        // Refresh to update photo counts in job cards
        onRefresh?.();
    }, [onRefresh, handleClosePhotoModal]);

    // Sort jobs by scheduled time (original order)
    const scheduledJobs = useMemo(() => {
        return [...jobs].sort((a, b) => {
            const timeA = a.scheduledTime?.toDate?.() || new Date(a.scheduledTime || a.scheduledDate || 0);
            const timeB = b.scheduledTime?.toDate?.() || new Date(b.scheduledTime || b.scheduledDate || 0);
            return timeA - timeB;
        });
    }, [jobs]);

    // Get the current display order (optimized or scheduled)
    const sortedJobs = useMemo(() => {
        if (useOptimizedRoute && optimizedResult?.route) {
            return optimizedResult.route;
        }
        return scheduledJobs;
    }, [useOptimizedRoute, optimizedResult, scheduledJobs]);

    // Get travel time info for each job
    const jobTravelInfo = useMemo(() => {
        const info = {};
        if (useOptimizedRoute && optimizedResult?.arrivals) {
            optimizedResult.arrivals.forEach((arrival, idx) => {
                info[arrival.job.id] = {
                    stopNumber: idx + 1,
                    estimatedArrival: arrival.arrivalTimeStr,
                    travelTimeFromPrev: arrival.travelTimeFromPrev || 0
                };
            });
        } else {
            // For scheduled order, we don't have travel time data
            scheduledJobs.forEach((job, idx) => {
                info[job.id] = {
                    stopNumber: idx + 1,
                    estimatedArrival: null,
                    travelTimeFromPrev: 0
                };
            });
        }
        return info;
    }, [useOptimizedRoute, optimizedResult, scheduledJobs]);

    // Optimize route handler
    const handleOptimizeRoute = useCallback(async () => {
        if (jobs.length < 2) return;

        setIsOptimizing(true);

        try {
            // Get start location (tech's home or first job)
            const start = startLocation || {
                lat: jobs[0]?.serviceAddress?.coordinates?.lat,
                lng: jobs[0]?.serviceAddress?.coordinates?.lng
            };

            // Current time in minutes since midnight
            const now = new Date();
            const startTime = now.getHours() * 60 + now.getMinutes();

            const result = await optimizeRoute(scheduledJobs, start, startTime);

            if (result) {
                setOptimizedResult(result);
                setOriginalTravelTime(result.totalTravelTime + (result.improvement > 0 ? (result.totalTravelTime * result.improvement / 100) : 0));
                setUseOptimizedRoute(true);
            }
        } catch (error) {
            console.error('[TechFieldPortal] Route optimization failed:', error);
        } finally {
            setIsOptimizing(false);
        }
    }, [jobs, scheduledJobs, startLocation]);

    // Toggle between optimized and original
    const handleToggleRoute = useCallback(() => {
        setUseOptimizedRoute(!useOptimizedRoute);
    }, [useOptimizedRoute]);

    // Get current active job
    const activeJob = useMemo(() => {
        return sortedJobs.find(j => j.id === activeJobId || j.id === currentJobId);
    }, [sortedJobs, activeJobId, currentJobId]);

    // Initialize job statuses
    useEffect(() => {
        const statuses = {};
        sortedJobs.forEach(job => {
            statuses[job.id] = getJobFieldStatus(job, currentJobId);
        });
        setJobStatuses(statuses);
    }, [sortedJobs, currentJobId]);

    // Handle refresh
    const handleRefresh = async () => {
        setRefreshing(true);
        await onRefresh?.();
        setRefreshing(false);
    };

    // Start route to job
    const handleStartRoute = async (job) => {
        setLoading(prev => ({ ...prev, [job.id]: true }));

        setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.EN_ROUTE }));
        setActiveJobId(job.id);

        // Open navigation
        const address = job.propertyAddress || job.customer?.address;
        if (address) {
            const encodedAddress = encodeURIComponent(address);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                window.open(`maps://maps.apple.com/?daddr=${encodedAddress}`);
            } else {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
            }
        }

        setLoading(prev => ({ ...prev, [job.id]: false }));
    };

    // Mark arrived at job
    const handleArrived = async (job) => {
        setLoading(prev => ({ ...prev, [job.id]: true }));
        setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.ARRIVED }));
        setLoading(prev => ({ ...prev, [job.id]: false }));
    };

    // Start work on job (clock in)
    const handleStartWork = async (job) => {
        setLoading(prev => ({ ...prev, [job.id]: true }));

        try {
            // Use the startJob function which auto-clocks in
            const result = await startJob(contractorId, job.id, {
                autoClockIn: true,
                startedBy: techId
            });

            if (result.success) {
                setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.IN_PROGRESS }));
                setActiveJobId(job.id);
            } else {
                console.error('Failed to start job:', result.error);
                // Fallback: still update local status
                setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.IN_PROGRESS }));
            }
        } catch (error) {
            console.error('Error starting work:', error);
            // Update local status anyway for UX
            setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.IN_PROGRESS }));
        }

        setLoading(prev => ({ ...prev, [job.id]: false }));
    };

    // Pause work (break)
    const handlePauseWork = async (job) => {
        setLoading(prev => ({ ...prev, [job.id]: true }));

        try {
            await pauseJob(contractorId, job.id, { reason: 'break', pauseTimesheet: true });
            setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.PAUSED }));
        } catch (error) {
            console.error('Error pausing work:', error);
            setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.PAUSED }));
        }

        setLoading(prev => ({ ...prev, [job.id]: false }));
    };

    // Resume work
    const handleResumeWork = async (job) => {
        setLoading(prev => ({ ...prev, [job.id]: true }));

        try {
            await resumeJob(contractorId, job.id, { resumeTimesheet: true });
            setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.IN_PROGRESS }));
        } catch (error) {
            console.error('Error resuming work:', error);
            setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.IN_PROGRESS }));
        }

        setLoading(prev => ({ ...prev, [job.id]: false }));
    };

    // Complete job (clock out)
    const handleCompleteWork = async (job) => {
        setLoading(prev => ({ ...prev, [job.id]: true }));

        try {
            const result = await completeJob(contractorId, job.id, {
                autoClockOut: true,
                completedBy: techId
            });

            if (result.success) {
                setJobStatuses(prev => ({ ...prev, [job.id]: JOB_FIELD_STATUS.COMPLETED }));
                setActiveJobId(null);
                onJobComplete?.(job, result);
            } else {
                console.error('Failed to complete job:', result.error);
            }
        } catch (error) {
            console.error('Error completing work:', error);
        }

        setLoading(prev => ({ ...prev, [job.id]: false }));
    };

    // Count jobs by status
    const jobCounts = useMemo(() => {
        return {
            total: sortedJobs.length,
            completed: sortedJobs.filter(j => jobStatuses[j.id] === JOB_FIELD_STATUS.COMPLETED).length,
            remaining: sortedJobs.filter(j => jobStatuses[j.id] !== JOB_FIELD_STATUS.COMPLETED).length
        };
    }, [sortedJobs, jobStatuses]);

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Time Status Bar */}
            <TimeStatusBar
                isClockedIn={isClockedIn}
                isOnBreak={isOnBreak}
                elapsedTime={elapsedTimeFormatted}
                currentJobTitle={activeJob?.title}
            />

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-500">{getGreeting()},</p>
                        <h1 className="text-xl font-bold text-slate-800">{techName || 'Technician'}</h1>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Today's Summary */}
                <div className="flex items-center gap-4 mt-4">
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-slate-800">{jobCounts.total}</p>
                        <p className="text-xs text-slate-500">Total Jobs</p>
                    </div>
                    <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-700">{jobCounts.completed}</p>
                        <p className="text-xs text-emerald-600">Completed</p>
                    </div>
                    <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-amber-700">{jobCounts.remaining}</p>
                        <p className="text-xs text-amber-600">Remaining</p>
                    </div>
                </div>
            </div>

            {/* Jobs List */}
            <div className="p-4 space-y-3">
                <h2 className="font-bold text-slate-600 text-sm uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={14} />
                    Today's Jobs
                </h2>

                {sortedJobs.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                            <Briefcase size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">No jobs scheduled today</p>
                        <p className="text-sm text-slate-400 mt-1">Check back later or contact dispatch</p>
                    </div>
                ) : (
                    <>
                        {/* Route Optimization Banner - only show if 2+ jobs */}
                        {sortedJobs.length >= 2 && (
                            <RouteOptimizationBanner
                                isOptimized={useOptimizedRoute}
                                totalTravelTime={optimizedResult?.totalTravelTime || 0}
                                timeSaved={useOptimizedRoute && optimizedResult?.improvement > 0
                                    ? Math.round(originalTravelTime - optimizedResult.totalTravelTime)
                                    : 0
                                }
                                onToggle={handleToggleRoute}
                                onOptimize={handleOptimizeRoute}
                                isOptimizing={isOptimizing}
                            />
                        )}

                        {/* Job Cards with Travel Indicators */}
                        {sortedJobs.map((job, index) => {
                            const travelInfo = jobTravelInfo[job.id] || {};
                            const showTravelIndicator = useOptimizedRoute && index > 0 && travelInfo.travelTimeFromPrev > 0;

                            return (
                                <React.Fragment key={job.id}>
                                    {/* Travel time indicator between jobs */}
                                    {showTravelIndicator && (
                                        <TravelIndicator travelMinutes={travelInfo.travelTimeFromPrev} />
                                    )}

                                    <TechJobCard
                                        job={job}
                                        isActive={job.id === activeJobId || job.id === currentJobId}
                                        fieldStatus={jobStatuses[job.id] || JOB_FIELD_STATUS.NOT_STARTED}
                                        onStartRoute={() => handleStartRoute(job)}
                                        onArrived={() => handleArrived(job)}
                                        onStartWork={() => handleStartWork(job)}
                                        onPauseWork={() => handlePauseWork(job)}
                                        onResumeWork={() => handleResumeWork(job)}
                                        onCompleteWork={() => handleCompleteWork(job)}
                                        onOpenPhotoCapture={(photoType) => handleOpenPhotoCapture(job, photoType)}
                                        loading={loading[job.id]}
                                        stopNumber={travelInfo.stopNumber}
                                        estimatedArrival={travelInfo.estimatedArrival}
                                        travelTimeFromPrev={travelInfo.travelTimeFromPrev}
                                        contractorId={contractorId}
                                        techId={techId}
                                        techName={techName}
                                        photoRequirements={photoRequirements}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Quick Clock Out (if clocked in but not on a job) */}
            {isClockedIn && !activeJobId && (
                <div className="fixed bottom-4 left-4 right-4">
                    <button
                        onClick={clockOut}
                        className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-700 active:scale-[0.98] transition-all"
                    >
                        <Square size={20} />
                        Clock Out
                    </button>
                </div>
            )}

            {/* Photo Capture Modal */}
            {photoModalOpen && photoModalJob && (
                <FieldPhotoCaptureModal
                    isOpen={photoModalOpen}
                    onClose={handleClosePhotoModal}
                    jobId={photoModalJob.id}
                    contractorId={contractorId}
                    techId={techId}
                    techName={techName}
                    photoType={photoModalType}
                    title={photoModalType === PHOTO_TYPES.BEFORE ? 'Before Photos' :
                           photoModalType === PHOTO_TYPES.AFTER ? 'After Photos' :
                           photoModalType === PHOTO_TYPES.PROGRESS ? 'Progress Photos' :
                           'Job Photos'}
                    subtitle={photoModalJob.title || photoModalJob.description || 'Service Call'}
                    minPhotos={photoModalType === PHOTO_TYPES.BEFORE ? (photoRequirements?.minBeforePhotos || 0) :
                               photoModalType === PHOTO_TYPES.AFTER ? (photoRequirements?.minAfterPhotos || 0) : 0}
                    onComplete={handlePhotoCaptureComplete}
                />
            )}
        </div>
    );
};

export default TechFieldPortal;
