// src/features/contractor-pro/components/ContractorMessagesView.jsx
// ============================================
// CONTRACTOR MESSAGES VIEW
// ============================================
// Full inbox/chat interface for contractors to manage
// conversations with homeowners

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    MessageSquare, Send, Search, ArrowLeft, 
    User, Clock, Check, CheckCheck, Circle,
    MoreVertical, Phone, Mail, ChevronRight
} from 'lucide-react';
import { 
    collection, query, where, orderBy, onSnapshot, 
    doc, getDoc 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { 
    subscribeToChat, 
    sendMessage, 
    markChannelAsRead 
} from '../../../lib/chatService';
import toast from 'react-hot-toast';

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

const formatChatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Extract homeowner ID from channel ID (format: {homeownerId}_{contractorSlug})
const getHomeownerIdFromChannel = (channelId) => {
    if (!channelId) return null;
    const parts = channelId.split('_');
    return parts[0] || null;
};

// ============================================
// CONVERSATION LIST ITEM
// ============================================
const ConversationItem = ({ conversation, isActive, onClick, contractorId }) => {
    const unreadCount = conversation[`unreadCount_${contractorId}`] || 0;
    const hasUnread = unreadCount > 0;
    
    return (
        <button
            onClick={onClick}
            className={`w-full p-4 flex items-start gap-3 text-left transition-colors border-b border-slate-100 ${
                isActive 
                    ? 'bg-emerald-50 border-l-4 border-l-emerald-500' 
                    : 'hover:bg-slate-50'
            }`}
        >
            {/* Avatar */}
            <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                hasUnread ? 'bg-emerald-100' : 'bg-slate-100'
            }`}>
                <User size={20} className={hasUnread ? 'text-emerald-600' : 'text-slate-400'} />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-semibold truncate ${
                        hasUnread ? 'text-slate-900' : 'text-slate-700'
                    }`}>
                        {conversation.homeownerName || 'Homeowner'}
                    </h4>
                    <span className={`text-xs flex-shrink-0 ${
                        hasUnread ? 'text-emerald-600 font-medium' : 'text-slate-400'
                    }`}>
                        {formatMessageTime(conversation.lastMessageTime)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <p className={`text-sm truncate flex-1 ${
                        hasUnread ? 'text-slate-700 font-medium' : 'text-slate-500'
                    }`}>
                        {conversation.lastMessage || 'No messages yet'}
                    </p>
                    {hasUnread && (
                        <span className="h-5 w-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyInbox = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-slate-100 p-6 rounded-full mb-6">
            <MessageSquare size={48} className="text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-700 mb-2">No messages yet</h3>
        <p className="text-slate-500 max-w-sm">
            When homeowners message you about quotes or jobs, their conversations will appear here.
        </p>
    </div>
);

// ============================================
// CHAT PANEL (Right side)
// ============================================
const ChatPanel = ({ 
    conversation, 
    contractorId, 
    contractorName,
    onBack 
}) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    const homeownerId = getHomeownerIdFromChannel(conversation?.channelId);

    // Subscribe to messages
    useEffect(() => {
        if (!conversation?.channelId) return;
        
        setLoading(true);
        const unsubscribe = subscribeToChat(conversation.channelId, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);
            // Scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        // Mark as read when opening
        if (contractorId) {
            markChannelAsRead(conversation.channelId, contractorId);
        }

        return () => unsubscribe();
    }, [conversation?.channelId, contractorId]);

    // Focus input when conversation changes
    useEffect(() => {
        inputRef.current?.focus();
    }, [conversation?.channelId]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim() || sending) return;

        const textToSend = message.trim();
        setMessage('');
        setSending(true);

        try {
            await sendMessage(
                conversation.channelId,
                textToSend,
                contractorId,
                contractorName || 'Contractor',
                homeownerId // Pass homeowner ID so they get added to participants
            );
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
            setMessage(textToSend); // Restore on failure
        } finally {
            setSending(false);
        }
    };

    if (!conversation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                    <MessageSquare size={40} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-2">Select a conversation</h3>
                <p className="text-slate-500">Choose a conversation from the list to start messaging</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-white">
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
                {/* Back button (mobile) */}
                <button 
                    onClick={onBack}
                    className="md:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600"
                >
                    <ArrowLeft size={20} />
                </button>
                
                <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <User size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800">
                        {conversation.homeownerName || 'Homeowner'}
                    </h3>
                    <p className="text-xs text-slate-500">
                        {conversation.homeownerEmail || 'Customer'}
                    </p>
                </div>
                
                {/* Quick actions */}
                {conversation.homeownerPhone && (
                    <a 
                        href={`tel:${conversation.homeownerPhone}`}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                        <Phone size={18} />
                    </a>
                )}
                {conversation.homeownerEmail && (
                    <a 
                        href={`mailto:${conversation.homeownerEmail}`}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                        <Mail size={18} />
                    </a>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs mt-1">Send a message to start the conversation</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === contractorId;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-2xl p-3 ${
                                    isMe
                                        ? 'bg-emerald-600 text-white rounded-br-none'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                                }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                    <div className={`flex items-center gap-1 mt-1 ${
                                        isMe ? 'justify-end' : ''
                                    }`}>
                                        <span className={`text-[10px] ${
                                            isMe ? 'text-emerald-100' : 'text-slate-400'
                                        }`}>
                                            {formatChatTime(msg.createdAt)}
                                        </span>
                                        {isMe && (
                                            <CheckCheck size={12} className="text-emerald-200" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-slate-100 border border-transparent focus:bg-white focus:border-emerald-500 rounded-xl outline-none transition-all text-sm"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        disabled={!message.trim() || sending}
                        className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <Send size={18} />
                        <span className="hidden sm:inline font-medium">Send</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const ContractorMessagesView = ({ contractorId, contractorName }) => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showMobileChat, setShowMobileChat] = useState(false);

    // Subscribe to all channels where contractor is a participant
    useEffect(() => {
        if (!contractorId) return;

        const q = query(
            collection(db, 'channels'),
            where('participants', 'array-contains', contractorId),
            orderBy('lastMessageTime', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const channelData = [];
            
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const homeownerId = getHomeownerIdFromChannel(data.channelId);
                
                // Try to get homeowner details (if we have them stored)
                // For now, we'll use what's in the channel or defaults
                channelData.push({
                    id: docSnap.id,
                    ...data,
                    homeownerId,
                    homeownerName: data.homeownerName || 'Homeowner',
                    homeownerEmail: data.homeownerEmail || null,
                    homeownerPhone: data.homeownerPhone || null,
                });
            }
            
            setConversations(channelData);
            setLoading(false);
        }, (error) => {
            console.error('Error loading conversations:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    // Filter conversations by search
    const filteredConversations = useMemo(() => {
        if (!searchTerm.trim()) return conversations;
        const term = searchTerm.toLowerCase();
        return conversations.filter(c => 
            c.homeownerName?.toLowerCase().includes(term) ||
            c.lastMessage?.toLowerCase().includes(term)
        );
    }, [conversations, searchTerm]);

    // Calculate total unread
    const totalUnread = useMemo(() => {
        return conversations.reduce((sum, c) => {
            return sum + (c[`unreadCount_${contractorId}`] || 0);
        }, 0);
    }, [conversations, contractorId]);

    const handleSelectConversation = (conversation) => {
        setSelectedConversation(conversation);
        setShowMobileChat(true);
        // Mark as read
        if (contractorId) {
            markChannelAsRead(conversation.channelId, contractorId);
        }
    };

    const handleBack = () => {
        setShowMobileChat(false);
    };

    return (
        <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Messages</h1>
                        <p className="text-slate-500">
                            {totalUnread > 0 
                                ? `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}`
                                : 'Chat with your customers'
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Conversations List */}
                <div className={`w-full md:w-96 border-r border-slate-100 bg-white flex flex-col ${
                    showMobileChat ? 'hidden md:flex' : 'flex'
                }`}>
                    {/* Search */}
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-200 rounded-xl outline-none text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Conversations */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <EmptyInbox />
                        ) : (
                            filteredConversations.map((conversation) => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    isActive={selectedConversation?.id === conversation.id}
                                    onClick={() => handleSelectConversation(conversation)}
                                    contractorId={contractorId}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Panel */}
                <div className={`flex-1 ${
                    showMobileChat ? 'flex' : 'hidden md:flex'
                }`}>
                    <ChatPanel
                        conversation={selectedConversation}
                        contractorId={contractorId}
                        contractorName={contractorName}
                        onBack={handleBack}
                    />
                </div>
            </div>
        </div>
    );
};

export default ContractorMessagesView;
