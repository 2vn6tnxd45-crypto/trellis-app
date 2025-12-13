// src/components/CelebrationModal.jsx
// ============================================
// 🎉 CELEBRATION ANIMATIONS
// ============================================
// Displays celebration modals for achievements, perfect scores, and challenges

import React, { useEffect, useState } from 'react';
import { X, Star, Trophy, Zap, CheckCircle2 } from 'lucide-react';

// ============================================
// CONFETTI ANIMATION
// ============================================

const Confetti = () => {
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        // Generate confetti particles
        const newParticles = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: -10,
            rotation: Math.random() * 360,
            color: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 5)],
            size: Math.random() * 8 + 4,
            delay: Math.random() * 0.5,
            duration: Math.random() * 2 + 2,
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute animate-confetti"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        backgroundColor: particle.color,
                        transform: `rotate(${particle.rotation}deg)`,
                        animationDelay: `${particle.delay}s`,
                        animationDuration: `${particle.duration}s`,
                    }}
                />
            ))}
            <style>{`
                @keyframes confetti {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
                .animate-confetti {
                    animation: confetti linear forwards;
                }
            `}</style>
        </div>
    );
};

// ============================================
// ACHIEVEMENT CELEBRATION
// ============================================

const AchievementCelebration = ({ achievement, onDismiss }) => {
    return (
        <>
            <Confetti />
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 slide-in-from-bottom-4">
                    <button
                        onClick={onDismiss}
                        className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4 text-slate-400" />
                    </button>

                    {/* Achievement Icon with Glow */}
                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-50 animate-pulse" />
                        <div className="relative text-7xl animate-bounce">
                            {achievement.icon}
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2">
                        Achievement Unlocked!
                    </h2>
                    <p className="text-lg font-bold text-emerald-600 mb-2">
                        {achievement.name}
                    </p>
                    <p className="text-sm text-slate-600 mb-6">
                        {achievement.description}
                    </p>

                    <button
                        onClick={onDismiss}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5"
                    >
                        Awesome! 🎉
                    </button>
                </div>
            </div>
        </>
    );
};

// ============================================
// PERFECT SCORE CELEBRATION
// ============================================

const PerfectScoreCelebration = ({ onDismiss }) => {
    return (
        <>
            <Confetti />
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-3xl p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 slide-in-from-bottom-4 text-white">
                    <button
                        onClick={onDismiss}
                        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {/* Perfect Score Display */}
                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 bg-white blur-2xl opacity-30 animate-pulse" />
                        <div className="relative">
                            <svg width="120" height="120" className="transform -rotate-90 mx-auto">
                                <circle
                                    cx="60" cy="60" r="50"
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="8"
                                    fill="none"
                                />
                                <circle
                                    cx="60" cy="60" r="50"
                                    stroke="white"
                                    strokeWidth="8"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray="314 314"
                                    className="animate-pulse"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-5xl font-black">100</span>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-3xl font-black mb-2">
                        Perfect Score! 💯
                    </h2>
                    <p className="text-emerald-100 mb-6">
                        Your home is in pristine condition. Outstanding work!
                    </p>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <Trophy className="h-5 w-5" />
                            <span className="font-bold">Achievement Unlocked: Perfect Score</span>
                        </div>
                    </div>

                    <button
                        onClick={onDismiss}
                        className="w-full bg-white text-emerald-600 font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5"
                    >
                        Continue 🎉
                    </button>
                </div>
            </div>
        </>
    );
};

// ============================================
// CHALLENGE COMPLETE CELEBRATION
// ============================================

const ChallengeCelebration = ({ challenge, onDismiss }) => {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center relative animate-in zoom-in-95 slide-in-from-bottom-4">
                <button
                    onClick={onDismiss}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X className="h-4 w-4 text-slate-400" />
                </button>

                {/* Checkmark Animation */}
                <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-50" />
                    <div className="relative bg-emerald-100 rounded-full p-4">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    </div>
                </div>

                <h2 className="text-xl font-black text-slate-900 mb-2">
                    Challenge Complete!
                </h2>
                <p className="text-md font-bold text-slate-700 mb-1">
                    {challenge.name}
                </p>
                <p className="text-sm text-slate-500 mb-4">
                    {challenge.description}
                </p>

                {/* Points Earned */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl p-4 mb-4">
                    <div className="flex items-center justify-center gap-2">
                        <Star className="h-6 w-6" />
                        <span className="text-2xl font-black">+{challenge.points}</span>
                        <span className="text-sm font-bold">Points</span>
                    </div>
                </div>

                <button
                    onClick={onDismiss}
                    className="w-full bg-slate-800 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-700 transition-all"
                >
                    Nice! 👍
                </button>
            </div>
        </div>
    );
};

// ============================================
// LEVEL UP CELEBRATION
// ============================================

const LevelUpCelebration = ({ newLevel, onDismiss }) => {
    return (
        <>
            <Confetti />
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 slide-in-from-bottom-4">
                    <button
                        onClick={onDismiss}
                        className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4 text-slate-400" />
                    </button>

                    {/* Level Badge with Glow */}
                    <div className="relative inline-block mb-4">
                        <div className={`absolute inset-0 blur-2xl opacity-50 animate-pulse bg-gradient-to-br ${newLevel.gradient}`} />
                        <div className={`relative w-24 h-24 rounded-3xl bg-gradient-to-br ${newLevel.gradient} flex items-center justify-center text-5xl shadow-2xl animate-bounce`}>
                            {newLevel.icon}
                        </div>
                    </div>

                    <h2 className="text-3xl font-black text-slate-900 mb-2">
                        Level Up! 🎊
                    </h2>
                    <p className="text-xl font-bold mb-2" style={{ color: newLevel.color }}>
                        {newLevel.name} Home
                    </p>
                    <p className="text-sm text-slate-600 mb-6">
                        You've reached a new level! Keep up the excellent home maintenance.
                    </p>

                    <button
                        onClick={onDismiss}
                        className={`w-full bg-gradient-to-r ${newLevel.gradient} text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5`}
                    >
                        Continue Journey 🚀
                    </button>
                </div>
            </div>
        </>
    );
};

// ============================================
// MAIN CELEBRATION RENDERER
// ============================================

export const CelebrationRenderer = ({ celebration, onDismiss }) => {
    if (!celebration) return null;

    switch (celebration.type) {
        case 'achievement':
            return <AchievementCelebration achievement={celebration.achievement} onDismiss={onDismiss} />;

        case 'perfect_score':
            return <PerfectScoreCelebration onDismiss={onDismiss} />;

        case 'challenge':
            return <ChallengeCelebration challenge={celebration.challenge} onDismiss={onDismiss} />;

        case 'level_up':
            return <LevelUpCelebration newLevel={celebration.newLevel} onDismiss={onDismiss} />;

        default:
            return null;
    }
};

export default CelebrationRenderer;
