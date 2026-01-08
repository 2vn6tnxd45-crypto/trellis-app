// src/features/contractor-pro/hooks/usePriceBook.js
// ============================================
// USE PRICE BOOK HOOK
// ============================================
// React hook for managing price book state with real-time updates

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    subscribeToPriceBook,
    createPriceBookItem,
    updatePriceBookItem,
    deletePriceBookItem,
    toggleFavorite,
    incrementItemUsage,
    bulkImportItems,
    searchPriceBook,
    priceBookItemToLineItem,
    getStarterItems,
    PRICE_BOOK_CATEGORIES,
    ITEM_TYPES,
} from '../lib/priceBookService';
import toast from 'react-hot-toast';

/**
 * Hook for managing price book data
 * @param {string} contractorId - The contractor's ID
 * @returns {object} Price book state and functions
 */
export const usePriceBook = (contractorId) => {
    // State
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedType, setSelectedType] = useState(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // ============================================
    // REAL-TIME SUBSCRIPTION
    // ============================================
    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribe = subscribeToPriceBook(
            contractorId,
            (fetchedItems) => {
                setItems(fetchedItems);
                setLoading(false);
            },
            { activeOnly: true }
        );

        return () => unsubscribe();
    }, [contractorId]);

    // ============================================
    // FILTERED & SEARCHED ITEMS
    // ============================================
    const filteredItems = useMemo(() => {
        let result = items;

        // Filter by category
        if (selectedCategory) {
            result = result.filter(item => item.category === selectedCategory);
        }

        // Filter by type
        if (selectedType) {
            result = result.filter(item => item.type === selectedType);
        }

        // Filter favorites
        if (showFavoritesOnly) {
            result = result.filter(item => item.isFavorite);
        }

        // Search
        if (searchTerm) {
            result = searchPriceBook(result, searchTerm);
        }

        return result;
    }, [items, selectedCategory, selectedType, showFavoritesOnly, searchTerm]);

    // ============================================
    // GROUPED BY CATEGORY
    // ============================================
    const itemsByCategory = useMemo(() => {
        const grouped = {};
        
        PRICE_BOOK_CATEGORIES.forEach(cat => {
            grouped[cat.value] = filteredItems.filter(item => item.category === cat.value);
        });
        
        return grouped;
    }, [filteredItems]);

    // ============================================
    // STATS
    // ============================================
    const stats = useMemo(() => {
        return {
            total: items.length,
            materials: items.filter(i => i.type === ITEM_TYPES.MATERIAL).length,
            labor: items.filter(i => i.type === ITEM_TYPES.LABOR).length,
            services: items.filter(i => i.type === ITEM_TYPES.SERVICE).length,
            favorites: items.filter(i => i.isFavorite).length,
        };
    }, [items]);

    // ============================================
    // RECENTLY USED (Top 5)
    // ============================================
    const recentlyUsed = useMemo(() => {
        return [...items]
            .filter(item => item.lastUsed)
            .sort((a, b) => {
                const aTime = a.lastUsed?.toDate?.() || new Date(0);
                const bTime = b.lastUsed?.toDate?.() || new Date(0);
                return bTime - aTime;
            })
            .slice(0, 5);
    }, [items]);

    // ============================================
    // MOST USED (Top 5)
    // ============================================
    const mostUsed = useMemo(() => {
        return [...items]
            .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
            .slice(0, 5);
    }, [items]);

    // ============================================
    // FAVORITES
    // ============================================
    const favorites = useMemo(() => {
        return items.filter(item => item.isFavorite);
    }, [items]);

    // ============================================
    // ACTIONS
    // ============================================
    
    const addItem = useCallback(async (itemData) => {
        if (!contractorId) {
            toast.error('No contractor ID');
            return { success: false };
        }

        const result = await createPriceBookItem(contractorId, itemData);
        
        if (result.success) {
            toast.success(`"${itemData.name}" added to price book`);
        } else {
            toast.error('Failed to add item');
        }
        
        return result;
    }, [contractorId]);

    const updateItem = useCallback(async (itemId, updates) => {
        if (!contractorId) return { success: false };

        const result = await updatePriceBookItem(contractorId, itemId, updates);
        
        if (result.success) {
            toast.success('Item updated');
        } else {
            toast.error('Failed to update item');
        }
        
        return result;
    }, [contractorId]);

    const deleteItem = useCallback(async (itemId, hardDelete = false) => {
        if (!contractorId) return { success: false };

        const result = await deletePriceBookItem(contractorId, itemId, hardDelete);
        
        if (result.success) {
            toast.success('Item removed');
        } else {
            toast.error('Failed to remove item');
        }
        
        return result;
    }, [contractorId]);

    const toggleItemFavorite = useCallback(async (itemId, isFavorite) => {
        if (!contractorId) return { success: false };

        const result = await toggleFavorite(contractorId, itemId, isFavorite);
        
        if (result.success) {
            toast.success(isFavorite ? 'Added to favorites' : 'Removed from favorites');
        }
        
        return result;
    }, [contractorId]);

    const trackUsage = useCallback(async (itemId) => {
        if (!contractorId) return;
        await incrementItemUsage(contractorId, itemId);
    }, [contractorId]);

    // ============================================
    // CONVERT TO LINE ITEM (for quotes)
    // ============================================
    const toLineItem = useCallback((priceBookItem, quantity = 1) => {
        // Track that this item was used
        if (priceBookItem.id) {
            trackUsage(priceBookItem.id);
        }
        return priceBookItemToLineItem(priceBookItem, quantity);
    }, [trackUsage]);

    // ============================================
    // BULK IMPORT
    // ============================================
    const importItems = useCallback(async (itemsToImport) => {
        if (!contractorId) return { success: false };

        const result = await bulkImportItems(contractorId, itemsToImport);
        
        if (result.success) {
            toast.success(`Imported ${result.count} items`);
        } else {
            toast.error('Import failed');
        }
        
        return result;
    }, [contractorId]);

    // ============================================
    // SEED WITH STARTER ITEMS
    // ============================================
    const seedStarterItems = useCallback(async (category = null) => {
        const starterItems = getStarterItems(category);
        return await importItems(starterItems);
    }, [importItems]);

    // ============================================
    // RETURN
    // ============================================
    return {
        // Data
        items,
        filteredItems,
        itemsByCategory,
        favorites,
        recentlyUsed,
        mostUsed,
        stats,
        
        // State
        loading,
        error,
        searchTerm,
        selectedCategory,
        selectedType,
        showFavoritesOnly,
        
        // Setters
        setSearchTerm,
        setSelectedCategory,
        setSelectedType,
        setShowFavoritesOnly,
        
        // Actions
        addItem,
        updateItem,
        deleteItem,
        toggleItemFavorite,
        trackUsage,
        toLineItem,
        importItems,
        seedStarterItems,
        
        // Constants
        categories: PRICE_BOOK_CATEGORIES,
        itemTypes: ITEM_TYPES,
    };
};

export default usePriceBook;
