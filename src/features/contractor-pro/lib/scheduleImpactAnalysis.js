// src/features/contractor-pro/lib/scheduleImpactAnalysis.js
// ============================================
// SCHEDULE IMPACT ANALYSIS
// ============================================
// Analyzes the impact of schedule changes (cancellations, reschedules)
// Provides cascade warnings and route impact analysis

import { getDistance } from './distanceMatrixService';
import { jobIsMultiDay, getMultiDayDates } from './multiDayUtils';
import { detectTimezone, isSameDayInTimezone } from './timezoneUtils';

/**
 * Analyze the impact of cancelling or rescheduling a job
 * @param {Object} targetJob - The job being cancelled/rescheduled
 * @param {Array} allJobs - All jobs for the contractor
 * @param {Object} options - Analysis options
 * @returns {Object} Impact analysis
 */
export const analyzeCancellationImpact = (targetJob, allJobs, options = {}) => {
    const warnings = [];
    const affectedJobs = [];
    const routeImpact = {
        hasImpact: false,
        previousJob: null,
        nextJob: null,
        gapCreated: false,
        estimatedTimeRecovered: 0
    };

    if (!targetJob || !allJobs) {
        return {
            warnings,
            affectedJobs,
            routeImpact,
            severity: 'none',
            summary: 'No impact detected'
        };
    }

    // Get target job date
    const targetDate = targetJob.scheduledTime || targetJob.scheduledDate;
    if (!targetDate) {
        return {
            warnings,
            affectedJobs,
            routeImpact,
            severity: 'none',
            summary: 'Job is not scheduled'
        };
    }

    // Resolve timezone
    const timezone = options.timezone || detectTimezone();

    // Find same-day jobs for the same tech in the correct timezone
    const sameDayJobs = allJobs.filter(job => {
        if (job.id === targetJob.id) return false;
        if (!['scheduled', 'in_progress'].includes(job.status)) return false;

        // Check tech assignment
        if (targetJob.assignedTechId && job.assignedTechId !== targetJob.assignedTechId) return false;

        // Check date
        const jobDate = job.scheduledTime || job.scheduledDate;
        if (!jobDate) return false;

        return isSameDayInTimezone(jobDate, targetDate, timezone);
    });

    // Sort by scheduled time
    sameDayJobs.sort((a, b) => {
        const aTime = new Date(a.scheduledTime || a.scheduledDate).getTime();
        const bTime = new Date(b.scheduledTime || b.scheduledDate).getTime();
        return aTime - bTime;
    });

    // Find position in route
    const targetTime = targetJobDate.getTime();
    let prevJob = null;
    let nextJob = null;

    for (const job of sameDayJobs) {
        const jobTime = new Date(job.scheduledTime || job.scheduledDate).getTime();
        if (jobTime < targetTime) {
            prevJob = job;
        } else if (jobTime > targetTime && !nextJob) {
            nextJob = job;
            break;
        }
    }

    // Analyze route impact
    if (prevJob || nextJob) {
        routeImpact.hasImpact = true;
        routeImpact.previousJob = prevJob ? {
            id: prevJob.id,
            title: prevJob.title || prevJob.description,
            customer: prevJob.customer?.name,
            time: prevJob.scheduledTime
        } : null;
        routeImpact.nextJob = nextJob ? {
            id: nextJob.id,
            title: nextJob.title || nextJob.description,
            customer: nextJob.customer?.name,
            time: nextJob.scheduledTime
        } : null;
        routeImpact.gapCreated = prevJob && nextJob;

        // Estimate time recovered
        const jobDuration = targetJob.estimatedDuration || 120;
        routeImpact.estimatedTimeRecovered = jobDuration;

        affectedJobs.push(...sameDayJobs);
    }

    // Check for multi-day job impact
    if (jobIsMultiDay(targetJob)) {
        const blockedDates = getMultiDayDates(targetJob.multiDaySchedule);
        warnings.push({
            type: 'multi_day',
            severity: 'warning',
            message: `This is a multi-day job spanning ${blockedDates.length} days. Cancelling will free up all blocked days.`,
            affectedDates: blockedDates
        });
    }

    // Check for today's schedule
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetJobDate >= today && targetJobDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
        warnings.push({
            type: 'same_day',
            severity: 'high',
            message: 'This job is scheduled for today. Cancelling may disrupt your current route.'
        });
    }

    // Check if it affects route optimization
    if (sameDayJobs.length > 1) {
        warnings.push({
            type: 'route_impact',
            severity: 'medium',
            message: `This change affects a route with ${sameDayJobs.length} other job${sameDayJobs.length > 1 ? 's' : ''} on this day.`
        });
    }

    // Calculate severity
    let severity = 'low';
    if (warnings.some(w => w.severity === 'high')) severity = 'high';
    else if (warnings.some(w => w.severity === 'medium')) severity = 'medium';

    // Generate summary
    let summary = 'Minimal impact';
    if (sameDayJobs.length > 0) {
        summary = `Affects ${sameDayJobs.length} other job${sameDayJobs.length > 1 ? 's' : ''} on today's route`;
    }
    if (jobIsMultiDay(targetJob)) {
        summary += ` (multi-day: ${targetJob.multiDaySchedule.totalDays} days)`;
    }

    return {
        warnings,
        affectedJobs,
        routeImpact,
        severity,
        summary,
        sameDayJobCount: sameDayJobs.length,
        targetDate: targetJobDateStr
    };
};

/**
 * Analyze the impact of rescheduling a job to a new time
 * @param {Object} job - The job being rescheduled
 * @param {Date} newDate - The new proposed date/time
 * @param {Array} allJobs - All jobs
 * @param {Object} workingHours - Working hours config
 * @returns {Object} Reschedule impact analysis
 */
export const analyzeRescheduleImpact = (job, newDate, allJobs, workingHours = {}, options = {}) => {
    // Pass timezone option down
    const originalImpact = analyzeCancellationImpact(job, allJobs, options);
    const timezone = options.timezone || detectTimezone();

    // Analyze new date conflicts
    const newDayJobs = allJobs.filter(j => {
        if (j.id === job.id) return false;
        const jobDate = j.scheduledTime || j.scheduledDate;
        if (!jobDate) return false;
        return isSameDayInTimezone(jobDate, newDate, timezone);
    });

    // Check for time conflicts
    const conflicts = [];
    const jobDuration = job.estimatedDuration || 120;
    const newStartTime = newDate.getTime();
    const newEndTime = newStartTime + jobDuration * 60 * 1000;

    for (const existingJob of newDayJobs) {
        const existingStart = new Date(existingJob.scheduledTime || existingJob.scheduledDate).getTime();
        const existingDuration = existingJob.estimatedDuration || 120;
        const existingEnd = existingStart + existingDuration * 60 * 1000;

        // Check for overlap
        if (!(newEndTime <= existingStart || newStartTime >= existingEnd)) {
            conflicts.push({
                job: existingJob,
                overlap: Math.min(newEndTime, existingEnd) - Math.max(newStartTime, existingStart)
            });
        }
    }

    // Check working hours
    const dayName = newDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayConfig = workingHours[dayName];
    let workingHoursConflict = false;

    if (dayConfig?.enabled === false) {
        workingHoursConflict = true;
        originalImpact.warnings.push({
            type: 'day_off',
            severity: 'high',
            message: `${dayName} is configured as a day off.`
        });
    }

    return {
        ...originalImpact,
        newDateConflicts: conflicts,
        newDayJobCount: newDayJobs.length,
        hasConflicts: conflicts.length > 0,
        workingHoursConflict,
        recommendation: conflicts.length > 0
            ? 'Consider choosing a different time to avoid conflicts'
            : 'New time slot is available'
    };
};

/**
 * Get a summary for displaying in confirmation dialogs
 * @param {Object} impact - The impact analysis result
 * @returns {Object} Display-ready summary
 */
export const getImpactDisplaySummary = (impact) => {
    if (!impact) {
        return {
            title: 'Confirm Action',
            message: 'No significant impact detected.',
            bulletPoints: [],
            severity: 'low'
        };
    }

    const bulletPoints = [];

    if (impact.sameDayJobCount > 0) {
        bulletPoints.push(`${impact.sameDayJobCount} other job${impact.sameDayJobCount > 1 ? 's' : ''} on this day's route`);
    }

    if (impact.routeImpact?.gapCreated) {
        bulletPoints.push('This will create a gap in your route');
    }

    if (impact.routeImpact?.estimatedTimeRecovered > 0) {
        const hours = Math.floor(impact.routeImpact.estimatedTimeRecovered / 60);
        const mins = impact.routeImpact.estimatedTimeRecovered % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        bulletPoints.push(`~${timeStr} will be freed up`);
    }

    impact.warnings.forEach(w => {
        if (w.type === 'multi_day') {
            bulletPoints.push(`Multi-day job: ${w.affectedDates?.length || 'multiple'} days affected`);
        }
        if (w.type === 'same_day') {
            bulletPoints.push('This job is scheduled for today');
        }
    });

    return {
        title: impact.severity === 'high'
            ? 'Warning: Significant Impact'
            : impact.severity === 'medium'
                ? 'Notice: Route Impact'
                : 'Confirm Action',
        message: impact.summary,
        bulletPoints,
        severity: impact.severity
    };
};

/**
 * Suggest route re-optimization after a cancellation
 * @param {Object} cancelledJob - The cancelled job
 * @param {Array} remainingJobs - Jobs still on the route
 * @returns {Object} Re-optimization suggestions
 */
export const suggestRouteReoptimization = (cancelledJob, remainingJobs) => {
    if (!remainingJobs || remainingJobs.length < 2) {
        return {
            shouldReoptimize: false,
            reason: 'Not enough jobs to optimize'
        };
    }

    // Calculate if there's meaningful time savings
    const totalDuration = remainingJobs.reduce((sum, j) => sum + (j.estimatedDuration || 120), 0);
    const avgJobsPerHour = remainingJobs.length / (totalDuration / 60);

    return {
        shouldReoptimize: remainingJobs.length >= 3,
        reason: remainingJobs.length >= 3
            ? 'Consider re-optimizing your route for better efficiency'
            : 'Route is simple enough, no re-optimization needed',
        potentialSavings: remainingJobs.length >= 3 ? '10-20 minutes' : null,
        jobCount: remainingJobs.length
    };
};

export default {
    analyzeCancellationImpact,
    analyzeRescheduleImpact,
    getImpactDisplaySummary,
    suggestRouteReoptimization
};
