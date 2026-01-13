// src/features/dashboard/components/HomeHealthCard.jsx
// ============================================
// HOME HEALTH CARD
// ============================================
// A reusable component that displays the Home Health Score
// with animated progress ring and breakdown details.
//
// Usage:
// <HomeHealthCard
//     score={85}
//     breakdown={{ profile: 40, maintenance: 45, categories: 4 }}
//     overdueCount={2}
//     variant="compact" // 'full' | 'compact' | 'minimal'
//     onClick={() => console.log('Clicked!')}
// />

import React, { useState, useEffect } from 'react';
import { Wrench, Package, AlertTriangle, CheckCircle2, TrendingUp, ChevronDown, X } from 'lucide-react';

// ============================================
// SCORE RING COMPONENT
// ============================================
const ScoreRing = ({ score, size = 'md', animate = true }) => {
    const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

    // Animate score count-up
    useEffect(() => {
        if (!animate) {
            setDisplayScore(score);
            return;
        }

        const duration = 1000; // ms
        const steps = 30;
        const increment = score / steps;
        let current = 0;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current = Math.min(Math.round(increment * step), score);
            setDisplayScore(current);

            if (step >= steps) {
                clearInterval(timer);
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [score, animate]);

    // Size configurations
    const sizeConfig = {
        sm: { ring: 'h-16 w-16', text: 'text-xl', stroke: 8 },
        md: { ring: 'h-24 w-24', text: 'text-3xl', stroke: 10 },
        lg: { ring: 'h-32 w-32', text: 'text-4xl', stroke: 12 }
    };

    const config = sizeConfig[size] || sizeConfig.md;

    // Color based on score
    const getScoreColor = (s) => {
        if (s >= 80) return 'stroke-emerald-400';
        if (s >= 60) return 'stroke-amber-400';
        if (s >= 40) return 'stroke-orange-400';
        return 'stroke-red-400';
    };

    const getTextColor = (s) => {
        if (s >= 80) return 'text-emerald-600';
        if (s >= 60) return 'text-amber-600';
        if (s >= 40) return 'text-orange-600';
        return 'text-red-600';
    };

    return (
        <div className={`relative ${config.ring}`}>
            <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    className="stroke-slate-100"
                    strokeWidth={config.stroke}
                    fill="none"
                />
                {/* Progress ring */}
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    className={`${getScoreColor(displayScore)} transition-all duration-300`}
                    strokeWidth={config.stroke}
                    fill="none"
                    strokeDasharray={`${displayScore * 2.83} 283`}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`${config.text} font-black ${getTextColor(displayScore)}`}>
                    {displayScore}
                </span>
            </div>
        </div>
    );
};

// ============================================
// BREAKDOWN POPUP
// ============================================
const BreakdownPopup = ({ breakdown, score, onClose }) => (
    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
            <h3 className="font-bold text-slate-900">Score Breakdown</h3>
            <span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {score}
            </span>
        </div>
        <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                    <Wrench size={16} className="text-slate-400" />
                    <span className="text-slate-600">Maintenance</span>
                </div>
                <span className={`font-bold ${breakdown.maintenance === 50 ? 'text-emerald-600' : breakdown.maintenance >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                    {breakdown.maintenance}/50
                </span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                    <Package size={16} className="text-slate-400" />
                    <span className="text-slate-600">Coverage</span>
                </div>
                <span className={`font-bold ${breakdown.profile >= 40 ? 'text-emerald-600' : breakdown.profile >= 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {breakdown.profile}/50
                </span>
            </div>
            {breakdown.categories !== undefined && (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-50">
                    <span className="text-slate-500 text-xs">Categories tracked</span>
                    <span className="text-slate-600 font-medium">{breakdown.categories}/6</span>
                </div>
            )}
        </div>
        <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-full mt-4 pt-2 border-t border-slate-50 text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
        >
            Tap to close
        </button>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const HomeHealthCard = ({
    score = 0,
    breakdown = { profile: 0, maintenance: 0, categories: 0 },
    overdueCount = 0,
    variant = 'full', // 'full' | 'compact' | 'minimal'
    showBreakdown = true,
    animate = true,
    onClick,
    className = ''
}) => {
    const [showDetails, setShowDetails] = useState(false);

    // Get status message based on score
    const getStatusMessage = () => {
        if (score >= 90) return { text: 'Excellent!', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' };
        if (score >= 70) return { text: 'Good', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' };
        if (score >= 50) return { text: 'Fair', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' };
        return { text: 'Needs Attention', icon: AlertTriangle, color: 'text-red-600 bg-red-50' };
    };

    const status = getStatusMessage();
    const StatusIcon = status.icon;

    // Minimal variant - just the ring
    if (variant === 'minimal') {
        return (
            <div
                className={`cursor-pointer ${className}`}
                onClick={onClick}
            >
                <ScoreRing score={score} size="sm" animate={animate} />
            </div>
        );
    }

    // Compact variant - ring with label
    if (variant === 'compact') {
        return (
            <div
                className={`flex items-center gap-3 cursor-pointer ${className}`}
                onClick={onClick || (() => setShowDetails(!showDetails))}
            >
                <div className="relative">
                    <ScoreRing score={score} size="sm" animate={animate} />
                    {showDetails && showBreakdown && (
                        <BreakdownPopup
                            breakdown={breakdown}
                            score={score}
                            onClose={() => setShowDetails(false)}
                        />
                    )}
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Health</p>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${status.color}`}>
                        <StatusIcon size={10} />
                        {status.text}
                    </div>
                </div>
            </div>
        );
    }

    // Full variant - card with all details
    return (
        <div className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-sm ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Home Health Score</h3>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.text}
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Score Ring */}
                <div
                    className="relative cursor-pointer group"
                    onClick={() => showBreakdown && setShowDetails(!showDetails)}
                >
                    <ScoreRing score={score} size="lg" animate={animate} />
                    {showBreakdown && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronDown size={14} className="text-slate-400" />
                        </div>
                    )}
                    {showDetails && showBreakdown && (
                        <BreakdownPopup
                            breakdown={breakdown}
                            score={score}
                            onClose={() => setShowDetails(false)}
                        />
                    )}
                </div>

                {/* Breakdown Bars */}
                <div className="flex-1 space-y-3">
                    {/* Maintenance Score */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Wrench size={12} />
                                Maintenance
                            </span>
                            <span className="text-xs font-bold text-slate-700">{breakdown.maintenance}/50</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    breakdown.maintenance >= 40 ? 'bg-emerald-500' :
                                    breakdown.maintenance >= 25 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${(breakdown.maintenance / 50) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Coverage Score */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Package size={12} />
                                Coverage
                            </span>
                            <span className="text-xs font-bold text-slate-700">{breakdown.profile}/50</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    breakdown.profile >= 40 ? 'bg-emerald-500' :
                                    breakdown.profile >= 25 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${(breakdown.profile / 50) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Overdue Alert */}
                    {overdueCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded-lg">
                            <AlertTriangle size={12} />
                            <span className="font-medium">{overdueCount} overdue task{overdueCount > 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Tips */}
            {score < 80 && (
                <div className="mt-4 pt-4 border-t border-slate-50">
                    <p className="text-xs text-slate-500">
                        {score < 50 ? (
                            <span><strong>Tip:</strong> Complete overdue maintenance tasks to boost your score.</span>
                        ) : score < 70 ? (
                            <span><strong>Tip:</strong> Add more home systems to improve coverage.</span>
                        ) : (
                            <span><strong>Tip:</strong> Keep up the great work! Stay on top of maintenance.</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

export default HomeHealthCard;
