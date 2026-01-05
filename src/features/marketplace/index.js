// src/features/marketplace/index.js
// ============================================
// MARKETPLACE FEATURE - PUBLIC EXPORTS
// ============================================

// Services
export * from './lib/serviceRequestService';
export * from './lib/contractorMarketplaceService';

// Components (these use default exports, so we import and re-export as named)
export { default as ServiceRequestCreator } from './components/ServiceRequestCreator';
export { default as ContractorLeadDashboard } from './components/ContractorLeadDashboard';
export { default as ContractorBrowser } from './components/ContractorBrowser';
export { default as HomeownerRequestManager } from './components/HomeownerRequestManager';
