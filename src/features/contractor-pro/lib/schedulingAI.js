// src/features/contractor-pro/lib/schedulingAI.js
// ============================================
// AI SCHEDULING SERVICE
// ============================================
// Smart job assignment and scheduling optimization
// Considers: skills, availability, capacity, location, workload balance

import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { getDistance, optimizeRoute } from './distanceMatrixService';
import {
    isMultiDayJob,
    createMultiDaySchedule,
    getSegmentForDate,
    checkMultiDayConflicts,
    jobIsMultiDay
} from './multiDayUtils';
import { formatInTimezone } from './timezoneUtils';
import { calculateLearningScore } from './schedulingIntelligence';
import { isTechAvailableOnDate, isDateBlockedByTimeOff } from './timeOffService';
import { validateCrewAvailability, extractCrewRequirements, getRouteCrewFactors } from './crewRequirementsService';
import { checkVehicleCrewCapacity, findVehiclesForCrewSize } from './vehicleService';

// ============================================
// CONSTANTS
// ============================================

const SCORING_WEIGHTS = {
    SKILL_MATCH: 50,          // Tech has required skills
    CERTIFICATION_MATCH: 30,  // Tech has relevant certs
    AVAILABILITY: 40,         // Tech is working that day
    CAPACITY: 30,             // Tech has room for more jobs
    PROXIMITY: 25,            // Job is near tech's other jobs
    WORKLOAD_BALANCE: 20,     // Prefer less-loaded techs
    PREFERRED_ZONE: 15,       // Job in tech's preferred area
    TRAVEL_DISTANCE: -2,      // Penalty per mile beyond base radius
    CREW_SHORTFALL: -100,     // Heavy penalty if job needs more techs than available
    TIME_CONFLICT: -500,      // Heavy penalty for time slot conflicts
    TRAVEL_INFEASIBLE: -300,  // Heavy penalty if travel time makes schedule impossible
};

// Average driving speeds for travel time estimation (mph)
const TRAVEL_SPEEDS = {
    LOCAL: 20,      // City driving under 5 miles
    SUBURBAN: 30,   // Mixed roads 5-15 miles
    HIGHWAY: 45,    // Longer distances with highway
};

// Minimum buffer between jobs regardless of tech settings (safety margin)
const MIN_BUFFER_MINUTES = 10;

// Job type to skill mapping
const JOB_SKILL_MAP = {
    'HVAC': ['HVAC', 'Heating', 'Cooling', 'AC'],
    'Plumbing': ['Plumbing', 'Drains', 'Water Heater'],
    'Electrical': ['Electrical', 'Wiring', 'Panel'],
    'Appliance': ['Appliance', 'Repair'],
    'General': [] // Any tech can handle
};

// ============================================
// HELPERS
// ============================================

/**
 * Maximum reasonable job duration in minutes (5 work days = 40 hours)
 * Jobs longer than this are likely data entry errors
 */
const MAX_REASONABLE_DURATION_MINUTES = 2400; // 40 hours = 5 work days

/**
 * Parse duration string to minutes
 * "2 hours" → 120, "1.5 hrs" → 90, "45 minutes" → 45
 */
export const parseDurationToMinutes = (duration) => {
    if (!duration) return 60; // Default 1 hour
    if (typeof duration === 'number') {
        // Validate reasonable range for numeric durations
        if (duration > MAX_REASONABLE_DURATION_MINUTES) {
            console.warn(`[schedulingAI] Unusually high duration: ${duration} min (${Math.round(duration / 60)}h). Max is ${MAX_REASONABLE_DURATION_MINUTES} min.`);
        }
        return duration;
    }

    const str = duration.toLowerCase();

    // Try hours first
    const hoursMatch = str.match(/([\d.]+)\s*(hours?|hrs?)/);
    if (hoursMatch) {
        return Math.round(parseFloat(hoursMatch[1]) * 60);
    }

    // Try minutes
    const minsMatch = str.match(/([\d.]+)\s*(minutes?|mins?)/);
    if (minsMatch) {
        return Math.round(parseFloat(minsMatch[1]));
    }

    // Try days (convert to 8hr workday)
    const daysMatch = str.match(/([\d.]+)\s*(days?)/);
    if (daysMatch) {
        return Math.round(parseFloat(daysMatch[1]) * 480);
    }

    // Default
    return 60;
};

/**
 * Sanitize job duration - returns a reasonable value and flags if original was unrealistic
 * @param {number} durationMinutes - Duration in minutes
 * @returns {Object} { sanitized: number, wasUnrealistic: boolean, originalMinutes: number }
 */
export const sanitizeJobDuration = (durationMinutes) => {
    const original = typeof durationMinutes === 'number' ? durationMinutes : 60;
    const wasUnrealistic = original > MAX_REASONABLE_DURATION_MINUTES;

    return {
        sanitized: wasUnrealistic ? MAX_REASONABLE_DURATION_MINUTES : original,
        wasUnrealistic,
        originalMinutes: original,
        maxAllowed: MAX_REASONABLE_DURATION_MINUTES
    };
};

/**
 * Helper to normalize time to [hours, minutes]
 * Handles "HH:MM", ISO strings, and Date objects
 */
const normalizeTime = (time, timezone) => {
    if (!time) return [0, 0];

    // Already [h, m]
    if (Array.isArray(time)) return time;

    // ISO String or Date object
    if (time instanceof Date || (typeof time === 'string' && (time.includes('T') || time.includes('Z')))) {
        if (!timezone) {
            console.warn('Checking time conflict with ISO string but no timezone provided');
        }
        // Format to HH:MM in target timezone
        try {
            const date = new Date(time);
            const timeStr = formatInTimezone(date, timezone || 'UTC', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            });
            // timeStr might be "14:00" or "2:00"
            const [h, m] = timeStr.split(':').map(Number);
            // Handle 24:00 edge case if it happens
            return [h === 24 ? 0 : h, m];
        } catch (e) {
            console.error('Error normalizing time:', e);
            return [0, 0];
        }
    }

    // "HH:MM" string
    if (typeof time === 'string' && time.includes(':')) {
        return time.split(':').map(Number);
    }

    return [0, 0];
};

/**
 * Check if a time slot is available for a tech
 * Now includes travel-aware buffer calculations between jobs
 * @param {Object} tech - Technician object
 * @param {Date} date - Target date
 * @param {string} startTime - Start time (HH:MM or ISO string)
 * @param {number} durationMinutes - Job duration in minutes
 * @param {Object[]} existingJobs - Already assigned jobs
 * @param {string} timezone - Timezone
 * @param {Object[]} timeOffEntries - Time-off entries
 * @param {Object} newJob - The new job being checked (for travel calculations)
 * @returns {boolean|{available: boolean, conflicts: Array}}
 */
const isSlotAvailable = (tech, date, startTime, durationMinutes, existingJobs, timezone, timeOffEntries = [], newJob = null) => {
    // Check for time-off first
    const techTimeOff = timeOffEntries.filter(t => t.techId === tech.id);
    const timeOffCheck = isDateBlockedByTimeOff(date, techTimeOff);
    if (timeOffCheck.blocked) return false;

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    // Check if tech works this day - default to available if not configured
    if (techHours?.enabled === false) return false;

    // Parse times
    const [startHour, startMin] = normalizeTime(startTime, timezone);
    const jobStart = startHour * 60 + startMin;
    const jobEnd = jobStart + durationMinutes;

    // Only check working hours if configured
    if (techHours?.start && techHours?.end) {
        const [workStartH, workStartM] = techHours.start.split(':').map(Number);
        const [workEndH, workEndM] = techHours.end.split(':').map(Number);
        const workStart = workStartH * 60 + workStartM;
        const workEnd = workEndH * 60 + workEndM;

        // Check if within working hours
        if (jobStart < workStart || jobEnd > workEnd) return false;
    }

    // Check for conflicts with existing jobs - now with travel-aware buffers
    const techJobs = existingJobs.filter(j =>
        j.assignedTechId === tech.id ||
        j.assignedTo === tech.id ||
        j.assignedCrew?.some(c => c.techId === tech.id)
    );

    for (const existingJob of techJobs) {
        if (!existingJob.scheduledTime) continue;

        const [exStartH, exStartM] = normalizeTime(existingJob.scheduledTime, timezone);
        const exStart = exStartH * 60 + exStartM;
        const exDuration = parseDurationToMinutes(existingJob.estimatedDuration);
        const exEnd = exStart + exDuration;

        // Calculate travel-aware buffer between these specific jobs
        // Use the new job info if provided, otherwise use a default buffer
        let bufferBefore, bufferAfter;

        if (newJob) {
            // Calculate buffer based on travel time between job locations
            bufferBefore = calculateEffectiveBuffer(existingJob, newJob, tech);
            bufferAfter = calculateEffectiveBuffer(newJob, existingJob, tech);
        } else {
            // Fallback to tech's configured buffer
            const defaultBuffer = tech.defaultBufferMinutes || 30;
            bufferBefore = defaultBuffer;
            bufferAfter = defaultBuffer;
        }

        // Check overlap with travel-aware buffers
        // New job must end + buffer BEFORE existing job starts, OR
        // New job must start AFTER existing job ends + buffer
        const noOverlap = (jobEnd + bufferAfter <= exStart) || (jobStart >= exEnd + bufferBefore);

        if (!noOverlap) {
            return false;
        }
    }

    return true;
};

/**
 * Calculate distance between two locations
 * Uses Google Distance Matrix API when available, falls back to estimates
 */
const estimateDistance = async (location1, location2) => {
    // Try to use real distance calculation
    try {
        const result = await getDistance(location1, location2);
        return result.distanceMiles || 10;
    } catch (e) {
        // Fallback to zip-code based estimation
        const zip1 = typeof location1 === 'string' ? location1.match(/\b\d{5}\b/)?.[0] : null;
        const zip2 = typeof location2 === 'string' ? location2.match(/\b\d{5}\b/)?.[0] : null;

        if (!zip1 || !zip2) return 10; // Default 10 miles

        // Simplified: If same first 3 digits, close
        if (zip1.substring(0, 3) === zip2.substring(0, 3)) return 5;
        if (zip1.substring(0, 2) === zip2.substring(0, 2)) return 15;
        return 25;
    }
};

// Synchronous fallback for when async isn't possible
const estimateDistanceSync = (zip1, zip2) => {
    if (!zip1 || !zip2) return 10;
    if (zip1.substring(0, 3) === zip2.substring(0, 3)) return 5;
    if (zip1.substring(0, 2) === zip2.substring(0, 2)) return 15;
    return 25;
};

/**
 * Estimate travel time in minutes based on distance
 * Uses realistic driving speeds for different distance ranges
 * @param {number} distanceMiles - Distance in miles
 * @returns {number} Estimated travel time in minutes
 */
const estimateTravelTimeMinutes = (distanceMiles) => {
    if (!distanceMiles || distanceMiles <= 0) return 0;

    if (distanceMiles <= 5) {
        // City driving: ~20 mph average = 3 min/mile
        return Math.ceil(distanceMiles * 3);
    } else if (distanceMiles <= 15) {
        // Suburban: ~30 mph average = 2 min/mile
        return Math.ceil(distanceMiles * 2);
    } else {
        // Highway: ~45 mph average = 1.33 min/mile
        return Math.ceil(distanceMiles * 1.33);
    }
};

/**
 * Get job address for distance calculations
 * @param {Object} job
 * @returns {string|null}
 */
const getJobAddress = (job) => {
    return job.serviceAddress?.formatted ||
           job.customer?.address ||
           job.propertyAddress ||
           job.address ||
           null;
};

/**
 * Get job ZIP code for quick distance estimation
 * @param {Object} job
 * @returns {string|null}
 */
const getJobZip = (job) => {
    const address = getJobAddress(job);
    if (!address) return null;
    return address.match(/\b\d{5}\b/)?.[0] || null;
};

/**
 * Calculate the effective buffer needed between two jobs
 * Takes into account both the tech's configured buffer AND estimated travel time
 * @param {Object} job1 - First job (ending)
 * @param {Object} job2 - Second job (starting)
 * @param {Object} tech - Technician with defaultBufferMinutes
 * @returns {number} Required buffer in minutes
 */
const calculateEffectiveBuffer = (job1, job2, tech) => {
    const configuredBuffer = tech?.defaultBufferMinutes || 30;

    // Get ZIP codes for quick distance estimate
    const zip1 = getJobZip(job1);
    const zip2 = getJobZip(job2);

    // Estimate distance and travel time
    const estimatedDistance = estimateDistanceSync(zip1, zip2);
    const estimatedTravelTime = estimateTravelTimeMinutes(estimatedDistance);

    // Effective buffer is the MAX of configured buffer and travel time + safety margin
    return Math.max(
        configuredBuffer,
        estimatedTravelTime + MIN_BUFFER_MINUTES
    );
};

/**
 * Check if two jobs have a travel feasibility conflict
 * Returns true if it's physically impossible to travel between jobs in the available time
 * @param {Object} job1 - First job (with scheduledTime and estimatedDuration)
 * @param {Object} job2 - Second job (with scheduledTime)
 * @param {Object} tech - Technician
 * @param {string} timezone - Timezone for time parsing
 * @returns {{feasible: boolean, gap: number, travelTime: number, message: string}}
 */
const checkTravelFeasibility = (job1, job2, tech, timezone) => {
    if (!job1?.scheduledTime || !job2?.scheduledTime) {
        return { feasible: true, gap: null, travelTime: null, message: 'Missing schedule times' };
    }

    // Parse job times
    const [j1StartH, j1StartM] = normalizeTime(job1.scheduledTime, timezone);
    const [j2StartH, j2StartM] = normalizeTime(job2.scheduledTime, timezone);

    const j1Start = j1StartH * 60 + j1StartM;
    const j2Start = j2StartH * 60 + j2StartM;
    const j1Duration = parseDurationToMinutes(job1.estimatedDuration);
    const j1End = j1Start + j1Duration;

    // Determine which job is first
    let firstJob, secondJob, firstEnd, secondStart;
    if (j1Start <= j2Start) {
        firstJob = job1;
        secondJob = job2;
        firstEnd = j1End;
        secondStart = j2Start;
    } else {
        firstJob = job2;
        secondJob = job1;
        const j2Duration = parseDurationToMinutes(job2.estimatedDuration);
        firstEnd = j2Start + j2Duration;
        secondStart = j1Start;
    }

    // Calculate gap between jobs
    const gap = secondStart - firstEnd;

    // Estimate travel time needed
    const zip1 = getJobZip(firstJob);
    const zip2 = getJobZip(secondJob);
    const estimatedDistance = estimateDistanceSync(zip1, zip2);
    const travelTime = estimateTravelTimeMinutes(estimatedDistance);

    // Is the gap sufficient for travel?
    const feasible = gap >= travelTime + MIN_BUFFER_MINUTES;

    return {
        feasible,
        gap,
        travelTime,
        estimatedDistance,
        message: feasible
            ? `${gap} min gap, ${travelTime} min travel needed - OK`
            : `Only ${gap} min gap but need ${travelTime}+ min travel between ${firstJob.title || 'Job 1'} and ${secondJob.title || 'Job 2'}`
    };
};

/**
 * Get required skills for a job based on category/type
 */
const getRequiredSkills = (job) => {
    const category = job.category || job.serviceType || 'General';

    for (const [key, skills] of Object.entries(JOB_SKILL_MAP)) {
        if (category.toLowerCase().includes(key.toLowerCase())) {
            return skills;
        }
    }

    return []; // No specific skills required
};

/**
 * Check if tech has required skills
 */
const techHasSkills = (tech, requiredSkills) => {
    if (!requiredSkills.length) return true; // No requirements
    if (!tech.skills?.length && !tech.specialties?.length) return true; // Tech is generalist

    const techSkills = [...(tech.skills || []), ...(tech.specialties || [])];
    return requiredSkills.some(skill =>
        techSkills.some(ts => ts.toLowerCase().includes(skill.toLowerCase()))
    );
};

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Calculate a comprehensive score for how well a tech matches a job
 * Higher score = better match
 */
export const scoreTechForJob = (tech, job, allJobsForDay, date, timeOffEntries = []) => {
    let score = 0;
    const reasons = [];
    const warnings = [];

    // 0. TIME-OFF CHECK (highest priority)
    const techTimeOff = timeOffEntries.filter(t => t.techId === tech.id);
    const timeOffCheck = isDateBlockedByTimeOff(date, techTimeOff);
    if (timeOffCheck.blocked) {
        score -= 200; // Major penalty - tech is on time-off
        warnings.push(`On ${timeOffCheck.reason}`);
        // Don't return early - allow assignment with warning for override scenarios
        // The score penalty will rank this tech lower but not completely exclude them
    }

    // 0.5. CREW REQUIREMENTS CHECK
    // If job requires multiple techs, a single tech assignment is problematic
    const crewFactors = getRouteCrewFactors(job);
    const requiredCrewSize = crewFactors.requiredCrewSize || 1;

    if (requiredCrewSize > 1) {
        // Job needs multiple techs - single tech assignment gets a warning
        warnings.push(`Job requires ${requiredCrewSize} techs`);
        score += SCORING_WEIGHTS.CREW_SHORTFALL * (requiredCrewSize - 1);

        // Add info about crew requirement
        reasons.push(`Multi-tech job (needs ${requiredCrewSize})`);
    }

    // 1. SKILL MATCHING
    const requiredSkills = getRequiredSkills(job);
    if (techHasSkills(tech, requiredSkills)) {
        score += SCORING_WEIGHTS.SKILL_MATCH;
        if (requiredSkills.length > 0) {
            reasons.push(`Has ${requiredSkills[0]} skills`);
        }
    } else {
        warnings.push(`May lack ${requiredSkills[0] || 'required'} skills`);
    }

    // 2. CERTIFICATION MATCHING
    const jobCerts = job.requiredCertifications || [];
    const techCerts = tech.certifications || [];
    if (jobCerts.length === 0 || jobCerts.some(c => techCerts.includes(c))) {
        score += SCORING_WEIGHTS.CERTIFICATION_MATCH;
    } else {
        warnings.push('Missing required certification');
    }

    // 3. AVAILABILITY CHECK - uses smart defaults (available if not configured)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    // Smart default: if no workingHours configured, assume available
    const hasWorkingHoursConfig = tech.workingHours !== undefined;
    const dayIsConfigured = techHours !== undefined;
    const isExplicitlyOff = dayIsConfigured && techHours.enabled === false;
    const isExplicitlyOn = dayIsConfigured && techHours.enabled === true;

    if (isExplicitlyOn) {
        score += SCORING_WEIGHTS.AVAILABILITY;
        reasons.push(`Works ${dayName}s`);
    } else if (isExplicitlyOff) {
        score -= 50; // Reduced penalty - can still assign with override
        warnings.push(`Normally off on ${dayName}s`);
    } else {
        // No config = assume available (user-friendly default)
        score += SCORING_WEIGHTS.AVAILABILITY * 0.8; // Slightly less than explicit
        reasons.push(`Available ${dayName}s`);
    }

    // 4. CAPACITY CHECK
    const techJobsToday = allJobsForDay.filter(j => j.assignedTechId === tech.id);
    const maxJobs = tech.maxJobsPerDay || 4;
    const currentJobCount = techJobsToday.length;

    if (currentJobCount < maxJobs) {
        const availableSlots = maxJobs - currentJobCount;
        score += SCORING_WEIGHTS.CAPACITY * (availableSlots / maxJobs);
        reasons.push(`${availableSlots} slots available`);
    } else {
        score -= 50;
        warnings.push('At max jobs for day');
    }

    // 5. HOURS CAPACITY
    const totalHoursBooked = techJobsToday.reduce((sum, j) => {
        return sum + (parseDurationToMinutes(j.estimatedDuration) / 60);
    }, 0);
    const maxHours = tech.maxHoursPerDay || 8;
    const jobHours = parseDurationToMinutes(job.estimatedDuration) / 60;

    if (totalHoursBooked + jobHours <= maxHours) {
        reasons.push(`${(maxHours - totalHoursBooked).toFixed(1)}hrs available`);
    } else {
        score -= 30;
        warnings.push('Would exceed daily hours');
    }

    // 6. WORKLOAD BALANCE
    // Prefer techs with fewer jobs to balance the load
    const balanceScore = SCORING_WEIGHTS.WORKLOAD_BALANCE * (1 - currentJobCount / maxJobs);
    score += balanceScore;

    // 7. LOCATION/PROXIMITY (uses sync distance estimation)
    const jobZip = job.customer?.address?.match(/\d{5}/)?.[0] ||
        job.serviceAddress?.match(/\d{5}/)?.[0];
    const techHomeZip = tech.homeZip;

    if (jobZip && techHomeZip) {
        const distance = estimateDistanceSync(techHomeZip, jobZip);
        const maxRadius = tech.maxTravelMiles || 30;

        if (distance <= maxRadius) {
            score += SCORING_WEIGHTS.PROXIMITY;
            if (distance <= 10) reasons.push('Close to home base');
        } else {
            score += SCORING_WEIGHTS.TRAVEL_DISTANCE * (distance - maxRadius);
            warnings.push(`${distance}mi from home base`);
        }

        // Bonus if near other jobs that day
        const otherJobZips = techJobsToday
            .map(j => j.customer?.address?.match(/\d{5}/)?.[0])
            .filter(Boolean);

        if (otherJobZips.some(z => estimateDistanceSync(z, jobZip) <= 10)) {
            score += 15;
            reasons.push('Near other jobs today');
        }
    }

    // 8. PREFERRED ZONES
    if (tech.preferredZones?.length && job.zone) {
        if (tech.preferredZones.includes(job.zone)) {
            score += SCORING_WEIGHTS.PREFERRED_ZONE;
            reasons.push('In preferred zone');
        }
    }

    // 9. TIME SLOT CONFLICT CHECK (critical - should block if job has scheduled time)
    let hasTimeConflict = false;
    let hasTravelConflict = false;

    if (job.scheduledTime) {
        const duration = parseDurationToMinutes(job.estimatedDuration);

        // Check for direct time overlap
        for (const existingJob of techJobsToday) {
            if (!existingJob.scheduledTime) continue;

            const [newStartH, newStartM] = normalizeTime(job.scheduledTime, null);
            const [exStartH, exStartM] = normalizeTime(existingJob.scheduledTime, null);

            const newStart = newStartH * 60 + newStartM;
            const newEnd = newStart + duration;
            const exStart = exStartH * 60 + exStartM;
            const exDuration = parseDurationToMinutes(existingJob.estimatedDuration);
            const exEnd = exStart + exDuration;

            // Check for direct time overlap (ignoring buffer for now)
            const overlaps = !(newEnd <= exStart || newStart >= exEnd);

            if (overlaps) {
                hasTimeConflict = true;
                score += SCORING_WEIGHTS.TIME_CONFLICT;
                warnings.push(`Time conflict with ${existingJob.title || existingJob.serviceType || 'another job'}`);
                break;
            }

            // Check travel feasibility between adjacent jobs
            const feasibility = checkTravelFeasibility(existingJob, job, tech, null);
            if (!feasibility.feasible) {
                hasTravelConflict = true;
                score += SCORING_WEIGHTS.TRAVEL_INFEASIBLE;
                warnings.push(`Insufficient travel time: ${feasibility.message}`);
            }
        }
    }

    // 10. TRAVEL PENALTY FOR DISTANT SEQUENTIAL JOBS
    // Even if times don't overlap, penalize if jobs are far apart
    if (job.scheduledTime && techJobsToday.length > 0) {
        const newJobZip = getJobZip(job);
        let worstTravelTime = 0;

        for (const existingJob of techJobsToday) {
            if (!existingJob.scheduledTime) continue;

            const existingZip = getJobZip(existingJob);
            if (!newJobZip || !existingZip) continue;

            const distance = estimateDistanceSync(newJobZip, existingZip);
            const travelTime = estimateTravelTimeMinutes(distance);

            if (travelTime > worstTravelTime) {
                worstTravelTime = travelTime;
            }
        }

        // Apply graduated penalty for long travel times
        if (worstTravelTime > 45) {
            score -= 40;
            warnings.push(`Long travel time (${worstTravelTime}+ min) between jobs`);
        } else if (worstTravelTime > 30) {
            score -= 20;
            warnings.push(`Moderate travel time (~${worstTravelTime} min) between jobs`);
        } else if (worstTravelTime > 15) {
            score -= 5; // Slight penalty for non-adjacent jobs
        }
    }

    return {
        techId: tech.id,
        techName: tech.name,
        score: Math.round(score),
        reasons,
        warnings,
        isRecommended: score >= 80 && warnings.length === 0 && !hasTimeConflict && !hasTravelConflict,
        hasWarnings: warnings.length > 0,
        hasTimeConflict,
        hasTravelConflict,
        isBlocked: hasTimeConflict // Hard block for time conflicts
    };
};

/**
 * Calculate comprehensive score with AI learning
 * Async version that includes historical performance data
 */
export const scoreTechForJobAsync = async (tech, job, allJobsForDay, date, contractorId) => {
    // Get base score
    const baseResult = scoreTechForJob(tech, job, allJobsForDay, date);

    // Add learning bonus
    try {
        const { learningBonus, insights } = await calculateLearningScore(tech, job, contractorId);

        return {
            ...baseResult,
            score: baseResult.score + learningBonus,
            learningBonus,
            insights,
            reasons: [
                ...baseResult.reasons,
                ...insights.filter(i => i.type !== 'warning').map(i => i.message)
            ],
            warnings: [
                ...baseResult.warnings,
                ...insights.filter(i => i.type === 'warning').map(i => i.message)
            ]
        };
    } catch (error) {
        console.warn('Learning score failed, using base:', error);
        return baseResult;
    }
};

/**
 * Get ranked tech suggestions for a job
 */
export const suggestAssignments = (job, techs, allJobsForDay, date) => {
    const suggestions = techs.map(tech =>
        scoreTechForJob(tech, job, allJobsForDay, date)
    );

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    return {
        job,
        suggestions,
        topPick: suggestions[0] || null,
        hasGoodMatch: suggestions.some(s => s.isRecommended)
    };
};

/**
 * Auto-assign all unassigned jobs optimally
 * Uses greedy algorithm with look-ahead
 * Properly handles multi-tech jobs by assigning multiple techs when needed
 * NOW: Includes travel feasibility and time conflict validation
 */
export const autoAssignAll = (unassignedJobs, techs, existingAssignments, date) => {
    const assignments = [];
    const jobsToAssign = [...unassignedJobs];
    const currentAssignments = [...existingAssignments];

    // Sort jobs by priority:
    // 1. Jobs with scheduled times first (need to respect specific slots)
    // 2. Multi-tech jobs (harder to staff)
    // 3. Then by duration (longer jobs first - harder to fit)
    jobsToAssign.sort((a, b) => {
        // Jobs with scheduled times have higher priority
        const aHasTime = !!(a.scheduledTime || a.scheduledDate);
        const bHasTime = !!(b.scheduledTime || b.scheduledDate);
        if (aHasTime && !bHasTime) return -1;
        if (!aHasTime && bHasTime) return 1;

        // Multi-tech jobs second priority
        const aCrewFactors = getRouteCrewFactors(a);
        const bCrewFactors = getRouteCrewFactors(b);
        const aRequired = aCrewFactors.requiredCrewSize || 1;
        const bRequired = bCrewFactors.requiredCrewSize || 1;
        if (bRequired !== aRequired) return bRequired - aRequired;

        // Then by duration (longer jobs first)
        const aDur = parseDurationToMinutes(a.estimatedDuration);
        const bDur = parseDurationToMinutes(b.estimatedDuration);
        return bDur - aDur;
    });

    for (const job of jobsToAssign) {
        // Get crew requirements for this job
        const crewFactors = getRouteCrewFactors(job);
        const requiredCrewSize = crewFactors.requiredCrewSize || 1;

        // Score all available techs for this job
        const techScores = techs.map(tech => {
            const result = scoreTechForJob(tech, job, currentAssignments, date);
            return {
                techId: tech.id,
                techName: tech.name,
                tech,
                score: result.score,
                reasons: result.reasons,
                warnings: result.warnings,
                isBlocked: result.isBlocked,
                hasTimeConflict: result.hasTimeConflict,
                hasTravelConflict: result.hasTravelConflict
            };
        })
        // CRITICAL FIX: Filter out techs with time conflicts or blocked status
        .filter(t => !t.isBlocked && !t.hasTimeConflict)
        // Also filter out extremely low scores (e.g., on time-off)
        .filter(t => t.score > -100)
        .sort((a, b) => b.score - a.score);

        // If all techs have conflicts, mark as failed with specific reason
        if (techScores.length === 0) {
            // Check why no techs are available
            const allTechResults = techs.map(tech => scoreTechForJob(tech, job, currentAssignments, date));
            const timeConflictCount = allTechResults.filter(r => r.hasTimeConflict).length;
            const travelConflictCount = allTechResults.filter(r => r.hasTravelConflict).length;

            let failReason = 'No suitable tech available';
            if (timeConflictCount === techs.length) {
                failReason = 'All techs have scheduling conflicts at this time';
            } else if (travelConflictCount > 0) {
                failReason = `All techs have travel/time conflicts (${timeConflictCount} time, ${travelConflictCount} travel)`;
            }

            assignments.push({
                jobId: job.id,
                job,
                techIds: [],
                techNames: [],
                score: 0,
                reasons: [],
                warnings: [failReason],
                failed: true,
                requiredCrewSize,
                failReason
            });
            continue;
        }

        // For multi-tech jobs, pick multiple techs (only non-blocked ones)
        const assignedTechs = techScores.slice(0, Math.min(requiredCrewSize, techScores.length));
        const assignedCount = assignedTechs.length;

        // Build warnings from all assigned techs
        const warnings = [];
        assignedTechs.forEach(t => {
            if (t.warnings) {
                t.warnings.forEach(w => {
                    if (!warnings.includes(w)) warnings.push(w);
                });
            }
        });

        if (assignedCount < requiredCrewSize) {
            warnings.push(`Needs ${requiredCrewSize} techs, only ${assignedCount} available without conflicts`);
        }

        // Check for any travel conflicts in the assigned group (even if not blocking)
        const hasTravelWarnings = assignedTechs.some(t => t.hasTravelConflict);

        assignments.push({
            jobId: job.id,
            job,
            // For backward compatibility, keep techId/techName for first tech
            techId: assignedTechs[0]?.techId,
            techName: assignedTechs[0]?.techName,
            // New: array of all assigned techs for multi-tech jobs
            techIds: assignedTechs.map(t => t.techId),
            techNames: assignedTechs.map(t => t.techName),
            techs: assignedTechs.map(t => t.tech),
            score: assignedTechs[0]?.score || 0,
            reasons: assignedTechs[0]?.reasons || [],
            warnings,
            requiredCrewSize,
            assignedCrewSize: assignedCount,
            isFullyStaffed: assignedCount >= requiredCrewSize,
            hasTravelWarnings
        });

        // Add to current assignments for next iteration - mark job as assigned to all techs
        // This is critical for subsequent jobs to see the updated schedule
        assignedTechs.forEach(t => {
            currentAssignments.push({
                ...job,
                assignedTechId: t.techId,
                assignedTo: t.techId, // Also set legacy field
                assignedCrew: [{ techId: t.techId, techName: t.techName }]
            });
        });
    }

    return {
        assignments,
        successful: assignments.filter(a => !a.failed),
        failed: assignments.filter(a => a.failed),
        summary: {
            total: assignments.length,
            assigned: assignments.filter(a => !a.failed).length,
            unassigned: assignments.filter(a => a.failed).length,
            fullyStaffed: assignments.filter(a => a.isFullyStaffed).length,
            understaffed: assignments.filter(a => !a.failed && !a.isFullyStaffed).length,
            withTravelWarnings: assignments.filter(a => a.hasTravelWarnings).length
        }
    };
};

// ============================================
// ASSIGNMENT ACTIONS
// ============================================

/**
 * Assign a job to a tech
 */
export const assignJobToTech = async (jobId, techId, techName, assignedBy = 'manual') => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        await updateDoc(jobRef, {
            assignedTechId: techId,
            assignedTechName: techName,
            assignedAt: serverTimestamp(),
            assignedBy,
            lastActivity: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error assigning job:', error);
        throw error;
    }
};

/**
 * Unassign a job from a tech
 */
export const unassignJob = async (jobId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        await updateDoc(jobRef, {
            assignedTechId: null,
            assignedTechName: null,
            assignedAt: null,
            assignedBy: null,
            lastActivity: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error unassigning job:', error);
        throw error;
    }
};

/**
 * Bulk assign jobs (from auto-assign)
 */
export const bulkAssignJobs = async (assignments) => {
    const results = [];

    for (const assignment of assignments) {
        if (assignment.failed) continue;

        try {
            await assignJobToTech(
                assignment.jobId,
                assignment.techId,
                assignment.techName,
                'ai'
            );
            results.push({ ...assignment, success: true });
        } catch (error) {
            results.push({ ...assignment, success: false, error: error.message });
        }
    }

    return results;
};

// ============================================
// CONFLICT DETECTION
// ============================================

/**
 * Check if a tech is available on a given day
 * Defaults to AVAILABLE if no workingHours configured (user-friendly default)
 */
export const isTechWorkingOnDay = (tech, date) => {
    // Defensive: validate date before operations
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return { working: true, reason: 'default', dayName: '' };
    }

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    // If no workingHours configured at all, default to available (user-friendly)
    if (!tech.workingHours) {
        return { working: true, reason: 'default', dayName };
    }

    // If this specific day isn't configured, default to available
    if (techHours === undefined) {
        return { working: true, reason: 'default', dayName };
    }

    // Explicitly check enabled status
    return {
        working: techHours.enabled !== false,
        reason: techHours.enabled === false ? 'scheduled_off' : 'scheduled_on',
        dayName,
        hours: techHours
    };
};

/**
 * Check for scheduling conflicts
 */
export const checkConflicts = (tech, job, existingJobs, date, timezone) => {
    const conflicts = [];

    // 1. Day availability - now uses smarter default logic
    const availability = isTechWorkingOnDay(tech, date);

    if (!availability.working) {
        conflicts.push({
            type: 'day_off',
            severity: 'error',
            message: `${tech.name} is scheduled off on ${availability.dayName}s`,
            canOverride: true // Contractor can still override via confirmation modal
        });
    }

    // 2. Job count capacity
    const techJobsToday = existingJobs.filter(j => j.assignedTechId === tech.id);
    const maxJobs = tech.maxJobsPerDay || 4;

    if (techJobsToday.length >= maxJobs) {
        conflicts.push({
            type: 'max_jobs',
            severity: 'error',
            message: `${tech.name} already has ${maxJobs} jobs scheduled`
        });
    }

    // 3. Hours capacity
    const totalHours = techJobsToday.reduce((sum, j) => {
        return sum + (parseDurationToMinutes(j.estimatedDuration) / 60);
    }, 0);
    const jobHours = parseDurationToMinutes(job.estimatedDuration) / 60;
    const maxHours = tech.maxHoursPerDay || 8;

    if (totalHours + jobHours > maxHours) {
        conflicts.push({
            type: 'max_hours',
            severity: 'warning',
            message: `Would exceed ${maxHours}hr daily limit (${(totalHours + jobHours).toFixed(1)}hrs total)`
        });
    }

    // 4. Skill mismatch
    const requiredSkills = getRequiredSkills(job);
    if (!techHasSkills(tech, requiredSkills)) {
        conflicts.push({
            type: 'skills',
            severity: 'warning',
            message: `${tech.name} may not have ${requiredSkills[0] || 'required'} skills`
        });
    }

    // 5. Time slot conflict
    if (job.scheduledTime) {
        const duration = parseDurationToMinutes(job.estimatedDuration);
        const available = isSlotAvailable(tech, date, job.scheduledTime, duration, existingJobs, timezone);

        if (!available) {
            conflicts.push({
                type: 'time_conflict',
                severity: 'error',
                message: 'Time slot conflicts with existing job'
            });
        }
    }

    return {
        hasConflicts: conflicts.length > 0,
        hasErrors: conflicts.some(c => c.severity === 'error'),
        hasWarnings: conflicts.some(c => c.severity === 'warning'),
        conflicts
    };
};

// ============================================
// SCHEDULE OPTIMIZATION
// ============================================

/**
 * Suggest optimal time for a job based on tech's schedule
 */
export const suggestTimeSlot = (tech, job, existingJobs, date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    if (!techHours?.enabled) return null;

    const [startH, startM] = techHours.start.split(':').map(Number);
    const [endH, endM] = techHours.end.split(':').map(Number);
    const workStart = startH * 60 + startM;
    const workEnd = endH * 60 + endM;

    const duration = parseDurationToMinutes(job.estimatedDuration);
    const buffer = tech.defaultBufferMinutes || 30;

    // Get all booked slots
    const techJobs = existingJobs
        .filter(j => j.assignedTechId === tech.id && j.scheduledTime)
        .map(j => {
            const [h, m] = j.scheduledTime.split(':').map(Number);
            const start = h * 60 + m;
            const dur = parseDurationToMinutes(j.estimatedDuration);
            return { start, end: start + dur + buffer };
        })
        .sort((a, b) => a.start - b.start);

    // Find first available slot
    let searchStart = workStart;

    for (const slot of techJobs) {
        if (searchStart + duration + buffer <= slot.start) {
            // Found a gap!
            const hours = Math.floor(searchStart / 60);
            const mins = searchStart % 60;
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        }
        searchStart = Math.max(searchStart, slot.end);
    }

    // Check if fits at the end
    if (searchStart + duration <= workEnd) {
        const hours = Math.floor(searchStart / 60);
        const mins = searchStart % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    return null; // No slot available
};

/**
 * Find the next available time slot for a technician, starting from a given date/time.
 * Iterates in 30-minute blocks through the tech's working hours across multiple days.
 * @param {object} tech - Tech object with workingHours
 * @param {number} durationMinutes - Required job duration in minutes
 * @param {array} existingJobs - All existing jobs to check against
 * @param {Date} startDate - Date to start searching from
 * @param {string} timezone - IANA timezone identifier
 * @param {number} maxDaysToSearch - Max days to look ahead (default 7)
 * @returns {object|null} { date: Date, startTime: string "HH:MM", endTime: string "HH:MM" } or null
 */
export const findNextAvailableSlot = (tech, durationMinutes, existingJobs, startDate, timezone, maxDaysToSearch = 7) => {
    if (!tech || !durationMinutes) return null;

    const duration = typeof durationMinutes === 'number' ? durationMinutes : parseDurationToMinutes(durationMinutes);
    const buffer = tech.defaultBufferMinutes || 30;

    for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
        const searchDate = new Date(startDate);
        searchDate.setDate(searchDate.getDate() + dayOffset);

        // Check if tech works this day
        const dayName = searchDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const techHours = tech.workingHours?.[dayName];

        if (techHours?.enabled === false) continue;
        if (!techHours?.start || !techHours?.end) continue;

        const [workStartH, workStartM] = techHours.start.split(':').map(Number);
        const [workEndH, workEndM] = techHours.end.split(':').map(Number);
        const workStart = workStartH * 60 + workStartM;
        const workEnd = workEndH * 60 + workEndM;

        // Get booked slots for this tech on this date
        const techJobsOnDay = existingJobs.filter(j => {
            if (j.assignedTechId !== tech.id && !j.assignedCrewIds?.includes(tech.id)) return false;
            if (j.status === 'cancelled' || j.status === 'completed') return false;

            // Determine if this job is on the search date
            const jobDate = j.scheduledTime
                ? new Date(typeof j.scheduledTime === 'string' ? j.scheduledTime : (j.scheduledTime.toDate ? j.scheduledTime.toDate() : j.scheduledTime))
                : j.scheduledDate
                    ? new Date(typeof j.scheduledDate === 'string' ? j.scheduledDate : (j.scheduledDate.toDate ? j.scheduledDate.toDate() : j.scheduledDate))
                    : null;

            if (!jobDate || isNaN(jobDate.getTime())) return false;
            return jobDate.toDateString() === searchDate.toDateString();
        });

        // Build occupied slots in minutes-from-midnight
        const occupiedSlots = techJobsOnDay.map(j => {
            const [h, m] = normalizeTime(j.scheduledTime || j.scheduledDate, timezone);
            const start = h * 60 + m;
            const dur = parseDurationToMinutes(j.estimatedDuration);
            return { start, end: start + dur + buffer };
        }).sort((a, b) => a.start - b.start);

        // Search 30-min blocks from work start
        let searchStart = workStart;

        // If searching today, skip past current time
        if (dayOffset === 0) {
            const now = new Date();
            const nowInTz = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone || 'UTC',
                hour: 'numeric', minute: 'numeric', hour12: false
            }).format(now);
            const [nowH, nowM] = nowInTz.split(':').map(Number);
            const nowMinutes = (nowH === 24 ? 0 : nowH) * 60 + nowM;
            // Round up to next 30-min block
            const roundedNow = Math.ceil(nowMinutes / 30) * 30;
            searchStart = Math.max(searchStart, roundedNow);
        }

        while (searchStart + duration <= workEnd) {
            const slotEnd = searchStart + duration;
            // Check if this slot overlaps with any occupied slot
            const hasConflict = occupiedSlots.some(occ =>
                !(slotEnd + buffer <= occ.start || searchStart >= occ.end)
            );

            if (!hasConflict) {
                const startH = Math.floor(searchStart / 60);
                const startMin = searchStart % 60;
                const endH = Math.floor(slotEnd / 60);
                const endMin = slotEnd % 60;
                return {
                    date: searchDate,
                    startTime: `${String(startH).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
                    endTime: `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
                    dayName
                };
            }

            searchStart += 30; // Move to next 30-min block
        }
    }

    return null; // No available slot found within search window
};

/**
 * Check if a tech is busy (has a conflicting job) at a specific date/time
 * Used for TechSelector busy indicators
 * @param {object} tech - Tech object
 * @param {Date|string} date - Target date
 * @param {string} timeStr - Time string ("HH:MM" or ISO)
 * @param {number} durationMinutes - Job duration
 * @param {array} existingJobs - All jobs
 * @param {string} timezone - IANA timezone
 * @returns {object} { busy: boolean, reason: string }
 */
export const isTechBusyAtTime = (tech, date, timeStr, durationMinutes, existingJobs, timezone) => {
    if (!tech || !date) return { busy: false, reason: '' };

    const targetDate = typeof date === 'string' ? new Date(date) : date;

    // Check day off
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];
    if (techHours?.enabled === false) {
        return { busy: true, reason: 'Day off' };
    }

    // If no time specified, just check day-off
    if (!timeStr) return { busy: false, reason: '' };

    // Check slot availability
    const available = isSlotAvailable(tech, targetDate, timeStr, durationMinutes || 60, existingJobs, timezone);
    if (!available) {
        return { busy: true, reason: 'Time conflict' };
    }

    return { busy: false, reason: '' };
};

// ============================================
// TIME SLOT SUGGESTION FUNCTIONS
// (For AISuggestionPanel - scheduling time slots, not tech assignment)
// ============================================

/**
 * Get working hours for a specific day
 */
const getWorkingHoursForDay = (preferences, date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = preferences?.workingHours?.[dayName];

    if (!dayHours?.enabled) return null;

    return {
        start: dayHours.start || '08:00',
        end: dayHours.end || '17:00'
    };
};

/**
 * Get jobs for a specific date
 * Includes:
 * - Confirmed scheduled jobs (scheduledTime/scheduledDate)
 * - Jobs with PENDING offered time slots on that date (to avoid double-booking)
 */
const getJobsForDate = (allJobs, date) => {
    const dateStr = date.toDateString();
    const results = [];

    for (const job of allJobs) {
        // Check confirmed scheduled jobs
        if (job.scheduledTime || job.scheduledDate) {
            const jobDate = job.scheduledTime
                ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
                : new Date(job.scheduledDate.toDate ? job.scheduledDate.toDate() : job.scheduledDate);
            if (jobDate.toDateString() === dateStr) {
                results.push(job);
                continue;
            }
        }

        // Check pending offered slots - these block availability until customer responds
        // This prevents suggesting the same time for multiple jobs
        const offeredSlots = job.scheduling?.offeredSlots || [];
        const pendingSlotOnDate = offeredSlots.find(slot => {
            if (slot.status !== 'offered') return false;
            const slotDate = slot.start?.toDate ? slot.start.toDate() : new Date(slot.start);
            return slotDate.toDateString() === dateStr;
        });

        if (pendingSlotOnDate) {
            // Create a "virtual" scheduled job entry for this pending slot
            // so the AI considers it as a busy slot
            const slotStart = pendingSlotOnDate.start?.toDate
                ? pendingSlotOnDate.start.toDate()
                : new Date(pendingSlotOnDate.start);
            results.push({
                ...job,
                scheduledTime: slotStart,
                _isPendingOffer: true  // Flag to identify these if needed
            });
        }
    }

    return results;
};

/**
 * Convert minutes to time string
 */
const minutesToTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Format time for display
 */
const formatTimeDisplay = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Calculate workload for a day
 */
const calculateDayWorkload = (allJobs, date, preferences) => {
    const dayJobs = getJobsForDate(allJobs, date);
    const maxJobs = preferences?.maxJobsPerDay || 8;

    let totalMinutes = 0;
    dayJobs.forEach(job => {
        const duration = job.estimatedDuration || preferences?.defaultJobDuration || 120;
        totalMinutes += typeof duration === 'number' ? duration : parseDurationToMinutes(duration);
    });

    return {
        jobCount: dayJobs.length,
        totalMinutes,
        percentFull: Math.round((dayJobs.length / maxJobs) * 100),
        isFull: dayJobs.length >= maxJobs,
        isLight: dayJobs.length <= 1,
        isModerate: dayJobs.length > 1 && dayJobs.length < maxJobs - 1
    };
};

/**
 * Generate scheduling suggestions for a job (time slot suggestions)
 * NOW ENHANCED with:
 * - Travel time validation between jobs
 * - Crew/tech availability checking
 * - Resource capacity validation
 *
 * @param {Object} targetJob - The job to schedule
 * @param {Array} allJobs - All jobs (scheduled and unscheduled)
 * @param {Object} preferences - Contractor's scheduling preferences
 * @param {Object} customerPrefs - Customer's scheduling preferences (if any)
 * @param {number} daysToAnalyze - How many days ahead to look
 * @param {Object} options - Additional options for enhanced validation
 * @param {Array} options.teamMembers - Team members for availability checking
 * @param {Array} options.vehicles - Vehicles for capacity checking
 * @param {Array} options.timeOffEntries - Time-off entries for techs
 * @returns {Object} Suggestions and analysis
 */
export const generateSchedulingSuggestions = (
    targetJob,
    allJobs,
    preferences = {},
    customerPrefs = null,
    daysToAnalyze = 14,
    options = {}
) => {
    const { teamMembers = [], vehicles = [], timeOffEntries = [] } = options;
    const suggestions = [];
    const warnings = [];
    const insights = [];

    const jobDuration = targetJob?.estimatedDuration ||
        preferences?.defaultJobDuration ||
        120; // 2 hours default

    let durationMins = typeof jobDuration === 'number' ?
        jobDuration : parseDurationToMinutes(jobDuration);

    // Cap duration at one workday for slot-finding (multi-day jobs just need a start date)
    const maxSlotDuration = 480; // 8 hours
    const isMultiDayDuration = durationMins > maxSlotDuration;
    const originalDurationMins = durationMins; // Save before capping for the warning message
    const estimatedDays = Math.ceil(originalDurationMins / maxSlotDuration);

    if (isMultiDayDuration) {
        durationMins = maxSlotDuration; // Find slots that fit one workday
        warnings.push({
            type: 'multi_day',
            message: `This is a multi-day job (~${estimatedDays} days). Suggestions show potential start dates.`,
            estimatedDays,
            totalMinutes: originalDurationMins
        });
    }

    // Get crew requirements for this job
    const crewFactors = getRouteCrewFactors(targetJob);
    const requiredCrewSize = crewFactors.requiredCrewSize || 1;

    if (requiredCrewSize > 1) {
        warnings.push({
            type: 'crew_required',
            message: `This job requires ${requiredCrewSize} technicians.`,
            requiredCrewSize
        });
    }

    // Get target job location for travel calculations
    const targetJobZip = getJobZip(targetJob);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fullDays = [];
    const lightDays = [];
    const noCrewDays = [];

    // Analyze each day
    for (let i = 1; i <= daysToAnalyze; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);

        // Skip if day is off
        const workingHours = getWorkingHoursForDay(preferences, date);
        if (!workingHours) continue;

        // Get workload
        const workload = calculateDayWorkload(allJobs, date, preferences);

        if (workload.isFull) {
            fullDays.push(date);
            continue;
        }

        if (workload.isLight) {
            lightDays.push(date);
        }

        // ENHANCED: Check crew availability for this day
        let availableTechsForDay = [];
        if (teamMembers.length > 0) {
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            availableTechsForDay = teamMembers.filter(tech => {
                // Check if tech works this day
                const techHours = tech.workingHours?.[dayName];
                const isOff = techHours?.enabled === false;
                if (isOff) return false;

                // Check time-off entries
                const isOnTimeOff = timeOffEntries.some(entry => {
                    if (entry.techId !== tech.id) return false;
                    const entryStart = entry.startDate?.toDate ? entry.startDate.toDate() : new Date(entry.startDate);
                    const entryEnd = entry.endDate?.toDate ? entry.endDate.toDate() : new Date(entry.endDate);
                    return date >= entryStart && date <= entryEnd;
                });
                if (isOnTimeOff) return false;

                return true;
            });

            // If we need crew but don't have enough techs available, skip this day
            if (availableTechsForDay.length < requiredCrewSize) {
                noCrewDays.push(date);
                continue;
            }
        }

        // Parse working hours
        const [startH, startM] = workingHours.start.split(':').map(Number);
        const [endH, endM] = workingHours.end.split(':').map(Number);
        const dayStart = startH * 60 + startM;
        const dayEnd = endH * 60 + endM;

        // Get existing jobs for this day WITH their locations for travel calc
        const dayJobs = getJobsForDate(allJobs, date);

        // Build busy slots with travel-aware buffers
        const busySlots = dayJobs.map(job => {
            const jobTime = job.scheduledTime
                ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
                : null;
            if (!jobTime) return null;

            const jobDur = job.estimatedDuration || preferences?.defaultJobDuration || 120;
            const durMins = typeof jobDur === 'number' ? jobDur : parseDurationToMinutes(jobDur);

            // ENHANCED: Calculate travel-aware buffer
            const existingJobZip = getJobZip(job);
            let buffer = preferences?.bufferMinutes || 30;

            if (targetJobZip && existingJobZip) {
                const distance = estimateDistanceSync(targetJobZip, existingJobZip);
                const travelTime = estimateTravelTimeMinutes(distance);
                // Buffer should account for travel time + safety margin
                buffer = Math.max(buffer, travelTime + MIN_BUFFER_MINUTES);
            }

            const start = jobTime.getHours() * 60 + jobTime.getMinutes();
            return {
                start,
                end: start + durMins + buffer,
                job,  // Keep reference for travel calculations
                zip: existingJobZip
            };
        }).filter(Boolean).sort((a, b) => a.start - b.start);

        // Find gaps with enhanced validation
        let searchStart = dayStart;

        for (let slotIdx = 0; slotIdx <= busySlots.length; slotIdx++) {
            const currentSlot = busySlots[slotIdx];
            const prevSlot = busySlots[slotIdx - 1];

            // Determine the end of the search window
            const windowEnd = currentSlot ? currentSlot.start : dayEnd;

            // Check if there's a gap that fits our job
            if (searchStart + durationMins + (preferences?.bufferMinutes || 30) <= windowEnd) {
                // ENHANCED: Validate travel feasibility
                let travelWarning = null;
                let travelPenalty = 0;

                if (targetJobZip) {
                    // Check travel from previous job (if any)
                    if (prevSlot?.zip) {
                        const distFromPrev = estimateDistanceSync(prevSlot.zip, targetJobZip);
                        const travelFromPrev = estimateTravelTimeMinutes(distFromPrev);
                        const gapFromPrev = searchStart - prevSlot.end + (preferences?.bufferMinutes || 30);

                        if (travelFromPrev > gapFromPrev) {
                            travelWarning = `${travelFromPrev} min travel from previous job`;
                            travelPenalty += 15;
                        }
                    }

                    // Check travel to next job (if any)
                    if (currentSlot?.zip) {
                        const distToNext = estimateDistanceSync(targetJobZip, currentSlot.zip);
                        const travelToNext = estimateTravelTimeMinutes(distToNext);
                        const proposedEnd = searchStart + durationMins;
                        const gapToNext = currentSlot.start - proposedEnd;

                        if (travelToNext > gapToNext) {
                            travelWarning = travelWarning
                                ? `Tight travel both ways`
                                : `${travelToNext} min travel to next job`;
                            travelPenalty += 15;
                        }
                    }
                }

                // ENHANCED: Check tech capacity at this specific time
                let capacityWarning = null;
                let capacityPenalty = 0;

                if (teamMembers.length > 0 && availableTechsForDay.length > 0) {
                    // Count how many techs are free at this specific time
                    const techsWithConflicts = availableTechsForDay.filter(tech => {
                        const techJobs = dayJobs.filter(j =>
                            j.assignedTechId === tech.id ||
                            j.assignedCrew?.some(c => c.techId === tech.id)
                        );
                        // Check if any of tech's jobs overlap with proposed slot
                        return techJobs.some(tj => {
                            const tjTime = tj.scheduledTime?.toDate ? tj.scheduledTime.toDate() : new Date(tj.scheduledTime);
                            const tjStart = tjTime.getHours() * 60 + tjTime.getMinutes();
                            const tjDur = parseDurationToMinutes(tj.estimatedDuration || 120);
                            const tjEnd = tjStart + tjDur;
                            const proposedEnd = searchStart + durationMins;
                            // Overlap check
                            return !(proposedEnd <= tjStart || searchStart >= tjEnd);
                        });
                    });

                    const freeTechs = availableTechsForDay.length - techsWithConflicts.length;

                    if (freeTechs < requiredCrewSize) {
                        capacityWarning = `Only ${freeTechs} of ${requiredCrewSize} techs free`;
                        capacityPenalty = 30; // Significant penalty
                    } else if (freeTechs === requiredCrewSize) {
                        // Exactly enough - slight warning
                        capacityWarning = `Exactly ${freeTechs} techs available`;
                        capacityPenalty = 5;
                    }
                }

                // Calculate enhanced score
                const baseScore = calculateSlotScore(date, searchStart, workload, customerPrefs, preferences);
                const adjustedScore = Math.max(0, baseScore - travelPenalty - capacityPenalty);

                // Build reasons array
                const reasons = getSlotReasons(date, searchStart, workload, customerPrefs);
                if (travelWarning) reasons.push(travelWarning);
                if (capacityWarning) reasons.push(capacityWarning);

                // Only add slot if it's still viable (score > 30)
                if (adjustedScore > 30 || (capacityPenalty === 0 && travelPenalty === 0)) {
                    suggestions.push({
                        date,
                        startTime: minutesToTime(searchStart),
                        endTime: minutesToTime(searchStart + durationMins),
                        dateFormatted: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                        timeFormatted: `${formatTimeDisplay(minutesToTime(searchStart))} - ${formatTimeDisplay(minutesToTime(searchStart + durationMins))}`,
                        score: adjustedScore,
                        isRecommended: adjustedScore >= 80,
                        reasons,
                        workload,
                        // ENHANCED: Include validation metadata
                        validation: {
                            travelFeasible: travelPenalty === 0,
                            crewAvailable: capacityPenalty === 0,
                            availableTechs: teamMembers.length > 0 ? availableTechsForDay.length : null,
                            requiredCrew: requiredCrewSize
                        }
                    });
                }
            }

            // Move search start past current slot
            if (currentSlot) {
                searchStart = Math.max(searchStart, currentSlot.end);
            }
        }
    }

    // Sort by score
    suggestions.sort((a, b) => b.score - a.score);

    // Add insights
    if (fullDays.length > 0) {
        insights.push({
            type: 'busy',
            message: `${fullDays.length} day${fullDays.length > 1 ? 's' : ''} are fully booked`,
            days: fullDays
        });
    }

    if (lightDays.length > 0) {
        insights.push({
            type: 'opportunity',
            message: `${lightDays.length} light day${lightDays.length > 1 ? 's' : ''} available`,
            days: lightDays
        });
    }

    // ENHANCED: Add crew availability insight
    if (noCrewDays.length > 0 && teamMembers.length > 0) {
        insights.push({
            type: 'crew_shortage',
            message: `${noCrewDays.length} day${noCrewDays.length > 1 ? 's' : ''} lack sufficient crew (need ${requiredCrewSize})`,
            days: noCrewDays
        });
    }

    return {
        suggestions: suggestions.slice(0, 10),
        recommended: suggestions[0] || null,
        warnings,
        insights,
        meta: {
            analyzedDays: daysToAnalyze,
            totalSlotsFound: suggestions.length,
            jobDuration: durationMins,
            hasCustomerPreferences: !!customerPrefs,
            // ENHANCED: Include validation summary
            hasTeamData: teamMembers.length > 0,
            requiredCrewSize,
            teamSize: teamMembers.length
        }
    };
};

/**
 * Calculate score for a time slot
 */
const calculateSlotScore = (date, startMinutes, workload, customerPrefs, preferences) => {
    let score = 50; // Base score

    // Light day bonus
    if (workload.isLight) score += 20;
    if (workload.isModerate) score += 10;

    // Morning preference (default)
    if (startMinutes < 12 * 60) score += 10;

    // Customer preference matching
    if (customerPrefs?.preferredDays) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (customerPrefs.preferredDays.includes(dayName)) score += 15;
    }

    if (customerPrefs?.preferredTime) {
        if (customerPrefs.preferredTime === 'morning' && startMinutes < 12 * 60) score += 15;
        if (customerPrefs.preferredTime === 'afternoon' && startMinutes >= 12 * 60 && startMinutes < 17 * 60) score += 15;
        if (customerPrefs.preferredTime === 'evening' && startMinutes >= 17 * 60) score += 15;
    }

    // Sooner is better (within reason)
    const today = new Date();
    const daysAway = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (daysAway <= 3) score += 15;
    else if (daysAway <= 7) score += 10;

    return Math.min(100, score);
};

/**
 * Get reasons for slot recommendation
 */
const getSlotReasons = (date, startMinutes, workload, customerPrefs) => {
    const reasons = [];

    if (workload.isLight) reasons.push('Light schedule day');
    if (workload.isModerate) reasons.push('Good availability');

    const today = new Date();
    const daysAway = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (daysAway <= 3) reasons.push('Available soon');

    if (startMinutes < 12 * 60) reasons.push('Morning slot');
    else if (startMinutes < 17 * 60) reasons.push('Afternoon slot');
    else reasons.push('Evening slot');

    if (customerPrefs?.preferredDays) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (customerPrefs.preferredDays.includes(dayName)) {
            reasons.push('Customer preferred day');
        }
    }

    return reasons;
};

/**
 * Quick suggest - returns just the top 3 recommendations
 */
export const getQuickSuggestions = (targetJob, allJobs, preferences, customerPrefs) => {
    const result = generateSchedulingSuggestions(targetJob, allJobs, preferences, customerPrefs, 7);
    return result.suggestions.slice(0, 3);
};

/**
 * Check for conflicts with a proposed time (for OfferTimeSlotsModal)
 */
export const checkForConflicts = (proposedStart, proposedEnd, allJobs, preferences) => {
    if (!proposedStart) return [];

    const proposedDate = new Date(proposedStart);
    const dayJobs = getJobsForDate(allJobs, proposedDate);
    const buffer = preferences?.bufferMinutes || 30;

    const proposedStartMinutes = proposedDate.getHours() * 60 + proposedDate.getMinutes();
    const proposedEndDate = proposedEnd ? new Date(proposedEnd) : new Date(proposedStart.getTime() + 2 * 60 * 60 * 1000);
    const proposedEndMinutes = proposedEndDate.getHours() * 60 + proposedEndDate.getMinutes();

    const conflicts = [];

    for (const job of dayJobs) {
        const jobTime = job.scheduledTime
            ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
            : null;
        if (!jobTime) continue;

        const jobStartMinutes = jobTime.getHours() * 60 + jobTime.getMinutes();
        const jobDuration = job.estimatedDuration || preferences?.defaultJobDuration || 120;
        const durMins = typeof jobDuration === 'number' ? jobDuration : parseDurationToMinutes(jobDuration);
        const jobEndMinutes = jobStartMinutes + durMins;

        // Check for overlap (including buffer)
        const overlapStart = Math.max(proposedStartMinutes, jobStartMinutes - buffer);
        const overlapEnd = Math.min(proposedEndMinutes + buffer, jobEndMinutes + buffer);

        if (overlapStart < overlapEnd) {
            conflicts.push({
                job,
                overlapMinutes: overlapEnd - overlapStart,
                message: `Conflicts with "${job.title || job.serviceType || 'Job'}" at ${formatTimeDisplay(minutesToTime(jobStartMinutes))}`
            });
        }
    }

    return conflicts;
};

/**
 * Suggest optimal route order for a day's jobs (synchronous fallback)
 * Uses simple Euclidean distance - fast but less accurate
 */
export const suggestRouteOrder = (jobs, homeBase) => {
    if (jobs.length <= 1) return jobs;

    // Simple nearest-neighbor algorithm with Euclidean distance
    const orderedJobs = [];
    const remaining = [...jobs];

    let currentLocation = homeBase?.coordinates || null;

    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const jobCoords = remaining[i].serviceAddress?.coordinates;
            if (!jobCoords || !currentLocation) {
                nearestIndex = 0;
                break;
            }

            const distance = Math.sqrt(
                Math.pow(currentLocation.lat - jobCoords.lat, 2) +
                Math.pow(currentLocation.lng - jobCoords.lng, 2)
            );

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        const nextJob = remaining.splice(nearestIndex, 1)[0];
        orderedJobs.push(nextJob);
        currentLocation = nextJob.serviceAddress?.coordinates || currentLocation;
    }

    return orderedJobs;
};

/**
 * Suggest optimal route order using Google Distance Matrix API
 * More accurate but async - uses real driving times
 * @param {Array} jobs - Jobs to optimize
 * @param {Object} homeBase - Starting point with address/coordinates
 * @returns {Promise<{orderedJobs: Array, totalDistance: number, totalDuration: number, legs: Array}>}
 */
export const suggestRouteOrderAsync = async (jobs, homeBase) => {
    if (!jobs || jobs.length === 0) {
        return { orderedJobs: [], totalDistance: 0, totalDuration: 0, legs: [] };
    }

    if (jobs.length === 1) {
        // Single job - just calculate distance from home
        try {
            const homeLocation = homeBase?.coordinates
                ? { lat: homeBase.coordinates.lat, lng: homeBase.coordinates.lng }
                : homeBase?.address;

            const jobLocation = jobs[0].serviceAddress?.coordinates
                ? { lat: jobs[0].serviceAddress.coordinates.lat, lng: jobs[0].serviceAddress.coordinates.lng }
                : jobs[0].serviceAddress?.formatted || jobs[0].customer?.address;

            if (homeLocation && jobLocation) {
                const distance = await getDistance(homeLocation, jobLocation);
                return {
                    orderedJobs: jobs,
                    totalDistance: distance.distanceMiles || 0,
                    totalDuration: distance.durationMinutes || 0,
                    legs: [distance]
                };
            }
        } catch (e) {
            console.warn('Distance calculation failed, using fallback:', e);
        }

        return { orderedJobs: jobs, totalDistance: 0, totalDuration: 0, legs: [] };
    }

    // Use the optimizeRoute function from distanceMatrixService
    try {
        const startPoint = homeBase?.coordinates
            ? { lat: homeBase.coordinates.lat, lng: homeBase.coordinates.lng, address: homeBase.address }
            : { address: homeBase?.address };

        return await optimizeRoute(jobs, startPoint);
    } catch (e) {
        console.warn('Route optimization failed, using fallback:', e);
        // Fall back to synchronous version
        return {
            orderedJobs: suggestRouteOrder(jobs, homeBase),
            totalDistance: 0,
            totalDuration: 0,
            legs: [],
            fallback: true
        };
    }
};

// ============================================
// MULTI-DAY JOB SCHEDULING
// ============================================

/**
 * Schedule a multi-day job, creating day segments
 * @param {string} jobId - Job ID to schedule
 * @param {Date} startDate - Start date
 * @param {number} totalMinutes - Total job duration
 * @param {Object} workingHours - Working hours configuration
 * @param {string} assignedTechId - Optional tech assignment
 * @returns {Promise<Object>} The created multi-day schedule
 */
export const scheduleMultiDayJob = async (jobId, startDate, totalMinutes, workingHours = {}, assignedTechId = null) => {
    const multiDaySchedule = createMultiDaySchedule(startDate, totalMinutes, workingHours);

    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    const updateData = {
        scheduledTime: startDate.toISOString(),
        scheduledDate: startDate.toISOString(),
        multiDaySchedule,
        estimatedDuration: totalMinutes,
        status: 'scheduled',
        lastActivity: serverTimestamp()
    };

    if (assignedTechId) {
        updateData.assignedTechId = assignedTechId;
    }

    await updateDoc(jobRef, updateData);

    return multiDaySchedule;
};

/**
 * Check if scheduling a multi-day job would cause conflicts
 * @param {Date} startDate - Proposed start date
 * @param {number} totalMinutes - Total duration
 * @param {Object} workingHours - Working hours config
 * @param {Array} existingJobs - Existing jobs to check
 * @param {string} techId - Optional tech to check
 * @returns {Object} Conflict analysis
 */
export const analyzeMultiDayConflicts = (startDate, totalMinutes, workingHours, existingJobs, techId = null) => {
    const proposedSchedule = createMultiDaySchedule(startDate, totalMinutes, workingHours);
    const conflicts = checkMultiDayConflicts(proposedSchedule.segments, existingJobs, techId);

    return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        proposedSchedule,
        affectedDays: conflicts.map(c => c.date),
        summary: conflicts.length > 0
            ? `Conflicts on ${conflicts.length} day${conflicts.length > 1 ? 's' : ''}: ${conflicts.map(c => `Day ${c.dayNumber}`).join(', ')}`
            : 'No conflicts detected'
    };
};

/**
 * Get jobs that appear on a specific date (including multi-day segments)
 * @param {Array} jobs - All jobs
 * @param {Date} date - Date to check
 * @returns {Array} Jobs that appear on this date
 */
export const getJobsForDateIncludingMultiDay = (jobs, date) => {
    const dateStr = date.toISOString().split('T')[0];

    return jobs.filter(job => {
        // Check regular scheduled date
        if (job.scheduledTime || job.scheduledDate) {
            const jobDate = new Date(job.scheduledTime || job.scheduledDate);
            if (jobDate.toISOString().split('T')[0] === dateStr) {
                return true;
            }
        }

        // Check multi-day segments
        if (jobIsMultiDay(job)) {
            const { isInSchedule } = getSegmentForDate(date, job.multiDaySchedule);
            return isInSchedule;
        }

        return false;
    });
};

// ============================================
// ATOMIC BATCH OPERATIONS
// ============================================

/**
 * Perform multiple job updates atomically using Firestore batch
 * @param {Array<{jobId: string, updates: Object}>} operations - Array of update operations
 * @returns {Promise<{success: boolean, updatedCount: number}>}
 */
export const batchUpdateJobs = async (operations) => {
    if (!operations || operations.length === 0) {
        return { success: true, updatedCount: 0 };
    }

    const batch = writeBatch(db);

    for (const op of operations) {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, op.jobId);
        batch.update(jobRef, {
            ...op.updates,
            lastActivity: serverTimestamp()
        });
    }

    await batch.commit();

    return { success: true, updatedCount: operations.length };
};

/**
 * Bulk assign jobs atomically (improved version using batch)
 * @param {Array} assignments - Array of {jobId, techId, techName}
 * @returns {Promise<{success: boolean, updatedCount: number}>}
 */
export const bulkAssignJobsAtomic = async (assignments) => {
    const operations = assignments
        .filter(a => !a.failed && a.techId)
        .map(a => ({
            jobId: a.jobId,
            updates: {
                assignedTechId: a.techId,
                assignedTechName: a.techName,
                assignedAt: serverTimestamp(),
                assignedBy: 'ai'
            }
        }));

    return batchUpdateJobs(operations);
};

/**
 * Reschedule multiple jobs atomically (useful after route optimization)
 * @param {Array<{jobId: string, scheduledTime: string, order: number}>} schedule - New schedule
 * @returns {Promise<{success: boolean, updatedCount: number}>}
 */
export const batchRescheduleJobs = async (schedule) => {
    const operations = schedule.map((item, index) => ({
        jobId: item.jobId,
        updates: {
            scheduledTime: item.scheduledTime,
            scheduledDate: item.scheduledTime,
            routeOrder: item.order || index
        }
    }));

    return batchUpdateJobs(operations);
};

// ============================================
// COMPREHENSIVE SCHEDULING VALIDATION
// ============================================

/**
 * Validate a complete scheduling assignment including crew requirements
 *
 * @param {Object} job - Job to schedule
 * @param {Date} date - Proposed date
 * @param {Object[]} assignedCrew - Crew members to assign (array of tech objects)
 * @param {Object} vehicle - Vehicle to assign
 * @param {Object[]} allTeamMembers - All available team members
 * @param {Object[]} existingJobs - Already scheduled jobs
 * @param {Object[]} timeOffEntries - Time-off entries
 * @param {Object[]} vehicles - All vehicles
 * @returns {Object} Validation result
 */
export const validateSchedulingAssignment = (
    job,
    date,
    assignedCrew = [],
    vehicle = null,
    allTeamMembers = [],
    existingJobs = [],
    timeOffEntries = [],
    vehicles = []
) => {
    const errors = [];
    const warnings = [];
    const suggestions = [];

    // 1. Check crew requirements
    const crewFactors = getRouteCrewFactors(job);
    const requiredCrewSize = crewFactors.requiredCrewSize || 1;
    const assignedCrewSize = assignedCrew.length;

    if (assignedCrewSize === 0) {
        errors.push({
            type: 'no_crew',
            message: `Job requires ${requiredCrewSize} tech(s), none assigned`
        });
    } else if (assignedCrewSize < requiredCrewSize) {
        const shortfall = requiredCrewSize - assignedCrewSize;
        errors.push({
            type: 'crew_shortfall',
            message: `Job requires ${requiredCrewSize} tech(s), only ${assignedCrewSize} assigned (need ${shortfall} more)`
        });

        // Suggest available techs
        const crewValidation = validateCrewAvailability(
            job, date, allTeamMembers, existingJobs, timeOffEntries
        );

        if (crewValidation.availableTechs.length >= shortfall) {
            const unassignedAvailable = crewValidation.availableTechs
                .filter(t => !assignedCrew.some(c => c.id === t.id))
                .slice(0, shortfall);

            suggestions.push({
                type: 'add_techs',
                message: `Consider adding: ${unassignedAvailable.map(t => t.name).join(', ')}`,
                techs: unassignedAvailable
            });
        }
    }

    // 2. Validate each assigned tech
    for (const tech of assignedCrew) {
        const techResult = scoreTechForJob(tech, job, existingJobs, date, timeOffEntries);

        if (techResult.isBlocked) {
            errors.push({
                type: 'tech_blocked',
                techId: tech.id,
                message: `${tech.name}: ${techResult.blockReason}`
            });
        } else if (techResult.hasWarnings) {
            techResult.warnings.forEach(w => {
                warnings.push({
                    type: 'tech_warning',
                    techId: tech.id,
                    message: `${tech.name}: ${w}`
                });
            });
        }
    }

    // 3. Validate vehicle capacity
    if (vehicle) {
        const vehicleCapacity = vehicle.capacity?.passengers || 2;
        if (vehicleCapacity < assignedCrewSize) {
            errors.push({
                type: 'vehicle_capacity',
                message: `Vehicle "${vehicle.name}" seats ${vehicleCapacity}, but ${assignedCrewSize} techs assigned`
            });

            // Suggest suitable vehicles
            const suitableVehicles = findVehiclesForCrewSize(vehicles, job, { includeEquipmentCheck: true });
            if (suitableVehicles.length > 0) {
                suggestions.push({
                    type: 'change_vehicle',
                    message: `Consider: ${suitableVehicles.slice(0, 3).map(v => v.name).join(', ')}`,
                    vehicles: suitableVehicles.slice(0, 3)
                });
            }
        }
    } else if (assignedCrewSize > 0) {
        // No vehicle assigned but crew is assigned
        warnings.push({
            type: 'no_vehicle',
            message: 'No vehicle assigned for this job'
        });

        // Suggest vehicles
        const suitableVehicles = findVehiclesForCrewSize(vehicles, job, { includeEquipmentCheck: true });
        if (suitableVehicles.length > 0) {
            suggestions.push({
                type: 'assign_vehicle',
                message: `Suggested vehicles: ${suitableVehicles.slice(0, 3).map(v => v.name).join(', ')}`,
                vehicles: suitableVehicles.slice(0, 3)
            });
        }
    }

    // 4. Check overall availability on date
    const crewAvailability = validateCrewAvailability(
        job, date, allTeamMembers, existingJobs, timeOffEntries
    );

    if (!crewAvailability.canSchedule && assignedCrewSize === 0) {
        errors.push({
            type: 'insufficient_availability',
            message: crewAvailability.message
        });
    }

    return {
        isValid: errors.length === 0,
        canProceedWithWarnings: errors.length === 0 && warnings.length > 0,
        errors,
        warnings,
        suggestions,
        crewRequirement: {
            required: requiredCrewSize,
            assigned: assignedCrewSize,
            isMet: assignedCrewSize >= requiredCrewSize
        },
        crewAvailability
    };
};

/**
 * Get a staffing summary for jobs on a given date
 *
 * @param {Object[]} jobs - Jobs scheduled for the date
 * @param {Object[]} teamMembers - All team members
 * @param {Date} date - The date to analyze
 * @returns {Object} Staffing summary
 */
export const getStaffingSummaryForDate = (jobs, teamMembers, date, timeOffEntries = []) => {
    let totalCrewNeeded = 0;
    let totalCrewAssigned = 0;
    const understaffedJobs = [];
    const wellStaffedJobs = [];

    for (const job of jobs) {
        const crewFactors = getRouteCrewFactors(job);
        const required = crewFactors.requiredCrewSize || 1;
        const assigned = job.assignedCrew?.length || (job.assignedTechId ? 1 : 0);

        totalCrewNeeded += required;
        totalCrewAssigned += assigned;

        if (assigned < required) {
            understaffedJobs.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                title: job.title,
                required,
                assigned,
                shortfall: required - assigned
            });
        } else {
            wellStaffedJobs.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                title: job.title,
                required,
                assigned
            });
        }
    }

    // Check available techs for the day
    const availability = validateCrewAvailability(
        { crewRequirements: { required: 1 } },
        date,
        teamMembers,
        jobs,
        timeOffEntries
    );

    return {
        date: date.toISOString().split('T')[0],
        totalJobs: jobs.length,
        totalCrewNeeded,
        totalCrewAssigned,
        shortfall: Math.max(0, totalCrewNeeded - totalCrewAssigned),
        understaffedJobCount: understaffedJobs.length,
        understaffedJobs,
        wellStaffedJobs,
        availableTechCount: availability.availableTechCount,
        canCoverAllJobs: availability.availableTechCount >= totalCrewNeeded
    };
};

// ============================================
// CANCELLATION CLEANUP
// ============================================

/**
 * Cleanup scheduling data when a job is cancelled
 * - Unassigns techs
 * - Clears schedule info
 * - Does NOT delete the job, just removes scheduling artifacts
 *
 * @param {string} contractorId - The contractor's ID
 * @param {string} jobId - The job ID being cancelled
 * @param {Object} job - The job object (for context)
 * @returns {Promise<{success: boolean, cleaned: string[]}>}
 */
export const cleanupCancelledJobSchedule = async (contractorId, jobId, job = {}) => {
    const cleaned = [];

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        // Build cleanup update object
        const cleanupData = {
            // Clear tech assignment
            assignedTechId: null,
            assignedTechName: null,
            assignedTechIds: null,
            assignedTechNames: null,
            assignedAt: null,
            assignedBy: null,
            // Clear scheduling info (but preserve the record that it was scheduled)
            routeOrder: null,
            // Mark scheduling as cancelled
            scheduleCleanedAt: serverTimestamp(),
            scheduleCleanedReason: 'job_cancelled'
        };

        // If multi-day job, clear multi-day schedule
        if (job.multiDaySchedule) {
            cleanupData.multiDaySchedule = null;
            cleaned.push('multi-day-schedule');
        }

        await updateDoc(jobRef, cleanupData);
        cleaned.push('tech-assignment', 'route-order');

        console.log(`[cleanupCancelledJobSchedule] Cleaned up scheduling for job ${jobId}:`, cleaned);

        return { success: true, cleaned };

    } catch (error) {
        console.error('[cleanupCancelledJobSchedule] Error:', error);
        return { success: false, cleaned, error: error.message };
    }
};

export default {
    // Tech assignment functions
    scoreTechForJob,
    suggestAssignments,
    autoAssignAll,
    assignJobToTech,
    unassignJob,
    bulkAssignJobs,
    checkConflicts,
    isTechWorkingOnDay,
    suggestTimeSlot,
    findNextAvailableSlot,
    isTechBusyAtTime,
    parseDurationToMinutes,
    sanitizeJobDuration,
    // Time slot suggestion functions
    generateSchedulingSuggestions,
    getQuickSuggestions,
    checkForConflicts,
    // Route optimization
    suggestRouteOrder,
    suggestRouteOrderAsync,
    // Multi-day scheduling
    scheduleMultiDayJob,
    analyzeMultiDayConflicts,
    getJobsForDateIncludingMultiDay,
    // Batch operations
    batchUpdateJobs,
    bulkAssignJobsAtomic,
    batchRescheduleJobs,
    // Crew validation
    validateSchedulingAssignment,
    getStaffingSummaryForDate,
    // Cleanup
    cleanupCancelledJobSchedule
};
