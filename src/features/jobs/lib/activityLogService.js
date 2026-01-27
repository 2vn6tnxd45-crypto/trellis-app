// src/features/jobs/lib/activityLogService.js
// ============================================
// JOB ACTIVITY LOG SERVICE
// ============================================
// Tracks all significant events in a job's lifecycle
// Provides audit trail for contractors and customers

import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

// Activity event types
export const ACTIVITY_TYPES = {
    // Job lifecycle
    JOB_CREATED: 'job_created',
    JOB_UPDATED: 'job_updated',

    // Scheduling
    TIME_SLOTS_OFFERED: 'time_slots_offered',
    TIME_SLOT_SELECTED: 'time_slot_selected',
    JOB_SCHEDULED: 'job_scheduled',
    JOB_RESCHEDULED: 'job_rescheduled',

    // Status changes
    STATUS_CHANGED: 'status_changed',
    JOB_STARTED: 'job_started',
    JOB_COMPLETED: 'job_completed',
    JOB_CANCELLED: 'job_cancelled',

    // Crew
    CREW_ASSIGNED: 'crew_assigned',
    CREW_UPDATED: 'crew_updated',

    // Communication
    NOTIFICATION_SENT: 'notification_sent',
    MESSAGE_SENT: 'message_sent',

    // Payment
    INVOICE_SENT: 'invoice_sent',
    PAYMENT_RECEIVED: 'payment_received'
};

// Human-readable labels for activity types
export const ACTIVITY_LABELS = {
    [ACTIVITY_TYPES.JOB_CREATED]: 'Job Created',
    [ACTIVITY_TYPES.JOB_UPDATED]: 'Job Updated',
    [ACTIVITY_TYPES.TIME_SLOTS_OFFERED]: 'Time Slots Offered',
    [ACTIVITY_TYPES.TIME_SLOT_SELECTED]: 'Time Slot Selected',
    [ACTIVITY_TYPES.JOB_SCHEDULED]: 'Job Scheduled',
    [ACTIVITY_TYPES.JOB_RESCHEDULED]: 'Job Rescheduled',
    [ACTIVITY_TYPES.STATUS_CHANGED]: 'Status Changed',
    [ACTIVITY_TYPES.JOB_STARTED]: 'Job Started',
    [ACTIVITY_TYPES.JOB_COMPLETED]: 'Job Completed',
    [ACTIVITY_TYPES.JOB_CANCELLED]: 'Job Cancelled',
    [ACTIVITY_TYPES.CREW_ASSIGNED]: 'Crew Assigned',
    [ACTIVITY_TYPES.CREW_UPDATED]: 'Crew Updated',
    [ACTIVITY_TYPES.NOTIFICATION_SENT]: 'Notification Sent',
    [ACTIVITY_TYPES.MESSAGE_SENT]: 'Message Sent',
    [ACTIVITY_TYPES.INVOICE_SENT]: 'Invoice Sent',
    [ACTIVITY_TYPES.PAYMENT_RECEIVED]: 'Payment Received'
};

/**
 * Log an activity event to a job
 * @param {string} jobId - The job document ID
 * @param {string} type - Activity type from ACTIVITY_TYPES
 * @param {Object} options - Additional options
 * @param {string} options.actor - Who performed the action ('contractor', 'customer', 'system')
 * @param {string} options.actorName - Display name of the actor
 * @param {string} options.description - Human-readable description
 * @param {Object} options.metadata - Additional data specific to the event
 */
export async function logActivity(jobId, type, options = {}) {
    if (!jobId || !type) {
        console.warn('[logActivity] Missing jobId or type');
        return { success: false, error: 'Missing required parameters' };
    }

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        const activityEntry = {
            type,
            label: ACTIVITY_LABELS[type] || type,
            timestamp: new Date().toISOString(),
            actor: options.actor || 'system',
            actorName: options.actorName || null,
            description: options.description || null,
            metadata: options.metadata || null
        };

        await updateDoc(jobRef, {
            activityLog: arrayUnion(activityEntry),
            lastActivity: serverTimestamp()
        });

        console.log(`[logActivity] Logged ${type} for job ${jobId}`);
        return { success: true, entry: activityEntry };

    } catch (error) {
        console.error('[logActivity] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Log time slots being offered to customer
 */
export async function logTimeSlotsOffered(jobId, slotsCount, actorName = 'Contractor') {
    return logActivity(jobId, ACTIVITY_TYPES.TIME_SLOTS_OFFERED, {
        actor: 'contractor',
        actorName,
        description: `Offered ${slotsCount} time slot${slotsCount !== 1 ? 's' : ''} to customer`,
        metadata: { slotsCount }
    });
}

/**
 * Log job being scheduled
 */
export async function logJobScheduled(jobId, scheduledDate, scheduledBy = 'contractor', actorName = null) {
    const formattedDate = new Date(scheduledDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    return logActivity(jobId, ACTIVITY_TYPES.JOB_SCHEDULED, {
        actor: scheduledBy,
        actorName,
        description: `Scheduled for ${formattedDate}`,
        metadata: { scheduledDate }
    });
}

/**
 * Log crew assignment
 */
export async function logCrewAssigned(jobId, crewMembers, actorName = 'Contractor') {
    const crewNames = crewMembers.map(m => m.techName || 'Unknown').join(', ');
    return logActivity(jobId, ACTIVITY_TYPES.CREW_ASSIGNED, {
        actor: 'contractor',
        actorName,
        description: `Assigned crew: ${crewNames}`,
        metadata: { crewSize: crewMembers.length, crewNames: crewMembers.map(m => m.techName) }
    });
}

/**
 * Log status change
 */
export async function logStatusChange(jobId, oldStatus, newStatus, changedBy = 'contractor', actorName = null) {
    // Determine appropriate activity type
    let type = ACTIVITY_TYPES.STATUS_CHANGED;
    if (newStatus === 'in_progress') type = ACTIVITY_TYPES.JOB_STARTED;
    if (newStatus === 'completed') type = ACTIVITY_TYPES.JOB_COMPLETED;
    if (newStatus === 'cancelled') type = ACTIVITY_TYPES.JOB_CANCELLED;

    return logActivity(jobId, type, {
        actor: changedBy,
        actorName,
        description: `Status changed from "${oldStatus}" to "${newStatus}"`,
        metadata: { oldStatus, newStatus }
    });
}

/**
 * Log notification sent
 */
export async function logNotificationSent(jobId, notificationType, recipient = 'customer') {
    return logActivity(jobId, ACTIVITY_TYPES.NOTIFICATION_SENT, {
        actor: 'system',
        description: `${notificationType} notification sent to ${recipient}`,
        metadata: { notificationType, recipient }
    });
}

export default {
    ACTIVITY_TYPES,
    ACTIVITY_LABELS,
    logActivity,
    logTimeSlotsOffered,
    logJobScheduled,
    logCrewAssigned,
    logStatusChange,
    logNotificationSent
};
