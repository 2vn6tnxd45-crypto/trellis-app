// src/features/dashboard/ProgressiveDashboard.jsx
// ============================================
// 📊 PROGRESSIVE DASHBOARD
// ============================================
// Shows different dashboard views based on how many items the user has tracked.
// - 0 items: Empty state with strong CTA
// - 1-4 items: Getting started view with profile builder + public records
// - 5+ items: Full dashboard with all features

import React, { useMemo, useState, useEffect } from 'react';
import {
    Camera, Plus, Package, Sparkles, MapPin, Wrench, Send,
    Home, Lock, BedDouble, Bath, Ruler, CalendarClock, LandPlot,
    TrendingUp, TrendingDown, FileText, ExternalLink, AlertTriangle, Trash2,
    Hammer, Calendar, Clock, ChevronRight, X, Info, CheckCircle2,
    ClipboardCheck, Wind, Droplets, Palette, Refrigerator, Shield,
    Zap, CircleDollarSign, FileCheck, Building2, ScanLine, ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';

// Existing components
import { ModernDashboard } from './ModernDashboard';
import { MaintenanceDashboard } from './MaintenanceDashboard';
import { ReportTeaser } from './ReportTeaser';

// Property data hook for getting started view
import { useProperty } from '../../contexts/PropertyContext';
// Quotes hook and service
import { useCustomerQuotes } from '../quotes/hooks/useCustomerQuotes';
import { unclaimQuote } from '../quotes/lib/quoteService';

// Firebase imports for Active Projects
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, appId } from '../../config/constants';

// Job Scheduler for Homeowner
import { JobScheduler } from '../jobs/JobScheduler';
// Job management components
import { CancelJobModal } from '../jobs/CancelJobModal';
import { RequestTimesModal } from '../jobs/RequestTimesModal';
import { DashboardSection } from '../../components/common/DashboardSection';
import { HomeownerJobCard } from '../jobs/HomeownerJobCard';

// Job Completion Review
import { JobCompletionReview } from '../jobs/components/completion';

// ============================================
// HELPERS
// ============================================
const formatNumber = (num) => num ? num.toLocaleString() : '--';
const formatCurrency = (num) => num ? `$${num.toLocaleString()}` : '--';

// Helper to safely extract address string (prevents React Error #310)
const safeAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
        if (addr.formatted) return addr.formatted;
        if (addr.full) return addr.full;
        if (addr.street) return addr.street;
        return '';
    }
    return String(addr);
};
const formatYear = (dateString) => {
    if (!dateString) return null;
    try {
        return new Date(dateString).getFullYear();
    } catch {
        return null;
    }
};

// ============================================
// ACTIVE PROJECTS SECTION (Progressive Style)
// ============================================
const ActiveProjectsSection = ({ userId, timezone }) => {
    const [projects, setProjects] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [cancellingJob, setCancellingJob] = useState(null);
    const [requestingTimesJob, setRequestingTimesJob] = useState(null);
    const [reviewingJob, setReviewingJob] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        // Query by BOTH createdBy (direct requests) AND customerId (quote jobs)
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

            // Merge and dedupe by id
            const merged = new Map();
            [...results1, ...results2].forEach(job => {
                merged.set(job.id, job);
            });

            const allJobs = Array.from(merged.values());

            // Filter for active/negotiating jobs (exclude cancelled and completed)
            const active = allJobs.filter(r =>
                !['cancelled', 'completed', 'archived'].includes(r.status) &&
                (
                    ['pending_schedule', 'slots_offered', 'scheduling', 'scheduled', 'in_progress', 'pending_completion', 'revision_requested', 'cancellation_requested'].includes(r.status) ||
                    (r.status === 'quoted' && r.estimate?.status === 'approved')
                )
            );

            // Sort by last activity
            active.sort((a, b) => {
                const aTime = a.lastActivity?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                const bTime = b.lastActivity?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                return bTime - aTime;
            });

            setProjects(active);
            setLoading(false);
        };

        const unsub1 = onSnapshot(q1, (snap) => {
            results1 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            loaded1 = true;
            mergeAndUpdate();
        }, (err) => {
            console.error('Projects query 1 error:', err);
            loaded1 = true;
            mergeAndUpdate();
        });

        const unsub2 = onSnapshot(q2, (snap) => {
            results2 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            loaded2 = true;
            mergeAndUpdate();
        }, (err) => {
            console.error('Projects query 2 error:', err);
            loaded2 = true;
            mergeAndUpdate();
        });

        return () => {
            unsub1();
            unsub2();
        };
    }, [userId]);

    // Helper to determine summary text
    const getStatusSummary = () => {
        const needsAction = projects.filter(p =>
            p.status === 'slots_offered' ||
            p.status === 'pending_completion' ||
            p.status === 'revision_requested'
        ).length;
        const scheduled = projects.filter(p => p.status === 'scheduled').length;
        const inProgress = projects.filter(p => p.status === 'in_progress').length;

        if (needsAction > 0) {
            return <span className="text-xs text-amber-600 font-bold">{needsAction} need{needsAction === 1 ? 's' : ''} action</span>;
        }
        if (inProgress > 0) {
            return <span className="text-xs text-blue-600 font-bold">{inProgress} in progress</span>;
        }
        if (scheduled > 0) {
            return <span className="text-xs text-emerald-600 font-bold">{scheduled} scheduled</span>;
        }
        return <span className="text-xs text-slate-500 font-medium">{projects.length} active</span>;
    };

    if (loading) {
        return (
            <DashboardSection
                title="Active Projects"
                icon={Hammer}
                defaultOpen={true}
            >
                <div className="py-8 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-slate-400 mt-2">Loading projects...</p>
                </div>
            </DashboardSection>
        );
    }

    if (projects.length === 0) {
        return null; // Don't show section if no active projects
    }

    return (
        <>
            <DashboardSection
                title="Active Projects"
                icon={Hammer}
                defaultOpen={true}
                summary={getStatusSummary()}
            >
                <div className="space-y-3">
                    {projects.map(job => (
                        <HomeownerJobCard
                            key={job.id}
                            job={job}
                            onSelect={(selectedJob) => {
                                if (selectedJob.status === 'pending_completion') {
                                    setReviewingJob(selectedJob);
                                } else {
                                    setSelectedJob(selectedJob);
                                }
                            }}
                            onCancel={(jobToCancel) => setCancellingJob(jobToCancel)}
                            onRequestNewTimes={(jobForTimes) => setRequestingTimesJob(jobForTimes)}
                            timezone={timezone}
                        />
                    ))}
                </div>
            </DashboardSection>

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-800">{selectedJob.title || selectedJob.description || 'Manage Project'}</h3>
                                <p className="text-xs text-slate-500">{selectedJob.contractorName || 'Contractor'}</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-grow overflow-hidden bg-slate-50">
                            <JobScheduler
                                job={projects.find(p => p.id === selectedJob.id) || selectedJob}
                                userType="homeowner"
                                onUpdate={() => { }}
                                timezone={timezone}
                            />
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-white shrink-0">
                            <button
                                onClick={() => {
                                    setSelectedJob(null);
                                    setCancellingJob(selectedJob);
                                }}
                                className="px-4 py-2.5 text-red-600 font-medium rounded-xl border border-red-200 hover:bg-red-50 transition-colors text-sm"
                            >
                                Cancel Job
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Job Modal */}
            {cancellingJob && (
                <CancelJobModal
                    job={cancellingJob}
                    onClose={() => setCancellingJob(null)}
                    onSuccess={() => setCancellingJob(null)}
                />
            )}

            {/* Request Times Modal */}
            {requestingTimesJob && (
                <RequestTimesModal
                    job={requestingTimesJob}
                    onClose={() => setRequestingTimesJob(null)}
                    onSuccess={() => setRequestingTimesJob(null)}
                />
            )}

            {/* Job Completion Review Modal */}
            {reviewingJob && (
                <JobCompletionReview
                    job={projects.find(p => p.id === reviewingJob.id) || reviewingJob}
                    userId={userId}
                    propertyId={reviewingJob.propertyId}
                    onSuccess={() => {
                        setReviewingJob(null);
                        toast.success('Job completed! Items added to your inventory.');
                    }}
                    onClose={() => setReviewingJob(null)}
                />
            )}
        </>
    );
};

// ============================================
// QUOTES SECTION COMPONENT
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
                <div className="space-y-3">
                    {quotes.map(quote => (
                        <a
                            key={quote.id}
                            href={`/app/?quote=${quote.contractorId}_${quote.id}`}
                            className="block bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all group relative"
                        >
                            {/* Delete button */}
                            <button
                                onClick={(e) => handleDelete(e, quote)}
                                className="absolute top-3 right-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10 opacity-0 group-hover:opacity-100"
                                title="Remove from profile"
                            >
                                <Trash2 size={16} />
                            </button>

                            {/* Header Row */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 min-w-0 pr-8">
                                    <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                                        {quote.title}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {quote.contractorName || quote.contractor?.companyName || 'Contractor'}
                                    </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize shrink-0 flex items-center gap-1
                                    ${quote.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                        quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                            quote.status === 'viewed' ? 'bg-purple-100 text-purple-700' :
                                                'bg-slate-100 text-slate-700'}`}
                                >
                                    {quote.status === 'accepted' && <CheckCircle2 size={12} />}
                                    {quote.status}
                                </span>
                            </div>

                            {/* Address if available */}
                            {safeAddress(quote.customer?.address) && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                                    <MapPin size={12} />
                                    <span className="truncate">{safeAddress(quote.customer.address)}</span>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                <span className="text-lg font-bold text-slate-800">
                                    {formatCurrency(quote.total)}
                                </span>
                                {quote.status !== 'accepted' && (
                                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                                        Review Quote <ChevronRight size={14} />
                                    </span>
                                )}
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </DashboardSection>
    );
};

// ============================================
// PENDING EVALUATIONS SECTION
// ============================================
const PendingEvaluationsSection = ({ userId }) => {
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchPendingEvaluations = async () => {
            try {
                const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);

                if (profileSnap.exists()) {
                    const profile = profileSnap.data();
                    setEvaluations(profile.pendingEvaluations || []);
                }
            } catch (err) {
                console.error('Error fetching pending evaluations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingEvaluations();
    }, [userId]);

    if (loading || evaluations.length === 0) return null;

    return (
        <DashboardSection
            title="Awaiting Quotes"
            icon={ClipboardList}
            defaultOpen={true}
            summary={<span className="text-xs text-indigo-600 font-bold">{evaluations.length} pending</span>}
        >
            <div className="space-y-3">
                {evaluations.map((evaluation, index) => (
                    <div
                        key={evaluation.evaluationId || index}
                        className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800">
                                    {evaluation.jobDescription || 'Service Request'}
                                </h3>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {evaluation.contractorName || 'Contractor'}
                                </p>
                            </div>
                            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0">
                                <Clock size={10} />
                                Awaiting Quote
                            </span>
                        </div>

                        {evaluation.propertyAddress && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                                <MapPin size={12} />
                                <span className="truncate">{evaluation.propertyAddress}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                            <span className="text-xs text-slate-400">
                                Submitted {new Date(evaluation.submittedAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-indigo-600 font-medium">
                                Quote coming soon
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </DashboardSection>
    );
};

// ============================================
// PUBLIC RECORDS CARD (Real Data - Honest Display)
// ============================================
// Shows ACTUAL property data - tax assessment & sale price, not fake estimates
const PublicRecordsCard = ({ activeProperty }) => {
    const {
        propertyData,
        loading,
        hasData,
    } = useProperty();

    // Loading state
    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-5 w-5 bg-slate-200 rounded"></div>
                    <div className="h-4 bg-slate-200 rounded w-32"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 bg-slate-100 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    // No data - don't show the card at all (honest UX)
    if (!hasData || !propertyData) {
        return null;
    }

    // Calculate real appreciation from actual data
    const lastSaleYear = formatYear(propertyData.lastSaleDate);
    const hasAppreciation = propertyData.taxAssessment && propertyData.lastSalePrice;
    const appreciationDollars = hasAppreciation
        ? propertyData.taxAssessment - propertyData.lastSalePrice
        : null;
    const appreciationPercent = hasAppreciation
        ? Math.round(((propertyData.taxAssessment - propertyData.lastSalePrice) / propertyData.lastSalePrice) * 100)
        : null;
    const isPositive = appreciationDollars > 0;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-800">Public Records</h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <FileCheck size={10} />
                    County Data
                </span>
            </div>

            <div className="p-5 space-y-4">
                {/* Property Stats Grid */}
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

                {/* Financial Data - REAL NUMBERS */}
                {(propertyData.taxAssessment || propertyData.lastSalePrice) && (
                    <div className="flex justify-center">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                            {/* Tax Assessment */}
                            {propertyData.taxAssessment && (
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <FileText size={14} className="text-blue-600" />
                                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                                            Tax Assessment
                                        </p>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {formatCurrency(propertyData.taxAssessment)}
                                    </p>
                                    {propertyData.assessmentYear && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            {propertyData.assessmentYear} assessment
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Last Sale */}
                            {propertyData.lastSalePrice && (
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <CircleDollarSign size={14} className="text-emerald-600" />
                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                                            Last Sale
                                        </p>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {formatCurrency(propertyData.lastSalePrice)}
                                    </p>
                                    {lastSaleYear && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            Purchased in {lastSaleYear}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Appreciation Badge (if we have both numbers) */}
                {hasAppreciation && (
                    <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                        {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span className="font-bold">
                            {isPositive ? '+' : ''}{formatCurrency(appreciationDollars)}
                        </span>
                        <span className="text-sm opacity-75">
                            ({isPositive ? '+' : ''}{appreciationPercent}% since purchase)
                        </span>
                    </div>
                )}

                {/* Attribution */}
                <p className="text-xs text-slate-400 text-center">
                    Data sourced from county assessor records
                </p>
            </div>
        </div>
    );
};

// ============================================
// AI SCAN CTA - THE MAGIC MOMENT
// ============================================
// Sells the AI scanning feature with clear benefits
const AIScanCTA = ({ onScanReceipt, onAddManually }) => {
    return (
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
                <ScanLine size={180} strokeWidth={1} />
            </div>

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                        <Sparkles size={20} className="text-emerald-200" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Snap a photo. We'll do the rest.</h3>
                    </div>
                </div>

                {/* Description */}
                <p className="text-emerald-100 text-sm mb-4">
                    Just photograph a receipt, invoice, or appliance label — our AI extracts everything automatically.
                </p>

                {/* What AI extracts */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                        <span className="text-emerald-50">Brand & Model</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                        <span className="text-emerald-50">Purchase Date</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                        <span className="text-emerald-50">Serial Number</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                        <span className="text-emerald-50">Warranty Info</span>
                    </div>
                </div>

                {/* CTA Button */}
                <button
                    onClick={onScanReceipt}
                    className="w-full py-4 bg-white text-emerald-700 rounded-xl font-bold text-base
                               hover:bg-emerald-50 transition-all flex items-center justify-center gap-3
                               shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Camera size={22} />
                    Try It — Scan Something
                </button>

                {/* Secondary action */}
                <button
                    onClick={onAddManually}
                    className="w-full mt-3 py-2 text-emerald-200 text-sm font-medium hover:text-white transition-colors"
                >
                    or add details manually
                </button>
            </div>
        </div>
    );
};



// ============================================
// QUICK START SUGGESTIONS
// ============================================
// Lighter-weight list of items to track
const QuickStartSuggestions = ({ onScanReceipt }) => {
    const suggestions = [
        { name: 'HVAC System', icon: Wind, color: 'text-blue-500', hint: 'Furnace, AC unit' },
        { name: 'Water Heater', icon: Droplets, color: 'text-cyan-500', hint: 'Tank or tankless' },
        { name: 'Roof', icon: Home, color: 'text-orange-500', hint: 'Age & warranty' },
        { name: 'Appliances', icon: Refrigerator, color: 'text-slate-500', hint: 'Fridge, washer, etc.' },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-emerald-600" />
                    <h3 className="font-bold text-slate-800">Start with these</h3>
                </div>
            </div>

            <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                    {suggestions.map((item) => (
                        <button
                            key={item.name}
                            onClick={onScanReceipt}
                            className="p-3 bg-slate-50 rounded-xl flex items-center gap-3 
                                       hover:bg-emerald-50 border border-transparent hover:border-emerald-200
                                       transition-all text-left group"
                        >
                            <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:border-emerald-200 transition-colors">
                                <item.icon size={18} className={`${item.color} group-hover:text-emerald-600 transition-colors`} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-slate-700 text-sm group-hover:text-emerald-700 transition-colors">
                                    {item.name}
                                </p>
                                <p className="text-xs text-slate-400 truncate">{item.hint}</p>
                            </div>
                        </button>
                    ))}
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
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Home size={150} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <p className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-1">Your Krib</p>
                            <h2 className="text-2xl font-extrabold">{propertyName || 'My Home'}</h2>
                        </div>
                        <div className="bg-emerald-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-500/30">
                            <span className="font-bold text-emerald-400 text-sm">{records.length} item{records.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    {activeProperty?.address && (
                        <div className="inline-flex items-center text-slate-400 text-sm mt-2">
                            <MapPin size={14} className="mr-1.5" />
                            <span>
                                {typeof activeProperty.address === 'string'
                                    ? activeProperty.address
                                    : activeProperty.address.street || `${activeProperty.address.city}, ${activeProperty.address.state}`
                                }
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <ActiveProjectsSection userId={userId} timezone={activeProperty?.timezone} />
            <MyQuotesSection userId={userId} />
            <PendingEvaluationsSection userId={userId} />

            {/* Public Records Card (Real Rentcast Data - if available) */}
            {activeProperty?.address && (
                <PublicRecordsCard activeProperty={activeProperty} />
            )}

            {/* AI Scan CTA - THE STAR OF THE SHOW */}
            <AIScanCTA onScanReceipt={onScanReceipt} onAddManually={onAddItem} />

            {/* Quick Start Suggestions */}
            <QuickStartSuggestions onScanReceipt={onScanReceipt} />

            {/* Recent Items Preview */}
            {records.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800">Your Items</h3>
                        <button
                            onClick={onNavigateToItems}
                            className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                        >
                            View All →
                        </button>
                    </div>
                    <div className="space-y-3">
                        {records.slice(0, 3).map((record, i) => (
                            <div key={record.id || i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-500">
                                    <Package size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{record.item}</p>
                                    <p className="text-xs text-slate-500">{record.category}</p>
                                </div>
                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// EMPTY STATE (0 items)
// ============================================
const EmptyHomeState = ({ propertyName, activeProperty, userId, onAddItem, onScanReceipt, onCreateContractorLink, recordCount }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Welcome Hero */}
            <div className="text-center py-6">
                <div className="inline-flex p-4 bg-emerald-100 rounded-full mb-4">
                    <Home size={36} className="text-emerald-700" />
                </div>

                <h1 className="text-2xl font-extrabold text-slate-800 mb-2">
                    Welcome to {propertyName || 'Your Krib'}
                </h1>

                {activeProperty?.address && (
                    <div className="inline-flex items-center bg-slate-100 px-3 py-1.5 rounded-full">
                        <MapPin size={12} className="text-emerald-600 mr-1.5" />
                        <p className="text-slate-600 text-xs font-medium">
                            {typeof activeProperty.address === 'string'
                                ? activeProperty.address
                                : activeProperty.address.street || `${activeProperty.address.city}, ${activeProperty.address.state}`
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* ACTIVE PROJECTS & QUOTES */}
            <ActiveProjectsSection userId={userId} timezone={activeProperty?.timezone} />
            <MyQuotesSection userId={userId} />
            <PendingEvaluationsSection userId={userId} />


            {/* Public Records Card (Real Rentcast Data - if available) */}
            {activeProperty?.address && (
                <PublicRecordsCard activeProperty={activeProperty} />
            )}

            {/* AI Scan CTA - THE STAR OF THE SHOW */}
            <AIScanCTA onScanReceipt={onScanReceipt} onAddManually={onAddItem} />

            {/* Quick Start Suggestions */}
            <QuickStartSuggestions onScanReceipt={onScanReceipt} />

            {/* Contractor Add Option */}
            {onCreateContractorLink && (
                <button
                    onClick={onCreateContractorLink}
                    className="w-full py-4 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border border-amber-200 rounded-2xl font-bold text-base hover:border-amber-300 hover:shadow-md transition-all flex items-center justify-center gap-3"
                >
                    <Wrench size={20} />
                    Have a Contractor Add Items
                    <Send size={16} className="text-amber-600" />
                </button>
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
                    recordCount={records.length}
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
