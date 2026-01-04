// src/features/contractor-pro/lib/schedulingAI.js
// ============================================
// SCHEDULING AI - Smart Suggestion Engine
// ============================================
// Analyzes schedule, jobs, and preferences to suggest optimal times

// ============================================
// HELPERS
// ============================================

/**
 * Parse time string (HH:MM) to minutes from midnight
 */
const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Convert minutes from midnight to time string
 */
const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Format time for display
 */
const formatTimeDisplay = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Get day of week name
 */
const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
};

/**
 * Check if two dates are the same day
 */
const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in miles
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    
    const R = 3959; // Earth's radius in miles
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
 * Estimate travel time based on distance (rough estimate)
 * Assumes average 30 mph in suburban/urban areas
 */
const estimateTravelTime = (miles) => {
    if (!miles) return 30; // Default 30 min if unknown
    return Math.ceil(miles * 2); // ~30 mph = 2 min per mile
};

// ============================================
// CORE ANALYSIS FUNCTIONS
// ============================================

/**
 * Get all scheduled jobs for a specific date
 */
const getJobsForDate = (jobs, date) => {
    return jobs.filter(job => {
        const jobDate = job.scheduledTime || job.scheduledDate;
        if (!jobDate) return false;
        return isSameDay(new Date(jobDate), date);
    }).sort((a, b) => {
        const timeA = new Date(a.scheduledTime || a.scheduledDate);
        const timeB = new Date(b.scheduledTime || b.scheduledDate);
        return timeA - timeB;
    });
};

/**
 * Get working hours for a specific day
 */
const getWorkingHoursForDay = (preferences, date) => {
    const dayName = getDayName(date);
    const dayHours = preferences?.workingHours?.[dayName];
    
    if (!dayHours?.enabled) {
        return null; // Day off
    }
    
    return {
        start: timeToMinutes(dayHours.start || '08:00'),
        end: timeToMinutes(dayHours.end || '17:00')
    };
};

/**
 * Find available time slots for a specific date
 */
const findAvailableSlots = (date, jobs, preferences, requiredDuration) => {
    const workingHours = getWorkingHoursForDay(preferences, date);
    if (!workingHours) return []; // Day off
    
    const buffer = preferences?.bufferMinutes || 30;
    const dayJobs = getJobsForDate(jobs, date);
    const slots = [];
    
    let currentStart = workingHours.start;
    
    for (const job of dayJobs) {
        const jobStart = new Date(job.scheduledTime || job.scheduledDate);
        const jobStartMinutes = jobStart.getHours() * 60 + jobStart.getMinutes();
        const jobDuration = job.estimatedDuration || preferences?.defaultJobDuration || 120;
        const jobEnd = jobStartMinutes + jobDuration;
        
        // Check if there's a gap before this job
        const gapDuration = jobStartMinutes - buffer - currentStart;
        if (gapDuration >= requiredDuration) {
            slots.push({
                start: currentStart,
                end: jobStartMinutes - buffer,
                duration: gapDuration,
                type: 'gap'
            });
        }
        
        currentStart = jobEnd + buffer;
    }
    
    // Check remaining time after last job
    const remainingDuration = workingHours.end - currentStart;
    if (remainingDuration >= requiredDuration) {
        slots.push({
            start: currentStart,
            end: workingHours.end,
            duration: remainingDuration,
            type: dayJobs.length === 0 ? 'empty_day' : 'end_of_day'
        });
    }
    
    return slots;
};

/**
 * Find nearby jobs on the same date
 */
const findNearbyJobs = (targetJob, allJobs, date) => {
    const targetCoords = targetJob.serviceAddress?.coordinates;
    if (!targetCoords) return [];
    
    const dayJobs = getJobsForDate(allJobs, date);
    
    return dayJobs
        .map(job => {
            const jobCoords = job.serviceAddress?.coordinates;
            if (!jobCoords) return null;
            
            const distance = calculateDistance(
                targetCoords.lat, targetCoords.lng,
                jobCoords.lat, jobCoords.lng
            );
            
            return {
                job,
                distance,
                travelTime: estimateTravelTime(distance)
            };
        })
        .filter(item => item && item.distance !== null && item.distance < 15) // Within 15 miles
        .sort((a, b) => a.distance - b.distance);
};

/**
 * Check if a slot matches customer preferences
 */
const matchesCustomerPreferences = (slot, preferences) => {
    // FIX: Added reasons: [] to prevent crash when preferences is null
    if (!preferences) return { matches: true, score: 50, reasons: [] };
    
    let score = 50; // Base score
    const reasons = [];
    
    // Check time of day preference
    const slotHour = Math.floor(slot.start / 60);
    const timePrefs = preferences.timeOfDay || [];
    
    if (timePrefs.includes('Mornings') && slotHour >= 8 && slotHour < 12) {
        score += 20;
        reasons.push('Matches morning preference');
    } else if (timePrefs.includes('Afternoons') && slotHour >= 12 && slotHour < 17) {
        score += 20;
        reasons.push('Matches afternoon preference');
    } else if (timePrefs.includes('Evenings') && slotHour >= 17) {
        score += 20;
        reasons.push('Matches evening preference');
    } else if (timePrefs.includes('Flexible')) {
        score += 10;
    }
    
    // Check day preference
    const dayPref = preferences.dayPreference;
    const slotDay = slot.date.getDay();
    const isWeekend = slotDay === 0 || slotDay === 6;
    
    if (dayPref === 'Weekdays' && !isWeekend) {
        score += 15;
        reasons.push('Weekday as preferred');
    } else if (dayPref === 'Weekends' && isWeekend) {
        score += 15;
        reasons.push('Weekend as preferred');
    } else if (dayPref === 'Any Day') {
        score += 5;
    }
    
    return {
        matches: score > 50,
        score,
        reasons
    };
};

/**
 * Calculate workload for a date
 */
const calculateDayWorkload = (date, jobs, preferences) => {
    const dayJobs = getJobsForDate(jobs, date);
    const maxJobs = preferences?.maxJobsPerDay || 4;
    
    const totalMinutes = dayJobs.reduce((sum, job) => {
        return sum + (job.estimatedDuration || preferences?.defaultJobDuration || 120);
    }, 0);
    
    return {
        jobCount: dayJobs.length,
        maxJobs,
        totalMinutes,
        utilizationPercent: Math.round((dayJobs.length / maxJobs) * 100),
        isFull: dayJobs.length >= maxJobs,
        isLight: dayJobs.length <= 1,
        isModerate: dayJobs.length > 1 && dayJobs.length < maxJobs - 1
    };
};

// ============================================
// MAIN SUGGESTION ENGINE
// ============================================

/**
 * Generate scheduling suggestions for a job
 * * @param {Object} targetJob - The job to schedule
 * @param {Array} allJobs - All jobs (scheduled and unscheduled)
 * @param {Object} preferences - Contractor's scheduling preferences
 * @param {Object} customerPrefs - Customer's scheduling preferences (if any)
 * @param {number} daysToAnalyze - How many days ahead to look
 * @returns {Object} Suggestions and analysis
 */
export const generateSchedulingSuggestions = (
    targetJob,
    allJobs,
    preferences = {},
    customerPrefs = null,
    daysToAnalyze = 14
) => {
    const suggestions = [];
    const warnings = [];
    const insights = [];
    
    const jobDuration = targetJob.estimatedDuration || 
                        preferences?.defaultJobDuration || 
                        120; // 2 hours default
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Analyze each day
    for (let i = 1; i <= daysToAnalyze; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        // Skip if day is off
        const workingHours = getWorkingHoursForDay(preferences, date);
        if (!workingHours) continue;
        
        // Get workload
        const workload = calculateDayWorkload(date, allJobs, preferences);
        
        // Skip if day is full
        if (workload.isFull) {
            if (i <= 7) {
                warnings.push({
                    type: 'full_day',
                    date,
                    message: `${date.toLocaleDateString('en-US', { weekday: 'long' })} is fully booked`
                });
            }
            continue;
        }
        
        // Find available slots
        const availableSlots = findAvailableSlots(date, allJobs, preferences, jobDuration);
        
        for (const slot of availableSlots) {
            // Calculate score
            let score = 50; // Base score
            const reasons = [];
            
            // Bonus for empty days (good for route efficiency)
            if (slot.type === 'empty_day') {
                score += 5;
                reasons.push('Open day');
            }
            
            // Bonus for light days (workload balancing)
            if (workload.isLight) {
                score += 10;
                reasons.push('Light schedule');
            }
            
            // Check nearby jobs for route optimization
            const nearbyJobs = findNearbyJobs(targetJob, allJobs, date);
            if (nearbyJobs.length > 0) {
                const closest = nearbyJobs[0];
                if (closest.distance < 5) {
                    score += 25;
                    reasons.push(`Near ${nearbyJobs.length} other job${nearbyJobs.length > 1 ? 's' : ''} (${closest.distance.toFixed(1)} mi)`);
                } else if (closest.distance < 10) {
                    score += 15;
                    reasons.push(`${closest.distance.toFixed(1)} mi from another job`);
                }
            }
            
            // Check customer preferences
            const prefMatch = matchesCustomerPreferences(
                { ...slot, date }, 
                customerPrefs
            );
            if (prefMatch.matches) {
                score += prefMatch.score - 50;
                // FIX: This was the source of the spread error if prefMatch.reasons was missing
                if (prefMatch.reasons && prefMatch.reasons.length > 0) {
                    reasons.push(...prefMatch.reasons);
                }
            }
            
            // Prefer earlier in the week for responsiveness
            if (i <= 3) {
                score += 10;
                reasons.push('Soon availability');
            }
            
            // Prefer morning slots (common customer preference)
            const slotHour = Math.floor(slot.start / 60);
            if (slotHour < 12) {
                score += 5;
            }
            
            suggestions.push({
                date,
                startTime: minutesToTime(slot.start),
                endTime: minutesToTime(Math.min(slot.start + jobDuration, slot.end)),
                slotStart: slot.start,
                slotEnd: slot.end,
                score,
                reasons,
                workload,
                nearbyJobs: nearbyJobs.slice(0, 3),
                isRecommended: false, // Will be set later
                dateFormatted: date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                }),
                timeFormatted: `${formatTimeDisplay(minutesToTime(slot.start))} - ${formatTimeDisplay(minutesToTime(slot.start + jobDuration))}`
            });
        }
    }
    
    // Sort by score and mark top recommendation
    suggestions.sort((a, b) => b.score - a.score);
    
    if (suggestions.length > 0) {
        suggestions[0].isRecommended = true;
    }
    
    // Generate insights
    const scheduledJobs = allJobs.filter(j => j.scheduledTime || j.scheduledDate);
    const unscheduledJobs = allJobs.filter(j => !j.scheduledTime && !j.scheduledDate && !['completed', 'cancelled'].includes(j.status));
    
    // Check for geographic clusters in unscheduled jobs
    if (targetJob.serviceAddress?.coordinates && unscheduledJobs.length > 1) {
        const nearbyUnscheduled = unscheduledJobs.filter(job => {
            if (job.id === targetJob.id) return false;
            const coords = job.serviceAddress?.coordinates;
            if (!coords) return false;
            const distance = calculateDistance(
                targetJob.serviceAddress.coordinates.lat,
                targetJob.serviceAddress.coordinates.lng,
                coords.lat,
                coords.lng
            );
            return distance && distance < 10;
        });
        
        if (nearbyUnscheduled.length > 0) {
            insights.push({
                type: 'cluster',
                message: `${nearbyUnscheduled.length} other unscheduled job${nearbyUnscheduled.length > 1 ? 's' : ''} nearby - consider scheduling together`,
                jobs: nearbyUnscheduled.slice(0, 3)
            });
        }
    }
    
    // Workload insight
    const next7Days = [];
    for (let i = 1; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const workload = calculateDayWorkload(date, allJobs, preferences);
        next7Days.push({ date, ...workload });
    }
    
    const lightDays = next7Days.filter(d => d.isLight && !d.isFull);
    const fullDays = next7Days.filter(d => d.isFull);
    
    if (lightDays.length > 0 && fullDays.length > 0) {
        insights.push({
            type: 'workload_imbalance',
            message: `${fullDays.length} busy day${fullDays.length > 1 ? 's' : ''}, ${lightDays.length} light day${lightDays.length > 1 ? 's' : ''} this week`,
            lightDays,
            fullDays
        });
    }
    
    return {
        suggestions: suggestions.slice(0, 10), // Top 10 suggestions
        recommended: suggestions[0] || null,
        warnings,
        insights,
        meta: {
            analyzedDays: daysToAnalyze,
            totalSlotsFound: suggestions.length,
            jobDuration,
            hasCustomerPreferences: !!customerPrefs
        }
    };
};

/**
 * Quick suggest - returns just the top 3 recommendations
 */
export const getQuickSuggestions = (targetJob, allJobs, preferences, customerPrefs) => {
    const result = generateSchedulingSuggestions(targetJob, allJobs, preferences, customerPrefs, 7);
    return result.suggestions.slice(0, 3);
};

/**
 * Check for conflicts with a proposed time
 */
export const checkForConflicts = (proposedStart, proposedEnd, allJobs, preferences) => {
    const proposedDate = new Date(proposedStart);
    const dayJobs = getJobsForDate(allJobs, proposedDate);
    const buffer = preferences?.bufferMinutes || 30;
    
    const proposedStartMinutes = proposedDate.getHours() * 60 + proposedDate.getMinutes();
    const proposedEndDate = new Date(proposedEnd);
    const proposedEndMinutes = proposedEndDate.getHours() * 60 + proposedEndDate.getMinutes();
    
    const conflicts = [];
    
    for (const job of dayJobs) {
        const jobStart = new Date(job.scheduledTime || job.scheduledDate);
        const jobStartMinutes = jobStart.getHours() * 60 + jobStart.getMinutes();
        const jobDuration = job.estimatedDuration || preferences?.defaultJobDuration || 120;
        const jobEndMinutes = jobStartMinutes + jobDuration;
        
        // Check for overlap (including buffer)
        const overlapStart = Math.max(proposedStartMinutes, jobStartMinutes - buffer);
        const overlapEnd = Math.min(proposedEndMinutes, jobEndMinutes + buffer);
        
        if (overlapStart < overlapEnd) {
            conflicts.push({
                job,
                overlapMinutes: overlapEnd - overlapStart,
                message: `Conflicts with "${job.title || 'Job'}" at ${formatTimeDisplay(minutesToTime(jobStartMinutes))}`
            });
        }
    }
    
    return conflicts;
};

/**
 * Suggest optimal route order for a day's jobs
 */
export const suggestRouteOrder = (jobs, homeBase) => {
    if (jobs.length <= 1) return jobs;
    
    // Simple nearest-neighbor algorithm
    const orderedJobs = [];
    const remaining = [...jobs];
    
    let currentLocation = homeBase?.coordinates || null;
    
    while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        
        for (let i = 0; i < remaining.length; i++) {
            const jobCoords = remaining[i].serviceAddress?.coordinates;
            if (!jobCoords || !currentLocation) {
                // If no coordinates, just take first
                nearestIndex = 0;
                break;
            }
            
            const distance = calculateDistance(
                currentLocation.lat, currentLocation.lng,
                jobCoords.lat, jobCoords.lng
            );
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }
        
        const nextJob = remaining.splice(nearestIndex, 1)[0];
        orderedJobs.push(nextJob);
        currentLocation = nextJob.serviceAddress?.coordinates || currentLocation;
    }
    
    return orderedJobs;
};

export default {
    generateSchedulingSuggestions,
    getQuickSuggestions,
    checkForConflicts,
    suggestRouteOrder
};
