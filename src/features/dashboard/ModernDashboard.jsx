// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench, Shield, CheckCircle2,
    Info, TrendingUp, ChevronDown, Check, User,
    Calendar, Phone, Mail, MessageCircle, Link as LinkIcon,
    X, ExternalLink
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

const cleanPhoneForLink = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '');
};

// --- NEW COMPONENT: Task Action Modal ---
// This is the robust alternative way to clear records.
const TaskActionModal = ({ task, onClose, onMarkDone, onBook, onNavigateToContractors }) => {
    if (!task) return null;

    const isOverdue = (task.daysUntil || 0) < 0;
    const days = Math.abs(task.daysUntil || 0);
    const hasContractor = !!task.contractor;
    const hasPhone = !!task.contractorPhone;
    const cleanPhone = cleanPhoneForLink(task.contractorPhone);

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                {/* Header */}
                <div className={`p-6 ${isOverdue ? 'bg-red-50' : 'bg-emerald-50'} border-b ${isOverdue ? 'border-red-100' : 'border-emerald-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-3 rounded-2xl ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {isOverdue ? <AlertTriangle size={24} /> : <Clock size={24} />}
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/50 hover:bg-white rounded-full transition-colors">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{task.taskName}</h3>
                    <p className={`text-sm font-bold mt-1 ${isOverdue ? 'text-red-600' : 'text-emerald-700'}`}>
                        {isOverdue ? `${days} days overdue` : `Due in ${days} days`}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">Item: {task.item}</p>
                </div>

                {/* Body - Contractor Actions */}
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Professional Help</h4>
                        
                        {hasContractor ? (
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="font-bold text-slate-800 text-sm mb-1">{task.contractor}</p>
                                <p className="text-xs text-slate-500 mb-3">Linked Service Provider</p>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    {hasPhone ? (
                                        <>
                                            <a href={`tel:${cleanPhone}`} className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors">
                                                <Phone size={14} /> Call
                                            </a>
                                            <a href={`sms:${cleanPhone}`} className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                                                <MessageCircle size={14} /> Text
                                            </a>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => { onBook(task); onClose(); }}
                                            className="col-span-2 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                                        >
                                            <LinkIcon size={14} /> Create Request Link
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => { onNavigateToContractors(); onClose(); }}
                                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-bold hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all flex items-center justify-center gap-2"
                            >
                                <User size={18} /> Find or Link a Pro
                            </button>
                        )}
                    </div>

                    {/* Main Action - Mark Done */}
                    <button 
                        onClick={() => {
                            onMarkDone(task);
                            onClose();
                        }}
                        className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                    >
                        <CheckCircle2 size={24} className="text-emerald-400" />
                        Mark as Complete
                    </button>
                </div>
            </div>
        </div>
    );
};

const HealthScoreCard = ({ breakdown, score }) => (
    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
            <h3 className="font-bold text-slate-900">Score Breakdown</h3>
            <span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{score}</span>
        </div>
        <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Wrench size={16} className="text-slate-400" /> <span className="text-slate-600">Maintenance</span></div>
                <span className={`font-bold ${breakdown.maintenance.penalty > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{breakdown.maintenance.penalty > 0 ? `-${breakdown.maintenance.penalty}` : 'OK'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Package size={16} className="text-slate-400" /> <span className="text-slate-600">Coverage</span></div>
                <span className={`font-bold ${breakdown.coverage.penalty > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{breakdown.coverage.penalty > 0 ? `-${breakdown.coverage.penalty}` : 'OK'}</span>
            </div>
        </div>
    </div>
);

const HealthRing = ({ score, theme, breakdown }) => {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const size = 150, strokeWidth = 12, radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const safeScore = Math.max(0, Math.min(100, score || 0));
    const strokeDashoffset = circumference - (safeScore / 100) * circumference;
    const strokeColor = safeScore >= 80 ? '#10b981' : safeScore >= 60 ? '#f59e0b' : '#ef4444';
    
    return (
        <div className="relative group cursor-pointer" style={{ width: size, height: size }} onClick={() => setShowBreakdown(!showBreakdown)}>
            <svg className="transform -rotate-90 transition-all duration-300 group-hover:scale-105" width={size} height={size}>
                <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth="12" fill="none" className="text-white/10" />
                <circle cx={size/2} cy={size/2} r={radius} stroke={strokeColor} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
                <span className="text-5xl font-black tracking-tight">{safeScore}</span>
                <span className={`text-xs font-bold uppercase tracking-widest mt-1 opacity-80 ${theme.accent}`}>Health</span>
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

const SmartContactActions = ({ task, onBook, onDone, isOverdue }) => {
    const hasPhone = !!task.contractorPhone;
    const hasEmail = !!task.contractorEmail;
    const cleanPhone = cleanPhoneForLink(task.contractorPhone);
    const showRequestFallback = !hasPhone && !hasEmail;

    // Use standard onClick, rely on wrapping div to prevent modal open
    const buttonBaseStyle = "touch-action-manipulation select-none cursor-pointer";

    return (
        <div className="flex items-center gap-2 mt-3 sm:mt-0 sm:ml-auto flex-wrap">
            {hasPhone && (
                <a href={`sms:${cleanPhone}`} onClick={(e) => e.stopPropagation()} className={`${buttonBaseStyle} flex-1 sm:flex-none flex items-center justify-center px-3 py-2 min-h-[44px] bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100 no-underline`}>
                    <MessageCircle size={16} className="mr-1.5" /> Text
                </a>
            )}
            {hasEmail && (
                <a href={`mailto:${task.contractorEmail}`} onClick={(e) => e.stopPropagation()} className={`${buttonBaseStyle} flex items-center justify-center px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-colors border no-underline ${!hasPhone ? 'flex-1 sm:flex-none bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    <Mail size={16} className={!hasPhone ? "mr-1.5" : ""} /> {!hasPhone && "Email"}
                </a>
            )}
            {hasPhone && (
                <a href={`tel:${cleanPhone}`} onClick={(e) => e.stopPropagation()} className={`${buttonBaseStyle} px-3 py-2 min-h-[44px] bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center no-underline`}>
                    <Phone size={16} />
                </a>
            )}
            {showRequestFallback && (
                <button type="button" onClick={(e) => { e.stopPropagation(); if (onBook) onBook(task); }} className={`${buttonBaseStyle} flex-1 sm:flex-none flex items-center justify-center px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-colors border ${isOverdue ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    <LinkIcon size={16} className="mr-1.5" /> Request Link
                </button>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); if (onDone) onDone(task); }} className={`${buttonBaseStyle} px-4 py-2 min-h-[44px] bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 active:bg-slate-900 transition-colors flex items-center shadow-sm ml-auto sm:ml-0`}>
                <Check size={16} className="mr-1.5" /> Done
            </button>
        </div>
    );
};

// FIXED: AttentionCard is now a div, not a button, to prevent nesting issues.
// Added onDone and onBook to props destructuring.
const AttentionCard = ({ task, onClick, onDone, onBook }) => {
    if (!task) return null;
    const isOverdue = (task.daysUntil || 0) < 0;
    const days = Math.abs(task.daysUntil || 0);
    
    return (
        <div 
            onClick={() => onClick(task)}
            className="w-full bg-white border border-slate-200 rounded-2xl p-5 hover:border-red-200 hover:shadow-md transition-all group text-left relative overflow-hidden cursor-pointer"
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="flex gap-4 pl-2">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    <AlertTriangle size={24} />
                </div>
                <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="mb-1">
                            <h3 className="font-bold text-slate-800 text-base">{task.taskName}</h3>
                            <p className="text-xs text-slate-500 font-medium">{task.item}</p>
                        </div>
                        <div className="bg-slate-100 p-1 rounded-full group-hover:bg-slate-200 transition-colors">
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                    </div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                        {isOverdue ? `${days} Days Overdue` : `Due in ${days} Days`}
                    </p>
                    
                    {/* Inline Actions - Wrapped to stop propagation to the card's modal click */}
                    <div onClick={(e) => e.stopPropagation()}>
                        <SmartContactActions task={task} onBook={onBook} onDone={onDone} isOverdue={isOverdue} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ScheduledTaskRow = ({ task }) => (
    <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 transition-colors">
        <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
            <Calendar size={18} />
        </div>
        <div className="min-w-0 flex-grow">
            <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-700 text-sm truncate">{task.taskName}</h4>
                <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">
                    {task.nextDate ? task.nextDate.toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Soon'}
                </span>
            </div>
            <p className="text-xs text-slate-500 truncate">{task.item}</p>
        </div>
    </div>
);

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
    onBookService,
    onMarkTaskDone
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showFullInsights, setShowFullInsights] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    const metrics = useMemo(() => {
        try {
            const now = new Date();
            let overdueCount = 0;
            let upcomingCount = 0;
            const overdueTasks = [];
            const upcomingTasks = [];
            const scheduledTasks = [];
            const validRecords = Array.isArray(records) ? records : [];
            const validContractors = Array.isArray(contractors) ? contractors : [];
            
            const getContractorInfo = (name) => {
                if (!name) return {};
                const match = validContractors.find(c => c.name?.toLowerCase().includes(name.toLowerCase()));
                return match ? { phone: match.phone, email: match.email } : {};
            };

            validRecords.forEach(record => {
                if (!record) return;
                const contact = getContractorInfo(record.contractor);
                const phone = record.contractorPhone || contact.phone || '';
                const email = record.contractorEmail || contact.email || '';

                const processTask = (taskName, freq, dateStr, isGranular) => {
                    if (!dateStr || freq === 'none') return;
                    let nextDate = safeDate(dateStr);
                    if (!isGranular && nextDate) {
                        const next = new Date(nextDate);
                        const f = MAINTENANCE_FREQUENCIES.find(x => x.value === freq);
                        if (f && f.months > 0) {
                            next.setMonth(next.getMonth() + f.months);
                            while (next < now) next.setMonth(next.getMonth() + f.months);
                            nextDate = next;
                        }
                    }
                    if (!nextDate) return;
                    const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    const taskItem = {
                        id: `${record.id}-${taskName}-${Math.random()}`,
                        recordId: record.id,
                        taskName,
                        item: record.item,
                        contractor: record.contractor,
                        contractorPhone: phone,
                        contractorEmail: email,
                        frequency: freq,
                        nextDate,
                        daysUntil,
                        isGranular
                    };
                    if (daysUntil < 0) { overdueCount++; overdueTasks.push(taskItem); }
                    else if (daysUntil <= 30) { upcomingCount++; upcomingTasks.push(taskItem); }
                    else if (daysUntil <= 180) { scheduledTasks.push(taskItem); }
                };

                if (Array.isArray(record.maintenanceTasks) && record.maintenanceTasks.length > 0) {
                    record.maintenanceTasks.forEach(t => processTask(t.task, t.frequency, t.nextDue, true));
                } else {
                    processTask('General Maintenance', record.maintenanceFrequency, record.dateInstalled, false);
                }
            });

            const total = validRecords.length;
            let coveragePenalty = total < 5 ? (5 - total) * 10 : 0;
            const score = Math.max(0, 100 - coveragePenalty - (overdueCount * 15));
            const totalSpent = validRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

            return {
                score, overdueCount, upcomingCount, totalSpent,
                overdueTasks, upcomingTasks, scheduledTasks: scheduledTasks.sort((a,b) => a.daysUntil - b.daysUntil),
                breakdown: { coverage: { penalty: coveragePenalty, needed: Math.max(0, 5 - total) }, maintenance: { penalty: overdueCount * 15 } }
            };
        } catch (e) {
            console.error("Metrics Error", e);
            return { score: 0, overdueTasks: [], upcomingTasks: [], scheduledTasks: [], breakdown: { coverage: {}, maintenance: {} } };
        }
    }, [records, contractors]);

    return (
        <div className="space-y-8 pb-8">
            {selectedTask && (
                <TaskActionModal 
                    task={selectedTask} 
                    onClose={() => setSelectedTask(null)}
                    onMarkDone={onMarkTaskDone}
                    onBook={onBookService}
                    onNavigateToContractors={onNavigateToContractors}
                />
            )}

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
                    <div className="flex flex-col items-center py-2"><HealthRing score={metrics.score} theme={season} breakdown={metrics.breakdown} /><p className="text-white/80 text-sm mt-4 text-center font-medium max-w-[200px]">Your home health score.</p></div>
                    <div className="grid grid-cols-3 gap-3 mt-8">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{records.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(metrics.totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>
            
            {(metrics.overdueCount > 0 || metrics.upcomingCount > 0) && (
                <div className="space-y-4">
                    <SectionHeader title="Needs Attention" action={onNavigateToMaintenance} actionLabel="View Schedule" />
                    {metrics.overdueTasks.map((task) => (
                        <AttentionCard key={task.id} task={task} onClick={setSelectedTask} onDone={onMarkTaskDone} onBook={onBookService} />
                    ))}
                    {metrics.overdueCount === 0 && metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <AttentionCard key={task.id} task={task} onClick={setSelectedTask} onDone={onMarkTaskDone} onBook={onBookService} />
                    ))}
                </div>
            )}
            
            {metrics.scheduledTasks.length > 0 && (
                <div className="space-y-4">
                    <SectionHeader title="Maintenance Forecast" action={onNavigateToMaintenance} actionLabel="Full Calendar" />
                    <div className="space-y-3">
                        {metrics.scheduledTasks.slice(0, 3).map((task) => (
                            <ScheduledTaskRow key={task.id} task={task} />
                        ))}
                    </div>
                </div>
            )}
            
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
