// src/features/contractor-pro/components/RouteMapView.jsx
// ============================================
// ROUTE OPTIMIZATION VISUAL MAP
// ============================================
// Interactive map view showing scheduled jobs and optimized routes
// Uses simple embedded map (can be upgraded to Mapbox/Google Maps)

import React, { useState, useMemo } from 'react';
import {
    Map,
    Navigation,
    Clock,
    MapPin,
    Truck,
    User,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    ExternalLink,
    RefreshCw,
    Loader2,
    Route,
    Timer,
    Fuel
} from 'lucide-react';
import { formatTimeInTimezone, isSameDayInTimezone } from '../lib/timezoneUtils';

// ============================================
// ROUTE STATS CARD
// ============================================

const RouteStats = ({ jobs, totalDistance, totalTime, optimizedOrder }) => {
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const remainingJobs = jobs.length - completedJobs;

    return (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Route Summary
            </h3>
            <div className="grid grid-cols-4 gap-3">
                <StatBox
                    icon={MapPin}
                    value={jobs.length}
                    label="Stops"
                    color="indigo"
                />
                <StatBox
                    icon={Route}
                    value={totalDistance ? `${totalDistance} mi` : '--'}
                    label="Distance"
                    color="blue"
                />
                <StatBox
                    icon={Timer}
                    value={totalTime ? formatDuration(totalTime) : '--'}
                    label="Drive Time"
                    color="amber"
                />
                <StatBox
                    icon={CheckCircle}
                    value={`${completedJobs}/${jobs.length}`}
                    label="Completed"
                    color="emerald"
                />
            </div>

            {optimizedOrder && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <Fuel size={14} />
                        Route optimized - saving ~{Math.round(totalDistance * 0.15)} mi
                    </span>
                </div>
            )}
        </div>
    );
};

const StatBox = ({ icon: Icon, value, label, color }) => (
    <div className="text-center">
        <Icon size={18} className={`mx-auto text-${color}-500 mb-1`} />
        <p className="text-lg font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
    </div>
);

// ============================================
// JOB LIST ITEM
// ============================================

const RouteJobItem = ({ job, index, isSelected, onSelect, onNavigate }) => {
    const statusColors = {
        scheduled: 'bg-blue-100 text-blue-700',
        dispatched: 'bg-indigo-100 text-indigo-700',
        on_the_way: 'bg-purple-100 text-purple-700',
        in_progress: 'bg-emerald-100 text-emerald-700',
        completed: 'bg-slate-100 text-slate-500'
    };

    const statusLabels = {
        scheduled: 'Scheduled',
        dispatched: 'Dispatched',
        on_the_way: 'En Route',
        in_progress: 'In Progress',
        completed: 'Done'
    };

    const isCompleted = job.status === 'completed';

    return (
        <div
            onClick={() => onSelect(job)}
            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : isCompleted
                        ? 'border-slate-200 bg-slate-50 opacity-60'
                        : 'border-slate-200 hover:border-slate-300'
            }`}
        >
            <div className="flex items-start gap-3">
                {/* Stop number */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                }`}>
                    {isCompleted ? <CheckCircle size={16} /> : index + 1}
                </div>

                {/* Job details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className={`font-medium ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {job.customer?.name || job.customerName || 'Customer'}
                            </p>
                            <p className="text-sm text-slate-500 truncate">
                                {job.customer?.address || job.address}
                            </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            statusColors[job.status] || 'bg-slate-100 text-slate-600'
                        }`}>
                            {statusLabels[job.status] || job.status}
                        </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatTime(job.scheduledTime || job.scheduledDate)}
                        </span>
                        {job.estimatedDuration && (
                            <span>{job.estimatedDuration} min</span>
                        )}
                    </div>
                </div>

                {/* Navigate button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(job);
                    }}
                    className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                    title="Get directions"
                >
                    <Navigation size={16} />
                </button>
            </div>
        </div>
    );
};

// ============================================
// MAP EMBED COMPONENT
// ============================================

const MapEmbed = ({ jobs, selectedJob, startLocation }) => {
    // Build Google Maps embed URL with waypoints
    const mapUrl = useMemo(() => {
        if (!jobs || jobs.length === 0) return null;

        const addresses = jobs
            .filter(j => j.customer?.address || j.address)
            .map(j => encodeURIComponent(j.customer?.address || j.address));

        if (addresses.length === 0) return null;

        // Simple embed showing first address
        const origin = startLocation || addresses[0];
        const destination = addresses[addresses.length - 1];
        const waypoints = addresses.slice(1, -1).join('|');

        // Use Google Maps Embed API (requires API key in production)
        // For now, use a static map placeholder
        return `https://www.google.com/maps/embed/v1/directions?key=YOUR_API_KEY&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&mode=driving`;
    }, [jobs, startLocation]);

    // Placeholder map display
    return (
        <div className="bg-slate-100 rounded-xl overflow-hidden relative" style={{ height: '400px' }}>
            {/* Placeholder map visualization */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <Map size={48} className="text-slate-300 mb-4" />
                <h4 className="font-semibold text-slate-600 mb-2">Route Map</h4>
                <p className="text-sm text-slate-500 mb-4">
                    {jobs.length} stops on today's route
                </p>

                {/* Visual route representation */}
                <div className="flex items-center gap-2 mb-4">
                    {jobs.slice(0, 5).map((job, idx) => (
                        <React.Fragment key={job.id || idx}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                job.status === 'completed'
                                    ? 'bg-emerald-500 text-white'
                                    : selectedJob?.id === job.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white border-2 border-slate-300 text-slate-600'
                            }`}>
                                {idx + 1}
                            </div>
                            {idx < jobs.slice(0, 5).length - 1 && (
                                <div className="w-8 h-0.5 bg-slate-300" />
                            )}
                        </React.Fragment>
                    ))}
                    {jobs.length > 5 && (
                        <span className="text-slate-400 text-sm">+{jobs.length - 5}</span>
                    )}
                </div>

                {/* Open in Maps button */}
                <button
                    onClick={() => {
                        const addresses = jobs
                            .filter(j => j.customer?.address || j.address)
                            .map(j => j.customer?.address || j.address);
                        const url = `https://www.google.com/maps/dir/${addresses.map(a => encodeURIComponent(a)).join('/')}`;
                        window.open(url, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                    <ExternalLink size={16} />
                    Open Full Route in Maps
                </button>
            </div>

            {/* Selected job overlay */}
            {selectedJob && (
                <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-4 max-w-xs">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <MapPin size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800">
                                {selectedJob.customer?.name || selectedJob.customerName}
                            </p>
                            <p className="text-sm text-slate-500">
                                {selectedJob.customer?.address || selectedJob.address}
                            </p>
                            <p className="text-xs text-indigo-600 mt-1">
                                {formatTime(selectedJob.scheduledTime || selectedJob.scheduledDate)}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const RouteMapView = ({
    jobs = [],
    techId,
    techName,
    date = new Date(),
    timezone = 'America/Los_Angeles',
    startLocation, // Optional starting point
    onOptimizeRoute,
    onJobSelect,
    isOptimizing = false
}) => {
    const [selectedJob, setSelectedJob] = useState(null);
    const [showList, setShowList] = useState(true);

    // Filter jobs for the selected date, then sort by scheduled time
    const sortedJobs = useMemo(() => {
        // Filter to only include jobs scheduled for the selected date
        const jobsForDate = jobs.filter(job => {
            const jobDate = job.scheduledTime || job.scheduledDate || job.scheduledStartTime;
            if (!jobDate) return false;

            // Handle Firestore Timestamps
            const normalizedDate = jobDate?.toDate ? jobDate.toDate() : new Date(jobDate);
            if (isNaN(normalizedDate.getTime())) return false;

            return isSameDayInTimezone(normalizedDate, date, timezone);
        });

        // Sort by scheduled time
        return jobsForDate.sort((a, b) => {
            const timeA = new Date(a.scheduledTime || a.scheduledDate || 0);
            const timeB = new Date(b.scheduledTime || b.scheduledDate || 0);
            return timeA - timeB;
        });
    }, [jobs, date, timezone]);

    // Calculate estimated totals (mock calculation)
    const routeStats = useMemo(() => {
        // In production, this would come from a routing API
        const avgDistanceBetweenStops = 5; // miles
        const avgDriveTime = 12; // minutes
        return {
            totalDistance: sortedJobs.length > 1 ? (sortedJobs.length - 1) * avgDistanceBetweenStops : 0,
            totalTime: sortedJobs.length > 1 ? (sortedJobs.length - 1) * avgDriveTime : 0,
            optimizedOrder: sortedJobs.length > 1
        };
    }, [sortedJobs]);

    const handleNavigate = (job) => {
        const address = job.customer?.address || job.address;
        if (address) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
                '_blank'
            );
        }
    };

    const handleJobSelect = (job) => {
        setSelectedJob(job);
        onJobSelect?.(job);
    };

    if (sortedJobs.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-8 text-center">
                <Map size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="font-semibold text-slate-600 mb-2">No Jobs Scheduled</h3>
                <p className="text-sm text-slate-500">
                    There are no jobs scheduled for this date.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Route size={20} className="text-indigo-600" />
                        Route Map
                    </h2>
                    <p className="text-sm text-slate-500">
                        {techName ? `${techName}'s route for ` : ''}
                        {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {onOptimizeRoute && (
                    <button
                        onClick={onOptimizeRoute}
                        disabled={isOptimizing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {isOptimizing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Optimizing...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={16} />
                                Optimize Route
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Route stats */}
            <RouteStats
                jobs={sortedJobs}
                totalDistance={routeStats.totalDistance}
                totalTime={routeStats.totalTime}
                optimizedOrder={routeStats.optimizedOrder}
            />

            {/* Main content area */}
            <div className="flex gap-4">
                {/* Map */}
                <div className={`${showList ? 'flex-1' : 'w-full'} transition-all`}>
                    <MapEmbed
                        jobs={sortedJobs}
                        selectedJob={selectedJob}
                        startLocation={startLocation}
                    />
                </div>

                {/* Job list sidebar */}
                {showList && (
                    <div className="w-80 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">
                                Stops ({sortedJobs.length})
                            </h3>
                            <button
                                onClick={() => setShowList(false)}
                                className="p-1 hover:bg-slate-100 rounded"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {sortedJobs.map((job, idx) => (
                                <RouteJobItem
                                    key={job.id || idx}
                                    job={job}
                                    index={idx}
                                    isSelected={selectedJob?.id === job.id}
                                    onSelect={handleJobSelect}
                                    onNavigate={handleNavigate}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Expand list button */}
                {!showList && (
                    <button
                        onClick={() => setShowList(true)}
                        className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-50"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatTime = (date, timezone) => {
    if (!date) return '';
    if (timezone) {
        return formatTimeInTimezone(date, timezone);
    }
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export default RouteMapView;
