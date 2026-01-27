// src/hooks/useAppLogic.jsx
import { debug } from '../lib/debug';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, collectionGroup, query, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, orderBy, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db, reportFirestoreHang, recoverFromStorageIssues } from '../config/firebase';
import {
    appId,
    REQUESTS_COLLECTION_PATH,
    MAINTENANCE_FREQUENCIES,
    FIRESTORE_TIMEOUT_MS,
    TOKEN_PROPAGATION_DELAY_MS,
    TOKEN_REFRESH_DELAY_MS,
    MAX_RETRY_ATTEMPTS
} from '../config/constants';
import { calculateNextDate, removeUndefined } from '../lib/utils';
import { normalizeAddress } from '../lib/addressUtils';
import { Check, RotateCcw } from 'lucide-react';
// NEW: Import Chat Service Logic for Badge Counts
import { subscribeToGlobalUnreadCount } from '../lib/chatService';

const withTimeout = (promise, ms, operation = 'Operation') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${operation} timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

// ============================================
// HELPER: Get correct document path for a record
// Currently all records live in house_records - the propertyId field
// is just metadata for filtering, not the storage location
// ============================================
const getRecordDocRef = (dbInstance, appIdValue, userId, recordId) => {
    // All records are stored in house_records collection
    // The propertyId field on records is metadata for filtering by property,
    // not an indicator of document location
    return doc(dbInstance, 'artifacts', appIdValue, 'users', userId, 'house_records', recordId);
};

export const useAppLogic = (celebrations) => {
    // =========================================================================
    // STATE - All existing state preserved exactly
    // =========================================================================
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [dueTasks, setDueTasks] = useState([]);
    const [newSubmissions, setNewSubmissions] = useState([]);
    const [activePropertyId, setActivePropertyId] = useState(null);
    const [isSwitchingProp, setIsSwitchingProp] = useState(false);
    const [isAddingProperty, setIsAddingProperty] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [isSavingProperty, setIsSavingProperty] = useState(false);
    const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState(new Set());
    const [quickServiceRecord, setQuickServiceRecord] = useState(null);
    const [quickServiceDescription, setQuickServiceDescription] = useState('');
    const [showQuickService, setShowQuickService] = useState(false);
    const [showGuidedOnboarding, setShowGuidedOnboarding] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [useEnhancedCards, setUseEnhancedCards] = useState(true);
    const [inventoryView, setInventoryView] = useState('category');

    // =========================================================================
    // NEW STATE - For notification dismiss/clear functionality
    // =========================================================================
    const [dismissedNotifications, setDismissedNotifications] = useState(new Set());
    const [highlightedTaskId, setHighlightedTaskId] = useState(null);

    // NEW: Unread Chat Message Count
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    // =========================================================================
    // REF - Track if we just completed property setup (for navigation fix)
    // =========================================================================
    const justCompletedSetup = useRef(false);

    // =========================================================================
    // REF - Firestore listener cleanup refs (prevents stale closure issues)
    // =========================================================================
    const unsubRecordsRef = useRef(null);
    const unsubRequestsRef = useRef(null);

    // =========================================================================
    // DERIVED STATE - All existing derived state preserved exactly
    // =========================================================================
    // MEMOIZED: Only recalculates when profile changes
    const properties = useMemo(() => {
        if (!profile) return [];
        if (profile.properties && Array.isArray(profile.properties)) return profile.properties;
        // FIX: Use address for property name, fallback to "My Home" instead of user's personal name
        if (profile.name || profile.address) {
            const propertyName = profile.address
                ? (typeof profile.address === 'string' ? profile.address.split(',')[0] : profile.address.street || 'My Home')
                : 'My Home';
            return [{
                id: 'legacy',
                name: propertyName,
                address: profile.address,
                coordinates: profile.coordinates
            }];
        }
        return [];
    }, [profile]);
    const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0] || null;

    // MEMOIZED: This fixes the linting "missing dependency" error
    const activePropertyRecords = useMemo(() => {
        return records.filter(r => r.propertyId === activeProperty?.id || (!r.propertyId && activeProperty?.id === 'legacy'));
    }, [records, activeProperty]);

    // =========================================================================
    // EFFECTS - With retry logic for new user permission issues
    // =========================================================================

    useEffect(() => {
        // --- FIX START: Contractor Mode Check ---
        // Prevents homeowner logic from running when a contractor is logged in
        const urlParams = new URLSearchParams(window.location.search);
        const isContractorMode = urlParams.get('pro') !== null || window.location.pathname.includes('/contractor');

        if (isContractorMode) {
            debug.log('[useAppLogic] Contractor mode detected - skipping homeowner data load');
            setLoading(false);
            return; // EXIT EARLY to prevent permission errors
        }
        // --- FIX END ---

        debug.log('[useAppLogic] 🚀 Effect starting, setting up auth listener...');

        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            debug.log('[useAppLogic] 🔥 onAuthStateChanged fired!', {
                hasUser: !!currentUser,
                email: currentUser?.email
            });

            try {
                setUser(currentUser);
                debug.log('[useAppLogic] ✅ setUser complete');

                if (currentUser) {
                    debug.log('[useAppLogic] 👤 User exists, starting token refresh...');

                    // Token refresh
                    try {
                        debug.log('[useAppLogic] ⏳ Calling getIdToken(true)...');
                        const startTime = Date.now();
                        await currentUser.getIdToken(true);
                        debug.log('[useAppLogic] ✅ getIdToken complete in', Date.now() - startTime, 'ms');

                        debug.log('[useAppLogic] ⏳ Waiting for token propagation...');
                        await new Promise(r => setTimeout(r, TOKEN_PROPAGATION_DELAY_MS));
                        debug.log('[useAppLogic] ✅ Token propagation wait complete');
                    } catch (tokenErr) {
                        debug.warn('[useAppLogic] ⚠️ Token refresh failed:', tokenErr);
                    }

                    if (!appId) {
                        debug.error('[useAppLogic] ❌ appId is missing!');
                        throw new Error("appId is missing");
                    }
                    debug.log('[useAppLogic] ✅ appId check passed:', appId);

                    // Profile read
                    const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                    debug.log('[useAppLogic] 📖 Starting profile read...', profileRef.path);

                    let profileSnap = null;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            debug.log(`[useAppLogic] ⏳ getDoc attempt ${attempt}...`);
                            const startTime = Date.now();
                            profileSnap = await withTimeout(
                                getDoc(profileRef),
                                FIRESTORE_TIMEOUT_MS,
                                `getDoc attempt ${attempt}`
                            );
                            debug.log(`[useAppLogic] ✅ getDoc complete in ${Date.now() - startTime}ms, exists:`, profileSnap.exists());
                            break;
                        } catch (readError) {
                            debug.error(`[useAppLogic] ❌ getDoc attempt ${attempt} failed:`, readError);

                            const isPermissionError = readError.code === 'permission-denied' ||
                                readError.message?.includes('permission');
                            const isTimeout = readError.message?.includes('timed out');

                            if (isTimeout) {
                                debug.warn(`[useAppLogic] ⚠️ Firestore timed out on attempt ${attempt}`);

                                // Record failure and check if we need recovery
                                const failureCount = reportFirestoreHang();
                                debug.warn(`[useAppLogic] Recorded failure #${failureCount}`);

                                if (attempt < 3) {
                                    await new Promise(r => setTimeout(r, 1000));
                                    continue;
                                }

                                // After 3 timeouts, check if auto-recovery is needed
                                if (failureCount >= 2) {
                                    debug.error('[useAppLogic] 🔄 Triggering automatic recovery...');
                                    toast.error('Connection issue detected. Refreshing...', { duration: 2000 });
                                    setTimeout(() => recoverFromStorageIssues(), 1500);
                                    return;
                                }

                                profileSnap = null;
                                break;
                            }

                            if (isPermissionError && attempt < 3) {
                                debug.log(`[useAppLogic] 🔄 Retrying after permission error...`);
                                await currentUser.getIdToken(true);
                                await new Promise(r => setTimeout(r, 500 * attempt));
                                continue;
                            }

                            if (!isPermissionError && !isTimeout) {
                                // Check for IndexedDB errors
                                const isIndexedDBError = readError.message?.includes('IndexedDB') ||
                                    readError.code === 'unavailable';
                                if (isIndexedDBError) {
                                    debug.error('[useAppLogic] 🚨 IndexedDB error detected!');
                                    reportFirestoreHang();
                                    toast.error('Storage issue detected. Refreshing...', { duration: 2000 });
                                    setTimeout(() => recoverFromStorageIssues(), 1500);
                                    return;
                                }
                                throw readError;
                            }

                            // If we're here on attempt 3 with permission error, continue without profile
                            if (attempt === 3) {
                                debug.warn('[useAppLogic] ⚠️ All attempts failed, continuing without profile');
                                profileSnap = null;
                                break;
                            }
                        }
                    }

                    if (profileSnap?.exists()) {
                        const data = profileSnap.data();
                        debug.log('[useAppLogic] ✅ Profile loaded:', {
                            hasProperties: !!data.properties,
                            propertyCount: data.properties?.length
                        });
                        setProfile(data);
                        if (data.hasSeenWelcome) setHasSeenWelcome(true);
                        setActivePropertyId(data.activePropertyId || (data.properties?.[0]?.id || 'legacy'));

                        // Backfill email index for existing users (enables contractor job linking)
                        if (currentUser.email) {
                            const { USER_EMAIL_INDEX_PATH } = await import('../config/constants');
                            const normalizedEmail = currentUser.email.toLowerCase().trim();
                            const emailIndexRef = doc(db, USER_EMAIL_INDEX_PATH, normalizedEmail);
                            setDoc(emailIndexRef, {
                                userId: currentUser.uid,
                                email: normalizedEmail,
                                updatedAt: serverTimestamp()
                            }, { merge: true }).catch(err =>
                                debug.warn('[useAppLogic] Email index backfill failed:', err)
                            );
                        }
                    } else {
                        debug.log('[useAppLogic] ℹ️ No profile found (new user)');
                        setProfile(null);
                    }

                    // Set up listeners
                    debug.log('[useAppLogic] 📡 Setting up realtime listeners...');
                    if (unsubRecordsRef.current) unsubRecordsRef.current();
                    const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'), orderBy('dateInstalled', 'desc'));
                    unsubRecordsRef.current = onSnapshot(q, (snap) => {
                        debug.log('[useAppLogic] 📦 Records snapshot:', snap.docs.length, 'records');
                        setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }, (e) => debug.error('[useAppLogic] ❌ Records error:', e));

                    if (unsubRequestsRef.current) unsubRequestsRef.current();
                    const qReq = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", currentUser.uid));
                    unsubRequestsRef.current = onSnapshot(qReq, (snap) => {
                        debug.log('[useAppLogic] 📋 Requests snapshot:', snap.docs.length, 'requests');
                        setNewSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'submitted'));
                    }, (e) => debug.error('[useAppLogic] ❌ Requests error:', e));

                    debug.log('[useAppLogic] ✅ All listeners set up');
                } else {
                    debug.log('[useAppLogic] 👻 No user, clearing state');
                    setProfile(null);
                    setRecords([]);
                    setNewSubmissions([]);
                }
            } catch (error) {
                debug.error('[useAppLogic] ❌ Auth state change error:', error);
                const isPermissionError = error.code === 'permission-denied' ||
                    error.message?.includes('permission') ||
                    error.message?.includes('Missing or insufficient');
                if (!isPermissionError) {
                    toast.error("Error: " + error.message);
                }
            } finally {
                debug.log('[useAppLogic] 🏁 Setting loading = false');
                setLoading(false);
            }
        });

        debug.log('[useAppLogic] ✅ Auth listener registered');

        return () => {
            debug.log('[useAppLogic] 🧹 Cleanup running');
            unsubAuth();
            if (unsubRecordsRef.current) unsubRecordsRef.current();
            if (unsubRequestsRef.current) unsubRequestsRef.current();
        };
    }, []);

    useEffect(() => {
        if (!activeProperty || records.length === 0) { setDueTasks([]); return; }
        const now = new Date();
        const upcoming = activePropertyRecords.filter(r => {
            if (!r.nextServiceDate) return false;
            const diff = Math.ceil((new Date(r.nextServiceDate) - now) / (86400000));
            return diff <= 30;
        }).map(r => ({ ...r, diffDays: Math.ceil((new Date(r.nextServiceDate) - now) / (86400000)) })).sort((a, b) => a.diffDays - b.diffDays);
        setDueTasks(upcoming);
    }, [records, activeProperty, activePropertyRecords]);

    // =========================================================================
    // FIX: Ensure navigation to Dashboard after initial property setup
    // Uses a ref to only trigger ONCE after setup, not on every Settings visit
    // =========================================================================
    useEffect(() => {
        if (justCompletedSetup.current && profile && activeTab !== 'Dashboard') {
            debug.log('[useAppLogic] Post-setup redirect: navigating to Dashboard');
            setActiveTab('Dashboard');
            justCompletedSetup.current = false;
        }
    }, [profile, activeTab]);

    // =========================================================================
    // NEW: Listen for global unread chat messages
    // =========================================================================
    useEffect(() => {
        if (!user) {
            setUnreadMessageCount(0);
            return;
        }

        // This listener updates the badge number whenever a message comes in
        const unsubscribe = subscribeToGlobalUnreadCount(user.uid, (count) => {
            setUnreadMessageCount(count);
        });

        return () => unsubscribe();
    }, [user]);

    // =========================================================================
    // NEW: Login toast for pending quotes
    // Shows once per session when user logs in and has quotes to review
    // =========================================================================
    useEffect(() => {
        // Only run when loading completes and user is authenticated
        if (loading || !user || !profile) return;

        // Check if we've already shown the toast this session
        const toastShown = sessionStorage.getItem('quotesToastShown') === 'true';
        if (toastShown) return;

        // Check for contractor mode - skip for contractors
        const urlParams = new URLSearchParams(window.location.search);
        const isContractorMode = urlParams.get('pro') !== null || window.location.pathname.includes('/contractor');
        if (isContractorMode) return;

        // Delay the check to let the dashboard load first
        const timeoutId = setTimeout(async () => {
            try {
                // Fetch quotes for this user
                const q = query(
                    collectionGroup(db, 'quotes'),
                    where('customerId', '==', user.uid),
                    orderBy('updatedAt', 'desc')
                );
                const snapshot = await getDocs(q);
                const quotes = snapshot.docs.map(doc => {
                    const data = doc.data();

                    // BUG-047 FIX: Extract contractorId correctly based on document path
                    // Use stored contractorId field if available, otherwise extract from path
                    let contractorId = data.contractorId;

                    if (!contractorId) {
                        const pathSegments = doc.ref.path.split('/');
                        const contractorsIndex = pathSegments.indexOf('contractors');
                        if (contractorsIndex !== -1 && pathSegments[contractorsIndex + 1]) {
                            contractorId = pathSegments[contractorsIndex + 1];
                        }
                    }

                    return {
                        id: doc.id,
                        ...data,
                        contractorId
                    };
                });

                // Filter for actionable quotes (sent or viewed)
                const pendingQuotes = quotes.filter(q => ['sent', 'viewed'].includes(q.status));

                if (pendingQuotes.length > 0) {
                    // Mark toast as shown for this session
                    sessionStorage.setItem('quotesToastShown', 'true');

                    // Show clickable toast
                    toast(
                        (t) => (
                            <div
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    // Navigate to quotes section or first quote
                                    if (pendingQuotes.length === 1) {
                                        const quote = pendingQuotes[0];
                                        window.location.href = `/app/?quote=${quote.contractorId}_${quote.id}`;
                                    } else {
                                        // Navigate to dashboard with quotes visible
                                        setActiveTab('Dashboard');
                                    }
                                }}
                            >
                                <span>
                                    You have <strong>{pendingQuotes.length}</strong> quote{pendingQuotes.length !== 1 ? 's' : ''} waiting for review
                                </span>
                                <span className="text-emerald-600 font-bold text-xs">View</span>
                            </div>
                        ),
                        {
                            icon: '📋',
                            duration: 6000,
                            style: {
                                background: '#fffbeb',
                                border: '1px solid #fcd34d',
                                padding: '12px 16px',
                            }
                        }
                    );
                }
            } catch (err) {
                // Silently fail - this is a nice-to-have notification
                debug.warn('[useAppLogic] Failed to check pending quotes:', err);
            }
        }, 2000); // 2 second delay after dashboard loads

        return () => clearTimeout(timeoutId);
    }, [loading, user, profile, setActiveTab]);

    // =========================================================================
    // EXISTING HANDLERS - All preserved exactly as they were
    // =========================================================================

    const handleAuth = async (email, pass, isSignUp) => isSignUp ? createUserWithEmailAndPassword(auth, email, pass) : signInWithEmailAndPassword(auth, email, pass);

    // =========================================================================
    // FIXED: handleSaveProperty - Now with retry logic for new users
    // =========================================================================

    const handleSaveProperty = async (formData) => {
        // Validate user
        if (!user) {
            debug.error('handleSaveProperty: No authenticated user found');
            toast.error('Authentication error. Please try signing in again.');
            return;
        }

        // Validate appId
        if (!appId) {
            debug.error('handleSaveProperty: appId is missing');
            toast.error('Configuration error. Please refresh the page.');
            return;
        }

        setIsSavingProperty(true);

        // =====================================================
        // HELPER: Remove ALL undefined values from any object
        // Firebase rejects undefined values, so we must clean them
        // =====================================================

        // Helper to sanitize address - now uses shared normalizeAddress utility
        // which handles both string and object addresses properly
        const sanitizeAddress = (addr) => {
            if (!addr) return { street: '', city: '', state: '', zip: '' };
            return normalizeAddress(addr);
        };

        // Retry logic for new user permission issues
        const maxRetries = MAX_RETRY_ATTEMPTS;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Force token refresh before each attempt (especially important for new users)
                if (attempt > 1) {
                    debug.log(`[handleSaveProperty] Attempt ${attempt}: Refreshing auth token...`);
                }
                try {
                    await user.getIdToken(true);
                    // Small delay to let Firestore recognize the token
                    await new Promise(r => setTimeout(r, TOKEN_REFRESH_DELAY_MS));
                } catch (tokenErr) {
                    debug.warn('Token refresh failed:', tokenErr);
                }

                const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);
                const existingProfile = profileSnap.exists() ? profileSnap.data() : {};

                const newPropertyId = Date.now().toString();
                const newProperty = {
                    id: newPropertyId,
                    name: formData.name || 'My Home',
                    address: sanitizeAddress(formData.address),
                    coordinates: formData.coordinates || null
                };

                let existingProperties = existingProfile.properties || [];

                // If no existing properties and we have legacy data, convert it
                if (existingProperties.length === 0 && existingProfile.name) {
                    existingProperties = [{
                        id: 'legacy',
                        name: existingProfile.name || 'My Home',
                        address: sanitizeAddress(existingProfile.address),
                        coordinates: existingProfile.coordinates || null
                    }];
                }

                const updatedProperties = [...existingProperties, newProperty];

                // Build the new profile object (only include defined values from existing)
                const newProfile = {
                    properties: updatedProperties,
                    activePropertyId: newPropertyId,
                    updatedAt: new Date()
                };

                // Preserve specific existing fields if they exist (but not undefined ones)
                if (existingProfile.name) newProfile.name = existingProfile.name;
                if (existingProfile.email) newProfile.email = existingProfile.email;
                if (existingProfile.hasSeenWelcome) newProfile.hasSeenWelcome = existingProfile.hasSeenWelcome;
                if (existingProfile.createdAt) newProfile.createdAt = existingProfile.createdAt;

                // Final safety check: remove any remaining undefined values
                const cleanedProfile = removeUndefined(newProfile);

                debug.log('[handleSaveProperty] Saving cleaned profile:', cleanedProfile);

                // Save to Firebase
                await setDoc(profileRef, cleanedProfile, { merge: true });

                // Update email index for contractor job linking lookups
                // This enables contractors to find homeowners by email when creating jobs
                if (user.email) {
                    try {
                        const { USER_EMAIL_INDEX_PATH } = await import('../config/constants');
                        const normalizedEmail = user.email.toLowerCase().trim();
                        const emailIndexRef = doc(db, USER_EMAIL_INDEX_PATH, normalizedEmail);
                        await setDoc(emailIndexRef, {
                            userId: user.uid,
                            email: normalizedEmail,
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                        debug.log('[handleSaveProperty] Updated email index for:', normalizedEmail);
                    } catch (indexErr) {
                        // Non-critical - log but don't fail the save
                        debug.warn('[handleSaveProperty] Failed to update email index:', indexErr);
                    }
                }

                // SUCCESS! Update local state
                justCompletedSetup.current = true;

                setProfile({
                    ...cleanedProfile,
                    updatedAt: new Date().toISOString()
                });

                setActivePropertyId(newPropertyId);
                setActiveTab('Dashboard');
                toast.success(existingProperties.length === 0 ? "Krib created!" : "Property added!");

                // Exit the retry loop on success
                setIsSavingProperty(false);
                setIsAddingProperty(false);
                return;

            } catch (error) {
                lastError = error;
                debug.error(`handleSaveProperty attempt ${attempt} failed:`, error);

                // Check if it's a permissions error - wait and retry
                const isPermissionError = error.code === 'permission-denied' ||
                    error.message?.includes('permission') ||
                    error.message?.includes('Missing or insufficient');

                if (isPermissionError && attempt < maxRetries) {
                    debug.log(`[handleSaveProperty] Permission denied, retrying in ${1000 * attempt}ms...`);
                    // Wait before retry (exponential backoff)
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                    continue;
                }

                // Non-permission error or max retries reached - break out
                break;
            }
        }

        // All retries failed
        debug.error('handleSaveProperty: All attempts failed:', lastError);
        toast.error("Failed to save: " + (lastError?.message || 'Unknown error'));
        setIsSavingProperty(false);
        setIsAddingProperty(false);
    };

    // =========================================================================
    // handleMarkTaskDone - Supports optional details (cost, photoUrl, notes)
    // Can be called with:
    //   handleMarkTaskDone(task)                    - Quick complete
    //   handleMarkTaskDone(task, 'some notes')      - Legacy: notes string
    //   handleMarkTaskDone(task, { notes, cost, photoUrl }) - Enhanced: full details
    // =========================================================================
    const handleMarkTaskDone = useCallback(async (task, detailsOrNotes = '') => {
        // Normalize input: support both legacy (string) and new (object) formats
        const details = typeof detailsOrNotes === 'string'
            ? { notes: detailsOrNotes }
            : (detailsOrNotes || {});

        debug.log('[DEBUG] handleMarkTaskDone called with:', {
            task,
            recordId: task.recordId,
            taskName: task.taskName,
            isGranular: task.isGranular,
            frequency: task.frequency,
            nextDue: task.nextDue,
            daysUntil: task.daysUntil,
            details
        });

        try {
            if (!task.recordId) { toast.error("Could not update - missing record ID"); return; }
            const record = records.find(r => r.id === task.recordId);
            if (!record) return;

            const recordRef = getRecordDocRef(db, appId, user.uid, task.recordId);

            debug.log('[DEBUG] Found record:', {
                recordId: record.id,
                maintenanceTasks: record.maintenanceTasks,
                taskNamesInRecord: record.maintenanceTasks?.map(t => t.task)
            });

            const completedDate = new Date().toISOString();
            const completedDateShort = completedDate.split('T')[0];

            // Build enhanced history entry with optional cost and photo
            const historyEntry = {
                taskName: task.taskName,
                completedDate: completedDate,
                performedBy: 'User',
                notes: details.notes || '',
                id: Date.now().toString(),
                // NEW: Optional enhanced fields
                ...(details.cost && { cost: details.cost }),
                ...(details.photoUrl && { photoUrl: details.photoUrl }),
                ...(details.contractor && { contractor: details.contractor })
            };
            const currentHistory = record.maintenanceHistory || [];
            const newHistory = [historyEntry, ...currentHistory];

            let updates = { maintenanceHistory: newHistory };

            // Store previous state for undo
            const previousHistory = [...currentHistory];
            let previousTasks = null;
            let previousNextDate = null;
            let previousDateInstalled = null;

            if (task.isGranular) {
                previousTasks = record.maintenanceTasks ? [...record.maintenanceTasks] : null;
                const updatedTasks = (record.maintenanceTasks || []).map(t => {
                    if ((t.task || t.taskName) === task.taskName) {
                        // Use the later of: today or current due date, as the base for next calculation
                        const currentDue = t.nextDue ? new Date(t.nextDue) : new Date();
                        const today = new Date();
                        const baseDate = currentDue < today ? today : currentDue;
                        const newNextDue = calculateNextDate(baseDate.toISOString().split('T')[0], t.frequency);
                        return { ...t, lastCompleted: completedDateShort, nextDue: newNextDue, snoozedUntil: null, scheduledDate: null };
                    }
                    return t;
                });
                updates.maintenanceTasks = updatedTasks;
            } else {
                previousNextDate = record.nextServiceDate;
                previousDateInstalled = record.dateInstalled;
                updates.dateInstalled = completedDateShort;
                updates.nextServiceDate = calculateNextDate(completedDateShort, record.maintenanceFrequency);
                updates.snoozedUntil = null;
                updates.scheduledDate = null;
            }

            await updateDoc(recordRef, updates);

            // Show toast with undo option
            toast(
                (t) => (
                    <div className="flex items-center gap-3">
                        <span>Task completed!</span>
                        <button
                            onClick={async () => {
                                toast.dismiss(t.id);
                                try {
                                    const undoUpdates = { maintenanceHistory: previousHistory };
                                    if (task.isGranular && previousTasks) {
                                        undoUpdates.maintenanceTasks = previousTasks;
                                    } else {
                                        if (previousNextDate !== null) undoUpdates.nextServiceDate = previousNextDate;
                                        if (previousDateInstalled !== null) undoUpdates.dateInstalled = previousDateInstalled;
                                    }
                                    await updateDoc(recordRef, undoUpdates);
                                    toast.success("Undone!", { duration: 2000 });
                                } catch (err) {
                                    toast.error("Couldn't undo: " + err.message);
                                }
                            }}
                            className="font-bold underline hover:no-underline"
                        >
                            Undo
                        </button>
                    </div>
                ),
                { duration: 6000, icon: '🎉' }
            );

            if (celebrations) celebrations.showToast("Maintenance Recorded!", Check);
        } catch (e) { debug.error('[App] handleMarkTaskDone error:', e); toast.error("Failed to update: " + e.message); }
    }, [records, user, celebrations]);

    // =========================================================================
    // handleDeleteHistoryItem - COMPLETE ORIGINAL (takes historyItem object)
    // =========================================================================
    const handleDeleteHistoryItem = useCallback(async (historyItem) => {
        try {
            debug.log('[App] Deleting history item:', historyItem);

            if (!historyItem.recordId) {
                debug.error('[App] Delete failed: History item missing recordId');
                toast.error("Cannot delete: Item missing record ID");
                return;
            }

            const record = records.find(r => r.id === historyItem.recordId);

            if (!record) {
                debug.error(`[App] Delete failed: Record ${historyItem.recordId} not found`);
                toast.error("Could not find the original record. Try refreshing.");
                return;
            }

            const newHistory = (record.maintenanceHistory || []).filter(h => h.id ? h.id !== historyItem.id : !(h.taskName === historyItem.taskName && h.completedDate === historyItem.completedDate));
            await updateDoc(getRecordDocRef(db, appId, user.uid, historyItem.recordId), { maintenanceHistory: newHistory });
            toast.success("History item removed", { icon: '🗑️' });
        } catch (e) { toast.error("Failed to delete: " + e.message); }
    }, [records, user]);

    // =========================================================================
    // handleRestoreHistoryItem - COMPLETE ORIGINAL with task updates
    // =========================================================================
    const handleRestoreHistoryItem = useCallback(async (historyItem) => {
        try {
            debug.log('[App] Restoring history item:', historyItem);

            if (!historyItem.recordId) {
                debug.error('[App] Restore failed: History item missing recordId');
                toast.error("Cannot restore: Item missing record ID");
                return;
            }

            const record = records.find(r => r.id === historyItem.recordId);

            if (!record) {
                debug.error(`[App] Restore failed: Record ${historyItem.recordId} not found`);
                toast.error("Could not find the original record.");
                return;
            }

            const newHistory = (record.maintenanceHistory || []).filter(h => h.id ? h.id !== historyItem.id : !(h.taskName === historyItem.taskName && h.completedDate === historyItem.completedDate));

            let updates = { maintenanceHistory: newHistory };

            // If this was a granular task, restore its next due date
            if (record.maintenanceTasks) {
                const matchingTask = record.maintenanceTasks.find(t => t.task === historyItem.taskName);
                if (matchingTask) {
                    const updatedTasks = record.maintenanceTasks.map(t => {
                        if (t.task === historyItem.taskName) {
                            // Recalculate based on the completion we're removing
                            const previousCompletion = newHistory.find(h => h.taskName === historyItem.taskName);
                            if (previousCompletion) {
                                return { ...t, lastCompleted: previousCompletion.completedDate.split('T')[0], nextDue: calculateNextDate(previousCompletion.completedDate.split('T')[0], t.frequency) };
                            } else {
                                return { ...t, lastCompleted: null, nextDue: calculateNextDate(record.dateInstalled, t.frequency) };
                            }
                        }
                        return t;
                    });
                    updates.maintenanceTasks = updatedTasks;
                }
            }

            await updateDoc(getRecordDocRef(db, appId, user.uid, historyItem.recordId), updates);
            toast.success("Task restored to active", { icon: '↩️' });
        } catch (e) {
            debug.error('[App] Restore error:', e);
            toast.error("Failed to restore: " + e.message);
        }
    }, [records, user]);

    // =========================================================================
    // NEW: Delete a maintenance task - COMPLETE ORIGINAL
    // =========================================================================
    const handleDeleteMaintenanceTask = useCallback(async (task) => {
        try {
            debug.log('[App] Deleting maintenance task:', task);

            if (!task.recordId) {
                debug.error('[App] Delete task failed: Missing recordId');
                toast.error("Cannot delete: Missing record ID");
                return;
            }

            const record = records.find(r => r.id === task.recordId);

            if (!record) {
                debug.error(`[App] Delete task failed: Record ${task.recordId} not found`);
                toast.error("Could not find the record. Try refreshing.");
                return;
            }

            // For granular tasks, remove from maintenanceTasks array
            if (task.isGranular && record.maintenanceTasks) {
                const updatedTasks = record.maintenanceTasks.filter(t => t.task !== task.taskName);

                await updateDoc(
                    getRecordDocRef(db, appId, user.uid, task.recordId),
                    { maintenanceTasks: updatedTasks }
                );

                toast.success(`"${task.taskName}" deleted`, { icon: '🗑️' });
            } else {
                // For non-granular (record-level) tasks, set frequency to 'none'
                await updateDoc(
                    getRecordDocRef(db, appId, user.uid, task.recordId),
                    { maintenanceFrequency: 'none', nextServiceDate: null }
                );

                toast.success("Maintenance schedule removed", { icon: '🗑️' });
            }
        } catch (e) {
            debug.error('[App] handleDeleteMaintenanceTask error:', e);
            toast.error("Failed to delete task: " + e.message);
        }
    }, [records, user]);

    // NEW: Schedule a task with an appointment date - COMPLETE ORIGINAL
    const handleScheduleTask = useCallback(async (task, scheduledDate, notes = '') => {
        try {
            debug.log('[App] Scheduling task:', { task, scheduledDate, notes });

            if (!task.recordId) {
                debug.error('[App] Schedule task failed: Missing recordId');
                toast.error("Cannot schedule: Missing record ID");
                return;
            }

            const record = records.find(r => r.id === task.recordId);

            if (!record) {
                debug.error(`[App] Schedule task failed: Record ${task.recordId} not found`);
                toast.error("Could not find the record. Try refreshing.");
                return;
            }

            // For granular tasks, update the specific task in maintenanceTasks array
            if (task.isGranular && record.maintenanceTasks) {
                const updatedTasks = record.maintenanceTasks.map(t => {
                    if ((t.task || t.taskName) === task.taskName) {
                        return {
                            ...t,
                            scheduledDate: scheduledDate,
                            scheduledNotes: notes || null,
                            // Clear any snooze when scheduling
                            snoozedUntil: null
                        };
                    }
                    return t;
                });

                await updateDoc(
                    getRecordDocRef(db, appId, user.uid, task.recordId),
                    { maintenanceTasks: updatedTasks }
                );
            } else {
                // For non-granular tasks, store at record level
                await updateDoc(
                    getRecordDocRef(db, appId, user.uid, task.recordId),
                    {
                        scheduledDate: scheduledDate,
                        scheduledNotes: notes || null,
                        snoozedUntil: null
                    }
                );
            }

            const formattedDate = new Date(scheduledDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
            });

            toast.success(`Scheduled for ${formattedDate}`, { icon: '📅' });
        } catch (e) {
            debug.error('[App] handleScheduleTask error:', e);
            toast.error("Failed to schedule: " + e.message);
        }
    }, [records, user]);

    // NEW: Snooze a task by pushing its due date forward - COMPLETE ORIGINAL
    const handleSnoozeTask = useCallback(async (task, days) => {
        try {
            debug.log('[App] Snoozing task:', { task, days });

            if (!task.recordId) {
                debug.error('[App] Snooze task failed: Missing recordId');
                toast.error("Cannot snooze: Missing record ID");
                return;
            }

            const record = records.find(r => r.id === task.recordId);

            if (!record) {
                debug.error(`[App] Snooze task failed: Record ${task.recordId} not found`);
                toast.error("Could not find the record. Try refreshing.");
                return;
            }

            // Calculate new due date
            const currentDue = task.nextDate ? new Date(task.nextDate) : new Date();
            const today = new Date();
            const baseDate = currentDue < today ? today : currentDue;
            baseDate.setDate(baseDate.getDate() + days);
            const newDueDate = baseDate.toISOString().split('T')[0];

            // For granular tasks, update the specific task in maintenanceTasks array
            if (task.isGranular && record.maintenanceTasks) {
                const updatedTasks = record.maintenanceTasks.map(t => {
                    if ((t.task || t.taskName) === task.taskName) {
                        return {
                            ...t,
                            nextDue: newDueDate,
                            snoozedUntil: newDueDate,
                            // Clear any scheduled date when snoozing
                            scheduledDate: null,
                            scheduledNotes: null
                        };
                    }
                    return t;
                });

                await updateDoc(
                    getRecordDocRef(db, appId, user.uid, task.recordId),
                    { maintenanceTasks: updatedTasks }
                );
            } else {
                // For non-granular tasks, update at record level
                await updateDoc(
                    getRecordDocRef(db, appId, user.uid, task.recordId),
                    {
                        nextServiceDate: newDueDate,
                        snoozedUntil: newDueDate,
                        scheduledDate: null,
                        scheduledNotes: null
                    }
                );
            }

            const label = days === 7 ? '1 week' : days === 14 ? '2 weeks' : days === 30 ? '1 month' : `${days} days`;
            toast.success(`Snoozed for ${label}`, { icon: '⏰' });
        } catch (e) {
            debug.error('[App] handleSnoozeTask error:', e);
            toast.error("Failed to snooze: " + e.message);
        }
    }, [records, user]);

    // =========================================================================
    // NEW HANDLERS - For notification dismiss/clear functionality
    // =========================================================================

    // Dismiss a single notification (hides it without completing)
    const handleDismissNotification = useCallback((id, type) => {
        setDismissedNotifications(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    // Clear all notifications (dismisses all visible notifications)
    const handleClearAllNotifications = useCallback(() => {
        const allIds = new Set();

        // Add all task IDs
        dueTasks.forEach(task => {
            const taskId = task.id || `${task.recordId}-${task.taskName}`;
            allIds.add(taskId);
        });

        // Add all submission IDs
        newSubmissions.forEach(sub => {
            if (sub.id) allIds.add(sub.id);
        });

        setDismissedNotifications(allIds);
        toast.success('All notifications cleared', { icon: '✓', duration: 2000 });
    }, [dueTasks, newSubmissions]);

    // Reset dismissed notifications (call this when data refreshes if desired)
    const resetDismissedNotifications = useCallback(() => {
        setDismissedNotifications(new Set());
    }, []);

    // =========================================================================
    // RETURN - All existing values + new notification handlers
    // =========================================================================
    return {
        // All existing state
        user, profile, records, loading, activeTab, setActiveTab,
        isAddModalOpen, setIsAddModalOpen, showNotifications, setShowNotifications,
        showUserMenu, setShowUserMenu, showMoreMenu, setShowMoreMenu,
        dueTasks, newSubmissions, activePropertyId, setActivePropertyId,
        isSwitchingProp, setIsSwitchingProp, isAddingProperty, setIsAddingProperty,
        editingRecord, setEditingRecord, searchTerm, setSearchTerm,
        filterCategory, setFilterCategory, isSavingProperty, hasSeenWelcome, setHasSeenWelcome,
        isSelectionMode, setIsSelectionMode, selectedRecords, setSelectedRecords,
        quickServiceRecord, setQuickServiceRecord, quickServiceDescription, setQuickServiceDescription,
        showQuickService, setShowQuickService, showGuidedOnboarding, setShowGuidedOnboarding,
        showScanner, setShowScanner, useEnhancedCards, setUseEnhancedCards, inventoryView, setInventoryView,
        properties, activeProperty, activePropertyRecords,

        // All existing handlers
        handleAuth, handleSaveProperty, handleMarkTaskDone,
        handleDeleteHistoryItem,
        handleRestoreHistoryItem,

        // Existing task action handlers
        handleDeleteMaintenanceTask,
        handleScheduleTask,
        handleSnoozeTask,

        // NEW: Notification management handlers
        dismissedNotifications,
        setDismissedNotifications,
        highlightedTaskId,
        setHighlightedTaskId,
        handleDismissNotification,
        handleClearAllNotifications,
        resetDismissedNotifications,
        unreadMessageCount, // <--- NEW EXPORT
    };
};
