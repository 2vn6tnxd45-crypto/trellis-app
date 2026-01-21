// src/features/contractor-pro/components/BatchOperationsBar.jsx
// ============================================
// BATCH OPERATIONS BAR
// ============================================
// Floating action bar for multi-select batch operations
// on jobs, invoices, and other list views

import React, { useState } from 'react';
import {
    X,
    Check,
    User,
    Calendar,
    Mail,
    Printer,
    FileText,
    Trash2,
    Clock,
    DollarSign,
    Loader2,
    ChevronDown,
    AlertTriangle,
    CheckCircle
} from 'lucide-react';

// ============================================
// MAIN COMPONENT
// ============================================

export const BatchOperationsBar = ({
    selectedCount,
    selectedIds,
    selectionType = 'jobs', // 'jobs' | 'invoices' | 'quotes' | 'evaluations'
    onClearSelection,
    onBatchDispatch,
    onBatchReschedule,
    onBatchEmail,
    onBatchInvoice,
    onBatchPrint,
    onBatchCancel,
    teamMembers = [],
    isVisible = true
}) => {
    const [showDispatchMenu, setShowDispatchMenu] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [processing, setProcessing] = useState(null);
    const [result, setResult] = useState(null);

    if (!isVisible || selectedCount === 0) return null;

    // Execute batch operation with loading state
    const executeBatchOperation = async (operationName, operation) => {
        setProcessing(operationName);
        setResult(null);
        try {
            const result = await operation();
            setResult({
                success: true,
                message: result?.message || `${operationName} completed for ${selectedCount} items`
            });
            setTimeout(() => setResult(null), 3000);
        } catch (error) {
            setResult({
                success: false,
                message: error.message || `${operationName} failed`
            });
            setTimeout(() => setResult(null), 5000);
        } finally {
            setProcessing(null);
            setShowDispatchMenu(false);
            setShowActionMenu(false);
        }
    };

    // Get available actions based on selection type
    const getActions = () => {
        const baseActions = [];

        if (selectionType === 'jobs') {
            if (onBatchDispatch) {
                baseActions.push({
                    id: 'dispatch',
                    label: 'Assign Tech',
                    icon: User,
                    color: 'indigo',
                    hasMenu: true,
                    onClick: () => setShowDispatchMenu(true)
                });
            }
            if (onBatchReschedule) {
                baseActions.push({
                    id: 'reschedule',
                    label: 'Reschedule',
                    icon: Calendar,
                    color: 'blue',
                    onClick: () => executeBatchOperation('Reschedule', onBatchReschedule)
                });
            }
            if (onBatchInvoice) {
                baseActions.push({
                    id: 'invoice',
                    label: 'Create Invoices',
                    icon: FileText,
                    color: 'emerald',
                    onClick: () => executeBatchOperation('Invoice Creation', onBatchInvoice)
                });
            }
        }

        if (selectionType === 'invoices') {
            if (onBatchEmail) {
                baseActions.push({
                    id: 'email',
                    label: 'Send All',
                    icon: Mail,
                    color: 'blue',
                    onClick: () => executeBatchOperation('Email Send', onBatchEmail)
                });
            }
            if (onBatchPrint) {
                baseActions.push({
                    id: 'print',
                    label: 'Print All',
                    icon: Printer,
                    color: 'slate',
                    onClick: () => executeBatchOperation('Print', onBatchPrint)
                });
            }
        }

        if (selectionType === 'quotes') {
            if (onBatchEmail) {
                baseActions.push({
                    id: 'email',
                    label: 'Send Quotes',
                    icon: Mail,
                    color: 'blue',
                    onClick: () => executeBatchOperation('Quote Send', onBatchEmail)
                });
            }
        }

        // Universal actions
        if (onBatchCancel) {
            baseActions.push({
                id: 'cancel',
                label: 'Cancel',
                icon: Trash2,
                color: 'red',
                danger: true,
                onClick: () => {
                    if (window.confirm(`Cancel ${selectedCount} selected items? This cannot be undone.`)) {
                        executeBatchOperation('Cancellation', onBatchCancel);
                    }
                }
            });
        }

        return baseActions;
    };

    const actions = getActions();

    return (
        <>
            {/* Main bar */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
                <div className="bg-slate-800 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-4">
                    {/* Selection count */}
                    <div className="flex items-center gap-2 pr-4 border-r border-slate-600">
                        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center font-bold">
                            {selectedCount}
                        </div>
                        <span className="text-sm text-slate-300">selected</span>
                    </div>

                    {/* Processing indicator */}
                    {processing && (
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Loader2 size={16} className="animate-spin" />
                            {processing}...
                        </div>
                    )}

                    {/* Result message */}
                    {result && (
                        <div className={`flex items-center gap-2 text-sm ${
                            result.success ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                            {result.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                            {result.message}
                        </div>
                    )}

                    {/* Actions */}
                    {!processing && !result && (
                        <div className="flex items-center gap-2">
                            {actions.slice(0, 4).map(action => (
                                <ActionButton
                                    key={action.id}
                                    action={action}
                                    onClick={action.onClick}
                                    processing={processing === action.label}
                                />
                            ))}

                            {/* More actions dropdown */}
                            {actions.length > 4 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowActionMenu(!showActionMenu)}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-700 text-sm font-medium"
                                    >
                                        More
                                        <ChevronDown size={14} />
                                    </button>

                                    {showActionMenu && (
                                        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl py-2 min-w-[160px]">
                                            {actions.slice(4).map(action => (
                                                <button
                                                    key={action.id}
                                                    onClick={action.onClick}
                                                    className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-50 ${
                                                        action.danger ? 'text-red-600' : 'text-slate-700'
                                                    }`}
                                                >
                                                    <action.icon size={16} />
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Clear selection */}
                    <button
                        onClick={onClearSelection}
                        className="p-2 hover:bg-slate-700 rounded-lg ml-2"
                        title="Clear selection"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Dispatch menu (floating above bar) */}
            {showDispatchMenu && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-4 min-w-[300px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800">Assign Technician</h3>
                            <button
                                onClick={() => setShowDispatchMenu(false)}
                                className="p-1 hover:bg-slate-100 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-sm text-slate-500 mb-3">
                            Assign {selectedCount} jobs to:
                        </p>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {teamMembers.map(member => (
                                <button
                                    key={member.id}
                                    onClick={() => executeBatchOperation(
                                        'Assignment',
                                        () => onBatchDispatch(member.id, member.name)
                                    )}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left"
                                >
                                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                        <User size={18} className="text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-800">{member.name}</p>
                                        {member.role && (
                                            <p className="text-xs text-slate-500">{member.role}</p>
                                        )}
                                    </div>
                                    {member.jobCount !== undefined && (
                                        <span className="text-xs text-slate-400">
                                            {member.jobCount} jobs today
                                        </span>
                                    )}
                                </button>
                            ))}

                            {teamMembers.length === 0 && (
                                <p className="text-center text-slate-400 py-4">
                                    No team members available
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Click-away handler for menus */}
            {(showDispatchMenu || showActionMenu) && (
                <div
                    className="fixed inset-0 z-30"
                    onClick={() => {
                        setShowDispatchMenu(false);
                        setShowActionMenu(false);
                    }}
                />
            )}
        </>
    );
};

// ============================================
// ACTION BUTTON COMPONENT
// ============================================

const ActionButton = ({ action, onClick, processing }) => {
    const Icon = action.icon;

    const colorClasses = {
        indigo: 'bg-indigo-500 hover:bg-indigo-600',
        blue: 'bg-blue-500 hover:bg-blue-600',
        emerald: 'bg-emerald-500 hover:bg-emerald-600',
        amber: 'bg-amber-500 hover:bg-amber-600',
        red: 'bg-red-500 hover:bg-red-600',
        slate: 'bg-slate-600 hover:bg-slate-500'
    };

    return (
        <button
            onClick={onClick}
            disabled={processing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors ${
                colorClasses[action.color] || colorClasses.slate
            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {processing ? (
                <Loader2 size={16} className="animate-spin" />
            ) : (
                <Icon size={16} />
            )}
            {action.label}
            {action.hasMenu && <ChevronDown size={14} />}
        </button>
    );
};

// ============================================
// SELECTABLE LIST WRAPPER
// ============================================
// HOC/wrapper to make any list support multi-select

export const SelectableListWrapper = ({
    children,
    items,
    selectedIds,
    onSelectionChange,
    renderBatchBar
}) => {
    const [localSelectedIds, setLocalSelectedIds] = useState(new Set());

    const effectiveSelectedIds = selectedIds || localSelectedIds;
    const setEffectiveSelectedIds = onSelectionChange || setLocalSelectedIds;

    const toggleSelect = (id) => {
        const newSelection = new Set(effectiveSelectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setEffectiveSelectedIds(newSelection);
    };

    const selectAll = () => {
        setEffectiveSelectedIds(new Set(items.map(i => i.id)));
    };

    const clearSelection = () => {
        setEffectiveSelectedIds(new Set());
    };

    const isSelected = (id) => effectiveSelectedIds.has(id);

    return (
        <>
            {children({
                isSelected,
                toggleSelect,
                selectAll,
                clearSelection,
                selectedCount: effectiveSelectedIds.size,
                selectedIds: [...effectiveSelectedIds]
            })}

            {renderBatchBar && renderBatchBar({
                selectedCount: effectiveSelectedIds.size,
                selectedIds: [...effectiveSelectedIds],
                onClearSelection: clearSelection
            })}
        </>
    );
};

// ============================================
// CHECKBOX COMPONENT FOR LISTS
// ============================================

export const SelectionCheckbox = ({
    isSelected,
    onToggle,
    className = ''
}) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onToggle();
        }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
                ? 'bg-indigo-600 border-indigo-600'
                : 'border-slate-300 hover:border-indigo-400'
        } ${className}`}
    >
        {isSelected && <Check size={12} className="text-white" />}
    </button>
);

export default BatchOperationsBar;
