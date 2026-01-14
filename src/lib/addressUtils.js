// src/lib/addressUtils.js
// ============================================
// ADDRESS UTILITIES
// ============================================
// Shared utilities for parsing and normalizing addresses across the app

/**
 * Parse a formatted address string into structured components
 * Handles formats like:
 * - "123 Main St, Springfield, IL 62701"
 * - "123 Main St, Springfield, Illinois, 62701"
 * - "123 Main St, Springfield, IL"
 *
 * @param {string} addressStr - Formatted address string
 * @returns {Object} - { street, city, state, zip }
 */
export const parseAddressString = (addressStr) => {
    if (!addressStr || typeof addressStr !== 'string') {
        return { street: '', city: '', state: '', zip: '' };
    }

    // Split by comma and clean up whitespace
    const parts = addressStr.split(',').map(p => p.trim());

    if (parts.length === 0) {
        return { street: addressStr, city: '', state: '', zip: '' };
    }

    // First part is usually the street address
    const street = parts[0] || '';

    // Second part is usually the city
    const city = parts.length > 1 ? parts[1] : '';

    // Third part usually contains "State ZIP" or just "State"
    let state = '';
    let zip = '';

    if (parts.length > 2) {
        const stateZip = parts[2].trim();
        // Match pattern like "IL 62701" or "Illinois 62701" or just "IL"
        const stateZipMatch = stateZip.match(/^([A-Za-z\s]+?)?\s*(\d{5}(?:-\d{4})?)?$/);
        if (stateZipMatch) {
            state = (stateZipMatch[1] || '').trim();
            zip = (stateZipMatch[2] || '').trim();
        } else {
            state = stateZip;
        }
    }

    // Handle case where ZIP is in a 4th part (e.g., "123 Main, City, State, 62701")
    if (!zip && parts.length > 3) {
        const possibleZip = parts[3].trim();
        if (/^\d{5}(?:-\d{4})?$/.test(possibleZip)) {
            zip = possibleZip;
        }
    }

    return { street, city, state, zip };
};

/**
 * Normalize an address to a consistent object format
 * Handles both string addresses and object addresses
 *
 * @param {string|Object} address - Address as string or object
 * @returns {Object} - Normalized { street, city, state, zip, placeId?, formatted? }
 */
export const normalizeAddress = (address) => {
    if (!address) {
        return { street: '', city: '', state: '', zip: '' };
    }

    // If it's a string, parse it
    if (typeof address === 'string') {
        return {
            ...parseAddressString(address),
            formatted: address
        };
    }

    // If it's already an object, ensure all fields exist
    return {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.zip || '',
        placeId: address.placeId || '',
        formatted: address.formatted || ''
    };
};

/**
 * Build a formatted address string from components
 * Filters out empty parts to avoid "123 Main, , , " issues
 *
 * @param {Object} address - Address object with street, city, state, zip
 * @returns {string} - Formatted address string
 */
export const formatAddress = (address) => {
    if (!address) return '';
    if (typeof address === 'string') return address;
    if (address.formatted) return address.formatted;

    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state && address.zip) {
        parts.push(`${address.state} ${address.zip}`);
    } else if (address.state) {
        parts.push(address.state);
    } else if (address.zip) {
        parts.push(address.zip);
    }

    return parts.join(', ');
};

/**
 * Check if two addresses are similar (fuzzy match)
 * Useful for detecting mismatches between quote and property addresses
 *
 * @param {string|Object} addr1 - First address
 * @param {string|Object} addr2 - Second address
 * @returns {boolean} - True if addresses appear to match
 */
export const addressesMatch = (addr1, addr2) => {
    if (!addr1 || !addr2) return false;

    const normalize = (str) => {
        if (!str) return '';
        if (typeof str === 'object') {
            str = str.street || str.formatted || '';
        }
        return str.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd/g, '');
    };

    const n1 = normalize(addr1);
    const n2 = normalize(addr2);

    return n1.includes(n2) || n2.includes(n1) || n1 === n2;
};

export default {
    parseAddressString,
    normalizeAddress,
    formatAddress,
    addressesMatch
};
