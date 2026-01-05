// src/features/evaluations/components/EvaluationPage.jsx
// ============================================
// EVALUATION PAGE (PUBLIC HOMEOWNER ACCESS)
// ============================================
// Standalone page for homeowners to submit evaluation responses
// Access via: ?evaluate={evaluationId}&contractor={contractorId}

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import { EvaluationSubmission } from './EvaluationSubmission';
import { Loader2, AlertTriangle, Home } from 'lucide-react';

export const EvaluationPage = () => {
    const [evaluation, setEvaluation] = useState(null);
    const [contractor, setContractor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const evaluationId = urlParams.get('evaluate');
    const contractorId = urlParams.get('contractor');

    useEffect(() => {
        const fetchData = async () => {
            if (!evaluationId || !contractorId) {
                setError('Missing evaluation or contractor ID in URL');
                setLoading(false);
                return;
            }

            try {
                // Fetch evaluation
                const evalRef = doc(
                    db, 
                    'artifacts', appId, 
                    'public', 'data',
                    'contractors', contractorId, 
                    'evaluations', evaluationId
                );
                const evalSnap = await getDoc(evalRef);
                
                if (!evalSnap.exists()) {
                    setError('Evaluation not found');
                    setLoading(false);
                    return;
                }

                const evalData = { id: evalSnap.id, ...evalSnap.data() };
                setEvaluation(evalData);

                // Fetch contractor profile for display
                const contractorRef = doc(db, 'artifacts', appId, 'public', 'data', 'contractors', contractorId);
                const contractorSnap = await getDoc(contractorRef);
                
                if (contractorSnap.exists()) {
                    setContractor({ id: contractorSnap.id, ...contractorSnap.data() });
                }

            } catch (err) {
                console.error('Error fetching evaluation:', err);
                setError('Failed to load evaluation. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [evaluationId, contractorId]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-500">Loading evaluation...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">
                        Unable to Load Evaluation
                    </h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <a 
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Go Home
                    </a>
                </div>
            </div>
        );
    }

    // Render submission form
    return (
        <EvaluationSubmission 
            evaluation={evaluation}
            contractor={contractor}
            contractorId={contractorId}
            evaluationId={evaluationId}
        />
    );
};

export default EvaluationPage;
