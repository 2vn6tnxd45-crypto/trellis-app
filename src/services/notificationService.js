// src/services/notificationService.js
// Push Notification Service - Handles FCM initialization, tokens, and messaging

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '../config/firebase';
import { appId } from '../config/constants';

// VAPID key for web push (public key from Firebase Console)
// This should be set via environment variable
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

let messagingInstance = null;
let messageListeners = [];

/**
 * Check if push notifications are supported in this browser
 */
export const isPushSupported = async () => {
    // Check basic requirements
    if (!('Notification' in window)) {
        return { supported: false, reason: 'Notifications not supported' };
    }

    if (!('serviceWorker' in navigator)) {
        return { supported: false, reason: 'Service workers not supported' };
    }

    // Check Firebase messaging support
    try {
        const supported = await isSupported();
        if (!supported) {
            return { supported: false, reason: 'Firebase messaging not supported' };
        }
    } catch (e) {
        return { supported: false, reason: 'Firebase messaging check failed' };
    }

    return { supported: true, reason: null };
};

/**
 * Get the current notification permission status
 */
export const getPermissionStatus = () => {
    if (!('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission; // 'granted', 'denied', or 'default'
};

/**
 * Request notification permission from the user
 */
export const requestPermission = async () => {
    if (!('Notification' in window)) {
        return { granted: false, status: 'unsupported' };
    }

    try {
        const permission = await Notification.requestPermission();
        return {
            granted: permission === 'granted',
            status: permission
        };
    } catch (e) {
        console.error('[Notifications] Permission request failed:', e);
        return { granted: false, status: 'error', error: e.message };
    }
};

/**
 * Register the Firebase messaging service worker
 */
export const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers not supported');
    }

    try {
        // Pass Firebase config to service worker
        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID
        };

        // Create URL with config parameters
        const swUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
        if (firebaseConfig) {
            Object.entries(firebaseConfig).forEach(([key, value]) => {
                if (value) swUrl.searchParams.append(key, value);
            });
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register(swUrl.href, {
            scope: '/'
        });

        // Wait for it to be ready
        await navigator.serviceWorker.ready;

        // Post config to service worker
        if (registration.active) {
            registration.active.postMessage({
                type: 'FIREBASE_CONFIG',
                config: firebaseConfig
            });
        }

        console.log('[Notifications] Service worker registered:', registration.scope);
        return registration;
    } catch (e) {
        console.error('[Notifications] Service worker registration failed:', e);
        throw e;
    }
};

/**
 * Initialize Firebase Cloud Messaging
 */
export const initializeMessaging = async () => {
    if (messagingInstance) {
        return messagingInstance;
    }

    const { supported, reason } = await isPushSupported();
    if (!supported) {
        console.warn('[Notifications] Push not supported:', reason);
        return null;
    }

    try {
        messagingInstance = getMessaging(app);
        console.log('[Notifications] Messaging initialized');
        return messagingInstance;
    } catch (e) {
        console.error('[Notifications] Messaging initialization failed:', e);
        return null;
    }
};

/**
 * Get FCM token for this device
 * Token is used to send push notifications to this specific device
 */
export const getFCMToken = async (serviceWorkerRegistration = null) => {
    const messaging = await initializeMessaging();
    if (!messaging) {
        return null;
    }

    if (Notification.permission !== 'granted') {
        console.warn('[Notifications] Permission not granted, cannot get token');
        return null;
    }

    try {
        const options = {
            vapidKey: VAPID_KEY
        };

        // Use provided service worker registration if available
        if (serviceWorkerRegistration) {
            options.serviceWorkerRegistration = serviceWorkerRegistration;
        }

        const token = await getToken(messaging, options);

        if (token) {
            console.log('[Notifications] FCM token obtained');
            return token;
        } else {
            console.warn('[Notifications] No FCM token available');
            return null;
        }
    } catch (e) {
        console.error('[Notifications] Failed to get FCM token:', e);
        return null;
    }
};

/**
 * Save FCM token to user's Firestore document
 */
export const saveTokenToFirestore = async (userId, token) => {
    if (!userId || !token) {
        console.warn('[Notifications] Cannot save token: missing userId or token');
        return false;
    }

    try {
        const tokenDocRef = doc(db, 'artifacts', appId, 'users', userId, 'fcmTokens', 'web');

        await setDoc(tokenDocRef, {
            token,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            platform: 'web',
            userAgent: navigator.userAgent,
            active: true
        }, { merge: true });

        console.log('[Notifications] Token saved to Firestore');
        return true;
    } catch (e) {
        console.error('[Notifications] Failed to save token:', e);
        return false;
    }
};

/**
 * Remove FCM token from Firestore (on logout or permission revoke)
 */
export const removeTokenFromFirestore = async (userId) => {
    if (!userId) return false;

    try {
        const tokenDocRef = doc(db, 'artifacts', appId, 'users', userId, 'fcmTokens', 'web');
        await updateDoc(tokenDocRef, {
            active: false,
            removedAt: serverTimestamp()
        });
        console.log('[Notifications] Token deactivated');
        return true;
    } catch (e) {
        console.error('[Notifications] Failed to remove token:', e);
        return false;
    }
};

/**
 * Set up foreground message listener
 * Called when app is in focus and receives a push notification
 */
export const onForegroundMessage = (callback) => {
    messageListeners.push(callback);

    // Return unsubscribe function
    return () => {
        messageListeners = messageListeners.filter(cb => cb !== callback);
    };
};

/**
 * Initialize foreground message handling
 */
export const setupForegroundListener = async () => {
    const messaging = await initializeMessaging();
    if (!messaging) return null;

    return onMessage(messaging, (payload) => {
        console.log('[Notifications] Foreground message received:', payload);

        // Notify all registered listeners
        messageListeners.forEach(callback => {
            try {
                callback(payload);
            } catch (e) {
                console.error('[Notifications] Listener error:', e);
            }
        });

        // Optionally show a toast or in-app notification
        // The app can handle this via the callback
    });
};

/**
 * Full initialization flow for push notifications
 * Call this after user logs in and grants permission
 */
export const initializePushNotifications = async (userId) => {
    try {
        // 1. Check support
        const { supported, reason } = await isPushSupported();
        if (!supported) {
            return { success: false, reason };
        }

        // 2. Check permission
        if (Notification.permission !== 'granted') {
            return { success: false, reason: 'Permission not granted' };
        }

        // 3. Register service worker
        const swRegistration = await registerServiceWorker();

        // 4. Initialize messaging
        await initializeMessaging();

        // 5. Get FCM token
        const token = await getFCMToken(swRegistration);
        if (!token) {
            return { success: false, reason: 'Could not get FCM token' };
        }

        // 6. Save token to Firestore
        if (userId) {
            await saveTokenToFirestore(userId, token);
        }

        // 7. Set up foreground listener
        await setupForegroundListener();

        return { success: true, token };
    } catch (e) {
        console.error('[Notifications] Initialization failed:', e);
        return { success: false, reason: e.message };
    }
};

/**
 * Show a local notification (for testing or app-triggered notifications)
 */
export const showLocalNotification = async (title, options = {}) => {
    if (Notification.permission !== 'granted') {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-96.png',
            ...options
        });
        return true;
    } catch (e) {
        console.error('[Notifications] Failed to show notification:', e);
        return false;
    }
};

export default {
    isPushSupported,
    getPermissionStatus,
    requestPermission,
    initializeMessaging,
    getFCMToken,
    saveTokenToFirestore,
    removeTokenFromFirestore,
    onForegroundMessage,
    initializePushNotifications,
    showLocalNotification
};
