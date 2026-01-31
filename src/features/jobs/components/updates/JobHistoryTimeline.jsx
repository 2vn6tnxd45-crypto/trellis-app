// src/features/jobs/components/updates/JobHistoryTimeline.jsx
// ============================================
// JOB HISTORY TIMELINE COMPONENT
// ============================================
// Displays chronological timeline of all job events and customer communications

import React, { useMemo, useState } from 'react';
import {
    Calendar,
    FileText,
    CheckCircle,
    Clock,
    Wrench,
    AlertTriangle,
    Package,
    Send,
    MessageSquare,
    Flag,
    Eye
} from 'lucide-react';

// ============================================
// CONSTANTS
// ============================================

const EVENT_TYPES = {
    JOB_CREATED: 'job_created',
    QUOTE_SENT: 'quote_sent',
    QUOTE_ACCEPTED: 'quote_accepted',
    JOB_SCHEDULED: 'job_scheduled',
    JOB_STARTED: 'job_started',
    UPDATE_PROGRESS: 'update_progress',
    UPDATE_ISSUE: 'update_issue',
    UPDATE_MATERIAL: 'update_material',
    UPDATE_DELAY: 'update_delay',
    JOB_COMPLETED: 'job_completed'
};

const EVENT_CONFIG = {
    [EVENT_TYPES.JOB_CREATED]: {
        icon: FileText,
        color: 'bg-slate-500',
        borderColor: 'border-slate-500',
        label: 'Job Created'
    },
    [EVENT_TYPES.QUOTE_SENT]: {
        icon: Send,
        color: 'bg-blue-500',
        borderColor: 'border-blue-500',
        label: 'Quote Sent'
    },
    [EVENT_TYPES.QUOTE_ACCEPTED]: {
        icon: CheckCircle,
        color: 'bg-emerald-500',
        borderColor: 'border-emerald-500',
        label: 'Quote Accepted'
    },
    [EVENT_TYPES.JOB_SCHEDULED]: {
        icon: Calendar,
        color: 'bg-indigo-500',
        borderColor: 'border-indigo-500',
        label: 'Job Scheduled'
    },
    [EVENT_TYPES.JOB_STARTED]: {
        icon: Wrench,
        color: 'bg-amber-500',
        borderColor: 'border-amber-500',
        label: 'Job Started'
    },
    [EVENT_TYPES.UPDATE_PROGRESS]: {
        icon: Wrench,
        color: 'bg-emerald-500',
        borderColor: 'border-emerald-500',
        label: 'Progress Update'
    },
    [EVENT_TYPES.UPDATE_ISSUE]: {
        icon: AlertTriangle,
        color: 'bg-red-500',
        borderColor: 'border-red-500',
        label: 'Issue Reported'
    },
    [EVENT_TYPES.UPDATE_MATERIAL]: {
        icon: Package,
        color: 'bg-blue-500',
        borderColor: 'border-blue-500',
        label: 'Material Note'
    },
    [EVENT_TYPES.UPDATE_DELAY]: {
        icon: Clock,
        color: 'bg-amber-500',
        borderColor: 'border-amber-500',
        label: 'Delay Reported'
    },
    [EVENT_TYPES.JOB_COMPLETED]: {
        icon: Flag,
        color: 'bg-emerald-600',
        borderColor: 'border-emerald-600',
        label: 'Job Completed'
    }
};

// ============================================
// HELPERS
// ============================================

// Parse various timestamp formats
const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
};

// Format date for display
const formatDateTime = (date) => {
    if (!date) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

// Format relative time
const formatRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return '';
};

// ============================================
// MAIN COMPONENT
// ============================================

export const JobHistoryTimeline = ({ job, updates = [] }) => {
    const [expandedEvent, setExpandedEvent] = useState(null);

    // Build timeline events from job data and updates
    const timelineEvents = useMemo(() => {
        const events = [];

        // Job created
        const createdAt = parseTimestamp(job.createdAt);
        if (createdAt) {
            events.push({
                id: 'created',
                type: EVENT_TYPES.JOB_CREATED,
                date: createdAt,
                description: `Service request created for ${job.title || job.serviceType || 'service'}`,
                details: job.description || null
            });
        }

        // Quote sent
        const quoteSentAt = parseTimestamp(job.quote?.sentAt || job.quoteSentAt);
        if (quoteSentAt) {
            const quoteAmount = job.quote?.total || job.quoteAmount;
            events.push({
                id: 'quote_sent',
                type: EVENT_TYPES.QUOTE_SENT,
                date: quoteSentAt,
                description: quoteAmount
                    ? `Quote sent for ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quoteAmount)}`
                    : 'Quote sent to customer'
            });
        }

        // Quote accepted
        const quoteAcceptedAt = parseTimestamp(job.quote?.acceptedAt || job.quoteAcceptedAt);
        if (quoteAcceptedAt) {
            events.push({
                id: 'quote_accepted',
                type: EVENT_TYPES.QUOTE_ACCEPTED,
                date: quoteAcceptedAt,
                description: 'Customer accepted the quote'
            });
        }

        // Job scheduled
        const scheduledAt = parseTimestamp(job.scheduledAt || job.scheduling?.confirmedAt);
        if (scheduledAt) {
            const scheduledTime = parseTimestamp(job.scheduledTime);
            events.push({
                id: 'scheduled',
                type: EVENT_TYPES.JOB_SCHEDULED,
                date: scheduledAt,
                description: scheduledTime
                    ? `Scheduled for ${scheduledTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                    : 'Job scheduled with customer'
            });
        }

        // Job started
        const startedAt = parseTimestamp(job.startedAt);
        if (startedAt) {
            events.push({
                id: 'started',
                type: EVENT_TYPES.JOB_STARTED,
                date: startedAt,
                description: 'Work started on site'
            });
        }

        // Progress updates
        updates.forEach((update) => {
            const updateDate = parseTimestamp(update.createdAt);
            if (!updateDate) return;

            const typeMap = {
                progress: EVENT_TYPES.UPDATE_PROGRESS,
                issue: EVENT_TYPES.UPDATE_ISSUE,
                material: EVENT_TYPES.UPDATE_MATERIAL,
                delay: EVENT_TYPES.UPDATE_DELAY
            };

            events.push({
                id: `update_${update.id}`,
                type: typeMap[update.type] || EVENT_TYPES.UPDATE_PROGRESS,
                date: updateDate,
                description: update.notes?.substring(0, 100) + (update.notes?.length > 100 ? '...' : ''),
                fullNotes: update.notes,
                photos: update.photos || [],
                createdBy: update.createdByName,
                sentToCustomer: update.sentToCustomer,
                customerSummary: update.customerSummary,
                updateData: update
            });
        });

        // Job completed
        const completedAt = parseTimestamp(job.completedAt);
        if (completedAt) {
            events.push({
                id: 'completed',
                type: EVENT_TYPES.JOB_COMPLETED,
                date: completedAt,
                description: 'Job marked as complete'
            });
        }

        // Sort by date descending (newest first)
        return events.sort((a, b) => b.date - a.date);
    }, [job, updates]);

    if (timelineEvents.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No history available</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

            {/* Events */}
            <div className="space-y-4">
                {timelineEvents.map((event, index) => {
                    const config = EVENT_CONFIG[event.type] || EVENT_CONFIG[EVENT_TYPES.JOB_CREATED];
                    const Icon = config.icon;
                    const isExpanded = expandedEvent === event.id;
                    const isUpdate = event.type.startsWith('update_') || event.updateData;

                    return (
                        <div key={event.id} className="relative pl-10">
                            {/* Timeline dot */}
                            <div className={`absolute left-2 top-1 w-5 h-5 rounded-full ${config.color} flex items-center justify-center ring-4 ring-white`}>
                                <Icon className="w-3 h-3 text-white" />
                            </div>

                            {/* Event card */}
                            <div
                                className={`bg-white border border-slate-200 rounded-xl p-4 transition-all ${
                                    isUpdate ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm' : ''
                                }`}
                                onClick={() => isUpdate && setExpandedEvent(isExpanded ? null : event.id)}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {config.label}
                                            </span>
                                            {event.sentToCustomer && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                    <Send className="w-3 h-3" />
                                                    Sent
                                                </span>
                                            )}
                                            {event.createdBy && (
                                                <span className="text-xs text-slate-400">
                                                    by {event.createdBy}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-600 text-sm mt-1 line-clamp-2">
                                            {event.description}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-slate-500">
                                            {formatDateTime(event.date)}
                                        </p>
                                        {formatRelativeTime(event.date) && (
                                            <p className="text-xs text-slate-400">
                                                {formatRelativeTime(event.date)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Photo count indicator */}
                                {event.photos?.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                                            📷 {event.photos.length} photo{event.photos.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}

                                {/* Expanded content for updates */}
                                {isExpanded && isUpdate && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                        {/* Full notes */}
                                        {event.fullNotes && (
                                            <div className="mb-4">
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                                                    Crew Notes
                                                </p>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                    {event.fullNotes}
                                                </p>
                                            </div>
                                        )}

                                        {/* Photos */}
                                        {event.photos?.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                                    Photos
                                                </p>
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {event.photos.map((photo, idx) => (
                                                        <a
                                                            key={photo.id || idx}
                                                            href={photo.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <img
                                                                src={photo.url}
                                                                alt={photo.caption || 'Update photo'}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Sent message */}
                                        {event.customerSummary && (
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                                                    <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                                                        Message Sent to Customer
                                                    </p>
                                                </div>
                                                <p className="text-sm text-emerald-800 whitespace-pre-wrap">
                                                    {event.customerSummary.editedText || event.customerSummary.generatedText}
                                                </p>
                                                <div className="mt-2 flex items-center gap-3 text-xs text-emerald-600">
                                                    <span>
                                                        via {event.customerSummary.sentVia === 'sms' ? 'Text' : 'Email'}
                                                    </span>
                                                    {event.customerSummary.sentAt && (
                                                        <span>
                                                            {formatDateTime(parseTimestamp(event.customerSummary.sentAt))}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Expand indicator for updates */}
                                {isUpdate && !isExpanded && (event.fullNotes?.length > 100 || event.customerSummary) && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-indigo-600 font-medium">
                                        <Eye className="w-3 h-3" />
                                        Click to view details
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default JobHistoryTimeline;
