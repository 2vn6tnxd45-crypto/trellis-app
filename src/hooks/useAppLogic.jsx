// src/hooks/useAppLogic.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, serverTimestamp, orderBy, where } from 'firebase/firestore'; 
import toast from 'react-hot-toast';
import { auth, db } from '../config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, MAINTENANCE_FREQUENCIES } from '../config/constants';
import { calculateNextDate } from '../lib/utils';
import { Check, RotateCcw } from 'lucide-react';

const withTimeout = (promise, ms, operation = 'Operation') => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${operation} timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
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
    
    // =========================================================================
    // REF - Track if we just completed property setup (for navigation fix)
    // =========================================================================
    const justCompletedSetup = useRef(false);

    // =========================================================================
    // DERIVED STATE - All existing derived state preserved exactly
    // =========================================================================
    const getPropertiesList = () => {
        if (!profile) return [];
        if (profile.properties && Array.isArray(profile.properties)) return profile.properties;
        if (profile.name) return [{ id: 'legacy', name: profile.name, address: profile.address, coordinates: profile.coordinates }];
        return [];
    };
    const properties = getPropertiesList();
    const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0] || null;
    
    // MEMOIZED: This fixes the linting "missing dependency" error
    const activePropertyRecords = useMemo(() => {
        return records.filter(r => r.propertyId === activeProperty?.id || (!r.propertyId && activeProperty?.id === 'legacy'));
    }, [records, activeProperty]);

    // =========================================================================
    // EFFECTS - With retry logic for new user permission issues
    // =========================================================================
    // ============================================================================
// DIAGNOSTIC PATCH FOR useAppLogic.jsx
// ============================================================================
// Add these console.log statements to trace exactly where the hang occurs.
// Replace your existing auth useEffect with this version.
// ============================================================================

useEffect(() => {
    console.log('[useAppLogic] 🚀 Effect starting, setting up auth listener...');
    
    let unsubRecords = null;
    let unsubRequests = null;
    
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
        console.log('[useAppLogic] 🔥 onAuthStateChanged fired!', { 
            hasUser: !!currentUser, 
            email: currentUser?.email 
        });
        
        try {
            setUser(currentUser);
            console.log('[useAppLogic] ✅ setUser complete');
            
            if (currentUser) {
                console.log('[useAppLogic] 👤 User exists, starting token refresh...');
                
                // Token refresh
                try {
                    console.log('[useAppLogic] ⏳ Calling getIdToken(true)...');
                    const startTime = Date.now();
                    await currentUser.getIdToken(true);
                    console.log('[useAppLogic] ✅ getIdToken complete in', Date.now() - startTime, 'ms');
                    
                    console.log('[useAppLogic] ⏳ Waiting 300ms for token propagation...');
                    await new Promise(r => setTimeout(r, 300));
                    console.log('[useAppLogic] ✅ Token propagation wait complete');
                } catch (tokenErr) {
                    console.warn('[useAppLogic] ⚠️ Token refresh failed:', tokenErr);
                }
                
                if (!appId) {
                    console.error('[useAppLogic] ❌ appId is missing!');
                    throw new Error("appId is missing");
                }
                console.log('[useAppLogic] ✅ appId check passed:', appId);
                
                // Profile read
                const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                console.log('[useAppLogic] 📖 Starting profile read...', profileRef.path);
                
                let profileSnap = null;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`[useAppLogic] ⏳ getDoc attempt ${attempt}...`);
                        const startTime = Date.now();
                        profileSnap = await withTimeout(
    getDoc(profileRef),
    5000,  // 5 second timeout
    `getDoc attempt ${attempt}`
);
                        console.log(`[useAppLogic] ✅ getDoc complete in ${Date.now() - startTime}ms, exists:`, profileSnap.exists());
                        break;
                    } catch (readError) {
                        console.error(`[useAppLogic] ❌ getDoc attempt ${attempt} failed:`, readError);
                        const isPermissionError = readError.code === 'permission-denied' || 
                                                  readError.message?.includes('permission');
                        if (isPermissionError && attempt < 3) {
                            console.log(`[useAppLogic] 🔄 Retrying after permission error...`);
                            await currentUser.getIdToken(true);
                            await new Promise(r => setTimeout(r, 500 * attempt));
                        } else if (!isPermissionError) {
                            throw readError;
                        }
                    }
                }
                
                if (profileSnap?.exists()) {
                    const data = profileSnap.data();
                    console.log('[useAppLogic] ✅ Profile loaded:', { 
                        hasProperties: !!data.properties,
                        propertyCount: data.properties?.length 
                    });
                    setProfile(data);
                    if (data.hasSeenWelcome) setHasSeenWelcome(true);
                    setActivePropertyId(data.activePropertyId || (data.properties?.[0]?.id || 'legacy'));
                } else {
                    console.log('[useAppLogic] ℹ️ No profile found (new user)');
                    setProfile(null);
                }
                
                // Set up listeners
                console.log('[useAppLogic] 📡 Setting up realtime listeners...');
                if (unsubRecords) unsubRecords();
                const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'), orderBy('dateInstalled', 'desc'));
                unsubRecords = onSnapshot(q, (snap) => {
                    console.log('[useAppLogic] 📦 Records snapshot:', snap.docs.length, 'records');
                    setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                }, (e) => console.error('[useAppLogic] ❌ Records error:', e));

                if (unsubRequests) unsubRequests();
                const qReq = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", currentUser.uid)); 
                unsubRequests = onSnapshot(qReq, (snap) => {
                    console.log('[useAppLogic] 📋 Requests snapshot:', snap.docs.length, 'requests');
                    setNewSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'submitted'));
                }, (e) => console.error('[useAppLogic] ❌ Requests error:', e));
                
                console.log('[useAppLogic] ✅ All listeners set up');
            } else {
                console.log('[useAppLogic] 👻 No user, clearing state');
                setProfile(null); 
                setRecords([]); 
                setNewSubmissions([]);
            }
        } catch (error) { 
            console.error('[useAppLogic] ❌ Auth state change error:', error);
            const isPermissionError = error.code === 'permission-denied' || 
                                      error.message?.includes('permission') ||
                                      error.message?.includes('Missing or insufficient');
            if (!isPermissionError) {
                toast.error("Error: " + error.message);
            }
        } finally { 
            console.log('[useAppLogic] 🏁 Setting loading = false');
            setLoading(false); 
        }
    });
    
    console.log('[useAppLogic] ✅ Auth listener registered');
    
    return () => { 
        console.log('[useAppLogic] 🧹 Cleanup running');
        unsubAuth(); 
        if (unsubRecords) unsubRecords(); 
        if (unsubRequests) unsubRequests(); 
    };
}, []);

    useEffect(() => {
        if (!activeProperty || records.length === 0) { setDueTasks([]); return; }
        const now = new Date();
        const upcoming = activePropertyRecords.filter(r => {
            if (!r.nextServiceDate) return false;
            const diff = Math.ceil((new Date(r.nextServiceDate) - now) / (86400000));
            return diff <= 30;
        }).map(r => ({ ...r, diffDays: Math.ceil((new Date(r.nextServiceDate) - now) / (86400000)) })).sort((a,b) => a.diffDays - b.diffDays);
        setDueTasks(upcoming);
    }, [records, activeProperty, activePropertyRecords]);

    // =========================================================================
    // FIX: Ensure navigation to Dashboard after initial property setup
    // Uses a ref to only trigger ONCE after setup, not on every Settings visit
    // =========================================================================
    useEffect(() => {
        if (justCompletedSetup.current && profile && activeTab !== 'Dashboard') {
            console.log('[useAppLogic] Post-setup redirect: navigating to Dashboard');
            setActiveTab('Dashboard');
            justCompletedSetup.current = false;
        }
    }, [profile, activeTab]);

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
            console.error('handleSaveProperty: No authenticated user found');
            toast.error('Authentication error. Please try signing in again.');
            return;
        }
        
        // Validate appId
        if (!appId) {
            console.error('handleSaveProperty: appId is missing');
            toast.error('Configuration error. Please refresh the page.');
            return;
        }

        setIsSavingProperty(true);
        
        // Retry logic for new user permission issues
        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Force token refresh before each attempt (especially important for new users)
                if (attempt > 1) {
                    console.log(`[handleSaveProperty] Attempt ${attempt}: Refreshing auth token...`);
                }
                try {
                    await user.getIdToken(true);
                    // Small delay to let Firestore recognize the token
                    await new Promise(r => setTimeout(r, 500));
                } catch (tokenErr) {
                    console.warn('Token refresh failed:', tokenErr);
                }
                
                const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);
                const existingProfile = profileSnap.exists() ? profileSnap.data() : {};
                
                const newPropertyId = Date.now().toString();
                const newProperty = {
                    id: newPropertyId,
                    name: formData.name,
                    address: formData.address,
                    coordinates: formData.coordinates || null
                };
                
                const existingProperties = existingProfile.properties || [];
                
                // If no existing properties and we have legacy data, convert it
                if (existingProperties.length === 0 && existingProfile.name) {
                    existingProperties.push({
                        id: 'legacy',
                        name: existingProfile.name,
                        address: existingProfile.address,
                        coordinates: existingProfile.coordinates
                    });
                }
                
                const updatedProperties = [...existingProperties, newProperty];
                
                // Build the new profile object
                const newProfile = {
                    ...existingProfile,
                    properties: updatedProperties,
                    activePropertyId: newPropertyId,
                };
                
                // Save to Firebase
                await setDoc(profileRef, {
                    ...newProfile,
                    updatedAt: new Date()
                }, { merge: true });
                
                // SUCCESS! Update local state
                justCompletedSetup.current = true;
                
                setProfile({
                    ...newProfile,
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
                console.error(`handleSaveProperty attempt ${attempt} failed:`, error);
                
                // Check if it's a permissions error - wait and retry
                const isPermissionError = error.code === 'permission-denied' || 
                                          error.message?.includes('permission') ||
                                          error.message?.includes('Missing or insufficient');
                
                if (isPermissionError && attempt < maxRetries) {
                    console.log(`[handleSaveProperty] Permission denied, retrying in ${1000 * attempt}ms...`);
                    // Wait before retry (exponential backoff)
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                    continue;
                }
                
                // Non-permission error or max retries reached - break out
                break;
            }
        }
        
        // All retries failed
        console.error('handleSaveProperty: All attempts failed:', lastError);
        toast.error("Failed to save: " + (lastError?.message || 'Unknown error'));
        setIsSavingProperty(false);
        setIsAddingProperty(false);
    };

    // =========================================================================
    // handleMarkTaskDone - COMPLETE ORIGINAL with Undo toast and celebrations
    // =========================================================================
    const handleMarkTaskDone = useCallback(async (task, notes = '') => {
        // DIAGNOSTIC: Remove after debugging
        console.log('[DEBUG] handleMarkTaskDone called with:', {
            task,
            recordId: task.recordId,
            taskName: task.taskName,
            isGranular: task.isGranular,
            frequency: task.frequency,
            nextDue: task.nextDue,
            daysUntil: task.daysUntil
        });
        
        try {
            if (!task.recordId) { toast.error("Could not update - missing record ID"); return; }
            const recordRef = doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId);
            const record = records.find(r => r.id === task.recordId);
            if (!record) return;
            
            // ADD THIS NEW DEBUG BLOCK:
            console.log('[DEBUG] Found record:', {
                recordId: record.id,
                maintenanceTasks: record.maintenanceTasks,
                taskNamesInRecord: record.maintenanceTasks?.map(t => t.task)
            });
                
            const completedDate = new Date().toISOString();
            const completedDateShort = completedDate.split('T')[0];
            const historyEntry = { taskName: task.taskName, completedDate: completedDate, performedBy: 'User', notes: notes, id: Date.now().toString() };
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
                    if (t.task === task.taskName) {
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
        } catch (e) { console.error('[App] handleMarkTaskDone error:', e); toast.error("Failed to update: " + e.message); }
    }, [records, user, celebrations]);

    // =========================================================================
    // handleDeleteHistoryItem - COMPLETE ORIGINAL (takes historyItem object)
    // =========================================================================
    const handleDeleteHistoryItem = useCallback(async (historyItem) => {
        try {
            console.log('[App] Deleting history item:', historyItem);
            
            if (!historyItem.recordId) {
                console.error('[App] Delete failed: History item missing recordId');
                toast.error("Cannot delete: Item missing record ID");
                return;
            }

            const record = records.find(r => r.id === historyItem.recordId);
            
            if (!record) {
                console.error(`[App] Delete failed: Record ${historyItem.recordId} not found`);
                toast.error("Could not find the original record. Try refreshing.");
                return;
            }

            const newHistory = (record.maintenanceHistory || []).filter(h => h.id ? h.id !== historyItem.id : !(h.taskName === historyItem.taskName && h.completedDate === historyItem.completedDate));
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', historyItem.recordId), { maintenanceHistory: newHistory });
            toast.success("History item removed", { icon: '🗑️' });
        } catch (e) { toast.error("Failed to delete: " + e.message); }
    }, [records, user]);

    // =========================================================================
    // handleRestoreHistoryItem - COMPLETE ORIGINAL with task updates
    // =========================================================================
    const handleRestoreHistoryItem = useCallback(async (historyItem) => {
        try {
            console.log('[App] Restoring history item:', historyItem);

            if (!historyItem.recordId) {
                console.error('[App] Restore failed: History item missing recordId');
                toast.error("Cannot restore: Item missing record ID");
                return;
            }

            const record = records.find(r => r.id === historyItem.recordId);
            
            if (!record) {
                console.error(`[App] Restore failed: Record ${historyItem.recordId} not found`);
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
            
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', historyItem.recordId), updates);
            toast.success("Task restored to active", { icon: '↩️' });
        } catch (e) { 
            console.error('[App] Restore error:', e);
            toast.error("Failed to restore: " + e.message); 
        }
    }, [records, user]);

    // =========================================================================
    // NEW: Delete a maintenance task - COMPLETE ORIGINAL
    // =========================================================================
    const handleDeleteMaintenanceTask = useCallback(async (task) => {
        try {
            console.log('[App] Deleting maintenance task:', task);
            
            if (!task.recordId) {
                console.error('[App] Delete task failed: Missing recordId');
                toast.error("Cannot delete: Missing record ID");
                return;
            }

            const record = records.find(r => r.id === task.recordId);
            
            if (!record) {
                console.error(`[App] Delete task failed: Record ${task.recordId} not found`);
                toast.error("Could not find the record. Try refreshing.");
                return;
            }

            // For granular tasks, remove from maintenanceTasks array
            if (task.isGranular && record.maintenanceTasks) {
                const updatedTasks = record.maintenanceTasks.filter(t => t.task !== task.taskName);
                
                await updateDoc(
                    doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId), 
                    { maintenanceTasks: updatedTasks }
                );
                
                toast.success(`"${task.taskName}" deleted`, { icon: '🗑️' });
            } else {
                // For non-granular (record-level) tasks, set frequency to 'none'
                await updateDoc(
                    doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId), 
                    { maintenanceFrequency: 'none', nextServiceDate: null }
                );
                
                toast.success("Maintenance schedule removed", { icon: '🗑️' });
            }
        } catch (e) {
            console.error('[App] handleDeleteMaintenanceTask error:', e);
            toast.error("Failed to delete task: " + e.message);
        }
    }, [records, user]);

    // NEW: Schedule a task with an appointment date - COMPLETE ORIGINAL
    const handleScheduleTask = useCallback(async (task, scheduledDate, notes = '') => {
        try {
            console.log('[App] Scheduling task:', { task, scheduledDate, notes });
            
            if (!task.recordId) {
                console.error('[App] Schedule task failed: Missing recordId');
                toast.error("Cannot schedule: Missing record ID");
                return;
            }

            const record = records.find(r => r.id === task.recordId);
            
            if (!record) {
                console.error(`[App] Schedule task failed: Record ${task.recordId} not found`);
                toast.error("Could not find the record. Try refreshing.");
                return;
            }

            // For granular tasks, update the specific task in maintenanceTasks array
            if (task.isGranular && record.maintenanceTasks) {
                const updatedTasks = record.maintenanceTasks.map(t => {
                    if (t.task === task.taskName) {
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
                    doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId), 
                    { maintenanceTasks: updatedTasks }
                );
            } else {
                // For non-granular tasks, store at record level
                await updateDoc(
                    doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId), 
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
            console.error('[App] handleScheduleTask error:', e);
            toast.error("Failed to schedule: " + e.message);
        }
    }, [records, user]);

    // NEW: Snooze a task by pushing its due date forward - COMPLETE ORIGINAL
    const handleSnoozeTask = useCallback(async (task, days) => {
        try {
            console.log('[App] Snoozing task:', { task, days });
            
            if (!task.recordId) {
                console.error('[App] Snooze task failed: Missing recordId');
                toast.error("Cannot snooze: Missing record ID");
                return;
            }

            const record = records.find(r => r.id === task.recordId);
            
            if (!record) {
                console.error(`[App] Snooze task failed: Record ${task.recordId} not found`);
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
                    if (t.task === task.taskName) {
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
                    doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId), 
                    { maintenanceTasks: updatedTasks }
                );
            } else {
                // For non-granular tasks, update at record level
                await updateDoc(
                    doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId), 
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
            console.error('[App] handleSnoozeTask error:', e);
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
    };
};
