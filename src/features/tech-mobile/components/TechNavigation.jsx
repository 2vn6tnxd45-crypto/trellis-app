// src/features/tech-mobile/components/TechNavigation.jsx
// ============================================
// TECH MOBILE BOTTOM NAVIGATION
// ============================================
// Fixed bottom navigation for mobile PWA

import React from 'react';
import { Home, Calendar, Clock, User } from 'lucide-react';

const NAV_ITEMS = [
    { id: 'home', label: 'Today', icon: Home, path: '/tech' },
    { id: 'schedule', label: 'Schedule', icon: Calendar, path: '/tech/schedule' },
    { id: 'timesheet', label: 'Time', icon: Clock, path: '/tech/timesheet' },
    { id: 'profile', label: 'Profile', icon: User, path: '/tech/profile' }
];

export const TechNavigation = ({
    activeTab = 'home',
    onNavigate,
    badge = {}
}) => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
            <div className="max-w-lg mx-auto px-2">
                <div className="flex items-center justify-around h-16">
                    {NAV_ITEMS.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        const badgeCount = badge[item.id];

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate?.(item.id, item.path)}
                                className={`flex flex-col items-center justify-center w-16 h-full relative transition-colors ${
                                    isActive
                                        ? 'text-emerald-600'
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <div className="relative">
                                    <Icon
                                        className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`}
                                    />
                                    {badgeCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-500 rounded-b-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default TechNavigation;
