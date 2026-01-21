// src/features/jobs/components/JobLineItemsSection.jsx
// ============================================
// LINE ITEMS SECTION FOR JOB CREATION
// ============================================
// Every line item automatically creates an inventory intent for the homeowner's records.
// This ensures the data flows: Job → Completion → Homeowner Inventory

import React, { useState } from 'react';
import {
    Plus, Trash2, ChevronDown, ChevronUp, Package, Wrench,
    DollarSign, Info, Home
} from 'lucide-react';
import { createIntentFromLineItem, getDefaultMaintenanceTasks } from '../../../lib/inventoryIntent';

// ============================================
// CONSTANTS
// ============================================

const LINE_ITEM_TYPES = [
    { value: 'material', label: 'Material/Equipment', icon: Package, color: 'bg-blue-100 text-blue-700' },
    { value: 'labor', label: 'Labor/Service', icon: Wrench, color: 'bg-amber-100 text-amber-700' }
];

const CATEGORIES = [
    'HVAC & Systems',
    'Plumbing',
    'Electrical',
    'Appliances',
    'Roof & Exterior',
    'Interior',
    'Safety',
    'Landscaping',
    'Service & Repairs',
    'Paint & Finishes',
    'Flooring',
    'Pest Control',
    'Other'
];

// ============================================
// HELPER: Generate unique ID
// ============================================
const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// HELPER: Create new line item with inventory intent
// ============================================
const createNewLineItem = (type = 'material') => {
    const id = generateId();
    const item = {
        id,
        type,
        description: '',
        quantity: 1,
        unitPrice: 0,
        // Material/Equipment fields
        brand: '',
        model: '',
        warranty: '',
        category: 'Service & Repairs',
        // UI state
        isExpanded: true
    };

    // Auto-create inventory intent
    item.inventoryIntent = createIntentFromLineItem(item);

    return item;
};

// ============================================
// SINGLE LINE ITEM ROW
// ============================================
const LineItemRow = ({ item, onUpdate, onRemove, isOnly }) => {
    const typeConfig = LINE_ITEM_TYPES.find(t => t.value === item.type) || LINE_ITEM_TYPES[0];
    const TypeIcon = typeConfig.icon;
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);

    const updateField = (field, value) => {
        const updated = { ...item, [field]: value };

        // When category changes, update maintenance tasks in intent
        if (field === 'category') {
            const newTasks = getDefaultMaintenanceTasks(value);
            updated.inventoryIntent = {
                ...updated.inventoryIntent,
                category: value,
                maintenanceTasks: newTasks,
                updatedAt: new Date().toISOString()
            };
        }

        // Keep inventory intent in sync with line item data
        if (['description', 'brand', 'model', 'warranty'].includes(field)) {
            updated.inventoryIntent = {
                ...updated.inventoryIntent,
                [field === 'description' ? 'item' : field]: value,
                updatedAt: new Date().toISOString()
            };
        }

        // Update cost in intent
        if (['quantity', 'unitPrice'].includes(field)) {
            const newTotal = (field === 'quantity' ? value : item.quantity) *
                            (field === 'unitPrice' ? value : item.unitPrice);
            updated.inventoryIntent = {
                ...updated.inventoryIntent,
                cost: newTotal,
                updatedAt: new Date().toISOString()
            };
        }

        onUpdate(updated);
    };

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            {/* Main Row */}
            <div className="p-3 flex items-start gap-3">
                {/* Expand/Collapse */}
                <button
                    type="button"
                    onClick={() => updateField('isExpanded', !item.isExpanded)}
                    className="mt-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                    {item.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {/* Type Badge */}
                <div className="mt-1.5">
                    <select
                        value={item.type}
                        onChange={(e) => updateField('type', e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${typeConfig.color}`}
                    >
                        {LINE_ITEM_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Description */}
                <div className="flex-1">
                    <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder={item.type === 'material' ? 'e.g., Carrier Furnace 80K BTU' : 'e.g., HVAC Installation Labor'}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>

                {/* Quantity */}
                <div className="w-20">
                    <label className="text-[10px] font-medium text-slate-400 uppercase">Qty</label>
                    <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {/* Unit Price */}
                <div className="w-28">
                    <label className="text-[10px] font-medium text-slate-400 uppercase">Price</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateField('unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                {/* Line Total */}
                <div className="w-24 text-right pt-5">
                    <span className="font-semibold text-slate-800">${lineTotal.toFixed(2)}</span>
                </div>

                {/* Delete */}
                <button
                    type="button"
                    onClick={() => !isOnly && onRemove(item.id)}
                    disabled={isOnly}
                    className={`mt-5 p-1.5 rounded-lg transition-colors ${
                        isOnly
                            ? 'text-slate-200 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Expanded Details */}
            {item.isExpanded && (
                <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Home size={14} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                            Home Record Details
                        </span>
                        <span className="text-[10px] text-slate-500">
                            (automatically added to customer's records upon completion)
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Category */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                            <select
                                value={item.category}
                                onChange={(e) => updateField('category', e.target.value)}
                                className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {item.type === 'material' ? (
                            <>
                                {/* Brand */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Brand</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Carrier, Rheem"
                                        value={item.brand || ''}
                                        onChange={(e) => updateField('brand', e.target.value)}
                                        className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                {/* Model */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Model #</label>
                                    <input
                                        type="text"
                                        placeholder="Model number"
                                        value={item.model || ''}
                                        onChange={(e) => updateField('model', e.target.value)}
                                        className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                {/* Warranty */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Warranty</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 10 Year Parts"
                                        value={item.warranty || ''}
                                        onChange={(e) => updateField('warranty', e.target.value)}
                                        className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Labor Warranty */}
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Labor Warranty</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 1 Year Workmanship Guarantee"
                                        value={item.warranty || ''}
                                        onChange={(e) => updateField('warranty', e.target.value)}
                                        className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                {/* Placeholder for grid alignment */}
                                <div></div>
                            </>
                        )}
                    </div>

                    {/* Maintenance Tasks Preview */}
                    {item.inventoryIntent?.maintenanceTasks?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                Auto-scheduled Maintenance ({item.inventoryIntent.maintenanceTasks.filter(t => t.selected !== false).length} tasks)
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {item.inventoryIntent.maintenanceTasks
                                    .filter(t => t.selected !== false)
                                    .slice(0, 3)
                                    .map((task, idx) => (
                                        <span
                                            key={idx}
                                            className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full"
                                        >
                                            {task.task} ({task.frequency})
                                        </span>
                                    ))}
                                {item.inventoryIntent.maintenanceTasks.filter(t => t.selected !== false).length > 3 && (
                                    <span className="text-[10px] text-slate-500">
                                        +{item.inventoryIntent.maintenanceTasks.filter(t => t.selected !== false).length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
const JobLineItemsSection = ({ lineItems, onChange }) => {
    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.unitPrice || 0));
    }, 0);

    const addLineItem = (type = 'material') => {
        const newItem = createNewLineItem(type);
        onChange([...lineItems, newItem]);
    };

    const updateLineItem = (updated) => {
        onChange(lineItems.map(item => item.id === updated.id ? updated : item));
    };

    const removeLineItem = (id) => {
        if (lineItems.length > 1) {
            onChange(lineItems.filter(item => item.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        <Package size={14} />
                        Line Items
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Items and labor for this job (added to customer's home records)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => addLineItem('material')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                        <Package size={12} />
                        Add Material
                    </button>
                    <button
                        type="button"
                        onClick={() => addLineItem('labor')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                        <Wrench size={12} />
                        Add Labor
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Home size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-700">
                    <p className="font-semibold">Every item becomes a home record</p>
                    <p className="text-emerald-600 mt-0.5">
                        When this job is completed, all items will be added to the customer's inventory with maintenance schedules, warranty tracking, and your contact info for easy rebooking.
                    </p>
                </div>
            </div>

            {/* Line Items List */}
            <div className="space-y-3">
                {lineItems.map(item => (
                    <LineItemRow
                        key={item.id}
                        item={item}
                        onUpdate={updateLineItem}
                        onRemove={removeLineItem}
                        isOnly={lineItems.length === 1}
                    />
                ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end">
                <div className="w-64 space-y-2 p-4 bg-slate-50 rounded-xl">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-medium text-slate-800">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                        <span className="text-slate-700">Total</span>
                        <span className="text-emerald-600">${subtotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobLineItemsSection;
export { createNewLineItem };
