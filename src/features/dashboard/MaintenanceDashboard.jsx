// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Zap, Calendar, CheckCircle, Clock, PlusCircle, ChevronRight, 
    Wrench, AlertTriangle, Sparkles, TrendingUp, History, Archive, 
    ArrowRight, Check, X, Phone 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES, STANDARD_MAINTENANCE_ITEMS } from '../../config/constants';
import { useHomeHealth } from '../../hooks/useHomeHealth'; 

// --- HELPER FUNCTIONS ---

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

// --- SUB-COMPONENTS (Must be defined BEFORE usage) ---

const MaintenanceCard = ({ task, isOverdue, onBook, onComplete }) => {
    return (
        <div className={`p-4 rounded-2xl border ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'} transition-all`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isOverdue ? 'bg-white text-red-500' : 'bg-slate-50 text-emerald-600'}`}>
                        <Wrench size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800">{task.taskName}</h4>
                        <p className="text-xs text-slate-500 font-medium">{task.item} • {task.frequency}</p>
                    </div>
                </div>
                {isOverdue && (
                    <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-1 rounded-full">
                        {Math.abs(task.daysUntil)} DAYS OVERDUE
                    </span>
                )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                    onClick={() => onBook && onBook(task)}
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <Phone size={14} /> Book Pro
                </button>
                <button 
                    onClick={() => onComplete && onComplete(task)}
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm"
                >
                    <Check size={14} /> Mark Done
                </button>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const MaintenanceDashboard = ({ records = [], onAddRecord, onNavigateToRecords, onBookService, onMarkTaskDone }) => {
    const [viewMode, setViewMode] = useState('upcoming'); // 'upcoming' | 'history'
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    // Shared Logic
    const healthData = useHomeHealth(records) || { score: 0, breakdown: { profile: 0, maintenance: 0 } };
    const { score, breakdown } = healthData;

    // Process Tasks
    const { upcomingTasks, overdueTasks, historyItems } = useMemo(() => {
        const now = new Date();
        const upcoming = [];
        const overdue = [];
        const history = [];

        if (!records) return { upcomingTasks: [], overdueTasks: [], historyItems: [] };

        records.forEach(record => {
            // 1. Collect History
            if (record.maintenanceHistory && Array.isArray(record.maintenanceHistory)) {
                record.maintenanceHistory.forEach(h => {
                    history.push({
                        ...h,
                        item: record.item,
                        recordId: record.id
                    });
                });
            }

            // 2. Collect Active Tasks
            const processTask = (taskName, freq, nextDateStr, isGranular) => {
                if (!nextDateStr || freq === 'none') return;
                const nextDate = new Date(nextDateStr);
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                
                const taskItem = {
                    id: `${record.id}-${taskName}`,
                    recordId: record.id,
                    item: record.item,
                    taskName: taskName,
                    category: record.category,
                    nextDate: nextDate,
                    daysUntil: daysUntil,
                    frequency: freq,
                    isGranular: isGranular,
                    contractor: record.contractor
                };

                if (daysUntil < 0) overdue.push(taskItem);
                else upcoming.push(taskItem);
            };

            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(t => processTask(t.task, t.frequency, t.nextDue, true));
            } else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) processTask('General Maintenance', record.maintenanceFrequency, nextDate.toISOString(), false);
            }
        });

        // Sort
        return {
            upcomingTasks: upcoming.sort((a, b) => a.daysUntil - b.daysUntil),
            overdueTasks: overdue.sort((a, b) => a.daysUntil - b.daysUntil),
            historyItems: history.sort((a, b) => {
                const dateA = new Date(a.completedDate);
                const dateB = new Date(b.completedDate);
                // Handle invalid dates safely
                if (isNaN(dateA)) return 1;
                if (isNaN(dateB)) return -1;
                return dateB - dateA;
            })
        };
    }, [records]);

    const suggestedItems = useMemo(() => {
        if (!records) return [];
        const existingItems = new Set(records.map(r => r.item ? r.item.toLowerCase() : ''));
        return STANDARD_MAINTENANCE_ITEMS.filter(item => !existingItems.has(item.item.toLowerCase()));
    }, [records]);

    // Helpers
    const getScoreColor = (s) => s >= 80 ? 'text-emerald-500' : s >= 50 ? 'text-amber-500' : 'text-red-500';
    const getScoreRing = (s) => s >= 80 ? 'stroke-emerald-500' : s >= 50 ? 'stroke-amber-500' : 'stroke-red-500';

    return (
        <div className="space-y-6 pb-12">
            {/* Header / Score Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8">
                 <div className="relative h-32 w-32 shrink-0">
                    <svg className="transform -rotate-90 h-32 w-32">
                        <circle cx="64" cy="64" r="56" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                        <circle cx="64" cy="64" r="56" className={`${getScoreRing(score)} transition-all duration-1000`} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${score * 3.5} 351`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-black ${getScoreColor(score)}`}>{score}</span>
                    </div>
                </div>
                <div className="text-center md:text-left flex-grow">
                    <h2 className="text-xl font-bold text-slate-800">Maintenance Score</h2>
                    <p className="text-slate-500 text-sm mb-4">
                        {score >= 80 ? "Excellent work! Your home is well-maintained." : "Keep up the maintenance to improve your score."}
                    </p>
                    <div className="flex gap-2 justify-center md:justify-start">
                        <div className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">
                            🛡️ {breakdown?.profile || 0}/50 Profile
                        </div>
                        <div className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">
                            🔧 {breakdown?.maintenance || 0}/50 Tasks
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
                <button 
                    onClick={() => setViewMode('upcoming')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                >
                    Upcoming & Due
                </button>
                <button 
                    onClick={() => setViewMode('history')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                >
                    Completed History
                </button>
            </div>

            {/* CONTENT AREA */}
            {viewMode === 'upcoming' ? (
                <div className="space-y-6">
                    {/* Overdue */}
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
                                    onComplete={onMarkTaskDone}
                                />
                            ))}
                        </div>
                    )}

                    {/* Upcoming */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-500 flex items-center text-sm uppercase tracking-wider">
                            <Calendar className="h-4 w-4 mr-2" /> Upcoming
                        </h3>
                        {upcomingTasks.length === 0 && overdueTasks.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <CheckCircle className="h-10 w-10 text-emerald-200 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No pending maintenance.</p>
                                <button onClick={() => setShowSuggestions(true)} className="text-emerald-600 font-bold text-sm mt-2 hover:underline">Browse Suggestions</button>
                            </div>
                        ) : (
                            upcomingTasks.map(task => (
                                <MaintenanceCard 
                                    key={task.id} 
                                    task={task} 
                                    onBook={onBookService} 
                                    onComplete={onMarkTaskDone}
                                />
                            ))
                        )}
                    </div>
                </div>
            ) : (
                /* HISTORY VIEW */
                <div className="space-y-4">
                     {historyItems.length === 0 ? (
                        <div className="text-center py-12">
                             <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <History className="h-8 w-8 text-slate-300" />
                             </div>
                             <h3 className="text-slate-800 font-bold">No History Yet</h3>
                             <p className="text-slate-500 text-sm">Completed tasks will appear here.</p>
                        </div>
                     ) : (
                        historyItems.map((item, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4 opacity-75 hover:opacity-100 transition-opacity">
                                <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                    <Check className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 decoration-slate-300">{item.taskName}</p>
                                    <p className="text-xs text-slate-500">
                                        Completed on {new Date(item.completedDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))
                     )}
                </div>
            )}

             {/* Suggestions */}
            {suggestedItems.length > 0 && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mt-8">
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
