// src/features/contractor-pro/lib/techNotificationService.js
// ============================================
// TECH NOTIFICATION SERVICE
// ============================================
// Handles SMS/Push notifications to technicians for job assignments,
// schedule changes, and other operational updates.

import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';
import { sendSMS, formatPhoneE164 } from '../../../lib/twilioService';

// ============================================
// NOTIFICATION TYPES
// ============================================

export const TECH_NOTIFICATION_TYPES = {
    JOB_ASSIGNED: 'job_assigned',
    JOB_UNASSIGNED: 'job_unassigned',
    SCHEDULE_CHANGED: 'schedule_changed',
    JOB_CANCELLED: 'job_cancelled',
    JOB_URGENT: 'job_urgent',
    CREW_UPDATED: 'crew_updated',
    CUSTOMER_MESSAGE: 'customer_message',
    DAILY_SCHEDULE: 'daily_schedule'
};

// ============================================
// MESSAGE TEMPLATES
// ============================================

const TEMPLATES = {
    [TECH_NOTIFICATION_TYPES.JOB_ASSIGNED]: {
        sms: `New job assigned: {jobTitle} at {address}. {dateTime}. Open app for details: {link}`,
        push: {
            title: 'New Job Assigned',
            body: '{jobTitle} - {dateTime}'
        }
    },
    [TECH_NOTIFICATION_TYPES.JOB_UNASSIGNED]: {
        sms: `Job removed from your schedule: {jobTitle} at {address} ({dateTime}) is no longer assigned to you.`,
        push: {
            title: 'Job Removed',
            body: '{jobTitle} removed from your schedule'
        }
    },
    [TECH_NOTIFICATION_TYPES.SCHEDULE_CHANGED]: {
        sms: `Schedule update: {jobTitle} has been rescheduled from {oldDateTime} to {newDateTime}. Address: {address}`,
        push: {
            title: 'Schedule Changed',
            body: '{jobTitle} moved to {newDateTime}'
        }
    },
    [TECH_NOTIFICATION_TYPES.JOB_CANCELLED]: {
        sms: `Job cancelled: {jobTitle} at {address} ({dateTime}) has been cancelled.`,
        push: {
            title: 'Job Cancelled',
            body: '{jobTitle} has been cancelled'
        }
    },
    [TECH_NOTIFICATION_TYPES.JOB_URGENT]: {
        sms: `URGENT: {jobTitle} at {address} needs immediate attention. {notes}. Call dispatch: {dispatchPhone}`,
        push: {
            title: '🚨 URGENT JOB',
            body: '{jobTitle} - Immediate attention needed'
        }
    },
    [TECH_NOTIFICATION_TYPES.CREW_UPDATED]: {
        sms: `Crew update for {jobTitle}: {crewChange}. Current crew: {crewList}`,
        push: {
            title: 'Crew Updated',
            body: '{jobTitle}: {crewChange}'
        }
    },
    [TECH_NOTIFICATION_TYPES.DAILY_SCHEDULE]: {
        sms: `Your schedule for {date}: {jobCount} job(s). First job at {firstJobTime} - {firstJobTitle}. Open app to view all: {link}`,
        push: {
            title: 'Today\'s Schedule',
            body: '{jobCount} jobs starting at {firstJobTime}'
        }
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Interpolate template variables
 */
const interpolateTemplate = (template, variables) => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    }
    return result;
};

/**
 * Format date/time for notifications
 */
const formatDateTime = (date) => {
    if (!date) return 'TBD';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

/**
 * Format time only
 */
const formatTime = (date) => {
    if (!date) return 'TBD';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
};

/**
 * Format address for SMS (compact)
 */
const formatAddressCompact = (address) => {
    if (!address) return 'Address TBD';
    if (typeof address === 'string') {
        // Take first part before comma (street address)
        return address.split(',')[0].trim();
    }
    return address.street || address.formatted || 'Address TBD';
};

/**
 * Get tech notification preferences
 */
const getTechNotificationPreferences = async (contractorId, techId) => {
    try {
        const techRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'team', techId);
        const techSnap = await getDoc(techRef);

        if (!techSnap.exists()) {
            return { sms: true, push: true, email: false }; // Default: SMS and push enabled
        }

        const techData = techSnap.data();
        return {
            sms: techData.notifications?.sms !== false, // Default true
            push: techData.notifications?.push !== false, // Default true
            email: techData.notifications?.email || false,
            phone: techData.phone || techData.phoneNumber,
            email: techData.email,
            quietHoursStart: techData.notifications?.quietHoursStart, // e.g., "22:00"
            quietHoursEnd: techData.notifications?.quietHoursEnd // e.g., "07:00"
        };
    } catch (error) {
        console.error('[TechNotification] Error getting preferences:', error);
        return { sms: true, push: true, email: false };
    }
};

/**
 * Check if current time is within quiet hours
 */
const isQuietHours = (quietStart, quietEnd) => {
    if (!quietStart || !quietEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

/**
 * Generate app link for job
 */
const generateJobLink = (contractorId, jobId) => {
    // For now, return a web link. In future, this could be a deep link for the mobile app
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.krib.com';
    return `${baseUrl}/tech/job/${jobId}`;
};

// ============================================
// NOTIFICATION LOGGING
// ============================================

/**
 * Log notification to Firestore for audit trail
 */
const logNotification = async (contractorId, notification) => {
    try {
        const logsRef = collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'notification_logs');
        await addDoc(logsRef, {
            ...notification,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.warn('[TechNotification] Failed to log notification:', error);
    }
};

// ============================================
// MAIN NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send notification to a single tech
 */
export const notifyTech = async (contractorId, techId, type, data, options = {}) => {
    const {
        forceSend = false, // Bypass quiet hours
        priority = 'normal' // 'normal', 'high', 'urgent'
    } = options;

    try {
        // Get tech preferences
        const prefs = await getTechNotificationPreferences(contractorId, techId);

        // Check quiet hours (unless urgent or force send)
        if (!forceSend && priority !== 'urgent') {
            if (isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) {
                console.log(`[TechNotification] Skipping notification for ${techId} - quiet hours`);
                // Queue for later? For now, just skip
                return { success: false, reason: 'quiet_hours' };
            }
        }

        const template = TEMPLATES[type];
        if (!template) {
            throw new Error(`Unknown notification type: ${type}`);
        }

        const results = { sms: null, push: null, email: null };

        // Send SMS
        if (prefs.sms && prefs.phone) {
            try {
                const smsMessage = interpolateTemplate(template.sms, data);
                const smsResult = await sendSMS({
                    to: prefs.phone,
                    message: smsMessage,
                    jobId: data.jobId,
                    contractorId,
                    type: `tech_${type}`,
                    metadata: {
                        techId,
                        notificationType: type,
                        priority
                    }
                });
                results.sms = { success: true, messageSid: smsResult.messageSid };
            } catch (smsError) {
                console.error('[TechNotification] SMS failed:', smsError);
                results.sms = { success: false, error: smsError.message };
            }
        }

        // Push notification (placeholder - would integrate with Firebase Cloud Messaging)
        if (prefs.push) {
            // TODO: Implement push notification via FCM
            // For now, log that we would send a push
            results.push = { success: false, reason: 'not_implemented' };
        }

        // Log the notification
        await logNotification(contractorId, {
            techId,
            type,
            data,
            results,
            priority
        });

        return {
            success: results.sms?.success || results.push?.success,
            results
        };
    } catch (error) {
        console.error('[TechNotification] Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Notify tech of new job assignment
 */
export const notifyJobAssigned = async (contractorId, techId, job, role = 'assigned') => {
    const address = job.customer?.address || job.propertyAddress || job.serviceAddress;

    const data = {
        jobId: job.id,
        jobTitle: job.title || job.description || 'Service Job',
        address: formatAddressCompact(address),
        dateTime: formatDateTime(job.scheduledDate || job.scheduledTime),
        customerName: job.customer?.name || job.customerName || 'Customer',
        role: role, // 'lead', 'helper', etc.
        link: generateJobLink(contractorId, job.id)
    };

    return notifyTech(contractorId, techId, TECH_NOTIFICATION_TYPES.JOB_ASSIGNED, data);
};

/**
 * Notify tech of job unassignment
 */
export const notifyJobUnassigned = async (contractorId, techId, job) => {
    const address = job.customer?.address || job.propertyAddress || job.serviceAddress;

    const data = {
        jobId: job.id,
        jobTitle: job.title || job.description || 'Service Job',
        address: formatAddressCompact(address),
        dateTime: formatDateTime(job.scheduledDate || job.scheduledTime)
    };

    return notifyTech(contractorId, techId, TECH_NOTIFICATION_TYPES.JOB_UNASSIGNED, data);
};

/**
 * Notify tech of schedule change
 */
export const notifyScheduleChanged = async (contractorId, techId, job, oldSchedule) => {
    const address = job.customer?.address || job.propertyAddress || job.serviceAddress;

    const data = {
        jobId: job.id,
        jobTitle: job.title || job.description || 'Service Job',
        address: formatAddressCompact(address),
        oldDateTime: formatDateTime(oldSchedule.scheduledDate || oldSchedule.scheduledTime),
        newDateTime: formatDateTime(job.scheduledDate || job.scheduledTime)
    };

    return notifyTech(contractorId, techId, TECH_NOTIFICATION_TYPES.SCHEDULE_CHANGED, data);
};

/**
 * Notify tech of job cancellation
 */
export const notifyJobCancelled = async (contractorId, techId, job) => {
    const address = job.customer?.address || job.propertyAddress || job.serviceAddress;

    const data = {
        jobId: job.id,
        jobTitle: job.title || job.description || 'Service Job',
        address: formatAddressCompact(address),
        dateTime: formatDateTime(job.scheduledDate || job.scheduledTime)
    };

    return notifyTech(contractorId, techId, TECH_NOTIFICATION_TYPES.JOB_CANCELLED, data);
};

/**
 * Notify tech of crew change on a job they're assigned to
 */
export const notifyCrewUpdated = async (contractorId, techId, job, crewChange, currentCrew) => {
    const data = {
        jobId: job.id,
        jobTitle: job.title || job.description || 'Service Job',
        crewChange, // e.g., "Jake added as helper"
        crewList: currentCrew.map(c => c.techName).join(', ')
    };

    return notifyTech(contractorId, techId, TECH_NOTIFICATION_TYPES.CREW_UPDATED, data);
};

/**
 * Send daily schedule summary to tech
 */
export const sendDailyScheduleSummary = async (contractorId, techId, jobs, date) => {
    if (!jobs || jobs.length === 0) {
        // Optionally notify "No jobs scheduled for today"
        return { success: true, reason: 'no_jobs' };
    }

    // Sort by time
    const sortedJobs = [...jobs].sort((a, b) => {
        const timeA = a.scheduledTime?.toDate?.() || new Date(a.scheduledTime || a.scheduledDate);
        const timeB = b.scheduledTime?.toDate?.() || new Date(b.scheduledTime || b.scheduledDate);
        return timeA - timeB;
    });

    const firstJob = sortedJobs[0];

    const data = {
        date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        jobCount: jobs.length,
        firstJobTime: formatTime(firstJob.scheduledTime || firstJob.scheduledDate),
        firstJobTitle: firstJob.title || firstJob.description || 'Service Job',
        link: generateJobLink(contractorId, 'schedule')
    };

    return notifyTech(contractorId, techId, TECH_NOTIFICATION_TYPES.DAILY_SCHEDULE, data);
};

/**
 * Notify multiple techs (for crew assignments)
 */
export const notifyCrewMembers = async (contractorId, crew, type, data, options = {}) => {
    if (!crew || crew.length === 0) return { success: true, results: [] };

    const results = await Promise.all(
        crew.map(member =>
            notifyTech(contractorId, member.techId, type, {
                ...data,
                role: member.role
            }, options)
        )
    );

    const successCount = results.filter(r => r.success).length;

    return {
        success: successCount > 0,
        totalSent: successCount,
        totalFailed: results.length - successCount,
        results
    };
};

// ============================================
// INTEGRATION WITH CREW SERVICE
// ============================================

/**
 * Hook to call after crew assignment changes
 * Call this from crewService.assignCrewToJob()
 */
export const onCrewAssignmentChanged = async (contractorId, jobId, changes) => {
    const {
        added = [],      // [{ techId, techName, role }]
        removed = [],    // [{ techId, techName }]
        job             // Job data
    } = changes;

    const notifications = [];

    // Notify added techs
    for (const tech of added) {
        notifications.push(
            notifyJobAssigned(contractorId, tech.techId, job, tech.role)
        );
    }

    // Notify removed techs
    for (const tech of removed) {
        notifications.push(
            notifyJobUnassigned(contractorId, tech.techId, job)
        );
    }

    // If there are remaining crew and changes happened, notify them of crew update
    if (job.assignedCrew && job.assignedCrew.length > 0 && (added.length > 0 || removed.length > 0)) {
        const changeDescription = [];
        if (added.length > 0) {
            changeDescription.push(`${added.map(t => t.techName).join(', ')} added`);
        }
        if (removed.length > 0) {
            changeDescription.push(`${removed.map(t => t.techName).join(', ')} removed`);
        }

        // Notify existing crew of changes (exclude the ones being added/removed - they got their own notification)
        const existingCrewIds = new Set([...added.map(t => t.techId), ...removed.map(t => t.techId)]);
        const crewToNotify = job.assignedCrew.filter(c => !existingCrewIds.has(c.techId));

        for (const crewMember of crewToNotify) {
            notifications.push(
                notifyCrewUpdated(contractorId, crewMember.techId, job, changeDescription.join(', '), job.assignedCrew)
            );
        }
    }

    const results = await Promise.all(notifications);
    return {
        success: results.some(r => r.success),
        notificationsSent: results.filter(r => r.success).length,
        results
    };
};

export default {
    TECH_NOTIFICATION_TYPES,
    notifyTech,
    notifyJobAssigned,
    notifyJobUnassigned,
    notifyScheduleChanged,
    notifyJobCancelled,
    notifyCrewUpdated,
    sendDailyScheduleSummary,
    notifyCrewMembers,
    onCrewAssignmentChanged
};
