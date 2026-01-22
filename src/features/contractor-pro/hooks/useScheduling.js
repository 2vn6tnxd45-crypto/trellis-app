// src/features/contractor-pro/hooks/useScheduling.js
// ============================================
// SCHEDULING ENGINE HOOK
// ============================================
// React hook for constraint-aware scheduling

import { useState, useCallback } from 'react';
import {
    evaluateConstraints,
    findBestTimeSlot,
    optimizeTechSchedule,
    simulateSwap,
    estimateTravelTime,
    CONSTRAINT_TYPES,
    SCHEDULE_RESULT
} from '../lib/schedulingEngine';

/**
 * Hook for the constraint-aware scheduling engine
 */
export const useScheduling = (contractorId) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Evaluate constraints for a job-tech-time combination
    const checkConstraints = useCallback(async (job, tech, timeSlot, existingJobs = []) => {
        setLoading(true);
        setError(null);
        try {
            const result = await evaluateConstraints(job, tech, timeSlot, existingJobs);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Find the best time slot for a job
    const findSlot = useCallback(async (job, date, preferredTechId = null) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        setLoading(true);
        setError(null);
        try {
            const result = await findBestTimeSlot(contractorId, job, date, preferredTechId);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    // Optimize a tech's daily schedule
    const optimizeSchedule = useCallback(async (techId, date) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        setLoading(true);
        setError(null);
        try {
            const result = await optimizeTechSchedule(contractorId, techId, date);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    // Simulate swapping two techs' assignments
    const testSwap = useCallback(async (date, techAId, techBId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        setLoading(true);
        setError(null);
        try {
            const result = await simulateSwap(contractorId, date, techAId, techBId);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    // Quick Win #3: Get travel time between two locations
    const getTravelTime = useCallback(async (from, to) => {
        try {
            const result = await estimateTravelTime(from, to);
            return result;
        } catch (err) {
            console.error('Error getting travel time:', err);
            return { durationMinutes: 30, distanceMiles: 15, estimateType: 'error' };
        }
    }, []);

    return {
        loading,
        error,
        // Actions
        checkConstraints,
        findSlot,
        optimizeSchedule,
        testSwap,
        getTravelTime,
        // Constants
        CONSTRAINT_TYPES,
        SCHEDULE_RESULT
    };
};

export default useScheduling;
