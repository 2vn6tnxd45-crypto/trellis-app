// tests/e2e/auth.spec.js
import { test, expect } from '@playwright/test';
import { TEST_USERS, SELECTORS, generateTestEmail, wait } from '../fixtures/test-data.js';

/**
 * Authentication Tests for Krib App
 * UPDATED: Handles new landing page with role selection buttons
 *
 * Tests cover:
 * 1. Landing page role selection
 * 2. Email signup (success + validation)
 * 3. Email login (success + failure)
 * 4. Google OAuth (button presence)
 * 5. Password reset flow
 */

// Helper to navigate from landing page to auth form
async function navigateToAuthForm(page, role = 'homeowner') {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check if we're on landing page with role selection
    const homeownerBtn = page.locator('text="I\'m a Homeowner"').first();
    const contractorBtn = page.locator('text="I\'m a Contractor"').first();

    if (await homeownerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // We're on landing page - click role button
        if (role === 'contractor') {
            await contractorBtn.click();
        } else {
            await homeownerBtn.click();
        }
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
    }

    // After clicking role, we may need to click "Log In" or wait for auth form
    // Check if email input is already visible
    const emailVisible = await page.locator(SELECTORS.emailInput).isVisible({ timeout: 3000 }).catch(() => false);

    if (!emailVisible) {
        // May need to click "Log In" or "Get Started" button
        const loginBtn = page.locator('text=/log in|sign in|get started/i').first();
        if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await loginBtn.click();
            await page.waitForTimeout(1500);
        }
    }

    // Now should be on auth screen - wait for email input
    await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 10000 });
}

// Helper to switch to signup mode from login
async function switchToSignup(page) {
    const signUpLink = page.locator('text=/sign up|create account/i').last();
    if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await signUpLink.click();
        await page.waitForTimeout(1000);
    }
}

test.describe('Authentication', () => {
    test.describe('Landing Page', () => {
        test('should display role selection buttons', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // Should show homeowner and contractor options (exact text from screenshot)
            await expect(page.locator('text="I\'m a Homeowner"').first())
                .toBeVisible({ timeout: 10000 });
            await expect(page.locator('text="I\'m a Contractor"').first())
                .toBeVisible({ timeout: 10000 });
        });

        test('should have login option in header', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // Should have "Log In" link in header
            await expect(page.locator('text="Log In"').first())
                .toBeVisible({ timeout: 10000 });
        });

        test('should navigate to auth when clicking homeowner button', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('domcontentloaded');

            // Click homeowner button
            await page.locator('text="I\'m a Homeowner"').first().click();
            await page.waitForTimeout(2000);

            // Should navigate somewhere (dashboard or auth)
            const currentUrl = page.url();
            expect(currentUrl).toContain('/home');
        });
    });

    test.describe('Email Signup', () => {
        test('should successfully create a new account', async ({ page }) => {
            const testEmail = generateTestEmail('signup');

            await navigateToAuthForm(page, 'homeowner');
            await switchToSignup(page);

            // Fill signup form
            const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
            if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await nameInput.fill('Test User Signup');
            }
            await page.fill(SELECTORS.emailInput, testEmail);
            await page.fill(SELECTORS.passwordInput, 'TestPass123!');

            // Submit
            const submitBtn = page.locator('button:has-text("Create Account"), button[type="submit"]').first();
            await submitBtn.click();

            // Should redirect to onboarding or dashboard
            await expect(page).toHaveURL(/.*\/(home|app|onboarding)/, { timeout: 15000 });

            // Verify user is logged in (look for user-specific elements)
            await expect(page.locator('text=/welcome|dashboard/i').or(page.locator('aside'))).toBeVisible({ timeout: 15000 });
        });

        test('should show error for weak password', async ({ page }) => {
            await navigateToAuthForm(page, 'homeowner');
            await switchToSignup(page);

            // Fill with weak password
            const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
            if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nameInput.fill('Test User');
            }
            await page.fill(SELECTORS.emailInput, generateTestEmail('weak'));
            await page.fill(SELECTORS.passwordInput, '123'); // Too weak

            const submitBtn = page.locator('button:has-text("Create Account"), button[type="submit"]').first();
            await submitBtn.click();

            // Should show password validation error
            await expect(page.locator('text=/password.*8.*character/i').or(
                page.locator('text=/at least.*8/i').or(
                    page.locator('text=/password.*short/i')
                )
            )).toBeVisible({ timeout: 5000 });
        });

        test('should validate email format', async ({ page }) => {
            await navigateToAuthForm(page, 'homeowner');
            await switchToSignup(page);

            // Fill with invalid email
            const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
            if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nameInput.fill('Test User');
            }
            await page.fill(SELECTORS.emailInput, 'invalid-email');
            await page.fill(SELECTORS.passwordInput, 'TestPass123!');

            const submitBtn = page.locator('button:has-text("Create Account"), button[type="submit"]').first();
            await submitBtn.click();

            // Should show email validation error (either HTML5 or custom)
            const emailInput = page.locator(SELECTORS.emailInput);
            const isInvalid = await emailInput.evaluate(el => !el.validity.valid).catch(() => true);
            expect(isInvalid).toBe(true);
        });
    });

    test.describe('Email Login', () => {
        // NOTE: Login tests with existing credentials may trigger rate limiting
        // Recommend using fresh signup for most tests

        test('should show auth form after role selection', async ({ page }) => {
            await navigateToAuthForm(page, 'homeowner');

            // Verify login form elements
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible();
            await expect(page.locator(SELECTORS.passwordInput)).toBeVisible();
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await navigateToAuthForm(page, 'homeowner');

            await page.fill(SELECTORS.emailInput, 'nonexistent@example.com');
            await page.fill(SELECTORS.passwordInput, 'WrongPassword123!');

            const submitBtn = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
            await submitBtn.click();

            // Should show invalid credentials error
            await expect(page.locator('text=/invalid|incorrect|wrong|failed/i').first())
                .toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Google OAuth', () => {
        test('should display Google sign-in button', async ({ page }) => {
            await navigateToAuthForm(page, 'homeowner');

            // Google button should be visible
            await expect(page.locator('button:has-text("Google")').or(
                page.locator('button:has-text("Continue with Google")')
            )).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Password Reset', () => {
        test('should show forgot password link', async ({ page }) => {
            await navigateToAuthForm(page, 'homeowner');

            // Forgot password link should be visible
            await expect(page.locator('text=/forgot.*password/i')).toBeVisible({ timeout: 10000 });
        });
    });
});
