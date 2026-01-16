// src/features/jobs/HomeownerJobDetailView.jsx
// ============================================
// HOMEOWNER JOB DETAIL VIEW
// ============================================
// Full detail view with progress stepper and job management

import React, { useMemo } from 'react';
import {
    X, Building2, MapPin, DollarSign, Phone,
    CalendarDays, RotateCcw, Clock, Info
} from 'lucide-react';
import { JobProgressStepper } from './components/JobProgressStepper';
import { getNextStepGuidance, getCurrentStage, requiresUserAction } from './lib/jobProgressStages';
import { JobScheduler } from './JobScheduler';
import { isRecurringJob } from '../recurring/lib/recurringService';
import {
    jobIsMultiDay,
    isMultiDayJob as checkIsMultiDay,
    calculateDaysNeeded
} from '../contractor-pro/lib/multiDayUtils';
import { formatInTimezone, detectTimezone } from '../contractor-pro/lib/timezoneUtils';

/**
 * HomeownerJobDetailView - Full job detail with progress stepper
 *
 * @param {Object} props
 * @param {Object} props.job - The job object
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onRequestNewTimes - Handler for requesting new times
 * @param {Function} props.onCancel - Handler for cancelling job
 * @param {Function} props.onMessage - Handler for messaging contractor
 * @param {Function} props.onUpdate - Callback when job is updated
 * @param {string} props.timezone - Optional timezone override
 */
export const HomeownerJobDetailView = ({
    job,
    onClose,
    onRequestNewTimes,
    onCancel,
    onMessage,
    onUpdate,
    timezone
}) => {
    const displayTimezone = timezone || detectTimezone();

    // Get effective status (same logic as HomeownerJobCard)
    const effectiveStatus = useMemo(() => {
        if (!job) return 'pending_schedule';

        if (job.status === 'pending_completion') {
            return 'pending_completion';
        }
        if (job.status === 'revision_requested') {
            return 'revision_requested';
        }
        if (job.status === 'quoted' && job.estimate?.status === 'approved') {
            return 'pending_schedule';
        }
        if (job.scheduling?.offeredSlots?.length > 0 && !job.scheduledTime) {
            return 'slots_offered';
        }
        return job.status || 'pending_schedule';
    }, [job]);

    // Multi-day detection
    const multiDayInfo = useMemo(() => {
        if (!job) return { isMultiDay: false, totalDays: 1 };

        if (jobIsMultiDay(job)) {
            return {
                isMultiDay: true,
                totalDays: job.multiDaySchedule?.totalDays || 2,
                endDate: job.multiDaySchedule?.endDate
            };
        }

        if (job.scheduling?.isMultiDay) {
            return {
                isMultiDay: true,
                totalDays: job.scheduling.totalDays || 2
            };
        }

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

    // Get contractor name
    const contractorName = job?.contractorName
        || job?.contractorCompany
        || job?.contractor?.companyName
        || job?.contractor?.name
        || 'Contractor';

    // Get stage info
    const stageInfo = getCurrentStage(effectiveStatus);
    const guidance = getNextStepGuidance(effectiveStatus);
    const needsAction = requiresUserAction(effectiveStatus);

    // Show scheduler for non-terminal statuses that aren't completion-related
    const showScheduler = !['completed', 'cancelled', 'pending_completion', 'revision_requested'].includes(effectiveStatus);

    if (!job) {
        return (
            <div className="p-6 text-center">
                <p className="text-slate-500">No job selected</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 shrink-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-bold text-slate-800 text-lg">
                                    {job.title || job.description || 'Service Request'}
                                </h3>
                                {multiDayInfo.isMultiDay && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md">
                                        <CalendarDays size={10} />
                                        {multiDayInfo.totalDays}-Day
                                    </span>
                                )}
                                {isRecurringJob(job) && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">
                                        <RotateCcw size={10} />
                                        Recurring
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Building2 size={14} className="text-slate-400" />
                                <span>{contractorName}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Progress Stepper */}
                    <div className="mt-4">
                        <JobProgressStepper
                            currentStatus={effectiveStatus}
                            variant="full"
                            showDescriptions={true}
                            animated={true}
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50">
                    {/* Job Details Summary */}
                    <div className="p-4 bg-white border-b border-slate-100">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {/* Address */}
                            {(job.serviceAddress?.formatted || job.customer?.address) && (
                                <div className="col-span-2 flex items-start gap-2">
                                    <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                    <span className="text-slate-600">
                                        {job.serviceAddress?.formatted || job.customer?.address}
                                    </span>
                                </div>
                            )}

                            {/* Total Price */}
                            {typeof job.total === 'number' && job.total > 0 && (
                                <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-slate-400" />
                                    <span className="text-slate-600">
                                        ${job.total.toLocaleString()}
                                    </span>
                                </div>
                            )}

                            {/* Contractor Phone */}
                            {job.contractorPhone && (
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" />
                                    <span className="text-slate-600">
                                        {job.contractorPhone}
                                    </span>
                                </div>
                            )}

                            {/* Estimated Duration */}
                            {job.estimatedDuration && (
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className="text-slate-400" />
                                    <span className="text-slate-600">
                                        Est. {job.estimatedDuration}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scheduler or Status-Specific Content */}
                    {showScheduler ? (
                        <JobScheduler
                            job={job}
                            userType="homeowner"
                            timezone={displayTimezone}
                            onUpdate={onUpdate}
                        />
                    ) : (
                        <div className="p-4">
                            {/* Completed */}
                            {effectiveStatus === 'completed' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-3xl">✓</span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-2">Job Complete!</h4>
                                    <p className="text-sm text-slate-600">
                                        This job has been completed. Items have been added to your home record.
                                    </p>
                                </div>
                            )}

                            {/* Cancelled */}
                            {effectiveStatus === 'cancelled' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <X size={32} className="text-red-500" />
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-2">Job Cancelled</h4>
                                    <p className="text-sm text-slate-600">
                                        This job has been cancelled.
                                    </p>
                                </div>
                            )}

                            {/* Pending Completion */}
                            {effectiveStatus === 'pending_completion' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Info size={32} className="text-purple-600" />
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-2">Review Required</h4>
                                    <p className="text-sm text-slate-600 mb-4">
                                        The contractor has submitted this job as complete. Please review and approve.
                                    </p>
                                    <button
                                        onClick={onClose}
                                        className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors"
                                    >
                                        Review Completion
                                    </button>
                                </div>
                            )}

                            {/* Revision Requested */}
                            {effectiveStatus === 'revision_requested' && (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock size={32} className="text-amber-600" />
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-2">Revision Requested</h4>
                                    <p className="text-sm text-slate-600">
                                        Waiting for the contractor to address your feedback and resubmit.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {!['completed', 'cancelled'].includes(effectiveStatus) && (
                    <div className="p-4 border-t border-slate-100 bg-white flex gap-2 shrink-0">
                        {onMessage && job.contractorId && (
                            <button
                                onClick={() => onMessage(job)}
                                className="flex-1 px-4 py-2.5 text-emerald-600 font-medium rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-colors text-sm"
                            >
                                Message
                            </button>
                        )}
                        {onRequestNewTimes && showScheduler && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onRequestNewTimes(job);
                                }}
                                className="flex-1 px-4 py-2.5 text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
                            >
                                Request Different Times
                            </button>
                        )}
                        {onCancel && !['in_progress', 'pending_completion'].includes(job.status) && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onCancel(job);
                                }}
                                className="px-4 py-2.5 text-red-600 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeownerJobDetailView;
