// src/features/evaluations/index.js
// ============================================
// EVALUATIONS FEATURE - PUBLIC EXPORTS
// ============================================

// ----------------------------------------
// Components
// ----------------------------------------
export { CreateEvaluationRequest } from './components/CreateEvaluationRequest';
export { EvaluationSubmission } from './components/EvaluationSubmission';
export { EvaluationReview } from './components/EvaluationReview';
export { EvaluationsListView } from './components/EvaluationsListView';
export { EvaluationPage } from './components/EvaluationPage';

// ----------------------------------------
// Hooks
// ----------------------------------------
export { 
    useEvaluations,
    useSingleEvaluation,
    useEvaluationCountdown,
    useEvaluationsByStatus
} from './hooks/useEvaluations';

// ----------------------------------------
// Service Functions
// ----------------------------------------
export {
    // Constants
    EVALUATION_TYPES,
    EVALUATION_STATUS,
    FEE_STATUS,
    DEFAULT_EXPIRATION_DAYS,
    
    // CRUD Operations
    createEvaluationRequest,
    getEvaluation,
    getContractorEvaluations,
    
    // Homeowner Actions
    submitEvaluationMedia,
    completeSubmission,
    
    // Contractor Actions
    requestAdditionalInfo,
    scheduleEvaluation,
    completeEvaluation,
    linkQuoteToEvaluation,
    cancelEvaluation,
    
    // Utilities
    checkExpiredEvaluations,
    getTimeRemaining,
    prepareQuoteFromEvaluation
} from './lib/evaluationService';

// ----------------------------------------
// Templates
// ----------------------------------------
export {
    // Constants
    PROMPT_TYPES,
    JOB_CATEGORIES,
    CATEGORY_LABELS,
    CATEGORIES_REQUIRING_EVALUATION,
    SUGGESTED_EVAL_TYPE,
    
    // Template Data
    EVALUATION_TEMPLATES,
    
    // Helper Functions
    getTemplateForCategory,
    getPromptsForCategory,
    createCustomPrompt,
    mergePrompts
} from './lib/evaluationTemplates';

// AI Analysis
export { AIAnalysisSummary } from './components/AIAnalysisSummary';
