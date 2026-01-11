// src/lib/debug.js
// ============================================
// DEBUG LOGGING UTILITY
// ============================================
// Only logs in development mode to keep production clean
// Usage: import { debug } from '../lib/debug';
//        debug.log('[MyComponent]', 'message', data);

const isDev = import.meta.env.DEV;

/**
 * Debug logger that only outputs in development mode
 * Mirrors console methods but suppresses in production
 */
export const debug = {
    log: (...args) => {
        if (isDev) console.log(...args);
    },
    warn: (...args) => {
        if (isDev) console.warn(...args);
    },
    error: (...args) => {
        // Always log errors, even in production
        console.error(...args);
    },
    info: (...args) => {
        if (isDev) console.info(...args);
    },
    group: (...args) => {
        if (isDev) console.group(...args);
    },
    groupEnd: () => {
        if (isDev) console.groupEnd();
    },
    table: (...args) => {
        if (isDev) console.table(...args);
    },
    time: (label) => {
        if (isDev) console.time(label);
    },
    timeEnd: (label) => {
        if (isDev) console.timeEnd(label);
    }
};

/**
 * Check if we're in development mode
 */
export const isDevMode = () => isDev;

/**
 * Conditional logging with a feature flag
 * Usage: debugFeature('auth', 'User logged in', user);
 */
const enabledFeatures = new Set([
    // Uncomment features you want to debug:
    // 'auth',
    // 'firestore',
    // 'quotes',
    // 'jobs',
]);

export const debugFeature = (feature, ...args) => {
    if (isDev && enabledFeatures.has(feature)) {
        console.log(`[${feature}]`, ...args);
    }
};

export default debug;
