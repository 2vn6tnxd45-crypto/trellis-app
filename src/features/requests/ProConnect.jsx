// src/features/requests/ProConnect.jsx
// ============================================
// 🔧 PRO CONNECT
// ============================================
// Reimagined contractor management that emphasizes:
// 1. Easy rebooking of trusted pros
// 2. Work history visibility
// 3. Quick link generation

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Link as LinkIcon, Trash2, ArrowDownToLine, MapPin, Link2, 
    Send, Phone, Mail, User, Wrench, Star, Plus, Search,
    Clock, DollarSign, ChevronRight, Calendar, CheckCircle2,
    Copy, ExternalLink, Building2, Filter, SlidersHorizontal
} from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

// Pro Card Component
const ProCard = ({ pro, onRequestService, onCall, onEmail }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const totalSpent = pro.jobs.reduce((sum, job) => sum + (parseFloat(job.cost) || 0), 0);
    const lastJob = pro.jobs.sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled))[0];
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
                    <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
                        {pro.name.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{pro.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
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
                            
                            {/* Quick Actions */}
                            <div className="flex gap-1">
                                {pro.phone && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onCall(pro.phone); }}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Call"
                                    >
                                        <Phone size={18} />
                                    </button>
                                )}
                                {pro.email && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onEmail(pro.email); }}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Email"
                                    >
                                        <Mail size={18} />
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
                                {categories.length > 3 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                        +{categories.length - 3} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-50 animate-in slide-in-from-top-2">
                    {/* Contact Info */}
                    {(pro.phone || pro.email) && (
                        <div className="bg-slate-50 rounded-xl p-3 mt-4 space-y-2">
                            {pro.phone && (
                                <a 
                                    href={`tel:${pro.phone}`}
                                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
                                >
                                    <Phone size={14} />
                                    {pro.phone}
                                </a>
                            )}
                            {pro.email && (
                                <a 
                                    href={`mailto:${pro.email}`}
                                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
                                >
                                    <Mail size={14} />
                                    {pro.email}
                                </a>
                            )}
                        </div>
                    )}
                    
                    {/* Work History */}
                    <div className="mt-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Work History</p>
                        <div className="space-y-2">
                            {pro.jobs.slice(0, 5).map(job => (
                                <div 
                                    key={job.id}
                                    className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg"
                                >
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
                                        <span className="text-sm font-bold text-emerald-600">
                                            ${parseFloat(job.cost).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {pro.jobs.length > 5 && (
                                <p className="text-xs text-slate-400 text-center py-2">
                                    + {pro.jobs.length - 5} more jobs
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {/* Request Service Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onRequestService(pro); }}
                        className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Send size={16} />
                        Request Service
                    </button>
                </div>
            )}
        </div>
    );
};

// Active Request Card
const RequestCard = ({ request, onCopyLink, onDelete, onImport }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        const url = `${window.location.origin}${window.location.pathname}?requestId=${request.id}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
    };
    
    const isSubmitted = request.status === 'submitted';
    const isPending = request.status === 'pending';
    
    return (
        <div className={`p-4 rounded-xl border ${isSubmitted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 truncate">{request.description}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isSubmitted 
                                ? 'bg-emerald-200 text-emerald-800' 
                                : 'bg-amber-100 text-amber-700'
                        }`}>
                            {request.status}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        {request.linkedContext && (
                            <span className="flex items-center gap-1">
                                <LinkIcon size={10} />
                                {request.linkedContext.item}
                            </span>
                        )}
                        {request.propertyAddress && (
                            <span className="flex items-center gap-1">
                                <MapPin size={10} />
                                Address shared
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    {isSubmitted && (
                        <button
                            onClick={() => onImport(request)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                            <ArrowDownToLine size={12} />
                            Import
                        </button>
                    )}
                    {isPending && (
                        <button
                            onClick={handleCopy}
                            className={`p-2 rounded-lg transition-colors ${
                                copied 
                                    ? 'bg-emerald-100 text-emerald-600' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(request.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main Component
export const ProConnect = ({ 
    userId, 
    propertyName, 
    propertyAddress, 
    records, 
    onRequestImport,
    onOpenQuickRequest 
}) => {
    const [requests, setRequests] = useState([]);
    const [activeTab, setActiveTab] = useState('pros'); // 'pros' | 'requests'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    
    // Listen for requests
    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [userId]);
    
    // Derive contractors from records
    const contractors = useMemo(() => {
        const prosMap = {};
        
        records.forEach(r => {
            const name = r.contractor;
            if (name && name.length > 2) {
                if (!prosMap[name]) {
                    prosMap[name] = {
                        name,
                        phone: null,
                        email: null,
                        jobs: []
                    };
                }
                // Update contact info if found
                if (r.contractorPhone) prosMap[name].phone = r.contractorPhone;
                if (r.contractorEmail) prosMap[name].email = r.contractorEmail;
                prosMap[name].jobs.push(r);
            }
        });
        
        return Object.values(prosMap).sort((a, b) => b.jobs.length - a.jobs.length);
    }, [records]);
    
    // Filter contractors
    const filteredContractors = useMemo(() => {
        return contractors.filter(pro => {
            const matchesSearch = pro.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || 
                pro.jobs.some(j => j.category === filterCategory);
            return matchesSearch && matchesCategory;
        });
    }, [contractors, searchTerm, filterCategory]);
    
    // Get unique categories from contractors
    const availableCategories = useMemo(() => {
        const cats = new Set();
        contractors.forEach(pro => {
            pro.jobs.forEach(job => {
                if (job.category) cats.add(job.category);
            });
        });
        return Array.from(cats).sort();
    }, [contractors]);
    
    const pendingRequests = requests.filter(r => r.status === 'pending');
    const submittedRequests = requests.filter(r => r.status === 'submitted');
    
    const handleDeleteRequest = async (id) => {
        if (!confirm('Delete this request link?')) return;
        try {
            await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, id));
            toast.success('Request deleted');
        } catch (e) {
            toast.error('Failed to delete');
        }
    };
    
    const handleCall = (phone) => {
        window.open(`tel:${phone}`);
    };
    
    const handleEmail = (email) => {
        window.open(`mailto:${email}`);
    };
    
    const handleRequestService = (pro) => {
        // Find the most recent job to use as context
        const recentJob = pro.jobs.sort((a, b) => 
            new Date(b.dateInstalled) - new Date(a.dateInstalled)
        )[0];
        
        if (recentJob && onOpenQuickRequest) {
            onOpenQuickRequest(recentJob);
        }
    };
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800">Pro Connect</h1>
                    <p className="text-sm text-slate-500">Manage contractors & service requests</p>
                </div>
                
                {/* New Request Button */}
                <button
                    onClick={() => onOpenQuickRequest && onOpenQuickRequest(null)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={18} />
                    New Request
                </button>
            </div>
            
            {/* Submitted Requests Alert */}
            {submittedRequests.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-emerald-100 p-2 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900">
                                {submittedRequests.length} New Submission{submittedRequests.length > 1 ? 's' : ''}
                            </h3>
                            <p className="text-xs text-emerald-700">Ready to import into your home record</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {submittedRequests.map(req => (
                            <RequestCard 
                                key={req.id}
                                request={req}
                                onDelete={handleDeleteRequest}
                                onImport={onRequestImport}
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('pros')}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                        activeTab === 'pros' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    My Pros ({contractors.length})
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                        activeTab === 'requests' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Active Links
                    {pendingRequests.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
            </div>
            
            {/* Pros Tab */}
            {activeTab === 'pros' && (
                <div className="space-y-4">
                    {/* Search & Filter */}
                    {contractors.length > 0 && (
                        <div className="flex gap-3">
                            <div className="relative flex-grow">
                                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search contractors..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                />
                            </div>
                            {availableCategories.length > 1 && (
                                <select
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                    className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white min-w-[140px]"
                                >
                                    <option value="all">All Categories</option>
                                    {availableCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                    
                    {/* Contractors List */}
                    {filteredContractors.length === 0 ? (
                        <EmptyState
                            icon={Wrench}
                            title={contractors.length === 0 ? "No Contractors Yet" : "No matches found"}
                            description={
                                contractors.length === 0 
                                    ? "When you scan receipts or add items with contractor names, they'll appear here automatically."
                                    : "Try adjusting your search or filter."
                            }
                        />
                    ) : (
                        <div className="space-y-4">
                            {filteredContractors.map((pro, idx) => (
                                <ProCard
                                    key={idx}
                                    pro={pro}
                                    onRequestService={handleRequestService}
                                    onCall={handleCall}
                                    onEmail={handleEmail}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* Requests Tab */}
            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {pendingRequests.length === 0 ? (
                        <EmptyState
                            icon={Send}
                            title="No Active Request Links"
                            description="Create a request link to send to your contractor. When they submit work details, they'll appear here."
                            actions={
                                <button
                                    onClick={() => onOpenQuickRequest && onOpenQuickRequest(null)}
                                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                                >
                                    <LinkIcon size={18} />
                                    Create Request Link
                                </button>
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            {pendingRequests.map(req => (
                                <RequestCard
                                    key={req.id}
                                    request={req}
                                    onDelete={handleDeleteRequest}
                                    onImport={onRequestImport}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {/* Pro Tip */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm border border-blue-100">
                        <Star className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 text-sm">Pro Tip</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                            After service, create a request link and ask your contractor to submit the details. 
                            You'll get accurate records without manual data entry!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
