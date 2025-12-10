// src/App.jsx
// ... (Previous imports remain, remove HomeSnapshot from imports if desired, 
// though Dashboard uses it now so it might be imported transitively or inside Dashboard.jsx)
import { Dashboard } from './features/dashboard/Dashboard';
// Remove import { HomeSnapshot } from './features/dashboard/HomeSnapshot'; if not used here directly

// ... (Keep existing ErrorBoundary class)

const AppContent = () => {
    // ... (Keep existing state and effects)

    // ... (Keep existing helper functions)

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
           // ... (Toast options)
        />
        
        <div className="min-h-screen bg-emerald-50 font-sans pb-32">
            <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
                 {/* ... (Keep Header Content) ... */}
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                
                {/* ... (Keep Guided Onboarding & Welcome Screen logic) ... */}
                
                {/* Main Dashboard */}
                {activeTab === 'Dashboard' && !isNewUser && (
                    <FeatureErrorBoundary label="Dashboard">
                        {/* REMOVED HomeSnapshot from here */}
                        
                        <Dashboard 
                            records={activePropertyRecords}
                            contractors={contractorsList} 
                            activeProperty={activeProperty}
                            propertyName={activeProperty.name}
                            onScanReceipt={() => openAddModal()}
                            onNavigateToItems={() => setActiveTab('Items')}
                            onNavigateToContractors={() => setActiveTab('Contractors')}
                            onCreateContractorLink={() => handleOpenQuickService(null)}
                        />
                    </FeatureErrorBoundary>
                )}

                {/* ... (Keep other tabs: Areas, Items, Contractors, Property, Settings, etc.) ... */}

            </main>

            {/* ... (Keep BottomNav, MoreMenu, AddRecord modals) ... */}
        </div>
        </>
    );
};
// ... (Rest of file)
