// src/features/contractor-pro/lib/distanceMatrixService.js
// ============================================
// GOOGLE DISTANCE MATRIX SERVICE
// ============================================
// Provides real travel time and distance calculations using Google Distance Matrix API
// Includes caching to minimize API calls

import { googleMapsApiKey } from '../../../config/constants';

// ============================================
// CACHE CONFIGURATION
// ============================================

// In-memory cache for distance results
// Key format: "origin_lat,origin_lng|dest_lat,dest_lng" or "origin_address|dest_address"
const distanceCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Generate cache key from origin and destination
 */
const getCacheKey = (origin, destination) => {
    const originStr = typeof origin === 'string'
        ? origin.toLowerCase().trim()
        : `${origin.lat},${origin.lng}`;
    const destStr = typeof destination === 'string'
        ? destination.toLowerCase().trim()
        : `${destination.lat},${destination.lng}`;
    return `${originStr}|${destStr}`;
};

/**
 * Get cached result if available and not expired
 */
const getCachedResult = (key) => {
    const cached = distanceCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    // Clean up expired entry
    if (cached) {
        distanceCache.delete(key);
    }
    return null;
};

/**
 * Store result in cache
 */
const setCachedResult = (key, data) => {
    distanceCache.set(key, {
        data,
        timestamp: Date.now()
    });
};

// ============================================
// DISTANCE MATRIX API
// ============================================

/**
 * Get travel distance and duration between two points using Google Distance Matrix API
 * @param {string|{lat: number, lng: number}} origin - Starting point (address string or coordinates)
 * @param {string|{lat: number, lng: number}} destination - Ending point (address string or coordinates)
 * @param {Object} options - Additional options
 * @param {string} options.mode - Travel mode: 'driving' (default), 'walking', 'bicycling', 'transit'
 * @param {boolean} options.avoidHighways - Avoid highways
 * @param {boolean} options.avoidTolls - Avoid toll roads
 * @param {Date} options.departureTime - Departure time for traffic-based estimates
 * @returns {Promise<{distance: {value: number, text: string}, duration: {value: number, text: string}, durationInTraffic?: {value: number, text: string}, status: string}>}
 */
export const getDistance = async (origin, destination, options = {}) => {
    if (!googleMapsApiKey) {
        console.warn('Google Maps API key not configured');
        return getFallbackDistance(origin, destination);
    }

    // Check cache first
    const cacheKey = getCacheKey(origin, destination);
    const cached = getCachedResult(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        // Format origin and destination
        const originStr = typeof origin === 'string'
            ? encodeURIComponent(origin)
            : `${origin.lat},${origin.lng}`;
        const destStr = typeof destination === 'string'
            ? encodeURIComponent(destination)
            : `${destination.lat},${destination.lng}`;

        // Build URL with options
        let url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${googleMapsApiKey}`;

        if (options.mode) {
            url += `&mode=${options.mode}`;
        }
        if (options.avoidHighways) {
            url += '&avoid=highways';
        }
        if (options.avoidTolls) {
            url += '&avoid=tolls';
        }
        if (options.departureTime) {
            const timestamp = Math.floor(options.departureTime.getTime() / 1000);
            url += `&departure_time=${timestamp}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
            const element = data.rows[0].elements[0];
            const result = {
                distance: element.distance, // { value: meters, text: "X mi" }
                duration: element.duration, // { value: seconds, text: "X mins" }
                durationInTraffic: element.duration_in_traffic, // Only with departure_time
                status: 'OK',
                // Add convenience conversions
                distanceMiles: element.distance.value / 1609.34,
                durationMinutes: Math.ceil(element.duration.value / 60),
                durationInTrafficMinutes: element.duration_in_traffic
                    ? Math.ceil(element.duration_in_traffic.value / 60)
                    : null
            };

            // Cache the result
            setCachedResult(cacheKey, result);
            return result;
        }

        // API returned an error status
        console.warn('Distance Matrix API error:', data.status, data.error_message);
        return getFallbackDistance(origin, destination);

    } catch (error) {
        console.error('Distance Matrix API request failed:', error);
        return getFallbackDistance(origin, destination);
    }
};

/**
 * Get distances for multiple origin-destination pairs in a single API call
 * @param {Array<string|{lat: number, lng: number}>} origins - Array of starting points
 * @param {Array<string|{lat: number, lng: number}>} destinations - Array of ending points
 * @param {Object} options - Same as getDistance options
 * @returns {Promise<Array<Array<{distance, duration, status}>>>} - Matrix of results [origin][destination]
 */
export const getDistanceMatrix = async (origins, destinations, options = {}) => {
    if (!googleMapsApiKey || origins.length === 0 || destinations.length === 0) {
        // Return fallback matrix
        return origins.map(origin =>
            destinations.map(dest => getFallbackDistance(origin, dest))
        );
    }

    // Check if all pairs are cached
    const allCached = origins.every((origin, i) =>
        destinations.every((dest, j) => {
            const key = getCacheKey(origin, dest);
            return getCachedResult(key) !== null;
        })
    );

    if (allCached) {
        return origins.map(origin =>
            destinations.map(dest => {
                const key = getCacheKey(origin, dest);
                return getCachedResult(key);
            })
        );
    }

    try {
        // Format origins and destinations
        const originsStr = origins.map(o =>
            typeof o === 'string' ? encodeURIComponent(o) : `${o.lat},${o.lng}`
        ).join('|');

        const destsStr = destinations.map(d =>
            typeof d === 'string' ? encodeURIComponent(d) : `${d.lat},${d.lng}`
        ).join('|');

        let url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destsStr}&key=${googleMapsApiKey}`;

        if (options.mode) url += `&mode=${options.mode}`;
        if (options.avoidHighways) url += '&avoid=highways';
        if (options.avoidTolls) url += '&avoid=tolls';
        if (options.departureTime) {
            url += `&departure_time=${Math.floor(options.departureTime.getTime() / 1000)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK') {
            const matrix = data.rows.map((row, i) =>
                row.elements.map((element, j) => {
                    if (element.status === 'OK') {
                        const result = {
                            distance: element.distance,
                            duration: element.duration,
                            durationInTraffic: element.duration_in_traffic,
                            status: 'OK',
                            distanceMiles: element.distance.value / 1609.34,
                            durationMinutes: Math.ceil(element.duration.value / 60),
                            durationInTrafficMinutes: element.duration_in_traffic
                                ? Math.ceil(element.duration_in_traffic.value / 60)
                                : null
                        };

                        // Cache each result
                        const key = getCacheKey(origins[i], destinations[j]);
                        setCachedResult(key, result);

                        return result;
                    }
                    return getFallbackDistance(origins[i], destinations[j]);
                })
            );

            return matrix;
        }

        console.warn('Distance Matrix API error:', data.status);
        return origins.map(origin =>
            destinations.map(dest => getFallbackDistance(origin, dest))
        );

    } catch (error) {
        console.error('Distance Matrix API request failed:', error);
        return origins.map(origin =>
            destinations.map(dest => getFallbackDistance(origin, dest))
        );
    }
};

// ============================================
// FALLBACK CALCULATIONS
// ============================================

/**
 * Fallback distance calculation using Haversine formula
 * Used when API is unavailable or for rough estimates
 */
const getFallbackDistance = (origin, destination) => {
    // If we have coordinates, use Haversine
    if (typeof origin === 'object' && typeof destination === 'object' &&
        origin.lat && origin.lng && destination.lat && destination.lng) {
        const miles = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
        const minutes = estimateDrivingTime(miles);

        return {
            distance: { value: Math.round(miles * 1609.34), text: `${miles.toFixed(1)} mi` },
            duration: { value: minutes * 60, text: `${minutes} mins` },
            status: 'FALLBACK',
            distanceMiles: miles,
            durationMinutes: minutes,
            isFallback: true
        };
    }

    // If we only have addresses/zip codes, use rough estimate
    const roughMiles = estimateDistanceFromAddresses(origin, destination);
    const roughMinutes = estimateDrivingTime(roughMiles);

    return {
        distance: { value: Math.round(roughMiles * 1609.34), text: `~${roughMiles} mi` },
        duration: { value: roughMinutes * 60, text: `~${roughMinutes} mins` },
        status: 'ESTIMATE',
        distanceMiles: roughMiles,
        durationMinutes: roughMinutes,
        isFallback: true,
        isEstimate: true
    };
};

/**
 * Haversine formula for calculating distance between two coordinates
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Estimate driving time from distance
 * Accounts for average speeds in different distance ranges
 */
const estimateDrivingTime = (miles) => {
    if (miles <= 5) {
        // City driving: ~20 mph average
        return Math.ceil(miles * 3);
    } else if (miles <= 20) {
        // Mixed: ~25 mph average
        return Math.ceil(miles * 2.4);
    } else {
        // Highway: ~35 mph average (accounting for some traffic)
        return Math.ceil(miles * 1.7);
    }
};

/**
 * Rough estimate based on zip code/address comparison
 * Used when we don't have coordinates
 */
const estimateDistanceFromAddresses = (origin, destination) => {
    if (typeof origin !== 'string' || typeof destination !== 'string') {
        return 15; // Default 15 miles
    }

    // Extract zip codes if present
    const originZip = origin.match(/\b\d{5}\b/)?.[0];
    const destZip = destination.match(/\b\d{5}\b/)?.[0];

    if (originZip && destZip) {
        // Same zip code
        if (originZip === destZip) return 3;
        // Same first 3 digits (same region)
        if (originZip.substring(0, 3) === destZip.substring(0, 3)) return 8;
        // Same first 2 digits (same area)
        if (originZip.substring(0, 2) === destZip.substring(0, 2)) return 15;
        // Different area
        return 25;
    }

    // Check if same city/state mentioned
    const originLower = origin.toLowerCase();
    const destLower = destination.toLowerCase();

    // Extract city names (simplified)
    const originCity = originLower.split(',')[1]?.trim();
    const destCity = destLower.split(',')[1]?.trim();

    if (originCity && destCity && originCity === destCity) {
        return 8;
    }

    return 15; // Default
};

// ============================================
// ROUTE OPTIMIZATION HELPERS
// ============================================

/**
 * Calculate optimal route order for a list of jobs
 * Uses nearest-neighbor algorithm with real distances
 * @param {Array} jobs - Array of jobs with coordinates
 * @param {{lat: number, lng: number, address: string}} startPoint - Starting location
 * @param {Object} options - Options for distance calculation
 * @returns {Promise<{orderedJobs: Array, totalDistance: number, totalDuration: number, legs: Array}>}
 */
export const optimizeRoute = async (jobs, startPoint, options = {}) => {
    if (!jobs || jobs.length === 0) {
        return { orderedJobs: [], totalDistance: 0, totalDuration: 0, legs: [] };
    }

    if (jobs.length === 1) {
        const singleDistance = await getDistance(
            startPoint.address || startPoint,
            getJobLocation(jobs[0]),
            options
        );
        return {
            orderedJobs: jobs,
            totalDistance: singleDistance.distanceMiles,
            totalDuration: singleDistance.durationMinutes,
            legs: [singleDistance]
        };
    }

    // Get all job locations
    const locations = jobs.map(job => getJobLocation(job));
    const allPoints = [startPoint.address || startPoint, ...locations];

    // Get distance matrix for all points
    const matrix = await getDistanceMatrix(allPoints, allPoints, options);

    // Nearest-neighbor algorithm
    const visited = new Set([0]); // Start from home base (index 0)
    const route = [0];
    let current = 0;

    while (visited.size < allPoints.length) {
        let nearestIdx = -1;
        let nearestDuration = Infinity;

        for (let i = 1; i < allPoints.length; i++) {
            if (!visited.has(i)) {
                const duration = matrix[current][i].durationMinutes;
                if (duration < nearestDuration) {
                    nearestDuration = duration;
                    nearestIdx = i;
                }
            }
        }

        if (nearestIdx !== -1) {
            visited.add(nearestIdx);
            route.push(nearestIdx);
            current = nearestIdx;
        }
    }

    // Build results
    const orderedJobs = route.slice(1).map(idx => jobs[idx - 1]);
    const legs = [];
    let totalDistance = 0;
    let totalDuration = 0;

    for (let i = 0; i < route.length - 1; i++) {
        const leg = matrix[route[i]][route[i + 1]];
        legs.push(leg);
        totalDistance += leg.distanceMiles;
        totalDuration += leg.durationMinutes;
    }

    return {
        orderedJobs,
        totalDistance,
        totalDuration,
        legs
    };
};

/**
 * Get location from a job object
 */
const getJobLocation = (job) => {
    // Try coordinates first
    if (job.serviceAddress?.coordinates) {
        return {
            lat: job.serviceAddress.coordinates.lat,
            lng: job.serviceAddress.coordinates.lng
        };
    }
    if (job.coordinates) {
        return {
            lat: job.coordinates.lat,
            lng: job.coordinates.lng
        };
    }

    // Fall back to address string
    return job.serviceAddress?.formatted ||
           job.customer?.address ||
           job.propertyAddress ||
           '';
};

/**
 * Get travel time between two jobs
 */
export const getTravelTimeBetweenJobs = async (job1, job2, options = {}) => {
    const loc1 = getJobLocation(job1);
    const loc2 = getJobLocation(job2);
    return getDistance(loc1, loc2, options);
};

/**
 * Clear the distance cache (useful for testing or forced refresh)
 */
export const clearDistanceCache = () => {
    distanceCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => ({
    size: distanceCache.size,
    entries: Array.from(distanceCache.keys())
});

export default {
    getDistance,
    getDistanceMatrix,
    optimizeRoute,
    getTravelTimeBetweenJobs,
    clearDistanceCache,
    getCacheStats
};
