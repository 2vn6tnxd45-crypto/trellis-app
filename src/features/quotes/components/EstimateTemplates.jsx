// src/features/quotes/components/EstimateTemplates.jsx
// ============================================
// ESTIMATE TEMPLATES MANAGEMENT
// ============================================
// UI for contractors to manage their saved quote templates

import React, { useState, useMemo } from 'react';
import {
    Search, Plus, FileText, Clock, Star, StarOff,
    Edit2, Trash2, ChevronDown, ChevronUp, Loader2,
    DollarSign, Tag, X, Copy, Check, Package,
    Sparkles, MoreVertical, Eye, Zap
} from 'lucide-react';
import { Select } from '../../../../components/ui/Select';
import toast from 'react-hot-toast';

// ============================================
// CATEGORY OPTIONS
// ============================================
const TEMPLATE_CATEGORIES = [
    { value: 'hvac', label: 'HVAC' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'painting', label: 'Painting' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'general', label: 'General' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'repair', label: 'Repair' },
    { value: 'installation', label: 'Installation' },
];

// ============================================
// TEMPLATE CARD
// ============================================
const TemplateCard = ({
    template,
    onEdit,
    onDelete,
    onDuplicate,
    onUseTemplate,
}) => {
    const [showMenu, setShowMenu] = useState(false);

    // Calculate total from line items
    const estimatedTotal = useMemo(() => {
        return (template.lineItems || []).reduce((sum, item) => {
            return sum + ((item.quantity || 1) * (item.unitPrice || 0));
        }, 0);
    }, [template.lineItems]);

    const itemCount = template.lineItems?.length || 0;
    const materialCount = template.lineItems?.filter(i => i.type === 'material').length || 0;
    const laborCount = template.lineItems?.filter(i => i.type === 'labor').length || 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-emerald-200 transition-all group">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center shrink-0">
                        <FileText size={24} className="text-emerald-600" />
                    </div>

                    {/* Name & Category */}
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 truncate text-lg">{template.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                {template.category || 'General'}
                            </span>
                            <span className="text-xs text-slate-400">
                                {itemCount} item{itemCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Estimated Total */}
                <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Est. Total</p>
                    <p className="font-bold text-lg text-emerald-600">
                        ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                </div>
            </div>

            {/* Line Items Preview */}
            {itemCount > 0 && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Includes:</p>
                    <div className="space-y-1">
                        {template.lineItems.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 truncate flex-1">{item.description || 'Unnamed item'}</span>
                                <span className="text-slate-500 ml-2">${item.unitPrice || 0}</span>
                            </div>
                        ))}
                        {itemCount > 3 && (
                            <p className="text-xs text-slate-400 italic">+{itemCount - 3} more items</p>
                        )}
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                {materialCount > 0 && (
                    <span className="flex items-center gap-1">
                        <Package size={12} />
                        {materialCount} material{materialCount !== 1 ? 's' : ''}
                    </span>
                )}
                {laborCount > 0 && (
                    <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {laborCount} labor
                    </span>
                )}
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {/* Use Template Button */}
                <button
                    onClick={() => onUseTemplate(template)}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                >
                    <Zap size={14} />
                    Use Template
                </button>

                {/* Other Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onDuplicate(template)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Duplicate"
                    >
                        <Copy size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => onEdit(template)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => onDelete(template.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} className="text-red-400" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ADD/EDIT TEMPLATE MODAL
// ============================================
const TemplateModal = ({ template, onSave, onClose }) => {
    const isEditing = !!template?.id;
    const [formData, setFormData] = useState({
        name: template?.name || '',
        category: template?.category || 'general',
        lineItems: template?.lineItems || [],
        defaultNotes: template?.defaultNotes || '',
        defaultTerms: template?.defaultTerms || '',
        defaultWarranty: template?.defaultWarranty || '',
    });
    const [saving, setSaving] = useState(false);

    // Add a line item
    const addLineItem = (type = 'material') => {
        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, {
                id: Date.now() + Math.random(),
                type,
                description: '',
                quantity: 1,
                unitPrice: 0,
                brand: '',
                model: '',
                warranty: '',
            }]
        }));
    };

    // Update a line item
    const updateLineItem = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    // Remove a line item
    const removeLineItem = (id) => {
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter(item => item.id !== id)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Template name is required');
            return;
        }

        // Filter out empty line items
        const cleanedLineItems = formData.lineItems.filter(item =>
            item.description?.trim() || item.unitPrice > 0
        );

        setSaving(true);

        await onSave({
            ...formData,
            lineItems: cleanedLineItems
        }, template?.id);

        setSaving(false);
    };

    // Calculate running total
    const runningTotal = formData.lineItems.reduce((sum, item) => {
        return sum + ((item.quantity || 1) * (item.unitPrice || 0));
    }, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-800">
                        {isEditing ? 'Edit Template' : 'Create Quote Template'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Template Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., AC Installation, HVAC Tune-Up"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                autoFocus
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Category
                            </label>
                            <Select
                                value={formData.category}
                                onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                                options={TEMPLATE_CATEGORIES}
                            />
                        </div>
                    </div>

                    {/* Line Items Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                                Line Items
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => addLineItem('material')}
                                    className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Material
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addLineItem('labor')}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    Labor
                                </button>
                            </div>
                        </div>

                        {formData.lineItems.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <Package size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm text-slate-500">No line items yet</p>
                                <p className="text-xs text-slate-400">Add materials and labor above</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {formData.lineItems.map((item, idx) => (
                                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <div className="flex items-start gap-3">
                                            {/* Type Badge */}
                                            <span className={`px-2 py-1 text-xs font-medium rounded-lg shrink-0 ${item.type === 'labor'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {item.type === 'labor' ? 'Labor' : 'Material'}
                                            </span>

                                            {/* Description */}
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                                placeholder="Item description"
                                                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />

                                            {/* Qty */}
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                min="1"
                                                className="w-16 px-2 py-1.5 text-sm text-center border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />

                                            {/* Price */}
                                            <div className="relative">
                                                <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                    min="0"
                                                    step="0.01"
                                                    className="w-24 pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>

                                            {/* Remove */}
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(item.id)}
                                                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} className="text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Running Total */}
                                <div className="flex justify-end pt-2">
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400 uppercase">Estimated Total</p>
                                        <p className="text-xl font-bold text-emerald-600">
                                            ${runningTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Default Text Fields */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                            Default Text (auto-fills when using template)
                        </p>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Notes
                            </label>
                            <textarea
                                value={formData.defaultNotes}
                                onChange={(e) => setFormData(prev => ({ ...prev, defaultNotes: e.target.value }))}
                                placeholder="Notes to include on the quote..."
                                rows={2}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Warranty
                            </label>
                            <input
                                type="text"
                                value={formData.defaultWarranty}
                                onChange={(e) => setFormData(prev => ({ ...prev, defaultWarranty: e.target.value }))}
                                placeholder="e.g., 1 Year Parts & Labor"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Terms & Conditions
                            </label>
                            <textarea
                                value={formData.defaultTerms}
                                onChange={(e) => setFormData(prev => ({ ...prev, defaultTerms: e.target.value }))}
                                placeholder="Default terms for this type of job..."
                                rows={2}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Check size={18} />
                            )}
                            {isEditing ? 'Save Changes' : 'Create Template'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// EMPTY STATE
// ============================================
const EmptyState = ({ onAddTemplate }) => (
    <div className="text-center py-16">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText size={40} className="text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">No Templates Yet</h3>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Create templates for your common jobs to speed up quoting.
            Include line items, notes, and terms that auto-fill when you use them.
        </p>
        <button
            onClick={onAddTemplate}
            className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 mx-auto"
        >
            <Plus size={20} />
            Create Your First Template
        </button>
    </div>
);

// ============================================
// MAIN ESTIMATE TEMPLATES COMPONENT
// ============================================
export const EstimateTemplates = ({
    contractorId,
    templates = [],
    loading = false,
    createTemplate,
    updateTemplate,
    removeTemplate,
    onNavigateToQuote
}) => {
    const [showModal, setShowModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Filter templates
    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            const matchesSearch = !searchTerm ||
                template.name?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory ||
                template.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [templates, searchTerm, selectedCategory]);

    // Get unique categories from templates
    const usedCategories = useMemo(() => {
        const cats = [...new Set(templates.map(t => t.category).filter(Boolean))];
        return TEMPLATE_CATEGORIES.filter(c => cats.includes(c.value));
    }, [templates]);

    // Handle save (create or update)
    const handleSave = async (formData, existingId) => {
        try {
            if (existingId) {
                await updateTemplate(existingId, formData);
                toast.success('Template updated!');
            } else {
                await createTemplate(formData);
                toast.success('Template created!');
            }
            setShowModal(false);
            setEditingTemplate(null);
        } catch (error) {
            console.error('Error saving template:', error);
            toast.error('Failed to save template');
        }
    };

    // Handle edit
    const handleEdit = (template) => {
        setEditingTemplate(template);
        setShowModal(true);
    };

    // Handle duplicate
    const handleDuplicate = (template) => {
        const duplicated = {
            ...template,
            name: `${template.name} (Copy)`,
            id: undefined,
        };
        setEditingTemplate(duplicated);
        setShowModal(true);
    };

    // Handle delete
    const handleDelete = async (templateId) => {
        if (window.confirm('Delete this template? This cannot be undone.')) {
            try {
                await removeTemplate(templateId);
                toast.success('Template deleted');
            } catch (error) {
                console.error('Error deleting template:', error);
                toast.error('Failed to delete template');
            }
        }
    };

    // Handle use template - navigate to quote builder
    const handleUseTemplate = (template) => {
        if (onNavigateToQuote) {
            onNavigateToQuote('quote-new', { template });
            toast.success(`Creating quote from "${template.name}"`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Estimate Templates</h1>
                    <p className="text-slate-500">
                        {templates.length} template{templates.length !== 1 ? 's' : ''} • Create quotes faster
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingTemplate(null);
                        setShowModal(true);
                    }}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2"
                >
                    <Plus size={18} />
                    New Template
                </button>
            </div>

            {/* Search & Filter Bar */}
            {templates.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search templates..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X size={16} className="text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Category Filter */}
                    {usedCategories.length > 1 && (
                        <Select
                            value={selectedCategory || ''}
                            onChange={(val) => setSelectedCategory(val || null)}
                            options={[
                                { value: '', label: 'All Categories' },
                                ...usedCategories
                            ]}
                        />
                    )}
                </div>
            )}

            {/* Templates Grid */}
            {filteredTemplates.length === 0 ? (
                templates.length === 0 ? (
                    <EmptyState onAddTemplate={() => setShowModal(true)} />
                ) : (
                    <div className="text-center py-12">
                        <Search size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">No templates match your search</p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory(null);
                            }}
                            className="mt-2 text-emerald-600 font-medium hover:underline"
                        >
                            Clear filters
                        </button>
                    </div>
                )
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onDuplicate={handleDuplicate}
                            onUseTemplate={handleUseTemplate}
                        />
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <TemplateModal
                    template={editingTemplate}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingTemplate(null);
                    }}
                />
            )}
        </div>
    );
};

export default EstimateTemplates;
