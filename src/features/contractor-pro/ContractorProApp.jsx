// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing

import React, { useState, useCallback } from 'react';
import { 
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Components
import { ContractorAuthScreen } from './components/ContractorAuthScreen';
import { DashboardOverview } from './components/DashboardOverview';
import { Logo } from '../../components/common/Logo';

// Hooks
import { useContractorAuth } from './hooks/useContractorAuth';
import { useInvitations, useCustomers, useDashboardStats } from './hooks/useContractorData';

// ============================================
// NAV ITEM
// ============================================
const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
            active 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="ml-auto bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {badge}
            </span>
        )}
    </button>
);

// ============================================
// SIDEBAR NAV
// ============================================
const SidebarNav = ({ 
    profile, 
    activeView, 
    onNavigate, 
    onSignOut,
    pendingCount 
}) => {
    const companyName = profile?.profile?.companyName || profile?.profile?.displayName || 'Contractor';
    const email = profile?.profile?.email || '';
    
    return (
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col">
            {/* Logo */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                        <Logo className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800">krib</h1>
                        <p className="text-xs text-slate-500">Pro Dashboard</p>
                    </div>
                </div>
            </div>
            
            {/* Profile Summary */}
            <div className="p-4 border-b border-slate-100">
                <p className="font-bold text-slate-800 truncate">{companyName}</p>
                <p className="text-xs text-slate-500 truncate">{email}</p>
            </div>
            
            {/* Nav Items */}
            <nav className="flex-1 p-4 space-y-1">
                <NavItem 
                    icon={Home}
                    label="Dashboard"
                    active={activeView === 'dashboard'}
                    onClick={() => onNavigate('dashboard')}
                />
                <NavItem 
                    icon={FileText}
                    label="Invitations"
                    active={activeView === 'invitations'}
                    onClick={() => onNavigate('invitations')}
                    badge={pendingCount}
                />
                <NavItem 
                    icon={Users}
                    label="Customers"
                    active={activeView === 'customers'}
                    onClick={() => onNavigate('customers')}
                />
                <NavItem 
                    icon={User}
                    label="Profile"
                    active={activeView === 'profile'}
                    onClick={() => onNavigate('profile')}
                />
                <NavItem 
                    icon={SettingsIcon}
                    label="Settings"
                    active={activeView === 'settings'}
                    onClick={() => onNavigate('settings')}
                />
            </nav>
            
            {/* Sign Out */}
            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={onSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

// ============================================
// MOBILE NAV
// ============================================
const MobileNav = ({ activeView, onNavigate, pendingCount }) => (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 z-50">
        <div className="flex items-center justify-around">
            {[
                { id: 'dashboard', icon: Home, label: 'Home' },
                { id: 'invitations', icon: FileText, label: 'Invites', badge: pendingCount },
                { id: 'customers', icon: Users, label: 'Customers' },
                { id: 'profile', icon: User, label: 'Profile' },
            ].map(item => (
                <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative ${
                        activeView === item.id
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                    }`}
                >
                    <item.icon size={22} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                    {item.badge > 0 && (
                        <span className="absolute top-1 right-2 h-4 w-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {item.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    </nav>
);

// ============================================
// MOBILE HEADER
// ============================================
const MobileHeader = ({ title, onMenuClick, onCreateInvitation }) => (
    <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-1.5 rounded-lg">
                <Logo className="h-5 w-5" />
            </div>
            <span className="font-bold text-slate-800">{title}</span>
        </div>
        <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600">
                <Bell size={20} />
            </button>
        </div>
    </header>
);

// ============================================
// PLACEHOLDER VIEWS
// ============================================
const InvitationsView = ({ invitations, loading }) => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">Invitations</h1>
            <button className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                <Plus size={18} />
                New Invitation
            </button>
        </div>
        <p className="text-slate-500">Coming soon: Full invitation management</p>
        {/* TODO: Implement full invitations list */}
    </div>
);

const CustomersView = ({ customers, loading }) => (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
        <p className="text-slate-500">Coming soon: Full customer management</p>
        {/* TODO: Implement full customers list */}
    </div>
);

const ProfileView = ({ profile, onUpdateProfile }) => (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
        <p className="text-slate-500">Coming soon: Profile editor</p>
        {/* TODO: Implement profile editor */}
    </div>
);

const SettingsView = ({ onSignOut }) => (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4">Account</h2>
            <button
                onClick={onSignOut}
                className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
            >
                Sign Out
            </button>
        </div>
    </div>
);

// ============================================
// MAIN APP
// ============================================
export const ContractorProApp = () => {
    const [activeView, setActiveView] = useState('dashboard');
    
    // Auth hook
    const {
        user,
        profile,
        loading: authLoading,
        authError,
        isAuthenticated,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        clearError
    } = useContractorAuth();
    
    // Data hooks (only load when authenticated)
    const { 
        invitations, 
        loading: invitationsLoading,
        pendingInvitations,
        recentActivity
    } = useInvitations(user?.uid);
    
    const { 
        customers, 
        loading: customersLoading,
        byLastContact: customersByLastContact
    } = useCustomers(user?.uid);
    
    const { 
        stats, 
        loading: statsLoading 
    } = useDashboardStats(user?.uid);
    
    // Navigation
    const handleNavigate = useCallback((view) => {
        setActiveView(view);
    }, []);
    
    // Create invitation handler
    const handleCreateInvitation = useCallback(() => {
        // Navigate to invitation creator
        // For now, redirect to existing flow
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'invite');
        window.location.href = url.toString();
    }, []);
    
    // View title
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Dashboard';
            case 'invitations': return 'Invitations';
            case 'customers': return 'Customers';
            case 'profile': return 'Profile';
            case 'settings': return 'Settings';
            default: return 'Dashboard';
        }
    };
    
    // Show loading state
    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-slate-500">Loading...</p>
                </div>
            </div>
        );
    }
    
    // Show auth screen if not authenticated
    if (!isAuthenticated) {
        return (
            <ContractorAuthScreen 
                onSignIn={signIn}
                onSignUp={signUp}
                onGoogleSignIn={signInWithGoogle}
                onResetPassword={() => {}} // TODO
                loading={authLoading}
                error={authError}
                onClearError={clearError}
            />
        );
    }
    
    // Render dashboard
    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Toaster position="top-center" />
            
            {/* Sidebar (Desktop) */}
            <SidebarNav 
                profile={profile}
                activeView={activeView}
                onNavigate={handleNavigate}
                onSignOut={signOut}
                pendingCount={pendingInvitations.length}
            />
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Mobile Header */}
                <MobileHeader 
                    title={getViewTitle()}
                    onCreateInvitation={handleCreateInvitation}
                />
                
                {/* Content Area */}
                <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                    {activeView === 'dashboard' && (
                        <DashboardOverview 
                            profile={profile}
                            stats={stats}
                            invitations={invitations}
                            customers={customersByLastContact}
                            loading={statsLoading || invitationsLoading || customersLoading}
                            onCreateInvitation={handleCreateInvitation}
                            onViewAllInvitations={() => handleNavigate('invitations')}
                            onViewAllCustomers={() => handleNavigate('customers')}
                        />
                    )}
                    
                    {activeView === 'invitations' && (
                        <InvitationsView 
                            invitations={invitations}
                            loading={invitationsLoading}
                        />
                    )}
                    
                    {activeView === 'customers' && (
                        <CustomersView 
                            customers={customers}
                            loading={customersLoading}
                        />
                    )}
                    
                    {activeView === 'profile' && (
                        <ProfileView 
                            profile={profile}
                            onUpdateProfile={updateProfile}
                        />
                    )}
                    
                    {activeView === 'settings' && (
                        <SettingsView onSignOut={signOut} />
                    )}
                </main>
                
                {/* Mobile Nav */}
                <MobileNav 
                    activeView={activeView}
                    onNavigate={handleNavigate}
                    pendingCount={pendingInvitations.length}
                />
            </div>
        </div>
    );
};

export default ContractorProApp;
