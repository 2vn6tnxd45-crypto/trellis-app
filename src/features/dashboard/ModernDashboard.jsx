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

// --- CONFIG & HELPERS ---

const MAINTENANCE_FREQUENCIES = [
    { value: 'monthly', label: 'Monthly', months: 1 },
    { value: 'quarterly', label: 'Quarterly', months: 3 },
    { value: 'biannual', label: 'Every 6 months', months: 6 },
    { value: 'annual', label: 'Annually', months: 12 },
    { value: '2years', label: 'Every 2 years', months: 24 },
    { value: '5years', label: 'Every 5 years', months: 60 },
    { value: 'none', label: 'No maintenance', months: 0 },
];

// Helper: Safely parse a date
const safeDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

const getNextServiceDate = (record) => {
    if (!record?.dateInstalled || record?.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    
    try {
        const installed = safeDate(record.dateInstalled);
        if (!installed) return null;
        
        const next = new Date(installed);
        next.setMonth(next.getMonth() + freq.months);
        
        const now = new Date();
        // Project forward to next future date if overdue logic is desired, 
        // otherwise just return the calculated next date
        while (next < now) next.setMonth(next.getMonth() + freq.months);
        
        return next;
    } catch (e) {
        return null;
    }
};

const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0';
    try {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        }).format(amount);
    } catch (e) {
        return '$0';
    }
};

const getSeasonalTheme = () => {
    const month = new Date().getMonth();
    if (month === 11 || month <= 1) return { name: 'Winter', gradient: 'from-slate-900 via-blue-950 to-slate-900', accent: 'text-blue-400', icon: '❄️' };
    if (month >= 2 && month <= 4) return { name: 'Spring', gradient: 'from-emerald-900 via-teal-900 to-emerald-950', accent: 'text-emerald-400', icon: '🌱' };
    if (month >= 5 && month <= 7) return { name: 'Summer', gradient: 'from-amber-900 via-orange-900 to-amber-950', accent: 'text-amber-400', icon: '☀️' };
    return { name: 'Fall', gradient: 'from-orange-950 via-red-950 to-orange-950', accent: 'text-orange-400', icon: '🍂' };
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

// --- SUB-COMPONENTS ---

const HealthScoreCard = ({ breakdown, score }) => {
    const safeBreakdown = breakdown || { 
        maintenance: { penalty: 0 }, 
        upcoming: { penalty: 0 }, 
        coverage: { penalty: 0 } 
    };

    return (
        <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
                <h3 className="font-bold text-slate-900">Score Breakdown</h3>
                <span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{score}</span>
            </div>
            
            <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <Wrench size={16} className={safeBreakdown.maintenance.penalty > 0 ? "text-red-500" : "text-emerald-500"} />
                        <span className="font-medium text-slate-600">Maintenance</span>
                    </div>
                    <span className={`font-bold ${safeBreakdown.maintenance.penalty > 0 ? "text-red-500" : "text-emerald-600"}`}>
                        {safeBreakdown.maintenance.penalty > 0 ? `-${safeBreakdown.maintenance.penalty}` : "Good"}
                    </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className={safeBreakdown.upcoming.penalty > 0 ? "text-amber-500" : "text-slate-300"} />
                        <span className="font-medium text-slate-600">Upcoming</span>
                    </div>
                    <span className={`font-bold ${safeBreakdown.upcoming.penalty > 0 ? "text-amber-500" : "text-slate-400"}`}>
                        {safeBreakdown.upcoming.penalty > 0 ? `-${safeBreakdown.upcoming.penalty}` : "--"}
                    </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <Shield size={16} className={safeBreakdown.coverage.penalty > 0 ? "text-blue-500" : "text-emerald-500"} />
                        <span className="font-medium text-slate-600">Coverage</span>
                    </div>
                    <span className={`font-bold ${safeBreakdown.coverage.penalty > 0 ? "text-blue-500" : "text-emerald-600"}`}>
                        {safeBreakdown.coverage.penalty > 0 ? `-${safeBreakdown.coverage.penalty}` : "Max"}
                    </span>
                </div>
            </div>
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45 border-t border-l border-slate-100"></div>
        </div>
    );
};

const HealthRing = ({ score, size = 160, theme, breakdown }) => {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    // Safety check for NaN score
    const safeScore = (typeof score === 'number' && !isNaN(score)) ? Math.max(0, Math.min(100, score)) : 0;
    const strokeDashoffset = circumference - (safeScore / 100) * circumference;
    const strokeColor = safeScore >= 80 ? '#10b981' : safeScore >= 60 ? '#f59e0b' : '#ef4444';
    
    return (
        <div 
            className="relative group cursor-pointer" 
            style={{ width: size, height: size }}
            onClick={() => setShowBreakdown(!showBreakdown)}
            onMouseEnter={() => setShowBreakdown(true)}
            onMouseLeave={() => setShowBreakdown(false)}
        >
            <svg className="transform -rotate-90 transition-all duration-300 group-hover:scale-105" width={size} height={size}>
                <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="12" fill="none" className="text-white/10" />
                <circle cx={size/2} cy={size/2} r={radius} stroke={strokeColor} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 10px ${strokeColor}40)` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
                <span className="text-5xl font-black tracking-tight shadow-sm">{safeScore}</span>
                <span className={`text-xs font-bold uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${theme.accent}`}>Health <Info size={10} /></span>
            </div>
            {showBreakdown && <HealthScoreCard breakdown={breakdown} score={safeScore} />}
        </div>
    );
};

const QuickAction = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => (
    <button onClick={onClick} className={`group flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm w-full text-left ${variant === 'primary' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'}`}>
        <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 group-active:scale-95 ${variant === 'primary' ? 'bg-emerald-100' : 'bg-slate-100'}`}><Icon size={22} /></div>
        <div><p className="font-bold text-sm">{label}</p>{sublabel && <p className="text-xs opacity-70 font-medium">{sublabel}</p>}</div>
    </button>
);

const AttentionCard = ({ task, onBook, onDone }) => {
    if (!task) return null;
    const isOverdue = (task.daysUntil || 0) < 0;
    const contractorName = task.contractor ? String(task.contractor).split(' ')[0] : 'Service';
    const days = Math.abs(task.daysUntil || 0);
    
    return (
        <div className={`border rounded-2xl p-5 transition-all hover:shadow-md ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${isOverdue ? 'text-red-600 bg-red-100' : 'text-amber-600 bg-amber-100'}`}>
                    {isOverdue ? <AlertTriangle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-slate-800 mb-0.5">{task.taskName || task.item || 'Task'}</h3>
                    <p className="text-sm text-slate-600 mb-1">{task.item !== task.taskName ? task.item : ''}</p>
                    <p className={`text-xs font-bold mb-3 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                        {isOverdue ? `${days} days overdue` : `Due in ${days} days`}
                    </p>
                    
                    <div className="flex gap-2 mt-2">
                        <button 
                            onClick={() => onBook && onBook(task)}
                            className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                                isOverdue 
                                    ? 'bg-red-600 text-white hover:bg-red-700' 
                                    : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                        >
                            <Wrench size={14} className="mr-2" />
                            Book {contractorName}
                        </button>
                        
                        <button 
                            onClick={() => onDone && onDone(task)}
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

const SectionHeader = ({ title, action, actionLabel }) => (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {action && <button onClick={action} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">{actionLabel} <ChevronRight size={16} /></button>}
    </div>
);

// --- MAIN COMPONENT ---

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
    onBookService,
    onMarkTaskDone
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showFullInsights, setShowFullInsights] = useState(false);

    // --- ROBUST SCORING LOGIC (TRY-CATCH WRAPPED) ---
    const metrics = useMemo(() => {
        try {
            const now = new Date();
            let overdueCount = 0;
            let upcomingCount = 0;
            const overdueTasks = [];
            const upcomingTasks = [];
            
            // Safe array check
            const validRecords = Array.isArray(records) ? records : [];
            const totalTracked = validRecords.length;
            
            validRecords.forEach(record => {
                if (!record) return;

                // 1. GRANULAR TASKS (New Schema)
                if (Array.isArray(record.maintenanceTasks) && record.maintenanceTasks.length > 0) {
                    record.maintenanceTasks.forEach(task => {
                        if (!task || !task.nextDue) return;

                        const nextDate = safeDate(task.nextDue);
                        if (!nextDate) return;

                        const diffTime = nextDate - now;
                        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        const taskItem = {
                            id: `${record.id || 'rec'}-${task.task || 'task'}-${Math.random()}`,
                            recordId: record.id,
                            taskName: task.task || 'Maintenance',
                            item: record.item || 'Unknown Item',
                            contractor: record.contractor || '',
                            frequency: task.frequency || 'annual',
                            isGranular: true,
                            daysUntil: isNaN(daysUntil) ? 0 : daysUntil
                        };

                        if (daysUntil < 0) {
                            overdueCount++;
                            overdueTasks.push(taskItem);
                        } else if (daysUntil <= 30) {
                            upcomingCount++;
                            upcomingTasks.push(taskItem);
                        }
                    });
                } 
                // 2. LEGACY RECORDS
                else {
                    const nextDate = getNextServiceDate(record);
                    if (nextDate) {
                        const diffTime = nextDate - now;
                        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        const taskItem = {
                            id: record.id || `legacy-${Math.random()}`,
                            recordId: record.id,
                            taskName: 'Maintenance',
                            item: record.item || 'Unknown Item',
                            contractor: record.contractor || '',
                            frequency: record.maintenanceFrequency,
                            isGranular: false,
                            daysUntil: isNaN(daysUntil) ? 0 : daysUntil
                        };

                        if (daysUntil < 0) {
                            overdueCount++;
                            overdueTasks.push(taskItem);
                        } else if (daysUntil <= 30) {
                            upcomingCount++;
                            upcomingTasks.push(taskItem);
                        }
                    }
                }
            });
            
            // Calculate Score
            let coveragePenalty = 0;
            const TARGET_ITEMS = 5;
            if (totalTracked === 0) coveragePenalty = 40;
            else if (totalTracked < 3) coveragePenalty = 25;
            else if (totalTracked < TARGET_ITEMS) coveragePenalty = 10;

            const overduePenalty = Math.min(60, overdueCount * 15);
            const upcomingPenalty = Math.min(20, upcomingCount * 5);
            const rawScore = 100 - coveragePenalty - overduePenalty - upcomingPenalty;
            const score = Math.max(0, rawScore);
            
            // Calculate Spend
            const totalSpent = validRecords.reduce((sum, r) => {
                const val = parseFloat(r.cost);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);
            
            return {
                score, overdueCount, upcomingCount, totalSpent, overdueTasks, upcomingTasks,
                breakdown: {
                    coverage: { penalty: coveragePenalty, needed: Math.max(0, TARGET_ITEMS - totalTracked) },
                    maintenance: { penalty: overduePenalty, count: overdueCount },
                    upcoming: { penalty: upcomingPenalty, count: upcomingCount }
                }
            };
        } catch (error) {
            console.error("Dashboard Metrics Calculation Error:", error);
            // FAIL-SAFE RETURN
            return {
                score: 0, overdueCount: 0, upcomingCount: 0, totalSpent: 0, 
                overdueTasks: [], upcomingTasks: [],
                breakdown: {
                    coverage: { penalty: 0 },
                    maintenance: { penalty: 0 },
                    upcoming: { penalty: 0 }
                }
            };
        }
    }, [records]);

    const getScoreMessage = () => {
        if (!records || records.length === 0) return "Start adding items to build your score!";
        if (metrics.score >= 90) return "Your home is in excellent shape! 🎉";
        if (metrics.score >= 75) return "Looking good! Just a few checks needed.";
        if (metrics.score >= 50) return "Some items need your attention.";
        return "Time to catch up on maintenance.";
    };

    // Safe getters for counts
    const safeRecordsCount = Array.isArray(records) ? records.length : 0;
    const safeContractorsCount = Array.isArray(contractors) ? contractors.length : 0;

    return (
        <div className="space-y-8 pb-8">
            {/* HERO SECTION */}
            <div className="relative overflow-visible rounded-[2.5rem] shadow-xl z-20">
                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${season.gradient}`} />
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                </div>
                <div className="relative z-10 p-8 text-white">
                    <div className="flex items-start justify-between mb-8">
                        <div><p className="text-white/60 text-sm font-bold uppercase tracking-wider mb-1">{season.icon} {season.name} Season</p><h1 className="text-3xl font-bold tracking-tight">{greeting},<br/>{activeProperty?.name || 'Homeowner'}</h1></div>
                        <button onClick={onScanReceipt} className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-lg"><Camera size={24} /></button>
                    </div>
                    <div className="flex flex-col items-center py-2"><HealthRing score={metrics.score} theme={season} breakdown={metrics.breakdown} /><p className="text-white/80 text-sm mt-4 text-center font-medium max-w-[200px]">{getScoreMessage()}</p></div>
                    <div className="grid grid-cols-3 gap-3 mt-8">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{safeRecordsCount}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{safeContractorsCount}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(metrics.totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>
            
            {/* ALERTS SECTION */}
            {(metrics.overdueCount > 0 || metrics.upcomingCount > 0) && (
                <div className="space-y-4">
                    <SectionHeader title="Needs Attention" action={onNavigateToMaintenance} actionLabel="View Schedule" />
                    {metrics.overdueTasks.slice(0, 2).map((task) => (
                        <AttentionCard key={task.id} task={task} onBook={onBookService} onDone={onMarkTaskDone} />
                    ))}
                    {metrics.overdueCount === 0 && metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <AttentionCard key={task.id} task={task} onBook={onBookService} onDone={onMarkTaskDone} />
                    ))}
                </div>
            )}
            
            {/* QUICK ACTIONS */}
            <div>
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                    <QuickAction icon={Camera} label="Scan Receipt" sublabel="Auto-extract info" onClick={onScanReceipt} variant="primary" />
                    <QuickAction icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <QuickAction icon={Wrench} label="Request Pro" sublabel="Send job link" onClick={onCreateContractorLink} />
                    <QuickAction icon={FileText} label="Property Report" sublabel="For insurance/sale" onClick={onNavigateToReports} />
                </div>
            </div>

            {/* UNIFIED INSIGHTS SECTION */}
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
