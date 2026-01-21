// src/features/contractor-pro/lib/paymentReminderService.js
// ============================================
// PAYMENT REMINDER SERVICE
// ============================================
// Manages automated payment reminder settings and triggers
// Integrates with contractor settings and job/invoice data

import { db } from '../../../config/firebase';
import {
    doc, getDoc, updateDoc, collection, query, where,
    getDocs, serverTimestamp, Timestamp, addDoc, orderBy, limit
} from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// DEFAULT SETTINGS
// ============================================
export const DEFAULT_REMINDER_SETTINGS = {
    enabled: true,

    // Reminder schedule
    schedule: {
        // Days before due date to send reminder
        beforeDue: [7, 3, 1], // 7 days, 3 days, 1 day before

        // Days after due date (overdue reminders)
        afterDue: [1, 3, 7, 14, 30], // 1, 3, 7, 14, 30 days overdue

        // Maximum reminders per invoice
        maxReminders: 5
    },

    // Quiet hours (don't send during these times)
    quietHours: {
        enabled: true,
        start: '20:00', // 8 PM
        end: '08:00'    // 8 AM
    },

    // Weekend handling
    weekends: {
        enabled: false, // Don't send on weekends by default
        postponeToMonday: true
    },

    // Channel preferences
    channels: {
        email: true,
        sms: false // SMS reminders require additional setup
    },

    // Customization
    customization: {
        tone: 'friendly', // 'friendly', 'professional', 'firm'
        includePaymentLink: true,
        includeJobDetails: true,
        includePreviousReminders: false
    },

    // Auto-escalation
    escalation: {
        enabled: false,
        // After X days overdue, escalate to phone call reminder
        phoneCallAfterDays: 14,
        // After Y days, mark as collections candidate
        collectionsAfterDays: 60
    }
};

// ============================================
// GET CONTRACTOR REMINDER SETTINGS
// ============================================
export const getReminderSettings = async (contractorId) => {
    try {
        const contractorRef = doc(db, 'contractors', contractorId);
        const contractorSnap = await getDoc(contractorRef);

        if (!contractorSnap.exists()) {
            return DEFAULT_REMINDER_SETTINGS;
        }

        const data = contractorSnap.data();
        return {
            ...DEFAULT_REMINDER_SETTINGS,
            ...data.paymentReminderSettings
        };
    } catch (error) {
        console.error('[paymentReminderService] Error getting settings:', error);
        return DEFAULT_REMINDER_SETTINGS;
    }
};

// ============================================
// UPDATE REMINDER SETTINGS
// ============================================
export const updateReminderSettings = async (contractorId, settings) => {
    try {
        const contractorRef = doc(db, 'contractors', contractorId);
        await updateDoc(contractorRef, {
            paymentReminderSettings: {
                ...settings,
                updatedAt: serverTimestamp()
            }
        });
        return { success: true };
    } catch (error) {
        console.error('[paymentReminderService] Error updating settings:', error);
        throw error;
    }
};

// ============================================
// GET JOBS NEEDING REMINDERS
// ============================================
export const getJobsNeedingReminders = async (contractorId) => {
    const settings = await getReminderSettings(contractorId);
    if (!settings.enabled) {
        return [];
    }

    const now = new Date();
    const jobsNeedingReminders = [];

    try {
        // Query completed jobs with balance due
        const jobsQuery = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where('contractorId', '==', contractorId),
            where('type', '==', 'accepted_quote'),
            where('paymentStatus', 'in', ['pending', 'partial', 'overdue'])
        );

        const snapshot = await getDocs(jobsQuery);

        snapshot.forEach(doc => {
            const job = { id: doc.id, ...doc.data() };

            // Skip if no balance due
            const balanceDue = job.balanceDue || job.total - (job.totalPaid || 0);
            if (balanceDue <= 0) return;

            // Calculate reminder eligibility
            const reminderInfo = calculateReminderEligibility(job, settings, now);
            if (reminderInfo.shouldSend) {
                jobsNeedingReminders.push({
                    job,
                    ...reminderInfo
                });
            }
        });

        return jobsNeedingReminders;
    } catch (error) {
        console.error('[paymentReminderService] Error getting jobs:', error);
        throw error;
    }
};

// ============================================
// CALCULATE REMINDER ELIGIBILITY
// ============================================
const calculateReminderEligibility = (job, settings, now) => {
    // Get due date (from invoice or default to 30 days after completion)
    let dueDate = job.invoiceData?.dueDate || job.dueDate;
    if (!dueDate && job.completedAt) {
        const completedDate = job.completedAt?.toDate?.() || new Date(job.completedAt);
        dueDate = new Date(completedDate);
        dueDate.setDate(dueDate.getDate() + 30); // Default net 30
    }

    if (!dueDate) {
        return { shouldSend: false, reason: 'No due date' };
    }

    const dueDateObj = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const daysUntilDue = Math.ceil((dueDateObj - now) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0;
    const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0;

    // Get reminder history
    const remindersSent = job.reminderHistory?.length || 0;

    // Check max reminders
    if (remindersSent >= settings.schedule.maxReminders) {
        return { shouldSend: false, reason: 'Max reminders reached' };
    }

    // Check last reminder date (don't spam)
    const lastReminder = job.lastReminderSent?.toDate?.() ||
        (job.lastReminderSent ? new Date(job.lastReminderSent) : null);
    if (lastReminder) {
        const daysSinceLastReminder = Math.ceil((now - lastReminder) / (1000 * 60 * 60 * 24));
        if (daysSinceLastReminder < 1) {
            return { shouldSend: false, reason: 'Too soon since last reminder' };
        }
    }

    // Check if it's a reminder day
    let shouldSend = false;
    let reminderType = null;

    if (isOverdue) {
        // Check overdue reminder schedule
        for (const days of settings.schedule.afterDue) {
            if (daysOverdue >= days) {
                shouldSend = true;
                reminderType = `overdue_${days}`;
            }
        }
    } else {
        // Check upcoming due date reminder schedule
        for (const days of settings.schedule.beforeDue) {
            if (daysUntilDue <= days && daysUntilDue > 0) {
                shouldSend = true;
                reminderType = `before_${days}`;
            }
        }
    }

    // Check weekend settings
    if (shouldSend && !settings.weekends.enabled) {
        const dayOfWeek = now.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (settings.weekends.postponeToMonday) {
                return { shouldSend: false, reason: 'Weekend - postponed to Monday' };
            }
        }
    }

    // Check quiet hours
    if (shouldSend && settings.quietHours.enabled) {
        const currentTime = now.toTimeString().slice(0, 5);
        const isQuietHour = isTimeInRange(currentTime, settings.quietHours.start, settings.quietHours.end);
        if (isQuietHour) {
            return { shouldSend: false, reason: 'Quiet hours' };
        }
    }

    return {
        shouldSend,
        reminderType,
        daysUntilDue,
        daysOverdue,
        isOverdue,
        dueDate: dueDateObj,
        remindersSent
    };
};

// ============================================
// TIME RANGE HELPER
// ============================================
const isTimeInRange = (current, start, end) => {
    // Handle overnight ranges (e.g., 20:00 to 08:00)
    if (start > end) {
        return current >= start || current < end;
    }
    return current >= start && current < end;
};

// ============================================
// SEND REMINDER
// ============================================
export const sendPaymentReminder = async (contractorId, job, reminderInfo) => {
    const settings = await getReminderSettings(contractorId);

    // Get contractor info
    const contractorRef = doc(db, 'contractors', contractorId);
    const contractorSnap = await getDoc(contractorRef);
    const contractor = contractorSnap.exists() ? contractorSnap.data() : {};

    // Prepare reminder data
    const reminderData = {
        customerEmail: job.customer?.email || job.customerEmail,
        customerName: job.customer?.name || job.customerName,
        customerPhone: job.customer?.phone || job.customerPhone,
        contractorName: contractor.businessName || contractor.name,
        jobTitle: job.title || job.description,
        jobNumber: job.jobNumber,
        balanceDue: job.balanceDue || (job.total - (job.totalPaid || 0)),
        dueDate: reminderInfo.dueDate?.toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        }),
        isOverdue: reminderInfo.isOverdue,
        daysOverdue: reminderInfo.daysOverdue,
        // Generate payment link
        paymentLink: generatePaymentLink(job, contractorId)
    };

    const results = {
        email: null,
        sms: null
    };

    // Send email reminder
    if (settings.channels.email && reminderData.customerEmail) {
        try {
            const response = await fetch('/api/cron/payment-reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manualTrigger: true,
                    ...reminderData
                })
            });
            const data = await response.json();
            results.email = { success: response.ok, ...data };
        } catch (error) {
            results.email = { success: false, error: error.message };
        }
    }

    // Send SMS reminder (if enabled)
    if (settings.channels.sms && reminderData.customerPhone) {
        try {
            const response = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: reminderData.customerPhone,
                    message: generateSMSReminder(reminderData, settings),
                    type: 'payment_reminder',
                    contractorId
                })
            });
            const data = await response.json();
            results.sms = { success: response.ok, ...data };
        } catch (error) {
            results.sms = { success: false, error: error.message };
        }
    }

    // Update job with reminder history
    if (results.email?.success || results.sms?.success) {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
        await updateDoc(jobRef, {
            lastReminderSent: serverTimestamp(),
            reminderHistory: [
                ...(job.reminderHistory || []),
                {
                    sentAt: new Date().toISOString(),
                    type: reminderInfo.reminderType,
                    channels: {
                        email: results.email?.success || false,
                        sms: results.sms?.success || false
                    }
                }
            ],
            reminderCount: (job.reminderCount || 0) + 1
        });
    }

    return results;
};

// ============================================
// GENERATE SMS REMINDER TEXT
// ============================================
const generateSMSReminder = (data, settings) => {
    const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(data.balanceDue || 0);

    if (data.isOverdue) {
        if (settings.customization.tone === 'firm') {
            return `${data.contractorName}: Your payment of ${amount} for "${data.jobTitle}" is ${data.daysOverdue} days overdue. Please pay immediately: ${data.paymentLink}`;
        }
        return `${data.contractorName}: Reminder - your payment of ${amount} is past due. Pay now: ${data.paymentLink}`;
    }

    return `${data.contractorName}: Your payment of ${amount} for "${data.jobTitle}" is due soon. Pay online: ${data.paymentLink}`;
};

// ============================================
// GENERATE PAYMENT LINK
// ============================================
const generatePaymentLink = (job, contractorId) => {
    // Generate a payment link for the job
    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://mykrib.app';

    // Format: /pay/{contractorId}_{jobId}
    return `${baseUrl}/pay/${contractorId}_${job.id}`;
};

// ============================================
// PROCESS ALL REMINDERS (for cron)
// ============================================
export const processAllReminders = async (contractorId) => {
    const jobsNeedingReminders = await getJobsNeedingReminders(contractorId);
    const results = [];

    for (const { job, ...reminderInfo } of jobsNeedingReminders) {
        try {
            const result = await sendPaymentReminder(contractorId, job, reminderInfo);
            results.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                success: true,
                ...result
            });
        } catch (error) {
            results.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                success: false,
                error: error.message
            });
        }
    }

    return {
        processed: results.length,
        results
    };
};

// ============================================
// EXPORT
// ============================================
export default {
    DEFAULT_REMINDER_SETTINGS,
    getReminderSettings,
    updateReminderSettings,
    getJobsNeedingReminders,
    sendPaymentReminder,
    processAllReminders
};
