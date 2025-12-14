// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useMemo, useState } from 'react';
import { Zap, Calendar, CheckCircle, Clock, PlusCircle, ChevronRight, Wrench, AlertTriangle, Sparkles, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES, STANDARD_MAINTENANCE_ITEMS } from '../../config/constants';

const getNextServiceDate = (record) => {
    if (!record.dateInstalled || record.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    const installed = new Date(record.dateInstalled);
    const next = new Date(installed);
    next.setMonth(next.getMonth() + freq.months);
    while (next < new Date()) next.setMonth(next.getMonth() + freq.months);
    return next;
};

export const MaintenanceDashboard = ({ records, onAddRecord, onNavigateToRecords }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);

    const { score, breakdown, upcomingTasks, overdueTasks } = useMemo(() => {
        const now = new Date();
        const upcoming = [];
        const overdue = [];
        let healthyCount = 0;
        let totalTracked = 0;

        records.forEach(record => {
            // --- NEW: Granular Task Logic ---
            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                totalTracked++;
                let recordHasIssue = false;

                record.maintenanceTasks.forEach(task => {
                    const nextDate = new Date(task.nextDue);
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    
                    const taskItem = {
                        id: `${record.id}-${task.task}`, // Unique ID
                        item: record.item, // Parent Item Name
                        taskName: task.task, // Specific Task
                        category: record.category,
                        area: record.area,
                        nextDate: nextDate,
                        daysUntil: daysUntil,
                        isGranular: true
                    };

                    if (daysUntil < 0) {
                        overdue.push(taskItem);
                        recordHasIssue = true;
                    } else if (daysUntil <= 90) {
                        upcoming.push(taskItem);
                    }
                });
                
                if (!recordHasIssue) healthyCount++;
            } 
            // --- Fallback: Legacy Logic ---
            else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) {
                    totalTracked++;
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    const task = { 
                        ...record, 
                        taskName: 'General Maintenance', 
                        nextDate, 
                        daysUntil,
                        isGranular: false
                    };
                    
                    if (daysUntil < 0) overdue.push(task);
                    else if (daysUntil <= 90) upcoming.push(task);
                    else healthyCount++;
                }
            }
        });

        const total = totalTracked || 1;
        const overdueScore = Math.max(0, 100 - (overdue.length / total) * 100);
        const upcomingScore = Math.max(0, 100 - (upcoming.length / total) * 50);
        const coverageScore = Math.min(100, (totalTracked / Math.max(records.length, 5)) * 100);
        const finalScore = Math.round((overdueScore * 0.5) + (upcomingScore * 0.3) + (coverageScore * 0.2));

        return {
            score: finalScore,
            breakdown: { overdueScore: Math.round(overdueScore), upcomingScore: Math.round(upcomingScore), coverageScore: Math.round(coverageScore) },
            upcomingTasks: upcoming.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5),
            overdueTasks: overdue.sort((a, b) => a.daysUntil - b.daysUntil)
        };
    }, [records]);

    const suggestedItems = useMemo(() => {
        const existingItems = new Set(records.map(r => r.item.toLowerCase()));
        return STANDARD_MAINTENANCE_ITEMS.filter(item => !existingItems.has(item.item.toLowerCase()));
    }, [records]);

    const scoreColor = score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
    const ringColor = score >= 80 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-yellow-500' : 'stroke-red-500';
    
    const getScoreMessage = () => {
        if (score >= 80) return "Your home is in great shape! 🛡️";
        if (score >= 60) return "Good progress! A few items need attention.";
        if (score >= 40) return "Time to catch up on some maintenance.";
        return "Let's get your home back on track!";
    };

    if (records.length < 3) {
        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] p-8 border border-emerald-100">
                    <div className="flex items-start gap-4">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-emerald-100">
                            <TrendingUp className="h-8 w-8 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-emerald-900 mb-2">Building Your Home Profile</h2>
                            <p className="text-emerald-700 leading-relaxed">
                                Add a few more items to unlock your Home Health Score. 
                                We recommend starting with your major systems: HVAC, water heater, and roof.
                            </p>
                        </div>
                    </div>
                    
                    <div className="mt-6 bg-white rounded-xl p-4 border border-emerald-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-600">Progress</span>
                            <span className="text-sm font-bold text-emerald-600">{records.length} of 3 items</span>
                        </div>
                        <div className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (records.length / 3) * 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Add {3 - records.length} more item{3 - records.length !== 1 ? 's' : ''} to see your health score
                        </p>
                    </div>
                </div>

                {suggestedItems.length > 0 && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                            <Sparkles className="h-5 w-5 mr-2 text-amber-500" />
                            Recommended Items to Track
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {suggestedItems.slice(0, 4).map((item, i) => (
                                <button 
                                    key={i}
                                    onClick={() => {
                                        if (onAddRecord) {
                                            onAddRecord(item);
                                            toast.success(`Starting to add: ${item.item}`);
                                        }
                                    }}
                                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800">{item.item}</p>
                                        <p className="text-xs text-slate-500">{item.category}</p>
                                    </div>
                                    <PlusCircle className="h-5 w-5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Score Card */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative h-40 w-40 shrink-0">
                        <svg className="transform -rotate-90 h-40 w-40">
                            <circle cx="80" cy="80" r="70" stroke="#e2e8f0" strokeWidth="12" fill="none" />
                            <circle 
                                cx="80" 
                                cy="80" 
                                r="70" 
                                className={`${ringColor} transition-all duration-1000`}
                                strokeWidth="12" 
                                fill="none" 
                                strokeLinecap="round" 
                                strokeDasharray={`${score * 4.4} 440`} 
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-5xl font-extrabold ${scoreColor}`}>{score}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Health</span>
                        </div>
                    </div>
                    <div className="flex-grow text-center md:text-left">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Home Health Score</h2>
                        <p className="text-slate-500 mb-4">{getScoreMessage()}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="bg-slate-50 px-4 py-2 rounded-xl">
                                <span className="text-xs text-slate-400 block">On Track</span>
                                <span className="font-bold text-emerald-600">{breakdown.overdueScore}%</span>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl">
                                <span className="text-xs text-slate-400 block">Upcoming</span>
                                <span className="font-bold text-teal-600">{breakdown.upcomingScore}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overdue Section */}
            {overdueTasks.length > 0 && (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <h3 className="font-bold text-red-800 flex items-center mb-4">
                        <AlertTriangle className="h-5 w-5 mr-2" /> 
                        Overdue Maintenance ({overdueTasks.length})
                    </h3>
                    <div className="space-y-2">
                        {overdueTasks.map((task, idx) => (
                            <div 
                                key={idx} 
                                className="bg-white p-4 rounded-xl border border-red-100 flex justify-between items-center hover:shadow-sm transition-shadow cursor-pointer"
                                onClick={() => {
                                    if (onNavigateToRecords) onNavigateToRecords();
                                    toast(`Viewing: ${task.item}`, { icon: '🔧' });
                                }}
                            >
                                <div>
                                    <p className="font-bold text-slate-800">{task.taskName}</p>
                                    <p className="text-xs text-slate-500">{task.item} • {task.category}</p>
                                </div>
                                <span className="text-red-600 font-bold text-sm bg-red-100 px-3 py-1 rounded-full">
                                    {Math.abs(task.daysUntil)} days overdue
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Schedule */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center">
                        <Calendar className="h-5 w-5 mr-2 text-emerald-600" /> 
                        Upcoming Maintenance
                    </h3>
                </div>
                
                {upcomingTasks.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="inline-flex p-4 bg-emerald-50 rounded-full mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h4 className="font-bold text-slate-800 mb-1">All Clear!</h4>
                        <p className="text-slate-500 text-sm">No maintenance tasks due in the next 90 days.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {upcomingTasks.map((task, idx) => (
                            <div 
                                key={idx} 
                                className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-emerald-50 transition-colors cursor-pointer" 
                                onClick={() => {
                                    if (onNavigateToRecords) onNavigateToRecords();
                                }}
                            >
                                <div className="bg-white h-10 w-10 rounded-lg flex items-center justify-center mr-4 border border-slate-200">
                                    <Wrench className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div className="flex-grow">
                                    <p className="font-bold text-slate-800">{task.taskName}</p>
                                    <p className="text-xs text-slate-500">{task.item}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${task.daysUntil <= 7 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                        {task.daysUntil} days
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {task.nextDate.toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Suggestions */}
            {suggestedItems.length > 0 && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <button 
                        onClick={() => setShowSuggestions(!showSuggestions)} 
                        className="w-full flex justify-between items-center"
                    >
                        <h3 className="font-bold text-emerald-900 flex items-center">
                            <Sparkles className="h-5 w-5 mr-2" /> 
                            Suggested Maintenance Items
                        </h3>
                        <ChevronRight className={`h-5 w-5 text-emerald-600 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} />
                    </button>
                    
                    {showSuggestions && (
                        <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                            {suggestedItems.slice(0, 5).map((item, i) => (
                                <div 
                                    key={i} 
                                    className="bg-white p-4 rounded-xl border border-emerald-100 flex justify-between items-center"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800">{item.item}</p>
                                        <p className="text-xs text-slate-500">{item.category}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (onAddRecord) {
                                                onAddRecord(item);
                                                toast.success(`Adding: ${item.item}`);
                                            }
                                        }} 
                                        className="text-emerald-600 hover:text-emerald-700 font-bold text-sm flex items-center bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                    >
                                        <PlusCircle className="h-4 w-4 mr-1" /> Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
