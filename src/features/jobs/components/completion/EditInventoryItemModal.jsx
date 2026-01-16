// src/features/jobs/components/completion/EditInventoryItemModal.jsx
// ============================================
// EDIT INVENTORY ITEM MODAL
// ============================================
// Allows homeowners to edit item details before accepting completion

import React, { useState, useEffect } from 'react';
import {
    X, Save, Package, Calendar, FileText, Hash,
    Shield, Clock, Bell, Check, AlertTriangle, Info
} from 'lucide-react';

// ============================================
// MAIN COMPONENT
// ============================================
export const EditInventoryItemModal = ({
    item,
    isOpen,
    onClose,
    onSave
}) => {
    // Local state for editable fields
    const [formData, setFormData] = useState({
        serialNumber: '',
        dateInstalled: '',
        notes: '',
        maintenanceTasks: []
    });

    // Initialize form when item changes
    useEffect(() => {
        if (item) {
            setFormData({
                serialNumber: item.serialNumber || '',
                dateInstalled: item.dateInstalled || new Date().toISOString().split('T')[0],
                notes: item.notes || '',
                maintenanceTasks: (item.maintenanceTasks || []).map(task => ({
                    ...task,
                    selected: task.selected !== false
                }))
            });
        }
    }, [item]);

    if (!isOpen || !item) return null;

    const handleSave = () => {
        // Build modifications object with only changed fields
        const modifications = {};

        if (formData.serialNumber !== (item.serialNumber || '')) {
            modifications.serialNumber = formData.serialNumber;
        }
        if (formData.dateInstalled !== (item.dateInstalled || '')) {
            modifications.dateInstalled = formData.dateInstalled;
        }
        if (formData.notes !== (item.notes || '')) {
            modifications.notes = formData.notes;
        }

        // Check if maintenance tasks changed
        const originalTaskStates = (item.maintenanceTasks || []).map(t => t.selected !== false);
        const newTaskStates = formData.maintenanceTasks.map(t => t.selected);
        const tasksChanged = JSON.stringify(originalTaskStates) !== JSON.stringify(newTaskStates);

        if (tasksChanged) {
            modifications.maintenanceTasks = formData.maintenanceTasks;
        }

        onSave(item.id, modifications);
        onClose();
    };

    const handleTaskToggle = (index) => {
        setFormData(prev => ({
            ...prev,
            maintenanceTasks: prev.maintenanceTasks.map((task, i) =>
                i === index ? { ...task, selected: !task.selected } : task
            )
        }));
    };

    const selectedTaskCount = formData.maintenanceTasks.filter(t => t.selected).length;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Edit Item Details</h2>
                            <p className="text-emerald-100 text-sm truncate max-w-[200px]">
                                {item.item || item.description || 'Item'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Non-editable fields (display only) */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">
                            Item Information (from contractor)
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500 text-xs block">Name</span>
                                <span className="text-slate-800 font-medium">{item.item || '—'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 text-xs block">Category</span>
                                <span className="text-slate-800">{item.category || '—'}</span>
                            </div>
                            {item.brand && (
                                <div>
                                    <span className="text-slate-500 text-xs block">Brand</span>
                                    <span className="text-slate-800">{item.brand}</span>
                                </div>
                            )}
                            {item.model && (
                                <div>
                                    <span className="text-slate-500 text-xs block">Model</span>
                                    <span className="text-slate-800">{item.model}</span>
                                </div>
                            )}
                            {item.cost && (
                                <div>
                                    <span className="text-slate-500 text-xs block">Cost</span>
                                    <span className="text-slate-800">${parseFloat(item.cost).toLocaleString()}</span>
                                </div>
                            )}
                            {item.warranty && (
                                <div>
                                    <span className="text-slate-500 text-xs block">Warranty</span>
                                    <span className="text-slate-800">{item.warranty}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium flex items-center gap-2">
                            <Info size={12} />
                            You can edit these fields
                        </p>

                        {/* Serial Number */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                                <Hash size={14} className="text-slate-400" />
                                Serial Number
                            </label>
                            <input
                                type="text"
                                value={formData.serialNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                                placeholder="Enter serial number (if you have it)"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Helpful for warranty claims and service calls
                            </p>
                        </div>

                        {/* Install Date */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                                <Calendar size={14} className="text-slate-400" />
                                Install Date
                            </label>
                            <input
                                type="date"
                                value={formData.dateInstalled}
                                onChange={(e) => setFormData(prev => ({ ...prev, dateInstalled: e.target.value }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                                <FileText size={14} className="text-slate-400" />
                                Personal Notes
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Add any personal notes about this item..."
                                rows={3}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                            />
                        </div>
                    </div>

                    {/* Maintenance Tasks Selection */}
                    {formData.maintenanceTasks.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3 flex items-center gap-2">
                                <Bell size={12} />
                                Maintenance Reminders
                            </p>

                            <div className="bg-amber-50 rounded-xl p-4 mb-3 border border-amber-100">
                                <p className="text-sm text-amber-800">
                                    Select which maintenance tasks you want automatic reminders for.
                                    {selectedTaskCount > 0 && (
                                        <span className="font-bold"> {selectedTaskCount} selected.</span>
                                    )}
                                </p>
                            </div>

                            <div className="space-y-2">
                                {formData.maintenanceTasks.map((task, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleTaskToggle(index)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                            task.selected
                                                ? 'bg-emerald-50 border-emerald-200'
                                                : 'bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                            task.selected
                                                ? 'bg-emerald-600'
                                                : 'border-2 border-slate-300'
                                        }`}>
                                            {task.selected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium ${
                                                task.selected ? 'text-emerald-800' : 'text-slate-600'
                                            }`}>
                                                {task.task}
                                            </p>
                                            <p className={`text-xs ${
                                                task.selected ? 'text-emerald-600' : 'text-slate-500'
                                            }`}>
                                                {task.frequency}
                                            </p>
                                        </div>
                                        <Clock size={14} className={task.selected ? 'text-emerald-400' : 'text-slate-300'} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-slate-600 font-medium hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <Save size={16} />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditInventoryItemModal;
