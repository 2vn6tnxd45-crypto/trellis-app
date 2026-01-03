// src/lib/chatService.js
import { 
    collection, addDoc, query, where, 
    orderBy, onSnapshot, serverTimestamp, 
    doc, setDoc, updateDoc, arrayUnion, increment 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Helper to create a consistent Channel ID
export const getChannelId = (userId, contractorName) => {
    const safeName = contractorName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${userId}_${safeName}`;
};

// 1. Send a Message (Updated to handle Unread Counts)
export const sendMessage = async (channelId, text, senderId, senderName, recipientId = null) => {
    try {
        const channelRef = doc(db, 'channels', channelId);
        const messagesRef = collection(channelRef, 'messages');

        // Prepare channel update data
        const channelUpdate = {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            participants: arrayUnion(senderId), // Ensure sender is in participants
            channelId: channelId,
            updatedAt: serverTimestamp()
        };

        // If we know the recipient, increment their unread count
        // Note: For Pro->Homeowner, recipientId IS the homeowner.
        if (recipientId) {
            channelUpdate.participants = arrayUnion(senderId, recipientId);
            channelUpdate[`unreadCount_${recipientId}`] = increment(1);
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

// 2. Subscribe to Messages (Real-time listener for a single chat)
export const subscribeToChat = (channelId, callback) => {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(messages);
    });
};

// 3. NEW: Mark Channel as Read
export const markChannelAsRead = async (channelId, userId) => {
    try {
        const channelRef = doc(db, 'channels', channelId);
        // Reset ONLY my unread count
        await updateDoc(channelRef, {
            [`unreadCount_${userId}`]: 0
        });
    } catch (error) {
        console.warn("Could not mark channel as read:", error);
    }
};

// 4. NEW: Global Unread Count Listener (For the Badge)
export const subscribeToGlobalUnreadCount = (userId, callback) => {
    // Listen to all channels where I am a participant
    const q = query(
        collection(db, 'channels'), 
        where('participants', 'array-contains', userId)
    );

    return onSnapshot(q, (snapshot) => {
        let totalUnread = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            // Sum up the count specifically for ME
            totalUnread += (data[`unreadCount_${userId}`] || 0);
        });
        callback(totalUnread);
    });
};
