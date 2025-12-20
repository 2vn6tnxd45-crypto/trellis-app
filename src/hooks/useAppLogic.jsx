// src/hooks/useAppLogic.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, serverTimestamp, orderBy, where } from 'firebase/firestore'; 
import toast from 'react-hot-toast';
import { auth, db } from '../config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, MAINTENANCE_FREQUENCIES } from '../config/constants';
import { calculateNextDate } from '../lib/utils';
import { Check, RotateCcw } from 'lucide-react';

export const useAppLogic = (celebrations) => {
    // State
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

    // Derived State (Memoized to prevent effect loops)
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

    // Effects
    useEffect(() => {
        let unsubRecords = null;
        let unsubRequests = null;
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            try {
                setUser(currentUser);
                if (currentUser) {
                    if (!appId) throw new Error("appId is missing");
                    const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        setProfile(data);
                        if (data.hasSeenWelcome) setHasSeenWelcome(true);
                        setActivePropertyId(data.activePropertyId || (data.properties?.[0]?.id || 'legacy'));
                    } else setProfile(null);
                    
                    if (unsubRecords) unsubRecords();
                    const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'), orderBy('dateInstalled', 'desc'));
                    unsubRecords = onSnapshot(q, (snap) => setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error(e));

                    if (unsubRequests) unsubRequests();
                    const qReq = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", currentUser.uid)); 
                    unsubRequests = onSnapshot(qReq, (snap) => setNewSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'submitted')), (e) => console.error(e));
                } else {
                    setProfile(null); setRecords([]); setNewSubmissions([]);
                }
            } catch (error) { console.error(error); toast.error("Error: " + error.message); } finally { setLoading(false); }
        });
        return () => { unsubAuth(); if (unsubRecords) unsubRecords(); if (unsubRequests) unsubRequests(); };
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

    // Actions
    const handleAuth = async (email, pass, isSignUp) => isSignUp ? createUserWithEmailAndPassword(auth, email, pass) : signInWithEmailAndPassword(auth, email, pass);
    
    const handleSaveProperty = async (formData) => {
        if (!user) return;
        setIsSavingProperty(true);
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            await setDoc(profileRef, { name: formData.name, address: formData.address, coordinates: formData.coordinates || null, activePropertyId: 'legacy', createdAt: serverTimestamp() }, { merge: true });
            const snap = await getDoc(profileRef); if (snap.exists()) setProfile(snap.data()); toast.success("Krib created!");
        } catch (error) { toast.error("Failed: " + error.message); } finally { setIsSavingProperty(false); setIsAddingProperty(false); }
    }; 

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
            if (task.isGranular) {
    const updatedTasks = (record.maintenanceTasks || []).map(t => {
        if (t.task === task.taskName) {
            // Use the later of: today or current due date, as the base for next calculation
            const currentDue = t.nextDue ? new Date(t.nextDue) : new Date();
            const today = new Date(completedDateShort);
            const baseDate = currentDue > today ? t.nextDue : completedDateShort;
            return { ...t, nextDue: calculateNextDate(baseDate, t.frequency || 'annual') };
        }
        return t;
    });
    updates.maintenanceTasks = updatedTasks;
} else {
                updates.dateInstalled = completedDateShort; 
                const nextDate = calculateNextDate(completedDateShort, record.maintenanceFrequency || 'annual');
                if (nextDate) updates.nextServiceDate = nextDate;
            }
        console.log('[DEBUG] About to update with:', updates);
            await updateDoc(recordRef, updates);

// Calculate what the next date will be for the toast message
const nextDateStr = task.isGranular 
    ? calculateNextDate(completedDateShort, task.frequency || 'annual')
    : calculateNextDate(completedDateShort, record.maintenanceFrequency || 'annual');

const formattedNextDate = nextDateStr 
    ? new Date(nextDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'next cycle';

// Store previous state for undo
const previousState = {
    maintenanceHistory: currentHistory,
    maintenanceTasks: record.maintenanceTasks || [],
    dateInstalled: record.dateInstalled,
    nextServiceDate: record.nextServiceDate
};

// Show toast with undo option
toast.success(
    (t) => (
        <div className="flex items-center gap-3">
            <span>Done! Next: {formattedNextDate}</span>
            <button
                onClick={async () => {
                    toast.dismiss(t.id);
                    try {
                        await updateDoc(recordRef, previousState);
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

    // NEW FUNCTION: Handles permanent deletion of history items
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

    // NEW FUNCTION: Handles restoring history items to active tasks
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
            const taskIndex = (record.maintenanceTasks || []).findIndex(t => t.task === historyItem.taskName);
            
            if (taskIndex >= 0) {
                 const updatedTasks = [...record.maintenanceTasks];
                 updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], nextDue: new Date().toISOString().split('T')[0] };
                 updates.maintenanceTasks = updatedTasks;
            } else if (record.maintenanceFrequency && record.maintenanceFrequency !== 'none') {
                const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
                if (freq && freq.months) {
                     const currentLastDate = new Date(record.dateInstalled);
                     currentLastDate.setMonth(currentLastDate.getMonth() - freq.months);
                     currentLastDate.setDate(currentLastDate.getDate() + 1);
                     const newLastDateStr = currentLastDate.toISOString().split('T')[0];
                     updates.dateInstalled = newLastDateStr;
                     const nextDate = calculateNextDate(newLastDateStr, record.maintenanceFrequency);
                     if (nextDate) updates.nextServiceDate = nextDate;
                }
            }
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', record.id), updates);
            toast.success("Task restored to dashboard", { icon: <RotateCcw size={18}/> });
        } catch (e) { toast.error("Failed to restore: " + e.message); }
    }, [records, user]);

    // IMPORTANT: THESE FUNCTIONS MUST BE IN THE RETURN OBJECT
    return {
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
        handleAuth, handleSaveProperty, handleMarkTaskDone, 
        handleDeleteHistoryItem, // ENSURE THIS IS HERE
        handleRestoreHistoryItem // ENSURE THIS IS HERE
    };
};
