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

export default {
    scoreTechForJob,
    suggestAssignments,
    autoAssignAll,
    assignJobToTech,
    unassignJob,
    bulkAssignJobs,
    checkConflicts,
    suggestTimeSlot,
    parseDurationToMinutes
};
