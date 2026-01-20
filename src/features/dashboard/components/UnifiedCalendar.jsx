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
    ChevronLeft, ChevronRight, ChevronDown, Calendar, Wrench, RefreshCw,
    Briefcase, ClipboardList, MapPin, Clock, User, X, AlertTriangle,
    CheckCircle2, AlarmClock, CalendarClock
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
// HELPER: Format Maintenance Task Title
// ============================================
// Ensures maintenance items have descriptive names
const formatMaintenanceTitle = (task) => {
    const taskName = task.taskName || task.task || '';
    const itemName = task.item || task.recordItem || '';

    // If taskName is very short (likely just "Heat" or "Air"), enhance it
    if (taskName.length <= 5 && itemName) {
        // Combine item + task for context
        // "Heat Pump" + "Filter" → "Heat Pump - Filter"
        return `${itemName} - ${taskName}`;
    }

    // If taskName already has the item name, use as-is
    if (taskName && itemName && taskName.toLowerCase().includes(itemName.toLowerCase().split(' ')[0])) {
        return taskName;
    }

    // If we have both and they're different, combine them
    if (taskName && itemName && taskName !== itemName) {
        // Check if taskName is descriptive enough on its own
        if (taskName.split(' ').length >= 2) {
            return taskName;
        }
        return `${itemName} - ${taskName}`;
    }

    // Fallback to whatever we have
    return taskName || itemName || 'Maintenance';
};

// ============================================
// EVENT DETAIL MODAL
// ============================================
const EventDetailModal = ({
    event,
    onClose,
    onMarkDone = null,
    onSnooze = null,
    onSchedule = null,
    onBookService = null
}) => {
    const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [scheduleNotes, setScheduleNotes] = useState('');

    if (!event) return null;

    const typeConfig = EVENT_TYPES[event.type] || EVENT_TYPES.MAINTENANCE;
    const IconComponent = typeConfig.icon;

    // Only show actions for maintenance items (not jobs or recurring services)
    const isMaintenanceItem = event.type === 'MAINTENANCE' || event.type === 'MAINTENANCE_OVERDUE';
    const isOverdue = event.type === 'MAINTENANCE_OVERDUE' || event.status === 'overdue';

    // Get the task data needed for handlers
    const taskData = event.rawData || event;

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
                                event.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                event.status === 'scheduling' ? 'bg-amber-100 text-amber-700' :
                                event.status === 'slots_offered' ? 'bg-purple-100 text-purple-700' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {event.status === 'scheduling' ? 'Proposed' :
                                 event.status === 'slots_offered' ? 'Pending Confirmation' :
                                 event.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">

                    {/* Primary Actions - Only for maintenance items */}
                    {isMaintenanceItem && (
                        <div className="grid grid-cols-2 gap-2">
                            {/* Mark Complete */}
                            {onMarkDone && (
                                <button
                                    onClick={() => {
                                        onMarkDone(taskData);
                                        onClose();
                                    }}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                                >
                                    <CheckCircle2 size={16} />
                                    Done
                                </button>
                            )}

                            {/* Snooze */}
                            {onSnooze && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors"
                                    >
                                        <AlarmClock size={16} />
                                        Snooze
                                    </button>

                                    {/* Snooze Options Dropdown */}
                                    {showSnoozeMenu && (
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10">
                                            {[
                                                { days: 7, label: '1 week' },
                                                { days: 14, label: '2 weeks' },
                                                { days: 30, label: '1 month' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.days}
                                                    onClick={() => {
                                                        onSnooze(taskData, opt.days);
                                                        setShowSnoozeMenu(false);
                                                        onClose();
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Secondary Actions Row */}
                    {isMaintenanceItem && (
                        <div className="grid grid-cols-2 gap-2">
                            {/* Schedule */}
                            {onSchedule && (
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-colors"
                                >
                                    <CalendarClock size={16} />
                                    Schedule
                                </button>
                            )}

                            {/* Book a Pro */}
                            {onBookService && (
                                <button
                                    onClick={() => {
                                        onBookService(taskData);
                                        onClose();
                                    }}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-colors"
                                >
                                    <Briefcase size={16} />
                                    Book Pro
                                </button>
                            )}
                        </div>
                    )}

                    {/* Close Button - Always visible */}
                    <button
                        onClick={onClose}
                        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                            isMaintenanceItem
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                    >
                        Close
                    </button>
                </div>

                {/* Schedule Modal */}
                {showScheduleModal && (
                    <div
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
                        onClick={() => setShowScheduleModal(false)}
                    >
                        <div
                            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <CalendarClock size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Schedule Task</h3>
                                    <p className="text-xs text-slate-500">{event.title}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                        When will you do this?
                                    </label>
                                    <input
                                        type="date"
                                        value={scheduleDate}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                        Notes (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={scheduleNotes}
                                        onChange={(e) => setScheduleNotes(e.target.value)}
                                        placeholder="e.g., Contractor coming at 9am"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => setShowScheduleModal(false)}
                                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            onSchedule(taskData, scheduleDate, scheduleNotes);
                                            setShowScheduleModal(false);
                                            onClose();
                                        }}
                                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                                    >
                                        Schedule
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
    compact = false,
    // Action handlers for maintenance tasks
    onMarkTaskDone = null,
    onSnoozeTask = null,
    onScheduleTask = null,
    onBookService = null
}) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [jobs, setJobs] = useState([]);
    const [recurringServices, setRecurringServices] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showOverdueExpanded, setShowOverdueExpanded] = useState(true);

    // ============================================
    // DATA FETCHING
    // ============================================

    // Fetch scheduled jobs
    useEffect(() => {
        if (!userId) return;

        // Query jobs for this user (both as createdBy and customerId)
        // Include "scheduling" status to show jobs with proposed times
        const q1 = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where("createdBy", "==", userId),
            where("status", "in", ["scheduled", "in_progress", "slots_offered", "scheduling"])
        );

        const q2 = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where("customerId", "==", userId),
            where("status", "in", ["scheduled", "in_progress", "slots_offered", "scheduling"])
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

            // Show proposed times (from scheduling negotiation)
            if (job.proposedTimes?.length > 0 && !job.scheduledTime) {
                // Get the most recent proposal
                const latestProposal = job.proposedTimes[job.proposedTimes.length - 1];
                if (latestProposal?.date) {
                    const proposedDate = new Date(latestProposal.date);
                    const proposedBy = latestProposal.proposedBy === 'homeowner' ? 'You' : 'Contractor';
                    events.push({
                        id: `job-proposed-${job.id}`,
                        type: 'JOB',
                        title: `${job.title || 'Work'} (Proposed)`,
                        date: proposedDate,
                        time: proposedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                        contractor: job.contractorName || null,
                        description: `${proposedBy} proposed this time - awaiting response`,
                        status: 'scheduling',
                        rawData: job
                    });
                }
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
            const formattedTitle = formatMaintenanceTitle(task);
            events.push({
                id: `maintenance-${task.id}`,
                type: isOverdue ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE',
                title: formattedTitle,
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
    // OVERDUE ITEMS - ACROSS ALL MONTHS
    // ============================================
    const overdueEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return allEvents.filter(event => {
            // Only maintenance items can be overdue
            if (event.type !== 'MAINTENANCE_OVERDUE' && event.type !== 'MAINTENANCE') return false;
            if (!event.date) return false;

            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);

            return eventDate < today;
        }).sort((a, b) => {
            // Sort by how overdue (most overdue first)
            return new Date(a.date) - new Date(b.date);
        });
    }, [allEvents]);

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
        <div className="space-y-4">
            {/* ============================================ */}
            {/* OVERDUE ITEMS BANNER - Always visible */}
            {/* ============================================ */}
            {overdueEvents.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl overflow-hidden">
                    {/* Banner Header */}
                    <button
                        onClick={() => setShowOverdueExpanded(!showOverdueExpanded)}
                        className="w-full bg-red-100 px-4 py-3 border-b border-red-200 hover:bg-red-150 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-red-500 rounded-lg">
                                    <AlertTriangle size={16} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-red-800">
                                        {overdueEvents.length} Overdue Item{overdueEvents.length !== 1 ? 's' : ''}
                                    </h3>
                                    <p className="text-xs text-red-600">
                                        These maintenance tasks need attention
                                    </p>
                                </div>
                            </div>
                            <ChevronDown
                                size={18}
                                className={`text-red-600 transition-transform ${showOverdueExpanded ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>

                    {/* Expandable Content */}
                    {showOverdueExpanded && (
                        <div className="p-4 space-y-2">
                            {overdueEvents.map(event => {
                                const daysOverdue = Math.floor((new Date() - new Date(event.date)) / (1000 * 60 * 60 * 24));
                                const taskData = event.rawData || event;

                                return (
                                    <div
                                        key={event.id}
                                        className="bg-white p-3 rounded-xl border border-red-200 hover:border-red-300 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            {/* Task Info - Clickable to open modal */}
                                            <button
                                                onClick={() => setSelectedEvent(event)}
                                                className="flex items-center gap-3 text-left flex-1 min-w-0"
                                            >
                                                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                                                    <Wrench size={16} className="text-red-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-800 truncate">
                                                        {event.title}
                                                    </p>
                                                    <p className="text-xs text-red-600">
                                                        {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                                                        {event.rawData?.item && ` • ${event.rawData.item}`}
                                                    </p>
                                                </div>
                                            </button>

                                            {/* Quick Actions */}
                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                {/* Quick Complete */}
                                                {onMarkTaskDone && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onMarkTaskDone(taskData);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors"
                                                        title="Mark Done"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                )}

                                                {/* Quick Snooze (1 week) */}
                                                {onSnoozeTask && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSnoozeTask(taskData, 7);
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors"
                                                        title="Snooze 1 week"
                                                    >
                                                        <AlarmClock size={16} />
                                                    </button>
                                                )}

                                                {/* Open Detail */}
                                                <button
                                                    onClick={() => setSelectedEvent(event)}
                                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="More options"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Main Calendar */}
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
                    onMarkDone={onMarkTaskDone}
                    onSnooze={onSnoozeTask}
                    onSchedule={onScheduleTask}
                    onBookService={onBookService}
                />
            )}
            </div>
        </div>
    );
};

export default UnifiedCalendar;
