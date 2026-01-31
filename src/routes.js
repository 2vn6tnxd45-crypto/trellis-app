// src/routes.js
// ============================================
// ROUTE CONSTANTS
// ============================================
// Single source of truth for all app routes.
// Import these constants instead of hardcoding path strings.

export const ROUTES = {
  // ==========================================
  // PUBLIC ROUTES (no auth required)
  // ==========================================
  HOME: '/',
  LOGIN: '/login',

  // Public share links
  QUOTE: '/quote/:token',           // was ?quote=TOKEN
  EVALUATE: '/evaluate/:id',        // was ?evaluate=ID
  INVITE: '/invite/:token',         // was ?invite=TOKEN
  SUBMIT: '/submit/:requestId',     // was ?requestId=ID

  // ==========================================
  // CONTRACTOR ROUTES
  // ==========================================
  PRO_LANDING: '/pro',              // was ?pro
  PRO_INVITE: '/pro/invite',        // was ?pro=invite
  PRO_COMPARE: '/pro/compare',      // was ?pro=compare

  // Contractor authenticated dashboard (parent layout)
  PRO_DASHBOARD: '/pro/app',        // was ?pro=dashboard
  PRO_JOBS: '/pro/app/jobs',
  PRO_QUOTES: '/pro/app/quotes',
  PRO_QUOTE_NEW: '/pro/app/quotes/new',
  PRO_QUOTE_DETAIL: '/pro/app/quotes/:id',
  PRO_QUOTE_EDIT: '/pro/app/quotes/:id/edit',
  PRO_SCHEDULE: '/pro/app/schedule',
  PRO_INVOICES: '/pro/app/invoices',
  PRO_INVOICE_NEW: '/pro/app/invoices/new',
  PRO_MESSAGES: '/pro/app/messages',
  PRO_EVALUATIONS: '/pro/app/evaluations',
  PRO_EVALUATION_NEW: '/pro/app/evaluations/new',
  PRO_EVALUATION_DETAIL: '/pro/app/evaluations/:id',
  PRO_LEADS: '/pro/app/leads',
  PRO_INVITATIONS: '/pro/app/invitations',
  PRO_CUSTOMERS: '/pro/app/customers',
  PRO_MEMBERSHIPS: '/pro/app/memberships',
  PRO_MEMBERSHIP_PLANS: '/pro/app/memberships/plans',
  PRO_PRICEBOOK: '/pro/app/pricebook',
  PRO_TEMPLATES: '/pro/app/templates',
  PRO_EXPENSES: '/pro/app/expenses',
  PRO_TIMESHEETS: '/pro/app/timesheets',
  PRO_RECURRING: '/pro/app/recurring',
  PRO_FLEET: '/pro/app/fleet',
  PRO_REPORTS: '/pro/app/reports',
  PRO_ATTENTION: '/pro/app/attention',
  PRO_PROFILE: '/pro/app/profile',
  PRO_SETTINGS: '/pro/app/settings',

  // ==========================================
  // HOMEOWNER ROUTES (auth required)
  // ==========================================
  DASHBOARD: '/dashboard',
  INVENTORY: '/inventory',
  MAINTENANCE: '/maintenance',
  CONTRACTORS: '/contractors',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  HELP: '/help',

  // Payment callback (Stripe returns here)
  PAYMENT_SUCCESS: '/payment/success',
  PAYMENT_CANCELLED: '/payment/cancelled',
};

// ==========================================
// HELPER: Build a path with params filled in
// ==========================================
// Usage: buildPath(ROUTES.QUOTE, { token: 'abc123' }) -> '/quote/abc123'
export function buildPath(template, params = {}) {
  let path = template;
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  });
  return path;
}
