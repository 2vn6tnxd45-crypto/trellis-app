// src/features/contractor-pro/lib/trackingService.js
// ============================================
// REAL-TIME FIELD TRACKING SERVICE
// ============================================
// Handles GPS tracking, status updates, and geofencing

import { db } from '../../../config/firebase';
import {
    doc,
    updateDoc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';

// ============================================
// CONSTANTS
// ============================================

/**
 * Job status progression for field work
 */
export const FIELD_STATUS = {
    SCHEDULED: 'scheduled',      // Job is scheduled, not started
    EN_ROUTE: 'en_route',        // Tech is traveling to job
    ARRIVED: 'arrived',          // Tech arrived at job site
    WORKING: 'working',          // Tech is actively working
    PAUSED: 'paused',            // Work paused (lunch, parts run, etc.)
    WRAPPING_UP: 'wrapping_up',  // Finishing up, paperwork
    COMPLETED: 'completed',      // Job done
    CANCELLED: 'cancelled'       // Job cancelled
};

/**
 * Status display info
 */
export const STATUS_CONFIG = {
    [FIELD_STATUS.SCHEDULED]: { label: 'Scheduled', color: '#64748B', icon: 'Calendar' },
    [FIELD_STATUS.EN_ROUTE]: { label: 'En Route', color: '#3B82F6', icon: 'Navigation' },
    [FIELD_STATUS.ARRIVED]: { label: 'Arrived', color: '#8B5CF6', icon: 'MapPin' },
    [FIELD_STATUS.WORKING]: { label: 'Working', color: '#F59E0B', icon: 'Wrench' },
    [FIELD_STATUS.PAUSED]: { label: 'Paused', color: '#6B7280', icon: 'Pause' },
    [FIELD_STATUS.WRAPPING_UP]: { label: 'Wrapping Up', color: '#10B981', icon: 'ClipboardCheck' },
    [FIELD_STATUS.COMPLETED]: { label: 'Completed', color: '#10B981', icon: 'CheckCircle' },
    [FIELD_STATUS.CANCELLED]: { label: 'Cancelled', color: '#EF4444', icon: 'XCircle' }
};

/**
 * Geofence radius in meters for arrival detection
 */
export const GEOFENCE_RADIUS = {
    ARRIVAL: 100,    // 100m to trigger "arrived"
    DEPARTURE: 200,  // 200m to trigger "departed"
    NEARBY: 500      // 500m to show "almost there"
};

/**
 * Location update frequency in milliseconds
 */
export const UPDATE_INTERVALS = {
    EN_ROUTE: 30000,   // Every 30 seconds when traveling
    WORKING: 300000,   // Every 5 minutes when on site
    IDLE: 600000       // Every 10 minutes when idle
};

// ============================================
// FIRESTORE PATHS
// ============================================

const TECH_LOCATIONS_PATH = 'techLocations';
const REQUESTS_COLLECTION_PATH = 'artifacts/krib/public/data/requests';

// ============================================
// LOCATION TRACKING
// ============================================

/**
 * Update tech's current location in Firestore
 * @param {string} techId - Technician's user ID
 * @param {string} contractorId - Contractor's ID
 * @param {GeolocationPosition} position - Browser geolocation position
 * @param {Object} additionalData - Extra data like currentJobId, status
 */
export const updateTechLocation = async (techId, contractorId, position, additionalData = {}) => {
    const locationRef = doc(db, TECH_LOCATIONS_PATH, techId);

    const locationData = {
        techId,
        contractorId,
        location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || null,
            speed: position.coords.speed || null
        },
        timestamp: serverTimestamp(),
        clientTimestamp: new Date().toISOString(),
        isOnline: true,
        ...additionalData
    };

    await setDoc(locationRef, locationData, { merge: true });
    return locationData;
};

/**
 * Mark tech as offline (when they close the app/browser)
 */
export const markTechOffline = async (techId) => {
    const locationRef = doc(db, TECH_LOCATIONS_PATH, techId);
    await updateDoc(locationRef, {
        isOnline: false,
        offlineSince: serverTimestamp()
    });
};

/**
 * Get a single tech's current location
 */
export const getTechLocation = async (techId) => {
    const locationRef = doc(db, TECH_LOCATIONS_PATH, techId);
    const snap = await getDoc(locationRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Subscribe to real-time location updates for all techs under a contractor
 * @param {string} contractorId - Contractor's ID
 * @param {Function} callback - Called with array of tech locations
 * @returns {Function} Unsubscribe function
 */
export const subscribeToTechLocations = (contractorId, callback) => {
    const q = query(
        collection(db, TECH_LOCATIONS_PATH),
        where('contractorId', '==', contractorId)
    );

    return onSnapshot(q, (snapshot) => {
        const locations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(locations);
    });
};

/**
 * Subscribe to a single tech's location (for customer tracking)
 */
export const subscribeToSingleTechLocation = (techId, callback) => {
    const locationRef = doc(db, TECH_LOCATIONS_PATH, techId);

    return onSnapshot(locationRef, (snap) => {
        if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() });
        } else {
            callback(null);
        }
    });
};

// ============================================
// GEOFENCING
// ============================================

/**
 * Calculate distance between two points using Haversine formula
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

/**
 * Check if a position is within a geofence
 * @param {Object} currentPos - { lat, lng }
 * @param {Object} targetPos - { lat, lng }
 * @param {number} radiusMeters - Geofence radius
 * @returns {Object} { isInside, distance, approaching }
 */
export const checkGeofence = (currentPos, targetPos, radiusMeters = GEOFENCE_RADIUS.ARRIVAL) => {
    if (!currentPos?.lat || !targetPos?.lat) {
        return { isInside: false, distance: null, approaching: false };
    }

    const distance = haversineDistance(
        currentPos.lat, currentPos.lng,
        targetPos.lat, targetPos.lng
    );

    return {
        isInside: distance <= radiusMeters,
        distance: Math.round(distance),
        distanceMiles: (distance / 1609.34).toFixed(2),
        approaching: distance <= GEOFENCE_RADIUS.NEARBY && distance > radiusMeters
    };
};

/**
 * Auto-detect arrival/departure based on geofence
 * @param {Object} techLocation - Current tech location
 * @param {Object} job - Job with serviceAddress coordinates
 * @param {string} currentStatus - Current job field status
 * @returns {Object|null} Suggested status change or null
 */
export const detectArrivalDeparture = (techLocation, job, currentStatus) => {
    if (!techLocation?.location || !job?.serviceAddress?.coordinates) {
        return null;
    }

    const jobCoords = job.serviceAddress.coordinates;
    const techCoords = techLocation.location;

    const { isInside, distance, approaching } = checkGeofence(
        techCoords,
        jobCoords,
        GEOFENCE_RADIUS.ARRIVAL
    );

    // Detect arrival
    if (currentStatus === FIELD_STATUS.EN_ROUTE && isInside) {
        return {
            suggestedStatus: FIELD_STATUS.ARRIVED,
            reason: 'Arrived at job site',
            distance,
            autoApply: true
        };
    }

    // Detect approaching
    if (currentStatus === FIELD_STATUS.EN_ROUTE && approaching) {
        return {
            notification: 'almost_there',
            reason: `${Math.round(distance)}m away`,
            distance,
            autoApply: false
        };
    }

    // Detect departure (left without completing)
    const departureCheck = checkGeofence(techCoords, jobCoords, GEOFENCE_RADIUS.DEPARTURE);
    if (
        [FIELD_STATUS.ARRIVED, FIELD_STATUS.WORKING, FIELD_STATUS.PAUSED].includes(currentStatus) &&
        !departureCheck.isInside
    ) {
        return {
            suggestedStatus: null,
            warning: 'left_site',
            reason: 'Tech appears to have left the job site',
            distance: departureCheck.distance,
            autoApply: false
        };
    }

    return null;
};

// ============================================
// JOB STATUS UPDATES
// ============================================

/**
 * Update job field status with tracking data
 */
export const updateJobFieldStatus = async (jobId, status, techLocation = null, notes = '') => {
    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    const updateData = {
        fieldStatus: status,
        [`fieldStatusHistory.${status}`]: {
            timestamp: serverTimestamp(),
            location: techLocation?.location || null,
            notes
        },
        lastActivity: serverTimestamp()
    };

    // Add specific timestamps for key statuses
    if (status === FIELD_STATUS.EN_ROUTE) {
        updateData.enRouteAt = serverTimestamp();
    } else if (status === FIELD_STATUS.ARRIVED) {
        updateData.arrivedAt = serverTimestamp();
    } else if (status === FIELD_STATUS.WORKING) {
        updateData.workStartedAt = serverTimestamp();
    } else if (status === FIELD_STATUS.COMPLETED) {
        updateData.completedAt = serverTimestamp();
    }

    await updateDoc(jobRef, updateData);
    return { success: true, status };
};

/**
 * Start traveling to a job (en route)
 */
export const startEnRoute = async (jobId, techId, techLocation) => {
    // Update tech location with current job
    const techLocationRef = doc(db, TECH_LOCATIONS_PATH, techId);
    await updateDoc(techLocationRef, {
        status: 'en_route',
        currentJobId: jobId,
        enRouteStartedAt: serverTimestamp()
    });

    // Update job status
    return updateJobFieldStatus(jobId, FIELD_STATUS.EN_ROUTE, techLocation);
};

/**
 * Mark arrived at job site
 */
export const markArrived = async (jobId, techId, techLocation) => {
    const techLocationRef = doc(db, TECH_LOCATIONS_PATH, techId);
    await updateDoc(techLocationRef, {
        status: 'on_site',
        arrivedAt: serverTimestamp()
    });

    return updateJobFieldStatus(jobId, FIELD_STATUS.ARRIVED, techLocation);
};

/**
 * Start working on job
 */
export const startWorking = async (jobId, techLocation, notes = '') => {
    return updateJobFieldStatus(jobId, FIELD_STATUS.WORKING, techLocation, notes);
};

/**
 * Pause work
 */
export const pauseWork = async (jobId, reason = '') => {
    return updateJobFieldStatus(jobId, FIELD_STATUS.PAUSED, null, reason);
};

/**
 * Complete job
 */
export const completeJob = async (jobId, techId, techLocation, notes = '') => {
    // Update tech status
    const techLocationRef = doc(db, TECH_LOCATIONS_PATH, techId);
    await updateDoc(techLocationRef, {
        status: 'idle',
        currentJobId: null,
        lastCompletedJobId: jobId,
        lastCompletedAt: serverTimestamp()
    });

    return updateJobFieldStatus(jobId, FIELD_STATUS.COMPLETED, techLocation, notes);
};

// ============================================
// ETA CALCULATIONS
// ============================================

/**
 * Calculate live ETA from tech's current location to job
 * @param {Object} techLocation - { location: { lat, lng } }
 * @param {Object} job - Job with serviceAddress
 * @returns {Promise<Object>} ETA information
 */
export const calculateLiveETA = async (techLocation, job) => {
    if (!techLocation?.location || !job?.serviceAddress) {
        return { available: false, reason: 'Missing location data' };
    }

    const origin = techLocation.location;
    const destination = job.serviceAddress.coordinates || job.serviceAddress;

    if (!destination || !destination.lat) {
        return { available: false, reason: 'No job address coordinates' };
    }

    try {
        // Calculate straight-line distance and estimate time
        // In production, this would use Google Distance Matrix API
        const distanceMeters = haversineDistance(
            origin.lat, origin.lng,
            destination.lat, destination.lng
        );

        const distanceMiles = distanceMeters / 1609.34;
        // Estimate ~25 mph average urban speed
        const etaMinutes = Math.round((distanceMiles / 25) * 60);
        const etaTime = new Date(Date.now() + etaMinutes * 60 * 1000);

        return {
            available: true,
            etaMinutes,
            etaTime,
            etaTimeFormatted: etaTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            }),
            distanceMiles: distanceMiles.toFixed(1),
            distanceText: `${distanceMiles.toFixed(1)} mi`,
            durationText: `${etaMinutes} min`,
            hasTrafficData: false, // Would be true with real API
            calculatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('ETA calculation failed:', error);
        return { available: false, reason: error.message };
    }
};

/**
 * Store ETA on job for customer visibility
 */
export const updateJobETA = async (jobId, eta) => {
    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    await updateDoc(jobRef, {
        liveETA: {
            etaMinutes: eta.etaMinutes,
            etaTime: eta.etaTime?.toISOString(),
            distanceMiles: eta.distanceMiles,
            updatedAt: serverTimestamp()
        },
        lastActivity: serverTimestamp()
    });
};

// ============================================
// BROWSER GEOLOCATION HELPERS
// ============================================

/**
 * Check if geolocation is available and permitted
 */
export const checkGeolocationPermission = async () => {
    if (!navigator.geolocation) {
        return { available: false, reason: 'Geolocation not supported' };
    }

    try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return {
            available: true,
            permission: permission.state, // 'granted', 'denied', 'prompt'
            canRequest: permission.state !== 'denied'
        };
    } catch (e) {
        // Permissions API not supported, but geolocation might still work
        return { available: true, permission: 'unknown', canRequest: true };
    }
};

/**
 * Get current position as a Promise
 */
export const getCurrentPosition = (options = {}) => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000,
                ...options
            }
        );
    });
};

/**
 * Start watching position with callback
 * @returns {number} Watch ID for clearing
 */
export const watchPosition = (onUpdate, onError, options = {}) => {
    if (!navigator.geolocation) {
        onError(new Error('Geolocation not supported'));
        return null;
    }

    return navigator.geolocation.watchPosition(
        onUpdate,
        onError,
        {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 10000,
            ...options
        }
    );
};

/**
 * Stop watching position
 */
export const clearWatch = (watchId) => {
    if (watchId != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
    }
};

// ============================================
// EXPORTS
// ============================================

export default {
    // Constants
    FIELD_STATUS,
    STATUS_CONFIG,
    GEOFENCE_RADIUS,
    UPDATE_INTERVALS,

    // Location tracking
    updateTechLocation,
    markTechOffline,
    getTechLocation,
    subscribeToTechLocations,
    subscribeToSingleTechLocation,

    // Geofencing
    checkGeofence,
    detectArrivalDeparture,

    // Job status
    updateJobFieldStatus,
    startEnRoute,
    markArrived,
    startWorking,
    pauseWork,
    completeJob,

    // ETA
    calculateLiveETA,
    updateJobETA,

    // Browser geolocation
    checkGeolocationPermission,
    getCurrentPosition,
    watchPosition,
    clearWatch
};
