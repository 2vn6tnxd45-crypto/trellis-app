// src/components/navigation/HomeownerNotificationBell.jsx
// ============================================
// HOMEOWNER NOTIFICATION BELL
// ============================================
// Shows job notifications, completion requests, etc. for homeowners

import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Briefcase, CheckCircle, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { useHomeownerNotifications } from '../../hooks/useHomeownerNotifications';

// Format relative time
const formatRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

// Notification type icons
const getNotificationIcon = (type) => {
    switch (type) {
        case 'new_job':
            return <Briefcase size={16} className="text-blue-500" />;
        case 'job_completed':
            return <CheckCircle size={16} className="text-emerald-500" />;
        default:
            return <Bell size={16} className="text-slate-500" />;
    }
};

// Single notification item
const NotificationItem = ({ notification, onRead, onDelete, onNavigate }) => {
    const handleClick = () => {
        if (!notification.read) {
            onRead(notification.id);
        }
        if (onNavigate) {
            onNavigate(notification);
        }
    };

    return (
        <div
            className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                !notification.read ? 'bg-blue-50/50' : ''
            }`}
            onClick={handleClick}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    !notification.read ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                    {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.read ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                            {notification.title}
                        </p>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(notification.id);
                            }}
                            className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-400">
                            {formatRelativeTime(notification.createdAt)}
                        </span>
                        {notification.scheduledDate && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock size={10} />
                                {new Date(notification.scheduledDate).toLocaleDateString()}
                            </span>
                        )}
                        {!notification.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main component
const HomeownerNotificationBell = ({ userId, onNavigateToJob }) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef(null);

    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useHomeownerNotifications(userId);

    // Close panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleNavigate = (notification) => {
        setIsOpen(false);
        if (onNavigateToJob && notification.jobId) {
            onNavigateToJob(notification.jobId);
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400">
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-500 text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.slice(0, 10).map(notification => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onRead={markAsRead}
                                    onDelete={deleteNotification}
                                    onNavigate={handleNavigate}
                                />
                            ))
                        )}
                    </div>

                    {/* Footer - Show if more than 10 notifications */}
                    {notifications.length > 10 && (
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-center">
                            <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1 mx-auto">
                                View all notifications
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HomeownerNotificationBell;
