// src/features/requests/RequestManager.jsx
import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Trash2, ArrowDownToLine, MapPin, Link2, Send } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import { EmptyState } from '../../components/common/EmptyState';

export const RequestManager = ({ userId, propertyName, propertyAddress, records, onRequestImport }) => {
    const [requests, setRequests] = useState([]);
    const [newRequestDesc, setNewRequestDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [shareAddress, setShareAddress] = useState(false);
    const [linkedRecordId, setLinkedRecordId] = useState('');

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, REQUESTS_COLLECTION_PATH), where("createdBy", "==", userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [userId]);

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        if (!newRequestDesc.trim()) return;
        setIsCreating(true);
        try {
            const linkedRecord = records?.find(r => r.id === linkedRecordId);
            await addDoc(collection(db, REQUESTS_COLLECTION_PATH), {
                createdBy: userId,
                propertyName: propertyName || "My Home",
                description: newRequestDesc,
                propertyAddress: shareAddress ? propertyAddress : null,
                linkedContext: linkedRecord ? { item: linkedRecord.item, brand: linkedRecord.brand, model: linkedRecord.model, year: linkedRecord.dateInstalled ? new Date(linkedRecord.dateInstalled).getFullYear() : 'Unknown' } : null,
                status: 'pending',
                createdAt: serverTimestamp(),
                contractor: '', category: '', item: '', cost: '', notes: ''
            });
            setNewRequestDesc(''); setShareAddress(false); setLinkedRecordId('');
        } catch (error) { alert("Failed to create request."); } finally { setIsCreating(false); }
    };

    const handleDelete = async (id) => { if (confirm("Delete link?")) try { await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, id)); } catch (e) {} };
    const copyLink = (id) => { navigator.clipboard.writeText(`${window.location.origin}/?requestId=${id}`).then(() => alert("Link copied!")); };

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-emerald-100">
                <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                    <div className="bg-emerald-100 p-2 rounded-lg mr-3"><LinkIcon className="h-6 w-6 text-emerald-700" /></div> Contractor Requests
                </h2>
                <p className="text-slate-500 mb-6">Generate a secure link to send to your contractor.</p>
                <form onSubmit={handleCreateRequest} className="space-y-4">
                    <input type="text" value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} placeholder="Project Description (e.g. Replace HVAC)" className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"/>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center">
                             <input type="checkbox" id="shareAddr" checked={shareAddress} onChange={(e) => setShareAddress(e.target.checked)} className="mr-3 h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500"/>
                             <label htmlFor="shareAddr" className="text-sm font-bold text-slate-700 cursor-pointer flex items-center"><MapPin size={16} className="mr-2 text-slate-400"/> Share Property Address</label>
                        </div>
                        <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center">
                             <Link2 size={16} className="ml-2 mr-2 text-slate-400"/>
                             <select value={linkedRecordId} onChange={(e) => setLinkedRecordId(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 w-full outline-none"><option value="">No Linked Item</option>{records && records.map(r => (<option key={r.id} value={r.id}>{r.item} ({r.brand || 'Generic'})</option>))}</select>
                        </div>
                    </div>
                    <button type="submit" disabled={isCreating || !newRequestDesc} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-600/20 transition active:scale-[0.98]">{isCreating ? 'Creating...' : 'Create Secure Link'}</button>
                </form>
            </div>

            {requests.length === 0 ? (
                <EmptyState 
                    icon={Send}
                    title="No Active Requests"
                    description="Create a request link above to send to your contractor. When they submit details, they'll appear here."
                />
            ) : (
                <div className="grid gap-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex-grow w-full md:w-auto">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-bold text-slate-800 text-lg">{req.description}</h3>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${req.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{req.status}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-slate-400 font-medium mt-1">
                                    {req.propertyAddress && <span className="flex items-center"><MapPin size={12} className="mr-1"/> Address Shared</span>}
                                    {req.linkedContext && <span className="flex items-center"><Link2 size={12} className="mr-1"/> Specs Shared</span>}
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                {req.status === 'submitted' && (
                                    <button onClick={() => onRequestImport(req)} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-colors border border-emerald-200">
                                        <ArrowDownToLine className="h-4 w-4 mr-2" /> Review & Import
                                    </button>
                                )}
                                <button onClick={() => copyLink(req.id)} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-colors">
                                    <LinkIcon className="h-4 w-4 mr-2" /> Copy Link
                                </button>
                                <button onClick={() => handleDelete(req.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
