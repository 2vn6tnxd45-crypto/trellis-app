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
    Loader2,
    Cpu,
    Wrench,
    ArrowRightLeft,
    Plus,
    Package,
    Calendar,
    CircleDot
} from 'lucide-react';
// ============================================
// INLINE SEVERITY CONFIG (to avoid import issues)
// ============================================
const SEVERITY_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium', 
    HIGH: 'high',
    URGENT: 'urgent'
};

const SEVERITY_CONFIG = {
    [SEVERITY_LEVELS.LOW]: {
        label: 'Low Priority',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
    },
    [SEVERITY_LEVELS.MEDIUM]: {
        label: 'Medium Priority',
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-700',
    },
    [SEVERITY_LEVELS.HIGH]: {
        label: 'High Priority',
        bgClass: 'bg-orange-100',
        textClass: 'text-orange-700',
    },
    [SEVERITY_LEVELS.URGENT]: {
        label: 'Urgent',
        bgClass: 'bg-red-100',
        textClass: 'text-red-700',
    }
};

const getSeverityConfig = (severity) => {
    return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG[SEVERITY_LEVELS.MEDIUM];
};

const formatConfidence = (confidence) => {
    if (typeof confidence !== 'number') return 'Unknown';
    const percent = Math.round(confidence * 100);
    if (percent >= 80) return 'High confidence';
    if (percent >= 60) return 'Moderate confidence';
    if (percent >= 40) return 'Low confidence';
    return 'Very low confidence';
};

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
// EQUIPMENT CONDITION BADGE
// ============================================
const ConditionBadge = ({ condition }) => {
    const config = {
        good: { label: 'Good', bg: 'bg-emerald-100', text: 'text-emerald-700' },
        fair: { label: 'Fair', bg: 'bg-amber-100', text: 'text-amber-700' },
        poor: { label: 'Poor', bg: 'bg-orange-100', text: 'text-orange-700' },
        critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700' }
    };
    const c = config[condition] || config.fair;

    return (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    );
};

// ============================================
// EQUIPMENT DETECTED SECTION
// ============================================
const EquipmentDetectedSection = ({ equipment }) => {
    if (!equipment || equipment.length === 0) return null;

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-indigo-500">
            <div className="flex items-center gap-2 mb-3">
                <Cpu size={16} className="text-indigo-600" />
                <p className="text-sm font-semibold text-slate-700">Equipment Detected</p>
            </div>
            <div className="space-y-3">
                {equipment.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-slate-800">{item.type}</span>
                                    {item.brand && (
                                        <span className="text-sm text-indigo-600 font-medium">{item.brand}</span>
                                    )}
                                    {item.condition && <ConditionBadge condition={item.condition} />}
                                </div>
                                {item.model && (
                                    <p className="text-xs text-slate-500 mt-1">Model: {item.model}</p>
                                )}
                                {item.estimatedAge && (
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                        <Calendar size={10} />
                                        ~{item.estimatedAge} years old
                                    </p>
                                )}
                            </div>
                        </div>
                        {item.notes && (
                            <p className="text-xs text-slate-600 mt-2 italic">{item.notes}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// REPAIR VS REPLACE SECTION
// ============================================
const RepairVsReplaceSection = ({ data }) => {
    if (!data || !data.recommendation) return null;

    const config = {
        repair: {
            label: 'Repair Recommended',
            icon: Wrench,
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            textColor: 'text-emerald-700'
        },
        replace: {
            label: 'Replacement Recommended',
            icon: ArrowRightLeft,
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            textColor: 'text-amber-700'
        },
        needs_inspection: {
            label: 'Site Inspection Needed',
            icon: HelpCircle,
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            textColor: 'text-blue-700'
        }
    };

    const c = config[data.recommendation] || config.needs_inspection;
    const Icon = c.icon;

    return (
        <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 ${c.iconBg} rounded-lg shrink-0`}>
                    <Icon size={20} className={c.iconColor} />
                </div>
                <div className="flex-1">
                    <h4 className={`font-bold ${c.textColor} mb-2`}>{c.label}</h4>
                    {data.estimatedAge && (
                        <p className="text-sm text-slate-600 mb-2">
                            Estimated equipment age: <strong>~{data.estimatedAge}</strong>
                        </p>
                    )}
                    {data.reasoning && data.reasoning.length > 0 && (
                        <ul className="space-y-1">
                            {data.reasoning.map((reason, idx) => (
                                <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                                    <CircleDot size={12} className={`${c.iconColor} mt-1 shrink-0`} />
                                    {reason}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// SUGGESTED QUOTE ITEMS SECTION
// ============================================
const SuggestedQuoteItemsSection = ({ items, onAddToQuote }) => {
    if (!items || items.length === 0) return null;

    const categoryConfig = {
        material: { label: 'Material', bg: 'bg-amber-100', text: 'text-amber-700' },
        labor: { label: 'Labor', bg: 'bg-blue-100', text: 'text-blue-700' },
        service: { label: 'Service', bg: 'bg-emerald-100', text: 'text-emerald-700' }
    };

    const costConfig = {
        low: { label: '$', color: 'text-emerald-600' },
        medium: { label: '$$', color: 'text-amber-600' },
        high: { label: '$$$', color: 'text-orange-600' }
    };

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Package size={16} className="text-emerald-600" />
                    <p className="text-sm font-semibold text-slate-700">Suggested Quote Items</p>
                </div>
                {onAddToQuote && (
                    <button
                        onClick={() => onAddToQuote(items)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Plus size={14} />
                        Add All to Quote
                    </button>
                )}
            </div>
            <div className="space-y-2">
                {items.map((item, idx) => {
                    const cat = categoryConfig[item.category] || categoryConfig.service;
                    const cost = costConfig[item.estimatedCost] || null;

                    return (
                        <div key={idx} className="bg-white rounded-lg p-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-slate-800">{item.name}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${cat.bg} ${cat.text}`}>
                                        {cat.label}
                                    </span>
                                    {cost && (
                                        <span className={`text-xs font-bold ${cost.color}`}>
                                            {cost.label}
                                        </span>
                                    )}
                                </div>
                                {item.description && (
                                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                                )}
                            </div>
                            {onAddToQuote && (
                                <button
                                    onClick={() => onAddToQuote([item])}
                                    className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
                                    title="Add to quote"
                                >
                                    <Plus size={16} className="text-emerald-600" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
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
    onAddToQuote, // Callback when user wants to add suggested items to quote
    variant = 'full' // 'full' | 'compact'
}) => {
    const [expanded, setExpanded] = useState(variant === 'full');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Check if we have enhanced analysis data
    const hasEquipment = analysis?.equipmentDetected?.length > 0;
    const hasRepairVsReplace = analysis?.repairVsReplace?.recommendation;
    const hasSuggestedItems = analysis?.suggestedQuoteItems?.length > 0;
    const hasEnhancedData = hasEquipment || hasRepairVsReplace || hasSuggestedItems;


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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">AI Analysis</span>
                            {analysis.usedVision && (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Vision</span>
                            )}
                            {hasEnhancedData && (
                                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Cpu size={10} />
                                    Equipment
                                </span>
                            )}
                            <SeverityBadge severity={analysis.severity} />
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{analysis.summary}</p>
                        {hasEquipment && (
                            <p className="text-xs text-indigo-600 mt-1">
                                {analysis.equipmentDetected.length} equipment item{analysis.equipmentDetected.length !== 1 ? 's' : ''} detected
                            </p>
                        )}
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
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                            AI Analysis
                            {analysis.usedVision && (
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Vision</span>
                            )}
                            {hasEquipment && (
                                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Cpu size={10} />
                                    Equipment
                                </span>
                            )}
                            {hasSuggestedItems && (
                                <span className="text-xs font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Package size={10} />
                                    Quote Items
                                </span>
                            )}
                            {analysis.isBasicSummary && (
                                <span className="text-xs font-normal text-slate-500">(Basic)</span>
                            )}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {analysis.usedVision
                                ? `Analyzed ${analysis.photosAnalyzed || analysis.photoCount || 0} photo${(analysis.photosAnalyzed || analysis.photoCount) !== 1 ? 's' : ''} with AI vision`
                                : `${analysis.photoCount || 0} photo${analysis.photoCount !== 1 ? 's' : ''} submitted`
                            }
                            {analysis.videoCount > 0 && ` + ${analysis.videoCount} video${analysis.videoCount !== 1 ? 's' : ''}`}
                            {hasEquipment && ` • ${analysis.equipmentDetected.length} equipment detected`}
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

                    {/* Equipment Detected - NEW */}
                    <EquipmentDetectedSection equipment={analysis.equipmentDetected} />

                    {/* Repair vs Replace Recommendation - NEW */}
                    <RepairVsReplaceSection data={analysis.repairVsReplace} />

                    {/* Suggested Quote Items - NEW */}
                    <SuggestedQuoteItemsSection
                        items={analysis.suggestedQuoteItems}
                        onAddToQuote={onAddToQuote}
                    />

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
