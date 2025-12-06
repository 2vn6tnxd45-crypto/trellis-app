// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useMemo, useState } from 'react';
import { Zap, Calendar, CheckCircle, Clock, PlusCircle, ChevronRight, Wrench, AlertTriangle, Sparkles, ListChecks } from 'lucide-react';
import { MAINTENANCE_FREQUENCIES, STANDARD_MAINTENANCE_ITEMS } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState';

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
            const nextDate = getNextServiceDate(record);
            if (nextDate) {
                totalTracked++;
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                const task = { ...record, nextDate, daysUntil };
                if (daysUntil < 0) overdue.push(task);
                else if (daysUntil <= 90) upcoming.push(task);
                else healthyCount++;
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

    return (
        <div className="space-y-8">
            {/* Score Card */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative h-40 w-40 shrink-0">
                        <svg className="transform -rotate-90 h-40 w-40">
                            <circle cx="80" cy="80" r="70" stroke="#e2e8f0" strokeWidth="12" fill="none" />
                            <circle cx="80" cy="80" r="70" className={ringColor} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={`${score * 4.4} 440`} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-5xl font-extrabold ${scoreColor}`}>{score}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Health</span>
                        </div>
                    </div>
                    <div className="flex-grow text-center md:text-left">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Home Health Score</h2>
                        <p className="text-slate-500 mb-4">Based on your maintenance tracking and schedules.</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4">
                            <div className="bg-slate-50 px-4 py-2 rounded-xl"><span className="text-xs text-slate-400 block">On Track</span><span className="font-bold text-emerald-600">{breakdown.overdueScore}%</span></div>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl"><span className="text-xs text-slate-400 block">Upcoming</span><span className="font-bold text-teal-600">{breakdown.upcomingScore}%</span></div>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl"><span className="text-xs text-slate-400 block">Coverage</span><span className="font-bold text-cyan-600">{breakdown.coverageScore}%</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overdue Section */}
            {overdueTasks.length > 0 && (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <h3 className="font-bold text-red-800 flex items-center mb-4"><AlertTriangle className="h-5 w-5 mr-2" /> Overdue Maintenance</h3>
                    <div className="space-y-2">
                        {overdueTasks.map(task => (
                            <div key={task.id} className="bg-white p-4 rounded-xl border border-red-100 flex justify-between items-center">
                                <div><p className="font-bold text-slate-800">{task.item}</p><p className="text-xs text-slate-500">{task.category} • {task.area}</p></div>
                                <span className="text-red-600 font-bold text-sm">{Math.abs(task.daysUntil)} days overdue</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Schedule */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center"><Calendar className="h-5 w-5 mr-2 text-emerald-600" /> Active Schedule</h3>
                    {upcomingTasks.length > 0 && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{upcomingTasks.length} upcoming</span>}
                </div>
                {upcomingTasks.length === 0 ? (
                    <EmptyState icon={CheckCircle} title="All Clear!" description="No maintenance tasks due in the next 90 days." />
                ) : (
                    <div className="space-y-3">
                        {upcomingTasks.map(task => (
                            <div key={task.id} className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-emerald-50 hover:border-emerald-100 transition-colors cursor-pointer" onClick={onNavigateToRecords}>
                                <div className="bg-white h-10 w-10 rounded-lg flex items-center justify-center mr-4 border border-slate-200"><Wrench className="h-5 w-5 text-emerald-600" /></div>
                                <div className="flex-grow"><p className="font-bold text-slate-800">{task.item}</p><p className="text-xs text-slate-500">{task.category}</p></div>
                                <div className="text-right"><p className="font-bold text-emerald-700">{task.daysUntil} days</p><p className="text-xs text-slate-400">{task.nextDate.toLocaleDateString()}</p></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Suggestions */}
            {suggestedItems.length > 0 && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                    <button onClick={() => setShowSuggestions(!showSuggestions)} className="w-full flex justify-between items-center">
                        <h3 className="font-bold text-emerald-900 flex items-center"><Sparkles className="h-5 w-5 mr-2" /> Suggested for Your Home</h3>
                        <ChevronRight className={`h-5 w-5 text-emerald-600 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} />
                    </button>
                    {showSuggestions && (
                        <div className="mt-4 space-y-2">
                            {suggestedItems.slice(0, 5).map((item, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                                    <div><p className="font-bold text-slate-800">{item.item}</p><p className="text-xs text-slate-500">{item.category}</p></div>
                                    <button onClick={() => onAddRecord(item)} className="text-emerald-600 hover:text-emerald-700 font-bold text-sm flex items-center"><PlusCircle className="h-4 w-4 mr-1" /> Add</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
