import { formatTimeInTimezone } from './timezoneUtils';

/**
 * Checks if a technician has a scheduling conflict with a target job
 * @param {string} techId - The ID of the technician to check
 * @param {object} targetJob - The job being assigned (must have schedule info)
 * @param {array} allJobs - List of all jobs to check against
 * @param {string} timezone - IANA timezone identifier for display
 * @returns {object} { hasConflict: boolean, conflictingJob: object|null, reason: string }
 */
export const checkCrewConflict = (techId, targetJob, allJobs, timezone) => {
    // Basic validation
    if (!techId || !targetJob || !allJobs) return { hasConflict: false };

    // Get target job time windows
    const targetWindows = getJobTimeWindows(targetJob);

    if (targetWindows.length === 0) return { hasConflict: false };

    // Filter relevant jobs (assigned to this tech, excluding target job itself)
    const assignedJobs = allJobs.filter(job =>
        job.id !== targetJob.id &&
        job.status !== 'cancelled' &&
        job.status !== 'completed' &&
        getAssignedTechIds(job).includes(techId)
    );

    for (const job of assignedJobs) {
        const jobWindows = getJobTimeWindows(job);

        // Check for overlap between any target window and any job window
        for (const tWindow of targetWindows) {
            for (const jWindow of jobWindows) {
                if (doWindowsOverlap(tWindow, jWindow)) {
                    return {
                        hasConflict: true,
                        conflictingJob: job,
                        reason: `Technician is already assigned to "${job.title || job.description}" (${formatTimeRange(jWindow.start, jWindow.end, timezone)})`
                    };
                }
            }
        }
    }

    return { hasConflict: false };
};

/**
 * Check if a technician is available (not on day-off) for a given date
 * @param {object} tech - Tech object with workingHours
 * @param {Date} date - Date to check
 * @returns {object} { available: boolean, dayName: string }
 */
export const checkDayOffConflict = (tech, date) => {
    if (!tech?.workingHours) return { available: true, dayName: '' };

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = tech.workingHours[dayName];

    // If day is explicitly disabled, tech is off
    if (dayHours?.enabled === false) {
        return { available: false, dayName };
    }

    return { available: true, dayName };
};

// --- Helpers ---

const getAssignedTechIds = (job) => {
    return job.assignedCrewIds ||
        job.assignedCrew?.map(c => c.techId) ||
        (job.assignedTechId ? [job.assignedTechId] : []) ||
        [];
};

/**
 * Format a time range for conflict messages, timezone-aware
 */
const formatTimeRange = (start, end, timezone) => {
    if (!start || !end) return 'Unknown time';

    if (timezone) {
        const startStr = formatTimeInTimezone(start, timezone);
        const endStr = formatTimeInTimezone(end, timezone);
        return `${startStr} - ${endStr}`;
    }

    // Fallback: format in local time
    const opts = { hour: 'numeric', minute: '2-digit', hour12: true };
    return `${start.toLocaleTimeString('en-US', opts)} - ${end.toLocaleTimeString('en-US', opts)}`;
};

/**
 * Extract time windows from a job, handling all storage formats:
 * - ISO string in scheduledTime (from DragDropCalendar)
 * - Date-only string in scheduledDate + time string in scheduledTime (from CreateJobModal)
 * - Multi-day scheduleBlocks
 * - Multi-day multiDaySchedule (from DragDropCalendar direct scheduling)
 */
const getJobTimeWindows = (job) => {
    const windows = [];

    // CASE 1: Multi-Day Blocks (from CreateJobModal)
    if (job.isMultiDay && job.scheduleBlocks?.length > 0) {
        job.scheduleBlocks.forEach(block => {
            if (block.date && block.startTime) {
                const start = normalizeDateTime(block.date, block.startTime);
                const end = block.endTime
                    ? normalizeDateTime(block.date, block.endTime)
                    : addDuration(start, 2); // Default 2h if missing

                if (start && end) {
                    windows.push({ start, end });
                }
            }
        });
        return windows;
    }

    // CASE 2: Multi-Day schedule from DragDropCalendar
    if (job.multiDaySchedule?.days?.length > 0) {
        job.multiDaySchedule.days.forEach(day => {
            if (day.startTime && day.endTime) {
                const start = new Date(day.startTime);
                const end = new Date(day.endTime);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    windows.push({ start, end });
                }
            }
        });
        if (windows.length > 0) return windows;
    }

    // CASE 3: ISO string in scheduledTime (from DragDropCalendar direct schedule)
    if (job.scheduledTime && isISOString(job.scheduledTime)) {
        const start = new Date(job.scheduledTime);
        if (!isNaN(start.getTime())) {
            let end;
            if (job.scheduledEndTime && isISOString(job.scheduledEndTime)) {
                end = new Date(job.scheduledEndTime);
            } else {
                // Use estimatedDuration (in minutes) or default 2h
                const durationMinutes = job.estimatedDuration || 120;
                end = new Date(start.getTime() + durationMinutes * 60 * 1000);
            }
            windows.push({ start, end });
            return windows;
        }
    }

    // CASE 4: Legacy - scheduledDate + scheduledTime as separate fields
    if (job.scheduledDate) {
        const dateObj = job.scheduledDate.toDate
            ? job.scheduledDate.toDate()
            : new Date(job.scheduledDate);

        if (isNaN(dateObj.getTime())) return windows;

        let start;
        if (job.scheduledTime && !isISOString(job.scheduledTime)) {
            // scheduledTime is a time-only string like "09:00"
            start = normalizeDateTime(dateObj, job.scheduledTime);
        } else if (job.scheduledTime && isISOString(job.scheduledTime)) {
            start = new Date(job.scheduledTime);
        } else {
            // No time info, assume start of business day
            start = new Date(dateObj);
            start.setHours(7, 30, 0, 0);
        }

        let end;
        if (job.scheduledEndTime) {
            if (isISOString(job.scheduledEndTime)) {
                end = new Date(job.scheduledEndTime);
            } else {
                end = normalizeDateTime(dateObj, job.scheduledEndTime);
            }
        } else {
            const durationMinutes = job.estimatedDuration || 120;
            end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        }

        if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
            windows.push({ start, end });
        }
    }

    return windows;
};

/**
 * Check if a string looks like an ISO date string (contains 'T' or ends with 'Z')
 */
const isISOString = (str) => {
    if (typeof str !== 'string') return false;
    return str.includes('T') || str.endsWith('Z');
};

const normalizeDateTime = (dateInput, timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;

    // Handle "HH:MM" format
    const timeParts = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (timeParts) {
        d.setHours(parseInt(timeParts[1], 10), parseInt(timeParts[2], 10), 0, 0);
        return d;
    }

    // Handle "H:MM AM/PM" format
    const time12Parts = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Parts) {
        let hours = parseInt(time12Parts[1], 10);
        const minutes = parseInt(time12Parts[2], 10);
        const isPM = time12Parts[3].toUpperCase() === 'PM';
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
        d.setHours(hours, minutes, 0, 0);
        return d;
    }

    return null;
};

const addDuration = (dateObj, hours) => {
    if (!dateObj) return null;
    return new Date(dateObj.getTime() + hours * 60 * 60 * 1000);
};

const doWindowsOverlap = (a, b) => {
    if (!a?.start || !a?.end || !b?.start || !b?.end) return false;
    return a.start < b.end && a.end > b.start;
};
