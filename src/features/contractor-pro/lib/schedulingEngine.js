// src/features/contractor-pro/lib/schedulingEngine.js
// ============================================
// CONSTRAINT-AWARE SCHEDULING ENGINE
// ============================================
// Priority 1.3: Smart scheduling that respects skills, certs, SLAs, parts, and travel

import { getTeamMembers, findEligibleTechs, checkMemberAvailability } from './teamService';
import { getJobsByDate, getUnscheduledJobs, JOB_STATUSES } from './jobService';

// ============================================
// CONSTRAINT TYPES
// ============================================
export const CONSTRAINT_TYPES = {
    SKILL: 'skill',
    CERTIFICATION: 'certification',
    AVAILABILITY: 'availability',
    TRAVEL_TIME: 'travel_time',
    PARTS: 'parts',
    SLA: 'sla',
    WORKLOAD: 'workload'
};

// ============================================
// SCHEDULING RESULT TYPES
// ============================================
export const SCHEDULE_RESULT = {
    SUCCESS: 'success',
    NO_ELIGIBLE_TECHS: 'no_eligible_techs',
    NO_AVAILABLE_SLOTS: 'no_available_slots',
    CONSTRAINT_VIOLATION: 'constraint_violation',
    CONFLICT: 'conflict'
};

// ============================================
// TRAVEL TIME ESTIMATION
// ============================================

/**
 * Estimate travel time between two locations
 * Quick Win #3: Travel time calculation for job cards
 *
 * @param {Object} from - { lat, lng } or address string
 * @param {Object} to - { lat, lng } or address string
 * @returns {Promise<{ durationMinutes: number, distanceMiles: number }>}
 */
export const estimateTravelTime = async (from, to) => {
    // If we have lat/lng for both, use Haversine formula for rough estimate
    // In production, this would call Google Distance Matrix API

    if (from?.lat && from?.lng && to?.lat && to?.lng) {
        const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
        // Rough estimate: 30 mph average in urban areas
        const durationMinutes = Math.round((distance / 30) * 60);

        return {
            durationMinutes,
            distanceMiles: Math.round(distance * 10) / 10,
            estimateType: 'haversine'
        };
    }

    // Fallback: default estimate
    return {
        durationMinutes: 30,
        distanceMiles: 15,
        estimateType: 'default'
    };
};

/**
 * Haversine formula to calculate distance between two lat/lng points
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg) => deg * (Math.PI / 180);

// ============================================
// CORE SCHEDULING FUNCTIONS
// ============================================

/**
 * Evaluate all constraints for a job-tech-time combination
 * Returns a detailed constraint evaluation result
 */
export const evaluateConstraints = async (job, tech, timeSlot, existingJobs = []) => {
    const violations = [];
    const warnings = [];
    let score = 100; // Start with perfect score, deduct for issues

    // 1. AVAILABILITY CHECK
    const availability = checkMemberAvailability(
        tech,
        timeSlot.date,
        timeSlot.startTime,
        timeSlot.endTime
    );

    if (!availability.available) {
        violations.push({
            type: CONSTRAINT_TYPES.AVAILABILITY,
            message: availability.reason,
            severity: 'blocking'
        });
        score = 0;
    }

    // 2. SKILL CHECK
    const requiredSkills = job.requiredSkills || [];
    const techSkills = (tech.skills || []).map(s => s.skillId);
    const missingSkills = requiredSkills.filter(s => !techSkills.includes(s));

    if (missingSkills.length > 0) {
        violations.push({
            type: CONSTRAINT_TYPES.SKILL,
            message: `Missing skills: ${missingSkills.join(', ')}`,
            severity: 'blocking',
            details: missingSkills
        });
        score = 0;
    }

    // 3. CERTIFICATION CHECK
    const requiredCerts = job.requiredCertifications || [];
    const techCerts = (tech.certifications || []).map(c => c.certId);
    const now = new Date();
    const missingCerts = [];
    const expiredCerts = [];

    for (const reqCert of requiredCerts) {
        const techCert = (tech.certifications || []).find(c => c.certId === reqCert);
        if (!techCert) {
            missingCerts.push(reqCert);
        } else if (techCert.expiresAt && new Date(techCert.expiresAt) < now) {
            expiredCerts.push(reqCert);
        }
    }

    if (missingCerts.length > 0) {
        violations.push({
            type: CONSTRAINT_TYPES.CERTIFICATION,
            message: `Missing certifications: ${missingCerts.join(', ')}`,
            severity: 'blocking',
            details: missingCerts
        });
        score = 0;
    }

    if (expiredCerts.length > 0) {
        violations.push({
            type: CONSTRAINT_TYPES.CERTIFICATION,
            message: `Expired certifications: ${expiredCerts.join(', ')}`,
            severity: 'blocking',
            details: expiredCerts
        });
        score = 0;
    }

    // 4. CONFLICT CHECK (overlapping jobs)
    const techJobsOnDate = existingJobs.filter(j =>
        j.assignedTechId === tech.id &&
        j.scheduledDate === timeSlot.date &&
        j.status !== JOB_STATUSES.CANCELLED &&
        j.status !== JOB_STATUSES.COMPLETED
    );

    for (const existingJob of techJobsOnDate) {
        if (timeSlot.startTime < existingJob.scheduledEndTime &&
            timeSlot.endTime > existingJob.scheduledStartTime) {
            violations.push({
                type: CONSTRAINT_TYPES.AVAILABILITY,
                message: `Conflicts with job ${existingJob.jobNumber} (${existingJob.scheduledStartTime}-${existingJob.scheduledEndTime})`,
                severity: 'blocking',
                conflictingJob: existingJob.id
            });
            score = 0;
        }
    }

    // 5. TRAVEL TIME CHECK (if we have location data)
    if (job.serviceLocation && techJobsOnDate.length > 0) {
        // Find the job immediately before this time slot
        const sortedJobs = techJobsOnDate
            .filter(j => j.scheduledEndTime <= timeSlot.startTime)
            .sort((a, b) => b.scheduledEndTime.localeCompare(a.scheduledEndTime));

        if (sortedJobs.length > 0) {
            const previousJob = sortedJobs[0];
            if (previousJob.serviceLocation) {
                const travel = await estimateTravelTime(
                    previousJob.serviceLocation,
                    job.serviceLocation
                );

                // Check if there's enough time between jobs
                const gapMinutes = timeToMinutes(timeSlot.startTime) - timeToMinutes(previousJob.scheduledEndTime);

                if (travel.durationMinutes > gapMinutes) {
                    warnings.push({
                        type: CONSTRAINT_TYPES.TRAVEL_TIME,
                        message: `Tight travel time: ${travel.durationMinutes} min needed, ${gapMinutes} min available`,
                        severity: 'warning',
                        details: { required: travel.durationMinutes, available: gapMinutes }
                    });
                    score -= 15;
                }

                // Store travel time for display
                job.travelTimeFromPrevious = travel;
            }
        }
    }

    // 6. SLA CHECK
    if (job.slaDeadline) {
        const slaDate = new Date(job.slaDeadline);
        const scheduledDate = new Date(timeSlot.date);

        if (scheduledDate > slaDate) {
            violations.push({
                type: CONSTRAINT_TYPES.SLA,
                message: `Scheduled after SLA deadline (${job.slaDeadline})`,
                severity: 'blocking'
            });
            score = 0;
        } else {
            // Warn if cutting it close (same day)
            const daysUntilSla = Math.ceil((slaDate - scheduledDate) / (1000 * 60 * 60 * 24));
            if (daysUntilSla <= 1) {
                warnings.push({
                    type: CONSTRAINT_TYPES.SLA,
                    message: `SLA deadline is ${daysUntilSla === 0 ? 'today' : 'tomorrow'}`,
                    severity: 'warning'
                });
                score -= 10;
            }
        }
    }

    // 7. WORKLOAD BALANCE CHECK
    if (techJobsOnDate.length >= 6) {
        warnings.push({
            type: CONSTRAINT_TYPES.WORKLOAD,
            message: `Tech already has ${techJobsOnDate.length} jobs scheduled`,
            severity: 'warning'
        });
        score -= 5 * (techJobsOnDate.length - 5);
    }

    // 8. PARTS CHECK (placeholder for future inventory integration)
    if (job.requiredParts && job.requiredParts.length > 0) {
        // In production, this would check inventory
        // For now, just add a warning
        warnings.push({
            type: CONSTRAINT_TYPES.PARTS,
            message: `Parts required: ${job.requiredParts.join(', ')} - verify availability`,
            severity: 'info'
        });
    }

    // Calculate final result
    const hasBlockingViolations = violations.some(v => v.severity === 'blocking');

    return {
        canSchedule: !hasBlockingViolations,
        score: Math.max(0, score),
        violations,
        warnings,
        summary: hasBlockingViolations
            ? `Cannot schedule: ${violations[0].message}`
            : warnings.length > 0
                ? `Can schedule with ${warnings.length} warning(s)`
                : 'All constraints satisfied'
    };
};

/**
 * Find the best time slot for a job on a given date
 */
export const findBestTimeSlot = async (contractorId, job, date, preferredTechId = null) => {
    try {
        // Get all team members and existing jobs
        const [team, existingJobs] = await Promise.all([
            getTeamMembers(contractorId, { activeOnly: true }),
            getJobsByDate(contractorId, date, { includeCompleted: false })
        ]);

        const candidates = [];
        const duration = job.estimatedDurationMinutes || 60;

        // If preferred tech specified, try them first
        const techsToTry = preferredTechId
            ? [team.find(t => t.id === preferredTechId), ...team.filter(t => t.id !== preferredTechId)].filter(Boolean)
            : team;

        for (const tech of techsToTry) {
            // Get available time slots for this tech
            const slots = generateTimeSlots(tech, date, duration);

            for (const slot of slots) {
                const evaluation = await evaluateConstraints(job, tech, slot, existingJobs);

                if (evaluation.canSchedule) {
                    candidates.push({
                        tech,
                        slot,
                        evaluation
                    });
                }
            }
        }

        if (candidates.length === 0) {
            return {
                success: false,
                result: SCHEDULE_RESULT.NO_AVAILABLE_SLOTS,
                message: 'No available time slots found for any eligible tech'
            };
        }

        // Sort by score (highest first)
        candidates.sort((a, b) => b.evaluation.score - a.evaluation.score);

        const best = candidates[0];

        return {
            success: true,
            result: SCHEDULE_RESULT.SUCCESS,
            recommendation: {
                techId: best.tech.id,
                techName: best.tech.name,
                date: best.slot.date,
                startTime: best.slot.startTime,
                endTime: best.slot.endTime,
                score: best.evaluation.score,
                warnings: best.evaluation.warnings
            },
            alternatives: candidates.slice(1, 4).map(c => ({
                techId: c.tech.id,
                techName: c.tech.name,
                date: c.slot.date,
                startTime: c.slot.startTime,
                endTime: c.slot.endTime,
                score: c.evaluation.score
            }))
        };
    } catch (error) {
        console.error('Error finding best time slot:', error);
        throw error;
    }
};

/**
 * Generate available time slots for a tech on a date
 */
const generateTimeSlots = (tech, date, durationMinutes) => {
    const checkDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[checkDate.getDay()];
    const workingHours = tech.workingHours?.[dayName];

    if (!workingHours?.available || !workingHours.start || !workingHours.end) {
        return [];
    }

    const slots = [];
    const startMinutes = timeToMinutes(workingHours.start);
    const endMinutes = timeToMinutes(workingHours.end);

    // Generate slots every 30 minutes
    for (let start = startMinutes; start + durationMinutes <= endMinutes; start += 30) {
        slots.push({
            date: date,
            startTime: minutesToTime(start),
            endTime: minutesToTime(start + durationMinutes)
        });
    }

    return slots;
};

// ============================================
// SCHEDULE OPTIMIZATION
// ============================================

/**
 * Optimize a day's schedule for a single tech
 * Reorders jobs to minimize travel time
 */
export const optimizeTechSchedule = async (contractorId, techId, date) => {
    try {
        const jobs = await getJobsByDate(contractorId, date, { techId, includeCompleted: false });

        if (jobs.length <= 1) {
            return { optimized: false, message: 'Not enough jobs to optimize' };
        }

        // Get tech's home base for starting point
        const tech = await getTeamMember(contractorId, techId);
        const startLocation = tech?.homeBase || jobs[0].serviceLocation;

        // Simple nearest-neighbor algorithm for route optimization
        const orderedJobs = [];
        const remainingJobs = [...jobs];
        let currentLocation = startLocation;

        while (remainingJobs.length > 0) {
            let nearestJob = null;
            let nearestDistance = Infinity;

            for (const job of remainingJobs) {
                if (job.serviceLocation) {
                    const distance = haversineDistance(
                        currentLocation.lat, currentLocation.lng,
                        job.serviceLocation.lat, job.serviceLocation.lng
                    );

                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestJob = job;
                    }
                }
            }

            if (nearestJob) {
                orderedJobs.push(nearestJob);
                currentLocation = nearestJob.serviceLocation;
                remainingJobs.splice(remainingJobs.indexOf(nearestJob), 1);
            } else {
                // No location data, just add remaining jobs in original order
                orderedJobs.push(...remainingJobs);
                break;
            }
        }

        // Calculate new time slots based on optimized order
        const workingHours = tech.workingHours?.[getDayName(date)];
        let currentTime = timeToMinutes(workingHours?.start || '08:00');

        const newSchedule = orderedJobs.map((job, index) => {
            const startTime = minutesToTime(currentTime);
            const duration = job.estimatedDurationMinutes || 60;
            currentTime += duration;

            // Add travel time for next job
            if (index < orderedJobs.length - 1 && job.serviceLocation && orderedJobs[index + 1].serviceLocation) {
                const travelMinutes = Math.round(
                    haversineDistance(
                        job.serviceLocation.lat, job.serviceLocation.lng,
                        orderedJobs[index + 1].serviceLocation.lat, orderedJobs[index + 1].serviceLocation.lng
                    ) / 30 * 60 // 30 mph average
                );
                currentTime += Math.max(15, travelMinutes); // Minimum 15 min buffer
            }

            return {
                jobId: job.id,
                newStartTime: startTime,
                newEndTime: minutesToTime(timeToMinutes(startTime) + duration)
            };
        });

        return {
            optimized: true,
            originalOrder: jobs.map(j => j.id),
            optimizedOrder: orderedJobs.map(j => j.id),
            newSchedule,
            estimatedTimeSaved: calculateTimeSavings(jobs, orderedJobs)
        };
    } catch (error) {
        console.error('Error optimizing schedule:', error);
        throw error;
    }
};

/**
 * What-if scenario analysis
 * Simulates the impact of swapping two techs' assignments
 */
export const simulateSwap = async (contractorId, date, techAId, techBId) => {
    try {
        const [techAJobs, techBJobs, allTechs] = await Promise.all([
            getJobsByDate(contractorId, date, { techId: techAId }),
            getJobsByDate(contractorId, date, { techId: techBId }),
            getTeamMembers(contractorId)
        ]);

        const techA = allTechs.find(t => t.id === techAId);
        const techB = allTechs.find(t => t.id === techBId);

        // Calculate current metrics
        const currentMetrics = {
            techATravelTime: await calculateTotalTravelTime(techAJobs),
            techBTravelTime: await calculateTotalTravelTime(techBJobs),
            techAUtilization: calculateUtilization(techA, techAJobs),
            techBUtilization: calculateUtilization(techB, techBJobs)
        };

        // Simulate swap - check if techs can handle each other's jobs
        const techACanDoB = await Promise.all(
            techBJobs.map(job => evaluateConstraints(job, techA, {
                date: job.scheduledDate,
                startTime: job.scheduledStartTime,
                endTime: job.scheduledEndTime
            }, techAJobs))
        );

        const techBCanDoA = await Promise.all(
            techAJobs.map(job => evaluateConstraints(job, techB, {
                date: job.scheduledDate,
                startTime: job.scheduledStartTime,
                endTime: job.scheduledEndTime
            }, techBJobs))
        );

        const canSwap =
            techACanDoB.every(e => e.canSchedule) &&
            techBCanDoA.every(e => e.canSchedule);

        if (!canSwap) {
            const violations = [
                ...techACanDoB.filter(e => !e.canSchedule).map(e => ({ tech: techA.name, ...e })),
                ...techBCanDoA.filter(e => !e.canSchedule).map(e => ({ tech: techB.name, ...e }))
            ];

            return {
                canSwap: false,
                reason: 'Constraint violations would occur',
                violations
            };
        }

        // Calculate metrics after swap
        const swappedMetrics = {
            techATravelTime: await calculateTotalTravelTime(techBJobs), // A doing B's jobs
            techBTravelTime: await calculateTotalTravelTime(techAJobs), // B doing A's jobs
            techAUtilization: calculateUtilization(techA, techBJobs),
            techBUtilization: calculateUtilization(techB, techAJobs)
        };

        const totalCurrentTravel = currentMetrics.techATravelTime + currentMetrics.techBTravelTime;
        const totalSwappedTravel = swappedMetrics.techATravelTime + swappedMetrics.techBTravelTime;

        return {
            canSwap: true,
            currentMetrics,
            swappedMetrics,
            savings: {
                travelTimeMinutes: totalCurrentTravel - totalSwappedTravel,
                travelTimePercent: Math.round((1 - totalSwappedTravel / totalCurrentTravel) * 100)
            },
            recommendation: totalSwappedTravel < totalCurrentTravel
                ? 'Swap recommended - reduces total travel time'
                : 'Keep current assignments - swap would increase travel time'
        };
    } catch (error) {
        console.error('Error simulating swap:', error);
        throw error;
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const timeToMinutes = (time) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getDayName = (date) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[new Date(date).getDay()];
};

const calculateTotalTravelTime = async (jobs) => {
    if (jobs.length <= 1) return 0;

    let totalMinutes = 0;
    const sortedJobs = [...jobs].sort((a, b) =>
        (a.scheduledStartTime || '').localeCompare(b.scheduledStartTime || '')
    );

    for (let i = 0; i < sortedJobs.length - 1; i++) {
        const from = sortedJobs[i].serviceLocation;
        const to = sortedJobs[i + 1].serviceLocation;

        if (from && to) {
            const travel = await estimateTravelTime(from, to);
            totalMinutes += travel.durationMinutes;
        }
    }

    return totalMinutes;
};

const calculateUtilization = (tech, jobs) => {
    if (!jobs || jobs.length === 0) return 0;

    const totalJobMinutes = jobs.reduce((sum, job) =>
        sum + (job.estimatedDurationMinutes || 60), 0
    );

    // Assume 8 hour work day = 480 minutes
    const workDayMinutes = 480;

    return Math.round((totalJobMinutes / workDayMinutes) * 100);
};

const calculateTimeSavings = async (originalOrder, optimizedOrder) => {
    const originalTravel = await calculateTotalTravelTime(originalOrder);
    const optimizedTravel = await calculateTotalTravelTime(optimizedOrder);
    return originalTravel - optimizedTravel;
};

// ============================================
// IMPORTS FOR HELPER FUNCTIONS
// ============================================
import { getTeamMember } from './teamService';

export default {
    CONSTRAINT_TYPES,
    SCHEDULE_RESULT,
    estimateTravelTime,
    evaluateConstraints,
    findBestTimeSlot,
    optimizeTechSchedule,
    simulateSwap
};
