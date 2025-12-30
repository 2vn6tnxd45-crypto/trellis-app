// src/features/contractor-pro/index.js
// ============================================
// CONTRACTOR PRO - EXPORTS
// ============================================

// Main App
export { ContractorProApp, default } from './ContractorProApp';

// Components
export { DashboardOverview } from './components/DashboardOverview';
export { ContractorAuthScreen } from './components/ContractorAuthScreen';

// Hooks
export { useContractorAuth } from './hooks/useContractorAuth';
export { 
    useInvitations, 
    useCustomers, 
    useDashboardStats,
    useCreateInvitation 
} from './hooks/useContractorData';

// Service functions
export { 
    getContractorProfile,
    saveContractorProfile,
    updateContractorSettings,
    linkInvitationToContractor,
    getContractorInvitations,
    subscribeToInvitations,
    markInvitationClaimed,
    upsertCustomer,
    getContractorCustomers,
    subscribeToCustomers,
    migrateAnonymousInvitations,
    getContractorStats
} from './lib/contractorService';
