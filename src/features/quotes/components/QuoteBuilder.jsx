// src/features/quotes/components/QuoteBuilder.jsx
// ============================================
// QUOTE BUILDER
// ============================================
// Create and edit quotes with line items

import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Sparkles, Save, Send, User, FileText, Calculator,
    Package, Wrench, Trash2, ChevronDown, ChevronUp, Loader2, Calendar, 
    Link as LinkIcon, Sparkles, Copy, Printer, MapPin, AlertCircle, Shield, Info, Users, Timer
} from 'lucide-react';
import toast from 'react-hot-toast';

// REMOVED: import { estimateDuration } from '../lib/durationEstimator';

// NEW: Import the Google Maps hook
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
// Price Book Integration
import { PriceBookPicker, PriceBookButton } from '../../contractor-pro/components/PriceBook';

// ============================================
// UTILS
// ============================================
const formatPhoneNumber = (value) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

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
    unitPrice: 0,
    // NEW FIELDS (Incorporating Specs)
    brand: '',
    model: '',
    serial: '',
    warranty: '',
    crewSize: '', // Specific to Labor
    isExpanded: false // Collapsed by default for cleaner look
});

// ============================================
// DEFAULT FORM STATE
// ============================================
const createDefaultFormState = (existingQuote = null, contractorSettings = {}) => ({
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
    
    // NEW: Estimated Duration
    estimatedDuration: existingQuote?.estimatedDuration || '',
    
    // Default to one Material AND one Labor item (both expanded)
    lineItems: existingQuote?.lineItems?.length > 0 
        ? existingQuote.lineItems.map(item => ({ ...item, id: item.id || Date.now() + Math.random(), isExpanded: true }))
        : [createDefaultLineItem('material'), createDefaultLineItem('labor')],
    
    // APPLIED DEFAULTS FROM SETTINGS
    taxRate: existingQuote?.taxRate ?? contractorSettings?.defaultTaxRate ?? 8.75,
    notes: existingQuote?.notes || '',
    exclusions: existingQuote?.exclusions || '', 
    clientWarranty: existingQuote?.clientWarranty || contractorSettings?.defaultLaborWarranty || '', 
    terms: existingQuote?.terms || 'Quote valid for 14 days. Final payment due upon completion.',
    
    // Financials - APPLIED DEFAULTS FROM SETTINGS
    depositRequired: existingQuote?.depositRequired ?? (contractorSettings?.defaultDepositValue > 0),
    depositType: existingQuote?.depositType || contractorSettings?.defaultDepositType || 'percentage',
    depositValue: existingQuote?.depositValue ?? contractorSettings?.defaultDepositValue ?? 50
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
// CUSTOMER FORM
// ============================================
const CustomerForm = ({ customer, onChange, onSelectExisting, existingCustomers = [], errors = {} }) => {
    const [showSearch, setShowSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);
    
    // Google Maps initialization
    // Google Maps initialization
    const mapsLoaded = useGoogleMaps();
    
    // Use ref to track current customer values (avoids stale closure in autocomplete callback)
    const customerRef = useRef(customer);
    useEffect(() => {
        customerRef.current = customer;
    }, [customer]);
    
    useEffect(() => {
        if (!mapsLoaded || !addressInputRef.current || autocompleteRef.current) return;
        
        try {
            autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'us' }
            });
            
            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current.getPlace();
                if (place.formatted_address) {
                    // Use ref to get CURRENT customer values, not stale closure
                    onChange({ ...customerRef.current, address: place.formatted_address });
                }
            });
        } catch (err) {
            console.warn('Autocomplete init error:', err);
        }
    }, [mapsLoaded]);
    
    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        onChange({ ...customer, phone: formatted });
    };
    
    const filteredCustomers = existingCustomers.filter(c => 
        c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <User size={18} className="text-slate-400" />
                    Customer Info
                </h3>
                {existingCustomers.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowSearch(!showSearch)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        {showSearch ? 'New Customer' : 'Existing Customer'}
                    </button>
                )}
            </div>
            
            {showSearch ? (
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-2">
                        {filteredCustomers.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    onSelectExisting(c);
                                    setShowSearch(false);
                                }}
                                className="w-full p-3 text-left border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                            >
                                <p className="font-medium text-slate-800">{c.customerName}</p>
                                <p className="text-sm text-slate-500">{c.email}</p>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Name *
                        </label>
                        <input
                            type="text"
                            value={customer.name}
                            onChange={(e) => onChange({ ...customer, name: e.target.value })}
                            placeholder="John Smith"
                            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                                errors.customerName ? 'border-red-500 bg-red-50' : 'border-slate-200'
                            }`}
                        />
                        {errors.customerName && (
                            <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={customer.email}
                            onChange={(e) => onChange({ ...customer, email: e.target.value })}
                            placeholder="john@example.com"
                            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                                errors.customerEmail ? 'border-red-500 bg-red-50' : 'border-slate-200'
                            }`}
                        />
                        {errors.customerEmail && (
                            <p className="text-red-500 text-xs mt-1">{errors.customerEmail}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={customer.phone}
                            onChange={handlePhoneChange}
                            placeholder="(555) 123-4567"
                            maxLength={14}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            <MapPin size={12} className="inline mr-1" />
                            Service Address
                        </label>
                        <input
    ref={addressInputRef}
    type="text"
    defaultValue={customer.address}
    onBlur={(e) => onChange({ ...customer, address: e.target.value })}
    placeholder="123 Main St, City, State"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// LINE ITEMS SECTION
// ============================================
const LineItemsSection = ({ 
    lineItems, 
    onUpdate, 
    onAdd, 
    onRemove, 
    taxRate, 
    onTaxRateChange, 
    errors = {},
    // Deposit Props
    depositRequired,
    depositType,
    depositValue,
    onDepositChange,
    // Price Book Props
    onOpenPriceBook
}) => {
    const updateItem = (id, field, value) => {
        onUpdate(lineItems.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const toggleExpand = (id) => {
        onUpdate(lineItems.map(item => 
            item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
        ));
    };
    
    // CALCS
    const subtotal = lineItems.reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 
        0
    );
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    // Deposit Calc
    let depositAmount = 0;
    if (depositRequired) {
        if (depositType === 'percentage') {
            depositAmount = total * (depositValue / 100);
        } else {
            depositAmount = depositValue;
        }
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calculator size={18} className="text-slate-400" />
                    Line Items
                </h3>
                <div className="flex items-center gap-2">
                    {onOpenPriceBook && (
                        <PriceBookButton onClick={onOpenPriceBook} />
                    )}
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
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto mb-6">
                <table className="w-full min-w-[700px]">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="w-12 text-center text-[10px] font-medium text-slate-400 px-2 py-3">Details</th>
                            <th className="text-left text-xs font-bold text-slate-500 uppercase px-4 py-3 w-24">Type</th>
                            <th className="text-left text-xs font-bold text-slate-500 uppercase px-4 py-3">Description</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-20">Qty</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-32">Unit Price</th>
                            <th className="text-right text-xs font-bold text-slate-500 uppercase px-4 py-3 w-32">Total</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {lineItems.map((item, index) => {
                            const itemType = LINE_ITEM_TYPES.find(t => t.value === item.type) || LINE_ITEM_TYPES[0];
                            const itemError = errors[`lineItems[${index}]`]; 
                            
                            return (
                                <React.Fragment key={item.id}>
                                    <tr className={`group ${item.isExpanded ? 'bg-slate-50/50' : 'bg-white'}`}>
                                        <td className="px-2 py-3 text-center">
                                            {/* Compact toggle button */}
                                            <button 
                                                type="button"
                                                onClick={() => toggleExpand(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title={item.isExpanded ? "Hide details" : "Show details (Brand, Model, Warranty)"}
                                            >
                                                {item.isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={item.type}
                                                onChange={(e) => updateItem(item.id, 'type', e.target.value)}
                                                className={`px-2 py-1 text-xs font-medium rounded ${itemType.color} border-0 focus:ring-2 focus:ring-emerald-500`}
                                            >
                                                {LINE_ITEM_TYPES.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                                placeholder="Item description..."
                                                className={`w-full px-2 py-1 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${
                                                    itemError ? 'border-red-400 bg-red-50' : 'border-slate-200'
                                                }`}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                    className={`w-full pl-6 pr-2 py-1 border rounded-lg text-right focus:ring-2 focus:ring-emerald-500 outline-none ${
                                                        itemError ? 'border-red-400 bg-red-50' : 'border-slate-200'
                                                    }`}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                                            ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-3">
                                            <button
                                                type="button"
                                                onClick={() => onRemove(item.id)}
                                                className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                    
                                    {/* Expanded Details Row */}
                                    {item.isExpanded && (
                                        <tr className="bg-slate-50/80">
                                            <td colSpan="7" className="px-4 py-3">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pl-4 border-l-2 border-emerald-200">
                                                    {item.type === 'material' ? (
                                                        <>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Brand</label>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="e.g. Carrier, Lennox"
                                                                    value={item.brand || ''}
                                                                    onChange={(e) => updateItem(item.id, 'brand', e.target.value)}
                                                                    className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Model #</label>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Model number"
                                                                    value={item.model || ''}
                                                                    onChange={(e) => updateItem(item.id, 'model', e.target.value)}
                                                                    className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Manufacturer Warranty (Specific to Item)</label>
                                                                <div className="relative">
                                                                    <Shield size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="e.g. 10 Year Parts & Compressor"
                                                                        value={item.warranty || ''}
                                                                        onChange={(e) => updateItem(item.id, 'warranty', e.target.value)}
                                                                        className="w-full mt-1 pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Crew Size</label>
                                                                <div className="relative">
                                                                    <Users size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                    <input 
                                                                        type="number" 
                                                                        min="1"
                                                                        placeholder="Number of technicians"
                                                                        value={item.crewSize || ''}
                                                                        onChange={(e) => updateItem(item.id, 'crewSize', e.target.value)}
                                                                        className="w-full mt-1 pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Labor Warranty (Specific to Item)</label>
                                                                <div className="relative">
                                                                    <Shield size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="e.g. 1 Year Guarantee"
                                                                        value={item.warranty || ''}
                                                                        onChange={(e) => updateItem(item.id, 'warranty', e.target.value)}
                                                                        className="w-full mt-1 pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {/* Totals Section */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-t border-slate-100 pt-6">
                
                {/* Deposit Configuration */}
                <div className="w-full md:w-auto">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={depositRequired}
                            onChange={(e) => onDepositChange('depositRequired', e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        Require Deposit
                    </label>
                    
                    {depositRequired && (
                        <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
                            <div className="flex items-center gap-2">
                                <select
                                    value={depositType}
                                    onChange={(e) => onDepositChange('depositType', e.target.value)}
                                    className="px-2 py-1 border border-slate-200 rounded-lg text-sm"
                                >
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed">Fixed Amount</option>
                                </select>
                                <span className="text-sm text-slate-600">
                                    {depositType === 'percentage' ? 'Percent:' : 'Amount:'}
                                </span>
                                <input 
                                    type="number"
                                    value={depositValue}
                                    onChange={(e) => onDepositChange('depositValue', parseFloat(e.target.value) || 0)}
                                    className="w-32 px-3 py-1.5 border border-slate-200 rounded-lg"
                                />
                                {depositType === 'percentage' && <span className="text-slate-500">%</span>}
                            </div>
                            
                            <div className="pt-2 border-t border-slate-200 text-sm flex justify-between">
                                <span className="font-medium text-slate-600">Deposit Amount:</span>
                                <span className="font-bold text-emerald-600">${depositAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    
                    {!depositRequired && (
                        <p className="text-xs text-slate-400 italic">
                            Check this box to request a partial payment upfront.
                        </p>
                    )}
                </div>

                {/* Main Totals */}
                <div className="w-full md:w-72 space-y-2">
                    <div className="flex justify-between text-sm pt-2">
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
    );
};

// ============================================
// SIDEBAR SUMMARY
// ============================================
const QuoteSummary = ({ 
    lineItems, 
    taxRate,
    depositRequired,
    depositType,
    depositValue,
    onSaveDraft, 
    onSend, 
    isSaving,
    isSending
}) => {
    const subtotal = lineItems.reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 
        0
    );
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    // Deposit Calc
    let depositAmount = 0;
    if (depositRequired) {
        if (depositType === 'percentage') {
            depositAmount = total * (depositValue / 100);
        } else {
            depositAmount = depositValue;
        }
    }
    const balanceDue = total - depositAmount;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-4">
            <h3 className="font-bold text-slate-800 mb-4">Quote Summary</h3>
            
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500">Quote Total</p>
                    <p className="text-3xl font-bold text-slate-800">${total.toFixed(2)}</p>
                </div>

                {depositRequired && (
                    <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                            <p className="text-[10px] uppercase font-bold text-emerald-600">Due Now</p>
                            <p className="font-bold text-emerald-800">${depositAmount.toFixed(2)}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-500">Due Later</p>
                            <p className="font-bold text-slate-600">${balanceDue.toFixed(2)}</p>
                        </div>
                    </div>
                )}
                
                <div className="pt-4 border-t border-slate-200 space-y-2">
                    <button 
                        type="button"
                        onClick={onSend}
                        disabled={isSending}
                        className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSending ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                        Send to Customer
                    </button>
                    <button 
                        type="button"
                        onClick={onSaveDraft}
                        disabled={isSaving}
                        className="w-full py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {isSaving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Save Draft
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN QUOTE BUILDER COMPONENT
// ============================================
export const QuoteBuilder = ({ 
    quote = null, 
    customers = [],
    templates = [],
    contractorProfile = null,
    onBack, 
    onSave, 
    onSend,
    onSaveAsTemplate,
    onDuplicate,
    isSaving = false,
    isSending = false
}) => {
    const contractorSettings = contractorProfile?.scheduling || {};
    const isEditing = !!quote;
    const [formData, setFormData] = useState(() => createDefaultFormState(quote, contractorSettings));
    const [showTemplates, setShowTemplates] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [errors, setErrors] = useState({});
    const [showPriceBook, setShowPriceBook] = useState(false);
    // REMOVED: const [isEstimating, setIsEstimating] = useState(false);
    // REMOVED: const [durationEstimate, setDurationEstimate] = useState(null);

    // Reset form when quote changes
    useEffect(() => {
        setFormData(createDefaultFormState(quote, contractorSettings));
    }, [quote?.id, contractorProfile]);

    // Handlers
    const handleCustomerChange = (customer) => {
        setFormData(prev => ({ ...prev, customer }));
        // Clear errors when typing
        if (errors.customerName) setErrors(prev => ({ ...prev, customerName: null }));
        if (errors.customerEmail) setErrors(prev => ({ ...prev, customerEmail: null }));
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
    
    const handleDepositChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Handle Price Book item selection
   // Handle Price Book item selection (Smart Replace)
    const handlePriceBookSelect = (lineItem) => {
        setFormData(prev => {
            // Look for an empty row of the same type to replace
            const emptyRowIndex = prev.lineItems.findIndex(item => 
                item.type === lineItem.type && 
                !item.description?.trim() && 
                (!item.unitPrice || item.unitPrice === 0)
            );
            
            if (emptyRowIndex !== -1) {
                // Replace the empty row with the Price Book item
                const newLineItems = [...prev.lineItems];
                newLineItems[emptyRowIndex] = { 
                    ...lineItem, 
                    id: prev.lineItems[emptyRowIndex].id, // Keep same ID to avoid React key issues
                    isExpanded: true // Expand so user can see what was added
                };
                return { ...prev, lineItems: newLineItems };
            } else {
                // No empty row found, add as new item
                return {
                    ...prev,
                    lineItems: [...prev.lineItems, { ...lineItem, id: Date.now() + Math.random(), isExpanded: true }]
                };
            }
        });
    };

    const handleSelectTemplate = (template) => {
        setFormData(prev => ({
            ...prev,
            title: template.name,
            lineItems: template.lineItems?.map(item => ({
                ...item,
                id: Date.now() + Math.random(),
                unitPrice: item.defaultPrice || item.unitPrice || 0,
                isExpanded: true // Ensure template items are expanded
            })) || prev.lineItems,
            notes: template.defaultNotes || prev.notes,
            terms: template.defaultTerms || prev.terms,
            clientWarranty: template.defaultWarranty || prev.clientWarranty
        }));
        setShowTemplates(false);
        toast.success(`Template "${template.name}" applied`);
    };

    // REMOVED: handleEstimateDuration function

    // Validation
    const validate = () => {
        const newErrors = {};
        
        if (!formData.customer.name?.trim()) {
            newErrors.customerName = 'Customer name is required';
        }
        
        if (!formData.customer.email?.trim()) {
            newErrors.customerEmail = 'Customer email is required';
        } else if (!isValidEmail(formData.customer.email)) {
            newErrors.customerEmail = 'Please enter a valid email address';
        }
        
        if (!formData.title?.trim()) {
            newErrors.title = 'Quote title is required';
        }
        
        if (formData.lineItems.length === 0) {
            newErrors.lineItems = 'At least one line item is required';
        }
        
        // Detailed Line Item Validation
        formData.lineItems.forEach((item, index) => {
            if (!item.description?.trim() || item.unitPrice <= 0) {
                newErrors[`lineItems[${index}]`] = true;
            }
        });
        
        const hasValidItems = formData.lineItems.some(
            item => item.description?.trim() && item.unitPrice > 0
        );
        if (!hasValidItems) {
            newErrors.lineItemsGeneric = 'Please complete line item details (Description & Price)';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save handlers
    const handleSaveDraft = async () => {
        if (!validate()) {
            toast.error('Please fix errors highlighted in red');
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
            toast.error('Please fix errors highlighted in red');
            return;
        }
        
        try {
            await onSend(formData);
        } catch (error) {
            toast.error('Failed to send: ' + error.message);
        }
    };

    // Handle Print Preview
    const handlePrintPreview = () => {
        // Create a printable version of the quote
        const printContent = `
            <html>
            <head>
                <title>Quote - ${formData.title || 'Untitled'}</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #1e293b; font-size: 24px; margin-bottom: 8px; }
                    h2 { color: #475569; font-size: 18px; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
                    .customer { background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; }
                    .customer p { margin: 4px 0; color: #475569; }
                    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
                    th { text-align: left; padding: 12px; background: #f1f5f9; font-size: 12px; text-transform: uppercase; color: #64748b; }
                    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
                    .total-row { font-weight: bold; background: #f0fdf4; }
                    .total-row td { color: #059669; }
                    .notes { background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0; }
                    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
                </style>
            </head>
            <body>
                <h1>${formData.title || 'Quote'}</h1>
                <p style="color: #64748b;">Quote for ${formData.customer?.name || 'Customer'}</p>
                
                <div class="customer">
                    <p><strong>${formData.customer?.name || ''}</strong></p>
                    <p>${formData.customer?.email || ''}</p>
                    <p>${formData.customer?.phone || ''}</p>
                    <p>${formData.customer?.address || ''}</p>
                </div>
                
                <h2>Line Items</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${formData.lineItems.map(item => `
                            <tr>
                                <td>${item.description || 'Item'}</td>
                                <td>${item.quantity || 1}</td>
                                <td>$${(item.unitPrice || 0).toFixed(2)}</td>
                                <td>$${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="3">Total</td>
                            <td>$${formData.lineItems.reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                
                ${formData.notes ? `<div class="notes"><strong>Notes:</strong><br/>${formData.notes}</div>` : ''}
                ${formData.clientWarranty ? `<p><strong>Warranty:</strong> ${formData.clientWarranty}</p>` : ''}
                ${formData.terms ? `<p><strong>Terms:</strong> ${formData.terms}</p>` : ''}
                
                <div class="footer">
                    <p>Generated on ${new Date().toLocaleDateString()}</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    // Handle Duplicate Quote
    const handleDuplicateQuote = () => {
        if (onDuplicate) {
            onDuplicate(formData);
            toast.success('Quote duplicated - edit the copy below');
        } else {
            // If no handler provided, just clear the ID to treat as new
            setFormData(prev => ({
                ...prev,
                id: null,
                quoteNumber: null,
                status: 'draft'
            }));
            toast.success('Quote duplicated - this is now a new quote');
        }
    };

    // Handle Save as Template
    const handleSaveAsTemplate = async () => {
        if (!templateName.trim()) {
            toast.error('Please enter a template name');
            return;
        }
        
        if (!onSaveAsTemplate) {
            toast.error('Save as template not available');
            return;
        }
        
        setSavingTemplate(true);
        try {
            await onSaveAsTemplate({
                name: templateName.trim(),
                category: 'general',
                lineItems: formData.lineItems.map(item => ({
                    type: item.type,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    brand: item.brand,
                    model: item.model,
                    warranty: item.warranty,
                })),
                defaultNotes: formData.notes,
                defaultTerms: formData.terms,
                defaultWarranty: formData.clientWarranty,
            });
            toast.success(`Template "${templateName}" saved!`);
            setShowSaveTemplateModal(false);
            setTemplateName('');
        } catch (error) {
            toast.error('Failed to save template: ' + error.message);
        } finally {
            setSavingTemplate(false);
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
                            {isEditing ? 'Make changes to your quote' : 'Create a professional quote for your customer'}
                        </p>
                    </div>
                </div>
                
                {templates.length > 0 && !isEditing && (
                    <button
                        type="button"
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                        <Sparkles size={16} className="text-amber-500" />
                        Use Template
                    </button>
                )}
            </div>
            
            {/* Template Picker */}
            {showTemplates && (
                <TemplatePicker 
                    templates={templates} 
                    onSelect={handleSelectTemplate}
                    onClose={() => setShowTemplates(false)}
                />
            )}
            
            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left col - Main form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Info */}
                    <CustomerForm
                        customer={formData.customer}
                        onChange={handleCustomerChange}
                        onSelectExisting={handleSelectExistingCustomer}
                        existingCustomers={customers}
                        errors={errors}
                    />
                    
                    {/* Quote Details */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" />
                            Quote Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Quote Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g. HVAC System Replacement"
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                                        errors.title ? 'border-red-500 bg-red-50' : 'border-slate-200'
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
                            {/* SIMPLIFIED: Estimated Duration - AI removed */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    <Timer size={12} className="inline mr-1" />
                                    Estimated Duration
                                </label>
                                <input
                                    type="text"
                                    value={formData.estimatedDuration}
                                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                                    placeholder="e.g. 4 hours, 2 days"
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
                        errors={errors}
                        // Deposit Props
                        depositRequired={formData.depositRequired}
                        depositType={formData.depositType}
                        depositValue={formData.depositValue}
                        onDepositChange={handleDepositChange}
                        // Price Book Props
                        onOpenPriceBook={() => setShowPriceBook(true)}
                    />
                    {(errors.lineItemsGeneric) && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-center gap-2">
                            <AlertCircle size={16} />
                            {errors.lineItemsGeneric}
                        </div>
                    )}
                    
                    {/* Notes, Exclusions & Terms */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4">Notes & Terms</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Scope Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Details about the work..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                />
                            </div>

                             {/* NEW EXCLUSIONS FIELD - With Optional Tag */}
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Exclusions <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                </label>
                                <textarea
                                    value={formData.exclusions}
                                    onChange={(e) => setFormData(prev => ({ ...prev, exclusions: e.target.value }))}
                                    placeholder="e.g. Paint, Drywall patch, Removal of old debris..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                />
                            </div>

                            {/* Global Warranty Field - UPDATED LABEL */}
                            <div>
                                <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Shield size={12} /> Labor/Workmanship Warranty
                                </label>
                                <p className="text-[10px] text-slate-400 mb-1">
                                    Your guarantee on the installation work
                                </p>
                                <input 
                                    type="text"
                                    value={formData.clientWarranty}
                                    onChange={(e) => setFormData(prev => ({ ...prev, clientWarranty: e.target.value }))}
                                    placeholder="e.g. 1 Year Labor Warranty on all work performed"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
                        depositRequired={formData.depositRequired}
                        depositType={formData.depositType}
                        depositValue={formData.depositValue}
                        onSaveDraft={handleSaveDraft}
                        onSend={handleSendQuote}
                        isSaving={isSaving}
                        isSending={isSending}
                    />
                    
                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</p>
                        <div className="space-y-2">
                            {onSaveAsTemplate && (
                                <button 
                                    type="button"
                                    onClick={() => setShowSaveTemplateModal(true)}
                                    className="w-full p-3 text-left text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <Sparkles size={16} className="text-emerald-600" />
                                    Save as Template
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={handleDuplicateQuote}
                                className="w-full p-3 text-left text-sm text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <Copy size={16} className="text-slate-400" />
                                Duplicate Quote
                            </button>
                            <button 
                                type="button"
                                onClick={handlePrintPreview}
                                className="w-full p-3 text-left text-sm text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                            >
                                <Printer size={16} className="text-slate-400" />
                                Print Preview
                            </button>
                        </div>
                    </div>

                    {/* Save as Template Modal */}
                    {showSaveTemplateModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Save as Template</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Save this quote's line items as a reusable template for future quotes.
                                </p>
                                
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Template Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        placeholder="e.g., AC Installation, HVAC Tune-Up"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        autoFocus
                                    />
                                </div>
                                
                                <div className="p-3 bg-slate-50 rounded-xl mb-4">
                                    <p className="text-xs font-medium text-slate-500 mb-2">Will include:</p>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                        <li>• {formData.lineItems.length} line item{formData.lineItems.length !== 1 ? 's' : ''}</li>
                                        {formData.notes && <li>• Notes</li>}
                                        {formData.clientWarranty && <li>• Warranty terms</li>}
                                        {formData.terms && <li>• Terms & conditions</li>}
                                    </ul>
                                </div>
                                
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowSaveTemplateModal(false);
                                            setTemplateName('');
                                        }}
                                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAsTemplate}
                                        disabled={savingTemplate || !templateName.trim()}
                                        className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {savingTemplate ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Sparkles size={18} />
                                        )}
                                        Save Template
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Price Book Picker Modal */}
            {showPriceBook && (
                <PriceBookPicker
                    contractorId={contractorProfile?.id || contractorProfile?.uid}
                    onSelect={handlePriceBookSelect}
                    onClose={() => setShowPriceBook(false)}
                    selectedItems={formData.lineItems.filter(item => item.priceBookItemId).map(item => item.priceBookItemId)}
                />
            )}
        </div>
    );
};

export default QuoteBuilder;
