// src/App.jsx
import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { LogOut, Home, Camera, Search, Filter, XCircle, Wrench, Link as LinkIcon, BarChart3, Plus, X, FileText } from 'lucide-react'; // Updated Icons

// Config & Libs
import { auth, db } from './config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, CATEGORIES } from './config/constants';
import { calculateNextDate } from './lib/utils';
import { compressImage } from './lib/images';

// Components
import { Logo } from './components/common/Logo';
import { AuthScreen } from './features/auth/AuthScreen';
import { SetupPropertyForm } from './features/onboarding/SetupPropertyForm';
import { RecordCard } from './features/records/RecordCard';
import { AddRecordForm } from './features/records/AddRecordForm';
import { MaintenanceDashboard } from './features/dashboard/MaintenanceDashboard';
import { RequestManager } from './features/requests/RequestManager';
import { ContractorView } from './features/requests/ContractorView';
import { PedigreeReport } from './features/report/PedigreeReport';
import { EnvironmentalInsights } from './features/dashboard/EnvironmentalInsights';

// Simple Error Boundary
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

// Empty State Component
const EmptyState = ({ onAddFirst, onScanReceipt }) => (
    <div className="text-center py-16 px-8">
        <div className="bg-sky-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <Home className="h-12 w-12 text-sky-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Welcome to HausKey!</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Start building your home's digital pedigree. Add your first record manually or scan a receipt.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onScanReceipt} className="px-6 py-3 bg-sky-900 text-white rounded-xl font-bold hover:bg-sky-800 transition shadow-lg shadow-sky-900/20">
                <Camera className="inline mr-2 h-5 w-5" /> Scan a Receipt
            </button>
            <button onClick={onAddFirst} className="px-6 py-3 border border-sky-200 text-sky-700 rounded-xl font-bold hover:bg-sky-50 transition">
                Add Manually
            </button>
        </div>
    </div>
);

const AppContent = () => {
    // 1. Global State
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // NAVIGATION STATE
    const [activeTab, setActiveTab] = useState('Log'); // 'Log', 'Maintenance', 'Requests', 'Insights'
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // 2. Form/Edit State
    const [editingRecord, setEditingRecord] = useState(null);

    // 3. Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    // 4. Contractor Mode Check
    const isContractor = new URLSearchParams(window.location.search).get('requestId');
    if (isContractor) return <ContractorView />;

    // 5. Auth & Data Listeners
    useEffect(() => {
        let unsubRecords = null;
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            try {
                setUser(currentUser);
                if (currentUser) {
                    if (!appId) throw new Error("appId is missing in constants.js");
                    const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) setProfile(profileSnap.data());
                    else setProfile(null);
                    
                    if (unsubRecords) unsubRecords();
                    const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'));
                    unsubRecords = onSnapshot(q, 
                        (snap) => setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
                        (error) => console.error("Firestore Listener Error:", error)
                    );
                } else {
                    setProfile(null);
                    setRecords([]);
                    if (unsubRecords) unsubRecords();
                }
            } catch (error) {
                console.error("Critical Data Loading Error:", error);
                alert("Error loading data: " + error.message);
            } finally {
                setLoading(false);
            }
        });
        return () => { unsubAuth(); if (unsubRecords) unsubRecords(); };
    }, []);

    // 6. Logic & Handlers
    const filteredRecords = records.filter(r => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (r.item || '').toLowerCase().includes(searchLower) || (r.brand || '').toLowerCase().includes(searchLower) || (r.model || '').toLowerCase().includes(searchLower);
        const matchesCategory = filterCategory === 'All' || r.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const handleAuth = async (email, pass, isSignUp) => isSignUp ? createUserWithEmailAndPassword(auth, email, pass) : signInWithEmailAndPassword(auth, email, pass);
    
    const handleSaveProfile = async (formData) => {
        const data = { 
            name: formData.get('propertyName'), 
            address: { street: formData.get('streetAddress'), city: formData.get('city'), state: formData.get('state'), zip: formData.get('zip') },
            coordinates: { lat: parseFloat(formData.get('lat')), lon: parseFloat(formData.get('lon')) }
        };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), data);
        setProfile(data);
    };

    const handleDeleteRecord = async (id) => {
        if(confirm("Delete this record permanently?")) {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', id));
        }
    };

    const handleCompleteTask = async (task) => {
        const today = new Date().toISOString().split('T')[0];
        const newNextDate = calculateNextDate(today, task.maintenanceFrequency);
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', task.id), { lastServiceDate: today, nextServiceDate: newNextDate });
        } catch (error) { console.error("Failed to complete task:", error); }
    };
    
    const handleAddStandardTask = async (suggestion) => {
        const today = new Date().toISOString().split('T')[0];
        try {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), {
                ...suggestion, userId: user.uid, propertyLocation: profile.name, dateInstalled: today, nextServiceDate: calculateNextDate(today, suggestion.maintenanceFrequency), timestamp: serverTimestamp()
            });
        } catch (error) { console.error("Failed to add standard task:", error); }
    };

    const handleRequestImport = (request) => {
        const recordToImport = {
            ...request, id: null, originalRequestId: request.id,
            dateInstalled: request.dateInstalled || new Date().toISOString().split('T')[0],
            maintenanceFrequency: request.maintenanceFrequency || 'none'
        };
        setEditingRecord(recordToImport);
        setIsAddModalOpen(true); // Open Modal
    };

    // Open/Close Modal Handlers
    const openAddModal = (recordToEdit = null) => {
        setEditingRecord(recordToEdit);
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setEditingRecord(null);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-sky-600 bg-sky-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div></div>;
    if (!user) return <AuthScreen onLogin={handleAuth} onGoogleLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} onAppleLogin={() => signInWithPopup(auth, new OAuthProvider('apple.com'))} onGuestLogin={() => signInAnonymously(auth)} />;
    if (!profile) return <SetupPropertyForm onSave={handleSaveProfile} onSignOut={() => signOut(auth)} />;

    return (
        <div className="min-h-screen bg-sky-50 font-sans pb-24 md:pb-0"> {/* Added padding bottom for mobile nav */}
            
            {/* Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <Logo className="h-10 w-10"/>
                    <div className="hidden sm:block">
                        <h1 className="text-xl font-bold text-sky-900 leading-none">Haus<span className="text-sky-500 font-normal">Key</span></h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{profile.name}</p>
                    </div>
                </div>
                <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition"><LogOut size={20}/></button>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8">
                {activeTab === 'Log' && (
                    <div className="space-y-6">
                        {/* Search Bar */}
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-3.5 text-slate-400 h-5 w-5" />
                                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all"/>
                                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>}
                            </div>
                            <div className="relative min-w-[160px]">
                                <Filter className="absolute left-3 top-3.5 text-slate-400 h-5 w-5" />
                                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none cursor-pointer">
                                    <option value="All">All Categories</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Record List */}
                        {records.length === 0 ? (
                            <EmptyState onAddFirst={() => openAddModal()} onScanReceipt={() => openAddModal()} />
                        ) : filteredRecords.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                                <p>No records match your search.</p>
                                <button onClick={() => {setSearchTerm(''); setFilterCategory('All');}} className="mt-2 text-sky-600 font-bold hover:underline">Clear Filters</button>
                            </div>
                        ) : (
                            filteredRecords.map(r => (
                                <RecordCard key={r.id} record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'Maintenance' && <MaintenanceDashboard records={records} onCompleteTask={handleCompleteTask} onAddStandardTask={handleAddStandardTask} />}
                {activeTab === 'Requests' && <RequestManager userId={user.uid} propertyName={profile.name} onRequestImport={handleRequestImport}/>}
                
                {activeTab === 'Insights' && (
                    <div className="space-y-8">
                        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-sky-900 mb-2">Pedigree Report</h2>
                                <p className="text-slate-500 text-sm">Generate a printable PDF of your home's history.</p>
                            </div>
                            <button onClick={() => setActiveTab('ReportView')} className="px-6 py-3 bg-sky-50 text-sky-700 font-bold rounded-xl border border-sky-100 hover:bg-sky-100 transition"><FileText className="inline mr-2 h-5 w-5"/> View Report</button>
                        </div>
                        <EnvironmentalInsights propertyProfile={profile} />
                    </div>
                )}
                
                {/* Hidden Tab for Report View */}
                {activeTab === 'ReportView' && (
                    <div>
                        <button onClick={() => setActiveTab('Insights')} className="mb-4 text-sm font-bold text-slate-500 hover:text-sky-600 flex items-center"><X className="mr-1 h-4 w-4"/> Close Report</button>
                        <PedigreeReport propertyProfile={profile} records={records} />
                    </div>
                )}
            </main>

            {/* Mobile/Responsive Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-full md:bottom-6 md:shadow-2xl md:border-slate-100">
                <button onClick={() => setActiveTab('Log')} className={`flex flex-col items-center ${activeTab === 'Log' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Home size={24} strokeWidth={activeTab === 'Log' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Log</span>
                </button>
                <button onClick={() => setActiveTab('Maintenance')} className={`flex flex-col items-center ${activeTab === 'Maintenance' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Wrench size={24} strokeWidth={activeTab === 'Maintenance' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Care</span>
                </button>
                
                {/* Floating Add Button in Nav */}
                <div className="relative -top-8">
                    <button onClick={() => openAddModal()} className="h-16 w-16 bg-sky-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-sky-900/30 hover:scale-105 transition-transform active:scale-95">
                        <Plus size={32} />
                    </button>
                </div>

                <button onClick={() => setActiveTab('Requests')} className={`flex flex-col items-center ${activeTab === 'Requests' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <LinkIcon size={24} strokeWidth={activeTab === 'Requests' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Pros</span>
                </button>
                <button onClick={() => setActiveTab('Insights')} className={`flex flex-col items-center ${activeTab === 'Insights' || activeTab === 'ReportView' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <BarChart3 size={24} strokeWidth={activeTab === 'Insights' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Insights</span>
                </button>
            </nav>

            {/* Add Record Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={() => { /* Click outside to close handled in Wrapper */ }}></div>
                    <div className="relative w-full max-w-lg bg-white sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl pointer-events-auto h-[90vh] sm:h-auto overflow-y-auto">
                         <WrapperAddRecord 
                            user={user} 
                            db={db} 
                            appId={appId} 
                            profile={profile}
                            editingRecord={editingRecord} 
                            onClose={closeAddModal}
                            onSuccess={closeAddModal}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Wrapper to manage Form State & Logic
const WrapperAddRecord = ({ user, db, appId, profile, editingRecord, onClose, onSuccess }) => {
    const initial = { category: '', item: '', brand: '', model: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => { 
        if (editingRecord) setNewRecord(editingRecord); 
    }, [editingRecord]);

    const handleChange = (e) => {
        setNewRecord({...newRecord, [e.target.name]: e.target.value});
        setIsDirty(true);
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setIsDirty(true);
    };

    const handleCloseSafe = () => {
        if (isDirty) {
            if (confirm("You have unsaved changes. Are you sure you want to discard them?")) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        let imageUrl = newRecord.imageUrl || '';
        if (file) imageUrl = await compressImage(file);
        
        const { originalRequestId, id, ...recordData } = newRecord;

        const data = { 
            ...recordData, 
            imageUrl, 
            userId: user.uid, 
            propertyLocation: profile.name,
            nextServiceDate: calculateNextDate(recordData.dateInstalled, recordData.maintenanceFrequency) 
        };

        if (editingRecord && editingRecord.id) {
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...data, timestamp: serverTimestamp() });
            if (originalRequestId) {
                try { await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, originalRequestId), { status: 'archived' }); } catch (e) { console.error(e); }
            }
        }
        
        setSaving(false);
        setIsDirty(false); // Clear dirty flag before success
        onSuccess();
    };

    const handleBatchSave = async (items) => {
         const batch = writeBatch(db);
         items.forEach(item => {
             const docRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'));
             batch.set(docRef, { ...item, userId: user.uid, propertyLocation: profile.name, timestamp: serverTimestamp(), nextServiceDate: calculateNextDate(item.dateInstalled, item.maintenanceFrequency) });
         });
         await batch.commit();
         setIsDirty(false);
         onSuccess();
    }

    return (
        <div className="relative">
             {/* Header for Modal */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-[2rem]">
                <h3 className="text-xl font-bold text-slate-800">{editingRecord ? 'Edit Record' : 'Add New Record'}</h3>
                <button onClick={handleCloseSafe} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
            </div>
            
            {/* The Form */}
            <AddRecordForm 
                onSave={handleSave} 
                onBatchSave={handleBatchSave} 
                isSaving={saving} 
                newRecord={newRecord} 
                onInputChange={handleChange} 
                onFileChange={handleFileChange} 
                isEditing={!!editingRecord} 
                onCancelEdit={handleCloseSafe}
            />
        </div>
    );
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
