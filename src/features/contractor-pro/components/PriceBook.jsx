// src/features/contractor-pro/components/PriceBook.jsx
// ============================================
// PRICE BOOK MANAGEMENT
// ============================================
// UI for contractors to manage their saved items and pricing

import React, { useState, useMemo } from 'react';
import {
    Search, Plus, Package, Wrench, Clock, Star, StarOff,
    Edit2, Trash2, ChevronDown, ChevronUp, Loader2,
    DollarSign, Tag, Filter, X, Download, Upload,
    Wind, Droplets, Zap, Home, Refrigerator, Palette,
    Layers, Trees, Sparkles, MoreVertical, Copy, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriceBook } from '../hooks/usePriceBook';
import { PRICE_BOOK_CATEGORIES, ITEM_TYPES } from '../lib/priceBookService';

// ============================================
// ICON MAP
// ============================================
const ICON_MAP = {
    'Wind': Wind,
    'Droplets': Droplets,
    'Zap': Zap,
    'Home': Home,
    'Refrigerator': Refrigerator,
    'Palette': Palette,
    'Layers': Layers,
    'Trees': Trees,
    'Wrench': Wrench,
    'Clock': Clock,
};

// ============================================
// TYPE BADGES
// ============================================
const TYPE_CONFIG = {
    [ITEM_TYPES.MATERIAL]: { label: 'Material', color: 'bg-amber-100 text-amber-700', icon: Package },
    [ITEM_TYPES.LABOR]: { label: 'Labor', color: 'bg-blue-100 text-blue-700', icon: Clock },
    [ITEM_TYPES.SERVICE]: { label: 'Service', color: 'bg-emerald-100 text-emerald-700', icon: Wrench },
};

// ============================================
// PRICE BOOK ITEM CARD
// ============================================
const PriceBookItemCard = ({
    item,
    onEdit,
    onDelete,
    onToggleFavorite,
    onDuplicate,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG[ITEM_TYPES.MATERIAL];
    const TypeIcon = typeConfig.icon;
    const categoryConfig = PRICE_BOOK_CATEGORIES.find(c => c.value === item.category);
    const CategoryIcon = categoryConfig ? ICON_MAP[categoryConfig.icon] || Wrench : Wrench;

    const formatPrice = (price, unit) => {
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(price || 0);
        
        if (unit && unit !== 'each') {
            return `${formatted}/${unit}`;
        }
        return formatted;
    };

    // Calculate margin if cost is set
    const margin = item.costPrice > 0 
        ? ((item.unitPrice - item.costPrice) / item.unitPrice * 100).toFixed(0)
        : null;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all group">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Category Icon */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <CategoryIcon size={20} className="text-slate-600" />
                    </div>
                    
                    {/* Name & Description */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-slate-800 truncate">{item.name}</h4>
                            {item.isFavorite && (
                                <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                            )}
                        </div>
                        {item.description && (
                            <p className="text-sm text-slate-500 truncate">{item.description}</p>
                        )}
                    </div>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                    <p className="font-bold text-lg text-emerald-600">
                        {formatPrice(item.unitPrice, item.unit)}
                    </p>
                    {margin && (
                        <p className="text-xs text-slate-400">{margin}% margin</p>
                    )}
                </div>
            </div>

            {/* Tags Row */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                    {typeConfig.label}
                </span>
                {categoryConfig && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {categoryConfig.label}
                    </span>
                )}
                {item.brand && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {item.brand}
                    </span>
                )}
                {item.estimatedDuration && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 flex items-center gap-1">
                        <Clock size={10} />
                        {item.estimatedDuration}
                    </span>
                )}
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                    {item.usageCount > 0 && (
                        <span>Used {item.usageCount}x</span>
                    )}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onToggleFavorite(item.id, !item.isFavorite)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        {item.isFavorite ? (
                            <StarOff size={16} className="text-slate-400" />
                        ) : (
                            <Star size={16} className="text-slate-400" />
                        )}
                    </button>
                    <button
                        onClick={() => onDuplicate(item)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Duplicate"
                    >
                        <Copy size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => onEdit(item)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={16} className="text-slate-400" />
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
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
// ADD/EDIT ITEM MODAL
// ============================================
const ItemModal = ({ item, onSave, onClose }) => {
    const isEditing = !!item?.id;
    const [formData, setFormData] = useState({
        name: item?.name || '',
        description: item?.description || '',
        type: item?.type || ITEM_TYPES.SERVICE,
        category: item?.category || 'general',
        unitPrice: item?.unitPrice || '',
        unit: item?.unit || 'each',
        costPrice: item?.costPrice || '',
        brand: item?.brand || '',
        model: item?.model || '',
        sku: item?.sku || '',
        supplier: item?.supplier || '',
        estimatedDuration: item?.estimatedDuration || '',
        crewSize: item?.crewSize || 1,
        defaultWarranty: item?.defaultWarranty || '',
        tags: item?.tags?.join(', ') || '',
    });
    const [saving, setSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }
        
        if (!formData.unitPrice || parseFloat(formData.unitPrice) <= 0) {
            toast.error('Price is required');
            return;
        }

        setSaving(true);
        
        const dataToSave = {
            ...formData,
            unitPrice: parseFloat(formData.unitPrice) || 0,
            costPrice: parseFloat(formData.costPrice) || 0,
            crewSize: parseInt(formData.crewSize) || 1,
            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        };

        await onSave(dataToSave, item?.id);
        setSaving(false);
    };

    const unitOptions = [
        { value: 'each', label: 'Each' },
        { value: 'hour', label: 'Per Hour' },
        { value: 'sqft', label: 'Per Sq Ft' },
        { value: 'linear_ft', label: 'Per Linear Ft' },
        { value: 'lb', label: 'Per Pound' },
        { value: 'day', label: 'Per Day' },
        { value: 'job', label: 'Per Job' },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">
                        {isEditing ? 'Edit Item' : 'Add Price Book Item'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Item Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., HVAC Tune-Up, Air Filter, Labor Hour"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Description
                        </label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Brief description for quotes"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    {/* Type & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Type
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value={ITEM_TYPES.SERVICE}>Service (Material + Labor)</option>
                                <option value={ITEM_TYPES.MATERIAL}>Material Only</option>
                                <option value={ITEM_TYPES.LABOR}>Labor Only</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Category
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {PRICE_BOOK_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Price & Unit */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Price *
                            </label>
                            <div className="relative">
                                <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.unitPrice}
                                    onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                Unit
                            </label>
                            <select
                                value={formData.unit}
                                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {unitOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Estimated Duration */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                            Estimated Duration
                        </label>
                        <input
                            type="text"
                            value={formData.estimatedDuration}
                            onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                            placeholder="e.g., 1 hour, 2-3 hours, Half day"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    {/* Advanced Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                    >
                        {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                    </button>

                    {/* Advanced Fields */}
                    {showAdvanced && (
                        <div className="space-y-4 pt-2 border-t border-slate-100">
                            {/* Cost Price (for margin tracking) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Your Cost (for profit tracking)
                                </label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.costPrice}
                                        onChange={(e) => setFormData(prev => ({ ...prev, costPrice: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                {formData.costPrice > 0 && formData.unitPrice > 0 && (
                                    <p className="text-xs text-emerald-600 mt-1">
                                        Margin: {((formData.unitPrice - formData.costPrice) / formData.unitPrice * 100).toFixed(0)}%
                                    </p>
                                )}
                            </div>

                            {/* Brand & Model */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Brand
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                                        placeholder="e.g., Carrier, Rheem"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        Model / SKU
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.model}
                                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="Model number"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Supplier
                                </label>
                                <input
                                    type="text"
                                    value={formData.supplier}
                                    onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                                    placeholder="Where you get this item"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            {/* Default Warranty */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Default Warranty
                                </label>
                                <input
                                    type="text"
                                    value={formData.defaultWarranty}
                                    onChange={(e) => setFormData(prev => ({ ...prev, defaultWarranty: e.target.value }))}
                                    placeholder="e.g., 1 year parts, 90 days labor"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                    Tags (comma separated)
                                </label>
                                <input
                                    type="text"
                                    value={formData.tags}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                                    placeholder="e.g., maintenance, filter, seasonal"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

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
                            {isEditing ? 'Save Changes' : 'Add Item'}
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
const EmptyState = ({ onAddItem, onSeedStarters }) => (
    <div className="text-center py-16">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package size={40} className="text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Your Price Book is Empty</h3>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Add your commonly used items and services with standard pricing. 
            This makes creating quotes much faster!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
                onClick={onAddItem}
                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                Add Your First Item
            </button>
            <button
                onClick={onSeedStarters}
                className="px-6 py-3 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"
            >
                <Sparkles size={20} />
                Start with Common Items
            </button>
        </div>
    </div>
);

// ============================================
// MAIN PRICE BOOK COMPONENT
// ============================================
export const PriceBook = ({ contractorId }) => {
    const {
        filteredItems,
        stats,
        favorites,
        recentlyUsed,
        loading,
        searchTerm,
        selectedCategory,
        setSearchTerm,
        setSelectedCategory,
        addItem,
        updateItem,
        deleteItem,
        toggleItemFavorite,
        seedStarterItems,
        categories,
    } = usePriceBook(contractorId);

    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    // Handle save (create or update)
    const handleSave = async (formData, existingId) => {
        if (existingId) {
            await updateItem(existingId, formData);
        } else {
            await addItem(formData);
        }
        setShowModal(false);
        setEditingItem(null);
    };

    // Handle edit
    const handleEdit = (item) => {
        setEditingItem(item);
        setShowModal(true);
    };

    // Handle duplicate
    const handleDuplicate = (item) => {
        const duplicated = {
            ...item,
            name: `${item.name} (Copy)`,
            id: undefined,
        };
        setEditingItem(duplicated);
        setShowModal(true);
    };

    // Handle delete
    const handleDelete = async (itemId) => {
        if (window.confirm('Remove this item from your price book?')) {
            await deleteItem(itemId);
        }
    };

    // Handle seed starters
    const handleSeedStarters = async () => {
        if (window.confirm('Add common items to your price book? You can edit or remove them later.')) {
            await seedStarterItems();
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
                    <h1 className="text-2xl font-bold text-slate-800">Price Book</h1>
                    <p className="text-slate-500">
                        {stats.total} items • Quick-add to quotes
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingItem(null);
                        setShowModal(true);
                    }}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2"
                >
                    <Plus size={18} />
                    Add Item
                </button>
            </div>

            {/* Stats Bar */}
            {stats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        <p className="text-xs font-medium text-slate-500 uppercase">Total Items</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{stats.services}</p>
                        <p className="text-xs font-medium text-slate-500 uppercase">Services</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{stats.materials}</p>
                        <p className="text-xs font-medium text-slate-500 uppercase">Materials</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{stats.labor}</p>
                        <p className="text-xs font-medium text-slate-500 uppercase">Labor</p>
                    </div>
                </div>
            )}

            {/* Search & Filter Bar */}
            {stats.total > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search items..."
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
                    <select
                        value={selectedCategory || ''}
                        onChange={(e) => setSelectedCategory(e.target.value || null)}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Favorites Section */}
            {favorites.length > 0 && !searchTerm && !selectedCategory && (
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <Star size={14} className="text-amber-500" />
                        Favorites
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {favorites.slice(0, 3).map(item => (
                            <PriceBookItemCard
                                key={item.id}
                                item={item}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggleFavorite={toggleItemFavorite}
                                onDuplicate={handleDuplicate}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Items Grid */}
            {filteredItems.length === 0 ? (
                stats.total === 0 ? (
                    <EmptyState 
                        onAddItem={() => setShowModal(true)} 
                        onSeedStarters={handleSeedStarters}
                    />
                ) : (
                    <div className="text-center py-12">
                        <Search size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">No items match your search</p>
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
                    {filteredItems.map(item => (
                        <PriceBookItemCard
                            key={item.id}
                            item={item}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleFavorite={toggleItemFavorite}
                            onDuplicate={handleDuplicate}
                        />
                    ))}
                </div>
            )}

            {/* Add Starter Items Button (when some items exist but < 5) */}
            {stats.total > 0 && stats.total < 5 && (
                <div className="text-center py-8 border-t border-slate-100">
                    <p className="text-slate-500 mb-3">Want more items to start with?</p>
                    <button
                        onClick={handleSeedStarters}
                        className="px-4 py-2 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 inline-flex items-center gap-2"
                    >
                        <Sparkles size={16} />
                        Add Common Items
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <ItemModal
                    item={editingItem}
                    onSave={handleSave}
                    onClose={() => {
                        setShowModal(false);
                        setEditingItem(null);
                    }}
                />
            )}
        </div>
    );
};

export default PriceBook;
