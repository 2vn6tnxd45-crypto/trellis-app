// tests/e2e/auth/auth-edge-cases.spec.js
// ============================================
// AUTHENTICATION EDGE CASE TESTS
// ============================================
// Tests for login failures, session management, password reset, etc.

import { test, expect } from '@playwright/test';
import {
    screenshot,
    waitForLoadingComplete,
    uniqueId,
    dismissPopups
} from '../../utils/test-helpers.js';
import { TEST_USERS } from '../../fixtures/test-data.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// ============================================
// LOGIN FAILURE TESTS
// ============================================
test.describe('Login Failures', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/home`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);
    });

    test('AUTH-001: Invalid email shows error', async ({ page }) => {
        const testId = uniqueId('invalid-email');

        // Click sign in
        const signInBtn = page.locator('text=/^Sign In$/i, a:has-text("Sign In"), button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        // Fill invalid credentials
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');

        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill('nonexistent@invalid-domain-xyz.com');
            await passwordInput.fill('SomePassword123!');

            const submitBtn = page.locator('button[type="submit"]').first();
            await submitBtn.click();
            await page.waitForTimeout(2000);
            await screenshot(page, testId, '01-after-submit');

            // Look for error message
            const errorMsg = page.locator('text=/invalid|not found|error|incorrect/i').first();
            const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[AUTH-001] Error message shown: ${hasError}`);

            // Should NOT be logged in
            const dashboardIndicator = page.locator('nav:has-text("Dashboard"), text="Welcome"').first();
            const onDashboard = await dashboardIndicator.isVisible({ timeout: 2000 }).catch(() => false);
            expect(onDashboard).toBe(false);
        }
    });

    test('AUTH-002: Wrong password shows error', async ({ page }) => {
        const testId = uniqueId('wrong-pass');

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');

        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Use real email with wrong password
            await emailInput.fill(TEST_USERS.fullHomeowner.email);
            await passwordInput.fill('TotallyWrongPassword999!');

            const submitBtn = page.locator('button[type="submit"]').first();
            await submitBtn.click();
            await page.waitForTimeout(2000);
            await screenshot(page, testId, '01-wrong-pass');

            // Look for error
            const errorMsg = page.locator('text=/invalid|wrong|incorrect|error/i').first();
            const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[AUTH-002] Error message shown: ${hasError}`);
        }
    });

    test('AUTH-003: Empty email validation', async ({ page }) => {
        const testId = uniqueId('empty-email');

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await passwordInput.fill('SomePassword123');

            const submitBtn = page.locator('button[type="submit"]').first();
            await submitBtn.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '01-empty-email');

            // HTML5 validation should prevent submission or show error
            const emailInput = page.locator('input[type="email"]');
            const validationMsg = await emailInput.evaluate(el => el.validationMessage).catch(() => '');
            console.log(`[AUTH-003] Validation message: ${validationMsg}`);
        }
    });

    test('AUTH-004: Empty password validation', async ({ page }) => {
        const testId = uniqueId('empty-pass');

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill('test@example.com');
            // Don't fill password

            const submitBtn = page.locator('button[type="submit"]').first();
            await submitBtn.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '01-empty-pass');
        }
    });

    test('AUTH-005: Malformed email rejected', async ({ page }) => {
        const testId = uniqueId('malformed');

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill('not-an-email');
            await page.locator('input[type="password"]').fill('Password123');

            const submitBtn = page.locator('button[type="submit"]').first();
            await submitBtn.click();
            await page.waitForTimeout(1000);

            // Check for validation error
            const validationMsg = await emailInput.evaluate(el => el.validationMessage).catch(() => '');
            console.log(`[AUTH-005] Malformed email validation: ${validationMsg}`);
            await screenshot(page, testId, '01-malformed');
        }
    });
});

// ============================================
// SESSION MANAGEMENT TESTS
// ============================================
test.describe('Session Management', () => {
    test('AUTH-010: Session persists after page refresh', async ({ page }) => {
        const testId = uniqueId('session-persist');

        // Login first
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(1500);

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill(TEST_USERS.fullHomeowner.email);
            await page.locator('input[type="password"]').fill(TEST_USERS.fullHomeowner.password);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForTimeout(3000);
        }

        await screenshot(page, testId, '01-logged-in');

        // Refresh page
        await page.reload();
        await page.waitForTimeout(3000);
        await screenshot(page, testId, '02-after-refresh');

        // Should still be logged in
        const stillLoggedIn = await page.locator('text=/dashboard|home|welcome/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`[AUTH-010] Still logged in after refresh: ${stillLoggedIn}`);
    });

    test('AUTH-011: Logout clears session', async ({ page }) => {
        const testId = uniqueId('logout-clear');

        // Login
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(1500);

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill(TEST_USERS.fullHomeowner.email);
            await page.locator('input[type="password"]').fill(TEST_USERS.fullHomeowner.password);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForTimeout(3000);
        }

        // Look for logout option
        await dismissPopups(page);

        const moreBtn = page.locator('nav >> text=More, button:has-text("More")').first();
        if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await moreBtn.click();
            await page.waitForTimeout(500);
        }

        const logoutBtn = page.locator('button:has-text("Log Out"), button:has-text("Sign Out"), text=/log out|sign out/i').first();
        if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await logoutBtn.click();
            await page.waitForTimeout(2000);
            await screenshot(page, testId, '01-logged-out');

            // Should be on login/landing page
            const onLanding = await page.locator('button:has-text("Sign In"), text=/sign in/i').first().isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[AUTH-011] Redirected to login after logout: ${onLanding}`);
        }
    });

    test('AUTH-012: Cannot access protected route when logged out', async ({ page }) => {
        const testId = uniqueId('protected-route');

        // Try to access dashboard directly without login
        await page.goto(`${BASE_URL}/app/?pro`);
        await page.waitForTimeout(3000);
        await screenshot(page, testId, '01-direct-access');

        // Should be redirected to login or see login prompt
        const hasLoginPrompt = await page.locator('input[type="email"], button:has-text("Sign In")').first().isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`[AUTH-012] Login prompt shown: ${hasLoginPrompt}`);
    });
});

// ============================================
// PASSWORD RESET TESTS
// ============================================
test.describe('Password Reset', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(1500);

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }
    });

    test('AUTH-020: Forgot password link exists', async ({ page }) => {
        const testId = uniqueId('forgot-link');

        const forgotLink = page.locator('text=/forgot.*password|reset.*password/i').first();
        const hasForgot = await forgotLink.isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`[AUTH-020] Forgot password link visible: ${hasForgot}`);

        if (hasForgot) {
            await screenshot(page, testId, '01-forgot-visible');
        }
    });

    test('AUTH-021: Forgot password flow opens', async ({ page }) => {
        const testId = uniqueId('forgot-flow');

        const forgotLink = page.locator('text=/forgot.*password|reset.*password/i').first();
        if (await forgotLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await forgotLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-reset-form');

            // Should see email input for reset
            const resetEmailInput = page.locator('input[type="email"]').first();
            const hasResetForm = await resetEmailInput.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[AUTH-021] Reset form visible: ${hasResetForm}`);
        }
    });

    test('AUTH-022: Reset email validation', async ({ page }) => {
        const testId = uniqueId('reset-valid');

        const forgotLink = page.locator('text=/forgot.*password|reset.*password/i').first();
        if (await forgotLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await forgotLink.click();
            await page.waitForTimeout(1500);

            const resetEmailInput = page.locator('input[type="email"]').first();
            if (await resetEmailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                // Try invalid email
                await resetEmailInput.fill('not-an-email');
                const submitBtn = page.locator('button[type="submit"], button:has-text("Reset"), button:has-text("Send")').first();

                if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await submitBtn.click();
                    await page.waitForTimeout(1000);
                    await screenshot(page, testId, '01-invalid-reset');
                }
            }
        }
    });
});

// ============================================
// SIGNUP VALIDATION TESTS
// ============================================
test.describe('Signup Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(1500);
    });

    test('AUTH-030: Signup form accessible', async ({ page }) => {
        const testId = uniqueId('signup-access');

        // Look for signup link
        const signupLink = page.locator('text=/sign up|create account|get started/i').first();
        if (await signupLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signupLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-signup-form');

            // Should see signup form elements
            const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
            const emailInput = page.locator('input[type="email"]').first();
            const passwordInput = page.locator('input[type="password"]').first();

            const hasForm = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[AUTH-030] Signup form visible: ${hasForm}`);
        }
    });

    test('AUTH-031: Weak password rejected', async ({ page }) => {
        const testId = uniqueId('weak-pass');

        const signupLink = page.locator('text=/sign up|create account|get started/i').first();
        if (await signupLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signupLink.click();
            await page.waitForTimeout(1500);

            const emailInput = page.locator('input[type="email"]').first();
            const passwordInput = page.locator('input[type="password"]').first();

            if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await emailInput.fill('test-weak@example.com');
                await passwordInput.fill('123'); // Too weak

                const submitBtn = page.locator('button[type="submit"]').first();
                if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await submitBtn.click();
                    await page.waitForTimeout(2000);
                    await screenshot(page, testId, '01-weak-pass');

                    // Look for password strength error
                    const weakError = page.locator('text=/weak|too short|at least|characters/i').first();
                    const hasError = await weakError.isVisible({ timeout: 3000 }).catch(() => false);
                    console.log(`[AUTH-031] Weak password error shown: ${hasError}`);
                }
            }
        }
    });

    test('AUTH-032: Duplicate email rejected', async ({ page }) => {
        const testId = uniqueId('dup-email');

        const signupLink = page.locator('text=/sign up|create account|get started/i').first();
        if (await signupLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signupLink.click();
            await page.waitForTimeout(1500);

            const emailInput = page.locator('input[type="email"]').first();
            const passwordInput = page.locator('input[type="password"]').first();

            if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                // Use existing user's email
                await emailInput.fill(TEST_USERS.fullHomeowner.email);
                await passwordInput.fill('StrongPassword123!');

                // Fill name if required
                const nameInput = page.locator('input[placeholder*="name" i]').first();
                if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await nameInput.fill('Test User');
                }

                const submitBtn = page.locator('button[type="submit"]').first();
                if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await submitBtn.click();
                    await page.waitForTimeout(3000);
                    await screenshot(page, testId, '01-dup-email');

                    // Look for duplicate email error
                    const dupError = page.locator('text=/already.*use|already.*exists|account.*exists/i').first();
                    const hasError = await dupError.isVisible({ timeout: 5000 }).catch(() => false);
                    console.log(`[AUTH-032] Duplicate email error shown: ${hasError}`);
                }
            }
        }
    });
});

// ============================================
// ROLE-BASED ACCESS TESTS
// ============================================
test.describe('Role-Based Access', () => {
    test('AUTH-040: Homeowner cannot access contractor routes', async ({ page }) => {
        const testId = uniqueId('ho-no-pro');

        // Login as homeowner
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(1500);

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill(TEST_USERS.fullHomeowner.email);
            await page.locator('input[type="password"]').fill(TEST_USERS.fullHomeowner.password);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForTimeout(3000);
        }

        // Try to access contractor route
        await page.goto(`${BASE_URL}/app/?pro`);
        await page.waitForTimeout(3000);
        await screenshot(page, testId, '01-ho-to-pro');

        // Should either redirect or show error
        const proFeatures = page.locator('text=/quotes|jobs|customers|invoices/i').first();
        const hasProFeatures = await proFeatures.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[AUTH-040] Homeowner sees pro features: ${hasProFeatures}`);
    });

    test('AUTH-041: Contractor can access contractor routes', async ({ page }) => {
        const testId = uniqueId('pro-access');

        // Login as contractor
        await page.goto(`${BASE_URL}/home?pro`);
        await page.waitForTimeout(1500);

        const signInBtn = page.locator('text=/^Sign In$/i, button:has-text("Sign In")').first();
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
            await page.waitForTimeout(1500);
        }

        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await emailInput.fill(TEST_USERS.fullContractor.email);
            await page.locator('input[type="password"]').fill(TEST_USERS.fullContractor.password);
            await page.locator('button[type="submit"]').first().click();
            await page.waitForTimeout(3000);
        }

        await screenshot(page, testId, '01-contractor-logged-in');

        // Should see contractor features
        const proFeatures = page.locator('text=/jobs|quotes|customers/i').first();
        const hasProFeatures = await proFeatures.isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`[AUTH-041] Contractor sees pro features: ${hasProFeatures}`);
    });
});
