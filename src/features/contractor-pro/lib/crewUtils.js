
// src/features/contractor-pro/lib/crewUtils.js
// ============================================
// CREW UTILS
// ============================================
// Shared helper functions to avoid circular dependencies
// between crewService and crewRequirementsService

/**
 * Create a crew member object
 * @param {Object} tech - Team member object
 * @param {string} role - Role ID
 * @param {Object|null} vehicle - Vehicle object (optional)
 * @returns {Object|null} CrewMember or null if tech is invalid
 */
export const createCrewMember = (tech, role = 'helper', vehicle = null) => {
    // Defensive check: tech must exist and have an id
    if (!tech || !tech.id) {
        console.warn('[createCrewMember] Called with invalid tech:', tech);
        return null;
    }

    return {
        techId: tech.id,
        techName: tech.name || 'Unknown Tech',  // Fallback if name is missing
        role,
        vehicleId: vehicle?.id || null,
        vehicleName: vehicle?.name || null,
        color: tech.color || '#64748B',
        assignedAt: new Date().toISOString()
    };
};

/**
 * Get the lead technician from a crew
 * @param {Object[]} crew
 * @returns {Object|null}
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
 * Get crew size for a job (handles all legacy formats)
 * @param {Object} job
 * @returns {number}
 */
export const getCrewSize = (job) => {
    if (jobHasCrew(job)) {
        return job.assignedCrew.length;
    }
    // Check both assignedTechId (newer) and assignedTo (older) legacy fields
    if (job.assignedTechId || job.assignedTo) {
        return 1;
    }
    return 0;
};

/**
 * Get all tech IDs assigned to a job (handles all formats)
 * Checks: assignedCrew[] (new), assignedTechId (legacy), assignedTo (oldest legacy)
 * @param {Object} job
 * @returns {string[]}
 */
export const getAssignedTechIds = (job) => {
    if (jobHasCrew(job)) {
        // Filter out any crew members with invalid/missing techId
        return job.assignedCrew
            .filter(m => m && m.techId)
            .map(m => m.techId);
    }
    // Check assignedTechId first (newer legacy), then assignedTo (older legacy)
    if (job.assignedTechId) {
        return [job.assignedTechId];
    }
    if (job.assignedTo) {
        return [job.assignedTo];
    }
    return [];
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
 * Handles: assignedCrew[] (new), assignedTechId (legacy), assignedTo (oldest legacy)
 * @param {Object} job
 * @returns {Object[]} CrewMember[]
 */
export const legacyToCrewFormat = (job) => {
    if (jobHasCrew(job)) {
        // Ensure all crew members have required fields, fill in defaults if missing
        return job.assignedCrew.map(member => ({
            techId: member.techId || null,
            techName: member.techName || 'Unknown Tech',
            role: member.role || 'helper',
            vehicleId: member.vehicleId || null,
            vehicleName: member.vehicleName || null,
            color: member.color || '#64748B',
            assignedAt: member.assignedAt || new Date().toISOString()
        }));
    }

    // Check assignedTechId first (newer legacy format)
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

    // Check assignedTo (oldest legacy format)
    if (job.assignedTo) {
        return [{
            techId: job.assignedTo,
            techName: job.assignedToName || 'Technician',
            role: 'lead',
            vehicleId: job.assignedVehicleId || null,
            vehicleName: job.assignedVehicleName || null,
            color: '#64748B',
            assignedAt: job.assignedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        }];
    }

    return [];
};
