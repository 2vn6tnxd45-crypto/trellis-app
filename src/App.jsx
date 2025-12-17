// src/App.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously, deleteUser } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch, limit, orderBy, where } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LogOut, Camera, Search, Filter, XCircle, Plus, X, Bell, ChevronDown, PlusCircle, Check, LayoutDashboard, Package, MapPin, Trash2, Menu, CheckSquare, DoorOpen, ArrowLeft } from 'lucide-react'; 
import toast, { Toaster } from 'react-hot-toast';

import { auth, db, storage } from './config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, CATEGORIES } from './config/constants';
import { calculateNextDate } from './lib/utils';
import { compressImage, fileToBase64 } from './lib/images';
import { generatePDFThumbnail } from './lib/pdfUtils';

// Feature Imports
import { useGemini } from './hooks/useGemini';
import { ProgressiveDashboard } from './features/dashboard/ProgressiveDashboard';
import { MaintenanceDashboard } from './features/dashboard/MaintenanceDashboard'; 
import { SmartScanner } from './features/scanner/SmartScanner';
import { CelebrationRenderer, useCelebrations } from './features/celebrations/CelebrationMoments';
import './styles/krib-theme.css'; 

// Component Imports
import { Logo } from './components/common/Logo';
import { FeatureErrorBoundary } from './components/common/FeatureErrorBoundary';
import { EmptyState } from './components/common/EmptyState';
import { AppShellSkeleton } from './components/common/Skeletons';
import { BottomNav, MoreMenu } from './components/navigation/BottomNav';
import { AuthScreen } from './features/auth/AuthScreen';
import { SetupPropertyForm } from './features/onboarding/SetupPropertyForm';
import { WelcomeScreen } from './features/onboarding/WelcomeScreen';
import { GuidedOnboarding } from './features/onboarding/GuidedOnboarding';
import { EnhancedRecordCard } from './features/records/EnhancedRecordCard';
import { RecordCard } from './features/records/RecordCard';
import { AddRecordForm } from './features/records/AddRecordForm';
import { PedigreeReport } from './features/report/PedigreeReport';
import { ProConnect } from './features/requests/ProConnect';
import { ContractorPortal } from './features/requests/ContractorPortal';
import { QuickServiceRequest } from './features/requests/QuickServiceRequest';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() { if (this.state.hasError) return <div className="p-10 text-red-600"><h2 className="font-bold">Something went wrong.</h2><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-200 rounded">Reload</button></div>; return this.props.children; }
}

const AppContent = () => {
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
    const [recordsLimit, setRecordsLimit] = useState(50);
    const [editingRecord, setEditingRecord] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [isSavingProperty, setIsSavingProperty] = useState(false);
    const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState(new Set());
    
    // Quick Service State
    const [quickServiceRecord, setQuickServiceRecord] = useState(null);
    const [quickServiceDescription, setQuickServiceDescription] = useState(''); 
    const [showQuickService, setShowQuickService] = useState(false);
    
    const [showGuidedOnboarding, setShowGuidedOnboarding] = useState(false);
    
    // Scanner & Celebration
    const [showScanner, setShowScanner] = useState(false);
    const [lastAddedItem, setLastAddedItem] = useState(null);
    const celebrations = useCelebrations();
    const { scanReceipt } = useGemini();

    const [useEnhancedCards, setUseEnhancedCards] = useState(true);
    const [inventoryView, setInventoryView] = useState('category'); 

    const getPropertiesList = () => {
        if (!profile) return [];
        if (profile.properties && Array.isArray(profile.properties)) return profile.properties;
        if (profile.name) return [{ id: 'legacy', name: profile.name, address: profile.address, coordinates: profile.coordinates }];
        return [];
    };
    const properties = getPropertiesList();
    const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0] || null;
    const activePropertyRecords = records.filter(r => r.propertyId === activeProperty?.id || (!r.propertyId && activeProperty?.id === 'legacy'));

    // ENHANCED: Build contractors list with contact info from records
    const contractorsList = useMemo(() => {
        return Object.values(activePropertyRecords.reduce((acc, r) => {
            if (r.contractor && r.contractor.length > 2) {
                const key = r.contractor.toLowerCase().trim();
                if (!acc[key]) {
                    acc[key] = { 
                        name: r.contractor, 
                        id: r.contractor,
                        phone: r.contractorPhone || '',
                        email: r.contractorEmail || '',
                        jobs: []
                    };
                }
                if (r.contractorPhone && !acc[key].phone) acc[key].phone = r.contractorPhone;
                if (r.contractorEmail && !acc[key].email) acc[key].email = r.contractorEmail;
                acc[key].jobs.push(r);
            }
            return acc;
        }, {}));
    }, [activePropertyRecords]);

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
                    const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'), orderBy('dateInstalled', 'desc'), limit(recordsLimit));
                    unsubRecords = onSnapshot(q, (snap) => setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error(e));

                    if (unsubRequests) unsubRequests();
                    const qReq = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", currentUser.uid)); 
                    unsubRequests = onSnapshot(qReq, (snap) => setNewSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'submitted')), (e) => console.error(e));
                } else {
                    setProfile(null); setRecords([]); setNewSubmissions([]);
                    if (unsubRecords) unsubRecords(); if (unsubRequests) unsubRequests();
                }
            } catch (error) { console.error(error); toast.error("Error: " + error.message); } finally { setLoading(false); }
        });
        return () => { unsubAuth(); if (unsubRecords) unsubRecords(); if (unsubRequests) unsubRequests(); };
    }, [recordsLimit]);

    useEffect(() => {
        if (!activeProperty || records.length === 0) { setDueTasks([]); return; }
        const now = new Date();
        const upcoming = activePropertyRecords.filter(r => {
            if (!r.nextServiceDate) return false;
            const diff = Math.ceil((new Date(r.nextServiceDate) - now) / (86400000));
            return diff <= 30;
        }).map(r => ({ ...r, diffDays: Math.ceil((new Date(r.nextServiceDate) - now) / (86400000)) })).sort((a,b) => a.diffDays - b.diffDays);
        setDueTasks(upcoming);
    }, [records, activeProperty]);

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

    const handleSwitchProperty = (propId) => { setActivePropertyId(propId); setIsSwitchingProp(false); toast.success("Switched property"); };
    const toggleRecordSelection = (id) => { const newSet = new Set(selectedRecords); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedRecords(newSet); };
    const handleBatchDelete = async () => { if (selectedRecords.size === 0) return; if (!confirm("Delete items?")) return; const batch = writeBatch(db); selectedRecords.forEach(id => batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', id))); try { await batch.commit(); toast.success("Deleted"); setSelectedRecords(new Set()); setIsSelectionMode(false); } catch (e) { toast.error("Failed"); } };
    const handleDeleteRecord = async (id) => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', id));
    const handleRequestImport = (req) => { setEditingRecord({...req, id: null, originalRequestId: req.id}); setIsAddModalOpen(true); };
    const openAddModal = (rec = null) => { setEditingRecord(rec); setIsAddModalOpen(true); };
    const closeAddModal = () => { setIsAddModalOpen(false); setEditingRecord(null); };
    const handleDismissWelcome = async () => { setHasSeenWelcome(true); if (user) updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { hasSeenWelcome: true }); };
    
    const handleOpenQuickService = (record) => { setQuickServiceRecord(record); setQuickServiceDescription(''); setShowQuickService(true); };
    const handleCloseQuickService = () => { setShowQuickService(false); setQuickServiceRecord(null); setQuickServiceDescription(''); };
    
    const handleGuidedOnboardingAddItem = async (item) => addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...item, userId: user.uid, propertyId: activeProperty?.id || 'legacy', propertyLocation: activeProperty?.name, timestamp: serverTimestamp() });
    const handleGuidedOnboardingComplete = () => { setShowGuidedOnboarding(false); handleDismissWelcome(); };
    const handleTabChange = (tabId) => tabId === 'More' ? setShowMoreMenu(true) : setActiveTab(tabId);
    const handleMoreNavigate = (dest) => { setActiveTab(dest); setShowMoreMenu(false); };

    // 1. Handle "Request Service" click
    const handleBookService = useCallback((task) => {
        const record = records.find(r => r.id === task.recordId);
        if (!record) {
            console.warn("Record not found for booking:", task.recordId);
            toast.error("Could not find the related record");
            return;
        }
        
        setQuickServiceRecord(record);
        setQuickServiceDescription(`Maintenance: ${task.taskName || 'General Service'}`);
        setShowQuickService(true);
    }, [records]);

    // 2. Handle "Done" click (Complete Task) - UPDATED FOR HISTORY
    const handleMarkTaskDone = useCallback(async (task, notes = '') => {
        try {
            if (!task.recordId) {
                toast.error("Could not update - missing record ID");
                return;
            }
            
            const recordRef = doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.recordId);
            const record = records.find(r => r.id === task.recordId);
            if (!record) return;
            
            const completedDate = new Date().toISOString();
            const completedDateShort = completedDate.split('T')[0];
            
            // 1. Create History Entry
            const historyEntry = {
                taskName: task.taskName,
                completedDate: completedDate,
                performedBy: 'User',
                notes: notes,
                id: Date.now().toString()
            };
            
            const currentHistory = record.maintenanceHistory || [];
            const newHistory = [historyEntry, ...currentHistory];

            // 2. Calculate Next Due Date
            let updates = { maintenanceHistory: newHistory };
            
            if (task.isGranular) {
                // Update specific task in the maintenanceTasks array
                const updatedTasks = (record.maintenanceTasks || []).map(t => {
                    if (t.task === task.taskName) {
                        const nextDate = calculateNextDate(completedDateShort, t.frequency || 'annual');
                        return { ...t, nextDue: nextDate };
                    }
                    return t;
                });
                updates.maintenanceTasks = updatedTasks;
            } else {
                // Legacy: update dateInstalled to effectively reset the cycle
                updates.dateInstalled = completedDateShort; 
            }

            await updateDoc(recordRef, updates);
            toast.success("Task complete! History saved.", { icon: '🎉' });
            celebrations.showToast("Maintenance Recorded!", Check);
            
        } catch (e) {
            console.error('[App] handleMarkTaskDone error:', e);
            toast.error("Failed to update: " + e.message);
        }
    }, [records, user, celebrations]);

    // 3. Handle "Delete" click (Remove History Item) - NEW FIX
    const handleDeleteHistoryItem = useCallback(async (historyItem) => {
        try {
            if (!historyItem.recordId) {
                toast.error("Could not delete - missing record ID");
                return;
            }
            
            const recordRef = doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', historyItem.recordId);
            const record = records.find(r => r.id === historyItem.recordId);
            if (!record) {
                toast.error("Record not found");
                return;
            }
            
            // Filter out the history item to delete
            const currentHistory = record.maintenanceHistory || [];
            const newHistory = currentHistory.filter(h => h.id !== historyItem.id);
            
            await updateDoc(recordRef, { maintenanceHistory: newHistory });
            toast.success("History item removed", { icon: '🗑️' });
            
        } catch (e) {
            console.error('[App] handleDeleteHistoryItem error:', e);
            toast.error("Failed to delete: " + e.message);
        }
    }, [records, user]);

    // ============================================

    const handleAnalyzeImage = useCallback(async (imageBlob) => {
        const response = await fetch(imageBlob);
        const blob = await response.blob();
        const base64 = await fileToBase64(blob);
        return await scanReceipt(blob, base64, activeProperty?.address);
    }, [scanReceipt, activeProperty]);

    const handleScanComplete = useCallback(async (extractedData) => {
        setShowScanner(false);
        const validAttachments = extractedData.attachments || [];

        const processMaintenance = (freq, installDate) => {
            const finalFreq = freq || 'annual'; 
            return {
                frequency: finalFreq,
                nextDate: calculateNextDate(installDate, finalFreq)
            };
        };

        if (extractedData.items && extractedData.items.length > 0) {
            const processedItems = extractedData.items.map(item => {
                const maint = processMaintenance(item.maintenanceFrequency, extractedData.date);
                return {
                    ...item,
                    maintenanceFrequency: maint.frequency,
                    nextServiceDate: maint.nextDate,
                    notes: item.notes || '',
                    maintenanceTasks: item.maintenanceTasks || [] 
                };
            });

            setEditingRecord({
                isBatch: true,
                items: processedItems,
                dateInstalled: extractedData.date || new Date().toISOString().split('T')[0],
                contractor: extractedData.store || '',
                contractorPhone: extractedData.contractorPhone,
                contractorEmail: extractedData.contractorEmail,
                contractorAddress: extractedData.contractorAddress,
                warranty: extractedData.warranty || '', 
                attachments: validAttachments
            });
            toast.success(`Found ${extractedData.items.length} items with maintenance schedules!`, { icon: '📅' });
        } else {
            const singleItem = extractedData.items?.[0] || {};
            const maint = processMaintenance(singleItem.maintenanceFrequency || 'annual', extractedData.date);

            setEditingRecord({
                item: singleItem.item || extractedData.item || '',
                category: singleItem.category || extractedData.category || 'Other',
                brand: singleItem.brand || extractedData.brand || '',
                model: singleItem.model || extractedData.model || '',
                cost: singleItem.cost || extractedData.cost || '',
                dateInstalled: extractedData.date || new Date().toISOString().split('T')[0],
                maintenanceFrequency: maint.frequency,
                nextServiceDate: maint.nextDate,
                notes: singleItem.notes || '',
                maintenanceTasks: singleItem.maintenanceTasks || [], 
                contractor: extractedData.store || '',
                contractorPhone: extractedData.contractorPhone,
                contractorEmail: extractedData.contractorEmail,
                contractorAddress: extractedData.contractorAddress,
                warranty: extractedData.warranty || '', 
                attachments: validAttachments
            });
            toast.success(`Maintenance schedule created for ${extractedData.store || 'contractor'}`, { icon: '🤝' });
        }
        setIsAddModalOpen(true);
    }, []);

    const handleSaveSuccess = () => {
        const prevCount = records.length;
        const newCount = prevCount + 1;
        const hasMilestone = celebrations.checkMilestone(prevCount, newCount);
        if (!hasMilestone) celebrations.showToast(`Saved successfully!`, Check);
        closeAddModal();
    };

    const isContractor = new URLSearchParams(window.location.search).get('requestId');
    if (isContractor) return <ContractorPortal />;
    if (loading) return <AppShellSkeleton />;
    if (!user) return <AuthScreen onLogin={handleAuth} onGoogleLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} onAppleLogin={() => signInWithPopup(auth, new OAuthProvider('apple.com'))} onGuestLogin={() => signInAnonymously(auth)} />;
    if (!profile && !loading) return <SetupPropertyForm onSave={handleSaveProperty} isSaving={isSavingProperty} onSignOut={() => signOut(auth)} />;

    const isNewUser = activePropertyRecords.length === 0 && !hasSeenWelcome;
    const totalNotifications = dueTasks.length + newSubmissions.length;

    // Grouping logic for inventory view
    const groupKey = inventoryView === 'room' ? 'area' : 'category';
    const filtered = activePropertyRecords.filter(r => {
        const matchSearch = !searchTerm || r.item?.toLowerCase().includes(searchTerm.toLowerCase()) || r.brand?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = filterCategory === 'All' || r.category === filterCategory;
        return matchSearch && matchCategory;
    });
    const grouped = filtered.reduce((acc, r) => {
        const key = r[groupKey] || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
    }, {});

    return (
        <>
        <Toaster position="top-center" />
        <CelebrationRenderer celebration={celebrations.celebration} toast={celebrations.toast} onCloseCelebration={celebrations.closeCelebration} onCloseToast={celebrations.closeToast} />
        {showScanner && <SmartScanner onClose={() => setShowScanner(false)} onProcessComplete={handleScanComplete} onAnalyze={handleAnalyzeImage} />}
        
        <div className="min-h-screen bg-slate-50 pb-24">
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-9 w-9" />
                        <button onClick={() => setIsSwitchingProp(true)} className="flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors">
                            <span className="font-bold text-emerald-950 text-lg">{activeProperty?.name || 'My Home'}</span>
                            <ChevronDown size={16} className="text-slate-400"/>
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                            <Bell size={20} className="text-slate-600"/>{totalNotifications > 0 && <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{totalNotifications}</span>}
                        </button>
                        <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <Menu size={20} className="text-slate-600"/>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {showGuidedOnboarding && <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGuidedOnboarding(false)}></div><div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"><GuidedOnboarding propertyName={activeProperty?.name} onComplete={handleGuidedOnboardingComplete} onAddItem={handleGuidedOnboardingAddItem} onScanReceipt={() => { setShowGuidedOnboarding(false); openAddModal(); }} onDismiss={() => { setShowGuidedOnboarding(false); handleDismissWelcome(); }} /></div></div>}
                {isNewUser && activeTab === 'Dashboard' && !showGuidedOnboarding && <WelcomeScreen propertyName={activeProperty.name} onAddRecord={() => setShowGuidedOnboarding(true)} onDismiss={handleDismissWelcome} />}
                
                {activeTab === 'Dashboard' && !isNewUser && (
                    <FeatureErrorBoundary label="Dashboard">
                        <ProgressiveDashboard 
                            records={activePropertyRecords} 
                            contractors={contractorsList} 
                            activeProperty={activeProperty} 
                            onScanReceipt={() => setShowScanner(true)} 
                            onAddRecord={() => openAddModal()} 
                            onNavigateToItems={() => setActiveTab('Items')} 
                            onNavigateToContractors={() => setActiveTab('Contractors')} 
                            onNavigateToReports={() => setActiveTab('Reports')} 
                            onNavigateToMaintenance={() => setActiveTab('Maintenance')} 
                            onCreateContractorLink={() => handleOpenQuickService(null)}
                            onBookService={handleBookService}
                            onMarkTaskDone={handleMarkTaskDone}
                        />
                    </FeatureErrorBoundary>
                )}
                
                {activeTab === 'Maintenance' && (
                    <FeatureErrorBoundary label="Maintenance Schedule">
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <button onClick={() => setActiveTab('Dashboard')} className="flex items-center text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors">
                                <ArrowLeft size={16} className="mr-1"/> Back to Dashboard
                            </button>
                            <h2 className="text-2xl font-bold text-emerald-950">Maintenance Schedule</h2>
                            {/* UPDATED: Passing required props including onDeleteHistoryItem */}
                            <MaintenanceDashboard 
                                records={activePropertyRecords} 
                                onAddRecord={openAddModal} 
                                onNavigateToRecords={() => setActiveTab('Items')}
                                onBookService={handleBookService}
                                onMarkTaskDone={handleMarkTaskDone}
                                onDeleteHistoryItem={handleDeleteHistoryItem}
                            />
                        </div>
                    </FeatureErrorBoundary>
                )}

                {activeTab === 'Reports' && <FeatureErrorBoundary label="Reports"><PedigreeReport propertyProfile={activeProperty} records={activePropertyRecords} /></FeatureErrorBoundary>}
                
                {activeTab === 'Items' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-emerald-950">Inventory</h2>
                                <div className="bg-slate-100 p-1 rounded-xl flex">
                                    <button onClick={() => setInventoryView('category')} className={`px-4 py-2 rounded-lg text-sm font-bold ${inventoryView === 'category' ? 'bg-white shadow' : 'text-slate-500'}`}>Category</button>
                                    <button onClick={() => setInventoryView('room')} className={`px-4 py-2 rounded-lg text-sm font-bold ${inventoryView === 'room' ? 'bg-white shadow' : 'text-slate-500'}`}>Room</button>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-4 py-3 bg-emerald-50 border rounded-xl"/>
                                <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="px-4 py-3 bg-slate-100 rounded-xl font-bold">{isSelectionMode ? 'Done' : 'Select'}</button>
                            </div>
                            {isSelectionMode && selectedRecords.size > 0 && (
                                <button onClick={handleBatchDelete} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                    <Trash2 size={18}/> Delete {selectedRecords.size} items
                                </button>
                            )}
                        </div>
                        
                        {Object.keys(grouped).length === 0 ? (
                            <EmptyState title="No items found" description="Try adjusting your search or add some items." />
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0])).map(([group, items]) => (
                                    <div key={group}>
                                        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            {group} <span className="text-sm font-normal text-slate-400">({items.length})</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {items.map(r => (
                                                <div key={r.id} className={`${isSelectionMode && selectedRecords.has(r.id) ? 'ring-2 ring-emerald-500 rounded-2xl transform scale-[0.98] transition-transform' : 'hover:-translate-y-1 transition-transform duration-300'}`} onClick={() => isSelectionMode && toggleRecordSelection(r.id)}>
                                                    {useEnhancedCards ? <EnhancedRecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} onRequestService={handleOpenQuickService} /> : <RecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'Contractors' && <FeatureErrorBoundary label="Contractors"><ProConnect userId={user.uid} propertyName={activeProperty.name} propertyAddress={activeProperty.address} records={activePropertyRecords} onRequestImport={handleRequestImport} onOpenQuickRequest={handleOpenQuickService} /></FeatureErrorBoundary>}
                {activeTab === 'Settings' && <div className="space-y-6"><h2 className="text-2xl font-bold">Settings</h2><div className="bg-white rounded-2xl border p-6"><h3 className="font-bold">Enhanced Cards</h3><button onClick={() => setUseEnhancedCards(!useEnhancedCards)} className={`w-12 h-6 rounded-full ${useEnhancedCards ? 'bg-emerald-600' : 'bg-slate-300'} transition-colors`}><div className={`w-5 h-5 bg-white rounded-full shadow transform ${useEnhancedCards ? 'translate-x-6' : 'translate-x-0.5'} transition-transform`}></div></button></div></div>}
                {activeTab === 'Help' && <div className="space-y-6"><h2 className="text-2xl font-bold">Help</h2><div className="bg-white rounded-2xl border p-6"><p>Contact support@krib.io</p></div></div>}
            </main>

            <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onAddClick={() => openAddModal()} notificationCount={newSubmissions.length} />
            <MoreMenu isOpen={showMoreMenu} onClose={() => setShowMoreMenu(false)} onNavigate={handleMoreNavigate} onSignOut={() => signOut(auth)} />

            {isAddModalOpen && <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={closeAddModal}></div><div className="relative w-full max-w-5xl bg-white sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto"><WrapperAddRecord user={user} db={db} appId={appId} profile={profile} activeProperty={activeProperty} editingRecord={editingRecord} onClose={closeAddModal} onSuccess={handleSaveSuccess} existingRecords={records} /></div></div>}
            
            {showQuickService && (
                <QuickServiceRequest 
                    record={quickServiceRecord} 
                    userId={user.uid} 
                    propertyName={activeProperty?.name} 
                    propertyAddress={activeProperty?.address} 
                    onClose={handleCloseQuickService} 
                    initialDescription={quickServiceDescription} 
                />
            )}
        </div>
        </>
    );
};

const WrapperAddRecord = ({ user, db, appId, profile, activeProperty, editingRecord, onClose, onSuccess, existingRecords }) => {
    const initial = { category: '', item: '', brand: '', model: '', warranty: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0], attachments: [] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (editingRecord) setNewRecord(editingRecord); }, [editingRecord]);
    const handleChange = (e) => setNewRecord({...newRecord, [e.target.name]: e.target.value});
    
    const handleAttachmentsChange = async (files) => {
        const placeholders = await Promise.all(files.map(async f => {
            const isPdf = f.type.includes('pdf');
            let thumbnailBlob = null;
            if (isPdf) {
                thumbnailBlob = await generatePDFThumbnail(f);
            }
            return { 
                name: f.name, 
                size: f.size, 
                type: isPdf ? 'Document' : 'Photo', 
                fileRef: f,
                thumbnailRef: thumbnailBlob 
            };
        }));
        setNewRecord(p => ({ ...p, attachments: [...(p.attachments||[]), ...placeholders] }));
    };
    
    const parseCost = (val) => {
        if (!val) return 0;
        const clean = String(val).replace(/[^0-9.]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    const handleBatchSave = async (items, file) => {
        if (!items || items.length === 0) return;
        setSaving(true);
        try {
            let sharedImageUrl = null;
            let sharedFileType = 'Photo';
            let sharedFileUrl = null;
            
            const fileToUpload = file || editingRecord?.attachments?.[0]?.fileRef;

            if (fileToUpload) {
                const isPdf = fileToUpload.type?.includes('pdf');
                const ext = isPdf ? 'pdf' : 'jpg'; 
                sharedFileType = isPdf ? 'Document' : 'Photo';
                const filename = `batch_scan_${Date.now()}.${ext}`;
                const storageRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${filename}`);
                
                await uploadBytes(storageRef, fileToUpload);
                sharedFileUrl = await getDownloadURL(storageRef);

                if (isPdf) {
                    const thumbnailBlob = await generatePDFThumbnail(fileToUpload);
                    if (thumbnailBlob) {
                         const thumbFilename = `batch_scan_thumb_${Date.now()}.jpg`;
                         const thumbRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${thumbFilename}`);
                         await uploadBytes(thumbRef, thumbnailBlob);
                         sharedImageUrl = await getDownloadURL(thumbRef);
                    }
                } else {
                    sharedImageUrl = sharedFileUrl;
                }
            }
            
            const batch = writeBatch(db);
            const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'house_records');
            
            items.forEach((item) => {
                 const newDocRef = doc(collectionRef);
                 const nextDate = calculateNextDate(
                     item.dateInstalled || editingRecord?.dateInstalled || new Date().toISOString().split('T')[0],
                     item.maintenanceFrequency || 'none'
                 );

                 const docData = { 
                     userId: user.uid, 
                     propertyId: activeProperty.id, 
                     propertyLocation: activeProperty.name, 
                     category: item.category || 'Other', 
                     item: item.item || 'Unknown Item', 
                     brand: item.brand || '', 
                     model: item.model || '', 
                     serialNumber: item.serial || '', 
                     cost: parseCost(item.cost), 
                     area: item.area || 'General', 
                     notes: item.notes || '', 
                     dateInstalled: item.dateInstalled || editingRecord?.dateInstalled || new Date().toISOString().split('T')[0], 
                     maintenanceFrequency: item.maintenanceFrequency || 'none', 
                     nextServiceDate: nextDate, 
                     maintenanceTasks: item.maintenanceTasks || [], 
                     contractor: item.contractor || editingRecord?.contractor || '',
                     contractorPhone: editingRecord?.contractorPhone || '',
                     contractorEmail: editingRecord?.contractorEmail || '',
                     contractorAddress: editingRecord?.contractorAddress || '',
                     warranty: item.warranty || editingRecord?.warranty || '',
                     imageUrl: sharedImageUrl || '', 
                     attachments: sharedFileUrl ? [{ name: 'Scan', type: sharedFileType, url: sharedFileUrl }] : [],
                     timestamp: serverTimestamp() 
                 };
                 batch.set(newDocRef, docData);
            });
            
            await batch.commit();
            toast.success(`${items.length} items saved!`);
            onSuccess();
        } catch (error) { 
            console.error("Batch Save Error:", error);
            toast.error(`Error: ${error.code || error.message}`); 
        } finally { setSaving(false); }
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            const finalAtts = [];
            let coverUrl = '';

            for (const att of (newRecord.attachments || [])) {
                if (att.fileRef) {
                    try {
                        const timestamp = Date.now();
                        const fileRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${timestamp}_${att.name}`);
                        await uploadBytes(fileRef, att.fileRef);
                        const mainUrl = await getDownloadURL(fileRef);

                        let thumbnailUrl = null;
                        if (att.thumbnailRef) {
                             const thumbRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${timestamp}_thumb_${att.name}.jpg`);
                             await uploadBytes(thumbRef, att.thumbnailRef);
                             thumbnailUrl = await getDownloadURL(thumbRef);
                             if (!coverUrl) coverUrl = thumbnailUrl;
                        } else if (att.type === 'Photo' && !coverUrl) {
                             coverUrl = mainUrl;
                        }

                        finalAtts.push({ 
                            name: att.name, 
                            size: att.size, 
                            type: att.type, 
                            url: mainUrl, 
                            dateAdded: new Date().toISOString() 
                        });

                    } catch(e) { console.error("Failed to upload attachment", att.name, e); }
                } else if (att.url) {
                    finalAtts.push(att);
                    if (att.type === 'Photo' && !coverUrl && !att.url.startsWith('blob:')) coverUrl = att.url;
                }
            }
            
            const { originalRequestId, id, isBatch, ...data } = newRecord;
            data.cost = parseCost(data.cost);

            const payload = { 
                ...data, 
                attachments: finalAtts, 
                imageUrl: coverUrl || '', 
                userId: user.uid, 
                propertyLocation: activeProperty.name, 
                propertyId: activeProperty.id, 
                nextServiceDate: calculateNextDate(data.dateInstalled, data.maintenanceFrequency) 
            };
            
            if (editingRecord?.id) { 
                await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), payload); 
                toast.success("Record updated!"); 
            } else { 
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...payload, timestamp: serverTimestamp() }); 
                setNewRecord(initial); 
                if (originalRequestId) try { await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, originalRequestId), { status: 'archived' }); } catch(e){} 
            }
            onSuccess();
        } catch (e) { 
            console.error(e); 
            toast.error(`Save failed. Error: ${e.code || e.message}`); 
        } finally { setSaving(false); }
    };

    return (
        <div className="relative">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-[2rem]"><h3 className="text-xl font-bold text-slate-800">{editingRecord ? 'Edit Item' : 'Add New Item'}</h3><button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div>
            <AddRecordForm onSave={handleSave} onBatchSave={handleBatchSave} isSaving={saving} newRecord={newRecord} onInputChange={handleChange} onAttachmentsChange={handleAttachmentsChange} isEditing={!!editingRecord} onCancelEdit={onClose} existingRecords={existingRecords} />
        </div>
    );
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
