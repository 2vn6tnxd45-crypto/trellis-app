// src/features/jobs/components/SchedulingConfirmationModal.jsx
// ============================================
// SCHEDULING CONFIRMATION MODAL
// ============================================
// Shows appointment confirmation with calendar export options

import React, { useState } from 'react';
import {
    X, CheckCircle, Calendar, Clock, MapPin, Phone,
    Building2, MessageSquare, Download, ExternalLink,
    ChevronDown, ChevronUp
} from 'lucide-react';
import {
    generateGoogleCalendarUrl,
    generateOutlookUrl,
    downloadICSFile,
    createEventFromJob
} from '../../../lib/calendarExport';

// Format date for display
const formatDisplayDate = (date) => {
    if (!date) return 'Date TBD';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

// Format time for display
const formatDisplayTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

// Calculate duration between two dates
const formatDuration = (start, end) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
        const diffMins = Math.round(diffMs / (1000 * 60));
        return `${diffMins} minutes`;
    }
    if (diffHours === 1) return '1 hour';
    return `${diffHours} hours`;
};

// Google Calendar icon SVG
const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

// Apple icon
const AppleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
);

// Outlook icon
const OutlookIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.152-.352.228-.584.228h-8.227v-6.074l1.262 1.262c.096.096.2.147.313.147.112 0 .216-.05.313-.147l.588-.588c.096-.096.144-.2.144-.313 0-.113-.048-.217-.144-.313l-3.022-3.022c-.096-.096-.2-.144-.313-.144-.113 0-.217.048-.313.144l-3.021 3.022c-.096.096-.144.2-.144.313 0 .113.048.217.144.313l.588.588c.096.096.2.147.313.147.112 0 .216-.05.313-.147l1.262-1.262v6.074H.808c-.232 0-.427-.076-.584-.228-.158-.152-.237-.346-.237-.576V7.387L12 12.52 24 7.387zM23.178 5.33c.158.152.237.345.237.576v.334L12 11.28.585 6.24V5.906c0-.23.08-.424.237-.576.158-.152.352-.228.584-.228h21.188c.232 0 .427.076.584.228z"/>
    </svg>
);

export const SchedulingConfirmationModal = ({
    isOpen,
    onClose,
    job,
    selectedSlot,
    contractor = {}
}) => {
    const [showCalendarOptions, setShowCalendarOptions] = useState(false);

    if (!isOpen) return null;

    // Build event data for calendar export
    const event = createEventFromJob(
        {
            ...job,
            scheduledTime: selectedSlot?.start,
            scheduledEndTime: selectedSlot?.end
        },
        contractor
    );

    // Get contractor info with fallbacks
    const contractorName = contractor.companyName || job.contractorName || 'Your Contractor';
    const contractorPhone = contractor.phone || job.contractorPhone;
    const serviceAddress = job.serviceAddress || job.customer?.address || job.address || 'Address on file';

    // Handle multi-day jobs
    const isMultiDay = job.multiDaySchedule?.isMultiDay || job.scheduling?.isMultiDay;
    const totalDays = job.multiDaySchedule?.totalDays || job.scheduling?.totalDays || 1;

    // Calendar action handlers
    const handleGoogleCalendar = () => {
        window.open(generateGoogleCalendarUrl(event), '_blank');
    };

    const handleOutlookCalendar = () => {
        window.open(generateOutlookUrl(event), '_blank');
    };

    const handleAppleCalendar = () => {
        // For Apple, we download the ICS file which opens in Calendar app
        downloadICSFile(event, `appointment-${job.id}`);
    };

    const handleDownloadICS = () => {
        downloadICSFile(event, `appointment-${job.id}`);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Success Header */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
                        <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-bold">Appointment Confirmed!</h2>
                    <p className="text-emerald-100 mt-1">You're all set</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Appointment Details Card */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                            Appointment Details
                        </h3>

                        <div className="space-y-2">
                            {/* Date */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Calendar className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">
                                        {formatDisplayDate(selectedSlot?.start)}
                                    </p>
                                    {isMultiDay && (
                                        <p className="text-sm text-indigo-600 font-medium">
                                            {totalDays}-day job (consecutive days)
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Time */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">
                                        {formatDisplayTime(selectedSlot?.start)}
                                        {selectedSlot?.end && ` - ${formatDisplayTime(selectedSlot?.end)}`}
                                    </p>
                                    {selectedSlot?.start && selectedSlot?.end && (
                                        <p className="text-sm text-slate-500">
                                            {isMultiDay ? 'Daily schedule' : formatDuration(selectedSlot.start, selectedSlot.end)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Service */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-800">
                                        {job.title || job.description || 'Service Appointment'}
                                    </p>
                                    <p className="text-sm text-slate-500">{contractorName}</p>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                                    <MapPin className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-700">{serviceAddress}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contractor Info */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-600" />
                            Contractor
                        </h3>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-slate-800">{contractorName}</p>
                                {contractorPhone && (
                                    <a
                                        href={`tel:${contractorPhone}`}
                                        className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-1"
                                    >
                                        <Phone className="w-3 h-3" />
                                        {contractorPhone}
                                    </a>
                                )}
                            </div>
                            {/* Message button could go here */}
                        </div>
                    </div>

                    {/* Add to Calendar Section */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <button
                            onClick={() => setShowCalendarOptions(!showCalendarOptions)}
                            className="w-full flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                <span className="font-bold text-blue-900">Add to Calendar</span>
                            </div>
                            {showCalendarOptions ? (
                                <ChevronUp className="w-5 h-5 text-blue-600" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-blue-600" />
                            )}
                        </button>

                        {showCalendarOptions && (
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                {/* Google Calendar */}
                                <button
                                    onClick={handleGoogleCalendar}
                                    className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                >
                                    <GoogleIcon />
                                    <span className="text-sm font-medium text-slate-700">Google</span>
                                </button>

                                {/* Apple Calendar */}
                                <button
                                    onClick={handleAppleCalendar}
                                    className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                                >
                                    <AppleIcon />
                                    <span className="text-sm font-medium text-slate-700">Apple</span>
                                </button>

                                {/* Outlook */}
                                <button
                                    onClick={handleOutlookCalendar}
                                    className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                >
                                    <OutlookIcon />
                                    <span className="text-sm font-medium text-slate-700">Outlook</span>
                                </button>

                                {/* Download ICS */}
                                <button
                                    onClick={handleDownloadICS}
                                    className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                                >
                                    <Download className="w-5 h-5 text-emerald-600" />
                                    <span className="text-sm font-medium text-slate-700">Download</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* What's Next */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            What's Next?
                        </h3>
                        <p className="text-sm text-amber-800">
                            {contractorName} will arrive during your scheduled window.
                            Make sure someone is available to provide access if needed.
                        </p>
                        {job.notes && (
                            <p className="text-sm text-amber-700 mt-2 italic">
                                Note: {job.notes}
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SchedulingConfirmationModal;
