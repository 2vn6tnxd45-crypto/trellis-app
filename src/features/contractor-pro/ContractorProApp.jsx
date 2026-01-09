// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing
// UPDATED: Added Chat/Messages functionality and Profile Credentials
// UPDATED: Added Evaluations feature for pre-quote assessments

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft, Search,
    MapPin, Phone, Mail, Building2, Save, CheckCircle, Shield,
    Briefcase, BadgeCheck, Award, CreditCard,
    Scroll as ScrollIcon,
    Receipt,
    Calendar, DollarSign, Clock, ChevronRight, Tag, AlertCircle,
    AlertTriangle, Loader2, Trash2, MessageSquare,
    ClipboardCheck, Camera, Package
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

// NEW: Dispatch Board and Team Management
import { DispatchBoard } from './components/DispatchBoard';
import { TeamManagement } from './components/TeamManagement';
// NEW: Price Book
import { PriceBook } from './components/PriceBook';

// Chat Components
import { ContractorMessagesView } from './components/ContractorMessagesView';
// import { RecentMessagesWidget } from './components/RecentMessagesWidget';

// Quote Components
import { 
    QuotesListView, 
    QuoteBuilder, 
    QuoteDetailView 
} from '../quotes';

// Evaluation Components
import { 
    useEvaluations,
    CreateEvaluationRequest,
    EvaluationReview,
    EvaluationsListView,
    prepareQuoteFromEvaluation
} from '../evaluations';

import { ContractorLeadDashboard } from '../marketplace';

// Job Scheduler Component
import { JobScheduler } from '../jobs/JobScheduler';

// Job Completion Components - uncomment if available
// import { JobCompletionForm } from '../jobs/components/completion';

// Chat Service
import { subscribeToGlobalUnreadCount } from '../../lib/chatService';
import { EstimateTemplates } from './components/EstimateTemplates';

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
import { doc, updateDoc } from 'firebase/firestore';
import { CONTRACTORS_COLLECTION_PATH } from '../../config/constants';

// ============================================
// CONSTANTS
// ============================================
const PAYMENT_METHOD_OPTIONS = [
    'Credit Card',
    'Debit Card', 
    'Check',
    'Cash',
    'Bank Transfer',
    'Financing Available'
];

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
        {badge > 0 && (
            <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {badge}
            </span>
        )}
    </button>
);

// ============================================
// SIDEBAR
// ============================================
const Sidebar = ({ activeView, onNavigate, profile, onSignOut, pendingCount, pendingQuotesCount, activeJobsCount, unscheduledJobsCount, unreadMessageCount, completedEvalsCount }) => (
    <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
                {profile?.profile?.logoUrl ? (
                    <img src={profile.profile.logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                    <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Logo className="h-6 w-6 text-emerald-700" />
                    </div>
                )}
                <div>
                    <p className="font-bold text-slate-800">{profile?.profile?.companyName || 'My Business'}</p>
                    <p className="text-xs text-emerald-600 font-medium">krib <span className="bg-emerald-100 px-1 rounded">PRO</span></p>
                </div>
            </div>
        </div>
        
        {/* Nav */}
        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <NavItem icon={Home} label="Dashboard" active={activeView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
            
            {/* JOB LIFECYCLE: Find → Evaluate → Quote → Work → Get Paid */}
            <div className="pt-4 mt-4 border-t border-slate-100">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Workflow</p>
                <NavItem icon={Search} label="Find Work" active={activeView === 'leads'} onClick={() => onNavigate('leads')} />
                <NavItem icon={Camera} label="Evaluations" active={['evaluations', 'evaluation-detail', 'create-evaluation'].includes(activeView)} onClick={() => onNavigate('evaluations')} badge={completedEvalsCount} />
                <NavItem icon={FileText} label="Quotes" active={['quotes', 'create-quote', 'quote-detail', 'edit-quote'].includes(activeView)} onClick={() => onNavigate('quotes')} badge={pendingQuotesCount} />
                <NavItem icon={Briefcase} label="Jobs" active={activeView === 'jobs'} onClick={() => onNavigate('jobs')} badge={unscheduledJobsCount} />
                <NavItem icon={Calendar} label="Schedule" active={activeView === 'schedule'} onClick={() => onNavigate('schedule')} />
                <NavItem icon={ScrollIcon} label="Invoices" active={['invoices', 'create-invoice'].includes(activeView)} onClick={() => onNavigate('invoices')} />
            </div>
            
            {/* COMMUNICATION */}
            <div className="pt-4 mt-4 border-t border-slate-100">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Communication</p>
                <NavItem icon={MessageSquare} label="Messages" active={activeView === 'messages'} onClick={() => onNavigate('messages')} badge={unreadMessageCount} />
            </div>
            
            {/* MANAGEMENT */}
            <div className="pt-4 mt-4 border-t border-slate-100">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Management</p>
                <NavItem icon={Tag} label="Invitations" active={activeView === 'invitations'} onClick={() => onNavigate('invitations')} badge={pendingCount} />
                <NavItem icon={Users} label="Customers" active={activeView === 'customers'} onClick={() => onNavigate('customers')} />
                <NavItem icon={Package} label="Price Book" active={activeView === 'pricebook'} onClick={() => onNavigate('pricebook')} />
            </div>
            
            {/* ACCOUNT */}
            <div className="pt-4 mt-4 border-t border-slate-100">
                <NavItem icon={User} label="Profile" active={activeView === 'profile'} onClick={() => onNavigate('profile')} />
                <NavItem icon={SettingsIcon} label="Settings" active={activeView === 'settings'} onClick={() => onNavigate('settings')} />
            </div>
        </nav>
        
        {/* User */}
        <div className="p-4 border-t border-slate-100">
            <button 
                onClick={onSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
                <LogOut size={20} />
                <span className="font-medium">Sign Out</span>
            </button>
        </div>
    </aside>
);

// ============================================
// MOBILE NAV
// ============================================
const MobileNav = ({ activeView, onNavigate, pendingCount, pendingQuotesCount, activeJobsCount, unscheduledJobsCount, unreadMessageCount }) => (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-40">
        <div className="flex justify-around items-center">
            {[
                { id: 'dashboard', icon: Home, label: 'Home' },
                { id: 'jobs', icon: Briefcase, label: 'Jobs', badge: unscheduledJobsCount },
                { id: 'messages', icon: MessageSquare, label: 'Messages', badge: unreadMessageCount },
                { id: 'quotes', icon: FileText, label: 'Quotes', badge: pendingQuotesCount },
                { id: 'settings', icon: SettingsIcon, label: 'Settings' }
            ].map(item => (
                <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex flex-col items-center p-2 rounded-xl transition-colors relative ${
                        activeView === item.id || (item.id === 'quotes' && ['quotes', 'create-quote', 'quote-detail', 'edit-quote'].includes(activeView))
                            ? 'text-emerald-600' 
                            : 'text-slate-400'
                    }`}
                >
                    <item.icon size={22} />
                    <span className="text-xs mt-1 font-medium">{item.label}</span>
                    {item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {item.badge > 9 ? '9+' : item.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    </nav>
);

// ============================================
// HELPER FUNCTIONS
// ============================================
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ============================================
// JOBS VIEW
// ============================================
const JobsView = ({ jobs = [], loading, onJobClick, onCompleteJob }) => {
    const activeJobs = jobs.filter(j => !['completed', 'cancelled'].includes(j.status));
    const completedJobs = jobs.filter(j => j.status === 'completed');
    
    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-700';
            case 'in_progress': return 'bg-amber-100 text-amber-700';
            case 'completed': return 'bg-emerald-100 text-emerald-700';
            case 'pending_schedule': 
            case 'slots_offered':
            case 'quoted':
            case 'accepted':
                return 'bg-purple-100 text-purple-700';
            case 'pending_completion_approval': return 'bg-orange-100 text-orange-700';
            case 'completion_rejected': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };
    
    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending_schedule': return 'Needs Scheduling';
            case 'slots_offered': return 'Awaiting Response';
            case 'scheduled': return 'Scheduled';
            case 'in_progress': return 'In Progress';
            case 'completed': return 'Completed';
            case 'quoted': return 'Quote Accepted';
            case 'accepted': return 'Needs Scheduling';
            case 'pending_completion_approval': return 'Pending Approval';
            case 'completion_rejected': return 'Needs Resubmission';
            default: return status;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">My Jobs</h1>
                <p className="text-slate-500">Active jobs and history</p>
            </div>

            {activeJobs.length === 0 && completedJobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Briefcase className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No Jobs Yet</h3>
                    <p className="text-slate-500">Jobs from accepted quotes will appear here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeJobs.map(job => {
                        const showCompleteButton = job.status === 'scheduled' || job.status === 'in_progress';
                        const showResubmitButton = job.status === 'completion_rejected';
                        
                        return (
                            <div 
                                key={job.id}
                                onClick={() => onJobClick(job)}
                                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                                                {getStatusLabel(job.status)}
                                            </span>
                                            {job.jobNumber && (
                                                <span className="text-xs text-slate-400">#{job.jobNumber}</span>
                                            )}
                                        </div>
                                        <p className="font-bold text-slate-800 truncate">{job.title || job.serviceType || 'Job'}</p>
                                        <p className="text-sm text-slate-500">{job.customer?.name || job.customerName || 'Customer'}</p>
                                        {job.scheduledDate && (
                                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                <Calendar size={12} />
                                                {formatDate(job.scheduledDate)}
                                                {job.scheduledTime && ` at ${job.scheduledTime}`}
                                            </p>
                                        )}
                                    </div>
                                    
                                    {showCompleteButton && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCompleteJob(job);
                                            }}
                                            className="ml-auto px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors"
                                        >
                                            <ClipboardCheck size={12} />
                                            Complete
                                        </button>
                                    )}
                                    
                                    {showResubmitButton && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCompleteJob(job);
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
// --- INVOICES VIEW ---
const InvoicesView = ({ invoices = [], loading, onCreateInvoice }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'paid': return 'bg-emerald-100 text-emerald-700';
            case 'sent': return 'bg-blue-100 text-blue-700';
            case 'overdue': return 'bg-red-100 text-red-700';
            case 'draft': return 'bg-slate-100 text-slate-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    return (
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

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
            ) : invoices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <ScrollIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No Invoices Yet</h3>
                    <p className="text-slate-500">Create your first invoice to get started.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {invoices.map(invoice => (
                        <div 
                            key={invoice.id}
                            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusColor(invoice.status)}`}>
                                            {invoice.status || 'Draft'}
                                        </span>
                                        {invoice.invoiceNumber && (
                                            <span className="text-xs text-slate-400">#{invoice.invoiceNumber}</span>
                                        )}
                                    </div>
                                    <p className="font-bold text-slate-800 truncate">
                                        {invoice.customerName || invoice.customer?.name || 'Customer'}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {formatDate(invoice.createdAt)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-800">{formatCurrency(invoice.total)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

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
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
            ) : invitations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Tag className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No Invitations Yet</h3>
                    <p className="text-slate-500">Create your first invitation to start connecting with homeowners.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {invitations.map(inv => {
                        const statusInfo = getStatusInfo(inv.status);
                        return (
                            <div key={inv.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                        <p className="font-medium text-slate-800 mt-1">
                                            {inv.customerName || inv.email || 'Invitation'}
                                        </p>
                                        <p className="text-sm text-slate-400">
                                            Created {formatDate(inv.createdAt)}
                                        </p>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-300" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- CUSTOMERS VIEW ---
const CustomersView = ({ customers, loading }) => (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
            <p className="text-slate-500">Your connected homeowners</p>
        </div>

        {loading ? (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        ) : customers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Users className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <h3 className="font-bold text-slate-800 text-lg mb-2">No Customers Yet</h3>
                <p className="text-slate-500">Customers who claim your invitations will appear here.</p>
            </div>
        ) : (
            <div className="space-y-3">
                {customers.map(customer => (
                    <div key={customer.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-emerald-700 font-bold text-lg">
                                    {(customer.customerName || 'C')[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 truncate">{customer.customerName || 'Customer'}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                    <span className="flex items-center gap-1 truncate">
                                        <MapPin size={12} /> {customer.propertyName || 'No property'}
                                    </span>
                                    <span>
                                        {customer.jobCount || 0} job{customer.jobCount !== 1 ? 's' : ''}
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

// --- PROFILE VIEW (UPDATED WITH CREDENTIALS) ---
const ProfileView = ({ profile, onUpdateProfile }) => {
    const contractorId = profile?.id || profile?.uid;
    const [newCertification, setNewCertification] = useState('');

    const [formData, setFormData] = useState({
        // Basic Info
        companyName: profile?.profile?.companyName || '',
        displayName: profile?.profile?.displayName || '',
        email: profile?.profile?.email || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        specialty: profile?.profile?.specialty || '',
        logoUrl: profile?.profile?.logoUrl || null,
        // NEW: Credentials
        yearsInBusiness: profile?.profile?.yearsInBusiness || '',
        insured: profile?.profile?.insured || false,
        bonded: profile?.profile?.bonded || false,
        certifications: profile?.profile?.certifications || [],
        paymentMethods: profile?.profile?.paymentMethods || [],
    });
    const [saving, setSaving] = useState(false);

    // Update form when profile changes
    useEffect(() => {
        if (profile) {
            setFormData({
                companyName: profile?.profile?.companyName || '',
                displayName: profile?.profile?.displayName || '',
                email: profile?.profile?.email || '',
                phone: profile?.profile?.phone || '',
                address: profile?.profile?.address || '',
                licenseNumber: profile?.profile?.licenseNumber || '',
                specialty: profile?.profile?.specialty || '',
                logoUrl: profile?.profile?.logoUrl || null,
                yearsInBusiness: profile?.profile?.yearsInBusiness || '',
                insured: profile?.profile?.insured || false,
                bonded: profile?.profile?.bonded || false,
                certifications: profile?.profile?.certifications || [],
                paymentMethods: profile?.profile?.paymentMethods || [],
            });
        }
    }, [profile]);

    // Certification handlers
    const addCertification = () => {
        if (newCertification.trim() && !formData.certifications.includes(newCertification.trim())) {
            setFormData(prev => ({
                ...prev,
                certifications: [...prev.certifications, newCertification.trim()]
            }));
            setNewCertification('');
        }
    };

    const removeCertification = (cert) => {
        setFormData(prev => ({
            ...prev,
            certifications: prev.certifications.filter(c => c !== cert)
        }));
    };

    // Payment method toggle
    const togglePaymentMethod = (method) => {
        setFormData(prev => ({
            ...prev,
            paymentMethods: prev.paymentMethods.includes(method)
                ? prev.paymentMethods.filter(m => m !== method)
                : [...prev.paymentMethods, method]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onUpdateProfile({
                ...formData,
                yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null,
            });
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

            {/* Logo Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Company Logo</h3>
                <LogoUpload 
                    currentLogo={formData.logoUrl}
                    onUpload={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                    contractorId={contractorId}
                />
            </div>

            {/* Basic Info Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Basic Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
                        <input 
                            type="text" 
                            value={formData.companyName} 
                            onChange={(e) => setFormData({...formData, companyName: e.target.value})} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
                        <input 
                            type="text" 
                            value={formData.displayName} 
                            onChange={(e) => setFormData({...formData, displayName: e.target.value})} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input 
                            type="email" 
                            value={formData.email} 
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                        <input 
                            type="tel" 
                            value={formData.phone} 
                            onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Address</label>
                        <input 
                            type="text" 
                            value={formData.address} 
                            onChange={(e) => setFormData({...formData, address: e.target.value})} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">License Number</label>
                        <input 
                            type="text" 
                            value={formData.licenseNumber} 
                            onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})} 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Years in Business</label>
                        <input 
                            type="number" 
                            min="0"
                            value={formData.yearsInBusiness} 
                            onChange={(e) => setFormData({...formData, yearsInBusiness: e.target.value})} 
                            placeholder="e.g. 15"
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specialty / Trade</label>
                        <input 
                            type="text" 
                            value={formData.specialty} 
                            onChange={(e) => setFormData({...formData, specialty: e.target.value})} 
                            placeholder="e.g., HVAC, Plumbing, Electrical" 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                        />
                    </div>
                </div>
            </div>

            {/* Insurance & Bonding Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-2">Insurance & Bonding</h3>
                <p className="text-sm text-slate-500 mb-4">These badges will appear on your quotes to build customer trust.</p>
                
                <div className="flex flex-wrap gap-3">
                    <label 
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.insured 
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={formData.insured}
                            onChange={(e) => setFormData({ ...formData, insured: e.target.checked })}
                            className="sr-only"
                        />
                        <Shield size={18} className={formData.insured ? 'text-emerald-600' : 'text-slate-400'} />
                        <span className="font-medium">Fully Insured</span>
                        {formData.insured && <CheckCircle size={16} className="text-emerald-600" />}
                    </label>
                    
                    <label 
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                            formData.bonded 
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={formData.bonded}
                            onChange={(e) => setFormData({ ...formData, bonded: e.target.checked })}
                            className="sr-only"
                        />
                        <BadgeCheck size={18} className={formData.bonded ? 'text-emerald-600' : 'text-slate-400'} />
                        <span className="font-medium">Bonded</span>
                        {formData.bonded && <CheckCircle size={16} className="text-emerald-600" />}
                    </label>
                </div>
            </div>

            {/* Certifications Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-2">Certifications</h3>
                <p className="text-sm text-slate-500 mb-4">Add any professional certifications or licenses.</p>
                
                <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                        <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={newCertification}
                            onChange={(e) => setNewCertification(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                            placeholder="e.g. EPA Certified, NATE Certified, Master Plumber"
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={addCertification}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                </div>
                
                {formData.certifications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {formData.certifications.map((cert, idx) => (
                            <span 
                                key={idx}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm"
                            >
                                <Award size={14} />
                                {cert}
                                <button
                                    type="button"
                                    onClick={() => removeCertification(cert)}
                                    className="ml-1 hover:text-red-600 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">No certifications added yet</p>
                )}
            </div>

            {/* Payment Methods Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-2">Accepted Payment Methods</h3>
                <p className="text-sm text-slate-500 mb-4">Let customers know how they can pay you.</p>
                
                <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHOD_OPTIONS.map(method => (
                        <label 
                            key={method}
                            className={`px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${
                                formData.paymentMethods.includes(method)
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={formData.paymentMethods.includes(method)}
                                onChange={() => togglePaymentMethod(method)}
                                className="sr-only"
                            />
                            {method}
                        </label>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
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

    const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
    const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');

    const resetAndClose = () => {
        setStep(1);
        setPassword('');
        setConfirmText('');
        setError('');
        onClose();
    };

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
            await deleteContractorAccount(contractorId);
            
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
                setError(err.message || 'Failed to delete account');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Delete Account</h2>
                            <p className="text-sm text-slate-500">This action cannot be undone</p>
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
                            {isGoogleUser && (
                                <div className="space-y-4">
                                    <p className="text-slate-600">
                                        To verify your identity, please re-authenticate with Google.
                                    </p>
                                    <button
                                        onClick={handleReauthenticate}
                                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                                    >
                                        Verify with Google
                                    </button>
                                </div>
                            )}
                            
                            {isEmailUser && !isGoogleUser && (
                                <div className="space-y-4">
                                    <p className="text-slate-600">
                                        Enter your password to verify your identity.
                                    </p>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Your password"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
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
                <h2 className="text-xl font-bold text-slate-800">Account Settings</h2>
                <p className="text-slate-500">Manage your notifications and account</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Notifications</h3>
                
                {[
                    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                    { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive text message alerts' },
                    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary of activity each week' }
                ].map(item => (
                    <label key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer">
                        <div>
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings[item.key]}
                            onChange={(e) => setSettings({...settings, [item.key]: e.target.checked})}
                            className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                    </label>
                ))}
                
                <button 
                    onClick={handleSaveSettings} 
                    disabled={saving} 
                    className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                >
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
    
    // Job completion state
    const [completingJob, setCompletingJob] = useState(null);
    const [ratingHomeowner, setRatingHomeowner] = useState(null);

    // NEW: Unread message count state
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    // NEW: Evaluation state
    const [selectedEvaluation, setSelectedEvaluation] = useState(null);

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
    const { jobs, loading: jobsLoading } = useContractorJobs(user?.uid);
    const { invoices, loading: invoicesLoading } = useContractorInvoices(user?.uid);
    
    // Quote hooks
    const { quotes, loading: quotesLoading } = useQuotes(user?.uid);
    const { templates: quoteTemplates } = useQuoteTemplates(user?.uid);
    const { 
    create: createQuoteFn,
    update: updateQuoteFn,
    remove: deleteQuoteFn,
    send: sendQuoteFn,
    getShareLink,
    isCreating: isCreatingQuote,
    isUpdating: isUpdatingQuote,
    isSending: isSendingQuote
} = useQuoteOperations(user?.uid);


    const contractorId = user?.uid;

    // Evaluation hooks
    const {
        evaluations,
        pendingEvaluations,
        completedEvaluations,
        stats: evalStats,
        loading: evalsLoading,
        createEvaluation,
        requestMoreInfo,
        complete: completeEvaluationFn,
        cancel: cancelEvaluationFn,
        prepareQuote: prepareQuoteFromEval,
        linkQuote
    } = useEvaluations(contractorId);

    // Derived data
    const pendingQuotes = useMemo(() => {
        return quotes?.filter(q => ['sent', 'viewed'].includes(q.status)) || [];
    }, [quotes]);
    
    const activeJobsCount = useMemo(() => {
        return jobs?.filter(job => 
            !['completed', 'cancelled'].includes(job.status)
        ).length || 0;
    }, [jobs]);

    const unscheduledJobsCount = useMemo(() => {
        return jobs?.filter(job => 
            ['pending_schedule', 'slots_offered', 'quoted', 'accepted'].includes(job.status)
        ).length || 0;
    }, [jobs]);

    const scheduledJobs = useMemo(() => {
        return jobs?.filter(job => 
            job.status === 'scheduled' && job.scheduledDate
        ) || [];
    }, [jobs]);

    const todaysJobs = useMemo(() => {
        const today = new Date();
        return scheduledJobs.filter(job => isSameDay(job.scheduledDate, today));
    }, [scheduledJobs]);

    const hasTeam = profile?.scheduling?.teamType === 'team';

    // Chat subscription
    useEffect(() => {
        if (!user?.uid) {
            setUnreadMessageCount(0);
            return;
        }
        
        const unsubscribe = subscribeToGlobalUnreadCount(user.uid, (count) => {
            setUnreadMessageCount(count);
        });
        
        return () => unsubscribe();
    }, [user?.uid]);
    
    // Handle Initial Setup using updateDoc with Dot Notation
    const handleInitialSetup = async (formData) => {
        console.log("handleInitialSetup called with:", formData);
        setIsSavingProfile(true);
        try {
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, user.uid);
            
            const updates = {};
            
            if (formData.profile) {
                if (formData.profile.companyName) updates['profile.companyName'] = formData.profile.companyName;
                if (formData.profile.phone) updates['profile.phone'] = formData.profile.phone;
                if (formData.profile.address) updates['profile.address'] = formData.profile.address;
                if (formData.profile.licenseNumber) updates['profile.licenseNumber'] = formData.profile.licenseNumber;
                if (formData.profile.logoUrl) updates['profile.logoUrl'] = formData.profile.logoUrl;
                // NEW: Credential fields
                if (formData.profile.yearsInBusiness !== undefined) updates['profile.yearsInBusiness'] = formData.profile.yearsInBusiness;
                if (formData.profile.insured !== undefined) updates['profile.insured'] = formData.profile.insured;
                if (formData.profile.bonded !== undefined) updates['profile.bonded'] = formData.profile.bonded;
                if (formData.profile.certifications) updates['profile.certifications'] = formData.profile.certifications;
                if (formData.profile.paymentMethods) updates['profile.paymentMethods'] = formData.profile.paymentMethods;
            }
            
            if (formData.scheduling) {
                updates['scheduling'] = formData.scheduling;
            } else {
                updates['profile.companyName'] = formData.companyName;
                updates['profile.phone'] = formData.phone;
                updates['profile.address'] = formData.address;
            }

            await updateDoc(contractorRef, updates);
            
            toast.success("Profile setup complete!");
            
        } catch (error) {
            console.error("Setup error:", error);
            toast.error("Failed to save profile: " + error.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleNavigate = useCallback((view) => {
        if (!['quotes', 'create-quote', 'quote-detail', 'edit-quote'].includes(view)) {
            setSelectedQuote(null);
        }
        if (!['evaluations', 'evaluation-detail', 'create-evaluation'].includes(view)) {
            setSelectedEvaluation(null);
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
            if (selectedQuote?.id) {
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
        if (selectedQuote?.id) {
            // Existing quote - update it
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

    // Evaluation Handlers
    const handleCreateEvaluation = useCallback(() => {
        setSelectedEvaluation(null);
        setActiveView('create-evaluation');
    }, []);

    const handleSelectEvaluation = useCallback((evaluation) => {
        setSelectedEvaluation(evaluation);
        setActiveView('evaluation-detail');
    }, []);

    const handleEvaluationBack = useCallback(() => {
        setSelectedEvaluation(null);
        setActiveView('evaluations');
    }, []);

    const handleConvertToQuote = useCallback((evaluation) => {
        // Prepare quote data from evaluation
        const quoteData = prepareQuoteFromEvaluation(evaluation);
        // Store it and navigate to quote creation
        setSelectedQuote({ ...quoteData, fromEvaluation: true, evaluationId: evaluation.id });
        setActiveView('create-quote');
    }, []);

    const handleJobClick = useCallback((job) => {
        if (['quoted', 'scheduling', 'pending_schedule', 'slots_offered', 'accepted'].includes(job.status)) {
            setOfferingTimesJob(job);
        } else if (job.status === 'scheduled') {
            setSelectedJob(job);
        } else {
            setSelectedJob(job);
        }
    }, []);

    const handleCompleteJob = useCallback((job) => {
        setCompletingJob(job);
    }, []);

    const handleCompletionSuccess = useCallback((job) => {
        setCompletingJob(null);
        setRatingHomeowner(job);
    }, []);
    
    const getViewTitle = () => {
        switch (activeView) {
            case 'dashboard': return 'Dashboard';
            case 'jobs': return 'My Jobs'; 
            case 'messages': return 'Messages';
            case 'schedule': return 'Schedule'; 
            case 'quotes': return 'Quotes'; 
            case 'create-quote': return 'New Quote'; 
            case 'quote-detail': return 'Quote Details'; 
            case 'edit-quote': return 'Edit Quote';
            case 'evaluations': return 'Evaluations';
            case 'evaluation-detail': return 'Evaluation Details';
            case 'create-evaluation': return 'Request Evaluation';
            case 'invoices': return 'Invoices';
            case 'create-invoice': return 'New Invoice';
            case 'invitations': return 'Invitations';
            case 'customers': return 'Customers';
            case 'pricebook': return 'Price Book';
            case 'profile': return 'Profile';
            case 'settings': return 'Settings';
            default: return 'Dashboard';
        }
    };

    // Loading
    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto mb-4" />
                    <p className="text-slate-500">Loading...</p>
                </div>
            </div>
        );
    }
    
    // Auth
    if (!user) {
        return <ContractorAuthScreen onSignIn={signIn} onSignUp={signUp} onGoogleSignIn={signInWithGoogle} error={authError} clearError={clearError} />;
    }
    
    // Setup
    if (profile && !profile.profile?.companyName) {
        return <SetupBusinessProfile profile={profile} onSave={handleInitialSetup} saving={isSavingProfile} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            <Toaster position="top-right" />
            
            <Sidebar 
                activeView={activeView} 
                onNavigate={handleNavigate} 
                profile={profile}
                onSignOut={signOut}
                pendingCount={pendingInvitations.length}
                pendingQuotesCount={pendingQuotes?.length || 0}
                activeJobsCount={activeJobsCount}
                unscheduledJobsCount={unscheduledJobsCount}
                unreadMessageCount={unreadMessageCount}
                completedEvalsCount={completedEvaluations?.length || 0}
            />
            
            <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
                {/* Mobile Header */}
                <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {profile?.profile?.logoUrl ? (
                                <img src={profile.profile.logoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
                            ) : (
                                <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <Logo className="h-5 w-5 text-emerald-700" />
                                </div>
                            )}
                            <h1 className="font-bold text-slate-800">{getViewTitle()}</h1>
                        </div>
                        <button className="p-2 hover:bg-slate-100 rounded-lg relative">
                            <Bell size={20} className="text-slate-500" />
                            {(pendingInvitations.length + unscheduledJobsCount) > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
                            )}
                        </button>
                    </div>
                </header>
                
                {/* Main Content */}
                <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
                    {activeView === 'dashboard' && (
                        <DashboardOverview 
                            profile={profile}
                            invitations={invitations}
                            customers={customers}
                            jobs={jobs}
                            quotes={quotes}
                            onNavigate={handleNavigate}
                            onJobClick={handleJobClick}
                        />
                    )}
                    
                    {activeView === 'jobs' && (
                        <JobsView 
                            jobs={jobs} 
                            loading={jobsLoading}
                            onJobClick={handleJobClick}
                            onCompleteJob={handleCompleteJob}
                        />
                    )}

                    {activeView === 'messages' && (
                        <ContractorMessagesView 
                            contractorId={contractorId}
                            contractorName={profile?.profile?.companyName || profile?.profile?.displayName || 'Contractor'}
                        />
                    )}

                    {activeView === 'schedule' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800">Schedule</h1>
                                    <p className="text-slate-500">
                                        {todaysJobs.length} job{todaysJobs.length !== 1 ? 's' : ''} today
                                    </p>
                                </div>
                                
                                {hasTeam && (
                                    <div className="flex bg-slate-100 rounded-xl p-1">
                                        <button
                                            onClick={() => setScheduleView('calendar')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                scheduleView === 'calendar' 
                                                    ? 'bg-white text-slate-800 shadow-sm' 
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Calendar
                                        </button>
                                        <button
                                            onClick={() => setScheduleView('dispatch')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                scheduleView === 'dispatch' 
                                                    ? 'bg-white text-slate-800 shadow-sm' 
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Dispatch
                                        </button>
                                        <button
                                            onClick={() => setScheduleView('team')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                scheduleView === 'team' 
                                                    ? 'bg-white text-slate-800 shadow-sm' 
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            Team View
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Solo contractor - simple calendar */}
                            {!hasTeam && (
                                <DragDropCalendar 
                                    jobs={jobs}
                                    selectedDate={selectedDate}
                                    onDateChange={setSelectedDate}
                                    onJobClick={handleJobClick}
                                    teamMembers={[]}
                                />
                            )}

                            {/* Team - Calendar View */}
                            {hasTeam && scheduleView === 'calendar' && (
                                <DragDropCalendar 
                                    jobs={jobs}
                                    selectedDate={selectedDate}
                                    onDateChange={setSelectedDate}
                                    onJobClick={handleJobClick}
                                    teamMembers={profile?.scheduling?.teamMembers || []}
                                />
                            )}
                            
                            {/* Team - Dispatch Board */}
                            {hasTeam && scheduleView === 'dispatch' && (
                                <DispatchBoard 
                                    jobs={jobs}
                                    teamMembers={profile?.scheduling?.teamMembers || []}
                                    initialDate={selectedDate}
                                    onJobUpdate={() => {
                                        // Jobs will auto-refresh via subscription
                                    }}
                                />
                            )}
                            
                            {/* Team - Team View */}
                            {hasTeam && scheduleView === 'team' && (
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
                            quote={selectedQuote}
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

                    {/* Evaluation Views */}
                    {activeView === 'evaluations' && (
                        <EvaluationsListView 
                            evaluations={evaluations}
                            pendingEvaluations={pendingEvaluations}
                            completedEvaluations={completedEvaluations}
                            loading={evalsLoading}
                            contractorId={contractorId}
                            onCreateEvaluation={handleCreateEvaluation}
                            onSelectEvaluation={handleSelectEvaluation}
                        />
                    )}

                    {activeView === 'create-evaluation' && (
                        <div className="flex items-center justify-center min-h-[60vh]">
                            <CreateEvaluationRequest
                                contractorId={contractorId}
                                onSubmit={async (data) => {
                                    await createEvaluation(data);
                                    toast.success('Evaluation request created!');
                                    setActiveView('evaluations');
                                }}
                                onCancel={() => setActiveView('evaluations')}
                            />
                        </div>
                    )}

                    {activeView === 'evaluation-detail' && selectedEvaluation && (
                        <div className="flex items-center justify-center min-h-[60vh]">
                            <EvaluationReview
                                evaluation={selectedEvaluation}
                                onRequestMoreInfo={requestMoreInfo}
                                onComplete={completeEvaluationFn}
                                onConvertToQuote={handleConvertToQuote}
                                onCancel={cancelEvaluationFn}
                                onBack={handleEvaluationBack}
                            />
                        </div>
                    )}

                    {activeView === 'leads' && (
    <ContractorLeadDashboard 
        contractorId={profile?.id || user?.uid}
        contractorProfile={profile?.profile}
    />
)}

                    {/* Price Book View */}
                    {activeView === 'pricebook' && (
                        <PriceBook contractorId={contractorId} />
                    )}
                    
                    {activeView === 'invoices' && <InvoicesView invoices={invoices} loading={invoicesLoading} onCreateInvoice={() => setActiveView('create-invoice')} />}
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
                            
                            {/* Team Management - only show if team type is selected */}
                            {profile?.scheduling?.teamType === 'team' && (
                                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                    <TeamManagement
                                        contractorId={contractorId}
                                        teamMembers={profile?.scheduling?.teamMembers || []}
                                        onUpdate={(members) => {
                                            console.log('Team updated:', members);
                                        }}
                                    />
                                </div>
                            )}
                            
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
                    unreadMessageCount={unreadMessageCount}
                />
            </div>

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-800">Manage Job</h3>
                                <p className="text-xs text-slate-500">{selectedJob.customerName || 'Customer'}</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <JobScheduler 
                                job={selectedJob}
                                contractorId={contractorId}
                                contractorProfile={profile}
                                onClose={() => setSelectedJob(null)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Offer Time Slots Modal */}
            {offeringTimesJob && (
                <OfferTimeSlotsModal
                    job={offeringTimesJob}
                    contractorId={contractorId}
                    workingHours={profile?.scheduling?.workingHours}
                    onClose={() => setOfferingTimesJob(null)}
                />
            )}

            {/* Job Completion Modal - uncomment when JobCompletionForm is available */}
            {/* completingJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCompletingJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <JobCompletionForm
                            job={completingJob}
                            contractorId={contractorId}
                            onClose={() => setCompletingJob(null)}
                            onSuccess={() => handleCompletionSuccess(completingJob)}
                        />
                    </div>
                </div>
            ) */}

            {/* Rate Homeowner Modal */}
            {ratingHomeowner && (
                <RateHomeownerModal
                    job={ratingHomeowner}
                    contractorId={contractorId}
                    onClose={() => setRatingHomeowner(null)}
                    onSuccess={() => {
                        setRatingHomeowner(null);
                        toast.success('Thanks for your feedback!');
                    }}
                />
            )}
        </div>
    );
};

export default ContractorProApp;
