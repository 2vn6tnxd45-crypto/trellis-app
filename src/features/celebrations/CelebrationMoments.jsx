// src/features/celebrations/CelebrationMoments.jsx
// ============================================
// 🎉 CELEBRATION MOMENTS
// ============================================
// Delightful animations for user milestones.
// Makes the app feel alive and rewarding.

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Sparkles, Star, Home, Trophy, Target, Zap,
    CheckCircle2, PartyPopper, Gift, Crown, Award
} from 'lucide-react';
import './celebrations.css'; // Import the new CSS file

// ============================================
// CONFETTI COMPONENT
// ============================================

const Confetti = ({ count = 50, duration = 3000 }) => {
    const [particles, setParticles] = useState([]);
    
    useEffect(() => {
        const colors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
        const newParticles = Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.5,
            duration: 2 + Math.random() * 2,
            size: 8 + Math.random() * 8,
            rotation: Math.random() * 360,
            // Calculate random drift for this specific particle
            drift: `${Math.random() > 0.5 ? '' : '-'}${20 + Math.random() * 30}px`
        }));
        setParticles(newParticles);
        
        const timer = setTimeout(() => setParticles([]), duration);
        return () => clearTimeout(timer);
    }, [count, duration]);
    
    if (particles.length === 0) return null;
    
    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute animate-confetti-fall"
                    style={{
                        left: `${p.x}%`,
                        top: '-20px',
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.duration}s`,
                        '--fall-drift': p.drift // Pass the random drift as a CSS variable
                    }}
                >
                    <div
                        className="animate-confetti-spin"
                        style={{
                            width: p.size,
                            height: p.size,
                            backgroundColor: p.color,
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            transform: `rotate(${p.rotation}deg)`,
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

// ============================================
// FIRST ITEM CELEBRATION
// ============================================

export const FirstItemCelebration = ({ itemName, onClose, onContinue }) => {
    const [showConfetti, setShowConfetti] = useState(true);
    
    return (
        <>
            {showConfetti && <Confetti count={60} duration={4000} />}
            
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center animate-celebration-pop">
                    {/* Icon */}
                    <div className="relative mx-auto w-24 h-24 mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl rotate-6 animate-pulse" />
                        <div className="absolute inset-0 bg-white rounded-3xl flex items-center justify-center shadow-xl">
                            <PartyPopper className="h-12 w-12 text-emerald-500" />
                        </div>
                        {/* Floating sparkles */}
                        <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-400 animate-bounce" />
                        <Star className="absolute -bottom-1 -left-2 h-5 w-5 text-purple-400 animate-pulse" />
                    </div>
                    
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
                        You're on your way! 🎉
                    </h2>
                    
                    <p className="text-slate-600 mb-2">
                        <span className="font-bold text-emerald-600">{itemName}</span> is now tracked.
                    </p>
                    
                    <p className="text-sm text-slate-500 mb-6">
                        Every item you add makes your home smarter. Keep going!
                    </p>
                    
                    {/* Progress indicator */}
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <div
                                    key={n}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                        n === 1 
                                            ? 'bg-emerald-500 text-white scale-110' 
                                            : 'bg-slate-200 text-slate-400'
                                    }`}
                                >
                                    {n === 1 ? <CheckCircle2 className="h-5 w-5" /> : n}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500">
                            <span className="font-bold text-emerald-600">1</span> of ~10 key items
                        </p>
                    </div>
                    
                    <button
                        onClick={onContinue}
                        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                    >
                        Add another item
                    </button>
                    
                    <button
                        onClick={onClose}
                        className="w-full py-3 text-slate-500 font-medium mt-2 hover:text-slate-700"
                    >
                        Done for now
                    </button>
                </div>
            </div>
        </>
    );
};

// ============================================
// MILESTONE CELEBRATIONS (5, 10, 25, 50 items)
// ============================================

const MILESTONES = {
    5: {
        icon: Target,
        title: 'Great Start!',
        subtitle: 'Your Home Health Score is now active',
        description: 'With 5 items tracked, we can now calculate your maintenance health.',
        color: 'emerald',
        badge: '🛡️',
    },
    10: {
        icon: Trophy,
        title: 'Double Digits!',
        subtitle: '10 items documented',
        description: 'You know more about your home than most homeowners. Keep building!',
        color: 'amber',
        badge: '🏆',
    },
    25: {
        icon: Award,
        title: 'Home Expert!',
        subtitle: '25 items tracked',
        description: 'Your Property Pedigree Report is getting comprehensive.',
        color: 'purple',
        badge: '🏅',
    },
    50: {
        icon: Crown,
        title: 'Home Master!',
        subtitle: '50 items documented',
        description: 'You have an incredible record of your home. Amazing work!',
        color: 'amber',
        badge: '👑',
    },
};

export const MilestoneCelebration = ({ milestone, onClose }) => {
    const config = MILESTONES[milestone];
    if (!config) return null;
    
    const Icon = config.icon;
    const colorClasses = {
        emerald: 'from-emerald-400 to-teal-500',
        amber: 'from-amber-400 to-orange-500',
        purple: 'from-purple-400 to-indigo-500',
    };
    
    return (
        <>
            <Confetti count={80} duration={5000} />
            
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center animate-celebration-pop">
                    {/* Badge */}
                    <div className="text-6xl mb-4 animate-bounce">{config.badge}</div>
                    
                    {/* Icon */}
                    <div className={`mx-auto w-20 h-20 bg-gradient-to-br ${colorClasses[config.color]} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                        <Icon className="h-10 w-10 text-white" />
                    </div>
                    
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-1">
                        {config.title}
                    </h2>
                    
                    <p className="text-lg font-bold text-emerald-600 mb-2">
                        {config.subtitle}
                    </p>
                    
                    <p className="text-slate-600 mb-6">
                        {config.description}
                    </p>
                    
                    <button
                        onClick={onClose}
                        className={`w-full py-4 bg-gradient-to-r ${colorClasses[config.color]} text-white rounded-2xl font-bold hover:shadow-lg transition-all`}
                    >
                        Awesome!
                    </button>
                </div>
            </div>
        </>
    );
};

// ============================================
// SUCCESS TOAST (for quick wins)
// ============================================

export const SuccessToast = ({ message, icon: CustomIcon, onClose, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(true);
    const Icon = CustomIcon || CheckCircle2;
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);
    
    return (
        <div 
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}
        >
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-full">
                    <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{message}</span>
            </div>
        </div>
    );
};

// ============================================
// CELEBRATION HOOK (for managing celebrations)
// ============================================

export const useCelebrations = () => {
    const [celebration, setCelebration] = useState(null);
    const [toast, setToast] = useState(null);
    
    const checkMilestone = useCallback((previousCount, newCount) => {
        const milestones = [5, 10, 25, 50, 100];
        
        for (const milestone of milestones) {
            if (previousCount < milestone && newCount >= milestone) {
                setCelebration({ type: 'milestone', value: milestone });
                return true;
            }
        }
        
        // First item special case
        if (previousCount === 0 && newCount === 1) {
            setCelebration({ type: 'first_item' });
            return true;
        }
        
        return false;
    }, []);
    
    const showToast = useCallback((message, icon) => {
        setToast({ message, icon });
    }, []);
    
    const closeCelebration = useCallback(() => {
        setCelebration(null);
    }, []);
    
    const closeToast = useCallback(() => {
        setToast(null);
    }, []);
    
    return {
        celebration,
        toast,
        checkMilestone,
        showToast,
        closeCelebration,
        closeToast,
    };
};

// ============================================
// CELEBRATION RENDERER
// ============================================

export const CelebrationRenderer = ({ 
    celebration, 
    toast,
    itemName,
    onCloseCelebration,
    onCloseToast,
    onAddAnother
}) => {
    if (toast) {
        return (
            <SuccessToast 
                message={toast.message}
                icon={toast.icon}
                onClose={onCloseToast}
            />
        );
    }
    
    if (!celebration) return null;
    
    if (celebration.type === 'first_item') {
        return (
            <FirstItemCelebration 
                itemName={itemName}
                onClose={onCloseCelebration}
                onContinue={onAddAnother}
            />
        );
    }
    
    if (celebration.type === 'milestone') {
        return (
            <MilestoneCelebration 
                milestone={celebration.value}
                onClose={onCloseCelebration}
            />
        );
    }
    
    return null;
};

export default CelebrationRenderer;
