// src/features/requests/ProConnect.jsx
// ============================================
// PRO CONNECT - WITH MARKETPLACE INTEGRATION
// ============================================
// UPDATED: Added marketplace tabs (Find Pros, My Job Posts)
// UPDATED: Added proper job creation when selecting contractor

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Link as LinkIcon, Trash2, ArrowDownToLine, MapPin, Link2, 
    Send, Phone, Mail, User, Wrench, Star, Plus, Search,
    Clock, DollarSign, ChevronRight, Calendar, CheckCircle2,
    Copy, ExternalLink, Building2, Filter, SlidersHorizontal, X,
    MessageSquare, Send as SendIcon, Globe, Users, Briefcase
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, appId } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';
import { JobScheduler } from '../jobs/JobScheduler';
// Chat Service
import { getChannelId, subscribeToChat, sendMessage, markChannelAsRead } from '../../lib/chatService';

// NEW: Import marketplace components
import { 
    ContractorBrowser, 
    ServiceRequestCreator, 
    HomeownerRequestManager 
} from '../marketplace';

// NEW: Import marketplace integration service
import { 
    createJobFromMarketplaceSelection,
    createMarketplaceChatChannel 
} from '../marketplace/lib/marketplaceIntegration';

// ============================================
// HELPER: Format property address for display
// ============================================
const formatAddressForChannel = (address) => {
    if (!address) return null;
    if (typeof address === 'string') return address;
    // Handle address object format
    if (address.street) {
        return [address.street, address.city, address.state].filter(Boolean).join(', ');
    }
    return null;
};

// ============================================
// REAL CHAT DRAWER - UPDATED with propertyAddress
// ============================================
const ChatDrawer = ({ pro, userId, userProfile, propertyAddress, onClose }) => {
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

    // Derive scope of work from pro's service categories
    const categories = [...new Set((pro.jobs || []).map(j => j.category).filter(Boolean))];
    const scopeOfWork = categories.length > 0 ? categories.join(', ') : (pro.specialty || null);

    // Format property address for storage
    const formattedAddress = formatAddressForChannel(propertyAddress);

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
            
            // Pass homeowner info including address and scope
            await sendMessage(
                channelId, 
                textToSend, 
                userId, 
                homeownerName,
                contractorId,
                {  // senderInfo to store on channel for contractor visibility
                    name: homeownerName,
                    email: homeownerEmail,
                    phone: homeownerPhone,
                    propertyAddress: formattedAddress,
                    scopeOfWork: scopeOfWork
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
                        <img src={pro.logoUrl} alt={pro.name} className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                        <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Wrench className="h-6 w-6 text-emerald-600" />
                        </div>
                    )}
                    
                    {/* Info */}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 truncate">{pro.name}</h3>
                            {pro.isOnPlatform && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full shrink-0">
                                    On Krib
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500">
                            {pro.jobs.length} job{pro.jobs.length !== 1 ? 's' : ''} completed
                            {totalSpent > 0 && ` · $${totalSpent.toLocaleString()} total`}
                        </p>
                        {categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {categories.slice(0, 3).map(cat => (
                                    <span key={cat} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                                        {cat}
                                    </span>
                                ))}
                                {categories.length > 3 && (
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                                        +{categories.length - 3} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Expand indicator */}
                    <ChevronRight 
                        className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                        size={20} 
                    />
                </div>
            </div>
            
            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                    {/* Contact Info */}
                    {(pro.phone || pro.email || pro.address) && (
                        <div className="space-y-2">
                            {pro.phone && (
                                <button 
                                    onClick={() => onCall(pro.phone)}
                                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
                                >
                                    <Phone size={14} />
                                    {pro.phone}
                                </button>
                            )}
                            {pro.email && (
                                <button 
                                    onClick={() => onEmail(pro.email)}
                                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
                                >
                                    <Mail size={14} />
                                    {pro.email}
                                </button>
                            )}
                            {pro.address && (
                                <p className="flex items-center gap-2 text-sm text-slate-500">
                                    <MapPin size={14} />
                                    {pro.address}
                                </p>
                            )}
                        </div>
                    )}
                    
                    {/* Recent Jobs */}
                    {pro.jobs.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Recent Work</p>
                            <div className="space-y-2">
                                {pro.jobs.slice(0, 3).map((job, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded-lg">
                                        <span className="text-slate-700">{job.item}</span>
                                        {job.cost && (
                                            <span className="text-slate-500">${parseFloat(job.cost).toLocaleString()}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button 
                            onClick={() => onRequestService(pro)}
                            className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700"
                        >
                            Request Service
                        </button>
                        {canChat && (
                            <button 
                                onClick={() => onMessage(pro)}
                                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"
                                title="Message"
                            >
                                <MessageSquare size={18} />
                            </button>
                        )}
                        {pro.phone && (
                            <button 
                                onClick={() => onCall(pro.phone)}
                                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"
                                title="Call"
                            >
                                <Phone size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// REQUEST CARD COMPONENT (for direct requests)
// ============================================
const RequestCard = ({ request, onImport, onManage, onDelete }) => {
    const getStatusConfig = (status) => {
        switch (status) {
            case 'submitted':
                return { 
                    label: 'Ready to Import', 
                    color: 'bg-emerald-100 text-emerald-700',
                    action: 'Import Records',
                    actionColor: 'bg-emerald-600 hover:bg-emerald-700 text-white'
                };
            case 'scheduled':
                return { 
                    label: 'Scheduled', 
                    color: 'bg-blue-100 text-blue-700',
                    action: 'View Details',
                    actionColor: 'bg-blue-600 hover:bg-blue-700 text-white'
                };
            case 'slots_offered':
                return { 
                    label: 'Times Available', 
                    color: 'bg-amber-100 text-amber-700',
                    action: 'Pick a Time',
                    actionColor: 'bg-amber-500 hover:bg-amber-600 text-white'
                };
            case 'quoted':
                return { 
                    label: 'Quote Ready', 
                    color: 'bg-purple-100 text-purple-700',
                    action: 'View Quote',
                    actionColor: 'bg-purple-600 hover:bg-purple-700 text-white'
                };
            case 'in_progress':
                return { 
                    label: 'In Progress', 
                    color: 'bg-blue-100 text-blue-700',
                    action: 'View Details',
                    actionColor: 'bg-slate-600 hover:bg-slate-700 text-white'
                };
            default:
                return { 
                    label: 'Pending', 
                    color: 'bg-slate-100 text-slate-600',
                    action: 'View Details',
                    actionColor: 'bg-slate-600 hover:bg-slate-700 text-white'
                };
        }
    };
    
    const status = getStatusConfig(request.status);
    
    const handleCopy = () => {
        const url = `${window.location.origin}${window.location.pathname}?requestId=${request.id}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };
    
    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-bold text-slate-800">{request.description}</h3>
                    <p className="text-sm text-slate-500">
                        {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                    </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${status.color}`}>
                    {status.label}
                </span>
            </div>
            
            {/* Linked item context */}
            {request.linkedContext && (
                <div className="mb-3 p-2 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <span className="font-medium">Related to:</span> {request.linkedContext.item}
                    {request.linkedContext.brand && ` (${request.linkedContext.brand})`}
                </div>
            )}
            
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
// SERVICE REQUEST CREATOR MODAL (NEW)
// ============================================
const ServiceRequestModal = ({ isOpen, onClose, userId, userProfile, propertyAddress }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Post a Job to the Marketplace</h2>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <ServiceRequestCreator
                        homeownerId={userId}
                        homeownerName={userProfile?.name || 'Homeowner'}
                        homeownerEmail={userProfile?.email}
                        homeownerPhone={userProfile?.phone}
                        propertyAddress={propertyAddress}
                        onSuccess={() => {
                            toast.success('Job posted to marketplace!');
                            onClose();
                        }}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const ProConnect = ({ 
    userId, 
    userProfile,
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

    // NEW: Post Job Modal State
    const [showPostJobModal, setShowPostJobModal] = useState(false);
    
    // NEW: Loading state for contractor selection
    const [isSelectingContractor, setIsSelectingContractor] = useState(false);

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
        toast.success('Request deleted');
    };

    // ============================================
    // NEW: Handle contractor selection from marketplace
    // ============================================
    const handleSelectContractor = async (serviceRequestId, response, serviceRequest) => {
        setIsSelectingContractor(true);
        
        try {
            // Create the job and link everything
            const result = await createJobFromMarketplaceSelection({
                serviceRequestId,
                response,
                serviceRequest,
                homeownerId: userId,
                propertyId: null // Could pass active property ID if available
            });
            
            if (result.success) {
                // Create chat channel so they can communicate
                await createMarketplaceChatChannel({
                    homeownerId: userId,
                    contractorId: response.contractorId,
                    contractorName: response.contractorName || response.businessName,
                    homeownerName: userProfile?.name || 'Homeowner',
                    serviceRequestId,
                    jobId: result.jobId
                });
                
                toast.success(
                    `${response.contractorName || 'Contractor'} selected! They'll be in touch soon.`,
                    { duration: 4000 }
                );
                
                // Switch to the Direct tab to see the new job
                setActiveTab('requests');
            } else {
                toast.error(result.error || 'Failed to select contractor');
            }
        } catch (error) {
            console.error('Error selecting contractor:', error);
            toast.error('Something went wrong. Please try again.');
        } finally {
            setIsSelectingContractor(false);
        }
    };

    // ============================================
    // NEW: Handle messaging from marketplace
    // ============================================
    const handleMessageContractor = (contractorId, contractorName) => {
        // Find or create a pro object for the chat drawer
        const existingPro = contractors.find(p => p.contractorId === contractorId);
        
        if (existingPro) {
            setSelectedChatPro(existingPro);
        } else {
            // Create a minimal pro object for chat
            setSelectedChatPro({
                name: contractorName || 'Contractor',
                contractorId,
                isOnPlatform: true,
                jobs: []
            });
        }
    };
    
    return (
        <div className="space-y-6 relative"> 
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800">Pro Connect</h1>
                    <p className="text-sm text-slate-500">Find help & manage your contractors</p>
                </div>
                <button 
                    onClick={() => setShowPostJobModal(true)} 
                    className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2"
                >
                    <Globe size={18}/> Post a Job
                </button>
            </div>
            
            {/* Tabs - UPDATED with new marketplace tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('pros')} 
                    className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'pros' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                    <Users size={14} className="inline mr-1.5 -mt-0.5" />
                    My Pros ({contractors.length})
                </button>
                <button 
                    onClick={() => setActiveTab('find')} 
                    className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'find' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                    <Search size={14} className="inline mr-1.5 -mt-0.5" />
                    Find Pros
                </button>
                <button 
                    onClick={() => setActiveTab('jobs')} 
                    className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'jobs' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                    <Briefcase size={14} className="inline mr-1.5 -mt-0.5" />
                    My Job Posts
                </button>
                <button 
                    onClick={() => setActiveTab('requests')} 
                    className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm whitespace-nowrap ${activeTab === 'requests' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                    <Send size={14} className="inline mr-1.5 -mt-0.5" />
                    Direct ({pendingRequests.length})
                </button>
            </div>
            
            {/* ========== MY PROS TAB (EXISTING) ========== */}
            {activeTab === 'pros' && (
                <div className="space-y-4">
                    {contractors.length > 0 && (
                        <div className="flex gap-3">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400"/>
                                <input 
                                    type="text" 
                                    placeholder="Search contractors..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none"
                                />
                            </div>
                        </div>
                    )}
                    {filteredContractors.length === 0 ? (
                        <EmptyState 
                            icon={Wrench} 
                            title="No Contractors Yet" 
                            description="Your contractors will appear here after you complete jobs or scan receipts."
                        />
                    ) : (
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
                    )}
                </div>
            )}

            {/* ========== FIND PROS TAB (NEW - MARKETPLACE) ========== */}
            {activeTab === 'find' && (
                <ContractorBrowser
                    userId={userId}
                    userZipCode={propertyAddress?.zip || propertyAddress?.zipCode}
                    onMessageContractor={(contractorId, contractorName) => 
                        handleMessageContractor(contractorId, contractorName)
                    }
                    onRequestQuote={(contractor) => {
                        // Could open post job modal pre-filled for this contractor
                        toast.success(`Viewing ${contractor.businessName}'s profile`);
                    }}
                />
            )}

            {/* ========== MY JOB POSTS TAB (NEW - MARKETPLACE) ========== */}
            {activeTab === 'jobs' && (
                <HomeownerRequestManager
                    homeownerId={userId}
                    onSelectContractor={(requestId, response, serviceRequest) => 
                        handleSelectContractor(requestId, response, serviceRequest)
                    }
                    onMessageContractor={(contractorId, contractorName) => 
                        handleMessageContractor(contractorId, contractorName)
                    }
                />
            )}
            
            {/* ========== DIRECT REQUESTS TAB (EXISTING) ========== */}
            {activeTab === 'requests' && (
                <div className="space-y-3">
                    {/* Quick create button */}
                    <button 
                        onClick={() => onOpenQuickRequest && onOpenQuickRequest(null)}
                        className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-medium hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={20} />
                        Create Direct Request Link
                    </button>

                    {pendingRequests.length === 0 ? (
                        <EmptyState 
                            icon={Send} 
                            title="No Direct Requests" 
                            description="Direct requests are links you send to a specific contractor. For broadcasting to multiple pros, use 'Post a Job'."
                        />
                    ) : (
                        pendingRequests.map(request => (
                            <RequestCard
                                key={request.id}
                                request={request}
                                onImport={onRequestImport}
                                onManage={(r) => setSelectedJob(r)}
                                onDelete={handleDeleteRequest}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Chat Drawer */}
            {selectedChatPro && (
                <ChatDrawer
                    pro={selectedChatPro}
                    userId={userId}
                    userProfile={userProfile}
                    propertyAddress={propertyAddress}
                    onClose={() => setSelectedChatPro(null)}
                />
            )}

            {/* Job Scheduler Modal for selected job */}
            {selectedJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">{selectedJob.description}</h2>
                            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                <X size={20} />
                            </button>
                        </div>
                        <JobScheduler 
                            job={selectedJob} 
                            userType="homeowner" 
                            onUpdate={() => setSelectedJob(null)}
                        />
                    </div>
                </div>
            )}

            {/* Post Job Modal (NEW) */}
            <ServiceRequestModal
                isOpen={showPostJobModal}
                onClose={() => setShowPostJobModal(false)}
                userId={userId}
                userProfile={userProfile}
                propertyAddress={propertyAddress}
            />
            
            {/* Loading overlay for contractor selection */}
            {isSelectingContractor && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
                    <div className="bg-white rounded-2xl p-6 flex items-center gap-3">
                        <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
                        <span className="font-medium text-slate-700">Selecting contractor...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProConnect;
