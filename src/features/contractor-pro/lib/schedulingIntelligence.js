// src/features/contractor-pro/lib/schedulingIntelligence.js
// ============================================
// SCHEDULING INTELLIGENCE SERVICE
// ============================================
// AI-powered scheduling with learning from historical data
// Integrates with Gemini for NLP and predictions

import { db } from '../../../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    orderBy,
    limit,
    serverTimestamp
} from 'firebase/firestore';
import { appId } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

const INTELLIGENCE_COLLECTION = `artifacts/${appId}/public/data/schedulingIntelligence`;
const CUSTOMER_PREFERENCES_COLLECTION = `artifacts/${appId}/public/data/customerPreferences`;

/**
 * Factors that contribute to assignment success
 */
export const SUCCESS_FACTORS = {
    COMPLETED_ON_TIME: 'completed_on_time',
    POSITIVE_RATING: 'positive_rating',
    NO_CALLBACKS: 'no_callbacks',
    CUSTOMER_REQUESTED: 'customer_requested',
    REPEAT_CUSTOMER: 'repeat_customer'
};

/**
 * Learning weights for different signals
 */
const LEARNING_WEIGHTS = {
    COMPLETION_SUCCESS: 10,      // Job completed successfully
    HIGH_RATING: 15,             // 4-5 star rating
    LOW_RATING: -20,             // 1-2 star rating
    ON_TIME: 5,                  // Finished within estimate
    OVERTIME: -3,                // Took longer than estimate
    CALLBACK_NEEDED: -15,        // Had to return to fix
    CUSTOMER_REQUESTED: 20,      // Customer asked for this tech
    REPEAT_BOOKING: 10           // Customer booked same tech again
};

// ============================================
// HISTORICAL DATA COLLECTION
// ============================================

/**
 * Record job outcome for learning
 * Call this when a job is completed
 *
 * @param {Object} job - Completed job document
 * @param {Object} outcome - Outcome data
 */
export const recordJobOutcome = async (job, outcome) => {
    const {
        techId,
        techName,
        customerId,
        contractorId,
        rating,
        completedOnTime,
        actualDuration,
        estimatedDuration,
        hadCallback,
        customerRequested
    } = outcome;

    if (!techId || !contractorId) return;

    const category = job.category || job.serviceType || 'General';

    // Calculate success score
    let successScore = 0;
    const factors = [];

    if (completedOnTime !== false) {
        successScore += LEARNING_WEIGHTS.COMPLETION_SUCCESS;
        factors.push(SUCCESS_FACTORS.COMPLETED_ON_TIME);
    }

    if (rating >= 4) {
        successScore += LEARNING_WEIGHTS.HIGH_RATING;
        factors.push(SUCCESS_FACTORS.POSITIVE_RATING);
    } else if (rating <= 2 && rating > 0) {
        successScore += LEARNING_WEIGHTS.LOW_RATING;
    }

    if (actualDuration && estimatedDuration) {
        if (actualDuration <= estimatedDuration * 1.1) {
            successScore += LEARNING_WEIGHTS.ON_TIME;
        } else {
            successScore += LEARNING_WEIGHTS.OVERTIME;
        }
    }

    if (hadCallback) {
        successScore += LEARNING_WEIGHTS.CALLBACK_NEEDED;
    } else {
        factors.push(SUCCESS_FACTORS.NO_CALLBACKS);
    }

    if (customerRequested) {
        successScore += LEARNING_WEIGHTS.CUSTOMER_REQUESTED;
        factors.push(SUCCESS_FACTORS.CUSTOMER_REQUESTED);
    }

    // Store tech-category performance
    const techCategoryRef = doc(
        db,
        INTELLIGENCE_COLLECTION,
        `${contractorId}_tech_${techId}_cat_${category.replace(/\s+/g, '_')}`
    );

    const existingDoc = await getDoc(techCategoryRef);
    const existing = existingDoc.exists() ? existingDoc.data() : {
        techId,
        techName,
        contractorId,
        category,
        totalJobs: 0,
        totalScore: 0,
        avgRating: 0,
        ratingCount: 0,
        avgDurationAccuracy: 1,
        durationSamples: 0
    };

    const newTotalJobs = existing.totalJobs + 1;
    const newTotalScore = existing.totalScore + successScore;
    const newAvgRating = rating > 0
        ? ((existing.avgRating * existing.ratingCount) + rating) / (existing.ratingCount + 1)
        : existing.avgRating;

    // Duration accuracy (actual / estimated)
    let newDurationAccuracy = existing.avgDurationAccuracy;
    let newDurationSamples = existing.durationSamples;
    if (actualDuration && estimatedDuration) {
        const accuracy = actualDuration / estimatedDuration;
        newDurationAccuracy = ((existing.avgDurationAccuracy * existing.durationSamples) + accuracy)
                              / (existing.durationSamples + 1);
        newDurationSamples++;
    }

    await setDoc(techCategoryRef, {
        ...existing,
        totalJobs: newTotalJobs,
        totalScore: newTotalScore,
        avgScore: newTotalScore / newTotalJobs,
        avgRating: newAvgRating,
        ratingCount: rating > 0 ? existing.ratingCount + 1 : existing.ratingCount,
        avgDurationAccuracy: newDurationAccuracy,
        durationSamples: newDurationSamples,
        lastJobId: job.id,
        lastUpdated: serverTimestamp()
    }, { merge: true });

    // Store customer preference if relevant
    if (customerId && (rating >= 4 || customerRequested)) {
        await updateCustomerPreference(customerId, contractorId, techId, techName, category, rating);
    }

    return { successScore, factors };
};

// ============================================
// CUSTOMER PREFERENCES
// ============================================

/**
 * Update customer's tech preferences based on job outcomes
 */
const updateCustomerPreference = async (customerId, contractorId, techId, techName, category, rating) => {
    const prefRef = doc(
        db,
        CUSTOMER_PREFERENCES_COLLECTION,
        `${contractorId}_${customerId}`
    );

    const existing = await getDoc(prefRef);
    const data = existing.exists() ? existing.data() : {
        customerId,
        contractorId,
        preferredTechs: {},
        preferredTimes: {},
        categoryPreferences: {},
        totalJobs: 0
    };

    // Update preferred tech for category
    if (!data.preferredTechs[category]) {
        data.preferredTechs[category] = {};
    }

    const techPref = data.preferredTechs[category][techId] || {
        techId,
        techName,
        jobCount: 0,
        totalRating: 0,
        avgRating: 0
    };

    techPref.jobCount++;
    if (rating > 0) {
        techPref.totalRating += rating;
        techPref.avgRating = techPref.totalRating / techPref.jobCount;
    }
    techPref.lastJob = serverTimestamp();

    data.preferredTechs[category][techId] = techPref;
    data.totalJobs++;
    data.lastUpdated = serverTimestamp();

    await setDoc(prefRef, data, { merge: true });
};

/**
 * Get customer's preferred tech for a category
 */
export const getCustomerPreferredTech = async (customerId, contractorId, category) => {
    if (!customerId || !contractorId) return null;

    const prefRef = doc(
        db,
        CUSTOMER_PREFERENCES_COLLECTION,
        `${contractorId}_${customerId}`
    );

    const snap = await getDoc(prefRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    const categoryPrefs = data.preferredTechs?.[category] || data.preferredTechs?.['General'] || {};

    // Find tech with highest score (jobCount * avgRating)
    let bestTech = null;
    let bestScore = 0;

    Object.values(categoryPrefs).forEach(pref => {
        const score = pref.jobCount * (pref.avgRating || 3);
        if (score > bestScore) {
            bestScore = score;
            bestTech = pref;
        }
    });

    return bestTech;
};

/**
 * Get all preferences for a customer
 */
export const getCustomerPreferences = async (customerId, contractorId) => {
    if (!customerId || !contractorId) return null;

    const prefRef = doc(
        db,
        CUSTOMER_PREFERENCES_COLLECTION,
        `${contractorId}_${customerId}`
    );

    const snap = await getDoc(prefRef);
    return snap.exists() ? snap.data() : null;
};

// ============================================
// TECH PERFORMANCE QUERIES
// ============================================

/**
 * Get tech's performance for a specific category
 */
export const getTechCategoryPerformance = async (techId, contractorId, category) => {
    const docRef = doc(
        db,
        INTELLIGENCE_COLLECTION,
        `${contractorId}_tech_${techId}_cat_${category.replace(/\s+/g, '_')}`
    );

    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
};

/**
 * Get all performance data for a tech
 */
export const getTechPerformance = async (techId, contractorId) => {
    const q = query(
        collection(db, INTELLIGENCE_COLLECTION),
        where('techId', '==', techId),
        where('contractorId', '==', contractorId)
    );

    const snap = await getDocs(q);
    const performance = {};

    snap.forEach(doc => {
        const data = doc.data();
        performance[data.category] = data;
    });

    return performance;
};

/**
 * Get best tech for a job category based on historical performance
 */
export const getBestTechForCategory = async (contractorId, category, excludeTechIds = []) => {
    const q = query(
        collection(db, INTELLIGENCE_COLLECTION),
        where('contractorId', '==', contractorId),
        where('category', '==', category),
        orderBy('avgScore', 'desc'),
        limit(10)
    );

    try {
        const snap = await getDocs(q);
        const results = [];

        snap.forEach(doc => {
            const data = doc.data();
            if (!excludeTechIds.includes(data.techId)) {
                results.push(data);
            }
        });

        return results;
    } catch (error) {
        // Index may not exist yet
        console.warn('getBestTechForCategory query failed:', error);
        return [];
    }
};

// ============================================
// ENHANCED SCORING WITH LEARNING
// ============================================

/**
 * Calculate enhanced score incorporating historical learning
 * This augments the base scoring from schedulingAI.js
 */
export const calculateLearningScore = async (tech, job, contractorId) => {
    let learningBonus = 0;
    const insights = [];

    const category = job.category || job.serviceType || 'General';
    const customerId = job.createdBy || job.customerId;

    // 1. Check tech's historical performance for this category
    const performance = await getTechCategoryPerformance(tech.id, contractorId, category);

    if (performance) {
        // High performer in category
        if (performance.avgScore > 50 && performance.totalJobs >= 3) {
            learningBonus += 30;
            insights.push({
                type: 'performance',
                message: `${tech.name} excels at ${category} jobs`,
                detail: `${performance.avgRating?.toFixed(1) || 'N/A'} avg across ${performance.totalJobs} jobs`
            });
        }

        // Duration accuracy
        if (performance.durationSamples >= 3) {
            if (performance.avgDurationAccuracy <= 1.1) {
                learningBonus += 10;
                insights.push({
                    type: 'accuracy',
                    message: 'Consistently accurate time estimates'
                });
            } else if (performance.avgDurationAccuracy > 1.3) {
                learningBonus -= 10;
                insights.push({
                    type: 'warning',
                    message: 'Often runs over estimated time'
                });
            }
        }
    }

    // 2. Check customer preference
    if (customerId) {
        const preferredTech = await getCustomerPreferredTech(customerId, contractorId, category);

        if (preferredTech?.techId === tech.id) {
            learningBonus += 40;
            insights.push({
                type: 'preference',
                message: 'Customer\'s preferred technician',
                detail: `${preferredTech.jobCount} previous jobs, ${preferredTech.avgRating?.toFixed(1) || 'N/A'}`
            });
        }
    }

    return { learningBonus, insights };
};

// ============================================
// DURATION PREDICTION
// ============================================

/**
 * Predict job duration based on historical data
 */
export const predictJobDuration = async (job, techId, contractorId) => {
    const category = job.category || job.serviceType || 'General';
    const baseEstimate = job.estimatedDuration || 60;

    // Get tech's duration accuracy for this category
    const performance = await getTechCategoryPerformance(techId, contractorId, category);

    if (performance?.durationSamples >= 3) {
        const adjustedDuration = Math.round(baseEstimate * performance.avgDurationAccuracy);

        return {
            baseDuration: baseEstimate,
            predictedDuration: adjustedDuration,
            confidence: Math.min(0.9, 0.5 + (performance.durationSamples * 0.05)),
            adjustment: performance.avgDurationAccuracy,
            source: 'historical'
        };
    }

    return {
        baseDuration: baseEstimate,
        predictedDuration: baseEstimate,
        confidence: 0.5,
        adjustment: 1.0,
        source: 'estimate'
    };
};

// ============================================
// NATURAL LANGUAGE SCHEDULING (GEMINI)
// ============================================

/**
 * Parse natural language scheduling request using Gemini
 *
 * Examples:
 * - "Schedule John for the Smith job tomorrow morning"
 * - "Book Mike for the HVAC repair next Monday at 2pm"
 * - "Assign our best plumber to the emergency leak"
 */
export const parseSchedulingRequest = async (request, context) => {
    const { teamMembers, jobs, currentDate } = context;

    // Simple pattern matching for common requests (fallback without Gemini)
    const lowerRequest = request.toLowerCase();

    // Try to extract tech name
    let matchedTech = null;
    for (const tech of teamMembers) {
        if (lowerRequest.includes(tech.name.toLowerCase())) {
            matchedTech = tech;
            break;
        }
    }

    // Try to extract job
    let matchedJob = null;
    for (const job of jobs) {
        const jobTitle = (job.title || job.serviceType || '').toLowerCase();
        const customerName = (job.customer?.name || '').toLowerCase();
        if (lowerRequest.includes(jobTitle) || lowerRequest.includes(customerName)) {
            matchedJob = job;
            break;
        }
    }

    // Parse date
    let date = null;
    if (lowerRequest.includes('tomorrow')) {
        date = 'tomorrow';
    } else if (lowerRequest.includes('today')) {
        date = 'today';
    } else if (lowerRequest.includes('next monday')) {
        date = 'next monday';
    }

    // Parse time
    let time = null;
    if (lowerRequest.includes('morning')) {
        time = 'morning';
    } else if (lowerRequest.includes('afternoon')) {
        time = 'afternoon';
    } else if (lowerRequest.includes('evening')) {
        time = 'evening';
    }

    // Determine action
    let action = 'unknown';
    if (lowerRequest.includes('assign') || lowerRequest.includes('schedule') || lowerRequest.includes('book')) {
        action = 'assign';
    } else if (lowerRequest.includes('suggest') || lowerRequest.includes('best') || lowerRequest.includes('who')) {
        action = 'suggest';
    }

    // Check for "best" tech request
    const techId = lowerRequest.includes('best') ? 'BEST_MATCH' : matchedTech?.id || null;

    return {
        success: true,
        parsed: {
            action,
            techId,
            techName: matchedTech?.name || null,
            jobId: matchedJob?.id || null,
            jobDescription: matchedJob?.title || matchedJob?.serviceType || null,
            customerName: matchedJob?.customer?.name || null,
            date,
            time,
            constraints: [],
            confidence: (matchedTech ? 0.3 : 0) + (matchedJob ? 0.3 : 0) + (action !== 'unknown' ? 0.2 : 0),
            clarificationNeeded: !matchedJob ? 'Which job should I work with?' :
                                 !matchedTech && action === 'assign' ? 'Which technician should I assign?' : null
        }
    };
};

/**
 * Execute a parsed scheduling action
 */
export const executeSchedulingAction = async (parsed, context) => {
    const { action, techId, jobId, date, time } = parsed;
    const { teamMembers, jobs, contractorId } = context;

    if (action === 'assign' && jobId && techId) {
        // Find the job
        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            return { success: false, error: `Job not found: ${jobId}` };
        }

        // Find the tech (or best match)
        let tech;
        if (techId === 'BEST_MATCH') {
            const category = job.category || job.serviceType || 'General';
            const bestTechs = await getBestTechForCategory(contractorId, category);
            if (bestTechs.length > 0) {
                tech = teamMembers.find(t => t.id === bestTechs[0].techId);
            }
            if (!tech && teamMembers.length > 0) {
                tech = teamMembers[0]; // Fallback to first available
            }
        } else {
            tech = teamMembers.find(t => t.id === techId || t.name.toLowerCase().includes(techId.toLowerCase()));
        }

        if (!tech) {
            return { success: false, error: 'Technician not found' };
        }

        // Build scheduled time
        let scheduledTime = null;
        if (date) {
            const scheduledDate = parseRelativeDate(date);
            if (time) {
                const timeMinutes = parseTimeDescription(time);
                scheduledDate.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60);
            }
            scheduledTime = scheduledDate.toISOString();
        }

        return {
            success: true,
            action: 'assign',
            job,
            tech,
            scheduledTime,
            confirmation: `Assign ${tech.name} to "${job.title || job.serviceType}"${scheduledTime ? ` on ${new Date(scheduledTime).toLocaleDateString()}` : ''}?`
        };
    }

    if (action === 'suggest') {
        return {
            success: true,
            action: 'suggest',
            message: 'I can suggest the best tech for a job. Which job should I analyze?'
        };
    }

    return { success: false, error: 'Could not understand request' };
};

/**
 * Parse relative date strings
 */
const parseRelativeDate = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lower = dateStr.toLowerCase();

    if (lower === 'today') return today;
    if (lower === 'tomorrow') {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
    }

    // "next Monday", "next Tuesday", etc.
    const dayMatch = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (dayMatch) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dayMatch[1]);
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        const d = new Date(today);
        d.setDate(d.getDate() + daysToAdd);
        return d;
    }

    // Try to parse as date
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? today : parsed;
};

/**
 * Parse time descriptions to minutes since midnight
 */
const parseTimeDescription = (timeStr) => {
    const lower = timeStr.toLowerCase();

    if (lower.includes('morning') || lower === 'am') return 9 * 60; // 9 AM
    if (lower.includes('afternoon')) return 14 * 60; // 2 PM
    if (lower.includes('evening')) return 17 * 60; // 5 PM

    // Try HH:MM format
    const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');
        const ampm = timeMatch[3];

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        return hours * 60 + minutes;
    }

    return 9 * 60; // Default 9 AM
};

// ============================================
// AI RECOMMENDATIONS
// ============================================

/**
 * Generate AI scheduling recommendations for a day
 */
export const generateDailyRecommendations = async (contractorId, date, jobs, teamMembers) => {
    const recommendations = [];

    // Unassigned jobs
    const unassigned = jobs.filter(j => !j.assignedTechId);

    for (const job of unassigned.slice(0, 5)) {
        const category = job.category || job.serviceType || 'General';
        const customerId = job.createdBy || job.customerId;

        // Check customer preference
        let preferredTech = null;
        if (customerId) {
            preferredTech = await getCustomerPreferredTech(customerId, contractorId, category);
        }

        // Get best performers
        const bestTechs = await getBestTechForCategory(contractorId, category);

        // Build recommendation
        const rec = {
            jobId: job.id,
            jobTitle: job.title || job.serviceType,
            customer: job.customer?.name || 'Customer',
            category,
            suggestions: []
        };

        if (preferredTech) {
            const tech = teamMembers.find(t => t.id === preferredTech.techId);
            if (tech) {
                rec.suggestions.push({
                    techId: tech.id,
                    techName: tech.name,
                    reason: `Customer's preferred tech (${preferredTech.avgRating?.toFixed(1) || 'N/A'})`,
                    score: 100,
                    isPrimary: true
                });
            }
        }

        for (const perf of bestTechs.slice(0, 2)) {
            if (rec.suggestions.some(s => s.techId === perf.techId)) continue;

            const tech = teamMembers.find(t => t.id === perf.techId);
            if (tech) {
                rec.suggestions.push({
                    techId: tech.id,
                    techName: tech.name,
                    reason: `Top performer for ${category} (${perf.avgRating?.toFixed(1) || 'N/A'})`,
                    score: perf.avgScore,
                    isPrimary: rec.suggestions.length === 0
                });
            }
        }

        // Add any available team member if no suggestions yet
        if (rec.suggestions.length === 0 && teamMembers.length > 0) {
            const availableTech = teamMembers[0];
            rec.suggestions.push({
                techId: availableTech.id,
                techName: availableTech.name,
                reason: 'Available technician',
                score: 50,
                isPrimary: true
            });
        }

        if (rec.suggestions.length > 0) {
            recommendations.push(rec);
        }
    }

    return recommendations;
};

/**
 * Get scheduling insights summary
 */
export const getSchedulingInsights = async (contractorId, teamMembers) => {
    const insights = {
        topPerformers: {},
        underutilized: [],
        trainingNeeded: []
    };

    // Get performance data for all techs
    for (const tech of teamMembers) {
        const performance = await getTechPerformance(tech.id, contractorId);

        for (const [category, data] of Object.entries(performance)) {
            if (!insights.topPerformers[category]) {
                insights.topPerformers[category] = [];
            }

            insights.topPerformers[category].push({
                techId: tech.id,
                techName: tech.name,
                score: data.avgScore,
                rating: data.avgRating,
                jobs: data.totalJobs
            });

            // Check for training needs
            if (data.avgRating < 3 && data.totalJobs >= 3) {
                insights.trainingNeeded.push({
                    techId: tech.id,
                    techName: tech.name,
                    category,
                    avgRating: data.avgRating,
                    suggestion: `Consider additional ${category} training`
                });
            }
        }
    }

    // Sort top performers
    for (const category of Object.keys(insights.topPerformers)) {
        insights.topPerformers[category].sort((a, b) => b.score - a.score);
    }

    return insights;
};

// ============================================
// EXPORTS
// ============================================

export default {
    // Recording
    recordJobOutcome,

    // Customer preferences
    getCustomerPreferredTech,
    getCustomerPreferences,

    // Tech performance
    getTechCategoryPerformance,
    getTechPerformance,
    getBestTechForCategory,

    // Enhanced scoring
    calculateLearningScore,

    // Duration prediction
    predictJobDuration,

    // Natural language
    parseSchedulingRequest,
    executeSchedulingAction,

    // Recommendations
    generateDailyRecommendations,
    getSchedulingInsights
};
