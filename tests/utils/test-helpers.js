// tests/utils/test-helpers.js
// Shared utilities for Playwright tests
// REWRITTEN: Uses static Production accounts with robust performLogin helper

import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ============================================
// BASE URL CONFIGURATION
// ============================================
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';
console.log(`[TestConfig] Using base URL: ${BASE_URL}`);

// ============================================
// TEST ACCOUNT CREDENTIALS
// ============================================
export const TEST_ACCOUNTS = {
    homeowner: {
        email: 'devonandrewdavila@gmail.com',
        password: 'Test1234',
        name: 'Devon Davila',
        uid: 'fPOyi1ZeblUwayfqwx29nNdsTjC2'
    },
    contractor: {
        email: 'danvdova@gmail.com',
        password: 'Test1234',
        name: 'Dan Vdova',
        uid: 'xLmC8rxrucPGD2pe4P5FSRmVsqc2'
    }
};

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Robust login function that handles navigation and checks for existing sessions.
 * @param {Page} page - Playwright page object
 * @param {string} role - 'homeowner' or 'contractor'
 */
export async function performLogin(page, role) {
    const isPro = role === 'contractor';
    // Use proper login URLs:
    // Contractor: https://mykrib.app/home?pro=dashboard
    // Homeowner: https://mykrib.app/home
    const url = isPro ? `${BASE_URL}/home?pro=dashboard` : `${BASE_URL}/home`;
    const account = TEST_ACCOUNTS[role];

    console.log(`[Auth] Performing login for ${role} (${account.email})...`);

    // 1. Navigate
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 2. Check if already logged in by checking URL
    // If we are logged in, we should be on the dashboard URL
    const currentUrl = page.url();
    // Contractor URL contains ?pro (or ?pro=dashboard)
    // Homeowner URL is just /home (without ?pro)
    const isDashboardUrl = isPro
        ? currentUrl.includes('?pro')
        : (currentUrl.includes('/home') && !currentUrl.includes('?pro'));

    if (isDashboardUrl) {
        // Double check for some dashboard element to be sure
        const dashboardElement = page.locator('text="Dashboard", text="Welcome", text="Home"').first();
        if (await dashboardElement.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`[Auth] Already logged in as ${role}. URL: ${currentUrl}`);
            return;
        }
    }

    // 3. Not logged in - might be on landing page, need to click Sign In
    console.log(`[Auth] Not logged in, looking for Sign In button...`);

    // Check for "Sign In" link in header (common on landing pages)
    // Use getByRole for better accessibility matching, fallback to text
    const signInLink = page.locator('text=/^Sign In$/i, a:has-text("Sign In"), button:has-text("Sign In")').first();

    if (await signInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`[Auth] Clicking Sign In button/link...`);
        await signInLink.click();
        await page.waitForTimeout(2000);
    }

    // 4. Fill Credentials
    console.log(`[Auth] Filling credentials...`);

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await emailInput.fill(account.email);
        await passwordInput.fill(account.password);
        await page.waitForTimeout(500);

        // 5. Submit
        const submitBtn = page.locator('button:has-text("Sign In"), button:has-text("Log In"), button[type="submit"]').first();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`[Auth] Clicking Submit button...`);
            await submitBtn.click();
            await page.waitForTimeout(2000);
        }
    } else {
        console.warn(`[Auth] Email input not found. Current URL: ${page.url()}`);
        // If we are already on the dashboard, maybe we missed the check?
        if (page.url().includes('/home')) {
            console.log('[Auth] URL looks like dashboard, assuming already logged in.');
            return;
        }
    }

    // 6. Wait for Dashboard to load
    console.log(`[Auth] Waiting for dashboard to load...`);
    try {
        // Wait for URL to stabilize on the dashboard
        // We avoid networkidle because of continuous background polling
        await page.waitForTimeout(5000); // Give it time to redirect/load

        const postLoginUrl = page.url();
        const isOnDashboard = isPro
            ? postLoginUrl.includes('?pro')
            : (postLoginUrl.includes('/home') && !postLoginUrl.includes('?pro'));

        if (isOnDashboard) {
            console.log(`[Auth] Login successful for ${role} - on ${postLoginUrl}`);

            // Optional: Dismiss any "Get Started" or "Welcome" modals if they block UI
            await dismissPopups(page);
        } else {
            console.warn(`[Auth] Warning: Post-login URL looks unexpected: ${postLoginUrl}`);
        }
    } catch (e) {
        console.error(`[Auth] Error waiting for dashboard for ${role}`);
        // Take a screenshot for debugging
        await page.screenshot({ path: `test-results/login-failed-${role}-${Date.now()}.png` });
        throw e;
    }
}

/**
 * Login as homeowner using static Production account.
 * returns the account object so tests know the email.
 */
export async function loginAsHomeowner(page) {
    await performLogin(page, 'homeowner');
    return TEST_ACCOUNTS.homeowner;
}

/**
 * Login as contractor using static Production account.
 * returns the account object so tests know the email.
 */
export async function loginAsContractor(page) {
    await performLogin(page, 'contractor');
    return TEST_ACCOUNTS.contractor;
}

/**
 * Dismiss any popups/overlays that might block interactions
 * Call this before navigating if there might be overlays
 * Includes privacy banners, modals, and other common overlays
 */
export async function dismissPopups(page) {
    // Check for various popup/overlay buttons - ordered by likelihood
    const closeButtons = [
        'button:has-text("No Thanks")', // Privacy banner
        'button:has-text("Accept Offers")', // Privacy banner alternative
        'button:has-text("Accept")', // Cookie consent
        'button:has-text("Got it")', // Notification banner
        'button:has-text("Skip")', // Onboarding modals
        'button[aria-label="Close"]',
        '[class*="modal"] button:has-text("Close")'
    ];

    for (const selector of closeButtons) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log(`[Popups] Dismissing popup via selector: ${selector}`);
            await btn.click({ force: true });
            await page.waitForTimeout(500);
            return true;
        }
    }
    return false;
}


// ============================================
// MOBILE NAVIGATION HELPERS
// ============================================

/**
 * Open mobile hamburger menu if present
 * Handles both homeowner and contractor mobile navigation
 */
export async function openMobileMenu(page) {
    // For contractor mobile nav: look for "More" button in bottom nav
    const moreButton = page.locator('nav button:has-text("More")').first();
    if (await moreButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[Mobile] Opening More menu (contractor)');
        await moreButton.click();
        await page.waitForTimeout(500);
        return 'contractor';
    }

    // For homeowner mobile nav: look for "More" in BottomNav
    const homeownerMoreBtn = page.locator('button:has-text("More")').first();
    if (await homeownerMoreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[Mobile] Opening More menu (homeowner)');
        await homeownerMoreBtn.click();
        await page.waitForTimeout(500);
        return 'homeowner';
    }

    return false;
}

/**
 * Navigate to a section, handling mobile menu if needed
 * Supports both contractor and homeowner navigation patterns
 */
export async function navigateToSection(page, sectionName) {
    console.log(`[Navigation] Navigating to "${sectionName}"...`);

    // First dismiss any overlays/popups that might block clicks
    await dismissPopups(page);

    // Map common test names to actual UI labels
    const labelMap = {
        // Contractor mappings
        'Jobs': 'Jobs',
        'Quotes': 'Quotes',
        'Schedule': 'Schedule',
        'Invoices': 'Invoices',
        'Messages': 'Messages',
        'Customers': 'Customers',
        'Evaluations': 'Evaluations',
        // Homeowner mappings
        'Records': 'Inventory', // Homeowners see "Inventory" not "Records"
        'Contractors': 'Pros',
        'Pros': 'Pros',
        'Reports': 'Reports',
        'Settings': 'Settings',
    };

    const actualLabel = labelMap[sectionName] || sectionName;

    // 1. Try desktop sidebar first
    const sidebarNav = page.locator(`aside nav button:has-text("${actualLabel}")`).first();
    if (await sidebarNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[Navigation] Found "${actualLabel}" in desktop sidebar`);
        await sidebarNav.click();
        await page.waitForTimeout(1000);
        return true;
    }

    // 2. Try bottom nav directly
    const bottomNavItem = page.locator(`nav button:has-text("${actualLabel}")`).first();
    if (await bottomNavItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[Navigation] Found "${actualLabel}" in bottom nav`);
        await bottomNavItem.click();
        await page.waitForTimeout(1000);
        return true;
    }

    // 3. Try opening mobile More menu to find the item
    const menuType = await openMobileMenu(page);
    if (menuType) {
        await page.waitForTimeout(500); // Wait for menu animation

        // Look for the item in the opened menu
        const menuItem = page.locator(`button:has-text("${actualLabel}"):visible`).first();
        if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`[Navigation] Found "${actualLabel}" in More menu`);
            await menuItem.click();
            await page.waitForTimeout(1000);
            return true;
        }
    }

    // 4. Final fallback: Log but don't strictly throw if running locally, user might need to navigate manually
    const errorMsg = `[Navigation] Could not find "${sectionName}" (mapped: "${actualLabel}") in any navigation`;
    console.log(errorMsg);
    throw new Error(errorMsg);
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

    await page.waitForTimeout(500);
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


export { BASE_URL };



/**
 * DEPRECATED: Legacy helper for older tests.
 * Prefer loginAsHomeowner / loginAsContractor
 */
export async function loginWithCredentials(page, email, password) {
    console.warn('loginWithCredentials is deprecated. Please use performLogin instead.');
    // Attempt basic login flow using performLogin logic if possible, or just fail gracefully if muted.
    // For now, mapping to performLogin if email matches test accounts, else simple fill

    // Check if it matches our static accounts
    if (email === TEST_ACCOUNTS.homeowner.email) return performLogin(page, 'homeowner');
    if (email === TEST_ACCOUNTS.contractor.email) return performLogin(page, 'contractor');

    // Fallback for random/other emails (legacy logic simulation)
    await page.goto(BASE_URL + '/home');
    const signInLink = page.locator('text=/^Sign In$/i, a:has-text("Sign In"), button:has-text("Sign In")').first();
    if (await signInLink.isVisible().catch(() => false)) await signInLink.click();

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click().catch(() => { });
}

export async function selectPropertyIfNeeded() { console.warn('selectPropertyIfNeeded is deprecated'); }
export async function waitForToast() { console.warn('waitForToast is deprecated'); }

export default {
    loginAsHomeowner,
    loginAsContractor,
    performLogin,
    screenshot,
    waitForLoadingComplete,
    waitForModal,
    closeModal,
    navigateToSection,
    dismissPopups,
    uniqueId,
    generateCustomerData,
    loginWithCredentials, // Added back
    selectPropertyIfNeeded, // Added back
    waitForToast, // Added back
    BASE_URL
};
