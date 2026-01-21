// src/features/tech-mobile/pages/TechSchedule.jsx
// ============================================
// TECH SCHEDULE PAGE
// ============================================
// Weekly schedule view for technicians
// Shows all jobs grouped by day

import React, { useState } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar, Loader2,
    AlertCircle, Coffee
} from 'lucide-react';
import { TechJobCard } from '../components/TechJobCard';
import { useTechJobs } from '../hooks/useTechJobs';
import { useTechSession } from '../hooks/useTechSession';

// ============================================
// WEEK NAVIGATION HELPER
// ============================================
const getWeekDates = (baseDate = new Date()) => {
    const start = new Date(baseDate);
    start.setDate(start.getDate() - start.getDay()); // Start on Sunday

    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date);
    }
    return dates;
};

const formatWeekRange = (dates) => {
    if (dates.length < 7) return '';
    const start = dates[0];
    const end = dates[6];

    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
    }
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
};

// ============================================
// DAY CARD
// ============================================
const DayCard = ({ date, jobs, isToday, onSelectJob }) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();

    return (
        <div className={`${isToday ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'} border rounded-xl overflow-hidden`}>
            {/* Day Header */}
            <div className={`px-4 py-2 flex items-center justify-between ${isToday ? 'bg-emerald-100' : 'bg-gray-50'} border-b`}>
                <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isToday ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {dayName}
                    </span>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        isToday ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                        {dayNum}
                    </span>
                </div>
                {jobs.length > 0 && (
                    <span className={`text-sm ${isToday ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Jobs */}
            <div className="p-2">
                {jobs.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-sm">
                        No jobs scheduled
                    </div>
                ) : (
                    <div className="space-y-2">
                        {jobs.map(job => (
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
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const TechSchedule = ({ onSelectJob }) => {
    const { session } = useTechSession();
    const [weekOffset, setWeekOffset] = useState(0);

    // Calculate current week dates
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + (weekOffset * 7));
    const weekDates = getWeekDates(baseDate);

    const { jobs, isLoading, error } = useTechJobs(
        session?.techId,
        session?.contractorId,
        { dateRange: 'week' }
    );

    // Group jobs by date
    const jobsByDate = {};
    weekDates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        jobsByDate[dateKey] = [];
    });

    jobs.forEach(job => {
        const jobDate = job.scheduledDateTime?.toISOString().split('T')[0];
        if (jobDate && jobsByDate[jobDate]) {
            jobsByDate[jobDate].push(job);
        }
    });

    const today = new Date().toISOString().split('T')[0];

    // ============================================
    // LOADING STATE
    // ============================================
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading schedule...</p>
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
                    <p className="text-red-600 font-medium">Error loading schedule</p>
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
            {/* Week Navigation */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>

                    <div className="text-center">
                        <p className="font-semibold text-gray-900">{formatWeekRange(weekDates)}</p>
                        {weekOffset !== 0 && (
                            <button
                                onClick={() => setWeekOffset(0)}
                                className="text-xs text-emerald-600 hover:text-emerald-700"
                            >
                                Back to this week
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Week Summary */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-emerald-800">
                            {jobs.length} jobs this week
                        </span>
                    </div>
                    <span className="text-sm text-emerald-600">
                        {jobs.filter(j => ['completed', 'completion_accepted'].includes(j.status)).length} completed
                    </span>
                </div>
            </div>

            {/* Days */}
            <div className="p-4 space-y-4">
                {weekDates.map(date => {
                    const dateKey = date.toISOString().split('T')[0];
                    const dayJobs = jobsByDate[dateKey] || [];
                    const isToday = dateKey === today;

                    return (
                        <DayCard
                            key={dateKey}
                            date={date}
                            jobs={dayJobs}
                            isToday={isToday}
                            onSelectJob={onSelectJob}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default TechSchedule;
