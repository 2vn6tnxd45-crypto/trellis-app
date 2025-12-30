// src/features/contractor-pro/hooks/useContractorData.js
// ============================================
// CONTRACTOR DATA HOOKS
// ============================================
// Hooks for managing invitations, customers, and stats

import { useState, useEffect, useCallback } from 'react';
import { 
    getContractorInvitations,
    subscribeToInvitations,
    getContractorCustomers,
    subscribeToCustomers,
    getContractorStats,
    linkInvitationToContractor
} from '../lib/contractorService';

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

export default {
    useInvitations,
    useCustomers,
    useDashboardStats,
    useCreateInvitation
};
