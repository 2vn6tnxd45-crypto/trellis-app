// src/features/tech-mobile/pages/TechDashboard.jsx
// ============================================
// TECH MOBILE DASHBOARD
// ============================================
// Main view showing today's jobs and quick actions
// Mobile-optimized for field technicians

import React, { useState } from 'react';
import {
    Calendar, Clock, MapPin, AlertCircle, CheckCircle,
    ChevronRight, Truck, Loader2, Sun, Moon, Coffee
} from 'lucide-react';
import { TechJobCard } from '../components/TechJobCard';
import { useTechJobs } from '../hooks/useTechJobs';
import { useTechSession } from '../hooks/useTechSession';

// ============================================
// GREETING HELPER
// ============================================
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: Sun, color: 'text-amber-500' };
    if (hour < 17) return { text: 'Good afternoon', icon: Sun, color: 'text-orange-500' };
    return { text: 'Good evening', icon: Moon, color: 'text-indigo-500' };
};

// ============================================
// STATS CARD
// ============================================
const StatCard = ({ icon: Icon, label, value, subtext, color = 'emerald' }) => (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
            </div>
        </div>
        {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const TechDashboard = ({ onSelectJob }) => {
    const { session, techProfile, contractor, techName, techColor, techInitials } = useTechSession();
    const {
        jobs,
        todaysJobs,
        nextJob,
        isLoading,
        error,
        todayCount
    } = useTechJobs(session?.techId, session?.contractorId, { dateRange: 'today' });

    const greeting = getGreeting();
    const GreetingIcon = greeting.icon;

    // Calculate stats
    const completedToday = todaysJobs.filter(j =>
        ['completed', 'completion_accepted'].includes(j.status)
    ).length;
    const inProgressJob = todaysJobs.find(j => j.status === 'in_progress');
    const remainingJobs = todaysJobs.filter(j =>
        !['completed', 'completion_accepted', 'cancelled'].includes(j.status)
    ).length;

    // ============================================
    // LOADING STATE
    // ============================================
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading your schedule...</p>
                </div>
            </div>
        );
    }

    // ============================================
    // ERROR STATE
    // ============================================
    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-red-600 font-medium">Error loading jobs</p>
                    <p className="text-gray-500 text-sm mt-1">{error}</p>
                </div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 pb-24">
            {/* Welcome Section */}
            <div className="bg-gradient-to-br from-emerald-600 to-green-600 text-white p-6">
                <div className="flex items-center gap-2 mb-2">
                    <GreetingIcon className={`w-5 h-5 ${greeting.color.replace('text-', 'text-white/')}`} />
                    <span className="text-emerald-100">{greeting.text}</span>
                </div>
                <h1 className="text-2xl font-bold">{techName}</h1>
                <p className="text-emerald-100 mt-1">{contractor?.businessName}</p>
            </div>

            {/* Stats Grid */}
            <div className="px-4 -mt-4">
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 shadow-md text-center">
                        <p className="text-2xl font-bold text-emerald-600">{todayCount}</p>
                        <p className="text-xs text-gray-500">Today's Jobs</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-md text-center">
                        <p className="text-2xl font-bold text-green-600">{completedToday}</p>
                        <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-md text-center">
                        <p className="text-2xl font-bold text-blue-600">{remainingJobs}</p>
                        <p className="text-xs text-gray-500">Remaining</p>
                    </div>
                </div>
            </div>

            {/* Current/In Progress Job */}
            {inProgressJob && (
                <div className="px-4 mt-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <h2 className="font-semibold text-gray-900">In Progress</h2>
                    </div>
                    <TechJobCard
                        job={inProgressJob}
                        onSelect={onSelectJob}
                        isNext={false}
                    />
                </div>
            )}

            {/* Next Up */}
            {nextJob && !inProgressJob && (
                <div className="px-4 mt-6">
                    <h2 className="font-semibold text-gray-900 mb-3">Up Next</h2>
                    <TechJobCard
                        job={nextJob}
                        onSelect={onSelectJob}
                        isNext={true}
                    />
                </div>
            )}

            {/* Today's Schedule */}
            <div className="px-4 mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-900">Today's Schedule</h2>
                    {todayCount > 0 && (
                        <span className="text-sm text-gray-500">{todayCount} job{todayCount !== 1 ? 's' : ''}</span>
                    )}
                </div>

                {todaysJobs.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                        <Coffee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-gray-900 font-medium mb-1">No jobs today</h3>
                        <p className="text-gray-500 text-sm">Enjoy your day off!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {todaysJobs
                            .filter(job => job.id !== inProgressJob?.id && job.id !== nextJob?.id)
                            .map(job => (
                                <TechJobCard
                                    key={job.id}
                                    job={job}
                                    onSelect={onSelectJob}
                                    compact={true}
                                />
                            ))}
                    </div>
                )}
            </div>

            {/* Quick Info */}
            {techProfile && (
                <div className="px-4 mt-6 mb-8">
                    <h2 className="font-semibold text-gray-900 mb-3">Quick Info</h2>
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                        {/* Working Hours */}
                        <div className="p-4 flex items-center gap-3">
                            <Clock className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">Today's Hours</p>
                                <p className="font-medium text-gray-900">
                                    {(() => {
                                        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                        const hours = techProfile.workingHours?.[today];
                                        if (!hours?.enabled) return 'Day off';
                                        return `${hours.start} - ${hours.end}`;
                                    })()}
                                </p>
                            </div>
                        </div>

                        {/* Vehicle */}
                        {techProfile.primaryVehicleId && (
                            <div className="p-4 flex items-center gap-3">
                                <Truck className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-500">Vehicle</p>
                                    <p className="font-medium text-gray-900">
                                        {techProfile.primaryVehicleName || 'Assigned'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechDashboard;
