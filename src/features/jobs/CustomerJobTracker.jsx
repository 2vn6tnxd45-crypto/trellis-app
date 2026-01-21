// src/features/jobs/CustomerJobTracker.jsx
// ============================================
// CUSTOMER JOB TRACKING PAGE
// ============================================
// Live status tracking page for customers to see job progress
// Accessible via shareable link - no login required

import React, { useState, useEffect } from 'react';
import {
    Clock,
    MapPin,
    User,
    Truck,
    CheckCircle,
    AlertCircle,
    Phone,
    Calendar,
    Package,
    Camera,
    MessageSquare,
    Navigation,
    Loader2,
    RefreshCw,
    Shield,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';

// ============================================
// HELPERS
// ============================================

// Helper to safely extract address string (prevents React Error #310)
const safeAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
        if (addr.formatted) return addr.formatted;
        if (addr.full) return addr.full;
        if (addr.street) return addr.street;
        return '';
    }
    return String(addr);
};

// ============================================
// STATUS CONFIGURATION
// ============================================

const STATUS_CONFIG = {
    pending_schedule: {
        label: 'Scheduling',
        description: 'Waiting for appointment to be scheduled',
        color: 'amber',
        icon: Calendar,
        step: 1
    },
    slots_offered: {
        label: 'Choose Time',
        description: 'Time slots have been offered - please select one',
        color: 'blue',
        icon: Clock,
        step: 1
    },
    scheduled: {
        label: 'Scheduled',
        description: 'Your appointment is confirmed',
        color: 'blue',
        icon: Calendar,
        step: 2
    },
    dispatched: {
        label: 'Dispatched',
        description: 'Technician has been assigned and is preparing',
        color: 'indigo',
        icon: User,
        step: 3
    },
    on_the_way: {
        label: 'On The Way',
        description: 'Technician is heading to your location',
        color: 'purple',
        icon: Truck,
        step: 4
    },
    arrived: {
        label: 'Arrived',
        description: 'Technician has arrived at your location',
        color: 'emerald',
        icon: MapPin,
        step: 5
    },
    in_progress: {
        label: 'In Progress',
        description: 'Work is currently in progress',
        color: 'emerald',
        icon: Clock,
        step: 5
    },
    paused: {
        label: 'Paused',
        description: 'Work paused - will resume next scheduled day',
        color: 'amber',
        icon: Clock,
        step: 5
    },
    pending_completion: {
        label: 'Awaiting Review',
        description: 'Job complete - awaiting your review',
        color: 'teal',
        icon: CheckCircle,
        step: 6
    },
    completed: {
        label: 'Completed',
        description: 'Job has been completed successfully',
        color: 'emerald',
        icon: CheckCircle,
        step: 7
    },
    cancelled: {
        label: 'Cancelled',
        description: 'This job has been cancelled',
        color: 'red',
        icon: AlertCircle,
        step: 0
    }
};

const STEPS = [
    { id: 'schedule', label: 'Scheduled', icon: Calendar },
    { id: 'dispatch', label: 'Dispatched', icon: User },
    { id: 'enroute', label: 'On The Way', icon: Truck },
    { id: 'work', label: 'In Progress', icon: Clock },
    { id: 'review', label: 'Review', icon: CheckCircle },
    { id: 'complete', label: 'Complete', icon: Shield }
];

// ============================================
// MAIN COMPONENT
// ============================================

export const CustomerJobTracker = ({
    jobId,
    trackingToken // Optional token for security
}) => {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [showDetails, setShowDetails] = useState(false);

    // ----------------------------------------
    // Real-time job subscription
    // ----------------------------------------
    useEffect(() => {
        if (!jobId) {
            setError('No job ID provided');
            setLoading(false);
            return;
        }

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        const unsubscribe = onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                const jobData = { id: snapshot.id, ...snapshot.data() };

                // Verify tracking token if provided
                if (trackingToken && jobData.trackingToken !== trackingToken) {
                    setError('Invalid tracking link');
                    setLoading(false);
                    return;
                }

                setJob(jobData);
                setLastUpdate(new Date());
            } else {
                setError('Job not found');
            }
            setLoading(false);
        }, (err) => {
            console.error('Error loading job:', err);
            setError('Failed to load job status');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [jobId, trackingToken]);

    // ----------------------------------------
    // Loading state
    // ----------------------------------------
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-600">Loading job status...</p>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Error state
    // ----------------------------------------
    if (error || !job) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center bg-white rounded-2xl shadow-lg p-8 max-w-md">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">
                        Unable to Load
                    </h2>
                    <p className="text-slate-600">
                        {error || 'This job could not be found. The link may be expired or invalid.'}
                    </p>
                </div>
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending_schedule;
    const StatusIcon = statusConfig.icon;
    const currentStep = statusConfig.step;

    // ----------------------------------------
    // Main render
    // ----------------------------------------
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className={`bg-${statusConfig.color}-600 text-white px-4 py-6`}>
                <div className="max-w-lg mx-auto">
                    {/* Company branding would go here */}
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-lg font-bold">Job Tracking</h1>
                        <span className="text-xs opacity-75">
                            Updated {formatTimeAgo(lastUpdate)}
                        </span>
                    </div>

                    {/* Status Card */}
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <StatusIcon size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{statusConfig.label}</h2>
                                <p className="text-white/80 text-sm">{statusConfig.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Progress Steps */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                        Progress
                    </h3>
                    <div className="flex items-center justify-between">
                        {STEPS.map((step, idx) => {
                            const isComplete = currentStep > idx + 1;
                            const isCurrent = currentStep === idx + 1 ||
                                (currentStep === 5 && (idx === 3 || idx === 4)); // In progress covers work/review
                            const StepIcon = step.icon;

                            return (
                                <div key={step.id} className="flex flex-col items-center flex-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                                        isComplete
                                            ? 'bg-emerald-500 text-white'
                                            : isCurrent
                                                ? `bg-${statusConfig.color}-500 text-white`
                                                : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {isComplete ? (
                                            <CheckCircle size={16} />
                                        ) : (
                                            <StepIcon size={14} />
                                        )}
                                    </div>
                                    <span className={`text-xs text-center ${
                                        isCurrent || isComplete ? 'text-slate-700 font-medium' : 'text-slate-400'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tech Info (when on the way or arrived) */}
                {(job.status === 'on_the_way' || job.status === 'arrived' || job.status === 'in_progress') && job.assignedTechId && (
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            Your Technician
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center">
                                <User size={28} className="text-indigo-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-800">
                                    {job.assignedTechName || 'Your Technician'}
                                </p>
                                {job.etaMinutes && job.status === 'on_the_way' && (
                                    <p className="text-sm text-emerald-600">
                                        Arriving in ~{job.etaMinutes} minutes
                                    </p>
                                )}
                                {job.techCheckedIn && (
                                    <p className="text-sm text-emerald-600">
                                        Currently on site
                                    </p>
                                )}
                            </div>
                            {job.assignedTechPhone && (
                                <a
                                    href={`tel:${job.assignedTechPhone}`}
                                    className="p-3 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors"
                                >
                                    <Phone size={20} />
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Appointment Details */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                            Appointment Details
                        </h3>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            {showDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Date/Time */}
                        {job.scheduledDate && (
                            <div className="flex items-start gap-3">
                                <Calendar size={18} className="text-slate-400 mt-0.5" />
                                <div>
                                    <p className="font-medium text-slate-800">
                                        {formatDate(job.scheduledDate)}
                                    </p>
                                    {job.scheduledTime && (
                                        <p className="text-sm text-slate-500">
                                            {formatTime(job.scheduledTime)}
                                            {job.scheduledEndTime && ` - ${formatTime(job.scheduledEndTime)}`}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Multi-day info */}
                        {job.multiDaySchedule?.isMultiDay && (
                            <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-3 -mx-1">
                                <Clock size={18} className="text-amber-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-amber-800">
                                        Multi-Day Job
                                    </p>
                                    <p className="text-sm text-amber-600">
                                        {job.multiDaySchedule.totalDays} days scheduled
                                        {job.dailyProgress && ` • Day ${job.dailyProgress.length + 1}`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Address */}
                        {(safeAddress(job.customer?.address) || safeAddress(job.address)) && (
                            <div className="flex items-start gap-3">
                                <MapPin size={18} className="text-slate-400 mt-0.5" />
                                <div>
                                    <p className="text-slate-800">
                                        {safeAddress(job.customer?.address) || safeAddress(job.address)}
                                    </p>
                                    <a
                                        href={`https://maps.google.com/?q=${encodeURIComponent(safeAddress(job.customer?.address) || safeAddress(job.address))}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                                    >
                                        <Navigation size={12} />
                                        Get Directions
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Expanded details */}
                    {showDetails && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                            {/* Job description */}
                            {(job.title || job.description) && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Service</p>
                                    <p className="text-slate-800">{job.title || job.description}</p>
                                </div>
                            )}

                            {/* Line items preview */}
                            {job.lineItems?.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-500 uppercase mb-2">Work Scope</p>
                                    <div className="space-y-1">
                                        {job.lineItems.slice(0, 3).map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                <Package size={12} className="text-slate-400" />
                                                <span className="text-slate-700">{item.description}</span>
                                            </div>
                                        ))}
                                        {job.lineItems.length > 3 && (
                                            <p className="text-xs text-slate-400">
                                                +{job.lineItems.length - 3} more items
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Activity Timeline */}
                {job.statusHistory?.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                            Activity
                        </h3>
                        <div className="space-y-3">
                            {job.statusHistory.slice(-5).reverse().map((entry, idx) => {
                                const config = STATUS_CONFIG[entry.status] || {};
                                const EntryIcon = config.icon || Clock;

                                return (
                                    <div key={idx} className="flex items-start gap-3">
                                        <div className={`p-1.5 bg-${config.color || 'slate'}-100 rounded-lg`}>
                                            <EntryIcon size={14} className={`text-${config.color || 'slate'}-600`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800">
                                                {config.label || entry.status}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {formatDateTime(entry.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Contact Card */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Need Help?
                    </h3>
                    <div className="flex gap-3">
                        {job.contractorPhone && (
                            <a
                                href={`tel:${job.contractorPhone}`}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-100 text-emerald-700 rounded-xl font-medium hover:bg-emerald-200 transition-colors"
                            >
                                <Phone size={18} />
                                Call
                            </a>
                        )}
                        {job.contractorEmail && (
                            <a
                                href={`mailto:${job.contractorEmail}`}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-medium hover:bg-indigo-200 transition-colors"
                            >
                                <MessageSquare size={18} />
                                Email
                            </a>
                        )}
                    </div>
                </div>

                {/* Auto-refresh notice */}
                <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                    <RefreshCw size={12} />
                    This page updates automatically
                </p>
            </div>
        </div>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const formatDateTime = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

export default CustomerJobTracker;
