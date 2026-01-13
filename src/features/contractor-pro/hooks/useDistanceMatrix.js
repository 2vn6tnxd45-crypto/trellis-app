// src/features/contractor-pro/hooks/useDistanceMatrix.js
// ============================================
// DISTANCE MATRIX HOOK
// ============================================
// React hook for calculating travel times between jobs

import { useState, useCallback, useMemo } from 'react';
import {
    getDistance,
    getDistanceMatrix,
    optimizeRoute,
    getTravelTimeBetweenJobs
} from '../lib/distanceMatrixService';

/**
 * Hook for calculating distances and travel times
 * @param {Object} homeBase - Contractor's home base with address and/or coordinates
 * @returns {Object} Distance calculation utilities
 */
export const useDistanceMatrix = (homeBase) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get distance between two points
    const calculateDistance = useCallback(async (origin, destination, options = {}) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getDistance(origin, destination, options);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Get travel time from home base to a location
    const getDistanceFromHome = useCallback(async (destination, options = {}) => {
        if (!homeBase?.address && !homeBase?.coordinates) {
            return {
                status: 'NO_HOME_BASE',
                distanceMiles: 0,
                durationMinutes: 0,
                isFallback: true
            };
        }

        const origin = homeBase.coordinates
            ? { lat: homeBase.coordinates.lat, lng: homeBase.coordinates.lng }
            : homeBase.address;

        return calculateDistance(origin, destination, options);
    }, [homeBase, calculateDistance]);

    // Get travel time between two jobs
    const getDistanceBetweenJobs = useCallback(async (job1, job2, options = {}) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getTravelTimeBetweenJobs(job1, job2, options);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Calculate optimal route for a day's jobs
    const calculateOptimalRoute = useCallback(async (jobs, options = {}) => {
        if (!jobs || jobs.length === 0) {
            return { orderedJobs: [], totalDistance: 0, totalDuration: 0, legs: [] };
        }

        if (!homeBase?.address && !homeBase?.coordinates) {
            // Without home base, return jobs in original order
            return {
                orderedJobs: jobs,
                totalDistance: 0,
                totalDuration: 0,
                legs: [],
                warning: 'No home base configured'
            };
        }

        setLoading(true);
        setError(null);
        try {
            const startPoint = homeBase.coordinates
                ? { lat: homeBase.coordinates.lat, lng: homeBase.coordinates.lng, address: homeBase.address }
                : { address: homeBase.address };

            const result = await optimizeRoute(jobs, startPoint, options);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [homeBase]);

    // Get distance matrix for multiple jobs
    const getJobDistanceMatrix = useCallback(async (jobs, options = {}) => {
        if (!jobs || jobs.length < 2) {
            return [];
        }

        setLoading(true);
        setError(null);
        try {
            // Get locations for all jobs
            const locations = jobs.map(job => {
                if (job.serviceAddress?.coordinates) {
                    return { lat: job.serviceAddress.coordinates.lat, lng: job.serviceAddress.coordinates.lng };
                }
                return job.serviceAddress?.formatted || job.customer?.address || '';
            });

            // Add home base as first point if available
            const origins = homeBase?.address || homeBase?.coordinates
                ? [homeBase.coordinates || homeBase.address, ...locations]
                : locations;

            const matrix = await getDistanceMatrix(origins, origins, options);
            return matrix;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [homeBase]);

    // Calculate total route time for an ordered list of jobs
    const calculateRouteTime = useCallback(async (orderedJobs, options = {}) => {
        if (!orderedJobs || orderedJobs.length === 0) {
            return { totalDuration: 0, legs: [] };
        }

        setLoading(true);
        setError(null);
        try {
            const legs = [];
            let totalDuration = 0;
            let totalDistance = 0;

            // First leg: home to first job
            if (homeBase?.address || homeBase?.coordinates) {
                const firstLeg = await getDistanceFromHome(
                    orderedJobs[0].serviceAddress?.formatted ||
                    orderedJobs[0].customer?.address,
                    options
                );
                legs.push({ from: 'Home', to: orderedJobs[0], ...firstLeg });
                totalDuration += firstLeg.durationMinutes || 0;
                totalDistance += firstLeg.distanceMiles || 0;
            }

            // Subsequent legs: job to job
            for (let i = 0; i < orderedJobs.length - 1; i++) {
                const leg = await getDistanceBetweenJobs(orderedJobs[i], orderedJobs[i + 1], options);
                legs.push({ from: orderedJobs[i], to: orderedJobs[i + 1], ...leg });
                totalDuration += leg.durationMinutes || 0;
                totalDistance += leg.distanceMiles || 0;
            }

            return { totalDuration, totalDistance, legs };
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [homeBase, getDistanceFromHome, getDistanceBetweenJobs]);

    return {
        // State
        loading,
        error,

        // Single distance
        calculateDistance,
        getDistanceFromHome,
        getDistanceBetweenJobs,

        // Route optimization
        calculateOptimalRoute,
        calculateRouteTime,

        // Matrix
        getJobDistanceMatrix
    };
};

export default useDistanceMatrix;
