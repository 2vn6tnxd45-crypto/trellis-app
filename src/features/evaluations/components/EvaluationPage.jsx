// src/features/evaluations/components/EvaluationPage.jsx
// ============================================
// EVALUATION PAGE (PUBLIC HOMEOWNER ACCESS)
// ============================================
// Standalone page for homeowners to submit evaluation responses
// Access via: ?evaluate={evaluationId}&contractor={contractorId}

import React, { useState, useEffect, Component } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import { EvaluationSubmission } from './EvaluationSubmission';
import { Loader2, AlertTriangle, Home, RefreshCw } from 'lucide-react';

// ============================================
// ERROR BOUNDARY
// ============================================
class EvaluationErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[EvaluationPage] Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="h-8 w-8 text-amber-600" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-800 mb-2">
                            Something Went Wrong
                        </h1>
                        <p className="text-slate-500 mb-6">
                            There was an issue loading this evaluation. This might happen if the evaluation has already been submitted.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-xl font-medium hover:bg-slate-300 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Retry
                            </button>
                            <a
                                href="/app"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Go to Dashboard
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// ============================================
// MAIN COMPONENT
// ============================================
const EvaluationPageContent = () => {
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
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-xl font-medium hover:bg-slate-300 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                        <a
                            href="/"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Go Home
                        </a>
                    </div>
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

// Wrap with error boundary
export const EvaluationPage = () => (
    <EvaluationErrorBoundary>
        <EvaluationPageContent />
    </EvaluationErrorBoundary>
);

export default EvaluationPage;

