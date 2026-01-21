// src/features/contractor-pro/lib/multiDayJobService.js
// ============================================
// MULTI-DAY JOB AUTOMATION SERVICE
// ============================================
// Handles daily handoffs, crew continuity, progress tracking,
// and automated notifications for multi-day jobs.

import {
    doc,
    updateDoc,
    getDoc,
    serverTimestamp,
    arrayUnion,
    collection,
    addDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { getSegmentForDate, formatSegmentDisplay } from './multiDayUtils';

// ============================================
// CONSTANTS
// ============================================

export const DAILY_STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    PAUSED: 'paused',
    BLOCKED: 'blocked'
};

export const HANDOFF_TYPES = {
    END_OF_DAY: 'end_of_day',
    CREW_CHANGE: 'crew_change',
    ISSUE_HANDOFF: 'issue_handoff',
    RESUME: 'resume'
};

// ============================================
// DAILY PROGRESS TRACKING
// ============================================

/**
 * Record daily progress for a multi-day job
 * @param {string} jobId - Job ID
 * @param {Object} progressData - Daily progress data
 * @returns {Object} Result
 */
export const recordDailyProgress = async (jobId, progressData) => {
    try {
        const {
            date,
            dayNumber,
            crewIds,
            leadTechId,
            hoursWorked,
            percentComplete,
            workCompleted,
            issuesEncountered,
            materialsUsed,
            notes,
            photos,
            status = DAILY_STATUS.COMPLETED
        } = progressData;

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobDoc = await getDoc(jobRef);

        if (!jobDoc.exists()) {
            throw new Error('Job not found');
        }

        const job = jobDoc.data();

        // Create progress entry
        const progressEntry = {
            id: `day_${dayNumber}_${Date.now()}`,
            date,
            dayNumber,
            crewIds: crewIds || [],
            leadTechId,
            hoursWorked: hoursWorked || 0,
            percentComplete: percentComplete || 0,
            workCompleted: workCompleted || [],
            issuesEncountered: issuesEncountered || [],
            materialsUsed: materialsUsed || [],
            notes: notes || '',
            photos: photos || [],
            status,
            recordedAt: new Date().toISOString(),
            recordedBy: leadTechId
        };

        // Calculate overall progress
        const existingProgress = job.dailyProgress || [];
        const allProgress = [...existingProgress, progressEntry];
        const totalPercent = allProgress.reduce((sum, p) => sum + (p.percentComplete || 0), 0);
        const overallPercent = Math.min(100, Math.round(totalPercent / (job.multiDaySchedule?.totalDays || 1)));

        await updateDoc(jobRef, {
            dailyProgress: arrayUnion(progressEntry),
            overallProgressPercent: overallPercent,
            lastProgressUpdate: serverTimestamp(),
            lastUpdatedBy: leadTechId,
            // Update status based on progress
            ...(overallPercent >= 100 ? { status: 'pending_completion' } : {})
        });

        return {
            success: true,
            progressEntry,
            overallPercent
        };
    } catch (error) {
        console.error('[MultiDayJob] Error recording progress:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get progress for a specific day
 * @param {Object} job - Job object with dailyProgress
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Object|null} Daily progress entry
 */
export const getDailyProgress = (job, date) => {
    if (!job.dailyProgress?.length) return null;
    return job.dailyProgress.find(p => p.date === date) || null;
};

/**
 * Get overall progress summary
 * @param {Object} job - Job object
 * @returns {Object} Progress summary
 */
export const getProgressSummary = (job) => {
    const progress = job.dailyProgress || [];
    const schedule = job.multiDaySchedule;

    if (!schedule?.segments) {
        return {
            daysTotal: 1,
            daysCompleted: progress.filter(p => p.status === DAILY_STATUS.COMPLETED).length,
            percentComplete: job.overallProgressPercent || 0,
            hoursWorked: progress.reduce((sum, p) => sum + (p.hoursWorked || 0), 0),
            currentDay: 1,
            isComplete: job.status === 'completed'
        };
    }

    const today = new Date().toISOString().split('T')[0];
    const { segment } = getSegmentForDate(today, schedule);

    return {
        daysTotal: schedule.totalDays,
        daysCompleted: progress.filter(p => p.status === DAILY_STATUS.COMPLETED).length,
        percentComplete: job.overallProgressPercent || 0,
        hoursWorked: progress.reduce((sum, p) => sum + (p.hoursWorked || 0), 0),
        currentDay: segment?.dayNumber || null,
        isToday: !!segment,
        isComplete: job.status === 'completed',
        daysRemaining: schedule.totalDays - progress.filter(p => p.status === DAILY_STATUS.COMPLETED).length
    };
};

// ============================================
// CREW HANDOFF MANAGEMENT
// ============================================

/**
 * Create a handoff note for crew transition
 * @param {string} jobId - Job ID
 * @param {Object} handoffData - Handoff information
 * @returns {Object} Result
 */
export const createHandoff = async (jobId, handoffData) => {
    try {
        const {
            type = HANDOFF_TYPES.END_OF_DAY,
            fromCrewIds,
            toCrewIds,
            fromLeadTech,
            toLeadTech,
            date,
            dayNumber,
            workCompletedToday,
            workRemainingTomorrow,
            issues,
            materialsNeeded,
            accessNotes,
            safetyNotes,
            customerNotes,
            photos
        } = handoffData;

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        const handoffEntry = {
            id: `handoff_${Date.now()}`,
            type,
            date,
            dayNumber,
            from: {
                crewIds: fromCrewIds || [],
                leadTechId: fromLeadTech
            },
            to: {
                crewIds: toCrewIds || [],
                leadTechId: toLeadTech
            },
            workCompleted: workCompletedToday || [],
            workRemaining: workRemainingTomorrow || [],
            issues: issues || [],
            materialsNeeded: materialsNeeded || [],
            accessNotes: accessNotes || '',
            safetyNotes: safetyNotes || '',
            customerNotes: customerNotes || '',
            photos: photos || [],
            createdAt: new Date().toISOString(),
            createdBy: fromLeadTech
        };

        await updateDoc(jobRef, {
            handoffs: arrayUnion(handoffEntry),
            lastHandoffAt: serverTimestamp(),
            // If crew is changing, update the per-day assignment
            ...(toCrewIds && toCrewIds.length > 0 ? {
                [`perDayCrewAssignment.${date}`]: {
                    crewIds: toCrewIds,
                    leadTechId: toLeadTech
                }
            } : {})
        });

        return { success: true, handoff: handoffEntry };
    } catch (error) {
        console.error('[MultiDayJob] Error creating handoff:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get the latest handoff for a job
 * @param {Object} job - Job object with handoffs
 * @returns {Object|null} Latest handoff entry
 */
export const getLatestHandoff = (job) => {
    if (!job.handoffs?.length) return null;
    return job.handoffs[job.handoffs.length - 1];
};

/**
 * Get handoff for a specific date
 * @param {Object} job - Job object
 * @param {string} date - Date string
 * @returns {Object|null} Handoff entry
 */
export const getHandoffForDate = (job, date) => {
    if (!job.handoffs?.length) return null;
    return job.handoffs.find(h => h.date === date) || null;
};

// ============================================
// CREW CONTINUITY TRACKING
// ============================================

/**
 * Get crew continuity report for a multi-day job
 * Shows which crew worked each day and any changes
 * @param {Object} job - Job object
 * @returns {Object} Crew continuity report
 */
export const getCrewContinuityReport = (job) => {
    const schedule = job.multiDaySchedule;
    const progress = job.dailyProgress || [];
    const handoffs = job.handoffs || [];

    if (!schedule?.segments) {
        return {
            isMultiDay: false,
            totalDays: 1,
            crewChanges: 0,
            report: []
        };
    }

    const report = schedule.segments.map(segment => {
        const dayProgress = progress.find(p => p.date === segment.date);
        const dayHandoff = handoffs.find(h => h.date === segment.date);
        const perDayAssignment = job.perDayCrewAssignment?.[segment.date];

        return {
            date: segment.date,
            dayNumber: segment.dayNumber,
            scheduledCrewIds: perDayAssignment?.crewIds || job.assignedCrewIds || [],
            actualCrewIds: dayProgress?.crewIds || [],
            leadTechId: dayProgress?.leadTechId || perDayAssignment?.leadTechId || job.assignedTechId,
            status: dayProgress?.status || DAILY_STATUS.NOT_STARTED,
            hasHandoff: !!dayHandoff,
            handoffNotes: dayHandoff?.workRemaining || []
        };
    });

    // Count crew changes
    let crewChanges = 0;
    for (let i = 1; i < report.length; i++) {
        const prevCrew = new Set(report[i - 1].actualCrewIds);
        const currCrew = new Set(report[i].scheduledCrewIds);

        // Check if crew is different
        if (prevCrew.size !== currCrew.size ||
            [...prevCrew].some(id => !currCrew.has(id))) {
            crewChanges++;
        }
    }

    return {
        isMultiDay: true,
        totalDays: schedule.totalDays,
        crewChanges,
        report
    };
};

/**
 * Check if crew is consistent across all days
 * @param {Object} job - Job object
 * @returns {Object} Consistency check result
 */
export const checkCrewConsistency = (job) => {
    const schedule = job.multiDaySchedule;
    if (!schedule?.segments) {
        return { isConsistent: true, warnings: [] };
    }

    const warnings = [];
    const primaryCrew = new Set(job.assignedCrewIds || []);
    const primaryLead = job.assignedTechId;

    // Check per-day assignments for inconsistencies
    if (job.perDayCrewAssignment) {
        for (const [date, assignment] of Object.entries(job.perDayCrewAssignment)) {
            const dayCrew = new Set(assignment.crewIds || []);

            // Check for missing primary crew members
            const missingFromPrimary = [...primaryCrew].filter(id => !dayCrew.has(id));
            if (missingFromPrimary.length > 0) {
                warnings.push({
                    type: 'missing_crew',
                    date,
                    message: `${missingFromPrimary.length} primary crew member(s) not assigned`,
                    missingIds: missingFromPrimary
                });
            }

            // Check for lead tech change
            if (assignment.leadTechId && assignment.leadTechId !== primaryLead) {
                warnings.push({
                    type: 'lead_change',
                    date,
                    message: 'Different lead tech assigned',
                    originalLead: primaryLead,
                    newLead: assignment.leadTechId
                });
            }
        }
    }

    return {
        isConsistent: warnings.length === 0,
        warnings,
        primaryCrewIds: [...primaryCrew],
        primaryLeadId: primaryLead
    };
};

// ============================================
// PAUSE/RESUME MANAGEMENT
// ============================================

/**
 * Pause a job at end of day
 * @param {string} jobId - Job ID
 * @param {Object} pauseData - Pause information
 * @returns {Object} Result
 */
export const pauseJobForDay = async (jobId, pauseData) => {
    try {
        const {
            techId,
            date,
            dayNumber,
            notes,
            location,
            workCompleted,
            workRemaining
        } = pauseData;

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        const pauseEntry = {
            pausedAt: new Date().toISOString(),
            pausedBy: techId,
            pauseDate: date,
            dayNumber,
            notes: notes || '',
            location: location || null,
            workCompleted: workCompleted || [],
            workRemaining: workRemaining || [],
            resumeNeeded: true
        };

        await updateDoc(jobRef, {
            status: 'paused',
            pauseHistory: arrayUnion(pauseEntry),
            currentPause: pauseEntry,
            techCheckedIn: false,
            lastPausedAt: serverTimestamp()
        });

        return { success: true, pause: pauseEntry };
    } catch (error) {
        console.error('[MultiDayJob] Error pausing job:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Resume a paused job
 * @param {string} jobId - Job ID
 * @param {Object} resumeData - Resume information
 * @returns {Object} Result
 */
export const resumeJob = async (jobId, resumeData) => {
    try {
        const {
            techId,
            location,
            notes
        } = resumeData;

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobDoc = await getDoc(jobRef);

        if (!jobDoc.exists()) {
            throw new Error('Job not found');
        }

        const job = jobDoc.data();
        const currentPause = job.currentPause;

        await updateDoc(jobRef, {
            status: 'in_progress',
            currentPause: null,
            techCheckedIn: true,
            lastResumedAt: serverTimestamp(),
            lastResumedBy: techId,
            resumeHistory: arrayUnion({
                resumedAt: new Date().toISOString(),
                resumedBy: techId,
                previousPause: currentPause,
                location: location || null,
                notes: notes || ''
            })
        });

        return { success: true };
    } catch (error) {
        console.error('[MultiDayJob] Error resuming job:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// DAILY NOTIFICATIONS
// ============================================

/**
 * Get jobs that need daily start notifications
 * @param {string} contractorId - Contractor ID
 * @param {Array} jobs - All scheduled jobs
 * @param {string} date - Date to check (YYYY-MM-DD)
 * @returns {Array} Jobs needing notifications
 */
export const getJobsForDailyNotification = (jobs, date) => {
    return jobs.filter(job => {
        // Check if job is multi-day and scheduled for this date
        if (!job.multiDaySchedule?.segments) return false;

        const { segment } = getSegmentForDate(date, job.multiDaySchedule);
        if (!segment) return false;

        // Check if it's not the first day (day 1 has normal start notification)
        if (segment.dayNumber === 1) return false;

        // Check if there's already progress for today
        const todayProgress = job.dailyProgress?.find(p => p.date === date);
        if (todayProgress?.status === DAILY_STATUS.COMPLETED) return false;

        return true;
    }).map(job => {
        const { segment } = getSegmentForDate(date, job.multiDaySchedule);
        const previousHandoff = job.handoffs?.find(h =>
            h.date === job.multiDaySchedule.segments[segment.dayNumber - 2]?.date
        );

        return {
            ...job,
            currentSegment: segment,
            displayLabel: formatSegmentDisplay(segment, job.multiDaySchedule.totalDays),
            previousHandoff,
            workRemaining: previousHandoff?.workRemaining || []
        };
    });
};

/**
 * Generate daily summary for a multi-day job
 * @param {Object} job - Job object
 * @returns {Object} Daily summary
 */
export const generateDailySummary = (job) => {
    const today = new Date().toISOString().split('T')[0];
    const schedule = job.multiDaySchedule;

    if (!schedule?.segments) {
        return null;
    }

    const { segment, isInSchedule } = getSegmentForDate(today, schedule);

    if (!isInSchedule) {
        return null;
    }

    const previousProgress = job.dailyProgress || [];
    const todayProgress = previousProgress.find(p => p.date === today);
    const lastHandoff = getLatestHandoff(job);

    return {
        jobId: job.id,
        jobTitle: job.title || job.description,
        customer: job.customer?.name || job.customerName,
        address: job.customer?.address || job.address,
        dayNumber: segment.dayNumber,
        totalDays: schedule.totalDays,
        startTime: segment.startTime,
        endTime: segment.endTime,
        isFirstDay: segment.dayNumber === 1,
        isLastDay: segment.dayNumber === schedule.totalDays,
        previousDayStatus: previousProgress[previousProgress.length - 1]?.status || null,
        todayStatus: todayProgress?.status || DAILY_STATUS.NOT_STARTED,
        lastHandoffNotes: lastHandoff?.workRemaining || [],
        materialsNeeded: lastHandoff?.materialsNeeded || [],
        safetyNotes: lastHandoff?.safetyNotes || '',
        overallProgress: job.overallProgressPercent || 0
    };
};

export default {
    DAILY_STATUS,
    HANDOFF_TYPES,
    recordDailyProgress,
    getDailyProgress,
    getProgressSummary,
    createHandoff,
    getLatestHandoff,
    getHandoffForDate,
    getCrewContinuityReport,
    checkCrewConsistency,
    pauseJobForDay,
    resumeJob,
    getJobsForDailyNotification,
    generateDailySummary
};
