// src/config/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    memoryLocalCache,
    enableIndexedDbPersistence,
    CACHE_SIZE_UNLIMITED
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

// Helper to detect if we're in a contractor flow (doesn't need offline persistence)
const isContractorFlow = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('pro') || params.has('requestId');
};

// Helper to check if IndexedDB is available and working
const checkIndexedDB = async () => {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open('test-idb-availability');
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                request.result.close();
                indexedDB.deleteDatabase('test-idb-availability');
                resolve(true);
            };
        } catch (e) {
            resolve(false);
        }
    });
};

try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Determine cache strategy
    // - Contractor flows: use memory cache (simpler, no IndexedDB issues)
    // - Main app: try persistent cache, fall back to memory if issues
    if (isContractorFlow()) {
        // Contractor pages don't need offline persistence
        console.log('[Firebase] Using memory cache for contractor flow');
        db = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
    } else {
        // Main app - try persistent cache with fallback
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });
            console.log('[Firebase] Using persistent cache');
        } catch (persistenceError) {
            console.warn('[Firebase] Persistent cache failed, falling back to memory:', persistenceError);
            // Fall back to memory cache
            db = initializeFirestore(app, {
                localCache: memoryLocalCache()
            });
        }
    }
    
    // Initialize Storage
    storage = getStorage(app);
    
    // Initialize Vertex AI
    try {
        const vertexAI = getVertexAI(app);
        geminiModel = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });
    } catch (aiError) {
        console.warn("[Firebase] AI Initialization failed (optional feature):", aiError);
    }

} catch (e) {
    console.error("[Firebase] Init Error:", e);
    
    // Last resort: try to initialize with memory cache
    if (!db) {
        try {
            app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = initializeFirestore(app, {
                localCache: memoryLocalCache()
            });
            storage = getStorage(app);
            console.warn('[Firebase] Recovered with memory cache');
        } catch (recoveryError) {
            console.error('[Firebase] Recovery failed:', recoveryError);
        }
    }
}

export { app, auth, db, storage, geminiModel };
