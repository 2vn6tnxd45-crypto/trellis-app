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
    ClipboardList, MessageSquare, ChevronDown, ChevronUp, Sparkles, Edit3,
    Home, Clock, CheckSquare, Square, Receipt
} from 'lucide-react';
import { Select } from '../../../../components/ui/Select';
import {
    submitJobCompletion,
    uploadCompletionPhoto,
    uploadInvoiceFile
} from '../../lib/jobCompletionService';
import toast from 'react-hot-toast';

// Helper to format currency
const formatCurrency = (amount) => {
    if (amount == null || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

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
// ============================================
// HELPER: Map inventory intents to completion items
// ============================================
// This is the NEW preferred method - uses rich data from quote's inventoryIntents
const mapInventoryIntentsToCompletionItems = (inventoryIntents) => {
    if (!inventoryIntents || !Array.isArray(inventoryIntents) || inventoryIntents.length === 0) {
        return null; // Return null to signal fallback needed
    }

    return inventoryIntents.map((intent, idx) => ({
        id: intent.id || `intent_${Date.now()}_${idx}`,
        // Core fields - already rich from quote
        item: intent.item || '',
        category: intent.category || 'Service & Repairs',
        area: intent.area || '',
        brand: intent.brand || '',
        model: intent.model || '',
        cost: intent.cost || null,

        // These need to be filled in by contractor at completion
        serialNumber: intent.serialNumber || '',
        warranty: intent.warranty || '',
        warrantyDetails: intent.warrantyDetails || null,

        // MAINTENANCE TASKS - the key differentiator!
        maintenanceTasks: intent.maintenanceTasks || [],
        maintenanceFrequency: intent.maintenanceFrequency ||
            getOverallFrequency(intent.maintenanceTasks),

        // Completion fields
        dateInstalled: new Date().toISOString().split('T')[0],

        // Tracking
        fromInventoryIntent: true,
        fromQuote: true,
        inventoryIntentId: intent.id,
        linkedLineItemId: intent.linkedLineItemId
    }));
};

// Helper to get overall frequency from tasks
const getOverallFrequency = (tasks) => {
    if (!tasks || tasks.length === 0) return 'none';
    const selectedTasks = tasks.filter(t => t.selected !== false);
    if (selectedTasks.length === 0) return 'none';

    // Find shortest interval
    const monthValues = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
    let shortest = 'annual';
    let shortestMonths = 12;

    selectedTasks.forEach(task => {
        const months = task.months || monthValues[task.frequency] || 12;
        if (months < shortestMonths) {
            shortestMonths = months;
            shortest = task.frequency || 'annual';
        }
    });

    return shortest;
};

// ============================================
// HELPER: Map quote items to completion items (LEGACY FALLBACK)
// ============================================
// Used when inventoryIntents don't exist (older quotes)
const mapQuoteItemsToCompletionItems = (quoteItems) => {
    if (!quoteItems || !Array.isArray(quoteItems)) return [];

    return quoteItems.map((qItem, idx) => {
        // Calculate total cost from unitPrice * quantity if available
        const quantity = qItem.quantity || 1;
        const unitPrice = qItem.unitPrice || qItem.price || 0;
        const totalCost = qItem.cost || qItem.amount || (unitPrice * quantity) || null;

        return {
            id: `quote_item_${Date.now()}_${idx}`,
            // Core fields from quote - handle various field name conventions
            item: qItem.description || qItem.item || qItem.name || '',
            category: qItem.category || 'Service & Repairs',
            area: qItem.area || qItem.location || '',
            brand: qItem.brand || '',
            model: qItem.model || '',
            cost: totalCost,
            quantity: quantity,
            // These need to be filled in by contractor at completion
            serialNumber: qItem.serialNumber || '',
            warranty: qItem.warranty || qItem.clientWarranty || '',
            maintenanceFrequency: qItem.maintenanceFrequency || 'none',
            maintenanceTasks: [], // Empty for legacy items
            dateInstalled: new Date().toISOString().split('T')[0],
            // Track that this came from quote
            fromQuote: true,
            fromInventoryIntent: false,
            quoteLineId: qItem.id || null
        };
    });
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
    // PRE-POPULATE ITEMS FROM INVENTORY INTENTS (OR LEGACY QUOTE ITEMS)
    // ============================================
    useEffect(() => {
        // Only run once when component mounts
        if (hasLoadedQuoteItems) return;

        // DEBUG: Log what data we have on the job
        console.log('🔍 [JobCompletionForm] Job data for pre-population:', {
            jobId: job?.id,
            jobNumber: job?.jobNumber,
            sourceType: job?.sourceType,
            sourceQuoteId: job?.sourceQuoteId,
            sourceQuoteNumber: job?.sourceQuoteNumber,
            hasInventoryIntents: Boolean(job?.inventoryIntents),
            inventoryIntentsCount: job?.inventoryIntents?.length || 0,
            hasLineItems: Boolean(job?.lineItems),
            lineItemsCount: job?.lineItems?.length || 0,
            subtotal: job?.subtotal,
            total: job?.total,
            fullJobKeys: job ? Object.keys(job) : []
        });

        // PREFERRED: Check for inventory intents first (new system)
        // These have full maintenance tasks, warranty details, etc.
        const inventoryIntents = job?.inventoryIntents;

        if (inventoryIntents && inventoryIntents.length > 0) {
            const mappedItems = mapInventoryIntentsToCompletionItems(inventoryIntents);
            if (mappedItems && mappedItems.length > 0) {
                setItems(mappedItems);

                // Count total maintenance tasks
                const totalTasks = mappedItems.reduce((sum, item) =>
                    sum + (item.maintenanceTasks?.filter(t => t.selected !== false).length || 0), 0
                );

                toast.success(
                    `${mappedItems.length} item${mappedItems.length > 1 ? 's' : ''} pre-filled with ${totalTasks} maintenance task${totalTasks !== 1 ? 's' : ''}!`,
                    { icon: '✨', duration: 4000 }
                );

                setHasLoadedQuoteItems(true);
                return;
            }
        }

        // FALLBACK: Legacy system - map from line items
        const quoteItems = job?.lineItems || job?.quoteItems || job?.estimate?.lineItems || job?.quote?.items;

        if (quoteItems && quoteItems.length > 0) {
            // Only map items that were flagged for home record (if that field exists)
            // Otherwise map all items (legacy behavior)
            const itemsToMap = quoteItems.some(i => i.addToHomeRecord !== undefined)
                ? quoteItems.filter(i => i.addToHomeRecord)
                : quoteItems;

            if (itemsToMap.length > 0) {
                const mappedItems = mapQuoteItemsToCompletionItems(itemsToMap);
                setItems(mappedItems);

                toast.success(
                    `${mappedItems.length} item${mappedItems.length > 1 ? 's' : ''} pre-filled from quote!`,
                    { icon: '✨', duration: 4000 }
                );
                setHasLoadedQuoteItems(true);
                return;
            }
        }

        // If we get here, no items were pre-populated
        // Log a warning if this job came from a quote but has no items
        if (job?.sourceQuoteId || job?.sourceType === 'quote') {
            console.warn('⚠️ [JobCompletionForm] Job originated from quote but no items found to pre-populate:', {
                sourceQuoteId: job?.sourceQuoteId,
                sourceQuoteNumber: job?.sourceQuoteNumber,
                inventoryIntents: job?.inventoryIntents,
                lineItems: job?.lineItems
            });
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
            const result = await submitJobCompletion(job.id, {
                photos,
                invoice,
                items,
                notes,
                recommendations
            }, contractorId);

            toast.dismiss(loadingToast);
            toast.success('Job completion submitted!', { icon: '🎉' });

            // Show invoice notification if one was auto-generated
            if (result.invoiceGenerated) {
                setTimeout(() => {
                    toast.success(
                        `Draft invoice ${result.invoiceNumber} created! Review it in your Invoices tab.`,
                        { icon: '📄', duration: 5000 }
                    );
                }, 1000);
            }

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

                {/* Quote Summary Banner - Shows original quote data for reference */}
                {(job.sourceQuoteId || job.lineItems?.length > 0 || job.total > 0) && (
                    <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Receipt className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-blue-900">
                                        {job.sourceQuoteNumber ? `Quote #${job.sourceQuoteNumber}` : 'Original Quote'}
                                    </span>
                                    {job.lineItems?.length > 0 && (
                                        <span className="text-blue-600">
                                            • {job.lineItems.length} item{job.lineItems.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {job.inventoryIntents?.length > 0 && (
                                        <span className="text-indigo-600 font-medium">
                                            • {job.inventoryIntents.length} for home record
                                        </span>
                                    )}
                                </div>
                                {job.total > 0 && (
                                    <div className="text-xs text-blue-700 mt-0.5">
                                        Total: {formatCurrency(job.total)}
                                        {job.subtotal && job.subtotal !== job.total && (
                                            <span className="text-blue-500 ml-2">
                                                (Subtotal: {formatCurrency(job.subtotal)} + Tax: {formatCurrency(job.taxAmount || 0)})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Indicator */}
                <div className="px-6 py-3 bg-gray-50 border-b flex gap-2 flex-wrap">
                    {[
                        { id: 'photos', label: 'Photos', icon: Camera },
                        { id: 'items', label: 'Items', icon: Wrench },
                        { id: 'notes', label: 'Notes', icon: MessageSquare },
                        { id: 'review', label: 'Review', icon: ClipboardList }
                    ].map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${activeSection === section.id
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
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedPhotoType === type.id
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
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${uploadingPhoto
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
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${photo.type === 'before' ? 'bg-orange-100 text-orange-700' :
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
                                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${uploadingInvoice
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
                                                {items.some(i => i.fromInventoryIntent)
                                                    ? 'Maintenance schedules are ready! Just add serial numbers to complete.'
                                                    : 'Please add serial numbers, warranty info, and any other details now that the work is complete.'
                                                }
                                            </p>
                                            {/* Show maintenance task summary */}
                                            {items.some(i => i.maintenanceTasks?.length > 0) && (
                                                <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
                                                    <Home className="w-4 h-4" />
                                                    <span>
                                                        {items.reduce((sum, item) =>
                                                            sum + (item.maintenanceTasks?.filter(t => t.selected !== false).length || 0), 0
                                                        )} maintenance tasks will be set up for the homeowner
                                                    </span>
                                                </div>
                                            )}
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
// ============================================
// ITEM CARD COMPONENT (ENHANCED WITH MAINTENANCE TASKS)
// ============================================
const ItemCard = ({ item, onRemove, onUpdate, isFromQuote }) => {
    const [expanded, setExpanded] = useState(isFromQuote); // Auto-expand items from quote
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({
        serialNumber: item.serialNumber || '',
        warranty: item.warranty || '',
        maintenanceFrequency: item.maintenanceFrequency || 'none',
        maintenanceTasks: item.maintenanceTasks || []
    });

    const hasMaintenanceTasks = item.maintenanceTasks && item.maintenanceTasks.length > 0;
    const selectedTaskCount = hasMaintenanceTasks
        ? item.maintenanceTasks.filter(t => t.selected !== false).length
        : 0;

    const handleSave = () => {
        onUpdate(editData);
        setEditing(false);
        toast.success('Item updated!');
    };

    const toggleTask = (taskIndex) => {
        const updatedTasks = [...editData.maintenanceTasks];
        updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            selected: updatedTasks[taskIndex].selected === false ? true : false
        };
        setEditData(prev => ({ ...prev, maintenanceTasks: updatedTasks }));
    };

    return (
        <div className={`border rounded-xl overflow-hidden ${item.fromInventoryIntent
                ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/50 to-green-50/30'
                : isFromQuote
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-gray-200'
            }`}>
            <div
                className="flex items-center justify-between p-4 bg-white cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.fromInventoryIntent
                            ? 'bg-emerald-100'
                            : isFromQuote
                                ? 'bg-emerald-100'
                                : 'bg-gray-100'
                        }`}>
                        {item.fromInventoryIntent ? (
                            <Home className="w-5 h-5 text-emerald-600" />
                        ) : (
                            <Wrench className={`w-5 h-5 ${isFromQuote ? 'text-emerald-600' : 'text-gray-600'}`} />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{item.item}</p>
                            {item.fromInventoryIntent && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                                    <Home className="w-3 h-3" />
                                    Home Record
                                </span>
                            )}
                            {isFromQuote && !item.fromInventoryIntent && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    From Quote
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">
                            {item.brand} {item.model && `• ${item.model}`}
                            {hasMaintenanceTasks && selectedTaskCount > 0 && (
                                <span className="ml-2 text-emerald-600">
                                    • {selectedTaskCount} maintenance task{selectedTaskCount !== 1 ? 's' : ''}
                                </span>
                            )}
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

                            {/* Maintenance Tasks - Editable */}
                            {editData.maintenanceTasks && editData.maintenanceTasks.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-2">
                                        Maintenance Tasks for Homeowner
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {editData.maintenanceTasks.map((task, idx) => (
                                            <button
                                                key={task.id || idx}
                                                type="button"
                                                onClick={() => toggleTask(idx)}
                                                className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${task.selected !== false
                                                        ? 'bg-emerald-50 border border-emerald-200'
                                                        : 'bg-gray-100 border border-gray-200'
                                                    }`}
                                            >
                                                {task.selected !== false ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${task.selected !== false ? 'text-emerald-800' : 'text-gray-500'
                                                        }`}>
                                                        {task.task}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {task.frequency}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Legacy frequency selector (only show if no tasks) */}
                            {(!editData.maintenanceTasks || editData.maintenanceTasks.length === 0) && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Maintenance</label>
                                    <Select
                                        value={editData.maintenanceFrequency}
                                        onChange={(val) => setEditData(prev => ({ ...prev, maintenanceFrequency: val }))}
                                        options={MAINTENANCE_FREQUENCIES}
                                    />
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => {
                                        setEditData({
                                            serialNumber: item.serialNumber || '',
                                            warranty: item.warranty || '',
                                            maintenanceFrequency: item.maintenanceFrequency || 'none',
                                            maintenanceTasks: item.maintenanceTasks || []
                                        });
                                        setEditing(false);
                                    }}
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
                                {item.area && (
                                    <div>
                                        <span className="text-gray-500">Location:</span>
                                        <span className="ml-2 text-gray-900">{item.area}</span>
                                    </div>
                                )}
                                {item.cost && (
                                    <div>
                                        <span className="text-gray-500">Cost:</span>
                                        <span className="ml-2 text-gray-900">${item.cost}</span>
                                    </div>
                                )}
                                {item.warranty && (
                                    <div className="col-span-2">
                                        <span className="text-gray-500">Warranty:</span>
                                        <span className="ml-2 text-gray-900">{item.warranty}</span>
                                    </div>
                                )}
                            </div>

                            {/* Maintenance Tasks Display (Read-only) */}
                            {hasMaintenanceTasks && selectedTaskCount > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Maintenance Schedule for Homeowner
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {item.maintenanceTasks
                                            .filter(t => t.selected !== false)
                                            .slice(0, 4)
                                            .map((task, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-full"
                                                >
                                                    {task.task} ({task.frequency})
                                                </span>
                                            ))
                                        }
                                        {item.maintenanceTasks.filter(t => t.selected !== false).length > 4 && (
                                            <span className="px-2 py-1 text-xs text-gray-500">
                                                +{item.maintenanceTasks.filter(t => t.selected !== false).length - 4} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Prompt to add missing details */}
                            {isFromQuote && (!item.serialNumber || (!item.warranty && !hasMaintenanceTasks)) && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                        {!item.serialNumber ? 'Add serial number' : 'Edit details'}
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

                            {/* Edit button for items with tasks */}
                            {isFromQuote && item.serialNumber && hasMaintenanceTasks && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                                    className="mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
                                >
                                    <Edit3 className="w-3 h-3" />
                                    Edit details or tasks
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
                    <Select
                        value={formData.category}
                        onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                        options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                    />
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
                    <Select
                        value={formData.maintenanceFrequency}
                        onChange={(val) => setFormData(prev => ({ ...prev, maintenanceFrequency: val }))}
                        options={MAINTENANCE_FREQUENCIES}
                    />
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
