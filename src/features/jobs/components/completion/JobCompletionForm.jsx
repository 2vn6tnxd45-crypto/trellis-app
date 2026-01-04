// src/features/jobs/components/completion/JobCompletionForm.jsx
// ============================================
// JOB COMPLETION FORM - CONTRACTOR SIDE
// ============================================
// Form for contractors to submit job completion with:
// - Invoice upload (required) with AI parsing
// - Items installed/serviced
// - Photos (before/after)
// - Notes and recommendations
// - Partial completion option

import React, { useState, useRef, useEffect } from 'react';
import {
    Receipt, Camera, FileText, Plus, Trash2, ChevronDown, ChevronUp,
    Loader2, CheckCircle, Send, AlertCircle, X, Sparkles,
    Calendar, DollarSign, Wrench, MessageSquare, Clock,
    Package, Bell, CheckSquare, Square, Info, ArrowLeft,
    Upload, Image as ImageIcon, AlertTriangle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { CATEGORIES, ROOMS, MAINTENANCE_FREQUENCIES } from '../../../../config/constants';
import { useGemini } from '../../../../hooks/useGemini';
import { compressImage, fileToBase64 } from '../../../../lib/images';
import {
    submitJobCompletion,
    uploadInvoiceFile,
    uploadCompletionPhoto
} from '../../lib/jobCompletionService';

// ============================================
// COLLAPSIBLE SECTION
// ============================================
const Section = ({ title, icon: Icon, children, defaultOpen = true, badge, required }) => {
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
                    {required && (
                        <span className="text-red-500 text-sm">*</span>
                    )}
                    {badge && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {badge}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {isOpen && <div className="px-5 pb-5 border-t border-slate-100 pt-4">{children}</div>}
        </div>
    );
};

// ============================================
// INVOICE UPLOAD SECTION
// ============================================
const InvoiceUploadSection = ({ onInvoiceParsed, invoice, onRemove }) => {
    const fileInputRef = useRef(null);
    const { scanReceipt, isScanning } = useGemini();
    
    const handleInvoiceUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const loadingToast = toast.loading('Analyzing invoice with AI...');
        
        try {
            let base64Str;
            if (file.type === 'application/pdf') {
                base64Str = await fileToBase64(file);
            } else {
                base64Str = await compressImage(file);
            }
            
            const data = await scanReceipt(file, base64Str);
            
            toast.dismiss(loadingToast);
            
            const preview = file.type.startsWith('image/') 
                ? URL.createObjectURL(file) 
                : null;
            
            if (data) {
                toast.success('Invoice analyzed! Review the details below.', { icon: '✨' });
                onInvoiceParsed(data, file, preview);
            } else {
                // Still accept the file even if parsing fails
                onInvoiceParsed({}, file, preview);
                toast.error('Could not extract details. Please fill in manually.');
            }
        } catch (err) {
            console.error('Invoice parsing error:', err);
            toast.dismiss(loadingToast);
            toast.error('Failed to analyze invoice.');
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    if (invoice?.file) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                            {invoice.preview ? (
                                <img src={invoice.preview} alt="Invoice" className="w-12 h-12 object-cover rounded" />
                            ) : (
                                <FileText className="h-8 w-8 text-emerald-600" />
                            )}
                        </div>
                        <div>
                            <p className="font-bold text-emerald-800">{invoice.file.name}</p>
                            <p className="text-xs text-emerald-600">
                                {invoice.parsedData?.totalAmount 
                                    ? `$${invoice.parsedData.totalAmount.toLocaleString()} detected`
                                    : 'Uploaded successfully'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 border-dashed border-emerald-200 p-6">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleInvoiceUpload}
                className="hidden"
            />
            
            <div className="text-center">
                <div className="bg-white w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-100">
                    {isScanning ? (
                        <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
                    ) : (
                        <Receipt className="h-7 w-7 text-emerald-600" />
                    )}
                </div>
                
                <h3 className="font-bold text-slate-800 mb-1">
                    {isScanning ? 'Analyzing Invoice...' : 'Upload Invoice'}
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                    {isScanning
                        ? 'AI is extracting items, costs, and warranty info...'
                        : 'Required to complete the job. AI will auto-fill details.'
                    }
                </p>
                
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto transition-all"
                >
                    {isScanning ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Upload size={16} />
                            Upload Invoice
                        </>
                    )}
                </button>
                
                <p className="text-xs text-slate-500 mt-3">
                    Supports JPG, PNG, and PDF
                </p>
            </div>
        </div>
    );
};

// ============================================
// ITEM EDITOR CARD
// ============================================
const ItemEditorCard = ({ item, index, onChange, onRemove, isOnly }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    const handleChange = (field, value) => {
        onChange(index, { ...item, [field]: value });
    };
    
    const toggleMaintenanceTask = (taskIdx) => {
        const tasks = [...(item.maintenanceTasks || [])];
        tasks[taskIdx] = { ...tasks[taskIdx], selected: !tasks[taskIdx].selected };
        handleChange('maintenanceTasks', tasks);
    };
    
    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-lg">
                        <Package size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">
                            {item.item || `Item ${index + 1}`}
                        </p>
                        <p className="text-xs text-slate-500">
                            {item.category || 'Uncategorized'} • {item.area || 'General'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isOnly && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
            </div>
            
            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
                    {/* Item Name & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Item Name *
                            </label>
                            <input
                                type="text"
                                value={item.item || ''}
                                onChange={(e) => handleChange('item', e.target.value)}
                                placeholder="e.g., Carrier AC Unit"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Category
                            </label>
                            <select
                                value={item.category || ''}
                                onChange={(e) => handleChange('category', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            >
                                <option value="">Select...</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {/* Brand, Model, Serial */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Brand
                            </label>
                            <input
                                type="text"
                                value={item.brand || ''}
                                onChange={(e) => handleChange('brand', e.target.value)}
                                placeholder="e.g., Carrier"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Model
                            </label>
                            <input
                                type="text"
                                value={item.model || ''}
                                onChange={(e) => handleChange('model', e.target.value)}
                                placeholder="Model #"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Serial Number
                            </label>
                            <input
                                type="text"
                                value={item.serialNumber || ''}
                                onChange={(e) => handleChange('serialNumber', e.target.value)}
                                placeholder="Serial #"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    {/* Area & Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Location/Area
                            </label>
                            <select
                                value={item.area || ''}
                                onChange={(e) => handleChange('area', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            >
                                <option value="">Select...</option>
                                {ROOMS.map(room => (
                                    <option key={room} value={room}>{room}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Date Installed
                            </label>
                            <input
                                type="date"
                                value={item.dateInstalled || ''}
                                onChange={(e) => handleChange('dateInstalled', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    {/* Costs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Total Cost
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                    type="number"
                                    value={item.cost || ''}
                                    onChange={(e) => handleChange('cost', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Labor Cost
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                    type="number"
                                    value={item.laborCost || ''}
                                    onChange={(e) => handleChange('laborCost', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Parts Cost
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input
                                    type="number"
                                    value={item.partsCost || ''}
                                    onChange={(e) => handleChange('partsCost', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Warranty */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Warranty Information
                        </label>
                        <input
                            type="text"
                            value={item.warranty || ''}
                            onChange={(e) => handleChange('warranty', e.target.value)}
                            placeholder="e.g., 10 year parts, 1 year labor"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    
                    {/* Maintenance Tasks */}
                    {(item.maintenanceTasks?.length > 0) && (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Bell size={16} className="text-amber-600" />
                                <span className="text-sm font-bold text-amber-800">
                                    Maintenance Reminders
                                </span>
                                <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase ml-auto">
                                    Drives Repeat Business
                                </span>
                            </div>
                            <p className="text-xs text-amber-700 mb-3">
                                Customer will receive reminders for selected tasks
                            </p>
                            <div className="space-y-2">
                                {item.maintenanceTasks.map((task, taskIdx) => (
                                    <button
                                        key={taskIdx}
                                        type="button"
                                        onClick={() => toggleMaintenanceTask(taskIdx)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                            task.selected !== false
                                                ? 'bg-white border-amber-300 shadow-sm'
                                                : 'bg-amber-50/50 border-amber-100'
                                        }`}
                                    >
                                        {task.selected !== false ? (
                                            <CheckSquare size={18} className="text-amber-600 shrink-0" />
                                        ) : (
                                            <Square size={18} className="text-amber-300 shrink-0" />
                                        )}
                                        <div className="flex-grow text-left">
                                            <p className={`text-sm font-medium ${
                                                task.selected !== false ? 'text-slate-800' : 'text-slate-400'
                                            }`}>
                                                {task.task}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {task.frequency}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// PHOTO UPLOAD SECTION
// ============================================
const PhotoUploadSection = ({ photos, onAdd, onRemove, onUpdateCaption }) => {
    const fileInputRef = useRef(null);
    const [uploadingCount, setUploadingCount] = useState(0);
    
    const handlePhotoSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setUploadingCount(files.length);
        
        for (const file of files) {
            try {
                const compressed = await compressImage(file);
                const response = await fetch(compressed);
                const blob = await response.blob();
                
                onAdd({
                    file: new File([blob], file.name, { type: 'image/jpeg' }),
                    preview: compressed,
                    type: 'work',
                    caption: ''
                });
            } catch (err) {
                console.error('Photo processing error:', err);
            }
        }
        
        setUploadingCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
            />
            
            {/* Photo Grid */}
            <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, idx) => (
                    <div key={idx} className="relative group aspect-square">
                        <img
                            src={photo.preview || photo.url}
                            alt={photo.caption || `Photo ${idx + 1}`}
                            className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-xl">
                            <button
                                type="button"
                                onClick={() => onRemove(idx)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        {/* Type Badge */}
                        <div className="absolute bottom-2 left-2">
                            <select
                                value={photo.type}
                                onChange={(e) => onUpdateCaption(idx, { ...photo, type: e.target.value })}
                                className="text-[10px] bg-black/60 text-white px-2 py-1 rounded-lg border-0 focus:ring-0"
                            >
                                <option value="before">Before</option>
                                <option value="after">After</option>
                                <option value="work">Work</option>
                            </select>
                        </div>
                    </div>
                ))}
                
                {/* Add Photo Button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCount > 0}
                    className="aspect-square border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                >
                    {uploadingCount > 0 ? (
                        <Loader2 className="animate-spin" size={24} />
                    ) : (
                        <>
                            <Camera size={24} />
                            <span className="text-xs mt-1">Add Photo</span>
                        </>
                    )}
                </button>
            </div>
            
            <p className="text-xs text-slate-500 text-center">
                Add before/after photos to showcase your work
            </p>
        </div>
    );
};

// ============================================
// PARTIAL COMPLETION TOGGLE
// ============================================
const PartialCompletionSection = ({ isPartial, setIsPartial, reason, setReason }) => {
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    onClick={() => setIsPartial(!isPartial)}
                    className="mt-0.5"
                >
                    {isPartial ? (
                        <CheckSquare size={20} className="text-amber-600" />
                    ) : (
                        <Square size={20} className="text-amber-400" />
                    )}
                </button>
                <div className="flex-grow">
                    <p className="font-bold text-amber-800">Partial Completion</p>
                    <p className="text-xs text-amber-700 mb-2">
                        Check this if some work remains (e.g., waiting for parts)
                    </p>
                    
                    {isPartial && (
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain what's remaining and why..."
                            rows={2}
                            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white resize-none"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const JobCompletionForm = ({ 
    job, 
    contractorId,
    contractorProfile,
    onSuccess, 
    onCancel 
}) => {
    // Form State
    const [invoice, setInvoice] = useState(null);
    const [items, setItems] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [notes, setNotes] = useState('');
    const [recommendations, setRecommendations] = useState('');
    const [isPartial, setIsPartial] = useState(false);
    const [partialReason, setPartialReason] = useState('');
    
    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1); // 1: Invoice, 2: Details, 3: Review
    
    // Handle invoice parsed data
    const handleInvoiceParsed = (data, file, preview) => {
        setInvoice({
            file,
            preview,
            parsedData: {
                totalAmount: data.totalAmount || null,
                laborCost: data.laborCost || null,
                partsCost: data.partsCost || null,
                taxAmount: data.taxAmount || null,
                date: data.date || null,
                vendorName: data.vendorName || null
            }
        });
        
        // Auto-populate items from parsed invoice
        if (data.items && data.items.length > 0) {
            const parsedItems = data.items.map((item, idx) => ({
                id: `item_${Date.now()}_${idx}`,
                item: item.item || '',
                category: item.category || '',
                area: item.area || 'General',
                brand: item.brand || '',
                model: item.model || '',
                serialNumber: item.serial || '',
                dateInstalled: data.date || new Date().toISOString().split('T')[0],
                cost: item.cost || '',
                laborCost: '',
                partsCost: '',
                warranty: data.warranty || item.warranty || '',
                warrantyDetails: item.warrantyDetails || null,
                maintenanceFrequency: item.maintenanceFrequency || 'annual',
                maintenanceTasks: (item.suggestedTasks || []).map(t => ({
                    ...t,
                    selected: true
                })),
                attachments: []
            }));
            setItems(parsedItems);
        } else if (items.length === 0) {
            // Add one empty item if none parsed
            addEmptyItem();
        }
        
        // Move to next step
        setCurrentStep(2);
    };
    
    // Add empty item
    const addEmptyItem = () => {
        setItems(prev => [...prev, {
            id: `item_${Date.now()}`,
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
            warrantyDetails: null,
            maintenanceFrequency: 'none',
            maintenanceTasks: [],
            attachments: []
        }]);
    };
    
    // Update item
    const handleItemChange = (index, updatedItem) => {
        setItems(prev => prev.map((item, i) => i === index ? updatedItem : item));
    };
    
    // Remove item
    const handleItemRemove = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };
    
    // Photo handlers
    const handlePhotoAdd = (photo) => {
        setPhotos(prev => [...prev, photo]);
    };
    
    const handlePhotoRemove = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };
    
    const handlePhotoUpdate = (index, updated) => {
        setPhotos(prev => prev.map((p, i) => i === index ? updated : p));
    };
    
    // Validation
    const validateForm = () => {
        if (!invoice?.file) {
            toast.error('Invoice is required');
            return false;
        }
        
        const validItems = items.filter(item => item.item?.trim());
        if (validItems.length === 0) {
            toast.error('At least one item is required');
            return false;
        }
        
        if (isPartial && !partialReason.trim()) {
            toast.error('Please explain what work remains');
            return false;
        }
        
        return true;
    };
    
    // Submit
    const handleSubmit = async () => {
        if (!validateForm()) return;
        
        setIsSubmitting(true);
        const loadingToast = toast.loading('Submitting completion...');
        
        try {
            // 1. Upload invoice
            const invoiceUpload = await uploadInvoiceFile(job.id, invoice.file, contractorId);
            
            // 2. Upload photos
            const uploadedPhotos = [];
            for (const photo of photos) {
                if (photo.file) {
                    const uploaded = await uploadCompletionPhoto(job.id, photo.file, photo.type);
                    uploaded.caption = photo.caption || '';
                    uploadedPhotos.push(uploaded);
                }
            }
            
            // 3. Prepare completion data
            const completionData = {
                invoice: {
                    url: invoiceUpload.url,
                    fileName: invoiceUpload.fileName,
                    parsedData: invoice.parsedData
                },
                items: items.filter(item => item.item?.trim()).map(item => ({
                    ...item,
                    cost: item.cost ? parseFloat(item.cost) : null,
                    laborCost: item.laborCost ? parseFloat(item.laborCost) : null,
                    partsCost: item.partsCost ? parseFloat(item.partsCost) : null
                })),
                photos: uploadedPhotos,
                notes: notes,
                recommendations: recommendations,
                isPartial: isPartial,
                partialReason: isPartial ? partialReason : null
            };
            
            // 4. Submit to Firestore
            await submitJobCompletion(job.id, completionData, contractorId);
            
            toast.dismiss(loadingToast);
            toast.success('Job completion submitted!');
            
            if (onSuccess) onSuccess();
            
        } catch (error) {
            console.error('Submission error:', error);
            toast.dismiss(loadingToast);
            toast.error('Failed to submit: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <Toaster position="top-center" />
            
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft size={20} className="text-slate-600" />
                            </button>
                        )}
                        <div>
                            <h1 className="font-bold text-slate-800">Complete Job</h1>
                            <p className="text-sm text-slate-500">
                                {job.customerName || job.propertyName || 'Customer'}
                            </p>
                        </div>
                    </div>
                    
                    {/* Step Indicator */}
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map(step => (
                            <div
                                key={step}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                    currentStep >= step
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 text-slate-500'
                                }`}
                            >
                                {currentStep > step ? <CheckCircle size={16} /> : step}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="max-w-2xl mx-auto p-4">
                {/* Job Summary */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <Wrench className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">{job.description || job.item || 'Service Job'}</p>
                            <p className="text-sm text-slate-500">
                                {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Date TBD'}
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Step 1: Invoice Upload */}
                <Section 
                    title="Invoice" 
                    icon={Receipt} 
                    required 
                    badge={invoice?.file ? 'Uploaded' : null}
                >
                    <InvoiceUploadSection
                        invoice={invoice}
                        onInvoiceParsed={handleInvoiceParsed}
                        onRemove={() => setInvoice(null)}
                    />
                </Section>
                
                {/* Step 2: Items (only show after invoice) */}
                {invoice?.file && (
                    <>
                        <Section title="Items Installed/Serviced" icon={Package} badge={`${items.length} items`}>
                            <div className="space-y-4">
                                {items.map((item, idx) => (
                                    <ItemEditorCard
                                        key={item.id || idx}
                                        item={item}
                                        index={idx}
                                        onChange={handleItemChange}
                                        onRemove={handleItemRemove}
                                        isOnly={items.length === 1}
                                    />
                                ))}
                                
                                <button
                                    type="button"
                                    onClick={addEmptyItem}
                                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-emerald-500 hover:text-emerald-500 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Add Another Item
                                </button>
                            </div>
                        </Section>
                        
                        <Section title="Photos" icon={Camera} defaultOpen={false}>
                            <PhotoUploadSection
                                photos={photos}
                                onAdd={handlePhotoAdd}
                                onRemove={handlePhotoRemove}
                                onUpdateCaption={handlePhotoUpdate}
                            />
                        </Section>
                        
                        <Section title="Notes & Recommendations" icon={MessageSquare} defaultOpen={false}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Job Notes
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Any notes about the work performed..."
                                        rows={3}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Recommendations for Customer
                                    </label>
                                    <textarea
                                        value={recommendations}
                                        onChange={(e) => setRecommendations(e.target.value)}
                                        placeholder="e.g., Consider upgrading ductwork next year..."
                                        rows={3}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </Section>
                        
                        {/* Partial Completion */}
                        <PartialCompletionSection
                            isPartial={isPartial}
                            setIsPartial={setIsPartial}
                            reason={partialReason}
                            setReason={setPartialReason}
                        />
                    </>
                )}
            </div>
            
            {/* Submit Button */}
            {invoice?.file && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-lg z-50">
                    <div className="max-w-2xl mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send size={20} />
                                    Submit Completion
                                </>
                            )}
                        </button>
                        
                        <p className="text-xs text-slate-500 text-center mt-2">
                            Customer will review and accept your completion
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobCompletionForm;
