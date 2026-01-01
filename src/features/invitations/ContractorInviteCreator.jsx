// src/features/invitations/ContractorInviteCreator.jsx
// ============================================
// CONTRACTOR INVITATION CREATOR
// ============================================
// This component allows contractors to create invitation links
// that pre-populate records for new customers.
// 
// Features:
// - Invoice upload with AI auto-populate
// - Maintenance task suggestions (the "hook" for repeat business!)

import React, { useState, useRef } from 'react';
import { 
    Home, Plus, Trash2, Send, Copy, Check, CheckCircle, 
    Loader2, Package, Mail, Phone, Building2, User,
    ChevronDown, ChevronUp, Camera, FileText, X,
    Link as LinkIcon, QrCode, Share2, MessageSquare,
    AlertCircle, Info, Sparkles, Upload, ScanLine, Receipt,
    Calendar, Clock, Bell, CheckSquare, Square,
    ArrowLeft // ADDED: ArrowLeft icon
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { CATEGORIES, ROOMS, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { createContractorInvitation } from '../../lib/invitations';
import { compressImage, fileToBase64 } from '../../lib/images';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';  
import { storage, auth } from '../../config/firebase';  
import { Logo } from '../../components/common/Logo';
import { useGemini } from '../../hooks/useGemini';

import { useContractorAuth, linkInvitationToContractor } from '../contractor-pro';

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
// SUCCESS STATE COMPONENT
// ============================================
const SuccessState = ({ inviteLink, onCreateAnother }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy');
        }
    };
    
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Your Home Records from Krib',
                    text: 'I\'ve created a home record for you. Click to claim it!',
                    url: inviteLink
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    handleCopy();
                }
            }
        } else {
            handleCopy();
        }
    };
    
    return (
        <div className="contractor-page min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                </div>
                
                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                    Invitation Created!
                </h1>
                <p className="text-slate-600 mb-8">
                    Share this link with your customer. They'll be able to claim these records instantly.
                </p>
                
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                    <p className="text-xs text-slate-500 mb-2 font-medium">INVITATION LINK</p>
                    <p className="text-sm text-slate-700 break-all font-mono bg-slate-50 p-3 rounded-lg">
                        {inviteLink}
                    </p>
                </div>
                
                <div className="flex gap-3 mb-8">
                    <button
                        onClick={handleCopy}
                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                        <Share2 size={18} />
                        Share
                    </button>
                </div>
                
                <button
                    onClick={onCreateAnother}
                    className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
                >
                    Create Another Invitation
                </button>
            </div>
        </div>
    );
};

// ... [MaintenanceTaskItem, AddTaskForm, RecordItemCard, InvoiceUploadSection remain unchanged] ...
// I will keep them exactly as is, but for brevity in this response I'm just indicating they are here.
// Please assume the previous code for these components is preserved.

const MaintenanceTaskItem = ({ task, onToggle, onRemove, isCustom }) => {
    return (
        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
            <button
                type="button"
                onClick={onToggle}
                className="shrink-0"
            >
                {task.selected ? (
                    <CheckSquare size={20} className="text-emerald-600" />
                ) : (
                    <Square size={20} className="text-slate-300" />
                )}
            </button>
            <div className="flex-grow min-w-0">
                <p className={`font-medium text-sm ${task.selected ? 'text-slate-800' : 'text-slate-400'}`}>
                    {task.task}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={12} />
                    <span className="capitalize">{task.frequency}</span>
                    {task.firstDueDate && (
                        <>
                            <span>•</span>
                            <Calendar size={12} />
                            <span>First: {new Date(task.firstDueDate).toLocaleDateString()}</span>
                        </>
                    )}
                </div>
            </div>
            {isCustom && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
};

const AddTaskForm = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [taskName, setTaskName] = useState('');
    const [frequency, setFrequency] = useState('annual');
    
    const handleSubmit = () => {
        if (!taskName.trim()) {
            toast.error('Please enter a task name');
            return;
        }
        
        // Calculate first due date based on frequency
        const today = new Date();
        let firstDueDate = new Date(today);
        
        switch (frequency) {
            case 'monthly':
                firstDueDate.setMonth(firstDueDate.getMonth() + 1);
                break;
            case 'quarterly':
                firstDueDate.setMonth(firstDueDate.getMonth() + 3);
                break;
            case 'biannual':
                firstDueDate.setMonth(firstDueDate.getMonth() + 6);
                break;
            case 'annual':
            default:
                firstDueDate.setFullYear(firstDueDate.getFullYear() + 1);
                break;
        }
        
        onAdd({
            task: taskName.trim(),
            frequency,
            firstDueDate: firstDueDate.toISOString().split('T')[0],
            selected: true,
            isCustom: true
        });
        
        setTaskName('');
        setFrequency('annual');
        setIsOpen(false);
        toast.success('Task added!');
    };
    
    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={16} />
                Add Custom Task
            </button>
        );
    }
    
    return (
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3">
            <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Quarterly Pest Inspection"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
            />
            <div className="flex gap-2">
                <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="flex-grow px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="biannual">Every 6 Months</option>
                    <option value="annual">Annual</option>
                </select>
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    Add
                </button>
            </div>
        </div>
    );
};

const RecordItemCard = ({ record, index, onChange, onRemove }) => {
    const [expanded, setExpanded] = useState(index === 0);
    const fileInputRef = useRef(null);
    
    // FIX: Proper photo upload handling
    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        try {
            const newAttachments = await Promise.all(files.map(async (file) => {
                // compressImage returns a data URL string, which IS a valid image src
                const compressedDataUrl = await compressImage(file);
                return {
                    name: file.name,
                    type: 'Photo',
                    file: file, // Keep original file for upload
                    preview: compressedDataUrl // Use the data URL directly as preview
                };
            }));
            
            onChange(index, 'attachments', [...(record.attachments || []), ...newAttachments]);
            toast.success(`Added ${files.length} photo${files.length > 1 ? 's' : ''}`);
        } catch (err) {
            console.error('Photo upload error:', err);
            toast.error('Failed to process photo');
        }
        
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    const removeAttachment = (attIndex) => {
        const updated = (record.attachments || []).filter((_, i) => i !== attIndex);
        onChange(index, 'attachments', updated);
    };
    
    // Toggle a maintenance task
    const toggleTask = (taskIndex) => {
        const updatedTasks = [...(record.maintenanceTasks || [])];
        updatedTasks[taskIndex] = { 
            ...updatedTasks[taskIndex], 
            selected: !updatedTasks[taskIndex].selected 
        };
        onChange(index, 'maintenanceTasks', updatedTasks);
    };
    
    // Add a custom maintenance task
    const addCustomTask = (newTask) => {
        const updatedTasks = [...(record.maintenanceTasks || []), newTask];
        onChange(index, 'maintenanceTasks', updatedTasks);
    };
    
    // Remove a custom task
    const removeTask = (taskIndex) => {
        const updatedTasks = (record.maintenanceTasks || []).filter((_, i) => i !== taskIndex);
        onChange(index, 'maintenanceTasks', updatedTasks);
    };
    
    const selectedTaskCount = (record.maintenanceTasks || []).filter(t => t.selected).length;
    
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
                            {selectedTaskCount > 0 && (
                                <span className="ml-2 text-emerald-600">
                                    • {selectedTaskCount} task{selectedTaskCount !== 1 ? 's' : ''}
                                </span>
                            )}
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
                    {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                </div>
            </div>
            
            {/* Expanded Content */}
            {expanded && (
                <div className="p-4 pt-0 space-y-4 border-t border-slate-100">
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
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            >
                                <option value="">Select...</option>
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Area/Room
                            </label>
                            <select
                                value={record.area}
                                onChange={(e) => onChange(index, 'area', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            >
                                <option value="">Select...</option>
                                {ROOMS.map(room => (
                                    <option key={room} value={room}>{room}</option>
                                ))}
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
                            <input
                                type="number"
                                value={record.cost}
                                onChange={(e) => onChange(index, 'cost', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Labor
                            </label>
                            <input
                                type="number"
                                value={record.laborCost}
                                onChange={(e) => onChange(index, 'laborCost', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Parts
                            </label>
                            <input
                                type="number"
                                value={record.partsCost}
                                onChange={(e) => onChange(index, 'partsCost', e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                        </div>
                    </div>
                    
                    {/* Warranty */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Warranty Info
                        </label>
                        <input
                            type="text"
                            value={record.warranty}
                            onChange={(e) => onChange(index, 'warranty', e.target.value)}
                            placeholder="e.g. 10 year parts, 1 year labor"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                        />
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
                    
                    {/* ============================================ */}
                    {/* MAINTENANCE SCHEDULE SECTION - THE HOOK! */}
                    {/* ============================================ */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Bell size={18} className="text-amber-600" />
                            <label className="text-sm font-bold text-amber-800">
                                Maintenance Schedule
                            </label>
                            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase ml-auto">
                                Drives Repeat Business
                            </span>
                        </div>
                        <p className="text-xs text-amber-700 mb-3">
                            Your customer will receive reminders for these tasks — keeping you top of mind for future service!
                        </p>
                        
                        <div className="space-y-2">
                            {(record.maintenanceTasks || []).map((task, taskIdx) => (
                                <MaintenanceTaskItem
                                    key={taskIdx}
                                    task={task}
                                    onToggle={() => toggleTask(taskIdx)}
                                    onRemove={() => removeTask(taskIdx)}
                                    isCustom={task.isCustom}
                                />
                            ))}
                            
                            {(record.maintenanceTasks || []).length === 0 && (
                                <p className="text-xs text-amber-600 italic py-2">
                                    No tasks yet. Upload an invoice for AI suggestions, or add your own below.
                                </p>
                            )}
                            
                            <AddTaskForm onAdd={addCustomTask} />
                        </div>
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
                                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                                    <img 
                                        src={att.preview || att.url} 
                                        alt="" 
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(i)}
                                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={16} className="text-white" />
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

const InvoiceUploadSection = ({ onInvoiceParsed }) => {
    const fileInputRef = useRef(null);
    // IMPORTANT: Use isScanning from the SAME hook instance as scanReceipt
    // Using separate instances causes the spinner to never stop!
    const { scanReceipt, isScanning } = useGemini();
    const [invoicePreview, setInvoicePreview] = useState(null);
    const [invoiceFile, setInvoiceFile] = useState(null);
    
    const handleInvoiceUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setInvoiceFile(file);
        
        // Create preview
        if (file.type.startsWith('image/')) {
            setInvoicePreview(URL.createObjectURL(file));
        } else if (file.type === 'application/pdf') {
            setInvoicePreview('pdf');
        }
        
        const loadingToast = toast.loading('Analyzing invoice with AI...');
        
        try {
            // Convert to base64 for AI processing
            let base64Str;
            if (file.type === 'application/pdf') {
                base64Str = await fileToBase64(file);
            } else {
                base64Str = await compressImage(file);
            }
            
            // Use the existing Gemini scanner
            const data = await scanReceipt(file, base64Str);
            
            toast.dismiss(loadingToast);
            
            if (data) {
                toast.success('Invoice analyzed! Review the details below.', { icon: '✨' });
                onInvoiceParsed(data, file, file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
            } else {
                toast.error('Could not extract data. Please fill in manually.');
            }
        } catch (err) {
            console.error('Invoice parsing error:', err);
            toast.dismiss(loadingToast);
            toast.error('Failed to analyze invoice. Please fill in manually.');
        }
        
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    
    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-dashed border-emerald-200 p-6 mb-6">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleInvoiceUpload}
                className="hidden"
            />
            
            <div className="text-center">
                <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-100">
                    {isScanning ? (
                        <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                    ) : (
                        <Receipt className="h-8 w-8 text-emerald-600" />
                    )}
                </div>
                
                <h3 className="font-bold text-slate-800 mb-1">
                    {isScanning ? 'Analyzing Invoice...' : 'Upload Your Invoice'}
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                    {isScanning 
                        ? 'AI is extracting items, costs, and maintenance schedule...'
                        : 'AI will auto-fill everything including maintenance reminders for repeat business'
                    }
                </p>
                
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto transition-all"
                >
                    {isScanning ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <ScanLine size={18} />
                            Scan Invoice
                        </>
                    )}
                </button>
                
                <p className="text-xs text-slate-500 mt-3">
                    Supports JPG, PNG, and PDF files
                </p>
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
    // Note: useGemini is called inside InvoiceUploadSection, not here
    // This avoids the dual-instance bug where isScanning never updates
    
    // CHANGE 2: Check if contractor is logged in (not anonymous) for linking invitations
    const { user: contractorUser, isAuthenticated: isContractorLoggedIn } = useContractorAuth();
    
    // Invoice state
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [invoicePreview, setInvoicePreview] = useState(null);
    
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
        area: '',
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
        maintenanceTasks: [],
        attachments: []
    }]);
    
    // Handle invoice parsed data
    const handleInvoiceParsed = (data, file, preview) => {
        // Store invoice file to use as attachment
        setInvoiceFile(file);
        setInvoicePreview(preview);
        
        // Auto-fill contractor info
        if (data.vendorName || data.vendorPhone || data.vendorEmail) {
            setContractorInfo(prev => ({
                ...prev,
                company: data.vendorName || prev.company,
                phone: data.vendorPhone || prev.phone,
                email: data.vendorEmail || prev.email
            }));
        }
        
        // Auto-fill records from parsed items
        if (data.items && data.items.length > 0) {
            const newRecords = data.items.map((item, idx) => ({
                item: item.item || '',
                category: item.category || '',
                area: item.area || '',
                brand: item.brand || '',
                model: item.model || '',
                serialNumber: item.serial || '',
                dateInstalled: data.date || new Date().toISOString().split('T')[0],
                cost: item.cost || '',
                laborCost: '',
                partsCost: '',
                warranty: data.warranty || '',
                notes: item.maintenanceNotes || '',
                maintenanceFrequency: item.maintenanceFrequency || 'annual',
                // Map suggestedTasks to maintenanceTasks with 'selected: true'
                maintenanceTasks: (item.suggestedTasks || []).map(t => ({
                    ...t,
                    selected: true
                })),
                // Attach the invoice image to the first item
                attachments: idx === 0 && preview ? [{
                    name: file.name,
                    type: 'Photo',
                    file: file,
                    preview: preview
                }] : []
            }));
            
            setRecords(newRecords);
        }
    };
    
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
            area: '',
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
            maintenanceTasks: [],
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
        console.log('uploadAttachments called with:', attachments?.length, 'files');
        const uploaded = [];
        
        for (const att of attachments) {
            console.log('Processing attachment:', att.name, 'hasUrl:', !!att.url, 'hasFile:', !!att.file);
            
            if (att.url) {
                // Already uploaded
                uploaded.push({ type: att.type, url: att.url, name: att.name });
                console.log('Attachment already has URL, skipping upload');
            } else if (att.file) {
                try {
                    console.log('Uploading file:', att.name);
                    const fileRef = ref(storage, `invitations/${Date.now()}-${att.name}`);
                    
                    // Upload the file directly (Firebase handles File objects)
                    await uploadBytes(fileRef, att.file);
                    console.log('Upload complete, getting download URL');
                    
                    const url = await getDownloadURL(fileRef);
                    console.log('Got download URL:', url.substring(0, 50) + '...');
                    
                    uploaded.push({ type: att.type, url, name: att.name });
                } catch (err) {
                    console.error('Upload error for attachment:', att.name, err);
                    // Continue with other attachments even if one fails
                }
            }
        }
        
        console.log('uploadAttachments complete, uploaded:', uploaded.length);
        return uploaded;
    };
    
    const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('=== handleSubmit START ===');
    
    const validRecords = records.filter(r => r.item?.trim());
    console.log('Valid records:', validRecords.length);
    
    if (validRecords.length === 0) {
        toast.error("Please add at least one item with a name");
        return;
    }
    
    console.log('Contractor info:', contractorInfo);
    if (!contractorInfo.name && !contractorInfo.company) {
        toast.error("Please enter your name or company name");
        return;
    }
    
    setIsSubmitting(true);
    const loadingToast = toast.loading('Creating invitation...');
    
    try {
        // ============================================
        // STEP 1: Authentication
        // ============================================
        console.log('STEP 1: Checking authentication...');
        console.log('Current user:', auth.currentUser?.uid || 'NONE');
        
        if (!auth.currentUser) {
            console.log('No auth, attempting anonymous sign in...');
            try {
                const credential = await signInAnonymously(auth);
                console.log('Anonymous auth SUCCESS, uid:', credential.user.uid);
            } catch (authError) {
                console.error('Anonymous auth FAILED:', authError.code, authError.message);
                toast.dismiss(loadingToast);
                toast.error('Authentication failed: ' + authError.message);
                setIsSubmitting(false);
                return;
            }
        } else {
            console.log('Already authenticated, uid:', auth.currentUser.uid);
        }
        
        // ============================================
        // STEP 2: Upload Attachments
        // ============================================
        console.log('STEP 2: Processing attachments...');
        
        let recordsWithUploadedAttachments;
        try {
            recordsWithUploadedAttachments = await Promise.all(
                validRecords.map(async (record, idx) => {
                    console.log(`Processing record ${idx}: ${record.item}`);
                    
                    const selectedTasks = (record.maintenanceTasks || [])
                        .filter(t => t.selected)
                        .map(t => ({
                            task: t.task,
                            frequency: t.frequency,
                            nextDue: t.firstDueDate
                        }));
                    
                    console.log(`Record ${idx}: ${selectedTasks.length} tasks, ${record.attachments?.length || 0} attachments`);
                    
                    let uploadedAttachments = [];
                    if (record.attachments?.length > 0) {
                        console.log(`Record ${idx}: Uploading attachments...`);
                        try {
                            uploadedAttachments = await uploadAttachments(record.attachments);
                            console.log(`Record ${idx}: Upload complete, ${uploadedAttachments.length} uploaded`);
                        } catch (uploadErr) {
                            console.error(`Record ${idx}: Attachment upload FAILED:`, uploadErr);
                            // Continue without attachments rather than failing completely
                            uploadedAttachments = [];
                        }
                    }
                    
                    return {
                        ...record,
                        attachments: uploadedAttachments,
                        maintenanceTasks: selectedTasks
                    };
                })
            );
            console.log('STEP 2 COMPLETE: All records processed');
        } catch (processError) {
            console.error('STEP 2 FAILED:', processError);
            toast.dismiss(loadingToast);
            toast.error('Failed to process records: ' + processError.message);
            setIsSubmitting(false);
            return;
        }
        
        // ============================================
        // STEP 3: Create Invitation in Firestore
        // ============================================
        console.log('STEP 3: Creating invitation in Firestore...');
        console.log('Records to send:', recordsWithUploadedAttachments.length);
        console.log('Contractor:', contractorInfo.company || contractorInfo.name);
        
        let result;
        try {
            // Set a timeout but also log what's happening
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    console.error('STEP 3 TIMEOUT: Firestore write took too long');
                    reject(new Error('Invitation creation timed out after 30 seconds'));
                }, 30000);
            });
            
            console.log('Calling createContractorInvitation...');
            const invitationPromise = createContractorInvitation(
                contractorInfo,
                recordsWithUploadedAttachments,
                customerEmail || null
            );
            
            result = await Promise.race([invitationPromise, timeoutPromise]);
            console.log('STEP 3 COMPLETE: Invitation created!', result);
        } catch (firestoreError) {
            console.error('STEP 3 FAILED:', firestoreError.code, firestoreError.message);
            console.error('Full error:', firestoreError);
            toast.dismiss(loadingToast);
            toast.error('Failed to save invitation: ' + firestoreError.message);
            setIsSubmitting(false);
            return;
        }
        
        // ============================================
        // CHANGE 3: Link invitation to contractor's Pro account (if logged in)
        // ============================================
        if (isContractorLoggedIn && contractorUser?.uid && result?.inviteId) {
            console.log('STEP 4: Linking invitation to contractor account...');
            try {
                await linkInvitationToContractor(contractorUser.uid, {
                    inviteId: result.inviteId,
                    claimToken: result.claimToken,
                    link: result.link,
                    recordCount: recordsWithUploadedAttachments.length,
                    recordSummary: recordsWithUploadedAttachments.slice(0, 5).map(r => ({
                        item: r.item,
                        category: r.category
                    })),
                    totalValue: recordsWithUploadedAttachments.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0),
                    recipientEmail: customerEmail || null
                });
                console.log('STEP 4 COMPLETE: Invitation linked to contractor account');
            } catch (linkError) {
                // Don't fail the invitation creation if linking fails
                console.warn('STEP 4 WARNING: Could not link to contractor account:', linkError);
            }
        }
        
        // ============================================
        // SUCCESS
        // ============================================
        console.log('=== handleSubmit SUCCESS ===');
        toast.dismiss(loadingToast);
        toast.success('Invitation created!');
        setCreatedLink(result.link);
        
    } catch (error) {
        console.error('=== handleSubmit UNEXPECTED ERROR ===', error);
        toast.dismiss(loadingToast);
        toast.error('Failed to create invitation: ' + (error.message || 'Unknown error'));
    } finally {
        console.log('=== handleSubmit END ===');
        setIsSubmitting(false);
    }
};
    
    const handleCreateAnother = () => {
        setCreatedLink(null);
        setInvoiceFile(null);
        setInvoicePreview(null);
        setContractorInfo({ name: '', company: '', phone: '', email: '' });
        setRecords([{
            item: '',
            category: '',
            area: '',
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
            maintenanceTasks: [],
            attachments: []
        }]);
        setCustomerEmail('');
    };
    
    // Show success state if link was created
    if (createdLink) {
        return <SuccessState inviteLink={createdLink} onCreateAnother={handleCreateAnother} />;
    }

    // ADDED: Back to Dashboard Handler
    // FIX: Explicitly navigate to the base URL which loads ContractorProApp
    const handleBackToDashboard = () => {
        // Clear all search params to return to the clean dashboard URL
        window.location.href = window.location.origin + window.location.pathname;
    };
    
    // DARK MODE FIX: Added 'contractor-page' class to force light mode
    return (
        <div className="contractor-page min-h-screen bg-slate-50">
            <Toaster position="top-center" />
            
            {/* Header */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
                    {/* ADDED: Back Button */}
                    <button 
                        onClick={handleBackToDashboard}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} />
                    </button>

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
                <form onSubmit={handleSubmit} noValidate>
                    {/* Invoice Upload Section */}
                    <InvoiceUploadSection 
                        onInvoiceParsed={handleInvoiceParsed}
                    />
                    
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
                    
                    {/* Contractor Info Section */}
                    <Section title="Your Information" icon={Building2}>
                        <div className="grid grid-cols-2 gap-4 pt-4">
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
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
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
                    </Section>
                    
                    {/* Customer Email Section */}
                    <Section title="Customer Email" icon={Mail} defaultOpen={false} badge="Optional">
                        <div className="pt-4">
                            <p className="text-sm text-slate-500 mb-3">
                                If provided, only this email address will be able to claim the invitation. 
                                Leave blank to allow anyone with the link.
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
                            type="button"
                            disabled={isSubmitting}
                            onClick={(e) => handleSubmit(e)}
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
