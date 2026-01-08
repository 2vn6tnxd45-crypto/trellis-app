// src/features/contractor-pro/lib/priceBook/index.js
// ============================================
// PRICE BOOK FEATURE EXPORTS
// ============================================
// Central export file for price book functionality

// Service (database operations)
export {
    createPriceBookItem,
    updatePriceBookItem,
    deletePriceBookItem,
    getPriceBookItem,
    getPriceBookItems,
    subscribeToPriceBook,
    incrementItemUsage,
    toggleFavorite,
    bulkImportItems,
    searchPriceBook,
    priceBookItemToLineItem,
    getStarterItems,
    PRICE_BOOK_CATEGORIES,
    ITEM_TYPES,
} from './priceBookService';

// Hook
export { usePriceBook } from './usePriceBook';

// Components
export { PriceBook } from './PriceBook';
export { PriceBookPicker, PriceBookButton } from './PriceBookPicker';
