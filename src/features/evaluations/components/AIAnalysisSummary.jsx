// src/features/evaluations/components/AIAnalysisSummary.jsx
// ============================================
// AI ANALYSIS SUMMARY COMPONENT
// ============================================
// Displays AI-generated analysis of evaluation submissions
// to help contractors quickly understand the problem.

import React, { useState } from 'react';
import {
    Sparkles,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Lightbulb,
    MessageSquare,
    Target,
    Shield,
    Clock,
    Zap,
    FileText,
    RefreshCw,
    Loader2
} from 'lucide-react';
import { getSeverityConfig, formatConfidence, analyzeEvaluation, saveAnalysisToEvaluation } from '../lib/evaluationAI';

// ============================================
// SEVERITY BADGE
// ============================================
const SeverityBadge = ({ severity }) => {
    const config = getSeverityConfig(severity);
    
    const icons = {
        low: Shield,
        medium: AlertCircle,
        high: AlertTriangle,
        urgent: Zap
    };
    
    const Icon = icons[severity] || AlertCircle;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${config.bgClass} ${config.textClass}`}>
            <Icon size={14} />
            {config.label}
        </span>
    );
};

// ============================================
// CONFIDENCE INDICATOR
// ============================================
const ConfidenceIndicator = ({ confidence }) => {
    const percent = Math.round((confidence || 0) * 100);
    const label = formatConfidence(confidence);
    
    let colorClass = 'bg-slate-200';
    if (percent >= 80) colorClass = 'bg-emerald-500';
    else if (percent >= 60) colorClass = 'bg-amber-500';
    else if (percent >= 40) colorClass = 'bg-orange-500';
    else colorClass = 'bg-red-500';
    
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${colorClass} transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">{label}</span>
        </div>
    );
};

// ============================================
// READY TO QUOTE BADGE
// ============================================
const ReadyToQuoteBadge = ({ ready }) => {
    if (ready) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Ready to Quote</span>
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <HelpCircle size={16} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-700">May Need More Info</span>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const AIAnalysisSummary = ({ 
    analysis,
    evaluation,
    contractorId,
    evaluationId,
    onRefresh,
    variant = 'full' // 'full' | 'compact'
}) => {
    const [expanded, setExpanded] = useState(variant === 'full');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Handle refresh/re-analyze
    const handleRefresh = async () => {
        if (!evaluation || isRefreshing) return;
        
        setIsRefreshing(true);
        try {
            const { success, analysis: newAnalysis } = await analyzeEvaluation({
                photos: evaluation.submissions?.photos || [],
                videos: evaluation.submissions?.videos || [],
                description: evaluation.jobDescription || '',
                answers: evaluation.submissions?.answers || {},
                prompts: evaluation.prompts || [],
                jobCategory: evaluation.jobCategory || '',
                propertyType: ''
            });

            if (success && contractorId && evaluationId) {
                await saveAnalysisToEvaluation(contractorId, evaluationId, newAnalysis);
                onRefresh?.(newAnalysis);
            }
        } catch (error) {
            console.error('Refresh error:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    if (!analysis) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">AI analysis not available</p>
            </div>
        );
    }

    // Compact variant for list views
    if (variant === 'compact') {
        return (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Sparkles size={16} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">AI Summary</span>
                            <SeverityBadge severity={analysis.severity} />
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{analysis.summary}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Full variant
    return (
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm">
                        <Sparkles size={20} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            AI Problem Analysis
                            {analysis.isBasicSummary && (
                                <span className="text-xs font-normal text-slate-500">(Basic)</span>
                            )}
                        </h3>
                        <p className="text-xs text-slate-500">
                            Analyzed {analysis.photoCount || 0} photo{analysis.photoCount !== 1 ? 's' : ''} 
                            {analysis.videoCount > 0 && ` + ${analysis.videoCount} video${analysis.videoCount !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <SeverityBadge severity={analysis.severity} />
                    {expanded ? (
                        <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                        <ChevronDown size={20} className="text-slate-400" />
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Summary */}
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <FileText size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-slate-700 mb-1">Summary</p>
                                <p className="text-slate-600">{analysis.summary}</p>
                            </div>
                        </div>
                    </div>

                    {/* Issues Identified */}
                    {analysis.issues && analysis.issues.length > 0 && (
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <Target size={16} className="text-amber-500" />
                                <p className="text-sm font-semibold text-slate-700">Issues Identified</p>
                            </div>
                            <ul className="space-y-2">
                                {analysis.issues.map((issue, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                        <span className="text-amber-500 mt-1">•</span>
                                        {issue}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Suggested Questions */}
                    {analysis.suggestedQuestions && analysis.suggestedQuestions.length > 0 && (
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <MessageSquare size={16} className="text-purple-500" />
                                <p className="text-sm font-semibold text-slate-700">Suggested Questions</p>
                            </div>
                            <ul className="space-y-2">
                                {analysis.suggestedQuestions.map((question, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                        <HelpCircle size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                                        {question}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Recommendations */}
                    {analysis.recommendations && (
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <Lightbulb size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 mb-1">Recommendation</p>
                                    <p className="text-slate-600 text-sm">{analysis.recommendations}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer: Ready to Quote + Confidence + Refresh */}
                    <div className="flex items-center justify-between pt-2">
                        <ReadyToQuoteBadge ready={analysis.readyToQuote} />
                        
                        <div className="flex items-center gap-4">
                            {/* Confidence */}
                            <div className="w-32">
                                <ConfidenceIndicator confidence={analysis.confidence} />
                            </div>
                            
                            {/* Refresh Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRefresh();
                                }}
                                disabled={isRefreshing}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                                title="Re-analyze"
                            >
                                {isRefreshing ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Timestamp */}
                    {analysis.analyzedAt && (
                        <p className="text-xs text-slate-400 text-right flex items-center justify-end gap-1">
                            <Clock size={10} />
                            Analyzed {new Date(analysis.analyzedAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIAnalysisSummary;
