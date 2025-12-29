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
import { DeleteConfirmModal } from './components/common/DeleteConfirmModal';
import { PedigreeReport } from './features/report/PedigreeReport';
import { ProConnect } from './features/requests/ProConnect';
import { ContractorPortal } from './features/requests/ContractorPortal';
import { QuickServiceRequest } from './features/requests/QuickServiceRequest';
import { CookieConsent } from './components/common/CookieConsent';

// NEW: Import NotificationPanel and UserMenu components
import { NotificationPanel } from './components/navigation/NotificationPanel';
import { UserMenu } from './components/navigation/UserMenu';
// Add this with your other feature imports
import { SettingsPage } from './features/settings/SettingsPage';
import { useThemeInit } from './hooks/useThemeInit';

// NEW: Invitation system imports
import { ContractorInviteCreator, InvitationClaimFlow, ContractorLanding } from './features/invitations';
import { WarrantyCenter } from './features/warranty/WarrantyCenter';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() { if (this.state.hasError) return <div className="p-10 text-red-600"><h2 className="font-bold">Something went wrong.</h2><button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-200 rounded">Reload</button></div>; return this.props.children; }
}

const AppContent = () => {
  useThemeInit();
    const celebrations = useCelebrations();
    
    // Delete confirmation state
    const [deleteConfirmState, setDeleteConfirmState] = React.useState({
        isOpen: false,
        itemId: null,
        itemName: '',
        isBatch: false,
        isLoading: false
    });
    
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

    // -- Check for special routes (contractor portal, invitations) --
    const urlParams = new URLSearchParams(window.location.search);
    const isContractor = urlParams.get('requestId');
    const inviteToken = urlParams.get('invite');
    const proParam = urlParams.get('pro');
    
    // -- UI Handlers --
    const handleSwitchProperty = (propId) => { app.setActivePropertyId(propId); app.setIsSwitchingProp(false); toast.success("Switched property"); };
    const toggleRecordSelection = (id) => { const newSet = new Set(app.selectedRecords); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); app.setSelectedRecords(newSet); };
    
    const handleBatchDelete = () => { 
        if (app.selectedRecords.size === 0) return;
        setDeleteConfirmState({
            isOpen: true,
            itemId: null,
            itemName: '',
            isBatch: true,
            isLoading: false
        });
    };

    const confirmBatchDelete = async () => {
        setDeleteConfirmState(prev => ({ ...prev, isLoading: true }));
        const batch = writeBatch(db); 
        app.selectedRecords.forEach(id => batch.delete(doc(db, 'artifacts', appId, 'users', app.user.uid, 'house_records', id))); 
        try { 
            await batch.commit(); 
            toast.success(`Deleted ${app.selectedRecords.size} items`); 
            app.setSelectedRecords(new Set()); 
            app.setIsSelectionMode(false);
            setDeleteConfirmState({ isOpen: false, itemId: null, itemName: '', isBatch: false, isLoading: false });
        } catch (e) { 
            toast.error("Failed to delete items"); 
            setDeleteConfirmState(prev => ({ ...prev, isLoading: false }));
        } 
    };

    const handleDeleteRecord = (id, itemName = 'this item') => {
        setDeleteConfirmState({
            isOpen: true,
            itemId: id,
            itemName: itemName,
            isBatch: false,
            isLoading: false
        });
    };

    const confirmSingleDelete = async () => {
        if (!deleteConfirmState.itemId) return;
        setDeleteConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', app.user.uid, 'house_records', deleteConfirmState.itemId));
            toast.success("Item deleted");
            setDeleteConfirmState({ isOpen: false, itemId: null, itemName: '', isBatch: false, isLoading: false });
        } catch (e) {
            toast.error("Failed to delete item");
            setDeleteConfirmState(prev => ({ ...prev, isLoading: false }));
        }
    };
    
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

    // --- Handlers for Task Actions (Add/Edit/Delete) ---
    const handleAddTask = (record) => {
        app.setEditingRecord(record);
        app.setIsAddModalOpen(true);
    };

    const handleEditTask = (task) => {
        const record = app.activePropertyRecords.find(r => r.id === task.recordId);
        if (record) {
            app.setEditingRecord(record);
            app.setIsAddModalOpen(true);
        }
    };

    const handleDeleteTask = async (task) => {
        if (!confirm(`Delete task "${task.taskName}"?`)) return;
        const record = app.activePropertyRecords.find(r => r.id === task.recordId);
        if (record) {
            const updatedTasks = (record.maintenanceTasks || []).filter(t => t.task !== task.taskName);
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'users', app.user.uid, 'house_records', record.id), {
                    maintenanceTasks: updatedTasks
                });
                toast.success("Task deleted");
            } catch (e) {
                console.error("Error deleting task", e);
                toast.error("Could not delete task");
            }
        }
    };

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

    const processMaintenance = (frequency, dateStr) => {
        if (!frequency || frequency === 'none') return { frequency: 'none', nextDate: null };
        const nextDate = calculateNextDate(dateStr || new Date().toISOString().split('T')[0], frequency);
        return { frequency, nextDate };
    };

    const handleScanComplete = async (extractedData) => {
        app.setShowScanner(false);
        const validAttachments = extractedData.attachments || [];
        
        // UPDATED: Route ALL scans (1+ items) to batch view
        if (extractedData.items && extractedData.items.length >= 1) {
            app.setEditingRecord({ 
                isBatch: true,
                items: extractedData.items,
                defaultDate: extractedData.date, 
                defaultContractor: extractedData.store, 
                attachments: validAttachments, 
                contractorPhone: extractedData.contractorPhone, 
                contractorEmail: extractedData.contractorEmail, 
                contractorAddress: extractedData.contractorAddress,
                warranty: extractedData.warranty || ''
            });
        } else {
            // Fallback for scans with 0 items (edge case)
            app.setEditingRecord({ 
                item: extractedData.item || '', 
                category: extractedData.category || 'Other', 
                brand: extractedData.brand || '', 
                model: extractedData.model || '', 
                cost: extractedData.cost || '', 
                dateInstalled: extractedData.date || new Date().toISOString().split('T')[0], 
                maintenanceFrequency: 'annual', 
                contractor: extractedData.store || '', 
                contractorPhone: extractedData.contractorPhone, 
                contractorEmail: extractedData.contractorEmail, 
                contractorAddress: extractedData.contractorAddress, 
                warranty: extractedData.warranty || '', 
                attachments: validAttachments 
            });
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
    
    // Contractor Portal Landing (?pro or ?pro=landing)
    if (proParam !== null && proParam !== 'invite') {
        return <ContractorLanding />;
    }
    
    // Contractor creating invitation (?pro=invite)
    if (proParam === 'invite') {
        return <ContractorInviteCreator />;
    }
    
    // Customer claiming invitation (?invite=<token>)
    if (inviteToken) {
        return (
            <InvitationClaimFlow 
                token={inviteToken}
                onComplete={() => window.location.reload()}
                onCancel={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('invite');
                    window.history.replaceState({}, '', url.toString());
                    window.location.reload();
                }}
            />
        );
    }
    
    // Existing contractor submission flow
    if (isContractor) return <ContractorPortal />;
    
    // Loading state
    if (app.loading) return <AppShellSkeleton />;
    
    // Auth screen
    if (!app.user) return <AuthScreen />;
    
    // Property setup
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
        
        {/* Cookie Consent Banner */}
        <CookieConsent />

        <CelebrationRenderer celebration={celebrations.celebration} toast={celebrations.toast} onCloseCelebration={celebrations.closeCelebration} onCloseToast={celebrations.closeToast} />
        {app.showScanner && <SmartScanner onClose={() => app.setShowScanner(false)} onProcessComplete={handleScanComplete} onAnalyze={handleAnalyzeImage} userAddress={app.activeProperty?.address} />}
        
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-4 py-3 relative flex items-center justify-between">
                    {/* Left: Logo and Property Selector */}
                    <div className="flex items-center gap-3">
                        <Logo className="h-9 w-9" />
                        <button onClick={() => app.setIsSwitchingProp(true)} className="flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors">
                            <span className="font-bold text-slate-800 text-sm hidden md:inline">{app.activeProperty?.name || 'My Home'}</span>
                            <ChevronDown size={16} className="text-slate-400"/>
                        </button>
                    </div>
                    
                    {/* Right: Notifications and Menu */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => app.setShowNotifications(!app.showNotifications)} className="p-2 hover:bg-slate-100 rounded-lg relative">
                            <Bell size={20} className="text-slate-600"/>
                            {totalNotifications > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>}
                        </button>
                        <button onClick={() => app.setShowUserMenu(!app.showUserMenu)} className="p-2 hover:bg-slate-100 rounded-lg hidden md:flex items-center">
                            <Menu size={20} className="text-slate-600"/>
                        </button>
                    </div>
                </div>

                {/* MOBILE SUB-HEADER: Address (Visible only on mobile) */}
                {app.activeProperty?.address && (
                    <div className="md:hidden py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
                        <MapPin size={10} className="text-slate-400" />
                        <p className="text-xs font-bold text-slate-600">
                            {typeof app.activeProperty.address === 'string' 
                                ? app.activeProperty.address.split(',')[0] 
                                : `${app.activeProperty.address.street}, ${app.activeProperty.address.city}`
                            }
                        </p>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                {app.showGuidedOnboarding && <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => app.setShowGuidedOnboarding(false)}></div><div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"><GuidedOnboarding propertyName={app.activeProperty?.name} onComplete={handleGuidedOnboardingComplete} onAddItem={handleGuidedOnboardingAddItem} onScanReceipt={() => { app.setShowGuidedOnboarding(false); openAddModal(); }} onDismiss={() => { app.setShowGuidedOnboarding(false); handleDismissWelcome(); }} /></div></div>}
                
                {/* UPDATED: WelcomeScreen with scan-first props */}
                {isNewUser && app.activeTab === 'Dashboard' && !app.showGuidedOnboarding && !app.showScanner && (
                    <WelcomeScreen 
                        propertyName={app.activeProperty?.name} 
                        onScanReceipt={() => app.setShowScanner(true)}
                        onStartGuidedScan={() => app.setShowGuidedOnboarding(true)}
                        onCreateContractorLink={() => handleOpenQuickService(null)}
                        onDismiss={handleDismissWelcome} 
                    />
                )}
                
                {/* UPDATED: Dashboard with new task action props */}
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
                            onDeleteHistoryItem={app.handleDeleteHistoryItem} 
                            onRestoreHistoryItem={app.handleRestoreHistoryItem}
                            // NEW: Task action props
                            onDeleteTask={app.handleDeleteMaintenanceTask}
                            onScheduleTask={app.handleScheduleTask}
                            onSnoozeTask={app.handleSnoozeTask}
                        />
                    </FeatureErrorBoundary>
                )}
                
                {/* UPDATED: Maintenance tab with new task action props */}
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
                                    // NEW: Task action props
                                    onDeleteTask={app.handleDeleteMaintenanceTask}
                                    onScheduleTask={app.handleScheduleTask}
                                    onSnoozeTask={app.handleSnoozeTask}
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
                                <button onClick={() => app.setIsSelectionMode(!app.isSelectionMode)} className="px-4 py-3 bg-slate-100 rounded-xl font-bold">{app.isSelectionMode ? 'Cancel' : 'Select'}</button>
                            </div>
                        </div>
                        {app.isSelectionMode && app.selectedRecords.size > 0 && (
                            <div className="bg-red-50 p-4 rounded-xl flex items-center justify-between border border-red-100">
                                <span className="font-bold text-red-700">{app.selectedRecords.size} selected</span>
                                <button onClick={handleBatchDelete} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg flex items-center gap-2"><Trash2 size={16}/> Delete</button>
                            </div>
                        )}
                        {Object.keys(grouped).length === 0 ? (
                            <EmptyState title="No items yet" description="Add your first home item to get started." action={<button onClick={() => openAddModal()} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl">Add Item</button>} />
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([group, items]) => (
                                    <div key={group} className="space-y-4">
                                        <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">{items.length}</span>
                                            {group}
                                        </h3>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {items.map(r => (
                                                <div key={r.id} className={`cursor-pointer ${app.isSelectionMode && app.selectedRecords.has(r.id) ? 'ring-2 ring-emerald-500 rounded-2xl transform scale-[0.98] transition-transform' : 'hover:-translate-y-1 transition-transform duration-300'}`} onClick={() => app.isSelectionMode && toggleRecordSelection(r.id)}>
                                                    {app.useEnhancedCards ? (
                                                        <EnhancedRecordCard 
                                                            record={r} 
                                                            onDeleteRecord={(id) => handleDeleteRecord(id, r.item || r.name || 'this item')} 
                                                            onEditRecord={openAddModal} 
                                                            onAddTask={handleAddTask}
                                                            onEditTask={handleEditTask}
                                                            onDeleteTask={handleDeleteTask}
                                                            onCompleteTask={app.handleMarkTaskDone}
                                                        />
                                                    ) : (
                                                        <RecordCard 
                                                            record={r} 
                                                            onDeleteClick={(id) => handleDeleteRecord(id, r.item || r.name || 'this item')} 
                                                            onEditClick={openAddModal} 
                                                        />
                                                    )}
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
                {app.activeTab === 'Settings' && (
    <FeatureErrorBoundary label="Settings">
        <SettingsPage 
            user={app.user}
            profile={app.profile}
            properties={app.properties}
            activePropertyId={app.activePropertyId}
            records={app.activePropertyRecords}
            useEnhancedCards={app.useEnhancedCards}
            setUseEnhancedCards={app.setUseEnhancedCards}
            onSwitchProperty={(propId) => {
                app.setActivePropertyId(propId);
                toast.success("Switched property");
            }}
            onAddProperty={() => app.setIsAddingProperty(true)}
            onSignOut={() => signOut(auth)}
        />
    </FeatureErrorBoundary>
)}
                {app.activeTab === 'Help' && (
    <FeatureErrorBoundary label="Help">
        <SettingsPage 
            user={app.user}
            profile={app.profile}
            properties={app.properties}
            activePropertyId={app.activePropertyId}
            records={app.activePropertyRecords}
            useEnhancedCards={app.useEnhancedCards}
            setUseEnhancedCards={app.setUseEnhancedCards}
            onSwitchProperty={(propId) => {
                app.setActivePropertyId(propId);
                toast.success("Switched property");
            }}
            onAddProperty={() => app.setIsAddingProperty(true)}
            onSignOut={() => signOut(auth)}
        />
    </FeatureErrorBoundary>
)}
            </main>

            <BottomNav activeTab={app.activeTab} onTabChange={handleTabChange} onAddClick={() => openAddModal()} notificationCount={app.newSubmissions.length} />
            <MoreMenu isOpen={app.showMoreMenu} onClose={() => app.setShowMoreMenu(false)} onNavigate={handleMoreNavigate} onSignOut={() => signOut(auth)} />

            {/* NEW: Notification Panel - renders when bell icon is clicked */}
            <NotificationPanel 
                // === EXISTING PROPS (unchanged) ===
                isOpen={app.showNotifications} 
                onClose={() => app.setShowNotifications(false)} 
                dueTasks={app.dueTasks}
                newSubmissions={app.newSubmissions}
                onTaskClick={(task) => {
                    // Navigate to maintenance tab when a task is clicked
                    app.setActiveTab('Maintenance');
                    // NEW: Set highlighted task for scroll-to functionality
                    app.setHighlightedTaskId?.(task.recordId + '-' + (task.taskName || task.item));
                }}
                onSubmissionClick={(submission) => {
                    // Navigate to contractors tab when a submission is clicked
                    app.setActiveTab('Contractors');
                }}
                
                // === NEW PROPS (additions for dismiss/clear/quick actions) ===
                dismissedIds={app.dismissedNotifications}
                onDismiss={app.handleDismissNotification}
                onClearAll={app.handleClearAllNotifications}
                onQuickComplete={(task) => app.handleMarkTaskDone(task)}
                onQuickSnooze={(task, days) => app.handleSnoozeTask(task, days)}
            />

            {/* NEW: User Menu - renders when hamburger menu icon is clicked (desktop) */}
            <UserMenu 
                isOpen={app.showUserMenu} 
                onClose={() => app.setShowUserMenu(false)} 
                onNavigate={handleMoreNavigate}
                onSignOut={() => signOut(auth)}
                userName={app.profile?.name || app.activeProperty?.name}
            />

            {/* Property Switcher Modal */}
            {app.isSwitchingProp && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => app.setIsSwitchingProp(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Switch Property</h2>
                            <button onClick={() => app.setIsSwitchingProp(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-400"/></button>
                        </div>
                        <div className="space-y-2">
                            {app.properties.map(p => (
                                <button key={p.id} onClick={() => handleSwitchProperty(p.id)} className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors ${p.id === app.activePropertyId ? 'bg-emerald-50 border-2 border-emerald-500' : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'}`}>
                                    <Home size={20} className={p.id === app.activePropertyId ? 'text-emerald-600' : 'text-slate-400'} />
                                    <div className="text-left">
                                        <p className="font-bold text-slate-800">{p.name}</p>
                                        {p.address && <p className="text-xs text-slate-500">{typeof p.address === 'string' ? p.address : `${p.address.city}, ${p.address.state}`}</p>}
                                    </div>
                                    {p.id === app.activePropertyId && <Check size={18} className="ml-auto text-emerald-600"/>}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { app.setIsSwitchingProp(false); app.setIsAddingProperty(true); }} className="mt-4 w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-bold flex items-center justify-center gap-2 hover:border-emerald-500 hover:text-emerald-600 transition-colors">
                            <Plus size={18}/> Add New Property
                        </button>
                    </div>
                </div>
            )}

            {/* Add Property Form */}
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
            
            {/* Delete Confirmation Modal */}
            <DeleteConfirmModal
                isOpen={deleteConfirmState.isOpen}
                onClose={() => setDeleteConfirmState({ isOpen: false, itemId: null, itemName: '', isBatch: false, isLoading: false })}
                onConfirm={deleteConfirmState.isBatch ? confirmBatchDelete : confirmSingleDelete}
                title={deleteConfirmState.isBatch ? `Delete ${app.selectedRecords.size} items?` : `Delete "${deleteConfirmState.itemName}"?`}
                message="This item and all its maintenance history will be permanently removed."
                itemCount={deleteConfirmState.isBatch ? app.selectedRecords.size : 1}
                isLoading={deleteConfirmState.isLoading}
            />
        </div>
        </>
    );
};

const App = () => (
    <ErrorBoundary>
        <AppContent />
    </ErrorBoundary>
);

export default App;
