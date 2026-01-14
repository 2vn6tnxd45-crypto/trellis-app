// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    Zap, Calendar, CheckCircle, Clock, PlusCircle, ChevronRight, ChevronDown,
    Wrench, AlertTriangle, Sparkles, TrendingUp, History, Archive,
    ArrowRight, Check, X, Phone, MessageCircle, Mail, User, Hourglass,
    Trash2, RotateCcw, Layers, Filter, MoreHorizontal, CalendarClock, AlarmClock,
    ChevronLeft, Grid3X3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES, STANDARD_MAINTENANCE_ITEMS } from '../../config/constants';
import { toProperCase } from '../../lib/utils';
import { TaskCompletionModal } from '../../components/common/TaskCompletionModal';

// --- HELPER FUNCTIONS ---

// Format date for timeline display
const formatTimelineDate = (date) => {
    const now = new Date();
    const d = new Date(date);
    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getNextServiceDate = (record) => {
    if (!record.dateInstalled || record.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    const installed = new Date(record.dateInstalled);
    const next = new Date(installed);
    next.setMonth(next.getMonth() + freq.months);
    const now = new Date();
    while (next < now) next.setMonth(next.getMonth() + freq.months);
    return next;
};

const cleanPhoneForLink = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
};

// --- NEW: Next 30 Days Timeline Strip ---
const TimelineStrip = ({ tasks, onTaskClick }) => {
    // Get tasks within next 30 days, sorted by date
    const timelineTasks = useMemo(() => {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return tasks
            .filter(t => {
                const taskDate = t.nextDate || (t.scheduledDate ? new Date(t.scheduledDate) : null);
                if (!taskDate) return false;
                return taskDate >= now && taskDate <= thirtyDaysFromNow;
            })
            .sort((a, b) => {
                const dateA = a.nextDate || new Date(a.scheduledDate);
                const dateB = b.nextDate || new Date(b.scheduledDate);
                return dateA - dateB;
            })
            .slice(0, 5); // Show max 5 tasks
    }, [tasks]);

    // Get overdue count
    const overdueCount = tasks.filter(t => t.daysUntil < 0).length;

    if (timelineTasks.length === 0 && overdueCount === 0) return null;

    return (
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-4 mb-6 text-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-400" />
                    <span className="text-sm font-bold">Next 30 Days</span>
                </div>
                {overdueCount > 0 && (
                    <span className="text-xs font-bold bg-red-500 px-2 py-0.5 rounded-full">
                        {overdueCount} overdue
                    </span>
                )}
            </div>

            {/* Timeline */}
            {timelineTasks.length > 0 ? (
                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-600" />

                    {/* Timeline items */}
                    <div className="flex justify-between relative">
                        {timelineTasks.map((task, index) => {
                            const isScheduled = task.scheduledDate && new Date(task.scheduledDate) > new Date();
                            const displayDate = isScheduled ? new Date(task.scheduledDate) : task.nextDate;

                            return (
                                <button
                                    key={task.id}
                                    onClick={() => onTaskClick && onTaskClick(task)}
                                    className="flex flex-col items-center group relative"
                                    style={{ flex: 1 }}
                                >
                                    {/* Dot */}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${
                                        isScheduled
                                            ? 'bg-blue-500'
                                            : task.daysUntil <= 7
                                                ? 'bg-amber-500'
                                                : 'bg-emerald-500'
                                    }`}>
                                        {isScheduled ? (
                                            <CalendarClock size={12} />
                                        ) : (
                                            <Wrench size={12} />
                                        )}
                                    </div>

                                    {/* Date label */}
                                    <span className="text-[10px] font-bold mt-1.5 text-slate-300">
                                        {formatTimelineDate(displayDate)}
                                    </span>

                                    {/* Task name (truncated) */}
                                    <span className="text-[10px] text-slate-400 truncate max-w-[60px] text-center mt-0.5 group-hover:text-white transition-colors">
                                        {task.taskName.split(' ')[0]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-2">
                    <p className="text-sm text-slate-400">No tasks in the next 30 days</p>
                </div>
            )}

            {/* Quick summary */}
            {timelineTasks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-600 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                        {timelineTasks.length} task{timelineTasks.length !== 1 ? 's' : ''} coming up
                    </span>
                    <span className="text-emerald-400 font-medium">
                        Next: {timelineTasks[0].taskName}
                    </span>
                </div>
            )}
        </div>
    );
};

// --- NEW: Month Calendar View ---
const MaintenanceCalendar = ({ tasks, onTaskClick }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Get calendar data for the current month
    const calendarData = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        // First day of month and how many days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

        // Build task map by date
        const tasksByDate = {};
        tasks.forEach(task => {
            const taskDate = task.scheduledDate
                ? new Date(task.scheduledDate)
                : task.nextDate;
            if (!taskDate) return;

            // Only include tasks for this month
            if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
                const dateKey = taskDate.getDate();
                if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
                tasksByDate[dateKey].push(task);
            }
        });

        // Build weeks array
        const weeks = [];
        let currentWeek = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            currentWeek.push(null);
        }

        // Add days of month
        for (let day = 1; day <= daysInMonth; day++) {
            currentWeek.push({
                day,
                date: new Date(year, month, day),
                tasks: tasksByDate[day] || [],
                isToday: new Date().toDateString() === new Date(year, month, day).toDateString()
            });

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        // Add empty cells for days after month ends
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
        }

        return { weeks, monthName: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }, [currentMonth, tasks]);

    const goToPrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentMonth(new Date());
    };

    const getTaskColor = (task) => {
        if (task.scheduledDate) return 'bg-blue-500'; // Scheduled
        if (task.daysUntil < 0) return 'bg-red-500'; // Overdue
        if (task.daysUntil <= 7) return 'bg-amber-500'; // Due soon
        return 'bg-emerald-500'; // Future
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <button
                    onClick={goToPrevMonth}
                    className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                    <h3 className="font-bold text-slate-800">{calendarData.monthName}</h3>
                    <button
                        onClick={goToToday}
                        className="text-xs text-emerald-600 font-medium hover:underline"
                    >
                        Today
                    </button>
                </div>
                <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {day}
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
                                className={`min-h-[70px] p-1 ${
                                    day?.isToday ? 'bg-emerald-50' : 'bg-white'
                                } ${day ? 'hover:bg-slate-50' : ''} transition-colors`}
                            >
                                {day && (
                                    <>
                                        <div className={`text-xs font-bold mb-1 ${
                                            day.isToday
                                                ? 'text-emerald-600'
                                                : day.tasks.some(t => t.daysUntil < 0)
                                                    ? 'text-red-600'
                                                    : 'text-slate-600'
                                        }`}>
                                            {day.day}
                                        </div>
                                        <div className="space-y-0.5">
                                            {day.tasks.slice(0, 3).map((task, taskIdx) => (
                                                <button
                                                    key={taskIdx}
                                                    onClick={() => onTaskClick && onTaskClick(task)}
                                                    className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-medium text-white truncate ${getTaskColor(task)} hover:opacity-80 transition-opacity`}
                                                    title={task.taskName}
                                                >
                                                    {task.taskName.split(' ')[0]}
                                                </button>
                                            ))}
                                            {day.tasks.length > 3 && (
                                                <div className="text-[10px] text-slate-400 font-medium px-1">
                                                    +{day.tasks.length - 3} more
                                                </div>
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
            <div className="flex items-center justify-center gap-4 p-3 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Overdue</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Due Soon</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Future</span>
                </div>
            </div>
        </div>
    );
};

// --- Snooze Options Menu ---
const SnoozeMenu = ({ onSnooze, onClose }) => {
    const menuRef = useRef(null);
    
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const snoozeOptions = [
        { label: '1 Week', days: 7 },
        { label: '2 Weeks', days: 14 },
        { label: '1 Month', days: 30 },
        { label: '3 Months', days: 90 },
    ];

    return (
        <div 
            ref={menuRef}
            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-150"
        >
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Snooze for</div>
            {snoozeOptions.map(opt => (
                <button
                    key={opt.days}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSnooze(opt.days);
                        onClose();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

// --- NEW: Schedule Date Picker ---
const ScheduleModal = ({ task, onSchedule, onClose }) => {
    const [selectedDate, setSelectedDate] = useState(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [notes, setNotes] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSchedule(selectedDate, notes);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
            <div 
                className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <CalendarClock size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Schedule Service</h3>
                        <p className="text-xs text-slate-500">{task.taskName}</p>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Appointment Date
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                            Notes (optional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g., Confirmed with ABC Plumbing"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                        >
                            Schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- NEW: Overflow Menu Component ---
const TaskOverflowMenu = ({ task, onDelete, onSchedule, onSnooze, onClose }) => {
    const menuRef = useRef(null);
    const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
    
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            ref={menuRef}
            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-150"
        >
            {/* Schedule Option */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onSchedule();
                    onClose();
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
                <CalendarClock size={14} className="text-blue-500" />
                Schedule
            </button>

            {/* Snooze Option */}
            <div className="relative">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowSnoozeOptions(!showSnoozeOptions);
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                    <span className="flex items-center gap-2">
                        <AlarmClock size={14} className="text-amber-500" />
                        Snooze
                    </span>
                    <ChevronRight size={14} className={`text-slate-400 transition-transform ${showSnoozeOptions ? 'rotate-90' : ''}`} />
                </button>
                
                {showSnoozeOptions && (
                    <div className="border-t border-slate-100 bg-slate-50 py-1">
                        {[
                            { label: '1 Week', days: 7 },
                            { label: '2 Weeks', days: 14 },
                            { label: '1 Month', days: 30 },
                            { label: '3 Months', days: 90 },
                        ].map(opt => (
                            <button
                                key={opt.days}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSnooze(opt.days);
                                    onClose();
                                }}
                                className="w-full text-left px-6 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-1" />

            {/* Delete Option */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    onClose();
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
            >
                <Trash2 size={14} />
                Delete Task
            </button>
        </div>
    );
};

// --- UPDATED: MaintenanceCard with new actions ---
const MaintenanceCard = ({ 
    task, 
    isOverdue, 
    onBook, 
    onComplete,
    // NEW PROPS:
    onDelete,
    onSchedule,
    onSnooze
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    
    const cleanPhone = cleanPhoneForLink(task.contractorPhone);
    const hasPhone = !!cleanPhone;
    const hasEmail = !!task.contractorEmail;
    
    // EXISTING LOGIC (unchanged): If a contractor is assigned, we NEVER show "Book Pro".
    const isAssigned = !!task.contractor;

    const formattedDate = task.nextDate 
        ? task.nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Pending';

    // Check if task is scheduled
    const isScheduled = task.scheduledDate && new Date(task.scheduledDate) > new Date();
    const scheduledDateFormatted = task.scheduledDate 
        ? new Date(task.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;

    // Check if task was snoozed
    const isSnoozed = task.snoozedUntil && new Date(task.snoozedUntil) > new Date();

    const handleDelete = () => {
        if (onDelete) {
            if (confirm(`Delete "${task.taskName}" from ${task.item}?`)) {
                onDelete(task);
            }
        }
    };

    const handleSchedule = (date, notes) => {
        if (onSchedule) {
            onSchedule(task, date, notes);
        }
    };

    const handleSnooze = (days) => {
        if (onSnooze) {
            onSnooze(task, days);
        }
    };

    return (
        <>
            <div
                id={`task-${task.id}`}
                className={`p-4 rounded-2xl border transition-all hover:shadow-sm ${
                    isScheduled
                        ? 'bg-blue-50 border-blue-100'
                        : isOverdue
                            ? 'bg-red-50 border-red-100'
                            : 'bg-white border-slate-100'
                }`}
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            isScheduled 
                                ? 'bg-white text-blue-500 shadow-sm'
                                : isOverdue 
                                    ? 'bg-white text-red-500 shadow-sm' 
                                    : 'bg-slate-50 text-emerald-600'
                        }`}>
                            {isScheduled ? <CalendarClock size={20} /> : <Wrench size={20} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm">{task.taskName}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                                <span>{task.item}</span>
                                <span>•</span>
                                <span>{toProperCase(task.frequency)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        {/* EXISTING: Overdue / Scheduled / Due date badges */}
                        {isScheduled ? (
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                📅 Scheduled {scheduledDateFormatted}
                            </span>
                        ) : isOverdue ? (
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                {Math.abs(task.daysUntil)} days overdue
                            </span>
                        ) : (
                            <span className="text-xs font-bold text-slate-600">
                                {formattedDate}
                            </span>
                        )}
                        
                        {/* Show snoozed indicator if applicable */}
                        {isSnoozed && !isScheduled && (
                            <div className="text-[10px] text-amber-600 mt-1 flex items-center justify-end gap-1">
                                <AlarmClock size={10} />
                                Snoozed
                            </div>
                        )}
                    </div>
                </div>

                {/* EXISTING: Contractor Info (unchanged) */}
                {isAssigned && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 bg-slate-50 px-2 py-1.5 rounded-lg">
                        <User size={12} />
                        <span className="font-medium">{task.contractor}</span>
                        {hasPhone && <span className="text-slate-300">•</span>}
                        {hasPhone && <span>{task.contractorPhone}</span>}
                    </div>
                )}
                
                {/* Scheduled Notes */}
                {isScheduled && task.scheduledNotes && (
                    <div className="text-xs text-blue-700 mb-3 bg-blue-100/50 px-2 py-1.5 rounded-lg">
                        {task.scheduledNotes}
                    </div>
                )}

                {/* UPDATED: Action buttons row with overflow menu */}
                <div className="flex items-center gap-2">
                    {/* EXISTING: Contractor buttons (unchanged) */}
                    {isAssigned ? (
                        <div className="flex-1 flex items-center gap-2">
                            <a 
                                href={hasPhone ? `tel:${cleanPhone}` : '#'} 
                                onClick={(e) => !hasPhone && e.preventDefault()}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 border rounded-xl text-xs font-bold transition-colors ${
                                    hasPhone 
                                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700' 
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                            >
                                <Phone size={14} /> Call
                            </a>
                            <a 
                                href={hasPhone ? `sms:${cleanPhone}` : '#'} 
                                onClick={(e) => !hasPhone && e.preventDefault()}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 border rounded-xl text-xs font-bold transition-colors ${
                                    hasPhone 
                                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700' 
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                            >
                                <MessageCircle size={14} /> Text
                            </a>
                            <a 
                                href={hasEmail ? `mailto:${task.contractorEmail}` : '#'} 
                                onClick={(e) => !hasEmail && e.preventDefault()}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 border rounded-xl text-xs font-bold transition-colors ${
                                    hasEmail 
                                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700' 
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                }`}
                            >
                                <Mail size={14} /> Email
                            </a>
                        </div>
                    ) : (
                        /* EXISTING: Book Pro button (unchanged) */
                        <button 
                            onClick={() => onBook && onBook(task)} 
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <Phone size={14} /> Book Pro
                        </button>
                    )}
                    
                    {/* NEW: Overflow Menu Button */}
                    <div className="relative">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(!showMenu);
                            }}
                            className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                        
                        {showMenu && (
                            <TaskOverflowMenu
                                task={task}
                                onDelete={handleDelete}
                                onSchedule={() => setShowScheduleModal(true)}
                                onSnooze={handleSnooze}
                                onClose={() => setShowMenu(false)}
                            />
                        )}
                    </div>
                    
                    {/* EXISTING: Mark Done button (unchanged, but only show if due within 90 days) */}
                    {task.daysUntil <= 90 && (
                        <button 
                            onClick={() => onComplete && onComplete(task)} 
                            className="flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm active:scale-95"
                        >
                            <Check size={14} /> Mark Done
                        </button>
                    )}
                </div>
            </div>
            
            {/* Schedule Modal */}
            {showScheduleModal && (
                <ScheduleModal
                    task={task}
                    onSchedule={handleSchedule}
                    onClose={() => setShowScheduleModal(false)}
                />
            )}
        </>
    );
};

// --- UPDATED: CategoryGroup passes new props ---
const CategoryGroup = ({ category, tasks, onBook, onComplete, onDelete, onSchedule, onSnooze }) => {
    const [isOpen, setIsOpen] = useState(true); // Default open for better visibility
    const overdueCount = tasks.filter(t => t.daysUntil < 0).length;
    const scheduledCount = tasks.filter(t => t.scheduledDate && new Date(t.scheduledDate) > new Date()).length;
    const hasOverdue = overdueCount > 0;

    return (
        <div className={`rounded-2xl border transition-all overflow-hidden ${hasOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 ${hasOverdue ? 'bg-red-50 text-red-900' : 'bg-slate-50 text-slate-700'} transition-colors`}
            >
                <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${hasOverdue ? 'bg-white text-red-500' : 'bg-white text-emerald-600'} shadow-sm`}>
                        {hasOverdue ? <AlertTriangle size={16} /> : <Layers size={16} />}
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-sm">{category}</h4>
                        <p className="text-[10px] font-medium opacity-70">
                            {tasks.length} tasks 
                            {hasOverdue && ` • ${overdueCount} Overdue`}
                            {scheduledCount > 0 && ` • ${scheduledCount} Scheduled`}
                        </p>
                    </div>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''} ${hasOverdue ? 'text-red-400' : 'text-slate-400'}`} />
            </button>
            
            {isOpen && (
                <div className="p-3 space-y-3 bg-slate-50/50">
                    {tasks.map(task => (
                        <MaintenanceCard 
                            key={task.id} 
                            task={task} 
                            isOverdue={task.daysUntil < 0} 
                            onBook={onBook} 
                            onComplete={onComplete}
                            onDelete={onDelete}
                            onSchedule={onSchedule}
                            onSnooze={onSnooze}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- EXISTING: HistoryItemCard (UNCHANGED) ---
const HistoryItemCard = ({ item, onDelete, onRestore }) => {
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(item);
        } else {
            console.error("HistoryItemCard: onDelete prop is missing");
            toast.error("Error: Delete function not connected");
        }
        setShowConfirm(false);
    };

    const handleRestore = (e) => {
        e.stopPropagation();
        if (onRestore) {
            onRestore(item);
        } else {
            console.error("HistoryItemCard: onRestore prop is missing");
            toast.error("Error: Restore function not connected");
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 group">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-grow min-w-0">
                <p className="font-bold text-slate-800 decoration-slate-300">{item.taskName}</p>
                <p className="text-xs text-slate-500">Completed on {new Date(item.completedDate).toLocaleDateString()}</p>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleRestore}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Restore to active tasks"
                >
                    <RotateCcw size={16} />
                </button>

                {showConfirm ? (
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={handleDelete} className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">Confirm</button>
                        <button onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors">Cancel</button>
                    </div>
                ) : (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete permanently"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT (UPDATED with title prop) ---

export const MaintenanceDashboard = ({
    records = [],
    onAddRecord,
    onNavigateToRecords,
    onBookService,
    onMarkTaskDone,
    onDeleteHistoryItem,
    onRestoreHistoryItem,
    // Task action props:
    onDeleteTask,
    onScheduleTask,
    onSnoozeTask,
    title = "Maintenance",  // Customizable title with default
    userId  // NEW: Required for photo uploads in TaskCompletionModal
}) => {
    const [viewMode, setViewMode] = useState('upcoming'); // 'upcoming' | 'calendar' | 'history'
    const [sortMode, setSortMode] = useState('timeline'); // 'timeline' | 'system'
    const [showSuggestions, setShowSuggestions] = useState(false);

    // NEW: State for task completion modal
    const [completingTask, setCompletingTask] = useState(null);

    // Handler to open completion modal
    const handleOpenCompletionModal = (task) => {
        setCompletingTask(task);
    };

    // Handler for when task is completed via modal
    const handleCompleteTask = async (task, details) => {
        if (onMarkTaskDone) {
            await onMarkTaskDone(task, details);
        }
        setCompletingTask(null);
    };
    
    // Safety check for records
    const safeRecords = Array.isArray(records) ? records : [];

    // --- EXISTING: Build contractor directory (UNCHANGED) ---
    const contractorDirectory = useMemo(() => {
        const dir = {};
        safeRecords.forEach(r => {
            if (r.contractor && (r.contractorPhone || r.contractorEmail)) {
                const key = r.contractor.trim().toLowerCase();
                if (!dir[key]) {
                    dir[key] = { phone: r.contractorPhone, email: r.contractorEmail };
                }
            }
        });
        return dir;
    }, [safeRecords]);

    // --- EXISTING: Categorize tasks (UNCHANGED except for adding new fields) ---
    const { soonTasks, futureTasks, overdueTasks, allActiveTasks, historyItems } = useMemo(() => {
        const soon = [];
        const future = [];
        const overdue = [];
        const allActive = [];
        const history = [];

        safeRecords.forEach(record => {
            // Collect history items with recordId for restore functionality
            if (record.maintenanceHistory && record.maintenanceHistory.length > 0) {
                record.maintenanceHistory.forEach(h => {
                    history.push({ ...h, recordId: record.id, item: record.item });
                });
            }

            const processTask = (taskName, freq, nextDueStr, isGranular, taskData = {}) => {
                if (freq === 'none') return;
                const nextDate = nextDueStr ? new Date(nextDueStr) : null;
                if (!nextDate) return;
                const now = new Date();
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                
                const cName = record.contractor ? record.contractor.trim().toLowerCase() : null;
                const dirEntry = cName ? contractorDirectory[cName] : null;
                
                const taskItem = {
                    id: `${record.id}-${taskName}`,
                    recordId: record.id,
                    item: record.item,
                    taskName: taskName,
                    category: record.category || "General",
                    nextDate: nextDate,
                    daysUntil: daysUntil,
                    frequency: freq,
                    isGranular: isGranular,
                    contractor: record.contractor || null,
                    contractorPhone: record.contractorPhone || dirEntry?.phone || null,
                    contractorEmail: record.contractorEmail || dirEntry?.email || null,
                    // NEW: Include scheduled and snoozed data
                    scheduledDate: taskData.scheduledDate || null,
                    scheduledNotes: taskData.scheduledNotes || null,
                    snoozedUntil: taskData.snoozedUntil || null
                };

                allActive.push(taskItem);

                if (daysUntil < 0) overdue.push(taskItem);
                else if (daysUntil <= 90) soon.push(taskItem);
                else future.push(taskItem);
            };

            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(t => processTask(
                    t.task, 
                    t.frequency, 
                    t.nextDue, 
                    true,
                    { scheduledDate: t.scheduledDate, scheduledNotes: t.scheduledNotes, snoozedUntil: t.snoozedUntil }
                ));
            } else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) processTask('General Maintenance', record.maintenanceFrequency, nextDate.toISOString(), false);
            }
        });

        const byDate = (a, b) => a.daysUntil - b.daysUntil;
        return {
            soonTasks: soon.sort(byDate),
            futureTasks: future.sort(byDate),
            overdueTasks: overdue.sort(byDate),
            allActiveTasks: allActive.sort(byDate),
            historyItems: history.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
        };
    }, [safeRecords, contractorDirectory]);

    // --- EXISTING: Group tasks by Category for "System View" (UNCHANGED) ---
    const tasksByCategory = useMemo(() => {
        const groups = {};
        allActiveTasks.forEach(task => {
            const cat = task.category || "Other";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(task);
        });
        return Object.entries(groups).sort(([catA, tasksA], [catB, tasksB]) => {
            const aHasOverdue = tasksA.some(t => t.daysUntil < 0);
            const bHasOverdue = tasksB.some(t => t.daysUntil < 0);
            if (aHasOverdue && !bHasOverdue) return -1;
            if (!aHasOverdue && bHasOverdue) return 1;
            return catA.localeCompare(catB);
        });
    }, [allActiveTasks]);

    // --- EXISTING: Suggested items (UNCHANGED) ---
    const suggestedItems = useMemo(() => {
        const existingItems = new Set(safeRecords.map(r => r.item ? r.item.toLowerCase() : ''));
        return STANDARD_MAINTENANCE_ITEMS.filter(i => !existingItems.has(i.item.toLowerCase()));
    }, [safeRecords]);

    return (
        <div className="space-y-6">
            {/* Header with View Toggle */}
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('upcoming')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        List
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Grid3X3 size={12} /> Calendar
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${viewMode === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={12} /> History
                    </button>
                </div>
            </div>

            {/* Timeline Strip (shows upcoming tasks visually) - only on list view */}
            {viewMode === 'upcoming' && allActiveTasks.length > 0 && (
                <TimelineStrip
                    tasks={allActiveTasks}
                    onTaskClick={(task) => {
                        // Scroll to the task or highlight it
                        const element = document.getElementById(`task-${task.id}`);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('ring-2', 'ring-emerald-500');
                            setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500'), 2000);
                        }
                    }}
                />
            )}

            {/* CALENDAR VIEW */}
            {viewMode === 'calendar' && (
                <MaintenanceCalendar
                    tasks={allActiveTasks}
                    onTaskClick={(task) => {
                        // Switch to list view and scroll to task
                        setViewMode('upcoming');
                        setTimeout(() => {
                            const element = document.getElementById(`task-${task.id}`);
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                element.classList.add('ring-2', 'ring-emerald-500');
                                setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500'), 2000);
                            }
                        }, 100);
                    }}
                />
            )}

            {/* LIST VIEW */}
            {viewMode === 'upcoming' ? (
                <div className="space-y-6">
                    {/* EXISTING: Sort Mode Toggle (UNCHANGED) */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setSortMode('timeline')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${sortMode === 'timeline' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Calendar size={14} /> Timeline
                        </button>
                        <button 
                            onClick={() => setSortMode('system')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${sortMode === 'system' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Layers size={14} /> By System
                        </button>
                    </div>

                    {/* TIMELINE VIEW (UPDATED to pass new props) */}
                    {sortMode === 'timeline' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {overdueTasks.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="font-bold text-red-700 flex items-center text-sm uppercase tracking-wider">
                                        <AlertTriangle className="h-4 w-4 mr-2" /> Needs Attention
                                    </h3>
                                    {overdueTasks.map(task => (
                                        <MaintenanceCard
                                            key={task.id}
                                            task={task}
                                            isOverdue
                                            onBook={onBookService}
                                            onComplete={handleOpenCompletionModal}
                                            onDelete={onDeleteTask}
                                            onSchedule={onScheduleTask}
                                            onSnooze={onSnoozeTask}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="space-y-3">
                                <h3 className="font-bold text-slate-700 flex items-center text-sm uppercase tracking-wider">
                                    <Clock className="h-4 w-4 mr-2" /> Coming Soon (90 Days)
                                </h3>
                                {soonTasks.length === 0 ? (
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                                        <p className="text-slate-400 text-sm font-medium">No tasks due in the next 3 months.</p>
                                    </div>
                                ) : (
                                    soonTasks.map(task => (
                                        <MaintenanceCard
                                            key={task.id}
                                            task={task}
                                            onBook={onBookService}
                                            onComplete={handleOpenCompletionModal}
                                            onDelete={onDeleteTask}
                                            onSchedule={onScheduleTask}
                                            onSnooze={onSnoozeTask}
                                        />
                                    ))
                                )}
                            </div>

                            {futureTasks.length > 0 && (
                                <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
                                    <h3 className="font-bold text-slate-400 flex items-center text-sm uppercase tracking-wider">
                                        <Hourglass className="h-4 w-4 mr-2" /> Future Schedule
                                    </h3>
                                    {futureTasks.map(task => (
                                        <MaintenanceCard
                                            key={task.id}
                                            task={task}
                                            onBook={onBookService}
                                            onComplete={handleOpenCompletionModal}
                                            onDelete={onDeleteTask}
                                            onSchedule={onScheduleTask}
                                            onSnooze={onSnoozeTask}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SYSTEM VIEW (UPDATED to pass new props) */}
                    {sortMode === 'system' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             {tasksByCategory.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <CheckCircle className="h-10 w-10 text-emerald-200 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No maintenance scheduled.</p>
                                </div>
                             ) : (
                                 tasksByCategory.map(([category, tasks]) => (
                                     <CategoryGroup
                                        key={category}
                                        category={category}
                                        tasks={tasks}
                                        onBook={onBookService}
                                        onComplete={handleOpenCompletionModal}
                                        onDelete={onDeleteTask}
                                        onSchedule={onScheduleTask}
                                        onSnooze={onSnoozeTask}
                                     />
                                 ))
                             )}
                        </div>
                    )}

                    {/* EXISTING: Empty State / Suggestions (UNCHANGED) */}
                    {allActiveTasks.length === 0 && (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle className="h-10 w-10 text-emerald-200 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No maintenance scheduled.</p>
                            <button onClick={() => setShowSuggestions(true)} className="text-emerald-600 font-bold text-sm mt-2 hover:underline">
                                Browse Suggestions
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* EXISTING: HISTORY VIEW (UNCHANGED) */
                <div className="space-y-4">
                     {historyItems.length === 0 ? (
                        <div className="text-center py-12">
                             <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                 <History className="h-8 w-8 text-slate-300" />
                             </div>
                             <h3 className="text-slate-800 font-bold">No History Yet</h3>
                        </div>
                     ) : (
                        <>
                            {historyItems.map((item, i) => (
                                <HistoryItemCard 
                                    key={item.id || i} 
                                    item={item} 
                                    onDelete={onDeleteHistoryItem}
                                    onRestore={onRestoreHistoryItem}
                                />
                            ))}
                        </>
                     )}
                </div>
            )}

            {/* EXISTING: Suggestions Block (UNCHANGED) */}
            {suggestedItems.length > 0 && viewMode === 'upcoming' && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mt-8">
                    <button onClick={() => setShowSuggestions(!showSuggestions)} className="w-full flex justify-between items-center">
                        <h3 className="font-bold text-emerald-900 flex items-center">
                            <Sparkles className="h-5 w-5 mr-2" /> Suggested Maintenance Items
                        </h3>
                        <ChevronRight className={`h-5 w-5 text-emerald-600 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} />
                    </button>
                    {showSuggestions && (
                        <div className="mt-4 space-y-2">
                            {suggestedItems.slice(0, 5).map((suggestion, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onAddRecord && onAddRecord(suggestion)} 
                                    className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100 hover:border-emerald-300 transition-colors text-left"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{suggestion.item}</p>
                                        <p className="text-xs text-slate-500">{suggestion.category}</p>
                                    </div>
                                    <PlusCircle className="h-5 w-5 text-emerald-500" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Task Completion Modal */}
            <TaskCompletionModal
                isOpen={!!completingTask}
                task={completingTask}
                onClose={() => setCompletingTask(null)}
                onComplete={handleCompleteTask}
                userId={userId}
            />
        </div>
    );
};

export default MaintenanceDashboard;
