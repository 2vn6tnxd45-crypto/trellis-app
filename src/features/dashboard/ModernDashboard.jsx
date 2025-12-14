// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench, Shield, CheckCircle2,
    Info, TrendingUp, ChevronDown
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

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(amount);
};

const getSeasonalTheme = () => {
    const month = new Date().getMonth();
    // Winter: Dec, Jan, Feb
    if (month === 11 || month <= 1) return { 
        name: 'Winter', 
        gradient: 'from-slate-900 via-blue-950 to-slate-900', 
        accent: 'text-blue-400',
        icon: '❄️'
    };
    // Spring: Mar, Apr, May
    if (month >= 2 && month <= 4) return { 
        name: 'Spring', 
        gradient: 'from-emerald-900 via-teal-900 to-emerald-950', 
        accent: 'text-emerald-400',
        icon: '🌱'
    };
    // Summer: Jun, Jul, Aug
    if (month >= 5 && month <= 7) return { 
        name: 'Summer', 
        gradient: 'from-amber-900 via-orange-900 to-amber-950', 
        accent: 'text-amber-400',
        icon: '☀️'
    };
    // Fall: Sep, Oct, Nov
    return { 
        name: 'Fall', 
        gradient: 'from-orange-950 via-red-950 to-orange-950', 
        accent: 'text-orange-400',
        icon: '🍂'
    };
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

// --- SUB-COMPONENTS ---

const HealthScoreCard = ({ breakdown, score, onDismiss }) => {
    return (
        <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
                <h3 className="font-bold text-slate-900">Score Breakdown</h3>
                <span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{score}</span>
            </div>
            
            <div className="space-y-3">
                {/* 1. Maintenance Health */}
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <Wrench size={16} className={breakdown.maintenance.penalty > 0 ? "text-red-500" : "text-emerald-500"} />
                        <span className="font-medium text-slate-600">Maintenance</span>
                    </div>
                    <span className={`font-bold ${breakdown.maintenance.penalty > 0 ? "text-red-500" : "text-emerald-600"}`}>
                        {breakdown.maintenance.penalty > 0 ? `-${breakdown.maintenance.penalty}` : "Good"}
                    </span>
                </div>
                {breakdown.maintenance.penalty > 0 && (
                    <p className="text-xs text-slate-400 pl-6 -mt-2">
                        {breakdown.maintenance.count} overdue item{breakdown.maintenance.count !== 1 ? 's' : ''}
                    </p>
                )}

                {/* 2. Upcoming Tasks */}
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className={breakdown.upcoming.penalty > 0 ? "text-amber-500" : "text-slate-300"} />
                        <span className="font-medium text-slate-600">Upcoming</span>
                    </div>
                    <span className={`font-bold ${breakdown.upcoming.penalty > 0 ? "text-amber-500" : "text-slate-400"}`}>
                        {breakdown.upcoming.penalty > 0 ? `-${breakdown.upcoming.penalty}` : "--"}
                    </span>
                </div>

                {/* 3. Data Coverage */}
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <Shield size={16} className={breakdown.coverage.penalty > 0 ? "text-blue-500" : "text-emerald-500"} />
                        <span className="font-medium text-slate-600">Coverage</span>
                    </div>
                    <span className={`font-bold ${breakdown.coverage.penalty > 0 ? "text-blue-500" : "text-emerald-600"}`}>
                        {breakdown.coverage.penalty > 0 ? `-${breakdown.coverage.penalty}` : "Max"}
                    </span>
                </div>
                {breakdown.coverage.penalty > 0 && (
                    <div className="bg-blue-50 p-2 rounded-lg mt-1 text-xs text-blue-700 font-medium flex items-center gap-2">
                        <TrendingUp size={12} />
                        Add {breakdown.coverage.needed} more items to boost score.
                    </div>
                )}
            </div>
            
            {/* Arrow Tip */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45 border-t border-l border-slate-100"></div>
        </div>
    );
};

const HealthRing = ({ score, size = 160, theme, breakdown }) => {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    const getColor = () => {
        if (score >= 80) return '#10b981'; // Emerald
        if (score >= 60) return '#f59e0b'; // Amber
        return '#ef4444'; // Red
    };
    
    const strokeColor = getColor();
    
    return (
        <div 
            className="relative group cursor-pointer" 
            style={{ width: size, height: size }}
            onClick={() => setShowBreakdown(!showBreakdown)}
            onMouseEnter={() => setShowBreakdown(true)}
            onMouseLeave={() => setShowBreakdown(false)}
        >
            <svg className="transform -rotate-90 transition-all duration-300 group-hover:scale-105" width={size} height={size}>
                {/* Background Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-white/10"
                />
                {/* Progress Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={strokeColor}
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                        transition: 'stroke-dashoffset 1s ease-out',
                        filter: `drop-shadow(0 0 10px ${strokeColor}40)`
                    }}
                />
            </svg>
            
            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
                <span className="text-5xl font-black tracking-tight shadow-sm">
                    {score}
                </span>
                <span className={`text-xs font-bold uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${theme.accent}`}>
                    Health <Info size={10} />
                </span>
            </div>

            {/* HOVER CARD */}
            {showBreakdown && (
                <HealthScoreCard breakdown={breakdown} score={score} />
            )}
        </div>
    );
};

const QuickAction = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => {
    const variants = {
        default: 'bg-white border-slate-200 hover:border-slate-300 text-slate-600',
        primary: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700',
    };
    
    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center gap-3 p-4 rounded-2xl border-2 
                transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
                active:translate-y-0 active:shadow-sm w-full text-left
                ${variants[variant]}
            `}
        >
            <div className={`
                p-2.5 rounded-xl transition-transform duration-200 
                group-hover:scale-110 group-active:scale-95
                ${variant === 'primary' ? 'bg-emerald-100' : 'bg-slate-100'}
            `}>
                <Icon size={22} />
            </div>
            <div>
                <p className="font-bold text-sm">{label}</p>
                {sublabel && <p className="text-xs opacity-70 font-medium">{sublabel}</p>}
            </div>
        </button>
    );
};

const AttentionCard = ({ icon: Icon, title, description, action, actionLabel, variant = 'warning' }) => {
    const styles = variant === 'danger' 
        ? { bg: 'bg-red-50', border: 'border-red-100', icon: 'text-red-600 bg-red-100', btn: 'bg-red-600 hover:bg-red-700' }
        : { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600 bg-amber-100', btn: 'bg-amber-500 hover:bg-amber-600' };

    return (
        <div className={`${styles.bg} ${styles.border} border rounded-2xl p-5 transition-all hover:shadow-md`}>
            <div className="flex items-start gap-4">
                <div className={`${styles.icon} p-3 rounded-xl shrink-0`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
                    <p className="text-sm text-slate-600 mb-3">{description}</p>
                    {action && (
                        <button onClick={action} className={`${styles.btn} text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2`}>
                            {actionLabel} <ArrowRight size={12} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const SectionHeader = ({ title, action, actionLabel }) => (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {action && (
            <button onClick={action} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">
                {actionLabel} <ChevronRight size={16} />
            </button>
        )}
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
    // NEW PROP: To navigate to the schedule
    onNavigateToMaintenance
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showFullInsights, setShowFullInsights] = useState(false);

    // --- ROBUST SCORING LOGIC UPDATED FOR TASKS ---
    const metrics = useMemo(() => {
        const now = new Date();
        let overdueCount = 0;
        let upcomingCount = 0;
        let totalTracked = records.length;
        const overdueTasks = [];
        const upcomingTasks = [];
        
        records.forEach(record => {
            // Priority 1: Check for granular tasks (AI Generated)
            if (record.maintenanceTasks && record.maintenanceTasks.length > 0) {
                record.maintenanceTasks.forEach(task => {
                    const nextDate = new Date(task.nextDue);
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    
                    const taskItem = {
                        id: `${record.id}-${task.task}`,
                        item: `${record.item} - ${task.task}`,
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
            // Priority 2: Fallback to simple date logic (Legacy)
            else {
                const nextDate = getNextServiceDate(record);
                if (nextDate) {
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    const taskItem = {
                        id: record.id,
                        item: record.item,
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
        
        // 1. Data Confidence Penalty (Encourages adding at least 5 items)
        let coveragePenalty = 0;
        const TARGET_ITEMS = 5;
        if (totalTracked === 0) coveragePenalty = 40;
        else if (totalTracked < 3) coveragePenalty = 25;
        else if (totalTracked < TARGET_ITEMS) coveragePenalty = 10;

        // 2. Maintenance Penalty (Overdue hurts a lot, Upcoming hurts a little)
        const overduePenalty = Math.min(60, overdueCount * 15);
        const upcomingPenalty = Math.min(20, upcomingCount * 5);
        
        const rawScore = 100 - coveragePenalty - overduePenalty - upcomingPenalty;
        const score = Math.max(0, rawScore);
        
        const totalSpent = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        return {
            score, 
            overdueCount, 
            upcomingCount, 
            totalSpent, 
            overdueTasks, 
            upcomingTasks,
            breakdown: {
                coverage: { 
                    penalty: coveragePenalty, 
                    needed: Math.max(0, TARGET_ITEMS - totalTracked)
                },
                maintenance: { penalty: overduePenalty, count: overdueCount },
                upcoming: { penalty: upcomingPenalty, count: upcomingCount }
            }
        };
    }, [records]);

    const getScoreMessage = () => {
        if (records.length === 0) return "Start adding items to build your score!";
        if (metrics.score >= 90) return "Your home is in excellent shape! 🎉";
        if (metrics.score >= 75) return "Looking good! Just a few checks needed.";
        if (metrics.score >= 50) return "Some items need your attention.";
        return "Time to catch up on maintenance.";
    };

    return (
        <div className="space-y-8 pb-8">
            
            {/* HERO SECTION */}
            <div className="relative overflow-visible rounded-[2.5rem] shadow-xl z-20">
                {/* Seasonal Background (clipped to rounded corners) */}
                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${season.gradient}`} />
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                </div>
                
                <div className="relative z-10 p-8 text-white">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <p className="text-white/60 text-sm font-bold uppercase tracking-wider mb-1">
                                {season.icon} {season.name} Season
                            </p>
                            <h1 className="text-3xl font-bold tracking-tight">
                                {greeting},<br/>{activeProperty?.name || 'Homeowner'}
                            </h1>
                        </div>
                        <button onClick={onScanReceipt} className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-lg">
                            <Camera size={24} />
                        </button>
                    </div>
                    
                    {/* Score Center (Interactive) */}
                    <div className="flex flex-col items-center py-2">
                        <HealthRing 
                            score={metrics.score} 
                            theme={season} 
                            breakdown={metrics.breakdown}
                        />
                        <p className="text-white/80 text-sm mt-4 text-center font-medium max-w-[200px]">
                            {getScoreMessage()}
                        </p>
                    </div>
                    
                    {/* Quick Stats Bar */}
                    <div className="grid grid-cols-3 gap-3 mt-8">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors">
                            <p className="text-2xl font-extrabold">{records.length}</p>
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p>
                        </button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors">
                            <p className="text-2xl font-extrabold">{contractors.length}</p>
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p>
                        </button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5">
                            <p className={`text-2xl font-extrabold ${season.accent}`}>
                                {formatCurrency(metrics.totalSpent).replace('$','')}
                                <span className="text-sm align-top text-white/60">$</span>
                            </p>
                            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* ALERTS SECTION - NOW WIRED TO MAINTENANCE */}
            {(metrics.overdueCount > 0 || metrics.upcomingCount > 0) && (
                <div className="space-y-4">
                    <SectionHeader title="Needs Attention" action={onNavigateToMaintenance} actionLabel="View Schedule" />
                    {metrics.overdueTasks.slice(0, 2).map((task) => (
                        <AttentionCard key={task.id} icon={AlertTriangle} title={task.item} description={`${task.daysOverdue} days overdue`} variant="danger" action={onNavigateToMaintenance} actionLabel="Fix" />
                    ))}
                    {metrics.overdueCount === 0 && metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <AttentionCard key={task.id} icon={Clock} title={task.item} description={`Due in ${task.daysUntil} days`} variant="warning" action={onNavigateToMaintenance} actionLabel="View" />
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
                
                {/* Summary Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
                    <button 
                        onClick={() => setShowFullInsights(!showFullInsights)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-50 p-3 rounded-xl">
                                <Shield className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800">Home Profile & Risks</h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {showFullInsights ? 'Tap to hide details' : 'Environmental, County & Risk Data'}
                                </p>
                            </div>
                        </div>
                        <div className={`p-2 bg-slate-100 rounded-full transition-transform duration-300 ${showFullInsights ? 'rotate-180' : ''}`}>
                            <ChevronDown size={20} className="text-slate-500" />
                        </div>
                    </button>

                    {showFullInsights && (
                        <div className="p-4 pt-0 border-t border-slate-100 mt-2 animate-in slide-in-from-top-2 fade-in">
                            <div className="space-y-8 pt-6">
                                <EnvironmentalInsights propertyProfile={activeProperty} />
                                <CountyData propertyProfile={activeProperty} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
        </div>
    );
};

export default ModernDashboard;
