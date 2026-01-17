// src/features/contractor-pro/lib/smsTemplates.js
// ============================================
// SMS MESSAGE TEMPLATES
// ============================================
// Default templates and utilities for SMS messaging

// ============================================
// DEFAULT TEMPLATES
// ============================================

export const DEFAULT_TEMPLATES = {
    // Appointment Reminders
    reminder24h: {
        id: 'reminder24h',
        name: '24-Hour Reminder',
        description: 'Sent 24 hours before scheduled appointment',
        template: "Hi {{customerName}}! This is a reminder of your {{serviceType}} appointment tomorrow, {{date}} at {{time}}. Reply CONFIRM to confirm or RESCHEDULE to change. - {{companyName}}",
        variables: ['customerName', 'serviceType', 'date', 'time', 'companyName'],
        category: 'reminder'
    },

    reminder2h: {
        id: 'reminder2h',
        name: '2-Hour Reminder',
        description: 'Sent 2 hours before scheduled appointment',
        template: "Hi {{customerName}}! {{techName}} will arrive for your {{serviceType}} in about 2 hours at {{time}}. Reply YES to confirm you're ready. - {{companyName}}",
        variables: ['customerName', 'techName', 'serviceType', 'time', 'companyName'],
        category: 'reminder'
    },

    // On The Way
    onTheWay: {
        id: 'onTheWay',
        name: 'On The Way',
        description: 'Sent when technician starts traveling to job',
        template: "Hi {{customerName}}! {{techName}} is on the way and will arrive in approximately {{eta}}. - {{companyName}}",
        variables: ['customerName', 'techName', 'eta', 'companyName'],
        category: 'notification'
    },

    onTheWayWithTracking: {
        id: 'onTheWayWithTracking',
        name: 'On The Way (with tracking)',
        description: 'Sent when technician starts traveling, includes tracking link',
        template: "Hi {{customerName}}! {{techName}} is on the way and will arrive in approximately {{eta}}. Track their arrival: {{trackingLink}} - {{companyName}}",
        variables: ['customerName', 'techName', 'eta', 'trackingLink', 'companyName'],
        category: 'notification'
    },

    // Confirmations
    confirmation: {
        id: 'confirmation',
        name: 'Appointment Confirmed',
        description: 'Sent when customer confirms appointment',
        template: "Thanks for confirming! We'll see you {{date}} at {{time}}. - {{companyName}}",
        variables: ['date', 'time', 'companyName'],
        category: 'confirmation'
    },

    bookingConfirmation: {
        id: 'bookingConfirmation',
        name: 'Booking Confirmation',
        description: 'Sent when appointment is first scheduled',
        template: "Hi {{customerName}}! Your {{serviceType}} appointment has been scheduled for {{date}} at {{time}}. {{techName}} will be your technician. Reply CONFIRM to confirm. - {{companyName}}",
        variables: ['customerName', 'serviceType', 'date', 'time', 'techName', 'companyName'],
        category: 'confirmation'
    },

    // Cancellation
    cancellation: {
        id: 'cancellation',
        name: 'Appointment Cancelled',
        description: 'Sent when appointment is cancelled',
        template: "Your {{serviceType}} appointment for {{date}} has been cancelled. Please contact us to reschedule. - {{companyName}}",
        variables: ['serviceType', 'date', 'companyName'],
        category: 'cancellation'
    },

    cancellationByCustomer: {
        id: 'cancellationByCustomer',
        name: 'Cancellation Received',
        description: 'Sent when customer requests cancellation via SMS',
        template: "We've received your cancellation request for {{date}}. A team member will contact you to confirm. - {{companyName}}",
        variables: ['date', 'companyName'],
        category: 'cancellation'
    },

    // Reschedule
    rescheduleReceived: {
        id: 'rescheduleReceived',
        name: 'Reschedule Request Received',
        description: 'Sent when customer requests to reschedule',
        template: "We've received your reschedule request. A team member will contact you shortly to find a new time that works for you. - {{companyName}}",
        variables: ['companyName'],
        category: 'reschedule'
    },

    rescheduleConfirmation: {
        id: 'rescheduleConfirmation',
        name: 'Rescheduled Confirmation',
        description: 'Sent when appointment is rescheduled',
        template: "Hi {{customerName}}! Your {{serviceType}} appointment has been rescheduled to {{date}} at {{time}}. Reply CONFIRM to confirm. - {{companyName}}",
        variables: ['customerName', 'serviceType', 'date', 'time', 'companyName'],
        category: 'reschedule'
    },

    // Job Status
    jobStarted: {
        id: 'jobStarted',
        name: 'Work Started',
        description: 'Sent when technician begins work',
        template: "Hi {{customerName}}! {{techName}} has started work on your {{serviceType}}. We'll notify you when completed. - {{companyName}}",
        variables: ['customerName', 'techName', 'serviceType', 'companyName'],
        category: 'status'
    },

    jobCompleted: {
        id: 'jobCompleted',
        name: 'Work Completed',
        description: 'Sent when job is completed',
        template: "Hi {{customerName}}! Your {{serviceType}} has been completed. Thank you for choosing {{companyName}}! If you have a moment, we'd appreciate a review.",
        variables: ['customerName', 'serviceType', 'companyName'],
        category: 'status'
    },

    // Payment
    paymentReminder: {
        id: 'paymentReminder',
        name: 'Payment Reminder',
        description: 'Sent for outstanding invoices',
        template: "Hi {{customerName}}! This is a friendly reminder that your invoice of {{amount}} for {{serviceType}} is due. Pay online: {{paymentLink}} - {{companyName}}",
        variables: ['customerName', 'amount', 'serviceType', 'paymentLink', 'companyName'],
        category: 'payment'
    },

    paymentReceived: {
        id: 'paymentReceived',
        name: 'Payment Received',
        description: 'Sent when payment is received',
        template: "Hi {{customerName}}! We've received your payment of {{amount}}. Thank you! - {{companyName}}",
        variables: ['customerName', 'amount', 'companyName'],
        category: 'payment'
    },

    // Review Request
    reviewRequest: {
        id: 'reviewRequest',
        name: 'Review Request',
        description: 'Sent to request a review after job completion',
        template: "Hi {{customerName}}! Thank you for choosing {{companyName}}. We'd love your feedback! Please leave a review: {{reviewLink}}",
        variables: ['customerName', 'companyName', 'reviewLink'],
        category: 'marketing'
    },

    // Opt-out
    optOutConfirmation: {
        id: 'optOutConfirmation',
        name: 'Opt-Out Confirmation',
        description: 'Sent when customer opts out',
        template: "You've been unsubscribed from SMS notifications from {{companyName}}. Reply START to opt back in.",
        variables: ['companyName'],
        category: 'system'
    }
};

// ============================================
// TEMPLATE CATEGORIES
// ============================================

export const TEMPLATE_CATEGORIES = {
    reminder: {
        id: 'reminder',
        name: 'Appointment Reminders',
        icon: 'Bell',
        description: 'Automated reminders before appointments'
    },
    notification: {
        id: 'notification',
        name: 'Notifications',
        icon: 'MessageSquare',
        description: 'Real-time updates and notifications'
    },
    confirmation: {
        id: 'confirmation',
        name: 'Confirmations',
        icon: 'CheckCircle',
        description: 'Booking and appointment confirmations'
    },
    cancellation: {
        id: 'cancellation',
        name: 'Cancellations',
        icon: 'XCircle',
        description: 'Cancellation notifications'
    },
    reschedule: {
        id: 'reschedule',
        name: 'Reschedules',
        icon: 'Calendar',
        description: 'Reschedule confirmations'
    },
    status: {
        id: 'status',
        name: 'Job Status',
        icon: 'Activity',
        description: 'Job progress updates'
    },
    payment: {
        id: 'payment',
        name: 'Payments',
        icon: 'DollarSign',
        description: 'Payment reminders and receipts'
    },
    marketing: {
        id: 'marketing',
        name: 'Marketing',
        icon: 'Star',
        description: 'Review requests and promotions'
    },
    system: {
        id: 'system',
        name: 'System',
        icon: 'Settings',
        description: 'System notifications'
    }
};

// ============================================
// TEMPLATE VARIABLES
// ============================================

export const TEMPLATE_VARIABLES = {
    customerName: {
        key: 'customerName',
        label: 'Customer Name',
        description: 'Customer\'s first name or full name',
        example: 'John'
    },
    serviceType: {
        key: 'serviceType',
        label: 'Service Type',
        description: 'Type of service being performed',
        example: 'HVAC repair'
    },
    date: {
        key: 'date',
        label: 'Appointment Date',
        description: 'Formatted appointment date',
        example: 'Monday, January 15'
    },
    time: {
        key: 'time',
        label: 'Appointment Time',
        description: 'Formatted appointment time',
        example: '2:00 PM'
    },
    techName: {
        key: 'techName',
        label: 'Technician Name',
        description: 'Assigned technician\'s name',
        example: 'Mike'
    },
    companyName: {
        key: 'companyName',
        label: 'Company Name',
        description: 'Your business name',
        example: 'ABC Plumbing'
    },
    eta: {
        key: 'eta',
        label: 'ETA',
        description: 'Estimated time of arrival',
        example: '15 minutes'
    },
    trackingLink: {
        key: 'trackingLink',
        label: 'Tracking Link',
        description: 'Live tracking URL',
        example: 'https://track.example.com/abc123'
    },
    amount: {
        key: 'amount',
        label: 'Amount',
        description: 'Payment amount',
        example: '$150.00'
    },
    paymentLink: {
        key: 'paymentLink',
        label: 'Payment Link',
        description: 'Online payment URL',
        example: 'https://pay.example.com/inv123'
    },
    reviewLink: {
        key: 'reviewLink',
        label: 'Review Link',
        description: 'Review submission URL',
        example: 'https://g.page/r/abc123'
    },
    address: {
        key: 'address',
        label: 'Service Address',
        description: 'Job location address',
        example: '123 Main St'
    }
};

// ============================================
// UTILITIES
// ============================================

/**
 * Get templates by category
 * @param {string} category - Category ID
 * @returns {Object[]} Templates in category
 */
export const getTemplatesByCategory = (category) => {
    return Object.values(DEFAULT_TEMPLATES).filter(t => t.category === category);
};

/**
 * Get all template IDs
 * @returns {string[]} Template IDs
 */
export const getTemplateIds = () => {
    return Object.keys(DEFAULT_TEMPLATES);
};

/**
 * Get template by ID
 * @param {string} id - Template ID
 * @returns {Object|null} Template or null
 */
export const getTemplateById = (id) => {
    return DEFAULT_TEMPLATES[id] || null;
};

/**
 * Validate template has required variables
 * @param {string} template - Template string
 * @param {string[]} requiredVars - Required variable names
 * @returns {Object} Validation result with missing variables
 */
export const validateTemplate = (template, requiredVars = []) => {
    const usedVars = [];
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
        usedVars.push(match[1]);
    }

    const missingVars = requiredVars.filter(v => !usedVars.includes(v));
    const unknownVars = usedVars.filter(v => !Object.keys(TEMPLATE_VARIABLES).includes(v));

    return {
        valid: missingVars.length === 0,
        usedVariables: usedVars,
        missingVariables: missingVars,
        unknownVariables: unknownVars,
        characterCount: template.replace(/\{\{\w+\}\}/g, '').length
    };
};

/**
 * Preview template with sample data
 * @param {string} template - Template string
 * @returns {string} Preview with sample values
 */
export const previewTemplate = (template) => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const variable = TEMPLATE_VARIABLES[key];
        return variable ? variable.example : match;
    });
};

/**
 * Estimate SMS segment count
 * SMS are 160 chars standard, 153 for concatenated messages
 * @param {string} message - Message text
 * @returns {number} Estimated segment count
 */
export const estimateSegments = (message) => {
    if (!message) return 0;
    const length = message.length;
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
};

/**
 * Get character limit warning
 * @param {string} message - Message text
 * @returns {Object} Warning info
 */
export const getCharacterWarning = (message) => {
    const length = message?.length || 0;
    const segments = estimateSegments(message);

    if (length <= 160) {
        return {
            type: 'success',
            message: `${length}/160 characters (1 SMS)`,
            segments: 1
        };
    } else if (length <= 320) {
        return {
            type: 'warning',
            message: `${length} characters (${segments} SMS segments)`,
            segments
        };
    } else {
        return {
            type: 'error',
            message: `${length} characters - consider shortening (${segments} SMS segments)`,
            segments
        };
    }
};

export default {
    DEFAULT_TEMPLATES,
    TEMPLATE_CATEGORIES,
    TEMPLATE_VARIABLES,
    getTemplatesByCategory,
    getTemplateIds,
    getTemplateById,
    validateTemplate,
    previewTemplate,
    estimateSegments,
    getCharacterWarning
};
