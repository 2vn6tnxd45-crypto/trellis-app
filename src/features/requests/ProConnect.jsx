// src/features/requests/ProConnect.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Link as LinkIcon, Trash2, ArrowDownToLine, MapPin, Link2, 
    Send, Phone, Mail, User, Wrench, Star, Plus, Search,
    Clock, DollarSign, ChevronRight, Calendar, CheckCircle2,
    Copy, ExternalLink, Building2, Filter, SlidersHorizontal, X,
    MessageSquare, Send as SendIcon 
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, appId } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';
import { JobScheduler } from '../jobs/JobScheduler';
// Chat Service
import { getChannelId, subscribeToChat, sendMessage, markChannelAsRead } from '../../lib/chatService';

// ============================================
// REAL CHAT DRAWER - UPDATED with user info
// ============================================
const ChatDrawer = ({ pro, userId, userProfile, onClose }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);

    // Determine the Channel ID based on User + Pro Name
    const channelId = useMemo(() => getChannelId(userId, pro.name), [userId, pro.name]);

    // Get homeowner's display name from profile
    const homeownerName = userProfile?.name || userProfile?.displayName || 'Homeowner';
    const homeownerEmail = userProfile?.email || null;
    const homeownerPhone = userProfile?.phone || null;

    // Subscribe to real-time updates
    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeToChat(channelId, (newMessages) => {
            setMessages(newMessages);
            setLoading(false);
            // Scroll to bottom on new message
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            
            // Mark as read whenever new messages arrive while drawer is open
            if (userId) {
                markChannelAsRead(channelId, userId);
            }
        });

        return () => unsubscribe();
    }, [channelId, userId]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const textToSend = message;
        setMessage(''); // Clear input immediately for better UX

        try {
            const contractorId = pro.contractorId || null;
            
            // UPDATED: Pass real homeowner name and info
            await sendMessage(
                channelId, 
                textToSend, 
                userId, 
                homeownerName,  // Real name instead of 'Homeowner'
                contractorId,
                {  // senderInfo to store on channel for contractor visibility
                    name: homeownerName,
                    email: homeownerEmail,
                    phone: homeownerPhone
                }
            );
        } catch (error) {
            console.error("Failed to send", error);
            toast.error("Message failed to send");
            setMessage(textToSend); // Restore text if failed
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                            {pro.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{pro.name}</h3>
                            <p className="text-xs text-slate-500">
                                {loading ? 'Connecting...' : 'Secure Chat'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {messages.length === 0 && !loading && (
                        <div className="text-center py-10 opacity-50">
                            <p className="text-sm text-slate-500">No messages yet.</p>
                            <p className="text-xs text-slate-400">Start the conversation below!</p>
                        </div>
                    )}
                    
                    {messages.map((msg) => {
                        const isMe = msg.senderId === userId;
                        const timeStr = msg.createdAt?.toDate 
                            ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                            : 'Just now';

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                                    isMe
                                        ? 'bg-emerald-600 text-white rounded-br-none' 
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                                }`}>
                                    <p>{msg.text}</p>
                                    <p className={`text-[10px] mt-1 ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                        {timeStr}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 border rounded-xl outline-none transition-all"
                            autoFocus
                        />
                        <button 
                            type="submit"
                            disabled={!message.trim()}
                            className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                        >
                            <SendIcon size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// PRO CARD COMPONENT
// ============================================
const ProCard = ({ pro, onRequestService, onCall, onEmail, onMessage }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Check if chat is available (Pro is on platform)
    const canChat = pro.isOnPlatform && pro.contractorId;
    
    const totalSpent = pro.jobs.reduce((sum, job) => sum + (parseFloat(job.cost) || 0), 0);
    const categories = [...new Set(pro.jobs.map(j => j.category).filter(Boolean))];
    
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            {/* Header */}
            <div 
                className="p-5 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    {pro.logoUrl ? (
                        <img 
                            src={pro.logoUrl} 
                            alt={pro.name} 
                            className="h-14 w-14 rounded-xl object-contain bg-slate-50 border border-slate-100" 
                        />
                    ) : (
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
                            {pro.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    
                    {/* Info */}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{pro.name}</h3>
                                {pro.address && (
                                    <p className="text-xs text-slate-500 flex items-center mt-0.5">
                                        <MapPin size={10} className="mr-1" />
                                        {pro.address}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-slate-500 font-medium">
                                        {pro.jobs.length} job{pro.jobs.length !== 1 ? 's' : ''}
                                    </span>
                                    {totalSpent > 0 && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-xs text-emerald-600 font-bold">
                                                ${totalSpent.toLocaleString()} total
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* Quick Actions (Collapsed View) */}
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if (canChat) onMessage(pro); }}
                                    disabled={!canChat}
                                    className={`p-2 rounded-lg transition-colors ${
                                        canChat 
                                            ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' 
                                            : 'text-slate-300 bg-slate-50 cursor-not-allowed'
                                    }`}
                                    title={canChat ? "Message" : "This pro is not on Krib yet"}
                                >
                                    <MessageSquare size={18} />
                                </button>
                                {pro.phone && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onCall(pro.phone); }}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Call"
                                    >
                                        <Phone size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Categories */}
                        {categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {categories.slice(0, 3).map(cat => (
                                    <span 
                                        key={cat}
                                        className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                                    >
                                        {cat}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-50 animate-in slide-in-from-top-2">
                    {/* Contact Info */}
                    {(pro.phone || pro.email || pro.address) && (
                        <div className="bg-slate-50 rounded-xl p-3 mt-4 space-y-2">
                            {pro.phone && (
                                <a href={`tel:${pro.phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600">
                                    <Phone size={14} /> {pro.phone}
                                </a>
                            )}
                            {pro.email && (
                                <a href={`mailto:${pro.email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600">
                                    <Mail size={14} /> {pro.email}
                                </a>
                            )}
                            {pro.address && (
                                <div className="flex items-start gap-2 text-sm text-slate-600">
                                    <MapPin size={14} className="mt-0.5 shrink-0" />
                                    <span>{pro.address}</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Work History */}
                    <div className="mt-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Work History</p>
                        <div className="space-y-2">
                            {pro.jobs.slice(0, 5).map(job => (
                                <div key={job.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                            <Wrench size={14} className="text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{job.item}</p>
                                            <p className="text-xs text-slate-400">{job.dateInstalled || 'No date'}</p>
                                        </div>
                                    </div>
                                    {job.cost > 0 && (
                                        <span className="text-sm font-bold text-emerald-600">${parseFloat(job.cost).toLocaleString()}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* ACTION BUTTONS */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); if (canChat) onMessage(pro); }}
                            disabled={!canChat}
                            className={`flex-1 py-3 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                                canChat 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <MessageSquare size={18} />
                            {canChat ? 'Message' : 'Chat Unavailable'}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRequestService(pro); }}
                            className="flex-1 py-3 bg-white border-2 border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Send size={18} />
                            Request
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Active Request Card
const RequestCard = ({ request, onCopyLink, onDelete, onImport, onManage }) => {
    const handleCopy = () => {
        const url = `${window.location.origin}${window.location.pathname}?requestId=${request.id}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };

    const formatScheduledTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const getStatusDisplay = () => {
        switch (request.status) {
            case 'scheduled':
                return {
                    badge: 'SCHEDULED',
                    badgeColor: 'bg-emerald-100 text-emerald-700',
                    action: 'View Details',
                    actionColor: 'bg-emerald-600 text-white'
                };
            case 'slots_offered':
                return {
                    badge: 'TIMES AVAILABLE',
                    badgeColor: 'bg-amber-100 text-amber-700',
                    action: 'Pick a Time',
                    actionColor: 'bg-amber-600 text-white'
                };
            case 'quoted':
                return {
                    badge: 'QUOTE RECEIVED',
                    badgeColor: 'bg-blue-100 text-blue-700',
                    action: 'View Quote',
                    actionColor: 'bg-blue-600 text-white'
                };
            case 'submitted':
                return {
                    badge: 'SUBMITTED',
                    badgeColor: 'bg-slate-100 text-slate-600',
                    action: 'Import',
                    actionColor: 'bg-slate-600 text-white'
                };
            default:
                return {
                    badge: request.status?.toUpperCase() || 'PENDING',
                    badgeColor: 'bg-slate-100 text-slate-600',
                    action: 'View Details',
                    actionColor: 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                };
        }
    };

    const status = getStatusDisplay();

    return (
        <div className={`p-4 rounded-xl border ${request.status === 'submitted' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                {request.contractorLogoUrl ? (
                    <img 
                        src={request.contractorLogoUrl} 
                        alt="" 
                        className="w-12 h-12 rounded-xl object-contain bg-slate-50 border border-slate-100"
                    />
                ) : (
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Building2 className="text-slate-400" />
                    </div>
                )}
                <div className="flex-1">
                    <p className="font-bold text-slate-800">
                        {request.contractorName || 'Service Request'}
                    </p>
                    <p className="text-sm text-slate-500 truncate">{request.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${status.badgeColor}`}>
                    {status.badge}
                </span>
            </div>

            {/* Scheduled Time Display */}
            {request.status === 'scheduled' && request.scheduledTime && (
                <div className="bg-emerald-50 rounded-xl p-3 mb-4 flex items-center gap-2 text-emerald-700">
                    <Calendar size={16} />
                    <span className="font-bold text-sm">
                        {formatScheduledTime(request.scheduledTime)}
                    </span>
                </div>
            )}

            {/* Action Area */}
            <div className="flex gap-2">
                <button 
                    onClick={request.status === 'submitted' ? () => onImport(request) : () => onManage(request)}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm ${status.actionColor}`}
                >
                    {status.action}
                </button>
                
                <button onClick={handleCopy} className="p-3 bg-slate-100 rounded-xl text-slate-500 hover:bg-slate-200 transition-colors">
                    <Copy size={20}/>
                </button>
                <button onClick={() => onDelete(request.id)} className="p-3 bg-red-50 rounded-xl text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={20}/>
                </button>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT - UPDATED with userProfile prop
// ============================================
export const ProConnect = ({ 
    userId, 
    userProfile,  // NEW: Added userProfile prop for homeowner info
    propertyName, 
    propertyAddress, 
    records, 
    onRequestImport, 
    onOpenQuickRequest 
}) => {
    const [requests, setRequests] = useState([]);
    const [activeTab, setActiveTab] = useState('pros');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [selectedJob, setSelectedJob] = useState(null); 
    
    // Chat State
    const [selectedChatPro, setSelectedChatPro] = useState(null);
    
    // Platform Pros State
    const [platformPros, setPlatformPros] = useState([]);

    // Fetch Requests
    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [userId]);

    // Fetch Platform Pros
    useEffect(() => {
        if (!userId) return;
        const q = collection(db, 'artifacts', appId, 'users', userId, 'pros');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPlatformPros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [userId]);
    
    // MERGE Contractors: Platform Pros + Record Pros
    const contractors = useMemo(() => {
        const prosMap = {};
        
        // 1. Add Platform Pros (Definitive source for chat/connection)
        platformPros.forEach(p => {
            prosMap[p.name] = { 
                ...p, 
                jobs: [], 
                isOnPlatform: true
            };
        });

        // 2. Add/Merge Record Pros
        records.forEach(r => {
            const name = r.contractor;
            if (name && name.length > 2) {
                if (!prosMap[name]) {
                    prosMap[name] = { 
                        name, 
                        phone: null, 
                        email: null, 
                        address: null, 
                        isOnPlatform: false,
                        jobs: [] 
                    };
                }
                
                const pro = prosMap[name];
                if (!pro.phone && r.contractorPhone) pro.phone = r.contractorPhone;
                if (!pro.email && r.contractorEmail) pro.email = r.contractorEmail;
                if (!pro.address && r.contractorAddress) pro.address = r.contractorAddress; 
                
                pro.jobs.push(r);
            }
        });
        
        return Object.values(prosMap).sort((a, b) => b.jobs.length - a.jobs.length);
    }, [records, platformPros]);
    
    const filteredContractors = useMemo(() => {
        return contractors.filter(pro => {
            const matchesSearch = pro.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || pro.jobs.some(j => j.category === filterCategory);
            return matchesSearch && matchesCategory;
        });
    }, [contractors, searchTerm, filterCategory]);
    
    const pendingRequests = requests.filter(r => 
        ['pending', 'scheduling', 'quoted', 'scheduled', 'slots_offered', 'submitted'].includes(r.status)
    );
    
    const handleDeleteRequest = async (id) => {
        if (!confirm('Delete this request?')) return;
        await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, id));
    };
    
    return (
        <div className="space-y-6 relative"> 
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-extrabold text-slate-800">Pro Connect</h1><p className="text-sm text-slate-500">Manage contractors & service requests</p></div>
                <button onClick={() => onOpenQuickRequest && onOpenQuickRequest(null)} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2"><Plus size={18}/> New Request</button>
            </div>
            
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setActiveTab('pros')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${activeTab === 'pros' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>My Pros ({contractors.length})</button>
                <button onClick={() => setActiveTab('requests')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm ${activeTab === 'requests' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Requests ({pendingRequests.length})</button>
            </div>
            
            {activeTab === 'pros' && (
                <div className="space-y-4">
                    {contractors.length > 0 && (
                        <div className="flex gap-3">
                            <div className="relative flex-grow"><Search className="absolute left-3 top-3 h-5 w-5 text-slate-400"/><input type="text" placeholder="Search contractors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none"/></div>
                        </div>
                    )}
                    {filteredContractors.length === 0 ? <EmptyState icon={Wrench} title="No Contractors" description="Scan receipts to automatically add pros."/> : 
                        filteredContractors.map((pro, idx) => (
                            <ProCard 
                                key={idx} 
                                pro={pro} 
                                onRequestService={(p) => onOpenQuickRequest({item: 'Service', contractor: p.name})} 
                                onCall={(p) => window.open(`tel:${p}`)} 
                                onEmail={(e) => window.open(`mailto:${e}`)}
                                onMessage={(p) => setSelectedChatPro(p)}
                            />
                        ))
                    }
                </div>
            )}
            
            {activeTab === 'requests' && (
                <div className="space-y-3">
                    {pendingRequests.length === 0 ? 
                        <EmptyState icon={Send} title="No Requests" description="Create a link to send to a contractor."/> 
                        : pendingRequests.map(req => (
                            <RequestCard 
                                key={req.id} 
                                request={req} 
                                onDelete={handleDeleteRequest} 
                                onImport={onRequestImport}
                                onManage={(job) => setSelectedJob(job)}
                            />
                        ))
                    }
                </div>
            )}

            {/* Job Scheduler Modal for Homeowner */}
            {selectedJob && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedJob(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Manage Job</h3>
                            <button onClick={() => setSelectedJob(null)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="p-4 bg-slate-50">
                            <JobScheduler 
                                job={selectedJob} 
                                userType="homeowner" 
                                onUpdate={() => {}} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Drawer Overlay - UPDATED with userProfile */}
            {selectedChatPro && (
                <ChatDrawer 
                    pro={selectedChatPro} 
                    userId={userId}
                    userProfile={userProfile}  // NEW: Pass user profile for name
                    onClose={() => setSelectedChatPro(null)} 
                />
            )}
        </div>
    );
};
