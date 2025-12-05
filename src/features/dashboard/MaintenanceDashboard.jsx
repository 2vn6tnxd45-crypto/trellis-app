// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle, Zap, Plus, CalendarCheck, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { STANDARD_MAINTENANCE_ITEMS, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState';

// Sub-component for the Score Ring
const ScoreRing = ({ score, label, color }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    return (
        <div className="flex flex-col items-center">
            <div className="relative h-20 w-20">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                    <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`transition-all duration-1000 ${color}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-700">{Math.round(score)}%</span>
                </div>
            </div>
            <span className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wide">{label}</span>
        </div>
    );
};

export const MaintenanceDashboard = ({ records, onCompleteTask, onAddStandardTask }) => {
    const [tasks, setTasks] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [healthStats, setHealthStats] = useState({ overall: 0, adherence: 0, coverage: 0, dataDepth: 0 });

    useEffect(() => {
        if (records) {
            // 1. Calculate Tasks & Status
            const maintenanceTasks = records
                .filter(r => r.maintenanceFrequency && r.maintenanceFrequency !== 'none' && r.nextServiceDate)
                .map(r => {
                    const today = new Date();
                    const serviceDate = new Date(r.nextServiceDate);
                    const timeDiff = serviceDate.getTime() - today.getTime();
                    const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    let status = 'upcoming';
                    if (daysUntil < 0) status = 'overdue';
                    else if (daysUntil <= 30) status = 'due-soon';
                    return { ...r, daysUntil, status };
                })
                .sort((a, b) => a.daysUntil - b.daysUntil);
            
            setTasks(maintenanceTasks);

            // 2. Identify Missing Standard Items
            const missing = STANDARD_MAINTENANCE_ITEMS.filter(std => {
                const hasItem = records.some(r => r.item.toLowerCase().includes(std.item.toLowerCase()));
                return !hasItem;
            });
            setSuggestions(missing);

            // 3. Calculate Health Score
            const totalRecords = records.length;
            if (totalRecords === 0) {
                setHealthStats({ overall: 0, adherence: 0, coverage: 0, dataDepth: 0 });
                return;
            }

            // A. Adherence (Are tasks overdue?)
            const overdueCount = maintenanceTasks.filter(t => t.status === 'overdue').length;
            const adherenceScore = maintenanceTasks.length > 0 
                ? Math.max(0, 100 - (overdueCount / maintenanceTasks.length * 100)) 
                : 100; // No tasks = 100% adherence (technically)

            // B. Coverage (% of items with a schedule)
            const withSchedule = records.filter(r => r.maintenanceFrequency && r.maintenanceFrequency !== 'none').length;
            const coverageScore = (withSchedule / totalRecords) * 100;

            // C. Data Depth (% of items with Brand & Model for Recall checks)
            const withData = records.filter(r => r.brand && r.model).length;
            const dataDepthScore = (withData / totalRecords) * 100;

            // Overall Weighted Score
            // Adherence is most important (40%), then Coverage (30%), then Data (30%)
            const overall = (adherenceScore * 0.4) + (coverageScore * 0.3) + (dataDepthScore * 0.3);

            setHealthStats({
                overall: Math.round(overall),
                adherence: Math.round(adherenceScore),
                coverage: Math.round(coverageScore),
                dataDepth: Math.round(dataDepthScore)
            });
        }
    }, [records]);

    return (
        <div className="space-y-8">
            
            {/* NEW: Home Health Score Card */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Activity className="h-32 w-32 text-sky-900" />
                </div>
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="text-center md:text-left">
                        <h2 className="text-2xl font-bold text-sky-900 mb-2 flex items-center justify-center md:justify-start">
                            <Activity className="h-6 w-6 mr-3 text-sky-600"/> Home Health Score
                        </h2>
                        <p className="text-slate-500 max-w-sm">
                            Keep your home in peak condition by adding details, setting schedules, and completing tasks on time.
                        </p>
                        {healthStats.overall < 50 && (
                            <div className="mt-4 inline-flex items-center px-4 py-2 bg-red-50 text-red-700 text-sm font-bold rounded-xl border border-red-100">
                                <AlertTriangle className="h-4 w-4 mr-2"/> Needs Attention
                            </div>
                        )}
                        {healthStats.overall >= 80 && (
                            <div className="mt-4 inline-flex items-center px-4 py-2 bg-green-50 text-green-700 text-sm font-bold rounded-xl border border-green-100">
                                <TrendingUp className="h-4 w-4 mr-2"/> Excellent Condition
                            </div>
                        )}
                    </div>

                    <div className="flex gap-6 sm:gap-10">
                        <ScoreRing score={healthStats.adherence} label="On Time" color="text-emerald-500" />
                        <ScoreRing score={healthStats.coverage} label="Protected" color="text-sky-500" />
                        <ScoreRing score={healthStats.dataDepth} label="Verified" color="text-indigo-500" />
                    </div>
                    
                    <div className="hidden md:block h-24 w-px bg-slate-100"></div>

                    <div className="text-center min-w-[100px]">
                        <span className="text-5xl font-extrabold text-slate-800">{healthStats.overall}</span>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Score</p>
                    </div>
                </div>
            </div>

            {/* Active Schedule */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-100">
                 <h2 className="text-2xl font-bold text-sky-900 mb-6 flex items-center">
                    <div className="bg-sky-100 p-2 rounded-lg mr-3"><Wrench className="h-6 w-6 text-sky-700" /></div> Active Schedule
                </h2>
                {tasks.length === 0 ? (
                    <EmptyState 
                        icon={CalendarCheck}
                        title="No Maintenance Scheduled"
                        description="You haven't set up any recurring maintenance tasks yet."
                        actions={
                            <button className="px-6 py-3 bg-sky-50 text-sky-700 rounded-xl font-bold border border-sky-100 hover:bg-sky-100 pointer-events-none">
                                Check Suggestions Below
                            </button>
                        }
                    />
                ) : (
                    <div className="grid gap-4">
                        {tasks.map(task => (
                            <div key={task.id} className={`p-5 rounded-2xl border-l-4 shadow-sm bg-white flex flex-col md:flex-row justify-between items-start md:items-center transition-all hover:shadow-md ${
                                task.status === 'overdue' ? 'border-red-500 bg-red-50/30' : 
                                task.status === 'due-soon' ? 'border-yellow-500 bg-yellow-50/30' : 
                                'border-green-500'
                            }`}>
                                <div className="mb-3 md:mb-0">
                                    <h4 className="font-bold text-slate-800 text-lg">{task.item}</h4>
                                    <p className="text-sm text-slate-500 font-medium">{task.category} • {MAINTENANCE_FREQUENCIES.find(f => f.value === task.maintenanceFrequency)?.label}</p>
                                    <p className={`text-sm font-bold mt-1 ${task.status === 'overdue' ? 'text-red-600' : task.status === 'due-soon' ? 'text-yellow-600' : 'text-green-600'}`}>
                                        {task.status === 'overdue' ? `Overdue by ${Math.abs(task.daysUntil)} days` : `Due in ${task.daysUntil} days`}
                                    </p>
                                </div>
                                <button onClick={() => onCompleteTask(task)} className="px-5 py-2.5 bg-white border border-sky-200 text-sky-700 rounded-xl shadow-sm hover:bg-sky-50 hover:border-sky-300 transition font-bold flex items-center text-sm">
                                    <CheckCircle size={18} className="mr-2 text-green-500"/> Mark Complete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Suggestions Section */}
            {suggestions.length > 0 && (
                <div className="bg-sky-50 p-8 rounded-[2rem] border border-sky-100">
                    <h3 className="text-xl font-bold text-sky-900 mb-2 flex items-center"><Zap className="mr-2 h-6 w-6 text-sky-600"/> Suggested Maintenance</h3>
                    <p className="text-sm text-sky-700/70 mb-6 font-medium">Based on standard home care, you might be missing these items.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {suggestions.map((suggestion, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-sky-100 shadow-sm flex justify-between items-center hover:border-sky-300 transition-colors group">
                                <div><p className="font-bold text-slate-800 text-sm group-hover:text-sky-900">{suggestion.item}</p><p className="text-xs text-slate-400 font-medium">{suggestion.category}</p></div>
                                <button onClick={() => onAddStandardTask(suggestion)} className="p-2 bg-sky-100 text-sky-700 rounded-full hover:bg-sky-600 hover:text-white transition shadow-sm"><Plus size={18} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
