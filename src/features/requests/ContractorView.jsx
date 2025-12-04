// src/features/requests/ContractorView.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { CheckCircle, AlertTriangle, User, Tag, Box, Calendar, Clock, ChevronDown, UploadCloud, Send } from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { fileToBase64, compressImage } from '../../lib/images';
import { calculateNextDate } from '../../lib/utils';
import { Logo } from '../../components/common/Logo';

export const ContractorView = () => {
    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({ category: '', item: '', brand: '', model: '', notes: '', contractor: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0] });
    const [selectedFile, setSelectedFile] = useState(null);
    
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestId = params.get('requestId');
        if (!requestId) { setError("Invalid request link."); setLoading(false); return; }
        
        const fetchRequest = async () => {
            try {
                if (!auth.currentUser) await signInAnonymously(auth);
                const docSnap = await getDoc(doc(db, REQUESTS_COLLECTION_PATH, requestId));
                if (docSnap.exists() && docSnap.data().status === 'pending') {
                    setRequestData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError("This request has expired or does not exist.");
                }
            } catch (e) { setError("Could not load request."); } finally { setLoading(false); }
        };
        fetchRequest();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let imageUrl = '';
            if (selectedFile) imageUrl = await compressImage(selectedFile);
            
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, requestData.id), {
                ...formData,
                imageUrl,
                nextServiceDate: calculateNextDate(formData.dateInstalled, formData.maintenanceFrequency),
                status: 'submitted',
                submittedAt: serverTimestamp()
            });
            setSubmitted(true);
        } catch (e) { setError("Submission failed."); } finally { setLoading(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-sky-50 text-sky-600">Loading...</div>;
    if (submitted) return <div className="min-h-screen flex items-center justify-center bg-green-50"><div className="text-center"><CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4"/><h1 className="text-3xl font-bold text-green-800">Submission Received</h1></div></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600"><AlertTriangle className="mr-2"/> {error}</div>;

    return (
        <div className="min-h-screen bg-sky-50 py-12 px-4 flex justify-center font-sans">
            <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-xl overflow-hidden">
                <div className="bg-sky-900 p-8 text-center">
                    <div className="bg-white p-3 rounded-2xl shadow-lg inline-block mb-4"><Logo className="h-12 w-12"/></div>
                    <h1 className="text-2xl font-bold text-white">Contractor Submission</h1>
                    <p className="text-sky-200 mt-2 uppercase tracking-widest text-xs">Project: {requestData?.description}</p>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="relative"><User className="absolute left-4 top-3.5 text-gray-400 h-5 w-5"/><input type="text" placeholder="Your Name / Company" className="w-full pl-12 p-3.5 bg-gray-50 rounded-xl border border-gray-200" required value={formData.contractor} onChange={e=>setFormData({...formData, contractor: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative"><Tag className="absolute left-4 top-3.5 text-gray-400 h-5 w-5"/><select className="w-full pl-12 p-3.5 bg-gray-50 rounded-xl border border-gray-200 appearance-none" required value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})}><option value="" disabled>Category</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                            <div className="relative"><Box className="absolute left-4 top-3.5 text-gray-400 h-5 w-5"/><input type="text" placeholder="Item Name" className="w-full pl-12 p-3.5 bg-gray-50 rounded-xl border border-gray-200" required value={formData.item} onChange={e=>setFormData({...formData, item: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="text" placeholder="Brand" className="p-3.5 bg-white border border-gray-200 rounded-xl" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} />
                            <input type="text" placeholder="Model #" className="p-3.5 bg-white border border-gray-200 rounded-xl" value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="relative"><Calendar className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/><input type="date" className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl" value={formData.dateInstalled} onChange={e=>setFormData({...formData, dateInstalled: e.target.value})} required/></div>
                             <div className="relative"><Clock className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/><select className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl appearance-none" value={formData.maintenanceFrequency} onChange={e=>setFormData({...formData, maintenanceFrequency: e.target.value})}>{MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select><ChevronDown className="absolute right-3 top-4 text-gray-400 h-4 w-4 pointer-events-none"/></div>
                        </div>
                        <textarea placeholder="Notes..." className="w-full p-4 border border-gray-200 rounded-xl h-24" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}></textarea>
                        <div className="border-2 border-dashed border-sky-200 rounded-2xl p-6 text-center bg-gray-50 relative">
                             <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={e=>setSelectedFile(e.target.files[0])} />
                             <UploadCloud className="h-8 w-8 text-sky-400 mx-auto mb-2"/>
                             <span className="text-sm text-gray-500">{selectedFile ? selectedFile.name : "Upload Photo"}</span>
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-sky-900 text-white font-bold py-4 rounded-xl flex items-center justify-center">Submit Record <Send className="ml-2 h-4 w-4"/></button>
                </form>
            </div>
        </div>
    );
};
