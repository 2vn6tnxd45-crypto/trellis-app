// src/features/requests/ContractorView.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CheckCircle, AlertTriangle, UploadCloud, Send, Briefcase, Calendar, User, Mail, Wrench, Tag, Box, Loader2 } from 'lucide-react';
import { db, auth, storage } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { compressImage } from '../../lib/images';
import { calculateNextDate } from '../../lib/utils';
import { Logo } from '../../components/common/Logo';

export const ContractorView = () => {
    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({ category: '', item: '', brand: '', model: '', notes: '', contractor: '', email: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0] });
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        const init = async () => {
            const savedContractor = JSON.parse(localStorage.getItem('krib_contractor') || '{}');
            if (savedContractor.name) {
                setFormData(prev => ({ ...prev, contractor: savedContractor.name, email: savedContractor.email || '' }));
            }
            const params = new URLSearchParams(window.location.search);
            const requestId = params.get('requestId');
            if (!requestId) { setError("Invalid request link."); setLoading(false); return; }
            try {
                if (!auth.currentUser) await signInAnonymously(auth);
                const docSnap = await getDoc(doc(db, REQUESTS_COLLECTION_PATH, requestId));
                if (docSnap.exists() && docSnap.data().status === 'pending') {
                    setRequestData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError("Request expired or not found.");
                }
            } catch (e) { setError("Connection failed."); } finally { setLoading(false); }
        };
        init();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Save contractor details for next time
            localStorage.setItem('krib_contractor', JSON.stringify({ name: formData.contractor, email: formData.email }));

            let imageUrl = null;
            let attachments = [];

            if (selectedFile) {
                const compressed = await compressImage(selectedFile);
                const response = await fetch(compressed);
                const blob = await response.blob();
                const fileRef = ref(storage, `uploads/contractors/${Date.now()}_${selectedFile.name}`);
                await uploadBytes(fileRef, blob);
                imageUrl = await getDownloadURL(fileRef);
                attachments.push({ name: 'Work Photo', url: imageUrl, type: 'Photo' });
            }

            // Update the request status
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, requestData.id), {
                ...formData,
                status: 'submitted',
                imageUrl,
                attachments,
                submittedAt: serverTimestamp()
            });

            setSubmitted(true);
        } catch (err) {
            console.error(err);
            alert("Error submitting form. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-emerald-50"><Loader2 className="animate-spin text-emerald-600 h-8 w-8"/></div>;
    
    if (error || submitted) {
        return (
            <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-emerald-100 max-w-md w-full text-center">
                    <div className="inline-flex p-4 rounded-full bg-emerald-50 mb-6">
                        {error ? <AlertTriangle className="h-8 w-8 text-red-500"/> : <CheckCircle className="h-8 w-8 text-emerald-500"/>}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">{error ? "Link Expired" : "Submission Received"}</h2>
                    <p className="text-slate-500 mb-6">{error || "Thank you for updating the homeowner's records. You can close this window now."}</p>
                    {error && <a href="/" className="text-emerald-600 font-bold hover:underline">Go to Krib Home</a>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-emerald-50 py-12 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <Logo className="h-12 w-12 mx-auto mb-4"/>
                    <h1 className="text-3xl font-extrabold text-emerald-950">Contractor Submission</h1>
                    <p className="text-slate-500 mt-2">Update details for: <span className="font-bold text-emerald-700">{requestData.description}</span></p>
                    {requestData.propertyAddress && (
                        <div className="mt-4 inline-block bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 shadow-sm">
                            {requestData.propertyAddress.street}, {requestData.propertyAddress.city}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-xl border border-emerald-100 overflow-hidden">
                    <div className="p-8 space-y-6">
                        {/* Contractor Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Company / Name</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-300"/>
                                    <input required type="text" value={formData.contractor} onChange={e=>setFormData({...formData, contractor: e.target.value})} className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email (Optional)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-300"/>
                                    <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"/>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 my-2"></div>

                        {/* Work Details */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-slate-800 flex items-center"><Wrench className="h-4 w-4 mr-2 text-emerald-600"/> Work Details</h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                                    <select required value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                                        <option value="">Select Category</option>
                                        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Item Installed</label>
                                    <div className="relative">
                                        <Box className="absolute left-3 top-3 h-4 w-4 text-slate-300"/>
                                        <input required placeholder="e.g. New Water Heater" type="text" value={formData.item} onChange={e=>setFormData({...formData, item: e.target.value})} className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"/>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Brand</label><input type="text" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"/></div>
                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Model</label><input type="text" value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"/></div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-300"/>
                                        <input type="date" value={formData.dateInstalled} onChange={e=>setFormData({...formData, dateInstalled: e.target.value})} className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"/>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Recommended Maintenance</label>
                                <select value={formData.maintenanceFrequency} onChange={e=>setFormData({...formData, maintenanceFrequency: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                                    {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes / Warranty Info</label>
                                <textarea rows="3" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Any details for the homeowner..."></textarea>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Attach Photo (Optional)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                                    <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer"/>
                                    {selectedFile ? (
                                        <div className="flex items-center justify-center text-emerald-600 font-bold">
                                            <CheckCircle className="h-5 w-5 mr-2"/> {selectedFile.name}
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 flex flex-col items-center">
                                            <UploadCloud className="h-8 w-8 mb-2"/>
                                            <span className="text-sm font-medium">Tap to upload receipt or label</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 px-8 py-6 border-t border-slate-100">
                        <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center disabled:opacity-50">
                            {submitting ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <Send className="h-5 w-5 mr-2"/>}
                            {submitting ? 'Sending...' : 'Submit to Homeowner'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
