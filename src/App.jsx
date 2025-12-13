// src/App.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously, deleteUser } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch, limit, orderBy, where } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LogOut, Camera, Search, Filter, XCircle, Plus, X, Bell, ChevronDown, PlusCircle, Check, LayoutDashboard, Package, MapPin, Trash2, Menu, CheckSquare, DoorOpen } from 'lucide-react'; 
import toast, { Toaster } from 'react-hot-toast';

import { auth, db, storage } from './config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, CATEGORIES } from './config/constants';
import { calculateNextDate } from './lib/utils';
import { compressImage, fileToBase64 } from './lib/images';

// NEW UX IMPORTS
import { useGemini } from './hooks/useGemini';
import { ProgressiveDashboard } from './features/dashboard/ProgressiveDashboard';
import { SmartScanner } from './features/scanner/SmartScanner';
import { CelebrationRenderer, useCelebrations } from './features/celebrations/CelebrationMoments';
import './styles/krib-theme.css'; 

// Components
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
    const [quickServiceRecord, setQuickServiceRecord] = useState(null);
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

    const contractorsList = Object.values(activePropertyRecords.reduce((acc, r) => {
        if (r.contractor && r.contractor.length > 2) acc[r.contractor] = { name: r.contractor, id: r.contractor };
        return acc;
    }, {}));

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
    const handleDeleteAccount = async () => { if (!confirm("Delete account?")) return; try { await deleteUser(user); } catch (e) { toast.error("Re-login required"); } };
    const handleRequestImport = (req) => { setEditingRecord({...req, id: null, originalRequestId: req.id}); setIsAddModalOpen(true); };
    const openAddModal = (rec = null) => { setEditingRecord(rec); setIsAddModalOpen(true); };
    const closeAddModal = () => { setIsAddModalOpen(false); setEditingRecord(null); };
    const handleDismissWelcome = async () => { setHasSeenWelcome(true); if (user) updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { hasSeenWelcome: true }); };
    const handleOpenQuickService = (record) => { setQuickServiceRecord(record); setShowQuickService(true); };
    const handleCloseQuickService = () => { setShowQuickService(false); setQuickServiceRecord(null); };
    const handleGuidedOnboardingAddItem = async (item) => addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...item, userId: user.uid, propertyId: activeProperty?.id || 'legacy', propertyLocation: activeProperty?.name, timestamp: serverTimestamp() });
    const handleGuidedOnboardingComplete = () => { setShowGuidedOnboarding(false); handleDismissWelcome(); };
    const handleTabChange = (tabId) => tabId === 'More' ? setShowMoreMenu(true) : setActiveTab(tabId);
    const handleMoreNavigate = (dest) => { setActiveTab(dest); setShowMoreMenu(false); };

    // --- INTEGRATED SCANNER LOGIC ---
    const handleAnalyzeImage = useCallback(async (imageBlob) => {
        const response = await fetch(imageBlob);
        const blob = await response.blob();
        const base64 = await fileToBase64(blob);
        return await scanReceipt(blob, base64);
    }, [scanReceipt]);

    const handleScanComplete = useCallback(async (extractedData) => {
        setShowScanner(false);
        // CRITICAL: Check if multiple items found
        if (extractedData.items && extractedData.items.length > 0) {
            // Batch Mode
            setEditingRecord({
                isBatch: true, // FLAG FOR ADD RECORD FORM
                items: extractedData.items,
                dateInstalled: extractedData.date || new Date().toISOString().split('T')[0],
                contractor: extractedData.store || '',
                attachments: extractedData.image ? [{ name: 'Scan.jpg', preview: extractedData.image }] : []
            });
            toast.success(`Found ${extractedData.items.length} items! Review them now.`, { icon: '📸' });
        } else {
            // Single Mode
            setEditingRecord({
                item: extractedData.item || '',
                category: extractedData.category || 'Other',
                brand: extractedData.brand || '',
                model: extractedData.model || '',
                cost: extractedData.cost || '',
                dateInstalled: extractedData.date || new Date().toISOString().split('T')[0],
                attachments: extractedData.image ? [{ name: 'Scan.jpg', preview: extractedData.image }] : []
            });
            toast.success("Scan complete!", { icon: '📸' });
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
    if (isAddingProperty) return <div className="relative"><button onClick={() => setIsAddingProperty(false)} className="absolute top-6 left-6 z-50 text-slate-500 font-bold flex items-center bg-white px-4 py-2 rounded-xl shadow-sm"><X className="mr-2 h-4 w-4"/> Cancel</button><SetupPropertyForm onSave={handleSaveProperty} isSaving={isSavingProperty} onSignOut={() => {}} /></div>;
    if (!activeProperty) return <div className="p-10 text-center">Loading...</div>;

    const totalNotifications = dueTasks.length + newSubmissions.length;
    const isNewUser = records.length === 0 && !hasSeenWelcome;
    const filteredRecords = activePropertyRecords.filter(r => {
        const searchLower = searchTerm.toLowerCase();
        return ((r.item||'').toLowerCase().includes(searchLower) || (r.brand||'').toLowerCase().includes(searchLower)) && (filterCategory === 'All' || r.category === filterCategory);
    });

    return (
        <>
        <Toaster position="top-center" />
        <CelebrationRenderer celebration={celebrations.celebration} toast={celebrations.toast} itemName={lastAddedItem} onCloseCelebration={celebrations.closeCelebration} onCloseToast={celebrations.closeToast} onAddAnother={() => openAddModal()} />
        {showScanner && <SmartScanner onClose={() => setShowScanner(false)} onProcessComplete={handleScanComplete} analyzeImage={handleAnalyzeImage} />}

        <div className="min-h-screen bg-emerald-50 font-sans pb-32">
            <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 flex justify-between items-center shadow-sm h-20">
                <div className="relative z-10 flex items-center">
                    <button onClick={() => setIsSwitchingProp(!isSwitchingProp)} className="flex items-center gap-3 text-left hover:bg-emerald-50 p-2 -ml-2 rounded-xl transition-colors group">
                        <Logo className="h-10 w-10 group-hover:scale-105 transition-transform"/>
                        <div className="flex flex-col"><h1 className="text-xl font-extrabold text-emerald-950 leading-none flex items-center">{activeProperty.name}<ChevronDown size={16} className="ml-1 text-slate-400 group-hover:text-emerald-600 transition-colors"/></h1></div>
                    </button>
                    {isSwitchingProp && (<div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">{properties.map(p => (<button key={p.id} onClick={() => handleSwitchProperty(p.id)} className={`w-full text-left px-3 py-3 rounded-xl flex items-center justify-between text-sm font-bold mb-1 ${activePropertyId === p.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>{p.name}{activePropertyId === p.id && <Check size={16} className="text-emerald-600"/>}</button>))}<div className="border-t border-slate-100 my-1"></div><button onClick={() => { setIsSwitchingProp(false); setIsAddingProperty(true); }} className="w-full text-left px-3 py-3 rounded-xl flex items-center text-sm font-bold text-emerald-600 hover:bg-emerald-50"><PlusCircle size={16} className="mr-2"/> Add Property</button></div>)}
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="relative"><button onClick={() => setShowNotifications(!showNotifications)} className="p-2 relative bg-white hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100"><Bell size={20} className="text-slate-400"/>{totalNotifications > 0 && <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button></div>
                    <div className="relative"><button onClick={() => setShowUserMenu(!showUserMenu)} className="p-2 bg-white hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100"><Menu size={20} className="text-slate-400"/></button>{showUserMenu && (<><div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95"><button onClick={() => signOut(auth)} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center"><LogOut size={16} className="mr-2"/> Sign Out</button></div><div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div></>)}</div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                {showGuidedOnboarding && <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGuidedOnboarding(false)}></div><div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"><GuidedOnboarding propertyName={activeProperty?.name} onComplete={handleGuidedOnboardingComplete} onAddItem={handleGuidedOnboardingAddItem} onScanReceipt={() => { setShowGuidedOnboarding(false); openAddModal(); }} onDismiss={() => { setShowGuidedOnboarding(false); handleDismissWelcome(); }} /></div></div>}
                {isNewUser && activeTab === 'Dashboard' && !showGuidedOnboarding && <WelcomeScreen propertyName={activeProperty.name} onAddRecord={() => setShowGuidedOnboarding(true)} onDismiss={handleDismissWelcome} />}
                
                {activeTab === 'Dashboard' && !isNewUser && <FeatureErrorBoundary label="Dashboard"><ProgressiveDashboard records={activePropertyRecords} contractors={contractorsList} activeProperty={activeProperty} onScanReceipt={() => setShowScanner(true)} onAddRecord={() => openAddModal()} onNavigateToItems={() => setActiveTab('Items')} onNavigateToContractors={() => setActiveTab('Contractors')} onNavigateToReports={() => setActiveTab('Reports')} onNavigateToMaintenance={() => setActiveTab('Items')} onCreateContractorLink={() => handleOpenQuickService(null)} /></FeatureErrorBoundary>}
                {activeTab === 'Reports' && <FeatureErrorBoundary label="Reports"><PedigreeReport propertyProfile={activeProperty} records={activePropertyRecords} /></FeatureErrorBoundary>}
                {activeTab === 'Items' && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-emerald-950">Inventory</h2><div className="bg-slate-100 p-1 rounded-xl flex"><button onClick={() => setInventoryView('category')} className={`px-4 py-2 rounded-lg text-sm font-bold ${inventoryView === 'category' ? 'bg-white shadow' : 'text-slate-500'}`}>Category</button><button onClick={() => setInventoryView('room')} className={`px-4 py-2 rounded-lg text-sm font-bold ${inventoryView === 'room' ? 'bg-white shadow' : 'text-slate-500'}`}>Room</button></div></div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4"><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 pr-4 py-3 bg-emerald-50 border rounded-xl"/><button onClick={() => setIsSelectionMode(!isSelectionMode)} className="px-4 py-3 bg-slate-100 rounded-xl font-bold">{isSelectionMode ? 'Cancel' : 'Select'}</button></div>
                        </div>
                        {isSelectionMode && selectedRecords.size > 0 && <div className="sticky top-20 z-30 bg-white p-4 rounded-xl border border-red-100 shadow-xl flex justify-between"><span className="font-bold">{selectedRecords.size} selected</span><button onClick={handleBatchDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">Delete</button></div>}
                        {records.length === 0 ? <EmptyState icon={Package} title="No items yet" description="Start building your home's inventory." actions={<><button onClick={() => setShowScanner(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold">Scan</button><button onClick={() => openAddModal()} className="px-6 py-3 border border-emerald-200 text-emerald-700 rounded-xl font-bold">Add</button></>} /> : 
                            <div className="space-y-6">{Object.keys(filteredRecords.reduce((acc, r) => { const k = inventoryView === 'room' ? (r.area||'General') : (r.category||'Other'); if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; }, {})).sort().map(key => (
                                <details key={key} open className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"><summary className="flex justify-between p-4 cursor-pointer hover:bg-slate-50 font-bold text-lg">{key}</summary><div className="p-4 pt-0 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">{filteredRecords.filter(r => (inventoryView==='room'?r.area:r.category)===key).map(r => <div key={r.id} className="relative">{isSelectionMode && <input type="checkbox" checked={selectedRecords.has(r.id)} onChange={() => toggleRecordSelection(r.id)} className="absolute top-4 right-4 z-10 h-6 w-6"/>}{useEnhancedCards ? <EnhancedRecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} onRequestService={handleOpenQuickService} /> : <RecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} />}</div>)}</div></details>
                            ))}</div>
                        }
                    </div>
                )}
                {activeTab === 'Contractors' && <FeatureErrorBoundary label="Contractors"><ProConnect userId={user.uid} propertyName={activeProperty.name} propertyAddress={activeProperty.address} records={activePropertyRecords} onRequestImport={handleRequestImport} onOpenQuickRequest={handleOpenQuickService} /></FeatureErrorBoundary>}
                {activeTab === 'Settings' && <div className="space-y-6"><h2 className="text-2xl font-bold">Settings</h2><div className="bg-white rounded-2xl border p-6"><h3 className="font-bold">Enhanced Cards</h3><button onClick={() => setUseEnhancedCards(!useEnhancedCards)} className={`w-12 h-6 rounded-full ${useEnhancedCards ? 'bg-emerald-600' : 'bg-slate-300'} transition-colors`}><div className={`w-5 h-5 bg-white rounded-full shadow transform ${useEnhancedCards ? 'translate-x-6' : 'translate-x-0.5'} transition-transform`}></div></button></div></div>}
                {activeTab === 'Help' && <div className="space-y-6"><h2 className="text-2xl font-bold">Help</h2><div className="bg-white rounded-2xl border p-6"><p>Contact support@krib.io</p></div></div>}
            </main>

            <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onAddClick={() => openAddModal()} notificationCount={newSubmissions.length} />
            <MoreMenu isOpen={showMoreMenu} onClose={() => setShowMoreMenu(false)} onNavigate={handleMoreNavigate} onSignOut={() => signOut(auth)} />

            {isAddModalOpen && <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={closeAddModal}></div><div className="relative w-full max-w-5xl bg-white sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto"><WrapperAddRecord user={user} db={db} appId={appId} profile={profile} activeProperty={activeProperty} editingRecord={editingRecord} onClose={closeAddModal} onSuccess={handleSaveSuccess} /></div></div>}
            {showQuickService && <QuickServiceRequest record={quickServiceRecord} userId={user.uid} propertyName={activeProperty?.name} propertyAddress={activeProperty?.address} onClose={handleCloseQuickService} />}
        </div>
        </>
    );
};

const WrapperAddRecord = ({ user, db, appId, profile, activeProperty, editingRecord, onClose, onSuccess }) => {
    const initial = { category: '', item: '', brand: '', model: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0], attachments: [] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (editingRecord) setNewRecord(editingRecord); }, [editingRecord]);
    const handleChange = (e) => setNewRecord({...newRecord, [e.target.name]: e.target.value});
    
    const handleAttachmentsChange = (files) => {
        const placeholders = files.map(f => ({ name: f.name, size: f.size, type: f.type.includes('pdf') ? 'Document' : 'Photo', fileRef: f }));
        setNewRecord(p => ({ ...p, attachments: [...(p.attachments||[]), ...placeholders] }));
    };
    
    const handleBatchSave = async (items, file) => {
        if (!items || items.length === 0) return;
        setSaving(true);
        try {
            let sharedImageUrl = null;
            let sharedFileType = 'Photo';
            if (file) {
                const isPdf = file.type === 'application/pdf';
                const ext = isPdf ? 'pdf' : 'jpg'; 
                sharedFileType = isPdf ? 'Document' : 'Photo';
                const filename = `batch_scan_${Date.now()}.${ext}`;
                const storageRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${filename}`);
                await uploadBytes(storageRef, file);
                sharedImageUrl = await getDownloadURL(storageRef);
            }
            const batch = writeBatch(db);
            const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'house_records');
            items.forEach((item) => {
                 const newDocRef = doc(collectionRef);
                 const docData = { 
                     userId: user.uid, propertyId: activeProperty.id, propertyLocation: activeProperty.name, 
                     category: item.category || 'Other', item: item.item || 'Unknown Item', brand: item.brand || '', model: item.model || '', 
                     area: item.area || 'General', notes: item.notes || '', cost: item.cost ? parseFloat(item.cost) : 0, 
                     dateInstalled: new Date().toISOString().split('T')[0], maintenanceFrequency: 'none', nextServiceDate: null, 
                     imageUrl: (sharedFileType === 'Photo') ? (sharedImageUrl || '') : '', 
                     attachments: sharedImageUrl ? [{ name: 'Scanned Source', type: sharedFileType, url: sharedImageUrl }] : [], timestamp: serverTimestamp() 
                };
                batch.set(newDocRef, docData);
            });
            await batch.commit();
            onSuccess();
        } catch (error) { console.error("Batch Save Error:", error); toast.error("Failed to save items."); } finally { setSaving(false); }
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        const processed = await Promise.all((newRecord.attachments||[]).map(async att => {
            if (att.fileRef) {
                try {
                    let file = att.fileRef;
                    if (file.type.startsWith('image/')) { const c = await compressImage(file); const r = await fetch(c); file = await r.blob(); }
                    const fileRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${Date.now()}_${att.name}`);
                    await uploadBytes(fileRef, file);
                    const url = await getDownloadURL(fileRef);
                    return { name: att.name, size: att.size, type: att.type, url, dateAdded: new Date().toISOString() };
                } catch(e){ return null; }
            }
            return att;
        }));
        const finalAtts = processed.filter(Boolean);
        const cover = finalAtts.find(a=>a.type==='Photo')?.url||'';
        const { originalRequestId, id, isBatch, ...data } = newRecord;
        const payload = { ...data, attachments: finalAtts, imageUrl: cover, userId: user.uid, propertyLocation: activeProperty.name, propertyId: activeProperty.id, nextServiceDate: calculateNextDate(data.dateInstalled, data.maintenanceFrequency) };
        try {
            if (editingRecord?.id) { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), payload); toast.success("Record updated!"); } 
            else { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...payload, timestamp: serverTimestamp() }); setNewRecord(initial); if (originalRequestId) try { await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, originalRequestId), { status: 'archived' }); } catch(e){} }
            onSuccess();
        } catch (e) { toast.error("Save failed."); } finally { setSaving(false); }
    };

    return (
        <div className="relative">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-[2rem]"><h3 className="text-xl font-bold text-slate-800">{editingRecord ? 'Edit Item' : 'Add New Item'}</h3><button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div>
            <AddRecordForm onSave={handleSave} onBatchSave={handleBatchSave} isSaving={saving} newRecord={newRecord} onInputChange={handleChange} onAttachmentsChange={handleAttachmentsChange} isEditing={!!editingRecord} onCancelEdit={onClose} />
        </div>
    );
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
