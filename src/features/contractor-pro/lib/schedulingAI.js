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
};

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
 * Parse duration string to minutes
 * "2 hours" → 120, "1.5 hrs" → 90, "45 minutes" → 45
 */
export const parseDurationToMinutes = (duration) => {
    if (!duration) return 60; // Default 1 hour
    if (typeof duration === 'number') return duration;

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
 */
const isSlotAvailable = (tech, date, startTime, durationMinutes, existingJobs, timezone, timeOffEntries = []) => {
    // Check for time-off first
    const techTimeOff = timeOffEntries.filter(t => t.techId === tech.id);
    const timeOffCheck = isDateBlockedByTimeOff(date, techTimeOff);
    if (timeOffCheck.blocked) return false;

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    // Check if tech works this day
    if (!techHours?.enabled) return false;

    // Parse times
    const [startHour, startMin] = normalizeTime(startTime, timezone);
    const jobStart = startHour * 60 + startMin;
    const jobEnd = jobStart + durationMinutes;

    const [workStartH, workStartM] = techHours.start.split(':').map(Number);
    const [workEndH, workEndM] = techHours.end.split(':').map(Number);
    const workStart = workStartH * 60 + workStartM;
    const workEnd = workEndH * 60 + workEndM;

    // Check if within working hours
    if (jobStart < workStart || jobEnd > workEnd) return false;

    // Check for conflicts with existing jobs
    const techJobs = existingJobs.filter(j => j.assignedTechId === tech.id);
    const buffer = tech.defaultBufferMinutes || 30;

    for (const existingJob of techJobs) {
        if (!existingJob.scheduledTime) continue;

        const [exStartH, exStartM] = normalizeTime(existingJob.scheduledTime, timezone);
        const exStart = exStartH * 60 + exStartM;
        const exDuration = parseDurationToMinutes(existingJob.estimatedDuration);
        const exEnd = exStart + exDuration + buffer;

        // Check overlap
        if (!(jobEnd + buffer <= exStart || jobStart >= exEnd)) {
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
        // Return early for time-off - tech is completely unavailable
        return { score, reasons, warnings, isBlocked: true, blockReason: `On ${timeOffCheck.reason}` };
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

    // 3. AVAILABILITY CHECK
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    if (techHours?.enabled) {
        score += SCORING_WEIGHTS.AVAILABILITY;
        reasons.push(`Works ${dayName}s`);
    } else {
        score -= 100; // Major penalty - tech doesn't work this day
        warnings.push(`Not scheduled to work ${dayName}`);
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

    // 7. LOCATION/PROXIMITY
    const jobZip = job.customer?.address?.match(/\d{5}/)?.[0] ||
        job.serviceAddress?.match(/\d{5}/)?.[0];
    const techHomeZip = tech.homeZip;

    if (jobZip && techHomeZip) {
        const distance = estimateDistance(techHomeZip, jobZip);
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

        if (otherJobZips.some(z => estimateDistance(z, jobZip) <= 10)) {
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

    return {
        techId: tech.id,
        techName: tech.name,
        score: Math.round(score),
        reasons,
        warnings,
        isRecommended: score >= 80 && warnings.length === 0,
        hasWarnings: warnings.length > 0
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
 */
export const autoAssignAll = (unassignedJobs, techs, existingAssignments, date) => {
    const assignments = [];
    const jobsToAssign = [...unassignedJobs];
    const currentAssignments = [...existingAssignments];

    // Sort jobs by priority - multi-tech jobs first (harder to staff), then by duration
    jobsToAssign.sort((a, b) => {
        const aCrewFactors = getRouteCrewFactors(a);
        const bCrewFactors = getRouteCrewFactors(b);
        const aRequired = aCrewFactors.requiredCrewSize || 1;
        const bRequired = bCrewFactors.requiredCrewSize || 1;

        // Multi-tech jobs first
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
                isBlocked: result.isBlocked
            };
        })
        .filter(t => !t.isBlocked && t.score > -50) // Filter out blocked and very low scoring techs
        .sort((a, b) => b.score - a.score);

        if (techScores.length === 0) {
            assignments.push({
                jobId: job.id,
                job,
                techIds: [],
                techNames: [],
                score: 0,
                reasons: [],
                warnings: ['No suitable tech available'],
                failed: true,
                requiredCrewSize
            });
            continue;
        }

        // For multi-tech jobs, pick multiple techs
        const assignedTechs = techScores.slice(0, Math.min(requiredCrewSize, techScores.length));
        const assignedCount = assignedTechs.length;

        // Build warnings
        const warnings = [...(assignedTechs[0]?.warnings || [])];
        if (assignedCount < requiredCrewSize) {
            warnings.push(`Needs ${requiredCrewSize} techs, only ${assignedCount} available`);
        }

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
            isFullyStaffed: assignedCount >= requiredCrewSize
        });

        // Add to current assignments for next iteration - mark job as assigned to all techs
        assignedTechs.forEach(t => {
            currentAssignments.push({
                ...job,
                assignedTechId: t.techId
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
            understaffed: assignments.filter(a => !a.failed && !a.isFullyStaffed).length
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
 * Check for scheduling conflicts
 */
export const checkConflicts = (tech, job, existingJobs, date, timezone) => {
    const conflicts = [];

    // 1. Day availability
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const techHours = tech.workingHours?.[dayName];

    if (!techHours?.enabled) {
        conflicts.push({
            type: 'day_off',
            severity: 'error',
            message: `${tech.name} doesn't work on ${dayName}s`
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
 */
const getJobsForDate = (allJobs, date) => {
    return allJobs.filter(job => {
        if (!job.scheduledTime && !job.scheduledDate) return false;
        const jobDate = job.scheduledTime
            ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
            : new Date(job.scheduledDate.toDate ? job.scheduledDate.toDate() : job.scheduledDate);
        return jobDate.toDateString() === date.toDateString();
    });
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
 * @param {Object} targetJob - The job to schedule
 * @param {Array} allJobs - All jobs (scheduled and unscheduled)
 * @param {Object} preferences - Contractor's scheduling preferences
 * @param {Object} customerPrefs - Customer's scheduling preferences (if any)
 * @param {number} daysToAnalyze - How many days ahead to look
 * @returns {Object} Suggestions and analysis
 */
export const generateSchedulingSuggestions = (
    targetJob,
    allJobs,
    preferences = {},
    customerPrefs = null,
    daysToAnalyze = 14
) => {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fullDays = [];
    const lightDays = [];

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

        // Parse working hours
        const [startH, startM] = workingHours.start.split(':').map(Number);
        const [endH, endM] = workingHours.end.split(':').map(Number);
        const dayStart = startH * 60 + startM;
        const dayEnd = endH * 60 + endM;

        // Get existing jobs for this day
        const dayJobs = getJobsForDate(allJobs, date);

        // Find available slots
        const busySlots = dayJobs.map(job => {
            const jobTime = job.scheduledTime
                ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
                : null;
            if (!jobTime) return null;

            const jobDur = job.estimatedDuration || preferences?.defaultJobDuration || 120;
            const durMins = typeof jobDur === 'number' ? jobDur : parseDurationToMinutes(jobDur);
            const buffer = preferences?.bufferMinutes || 30;

            const start = jobTime.getHours() * 60 + jobTime.getMinutes();
            return { start, end: start + durMins + buffer };
        }).filter(Boolean).sort((a, b) => a.start - b.start);

        // Find gaps
        let searchStart = dayStart;

        for (const slot of busySlots) {
            if (searchStart + durationMins + (preferences?.bufferMinutes || 30) <= slot.start) {
                // Found a gap!
                const score = calculateSlotScore(date, searchStart, workload, customerPrefs, preferences);
                suggestions.push({
                    date,
                    startTime: minutesToTime(searchStart),
                    endTime: minutesToTime(searchStart + durationMins),
                    dateFormatted: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    timeFormatted: `${formatTimeDisplay(minutesToTime(searchStart))} - ${formatTimeDisplay(minutesToTime(searchStart + durationMins))}`,
                    score,
                    isRecommended: score >= 80,
                    reasons: getSlotReasons(date, searchStart, workload, customerPrefs),
                    workload
                });
            }
            searchStart = Math.max(searchStart, slot.end);
        }

        // Check end of day
        if (searchStart + durationMins <= dayEnd) {
            const score = calculateSlotScore(date, searchStart, workload, customerPrefs, preferences);
            suggestions.push({
                date,
                startTime: minutesToTime(searchStart),
                endTime: minutesToTime(searchStart + durationMins),
                dateFormatted: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                timeFormatted: `${formatTimeDisplay(minutesToTime(searchStart))} - ${formatTimeDisplay(minutesToTime(searchStart + durationMins))}`,
                score,
                isRecommended: score >= 80,
                reasons: getSlotReasons(date, searchStart, workload, customerPrefs),
                workload
            });
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

    return {
        suggestions: suggestions.slice(0, 10),
        recommended: suggestions[0] || null,
        warnings,
        insights,
        meta: {
            analyzedDays: daysToAnalyze,
            totalSlotsFound: suggestions.length,
            jobDuration: durationMins,
            hasCustomerPreferences: !!customerPrefs
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

export default {
    // Tech assignment functions
    scoreTechForJob,
    suggestAssignments,
    autoAssignAll,
    assignJobToTech,
    unassignJob,
    bulkAssignJobs,
    checkConflicts,
    suggestTimeSlot,
    parseDurationToMinutes,
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
    getStaffingSummaryForDate
};
