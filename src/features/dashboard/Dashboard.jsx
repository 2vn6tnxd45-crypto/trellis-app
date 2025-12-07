// src/features/dashboard/Dashboard.jsx
// ============================================
// 🏠 THE NEW KRIB DASHBOARD
// ============================================
// Philosophy: Krib works FOR you. Minimal effort, maximum value.
// - Quick actions for common tasks
// - "Needs Attention" cards for urgent items  
// - Seasonal guidance
// - Smart suggestions based on your home's data

import React, { useState, useMemo } from 'react';
import { 
    Camera, 
    CheckCircle2, 
    ShoppingCart, 
    AlertCircle, 
    Clock, 
    ChevronRight,
    Sparkles,
    Calendar,
    DollarSign,
    Home,
    Wrench,
    ThermometerSun,
    Snowflake,
    Leaf,
    Sun,
    Bell,
    BellOff,
    ExternalLink,
    Phone,
    Package,
    TrendingUp,
    Shield,
    Zap,
    Link as LinkIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';

// ============================================
// HELPER FUNCTIONS
// ============================================

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
    switch(season) {
        case 'spring': return <Leaf className="h-5 w-5 text-green-500" />;
        case 'summer': return <Sun className="h-5 w-5 text-yellow-500" />;
        case 'fall': return <Leaf className="h-5 w-5 text-orange-500" />;
        case 'winter': return <Snowflake className="h-5 w-5 text-blue-500" />;
        default: return <Calendar className="h-5 w-5 text-slate-500" />;
    }
};

const SEASONAL_CHECKLISTS = {
    spring: [
        { id: 'sp1', task: 'Service AC unit before summer', category: 'HVAC', priority: 'high' },
        { id: 'sp2', task: 'Clean gutters and downspouts', category: 'Exterior', priority: 'medium' },
        { id: 'sp3', task: 'Inspect roof for winter damage', category: 'Roof', priority: 'high' },
        { id: 'sp4', task: 'Test sprinkler system', category: 'Landscaping', priority: 'low' },
        { id: 'sp5', task: 'Check window screens', category: 'Interior', priority: 'low' },
        { id: 'sp6', task: 'Power wash deck/patio', category: 'Exterior', priority: 'low' },
    ],
    summer: [
        { id: 'su1', task: 'Replace HVAC filters (high usage)', category: 'HVAC', priority: 'high' },
        { id: 'su2', task: 'Check weatherstripping on doors', category: 'Interior', priority: 'medium' },
        { id: 'su3', task: 'Inspect caulking around windows', category: 'Exterior', priority: 'medium' },
        { id: 'su4', task: 'Clean dryer vent', category: 'Appliances', priority: 'high' },
        { id: 'su5', task: 'Test garage door safety features', category: 'Safety', priority: 'medium' },
    ],
    fall: [
        { id: 'fa1', task: 'Schedule furnace tune-up', category: 'HVAC', priority: 'high' },
        { id: 'fa2', task: 'Clean gutters (falling leaves)', category: 'Exterior', priority: 'high' },
        { id: 'fa3', task: 'Test smoke & CO detectors', category: 'Safety', priority: 'high' },
        { id: 'fa4', task: 'Winterize outdoor faucets', category: 'Plumbing', priority: 'high' },
        { id: 'fa5', task: 'Check insulation in attic', category: 'Interior', priority: 'medium' },
        { id: 'fa6', task: 'Reverse ceiling fan direction', category: 'Interior', priority: 'low' },
        { id: 'fa7', task: 'Store/cover patio furniture', category: 'Exterior', priority: 'low' },
    ],
    winter: [
        { id: 'wi1', task: 'Check for ice dams on roof', category: 'Roof', priority: 'high' },
        { id: 'wi2', task: 'Replace HVAC filter', category: 'HVAC', priority: 'high' },
        { id: 'wi3', task: 'Test sump pump', category: 'Plumbing', priority: 'medium' },
        { id: 'wi4', task: 'Check pipe insulation', category: 'Plumbing', priority: 'high' },
        { id: 'wi5', task: 'Inspect fireplace/chimney', category: 'Safety', priority: 'medium' },
    ]
};

// ============================================
// QUICK ACTIONS COMPONENT
// ============================================

const QuickActions = ({ onScanReceipt, onCreateContractorLink, onMarkTaskDone }) => {
    return (
        <div className="grid grid-cols-4 gap-3">
            <button 
                onClick={onScanReceipt}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
            >
                <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-emerald-200 transition-colors">
                    <Camera className="h-6 w-6 text-emerald-700" />
                </div>
                <span className="text-xs font-bold text-slate-600">Scan</span>
            </button>
            
            <button 
                onClick={onMarkTaskDone}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
            >
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors">
                    <CheckCircle2 className="h-6 w-6 text-blue-700" />
                </div>
                <span className="text-xs font-bold text-slate-600">Done</span>
            </button>
            
            <button 
                onClick={onCreateContractorLink}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
            >
                <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-purple-200 transition-colors">
                    <LinkIcon className="h-6 w-6 text-purple-700" />
                </div>
                <span className="text-xs font-bold text-slate-600">Pro Link</span>
            </button>
            
            <button 
                onClick={() => toast('Emergency guide coming soon!', { icon: '🆘' })}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-red-300 hover:bg-red-50 transition-all group"
            >
                <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center mb-2 group-hover:bg-red-200 transition-colors">
                    <AlertCircle className="h-6 w-6 text-red-700" />
                </div>
                <span className="text-xs font-bold text-slate-600">SOS</span>
            </button>
        </div>
    );
};

// ============================================
// NEEDS ATTENTION CARD
// ============================================

const NeedsAttentionCard = ({ task, onDone, onSnooze, onOrderPart }) => {
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
                <button 
                    onClick={() => onDone(task)}
                    className="flex-1 py-2 px-3 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
                >
                    <CheckCircle2 className="h-3 w-3" /> Done
                </button>
                <button 
                    onClick={() => onSnooze(task)}
                    className="py-2 px-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1"
                >
                    <Clock className="h-3 w-3" /> Snooze
                </button>
                {task.purchaseLink && (
                    <a 
                        href={task.purchaseLink}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-1"
                    >
                        <ShoppingCart className="h-3 w-3" /> Order
                    </a>
                )}
            </div>
        </div>
    );
};

// ============================================
// SEASONAL CHECKLIST COMPONENT
// ============================================

const SeasonalChecklist = ({ completedTasks, onToggleTask }) => {
    const season = getCurrentSeason();
    const seasonName = season.charAt(0).toUpperCase() + season.slice(1);
    const tasks = SEASONAL_CHECKLISTS[season] || [];
    const completedCount = tasks.filter(t => completedTasks.includes(t.id)).length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
    
    const [isExpanded, setIsExpanded] = useState(false);
    
    return (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {getSeasonIcon(season)}
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800">{seasonName} Checklist</h3>
                        <p className="text-xs text-slate-500">{completedCount} of {tasks.length} tasks complete</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </button>
            
            {isExpanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
                    {tasks.map(task => {
                        const isCompleted = completedTasks.includes(task.id);
                        return (
                            <button
                                key={task.id}
                                onClick={() => onToggleTask(task.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${isCompleted ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'}`}
                            >
                                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                    {isCompleted && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-grow">
                                    <p className={`text-sm font-medium ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                        {task.task}
                                    </p>
                                    <p className="text-xs text-slate-400">{task.category}</p>
                                </div>
                                {task.priority === 'high' && !isCompleted && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                        Important
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================
// SMART SUGGESTION COMPONENT  
// ============================================

const SmartSuggestion = ({ records }) => {
    // Generate a smart suggestion based on the user's data
    const suggestion = useMemo(() => {
        if (records.length === 0) {
            return {
                icon: <Sparkles className="h-5 w-5 text-purple-600" />,
                title: "Get started with Smart Suggestions",
                message: "Add a few items to your home inventory and we'll start providing personalized maintenance tips.",
                action: null
            };
        }
        
        // Find aging systems
        const hvacRecords = records.filter(r => r.category === 'HVAC & Systems');
        const waterHeaters = records.filter(r => r.item?.toLowerCase().includes('water heater'));
        const roofRecords = records.filter(r => r.category === 'Roof & Exterior' || r.item?.toLowerCase().includes('roof'));
        
        // Check for old water heater
        if (waterHeaters.length > 0) {
            const oldest = waterHeaters.reduce((a, b) => 
                new Date(a.dateInstalled) < new Date(b.dateInstalled) ? a : b
            );
            const age = Math.floor((new Date() - new Date(oldest.dateInstalled)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age >= 8) {
                return {
                    icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
                    title: `Your water heater is ${age} years old`,
                    message: `Average lifespan is 10-12 years. Consider budgeting $1,200-$1,800 for replacement in the next ${12 - age} years.`,
                    action: { label: "Learn more", url: "https://www.google.com/search?q=water+heater+lifespan" }
                };
            }
        }
        
        // Check for old HVAC
        if (hvacRecords.length > 0) {
            const oldest = hvacRecords.reduce((a, b) => 
                new Date(a.dateInstalled) < new Date(b.dateInstalled) ? a : b
            );
            const age = Math.floor((new Date() - new Date(oldest.dateInstalled)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age >= 10) {
                return {
                    icon: <ThermometerSun className="h-5 w-5 text-orange-600" />,
                    title: `Your HVAC system is ${age} years old`,
                    message: `Most systems last 15-20 years. Regular maintenance can extend its life significantly.`,
                    action: { label: "Find HVAC pros", url: "#" }
                };
            }
        }
        
        // Default suggestion
        const season = getCurrentSeason();
        const seasonTips = {
            spring: "Spring is the perfect time to service your AC before summer heat arrives.",
            summer: "Running your AC? Replace filters monthly for best efficiency and air quality.",
            fall: "Schedule a furnace tune-up now before the winter rush and cold weather.",
            winter: "Check your pipe insulation to prevent freezing during cold snaps."
        };
        
        return {
            icon: <Sparkles className="h-5 w-5 text-purple-600" />,
            title: "Seasonal Tip",
            message: seasonTips[season],
            action: null
        };
        
    }, [records]);
    
    return (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100">
            <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm">
                    {suggestion.icon}
                </div>
                <div className="flex-grow">
                    <h4 className="font-bold text-slate-800 text-sm">{suggestion.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{suggestion.message}</p>
                    {suggestion.action && (
                        <a 
                            href={suggestion.action.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 mt-2 hover:text-purple-800"
                        >
                            {suggestion.action.label} <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// HOME STATS COMPONENT
// ============================================

const HomeStats = ({ records, contractors }) => {
    const totalItems = records.length;
    const totalContractors = contractors?.length || 0;
    
    // Calculate total investment (if we had cost data)
    // For now, just show item count
    
    return (
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                <p className="text-2xl font-extrabold text-emerald-600">{totalItems}</p>
                <p className="text-xs text-slate-500 font-medium">Items Tracked</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                <p className="text-2xl font-extrabold text-blue-600">{totalContractors}</p>
                <p className="text-xs text-slate-500 font-medium">Pros Saved</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                <div className="flex items-center justify-center gap-1">
                    <Shield className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">Protected</p>
            </div>
        </div>
    );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export const Dashboard = ({ 
    records, 
    contractors = [],
    propertyName,
    onScanReceipt, 
    onNavigateToItems,
    onNavigateToContractors,
    onCreateContractorLink
}) => {
    // State for seasonal checklist
    const [completedSeasonalTasks, setCompletedSeasonalTasks] = useState(() => {
        const saved = localStorage.getItem('krib_seasonal_tasks');
        return saved ? JSON.parse(saved) : [];
    });
    
    // Calculate tasks that need attention
    const needsAttention = useMemo(() => {
        const now = new Date();
        const tasks = [];
        
        records.forEach(record => {
            const nextDate = getNextServiceDate(record);
            if (nextDate) {
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                // Show if due within 30 days or overdue
                if (daysUntil <= 30) {
                    tasks.push({ ...record, nextDate, daysUntil });
                }
            }
        });
        
        return tasks.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3);
    }, [records]);
    
    const handleToggleSeasonalTask = (taskId) => {
        setCompletedSeasonalTasks(prev => {
            const newTasks = prev.includes(taskId) 
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId];
            localStorage.setItem('krib_seasonal_tasks', JSON.stringify(newTasks));
            
            if (!prev.includes(taskId)) {
                toast.success('Task completed! 🎉');
            }
            return newTasks;
        });
    };
    
    const handleTaskDone = (task) => {
        toast.success(`Marked "${task.item}" as done!`);
        // In a real app, you'd update the record's lastServiceDate here
    };
    
    const handleSnoozeTask = (task) => {
        toast('Snoozed for 1 week', { icon: '😴' });
        // In a real app, you'd update the snooze date
    };
    
    const handleMarkTaskDone = () => {
        if (needsAttention.length > 0) {
            handleTaskDone(needsAttention[0]);
        } else {
            toast('No pending tasks!', { icon: '✨' });
        }
    };
    
    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800">{getGreeting()}!</h1>
                    <p className="text-slate-500 text-sm">Here's what's happening with {propertyName || 'your home'}</p>
                </div>
            </div>
            
            {/* Quick Actions */}
            <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
                <QuickActions 
                    onScanReceipt={onScanReceipt}
                    onCreateContractorLink={onCreateContractorLink}
                    onMarkTaskDone={handleMarkTaskDone}
                />
            </div>
            
            {/* Needs Attention */}
            {needsAttention.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Bell className="h-3 w-3" />
                            Needs Attention ({needsAttention.length})
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {needsAttention.map(task => (
                            <NeedsAttentionCard 
                                key={task.id}
                                task={task}
                                onDone={handleTaskDone}
                                onSnooze={handleSnoozeTask}
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {/* No tasks state */}
            {needsAttention.length === 0 && records.length > 0 && (
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 text-center">
                    <div className="inline-flex p-3 bg-emerald-100 rounded-full mb-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-emerald-900">All caught up!</h3>
                    <p className="text-sm text-emerald-700 mt-1">No maintenance tasks due soon.</p>
                </div>
            )}
            
            {/* Seasonal Checklist */}
            <SeasonalChecklist 
                completedTasks={completedSeasonalTasks}
                onToggleTask={handleToggleSeasonalTask}
            />
            
            {/* Home Stats */}
            <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Home</h2>
                <HomeStats records={records} contractors={contractors} />
            </div>
            
            {/* Smart Suggestion */}
            <SmartSuggestion records={records} />
            
            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onNavigateToItems}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
                        <span className="font-bold text-slate-700 text-sm">View All Items</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                
                <button 
                    onClick={onNavigateToContractors}
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
                >
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
