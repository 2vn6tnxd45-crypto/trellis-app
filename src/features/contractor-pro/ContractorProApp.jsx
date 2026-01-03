// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing
// UPDATED: Added Job Scheduling Integration

import React, { useState, useCallback, useMemo } from 'react';
import { 
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft, Search,
    MapPin, Phone, Mail, Building2, Save, CheckCircle, Shield,
    Briefcase,
    Scroll as ScrollIcon,
    Receipt,
    // ADDED: Icons for enhanced views
    Calendar, DollarSign, Clock, ChevronRight, Tag, AlertCircle
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

// ADDED: Quote Components
import { 
    QuotesListView, 
    QuoteBuilder, 
    QuoteDetailView 
} from '../quotes';

// ADDED: Job Scheduler Component
import { JobScheduler } from '../jobs/JobScheduler';

// Hooks
import { useContractorAuth } from './hooks/useContractorAuth';
import { 
    useInvitations, 
    useCustomers, 
    useDashboardStats,
    useContractorJobs,
    useContractorInvoices
} from './hooks/useContractorData';

// ADDED: Quote Hooks
import { 
    useQuotes, 
    useQuoteTemplates, 
    useQuoteOperations 
} from '../quotes/hooks/useQuotes';

import { updateContractorSettings, deleteContractorAccount } from './lib/contractorService';
import { deleteUser } from 'firebase/auth';
import { auth } from '../../config/firebase';

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
// JOB STATUS CONFIG
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

// --- ENHANCED JOBS VIEW ---
const JobsView = ({ jobs, loading, onSelectJob }) => {
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
                        
                        // Get the latest proposal if one exists
                        const latestProposal = job.proposedTimes && job.proposedTimes.length > 0 
                            ? job.proposedTimes[job.proposedTimes.length - 1] 
                            : null;

                        return (
                            <div 
                                key={job.id} 
                                onClick={() => onSelectJob?.(job)}
                                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    {/* Left: Job Info */}
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
                                        
                                        {/* Customer Info */}
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
                                        
                                        {/* Meta Row */}
                                        <div className="flex items-center gap-4 text-sm">
                                            {job.total > 0 && (
                                                <span className="font-bold text-emerald-600">
                                                    {formatCurrency(job.total)}
                                                </span>
                                            )}
                                            {/* Show confirmed scheduled time */}
                                            {job.scheduledTime && (
                                                <span className="text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                                                    <Calendar size={14} />
                                                    {new Date(job.scheduledTime).toLocaleDateString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}
                                                </span>
                                            )}
                                            {/* Show latest proposed time if not yet confirmed */}
                                            {!job.scheduledTime && latestProposal && (
                                                <span className="text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                                                    <Clock size={14} />
                                                    Proposed: {new Date(latestProposal.date).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'})}
                                                </span>
                                            )}
                                            {/* Show created date if no scheduling activity */}
                                            {!job.scheduledTime && !latestProposal && job.createdAt && (
                                                <span className="text-slate-400 text-xs">
                                                    Created {formatDate(job.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Right: Status & Arrow */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusConfig.color}`}>
                                            <StatusIcon size={12} />
                                            {statusConfig.label}
                                        </span>
                                        <ChevronRight size={20} className="text-slate-300" />
                                    </div>
                                </div>
                                
                                {/* Quick Contact Actions */}
                                {(job.customer?.phone || job.customer?.email) && (
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
                                    </div>
                                )}
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
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
                    <p className="text-slate-500">
                        {customers?.length || 0} customer{customers?.length !== 1 ? 's' : ''} · {formatCurrency(totalRevenue)} total revenue
                    </p>
                </div>
                
                {/* Sort Dropdown */}
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

            {/* Stats Cards */}
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

            {/* Customers List */}
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
                                {/* Avatar */}
                                <div className="h-14 w-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0">
                                    {(customer.customerName || customer.email || 'C').charAt(0).toUpperCase()}
                                </div>
                                
                                {/* Info */}
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
                                    
                                    {/* Contact Info */}
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
                                    
                                    {/* Stats Row */}
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
                                
                                {/* Arrow */}
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
    const [formData, setFormData] = useState({
        companyName: profile?.profile?.companyName || '',
        displayName: profile?.profile?.displayName || '',
        email: profile?.profile?.email || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        specialty: profile?.profile?.specialty || ''
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

// --- SETTINGS VIEW ---
const SettingsView = ({ profile, onUpdateSettings, onSignOut }) => {
    const [settings, setSettings] = useState({
        emailNotifications: profile?.settings?.emailNotifications ?? true,
        smsNotifications: profile?.settings?.smsNotifications ?? false,
        weeklyDigest: profile?.settings?.weeklyDigest ?? true
    });
    const [saving, setSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteContractorAccount(profile.id);
            await deleteUser(auth.currentUser);
            toast.success('Account deleted');
            onSignOut();
        } catch (err) {
            toast.error('Failed to delete account: ' + err.message);
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
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

            <DeleteConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteAccount}
                title="Delete Account?"
                message="This will permanently delete your profile, settings, and disconnect you from all homeowners. This action cannot be undone."
                isDeleting={isDeleting}
            />
        </div>
    );
};

// ============================================
// MAIN APP
// ============================================
export const ContractorProApp = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedQuote, setSelectedQuote] = useState(null); // ADDED: Selected quote state
    const [selectedJob, setSelectedJob] = useState(null); // ADDED: Selected job state for modal
    const [isSavingProfile, setIsSavingProfile] = useState(false); // NEW: State for setup screen
    const [offeringTimesJob, setOfferingTimesJob] = useState(null); // ADDED: For Calendar integration

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
    
    // ADDED: Quote Hooks
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
    
    // ADDED: Calculate active jobs count for badge
    const activeJobsCount = jobs?.filter(j => 
        j.status !== 'completed' && j.status !== 'cancelled'
    ).length || 0;

    // ADDED: Count unscheduled jobs
    const unscheduledJobsCount = useMemo(() => {
        return jobs?.filter(job => 
            !job.scheduledTime && 
            !job.scheduledDate &&
            !['completed', 'cancelled'].includes(job.status)
        ).length || 0;
    }, [jobs]);
    
    // NEW: Handler for initial profile setup
    const handleInitialSetup = async (formData) => {
        setIsSavingProfile(true);
        try {
            await updateProfile(formData);
            toast.success("Profile setup complete!");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save profile.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleNavigate = useCallback((view) => {
        // Reset selected quote when navigating away from quote views
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
    
    // ADDED: Quote Handlers
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

    // ADDED: Job Click Handler for Scheduler
    const handleJobClick = useCallback((job) => {
        // Open scheduler for relevant statuses
        if (['quoted', 'scheduling', 'scheduled', 'pending_schedule', 'slots_offered'].includes(job.status)) {
            setSelectedJob(job);
        } else {
            // For other states (like just created 'pending'), functionality might differ
            toast("View details feature coming soon for this status");
        }
    }, []);
    
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Dashboard';
            case 'jobs': return 'My Jobs'; 
            case 'schedule': return 'Schedule'; // ADDED
            case 'quotes': return 'Quotes'; // ADDED
            case 'create-quote': return 'New Quote'; // ADDED
            case 'quote-detail': return 'Quote Details'; // ADDED
            case 'edit-quote': return 'Edit Quote'; // ADDED
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
    
    // --- NEW: CHECK FOR INCOMPLETE PROFILE ---
    // If authenticated but missing key business details, force setup screen.
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
    // -----------------------------------------

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
                    
                    {/* UPDATED: Pass handleJobClick to JobsView */}
                    {activeView === 'jobs' && <JobsView jobs={jobs} loading={jobsLoading} onSelectJob={handleJobClick} />}
                    
                    {/* ADDED: Schedule View */}
                    {activeView === 'schedule' && (
                        <ContractorCalendar 
                            jobs={jobs}
                            onSelectJob={handleJobClick}
                            onOfferTimes={(job) => setOfferingTimesJob(job)}
                            onCreateJob={() => setActiveView('create-quote')}
                        />
                    )}

                    {/* ADDED: Quote Views */}
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
                    
                    {/* Invoice Views */}
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
                                onUpdate={(settings) => {
                                    // Optionally refresh profile
                                    console.log('Settings updated:', settings);
                                }}
                            />
                            <div className="pt-8 border-t border-slate-200">
                                <SettingsView profile={profile} onUpdateSettings={updateContractorSettings} onSignOut={signOut} />
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

            {/* ADDED: Job Scheduler Modal */}
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
                                onUpdate={() => {
                                    // Optional: Refresh list or close modal
                                    // Typically Firestore realtime listeners will auto-update the list underneath
                                }} 
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Offer Time Slots Modal */}
            {offeringTimesJob && (
                <OfferTimeSlotsModal
                    job={offeringTimesJob}
                    schedulingPreferences={profile?.scheduling}
                    onClose={() => setOfferingTimesJob(null)}
                    onSuccess={() => setOfferingTimesJob(null)}
                />
            )}
        </div>
    );
};

export default ContractorProApp;
