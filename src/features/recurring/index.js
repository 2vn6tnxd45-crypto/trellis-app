// src/features/recurring/index.js
// ============================================
// RECURRING SERVICES FEATURE
// ============================================

// Components
export { RecurringServiceCard } from './components/RecurringServiceCard';
export { CreateRecurringServiceModal } from './components/CreateRecurringServiceModal';

// Hooks
export {
    useContractorRecurringServices,
    useCustomerRecurringServices,
    useNextScheduledDate
} from './hooks/useRecurringServices';

// Service functions
export {
    createRecurringService,
    updateRecurringService,
    cancelRecurringService,
    pauseRecurringService,
    resumeRecurringService,
    skipNextOccurrence,
    onRecurringJobCompleted,
    isRecurringJob,
    getRecurringInfo,
    formatFrequency
} from './lib/recurringService';
