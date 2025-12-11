// src/features/dashboard/ModernDashboard.jsx
// ============================================
// 🏠 MODERN DASHBOARD - Redesigned for clarity and delight
// ============================================

import React, { useMemo } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench
} from 'lucide-react';

// ============================================
// CONFIG - Maintenance frequencies
// ============================================
const MAINTENANCE_FREQUENCIES = [
    { value: 'monthly', label: 'Monthly', months: 1 },
    { value: 'quarterly', label: 'Quarterly', months: 3 },
    { value: 'biannual', label: 'Every 6 months', months: 6 },
    { value: 'annual', label: 'Annually', months: 12 },
    { value: '2years', label: 'Every 2 years', months: 24 },
    { value: '5years', label: 'Every 5 years', months: 60 },
    { value: 'none', label: 'No maintenance', months: 0 },
];

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

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    }).format(amount);
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
    return { text: 'Good evening', emoji: '🌙' };
};

// ============================================
// SUB-COMPONENTS
// ============================================

// Animated gradient ring for the health score
const HealthRing = ({ score, size = 160 }) => {
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    const getColor = () => {
        if (score >= 80) return { stroke: '#10b981', glow: '#10b98140' };
        if (score >= 60) return { stroke: '#f59e0b', glow: '#f59e0b40' };
        return { stroke: '#ef4444', glow: '#ef444440' };
    };
    
    const color = getColor();
    
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#e2e8f0"
                    strokeWidth="12"
                    fill="none"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color.stroke}
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                        transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s ease',
                        filter: `drop-shadow(0 0 8px ${color.glow})`
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black" style={{ color: color.stroke }}>
                    {score}
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                    Health Score
                </span>
            </div>
        </div>
    );
};

// Quick action button with hover animation
const QuickAction = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => {
    const variants = {
        default: 'bg-white border-slate-200 hover:border-slate-300 text-slate-600',
        primary: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700',
        warning: 'bg-amber-50 border-amber-200 hover:border-amber-300 text-amber-700',
    };
    
    return (
        <button
            onClick={onClick}
            className={`
                group flex items-center gap-3 p-4 rounded-2xl border-2 
                transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
                active:translate-y-0 active:shadow-sm w-full
                ${variants[variant]}
            `}
        >
            <div className={`
                p-2.5 rounded-xl transition-transform duration-200 
                group-hover:scale-110 group-active:scale-95
                ${variant === 'primary' ? 'bg-emerald-100' : 
                  variant === 'warning' ? 'bg-amber-100' : 'bg-slate-100'}
            `}>
                <Icon size={22} />
            </div>
            <div className="text-left">
                <p className="font-bold text-sm">{label}</p>
                {sublabel && <p className="text-xs opacity-70">{sublabel}</p>}
            </div>
        </button>
    );
};

// Attention card for items needing action
const AttentionCard = ({ icon: Icon, title, description, action, actionLabel, variant = 'warning' }) => {
    const variants = {
        warning: {
            bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
            border: 'border-amber-200',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            buttonBg: 'bg-amber-500 hover:bg-amber-600',
        },
        danger: {
            bg: 'bg-gradient-to-br from-rose-50 to-red-50',
            border: 'border-rose-200',
            iconBg: 'bg-rose-100',
            iconColor: 'text-rose-600',
            buttonBg: 'bg-rose-500 hover:bg-rose-600',
        },
        info: {
            bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
            border: 'border-blue-200',
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            buttonBg: 'bg-blue-500 hover:bg-blue-600',
        },
    };
    
    const style = variants[variant];
    
    return (
        <div className={`${style.bg} ${style.border} border rounded-2xl p-5 transition-all duration-200 hover:shadow-md`}>
            <div className="flex items-start gap-4">
                <div className={`${style.iconBg} p-3 rounded-xl shrink-0`}>
                    <Icon className={`h-6 w-6 ${style.iconColor}`} />
                </div>
                <div className="flex-grow min-w-0">
                    <h3 className="font-bold text-slate-800 mb-1">{title}</h3>
                    <p className="text-sm text-slate-600 mb-3">{description}</p>
                    {action && (
                        <button
                            onClick={action}
                            className={`${style.buttonBg} text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2`}
                        >
                            {actionLabel}
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Section header with optional action
const SectionHeader = ({ title, action, actionLabel }) => (
    <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {action && (
            <button
                onClick={action}
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
                {actionLabel}
                <ChevronRight size={16} />
            </button>
        )}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const ModernDashboard = ({
    records = [],
    contractors = [],
    activeProperty,
    onScanReceipt,
    onAddRecord,
    onNavigateToItems,
    onNavigateToContractors,
    onNavigateToReports,
    onNavigateToMaintenance,
    onCreateContractorLink,
}) => {
    const greeting = getGreeting();
    
    // Calculate health score and metrics
    const metrics = useMemo(() => {
        const now = new Date();
        let overdueCount = 0;
        let upcomingCount = 0;
        let healthyCount = 0;
        let totalTracked = 0;
        const overdueTasks = [];
        const upcomingTasks = [];
        
        records.forEach(record => {
            const nextDate = getNextServiceDate(record);
            if (nextDate) {
                totalTracked++;
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntil < 0) {
                    overdueCount++;
                    overdueTasks.push({ ...record, daysOverdue: Math.abs(daysUntil) });
                } else if (daysUntil <= 30) {
                    upcomingCount++;
                    upcomingTasks.push({ ...record, daysUntil });
                } else {
                    healthyCount++;
                }
            }
        });
        
        // Calculate score: 100 - penalties
        const total = totalTracked || 1;
        const overduePenalty = (overdueCount / total) * 50;
        const upcomingPenalty = (upcomingCount / total) * 20;
        const score = Math.max(0, Math.round(100 - overduePenalty - upcomingPenalty));
        
        // Calculate total investment
        const totalSpent = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        return {
            score: records.length === 0 ? 100 : score,
            overdueCount,
            upcomingCount,
            healthyCount,
            totalTracked,
            totalSpent,
            overdueTasks: overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue),
            upcomingTasks: upcomingTasks.sort((a, b) => a.daysUntil - b.daysUntil),
        };
    }, [records]);
    
    // Get score message
    const getScoreMessage = () => {
        if (records.length === 0) return "Add items to start tracking your home's health!";
        if (metrics.score >= 90) return "Your home is in excellent shape! 🎉";
        if (metrics.score >= 75) return "Looking good! Just a few things to check.";
        if (metrics.score >= 50) return "Some items need your attention.";
        return "Time to catch up on maintenance!";
    };
    
    return (
        <div className="space-y-8 pb-8">
            
            {/* ============================================ */}
            {/* HERO SECTION - Health Score Focus */}
            {/* ============================================ */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem]" />
                
                <div 
                    className="absolute inset-0 opacity-5 rounded-[2rem]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zM22.344 0L13.858 8.485 15.272 9.9l9.9-9.9h-2.83zM32 0l-3.486 3.485L26.1 5.9 32 0zm0 60l-3.486-3.485L26.1 54.1 32 60z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                    }}
                />
                
                <div className="relative z-10 p-8 text-white">
                    {/* Greeting */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">
                                {greeting.emoji} {greeting.text}
                            </p>
                            <h1 className="text-2xl font-bold mt-1">
                                {activeProperty?.name || 'My Home'}
                            </h1>
                        </div>
                        
                        <button
                            onClick={onScanReceipt}
                            className="bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-xl border border-white/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <Camera size={22} />
                        </button>
                    </div>
                    
                    {/* Health Score Center */}
                    <div className="flex flex-col items-center py-4">
                        <HealthRing score={metrics.score} />
                        <p className="text-slate-300 text-sm mt-4 text-center max-w-xs">
                            {getScoreMessage()}
                        </p>
                    </div>
                    
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <button
                            onClick={onNavigateToItems}
                            className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white/20 transition-colors"
                        >
                            <p className="text-2xl font-black">{records.length}</p>
                            <p className="text-xs text-slate-400 font-medium">Items</p>
                        </button>
                        <button
                            onClick={onNavigateToContractors}
                            className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center hover:bg-white/20 transition-colors"
                        >
                            <p className="text-2xl font-black">{contractors.length}</p>
                            <p className="text-xs text-slate-400 font-medium">Pros</p>
                        </button>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                            <p className="text-2xl font-black text-emerald-400">
                                {formatCurrency(metrics.totalSpent)}
                            </p>
                            <p className="text-xs text-slate-400 font-medium">Invested</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* ============================================ */}
            {/* ATTENTION NEEDED - Only if there are issues */}
            {/* ============================================ */}
            {(metrics.overdueCount > 0 || metrics.upcomingCount > 0) && (
                <div className="space-y-4">
                    <SectionHeader 
                        title="Needs Attention" 
                        action={onNavigateToItems}
                        actionLabel="View all"
                    />
                    
                    {/* Overdue items (most urgent) */}
                    {metrics.overdueTasks.slice(0, 2).map((task) => (
                        <AttentionCard
                            key={task.id}
                            icon={AlertTriangle}
                            title={task.item}
                            description={`${task.daysOverdue} days overdue for maintenance`}
                            variant="danger"
                            action={() => onNavigateToItems && onNavigateToItems()}
                            actionLabel="View Item"
                        />
                    ))}
                    
                    {/* Upcoming items */}
                    {metrics.overdueCount === 0 && metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <AttentionCard
                            key={task.id}
                            icon={Clock}
                            title={task.item}
                            description={`Due in ${task.daysUntil} days`}
                            variant="warning"
                            action={() => onNavigateToItems && onNavigateToItems()}
                            actionLabel="Schedule"
                        />
                    ))}
                </div>
            )}
            
            {/* ============================================ */}
            {/* QUICK ACTIONS - Primary ways to interact */}
            {/* ============================================ */}
            <div>
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                    <QuickAction
                        icon={Camera}
                        label="Scan Receipt"
                        sublabel="AI-powered"
                        onClick={onScanReceipt}
                        variant="primary"
                    />
                    <QuickAction
                        icon={Plus}
                        label="Add Item"
                        sublabel="Manual entry"
                        onClick={onAddRecord || onScanReceipt}
                    />
                    <QuickAction
                        icon={Wrench}
                        label="Request Service"
                        sublabel="Create pro link"
                        onClick={onCreateContractorLink || onNavigateToContractors}
                    />
                    <QuickAction
                        icon={FileText}
                        label="Home Report"
                        sublabel="Share or print"
                        onClick={onNavigateToReports}
                    />
                </div>
            </div>
            
            {/* ============================================ */}
            {/* RECENT ACTIVITY - Show last few items */}
            {/* ============================================ */}
            {records.length > 0 && (
                <div>
                    <SectionHeader 
                        title="Recent Items" 
                        action={onNavigateToItems}
                        actionLabel="View all"
                    />
                    <div className="space-y-3">
                        {records.slice(0, 3).map((record) => (
                            <div
                                key={record.id}
                                onClick={() => onNavigateToItems && onNavigateToItems()}
                                className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
                            >
                                {record.imageUrl ? (
                                    <img
                                        src={record.imageUrl}
                                        alt={record.item}
                                        className="h-14 w-14 rounded-xl object-cover"
                                    />
                                ) : (
                                    <div className="h-14 w-14 bg-slate-100 rounded-xl flex items-center justify-center">
                                        <Package size={24} className="text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-grow min-w-0">
                                    <h3 className="font-bold text-slate-800 truncate">
                                        {record.item}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {record.brand || record.category}
                                    </p>
                                </div>
                                {record.cost > 0 && (
                                    <p className="text-sm font-bold text-emerald-600">
                                        {formatCurrency(record.cost)}
                                    </p>
                                )}
                                <ChevronRight size={20} className="text-slate-300" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* ============================================ */}
            {/* EMPTY STATE - Encouraging first-time users */}
            {/* ============================================ */}
            {records.length === 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] p-8 text-center border border-emerald-100">
                    <div className="inline-flex p-4 bg-white rounded-2xl shadow-lg mb-4">
                        <Sparkles className="h-10 w-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        Let's get started!
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                        Add your first item to start building your home's digital memory. 
                        Try scanning a recent receipt or adding your HVAC system.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={onScanReceipt}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Camera size={20} />
                            Scan a Receipt
                        </button>
                        <button
                            onClick={onAddRecord || onScanReceipt}
                            className="px-6 py-3 bg-white text-slate-700 rounded-xl font-bold border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            Add Manually
                        </button>
                    </div>
                </div>
            )}
            
        </div>
    );
};

export default ModernDashboard;
