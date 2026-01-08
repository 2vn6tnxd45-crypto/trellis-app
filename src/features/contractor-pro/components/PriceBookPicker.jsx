// src/features/contractor-pro/components/PriceBookPicker.jsx
// ============================================
// PRICE BOOK PICKER
// ============================================
// Modal/dropdown for quickly adding items from price book to quotes
// Used inside the QuoteBuilder component

import React, { useState, useMemo } from 'react';
import {
    Search, X, Package, Wrench, Clock, Star,
    Plus, ChevronRight, Loader2, Sparkles,
    Wind, Droplets, Zap, Home, Refrigerator, Palette,
    Layers, Trees
} from 'lucide-react';
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
// TYPE CONFIG
// ============================================
const TYPE_CONFIG = {
    [ITEM_TYPES.MATERIAL]: { label: 'Material', color: 'bg-amber-100 text-amber-700' },
    [ITEM_TYPES.LABOR]: { label: 'Labor', color: 'bg-blue-100 text-blue-700' },
    [ITEM_TYPES.SERVICE]: { label: 'Service', color: 'bg-emerald-100 text-emerald-700' },
};

// ============================================
// COMPACT ITEM ROW
// ============================================
const CompactItemRow = ({ item, onSelect, selected }) => {
    const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG[ITEM_TYPES.SERVICE];
    
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

    return (
        <button
            onClick={() => onSelect(item)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                selected 
                    ? 'bg-emerald-50 border-2 border-emerald-500' 
                    : 'bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
        >
            {/* Favorite indicator */}
            {item.isFavorite && (
                <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
            )}
            
            {/* Name & Description */}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{item.name}</p>
                {item.description && (
                    <p className="text-xs text-slate-500 truncate">{item.description}</p>
                )}
            </div>

            {/* Type Badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.color} shrink-0`}>
                {typeConfig.label}
            </span>

            {/* Price */}
            <span className="font-bold text-emerald-600 shrink-0">
                {formatPrice(item.unitPrice, item.unit)}
            </span>

            {/* Add Icon */}
            <Plus size={16} className="text-slate-400 shrink-0" />
        </button>
    );
};

// ============================================
// CATEGORY TAB
// ============================================
const CategoryTab = ({ category, isActive, count, onClick }) => {
    const Icon = ICON_MAP[category.icon] || Wrench;
    
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
            <Icon size={14} />
            {category.label}
            {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-emerald-200' : 'bg-slate-200'
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
};

// ============================================
// MAIN PRICE BOOK PICKER COMPONENT
// ============================================
export const PriceBookPicker = ({ 
    contractorId, 
    onSelectItem, 
    onClose,
    selectedItems = [], // IDs of already-added items
}) => {
    const {
        items,
        filteredItems,
        favorites,
        recentlyUsed,
        mostUsed,
        loading,
        searchTerm,
        selectedCategory,
        setSearchTerm,
        setSelectedCategory,
        toLineItem,
        categories,
    } = usePriceBook(contractorId);

    const [addedIds, setAddedIds] = useState(new Set(selectedItems));

    // Handle item selection
    const handleSelect = (item) => {
        const lineItem = toLineItem(item, 1);
        onSelectItem(lineItem);
        setAddedIds(prev => new Set([...prev, item.id]));
    };

    // Items grouped by category for "All" view
    const groupedItems = useMemo(() => {
        if (selectedCategory || searchTerm) return null;
        
        const groups = {};
        categories.forEach(cat => {
            const catItems = items.filter(i => i.category === cat.value);
            if (catItems.length > 0) {
                groups[cat.value] = catItems;
            }
        });
        return groups;
    }, [items, categories, selectedCategory, searchTerm]);

    // Get count per category
    const categoryCounts = useMemo(() => {
        const counts = {};
        categories.forEach(cat => {
            counts[cat.value] = items.filter(i => i.category === cat.value).length;
        });
        return counts;
    }, [items, categories]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8">
                    <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" />
                    <p className="text-slate-500 mt-3">Loading price book...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Add from Price Book</h2>
                        <p className="text-sm text-slate-500">{items.length} items available</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search items..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            autoFocus
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
                </div>

                {/* Category Tabs */}
                <div className="px-4 py-2 border-b border-slate-100 overflow-x-auto">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                !selectedCategory
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <CategoryTab
                                key={cat.value}
                                category={cat}
                                isActive={selectedCategory === cat.value}
                                count={categoryCounts[cat.value]}
                                onClick={() => setSelectedCategory(cat.value)}
                            />
                        ))}
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {items.length === 0 ? (
                        <div className="text-center py-12">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 mb-2">Your price book is empty</p>
                            <p className="text-sm text-slate-400">
                                Add items in Settings → Price Book
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12">
                            <Search size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500">No items match "{searchTerm}"</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Quick Access - Favorites */}
                            {favorites.length > 0 && !searchTerm && !selectedCategory && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <Star size={12} className="text-amber-500" />
                                        Favorites
                                    </h4>
                                    <div className="space-y-2">
                                        {favorites.slice(0, 3).map(item => (
                                            <CompactItemRow
                                                key={item.id}
                                                item={item}
                                                onSelect={handleSelect}
                                                selected={addedIds.has(item.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recently Used */}
                            {recentlyUsed.length > 0 && !searchTerm && !selectedCategory && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <Clock size={12} />
                                        Recently Used
                                    </h4>
                                    <div className="space-y-2">
                                        {recentlyUsed.slice(0, 3).map(item => (
                                            <CompactItemRow
                                                key={item.id}
                                                item={item}
                                                onSelect={handleSelect}
                                                selected={addedIds.has(item.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Grouped by Category (when no filter) */}
                            {groupedItems && Object.entries(groupedItems).map(([catValue, catItems]) => {
                                const category = categories.find(c => c.value === catValue);
                                if (!category) return null;
                                
                                return (
                                    <div key={catValue}>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                                            {category.label}
                                        </h4>
                                        <div className="space-y-2">
                                            {catItems.map(item => (
                                                <CompactItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onSelect={handleSelect}
                                                    selected={addedIds.has(item.id)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Filtered Results (when searching or category selected) */}
                            {(searchTerm || selectedCategory) && (
                                <div className="space-y-2">
                                    {filteredItems.map(item => (
                                        <CompactItemRow
                                            key={item.id}
                                            item={item}
                                            onSelect={handleSelect}
                                            selected={addedIds.has(item.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <p className="text-sm text-slate-500">
                        {addedIds.size > selectedItems.length && (
                            <span className="text-emerald-600 font-medium">
                                {addedIds.size - selectedItems.length} item(s) added
                            </span>
                        )}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// INLINE PRICE BOOK BUTTON
// ============================================
// A small button to open the picker, for use in QuoteBuilder
export const PriceBookButton = ({ onClick, itemCount = 0 }) => (
    <button
        onClick={onClick}
        className="px-3 py-1.5 text-sm border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-2 transition-colors"
    >
        <Sparkles size={14} />
        From Price Book
        {itemCount > 0 && (
            <span className="text-xs bg-emerald-200 px-1.5 py-0.5 rounded-full">
                {itemCount}
            </span>
        )}
    </button>
);

export default PriceBookPicker;
