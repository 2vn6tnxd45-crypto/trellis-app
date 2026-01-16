// src/features/contractor-pro/components/RouteComparison.jsx
// ============================================
// ROUTE COMPARISON VIEW
// ============================================
// Side-by-side comparison of current vs optimized route

import React, { useState } from 'react';
import {
    Route, Clock, TrendingDown, CheckCircle, ArrowRight,
    Map, Navigation, Sparkles,
    ChevronDown, ChevronUp, Car, Loader2
} from 'lucide-react';

// ============================================
// ROUTE COLUMN
// ============================================

const RouteColumn = ({ title, route, arrivals, stats, isOptimized, onApply }) => (
    <div className={`flex-1 rounded-xl border-2 ${
        isOptimized ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'
    }`}>
        {/* Header */}
        <div className={`p-3 border-b ${isOptimized ? 'border-emerald-200' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isOptimized ? (
                        <Sparkles size={18} className="text-emerald-600" />
                    ) : (
                        <Route size={18} className="text-slate-500" />
                    )}
                    <span className={`font-bold ${isOptimized ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {title}
                    </span>
                </div>
                {isOptimized && onApply && (
                    <button
                        onClick={onApply}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Apply
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1">
                    <Clock size={14} className="text-slate-400" />
                    <span className={isOptimized ? 'text-emerald-700 font-medium' : 'text-slate-600'}>
                        {stats?.totalTravelTime || 0} min drive
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Car size={14} className="text-slate-400" />
                    <span className="text-slate-600">
                        {route?.length || 0} stops
                    </span>
                </div>
            </div>
        </div>

        {/* Route List */}
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {route?.map((job, idx) => {
                const arrival = arrivals?.find(a => a.job.id === job.id || a.job._id === job._id);
                return (
                    <div key={job.id || idx} className="flex items-start gap-2">
                        {/* Stop Number */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isOptimized ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                            {idx + 1}
                        </div>

                        {/* Job Info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                                {job.title || job.serviceType || job.description || 'Job'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                                {job.customer?.name || job.customerName}
                            </p>
                            {arrival && (
                                <p className="text-xs text-slate-400">
                                    ETA: {arrival.arrivalTimeStr}
                                </p>
                            )}
                        </div>

                        {/* Time Window Indicator */}
                        {job.timeWindow?.type === 'hard' && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                Appt
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
);

// ============================================
// SAVINGS SUMMARY
// ============================================

const SavingsSummary = ({ comparison }) => {
    if (!comparison) return null;

    const { timeSavedMinutes, percentImprovement, recommendation } = comparison;
    const improved = recommendation === 'B';

    if (!improved || timeSavedMinutes <= 0) {
        return (
            <div className="text-center py-4 text-slate-500 text-sm">
                <CheckCircle size={20} className="mx-auto mb-1 text-emerald-500" />
                Your current route is already optimal!
            </div>
        );
    }

    return (
        <div className="bg-emerald-100 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-lg">
                <TrendingDown size={24} />
                Save {timeSavedMinutes} minutes
            </div>
            <p className="text-emerald-600 text-sm mt-1">
                {percentImprovement}% more efficient route
            </p>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const RouteComparison = ({
    currentRoute,
    optimizedRoute,
    currentArrivals,
    optimizedArrivals,
    currentStats,
    optimizedStats,
    comparison,
    onApplyOptimized,
    onOpenMaps,
    isLoading
}) => {
    const [expanded, setExpanded] = useState(true);

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Loader2 size={32} className="mx-auto text-emerald-600 animate-spin mb-3" />
                <p className="text-slate-600 font-medium">Calculating optimal route...</p>
                <p className="text-sm text-slate-400 mt-1">Analyzing time windows and travel times</p>
            </div>
        );
    }

    if (!currentRoute || currentRoute.length === 0) {
        return (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                <Route size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-medium">No jobs to optimize</p>
                <p className="text-sm text-slate-400 mt-1">Add jobs to see route optimization</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Navigation size={20} className="text-emerald-600" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800">Route Optimization</h3>
                        <p className="text-sm text-slate-500">
                            {comparison?.timeSavedMinutes > 0
                                ? `Save ${comparison.timeSavedMinutes} minutes with optimized route`
                                : 'Compare routes'
                            }
                        </p>
                    </div>
                </div>
                {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {expanded && (
                <div className="p-4 pt-0 space-y-4">
                    {/* Savings Summary */}
                    <SavingsSummary comparison={comparison} />

                    {/* Route Columns */}
                    <div className="flex gap-4">
                        <RouteColumn
                            title="Current Route"
                            route={currentRoute}
                            arrivals={currentArrivals}
                            stats={currentStats || { totalTravelTime: 0 }}
                            isOptimized={false}
                        />
                        <RouteColumn
                            title="Optimized Route"
                            route={optimizedRoute}
                            arrivals={optimizedArrivals}
                            stats={optimizedStats || { totalTravelTime: 0 }}
                            isOptimized={true}
                            onApply={onApplyOptimized}
                        />
                    </div>

                    {/* Actions */}
                    {onOpenMaps && (
                        <div className="flex gap-3">
                            <button
                                onClick={onOpenMaps}
                                className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Map size={18} />
                                Open in Google Maps
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RouteComparison;
