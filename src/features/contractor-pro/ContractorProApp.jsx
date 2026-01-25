// src/features/contractor-pro/ContractorProApp.jsx
// ============================================
// CONTRACTOR PRO APP
// ============================================
// Main application wrapper for contractor dashboard with routing
// UPDATED: Added Chat/Messages functionality and Profile Credentials
// UPDATED: Added Evaluations feature for pre-quote assessments

import React, { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import {
    Home, FileText, Users, User, Settings as SettingsIcon,
    LogOut, Menu, X, Plus, Bell, ChevronLeft, Search,
    MapPin, Phone, Mail, Building2, Save, CheckCircle, Shield,
    Briefcase, BadgeCheck, Award, CreditCard, TrendingUp,
    Scroll as ScrollIcon,
    Receipt, Navigation, RotateCcw,
    Calendar, DollarSign, Clock, ChevronRight, ChevronDown, Tag, AlertCircle,
    AlertTriangle, Loader2, Trash2, MessageSquare,
    ClipboardCheck, Camera, Package, Star, Crown, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { isSameDayInTimezone } from './lib/timezoneUtils';
import toast, { Toaster } from 'react-hot-toast';

// Components
import { ContractorAuthScreen } from './components/ContractorAuthScreen';
import { SetupBusinessProfile } from './components/SetupBusinessProfile';
import { DashboardOverview } from './components/DashboardOverview';
import { Logo } from '../../components/common/Logo';
import { DeleteConfirmModal } from '../../components/common/DeleteConfirmModal';
import { FullPageLoader } from '../../components/common';
import { FeatureErrorBoundary } from '../../components/common/FeatureErrorBoundary';
// Lazy-loaded heavy components (code splitting for performance)
const InvoiceGenerator = lazy(() => import('../invoices/InvoiceGenerator').then(m => ({ default: m.InvoiceGenerator })));
import { ContractorCalendar } from './components/ContractorCalendar';
import { OfferTimeSlotsModal } from './components/OfferTimeSlotsModal';
import { BusinessSettings } from './components/BusinessSettings';
import { ReviewSettings } from './components/ReviewSettings';
import { SMSSettings } from './components/SMSSettings';
import { FinancingSettings } from './components/FinancingSettings';
import { SMSLog } from './components/SMSLog';
import { BookingWidgetSettings } from '../booking-widget';
import { ContractorSettings } from './components/ContractorSettings';
import { DragDropCalendar } from './components/DragDropCalendar';
import { RouteVisualization } from './components/RouteVisualization';
import { TechAssignmentPanel } from './components/TechAssignmentPanel';
import { TeamCalendarView } from './components/TeamCalendarView';
import { LogoUpload } from './components/LogoUpload';
import { RecurringServicesView } from './components/RecurringServicesView';
import { RouteMapView } from './components/RouteMapView';

// NEW: Dispatch Board and Team Management
import { DispatchBoard } from './components/DispatchBoard';
import { TeamManagement } from './components/TeamManagement';
// NEW: Vehicle Fleet Management
import { VehicleManagement } from './components/VehicleManagement';
import { useVehicles } from './hooks/useVehicles';
// NEW: Price Book
import { PriceBook } from './components/PriceBook';
const ReportingDashboard = lazy(() => import('./components/ReportingDashboard').then(m => ({ default: m.ReportingDashboard })));
import { NeedsAttention } from './components/NeedsAttention';
import { ExpenseTracker } from './components/ExpenseTracker';
import { useExpenses } from './hooks/useExpenses';


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
    prepareQuoteFromEvaluation,
    linkQuoteToEvaluation
} from '../evaluations';

import { ContractorLeadDashboard } from '../marketplace';

// Job Scheduler Component
import { JobScheduler } from '../jobs/JobScheduler';
import { CancellationApprovalModal } from '../jobs/CancellationApprovalModal';
import CreateJobModal from '../jobs/components/CreateJobModal';

// Quick Service Call Components
import { QuickServiceCallModal } from './components/QuickServiceCallModal';
import { QuickServiceCallButton } from './components/QuickServiceCallButton';

// Job Completion Components
import { JobCompletionForm } from '../jobs/components/completion';

// Chat Service
import { subscribeToGlobalUnreadCount } from '../../lib/chatService';
import { EstimateTemplates } from './components/EstimateTemplates';
import { formatCurrency } from '../../lib/utils';

// Membership Components
import { MembershipsView, PlanBuilder as MembershipPlansView } from '../memberships/components';

// Timesheet Components
import { TimesheetsView, TimeClockWidget } from '../timesheets/components';

// ============================================
// RATE HOMEOWNER MODAL - Full Implementation
// ============================================
const HOMEOWNER_RATING_CATEGORIES = [
    { key: 'propertyAccess', label: 'Property Access', description: 'Was the property accessible and ready for work?' },
    { key: 'communication', label: 'Communication', description: 'How well did they communicate?' },
    { key: 'payment', label: 'Payment', description: 'Was payment handled smoothly?' }
];

const StarRating = ({ value, onChange, disabled = false }) => {
    const [hoverValue, setHoverValue] = useState(0);

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(star)}
                    onMouseEnter={() => !disabled && setHoverValue(star)}
                    onMouseLeave={() => setHoverValue(0)}
                    className={`p-1 transition-transform ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
                >
                    <Star
                        size={24}
                        className={`transition-colors ${(hoverValue || value) >= star
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                            }`}
                    />
                </button>
            ))}
        </div>
    );
};

const RateHomeownerModal = ({ job, contractorId, onClose, onSuccess }) => {
    const [ratings, setRatings] = useState({
        propertyAccess: 0,
        communication: 0,
        payment: 0
    });
    const [overallRating, setOverallRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [wouldWorkAgain, setWouldWorkAgain] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate average from category ratings
    const calculatedAverage = () => {
        const values = Object.values(ratings).filter(v => v > 0);
        if (values.length === 0) return 0;
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    };

    // Auto-update overall when categories change
    useEffect(() => {
        const avg = calculatedAverage();
        if (avg > 0 && overallRating === 0) {
            setOverallRating(Math.round(avg));
        }
    }, [ratings]);

    const handleSubmit = async () => {
        // Validate at least overall rating
        if (overallRating === 0) {
            toast.error('Please provide at least an overall rating');
            return;
        }

        setIsSubmitting(true);
        try {
            const ratingData = {
                ratings,
                overallRating,
                averageRating: calculatedAverage() || overallRating,
                feedback: feedback.trim() || null,
                wouldWorkAgain,
                ratedAt: serverTimestamp(),
                ratedBy: 'contractor',
                contractorId
            };

            // Update the job document with contractor's rating of homeowner
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                'contractorRating': ratingData,
                'contractorRating.submittedAt': serverTimestamp()
            });

            toast.success('Rating submitted! Thank you for your feedback.');
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error submitting rating:', error);
            toast.error('Failed to submit rating');
        } finally {
            setIsSubmitting(false);
        }
    };

    const customerName = job.customer?.name || job.customerName || 'this customer';

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-100">
                            <Star className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Rate Your Experience</h3>
                            <p className="text-xs text-slate-500">How was working with {customerName}?</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    {/* Overall Rating - Most Important */}
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <p className="text-sm font-medium text-slate-600 mb-2">Overall Experience</p>
                        <StarRating
                            value={overallRating}
                            onChange={setOverallRating}
                        />
                        <p className="text-xs text-slate-400 mt-2">
                            {overallRating === 0 && 'Tap to rate'}
                            {overallRating === 1 && 'Poor'}
                            {overallRating === 2 && 'Fair'}
                            {overallRating === 3 && 'Good'}
                            {overallRating === 4 && 'Great'}
                            {overallRating === 5 && 'Excellent'}
                        </p>
                    </div>

                    {/* Category Ratings */}
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Detailed Ratings (Optional)
                        </p>
                        {HOMEOWNER_RATING_CATEGORIES.map((category) => (
                            <div key={category.key} className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-700">{category.label}</p>
                                    <p className="text-xs text-slate-400">{category.description}</p>
                                </div>
                                <StarRating
                                    value={ratings[category.key]}
                                    onChange={(val) => setRatings(prev => ({ ...prev, [category.key]: val }))}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Would Work Again */}
                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-sm font-medium text-slate-700 mb-3">
                            Would you work with this customer again?
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setWouldWorkAgain(true)}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${wouldWorkAgain === true
                                    ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                                    : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                                    }`}
                            >
                                <ThumbsUp size={16} /> Yes
                            </button>
                            <button
                                type="button"
                                onClick={() => setWouldWorkAgain(false)}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${wouldWorkAgain === false
                                    ? 'bg-red-100 text-red-700 border-2 border-red-500'
                                    : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                                    }`}
                            >
                                <ThumbsDown size={16} /> No
                            </button>
                        </div>
                    </div>

                    {/* Feedback */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Private Notes (Optional)
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Any notes about this customer for your records..."
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            This is private and won't be shared with the customer
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-5 border-t border-slate-100 bg-slate-50">
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 border border-slate-200 rounded-xl font-medium hover:bg-white transition-colors"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || overallRating === 0}
                            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {isSubmitting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <CheckCircle size={18} />
                            )}
                            Submit Rating
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Hooks
import { useContractorAuth } from './hooks/useContractorAuth';
import {
    useInvitations,
    useCustomers,
    useDashboardStats,
    useContractorJobs,
    useContractorInvoices,
    useCalendarEvents
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
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CONTRACTORS_COLLECTION_PATH, REQUESTS_COLLECTION_PATH } from '../../config/constants';

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
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${active
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
const Sidebar = ({ activeView, onNavigate, profile, onSignOut, pendingCount, pendingQuotesCount, activeJobsCount, unscheduledJobsCount, unreadMessageCount, completedEvalsCount, needsAttentionCount }) => (
    <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
                {profile?.profile?.logoUrl ? (
                    <img src={profile.profile.logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                    <Logo className="h-8 w-8" />
                )}
                <div>
                    <p className="font-bold text-slate-800">{profile?.profile?.companyName || 'My Business'}</p>
                    <p className="text-xs text-emerald-600 font-medium"><span className="bg-emerald-100 px-1 rounded">PRO</span></p>
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
                <NavItem icon={RotateCcw} label="Recurring" active={activeView === 'recurring'} onClick={() => onNavigate('recurring')} />
                <NavItem icon={Crown} label="Memberships" active={['memberships', 'membership-plans'].includes(activeView)} onClick={() => onNavigate('memberships')} />
                <NavItem icon={Package} label="Price Book" active={activeView === 'pricebook'} onClick={() => onNavigate('pricebook')} />
                <NavItem icon={FileText} label="Templates" active={activeView === 'templates'} onClick={() => onNavigate('templates')} />
                <NavItem icon={Receipt} label="Expenses" active={activeView === 'expenses'} onClick={() => onNavigate('expenses')} />
                <NavItem icon={Clock} label="Timesheets" active={activeView === 'timesheets'} onClick={() => onNavigate('timesheets')} />
            </div>

            {/* INSIGHTS */}
            <div className="pt-4 mt-4 border-t border-slate-100">
                <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Insights</p>
                <NavItem icon={Bell} label="Needs Attention" active={activeView === 'attention'} onClick={() => onNavigate('attention')} badge={needsAttentionCount > 0 ? needsAttentionCount : null} />
                <NavItem icon={TrendingUp} label="Reports" active={activeView === 'reports'} onClick={() => onNavigate('reports')} />
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
const MobileNav = ({ activeView, onNavigate, pendingCount, pendingQuotesCount, activeJobsCount, unscheduledJobsCount, unreadMessageCount, pendingEvaluationsCount = 0 }) => {
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const mainItems = [
        { id: 'dashboard', icon: Home, label: 'Home' },
        { id: 'jobs', icon: Briefcase, label: 'Jobs', badge: unscheduledJobsCount },
        { id: 'evaluations', icon: ClipboardCheck, label: 'Evals', badge: pendingEvaluationsCount },
        { id: 'quotes', icon: FileText, label: 'Quotes', badge: pendingQuotesCount },
    ];

    const moreItems = [
        { id: 'messages', icon: MessageSquare, label: 'Messages', badge: unreadMessageCount },
        { id: 'schedule', icon: Calendar, label: 'Schedule' },
        { id: 'customers', icon: Users, label: 'Customers' },
        { id: 'invoices', icon: Receipt, label: 'Invoices' },
        { id: 'memberships', icon: Crown, label: 'Memberships' },
        { id: 'team', icon: Users, label: 'Team' },
        { id: 'reports', icon: TrendingUp, label: 'Reports' },
        { id: 'profile', icon: User, label: 'Profile' },
        { id: 'settings', icon: SettingsIcon, label: 'Settings' },
    ];

    const moreActiveViews = moreItems.map(i => i.id);
    const isMoreActive = moreActiveViews.includes(activeView);

    return (
        <>
            {/* More Menu Overlay */}
            {showMoreMenu && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowMoreMenu(false)}
                    />
                    <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-xl border-t border-slate-200 p-4 animate-slide-up">
                        <div className="grid grid-cols-4 gap-4">
                            {moreItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        onNavigate(item.id);
                                        setShowMoreMenu(false);
                                    }}
                                    className={`flex flex-col items-center p-3 rounded-xl transition-colors relative ${activeView === item.id ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <item.icon size={24} />
                                    <span className="text-xs mt-1.5 font-medium text-center">{item.label}</span>
                                    {item.badge > 0 && (
                                        <span className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                            {item.badge > 9 ? '9+' : item.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Nav */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-40">
                <div className="flex justify-around items-center">
                    {mainItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center p-2 rounded-xl transition-colors relative ${activeView === item.id
                                || (item.id === 'quotes' && ['quotes', 'create-quote', 'quote-detail', 'edit-quote'].includes(activeView))
                                || (item.id === 'evaluations' && ['evaluations', 'create-evaluation', 'evaluation-detail'].includes(activeView))
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
                    {/* More Button */}
                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={`flex flex-col items-center p-2 rounded-xl transition-colors relative ${isMoreActive || showMoreMenu ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                    >
                        <Menu size={22} />
                        <span className="text-xs mt-1 font-medium">More</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================
const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return 'N/A'; }
};

// Format time - handles ISO strings, Date objects, Firestore timestamps, and "HH:MM" strings
const formatTime = (time) => {
    if (!time) return '';

    // If it's already a simple time string like "09:00" or "14:30", format it
    if (typeof time === 'string' && /^\d{1,2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    // Handle ISO strings, Date objects, or Firestore timestamps
    try {
        const d = time.toDate ? time.toDate() : new Date(time);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return '';
    }
};

// ============================================
// BATCH SCHEDULING MODAL
// ============================================

const BatchSchedulingModal = ({ jobs, onClose, onSchedule }) => {
    const [scheduleData, setScheduleData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize schedule data for each job
    useState(() => {
        const initialData = {};
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        jobs.forEach((job, idx) => {
            // Stagger jobs by 2 hours each
            const startHour = 8 + (idx * 2);
            const startTime = startHour > 17 ? 8 : startHour;

            initialData[job.id] = {
                date: tomorrow.toISOString().split('T')[0],
                startTime: `${startTime.toString().padStart(2, '0')}:00`,
                duration: job.estimatedDuration || 120
            };
        });
        setScheduleData(initialData);
    });

    const handleDateChange = (jobId, date) => {
        setScheduleData(prev => ({
            ...prev,
            [jobId]: { ...prev[jobId], date }
        }));
    };

    const handleTimeChange = (jobId, startTime) => {
        setScheduleData(prev => ({
            ...prev,
            [jobId]: { ...prev[jobId], startTime }
        }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const jobsToSchedule = jobs.map(job => ({
                job,
                ...scheduleData[job.id]
            }));
            await onSchedule(jobsToSchedule);
            onClose();
        } catch (error) {
            console.error('Batch scheduling error:', error);
            toast.error('Failed to schedule some jobs');
        } finally {
            setIsSubmitting(false);
        }
    };

    const timeOptions = [];
    for (let h = 6; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            timeOptions.push({ value: time, label });
        }
    }

    const minDate = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-violet-600">
                    <div>
                        <h2 className="text-lg font-bold text-white">Batch Schedule Jobs</h2>
                        <p className="text-purple-200 text-sm">{jobs.length} jobs selected</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Job List */}
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                    {jobs.map((job, idx) => (
                        <div key={job.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                                            {idx + 1}
                                        </span>
                                        <h4 className="font-bold text-slate-800 truncate">
                                            {job.title || job.description || 'Service'}
                                        </h4>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">{job.customer?.name || 'Customer'}</p>
                                    {job.customer?.address && (
                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                            <MapPin size={10} />
                                            {job.customer.address.split(',')[0]}
                                        </p>
                                    )}
                                </div>
                                {job.total > 0 && (
                                    <span className="text-sm font-bold text-emerald-600">
                                        {formatCurrency(job.total)}
                                    </span>
                                )}
                            </div>

                            {/* Schedule Inputs */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        min={minDate}
                                        value={scheduleData[job.id]?.date || ''}
                                        onChange={(e) => handleDateChange(job.id, e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Start Time</label>
                                    <select
                                        value={scheduleData[job.id]?.startTime || '08:00'}
                                        onChange={(e) => handleTimeChange(job.id, e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        {timeOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Scheduling...
                            </>
                        ) : (
                            <>
                                <Calendar size={16} />
                                Schedule {jobs.length} Jobs
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// JOBS VIEW
// ============================================
const JobsView = ({ jobs = [], loading, onJobClick, onCompleteJob, onReviewCancellation, onCreateJob, onAcceptProposal, onDeclineProposal, onQuickSchedule, onBatchSchedule }) => {
    const [showCompleted, setShowCompleted] = useState(true);
    const [showCancelled, setShowCancelled] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // NEW: Status filter
    const [batchMode, setBatchMode] = useState(false); // NEW: Batch selection mode
    const [selectedJobs, setSelectedJobs] = useState(new Set()); // NEW: Selected job IDs
    const [viewMode, setViewMode] = useState('list'); // NEW: list or map view

    const cancellationRequests = jobs.filter(j => j.status === 'cancellation_requested');

    // Apply status filter to active jobs
    const allActiveJobs = jobs.filter(j => !['completed', 'cancelled', 'cancellation_requested'].includes(j.status));

    // Helper to check if a job is effectively scheduled (has scheduledTime or scheduled status)
    const isJobScheduled = (j) => j.status === 'scheduled' || j.scheduledTime || j.scheduledDate;

    // Helper to check if a job needs scheduling (status indicates unscheduled AND no scheduledTime)
    const jobNeedsScheduling = (j) => ['pending_schedule', 'quoted', 'accepted', 'scheduling'].includes(j.status) && !j.scheduledTime && !j.scheduledDate;

    const activeJobs = statusFilter === 'all'
        ? allActiveJobs
        : statusFilter === 'needs_scheduling'
            ? allActiveJobs.filter(jobNeedsScheduling)
            : statusFilter === 'awaiting_response'
                ? allActiveJobs.filter(j => j.status === 'slots_offered')
                : statusFilter === 'scheduled'
                    ? allActiveJobs.filter(isJobScheduled)
                    : statusFilter === 'in_progress'
                        ? allActiveJobs.filter(j => j.status === 'in_progress')
                        : statusFilter === 'pending_approval'
                            ? allActiveJobs.filter(j => ['pending_completion_approval', 'completion_rejected'].includes(j.status))
                            : allActiveJobs;

    const completedJobs = jobs.filter(j => j.status === 'completed');
    const cancelledJobs = jobs.filter(j => j.status === 'cancelled');

    // Calculate estimated revenue from active jobs
    const estimatedRevenue = allActiveJobs.reduce((sum, job) => sum + (job.total || job.price || 0), 0);

    // Get jobs that need scheduling (for batch mode)
    // Note: 'slots_offered' excluded as those are awaiting customer response
    // Also exclude jobs that already have a scheduledTime/scheduledDate
    const schedulableJobs = allActiveJobs.filter(jobNeedsScheduling);

    // Toggle job selection for batch mode
    const toggleJobSelection = (jobId) => {
        setSelectedJobs(prev => {
            const next = new Set(prev);
            if (next.has(jobId)) {
                next.delete(jobId);
            } else {
                next.add(jobId);
            }
            return next;
        });
    };

    // Select all schedulable jobs
    const selectAllSchedulable = () => {
        setSelectedJobs(new Set(schedulableJobs.map(j => j.id)));
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedJobs(new Set());
    };

    // Handle batch schedule
    const handleBatchSchedule = () => {
        const jobsToSchedule = jobs.filter(j => selectedJobs.has(j.id));
        if (jobsToSchedule.length > 0 && onBatchSchedule) {
            onBatchSchedule(jobsToSchedule);
            setBatchMode(false);
            setSelectedJobs(new Set());
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-700';
            case 'in_progress': return 'bg-amber-100 text-amber-700';
            case 'completed': return 'bg-emerald-100 text-emerald-700';
            case 'cancelled': return 'bg-slate-100 text-slate-500';
            case 'scheduling': return 'bg-blue-100 text-blue-700'; // Customer proposed time
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
            case 'scheduling': return 'Customer Proposed Time';
            case 'scheduled': return 'Scheduled';
            case 'in_progress': return 'In Progress';
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
            case 'quoted': return 'Quote Accepted';
            case 'accepted': return 'Needs Scheduling';
            case 'pending_completion_approval': return 'Pending Approval';
            case 'completion_rejected': return 'Needs Resubmission';
            default: return status;
        }
    };

    const JobCard = ({ job }) => {
        const showCompleteButton = job.status === 'scheduled' || job.status === 'in_progress';
        const showResubmitButton = job.status === 'completion_rejected';
        const isInactive = ['completed', 'cancelled'].includes(job.status);
        const needsScheduling = ['pending_schedule', 'slots_offered', 'quoted', 'accepted'].includes(job.status);
        const isSelected = selectedJobs.has(job.id);
        const canSelect = batchMode && needsScheduling;

        // Get the latest homeowner proposal for display
        const latestHomeownerProposal = job.proposedTimes?.filter(p => p.proposedBy === 'homeowner').slice(-1)[0];
        const proposedDateRaw = latestHomeownerProposal?.date ? new Date(latestHomeownerProposal.date) : null;
        const proposedDate = proposedDateRaw && !isNaN(proposedDateRaw.getTime()) ? proposedDateRaw : null;
        const hasHomeownerProposal = job.status === 'scheduling' && proposedDate;

        // Get assigned crew members
        const assignedCrew = job.assignedCrew || job.crew || [];
        const hasAssignedCrew = assignedCrew.length > 0 || job.assignedTechName;

        const handleCardClick = () => {
            if (canSelect) {
                toggleJobSelection(job.id);
            } else {
                onJobClick(job);
            }
        };

        return (
            <div
                onClick={handleCardClick}
                className={`bg-white rounded-xl border ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-200' : hasHomeownerProposal ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'} p-4 hover:shadow-md transition-shadow cursor-pointer ${isInactive ? 'opacity-75' : ''}`}
            >
                {/* Batch Selection Checkbox */}
                {canSelect && (
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
                        <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-slate-300 hover:border-emerald-400'
                                }`}
                        >
                            {isSelected && <CheckCircle size={14} className="text-white" />}
                        </div>
                        <span className="text-xs text-slate-500">
                            {isSelected ? 'Selected for batch scheduling' : 'Click to select'}
                        </span>
                    </div>
                )}
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
                        {/* Show homeowner proposed time */}
                        {hasHomeownerProposal && (
                            <div className="mt-2 px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                                    <Clock size={12} />
                                    Proposed: {proposedDate.toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric'
                                    })} at {proposedDate.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        )}
                        {/* Enhanced scheduled date/time display */}
                        {job.scheduledDate && !hasHomeownerProposal && job.status === 'scheduled' && (() => {
                            const schedDate = new Date(job.scheduledDate);
                            if (isNaN(schedDate.getTime())) return null;
                            let timeStr = null;
                            if (job.scheduledTime) {
                                const schedTime = new Date(job.scheduledTime);
                                if (!isNaN(schedTime.getTime())) {
                                    timeStr = schedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                }
                            }
                            return (
                                <div className="mt-2 px-2 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                                        <Calendar size={12} />
                                        {schedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        {timeStr && <span className="ml-1">at {timeStr}</span>}
                                    </p>
                                </div>
                            );
                        })()}
                        {/* Crew member avatars */}
                        {hasAssignedCrew && (
                            <div className="mt-2 flex items-center gap-1">
                                <Users size={12} className="text-slate-400" />
                                <div className="flex -space-x-1">
                                    {(assignedCrew.slice(0, 3) || []).map((member, idx) => (
                                        <div
                                            key={member.techId || idx}
                                            className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[9px] font-bold text-slate-600"
                                            title={member.techName || member.name}
                                        >
                                            {(member.techName || member.name || 'T')?.charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                    {!assignedCrew.length && job.assignedTechName && (
                                        <div className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[9px] font-bold text-slate-600">
                                            {job.assignedTechName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                {assignedCrew.length > 3 && (
                                    <span className="text-[10px] text-slate-500">+{assignedCrew.length - 3}</span>
                                )}
                            </div>
                        )}
                        {job.completedAt && (
                            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                <CheckCircle size={12} />
                                Completed {formatDate(job.completedAt)}
                            </p>
                        )}
                        {job.reviewRequestSent && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <Star size={12} />
                                Review request sent
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        {job.total && (
                            <p className="font-bold text-slate-800">{formatCurrency(job.total)}</p>
                        )}

                        {/* Quick Schedule button for unscheduled jobs */}
                        {needsScheduling && !hasHomeownerProposal && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onQuickSchedule?.(job);
                                }}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-1.5 transition-colors"
                            >
                                <Calendar size={12} />
                                Schedule
                            </button>
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
                            Resubmit
                        </button>
                    )}

                    {/* Accept/Decline buttons for homeowner proposals */}
                    {hasHomeownerProposal && (
                        <div className="ml-auto flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAcceptProposal?.(job, latestHomeownerProposal);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors"
                            >
                                <CheckCircle size={12} />
                                Accept
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeclineProposal?.(job, latestHomeownerProposal);
                                }}
                                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5 transition-colors"
                            >
                                <X size={12} />
                                Decline
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    const totalJobs = cancellationRequests.length + activeJobs.length + completedJobs.length + cancelledJobs.length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Jobs</h1>
                    <p className="text-slate-500 text-sm">
                        {allActiveJobs.length} active • {completedJobs.length} completed • {cancelledJobs.length} cancelled
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Estimated Revenue Card - hidden on small mobile */}
                    {estimatedRevenue > 0 && (
                        <div className="hidden sm:block px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Est. Revenue</p>
                            <p className="text-lg font-bold text-emerald-700">{formatCurrency(estimatedRevenue)}</p>
                        </div>
                    )}
                    {/* View Mode Toggle */}
                    <div className="flex bg-slate-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${viewMode === 'map'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <MapPin size={14} />
                            Map
                        </button>
                    </div>
                    {/* Batch Schedule Toggle - only show if there are schedulable jobs */}
                    {schedulableJobs.length > 1 && viewMode === 'list' && (
                        <button
                            onClick={() => {
                                setBatchMode(!batchMode);
                                if (batchMode) {
                                    setSelectedJobs(new Set());
                                }
                            }}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${batchMode
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            <Package size={16} />
                            {batchMode ? 'Exit Batch' : 'Batch'}
                        </button>
                    )}
                    <button
                        onClick={onCreateJob}
                        className="px-3 py-2 sm:px-4 sm:py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">New Job</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </div>
            </div>

            {/* Batch Selection Action Bar */}
            {batchMode && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-purple-700">
                            <strong>{selectedJobs.size}</strong> of {schedulableJobs.length} jobs selected
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={selectAllSchedulable}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                            >
                                Select All
                            </button>
                            <span className="text-purple-300">|</span>
                            <button
                                onClick={clearSelection}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleBatchSchedule}
                        disabled={selectedJobs.size === 0}
                        className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${selectedJobs.size > 0
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-200 text-purple-400 cursor-not-allowed'
                            }`}
                    >
                        <Calendar size={16} />
                        Schedule {selectedJobs.size > 0 ? `${selectedJobs.size} Jobs` : 'Selected'}
                    </button>
                </div>
            )}

            {/* Status Filter Tabs */}
            {allActiveJobs.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {[
                        { key: 'all', label: 'All', count: allActiveJobs.length },
                        { key: 'needs_scheduling', label: 'Needs Scheduling', count: allActiveJobs.filter(jobNeedsScheduling).length },
                        { key: 'awaiting_response', label: 'Awaiting Response', count: allActiveJobs.filter(j => j.status === 'slots_offered').length },
                        { key: 'scheduled', label: 'Scheduled', count: allActiveJobs.filter(isJobScheduled).length },
                        { key: 'in_progress', label: 'In Progress', count: allActiveJobs.filter(j => j.status === 'in_progress').length },
                        { key: 'pending_approval', label: 'Pending Approval', count: allActiveJobs.filter(j => ['pending_completion_approval', 'completion_rejected'].includes(j.status)).length },
                    ].map(filter => (
                        <button
                            key={filter.key}
                            onClick={() => setStatusFilter(filter.key)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === filter.key
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {filter.label}
                            {filter.count > 0 && (
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${statusFilter === filter.key
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-600'
                                    }`}>
                                    {filter.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {totalJobs === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Briefcase className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">No Jobs Yet</h3>
                    <p className="text-slate-500">Jobs from accepted quotes will appear here.</p>
                </div>
            ) : viewMode === 'map' ? (
                /* MAP VIEW */
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Map Container */}
                    <div className="bg-slate-100 relative" style={{ height: '400px' }}>
                        {/* Jobs with addresses */}
                        {(() => {
                            const jobsWithAddresses = allActiveJobs.filter(j => j.customer?.address || j.serviceAddress?.formatted);
                            if (jobsWithAddresses.length === 0) {
                                return (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                        <MapPin size={48} className="text-slate-300 mb-4" />
                                        <h4 className="font-semibold text-slate-600 mb-2">No Job Locations</h4>
                                        <p className="text-sm text-slate-500">Jobs with addresses will appear on the map</p>
                                    </div>
                                );
                            }
                            return (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                                    <MapPin size={48} className="text-indigo-400 mb-4" />
                                    <h4 className="font-semibold text-slate-700 mb-2">
                                        {jobsWithAddresses.length} Jobs with Locations
                                    </h4>
                                    {/* Visual job markers */}
                                    <div className="flex flex-wrap justify-center gap-2 mb-4 max-w-md">
                                        {jobsWithAddresses.slice(0, 8).map((job, idx) => (
                                            <div
                                                key={job.id}
                                                onClick={() => onJobClick(job)}
                                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                                                            {job.customer?.name || 'Customer'}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                                            {(job.serviceAddress?.formatted || job.customer?.address || '').split(',')[0]}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {jobsWithAddresses.length > 8 && (
                                            <div className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">
                                                +{jobsWithAddresses.length - 8} more
                                            </div>
                                        )}
                                    </div>
                                    {/* Open in Google Maps */}
                                    <button
                                        onClick={() => {
                                            const addresses = jobsWithAddresses
                                                .map(j => j.serviceAddress?.formatted || j.customer?.address)
                                                .filter(Boolean);
                                            const url = `https://www.google.com/maps/dir/${addresses.map(a => encodeURIComponent(a)).join('/')}`;
                                            window.open(url, '_blank');
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                    >
                                        <Navigation size={16} />
                                        Open Route in Maps
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                    {/* Job List (compact) */}
                    <div className="border-t border-slate-200 max-h-[300px] overflow-y-auto">
                        {allActiveJobs.map((job, idx) => (
                            <div
                                key={job.id}
                                onClick={() => onJobClick(job)}
                                className="flex items-center gap-3 p-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                            >
                                <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{job.title || job.description || 'Service'}</p>
                                    <p className="text-xs text-slate-500 truncate">{job.customer?.name || 'Customer'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                                        {getStatusLabel(job.status)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* LIST VIEW */
                <div className="space-y-6">
                    {/* Cancellation Requests - URGENT */}
                    {cancellationRequests.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle size={16} />
                                Cancellation Requests ({cancellationRequests.length})
                            </h2>
                            <div className="space-y-3">
                                {cancellationRequests.map(job => (
                                    <div
                                        key={job.id}
                                        className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                                                        Cancellation Requested
                                                    </span>
                                                    {job.jobNumber && (
                                                        <span className="text-xs text-slate-400">#{job.jobNumber}</span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-slate-800 truncate">{job.title || job.serviceType || 'Job'}</p>
                                                <p className="text-sm text-slate-500">{job.customer?.name || job.customerName || 'Customer'}</p>
                                                {job.cancellationRequest?.reason && (
                                                    <p className="text-sm text-amber-700 mt-2 italic">
                                                        Reason: {job.cancellationRequest.reason}
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onReviewCancellation(job);
                                                }}
                                                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 flex items-center gap-2 transition-colors"
                                            >
                                                <AlertTriangle size={14} />
                                                Review
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Active Jobs */}
                    {activeJobs.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                                Active Jobs ({activeJobs.length})
                            </h2>
                            {activeJobs.map(job => (
                                <JobCard key={job.id} job={job} />
                            ))}
                        </div>
                    )}

                    {/* Completed Jobs */}
                    {completedJobs.length > 0 && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setShowCompleted(!showCompleted)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                            >
                                {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                Completed Jobs ({completedJobs.length})
                            </button>
                            {showCompleted && (
                                <div className="space-y-3">
                                    {completedJobs.map(job => (
                                        <JobCard key={job.id} job={job} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cancelled Jobs */}
                    {cancelledJobs.length > 0 && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setShowCancelled(!showCancelled)}
                                className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                            >
                                {showCancelled ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                Cancelled Jobs ({cancelledJobs.length})
                            </button>
                            {showCancelled && (
                                <div className="space-y-3">
                                    {cancelledJobs.map(job => (
                                        <JobCard key={job.id} job={job} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
        switch (status) {
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
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Name</label>
                        <input
                            type="text"
                            value={formData.displayName}
                            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Address</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">License Number</label>
                        <input
                            type="text"
                            value={formData.licenseNumber}
                            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Years in Business</label>
                        <input
                            type="number"
                            min="0"
                            value={formData.yearsInBusiness}
                            onChange={(e) => setFormData({ ...formData, yearsInBusiness: e.target.value })}
                            placeholder="e.g. 15"
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Specialty / Trade</label>
                        <input
                            type="text"
                            value={formData.specialty}
                            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
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
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${formData.insured
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
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${formData.bonded
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
                            className={`px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${formData.paymentMethods.includes(method)
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
                            onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
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
    const [batchSchedulingJobs, setBatchSchedulingJobs] = useState(null); // NEW: For batch scheduling
    const [scheduleView, setScheduleView] = useState('calendar');
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Job completion state
    const [completingJob, setCompletingJob] = useState(null);
    const [ratingHomeowner, setRatingHomeowner] = useState(null);
    const [reviewingCancellation, setReviewingCancellation] = useState(null);
    const [showCreateJobModal, setShowCreateJobModal] = useState(false);
    const [showQuickServiceCall, setShowQuickServiceCall] = useState(false);

    // NEW: Unread message count state
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);

    // NEW: Calendar View Mode state (week or month)
    const [calendarViewMode, setCalendarViewMode] = useState('week');

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
    const handleNewProposal = useCallback((job, proposal) => {
        const customerName = job.customer?.name || 'A customer';
        toast.success(
            `${customerName} proposed a time for "${job.title || 'a job'}"`,
            {
                duration: 5000,
                icon: '📅',
                style: {
                    background: '#EFF6FF',
                    border: '1px solid #3B82F6',
                    color: '#1E40AF'
                }
            }
        );
    }, []);

    const { jobs, jobsWithProposals, loading: jobsLoading } = useContractorJobs(user?.uid, {
        onNewProposal: handleNewProposal
    });
    const { invoices, loading: invoicesLoading } = useContractorInvoices(user?.uid);

    // Calendar events hook - merges jobs and evaluations for calendar display
    const {
        calendarEvents,
        evaluations: calendarEvaluations,
        scheduledEvaluations,
        loading: calendarEventsLoading
    } = useCalendarEvents(user?.uid);

    // Quote hooks
    const { quotes, loading: quotesLoading } = useQuotes(user?.uid);
    const {
        templates: quoteTemplates,
        createTemplate,
        updateTemplate,
        removeTemplate
    } = useQuoteTemplates(user?.uid);
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
        sendMessage: sendEvaluationMessage,
        schedule: scheduleEvaluationFn,
        complete: completeEvaluationFn,
        cancel: cancelEvaluationFn,
        prepareQuote: prepareQuoteFromEval,
        linkQuote
    } = useEvaluations(contractorId);

    // Expense tracking
    const {
        expenses,
        loading: expensesLoading,
        addExpense,
        editExpense,
        removeExpense,
    } = useExpenses(contractorId);

    // Vehicle fleet management
    const {
        vehicles,
        loading: vehiclesLoading,
        addVehicle,
        editVehicle,
        removeVehicle,
        getMaintenanceAlerts
    } = useVehicles(contractorId);

    // Financing settings state
    const [financingSettings, setFinancingSettings] = useState(null);

    // Load financing settings when contractorId is available
    useEffect(() => {
        if (!contractorId) return;

        const loadFinancingSettings = async () => {
            try {
                const { getFinancingSettings } = await import('../../lib/wisetackService');
                const settings = await getFinancingSettings(contractorId);
                setFinancingSettings(settings);
            } catch (err) {
                console.error('Error loading financing settings:', err);
            }
        };

        loadFinancingSettings();
    }, [contractorId]);

    // Membership plans and members state
    const [membershipPlans, setMembershipPlans] = useState([]);
    const [memberships, setMemberships] = useState([]);
    const [membershipStats, setMembershipStats] = useState(null);
    const [membershipsLoading, setMembershipsLoading] = useState(true);
    const [selectedMembershipCustomer, setSelectedMembershipCustomer] = useState(null);

    // Load membership data when contractorId is available
    useEffect(() => {
        if (!contractorId) return;

        const loadMembershipData = async () => {
            try {
                setMembershipsLoading(true);
                const { getPlans, getMemberships, getMembershipStats } = await import('../memberships/lib/membershipService');
                const [plans, members, stats] = await Promise.all([
                    getPlans(contractorId, true),
                    getMemberships(contractorId),
                    getMembershipStats(contractorId)
                ]);
                setMembershipPlans(plans);
                setMemberships(members);
                setMembershipStats(stats);
            } catch (err) {
                console.error('Error loading membership data:', err);
            } finally {
                setMembershipsLoading(false);
            }
        };

        loadMembershipData();
    }, [contractorId]);

    // Derived data
    const pendingQuotes = useMemo(() => {
        return quotes?.filter(q => ['sent', 'viewed'].includes(q.status)) || [];
    }, [quotes]);

    const activeJobsCount = useMemo(() => {
        return jobs?.filter(job =>
            !['completed', 'cancelled'].includes(job.status)
        ).length || 0;
    }, [jobs]);

    // Jobs that NEED contractor action to schedule
    // Note: 'slots_offered' means waiting for customer response, not needing scheduling
    // 'scheduling' means customer proposed a time - needs contractor review
    const unscheduledJobsCount = useMemo(() => {
        return jobs?.filter(job =>
            ['pending_schedule', 'quoted', 'accepted', 'scheduling'].includes(job.status)
        ).length || 0;
    }, [jobs]);

    // Jobs awaiting customer response (contractor has acted, waiting for customer)
    const awaitingResponseCount = useMemo(() => {
        return jobs?.filter(job => job.status === 'slots_offered').length || 0;
    }, [jobs]);

    const scheduledJobs = useMemo(() => {
        return jobs?.filter(job =>
            job.status === 'scheduled' && job.scheduledDate
        ) || [];
    }, [jobs]);

    // Calculate jobs scheduled for today
    const todaysJobs = useMemo(() => {
        const today = new Date();
        const timezone = profile?.scheduling?.timezone;

        return jobs?.filter(job => {
            if (!job.scheduledTime && !job.scheduledDate) return false;
            const jobDate = job.scheduledTime
                ? new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime)
                : new Date(job.scheduledDate.toDate ? job.scheduledDate.toDate() : job.scheduledDate);

            // Use timezone aware check if available
            if (timezone) {
                return isSameDayInTimezone(jobDate, today, timezone);
            }

            // Fallback to local time check
            const dLocal = new Date(jobDate);
            const todayLocal = new Date();
            return dLocal.getDate() === todayLocal.getDate() &&
                dLocal.getMonth() === todayLocal.getMonth() &&
                dLocal.getFullYear() === todayLocal.getFullYear();
        }) || [];
    }, [jobs, profile?.scheduling?.timezone]);

    // Calculate needs attention count for badge
    const needsAttentionCount = useMemo(() => {
        let count = 0;

        // Stale quotes (sent 7+ days ago, not viewed)
        quotes?.forEach(q => {
            if (q.status === 'sent' && q.sentAt) {
                const days = Math.floor((new Date() - (q.sentAt.toDate ? q.sentAt.toDate() : new Date(q.sentAt))) / (1000 * 60 * 60 * 24));
                if (days >= 7) count++;
            }
        });

        // Viewed but no response (3+ days)
        quotes?.forEach(q => {
            if (q.status === 'viewed' && q.viewedAt) {
                const days = Math.floor((new Date() - (q.viewedAt.toDate ? q.viewedAt.toDate() : new Date(q.viewedAt))) / (1000 * 60 * 60 * 24));
                if (days >= 3) count++;
            }
        });

        // Unscheduled jobs
        jobs?.forEach(j => {
            if (['pending_schedule', 'slots_offered', 'quoted', 'accepted'].includes(j.status)) {
                count++;
            }
        });

        // Overdue invoices
        invoices?.forEach(i => {
            if (i.status === 'sent' && i.dueDate) {
                const dueDate = i.dueDate.toDate ? i.dueDate.toDate() : new Date(i.dueDate);
                if (new Date() > dueDate) count++;
            }
        });

        return count;
    }, [quotes, jobs, invoices]);

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
                // Include evaluationId AND customerId if this quote came from an evaluation
                // CRITICAL: customerId must be set for quote to appear on homeowner dashboard
                const dataWithEvaluation = {
                    ...quoteData,
                    evaluationId: selectedQuote?.evaluationId || null,
                    // Preserve customerId from evaluation - this links quote to homeowner
                    customerId: quoteData.customerId || selectedQuote?.customerId || null,
                    propertyId: quoteData.propertyId || selectedQuote?.propertyId || null
                };
                const result = await createQuoteFn(dataWithEvaluation);

                // Link the quote back to the evaluation if it came from one
                if (selectedQuote?.fromEvaluation && selectedQuote?.evaluationId && user?.uid) {
                    try {
                        await linkQuoteToEvaluation(user.uid, selectedQuote.evaluationId, result.quoteId);
                        console.log('✅ Quote linked to evaluation:', selectedQuote.evaluationId);
                    } catch (linkErr) {
                        console.warn('Could not link quote to evaluation:', linkErr);
                    }
                }

                toast.success('Quote saved');
                setActiveView('quotes');
            }
        } catch (error) {
            toast.error('Failed to save quote: ' + error.message);
            throw error;
        }
    }, [selectedQuote, updateQuoteFn, createQuoteFn, user?.uid]);

    const handleSendQuote = useCallback(async (quoteData) => {
        try {
            let quoteId;
            if (selectedQuote?.id) {
                // Existing quote - update it
                await updateQuoteFn(selectedQuote.id, quoteData);
                quoteId = selectedQuote.id;
            } else {
                // Include evaluationId AND customerId if this quote came from an evaluation
                // CRITICAL: customerId must be set for quote to appear on homeowner dashboard
                const dataWithEvaluation = {
                    ...quoteData,
                    status: 'draft',
                    evaluationId: selectedQuote?.evaluationId || null,
                    // Preserve customerId from evaluation - this links quote to homeowner
                    customerId: quoteData.customerId || selectedQuote?.customerId || null,
                    propertyId: quoteData.propertyId || selectedQuote?.propertyId || null
                };
                const result = await createQuoteFn(dataWithEvaluation);
                quoteId = result.quoteId;

                // Link the quote back to the evaluation if it came from one
                if (selectedQuote?.fromEvaluation && selectedQuote?.evaluationId && user?.uid) {
                    try {
                        await linkQuoteToEvaluation(user.uid, selectedQuote.evaluationId, quoteId);
                        console.log('✅ Quote linked to evaluation:', selectedQuote.evaluationId);
                    } catch (linkErr) {
                        console.warn('Could not link quote to evaluation:', linkErr);
                    }
                }
            }

            await sendQuoteFn(quoteId);
            toast.success('Quote sent to customer!');
            setSelectedQuote(null);
            setActiveView('quotes');
        } catch (error) {
            toast.error('Failed to send quote: ' + error.message);
            throw error;
        }
    }, [selectedQuote, updateQuoteFn, createQuoteFn, sendQuoteFn, user?.uid]);

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
        // Check if job already has a confirmed schedule
        const hasSchedule = job.scheduledTime || job.scheduledDate;
        const isScheduledStatus = job.status === 'scheduled' || job.status === 'in_progress';

        if (isScheduledStatus || (hasSchedule && job.status !== 'slots_offered')) {
            // Job is scheduled - show job details
            setSelectedJob(job);
        } else if (['quoted', 'scheduling', 'pending_schedule', 'slots_offered', 'accepted'].includes(job.status)) {
            // Job needs scheduling - show time slots modal
            setOfferingTimesJob(job);
        } else if (job.status === 'pending' && !hasSchedule) {
            // Pending job without schedule - show time slots modal to schedule
            setOfferingTimesJob(job);
        } else {
            // Default - show job details
            setSelectedJob(job);
        }
    }, []);

    // Accept a homeowner's proposed time
    const handleAcceptProposal = useCallback(async (job, proposal) => {
        if (!job?.id || !proposal?.date) {
            toast.error('Invalid proposal data');
            return;
        }

        try {
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
            await updateDoc(jobRef, {
                scheduledTime: proposal.date,
                scheduledDate: proposal.date,
                status: 'scheduled',
                lastActivity: serverTimestamp(),
                scheduling: {
                    ...job.scheduling,
                    confirmedAt: new Date().toISOString(),
                    confirmedBy: 'contractor'
                }
            });

            toast.success('Appointment confirmed!');
        } catch (error) {
            console.error('Error accepting proposal:', error);
            toast.error('Failed to accept proposal');
            throw error;
        }
    }, []);

    // Decline a homeowner's proposed time (resets to pending_schedule)
    const handleDeclineProposal = useCallback(async (job, proposal) => {
        if (!job?.id) {
            toast.error('Invalid job data');
            return;
        }

        try {
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);

            // Mark the proposal as declined and reset status
            const updatedProposedTimes = (job.proposedTimes || []).map(p => {
                if (p.date === proposal?.date && p.proposedBy === 'homeowner') {
                    return { ...p, status: 'declined', declinedAt: new Date().toISOString() };
                }
                return p;
            });

            await updateDoc(jobRef, {
                status: 'pending_schedule',  // Reset back to pending so homeowner can propose again
                proposedTimes: updatedProposedTimes,
                hasHomeownerProposal: false,
                lastActivity: serverTimestamp()
            });

            toast.success('Time declined - customer will be notified to propose a new time');
        } catch (error) {
            console.error('Error declining proposal:', error);
            toast.error('Failed to decline proposal');
            throw error;
        }
    }, []);

    // Handle batch scheduling multiple jobs at once
    const handleBatchSchedule = useCallback(async (jobsToSchedule) => {
        const results = { success: 0, failed: 0 };

        for (const { job, date, startTime, duration } of jobsToSchedule) {
            try {
                // Create scheduled date/time
                const [hours, minutes] = startTime.split(':').map(Number);
                const scheduledDateTime = new Date(`${date}T${startTime}:00`);

                // Calculate end time
                const endDateTime = new Date(scheduledDateTime);
                endDateTime.setMinutes(endDateTime.getMinutes() + (duration || 120));

                const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
                await updateDoc(jobRef, {
                    scheduledTime: scheduledDateTime.toISOString(),
                    scheduledDate: scheduledDateTime.toISOString(),
                    scheduledEndTime: endDateTime.toISOString(),
                    estimatedDuration: duration || 120,
                    status: 'scheduled',
                    lastActivity: serverTimestamp()
                });

                results.success++;
            } catch (error) {
                console.error(`Error scheduling job ${job.id}:`, error);
                results.failed++;
            }
        }

        setBatchSchedulingJobs(null);

        if (results.failed === 0) {
            toast.success(`Successfully scheduled ${results.success} jobs!`);
        } else if (results.success > 0) {
            toast.success(`Scheduled ${results.success} jobs, ${results.failed} failed`);
        } else {
            toast.error('Failed to schedule jobs');
        }
    }, []);

    const handleCompleteJob = useCallback((job) => {
        setCompletingJob(job);
    }, []);

    const handleCompletionSuccess = useCallback((job) => {
        setCompletingJob(null);
        setRatingHomeowner(job);
    }, []);

    const handleDismissOnboarding = useCallback(async () => {
        if (!user?.uid) return;
        try {
            await updateContractorSettings(user.uid, {
                dismissedOnboarding: true
            });
            // Toast not needed as the UI will disappear
        } catch (error) {
            console.error('Error dismissing onboarding:', error);
            toast.error('Failed to save preference');
        }
    }, [user?.uid]);

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
            case 'templates': return 'Estimate Templates';
            case 'reports': return 'Business Reports';
            case 'attention': return 'Needs Attention';
            case 'expenses': return 'Expense Tracker';
            case 'team': return 'Team';
            case 'timesheets': return 'Timesheets';
            case 'memberships': return 'Memberships';
            case 'profile': return 'Profile';
            case 'settings': return 'Settings';
            default: return 'Dashboard';
        }
    };

    // Loading
    if (authLoading) {
        return <FullPageLoader message="Loading..." />;
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
                needsAttentionCount={needsAttentionCount}
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
                            isDismissed={profile?.settings?.dismissedOnboarding}
                            onDismissOnboarding={handleDismissOnboarding}
                        />
                    )}

                    {activeView === 'jobs' && (
                        <FeatureErrorBoundary label="Jobs" onRetry={() => setActiveView('jobs')}>
                            <JobsView
                                jobs={jobs}
                                loading={jobsLoading}
                                onJobClick={handleJobClick}
                                onCompleteJob={handleCompleteJob}
                                onReviewCancellation={setReviewingCancellation}
                                onCreateJob={() => setShowCreateJobModal(true)}
                                onAcceptProposal={handleAcceptProposal}
                                onDeclineProposal={handleDeclineProposal}
                                onQuickSchedule={(job) => setOfferingTimesJob(job)}
                                onBatchSchedule={(jobsList) => setBatchSchedulingJobs(jobsList)}
                            />
                        </FeatureErrorBoundary>
                    )}

                    {activeView === 'messages' && (
                        <FeatureErrorBoundary label="Messages" onRetry={() => setActiveView('messages')}>
                            <ContractorMessagesView
                                contractorId={contractorId}
                                contractorName={profile?.profile?.companyName || profile?.profile?.displayName || 'Contractor'}
                            />
                        </FeatureErrorBoundary>
                    )}

                    {activeView === 'schedule' && (
                        <FeatureErrorBoundary label="Schedule" onRetry={() => setActiveView('schedule')}>
                            <div className="space-y-4 h-[calc(100vh-theme(spacing.24))] flex flex-col">
                                <div className="flex items-center justify-between flex-wrap gap-4 shrink-0">
                                    <div>
                                        <h1 className="text-2xl font-bold text-slate-800">Schedule</h1>
                                        <p className="text-slate-500">
                                            {todaysJobs.length} job{todaysJobs.length !== 1 ? 's' : ''} today
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Week/Month Toggle - Always visible in Schedule view */}
                                        <div className="flex bg-slate-100 rounded-xl p-1 mr-2">
                                            <button
                                                onClick={() => setCalendarViewMode('week')}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'week'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                Week
                                            </button>
                                            <button
                                                onClick={() => setCalendarViewMode('month')}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${calendarViewMode === 'month'
                                                    ? 'bg-white text-slate-800 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                Month
                                            </button>
                                        </div>

                                        {hasTeam && (
                                            <div className="flex bg-slate-100 rounded-xl p-1">
                                                <button
                                                    onClick={() => setScheduleView('calendar')}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scheduleView === 'calendar'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    Calendar
                                                </button>
                                                <button
                                                    onClick={() => setScheduleView('dispatch')}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scheduleView === 'dispatch'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    Dispatch
                                                </button>
                                                <button
                                                    onClick={() => setScheduleView('map')}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scheduleView === 'map'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    Map
                                                </button>
                                                <button
                                                    onClick={() => setScheduleView('team')}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scheduleView === 'team'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    Assignment
                                                </button>
                                                <button
                                                    onClick={() => setScheduleView('team-calendar')}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${scheduleView === 'team-calendar'
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                        }`}
                                                >
                                                    Team Calendar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Solo contractor - simple calendar */}
                                {!hasTeam && (
                                    <div className="flex-1 min-h-0 overflow-hidden">
                                        {calendarViewMode === 'month' ? (
                                            <div className="h-full overflow-y-auto">
                                                <ContractorCalendar
                                                    jobs={jobs}
                                                    timezone={profile?.scheduling?.timezone}
                                                    viewMode="month"
                                                    hideHeader={true}
                                                    onSelectJob={handleJobClick}
                                                    onCreateJob={() => setShowCreateJobModal(true)}
                                                />
                                            </div>
                                        ) : (
                                            <DragDropCalendar
                                                jobs={jobs}
                                                evaluations={calendarEvaluations}
                                                timezone={profile?.scheduling?.timezone}
                                                preferences={profile?.scheduling}
                                                selectedDate={selectedDate}
                                                onDateChange={setSelectedDate}
                                                onJobClick={handleJobClick}
                                                onEvaluationClick={(evaluation) => {
                                                    // Navigate to evaluation details or show modal
                                                    setActiveView('evaluations');
                                                }}
                                                teamMembers={[]}
                                                vehicles={vehicles || []}
                                                onSetupTeam={() => setActiveView('settings')}
                                                onAcceptProposal={handleAcceptProposal}
                                                onDeclineProposal={handleDeclineProposal}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Team - Calendar View */}
                                {hasTeam && scheduleView === 'calendar' && (
                                    calendarViewMode === 'month' ? (
                                        <ContractorCalendar
                                            jobs={jobs}
                                            timezone={profile?.scheduling?.timezone}
                                            viewMode="month"
                                            hideHeader={true}
                                            onSelectJob={handleJobClick}
                                            onCreateJob={() => setShowCreateJobModal(true)}
                                        />
                                    ) : (
                                        <DragDropCalendar
                                            jobs={jobs}
                                            evaluations={calendarEvaluations}
                                            timezone={profile?.scheduling?.timezone}
                                            preferences={profile?.scheduling}
                                            selectedDate={selectedDate}
                                            onDateChange={setSelectedDate}
                                            onJobClick={handleJobClick}
                                            onEvaluationClick={(evaluation) => {
                                                setActiveView('evaluations');
                                            }}
                                            teamMembers={profile?.scheduling?.teamMembers || []}
                                            vehicles={vehicles || []}
                                            onSetupTeam={() => setActiveView('settings')}
                                            onAcceptProposal={handleAcceptProposal}
                                            onDeclineProposal={handleDeclineProposal}
                                        />
                                    )
                                )}

                                {/* Team - Dispatch Board */}
                                {hasTeam && scheduleView === 'dispatch' && (
                                    <DispatchBoard
                                        jobs={jobs}
                                        teamMembers={profile?.scheduling?.teamMembers || []}
                                        vehicles={vehicles || []}
                                        initialDate={selectedDate}
                                        timezone={profile?.scheduling?.timezone}
                                        onJobUpdate={() => {
                                            // Jobs will auto-refresh via subscription
                                        }}
                                        onOfferSlots={(job) => setOfferingTimesJob(job)}
                                    />
                                )}

                                {/* Team - Map View */}
                                {hasTeam && scheduleView === 'map' && (
                                    <RouteMapView
                                        jobs={jobs}
                                        teamMembers={profile?.scheduling?.teamMembers || []}
                                        date={selectedDate}
                                        onJobSelect={handleJobClick}
                                    />
                                )}

                                {/* Team - Assignment Panel */}
                                {hasTeam && scheduleView === 'team' && (
                                    <TechAssignmentPanel
                                        jobs={jobs}
                                        teamMembers={profile?.scheduling?.teamMembers || []}
                                        vehicles={vehicles || []}
                                        onJobUpdate={() => { }}
                                    />
                                )}

                                {/* Team - Team Calendar View */}
                                {hasTeam && scheduleView === 'team-calendar' && (
                                    <TeamCalendarView
                                        jobs={jobs}
                                        evaluations={calendarEvaluations}
                                        teamMembers={profile?.scheduling?.teamMembers || []}
                                        preferences={profile?.scheduling}
                                        onJobClick={handleJobClick}
                                        onEvaluationClick={(evaluation) => {
                                            setActiveView('evaluations');
                                        }}
                                        onJobUpdate={() => {
                                            // Jobs will auto-refresh via subscription
                                        }}
                                    />
                                )}
                            </div>
                        </FeatureErrorBoundary>
                    )}

                    {activeView === 'quotes' && (
                        <FeatureErrorBoundary label="Quotes" onRetry={() => setActiveView('quotes')}>
                            <QuotesListView
                                quotes={quotes}
                                loading={quotesLoading}
                                onCreateQuote={handleCreateQuote}
                                onSelectQuote={handleSelectQuote}
                            />
                        </FeatureErrorBoundary>
                    )}

                    {activeView === 'create-quote' && (
                        <QuoteBuilder
                            quote={selectedQuote}
                            customers={customers}
                            templates={quoteTemplates}
                            contractorProfile={profile}
                            financingSettings={financingSettings}
                            onBack={handleQuoteBack}
                            onSave={handleSaveQuote}
                            onSend={handleSendQuote}
                            onSaveAsTemplate={createTemplate}
                            onDuplicate={(quoteData) => {
                                setSelectedQuote({ ...quoteData, id: null, quoteNumber: null, status: 'draft' });
                                toast.success('Quote duplicated');
                            }}
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
                            financingSettings={financingSettings}
                            onBack={handleQuoteBack}
                            onSave={handleSaveQuote}
                            onSend={handleSendQuote}
                            onSaveAsTemplate={createTemplate}
                            onDuplicate={(quoteData) => {
                                setSelectedQuote({ ...quoteData, id: null, quoteNumber: null, status: 'draft' });
                                setActiveView('create-quote');
                                toast.success('Quote duplicated');
                            }}
                            isSaving={isUpdatingQuote}
                            isSending={isSendingQuote}
                        />
                    )}

                    {/* Evaluation Views */}
                    {activeView === 'evaluations' && (
                        <FeatureErrorBoundary label="Evaluations" onRetry={() => setActiveView('evaluations')}>
                            <EvaluationsListView
                                evaluations={evaluations}
                                pendingEvaluations={pendingEvaluations}
                                completedEvaluations={completedEvaluations}
                                loading={evalsLoading}
                                contractorId={contractorId}
                                onCreateEvaluation={handleCreateEvaluation}
                                onSelectEvaluation={handleSelectEvaluation}
                            />
                        </FeatureErrorBoundary>
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
                                onSendMessage={sendEvaluationMessage}
                                onSchedule={scheduleEvaluationFn}
                                onComplete={completeEvaluationFn}
                                onConvertToQuote={handleConvertToQuote}
                                onCancel={cancelEvaluationFn}
                                onBack={handleEvaluationBack}
                                existingJobs={jobs}
                                timezone={profile?.scheduling?.timezone}
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

                    {/* Estimate Templates View */}
                    {activeView === 'templates' && (
                        <EstimateTemplates
                            contractorId={contractorId}
                            templates={quoteTemplates}
                            loading={false}
                            createTemplate={createTemplate}
                            updateTemplate={updateTemplate}
                            removeTemplate={removeTemplate}
                            onNavigateToQuote={(view, data) => {
                                if (data?.template) {
                                    setSelectedQuote({ fromTemplate: true, ...data.template });
                                }
                                setActiveView('create-quote');
                            }}
                        />
                    )}
                    {/* Reports Dashboard - Lazy loaded */}
                    {activeView === 'reports' && (
                        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>}>
                            <ReportingDashboard
                                contractorId={contractorId}
                                profile={profile}
                                quotes={quotes}
                                jobs={jobs}
                                invoices={invoices}
                                customers={customers}
                                loading={quotesLoading || jobsLoading}
                            />
                        </Suspense>
                    )}
                    {/* Needs Attention */}
                    {activeView === 'attention' && (
                        <NeedsAttention
                            quotes={quotes}
                            jobs={jobs}
                            invoices={invoices}
                            evaluations={evaluations}
                            onNavigate={(view, data) => {
                                if (data?.quote) setSelectedQuote(data.quote);
                                if (data?.job) setSelectedJob(data.job);
                                setActiveView(view);
                            }}
                            variant="full"
                        />
                    )}

                    {/* Expense Tracker */}
                    {activeView === 'expenses' && (
                        <ExpenseTracker
                            expenses={expenses}
                            jobs={jobs}
                            loading={expensesLoading}
                            onAddExpense={addExpense}
                            onEditExpense={editExpense}
                            onDeleteExpense={removeExpense}
                        />
                    )}

                    {/* Recurring Services View */}
                    {activeView === 'recurring' && (
                        <RecurringServicesView
                            contractorId={contractorId}
                            customers={customers}
                            teamMembers={profile?.scheduling?.teamMembers || []}
                            onNavigate={setActiveView}
                        />
                    )}

                    {/* Memberships View */}
                    {activeView === 'memberships' && (
                        <MembershipsView
                            plans={membershipPlans}
                            memberships={memberships}
                            stats={membershipStats}
                            customers={customers}
                            loading={membershipsLoading}
                            contractorId={contractorId}
                            onNavigate={(view) => setActiveView(view)}
                            onRefresh={async () => {
                                const { getPlans, getMemberships, getMembershipStats } = await import('../memberships/lib/membershipService');
                                const [plans, members, stats] = await Promise.all([
                                    getPlans(contractorId, true),
                                    getMemberships(contractorId),
                                    getMembershipStats(contractorId)
                                ]);
                                setMembershipPlans(plans);
                                setMemberships(members);
                                setMembershipStats(stats);
                            }}
                        />
                    )}

                    {activeView === 'membership-plans' && (
                        <MembershipPlansView
                            plans={membershipPlans}
                            contractorId={contractorId}
                            onBack={() => setActiveView('memberships')}
                            onRefresh={async () => {
                                const { getPlans } = await import('../memberships/lib/membershipService');
                                const plans = await getPlans(contractorId, true);
                                setMembershipPlans(plans);
                            }}
                        />
                    )}

                    {/* Timesheets View */}
                    {activeView === 'timesheets' && (
                        <TimesheetsView
                            contractorId={contractorId}
                            teamMembers={profile?.scheduling?.teamMembers || []}
                            isManager={true}
                            loading={false}
                        />
                    )}

                    {activeView === 'invoices' && <InvoicesView invoices={invoices} loading={invoicesLoading} onCreateInvoice={() => setActiveView('create-invoice')} />}
                    {activeView === 'create-invoice' && (
                        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>}>
                            <InvoiceGenerator contractorProfile={profile} customers={customers} onBack={() => setActiveView('invoices')} />
                        </Suspense>
                    )}

                    {activeView === 'invitations' && <InvitationsView invitations={invitations} loading={invitationsLoading} onCreate={handleCreateInvitation} />}
                    {activeView === 'team' && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            {!profile ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                                    <span className="ml-2 text-slate-500">Loading team...</span>
                                </div>
                            ) : (
                                <TeamManagement
                                    contractorId={contractorId}
                                    teamMembers={profile?.scheduling?.teamMembers || []}
                                    vehicles={vehicles || []}
                                    companyHours={profile?.scheduling?.businessHours}
                                    onUpdate={(updatedMembers) => {
                                        // Profile auto-refreshes via Firestore subscription
                                    }}
                                />
                            )}
                        </div>
                    )}
                    {activeView === 'customers' && <CustomersView customers={customers} loading={customersLoading} />}
                    {activeView === 'profile' && <ProfileView profile={profile} onUpdateProfile={updateProfile} />}

                    {activeView === 'settings' && (
                        <ContractorSettings
                            contractorId={contractorId}
                            profile={profile}
                            user={user}
                            vehicles={vehicles}
                            vehiclesLoading={vehiclesLoading}
                            onUpdateProfile={(settings) => console.log('Settings updated:', settings)}
                            onUpdateSettings={updateContractorSettings}
                            onSignOut={signOut}
                        />
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
                    pendingEvaluationsCount={pendingEvaluations?.length || 0}
                />
            </div>

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800">{selectedJob.title || selectedJob.description || 'Manage Job'}</h3>
                                <p className="text-sm text-slate-600">{selectedJob.customer?.name || selectedJob.customerName || 'Customer'}</p>
                                {(selectedJob.customer?.address || selectedJob.serviceAddress?.formatted) && (
                                    <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                        <MapPin size={10} className="shrink-0" />
                                        {selectedJob.serviceAddress?.formatted || selectedJob.customer?.address}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-slate-100 rounded-lg shrink-0">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <JobScheduler
                                job={selectedJob}
                                userType="contractor"
                                contractorId={contractorId}
                                contractorProfile={profile}
                                allJobs={jobs}
                                onClose={() => setSelectedJob(null)}
                                onUpdate={() => setSelectedJob(null)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Offer Time Slots Modal */}
            {offeringTimesJob && (
                <OfferTimeSlotsModal
                    job={offeringTimesJob}
                    allJobs={jobs}
                    schedulingPreferences={profile?.scheduling || {
                        workingHours: {
                            monday: { enabled: true, start: '08:00', end: '17:00' },
                            tuesday: { enabled: true, start: '08:00', end: '17:00' },
                            wednesday: { enabled: true, start: '08:00', end: '17:00' },
                            thursday: { enabled: true, start: '08:00', end: '17:00' },
                            friday: { enabled: true, start: '08:00', end: '17:00' },
                            saturday: { enabled: false, start: '09:00', end: '14:00' },
                            sunday: { enabled: false, start: '09:00', end: '14:00' }
                        },
                        maxJobsPerDay: 4,
                        defaultJobDuration: 120,
                        homeBase: { address: profile?.profile?.address || '' }
                    }}
                    onClose={() => setOfferingTimesJob(null)}
                    onSuccess={() => {
                        setOfferingTimesJob(null);
                        toast.success('Time slots sent to customer!');
                    }}
                    onNavigate={(view) => {
                        setOfferingTimesJob(null);
                        handleNavigate(view);
                    }}
                />
            )}

            {/* Batch Scheduling Modal */}
            {batchSchedulingJobs && batchSchedulingJobs.length > 0 && (
                <BatchSchedulingModal
                    jobs={batchSchedulingJobs}
                    onClose={() => setBatchSchedulingJobs(null)}
                    onSchedule={handleBatchSchedule}
                />
            )}

            {/* Job Completion Modal */}
            {completingJob && (
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
            )}

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
            {/* Cancellation Approval Modal */}
            {reviewingCancellation && (
                <CancellationApprovalModal
                    job={reviewingCancellation}
                    onClose={() => setReviewingCancellation(null)}
                    onSuccess={() => {
                        setReviewingCancellation(null);
                        toast.success('Cancellation handled');
                    }}
                />
            )}
            {/* Create Job Modal */}
            <CreateJobModal
                isOpen={showCreateJobModal}
                onClose={() => setShowCreateJobModal(false)}
                contractorId={contractorId}
                teamMembers={profile?.scheduling?.teamMembers || []}
                vehicles={profile?.scheduling?.vehicles || []}
                contractorSettings={{
                    defaultTaxRate: profile?.scheduling?.defaultTaxRate ?? 8.75
                }}
                onJobCreated={(job) => {
                    setShowCreateJobModal(false);
                    // Toast already shown in modal
                }}
            />

            {/* Quick Service Call - Floating Button */}
            <QuickServiceCallButton
                onClick={() => setShowQuickServiceCall(true)}
                position="bottom-right"
                variant="default"
            />

            {/* Quick Service Call Modal */}
            <QuickServiceCallModal
                isOpen={showQuickServiceCall}
                onClose={() => setShowQuickServiceCall(false)}
                contractorId={contractorId}
                contractorName={profile?.profile?.displayName || profile?.profile?.companyName || 'Contractor'}
                companyName={profile?.profile?.companyName || 'Your Company'}
                customers={customers}
                teamMembers={profile?.scheduling?.teamMembers || []}
                onJobCreated={(job) => {
                    setShowQuickServiceCall(false);
                    // Toast already shown in modal
                }}
            />
        </div>
    );
};

export default ContractorProApp;
