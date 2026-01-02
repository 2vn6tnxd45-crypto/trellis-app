// src/config/firebase.js
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
// INDEXEDDB HEALTH CHECK
// ============================================
// Tests if IndexedDB is working properly before we try to use it
const checkIndexedDBHealth = async () => {
    return new Promise((resolve) => {
        // Set a timeout - if IndexedDB is broken it might hang
        const timeout = setTimeout(() => {
            console.warn('[Firebase] IndexedDB health check timed out');
            resolve(false);
        }, 3000);
        
        try {
            // Try to open a test database
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
                // Create a test object store to verify full functionality
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
// Nuclear option: clear all Firebase IndexedDB databases
const clearFirebaseIndexedDB = async () => {
    const dbNames = [
        'firebase-heartbeat-database',
        'firebaseLocalStorageDb'
    ];
    
    // Also try to find Firestore databases (they have dynamic names)
    try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
            if (db.name && (
                db.name.includes('firestore') || 
                db.name.includes('firebase')
            )) {
                dbNames.push(db.name);
            }
        }
    } catch (e) {
        // indexedDB.databases() not supported in all browsers
        console.warn('[Firebase] Could not enumerate databases:', e);
    }
    
    // Delete each database
    for (const name of dbNames) {
        try {
            await new Promise((resolve, reject) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => {
                    console.log(`[Firebase] Deleted IndexedDB: ${name}`);
                    resolve();
                };
                request.onerror = () => {
                    console.warn(`[Firebase] Failed to delete: ${name}`);
                    resolve(); // Continue anyway
                };
                request.onblocked = () => {
                    console.warn(`[Firebase] Delete blocked: ${name}`);
                    resolve(); // Continue anyway
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
    // Include quote viewing - homeowners don't need persistence either
    return params.has('pro') || params.has('requestId') || params.has('quote');
};

// ============================================
// CHECK FOR PREVIOUS FAILURES
// ============================================
const FAILURE_KEY = 'krib_idb_failure';
const MAX_FAILURES = 2;

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
// MAIN INITIALIZATION
// ============================================
const initializeFirebase = async () => {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    
    // Determine cache strategy
    let useMemoryCache = false;
    let reason = '';
    
    // 1. Contractor flows always use memory cache (no persistence needed)
    if (isContractorFlow()) {
        useMemoryCache = true;
        reason = 'contractor flow';
    }
    
    // 2. If we've had multiple failures, skip IndexedDB entirely
    if (!useMemoryCache && getFailureCount() >= MAX_FAILURES) {
        useMemoryCache = true;
        reason = 'previous failures detected';
        // Try to clear the corrupted databases in the background
        clearFirebaseIndexedDB().then(() => {
            console.log('[Firebase] Attempted to clear corrupted IndexedDB');
            clearFailures(); // Reset counter after cleanup
        });
    }
    
    // 3. Test IndexedDB health before using it
    if (!useMemoryCache) {
        const idbHealthy = await checkIndexedDBHealth();
        if (!idbHealthy) {
            useMemoryCache = true;
            reason = 'IndexedDB health check failed';
            recordFailure();
        }
    }
    
    // Initialize Firestore with chosen cache strategy
    if (useMemoryCache) {
        console.log(`[Firebase] Using memory cache (${reason})`);
        db = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
    } else {
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });
            console.log('[Firebase] Using persistent cache');
            clearFailures(); // Success - reset failure counter
        } catch (persistenceError) {
            console.warn('[Firebase] Persistent cache init failed:', persistenceError);
            recordFailure();
            
            // Fall back to memory cache
            // Note: We need to get a fresh app instance since initializeFirestore 
            // can only be called once per app
            db = initializeFirestore(app, {
                localCache: memoryLocalCache()
            });
            console.log('[Firebase] Fell back to memory cache');
        }
    }
    
    // Initialize Vertex AI (optional)
    try {
        const vertexAI = getVertexAI(app);
        geminiModel = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });
    } catch (aiError) {
        console.warn("[Firebase] AI Initialization failed (optional feature):", aiError);
    }
};

// ============================================
// SYNCHRONOUS INITIALIZATION (for immediate use)
// ============================================
// We need to initialize synchronously for backwards compatibility,
// but we'll use a simpler strategy and let the async health check
// potentially trigger a page reload if needed

try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    
    // Quick sync decision: contractor flows or previous failures = memory cache
    const useMemoryCacheSync = isContractorFlow() || getFailureCount() >= MAX_FAILURES;
    
    if (useMemoryCacheSync) {
        console.log('[Firebase] Using memory cache (sync init)');
        db = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
        
        // If we had failures, try to clean up IndexedDB in background
        if (getFailureCount() >= MAX_FAILURES) {
            clearFirebaseIndexedDB().then(() => {
                clearFailures();
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
// Can be called from UI if user reports issues
export const recoverFromStorageIssues = async () => {
    console.log('[Firebase] Manual recovery triggered');
    await clearFirebaseIndexedDB();
    clearFailures();
    // Reload the page to reinitialize
    window.location.reload();
};

export const reportFirestoreHang = () => {
    recordFailure();
    return getFailureCount();
};

export { app, auth, db, storage, geminiModel };
