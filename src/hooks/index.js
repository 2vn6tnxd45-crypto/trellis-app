// src/hooks/index.js
// ============================================
// HOOKS BARREL EXPORT
// ============================================
// Central export point for all custom hooks

// Common Hooks (reusable patterns)
export {
    useModal,
    useAsyncAction,
    useConfirmAction,
    useFormState
} from './useCommonHooks';

// App Logic
export { useAppLogic } from './useAppLogic';

// Routing
export { useAppRoute, ROUTE_TYPES } from './useAppRoute';

// Authentication
export { useAuth } from './useAuth';

// Data Hooks
export { useRecords } from './useRecords';
export { useProperties } from './useProperties';
export { usePropertyData } from './usePropertyData';
export { useNeighborhoodData } from './useNeighborhoodData';
export { useHomeHealth } from './useHomeHealth';
export { useRecalls } from './useRecalls';

// Form & UI Hooks
export { useFormDraft } from './useFormDraft';
export { useClickOutside } from './useClickOutside';
export { useThemeInit } from './useThemeInit';
export { useNotificationPermission } from './useNotificationPermission';

// External Services
export { useGemini } from './useGemini';
export { useGoogleMaps } from './useGoogleMaps';
