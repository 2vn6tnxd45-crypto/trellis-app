// public/firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the app is not in focus

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration - must match your app's config
// These values are safe to expose in client-side code
// Firebase configuration - can be passed via URL params or injected
const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
    apiKey: params.get('apiKey') || self.FIREBASE_CONFIG?.apiKey || '',
    authDomain: params.get('authDomain') || self.FIREBASE_CONFIG?.authDomain || '',
    projectId: params.get('projectId') || self.FIREBASE_CONFIG?.projectId || '',
    storageBucket: params.get('storageBucket') || self.FIREBASE_CONFIG?.storageBucket || '',
    messagingSenderId: params.get('messagingSenderId') || self.FIREBASE_CONFIG?.messagingSenderId || '',
    appId: params.get('appId') || self.FIREBASE_CONFIG?.appId || ''
};

// Initialize Firebase in the service worker
if (firebaseConfig.apiKey) {
    try {
        firebase.initializeApp(firebaseConfig);

        // Get messaging instance
        const messaging = firebase.messaging();

        // Handle background messages (when app is not in focus)
        messaging.onBackgroundMessage((payload) => {
            console.log('[SW] Background message received:', payload);

            const notificationTitle = payload.notification?.title || 'Krib Notification';
            const notificationOptions = {
                body: payload.notification?.body || 'You have a new notification',
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-96.png',
                tag: payload.data?.tag || 'krib-notification',
                data: payload.data || {},
                // Action buttons
                actions: getActionsForType(payload.data?.type),
                // Vibration pattern
                vibrate: [100, 50, 100],
                // Require interaction for important notifications
                requireInteraction: payload.data?.priority === 'high'
            };

            return self.registration.showNotification(notificationTitle, notificationOptions);
        });

        console.log('[SW] Firebase Messaging initialized successfully');
    } catch (e) {
        console.error('[SW] Firebase Messaging initialization failed:', e);
    }
} else {
    console.warn('[SW] Skipping Firebase Messaging init: Missing config');
}

// Get notification actions based on type
function getActionsForType(type) {
    switch (type) {
        case 'maintenance_due':
            return [
                { action: 'complete', title: 'Mark Done' },
                { action: 'snooze', title: 'Snooze' }
            ];
        case 'contractor_message':
            return [
                { action: 'reply', title: 'Reply' },
                { action: 'view', title: 'View' }
            ];
        case 'quote_received':
            return [
                { action: 'view', title: 'View Quote' }
            ];
        default:
            return [
                { action: 'view', title: 'Open App' }
            ];
    }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const data = event.notification.data || {};
    let targetUrl = '/';

    // Route based on notification type and action
    if (event.action === 'complete' && data.taskId) {
        targetUrl = `/?task=${data.taskId}&action=complete`;
    } else if (event.action === 'snooze' && data.taskId) {
        targetUrl = `/?task=${data.taskId}&action=snooze`;
    } else if (event.action === 'reply' && data.channelId) {
        targetUrl = `/?messages=${data.channelId}`;
    } else if (event.action === 'view') {
        if (data.quoteId) {
            targetUrl = `/?quote=${data.quoteId}`;
        } else if (data.taskId) {
            targetUrl = `/?view=maintenance`;
        } else if (data.jobId) {
            targetUrl = `/?job=${data.jobId}`;
        }
    } else {
        // Default click - go to dashboard or specific screen
        if (data.screen) {
            targetUrl = `/?view=${data.screen}`;
        }
    }

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Try to focus existing window
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        client.navigate(targetUrl);
                        return;
                    }
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});

// Handle notification close (for analytics)
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event.notification.tag);
});

// Service worker install event
self.addEventListener('install', (event) => {
    console.log('[SW] Firebase Messaging SW installed');
    self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Firebase Messaging SW activated');
    event.waitUntil(clients.claim());
});
