// src/lib/twilioService.js
// ============================================
// TWILIO SMS CLIENT SERVICE
// ============================================
// Client-side service that calls API routes for SMS functionality
// Twilio credentials are kept server-side only for security

import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../config/constants';

// Helper to get the correct contractor path
const getContractorPath = (contractorId) => `${CONTRACTORS_COLLECTION_PATH}/${contractorId}`;

// ============================================
// CONSTANTS
// ============================================

export const SMS_STATUS = {
    QUEUED: 'queued',
    SENDING: 'sending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    FAILED: 'failed',
    UNDELIVERED: 'undelivered'
};

export const SMS_TYPES = {
    REMINDER_24H: 'reminder_24h',
    REMINDER_2H: 'reminder_2h',
    ON_THE_WAY: 'on_the_way',
    CONFIRMATION: 'confirmation',
    RESCHEDULE: 'reschedule',
    CANCELLATION: 'cancellation',
    CUSTOM: 'custom'
};

export const CUSTOMER_RESPONSES = {
    CONFIRM: 'CONFIRM',
    RESCHEDULE: 'RESCHEDULE',
    CANCEL: 'CANCEL',
    STOP: 'STOP',
    YES: 'YES',
    NO: 'NO'
};

// ============================================
// PHONE NUMBER UTILITIES
// ============================================

/**
 * Format phone number to E.164 format
 * @param {string} phone - Phone number in any format
 * @param {string} defaultCountry - Default country code (default: '1' for US)
 * @returns {string|null} E.164 formatted number or null if invalid
 */
export const formatPhoneE164 = (phone, defaultCountry = '1') => {
    if (!phone) return null;

    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');

    // Handle different cases
    if (digits.length === 10) {
        // US number without country code
        return `+${defaultCountry}${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        // US number with country code
        return `+${digits}`;
    } else if (digits.length > 10) {
        // International number - assume it includes country code
        return `+${digits}`;
    }

    // Invalid number
    return null;
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const isValidPhone = (phone) => {
    const formatted = formatPhoneE164(phone);
    return formatted !== null && formatted.length >= 11;
};

/**
 * Format phone for display
 * @param {string} phone - E.164 phone number
 * @returns {string} Formatted display string
 */
export const formatPhoneDisplay = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
};

// ============================================
// SMS SENDING FUNCTIONS
// ============================================

/**
 * Send SMS via API route
 * @param {Object} params - SMS parameters
 * @param {string} params.to - Recipient phone number
 * @param {string} params.message - Message body
 * @param {string} params.jobId - Associated job ID
 * @param {string} params.contractorId - Contractor ID
 * @param {string} params.type - SMS type from SMS_TYPES
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} Send result with messageSid
 */
export const sendSMS = async ({ to, message, jobId, contractorId, type = SMS_TYPES.CUSTOM, metadata = {} }) => {
    try {
        // Format phone number
        const formattedPhone = formatPhoneE164(to);
        if (!formattedPhone) {
            throw new Error('Invalid phone number format');
        }

        // Check opt-out status before sending
        const isOptedOut = await checkOptOutStatus(formattedPhone, contractorId);
        if (isOptedOut) {
            console.log(`[SMS] Skipping send - customer opted out: ${formattedPhone}`);
            return {
                success: false,
                skipped: true,
                reason: 'Customer has opted out of SMS'
            };
        }

        // Call API route
        const response = await fetch('/api/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: formattedPhone,
                message,
                jobId,
                contractorId,
                type,
                metadata
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to send SMS');
        }

        // Log to Firestore
        await logSMSMessage({
            to: formattedPhone,
            message,
            jobId,
            contractorId,
            type,
            messageSid: result.messageSid,
            status: SMS_STATUS.QUEUED,
            metadata
        });

        return {
            success: true,
            messageSid: result.messageSid,
            status: result.status
        };
    } catch (error) {
        console.error('[SMS] Send error:', error);

        // Log failed attempt
        await logSMSMessage({
            to,
            message,
            jobId,
            contractorId,
            type,
            status: SMS_STATUS.FAILED,
            error: error.message,
            metadata
        });

        throw error;
    }
};

/**
 * Send appointment reminder SMS
 * @param {Object} job - Job document
 * @param {string} contractorId - Contractor ID
 * @param {string} reminderType - '24h' or '2h'
 * @param {string} template - Message template
 * @returns {Promise<Object>} Send result
 */
export const sendAppointmentReminder = async (job, contractorId, reminderType, template) => {
    const customerPhone = job.customer?.phone || job.customerPhone;
    if (!customerPhone) {
        throw new Error('No customer phone number available');
    }

    const message = interpolateTemplate(template, {
        customerName: job.customer?.name || job.customerName || 'Valued Customer',
        serviceType: job.serviceType || job.title || 'service appointment',
        date: formatAppointmentDate(job.scheduledTime || job.scheduledDate),
        time: formatAppointmentTime(job.scheduledTime),
        techName: job.assignedTechName || 'our technician',
        companyName: job.companyName || 'Our team',
        address: job.serviceAddress?.formatted || job.customer?.address || ''
    });

    const type = reminderType === '24h' ? SMS_TYPES.REMINDER_24H : SMS_TYPES.REMINDER_2H;

    return sendSMS({
        to: customerPhone,
        message,
        jobId: job.id,
        contractorId,
        type,
        metadata: {
            reminderType,
            scheduledTime: job.scheduledTime
        }
    });
};

/**
 * Send "on the way" SMS
 * @param {Object} job - Job document
 * @param {string} contractorId - Contractor ID
 * @param {string} template - Message template
 * @param {number} etaMinutes - Estimated arrival time in minutes
 * @returns {Promise<Object>} Send result
 */
export const sendOnTheWaySMS = async (job, contractorId, template, etaMinutes = null) => {
    const customerPhone = job.customer?.phone || job.customerPhone;
    if (!customerPhone) {
        throw new Error('No customer phone number available');
    }

    const message = interpolateTemplate(template, {
        customerName: job.customer?.name || job.customerName || 'Valued Customer',
        techName: job.assignedTechName || 'Our technician',
        eta: etaMinutes ? `${etaMinutes} minutes` : 'shortly',
        companyName: job.companyName || 'Our team'
    });

    return sendSMS({
        to: customerPhone,
        message,
        jobId: job.id,
        contractorId,
        type: SMS_TYPES.ON_THE_WAY,
        metadata: {
            etaMinutes,
            sentAt: new Date().toISOString()
        }
    });
};

// ============================================
// DELIVERY STATUS
// ============================================

/**
 * Get SMS delivery status
 * @param {string} messageSid - Twilio message SID
 * @returns {Promise<Object>} Status information
 */
export const getDeliveryStatus = async (messageSid) => {
    try {
        const response = await fetch(`/api/sms/status?messageSid=${messageSid}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to get delivery status');
        }

        return result;
    } catch (error) {
        console.error('[SMS] Status check error:', error);
        throw error;
    }
};

/**
 * Update local SMS log with delivery status
 * @param {string} messageSid - Twilio message SID
 * @param {string} status - New status
 * @param {string} errorCode - Error code if failed
 * @returns {Promise<void>}
 */
export const updateSMSStatus = async (messageSid, status, errorCode = null) => {
    try {
        const smsQuery = query(
            collection(db, 'smsLogs'),
            where('messageSid', '==', messageSid),
            limit(1)
        );

        const snapshot = await getDocs(smsQuery);
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            await updateDoc(docRef, {
                status,
                errorCode,
                updatedAt: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('[SMS] Status update error:', error);
    }
};

// ============================================
// OPT-OUT MANAGEMENT
// ============================================

/**
 * Check if customer has opted out of SMS
 * @param {string} phone - Customer phone (E.164 format)
 * @param {string} contractorId - Contractor ID
 * @returns {Promise<boolean>} True if opted out
 */
export const checkOptOutStatus = async (phone, contractorId) => {
    try {
        const formattedPhone = formatPhoneE164(phone);
        if (!formattedPhone) return false;

        // Check contractor-specific opt-out
        const optOutRef = doc(db, 'smsOptOuts', `${contractorId}_${formattedPhone}`);
        const optOutDoc = await getDoc(optOutRef);

        if (optOutDoc.exists() && optOutDoc.data().optedOut) {
            return true;
        }

        // Check global opt-out
        const globalOptOutRef = doc(db, 'smsOptOuts', formattedPhone);
        const globalOptOutDoc = await getDoc(globalOptOutRef);

        return globalOptOutDoc.exists() && globalOptOutDoc.data().optedOut;
    } catch (error) {
        console.error('[SMS] Opt-out check error:', error);
        return false; // Default to allowing sends if check fails
    }
};

/**
 * Record customer opt-out
 * @param {string} phone - Customer phone
 * @param {string} contractorId - Contractor ID (optional for global opt-out)
 * @returns {Promise<void>}
 */
export const recordOptOut = async (phone, contractorId = null) => {
    try {
        const formattedPhone = formatPhoneE164(phone);
        if (!formattedPhone) return;

        const optOutData = {
            phone: formattedPhone,
            optedOut: true,
            optedOutAt: serverTimestamp()
        };

        if (contractorId) {
            // Contractor-specific opt-out
            const optOutRef = doc(db, 'smsOptOuts', `${contractorId}_${formattedPhone}`);
            await updateDoc(optOutRef, optOutData).catch(() => {
                // Document doesn't exist, create it
                return addDoc(collection(db, 'smsOptOuts'), {
                    ...optOutData,
                    contractorId,
                    id: `${contractorId}_${formattedPhone}`
                });
            });
        } else {
            // Global opt-out
            const globalRef = doc(db, 'smsOptOuts', formattedPhone);
            await updateDoc(globalRef, optOutData).catch(() => {
                return addDoc(collection(db, 'smsOptOuts'), {
                    ...optOutData,
                    global: true,
                    id: formattedPhone
                });
            });
        }

        console.log(`[SMS] Recorded opt-out for ${formattedPhone}`);
    } catch (error) {
        console.error('[SMS] Opt-out record error:', error);
    }
};

/**
 * Record customer opt-in (reverse opt-out)
 * @param {string} phone - Customer phone
 * @param {string} contractorId - Contractor ID
 * @returns {Promise<void>}
 */
export const recordOptIn = async (phone, contractorId) => {
    try {
        const formattedPhone = formatPhoneE164(phone);
        if (!formattedPhone) return;

        const optOutRef = doc(db, 'smsOptOuts', `${contractorId}_${formattedPhone}`);
        await updateDoc(optOutRef, {
            optedOut: false,
            optedInAt: serverTimestamp()
        });

        console.log(`[SMS] Recorded opt-in for ${formattedPhone}`);
    } catch (error) {
        console.error('[SMS] Opt-in record error:', error);
    }
};

// ============================================
// SMS LOGGING
// ============================================

/**
 * Log SMS message to Firestore
 * @param {Object} smsData - SMS data to log
 * @returns {Promise<string>} Log document ID
 */
export const logSMSMessage = async (smsData) => {
    try {
        const logRef = await addDoc(collection(db, 'smsLogs'), {
            ...smsData,
            createdAt: serverTimestamp(),
            direction: 'outbound'
        });
        return logRef.id;
    } catch (error) {
        console.error('[SMS] Logging error:', error);
        return null;
    }
};

/**
 * Get SMS logs for a contractor
 * @param {string} contractorId - Contractor ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} SMS logs
 */
export const getSMSLogs = async (contractorId, options = {}) => {
    try {
        const { limitCount = 50, startAfter = null, type = null, jobId = null } = options;

        let smsQuery = query(
            collection(db, 'smsLogs'),
            where('contractorId', '==', contractorId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        if (type) {
            smsQuery = query(smsQuery, where('type', '==', type));
        }

        if (jobId) {
            smsQuery = query(smsQuery, where('jobId', '==', jobId));
        }

        const snapshot = await getDocs(smsQuery);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
        }));
    } catch (error) {
        console.error('[SMS] Get logs error:', error);
        return [];
    }
};

/**
 * Get SMS stats for a contractor
 * @param {string} contractorId - Contractor ID
 * @param {Date} startDate - Start date for stats
 * @param {Date} endDate - End date for stats
 * @returns {Promise<Object>} SMS statistics
 */
export const getSMSStats = async (contractorId, startDate = null, endDate = null) => {
    try {
        let smsQuery = query(
            collection(db, 'smsLogs'),
            where('contractorId', '==', contractorId)
        );

        const snapshot = await getDocs(smsQuery);
        const logs = snapshot.docs.map(doc => doc.data());

        // Filter by date if provided
        const filteredLogs = logs.filter(log => {
            if (!startDate && !endDate) return true;
            const logDate = log.createdAt?.toDate?.() || new Date(log.createdAt);
            if (startDate && logDate < startDate) return false;
            if (endDate && logDate > endDate) return false;
            return true;
        });

        // Calculate stats
        const stats = {
            total: filteredLogs.length,
            byStatus: {},
            byType: {},
            delivered: 0,
            failed: 0,
            pending: 0
        };

        filteredLogs.forEach(log => {
            // By status
            stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;

            // By type
            stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

            // Aggregate counts
            if (log.status === SMS_STATUS.DELIVERED) {
                stats.delivered++;
            } else if (log.status === SMS_STATUS.FAILED || log.status === SMS_STATUS.UNDELIVERED) {
                stats.failed++;
            } else {
                stats.pending++;
            }
        });

        stats.deliveryRate = stats.total > 0
            ? Math.round((stats.delivered / stats.total) * 100)
            : 0;

        return stats;
    } catch (error) {
        console.error('[SMS] Get stats error:', error);
        return {
            total: 0,
            byStatus: {},
            byType: {},
            delivered: 0,
            failed: 0,
            pending: 0,
            deliveryRate: 0
        };
    }
};

// ============================================
// TEMPLATE UTILITIES
// ============================================

/**
 * Interpolate template with variables
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {Object} variables - Variables to interpolate
 * @returns {string} Interpolated message
 */
export const interpolateTemplate = (template, variables) => {
    if (!template) return '';

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
    });
};

/**
 * Format date for appointment display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatAppointmentDate = (date) => {
    if (!date) return 'your scheduled date';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Format time for appointment display
 * @param {string|Date} time - Time to format
 * @returns {string} Formatted time string
 */
export const formatAppointmentTime = (time) => {
    if (!time) return 'your scheduled time';
    const d = new Date(time);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

// ============================================
// SMS SETTINGS
// ============================================

/**
 * Get SMS settings for a contractor
 * @param {string} contractorId - Contractor ID
 * @returns {Promise<Object>} SMS settings
 */
export const getSMSSettings = async (contractorId) => {
    try {
        const contractorRef = doc(db, getContractorPath(contractorId));
        const contractorDoc = await getDoc(contractorRef);

        if (contractorDoc.exists()) {
            return contractorDoc.data().smsSettings || getDefaultSMSSettings();
        }

        return getDefaultSMSSettings();
    } catch (error) {
        console.error('[SMS] Get settings error:', error);
        return getDefaultSMSSettings();
    }
};

/**
 * Update SMS settings for a contractor
 * @param {string} contractorId - Contractor ID
 * @param {Object} settings - New SMS settings
 * @returns {Promise<void>}
 */
export const updateSMSSettings = async (contractorId, settings) => {
    try {
        const contractorRef = doc(db, getContractorPath(contractorId));
        await updateDoc(contractorRef, {
            smsSettings: settings,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('[SMS] Update settings error:', error);
        throw error;
    }
};

/**
 * Get default SMS settings
 * @returns {Object} Default settings
 */
export const getDefaultSMSSettings = () => ({
    enabled: false,
    reminders: {
        enabled: true,
        send24hReminder: true,
        send2hReminder: true
    },
    onTheWay: {
        enabled: true,
        autoSend: true
    },
    templates: {
        reminder24h: "Hi {{customerName}}! This is a reminder of your {{serviceType}} appointment tomorrow, {{date}} at {{time}}. Reply CONFIRM to confirm or RESCHEDULE to change. - {{companyName}}",
        reminder2h: "Hi {{customerName}}! {{techName}} will arrive for your {{serviceType}} in about 2 hours at {{time}}. Reply YES to confirm you're ready. - {{companyName}}",
        onTheWay: "Hi {{customerName}}! {{techName}} is on the way and will arrive in approximately {{eta}}. - {{companyName}}",
        confirmation: "Thanks for confirming! We'll see you {{date}} at {{time}}. - {{companyName}}",
        cancellation: "Your appointment has been cancelled. Please contact us to reschedule. - {{companyName}}"
    },
    twilioConfigured: false
});

export default {
    sendSMS,
    sendAppointmentReminder,
    sendOnTheWaySMS,
    getDeliveryStatus,
    updateSMSStatus,
    checkOptOutStatus,
    recordOptOut,
    recordOptIn,
    logSMSMessage,
    getSMSLogs,
    getSMSStats,
    getSMSSettings,
    updateSMSSettings,
    getDefaultSMSSettings,
    formatPhoneE164,
    isValidPhone,
    formatPhoneDisplay,
    interpolateTemplate,
    SMS_STATUS,
    SMS_TYPES,
    CUSTOMER_RESPONSES
};
