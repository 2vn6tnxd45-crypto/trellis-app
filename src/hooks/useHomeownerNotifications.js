// src/hooks/useHomeownerNotifications.js
// ============================================
// HOMEOWNER NOTIFICATIONS HOOK
// ============================================
// Subscribes to notifications for homeowners (new jobs, completions, etc.)
// Notifications are stored in: users/{userId}/notifications

import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { appId } from '../config/constants';

/**
 * Hook to manage homeowner notifications
 * @param {string} userId - The homeowner's user ID
 * @returns {Object} - notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification
 */
export const useHomeownerNotifications = (userId) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Subscribe to notifications
    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const notificationsRef = collection(db, 'artifacts', appId, 'users', userId, 'notifications');
        const q = query(
            notificationsRef,
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.() || new Date()
                }));
                setNotifications(notifs);
                setLoading(false);
            },
            (err) => {
                console.error('[useHomeownerNotifications] Error:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // Get unread notifications
    const unreadNotifications = notifications.filter(n => !n.read);

    // Get notifications by type
    const getNotificationsByType = useCallback((type) => {
        return notifications.filter(n => n.type === type);
    }, [notifications]);

    // Mark a notification as read
    const markAsRead = useCallback(async (notificationId) => {
        if (!userId) return;

        try {
            const notifRef = doc(db, 'artifacts', appId, 'users', userId, 'notifications', notificationId);
            await updateDoc(notifRef, {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (err) {
            console.error('[useHomeownerNotifications] Error marking as read:', err);
        }
    }, [userId]);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        if (!userId || unreadNotifications.length === 0) return;

        try {
            const batch = writeBatch(db);
            unreadNotifications.forEach(notif => {
                const notifRef = doc(db, 'artifacts', appId, 'users', userId, 'notifications', notif.id);
                batch.update(notifRef, {
                    read: true,
                    readAt: serverTimestamp()
                });
            });
            await batch.commit();
        } catch (err) {
            console.error('[useHomeownerNotifications] Error marking all as read:', err);
        }
    }, [userId, unreadNotifications]);

    // Delete a notification
    const deleteNotification = useCallback(async (notificationId) => {
        if (!userId) return;

        try {
            const notifRef = doc(db, 'artifacts', appId, 'users', userId, 'notifications', notificationId);
            await deleteDoc(notifRef);
        } catch (err) {
            console.error('[useHomeownerNotifications] Error deleting notification:', err);
        }
    }, [userId]);

    // Clear all notifications
    const clearAllNotifications = useCallback(async () => {
        if (!userId || notifications.length === 0) return;

        try {
            const batch = writeBatch(db);
            notifications.forEach(notif => {
                const notifRef = doc(db, 'artifacts', appId, 'users', userId, 'notifications', notif.id);
                batch.delete(notifRef);
            });
            await batch.commit();
        } catch (err) {
            console.error('[useHomeownerNotifications] Error clearing notifications:', err);
        }
    }, [userId, notifications]);

    return {
        notifications,
        unreadNotifications,
        unreadCount,
        loading,
        error,
        // Actions
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        // Helpers
        getNotificationsByType,
        // Specific notification types
        jobNotifications: notifications.filter(n => n.type === 'new_job'),
        completionNotifications: notifications.filter(n => n.type === 'job_completed')
    };
};

export default useHomeownerNotifications;
