// src/features/contractor-pro/components/FieldStatusControls.jsx
// ============================================
// FIELD STATUS CONTROLS
// ============================================
// Mobile-friendly status update controls for field technicians

import React, { useState } from 'react';
import {
    Navigation, MapPin, Wrench, Pause, Play,
    CheckCircle, Clock, AlertCircle, Loader2,
    Phone, MessageSquare, Camera, FileText,
    ChevronUp, ChevronDown, Car, Home
} from 'lucide-react';
import { FIELD_STATUS, STATUS_CONFIG } from '../lib/trackingService';

// ============================================
// STATUS ICON COMPONENT
// ============================================

const StatusIcon = ({ status, size = 20 }) => {
    const icons = {
        [FIELD_STATUS.SCHEDULED]: Clock,
        [FIELD_STATUS.EN_ROUTE]: Navigation,
        [FIELD_STATUS.ARRIVED]: MapPin,
        [FIELD_STATUS.WORKING]: Wrench,
        [FIELD_STATUS.PAUSED]: Pause,
        [FIELD_STATUS.WRAPPING_UP]: FileText,
        [FIELD_STATUS.COMPLETED]: CheckCircle
    };
    const Icon = icons[status] || Clock;
    return <Icon size={size} />;
};

// ============================================
// ETA DISPLAY
// ============================================

const ETADisplay = ({ eta, isEnRoute }) => {
    if (!isEnRoute || !eta?.available) return null;

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Car size={20} className="text-blue-600" />
                <div>
                    <p className="text-sm font-bold text-blue-800">
                        ETA: {eta.etaTimeFormatted}
                    </p>
                    <p className="text-xs text-blue-600">
                        {eta.distanceMiles} mi • {eta.durationText}
                    </p>
                </div>
            </div>
            {eta.hasTrafficData && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Live Traffic
                </span>
            )}
        </div>
    );
};

// ============================================
// LOCATION STATUS
// ============================================

const LocationStatus = ({ isTracking, currentLocation, permissionStatus, onStartTracking }) => {
    if (permissionStatus === 'denied') {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">Location Blocked</p>
                    <p className="text-xs text-red-600">Enable in browser settings</p>
                </div>
            </div>
        );
    }

    if (!isTracking) {
        return (
            <button
                onClick={onStartTracking}
                className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 hover:bg-emerald-100 transition-colors"
            >
                <Navigation size={20} className="text-emerald-600" />
                <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-emerald-700">Enable Location</p>
                    <p className="text-xs text-emerald-600">Tap to start GPS tracking</p>
                </div>
                <ChevronUp size={16} className="text-emerald-400" />
            </button>
        );
    }

    return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
            <div className="relative">
                <MapPin size={20} className="text-emerald-600" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-emerald-700">Location Active</p>
                <p className="text-xs text-emerald-600">
                    {currentLocation
                        ? `±${Math.round(currentLocation.accuracy || 0)}m accuracy`
                        : 'Acquiring...'
                    }
                </p>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const FieldStatusControls = ({
    job,
    fieldStatus,
    currentLocation,
    currentETA,
    isTracking,
    permissionStatus,
    onStartTracking,
    onStartEnRoute,
    onMarkArrived,
    onStartWorking,
    onPauseWork,
    onCompleteJob,
    loading = false
}) => {
    const [expanded, setExpanded] = useState(true);
    const [showPauseReason, setShowPauseReason] = useState(false);
    const [showCompletionNotes, setShowCompletionNotes] = useState(false);
    const [completionNotes, setCompletionNotes] = useState('');

    const isEnRoute = fieldStatus === FIELD_STATUS.EN_ROUTE;
    const isArrived = fieldStatus === FIELD_STATUS.ARRIVED;
    const isWorking = fieldStatus === FIELD_STATUS.WORKING;
    const isPaused = fieldStatus === FIELD_STATUS.PAUSED;
    const isCompleted = fieldStatus === FIELD_STATUS.COMPLETED;

    // Get next logical action
    const getNextAction = () => {
        switch (fieldStatus) {
            case FIELD_STATUS.SCHEDULED:
                return { label: 'Start Route', action: onStartEnRoute, icon: Navigation, color: 'blue' };
            case FIELD_STATUS.EN_ROUTE:
                return { label: "I've Arrived", action: onMarkArrived, icon: MapPin, color: 'purple' };
            case FIELD_STATUS.ARRIVED:
                return { label: 'Start Work', action: onStartWorking, icon: Wrench, color: 'amber' };
            case FIELD_STATUS.WORKING:
                return { label: 'Complete Job', action: () => setShowCompletionNotes(true), icon: CheckCircle, color: 'emerald' };
            case FIELD_STATUS.PAUSED:
                return { label: 'Resume Work', action: onStartWorking, icon: Play, color: 'amber' };
            default:
                return null;
        }
    };

    const nextAction = getNextAction();

    // Customer contact buttons
    const handleCall = () => {
        if (job?.customer?.phone) {
            window.open(`tel:${job.customer.phone}`);
        }
    };

    const handleText = () => {
        if (job?.customer?.phone) {
            const message = isEnRoute && currentETA?.available
                ? `Hi, I'm on my way! ETA: ${currentETA.etaTimeFormatted}`
                : `Hi, this is your technician. I'll be there soon!`;
            window.open(`sms:${job.customer.phone}?body=${encodeURIComponent(message)}`);
        }
    };

    if (!job) {
        return (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
                <Home size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-600 font-medium">No Active Job</p>
                <p className="text-sm text-slate-400">Select a job to begin tracking</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700"
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: STATUS_CONFIG[fieldStatus]?.color + '33' }}
                    >
                        <StatusIcon status={fieldStatus} size={20} />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-white">
                            {job.title || job.serviceType || 'Job'}
                        </p>
                        <p className="text-sm text-slate-300">
                            {STATUS_CONFIG[fieldStatus]?.label}
                        </p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp size={20} className="text-white" />
                ) : (
                    <ChevronDown size={20} className="text-white" />
                )}
            </button>

            {expanded && (
                <div className="p-4 space-y-4">
                    {/* Location Status */}
                    <LocationStatus
                        isTracking={isTracking}
                        currentLocation={currentLocation}
                        permissionStatus={permissionStatus}
                        onStartTracking={onStartTracking}
                    />

                    {/* ETA Display */}
                    <ETADisplay eta={currentETA} isEnRoute={isEnRoute} />

                    {/* Customer Contact */}
                    {job.customer?.phone && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleCall}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-200"
                            >
                                <Phone size={18} />
                                Call
                            </button>
                            <button
                                onClick={handleText}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-200"
                            >
                                <MessageSquare size={18} />
                                Text ETA
                            </button>
                        </div>
                    )}

                    {/* Main Action Button */}
                    {nextAction && !isCompleted && (
                        <button
                            onClick={nextAction.action}
                            disabled={loading || (!isTracking && fieldStatus === FIELD_STATUS.SCHEDULED)}
                            className={`
                                w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                                ${loading ? 'opacity-50' : ''}
                                ${nextAction.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                                ${nextAction.color === 'purple' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                                ${nextAction.color === 'amber' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                                ${nextAction.color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                            `}
                        >
                            {loading ? (
                                <Loader2 size={24} className="animate-spin" />
                            ) : (
                                <nextAction.icon size={24} />
                            )}
                            {nextAction.label}
                        </button>
                    )}

                    {/* Pause Button (when working) */}
                    {isWorking && (
                        <button
                            onClick={() => setShowPauseReason(true)}
                            className="w-full py-2.5 border-2 border-slate-200 text-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-50"
                        >
                            <Pause size={18} />
                            Pause Work
                        </button>
                    )}

                    {/* Completed State */}
                    {isCompleted && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                            <CheckCircle size={32} className="mx-auto text-emerald-600 mb-2" />
                            <p className="font-bold text-emerald-800">Job Completed!</p>
                            <p className="text-sm text-emerald-600">Great work</p>
                        </div>
                    )}
                </div>
            )}

            {/* Pause Reason Modal */}
            {showPauseReason && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-t-2xl w-full max-w-md p-4 space-y-4">
                        <h3 className="font-bold text-lg">Pause Reason</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['Lunch Break', 'Parts Run', 'Customer Request', 'Other'].map(reason => (
                                <button
                                    key={reason}
                                    onClick={() => {
                                        onPauseWork(reason);
                                        setShowPauseReason(false);
                                    }}
                                    className="py-3 bg-slate-100 rounded-xl font-medium hover:bg-slate-200"
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowPauseReason(false)}
                            className="w-full py-2 text-slate-500"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Completion Notes Modal */}
            {showCompletionNotes && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-t-2xl w-full max-w-md p-4 space-y-4">
                        <h3 className="font-bold text-lg">Complete Job</h3>
                        <textarea
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            placeholder="Add any notes about the work completed..."
                            className="w-full p-3 border rounded-xl resize-none h-24"
                        />
                        <button
                            onClick={() => {
                                onCompleteJob(completionNotes);
                                setShowCompletionNotes(false);
                            }}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold"
                        >
                            Complete Job
                        </button>
                        <button
                            onClick={() => setShowCompletionNotes(false)}
                            className="w-full py-2 text-slate-500"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FieldStatusControls;
