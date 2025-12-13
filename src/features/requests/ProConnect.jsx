// src/features/requests/ProConnect.jsx
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

// Active Request Card (Simplified for brevity)
const RequestCard = ({ request, onCopyLink, onDelete, onImport }) => {
    const handleCopy = () => {
        const url = `${window.location.origin}${window.location.pathname}?requestId=${request.id}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied!');
    };
    return (
        <div className={`p-4 rounded-xl border ${request.status === 'submitted' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h4 className="font-bold text-slate-800">{request.description}</h4>
                    <span className="text-xs text-slate-500 uppercase font-bold">{request.status}</span>
                </div>
                <div className="flex gap-2">
                    {request.status === 'submitted' && <button onClick={() => onImport(request)} className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg">Import</button>}
                    <button onClick={handleCopy} className="p-2 bg-slate-100 rounded-lg text-slate-500"><Copy size={16}/></button>
                    <button onClick={() => onDelete(request.id)} className="p-2 bg-red-50 rounded-lg text-red-500"><Trash2 size={16}/></button>
                </div>
            </div>
        </div>
    );
};

export const ProConnect = ({ userId, propertyName, propertyAddress, records, onRequestImport, onOpenQuickRequest }) => {
    const [requests, setRequests] = useState([]);
    const [activeTab, setActiveTab] = useState('pros');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    
    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [userId]);
    
    const contractors = useMemo(() => {
        const prosMap = {};
        records.forEach(r => {
            const name = r.contractor;
            if (name && name.length > 2) {
                if (!prosMap[name]) prosMap[name] = { name, phone: null, email: null, address: null, jobs: [] };
                // Aggregate contact info (last one wins or first non-null)
                if (r.contractorPhone) prosMap[name].phone = r.contractorPhone;
                if (r.contractorEmail) prosMap[name].email = r.contractorEmail;
                if (r.contractorAddress) prosMap[name].address = r.contractorAddress; // Capture Address
                prosMap[name].jobs.push(r);
            }
        });
        return Object.values(prosMap).sort((a, b) => b.jobs.length - a.jobs.length);
    }, [records]);
    
    const filteredContractors = useMemo(() => {
        return contractors.filter(pro => {
            const matchesSearch = pro.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'all' || pro.jobs.some(j => j.category === filterCategory);
            return matchesSearch && matchesCategory;
        });
    }, [contractors, searchTerm, filterCategory]);
    
    const pendingRequests = requests.filter(r => r.status === 'pending');
    
    const handleDeleteRequest = async (id) => {
        if (!confirm('Delete this request?')) return;
        await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, id));
    };
    
    return (
        <div className="space-y-6">
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
                        filteredContractors.map((pro, idx) => <ProCard key={idx} pro={pro} onRequestService={(p) => onOpenQuickRequest({item: 'Service', contractor: p.name})} onCall={(p) => window.open(`tel:${p}`)} onEmail={(e) => window.open(`mailto:${e}`)}/>)
                    }
                </div>
            )}
            
            {activeTab === 'requests' && (
                <div className="space-y-3">
                    {pendingRequests.length === 0 ? <EmptyState icon={Send} title="No Requests" description="Create a link to send to a contractor."/> : pendingRequests.map(req => <RequestCard key={req.id} request={req} onDelete={handleDeleteRequest} onImport={onRequestImport}/>)}
                </div>
            )}
        </div>
    );
};
