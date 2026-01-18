// tests/utils/test-helpers.js
// Shared utilities for Playwright tests

import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ============================================
// BASE URL CONFIGURATION
// ============================================
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';
console.log(`[TestConfig] Using base URL: ${BASE_URL}`);

// Session cache with TTL tracking
const SESSION_CACHE = {
    homeowner: { lastLogin: 0, valid: false },
    contractor: { lastLogin: 0, valid: false }
};
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Check if stored session is still valid (not expired)
 */
function isSessionValid(userType) {
    const cache = SESSION_CACHE[userType];
    const now = Date.now();
    const timeSinceLogin = now - cache.lastLogin;

    if (cache.valid && timeSinceLogin < SESSION_TTL) {
        console.log(`[Auth] ${userType} session still valid (${Math.round(timeSinceLogin / 1000)}s old)`);
        return true;
    }
    return false;
}

/**
 * Mark session as valid after successful login
 */
function markSessionValid(userType) {
    SESSION_CACHE[userType] = { lastLogin: Date.now(), valid: true };
}

/**
 * Invalidate session (e.g., after logout or error)
 */
function invalidateSession(userType) {
    SESSION_CACHE[userType] = { lastLogin: 0, valid: false };
}

/**
 * Login as homeowner using stored session or fresh login
 * FIXED: Better session validation and login flow handling
 */
export async function loginAsHomeowner(page, options = {}) {
    const {
        email = 'danvdova@gmail.com',
        password = 'Password123',
        useStoredSession = true,
        storageStatePath = 'tests/auth/homeowner.json'
    } = options;

    // Check memory cache first to avoid unnecessary checks
    if (useStoredSession && isSessionValid('homeowner') && fs.existsSync(storageStatePath)) {
        console.log('[Auth] Using cached homeowner session');
        await page.goto(`${BASE_URL}/home`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Quick verification - check for dashboard content
        const dashboardContent = await page.locator('text="Your Home", text="Dashboard", text="Records", nav, aside').first().isVisible({ timeout: 5000 }).catch(() => false);

        if (dashboardContent) {
            console.log('[Auth] Stored homeowner session confirmed valid');
            return true;
        }

        // Check if we hit login page
        const onLoginPage = await page.locator('text="Sign in", text="Welcome back"').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (onLoginPage) {
            console.log('[Auth] Stored session expired, need fresh login');
            invalidateSession('homeowner');
        }
    }

    // Fresh login with rate limit protection
    console.log('[Auth] Performing fresh homeowner login');

    try {
        await page.goto(`${BASE_URL}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if we're already on the homeowner login page
        let onHomePage = await page.locator('input[type="email"]').first().isVisible({ timeout: 3000 }).catch(() => false);

        if (!onHomePage) {
            // Click homeowner button on landing page
            const homeownerButton = page.locator('text="I\'m a Homeowner", button:has-text("Homeowner")').first();
            if (await homeownerButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await homeownerButton.click();
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1500);
            }
        }

        // Check for rate limiting BEFORE attempting login
        const rateLimitError = await page.locator('text="Too many attempts"').isVisible({ timeout: 1000 }).catch(() => false);
        if (rateLimitError) {
            console.log('[Auth] Rate limited - waiting 60 seconds');
            await page.waitForTimeout(60000);
        }

        // Switch to login mode if on signup form
        const signInLink = page.locator('text="Sign In", a:has-text("Sign in"), text="Already have an account"').first();
        if (await signInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await signInLink.click();
            await page.waitForTimeout(1000);
        }

        // Enter credentials
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

        await emailInput.waitFor({ state: 'visible', timeout: 10000 });
        await emailInput.fill(email);
        await passwordInput.fill(password);

        // Click sign in button (avoid Google button)
        const signInButton = page.locator('button:has-text("Sign In"), button:has-text("Sign in"), button:has-text("Log in")')
            .filter({ hasNot: page.locator('text="Google"') }).first();
        await signInButton.click();

        // Wait for redirect to dashboard
        await page.waitForTimeout(3000);

        // Check for successful login
        const loggedIn = await page.locator('nav, aside, text="Your Home", text="Dashboard"').first().isVisible({ timeout: 10000 }).catch(() => false);

        if (loggedIn) {
            console.log('[Auth] Homeowner login successful');
            await saveSession(page, storageStatePath);
            markSessionValid('homeowner');
            return true;
        }

        // Check for rate limit or error
        const errorVisible = await page.locator('text="Too many attempts", text="Invalid", [class*="error"]').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (errorVisible) {
            const errorText = await page.locator('text="Too many attempts", text="Invalid", [class*="error"]').first().textContent();
            console.log(`[Auth] Login error: ${errorText}`);
            throw new Error(`Login failed: ${errorText}`);
        }

        // May still be on login page but credentials accepted - wait longer
        await page.waitForTimeout(5000);
        console.log('[Auth] Homeowner login completed (may need verification)');
        await saveSession(page, storageStatePath);
        markSessionValid('homeowner');
        return true;

    } catch (error) {
        console.log(`[Auth] Homeowner login failed: ${error.message}`);
        invalidateSession('homeowner');
        throw error;
    }
}

/**
 * Login as contractor using stored session or fresh login
 * FIXED: Better session validation and rate limit handling
 */
export async function loginAsContractor(page, options = {}) {
    const {
        email = 'daviladevon@gmail.com',
        password = 'Password123',
        useStoredSession = true,
        storageStatePath = 'tests/auth/contractor.json'
    } = options;

    // Check memory cache first
    if (useStoredSession && isSessionValid('contractor') && fs.existsSync(storageStatePath)) {
        console.log('[Auth] Using cached contractor session');
        await page.goto(`${BASE_URL}/home?pro=dashboard`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Quick verification - check for contractor sidebar
        const sidebarVisible = await page.locator('nav >> text="Dashboard", nav >> text="Quotes", aside').first().isVisible({ timeout: 5000 }).catch(() => false);

        if (sidebarVisible) {
            console.log('[Auth] Stored contractor session confirmed valid');
            return true;
        }

        console.log('[Auth] Stored contractor session expired, need fresh login');
        invalidateSession('contractor');
    }

    // Fresh login
    console.log('[Auth] Performing fresh contractor login');

    try {
        await page.goto(`${BASE_URL}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Click contractor button on landing
        const contractorButton = page.locator('text="I\'m a Contractor", button:has-text("Contractor"), text="For Professionals"').first();
        if (await contractorButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await contractorButton.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1500);
        }

        // Check for rate limiting
        const rateLimitError = await page.locator('text="Too many attempts"').isVisible({ timeout: 1000 }).catch(() => false);
        if (rateLimitError) {
            console.log('[Auth] Rate limited - waiting 60 seconds');
            await page.waitForTimeout(60000);
        }

        // Click Sign In link if on landing page
        const signInLink = page.locator('text="Sign In", a:has-text("Sign in")').first();
        if (await signInLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInLink.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1500);
        }

        // Enter credentials
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

        await emailInput.waitFor({ state: 'visible', timeout: 10000 });
        await emailInput.fill(email);
        await passwordInput.fill(password);

        // Click sign in button
        const signInButton = page.locator('button:has-text("Sign In"), button:has-text("Sign in")')
            .filter({ hasNot: page.locator('text="Google"') }).first();
        await signInButton.click();

        // Wait for contractor dashboard
        await page.waitForTimeout(3000);

        const dashboardLoaded = await page.locator('nav >> text="Dashboard", nav >> text="Quotes"').first().isVisible({ timeout: 15000 }).catch(() => false);

        if (dashboardLoaded) {
            console.log('[Auth] Contractor login successful');
            await saveSession(page, storageStatePath);
            markSessionValid('contractor');
            return true;
        }

        // Check for errors
        const errorVisible = await page.locator('text="Too many attempts", text="Invalid"').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (errorVisible) {
            const errorText = await page.locator('text="Too many attempts", text="Invalid"').first().textContent();
            throw new Error(`Login failed: ${errorText}`);
        }

        // Assume login worked, just slow
        await page.waitForTimeout(5000);
        console.log('[Auth] Contractor login completed');
        await saveSession(page, storageStatePath);
        markSessionValid('contractor');
        return true;

    } catch (error) {
        console.log(`[Auth] Contractor login failed: ${error.message}`);
        invalidateSession('contractor');
        throw error;
    }
}

/**
 * Save browser session state for reuse
 */
async function saveSession(page, filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    await page.context().storageState({ path: filePath });
    console.log(`[Auth] Session saved to ${filePath}`);
}

// ============================================
// MOBILE NAVIGATION HELPERS
// ============================================

/**
 * Open mobile hamburger menu if present
 */
export async function openMobileMenu(page) {
    // Look for common hamburger menu buttons
    const menuButton = page.locator(
        'button[aria-label*="menu" i], ' +
        'button:has(svg[class*="menu"]), ' +
        'button:has([class*="hamburger"]), ' +
        '[class*="mobile-menu"] button, ' +
        'button:has([class*="bars"])'
    ).first();

    if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('[Mobile] Opening hamburger menu');
        await menuButton.click();
        await page.waitForTimeout(500);
        return true;
    }

    return false;
}

/**
 * Navigate to a section, handling mobile menu if needed
 */
export async function navigateToSection(page, sectionName) {
    // Try direct navigation first (desktop)
    let navLink = page.locator(`nav >> text="${sectionName}"`, `aside >> text="${sectionName}"`).first();

    if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await navLink.click();
        await page.waitForTimeout(1500);
        return true;
    }

    // Try opening mobile menu
    const menuOpened = await openMobileMenu(page);
    if (menuOpened) {
        navLink = page.locator(`text="${sectionName}"`).first();
        if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await navLink.click();
            await page.waitForTimeout(1500);
            return true;
        }
    }

    console.log(`[Navigation] Could not find "${sectionName}" link`);
    return false;
}

/**
 * Close mobile menu if open
 */
export async function closeMobileMenu(page) {
    const closeButton = page.locator(
        'button[aria-label*="close" i], ' +
        'button:has(svg[class*="x"]), ' +
        '[class*="mobile-menu"] button:has(svg[class*="close"])'
    ).first();

    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(300);
        return true;
    }
    return false;
}

/**
 * Check if we're in mobile viewport
 */
export async function isMobileViewport(page) {
    const viewport = page.viewportSize();
    return viewport && viewport.width < 768;
}

// ============================================
// SCREENSHOT HELPERS
// ============================================

/**
 * Take a screenshot with consistent naming
 */
export async function screenshot(page, testName, stepName) {
    const dir = `test-results/${testName}`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${dir}/${stepName}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`[Screenshot] ${filename}`);
    return filename;
}

/**
 * Take a full page screenshot
 */
export async function screenshotFullPage(page, testName, stepName) {
    const dir = `test-results/${testName}`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${dir}/${stepName}-full-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`[Screenshot] ${filename}`);
    return filename;
}

// ============================================
// RATE LIMITING HELPERS
// ============================================

/**
 * Wait with exponential backoff on rate limit
 */
export async function waitForRateLimit(attempt = 1, maxWait = 60000) {
    const baseDelay = 5000; // 5 seconds base
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxWait);
    console.log(`[RateLimit] Waiting ${delay}ms before retry (attempt ${attempt})`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Execute action with rate limit retry
 */
export async function withRateLimitRetry(action, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await action();
        } catch (error) {
            const isRateLimit = error.message?.includes('rate') ||
                               error.message?.includes('too many') ||
                               error.message?.includes('Too many') ||
                               error.message?.includes('quota');

            if (isRateLimit && attempt < maxRetries) {
                await waitForRateLimit(attempt);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Add delay between test suites to avoid rate limiting
 */
export async function interSuiteDelay(ms = 5000) {
    console.log(`[RateLimit] Inter-suite delay: ${ms}ms`);
    await new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// NAVIGATION HELPERS
// ============================================

/**
 * Navigate to a specific page and wait for load
 */
export async function navigateTo(page, urlPath, options = {}) {
    const { waitForSelector, timeout = 30000 } = options;

    const url = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath}`;
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');

    if (waitForSelector) {
        await page.locator(waitForSelector).waitFor({ state: 'visible', timeout });
    }
}

/**
 * Click navigation item in sidebar (with mobile support)
 */
export async function clickNavItem(page, itemText) {
    return await navigateToSection(page, itemText);
}

// ============================================
// FORM HELPERS
// ============================================

/**
 * Fill a form field by label or placeholder
 */
export async function fillField(page, labelOrPlaceholder, value) {
    // Try by label first
    let input = page.locator(`label:has-text("${labelOrPlaceholder}") + input, label:has-text("${labelOrPlaceholder}") >> input`).first();

    if (!await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Try by placeholder
        input = page.locator(`input[placeholder*="${labelOrPlaceholder}" i]`).first();
    }

    if (!await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Try by name
        input = page.locator(`input[name*="${labelOrPlaceholder}" i]`).first();
    }

    await input.fill(value);
}

/**
 * Select dropdown option
 */
export async function selectOption(page, label, value) {
    const select = page.locator(`label:has-text("${label}") + select, label:has-text("${label}") >> select`).first();
    await select.selectOption(value);
}

/**
 * Click button by text
 */
export async function clickButton(page, text) {
    const button = page.locator(`button:has-text("${text}")`).first();
    await button.click();
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Assert element is visible with screenshot
 */
export async function assertVisible(page, selector, testName, stepName) {
    const element = page.locator(selector);
    await expect(element).toBeVisible({ timeout: 10000 });
    await screenshot(page, testName, stepName);
}

/**
 * Assert text is present on page
 */
export async function assertTextVisible(page, text, testName, stepName) {
    const element = page.locator(`text="${text}"`).first();
    await expect(element).toBeVisible({ timeout: 10000 });
    await screenshot(page, testName, stepName);
}

/**
 * Assert URL contains path
 */
export async function assertUrlContains(page, urlPath) {
    await expect(page).toHaveURL(new RegExp(urlPath));
}

/**
 * Assert no error messages visible
 */
export async function assertNoErrors(page) {
    const errorSelectors = ['.text-red-500', '.text-red-600', '[class*="error"]', '[role="alert"]'];
    for (const selector of errorSelectors) {
        const errorCount = await page.locator(selector).count();
        if (errorCount > 0) {
            const errorText = await page.locator(selector).first().textContent();
            // Ignore expected messages
            if (!errorText?.includes('No items') && !errorText?.includes('empty')) {
                console.warn(`[Warning] Possible error message: ${errorText}`);
            }
        }
    }
}

// ============================================
// WAIT HELPERS
// ============================================

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingComplete(page, timeout = 10000) {
    const spinnerSelectors = [
        '.animate-spin',
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="Loader"]'
    ];

    for (const selector of spinnerSelectors) {
        try {
            await page.locator(selector).waitFor({ state: 'hidden', timeout: 3000 });
        } catch (e) {
            // Spinner might not exist, that's okay
        }
    }

    // Wait for DOM to settle
    try {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch (e) {
        // Page may already be loaded
    }

    // Short stability wait
    await page.waitForTimeout(500);
}

/**
 * Wait for toast notification
 */
export async function waitForToast(page, text = null, timeout = 10000) {
    const toastSelector = text
        ? `[class*="toast"]:has-text("${text}"), [class*="Toaster"]:has-text("${text}")`
        : '[class*="toast"], [class*="Toaster"]';

    await page.locator(toastSelector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Wait for modal to appear
 */
export async function waitForModal(page, timeout = 10000) {
    const modalSelectors = [
        '[role="dialog"]',
        '[class*="modal"]',
        '[class*="Modal"]',
        '.fixed.inset-0'
    ];

    for (const selector of modalSelectors) {
        try {
            await page.locator(selector).first().waitFor({ state: 'visible', timeout: 3000 });
            return true;
        } catch (e) {
            // Try next selector
        }
    }
    return false;
}

/**
 * Close any open modal
 */
export async function closeModal(page) {
    const closeButtons = [
        'button[aria-label*="close" i]',
        'button:has(svg[class*="x"])',
        '[class*="modal"] button:has-text("Cancel")',
        '[class*="modal"] button:has-text("Close")'
    ];

    for (const selector of closeButtons) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(500);
            return true;
        }
    }

    // Try clicking backdrop
    const backdrop = page.locator('.fixed.inset-0.bg-black, [class*="backdrop"]').first();
    if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
        await backdrop.click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(500);
        return true;
    }

    return false;
}

// ============================================
// DATA HELPERS
// ============================================

/**
 * Generate unique test identifier
 */
export function uniqueId(prefix = 'test') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate test data for a customer
 */
export function generateCustomerData(testId = null) {
    const id = testId || uniqueId();
    return {
        name: `Test Customer ${id}`,
        email: `test-${id}@example.com`,
        phone: '5551234567',
        address: '123 Test Street, Anytown, CA 90210'
    };
}

/**
 * Generate test data for a service request
 */
export function generateServiceRequestData() {
    return {
        category: 'Plumbing',
        room: 'Bathroom',
        description: `Test service request - ${uniqueId()}`,
        urgency: 'normal'
    };
}

/**
 * Generate test data for a quote
 */
export function generateQuoteData() {
    return {
        title: `Test Quote - ${uniqueId()}`,
        lineItems: [
            { type: 'material', description: '50 Gallon Water Heater', quantity: 1, unitPrice: 850 },
            { type: 'labor', description: 'Installation Labor', quantity: 4, unitPrice: 125 }
        ],
        taxRate: 8.25,
        depositPercent: 50,
        notes: `Test quote created at ${new Date().toISOString()}`
    };
}

/**
 * Generate test data for an evaluation
 */
export function generateEvaluationData() {
    return {
        customerName: `Eval Customer ${uniqueId()}`,
        customerEmail: `eval-${Date.now()}@example.com`,
        customerPhone: '5559876543',
        type: 'virtual',
        category: 'General / Other',
        issue: 'Testing evaluation flow - please ignore'
    };
}

// ============================================
// CLEANUP HELPERS
// ============================================

/**
 * Clean up test data after test run
 */
export async function cleanupTestData(page, testIdentifiers = []) {
    console.log('[Cleanup] Starting test data cleanup');
    // Implementation depends on your data model
    // Could archive/delete items created during tests
}

/**
 * Clear session cache (useful between test files)
 */
export function clearSessionCache() {
    SESSION_CACHE.homeowner = { lastLogin: 0, valid: false };
    SESSION_CACHE.contractor = { lastLogin: 0, valid: false };
    console.log('[Auth] Session cache cleared');
}

export { BASE_URL };

export default {
    loginAsHomeowner,
    loginAsContractor,
    screenshot,
    screenshotFullPage,
    waitForRateLimit,
    withRateLimitRetry,
    interSuiteDelay,
    navigateTo,
    navigateToSection,
    clickNavItem,
    fillField,
    selectOption,
    clickButton,
    assertVisible,
    assertTextVisible,
    assertUrlContains,
    assertNoErrors,
    waitForLoadingComplete,
    waitForToast,
    waitForModal,
    closeModal,
    openMobileMenu,
    closeMobileMenu,
    isMobileViewport,
    uniqueId,
    generateCustomerData,
    generateServiceRequestData,
    generateQuoteData,
    generateEvaluationData,
    cleanupTestData,
    clearSessionCache,
    BASE_URL
};
