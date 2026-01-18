// tests/visual/visual-regression.config.js
/**
 * Visual Regression Testing Configuration
 *
 * Tool Recommendation: Playwright Built-in Screenshots + Percy (optional)
 *
 * Why Playwright Screenshots:
 * - Already using Playwright for E2E tests
 * - Zero additional cost
 * - Built-in toHaveScreenshot() matcher
 * - Good for catching layout regressions
 *
 * When to add Percy/Chromatic:
 * - Need cross-browser visual testing
 * - Need cloud-hosted baselines for team review
 * - Budget allows ($99+/month)
 *
 * This config uses Playwright's native visual comparison.
 */

export const VISUAL_TEST_CONFIG = {
    // Viewport sizes to test
    viewports: {
        mobile: { width: 375, height: 812 },   // iPhone X
        tablet: { width: 768, height: 1024 },  // iPad
        desktop: { width: 1440, height: 900 }, // Standard desktop
    },

    // Screenshot comparison options
    screenshotOptions: {
        // Allowable pixel difference (accounts for anti-aliasing)
        maxDiffPixelRatio: 0.01,

        // Animation handling - wait for stability
        animations: 'disabled',

        // Mask dynamic content
        mask: [],

        // Full page vs viewport only
        fullPage: false,
    },

    // Elements to mask (dynamic content)
    dynamicMasks: [
        '[data-testid="current-time"]',
        '[data-testid="user-avatar"]',
        '[class*="timestamp"]',
        '[class*="date-display"]',
        'time',
    ],
};

/**
 * Top 10 Most Important Pages for Visual Regression
 *
 * Prioritized by:
 * 1. User traffic / importance
 * 2. Visual complexity
 * 3. Brand consistency needs
 */
export const CRITICAL_PAGES = [
    {
        name: 'auth-login',
        path: '/',
        description: 'Login/Signup screen - First impression',
        waitFor: 'input[type="email"]',
        priority: 1,
    },
    {
        name: 'homeowner-dashboard',
        path: '/home',
        description: 'Main homeowner dashboard',
        waitFor: 'text=/dashboard|welcome/i',
        requiresAuth: 'homeowner',
        priority: 1,
    },
    {
        name: 'property-records',
        path: '/home/records',
        description: 'Property records list view',
        waitFor: 'text=/records/i',
        requiresAuth: 'homeowner',
        priority: 2,
    },
    {
        name: 'smart-scanner',
        path: '/home/scan',
        description: 'Receipt/document scanner UI',
        waitFor: 'text=/scan|upload/i',
        requiresAuth: 'homeowner',
        priority: 2,
    },
    {
        name: 'contractor-dashboard',
        path: '/contractor',
        description: 'Contractor main dashboard',
        waitFor: 'text=/dashboard|jobs/i',
        requiresAuth: 'contractor',
        priority: 1,
    },
    {
        name: 'quote-builder',
        path: '/contractor/quotes/new',
        description: 'Quote creation form',
        waitFor: 'text=/new quote|create/i',
        requiresAuth: 'contractor',
        priority: 2,
    },
    {
        name: 'job-calendar',
        path: '/contractor/calendar',
        description: 'Job scheduling calendar',
        waitFor: '[class*="calendar"]',
        requiresAuth: 'contractor',
        priority: 2,
    },
    {
        name: 'public-quote-view',
        path: '/quote/sample',
        description: 'Customer-facing quote page',
        waitFor: 'text=/quote/i',
        requiresAuth: false,
        priority: 1,
    },
    {
        name: 'settings-page',
        path: '/settings',
        description: 'User settings and preferences',
        waitFor: 'text=/settings/i',
        requiresAuth: 'homeowner',
        priority: 3,
    },
    {
        name: 'onboarding-flow',
        path: '/onboarding',
        description: 'New user onboarding screens',
        waitFor: 'text=/welcome|get started/i',
        requiresAuth: 'new',
        priority: 2,
    },
];

/**
 * Color theme configurations for testing
 */
export const THEMES = {
    light: 'light',
    dark: 'dark', // If app supports dark mode
};

/**
 * Browser configurations for cross-browser testing
 */
export const BROWSERS = ['chromium', 'firefox', 'webkit'];
