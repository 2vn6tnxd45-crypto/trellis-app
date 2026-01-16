// src/features/requests/ContractorView.jsx
// Contractor submission view with cost/invoice submission capability

import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, ROOMS } from '../../config/constants';
import { Home, Camera, Upload, Send, CheckCircle, AlertCircle, Loader2, FileText, X, DollarSign, Receipt, Wrench, Package } from 'lucide-react';
import { Select } from '../../components/ui/Select';
import toast, { Toaster } from 'react-hot-toast';
import { compressImage } from '../../lib/images';

export const ContractorView = () => {
    const [requestId] = useState(() => new URLSearchParams(window.location.search).get('requestId'));
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        description: '', category: '', area: 'General', brand: '', model: '', serialNumber: '', notes: '',
        datePerformed: new Date().toISOString().split('T')[0],
        totalCost: '', laborCost: '', partsCost: '',
        contractorName: '', contractorCompany: '', contractorPhone: '', contractorEmail: ''
    });

    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);
    const invoiceInputRef = useRef(null);
    const [invoiceFile, setInvoiceFile] = useState(null);

    useEffect(() => {
        const loadRequest = async () => {
            if (!requestId) { setError('No request ID provided'); setLoading(false); return; }
            try {
                const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) { setError('This link is invalid or has expired.'); setLoading(false); return; }
                const data = docSnap.data();
                if (data.status === 'submitted') setSubmitted(true);
                setRequest({ id: docSnap.id, ...data });
                if (data.category) setFormData(prev => ({ ...prev, category: data.category }));
                if (data.area) setFormData(prev => ({ ...prev, area: data.area }));
            } catch (err) { console.error('Error loading request:', err); setError('Unable to load request.'); }
            finally { setLoading(false); }
        };
        loadRequest();
    }, [requestId]);

    const handleInputChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

    const handleFileAdd = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is too large. Max 10MB.`); continue; }
            setAttachments(prev => [...prev, { file, name: file.name, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, type: file.type.includes('pdf') ? 'pdf' : 'image' }]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleInvoiceAdd = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('Invoice file is too large. Max 10MB.'); return; }
        setInvoiceFile({ file, name: file.name, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, type: file.type.includes('pdf') ? 'pdf' : 'image' });
        if (invoiceInputRef.current) invoiceInputRef.current.value = '';
    };

    const removeAttachment = (index) => setAttachments(prev => prev.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.description.trim()) { toast.error('Please describe the work performed.'); return; }
        setSubmitting(true);
        const loadingToast = toast.loading('Submitting your work details...');

        try {
            const uploadedAttachments = [];
            for (const att of attachments) {
                try {
                    let fileToUpload = att.file;
                    if (att.type === 'image') { const compressed = await compressImage(att.file); const response = await fetch(compressed); fileToUpload = await response.blob(); }
                    const storageRef = ref(storage, `requests/${requestId}/attachments/${Date.now()}_${att.name}`);
                    await uploadBytes(storageRef, fileToUpload);
                    const url = await getDownloadURL(storageRef);
                    uploadedAttachments.push({ name: att.name, type: att.type === 'pdf' ? 'Document' : 'Photo', url, dateAdded: new Date().toISOString() });
                } catch (uploadErr) { console.error('Upload error:', uploadErr); }
            }

            let invoiceUrl = null;
            if (invoiceFile) {
                try {
                    let fileToUpload = invoiceFile.file;
                    if (invoiceFile.type === 'image') { const compressed = await compressImage(invoiceFile.file); const response = await fetch(compressed); fileToUpload = await response.blob(); }
                    const storageRef = ref(storage, `requests/${requestId}/invoice/${Date.now()}_${invoiceFile.name}`);
                    await uploadBytes(storageRef, fileToUpload);
                    invoiceUrl = await getDownloadURL(storageRef);
                } catch (uploadErr) { console.error('Invoice upload error:', uploadErr); }
            }

            const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
            await updateDoc(docRef, {
                status: 'submitted', submittedAt: serverTimestamp(),
                description: formData.description, item: formData.description, category: formData.category, area: formData.area,
                brand: formData.brand, model: formData.model, serialNumber: formData.serialNumber, notes: formData.notes, dateInstalled: formData.datePerformed,
                cost: formData.totalCost ? parseFloat(formData.totalCost) : null, totalCost: formData.totalCost ? parseFloat(formData.totalCost) : null,
                laborCost: formData.laborCost ? parseFloat(formData.laborCost) : null, partsCost: formData.partsCost ? parseFloat(formData.partsCost) : null,
                contractor: formData.contractorName || formData.contractorCompany, contractorName: formData.contractorName, contractorCompany: formData.contractorCompany,
                contractorPhone: formData.contractorPhone, contractorEmail: formData.contractorEmail,
                attachments: uploadedAttachments, invoiceUrl: invoiceUrl, imageUrl: uploadedAttachments.find(a => a.type === 'Photo')?.url || ''
            });

            toast.dismiss(loadingToast);
            toast.success('Successfully submitted!');
            setSubmitted(true);
        } catch (err) { console.error('Submit error:', err); toast.dismiss(loadingToast); toast.error('Failed to submit. Please try again.'); }
        finally { setSubmitting(false); }
    };

    if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-8 w-8 text-emerald-600 animate-spin" /></div>;
    if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm border"><AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" /><h1 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h1><p className="text-slate-500">{error}</p></div></div>;
    if (submitted) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><Toaster position="top-center" /><div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm border"><CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-4" /><h1 className="text-xl font-bold text-slate-800 mb-2">Thank you!</h1><p className="text-slate-500">Your work details have been submitted. The homeowner will be notified.</p></div></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <Toaster position="top-center" />
            <div className="bg-white border-b px-4 py-6"><div className="max-w-2xl mx-auto flex items-center gap-3"><div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Home className="h-5 w-5 text-emerald-700" /></div><div><h1 className="text-xl font-bold text-slate-800">Submit Work Details</h1><p className="text-sm text-slate-500">For {request?.propertyName || 'Homeowner'}</p></div></div></div>

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Work Performed */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h2 className="font-bold text-slate-800 mb-4 flex items-center"><Wrench className="h-5 w-5 mr-2 text-emerald-600" />Work Performed</h2>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Description of Work *</label><textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} placeholder="e.g., Replaced HVAC filter, serviced AC unit..." className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none" required /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <Select
                                    value={formData.category}
                                    onChange={(val) => handleInputChange({ target: { name: 'category', value: val } })}
                                    options={[
                                        { value: '', label: 'Select category' },
                                        ...CATEGORIES.map(c => ({ value: c, label: c }))
                                    ]}
                                />
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Area/Room</label>
                                <Select
                                    value={formData.area}
                                    onChange={(val) => handleInputChange({ target: { name: 'area', value: val } })}
                                    options={ROOMS.map(r => ({ value: r, label: r }))}
                                />
                            </div>
                        </div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Date Performed</label><input type="date" name="datePerformed" value={formData.datePerformed} onChange={handleInputChange} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                    </div>
                </div>

                {/* Equipment Details */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h2 className="font-bold text-slate-800 mb-4 flex items-center"><Package className="h-5 w-5 mr-2 text-blue-600" />Equipment Details <span className="text-xs text-slate-400 font-normal ml-2">(Optional)</span></h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Brand</label><input type="text" name="brand" value={formData.brand} onChange={handleInputChange} placeholder="e.g., Carrier" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Model</label><input type="text" name="model" value={formData.model} onChange={handleInputChange} placeholder="Model #" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                        </div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label><input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} placeholder="Serial #" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="Warranty info, recommendations..." className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none" /></div>
                    </div>
                </div>

                {/* Cost Information */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 shadow-sm border border-emerald-200">
                    <h2 className="font-bold text-slate-800 mb-4 flex items-center"><DollarSign className="h-5 w-5 mr-2 text-emerald-600" />Cost Information<span className="ml-2 text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">Helps Track Expenses</span></h2>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium text-slate-700 mb-1">Total Cost</label><div className="relative"><span className="absolute left-4 top-3.5 text-slate-400 font-medium">$</span><input type="number" name="totalCost" value={formData.totalCost} onChange={handleInputChange} placeholder="0.00" step="0.01" className="w-full pl-8 pr-4 py-3 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-lg font-bold" /></div></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Labor</label><div className="relative"><span className="absolute left-4 top-3 text-slate-400">$</span><input type="number" name="laborCost" value={formData.laborCost} onChange={handleInputChange} placeholder="0.00" step="0.01" className="w-full pl-8 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white" /></div></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Parts/Materials</label><div className="relative"><span className="absolute left-4 top-3 text-slate-400">$</span><input type="number" name="partsCost" value={formData.partsCost} onChange={handleInputChange} placeholder="0.00" step="0.01" className="w-full pl-8 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white" /></div></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Upload Invoice/Receipt</label>
                            {invoiceFile ? (
                                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-200">
                                    <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">{invoiceFile.type === 'pdf' ? <FileText className="h-5 w-5 text-emerald-700" /> : <Receipt className="h-5 w-5 text-emerald-700" />}</div>
                                    <div className="flex-grow"><p className="text-sm font-medium text-slate-800">{invoiceFile.name}</p><p className="text-xs text-emerald-600">Invoice attached</p></div>
                                    <button type="button" onClick={() => setInvoiceFile(null)} className="p-1 text-slate-400 hover:text-red-500"><X className="h-5 w-5" /></button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => invoiceInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-700 font-medium hover:bg-emerald-50 flex items-center justify-center gap-2"><Receipt className="h-5 w-5" />Add Invoice/Receipt</button>
                            )}
                            <input ref={invoiceInputRef} type="file" accept="image/*,application/pdf" onChange={handleInvoiceAdd} className="hidden" />
                        </div>
                    </div>
                </div>

                {/* Contractor Info */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h2 className="font-bold text-slate-800 mb-4">Your Information</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label><input type="text" name="contractorName" value={formData.contractorName} onChange={handleInputChange} placeholder="John Smith" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Company</label><input type="text" name="contractorCompany" value={formData.contractorCompany} onChange={handleInputChange} placeholder="ABC Plumbing" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input type="tel" name="contractorPhone" value={formData.contractorPhone} onChange={handleInputChange} placeholder="(555) 555-5555" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" name="contractorEmail" value={formData.contractorEmail} onChange={handleInputChange} placeholder="john@abcplumbing.com" className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                        </div>
                    </div>
                </div>

                {/* Photos */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                    <h2 className="font-bold text-slate-800 mb-4 flex items-center"><Camera className="h-5 w-5 mr-2 text-slate-600" />Photos <span className="text-xs text-slate-400 font-normal ml-2">(Optional)</span></h2>
                    {attachments.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {attachments.map((att, index) => (
                                <div key={index} className="relative group">
                                    {att.preview ? <img src={att.preview} alt="" className="w-full h-24 object-cover rounded-lg border" /> : <div className="w-full h-24 bg-slate-100 rounded-lg border flex items-center justify-center"><FileText className="h-8 w-8 text-slate-400" /></div>}
                                    <button type="button" onClick={() => removeAttachment(index)} className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="h-4 w-4" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-medium hover:bg-slate-50 flex items-center justify-center gap-2"><Upload className="h-5 w-5" />{attachments.length > 0 ? 'Add More Photos' : 'Add Photos'}</button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileAdd} className="hidden" />
                </div>

                <button type="submit" disabled={submitting} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <><Loader2 className="h-5 w-5 animate-spin" />Submitting...</> : <><Send className="h-5 w-5" />Submit Work Details</>}
                </button>
                <p className="text-xs text-center text-slate-400 pb-8">This information will be saved to the homeowner's Krib account.</p>
            </form>
        </div>
    );
};
