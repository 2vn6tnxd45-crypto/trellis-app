// src/lib/utils.js

export const toProperCase = (str) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

export const calculateNextDate = (startDate, frequency) => {
    if (!startDate || !frequency || frequency === 'none') return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null; 
    
    // FIX: Updated frequency map to match MAINTENANCE_FREQUENCIES constants
    // This was causing "complete" to not properly calculate next dates for certain frequencies
    const freqMap = { 
        'monthly': 1,
        'quarterly': 3, 
        'semiannual': 6,    // legacy support
        'biannual': 6,      // current app standard
        'annual': 12, 
        'biennial': 24,     // legacy support
        '2years': 24,       // current app standard
        'quinquennial': 60, // legacy support
        '5years': 60        // current app standard
    };
    
    const monthsToAdd = freqMap[frequency.toLowerCase()];
    if (!monthsToAdd) return null;
    
    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    return nextDate.toISOString().split('T')[0]; 
};

/**
 * Format a number as USD currency
 * @param {number} value - The amount to format
 * @param {object} options - Optional formatting options
 * @param {boolean} options.showCents - Whether to show cents (default: false for whole numbers)
 * @param {string} options.fallback - What to show if value is null/undefined (default: '$0')
 * @returns {string} Formatted currency string like "$1,234" or "$1,234.56"
 */
export const formatCurrency = (value, options = {}) => {
    const { showCents = false, fallback = '$0' } = options;
    
    // Handle null, undefined, NaN
    if (value === null || value === undefined || isNaN(value)) {
        return fallback;
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: showCents ? 2 : 0,
        maximumFractionDigits: showCents ? 2 : 0,
    }).format(value);
};
