// src/features/contractor-pro/lib/techAuthService.js
// ============================================
// TECH AUTHENTICATION SERVICE
// ============================================
// Handles PIN-based authentication for field technicians
// Supports invite links for initial setup and PIN for daily access

import { db } from '../../../config/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

const PIN_LENGTH = 4;
const INVITE_TOKEN_LENGTH = 32;
const INVITE_EXPIRY_HOURS = 72; // 3 days
const SESSION_KEY = 'trellis_tech_session';
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ============================================
// HELPERS
// ============================================

/**
 * Generate a cryptographically secure random string
 */
const generateSecureToken = (length = INVITE_TOKEN_LENGTH) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
};

/**
 * Generate a random PIN
 */
const generatePin = () => {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    const pin = (randomValues[0] % 10000).toString().padStart(PIN_LENGTH, '0');
    return pin;
};

/**
 * Hash a PIN (simple hash for storage - in production use bcrypt on server)
 */
const hashPin = async (pin) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'trellis_tech_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify a PIN against stored hash
 */
const verifyPinHash = async (pin, storedHash) => {
    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
};

// ============================================
// INVITE MANAGEMENT
// ============================================

/**
 * Generate an invite link for a tech to set up portal access
 * @param {string} contractorId
 * @param {string} techId
 * @returns {Promise<{success: boolean, inviteUrl?: string, token?: string, error?: string}>}
 */
export const generateTechInvite = async (contractorId, techId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { success: false, error: 'Contractor not found' };
        }

        const data = contractorDoc.data();
        const teamMembers = data.scheduling?.teamMembers || [];
        const techIndex = teamMembers.findIndex(t => t.id === techId);

        if (techIndex === -1) {
            return { success: false, error: 'Team member not found' };
        }

        // Generate invite token
        const inviteToken = generateSecureToken();
        const inviteExpiry = new Date();
        inviteExpiry.setHours(inviteExpiry.getHours() + INVITE_EXPIRY_HOURS);

        // Update team member with invite
        teamMembers[techIndex] = {
            ...teamMembers[techIndex],
            portalAccess: {
                ...teamMembers[techIndex].portalAccess,
                inviteToken,
                inviteExpiry: inviteExpiry.toISOString(),
                inviteCreatedAt: new Date().toISOString(),
                status: 'invited'
            }
        };

        await updateDoc(contractorRef, {
            'scheduling.teamMembers': teamMembers,
            updatedAt: serverTimestamp()
        });

        // Build invite URL
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/tech-portal/setup?token=${inviteToken}&contractor=${contractorId}`;

        return {
            success: true,
            inviteUrl,
            token: inviteToken,
            expiresAt: inviteExpiry.toISOString()
        };
    } catch (error) {
        console.error('[techAuthService] Error generating invite:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Validate an invite token and return tech info
 * @param {string} token
 * @param {string} contractorId
 * @returns {Promise<{valid: boolean, tech?: Object, contractorName?: string, error?: string}>}
 */
export const validateInviteToken = async (token, contractorId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { valid: false, error: 'Invalid invite link' };
        }

        const data = contractorDoc.data();
        const teamMembers = data.scheduling?.teamMembers || [];

        // Find tech with this invite token
        const tech = teamMembers.find(t =>
            t.portalAccess?.inviteToken === token
        );

        if (!tech) {
            return { valid: false, error: 'Invite not found or already used' };
        }

        // Check expiry
        const expiry = new Date(tech.portalAccess.inviteExpiry);
        if (expiry < new Date()) {
            return { valid: false, error: 'Invite link has expired' };
        }

        // Check if already set up
        if (tech.portalAccess.status === 'active' && tech.portalAccess.pinHash) {
            return { valid: false, error: 'Portal access already set up. Use your PIN to login.' };
        }

        return {
            valid: true,
            tech: {
                id: tech.id,
                name: tech.name,
                email: tech.email,
                color: tech.color
            },
            contractorId,
            contractorName: data.businessName || data.companyName || 'Your Company'
        };
    } catch (error) {
        console.error('[techAuthService] Error validating invite:', error);
        return { valid: false, error: error.message };
    }
};

/**
 * Complete invite setup - set PIN and activate portal access
 * @param {string} token
 * @param {string} contractorId
 * @param {string} pin
 * @returns {Promise<{success: boolean, techId?: string, error?: string}>}
 */
export const completeInviteSetup = async (token, contractorId, pin) => {
    try {
        // Validate PIN format
        if (!pin || pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
            return { success: false, error: `PIN must be ${PIN_LENGTH} digits` };
        }

        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { success: false, error: 'Setup failed' };
        }

        const data = contractorDoc.data();
        const teamMembers = [...(data.scheduling?.teamMembers || [])];

        const techIndex = teamMembers.findIndex(t =>
            t.portalAccess?.inviteToken === token
        );

        if (techIndex === -1) {
            return { success: false, error: 'Invite not found' };
        }

        // Hash PIN
        const pinHash = await hashPin(pin);

        // Update tech with PIN and activate
        teamMembers[techIndex] = {
            ...teamMembers[techIndex],
            portalAccess: {
                ...teamMembers[techIndex].portalAccess,
                pinHash,
                pinSetAt: new Date().toISOString(),
                status: 'active',
                // Clear invite token after use
                inviteToken: null,
                inviteExpiry: null,
                failedAttempts: 0,
                lastLogin: null
            }
        };

        await updateDoc(contractorRef, {
            'scheduling.teamMembers': teamMembers,
            updatedAt: serverTimestamp()
        });

        return {
            success: true,
            techId: teamMembers[techIndex].id,
            techName: teamMembers[techIndex].name
        };
    } catch (error) {
        console.error('[techAuthService] Error completing setup:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// PIN AUTHENTICATION
// ============================================

/**
 * Authenticate tech with PIN
 * @param {string} contractorId
 * @param {string} techId
 * @param {string} pin
 * @returns {Promise<{success: boolean, session?: Object, error?: string}>}
 */
export const authenticateWithPin = async (contractorId, techId, pin) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { success: false, error: 'Authentication failed' };
        }

        const data = contractorDoc.data();
        const teamMembers = [...(data.scheduling?.teamMembers || [])];
        const techIndex = teamMembers.findIndex(t => t.id === techId);

        if (techIndex === -1) {
            return { success: false, error: 'Authentication failed' };
        }

        const tech = teamMembers[techIndex];
        const portalAccess = tech.portalAccess || {};

        // Check if portal access is active
        if (portalAccess.status !== 'active') {
            return { success: false, error: 'Portal access not set up' };
        }

        // Check for lockout
        if (portalAccess.lockedUntil) {
            const lockedUntil = new Date(portalAccess.lockedUntil);
            if (lockedUntil > new Date()) {
                const minutesRemaining = Math.ceil((lockedUntil - new Date()) / 60000);
                return {
                    success: false,
                    error: `Too many failed attempts. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
                    locked: true
                };
            }
        }

        // Verify PIN
        const isValid = await verifyPinHash(pin, portalAccess.pinHash);

        if (!isValid) {
            // Increment failed attempts
            const failedAttempts = (portalAccess.failedAttempts || 0) + 1;
            const updates = {
                'portalAccess.failedAttempts': failedAttempts
            };

            // Lock after max attempts
            if (failedAttempts >= MAX_PIN_ATTEMPTS) {
                const lockedUntil = new Date();
                lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES);
                updates['portalAccess.lockedUntil'] = lockedUntil.toISOString();
            }

            teamMembers[techIndex] = {
                ...tech,
                portalAccess: {
                    ...portalAccess,
                    failedAttempts,
                    ...(failedAttempts >= MAX_PIN_ATTEMPTS ? { lockedUntil: updates['portalAccess.lockedUntil'] } : {})
                }
            };

            await updateDoc(contractorRef, {
                'scheduling.teamMembers': teamMembers
            });

            const remainingAttempts = MAX_PIN_ATTEMPTS - failedAttempts;
            if (remainingAttempts > 0) {
                return {
                    success: false,
                    error: `Incorrect PIN. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
                };
            } else {
                return {
                    success: false,
                    error: `Account locked for ${LOCKOUT_MINUTES} minutes.`,
                    locked: true
                };
            }
        }

        // Success - reset failed attempts and update last login
        teamMembers[techIndex] = {
            ...tech,
            portalAccess: {
                ...portalAccess,
                failedAttempts: 0,
                lockedUntil: null,
                lastLogin: new Date().toISOString()
            }
        };

        await updateDoc(contractorRef, {
            'scheduling.teamMembers': teamMembers
        });

        // Create session
        const session = {
            techId: tech.id,
            techName: tech.name,
            techColor: tech.color,
            contractorId,
            contractorName: data.businessName || data.companyName,
            authenticatedAt: new Date().toISOString(),
            expiresAt: getSessionExpiry().toISOString()
        };

        // Store session
        saveSession(session);

        return { success: true, session };
    } catch (error) {
        console.error('[techAuthService] Error authenticating:', error);
        return { success: false, error: 'Authentication failed' };
    }
};

/**
 * Authenticate with phone/email lookup (for returning techs who forgot contractor ID)
 * @param {string} identifier - Phone or email
 * @param {string} pin
 * @returns {Promise<{success: boolean, session?: Object, contractors?: Array, error?: string}>}
 */
export const authenticateByContact = async (identifier, pin) => {
    try {
        // Search all contractors for this tech by phone or email
        const contractorsRef = collection(db, CONTRACTORS_COLLECTION_PATH);
        const snapshot = await getDocs(contractorsRef);

        const matches = [];

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const teamMembers = data.scheduling?.teamMembers || [];

            const matchingTech = teamMembers.find(t =>
                (t.phone && t.phone.replace(/\D/g, '') === identifier.replace(/\D/g, '')) ||
                (t.email && t.email.toLowerCase() === identifier.toLowerCase())
            );

            if (matchingTech && matchingTech.portalAccess?.status === 'active') {
                matches.push({
                    contractorId: docSnap.id,
                    contractorName: data.businessName || data.companyName,
                    tech: matchingTech
                });
            }
        }

        if (matches.length === 0) {
            return { success: false, error: 'No account found with this contact info' };
        }

        // If multiple contractors, return list for user to choose
        if (matches.length > 1) {
            return {
                success: false,
                multipleContractors: true,
                contractors: matches.map(m => ({
                    id: m.contractorId,
                    name: m.contractorName
                }))
            };
        }

        // Single match - authenticate with PIN
        const match = matches[0];
        return authenticateWithPin(match.contractorId, match.tech.id, pin);
    } catch (error) {
        console.error('[techAuthService] Error in contact lookup:', error);
        return { success: false, error: 'Authentication failed' };
    }
};

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get session expiry (end of day or 12 hours, whichever is sooner)
 */
const getSessionExpiry = () => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const twelveHours = new Date(now);
    twelveHours.setHours(twelveHours.getHours() + 12);

    return endOfDay < twelveHours ? endOfDay : twelveHours;
};

/**
 * Save session to storage
 */
const saveSession = (session) => {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        // Also save to localStorage for persistence across tabs
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
        console.error('[techAuthService] Error saving session:', error);
    }
};

/**
 * Get current session
 * @returns {Object|null}
 */
export const getTechSession = () => {
    try {
        // Try sessionStorage first, then localStorage
        let sessionData = sessionStorage.getItem(SESSION_KEY);
        if (!sessionData) {
            sessionData = localStorage.getItem(SESSION_KEY);
            if (sessionData) {
                // Restore to sessionStorage
                sessionStorage.setItem(SESSION_KEY, sessionData);
            }
        }

        if (!sessionData) return null;

        const session = JSON.parse(sessionData);

        // Check expiry
        if (new Date(session.expiresAt) < new Date()) {
            clearTechSession();
            return null;
        }

        return session;
    } catch (error) {
        console.error('[techAuthService] Error getting session:', error);
        return null;
    }
};

/**
 * Clear tech session (logout)
 */
export const clearTechSession = () => {
    try {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
    } catch (error) {
        console.error('[techAuthService] Error clearing session:', error);
    }
};

/**
 * Check if session is valid
 * @returns {boolean}
 */
export const isSessionValid = () => {
    return getTechSession() !== null;
};

// ============================================
// PIN MANAGEMENT
// ============================================

/**
 * Change PIN (requires current PIN)
 * @param {string} contractorId
 * @param {string} techId
 * @param {string} currentPin
 * @param {string} newPin
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const changePin = async (contractorId, techId, currentPin, newPin) => {
    try {
        // Validate new PIN format
        if (!newPin || newPin.length !== PIN_LENGTH || !/^\d+$/.test(newPin)) {
            return { success: false, error: `New PIN must be ${PIN_LENGTH} digits` };
        }

        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { success: false, error: 'Operation failed' };
        }

        const data = contractorDoc.data();
        const teamMembers = [...(data.scheduling?.teamMembers || [])];
        const techIndex = teamMembers.findIndex(t => t.id === techId);

        if (techIndex === -1) {
            return { success: false, error: 'Operation failed' };
        }

        const tech = teamMembers[techIndex];
        const portalAccess = tech.portalAccess || {};

        // Verify current PIN
        const isValid = await verifyPinHash(currentPin, portalAccess.pinHash);
        if (!isValid) {
            return { success: false, error: 'Current PIN is incorrect' };
        }

        // Hash and save new PIN
        const newPinHash = await hashPin(newPin);
        teamMembers[techIndex] = {
            ...tech,
            portalAccess: {
                ...portalAccess,
                pinHash: newPinHash,
                pinSetAt: new Date().toISOString(),
                pinChangedAt: new Date().toISOString()
            }
        };

        await updateDoc(contractorRef, {
            'scheduling.teamMembers': teamMembers,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[techAuthService] Error changing PIN:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Reset PIN (admin function - generates new PIN)
 * @param {string} contractorId
 * @param {string} techId
 * @returns {Promise<{success: boolean, newPin?: string, error?: string}>}
 */
export const resetPin = async (contractorId, techId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { success: false, error: 'Operation failed' };
        }

        const data = contractorDoc.data();
        const teamMembers = [...(data.scheduling?.teamMembers || [])];
        const techIndex = teamMembers.findIndex(t => t.id === techId);

        if (techIndex === -1) {
            return { success: false, error: 'Team member not found' };
        }

        // Generate new PIN
        const newPin = generatePin();
        const pinHash = await hashPin(newPin);

        teamMembers[techIndex] = {
            ...teamMembers[techIndex],
            portalAccess: {
                ...teamMembers[techIndex].portalAccess,
                pinHash,
                pinSetAt: new Date().toISOString(),
                pinResetAt: new Date().toISOString(),
                failedAttempts: 0,
                lockedUntil: null,
                status: 'active'
            }
        };

        await updateDoc(contractorRef, {
            'scheduling.teamMembers': teamMembers,
            updatedAt: serverTimestamp()
        });

        return { success: true, newPin };
    } catch (error) {
        console.error('[techAuthService] Error resetting PIN:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Revoke portal access for a tech
 * @param {string} contractorId
 * @param {string} techId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const revokePortalAccess = async (contractorId, techId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { success: false, error: 'Operation failed' };
        }

        const data = contractorDoc.data();
        const teamMembers = [...(data.scheduling?.teamMembers || [])];
        const techIndex = teamMembers.findIndex(t => t.id === techId);

        if (techIndex === -1) {
            return { success: false, error: 'Team member not found' };
        }

        teamMembers[techIndex] = {
            ...teamMembers[techIndex],
            portalAccess: {
                ...teamMembers[techIndex].portalAccess,
                status: 'revoked',
                revokedAt: new Date().toISOString(),
                pinHash: null
            }
        };

        await updateDoc(contractorRef, {
            'scheduling.teamMembers': teamMembers,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[techAuthService] Error revoking access:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// EXPORTS
// ============================================

export default {
    // Invite management
    generateTechInvite,
    validateInviteToken,
    completeInviteSetup,

    // Authentication
    authenticateWithPin,
    authenticateByContact,

    // Session management
    getTechSession,
    clearTechSession,
    isSessionValid,

    // PIN management
    changePin,
    resetPin,
    revokePortalAccess,

    // Constants
    PIN_LENGTH,
    MAX_PIN_ATTEMPTS,
    LOCKOUT_MINUTES
};
