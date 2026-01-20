// src/features/contractor-pro/lib/crewRequirementsService.js
// ============================================
// CREW REQUIREMENTS SERVICE
// ============================================
// Extracts crew requirements from quotes/line items
// Validates crew assignments against requirements
// Integrates with scheduling and route optimization

import { getCrewSize, getAssignedTechIds, jobHasCrew } from './crewUtils';

// ============================================
// CONSTANTS
// ============================================

export const CREW_VALIDATION_STATUS = {
    VALID: 'valid',
    UNDERSTAFFED: 'understaffed',
    OVERSTAFFED: 'overstaffed',
    UNASSIGNED: 'unassigned'
};

// ============================================
// EXTRACT CREW REQUIREMENTS FROM QUOTES/JOBS
// ============================================

/**
 * Extract crew requirements from quote line items
 * Aggregates crew size from all labor items to determine total required
 * 
 * @param {Object[]} lineItems - Quote or job line items
 * @returns {Object} Crew requirements summary
 */
export const extractCrewRequirements = (lineItems = []) => {
    if (!lineItems || lineItems.length === 0) {
        return {
            requiredCrewSize: 1,
            minimumCrewSize: 1,
            maximumCrewSize: null,
            source: 'default',
            laborItems: [],
            totalLaborHours: 0,
            requiresMultipleTechs: false,
            notes: []
        };
    }

    const laborItems = lineItems.filter(item =>
        item.type === 'labor' ||
        item.category?.toLowerCase() === 'labor' ||
        item.isLabor === true
    );

    // Find the maximum crew size specified across all labor items
    // This handles scenarios where different phases need different crew sizes
    let maxSpecifiedCrew = 0;
    let totalLaborHours = 0;
    const notes = [];

    laborItems.forEach(item => {
        const itemCrewSize = parseInt(item.crewSize) || 0;
        const itemHours = parseFloat(item.hours) || parseFloat(item.quantity) || 0;

        if (itemCrewSize > maxSpecifiedCrew) {
            maxSpecifiedCrew = itemCrewSize;
        }

        totalLaborHours += itemHours * (itemCrewSize || 1);

        if (itemCrewSize > 1) {
            notes.push(`${item.description || item.name || 'Labor'}: ${itemCrewSize} techs`);
        }
    });

    // If no explicit crew size, infer from job characteristics
    let inferredCrewSize = 1;
    let source = 'specified';

    if (maxSpecifiedCrew === 0) {
        source = 'inferred';
        // Infer based on total labor hours
        if (totalLaborHours >= 16) {
            inferredCrewSize = 3;
            notes.push('Inferred: Large job (16+ labor hours) suggests 3 techs');
        } else if (totalLaborHours >= 8) {
            inferredCrewSize = 2;
            notes.push('Inferred: Medium job (8+ labor hours) suggests 2 techs');
        } else {
            inferredCrewSize = 1;
        }
    }

    const requiredCrewSize = maxSpecifiedCrew > 0 ? maxSpecifiedCrew : inferredCrewSize;

    return {
        requiredCrewSize,
        minimumCrewSize: Math.max(1, requiredCrewSize - 1),
        maximumCrewSize: requiredCrewSize + 2,
        source,
        laborItems: laborItems.map(item => ({
            description: item.description || item.name,
            crewSize: parseInt(item.crewSize) || 1,
            hours: parseFloat(item.hours) || parseFloat(item.quantity) || 0
        })),
        totalLaborHours,
        requiresMultipleTechs: requiredCrewSize > 1,
        notes
    };
};

/**
 * Build crew requirements object for storing on job document
 * Call this when creating a job from a quote
 * 
 * @param {Object} quote - Quote document
 * @returns {Object} Crew requirements to store on job
 */
export const buildJobCrewRequirements = (quote) => {
    const requirements = extractCrewRequirements(quote.lineItems);

    return {
        crewRequirements: {
            required: requirements.requiredCrewSize,
            minimum: requirements.minimumCrewSize,
            maximum: requirements.maximumCrewSize,
            source: requirements.source,
            requiresMultipleTechs: requirements.requiresMultipleTechs,
            totalLaborHours: requirements.totalLaborHours,
            notes: requirements.notes,
            extractedAt: new Date().toISOString()
        }
    };
};

// ============================================
// CREW ASSIGNMENT VALIDATION
// ============================================

/**
 * Validate that a job's crew assignment meets requirements
 * 
 * @param {Object} job - Job document
 * @returns {Object} Validation result
 */
export const validateCrewAssignment = (job) => {
    const requirements = job.crewRequirements || extractCrewRequirements(job.lineItems);
    const assignedSize = getCrewSize(job);
    const requiredSize = requirements.required || requirements.requiredCrewSize || 1;
    const minimumSize = requirements.minimum || requirements.minimumCrewSize || 1;

    const result = {
        isValid: false,
        status: CREW_VALIDATION_STATUS.UNASSIGNED,
        assignedSize,
        requiredSize,
        minimumSize,
        difference: assignedSize - requiredSize,
        warnings: [],
        errors: []
    };

    if (assignedSize === 0) {
        result.status = CREW_VALIDATION_STATUS.UNASSIGNED;
        result.errors.push(`Job requires ${requiredSize} tech(s) but none assigned`);
        return result;
    }

    if (assignedSize < minimumSize) {
        result.status = CREW_VALIDATION_STATUS.UNDERSTAFFED;
        result.errors.push(`Job requires minimum ${minimumSize} tech(s), only ${assignedSize} assigned`);
        return result;
    }

    if (assignedSize < requiredSize) {
        result.status = CREW_VALIDATION_STATUS.UNDERSTAFFED;
        result.warnings.push(`Job ideally needs ${requiredSize} tech(s), only ${assignedSize} assigned`);
        result.isValid = true; // Valid but with warning
        return result;
    }

    if (assignedSize > (requirements.maximum || requiredSize + 2)) {
        result.status = CREW_VALIDATION_STATUS.OVERSTAFFED;
        result.warnings.push(`Job only needs ${requiredSize} tech(s), ${assignedSize} assigned`);
        result.isValid = true; // Valid but inefficient
        return result;
    }

    result.status = CREW_VALIDATION_STATUS.VALID;
    result.isValid = true;
    return result;
};

/**
 * Check if a proposed crew meets job requirements
 * 
 * @param {Object[]} proposedCrew - Array of crew members
 * @param {Object} job - Job document
 * @returns {Object} Validation result
 */
export const validateProposedCrew = (proposedCrew, job) => {
    const requirements = job.crewRequirements || extractCrewRequirements(job.lineItems);
    const proposedSize = proposedCrew?.length || 0;
    const requiredSize = requirements.required || requirements.requiredCrewSize || 1;
    const minimumSize = requirements.minimum || requirements.minimumCrewSize || 1;

    return {
        isValid: proposedSize >= minimumSize,
        meetsRequirement: proposedSize >= requiredSize,
        proposedSize,
        requiredSize,
        minimumSize,
        shortfall: Math.max(0, requiredSize - proposedSize),
        message: proposedSize >= requiredSize
            ? 'Crew meets requirements'
            : proposedSize >= minimumSize
                ? `Crew is ${requiredSize - proposedSize} tech(s) short of ideal`
                : `Need at least ${minimumSize - proposedSize} more tech(s)`
    };
};

// ============================================
// VEHICLE CAPACITY VALIDATION
// ============================================

/**
 * Check if a vehicle can accommodate the required crew
 * 
 * @param {Object} vehicle - Vehicle document
 * @param {number} crewSize - Number of crew members
 * @returns {Object} Validation result
 */
export const validateVehicleCapacity = (vehicle, crewSize) => {
    if (!vehicle) {
        return {
            isValid: false,
            error: 'No vehicle specified',
            canAccommodate: false
        };
    }

    const passengerCapacity = vehicle.capacity?.passengers || 2;
    const canAccommodate = passengerCapacity >= crewSize;

    return {
        isValid: canAccommodate,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        passengerCapacity,
        crewSize,
        availableSeats: passengerCapacity - crewSize,
        canAccommodate,
        warning: !canAccommodate
            ? `Vehicle "${vehicle.name}" only seats ${passengerCapacity}, crew has ${crewSize} members`
            : null
    };
};

/**
 * Find vehicles that can accommodate a crew size
 * 
 * @param {Object[]} vehicles - Available vehicles
 * @param {number} crewSize - Required crew size
 * @returns {Object[]} Suitable vehicles sorted by best fit
 */
export const findSuitableVehicles = (vehicles, crewSize) => {
    if (!vehicles || vehicles.length === 0) return [];

    return vehicles
        .filter(v => v.status === 'available' || v.status === 'in_use')
        .filter(v => (v.capacity?.passengers || 2) >= crewSize)
        .sort((a, b) => {
            // Sort by closest fit (least wasted capacity)
            const aExtra = (a.capacity?.passengers || 2) - crewSize;
            const bExtra = (b.capacity?.passengers || 2) - crewSize;
            return aExtra - bExtra;
        })
        .map(v => ({
            ...v,
            suitability: {
                fits: true,
                extraSeats: (v.capacity?.passengers || 2) - crewSize,
                utilizationPercent: Math.round((crewSize / (v.capacity?.passengers || 2)) * 100)
            }
        }));
};

// ============================================
// SCHEDULING VALIDATION
// ============================================

/**
 * Validate that enough techs are available on a date for a job
 * 
 * @param {Object} job - Job requiring scheduling
 * @param {Date} date - Proposed date
 * @param {Object[]} availableTechs - All team members
 * @param {Object[]} existingJobs - Already scheduled jobs
 * @param {Object[]} timeOffEntries - Time off entries
 * @returns {Object} Availability validation result
 */
export const validateCrewAvailability = (job, date, availableTechs, existingJobs, timeOffEntries = []) => {
    const requirements = job.crewRequirements || extractCrewRequirements(job.lineItems);
    const requiredSize = requirements.required || requirements.requiredCrewSize || 1;
    const minimumSize = requirements.minimum || requirements.minimumCrewSize || 1;

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dateStr = date.toISOString().split('T')[0];

    // Filter to techs available on this day
    const techsAvailableThisDay = availableTechs.filter(tech => {
        // Check working hours
        const hours = tech.workingHours?.[dayName];
        if (!hours?.enabled) return false;

        // Check time off
        const hasTimeOff = timeOffEntries.some(entry =>
            entry.techId === tech.id &&
            dateStr >= entry.startDate &&
            dateStr <= entry.endDate
        );
        if (hasTimeOff) return false;

        // Check if at capacity
        const techJobsOnDate = existingJobs.filter(j => {
            const jobDate = j.scheduledDate?.toDate?.()
                ? j.scheduledDate.toDate().toISOString().split('T')[0]
                : j.scheduledDate?.split?.('T')?.[0];
            return jobDate === dateStr && getAssignedTechIds(j).includes(tech.id);
        });

        const maxJobs = tech.maxJobsPerDay || 4;
        if (techJobsOnDate.length >= maxJobs) return false;

        return true;
    });

    const availableCount = techsAvailableThisDay.length;
    const canSchedule = availableCount >= minimumSize;
    const meetsIdealCrew = availableCount >= requiredSize;

    return {
        canSchedule,
        meetsIdealCrew,
        availableTechCount: availableCount,
        requiredSize,
        minimumSize,
        shortfall: Math.max(0, minimumSize - availableCount),
        idealShortfall: Math.max(0, requiredSize - availableCount),
        availableTechs: techsAvailableThisDay,
        message: canSchedule
            ? meetsIdealCrew
                ? `${availableCount} techs available, meets requirement of ${requiredSize}`
                : `${availableCount} techs available, job ideally needs ${requiredSize}`
            : `Only ${availableCount} techs available, need at least ${minimumSize}`,
        blockers: !canSchedule ? [{
            type: 'insufficient_crew',
            message: `Need ${minimumSize} techs, only ${availableCount} available on ${dateStr}`
        }] : []
    };
};

// ============================================
// ROUTE OPTIMIZATION HELPERS
// ============================================

/**
 * Get crew requirements for route optimization scoring
 * Jobs requiring multiple techs should be weighted differently
 * 
 * @param {Object} job - Job to evaluate
 * @returns {Object} Crew factors for routing
 */
export const getRouteCrewFactors = (job) => {
    const requirements = job.crewRequirements || extractCrewRequirements(job.lineItems);
    const requiredSize = requirements.required || requirements.requiredCrewSize || 1;
    const currentSize = getCrewSize(job);

    return {
        requiredCrewSize: requiredSize,
        currentCrewSize: currentSize,
        isFullyStaffed: currentSize >= requiredSize,
        isUnderstaffed: currentSize > 0 && currentSize < requiredSize,
        needsMultipleVehicles: requiredSize > 3, // If crew > 3, might need multiple vehicles
        complexityMultiplier: requiredSize > 1 ? 1 + (requiredSize - 1) * 0.25 : 1,
        // Jobs needing more crew should have slight priority to ensure staffing
        schedulingPriority: requiredSize > 2 ? 'high' : requiredSize > 1 ? 'medium' : 'normal'
    };
};

/**
 * Check if a job can be added to a route given crew constraints
 * 
 * @param {Object} job - Job to add
 * @param {Object} route - Existing route with assigned tech(s)
 * @param {Object[]} vehicles - Available vehicles
 * @returns {Object} Compatibility result
 */
export const checkRouteCrewCompatibility = (job, route, vehicles = []) => {
    const jobRequirements = job.crewRequirements || extractCrewRequirements(job.lineItems);
    const requiredSize = jobRequirements.required || jobRequirements.requiredCrewSize || 1;

    // If route has assigned crew, check if it meets this job's requirements
    const routeCrewSize = route.assignedCrew?.length || (route.assignedTechId ? 1 : 0);

    if (routeCrewSize === 0) {
        return {
            compatible: true,
            reason: 'Route has no crew assigned yet',
            crewNeeded: requiredSize
        };
    }

    if (routeCrewSize >= requiredSize) {
        return {
            compatible: true,
            reason: `Route crew of ${routeCrewSize} meets job requirement of ${requiredSize}`,
            crewNeeded: 0
        };
    }

    // Route doesn't have enough crew for this job
    return {
        compatible: false,
        reason: `Route has ${routeCrewSize} tech(s), job requires ${requiredSize}`,
        crewNeeded: requiredSize - routeCrewSize,
        suggestion: `Add ${requiredSize - routeCrewSize} more tech(s) to route or schedule separately`
    };
};

// ============================================
// SUMMARY & REPORTING
// ============================================

/**
 * Generate crew staffing summary for a list of jobs
 * 
 * @param {Object[]} jobs - Jobs to analyze
 * @returns {Object} Staffing summary
 */
export const generateStaffingSummary = (jobs) => {
    const summary = {
        totalJobs: jobs.length,
        fullyStaffed: 0,
        understaffed: 0,
        unassigned: 0,
        overstaffed: 0,
        totalTechsNeeded: 0,
        totalTechsAssigned: 0,
        shortfall: 0,
        jobsByStatus: []
    };

    jobs.forEach(job => {
        const validation = validateCrewAssignment(job);
        summary.totalTechsNeeded += validation.requiredSize;
        summary.totalTechsAssigned += validation.assignedSize;

        switch (validation.status) {
            case CREW_VALIDATION_STATUS.VALID:
                summary.fullyStaffed++;
                break;
            case CREW_VALIDATION_STATUS.UNDERSTAFFED:
                summary.understaffed++;
                summary.shortfall += Math.abs(validation.difference);
                break;
            case CREW_VALIDATION_STATUS.UNASSIGNED:
                summary.unassigned++;
                summary.shortfall += validation.requiredSize;
                break;
            case CREW_VALIDATION_STATUS.OVERSTAFFED:
                summary.overstaffed++;
                break;
        }

        summary.jobsByStatus.push({
            jobId: job.id,
            jobNumber: job.jobNumber,
            title: job.title,
            status: validation.status,
            assignedSize: validation.assignedSize,
            requiredSize: validation.requiredSize,
            warnings: validation.warnings,
            errors: validation.errors
        });
    });

    return summary;
};

// ============================================
// EXPORTS
// ============================================

export default {
    CREW_VALIDATION_STATUS,
    extractCrewRequirements,
    buildJobCrewRequirements,
    validateCrewAssignment,
    validateProposedCrew,
    validateVehicleCapacity,
    findSuitableVehicles,
    validateCrewAvailability,
    getRouteCrewFactors,
    checkRouteCrewCompatibility,
    generateStaffingSummary
};
