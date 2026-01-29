// src/features/contractor-pro/hooks/useContractorData.js
// ============================================
// CONTRACTOR DATA HOOKS
// ============================================
// Hooks for managing invitations, customers, and stats

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import {
    getContractorInvitations,
    subscribeToInvitations,
    getContractorCustomers,
    subscribeToCustomers,
    getContractorStats,
    linkInvitationToContractor,
    subscribeToContractorJobs, // NEW IMPORT
    subscribeToContractorInvoices // NEW IMPORT
} from '../lib/contractorService';
import { mergeCalendarEvents } from '../lib/calendarEventsTransformer';
import { useStableArray } from '../../../hooks/useStableArray';

// ============================================
// INVITATIONS HOOK
// ============================================
export const useInvitations = (contractorId, options = {}) => {
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const { realtime = true, limit = 50 } = options;
    
    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }
        
        if (realtime) {
            // Subscribe to real-time updates
            const unsubscribe = subscribeToInvitations(
                contractorId,
                (data) => {
                    setInvitations(data);
                    setLoading(false);
                },
                { limitCount: limit }
            );
            
            return () => unsubscribe();
        } else {
            // One-time fetch
            const fetch = async () => {
                try {
                    const data = await getContractorInvitations(contractorId, { limitCount: limit });
                    setInvitations(data);
                } catch (err) {
                    console.error('Error fetching invitations:', err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            
            fetch();
        }
    }, [contractorId, realtime, limit]);
    
    // Derived stats
    const stats = {
        total: invitations.length,
        pending: invitations.filter(i => i.status === 'pending').length,
        claimed: invitations.filter(i => i.status === 'claimed').length,
        expired: invitations.filter(i => i.status === 'expired').length
    };
    
    // Filter helpers
    const pendingInvitations = invitations.filter(i => i.status === 'pending');
    const claimedInvitations = invitations.filter(i => i.status === 'claimed');
    const recentActivity = invitations
        .filter(i => i.status === 'claimed')
        .slice(0, 5);
    
    return {
        invitations,
        loading,
        error,
        stats,
        pendingInvitations,
        claimedInvitations,
        recentActivity
    };
};

// ============================================
// CUSTOMERS HOOK
// ============================================
export const useCustomers = (contractorId, options = {}) => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const { realtime = true } = options;
    
    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }
        
        if (realtime) {
            const unsubscribe = subscribeToCustomers(
                contractorId,
                (data) => {
                    setCustomers(data);
                    setLoading(false);
                }
            );
            
            return () => unsubscribe();
        } else {
            const fetch = async () => {
                try {
                    const data = await getContractorCustomers(contractorId);
                    setCustomers(data);
                } catch (err) {
                    console.error('Error fetching customers:', err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            
            fetch();
        }
    }, [contractorId, realtime]);
    
    // Derived stats
    const stats = {
        total: customers.length,
        totalRevenue: customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0),
        avgJobValue: customers.length > 0 
            ? customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0) / 
              customers.reduce((sum, c) => sum + (c.totalJobs || 0), 0)
            : 0,
        repeatCustomers: customers.filter(c => (c.totalJobs || 0) > 1).length
    };
    
    // Sort helpers
    const byLastContact = [...customers].sort((a, b) => {
        const aDate = a.lastContact?.toDate?.() || new Date(0);
        const bDate = b.lastContact?.toDate?.() || new Date(0);
        return bDate - aDate;
    });
    
    const byTotalSpend = [...customers].sort((a, b) => 
        (b.totalSpend || 0) - (a.totalSpend || 0)
    );
    
    return {
        customers,
        loading,
        error,
        stats,
        byLastContact,
        byTotalSpend
    };
};

// ============================================
// DASHBOARD STATS HOOK
// ============================================
export const useDashboardStats = (contractorId) => {
    const [stats, setStats] = useState({
        totalCustomers: 0,
        totalInvitations: 0,
        claimRate: 0,
        pendingInvitations: 0
    });
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }
        
        const fetch = async () => {
            try {
                const data = await getContractorStats(contractorId);
                setStats(data);
            } catch (err) {
                console.error('Error fetching stats:', err);
            } finally {
                setLoading(false);
            }
        };
        
        fetch();
    }, [contractorId]);
    
    return { stats, loading };
};

// ============================================
// CREATE INVITATION HOOK
// ============================================
export const useCreateInvitation = (contractorId) => {
    const [isCreating, setIsCreating] = useState(false);
    
    const createInvitation = useCallback(async (invitationResult, metadata = {}) => {
        if (!contractorId) {
            throw new Error('Contractor not authenticated');
        }
        
        setIsCreating(true);
        
        try {
            // Link to contractor account
            await linkInvitationToContractor(contractorId, {
                inviteId: invitationResult.inviteId,
                claimToken: invitationResult.claimToken,
                link: invitationResult.link,
                recordCount: metadata.recordCount || 0,
                recordSummary: metadata.recordSummary || [],
                totalValue: metadata.totalValue || 0,
                recipientEmail: metadata.recipientEmail || null
            });
            
            return { success: true, ...invitationResult };
        } catch (error) {
            console.error('Error creating invitation:', error);
            throw error;
        } finally {
            setIsCreating(false);
        }
    }, [contractorId]);
    
    return { createInvitation, isCreating };
};

// ============================================
// JOBS HOOK
// ============================================
export const useContractorJobs = (contractorId, options = {}) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    // Track seen proposals to detect new ones
    const [seenProposalIds, setSeenProposalIds] = useState(new Set());
    const { onNewProposal } = options;

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToContractorJobs(contractorId, (data) => {
            // Check for new homeowner proposals
            if (onNewProposal && jobs.length > 0) {
                data.forEach(job => {
                    if (job.proposedTimes?.length > 0) {
                        job.proposedTimes.forEach((proposal, idx) => {
                            // Only notify for homeowner proposals
                            if (proposal.proposedBy === 'homeowner') {
                                const proposalId = `${job.id}-${proposal.createdAt || idx}`;
                                if (!seenProposalIds.has(proposalId)) {
                                    onNewProposal(job, proposal);
                                    setSeenProposalIds(prev => new Set([...prev, proposalId]));
                                }
                            }
                        });
                    }
                });
            }

            // Initialize seen proposals on first load (don't notify for existing)
            if (jobs.length === 0 && data.length > 0) {
                const initialSeen = new Set();
                data.forEach(job => {
                    if (job.proposedTimes?.length > 0) {
                        job.proposedTimes.forEach((proposal, idx) => {
                            if (proposal.proposedBy === 'homeowner') {
                                initialSeen.add(`${job.id}-${proposal.createdAt || idx}`);
                            }
                        });
                    }
                });
                setSeenProposalIds(initialSeen);
            }

            setJobs(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId, onNewProposal]);

    // Derived state for convenience
    const activeJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled');
    const completedJobs = jobs.filter(j => j.status === 'completed');

    // Jobs with pending homeowner proposals
    const jobsWithProposals = useMemo(() => {
        return jobs.filter(job =>
            job.proposedTimes?.some(p => p.proposedBy === 'homeowner') &&
            job.status === 'scheduling' &&
            !job.scheduledTime
        );
    }, [jobs]);

    return {
        jobs,
        activeJobs,
        completedJobs,
        jobsWithProposals,
        loading
    };
};

// ============================================
// NEW: INVOICES HOOK
// ============================================
export const useContractorInvoices = (contractorId) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToContractorInvoices(contractorId, (data) => {
            setInvoices(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    return { invoices, loading };
};

// ============================================
// CALENDAR EVENTS HOOK (Jobs + Evaluations)
// ============================================
// UPDATED: Now also handles proposal notifications to eliminate duplicate subscription
export const useCalendarEvents = (contractorId, options = {}) => {
    const [jobs, setJobs] = useState([]);
    const [evaluations, setEvaluations] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingEvals, setLoadingEvals] = useState(true);

    // Track seen proposals to detect new ones (same as useContractorJobs)
    const [seenProposalIds, setSeenProposalIds] = useState(new Set());
    const { onNewProposal } = options;

    // Subscribe to jobs (with proposal detection merged from useContractorJobs)
    useEffect(() => {
        if (!contractorId) {
            setLoadingJobs(false);
            return;
        }

        const unsubscribe = subscribeToContractorJobs(contractorId, (data) => {
            // Check for new homeowner proposals
            if (onNewProposal && jobs.length > 0) {
                data.forEach(job => {
                    if (job.proposedTimes?.length > 0) {
                        job.proposedTimes.forEach((proposal, idx) => {
                            // Only notify for homeowner proposals
                            if (proposal.proposedBy === 'homeowner') {
                                const proposalId = `${job.id}-${proposal.createdAt || idx}`;
                                if (!seenProposalIds.has(proposalId)) {
                                    onNewProposal(job, proposal);
                                    setSeenProposalIds(prev => new Set([...prev, proposalId]));
                                }
                            }
                        });
                    }
                });
            }

            // Initialize seen proposals on first load (don't notify for existing)
            if (jobs.length === 0 && data.length > 0) {
                const initialSeen = new Set();
                data.forEach(job => {
                    if (job.proposedTimes?.length > 0) {
                        job.proposedTimes.forEach((proposal, idx) => {
                            if (proposal.proposedBy === 'homeowner') {
                                initialSeen.add(`${job.id}-${proposal.createdAt || idx}`);
                            }
                        });
                    }
                });
                setSeenProposalIds(initialSeen);
            }

            setJobs(data);
            setLoadingJobs(false);
        });

        return () => unsubscribe();
    }, [contractorId, onNewProposal]);

    // Subscribe to evaluations
    useEffect(() => {
        if (!contractorId) {
            setLoadingEvals(false);
            return;
        }

        const evaluationsRef = collection(
            db,
            'artifacts',
            appId,
            'public',
            'data',
            'contractors',
            contractorId,
            'evaluations'
        );
        const q = query(evaluationsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const evals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setEvaluations(evals);
                setLoadingEvals(false);
            },
            (error) => {
                console.error('Error subscribing to evaluations:', error);
                setLoadingEvals(false);
            }
        );

        return () => unsubscribe();
    }, [contractorId]);

    // Merge jobs and evaluations into unified calendar events
    const calendarEvents = useMemo(() => {
        return mergeCalendarEvents(jobs, evaluations);
    }, [jobs, evaluations]);

    // Filter helpers
    const scheduledEvaluations = useMemo(() => {
        return evaluations.filter(e =>
            e.scheduling?.scheduledFor &&
            e.status !== 'cancelled' &&
            e.status !== 'expired'
        );
    }, [evaluations]);

    const activeJobs = useMemo(() => {
        return jobs.filter(j =>
            j.status !== 'completed' &&
            j.status !== 'cancelled'
        );
    }, [jobs]);

    // Jobs with pending homeowner proposals (merged from useContractorJobs)
    const jobsWithProposals = useMemo(() => {
        return jobs.filter(job =>
            job.proposedTimes?.some(p => p.proposedBy === 'homeowner') &&
            job.status === 'scheduling' &&
            !job.scheduledTime
        );
    }, [jobs]);

    // Completed jobs helper
    const completedJobs = useMemo(() => {
        return jobs.filter(j => j.status === 'completed');
    }, [jobs]);

    // PERFORMANCE: Stabilize jobs array to prevent unnecessary re-renders
    // when Firestore returns new references with identical data
    const stableJobs = useStableArray(jobs, ['id', 'status', 'scheduledTime', 'assignedTechId', 'estimatedDuration']);

    return {
        // Unified events for calendar display
        calendarEvents,
        // Raw data (stabilized to prevent unnecessary re-renders)
        jobs: stableJobs,
        evaluations,
        // Filtered subsets
        activeJobs,
        completedJobs,
        jobsWithProposals, // NEW: for proposal notifications
        scheduledEvaluations,
        // Loading state
        loading: loadingJobs || loadingEvals,
        loadingJobs,
        loadingEvals
    };
};

export default {
    useInvitations,
    useCustomers,
    useDashboardStats,
    useCreateInvitation,
    useContractorJobs,
    useContractorInvoices,
    useCalendarEvents // NEW EXPORT
};
