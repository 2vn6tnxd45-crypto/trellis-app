// src/config/constants.js
// ============================================
// APPLICATION CONSTANTS
// ============================================

// ============================================
// APP IDENTIFIERS
// ============================================
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'krib-app';
export const REQUESTS_COLLECTION_PATH = `artifacts/${appId}/service_requests`;

// ============================================
// API KEYS
// ============================================
export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// ============================================
// CATEGORIES - Item/Record Categories
// ============================================
export const CATEGORIES = [
    'Appliances',
    'HVAC',
    'Plumbing',
    'Electrical',
    'Roofing',
    'Flooring',
    'Windows & Doors',
    'Exterior',
    'Interior',
    'Landscaping',
    'Security',
    'Smart Home',
    'Furniture',
    'Other',
];

// ============================================
// ROOMS - DEPRECATED
// ============================================
// NOTE: For dynamic room options based on property data, use:
//   import { useProperty } from '../contexts/PropertyContext';
//   const { roomOptions } = useProperty();
//
// Or use the RoomSelector component:
//   import { RoomSelector } from '../components/common/RoomSelector';
//
// This static ROOMS array is kept for backwards compatibility.
// ============================================
export const ROOMS = [
    'Kitchen',
    'Living Room',
    'Dining Room',
    'Primary Bedroom',
    'Bedroom 2',
    'Bedroom 3',
    'Primary Bathroom',
    'Bathroom 2',
    'Half Bath',
    'Garage',
    'Laundry Room',
    'Hallway',
    'Entryway',
    'Closet',
    'Home Office',
    'Exterior - Front',
    'Exterior - Back',
    'Roof',
    'Driveway',
    'Yard',
    'Deck / Patio',
    'Attic',
    'Basement',
    'Utility Room',
    'Whole House',
    'Other',
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
