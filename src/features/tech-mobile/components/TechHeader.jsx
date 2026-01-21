// src/features/tech-mobile/components/TechHeader.jsx
// ============================================
// TECH MOBILE HEADER
// ============================================
// Top header with branding, date, and profile access

import React from 'react';
import { Bell, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export const TechHeader = ({
    techName,
    techColor = '#10B981',
    techInitials = 'T',
    contractorName,
    contractorLogo,
    isOnline = true,
    notificationCount = 0,
    onProfileClick,
    onNotificationClick,
    onRefresh,
    isRefreshing = false
}) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    return (
        <header className="bg-white border-b border-gray-200 safe-area-top">
            {/* Connection Status Bar */}
            {!isOnline && (
                <div className="bg-amber-500 text-white text-xs font-medium py-1 px-4 flex items-center justify-center gap-2">
                    <WifiOff className="w-3 h-3" />
                    Offline Mode - Changes will sync when connected
                </div>
            )}

            <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Left - Logo/Company */}
                    <div className="flex items-center gap-3">
                        {contractorLogo ? (
                            <img
                                src={contractorLogo}
                                alt={contractorName}
                                className="w-10 h-10 rounded-xl object-contain bg-gray-100"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <span className="text-emerald-700 font-bold text-sm">
                                    {contractorName?.slice(0, 2).toUpperCase() || 'K'}
                                </span>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-gray-500">{contractorName || 'Tech Portal'}</p>
                            <p className="font-semibold text-gray-900 text-sm">{dateStr}</p>
                        </div>
                    </div>

                    {/* Right - Actions */}
                    <div className="flex items-center gap-2">
                        {/* Refresh */}
                        <button
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                        >
                            <RefreshCw
                                className={`w-5 h-5 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`}
                            />
                        </button>

                        {/* Notifications */}
                        <button
                            onClick={onNotificationClick}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
                        >
                            <Bell className="w-5 h-5 text-gray-500" />
                            {notificationCount > 0 && (
                                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {notificationCount > 9 ? '9+' : notificationCount}
                                </span>
                            )}
                        </button>

                        {/* Profile Avatar */}
                        <button
                            onClick={onProfileClick}
                            className="flex items-center gap-2"
                        >
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: techColor }}
                            >
                                {techInitials}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TechHeader;
