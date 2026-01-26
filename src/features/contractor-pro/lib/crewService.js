// src/features/contractor-pro/lib/crewService.js
// ============================================
// CREW MANAGEMENT SERVICE
// ============================================
// Handles multi-technician job assignments (crews)
// Supports lead/helper roles and vehicle assignments

import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { extractCrewRequirements, validateCrewAvailability } from './crewRequirementsService';
import { onCrewAssignmentChanged } from './techNotificationService';
import { isMultiDayJob, createMultiDaySchedule } from './multiDayUtils';

// ============================================
// CONSTANTS
// ============================================

/**
 * Crew member roles
 */
export const CREW_ROLES = [
    { id: 'lead', label: 'Lead Tech', description: 'Primary technician, customer contact', color: '#10B981' },
    { id: 'helper', label: 'Helper', description: 'Assists the lead technician', color: '#3B82F6' },
    { id: 'apprentice', label: 'Apprentice', description: 'Learning, supervised work', color: '#8B5CF6' },
    { id: 'specialist', label: 'Specialist', description: 'Specific skill needed for job', color: '#F59E0B' }
];

/**
 * Job complexity levels that suggest crew size
 */
export const JOB_COMPLEXITY = {
    simple: { label: 'Simple', suggestedCrew: 1, maxCrew: 2 },
    moderate: { label: 'Moderate', suggestedCrew: 1, maxCrew: 3 },
    complex: { label: 'Complex', suggestedCrew: 2, maxCrew: 4 },
    major: { label: 'Major Project', suggestedCrew: 3, maxCrew: 6 }
};

// ============================================
// CREW MEMBER SCHEMA
// ============================================

/**
 * Crew Member Schema (stored in job.assignedCrew array)
 * @typedef {Object} CrewMember
 * @property {string} techId - Technician's ID
 * @property {string} techName - Technician's display name
 * @property {string} role - One of CREW_ROLES ids: 'lead', 'helper', 'apprentice', 'specialist'
 * @property {string|null} vehicleId - Assigned vehicle ID (optional)
 * @property {string|null} vehicleName - Assigned vehicle name (optional)
 * @property {string} color - Tech's color for UI display
 * @property {string} assignedAt - When this member was added to crew
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

// ============================================
// HELPER FUNCTIONS
// ============================================

// Import shared helpers to avoid circular dependencies
import {
    createCrewMember,
    getCrewLead,
    jobHasCrew,
    getCrewSize,
    getAssignedTechIds,
    isTechAssigned,
    legacyToCrewFormat
} from './crewUtils';

export {
    createCrewMember,
    getCrewLead,
    jobHasCrew,
    getCrewSize,
    getAssignedTechIds,
    isTechAssigned,
    legacyToCrewFormat
};

// ============================================
// CREW ASSIGNMENT OPERATIONS
// ============================================

/**
 * Assign a full crew to a job
 * @param {string} jobId - Job document ID
 * @param {CrewMember[]} crew - Array of crew members
 * @param {string} assignedBy - 'manual' | 'ai'
 * @returns {Promise<{success: boolean}>}
 */
export const assignCrewToJob = async (jobId, crew, assignedBy = 'manual', options = {}) => {
    if (!jobId) throw new Error('Job ID is required');
    if (!crew || crew.length === 0) throw new Error('Crew cannot be empty');

    const { skipNotifications = false, contractorId = null, previousCrew = null } = options;

    // Ensure there's exactly one lead
    const leads = crew.filter(m => m.role === 'lead');
    if (leads.length === 0) {
        // Promote first member to lead
        crew[0].role = 'lead';
    } else if (leads.length > 1) {
        // Demote extras to helper
        let foundLead = false;
        crew.forEach(m => {
            if (m.role === 'lead') {
                if (foundLead) m.role = 'helper';
                foundLead = true;
            }
        });
    }

    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
    const lead = getCrewLead(crew);

    // Get previous crew state and job data for multi-day schedule handling
    let oldCrew = previousCrew;
    let jobData = null;
    try {
        const jobSnap = await getDoc(jobRef);
        if (jobSnap.exists()) {
            jobData = jobSnap.data();
            if (!oldCrew && !skipNotifications) {
                oldCrew = jobData.assignedCrew || [];
            }
        }
    } catch (e) {
        console.warn('[crewService] Could not get job data:', e);
        oldCrew = oldCrew || [];
    }

    // Build update data
    // BUG-046 Fix: Firestore doesn't allow undefined values, use null instead
    const updateData = {
        // New crew format
        assignedCrew: crew,
        crewSize: crew.length,

        // Legacy fields for backward compatibility (ensure no undefined values)
        assignedTechId: lead.techId || null,
        assignedTechName: lead.techName || null,
        assignedVehicleId: lead.vehicleId || null,
        assignedVehicleName: lead.vehicleName || null,

        // Metadata
        assignedAt: serverTimestamp(),
        assignedBy,
        lastActivity: serverTimestamp()
    };

    // BUG-042 Fix: Check if job is multi-day and create/update multiDaySchedule if missing
    if (jobData) {
        const duration = jobData.estimatedDuration || 120;
        const hasScheduledTime = jobData.scheduledTime || jobData.scheduledDate;

        // If job is multi-day but doesn't have multiDaySchedule, create it
        if (hasScheduledTime && isMultiDayJob(duration)) {
            if (!jobData.multiDaySchedule?.segments?.length) {
                const startDate = new Date(jobData.scheduledTime || jobData.scheduledDate);
                const workingHours = options.workingHours || {};
                const multiDaySchedule = createMultiDaySchedule(startDate, duration, workingHours);
                updateData.multiDaySchedule = multiDaySchedule;
            }
        }
    }

    await updateDoc(jobRef, updateData);

    // Send notifications to techs (non-blocking)
    if (!skipNotifications && contractorId) {
        const oldTechIds = new Set((oldCrew || []).map(c => c.techId));
        const newTechIds = new Set(crew.map(c => c.techId));

        const added = crew.filter(c => !oldTechIds.has(c.techId));
        const removed = (oldCrew || []).filter(c => !newTechIds.has(c.techId));

        if (added.length > 0 || removed.length > 0) {
            // Get full job data for notification
            const jobSnap = await getDoc(jobRef);
            const job = jobSnap.exists() ? { id: jobSnap.id, ...jobSnap.data() } : { id: jobId };

            // Fire and forget - don't block on notifications
            onCrewAssignmentChanged(contractorId, jobId, {
                added,
                removed,
                job: { ...job, assignedCrew: crew }
            }).catch(err => {
                console.warn('[crewService] Notification error:', err);
            });
        }
    }

    return { success: true };
};

/**
 * Remove ALL crew members from a job (full unassign)
 * @param {string} jobId
 * @returns {Promise<{success: boolean}>}
 */
export const unassignAllCrew = async (jobId) => {
    if (!jobId) throw new Error('Job ID is required');

    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    await updateDoc(jobRef, {
        // Clear crew fields
        assignedCrew: null,
        crewSize: 0,

        // Clear legacy fields
        assignedTechId: null,
        assignedTechName: null,
        assignedVehicleId: null,
        assignedVehicleName: null,

        // Metadata
        assignedAt: null,
        assignedBy: null,
        lastActivity: serverTimestamp()
    });

    return { success: true };
};

/**
 * Add a single tech to an existing crew
 * @param {string} jobId
 * @param {Object} job - Current job data (to get existing crew)
 * @param {Object} tech - Tech to add
 * @param {string} role - Role for new member
 * @param {Object|null} vehicle - Vehicle assignment (optional)
 * @returns {Promise<{success: boolean, newCrew: CrewMember[]}>}
 */
export const addTechToCrew = async (jobId, job, tech, role = 'helper', vehicle = null) => {
    const currentCrew = legacyToCrewFormat(job);

    // Check if already assigned
    if (currentCrew.some(m => m.techId === tech.id)) {
        throw new Error(`${tech.name} is already assigned to this job`);
    }

    const newMember = createCrewMember(tech, role, vehicle);
    const newCrew = [...currentCrew, newMember];

    await assignCrewToJob(jobId, newCrew, 'manual');

    return { success: true, newCrew };
};

/**
 * Remove a tech from a crew
 * @param {string} jobId
 * @param {Object} job - Current job data
 * @param {string} techId - Tech to remove
 * @returns {Promise<{success: boolean, newCrew: CrewMember[]}>}
 */
export const removeTechFromCrew = async (jobId, job, techId) => {
    const currentCrew = legacyToCrewFormat(job);

    const memberIndex = currentCrew.findIndex(m => m.techId === techId);
    if (memberIndex === -1) {
        throw new Error('Tech not found in crew');
    }

    const removedMember = currentCrew[memberIndex];
    const newCrew = currentCrew.filter(m => m.techId !== techId);

    // If we removed the lead and there are others, promote someone
    if (removedMember.role === 'lead' && newCrew.length > 0) {
        newCrew[0].role = 'lead';
    }

    if (newCrew.length === 0) {
        // Fully unassign the job
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        await updateDoc(jobRef, {
            assignedCrew: null,
            crewSize: 0,
            assignedTechId: null,
            assignedTechName: null,
            assignedVehicleId: null,
            assignedVehicleName: null,
            assignedAt: null,
            assignedBy: null,
            lastActivity: serverTimestamp()
        });
    } else {
        await assignCrewToJob(jobId, newCrew, 'manual');
    }

    return { success: true, newCrew };
};

/**
 * Update a crew member's role
 * @param {string} jobId
 * @param {Object} job
 * @param {string} techId
 * @param {string} newRole
 * @returns {Promise<{success: boolean}>}
 */
export const updateCrewMemberRole = async (jobId, job, techId, newRole) => {
    const currentCrew = legacyToCrewFormat(job);

    const memberIndex = currentCrew.findIndex(m => m.techId === techId);
    if (memberIndex === -1) {
        throw new Error('Tech not found in crew');
    }

    // If promoting to lead, demote current lead
    if (newRole === 'lead') {
        currentCrew.forEach(m => {
            if (m.role === 'lead') m.role = 'helper';
        });
    }

    currentCrew[memberIndex].role = newRole;

    await assignCrewToJob(jobId, currentCrew, 'manual');

    return { success: true };
};

/**
 * Assign a vehicle to a crew member
 * @param {string} jobId
 * @param {Object} job
 * @param {string} techId
 * @param {Object} vehicle
 * @returns {Promise<{success: boolean}>}
 */
export const assignVehicleToCrewMember = async (jobId, job, techId, vehicle) => {
    const currentCrew = legacyToCrewFormat(job);

    const memberIndex = currentCrew.findIndex(m => m.techId === techId);
    if (memberIndex === -1) {
        throw new Error('Tech not found in crew');
    }

    currentCrew[memberIndex].vehicleId = vehicle?.id || null;
    currentCrew[memberIndex].vehicleName = vehicle?.name || null;

    await assignCrewToJob(jobId, currentCrew, 'manual');

    return { success: true };
};

// ============================================
// CREW SUGGESTIONS (AI)
// ============================================

/**
 * Suggest optimal crew composition for a job
 * @param {Object} job - Job requiring crew
 * @param {Object[]} availableTechs - Available team members
 * @param {Object[]} existingJobs - Jobs already scheduled
 * @param {Date} date - Scheduled date
 * @param {Object} options - Additional options
 * @returns {{suggestedCrew: CrewMember[], reasoning: string[], alternatives: Object[]}}
 */
export const suggestCrewForJob = (job, availableTechs, existingJobs, date, options = {}) => {
    const suggestedCrew = [];
    const reasoning = [];

    // Check if job has explicit crew requirements (from quote or direct specification)
    const crewReqs = job.crewRequirements || extractCrewRequirements(job.lineItems);
    let targetCrewSize;

    if (crewReqs.requiredCrewSize > 0) {
        targetCrewSize = crewReqs.requiredCrewSize;
        reasoning.push(`Crew requirement from ${crewReqs.source}: ${targetCrewSize} tech${targetCrewSize > 1 ? 's' : ''}`);
        if (crewReqs.notes?.length > 0) {
            crewReqs.notes.forEach(note => reasoning.push(`  - ${note}`));
        }
    } else {
        // Fall back to complexity-based sizing
        const duration = job.estimatedDuration || 120;
        const durationHours = duration / 60;

        let complexity = 'simple';
        if (durationHours >= 8 || job.complexity === 'major') {
            complexity = 'major';
        } else if (durationHours >= 4 || job.complexity === 'complex') {
            complexity = 'complex';
        } else if (durationHours >= 2 || job.complexity === 'moderate') {
            complexity = 'moderate';
        }

        targetCrewSize = JOB_COMPLEXITY[complexity].suggestedCrew;
        reasoning.push(`Job complexity: ${complexity} (suggests ${targetCrewSize} tech${targetCrewSize > 1 ? 's' : ''})`);
    }

    // Filter techs by availability
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const availableToday = availableTechs.filter(tech => {
        const hours = tech.workingHours?.[dayName];
        if (!hours?.enabled) return false;

        // Check if they're already at capacity
        const techJobsToday = existingJobs.filter(j =>
            getAssignedTechIds(j).includes(tech.id)
        );
        if (techJobsToday.length >= (tech.maxJobsPerDay || 4)) return false;

        return true;
    });

    if (availableToday.length === 0) {
        reasoning.push('No techs available on this date');
        return { suggestedCrew: [], reasoning, alternatives: [] };
    }

    // Get required skills for job
    const jobCategory = job.category || job.serviceType || 'General';
    const requiredSkills = getRequiredSkillsForCategory(jobCategory);

    // Score techs
    const scoredTechs = availableToday.map(tech => {
        let score = 0;
        const notes = [];

        // Skill match
        const hasSkills = requiredSkills.length === 0 ||
            requiredSkills.some(skill => tech.skills?.includes(skill));
        if (hasSkills) {
            score += 50;
            notes.push('Has required skills');
        }

        // Seniority bonus for lead
        if (tech.role === 'lead' || tech.role === 'senior_tech') {
            score += 20;
            notes.push('Senior tech');
        }

        // Less loaded techs preferred
        const techJobsToday = existingJobs.filter(j =>
            getAssignedTechIds(j).includes(tech.id)
        );
        const loadFactor = 1 - (techJobsToday.length / (tech.maxJobsPerDay || 4));
        score += loadFactor * 30;

        // Customer preference (if they've worked together before)
        if (job.preferredTechId === tech.id) {
            score += 40;
            notes.push('Customer preference');
        }

        return { tech, score, notes };
    });

    // Sort by score
    scoredTechs.sort((a, b) => b.score - a.score);

    // Select crew
    const selectedCount = Math.min(targetCrewSize, scoredTechs.length);

    for (let i = 0; i < selectedCount; i++) {
        const { tech, notes } = scoredTechs[i];
        suggestedCrew.push(createCrewMember(
            tech,
            i === 0 ? 'lead' : 'helper'
        ));

        if (i === 0) {
            reasoning.push(`Lead: ${tech.name} - ${notes.join(', ') || 'Best available'}`);
        } else {
            reasoning.push(`Helper: ${tech.name} - ${notes.join(', ') || 'Available'}`);
        }
    }

    // Generate alternatives
    const alternatives = scoredTechs.slice(selectedCount, selectedCount + 3).map(({ tech, score }) => ({
        tech,
        score,
        canReplace: 'any'
    }));

    return { suggestedCrew, reasoning, alternatives };
};

/**
 * Get required skills for a job category
 */
const getRequiredSkillsForCategory = (category) => {
    const skillMap = {
        'HVAC': ['HVAC', 'Heating', 'Cooling', 'Refrigeration'],
        'Plumbing': ['Plumbing', 'Drain Cleaning', 'Water Heater'],
        'Electrical': ['Electrical', 'Wiring'],
        'Appliance': ['Appliance Repair', 'Diagnostics'],
        'General': []
    };

    for (const [key, skills] of Object.entries(skillMap)) {
        if (category.toLowerCase().includes(key.toLowerCase())) {
            return skills;
        }
    }
    return [];
};

// ============================================
// CREW CONFLICT CHECKING
// ============================================

/**
 * Check for conflicts when assigning a crew
 * @param {CrewMember[]} proposedCrew
 * @param {Object[]} existingJobs
 * @param {Date} date
 * @param {Object[]} teamMembers - Full team member objects for working hours
 * @returns {{hasConflicts: boolean, conflicts: Object[]}}
 */
export const checkCrewConflicts = (proposedCrew, existingJobs, date, teamMembers) => {
    const conflicts = [];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    for (const member of proposedCrew) {
        const tech = teamMembers.find(t => t.id === member.techId);
        if (!tech) continue;

        // Check working hours
        const hours = tech.workingHours?.[dayName];
        if (!hours?.enabled) {
            conflicts.push({
                techId: member.techId,
                techName: member.techName,
                type: 'day_off',
                severity: 'error',
                message: `${member.techName} doesn't work on ${dayName}s`
            });
            continue;
        }

        // Check job count
        const techJobsToday = existingJobs.filter(j =>
            getAssignedTechIds(j).includes(member.techId)
        );
        if (techJobsToday.length >= (tech.maxJobsPerDay || 4)) {
            conflicts.push({
                techId: member.techId,
                techName: member.techName,
                type: 'capacity',
                severity: 'warning',
                message: `${member.techName} already has ${techJobsToday.length} jobs scheduled`
            });
        }
    }

    return {
        hasConflicts: conflicts.length > 0,
        hasErrors: conflicts.some(c => c.severity === 'error'),
        conflicts
    };
};

// ============================================
// EXPORTS
// ============================================

export default {
    // Constants
    CREW_ROLES,
    JOB_COMPLEXITY,

    // Helpers
    createCrewMember,
    getCrewLead,
    jobHasCrew,
    getCrewSize,
    getAssignedTechIds,
    isTechAssigned,
    legacyToCrewFormat,

    // Operations
    assignCrewToJob,
    unassignAllCrew,
    addTechToCrew,
    removeTechFromCrew,
    updateCrewMemberRole,
    assignVehicleToCrewMember,

    // AI
    suggestCrewForJob,
    checkCrewConflicts
};
