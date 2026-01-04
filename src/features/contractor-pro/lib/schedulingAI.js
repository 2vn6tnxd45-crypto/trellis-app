// src/features/contractor-pro/lib/schedulingAI.js
// ============================================
// AI SCHEDULING SERVICE
// ============================================
// Smart job assignment and scheduling optimization
// Considers: skills, availability, capacity, location, workload balance

import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

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
 * Check if a time slot is available for a tech
 */
const isSlotAvailable = (tech, date, startTime, durationMinutes, existingJobs) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const techHours = tech.workingHours?.[dayName];
    
    // Check if tech works this day
    if (!techHours?.enabled) return false;
    
    // Parse times
    const [startHour, startMin] = startTime.split(':').map(Number);
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
        
        const [exStartH, exStartM] = existingJob.scheduledTime.split(':').map(Number);
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
 * Calculate distance between two zip codes (simplified)
 * In production, use Google Distance Matrix API
 */
const estimateDistance = (zip1, zip2) => {
    if (!zip1 || !zip2) return 10; // Default 10 miles
    
    // Simplified: If same first 3 digits, close
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
export const scoreTechForJob = (tech, job, allJobsForDay, date) => {
    let score = 0;
    const reasons = [];
    const warnings = [];
    
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
 */
export const autoAssignAll = (unassignedJobs, techs, existingAssignments, date) => {
    const assignments = [];
    const jobsToAssign = [...unassignedJobs];
    const currentAssignments = [...existingAssignments];
    
    // Sort jobs by priority (could add urgency, customer tier, etc.)
    jobsToAssign.sort((a, b) => {
        // Longer jobs first (harder to fit)
        const aDur = parseDurationToMinutes(a.estimatedDuration);
        const bDur = parseDurationToMinutes(b.estimatedDuration);
        return bDur - aDur;
    });
    
    for (const job of jobsToAssign) {
        const { suggestions, topPick } = suggestAssignments(
            job, 
            techs, 
            currentAssignments, 
            date
        );
        
        if (topPick && topPick.score > 0) {
            assignments.push({
                jobId: job.id,
                job,
                techId: topPick.techId,
                techName: topPick.techName,
                score: topPick.score,
                reasons: topPick.reasons,
                warnings: topPick.warnings
            });
            
            // Add to current assignments for next iteration
            currentAssignments.push({
                ...job,
                assignedTechId: topPick.techId
            });
        } else {
            assignments.push({
                jobId: job.id,
                job,
                techId: null,
                techName: null,
                score: 0,
                reasons: [],
                warnings: ['No suitable tech available'],
                failed: true
            });
        }
    }
    
    return {
        assignments,
        successful: assignments.filter(a => !a.failed),
        failed: assignments.filter(a => a.failed),
        summary: {
            total: assignments.length,
            assigned: assignments.filter(a => !a.failed).length,
            unassigned: assignments.filter(a => a.failed).length
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
export const checkConflicts = (tech, job, existingJobs, date) => {
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
        const available = isSlotAvailable(tech, date, job.scheduledTime, duration, existingJobs);
        
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
    
    const durationMins = typeof jobDuration === 'number' ? jobDuration : parseDurationToMinutes(jobDuration);
    
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
 * Suggest optimal route order for a day's jobs
 */
export const suggestRouteOrder = (jobs, homeBase) => {
    if (jobs.length <= 1) return jobs;
    
    // Simple nearest-neighbor algorithm
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
    suggestRouteOrder
};
