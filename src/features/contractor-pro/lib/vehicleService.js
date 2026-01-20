// src/features/contractor-pro/lib/vehicleService.js
// ============================================
// VEHICLE FLEET MANAGEMENT SERVICE
// ============================================
// Firebase service functions for vehicle tracking

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDocs
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

// Vehicle types available
export const VEHICLE_TYPES = [
    { id: 'van', label: 'Van', icon: 'Truck' },
    { id: 'truck', label: 'Truck', icon: 'Truck' },
    { id: 'car', label: 'Car', icon: 'Car' },
    { id: 'suv', label: 'SUV', icon: 'Car' },
    { id: 'trailer', label: 'Trailer', icon: 'Container' }
];

// Equipment that can be assigned to vehicles
export const VEHICLE_EQUIPMENT_OPTIONS = [
    { id: 'ladder', label: 'Ladder', category: 'access' },
    { id: 'extension_ladder', label: 'Extension Ladder', category: 'access' },
    { id: 'scaffolding', label: 'Scaffolding', category: 'access' },
    { id: 'diagnostic_tools', label: 'Diagnostic Tools', category: 'tools' },
    { id: 'power_tools', label: 'Power Tools', category: 'tools' },
    { id: 'hand_tools', label: 'Hand Tool Kit', category: 'tools' },
    { id: 'welding_kit', label: 'Welding Kit', category: 'specialty' },
    { id: 'brazing_kit', label: 'Brazing Kit', category: 'specialty' },
    { id: 'refrigerant_recovery', label: 'Refrigerant Recovery', category: 'hvac' },
    { id: 'vacuum_pump', label: 'Vacuum Pump', category: 'hvac' },
    { id: 'manifold_gauges', label: 'Manifold Gauges', category: 'hvac' },
    { id: 'drain_camera', label: 'Drain Camera', category: 'plumbing' },
    { id: 'drain_snake', label: 'Drain Snake', category: 'plumbing' },
    { id: 'pipe_threader', label: 'Pipe Threader', category: 'plumbing' },
    { id: 'multimeter', label: 'Multimeter', category: 'electrical' },
    { id: 'wire_fish', label: 'Wire Fish/Tape', category: 'electrical' },
    { id: 'generator', label: 'Generator', category: 'power' },
    { id: 'air_compressor', label: 'Air Compressor', category: 'power' },
    { id: 'parts_inventory', label: 'Parts Inventory', category: 'supplies' },
    { id: 'safety_cones', label: 'Safety Cones/Signs', category: 'safety' },
    { id: 'first_aid', label: 'First Aid Kit', category: 'safety' }
];

// Vehicle status options
export const VEHICLE_STATUS = [
    { id: 'available', label: 'Available', color: '#10B981' },
    { id: 'in_use', label: 'In Use', color: '#3B82F6' },
    { id: 'maintenance', label: 'In Maintenance', color: '#F59E0B' },
    { id: 'retired', label: 'Retired', color: '#6B7280' }
];

// Subcollection name
export const VEHICLES_SUBCOLLECTION = 'vehicles';

// ============================================
// VEHICLE SCHEMA (JSDoc for documentation)
// ============================================

/**
 * Vehicle Document Schema
 * Stored at: contractors/{contractorId}/vehicles/{vehicleId}
 *
 * @typedef {Object} Vehicle
 * @property {string} id - Auto-generated document ID
 * @property {string} name - Display name (e.g., "Van #1", "Mike's Truck")
 * @property {string} type - One of VEHICLE_TYPES ids
 * @property {string} licensePlate - License plate number
 * @property {number|null} year - Vehicle year
 * @property {string} make - Vehicle make (e.g., "Ford")
 * @property {string} model - Vehicle model (e.g., "Transit")
 * @property {string} color - Hex color for UI display (e.g., "#3B82F6")
 * @property {Object} capacity
 * @property {number} capacity.passengers - Number of passengers
 * @property {number} capacity.cargoLbs - Cargo capacity in pounds
 * @property {string[]} equipment - Array of equipment IDs from VEHICLE_EQUIPMENT_OPTIONS
 * @property {string|null} defaultTechId - Default assigned technician ID
 * @property {string|null} defaultTechName - Default assigned technician name
 * @property {string} status - One of VEHICLE_STATUS ids
 * @property {Object|null} homeLocation
 * @property {string} homeLocation.address - Address string
 * @property {Object|null} homeLocation.coordinates - {lat, lng}
 * @property {string} notes - General notes about the vehicle
 * @property {string} maintenanceNotes - Maintenance-specific notes
 * @property {Timestamp|null} lastMaintenanceDate - Last maintenance date
 * @property {Timestamp|null} nextMaintenanceDate - Scheduled next maintenance
 * @property {number|null} currentMileage - Current odometer reading
 * @property {number|null} lastMaintenanceMileage - Odometer at last maintenance
 * @property {Timestamp} createdAt - Document creation timestamp
 * @property {Timestamp} updatedAt - Last update timestamp
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the Firestore collection reference for a contractor's vehicles
 */
const getVehiclesCollection = (contractorId) => {
    return collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, VEHICLES_SUBCOLLECTION);
};

/**
 * Get a specific vehicle document reference
 */
const getVehicleDoc = (contractorId, vehicleId) => {
    return doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, VEHICLES_SUBCOLLECTION, vehicleId);
};

/**
 * Generate a default vehicle name based on type and existing count
 */
export const generateVehicleName = (type, existingVehicles = []) => {
    const typeLabel = VEHICLE_TYPES.find(t => t.id === type)?.label || 'Vehicle';
    const sameTypeCount = existingVehicles.filter(v => v.type === type).length;
    return `${typeLabel} #${sameTypeCount + 1}`;
};

/**
 * Generate a random color from a predefined palette
 */
export const generateVehicleColor = () => {
    const colors = [
        '#3B82F6', // Blue
        '#10B981', // Green
        '#F59E0B', // Amber
        '#EF4444', // Red
        '#8B5CF6', // Purple
        '#EC4899', // Pink
        '#06B6D4', // Cyan
        '#84CC16'  // Lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

// ============================================
// CRUD FUNCTIONS
// ============================================

/**
 * Create a new vehicle
 * @param {string} contractorId - The contractor's ID
 * @param {Partial<Vehicle>} vehicleData - Vehicle data (id will be auto-generated)
 * @returns {Promise<Vehicle>} The created vehicle with ID
 */
export async function createVehicle(contractorId, vehicleData) {
    if (!contractorId) throw new Error('Contractor ID is required');
    if (!vehicleData.name?.trim()) throw new Error('Vehicle name is required');

    const vehiclesRef = getVehiclesCollection(contractorId);

    const newVehicle = {
        name: vehicleData.name.trim(),
        type: vehicleData.type || 'van',
        licensePlate: vehicleData.licensePlate?.trim() || '',
        year: vehicleData.year || null,
        make: vehicleData.make?.trim() || '',
        model: vehicleData.model?.trim() || '',
        color: vehicleData.color || generateVehicleColor(),
        capacity: {
            passengers: vehicleData.capacity?.passengers || 2,
            cargoLbs: vehicleData.capacity?.cargoLbs || 1000
        },
        equipment: vehicleData.equipment || [],
        defaultTechId: vehicleData.defaultTechId || null,
        defaultTechName: vehicleData.defaultTechName || null,
        status: vehicleData.status || 'available',
        homeLocation: vehicleData.homeLocation || null,
        notes: vehicleData.notes?.trim() || '',
        maintenanceNotes: vehicleData.maintenanceNotes?.trim() || '',
        lastMaintenanceDate: vehicleData.lastMaintenanceDate || null,
        lastMaintenanceMileage: vehicleData.lastMaintenanceMileage || null,
        nextMaintenanceDate: vehicleData.nextMaintenanceDate || null,
        currentMileage: vehicleData.currentMileage || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(vehiclesRef, newVehicle);

    return {
        id: docRef.id,
        ...newVehicle,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

/**
 * Update an existing vehicle
 * @param {string} contractorId - The contractor's ID
 * @param {string} vehicleId - The vehicle's document ID
 * @param {Partial<Vehicle>} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateVehicle(contractorId, vehicleId, updates) {
    if (!contractorId) throw new Error('Contractor ID is required');
    if (!vehicleId) throw new Error('Vehicle ID is required');

    const vehicleRef = getVehicleDoc(contractorId, vehicleId);

    // Clean up the updates - remove undefined values and add timestamp
    const cleanUpdates = {
        ...updates,
        updatedAt: serverTimestamp()
    };

    // Remove undefined values
    Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === undefined) {
            delete cleanUpdates[key];
        }
    });

    await updateDoc(vehicleRef, cleanUpdates);
}

/**
 * Delete a vehicle
 * @param {string} contractorId - The contractor's ID
 * @param {string} vehicleId - The vehicle's document ID
 * @returns {Promise<void>}
 */
export async function deleteVehicle(contractorId, vehicleId) {
    if (!contractorId) throw new Error('Contractor ID is required');
    if (!vehicleId) throw new Error('Vehicle ID is required');

    const vehicleRef = getVehicleDoc(contractorId, vehicleId);
    await deleteDoc(vehicleRef);
}

/**
 * Get all vehicles for a contractor (one-time fetch)
 * @param {string} contractorId - The contractor's ID
 * @returns {Promise<Vehicle[]>} Array of vehicles
 */
export async function getVehicles(contractorId) {
    if (!contractorId) throw new Error('Contractor ID is required');

    const vehiclesRef = getVehiclesCollection(contractorId);
    const q = query(vehiclesRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Subscribe to real-time vehicle updates
 * @param {string} contractorId - The contractor's ID
 * @param {function} callback - Called with updated vehicles array
 * @returns {function} Unsubscribe function
 */
export function subscribeToVehicles(contractorId, callback) {
    if (!contractorId) {
        console.warn('subscribeToVehicles: No contractor ID provided');
        callback([]);
        return () => {};
    }

    const vehiclesRef = getVehiclesCollection(contractorId);
    const q = query(vehiclesRef, orderBy('name', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const vehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(vehicles);
    }, (error) => {
        console.error('Error subscribing to vehicles:', error);
        callback([]);
    });
}

/**
 * Get a single vehicle by ID
 * @param {string} contractorId - The contractor's ID
 * @param {string} vehicleId - The vehicle's document ID
 * @returns {Promise<Vehicle|null>}
 */
export async function getVehicleById(contractorId, vehicleId) {
    if (!contractorId || !vehicleId) return null;

    const vehicleRef = getVehicleDoc(contractorId, vehicleId);
    const snapshot = await getDoc(vehicleRef);

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}

// ============================================
// AVAILABILITY AND ASSIGNMENT FUNCTIONS
// ============================================

/**
 * Get vehicles available on a specific date
 * Checks against jobs scheduled for that date
 * @param {Vehicle[]} vehicles - All contractor vehicles
 * @param {Date} date - The date to check
 * @param {Object[]} scheduledJobs - Jobs scheduled for that date
 * @returns {Vehicle[]} Available vehicles with busy status
 */
export function getAvailableVehicles(vehicles, date, scheduledJobs = []) {
    // Filter out vehicles that are not available status
    const activeVehicles = vehicles.filter(v =>
        v.status === 'available' || v.status === 'in_use'
    );

    // Get vehicle IDs already assigned to jobs on this date
    const assignedVehicleIds = new Set(
        scheduledJobs
            .filter(job => {
                if (!job.scheduledDate) return false;
                const jobDate = job.scheduledDate.toDate
                    ? job.scheduledDate.toDate()
                    : new Date(job.scheduledDate);
                return jobDate.toDateString() === date.toDateString();
            })
            .map(job => job.assignedVehicleId)
            .filter(Boolean)
    );

    // Return vehicles with busy status indicator
    return activeVehicles.map(vehicle => ({
        ...vehicle,
        isBusy: assignedVehicleIds.has(vehicle.id),
        assignedJobCount: scheduledJobs.filter(j => j.assignedVehicleId === vehicle.id).length
    }));
}

/**
 * Check if assigning a vehicle to a job would create a conflict
 * Returns detailed conflict information for UI display
 *
 * @param {string} vehicleId - Vehicle to check
 * @param {Date} jobDate - The date of the job
 * @param {string} jobStartTime - Start time (HH:MM or ISO)
 * @param {number} jobDurationMinutes - Duration of the job
 * @param {Object[]} scheduledJobs - All jobs scheduled for that day
 * @param {Object} options - Additional options
 * @returns {Object} { hasConflict, conflicts, warnings }
 */
export function checkVehicleConflict(vehicleId, jobDate, jobStartTime, jobDurationMinutes, scheduledJobs = [], options = {}) {
    const conflicts = [];
    const warnings = [];
    const { excludeJobId = null, bufferMinutes = 30 } = options;

    // Filter jobs for this vehicle on this day
    const dateStr = jobDate instanceof Date
        ? jobDate.toISOString().split('T')[0]
        : (jobDate || '').split('T')[0];

    const vehicleJobs = scheduledJobs.filter(job => {
        if (job.assignedVehicleId !== vehicleId) return false;
        if (excludeJobId && job.id === excludeJobId) return false;

        // Check same day
        const jobDateStr = job.scheduledDate instanceof Date
            ? job.scheduledDate.toISOString().split('T')[0]
            : (job.scheduledDate || '').split('T')[0];

        return jobDateStr === dateStr;
    });

    if (vehicleJobs.length === 0) {
        return { hasConflict: false, conflicts, warnings };
    }

    // Parse new job time
    let newJobStart = 0;
    if (typeof jobStartTime === 'string' && jobStartTime.includes(':')) {
        const [h, m] = jobStartTime.split(':').map(Number);
        newJobStart = h * 60 + m;
    }
    const newJobEnd = newJobStart + jobDurationMinutes;

    // Check each existing job for time overlap
    for (const existingJob of vehicleJobs) {
        let exStart = 0;
        if (existingJob.scheduledTime) {
            if (typeof existingJob.scheduledTime === 'string' && existingJob.scheduledTime.includes(':')) {
                const [h, m] = existingJob.scheduledTime.split(':').map(Number);
                exStart = h * 60 + m;
            }
        }

        const exDuration = existingJob.estimatedDuration || 60;
        const exEnd = exStart + (typeof exDuration === 'number' ? exDuration : 60);

        // Check overlap with buffer
        const overlap = !(newJobEnd + bufferMinutes <= exStart || newJobStart >= exEnd + bufferMinutes);

        if (overlap) {
            conflicts.push({
                type: 'time_overlap',
                severity: 'error',
                jobId: existingJob.id,
                jobTitle: existingJob.title || existingJob.serviceType || 'Existing Job',
                scheduledTime: existingJob.scheduledTime,
                message: `Vehicle already assigned to "${existingJob.title || 'another job'}" at this time`
            });
        }
    }

    // Warning if vehicle already has jobs that day (even if no time conflict)
    if (vehicleJobs.length > 0 && conflicts.length === 0) {
        warnings.push({
            type: 'busy_vehicle',
            severity: 'warning',
            jobCount: vehicleJobs.length,
            message: `Vehicle has ${vehicleJobs.length} other job(s) scheduled this day`
        });
    }

    return {
        hasConflict: conflicts.length > 0,
        conflicts,
        warnings,
        existingJobCount: vehicleJobs.length
    };
}

/**
 * Check if a vehicle has the required equipment for a job
 *
 * @param {Vehicle} vehicle - The vehicle to check
 * @param {string[]} requiredEquipment - Equipment IDs needed for the job
 * @returns {Object} { hasAll, missing, warnings }
 */
export function checkVehicleEquipment(vehicle, requiredEquipment = []) {
    if (!requiredEquipment.length) {
        return { hasAll: true, missing: [], warnings: [] };
    }

    const vehicleEquipment = vehicle.equipment || [];
    const missing = requiredEquipment.filter(eq => !vehicleEquipment.includes(eq));

    const warnings = missing.map(eq => {
        const equipmentInfo = VEHICLE_EQUIPMENT_OPTIONS.find(e => e.id === eq);
        return {
            type: 'missing_equipment',
            severity: 'warning',
            equipmentId: eq,
            equipmentLabel: equipmentInfo?.label || eq,
            message: `Vehicle missing: ${equipmentInfo?.label || eq}`
        };
    });

    return {
        hasAll: missing.length === 0,
        missing,
        warnings
    };
}

/**
 * Find the best vehicle for a job based on equipment needs
 * @param {Vehicle[]} vehicles - Available vehicles
 * @param {string[]} requiredEquipment - Equipment IDs needed for the job
 * @param {string|null} preferredTechId - If a tech is assigned, prefer their default vehicle
 * @returns {Vehicle|null} Best matching vehicle or null
 */
export function findBestVehicleForJob(vehicles, requiredEquipment = [], preferredTechId = null) {
    if (!vehicles.length) return null;

    // Score each vehicle
    const scored = vehicles.map(vehicle => {
        let score = 0;

        // Prefer available status
        if (vehicle.status === 'available') score += 10;

        // Match equipment
        const hasEquipment = requiredEquipment.every(eq =>
            vehicle.equipment?.includes(eq)
        );
        if (hasEquipment) score += 50;

        // Partial equipment match
        const equipmentCount = requiredEquipment.filter(eq =>
            vehicle.equipment?.includes(eq)
        ).length;
        score += equipmentCount * 5;

        // Prefer vehicle assigned to the tech
        if (preferredTechId && vehicle.defaultTechId === preferredTechId) {
            score += 30;
        }

        // Prefer less busy vehicles
        if (vehicle.assignedJobCount !== undefined) {
            score -= vehicle.assignedJobCount * 5;
        }

        return { vehicle, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.vehicle || null;
}

/**
 * Assign a vehicle to a job
 * Updates the job document with vehicle information
 * @param {string} jobId - The job document ID
 * @param {string} vehicleId - The vehicle ID to assign
 * @param {string} vehicleName - The vehicle name for display
 * @returns {Promise<void>}
 */
export async function assignVehicleToJob(jobId, vehicleId, vehicleName) {
    if (!jobId) throw new Error('Job ID is required');

    // Import the requests collection path
    const { REQUESTS_COLLECTION_PATH } = await import('../../../config/constants');

    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    await updateDoc(jobRef, {
        assignedVehicleId: vehicleId,
        assignedVehicleName: vehicleName,
        lastActivity: serverTimestamp()
    });
}

/**
 * Remove vehicle assignment from a job
 * @param {string} jobId - The job document ID
 * @returns {Promise<void>}
 */
export async function unassignVehicleFromJob(jobId) {
    if (!jobId) throw new Error('Job ID is required');

    const { REQUESTS_COLLECTION_PATH } = await import('../../../config/constants');

    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    await updateDoc(jobRef, {
        assignedVehicleId: null,
        assignedVehicleName: null,
        lastActivity: serverTimestamp()
    });
}

/**
 * Get equipment requirements for a job type
 * Maps service categories to commonly needed equipment
 * @param {string} category - Job category (e.g., "HVAC", "Plumbing")
 * @returns {string[]} Array of equipment IDs typically needed
 */
export function getEquipmentForJobType(category) {
    const equipmentMap = {
        'HVAC': ['manifold_gauges', 'refrigerant_recovery', 'vacuum_pump', 'multimeter', 'ladder'],
        'Plumbing': ['drain_snake', 'drain_camera', 'pipe_threader', 'hand_tools'],
        'Electrical': ['multimeter', 'wire_fish', 'hand_tools', 'ladder'],
        'Appliance': ['multimeter', 'hand_tools', 'diagnostic_tools'],
        'Roofing': ['ladder', 'extension_ladder', 'safety_cones', 'power_tools'],
        'General': ['hand_tools', 'power_tools', 'ladder']
    };

    return equipmentMap[category] || equipmentMap['General'];
}

// ============================================
// STATISTICS AND REPORTING
// ============================================

/**
 * Get vehicle utilization statistics for a date range
 * @param {Vehicle[]} vehicles - All vehicles
 * @param {Object[]} jobs - Jobs in the date range
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @returns {Object} Utilization stats per vehicle
 */
export function getVehicleUtilization(vehicles, jobs, startDate, endDate) {
    const stats = {};

    vehicles.forEach(vehicle => {
        const vehicleJobs = jobs.filter(job => job.assignedVehicleId === vehicle.id);

        const totalMinutes = vehicleJobs.reduce((sum, job) => {
            const duration = job.estimatedDuration || 120;
            return sum + (typeof duration === 'number' ? duration : 120);
        }, 0);

        const totalRevenue = vehicleJobs.reduce((sum, job) => {
            return sum + (job.total || 0);
        }, 0);

        // Calculate days in range
        const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;

        stats[vehicle.id] = {
            vehicle,
            jobCount: vehicleJobs.length,
            totalMinutes,
            totalHours: Math.round(totalMinutes / 60 * 10) / 10,
            totalRevenue,
            avgJobsPerDay: Math.round(vehicleJobs.length / dayCount * 10) / 10,
            avgHoursPerDay: Math.round((totalMinutes / 60) / dayCount * 10) / 10
        };
    });

    return stats;
}

/**
 * Check if a vehicle needs maintenance based on mileage or date
 * @param {Vehicle} vehicle - The vehicle to check
 * @param {number} maintenanceIntervalMiles - Miles between maintenance (default 5000)
 * @param {number} maintenanceIntervalDays - Days between maintenance (default 90)
 * @returns {Object} Maintenance status
 */
export function checkMaintenanceNeeded(vehicle, maintenanceIntervalMiles = 5000, maintenanceIntervalDays = 90) {
    const result = {
        needed: false,
        reasons: [],
        urgency: 'none' // 'none', 'soon', 'overdue'
    };

    // Check mileage
    if (vehicle.currentMileage && vehicle.lastMaintenanceMileage) {
        const milesSinceService = vehicle.currentMileage - vehicle.lastMaintenanceMileage;
        if (milesSinceService >= maintenanceIntervalMiles) {
            result.needed = true;
            result.reasons.push(`${milesSinceService.toLocaleString()} miles since last service`);
            result.urgency = milesSinceService >= maintenanceIntervalMiles * 1.2 ? 'overdue' : 'soon';
        }
    }

    // Check date
    if (vehicle.lastMaintenanceDate) {
        const lastDate = vehicle.lastMaintenanceDate.toDate
            ? vehicle.lastMaintenanceDate.toDate()
            : new Date(vehicle.lastMaintenanceDate);
        const daysSinceService = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));

        if (daysSinceService >= maintenanceIntervalDays) {
            result.needed = true;
            result.reasons.push(`${daysSinceService} days since last service`);
            if (daysSinceService >= maintenanceIntervalDays * 1.2) {
                result.urgency = 'overdue';
            } else if (result.urgency === 'none') {
                result.urgency = 'soon';
            }
        }
    }

    // Check scheduled maintenance date
    if (vehicle.nextMaintenanceDate) {
        const nextDate = vehicle.nextMaintenanceDate.toDate
            ? vehicle.nextMaintenanceDate.toDate()
            : new Date(vehicle.nextMaintenanceDate);
        const daysUntil = Math.floor((nextDate - new Date()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 0) {
            result.needed = true;
            result.reasons.push('Scheduled maintenance is due');
            result.urgency = 'overdue';
        } else if (daysUntil <= 7) {
            result.reasons.push(`Scheduled maintenance in ${daysUntil} days`);
            if (result.urgency === 'none') result.urgency = 'soon';
        }
    }

    return result;
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
    // Constants
    VEHICLE_TYPES,
    VEHICLE_EQUIPMENT_OPTIONS,
    VEHICLE_STATUS,
    VEHICLES_SUBCOLLECTION,

    // CRUD
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicles,
    getVehicleById,
    subscribeToVehicles,

    // Helpers
    generateVehicleName,
    generateVehicleColor,

    // Availability & Assignment
    getAvailableVehicles,
    findBestVehicleForJob,
    assignVehicleToJob,
    unassignVehicleFromJob,
    getEquipmentForJobType,

    // Conflict & Equipment Checking
    checkVehicleConflict,
    checkVehicleEquipment,

    // Stats
    getVehicleUtilization,
    checkMaintenanceNeeded
};
