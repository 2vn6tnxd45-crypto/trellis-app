// src/lib/customerPreferencesService.js
// ============================================
// CUSTOMER COMMUNICATION PREFERENCES SERVICE
// ============================================
// Manages customer contact preferences including:
// - Preferred contact method (SMS, email, phone call)
// - Notification preferences (reminders, updates)
// - Quiet hours
// - SMS opt-in/opt-out status

import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';
import { db, getArtifactPath } from '../config/firebase';

// ============================================
// CONSTANTS
// ============================================

export const CONTACT_METHODS = {
    SMS: 'sms',
    EMAIL: 'email',
    PHONE_CALL: 'phone_call',
    ANY: 'any'
};

export const NOTIFICATION_TYPES = {
    APPOINTMENT_REMINDERS: 'appointment_reminders',
    ON_THE_WAY_ALERTS: 'on_the_way_alerts',
    JOB_UPDATES: 'job_updates',
    PAYMENT_REMINDERS: 'payment_reminders',
    MARKETING: 'marketing'
};

// Default customer preferences
export const DEFAULT_PREFERENCES = {
    preferredContact: CONTACT_METHODS.ANY,
    notifications: {
        [NOTIFICATION_TYPES.APPOINTMENT_REMINDERS]: true,
        [NOTIFICATION_TYPES.ON_THE_WAY_ALERTS]: true,
        [NOTIFICATION_TYPES.JOB_UPDATES]: true,
        [NOTIFICATION_TYPES.PAYMENT_REMINDERS]: true,
        [NOTIFICATION_TYPES.MARKETING]: false
    },
    smsOptIn: true,
    emailOptIn: true,
    quietHours: {
        enabled: false,
        start: '21:00',
        end: '08:00'
    },
    language: 'en'
};

// ============================================
// COLLECTION PATHS
// ============================================

const getCustomerPrefsCollection = (contractorId) =>
    `${getArtifactPath()}/contractors/${contractorId}/customer_preferences`;

const getGlobalOptOutCollection = () =>
    `${getArtifactPath()}/sms_opt_outs`;

// ============================================
// GET CUSTOMER PREFERENCES
// ============================================

/**
 * Get customer preferences by phone or email
 * @param {string} contractorId - Contractor ID
 * @param {Object} customer - Customer object with phone and/or email
 * @returns {Object} Customer preferences (merged with defaults)
 */
export const getCustomerPreferences = async (contractorId, customer) => {
    try {
        const { phone, email } = customer;

        // Try to find by phone first (primary identifier)
        if (phone) {
            const normalizedPhone = normalizePhone(phone);
            const phoneDocId = `phone_${normalizedPhone.replace(/\+/g, '')}`;
            const phoneDocRef = doc(db, getCustomerPrefsCollection(contractorId), phoneDocId);
            const phoneDoc = await getDoc(phoneDocRef);

            if (phoneDoc.exists()) {
                return {
                    ...DEFAULT_PREFERENCES,
                    ...phoneDoc.data(),
                    id: phoneDoc.id,
                    identifier: normalizedPhone,
                    identifierType: 'phone'
                };
            }
        }

        // Fall back to email
        if (email) {
            const emailDocId = `email_${email.toLowerCase().replace(/[.@]/g, '_')}`;
            const emailDocRef = doc(db, getCustomerPrefsCollection(contractorId), emailDocId);
            const emailDoc = await getDoc(emailDocRef);

            if (emailDoc.exists()) {
                return {
                    ...DEFAULT_PREFERENCES,
                    ...emailDoc.data(),
                    id: emailDoc.id,
                    identifier: email.toLowerCase(),
                    identifierType: 'email'
                };
            }
        }

        // No preferences found - return defaults
        return { ...DEFAULT_PREFERENCES };
    } catch (error) {
        console.error('[CustomerPrefs] Error getting preferences:', error);
        return { ...DEFAULT_PREFERENCES };
    }
};

// ============================================
// SAVE CUSTOMER PREFERENCES
// ============================================

/**
 * Save customer preferences
 * @param {string} contractorId - Contractor ID
 * @param {Object} customer - Customer object with phone and/or email
 * @param {Object} preferences - Preferences to save
 * @returns {Object} Result with success status
 */
export const saveCustomerPreferences = async (contractorId, customer, preferences) => {
    try {
        const { phone, email, name } = customer;

        if (!phone && !email) {
            throw new Error('Customer must have phone or email');
        }

        // Determine document ID (prefer phone)
        let docId;
        let identifier;
        let identifierType;

        if (phone) {
            const normalizedPhone = normalizePhone(phone);
            docId = `phone_${normalizedPhone.replace(/\+/g, '')}`;
            identifier = normalizedPhone;
            identifierType = 'phone';
        } else {
            docId = `email_${email.toLowerCase().replace(/[.@]/g, '_')}`;
            identifier = email.toLowerCase();
            identifierType = 'email';
        }

        const docRef = doc(db, getCustomerPrefsCollection(contractorId), docId);

        const dataToSave = {
            ...preferences,
            customerName: name,
            phone: phone ? normalizePhone(phone) : null,
            email: email ? email.toLowerCase() : null,
            identifier,
            identifierType,
            updatedAt: serverTimestamp(),
            contractorId
        };

        // Check if exists
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
            await updateDoc(docRef, dataToSave);
        } else {
            dataToSave.createdAt = serverTimestamp();
            await setDoc(docRef, dataToSave);
        }

        // If SMS opt-out changed, update global opt-out collection
        if (preferences.smsOptIn === false && phone) {
            await recordGlobalOptOut(phone, contractorId);
        } else if (preferences.smsOptIn === true && phone) {
            await removeGlobalOptOut(phone, contractorId);
        }

        return { success: true, docId };
    } catch (error) {
        console.error('[CustomerPrefs] Error saving preferences:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GLOBAL SMS OPT-OUT MANAGEMENT
// ============================================

/**
 * Record a global SMS opt-out
 */
const recordGlobalOptOut = async (phone, contractorId) => {
    try {
        const normalizedPhone = normalizePhone(phone);
        const docId = `${contractorId}_${normalizedPhone.replace(/\+/g, '')}`;
        const docRef = doc(db, getGlobalOptOutCollection(), docId);

        await setDoc(docRef, {
            phone: normalizedPhone,
            contractorId,
            optedOut: true,
            optedOutAt: serverTimestamp()
        });
    } catch (error) {
        console.error('[CustomerPrefs] Error recording opt-out:', error);
    }
};

/**
 * Remove a global SMS opt-out (opt back in)
 */
const removeGlobalOptOut = async (phone, contractorId) => {
    try {
        const normalizedPhone = normalizePhone(phone);
        const docId = `${contractorId}_${normalizedPhone.replace(/\+/g, '')}`;
        const docRef = doc(db, getGlobalOptOutCollection(), docId);

        await setDoc(docRef, {
            phone: normalizedPhone,
            contractorId,
            optedOut: false,
            optedInAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('[CustomerPrefs] Error removing opt-out:', error);
    }
};

// ============================================
// CHECK NOTIFICATION ALLOWED
// ============================================

/**
 * Check if a specific notification type is allowed for a customer
 * @param {string} contractorId - Contractor ID
 * @param {Object} customer - Customer object
 * @param {string} notificationType - Type from NOTIFICATION_TYPES
 * @param {string} channel - 'sms' or 'email'
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export const isNotificationAllowed = async (contractorId, customer, notificationType, channel) => {
    try {
        const prefs = await getCustomerPreferences(contractorId, customer);

        // Check channel opt-in
        if (channel === 'sms' && !prefs.smsOptIn) {
            return { allowed: false, reason: 'Customer opted out of SMS' };
        }
        if (channel === 'email' && !prefs.emailOptIn) {
            return { allowed: false, reason: 'Customer opted out of email' };
        }

        // Check notification type preference
        if (notificationType && prefs.notifications[notificationType] === false) {
            return { allowed: false, reason: `Customer disabled ${notificationType} notifications` };
        }

        // Check quiet hours
        if (prefs.quietHours?.enabled) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            if (isInQuietHours(currentTime, prefs.quietHours.start, prefs.quietHours.end)) {
                return {
                    allowed: false,
                    reason: 'Customer is in quiet hours',
                    retryAfter: prefs.quietHours.end
                };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('[CustomerPrefs] Error checking notification:', error);
        // Default to allowed if we can't check
        return { allowed: true };
    }
};

/**
 * Get the best contact method for a customer
 * @param {string} contractorId - Contractor ID
 * @param {Object} customer - Customer object
 * @returns {string} Preferred contact method
 */
export const getBestContactMethod = async (contractorId, customer) => {
    try {
        const prefs = await getCustomerPreferences(contractorId, customer);

        // If they have a specific preference, use it
        if (prefs.preferredContact !== CONTACT_METHODS.ANY) {
            // Verify we have the contact info for that method
            if (prefs.preferredContact === CONTACT_METHODS.SMS && customer.phone) {
                return CONTACT_METHODS.SMS;
            }
            if (prefs.preferredContact === CONTACT_METHODS.EMAIL && customer.email) {
                return CONTACT_METHODS.EMAIL;
            }
            if (prefs.preferredContact === CONTACT_METHODS.PHONE_CALL && customer.phone) {
                return CONTACT_METHODS.PHONE_CALL;
            }
        }

        // Default logic: prefer SMS if available and opted in
        if (customer.phone && prefs.smsOptIn) {
            return CONTACT_METHODS.SMS;
        }
        if (customer.email && prefs.emailOptIn) {
            return CONTACT_METHODS.EMAIL;
        }

        // Fall back to whatever we have
        return customer.phone ? CONTACT_METHODS.SMS : CONTACT_METHODS.EMAIL;
    } catch (error) {
        console.error('[CustomerPrefs] Error getting best contact method:', error);
        return customer.phone ? CONTACT_METHODS.SMS : CONTACT_METHODS.EMAIL;
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize phone number to E.164 format
 */
const normalizePhone = (phone) => {
    if (!phone) return '';

    // Remove all non-numeric characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If doesn't start with +, assume US number
    if (!cleaned.startsWith('+')) {
        // Remove leading 1 if present
        if (cleaned.startsWith('1') && cleaned.length === 11) {
            cleaned = '+' + cleaned;
        } else if (cleaned.length === 10) {
            cleaned = '+1' + cleaned;
        } else {
            cleaned = '+' + cleaned;
        }
    }

    return cleaned;
};

/**
 * Check if current time is within quiet hours
 */
const isInQuietHours = (currentTime, start, end) => {
    // Handle overnight quiet hours (e.g., 21:00 to 08:00)
    if (start > end) {
        return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
};

// ============================================
// PREFERENCE LABELS (for UI)
// ============================================

export const CONTACT_METHOD_LABELS = {
    [CONTACT_METHODS.SMS]: 'Text Message (SMS)',
    [CONTACT_METHODS.EMAIL]: 'Email',
    [CONTACT_METHODS.PHONE_CALL]: 'Phone Call',
    [CONTACT_METHODS.ANY]: 'No Preference'
};

export const NOTIFICATION_TYPE_LABELS = {
    [NOTIFICATION_TYPES.APPOINTMENT_REMINDERS]: 'Appointment Reminders',
    [NOTIFICATION_TYPES.ON_THE_WAY_ALERTS]: '"On the Way" Alerts',
    [NOTIFICATION_TYPES.JOB_UPDATES]: 'Job Status Updates',
    [NOTIFICATION_TYPES.PAYMENT_REMINDERS]: 'Payment Reminders',
    [NOTIFICATION_TYPES.MARKETING]: 'Special Offers & News'
};

export default {
    CONTACT_METHODS,
    NOTIFICATION_TYPES,
    DEFAULT_PREFERENCES,
    getCustomerPreferences,
    saveCustomerPreferences,
    isNotificationAllowed,
    getBestContactMethod,
    CONTACT_METHOD_LABELS,
    NOTIFICATION_TYPE_LABELS
};
