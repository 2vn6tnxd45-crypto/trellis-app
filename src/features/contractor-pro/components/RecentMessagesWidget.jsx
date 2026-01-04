// src/features/contractor-pro/components/RecentMessagesWidget.jsx
// ============================================
// RECENT MESSAGES WIDGET
// ============================================
// Shows recent unread messages on the contractor dashboard
// Quick preview with ability to navigate to full inbox

import React, { useState, useEffect } from 'react';
import { 
    MessageSquare, ChevronRight, User, Clock, 
    ArrowRight, Inbox 
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';

// ============================================
// HELPERS
// ============================================
const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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

// ============================================
// MESSAGE PREVIEW ITEM
// ============================================
const MessagePreview = ({ conversation, contractorId, onClick }) => {
    const unreadCount = conversation[`unreadCount_${contractorId}`] || 0;
    const hasUnread = unreadCount > 0;

    return (
        <button
            onClick={onClick}
            className="w-full p-4 flex items-start gap-3 text-left hover:bg-slate-50 transition-colors rounded-xl group"
        >
            {/* Avatar with unread indicator */}
            <div className="relative">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    hasUnread ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                    <User size={18} className={hasUnread ? 'text-emerald-600' : 'text-slate-400'} />
                </div>
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '!' : unreadCount}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <h4 className={`text-sm truncate ${
                        hasUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                    }`}>
                        {conversation.homeownerName || 'Homeowner'}
                    </h4>
                    <span className={`text-xs flex-shrink-0 ml-2 ${
                        hasUnread ? 'text-emerald-600 font-medium' : 'text-slate-400'
                    }`}>
                        {formatMessageTime(conversation.lastMessageTime)}
                    </span>
                </div>
                <p className={`text-sm truncate ${
                    hasUnread ? 'text-slate-700' : 'text-slate-500'
                }`}>
                    {conversation.lastMessage || 'No messages'}
                </p>
            </div>

            {/* Arrow */}
            <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-2" />
        </button>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = () => (
    <div className="p-6 text-center">
        <div className="bg-slate-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
            <Inbox size={20} className="text-slate-400" />
        </div>
        <p className="text-sm text-slate-500">No messages yet</p>
        <p className="text-xs text-slate-400 mt-1">
            Messages from homeowners will appear here
        </p>
    </div>
);

// ============================================
// MAIN WIDGET
// ============================================
export const RecentMessagesWidget = ({ 
    contractorId, 
    onViewAll,
    onSelectConversation,
    maxMessages = 3 
}) => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalUnread, setTotalUnread] = useState(0);

    // Subscribe to recent conversations
    useEffect(() => {
        if (!contractorId) return;

        const q = query(
            collection(db, 'channels'),
            where('participants', 'array-contains', contractorId),
            orderBy('lastMessageTime', 'desc'),
            limit(maxMessages)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const channelData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                homeownerName: doc.data().homeownerName || 'Homeowner',
            }));
            
            setConversations(channelData);
            
            // Calculate total unread
            const unread = channelData.reduce((sum, c) => {
                return sum + (c[`unreadCount_${contractorId}`] || 0);
            }, 0);
            setTotalUnread(unread);
            
            setLoading(false);
        }, (error) => {
            console.error('Error loading messages:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId, maxMessages]);

    // Don't render if no messages and not loading
    // Actually, let's always show the widget for consistency
    // if (!loading && conversations.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                        totalUnread > 0 ? 'bg-emerald-100' : 'bg-slate-100'
                    }`}>
                        <MessageSquare size={18} className={
                            totalUnread > 0 ? 'text-emerald-600' : 'text-slate-500'
                        } />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Messages</h3>
                        {totalUnread > 0 && (
                            <p className="text-xs text-emerald-600 font-medium">
                                {totalUnread} unread
                            </p>
                        )}
                    </div>
                </div>
                <button
                    onClick={onViewAll}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors"
                >
                    View All
                    <ArrowRight size={14} />
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="p-6 flex justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
            ) : conversations.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="divide-y divide-slate-50">
                    {conversations.map((conversation) => (
                        <MessagePreview
                            key={conversation.id}
                            conversation={conversation}
                            contractorId={contractorId}
                            onClick={() => onSelectConversation(conversation)}
                        />
                    ))}
                </div>
            )}

            {/* Footer - View All (if we have messages) */}
            {conversations.length > 0 && (
                <div className="p-3 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={onViewAll}
                        className="w-full py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Inbox size={16} />
                        Open Inbox
                    </button>
                </div>
            )}
        </div>
    );
};

export default RecentMessagesWidget;
