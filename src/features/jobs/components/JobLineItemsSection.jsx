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

    const toggleMaintenanceTask = (idx) => {
        const currentTasks = item.inventoryIntent?.maintenanceTasks || [];
        const newTasks = [...currentTasks];
        if (newTasks[idx]) {
            newTasks[idx] = { ...newTasks[idx], selected: !newTasks[idx].selected };

            updateField('inventoryIntent', {
                ...item.inventoryIntent,
                maintenanceTasks: newTasks,
                updatedAt: new Date().toISOString()
            });
        }
    };

    const addMaintenanceTask = (taskName) => {
        const currentTasks = item.inventoryIntent?.maintenanceTasks || [];
        const newTask = { task: taskName, frequency: 'Annual', selected: true, timeframe: 12 };

        updateField('inventoryIntent', {
            ...item.inventoryIntent,
            maintenanceTasks: [...currentTasks, newTask],
            updatedAt: new Date().toISOString()
        });
    };

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
            {/* Main Row - Grid Layout for Alignment */}
            <div className="p-3 grid grid-cols-12 gap-3 items-start">
                {/* Col 1: Expand & Type (Span 3) */}
                <div className="col-span-12 sm:col-span-3 flex gap-2">
                    <button
                        type="button"
                        onClick={() => updateField('isExpanded', !item.isExpanded)}
                        className="mt-1.5 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                        {item.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                        <select
                            value={item.type}
                            onChange={(e) => updateField('type', e.target.value)}
                            className={`w-full text-xs font-medium px-2 py-2 rounded-lg border-0 cursor-pointer ${typeConfig.color} focus:ring-2 focus:ring-emerald-500`}
                        >
                            {LINE_ITEM_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Col 2: Description (Span 4) */}
                <div className="col-span-12 sm:col-span-5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Description</label>
                    <div className="relative">
                        <TypeIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateField('description', e.target.value)}
                            placeholder={item.type === 'material' ? 'e.g., Carrier Furnace 80K BTU' : 'e.g., HVAC Installation Labor'}
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                </div>

                {/* Col 3: Qty (Span 1) */}
                <div className="col-span-4 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Qty</label>
                    <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-center text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {/* Col 4: Price (Span 2) */}
                <div className="col-span-5 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Price</label>
                    <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateField('unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-2 border border-slate-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                {/* Col 5: Total & Delete (Span 1) */}
                <div className="col-span-3 sm:col-span-1 flex flex-col items-end justify-between h-full pt-6">
                    <span className="font-bold text-slate-700 text-sm">${lineTotal.toFixed(2)}</span>
                    <button
                        type="button"
                        onClick={() => !isOnly && onRemove(item.id)}
                        disabled={isOnly}
                        className={`p-1.5 rounded-lg transition-colors ${isOnly
                                ? 'text-slate-200 cursor-not-allowed hidden'
                                : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                            }`}
                        title="Remove item"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
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
                            (automatically added to customer's records)
                        </span>
                    </div>

                    {/* Fields Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Brand</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Carrier"
                                        value={item.brand || ''}
                                        onChange={(e) => updateField('brand', e.target.value)}
                                        className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
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
                                <div></div>
                            </>
                        )}
                    </div>

                    {/* Auto-Scheduled Maintenance Section */}
                    <div className="mt-4 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                Auto-scheduled Maintenance
                            </p>
                            <span className="text-[10px] text-emerald-600 font-medium">
                                {item.inventoryIntent?.maintenanceTasks?.filter(t => t.selected !== false).length || 0} tasks active
                            </span>
                        </div>

                        <div className="space-y-2 bg-white rounded-lg border border-slate-200 p-2">
                            {item.inventoryIntent?.maintenanceTasks?.length > 0 ? (
                                <div className="space-y-2">
                                    {item.inventoryIntent.maintenanceTasks.map((task, idx) => (
                                        <label key={idx} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={task.selected !== false}
                                                onChange={() => toggleMaintenanceTask(idx)}
                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <div className="flex-1 text-xs">
                                                <span className={`font-medium ${task.selected !== false ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                                                    {task.task}
                                                </span>
                                                <span className="text-slate-400 ml-2 text-[10px] uppercase">
                                                    {task.frequency}
                                                </span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 p-2 italic">
                                    No default maintenance tasks for this category.
                                </p>
                            )}

                            {/* Add Custom Task */}
                            <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                                <input
                                    type="text"
                                    id={`new-task-${item.id}`}
                                    placeholder="Add custom maintenance task..."
                                    className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (e.target.value.trim()) {
                                                addMaintenanceTask(e.target.value.trim());
                                                e.target.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = document.getElementById(`new-task-${item.id}`);
                                        if (input && input.value.trim()) {
                                            addMaintenanceTask(input.value.trim());
                                            input.value = '';
                                        }
                                    }}
                                    className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
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
                        Line Items & Home Records
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Items added here effectively build the home's history
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Home size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-700">
                    <p className="font-semibold">Smart Inventory Tracking</p>
                    <p className="text-emerald-600 mt-0.5">
                        We automatically set up maintenance schedules based on the category you select. Expand an item to customize.
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

            {/* Add Buttons - Prominent & Full Width */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => addLineItem('material')}
                    className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl transition-all shadow-sm hover:shadow"
                >
                    <Package size={16} />
                    Add Material / Equipment
                </button>
                <button
                    type="button"
                    onClick={() => addLineItem('labor')}
                    className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl transition-all shadow-sm hover:shadow"
                >
                    <Wrench size={16} />
                    Add Labor / Service
                </button>
            </div>

            {/* Totals */}
            <div className="flex justify-end border-t border-slate-100 pt-4 mt-4">
                <div className="w-full sm:w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600 font-medium">Subtotal</span>
                        <span className="font-bold text-slate-800">${subtotal.toFixed(2)}</span>
                    </div>
                    {/* Tax could go here */}
                    <div className="flex justify-between text-lg font-extrabold text-emerald-600 pt-2 border-t border-slate-200 border-dashed">
                        <span>Total</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobLineItemsSection;
export { createNewLineItem };
