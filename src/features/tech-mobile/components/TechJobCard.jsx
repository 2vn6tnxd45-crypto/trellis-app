// src/features/tech-mobile/components/TechJobCard.jsx
// ============================================
// TECH JOB CARD COMPONENT
// ============================================
// Mobile-optimized job card for technician view
// Shows job details, status, and quick actions

import React from 'react';
import {
    Clock, MapPin, User, Phone, ChevronRight,
    CheckCircle, AlertCircle, Navigation, Play,
    Camera, Users, Star, Wrench
} from 'lucide-react';

// ============================================
// STATUS CONFIGURATION
// ============================================
const STATUS_CONFIG = {
    scheduled: {
        label: 'Scheduled',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-500'
    },
    confirmed: {
        label: 'Confirmed',
        color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        dotColor: 'bg-indigo-500'
    },
    en_route: {
        label: 'En Route',
        color: 'bg-amber-100 text-amber-700 border-amber-200',
        dotColor: 'bg-amber-500'
    },
    in_progress: {
        label: 'In Progress',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500 animate-pulse'
    },
    pending_completion: {
        label: 'Pending',
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        dotColor: 'bg-purple-500'
    },
    completed: {
        label: 'Completed',
        color: 'bg-green-100 text-green-700 border-green-200',
        dotColor: 'bg-green-500'
    },
    completion_accepted: {
        label: 'Done',
        color: 'bg-gray-100 text-gray-600 border-gray-200',
        dotColor: 'bg-gray-400'
    },
    cancelled: {
        label: 'Cancelled',
        color: 'bg-red-100 text-red-700 border-red-200',
        dotColor: 'bg-red-500'
    }
};

// ============================================
// FORMAT TIME
// ============================================
const formatTime = (date) => {
    if (!date) return '--:--';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const formatDuration = (minutes) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// ============================================
// COMPONENT
// ============================================
export const TechJobCard = ({
    job,
    onSelect,
    onNavigate,
    onCall,
    compact = false,
    showActions = true,
    isNext = false
}) => {
    const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.scheduled;

    // Handle navigation
    const handleNavigate = (e) => {
        e.stopPropagation();
        if (onNavigate) {
            onNavigate(job);
        } else if (job.coordinates) {
            // Open in maps app
            const { lat, lng } = job.coordinates;
            window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
        } else if (job.addressFormatted) {
            window.open(`https://maps.google.com/?q=${encodeURIComponent(job.addressFormatted)}`, '_blank');
        }
    };

    // Handle phone call
    const handleCall = (e) => {
        e.stopPropagation();
        if (onCall) {
            onCall(job);
        } else if (job.customerPhone) {
            window.location.href = `tel:${job.customerPhone}`;
        }
    };

    // ============================================
    // COMPACT CARD (for lists)
    // ============================================
    if (compact) {
        return (
            <button
                onClick={() => onSelect?.(job)}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all active:scale-[0.98]"
            >
                <div className="flex items-start gap-3">
                    {/* Time */}
                    <div className="text-center min-w-[50px]">
                        <p className="text-lg font-bold text-gray-900">
                            {formatTime(job.scheduledDateTime)}
                        </p>
                        {job.estimatedDuration && (
                            <p className="text-xs text-gray-400">
                                {formatDuration(job.estimatedDuration)}
                            </p>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                            {job.isLead && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded font-medium">
                                    Lead
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{job.customerName}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{job.addressFormatted}</span>
                        </div>
                    </div>

                    {/* Status & Arrow */}
                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig.color}`}>
                            {statusConfig.label}
                        </span>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                    </div>
                </div>
            </button>
        );
    }

    // ============================================
    // FULL CARD
    // ============================================
    return (
        <div
            className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                isNext ? 'border-emerald-400 shadow-lg shadow-emerald-100' : 'border-gray-200'
            }`}
        >
            {/* Header with Status */}
            <div className={`px-4 py-3 flex items-center justify-between ${
                isNext ? 'bg-gradient-to-r from-emerald-50 to-green-50' : 'bg-gray-50'
            }`}>
                <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotColor}`} />
                    <span className={`text-sm font-medium ${isNext ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {statusConfig.label}
                    </span>
                    {isNext && (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded-full">
                            UP NEXT
                        </span>
                    )}
                </div>
                <span className="text-sm text-gray-400">#{job.jobNumber}</span>
            </div>

            {/* Main Content */}
            <div className="p-4">
                {/* Time & Duration */}
                <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2 text-gray-900">
                        <Clock className="w-5 h-5 text-emerald-500" />
                        <span className="text-xl font-bold">{formatTime(job.scheduledDateTime)}</span>
                        {job.estimatedEndTime && (
                            <span className="text-gray-400">- {formatTime(job.estimatedEndTime)}</span>
                        )}
                    </div>
                    {job.estimatedDuration && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded-full">
                            {formatDuration(job.estimatedDuration)}
                        </span>
                    )}
                </div>

                {/* Job Title */}
                <h2 className="text-lg font-bold text-gray-900 mb-1">{job.title}</h2>

                {/* Category */}
                {job.category && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                        <Wrench className="w-4 h-4" />
                        <span>{job.category}</span>
                    </div>
                )}

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">{job.customerName}</p>
                            <button
                                onClick={handleCall}
                                className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                            >
                                <Phone className="w-3 h-3" />
                                {job.customerPhone || 'No phone'}
                            </button>
                        </div>
                        {job.customerPhone && (
                            <button
                                onClick={handleCall}
                                className="p-2 bg-emerald-100 rounded-full hover:bg-emerald-200 transition-colors"
                            >
                                <Phone className="w-5 h-5 text-emerald-600" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Address */}
                <button
                    onClick={handleNavigate}
                    className="w-full flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors text-left"
                >
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{job.addressFormatted}</p>
                        <p className="text-xs text-blue-600">Tap for directions</p>
                    </div>
                    <Navigation className="w-5 h-5 text-blue-500" />
                </button>

                {/* Crew Info */}
                {job.crewSize > 1 && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-purple-50 rounded-lg">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-purple-700">
                            {job.crewSize} techs assigned
                            {job.isLead && ' • You are the lead'}
                        </span>
                    </div>
                )}

                {/* Notes */}
                {job.customerNotes && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-xs font-medium text-amber-700 mb-1">Customer Notes:</p>
                        <p className="text-sm text-amber-900">{job.customerNotes}</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            {showActions && (
                <div className="px-4 pb-4 flex gap-2">
                    {job.status === 'scheduled' && (
                        <button
                            onClick={() => onSelect?.(job)}
                            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Play className="w-5 h-5" />
                            Start Job
                        </button>
                    )}
                    {job.status === 'in_progress' && (
                        <button
                            onClick={() => onSelect?.(job)}
                            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Camera className="w-5 h-5" />
                            Complete Job
                        </button>
                    )}
                    {(job.status === 'scheduled' || job.status === 'confirmed') && (
                        <button
                            onClick={handleNavigate}
                            className="px-4 py-3 bg-blue-100 text-blue-700 rounded-xl font-semibold hover:bg-blue-200 transition-colors"
                        >
                            <Navigation className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TechJobCard;
