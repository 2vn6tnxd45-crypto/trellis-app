// src/config/constants.js
// ============================================
// APPLICATION CONSTANTS
// ============================================

// ============================================
// CATEGORIES - Item/Record Categories
// ============================================
export const CATEGORIES = [
    { value: 'appliances', label: 'Appliances' },
    { value: 'hvac', label: 'HVAC' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'flooring', label: 'Flooring' },
    { value: 'windows-doors', label: 'Windows & Doors' },
    { value: 'exterior', label: 'Exterior' },
    { value: 'interior', label: 'Interior' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'security', label: 'Security' },
    { value: 'smart-home', label: 'Smart Home' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'other', label: 'Other' },
];

// ============================================
// ROOMS - DEPRECATED
// ============================================
// NOTE: Use the dynamic room options from PropertyContext instead!
// 
// Import and use like this:
//   import { useProperty } from '../contexts/PropertyContext';
//   const { roomOptions } = useProperty();
//
// Or use the RoomSelector component:
//   import { RoomSelector } from '../components/common/RoomSelector';
//   <RoomSelector value={room} onChange={setRoom} />
//
// The dynamic options are generated based on the property's actual
// bedroom/bathroom count and features (garage, pool, etc.)
//
// This static ROOMS array is kept for backwards compatibility only.
// ============================================
export const ROOMS = [
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

// ============================================
// MAINTENANCE FREQUENCIES
// ============================================
export const MAINTENANCE_FREQUENCIES = [
    { value: 'none', label: 'No regular maintenance', months: 0 },
    { value: 'monthly', label: 'Monthly', months: 1 },
    { value: 'quarterly', label: 'Quarterly (every 3 months)', months: 3 },
    { value: 'biannual', label: 'Twice a year', months: 6 },
    { value: 'annual', label: 'Annually', months: 12 },
    { value: '2years', label: 'Every 2 years', months: 24 },
    { value: '3years', label: 'Every 3 years', months: 36 },
    { value: '5years', label: 'Every 5 years', months: 60 },
    { value: '10years', label: 'Every 10 years', months: 120 },
];

// ============================================
// CONDITIONS
// ============================================
export const CONDITIONS = [
    { value: 'new', label: 'New' },
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'needs-replacement', label: 'Needs Replacement' },
];

// ============================================
// WARRANTY STATUS
// ============================================
export const WARRANTY_STATUS = [
    { value: 'active', label: 'Active Warranty' },
    { value: 'expired', label: 'Warranty Expired' },
    { value: 'none', label: 'No Warranty' },
    { value: 'unknown', label: 'Unknown' },
];

// ============================================
// HELPER: Get label from value
// ============================================
export const getLabelFromValue = (options, value) => {
    const found = options.find(opt => opt.value === value);
    return found ? found.label : value;
};
