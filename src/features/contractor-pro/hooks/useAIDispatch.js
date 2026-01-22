// src/features/contractor-pro/hooks/useAIDispatch.js
// ============================================
// AI DISPATCH ASSISTANT HOOK
// ============================================
// React hook for AI-powered schedule proposals

import { useState, useCallback } from 'react';
import {
    generateScheduleProposal,
    applyScheduleProposal,
    handleDisruption
} from '../lib/aiDispatchService';

/**
 * Hook for the AI Dispatch Assistant
 */
export const useAIDispatch = (contractorId) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentProposal, setCurrentProposal] = useState(null);

    // Generate a schedule proposal for a date
    const generateProposal = useCallback(async (date, options = {}) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        setLoading(true);
        setError(null);
        setCurrentProposal(null);

        try {
            const result = await generateScheduleProposal(contractorId, date, options);
            setCurrentProposal(result);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    // Apply the current proposal
    const applyProposal = useCallback(async (date, proposal = null) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        const proposalToApply = proposal || currentProposal?.proposal;

        if (!proposalToApply) {
            throw new Error('No proposal to apply');
        }

        setLoading(true);
        setError(null);

        try {
            const result = await applyScheduleProposal(contractorId, date, proposalToApply);
            setCurrentProposal(null); // Clear after applying
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [contractorId, currentProposal]);

    // Handle a disruption (tech unavailable, job running late, etc.)
    const handleScheduleDisruption = useCallback(async (disruption) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        setLoading(true);
        setError(null);

        try {
            const result = await handleDisruption(contractorId, disruption);
            if (result.proposal) {
                setCurrentProposal(result);
            }
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    // Clear the current proposal
    const clearProposal = useCallback(() => {
        setCurrentProposal(null);
        setError(null);
    }, []);

    // Helper to format proposal for display
    const formatProposalSummary = useCallback(() => {
        if (!currentProposal?.proposal) return null;

        const { assignments, conflicts, validationSummary } = currentProposal.proposal;
        const metrics = currentProposal.metrics;

        return {
            date: currentProposal.date,
            totalAssignments: assignments?.length || 0,
            totalConflicts: conflicts?.length || 0,
            validated: validationSummary?.validated || 0,
            rejected: validationSummary?.rejected || 0,
            averageUtilization: metrics?.averageUtilization || 0,
            reasoning: currentProposal.aiReasoning
        };
    }, [currentProposal]);

    return {
        loading,
        error,
        currentProposal,
        // Actions
        generateProposal,
        applyProposal,
        handleScheduleDisruption,
        clearProposal,
        // Helpers
        formatProposalSummary
    };
};

export default useAIDispatch;
