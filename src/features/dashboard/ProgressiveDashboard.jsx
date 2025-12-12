// src/features/dashboard/ProgressiveDashboard.jsx
// ============================================
// 🏠 PROGRESSIVE DASHBOARD
// ============================================
// Adapts UI complexity based on user's data maturity.
// New users see inspiration, established users see full features.

import React, { useMemo, useState } from 'react';
import { 
    Camera, Plus, Package, FileText, Wrench, ChevronRight,
    Sparkles, Home, ArrowRight, CheckCircle2, Clock, Star,
    TrendingUp, Shield, AlertTriangle, Calendar, DollarSign
} from 'lucide-react';
import { ReportTeaser } from './ReportTeaser';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';

// ============================================
// HELPERS
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
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

// ============================================
// STAGE 1: EMPTY STATE (0 items)
// ============================================

const EmptyHomeState = ({ propertyName, onAddItem, onScanReceipt }) => (
    <div className="space-y-8">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] p-8 text-white overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
            
            <div className="relative z-10 text-center py-8">
                {/* Floating illustration */}
                <div className="relative mx-auto w-32 h-32 mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl rotate-6 opacity-80" />
                    <div className="absolute inset-0 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
                        <Home className="h-16 w-16 text-slate-800" />
                    </div>
                    {/* Floating badges */}
                    <div className="absolute -top-2 -right-4 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-bounce">
                        ✨
                    </div>
                </div>
                
                <h1 className="text-3xl font-extrabold mb-3">
                    Welcome to {propertyName || 'your home'}
                </h1>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                    Every paint color, every appliance, every repair — 
                    Krib remembers it all so you don't have to.
                </p>
            </div>
        </div>

        {/* Quick Start Options */}
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 px-1">Get started</h2>
            
            <button 
                onClick={onScanReceipt}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6 rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 text-left group"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                        <Camera className="h-8 w-8" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-xl font-bold">Snap a photo</h3>
                        <p className="text-emerald-100 text-sm mt-1">
                            Receipt, appliance label, paint can — AI does the rest
                        </p>
                    </div>
                    <ArrowRight className="h-6 w-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
            </button>
            
            <button 
                onClick={onAddItem}
                className="w-full bg-white border-2 border-slate-200 hover:border-emerald-300 p-5 rounded-2xl transition-all hover:shadow-md text-left group"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-emerald-50 transition-colors">
                        <Plus className="h-6 w-6 text-slate-600 group-hover:text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Add manually</h3>
                        <p className="text-slate-500 text-sm">Type in details yourself</p>
                    </div>
                </div>
            </button>
        </div>

        {/* What to track suggestions */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-amber-500" />
                Popular first items
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {[
                    { emoji: '🌡️', label: 'HVAC System', sub: 'Furnace, AC' },
                    { emoji: '🚰', label: 'Water Heater', sub: 'Tank or tankless' },
                    { emoji: '🎨', label: 'Paint Colors', sub: 'Wall colors' },
                    { emoji: '🏠', label: 'Roof', sub: 'Type & age' },
                ].map((item, i) => (
                    <button 
                        key={i}
                        onClick={onAddItem}
                        className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left"
                    >
                        <span className="text-2xl">{item.emoji}</span>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                            <p className="text-xs text-slate-400">{item.sub}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Social proof */}
        <p className="text-center text-sm text-slate-400">
            Join <span className="font-bold text-slate-600">12,847</span> homeowners tracking their homes
        </p>
    </div>
);

// ============================================
// STAGE 2: GETTING STARTED (1-4 items)
// ============================================

const GettingStartedDashboard = ({ 
    records, 
    propertyName,
    onAddItem, 
    onScanReceipt,
    onNavigateToItems 
}) => {
    const totalItems = records.length;
    const targetItems = 5;
    const progress = Math.min(100, (totalItems / targetItems) * 100);
    const totalSpent = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
    
    return (
        <div className="space-y-6">
            {/* Progress Hero */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-[2rem] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5" />
                        <span className="text-emerald-100 text-sm font-bold uppercase tracking-wide">Building Your Profile</span>
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-4">
                        {totalItems} item{totalItems !== 1 ? 's' : ''} tracked
                    </h2>
                    
                    {/* Progress bar */}
                    <div className="bg-white/20 rounded-full h-3 mb-2 overflow-hidden">
                        <div 
                            className="bg-white h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-emerald-100 text-sm">
                        Add {targetItems - totalItems} more to unlock your Home Health Score
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onScanReceipt}
                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group"
                >
                    <div className="bg-emerald-50 p-3 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform">
                        <Camera className="h-6 w-6 text-emerald-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">Scan</h3>
                    <p className="text-xs text-slate-500 mt-1">Photo or receipt</p>
                </button>
                
                <button 
                    onClick={onNavigateToItems}
                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group"
                >
                    <div className="bg-slate-100 p-3 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform">
                        <Package className="h-6 w-6 text-slate-600" />
                    </div>
                    <h3 className="font-bold text-slate-800">View Items</h3>
                    <p className="text-xs text-slate-500 mt-1">{totalItems} recorded</p>
                </button>
            </div>

            {/* Recent Items */}
            {records.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800">Recently Added</h3>
                        <button 
                            onClick={onNavigateToItems}
                            className="text-sm text-emerald-600 font-bold hover:text-emerald-700 flex items-center"
                        >
                            See all <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {records.slice(0, 3).map((record) => (
                            <div key={record.id} className="p-4 flex items-center gap-4">
                                <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                                    {record.imageUrl ? (
                                        <img src={record.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="h-5 w-5 text-slate-400" />
                                    )}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <p className="font-bold text-slate-800 truncate">{record.item}</p>
                                    <p className="text-xs text-slate-500">{record.category}</p>
                                </div>
                                {record.cost > 0 && (
                                    <span className="text-sm font-bold text-emerald-600">
                                        {formatCurrency(record.cost)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Investment Summary (if any costs recorded) */}
            {totalSpent > 0 && (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                                <DollarSign className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Total Tracked</p>
                                <p className="text-xl font-extrabold text-slate-800">{formatCurrency(totalSpent)}</p>
                            </div>
                        </div>
                        <button 
                            onClick={onScanReceipt}
                            className="text-emerald-600 hover:text-emerald-700"
                        >
                            <Plus className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            )}

            {/* Report Teaser */}
            <ReportTeaser 
                recordCount={totalItems} 
                requiredCount={5}
                onAddMore={onScanReceipt}
            />
        </div>
    );
};

// ============================================
// STAGE 3: BUILDING (5-19 items)
// ============================================

const BuildingDashboard = ({ 
    records,
    contractors,
    activeProperty,
    onScanReceipt,
    onNavigateToItems,
    onNavigateToContractors,
    onNavigateToReports
}) => {
    const metrics = useMemo(() => {
        const now = new Date();
        let overdueCount = 0;
        let upcomingCount = 0;
        const overdueTasks = [];
        const upcomingTasks = [];
        
        records.forEach(record => {
            const nextDate = getNextServiceDate(record);
            if (nextDate) {
                const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                if (daysUntil < 0) {
                    overdueCount++;
                    overdueTasks.push({ ...record, daysOverdue: Math.abs(daysUntil) });
                } else if (daysUntil <= 30) {
                    upcomingCount++;
                    upcomingTasks.push({ ...record, daysUntil });
                }
            }
        });
        
        const totalSpent = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
        
        // Calculate simple health score now that we have enough data
        const baseScore = 100;
        const overduePenalty = Math.min(40, overdueCount * 10);
        const upcomingPenalty = Math.min(20, upcomingCount * 5);
        const score = Math.max(0, baseScore - overduePenalty - upcomingPenalty);
        
        return { 
            score,
            overdueCount, 
            upcomingCount, 
            totalSpent, 
            overdueTasks, 
            upcomingTasks 
        };
    }, [records]);

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 60) return 'text-amber-500';
        return 'text-red-500';
    };

    const getScoreRingColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="space-y-6">
            {/* Health Score Hero */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <circle cx="80" cy="20" r="40" fill="white" />
                        <circle cx="20" cy="80" r="30" fill="white" />
                    </svg>
                </div>
                
                <div className="relative z-10 flex items-center gap-8">
                    {/* Score Ring */}
                    <div className="relative shrink-0">
                        <svg width="120" height="120" className="transform -rotate-90">
                            <circle
                                cx="60" cy="60" r="50"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="10"
                                fill="none"
                            />
                            <circle
                                cx="60" cy="60" r="50"
                                stroke={getScoreRingColor(metrics.score)}
                                strokeWidth="10"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={`${metrics.score * 3.14} 314`}
                                style={{ filter: `drop-shadow(0 0 8px ${getScoreRingColor(metrics.score)}40)` }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-4xl font-extrabold ${getScoreColor(metrics.score)}`}>
                                {metrics.score}
                            </span>
                            <span className="text-xs text-slate-400 font-bold uppercase">Health</span>
                        </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex-grow">
                        <p className="text-slate-400 text-sm mb-1">{getGreeting()}</p>
                        <h2 className="text-2xl font-bold mb-4">{activeProperty?.name || 'My Home'}</h2>
                        <div className="flex gap-6">
                            <button onClick={onNavigateToItems} className="text-center hover:opacity-80 transition-opacity">
                                <p className="text-2xl font-bold">{records.length}</p>
                                <p className="text-xs text-slate-400">Items</p>
                            </button>
                            <button onClick={onNavigateToContractors} className="text-center hover:opacity-80 transition-opacity">
                                <p className="text-2xl font-bold">{contractors.length}</p>
                                <p className="text-xs text-slate-400">Pros</p>
                            </button>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-emerald-400">
                                    {formatCurrency(metrics.totalSpent).replace('$', '')}
                                    <span className="text-sm text-slate-400">$</span>
                                </p>
                                <p className="text-xs text-slate-400">Invested</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {metrics.overdueCount > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-red-100 p-2 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-900">
                                {metrics.overdueCount} Overdue
                            </h3>
                            <p className="text-xs text-red-700">Maintenance needed</p>
                        </div>
                    </div>
                    {metrics.overdueTasks.slice(0, 2).map((task) => (
                        <div key={task.id} className="bg-white p-3 rounded-xl border border-red-100 mb-2 last:mb-0 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800">{task.item}</p>
                                <p className="text-xs text-red-600">{task.daysOverdue} days overdue</p>
                            </div>
                            <button className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">
                                Fix
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upcoming */}
            {metrics.upcomingCount > 0 && metrics.overdueCount === 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-amber-100 p-2 rounded-lg">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-amber-900">Coming Up</h3>
                            <p className="text-xs text-amber-700">{metrics.upcomingCount} tasks this month</p>
                        </div>
                    </div>
                    {metrics.upcomingTasks.slice(0, 2).map((task) => (
                        <div key={task.id} className="bg-white p-3 rounded-xl border border-amber-100 mb-2 last:mb-0 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800">{task.item}</p>
                                <p className="text-xs text-amber-600">Due in {task.daysUntil} days</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { icon: Camera, label: 'Scan', action: onScanReceipt, color: 'bg-emerald-50 text-emerald-600' },
                    { icon: Package, label: 'Items', action: onNavigateToItems, color: 'bg-slate-100 text-slate-600' },
                    { icon: Wrench, label: 'Pros', action: onNavigateToContractors, color: 'bg-blue-50 text-blue-600' },
                    { icon: FileText, label: 'Report', action: onNavigateToReports, color: 'bg-purple-50 text-purple-600' },
                ].map((btn, i) => (
                    <button 
                        key={i}
                        onClick={btn.action}
                        className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all group"
                    >
                        <div className={`p-3 rounded-xl ${btn.color} group-hover:scale-110 transition-transform`}>
                            <btn.icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* Report Teaser (unlocked state) */}
            <ReportTeaser 
                recordCount={records.length} 
                requiredCount={5}
                isUnlocked={true}
                onViewReport={onNavigateToReports}
            />
        </div>
    );
};

// ============================================
// STAGE 4: ESTABLISHED (20+ items)
// Full featured dashboard - this imports the existing ModernDashboard
// ============================================

// ============================================
// MAIN EXPORT
// ============================================

export const ProgressiveDashboard = ({
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
    // Determine user stage
    const stage = useMemo(() => {
        if (records.length === 0) return 'empty';
        if (records.length < 5) return 'getting-started';
        if (records.length < 20) return 'building';
        return 'established';
    }, [records.length]);

    switch (stage) {
        case 'empty':
            return (
                <EmptyHomeState 
                    propertyName={activeProperty?.name}
                    onAddItem={onAddRecord}
                    onScanReceipt={onScanReceipt}
                />
            );
        
        case 'getting-started':
            return (
                <GettingStartedDashboard 
                    records={records}
                    propertyName={activeProperty?.name}
                    onAddItem={onAddRecord}
                    onScanReceipt={onScanReceipt}
                    onNavigateToItems={onNavigateToItems}
                />
            );
        
        case 'building':
        case 'established':
        default:
            return (
                <BuildingDashboard 
                    records={records}
                    contractors={contractors}
                    activeProperty={activeProperty}
                    onScanReceipt={onScanReceipt}
                    onNavigateToItems={onNavigateToItems}
                    onNavigateToContractors={onNavigateToContractors}
                    onNavigateToReports={onNavigateToReports}
                />
            );
    }
};

export default ProgressiveDashboard;
