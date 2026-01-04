// src/features/jobs/index.js
// ============================================
// JOBS FEATURE - PUBLIC EXPORTS
// ============================================

// Existing Components
export { JobScheduler } from './JobScheduler';
export { SlotPicker } from './SlotPicker';
export { HomeownerJobCard } from './HomeownerJobCard';
export { CancelJobModal } from './CancelJobModal';

// Completion Components (NEW)
export { JobCompletionForm, JobCompletionReview } from './components/completion';

// Services
export * from './lib/jobCompletionService';

// Status helpers
export const JOB_STATUSES = {
    PENDING: 'pending',
    PENDING_SCHEDULE: 'pending_schedule',
    SLOTS_OFFERED: 'slots_offered',
    SCHEDULING: 'scheduling',
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    PENDING_COMPLETION: 'pending_completion',
    REVISION_REQUESTED: 'revision_requested',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    SUBMITTED: 'submitted'
};

// Status display configuration
export const JOB_STATUS_CONFIG = {
    pending: {
        label: 'Pending',
        description: 'Awaiting contractor response',
        bg: 'bg-slate-100',
        text: 'text-slate-600'
    },
    pending_schedule: {
        label: 'Pending',
        description: 'Waiting for contractor to offer times',
        bg: 'bg-slate-100',
        text: 'text-slate-600'
    },
    slots_offered: {
        label: 'Times Available',
        description: 'Pick a time that works for you',
        bg: 'bg-amber-100',
        text: 'text-amber-700'
    },
    scheduling: {
        label: 'Scheduling',
        description: 'Time proposed - awaiting confirmation',
        bg: 'bg-amber-100',
        text: 'text-amber-700'
    },
    scheduled: {
        label: 'Scheduled',
        description: 'Appointment confirmed',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700'
    },
    in_progress: {
        label: 'In Progress',
        description: 'Work is underway',
        bg: 'bg-blue-100',
        text: 'text-blue-700'
    },
    pending_completion: {
        label: 'Review Required',
        description: 'Contractor submitted completion - needs your review',
        bg: 'bg-purple-100',
        text: 'text-purple-700'
    },
    revision_requested: {
        label: 'Revision Requested',
        description: 'Waiting for contractor to update',
        bg: 'bg-amber-100',
        text: 'text-amber-700'
    },
    completed: {
        label: 'Completed',
        description: 'Job finished',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700'
    },
    cancelled: {
        label: 'Cancelled',
        description: 'Job was cancelled',
        bg: 'bg-red-100',
        text: 'text-red-600'
    },
    submitted: {
        label: 'Submitted',
        description: 'Work log submitted',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700'
    }
};
