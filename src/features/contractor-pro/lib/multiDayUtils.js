// src/features/contractor-pro/lib/multiDayUtils.js
// ============================================
// MULTI-DAY JOB UTILITIES
// ============================================
// Helpers for scheduling and managing jobs that span multiple days

/**
 * Calculate number of workdays needed for a job
 * @param {number} durationMinutes - Total job duration in minutes
 * @param {number} hoursPerDay - Working hours per day (default 8)
 * @returns {number} Number of days needed
 */
export const calculateDaysNeeded = (durationMinutes, hoursPerDay = 8) => {
    if (!durationMinutes || durationMinutes <= 0) return 1;
    const minutesPerDay = hoursPerDay * 60;
    return Math.ceil(durationMinutes / minutesPerDay);
};

/**
 * Check if a job is multi-day based on duration
 * @param {number} durationMinutes - Duration in minutes
 * @param {number} maxDayMinutes - Max minutes per day (default 480 = 8 hours)
 * @returns {boolean}
 */
export const isMultiDayJob = (durationMinutes, maxDayMinutes = 480) => {
    return durationMinutes > maxDayMinutes;
};

/**
 * Get local date string (YYYY-MM-DD) without timezone conversion issues
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Generate day segments for a multi-day job
 * @param {Date} startDate - The start date for the job
 * @param {number} totalMinutes - Total duration in minutes
 * @param {Object} workingHours - Working hours configuration by day
 * @param {number} minutesPerDay - Default working minutes per day
 * @returns {Array<{date: string, dayNumber: number, startTime: string, endTime: string, startHour: number, durationMinutes: number}>}
 */
export const generateDaySegments = (startDate, totalMinutes, workingHours = {}, minutesPerDay = 480) => {
    const segments = [];
    let remainingMinutes = totalMinutes;
    // Create a new date from the start date, preserving local time
    let currentDate = new Date(startDate);
    let dayNumber = 1;

    while (remainingMinutes > 0) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayConfig = workingHours[dayName];

        // Skip non-working days
        if (dayConfig?.enabled === false) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        // Get working hours for this day
        const startTime = dayConfig?.start || '08:00';
        const endTime = dayConfig?.end || '17:00';

        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const availableMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        // Calculate how much work fits in this day
        const dayMinutes = Math.min(remainingMinutes, availableMinutes);

        // Calculate actual end time for this segment
        const segmentEndMinutes = startH * 60 + startM + dayMinutes;
        const segmentEndH = Math.floor(segmentEndMinutes / 60);
        const segmentEndM = segmentEndMinutes % 60;
        const segmentEndTime = `${segmentEndH.toString().padStart(2, '0')}:${segmentEndM.toString().padStart(2, '0')}`;

        segments.push({
            date: getLocalDateString(currentDate), // Use local date, not UTC
            dayNumber,
            startTime,
            startHour: startH, // Store numeric start hour for easy lookup
            endTime: segmentEndTime,
            durationMinutes: dayMinutes,
            isComplete: remainingMinutes <= availableMinutes
        });

        remainingMinutes -= dayMinutes;
        dayNumber++;
        currentDate.setDate(currentDate.getDate() + 1);

        // Safety limit
        if (dayNumber > 30) {
            console.warn('Multi-day job exceeds 30 days, truncating');
            break;
        }
    }

    return segments;
};

/**
 * Create multi-day schedule object for a job
 * @param {Date} startDate - Start date
 * @param {number} totalMinutes - Total duration
 * @param {Object} workingHours - Working hours config
 * @returns {Object} Multi-day schedule configuration
 */
export const createMultiDaySchedule = (startDate, totalMinutes, workingHours = {}) => {
    const segments = generateDaySegments(startDate, totalMinutes, workingHours);

    return {
        isMultiDay: segments.length > 1,
        totalDays: segments.length,
        totalDurationMinutes: totalMinutes,
        startDate: segments[0]?.date,
        endDate: segments[segments.length - 1]?.date,
        segments
    };
};

/**
 * Check if a date falls within a multi-day job's schedule
 * @param {Date|string} date - Date to check
 * @param {Object} multiDaySchedule - The multi-day schedule object
 * @returns {{isInSchedule: boolean, segment: Object|null, dayNumber: number|null}}
 */
export const getSegmentForDate = (date, multiDaySchedule) => {
    if (!multiDaySchedule?.segments) {
        return { isInSchedule: false, segment: null, dayNumber: null };
    }

    // Convert date to local date string (YYYY-MM-DD) without timezone shift
    let dateStr;
    if (typeof date === 'string') {
        // If it's already a string, extract just the date part
        dateStr = date.split('T')[0];
    } else {
        // For Date objects, use local date components to avoid UTC shift
        const d = new Date(date);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
    }

    const segment = multiDaySchedule.segments.find(s => s.date === dateStr);

    return {
        isInSchedule: !!segment,
        segment: segment || null,
        dayNumber: segment?.dayNumber || null
    };
};

/**
 * Get all dates that a multi-day job spans
 * @param {Object} multiDaySchedule - Multi-day schedule object
 * @returns {Array<string>} Array of date strings (YYYY-MM-DD)
 */
export const getMultiDayDates = (multiDaySchedule) => {
    if (!multiDaySchedule?.segments) return [];
    return multiDaySchedule.segments.map(s => s.date);
};

/**
 * Check for conflicts between a proposed multi-day job and existing jobs
 * @param {Array} segments - Proposed day segments
 * @param {Array} existingJobs - Existing jobs to check against
 * @param {string} techId - Optional tech ID to filter jobs
 * @returns {Array<{date: string, conflicts: Array}>}
 */
export const checkMultiDayConflicts = (segments, existingJobs, techId = null) => {
    const conflicts = [];

    for (const segment of segments) {
        const segmentDate = segment.date;
        const segmentStart = parseTimeToMinutes(segment.startTime);
        const segmentEnd = parseTimeToMinutes(segment.endTime);

        const dayConflicts = existingJobs
            .filter(job => {
                // Filter by tech if specified
                if (techId && job.assignedTechId !== techId) return false;

                // Check if job is on same date
                const jobDate = job.scheduledTime || job.scheduledDate;
                if (!jobDate) return false;

                const jobDateStr = new Date(jobDate).toISOString().split('T')[0];
                if (jobDateStr !== segmentDate) return false;

                // Check for time overlap
                const jobTime = new Date(jobDate);
                const jobStart = jobTime.getHours() * 60 + jobTime.getMinutes();
                const jobDuration = job.estimatedDuration || 120;
                const jobEnd = jobStart + jobDuration;

                return !(segmentEnd <= jobStart || segmentStart >= jobEnd);
            })
            .map(job => ({
                jobId: job.id,
                title: job.title || job.description,
                customer: job.customer?.name || job.customerName,
                time: job.scheduledTime
            }));

        if (dayConflicts.length > 0) {
            conflicts.push({
                date: segmentDate,
                dayNumber: segment.dayNumber,
                conflicts: dayConflicts
            });
        }
    }

    return conflicts;
};

/**
 * Parse time string to minutes
 */
const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Format segment for display
 * @param {Object} segment - Day segment
 * @returns {string} Formatted string like "Day 1 of 3: 8:00 AM - 5:00 PM"
 */
export const formatSegmentDisplay = (segment, totalDays) => {
    if (!segment) return '';

    const formatTime = (time) => {
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    return `Day ${segment.dayNumber} of ${totalDays}: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`;
};

/**
 * Get display label for multi-day job on calendar
 * @param {Object} job - Job with multiDaySchedule
 * @param {Date|string} currentDate - Date being displayed
 * @returns {string} Label like "Day 2/3"
 */
export const getMultiDayLabel = (job, currentDate) => {
    if (!job.multiDaySchedule?.isMultiDay) return '';

    const { segment, dayNumber } = getSegmentForDate(currentDate, job.multiDaySchedule);
    if (!segment) return '';

    return `Day ${dayNumber}/${job.multiDaySchedule.totalDays}`;
};

/**
 * Check if job spans multiple days (helper for job objects)
 * @param {Object} job - Job object
 * @returns {boolean}
 */
export const jobIsMultiDay = (job) => {
    // A job is only multi-day if it has actual segments defined
    const hasSegments = Array.isArray(job.multiDaySchedule?.segments) &&
                        job.multiDaySchedule.segments.length > 1;
    return hasSegments;
};

/**
 * Get summary text for multi-day job
 * @param {Object} multiDaySchedule - Multi-day schedule
 * @returns {string}
 */
export const getMultiDaySummary = (multiDaySchedule) => {
    if (!multiDaySchedule?.isMultiDay) return '';

    const totalHours = Math.round(multiDaySchedule.totalDurationMinutes / 60);
    const startDate = new Date(multiDaySchedule.startDate);
    const endDate = new Date(multiDaySchedule.endDate);

    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${multiDaySchedule.totalDays} days (${totalHours}hrs) • ${formatDate(startDate)} - ${formatDate(endDate)}`;
};

/**
 * Check crew member availability across all days of a multi-day job
 * @param {Array} segments - Day segments from generateDaySegments
 * @param {Array} teamMembers - Team members with workingHours
 * @param {Array} existingJobs - Existing scheduled jobs to check conflicts
 * @returns {Map<string, {available: boolean, unavailableDays: Array, conflicts: Array}>}
 */
export const checkCrewMultiDayAvailability = (segments, teamMembers, existingJobs = []) => {
    const availability = new Map();

    for (const member of teamMembers) {
        const unavailableDays = [];
        const conflicts = [];

        for (const segment of segments) {
            const segmentDate = new Date(segment.date);
            const dayName = segmentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

            // Check if member works on this day
            const dayConfig = member.workingHours?.[dayName];
            if (dayConfig?.enabled === false) {
                unavailableDays.push({
                    date: segment.date,
                    dayNumber: segment.dayNumber,
                    reason: 'day_off',
                    message: `Off on ${dayName}s`
                });
                continue;
            }

            // Check for existing job conflicts on this day
            const memberJobs = existingJobs.filter(job => {
                if (!job.assignedTechId && !job.assignedCrewIds?.includes(member.id)) return false;
                if (job.assignedTechId !== member.id && !job.assignedCrewIds?.includes(member.id)) return false;

                const jobDate = job.scheduledTime || job.scheduledDate;
                if (!jobDate) return false;

                const jobDateObj = new Date(jobDate);
                const jobDateStr = getLocalDateString(jobDateObj);
                return jobDateStr === segment.date;
            });

            if (memberJobs.length > 0) {
                // Check for actual time conflicts
                const segmentStart = parseTimeToMinutes(segment.startTime);
                const segmentEnd = parseTimeToMinutes(segment.endTime);

                for (const job of memberJobs) {
                    const jobTime = new Date(job.scheduledTime || job.scheduledDate);
                    const jobStart = jobTime.getHours() * 60 + jobTime.getMinutes();
                    const jobDuration = job.estimatedDuration || 120;
                    const jobEnd = jobStart + jobDuration;

                    // Check for overlap
                    if (!(segmentEnd <= jobStart || segmentStart >= jobEnd)) {
                        conflicts.push({
                            date: segment.date,
                            dayNumber: segment.dayNumber,
                            jobId: job.id,
                            jobTitle: job.title || job.description,
                            customer: job.customer?.name || job.customerName,
                            time: `${formatMinutesToTime(jobStart)} - ${formatMinutesToTime(jobEnd)}`
                        });
                    }
                }
            }

            // Check for PTO/time off (if member has timeOff array)
            if (member.timeOff?.length) {
                const segmentDateStr = segment.date;
                const hasTimeOff = member.timeOff.some(to => {
                    const startDate = to.startDate?.split('T')[0];
                    const endDate = to.endDate?.split('T')[0];
                    return segmentDateStr >= startDate && segmentDateStr <= endDate;
                });

                if (hasTimeOff) {
                    unavailableDays.push({
                        date: segment.date,
                        dayNumber: segment.dayNumber,
                        reason: 'time_off',
                        message: 'Scheduled time off'
                    });
                }
            }
        }

        availability.set(member.id, {
            memberId: member.id,
            memberName: member.name,
            available: unavailableDays.length === 0 && conflicts.length === 0,
            fullyAvailable: unavailableDays.length === 0 && conflicts.length === 0,
            partiallyAvailable: unavailableDays.length > 0 || conflicts.length > 0,
            unavailableDays,
            conflicts,
            availableDayCount: segments.length - unavailableDays.length - conflicts.filter(c =>
                !unavailableDays.some(u => u.date === c.date)
            ).length
        });
    }

    return availability;
};

/**
 * Format minutes to time string
 */
const formatMinutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Get crew assignment summary for a multi-day job
 * Shows which crew is available for which days
 * @param {Array} segments - Day segments
 * @param {Array} selectedCrewIds - Selected crew member IDs
 * @param {Map} availabilityMap - Result from checkCrewMultiDayAvailability
 * @param {number} requiredCrewSize - Minimum crew size needed
 * @returns {Object} Summary with warnings and per-day breakdown
 */
export const getMultiDayCrewSummary = (segments, selectedCrewIds, availabilityMap, requiredCrewSize) => {
    const dayBreakdown = [];
    const warnings = [];
    let hasShortage = false;

    for (const segment of segments) {
        const availableCrewForDay = selectedCrewIds.filter(crewId => {
            const crewAvail = availabilityMap.get(crewId);
            if (!crewAvail) return true; // Assume available if no data

            // Check if unavailable on this specific day
            const unavailOnDay = crewAvail.unavailableDays.some(u => u.date === segment.date);
            const conflictOnDay = crewAvail.conflicts.some(c => c.date === segment.date);

            return !unavailOnDay && !conflictOnDay;
        });

        const shortage = requiredCrewSize - availableCrewForDay.length;

        dayBreakdown.push({
            date: segment.date,
            dayNumber: segment.dayNumber,
            availableCrewIds: availableCrewForDay,
            availableCount: availableCrewForDay.length,
            shortage: shortage > 0 ? shortage : 0,
            meetsRequirement: availableCrewForDay.length >= requiredCrewSize
        });

        if (shortage > 0) {
            hasShortage = true;
            warnings.push({
                type: 'crew_shortage',
                dayNumber: segment.dayNumber,
                date: segment.date,
                message: `Day ${segment.dayNumber}: Only ${availableCrewForDay.length}/${requiredCrewSize} crew available`,
                shortage
            });
        }
    }

    return {
        dayBreakdown,
        warnings,
        hasShortage,
        allDaysMeetRequirement: !hasShortage,
        totalDays: segments.length,
        daysWithFullCrew: dayBreakdown.filter(d => d.meetsRequirement).length
    };
};

/**
 * Create per-day crew assignment object for flexible multi-day scheduling
 * @param {Array} segments - Day segments
 * @param {Array} defaultCrewIds - Default crew to assign to all days
 * @returns {Object} Per-day crew assignment map
 */
export const createPerDayCrewAssignment = (segments, defaultCrewIds = []) => {
    const assignment = {};

    for (const segment of segments) {
        assignment[segment.date] = {
            dayNumber: segment.dayNumber,
            crewIds: [...defaultCrewIds],
            startTime: segment.startTime,
            endTime: segment.endTime
        };
    }

    return assignment;
};

export default {
    calculateDaysNeeded,
    isMultiDayJob,
    generateDaySegments,
    createMultiDaySchedule,
    getSegmentForDate,
    getMultiDayDates,
    checkMultiDayConflicts,
    formatSegmentDisplay,
    getMultiDayLabel,
    jobIsMultiDay,
    getMultiDaySummary,
    checkCrewMultiDayAvailability,
    getMultiDayCrewSummary,
    createPerDayCrewAssignment
};
