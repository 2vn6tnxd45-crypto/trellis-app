import { isSameDay } from "date-fns";

/**
 * Checks if a technician has a scheduling conflict with a target job
 * @param {string} techId - The ID of the technician to check
 * @param {object} targetJob - The job being assigned (must have schedule info)
 * @param {array} allJobs - List of all jobs to check against
 * @returns {object} { hasConflict: boolean, conflictingJob: object|null, reason: string }
 */
export const checkCrewConflict = (techId, targetJob, allJobs) => {
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
                        reason: `Technician is already assigned to "${job.title || job.description}" on ${tWindow.dateStr} (${formatTime(job)})`
                    };
                }
            }
        }
    }

    return { hasConflict: false };
};

// --- Helpers ---

const getAssignedTechIds = (job) => {
    return job.assignedCrewIds ||
        job.assignedCrew?.map(c => c.techId) ||
        (job.assignedTechId ? [job.assignedTechId] : []) ||
        [];
};

const formatTime = (job) => {
    // Simple helper for error message
    if (job.isMultiDay && job.scheduleBlocks?.length) return 'Multiple Sessions';
    return `${job.scheduledTime || 'Unknown'} - ${job.scheduledEndTime || 'Unknown'}`;
};

const getJobTimeWindows = (job) => {
    const windows = [];

    // CASE 1: Multi-Day Blocks
    if (job.isMultiDay && job.scheduleBlocks?.length > 0) {
        job.scheduleBlocks.forEach(block => {
            if (block.date && block.startTime) {
                const start = normalizeDateTime(block.date, block.startTime);
                const end = block.endTime
                    ? normalizeDateTime(block.date, block.endTime)
                    : addDuration(start, 2); // Default 2h if missing

                windows.push({ start, end, dateStr: new Date(block.date).toLocaleDateString() });
            }
        });
        return windows;
    }

    // CASE 2: Single Day / Legacy
    if (job.scheduledDate && job.scheduledTime) {
        const dateStr = job.scheduledDate.toDate ? job.scheduledDate.toDate() : new Date(job.scheduledDate);
        const start = normalizeDateTime(dateStr, job.scheduledTime);

        let end;
        if (job.scheduledEndTime) {
            end = normalizeDateTime(dateStr, job.scheduledEndTime);
        } else {
            // Use estimated duration or default 2h
            const duration = job.estimatedDuration || 2;
            end = addDuration(start, duration);
        }

        windows.push({ start, end, dateStr: dateStr.toLocaleDateString() });
    }

    return windows;
};

const normalizeDateTime = (dateInput, timeStr) => {
    const d = new Date(dateInput);
    const [h, m] = timeStr.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
};

const addDuration = (dateObj, hours) => {
    const d = new Date(dateObj);
    d.setMilliseconds(d.getMilliseconds() + hours * 60 * 60 * 1000);
    return d;
};

const doWindowsOverlap = (a, b) => {
    return a.start < b.end && a.end > b.start;
};
