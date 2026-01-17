// src/features/requests/ContractorPortal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, ROOMS } from '../../config/constants';
import {
    Home, Camera, Upload, Send, CheckCircle, AlertCircle, Loader2,
    FileText, X, DollarSign, Receipt, Wrench, Package, MapPin,
    Mic, Image as ImageIcon, ExternalLink, ChevronDown, ChevronUp, ChevronLeft
} from 'lucide-react';
import { Select } from '../../components/ui/Select';
import toast, { Toaster } from 'react-hot-toast';
import { compressImage } from '../../lib/images';
import { Logo } from '../../components/common/Logo';
import { FullPageLoader, ButtonLoader } from '../../components/common';
import { JobScheduler } from '../jobs/JobScheduler';

// --- SUB-COMPONENTS ---

const Section = ({ title, icon: Icon, children, defaultOpen = true, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg">
                        <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                    <span className="font-bold text-slate-800">{title}</span>
                    {badge && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {badge}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {isOpen && <div className="px-5 pb-5 pt-0 border-t border-slate-50">{children}</div>}
        </div>
    );
};

const ContextCard = ({ context }) => {
    if (!context) return null;
    return (
        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 mb-6 flex items-start gap-4">
            <div className="bg-white p-2 rounded-xl shadow-sm border border-blue-100 text-blue-600 shrink-0">
                <Wrench size={20} />
            </div>
            <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Service Request For</p>
                <h3 className="font-bold text-slate-800 text-lg">{context.item || 'General Service'}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-sm text-slate-500">
                    {context.brand && <span>{context.brand}</span>}
                    {context.model && <span>• {context.model}</span>}
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const ContractorPortal = () => {
    const [requestId] = useState(() => new URLSearchParams(window.location.search).get('requestId'));
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    // View State: 'scheduler' or 'worklog'
    const [viewMode, setViewMode] = useState('scheduler');

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        category: '',
        area: 'General',
        brand: '',
        model: '',
        serialNumber: '',
        notes: '',
        datePerformed: new Date().toISOString().split('T')[0],
        totalCost: '',
        laborCost: '',
        partsCost: '',
        contractorName: '',
        contractorCompany: '',
        contractorPhone: '',
        contractorEmail: '',
        nextServiceDate: ''
    });

    const [attachments, setAttachments] = useState([]);
    const [invoiceFile, setInvoiceFile] = useState(null);
    const fileInputRef = useRef(null);
    const invoiceInputRef = useRef(null);

    // Load Request & Auto-Fill
    useEffect(() => {
        const loadRequest = async () => {
            if (!requestId) { setError('No request ID provided.'); setLoading(false); return; }

            try {
                const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) { setError('Link expired or invalid.'); setLoading(false); return; }

                const data = docSnap.data();
                if (data.status === 'submitted') setSubmitted(true);
                setRequest({ id: docSnap.id, ...data });

                // Determine initial view mode
                // If submitted or specifically marked as "in progress" (skipped scheduler), go to work log
                if (data.status === 'submitted' || data.status === 'in_progress') {
                    setViewMode('worklog');
                } else {
                    setViewMode('scheduler');
                }

                // INTELLIGENT PRE-FILL
                setFormData(prev => ({
                    ...prev,
                    category: data.category || (data.linkedContext?.category || prev.category),
                    area: data.area || (data.linkedContext?.area || prev.area),
                    // If the homeowner provided brand/model in the context, pre-fill it for the contractor
                    brand: data.linkedContext?.brand || prev.brand,
                    model: data.linkedContext?.model || prev.model,
                    // If description exists, keep it, otherwise prompt
                    description: data.description || prev.description
                }));

            } catch (err) {
                console.error(err);
                setError('Unable to load request.');
            } finally {
                setLoading(false);
            }
        };
        loadRequest();
    }, [requestId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileAdd = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.size > 15 * 1024 * 1024) { toast.error(`${file.name} is too large`); continue; }
            setAttachments(prev => [...prev, {
                file,
                name: file.name,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                type: file.type.includes('pdf') ? 'pdf' : 'image'
            }]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleInvoiceAdd = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setInvoiceFile({
            file,
            name: file.name,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            type: file.type.includes('pdf') ? 'pdf' : 'image'
        });
        if (invoiceInputRef.current) invoiceInputRef.current.value = '';
    };

    const removeAttachment = (index) => setAttachments(prev => prev.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.description.trim()) { toast.error('Please describe the work performed'); return; }

        setSubmitting(true);
        const loadingToast = toast.loading('Submitting...');

        try {
            // Upload Files
            const uploadedAttachments = [];
            for (const att of attachments) {
                try {
                    let fileToUpload = att.file;
                    if (att.type === 'image') {
                        const compressed = await compressImage(att.file);
                        const response = await fetch(compressed);
                        fileToUpload = await response.blob();
                    }
                    const storageRef = ref(storage, `requests/${requestId}/attachments/${Date.now()}_${att.name}`);
                    await uploadBytes(storageRef, fileToUpload);
                    const url = await getDownloadURL(storageRef);
                    uploadedAttachments.push({
                        name: att.name,
                        type: att.type === 'pdf' ? 'Document' : 'Photo',
                        url,
                        dateAdded: new Date().toISOString()
                    });
                } catch (e) { console.error(e); }
            }

            // Upload Invoice
            let invoiceUrl = null;
            if (invoiceFile) {
                try {
                    let fileToUpload = invoiceFile.file;
                    if (invoiceFile.type === 'image') {
                        const compressed = await compressImage(invoiceFile.file);
                        const response = await fetch(compressed);
                        fileToUpload = await response.blob();
                    }
                    const storageRef = ref(storage, `requests/${requestId}/invoice/${Date.now()}_${invoiceFile.name}`);
                    await uploadBytes(storageRef, fileToUpload);
                    invoiceUrl = await getDownloadURL(storageRef);
                } catch (e) { console.error(e); }
            }

            // Update Firestore
            const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
            await updateDoc(docRef, {
                status: 'submitted',
                submittedAt: serverTimestamp(),
                ...formData,
                cost: formData.totalCost ? parseFloat(formData.totalCost) : null,
                totalCost: formData.totalCost ? parseFloat(formData.totalCost) : null,
                laborCost: formData.laborCost ? parseFloat(formData.laborCost) : null,
                partsCost: formData.partsCost ? parseFloat(formData.partsCost) : null,
                contractor: formData.contractorName || formData.contractorCompany,
                attachments: uploadedAttachments,
                invoiceUrl: invoiceUrl,
                imageUrl: uploadedAttachments.find(a => a.type === 'Photo')?.url || ''
            });

            toast.dismiss(loadingToast);
            setSubmitted(true);

        } catch (err) {
            console.error(err);
            toast.dismiss(loadingToast);
            toast.error('Submission failed. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <FullPageLoader />;

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-800">Link Unavailable</h2>
                <p className="text-slate-500 mt-2">{error}</p>
            </div>
        </div>
    );

    if (submitted) return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[2rem] shadow-xl text-center max-w-md w-full border border-emerald-100">
                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} className="text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-emerald-950 mb-2">Details Submitted!</h1>
                <p className="text-slate-500 mb-8">
                    Thanks for helping {request?.propertyName || 'the homeowner'} keep their home records up to date.
                </p>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-slate-800 mb-2">Are you a Pro?</p>
                    <p className="text-xs text-slate-500 mb-4">
                        Join Krib for Pros to get direct leads and build your digital portfolio.
                    </p>
                    <button className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-sm">
                        Create Free Pro Profile
                    </button>
                </div>
            </div>
        </div>
    );

    // SCHEDULER VIEW
    if (viewMode === 'scheduler' && !submitted) {
        return (
            <div className="min-h-screen bg-slate-50 pb-32">
                <Toaster position="top-center" />

                {/* Header */}
                <div className="bg-white border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8 w-8" />
                        <div>
                            <span className="font-bold text-slate-800 text-lg tracking-tight">krib</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 ml-1">Connect</span>
                        </div>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">New Service Request</h1>
                        <p className="text-slate-500">From {request?.propertyName || 'Homeowner'}</p>
                    </div>

                    {request?.linkedContext && <ContextCard context={request.linkedContext} />}

                    {/* Job Scheduler */}
                    <JobScheduler
                        job={request}
                        userType="contractor"
                        onUpdate={() => {
                            // Optionally refresh request data here if needed, 
                            // or rely on snapshot listeners if implemented later.
                        }}
                    />

                    {/* Skip Button */}
                    <div className="border-t border-slate-200 pt-6">
                        <h3 className="font-bold text-slate-800 mb-2">Ready to log work?</h3>
                        <p className="text-sm text-slate-500 mb-4">If the job is already done, or you don't need to schedule it here.</p>
                        <button
                            onClick={() => setViewMode('worklog')}
                            className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <FileText size={18} />
                            Skip to Work Log
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // WORK LOG VIEW (Original Form)
    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <Logo className="h-8 w-8" />
                    <div>
                        <span className="font-bold text-slate-800 text-lg tracking-tight">krib</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 ml-1">Work Log</span>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 md:p-6">

                {/* Back Button */}
                <button onClick={() => setViewMode('scheduler')} className="mb-6 text-sm text-slate-500 hover:text-emerald-600 flex items-center gap-1 transition-colors font-medium">
                    <ChevronLeft size={16} /> Back to Request Details
                </button>

                {/* Intro */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">Submit Job Details</h1>
                    <p className="text-slate-500">For {request?.propertyName || 'Homeowner'}</p>
                </div>

                {request?.linkedContext && <ContextCard context={request.linkedContext} />}

                <form onSubmit={handleSubmit}>

                    {/* 1. WORK DETAILS */}
                    <Section title="Work Performed" icon={Wrench} badge="Required">
                        <div className="space-y-4 pt-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex justify-between">
                                    Description of Work *
                                    <span className="text-xs font-normal text-emerald-600 flex items-center">
                                        <Mic size={12} className="mr-1" /> Dictation recommended
                                    </span>
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={4}
                                    placeholder="Tap microphone on your keyboard to speak details..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none text-base"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Category</label>
                                    <Select
                                        value={formData.category}
                                        onChange={(val) => handleInputChange({ target: { name: 'category', value: val } })}
                                        options={[
                                            { value: '', label: 'Select...' },
                                            ...CATEGORIES.map(c => ({ value: c, label: c }))
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Date</label>
                                    <input type="date" name="datePerformed" value={formData.datePerformed} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* 2. PHOTOS (Improved UX) */}
                    <Section title="Photos" icon={Camera}>
                        <div className="pt-4">
                            {attachments.length > 0 && (
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {attachments.map((att, i) => (
                                        <div key={i} className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                                            {att.preview ? (
                                                <img src={att.preview} className="w-full h-full object-cover" alt="upload" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400"><FileText /></div>
                                            )}
                                            <button type="button" onClick={() => removeAttachment(i)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-xl text-emerald-700 font-bold hover:bg-emerald-100 transition-colors flex flex-col items-center justify-center gap-2"
                            >
                                <div className="bg-white p-2 rounded-full shadow-sm"><ImageIcon className="h-6 w-6 text-emerald-600" /></div>
                                <span>Tap to Add Photos</span>
                            </button>
                            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileAdd} />
                        </div>
                    </Section>

                    {/* 3. EQUIPMENT SPECS (Auto-filled if possible) */}
                    <Section title="Equipment Specs" icon={Package} defaultOpen={!!formData.brand}>
                        <div className="space-y-4 pt-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                                <Package size={14} className="shrink-0 mt-0.5" />
                                Please verify Brand/Model numbers if replacing units.
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Brand</label>
                                    <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} placeholder="e.g. Carrier" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Model #</label>
                                    <input type="text" name="model" value={formData.model} onChange={handleInputChange} placeholder="Model Number" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Serial #</label>
                                <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} placeholder="Serial Number" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                        </div>
                    </Section>

                    {/* 4. COST & INVOICE */}
                    <Section title="Cost & Invoice" icon={DollarSign}>
                        <div className="space-y-4 pt-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Total Cost ($)</label>
                                <input type="number" name="totalCost" value={formData.totalCost} onChange={handleInputChange} placeholder="0.00" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-lg" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Upload Invoice (PDF/Photo)</label>
                                {invoiceFile ? (
                                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <FileText className="text-emerald-600" />
                                        <span className="text-sm font-medium text-emerald-900 flex-grow truncate">{invoiceFile.name}</span>
                                        <button type="button" onClick={() => setInvoiceFile(null)}><X size={18} className="text-slate-400" /></button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => invoiceInputRef.current?.click()} className="w-full py-3 border border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 flex items-center justify-center gap-2">
                                        <Upload size={18} /> Attach Invoice
                                    </button>
                                )}
                                <input ref={invoiceInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleInvoiceAdd} />
                            </div>
                        </div>
                    </Section>

                    {/* 5. CONTRACTOR INFO */}
                    <Section title="Your Info" icon={Wrench}>
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Name</label><input type="text" name="contractorName" value={formData.contractorName} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                                <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Company</label><input type="text" name="contractorCompany" value={formData.contractorCompany} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                            </div>
                            <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Phone (Optional)</label><input type="tel" name="contractorPhone" value={formData.contractorPhone} onChange={handleInputChange} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                        </div>
                    </Section>

                    {/* SUBMIT */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-lg z-50 md:relative md:border-none md:shadow-none md:bg-transparent md:p-0 md:mt-8">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full max-w-2xl mx-auto py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                        >
                            {submitting ? <ButtonLoader /> : <><Send size={18} /> Submit Work Log</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
