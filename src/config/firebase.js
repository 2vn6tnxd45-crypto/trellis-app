// src/config/firebase.js
// ============================================
// FIREBASE CONFIGURATION WITH INDEXEDDB RECOVERY
// ============================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    memoryLocalCache
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getVertexAI, getGenerativeModel } from "firebase/vertexai";

// Use Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app;
let auth;
let db;
let storage;
let geminiModel = null;

// ============================================
// CORRUPTION DETECTION KEY
// ============================================
const CORRUPTION_KEY = 'krib_idb_corrupted';
const FAILURE_KEY = 'krib_idb_failure';
const MAX_FAILURES = 2;

// ============================================
// GLOBAL ERROR HANDLER FOR INDEXEDDB CORRUPTION
// ============================================
// This catches the Firebase internal errors that slip through try/catch
if (typeof window !== 'undefined') {
    const originalOnError = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        // Detect IndexedDB corruption errors
        if (message && (
            message.includes('refusing to open IndexedDB') ||
            message.includes('potential corruption') ||
            message.includes('IndexedDB transaction') && message.includes('AbortError')
        )) {
            console.error('[Firebase] 🚨 IndexedDB corruption detected via global handler!');
            markCorrupted();
            // Trigger recovery after a short delay
            setTimeout(() => {
                if (!sessionStorage.getItem('krib_recovering')) {
                    sessionStorage.setItem('krib_recovering', 'true');
                    recoverFromStorageIssues();
                }
            }, 100);
        }
        // Call original handler if exists
        if (originalOnError) {
            return originalOnError(message, source, lineno, colno, error);
        }
        return false;
    };

    // Also catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || String(event.reason);
        if (
            message.includes('refusing to open IndexedDB') ||
            message.includes('potential corruption') ||
            (message.includes('IndexedDB') && message.includes('AbortError')) ||
            (message.includes('IndexedDB') && message.includes('unavailable'))
        ) {
            console.error('[Firebase] 🚨 IndexedDB corruption detected via unhandledrejection!');
            markCorrupted();
            setTimeout(() => {
                if (!sessionStorage.getItem('krib_recovering')) {
                    sessionStorage.setItem('krib_recovering', 'true');
                    recoverFromStorageIssues();
                }
            }, 100);
        }
    });
}

// ============================================
// CORRUPTION MARKERS
// ============================================
const markCorrupted = () => {
    try {
        localStorage.setItem(CORRUPTION_KEY, 'true');
        localStorage.setItem(FAILURE_KEY, '99'); // Force memory cache on next load
    } catch (e) {
        // localStorage might be unavailable
    }
};

const isMarkedCorrupted = () => {
    try {
        return localStorage.getItem(CORRUPTION_KEY) === 'true';
    } catch (e) {
        return false;
    }
};

const clearCorruptionMark = () => {
    try {
        localStorage.removeItem(CORRUPTION_KEY);
    } catch (e) {
        // Ignore
    }
};

const recordFailure = () => {
    try {
        const failures = parseInt(localStorage.getItem(FAILURE_KEY) || '0', 10);
        localStorage.setItem(FAILURE_KEY, String(failures + 1));
        return failures + 1;
    } catch (e) {
        return 1;
    }
};

const getFailureCount = () => {
    try {
        return parseInt(localStorage.getItem(FAILURE_KEY) || '0', 10);
    } catch (e) {
        return 0;
    }
};

const clearFailures = () => {
    try {
        localStorage.removeItem(FAILURE_KEY);
    } catch (e) {
        // Ignore
    }
};

// ============================================
// INDEXEDDB HEALTH CHECK
// ============================================
const checkIndexedDBHealth = async () => {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Firebase] IndexedDB health check timed out');
            resolve(false);
        }, 3000);
        
        try {
            const testDbName = 'firebase-idb-health-check';
            const request = indexedDB.open(testDbName, 1);
            
            request.onerror = (event) => {
                clearTimeout(timeout);
                console.warn('[Firebase] IndexedDB health check failed:', event);
                resolve(false);
            };
            
            request.onblocked = () => {
                clearTimeout(timeout);
                console.warn('[Firebase] IndexedDB health check blocked');
                resolve(false);
            };
            
            request.onsuccess = () => {
                clearTimeout(timeout);
                try {
                    request.result.close();
                    indexedDB.deleteDatabase(testDbName);
                    resolve(true);
                } catch (e) {
                    console.warn('[Firebase] IndexedDB cleanup failed:', e);
                    resolve(false);
                }
            };
            
            request.onupgradeneeded = (event) => {
                try {
                    const db = event.target.result;
                    db.createObjectStore('test', { keyPath: 'id' });
                } catch (e) {
                    clearTimeout(timeout);
                    console.warn('[Firebase] IndexedDB upgrade failed:', e);
                    resolve(false);
                }
            };
        } catch (e) {
            clearTimeout(timeout);
            console.warn('[Firebase] IndexedDB not available:', e);
            resolve(false);
        }
    });
};

// ============================================
// CLEAR CORRUPTED INDEXEDDB
// ============================================
const clearFirebaseIndexedDB = async () => {
    const dbNames = [
        'firebase-heartbeat-database',
        'firebaseLocalStorageDb'
    ];
    
    // Also try to find Firestore databases (they have dynamic names)
    try {
        const databases = await indexedDB.databases();
        for (const dbInfo of databases) {
            if (dbInfo.name && (
                dbInfo.name.includes('firestore') || 
                dbInfo.name.includes('firebase')
            )) {
                dbNames.push(dbInfo.name);
            }
        }
    } catch (e) {
        // indexedDB.databases() not supported in all browsers
        console.warn('[Firebase] Could not enumerate databases:', e);
    }
    
    console.log('[Firebase] Clearing databases:', dbNames);
    
    // Delete each database
    for (const name of dbNames) {
        try {
            await new Promise((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => {
                    console.log(`[Firebase] Deleted IndexedDB: ${name}`);
                    resolve();
                };
                request.onerror = () => {
                    console.warn(`[Firebase] Failed to delete: ${name}`);
                    resolve();
                };
                request.onblocked = () => {
                    console.warn(`[Firebase] Delete blocked: ${name}`);
                    resolve();
                };
            });
        } catch (e) {
            console.warn(`[Firebase] Error deleting ${name}:`, e);
        }
    }
};

// ============================================
// CHECK IF THIS IS A CONTRACTOR FLOW
// ============================================
const isContractorFlow = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    // Include:
    // - ?pro= : contractor dashboard
    // - ?requestId= : contractor viewing request  
    // - ?quote= : viewing a quote
    // - ?from=quote : returning from accepting a quote (prevents corruption)
    return params.has('pro') || 
           params.has('requestId') || 
           params.has('quote') ||
           params.get('from') === 'quote';
};

// ============================================
// DETERMINE IF WE SHOULD USE MEMORY CACHE
// ============================================
const shouldUseMemoryCache = () => {
    // 1. Previously marked as corrupted
    if (isMarkedCorrupted()) {
        console.log('[Firebase] Using memory cache: corruption marker found');
        return { useMemory: true, reason: 'corruption marker' };
    }
    
    // 2. Contractor flows don't need persistence
    if (isContractorFlow()) {
        console.log('[Firebase] Using memory cache: contractor flow');
        return { useMemory: true, reason: 'contractor flow' };
    }
    
    // 3. Previous failures detected
    if (getFailureCount() >= MAX_FAILURES) {
        console.log('[Firebase] Using memory cache: previous failures');
        return { useMemory: true, reason: 'previous failures' };
    }
    
    return { useMemory: false, reason: null };
};

// ============================================
// SYNCHRONOUS INITIALIZATION
// ============================================
try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    
    const { useMemory, reason } = shouldUseMemoryCache();
    
    if (useMemory) {
        console.log(`[Firebase] Using memory cache (${reason})`);
        db = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
        
        // If corrupted, try to clean up in background
        if (reason === 'corruption marker' || reason === 'previous failures') {
            clearFirebaseIndexedDB().then(() => {
                clearFailures();
                clearCorruptionMark();
                console.log('[Firebase] Cleaned up IndexedDB, will try persistence on next full reload');
            });
        }
    } else {
        // Try persistent cache
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });
            console.log('[Firebase] Using persistent cache');
        } catch (e) {
            console.warn('[Firebase] Persistent cache failed, using memory:', e);
            recordFailure();
            
            // Check if it's a corruption error
            if (e.message?.includes('IndexedDB') || e.message?.includes('corruption')) {
                markCorrupted();
            }
            
            db = initializeFirestore(app, {
                localCache: memoryLocalCache()
            });
        }
    }
    
    // Initialize Vertex AI
    try {
        const vertexAI = getVertexAI(app);
        geminiModel = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });
    } catch (aiError) {
        console.warn("[Firebase] AI Initialization failed (optional feature):", aiError);
    }

} catch (e) {
    console.error("[Firebase] Critical Init Error:", e);
    recordFailure();
    
    // Check if it's a corruption error
    if (e.message?.includes('IndexedDB') || e.message?.includes('corruption')) {
        markCorrupted();
    }
    
    // Last resort recovery
    try {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = initializeFirestore(app, { localCache: memoryLocalCache() });
        storage = getStorage(app);
        console.warn('[Firebase] Recovered with memory cache');
    } catch (recoveryError) {
        console.error('[Firebase] Recovery failed:', recoveryError);
    }
}

// ============================================
// EXPORT RECOVERY UTILITY
// ============================================
export const recoverFromStorageIssues = async () => {
    console.log('[Firebase] Manual recovery triggered');
    await clearFirebaseIndexedDB();
    clearFailures();
    clearCorruptionMark();
    // Reload the page to reinitialize
    window.location.reload();
};

export const reportFirestoreHang = () => {
    const count = recordFailure();
    // If we hit max failures, mark as corrupted for immediate memory cache on reload
    if (count >= MAX_FAILURES) {
        markCorrupted();
    }
    return count;
};

// Export a function to force recovery (can be called from UI)
export const forceRecovery = () => {
    markCorrupted();
    recoverFromStorageIssues();
};

export { app, auth, db, storage, geminiModel };
