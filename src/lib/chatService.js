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
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(messages);
    }, (error) => {
        console.error('Chat subscription error:', error);
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
