// src/features/evaluations/hooks/useEvaluations.js
// ============================================
// USE EVALUATIONS HOOK
// ============================================
// Real-time subscriptions for evaluation data.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    collection, doc, onSnapshot, query, where, orderBy 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import {
    createEvaluationRequest,
    submitEvaluationMedia,
    completeSubmission,
    requestAdditionalInfo,
    scheduleEvaluation,
    completeEvaluation,
    linkQuoteToEvaluation,
    cancelEvaluation,
    checkExpiredEvaluations,
    getTimeRemaining,
    prepareQuoteFromEvaluation,
    EVALUATION_STATUS
} from '../lib/evaluationService';

// ============================================
// COLLECTION PATH
// ============================================

const getEvaluationsPath = (contractorId) => 
    `artifacts/${appId}/public/data/contractors/${contractorId}/evaluations`;

// ============================================
// MAIN HOOK: useEvaluations
// ============================================

export const useEvaluations = (contractorId) => {
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Real-time subscription
    useEffect(() => {
        if (!contractorId) {
            setEvaluations([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const evaluationsRef = collection(db, getEvaluationsPath(contractorId));
        const q = query(evaluationsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const evals = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Add computed time remaining
                    timeRemaining: getTimeRemaining(doc.data().expiresAt)
                }));
                setEvaluations(evals);
                setLoading(false);
            },
            (err) => {
                console.error('Error subscribing to evaluations:', err);
                setError(err);
                setLoading(false);
            }
        );

        // Check for expired evaluations on mount
        checkExpiredEvaluations(contractorId).catch(console.error);

        return () => unsubscribe();
    }, [contractorId]);

    // ----------------------------------------
    // Filtered lists (memoized)
    // ----------------------------------------
    
    const pendingEvaluations = useMemo(() => 
        evaluations.filter(e => [
            EVALUATION_STATUS.REQUESTED,
            EVALUATION_STATUS.MEDIA_PENDING,
            EVALUATION_STATUS.INFO_REQUESTED,
            EVALUATION_STATUS.SCHEDULED
        ].includes(e.status)),
        [evaluations]
    );

    const completedEvaluations = useMemo(() =>
        evaluations.filter(e => e.status === EVALUATION_STATUS.COMPLETED),
        [evaluations]
    );

    const quotedEvaluations = useMemo(() =>
        evaluations.filter(e => e.status === EVALUATION_STATUS.QUOTED),
        [evaluations]
    );

    const expiredEvaluations = useMemo(() =>
        evaluations.filter(e => e.status === EVALUATION_STATUS.EXPIRED),
        [evaluations]
    );

    const needsAttention = useMemo(() =>
        evaluations.filter(e => 
            e.status === EVALUATION_STATUS.COMPLETED ||
            (e.status === EVALUATION_STATUS.MEDIA_PENDING && e.submissions?.completedAt)
        ),
        [evaluations]
    );

    // ----------------------------------------
    // Actions
    // ----------------------------------------

    const createEvaluation = useCallback(async (data) => {
        if (!contractorId) throw new Error('No contractor ID');
        return createEvaluationRequest(contractorId, data);
    }, [contractorId]);

    const requestMoreInfo = useCallback(async (evaluationId, message, prompts) => {
        if (!contractorId) throw new Error('No contractor ID');
        return requestAdditionalInfo(contractorId, evaluationId, message, prompts);
    }, [contractorId]);

    const schedule = useCallback(async (evaluationId, scheduleData) => {
        if (!contractorId) throw new Error('No contractor ID');
        return scheduleEvaluation(contractorId, evaluationId, scheduleData);
    }, [contractorId]);

    const complete = useCallback(async (evaluationId, findings) => {
        if (!contractorId) throw new Error('No contractor ID');
        return completeEvaluation(contractorId, evaluationId, findings);
    }, [contractorId]);

    const linkQuote = useCallback(async (evaluationId, quoteId) => {
        if (!contractorId) throw new Error('No contractor ID');
        return linkQuoteToEvaluation(contractorId, evaluationId, quoteId);
    }, [contractorId]);

    const cancel = useCallback(async (evaluationId, reason) => {
        if (!contractorId) throw new Error('No contractor ID');
        return cancelEvaluation(contractorId, evaluationId, reason);
    }, [contractorId]);

    const prepareQuote = useCallback((evaluation) => {
        return prepareQuoteFromEvaluation(evaluation);
    }, []);

    const refreshExpired = useCallback(async () => {
        if (!contractorId) return;
        return checkExpiredEvaluations(contractorId);
    }, [contractorId]);

    // ----------------------------------------
    // Stats
    // ----------------------------------------

    const stats = useMemo(() => ({
        total: evaluations.length,
        pending: pendingEvaluations.length,
        completed: completedEvaluations.length,
        quoted: quotedEvaluations.length,
        expired: expiredEvaluations.length,
        needsAttention: needsAttention.length
    }), [evaluations, pendingEvaluations, completedEvaluations, quotedEvaluations, expiredEvaluations, needsAttention]);

    return {
        // Data
        evaluations,
        pendingEvaluations,
        completedEvaluations,
        quotedEvaluations,
        expiredEvaluations,
        needsAttention,
        stats,
        
        // State
        loading,
        error,
        
        // Actions
        createEvaluation,
        requestMoreInfo,
        schedule,
        complete,
        linkQuote,
        cancel,
        prepareQuote,
        refreshExpired
    };
};

// ============================================
// HOOK: useSingleEvaluation
// ============================================
// For viewing a specific evaluation (e.g., homeowner view)

export const useSingleEvaluation = (contractorId, evaluationId) => {
    const [evaluation, setEvaluation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId || !evaluationId) {
            setEvaluation(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const evalRef = doc(db, getEvaluationsPath(contractorId), evaluationId);

        const unsubscribe = onSnapshot(
            evalRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setEvaluation({
                        id: snapshot.id,
                        ...data,
                        timeRemaining: getTimeRemaining(data.expiresAt)
                    });
                } else {
                    setEvaluation(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error subscribing to evaluation:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [contractorId, evaluationId]);

    // ----------------------------------------
    // Homeowner actions
    // ----------------------------------------

    const submitMedia = useCallback(async (submissionData) => {
        if (!contractorId || !evaluationId) throw new Error('Missing IDs');
        return submitEvaluationMedia(contractorId, evaluationId, submissionData);
    }, [contractorId, evaluationId]);

    const markComplete = useCallback(async (customerInfo = null) => {
        if (!contractorId || !evaluationId) throw new Error('Missing IDs');
        return completeSubmission(contractorId, evaluationId, customerInfo);
    }, [contractorId, evaluationId]);

    // ----------------------------------------
    // Computed states
    // ----------------------------------------

    const isExpired = useMemo(() => 
        evaluation?.timeRemaining?.expired || evaluation?.status === EVALUATION_STATUS.EXPIRED,
        [evaluation]
    );

    const canSubmit = useMemo(() =>
        evaluation && !isExpired && [
            EVALUATION_STATUS.REQUESTED,
            EVALUATION_STATUS.MEDIA_PENDING,
            EVALUATION_STATUS.INFO_REQUESTED
        ].includes(evaluation.status),
        [evaluation, isExpired]
    );

    const hasSubmissions = useMemo(() =>
        evaluation?.submissions?.photos?.length > 0 ||
        evaluation?.submissions?.videos?.length > 0 ||
        Object.keys(evaluation?.submissions?.answers || {}).length > 0,
        [evaluation]
    );

    return {
        evaluation,
        loading,
        error,
        
        // Computed
        isExpired,
        canSubmit,
        hasSubmissions,
        
        // Actions
        submitMedia,
        markComplete
    };
};

// ============================================
// HOOK: useEvaluationCountdown
// ============================================
// Live countdown timer for expiration

export const useEvaluationCountdown = (expiresAt) => {
    const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining(expiresAt));

    useEffect(() => {
        if (!expiresAt) return;

        // Update immediately
        setTimeRemaining(getTimeRemaining(expiresAt));

        // Update every minute (or every second if urgent)
        const interval = setInterval(() => {
            const remaining = getTimeRemaining(expiresAt);
            setTimeRemaining(remaining);
            
            // Stop if expired
            if (remaining.expired) {
                clearInterval(interval);
            }
        }, timeRemaining?.urgent ? 1000 : 60000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    return timeRemaining;
};

// ============================================
// HOOK: useEvaluationsByStatus
// ============================================
// Subscribe to evaluations filtered by status

export const useEvaluationsByStatus = (contractorId, status) => {
    const [evaluations, setEvaluations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!contractorId || !status) {
            setEvaluations([]);
            setLoading(false);
            return;
        }

        const evaluationsRef = collection(db, getEvaluationsPath(contractorId));
        const q = query(
            evaluationsRef,
            where('status', '==', status),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvaluations(snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timeRemaining: getTimeRemaining(doc.data().expiresAt)
            })));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId, status]);

    return { evaluations, loading };
};

export default useEvaluations;
