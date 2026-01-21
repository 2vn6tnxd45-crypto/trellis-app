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
import { createIntentFromLineItem, getDefaultMaintenanceTasks, FREQUENCY_OPTIONS } from '../../../lib/inventoryIntent';

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
        const newTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            task: taskName,
            frequency: 'annual',
            months: 12,
            selected: true
        };

        updateField('inventoryIntent', {
            ...item.inventoryIntent,
            maintenanceTasks: [...currentTasks, newTask],
            updatedAt: new Date().toISOString()
        });
    };

    const deleteMaintenanceTask = (idx) => {
        const currentTasks = item.inventoryIntent?.maintenanceTasks || [];
        const newTasks = currentTasks.filter((_, i) => i !== idx);

        updateField('inventoryIntent', {
            ...item.inventoryIntent,
            maintenanceTasks: newTasks,
            updatedAt: new Date().toISOString()
        });
    };

    const updateTaskFrequency = (idx, frequency) => {
        const currentTasks = item.inventoryIntent?.maintenanceTasks || [];
        const newTasks = [...currentTasks];
        const freqOption = FREQUENCY_OPTIONS.find(f => f.value === frequency);

        if (newTasks[idx]) {
            newTasks[idx] = {
                ...newTasks[idx],
                frequency: frequency,
                months: freqOption?.months || 12
            };

            updateField('inventoryIntent', {
                ...item.inventoryIntent,
                maintenanceTasks: newTasks,
                updatedAt: new Date().toISOString()
            });
        }
    };

    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md group">
            {/* Main Content - Two-row layout for better horizontal space */}
            <div className="p-4 space-y-3">
                {/* Row 1: Toggle + Type + Description */}
                <div className="flex items-start gap-3">
                    {/* Expand/Collapse Toggle */}
                    <button
                        type="button"
                        onClick={() => updateField('isExpanded', !item.isExpanded)}
                        className={`mt-6 p-1.5 rounded-lg transition-all shrink-0 ${item.isExpanded
                            ? 'bg-slate-100 text-slate-600'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    >
                        {item.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {/* Type Selector */}
                    <div className="w-40 shrink-0">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Type</label>
                        <select
                            value={item.type}
                            onChange={(e) => updateField('type', e.target.value)}
                            className={`w-full text-xs font-semibold px-3 py-2.5 rounded-xl border-0 cursor-pointer transition-all ${
                                item.type === 'material'
                                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            } focus:ring-2 focus:ring-emerald-500`}
                        >
                            {LINE_ITEM_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Description - Now has room to breathe */}
                    <div className="flex-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Description</label>
                        <div className="relative">
                            <TypeIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateField('description', e.target.value)}
                                placeholder={item.type === 'material' ? 'e.g., Carrier Furnace 80K BTU' : 'e.g., HVAC Installation Labor'}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Delete button - top right for easy access */}
                    {!isOnly && (
                        <button
                            type="button"
                            onClick={() => onRemove(item.id)}
                            className="mt-6 p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            title="Remove item"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                {/* Row 2: Qty + Price + Total */}
                <div className="flex items-center gap-4 pl-10">
                    {/* Qty */}
                    <div className="w-24">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Qty</label>
                        <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-center text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    {/* Unit Price */}
                    <div className="w-32">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Unit Price</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => updateField('unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl text-right text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Line Total */}
                    <div className="flex-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Line Total</label>
                        <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-800 text-base">${lineTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Details - Home Record Section */}
            {item.isExpanded && (
                <div className="px-5 pb-5 pt-4 bg-gradient-to-b from-slate-50 to-slate-100/50 border-t border-slate-100">
                    {/* Section Header */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Home size={14} className="text-emerald-600" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-700">Home Record Details</span>
                            <span className="text-[10px] text-slate-500 ml-2">(automatically added to customer's records)</span>
                        </div>
                    </div>

                    {/* Fields Grid - Cleaner layout */}
                    <div className="grid grid-cols-4 gap-4 mb-5">
                        {/* Category */}
                        <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Category</label>
                            <select
                                value={item.category}
                                onChange={(e) => updateField('category', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {item.type === 'material' ? (
                            <>
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Brand</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Carrier"
                                        value={item.brand || ''}
                                        onChange={(e) => updateField('brand', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Model #</label>
                                    <input
                                        type="text"
                                        placeholder="Model number"
                                        value={item.model || ''}
                                        onChange={(e) => updateField('model', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Warranty</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 10 Year Parts"
                                        value={item.warranty || ''}
                                        onChange={(e) => updateField('warranty', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="col-span-3">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Labor Warranty</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 1 Year Workmanship Guarantee"
                                        value={item.warranty || ''}
                                        onChange={(e) => updateField('warranty', e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Auto-Scheduled Maintenance Section - More visual */}
                    <div className="pt-4 border-t border-slate-200/80">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                Auto-scheduled Maintenance
                            </p>
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {item.inventoryIntent?.maintenanceTasks?.filter(t => t.selected !== false).length || 0} tasks active
                            </span>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            {item.inventoryIntent?.maintenanceTasks?.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {item.inventoryIntent.maintenanceTasks.map((task, idx) => (
                                        <div key={task.id || idx} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group/task">
                                            {/* Checkbox */}
                                            <input
                                                type="checkbox"
                                                checked={task.selected !== false}
                                                onChange={() => toggleMaintenanceTask(idx)}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                            {/* Task name */}
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-sm font-medium ${task.selected !== false ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                                                    {task.task}
                                                </span>
                                            </div>
                                            {/* Frequency dropdown */}
                                            <select
                                                value={task.frequency}
                                                onChange={(e) => updateTaskFrequency(idx, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className={`text-xs font-medium px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                                                    task.selected !== false
                                                        ? 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300'
                                                        : 'border-slate-100 bg-slate-50 text-slate-400'
                                                } focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500`}
                                            >
                                                {FREQUENCY_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteMaintenanceTask(idx);
                                                }}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover/task:opacity-100"
                                                title="Delete task"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 px-4 py-3 italic">
                                    No maintenance tasks. Add one below.
                                </p>
                            )}

                            {/* Add Custom Task */}
                            <div className="flex gap-2 p-3 bg-slate-50 border-t border-slate-100">
                                <input
                                    type="text"
                                    id={`new-task-${item.id}`}
                                    placeholder="Add custom maintenance task..."
                                    className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-400"
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
                                    className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-colors"
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
const JobLineItemsSection = ({
    lineItems,
    onChange,
    // Tax and deposit props
    taxRate = 0,
    onTaxRateChange,
    depositRequired = false,
    onDepositRequiredChange,
    depositType = 'percentage',
    onDepositTypeChange,
    depositValue = 50,
    onDepositValueChange,
    depositCollected = false,
    onDepositCollectedChange
}) => {
    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => {
        return sum + ((item.quantity || 0) * (item.unitPrice || 0));
    }, 0);

    // Calculate tax and total
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Calculate deposit amount
    let depositAmount = 0;
    if (depositRequired && !depositCollected) {
        if (depositType === 'percentage') {
            depositAmount = total * (depositValue / 100);
        } else {
            depositAmount = depositValue || 0;
        }
    }

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
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <Package size={18} className="text-slate-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-700">
                        Line Items & Home Records
                    </h3>
                    <p className="text-xs text-slate-500">
                        Items added here effectively build the home's history
                    </p>
                </div>
            </div>

            {/* Info Banner - More subtle and integrated */}
            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Home size={16} className="text-emerald-600" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-emerald-800">Smart Inventory Tracking</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                        We automatically set up maintenance schedules based on the category you select. Expand an item to customize.
                    </p>
                </div>
            </div>

            {/* Line Items List */}
            <div className="space-y-4">
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

            {/* Add Buttons - More distinctive */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => addLineItem('material')}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-semibold bg-white text-blue-700 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl transition-all group"
                >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Package size={16} className="text-blue-600" />
                    </div>
                    Add Material / Equipment
                </button>
                <button
                    type="button"
                    onClick={() => addLineItem('labor')}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5 text-sm font-semibold bg-white text-amber-700 border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 rounded-xl transition-all group"
                >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                        <Wrench size={16} className="text-amber-600" />
                    </div>
                    Add Labor / Service
                </button>
            </div>

            {/* Totals Section - Tax, Deposit, and Grand Total */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold text-slate-700">${subtotal.toFixed(2)}</span>
                </div>

                {/* Tax Rate */}
                {onTaxRateChange && (
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-600">Tax Rate</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={taxRate}
                                onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                min="0"
                                max="100"
                                step="0.25"
                            />
                            <span className="text-sm text-slate-500">%</span>
                            <span className="text-sm font-medium text-slate-600 ml-2">${taxAmount.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Deposit Section */}
                {onDepositRequiredChange && (
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={depositRequired}
                                onChange={(e) => onDepositRequiredChange(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium text-slate-700">Require Deposit</span>
                        </label>

                        {depositRequired && (
                            <div className="ml-7 space-y-3">
                                {/* Deposit type and value */}
                                <div className="flex items-center gap-3">
                                    <select
                                        value={depositType}
                                        onChange={(e) => onDepositTypeChange(e.target.value)}
                                        className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    >
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed Amount</option>
                                    </select>
                                    <div className="flex items-center gap-1">
                                        {depositType === 'fixed' && <span className="text-slate-500">$</span>}
                                        <input
                                            type="number"
                                            value={depositValue}
                                            onChange={(e) => onDepositValueChange(parseFloat(e.target.value) || 0)}
                                            className="w-20 px-2 py-1.5 text-sm text-right border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                            min="0"
                                            max={depositType === 'percentage' ? 100 : undefined}
                                        />
                                        {depositType === 'percentage' && <span className="text-slate-500">%</span>}
                                    </div>
                                </div>

                                {/* Deposit amount display */}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Deposit Due</span>
                                    <span className="font-semibold text-amber-600">${depositAmount.toFixed(2)}</span>
                                </div>

                                {/* Already collected checkbox */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={depositCollected}
                                        onChange={(e) => onDepositCollectedChange(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-xs text-slate-500">Deposit already collected</span>
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-slate-300">
                    <span className="text-base font-bold text-slate-700">Total</span>
                    <span className="text-xl font-extrabold text-emerald-600">${total.toFixed(2)}</span>
                </div>

                {/* Balance due if deposit required */}
                {depositRequired && !depositCollected && depositAmount > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Balance Due at Completion</span>
                        <span className="font-medium">${(total - depositAmount).toFixed(2)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobLineItemsSection;
export { createNewLineItem };
