// src/App.jsx
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously, deleteUser } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch, limit, orderBy, where } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LogOut, Camera, Search, Filter, XCircle, Plus, X, Bell, ChevronDown, PlusCircle, Check, ChevronRight, LayoutDashboard, Package, Users, MapPin, Trash2, Menu, CheckSquare } from 'lucide-react'; // Added CheckSquare

import toast, { Toaster } from 'react-hot-toast';

import { auth, db, storage } from './config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, CATEGORIES } from './config/constants';
import { calculateNextDate } from './lib/utils';
import { compressImage, fileToBase64 } from './lib/images';

import { Logo } from './components/common/Logo';
import { FeatureErrorBoundary } from './components/common/FeatureErrorBoundary';
import { EmptyState } from './components/common/EmptyState';
import { AppShellSkeleton } from './components/common/Skeletons';
import { AuthScreen } from './features/auth/AuthScreen';
import { SetupPropertyForm } from './features/onboarding/SetupPropertyForm';
import { WelcomeScreen } from './features/onboarding/WelcomeScreen';
import { RecordCard } from './features/records/RecordCard';
import { AddRecordForm } from './features/records/AddRecordForm';
import { Dashboard } from './features/dashboard/Dashboard';
import { RequestManager } from './features/requests/RequestManager';
import { ContractorView } from './features/requests/ContractorView';
import { EnvironmentalInsights } from './features/dashboard/EnvironmentalInsights';
import { CountyData } from './features/dashboard/CountyData';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() { 
      if (this.state.hasError) return (
        <div className="p-10 text-red-600">
            <h2 className="font-bold">Something went wrong.</h2>
            <p className="text-sm font-mono mt-2">{this.state.error?.toString()}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-200 rounded">Reload</button>
        </div>
      ); 
      return this.props.children; 
  }
}

const AppContent = () => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Dashboard'); 
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
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
    
    // NEW: Mass Delete State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState(new Set());

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
        if (r.contractor && r.contractor.length > 2) {
            acc[r.contractor] = { name: r.contractor, id: r.contractor };
        }
        return acc;
    }, {}));

    useEffect(() => {
        let unsubRecords = null;
        let unsubRequests = null;
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            try {
                setUser(currentUser);
                if (currentUser) {
                    if (!appId) throw new Error("appId is missing in constants.js");
                    const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        setProfile(data);
                        if (data.hasSeenWelcome) setHasSeenWelcome(true);
                        if (data.activePropertyId) setActivePropertyId(data.activePropertyId);
                        else if (data.properties && data.properties.length > 0) setActivePropertyId(data.properties[0].id);
                        else setActivePropertyId('legacy');
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
            } catch (error) { 
                console.error(error); 
                toast.error("Something went wrong: " + error.message);
            } finally { setLoading(false); }
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

    const filteredRecords = activePropertyRecords.filter(r => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (r.item || '').toLowerCase().includes(searchLower) || (r.brand || '').toLowerCase().includes(searchLower);
        const matchesCategory = filterCategory === 'All' || r.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const groupedRecords = filteredRecords.reduce((acc, record) => {
        const cat = record.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(record);
        return acc;
    }, {});
    const sortedCategories = Object.keys(groupedRecords).sort();

    const handleAuth = async (email, pass, isSignUp) => isSignUp ? createUserWithEmailAndPassword(auth, email, pass) : signInWithEmailAndPassword(auth, email, pass);
    
    const handleSaveProperty = async (formData) => {
        if (!user) return;
        setIsSavingProperty(true);
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            await setDoc(profileRef, {
                name: formData.name,
                address: formData.address,
                coordinates: formData.coordinates || null,
                activePropertyId: 'legacy',
                createdAt: serverTimestamp()
            }, { merge: true });
            const snap = await getDoc(profileRef);
            if (snap.exists()) setProfile(snap.data());
            toast.success("Your Krib has been created!");
        } catch (error) {
            console.error("Error saving property:", error);
            toast.error("Failed to create Krib: " + error.message);
        } finally {
            setIsSavingProperty(false);
            setIsAddingProperty(false);
        }
    }; 

    const handleSwitchProperty = async (propId) => { 
        setActivePropertyId(propId); 
        setIsSwitchingProp(false);
        const prop = properties.find(p => p.id === propId);
        if (prop) toast.success(`Switched to ${prop.name}`);
    };
    
    // NEW: Toggle record selection
    const toggleRecordSelection = (id) => {
        const newSet = new Set(selectedRecords);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRecords(newSet);
    };

    // NEW: Batch Delete
    const handleBatchDelete = async () => {
        if (selectedRecords.size === 0) return;
        if (!confirm(`Delete ${selectedRecords.size} items? This cannot be undone.`)) return;
        
        const batch = writeBatch(db);
        selectedRecords.forEach(id => {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', id);
            batch.delete(ref);
        });

        try {
            await batch.commit();
            toast.success("Items deleted.");
            setSelectedRecords(new Set());
            setIsSelectionMode(false);
        } catch (e) {
            toast.error("Failed to delete items.");
        }
    };

    const handleDeleteRecord = async (id) => { 
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="font-medium">Delete this record?</p>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={() => {
                            toast.dismiss(t.id);
                            deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', id))
                                .then(() => toast.success("Record deleted"))
                                .catch((e) => toast.error("Delete failed"));
                        }}
                        className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg"
                    >
                        Delete
                    </button>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    const handleDeleteAccount = async () => {
        if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return;
        try {
            await deleteUser(user);
            toast.success("Account deleted.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete account. You may need to sign in again first.");
        }
    };
    
    const handleRequestImport = (req) => { setEditingRecord({...req, id: null, originalRequestId: req.id, dateInstalled: req.dateInstalled||'', maintenanceFrequency: req.maintenanceFrequency||'none'}); setIsAddModalOpen(true); };
    const openAddModal = (rec = null) => { setEditingRecord(rec); setIsAddModalOpen(true); };
    const closeAddModal = () => { setIsAddModalOpen(false); setEditingRecord(null); };
    
    const handleDismissWelcome = async () => {
        setHasSeenWelcome(true);
        if (user) {
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            await updateDoc(profileRef, { hasSeenWelcome: true });
        }
    };

    const isContractor = new URLSearchParams(window.location.search).get('requestId');
    if (isContractor) return <ContractorView />;

    if (loading) return <AppShellSkeleton />;
    if (!user) return <AuthScreen onLogin={handleAuth} onGoogleLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} onAppleLogin={() => signInWithPopup(auth, new OAuthProvider('apple.com'))} onGuestLogin={() => signInAnonymously(auth)} />;
    if (!profile && !loading) return <SetupPropertyForm onSave={handleSaveProperty} isSaving={isSavingProperty} onSignOut={() => signOut(auth)} />;
    if (isAddingProperty) return <div className="relative"><button onClick={() => setIsAddingProperty(false)} className="absolute top-6 left-6 z-50 text-slate-500 font-bold flex items-center bg-white px-4 py-2 rounded-xl shadow-sm"><X className="mr-2 h-4 w-4"/> Cancel</button><SetupPropertyForm onSave={handleSaveProperty} isSaving={isSavingProperty} onSignOut={() => {}} /></div>;
    if (!activeProperty) return <div className="p-10 text-center">Loading Property...</div>;

    const totalNotifications = dueTasks.length + newSubmissions.length;
    const isNewUser = records.length === 0 && !hasSeenWelcome;

    return (
        <>
        <Toaster 
            position="top-center"
            toastOptions={{
                duration: 4000,
                style: {
                    background: '#1e293b',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
        />
        
        <div className="min-h-screen bg-emerald-50 font-sans pb-32">
            <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
                <div className="relative">
                    <button onClick={() => setIsSwitchingProp(!isSwitchingProp)} className="flex items-center gap-3 text-left hover:bg-emerald-50 p-2 -ml-2 rounded-xl transition-colors">
                        <Logo className="h-10 w-10"/>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-extrabold text-emerald-950 leading-none flex items-center">
                                {activeProperty.name}
                                <ChevronDown size={16} className="ml-1 text-slate-400"/>
                            </h1>
                            {activeProperty.address && (
                                <div className="flex items-center text-slate-500 mt-1">
                                    <MapPin size={10} className="mr-1" />
                                    <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[200px]">
                                        {activeProperty.address.street}, {activeProperty.address.city}, {activeProperty.address.state}
                                    </span>
                                </div>
                            )}
                        </div>
                    </button>
                    {isSwitchingProp && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50">
                            {properties.map(p => (<button key={p.id} onClick={() => handleSwitchProperty(p.id)} className={`w-full text-left px-3 py-3 rounded-xl flex items-center justify-between text-sm font-bold mb-1 ${activePropertyId === p.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>{p.name}{activePropertyId === p.id && <Check size={16} className="text-emerald-600"/>}</button>))}
                            <div className="border-t border-slate-100 my-1"></div>
                            <button onClick={() => { setIsSwitchingProp(false); setIsAddingProperty(true); }} className="w-full text-left px-3 py-3 rounded-xl flex items-center text-sm font-bold text-emerald-600 hover:bg-emerald-50"><PlusCircle size={16} className="mr-2"/> Add Property</button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 relative"><Bell size={20} className="text-slate-400"/>{totalNotifications > 0 && <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
                        {showNotifications && (
                            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50">
                                <h3 className="font-bold text-slate-800 mb-3 text-sm">Notifications</h3>
                                {totalNotifications === 0 ? (
                                    <p className="text-xs text-slate-400">No new notifications.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {dueTasks.slice(0, 3).map(task => (
                                            <div key={task.id} className="p-2 bg-amber-50 rounded-lg text-xs">
                                                <p className="font-bold text-amber-800">{task.item}</p>
                                                <p className="text-amber-600">Due in {task.diffDays} days</p>
                                            </div>
                                        ))}
                                        {newSubmissions.slice(0, 2).map(sub => (
                                            <div key={sub.id} className="p-2 bg-emerald-50 rounded-lg text-xs">
                                                <p className="font-bold text-emerald-800">New submission</p>
                                                <p className="text-emerald-600">{sub.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {showNotifications && <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>}
                    </div>
                    
                    <div className="relative">
                        <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-2"><Menu size={20} className="text-slate-400"/></button>
                        {showUserMenu && (
                            <>
                                <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50">
                                    <button onClick={() => signOut(auth)} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center"><LogOut size={16} className="mr-2"/> Sign Out</button>
                                    <div className="border-t border-slate-100 my-1"></div>
                                    <button onClick={handleDeleteAccount} className="w-full text-left px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center"><Trash2 size={16} className="mr-2"/> Delete Account</button>
                                </div>
                                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                
                {activeProperty.address && (
                    <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-emerald-100/50 flex items-center justify-center text-center">
                        <MapPin size={16} className="text-emerald-600 mr-2" />
                        <span className="font-bold text-emerald-900 text-lg">
                            {activeProperty.address.street}, {activeProperty.address.city}, {activeProperty.address.state}
                        </span>
                    </div>
                )}

                {isNewUser && activeTab === 'Dashboard' && (
                    <WelcomeScreen 
                        propertyName={activeProperty.name}
                        onAddRecord={() => openAddModal()}
                        onDismiss={handleDismissWelcome}
                    />
                )}
                
                {activeTab === 'Dashboard' && !isNewUser && (
                    <FeatureErrorBoundary label="Dashboard">
                        <Dashboard 
                            records={activePropertyRecords}
                            contractors={contractorsList} 
                            propertyName={activeProperty.name}
                            onScanReceipt={() => openAddModal()}
                            onNavigateToItems={() => setActiveTab('Items')}
                            onNavigateToContractors={() => setActiveTab('Contractors')}
                            onCreateContractorLink={() => setActiveTab('Contractors')}
                        />
                    </FeatureErrorBoundary>
                )}

                {activeTab === 'Items' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-3.5 text-slate-400 h-5 w-5" />
                                <input type="text" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-emerald-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"/>
                                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>}
                            </div>
                            <div className="relative min-w-[160px]">
                                <Filter className="absolute left-3 top-3.5 text-slate-400 h-5 w-5" />
                                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full pl-10 pr-8 py-3 bg-emerald-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none cursor-pointer">
                                    <option value="All">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            {/* Mass Delete Toggle */}
                            <button 
                                onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedRecords(new Set()); }}
                                className={`px-4 rounded-xl font-bold flex items-center justify-center transition-colors ${isSelectionMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <CheckSquare size={20} className="mr-2"/> {isSelectionMode ? 'Cancel' : 'Select'}
                            </button>
                        </div>

                        {/* Batch Action Bar */}
                        {isSelectionMode && selectedRecords.size > 0 && (
                            <div className="sticky top-20 z-30 bg-white p-4 rounded-xl border border-red-100 shadow-xl flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                                <span className="font-bold text-slate-700">{selectedRecords.size} items selected</span>
                                <button onClick={handleBatchDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center transition-colors">
                                    <Trash2 size={16} className="mr-2"/> Delete Selected
                                </button>
                            </div>
                        )}

                        {records.length === 0 ? (
                            <EmptyState 
                                icon={Package}
                                title="No items yet"
                                description="Start building your home's inventory. Add appliances, paint colors, systems, and more."
                                actions={
                                    <>
                                        <button onClick={() => openAddModal()} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 flex items-center justify-center">
                                            <Camera className="mr-2 h-5 w-5" /> Scan Receipt
                                        </button>
                                        <button onClick={() => openAddModal()} className="px-6 py-3 border border-emerald-200 text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition flex items-center justify-center">
                                            <Plus className="mr-2 h-5 w-5" /> Add Manually
                                        </button>
                                    </>
                                }
                            />
                        ) : filteredRecords.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                                <p>No items match your search.</p>
                                <button onClick={() => {setSearchTerm(''); setFilterCategory('All');}} className="mt-2 text-emerald-600 font-bold hover:underline">Clear Filters</button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {sortedCategories.map(category => (
                                    <details key={category} open className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition select-none list-none">
                                            <h3 className="font-bold text-emerald-950 flex items-center">
                                                {category} 
                                                <span className="ml-2 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    {groupedRecords[category].length}
                                                </span>
                                            </h3>
                                            <ChevronDown className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform" />
                                        </summary>
                                        <div className="p-4 pt-0 space-y-4 border-t border-slate-50">
                                            {groupedRecords[category].map(r => (
                                                <div key={r.id} className="relative flex items-start gap-3">
                                                    {isSelectionMode && (
                                                        <div className="pt-6">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedRecords.has(r.id)} 
                                                                onChange={() => toggleRecordSelection(r.id)}
                                                                className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="flex-grow min-w-0">
                                                        <RecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                ))}
                                
                                {records.length >= recordsLimit && (
                                    <button onClick={() => setRecordsLimit(p => p + 50)} className="w-full py-4 text-emerald-600 font-bold text-sm bg-white rounded-xl border border-slate-100 hover:bg-slate-50">Load More Items</button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'Contractors' && (
                    <FeatureErrorBoundary label="Contractors">
                        <RequestManager 
                            userId={user.uid} 
                            propertyName={activeProperty.name} 
                            propertyAddress={activeProperty.address} 
                            records={activePropertyRecords} 
                            onRequestImport={handleRequestImport}
                        />
                    </FeatureErrorBoundary>
                )}
                
                {activeTab === 'Property' && (
                    <FeatureErrorBoundary label="Property">
                        <div className="space-y-8">
                            <EnvironmentalInsights propertyProfile={activeProperty} />
                            <CountyData propertyProfile={activeProperty} />
                        </div>
                    </FeatureErrorBoundary>
                )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-full md:bottom-6 md:shadow-2xl md:border-slate-100">
                <button onClick={() => setActiveTab('Dashboard')} className={`flex flex-col items-center ${activeTab === 'Dashboard' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <LayoutDashboard size={24}/>
                    <span className="text-[10px] font-bold mt-1">Dashboard</span>
                </button>
                <button onClick={() => setActiveTab('Items')} className={`flex flex-col items-center ${activeTab === 'Items' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Package size={24}/>
                    <span className="text-[10px] font-bold mt-1">Items</span>
                </button>
                <div className="relative -top-8">
                    <button onClick={() => openAddModal()} className="h-16 w-16 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-colors active:scale-95">
                        <Plus size={32}/>
                    </button>
                </div>
                <button onClick={() => setActiveTab('Contractors')} className={`flex flex-col items-center ${activeTab === 'Contractors' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <Users size={24}/>
                    <span className="text-[10px] font-bold mt-1">Contractors</span>
                </button>
                <button onClick={() => setActiveTab('Property')} className={`flex flex-col items-center ${activeTab === 'Property' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <MapPin size={24}/>
                    <span className="text-[10px] font-bold mt-1">Property</span>
                </button>
            </nav>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={closeAddModal}></div>
                    <div className="relative w-full max-w-5xl bg-white sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto">
                         <WrapperAddRecord 
                            user={user} 
                            db={db} 
                            appId={appId} 
                            profile={profile}
                            activeProperty={activeProperty}
                            editingRecord={editingRecord} 
                            onClose={closeAddModal}
                            onSuccess={closeAddModal}
                        />
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

const WrapperAddRecord = ({ user, db, appId, profile, activeProperty, editingRecord, onClose, onSuccess }) => {
    // ... (WrapperAddRecord code is identical to previous, keeping here for brevity as it was provided before) ...
    // Note: Ensure WrapperAddRecord is included exactly as provided in previous steps
    const initial = { category: '', item: '', brand: '', model: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0], attachments: [] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (editingRecord) setNewRecord(editingRecord); }, [editingRecord]);
    const handleChange = (e) => setNewRecord({...newRecord, [e.target.name]: e.target.value});
    
    const handleAttachmentsChange = (files) => {
        const placeholders = files.map(f => ({ 
            name: f.name, 
            size: f.size, 
            type: f.type.includes('pdf') ? 'Document' : 'Photo', 
            fileRef: f 
        }));
        setNewRecord(p => ({ ...p, attachments: [...(p.attachments||[]), ...placeholders] }));
    };
    
    const handleBatchSave = async (items, file) => {
        if (!items || items.length === 0) return;
        if (!activeProperty || !activeProperty.id) {
            toast.error("No active property selected. Cannot save.");
            return;
        }
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
                    userId: user.uid,
                    propertyId: activeProperty.id,
                    propertyLocation: activeProperty.name,
                    category: item.category || 'Other',
                    item: item.item || 'Unknown Item',
                    brand: item.brand || '',
                    model: item.model || '',
                    area: item.area || '',
                    contractor: item.contractor || '',
                    contractorPhone: item.contractorPhone || '',
                    contractorEmail: item.contractorEmail || '',
                    notes: item.notes || '',
                    cost: item.cost ? parseFloat(item.cost) : 0, 
                    dateInstalled: item.dateInstalled || new Date().toISOString().split('T')[0],
                    maintenanceFrequency: 'none',
                    nextServiceDate: null, 
                    imageUrl: (sharedFileType === 'Photo') ? (sharedImageUrl || '') : '',
                    attachments: sharedImageUrl ? [{ 
                        name: 'Scanned Document', 
                        type: sharedFileType, 
                        url: sharedImageUrl 
                    }] : [],
                    timestamp: serverTimestamp()
                };
                batch.set(newDocRef, docData);
            });
            await batch.commit();
            setSaving(false);
            toast.success(`${items.length} item${items.length > 1 ? 's' : ''} added to your Krib!`);
            onSuccess();
        } catch (error) {
            console.error("Batch Save Error:", error);
            toast.error("Failed to save items: " + error.message);
            setSaving(false);
            throw error; 
        }
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        const processed = await Promise.all((newRecord.attachments||[]).map(async att => {
            if (att.fileRef) {
                try {
                    let file = att.fileRef;
                    if (file.type.startsWith('image/')) { 
                        const c = await compressImage(file); 
                        const r = await fetch(c); 
                        file = await r.blob(); 
                    }
                    const fileRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${Date.now()}_${att.name}`);
                    await uploadBytes(fileRef, file);
                    const url = await getDownloadURL(fileRef);
                    const isPdf = att.fileRef.type.includes('pdf');
                    return { 
                        name: att.name, 
                        size: att.size, 
                        type: isPdf ? 'Document' : 'Photo', 
                        url, 
                        dateAdded: new Date().toISOString() 
                    };
                } catch(e){ 
                    console.error(e);
                    toast.error("Upload failed for " + att.name);
                    return null; 
                }
            }
            return att;
        }));
        const finalAtts = processed.filter(Boolean);
        const cover = finalAtts.find(a=>a.type==='Photo')?.url||'';
        const { originalRequestId, id, ...data } = newRecord;
        const payload = { ...data, attachments: finalAtts, imageUrl: cover, userId: user.uid, propertyLocation: activeProperty.name, propertyId: activeProperty.id, nextServiceDate: calculateNextDate(data.dateInstalled, data.maintenanceFrequency) };
        try {
            if (editingRecord?.id) {
                await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), payload);
                toast.success("Record updated!");
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...payload, timestamp: serverTimestamp() });
                toast.success("Item added to your Krib!");
                if (originalRequestId) try { await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, originalRequestId), { status: 'archived' }); } catch(e){}
            }
            onSuccess();
        } catch (e) {
            toast.error("Save failed: " + e.message);
        } finally {
            setSaving(false); 
        }
    };

    return (
        <div className="relative">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-[2rem]">
                <h3 className="text-xl font-bold text-slate-800">{editingRecord ? 'Edit Item' : 'Add New Item'}</h3>
                <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
            </div>
            <AddRecordForm 
                onSave={handleSave} 
                onBatchSave={handleBatchSave} 
                isSaving={saving} 
                newRecord={newRecord} 
                onInputChange={handleChange} 
                onAttachmentsChange={handleAttachmentsChange} 
                isEditing={!!editingRecord} 
                onCancelEdit={onClose}
            />
        </div>
    );
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
