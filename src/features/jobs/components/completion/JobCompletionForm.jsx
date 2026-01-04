// src/features/jobs/components/completion/JobCompletionForm.jsx
// ============================================
// JOB COMPLETION FORM - CONTRACTOR SIDE
// ============================================
// Allows contractors to submit job completion with photos, notes, and items
// NOW WITH: Pre-population of items from quote data

import React, { useState, useRef, useEffect } from 'react';
import {
    X, Camera, Upload, FileText, Plus, Trash2, CheckCircle,
    Loader2, Image, AlertCircle, DollarSign, Wrench, Calendar,
    ClipboardList, MessageSquare, ChevronDown, ChevronUp, Sparkles, Edit3
} from 'lucide-react';
import { 
    submitJobCompletion, 
    uploadCompletionPhoto, 
    uploadInvoiceFile 
} from '../../lib/jobCompletionService';
import toast from 'react-hot-toast';

// ============================================
// CONSTANTS
// ============================================
const PHOTO_TYPES = [
    { id: 'before', label: 'Before', icon: '📷' },
    { id: 'after', label: 'After', icon: '✨' },
    { id: 'work', label: 'Work in Progress', icon: '🔧' }
];

const CATEGORIES = [
    "HVAC & Systems",
    "Plumbing",
    "Electrical",
    "Appliances",
    "Roof & Exterior",
    "Interior",
    "Service & Repairs",
    "Other"
];

const MAINTENANCE_FREQUENCIES = [
    { value: 'none', label: 'No regular maintenance' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly (every 3 months)' },
    { value: 'semiannual', label: 'Semi-annual (every 6 months)' },
    { value: 'annual', label: 'Annual (yearly)' }
];

// ============================================
// HELPER: Map quote items to completion items
// ============================================
const mapQuoteItemsToCompletionItems = (quoteItems) => {
    if (!quoteItems || !Array.isArray(quoteItems)) return [];
    
    return quoteItems.map((qItem, idx) => ({
        id: `quote_item_${Date.now()}_${idx}`,
        // Core fields from quote
        item: qItem.description || qItem.item || qItem.name || '',
        category: qItem.category || 'Service & Repairs',
        area: qItem.area || qItem.location || '',
        brand: qItem.brand || '',
        model: qItem.model || '',
        cost: qItem.cost || qItem.price || qItem.amount || null,
        // These need to be filled in by contractor at completion
        serialNumber: qItem.serialNumber || '',
        warranty: qItem.warranty || '',
        maintenanceFrequency: qItem.maintenanceFrequency || 'none',
        dateInstalled: new Date().toISOString().split('T')[0],
        // Track that this came from quote
        fromQuote: true,
        quoteLineId: qItem.id || null
    }));
};

// ============================================
// MAIN COMPONENT
// ============================================
export const JobCompletionForm = ({ job, contractorId, onClose, onSuccess }) => {
    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeSection, setActiveSection] = useState('photos');
    
    // Photos
    const [photos, setPhotos] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef(null);
    const [selectedPhotoType, setSelectedPhotoType] = useState('after');
    
    // Invoice
    const [invoice, setInvoice] = useState(null);
    const [uploadingInvoice, setUploadingInvoice] = useState(false);
    const invoiceInputRef = useRef(null);
    
    // Items installed - NOW PRE-POPULATED FROM QUOTE
    const [items, setItems] = useState([]);
    const [showAddItem, setShowAddItem] = useState(false);
    const [hasLoadedQuoteItems, setHasLoadedQuoteItems] = useState(false);
    
    // Notes
    const [notes, setNotes] = useState('');
    const [recommendations, setRecommendations] = useState('');
    
    // ============================================
    // PRE-POPULATE ITEMS FROM QUOTE
    // ============================================
    useEffect(() => {
        // Only run once when component mounts
        if (hasLoadedQuoteItems) return;
        
        // Check for quote items on the job
        const quoteItems = job?.quoteItems || job?.estimate?.lineItems || job?.quote?.items;
        
        if (quoteItems && quoteItems.length > 0) {
            const mappedItems = mapQuoteItemsToCompletionItems(quoteItems);
            setItems(mappedItems);
            
            // Show helpful toast
            toast.success(
                `${mappedItems.length} item${mappedItems.length > 1 ? 's' : ''} pre-filled from quote!`,
                { icon: '✨', duration: 4000 }
            );
        }
        
        setHasLoadedQuoteItems(true);
    }, [job, hasLoadedQuoteItems]);
    
    // ============================================
    // PHOTO HANDLERS
    // ============================================
    const handlePhotoSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setUploadingPhoto(true);
        const loadingToast = toast.loading('Uploading photos...');
        
        try {
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    toast.error(`${file.name} is too large (max 10MB)`);
                    continue;
                }
                
                const result = await uploadCompletionPhoto(job.id, file, selectedPhotoType);
                setPhotos(prev => [...prev, {
                    ...result,
                    type: selectedPhotoType,
                    caption: ''
                }]);
            }
            toast.dismiss(loadingToast);
            toast.success('Photos uploaded!');
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error('Failed to upload photos');
            console.error(error);
        } finally {
            setUploadingPhoto(false);
        }
    };
    
    const handleRemovePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };
    
    const handlePhotoCaption = (index, caption) => {
        setPhotos(prev => prev.map((p, i) => i === index ? { ...p, caption } : p));
    };
    
    // ============================================
    // INVOICE HANDLERS
    // ============================================
    const handleInvoiceSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.size > 15 * 1024 * 1024) {
            toast.error('Invoice file too large (max 15MB)');
            return;
        }
        
        setUploadingInvoice(true);
        const loadingToast = toast.loading('Uploading invoice...');
        
        try {
            const result = await uploadInvoiceFile(job.id, file, contractorId);
            setInvoice(result);
            toast.dismiss(loadingToast);
            toast.success('Invoice uploaded!');
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error('Failed to upload invoice');
            console.error(error);
        } finally {
            setUploadingInvoice(false);
        }
    };
    
    // ============================================
    // ITEM HANDLERS
    // ============================================
    const handleAddItem = (newItem) => {
        setItems(prev => [...prev, {
            ...newItem,
            id: `item_${Date.now()}`
        }]);
        setShowAddItem(false);
        toast.success('Item added!');
    };
    
    const handleRemoveItem = (itemId) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
    };
    
    const handleUpdateItem = (itemId, updates) => {
        setItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, ...updates } : item
        ));
    };
    
    // ============================================
    // SUBMIT
    // ============================================
    const handleSubmit = async () => {
        if (photos.length === 0) {
            toast.error('Please add at least one photo');
            setActiveSection('photos');
            return;
        }
        
        setIsSubmitting(true);
        const loadingToast = toast.loading('Submitting completion...');
        
        try {
            await submitJobCompletion(job.id, {
                photos,
                invoice,
                items,
                notes,
                recommendations
            }, contractorId);
            
            toast.dismiss(loadingToast);
            toast.success('Job completion submitted!', { icon: '🎉' });
            
            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Failed to submit completion');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                onClick={onClose} 
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">Complete Job</h2>
                        <p className="text-emerald-100 text-sm mt-0.5">
                            {job.description || job.title || 'Service Request'}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>
                
                {/* Progress Indicator */}
                <div className="px-6 py-3 bg-gray-50 border-b flex gap-2">
                    {[
                        { id: 'photos', label: 'Photos', icon: Camera },
                        { id: 'items', label: 'Items', icon: Wrench },
                        { id: 'notes', label: 'Notes', icon: MessageSquare },
                        { id: 'review', label: 'Review', icon: ClipboardList }
                    ].map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                activeSection === section.id
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <section.icon className="w-4 h-4" />
                            {section.label}
                            {section.id === 'items' && items.length > 0 && (
                                <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                                    {items.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* PHOTOS SECTION */}
                    {activeSection === 'photos' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">Completion Photos</h3>
                                <span className="text-sm text-gray-500">{photos.length} uploaded</span>
                            </div>
                            
                            {/* Photo Type Selector */}
                            <div className="flex gap-2">
                                {PHOTO_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setSelectedPhotoType(type.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                            selectedPhotoType === type.id
                                                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span>{type.icon}</span>
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Upload Button */}
                            <div
                                onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                                    uploadingPhoto 
                                        ? 'border-gray-300 bg-gray-50' 
                                        : 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50'
                                }`}
                            >
                                {uploadingPhoto ? (
                                    <Loader2 className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
                                ) : (
                                    <>
                                        <Camera className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                        <p className="text-gray-600 font-medium">
                                            Click to upload {PHOTO_TYPES.find(t => t.id === selectedPhotoType)?.label} photos
                                        </p>
                                        <p className="text-gray-400 text-sm mt-1">PNG, JPG up to 10MB</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoSelect}
                                className="hidden"
                            />
                            
                            {/* Photo Grid */}
                            {photos.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {photos.map((photo, idx) => (
                                        <div key={idx} className="relative group">
                                            <img
                                                src={photo.url}
                                                alt={`Completion photo ${idx + 1}`}
                                                className="w-full h-32 object-cover rounded-lg"
                                            />
                                            <div className="absolute top-2 left-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                    photo.type === 'before' ? 'bg-orange-100 text-orange-700' :
                                                    photo.type === 'after' ? 'bg-green-100 text-green-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {PHOTO_TYPES.find(t => t.id === photo.type)?.label}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleRemovePhoto(idx)}
                                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                            <input
                                                type="text"
                                                placeholder="Add caption..."
                                                value={photo.caption}
                                                onChange={(e) => handlePhotoCaption(idx, e.target.value)}
                                                className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 rounded-b-lg"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Invoice Upload */}
                            <div className="mt-6 pt-6 border-t">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Invoice (Optional)
                                </h4>
                                
                                {invoice ? (
                                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                            <span className="text-sm font-medium text-green-800">
                                                {invoice.fileName}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setInvoice(null)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => !uploadingInvoice && invoiceInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                                            uploadingInvoice
                                                ? 'border-gray-300 bg-gray-50'
                                                : 'border-gray-300 hover:border-emerald-500 hover:bg-emerald-50'
                                        }`}
                                    >
                                        {uploadingInvoice ? (
                                            <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 text-gray-500">
                                                <Upload className="w-4 h-4" />
                                                <span className="text-sm">Upload invoice (PDF or image)</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <input
                                    ref={invoiceInputRef}
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={handleInvoiceSelect}
                                    className="hidden"
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* ITEMS SECTION */}
                    {activeSection === 'items' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Items Installed</h3>
                                    <p className="text-sm text-gray-500">
                                        These will be added to the customer's home inventory
                                    </p>
                                </div>
                            </div>
                            
                            {/* Quote Items Banner */}
                            {items.some(i => i.fromQuote) && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-emerald-800">
                                                Items pre-filled from quote
                                            </p>
                                            <p className="text-sm text-emerald-700 mt-1">
                                                Please add serial numbers, warranty info, and any other details now that the work is complete.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Items List */}
                            {items.length > 0 ? (
                                <div className="space-y-3">
                                    {items.map((item) => (
                                        <ItemCard 
                                            key={item.id} 
                                            item={item} 
                                            onRemove={() => handleRemoveItem(item.id)}
                                            onUpdate={(updates) => handleUpdateItem(item.id, updates)}
                                            isFromQuote={item.fromQuote}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-gray-50 rounded-xl">
                                    <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500">No items added yet</p>
                                    <p className="text-gray-400 text-sm">
                                        Add equipment or parts you installed
                                    </p>
                                </div>
                            )}
                            
                            {/* Add Item Button/Form */}
                            {showAddItem ? (
                                <AddItemForm 
                                    onAdd={handleAddItem}
                                    onCancel={() => setShowAddItem(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowAddItem(true)}
                                    className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-600 font-medium hover:bg-emerald-50 hover:border-emerald-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Item
                                </button>
                            )}
                            
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                                <p className="text-amber-800 text-sm">
                                    <AlertCircle className="w-4 h-4 inline mr-1" />
                                    Tip: Adding items with serial numbers and warranty info helps homeowners track their equipment.
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* NOTES SECTION */}
                    {activeSection === 'notes' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block font-medium text-gray-900 mb-2">
                                    Completion Notes
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Describe the work completed, any issues found, etc..."
                                    rows={4}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                                />
                            </div>
                            
                            <div>
                                <label className="block font-medium text-gray-900 mb-2">
                                    Recommendations (Optional)
                                </label>
                                <textarea
                                    value={recommendations}
                                    onChange={(e) => setRecommendations(e.target.value)}
                                    placeholder="Any recommendations for the homeowner? Future maintenance, upgrades to consider, etc..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                                />
                            </div>
                        </div>
                    )}
                    
                    {/* REVIEW SECTION */}
                    {activeSection === 'review' && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-gray-900">Review & Submit</h3>
                            
                            {/* Summary */}
                            <div className="space-y-4">
                                {/* Photos Summary */}
                                <div className={`p-4 rounded-xl border ${photos.length > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex items-center gap-3">
                                        {photos.length > 0 ? (
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-red-600" />
                                        )}
                                        <div>
                                            <p className={`font-medium ${photos.length > 0 ? 'text-green-800' : 'text-red-800'}`}>
                                                {photos.length} Photo{photos.length !== 1 ? 's' : ''}
                                            </p>
                                            {photos.length === 0 && (
                                                <p className="text-sm text-red-600">At least 1 photo required</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Invoice Summary */}
                                <div className={`p-4 rounded-xl border ${invoice ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-3">
                                        {invoice ? (
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <FileText className="w-5 h-5 text-gray-400" />
                                        )}
                                        <p className={`font-medium ${invoice ? 'text-green-800' : 'text-gray-600'}`}>
                                            {invoice ? invoice.fileName : 'No invoice attached'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Items Summary */}
                                <div className={`p-4 rounded-xl border ${items.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <Wrench className={`w-5 h-5 ${items.length > 0 ? 'text-emerald-600' : 'text-gray-400'}`} />
                                        <div>
                                            <p className={`font-medium ${items.length > 0 ? 'text-emerald-800' : 'text-gray-600'}`}>
                                                {items.length} Item{items.length !== 1 ? 's' : ''} to Import
                                            </p>
                                            {items.length > 0 && (
                                                <p className="text-sm text-emerald-700">
                                                    {items.map(i => i.item).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Notes Summary */}
                                {notes && (
                                    <div className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-blue-800">Notes</p>
                                                <p className="text-sm text-blue-700 mt-1 line-clamp-2">{notes}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* What happens next */}
                            <div className="bg-gray-50 rounded-xl p-4 mt-6">
                                <h4 className="font-medium text-gray-900 mb-2">What happens next?</h4>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• The homeowner will be notified to review your completion</li>
                                    <li>• Items will be added to their home inventory when they approve</li>
                                    <li>• If they don't respond within 7 days, the job will auto-complete</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                        Cancel
                    </button>
                    
                    <div className="flex items-center gap-3">
                        {activeSection !== 'review' ? (
                            <button
                                onClick={() => {
                                    const sections = ['photos', 'items', 'notes', 'review'];
                                    const currentIdx = sections.indexOf(activeSection);
                                    if (currentIdx < sections.length - 1) {
                                        setActiveSection(sections[currentIdx + 1]);
                                    }
                                }}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || photos.length === 0}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        Submit Completion
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ITEM CARD COMPONENT (ENHANCED FOR EDITING)
// ============================================
const ItemCard = ({ item, onRemove, onUpdate, isFromQuote }) => {
    const [expanded, setExpanded] = useState(isFromQuote); // Auto-expand items from quote
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({
        serialNumber: item.serialNumber || '',
        warranty: item.warranty || '',
        maintenanceFrequency: item.maintenanceFrequency || 'none'
    });
    
    const handleSave = () => {
        onUpdate(editData);
        setEditing(false);
        toast.success('Item updated!');
    };
    
    return (
        <div className={`border rounded-xl overflow-hidden ${isFromQuote ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`}>
            <div 
                className="flex items-center justify-between p-4 bg-white cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isFromQuote ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        <Wrench className={`w-5 h-5 ${isFromQuote ? 'text-emerald-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{item.item}</p>
                            {isFromQuote && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    From Quote
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">
                            {item.brand} {item.model && `• ${item.model}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
            </div>
            
            {expanded && (
                <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
                    {editing ? (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Serial Number</label>
                                <input
                                    type="text"
                                    value={editData.serialNumber}
                                    onChange={(e) => setEditData(prev => ({ ...prev, serialNumber: e.target.value }))}
                                    placeholder="Enter serial number"
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Warranty Info</label>
                                <input
                                    type="text"
                                    value={editData.warranty}
                                    onChange={(e) => setEditData(prev => ({ ...prev, warranty: e.target.value }))}
                                    placeholder="e.g., 10 year parts, 1 year labor"
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Maintenance</label>
                                <select
                                    value={editData.maintenanceFrequency}
                                    onChange={(e) => setEditData(prev => ({ ...prev, maintenanceFrequency: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                                >
                                    {MAINTENANCE_FREQUENCIES.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {item.serialNumber && (
                                    <div>
                                        <span className="text-gray-500">Serial #:</span>
                                        <span className="ml-2 text-gray-900">{item.serialNumber}</span>
                                    </div>
                                )}
                                {item.category && (
                                    <div>
                                        <span className="text-gray-500">Category:</span>
                                        <span className="ml-2 text-gray-900">{item.category}</span>
                                    </div>
                                )}
                                {item.cost && (
                                    <div>
                                        <span className="text-gray-500">Cost:</span>
                                        <span className="ml-2 text-gray-900">${item.cost}</span>
                                    </div>
                                )}
                                {item.warranty && (
                                    <div>
                                        <span className="text-gray-500">Warranty:</span>
                                        <span className="ml-2 text-gray-900">{item.warranty}</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Prompt to add missing details */}
                            {isFromQuote && (!item.serialNumber || !item.warranty) && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                        Add serial number & warranty details
                                    </button>
                                </div>
                            )}
                            
                            {!isFromQuote && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                                    className="mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
                                >
                                    <Edit3 className="w-3 h-3" />
                                    Edit details
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// ADD ITEM FORM COMPONENT
// ============================================
const AddItemForm = ({ onAdd, onCancel }) => {
    const [formData, setFormData] = useState({
        item: '',
        brand: '',
        model: '',
        serialNumber: '',
        category: 'HVAC & Systems',
        area: '',
        cost: '',
        warranty: '',
        maintenanceFrequency: 'none'
    });
    
    const handleSubmit = () => {
        if (!formData.item.trim()) {
            toast.error('Please enter an item name');
            return;
        }
        onAdd({
            ...formData,
            cost: formData.cost ? parseFloat(formData.cost) : null,
            dateInstalled: new Date().toISOString().split('T')[0]
        });
    };
    
    return (
        <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/50">
            <h4 className="font-medium text-gray-900 mb-4">Add Item</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Name *
                    </label>
                    <input
                        type="text"
                        value={formData.item}
                        onChange={(e) => setFormData(prev => ({ ...prev, item: e.target.value }))}
                        placeholder="e.g., Carrier AC Unit"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                        placeholder="e.g., Carrier"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        placeholder="Model number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                    <input
                        type="text"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                        placeholder="Serial number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location/Area</label>
                    <input
                        type="text"
                        value={formData.area}
                        onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                        placeholder="e.g., Garage, Attic"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
                    <input
                        type="number"
                        value={formData.cost}
                        onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                    <input
                        type="text"
                        value={formData.warranty}
                        onChange={(e) => setFormData(prev => ({ ...prev, warranty: e.target.value }))}
                        placeholder="e.g., 10 year parts, 1 year labor"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                
                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Schedule</label>
                    <select
                        value={formData.maintenanceFrequency}
                        onChange={(e) => setFormData(prev => ({ ...prev, maintenanceFrequency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        {MAINTENANCE_FREQUENCIES.map(freq => (
                            <option key={freq.value} value={freq.value}>{freq.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            
            <div className="flex gap-3 mt-4">
                <button
                    onClick={handleSubmit}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Item
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default JobCompletionForm;
