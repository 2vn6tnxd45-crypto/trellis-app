// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench, Shield, CheckCircle2,
    Info, TrendingUp, ChevronDown, Check, User
} from 'lucide-react';
import { EnvironmentalInsights } from './EnvironmentalInsights';
import { CountyData } from './CountyData';

// ... (Keep existing imports and config/helpers like MAINTENANCE_FREQUENCIES, getNextServiceDate, etc.)
const MAINTENANCE_FREQUENCIES = [
    { value: 'monthly', label: 'Monthly', months: 1 },
    { value: 'quarterly', label: 'Quarterly', months: 3 },
    { value: 'biannual', label: 'Every 6 months', months: 6 },
    { value: 'annual', label: 'Annually', months: 12 },
    { value: '2years', label: 'Every 2 years', months: 24 },
    { value: '5years', label: 'Every 5 years', months: 60 },
    { value: 'none', label: 'No maintenance', months: 0 },
];

// ... (Keep getNextServiceDate, formatCurrency, getSeasonalTheme, getGreeting, HealthScoreCard, HealthRing, QuickAction)
// ... 

// UPDATED: Attention Card with Actions
const AttentionCard = ({ task, onBook, onDone }) => {
    const isOverdue = task.daysUntil < 0;
    
    return (
        <div className={`border rounded-2xl p-5 transition-all hover:shadow-md ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${isOverdue ? 'text-red-600 bg-red-100' : 'text-amber-600 bg-amber-100'}`}>
                    {isOverdue ? <AlertTriangle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-slate-800 mb-0.5">{task.taskName || task.item}</h3>
                    <p className="text-sm text-slate-600 mb-1">{task.item !== task.taskName ? task.item : ''}</p>
                    <p className={`text-xs font-bold mb-3 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                        {isOverdue ? `${Math.abs(task.daysUntil)} days overdue` : `Due in ${task.daysUntil} days`}
                    </p>
                    
                    <div className="flex gap-2 mt-2">
                        <button 
                            onClick={() => onBook(task)}
                            className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                                isOverdue 
                                    ? 'bg-red-600 text-white hover:bg-red-700' 
                                    : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                        >
                            <Wrench size={14} className="mr-2" />
                            {task.contractor ? `Book ${task.contractor.split(' ')[0]}` : 'Book Service'}
                        </button>
                        
                        <button 
                            onClick={() => onDone(task)}
                            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center"
                        >
                            <Check size={14} className="mr-1" /> Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... (Keep SectionHeader)
const SectionHeader = ({ title, action, actionLabel }) => (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {action && <button onClick={action} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">{actionLabel} <ChevronRight size={16} /></button>}
    </div>
);

export const ModernDashboard = ({
    records = [],
    contractors = [],
    activeProperty,
    onScanReceipt,
    onAddRecord,
    onNavigateToItems,
    onNavigateToContractors,
    onNavigateToReports,
    onCreateContractorLink,
    onNavigateToMaintenance,
    // NEW PROPS
    onBookService,
    onMarkTaskDone
}) => {
    // ... (Keep seasonal theme, greeting, state)
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showFullInsights, setShowFullInsights] = useState(false);

    // --- UPDATED METRICS TO INCLUDE METADATA ---
    const metrics = useMemo(() => {
        const now = new Date();
        let overdueCount = 0;
        let upcomingCount = 0;
        let totalTracked = records.length;
        const overdueTasks = [];
        const upcomingTasks = [];
        
        records.forEach(record => {
            // Priority 1: Check for granular tasks
            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(task => {
                    const nextDate = new Date(task.nextDue);
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    
                    const taskItem = {
                        id: `${record.id}-${task.task}`,
                        recordId: record.id, // Needed for updates
                        taskName: task.task,
                        item: record.item,
                        contractor: record.contractor, // Pass contractor for button label
                        frequency: task.frequency,
                        isGranular: true,
                        daysUntil
                    };

                    if (daysUntil < 0) {
                        overdueCount++;
                        overdueTasks.push({ ...taskItem, daysOverdue: Math.abs(daysUntil) });
                    } else if (daysUntil <= 30) {
                        upcomingCount++;
                        upcomingTasks.push(taskItem);
                    }
                });
            } 
            // Priority 2: Fallback logic
            else {
                // ... (Existing fallback logic from previous file)
                // ... (Keep same logic for calculating nextDate)
                const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
                if (freq && freq.months > 0 && record.dateInstalled) {
                    const installed = new Date(record.dateInstalled);
                    const nextDate = new Date(installed);
                    nextDate.setMonth(nextDate.getMonth() + freq.months);
                    while (nextDate < now) nextDate.setMonth(nextDate.getMonth() + freq.months);
                    
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    const taskItem = {
                        id: record.id,
                        recordId: record.id,
                        taskName: 'Maintenance',
                        item: record.item,
                        contractor: record.contractor,
                        frequency: record.maintenanceFrequency,
                        isGranular: false,
                        daysUntil
                    };

                    if (daysUntil < 0) {
                        overdueCount++;
                        overdueTasks.push({ ...taskItem, daysOverdue: Math.abs(daysUntil) });
                    } else if (daysUntil <= 30) {
                        upcomingCount++;
                        upcomingTasks.push(taskItem);
                    }
                }
            }
        });
        
        // ... (Keep existing score calculation)
        let coveragePenalty = 0;
        const TARGET_ITEMS = 5;
        if (totalTracked === 0) coveragePenalty = 40;
        else if (totalTracked < 3) coveragePenalty = 25;
        else if (totalTracked < TARGET_ITEMS) coveragePenalty = 10;

        const overduePenalty = Math.min(60, overdueCount * 15);
        const upcomingPenalty = Math.min(20, upcomingCount * 5);
        const rawScore = 100 - coveragePenalty - overduePenalty - upcomingPenalty;
        const score = Math.max(0, rawScore);
        const totalSpent = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        return {
            score, overdueCount, upcomingCount, totalSpent, overdueTasks, upcomingTasks,
            breakdown: {
                coverage: { penalty: coveragePenalty, needed: Math.max(0, TARGET_ITEMS - totalTracked) },
                maintenance: { penalty: overduePenalty, count: overdueCount },
                upcoming: { penalty: upcomingPenalty, count: upcomingCount }
            }
        };
    }, [records]);

    // ... (Keep getScoreMessage)
    const getScoreMessage = () => {
        if (records.length === 0) return "Start adding items to build your score!";
        if (metrics.score >= 90) return "Your home is in excellent shape! 🎉";
        if (metrics.score >= 75) return "Looking good! Just a few checks needed.";
        if (metrics.score >= 50) return "Some items need your attention.";
        return "Time to catch up on maintenance.";
    };

    return (
        <div className="space-y-8 pb-8">
            {/* ... (Keep Hero Section & Score Ring - NO CHANGES) ... */}
            {/* HERO SECTION */}
            <div className="relative overflow-visible rounded-[2.5rem] shadow-xl z-20">
                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${season.gradient}`} />
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                </div>
                <div className="relative z-10 p-8 text-white">
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <p className="text-white/60 text-sm font-bold uppercase tracking-wider mb-1">{season.icon} {season.name} Season</p>
                            <h1 className="text-3xl font-bold tracking-tight">{greeting},<br/>{activeProperty?.name || 'Homeowner'}</h1>
                        </div>
                        <button onClick={onScanReceipt} className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-lg"><Camera size={24} /></button>
                    </div>
                    <div className="flex flex-col items-center py-2"><HealthRing score={metrics.score} theme={season} breakdown={metrics.breakdown} /><p className="text-white/80 text-sm mt-4 text-center font-medium max-w-[200px]">{getScoreMessage()}</p></div>
                    <div className="grid grid-cols-3 gap-3 mt-8">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{records.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(metrics.totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>

            {/* ALERTS SECTION - UPDATED TO USE AttentionCard WITH BUTTONS */}
            {(metrics.overdueCount > 0 || metrics.upcomingCount > 0) && (
                <div className="space-y-4">
                    <SectionHeader title="Needs Attention" action={onNavigateToMaintenance} actionLabel="View Schedule" />
                    
                    {metrics.overdueTasks.slice(0, 2).map((task) => (
                        <AttentionCard 
                            key={task.id} 
                            task={task} 
                            onBook={onBookService}
                            onDone={onMarkTaskDone}
                        />
                    ))}
                    
                    {metrics.overdueCount === 0 && metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <AttentionCard 
                            key={task.id} 
                            task={task}
                            onBook={onBookService}
                            onDone={onMarkTaskDone}
                        />
                    ))}
                </div>
            )}
            
            {/* ... (Keep Quick Actions & Insights Section - NO CHANGES) ... */}
            <div>
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                    <QuickAction icon={Camera} label="Scan Receipt" sublabel="Auto-extract info" onClick={onScanReceipt} variant="primary" />
                    <QuickAction icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <QuickAction icon={Wrench} label="Request Pro" sublabel="Send job link" onClick={onCreateContractorLink} />
                    <QuickAction icon={FileText} label="Property Report" sublabel="For insurance/sale" onClick={onNavigateToReports} />
                </div>
            </div>

            <div className="space-y-4">
                <SectionHeader title="Property Intelligence" />
                <div className="bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
                    <button onClick={() => setShowFullInsights(!showFullInsights)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="flex items-center gap-4"><div className="bg-indigo-50 p-3 rounded-xl"><Shield className="h-6 w-6 text-indigo-600" /></div><div className="text-left"><h3 className="font-bold text-slate-800">Home Profile & Risks</h3><p className="text-xs text-slate-500 font-medium">{showFullInsights ? 'Tap to hide details' : 'Environmental, County & Risk Data'}</p></div></div>
                        <div className={`p-2 bg-slate-100 rounded-full transition-transform duration-300 ${showFullInsights ? 'rotate-180' : ''}`}><ChevronDown size={20} className="text-slate-500" /></div>
                    </button>
                    {showFullInsights && (
                        <div className="p-4 pt-0 border-t border-slate-100 mt-2 animate-in slide-in-from-top-2 fade-in"><div className="space-y-8 pt-6"><EnvironmentalInsights propertyProfile={activeProperty} /><CountyData propertyProfile={activeProperty} /></div></div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModernDashboard;
