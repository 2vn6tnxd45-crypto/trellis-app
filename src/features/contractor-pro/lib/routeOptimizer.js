// src/features/contractor-pro/lib/routeOptimizer.js
// ============================================
// ADVANCED ROUTE OPTIMIZER
// ============================================
// Multi-vehicle, time-window-aware route optimization
// Implements Vehicle Routing Problem (VRP) solving

import { getDistanceMatrix } from './distanceMatrixService';

// ============================================
// CONSTANTS
// ============================================

/**
 * Default optimization weights
 */
export const DEFAULT_WEIGHTS = {
    TRAVEL_TIME: 1.0,        // Minimize travel time
    TIME_WINDOW: 2.0,        // Heavily penalize missing time windows
    URGENCY: 1.5,            // Prioritize urgent jobs
    WORKLOAD_BALANCE: 0.5,   // Balance work across vehicles/techs
    SKILL_MATCH: 0.3         // Prefer matching skills (if applicable)
};

/**
 * Time window types
 */
export const TIME_WINDOW_TYPES = {
    HARD: 'hard',      // Must arrive within window (appointment)
    SOFT: 'soft',      // Prefer to arrive within window
    FLEXIBLE: 'flexible' // No specific time preference
};

/**
 * Urgency levels with weights
 */
export const URGENCY_WEIGHTS = {
    emergency: 10,
    urgent: 5,
    standard: 1,
    flexible: 0.5
};

// ============================================
// TIME WINDOW HELPERS
// ============================================

/**
 * Parse a job's time window preferences
 * @param {Object} job - Job document
 * @returns {Object} Time window info
 */
export const parseTimeWindow = (job) => {
    // Check for explicit time window
    if (job.timeWindow) {
        return {
            type: job.timeWindow.type || TIME_WINDOW_TYPES.SOFT,
            start: job.timeWindow.start ? parseTimeToMinutes(job.timeWindow.start) : null,
            end: job.timeWindow.end ? parseTimeToMinutes(job.timeWindow.end) : null,
            preferredTime: job.timeWindow.preferred ? parseTimeToMinutes(job.timeWindow.preferred) : null
        };
    }

    // Check for scheduled time (hard window around that time)
    if (job.scheduledTime) {
        const minutes = parseTimeToMinutes(job.scheduledTime);
        if (minutes !== null) {
            return {
                type: TIME_WINDOW_TYPES.HARD,
                start: minutes - 15, // 15 min early is OK
                end: minutes + 30,   // 30 min late max
                preferredTime: minutes
            };
        }
    }

    // Check for customer preferences
    if (job.customerPreferences) {
        const pref = job.customerPreferences;
        if (pref.preferredMorning) {
            return { type: TIME_WINDOW_TYPES.SOFT, start: 480, end: 720, preferredTime: 540 }; // 8am-12pm
        }
        if (pref.preferredAfternoon) {
            return { type: TIME_WINDOW_TYPES.SOFT, start: 720, end: 1020, preferredTime: 840 }; // 12pm-5pm
        }
    }

    // Default: flexible
    return { type: TIME_WINDOW_TYPES.FLEXIBLE, start: null, end: null, preferredTime: null };
};

/**
 * Convert time string "HH:MM" to minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    if (typeof timeStr === 'number') return timeStr;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const [hours, minutes] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    return hours * 60 + (minutes || 0);
};

/**
 * Convert minutes since midnight to "HH:MM" string
 */
export const minutesToTime = (minutes) => {
    if (minutes == null) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Calculate time window violation penalty
 * @param {number} arrivalMinutes - Expected arrival time in minutes
 * @param {Object} timeWindow - Time window from parseTimeWindow
 * @returns {number} Penalty score (0 = no violation)
 */
export const calculateTimeWindowPenalty = (arrivalMinutes, timeWindow) => {
    if (timeWindow.type === TIME_WINDOW_TYPES.FLEXIBLE) return 0;
    if (timeWindow.start == null || timeWindow.end == null) return 0;

    if (arrivalMinutes < timeWindow.start) {
        // Arriving too early
        const earlyMinutes = timeWindow.start - arrivalMinutes;
        return timeWindow.type === TIME_WINDOW_TYPES.HARD
            ? earlyMinutes * 2  // Higher penalty for hard windows
            : earlyMinutes * 0.5; // Lower penalty for soft windows
    }

    if (arrivalMinutes > timeWindow.end) {
        // Arriving too late
        const lateMinutes = arrivalMinutes - timeWindow.end;
        return timeWindow.type === TIME_WINDOW_TYPES.HARD
            ? lateMinutes * 5  // Much higher penalty for being late to appointments
            : lateMinutes * 1;
    }

    // Bonus for arriving close to preferred time
    if (timeWindow.preferredTime != null) {
        const deviation = Math.abs(arrivalMinutes - timeWindow.preferredTime);
        return -deviation * 0.1; // Small bonus (negative penalty) for being close
    }

    return 0;
};

// ============================================
// ROUTE SCORING
// ============================================

/**
 * Calculate total score for a route
 * Lower is better
 * @param {Array} route - Ordered array of jobs
 * @param {Object} startPoint - Starting location
 * @param {number} startTime - Start time in minutes (e.g., 480 = 8:00 AM)
 * @param {Array} distanceMatrix - Pre-computed distance matrix
 * @param {Object} weights - Scoring weights
 * @returns {Object} Score breakdown
 */
export const scoreRoute = (route, startPoint, startTime, distanceMatrix, weights = DEFAULT_WEIGHTS) => {
    if (!route || route.length === 0) {
        return { total: 0, breakdown: {}, arrivals: [] };
    }

    let totalTravelTime = 0;
    let totalTimeWindowPenalty = 0;
    let totalUrgencyScore = 0;
    let currentTime = startTime;

    const arrivals = [];

    for (let i = 0; i < route.length; i++) {
        const job = route[i];
        const prevIndex = i === 0 ? 0 : (route[i - 1]._routeIndex || i - 1) + 1;
        const currIndex = (job._routeIndex !== undefined ? job._routeIndex : i) + 1;

        // Get travel time from distance matrix
        const travelTime = distanceMatrix?.[prevIndex]?.[currIndex]?.durationMinutes || 15;
        totalTravelTime += travelTime;

        // Calculate arrival time
        const arrivalTime = currentTime + travelTime;
        arrivals.push({ job, arrivalTime, arrivalTimeStr: minutesToTime(arrivalTime) });

        // Time window penalty
        const timeWindow = parseTimeWindow(job);
        const twPenalty = calculateTimeWindowPenalty(arrivalTime, timeWindow);
        totalTimeWindowPenalty += twPenalty;

        // Urgency bonus (negative = good)
        const urgency = job.urgency || 'standard';
        const urgencyWeight = URGENCY_WEIGHTS[urgency] || 1;
        // Earlier position for urgent jobs is better
        totalUrgencyScore += i * urgencyWeight;

        // Update current time (arrival + job duration + buffer)
        const jobDuration = job.estimatedDuration || 60;
        const buffer = 15; // 15 min buffer between jobs
        currentTime = arrivalTime + jobDuration + buffer;
    }

    // Calculate total score
    const breakdown = {
        travelTime: totalTravelTime * weights.TRAVEL_TIME,
        timeWindowPenalty: totalTimeWindowPenalty * weights.TIME_WINDOW,
        urgencyScore: totalUrgencyScore * weights.URGENCY
    };

    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return {
        total,
        breakdown,
        totalTravelTime,
        totalTimeWindowPenalty,
        arrivals,
        endTime: currentTime
    };
};

// ============================================
// ROUTE OPTIMIZATION ALGORITHMS
// ============================================

/**
 * Nearest-neighbor with time window awareness
 * Better than basic nearest-neighbor but still greedy
 */
export const nearestNeighborWithTimeWindows = (jobs, startPoint, startTime, distanceMatrix, weights = DEFAULT_WEIGHTS) => {
    if (!jobs || jobs.length === 0) return [];

    const remaining = jobs.map((job, idx) => ({ ...job, _routeIndex: idx }));
    const route = [];
    let currentTime = startTime;
    let currentIndex = 0; // Start point index in matrix

    while (remaining.length > 0) {
        let bestIdx = 0;
        let bestScore = Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const job = remaining[i];
            const jobMatrixIdx = job._routeIndex + 1;

            // Get travel time
            const travelTime = distanceMatrix?.[currentIndex]?.[jobMatrixIdx]?.durationMinutes || 15;
            const arrivalTime = currentTime + travelTime;

            // Score this choice
            const timeWindow = parseTimeWindow(job);
            const twPenalty = calculateTimeWindowPenalty(arrivalTime, timeWindow);
            const urgencyBonus = -(URGENCY_WEIGHTS[job.urgency || 'standard'] || 1) * 10;

            const score = travelTime * weights.TRAVEL_TIME +
                         twPenalty * weights.TIME_WINDOW +
                         urgencyBonus;

            if (score < bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        // Add best job to route
        const nextJob = remaining.splice(bestIdx, 1)[0];
        route.push(nextJob);

        // Update current position and time
        const travelTime = distanceMatrix?.[currentIndex]?.[nextJob._routeIndex + 1]?.durationMinutes || 15;
        currentTime += travelTime + (nextJob.estimatedDuration || 60) + 15;
        currentIndex = nextJob._routeIndex + 1;
    }

    return route;
};

/**
 * 2-opt improvement algorithm
 * Takes an existing route and tries to improve it by reversing segments
 */
export const twoOptImprove = (route, startPoint, startTime, distanceMatrix, weights = DEFAULT_WEIGHTS, maxIterations = 100) => {
    if (!route || route.length < 3) return route;

    let bestRoute = [...route];
    let bestScore = scoreRoute(bestRoute, startPoint, startTime, distanceMatrix, weights).total;
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < bestRoute.length - 1; i++) {
            for (let j = i + 2; j < bestRoute.length; j++) {
                // Create new route by reversing segment between i and j
                const newRoute = [
                    ...bestRoute.slice(0, i + 1),
                    ...bestRoute.slice(i + 1, j + 1).reverse(),
                    ...bestRoute.slice(j + 1)
                ];

                const newScore = scoreRoute(newRoute, startPoint, startTime, distanceMatrix, weights).total;

                if (newScore < bestScore) {
                    bestRoute = newRoute;
                    bestScore = newScore;
                    improved = true;
                }
            }
        }
    }

    return bestRoute;
};

/**
 * Or-opt improvement (move single job or pairs to better positions)
 */
export const orOptImprove = (route, startPoint, startTime, distanceMatrix, weights = DEFAULT_WEIGHTS) => {
    if (!route || route.length < 3) return route;

    let bestRoute = [...route];
    let bestScore = scoreRoute(bestRoute, startPoint, startTime, distanceMatrix, weights).total;
    let improved = true;

    while (improved) {
        improved = false;

        // Try moving each job to every other position
        for (let i = 0; i < bestRoute.length; i++) {
            for (let j = 0; j < bestRoute.length; j++) {
                if (i === j || i === j - 1) continue;

                // Create new route with job i moved to position j
                const newRoute = [...bestRoute];
                const [job] = newRoute.splice(i, 1);
                const insertPos = j > i ? j - 1 : j;
                newRoute.splice(insertPos, 0, job);

                const newScore = scoreRoute(newRoute, startPoint, startTime, distanceMatrix, weights).total;

                if (newScore < bestScore - 0.1) { // Small threshold to avoid floating point issues
                    bestRoute = newRoute;
                    bestScore = newScore;
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }
    }

    return bestRoute;
};

// ============================================
// MULTI-VEHICLE OPTIMIZATION (VRP)
// ============================================

/**
 * Assign jobs to multiple vehicles/techs and optimize each route
 * Uses a combination of insertion heuristic and local search
 */
export const multiVehicleOptimize = async (
    jobs,
    vehicles,
    startPoint,
    startTime,
    distanceMatrix,
    options = {}
) => {
    const {
        weights = DEFAULT_WEIGHTS,
        maxJobsPerVehicle = 8,
        balanceWorkload = true
    } = options;

    if (!jobs || jobs.length === 0) {
        return { assignments: {}, unassigned: [], stats: {} };
    }

    if (!vehicles || vehicles.length === 0) {
        // Single vehicle mode
        const optimizedRoute = await optimizeRoute(jobs, startPoint, startTime, distanceMatrix, weights);
        return {
            assignments: { single: { jobs: optimizedRoute.route, ...optimizedRoute } },
            unassigned: [],
            stats: { totalTravelTime: optimizedRoute.totalTravelTime }
        };
    }

    // Initialize vehicle routes
    const assignments = {};
    vehicles.forEach(v => {
        assignments[v.id] = {
            vehicle: v,
            tech: v.defaultTechId ? { id: v.defaultTechId, name: v.defaultTechName } : null,
            jobs: [],
            totalTime: 0,
            score: 0
        };
    });

    // Sort jobs by urgency and time window strictness
    const sortedJobs = [...jobs].map((job, idx) => ({ ...job, _routeIndex: idx }));
    sortedJobs.sort((a, b) => {
        // Urgent jobs first
        const urgencyA = URGENCY_WEIGHTS[a.urgency || 'standard'] || 1;
        const urgencyB = URGENCY_WEIGHTS[b.urgency || 'standard'] || 1;
        if (urgencyB !== urgencyA) return urgencyB - urgencyA;

        // Hard time windows before soft
        const twA = parseTimeWindow(a);
        const twB = parseTimeWindow(b);
        if (twA.type !== twB.type) {
            if (twA.type === TIME_WINDOW_TYPES.HARD) return -1;
            if (twB.type === TIME_WINDOW_TYPES.HARD) return 1;
        }

        // Earlier preferred times first
        return (twA.preferredTime || 720) - (twB.preferredTime || 720);
    });

    // Assign jobs using cheapest insertion
    const unassigned = [];

    for (const job of sortedJobs) {
        let bestVehicle = null;
        let bestPosition = 0;
        let bestCost = Infinity;

        // Try inserting into each vehicle's route
        for (const vehicleId of Object.keys(assignments)) {
            const assignment = assignments[vehicleId];

            // Skip if at capacity
            if (assignment.jobs.length >= maxJobsPerVehicle) continue;

            // Check skill match if applicable
            if (job.requiredSkills && assignment.tech?.skills) {
                const hasSkills = job.requiredSkills.some(s =>
                    assignment.tech.skills.includes(s)
                );
                if (!hasSkills) continue;
            }

            // Try each insertion position
            for (let pos = 0; pos <= assignment.jobs.length; pos++) {
                const testRoute = [
                    ...assignment.jobs.slice(0, pos),
                    job,
                    ...assignment.jobs.slice(pos)
                ];

                const routeScore = scoreRoute(testRoute, startPoint, startTime, distanceMatrix, weights);
                let insertionCost = routeScore.total;

                // Workload balancing penalty
                if (balanceWorkload) {
                    const avgJobs = jobs.length / vehicles.length;
                    const deviation = Math.abs(testRoute.length - avgJobs);
                    insertionCost += deviation * weights.WORKLOAD_BALANCE * 10;
                }

                if (insertionCost < bestCost) {
                    bestCost = insertionCost;
                    bestVehicle = vehicleId;
                    bestPosition = pos;
                }
            }
        }

        // Assign to best vehicle or mark as unassigned
        if (bestVehicle) {
            const assignment = assignments[bestVehicle];
            assignment.jobs.splice(bestPosition, 0, job);
            assignment.score = bestCost;
        } else {
            unassigned.push(job);
        }
    }

    // Optimize each vehicle's route with 2-opt and or-opt
    for (const vehicleId of Object.keys(assignments)) {
        const assignment = assignments[vehicleId];
        if (assignment.jobs.length > 1) {
            // Apply improvements
            let improved = twoOptImprove(assignment.jobs, startPoint, startTime, distanceMatrix, weights);
            improved = orOptImprove(improved, startPoint, startTime, distanceMatrix, weights);

            // Score final route
            const finalScore = scoreRoute(improved, startPoint, startTime, distanceMatrix, weights);

            assignment.jobs = improved;
            assignment.totalTime = finalScore.totalTravelTime;
            assignment.score = finalScore.total;
            assignment.arrivals = finalScore.arrivals;
            assignment.endTime = finalScore.endTime;
        } else if (assignment.jobs.length === 1) {
            const finalScore = scoreRoute(assignment.jobs, startPoint, startTime, distanceMatrix, weights);
            assignment.totalTime = finalScore.totalTravelTime;
            assignment.arrivals = finalScore.arrivals;
        }
    }

    // Calculate stats
    const totalTravelTime = Object.values(assignments)
        .reduce((sum, a) => sum + (a.totalTime || 0), 0);
    const totalJobs = Object.values(assignments)
        .reduce((sum, a) => sum + a.jobs.length, 0);

    return {
        assignments,
        unassigned,
        stats: {
            totalTravelTime,
            totalJobs,
            unassignedCount: unassigned.length,
            vehiclesUsed: Object.values(assignments).filter(a => a.jobs.length > 0).length
        }
    };
};

// ============================================
// SINGLE ROUTE OPTIMIZATION (MAIN ENTRY POINT)
// ============================================

/**
 * Optimize a single route with all improvements
 * @param {Array} jobs - Jobs to route
 * @param {Object} startPoint - Starting location {lat, lng} or address string
 * @param {number} startTime - Start time in minutes (default 8am = 480)
 * @param {Array} distanceMatrix - Pre-computed matrix (will fetch if not provided)
 * @param {Object} weights - Scoring weights
 * @returns {Object} Optimized route with stats
 */
export const optimizeRoute = async (jobs, startPoint, startTime = 480, distanceMatrix = null, weights = DEFAULT_WEIGHTS) => {
    if (!jobs || jobs.length === 0) {
        return {
            route: [],
            totalTravelTime: 0,
            totalTimeWindowPenalty: 0,
            arrivals: [],
            improvement: 0
        };
    }

    // Index jobs
    const indexedJobs = jobs.map((job, idx) => ({ ...job, _routeIndex: idx }));

    // Get distance matrix if not provided
    let matrix = distanceMatrix;
    if (!matrix) {
        const locations = [
            typeof startPoint === 'string' ? startPoint : `${startPoint.lat},${startPoint.lng}`,
            ...indexedJobs.map(j =>
                j.serviceAddress?.coordinates
                    ? `${j.serviceAddress.coordinates.lat},${j.serviceAddress.coordinates.lng}`
                    : j.serviceAddress?.formatted || j.customer?.address || ''
            )
        ];
        try {
            matrix = await getDistanceMatrix(locations, locations);
        } catch (error) {
            console.warn('Failed to get distance matrix, using fallback:', error);
            matrix = null;
        }
    }

    // Get initial route with time-window-aware nearest neighbor
    const initialRoute = nearestNeighborWithTimeWindows(indexedJobs, startPoint, startTime, matrix, weights);
    const initialScore = scoreRoute(initialRoute, startPoint, startTime, matrix, weights);

    // Improve with 2-opt
    let improvedRoute = twoOptImprove(initialRoute, startPoint, startTime, matrix, weights);

    // Improve with or-opt
    improvedRoute = orOptImprove(improvedRoute, startPoint, startTime, matrix, weights);

    // Final scoring
    const finalScore = scoreRoute(improvedRoute, startPoint, startTime, matrix, weights);

    // Calculate improvement
    const improvement = initialScore.total > 0
        ? ((initialScore.total - finalScore.total) / initialScore.total * 100).toFixed(1)
        : 0;

    return {
        route: improvedRoute,
        totalTravelTime: finalScore.totalTravelTime,
        totalTimeWindowPenalty: finalScore.totalTimeWindowPenalty,
        arrivals: finalScore.arrivals,
        endTime: finalScore.endTime,
        score: finalScore.total,
        scoreBreakdown: finalScore.breakdown,
        improvement: parseFloat(improvement),
        initialOrder: initialRoute.map(j => j.id),
        optimizedOrder: improvedRoute.map(j => j.id)
    };
};

// ============================================
// ROUTE COMPARISON
// ============================================

/**
 * Compare two routes and calculate differences
 */
export const compareRoutes = (routeA, routeB, startPoint, startTime, distanceMatrix, weights = DEFAULT_WEIGHTS) => {
    const scoreA = scoreRoute(routeA, startPoint, startTime, distanceMatrix, weights);
    const scoreB = scoreRoute(routeB, startPoint, startTime, distanceMatrix, weights);

    const timeSaved = scoreA.totalTravelTime - scoreB.totalTravelTime;
    const twImprovement = scoreA.totalTimeWindowPenalty - scoreB.totalTimeWindowPenalty;

    return {
        routeA: {
            order: routeA.map(j => j.id || j._id),
            ...scoreA
        },
        routeB: {
            order: routeB.map(j => j.id || j._id),
            ...scoreB
        },
        comparison: {
            timeSavedMinutes: Math.round(timeSaved),
            timeWindowImproved: twImprovement > 0,
            totalScoreImprovement: scoreA.total - scoreB.total,
            percentImprovement: scoreA.total > 0
                ? ((scoreA.total - scoreB.total) / scoreA.total * 100).toFixed(1)
                : 0,
            recommendation: scoreB.total < scoreA.total ? 'B' : 'A'
        }
    };
};

// ============================================
// TRAFFIC-AWARE OPTIMIZATION
// ============================================

/**
 * Get optimal departure time for a route based on traffic patterns
 */
export const findBestDepartureTime = async (route, startPoint, date, departureOptions = [420, 450, 480, 510, 540]) => {
    if (!route || route.length === 0) {
        return { bestTime: 480, results: [] };
    }

    const results = [];

    for (const startMinutes of departureOptions) {
        // Create departure Date object
        const departureTime = new Date(date);
        departureTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

        // Get distances with traffic consideration
        const locations = [
            typeof startPoint === 'string' ? startPoint : `${startPoint.lat},${startPoint.lng}`,
            ...route.map(j =>
                j.serviceAddress?.coordinates
                    ? `${j.serviceAddress.coordinates.lat},${j.serviceAddress.coordinates.lng}`
                    : j.serviceAddress?.formatted || j.customer?.address || ''
            )
        ];

        try {
            const matrix = await getDistanceMatrix(locations, locations, {
                departureTime: departureTime
            });

            const score = scoreRoute(route, startPoint, startMinutes, matrix);

            results.push({
                departureMinutes: startMinutes,
                departureTime: minutesToTime(startMinutes),
                totalTravelTime: score.totalTravelTime,
                totalTravelTimeInTraffic: matrix?.[0]?.[1]?.durationInTrafficMinutes || score.totalTravelTime,
                score: score.total,
                endTime: score.endTime,
                endTimeStr: minutesToTime(score.endTime)
            });
        } catch (error) {
            console.warn(`Failed to get traffic data for ${minutesToTime(startMinutes)}:`, error);
        }
    }

    // Find best option
    results.sort((a, b) => a.score - b.score);

    return {
        bestTime: results[0]?.departureMinutes || 480,
        bestTimeStr: results[0]?.departureTime || '08:00',
        results
    };
};

// ============================================
// EXPORTS
// ============================================

export default {
    // Constants
    DEFAULT_WEIGHTS,
    TIME_WINDOW_TYPES,
    URGENCY_WEIGHTS,

    // Time window helpers
    parseTimeWindow,
    minutesToTime,
    calculateTimeWindowPenalty,

    // Scoring
    scoreRoute,

    // Algorithms
    nearestNeighborWithTimeWindows,
    twoOptImprove,
    orOptImprove,

    // Main functions
    optimizeRoute,
    multiVehicleOptimize,
    compareRoutes,
    findBestDepartureTime
};
