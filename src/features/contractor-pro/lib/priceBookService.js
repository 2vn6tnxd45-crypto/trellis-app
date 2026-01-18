// src/features/contractor-pro/lib/priceBookService.js
// ============================================
// PRICE BOOK SERVICE
// ============================================
// Manages saved items/services with standard pricing
// Enables quick quote creation and consistent pricing

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../../config/firebase';

// Collection paths
const appId = 'krib-app';
const CONTRACTORS_COLLECTION = `/artifacts/${appId}/public/data/contractors`;
const PRICE_BOOK_SUBCOLLECTION = 'priceBook';

// ============================================
// CATEGORY DEFINITIONS
// ============================================
export const PRICE_BOOK_CATEGORIES = [
    { value: 'hvac', label: 'HVAC', icon: 'Wind' },
    { value: 'plumbing', label: 'Plumbing', icon: 'Droplets' },
    { value: 'electrical', label: 'Electrical', icon: 'Zap' },
    { value: 'roofing', label: 'Roofing', icon: 'Home' },
    { value: 'appliances', label: 'Appliances', icon: 'Refrigerator' },
    { value: 'painting', label: 'Painting', icon: 'Palette' },
    { value: 'flooring', label: 'Flooring', icon: 'Layers' },
    { value: 'landscaping', label: 'Landscaping', icon: 'Trees' },
    { value: 'general', label: 'General', icon: 'Wrench' },
    { value: 'labor', label: 'Labor Only', icon: 'Clock' },
];

// Item types
export const ITEM_TYPES = {
    MATERIAL: 'material',
    LABOR: 'labor',
    SERVICE: 'service', // Combined material + labor (like "HVAC Tune-Up")
};

// ============================================
// CREATE PRICE BOOK ITEM
// ============================================
/**
 * Add a new item to the contractor's price book
 * @param {string} contractorId 
 * @param {object} itemData 
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export const createPriceBookItem = async (contractorId, itemData) => {
    try {
        const priceBookRef = collection(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION);
        
        const newItem = {
            // Core fields
            name: itemData.name?.trim() || '',
            description: itemData.description?.trim() || '',
            type: itemData.type || ITEM_TYPES.MATERIAL,
            category: itemData.category || 'general',
            
            // Pricing
            unitPrice: parseFloat(itemData.unitPrice) || 0,
            unit: itemData.unit || 'each', // each, hour, sqft, linear ft, etc.
            costPrice: parseFloat(itemData.costPrice) || 0, // Your cost (for profit tracking)
            
            // For materials - optional specs
            brand: itemData.brand?.trim() || '',
            model: itemData.model?.trim() || '',
            sku: itemData.sku?.trim() || '',
            supplier: itemData.supplier?.trim() || '',
            
            // For labor/services
            estimatedDuration: itemData.estimatedDuration || '', // e.g., "2 hours", "1 day"
            crewSize: itemData.crewSize || 1,
            
            // Warranty info (for when this item is installed)
            defaultWarranty: itemData.defaultWarranty || '',
            
            // Organization
            tags: itemData.tags || [], // For searching: ["filter", "replacement", "maintenance"]
            isActive: itemData.isActive !== false, // Can hide items without deleting
            isFavorite: itemData.isFavorite || false, // Quick access
            
            // Usage tracking
            usageCount: 0, // Incremented when added to quotes
            lastUsed: null,
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(priceBookRef, newItem);
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating price book item:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// UPDATE PRICE BOOK ITEM
// ============================================
/**
 * Update an existing price book item
 */
export const updatePriceBookItem = async (contractorId, itemId, updates) => {
    try {
        const itemRef = doc(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION, itemId);
        
        await updateDoc(itemRef, {
            ...updates,
            updatedAt: serverTimestamp(),
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error updating price book item:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// DELETE PRICE BOOK ITEM
// ============================================
/**
 * Delete a price book item (or soft-delete by setting isActive: false)
 */
export const deletePriceBookItem = async (contractorId, itemId, hardDelete = false) => {
    try {
        const itemRef = doc(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION, itemId);
        
        if (hardDelete) {
            await deleteDoc(itemRef);
        } else {
            // Soft delete - keeps for historical reference
            await updateDoc(itemRef, {
                isActive: false,
                deletedAt: serverTimestamp(),
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting price book item:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GET SINGLE ITEM
// ============================================
export const getPriceBookItem = async (contractorId, itemId) => {
    try {
        const itemRef = doc(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION, itemId);
        const snapshot = await getDoc(itemRef);
        
        if (!snapshot.exists()) {
            return { success: false, error: 'Item not found' };
        }
        
        return { 
            success: true, 
            item: { id: snapshot.id, ...snapshot.data() } 
        };
    } catch (error) {
        console.error('Error getting price book item:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GET ALL ITEMS (ONE-TIME FETCH)
// ============================================
export const getPriceBookItems = async (contractorId, options = {}) => {
    try {
        const { 
            category = null, 
            type = null, 
            activeOnly = true,
            favoritesOnly = false 
        } = options;
        
        let q = collection(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION);
        
        // Build query constraints
        const constraints = [];
        
        if (activeOnly) {
            constraints.push(where('isActive', '==', true));
        }
        
        if (category) {
            constraints.push(where('category', '==', category));
        }
        
        if (type) {
            constraints.push(where('type', '==', type));
        }
        
        if (favoritesOnly) {
            constraints.push(where('isFavorite', '==', true));
        }
        
        constraints.push(orderBy('name', 'asc'));
        constraints.push(limit(200));

        q = query(q, ...constraints);

        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        return { success: true, items };
    } catch (error) {
        console.error('Error getting price book items:', error);
        return { success: false, error: error.message, items: [] };
    }
};

// ============================================
// SUBSCRIBE TO PRICE BOOK (REAL-TIME)
// ============================================
/**
 * Real-time subscription to price book items
 * @param {string} contractorId 
 * @param {function} callback - Called with array of items
 * @param {object} options - Filter options
 * @returns {function} Unsubscribe function
 */
export const subscribeToPriceBook = (contractorId, callback, options = {}) => {
    const { activeOnly = true } = options;
    
    let q = collection(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION);
    
    if (activeOnly) {
        q = query(q, where('isActive', '==', true), orderBy('name', 'asc'));
    } else {
        q = query(q, orderBy('name', 'asc'));
    }
    
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(items);
    }, (error) => {
        console.error('Price book subscription error:', error);
        callback([]);
    });
};

// ============================================
// INCREMENT USAGE COUNT
// ============================================
/**
 * Called when an item is added to a quote
 */
export const incrementItemUsage = async (contractorId, itemId) => {
    try {
        const itemRef = doc(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION, itemId);
        
        await updateDoc(itemRef, {
            usageCount: increment(1),
            lastUsed: serverTimestamp(),
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error incrementing usage:', error);
        return { success: false };
    }
};

// ============================================
// TOGGLE FAVORITE
// ============================================
export const toggleFavorite = async (contractorId, itemId, isFavorite) => {
    try {
        const itemRef = doc(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION, itemId);
        
        await updateDoc(itemRef, {
            isFavorite: isFavorite,
            updatedAt: serverTimestamp(),
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error toggling favorite:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// BULK IMPORT
// ============================================
/**
 * Import multiple items at once (for initial setup or CSV import)
 */
export const bulkImportItems = async (contractorId, items) => {
    try {
        const batch = writeBatch(db);
        const priceBookRef = collection(db, CONTRACTORS_COLLECTION, contractorId, PRICE_BOOK_SUBCOLLECTION);
        
        items.forEach((item) => {
            const docRef = doc(priceBookRef);
            batch.set(docRef, {
                name: item.name?.trim() || '',
                description: item.description?.trim() || '',
                type: item.type || ITEM_TYPES.MATERIAL,
                category: item.category || 'general',
                unitPrice: parseFloat(item.unitPrice) || 0,
                unit: item.unit || 'each',
                costPrice: parseFloat(item.costPrice) || 0,
                brand: item.brand?.trim() || '',
                model: item.model?.trim() || '',
                sku: item.sku?.trim() || '',
                supplier: item.supplier?.trim() || '',
                estimatedDuration: item.estimatedDuration || '',
                crewSize: item.crewSize || 1,
                defaultWarranty: item.defaultWarranty || '',
                tags: item.tags || [],
                isActive: true,
                isFavorite: false,
                usageCount: 0,
                lastUsed: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
        
        await batch.commit();
        
        return { success: true, count: items.length };
    } catch (error) {
        console.error('Error bulk importing:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// SEARCH PRICE BOOK
// ============================================
/**
 * Search items by name, description, tags, brand, model
 * Note: Firestore doesn't support full-text search, so this does client-side filtering
 * For production, consider Algolia or Elasticsearch
 */
export const searchPriceBook = (items, searchTerm) => {
    if (!searchTerm?.trim()) return items;
    
    const term = searchTerm.toLowerCase().trim();
    
    return items.filter(item => {
        const searchableText = [
            item.name,
            item.description,
            item.brand,
            item.model,
            item.sku,
            item.category,
            ...(item.tags || []),
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchableText.includes(term);
    });
};

// ============================================
// CONVERT PRICE BOOK ITEM TO QUOTE LINE ITEM
// ============================================
/**
 * Converts a price book item to the format used in quotes
 * This is the bridge between price book and quote builder
 */
export const priceBookItemToLineItem = (priceBookItem, quantity = 1) => {
    return {
        id: Date.now() + Math.random(),
        priceBookItemId: priceBookItem.id, // Track source
        type: priceBookItem.type === ITEM_TYPES.LABOR ? 'labor' : 'material',
        description: priceBookItem.name + (priceBookItem.description ? ` - ${priceBookItem.description}` : ''),
        quantity: quantity,
        unitPrice: priceBookItem.unitPrice || 0,
        // Equipment specs (for materials)
        brand: priceBookItem.brand || '',
        model: priceBookItem.model || '',
        serial: '', // Filled in at job time
        warranty: priceBookItem.defaultWarranty || '',
        // Labor specs
        crewSize: priceBookItem.crewSize || '',
        estimatedDuration: priceBookItem.estimatedDuration || '',
        // UI state
        isExpanded: true,
    };
};

// ============================================
// DEFAULT STARTER ITEMS
// ============================================
/**
 * Common items to seed a new contractor's price book
 */
export const getStarterItems = (category = null) => {
    const allItems = [
        // HVAC
        { name: 'HVAC Tune-Up', description: 'Seasonal maintenance service', type: 'service', category: 'hvac', unitPrice: 149, unit: 'each', estimatedDuration: '1 hour' },
        { name: 'Air Filter Replacement', description: 'Standard 1" filter', type: 'material', category: 'hvac', unitPrice: 35, unit: 'each', estimatedDuration: '15 min' },
        { name: 'Refrigerant Recharge', description: 'R-410A per pound', type: 'service', category: 'hvac', unitPrice: 75, unit: 'lb' },
        { name: 'Thermostat Installation', description: 'Smart thermostat install', type: 'service', category: 'hvac', unitPrice: 199, unit: 'each', estimatedDuration: '1 hour' },
        { name: 'Duct Cleaning', description: 'Complete system cleaning', type: 'service', category: 'hvac', unitPrice: 399, unit: 'each', estimatedDuration: '3 hours' },
        
        // Plumbing
        { name: 'Service Call', description: 'Diagnostic visit', type: 'labor', category: 'plumbing', unitPrice: 89, unit: 'each', estimatedDuration: '30 min' },
        { name: 'Drain Cleaning', description: 'Snake/auger service', type: 'service', category: 'plumbing', unitPrice: 175, unit: 'each', estimatedDuration: '1 hour' },
        { name: 'Water Heater Flush', description: 'Tank flush & inspection', type: 'service', category: 'plumbing', unitPrice: 149, unit: 'each', estimatedDuration: '1 hour' },
        { name: 'Faucet Installation', description: 'Standard faucet install (fixture not included)', type: 'labor', category: 'plumbing', unitPrice: 175, unit: 'each', estimatedDuration: '1 hour' },
        { name: 'Toilet Repair', description: 'Flapper, fill valve, or handle', type: 'service', category: 'plumbing', unitPrice: 125, unit: 'each', estimatedDuration: '45 min' },
        
        // Electrical
        { name: 'Outlet Installation', description: 'Standard 120V outlet', type: 'service', category: 'electrical', unitPrice: 175, unit: 'each', estimatedDuration: '45 min' },
        { name: 'Ceiling Fan Installation', description: 'Replace existing fixture', type: 'service', category: 'electrical', unitPrice: 199, unit: 'each', estimatedDuration: '1.5 hours' },
        { name: 'Panel Inspection', description: 'Electrical panel safety check', type: 'service', category: 'electrical', unitPrice: 149, unit: 'each', estimatedDuration: '1 hour' },
        { name: 'GFCI Outlet Install', description: 'Ground fault outlet', type: 'service', category: 'electrical', unitPrice: 195, unit: 'each', estimatedDuration: '45 min' },
        
        // General Labor
        { name: 'Labor - Standard Rate', description: 'General labor per hour', type: 'labor', category: 'labor', unitPrice: 85, unit: 'hour' },
        { name: 'Labor - Premium Rate', description: 'Specialized work per hour', type: 'labor', category: 'labor', unitPrice: 125, unit: 'hour' },
        { name: 'Labor - After Hours', description: 'Evening/weekend rate', type: 'labor', category: 'labor', unitPrice: 150, unit: 'hour' },
    ];
    
    if (category) {
        return allItems.filter(item => item.category === category);
    }
    
    return allItems;
};

export default {
    // CRUD
    createPriceBookItem,
    updatePriceBookItem,
    deletePriceBookItem,
    getPriceBookItem,
    getPriceBookItems,
    subscribeToPriceBook,
    
    // Helpers
    incrementItemUsage,
    toggleFavorite,
    bulkImportItems,
    searchPriceBook,
    priceBookItemToLineItem,
    getStarterItems,
    
    // Constants
    PRICE_BOOK_CATEGORIES,
    ITEM_TYPES,
};
