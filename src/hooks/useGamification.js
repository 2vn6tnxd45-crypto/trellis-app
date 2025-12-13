// src/hooks/useGamification.js
// ============================================
// 🎮 GAMIFICATION HOOK
// ============================================
// Manages levels, streaks, achievements, challenges, and score history

import { useState, useEffect, useMemo, useCallback } from 'react';

// ============================================
// CONFIGURATION
// ============================================

const LEVELS = [
    { name: 'Bronze', minScore: 0, maxScore: 59, color: '#CD7F32', gradient: 'from-orange-700 to-orange-900', icon: '🥉' },
    { name: 'Silver', minScore: 60, maxScore: 79, color: '#C0C0C0', gradient: 'from-slate-400 to-slate-600', icon: '🥈' },
    { name: 'Gold', minScore: 80, maxScore: 94, color: '#FFD700', gradient: 'from-yellow-400 to-yellow-600', icon: '🥇' },
    { name: 'Platinum', minScore: 95, maxScore: 100, color: '#E5E4E2', gradient: 'from-blue-200 to-purple-300', icon: '💎' },
];

const ACHIEVEMENTS = [
    { id: 'first_100', name: 'Perfect Score', description: 'Reach 100 health score', icon: '💯', requirement: (stats) => stats.hasReached100 },
    { id: 'week_streak', name: '7-Day Streak', description: 'Maintain 80+ for 7 days', icon: '🔥', requirement: (stats) => stats.currentStreak >= 7 },
    { id: 'month_streak', name: '30-Day Streak', description: 'Maintain 80+ for 30 days', icon: '⚡', requirement: (stats) => stats.currentStreak >= 30 },
    { id: 'maintenance_master', name: 'Maintenance Master', description: 'Zero overdue items', icon: '🛠️', requirement: (stats) => stats.zeroOverdueCount >= 5 },
    { id: 'early_bird', name: 'Early Bird', description: 'Schedule all upcoming tasks', icon: '🐦', requirement: (stats) => stats.scheduledAllUpcoming },
    { id: 'data_collector', name: 'Data Collector', description: 'Track 20+ items', icon: '📊', requirement: (stats) => stats.totalItems >= 20 },
    { id: 'home_hero', name: 'Home Hero', description: 'Track 50+ items', icon: '🦸', requirement: (stats) => stats.totalItems >= 50 },
    { id: 'platinum_member', name: 'Platinum Member', description: 'Reach Platinum level', icon: '💎', requirement: (stats) => stats.currentLevel === 'Platinum' },
];

const CHALLENGES = [
    { id: 'add_dates', name: 'Schedule Maintenance', description: 'Add installation dates to 2 items', points: 5, type: 'maintenance' },
    { id: 'add_items', name: 'Track More Items', description: 'Add 3 new items to your home', points: 10, type: 'items' },
    { id: 'fix_overdue', name: 'Clear Overdue', description: 'Fix all overdue maintenance', points: 15, type: 'maintenance' },
    { id: 'upload_receipt', name: 'Digital Records', description: 'Upload 2 receipts or photos', points: 8, type: 'items' },
];

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_KEY = 'krib_gamification_v1';

const loadFromStorage = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Convert date strings back to Date objects
            if (data.scoreHistory) {
                data.scoreHistory = data.scoreHistory.map(entry => ({
                    ...entry,
                    date: new Date(entry.date)
                }));
            }
            return data;
        }
    } catch (error) {
        console.error('Failed to load gamification data:', error);
    }
    return null;
};

const saveToStorage = (data) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save gamification data:', error);
    }
};

// ============================================
// MAIN HOOK
// ============================================

export const useGamification = (currentScore, totalItems, overdueCount, upcomingCount) => {
    // Load initial state from localStorage
    const [state, setState] = useState(() => {
        const stored = loadFromStorage();
        return {
            scoreHistory: stored?.scoreHistory || [],
            achievements: stored?.achievements || [],
            currentStreak: stored?.currentStreak || 0,
            longestStreak: stored?.longestStreak || 0,
            lastCheckDate: stored?.lastCheckDate ? new Date(stored.lastCheckDate) : null,
            hasReached100: stored?.hasReached100 || false,
            zeroOverdueCount: stored?.zeroOverdueCount || 0,
            scheduledAllUpcoming: stored?.scheduledAllUpcoming || false,
            totalPointsEarned: stored?.totalPointsEarned || 0,
            completedChallenges: stored?.completedChallenges || [],
            celebrationQueue: [],
        };
    });

    // Calculate current level
    const currentLevel = useMemo(() => {
        return LEVELS.find(level => currentScore >= level.minScore && currentScore <= level.maxScore) || LEVELS[0];
    }, [currentScore]);

    // Update score history daily
    useEffect(() => {
        const today = new Date().toDateString();
        const lastEntry = state.scoreHistory[state.scoreHistory.length - 1];
        const lastEntryDate = lastEntry ? new Date(lastEntry.date).toDateString() : null;

        if (lastEntryDate !== today) {
            const newHistory = [
                ...state.scoreHistory,
                { date: new Date(), score: currentScore }
            ].slice(-30); // Keep last 30 days

            setState(prev => ({
                ...prev,
                scoreHistory: newHistory
            }));
        }
    }, [currentScore, state.scoreHistory]);

    // Update streak tracking
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastCheck = state.lastCheckDate ? new Date(state.lastCheckDate) : null;
        if (lastCheck) lastCheck.setHours(0, 0, 0, 0);

        // Check if this is a new day
        const isNewDay = !lastCheck || today.getTime() !== lastCheck.getTime();

        if (isNewDay) {
            let newStreak = state.currentStreak;

            if (currentScore >= 80) {
                // Continue or start streak
                newStreak = state.currentStreak + 1;
            } else {
                // Break streak
                newStreak = 0;
            }

            const newLongestStreak = Math.max(newStreak, state.longestStreak);

            setState(prev => ({
                ...prev,
                currentStreak: newStreak,
                longestStreak: newLongestStreak,
                lastCheckDate: today,
            }));
        }
    }, [currentScore, state.currentStreak, state.longestStreak, state.lastCheckDate]);

    // Track special stats
    useEffect(() => {
        setState(prev => {
            const updates = {};

            // Track if user has ever reached 100
            if (currentScore === 100 && !prev.hasReached100) {
                updates.hasReached100 = true;
                updates.celebrationQueue = [...(prev.celebrationQueue || []), { type: 'perfect_score', timestamp: Date.now() }];
            }

            // Track consecutive days with zero overdue
            if (overdueCount === 0) {
                updates.zeroOverdueCount = (prev.zeroOverdueCount || 0) + 1;
            } else {
                updates.zeroOverdueCount = 0;
            }

            // Track if all upcoming tasks are scheduled
            if (upcomingCount === 0 && totalItems > 5) {
                updates.scheduledAllUpcoming = true;
            }

            return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
        });
    }, [currentScore, overdueCount, upcomingCount, totalItems]);

    // Check for new achievements
    useEffect(() => {
        const stats = {
            currentScore,
            totalItems,
            currentStreak: state.currentStreak,
            hasReached100: state.hasReached100,
            zeroOverdueCount: state.zeroOverdueCount,
            scheduledAllUpcoming: state.scheduledAllUpcoming,
            currentLevel: currentLevel.name,
        };

        const newAchievements = ACHIEVEMENTS.filter(
            achievement =>
                !state.achievements.includes(achievement.id) &&
                achievement.requirement(stats)
        );

        if (newAchievements.length > 0) {
            setState(prev => ({
                ...prev,
                achievements: [...prev.achievements, ...newAchievements.map(a => a.id)],
                celebrationQueue: [
                    ...(prev.celebrationQueue || []),
                    ...newAchievements.map(a => ({ type: 'achievement', achievement: a, timestamp: Date.now() }))
                ]
            }));
        }
    }, [currentScore, totalItems, state.currentStreak, state.hasReached100, state.zeroOverdueCount, state.scheduledAllUpcoming, currentLevel.name, state.achievements]);

    // Save to localStorage whenever state changes
    useEffect(() => {
        const { celebrationQueue, ...stateToSave } = state;
        saveToStorage(stateToSave);
    }, [state]);

    // Get next level info
    const nextLevel = useMemo(() => {
        const currentIndex = LEVELS.findIndex(l => l.name === currentLevel.name);
        return currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null;
    }, [currentLevel]);

    const progressToNextLevel = useMemo(() => {
        if (!nextLevel) return 100;
        const currentMin = currentLevel.minScore;
        const nextMin = nextLevel.minScore;
        const range = nextMin - currentMin;
        const progress = currentScore - currentMin;
        return Math.min(100, Math.max(0, (progress / range) * 100));
    }, [currentScore, currentLevel, nextLevel]);

    // Get available daily challenges
    const dailyChallenges = useMemo(() => {
        const today = new Date().toDateString();
        const completedToday = state.completedChallenges.filter(
            c => new Date(c.completedAt).toDateString() === today
        );

        return CHALLENGES.filter(
            challenge => !completedToday.find(c => c.id === challenge.id)
        );
    }, [state.completedChallenges]);

    // Get unlocked achievements
    const unlockedAchievements = useMemo(() => {
        return ACHIEVEMENTS.filter(a => state.achievements.includes(a.id));
    }, [state.achievements]);

    // Complete a challenge
    const completeChallenge = useCallback((challengeId) => {
        const challenge = CHALLENGES.find(c => c.id === challengeId);
        if (!challenge) return;

        setState(prev => ({
            ...prev,
            completedChallenges: [
                ...prev.completedChallenges,
                { id: challengeId, completedAt: new Date() }
            ],
            totalPointsEarned: prev.totalPointsEarned + challenge.points,
            celebrationQueue: [
                ...(prev.celebrationQueue || []),
                { type: 'challenge', challenge, timestamp: Date.now() }
            ]
        }));
    }, []);

    // Dismiss celebration
    const dismissCelebration = useCallback(() => {
        setState(prev => ({
            ...prev,
            celebrationQueue: prev.celebrationQueue.slice(1)
        }));
    }, []);

    // Get score trend
    const scoreTrend = useMemo(() => {
        if (state.scoreHistory.length < 2) return 'stable';
        const recent = state.scoreHistory.slice(-7);
        const avg = recent.reduce((sum, entry) => sum + entry.score, 0) / recent.length;
        const oldAvg = state.scoreHistory.slice(-14, -7).reduce((sum, entry) => sum + entry.score, 0) / 7;

        if (avg > oldAvg + 5) return 'up';
        if (avg < oldAvg - 5) return 'down';
        return 'stable';
    }, [state.scoreHistory]);

    return {
        // Level & Progress
        currentLevel,
        nextLevel,
        progressToNextLevel,

        // Streaks
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,

        // Achievements
        achievements: unlockedAchievements,
        totalAchievements: ACHIEVEMENTS.length,
        achievementProgress: (unlockedAchievements.length / ACHIEVEMENTS.length) * 100,

        // Challenges
        dailyChallenges,
        completeChallenge,
        totalPoints: state.totalPointsEarned,

        // Score History
        scoreHistory: state.scoreHistory,
        scoreTrend,

        // Celebrations
        currentCelebration: state.celebrationQueue[0] || null,
        dismissCelebration,

        // Stats
        hasReached100: state.hasReached100,
    };
};

export default useGamification;
