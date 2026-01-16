// src/components/common/CountdownTimer.jsx
// ============================================
// REUSABLE COUNTDOWN TIMER COMPONENT
// ============================================
// Shows time remaining until a target date with urgency-based styling

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

/**
 * Calculate time remaining until target date
 * @param {Date|string|number} targetDate - The target date/timestamp
 * @returns {object} - { days, hours, minutes, totalMs, isExpired }
 */
const calculateTimeRemaining = (targetDate) => {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, totalMs: 0, isExpired: true };

    const target = targetDate instanceof Date
        ? targetDate
        : targetDate?.toDate
            ? targetDate.toDate()
            : new Date(targetDate);

    const now = new Date();
    const totalMs = target - now;

    if (totalMs <= 0) {
        return { days: 0, hours: 0, minutes: 0, totalMs: 0, isExpired: true };
    }

    const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, totalMs, isExpired: false };
};

/**
 * Format time remaining as string
 * @param {object} timeRemaining - { days, hours, minutes }
 * @param {string} format - 'full' | 'short' | 'compact'
 */
const formatTimeRemaining = (timeRemaining, format = 'full') => {
    const { days, hours, minutes, isExpired } = timeRemaining;

    if (isExpired) return null;

    if (format === 'compact') {
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        return `${minutes}m`;
    }

    if (format === 'short') {
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    // Full format
    if (days > 1) return `${days} days, ${hours} hours`;
    if (days === 1) return `1 day, ${hours} hours`;
    if (hours > 1) return `${hours} hours, ${minutes} minutes`;
    if (hours === 1) return `1 hour, ${minutes} minutes`;
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
};

export const CountdownTimer = ({
    targetDate,
    onExpire,
    format = 'full',
    urgencyThreshold = 2, // Days at which to show warning color
    expiredText = 'Expired',
    showIcon = true,
    className = '',
    variant = 'default' // 'default' | 'badge' | 'inline'
}) => {
    const [timeRemaining, setTimeRemaining] = useState(() => calculateTimeRemaining(targetDate));

    // Update interval based on time remaining
    const updateInterval = useMemo(() => {
        if (!timeRemaining || timeRemaining.isExpired) return null;
        // Update more frequently as deadline approaches
        if (timeRemaining.days === 0 && timeRemaining.hours === 0) return 1000; // Every second
        if (timeRemaining.days === 0) return 60000; // Every minute
        return 60000 * 60; // Every hour
    }, [timeRemaining?.days, timeRemaining?.hours, timeRemaining?.isExpired]);

    // Effect to update countdown
    useEffect(() => {
        if (!updateInterval) return;

        const interval = setInterval(() => {
            const newTimeRemaining = calculateTimeRemaining(targetDate);
            setTimeRemaining(newTimeRemaining);

            if (newTimeRemaining.isExpired && onExpire) {
                onExpire();
            }
        }, updateInterval);

        return () => clearInterval(interval);
    }, [targetDate, updateInterval, onExpire]);

    // Initial calculation
    useEffect(() => {
        setTimeRemaining(calculateTimeRemaining(targetDate));
    }, [targetDate]);

    // Determine urgency level for styling
    const getUrgencyLevel = () => {
        if (!timeRemaining || timeRemaining.isExpired) return 'expired';
        if (timeRemaining.days === 0 && timeRemaining.hours < 12) return 'critical';
        if (timeRemaining.days < urgencyThreshold) return 'urgent';
        if (timeRemaining.days < urgencyThreshold * 2) return 'warning';
        return 'normal';
    };

    const urgencyLevel = getUrgencyLevel();

    // Style configurations based on urgency
    const urgencyStyles = {
        critical: {
            bg: 'bg-red-100',
            text: 'text-red-700',
            border: 'border-red-300',
            icon: AlertTriangle,
            pulse: true
        },
        urgent: {
            bg: 'bg-amber-100',
            text: 'text-amber-700',
            border: 'border-amber-300',
            icon: AlertTriangle,
            pulse: true
        },
        warning: {
            bg: 'bg-amber-50',
            text: 'text-amber-600',
            border: 'border-amber-200',
            icon: Clock,
            pulse: false
        },
        normal: {
            bg: 'bg-slate-100',
            text: 'text-slate-600',
            border: 'border-slate-200',
            icon: Clock,
            pulse: false
        },
        expired: {
            bg: 'bg-red-100',
            text: 'text-red-700',
            border: 'border-red-300',
            icon: AlertTriangle,
            pulse: false
        }
    };

    const style = urgencyStyles[urgencyLevel];
    const Icon = style.icon;
    const formattedTime = formatTimeRemaining(timeRemaining, format);

    // Expired state
    if (timeRemaining?.isExpired) {
        if (variant === 'inline') {
            return (
                <span className={`${style.text} font-medium ${className}`}>
                    {expiredText}
                </span>
            );
        }

        return (
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${style.bg} ${style.text} ${className}`}>
                <Icon size={14} />
                <span className="text-sm font-medium">{expiredText}</span>
            </div>
        );
    }

    // Inline variant
    if (variant === 'inline') {
        return (
            <span className={`${style.text} font-medium ${style.pulse ? 'animate-pulse' : ''} ${className}`}>
                {showIcon && <Icon size={14} className="inline mr-1" />}
                {formattedTime}
            </span>
        );
    }

    // Badge variant
    if (variant === 'badge') {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.text} ${style.pulse ? 'animate-pulse' : ''} ${className}`}>
                {showIcon && <Icon size={12} />}
                {formattedTime}
            </span>
        );
    }

    // Default variant
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${style.bg} ${style.border} ${style.pulse ? 'animate-pulse' : ''} ${className}`}>
            {showIcon && <Icon size={16} className={style.text} />}
            <span className={`text-sm font-bold ${style.text}`}>
                {formattedTime}
            </span>
        </div>
    );
};

// Export helper for external use
export { calculateTimeRemaining, formatTimeRemaining };

export default CountdownTimer;
