// src/components/common/NotificationPermissionPrompt.jsx
// User-friendly notification permission request component

import React, { useState } from 'react';
import { Bell, BellOff, X, Shield, Clock, Wrench, MessageCircle, Check } from 'lucide-react';

/**
 * NotificationPermissionPrompt
 * A friendly, non-intrusive prompt to request push notification permission
 */
export const NotificationPermissionPrompt = ({
    onEnable,
    onDismiss,
    isLoading = false,
    variant = 'banner' // 'banner', 'modal', 'inline'
}) => {
    const [showDetails, setShowDetails] = useState(false);

    const benefits = [
        {
            icon: Clock,
            title: 'Maintenance Reminders',
            description: 'Never miss a maintenance task'
        },
        {
            icon: MessageCircle,
            title: 'Contractor Messages',
            description: 'Get notified when contractors respond'
        },
        {
            icon: Wrench,
            title: 'Job Updates',
            description: 'Track your project progress'
        },
        {
            icon: Shield,
            title: 'Warranty Alerts',
            description: 'Know before warranties expire'
        }
    ];

    const handleEnable = async () => {
        if (onEnable) {
            await onEnable();
        }
    };

    // Banner variant - appears at top of screen
    if (variant === 'banner') {
        return (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 shadow-lg animate-in slide-in-from-top duration-300">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-white/20 rounded-lg shrink-0">
                            <Bell size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-sm">Enable notifications</p>
                            <p className="text-xs text-white/80 truncate">
                                Get reminders for maintenance, messages & more
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleEnable}
                            disabled={isLoading}
                            className="px-4 py-2 bg-white text-emerald-700 font-bold text-sm rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                    Enabling...
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    Enable
                                </>
                            )}
                        </button>
                        <button
                            onClick={onDismiss}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            title="Remind me later"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Modal variant - centered overlay
    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onDismiss}
                />
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-6 text-white text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Bell size={32} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Stay in the loop</h2>
                        <p className="text-white/90 text-sm">
                            Enable notifications to get timely updates about your home
                        </p>
                    </div>

                    {/* Benefits */}
                    <div className="p-6">
                        <div className="space-y-3 mb-6">
                            {benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                                        <benefit.icon size={16} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">
                                            {benefit.title}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {benefit.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleEnable}
                                disabled={isLoading}
                                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        <Bell size={18} />
                                        Enable Notifications
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onDismiss}
                                className="w-full py-3 text-slate-500 font-medium text-sm hover:text-slate-700 transition-colors"
                            >
                                Maybe later
                            </button>
                        </div>

                        {/* Privacy note */}
                        <p className="text-xs text-slate-400 text-center mt-4">
                            You can change this anytime in settings
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Inline variant - embedded in page content
    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl shrink-0">
                    <Bell size={24} className="text-emerald-600" />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-emerald-900 mb-1">
                        Enable push notifications
                    </h3>
                    <p className="text-sm text-emerald-700 mb-3">
                        Get timely reminders about maintenance, contractor messages, and more.
                    </p>

                    {/* Expandable benefits */}
                    {showDetails && (
                        <div className="grid grid-cols-2 gap-2 mb-4 animate-in fade-in duration-200">
                            {benefits.map((benefit, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 text-xs text-emerald-600 bg-white/50 px-2 py-1.5 rounded-lg"
                                >
                                    <benefit.icon size={12} />
                                    <span>{benefit.title}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleEnable}
                            disabled={isLoading}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Enabling...
                                </>
                            ) : (
                                'Enable'
                            )}
                        </button>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="px-3 py-2 text-emerald-600 text-sm font-medium hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                            {showDetails ? 'Less info' : 'Learn more'}
                        </button>
                        <button
                            onClick={onDismiss}
                            className="ml-auto p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                            title="Remind me later"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Notification Permission Denied State
 * Shown when user has blocked notifications
 */
export const NotificationPermissionDenied = ({ onOpenSettings }) => (
    <div className="bg-slate-100 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 bg-slate-200 rounded-lg shrink-0">
            <BellOff size={18} className="text-slate-500" />
        </div>
        <div className="flex-1">
            <p className="font-medium text-slate-700 text-sm">Notifications are blocked</p>
            <p className="text-xs text-slate-500 mt-1">
                To enable notifications, update your browser settings for this site.
            </p>
            {onOpenSettings && (
                <button
                    onClick={onOpenSettings}
                    className="text-xs text-emerald-600 font-medium mt-2 hover:underline"
                >
                    Learn how to enable
                </button>
            )}
        </div>
    </div>
);

/**
 * Notification Status Badge
 * Small indicator showing notification status
 */
export const NotificationStatusBadge = ({ isEnabled, onClick }) => (
    <button
        onClick={onClick}
        className={`p-2 rounded-lg transition-colors ${
            isEnabled
                ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        }`}
        title={isEnabled ? 'Notifications enabled' : 'Notifications off'}
    >
        {isEnabled ? <Bell size={18} /> : <BellOff size={18} />}
    </button>
);

export default NotificationPermissionPrompt;
