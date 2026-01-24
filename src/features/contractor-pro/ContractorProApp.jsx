// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing

import React, { useState, useCallback } from 'react';
import {
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft, Sparkles, Calendar,
    DollarSign, FlaskConical, AlertTriangle, Trash2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Components
import { ContractorAuthScreen } from './components/ContractorAuthScreen';
import { DashboardOverview } from './components/DashboardOverview';
import { TeamManagement } from './components/TeamManagement';
import { AIDispatchAssistant } from './components/AIDispatchAssistant';
import { ProfitabilityDashboard } from './components/ProfitabilityDashboard';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { Logo } from '../../components/common/Logo';

// Hooks
import { useContractorAuth } from './hooks/useContractorAuth';
import { useInvitations, useCustomers, useDashboardStats } from './hooks/useContractorData';
import { useJobs, useTodaySchedule } from './hooks/useJobs';
import { useTeam } from './hooks/useTeam';

// Utils
import { formatPhoneNumber } from '../../lib/utils';

// Services
import { updateContractorSettings } from './lib/contractorService';
import { updateJobStatus, JOB_STATUSES } from './lib/jobService';

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
                    icon={Sparkles}
                    label="AI Dispatch"
                    active={activeView === 'dispatch'}
                    onClick={() => onNavigate('dispatch')}
                />
                <NavItem
                    icon={Users}
                    label="Team"
                    active={activeView === 'team'}
                    onClick={() => onNavigate('team')}
                />
                <NavItem
                    icon={FlaskConical}
                    label="Simulator"
                    active={activeView === 'simulator'}
                    onClick={() => onNavigate('simulator')}
                />
                <NavItem
                    icon={DollarSign}
                    label="Profitability"
                    active={activeView === 'profitability'}
                    onClick={() => onNavigate('profitability')}
                />
                <NavItem
                    icon={FileText}
                    label="Invitations"
                    active={activeView === 'invitations'}
                    onClick={() => onNavigate('invitations')}
                    badge={pendingCount}
                />
                <NavItem
                    icon={User}
                    label="Customers"
                    active={activeView === 'customers'}
                    onClick={() => onNavigate('customers')}
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
                { id: 'dispatch', icon: Sparkles, label: 'AI Dispatch' },
                { id: 'team', icon: Users, label: 'Team' },
                { id: 'invitations', icon: FileText, label: 'Invites', badge: pendingCount },
                { id: 'settings', icon: SettingsIcon, label: 'Settings' },
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

const ProfileView = ({ profile, onUpdateProfile }) => {
    const profileData = profile?.profile || {};
    const [form, setForm] = useState({
        companyName: profileData.companyName || '',
        displayName: profileData.displayName || '',
        phone: profileData.phone || '',
        email: profileData.email || '',
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const handlePhoneChange = (value) => {
        setForm(prev => ({ ...prev, phone: formatPhoneNumber(value) }));
        if (errors.phone) setErrors(prev => ({ ...prev, phone: null }));
    };

    const handleSubmit = async () => {
        const newErrors = {};
        if (!form.companyName.trim()) newErrors.companyName = 'Company name is required';
        if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) {
            newErrors.phone = 'Valid phone number is required';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setSaving(true);
        try {
            await onUpdateProfile({
                companyName: form.companyName.trim(),
                displayName: form.displayName.trim(),
                phone: form.phone,
                email: form.email,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-lg">
            <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                    <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => {
                            setForm(prev => ({ ...prev, companyName: e.target.value }));
                            if (errors.companyName) setErrors(prev => ({ ...prev, companyName: null }));
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border ${errors.companyName ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent outline-none`}
                        placeholder="Your company name"
                    />
                    {errors.companyName && <p className="text-sm text-red-600 mt-1">{errors.companyName}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                    <input
                        type="text"
                        value={form.displayName}
                        onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        placeholder="Your name"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                    <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl border ${errors.phone ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent outline-none`}
                        placeholder="(555) 123-4567"
                    />
                    {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={form.email}
                        disabled
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 outline-none cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-400 mt-1">Email cannot be changed here</p>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>
        </div>
    );
};

const SettingsView = ({ onSignOut, profile, user }) => {
    const settings = profile?.settings || {};
    const [notifications, setNotifications] = useState({
        emailNotifications: settings.emailNotifications !== false,
        smsNotifications: settings.smsNotifications || false,
        weeklyDigest: settings.weeklyDigest !== false,
    });
    const [savingNotifs, setSavingNotifs] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleToggle = async (key) => {
        const updated = { ...notifications, [key]: !notifications[key] };
        setNotifications(updated);
        if (user?.uid) {
            setSavingNotifs(true);
            try {
                await updateContractorSettings(user.uid, updated);
                toast.success('Settings saved');
            } catch {
                toast.error('Failed to save settings');
                setNotifications(notifications);
            } finally {
                setSavingNotifs(false);
            }
        }
    };

    const ToggleSwitch = ({ enabled, onToggle, disabled }) => (
        <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-600' : 'bg-slate-300'} ${disabled ? 'opacity-50' : ''}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );

    return (
        <div className="space-y-6 max-w-lg">
            <h1 className="text-2xl font-bold text-slate-800">Settings</h1>

            {/* Notification Preferences */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="font-bold text-slate-800 mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-700">Email Notifications</p>
                            <p className="text-sm text-slate-500">Get notified when invitations are claimed</p>
                        </div>
                        <ToggleSwitch enabled={notifications.emailNotifications} onToggle={() => handleToggle('emailNotifications')} disabled={savingNotifs} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-700">SMS Notifications</p>
                            <p className="text-sm text-slate-500">Receive text message alerts</p>
                        </div>
                        <ToggleSwitch enabled={notifications.smsNotifications} onToggle={() => handleToggle('smsNotifications')} disabled={savingNotifs} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-700">Weekly Digest</p>
                            <p className="text-sm text-slate-500">Summary of activity each week</p>
                        </div>
                        <ToggleSwitch enabled={notifications.weeklyDigest} onToggle={() => handleToggle('weeklyDigest')} disabled={savingNotifs} />
                    </div>
                </div>
            </div>

            {/* Account */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="font-bold text-slate-800 mb-4">Account</h2>
                <button
                    onClick={onSignOut}
                    className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
                >
                    Sign Out
                </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-2xl border border-red-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={18} className="text-red-600" />
                    <h2 className="font-bold text-red-800">Danger Zone</h2>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                    <Trash2 size={16} />
                    Delete Account
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Account</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            This will permanently delete your contractor profile, all invitations, and customer data.
                            Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm.
                        </p>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder="Type DELETE to confirm"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={deleteConfirm !== 'DELETE'}
                                onClick={() => {
                                    toast.error('Account deletion requires contacting support.');
                                    setShowDeleteModal(false);
                                    setDeleteConfirm('');
                                }}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// CANCEL JOB MODAL
// ============================================
const CANCELLATION_REASONS = [
    { value: 'customer_cancelled', label: 'Customer Cancelled' },
    { value: 'scheduling_conflict', label: 'Scheduling Conflict' },
    { value: 'weather', label: 'Weather / Safety' },
    { value: 'parts_unavailable', label: 'Parts Unavailable' },
    { value: 'duplicate', label: 'Duplicate Job' },
    { value: 'other', label: 'Other' },
];

const CancelJobModal = ({ isOpen, job, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [cancelling, setCancelling] = useState(false);

    if (!isOpen || !job) return null;

    const handleConfirm = async () => {
        if (!reason) {
            toast.error('Please select a reason');
            return;
        }
        setCancelling(true);
        try {
            await onConfirm(job.id, reason, notes);
            setReason('');
            setNotes('');
            onClose();
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Cancel Job</h3>
                <p className="text-sm text-slate-500 mb-4">
                    {job.title || job.jobNumber} - {job.customerName || 'Unknown Customer'}
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                        >
                            <option value="">Select a reason...</option>
                            {CANCELLATION_REASONS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                            placeholder="Additional details..."
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-5">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50"
                    >
                        Go Back
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!reason || cancelling}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelling ? 'Cancelling...' : 'Cancel Job'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN APP
// ============================================
export const ContractorProApp = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const [cancellingJob, setCancellingJob] = useState(null);

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

    // Jobs and team for simulator
    const { jobs, loading: jobsLoading } = useJobs(user?.uid);
    const { team, loading: teamLoading } = useTeam(user?.uid);
    
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

    // Cancel job handler
    const handleCancelJob = useCallback(async (jobId, reason, notes) => {
        if (!user?.uid) return;
        try {
            await updateJobStatus(user.uid, jobId, JOB_STATUSES.CANCELLED, {
                reason,
                notes
            });
            toast.success('Job cancelled');
        } catch (error) {
            console.error('Error cancelling job:', error);
            toast.error('Failed to cancel job');
        }
    }, [user]);
    
    // View title
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Dashboard';
            case 'dispatch': return 'AI Dispatch';
            case 'team': return 'Team';
            case 'simulator': return 'What-If Simulator';
            case 'profitability': return 'Profitability';
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
                    
                    {activeView === 'dispatch' && (
                        <AIDispatchAssistant contractorId={user?.uid} onCancelJob={setCancellingJob} />
                    )}

                    {activeView === 'team' && (
                        <TeamManagement contractorId={user?.uid} />
                    )}

                    {activeView === 'simulator' && (
                        <ScenarioSimulator
                            jobs={jobs}
                            team={team}
                            onApplyScenario={async (scenario) => {
                                // TODO: Implement actual scenario application
                                toast.success('Scenario applied successfully!');
                            }}
                        />
                    )}

                    {activeView === 'profitability' && (
                        <ProfitabilityDashboard contractorId={user?.uid} />
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
                        <SettingsView onSignOut={signOut} profile={profile} user={user} />
                    )}
                </main>
                
                {/* Mobile Nav */}
                <MobileNav
                    activeView={activeView}
                    onNavigate={handleNavigate}
                    pendingCount={pendingInvitations.length}
                />
            </div>

            {/* Cancel Job Modal */}
            <CancelJobModal
                isOpen={!!cancellingJob}
                job={cancellingJob}
                onConfirm={handleCancelJob}
                onClose={() => setCancellingJob(null)}
            />
        </div>
    );
};

export default ContractorProApp;
