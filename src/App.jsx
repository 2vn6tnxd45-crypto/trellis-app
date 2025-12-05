import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { LogOut } from 'lucide-react';

// Config & Libs
import { auth, db } from './config/firebase';
import { appId } from './config/constants';
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

const AppContent = () => {
    // 1. Global State
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('View Records');
    
    // 2. Form/Edit State
    const [editingRecord, setEditingRecord] = useState(null);

    // 3. Contractor Mode Check
    const isContractor = new URLSearchParams(window.location.search).get('requestId');
    if (isContractor) return <ContractorView />;

    // 4. Auth & Data Listeners
    useEffect(() => {
        let unsubRecords = null; // Store listener cleanup function

        console.log("Initializing Auth Listener...");

        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth State Changed:", currentUser ? "User Logged In" : "No User");
            
            try {
                setUser(currentUser);

                if (currentUser) {
                    if (!appId) {
                        throw new Error("appId is missing in constants.js");
                    }

                    // Fetch Profile
                    console.log("Fetching profile for:", currentUser.uid);
                    const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    
                    if (profileSnap.exists()) {
                        setProfile(profileSnap.data());
                    } else {
                        console.log("No profile found, redirecting to onboarding.");
                        setProfile(null);
                    }
                    
                    // Listen to Records
                    // Clean up existing listener if any
                    if (unsubRecords) unsubRecords();

                    const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'));
                    unsubRecords = onSnapshot(q, 
                        (snap) => {
                            setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                        },
                        (error) => {
                            console.error("Firestore Listener Error:", error);
                        }
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
                console.log("Loading complete.");
                setLoading(false);
            }
        });

        // Cleanup on unmount
        return () => {
            unsubAuth();
            if (unsubRecords) unsubRecords();
        };
    }, []);

    // 5. Handlers
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

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center text-sky-600 bg-sky-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div>
            <p className="font-medium animate-pulse">Initializing HausKey...</p>
        </div>
    );

    if (!user) return <AuthScreen onLogin={handleAuth} onGoogleLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} onAppleLogin={() => signInWithPopup(auth, new OAuthProvider('apple.com'))} onGuestLogin={() => signInAnonymously(auth)} />;
    if (!profile) return <SetupPropertyForm onSave={handleSaveProfile} onSignOut={() => signOut(auth)} />;

    return (
        <div className="min-h-screen bg-sky-50 p-4 sm:p-8 font-sans">
            <header className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center relative">
                <div className="absolute top-0 right-0 flex space-x-3 sm:mt-2 z-10">
                    <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-sky-600"><LogOut size={18}/></button>
                </div>
                <div className="text-center sm:text-left flex items-center gap-4">
                    <Logo className="h-16 w-16 rounded-3xl shadow-sm"/>
                    <div>
                        <h1 className="text-4xl font-bold text-sky-900">Haus<span className="text-sky-500 font-normal">Key</span></h1>
                        <p className="text-slate-500 font-medium">{profile.name}</p>
                    </div>
                </div>
            </header>

            <nav className="flex justify-center mb-8 w-full md:w-auto mx-auto overflow-x-auto pb-2 px-4 md:px-0">
                <div className="flex min-w-max bg-white rounded-2xl shadow-sm border border-slate-100 p-1">
                    {['View Records', 'Maintenance', 'Add Record', 'Requests', 'Report', 'Insights'].map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); if(tab !== 'Add Record') setEditingRecord(null); }} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab ? 'bg-sky-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="max-w-4xl mx-auto pb-20">
                {activeTab === 'View Records' && (
                    <div className="space-y-6">
                        {records.length === 0 ? <div className="text-center p-10 text-slate-400">No records found.</div> : 
                        records.map(r => <RecordCard key={r.id} record={r} onDeleteClick={handleDeleteRecord} onEditClick={r => { setEditingRecord(r); setActiveTab('Add Record'); }} />)}
                    </div>
                )}
                {activeTab === 'Maintenance' && <MaintenanceDashboard records={records} onCompleteTask={() => {}} onAddStandardTask={() => {}} />}
                {activeTab === 'Add Record' && (
                    <WrapperAddRecord 
                        user={user} 
                        db={db} 
                        appId={appId} 
                        profile={profile}
                        editingRecord={editingRecord} 
                        onClearEdit={() => setEditingRecord(null)}
                        onSuccess={() => setActiveTab('View Records')}
                    />
                )}
                {activeTab === 'Requests' && <RequestManager userId={user.uid} propertyName={profile.name} />}
                {activeTab === 'Report' && <PedigreeReport propertyProfile={profile} records={records} />}
                {activeTab === 'Insights' && <EnvironmentalInsights propertyProfile={profile} />}
            </main>
        </div>
    );
};

// Helper Wrapper to manage Form State
const WrapperAddRecord = ({ user, db, appId, profile, editingRecord, onClearEdit, onSuccess }) => {
    const initial = { category: '', item: '', brand: '', model: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (editingRecord) setNewRecord(editingRecord); }, [editingRecord]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        let imageUrl = newRecord.imageUrl || '';
        if (file) imageUrl = await compressImage(file);
        
        const data = { 
            ...newRecord, 
            imageUrl, 
            userId: user.uid, 
            propertyLocation: profile.name,
            nextServiceDate: calculateNextDate(newRecord.dateInstalled, newRecord.maintenanceFrequency) 
        };

        if (editingRecord) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...data, timestamp: serverTimestamp() });
        
        setSaving(false);
        setNewRecord(initial);
        setFile(null);
        onClearEdit();
        onSuccess();
    };

    const handleBatchSave = async (items) => {
         const batch = writeBatch(db);
         items.forEach(item => {
             const docRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'));
             batch.set(docRef, { 
                 ...item, 
                 userId: user.uid, 
                 propertyLocation: profile.name, 
                 timestamp: serverTimestamp(),
                 nextServiceDate: calculateNextDate(item.dateInstalled, item.maintenanceFrequency)
             });
         });
         await batch.commit();
         onSuccess();
    }

    return <AddRecordForm onSave={handleSave} onBatchSave={handleBatchSave} isSaving={saving} newRecord={newRecord} onInputChange={e => setNewRecord({...newRecord, [e.target.name]: e.target.value})} onFileChange={e => setFile(e.target.files[0])} isEditing={!!editingRecord} onCancelEdit={() => { onClearEdit(); setNewRecord(initial); }} />;
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
