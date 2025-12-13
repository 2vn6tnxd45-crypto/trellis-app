// src/components/GamifiedHealthScore.jsx
// ============================================
// 🎮 GAMIFIED HEALTH SCORE
// ============================================
// Interactive, engaging health score display with gamification

import React, { useState } from 'react';
import {
    TrendingUp, TrendingDown, Minus, ChevronDown, X,
    Zap, Target, Award, Calendar, Info, Star, Trophy,
    ArrowRight
} from 'lucide-react';

// ============================================
// SUB-COMPONENTS
// ============================================

const ScoreHistoryGraph = ({ history, currentScore }) => {
    if (history.length === 0) {
        return (
            <div className="text-center py-8 text-slate-400 text-sm">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Score history will appear as you use Krib</p>
            </div>
        );
    }

    const maxScore = 100;
    const minScore = 0;
    const range = maxScore - minScore;

    // Get last 7 days
    const data = history.slice(-7);
    const width = 100;
    const height = 60;
    const padding = 5;

    const points = data.map((entry, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((entry.score - minScore) / range) * (height - padding * 2) - padding;
        return { x, y, score: entry.score, date: entry.date };
    });

    const pathD = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    const areaD = `${pathD} L ${width - padding} ${height} L ${padding} ${height} Z`;

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700">7-Day Trend</h4>
                <div className="flex items-center gap-1 text-xs">
                    {data.length > 1 && (
                        <>
                            {data[data.length - 1].score > data[data.length - 2].score ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : data[data.length - 1].score < data[data.length - 2].score ? (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                                <Minus className="h-3 w-3 text-slate-400" />
                            )}
                        </>
                    )}
                    <span className="text-slate-500 font-medium">{data.length} days</span>
                </div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: '120px' }}>
                {/* Grid lines */}
                {[25, 50, 75, 100].map(score => {
                    const y = height - ((score - minScore) / range) * (height - padding * 2) - padding;
                    return (
                        <line
                            key={score}
                            x1={padding}
                            y1={y}
                            x2={width - padding}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeWidth="0.5"
                            strokeDasharray="2,2"
                        />
                    );
                })}

                {/* Area fill */}
                <path
                    d={areaD}
                    fill="url(#gradient)"
                    opacity="0.2"
                />

                {/* Line */}
                <path
                    d={pathD}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Points */}
                {points.map((point, i) => (
                    <circle
                        key={i}
                        cx={point.x}
                        cy={point.y}
                        r="2.5"
                        fill={point.score >= 80 ? '#10b981' : point.score >= 60 ? '#f59e0b' : '#ef4444'}
                        stroke="white"
                        strokeWidth="1.5"
                    />
                ))}

                {/* Gradients */}
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Score labels */}
            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
                <span>{data[0] ? new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                <span>Today</span>
            </div>
        </div>
    );
};

const LevelBadge = ({ level, progress, nextLevel }) => {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${level.gradient} flex items-center justify-center text-2xl shadow-lg`}>
                        {level.icon}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">{level.name} Home</p>
                        <p className="text-xs text-slate-500">Current Level</p>
                    </div>
                </div>
                {nextLevel && (
                    <div className="text-right">
                        <p className="text-xs text-slate-400">Next</p>
                        <p className="text-sm font-bold text-slate-600">{nextLevel.icon} {nextLevel.name}</p>
                    </div>
                )}
            </div>

            {nextLevel && (
                <div>
                    <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r ${nextLevel.gradient} transition-all duration-1000`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {Math.round(progress)}% to {nextLevel.name}
                    </p>
                </div>
            )}
        </div>
    );
};

const StreakDisplay = ({ current, longest }) => {
    return (
        <div className="flex gap-3">
            <div className="flex-1 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100">
                <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <p className="text-xs font-bold text-orange-700 uppercase">Current Streak</p>
                </div>
                <p className="text-3xl font-black text-orange-600">{current}</p>
                <p className="text-xs text-orange-600 font-medium">
                    {current === 1 ? 'day' : 'days'} at 80+
                </p>
            </div>

            <div className="flex-1 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                    <Trophy className="h-4 w-4 text-purple-500" />
                    <p className="text-xs font-bold text-purple-700 uppercase">Best Streak</p>
                </div>
                <p className="text-3xl font-black text-purple-600">{longest}</p>
                <p className="text-xs text-purple-600 font-medium">
                    {longest === 1 ? 'day' : 'days'} record
                </p>
            </div>
        </div>
    );
};

const AchievementsList = ({ achievements, total }) => {
    if (achievements.length === 0) {
        return (
            <div className="text-center py-6 text-slate-400 text-sm">
                <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Complete actions to unlock achievements!</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700">Unlocked Achievements</h4>
                <span className="text-xs font-bold text-emerald-600">
                    {achievements.length}/{total}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {achievements.map((achievement) => (
                    <div
                        key={achievement.id}
                        className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-3 text-center"
                    >
                        <div className="text-2xl mb-1">{achievement.icon}</div>
                        <p className="text-xs font-bold text-slate-800">{achievement.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{achievement.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DailyChallenges = ({ challenges, onComplete }) => {
    if (challenges.length === 0) {
        return (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-sm font-bold text-emerald-800">All challenges complete!</p>
                <p className="text-xs text-emerald-600 mt-1">Come back tomorrow for more</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700">Daily Challenges</h4>
                <div className="flex items-center gap-1">
                    <Target className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-bold text-blue-600">{challenges.length} available</span>
                </div>
            </div>

            {challenges.map((challenge) => (
                <div
                    key={challenge.id}
                    className="bg-white border border-slate-200 rounded-xl p-3 hover:border-blue-300 transition-all group"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-grow">
                            <p className="text-sm font-bold text-slate-800 mb-1">{challenge.name}</p>
                            <p className="text-xs text-slate-500">{challenge.description}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white px-2 py-1 rounded-lg text-xs font-black shrink-0">
                            +{challenge.points}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const GamifiedHealthScore = ({
    score,
    breakdown,
    gamification,
    onDismiss
}) => {
    const [activeTab, setActiveTab] = useState('overview'); // overview, history, achievements, challenges

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Info },
        { id: 'history', label: 'History', icon: TrendingUp },
        { id: 'achievements', label: 'Achievements', icon: Award },
        { id: 'challenges', label: 'Challenges', icon: Target },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div
                className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle cx="80" cy="20" r="30" fill="white" />
                            <circle cx="20" cy="80" r="25" fill="white" />
                        </svg>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="text-white/60 text-xs font-bold uppercase mb-1">Your Home's</p>
                                <h2 className="text-2xl font-black">Health Score</h2>
                            </div>
                            <button
                                onClick={onDismiss}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Score Display */}
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <svg width="100" height="100" className="transform -rotate-90">
                                    <circle
                                        cx="50" cy="50" r="40"
                                        stroke="rgba(255,255,255,0.1)"
                                        strokeWidth="8"
                                        fill="none"
                                    />
                                    <circle
                                        cx="50" cy="50" r="40"
                                        stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth="8"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeDasharray={`${score * 2.51} 251`}
                                        style={{
                                            filter: `drop-shadow(0 0 8px ${score >= 80 ? '#10b98140' : score >= 60 ? '#f59e0b40' : '#ef444440'})`
                                        }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-4xl font-black">{score}</span>
                                </div>
                            </div>

                            <div className="flex-grow">
                                <LevelBadge
                                    level={gamification.currentLevel}
                                    progress={gamification.progressToNextLevel}
                                    nextLevel={gamification.nextLevel}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 bg-slate-50">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition-all relative ${
                                    activeTab === tab.id
                                        ? 'text-emerald-600 bg-white'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <tab.icon className="h-3 w-3" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </div>
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {activeTab === 'overview' && (
                        <>
                            {/* Breakdown */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-3">Score Breakdown</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <span className="text-sm text-slate-600">Maintenance Health</span>
                                        <span className={`font-bold ${breakdown.maintenance.penalty > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {breakdown.maintenance.penalty > 0 ? `-${breakdown.maintenance.penalty}` : '✓'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <span className="text-sm text-slate-600">Data Coverage</span>
                                        <span className={`font-bold ${breakdown.coverage.penalty > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {breakdown.coverage.penalty > 0 ? `-${breakdown.coverage.penalty}` : '✓'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <span className="text-sm text-slate-600">Upcoming Tasks</span>
                                        <span className={`font-bold ${breakdown.upcoming.penalty > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {breakdown.upcoming.penalty > 0 ? `-${breakdown.upcoming.penalty}` : '✓'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Streaks */}
                            <StreakDisplay
                                current={gamification.currentStreak}
                                longest={gamification.longestStreak}
                            />

                            {/* Quick Stats */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">Total Points</p>
                                        <p className="text-3xl font-black text-blue-600">{gamification.totalPoints}</p>
                                    </div>
                                    <Star className="h-12 w-12 text-blue-200" />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'history' && (
                        <ScoreHistoryGraph
                            history={gamification.scoreHistory}
                            currentScore={score}
                        />
                    )}

                    {activeTab === 'achievements' && (
                        <AchievementsList
                            achievements={gamification.achievements}
                            total={gamification.totalAchievements}
                        />
                    )}

                    {activeTab === 'challenges' && (
                        <DailyChallenges
                            challenges={gamification.dailyChallenges}
                            onComplete={gamification.completeChallenge}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default GamifiedHealthScore;
