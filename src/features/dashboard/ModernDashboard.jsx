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

// --- CONFIG & HELPERS (Unchanged) ---
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
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    } catch (e) { return '$0'; }
};

const getSeasonalTheme = () => {
    const month = new Date().getMonth();
    if (month === 11 || month <= 1) return { name: 'Winter', gradient: 'from-slate-900 via-blue-950 to-slate-900', accent: 'text-blue-400' };
    if (month >= 2 && month <= 4) return { name: 'Spring', gradient: 'from-emerald-900 via-teal-900 to-emerald-950', accent: 'text-emerald-400' };
    if (month >= 5 && month <= 7) return { name: 'Summer', gradient: 'from-amber-900 via-orange-900 to-amber-950', accent: 'text-amber-400' };
    return { name: 'Fall', gradient: 'from-orange-950 via-red-950 to-orange-950', accent: 'text-orange-400' };
};

const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

const cleanPhoneForLink = (phone) => phone ? phone.replace(/[^\d+]/g, '') : '';

const TaskActionModal = ({ task, onClose, onMarkDone, onBook, onNavigateToContractors }) => {
    if (!task) return null;
    const isOverdue = (task.daysUntil || 0) < 0;
    const days = Math.abs(task.daysUntil || 0);
    const hasContractor = !!task.contractor;
    const cleanPhone = cleanPhoneForLink(task.contractorPhone);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
                <div className={`p-6 ${isOverdue ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                    <div className="flex items-start gap-4">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}><Wrench size={28} /></div>
                        <div>
                            <h2 className="font-bold text-xl text-slate-900">{task.taskName}</h2>
                            <p className="text-sm text-slate-600 font-medium">{task.item}</p>
                            <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{isOverdue ? `${days} Days Overdue` : `Due in ${days} Days`}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Service Provider</h4>
                        {hasContractor ? (
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><User size={18} className="text-slate-400" /></div>
                                    <div><p className="font-bold text-slate-800">{task.contractor}</p>{task.contractorPhone && <p className="text-xs text-slate-500">{task.contractorPhone}</p>}</div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    {cleanPhone && <a href={`tel:${cleanPhone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"><Phone size={16} /> Call</a>}
                                    {!cleanPhone && !task.contractorEmail && <button onClick={() => { onBook(task); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"><LinkIcon size={14} /> Create Request Link</button>}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 border-dashed text-center">
                                <p className="text-xs text-slate-400 mb-2">No contractor linked.</p>
                                <button onClick={() => { onBook(task); onClose(); }} className="text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm">Generate Service Link</button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => { onMarkDone(task); onClose(); }} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg"><CheckCircle2 size={24} className="text-emerald-400" /> Mark as Complete</button>
                </div>
            </div>
        </div>
    );
};

const HealthScoreCard = ({ breakdown, score }) => (
    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2"><h3 className="font-bold text-slate-900">Score Breakdown</h3><span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{score}</span></div>
        <div className="space-y-3">
            <div className="flex justify-between items-center text-sm"><div className="flex items-center gap-2"><Wrench size={16} className="text-slate-400" /> <span className="text-slate-600">Maintenance</span></div><span className={`font-bold ${breakdown.maintenance === 50 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.maintenance}/50</span></div>
            <div className="flex justify-between items-center text-sm"><div className="flex items-center gap-2"><Package size={16} className="text-slate-400" /> <span className="text-slate-600">Coverage</span></div><span className={`font-bold ${breakdown.profile >= 40 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.profile}/50</span></div>
        </div>
    </div>
);

const ActionButton = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => (
    <button onClick={onClick} className={`flex items-center gap-3 w-full p-3 rounded-2xl border transition-all group hover:shadow-md active:scale-[0.98] ${variant === 'primary' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'}`}>
        <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 ${variant === 'primary' ? 'bg-emerald-100' : 'bg-slate-100'}`}><Icon size={22} /></div>
        <div><p className="font-bold text-sm">{label}</p>{sublabel && <p className="text-xs opacity-70 font-medium">{sublabel}</p>}</div>
    </button>
);

const AttentionCard = ({ task, onClick }) => {
    if (!task) return null;
    const isOverdue = (task.daysUntil || 0) < 0;
    const days = Math.abs(task.daysUntil || 0);
    return (
        <button onClick={() => onClick(task)} className="w-full bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition-all group text-left relative overflow-hidden active:scale-[0.98] duration-150">
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="flex items-center gap-4 pl-2">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}><AlertTriangle size={24} /></div>
                <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                        <div><h3 className="font-bold text-slate-800 text-base">{task.taskName}</h3><p className="text-xs text-slate-500 font-medium">{task.item}</p></div>
                        <ChevronRight size={16} className="text-slate-400" />
                    </div>
                    <div className="flex items-center mt-2"><span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{isOverdue ? `${days} Days Overdue` : `Due in ${days} Days`}</span></div>
                </div>
            </div>
        </button>
    );
};

const SectionHeader = ({ title, action, actionLabel }) => (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {action && <button onClick={action} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">{actionLabel} <ChevronRight size={16} /></button>}
    </div>
);

export const ModernDashboard = ({
    records = [], contractors = [], activeProperty, onScanReceipt, onAddRecord,
    onNavigateToItems, onNavigateToContractors, onNavigateToReports, onCreateContractorLink,
    onNavigateToMaintenance, onBookService, onMarkTaskDone
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showFullInsights, setShowFullInsights] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    
    // Safety check for empty records to prevent crash
    const validRecords = Array.isArray(records) ? records : [];
    const healthData = useHomeHealth(validRecords);

    const metrics = useMemo(() => {
        const now = new Date();
        const overdueTasks = [], upcomingTasks = [], scheduledTasks = [];
        
        validRecords.forEach(record => {
            const processTask = (taskName, freq, dateStr, isGranular) => {
                if (!dateStr || freq === 'none') return;
                let nextDate = safeDate(dateStr);
                if (!isGranular && nextDate) {
                    const f = MAINTENANCE_FREQUENCIES.find(x => x.value === freq);
                    if (f && f.months > 0) {
                        const next = new Date(nextDate);
                        next.setMonth(next.getMonth() + f.months);
                        while (next < now) next.setMonth(next.getMonth() + f.months);
                        nextDate = next;
                    }
                }
                if (!nextDate) return;
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                const task = { id: `${record.id}-${taskName}`, taskName, item: record.item, recordId: record.id, contractor: record.contractor, contractorPhone: record.contractorPhone, contractorEmail: record.contractorEmail, nextDate, daysUntil, isGranular };
                
                if (daysUntil < 0) overdueTasks.push(task);
                else if (daysUntil <= 30) upcomingTasks.push(task);
                else if (daysUntil <= 180) scheduledTasks.push(task);
            };

            if (record.maintenanceTasks?.length) record.maintenanceTasks.forEach(t => processTask(t.task, t.frequency, t.nextDue, true));
            else processTask('General Maintenance', record.maintenanceFrequency, record.dateInstalled, false);
        });

        return {
            totalSpent: validRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0),
            overdueTasks, upcomingTasks, scheduledTasks: scheduledTasks.sort((a,b) => a.daysUntil - b.daysUntil)
        };
    }, [validRecords]);

    return (
        <div className="space-y-8 pb-8">
            {selectedTask && <TaskActionModal task={selectedTask} onClose={() => setSelectedTask(null)} onMarkDone={onMarkTaskDone} onBook={onBookService} onNavigateToContractors={onNavigateToContractors} />}

            <div className="relative overflow-visible rounded-[2.5rem] shadow-xl z-20">
                <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${season.gradient}`} />
                {/* CENTERED LAYOUT FIX HERE */}
                <div className="relative p-8 text-white flex flex-col items-center text-center">
                    <p className="text-white/60 text-sm font-bold mb-1 uppercase tracking-wider">{greeting}</p>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-6">{activeProperty?.name || 'My Home'}</h1>
                    
                    <div className="relative group mb-8">
                        <div className="relative h-24 w-24 cursor-pointer">
                            <svg className="transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" className="stroke-white/20" strokeWidth="10" fill="none" />
                                <circle cx="50" cy="50" r="45" className={healthData?.score >= 80 ? 'stroke-emerald-400' : healthData?.score >= 50 ? 'stroke-amber-400' : 'stroke-red-400'} strokeWidth="10" fill="none" strokeDasharray={`${(healthData?.score || 0) * 2.83} 283`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-black">{healthData?.score || 0}</span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mt-2">Health Score</p>
                        <HealthScoreCard breakdown={healthData?.breakdown || {profile: 0, maintenance: 0}} score={healthData?.score || 0} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{validRecords.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(metrics.totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>
            
            {(metrics.overdueTasks.length > 0 || metrics.upcomingTasks.length > 0) && (
                <div className="space-y-4">
                    <SectionHeader title="Needs Attention" action={onNavigateToMaintenance} actionLabel="View Schedule" />
                    {[...metrics.overdueTasks, ...metrics.upcomingTasks].slice(0, 3).map(task => <AttentionCard key={task.id} task={task} onClick={setSelectedTask} />)}
                </div>
            )}
            
            <div className="space-y-4">
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                    <ActionButton icon={Camera} label="Scan Receipt" sublabel="AI-powered" onClick={onScanReceipt} variant="primary" />
                    <ActionButton icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <ActionButton icon={FileText} label="View Report" sublabel="Home pedigree" onClick={onNavigateToReports} />
                    <ActionButton icon={Hammer} label="Service Link" sublabel="For contractors" onClick={onCreateContractorLink} />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button onClick={() => setShowFullInsights(!showFullInsights)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3"><div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center"><Info size={20} className="text-blue-600" /></div><div className="text-left"><p className="font-bold text-slate-800">Local Insights</p><p className="text-xs text-slate-500">{showFullInsights ? 'Tap to hide details' : 'Environmental, County & Risk Data'}</p></div></div>
                    <div className={`p-2 bg-slate-100 rounded-full transition-transform duration-300 ${showFullInsights ? 'rotate-180' : ''}`}><ChevronDown size={20} className="text-slate-500" /></div>
                </button>
                {showFullInsights && <div className="p-4 pt-0 border-t border-slate-100 mt-2 animate-in slide-in-from-top-2 fade-in"><div className="space-y-8 pt-6"><EnvironmentalInsights propertyProfile={activeProperty} /><CountyData propertyProfile={activeProperty} /></div></div>}
            </div>
        </div>
    );
};

export default ModernDashboard;
