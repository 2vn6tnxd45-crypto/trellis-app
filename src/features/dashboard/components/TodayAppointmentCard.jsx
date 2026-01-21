// src/features/dashboard/components/TodayAppointmentCard.jsx
// ============================================
// TODAY'S APPOINTMENT CARD - Prominent same-day appointment display
// ============================================
// Shows at top of dashboard when homeowner has appointments today

import React from 'react';
import { Clock, MapPin, Phone, Building2, ChevronRight, Calendar, AlertCircle } from 'lucide-react';

// Helper to format time
const formatTime = (date) => {
    if (!date) return 'Time TBD';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

// Helper to get hours until appointment
const getHoursUntil = (scheduledTime) => {
    if (!scheduledTime) return null;
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diffMs = scheduled - now;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) return { text: 'In progress', isPast: true };
    if (diffMins < 60) return { text: `In ${diffMins} min`, isUrgent: true };
    if (diffHours === 1) return { text: 'In 1 hour', isUrgent: true };
    if (diffHours < 4) return { text: `In ${diffHours} hours`, isSoon: true };
    return { text: `In ${diffHours} hours`, isSoon: false };
};

// Helper to check if date is today
const isToday = (date) => {
    if (!date) return false;
    const d = new Date(date);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
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

export const TodayAppointmentCard = ({ jobs = [], onJobClick }) => {
    // Filter to only today's scheduled jobs
    const todaysJobs = jobs.filter(job => {
        if (job.status !== 'scheduled') return false;
        const scheduledTime = job.scheduledTime || job.scheduledDate;
        return isToday(scheduledTime);
    });

    // Don't render if no appointments today
    if (todaysJobs.length === 0) {
        return null;
    }

    const handleJobClick = (job) => {
        if (onJobClick) {
            onJobClick(job);
        } else {
            window.location.href = `/app?jobId=${job.id}`;
        }
    };

    // Single appointment view
    if (todaysJobs.length === 1) {
        const job = todaysJobs[0];
        const scheduledTime = job.scheduledTime || job.scheduledDate;
        const countdown = getHoursUntil(scheduledTime);
        const contractorName = job.contractorName || 'Your Contractor';
        const contractorPhone = job.contractorPhone;
        const serviceAddress = safeAddress(job.serviceAddress) || safeAddress(job.customer?.address) || safeAddress(job.address);

        return (
            <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 mb-6 shadow-lg text-white overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="relative">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Today's Appointment</h3>
                                {countdown && (
                                    <span className={`text-sm font-medium ${
                                        countdown.isPast ? 'text-amber-200' :
                                        countdown.isUrgent ? 'text-amber-200 animate-pulse' :
                                        'text-emerald-100'
                                    }`}>
                                        {countdown.isPast && <AlertCircle className="inline w-3 h-3 mr-1" />}
                                        {countdown.text}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Time badge */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                            <p className="text-xs text-emerald-100 uppercase tracking-wide">Arriving</p>
                            <p className="text-xl font-bold">{formatTime(scheduledTime)}</p>
                        </div>
                    </div>

                    {/* Job Info */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                            {/* Contractor avatar */}
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold shrink-0">
                                {getInitials(contractorName)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-lg truncate">
                                    {job.title || job.description || 'Service Appointment'}
                                </p>
                                <p className="text-emerald-100 text-sm">
                                    {contractorName}
                                </p>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="mt-3 space-y-2">
                            {serviceAddress && (
                                <div className="flex items-center gap-2 text-sm text-emerald-100">
                                    <MapPin className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{serviceAddress}</span>
                                </div>
                            )}
                            {contractorPhone && (
                                <a
                                    href={`tel:${contractorPhone}`}
                                    className="flex items-center gap-2 text-sm text-emerald-100 hover:text-white transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Phone className="w-4 h-4 shrink-0" />
                                    <span>{contractorPhone}</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Action button */}
                    <button
                        onClick={() => handleJobClick(job)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors"
                    >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Multiple appointments view
    return (
        <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 mb-6 shadow-lg text-white overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="relative">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Today's Appointments</h3>
                        <p className="text-emerald-100 text-sm">{todaysJobs.length} appointments scheduled</p>
                    </div>
                </div>

                {/* Appointment list */}
                <div className="space-y-2">
                    {todaysJobs.slice(0, 3).map((job) => {
                        const scheduledTime = job.scheduledTime || job.scheduledDate;
                        const countdown = getHoursUntil(scheduledTime);
                        const contractorName = job.contractorName || 'Contractor';

                        return (
                            <button
                                key={job.id}
                                onClick={() => handleJobClick(job)}
                                className="w-full flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl transition-colors text-left group"
                            >
                                {/* Time */}
                                <div className="w-16 shrink-0 text-center">
                                    <p className="font-bold text-lg">{formatTime(scheduledTime)}</p>
                                    {countdown && (
                                        <p className={`text-xs ${
                                            countdown.isUrgent ? 'text-amber-200' : 'text-emerald-200'
                                        }`}>
                                            {countdown.text}
                                        </p>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="w-px h-10 bg-white/20" />

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                        {job.title || job.description || 'Service'}
                                    </p>
                                    <p className="text-sm text-emerald-200 truncate">
                                        {contractorName}
                                    </p>
                                </div>

                                <ChevronRight className="w-4 h-4 text-emerald-200 group-hover:text-white transition-colors" />
                            </button>
                        );
                    })}

                    {todaysJobs.length > 3 && (
                        <p className="text-sm text-emerald-200 text-center pt-1">
                            +{todaysJobs.length - 3} more appointment{todaysJobs.length - 3 !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TodayAppointmentCard;
