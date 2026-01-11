// src/features/evaluations/components/EvaluationsListView.jsx
// ============================================
// EVALUATIONS LIST VIEW
// ============================================
// Contractor view showing all evaluation requests

import React, { useState } from 'react';
import {
    Plus, Clock, CheckCircle, Camera, Home, AlertTriangle,
    ChevronRight, Loader2, Search, Filter, MessageSquare,
    FileText, Calendar, User, X, Link2, Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EVALUATION_STATUS, EVALUATION_TYPES, getTimeRemaining } from '../lib/evaluationService';
import { CATEGORY_LABELS } from '../lib/evaluationTemplates';
import { AIAnalysisSummary } from './AIAnalysisSummary';

// ============================================
// MAIN COMPONENT
// ============================================

export const EvaluationsListView = ({
    evaluations = [],
    pendingEvaluations = [],
    completedEvaluations = [],
    loading = false,
    contractorId,
    onCreateEvaluation,
    onSelectEvaluation
}) => {
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Filter evaluations
    // Filter evaluations
    const filteredEvaluations = evaluations.filter(evaluation => {
        // Always exclude cancelled evaluations from the main view
        if (evaluation.status === EVALUATION_STATUS.CANCELLED) {
            return false;
        }
        
        // Status filter
        if (filter === 'pending' && ![
            EVALUATION_STATUS.REQUESTED,
            EVALUATION_STATUS.MEDIA_PENDING,
            EVALUATION_STATUS.INFO_REQUESTED,
            EVALUATION_STATUS.SCHEDULED
        ].includes(evaluation.status)) {
            return false;
        }
        if (filter === 'completed' && evaluation.status !== EVALUATION_STATUS.COMPLETED) {
            return false;
        }
        if (filter === 'quoted' && evaluation.status !== EVALUATION_STATUS.QUOTED) {
            return false;
        }
        // Exclude expired from "all" view by default (they have their own section)
        if (filter === 'all' && evaluation.status === EVALUATION_STATUS.EXPIRED) {
            return false;
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                evaluation.customerName?.toLowerCase().includes(query) ||
                evaluation.propertyAddress?.toLowerCase().includes(query) ||
                evaluation.jobDescription?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // Group by status for display
    const needsAttention = filteredEvaluations.filter(e => 
        e.status === EVALUATION_STATUS.COMPLETED ||
        (e.status === EVALUATION_STATUS.MEDIA_PENDING && e.submissions?.completedAt)
    );

    const awaitingResponse = filteredEvaluations.filter(e =>
        [EVALUATION_STATUS.REQUESTED, EVALUATION_STATUS.INFO_REQUESTED].includes(e.status)
    );

    const quoted = filteredEvaluations.filter(e => e.status === EVALUATION_STATUS.QUOTED);
    const expired = filteredEvaluations.filter(e => e.status === EVALUATION_STATUS.EXPIRED);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Evaluations</h1>
                    <p className="text-slate-500">
                        Pre-quote assessments for complex jobs
                    </p>
                </div>
                <button
                    onClick={onCreateEvaluation}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} />
                    Request Evaluation
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Needs Review"
                    value={needsAttention.length}
                    icon={CheckCircle}
                    color="emerald"
                    onClick={() => setFilter('completed')}
                    active={filter === 'completed'}
                />
                <StatCard
                    label="Awaiting Response"
                    value={awaitingResponse.length}
                    icon={Clock}
                    color="amber"
                    onClick={() => setFilter('pending')}
                    active={filter === 'pending'}
                />
                <StatCard
                    label="Quoted"
                    value={quoted.length}
                    icon={FileText}
                    color="indigo"
                    onClick={() => setFilter('quoted')}
                    active={filter === 'quoted'}
                />
                <StatCard
                    label="All"
                    value={evaluations.filter(e => 
                        e.status !== EVALUATION_STATUS.CANCELLED && 
                        e.status !== EVALUATION_STATUS.EXPIRED
                    ).length}
                    icon={Camera}
                    color="slate"
                    onClick={() => setFilter('all')}
                    active={filter === 'all'}
                />
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer, address, or description..."
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Needs Attention Section */}
            {needsAttention.length > 0 && filter !== 'quoted' && (
                <section>
                    <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <CheckCircle size={16} />
                        Ready for Review ({needsAttention.length})
                    </h2>
                    <div className="space-y-3">
                        {needsAttention.map(evaluation => (
                            <EvaluationCard
                                key={evaluation.id}
                                evaluation={evaluation}
                                contractorId={contractorId}
                                onClick={() => onSelectEvaluation(evaluation)}
                                highlight
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Awaiting Response Section */}
            {awaitingResponse.length > 0 && filter !== 'completed' && filter !== 'quoted' && (
                <section>
                    <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Clock size={16} />
                        Awaiting Customer Response ({awaitingResponse.length})
                    </h2>
                    <div className="space-y-3">
                        {awaitingResponse.map(evaluation => (
                            <EvaluationCard
                                key={evaluation.id}
                                evaluation={evaluation}
                                contractorId={contractorId}
                                onClick={() => onSelectEvaluation(evaluation)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Quoted Section */}
            {quoted.length > 0 && (filter === 'all' || filter === 'quoted') && (
                <section>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <FileText size={16} />
                        Converted to Quotes ({quoted.length})
                    </h2>
                    <div className="space-y-3">
                        {quoted.map(evaluation => (
                            <EvaluationCard
                                key={evaluation.id}
                                evaluation={evaluation}
                                contractorId={contractorId}
                                onClick={() => onSelectEvaluation(evaluation)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Expired Section */}
            {expired.length > 0 && filter === 'all' && (
                <section>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Expired ({expired.length})
                    </h2>
                    <div className="space-y-3">
                        {expired.map(evaluation => (
                            <EvaluationCard
                                key={evaluation.id}
                                evaluation={evaluation}
                                contractorId={contractorId}
                                onClick={() => onSelectEvaluation(evaluation)}
                                faded
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Empty State */}
            {filteredEvaluations.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Camera className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-800 text-lg mb-2">
                        {searchQuery ? 'No Matches Found' : 'No Evaluations Yet'}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        {searchQuery 
                            ? 'Try adjusting your search terms'
                            : 'Request an evaluation to get photos and info before quoting complex jobs.'
                        }
                    </p>
                    {!searchQuery && (
                        <button
                            onClick={onCreateEvaluation}
                            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-2"
                        >
                            <Plus size={18} />
                            Request Your First Evaluation
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// STAT CARD
// ============================================

const StatCard = ({ label, value, icon: Icon, color, onClick, active }) => (
    <button
        onClick={onClick}
        className={`p-4 rounded-xl border-2 text-left transition-all ${
            active
                ? `border-${color}-500 bg-${color}-50`
                : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
    >
        <div className="flex items-center justify-between mb-2">
            <Icon className={`w-5 h-5 text-${color}-500`} />
            <span className={`text-2xl font-bold text-${color}-600`}>{value}</span>
        </div>
        <p className="text-sm text-slate-600">{label}</p>
    </button>
);

// ============================================
// EVALUATION CARD
// ============================================

const EvaluationCard = ({ evaluation, onClick, highlight = false, faded = false, contractorId }) => {
    const timeRemaining = getTimeRemaining(evaluation.expiresAt);
    
    const getStatusBadge = () => {
        switch (evaluation.status) {
            case EVALUATION_STATUS.REQUESTED:
                return { color: 'bg-amber-100 text-amber-700', label: 'Requested' };
            case EVALUATION_STATUS.MEDIA_PENDING:
                return { color: 'bg-blue-100 text-blue-700', label: 'Uploading' };
            case EVALUATION_STATUS.INFO_REQUESTED:
                return { color: 'bg-purple-100 text-purple-700', label: 'More Info Requested' };
            case EVALUATION_STATUS.SCHEDULED:
                return { color: 'bg-indigo-100 text-indigo-700', label: 'Scheduled' };
            case EVALUATION_STATUS.COMPLETED:
                return { color: 'bg-emerald-100 text-emerald-700', label: 'Ready to Quote' };
            case EVALUATION_STATUS.QUOTED:
                return { color: 'bg-slate-100 text-slate-600', label: 'Quoted' };
            case EVALUATION_STATUS.EXPIRED:
                return { color: 'bg-red-100 text-red-700', label: 'Expired' };
            case EVALUATION_STATUS.CANCELLED:
                return { color: 'bg-slate-100 text-slate-500', label: 'Cancelled' };
            default:
                return { color: 'bg-slate-100 text-slate-600', label: evaluation.status };
        }
    };

    const handleCopyLink = (e) => {
        e.stopPropagation();
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/app?evaluate=${evaluation.id}&contractor=${contractorId}`;
        navigator.clipboard.writeText(link).then(() => {
            toast.success('Link copied to clipboard!');
        }).catch(() => {
            toast.error('Failed to copy link');
        });
    };

    const status = getStatusBadge();
    const photoCount = evaluation.submissions?.photos?.length || 0;
    const canCopyLink = contractorId && evaluation.status !== EVALUATION_STATUS.EXPIRED && evaluation.status !== EVALUATION_STATUS.CANCELLED;

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                highlight 
                    ? 'border-emerald-300 shadow-md hover:shadow-lg' 
                    : faded
                    ? 'border-slate-200 opacity-60 hover:opacity-80'
                    : 'border-slate-200 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* Status + Type */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                            {status.label}
                        </span>
                        <span className="text-xs text-slate-400">
                            {evaluation.type === EVALUATION_TYPES.VIRTUAL ? 'Virtual' : 'Site Visit'}
                        </span>
                        {photoCount > 0 && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Camera size={12} />
                                {photoCount}
                            </span>
                        )}
                    </div>

                    {/* Customer + Category */}
                    <p className="font-bold text-slate-800 truncate">
                        {evaluation.customerName || 'Customer'}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                        {CATEGORY_LABELS[evaluation.jobCategory] || evaluation.jobCategory}
                    </p>

                    {/* Address */}
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 truncate">
                        <Home size={12} className="flex-shrink-0" />
                        {evaluation.propertyAddress || 'No address'}
                    </p>

                    {/* Expiration */}
                    {timeRemaining && !timeRemaining.expired && evaluation.status !== EVALUATION_STATUS.COMPLETED && evaluation.status !== EVALUATION_STATUS.QUOTED && (
                        <p className={`text-xs mt-2 flex items-center gap-1 ${
                            timeRemaining.urgent ? 'text-red-600' : 'text-slate-400'
                        }`}>
                            <Clock size={12} />
                            {timeRemaining.display}
                        </p>
                    )}

                    {/* AI Analysis Summary (compact) */}
                    {evaluation.aiAnalysis && (
                        <div className="mt-3">
                            <AIAnalysisSummary
                                analysis={evaluation.aiAnalysis}
                                variant="compact"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Copy Link Button */}
                    {canCopyLink && (
                        <button
                            onClick={handleCopyLink}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Copy customer link"
                        >
                            <Link2 size={18} />
                        </button>
                    )}
                    <ChevronRight className="text-slate-300" size={20} />
                </div>
            </div>
        </div>
    );
};

export default EvaluationsListView;
