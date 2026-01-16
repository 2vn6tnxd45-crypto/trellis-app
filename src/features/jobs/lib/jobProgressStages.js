// src/features/jobs/lib/jobProgressStages.js
// ============================================
// JOB PROGRESS STAGES
// ============================================
// Defines the standard job journey from request to completion

/**
 * Standard job progress stages
 * Each stage can map to multiple statuses
 */
export const JOB_STAGES = [
    {
        id: 'requested',
        label: 'Requested',
        shortLabel: 'Requested',
        description: 'You submitted a service request',
        statuses: ['quoted', 'pending_schedule'],
        icon: 'FileText'
    },
    {
        id: 'scheduling',
        label: 'Scheduling',
        shortLabel: 'Scheduling',
        description: 'Picking a time that works',
        statuses: ['slots_offered', 'scheduling'],
        icon: 'Calendar'
    },
    {
        id: 'scheduled',
        label: 'Scheduled',
        shortLabel: 'Scheduled',
        description: 'Appointment is booked',
        statuses: ['scheduled'],
        icon: 'CalendarCheck'
    },
    {
        id: 'in_progress',
        label: 'In Progress',
        shortLabel: 'Working',
        description: 'Work is being done',
        statuses: ['in_progress'],
        icon: 'Wrench'
    },
    {
        id: 'review',
        label: 'Review',
        shortLabel: 'Review',
        description: 'Contractor finished, awaiting your approval',
        statuses: ['pending_completion', 'revision_requested'],
        icon: 'ClipboardCheck'
    },
    {
        id: 'complete',
        label: 'Complete',
        shortLabel: 'Done',
        description: 'Job finished, items added to your home',
        statuses: ['completed'],
        icon: 'CheckCircle2'
    }
];

/**
 * Terminal/end states that stop progress
 */
export const TERMINAL_STATUSES = ['completed', 'cancelled'];

/**
 * Get current stage info from job status
 * @param {string} status - Current job status
 * @returns {Object} Stage info with index and metadata
 */
export const getCurrentStage = (status) => {
    // Handle cancelled separately
    if (status === 'cancelled') {
        return {
            stage: null,
            index: -1,
            total: JOB_STAGES.length,
            isLast: false,
            isCancelled: true
        };
    }

    const stage = JOB_STAGES.find(s => s.statuses.includes(status));
    const index = stage ? JOB_STAGES.indexOf(stage) : 0;

    return {
        stage: stage || JOB_STAGES[0],
        index,
        total: JOB_STAGES.length,
        isLast: index === JOB_STAGES.length - 1,
        isCancelled: false
    };
};

/**
 * Get "What's Next" guidance based on current status
 * @param {string} status - Current job status
 * @returns {string} Helpful guidance text
 */
export const getNextStepGuidance = (status) => {
    switch (status) {
        case 'quoted':
        case 'pending_schedule':
            return "Waiting for the contractor to offer available times.";
        case 'slots_offered':
            return "Pick a time that works for you to get on the schedule.";
        case 'scheduling':
            return "Waiting for the contractor to confirm your requested time.";
        case 'scheduled':
            return "Mark your calendar! The contractor will arrive at your scheduled time.";
        case 'in_progress':
            return "Work is underway. You'll be notified when it's complete.";
        case 'pending_completion':
            return "Review the completed work and approve to add items to your home record.";
        case 'revision_requested':
            return "Waiting for the contractor to address your feedback.";
        case 'completed':
            return "All done! Items have been added to your home record.";
        case 'cancelled':
            return "This job was cancelled.";
        default:
            return "";
    }
};

/**
 * Get action prompt based on current status
 * @param {string} status - Current job status
 * @returns {Object|null} Action info with label and type
 */
export const getStatusAction = (status) => {
    switch (status) {
        case 'slots_offered':
            return {
                label: 'Pick a Time',
                type: 'primary',
                icon: 'Calendar'
            };
        case 'scheduling':
            return {
                label: 'Review Proposal',
                type: 'secondary',
                icon: 'Clock'
            };
        case 'pending_completion':
            return {
                label: 'Review & Approve',
                type: 'primary',
                icon: 'ClipboardCheck'
            };
        default:
            return null;
    }
};

/**
 * Check if a status requires user action
 * @param {string} status - Current job status
 * @returns {boolean}
 */
export const requiresUserAction = (status) => {
    return ['slots_offered', 'pending_completion'].includes(status);
};

/**
 * Get progress percentage (0-100)
 * @param {string} status - Current job status
 * @returns {number} Progress percentage
 */
export const getProgressPercentage = (status) => {
    const { index, total, isCancelled } = getCurrentStage(status);
    if (isCancelled) return 0;
    // Completed = 100%, otherwise calculate based on index
    if (status === 'completed') return 100;
    return Math.round((index / (total - 1)) * 100);
};
