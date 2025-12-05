// src/features/requests/ContractorView.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { CheckCircle, AlertTriangle, User, Tag, Box, Calendar, Clock, ChevronDown, UploadCloud, Send, Briefcase, History, BadgeCheck, Mail, Save } from 'lucide-react';
import { db, auth } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { compressImage } from '../../lib/images';
import { calculateNextDate } from '../../lib/utils';
import { Logo } from '../../components/common/Logo';

export const ContractorView = () => {
    // State
    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('form'); // 'form' or 'history'
    const [history, setHistory] = useState([]);
    
    // Form State
    const [formData, setFormData] = useState({ 
        category: '', item: '', brand: '', model: '', notes: '', 
        contractor: '', email: '', // Added Email
        maintenanceFrequency: 'none', 
        dateInstalled: new Date().toISOString().split('T')[0] 
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [rememberMe, setRememberMe] = useState(true);

    // Load Request & Local Preferences
    useEffect(() => {
        const init = async () => {
            // 1. Load LocalStorage Defaults
            const savedContractor = JSON.parse(localStorage.getItem('hauskey_contractor') || '{}');
            if (savedContractor.name) {
                setFormData(prev => ({ 
                    ...prev, 
                    contractor: savedContractor.name,
                    email: savedContractor.email || '' 
                }));
            }

            // 2. Fetch Request
            const params = new URLSearchParams(window.location.search);
            const requestId = params.get('requestId');
            
            if (!requestId) { setError("Invalid request link."); setLoading(false); return; }

            try {
                if (!auth.currentUser) await signInAnonymously(auth);
                const docSnap = await getDoc(doc(db, REQUESTS_COLLECTION_PATH, requestId));
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.status === 'pending') {
                        setRequestData({ id: docSnap.id, ...data });
                    } else {
                        setError("This request has already been completed or expired.");
                    }
                } else {
                    setError("Request not found.");
                }
            } catch (e) { 
                console.error(e);
                setError("Connection failed. Please try again."); 
            } finally { 
                setLoading(false); 
            }
        };
        init();
    }, []);

    // Fetch History Logic
    const handleFetchHistory = async () => {
        if (!formData.email || !requestData?.createdBy) return;
        setLoading(true);
        try {
            // Find all requests by this homeowner (createdBy) matching this contractor's email
            const q = query(
                collection(db, REQUESTS_COLLECTION_PATH), 
                where("createdBy", "==", requestData.createdBy),
                where("contractorEmail", "==", formData.email),
                where("status", "in", ["submitted", "archived"])
            );
            const snaps = await getDocs(q);
            setHistory(snaps.docs.map(d => ({id: d.id, ...d.data()})));
            setViewMode('history');
        } catch (err) {
            console.error("History fetch failed", err);
            alert("Could not fetch history. Please ensure your email matches previous submissions.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // 1. Handle Image
            let imageUrl = '';
            if (selectedFile) imageUrl = await compressImage(selectedFile);
            
            // 2. Save Preferences if Checked
            if (rememberMe) {
                localStorage.setItem('hauskey_contractor', JSON.stringify({
                    name: formData.contractor,
                    email: formData.email
                }));
            }

            // 3. Submit to Firestore
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, requestData.id), {
                ...formData,
                contractorEmail: formData.email, // Save email for future linking
                imageUrl,
                nextServiceDate: calculateNextDate(formData.dateInstalled, formData.maintenanceFrequency),
                status: 'submitted',
                submittedAt: serverTimestamp()
            });
            setSubmitted(true);
        } catch (e) { 
            console.error(e);
            setError("Submission failed. Please try again."); 
        } finally { 
            setSubmitting(false); 
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-sky-50 text-sky-600"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div></div>;
    
    // SUCCESS STATE
    if (submitted) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-green-100 max-w-md w-full">
                <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6"/>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Sent Successfully!</h1>
                <p className="text-slate-500 mb-8">The homeowner has been notified. You can close this window.</p>
                <button onClick={() => window.close()} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Close Window</button>
            </div>
        </div>
    );

    if (error) return <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 font-bold p-4"><AlertTriangle className="mr-2"/> {error}</div>;

    // MAIN FORM
    return (
        <div className="min-h-screen bg-sky-50 py-8 px-4 flex justify-center font-sans">
            <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-sky-100">
                
                {/* Header */}
                <div className="bg-sky-900 p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="bg-white p-3 rounded-2xl shadow-lg inline-block mb-4"><Logo className="h-10 w-10"/></div>
                        <h1 className="text-2xl font-bold text-white">Contractor Portal</h1>
                        <p className="text-sky-200 mt-2 text-sm font-medium">Project: <span className="text-white font-bold">{requestData?.description}</span></p>
                    </div>
                    {/* Abstract Shapes */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-sky-500 opacity-10 rounded-full translate-x-1/3 translate-y-1/3"></div>
                </div>

                {/* Tabs / Toggle */}
                {formData.email && (
                    <div className="flex border-b border-slate-100">
                        <button onClick={() => setViewMode('form')} className={`flex-1 py-4 text-sm font-bold ${viewMode === 'form' ? 'text-sky-900 border-b-2 border-sky-900' : 'text-slate-400'}`}>Current Job</button>
                        <button onClick={handleFetchHistory} className={`flex-1 py-4 text-sm font-bold ${viewMode === 'history' ? 'text-sky-900 border-b-2 border-sky-900' : 'text-slate-400'}`}>My History</button>
                    </div>
                )}

                {viewMode === 'history' ? (
                    // HISTORY VIEW
                    <div className="p-8 min-h-[400px]">
                        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center"><History className="mr-2 text-sky-600"/> Submission History</h2>
                        {history.length === 0 ? (
                            <div className="text-center text-slate-400 py-10">No previous submissions found for this homeowner.</div>
                        ) : (
                            <div className="space-y-4">
                                {history.map(h => (
                                    <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-800">{h.item || h.description}</p>
                                            <p className="text-xs text-slate-500">{h.category} • {h.submittedAt?.toDate().toLocaleDateString()}</p>
                                        </div>
                                        {h.status === 'archived' ? (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center"><BadgeCheck size={14} className="mr-1"/> Accepted</span>
                                        ) : (
                                            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Pending</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                         <button onClick={() => setViewMode('form')} className="mt-8 w-full py-3 border border-slate-200 text-slate-600 font-bold rounded-xl">Back to Form</button>
                    </div>
                ) : (
                    // FORM VIEW
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        
                        {/* Contractor Identity Section */}
                        <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-sky-900 uppercase tracking-wider flex items-center">
                                    <Briefcase size={16} className="mr-2"/> Contractor Info
                                </h3>
                                {/* Verified Badge Logic (Mocked visual for now, purely client-side feeling) */}
                                {formData.contractor && (
                                    <span className="text-xs bg-white text-sky-600 px-2 py-1 rounded-md border border-sky-100 font-bold flex items-center">
                                        <BadgeCheck size={14} className="mr-1"/> Verified Pro
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <User className="absolute left-3.5 top-3.5 text-sky-400 h-5 w-5"/>
                                    <input type="text" placeholder="Your Name / Company" className="w-full pl-10 p-3 bg-white rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-500 outline-none" required value={formData.contractor} onChange={e=>setFormData({...formData, contractor: e.target.value})} />
                                </div>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-3.5 text-sky-400 h-5 w-5"/>
                                    <input type="email" placeholder="Your Email" className="w-full pl-10 p-3 bg-white rounded-xl border border-sky-200 focus:ring-2 focus:ring-sky-500 outline-none" required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} />
                                </div>
                            </div>
                            <label className="flex items-center text-xs text-sky-700 font-bold cursor-pointer">
                                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="mr-2 rounded text-sky-600 focus:ring-sky-500"/>
                                Save my details for future jobs
                            </label>
                        </div>

                        {/* Job Details */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative"><Tag className="absolute left-4 top-3.5 text-gray-400 h-5 w-5"/><select className="w-full pl-12 p-3.5 bg-gray-50 rounded-xl border border-gray-200 appearance-none focus:bg-white transition-colors" required value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})}><option value="" disabled>Category</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                                <div className="relative"><Box className="absolute left-4 top-3.5 text-gray-400 h-5 w-5"/><input type="text" placeholder="Item Name (e.g. HVAC)" className="w-full pl-12 p-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white transition-colors" required value={formData.item} onChange={e=>setFormData({...formData, item: e.target.value})} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Brand" className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} />
                                <input type="text" placeholder="Model #" className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white" value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                 <div className="relative"><Calendar className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/><input type="date" className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white" value={formData.dateInstalled} onChange={e=>setFormData({...formData, dateInstalled: e.target.value})} required/></div>
                                 <div className="relative"><Clock className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/><select className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:bg-white" value={formData.maintenanceFrequency} onChange={e=>setFormData({...formData, maintenanceFrequency: e.target.value})}>{MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select><ChevronDown className="absolute right-3 top-4 text-gray-400 h-4 w-4 pointer-events-none"/></div>
                            </div>
                            <textarea placeholder="Installation notes, warranty info, or recommended care..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl h-24 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none resize-none" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}></textarea>
                            
                            <div className="border-2 border-dashed border-sky-200 rounded-2xl p-6 text-center bg-sky-50/30 relative hover:bg-sky-50 transition-colors cursor-pointer group">
                                 <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={e=>setSelectedFile(e.target.files[0])} />
                                 <UploadCloud className="h-10 w-10 text-sky-400 mx-auto mb-2 group-hover:scale-110 transition-transform"/>
                                 <span className="text-sm font-bold text-sky-700 block">{selectedFile ? selectedFile.name : "Tap to Upload Photo"}</span>
                                 <span className="text-xs text-slate-400">Receipt, Work Order, or Finished Job</span>
                            </div>
                        </div>

                        <button type="submit" disabled={submitting} className="w-full bg-sky-900 hover:bg-sky-800 text-white font-bold py-4 rounded-xl flex items-center justify-center shadow-lg shadow-sky-900/20 transition-all active:scale-[0.98]">
                            {submitting ? 'Sending...' : <><Send className="ml-2 h-5 w-5"/> Submit Record</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
