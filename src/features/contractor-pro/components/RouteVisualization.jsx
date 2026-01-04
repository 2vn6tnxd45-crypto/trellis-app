// src/features/contractor-pro/components/RouteVisualization.jsx
// ============================================
// ROUTE VISUALIZATION
// ============================================
// Shows daily jobs on a map-like visualization with route optimization suggestions
// UPDATED: Added "Open in Google Maps" Deep Linking

import React, { useState, useMemo } from 'react';
import { 
    Navigation, MapPin, Clock, ArrowRight, 
    Route, Sparkles, ChevronDown, ChevronUp,
    Car, Home, CheckCircle, AlertCircle, Zap,
    ChevronLeft, ChevronRight, Calendar, ExternalLink, Map // Added Map icon
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
// GOOGLE MAPS INTEGRATION
// ============================================
const openGoogleMapsRoute = (jobs, homeBase) => {
    if (!jobs || jobs.length === 0) return;

    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    
    // 1. Determine Origin (Home Base or First Job)
    const originAddr = homeBase?.address || jobs[0].serviceAddress?.formatted || jobs[0].customer?.address;
    const originParam = `&origin=${encodeURIComponent(originAddr)}`;

    // 2. Determine Destination (Last Job)
    const lastJob = jobs[jobs.length - 1];
    const destAddr = lastJob.serviceAddress?.formatted || lastJob.customer?.address;
    const destParam = `&destination=${encodeURIComponent(destAddr)}`;

    // 3. Determine Waypoints (All jobs between Origin and Destination)
    let waypointsParam = "";
    
    // If we have a home base, ALL jobs except the last one are waypoints
    // If NO home base, the first job is origin, so waypoints start at job #2
    let intermediateJobs = [];
    
    if (homeBase?.address) {
        intermediateJobs = jobs.slice(0, jobs.length - 1);
    } else {
        intermediateJobs = jobs.slice(1, jobs.length - 1);
    }

    if (intermediateJobs.length > 0) {
        const points = intermediateJobs.map(j => 
            encodeURIComponent(j.serviceAddress?.formatted || j.customer?.address)
        ).join('|');
        waypointsParam = `&waypoints=${points}`;
    }

    // 4. Launch
    window.open(`${baseUrl}${originParam}${destParam}${waypointsParam}`, '_blank');
};

const openSingleJobMap = (job) => {
    const address = job.serviceAddress?.formatted || job.customer?.address;
    if (!address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
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
            <div className="w-full flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group">
                {/* Number badge */}
                <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {index + 1}
                </div>
                
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onClick?.(job)}>
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

                {/* Individual Map Button */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        openSingleJobMap(job);
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Open in Maps"
                >
                    <Map size={18} />
                </button>
            </div>
        </div>
    );
};

// ============================================
// ROUTE SUMMARY
// ============================================

const RouteSummary = ({ jobs, homeBase, isOptimized, onOpenMaps }) => {
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
            <div className="flex items-center justify-between mb-4">
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
            
            <div className="grid grid-cols-4 gap-3 mb-4">
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

            {/* NEW: Open in Google Maps Button */}
            <button
                onClick={onOpenMaps}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <Map size={18} />
                Open Full Route in Google Maps
            </button>
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
    onReorder,
    onDateChange
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

    // Date Navigation Handlers
    const handlePrevDay = () => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() - 1);
        if (onDateChange) onDateChange(newDate);
    };

    const handleNextDay = () => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + 1);
        if (onDateChange) onDateChange(newDate);
    };

    // NEW: Handle Map Button Click
    const handleOpenRoute = () => {
        openGoogleMapsRoute(displayJobs, preferences?.homeBase);
    };

    return (
        <div className="space-y-4">
            {/* Date Header with Navigation */}
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <button 
                    onClick={handlePrevDay}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                    <ChevronLeft size={20} />
                </button>
                
                <div className="text-center">
                    <h3 className="font-bold text-slate-800 flex items-center justify-center gap-2">
                        <Calendar size={16} className="text-emerald-600" />
                        {date?.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                        }) || 'Today'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                        {jobs.length} job{jobs.length !== 1 ? 's' : ''} scheduled
                    </p>
                </div>

                <button 
                    onClick={handleNextDay}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Content Logic */}
            {jobs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Navigation size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="font-medium text-slate-600">No jobs scheduled for this day</p>
                    <p className="text-sm">Use the arrows above to find your schedule</p>
                </div>
            ) : (
                <>
                    {/* Route Summary */}
                    <RouteSummary 
                        jobs={displayJobs} 
                        homeBase={preferences?.homeBase}
                        isOptimized={isOptimized}
                        onOpenMaps={handleOpenRoute}
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
                </>
            )}
        </div>
    );
};

export default RouteVisualization;
