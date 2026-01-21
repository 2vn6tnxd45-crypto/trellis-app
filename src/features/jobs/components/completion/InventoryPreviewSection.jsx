// src/features/jobs/components/completion/InventoryPreviewSection.jsx
// ============================================
// INVENTORY PREVIEW SECTION
// ============================================
// Shows items that will be added to home inventory with edit capabilities

import React, { useState } from 'react';
import {
    Package, Wrench, Droplet, Zap, Flame, Wind, Shield,
    Calendar, Clock, ChevronDown, ChevronUp, Edit3, Check,
    X, AlertTriangle, Bell, ToggleLeft, ToggleRight, Info
} from 'lucide-react';

// Category icon mapping
const CATEGORY_ICONS = {
    'HVAC': Wind,
    'Plumbing': Droplet,
    'Electrical': Zap,
    'Appliances': Package,
    'Heating': Flame,
    'Exterior': Shield,
    'Service & Repairs': Wrench,
    'default': Package
};

// Get icon for category
const getCategoryIcon = (category) => {
    // Ensure category is a string (defensive against object fields)
    const categoryStr = typeof category === 'string' ? category : String(category || '');
    return CATEGORY_ICONS[categoryStr] || CATEGORY_ICONS['default'];
};

// Safely convert any value to a displayable string
const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        // Handle Firestore Timestamps
        if (value.toDate) return value.toDate().toLocaleDateString();
        // Handle Date objects
        if (value instanceof Date) return value.toLocaleDateString();
        // For other objects, return empty string to prevent React error #310
        console.warn('[InventoryPreviewSection] Attempted to render object:', value);
        return '';
    }
    return String(value);
};

// Calculate warranty expiration
const calculateWarrantyExpiration = (warrantyDetails, installDate) => {
    if (!warrantyDetails?.hasCoverage || !warrantyDetails?.years) return null;

    const startDate = new Date(warrantyDetails.startDate || installDate || new Date());
    const expirationDate = new Date(startDate);
    expirationDate.setFullYear(expirationDate.getFullYear() + warrantyDetails.years);

    return {
        date: expirationDate,
        formatted: expirationDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }),
        isExpired: expirationDate < new Date()
    };
};

// Calculate next maintenance date
const calculateNextMaintenanceDate = (maintenanceTasks, installDate) => {
    if (!maintenanceTasks || maintenanceTasks.length === 0) return null;

    const selectedTasks = maintenanceTasks.filter(t => t.selected !== false);
    if (selectedTasks.length === 0) return null;

    const frequencyMonths = {
        'monthly': 1,
        'quarterly': 3,
        'semiannual': 6,
        'annual': 12,
        'every 2 years': 24,
        'biennial': 24
    };

    // Find shortest interval
    let shortestMonths = Infinity;
    let nextTask = null;

    selectedTasks.forEach(task => {
        const months = task.months || frequencyMonths[task.frequency] || 12;
        if (months < shortestMonths) {
            shortestMonths = months;
            nextTask = task;
        }
    });

    if (!nextTask) return null;

    const startDate = new Date(installDate || new Date());
    const nextDate = new Date(startDate);
    nextDate.setMonth(nextDate.getMonth() + shortestMonths);

    return {
        date: nextDate,
        formatted: nextDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }),
        task: nextTask.task
    };
};

// ============================================
// INVENTORY ITEM CARD
// ============================================
const InventoryItemCard = ({
    item,
    index,
    isIncluded,
    onToggleInclude,
    onEdit,
    editable,
    showMaintenanceInfo
}) => {
    const [expanded, setExpanded] = useState(false);

    const CategoryIcon = getCategoryIcon(item.category);
    const warrantyExpiration = calculateWarrantyExpiration(item.warrantyDetails, item.dateInstalled);
    const nextMaintenance = calculateNextMaintenanceDate(item.maintenanceTasks, item.dateInstalled);

    // Get selected maintenance tasks
    const selectedTasks = (item.maintenanceTasks || []).filter(t => t.selected !== false);

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${
            isIncluded
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-slate-50 border-slate-200 opacity-60'
        }`}>
            {/* Header */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Include toggle */}
                    {editable && (
                        <button
                            onClick={() => onToggleInclude(item.id)}
                            className={`shrink-0 mt-1 transition-colors ${
                                isIncluded ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                            title={isIncluded ? 'Click to skip this item' : 'Click to include this item'}
                        >
                            {isIncluded ? (
                                <ToggleRight size={24} />
                            ) : (
                                <ToggleLeft size={24} />
                            )}
                        </button>
                    )}

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncluded ? 'bg-emerald-100' : 'bg-slate-200'
                    }`}>
                        <CategoryIcon size={20} className={isIncluded ? 'text-emerald-600' : 'text-slate-400'} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h4 className={`font-bold truncate ${
                                    isIncluded ? 'text-slate-800' : 'text-slate-500 line-through'
                                }`}>
                                    {safeString(item.item) || safeString(item.description) || 'Item'}
                                </h4>
                                <p className="text-sm text-slate-500 truncate">
                                    {[safeString(item.brand), safeString(item.model)].filter(Boolean).join(' • ') || safeString(item.category) || 'Equipment'}
                                </p>
                            </div>

                            {/* Edit button */}
                            {editable && isIncluded && (
                                <button
                                    onClick={() => onEdit(item)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                                    title="Edit item details"
                                >
                                    <Edit3 size={16} />
                                </button>
                            )}
                        </div>

                        {/* Quick info badges */}
                        {isIncluded && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {item.cost && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                                        ${parseFloat(item.cost).toLocaleString()}
                                    </span>
                                )}
                                {warrantyExpiration && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                                        warrantyExpiration.isExpired
                                            ? 'bg-red-100 text-red-600'
                                            : 'bg-blue-100 text-blue-600'
                                    }`}>
                                        <Shield size={10} />
                                        {warrantyExpiration.isExpired ? 'Warranty expired' : `Until ${warrantyExpiration.formatted}`}
                                    </span>
                                )}
                                {selectedTasks.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded-full">
                                        <Bell size={10} />
                                        {selectedTasks.length} reminder{selectedTasks.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Expand/Collapse for details */}
                {isIncluded && (showMaintenanceInfo || item.serialNumber || item.warranty) && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                    >
                        {expanded ? (
                            <>
                                <ChevronUp size={16} />
                                Hide details
                            </>
                        ) : (
                            <>
                                <ChevronDown size={16} />
                                Show details
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Expanded details */}
            {expanded && isIncluded && (
                <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                    {/* Item details grid */}
                    <div className="grid grid-cols-2 gap-3 pt-3 text-sm">
                        {item.serialNumber && (
                            <div>
                                <span className="text-slate-500 text-xs block">Serial Number</span>
                                <span className="text-slate-800 font-mono text-xs">{safeString(item.serialNumber)}</span>
                            </div>
                        )}
                        {item.dateInstalled && (
                            <div>
                                <span className="text-slate-500 text-xs block">Install Date</span>
                                <span className="text-slate-800">{new Date(item.dateInstalled).toLocaleDateString()}</span>
                            </div>
                        )}
                        {item.area && (
                            <div>
                                <span className="text-slate-500 text-xs block">Location</span>
                                <span className="text-slate-800">{safeString(item.area)}</span>
                            </div>
                        )}
                        {item.warranty && (
                            <div>
                                <span className="text-slate-500 text-xs block">Warranty</span>
                                <span className="text-slate-800">{safeString(item.warranty)}</span>
                            </div>
                        )}
                    </div>

                    {/* Maintenance schedule preview */}
                    {showMaintenanceInfo && selectedTasks.length > 0 && (
                        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Bell size={14} className="text-amber-600" />
                                <span className="text-sm font-medium text-amber-800">
                                    Automatic Reminders
                                </span>
                            </div>
                            <ul className="space-y-1.5">
                                {selectedTasks.slice(0, 3).map((task, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-xs text-amber-700">
                                        <Clock size={10} className="shrink-0" />
                                        <span>{safeString(task.task)}</span>
                                        <span className="text-amber-500">• {safeString(task.frequency)}</span>
                                    </li>
                                ))}
                                {selectedTasks.length > 3 && (
                                    <li className="text-xs text-amber-500">
                                        +{selectedTasks.length - 3} more
                                    </li>
                                )}
                            </ul>
                            {nextMaintenance && (
                                <p className="mt-2 pt-2 border-t border-amber-200 text-xs text-amber-700">
                                    <strong>First reminder:</strong> {nextMaintenance.formatted}
                                </p>
                            )}
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
export const InventoryPreviewSection = ({
    items = [],
    editable = false,
    onItemUpdate,
    onItemToggle,
    itemSelections = {},
    showMaintenanceInfo = true,
    onEditItem
}) => {
    // Count included items
    const includedCount = items.filter(item => {
        const selection = itemSelections[item.id];
        return !selection?.skip;
    }).length;

    if (items.length === 0) {
        return (
            <div className="text-center py-8 px-4">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Package size={32} className="text-slate-400" />
                </div>
                <h3 className="font-medium text-slate-700 mb-1">No Equipment Installed</h3>
                <p className="text-sm text-slate-500">
                    This was a service-only job. Review the completion photos and notes instead.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header with value proposition */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                        <Package size={20} className="text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-emerald-800">
                            What's Being Added to Your Home
                        </h3>
                        <p className="text-sm text-emerald-700 mt-1">
                            {includedCount} item{includedCount !== 1 ? 's' : ''} will be added to your home inventory
                        </p>
                    </div>
                </div>

                {/* Benefits */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-700">Track in your inventory</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                        <Bell size={14} className="text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-700">Automatic reminders</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2">
                        <Shield size={14} className="text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-700">Warranty tracking</span>
                    </div>
                </div>
            </div>

            {/* Editable notice */}
            {editable && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                    <Info size={14} className="text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-700">
                        Toggle items to include/exclude, or click edit to modify details before adding to your inventory.
                    </p>
                </div>
            )}

            {/* Items list */}
            <div className="space-y-3">
                {items.map((item, index) => {
                    const selection = itemSelections[item.id];
                    const isIncluded = !selection?.skip;

                    return (
                        <InventoryItemCard
                            key={item.id || index}
                            item={selection?.modifications ? { ...item, ...selection.modifications } : item}
                            index={index}
                            isIncluded={isIncluded}
                            onToggleInclude={(itemId) => onItemToggle?.(itemId)}
                            onEdit={(item) => onEditItem?.(item)}
                            editable={editable}
                            showMaintenanceInfo={showMaintenanceInfo}
                        />
                    );
                })}
            </div>

            {/* Summary */}
            {editable && items.length > 1 && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span className="text-slate-600">
                        {includedCount} of {items.length} items selected
                    </span>
                    {includedCount < items.length && (
                        <span className="text-slate-500 text-xs">
                            {items.length - includedCount} will be skipped
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default InventoryPreviewSection;
