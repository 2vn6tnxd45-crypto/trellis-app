/**
 * useMemberships Hook
 * React hook for managing membership data and operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getMemberships,
  getMembership,
  createMembership,
  cancelMembership,
  renewMembership,
  updateMembership,
  getMembershipForCustomer,
  getMembershipStats,
  getExpiringMemberships,
  applyMembershipDiscount,
  recordServiceUsage
} from '../lib/membershipService';

/**
 * Hook for managing membership plans
 */
export const useMembershipPlans = (contractorId) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPlans = useCallback(async () => {
    if (!contractorId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getPlans(contractorId, true);
      setPlans(data);
    } catch (err) {
      console.error('Error loading plans:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const create = useCallback(async (planData) => {
    try {
      const newPlan = await createPlan(contractorId, planData);
      setPlans(prev => [newPlan, ...prev]);
      return newPlan;
    } catch (err) {
      console.error('Error creating plan:', err);
      throw err;
    }
  }, [contractorId]);

  const update = useCallback(async (planId, updates) => {
    try {
      await updatePlan(contractorId, planId, updates);
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...updates } : p));
    } catch (err) {
      console.error('Error updating plan:', err);
      throw err;
    }
  }, [contractorId]);

  const remove = useCallback(async (planId) => {
    try {
      await deletePlan(contractorId, planId);
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, active: false } : p));
    } catch (err) {
      console.error('Error deleting plan:', err);
      throw err;
    }
  }, [contractorId]);

  const activePlans = useMemo(() => plans.filter(p => p.active), [plans]);

  return {
    plans,
    activePlans,
    loading,
    error,
    refresh: loadPlans,
    create,
    update,
    remove
  };
};

/**
 * Hook for managing customer memberships
 */
export const useMemberships = (contractorId, filters = {}) => {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMemberships = useCallback(async () => {
    if (!contractorId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getMemberships(contractorId, filters);
      setMemberships(data);
    } catch (err) {
      console.error('Error loading memberships:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractorId, JSON.stringify(filters)]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  const create = useCallback(async (membershipData) => {
    try {
      const newMembership = await createMembership(contractorId, membershipData);
      setMemberships(prev => [newMembership, ...prev]);
      return newMembership;
    } catch (err) {
      console.error('Error creating membership:', err);
      throw err;
    }
  }, [contractorId]);

  const cancel = useCallback(async (membershipId, reason) => {
    try {
      await cancelMembership(contractorId, membershipId, reason);
      setMemberships(prev => prev.map(m =>
        m.id === membershipId ? { ...m, status: 'cancelled' } : m
      ));
    } catch (err) {
      console.error('Error cancelling membership:', err);
      throw err;
    }
  }, [contractorId]);

  const renew = useCallback(async (membershipId) => {
    try {
      const result = await renewMembership(contractorId, membershipId);
      setMemberships(prev => prev.map(m =>
        m.id === membershipId ? { ...m, status: 'active', endDate: result.endDate } : m
      ));
      return result;
    } catch (err) {
      console.error('Error renewing membership:', err);
      throw err;
    }
  }, [contractorId]);

  const update = useCallback(async (membershipId, updates) => {
    try {
      await updateMembership(contractorId, membershipId, updates);
      setMemberships(prev => prev.map(m =>
        m.id === membershipId ? { ...m, ...updates } : m
      ));
    } catch (err) {
      console.error('Error updating membership:', err);
      throw err;
    }
  }, [contractorId]);

  // Computed stats
  const stats = useMemo(() => {
    const active = memberships.filter(m => m.status === 'active');
    const expired = memberships.filter(m => m.status === 'expired');
    const cancelled = memberships.filter(m => m.status === 'cancelled');

    const now = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const expiringSoon = active.filter(m => {
      const endDate = m.endDate?.toDate ? m.endDate.toDate() : new Date(m.endDate);
      return endDate <= thirtyDays && endDate >= now;
    });

    return {
      total: memberships.length,
      active: active.length,
      expired: expired.length,
      cancelled: cancelled.length,
      expiringSoon: expiringSoon.length
    };
  }, [memberships]);

  return {
    memberships,
    stats,
    loading,
    error,
    refresh: loadMemberships,
    create,
    cancel,
    renew,
    update
  };
};

/**
 * Hook for a single customer's membership
 */
export const useCustomerMembership = (contractorId, customerId) => {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMembership = useCallback(async () => {
    if (!contractorId || !customerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getMembershipForCustomer(contractorId, customerId);
      setMembership(data);
    } catch (err) {
      console.error('Error loading customer membership:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractorId, customerId]);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  const applyDiscount = useCallback(async (jobId, originalTotal) => {
    if (!membership) throw new Error('No active membership');

    try {
      const result = await applyMembershipDiscount(
        contractorId,
        membership.id,
        jobId,
        originalTotal
      );
      setMembership(prev => ({
        ...prev,
        totalSavings: result.totalSavings,
        discountsApplied: [...(prev?.discountsApplied || []), {
          jobId,
          amount: result.discountAmount,
          date: new Date()
        }]
      }));
      return result;
    } catch (err) {
      console.error('Error applying discount:', err);
      throw err;
    }
  }, [contractorId, membership]);

  const useService = useCallback(async (serviceType, jobId) => {
    if (!membership) throw new Error('No active membership');

    try {
      const result = await recordServiceUsage(
        contractorId,
        membership.id,
        serviceType,
        jobId
      );

      if (result.success) {
        setMembership(prev => ({
          ...prev,
          servicesUsed: (prev?.servicesUsed || []).map(s =>
            s.serviceType === serviceType
              ? { ...s, usedCount: result.usedCount, jobIds: [...(s.jobIds || []), jobId] }
              : s
          )
        }));
      }

      return result;
    } catch (err) {
      console.error('Error recording service usage:', err);
      throw err;
    }
  }, [contractorId, membership]);

  return {
    membership,
    hasMembership: !!membership,
    loading,
    error,
    refresh: loadMembership,
    applyDiscount,
    useService
  };
};

/**
 * Hook for membership statistics
 */
export const useMembershipStats = (contractorId) => {
  const [stats, setStats] = useState(null);
  const [expiringMemberships, setExpiringMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    if (!contractorId) return;

    try {
      setLoading(true);
      setError(null);

      const [statsData, expiringData] = await Promise.all([
        getMembershipStats(contractorId),
        getExpiringMemberships(contractorId, 30)
      ]);

      setStats(statsData);
      setExpiringMemberships(expiringData);
    } catch (err) {
      console.error('Error loading membership stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    expiringMemberships,
    loading,
    error,
    refresh: loadStats
  };
};

/**
 * Hook for managing a single membership
 */
export const useMembershipDetails = (contractorId, membershipId) => {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMembership = useCallback(async () => {
    if (!contractorId || !membershipId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getMembership(contractorId, membershipId);
      setMembership(data);
    } catch (err) {
      console.error('Error loading membership:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [contractorId, membershipId]);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  const update = useCallback(async (updates) => {
    try {
      await updateMembership(contractorId, membershipId, updates);
      setMembership(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Error updating membership:', err);
      throw err;
    }
  }, [contractorId, membershipId]);

  const cancel = useCallback(async (reason) => {
    try {
      await cancelMembership(contractorId, membershipId, reason);
      setMembership(prev => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      console.error('Error cancelling membership:', err);
      throw err;
    }
  }, [contractorId, membershipId]);

  const renew = useCallback(async () => {
    try {
      const result = await renewMembership(contractorId, membershipId);
      setMembership(prev => ({
        ...prev,
        status: 'active',
        endDate: result.endDate,
        renewedAt: new Date()
      }));
      return result;
    } catch (err) {
      console.error('Error renewing membership:', err);
      throw err;
    }
  }, [contractorId, membershipId]);

  return {
    membership,
    loading,
    error,
    refresh: loadMembership,
    update,
    cancel,
    renew
  };
};

export default useMemberships;
