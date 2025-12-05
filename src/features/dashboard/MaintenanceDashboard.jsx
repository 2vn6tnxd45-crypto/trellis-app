// src/features/dashboard/MaintenanceDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle, Zap, Plus, CalendarCheck } from 'lucide-react';
import { STANDARD_MAINTENANCE_ITEMS, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState'; // NEW

export const MaintenanceDashboard = ({ records, onCompleteTask, onAddStandardTask }) => {
    const [tasks, setTasks] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    useEffect(() => {
        if (records) {
            // ... (Logic to calculate status remains same) ...
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

            const missing = STANDARD_MAINTENANCE_ITEMS.filter(std => {
                const hasItem = records.some(r => r.item.toLowerCase().includes(std.item.toLowerCase()));
                return !hasItem;
            });
            setSuggestions(missing);
        }
    }, [records]);

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-100">
                 <h2 className="text-2xl font-bold text-sky-900 mb-6 flex items-center">
                    <div className="bg-sky-100 p-2 rounded-lg mr-3"><Wrench className="h-6 w-6 text-sky-700" /></div> Active Schedule
                </h2>
                {tasks.length === 0 ? (
                    // NEW: Consistent Empty State
                    <EmptyState 
                        icon={CalendarCheck}
                        title="No Maintenance Scheduled"
                        description="You haven't set up any recurring maintenance tasks yet."
                        actions={
                            <button className="px-6 py-3 bg-sky-50 text-sky-700 rounded-xl font-bold border border-sky-100 hover:bg-sky-100 pointer-events-none">
                                Add Items with "Auto-Suggest"
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

            {/* Suggestions Section remains the same */}
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
