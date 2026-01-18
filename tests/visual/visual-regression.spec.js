// tests/visual/visual-regression.spec.js
import { test, expect } from '@playwright/test';
import { TEST_USERS, SELECTORS } from '../fixtures/test-data.js';
import { VISUAL_TEST_CONFIG, CRITICAL_PAGES } from './visual-regression.config.js';

/**
 * Visual Regression Tests
 *
 * Uses Playwright's built-in screenshot comparison.
 * Run with: npx playwright test tests/visual --update-snapshots (first run)
 * Then: npx playwright test tests/visual (subsequent runs)
 */

// Helper to login as specific user type
async function loginAs(page, userType) {
    const user = userType === 'contractor'
        ? TEST_USERS.fullContractor
        : TEST_USERS.fullHomeowner;

    await page.goto('/');
    await page.fill(SELECTORS.emailInput, user.email);
    await page.fill(SELECTORS.passwordInput, user.password);
    await page.click(SELECTORS.submitButton);

    // Wait for dashboard
    await expect(page).toHaveURL(/.*\/(home|app|contractor)/, { timeout: 15000 });
}

// Helper to mask dynamic elements
async function maskDynamicContent(page) {
    for (const selector of VISUAL_TEST_CONFIG.dynamicMasks) {
        const elements = page.locator(selector);
        const count = await elements.count();

        for (let i = 0; i < count; i++) {
            await elements.nth(i).evaluate(el => {
                el.style.visibility = 'hidden';
            });
        }
    }
}

// Helper to wait for page stability
async function waitForPageStability(page, waitForSelector) {
    // Wait for specific element if provided
    if (waitForSelector) {
        await page.locator(waitForSelector).first().waitFor({ timeout: 10000 }).catch(() => { });
    }

    // Wait for network idle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });

    // Wait for animations to complete
    await page.waitForTimeout(500);
}

// ============================================
// DESKTOP VISUAL TESTS
// ============================================

test.describe('Visual Regression - Desktop', () => {
    test.use({ viewport: VISUAL_TEST_CONFIG.viewports.desktop });

    test('Auth Screen - Login view', async ({ page }) => {
        await page.goto('/');
        await waitForPageStability(page, SELECTORS.emailInput);
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('auth-login-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Auth Screen - Signup view', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Sign up');
        await waitForPageStability(page, 'input[placeholder*="name" i]');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('auth-signup-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Auth Screen - Forgot password view', async ({ page }) => {
        await page.goto('/');
        await page.click('text=/forgot.*password/i');
        await waitForPageStability(page, 'text=/reset/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('auth-forgot-password-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Homeowner Dashboard', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await waitForPageStability(page, 'text=/dashboard|welcome/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('homeowner-dashboard-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Property Records List', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await page.click('text=Records, nav a:has-text("Records")');
        await waitForPageStability(page, 'text=/records/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('property-records-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Smart Scanner UI', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await page.click('text=Scan, nav a:has-text("Scan"), button:has-text("Scan")');
        await waitForPageStability(page, 'text=/scan|upload/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('smart-scanner-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Contractor Dashboard', async ({ page }) => {
        await loginAs(page, 'contractor');
        await waitForPageStability(page, 'text=/dashboard|jobs/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('contractor-dashboard-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Quote Builder - New Quote', async ({ page }) => {
        await loginAs(page, 'contractor');
        await page.click('text=Quotes, nav a:has-text("Quotes")');
        await page.click('button:has-text("New Quote"), button:has-text("Create")');
        await waitForPageStability(page, 'text=/new quote|create/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('quote-builder-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Job Calendar View', async ({ page }) => {
        await loginAs(page, 'contractor');
        await page.click('text=Calendar, nav a:has-text("Calendar"), text=Schedule');
        await waitForPageStability(page, '[class*="calendar"]');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('job-calendar-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Settings Page', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await page.click('text=Settings, nav a:has-text("Settings")');
        await waitForPageStability(page, 'text=/settings/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('settings-desktop.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });
});

// ============================================
// MOBILE VISUAL TESTS
// ============================================

test.describe('Visual Regression - Mobile', () => {
    test.use({ viewport: VISUAL_TEST_CONFIG.viewports.mobile });

    test('Auth Screen - Login view', async ({ page }) => {
        await page.goto('/');
        await waitForPageStability(page, SELECTORS.emailInput);
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('auth-login-mobile.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Homeowner Dashboard', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await waitForPageStability(page, 'text=/dashboard|welcome/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('homeowner-dashboard-mobile.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Property Records List', async ({ page }) => {
        await loginAs(page, 'homeowner');

        // Mobile navigation - may need to open menu
        const menuButton = page.locator('button[aria-label*="menu"], [class*="hamburger"]');
        if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await menuButton.click();
        }

        await page.click('text=Records, nav a:has-text("Records")');
        await waitForPageStability(page, 'text=/records/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('property-records-mobile.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Contractor Dashboard', async ({ page }) => {
        await loginAs(page, 'contractor');
        await waitForPageStability(page, 'text=/dashboard|jobs/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('contractor-dashboard-mobile.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Navigation Menu', async ({ page }) => {
        await loginAs(page, 'homeowner');

        // Open mobile menu
        const menuButton = page.locator('button[aria-label*="menu"], [class*="hamburger"]');
        if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await menuButton.click();
            await page.waitForTimeout(300); // Menu animation
        }

        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('mobile-navigation-menu.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });
});

// ============================================
// TABLET VISUAL TESTS
// ============================================

test.describe('Visual Regression - Tablet', () => {
    test.use({ viewport: VISUAL_TEST_CONFIG.viewports.tablet });

    test('Auth Screen - Login view', async ({ page }) => {
        await page.goto('/');
        await waitForPageStability(page, SELECTORS.emailInput);
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('auth-login-tablet.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Homeowner Dashboard', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await waitForPageStability(page, 'text=/dashboard|welcome/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('homeowner-dashboard-tablet.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Contractor Dashboard', async ({ page }) => {
        await loginAs(page, 'contractor');
        await waitForPageStability(page, 'text=/dashboard|jobs/i');
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('contractor-dashboard-tablet.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });
});

// ============================================
// COMPONENT VISUAL TESTS
// ============================================

test.describe('Visual Regression - Components', () => {
    test.use({ viewport: VISUAL_TEST_CONFIG.viewports.desktop });

    test('Error state - Invalid login', async ({ page }) => {
        await page.goto('/');
        await page.fill(SELECTORS.emailInput, 'invalid@example.com');
        await page.fill(SELECTORS.passwordInput, 'wrongpassword');
        await page.click(SELECTORS.submitButton);

        // Wait for error message
        await page.locator('text=/invalid|error/i').waitFor({ timeout: 10000 });
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('error-state-login.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Loading state - Dashboard', async ({ page }) => {
        await page.goto('/');
        await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
        await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
        await page.click(SELECTORS.submitButton);

        // Capture loading state quickly
        // Note: This may be flaky due to timing
        const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"]');
        if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expect(page).toHaveScreenshot('loading-state-dashboard.png', {
                maxDiffPixelRatio: 0.05, // Higher tolerance for loading states
            });
        }
    });

    test('Empty state - No records', async ({ page }) => {
        // This would need a test user with no records
        // For now, we'll check if empty state exists
        await loginAs(page, 'homeowner');
        await page.click('text=Records, nav a:has-text("Records")');
        await waitForPageStability(page, 'text=/records/i');

        const emptyState = page.locator('text=/no records|get started|add your first/i');
        if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
            await maskDynamicContent(page);
            await expect(page).toHaveScreenshot('empty-state-records.png', {
                maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
            });
        }
    });

    test('Modal - Add record form', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await page.click('text=Records, nav a:has-text("Records")');

        // Open add record modal
        await page.click('button:has-text("Add"), button:has-text("New Record")');

        // Wait for modal
        await page.locator('[role="dialog"], [class*="modal"]').waitFor({ timeout: 5000 });
        await maskDynamicContent(page);

        await expect(page).toHaveScreenshot('modal-add-record.png', {
            maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
        });
    });

    test('Toast notification', async ({ page }) => {
        await loginAs(page, 'homeowner');

        // Trigger a toast by performing an action
        // This depends on app implementation
        await page.click('text=Records, nav a:has-text("Records")');

        // Look for any existing toast or trigger one
        const toast = page.locator('[class*="toast"], [role="alert"], [class*="Toastify"]');
        if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(page).toHaveScreenshot('toast-notification.png', {
                maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
            });
        }
    });
});

// ============================================
// DARK MODE TESTS (if supported)
// ============================================

test.describe('Visual Regression - Dark Mode', () => {
    test.use({
        viewport: VISUAL_TEST_CONFIG.viewports.desktop,
        colorScheme: 'dark',
    });

    test('Auth Screen - Dark mode', async ({ page }) => {
        await page.goto('/');
        await waitForPageStability(page, SELECTORS.emailInput);

        // Check if app supports dark mode
        const isDark = await page.evaluate(() => {
            return document.documentElement.classList.contains('dark') ||
                document.body.classList.contains('dark') ||
                window.matchMedia('(prefers-color-scheme: dark)').matches;
        });

        if (isDark) {
            await maskDynamicContent(page);
            await expect(page).toHaveScreenshot('auth-login-dark.png', {
                maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
            });
        } else {
            test.skip(true, 'Dark mode not supported');
        }
    });

    test('Dashboard - Dark mode', async ({ page }) => {
        await loginAs(page, 'homeowner');
        await waitForPageStability(page, 'text=/dashboard|welcome/i');

        const isDark = await page.evaluate(() => {
            return document.documentElement.classList.contains('dark') ||
                document.body.classList.contains('dark');
        });

        if (isDark) {
            await maskDynamicContent(page);
            await expect(page).toHaveScreenshot('dashboard-dark.png', {
                maxDiffPixelRatio: VISUAL_TEST_CONFIG.screenshotOptions.maxDiffPixelRatio,
            });
        } else {
            test.skip(true, 'Dark mode not supported');
        }
    });
});
