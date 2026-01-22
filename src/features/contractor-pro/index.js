// src/features/contractor-pro/index.js
// ============================================
// CONTRACTOR PRO - EXPORTS
// ============================================

// Main App
export { ContractorProApp, default } from './ContractorProApp';

// Components
export { DashboardOverview } from './components/DashboardOverview';
export { ContractorAuthScreen } from './components/ContractorAuthScreen';
export { TeamManagement } from './components/TeamManagement';
export { AIDispatchAssistant } from './components/AIDispatchAssistant';
export { CustomerETAPage } from './components/CustomerETAPage';
export { TimeClockWidget } from './components/TimeClockWidget';
export { JobCard } from './components/JobCard';
export { ProfitabilityDashboard } from './components/ProfitabilityDashboard';
export { ScenarioSimulator } from './components/ScenarioSimulator';

// Hooks - Auth & Data
export { useContractorAuth } from './hooks/useContractorAuth';
export {
    useInvitations,
    useCustomers,
    useDashboardStats,
    useCreateInvitation
} from './hooks/useContractorData';

// Hooks - Jobs
export { useJobs, useJob, useTodaySchedule, useUnscheduledJobs } from './hooks/useJobs';

// Hooks - Team
export { useTeam, useTeamMember } from './hooks/useTeam';

// Hooks - Scheduling
export { useScheduling } from './hooks/useScheduling';

// Hooks - AI Dispatch
export { useAIDispatch } from './hooks/useAIDispatch';

// Hooks - Live ETA
export {
    useLiveETABroadcast,
    useLiveETASubscription,
    useETAUpdate,
    useCustomerETAPolling
} from './hooks/useLiveETA';

// Service functions - Contractor
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

// Service functions - Jobs
export {
    JOB_STATUSES,
    JOB_STATUS_LABELS,
    createJob,
    updateJob,
    updateJobStatus,
    getJob,
    getJobsByDate,
    getUnscheduledJobs,
    subscribeToJobs,
    assignJobToTech,
    rescheduleJob,
    batchAssignJobs,
    getJobsNeedingReschedule
} from './lib/jobService';

// Service functions - Team
export {
    SKILL_CATEGORIES,
    COMMON_SKILLS,
    COMMON_CERTIFICATIONS,
    addTeamMember,
    updateTeamMember,
    getTeamMember,
    getTeamMembers,
    subscribeToTeam,
    deleteTeamMember,
    addSkillToMember,
    addCertificationToMember,
    removeSkillFromMember,
    addTimeOff,
    checkMemberAvailability,
    memberHasRequiredSkills,
    memberHasRequiredCertifications,
    findEligibleTechs
} from './lib/teamService';

// Service functions - Scheduling Engine
export {
    CONSTRAINT_TYPES,
    SCHEDULE_RESULT,
    estimateTravelTime,
    evaluateConstraints,
    findBestTimeSlot,
    optimizeTechSchedule,
    simulateSwap
} from './lib/schedulingEngine';

// Service functions - AI Dispatch
export {
    generateScheduleProposal,
    applyScheduleProposal,
    handleDisruption
} from './lib/aiDispatchService';
