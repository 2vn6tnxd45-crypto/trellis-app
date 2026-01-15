// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import {
    Sparkles, Plus, Camera, Clock, Package, FileText,
    AlertTriangle, Wrench, CheckCircle2, Info,
    Calendar, X, ExternalLink, Hammer, MapPin, Home,
    Trash2, ClipboardList, Archive, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EnvironmentalInsights } from './EnvironmentalInsights';
import { PropertyIntelligence } from './PropertyIntelligence';
import { useHomeHealth } from '../../hooks/useHomeHealth';
import { MAINTENANCE_FREQUENCIES, REQUESTS_COLLECTION_PATH } from '../../config/constants';
import { DashboardSection } from '../../components/common/DashboardSection';
import { HomeArchive } from '../archive';
import { MyContractorsSection } from './components/MyContractorsSection';

// Firebase imports
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { appId } from '../../config/constants';

// Job management
import { JobScheduler } from '../jobs/JobScheduler';
import { useCustomerQuotes } from '../quotes/hooks/useCustomerQuotes';
import { unclaimQuote } from '../quotes/lib/quoteService';
import { CancelJobModal } from '../jobs/CancelJobModal';
import { RequestTimesModal } from '../jobs/RequestTimesModal';
import { HomeownerJobCard } from '../jobs/HomeownerJobCard';
import { JobCompletionReview } from '../jobs/components/completion';

// Recurring Services
import { useCustomerRecurringServices, RecurringServiceCard } from '../recurring';

// Unified Calendar
import { UnifiedCalendar } from './components/UnifiedCalendar';

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

// --- ACTIVE PROJECTS SECTION ---
const ActiveProjectsSection = ({ userId, onCountChange }) => {
    const [projects, setProjects] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [cancellingJob, setCancellingJob] = useState(null);
    const [requestingTimesJob, setRequestingTimesJob] = useState(null);
    const [reviewingJob, setReviewingJob] = useState(null);  // For completion review
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
            // UPDATED: Added pending_completion and revision_requested statuses
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
            // Report count to parent for smart hierarchy
            if (onCountChange) onCountChange(active.length);
        };

        const unsub1 = onSnapshot(q1, (snapshot) => {
            results1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loaded1 = true;
            mergeAndUpdate();
        }, (error) => {
            console.error("Query 1 Error:", error);
            loaded1 = true;
            mergeAndUpdate();
        });

        const unsub2 = onSnapshot(q2, (snapshot) => {
            results2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loaded2 = true;
            mergeAndUpdate();
        }, (error) => {
            console.error("Query 2 Error:", error);
            loaded2 = true;
            mergeAndUpdate();
        });

        return () => {
            unsub1();
            unsub2();
        };
    }, [userId]);

    // Handle job selection - open scheduler modal OR completion review
    const handleSelectJob = (job) => {
        // NEW: If job needs completion review, open that instead of scheduler
        if (job.status === 'pending_completion') {
            setReviewingJob(job);
        } else {
            setSelectedJob(job);
        }
    };

    // Handle cancel job
    const handleCancelJob = (job) => {
        setCancellingJob(job);
    };

    // Handle request new times
    const handleRequestNewTimes = (job) => {
        setRequestingTimesJob(job);
    };

    // Get status badge config (for summary display)
    // UPDATED: Added pending_completion to needsAction count
    const getStatusSummary = () => {
        const needsAction = projects.filter(j =>
            j.status === 'slots_offered' ||
            j.status === 'pending_completion' ||
            (j.status === 'scheduling' && j.proposedTimes?.some(p => p.proposedBy === 'contractor'))
        ).length;

        const scheduled = projects.filter(j => j.status === 'scheduled').length;
        const inProgress = projects.filter(j => j.status === 'in_progress').length;

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
                            onSelect={handleSelectJob}
                            onCancel={handleCancelJob}
                            onRequestNewTimes={handleRequestNewTimes}
                        />
                    ))}
                </div>
            </DashboardSection>

            {/* Job Scheduler Modal */}
            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-800">
                                    {selectedJob.title || selectedJob.description || 'Manage Project'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {selectedJob.contractorName || selectedJob.contractorCompany || 'Contractor'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedJob(null)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-grow overflow-hidden bg-slate-50">
                            {/* Use real-time project data */}
                            <JobScheduler
                                job={projects.find(p => p.id === selectedJob.id) || selectedJob}
                                userType="homeowner"
                                onUpdate={() => { }}
                            />
                        </div>
                        {/* Modal Footer with Actions */}
                        <div className="p-4 border-t border-slate-100 bg-white flex gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    setSelectedJob(null);
                                    setRequestingTimesJob(selectedJob);
                                }}
                                className="flex-1 px-4 py-2.5 text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
                            >
                                Request Different Times
                            </button>
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

            {/* Job Completion Review Modal - Component handles its own modal styling */}
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

// --- QUOTES SECTION COMPONENT ---
const MyQuotesSection = ({ userId, onCountChange }) => {
    const { quotes, loading, error, refresh } = useCustomerQuotes(userId);

    // Filter out accepted/declined quotes - they become jobs in ActiveProjectsSection
    const activeQuotes = quotes.filter(q =>
        !['accepted', 'declined', 'expired', 'cancelled'].includes(q.status)
    );

    // Report count to parent for smart hierarchy
    useEffect(() => {
        if (onCountChange && !loading) onCountChange(activeQuotes.length);
    }, [activeQuotes.length, loading, onCountChange]);

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

    if (loading || (!activeQuotes.length && error !== 'missing-index')) return null;

    return (
        <DashboardSection
            title="My Quotes & Estimates"
            icon={FileText}
            defaultOpen={true}
            summary={<span className="text-xs text-emerald-600 font-bold">{activeQuotes.length} Active</span>}
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
                    {activeQuotes.map(quote => (
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
                                <div className="flex-1 min-w-0 pr-2">
                                    <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors truncate">
                                        {quote.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                        from {quote.contractorName || quote.contractor?.companyName || 'Contractor'}
                                    </p>
                                </div>
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

// --- PENDING EVALUATIONS SECTION ---
const PendingEvaluationsSection = ({ userId, onCountChange }) => {
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
                    const evals = profile.pendingEvaluations || [];
                    setEvaluations(evals);
                    // Report count to parent for smart hierarchy
                    if (onCountChange) onCountChange(evals.length);
                }
            } catch (err) {
                console.error('Error fetching pending evaluations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingEvaluations();
    }, [userId, onCountChange]);

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

// --- RECURRING SERVICES SECTION ---
const RecurringServicesSection = ({ userId, onCountChange }) => {
    const { services, activeServices, pausedServices, loading, error, skip, pause, resume } = useCustomerRecurringServices(userId);

    // Report count to parent
    useEffect(() => {
        if (onCountChange && !loading) onCountChange(services.length);
    }, [services.length, loading, onCountChange]);

    if (loading) return null; // Don't show loading state for this section
    if (services.length === 0) return null; // Don't show section if no recurring services

    // Calculate summary for the section header
    const getSummary = () => {
        if (pausedServices.length > 0) {
            return <span className="text-xs text-amber-600 font-bold">{pausedServices.length} paused</span>;
        }
        return <span className="text-xs text-emerald-600 font-bold">{activeServices.length} active</span>;
    };

    return (
        <DashboardSection
            title="Recurring Services"
            icon={RotateCcw}
            defaultOpen={true}
            summary={getSummary()}
        >
            <div className="space-y-3">
                {services.map(service => (
                    <RecurringServiceCard
                        key={service.id}
                        service={service}
                        variant="homeowner"
                        onSkip={() => skip(service.id)}
                        onPause={() => pause(service.id)}
                        onResume={() => resume(service.id)}
                    />
                ))}
            </div>
        </DashboardSection>
    );
};

// --- ACTION NEEDED CONSOLIDATED SECTION ---
// Wraps all active work in a single expandable section with smart summary
const ActionNeededSection = ({
    userId,
    onProjectCountChange,
    onQuoteCountChange,
    onEvalCountChange
}) => {
    const [projectCount, setProjectCount] = useState(0);
    const [quoteCount, setQuoteCount] = useState(0);
    const [evalCount, setEvalCount] = useState(0);
    const [recurringCount, setRecurringCount] = useState(0);

    // Forward counts to parent if needed
    useEffect(() => {
        if (onProjectCountChange) onProjectCountChange(projectCount);
    }, [projectCount, onProjectCountChange]);

    useEffect(() => {
        if (onQuoteCountChange) onQuoteCountChange(quoteCount);
    }, [quoteCount, onQuoteCountChange]);

    useEffect(() => {
        if (onEvalCountChange) onEvalCountChange(evalCount);
    }, [evalCount, onEvalCountChange]);

    const totalItems = projectCount + quoteCount + evalCount + recurringCount;

    // Generate smart summary for the section header
    const getSummary = () => {
        const parts = [];
        if (projectCount > 0) parts.push(`${projectCount} project${projectCount > 1 ? 's' : ''}`);
        if (quoteCount > 0) parts.push(`${quoteCount} quote${quoteCount > 1 ? 's' : ''}`);
        if (evalCount > 0) parts.push(`${evalCount} pending`);
        if (recurringCount > 0) parts.push(`${recurringCount} recurring`);

        if (parts.length === 0) return null;

        return (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} />
                {parts.slice(0, 2).join(', ')}
                {parts.length > 2 && ` +${parts.length - 2}`}
            </span>
        );
    };

    // Don't render section if nothing to show
    if (totalItems === 0 && projectCount === 0 && quoteCount === 0 && evalCount === 0) {
        // Still render the subsections to get counts, but hidden
        return (
            <div className="hidden">
                <ActiveProjectsSection userId={userId} onCountChange={setProjectCount} />
                <RecurringServicesSection userId={userId} onCountChange={setRecurringCount} />
                <MyQuotesSection userId={userId} onCountChange={setQuoteCount} />
                <PendingEvaluationsSection userId={userId} onCountChange={setEvalCount} />
            </div>
        );
    }

    return (
        <DashboardSection
            title="Action Needed"
            icon={AlertTriangle}
            defaultOpen={true}
            summary={getSummary()}
        >
            <div className="space-y-4">
                {/* Active Projects - inline, not nested in another DashboardSection */}
                <ActiveProjectsSection userId={userId} onCountChange={setProjectCount} />

                {/* Recurring Services */}
                <RecurringServicesSection userId={userId} onCountChange={setRecurringCount} />

                {/* Quotes */}
                <MyQuotesSection userId={userId} onCountChange={setQuoteCount} />

                {/* Pending Evaluations */}
                <PendingEvaluationsSection userId={userId} onCountChange={setEvalCount} />
            </div>
        </DashboardSection>
    );
};

// --- MAIN COMPONENT ---
export const ModernDashboard = ({
    records = [],
    contractors = [],
    activeProperty,
    userId,
    userProfile,
    onScanReceipt,
    onAddRecord,
    onNavigateToItems,
    onNavigateToContractors,
    onNavigateToReports,
    onCreateContractorLink
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showScoreDetails, setShowScoreDetails] = useState(false);

    // Track active project counts for smart hierarchy
    const [activeProjectCount, setActiveProjectCount] = useState(0);
    const [pendingQuoteCount, setPendingQuoteCount] = useState(0);
    const [pendingEvalCount, setPendingEvalCount] = useState(0);

    const validRecords = Array.isArray(records) ? records : [];
    const healthData = useHomeHealth(validRecords);

    const totalSpent = useMemo(() => {
        return validRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
    }, [validRecords]);

    // Determine user state for smart hierarchy
    const userState = useMemo(() => {
        const hasActiveWork = activeProjectCount > 0 || pendingQuoteCount > 0 || pendingEvalCount > 0;
        const hasEstablishedProfile = validRecords.length >= 3 || contractors.length >= 1;
        const isNewUser = validRecords.length === 0 && contractors.length === 0;

        if (hasActiveWork) return 'active-work'; // Show projects first
        if (hasEstablishedProfile) return 'established'; // Show property intelligence first
        return 'new-user'; // Show onboarding
    }, [activeProjectCount, pendingQuoteCount, pendingEvalCount, validRecords.length, contractors.length]);

    // Compute maintenance tasks for the unified calendar
    const maintenanceTasks = useMemo(() => {
        const tasks = [];
        const now = new Date();

        validRecords.forEach(record => {
            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(t => {
                    if (t.frequency !== 'none' && t.nextDue) {
                        const nextDate = new Date(t.nextDue);
                        if (!isNaN(nextDate.getTime())) {
                            const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                            tasks.push({
                                id: `${record.id}-${t.taskName}`,
                                recordId: record.id,
                                item: record.item,
                                taskName: t.taskName,
                                nextDate: nextDate,
                                daysUntil: daysUntil,
                                frequency: t.frequency,
                                contractor: record.contractor || null,
                                scheduledDate: t.scheduledDate || null
                            });
                        }
                    }
                });
            } else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) {
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    tasks.push({
                        id: `${record.id}-maintenance`,
                        recordId: record.id,
                        item: record.item,
                        taskName: 'Maintenance',
                        nextDate: nextDate,
                        daysUntil: daysUntil,
                        frequency: record.maintenanceFrequency,
                        contractor: record.contractor || null,
                        scheduledDate: null
                    });
                }
            }
        });

        return tasks;
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
                                breakdown={healthData?.breakdown || { profile: 0, maintenance: 0 }}
                                score={healthData?.score || 0}
                                onClose={() => setShowScoreDetails(false)}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                        <button onClick={onNavigateToItems} className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10 transition-colors"><p className="text-2xl font-extrabold">{validRecords.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(totalSpent).replace('$', '')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>

            {/* ============================================ */}
            {/* SMART HIERARCHY - Content order based on user state */}
            {/* ============================================ */}

            {/* ACTION NEEDED - Consolidated active work section */}
            <ActionNeededSection
                userId={userId}
                onProjectCountChange={setActiveProjectCount}
                onQuoteCountChange={setPendingQuoteCount}
                onEvalCountChange={setPendingEvalCount}
            />

            {/* MY HOME - Consolidated Property Intelligence + Environmental Insights */}
            <DashboardSection
                title="My Home"
                icon={Home}
                defaultOpen={userState !== 'active-work'}
                summary={<span className="text-xs text-emerald-600 font-medium">✨ Auto-discovered</span>}
            >
                <div className="space-y-6">
                    {/* Property Intelligence */}
                    <PropertyIntelligence propertyProfile={activeProperty} />

                    {/* Environmental & Risk Data */}
                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Info size={14} className="text-slate-400" />
                            Local Insights
                        </h4>
                        <EnvironmentalInsights propertyProfile={activeProperty} />
                    </div>
                </div>
            </DashboardSection>

            {/* UNIFIED HOME CALENDAR - Shows all scheduled events */}
            <DashboardSection
                title="Home Calendar"
                icon={Calendar}
                defaultOpen={true}
                summary={
                    maintenanceTasks.some(t => t.daysUntil < 0)
                        ? <span className="text-xs font-bold text-red-600">Action needed</span>
                        : <span className="text-xs font-bold text-emerald-600">Up to date</span>
                }
            >
                <UnifiedCalendar
                    userId={userId}
                    maintenanceTasks={maintenanceTasks}
                    showLegend={true}
                    compact={false}
                />
            </DashboardSection>

            {/* MY CONTRACTORS - Single consolidated instance */}
            <MyContractorsSection
                contractors={contractors}
                userId={userId}
                onNavigateToContractors={onNavigateToContractors}
                onCreateContractorLink={onCreateContractorLink}
            />

            {/* HISTORY & ARCHIVE */}
            <DashboardSection
                title="History & Archive"
                icon={Archive}
                defaultOpen={false}
                summary={<span className="text-xs text-slate-500">Past jobs & quotes</span>}
            >
                <HomeArchive
                    userId={userId}
                    userProfile={userProfile}
                    propertyAddress={activeProperty?.address?.formatted || activeProperty?.address}
                    variant="section"
                />
            </DashboardSection>

            {/* QUICK ACTIONS - Moved to bottom */}
            <DashboardSection
                title="Quick Actions"
                icon={Sparkles}
                defaultOpen={false}
            >
                <div className="grid grid-cols-2 gap-3">
                    <ActionButton icon={Camera} label="Scan Receipt" sublabel="AI-powered" onClick={onScanReceipt} variant="primary" />
                    <ActionButton icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <ActionButton icon={FileText} label="View Report" sublabel="Home pedigree" onClick={onNavigateToReports} />
                    <ActionButton icon={Hammer} label="Service Link" sublabel="For contractors" onClick={onCreateContractorLink} />
                </div>
            </DashboardSection>
        </div>
    );
};

export default ModernDashboard;
