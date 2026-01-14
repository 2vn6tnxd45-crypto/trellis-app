// src/features/contractor-pro/lib/calendarEventsTransformer.js
// ============================================
// CALENDAR EVENTS TRANSFORMER
// ============================================
// Transforms jobs and evaluations into unified calendar events
import { isSameDayInTimezone } from './timezoneUtils';

/**
 * Transform a job document into a calendar event
 */
export const transformJobToEvent = (job) => ({
    id: job.id,
    type: 'job',
    title: job.title || job.description || 'Service Request',
    start: job.scheduledTime || job.scheduledDate,
    end: job.scheduledEndTime,
    duration: job.estimatedDuration,
    status: getJobCalendarStatus(job),
    customer: job.customer || {
        name: job.customerName,
        address: job.serviceAddress?.formatted || job.propertyAddress,
        phone: job.customerPhone
    },
    assignedTechId: job.assignedTechId,
    assignedTechName: job.assignedTechName,
    // Pass through scheduling data for pending slots
    scheduling: job.scheduling,
    // Pass through for multi-day support
    isMultiDay: job.isMultiDay,
    multiDaySchedule: job.multiDaySchedule,
    // Original job reference
    _original: job
});

/**
 * Transform an evaluation document into a calendar event
 */
export const transformEvaluationToEvent = (evaluation) => ({
    id: evaluation.id,
    type: 'evaluation',
    title: `Eval: ${evaluation.jobDescription || evaluation.jobCategory || 'Site Visit'}`,
    start: evaluation.scheduling?.scheduledFor,
    duration: evaluation.scheduling?.duration || 30,
    status: 'evaluation',
    evaluationStatus: evaluation.status,
    customer: {
        name: evaluation.customerName,
        address: evaluation.propertyAddress,
        phone: evaluation.customerPhone,
        email: evaluation.customerEmail
    },
    evaluationType: evaluation.type, // 'virtual' or 'site_visit'
    videoCallLink: evaluation.scheduling?.videoCallLink,
    // Original evaluation reference
    _original: evaluation
});

/**
 * Get calendar-specific status for a job
 */
const getJobCalendarStatus = (job) => {
    if (job.status === 'scheduled' || job.scheduledTime) return 'confirmed';
    if (job.status === 'in_progress') return 'in_progress';
    if (job.status === 'completed') return 'completed';
    if (job.scheduling?.offeredSlots?.some(s => s.status === 'offered')) return 'pending';
    if (job.proposedTimes?.length > 0) return 'pending';
    return 'unscheduled';
};

/**
 * Merge jobs and evaluations into a unified calendar events array
 * @param {Array} jobs - Array of job documents
 * @param {Array} evaluations - Array of evaluation documents
 * @returns {Array} Merged and transformed calendar events
 */
export const mergeCalendarEvents = (jobs = [], evaluations = []) => {
    const events = [];

    // Transform and add jobs
    jobs.forEach(job => {
        events.push(transformJobToEvent(job));
    });

    // Transform and add scheduled evaluations
    evaluations.forEach(evaluation => {
        // Only include evaluations that have been scheduled
        if (evaluation.scheduling?.scheduledFor &&
            evaluation.status !== 'cancelled' &&
            evaluation.status !== 'expired') {
            events.push(transformEvaluationToEvent(evaluation));
        }
    });

    // Sort by start time (scheduled first, then pending)
    events.sort((a, b) => {
        // Unscheduled items go to the end
        if (!a.start && !b.start) return 0;
        if (!a.start) return 1;
        if (!b.start) return -1;
        return new Date(a.start) - new Date(b.start);
    });

    return events;
};

/**
 * Filter calendar events for a specific date
 * @param {Array} events - Array of calendar events
 * @param {Date} date - The date to filter for
 * @param {string} timezone - Target timezone (IANA)
 * @returns {Array} Events occurring on the specified date
 */
export const getEventsForDate = (events, date, timezone) => {
    return events.filter(event => {
        // Handle jobs with confirmed time
        if (event.type === 'job') {
            if (event.start) {
                return isSameDayInTimezone(event.start, date, timezone);
            }
            // Check for pending offered slots
            if (event.scheduling?.offeredSlots?.length > 0) {
                return event.scheduling.offeredSlots.some(slot =>
                    slot.status === 'offered' && isSameDayInTimezone(slot.start, date, timezone)
                );
            }
            // Check for multi-day schedule
            if (event.isMultiDay && event.multiDaySchedule?.segments) {
                return event.multiDaySchedule.segments.some(segment =>
                    isSameDayInTimezone(segment.date, date, timezone)
                );
            }
            return false;
        }

        // Handle evaluations
        if (event.type === 'evaluation') {
            return event.start && isSameDayInTimezone(event.start, date, timezone);
        }

        return false;
    });
};

/**
 * Check if two dates are the same day
 * @deprecated Use isSameDayInTimezone from timezoneUtils instead
 */
const isSameDay = (date1, date2) => {
    return isSameDayInTimezone(date1, date2, 'UTC'); // Fallback to UTC if used without timezone
};

/**
 * Get display time for an event on a specific date
 * Handles pending slots that may have different times on different days
 */
export const getEventDisplayTime = (event, date, timezone) => {
    if (event.start) {
        return event.start;
    }

    // For pending jobs, find the slot for this specific date
    if (event.type === 'job' && event.scheduling?.offeredSlots?.length > 0) {
        const slot = event.scheduling.offeredSlots.find(s =>
            s.status === 'offered' && isSameDayInTimezone(s.start, date, timezone)
        );
        return slot?.start;
    }

    // For multi-day jobs, find the segment for this date
    if (event.isMultiDay && event.multiDaySchedule?.segments) {
        const segment = event.multiDaySchedule.segments.find(s =>
            isSameDayInTimezone(s.date, date, timezone)
        );
        if (segment) {
            // Construct datetime from date and start time
            return `${segment.date}T${segment.start}:00`;
        }
    }

    return null;
};

export default {
    transformJobToEvent,
    transformEvaluationToEvent,
    mergeCalendarEvents,
    getEventsForDate,
    getEventDisplayTime
};
