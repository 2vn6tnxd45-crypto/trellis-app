// src/features/invitations/ContractorInviteCreator.jsx
// ============================================
// CONTRACTOR INVITATION CREATOR
// ============================================
// This component allows contractors to create invitation links
// that pre-populate records for new customers.

import React, { useState, useRef } from 'react';
import { 
    Home, Plus, Trash2, Send, Copy, Check, CheckCircle, 
    Loader2, Package, Mail, Phone, Building2, User,
    ChevronDown, ChevronUp, Camera, FileText, X,
    Link as LinkIcon, QrCode, Share2, MessageSquare,
    AlertCircle, Info, Sparkles
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { CATEGORIES, ROOMS, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { createContractorInvitation } from '../../lib/invitations';
import { compressImage } from '../../lib/images';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { Logo } from '../../components/common/Logo';

// ============================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================
// ============================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================
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

// ============================================
// RECORD ITEM CARD
// ============================================
const RecordItemCard = ({ record, index, onChange, onRemove, onAddPhoto }) => {
    const [expanded, setExpanded] = useState(index === 0);
    const fileInputRef = useRef(null);
    
    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        const newAttachments = await Promise.all(files.map(async (file) => {
            const compressed = await compressImage(file);
            return {
                name: file.name,
                type: 'Photo',
                file: compressed,
                preview: URL.createObjectURL(compressed)
            };
        }));
        
        onChange(index, 'attachments', [...(record.attachments || []), ...newAttachments]);
    };
    
    return (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <Package size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">
                            {record.item || `Item ${index + 1}`}
                        </p>
                        <p className="text-xs text-slate-500">
                            {record.category || 'No category'} 
                            {record.brand && ` • ${record.brand}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                    {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
            </div>
            
            {/* Expanded Form */}
            {expanded && (
                <div className="p-4 pt-0 space-y-4 border-t border-slate-200">
                    {/* Item Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Item Name *
                        </label>
                        <input
                            type="text"
                            value={record.item}
                            onChange={(e) => onChange(index, 'item', e.target.value)}
                            placeholder="e.g. Central Air Conditioner"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                        />
                    </div>
                    
                    {/* Category & Area */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Category *
                            </label>
                            <select
                                value={record.category}
                                onChange={(e) => onChange(index, 'category', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white appearance-none"
                            >
                                <option value="">Select...</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Area/Room
                            </label>
                            <select
                                value={record.area}
                                onChange={(e) => onChange(index, 'area', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white appearance-none"
                            >
                                <option value="General">General</option>
                                {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* Brand & Model */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Brand
                            </label>
                            <input
                                type="text"
                                value={record.brand}
                                onChange={(e) => onChange(index, 'brand', e.target.value)}
                                placeholder="e.g. Carrier"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Model
                            </label>
                            <input
                                type="text"
                                value={record.model}
                                onChange={(e) => onChange(index, 'model', e.target.value)}
                                placeholder="e.g. 24ACC636A003"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                    </div>
                    
                    {/* Serial Number & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Serial Number
                            </label>
                            <input
                                type="text"
                                value={record.serialNumber}
                                onChange={(e) => onChange(index, 'serialNumber', e.target.value)}
                                placeholder="Optional"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Install Date
                            </label>
                            <input
                                type="date"
                                value={record.dateInstalled}
                                onChange={(e) => onChange(index, 'dateInstalled', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                    </div>
                    
                    {/* Cost */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Total Cost
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-400">$</span>
                                <input
                                    type="text"
                                    value={record.cost}
                                    onChange={(e) => onChange(index, 'cost', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Labor
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-400">$</span>
                                <input
                                    type="text"
                                    value={record.laborCost}
                                    onChange={(e) => onChange(index, 'laborCost', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Parts
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-slate-400">$</span>
                                <input
                                    type="text"
                                    value={record.partsCost}
                                    onChange={(e) => onChange(index, 'partsCost', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Warranty & Maintenance */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Warranty
                            </label>
                            <input
                                type="text"
                                value={record.warranty}
                                onChange={(e) => onChange(index, 'warranty', e.target.value)}
                                placeholder="e.g. 10 year parts, 1 year labor"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Maintenance
                            </label>
                            <select
                                value={record.maintenanceFrequency}
                                onChange={(e) => onChange(index, 'maintenanceFrequency', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white appearance-none"
                            >
                                {MAINTENANCE_FREQUENCIES.filter((f, i, arr) => 
                                    arr.findIndex(x => x.label === f.label) === i
                                ).map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Notes
                        </label>
                        <textarea
                            value={record.notes}
                            onChange={(e) => onChange(index, 'notes', e.target.value)}
                            placeholder="Any additional notes about the work performed..."
                            rows={2}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white resize-none"
                        />
                    </div>
                    
                    {/* Photos */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Photos
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                        />
                        <div className="flex flex-wrap gap-2">
                            {(record.attachments || []).map((att, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                                    <img 
                                        src={att.preview || att.url} 
                                        alt="" 
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newAtts = [...record.attachments];
                                            newAtts.splice(i, 1);
                                            onChange(index, 'attachments', newAtts);
                                        }}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                            >
                                <Camera size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// SUCCESS STATE - SHARE LINK
// ============================================
const SuccessState = ({ inviteLink, onCreateAnother }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Your Home Records from Krib',
                    text: "I've prepared your home maintenance records. Click this link to save them to your free Krib account:",
                    url: inviteLink
                });
            } catch (err) {
                handleCopy();
            }
        } else {
            handleCopy();
        }
    };
    
    const handleSMS = () => {
        const text = `I've prepared your home maintenance records. Save them to your free Krib account: ${inviteLink}`;
        window.open(`sms:?body=${encodeURIComponent(text)}`);
    };
    
    const handleEmail = () => {
        const subject = 'Your Home Records';
        const body = `Hi,\n\nI've prepared your home maintenance records from our recent work together.\n\nClick this link to save them to your free Krib account:\n${inviteLink}\n\nThis will give you a permanent record of the work performed, warranty information, and maintenance reminders.\n\nThank you for your business!`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };
    
    return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[2rem] shadow-xl text-center max-w-md w-full border border-emerald-100">
                <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} className="text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-emerald-950 mb-2">Invitation Created!</h1>
                <p className="text-slate-500 mb-8">
                    Share this link with your customer. When they sign up, these records will be automatically added to their account.
                </p>
                
                {/* Link Display */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                    <p className="text-xs font-mono text-slate-600 break-all">{inviteLink}</p>
                </div>
                
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                        onClick={handleCopy}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        <Share2 size={18} />
                        Share
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <button
                        onClick={handleSMS}
                        className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                        <MessageSquare size={16} />
                        Send SMS
                    </button>
                    <button
                        onClick={handleEmail}
                        className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                        <Mail size={16} />
                        Send Email
                    </button>
                </div>
                
                <button
                    onClick={onCreateAnother}
                    className="text-emerald-600 font-bold hover:underline"
                >
                    Create Another Invitation
                </button>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const ContractorInviteCreator = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdLink, setCreatedLink] = useState(null);
    
    // Contractor Info
    const [contractorInfo, setContractorInfo] = useState({
        name: '',
        company: '',
        phone: '',
        email: ''
    });
    
    // Customer Email (optional)
    const [customerEmail, setCustomerEmail] = useState('');
    
    // Records to include
    const [records, setRecords] = useState([{
        item: '',
        category: '',
        area: 'General',
        brand: '',
        model: '',
        serialNumber: '',
        dateInstalled: new Date().toISOString().split('T')[0],
        cost: '',
        laborCost: '',
        partsCost: '',
        warranty: '',
        notes: '',
        maintenanceFrequency: 'annual',
        attachments: []
    }]);
    
    const handleContractorChange = (field, value) => {
        setContractorInfo(prev => ({ ...prev, [field]: value }));
    };
    
    const handleRecordChange = (index, field, value) => {
        setRecords(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };
    
    const handleAddRecord = () => {
        setRecords(prev => [...prev, {
            item: '',
            category: '',
            area: 'General',
            brand: '',
            model: '',
            serialNumber: '',
            dateInstalled: new Date().toISOString().split('T')[0],
            cost: '',
            laborCost: '',
            partsCost: '',
            warranty: '',
            notes: '',
            maintenanceFrequency: 'annual',
            attachments: []
        }]);
    };
    
    const handleRemoveRecord = (index) => {
        if (records.length === 1) {
            toast.error("You need at least one item");
            return;
        }
        setRecords(prev => prev.filter((_, i) => i !== index));
    };
    
    const uploadAttachments = async (attachments) => {
        const uploaded = [];
        for (const att of attachments) {
            if (att.url) {
                // Already uploaded
                uploaded.push({ type: att.type, url: att.url, name: att.name });
            } else if (att.file) {
                // Need to upload
                const fileRef = ref(storage, `invitations/${Date.now()}-${att.name}`);
                await uploadBytes(fileRef, att.file);
                const url = await getDownloadURL(fileRef);
                uploaded.push({ type: att.type, url, name: att.name });
            }
        }
        return uploaded;
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate
        const validRecords = records.filter(r => r.item?.trim());
        if (validRecords.length === 0) {
            toast.error("Please add at least one item with a name");
            return;
        }
        
        if (!contractorInfo.name && !contractorInfo.company) {
            toast.error("Please enter your name or company name");
            return;
        }
        
        setIsSubmitting(true);
        const loadingToast = toast.loading('Creating invitation...');
        
        try {
            // Upload any attachments first
            const recordsWithUploadedAttachments = await Promise.all(
                validRecords.map(async (record) => ({
                    ...record,
                    attachments: await uploadAttachments(record.attachments || [])
                }))
            );
            
            // Create the invitation
            const result = await createContractorInvitation(
                contractorInfo,
                recordsWithUploadedAttachments,
                customerEmail || null
            );
            
            toast.dismiss(loadingToast);
            toast.success('Invitation created!');
            setCreatedLink(result.link);
            
        } catch (error) {
            console.error('Error creating invitation:', error);
            toast.dismiss(loadingToast);
            toast.error('Failed to create invitation. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCreateAnother = () => {
        setCreatedLink(null);
        setRecords([{
            item: '',
            category: '',
            area: 'General',
            brand: '',
            model: '',
            serialNumber: '',
            dateInstalled: new Date().toISOString().split('T')[0],
            cost: '',
            laborCost: '',
            partsCost: '',
            warranty: '',
            notes: '',
            maintenanceFrequency: 'annual',
            attachments: []
        }]);
        setCustomerEmail('');
    };
    
    // Show success state if link was created
    if (createdLink) {
        return <SuccessState inviteLink={createdLink} onCreateAnother={handleCreateAnother} />;
    }
    
    return (
        <div className="min-h-screen bg-slate-50">
            <Toaster position="top-center" />
            
            {/* Header */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                        <Logo className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800">Create Customer Invitation</h1>
                        <p className="text-xs text-slate-500">Send home records to your customer</p>
                    </div>
                </div>
            </header>
            
            {/* Main Content */}
            <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
                <form onSubmit={handleSubmit}>
                    {/* Info Banner */}
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex gap-3">
                        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-blue-800 font-medium">How this works</p>
                            <p className="text-sm text-blue-700 mt-1">
                                Fill in the details of the work you performed. Your customer will receive a link to create a free Krib account with these records pre-loaded.
                            </p>
                        </div>
                    </div>
                    
                    {/* Your Info Section */}
                    <Section title="Your Information" icon={Building2}>
                        <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Your Name
                                    </label>
                                    <input
                                        type="text"
                                        value={contractorInfo.name}
                                        onChange={(e) => handleContractorChange('name', e.target.value)}
                                        placeholder="John Smith"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Company Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={contractorInfo.company}
                                        onChange={(e) => handleContractorChange('company', e.target.value)}
                                        placeholder="ABC HVAC Services"
                                        required
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={contractorInfo.phone}
                                        onChange={(e) => handleContractorChange('phone', e.target.value)}
                                        placeholder="(555) 123-4567"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={contractorInfo.email}
                                        onChange={(e) => handleContractorChange('email', e.target.value)}
                                        placeholder="service@company.com"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </Section>
                    
                    {/* Customer Email (Optional) */}
                    <Section title="Customer Email" icon={Mail} defaultOpen={false} badge="Optional">
                        <div className="pt-4">
                            <p className="text-sm text-slate-500 mb-3">
                                If you enter your customer's email, only that email address will be able to claim these records. Leave blank to allow anyone with the link.
                            </p>
                            <input
                                type="email"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                placeholder="customer@email.com"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </Section>
                    
                    {/* Work Performed Section */}
                    <Section title="Work Performed" icon={Package} badge={`${records.length} item${records.length !== 1 ? 's' : ''}`}>
                        <div className="space-y-4 pt-4">
                            {records.map((record, index) => (
                                <RecordItemCard
                                    key={index}
                                    record={record}
                                    index={index}
                                    onChange={handleRecordChange}
                                    onRemove={handleRemoveRecord}
                                />
                            ))}
                            
                            <button
                                type="button"
                                onClick={handleAddRecord}
                                className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={18} />
                                Add Another Item
                            </button>
                        </div>
                    </Section>
                    
                    {/* Submit Button */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-lg z-50">
    <button
        type="submit"
        disabled={isSubmitting}
        onClick={() => console.log('Button clicked!')}  // ADD HERE
        className="w-full max-w-2xl mx-auto py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
    >
                            {isSubmitting ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Create Invitation Link
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContractorInviteCreator;
