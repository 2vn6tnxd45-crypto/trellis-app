// src/features/jobs/lib/jobLifecycleService.js
// ============================================
// JOB LIFECYCLE SERVICE
// ============================================
// Utilities for detecting and handling jobs in limbo states
// Prevents jobs from "slipping through the cracks"

import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// LIMBO STATE DEFINITIONS
// ============================================

/**
 * Define what constitutes a "limbo" state and when to alert
 */
export const LIMBO_STATES = {
    // Cancellation requested but not resolved
    CANCELLATION_PENDING: {
        status: 'cancellation_requested',
        maxAge: 48 * 60 * 60 * 1000, // 48 hours
        severity: 'high',
        message: 'Cancellation request pending contractor response'
    },
    // Completion submitted but not reviewed
    COMPLETION_PENDING: {
        status: 'pending_completion',
        maxAge: 5 * 24 * 60 * 60 * 1000, // 5 days (before 7-day auto-approve)
        severity: 'medium',
        message: 'Completion pending homeowner review'
    },
    // Revision requested but not resubmitted
    REVISION_PENDING: {
        status: 'revision_requested',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        severity: 'medium',
        message: 'Revision requested but not resubmitted'
    },
    // Homeowner lookup pending (job created but homeowner not linked)
    HOMEOWNER_UNLINKED: {
        status: 'homeownerLookupPending',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        severity: 'low',
        message: 'Homeowner account not yet linked'
    },
    // Quote accepted but job not scheduled
    UNSCHEDULED: {
        checkField: 'scheduledDate',
        checkValue: null,
        statusIn: ['accepted', 'confirmed'],
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        severity: 'medium',
        message: 'Job confirmed but not yet scheduled'
    },
    // Scheduled job that's past its date but not completed
    PAST_DUE: {
        checkField: 'scheduledDate',
        checkPastDue: true,
        statusNotIn: ['completed', 'cancelled', 'pending_completion'],
        maxAge: 24 * 60 * 60 * 1000, // 1 day past scheduled date
        severity: 'high',
        message: 'Scheduled date passed but job not marked complete'
    }
};

// ============================================
// RECONCILIATION FUNCTIONS
// ============================================

/**
 * Find all jobs in limbo states for a contractor
 *
 * @param {string} contractorId - The contractor's ID
 * @returns {Promise<{limboJobs: Array, summary: Object}>}
 */
export const findLimboJobs = async (contractorId) => {
    const limboJobs = [];
    const now = Date.now();

    try {
        // Query all active jobs for this contractor
        const jobsQuery = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where('contractorId', '==', contractorId),
            where('status', 'not-in', ['completed', 'cancelled']),
            orderBy('lastActivity', 'desc')
        );

        const snapshot = await getDocs(jobsQuery);
        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        for (const job of jobs) {
            const issues = detectLimboIssues(job, now);
            if (issues.length > 0) {
                limboJobs.push({
                    ...job,
                    limboIssues: issues,
                    highestSeverity: getHighestSeverity(issues)
                });
            }
        }

        // Sort by severity (high first)
        limboJobs.sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.highestSeverity] - severityOrder[b.highestSeverity];
        });

        return {
            limboJobs,
            summary: {
                total: limboJobs.length,
                high: limboJobs.filter(j => j.highestSeverity === 'high').length,
                medium: limboJobs.filter(j => j.highestSeverity === 'medium').length,
                low: limboJobs.filter(j => j.highestSeverity === 'low').length
            }
        };

    } catch (error) {
        console.error('[findLimboJobs] Error:', error);
        return { limboJobs: [], summary: { total: 0, high: 0, medium: 0, low: 0 } };
    }
};

/**
 * Detect limbo issues for a single job
 */
const detectLimboIssues = (job, now) => {
    const issues = [];
    const lastActivityTime = getTimestamp(job.lastActivity) || getTimestamp(job.createdAt) || 0;
    const age = now - lastActivityTime;

    // Check cancellation pending
    if (job.status === 'cancellation_requested') {
        const requestedAt = getTimestamp(job.cancellationRequest?.requestedAt) || lastActivityTime;
        const requestAge = now - requestedAt;
        if (requestAge > LIMBO_STATES.CANCELLATION_PENDING.maxAge) {
            issues.push({
                type: 'CANCELLATION_PENDING',
                ...LIMBO_STATES.CANCELLATION_PENDING,
                age: requestAge,
                ageFormatted: formatAge(requestAge)
            });
        }
    }

    // Check completion pending
    if (job.status === 'pending_completion') {
        const submittedAt = getTimestamp(job.completion?.submittedAt) || lastActivityTime;
        const submissionAge = now - submittedAt;
        if (submissionAge > LIMBO_STATES.COMPLETION_PENDING.maxAge) {
            issues.push({
                type: 'COMPLETION_PENDING',
                ...LIMBO_STATES.COMPLETION_PENDING,
                age: submissionAge,
                ageFormatted: formatAge(submissionAge),
                autoApproveIn: formatAge(7 * 24 * 60 * 60 * 1000 - submissionAge)
            });
        }
    }

    // Check revision pending
    if (job.status === 'revision_requested') {
        const requestedAt = getTimestamp(job.completion?.revisionRequest?.requestedAt) || lastActivityTime;
        const requestAge = now - requestedAt;
        if (requestAge > LIMBO_STATES.REVISION_PENDING.maxAge) {
            issues.push({
                type: 'REVISION_PENDING',
                ...LIMBO_STATES.REVISION_PENDING,
                age: requestAge,
                ageFormatted: formatAge(requestAge)
            });
        }
    }

    // Check homeowner unlinked
    if (job.homeownerLookupPending && age > LIMBO_STATES.HOMEOWNER_UNLINKED.maxAge) {
        issues.push({
            type: 'HOMEOWNER_UNLINKED',
            ...LIMBO_STATES.HOMEOWNER_UNLINKED,
            age,
            ageFormatted: formatAge(age)
        });
    }

    // Check unscheduled jobs
    if (['accepted', 'confirmed'].includes(job.status) && !job.scheduledDate) {
        const acceptedAt = getTimestamp(job.acceptedAt) || lastActivityTime;
        const waitingAge = now - acceptedAt;
        if (waitingAge > LIMBO_STATES.UNSCHEDULED.maxAge) {
            issues.push({
                type: 'UNSCHEDULED',
                ...LIMBO_STATES.UNSCHEDULED,
                age: waitingAge,
                ageFormatted: formatAge(waitingAge)
            });
        }
    }

    // Check past due jobs
    if (job.scheduledDate && !['completed', 'cancelled', 'pending_completion'].includes(job.status)) {
        const scheduledTime = getTimestamp(job.scheduledDate);
        if (scheduledTime && now > scheduledTime + LIMBO_STATES.PAST_DUE.maxAge) {
            const overdueBy = now - scheduledTime;
            issues.push({
                type: 'PAST_DUE',
                ...LIMBO_STATES.PAST_DUE,
                age: overdueBy,
                ageFormatted: formatAge(overdueBy),
                scheduledDate: new Date(scheduledTime).toLocaleDateString()
            });
        }
    }

    return issues;
};

// ============================================
// GUARDRAIL FUNCTIONS
// ============================================

/**
 * Check if a job is in a valid state to perform an action
 * Prevents working on cancelled jobs, etc.
 *
 * @param {Object} job - The job object
 * @param {string} action - The action being attempted
 * @returns {{allowed: boolean, reason?: string}}
 */
export const canPerformAction = (job, action) => {
    // Map of actions to invalid statuses
    const invalidStatusesForAction = {
        'schedule': ['cancelled', 'completed', 'pending_completion'],
        'assign_tech': ['cancelled', 'completed'],
        'start_work': ['cancelled', 'completed', 'pending_completion'],
        'complete': ['cancelled', 'completed', 'pending_completion'],
        'message': ['cancelled'], // Allow messaging on completed jobs for follow-up
        'invoice': ['cancelled'],
        'collect_payment': ['cancelled']
    };

    const invalidStatuses = invalidStatusesForAction[action] || [];

    if (invalidStatuses.includes(job.status)) {
        return {
            allowed: false,
            reason: `Cannot ${action.replace('_', ' ')} - job is ${job.status}`
        };
    }

    // Additional checks
    if (action === 'start_work' && job.status === 'cancellation_requested') {
        return {
            allowed: false,
            reason: 'Cannot start work - cancellation request pending'
        };
    }

    return { allowed: true };
};

/**
 * Validate job status transition
 * Ensures status changes follow valid paths
 *
 * @param {string} currentStatus - Current job status
 * @param {string} newStatus - Proposed new status
 * @returns {{valid: boolean, reason?: string}}
 */
export const validateStatusTransition = (currentStatus, newStatus) => {
    // Define valid transitions
    const validTransitions = {
        'pending': ['accepted', 'cancelled', 'scheduled'],
        'accepted': ['scheduled', 'cancelled', 'cancellation_requested', 'confirmed'],
        'confirmed': ['scheduled', 'cancelled', 'cancellation_requested'],
        'scheduled': ['in_progress', 'cancelled', 'cancellation_requested', 'pending_completion', 'completed'],
        'in_progress': ['pending_completion', 'cancelled', 'cancellation_requested', 'completed'],
        'pending_completion': ['completed', 'revision_requested'],
        'revision_requested': ['pending_completion', 'completed'],
        'cancellation_requested': ['cancelled', 'scheduled', 'confirmed'], // Can restore to previous state
        'cancelled': [], // Terminal state
        'completed': [] // Terminal state
    };

    const allowedNextStatuses = validTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
        return {
            valid: false,
            reason: `Cannot transition from '${currentStatus}' to '${newStatus}'`
        };
    }

    return { valid: true };
};

// ============================================
// ALERT GENERATION
// ============================================

/**
 * Generate alerts for jobs in limbo states
 * Can be used by dashboard or notification systems
 *
 * @param {Array} limboJobs - Array of jobs with limbo issues
 * @returns {Array} Alert objects
 */
export const generateLimboAlerts = (limboJobs) => {
    return limboJobs.map(job => {
        const primaryIssue = job.limboIssues[0]; // Highest priority issue

        return {
            id: `limbo_${job.id}_${primaryIssue.type}`,
            jobId: job.id,
            severity: primaryIssue.severity,
            type: primaryIssue.type,
            title: getAlertTitle(primaryIssue, job),
            message: primaryIssue.message,
            age: primaryIssue.ageFormatted,
            actions: getRecommendedActions(primaryIssue, job),
            job: {
                id: job.id,
                title: job.title || job.description || 'Service Job',
                customerName: job.customerName || job.customer?.name,
                status: job.status
            }
        };
    });
};

/**
 * Get alert title based on issue type
 */
const getAlertTitle = (issue, job) => {
    const customerName = job.customerName || job.customer?.name || 'Customer';
    const jobTitle = job.title || job.description || 'Job';

    switch (issue.type) {
        case 'CANCELLATION_PENDING':
            return `${customerName} is waiting for cancellation response`;
        case 'COMPLETION_PENDING':
            return `${customerName} hasn't reviewed "${jobTitle}" yet`;
        case 'REVISION_PENDING':
            return `Revision needed for "${jobTitle}"`;
        case 'HOMEOWNER_UNLINKED':
            return `${customerName} hasn't linked their account`;
        case 'UNSCHEDULED':
            return `"${jobTitle}" needs to be scheduled`;
        case 'PAST_DUE':
            return `"${jobTitle}" is past its scheduled date`;
        default:
            return `Action needed for "${jobTitle}"`;
    }
};

/**
 * Get recommended actions for an issue
 */
const getRecommendedActions = (issue, job) => {
    switch (issue.type) {
        case 'CANCELLATION_PENDING':
            return [
                { label: 'Review Request', action: 'openCancellationModal' },
                { label: 'Message Customer', action: 'openChat' }
            ];
        case 'COMPLETION_PENDING':
            return [
                { label: 'Send Reminder', action: 'sendCompletionReminder' },
                { label: 'View Submission', action: 'viewCompletion' }
            ];
        case 'REVISION_PENDING':
            return [
                { label: 'View Feedback', action: 'viewRevisionRequest' },
                { label: 'Update Completion', action: 'editCompletion' }
            ];
        case 'HOMEOWNER_UNLINKED':
            return [
                { label: 'Resend Invite', action: 'resendInvite' },
                { label: 'Update Email', action: 'editCustomerEmail' }
            ];
        case 'UNSCHEDULED':
            return [
                { label: 'Schedule Now', action: 'openScheduler' },
                { label: 'Offer Times', action: 'offerTimeSlots' }
            ];
        case 'PAST_DUE':
            return [
                { label: 'Mark Complete', action: 'openCompletionForm' },
                { label: 'Reschedule', action: 'openScheduler' }
            ];
        default:
            return [{ label: 'View Job', action: 'viewJob' }];
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert various timestamp formats to milliseconds
 */
const getTimestamp = (value) => {
    if (!value) return null;
    if (value instanceof Timestamp) return value.toMillis();
    if (value.toDate) return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return new Date(value).getTime();
    return null;
};

/**
 * Format age in human-readable format
 */
const formatAge = (ms) => {
    if (ms < 0) return 'now';

    const hours = Math.floor(ms / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    const minutes = Math.floor(ms / (60 * 1000));
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
};

/**
 * Get highest severity from a list of issues
 */
const getHighestSeverity = (issues) => {
    if (issues.some(i => i.severity === 'high')) return 'high';
    if (issues.some(i => i.severity === 'medium')) return 'medium';
    return 'low';
};

// ============================================
// EXPORTS
// ============================================

export default {
    LIMBO_STATES,
    findLimboJobs,
    canPerformAction,
    validateStatusTransition,
    generateLimboAlerts
};
