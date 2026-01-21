// src/components/InventoryIntentToggle.jsx
// ============================================
// INVENTORY INTENT TOGGLE COMPONENT
// ============================================
// Enhanced "Add to Home Record" toggle with clear explanations
// of what this means for both contractors and homeowners

import React, { useState } from 'react';
import {
    Home,
    Bell,
    Shield,
    Package,
    CheckCircle,
    Info,
    ChevronDown,
    ChevronUp,
    X,
    Calendar,
    Wrench,
    FileText
} from 'lucide-react';

// ============================================
// MAIN TOGGLE COMPONENT
// ============================================

export const InventoryIntentToggle = ({
    isEnabled,
    onToggle,
    itemName = 'This item',
    showDetails = true,
    compact = false,
    variant = 'default' // 'default' | 'card' | 'inline'
}) => {
    const [showExplanation, setShowExplanation] = useState(false);

    // ----------------------------------------
    // Inline variant (just a toggle with tooltip)
    // ----------------------------------------
    if (variant === 'inline' || compact) {
        return (
            <div className="relative group">
                <button
                    type="button"
                    onClick={onToggle}
                    className={`p-1.5 rounded-lg transition-all ${
                        isEnabled
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'
                    }`}
                    title={isEnabled ? "Will be added to customer's home inventory" : "Add to home inventory"}
                >
                    <Home size={16} />
                </button>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                    <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        {isEnabled ? (
                            <span className="flex items-center gap-1.5">
                                <CheckCircle size={12} className="text-emerald-400" />
                                Added to home inventory
                            </span>
                        ) : (
                            <span>Click to add to home inventory</span>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-slate-800" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Card variant (expanded info card)
    // ----------------------------------------
    if (variant === 'card') {
        return (
            <div className={`rounded-xl border-2 transition-all ${
                isEnabled
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}>
                <button
                    type="button"
                    onClick={onToggle}
                    className="w-full p-4 text-left"
                >
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl ${
                            isEnabled ? 'bg-emerald-100' : 'bg-slate-200'
                        }`}>
                            <Home size={20} className={isEnabled ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className={`font-semibold ${
                                    isEnabled ? 'text-emerald-800' : 'text-slate-700'
                                }`}>
                                    Add to Home Inventory
                                </h4>
                                <div className={`w-10 h-6 rounded-full relative transition-colors ${
                                    isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}>
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                        isEnabled ? 'left-5' : 'left-1'
                                    }`} />
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                {isEnabled
                                    ? "This item will be tracked in the customer's home inventory"
                                    : "Customer can track warranties and get maintenance reminders"
                                }
                            </p>
                        </div>
                    </div>
                </button>

                {isEnabled && showDetails && (
                    <div className="px-4 pb-4 pt-0">
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <BenefitMini
                                icon={Package}
                                label="Track Equipment"
                                color="emerald"
                            />
                            <BenefitMini
                                icon={Bell}
                                label="Maintenance Alerts"
                                color="amber"
                            />
                            <BenefitMini
                                icon={Shield}
                                label="Warranty Tracking"
                                color="blue"
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ----------------------------------------
    // Default variant (toggle with expandable explanation)
    // ----------------------------------------
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Home size={16} className={isEnabled ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className={`text-sm font-medium ${
                        isEnabled ? 'text-emerald-700' : 'text-slate-600'
                    }`}>
                        Add to Home Inventory
                    </span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowExplanation(!showExplanation);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                        <Info size={14} />
                    </button>
                </div>

                {/* Toggle switch */}
                <button
                    type="button"
                    onClick={onToggle}
                    className={`w-10 h-6 rounded-full relative transition-colors ${
                        isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                        isEnabled ? 'left-5' : 'left-1'
                    }`} />
                </button>
            </div>

            {/* Expandable explanation */}
            {showExplanation && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h5 className="text-sm font-medium text-blue-800 mb-1">
                                What does this do?
                            </h5>
                            <p className="text-xs text-blue-700">
                                When enabled, {itemName.toLowerCase()} will be added to the customer's home inventory after the job is completed. They'll get:
                            </p>
                            <ul className="mt-2 space-y-1.5">
                                <li className="text-xs text-blue-600 flex items-center gap-1.5">
                                    <Package size={12} />
                                    Equipment tracked in their home record
                                </li>
                                <li className="text-xs text-blue-600 flex items-center gap-1.5">
                                    <Bell size={12} />
                                    Automatic maintenance reminders
                                </li>
                                <li className="text-xs text-blue-600 flex items-center gap-1.5">
                                    <Shield size={12} />
                                    Warranty expiration alerts
                                </li>
                                <li className="text-xs text-blue-600 flex items-center gap-1.5">
                                    <Wrench size={12} />
                                    Easy "book again" for service
                                </li>
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowExplanation(false)}
                            className="p-1 text-blue-400 hover:text-blue-600"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Active indicator */}
            {isEnabled && !showExplanation && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={12} />
                    Will be added to customer's home inventory at job completion
                </p>
            )}
        </div>
    );
};

// ============================================
// BENEFIT MINI CARD
// ============================================

const BenefitMini = ({ icon: Icon, label, color }) => (
    <div className={`p-2 bg-${color}-100 rounded-lg`}>
        <Icon size={14} className={`mx-auto text-${color}-600 mb-1`} />
        <p className={`text-xs text-${color}-700`}>{label}</p>
    </div>
);

// ============================================
// INVENTORY INTENT SUMMARY
// ============================================
// Shows a summary of what will be added to home inventory (for quote review)

export const InventoryIntentSummary = ({
    items = [], // Array of items with inventoryIntent
    expanded = false
}) => {
    const [isExpanded, setIsExpanded] = useState(expanded);

    const itemsWithIntent = items.filter(item => item.addToHomeRecord);

    if (itemsWithIntent.length === 0) {
        return null;
    }

    return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Home size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-emerald-800">
                            Home Inventory Items
                        </h4>
                        <p className="text-sm text-emerald-600">
                            {itemsWithIntent.length} item{itemsWithIntent.length !== 1 ? 's' : ''} will be tracked
                        </p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp size={18} className="text-emerald-500" />
                ) : (
                    <ChevronDown size={18} className="text-emerald-500" />
                )}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                    {itemsWithIntent.map((item, idx) => (
                        <div
                            key={item.id || idx}
                            className="flex items-center gap-3 bg-white rounded-lg p-3"
                        >
                            <Package size={16} className="text-emerald-500" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">
                                    {item.description || 'Item'}
                                </p>
                                {item.inventoryIntent?.maintenanceTasks?.filter(t => t.selected).length > 0 && (
                                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                                        <Bell size={10} />
                                        {item.inventoryIntent.maintenanceTasks.filter(t => t.selected).length} maintenance reminders
                                    </p>
                                )}
                            </div>
                            <CheckCircle size={16} className="text-emerald-500" />
                        </div>
                    ))}

                    {/* Benefits reminder */}
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                        <p className="text-xs text-emerald-600">
                            <strong>Customer benefits:</strong> Equipment tracking, maintenance reminders, warranty alerts, easy rebooking
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryIntentToggle;
