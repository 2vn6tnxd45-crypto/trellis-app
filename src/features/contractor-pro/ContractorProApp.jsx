// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing
// UPDATED: Fix Initial Setup (updateDoc + dot notation) & File Structure Confirmation
// UPDATED: Added Job Completion Flow

import React, { useState, useCallback, useMemo } from 'react';
import { 
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft, Search,
    MapPin, Phone, Mail, Building2, Save, CheckCircle, Shield,
    Briefcase,
    Scroll as ScrollIcon,
    Receipt,
    Calendar, DollarSign, Clock, ChevronRight, Tag, AlertCircle,
    AlertTriangle, Loader2, Trash2, MessageSquare,
    ClipboardCheck  // NEW: Added for completion status
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Components
import { ContractorAuthScreen } from './components/ContractorAuthScreen';
import { SetupBusinessProfile } from './components/SetupBusinessProfile'; 
import { DashboardOverview } from './components/DashboardOverview';
import { Logo } from '../../components/common/Logo';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal';
import { InvoiceGenerator } from '../invoices/InvoiceGenerator';
import { ContractorCalendar } from './components/ContractorCalendar';
import { OfferTimeSlotsModal } from './components/OfferTimeSlotsModal';
import { BusinessSettings } from './components/BusinessSettings';
import { DragDropCalendar } from './components/DragDropCalendar';
import { RouteVisualization } from './components/RouteVisualization';
import { TechAssignmentPanel } from './components/TechAssignmentPanel';
import { LogoUpload } from './components/LogoUpload';

// Quote Components
import { 
    QuotesListView, 
    QuoteBuilder, 
    QuoteDetailView 
} from '../quotes';

// Job Scheduler Component
import { JobScheduler } from '../jobs/JobScheduler';

// NEW: Job Completion Components
import { JobCompletionForm } from '../jobs/components/completion';

// NEW: Rating Components
// NOTE: Uncomment this import once the ratings components are created:
// import { RateHomeownerModal } from '../ratings';

// Placeholder until component exists
const RateHomeownerModal = ({ job, contractorId, onClose, onSuccess }) => (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Rate Homeowner (Optional)</h2>
            <p className="text-slate-600 mb-4">How was your experience working with this customer?</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                <p className="text-slate-500 text-sm">Rating component placeholder</p>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={onClose}
                    className="flex-1 py-3 border border-slate-200 rounded-xl font-medium hover:bg-slate-50"
                >
                    Skip
                </button>
                <button 
                    onClick={() => { onSuccess?.(); }}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
                >
                    Submit Rating
                </button>
            </div>
        </div>
    </div>
);

// Hooks
import { useContractorAuth } from './hooks/useContractorAuth';
import { 
    useInvitations, 
    useCustomers, 
    useDashboardStats,
    useContractorJobs,
    useContractorInvoices
} from './hooks/useContractorData';

import { 
    useQuotes, 
    useQuoteTemplates, 
    useQuoteOperations 
} from '../quotes/hooks/useQuotes';

import { updateContractorSettings, deleteContractorAccount } from './lib/contractorService';
import { 
    deleteUser, 
    reauthenticateWithPopup, 
    GoogleAuthProvider, 
    EmailAuthProvider, 
    reauthenticateWithCredential,
    OAuthProvider 
} from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore'; // Changed setDoc to updateDoc
import { CONTRACTORS_COLLECTION_PATH } from '../../config/constants';

// ============================================
// HELPER: Date Comparison
// ============================================
const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
};

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
    pendingCount,
    pendingQuotesCount,
    activeJobsCount,
    unscheduledJobsCount
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
                    badge={activeJobsCount}
                />
                <NavItem 
                    icon={Calendar} 
                    label="Schedule" 
                    active={activeView === 'schedule'}
                    onClick={() => onNavigate('schedule')}
                    badge={unscheduledJobsCount}
                />
                <NavItem 
                    icon={Receipt}
                    label="Quotes"
                    active={activeView === 'quotes' || activeView === 'create-quote' || activeView === 'quote-detail' || activeView === 'edit-quote'}
                    onClick={() => onNavigate('quotes')}
                    badge={pendingQuotesCount}
                />
                <NavItem 
                    icon={ScrollIcon}
                    label="Invoices"
                    active={activeView === 'invoices' || activeView === 'create-invoice'}
                    onClick={() => onNavigate('invoices')}
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
const MobileNav = ({ activeView, onNavigate, pendingCount, pendingQuotesCount, activeJobsCount, unscheduledJobsCount }) => (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 z-50 safe-area-bottom">
        <div className="flex items-center justify-around">
            {[
                { id: 'dashboard', icon: Home, label: 'Home' },
                { id: 'jobs', icon: Briefcase, label: 'Jobs', badge: activeJobsCount },
                { id: 'schedule', icon: Calendar, label: 'Schedule', badge: unscheduledJobsCount },
                { id: 'quotes', icon: Receipt, label: 'Quotes', badge: pendingQuotesCount },
                { id: 'profile', icon: User, label: 'Profile' },
            ].map(item => (
                <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative ${
                        activeView === item.id || 
                        (item.id === 'invoices' && activeView === 'create-invoice') ||
                        (item.id === 'quotes' && ['create-quote', 'quote-detail', 'edit-quote'].includes(activeView))
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
// JOB STATUS CONFIG - UPDATED with completion statuses
// ============================================
const JOB_STATUS_CONFIG = {
    pending_schedule: {
        label: 'Needs Scheduling',
        color: 'bg-amber-100 text-amber-700',
        icon: Clock
    },
    scheduled: {
        label: 'Scheduled',
        color: 'bg-blue-100 text-blue-700',
        icon: Calendar
    },
    in_progress: {
        label: 'In Progress',
        color: 'bg-purple-100 text-purple-700',
        icon: Briefcase
    },
    // NEW: Pending completion status
    pending_completion: {
        label: 'Awaiting Review',
        color: 'bg-purple-100 text-purple-700',
        icon: ClipboardCheck
    },
    // NEW: Revision requested status
    revision_requested: {
        label: 'Revision Requested',
        color: 'bg-amber-100 text-amber-700',
        icon: AlertTriangle
    },
    completed: {
        label: 'Completed',
        color: 'bg-emerald-100 text-emerald-700',
        icon: CheckCircle
    },
    cancelled: {
        label: 'Cancelled',
        color: 'bg-slate-100 text-slate-500',
        icon: AlertCircle
    },
    scheduling: {
        label: 'Scheduling',
        color: 'bg-purple-100 text-purple-700',
        icon: Calendar
    },
    pending: {
        label: 'Pending',
        color: 'bg-amber-100 text-amber-700',
        icon: Clock
    },
    quoted: {
        label: 'Quote Accepted',
        color: 'bg-emerald-100 text-emerald-700',
        icon: CheckCircle
    }
};

// ============================================
// HELPER: Format Date
// ============================================
const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
};

// ============================================
// HELPER: Format Currency
// ============================================
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

// --- ENHANCED JOBS VIEW - UPDATED with completion button ---
const JobsView = ({ jobs, loading, onSelectJob, onCompleteJob }) => {
    const [filter, setFilter] = useState('active');
    
    const activeJobs = jobs?.filter(j => 
        j.status !== 'completed' && j.status !== 'cancelled'
    ) || [];
    
    const completedJobs = jobs?.filter(j => j.status === 'completed') || [];
    
    const displayedJobs = filter === 'active' 
        ? activeJobs 
        : filter === 'completed' 
            ? completedJobs 
            : jobs;

    const getStatusConfig = (status) => {
        return JOB_STATUS_CONFIG[status] || JOB_STATUS_CONFIG.pending;
    };

    // NEW: Helper to determine if job can be completed
    const canCompleteJob = (job) => {
        return ['scheduled', 'in_progress'].includes(job.status);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Jobs</h1>
                    <p className="text-slate-500">
                        {activeJobs.length} active job{activeJobs.length !== 1 ? 's' : ''}
                        {completedJobs.length > 0 && ` · ${completedJobs.length} completed`}
                    </p>
                </div>
                
                {/* Filter Tabs */}
                <div className="flex bg-slate-100 rounded-xl p-1">
                    {[
                        { key: 'active', label: 'Active', count: activeJobs.length },
                        { key: 'completed', label: 'Completed', count: completedJobs.length },
                        { key: 'all', label: 'All', count: jobs?.length || 0 }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filter === tab.key
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                                    filter === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Jobs List */}
            {loading ? (
                <div className="text-center py-10">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"/>
                </div>
            ) : displayedJobs?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Briefcase className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">
                        {filter === 'active' ? 'No Active Jobs' : filter === 'completed' ? 'No Completed Jobs' : 'No Jobs Yet'}
                    </h3>
                    <p className="text-slate-500">
                        {filter === 'active' 
                            ? 'When customers accept your quotes, jobs will appear here.'
                            : 'Completed jobs will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayedJobs.map(job => {
                        const statusConfig = getStatusConfig(job.status);
                        const StatusIcon = statusConfig.icon;
                        const latestProposal = job.proposedTimes && job.proposedTimes.length > 0 
                            ? job.proposedTimes[job.proposedTimes.length - 1] 
                            : null;

                        return (
                            <div 
                                key={job.id} 
                                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all"
                            >
                                <div 
                                    className="cursor-pointer"
                                    onClick={() => onSelectJob?.(job)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-bold text-slate-800 text-lg truncate">
                                                    {job.title || job.description || 'Service Request'}
                                                </h3>
                                                {job.sourceType === 'quote' && (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full flex items-center gap-1 shrink-0">
                                                        <FileText size={10} />
                                                        {job.sourceQuoteNumber || 'Quote'}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                                                {job.customer?.name && (
                                                    <span className="flex items-center gap-1">
                                                        <User size={14} />
                                                        {job.customer.name}
                                                    </span>
                                                )}
                                                {job.customer?.address && (
                                                    <span className="flex items-center gap-1 truncate">
                                                        <MapPin size={14} />
                                                        {job.customer.address}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-sm">
                                                {job.total > 0 && (
                                                    <span className="font-bold text-emerald-600">
                                                        {formatCurrency(job.total)}
                                                    </span>
                                                )}
                                                {job.scheduledTime && (
                                                    <span className="text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                                                        <Calendar size={14} />
                                                        {new Date(job.scheduledTime).toLocaleDateString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}
                                                    </span>
                                                )}
                                                {!job.scheduledTime && latestProposal && (
                                                    <span className="text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                                                        <Clock size={14} />
                                                        Proposed: {new Date(latestProposal.date).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'})}
                                                    </span>
                                                )}
                                                {!job.scheduledTime && !latestProposal && job.createdAt && (
                                                    <span className="text-slate-400 text-xs">
                                                        Created {formatDate(job.createdAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusConfig.color}`}>
                                                <StatusIcon size={12} />
                                                {statusConfig.label}
                                            </span>
                                            <ChevronRight size={20} className="text-slate-300" />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Action buttons row */}
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                                    {job.customer?.phone && (
                                        <a 
                                            href={`tel:${job.customer.phone}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 flex items-center gap-1.5 transition-colors"
                                        >
                                            <Phone size={12} />
                                            Call
                                        </a>
                                    )}
                                    {job.customer?.email && (
                                        <a 
                                            href={`mailto:${job.customer.email}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 flex items-center gap-1.5 transition-colors"
                                        >
                                            <Mail size={12} />
                                            Email
                                        </a>
                                    )}
                                    
                                    {/* NEW: Complete Job Button */}
                                    {canCompleteJob(job) && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCompleteJob?.(job);
                                            }}
                                            className="ml-auto px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors"
                                        >
                                            <CheckCircle size={12} />
                                            Complete Job
                                        </button>
                                    )}
                                    
                                    {/* NEW: Awaiting Review Status */}
                                    {job.status === 'pending_completion' && (
                                        <span className="ml-auto px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium flex items-center gap-1.5">
                                            <ClipboardCheck size={12} />
                                            Awaiting Customer Review
                                        </span>
                                    )}
                                    
                                    {/* NEW: Revision Requested - Resubmit Button */}
                                    {job.status === 'revision_requested' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCompleteJob?.(job);
                                            }}
                                            className="ml-auto px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 flex items-center gap-1.5 transition-colors"
                                        >
                                            <AlertTriangle size={12} />
                                            Resubmit Completion
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- INVOICES VIEW ---
const InvoicesView = ({ onCreateInvoice }) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
                <p className="text-slate-500">Manage your invoices and payments</p>
            </div>
            <button 
                onClick={onCreateInvoice}
                className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2"
            >
                <Plus size={18} />
                New Invoice
            </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <ScrollIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-bold text-slate-800 text-lg mb-2">Invoice List Coming Soon</h3>
            <p className="text-slate-500 mb-4">For now, create new invoices using the button above.</p>
        </div>
    </div>
);

// --- INVITATIONS VIEW ---
const InvitationsView = ({ invitations, loading, onCreate }) => {
    const getStatusInfo = (status) => {
        switch(status) {
            case 'claimed': return { color: 'bg-emerald-100 text-emerald-700', label: 'Claimed' };
            case 'pending': return { color: 'bg-amber-100 text-amber-700', label: 'Pending' };
            default: return { color: 'bg-slate-100 text-slate-600', label: status };
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Invitations</h1>
                    <p className="text-slate-500">Records you've shared with homeowners</p>
                </div>
                <button onClick={onCreate} className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2">
                    <Plus size={18} />
                    Create Invitation
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10"><div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"/></div>
            ) : invitations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No Invitations Yet</h3>
                    <p className="text-slate-500 mb-4">Create your first invitation to share service records with a homeowner.</p>
                    <button onClick={onCreate} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700">Create Invitation</button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                    {invitations.map(inv => {
                        const statusInfo = getStatusInfo(inv.status);
                        return (
                            <div key={inv.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800">{inv.recordCount || 0} record(s)</p>
                                        <p className="text-sm text-slate-500">{inv.recipientEmail || 'No email specified'}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- ENHANCED CUSTOMERS VIEW ---
const CustomersView = ({ customers, loading, onSelectCustomer }) => {
    const [sortBy, setSortBy] = useState('lastContact');
    
    const sortedCustomers = [...(customers || [])].sort((a, b) => {
        if (sortBy === 'totalSpend') {
            return (b.totalSpend || 0) - (a.totalSpend || 0);
        }
        if (sortBy === 'totalJobs') {
            return (b.totalJobs || 0) - (a.totalJobs || 0);
        }
        const aDate = a.lastContact?.toDate?.() || new Date(0);
        const bDate = b.lastContact?.toDate?.() || new Date(0);
        return bDate - aDate;
    });

    const totalRevenue = customers?.reduce((sum, c) => sum + (c.totalSpend || 0), 0) || 0;
    const totalJobsCount = customers?.reduce((sum, c) => sum + (c.totalJobs || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
                    <p className="text-slate-500">
                        {customers?.length || 0} customer{customers?.length !== 1 ? 's' : ''} · {formatCurrency(totalRevenue)} total revenue
                    </p>
                </div>
                
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 bg-white"
                >
                    <option value="lastContact">Recent Activity</option>
                    <option value="totalSpend">Highest Spend</option>
                    <option value="totalJobs">Most Jobs</option>
                </select>
            </div>

            {customers?.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <p className="text-sm text-slate-500 mb-1">Total Customers</p>
                        <p className="text-2xl font-bold text-slate-800">{customers.length}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <p className="text-sm text-slate-500 mb-1">Total Jobs</p>
                        <p className="text-2xl font-bold text-slate-800">{totalJobsCount}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10">
                    <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"/>
                </div>
            ) : customers?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No Customers Yet</h3>
                    <p className="text-slate-500">When customers accept your quotes or claim invitations, they'll appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedCustomers.map(customer => (
                        <div 
                            key={customer.id}
                            onClick={() => onSelectCustomer?.(customer)}
                            className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                        >
                            <div className="flex items-start gap-4">
                                <div className="h-14 w-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0">
                                    {(customer.customerName || customer.email || 'C').charAt(0).toUpperCase()}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-slate-800 text-lg truncate">
                                            {customer.customerName || 'Customer'}
                                        </h3>
                                        {customer.source === 'quote' && (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                                                Via Quote
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mb-3">
                                        {customer.email && (
                                            <a 
                                                href={`mailto:${customer.email}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                                            >
                                                <Mail size={14} />
                                                {customer.email}
                                            </a>
                                        )}
                                        {customer.phone && (
                                            <a 
                                                href={`tel:${customer.phone}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                                            >
                                                <Phone size={14} />
                                                {customer.phone}
                                            </a>
                                        )}
                                        {customer.address && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={14} />
                                                {customer.address}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="flex items-center gap-1 text-slate-600">
                                            <Briefcase size={14} className="text-slate-400" />
                                            <span className="font-medium">{customer.totalJobs || 0}</span> job{customer.totalJobs !== 1 ? 's' : ''}
                                        </span>
                                        <span className="font-bold text-emerald-600">
                                            {formatCurrency(customer.totalSpend)}
                                        </span>
                                        {customer.lastContact && (
                                            <span className="text-slate-400 text-xs">
                                                Last contact: {formatDate(customer.lastContact)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-300 shrink-0" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- PROFILE VIEW ---
const ProfileView = ({ profile, onUpdateProfile }) => {
    // Determine contractorId from profile
    const contractorId = profile?.id || profile?.uid;

    const [formData, setFormData] = useState({
        companyName: profile?.profile?.companyName || '',
        displayName: profile?.profile?.displayName || '',
        email: profile?.profile?.email || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        specialty: profile?.profile?.specialty || '',
        logoUrl: profile?.profile?.logoUrl || null // NEW: Track logo URL
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdateProfile(formData);
            toast.success('Profile updated!');
        } catch (err) {
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
                <p className="text-slate-500">Your business information</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                
                {/* NEW: Logo Upload in Profile View */}
                <div className="pb-4 border-b border-slate-100">
                    <LogoUpload 
                        currentLogo={formData.logoUrl}
                        onUpload={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                        contractorId={contractorId}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
                        <input type="text" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
                        <input type="text" value={formData.displayName} onChange={(e) => setFormData({...formData, displayName: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                        <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Address</label>
                        <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">License Number</label>
                        <input type="text" value={formData.licenseNumber} onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specialty</label>
                        <input type="text" value={formData.specialty} onChange={(e) => setFormData({...formData, specialty: e.target.value})} placeholder="e.g., HVAC, Plumbing" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                    {saving ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                    Save Changes
                </button>
            </div>
        </div>
    );
};

// ============================================
// CONTRACTOR DELETE ACCOUNT MODAL
// ============================================
const ContractorDeleteAccountModal = ({ isOpen, onClose, user, contractorId, onDeleteSuccess }) => {
    const [step, setStep] = useState(1);
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    // Check providers
    const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
    const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');

    const handleReauthenticate = async () => {
        setError('');
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error('No user found');

            const providers = currentUser.providerData.map(p => p.providerId);

            if (providers.includes('google.com')) {
                await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
            } else if (providers.includes('apple.com')) {
                const provider = new OAuthProvider('apple.com');
                await reauthenticateWithPopup(currentUser, provider);
            } else if (providers.includes('password')) {
                const credential = EmailAuthProvider.credential(currentUser.email, password);
                await reauthenticateWithCredential(currentUser, credential);
            } else {
                throw new Error('Please sign out and sign in again to delete your account.');
            }
            setStep(2);
        } catch (err) {
            console.error('Re-auth error:', err);
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    const handleDelete = async () => {
        if (confirmText !== 'DELETE') return;
        
        setIsDeleting(true);
        setError('');
        
        try {
            // 1. Delete contractor specific data
            await deleteContractorAccount(contractorId);
            
            // 2. Delete Firebase Auth user
            if (auth.currentUser) {
                await deleteUser(auth.currentUser);
            }
            
            toast.success('Account deleted successfully');
            onDeleteSuccess();
        } catch (err) {
            console.error('Delete account error:', err);
            if (err.code === 'auth/requires-recent-login') {
                setError('Security timeout. Please refresh the page and try again immediately.');
            } else {
                setError(err.message.replace('Firebase: ', ''));
            }
            setIsDeleting(false);
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setPassword('');
        setConfirmText('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-red-50 border-b border-red-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-full">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-900">Delete Account</h2>
                            <p className="text-sm text-red-700">This action cannot be undone</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <>
                            <p className="text-slate-600">
                                To delete your account, please verify your identity first.
                            </p>
                            
                            {isGoogleUser ? (
                                <button
                                    onClick={handleReauthenticate}
                                    className="w-full p-3 border border-slate-300 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors font-medium"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Verify with Google
                                </button>
                            ) : isEmailUser ? (
                                <div className="space-y-3">
                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-700">Enter your password</span>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            placeholder="••••••••"
                                        />
                                    </label>
                                    <button
                                        onClick={handleReauthenticate}
                                        disabled={!password}
                                        className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-slate-600 mb-4">
                                        Please re-authenticate to continue.
                                    </p>
                                    <button
                                        onClick={handleReauthenticate}
                                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                                    >
                                        Verify Identity
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-amber-800 text-sm font-medium mb-2">
                                    You are about to permanently delete:
                                </p>
                                <ul className="text-amber-700 text-sm space-y-1">
                                    <li>• Your business profile</li>
                                    <li>• All job history & quotes</li>
                                    <li>• Client connections</li>
                                    <li>• Invoices and settings</li>
                                </ul>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">
                                        Type <span className="font-mono bg-slate-100 px-1 rounded">DELETE</span> to confirm
                                    </span>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                        className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                                        placeholder="DELETE"
                                    />
                                </label>
                            </div>

                            <button
                                onClick={handleDelete}
                                disabled={confirmText !== 'DELETE' || isDeleting}
                                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5" />
                                        Permanently Delete Account
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        onClick={resetAndClose}
                        className="w-full py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SETTINGS VIEW ---
const SettingsView = ({ user, profile, onUpdateSettings, onSignOut }) => {
    const [settings, setSettings] = useState({
        emailNotifications: profile?.settings?.emailNotifications ?? true,
        smsNotifications: profile?.settings?.smsNotifications ?? false,
        weeklyDigest: profile?.settings?.weeklyDigest ?? true
    });
    const [saving, setSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await onUpdateSettings(profile.id, { settings });
            toast.success('Settings saved!');
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
                <p className="text-slate-500">Manage your preferences</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Notifications</h3>
                {[
                    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                    { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive text message alerts' },
                    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Get a summary of your activity' },
                ].map(item => (
                    <label key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer">
                        <div>
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <input type="checkbox" checked={settings[item.key]} onChange={(e) => setSettings({...settings, [item.key]: e.target.checked})} className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
                    </label>
                ))}
                <button onClick={handleSaveSettings} disabled={saving} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                    {saving ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                    Save Settings
                </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h3 className="font-bold text-red-800 mb-2">Danger Zone</h3>
                <p className="text-sm text-red-600 mb-4">Permanently delete your account and all data.</p>
                <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Delete Account</button>
            </div>

            <ContractorDeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                user={user}
                contractorId={profile?.id}
                onDeleteSuccess={onSignOut}
            />
        </div>
    );
};

// ============================================
// MAIN APP
// ============================================
export const ContractorProApp = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedQuote, setSelectedQuote] = useState(null); 
    const [selectedJob, setSelectedJob] = useState(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [offeringTimesJob, setOfferingTimesJob] = useState(null);
    const [scheduleView, setScheduleView] = useState('calendar'); 
    const [selectedDate, setSelectedDate] = useState(new Date()); 
    
    // NEW: Job completion state
    const [completingJob, setCompletingJob] = useState(null);
    const [ratingHomeowner, setRatingHomeowner] = useState(null);

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
    
    // Data hooks
    const { invitations, loading: invitationsLoading, pendingInvitations } = useInvitations(user?.uid);
    const { customers, loading: customersLoading, byLastContact: customersByLastContact } = useCustomers(user?.uid);
    const { stats, loading: statsLoading } = useDashboardStats(user?.uid);
    const { jobs, loading: jobsLoading } = useContractorJobs(user?.uid);
    const { invoices, loading: invoicesLoading } = useContractorInvoices(user?.uid);
    
    // Quote Hooks
    const contractorId = profile?.id || user?.uid;
    const { 
        quotes, 
        pendingQuotes, 
        acceptedQuotes,
        loading: quotesLoading 
    } = useQuotes(contractorId);
    
    const { templates: quoteTemplates } = useQuoteTemplates(contractorId);
    
    const { 
        create: createQuoteFn, 
        update: updateQuoteFn, 
        remove: deleteQuoteFn, 
        send: sendQuoteFn,
        getShareLink,
        isCreating: isCreatingQuote,
        isUpdating: isUpdatingQuote,
        isSending: isSendingQuote
    } = useQuoteOperations(contractorId);
    
    const activeJobsCount = jobs?.filter(j => 
        j.status !== 'completed' && j.status !== 'cancelled'
    ).length || 0;

    // Count unscheduled jobs correctly for Schedule badge
    const unscheduledJobsCount = useMemo(() => {
        return jobs?.filter(job => 
            !job.scheduledTime && 
            !job.scheduledDate &&
            !['completed', 'cancelled'].includes(job.status)
        ).length || 0;
    }, [jobs]);

    const hasTeam = profile?.scheduling?.teamType === 'team';
    
    // UPDATED: Handle Initial Setup using updateDoc with Dot Notation
    const handleInitialSetup = async (formData) => {
        console.log("handleInitialSetup called with:", formData);
        setIsSavingProfile(true);
        try {
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, user.uid);
            
            // Construct updates using dot notation to avoid overwriting nested maps
            const updates = {};
            
            // Profile fields
            if (formData.profile) {
                if (formData.profile.companyName) updates['profile.companyName'] = formData.profile.companyName;
                if (formData.profile.phone) updates['profile.phone'] = formData.profile.phone;
                if (formData.profile.address) updates['profile.address'] = formData.profile.address;
                if (formData.profile.licenseNumber) updates['profile.licenseNumber'] = formData.profile.licenseNumber;
                if (formData.profile.logoUrl) updates['profile.logoUrl'] = formData.profile.logoUrl;
            }
            
            // Scheduling fields (root level 'scheduling' map - usually safe to overwrite as it's new)
            // But we can use dot notation here too for consistency if prefer
            if (formData.scheduling) {
                updates['scheduling'] = formData.scheduling;
            } else {
                // Fallback legacy structure
                updates['profile.companyName'] = formData.companyName;
                updates['profile.phone'] = formData.phone;
                updates['profile.address'] = formData.address;
            }

            // Use updateDoc to patch existing document
            await updateDoc(contractorRef, updates);
            
            toast.success("Profile setup complete!");
            
        } catch (error) {
            console.error("Setup error:", error);
            // Fallback: If document doesn't exist (rare), use setDoc with merge
            if (error.code === 'not-found') {
                 // Re-construct full object for setDoc
                 const setPayload = {};
                 if (formData.profile) setPayload.profile = formData.profile;
                 if (formData.scheduling) setPayload.scheduling = formData.scheduling;
                 // import setDoc needed here if using fallback, but updateDoc handles 99% of cases
            }
            toast.error("Failed to save profile: " + error.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleNavigate = useCallback((view) => {
        if (!['quotes', 'create-quote', 'quote-detail', 'edit-quote'].includes(view)) {
            setSelectedQuote(null);
        }
        setActiveView(view);
    }, []);
    
    const handleCreateInvitation = useCallback(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('pro', 'invite');
        window.location.href = url.toString();
    }, []);
    
    // Quote Handlers
    const handleCreateQuote = useCallback(() => {
        setSelectedQuote(null);
        setActiveView('create-quote');
    }, []);
    
    const handleSelectQuote = useCallback((quote) => {
        setSelectedQuote(quote);
        setActiveView('quote-detail');
    }, []);
    
    const handleEditQuote = useCallback(() => {
        setActiveView('edit-quote');
    }, []);
    
    const handleSaveQuote = useCallback(async (quoteData) => {
        try {
            if (selectedQuote) {
                await updateQuoteFn(selectedQuote.id, quoteData);
                setSelectedQuote(prev => ({ ...prev, ...quoteData }));
                toast.success('Quote updated');
            } else {
                const result = await createQuoteFn(quoteData);
                toast.success('Quote saved');
                setActiveView('quotes');
            }
        } catch (error) {
            toast.error('Failed to save quote: ' + error.message);
            throw error;
        }
    }, [selectedQuote, updateQuoteFn, createQuoteFn]);
    
    const handleSendQuote = useCallback(async (quoteData) => {
        try {
            let quoteId;
            if (selectedQuote) {
                await updateQuoteFn(selectedQuote.id, quoteData);
                quoteId = selectedQuote.id;
            } else {
                const result = await createQuoteFn({ ...quoteData, status: 'draft' });
                quoteId = result.quoteId;
            }
            
            await sendQuoteFn(quoteId);
            toast.success('Quote sent to customer!');
            setSelectedQuote(null);
            setActiveView('quotes');
        } catch (error) {
            toast.error('Failed to send quote: ' + error.message);
            throw error;
        }
    }, [selectedQuote, updateQuoteFn, createQuoteFn, sendQuoteFn]);
    
    const handleDeleteQuote = useCallback(async (quoteId) => {
        try {
            await deleteQuoteFn(quoteId);
            setSelectedQuote(null);
            setActiveView('quotes');
        } catch (error) {
            toast.error('Failed to delete quote: ' + error.message);
            throw error;
        }
    }, [deleteQuoteFn]);
    
    const handleQuoteBack = useCallback(() => {
        if (activeView === 'edit-quote') {
            setActiveView('quote-detail');
        } else {
            setSelectedQuote(null);
            setActiveView('quotes');
        }
    }, [activeView]);

    const handleJobClick = useCallback((job) => {
        if (['quoted', 'scheduling', 'pending_schedule', 'slots_offered', 'accepted'].includes(job.status)) {
            setOfferingTimesJob(job);
        } else if (job.status === 'scheduled') {
            // For already scheduled jobs, show the job details modal (existing behavior)
            setSelectedJob(job);
        } else {
            // Fallback for other statuses
            setSelectedJob(job);
        }
    }, []);

    // NEW: Handle complete job button click
    const handleCompleteJob = useCallback((job) => {
        setCompletingJob(job);
    }, []);

    // NEW: Handle completion success - optionally prompt for rating
    const handleCompletionSuccess = useCallback((job) => {
        setCompletingJob(null);
        // Optionally prompt to rate the homeowner
        setRatingHomeowner(job);
    }, []);
    
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Dashboard';
            case 'jobs': return 'My Jobs'; 
            case 'schedule': return 'Schedule'; 
            case 'quotes': return 'Quotes'; 
            case 'create-quote': return 'New Quote'; 
            case 'quote-detail': return 'Quote Details'; 
            case 'edit-quote': return 'Edit Quote'; 
            case 'invoices': return 'Invoices';
            case 'create-invoice': return 'New Invoice';
            case 'invitations': return 'Invitations';
            case 'customers': return 'Customers';
            case 'profile': return 'Profile';
            case 'settings': return 'Settings';
            default: return 'Dashboard';
        }
    };
    
    if (authLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Loading...</p></div>;
    
    if (!isAuthenticated) return <ContractorAuthScreen onSignIn={signIn} onSignUp={signUp} onGoogleSignIn={signInWithGoogle} loading={authLoading} error={authError} onClearError={clearError} />;
    
    const isProfileComplete = profile?.profile?.companyName && profile?.profile?.phone;

    if (!isProfileComplete) {
        return (
            <SetupBusinessProfile 
                profile={profile} 
                onSave={handleInitialSetup} 
                saving={isSavingProfile} 
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Toaster position="top-center" />
            <SidebarNav 
                profile={profile} 
                activeView={activeView} 
                onNavigate={handleNavigate} 
                onSignOut={signOut} 
                pendingCount={pendingInvitations.length}
                pendingQuotesCount={pendingQuotes?.length || 0}
                activeJobsCount={activeJobsCount}
                unscheduledJobsCount={unscheduledJobsCount}
            />
            
            <div className="flex-1 flex flex-col min-h-screen">
                <MobileHeader title={getViewTitle()} onCreateInvitation={handleCreateInvitation} />
                
                <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
                    {activeView === 'dashboard' && (
                        <DashboardOverview 
                            profile={profile} 
                            stats={stats} 
                            invitations={invitations} 
                            customers={customersByLastContact} 
                            loading={statsLoading} 
                            onCreateInvitation={handleCreateInvitation} 
                            onViewAllInvitations={() => handleNavigate('invitations')} 
                            onViewAllCustomers={() => handleNavigate('customers')} 
                        />
                    )}
                    
                    {activeView === 'jobs' && (
                        <JobsView 
                            jobs={jobs} 
                            loading={jobsLoading} 
                            onSelectJob={handleJobClick}
                            onCompleteJob={handleCompleteJob}  // NEW: Pass completion handler
                        />
                    )}
                    
                    {activeView === 'schedule' && (
                        <div className="space-y-4">
                            <div className="flex bg-slate-100 rounded-xl p-1">
                                <button
                                    onClick={() => setScheduleView('calendar')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        scheduleView === 'calendar' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Calendar
                                </button>
                                <button
                                    onClick={() => setScheduleView('drag')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        scheduleView === 'drag' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Drag & Drop
                                </button>
                                <button
                                    onClick={() => setScheduleView('route')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        scheduleView === 'route' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    Route
                                </button>
                                {hasTeam && (
                                    <button
                                        onClick={() => setScheduleView('team')}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                            scheduleView === 'team' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        Team
                                    </button>
                                )}
                            </div>
                            
                            {scheduleView === 'calendar' && (
                                <ContractorCalendar 
                                    jobs={jobs}
                                    onSelectJob={handleJobClick}
                                    onOfferTimes={(job) => setOfferingTimesJob(job)}
                                    onCreateJob={() => setActiveView('create-quote')}
                                />
                            )}
                            {scheduleView === 'drag' && (
                                <DragDropCalendar 
                                    jobs={jobs}
                                    preferences={profile?.scheduling}
                                    onJobUpdate={() => {}}
                                    onJobClick={handleJobClick}
                                />
                            )}
                            {scheduleView === 'route' && (
    <RouteVisualization 
        jobs={jobs?.filter(j => isSameDay(j.scheduledTime, selectedDate)) || []}
        date={selectedDate}
        preferences={profile?.scheduling}
        teamMembers={profile?.scheduling?.teamMembers || []} // <--- ADD THIS LINE
        onJobClick={handleJobClick}
        onReorder={() => {}}
        onDateChange={(date) => setSelectedDate(date)}
    />
)}
                            {scheduleView === 'team' && (
                                <TechAssignmentPanel 
                                    jobs={jobs}
                                    teamMembers={profile?.scheduling?.teamMembers || []}
                                    onJobUpdate={() => {}}
                                />
                            )}
                        </div>
                    )}

                    {activeView === 'quotes' && (
                        <QuotesListView 
                            quotes={quotes}
                            loading={quotesLoading}
                            onCreateQuote={handleCreateQuote}
                            onSelectQuote={handleSelectQuote}
                        />
                    )}
                    
                    {activeView === 'create-quote' && (
                        <QuoteBuilder
                            quote={null}
                            customers={customers}
                            templates={quoteTemplates}
                            contractorProfile={profile}
                            onBack={handleQuoteBack}
                            onSave={handleSaveQuote}
                            onSend={handleSendQuote}
                            isSaving={isCreatingQuote || isUpdatingQuote}
                            isSending={isSendingQuote}
                        />
                    )}
                    
                    {activeView === 'quote-detail' && selectedQuote && (
                        <QuoteDetailView
                            quote={selectedQuote}
                            contractorProfile={profile?.profile}
                            onBack={handleQuoteBack}
                            onEdit={handleEditQuote}
                            onDelete={handleDeleteQuote}
                            getShareLink={getShareLink}
                        />
                    )}
                    
                    {activeView === 'edit-quote' && selectedQuote && (
                        <QuoteBuilder
                            quote={selectedQuote}
                            customers={customers}
                            templates={quoteTemplates}
                            contractorProfile={profile}
                            onBack={handleQuoteBack}
                            onSave={handleSaveQuote}
                            onSend={handleSendQuote}
                            isSaving={isUpdatingQuote}
                            isSending={isSendingQuote}
                        />
                    )}
                    
                    {activeView === 'invoices' && <InvoicesView onCreateInvoice={() => setActiveView('create-invoice')} />}
                    {activeView === 'create-invoice' && <InvoiceGenerator contractorProfile={profile} customers={customers} onBack={() => setActiveView('invoices')} />}
                    
                    {activeView === 'invitations' && <InvitationsView invitations={invitations} loading={invitationsLoading} onCreate={handleCreateInvitation} />}
                    {activeView === 'customers' && <CustomersView customers={customers} loading={customersLoading} />}
                    {activeView === 'profile' && <ProfileView profile={profile} onUpdateProfile={updateProfile} />}
                    
                    {activeView === 'settings' && (
                        <div className="space-y-8">
                            <BusinessSettings 
                                contractorId={contractorId}
                                profile={profile}
                                onUpdate={(settings) => console.log('Settings updated:', settings)}
                            />
                            <div className="pt-8 border-t border-slate-200">
                                <SettingsView 
                                    user={user}
                                    profile={profile} 
                                    onUpdateSettings={updateContractorSettings} 
                                    onSignOut={signOut} 
                                />
                            </div>
                        </div>
                    )}
                </main>
                
                <MobileNav 
                    activeView={activeView} 
                    onNavigate={handleNavigate} 
                    pendingCount={pendingInvitations.length}
                    pendingQuotesCount={pendingQuotes?.length || 0}
                    activeJobsCount={activeJobsCount}
                    unscheduledJobsCount={unscheduledJobsCount}
                />
            </div>

            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-800">Manage Job</h3>
                                <p className="text-xs text-slate-500">{selectedJob.customerName || 'Customer'}</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-grow overflow-hidden bg-slate-50">
                            <JobScheduler 
                                job={jobs.find(j => j.id === selectedJob.id) || selectedJob} 
                                userType="contractor" 
                                contractorId={profile?.id || user?.uid} 
                                onUpdate={() => {}} 
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {offeringTimesJob && (
                <OfferTimeSlotsModal
                    job={offeringTimesJob}
                    allJobs={jobs} // PASSED ALL JOBS FOR CONFLICT CHECK
                    schedulingPreferences={profile?.scheduling}
                    onClose={() => setOfferingTimesJob(null)}
                    onSuccess={() => setOfferingTimesJob(null)}
                />
            )}

            {/* NEW: Job Completion Form Modal */}
            {/* Job Completion Modal - Component handles its own modal styling */}
            {completingJob && (
                <JobCompletionForm
                    job={jobs.find(j => j.id === completingJob.id) || completingJob}
                    contractorId={profile?.id || user?.uid}
                    onSuccess={() => handleCompletionSuccess(completingJob)}
                    onClose={() => setCompletingJob(null)}
                />
            )}

            {/* NEW: Rate Homeowner Modal (optional, after completion) */}
            {ratingHomeowner && (
                <RateHomeownerModal
                    job={ratingHomeowner}
                    contractorId={profile?.id || user?.uid}
                    onClose={() => setRatingHomeowner(null)}
                    onSuccess={() => {
                        setRatingHomeowner(null);
                        toast.success('Rating submitted!');
                    }}
                />
            )}
        </div>
    );
};

export default ContractorProApp;
