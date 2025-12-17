// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench, Shield, CheckCircle2,
    Info, TrendingUp, ChevronDown, Check, User,
    Calendar, Phone, Mail, MessageCircle, Link as LinkIcon,
    X, ExternalLink, Hammer
} from 'lucide-react';
import { EnvironmentalInsights } from './EnvironmentalInsights';
import { CountyData } from './CountyData';
import { useHomeHealth } from '../../hooks/useHomeHealth';

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

const TaskActionModal = ({ task, onClose, onMarkDone, onBook, onNavigateToContractors }) => {
    if (!task) return null;

    const isOverdue = (task.daysUntil || 0) < 0;
    const days = Math.abs(task.daysUntil || 0);
    const hasContractor = !!task.contractor;
    const cleanPhone = cleanPhoneForLink(task.contractorPhone);
    const hasPhone = !!cleanPhone;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
                {/* Header */}
                <div className={`p-6 ${isOverdue ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                    <div className="flex items-start gap-4">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <Wrench size={28} />
                        </div>
                        <div>
                            <h2 className="font-bold text-xl text-slate-900">{task.taskName}</h2>
                            <p className="text-sm text-slate-600 font-medium">{task.item}</p>
                            <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {isOverdue ? `${days} Days Overdue` : `Due in ${days} Days`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Contractor Info Section */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Service Provider</h4>
                        {hasContractor ? (
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                        <User size={18} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{task.contractor}</p>
                                        {task.contractorPhone && <p className="text-xs text-slate-500">{task.contractorPhone}</p>}
                                        {task.contractorEmail && <p className="text-xs text-slate-500">{task.contractorEmail}</p>}
                                    </div>
                                </div>
                                
                                {/* Contact Actions */}
                                <div className="flex gap-2 pt-2">
                                    {hasPhone && (
                                        <>
                                            <a 
                                                href={`tel:${cleanPhone}`}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                                            >
                                                <Phone size={16} /> Call
                                            </a>
                                            <a 
                                                href={`sms:${cleanPhone}`}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                                            >
                                                <MessageCircle size={16} /> Text
                                            </a>
                                        </>
                                    )}
                                    {task.contractorEmail && (
                                        <a 
                                            href={`mailto:${task.contractorEmail}`}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
                                        >
                                            <Mail size={16} /> Email
                                        </a>
                                    )}
                                </div>
                                
                                {/* Create Link Option */}
                                {!hasPhone && !task.contractorEmail && (
                                    <button 
                                        onClick={() => { onBook(task); onClose(); }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                                    >
                                        <LinkIcon size={14} /> Create Request Link
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-dashed text-center">
                                <p className="text-xs text-slate-400 mb-2">No contractor linked to this item.</p>
                                <button 
                                    onClick={() => { onBook(task); onClose(); }}
                                    className="text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm"
                                >
                                    Generate Service Link
                                </button>
                            </div>
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
                <span className={`font-bold ${breakdown.maintenance === 50 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.maintenance}/50</span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Package size={16} className="text-slate-400" /> <span className="text-slate-600">Coverage</span></div>
                <span className={`font-bold ${breakdown.profile >= 40 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.profile}/50</span>
            </div>
        </div>
    </div>
);

const ActionButton = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => (
    <button onClick={onClick} className={`flex items-center gap-3 w-full p-3 rounded-2xl border transition-all group hover:shadow-md active:scale-[0.98] ${variant === 'primary' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'}`}>
        <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 group-active:scale-95 ${variant === 'primary' ? 'bg-emerald-100' : 'bg-slate-100'}`}><Icon size={22} /></div>
        <div><p className="font-bold text-sm">{label}</p>{sublabel && <p className="text-xs opacity-70 font-medium">{sublabel}</p>}</div>
    </button>
);

const AttentionCard = ({ task, onClick }) => {
    if (!task) return null;
    const isOverdue = (task.daysUntil || 0) < 0;
    const days = Math.abs(task.daysUntil || 0);
    
    return (
        <button 
            onClick={() => onClick(task)}
            className="w-full bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition-all group text-left relative overflow-hidden active:scale-[0.98] duration-150"
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="flex items-center gap-4 pl-2">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    <AlertTriangle size={24} />
                </div>
                <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-slate-800 text-base">{task.taskName}</h3>
                            <p className="text-xs text-slate-500 font-medium">{task.item}</p>
                        </div>
                        <div className="bg-slate-100 p-1 rounded-full group-hover:bg-slate-200 transition-colors">
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                    </div>
                    <div className="flex items-center mt-2">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isOverdue ? `${days} Days Overdue` : `Due in ${days} Days`}
                        </span>
                        {task.contractor && (
                            <span className="text-[10px] text-slate-400 font-medium ml-2 flex items-center">
                                <User size={10} className="mr-1"/> {task.contractor}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
};

const ScheduledTaskRow = ({ task, onClick }) => (
    <button onClick={() => onClick(task)} className="w-full flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 transition-colors text-left group">
        <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
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
        <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500" />
    </button>
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

    // 1. Use centralized hook for scoring
    const healthData = useHomeHealth(records);

    // FIX: Build contractor directory from records for better enrichment
    const contractorDirectory = useMemo(() => {
        const dir = {};
        records.forEach(r => {
            if (r.contractor && r.contractor.trim().length > 0) {
                const name = r.contractor.trim().toLowerCase();
                if (!dir[name]) {
                    dir[name] = { phone: null, email: null };
                }
                if (r.contractorPhone && r.contractorPhone.trim()) {
                    dir[name].phone = r.contractorPhone.trim();
                }
                if (r.contractorEmail && r.contractorEmail.trim()) {
                    dir[name].email = r.contractorEmail.trim();
                }
            }
        });
        return dir;
    }, [records]);

    // 2. Calculate Dashboard-specific metrics (Tasks list + Total Spent)
    const metrics = useMemo(() => {
        try {
            const now = new Date();
            const overdueTasks = [];
            const upcomingTasks = [];
            const scheduledTasks = [];
            const validRecords = Array.isArray(records) ? records : [];
            const validContractors = Array.isArray(contractors) ? contractors : [];
            
            // FIX: Improved getContractorInfo that checks multiple sources
            const getContractorInfo = (name) => {
                if (!name) return {};
                const normalizedName = name.trim().toLowerCase();
                
                // First, check the directory built from records
                const fromDirectory = contractorDirectory[normalizedName];
                if (fromDirectory && (fromDirectory.phone || fromDirectory.email)) {
                    return { phone: fromDirectory.phone, email: fromDirectory.email };
                }
                
                // Then, check the contractors list
                const match = validContractors.find(c => 
                    c.name?.toLowerCase().includes(normalizedName) ||
                    normalizedName.includes(c.name?.toLowerCase())
                );
                return match ? { phone: match.phone, email: match.email } : {};
            };

            validRecords.forEach(record => {
                if (!record) return;
                
                // FIX: Get contractor info with better fallbacks
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
                        id: `${record.id}-${taskName.replace(/\s+/g, '_')}`,
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

                    if (daysUntil < 0) overdueTasks.push(taskItem);
                    else if (daysUntil <= 30) upcomingTasks.push(taskItem);
                    else if (daysUntil <= 180) scheduledTasks.push(taskItem);
                };

                if (Array.isArray(record.maintenanceTasks) && record.maintenanceTasks.length > 0) {
                    record.maintenanceTasks.forEach(t => processTask(t.task, t.frequency, t.nextDue, true));
                } else {
                    processTask('General Maintenance', record.maintenanceFrequency, record.dateInstalled, false);
                }
            });

            const totalSpent = validRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

            return {
                totalSpent,
                overdueTasks,
                upcomingTasks,
                scheduledTasks: scheduledTasks.sort((a,b) => a.daysUntil - b.daysUntil),
            };
        } catch (e) {
            console.error("Metrics Error", e);
            return { totalSpent: 0, overdueTasks: [], upcomingTasks: [], scheduledTasks: [] };
        }
    }, [records, contractors, contractorDirectory]);

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
                <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${season.gradient}`} />
                <div className="relative p-6 text-white">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <p className="text-white/60 text-sm font-bold">{greeting}</p>
                            <h1 className="text-2xl font-extrabold tracking-tight">{activeProperty?.name || 'My Home'}</h1>
                        </div>
                        <div className="relative group">
                            <div className="flex flex-col items-center cursor-pointer">
                                <div className="relative h-20 w-20">
                                    <svg className="transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" className="stroke-white/20" strokeWidth="10" fill="none" />
                                        <circle cx="50" cy="50" r="45" className={healthData?.score >= 80 ? 'stroke-emerald-400' : healthData?.score >= 50 ? 'stroke-amber-400' : 'stroke-red-400'} strokeWidth="10" fill="none" strokeDasharray={`${(healthData?.score || 0) * 2.83} 283`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-black">{healthData?.score || 0}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mt-1">Home Score</p>
                            </div>
                            <HealthScoreCard breakdown={healthData?.breakdown || {profile: 0, maintenance: 0}} score={healthData?.score || 0} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{records.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(metrics.totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>
            
            {(metrics.overdueTasks.length > 0 || metrics.upcomingTasks.length > 0) && (
                <div className="space-y-4">
                    <SectionHeader title="Needs Attention" action={onNavigateToMaintenance} actionLabel="View Schedule" />
                    {metrics.overdueTasks.map((task) => (
                        <AttentionCard key={task.id} task={task} onClick={setSelectedTask} />
                    ))}
                    {metrics.overdueTasks.length === 0 && metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <AttentionCard key={task.id} task={task} onClick={setSelectedTask} />
                    ))}
                </div>
            )}
            
            {/* Maintenance Forecast */}
            <div className="space-y-4">
                <SectionHeader title="Maintenance Forecast" action={onNavigateToMaintenance} actionLabel="Full Calendar" />
                
                {metrics.scheduledTasks.length > 0 ? (
                    <div className="space-y-2">
                        {metrics.scheduledTasks.slice(0, 4).map(task => (
                            <ScheduledTaskRow key={task.id} task={task} onClick={setSelectedTask} />
                        ))}
                        {metrics.scheduledTasks.length > 4 && (
                            <button onClick={onNavigateToMaintenance} className="w-full py-3 text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1">
                                View {metrics.scheduledTasks.length - 4} more <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-200">
                        <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium text-sm">No upcoming maintenance</p>
                        <p className="text-slate-400 text-xs mt-1">Add items with maintenance schedules</p>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                    <ActionButton icon={Camera} label="Scan Receipt" sublabel="AI-powered" onClick={onScanReceipt} variant="primary" />
                    <ActionButton icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <ActionButton icon={FileText} label="View Report" sublabel="Home pedigree" onClick={onNavigateToReports} />
                    <ActionButton icon={Hammer} label="Service Link" sublabel="For contractors" onClick={onCreateContractorLink} />
                </div>
            </div>

            {/* Environmental Insights Toggle */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button onClick={() => setShowFullInsights(!showFullInsights)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center"><Info size={20} className="text-blue-600" /></div>
                        <div className="text-left"><p className="font-bold text-slate-800">Local Insights</p><p className="text-xs text-slate-500">{showFullInsights ? 'Tap to hide details' : 'Environmental, County & Risk Data'}</p></div>
                    </div>
                    <div className={`p-2 bg-slate-100 rounded-full transition-transform duration-300 ${showFullInsights ? 'rotate-180' : ''}`}><ChevronDown size={20} className="text-slate-500" /></div>
                </button>
                {showFullInsights && (
                    <div className="p-4 pt-0 border-t border-slate-100 mt-2 animate-in slide-in-from-top-2 fade-in"><div className="space-y-8 pt-6"><EnvironmentalInsights propertyProfile={activeProperty} /><CountyData propertyProfile={activeProperty} /></div></div>
                )}
            </div>
        </div>
    );
};

export default ModernDashboard;
