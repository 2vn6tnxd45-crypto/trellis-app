// src/lib/chatService.js
import { 
    collection, addDoc, query, where, 
    orderBy, onSnapshot, serverTimestamp, 
    doc, setDoc, getDoc, updateDoc 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Helper to create a consistent Channel ID
export const getChannelId = (userId, contractorName) => {
    // Sanitize name: "Bob's Plumbing" -> "bobs-plumbing"
    const safeName = contractorName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${userId}_${safeName}`;
};

// 1. Send a Message
export const sendMessage = async (channelId, text, senderId, senderName) => {
    try {
        const channelRef = doc(db, 'channels', channelId);
        const messagesRef = collection(channelRef, 'messages');

        // Ensure channel exists (idempotent)
        await setDoc(channelRef, {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            participants: [senderId],
            channelId: channelId,
            updatedAt: serverTimestamp()
        }, { merge: true });

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

// 2. Subscribe to Messages (Real-time listener)
export const subscribeToChat = (channelId, callback) => {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    // This listener stays open and calls 'callback' whenever data changes
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(messages);
    });
};
