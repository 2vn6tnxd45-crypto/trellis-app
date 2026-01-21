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
    ClipboardList, MessageSquare, ChevronDown, ChevronUp, ChevronRight, Sparkles, Edit3,
    Home, Clock, CheckSquare, Square, Receipt, PenTool, QrCode, CreditCard, Send
} from 'lucide-react';
import { SignatureCapture } from '../../../../components/SignatureCapture';
import { PaymentQRCode } from '../../../../components/PaymentQRCode';
import { Select } from '../../../../components/ui/Select';
import {
    submitJobCompletion,
    uploadCompletionPhoto,
    uploadInvoiceFile
} from '../../lib/jobCompletionService';
import {
    getPhotoRequirements,
    validatePhotoRequirements,
    PHOTO_TYPES as PHOTO_TYPE_ENUMS,
    DEFAULT_PHOTO_REQUIREMENTS
} from '../../lib/jobPhotoService';
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
    const [activeSection, setActiveSection] = useState('invoice');

    // Photos
    const [photos, setPhotos] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef(null);

    // Customer Signature
    const [signatureData, setSignatureData] = useState(null);
    const [requireSignature, setRequireSignature] = useState(true); // Can be configured in settings
    const [selectedPhotoType, setSelectedPhotoType] = useState('after');

    // Photo requirements
    const [photoRequirements, setPhotoRequirements] = useState(DEFAULT_PHOTO_REQUIREMENTS);
    const [beforePhotos, setBeforePhotos] = useState([]); // Photos already taken at job start

    // Invoice - now editable with line items
    const [invoice, setInvoice] = useState(null); // Uploaded invoice file (optional)
    const [uploadingInvoice, setUploadingInvoice] = useState(false);
    const invoiceInputRef = useRef(null);

    // Editable invoice preview state
    const [invoiceLineItems, setInvoiceLineItems] = useState([]);
    const [invoiceTaxRate, setInvoiceTaxRate] = useState(0);
    const [invoiceNotes, setInvoiceNotes] = useState('Thank you for your business!');
    const [hasLoadedInvoiceData, setHasLoadedInvoiceData] = useState(false);

    // Items installed - NOW PRE-POPULATED FROM QUOTE
    const [items, setItems] = useState([]);
    const [showAddItem, setShowAddItem] = useState(false);
    const [hasLoadedQuoteItems, setHasLoadedQuoteItems] = useState(false);

    // Notes
    const [notes, setNotes] = useState('');
    const [recommendations, setRecommendations] = useState('');

    // Field Payment Collection
    const [showPaymentQR, setShowPaymentQR] = useState(false);
    const [paymentCollected, setPaymentCollected] = useState(false);
    const [fieldPaymentMethod, setFieldPaymentMethod] = useState(null); // 'qr', 'later', 'card_on_file'

    // ============================================
    // LOAD PHOTO REQUIREMENTS AND EXISTING PHOTOS
    // ============================================
    useEffect(() => {
        const loadPhotoData = async () => {
            // Load photo requirements from contractor settings
            if (contractorId) {
                try {
                    const reqs = await getPhotoRequirements(contractorId);
                    setPhotoRequirements(reqs);
                } catch (error) {
                    console.error('Error loading photo requirements:', error);
                }
            }

            // Load existing before photos that were taken at job start
            if (job?.beforePhotos && job.beforePhotos.length > 0) {
                setBeforePhotos(job.beforePhotos);
            }
        };
        loadPhotoData();
    }, [contractorId, job]);

    // ============================================
    // PRE-POPULATE INVOICE LINE ITEMS FROM JOB DATA
    // ============================================
    useEffect(() => {
        if (hasLoadedInvoiceData) return;

        // Get line items from job/quote
        const lineItems = job?.lineItems || job?.quoteItems || job?.estimate?.lineItems || [];

        if (lineItems.length > 0) {
            const mappedItems = lineItems.map((item, idx) => {
                const quantity = item.quantity || 1;
                const unitPrice = item.unitPrice || item.price || 0;
                const totalCost = item.amount || item.cost || (unitPrice * quantity);

                return {
                    id: item.id || `line_${Date.now()}_${idx}`,
                    description: item.description || item.item || item.name || 'Service',
                    quantity,
                    unitPrice,
                    amount: totalCost,
                    notes: item.notes || ''
                };
            });
            setInvoiceLineItems(mappedItems);
        }

        // Get tax rate if available
        if (job?.taxRate) {
            setInvoiceTaxRate(job.taxRate);
        }

        setHasLoadedInvoiceData(true);
    }, [job, hasLoadedInvoiceData]);

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
        // Combine before photos (from job start) with completion photos for validation
        const allPhotos = [
            ...beforePhotos.map(p => ({ ...p, type: p.type || PHOTO_TYPE_ENUMS.BEFORE })),
            ...photos
        ];

        // Validate photo requirements
        const validation = validatePhotoRequirements(allPhotos, photoRequirements, 'complete');

        if (!validation.valid) {
            toast.error(validation.errors[0]);
            setActiveSection('photos');
            return;
        }

        // Legacy check: ensure at least 1 photo
        if (photos.length === 0 && beforePhotos.length === 0) {
            toast.error('Please add at least one photo');
            setActiveSection('photos');
            return;
        }

        setIsSubmitting(true);
        const loadingToast = toast.loading('Submitting completion...');

        try {
            // Calculate invoice totals
            const invoiceSubtotal = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
            const invoiceTax = invoiceSubtotal * (invoiceTaxRate / 100);
            const invoiceTotal = invoiceSubtotal + invoiceTax;
            const depositPaid = job.depositAmount || job.depositPaid || job.deposit?.amount || 0;
            const balanceDue = Math.max(0, invoiceTotal - depositPaid);

            const result = await submitJobCompletion(job.id, {
                photos,
                invoice,
                items,
                notes,
                recommendations,
                // Include editable invoice data
                invoiceData: {
                    lineItems: invoiceLineItems,
                    subtotal: invoiceSubtotal,
                    taxRate: invoiceTaxRate,
                    taxAmount: invoiceTax,
                    total: invoiceTotal,
                    depositPaid,
                    balanceDue,
                    notes: invoiceNotes
                },
                // Include signature data if captured
                signature: signatureData ? {
                    signatureImage: signatureData.signatureImage,
                    signerName: signatureData.signerName,
                    signerRelationship: signatureData.signerRelationship,
                    signedAt: signatureData.signedAt,
                    deviceInfo: signatureData.deviceInfo,
                    gpsLocation: signatureData.gpsLocation,
                    legalTextAgreed: signatureData.legalTextAgreed,
                    captureMethod: signatureData.captureMethod || 'digital_signature_pad'
                } : null,
                signatureSkipped: !signatureData && !requireSignature,
                // Include field payment data
                fieldPayment: {
                    collected: paymentCollected,
                    method: fieldPaymentMethod,
                    sendPaymentLink: !paymentCollected && fieldPaymentMethod !== 'cash_check',
                    collectedAt: paymentCollected ? new Date().toISOString() : null
                }
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
                        { id: 'invoice', label: 'Invoice', icon: Receipt },
                        { id: 'photos', label: 'Photos', icon: Camera },
                        { id: 'items', label: 'Items', icon: Wrench },
                        { id: 'notes', label: 'Notes', icon: MessageSquare },
                        { id: 'signature', label: 'Signature', icon: PenTool },
                        { id: 'payment', label: 'Payment', icon: CreditCard },
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
                    {/* INVOICE SECTION - Editable Invoice Preview */}
                    {activeSection === 'invoice' && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-semibold text-gray-900">Invoice Preview</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Review and edit the invoice before submitting completion
                                </p>
                            </div>

                            {/* Customer Info */}
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bill To</p>
                                        <p className="font-semibold text-slate-800 mt-1">
                                            {job.customer?.name || job.customerName || 'Customer'}
                                        </p>
                                        {(job.customer?.email || job.customerEmail) && (
                                            <p className="text-sm text-slate-600">{job.customer?.email || job.customerEmail}</p>
                                        )}
                                        {job.serviceAddress && (
                                            <p className="text-sm text-slate-500 mt-1">
                                                {typeof job.serviceAddress === 'string'
                                                    ? job.serviceAddress
                                                    : `${job.serviceAddress.street || ''}, ${job.serviceAddress.city || ''}`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Job #</p>
                                        <p className="font-mono text-slate-700">{job.jobNumber || job.id?.slice(-6) || '---'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items - Editable */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-700">Line Items</p>
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceLineItems(prev => [...prev, {
                                            id: `new_${Date.now()}`,
                                            description: '',
                                            quantity: 1,
                                            unitPrice: 0,
                                            amount: 0
                                        }])}
                                        className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Item
                                    </button>
                                </div>

                                {invoiceLineItems.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                        <p className="text-amber-700 text-sm">No line items found from quote.</p>
                                        <p className="text-amber-600 text-xs mt-1">Add items to generate an invoice.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        {/* Header */}
                                        <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-slate-600">
                                            <div className="col-span-5">Description</div>
                                            <div className="col-span-2 text-center">Qty</div>
                                            <div className="col-span-2 text-right">Price</div>
                                            <div className="col-span-2 text-right">Total</div>
                                            <div className="col-span-1"></div>
                                        </div>
                                        {/* Items */}
                                        {invoiceLineItems.map((item, idx) => (
                                            <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center border-t border-slate-100 hover:bg-slate-50">
                                                <div className="col-span-5">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => {
                                                            const newItems = [...invoiceLineItems];
                                                            newItems[idx].description = e.target.value;
                                                            setInvoiceLineItems(newItems);
                                                        }}
                                                        placeholder="Description"
                                                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const newItems = [...invoiceLineItems];
                                                            const qty = parseInt(e.target.value) || 1;
                                                            newItems[idx].quantity = qty;
                                                            newItems[idx].amount = qty * newItems[idx].unitPrice;
                                                            setInvoiceLineItems(newItems);
                                                        }}
                                                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded text-center focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.unitPrice}
                                                            onChange={(e) => {
                                                                const newItems = [...invoiceLineItems];
                                                                const price = parseFloat(e.target.value) || 0;
                                                                newItems[idx].unitPrice = price;
                                                                newItems[idx].amount = newItems[idx].quantity * price;
                                                                setInvoiceLineItems(newItems);
                                                            }}
                                                            className="w-full pl-5 pr-2 py-1 text-sm border border-slate-200 rounded text-right focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-right font-medium text-slate-800 text-sm">
                                                    {formatCurrency(item.amount || 0)}
                                                </div>
                                                <div className="col-span-1 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setInvoiceLineItems(prev => prev.filter((_, i) => i !== idx))}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Totals Section */}
                            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                {/* Subtotal */}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="font-medium text-slate-800">
                                        {formatCurrency(invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0))}
                                    </span>
                                </div>

                                {/* Tax */}
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-600">Tax</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            value={invoiceTaxRate}
                                            onChange={(e) => setInvoiceTaxRate(parseFloat(e.target.value) || 0)}
                                            className="w-16 px-2 py-0.5 text-xs border border-slate-200 rounded text-center"
                                        />
                                        <span className="text-slate-400 text-xs">%</span>
                                    </div>
                                    <span className="font-medium text-slate-800">
                                        {formatCurrency(invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0) * (invoiceTaxRate / 100))}
                                    </span>
                                </div>

                                {/* Deposit Paid */}
                                {(job.depositAmount || job.depositPaid || job.deposit?.amount) > 0 && (
                                    <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" />
                                            Deposit Paid
                                        </span>
                                        <span className="font-medium text-emerald-600">
                                            -{formatCurrency(job.depositAmount || job.depositPaid || job.deposit?.amount || 0)}
                                        </span>
                                    </div>
                                )}

                                {/* Total / Balance Due */}
                                <div className="flex justify-between text-lg font-bold border-t border-slate-300 pt-3">
                                    <span className="text-slate-800">
                                        {(job.depositAmount || job.depositPaid || job.deposit?.amount) > 0 ? 'Balance Due' : 'Total'}
                                    </span>
                                    <span className="text-emerald-600">
                                        {formatCurrency(
                                            Math.max(0,
                                                invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0) * (1 + invoiceTaxRate / 100)
                                                - (job.depositAmount || job.depositPaid || job.deposit?.amount || 0)
                                            )
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Invoice Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Notes</label>
                                <textarea
                                    value={invoiceNotes}
                                    onChange={(e) => setInvoiceNotes(e.target.value)}
                                    placeholder="Any notes to include on the invoice..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm resize-none"
                                />
                            </div>

                            {/* Or Upload External Invoice */}
                            <div className="border-t border-slate-200 pt-4">
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                    Or upload your own invoice
                                </p>
                                {invoice ? (
                                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                            <span className="text-sm font-medium text-green-800">{invoice.fileName}</span>
                                        </div>
                                        <button onClick={() => setInvoice(null)} className="text-red-500 hover:text-red-700">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => !uploadingInvoice && invoiceInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all"
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

                            {/* Next Button */}
                            <div className="pt-4">
                                <button
                                    onClick={() => setActiveSection('photos')}
                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    Continue to Photos
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PHOTOS SECTION */}
                    {activeSection === 'photos' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">Completion Photos</h3>
                                <span className="text-sm text-gray-500">{photos.length + beforePhotos.length} total</span>
                            </div>

                            {/* Before Photos (from job start) */}
                            {beforePhotos.length > 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-lg">📷</span>
                                        <span className="font-medium text-orange-800">Before Photos</span>
                                        <span className="text-sm text-orange-600">
                                            ({beforePhotos.length} captured at job start)
                                        </span>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {beforePhotos.map((photo, idx) => (
                                            <div
                                                key={photo.id || idx}
                                                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden"
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt={`Before ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* After Photo Requirements */}
                            {photoRequirements.afterPhotosRequired && (
                                <div className={`rounded-xl p-4 border ${
                                    photos.filter(p => p.type === 'after').length >= photoRequirements.minAfterPhotos
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-amber-50 border-amber-200'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">✨</span>
                                            <span className={`font-medium ${
                                                photos.filter(p => p.type === 'after').length >= photoRequirements.minAfterPhotos
                                                    ? 'text-emerald-800'
                                                    : 'text-amber-800'
                                            }`}>
                                                After Photos Required
                                            </span>
                                        </div>
                                        <span className={`text-sm font-medium ${
                                            photos.filter(p => p.type === 'after').length >= photoRequirements.minAfterPhotos
                                                ? 'text-emerald-600'
                                                : 'text-amber-600'
                                        }`}>
                                            {photos.filter(p => p.type === 'after').length}/{photoRequirements.minAfterPhotos}
                                        </span>
                                    </div>
                                    {photos.filter(p => p.type === 'after').length < photoRequirements.minAfterPhotos && (
                                        <p className="text-sm text-amber-700 mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            Add {photoRequirements.minAfterPhotos - photos.filter(p => p.type === 'after').length} more after photo{photoRequirements.minAfterPhotos - photos.filter(p => p.type === 'after').length > 1 ? 's' : ''} to submit
                                        </p>
                                    )}
                                </div>
                            )}

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

                    {/* SIGNATURE SECTION */}
                    {activeSection === 'signature' && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-semibold text-gray-900">Customer Signature</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Capture customer's signature to confirm work completion
                                </p>
                            </div>

                            {signatureData ? (
                                // Show captured signature
                                <div className="space-y-4">
                                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                                            <span className="font-medium text-emerald-800">Signature Captured</span>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-emerald-100">
                                            <img
                                                src={signatureData.signatureImage}
                                                alt="Customer signature"
                                                className="max-h-24 mx-auto"
                                            />
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-emerald-600">Signed by:</span>
                                                <span className="ml-2 font-medium text-emerald-800">{signatureData.signerName}</span>
                                            </div>
                                            <div>
                                                <span className="text-emerald-600">Relationship:</span>
                                                <span className="ml-2 font-medium text-emerald-800 capitalize">{signatureData.signerRelationship?.replace('_', ' ')}</span>
                                            </div>
                                            <div>
                                                <span className="text-emerald-600">Date/Time:</span>
                                                <span className="ml-2 font-medium text-emerald-800">
                                                    {new Date(signatureData.signedAt).toLocaleString()}
                                                </span>
                                            </div>
                                            {signatureData.gpsLocation && (
                                                <div>
                                                    <span className="text-emerald-600">Location:</span>
                                                    <span className="ml-2 font-medium text-emerald-800">Verified</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSignatureData(null)}
                                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Clear and recapture signature
                                    </button>
                                </div>
                            ) : (
                                // Capture new signature
                                <SignatureCapture
                                    title="Customer Signature Required"
                                    description="Have the customer sign to confirm work completion"
                                    signerName={job.customer?.name || job.customerName || ''}
                                    legalText={`By signing below, I acknowledge that the work described for ${job.title || job.description || 'this job'} has been completed to my satisfaction. I agree to the charges shown on the invoice totaling ${formatCurrency(
                                        invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0) * (1 + invoiceTaxRate / 100) - (job.depositAmount || 0)
                                    )} (balance due).`}
                                    documents={[
                                        'Job Completion Acknowledgment',
                                        `Invoice for ${job.title || 'Service'}`
                                    ]}
                                    onCapture={(data) => {
                                        setSignatureData(data);
                                        toast.success('Signature captured successfully!');
                                    }}
                                    captureLocation={true}
                                />
                            )}

                            {/* Skip signature option */}
                            {!signatureData && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-amber-800">Customer not present?</p>
                                            <p className="text-sm text-amber-700 mt-1">
                                                You can skip the signature for now. The customer will be asked to confirm
                                                completion via email. Jobs without signatures may take longer to process payment.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setRequireSignature(false);
                                                    setActiveSection('payment');
                                                    toast('Signature skipped - customer will confirm via email', { icon: 'ℹ️' });
                                                }}
                                                className="mt-2 text-sm font-medium text-amber-700 hover:text-amber-800 underline"
                                            >
                                                Skip signature and continue
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PAYMENT SECTION - Collect payment on-site */}
                    {activeSection === 'payment' && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-semibold text-gray-900">Collect Payment</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Collect balance due now or send payment link later
                                </p>
                            </div>

                            {/* Balance Due Summary */}
                            {(() => {
                                const invoiceSubtotal = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
                                const invoiceTax = invoiceSubtotal * (invoiceTaxRate / 100);
                                const invoiceTotal = invoiceSubtotal + invoiceTax;
                                const depositPaid = job.depositAmount || job.depositPaid || job.deposit?.amount || 0;
                                const balanceDue = Math.max(0, invoiceTotal - depositPaid);

                                return (
                                    <>
                                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-emerald-600">Balance Due</p>
                                                    <p className="text-3xl font-bold text-emerald-700">{formatCurrency(balanceDue)}</p>
                                                </div>
                                                <div className="text-right text-sm text-gray-500">
                                                    <p>Total: {formatCurrency(invoiceTotal)}</p>
                                                    {depositPaid > 0 && <p className="text-emerald-600">Deposit: -{formatCurrency(depositPaid)}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {balanceDue > 0 ? (
                                            <>
                                                {/* Payment Options */}
                                                {!showPaymentQR && !paymentCollected && (
                                                    <div className="space-y-3">
                                                        {/* Show QR Code Option */}
                                                        <button
                                                            onClick={() => setShowPaymentQR(true)}
                                                            className="w-full p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-4"
                                                        >
                                                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                                                <QrCode className="w-6 h-6" />
                                                            </div>
                                                            <div className="text-left flex-1">
                                                                <p className="font-semibold">Collect Now with QR Code</p>
                                                                <p className="text-emerald-100 text-sm">Customer scans with phone to pay instantly</p>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>

                                                        {/* Send Link Later Option */}
                                                        <button
                                                            onClick={() => {
                                                                setFieldPaymentMethod('later');
                                                                setActiveSection('review');
                                                                toast('Payment link will be sent with completion notification', { icon: 'ℹ️' });
                                                            }}
                                                            className="w-full p-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-4"
                                                        >
                                                            <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center">
                                                                <Send className="w-6 h-6 text-gray-500" />
                                                            </div>
                                                            <div className="text-left flex-1">
                                                                <p className="font-semibold">Send Payment Link Later</p>
                                                                <p className="text-gray-500 text-sm">Payment link included in completion email</p>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                                        </button>

                                                        {/* Mark as Paid (Cash/Check) */}
                                                        <button
                                                            onClick={() => {
                                                                setPaymentCollected(true);
                                                                setFieldPaymentMethod('cash_check');
                                                                toast.success('Payment marked as collected');
                                                            }}
                                                            className="w-full p-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:border-gray-300 transition-colors flex items-center gap-4"
                                                        >
                                                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                                                                <DollarSign className="w-6 h-6 text-gray-500" />
                                                            </div>
                                                            <div className="text-left flex-1">
                                                                <p className="font-semibold">Paid via Cash/Check</p>
                                                                <p className="text-gray-500 text-sm">Mark payment as already collected</p>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* QR Code Display */}
                                                {showPaymentQR && (
                                                    <div className="space-y-4">
                                                        <PaymentQRCode
                                                            amount={balanceDue}
                                                            jobId={job.id}
                                                            jobNumber={job.jobNumber}
                                                            description={job.title || job.description}
                                                            customerName={job.customer?.name || job.customerName}
                                                            customerEmail={job.customer?.email || job.customerEmail}
                                                            customerPhone={job.customer?.phone || job.customerPhone}
                                                            contractorId={contractorId}
                                                            contractorName={job.contractorName || ''}
                                                            stripeAccountId={job.stripeAccountId}
                                                            showDeliveryOptions={true}
                                                            size="medium"
                                                            onPaymentSuccess={() => {
                                                                setPaymentCollected(true);
                                                                setFieldPaymentMethod('qr');
                                                                setShowPaymentQR(false);
                                                                toast.success('Payment received!');
                                                            }}
                                                        />

                                                        <button
                                                            onClick={() => setShowPaymentQR(false)}
                                                            className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
                                                        >
                                                            Back to payment options
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Payment Collected Confirmation */}
                                                {paymentCollected && (
                                                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-emerald-800">Payment Collected</p>
                                                                <p className="text-sm text-emerald-600">
                                                                    {fieldPaymentMethod === 'cash_check' ? 'Marked as cash/check payment' :
                                                                     fieldPaymentMethod === 'qr' ? 'Collected via QR code payment' :
                                                                     'Payment received'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setPaymentCollected(false);
                                                                setFieldPaymentMethod(null);
                                                            }}
                                                            className="mt-3 text-sm text-emerald-700 hover:text-emerald-800 underline"
                                                        >
                                                            Change payment method
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* No Balance Due */
                                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 text-center">
                                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                                                </div>
                                                <p className="font-semibold text-emerald-800 text-lg">Fully Paid!</p>
                                                <p className="text-sm text-emerald-600 mt-1">
                                                    This job has no remaining balance
                                                </p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Continue Button */}
                            <div className="pt-4">
                                <button
                                    onClick={() => setActiveSection('review')}
                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    Continue to Review
                                    <ChevronRight className="w-4 h-4" />
                                </button>
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

                                {/* Signature Summary */}
                                <div className={`p-4 rounded-xl border ${signatureData ? 'bg-purple-50 border-purple-200' : requireSignature ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-3">
                                        {signatureData ? (
                                            <>
                                                <CheckCircle className="w-5 h-5 text-purple-600" />
                                                <div className="flex-1">
                                                    <p className="font-medium text-purple-800">Customer Signature Captured</p>
                                                    <p className="text-sm text-purple-700">
                                                        Signed by {signatureData.signerName} at {new Date(signatureData.signedAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <img
                                                    src={signatureData.signatureImage}
                                                    alt="Signature"
                                                    className="h-10 max-w-[80px] object-contain border border-purple-200 rounded bg-white p-1"
                                                />
                                            </>
                                        ) : requireSignature ? (
                                            <>
                                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                                <div>
                                                    <p className="font-medium text-amber-800">No Signature</p>
                                                    <p className="text-sm text-amber-600">Customer will confirm via email</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <PenTool className="w-5 h-5 text-gray-400" />
                                                <p className="font-medium text-gray-600">Signature skipped</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Payment Summary */}
                                {(() => {
                                    const invoiceSubtotal = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
                                    const invoiceTax = invoiceSubtotal * (invoiceTaxRate / 100);
                                    const invoiceTotal = invoiceSubtotal + invoiceTax;
                                    const depositPaid = job.depositAmount || job.depositPaid || job.deposit?.amount || 0;
                                    const balanceDue = Math.max(0, invoiceTotal - depositPaid);

                                    return (
                                        <div className={`p-4 rounded-xl border ${
                                            paymentCollected ? 'bg-green-50 border-green-200' :
                                            balanceDue > 0 ? 'bg-amber-50 border-amber-200' :
                                            'bg-green-50 border-green-200'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                {paymentCollected || balanceDue === 0 ? (
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <CreditCard className="w-5 h-5 text-amber-500" />
                                                )}
                                                <div className="flex-1">
                                                    <p className={`font-medium ${
                                                        paymentCollected || balanceDue === 0 ? 'text-green-800' : 'text-amber-800'
                                                    }`}>
                                                        {balanceDue === 0 ? 'Fully Paid' :
                                                         paymentCollected ? 'Payment Collected' :
                                                         fieldPaymentMethod === 'later' ? 'Payment Link Will Be Sent' :
                                                         `Balance Due: ${formatCurrency(balanceDue)}`}
                                                    </p>
                                                    {paymentCollected && fieldPaymentMethod && (
                                                        <p className="text-sm text-green-600">
                                                            {fieldPaymentMethod === 'cash_check' ? 'Collected via cash/check' :
                                                             fieldPaymentMethod === 'qr' ? 'Collected via QR payment' :
                                                             'Payment received'}
                                                        </p>
                                                    )}
                                                    {!paymentCollected && fieldPaymentMethod === 'later' && (
                                                        <p className="text-sm text-amber-600">Customer will receive payment link</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* What happens next */}
                            <div className="bg-gray-50 rounded-xl p-4 mt-6">
                                <h4 className="font-medium text-gray-900 mb-2">What happens next?</h4>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• The homeowner will be notified to review your completion</li>
                                    <li>• Items will be added to their home inventory when they approve</li>
                                    {!paymentCollected && fieldPaymentMethod !== 'cash_check' && (
                                        <li>• A payment link will be included in the notification</li>
                                    )}
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
                                    const sections = ['invoice', 'photos', 'items', 'notes', 'signature', 'payment', 'review'];
                                    const currentIdx = sections.indexOf(activeSection);
                                    if (currentIdx < sections.length - 1) {
                                        // If on signature and signature captured, go to payment
                                        // If on signature and no signature, stay (or skip if they clicked skip)
                                        if (activeSection === 'signature' && !signatureData && requireSignature) {
                                            toast('Please capture customer signature or click "Skip signature"', { icon: '✏️' });
                                            return;
                                        }
                                        setActiveSection(sections[currentIdx + 1]);
                                    }
                                }}
                                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                            >
                                {activeSection === 'payment' ? 'Review & Submit' :
                                 activeSection === 'signature' && signatureData ? 'Continue to Payment' : 'Continue'}
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
