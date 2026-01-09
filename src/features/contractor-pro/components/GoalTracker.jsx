// src/features/contractor-pro/components/GoalTracker.jsx
// ============================================
// GOAL TRACKER
// ============================================
// Track monthly revenue goals with visual progress
// Features:
// - Animated progress ring
// - Goal setting modal
// - Projected revenue from pending quotes
// - Monthly streak tracking
// - Milestone celebrations

import React, { useState, useMemo, useEffect } from 'react';
import {
    Target, TrendingUp, DollarSign, Edit2, Check, X,
    Zap, Award, Calendar, ChevronRight, Flame,
    PartyPopper, Trophy, Star, ArrowUp, ArrowDown,
    Clock, AlertCircle, Sparkles, Loader2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';

// ============================================
// CONSTANTS
// ============================================
const PRESET_GOALS = [
    { value: 5000, label: '$5K' },
    { value: 10000, label: '$10K' },
    { value: 15000, label: '$15K' },
    { value: 20000, label: '$20K' },
    { value: 25000, label: '$25K' },
    { value: 30000, label: '$30K' },
    { value: 50000, label: '$50K' },
    { value: 75000, label: '$75K' },
    { value: 100000, label: '$100K' },
];

const MILESTONES = [
    { percent: 25, icon: Zap, label: 'Getting Started!', color: 'text-blue-500' },
    { percent: 50, icon: TrendingUp, label: 'Halfway There!', color: 'text-purple-500' },
    { percent: 75, icon: Flame, label: 'On Fire!', color: 'text-orange-500' },
    { percent: 100, icon: Trophy, label: 'Goal Crushed!', color: 'text-amber-500' },
    { percent: 125, icon: PartyPopper, label: 'Overachiever!', color: 'text-emerald-500' },
];

// ============================================
// PROGRESS RING COMPONENT
// ============================================
const ProgressRing = ({ 
    progress, 
    size = 200, 
    strokeWidth = 12,
    showMilestones = true 
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const cappedProgress = Math.min(progress, 150); // Cap at 150% for display
    const offset = circumference - (cappedProgress / 100) * circumference;
    
    // Determine color based on progress
    const getProgressColor = () => {
        if (progress >= 100) return '#10b981'; // emerald
        if (progress >= 75) return '#f59e0b'; // amber
        if (progress >= 50) return '#8b5cf6'; // purple
        if (progress >= 25) return '#3b82f6'; // blue
        return '#94a3b8'; // slate
    };

    const color = getProgressColor();

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={strokeWidth}
                />
                
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
                
                {/* Milestone markers */}
                {showMilestones && [25, 50, 75, 100].map(milestone => {
                    const angle = (milestone / 100) * 360 - 90;
                    const rad = (angle * Math.PI) / 180;
                    const x = size / 2 + (radius + strokeWidth / 2 + 8) * Math.cos(rad);
                    const y = size / 2 + (radius + strokeWidth / 2 + 8) * Math.sin(rad);
                    const isReached = progress >= milestone;
                    
                    return (
                        <circle
                            key={milestone}
                            cx={x}
                            cy={y}
                            r={4}
                            fill={isReached ? color : '#cbd5e1'}
                            className="transition-all duration-300"
                        />
                    );
                })}
            </svg>
            
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-800">
                    {Math.round(progress)}%
                </span>
                <span className="text-sm text-slate-500 font-medium">of goal</span>
            </div>
            
            {/* Achievement badge */}
            {progress >= 100 && (
                <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    <Trophy size={24} className="text-white" />
                </div>
            )}
        </div>
    );
};

// ============================================
// GOAL SETTING MODAL
// ============================================
const GoalSettingModal = ({ 
    currentGoal, 
    onSave, 
    onClose,
    saving 
}) => {
    const [goal, setGoal] = useState(currentGoal || 10000);
    const [customMode, setCustomMode] = useState(!PRESET_GOALS.find(p => p.value === currentGoal));

    const handleSave = () => {
        if (goal < 100) {
            toast.error('Goal must be at least $100');
            return;
        }
        onSave(goal);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-xl">
                                <Target size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Set Monthly Goal</h2>
                                <p className="text-emerald-100 text-sm">What's your revenue target?</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Preset Options */}
                    {!customMode && (
                        <div>
                            <p className="text-sm font-medium text-slate-600 mb-3">Quick Select</p>
                            <div className="grid grid-cols-3 gap-2">
                                {PRESET_GOALS.map(preset => (
                                    <button
                                        key={preset.value}
                                        onClick={() => setGoal(preset.value)}
                                        className={`p-3 rounded-xl border-2 font-bold transition-all ${
                                            goal === preset.value
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                : 'border-slate-200 text-slate-600 hover:border-emerald-300'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Input */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-slate-600">
                                {customMode ? 'Enter Amount' : 'Or enter custom amount'}
                            </p>
                            {!customMode && (
                                <button
                                    onClick={() => setCustomMode(true)}
                                    className="text-xs text-emerald-600 font-medium hover:underline"
                                >
                                    Custom
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="number"
                                value={goal}
                                onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
                                className="w-full pl-10 pr-4 py-3 text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                placeholder="10000"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-sm text-slate-500 mb-1">Your monthly target</p>
                        <p className="text-3xl font-black text-slate-800">
                            ${goal.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                            ≈ ${Math.round(goal / 4).toLocaleString()}/week
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Check size={18} />
                        )}
                        Set Goal
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// STAT CARD
// ============================================
const StatCard = ({ icon: Icon, label, value, subValue, color = 'slate' }) => {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
        slate: 'bg-slate-50 text-slate-600',
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon size={16} />
                </div>
                <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-bold text-slate-800">{value}</p>
                    {subValue && <p className="text-xs text-slate-400">{subValue}</p>}
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN GOAL TRACKER COMPONENT
// ============================================
export const GoalTracker = ({
    contractorId,
    profile,
    quotes = [],
    jobs = [],
    variant = 'full' // 'full' | 'compact' | 'mini'
}) => {
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [savingGoal, setSavingGoal] = useState(false);

    // Get current goal from profile
    const currentGoal = profile?.goals?.monthlyRevenue || 10000;
    const goalHistory = profile?.goals?.history || [];

    // Calculate current month's revenue
    const monthlyStats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Revenue from accepted quotes this month
        const acceptedThisMonth = quotes.filter(q => {
            if (q.status !== 'accepted') return false;
            const acceptedDate = q.acceptedAt?.toDate?.() || new Date(q.acceptedAt);
            return acceptedDate >= startOfMonth && acceptedDate <= endOfMonth;
        });
        
        const revenue = acceptedThisMonth.reduce((sum, q) => sum + (q.total || 0), 0);
        
        // Pending revenue (sent/viewed quotes)
        const pendingQuotes = quotes.filter(q => ['sent', 'viewed'].includes(q.status));
        const pendingRevenue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0);
        
        // Projected (current + pending * conversion rate estimate)
        const historicalConversion = 0.35; // Could calculate from actual data
        const projectedRevenue = revenue + (pendingRevenue * historicalConversion);
        
        // Days left in month
        const daysInMonth = endOfMonth.getDate();
        const daysPassed = now.getDate();
        const daysLeft = daysInMonth - daysPassed;
        
        // Daily rate needed to hit goal
        const remaining = Math.max(0, currentGoal - revenue);
        const dailyNeeded = daysLeft > 0 ? remaining / daysLeft : 0;
        
        // Current daily average
        const dailyAverage = daysPassed > 0 ? revenue / daysPassed : 0;
        
        return {
            revenue,
            pendingRevenue,
            projectedRevenue,
            daysLeft,
            daysPassed,
            daysInMonth,
            dailyNeeded,
            dailyAverage,
            acceptedCount: acceptedThisMonth.length,
            pendingCount: pendingQuotes.length,
        };
    }, [quotes, currentGoal]);

    // Calculate progress percentage
    const progress = currentGoal > 0 ? (monthlyStats.revenue / currentGoal) * 100 : 0;
    const projectedProgress = currentGoal > 0 ? (monthlyStats.projectedRevenue / currentGoal) * 100 : 0;

    // Current milestone
    const currentMilestone = useMemo(() => {
        const reached = MILESTONES.filter(m => progress >= m.percent);
        return reached[reached.length - 1] || null;
    }, [progress]);

    // Next milestone
    const nextMilestone = useMemo(() => {
        return MILESTONES.find(m => progress < m.percent) || null;
    }, [progress]);

    // Save goal to Firebase
    const handleSaveGoal = async (newGoal) => {
        setSavingGoal(true);
        try {
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'goals.monthlyRevenue': newGoal,
                'goals.updatedAt': serverTimestamp(),
            });
            toast.success(`Goal set to $${newGoal.toLocaleString()}`);
            setShowGoalModal(false);
        } catch (error) {
            console.error('Error saving goal:', error);
            toast.error('Failed to save goal');
        } finally {
            setSavingGoal(false);
        }
    };

    // Get month name
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

    // ============================================
    // MINI VARIANT (for dashboard cards)
    // ============================================
    if (variant === 'mini') {
        return (
            <div 
                onClick={() => setShowGoalModal(true)}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white cursor-pointer hover:shadow-lg transition-all"
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-emerald-100 text-sm font-medium">{monthName} Goal</span>
                    <Target size={16} className="text-emerald-200" />
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-2xl font-black">{Math.round(progress)}%</p>
                        <p className="text-emerald-100 text-xs">
                            ${monthlyStats.revenue.toLocaleString()} / ${currentGoal.toLocaleString()}
                        </p>
                    </div>
                    <div className="w-12 h-12">
                        <svg viewBox="0 0 36 36" className="transform -rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                            <circle 
                                cx="18" cy="18" r="15" fill="none" 
                                stroke="white" strokeWidth="3"
                                strokeDasharray={`${Math.min(progress, 100) * 0.94} 94`}
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                </div>
            </div>
        );
    }

    // ============================================
    // COMPACT VARIANT (medium size)
    // ============================================
    if (variant === 'compact') {
        return (
            <>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-slate-800">{monthName} Goal</h3>
                            <p className="text-sm text-slate-500">Revenue target</p>
                        </div>
                        <button
                            onClick={() => setShowGoalModal(true)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Edit2 size={16} className="text-slate-400" />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <ProgressRing progress={progress} size={100} strokeWidth={8} showMilestones={false} />
                        
                        <div className="flex-1 space-y-2">
                            <div>
                                <p className="text-xs text-slate-500">Current</p>
                                <p className="text-xl font-bold text-emerald-600">
                                    ${monthlyStats.revenue.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Target</p>
                                <p className="text-lg font-bold text-slate-800">
                                    ${currentGoal.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {showGoalModal && (
                    <GoalSettingModal
                        currentGoal={currentGoal}
                        onSave={handleSaveGoal}
                        onClose={() => setShowGoalModal(false)}
                        saving={savingGoal}
                    />
                )}
            </>
        );
    }

    // ============================================
    // FULL VARIANT (complete dashboard widget)
    // ============================================
    return (
        <>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold">{monthName} Revenue Goal</h3>
                            <p className="text-slate-400 text-sm">{monthlyStats.daysLeft} days left this month</p>
                        </div>
                        <button
                            onClick={() => setShowGoalModal(true)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Edit2 size={14} />
                            Edit Goal
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-6">
                    <div className="flex flex-col lg:flex-row items-center gap-8">
                        {/* Progress Ring */}
                        <div className="flex-shrink-0">
                            <ProgressRing progress={progress} size={180} strokeWidth={14} />
                        </div>

                        {/* Stats */}
                        <div className="flex-1 w-full space-y-4">
                            {/* Current vs Goal */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 rounded-xl p-4">
                                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Earned</p>
                                    <p className="text-2xl font-black text-emerald-700">
                                        ${monthlyStats.revenue.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-emerald-600 mt-1">
                                        {monthlyStats.acceptedCount} quotes won
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Target</p>
                                    <p className="text-2xl font-black text-slate-700">
                                        ${currentGoal.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        ${Math.max(0, currentGoal - monthlyStats.revenue).toLocaleString()} to go
                                    </p>
                                </div>
                            </div>

                            {/* Pending & Projected */}
                            <div className="bg-amber-50 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
                                            Pending Revenue
                                        </p>
                                        <p className="text-xl font-bold text-amber-700">
                                            ${monthlyStats.pendingRevenue.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-amber-600">
                                            {monthlyStats.pendingCount} quotes awaiting response
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-amber-600 mb-1">Projected Total</p>
                                        <p className="text-lg font-bold text-amber-700">
                                            ${Math.round(monthlyStats.projectedRevenue).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-amber-600">
                                            {Math.round(projectedProgress)}% of goal
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Daily Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <TrendingUp size={16} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Daily Average</p>
                                        <p className="font-bold text-slate-700">
                                            ${Math.round(monthlyStats.dailyAverage).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Target size={16} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">Need/Day</p>
                                        <p className="font-bold text-slate-700">
                                            ${Math.round(monthlyStats.dailyNeeded).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Milestone Progress */}
                    {currentMilestone && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${
                                        progress >= 100 ? 'bg-amber-100' : 'bg-slate-100'
                                    }`}>
                                        <currentMilestone.icon 
                                            size={20} 
                                            className={currentMilestone.color} 
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{currentMilestone.label}</p>
                                        <p className="text-xs text-slate-500">
                                            Current milestone: {currentMilestone.percent}%
                                        </p>
                                    </div>
                                </div>
                                
                                {nextMilestone && progress < 100 && (
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">Next milestone</p>
                                        <p className="font-medium text-slate-700">
                                            {nextMilestone.percent}% - {nextMilestone.label}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            ${Math.round(currentGoal * (nextMilestone.percent / 100) - monthlyStats.revenue).toLocaleString()} away
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Goal Setting Modal */}
            {showGoalModal && (
                <GoalSettingModal
                    currentGoal={currentGoal}
                    onSave={handleSaveGoal}
                    onClose={() => setShowGoalModal(false)}
                    saving={savingGoal}
                />
            )}
        </>
    );
};

export default GoalTracker;
