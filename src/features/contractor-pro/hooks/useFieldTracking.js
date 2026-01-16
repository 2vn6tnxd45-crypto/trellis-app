// src/features/contractor-pro/hooks/useFieldTracking.js
// ============================================
// FIELD TRACKING HOOK
// ============================================
// React hook for managing tech location tracking

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
    FIELD_STATUS,
    checkGeolocationPermission,
    getCurrentPosition,
    watchPosition,
    clearWatch,
    updateTechLocation,
    markTechOffline,
    subscribeToTechLocations,
    startEnRoute,
    markArrived,
    startWorking,
    pauseWork,
    completeJob,
    calculateLiveETA,
    updateJobETA,
    detectArrivalDeparture
} from '../lib/trackingService';

/**
 * Hook for field technician tracking
 * Use this in the tech's mobile/field view
 *
 * @param {string} techId - Current technician's ID
 * @param {string} contractorId - Contractor's ID
 * @param {Object} currentJob - Current active job (if any)
 */
export const useFieldTracking = (techId, contractorId, currentJob = null) => {
    // Permission state
    const [permissionStatus, setPermissionStatus] = useState('unknown');
    const [isTracking, setIsTracking] = useState(false);
    const [trackingError, setTrackingError] = useState(null);

    // Location state
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationHistory, setLocationHistory] = useState([]);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Job state
    const [fieldStatus, setFieldStatus] = useState(currentJob?.fieldStatus || FIELD_STATUS.SCHEDULED);
    const [currentETA, setCurrentETA] = useState(null);

    // Refs for cleanup
    const watchIdRef = useRef(null);
    const updateIntervalRef = useRef(null);

    // Check permission on mount
    useEffect(() => {
        const checkPermission = async () => {
            const result = await checkGeolocationPermission();
            setPermissionStatus(result.permission || (result.available ? 'available' : 'unavailable'));
        };
        checkPermission();
    }, []);

    // Handle position update
    const handlePositionUpdate = useCallback(async (position) => {
        const locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: new Date().toISOString()
        };

        setCurrentLocation(locationData);
        setLastUpdate(new Date());
        setLocationHistory(prev => [...prev.slice(-99), locationData]); // Keep last 100

        // Update Firestore
        if (techId && contractorId) {
            try {
                await updateTechLocation(techId, contractorId, position, {
                    status: fieldStatus === FIELD_STATUS.EN_ROUTE ? 'en_route' :
                            [FIELD_STATUS.ARRIVED, FIELD_STATUS.WORKING].includes(fieldStatus) ? 'on_site' : 'idle',
                    currentJobId: currentJob?.id || null
                });
            } catch (error) {
                console.error('Failed to update location:', error);
            }
        }

        // Check for auto arrival/departure
        if (currentJob && fieldStatus === FIELD_STATUS.EN_ROUTE) {
            const detection = detectArrivalDeparture(
                { location: locationData },
                currentJob,
                fieldStatus
            );

            if (detection?.autoApply && detection.suggestedStatus === FIELD_STATUS.ARRIVED) {
                toast.success('📍 Arrived at job site!');
                handleMarkArrived();
            } else if (detection?.notification === 'almost_there') {
                toast('🚗 Almost there! ' + detection.reason, { icon: '📍' });
            }
        }

        // Update ETA if en route
        if (currentJob && fieldStatus === FIELD_STATUS.EN_ROUTE) {
            const eta = await calculateLiveETA({ location: locationData }, currentJob);
            if (eta.available) {
                setCurrentETA(eta);
                await updateJobETA(currentJob.id, eta);
            }
        }
    }, [techId, contractorId, fieldStatus, currentJob]);

    // Handle position error
    const handlePositionError = useCallback((error) => {
        console.error('Geolocation error:', error);
        setTrackingError(error.message);

        if (error.code === 1) { // PERMISSION_DENIED
            setPermissionStatus('denied');
            toast.error('Location permission denied. Please enable in browser settings.');
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
            toast.error('Unable to get location. Check GPS settings.');
        } else if (error.code === 3) { // TIMEOUT
            toast.error('Location request timed out.');
        }
    }, []);

    // Start tracking
    const startTracking = useCallback(async () => {
        if (isTracking) return;

        setTrackingError(null);

        try {
            // Get initial position
            const position = await getCurrentPosition();
            handlePositionUpdate(position);

            // Start watching
            const watchId = watchPosition(handlePositionUpdate, handlePositionError);
            watchIdRef.current = watchId;
            setIsTracking(true);
            setPermissionStatus('granted');

            toast.success('📍 Location tracking started');
        } catch (error) {
            handlePositionError(error);
        }
    }, [isTracking, handlePositionUpdate, handlePositionError]);

    // Stop tracking
    const stopTracking = useCallback(async () => {
        if (watchIdRef.current != null) {
            clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }

        setIsTracking(false);

        // Mark offline in Firestore
        if (techId) {
            try {
                await markTechOffline(techId);
            } catch (error) {
                console.error('Failed to mark offline:', error);
            }
        }
    }, [techId]);

    // Status change handlers
    const handleStartEnRoute = useCallback(async () => {
        if (!currentJob?.id || !techId) return;

        try {
            // Ensure tracking is on
            if (!isTracking) {
                await startTracking();
            }

            await startEnRoute(currentJob.id, techId, { location: currentLocation });
            setFieldStatus(FIELD_STATUS.EN_ROUTE);
            toast.success('🚗 Started route to job');

            // Calculate initial ETA
            const eta = await calculateLiveETA({ location: currentLocation }, currentJob);
            if (eta.available) {
                setCurrentETA(eta);
                await updateJobETA(currentJob.id, eta);
                toast(`ETA: ${eta.etaTimeFormatted}`, { icon: '⏱️' });
            }
        } catch (error) {
            console.error('Failed to start en route:', error);
            toast.error('Failed to start route');
        }
    }, [currentJob, techId, currentLocation, isTracking, startTracking]);

    const handleMarkArrived = useCallback(async () => {
        if (!currentJob?.id || !techId) return;

        try {
            await markArrived(currentJob.id, techId, { location: currentLocation });
            setFieldStatus(FIELD_STATUS.ARRIVED);
            setCurrentETA(null);
            toast.success('📍 Marked as arrived');
        } catch (error) {
            console.error('Failed to mark arrived:', error);
            toast.error('Failed to mark arrived');
        }
    }, [currentJob, techId, currentLocation]);

    const handleStartWorking = useCallback(async () => {
        if (!currentJob?.id) return;

        try {
            await startWorking(currentJob.id, { location: currentLocation });
            setFieldStatus(FIELD_STATUS.WORKING);
            toast.success('🔧 Work started');
        } catch (error) {
            console.error('Failed to start working:', error);
            toast.error('Failed to update status');
        }
    }, [currentJob, currentLocation]);

    const handlePauseWork = useCallback(async (reason = '') => {
        if (!currentJob?.id) return;

        try {
            await pauseWork(currentJob.id, reason);
            setFieldStatus(FIELD_STATUS.PAUSED);
            toast('⏸️ Work paused');
        } catch (error) {
            console.error('Failed to pause:', error);
            toast.error('Failed to pause');
        }
    }, [currentJob]);

    const handleCompleteJob = useCallback(async (notes = '') => {
        if (!currentJob?.id || !techId) return;

        try {
            await completeJob(currentJob.id, techId, { location: currentLocation }, notes);
            setFieldStatus(FIELD_STATUS.COMPLETED);
            toast.success('✅ Job completed!');
        } catch (error) {
            console.error('Failed to complete:', error);
            toast.error('Failed to complete job');
        }
    }, [currentJob, techId, currentLocation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopTracking();
        };
    }, [stopTracking]);

    // Update field status when job changes
    useEffect(() => {
        if (currentJob?.fieldStatus) {
            setFieldStatus(currentJob.fieldStatus);
        }
    }, [currentJob?.fieldStatus]);

    return {
        // Permission
        permissionStatus,
        canTrack: permissionStatus !== 'denied' && permissionStatus !== 'unavailable',

        // Tracking state
        isTracking,
        trackingError,
        currentLocation,
        lastUpdate,
        locationHistory,

        // Job state
        fieldStatus,
        currentETA,

        // Actions
        startTracking,
        stopTracking,
        requestPermission: startTracking, // Same effect

        // Status changes
        startEnRoute: handleStartEnRoute,
        markArrived: handleMarkArrived,
        startWorking: handleStartWorking,
        pauseWork: handlePauseWork,
        completeJob: handleCompleteJob
    };
};

/**
 * Hook for dispatch/admin to monitor all tech locations
 * @param {string} contractorId - Contractor's ID
 */
export const useDispatchTracking = (contractorId) => {
    const [techLocations, setTechLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeToTechLocations(contractorId, (locations) => {
            setTechLocations(locations);
            setLoading(false);
        });

        return unsubscribe;
    }, [contractorId]);

    // Get location for a specific tech
    const getTechLocation = useCallback((techId) => {
        return techLocations.find(loc => loc.techId === techId);
    }, [techLocations]);

    // Get all online techs
    const onlineTechs = techLocations.filter(loc => loc.isOnline);

    // Get techs by status
    const techsByStatus = {
        enRoute: techLocations.filter(loc => loc.status === 'en_route'),
        onSite: techLocations.filter(loc => loc.status === 'on_site'),
        idle: techLocations.filter(loc => loc.status === 'idle')
    };

    return {
        techLocations,
        loading,
        getTechLocation,
        onlineTechs,
        techsByStatus,
        totalOnline: onlineTechs.length
    };
};

export default useFieldTracking;
