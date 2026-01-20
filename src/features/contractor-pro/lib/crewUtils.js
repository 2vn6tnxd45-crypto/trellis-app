
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
 * @returns {Object} CrewMember
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
 * @returns {Object[]} CrewMember[]
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
