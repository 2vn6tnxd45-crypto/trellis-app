// src/hooks/useNotificationPermission.js
// Custom hook for managing push notification permissions and setup

import { useState, useEffect, useCallback } from 'react';
import {
    isPushSupported,
    getPermissionStatus,
    requestPermission,
    initializePushNotifications,
    onForegroundMessage,
    removeTokenFromFirestore
} from '../services/notificationService';

// Local storage key for tracking if user has dismissed the prompt
const PROMPT_DISMISSED_KEY = 'krib_notification_prompt_dismissed';
const PROMPT_DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hook for managing push notification permissions
 * @param {string} userId - Current user's ID
 * @param {object} options - Configuration options
 */
export const useNotificationPermission = (userId, options = {}) => {
    const {
        autoInitialize = true, // Automatically initialize if already granted
        onMessage = null // Callback for foreground messages
    } = options;

    // State
    const [isSupported, setIsSupported] = useState(null); // null = checking
    const [permission, setPermission] = useState(getPermissionStatus());
    const [isInitialized, setIsInitialized] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState(null);
    const [fcmToken, setFcmToken] = useState(null);

    // Check if prompt was recently dismissed
    const [promptDismissed, setPromptDismissed] = useState(() => {
        try {
            const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
            if (dismissed) {
                const dismissTime = parseInt(dismissed, 10);
                // Check if dismiss has expired
                if (Date.now() - dismissTime > PROMPT_DISMISS_DURATION) {
                    localStorage.removeItem(PROMPT_DISMISSED_KEY);
                    return false;
                }
                return true;
            }
            return false;
        } catch {
            return false;
        }
    });

    // Check browser support on mount
    useEffect(() => {
        const checkSupport = async () => {
            const { supported } = await isPushSupported();
            setIsSupported(supported);
        };
        checkSupport();
    }, []);

    // Auto-initialize if permission already granted
    useEffect(() => {
        if (autoInitialize && userId && permission === 'granted' && !isInitialized && !isInitializing) {
            initializeNotifications();
        }
    }, [autoInitialize, userId, permission, isInitialized, isInitializing]);

    // Set up foreground message listener
    useEffect(() => {
        if (!isInitialized || !onMessage) return;

        const unsubscribe = onForegroundMessage((payload) => {
            onMessage(payload);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isInitialized, onMessage]);

    /**
     * Request permission and initialize notifications
     */
    const requestAndInitialize = useCallback(async () => {
        if (!isSupported) {
            setError('Push notifications not supported');
            return { success: false, reason: 'not supported' };
        }

        setIsInitializing(true);
        setError(null);

        try {
            // Request permission
            const { granted, status } = await requestPermission();
            setPermission(status);

            if (!granted) {
                setIsInitializing(false);
                return { success: false, reason: 'Permission denied' };
            }

            // Initialize if permission granted
            return await initializeNotifications();
        } catch (e) {
            setError(e.message);
            setIsInitializing(false);
            return { success: false, reason: e.message };
        }
    }, [isSupported, userId]);

    /**
     * Initialize notifications (assumes permission already granted)
     */
    const initializeNotifications = useCallback(async () => {
        if (isInitialized) {
            return { success: true, token: fcmToken };
        }

        setIsInitializing(true);
        setError(null);

        try {
            const result = await initializePushNotifications(userId);

            if (result.success) {
                setIsInitialized(true);
                setFcmToken(result.token);
            } else {
                setError(result.reason);
            }

            setIsInitializing(false);
            return result;
        } catch (e) {
            setError(e.message);
            setIsInitializing(false);
            return { success: false, reason: e.message };
        }
    }, [userId, isInitialized, fcmToken]);

    /**
     * Dismiss the permission prompt temporarily
     */
    const dismissPrompt = useCallback(() => {
        try {
            localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
            setPromptDismissed(true);
        } catch {
            // Ignore storage errors
        }
    }, []);

    /**
     * Clear the dismissed state (show prompt again)
     */
    const clearDismissed = useCallback(() => {
        try {
            localStorage.removeItem(PROMPT_DISMISSED_KEY);
            setPromptDismissed(false);
        } catch {
            // Ignore storage errors
        }
    }, []);

    /**
     * Cleanup on logout
     */
    const cleanup = useCallback(async () => {
        if (userId) {
            await removeTokenFromFirestore(userId);
        }
        setIsInitialized(false);
        setFcmToken(null);
    }, [userId]);

    // Derived state
    const shouldShowPrompt = isSupported &&
        permission === 'default' &&
        !promptDismissed &&
        !isInitializing;

    const canRequestPermission = isSupported &&
        permission !== 'denied' &&
        !isInitializing;

    return {
        // State
        isSupported,
        permission,
        isInitialized,
        isInitializing,
        error,
        fcmToken,
        promptDismissed,

        // Derived
        shouldShowPrompt,
        canRequestPermission,
        isGranted: permission === 'granted',
        isDenied: permission === 'denied',

        // Actions
        requestAndInitialize,
        initializeNotifications,
        dismissPrompt,
        clearDismissed,
        cleanup
    };
};

export default useNotificationPermission;
