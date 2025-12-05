// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { LogOut, Home, Camera, Search, Filter, XCircle, Wrench, Link as LinkIcon, BarChart3, Plus, X, FileText, Bell, ChevronDown, Building, PlusCircle, Check, Table, FileJson } from 'lucide-react';

// Config & Libs
import { auth, db } from './config/firebase';
import { appId, REQUESTS_COLLECTION_PATH, CATEGORIES } from './config/constants';
import { calculateNextDate } from './lib/utils';
import { compressImage, fileToBase64 } from './lib/images';

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
    
    // NAVIGATION & UI STATE
    const [activeTab, setActiveTab] = useState('Log'); 
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [dueTasks, setDueTasks] = useState([]);
    
    // PROPERTY SWITCHING STATE
    const [activePropertyId, setActivePropertyId] = useState(null);
    const [isSwitchingProp, setIsSwitchingProp] = useState(false);
    const [isAddingProperty, setIsAddingProperty] = useState(false);

    // 2. Form/Edit State
    const [editingRecord, setEditingRecord] = useState(null);

    // 3. Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    // 4. Contractor Mode Check
    const isContractor = new URLSearchParams(window.location.search).get('requestId');
    if (isContractor) return <ContractorView />;

    // Helper: Get Active Property Object
    const getPropertiesList = () => {
        if (!profile) return [];
        if (profile.properties && Array.isArray(profile.properties)) return profile.properties;
        if (profile.name) return [{ id: 'legacy', name: profile.name, address: profile.address, coordinates: profile.coordinates }];
        return [];
    };

    const properties = getPropertiesList();
    const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0] || null;

    // Helper: Get Records for Active Property (for Requests context)
    const activePropertyRecords = records.filter(r => 
        r.propertyId === activeProperty?.id || 
        (!r.propertyId && activeProperty?.id === 'legacy')
    );

    // 5. Auth & Data Listeners
    useEffect(() => {
        let unsubRecords = null;
        const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
            try {
                setUser(currentUser);
                if (currentUser) {
                    if (!appId) throw new Error("appId is missing in constants.js");
                    
                    // Fetch Profile
                    const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    
                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        setProfile(data);
                        if (data.activePropertyId) setActivePropertyId(data.activePropertyId);
                        else if (data.properties && data.properties.length > 0) setActivePropertyId(data.properties[0].id);
                        else setActivePropertyId('legacy');
                    } else {
                        setProfile(null);
                    }
                    
                    // Fetch Records
                    if (unsubRecords) unsubRecords();
                    const q = query(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'house_records'));
                    unsubRecords = onSnapshot(q, 
                        (snap) => {
                            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                            setRecords(data);
                        },
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

    // Update Due Tasks
    useEffect(() => {
        if (!activeProperty || records.length === 0) {
            setDueTasks([]);
            return;
        }

        const now = new Date();
        const upcoming = activePropertyRecords.filter(r => {
            if (!r.nextServiceDate) return false;
            const due = new Date(r.nextServiceDate);
            const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
            return diffDays <= 30;
        }).map(r => {
            const due = new Date(r.nextServiceDate);
            const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
            return { ...r, diffDays };
        }).sort((a,b) => a.diffDays - b.diffDays);
        
        setDueTasks(upcoming);
    }, [records, activeProperty, activePropertyRecords]); // added activePropertyRecords to dependency

    // 6. Logic & Handlers
    const filteredRecords = activePropertyRecords.filter(r => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (r.item || '').toLowerCase().includes(searchLower) || (r.brand || '').toLowerCase().includes(searchLower) || (r.model || '').toLowerCase().includes(searchLower);
        const matchesCategory = filterCategory === 'All' || r.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const handleAuth = async (email, pass, isSignUp) => isSignUp ? createUserWithEmailAndPassword(auth, email, pass) : signInWithEmailAndPassword(auth, email, pass);
    
    const handleSaveProperty = async (formData) => {
        const newProp = { 
            id: crypto.randomUUID(),
            name: formData.get('propertyName'), 
            address: { street: formData.get('streetAddress'), city: formData.get('city'), state: formData.get('state'), zip: formData.get('zip') },
            coordinates: { lat: parseFloat(formData.get('lat')), lon: parseFloat(formData.get('lon')) },
            dateCreated: new Date().toISOString()
        };

        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');

        if (!profile) {
            const initialData = { activePropertyId: newProp.id, properties: [newProp] };
            await setDoc(profileRef, initialData);
            setProfile(initialData);
            setActivePropertyId(newProp.id);
        } else {
            let updatedProperties = profile.properties || [];
            if (!profile.properties && profile.name) {
                updatedProperties = [{ id: 'legacy', name: profile.name, address: profile.address, coordinates: profile.coordinates }];
            }
            updatedProperties.push(newProp);
            await updateDoc(profileRef, { properties: updatedProperties, activePropertyId: newProp.id });
            setProfile({ ...profile, properties: updatedProperties, activePropertyId: newProp.id });
            setActivePropertyId(newProp.id);
        }
        setIsAddingProperty(false);
    };

    const handleSwitchProperty = async (propId) => {
        setActivePropertyId(propId);
        setIsSwitchingProp(false);
        try { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), { activePropertyId: propId }); } catch (e) { console.warn("Failed to save active prop", e); }
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
                ...suggestion, 
                userId: user.uid, 
                propertyLocation: activeProperty?.name,
                propertyId: activeProperty?.id,
                dateInstalled: today, 
                nextServiceDate: calculateNextDate(today, suggestion.maintenanceFrequency), 
                timestamp: serverTimestamp()
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
        setIsAddModalOpen(true);
    };

    const openAddModal = (recordToEdit = null) => {
        setEditingRecord(recordToEdit);
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setEditingRecord(null);
    };

    // Export Data Handler
    const handleExport = (format) => {
        if (!activeProperty || filteredRecords.length === 0) {
            alert("No records to export.");
            return;
        }

        const dataToExport = filteredRecords.map(r => ({
            Date_Installed: r.dateInstalled || '',
            Category: r.category || '',
            Item: r.item || '',
            Brand: r.brand || '',
            Model: r.model || '',
            Serial_Number: r.serialNumber || '',
            Area: r.area || '',
            Contractor: r.contractor || '',
            Maintenance_Freq: r.maintenanceFrequency || '',
            Notes: r.notes || ''
        }));

        let content = '';
        let mimeType = '';
        let extension = '';

        if (format === 'json') {
            content = JSON.stringify(dataToExport, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        } else {
            // CSV
            const headers = Object.keys(dataToExport[0]);
            const csvRows = [
                headers.join(','), 
                ...dataToExport.map(row => headers.map(fieldName => {
                    const val = row[fieldName] ? String(row[fieldName]).replace(/"/g, '""') : '';
                    return `"${val}"`;
                }).join(','))
            ];
            content = csvRows.join('\n');
            mimeType = 'text/csv';
            extension = 'csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `HausKey_Export_${activeProperty.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-sky-600 bg-sky-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mb-4"></div></div>;
    if (!user) return <AuthScreen onLogin={handleAuth} onGoogleLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} onAppleLogin={() => signInWithPopup(auth, new OAuthProvider('apple.com'))} onGuestLogin={() => signInAnonymously(auth)} />;
    
    if (!profile && !loading) return <SetupPropertyForm onSave={handleSaveProperty} onSignOut={() => signOut(auth)} />;
    if (isAddingProperty) return (
        <div className="relative">
            <button onClick={() => setIsAddingProperty(false)} className="absolute top-6 left-6 z-50 text-slate-500 font-bold flex items-center bg-white px-4 py-2 rounded-xl shadow-sm"><X className="mr-2 h-4 w-4"/> Cancel</button>
            <SetupPropertyForm onSave={handleSaveProperty} onSignOut={() => {}} />
        </div>
    );

    if (!activeProperty) return <div className="p-10 text-center">Loading Property...</div>;

    return (
        <div className="min-h-screen bg-sky-50 font-sans pb-24 md:pb-0">
            
            {/* Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
                
                {/* Property Switcher */}
                <div className="relative">
                    <button onClick={() => setIsSwitchingProp(!isSwitchingProp)} className="flex items-center gap-3 text-left hover:bg-slate-50 p-2 -ml-2 rounded-xl transition-colors">
                        <Logo className="h-10 w-10"/>
                        <div>
                            <h1 className="text-xl font-bold text-sky-900 leading-none flex items-center">
                                Haus<span className="text-sky-500 font-normal">Key</span>
                                <ChevronDown size={16} className="ml-1 text-slate-400"/>
                            </h1>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider max-w-[150px] truncate">{activeProperty.name}</p>
                        </div>
                    </button>

                    {/* Dropdown */}
                    {isSwitchingProp && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsSwitchingProp(false)}></div>
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <p className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">My Properties</p>
                                {properties.map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => handleSwitchProperty(p.id)}
                                        className={`w-full text-left px-3 py-3 rounded-xl flex items-center justify-between text-sm font-bold mb-1 ${activePropertyId === p.id ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <span className="flex items-center truncate"><Building size={16} className="mr-2 opacity-50"/> {p.name}</span>
                                        {activePropertyId === p.id && <Check size={16} className="text-sky-600"/>}
                                    </button>
                                ))}
                                <div className="border-t border-slate-100 my-1"></div>
                                <button onClick={() => { setIsSwitchingProp(false); setIsAddingProperty(true); }} className="w-full text-left px-3 py-3 rounded-xl flex items-center text-sm font-bold text-sky-600 hover:bg-sky-50 transition-colors">
                                    <PlusCircle size={16} className="mr-2"/> Add New Property
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Notification Bell */}
                    <div className="relative">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-400 hover:text-sky-600 relative">
                            <Bell size={20}/>
                            {dueTasks.length > 0 && <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                        </button>
                        
                        {showNotifications && (
                            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50">
                                <h3 className="font-bold text-slate-800 mb-3 text-sm">Upcoming Tasks ({dueTasks.length})</h3>
                                {dueTasks.length === 0 ? (
                                    <p className="text-xs text-slate-400">All caught up! No tasks due.</p>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {dueTasks.map(task => (
                                            <div key={task.id} className="text-xs p-3 bg-sky-50 rounded-xl border border-sky-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-slate-700">{task.item}</span>
                                                    <span className={`font-bold ${task.diffDays < 0 ? 'text-red-500' : 'text-sky-600'}`}>
                                                        {task.diffDays < 0 ? `${Math.abs(task.diffDays)}d overdue` : `${task.diffDays} days`}
                                                    </span>
                                                </div>
                                                <p className="text-slate-400 mt-1">{task.category}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <button onClick={() => setActiveTab('Maintenance')} className="w-full text-center text-xs font-bold text-sky-600 hover:text-sky-800">Go to Maintenance</button>
                                </div>
                            </div>
                        )}
                        {showNotifications && <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>}
                    </div>

                    <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500 transition"><LogOut size={20}/></button>
                </div>
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

                {activeTab === 'Maintenance' && <MaintenanceDashboard records={filteredRecords} onCompleteTask={handleCompleteTask} onAddStandardTask={handleAddStandardTask} />}
                {activeTab === 'Requests' && (
                    <RequestManager 
                        userId={user.uid} 
                        propertyName={activeProperty.name} 
                        propertyAddress={activeProperty.address} // Shared Context
                        records={activePropertyRecords}          // Shared Context
                        onRequestImport={handleRequestImport}
                    />
                )}
                
                {activeTab === 'Insights' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                        {/* Reports & Exports Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-sky-900 mb-2">Pedigree Report</h2>
                                    <p className="text-slate-500 text-sm mb-6">Generate a printable PDF of your home's history.</p>
                                </div>
                                <button onClick={() => setActiveTab('ReportView')} className="w-full py-3 bg-sky-50 text-sky-700 font-bold rounded-xl border border-sky-100 hover:bg-sky-100 transition flex items-center justify-center">
                                    <FileText className="mr-2 h-5 w-5"/> View Report
                                </button>
                            </div>

                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-sky-900 mb-2">Export Data</h2>
                                    <p className="text-slate-500 text-sm mb-6">Download your records for backup or external analysis.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => handleExport('csv')} className="flex-1 py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center">
                                        <Table className="mr-2 h-5 w-5"/> CSV
                                    </button>
                                    <button onClick={() => handleExport('json')} className="flex-1 py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center">
                                        <FileJson className="mr-2 h-5 w-5"/> JSON
                                    </button>
                                </div>
                            </div>
                        </div>
                        <EnvironmentalInsights propertyProfile={activeProperty} />
                    </div>
                )}
                
                {activeTab === 'ReportView' && (
                    <div>
                        <button onClick={() => setActiveTab('Insights')} className="mb-4 text-sm font-bold text-slate-500 hover:text-sky-600 flex items-center"><X className="mr-1 h-4 w-4"/> Close Report</button>
                        <PedigreeReport propertyProfile={activeProperty} records={filteredRecords} />
                    </div>
                )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 md:max-w-md md:left-1/2 md:-translate-x-1/2 md:rounded-full md:bottom-6 md:shadow-2xl md:border-slate-100">
                <button onClick={() => setActiveTab('Log')} className={`flex flex-col items-center ${activeTab === 'Log' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Home size={24} strokeWidth={activeTab === 'Log' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Log</span>
                </button>
                <button onClick={() => setActiveTab('Maintenance')} className={`flex flex-col items-center ${activeTab === 'Maintenance' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Wrench size={24} strokeWidth={activeTab === 'Maintenance' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold mt-1">Care</span>
                </button>
                
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

            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={() => {}}></div>
                    <div className="relative w-full max-w-lg bg-white sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl pointer-events-auto h-[90vh] sm:h-auto overflow-y-auto">
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
    );
};

// Helper Wrapper
const WrapperAddRecord = ({ user, db, appId, profile, activeProperty, editingRecord, onClose, onSuccess }) => {
    const initial = { category: '', item: '', brand: '', model: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0], attachments: [] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => { 
        if (editingRecord) setNewRecord(editingRecord); 
    }, [editingRecord]);

    const handleChange = (e) => {
        setNewRecord({...newRecord, [e.target.name]: e.target.value});
        setIsDirty(true);
    };

    const handleAttachmentsChange = (newFiles) => {
        const placeholders = newFiles.map(f => ({ name: f.name, size: f.size, type: 'Photo', fileRef: f }));
        setNewRecord(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...placeholders] }));
        setIsDirty(true);
    };

    const handleCloseSafe = () => {
        if (isDirty && confirm("You have unsaved changes. Discard?")) onClose();
        else if (!isDirty) onClose();
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        
        const processedAttachments = [...(newRecord.attachments || [])];
        const processingPromises = processedAttachments.map(async (att) => {
            if (att.fileRef) {
                let url = '';
                if (att.fileRef.type.startsWith('image/')) url = await compressImage(att.fileRef);
                else { url = await fileToBase64(att.fileRef); url = `data:${att.fileRef.type};base64,${url}`; }
                return { name: att.name, size: att.size, type: att.type, url: url, dateAdded: new Date().toISOString() };
            }
            return att; 
        });

        const finalAttachments = await Promise.all(processingPromises);
        const coverImage = finalAttachments.find(a => a.type === 'Photo')?.url || '';

        const { originalRequestId, id, ...recordData } = newRecord;

        const data = { 
            ...recordData, 
            attachments: finalAttachments,
            imageUrl: coverImage, 
            userId: user.uid, 
            propertyLocation: activeProperty.name, 
            propertyId: activeProperty.id,
            nextServiceDate: calculateNextDate(recordData.dateInstalled, recordData.maintenanceFrequency) 
        };

        if (editingRecord && editingRecord.id) {
            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...data, timestamp: serverTimestamp() });
            if (originalRequestId) try { await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, originalRequestId), { status: 'archived' }); } catch (e) {}
        }
        
        setSaving(false);
        setIsDirty(false);
        onSuccess();
    };

    const handleBatchSave = async (items) => {
         const batch = writeBatch(db);
         items.forEach(item => {
             const docRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'));
             batch.set(docRef, { ...item, userId: user.uid, propertyLocation: activeProperty.name, propertyId: activeProperty.id, timestamp: serverTimestamp(), nextServiceDate: calculateNextDate(item.dateInstalled, item.maintenanceFrequency) });
         });
         await batch.commit();
         setIsDirty(false);
         onSuccess();
    }

    return (
        <div className="relative">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white sticky top-0 z-10 rounded-t-[2rem]">
                <h3 className="text-xl font-bold text-slate-800">{editingRecord ? 'Edit Record' : 'Add New Record'}</h3>
                <button onClick={handleCloseSafe} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
            </div>
            
            <AddRecordForm 
                onSave={handleSave} 
                onBatchSave={handleBatchSave} 
                isSaving={saving} 
                newRecord={newRecord} 
                onInputChange={handleChange} 
                onAttachmentsChange={handleAttachmentsChange} 
                isEditing={!!editingRecord} 
                onCancelEdit={handleCloseSafe}
            />
        </div>
    );
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
