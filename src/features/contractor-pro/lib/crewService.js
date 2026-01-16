// src/features/contractor-pro/lib/crewService.js
// ============================================
// CREW MANAGEMENT SERVICE
// ============================================
// Handles multi-technician job assignments (crews)
// Supports lead/helper roles and vehicle assignments

import { db } from '../../../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

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

/**
 * Create a crew member object
 * @param {Object} tech - Team member object
 * @param {string} role - Role ID
 * @param {Object|null} vehicle - Vehicle object (optional)
 * @returns {CrewMember}
 */
export const createCrewMember = (tech, role = 'helper', vehicle = null) => ({
    techId: tech.id,
    techName: tech.name,
    role,
    vehicleId: vehicle?.id || null,
    vehicleName: vehicle?.name || null,
    color: tech.color || '#64748B',
    assignedAt: new Date().toISOString()
});

/**
 * Get the lead technician from a crew
 * @param {CrewMember[]} crew
 * @returns {CrewMember|null}
 */
export const getCrewLead = (crew) => {
    if (!crew || crew.length === 0) return null;
    return crew.find(m => m.role === 'lead') || crew[0];
};

/**
 * Check if a job has a crew (vs single tech)
 * @param {Object} job
 * @returns {boolean}
 */
export const jobHasCrew = (job) => {
    return Array.isArray(job.assignedCrew) && job.assignedCrew.length > 0;
};

/**
 * Get crew size for a job (handles both old and new format)
 * @param {Object} job
 * @returns {number}
 */
export const getCrewSize = (job) => {
    if (jobHasCrew(job)) {
        return job.assignedCrew.length;
    }
    return job.assignedTechId ? 1 : 0;
};

/**
 * Get all tech IDs assigned to a job (handles both formats)
 * @param {Object} job
 * @returns {string[]}
 */
export const getAssignedTechIds = (job) => {
    if (jobHasCrew(job)) {
        return job.assignedCrew.map(m => m.techId);
    }
    return job.assignedTechId ? [job.assignedTechId] : [];
};

/**
 * Check if a specific tech is assigned to a job
 * @param {Object} job
 * @param {string} techId
 * @returns {boolean}
 */
export const isTechAssigned = (job, techId) => {
    return getAssignedTechIds(job).includes(techId);
};

/**
 * Convert legacy single-tech assignment to crew format
 * @param {Object} job
 * @returns {CrewMember[]}
 */
export const legacyToCrewFormat = (job) => {
    if (jobHasCrew(job)) {
        return job.assignedCrew;
    }

    if (job.assignedTechId) {
        return [{
            techId: job.assignedTechId,
            techName: job.assignedTechName || 'Technician',
            role: 'lead',
            vehicleId: job.assignedVehicleId || null,
            vehicleName: job.assignedVehicleName || null,
            color: '#64748B',
            assignedAt: job.assignedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }];
    }

    return [];
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
export const assignCrewToJob = async (jobId, crew, assignedBy = 'manual') => {
    if (!jobId) throw new Error('Job ID is required');
    if (!crew || crew.length === 0) throw new Error('Crew cannot be empty');

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

    await updateDoc(jobRef, {
        // New crew format
        assignedCrew: crew,
        crewSize: crew.length,

        // Legacy fields for backward compatibility
        assignedTechId: lead.techId,
        assignedTechName: lead.techName,
        assignedVehicleId: lead.vehicleId,
        assignedVehicleName: lead.vehicleName,

        // Metadata
        assignedAt: serverTimestamp(),
        assignedBy,
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

    // Determine job complexity
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

    const { suggestedCrew: suggestedSize } = JOB_COMPLEXITY[complexity];
    reasoning.push(`Job complexity: ${complexity} (suggests ${suggestedSize} tech${suggestedSize > 1 ? 's' : ''})`);

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
    const selectedCount = Math.min(suggestedSize, scoredTechs.length);

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
    addTechToCrew,
    removeTechFromCrew,
    updateCrewMemberRole,
    assignVehicleToCrewMember,

    // AI
    suggestCrewForJob,
    checkCrewConflicts
};
