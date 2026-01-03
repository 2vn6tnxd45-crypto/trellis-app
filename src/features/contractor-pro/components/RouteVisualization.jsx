// src/features/contractor-pro/components/RouteVisualization.jsx
// ============================================
// ROUTE VISUALIZATION
// ============================================
// Shows daily jobs on a map-like visualization with route optimization suggestions

import React, { useState, useMemo } from 'react';
import { 
    Navigation, MapPin, Clock, ArrowRight, 
    Route, Sparkles, ChevronDown, ChevronUp,
    Car, Home, CheckCircle, AlertCircle, Zap
} from 'lucide-react';
import { suggestRouteOrder } from '../lib/schedulingAI';

// ============================================
// HELPERS
// ============================================

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const estimateTravelTime = (miles) => {
    if (!miles) return null;
    return Math.ceil(miles * 2); // ~30 mph average
};

// ============================================
// JOB CARD IN ROUTE
// ============================================

const RouteJobCard = ({ job, index, travelFromPrev, isLast, onClick }) => {
    return (
        <div className="relative">
            {/* Travel indicator */}
            {index > 0 && travelFromPrev && (
                <div className="flex items-center gap-2 py-2 px-4 text-xs text-slate-500">
                    <Car size={12} />
                    <span>{travelFromPrev.distance?.toFixed(1)} mi</span>
                    <span>•</span>
                    <span>~{travelFromPrev.time} min</span>
                    <div className="flex-1 border-t border-dashed border-slate-300 mx-2" />
                </div>
            )}
            
            {/* Job card */}
            <button
                onClick={() => onClick?.(job)}
                className="w-full flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
            >
                {/* Number badge */}
                <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="font-bold text-slate-800">
                                {job.title || job.description || 'Service'}
                            </p>
                            <p className="text-sm text-slate-500">{job.customer?.name}</p>
                        </div>
                        <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {formatTime(job.scheduledTime)}
                        </span>
                    </div>
                    
                    {job.customer?.address && (
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <MapPin size={12} />
                            {job.customer.address}
                        </p>
                    )}
                    
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {job.estimatedDuration || 120} min
                        </span>
                        {job.total > 0 && (
                            <span className="text-emerald-600 font-bold">
                                ${job.total.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
            </button>
        </div>
    );
};

// ============================================
// ROUTE SUMMARY
// ============================================

const RouteSummary = ({ jobs, homeBase, isOptimized }) => {
    const stats = useMemo(() => {
        let totalDistance = 0;
        let totalTravelTime = 0;
        let totalJobTime = 0;
        
        let prevCoords = homeBase?.coordinates;
        
        jobs.forEach(job => {
            totalJobTime += job.estimatedDuration || 120;
            
            const jobCoords = job.serviceAddress?.coordinates;
            if (prevCoords && jobCoords) {
                const dist = calculateDistance(
                    prevCoords.lat, prevCoords.lng,
                    jobCoords.lat, jobCoords.lng
                );
                if (dist) {
                    totalDistance += dist;
                    totalTravelTime += estimateTravelTime(dist);
                }
            }
            prevCoords = jobCoords || prevCoords;
        });
        
        return {
            totalDistance: totalDistance.toFixed(1),
            totalTravelTime,
            totalJobTime,
            jobCount: jobs.length,
            totalRevenue: jobs.reduce((sum, j) => sum + (j.total || 0), 0)
        };
    }, [jobs, homeBase]);

    return (
        <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Route size={16} className="text-emerald-600" />
                    Route Summary
                </h4>
                {isOptimized && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Sparkles size={10} />
                        Optimized
                    </span>
                )}
            </div>
            
            <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-800">{stats.jobCount}</p>
                    <p className="text-xs text-slate-500">Jobs</p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-800">{stats.totalDistance}</p>
                    <p className="text-xs text-slate-500">Miles</p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-800">{stats.totalTravelTime}</p>
                    <p className="text-xs text-slate-500">Min Drive</p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">${stats.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Revenue</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ROUTE OPTIMIZATION SUGGESTION
// ============================================

const OptimizationSuggestion = ({ currentJobs, optimizedJobs, onApply }) => {
    const [expanded, setExpanded] = useState(false);

    // Calculate savings
    const savings = useMemo(() => {
        // Calculate total distance for both routes
        let currentDistance = 0;
        let optimizedDistance = 0;
        
        // Simple calculation - compare order
        const getRouteDistance = (jobs) => {
            let dist = 0;
            for (let i = 1; i < jobs.length; i++) {
                const prev = jobs[i-1].serviceAddress?.coordinates;
                const curr = jobs[i].serviceAddress?.coordinates;
                if (prev && curr) {
                    dist += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng) || 0;
                }
            }
            return dist;
        };
        
        currentDistance = getRouteDistance(currentJobs);
        optimizedDistance = getRouteDistance(optimizedJobs);
        
        return {
            miles: Math.max(0, currentDistance - optimizedDistance).toFixed(1),
            time: Math.max(0, Math.ceil((currentDistance - optimizedDistance) * 2))
        };
    }, [currentJobs, optimizedJobs]);

    // Check if optimization would change anything
    const wouldChange = currentJobs.some((job, idx) => job.id !== optimizedJobs[idx]?.id);

    if (!wouldChange) return null;

    return (
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 mb-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <div className="bg-violet-600 p-1.5 rounded-lg">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-violet-800">Route Optimization Available</p>
                        <p className="text-xs text-violet-600">
                            Save ~{savings.miles} miles, ~{savings.time} min
                        </p>
                    </div>
                </div>
                {expanded ? <ChevronUp size={18} className="text-violet-500" /> : <ChevronDown size={18} className="text-violet-500" />}
            </button>
            
            {expanded && (
                <div className="mt-4 space-y-3">
                    <p className="text-sm text-violet-700">Suggested order:</p>
                    <div className="space-y-2">
                        {optimizedJobs.map((job, idx) => (
                            <div key={job.id} className="flex items-center gap-2 bg-white p-2 rounded-lg">
                                <span className="w-6 h-6 bg-violet-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className="text-sm text-slate-700 flex-1 truncate">
                                    {job.title || job.description} - {job.customer?.name}
                                </span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={onApply}
                        className="w-full py-2 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Zap size={16} />
                        Apply Optimized Route
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN ROUTE VISUALIZATION COMPONENT
// ============================================

export const RouteVisualization = ({ 
    jobs = [], 
    date,
    preferences = {},
    onJobClick,
    onReorder
}) => {
    const [isOptimized, setIsOptimized] = useState(false);

    // Sort jobs by scheduled time
    const sortedJobs = useMemo(() => {
        return [...jobs].sort((a, b) => {
            const timeA = new Date(a.scheduledTime || a.scheduledDate);
            const timeB = new Date(b.scheduledTime || b.scheduledDate);
            return timeA - timeB;
        });
    }, [jobs]);

    // Get optimized order
    const optimizedJobs = useMemo(() => {
        return suggestRouteOrder(sortedJobs, preferences?.homeBase);
    }, [sortedJobs, preferences]);

    // Calculate travel info between jobs
    const travelInfo = useMemo(() => {
        const info = [];
        const displayJobs = isOptimized ? optimizedJobs : sortedJobs;
        let prevCoords = preferences?.homeBase?.coordinates;
        
        displayJobs.forEach((job, idx) => {
            const jobCoords = job.serviceAddress?.coordinates;
            if (idx > 0 && prevCoords && jobCoords) {
                const distance = calculateDistance(
                    prevCoords.lat, prevCoords.lng,
                    jobCoords.lat, jobCoords.lng
                );
                info.push({
                    distance,
                    time: estimateTravelTime(distance)
                });
            } else {
                info.push(null);
            }
            prevCoords = jobCoords || prevCoords;
        });
        
        return info;
    }, [sortedJobs, optimizedJobs, isOptimized, preferences]);

    const displayJobs = isOptimized ? optimizedJobs : sortedJobs;

    const handleApplyOptimization = () => {
        setIsOptimized(true);
        if (onReorder) {
            onReorder(optimizedJobs);
        }
    };

    if (jobs.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <Navigation size={32} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">No jobs scheduled</p>
                <p className="text-sm">Schedule some jobs to see your route</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Date header */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">
                    {date?.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                    }) || 'Today'}
                </h3>
                <span className="text-sm text-slate-500">
                    {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Route Summary */}
            <RouteSummary 
                jobs={displayJobs} 
                homeBase={preferences?.homeBase}
                isOptimized={isOptimized}
            />

            {/* Optimization Suggestion */}
            {!isOptimized && (
                <OptimizationSuggestion
                    currentJobs={sortedJobs}
                    optimizedJobs={optimizedJobs}
                    onApply={handleApplyOptimization}
                />
            )}

            {/* Start from home */}
            {preferences?.homeBase?.address && (
                <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-xl text-slate-600">
                    <Home size={18} />
                    <div>
                        <p className="text-xs font-medium text-slate-500">Starting from</p>
                        <p className="text-sm">{preferences.homeBase.address}</p>
                    </div>
                </div>
            )}

            {/* Job List with Route */}
            <div className="space-y-1">
                {displayJobs.map((job, idx) => (
                    <RouteJobCard
                        key={job.id}
                        job={job}
                        index={idx}
                        travelFromPrev={travelInfo[idx]}
                        isLast={idx === displayJobs.length - 1}
                        onClick={onJobClick}
                    />
                ))}
            </div>

            {/* Return home */}
            {preferences?.homeBase?.address && (
                <div className="flex items-center gap-2 py-2 px-4 text-xs text-slate-500">
                    <Car size={12} />
                    <span>Return home</span>
                    <div className="flex-1 border-t border-dashed border-slate-300 mx-2" />
                    <Home size={12} />
                </div>
            )}
        </div>
    );
};

export default RouteVisualization;
