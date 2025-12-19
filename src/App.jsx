// src/App.jsx
import React, { useMemo } from 'react';
import { signOut, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { doc, updateDoc, writeBatch, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'; 
import { Bell, ChevronDown, Check, ArrowLeft, Trash2, Menu, Plus, X, Home, MapPin } from 'lucide-react'; 
import toast, { Toaster } from 'react-hot-toast';

import { auth, db, storage } from './config/firebase';
import { appId } from './config/constants';
import { fileToBase64 } from './lib/images';
import { calculateNextDate } from './lib/utils';

// Feature Imports
import { useGemini } from './hooks/useGemini';
import { useAppLogic } from './hooks/useAppLogic'; 
import { RecordEditorModal } from './features/records/RecordEditorModal';
import { ProgressiveDashboard } from './features/dashboard/ProgressiveDashboard';
import { MaintenanceDashboard } from './features/dashboard/MaintenanceDashboard'; 
import { SmartScanner } from './features/scanner/SmartScanner';
import { CelebrationRenderer, useCelebrations } from './features/celebrations/CelebrationMoments';

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
    const celebrations = useCelebrations();
    const { scanReceipt } = useGemini();
    
    // Use the Logic Hook
    const app = useAppLogic(celebrations);
    
    // -- Derived UI Helpers --
    const contractorsList = useMemo(() => {
        return Object.values(app.activePropertyRecords.reduce((acc, r) => {
            if (r.contractor && r.contractor.length > 2) {
                const key = r.contractor.toLowerCase().trim();
                if (!acc[key]) {
                    acc[key] = { name: r.contractor, id: r.contractor, phone: r.contractorPhone || '', email: r.contractorEmail || '', jobs: [] };
                }
                if (r.contractorPhone && !acc[key].phone) acc[key].phone = r.contractorPhone;
                if (r.contractorEmail && !acc[key].email) acc[key].email = r.contractorEmail;
                acc[key].jobs.push(r);
            }
            return acc;
        }, {}));
    }, [app.activePropertyRecords]);

    const isContractor = new URLSearchParams(window.location.search).get('requestId');
    
    // -- UI Handlers --
    const handleSwitchProperty = (propId) => { app.setActivePropertyId(propId); app.setIsSwitchingProp(false); toast.success("Switched property"); };
    const toggleRecordSelection = (id) => { const newSet = new Set(app.selectedRecords); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); app.setSelectedRecords(newSet); };
    
    const handleBatchDelete = async () => { 
        if (app.selectedRecords.size === 0 || !confirm("Delete items?")) return; 
        const batch = writeBatch(db); 
        app.selectedRecords.forEach(id => batch.delete(doc(db, 'artifacts', appId, 'users', app.user.uid, 'house_records', id))); 
        try { await batch.commit(); toast.success("Deleted"); app.setSelectedRecords(new Set()); app.setIsSelectionMode(false); } catch (e) { toast.error("Failed"); } 
    };

    const handleDeleteRecord = async (id) => deleteDoc(doc(db, 'artifacts', appId, 'users', app.user.uid, 'house_records', id));
    
    const handleRequestImport = (req) => { app.setEditingRecord({...req, id: null, originalRequestId: req.id}); app.setIsAddModalOpen(true); };
    const openAddModal = (rec = null) => { app.setEditingRecord(rec); app.setIsAddModalOpen(true); };
    const closeAddModal = () => { app.setIsAddModalOpen(false); app.setEditingRecord(null); };
    
    const handleDismissWelcome = async () => { app.setHasSeenWelcome(true); if (app.user) updateDoc(doc(db, 'artifacts', appId, 'users', app.user.uid, 'settings', 'profile'), { hasSeenWelcome: true }); };

    const handleOpenQuickService = (record) => { app.setQuickServiceRecord(record); app.setQuickServiceDescription(''); app.setShowQuickService(true); };
    const handleCloseQuickService = () => { app.setShowQuickService(false); app.setQuickServiceRecord(null); app.setQuickServiceDescription(''); };

    const handleGuidedOnboardingAddItem = async (item) => addDoc(collection(db, 'artifacts', appId, 'users', app.user.uid, 'house_records'), { ...item, userId: app.user.uid, propertyId: app.activeProperty?.id || 'legacy', propertyLocation: app.activeProperty?.name, timestamp: serverTimestamp() });
    const handleGuidedOnboardingComplete = () => { app.setShowGuidedOnboarding(false); handleDismissWelcome(); };

    const handleTabChange = (tabId) => tabId === 'More' ? app.setShowMoreMenu(true) : app.setActiveTab(tabId);
    const handleMoreNavigate = (dest) => { app.setActiveTab(dest); app.setShowMoreMenu(false); };

    const handleBookService = (task) => {
        const record = app.records.find(r => r.id === task.recordId);
        if (!record) { toast.error("Could not find the related record"); return; }
        app.setQuickServiceRecord(record);
        app.setQuickServiceDescription(`Maintenance: ${task.taskName || 'General Service'}`);
        app.setShowQuickService(true);
    };

    const handleAnalyzeImage = async (imageBlob) => {
        const response = await fetch(imageBlob);
        const blob = await response.blob();
        const base64 = await fileToBase64(blob);
        return await scanReceipt(blob, base64, app.activeProperty?.address);
    };

    const handleScanComplete = async (extractedData) => {
        app.setShowScanner(false);
        const validAttachments = extractedData.attachments || [];
        const processMaintenance = (freq, installDate) => ({ frequency: freq || 'annual', nextDate: calculateNextDate(installDate, freq || 'annual') });

        if (extractedData.items && extractedData.items.length > 0) {
            const processedItems = extractedData.items.map(item => {
                const maint = processMaintenance(item.maintenanceFrequency, extractedData.date);
                return { ...item, maintenanceFrequency: maint.frequency, nextServiceDate: maint.nextDate, notes: item.notes || '', maintenanceTasks: item.maintenanceTasks || [] };
            });
            app.setEditingRecord({ isBatch: true, items: processedItems, dateInstalled: extractedData.date || new Date().toISOString().split('T')[0], contractor: extractedData.store || '', contractorPhone: extractedData.contractorPhone, contractorEmail: extractedData.contractorEmail, contractorAddress: extractedData.contractorAddress, warranty: extractedData.warranty || '', attachments: validAttachments });
            toast.success(`Found ${extractedData.items.length} items with maintenance schedules!`, { icon: '📅' });
        } else {
            const singleItem = extractedData.items?.[0] || {};
            const maint = processMaintenance(singleItem.maintenanceFrequency || 'annual', extractedData.date);
            app.setEditingRecord({ item: singleItem.item || extractedData.item || '', category: singleItem.category || extractedData.category || 'Other', brand: singleItem.brand || extractedData.brand || '', model: singleItem.model || extractedData.model || '', cost: singleItem.cost || extractedData.cost || '', dateInstalled: extractedData.date || new Date().toISOString().split('T')[0], maintenanceFrequency: maint.frequency, nextServiceDate: maint.nextDate, notes: singleItem.notes || '', maintenanceTasks: singleItem.maintenanceTasks || [], contractor: extractedData.store || '', contractorPhone: extractedData.contractorPhone, contractorEmail: extractedData.contractorEmail, contractorAddress: extractedData.contractorAddress, warranty: extractedData.warranty || '', attachments: validAttachments });
            toast.success(`Maintenance schedule created for ${extractedData.store || 'contractor'}`, { icon: '🤝' });
        }
        app.setIsAddModalOpen(true);
    };

    const handleSaveSuccess = () => {
        const prevCount = app.records.length;
        const hasMilestone = celebrations.checkMilestone(prevCount, prevCount + 1);
        if (!hasMilestone) celebrations.showToast(`Saved successfully!`, Check);
        closeAddModal();
    };

    // -- Early Returns --
    if (isContractor) return <ContractorPortal />;
    if (app.loading) return <AppShellSkeleton />;
    if (!app.user) return <AuthScreen onLogin={app.handleAuth} onGoogleLogin={() => signInWithPopup(auth, new GoogleAuthProvider())} onAppleLogin={() => signInWithPopup(auth, new OAuthProvider('apple.com'))} onGuestLogin={() => signInAnonymously(auth)} />;
    if (!app.profile && !app.loading) return <SetupPropertyForm onSave={app.handleSaveProperty} isSaving={app.isSavingProperty} onSignOut={() => signOut(auth)} />;

    const isNewUser = app.activePropertyRecords.length === 0 && !app.hasSeenWelcome;
    const totalNotifications = app.dueTasks.length + app.newSubmissions.length;
    
    // -- Filter Logic --
    const groupKey = app.inventoryView === 'room' ? 'area' : 'category';
    const filtered = app.activePropertyRecords.filter(r => {
        const matchSearch = !app.searchTerm || r.item?.toLowerCase().includes(app.searchTerm.toLowerCase()) || r.brand?.toLowerCase().includes(app.searchTerm.toLowerCase());
        const matchCategory = app.filterCategory === 'All' || r.category === app.filterCategory;
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
        {app.showScanner && <SmartScanner onClose={() => app.setShowScanner(false)} onProcessComplete={handleScanComplete} onAnalyze={handleAnalyzeImage} />}
        
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-4 py-3 relative flex items-center justify-between">
                    {/* Left: Logo and Property Selector */}
                    <div className="flex items-center gap-3">
                        <Logo className="h-9 w-9" />
                        <button onClick={() => app.setIsSwitchingProp(true)} className="flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors">
                            <span className="font-bold text-emerald-950 text-lg">{app.activeProperty?.name || 'My Home'}</span>
                            <ChevronDown size={16} className="text-slate-400"/>
                        </button>
                    </div>

                    {/* CENTER: Prominent Address (Desktop) */}
                    {app.activeProperty?.address && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center pointer-events-none">
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <MapPin size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Location</span>
                            </div>
                            <p className="font-bold text-slate-800 text-sm whitespace-nowrap">
                                {app.activeProperty.address.street}
                            </p>
                        </div>
                    )}

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => app.setShowNotifications(!app.showNotifications)} className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                            <Bell size={20} className="text-slate-600"/>{totalNotifications > 0 && <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{totalNotifications}</span>}
                        </button>
                        <button onClick={() => app.setShowUserMenu(!app.showUserMenu)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <Menu size={20} className="text-slate-600"/>
                        </button>
                    </div>
                </div>

                {/* MOBILE SUB-HEADER: Address (Visible only on mobile) */}
                {app.activeProperty?.address && (
                    <div className="md:hidden py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
                        <MapPin size={10} className="text-slate-400" />
                        <p className="text-xs font-bold text-slate-600">
                            {app.activeProperty.address.street}, {app.activeProperty.address.city}
                        </p>
                    </div>
                )}
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {app.showGuidedOnboarding && <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => app.setShowGuidedOnboarding(false)}></div><div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"><GuidedOnboarding propertyName={app.activeProperty?.name} onComplete={handleGuidedOnboardingComplete} onAddItem={handleGuidedOnboardingAddItem} onScanReceipt={() => { app.setShowGuidedOnboarding(false); openAddModal(); }} onDismiss={() => { app.setShowGuidedOnboarding(false); handleDismissWelcome(); }} /></div></div>}
                {isNewUser && app.activeTab === 'Dashboard' && !app.showGuidedOnboarding && <WelcomeScreen propertyName={app.activeProperty.name} onAddRecord={() => app.setShowGuidedOnboarding(true)} onDismiss={handleDismissWelcome} />}
                
                {app.activeTab === 'Dashboard' && !isNewUser && (
                    <FeatureErrorBoundary label="Dashboard">
                        <ProgressiveDashboard 
                            records={app.activePropertyRecords} 
                            contractors={contractorsList} 
                            activeProperty={app.activeProperty} 
                            onScanReceipt={() => app.setShowScanner(true)} 
                            onAddRecord={() => openAddModal()} 
                            onNavigateToItems={() => app.setActiveTab('Items')} 
                            onNavigateToContractors={() => app.setActiveTab('Contractors')} 
                            onNavigateToReports={() => app.setActiveTab('Reports')} 
                            onNavigateToMaintenance={() => app.setActiveTab('Maintenance')} 
                            onCreateContractorLink={() => handleOpenQuickService(null)}
                            onBookService={handleBookService}
                            onMarkTaskDone={app.handleMarkTaskDone}
                            onDeleteHistoryItem={app.handleDeleteHistoryItem} // <-- ADDED THIS
                            onRestoreHistoryItem={app.handleRestoreHistoryItem} // <-- ADDED THIS
                        />
                    </FeatureErrorBoundary>
                )}
                
                {app.activeTab === 'Maintenance' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <button onClick={() => app.setActiveTab('Dashboard')} className="flex items-center text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors">
                            <ArrowLeft size={16} className="mr-1"/> Back to Dashboard
                        </button>
                        <FeatureErrorBoundary label="Maintenance Schedule">
                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold text-emerald-950">Maintenance Schedule</h2>
                                <MaintenanceDashboard 
                                    records={app.activePropertyRecords} 
                                    onAddRecord={openAddModal} 
                                    onNavigateToRecords={() => app.setActiveTab('Items')}
                                    onBookService={handleBookService}
                                    onMarkTaskDone={app.handleMarkTaskDone}
                                    onDeleteHistoryItem={app.handleDeleteHistoryItem} 
                                    onRestoreHistoryItem={app.handleRestoreHistoryItem} 
                                />
                            </div>
                        </FeatureErrorBoundary>
                    </div>
                )}

                {app.activeTab === 'Reports' && <FeatureErrorBoundary label="Reports"><PedigreeReport propertyProfile={app.activeProperty} records={app.activePropertyRecords} /></FeatureErrorBoundary>}
                
                {app.activeTab === 'Items' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-emerald-950">Inventory</h2>
                                <div className="bg-slate-100 p-1 rounded-xl flex">
                                    <button onClick={() => app.setInventoryView('category')} className={`px-4 py-2 rounded-lg text-sm font-bold ${app.inventoryView === 'category' ? 'bg-white shadow' : 'text-slate-500'}`}>Category</button>
                                    <button onClick={() => app.setInventoryView('room')} className={`px-4 py-2 rounded-lg text-sm font-bold ${app.inventoryView === 'room' ? 'bg-white shadow' : 'text-slate-500'}`}>Room</button>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                                <input type="text" placeholder="Search..." value={app.searchTerm} onChange={(e) => app.setSearchTerm(e.target.value)} className="w-full pl-4 pr-4 py-3 bg-emerald-50 border rounded-xl"/>
                                <button onClick={() => app.setIsSelectionMode(!app.isSelectionMode)} className="px-4 py-3 bg-slate-100 rounded-xl font-bold">{app.isSelectionMode ? 'Done' : 'Select'}</button>
                            </div>
                            {app.isSelectionMode && app.selectedRecords.size > 0 && (
                                <button onClick={handleBatchDelete} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                    <Trash2 size={18}/> Delete {app.selectedRecords.size} items
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
                                                <div key={r.id} className={`${app.isSelectionMode && app.selectedRecords.has(r.id) ? 'ring-2 ring-emerald-500 rounded-2xl transform scale-[0.98] transition-transform' : 'hover:-translate-y-1 transition-transform duration-300'}`} onClick={() => app.isSelectionMode && toggleRecordSelection(r.id)}>
                                                    {app.useEnhancedCards ? <EnhancedRecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} onRequestService={handleOpenQuickService} /> : <RecordCard record={r} onDeleteClick={handleDeleteRecord} onEditClick={openAddModal} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {app.activeTab === 'Contractors' && <FeatureErrorBoundary label="Contractors"><ProConnect userId={app.user.uid} propertyName={app.activeProperty.name} propertyAddress={app.activeProperty.address} records={app.activePropertyRecords} onRequestImport={handleRequestImport} onOpenQuickRequest={handleOpenQuickService} /></FeatureErrorBoundary>}
                {app.activeTab === 'Settings' && <div className="space-y-6"><h2 className="text-2xl font-bold">Settings</h2><div className="bg-white rounded-2xl border p-6"><h3 className="font-bold">Enhanced Cards</h3><button onClick={() => app.setUseEnhancedCards(!app.useEnhancedCards)} className={`w-12 h-6 rounded-full ${app.useEnhancedCards ? 'bg-emerald-600' : 'bg-slate-300'} transition-colors`}><div className={`w-5 h-5 bg-white rounded-full shadow transform ${app.useEnhancedCards ? 'translate-x-6' : 'translate-x-0.5'} transition-transform`}></div></button></div></div>}
                {app.activeTab === 'Help' && <div className="space-y-6"><h2 className="text-2xl font-bold">Help</h2><div className="bg-white rounded-2xl border p-6"><p>Contact support@krib.io</p></div></div>}
            </main>

            <BottomNav activeTab={app.activeTab} onTabChange={handleTabChange} onAddClick={() => openAddModal()} notificationCount={app.newSubmissions.length} />
            <MoreMenu isOpen={app.showMoreMenu} onClose={() => app.setShowMoreMenu(false)} onNavigate={handleMoreNavigate} onSignOut={() => signOut(auth)} />

            {/* Property Switcher Modal */}
            {app.isSwitchingProp && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => app.setIsSwitchingProp(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">My Properties</h3>
                            <button onClick={() => app.setIsSwitchingProp(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={18} className="text-slate-400"/></button>
                        </div>
                        <div className="p-2 max-h-60 overflow-y-auto">
                            {app.properties.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => handleSwitchProperty(p.id)}
                                    className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${app.activeProperty?.id === p.id ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className={`p-2 rounded-full ${app.activeProperty?.id === p.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Home size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">{p.name}</p>
                                        <p className="text-xs opacity-70 truncate">{p.address?.street}</p>
                                    </div>
                                    {app.activeProperty?.id === p.id && <Check size={16} className="text-emerald-600" />}
                                </button>
                            ))}
                        </div>
                        <div className="p-2 border-t border-slate-50">
                             <button 
                                onClick={() => { app.setIsSwitchingProp(false); app.setIsAddingProperty(true); }}
                                className="w-full p-3 rounded-xl flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 font-bold text-sm transition-colors"
                            >
                                <Plus size={18} /> Add New Property
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Property Overlay */}
            {app.isAddingProperty && (
                <div className="fixed inset-0 z-[70] bg-white">
                    <div className="absolute top-4 right-4 z-10">
                         <button onClick={() => app.setIsAddingProperty(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                            <X size={20} className="text-slate-600" />
                         </button>
                    </div>
                    <SetupPropertyForm onSave={app.handleSaveProperty} isSaving={app.isSavingProperty} />
                </div>
            )}

            {app.isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={closeAddModal}></div>
                    <div className="relative w-full max-w-5xl m-4 pointer-events-auto">
                        <RecordEditorModal user={app.user} db={db} storage={storage} appId={appId} profile={app.profile} activeProperty={app.activeProperty} editingRecord={app.editingRecord} onClose={closeAddModal} onSuccess={handleSaveSuccess} existingRecords={app.records} />
                    </div>
                </div>
            )}
            
            {app.showQuickService && (
                <QuickServiceRequest record={app.quickServiceRecord} userId={app.user.uid} propertyName={app.activeProperty?.name} propertyAddress={app.activeProperty?.address} onClose={handleCloseQuickService} initialDescription={app.quickServiceDescription} />
            )}
        </div>
        </>
    );
};

const App = () => <ErrorBoundary><AppContent /></ErrorBoundary>;
export default App;
