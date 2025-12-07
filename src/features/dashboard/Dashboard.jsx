// src/features/dashboard/Dashboard.jsx
import React, { useState, useMemo } from 'react';
import { 
    Camera, CheckCircle2, ShoppingCart, AlertCircle, Clock, ChevronRight,
    ChevronDown, ChevronUp, Sparkles, Calendar, DollarSign, Wrench,
    ThermometerSun, Snowflake, Leaf, Sun, Bell, ExternalLink, Package,
    Shield, Link as LinkIcon, PiggyBank, Receipt, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';

// Helper functions
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
    const icons = { spring: <Leaf className="h-5 w-5 text-green-500" />, summer: <Sun className="h-5 w-5 text-yellow-500" />, fall: <Leaf className="h-5 w-5 text-orange-500" />, winter: <Snowflake className="h-5 w-5 text-blue-500" /> };
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

// Money Tracker Component
const MoneyTracker = ({ records, onAddExpense }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const spending = useMemo(() => {
        const now = new Date();
        const thisYear = now.getFullYear();
        const thisMonth = now.getMonth();
        
        const recordsWithCosts = records.filter(r => r.cost && r.cost > 0);
        const thisYearRecords = recordsWithCosts.filter(r => {
            const date = new Date(r.dateInstalled || r.timestamp?.toDate?.() || r.timestamp);
            return date.getFullYear() === thisYear;
        });
        
        const totalThisYear = thisYearRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        const thisMonthRecords = thisYearRecords.filter(r => {
            const date = new Date(r.dateInstalled || r.timestamp?.toDate?.() || r.timestamp);
            return date.getMonth() === thisMonth;
        });
        const totalThisMonth = thisMonthRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        const byCategory = thisYearRecords.reduce((acc, r) => {
            const cat = r.category || 'Other';
            acc[cat] = (acc[cat] || 0) + (parseFloat(r.cost) || 0);
            return acc;
        }, {});
        const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
        
        const recentExpenses = [...recordsWithCosts].sort((a, b) => {
            const dateA = new Date(a.dateInstalled || a.timestamp?.toDate?.() || a.timestamp);
            const dateB = new Date(b.dateInstalled || b.timestamp?.toDate?.() || b.timestamp);
            return dateB - dateA;
        }).slice(0, 5);
        
        const laborTotal = thisYearRecords.reduce((sum, r) => sum + (parseFloat(r.laborCost) || 0), 0);
        const partsTotal = thisYearRecords.reduce((sum, r) => sum + (parseFloat(r.partsCost) || 0), 0);
        
        return { totalThisYear, totalThisMonth, byCategory: sortedCategories, recentExpenses, laborTotal, partsTotal, transactionCount: thisYearRecords.length };
    }, [records]);
    
    const hasAnySpending = spending.totalThisYear > 0 || spending.recentExpenses.length > 0;
    
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800">Money Tracker</h3>
                        <p className="text-xs text-slate-500">{hasAnySpending ? `${formatCurrency(spending.totalThisYear)} this year` : 'Track your home spending'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasAnySpending && <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(spending.totalThisYear)}</span>}
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
            </button>
            
            {isExpanded && (
                <div className="border-t border-slate-100">
                    {!hasAnySpending ? (
                        <div className="p-6 text-center">
                            <div className="inline-flex p-3 bg-emerald-50 rounded-full mb-3"><Receipt className="h-6 w-6 text-emerald-600" /></div>
                            <h4 className="font-bold text-slate-800 mb-1">No expenses tracked yet</h4>
                            <p className="text-sm text-slate-500 mb-4">When you scan receipts or contractors submit invoices, costs appear here automatically.</p>
                            <button onClick={onAddExpense} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors inline-flex items-center gap-2">
                                <Camera className="h-4 w-4" /> Scan a Receipt
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-extrabold text-emerald-700">{formatCurrency(spending.totalThisMonth)}</p>
                                    <p className="text-[10px] text-emerald-600 font-medium uppercase">This Month</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-extrabold text-slate-700">{spending.transactionCount}</p>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase">Services</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-extrabold text-blue-700">{formatCurrency(spending.totalThisYear)}</p>
                                    <p className="text-[10px] text-blue-600 font-medium uppercase">YTD Total</p>
                                </div>
                            </div>
                            
                            {spending.byCategory.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">By Category</h4>
                                    <div className="space-y-2">
                                        {spending.byCategory.map(([category, amount]) => {
                                            const percentage = spending.totalThisYear > 0 ? Math.round((amount / spending.totalThisYear) * 100) : 0;
                                            return (
                                                <div key={category} className="flex items-center gap-3">
                                                    <span className="text-lg">{getCategoryIcon(category)}</span>
                                                    <div className="flex-grow">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium text-slate-700">{category}</span>
                                                            <span className="text-sm font-bold text-slate-800">{formatCurrency(amount)}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {(spending.laborTotal > 0 || spending.partsTotal > 0) && (
                                <div className="bg-slate-50 rounded-xl p-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cost Breakdown</h4>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1"><div className="h-2 w-2 bg-blue-500 rounded-full"></div><span className="text-xs text-slate-600">Labor</span></div>
                                            <p className="text-sm font-bold text-slate-800">{formatCurrency(spending.laborTotal)}</p>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1"><div className="h-2 w-2 bg-emerald-500 rounded-full"></div><span className="text-xs text-slate-600">Parts/Materials</span></div>
                                            <p className="text-sm font-bold text-slate-800">{formatCurrency(spending.partsTotal)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {spending.recentExpenses.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recent</h4>
                                    <div className="space-y-2">
                                        {spending.recentExpenses.slice(0, 3).map((expense) => {
                                            const date = new Date(expense.dateInstalled || expense.timestamp?.toDate?.() || expense.timestamp);
                                            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            return (
                                                <div key={expense.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{getCategoryIcon(expense.category)}</span>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-800">{expense.item}</p>
                                                            <p className="text-[10px] text-slate-400">{expense.contractor ? `${expense.contractor} • ` : ''}{formattedDate}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700">{formatCurrency(expense.cost)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            <button onClick={onAddExpense} className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
                                <Plus className="h-4 w-4" /> Add Expense
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Quick Actions Component
const QuickActions = ({ onScanReceipt, onCreateContractorLink, onMarkTaskDone }) => (
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
        <button onClick={() => toast('Emergency guide coming soon!', { icon: '🆘' })} className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-red-300 hover:bg-red-50 transition-all group">
            <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-red-200 transition-colors"><AlertCircle className="h-6 w-6 text-red-700" /></div>
            <span className="text-xs font-bold text-slate-600">SOS</span>
        </button>
    </div>
);

// Needs Attention Card
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
                        <p className="text-xs text-slate-500">{task.category} • {task.area || 'General'}</p>
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

// Seasonal Checklist
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

// Smart Suggestion
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

// Home Stats
const HomeStats = ({ records, contractors }) => (
    <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
            <p className="text-2xl font-extrabold text-emerald-600">{records.length}</p>
            <p className="text-xs text-slate-500 font-medium">Items Tracked</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
            <p className="text-2xl font-extrabold text-blue-600">{contractors?.length || 0}</p>
            <p className="text-xs text-slate-500 font-medium">Pros Saved</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
            <Shield className="h-5 w-5 text-emerald-500 mx-auto" />
            <p className="text-xs text-slate-500 font-medium mt-1">Protected</p>
        </div>
    </div>
);

// Main Dashboard
export const Dashboard = ({ records, contractors = [], propertyName, onScanReceipt, onNavigateToItems, onNavigateToContractors, onCreateContractorLink }) => {
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
    
    const getGreeting = () => {
        const hour = new Date().getHours();
        return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-800">{getGreeting()}!</h1>
                <p className="text-slate-500 text-sm">Here's what's happening with your Krib</p>
            </div>
            
            <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
                <QuickActions onScanReceipt={onScanReceipt} onCreateContractorLink={onCreateContractorLink} onMarkTaskDone={handleMarkTaskDone} />
            </div>
            
            <MoneyTracker records={records} onAddExpense={onScanReceipt} />
            
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
            
            {needsAttention.length === 0 && records.length > 0 && (
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 text-center">
                    <div className="inline-flex p-3 bg-emerald-100 rounded-full mb-3"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
                    <h3 className="font-bold text-emerald-900">All caught up!</h3>
                    <p className="text-sm text-emerald-700 mt-1">No maintenance tasks due soon.</p>
                </div>
            )}
            
            <SeasonalChecklist completedTasks={completedSeasonalTasks} onToggleTask={handleToggleSeasonalTask} />
            <SmartSuggestion records={records} />
            
            <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Home</h2>
                <HomeStats records={records} contractors={contractors} />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={onNavigateToItems} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
                        <span className="font-bold text-slate-700 text-sm">View All Items</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button onClick={onNavigateToContractors} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group">
                    <div className="flex items-center gap-3">
                        <Wrench className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
                        <span className="font-bold text-slate-700 text-sm">My Contractors</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
            </div>
        </div>
    );
};
