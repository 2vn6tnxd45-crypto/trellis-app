// src/features/dashboard/Dashboard.jsx
import React, { useState, useMemo } from 'react';
import { 
    Camera, CheckCircle2, Clock, ChevronRight,
    ChevronDown, ChevronUp, Sparkles, Calendar, DollarSign, Wrench,
    Leaf, Sun, Bell, MapPin, Package, Link as LinkIcon, 
    Plus, Share2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { HomeSnapshot } from './HomeSnapshot';
import { useCountyData } from '../../hooks/useCountyData';

// ... (Helper functions: getNextServiceDate, getCurrentSeason, getSeasonIcon, formatCurrency, getCategoryIcon, SEASONAL_CHECKLISTS) ...
// [Note: These helper functions are unchanged, keeping them implied for brevity]
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

const getCurrentSeason = () => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
};

const getSeasonIcon = (season) => {
    const icons = { spring: <Leaf className="h-5 w-5 text-green-500" />, summer: <Sun className="h-5 w-5 text-yellow-500" />, fall: <Leaf className="h-5 w-5 text-orange-500" />, winter: <Sparkles className="h-5 w-5 text-blue-500" /> };
    return icons[season] || <Calendar className="h-5 w-5 text-slate-500" />;
};

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const getCategoryIcon = (category) => {
    const icons = { 'HVAC & Systems': '🌡️', 'Plumbing': '🚰', 'Electrical': '⚡', 'Roof & Exterior': '🏠', 'Appliances': '🔌', 'Paint & Finishes': '🎨', 'Flooring': '🪵', 'Landscaping': '🌳', 'Safety & Security': '🔒', 'Other': '📦' };
    return icons[category] || '📦';
};

const SEASONAL_CHECKLISTS = {
    spring: [
        { id: 'sp1', task: 'Service AC unit before summer', category: 'HVAC', priority: 'high' },
        { id: 'sp2', task: 'Clean gutters and downspouts', category: 'Exterior', priority: 'medium' },
        { id: 'sp3', task: 'Inspect roof for winter damage', category: 'Roof', priority: 'high' },
        { id: 'sp4', task: 'Test sprinkler system', category: 'Landscaping', priority: 'low' },
    ],
    summer: [
        { id: 'su1', task: 'Replace HVAC filters (high usage)', category: 'HVAC', priority: 'high' },
        { id: 'su2', task: 'Check weatherstripping on doors', category: 'Interior', priority: 'medium' },
        { id: 'su3', task: 'Clean dryer vent', category: 'Appliances', priority: 'high' },
    ],
    fall: [
        { id: 'fa1', task: 'Schedule furnace tune-up', category: 'HVAC', priority: 'high' },
        { id: 'fa2', task: 'Clean gutters (falling leaves)', category: 'Exterior', priority: 'high' },
        { id: 'fa3', task: 'Test smoke & CO detectors', category: 'Safety', priority: 'high' },
        { id: 'fa4', task: 'Winterize outdoor faucets', category: 'Plumbing', priority: 'high' },
    ],
    winter: [
        { id: 'wi1', task: 'Check for ice dams on roof', category: 'Roof', priority: 'high' },
        { id: 'wi2', task: 'Replace HVAC filter', category: 'HVAC', priority: 'high' },
        { id: 'wi3', task: 'Check pipe insulation', category: 'Plumbing', priority: 'high' },
    ]
};

const MoneyTracker = ({ records, onAddExpense }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const spending = useMemo(() => {
        const now = new Date();
        const thisYear = now.getFullYear();
        
        const recordsWithCosts = records.filter(r => r.cost && r.cost > 0);
        const thisYearRecords = recordsWithCosts.filter(r => {
            const date = new Date(r.dateInstalled || r.timestamp?.toDate?.() || r.timestamp);
            return date.getFullYear() === thisYear;
        });
        
        const totalThisYear = thisYearRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        const byCategory = thisYearRecords.reduce((acc, r) => {
            const cat = r.category || 'Other';
            acc[cat] = (acc[cat] || 0) + (parseFloat(r.cost) || 0);
            return acc;
        }, {});
        const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
        
        return { totalThisYear, byCategory: sortedCategories };
    }, [records]);
    
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800">Money Tracker</h3>
                        <p className="text-xs text-slate-500">{spending.totalThisYear > 0 ? `${formatCurrency(spending.totalThisYear)} this year` : 'Track your home spending'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {spending.totalThisYear > 0 && <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(spending.totalThisYear)}</span>}
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
            </button>
            
            {isExpanded && (
                <div className="border-t border-slate-100 p-4">
                    {spending.byCategory.length > 0 ? (
                        <div className="space-y-3">
                            {spending.byCategory.map(([category, amount]) => (
                                <div key={category} className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        {getCategoryIcon(category)} {category}
                                    </span>
                                    <span className="text-sm font-bold text-slate-800">{formatCurrency(amount)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 text-center">No expenses recorded this year.</p>
                    )}
                     <button onClick={onAddExpense} className="w-full mt-4 py-2.5 border border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
                        <Plus className="h-4 w-4" /> Add Expense
                    </button>
                </div>
            )}
        </div>
    );
};

// Updated QuickActions
const QuickActions = ({ onScanReceipt, onCreateContractorLink, onMarkTaskDone, onShareHome }) => (
    <div className="grid grid-cols-4 gap-3">
        <button onClick={onScanReceipt} className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
            <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors"><Camera className="h-6 w-6 text-emerald-700" /></div>
            <span className="text-xs font-bold text-slate-600">Scan</span>
        </button>
        <button onClick={onMarkTaskDone} className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
            <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors"><CheckCircle2 className="h-6 w-6 text-blue-700" /></div>
            <span className="text-xs font-bold text-slate-600">Done</span>
        </button>
        <button onClick={onCreateContractorLink} className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
            <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-purple-200 transition-colors"><LinkIcon className="h-6 w-6 text-purple-700" /></div>
            <span className="text-xs font-bold text-slate-600">Pro Link</span>
        </button>
        <button onClick={onShareHome} className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
            <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors"><Share2 className="h-6 w-6 text-emerald-700" /></div>
            <span className="text-xs font-bold text-slate-600">Share</span>
        </button>
    </div>
);

// NeedsAttentionCard & SeasonalChecklist & SmartSuggestion remain unchanged
const NeedsAttentionCard = ({ task, onDone, onSnooze }) => {
    const isOverdue = task.daysUntil < 0;
    const isUrgent = task.daysUntil <= 7 && task.daysUntil >= 0;
    
    return (
        <div className={`p-4 rounded-xl border ${isOverdue ? 'bg-red-50 border-red-200' : isUrgent ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100' : isUrgent ? 'bg-amber-100' : 'bg-slate-100'}`}>
                        <Wrench className={`h-4 w-4 ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-600'}`} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800">{task.item}</h4>
                        <p className="text-xs text-slate-500">{task.category}</p>
                    </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isOverdue ? 'bg-red-200 text-red-800' : isUrgent ? 'bg-amber-200 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {isOverdue ? `${Math.abs(task.daysUntil)}d overdue` : task.daysUntil === 0 ? 'Today' : `${task.daysUntil}d left`}
                </span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => onDone(task)} className="flex-1 py-2 px-3 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Done
                </button>
                <button onClick={() => onSnooze(task)} className="py-2 px-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" /> Snooze
                </button>
            </div>
        </div>
    );
};

const SeasonalChecklist = ({ completedTasks, onToggleTask }) => {
    const season = getCurrentSeason();
    const seasonName = season.charAt(0).toUpperCase() + season.slice(1);
    const tasks = SEASONAL_CHECKLISTS[season] || [];
    const completedCount = tasks.filter(t => completedTasks.includes(t.id)).length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                    {getSeasonIcon(season)}
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800">{seasonName} Checklist</h3>
                        <p className="text-xs text-slate-500">{completedCount} of {tasks.length} tasks complete</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
                    {tasks.map(task => {
                        const isCompleted = completedTasks.includes(task.id);
                        return (
                            <button key={task.id} onClick={() => onToggleTask(task.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${isCompleted ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'}`}>
                                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                    {isCompleted && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-grow">
                                    <p className={`text-sm font-medium ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.task}</p>
                                    <p className="text-xs text-slate-400">{task.category}</p>
                                </div>
                                {task.priority === 'high' && !isCompleted && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Important</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const SmartSuggestion = ({ records }) => {
    const suggestion = useMemo(() => {
        if (records.length === 0) return { icon: <Sparkles className="h-5 w-5 text-purple-600" />, title: "Get started with Smart Suggestions", message: "Add a few items to your home inventory and we'll start providing personalized tips." };
        
        const recordsWithCosts = records.filter(r => r.cost && r.cost > 0);
        if (recordsWithCosts.length >= 3) {
            const plumbingCosts = recordsWithCosts.filter(r => r.category === 'Plumbing').reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
            if (plumbingCosts > 500) return { icon: <PiggyBank className="h-5 w-5 text-blue-600" />, title: `You've spent ${formatCurrency(plumbingCosts)} on plumbing`, message: "Multiple repairs might indicate an underlying issue. Consider a whole-home pipe inspection." };
        }
        
        const waterHeaters = records.filter(r => r.item?.toLowerCase().includes('water heater'));
        if (waterHeaters.length > 0) {
            const oldest = waterHeaters.reduce((a, b) => new Date(a.dateInstalled) < new Date(b.dateInstalled) ? a : b);
            const age = Math.floor((new Date() - new Date(oldest.dateInstalled)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age >= 8) return { icon: <AlertCircle className="h-5 w-5 text-amber-600" />, title: `Your water heater is ${age} years old`, message: `Average lifespan is 10-12 years. Consider budgeting $1,200-$1,800 for replacement.` };
        }
        
        const seasonTips = { spring: "Spring is the perfect time to service your AC before summer.", summer: "Running your AC? Replace filters monthly for best efficiency.", fall: "Schedule a furnace tune-up before the winter rush.", winter: "Check your pipe insulation to prevent freezing." };
        return { icon: <Sparkles className="h-5 w-5 text-purple-600" />, title: "Seasonal Tip", message: seasonTips[getCurrentSeason()] };
    }, [records]);
    
    return (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100">
            <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm">{suggestion.icon}</div>
                <div className="flex-grow">
                    <h4 className="font-bold text-slate-800 text-sm">{suggestion.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{suggestion.message}</p>
                </div>
            </div>
        </div>
    );
};

// Main Dashboard Component
export const Dashboard = ({ 
    records, 
    contractors = [], 
    activeProperty, 
    onScanReceipt, 
    onNavigateToItems, 
    onNavigateToContractors, 
    onCreateContractorLink,
    onNavigateToReports 
}) => {
    const { parcelData } = useCountyData(activeProperty?.coordinates, activeProperty?.address);
    const [completedSeasonalTasks, setCompletedSeasonalTasks] = useState(() => {
        const saved = localStorage.getItem('krib_seasonal_tasks');
        return saved ? JSON.parse(saved) : [];
    });
    
    const needsAttention = useMemo(() => {
        const now = new Date();
        return records.map(record => {
            const nextDate = getNextServiceDate(record);
            if (!nextDate) return null;
            const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
            return daysUntil <= 30 ? { ...record, nextDate, daysUntil } : null;
        }).filter(Boolean).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3);
    }, [records]);
    
    const handleToggleSeasonalTask = (taskId) => {
        setCompletedSeasonalTasks(prev => {
            const newTasks = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId];
            localStorage.setItem('krib_seasonal_tasks', JSON.stringify(newTasks));
            if (!prev.includes(taskId)) toast.success('Task completed! 🎉');
            return newTasks;
        });
    };
    
    const handleTaskDone = (task) => toast.success(`Marked "${task.item}" as done!`);
    const handleSnoozeTask = () => toast('Snoozed for 1 week', { icon: '😴' });
    const handleMarkTaskDone = () => needsAttention.length > 0 ? handleTaskDone(needsAttention[0]) : toast('No pending tasks!', { icon: '✨' });
    
    // Updated: Now navigates to Reports tab
    const handleShareHome = () => {
        if (onNavigateToReports) {
            onNavigateToReports();
            toast.success("Opening Shareable Report");
        } else {
            toast.error("Reporting feature unavailable");
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    };

    return (
        <div className="space-y-6">
            
            {/* 1. Header & Home Info Stats */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                
                <div className="relative z-10 text-center">
                    <div className="mb-6">
                        <p className="text-emerald-100 font-medium text-sm mb-1">{getGreeting()}</p>
                        <h2 className="text-3xl font-extrabold">{activeProperty?.name || 'My Home'}</h2>
                        {activeProperty?.address && (
                            <p className="text-emerald-100 text-sm mt-1 flex items-center justify-center">
                                <MapPin size={14} className="mr-1.5" />
                                {activeProperty.address.city}, {activeProperty.address.state}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-emerald-500/30 pt-4">
                        <button 
                            onClick={onNavigateToItems}
                            className="text-center group hover:bg-white/10 rounded-xl p-2 transition-colors cursor-pointer"
                        >
                            <p className="text-2xl font-extrabold group-hover:scale-110 transition-transform">{records.length}</p>
                            <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-wider">Items</p>
                        </button>
                        
                        <button 
                            onClick={onNavigateToContractors}
                            className="text-center border-l border-emerald-500/30 group hover:bg-white/10 rounded-xl p-2 transition-colors cursor-pointer"
                        >
                            <p className="text-2xl font-extrabold group-hover:scale-110 transition-transform">{contractors.length}</p>
                            <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-wider">Pros</p>
                        </button>
                        
                        <div className="text-center border-l border-emerald-500/30 p-2">
                            {needsAttention.length > 0 ? (
                                <p className="text-2xl font-extrabold text-amber-300">{needsAttention.length}</p>
                            ) : (
                                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-300" />
                            )}
                            <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-wider">Alerts</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 2. Quick Actions */}
            <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
                <QuickActions 
                    onScanReceipt={onScanReceipt} 
                    onCreateContractorLink={onCreateContractorLink} 
                    onMarkTaskDone={handleMarkTaskDone} 
                    onShareHome={handleShareHome} 
                />
            </div>
            
            {/* 3. Money Tracker */}
            <MoneyTracker records={records} onAddExpense={onScanReceipt} />
            
            {/* 4. Maintenance / Attention */}
            {needsAttention.length > 0 && (
                <div>
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Bell className="h-3 w-3" /> Needs Attention ({needsAttention.length})
                    </h2>
                    <div className="space-y-3">
                        {needsAttention.map(task => <NeedsAttentionCard key={task.id} task={task} onDone={handleTaskDone} onSnooze={handleSnoozeTask} />)}
                    </div>
                </div>
            )}
            
            <SeasonalChecklist completedTasks={completedSeasonalTasks} onToggleTask={handleToggleSeasonalTask} />
            <SmartSuggestion records={records} />
            
            {/* 5. Navigation Links */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={onNavigateToItems} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
                        <span className="font-bold text-slate-700 text-sm">View Inventory</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button onClick={onNavigateToContractors} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                    <div className="flex items-center gap-3">
                        <Wrench className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
                        <span className="font-bold text-slate-700 text-sm">My Pros</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
            </div>

            {/* 6. Insights (Bottom) */}
            <HomeSnapshot propertyProfile={activeProperty} />
        </div>
    );
};
