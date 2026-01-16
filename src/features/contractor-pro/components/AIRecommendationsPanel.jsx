// src/features/contractor-pro/components/AIRecommendationsPanel.jsx
// ============================================
// AI RECOMMENDATIONS PANEL
// ============================================
// Shows AI-powered scheduling suggestions

import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles, Brain, ChevronDown, ChevronUp, User,
    Star, Clock, TrendingUp, Award, AlertCircle,
    Check, X, Loader2, Zap, ThumbsUp, Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    generateDailyRecommendations,
    getSchedulingInsights,
    parseSchedulingRequest,
    executeSchedulingAction
} from '../lib/schedulingIntelligence';

// ============================================
// RECOMMENDATION CARD
// ============================================

const RecommendationCard = ({ recommendation, teamMembers, onAssign }) => {
    const [expanded, setExpanded] = useState(false);
    const [assigning, setAssigning] = useState(false);

    const primarySuggestion = recommendation.suggestions[0];
    const tech = teamMembers.find(t => t.id === primarySuggestion?.techId);

    const handleAssign = async (suggestion) => {
        setAssigning(true);
        try {
            await onAssign(recommendation.jobId, suggestion.techId, suggestion.techName);
            toast.success(`Assigned ${suggestion.techName} to job`);
        } catch (error) {
            toast.error('Failed to assign');
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-3 flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="text-white" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                        {recommendation.jobTitle}
                    </p>
                    <p className="text-sm text-slate-500">
                        {recommendation.customer} - {recommendation.category}
                    </p>
                </div>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-1 hover:bg-slate-100 rounded"
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {/* Primary Suggestion */}
            {primarySuggestion && (
                <div className="px-3 pb-3">
                    <div className="bg-emerald-50 rounded-lg p-2 flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: tech?.color || '#10B981' }}
                        >
                            {primarySuggestion.techName?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-emerald-800 text-sm">
                                {primarySuggestion.techName}
                            </p>
                            <p className="text-xs text-emerald-600 truncate">
                                {primarySuggestion.reason}
                            </p>
                        </div>
                        <button
                            onClick={() => handleAssign(primarySuggestion)}
                            disabled={assigning}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {assigning ? <Loader2 size={14} className="animate-spin" /> : 'Assign'}
                        </button>
                    </div>
                </div>
            )}

            {/* Expanded: Alternative suggestions */}
            {expanded && recommendation.suggestions.length > 1 && (
                <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-slate-500 font-medium">Alternatives:</p>
                    {recommendation.suggestions.slice(1).map((suggestion, idx) => (
                        <div
                            key={idx}
                            className="bg-slate-50 rounded-lg p-2 flex items-center gap-2"
                        >
                            <User size={14} className="text-slate-400" />
                            <span className="text-sm text-slate-700 flex-1">
                                {suggestion.techName}
                            </span>
                            <span className="text-xs text-slate-400">
                                {suggestion.reason}
                            </span>
                            <button
                                onClick={() => handleAssign(suggestion)}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Assign
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// NATURAL LANGUAGE INPUT
// ============================================

const NaturalLanguageInput = ({
    context,
    onExecute,
    isProcessing
}) => {
    const [input, setInput] = useState('');
    const [lastResult, setLastResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const result = await parseSchedulingRequest(input, context);

        if (result.success) {
            const execution = await executeSchedulingAction(result.parsed, context);
            setLastResult(execution);

            if (execution.success && execution.confirmation) {
                // Show confirmation UI
            } else if (!execution.success) {
                toast.error(execution.error || 'Could not process request');
            }
        } else {
            toast.error(result.error || 'Could not understand request');
        }
    };

    const handleConfirm = async () => {
        if (lastResult?.action === 'assign') {
            await onExecute(lastResult);
            setLastResult(null);
            setInput('');
            toast.success('Assignment complete!');
        }
    };

    return (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200">
            <div className="flex items-center gap-2 mb-3">
                <Brain size={18} className="text-violet-600" />
                <span className="font-bold text-violet-800">AI Scheduling Assistant</span>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Try: 'Assign John to the Smith HVAC job tomorrow morning'"
                    className="flex-1 px-3 py-2 rounded-lg border border-violet-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                    disabled={isProcessing}
                />
                <button
                    type="submit"
                    disabled={isProcessing || !input.trim()}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {isProcessing ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <Zap size={16} />
                    )}
                </button>
            </form>

            {/* Confirmation */}
            {lastResult?.confirmation && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-violet-200">
                    <p className="text-sm text-slate-700 mb-2">{lastResult.confirmation}</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleConfirm}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1"
                        >
                            <Check size={14} />
                            Confirm
                        </button>
                        <button
                            onClick={() => setLastResult(null)}
                            className="px-3 py-1.5 text-slate-600 text-sm hover:bg-slate-100 rounded-lg flex items-center gap-1"
                        >
                            <X size={14} />
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Quick suggestions */}
            <div className="mt-3 flex flex-wrap gap-2">
                {['Suggest best tech for...', 'Who is available tomorrow?', 'Schedule remaining jobs'].map(suggestion => (
                    <button
                        key={suggestion}
                        onClick={() => setInput(suggestion)}
                        className="text-xs px-2 py-1 bg-white border border-violet-200 text-violet-600 rounded-lg hover:bg-violet-50"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================
// INSIGHTS SUMMARY
// ============================================

const InsightsSummary = ({ insights }) => {
    if (!insights) return null;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-emerald-600" />
                <span className="font-bold text-slate-800">Performance Insights</span>
            </div>

            {/* Top Performers by Category */}
            <div className="space-y-3">
                {Object.entries(insights.topPerformers || {}).slice(0, 3).map(([category, techs]) => {
                    const top = techs[0];
                    if (!top) return null;

                    return (
                        <div key={category} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Award size={16} className="text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">
                                    {top.techName}
                                </p>
                                <p className="text-xs text-slate-500">
                                    Top {category} tech - {top.rating?.toFixed(1) || 'N/A'} rating - {top.jobs} jobs
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Training Alerts */}
            {insights.trainingNeeded?.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 text-sm font-medium mb-1">
                        <AlertCircle size={14} />
                        Training Opportunities
                    </div>
                    {insights.trainingNeeded.slice(0, 2).map((item, idx) => (
                        <p key={idx} className="text-xs text-amber-600">
                            - {item.techName}: {item.suggestion}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const AIRecommendationsPanel = ({
    contractorId,
    jobs,
    teamMembers,
    date,
    onAssignJob,
    onJobUpdate,
    collapsed = false
}) => {
    const [isExpanded, setIsExpanded] = useState(!collapsed);
    const [recommendations, setRecommendations] = useState([]);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // Context for NLP
    const nlpContext = useMemo(() => ({
        teamMembers,
        jobs,
        contractorId,
        currentDate: date?.toISOString?.().split('T')[0] || new Date().toISOString().split('T')[0]
    }), [teamMembers, jobs, contractorId, date]);

    // Load recommendations
    useEffect(() => {
        const loadRecommendations = async () => {
            if (!contractorId || !teamMembers.length) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const [recs, ins] = await Promise.all([
                    generateDailyRecommendations(contractorId, date, jobs, teamMembers),
                    getSchedulingInsights(contractorId, teamMembers)
                ]);

                setRecommendations(recs);
                setInsights(ins);
            } catch (error) {
                console.error('Failed to load AI recommendations:', error);
            } finally {
                setLoading(false);
            }
        };

        loadRecommendations();
    }, [contractorId, jobs, teamMembers, date]);

    // Handle assignment from recommendation
    const handleAssign = async (jobId, techId, techName) => {
        if (onAssignJob) {
            await onAssignJob(jobId, techId, techName);
        }
        setRecommendations(prev => prev.filter(r => r.jobId !== jobId));
        onJobUpdate?.();
    };

    // Handle NLP execution
    const handleNLPExecute = async (result) => {
        if (result.action === 'assign' && result.job && result.tech) {
            setIsProcessing(true);
            try {
                if (onAssignJob) {
                    await onAssignJob(result.job.id, result.tech.id, result.tech.name);
                }
                onJobUpdate?.();
            } finally {
                setIsProcessing(false);
            }
        }
    };

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full p-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 hover:from-violet-700 hover:to-purple-700 transition-colors"
            >
                <Sparkles size={18} />
                <span className="font-bold">AI Scheduling Assistant</span>
                <ChevronDown size={18} />
            </button>
        );
    }

    return (
        <div className="bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
                        <Brain size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">AI Scheduling</h3>
                        <p className="text-xs text-slate-500">
                            {recommendations.length} suggestions - Learning from {insights?.topPerformers ? Object.keys(insights.topPerformers).length : 0} categories
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                    <ChevronUp size={18} className="text-slate-600" />
                </button>
            </div>

            {/* Natural Language Input */}
            <NaturalLanguageInput
                context={nlpContext}
                onExecute={handleNLPExecute}
                isProcessing={isProcessing}
            />

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-violet-600" />
                </div>
            )}

            {/* Recommendations */}
            {!loading && recommendations.length > 0 && (
                <div className="space-y-3">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <Target size={16} />
                        Smart Suggestions
                    </h4>
                    {recommendations.map(rec => (
                        <RecommendationCard
                            key={rec.jobId}
                            recommendation={rec}
                            teamMembers={teamMembers}
                            onAssign={handleAssign}
                        />
                    ))}
                </div>
            )}

            {/* No Recommendations */}
            {!loading && recommendations.length === 0 && (
                <div className="text-center py-6 text-slate-500">
                    <ThumbsUp size={24} className="mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm">All jobs are assigned!</p>
                </div>
            )}

            {/* Insights */}
            {!loading && insights && <InsightsSummary insights={insights} />}
        </div>
    );
};

export default AIRecommendationsPanel;
