// src/lib/chatService.js
// ============================================
// CHAT SERVICE
// ============================================
// Handles real-time messaging between homeowners and contractors

import { 
    collection, addDoc, query, where, 
    orderBy, onSnapshot, serverTimestamp, 
    doc, setDoc, updateDoc, arrayUnion, increment,
    limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ============================================
// HELPERS
// ============================================

/**
 * Create a consistent Channel ID from user ID and contractor name
 * Format: {homeownerId}_{contractorNameSlug}
 */
export const getChannelId = (userId, contractorName) => {
    const safeName = contractorName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${userId}_${safeName}`;
};

// ============================================
// SEND MESSAGE
// ============================================

/**
 * Send a message in a channel
 * Creates/updates the channel document and adds the message
 * 
 * @param {string} channelId - The channel ID
 * @param {string} text - Message text
 * @param {string} senderId - ID of the sender
 * @param {string} senderName - Display name of the sender
 * @param {string|null} recipientId - ID of the recipient (for unread counts)
 * @param {object|null} senderInfo - Additional sender info to store on channel
 *        For homeowners: { name, email, phone, propertyAddress, scopeOfWork }
 *        For contractors: { name, email, phone }
 */
export const sendMessage = async (
    channelId, 
    text, 
    senderId, 
    senderName, 
    recipientId = null,
    senderInfo = null
) => {
    try {
        const channelRef = doc(db, 'channels', channelId);
        const messagesRef = collection(channelRef, 'messages');

        // Prepare channel update data
        const channelUpdate = {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            participants: arrayUnion(senderId),
            channelId: channelId,
            updatedAt: serverTimestamp()
        };

        // If we know the recipient, add them to participants and increment their unread count
        if (recipientId) {
            channelUpdate.participants = arrayUnion(senderId, recipientId);
            channelUpdate[`unreadCount_${recipientId}`] = increment(1);
        }

        // Store sender info on the channel for display purposes
        // This helps contractors see homeowner names, and vice versa
        if (senderInfo) {
            // Determine if sender is homeowner or contractor based on channel ID format
            const isHomeowner = channelId.startsWith(senderId);
            
            if (isHomeowner) {
                // Store homeowner info
                if (senderInfo.name) channelUpdate.homeownerName = senderInfo.name;
                if (senderInfo.email) channelUpdate.homeownerEmail = senderInfo.email;
                if (senderInfo.phone) channelUpdate.homeownerPhone = senderInfo.phone;
                
                // NEW: Store property address and scope for fallback display
                if (senderInfo.propertyAddress) channelUpdate.propertyAddress = senderInfo.propertyAddress;
                if (senderInfo.scopeOfWork) channelUpdate.scopeOfWork = senderInfo.scopeOfWork;
            } else {
                // Store contractor info
                if (senderInfo.name) channelUpdate.contractorName = senderInfo.name;
                if (senderInfo.email) channelUpdate.contractorEmail = senderInfo.email;
                if (senderInfo.phone) channelUpdate.contractorPhone = senderInfo.phone;
            }
        }

        // Create/Update the channel document
        await setDoc(channelRef, channelUpdate, { merge: true });

        // Add the actual message
        await addDoc(messagesRef, {
            text,
            senderId,
            senderName,
            createdAt: serverTimestamp(),
            read: false
        });
        
    } catch (error) {
        console.error("Error sending message:", error);
        throw error;
    }
};

// ============================================
// SUBSCRIBE TO CHAT MESSAGES
// ============================================

/**
 * Subscribe to real-time message updates for a single channel
 *
 * @param {string} channelId - The channel to subscribe to
 * @param {function} callback - Called with array of messages
 * @returns {function} Unsubscribe function
 */
export const subscribeToChat = (channelId, callback) => {
    // Guard against invalid channelId
    if (!channelId || typeof channelId !== 'string') {
        console.warn('subscribeToChat: Invalid channelId:', channelId);
        callback([]);
        return () => {}; // Return no-op unsubscribe
    }

    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(messages);
    }, (error) => {
        // Handle specific error codes gracefully
        if (error.code === 'permission-denied') {
            console.warn('Chat subscription: Permission denied for channel:', channelId);
        } else if (error.code === 'unavailable' || error.message?.includes('network')) {
            console.warn('Chat subscription: Network issue, will retry automatically');
        } else {
            console.error('Chat subscription error:', error);
        }
        callback([]);
    });
};

// ============================================
// MARK CHANNEL AS READ
// ============================================

/**
 * Mark a channel as read for a specific user
 * Resets their unread count to 0
 * 
 * @param {string} channelId - The channel ID
 * @param {string} userId - The user marking as read
 */
export const markChannelAsRead = async (channelId, userId) => {
    try {
        const channelRef = doc(db, 'channels', channelId);
        await updateDoc(channelRef, {
            [`unreadCount_${userId}`]: 0
        });
    } catch (error) {
        // Silently fail - this is non-critical
        console.warn("Could not mark channel as read:", error);
    }
};

// ============================================
// GLOBAL UNREAD COUNT
// ============================================

/**
 * Subscribe to total unread message count across all channels
 * Used for showing badge on nav items
 * 
 * @param {string} userId - The user to get unread count for
 * @param {function} callback - Called with total unread count
 * @returns {function} Unsubscribe function
 */
export const subscribeToGlobalUnreadCount = (userId, callback) => {
    const q = query(
        collection(db, 'channels'), 
        where('participants', 'array-contains', userId)
    );

    return onSnapshot(q, (snapshot) => {
        let totalUnread = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            totalUnread += (data[`unreadCount_${userId}`] || 0);
        });
        callback(totalUnread);
    }, (error) => {
        console.error('Unread count subscription error:', error);
        callback(0);
    });
};

// ============================================
// GET RECENT CHANNELS
// ============================================

/**
 * Subscribe to recent channels for a user
 * Useful for inbox/conversation list views
 * 
 * @param {string} userId - The user ID
 * @param {function} callback - Called with array of channels
 * @param {number} maxChannels - Maximum channels to return (default 20)
 * @returns {function} Unsubscribe function
 */
export const subscribeToRecentChannels = (userId, callback, maxChannels = 20) => {
    const q = query(
        collection(db, 'channels'),
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTime', 'desc'),
        limit(maxChannels)
    );

    return onSnapshot(q, (snapshot) => {
        const channels = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(channels);
    }, (error) => {
        console.error('Channels subscription error:', error);
        callback([]);
    });
};

// ============================================
// UPDATE CHANNEL INFO
// ============================================

/**
 * Update channel metadata (homeowner/contractor info)
 * Called when we have more info about a participant
 *
 * @param {string} channelId - The channel ID
 * @param {object} info - Info to merge into channel
 */
export const updateChannelInfo = async (channelId, info) => {
    try {
        const channelRef = doc(db, 'channels', channelId);
        await updateDoc(channelRef, {
            ...info,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.warn("Could not update channel info:", error);
    }
};

// ============================================
// CREATE JOB CHAT CHANNEL
// ============================================

/**
 * Create or update a chat channel for a job
 * Called when contractor offers time slots or homeowner needs to message about a job
 * Idempotent - safe to call multiple times
 *
 * @param {string} homeownerId - The homeowner's user ID
 * @param {string} contractorId - The contractor's ID
 * @param {string} contractorName - The contractor's display name
 * @param {string} homeownerName - The homeowner's display name
 * @param {string} jobId - The job ID to link
 * @param {string} jobTitle - The job title/scope
 * @returns {Promise<{success: boolean, channelId?: string, reason?: string}>}
 */
export const createJobChatChannel = async (
    homeownerId,
    contractorId,
    contractorName,
    homeownerName,
    jobId,
    jobTitle
) => {
    if (!homeownerId || !contractorId) {
        console.warn('createJobChatChannel: Missing homeownerId or contractorId');
        return { success: false, reason: 'missing-params' };
    }

    try {
        // Channel ID format: homeownerId_contractorId (one channel per pair)
        const channelId = `${homeownerId}_${contractorId}`;
        const channelRef = doc(db, 'channels', channelId);

        // Check if channel already exists to preserve createdAt
        const { getDoc } = await import('firebase/firestore');
        const channelSnap = await getDoc(channelRef);

        const channelData = {
            channelId,
            participants: [homeownerId, contractorId],
            homeownerName: homeownerName || 'Homeowner',
            contractorName: contractorName || 'Contractor',
            source: channelSnap.exists() ? (channelSnap.data().source || 'job') : 'job',
            linkedJobId: jobId || null,
            scopeOfWork: jobTitle || channelSnap.data()?.scopeOfWork || null,
            lastMessageTime: channelSnap.exists() ? channelSnap.data().lastMessageTime : serverTimestamp(),
            createdAt: channelSnap.exists() ? channelSnap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Use merge to preserve existing data (message history is in subcollection)
        await setDoc(channelRef, channelData, { merge: true });

        console.log('✅ Job chat channel created/updated:', channelId);
        return { success: true, channelId };

    } catch (error) {
        console.warn('Could not create job chat channel:', error);
        return { success: false, reason: error.message };
    }
};

// ============================================
// CREATE EVALUATION CHAT CHANNEL
// ============================================

/**
 * Create or update a chat channel for an evaluation
 * Called when homeowner submits evaluation media
 * Allows contractor to ask clarifying questions
 *
 * @param {string} homeownerId - The homeowner's user ID
 * @param {string} contractorId - The contractor's ID
 * @param {string} contractorName - The contractor's display name
 * @param {string} homeownerName - The homeowner's display name
 * @param {string} evaluationId - The evaluation ID to link
 * @param {string} scope - The job description/scope
 * @returns {Promise<{success: boolean, channelId?: string, reason?: string}>}
 */
export const createEvaluationChatChannel = async (
    homeownerId,
    contractorId,
    contractorName,
    homeownerName,
    evaluationId,
    scope
) => {
    if (!homeownerId || !contractorId) {
        console.warn('createEvaluationChatChannel: Missing homeownerId or contractorId');
        return { success: false, reason: 'missing-params' };
    }

    try {
        // Channel ID format: homeownerId_contractorId (one channel per pair)
        const channelId = `${homeownerId}_${contractorId}`;
        const channelRef = doc(db, 'channels', channelId);

        // Check if channel already exists
        const { getDoc } = await import('firebase/firestore');
        const channelSnap = await getDoc(channelRef);

        const channelData = {
            channelId,
            participants: [homeownerId, contractorId],
            homeownerName: homeownerName || 'Homeowner',
            contractorName: contractorName || 'Contractor',
            source: channelSnap.exists() ? (channelSnap.data().source || 'evaluation') : 'evaluation',
            linkedEvaluationId: evaluationId || null,
            scopeOfWork: scope || channelSnap.data()?.scopeOfWork || null,
            lastMessageTime: channelSnap.exists() ? channelSnap.data().lastMessageTime : serverTimestamp(),
            createdAt: channelSnap.exists() ? channelSnap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(channelRef, channelData, { merge: true });

        console.log('✅ Evaluation chat channel created/updated:', channelId);
        return { success: true, channelId };

    } catch (error) {
        console.warn('Could not create evaluation chat channel:', error);
        return { success: false, reason: error.message };
    }
};

// ============================================
// ENSURE CHANNEL EXISTS
// ============================================

/**
 * Ensure a chat channel exists between homeowner and contractor
 * Creates if not exists, updates if exists
 * Generic helper for any context
 *
 * @param {string} homeownerId - The homeowner's user ID
 * @param {string} contractorId - The contractor's ID
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, channelId?: string, exists?: boolean}>}
 */
export const ensureChatChannelExists = async (
    homeownerId,
    contractorId,
    options = {}
) => {
    if (!homeownerId || !contractorId) {
        return { success: false, reason: 'missing-params' };
    }

    const {
        contractorName = 'Contractor',
        homeownerName = 'Homeowner',
        jobId = null,
        evaluationId = null,
        quoteId = null,
        scopeOfWork = null
    } = options;

    try {
        const channelId = `${homeownerId}_${contractorId}`;
        const channelRef = doc(db, 'channels', channelId);

        const { getDoc } = await import('firebase/firestore');
        const channelSnap = await getDoc(channelRef);
        const exists = channelSnap.exists();

        // Build update data, only including non-null values
        const channelData = {
            channelId,
            participants: [homeownerId, contractorId],
            updatedAt: serverTimestamp()
        };

        if (homeownerName) channelData.homeownerName = homeownerName;
        if (contractorName) channelData.contractorName = contractorName;
        if (scopeOfWork) channelData.scopeOfWork = scopeOfWork;
        if (jobId) channelData.linkedJobId = jobId;
        if (evaluationId) channelData.linkedEvaluationId = evaluationId;
        if (quoteId) channelData.linkedQuoteId = quoteId;

        if (!exists) {
            channelData.createdAt = serverTimestamp();
            channelData.source = jobId ? 'job' : evaluationId ? 'evaluation' : quoteId ? 'quote' : 'direct';
        }

        await setDoc(channelRef, channelData, { merge: true });

        return { success: true, channelId, exists };

    } catch (error) {
        console.warn('Could not ensure chat channel:', error);
        return { success: false, reason: error.message };
    }
};

// ============================================
// ARCHIVE CHAT CHANNEL
// ============================================

/**
 * Archive a chat channel when a job is cancelled or completed
 * Marks the channel with a status but preserves message history
 *
 * @param {string} channelId - The channel ID to archive (or null to build from jobId)
 * @param {string} jobId - The job ID (used to add context)
 * @param {string} reason - 'cancelled' | 'completed' | 'expired'
 * @returns {Promise<{success: boolean}>}
 */
export const archiveChatChannel = async (channelId, jobId, reason = 'cancelled') => {
    // If no channelId provided, we can't archive
    if (!channelId) {
        console.warn('[archiveChatChannel] No channelId provided');
        return { success: false, reason: 'no-channel-id' };
    }

    try {
        const channelRef = doc(db, 'channels', channelId);

        await updateDoc(channelRef, {
            status: reason, // 'cancelled', 'completed', 'expired'
            archivedAt: serverTimestamp(),
            archivedReason: reason,
            [`linkedJobId_${reason}`]: jobId,
            updatedAt: serverTimestamp()
        });

        console.log(`[archiveChatChannel] Channel ${channelId} marked as ${reason}`);
        return { success: true };

    } catch (error) {
        console.warn('[archiveChatChannel] Error:', error);
        return { success: false, reason: error.message };
    }
};
