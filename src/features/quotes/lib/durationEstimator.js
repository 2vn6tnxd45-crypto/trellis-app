// src/features/quotes/lib/durationEstimator.js
// ============================================
// AI DURATION ESTIMATION SERVICE
// ============================================
// Calls API to get smart duration estimates based on quote details

/**
 * Get AI-powered duration estimate for a job
 * @param {Object} quoteData - Quote details
 * @returns {Promise<Object>} Duration estimate with reasoning
 */
export async function estimateDuration(quoteData) {
    const { title, lineItems, notes, category, customer } = quoteData;

    try {
        const response = await fetch('/api/estimate-duration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title || '',
                lineItems: (lineItems || [])
                    .filter(item => item.description) // Only items with descriptions
                    .map(item => ({
                        type: item.type,
                        description: item.description,
                        brand: item.brand || '',
                        model: item.model || '',
                        crewSize: item.crewSize || '',
                        quantity: item.quantity || 1
                    })),
                notes: notes || '',
                category: category || '',
                customerAddress: customer?.address || ''
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Duration estimation error:', error);
        // Return a sensible default on error
        return {
            duration: { value: 2, unit: 'hours', display: '2 hours' },
            crew: { recommended: 1, minimum: 1, reasoning: 'Default estimate' },
            isMultiDay: false,
            confidence: 'low',
            reasoning: 'Unable to analyze - using default estimate.',
            breakdown: [],
            source: 'error'
        };
    }
}

/**
 * Convert duration object to total minutes for storage/comparison
 * @param {Object} duration - { value, unit }
 * @returns {number} Total minutes
 */
export function durationToMinutes(duration) {
    if (!duration) return 120; // 2 hours default

    const { value, unit } = duration;
    switch (unit) {
        case 'minutes': return value;
        case 'hours': return value * 60;
        case 'days': return value * 8 * 60; // 8-hour workday
        default: return value * 60;
    }
}

/**
 * Convert minutes to human-readable display string
 * @param {number} minutes 
 * @returns {string}
 */
export function minutesToDisplay(minutes) {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 480) {
        const hours = Math.round(minutes / 60 * 10) / 10; // One decimal
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.round(minutes / 480 * 10) / 10; // One decimal, 8-hour days
    return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Parse a display string back to minutes (for editing)
 * @param {string} displayStr - e.g., "4 hours", "2 days", "30 minutes"
 * @returns {number|null} Minutes or null if unparseable
 */
export function parseDisplayToMinutes(displayStr) {
    if (!displayStr) return null;

    const lower = displayStr.toLowerCase().trim();

    // Try to match patterns like "4 hours", "2 days", "30 minutes", "4-6 hours"
    const patterns = [
        { regex: /(\d+(?:\.\d+)?)\s*min/i, multiplier: 1 },
        { regex: /(\d+(?:\.\d+)?)\s*hr|(\d+(?:\.\d+)?)\s*hour/i, multiplier: 60 },
        { regex: /(\d+(?:\.\d+)?)\s*day/i, multiplier: 480 }
    ];

    for (const { regex, multiplier } of patterns) {
        const match = lower.match(regex);
        if (match) {
            const value = parseFloat(match[1] || match[2]);
            return Math.round(value * multiplier);
        }
    }

    // If it's just a number, assume hours
    const justNumber = lower.match(/^(\d+(?:\.\d+)?)$/);
    if (justNumber) {
        return Math.round(parseFloat(justNumber[1]) * 60);
    }

    return null;
}
