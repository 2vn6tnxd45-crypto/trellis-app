// src/features/contractor-pro/hooks/useLiveETA.js
// ============================================
// LIVE ETA TRACKING HOOK
// ============================================
// Priority 2.4: Real-time ETA tracking with auto-updates

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { estimateTravelTime } from '../lib/schedulingEngine';

// ============================================
// LIVE ETA HOOK (for tech mobile app)
// ============================================
/**
 * Hook for techs to broadcast their live location and ETA
 */
export const useLiveETABroadcast = (contractorId, techId, currentJobId) => {
    const [broadcasting, setBroadcasting] = useState(false);
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const watchIdRef = useRef(null);

    // Start broadcasting location
    const startBroadcast = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported');
            return;
        }

        setBroadcasting(true);

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude, speed, heading } = position.coords;
                const newLocation = {
                    lat: latitude,
                    lng: longitude,
                    speed: speed || 0,
                    heading: heading || 0,
                    timestamp: new Date().toISOString()
                };

                setLocation(newLocation);

                // Update job with current location (if we have a job)
                if (contractorId && currentJobId) {
                    try {
                        const jobRef = doc(db, 'contractors', contractorId, 'jobs', currentJobId);
                        await updateDoc(jobRef, {
                            techCurrentLocation: newLocation,
                            techLocationUpdatedAt: serverTimestamp()
                        });
                    } catch (err) {
                        console.error('Error updating tech location:', err);
                    }
                }

                // Also update tech's location in team collection
                if (contractorId && techId) {
                    try {
                        const techRef = doc(db, 'contractors', contractorId, 'team', techId);
                        await updateDoc(techRef, {
                            currentLocation: newLocation,
                            locationUpdatedAt: serverTimestamp()
                        });
                    } catch (err) {
                        console.error('Error updating tech location in team:', err);
                    }
                }
            },
            (err) => {
                console.error('Geolocation error:', err);
                setError(err.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000, // Accept cached position up to 10s old
                timeout: 15000
            }
        );
    }, [contractorId, techId, currentJobId]);

    // Stop broadcasting
    const stopBroadcast = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setBroadcasting(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    return {
        broadcasting,
        location,
        error,
        startBroadcast,
        stopBroadcast
    };
};

// ============================================
// LIVE ETA SUBSCRIPTION HOOK (for dispatch/customer)
// ============================================
/**
 * Hook to subscribe to live ETA updates for a job
 */
export const useLiveETASubscription = (contractorId, jobId) => {
    const [eta, setEta] = useState(null);
    const [techLocation, setTechLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId || !jobId) {
            setLoading(false);
            return;
        }

        // Subscribe to job updates
        const jobRef = doc(db, 'contractors', contractorId, 'jobs', jobId);

        const unsubscribe = onSnapshot(
            jobRef,
            async (snapshot) => {
                if (!snapshot.exists()) {
                    setError('Job not found');
                    setLoading(false);
                    return;
                }

                const job = snapshot.data();
                setTechLocation(job.techCurrentLocation || null);

                // Calculate ETA if tech is en route and we have location data
                if (job.status === 'en_route' && job.techCurrentLocation && job.serviceLocation) {
                    try {
                        const travel = await estimateTravelTime(
                            job.techCurrentLocation,
                            job.serviceLocation
                        );

                        const now = new Date();
                        const arrivalTime = new Date(now.getTime() + travel.durationMinutes * 60000);

                        setEta({
                            arrivalTime: arrivalTime.toISOString(),
                            minutesAway: travel.durationMinutes,
                            distanceMiles: travel.distanceMiles,
                            lastUpdated: job.techLocationUpdatedAt?.toDate?.()?.toISOString() || now.toISOString()
                        });
                    } catch (err) {
                        console.error('ETA calculation error:', err);
                    }
                } else if (job.status === 'on_site' || job.status === 'in_progress') {
                    setEta({
                        arrivalTime: null,
                        minutesAway: 0,
                        arrived: true,
                        lastUpdated: new Date().toISOString()
                    });
                } else if (job.status === 'scheduled') {
                    // Not en route yet, show scheduled time
                    setEta({
                        scheduledTime: `${job.scheduledDate}T${job.scheduledStartTime}`,
                        notStarted: true,
                        lastUpdated: new Date().toISOString()
                    });
                }

                setLoading(false);
            },
            (err) => {
                console.error('Job subscription error:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [contractorId, jobId]);

    return {
        eta,
        techLocation,
        loading,
        error
    };
};

// ============================================
// ETA UPDATE HOOK (for manual updates)
// ============================================
/**
 * Hook for techs to manually update their ETA
 */
export const useETAUpdate = (contractorId) => {
    const [updating, setUpdating] = useState(false);

    // Update ETA manually (e.g., "Running 15 min late")
    const updateETA = useCallback(async (jobId, delayMinutes, reason = '') => {
        if (!contractorId || !jobId) return;

        setUpdating(true);
        try {
            const jobRef = doc(db, 'contractors', contractorId, 'jobs', jobId);

            await updateDoc(jobRef, {
                estimatedDelay: delayMinutes,
                delayReason: reason,
                etaUpdatedAt: serverTimestamp(),
                ...(delayMinutes > 0 ? { status: 'running_late' } : {})
            });

            return { success: true };
        } catch (err) {
            console.error('Error updating ETA:', err);
            throw err;
        } finally {
            setUpdating(false);
        }
    }, [contractorId]);

    // Mark as arrived
    const markArrived = useCallback(async (jobId) => {
        if (!contractorId || !jobId) return;

        setUpdating(true);
        try {
            const jobRef = doc(db, 'contractors', contractorId, 'jobs', jobId);

            await updateDoc(jobRef, {
                status: 'on_site',
                actualArrivalTime: serverTimestamp(),
                estimatedDelay: null
            });

            return { success: true };
        } catch (err) {
            console.error('Error marking arrived:', err);
            throw err;
        } finally {
            setUpdating(false);
        }
    }, [contractorId]);

    return {
        updating,
        updateETA,
        markArrived
    };
};

// ============================================
// CUSTOMER ETA POLLING HOOK
// ============================================
/**
 * Hook for customers to poll for ETA updates (when not using Firebase)
 */
export const useCustomerETAPolling = (jobId, contractorId, token, pollInterval = 30000) => {
    const [eta, setEta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const intervalRef = useRef(null);

    const fetchETA = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                jobId,
                contractorId,
                ...(token && { token })
            });

            const response = await fetch(`/api/customer-eta?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch ETA');
            }

            const data = await response.json();
            setEta(data);
            setError(null);
        } catch (err) {
            console.error('ETA fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [jobId, contractorId, token]);

    // Initial fetch
    useEffect(() => {
        fetchETA();
    }, [fetchETA]);

    // Set up polling
    useEffect(() => {
        intervalRef.current = setInterval(fetchETA, pollInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [fetchETA, pollInterval]);

    // Manual refresh
    const refresh = useCallback(() => {
        setLoading(true);
        fetchETA();
    }, [fetchETA]);

    return {
        eta,
        loading,
        error,
        refresh
    };
};

export default {
    useLiveETABroadcast,
    useLiveETASubscription,
    useETAUpdate,
    useCustomerETAPolling
};
