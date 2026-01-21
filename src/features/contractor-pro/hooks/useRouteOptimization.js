// src/features/contractor-pro/hooks/useRouteOptimization.js
// ============================================
// ROUTE OPTIMIZATION HOOK
// ============================================
// React hook for route optimization with caching and state management

import { useState, useCallback, useMemo, useRef } from 'react';
import {
    optimizeRoute,
    compareRoutes,
    findBestDepartureTime,
    multiVehicleOptimize,
    parseTimeWindow,
    TIME_WINDOW_TYPES
} from '../lib/routeOptimizer';

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// MAIN HOOK
// ============================================

export const useRouteOptimization = (options = {}) => {
    const {
        defaultStartLocation = null,
        defaultEndLocation = null,
        defaultDepartureTime = '08:00',
        enableCaching = true
    } = options;

    // State
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [lastOptimization, setLastOptimization] = useState(null);
    const [error, setError] = useState(null);

    // Cache ref
    const cacheRef = useRef(new Map());

    // ============================================
    // CACHE HELPERS
    // ============================================

    const getCacheKey = useCallback((jobs, startLoc, endLoc, departure) => {
        const jobIds = jobs.map(j => j.id || j._id).sort().join(',');
        return `${jobIds}-${startLoc?.lat}-${startLoc?.lng}-${endLoc?.lat}-${endLoc?.lng}-${departure}`;
    }, []);

    const getFromCache = useCallback((key) => {
        if (!enableCaching) return null;
        const cached = cacheRef.current.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            cacheRef.current.delete(key);
            return null;
        }
        return cached.data;
    }, [enableCaching]);

    const setInCache = useCallback((key, data) => {
        if (!enableCaching) return;
        cacheRef.current.set(key, { data, timestamp: Date.now() });

        // Cleanup old entries
        if (cacheRef.current.size > 50) {
            const now = Date.now();
            for (const [k, v] of cacheRef.current.entries()) {
                if (now - v.timestamp > CACHE_TTL) {
                    cacheRef.current.delete(k);
                }
            }
        }
    }, [enableCaching]);

    const clearCache = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    // ============================================
    // OPTIMIZE DAY ROUTE
    // ============================================

    const optimizeDayRoute = useCallback(async (jobs, opts = {}) => {
        const {
            startLocation = defaultStartLocation,
            endLocation = defaultEndLocation,
            departureTime = defaultDepartureTime,
            weights = {},
            skipCache = false
        } = opts;

        if (!jobs || jobs.length === 0) {
            return { route: [], arrivals: [], stats: { totalTravelTime: 0 } };
        }

        // Check cache
        const cacheKey = getCacheKey(jobs, startLocation, endLocation, departureTime);
        if (!skipCache) {
            const cached = getFromCache(cacheKey);
            if (cached) {
                setLastOptimization(cached);
                return cached;
            }
        }

        setIsOptimizing(true);
        setError(null);

        try {
            const result = optimizeRoute(jobs, {
                startLocation,
                endLocation,
                departureTime,
                weights
            });

            const optimizationResult = {
                route: result.route,
                arrivals: result.arrivals,
                stats: result.stats,
                originalOrder: jobs,
                optimizedAt: new Date().toISOString()
            };

            setInCache(cacheKey, optimizationResult);
            setLastOptimization(optimizationResult);
            return optimizationResult;
        } catch (err) {
            console.error('Route optimization failed:', err);
            setError(err.message);
            // Return original order on error
            return {
                route: jobs,
                arrivals: [],
                stats: { totalTravelTime: 0 },
                error: err.message
            };
        } finally {
            setIsOptimizing(false);
        }
    }, [defaultStartLocation, defaultEndLocation, defaultDepartureTime, getCacheKey, getFromCache, setInCache]);

    // ============================================
    // COMPARE WITH OPTIMIZED
    // ============================================

    const compareWithOptimized = useCallback(async (currentRoute, opts = {}) => {
        const {
            startLocation = defaultStartLocation,
            endLocation = defaultEndLocation,
            departureTime = defaultDepartureTime,
            weights = {}
        } = opts;

        if (!currentRoute || currentRoute.length === 0) {
            return {
                currentRoute: [],
                optimizedRoute: [],
                comparison: { timeSavedMinutes: 0, percentImprovement: 0, recommendation: 'none' },
                currentArrivals: [],
                optimizedArrivals: [],
                currentStats: { totalTravelTime: 0 },
                optimizedStats: { totalTravelTime: 0 }
            };
        }

        setIsOptimizing(true);
        setError(null);

        try {
            // Get optimized route
            const optimized = optimizeRoute(currentRoute, {
                startLocation,
                endLocation,
                departureTime,
                weights
            });

            // Compare routes
            const comparison = compareRoutes(
                currentRoute,
                optimized.route,
                startLocation,
                endLocation,
                departureTime
            );

            // Calculate arrivals for current route
            const currentArrivals = calculateArrivals(currentRoute, startLocation, departureTime);

            return {
                currentRoute,
                optimizedRoute: optimized.route,
                comparison,
                currentArrivals,
                optimizedArrivals: optimized.arrivals,
                currentStats: comparison.routeAStats,
                optimizedStats: comparison.routeBStats
            };
        } catch (err) {
            console.error('Route comparison failed:', err);
            setError(err.message);
            return {
                currentRoute,
                optimizedRoute: currentRoute,
                comparison: { timeSavedMinutes: 0, percentImprovement: 0, recommendation: 'A' },
                error: err.message
            };
        } finally {
            setIsOptimizing(false);
        }
    }, [defaultStartLocation, defaultEndLocation, defaultDepartureTime]);

    // ============================================
    // OPTIMIZE MULTI-VEHICLE
    // ============================================

    const optimizeMultiVehicle = useCallback(async (jobs, vehicles, opts = {}) => {
        const {
            startLocation = defaultStartLocation,
            departureTime = defaultDepartureTime,
            maxJobsPerVehicle = 8,
            balanceWorkload = true
        } = opts;

        if (!jobs || jobs.length === 0 || !vehicles || vehicles.length === 0) {
            return { assignments: [], unassigned: jobs || [] };
        }

        setIsOptimizing(true);
        setError(null);

        try {
            // Parse departure time to minutes from midnight
            const startTimeMinutes = departureTime
                ? parseInt(departureTime.split(':')[0]) * 60 + parseInt(departureTime.split(':')[1] || 0)
                : 480; // Default 8 AM

            // Call multiVehicleOptimize with correct signature
            const result = await multiVehicleOptimize(
                jobs,
                vehicles,
                startLocation,    // startPoint
                startTimeMinutes, // startTime in minutes
                null,            // distanceMatrix (will be calculated)
                {
                    maxJobsPerVehicle,
                    balanceWorkload
                }
            );

            // Transform result for UI consumption
            const transformedAssignments = result.assignments
                ? Object.entries(result.assignments)
                    .filter(([_, a]) => a.jobs && a.jobs.length > 0)
                    .map(([vehicleId, assignment]) => ({
                        vehicleId,
                        vehicleName: assignment.vehicle?.name || `Vehicle ${vehicleId}`,
                        route: assignment.jobs,
                        totalTime: assignment.totalTime || 0,
                        arrivals: assignment.arrivals || [],
                        crewWarnings: assignment.crewWarnings || [],
                        requiredCrewSize: assignment.requiredCrewSize || 1,
                        currentCrewSize: assignment.currentCrewSize || 1
                    }))
                : [];

            return {
                assignments: transformedAssignments,
                unassigned: result.unassigned || [],
                stats: result.stats || {},
                crewWarnings: result.crewWarnings || []
            };
        } catch (err) {
            console.error('Multi-vehicle optimization failed:', err);
            setError(err.message);
            return {
                assignments: [],
                unassigned: jobs,
                error: err.message
            };
        } finally {
            setIsOptimizing(false);
        }
    }, [defaultStartLocation, defaultDepartureTime]);

    // ============================================
    // FIND OPTIMAL DEPARTURE
    // ============================================

    const findOptimalDeparture = useCallback(async (jobs, opts = {}) => {
        const {
            startLocation = defaultStartLocation,
            endLocation = defaultEndLocation,
            startTimeRange = { start: '06:00', end: '10:00' },
            intervalMinutes = 15
        } = opts;

        if (!jobs || jobs.length === 0) {
            return { bestDeparture: '08:00', results: [] };
        }

        setIsOptimizing(true);
        setError(null);

        try {
            const result = findBestDepartureTime(jobs, {
                startLocation,
                endLocation,
                startTimeRange,
                intervalMinutes
            });

            return result;
        } catch (err) {
            console.error('Departure optimization failed:', err);
            setError(err.message);
            return {
                bestDeparture: '08:00',
                results: [],
                error: err.message
            };
        } finally {
            setIsOptimizing(false);
        }
    }, [defaultStartLocation, defaultEndLocation]);

    // ============================================
    // ANALYZE TIME WINDOWS
    // ============================================

    const analyzeTimeWindows = useCallback((jobs) => {
        if (!jobs || jobs.length === 0) {
            return {
                total: 0,
                byType: { hard: 0, soft: 0, flexible: 0, none: 0 },
                hardConstraints: [],
                recommendations: []
            };
        }

        const analysis = {
            total: jobs.length,
            byType: { hard: 0, soft: 0, flexible: 0, none: 0 },
            hardConstraints: [],
            recommendations: []
        };

        jobs.forEach(job => {
            const tw = parseTimeWindow(job);
            if (!tw) {
                analysis.byType.none++;
                return;
            }

            const type = tw.type || 'flexible';
            analysis.byType[type] = (analysis.byType[type] || 0) + 1;

            if (type === 'hard') {
                analysis.hardConstraints.push({
                    job,
                    window: tw,
                    windowStr: `${tw.start} - ${tw.end}`
                });
            }
        });

        // Generate recommendations
        if (analysis.byType.hard > 3) {
            analysis.recommendations.push({
                type: 'warning',
                message: 'Many hard time windows may limit optimization effectiveness'
            });
        }

        if (analysis.byType.none > analysis.total * 0.7) {
            analysis.recommendations.push({
                type: 'info',
                message: 'Consider adding preferred time windows for better customer communication'
            });
        }

        const sortedHard = [...analysis.hardConstraints].sort((a, b) => {
            const aStart = parseInt(a.window.start.replace(':', ''));
            const bStart = parseInt(b.window.start.replace(':', ''));
            return aStart - bStart;
        });

        // Check for overlapping hard constraints
        for (let i = 0; i < sortedHard.length - 1; i++) {
            const curr = sortedHard[i];
            const next = sortedHard[i + 1];
            const currEnd = parseInt(curr.window.end.replace(':', ''));
            const nextStart = parseInt(next.window.start.replace(':', ''));

            if (currEnd > nextStart) {
                analysis.recommendations.push({
                    type: 'error',
                    message: `Time conflict: ${curr.job.title || 'Job'} and ${next.job.title || 'Job'} have overlapping windows`
                });
            }
        }

        return analysis;
    }, []);

    // ============================================
    // RETURN VALUES
    // ============================================

    return {
        // State
        isOptimizing,
        lastOptimization,
        error,

        // Core functions
        optimizeDayRoute,
        compareWithOptimized,
        optimizeMultiVehicle,
        findOptimalDeparture,
        analyzeTimeWindows,

        // Cache management
        clearCache
    };
};

// ============================================
// HELPER: CALCULATE ARRIVALS
// ============================================

const calculateArrivals = (route, startLocation, departureTime) => {
    if (!route || route.length === 0) return [];

    const arrivals = [];
    let currentTime = parseTimeToMinutes(departureTime);
    let prevLocation = startLocation;

    route.forEach((job, idx) => {
        // Estimate travel time (simplified - would use real distance API in production)
        const jobLocation = job.location || job.address;
        const travelTime = estimateTravelTime(prevLocation, jobLocation);

        currentTime += travelTime;

        arrivals.push({
            job,
            arrivalMinutes: currentTime,
            arrivalTimeStr: minutesToTimeStr(currentTime),
            travelTimeFromPrev: travelTime,
            stopNumber: idx + 1
        });

        // Add job duration
        currentTime += job.duration || job.estimatedDuration || 60;
        prevLocation = jobLocation;
    });

    return arrivals;
};

const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 480; // Default 8:00 AM
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
};

const minutesToTimeStr = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs > 12 ? hrs - 12 : hrs === 0 ? 12 : hrs;
    return `${displayHrs}:${mins.toString().padStart(2, '0')} ${period}`;
};

const estimateTravelTime = (from, to) => {
    // Simplified estimation - would use Distance Matrix API in production
    if (!from || !to) return 15;

    // If both have coordinates, calculate rough distance
    if (from.lat && from.lng && to.lat && to.lng) {
        const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
        // Assume average 30mph in urban areas
        return Math.round(distance / 30 * 60);
    }

    // Default estimate
    return 15;
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export default useRouteOptimization;
