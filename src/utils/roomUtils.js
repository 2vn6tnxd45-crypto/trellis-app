// src/utils/roomUtils.js
// ============================================
// DYNAMIC ROOM GENERATION
// ============================================
// Generates room options based on property data from RentCast
// Falls back to standard rooms if no property data available

/**
 * Generate room options based on property data
 * @param {Object} propertyData - Property data from RentCast API
 * @returns {Array} Array of room objects with value and label
 */
export function generateRoomOptions(propertyData) {
    const rooms = [];
    
    // Always include common rooms first
    rooms.push({ value: 'kitchen', label: 'Kitchen' });
    rooms.push({ value: 'living-room', label: 'Living Room' });
    rooms.push({ value: 'dining-room', label: 'Dining Room' });
    
    // Generate bedrooms based on count
    const bedroomCount = propertyData?.bedrooms || 0;
    if (bedroomCount >= 1) {
        rooms.push({ value: 'primary-bedroom', label: 'Primary Bedroom' });
    }
    if (bedroomCount >= 2) {
        rooms.push({ value: 'bedroom-2', label: 'Bedroom 2' });
    }
    if (bedroomCount >= 3) {
        rooms.push({ value: 'bedroom-3', label: 'Bedroom 3' });
    }
    if (bedroomCount >= 4) {
        rooms.push({ value: 'bedroom-4', label: 'Bedroom 4' });
    }
    if (bedroomCount >= 5) {
        rooms.push({ value: 'bedroom-5', label: 'Bedroom 5' });
    }
    // For 6+ bedrooms, add generic option
    if (bedroomCount > 5) {
        for (let i = 6; i <= bedroomCount; i++) {
            rooms.push({ value: `bedroom-${i}`, label: `Bedroom ${i}` });
        }
    }
    
    // Generate bathrooms based on count (handle .5 bathrooms)
    const bathroomCount = propertyData?.bathrooms || 0;
    const fullBaths = Math.floor(bathroomCount);
    const hasHalfBath = bathroomCount % 1 !== 0;
    
    if (fullBaths >= 1) {
        rooms.push({ value: 'primary-bathroom', label: 'Primary Bathroom' });
    }
    if (fullBaths >= 2) {
        rooms.push({ value: 'bathroom-2', label: 'Bathroom 2' });
    }
    if (fullBaths >= 3) {
        rooms.push({ value: 'bathroom-3', label: 'Bathroom 3' });
    }
    if (fullBaths > 3) {
        for (let i = 4; i <= fullBaths; i++) {
            rooms.push({ value: `bathroom-${i}`, label: `Bathroom ${i}` });
        }
    }
    if (hasHalfBath) {
        rooms.push({ value: 'half-bath', label: 'Half Bath / Powder Room' });
    }
    
    // Add property-specific rooms based on features
    const features = propertyData?.features || {};
    
    if (features.garage || propertyData?.garageSpaces) {
        const spaces = features.garageSpaces || propertyData?.garageSpaces || 1;
        rooms.push({ 
            value: 'garage', 
            label: spaces > 1 ? `${spaces}-Car Garage` : 'Garage' 
        });
    }
    
    if (features.pool) {
        rooms.push({ value: 'pool-area', label: 'Pool Area' });
    }
    
    if (features.fireplace) {
        // Fireplace is usually in living room, but could have dedicated room
        // Don't add separate room, but good to know for maintenance
    }
    
    // Always include these common areas
    rooms.push({ value: 'laundry', label: 'Laundry Room' });
    rooms.push({ value: 'hallway', label: 'Hallway' });
    rooms.push({ value: 'entryway', label: 'Entryway / Foyer' });
    rooms.push({ value: 'closet', label: 'Closet' });
    rooms.push({ value: 'office', label: 'Home Office' });
    
    // Exterior areas
    rooms.push({ value: 'exterior-front', label: 'Exterior - Front' });
    rooms.push({ value: 'exterior-back', label: 'Exterior - Back' });
    rooms.push({ value: 'exterior-side', label: 'Exterior - Side' });
    rooms.push({ value: 'roof', label: 'Roof' });
    rooms.push({ value: 'driveway', label: 'Driveway' });
    rooms.push({ value: 'yard', label: 'Yard / Landscaping' });
    rooms.push({ value: 'fence', label: 'Fence' });
    rooms.push({ value: 'deck-patio', label: 'Deck / Patio' });
    
    // Utility areas
    rooms.push({ value: 'attic', label: 'Attic' });
    rooms.push({ value: 'basement', label: 'Basement' });
    rooms.push({ value: 'crawlspace', label: 'Crawl Space' });
    rooms.push({ value: 'utility-room', label: 'Utility Room' });
    
    // Whole house option
    rooms.push({ value: 'whole-house', label: 'Whole House' });
    
    // Other / custom option
    rooms.push({ value: 'other', label: 'Other' });
    
    return rooms;
}

/**
 * Get default/fallback room options when no property data is available
 * @returns {Array} Array of room objects
 */
export function getDefaultRoomOptions() {
    return [
        { value: 'kitchen', label: 'Kitchen' },
        { value: 'living-room', label: 'Living Room' },
        { value: 'dining-room', label: 'Dining Room' },
        { value: 'primary-bedroom', label: 'Primary Bedroom' },
        { value: 'bedroom-2', label: 'Bedroom 2' },
        { value: 'bedroom-3', label: 'Bedroom 3' },
        { value: 'primary-bathroom', label: 'Primary Bathroom' },
        { value: 'bathroom-2', label: 'Bathroom 2' },
        { value: 'half-bath', label: 'Half Bath / Powder Room' },
        { value: 'garage', label: 'Garage' },
        { value: 'laundry', label: 'Laundry Room' },
        { value: 'hallway', label: 'Hallway' },
        { value: 'entryway', label: 'Entryway / Foyer' },
        { value: 'closet', label: 'Closet' },
        { value: 'office', label: 'Home Office' },
        { value: 'exterior-front', label: 'Exterior - Front' },
        { value: 'exterior-back', label: 'Exterior - Back' },
        { value: 'roof', label: 'Roof' },
        { value: 'driveway', label: 'Driveway' },
        { value: 'yard', label: 'Yard / Landscaping' },
        { value: 'deck-patio', label: 'Deck / Patio' },
        { value: 'attic', label: 'Attic' },
        { value: 'basement', label: 'Basement' },
        { value: 'utility-room', label: 'Utility Room' },
        { value: 'whole-house', label: 'Whole House' },
        { value: 'other', label: 'Other' },
    ];
}

/**
 * Get room label from value
 * Useful for displaying stored room values
 * @param {string} value - The room value stored in the record
 * @param {Object} propertyData - Optional property data for context
 * @returns {string} Human-readable room label
 */
export function getRoomLabel(value, propertyData = null) {
    if (!value) return 'Not specified';
    
    // Try to find in generated options
    const options = propertyData 
        ? generateRoomOptions(propertyData) 
        : getDefaultRoomOptions();
    
    const found = options.find(r => r.value === value);
    if (found) return found.label;
    
    // If not found, it might be a custom value - return as-is but formatted
    return value
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Group rooms by category for better UI organization
 * @param {Array} rooms - Array of room objects
 * @returns {Object} Rooms grouped by category
 */
export function groupRoomsByCategory(rooms) {
    const groups = {
        'Living Spaces': [],
        'Bedrooms': [],
        'Bathrooms': [],
        'Utility': [],
        'Exterior': [],
        'Other': []
    };
    
    rooms.forEach(room => {
        const value = room.value;
        
        if (value.includes('bedroom') || value === 'primary-bedroom') {
            groups['Bedrooms'].push(room);
        } else if (value.includes('bathroom') || value.includes('bath')) {
            groups['Bathrooms'].push(room);
        } else if (['kitchen', 'living-room', 'dining-room', 'office', 'entryway', 'hallway'].includes(value)) {
            groups['Living Spaces'].push(room);
        } else if (['garage', 'laundry', 'utility-room', 'attic', 'basement', 'crawlspace', 'closet'].includes(value)) {
            groups['Utility'].push(room);
        } else if (['exterior-front', 'exterior-back', 'exterior-side', 'roof', 'driveway', 'yard', 'fence', 'deck-patio', 'pool-area'].includes(value)) {
            groups['Exterior'].push(room);
        } else {
            groups['Other'].push(room);
        }
    });
    
    // Remove empty groups
    return Object.fromEntries(
        Object.entries(groups).filter(([_, rooms]) => rooms.length > 0)
    );
}

export default {
    generateRoomOptions,
    getDefaultRoomOptions,
    getRoomLabel,
    groupRoomsByCategory
};
