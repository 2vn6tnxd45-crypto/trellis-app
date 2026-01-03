// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench, Shield, CheckCircle2,
    Info, TrendingUp, ChevronDown, Check, User,
    Calendar, Phone, Mail, MessageCircle, Link as LinkIcon,
    X, ExternalLink, Hammer, MapPin, Home, Trash2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EnvironmentalInsights } from './EnvironmentalInsights';
import { CountyData } from './CountyData';
import { PropertyIntelligence } from './PropertyIntelligence';
import { useHomeHealth } from '../../hooks/useHomeHealth';
import { MaintenanceDashboard } from './MaintenanceDashboard'; 
import { MAINTENANCE_FREQUENCIES, REQUESTS_COLLECTION_PATH } from '../../config/constants';
import { DashboardSection } from '../../components/common/DashboardSection';

// NEW: Firebase imports for Active Projects
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

// NEW: Job Scheduler for Homeowner
import { JobScheduler } from '../jobs/JobScheduler';

// NEW: Import Quotes Hook and Service
import { useCustomerQuotes } from '../quotes/hooks/useCustomerQuotes';
import { unclaimQuote } from '../quotes/lib/quoteService';

// --- CONFIG & HELPERS ---
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    } catch (e) { return '$0'; }
};

const getSeasonalTheme = () => {
    return { 
        name: 'Home', 
        gradient: 'from-emerald-600 via-emerald-500 to-teal-500', 
        accent: 'text-teal-300' 
    };
};

const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const getNextServiceDate = (record) => {
    if (!record.dateInstalled || record.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    const installed = new Date(record.dateInstalled);
    const next = new Date(installed);
    next.setMonth(next.getMonth() + freq.months);
    const now = new Date();
    while (next < now) next.setMonth(next.getMonth() + freq.months);
    return next;
};

// --- SUB-COMPONENTS ---
const HealthScoreCard = ({ breakdown, score, onClose }) => (
    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
            <h3 className="font-bold text-slate-900">Score Breakdown</h3>
            <span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{score}</span>
        </div>
        <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Wrench size={16} className="text-slate-400" /> <span className="text-slate-600">Maintenance</span></div>
                <span className={`font-bold ${breakdown.maintenance === 50 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.maintenance}/50</span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Package size={16} className="text-slate-400" /> <span className="text-slate-600">Coverage</span></div>
                <span className={`font-bold ${breakdown.profile >= 40 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.profile}/50</span>
            </div>
        </div>
        <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-full mt-4 pt-2 border-t border-slate-50 text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
        >
            Tap to close
        </button>
    </div>
);

const ActionButton = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => (
    <button onClick={onClick} className={`flex items-center gap-3 w-full p-3 rounded-2xl border transition-all group hover:shadow-md active:scale-[0.98] ${variant === 'primary' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'}`}>
        <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 ${variant === 'primary' ? 'bg-emerald-100' : 'bg-slate-100'}`}><Icon size={22} /></div>
        <div><p className="font-bold text-sm text-left">{label}</p>{sublabel && <p className="text-xs opacity-70 font-medium text-left">{sublabel}</p>}</div>
    </button>
);

// --- ACTIVE PROJECTS SECTION (DEBUGGING VERSION) ---

const ActiveProjectsSection = ({ userId }) => {
    const [projects, setProjects] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [loading, setLoading] = useState(true);

    // DEBUG: Log immediately on every render
    console.log("🔍 ActiveProjectsSection MOUNTED. userId =", userId);
    console.log("🔍 Collection Path:", REQUESTS_COLLECTION_PATH);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        
        // FIX: Query by BOTH createdBy AND customerId
        const q1 = query(
            collection(db, REQUESTS_COLLECTION_PATH), 
            where("createdBy", "==", userId)
        );
        
        const q2 = query(
            collection(db, REQUESTS_COLLECTION_PATH), 
            where("customerId", "==", userId)
        );
        
        let results1 = [];
        let results2 = [];
        let loaded1 = false;
        let loaded2 = false;
        
        const mergeAndUpdate = () => {
            if (!loaded1 || !loaded2) return;
            
            // Dedupe by id using Map
            const merged = new Map();
            [...results1, ...results2].forEach(job => {
                merged.set(job.id, job);
            });
            
            const allJobs = Array.from(merged.values());
            
            // Filter for active jobs
            const active = allJobs.filter(r => 
                ['scheduling', 'scheduled', 'in_progress'].includes(r.status) || 
                (r.status === 'quoted' && r.estimate?.status === 'approved')
            );
            
            setProjects(active);
            setLoading(false);
        };
        
        const unsub1 = onSnapshot(q1, (snapshot) => {
            results1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loaded1 = true;
            mergeAndUpdate();
        });
        
        const unsub2 = onSnapshot(q2, (snapshot) => {
            results2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loaded2 = true;
            mergeAndUpdate();
        });
        
        return () => {
            unsub1();
            unsub2();
        };
    }, [userId]);

    if (loading) return <div className="p-4 text-xs text-slate-400">Loading projects...</div>;
    if (projects.length === 0) return null;

    const getStatusBadge = (status) => {
        switch(status) {
            case 'scheduled': return { label: 'Scheduled', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Calendar };
            case 'scheduling': return { label: 'Needs Scheduling', bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock };
            case 'quoted': return { label: 'Action Required', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle };
            case 'in_progress': return { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700', icon: Wrench };
            default: return { label: status, bg: 'bg-slate-100', text: 'text-slate-600', icon: Info };
        }
    };

    return (
        <>
            <DashboardSection 
                title="Active Projects" 
                icon={Hammer} 
                defaultOpen={true}
                summary={<span className="text-xs text-amber-600 font-bold">{projects.length} Updates</span>}
            >
                <div className="space-y-3">
                    {projects.map(job => {
                        const badge = getStatusBadge(job.status === 'quoted' && job.estimate?.status === 'approved' ? 'scheduling' : job.status);
                        const BadgeIcon = badge.icon;
                        
                        // NEW: Get the latest proposal if one exists
                        const latestProposal = job.proposedTimes && job.proposedTimes.length > 0 
                            ? job.proposedTimes[job.proposedTimes.length - 1] 
                            : null;
                        
                        return (
                            <div 
                                key={job.id}
                                onClick={() => setSelectedJob(job)}
                                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                                        {job.description || job.title || 'Service Request'}
                                    </h3>
                                    <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${badge.bg} ${badge.text}`}>
                                        <BadgeIcon size={10} />
                                        {badge.label}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm text-slate-500">
                                    <span className="flex items-center gap-1">
                                        {job.contractorName || job.contractorCompany || 'Contractor'}
                                    </span>

                                    {/* --- INTELLIGENT STATUS DISPLAY --- */}
                                    {job.scheduledTime ? (
                                        <span className="font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                            {new Date(job.scheduledTime).toLocaleDateString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}
                                        </span>
                                    ) : latestProposal ? (
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 block">Proposed:</span>
                                            <span className="text-amber-600 font-bold text-xs flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                                                 {new Date(latestProposal.date).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'})}
                                                 <ChevronRight size={12} />
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                                            View & Schedule <ChevronRight size={12} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </DashboardSection>

            {/* SCHEDULER MODAL (Unchanged) */}
            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-800">Manage Project</h3>
                                <p className="text-xs text-slate-500">{selectedJob.contractorName || 'Contractor Service'}</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-grow overflow-hidden bg-slate-50">
                            <JobScheduler 
                                job={selectedJob} 
                                userType="homeowner" 
                                onUpdate={() => {
                                    // Optional: Refresh done by listener
                                }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// --- QUOTES SECTION COMPONENT ---
const MyQuotesSection = ({ userId }) => {
    const { quotes, loading, error, refresh } = useCustomerQuotes(userId);

    const handleDelete = async (e, quote) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Remove this quote from your profile?')) return;
        try {
            await unclaimQuote(quote.contractorId, quote.id);
            toast.success('Quote removed');
            refresh();
        } catch (err) {
            console.error(err);
            toast.error('Could not remove quote');
        }
    };

    if (loading || (!quotes.length && error !== 'missing-index')) return null;

    return (
        <DashboardSection 
            title="My Quotes & Estimates" 
            icon={FileText} 
            defaultOpen={true}
            summary={<span className="text-xs text-emerald-600 font-bold">{quotes.length} Active</span>}
        >
            {error === 'missing-index' ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800 text-sm">
                    <AlertTriangle className="shrink-0" />
                    <div>
                        <p className="font-bold">Setup Required (Developer Only)</p>
                        <p>A "Collection Group Index" is required to view these quotes.</p>
                        <p className="mt-1">Check the browser console for the creation link.</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {quotes.map(quote => (
                        <a 
                            key={quote.id}
                            href={`/app/?quote=${quote.contractorId}_${quote.id}`}
                            className="block bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-500 transition-colors group relative pr-10"
                        >
                            <button 
                                onClick={(e) => handleDelete(e, quote)}
                                className="absolute top-3 right-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10 opacity-0 group-hover:opacity-100"
                                title="Remove from profile"
                            >
                                <Trash2 size={16} />
                            </button>

                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate pr-2">
                                    {quote.title}
                                </h3>
                                <span className={`px-2 py-1 rounded text-xs font-bold capitalize shrink-0
                                    ${quote.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 
                                      quote.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}
                                `}>
                                    {quote.status}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-500">
                                <span className="font-medium text-slate-700">${(quote.total || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1 text-xs">
                                    View Details <ExternalLink size={12} />
                                </span>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </DashboardSection>
    );
};

// --- MAIN COMPONENT ---
export const ModernDashboard = ({
    records = [], 
    contractors = [], 
    activeProperty, 
    userId,
    onScanReceipt, 
    onAddRecord,
    onNavigateToItems, 
    onNavigateToContractors, 
    onNavigateToReports, 
    onCreateContractorLink,
    onNavigateToMaintenance, 
    onBookService, 
    onMarkTaskDone,
    onDeleteHistoryItem, 
    onRestoreHistoryItem,
    onDeleteTask,
    onScheduleTask,
    onSnoozeTask
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showScoreDetails, setShowScoreDetails] = useState(false);
    
    const validRecords = Array.isArray(records) ? records : [];
    const healthData = useHomeHealth(validRecords);

    const totalSpent = useMemo(() => {
        return validRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
    }, [validRecords]);

    const maintenanceSummary = useMemo(() => {
        let overdue = 0;
        let dueSoon = 0;
        const now = new Date();

        const checkDate = (dateStr) => {
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            const diffTime = date - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) overdue++;
            else if (diffDays <= 30) dueSoon++;
        };

        validRecords.forEach(record => {
            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(t => {
                   if (t.frequency !== 'none') checkDate(t.nextDue);
                });
            } else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) checkDate(nextDate);
            }
        });

        if (overdue > 0) return <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> {overdue} Needs Attention</span>;
        if (dueSoon > 0) return <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={10} /> {dueSoon} Due Soon</span>;
        return <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} /> All Caught Up</span>;
    }, [validRecords]);

    return (
        <div className="space-y-6 pb-8">
            {/* HERO SECTION */}
            <div className="relative overflow-visible rounded-[2.5rem] shadow-xl z-20 mb-8">
                <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${season.gradient}`} />
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-400/20 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl pointer-events-none" />
                
                <div className="relative p-8 text-white flex flex-col items-center text-center">
                    <p className="text-white/60 text-sm font-bold mb-1 uppercase tracking-wider">{greeting}</p>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">{activeProperty?.name || 'My Home'}</h1>
                    
                    {activeProperty?.address && (
                        <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 mb-6 animate-in fade-in zoom-in-95 duration-500">
                            <MapPin size={14} className="text-white" />
                            <p className="text-white text-sm font-medium">
                                {activeProperty.address.street && `${activeProperty.address.street}, `}
                                {activeProperty.address.city}, {activeProperty.address.state}
                                {activeProperty.address.zip && ` ${activeProperty.address.zip}`}
                            </p>
                        </div>
                    )}
                    
                    <div className="relative group mb-8">
                        <div 
                            className="relative h-24 w-24 cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setShowScoreDetails(!showScoreDetails)}
                        >
                            <svg className="transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" className="stroke-white/20" strokeWidth="10" fill="none" />
                                <circle cx="50" cy="50" r="45" className={healthData?.score >= 80 ? 'stroke-emerald-400' : healthData?.score >= 50 ? 'stroke-amber-400' : 'stroke-red-400'} strokeWidth="10" fill="none" strokeDasharray={`${(healthData?.score || 0) * 2.83} 283`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-black">{healthData?.score || 0}</span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mt-2">Health Score</p>
                        
                        {showScoreDetails && (
                            <HealthScoreCard 
                                breakdown={healthData?.breakdown || {profile: 0, maintenance: 0}} 
                                score={healthData?.score || 0} 
                                onClose={() => setShowScoreDetails(false)}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                        <button onClick={onNavigateToItems} className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10 transition-colors"><p className="text-2xl font-extrabold">{validRecords.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>

            {/* NEW: ACTIVE PROJECTS SECTION (Highest Priority) */}
            <ActiveProjectsSection userId={userId} />

            {/* MY QUOTES SECTION */}
            <MyQuotesSection userId={userId} />

            {/* PROPERTY INTELLIGENCE SECTION */}
            <DashboardSection 
                title="Property Intelligence" 
                icon={Home} 
                defaultOpen={true}
                summary={<span className="text-xs text-emerald-600 font-medium">✨ Auto-discovered</span>}
            >
                <PropertyIntelligence propertyProfile={activeProperty} />
            </DashboardSection>
            
            {/* QUICK ACTIONS SECTION */}
            <DashboardSection title="Quick Actions" icon={Sparkles} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                    <ActionButton icon={Camera} label="Scan Receipt" sublabel="AI-powered" onClick={onScanReceipt} variant="primary" />
                    <ActionButton icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <ActionButton icon={FileText} label="View Report" sublabel="Home pedigree" onClick={onNavigateToReports} />
                    <ActionButton icon={Hammer} label="Service Link" sublabel="For contractors" onClick={onCreateContractorLink} />
                </div>
            </DashboardSection>

            {/* MAINTENANCE SCHEDULE SECTION */}
            <DashboardSection 
                title="Maintenance Schedule" 
                icon={Calendar} 
                defaultOpen={true}
                summary={maintenanceSummary}
            >
                <MaintenanceDashboard 
                    records={records}
                    onAddRecord={onAddRecord}
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                    onNavigateToRecords={onNavigateToItems}
                    onDeleteHistoryItem={onDeleteHistoryItem}
                    onRestoreHistoryItem={onRestoreHistoryItem}
                    onDeleteTask={onDeleteTask}
                    onScheduleTask={onScheduleTask}
                    onSnoozeTask={onSnoozeTask}
                />
            </DashboardSection>

            {/* LOCAL INSIGHTS SECTION */}
            <DashboardSection 
                title="Local Insights" 
                icon={Info} 
                defaultOpen={false}
                summary={<span className="text-xs text-slate-400 font-medium">Environmental, County & Risk Data</span>}
            >
                <div className="space-y-8">
                    <EnvironmentalInsights propertyProfile={activeProperty} />
                    <CountyData propertyProfile={activeProperty} />
                </div>
            </DashboardSection>
        </div>
    );
};

export default ModernDashboard;
