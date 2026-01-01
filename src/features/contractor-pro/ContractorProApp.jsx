// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing

import React, { useState, useCallback } from 'react';
import { 
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft, Search,
    MapPin, Phone, Mail, Building2, Save, CheckCircle, Shield,
    Briefcase // ADDED: Icon for Jobs
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Components
import { ContractorAuthScreen } from './components/ContractorAuthScreen';
import { DashboardOverview } from './components/DashboardOverview';
import { Logo } from '../../components/common/Logo';

// Hooks
import { useContractorAuth } from './hooks/useContractorAuth';
import { 
    useInvitations, 
    useCustomers, 
    useDashboardStats,
    useContractorJobs // ADDED: Hook for Jobs
} from './hooks/useContractorData';
import { updateContractorSettings } from './lib/contractorService';

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
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
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
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <NavItem 
                    icon={Home}
                    label="Dashboard"
                    active={activeView === 'dashboard'}
                    onClick={() => onNavigate('dashboard')}
                />
                <NavItem 
                    icon={Briefcase}
                    label="My Jobs"
                    active={activeView === 'jobs'}
                    onClick={() => onNavigate('jobs')}
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 z-50 safe-area-bottom">
        <div className="flex items-center justify-around">
            {[
                { id: 'dashboard', icon: Home, label: 'Home' },
                { id: 'jobs', icon: Briefcase, label: 'Jobs' },
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
// FEATURE VIEWS
// ============================================

// --- NEW: JOBS VIEW ---
const JobsView = ({ jobs, loading }) => {
    const activeJobs = jobs?.filter(j => j.status !== 'completed' && j.status !== 'cancelled');
    
    // Quick helper to get status color
    const getStatusColor = (status) => {
        switch(status) {
            case 'scheduled': return 'bg-emerald-100 text-emerald-700';
            case 'quoted': return 'bg-blue-100 text-blue-700';
            case 'scheduling': return 'bg-purple-100 text-purple-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Jobs</h1>
                    <p className="text-slate-500">Active service requests and appointments</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10"><div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"/></div>
            ) : activeJobs?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                    <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4"/>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No active jobs</h3>
                    <p className="text-slate-500">Requests will appear here when you interact with them.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {activeJobs.map(job => (
                        <div 
                            key={job.id} 
                            onClick={() => window.location.href = `/contractor-portal?requestId=${job.id}`}
                            className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-emerald-700 transition-colors">
                                        {job.description || 'Service Request'}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                        <span>{job.propertyName || 'Homeowner'}</span>
                                        <span>•</span>
                                        <span>
                                            {new Date(job.createdAt?.toDate ? job.createdAt.toDate() : (job.createdAt || Date.now())).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(job.status)}`}>
                                    {job.status}
                                </span>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-sm">
                                <span className="text-slate-400">Tap to view details</span>
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500"/>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- INVITATIONS LIST ---
const InvitationsView = ({ invitations, loading, onCreate }) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Invitations</h1>
                <p className="text-slate-500">Track and manage sent invites</p>
            </div>
            <button onClick={onCreate} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                <Plus size={18} />
                <span className="hidden md:inline">New Invitation</span>
            </button>
        </div>

        {loading ? (
            <div className="text-center py-10"><div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"/></div>
        ) : invitations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4"/>
                <h3 className="font-bold text-slate-800 text-lg mb-2">No invitations yet</h3>
                <p className="text-slate-500 mb-6">Create an invitation to start tracking jobs.</p>
                <button onClick={onCreate} className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl">Create First Invite</button>
            </div>
        ) : (
            <div className="grid gap-3">
                {invitations.map(invite => (
                    <div key={invite.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${invite.status === 'claimed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                {invite.status === 'claimed' ? <CheckCircle size={20}/> : <FileText size={20}/>}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{invite.customerName || 'Pending Claim'}</p>
                                <p className="text-xs text-slate-500">
                                    {new Date(invite.createdAt?.toDate ? invite.createdAt.toDate() : invite.createdAt).toLocaleDateString()}
                                    {' • '}{invite.recordCount} records
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${invite.status === 'claimed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {invite.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// --- CUSTOMERS LIST ---
const CustomersView = ({ customers, loading }) => {
    const [search, setSearch] = useState('');
    
    const filtered = customers.filter(c => 
        c.customerName?.toLowerCase().includes(search.toLowerCase()) || 
        c.propertyName?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                <input 
                    type="text" 
                    placeholder="Search customers..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
            </div>

            {loading ? (
                <div className="text-center py-10"><div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"/></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-500">No customers found.</div>
            ) : (
                <div className="grid gap-3">
                    {filtered.map(c => (
                        <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex gap-3">
                                    <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                                        {(c.customerName || c.propertyName || 'C').charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{c.customerName || 'Unknown Name'}</h3>
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <MapPin size={12}/> {c.propertyName || 'No Address'}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="text-slate-300 group-hover:text-emerald-500 transition-colors"/>
                            </div>
                            
                            <div className="flex gap-2 text-xs">
                                <span className="bg-slate-50 px-2 py-1 rounded-md text-slate-600 font-medium">
                                    {c.totalJobs || 0} Jobs
                                </span>
                                {c.totalSpend > 0 && (
                                    <span className="bg-emerald-50 px-2 py-1 rounded-md text-emerald-700 font-bold">
                                        ${c.totalSpend.toLocaleString()} Value
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- PROFILE EDITOR ---
const ProfileView = ({ profile, onUpdateProfile }) => {
    const [formData, setFormData] = useState({
        displayName: profile?.profile?.displayName || '',
        companyName: profile?.profile?.companyName || '',
        phone: profile?.profile?.phone || '',
        email: profile?.profile?.email || '',
        license: profile?.profile?.license || ''
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        await onUpdateProfile(formData);
        setSaving(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Company Profile</h1>
            
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Your Name</label>
                        <input 
                            type="text" 
                            className="w-full p-3 border border-slate-200 rounded-xl"
                            value={formData.displayName}
                            onChange={e => setFormData({...formData, displayName: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Company Name</label>
                        <input 
                            type="text" 
                            className="w-full p-3 border border-slate-200 rounded-xl"
                            value={formData.companyName}
                            onChange={e => setFormData({...formData, companyName: e.target.value})}
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone Number</label>
                        <input 
                            type="tel" 
                            className="w-full p-3 border border-slate-200 rounded-xl"
                            value={formData.phone}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Email (Read Only)</label>
                        <input 
                            type="email" 
                            disabled
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500"
                            value={formData.email}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">License Number</label>
                    <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input 
                            type="text" 
                            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl"
                            value={formData.license}
                            onChange={e => setFormData({...formData, license: e.target.value})}
                            placeholder="State License #"
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={saving}
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 flex justify-center gap-2 items-center"
                    >
                        {saving ? 'Saving...' : <><Save size={18}/> Save Changes</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- SETTINGS ---
const SettingsView = ({ profile, onUpdateSettings, onSignOut }) => {
    const [settings, setSettings] = useState(profile?.settings || {
        emailNotifications: true,
        smsNotifications: false,
        weeklyDigest: true
    });

    const handleToggle = async (key) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        try {
            await onUpdateSettings(profile.uid, newSettings);
            toast.success('Settings saved');
        } catch (e) {
            toast.error('Failed to save settings');
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
            
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Notifications</h3>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Email Alerts</p>
                            <p className="text-xs text-slate-500">Get notified when invitations are claimed</p>
                        </div>
                        <button 
                            onClick={() => handleToggle('emailNotifications')}
                            className={`w-12 h-7 rounded-full transition-colors relative ${settings.emailNotifications ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${settings.emailNotifications ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Weekly Digest</p>
                            <p className="text-xs text-slate-500">Summary of activity and new customers</p>
                        </div>
                        <button 
                            onClick={() => handleToggle('weeklyDigest')}
                            className={`w-12 h-7 rounded-full transition-colors relative ${settings.weeklyDigest ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${settings.weeklyDigest ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            <button
                onClick={onSignOut}
                className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-100 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
                <LogOut size={18}/> Sign Out
            </button>
        </div>
    );
};

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

    // NEW: Load Active Jobs
    const { 
        jobs, 
        loading: jobsLoading 
    } = useContractorJobs(user?.uid);
    
    // Navigation
    const handleNavigate = useCallback((view) => {
        setActiveView(view);
    }, []);
    
    // Create invitation handler
    const handleCreateInvitation = useCallback(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'invite');
        window.location.href = url.toString();
    }, []);
    
    // View title
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Dashboard';
            case 'jobs': return 'My Jobs'; // NEW TITLE
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
                onResetPassword={() => {}} 
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

                    {activeView === 'jobs' && (
                        <JobsView 
                            jobs={jobs}
                            loading={jobsLoading}
                        />
                    )}
                    
                    {activeView === 'invitations' && (
                        <InvitationsView 
                            invitations={invitations}
                            loading={invitationsLoading}
                            onCreate={handleCreateInvitation}
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
                        <SettingsView 
                            profile={profile}
                            onUpdateSettings={updateContractorSettings}
                            onSignOut={signOut} 
                        />
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
