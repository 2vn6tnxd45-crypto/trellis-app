// src/features/requests/RequestManager.jsx
import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Trash2, ArrowDownToLine } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';

export const RequestManager = ({ userId, propertyName, onRequestImport }) => {
    const [requests, setRequests] = useState([]);
    const [newRequestDesc, setNewRequestDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

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
            await addDoc(collection(db, REQUESTS_COLLECTION_PATH), {
                createdBy: userId,
                propertyName: propertyName || "My Home",
                description: newRequestDesc,
                status: 'pending',
                createdAt: serverTimestamp(),
                contractor: '', category: '', item: '', cost: '', notes: ''
            });
            setNewRequestDesc('');
        } catch (error) {
            console.error("Error creating request:", error);
            alert("Failed to create request.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this request link?")) return;
        try { await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, id)); } catch (e) { console.error(e); }
    };

    const copyLink = (id) => {
        const link = `${window.location.origin}/?requestId=${id}`;
        navigator.clipboard.writeText(link).then(() => alert("Link copied!"));
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-100">
                <h2 className="text-2xl font-bold text-sky-900 mb-6 flex items-center">
                    <div className="bg-sky-100 p-2 rounded-lg mr-3"><LinkIcon className="h-6 w-6 text-sky-700" /></div> Contractor Requests
                </h2>
                <p className="text-slate-500 mb-6">Generate a secure link to send to your contractor.</p>
                <form onSubmit={handleCreateRequest} className="flex gap-4 flex-col sm:flex-row">
                    <input type="text" value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} placeholder="Project Description" className="flex-grow p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500 outline-none"/>
                    <button type="submit" disabled={isCreating || !newRequestDesc} className="bg-sky-900 text-white px-6 py-4 sm:py-0 rounded-xl font-bold hover:bg-sky-800 disabled:opacity-50 whitespace-nowrap">{isCreating ? 'Creating...' : 'Create Link'}</button>
                </form>
            </div>
            <div className="grid gap-4">
                {requests.map(req => (
                    <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex-grow w-full md:w-auto">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-slate-800 text-lg">{req.description}</h3>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${req.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{req.status}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">ID: {req.id}</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            {/* NEW: Import Button */}
                            {req.status === 'submitted' && (
                                <button 
                                    onClick={() => onRequestImport(req)} 
                                    className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-green-50 text-green-700 rounded-lg font-bold text-sm hover:bg-green-100 transition-colors border border-green-200"
                                >
                                    <ArrowDownToLine className="h-4 w-4 mr-2" /> Review & Import
                                </button>
                            )}

                            <button onClick={() => copyLink(req.id)} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-sky-50 text-sky-700 rounded-lg font-bold text-sm hover:bg-sky-100 transition-colors">
                                <LinkIcon className="h-4 w-4 mr-2" /> Copy Link
                            </button>
                            <button onClick={() => handleDelete(req.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-5 w-5" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
