// src/features/dashboard/components/UnifiedCalendar.jsx
// ============================================
// UNIFIED HOME CALENDAR
// ============================================
// Aggregates all home-related events:
// - Scheduled jobs (professional work)
// - Recurring services (lawn care, pest control, etc.)
// - Maintenance tasks (DIY items)
// - Pending evaluations with scheduled dates

import React, { useState, useMemo, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Calendar, Wrench, RefreshCw,
    Briefcase, ClipboardList, MapPin, Clock, User, X
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { subscribeToCustomerRecurringServices } from '../../recurring/lib/recurringService';

// ============================================
// EVENT TYPES & COLORS
// ============================================
const EVENT_TYPES = {
    JOB: {
        id: 'job',
        label: 'Scheduled Work',
        color: 'bg-blue-500',
        textColor: 'text-blue-700',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Briefcase
    },
    RECURRING: {
        id: 'recurring',
        label: 'Recurring Service',
        color: 'bg-purple-500',
        textColor: 'text-purple-700',
        bgLight: 'bg-purple-50',
        borderColor: 'border-purple-200',
        icon: RefreshCw
    },
    MAINTENANCE: {
        id: 'maintenance',
        label: 'Maintenance',
        color: 'bg-amber-500',
        textColor: 'text-amber-700',
        bgLight: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: Wrench
    },
    MAINTENANCE_OVERDUE: {
        id: 'maintenance_overdue',
        label: 'Overdue',
        color: 'bg-red-500',
        textColor: 'text-red-700',
        bgLight: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: Wrench
    },
    EVALUATION: {
        id: 'evaluation',
        label: 'Evaluation',
        color: 'bg-indigo-500',
        textColor: 'text-indigo-700',
        bgLight: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        icon: ClipboardList
    }
};

// ============================================
// EVENT DETAIL MODAL
// ============================================
const EventDetailModal = ({ event, onClose }) => {
    if (!event) return null;

    const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.MAINTENANCE;
    const IconComponent = typeConfig.icon;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-4 ${typeConfig.bgLight} ${typeConfig.borderColor} border-b`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${typeConfig.color}`}>
                                <IconComponent size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{event.title}</h3>
                                <span className={`text-xs font-medium ${typeConfig.textColor}`}>
                                    {typeConfig.label}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    {/* Date & Time */}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar size={16} className="text-slate-400" />
                        <span>
                            {event.date.toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </span>
                    </div>

                    {event.time && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock size={16} className="text-slate-400" />
                            <span>{event.time}</span>
                        </div>
                    )}

                    {/* Contractor/Pro */}
                    {event.contractor && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <User size={16} className="text-slate-400" />
                            <span>{event.contractor}</span>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <p className="text-sm text-slate-600 pt-2 border-t border-slate-100">
                            {event.description}
                        </p>
                    )}

                    {/* Status badge for jobs */}
                    {event.status && (
                        <div className="pt-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                event.status === 'scheduled' ? 'bg-emerald-100 text-emerald-700' :
                                event.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {event.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN UNIFIED CALENDAR COMPONENT
// ============================================
export const UnifiedCalendar = ({
    userId,
    maintenanceTasks = [],
    showLegend = true,
    compact = false
}) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [jobs, setJobs] = useState([]);
    const [recurringServices, setRecurringServices] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loading, setLoading] = useState(true);

    // ============================================
    // DATA FETCHING
    // ============================================

    // Fetch scheduled jobs
    useEffect(() => {
        if (!userId) return;

        // Query jobs for this user (both as createdBy and customerId)
        const q1 = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where("createdBy", "==", userId),
            where("status", "in", ["scheduled", "in_progress", "slots_offered"])
        );

        const q2 = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where("customerId", "==", userId),
            where("status", "in", ["scheduled", "in_progress", "slots_offered"])
        );

        let results1 = [];
        let results2 = [];
        let loaded1 = false;
        let loaded2 = false;

        const mergeAndUpdate = () => {
            if (!loaded1 || !loaded2) return;

            const merged = new Map();
            [...results1, ...results2].forEach(job => {
                merged.set(job.id, job);
            });

            setJobs(Array.from(merged.values()));
            setLoading(false);
        };

        const unsub1 = onSnapshot(q1, (snapshot) => {
            results1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loaded1 = true;
            mergeAndUpdate();
        }, () => { loaded1 = true; mergeAndUpdate(); });

        const unsub2 = onSnapshot(q2, (snapshot) => {
            results2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            loaded2 = true;
            mergeAndUpdate();
        }, () => { loaded2 = true; mergeAndUpdate(); });

        return () => {
            unsub1();
            unsub2();
        };
    }, [userId]);

    // Fetch recurring services
    useEffect(() => {
        if (!userId) return;

        const unsub = subscribeToCustomerRecurringServices(userId, (services) => {
            setRecurringServices(services);
        });

        return () => unsub();
    }, [userId]);

    // ============================================
    // TRANSFORM DATA INTO CALENDAR EVENTS
    // ============================================
    const allEvents = useMemo(() => {
        const events = [];

        // Add scheduled jobs
        jobs.forEach(job => {
            if (job.scheduledTime || job.scheduledDate) {
                const jobDate = new Date(job.scheduledTime || job.scheduledDate);
                events.push({
                    id: `job-${job.id}`,
                    type: 'JOB',
                    title: job.title || job.serviceType || 'Scheduled Work',
                    date: jobDate,
                    time: jobDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                    contractor: job.contractorName || null,
                    description: job.description || null,
                    status: job.status,
                    rawData: job
                });
            }

            // Also show offered slots as pending
            if (job.scheduling?.offeredSlots?.length > 0 && !job.scheduledTime) {
                job.scheduling.offeredSlots.forEach((slot, idx) => {
                    const slotDate = new Date(slot.start || slot.date);
                    events.push({
                        id: `job-slot-${job.id}-${idx}`,
                        type: 'JOB',
                        title: `${job.title || 'Work'} (Pending)`,
                        date: slotDate,
                        time: slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                        contractor: job.contractorName || null,
                        description: 'Time slot offered - awaiting confirmation',
                        status: 'slots_offered',
                        rawData: job
                    });
                });
            }
        });

        // Add recurring services (next scheduled date)
        recurringServices.forEach(service => {
            if (service.nextScheduledDate) {
                const serviceDate = new Date(service.nextScheduledDate);
                events.push({
                    id: `recurring-${service.id}`,
                    type: 'RECURRING',
                    title: service.serviceName || 'Recurring Service',
                    date: serviceDate,
                    time: service.preferredTime || null,
                    contractor: service.contractorName || null,
                    description: `${service.frequency} service`,
                    status: service.status,
                    rawData: service
                });
            }
        });

        // Add maintenance tasks
        maintenanceTasks.forEach(task => {
            const taskDate = task.scheduledDate
                ? new Date(task.scheduledDate)
                : task.nextDate;

            if (!taskDate) return;

            const isOverdue = task.daysUntil < 0;
            events.push({
                id: `maintenance-${task.id}`,
                type: isOverdue ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE',
                title: task.taskName || task.item || 'Maintenance',
                date: taskDate,
                time: null,
                contractor: task.contractor || null,
                description: task.item ? `${task.item} - ${task.taskName}` : task.taskName,
                status: isOverdue ? 'overdue' : 'upcoming',
                rawData: task
            });
        });

        return events;
    }, [jobs, recurringServices, maintenanceTasks]);

    // ============================================
    // CALENDAR GRID CALCULATION
    // ============================================
    const calendarData = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        // Build events map by date
        const eventsByDate = {};
        allEvents.forEach(event => {
            if (!event.date) return;
            if (event.date.getFullYear() === year && event.date.getMonth() === month) {
                const dateKey = event.date.getDate();
                if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
                eventsByDate[dateKey].push(event);
            }
        });

        // Build weeks array
        const weeks = [];
        let currentWeek = [];

        for (let i = 0; i < startingDayOfWeek; i++) {
            currentWeek.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayEvents = eventsByDate[day] || [];
            // Sort events by type priority: JOB > RECURRING > MAINTENANCE
            dayEvents.sort((a, b) => {
                const priority = { JOB: 1, RECURRING: 2, MAINTENANCE_OVERDUE: 3, MAINTENANCE: 4, EVALUATION: 5 };
                return (priority[a.type] || 99) - (priority[b.type] || 99);
            });

            currentWeek.push({
                day,
                date: new Date(year, month, day),
                events: dayEvents,
                isToday: new Date().toDateString() === new Date(year, month, day).toDateString()
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        return {
            weeks,
            monthName: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
    }, [currentMonth, allEvents]);

    // ============================================
    // UPCOMING EVENTS (Next 7 days)
    // ============================================
    const upcomingEvents = useMemo(() => {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return allEvents
            .filter(e => e.date >= now && e.date <= nextWeek)
            .sort((a, b) => a.date - b.date)
            .slice(0, 5);
    }, [allEvents]);

    // ============================================
    // NAVIGATION
    // ============================================
    const goToPrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentMonth(new Date());
    };

    // ============================================
    // RENDER
    // ============================================
    const getEventColor = (event) => {
        return EVENT_TYPES[event.type]?.color || 'bg-slate-500';
    };

    const maxEventsToShow = compact ? 2 : 3;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-800 to-slate-700">
                <button
                    onClick={goToPrevMonth}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/80"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                    <h3 className="font-bold text-white">{calendarData.monthName}</h3>
                    <button
                        onClick={goToToday}
                        className="text-xs text-emerald-400 font-medium hover:underline"
                    >
                        Today
                    </button>
                </div>
                <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/80"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {compact ? day.charAt(0) : day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="divide-y divide-slate-100">
                {calendarData.weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="grid grid-cols-7 divide-x divide-slate-100">
                        {week.map((day, dayIdx) => (
                            <div
                                key={dayIdx}
                                className={`${compact ? 'min-h-[60px]' : 'min-h-[80px]'} p-1 ${
                                    day?.isToday ? 'bg-emerald-50' : 'bg-white'
                                } ${day ? 'hover:bg-slate-50 cursor-pointer' : ''} transition-colors`}
                            >
                                {day && (
                                    <>
                                        <div className={`text-xs font-bold mb-1 ${
                                            day.isToday
                                                ? 'text-emerald-600'
                                                : day.events.some(e => e.type === 'MAINTENANCE_OVERDUE')
                                                    ? 'text-red-600'
                                                    : 'text-slate-600'
                                        }`}>
                                            {day.day}
                                        </div>
                                        <div className="space-y-0.5">
                                            {day.events.slice(0, maxEventsToShow).map((event) => (
                                                <button
                                                    key={event.id}
                                                    onClick={() => setSelectedEvent(event)}
                                                    className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-medium text-white truncate ${getEventColor(event)} hover:opacity-80 transition-opacity`}
                                                    title={event.title}
                                                >
                                                    {compact ? '' : event.title.split(' ')[0]}
                                                </button>
                                            ))}
                                            {day.events.length > maxEventsToShow && (
                                                <button
                                                    onClick={() => setSelectedEvent(day.events[0])}
                                                    className="text-[10px] text-slate-500 font-medium px-1 hover:text-slate-700"
                                                >
                                                    +{day.events.length - maxEventsToShow} more
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            {showLegend && (
                <div className="flex flex-wrap items-center justify-center gap-3 p-3 bg-slate-50 border-t border-slate-200">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span>Work</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                        <span>Recurring</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span>Maintenance</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span>Overdue</span>
                    </div>
                </div>
            )}

            {/* Upcoming Events Summary */}
            {!compact && upcomingEvents.length > 0 && (
                <div className="p-4 border-t border-slate-200 bg-white">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                        Coming Up This Week
                    </h4>
                    <div className="space-y-2">
                        {upcomingEvents.map(event => {
                            const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.MAINTENANCE;
                            const IconComponent = typeConfig.icon;
                            return (
                                <button
                                    key={event.id}
                                    onClick={() => setSelectedEvent(event)}
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl ${typeConfig.bgLight} ${typeConfig.borderColor} border hover:shadow-sm transition-all text-left`}
                                >
                                    <div className={`p-1.5 rounded-lg ${typeConfig.color}`}>
                                        <IconComponent size={14} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-800 truncate">{event.title}</p>
                                        <p className="text-xs text-slate-500">
                                            {event.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            {event.time && ` • ${event.time}`}
                                        </p>
                                    </div>
                                    {event.contractor && (
                                        <span className="text-xs text-slate-400 truncate max-w-[80px]">
                                            {event.contractor}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                />
            )}
        </div>
    );
};

export default UnifiedCalendar;
