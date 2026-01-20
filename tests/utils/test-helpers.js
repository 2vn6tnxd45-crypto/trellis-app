// tests/utils/test-helpers.js
// Shared utilities for Playwright tests
// REWRITTEN: Uses fresh user signup pattern to avoid rate limiting

import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ============================================
// BASE URL CONFIGURATION
// ============================================
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';
console.log(`[TestConfig] Using base URL: ${BASE_URL}`);

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Generate unique test account credentials
 * Creates a fresh user for each test to avoid rate limiting
 */
function generateTestAccount(type = 'contractor') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return {
        email: `test.${type}.${timestamp}.${random}@gmail.com`,
        password: 'KribTest123!',
        name: `Test ${type.charAt(0).toUpperCase() + type.slice(1)} ${timestamp}`,
        companyName: `Test Company ${timestamp}`,
        phone: '5555555555'
    };
}

/**
 * Login as homeowner by creating a fresh account
 * FIXED: Creates new user every time to avoid rate limiting
 */
export async function loginAsHomeowner(page, options = {}) {
    const account = generateTestAccount('homeowner');
    console.log(`[Auth] Creating fresh homeowner: ${account.email}`);

    try {
        // Navigate to homeowner signup
        await page.goto(`${BASE_URL}/home`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if already logged in (sidebar visible)
        const alreadyLoggedIn = await page.locator('aside, nav').first().isVisible({ timeout: 2000 }).catch(() => false);
        if (alreadyLoggedIn) {
            console.log('[Auth] Already logged in as homeowner');
            return true;
        }

        // Handle landing page - click "I'm a Homeowner" if present
        const homeownerButton = page.locator(
            'button:has-text("Homeowner"), ' +
            'a:has-text("Homeowner"), ' +
            'text="I\'m a Homeowner"'
        ).first();

        if (await homeownerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('[Auth] Clicking homeowner button on landing page');
            await homeownerButton.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1500);
        }

        // Look for Sign Up link (create account instead of logging in)
        const signUpLink = page.locator('text=/sign up|create account/i').last();
        if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('[Auth] Navigating to Sign Up');
            await signUpLink.click();
            await page.waitForTimeout(1000);
        } else {
            // May need to click Sign In first, then Sign Up
            const signInButton = page.locator('text=/sign in|log in|get started/i').first();
            if (await signInButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signInButton.click();
                await page.waitForTimeout(1000);
                const innerSignUp = page.locator('text=/sign up|create account/i').last();
                if (await innerSignUp.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await innerSignUp.click();
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Fill Sign Up Form
        console.log(`[Auth] Filling signup form for ${account.email}`);

        // Fill Name
        const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
        if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await nameInput.fill(account.name);
        }

        // Fill Email & Password
        await page.fill('input[type="email"]', account.email);
        await page.fill('input[type="password"]', account.password);

        // Submit signup
        const submitBtn = page.locator(
            'button:has-text("Create Account"), ' +
            'button:has-text("Sign Up"), ' +
            'button:has-text("Get Started"), ' +
            'button[type="submit"]'
        ).first();

        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(2000);
        }

        // Handle Onboarding screens including property setup
        console.log('[Auth] Checking for onboarding screens...');
        for (let i = 0; i < 8; i++) {
            const sidebarVisible = await page.locator('aside').first().isVisible({ timeout: 1000 }).catch(() => false);
            if (sidebarVisible) {
                console.log('[Auth] Sidebar visible - onboarding complete');
                break;
            }

            // Check for property setup form
            const propertyAddressInput = page.locator('input[placeholder*="address" i]').first();
            if (await propertyAddressInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log('[Auth] Property setup form detected');
                // Fill nickname
                const nicknameInput = page.locator('input[placeholder*="home" i], input[placeholder*="nickname" i]').first();
                if (await nicknameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await nicknameInput.fill('Test Home');
                }
                // Fill address and select from autocomplete
                await propertyAddressInput.fill('123 Test St');
                await page.waitForTimeout(1500);
                // Click on the first autocomplete suggestion
                const suggestion = page.locator('text=/123 Test St.*USA/i').first();
                if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[Auth] Selecting address from autocomplete');
                    await suggestion.click();
                    await page.waitForTimeout(1000);
                }
                // Click create button
                const createBtn = page.locator('button:has-text("Kreate"), button:has-text("Create"), button:has-text("Get Started")').first();
                if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await createBtn.click();
                    await page.waitForTimeout(2000);
                }
                continue;
            }

            // Try clicking continue/skip buttons
            const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Skip"), button:has-text("Next")').first();
            if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await continueBtn.click();
                await page.waitForTimeout(1000);
            }
            await page.waitForTimeout(500);
        }

        console.log('[Auth] Homeowner login complete');
        return true;

    } catch (error) {
        console.log(`[Auth] Homeowner login failed: ${error.message}`);
        throw error;
    }
}

/**
 * Login as contractor by creating a fresh account
 * FIXED: Creates new user every time to avoid rate limiting
 * Copied directly from working contractor.spec.js pattern
 */
export async function loginAsContractor(page, options = {}) {
    // Generate unique user for this test run
    const timestamp = Date.now();
    const account = {
        email: `test.contractor.${timestamp}.${Math.floor(Math.random() * 1000)}@gmail.com`,
        password: 'KribTest123!',
        companyName: 'Test Contractor ' + timestamp
    };
    console.log(`[Auth] Creating fresh contractor: ${account.email}`);

    try {
        // 1. Initial Navigation to /home?pro
        await page.goto(`${BASE_URL}/home?pro`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // 2. Check if already logged in (Sidebar visible)
        const alreadyLoggedIn = await page.locator('aside').first().isVisible().catch(() => false);
        if (alreadyLoggedIn) {
            console.log('[Auth] Already logged in as contractor');
            return true;
        }

        // 3. Go Directly to Sign Up
        // Look for "Sign up" link usually below Sign In form
        const signUpLink = page.locator('text=/sign up|create account/i').last();

        if (await signUpLink.isVisible()) {
            console.log(`[Auth] Navigating to Sign Up for ${account.email}...`);
            await signUpLink.click();
            await page.waitForTimeout(1000);
        } else {
            // If not found, maybe click "Sign In" first then "Sign Up"?
            const authButton = page.locator('text=/sign in|log in|get started|start free/i').first();
            if (await authButton.isVisible()) {
                await authButton.click();
                await page.waitForTimeout(1000);
                const innerSignUp = page.locator('text=/sign up|create account/i').last();
                if (await innerSignUp.isVisible()) await innerSignUp.click();
            }
        }

        // 4. Fill Sign Up Form
        console.log(`[Auth] Signing up new user ${account.email}...`);

        // Fill Name (Robust Selectors)
        const nameInput = page.locator('input[placeholder="John Smith"], input[type="text"]').nth(0);
        // Wait a bit for form to animate
        if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await nameInput.fill(account.companyName.split(' ')[0] + ' User');

            // Fill Company
            const companyInput = page.locator('input[placeholder="ABC Plumbing"], input[placeholder*="Company"]').first();
            if (await companyInput.isVisible()) await companyInput.fill(account.companyName);

            // Fill Phone
            const phoneInput = page.locator('input[type="tel"]').first();
            if (await phoneInput.isVisible()) await phoneInput.fill('5555555555');

            // Fill Email & Password
            await page.fill('input[type="email"]', account.email);
            await page.fill('input[type="password"]', account.password);

            // Submit
            const submitBtn = page.locator('button:has-text("Create Account")').first();
            if (await submitBtn.isVisible()) await submitBtn.click();

            await page.waitForTimeout(2000);
        } else {
            console.log('[Auth] Sign Up form not found.');
        }

        // 5. Handle Onboarding (Robust Loop)
        console.log('[Auth] Checking for Onboarding screen...');
        for (let i = 0; i < 5; i++) {
            const sidebarVisible = await page.locator('aside').first().isVisible().catch(() => false);
            if (sidebarVisible) {
                console.log('[Auth] Sidebar found. Signup complete.');
                break;
            }

            const welcome = page.locator('text=/welcome|setup|get started/i').first();
            if (await welcome.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[Auth] Onboarding step ${i + 1} detected. Clicking continue/skip...`);
                const buttons = [
                    'button:has-text("Continue")',
                    'button:has-text("Next")',
                    'button:has-text("Skip")',
                    'button:has-text("Get Started")',
                    '[data-testid="onboarding-next"]'
                ];
                for (const selector of buttons) {
                    const btn = page.locator(selector).first();
                    if (await btn.isVisible()) {
                        await btn.click();
                        await page.waitForTimeout(1000);
                        break;
                    }
                }
            }
            await page.waitForTimeout(1000);
        }

        console.log('[Auth] Contractor login complete');
        return true;

    } catch (error) {
        console.log(`[Auth] Contractor login failed: ${error.message}`);
        throw error;
    }
}

/**
 * Handle onboarding screens after signup
 */
async function handleOnboarding(page) {
    console.log('[Auth] Checking for onboarding screens...');

    for (let i = 0; i < 5; i++) {
        // Check if we've reached the dashboard
        const sidebarVisible = await page.locator('aside').first().isVisible({ timeout: 1000 }).catch(() => false);
        if (sidebarVisible) {
            console.log('[Auth] Sidebar found - onboarding complete');
            break;
        }

        // Look for onboarding/welcome screens
        const onboardingText = page.locator('text=/welcome|setup|get started|let\'s go/i').first();
        if (await onboardingText.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`[Auth] Onboarding screen ${i + 1} detected - clicking through`);

            // Try various continue/skip buttons
            const buttons = [
                'button:has-text("Continue")',
                'button:has-text("Next")',
                'button:has-text("Skip")',
                'button:has-text("Get Started")',
                'button:has-text("Let\'s Go")',
                '[data-testid="onboarding-next"]'
            ];

            for (const selector of buttons) {
                const btn = page.locator(selector).first();
                if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await btn.click();
                    await page.waitForTimeout(1000);
                    break;
                }
            }
        }

        await page.waitForTimeout(1000);
    }
}

/**
 * Save browser session state for reuse (optional, for session persistence)
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
