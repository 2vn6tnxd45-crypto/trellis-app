// src/features/jobs/lib/jobUpdateService.js
// ============================================
// JOB UPDATE SERVICE
// ============================================
// Handles crew progress updates during jobs
// Supports informal notes that can be transformed into customer-facing summaries

import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

export const UPDATE_TYPES = {
    PROGRESS: 'progress',
    ISSUE: 'issue',
    MATERIAL: 'material',
    DELAY: 'delay'
};

const VALID_UPDATE_TYPES = Object.values(UPDATE_TYPES);

// ============================================
// HELPERS
// ============================================

/**
 * Generate a unique ID for job updates
 * @returns {string} Unique identifier
 */
function generateUpdateId() {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Add a progress update to a job
 * @param {string} jobId - The job document ID
 * @param {object} updateData - The update data
 * @param {string} updateData.type - Update type: 'progress' | 'issue' | 'material' | 'delay'
 * @param {string} updateData.notes - Crew notes describing the update
 * @param {Array} [updateData.photos] - Array of photo objects (same format as progressPhotos)
 * @param {string} techId - ID of the tech creating the update
 * @param {string} techName - Display name of the tech
 * @returns {Promise<{success: boolean, updateId?: string, error?: string}>}
 */
export const addJobUpdate = async (jobId, updateData, techId, techName) => {
    try {
        // Validate required fields
        if (!jobId) {
            throw new Error('Job ID is required');
        }

        if (!updateData?.type) {
            throw new Error('Update type is required');
        }

        if (!updateData?.notes) {
            throw new Error('Update notes are required');
        }

        if (!techId || !techName) {
            throw new Error('Tech ID and name are required');
        }

        if (!VALID_UPDATE_TYPES.includes(updateData.type)) {
            throw new Error(`Invalid update type. Must be one of: ${VALID_UPDATE_TYPES.join(', ')}`);
        }

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const jobData = jobSnap.data();

        // Validate job is in a state that allows updates
        if (!['scheduled', 'in_progress'].includes(jobData.status)) {
            throw new Error(`Cannot add updates to job with status: ${jobData.status}`);
        }

        const updateId = generateUpdateId();

        const newUpdate = {
            id: updateId,
            createdAt: serverTimestamp(),
            createdBy: techId,
            createdByName: techName,
            type: updateData.type,
            notes: updateData.notes,
            photos: updateData.photos || [],
            sentToCustomer: false,
            customerSummary: null
        };

        await updateDoc(jobRef, {
            updates: arrayUnion(newUpdate),
            lastActivity: serverTimestamp()
        });

        console.log('[JobUpdateService] Update added:', updateId);

        return { success: true, updateId };

    } catch (error) {
        console.error('[JobUpdateService] Error adding update:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Retrieve all updates for a job
 * @param {string} jobId - The job document ID
 * @returns {Promise<{success: boolean, updates?: Array, error?: string}>}
 */
export const getJobUpdates = async (jobId) => {
    try {
        if (!jobId) {
            throw new Error('Job ID is required');
        }

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const jobData = jobSnap.data();
        const updates = jobData.updates || [];

        // Sort updates by createdAt descending (most recent first)
        const sortedUpdates = [...updates].sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
            const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
            return timeB - timeA;
        });

        return { success: true, updates: sortedUpdates };

    } catch (error) {
        console.error('[JobUpdateService] Error getting updates:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Mark an update as sent to the customer with summary data
 * @param {string} jobId - The job document ID
 * @param {string} updateId - The update ID to mark as sent
 * @param {object} summaryData - The customer summary data
 * @param {string} summaryData.generatedText - AI-generated customer-friendly text
 * @param {string} [summaryData.editedText] - User-edited version of the text
 * @param {string} summaryData.sentVia - How it was sent: 'email' | 'sms' | 'app'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markUpdateSent = async (jobId, updateId, summaryData) => {
    try {
        if (!jobId) {
            throw new Error('Job ID is required');
        }

        if (!updateId) {
            throw new Error('Update ID is required');
        }

        if (!summaryData?.generatedText) {
            throw new Error('Generated text is required');
        }

        if (!summaryData?.sentVia) {
            throw new Error('Sent via method is required');
        }

        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const jobData = jobSnap.data();
        const updates = jobData.updates || [];

        const updateIndex = updates.findIndex((u) => u.id === updateId);

        if (updateIndex === -1) {
            throw new Error('Update not found');
        }

        // Create updated array with the modified update
        // Note: Firestore doesn't support updating nested array items directly
        const updatedUpdates = [...updates];
        updatedUpdates[updateIndex] = {
            ...updatedUpdates[updateIndex],
            sentToCustomer: true,
            customerSummary: {
                generatedText: summaryData.generatedText,
                editedText: summaryData.editedText || null,
                sentAt: serverTimestamp(),
                sentVia: summaryData.sentVia
            }
        };

        await updateDoc(jobRef, {
            updates: updatedUpdates,
            lastActivity: serverTimestamp()
        });

        console.log('[JobUpdateService] Update marked as sent:', updateId);

        return { success: true };

    } catch (error) {
        console.error('[JobUpdateService] Error marking update as sent:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// EXPORTS
// ============================================

export default {
    addJobUpdate,
    getJobUpdates,
    markUpdateSent,
    UPDATE_TYPES
};
