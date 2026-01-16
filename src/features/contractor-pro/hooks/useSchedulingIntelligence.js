// src/features/contractor-pro/hooks/useSchedulingIntelligence.js
// ============================================
// SCHEDULING INTELLIGENCE HOOK
// ============================================
// React hook for AI-powered scheduling features

import { useState, useCallback } from 'react';
import {
    recordJobOutcome,
    calculateLearningScore,
    predictJobDuration,
    getCustomerPreferences,
    generateDailyRecommendations,
    parseSchedulingRequest,
    executeSchedulingAction
} from '../lib/schedulingIntelligence';
import toast from 'react-hot-toast';

/**
 * Hook for scheduling intelligence features
 */
export const useSchedulingIntelligence = (contractorId, teamMembers = []) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);

    /**
     * Record job outcome for learning (call on job completion)
     */
    const recordOutcome = useCallback(async (job, outcome) => {
        if (!contractorId) return;

        try {
            const result = await recordJobOutcome(job, {
                ...outcome,
                contractorId
            });
            return result;
        } catch (error) {
            console.error('Failed to record outcome:', error);
        }
    }, [contractorId]);

    /**
     * Get enhanced score with learning for a tech-job pair
     */
    const getEnhancedScore = useCallback(async (tech, job) => {
        if (!contractorId) return { learningBonus: 0, insights: [] };

        try {
            return await calculateLearningScore(tech, job, contractorId);
        } catch (error) {
            console.error('Failed to get enhanced score:', error);
            return { learningBonus: 0, insights: [] };
        }
    }, [contractorId]);

    /**
     * Predict job duration based on tech's history
     */
    const predictDuration = useCallback(async (job, techId) => {
        if (!contractorId) return null;

        try {
            return await predictJobDuration(job, techId, contractorId);
        } catch (error) {
            console.error('Failed to predict duration:', error);
            return null;
        }
    }, [contractorId]);

    /**
     * Get customer preferences for a job
     */
    const getPreferences = useCallback(async (customerId) => {
        if (!contractorId || !customerId) return null;

        try {
            return await getCustomerPreferences(customerId, contractorId);
        } catch (error) {
            console.error('Failed to get preferences:', error);
            return null;
        }
    }, [contractorId]);

    /**
     * Load recommendations for current jobs
     */
    const loadRecommendations = useCallback(async (jobs, date) => {
        if (!contractorId || !teamMembers.length) return;

        setLoading(true);
        try {
            const recs = await generateDailyRecommendations(
                contractorId,
                date,
                jobs,
                teamMembers
            );
            setRecommendations(recs);
            return recs;
        } catch (error) {
            console.error('Failed to load recommendations:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [contractorId, teamMembers]);

    /**
     * Process natural language scheduling request
     */
    const processNaturalLanguage = useCallback(async (request, jobs, currentDate) => {
        if (!contractorId) return null;

        setIsProcessing(true);
        try {
            const context = {
                teamMembers,
                jobs,
                contractorId,
                currentDate: currentDate?.toISOString?.().split('T')[0] || new Date().toISOString().split('T')[0]
            };

            const parseResult = await parseSchedulingRequest(request, context);

            if (!parseResult.success) {
                toast.error(parseResult.error || 'Could not understand request');
                return null;
            }

            const execution = await executeSchedulingAction(parseResult.parsed, context);
            return execution;
        } catch (error) {
            console.error('NLP processing failed:', error);
            toast.error('Failed to process request');
            return null;
        } finally {
            setIsProcessing(false);
        }
    }, [contractorId, teamMembers]);

    return {
        // State
        isProcessing,
        loading,
        recommendations,

        // Actions
        recordOutcome,
        getEnhancedScore,
        predictDuration,
        getPreferences,
        loadRecommendations,
        processNaturalLanguage
    };
};

export default useSchedulingIntelligence;
