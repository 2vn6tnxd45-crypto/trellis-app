// src/features/contractor-pro/components/AISuggestionPanel.jsx
// ============================================
// AI SUGGESTION PANEL
// ============================================
// Displays smart scheduling recommendations
// UPDATED: Better empty states & debugging

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Sparkles, Star, Clock, MapPin, TrendingUp, 
    AlertTriangle, ChevronDown, ChevronUp, Check,
    Navigation, Users, Calendar, Lightbulb, Zap, Settings
} from 'lucide-react';
import { generateSchedulingSuggestions } from '../lib/schedulingAI';

// ============================================
// SUGGESTION CARD
// ============================================

const SuggestionCard = ({ suggestion, isSelected, onSelect, compact = false }) => {
    const [expanded, setExpanded] = useState(false);
    
    return (
        <button
            onClick={() => onSelect(suggestion)}
            className={`w-full text-left transition-all ${
                isSelected
                    ? 'ring-2 ring-emerald-500 bg-emerald-50'
                    : 'hover:bg-slate-50'
            } ${compact ? 'p-3' : 'p-4'} rounded-xl border ${
                suggestion.isRecommended 
                    ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50' 
                    : 'border-slate-200 bg-white'
            }`}
        >
            {/* Recommended Badge */}
            {suggestion.isRecommended && (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-2">
                    <Star size={12} className="fill-emerald-500" />
                    RECOMMENDED
                </div>
            )}
            
            {/* Main Content */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className={`font-bold text-slate-800 ${compact ? 'text-sm' : ''}`}>
                        {suggestion.dateFormatted}
                    </p>
                    <p className={`text-slate-600 ${compact ? 'text-xs' : 'text-sm'} mt-0.5`}>
                        {suggestion.timeFormatted}
                    </p>
                </div>
                
                {/* Score indicator */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                    suggestion.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                    suggestion.score >= 60 ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                }`}>
                    <Zap size={12} />
                    <span className="text-xs font-bold">{suggestion.score}</span>
                </div>
            </div>
            
            {/* Reasons */}
            {suggestion.reasons.length > 0 && (
                <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
                    {suggestion.reasons.slice(0, expanded ? undefined : 2).map((reason, idx) => (
                        <span 
                            key={idx}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-600"
                        >
                            <Check size={10} className="text-emerald-500" />
                            {reason}
                        </span>
                    ))}
                    {!expanded && suggestion.reasons.length > 2 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
                            className="text-xs text-slate-400 hover:text-slate-600"
                        >
                            +{suggestion.reasons.length - 2} more
                        </button>
                    )}
                </div>
            )}
            
            {/* Nearby Jobs (if any) */}
            {suggestion.nearbyJobs?.length > 0 && !compact && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Navigation size={10} />
                        Nearby: {suggestion.nearbyJobs.map(n => 
                            `${n.job.customer?.name?.split(' ')[0] || 'Job'} (${n.distance.toFixed(1)}mi)`
                        ).join(', ')}
                    </p>
                </div>
            )}
            
            {/* Selection indicator */}
            {isSelected && (
                <div className="mt-3 flex items-center gap-2 text-emerald-600 text-xs font-medium">
                    <Check size={14} />
                    Selected
                </div>
            )}
        </button>
    );
};

// ============================================
// INSIGHT CARD
// ============================================

const InsightCard = ({ insight }) => {
    const icons = {
        cluster: Navigation,
        workload_imbalance: TrendingUp,
        default: Lightbulb
    };
    
    const Icon = icons[insight.type] || icons.default;
    
    return (
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="bg-blue-100 p-1.5 rounded-lg">
                <Icon size={14} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-800">{insight.message}</p>
                {insight.jobs && (
                    <p className="text-xs text-blue-600 mt-1">
                        {insight.jobs.map(j => j.title || j.description || 'Job').join(', ')}
                    </p>
                )}
            </div>
        </div>
    );
};

// ============================================
// WARNING CARD
// ============================================

const WarningCard = ({ warning }) => (
    <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">{warning.message}</p>
    </div>
);

// ============================================
// MAIN PANEL COMPONENT
// ============================================

export const AISuggestionPanel = ({ 
    job,
    allJobs,
    preferences,
    customerPreferences,
    onSelectSuggestion,
    selectedSuggestion,
    compact = false,
    onNavigate
}) => {
    const [showAll, setShowAll] = useState(false);
    
    // Check if working hours are actually configured
    const hasWorkingHours = useMemo(() => {
        return preferences?.workingHours && 
               Object.values(preferences.workingHours).some(d => d?.enabled);
    }, [preferences]);

    // Debugging: Log what AI sees
    useEffect(() => {
        if (!hasWorkingHours) {
            console.log('[AISuggestionPanel] ❌ No working hours detected');
        } else {
            console.log('[AISuggestionPanel] ✅ Working hours detected');
        }
    }, [hasWorkingHours]);
    
    // Generate suggestions
    const analysis = useMemo(() => {
        if (!job) return null;
        
        try {
            return generateSchedulingSuggestions(
                job,
                allJobs || [],
                preferences || {},
                customerPreferences,
                14
            );
        } catch (error) {
            console.error('Error generating suggestions:', error);
            return null;
        }
    }, [job, allJobs, preferences, customerPreferences]);
    
    if (!analysis || analysis.suggestions.length === 0) {
        return (
            <div className="bg-slate-50 rounded-xl p-4 text-center">
                <Sparkles size={24} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                    No AI suggestions found
                </p>
                
                {!hasWorkingHours ? (
                    <div className="mt-2">
                        <p className="text-xs text-amber-600 mb-2">
                            Working hours are not set up yet.
                        </p>
                        <button 
                            onClick={() => onNavigate?.('settings')}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                        >
                            <Settings size={12} />
                            Go to Settings
                        </button>
                    </div>
                ) : (
                    <div className="mt-2 text-xs text-slate-400">
                        <p>We checked the next 14 days but couldn't find an opening.</p>
                        <ul className="mt-2 text-left list-disc list-inside opacity-70">
                            <li>Check "Max Jobs Per Day" setting</li>
                            <li>Check "Default Job Duration"</li>
                            <li>Ensure working days are enabled</li>
                        </ul>
                    </div>
                )}
            </div>
        );
    }
    
    const displaySuggestions = showAll 
        ? analysis.suggestions 
        : analysis.suggestions.slice(0, 3);
    
    return (
        <div className={`space-y-4 ${compact ? '' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-1.5 rounded-lg">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">AI Suggestions</h3>
                        <p className="text-xs text-slate-500">
                            {analysis.meta.totalSlotsFound} options found
                        </p>
                    </div>
                </div>
                
                {analysis.meta.hasCustomerPreferences && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Customer prefs applied
                    </span>
                )}
            </div>
            
            {/* Insights */}
            {analysis.insights.length > 0 && !compact && (
                <div className="space-y-2">
                    {analysis.insights.slice(0, 2).map((insight, idx) => (
                        <InsightCard key={idx} insight={insight} />
                    ))}
                </div>
            )}
            
            {/* Warnings */}
            {analysis.warnings.length > 0 && !compact && (
                <div className="space-y-2">
                    {analysis.warnings.slice(0, 2).map((warning, idx) => (
                        <WarningCard key={idx} warning={warning} />
                    ))}
                </div>
            )}
            
            {/* Suggestions List */}
            <div className="space-y-2">
                {displaySuggestions.map((suggestion, idx) => (
                    <SuggestionCard
                        key={idx}
                        suggestion={suggestion}
                        isSelected={selectedSuggestion?.date?.getTime() === suggestion.date.getTime() &&
                                   selectedSuggestion?.startTime === suggestion.startTime}
                        onSelect={onSelectSuggestion}
                        compact={compact}
                    />
                ))}
            </div>
            
            {/* Show More/Less */}
            {analysis.suggestions.length > 3 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-1"
                >
                    {showAll ? (
                        <>Show Less <ChevronUp size={16} /></>
                    ) : (
                        <>Show {analysis.suggestions.length - 3} More <ChevronDown size={16} /></>
                    )}
                </button>
            )}
        </div>
    );
};

// ============================================
// COMPACT QUICK SUGGESTIONS (for inline use)
// ============================================

export const QuickSuggestions = ({ 
    job, 
    allJobs, 
    preferences, 
    onSelect 
}) => {
    const suggestions = useMemo(() => {
        if (!job) return [];
        try {
            const result = generateSchedulingSuggestions(job, allJobs || [], preferences || {}, null, 7);
            return result.suggestions.slice(0, 3);
        } catch {
            return [];
        }
    }, [job, allJobs, preferences]);
    
    if (suggestions.length === 0) return null;
    
    return (
        <div className="flex gap-2 overflow-x-auto pb-2">
            {suggestions.map((suggestion, idx) => (
                <button
                    key={idx}
                    onClick={() => onSelect(suggestion)}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all ${
                        suggestion.isRecommended
                            ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                >
                    {suggestion.isRecommended && (
                        <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold mb-1">
                            <Star size={8} className="fill-current" />
                            BEST
                        </div>
                    )}
                    <p className="text-xs font-bold text-slate-800">{suggestion.dateFormatted}</p>
                    <p className="text-[10px] text-slate-500">{suggestion.timeFormatted}</p>
                </button>
            ))}
        </div>
    );
};

export default AISuggestionPanel;
