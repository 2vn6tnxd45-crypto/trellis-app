// src/features/requests/ContractorPortal.jsx
// ============================================
// 🔧 CONTRACTOR PORTAL (Enhanced)
// ============================================
// This is the view contractors see when they open a request link.
// It's designed to:
// 1. Give context about what they're working on
// 2. Make submission easy and professional
// 3. Convert them into Krib Pro users

import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, ROOMS } from '../../config/constants';
import { 
    Home, Camera, Upload, Send, CheckCircle, AlertCircle, Loader2, 
    FileText, X, DollarSign, Receipt, Wrench, Package, MapPin,
    Calendar, Clock, Info, Star, Shield, ChevronDown, ChevronUp,
    Building2, Phone, Mail, User, Briefcase, Award, ExternalLink
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { compressImage } from '../../lib/images';
import { Logo } from '../../components/common/Logo';

// Section component for collapsible areas
const Section = ({ title, icon: Icon, children, defaultOpen = true, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button 
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
            {isOpen && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-50">
                    {children}
                </div>
            )}
        </div>
    );
};

// Equipment context card - shows what the contractor is working on
const EquipmentContext = ({ context }) => {
    if (!context) return null;
    
    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
            <div className="flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-blue-100">
                    <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-grow">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Equipment Details</p>
                    <h3 className="text-lg font-bold text-slate-800">{context.item}</h3>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        {context.brand && (
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Brand</p>
                                <p className="text-sm font-medium text-slate-700">{context.brand}</p>
                            </div>
                        )}
                        {context.model && (
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Model</p>
                                <p className="text-sm font-medium text-slate-700">{context.model}</p>
                            </div>
                        )}
                        {context.year && (
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Installed</p>
                                <p className="text-sm font-medium text-slate-700">{context.year}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Pro signup CTA
const ProSignupCTA = ({ contractorName }) => (
    <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-emerald-200" />
                <span className="text-emerald-100 font-bold text-xs uppercase tracking-wide">Krib Pro</span>
            </div>
            
            <h3 className="text-xl font-bold mb-2">
                {contractorName ? `Welcome, ${contractorName}!` : 'Join Krib Pro'}
            </h3>
            <p className="text-emerald-100 text-sm mb-4">
                Create a free profile to build your reputation, get direct rebooking requests, and stand out from competitors.
            </p>
            
            <ul className="space-y-2 mb-5">
                {[
                    "Free verified business profile",
                    "Automatic portfolio from completed jobs",
                    "Direct messaging with customers",
                    "Review collection & display"
                ].map((benefit, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-emerald-100">
                        <CheckCircle size={14} className="text-emerald-300" />
                        {benefit}
                    </li>
                ))}
            </ul>
            
            <button className="w-full py-3 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
                <Star size={16} />
                Create Free Pro Profile
            </button>
        </div>
    </div>
);

export const ContractorPortal = () => {
    const [requestId] = useState(() => new URLSearchParams(window.location.search).get('requestId'));
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    
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
        warrantyInfo: '',
        nextServiceDate: ''
    });
    
    const [attachments, setAttachments] = useState([]);
    const [invoiceFile, setInvoiceFile] = useState(null);
    const fileInputRef = useRef(null);
    const invoiceInputRef = useRef(null);

    useEffect(() => {
        const loadRequest = async () => {
            if (!requestId) { 
                setError('No request ID provided. Please use the link from your customer.'); 
                setLoading(false); 
                return; 
            }
            
            try {
                const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) { 
                    setError('This link is invalid or has expired. Please contact your customer for a new link.'); 
                    setLoading(false); 
                    return; 
                }
                
                const data = docSnap.data();
                
                if (data.status === 'submitted') {
                    setSubmitted(true);
                }
                
                setRequest({ id: docSnap.id, ...data });
                
                // Pre-fill form with any existing data
                if (data.category) setFormData(prev => ({ ...prev, category: data.category }));
                if (data.area) setFormData(prev => ({ ...prev, area: data.area }));
                if (data.description) setFormData(prev => ({ ...prev, description: data.description }));
                
            } catch (err) { 
                console.error('Error loading request:', err); 
                setError('Unable to load request. Please try again.'); 
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
            if (file.size > 10 * 1024 * 1024) { 
                toast.error(`${file.name} is too large (max 10MB)`); 
                continue; 
            }
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
        if (file.size > 10 * 1024 * 1024) { 
            toast.error('Invoice file too large (max 10MB)'); 
            return; 
        }
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
        
        if (!formData.description.trim()) { 
            toast.error('Please describe the work performed'); 
            return; 
        }
        
        setSubmitting(true);
        const loadingToast = toast.loading('Submitting work details...');
        
        try {
            // Upload attachments
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
                } catch (uploadErr) { 
                    console.error('Upload error:', uploadErr); 
                }
            }
            
            // Upload invoice if present
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
                } catch (uploadErr) { 
                    console.error('Invoice upload error:', uploadErr); 
                }
            }
            
            // Update the request document
            const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
            await updateDoc(docRef, {
                status: 'submitted',
                submittedAt: serverTimestamp(),
                
                // Work details
                description: formData.description,
                item: formData.description,
                category: formData.category,
                area: formData.area,
                brand: formData.brand,
                model: formData.model,
                serialNumber: formData.serialNumber,
                notes: formData.notes,
                dateInstalled: formData.datePerformed,
                warrantyInfo: formData.warrantyInfo,
                nextServiceDate: formData.nextServiceDate || null,
                
                // Cost info
                cost: formData.totalCost ? parseFloat(formData.totalCost) : null,
                totalCost: formData.totalCost ? parseFloat(formData.totalCost) : null,
                laborCost: formData.laborCost ? parseFloat(formData.laborCost) : null,
                partsCost: formData.partsCost ? parseFloat(formData.partsCost) : null,
                
                // Contractor info
                contractor: formData.contractorName || formData.contractorCompany,
                contractorName: formData.contractorName,
                contractorCompany: formData.contractorCompany,
                contractorPhone: formData.contractorPhone,
                contractorEmail: formData.contractorEmail,
                
                // Files
                attachments: uploadedAttachments,
                invoiceUrl: invoiceUrl,
                imageUrl: uploadedAttachments.find(a => a.type === 'Photo')?.url || ''
            });
            
            toast.dismiss(loadingToast);
            toast.success('Work details submitted successfully!');
            setSubmitted(true);
            
        } catch (err) { 
            console.error('Submit error:', err); 
            toast.dismiss(loadingToast); 
            toast.error('Failed to submit. Please try again.'); 
        } finally { 
            setSubmitting(false); 
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading request details...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-lg border border-slate-100">
                    <div className="bg-red-100 p-4 rounded-full w-fit mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <a 
                        href="/"
                        className="inline-flex items-center text-emerald-600 font-bold hover:text-emerald-700"
                    >
                        Learn about Krib →
                    </a>
                </div>
            </div>
        );
    }

    // Success state
    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Toaster position="top-center" />
                
                {/* Header */}
                <div className="bg-white border-b border-slate-100 px-4 py-4">
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                        <Logo className="h-8 w-8" />
                        <span className="text-lg font-bold text-emerald-950">krib</span>
                    </div>
                </div>
                
                <div className="max-w-2xl mx-auto p-4 pt-12">
                    <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-slate-100 mb-6">
                        <div className="bg-emerald-100 p-4 rounded-full w-fit mx-auto mb-4">
                            <CheckCircle className="h-10 w-10 text-emerald-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">Submission Received!</h1>
                        <p className="text-slate-500 mb-2">
                            Your work details have been sent to {request?.propertyName || 'the homeowner'}.
                        </p>
                        <p className="text-sm text-slate-400">
                            They'll be notified and can import this into their home record.
                        </p>
                    </div>
                    
                    <ProSignupCTA contractorName={formData.contractorName} />
                </div>
            </div>
        );
    }

    // Main form
    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <Toaster position="top-center" />
            
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8 w-8" />
                        <div>
                            <span className="text-lg font-bold text-emerald-950">krib</span>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wide ml-2">Pro Portal</span>
                        </div>
                    </div>
                    <a 
                        href="/"
                        target="_blank"
                        className="text-xs text-slate-400 hover:text-emerald-600 font-bold flex items-center gap-1"
                    >
                        What's Krib? <ExternalLink size={12} />
                    </a>
                </div>
            </div>
            
            {/* Request Context Banner */}
            <div className="bg-emerald-600 text-white py-6">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="flex items-start gap-4">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <Wrench className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wide mb-1">Work Request</p>
                            <h1 className="text-xl font-bold">{request?.description || 'Service Request'}</h1>
                            <p className="text-emerald-100 text-sm mt-1 flex items-center gap-2">
                                <Home size={14} />
                                For: {request?.propertyName || 'Homeowner'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-4">
                
                {/* Equipment Context */}
                {request?.linkedContext && (
                    <EquipmentContext context={request.linkedContext} />
                )}
                
                {/* Address if shared */}
                {request?.propertyAddress && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Service Address</p>
                            <p className="font-medium text-slate-700">
                                {request.propertyAddress.street}, {request.propertyAddress.city}, {request.propertyAddress.state}
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Work Performed */}
                <Section title="Work Performed" icon={Wrench} badge="Required">
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Description of Work *
                            </label>
                            <textarea 
                                name="description" 
                                value={formData.description} 
                                onChange={handleInputChange}
                                rows={3}
                                placeholder="Describe what was done (e.g., Replaced capacitor and cleaned condenser coils...)"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
                                required
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Category</label>
                                <select 
                                    name="category" 
                                    value={formData.category} 
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                >
                                    <option value="">Select category</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Area/Room</label>
                                <select 
                                    name="area" 
                                    value={formData.area} 
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                >
                                    {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Date Performed</label>
                            <input 
                                type="date" 
                                name="datePerformed" 
                                value={formData.datePerformed} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                </Section>
                
                {/* Equipment Details */}
                <Section title="Equipment Details" icon={Package} defaultOpen={false}>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Brand</label>
                                <input 
                                    type="text" 
                                    name="brand" 
                                    value={formData.brand} 
                                    onChange={handleInputChange}
                                    placeholder="e.g., Carrier, Rheem"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Model #</label>
                                <input 
                                    type="text" 
                                    name="model" 
                                    value={formData.model} 
                                    onChange={handleInputChange}
                                    placeholder="Model number"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Serial #</label>
                            <input 
                                type="text" 
                                name="serialNumber" 
                                value={formData.serialNumber} 
                                onChange={handleInputChange}
                                placeholder="Serial number"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Notes / Warranty Info</label>
                            <textarea 
                                name="notes" 
                                value={formData.notes} 
                                onChange={handleInputChange}
                                rows={2}
                                placeholder="Any additional details, warranty information, recommendations..."
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Next Service Recommended</label>
                            <input 
                                type="date" 
                                name="nextServiceDate" 
                                value={formData.nextServiceDate} 
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <p className="text-xs text-slate-400 mt-1">The homeowner will be reminded when this date approaches</p>
                        </div>
                    </div>
                </Section>
                
                {/* Cost Information */}
                <Section title="Cost Information" icon={DollarSign} badge="Helps Track Expenses">
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Total Cost</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-400 font-medium">$</span>
                                <input 
                                    type="number" 
                                    name="totalCost" 
                                    value={formData.totalCost} 
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    step="0.01"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Labor</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400">$</span>
                                    <input 
                                        type="number" 
                                        name="laborCost" 
                                        value={formData.laborCost} 
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        step="0.01"
                                        className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Parts/Materials</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400">$</span>
                                    <input 
                                        type="number" 
                                        name="partsCost" 
                                        value={formData.partsCost} 
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        step="0.01"
                                        className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Invoice Upload */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">Invoice/Receipt</label>
                            {invoiceFile ? (
                                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center border border-emerald-100">
                                        {invoiceFile.type === 'pdf' ? <FileText className="h-5 w-5 text-emerald-700" /> : <Receipt className="h-5 w-5 text-emerald-700" />}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{invoiceFile.name}</p>
                                        <p className="text-xs text-emerald-600">Invoice attached</p>
                                    </div>
                                    <button type="button" onClick={() => setInvoiceFile(null)} className="p-1 text-slate-400 hover:text-red-500">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    type="button" 
                                    onClick={() => invoiceInputRef.current?.click()}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Receipt className="h-5 w-5" />
                                    Add Invoice/Receipt
                                </button>
                            )}
                            <input ref={invoiceInputRef} type="file" accept="image/*,application/pdf" onChange={handleInvoiceAdd} className="hidden" />
                        </div>
                    </div>
                </Section>
                
                {/* Your Information */}
                <Section title="Your Information" icon={User}>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Your Name</label>
                                <input 
                                    type="text" 
                                    name="contractorName" 
                                    value={formData.contractorName} 
                                    onChange={handleInputChange}
                                    placeholder="John Smith"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Company</label>
                                <input 
                                    type="text" 
                                    name="contractorCompany" 
                                    value={formData.contractorCompany} 
                                    onChange={handleInputChange}
                                    placeholder="ABC Services"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Phone</label>
                                <input 
                                    type="tel" 
                                    name="contractorPhone" 
                                    value={formData.contractorPhone} 
                                    onChange={handleInputChange}
                                    placeholder="(555) 555-5555"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                                <input 
                                    type="email" 
                                    name="contractorEmail" 
                                    value={formData.contractorEmail} 
                                    onChange={handleInputChange}
                                    placeholder="you@company.com"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </Section>
                
                {/* Photos */}
                <Section title="Photos" icon={Camera} defaultOpen={false}>
                    <div className="pt-4">
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {attachments.map((att, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        {att.preview ? (
                                            <img src={att.preview} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                                        ) : (
                                            <div className="w-full h-full bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                                <FileText className="h-8 w-8 text-slate-400" />
                                            </div>
                                        )}
                                        <button 
                                            type="button" 
                                            onClick={() => removeAttachment(index)}
                                            className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Upload className="h-5 w-5" />
                            {attachments.length > 0 ? 'Add More Photos' : 'Add Photos'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileAdd} className="hidden" />
                    </div>
                </Section>
                
                {/* Submit Button - Fixed at bottom */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg">
                    <div className="max-w-2xl mx-auto">
                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-5 w-5" />
                                    Submit Work Details
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
