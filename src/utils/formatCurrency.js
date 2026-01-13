// src/utils/formatCurrency.js
// ============================================
// CENTRALIZED CURRENCY FORMATTING
// ============================================
// Ensures consistent $X,XXX.XX format across the entire app

/**
 * Format a number as currency with 2 decimal places
 * @param {number|string} value - The value to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeSymbol - Whether to include $ symbol (default: true)
 * @param {boolean} options.includeCents - Whether to include cents (default: true)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, options = {}) => {
    const { includeSymbol = true, includeCents = true } = options;

    // Handle invalid inputs
    if (value === null || value === undefined || value === '') {
        return includeSymbol ? '$0.00' : '0.00';
    }

    // Convert to number
    const num = typeof value === 'string' ? parseFloat(value) : value;

    // Handle NaN and Infinity
    if (!isFinite(num)) {
        return includeSymbol ? '$0.00' : '0.00';
    }

    // Format with locale string
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: includeCents ? 2 : 0,
        maximumFractionDigits: includeCents ? 2 : 0
    });

    return includeSymbol ? `$${formatted}` : formatted;
};

/**
 * Format a number as currency for display (shorthand)
 * e.g., 1234567.89 -> "$1.23M" or "$1,234,567.89"
 * @param {number|string} value - The value to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.compact - Use compact notation for large numbers
 * @returns {string} Formatted currency string
 */
export const formatCurrencyCompact = (value, options = {}) => {
    const { compact = false } = options;

    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (!isFinite(num)) {
        return '$0.00';
    }

    if (compact && Math.abs(num) >= 1000000) {
        return `$${(num / 1000000).toFixed(2)}M`;
    }

    if (compact && Math.abs(num) >= 1000) {
        return `$${(num / 1000).toFixed(1)}K`;
    }

    return formatCurrency(num);
};

/**
 * Parse a currency string back to a number
 * @param {string} value - Currency string like "$1,234.56"
 * @returns {number} The numeric value
 */
export const parseCurrency = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    // Remove $ and commas, then parse
    const cleaned = String(value).replace(/[$,]/g, '');
    const num = parseFloat(cleaned);

    return isFinite(num) ? num : 0;
};

export default formatCurrency;
