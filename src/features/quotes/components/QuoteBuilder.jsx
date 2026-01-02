// src/features/quotes/components/QuoteBuilder.jsx
// ============================================
// QUOTE BUILDER
// ============================================
// Create and edit quotes with line items

import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Save, Send, User, FileText, Calculator,
    Package, Wrench, Trash2, ChevronDown, Loader2, Calendar, 
    Link as LinkIcon, Sparkles, Copy, Printer, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';

// NEW: Import the Google Maps hook
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';

// ============================================
// LINE ITEM TYPES
// ============================================
const LINE_ITEM_TYPES = [
    { value: 'labor', label: 'Labor', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
    { value: 'material', label: 'Material', icon: Package, color: 'bg-amber-100 text-amber-700' },
];

// ============================================
// DEFAULT LINE ITEM
// ============================================
const createDefaultLineItem = (type = 'material') => ({
    id: Date.now() + Math.random(),
    type,
    description: '',
    quantity: 1,
    unitPrice: 0
});

// ============================================
// DEFAULT FORM STATE
// ============================================
const createDefaultFormState = (existingQuote = null) => ({
    customer: existingQuote?.customer || {
        name: '',
        email: '',
        phone: '',
        address: ''
    },
    customerId: existingQuote?.customerId || null,
    title: existingQuote?.title || '',
    expiresAt: existingQuote?.expiresAt 
        ? (existingQuote.expiresAt.toDate 
            ? existingQuote.expiresAt.toDate().toISOString().split('T')[0]
            : new Date(existingQuote.expiresAt).toISOString().split('T')[0])
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
    lineItems: existingQuote?.lineItems?.length > 0 
        ? existingQuote.lineItems.map(item => ({ ...item, id: item.id || Date.now() + Math.random() }))
        : [createDefaultLineItem('labor')],
    taxRate: existingQuote?.taxRate ?? 8.75,
    notes: existingQuote?.notes || '',
    terms: existingQuote?.terms || 'Quote valid for 14 days. 50% deposit required to schedule work. Final payment due upon completion.'
});

// ============================================
// TEMPLATE PICKER
// ============================================
const TemplatePicker = ({ templates = [], onSelect, onClose }) => {
    if (templates.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
                <p className="text-slate-500 mb-2">No templates yet</p>
                <p className="text-sm text-slate-400">Save a quote as a template to reuse it later.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-slate-500 mb-3">Select a template:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map(template => (
                    <button
                        key={template.id}
                        onClick={() => onSelect(template)}
                        className="p-3 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors"
                    >
                        <p className="font-medium text-slate-800">{template.name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            {template.category} • {template.lineItems?.length || 0} items
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================
// CUSTOMER SELECTOR (Enhanced with Maps)
// ============================================
// ============================================
// CUSTOMER SELECTOR (Enhanced with Maps)
// ============================================
const CustomerSection = ({ 
    customer, 
    customers = [], 
    customerId,
    onChange, 
    onSelectExisting 
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    
    // -- GOOGLE MAPS INTEGRATION START --
    const isMapsLoaded = useGoogleMaps();
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);
    
    // 1. Create a Ref to track the LATEST customer state
    const customerRef = useRef(customer);

    // 2. Keep the Ref updated whenever props change
    useEffect(() => {
        customerRef.current = customer;
    }, [customer]);

    useEffect(() => {
        if (isMapsLoaded && addressInputRef.current && !autocompleteRef.current) {
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(
                    addressInputRef.current, 
                    {
                        types: ['address'],
                        componentRestrictions: { country: 'us' },
                    }
                );

                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (place.formatted_address) {
                        // 3. Use customerRef.current inside the listener to get the latest data
                        const currentCustomer = customerRef.current;
                        
                        // Merge the new address with the EXISTING name/phone/email
                        onChange({ 
                            ...currentCustomer, 
                            address: place.formatted_address 
                        });
                    }
                });
            } catch (err) {
                console.error("Autocomplete init failed", err);
            }
        }
    }, [isMapsLoaded, onChange]); // Removed 'customer' from dependency array to prevent re-binding
    // -- GOOGLE MAPS INTEGRATION END --
    
    const handleCustomerSelect = (selectedCustomer) => {
        onSelectExisting(selectedCustomer);
        setShowDropdown(false);
    };
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User size={18} className="text-slate-400" />
                Customer Information
            </h3>
            
            {/* Existing Customer Selector */}
            {customers.length > 0 && (
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Select Existing Customer
                    </label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-left flex items-center justify-between hover:border-slate-300 transition-colors"
                        >
                            <span className={customerId ? 'text-slate-800' : 'text-slate-400'}>
                                {customerId 
                                    ? customers.find(c => c.id === customerId)?.customerName || 'Selected Customer'
                                    : 'Choose from your customers...'
                                }
                            </span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </button>
                        
                        {showDropdown && (
                            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                <button
                                    onClick={() => {
                                        onSelectExisting(null);
                                        setShowDropdown(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                                >
                                    — New Customer —
                                </button>
                                {customers.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleCustomerSelect(c)}
                                        className="w-full px-4 py-2 text-left hover:bg-slate-50 border-t border-slate-100"
                                    >
                                        <p className="font-medium text-slate-800">{c.customerName || 'Unnamed'}</p>
                                        <p className="text-xs text-slate-500">{c.propertyName}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Customer Name *
                    </label>
                    <input
                        type="text"
                        value={customer.name}
                        onChange={(e) => onChange({ ...customer, name: e.target.value })}
                        placeholder="John Smith"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Email *
                    </label>
                    <input
                        type="email"
                        value={customer.email}
                        onChange={(e) => onChange({ ...customer, email: e.target.value })}
                        placeholder="john@email.com"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Phone
                    </label>
                    <input
                        type="tel"
                        value={customer.phone}
                        onChange={(e) => onChange({ ...customer, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                        Service Address (Google Linked)
                    </label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            ref={addressInputRef}
                            type="text"
                            value={customer.address}
                            onChange={(e) => onChange({ ...customer, address: e.target.value })}
                            placeholder="Start typing to search..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// LINE ITEMS TABLE
// ============================================
const LineItemsSection = ({ 
    lineItems, 
    onUpdate, 
    onAdd, 
    onRemove,
    taxRate,
    onTaxRateChange
}) => {
    const updateItem = (id, field, value) => {
        onUpdate(lineItems.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        ));
    };
    
    const subtotal = lineItems.reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 
        0
    );
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    const laborTotal = lineItems
        .filter(i => i.type === 'labor')
        .reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitPrice || 0)), 0);
    
    const materialsTotal = lineItems
        .filter(i => i.type === 'material')
        .reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitPrice || 0)), 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calculator size={18} className="text-slate-400" />
                    Line Items
                </h3>
                <div className="flex items-center gap-2">
                    <button 
                        type="button"
                        onClick={() => onAdd('material')}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors"
                    >
                        <Package size={14} />
                        Add Material
                    </button>
                    <button 
                        type="button"
                        onClick={() => onAdd('labor')}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors"
                    >
                        <Wrench size={14} />
                        Add Labor
                    </button>
                </div>
            </div>
            
            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[600px]">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="text-left text-xs font-bold text-slate-500 uppercase px-4 py-3 w-20">Type</th>
                            <th className="text-left text-xs font-bold text-slate-500 uppercase px-4 py-3">Description</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-20">Qty</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-28">Unit Price</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-28">Total</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {lineItems.map((item) => {
                            const itemType = LINE_ITEM_TYPES.find(t => t.value === item.type) || LINE_ITEM_TYPES[0];
                            return (
                                <tr key={item.id} className="group">
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded ${itemType.color}`}>
                                            {itemType.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            placeholder={item.type === 'labor' ? 'e.g., Installation labor' : 'e.g., 50-gallon water heater'}
                                            className="w-full px-2 py-1 border-0 focus:ring-0 bg-transparent"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-1 border border-slate-200 rounded text-right"
                                            min="0"
                                            step="0.5"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                            <input
                                                type="number"
                                                value={item.unitPrice}
                                                onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                className="w-full pl-6 pr-2 py-1 border border-slate-200 rounded text-right"
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                                        ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                                    </td>
                                    <td className="px-2 py-3">
                                        {lineItems.length > 1 && (
                                            <button 
                                                type="button"
                                                onClick={() => onRemove(item.id)}
                                                className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex justify-end">
                    <div className="w-72 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Materials</span>
                            <span className="font-medium">${materialsTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Labor</span>
                            <span className="font-medium">${laborTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="font-medium">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">Tax</span>
                                <input
                                    type="number"
                                    value={taxRate}
                                    onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
                                    className="w-16 px-2 py-0.5 border border-slate-200 rounded text-sm text-center"
                                    min="0"
                                    max="100"
                                    step="0.25"
                                />
                                <span className="text-slate-400">%</span>
                            </div>
                            <span className="font-medium">${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
                            <span className="font-bold text-slate-800">Total</span>
                            <span className="font-bold text-emerald-600">${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// SIDEBAR SUMMARY
// ============================================
const QuoteSummary = ({ 
    lineItems, 
    taxRate, 
    onSaveDraft, 
    onSend, 
    onPreview,
    isSaving,
    isSending
}) => {
    const subtotal = lineItems.reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 
        0
    );
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    const laborTotal = lineItems
        .filter(i => i.type === 'labor')
        .reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitPrice || 0)), 0);
    
    const materialsTotal = lineItems
        .filter(i => i.type === 'material')
        .reduce((sum, i) => sum + ((i.quantity || 0) * (i.unitPrice || 0)), 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-4">
            <h3 className="font-bold text-slate-800 mb-4">Quote Summary</h3>
            
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500">Quote Total</p>
                    <p className="text-3xl font-bold text-slate-800">${total.toFixed(2)}</p>
                </div>
                
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Materials</span>
                        <span className="font-medium">${materialsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Labor</span>
                        <span className="font-medium">${laborTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Tax ({taxRate}%)</span>
                        <span className="font-medium">${tax.toFixed(2)}</span>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-slate-200 space-y-2">
                    <button 
                        type="button"
                        onClick={onSend}
                        disabled={isSending}
                        className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSending ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                        {isSending ? 'Sending...' : 'Send to Customer'}
                    </button>
                    <button 
                        type="button"
                        onClick={onSaveDraft}
                        disabled={isSaving}
                        className="w-full py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {isSaving ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {isSaving ? 'Saving...' : 'Save Draft'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const QuoteBuilder = ({
    quote = null, // Existing quote for editing, null for new
    customers = [],
    templates = [],
    contractorProfile = null,
    onBack,
    onSave,
    onSend,
    isSaving = false,
    isSending = false
}) => {
    const isEditing = !!quote;
    const [formData, setFormData] = useState(() => createDefaultFormState(quote));
    const [showTemplates, setShowTemplates] = useState(false);
    const [errors, setErrors] = useState({});

    // Reset form when quote changes
    useEffect(() => {
        setFormData(createDefaultFormState(quote));
    }, [quote?.id]);

    // Handlers
    const handleCustomerChange = (customer) => {
        setFormData(prev => ({ ...prev, customer }));
    };

    const handleSelectExistingCustomer = (selectedCustomer) => {
        if (!selectedCustomer) {
            setFormData(prev => ({
                ...prev,
                customerId: null,
                customer: { name: '', email: '', phone: '', address: '' }
            }));
            return;
        }
        
        setFormData(prev => ({
            ...prev,
            customerId: selectedCustomer.id,
            customer: {
                name: selectedCustomer.customerName || '',
                email: selectedCustomer.email || '',
                phone: selectedCustomer.phone || '',
                address: selectedCustomer.propertyName || ''
            }
        }));
    };

    const handleLineItemsUpdate = (lineItems) => {
        setFormData(prev => ({ ...prev, lineItems }));
    };

    const handleAddLineItem = (type) => {
        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, createDefaultLineItem(type)]
        }));
    };

    const handleRemoveLineItem = (id) => {
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter(item => item.id !== id)
        }));
    };

    const handleSelectTemplate = (template) => {
        setFormData(prev => ({
            ...prev,
            title: template.name,
            lineItems: template.lineItems?.map(item => ({
                ...item,
                id: Date.now() + Math.random(),
                unitPrice: item.defaultPrice || item.unitPrice || 0
            })) || prev.lineItems,
            notes: template.defaultNotes || prev.notes,
            terms: template.defaultTerms || prev.terms
        }));
        setShowTemplates(false);
        toast.success(`Template "${template.name}" applied`);
    };

    // Validation
    const validate = () => {
        const newErrors = {};
        
        if (!formData.customer.name?.trim()) {
            newErrors.customerName = 'Customer name is required';
        }
        if (!formData.customer.email?.trim()) {
            newErrors.customerEmail = 'Customer email is required';
        }
        if (!formData.title?.trim()) {
            newErrors.title = 'Quote title is required';
        }
        if (formData.lineItems.length === 0) {
            newErrors.lineItems = 'At least one line item is required';
        }
        
        const hasValidItems = formData.lineItems.some(
            item => item.description?.trim() && item.unitPrice > 0
        );
        if (!hasValidItems) {
            newErrors.lineItems = 'At least one complete line item is required';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save handlers
    const handleSaveDraft = async () => {
        if (!validate()) {
            toast.error('Please fill in required fields');
            return;
        }
        
        try {
            await onSave({ ...formData, status: 'draft' });
            toast.success(isEditing ? 'Quote updated' : 'Draft saved');
        } catch (error) {
            toast.error('Failed to save: ' + error.message);
        }
    };

    const handleSendQuote = async () => {
        if (!validate()) {
            toast.error('Please fill in required fields');
            return;
        }
        
        try {
            await onSend(formData);
        } catch (error) {
            toast.error('Failed to send: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {isEditing ? `Edit Quote ${quote.quoteNumber}` : 'New Quote'}
                        </h1>
                        <p className="text-slate-500">
                            {isEditing ? 'Update quote details' : 'Create a quote for your customer'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSaveDraft}
                        disabled={isSaving}
                        className="px-4 py-2 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Draft
                    </button>
                    <button 
                        onClick={handleSendQuote}
                        disabled={isSending}
                        className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Send Quote
                    </button>
                </div>
            </div>
            
            {/* Template Suggestion Banner */}
            {!isEditing && templates.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-xl">
                            <Sparkles size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <p className="font-medium text-purple-900">Start from a template</p>
                            <p className="text-sm text-purple-700">Use your saved job templates to create quotes faster</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="px-4 py-2 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors"
                    >
                        {showTemplates ? 'Hide Templates' : 'Browse Templates'}
                    </button>
                </div>
            )}
            
            {/* Templates Dropdown */}
            {showTemplates && (
                <TemplatePicker 
                    templates={templates} 
                    onSelect={handleSelectTemplate}
                    onClose={() => setShowTemplates(false)}
                />
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content - Left 2 cols */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Info */}
                    <CustomerSection
                        customer={formData.customer}
                        customers={customers}
                        customerId={formData.customerId}
                        onChange={handleCustomerChange}
                        onSelectExisting={handleSelectExistingCustomer}
                    />
                    
                    {/* Quote Details */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" />
                            Quote Details
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Quote Title / Job Description *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g., Water Heater Replacement, HVAC Repair"
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                                        errors.title ? 'border-red-300' : 'border-slate-200'
                                    }`}
                                />
                                {errors.title && (
                                    <p className="text-red-500 text-xs mt-1">{errors.title}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    <Calendar size={12} className="inline mr-1" />
                                    Expiration Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.expiresAt}
                                    onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Line Items */}
                    <LineItemsSection
                        lineItems={formData.lineItems}
                        onUpdate={handleLineItemsUpdate}
                        onAdd={handleAddLineItem}
                        onRemove={handleRemoveLineItem}
                        taxRate={formData.taxRate}
                        onTaxRateChange={(rate) => setFormData(prev => ({ ...prev, taxRate: rate }))}
                    />
                    {errors.lineItems && (
                        <p className="text-red-500 text-sm -mt-4">{errors.lineItems}</p>
                    )}
                    
                    {/* Notes & Terms */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4">Notes & Terms</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Additional Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Any special conditions, scope details, or customer requests..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Terms & Conditions
                                </label>
                                <textarea
                                    value={formData.terms}
                                    onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Sidebar - Right col */}
                <div className="space-y-4">
                    <QuoteSummary
                        lineItems={formData.lineItems}
                        taxRate={formData.taxRate}
                        onSaveDraft={handleSaveDraft}
                        onSend={handleSendQuote}
                        isSaving={isSaving}
                        isSending={isSending}
                    />
                    
                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</p>
                        <div className="space-y-2">
                            <button className="w-full p-3 text-left text-sm text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <Copy size={16} className="text-slate-400" />
                                Duplicate Quote
                            </button>
                            <button className="w-full p-3 text-left text-sm text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                <Printer size={16} className="text-slate-400" />
                                Print / Download PDF
                            </button>
                            {isEditing && (
                                <button className="w-full p-3 text-left text-sm text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                                    <LinkIcon size={16} className="text-slate-400" />
                                    Copy Share Link
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuoteBuilder;
