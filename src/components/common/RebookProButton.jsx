// src/components/common/RebookProButton.jsx
// ============================================
// REBOOK PRO BUTTON
// ============================================
// A button component that allows homeowners to quickly message
// the contractor linked to a home record. This is the core of
// Krib's "flywheel" - completed jobs lead to repeat business.
//
// Usage:
// <RebookProButton 
//     contractor="ABC Plumbing"
//     contractorId="abc123"
//     contractorPhone="555-1234"
//     contractorEmail="abc@plumbing.com"
//     itemName="Water Heater"
//     userId={userId}
//     userProfile={userProfile}
//     propertyAddress="123 Main St"
// />

import React, { useState } from 'react';
import { MessageSquare, Phone, Mail, X, Send, ArrowLeft, User, Loader2 } from 'lucide-react';
import { getChannelId, sendMessage, subscribeToChat, markChannelAsRead } from '../../lib/chatService';
import toast from 'react-hot-toast';

// ============================================
// CHAT DRAWER COMPONENT
// ============================================
const RebookChatDrawer = ({ 
    contractor,
    contractorId,
    contractorPhone,
    contractorEmail,
    itemName,
    userId,
    userProfile,
    propertyAddress,
    onClose 
}) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = React.useRef(null);

    // Create channel ID from user + contractor name
    const channelId = React.useMemo(() => 
        getChannelId(userId, contractor), 
        [userId, contractor]
    );

    // Get homeowner info from profile
    const homeownerName = userProfile?.name || userProfile?.displayName || 'Homeowner';
    const homeownerEmail = userProfile?.email || null;
    const homeownerPhone = userProfile?.phone || null;

    // Subscribe to chat messages
    React.useEffect(() => {
        if (!channelId) return;
        
        setLoading(true);
        const unsubscribe = subscribeToChat(channelId, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);
            // Scroll to bottom
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        // Mark as read when opening
        if (userId) {
            markChannelAsRead(channelId, userId);
        }

        return () => unsubscribe();
    }, [channelId, userId]);

    // Handle sending message
    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim() || sending) return;

        const textToSend = message.trim();
        setMessage('');
        setSending(true);

        try {
            await sendMessage(
                channelId,
                textToSend,
                userId,
                homeownerName,
                contractorId, // recipientId for unread count
                {
                    name: homeownerName,
                    email: homeownerEmail,
                    phone: homeownerPhone,
                    propertyAddress: propertyAddress || '',
                    scopeOfWork: `Re: ${itemName}`
                }
            );
            toast.success('Message sent!');
        } catch (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
            setMessage(textToSend);
        } finally {
            setSending(false);
        }
    };

    // Format time for messages
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
                onClick={onClose} 
            />
            
            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={onClose}
                                className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                <User size={18} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{contractor}</h3>
                                <p className="text-xs text-slate-500">Re: {itemName}</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    {/* Contact Options */}
                    {(contractorPhone || contractorEmail) && (
                        <div className="flex gap-2 mt-3 pl-12">
                            {contractorPhone && (
                                <a 
                                    href={`tel:${contractorPhone}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                                >
                                    <Phone size={12} />
                                    Call
                                </a>
                            )}
                            {contractorEmail && (
                                <a 
                                    href={`mailto:${contractorEmail}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
                                >
                                    <Mail size={12} />
                                    Email
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                            <MessageSquare className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-slate-600 text-sm font-medium">Start a conversation</p>
                            <p className="text-slate-400 text-xs mt-1">
                                Message {contractor} about your {itemName}
                            </p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg) => {
                                const isMe = msg.senderId === userId;
                                return (
                                    <div 
                                        key={msg.id}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                            isMe 
                                                ? 'bg-emerald-600 text-white rounded-br-md' 
                                                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'
                                        }`}>
                                            <p className="text-sm">{msg.text}</p>
                                            <p className={`text-[10px] mt-1 ${
                                                isMe ? 'text-emerald-200' : 'text-slate-400'
                                            }`}>
                                                {formatTime(msg.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={scrollRef} />
                        </>
                    )}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={`Message ${contractor}...`}
                            className="flex-1 px-4 py-3 bg-slate-100 rounded-xl border-0 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={!message.trim() || sending}
                            className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {sending ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// MAIN REBOOK PRO BUTTON COMPONENT
// ============================================
export const RebookProButton = ({ 
    contractor,
    contractorId,
    contractorPhone,
    contractorEmail,
    itemName,
    userId,
    userProfile,
    propertyAddress,
    variant = 'default' // 'default' | 'compact' | 'full'
}) => {
    const [showChat, setShowChat] = useState(false);

    // Don't render if no contractor
    if (!contractor) return null;

    // Render based on variant
    if (variant === 'compact') {
        return (
            <>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowChat(true);
                    }}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title={`Message ${contractor}`}
                >
                    <MessageSquare size={16} />
                </button>

                {showChat && (
                    <RebookChatDrawer
                        contractor={contractor}
                        contractorId={contractorId}
                        contractorPhone={contractorPhone}
                        contractorEmail={contractorEmail}
                        itemName={itemName}
                        userId={userId}
                        userProfile={userProfile}
                        propertyAddress={propertyAddress}
                        onClose={() => setShowChat(false)}
                    />
                )}
            </>
        );
    }

    if (variant === 'full') {
        return (
            <>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowChat(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                >
                    <MessageSquare size={18} />
                    Message {contractor}
                </button>

                {showChat && (
                    <RebookChatDrawer
                        contractor={contractor}
                        contractorId={contractorId}
                        contractorPhone={contractorPhone}
                        contractorEmail={contractorEmail}
                        itemName={itemName}
                        userId={userId}
                        userProfile={userProfile}
                        propertyAddress={propertyAddress}
                        onClose={() => setShowChat(false)}
                    />
                )}
            </>
        );
    }

    // Default variant
    return (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowChat(true);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-100"
            >
                <MessageSquare size={14} />
                <span>Rebook {contractor}</span>
            </button>

            {showChat && (
                <RebookChatDrawer
                    contractor={contractor}
                    contractorId={contractorId}
                    contractorPhone={contractorPhone}
                    contractorEmail={contractorEmail}
                    itemName={itemName}
                    userId={userId}
                    userProfile={userProfile}
                    propertyAddress={propertyAddress}
                    onClose={() => setShowChat(false)}
                />
            )}
        </>
    );
};

export default RebookProButton;
