// src/features/tech-mobile/index.js
// ============================================
// TECH MOBILE PWA - FEATURE INDEX
// ============================================
// Mobile-optimized interface for field technicians
// Supports offline mode, GPS tracking, photo capture, and signature collection

// Main app shell
export { TechMobileApp, TechMobileRouter } from './TechMobileApp';

// Pages
export { TechDashboard } from './pages/TechDashboard';
export { TechJobView } from './pages/TechJobView';
export { TechSchedule } from './pages/TechSchedule';

// Components
export { TechJobCard } from './components/TechJobCard';
export { TechNavigation } from './components/TechNavigation';
export { TechHeader } from './components/TechHeader';

// Hooks
export { useTechSession } from './hooks/useTechSession';
export { useTechJobs } from './hooks/useTechJobs';
