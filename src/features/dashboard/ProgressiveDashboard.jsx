// src/features/dashboard/ProgressiveDashboard.jsx
// ============================================
// 📊 PROGRESSIVE DASHBOARD
// ============================================
// Shows different dashboard views based on how many items the user has tracked.
// - 0 items: Empty state with strong CTA
// - 1-4 items: Getting started view with property intel teaser + progress
// - 5+ items: Full dashboard with all features

import React, { useMemo, useState, useEffect } from 'react';
import { 
    Camera, Plus, Package, Sparkles, MapPin, Wrench, Send,
    Home, Lock, BedDouble, Bath, Ruler, CalendarClock, LandPlot,
    TrendingUp, TrendingDown, FileText, ExternalLink, AlertTriangle, Trash2,
    // NEW IMPORTS for Active Projects
    Hammer, Calendar, Clock, ChevronRight, X, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// Existing components
import { ModernDashboard } from './ModernDashboard';
import { MaintenanceDashboard } from './MaintenanceDashboard';
import { ReportTeaser } from './ReportTeaser';

// NEW: Property data hook for getting started view
import usePropertyData from '../../hooks/usePropertyData';
// NEW: Quotes hook and service
import { useCustomerQuotes } from '../quotes/hooks/useCustomerQuotes';
import { unclaimQuote } from '../quotes/lib/quoteService';

// NEW: Firebase imports for Active Projects
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';

// NEW: Job Scheduler for Homeowner
import { JobScheduler } from '../jobs/JobScheduler';

// ============================================
// HELPERS
// ============================================
const formatNumber = (num) => num ? num.toLocaleString() : '--';
const formatCurrency = (num) => num ? `$${num.toLocaleString()}` : '--';

// ============================================
// ACTIVE PROJECTS SECTION (Progressive Style)
// ============================================
const ActiveProjectsSection = ({ userId }) => {
    const [projects, setProjects] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [loading, setLoading] = useState(true);

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
            
            // Filter for active/negotiating jobs
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

    if (loading || projects.length === 0) return null;

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
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Hammer className="text-emerald-600" />
                Active Projects
            </h2>

            <div className="space-y-3">
                {projects.map(job => {
                    const badge = getStatusBadge(job.status === 'quoted' && job.estimate?.status === 'approved' ? 'scheduling' : job.status);
                    const BadgeIcon = badge.icon;
                    
                    // Get the latest proposal if one exists
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

            {/* SCHEDULER MODAL */}
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
                                job={projects.find(p => p.id === selectedJob.id) || selectedJob} 
                                userType="homeowner" 
                                onUpdate={() => {
                                    // Optional: Refresh done by listener
                                }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// QUOTES SECTION COMPONENT (Reusable)
// ============================================
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
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="text-emerald-600" />
                My Quotes & Estimates
            </h2>

            {error === 'missing-index' ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800 text-sm">
                    <AlertTriangle className="shrink-0" />
                    <div>
                        <p className="font-bold">Setup Required (Developer Only)</p>
                        <p>A "Collection Group Index" is required to view these quotes.</p>
                        <p className="mt-1">Check the browser console for the creation link.</p>
                    </div>
                </div>
            ) : quotes.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {quotes.map(quote => (
                        <a 
                            key={quote.id}
                            href={`/app/?quote=${quote.contractorId}_${quote.id}`}
                            className="block bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-500 transition-colors group relative pr-10"
                        >
                            {/* DELETE BUTTON */}
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
                                <span>${(quote.total || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1">
                                    View <ExternalLink size={14} />
                                </span>
                            </div>
                        </a>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

// ============================================
// EMPTY STATE (0 items)
// ============================================
const EmptyHomeState = ({ propertyName, activeProperty, userId, onAddItem, onScanReceipt, onCreateContractorLink }) => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="inline-flex p-5 bg-emerald-100 rounded-full mb-6 animate-pulse">
            <Home size={40} className="text-emerald-700" />
        </div>
        
        <h1 className="text-2xl font-extrabold text-slate-800 mb-2">
            Welcome to {propertyName || 'Your Home'}
        </h1>
        
        {activeProperty?.address && (
            <div className="inline-flex items-center bg-slate-100 px-3 py-1.5 rounded-full mb-4">
                <MapPin size={12} className="text-emerald-600 mr-1.5" />
                <p className="text-slate-600 text-xs font-medium">
                    {typeof activeProperty.address === 'string' 
                        ? activeProperty.address 
                        : `${activeProperty.address.street}, ${activeProperty.address.city}, ${activeProperty.address.state}`
                    }
                </p>
            </div>
        )}

        {/* ACTIVE PROJECTS & QUOTES */}
        <div className="w-full max-w-lg text-left mb-8">
            <ActiveProjectsSection userId={userId} />
            <MyQuotesSection userId={userId} />
        </div>
        
        <p className="text-slate-500 max-w-md mb-8 text-lg leading-relaxed">
            Snap a photo of any receipt, invoice, or appliance label. We'll extract and organize the details automatically.
        </p>
        
        <div className="w-full max-w-sm space-y-4">
            <button 
                onClick={onScanReceipt}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
            >
                <Camera size={24} />
                Scan a Receipt
                <span className="ml-1 px-2 py-0.5 bg-emerald-500 text-emerald-100 text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles size={10} />
                    AI
                </span>
            </button>
            
            {onCreateContractorLink && (
                <button 
                    onClick={onCreateContractorLink}
                    className="w-full py-4 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border border-amber-200 rounded-2xl font-bold text-base hover:border-amber-300 hover:shadow-md transition-all flex items-center justify-center gap-3"
                >
                    <Wrench size={20} />
                    Have Contractor Add It
                    <Send size={16} className="text-amber-600" />
                </button>
            )}
            
            <button 
                onClick={onAddItem}
                className="w-full py-3 text-slate-500 font-medium hover:text-emerald-600 transition-colors"
            >
                or add details manually
            </button>
        </div>
    </div>
);

// ============================================
// PROPERTY INTEL TEASER (for getting started)
// ============================================
const PropertyIntelTeaser = ({ activeProperty, recordCount, unlockThreshold = 5 }) => {
    const { address, coordinates } = activeProperty || {};
    const {
        propertyData,
        loading,
        estimatedValue,
        appreciation,
    } = usePropertyData(address, coordinates);

    const isUnlocked = recordCount >= unlockThreshold;
    const itemsRemaining = unlockThreshold - recordCount;

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-100 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!propertyData) return null;

    const isPositive = appreciation?.dollarChange > 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Home size={18} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-800">Property Intelligence</h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                    County Records
                </span>
            </div>

            <div className="p-5 space-y-4">
                {/* Basic property stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <CalendarClock size={18} className="mx-auto mb-2 text-emerald-500" />
                        <p className="text-xl font-bold text-slate-800">{propertyData.yearBuilt || '--'}</p>
                        <p className="text-xs text-slate-500 font-medium">Year Built</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <Ruler size={18} className="mx-auto mb-2 text-amber-500" />
                        <p className="text-xl font-bold text-slate-800">{formatNumber(propertyData.squareFootage)}</p>
                        <p className="text-xs text-slate-500 font-medium">Sq Ft</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <LandPlot size={18} className="mx-auto mb-2 text-green-500" />
                        <p className="text-xl font-bold text-slate-800">{propertyData.lotSize ? formatNumber(propertyData.lotSize) : '--'}</p>
                        <p className="text-xs text-slate-500 font-medium">Lot (sqft)</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <BedDouble size={18} className="mx-auto mb-2 text-indigo-500" />
                        <p className="text-xl font-bold text-slate-800">{propertyData.bedrooms || '--'} / {propertyData.bathrooms || '--'}</p>
                        <p className="text-xs text-slate-500 font-medium">Bed / Bath</p>
                    </div>
                </div>

                {/* Locked/Unlocked: Home Value Insights */}
                <div className="relative">
                    <div className={`bg-gradient-to-br ${isUnlocked ? 'from-emerald-500 to-teal-600' : 'from-slate-100 to-slate-200'} rounded-xl p-5 ${!isUnlocked ? 'opacity-60 blur-[2px]' : ''}`}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isUnlocked ? 'text-emerald-200' : 'text-slate-500'}`}>
                            Home Value Insights
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className={`text-xs mb-1 ${isUnlocked ? 'text-emerald-200' : 'text-slate-400'}`}>Estimated Value</p>
                                <p className={`text-2xl font-bold ${isUnlocked ? 'text-white' : 'text-slate-600'}`}>
                                    {formatCurrency(estimatedValue)}
                                </p>
                            </div>
                            <div>
                                <p className={`text-xs mb-1 ${isUnlocked ? 'text-emerald-200' : 'text-slate-400'}`}>
                                    Since Purchase
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-2xl font-bold ${isUnlocked ? (isPositive ? 'text-white' : 'text-red-200') : 'text-slate-600'}`}>
                                        {appreciation ? `${isPositive ? '+' : ''}${formatCurrency(appreciation.dollarChange)}` : '--'}
                                    </p>
                                    {appreciation && isUnlocked && (
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isPositive ? 'bg-white/20 text-white' : 'bg-red-400/30 text-red-100'}`}>
                                            {isPositive ? '+' : ''}{appreciation.percentChange}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-xl border-2 border-dashed border-slate-300">
                            <div className="bg-slate-100 p-3 rounded-full mb-3">
                                <Lock size={24} className="text-slate-500" />
                            </div>
                            <p className="font-bold text-slate-700 text-sm">Home Value Insights</p>
                            <p className="text-slate-500 text-xs">
                                Track {itemsRemaining} more item{itemsRemaining !== 1 ? 's' : ''} to unlock
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// GETTING STARTED DASHBOARD (1-4 items)
// ============================================
const GettingStartedDashboard = ({ 
    records, 
    propertyName,
    activeProperty,
    userId,
    onAddItem, 
    onScanReceipt, 
    onNavigateToItems,
    onBookService,
    onMarkTaskDone,
    onDeleteHistoryItem,
    onRestoreHistoryItem,
    onDeleteTask,
    onScheduleTask,
    onSnoozeTask
}) => {
    const unlockThreshold = 5;
    const progress = Math.min(100, (records.length / unlockThreshold) * 100);
    const remaining = unlockThreshold - records.length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Progress Card */}
            <div className="bg-gradient-to-br from-emerald-800 to-teal-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Sparkles size={120} />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-emerald-300 font-bold text-xs uppercase tracking-wider mb-1">Your Krib</p>
                            <h2 className="text-2xl font-extrabold">{propertyName || 'My Home'}</h2>
                            
                            {activeProperty?.address && (
                                <div className="inline-flex items-center bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 mt-3">
                                    <MapPin size={12} className="text-emerald-300 mr-1.5" />
                                    <p className="text-emerald-50 text-xs font-medium">
                                        {typeof activeProperty.address === 'string' 
                                            ? activeProperty.address 
                                            : `${activeProperty.address.street}, ${activeProperty.address.city}, ${activeProperty.address.state}`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                            <span className="font-bold text-xl">{records.length}</span>
                            <span className="text-emerald-200 text-sm ml-1">/ {unlockThreshold} items</span>
                        </div>
                    </div>

                    <div className="bg-black/20 rounded-full h-3 w-full overflow-hidden mb-3">
                        <div 
                            className="bg-emerald-400 h-full rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <p className="text-emerald-100 font-medium text-sm">
                        {remaining > 0 
                            ? `Add ${remaining} more item${remaining > 1 ? 's' : ''} to unlock Home Value Insights`
                            : "🎉 Home Value Insights unlocked!"
                        }
                    </p>
                </div>
            </div>

            {/* ACTIVE PROJECTS & QUOTES */}
            <ActiveProjectsSection userId={userId} />
            <MyQuotesSection userId={userId} />

            {/* Property Intelligence Teaser */}
            {activeProperty?.address && (
                <PropertyIntelTeaser 
                    activeProperty={activeProperty} 
                    recordCount={records.length}
                    unlockThreshold={unlockThreshold}
                />
            )}

            {/* Quick Add Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={onScanReceipt}
                    className="p-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex flex-col items-center gap-3 hover:border-emerald-400 hover:bg-emerald-100 transition-all group"
                >
                    <div className="bg-emerald-100 p-3 rounded-xl group-hover:bg-emerald-200 transition-colors">
                        <Camera className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-800">Scan Receipt</p>
                        <p className="text-xs text-slate-500">AI-powered</p>
                    </div>
                </button>
                <button 
                    onClick={onAddItem}
                    className="p-5 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center gap-3 hover:border-slate-300 hover:bg-slate-50 transition-all group"
                >
                    <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-slate-200 transition-colors">
                        <Plus className="h-6 w-6 text-slate-600" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-800">Add Manually</p>
                        <p className="text-xs text-slate-500">Enter details</p>
                    </div>
                </button>
            </div>

            {/* Maintenance Schedule */}
            <MaintenanceDashboard 
                title="Maintenance Schedule"
                records={records}
                onAddRecord={onAddItem}
                onBookService={onBookService}
                onMarkTaskDone={onMarkTaskDone}
                onNavigateToRecords={onNavigateToItems}
                onDeleteHistoryItem={onDeleteHistoryItem}
                onRestoreHistoryItem={onRestoreHistoryItem}
                onDeleteTask={onDeleteTask}
                onScheduleTask={onScheduleTask}
                onSnoozeTask={onSnoozeTask}
            />

            {/* Recent Items List (Mini) */}
            {records.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="font-bold text-slate-800">Recent Additions</h3>
                        <button onClick={onNavigateToItems} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All</button>
                    </div>
                    <div className="space-y-3">
                        {records.slice(0, 3).map(record => (
                            <div key={record.id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 shadow-sm">
                                <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{record.item}</p>
                                    <p className="text-xs text-slate-500">{record.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const ProgressiveDashboard = ({
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
    const stage = useMemo(() => {
        if (!records || records.length === 0) return 'empty';
        if (records.length < 5) return 'getting-started';
        return 'established';
    }, [records]);

    switch (stage) {
    case 'empty':
        return (
            <EmptyHomeState 
                propertyName={activeProperty?.name} 
                activeProperty={activeProperty}
                userId={userId}
                onAddItem={onAddRecord} 
                onScanReceipt={onScanReceipt}
                onCreateContractorLink={onCreateContractorLink}
            />
        );
    
    case 'getting-started':
        return (
            <GettingStartedDashboard 
                records={records} 
                propertyName={activeProperty?.name}
                activeProperty={activeProperty}
                userId={userId}
                onAddItem={onAddRecord} 
                onScanReceipt={onScanReceipt} 
                onNavigateToItems={onNavigateToItems}  
                onBookService={onBookService}
                onMarkTaskDone={onMarkTaskDone}
                onDeleteHistoryItem={onDeleteHistoryItem}
                onRestoreHistoryItem={onRestoreHistoryItem}
                onDeleteTask={onDeleteTask}
                onScheduleTask={onScheduleTask}
                onSnoozeTask={onSnoozeTask}
            />
        );
    
    case 'established':
    default:
        // Established view uses ModernDashboard which handles everything
        return (
            <ModernDashboard 
                records={records}
                contractors={contractors}
                activeProperty={activeProperty}
                userId={userId}
                onScanReceipt={onScanReceipt}
                onAddRecord={onAddRecord}
                onNavigateToItems={onNavigateToItems}
                onNavigateToContractors={onNavigateToContractors}
                onNavigateToReports={onNavigateToReports}
                onCreateContractorLink={onCreateContractorLink}
                onNavigateToMaintenance={onNavigateToMaintenance}
                onBookService={onBookService}
                onMarkTaskDone={onMarkTaskDone}
                onDeleteHistoryItem={onDeleteHistoryItem}
                onRestoreHistoryItem={onRestoreHistoryItem}
                onDeleteTask={onDeleteTask}
                onScheduleTask={onScheduleTask}
                onSnoozeTask={onSnoozeTask}
            />
        );
    }
};

export default ProgressiveDashboard;
