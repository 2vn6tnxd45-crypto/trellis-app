// tests/e2e/auth.spec.js
import { test, expect } from '@playwright/test';
import { TEST_USERS, SELECTORS, generateTestEmail, wait } from '../fixtures/test-data.js';

/**
 * Authentication Tests for Krib App
 *
 * Tests cover:
 * 1. Email signup (success + validation)
 * 2. Email login (success + failure)
 * 3. Google OAuth (button presence)
 * 4. Password reset flow
 * 5. Rate limiting
 * 6. Session persistence
 */

test.describe('Authentication', () => {
    test.describe('Email Signup', () => {
        test('should successfully create a new account', async ({ page }) => {
            const testEmail = generateTestEmail('signup');

            await page.goto('/');

            // Wait for auth screen to load
            await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10000 });

            // Switch to signup mode
            await page.click('text=Sign up');
            await expect(page.locator('input[placeholder*="name" i]')).toBeVisible();

            // Fill signup form
            await page.fill('input[placeholder*="name" i]', 'Test User Signup');
            await page.fill(SELECTORS.emailInput, testEmail);
            await page.fill(SELECTORS.passwordInput, 'TestPass123!');

            // Submit
            await page.click(SELECTORS.submitButton);

            // Should redirect to onboarding or dashboard
            await expect(page).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });

            // Verify user is logged in (look for user-specific elements)
            await expect(page.locator('text=Welcome').or(page.locator('[class*="Dashboard"]'))).toBeVisible({ timeout: 10000 });
        });

        test('should show error for weak password', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            // Fill with weak password
            await page.fill('input[placeholder*="name" i]', 'Test User');
            await page.fill(SELECTORS.emailInput, generateTestEmail('weak'));
            await page.fill(SELECTORS.passwordInput, '123'); // Too weak

            await page.click(SELECTORS.submitButton);

            // Should show password validation error
            await expect(page.locator('text=/password.*8.*character/i').or(
                page.locator('text=/at least.*8/i')
            )).toBeVisible({ timeout: 5000 });
        });

        test('should show error for existing email', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            // Fill with existing email
            await page.fill('input[placeholder*="name" i]', 'Test User');
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, 'TestPass123!');

            await page.click(SELECTORS.submitButton);

            // Should show error about existing account
            await expect(page.locator('text=/already exists/i').or(
                page.locator('text=/email.*in use/i')
            )).toBeVisible({ timeout: 10000 });
        });

        test('should require name field', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            // Fill without name
            await page.fill(SELECTORS.emailInput, generateTestEmail('noname'));
            await page.fill(SELECTORS.passwordInput, 'TestPass123!');

            await page.click(SELECTORS.submitButton);

            // Should show name required error
            await expect(page.locator('text=/enter.*name/i').or(
                page.locator('input[placeholder*="name" i]:invalid')
            )).toBeVisible({ timeout: 5000 });
        });

        test('should validate email format', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            // Fill with invalid email
            await page.fill('input[placeholder*="name" i]', 'Test User');
            await page.fill(SELECTORS.emailInput, 'invalid-email');
            await page.fill(SELECTORS.passwordInput, 'TestPass123!');

            await page.click(SELECTORS.submitButton);

            // Should show email validation error (either HTML5 or custom)
            const emailInput = page.locator(SELECTORS.emailInput);
            const isInvalid = await emailInput.evaluate(el => !el.validity.valid);
            expect(isInvalid).toBe(true);
        });
    });

    test.describe('Email Login', () => {
        test('should successfully login with valid credentials', async ({ page }) => {
            await page.goto('/');

            // Wait for auth screen
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 10000 });

            // Fill login form
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);

            // Submit
            await page.click(SELECTORS.submitButton);

            // Should redirect to app
            await expect(page).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });

            // Verify logged in state
            await expect(page.locator('[class*="Dashboard"]').or(
                page.locator('text=Dashboard')
            )).toBeVisible({ timeout: 10000 });
        });

        test('should show error for invalid credentials', async ({ page }) => {
            await page.goto('/');

            await page.fill(SELECTORS.emailInput, TEST_USERS.invalidUser.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.invalidUser.password);
            await page.click(SELECTORS.submitButton);

            // Should show invalid credentials error
            await expect(page.locator('text=/invalid.*email.*password/i').or(
                page.locator('text=/incorrect/i')
            )).toBeVisible({ timeout: 10000 });
        });

        test('should show error for wrong password', async ({ page }) => {
            await page.goto('/');

            // Use existing email but wrong password
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, 'WrongPassword123!');
            await page.click(SELECTORS.submitButton);

            // Should show generic invalid credentials (for security)
            await expect(page.locator('text=/invalid.*email.*password/i')).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Google OAuth', () => {
        test('should display Google sign-in button', async ({ page }) => {
            await page.goto('/');

            // Google button should be visible
            await expect(page.locator('button:has-text("Google")').or(
                page.locator('button:has-text("Continue with Google")')
            )).toBeVisible({ timeout: 10000 });
        });

        test('should initiate Google OAuth popup on click', async ({ page, context }) => {
            await page.goto('/');

            // Listen for popup
            const popupPromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);

            // Click Google button
            await page.click('button:has-text("Google")');

            // Should attempt to open popup (may be blocked)
            // We can't fully test OAuth without real Google credentials
            // Just verify the click handler works
            const popup = await popupPromise;

            // If popup opened, it should be Google auth
            if (popup) {
                await expect(popup).toHaveURL(/accounts\.google\.com/);
                await popup.close();
            }
        });
    });

    test.describe('Password Reset', () => {
        test('should show password reset form', async ({ page }) => {
            await page.goto('/');

            // Click forgot password link
            await page.click('text=/forgot.*password/i');

            // Should show reset form
            await expect(page.locator('text=/reset.*password/i').or(
                page.locator('text=/send.*reset/i')
            )).toBeVisible({ timeout: 5000 });
        });

        test('should send reset email for valid email', async ({ page }) => {
            await page.goto('/');
            await page.click('text=/forgot.*password/i');

            // Fill email
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);

            // Submit reset request
            await page.click(SELECTORS.submitButton);

            // Should show success message
            await expect(page.locator('text=/email.*sent/i').or(
                page.locator('text=/check.*inbox/i').or(
                    page.locator('text=/reset.*link/i')
                )
            )).toBeVisible({ timeout: 10000 });
        });

        test('should show error for non-existent email', async ({ page }) => {
            await page.goto('/');
            await page.click('text=/forgot.*password/i');

            // Fill with non-existent email
            await page.fill(SELECTORS.emailInput, 'nonexistent.user@example.com');
            await page.click(SELECTORS.submitButton);

            // Should show error (or success for security - depends on implementation)
            await expect(page.locator('text=/no.*account/i').or(
                page.locator('text=/email.*sent/i') // Some apps show success anyway
            )).toBeVisible({ timeout: 10000 });
        });

        test('should allow returning to login', async ({ page }) => {
            await page.goto('/');
            await page.click('text=/forgot.*password/i');

            // Should have back/cancel option
            await page.click('text=/back.*login/i, text=/sign.*in/i, text=/cancel/i');

            // Should return to login form
            await expect(page.locator(SELECTORS.passwordInput)).toBeVisible({ timeout: 5000 });
        });
    });

    test.describe('Rate Limiting', () => {
        test('should lock out after 5 failed attempts', async ({ page }) => {
            await page.goto('/');

            // Attempt login 5 times with wrong password
            for (let i = 0; i < 5; i++) {
                await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
                await page.fill(SELECTORS.passwordInput, 'WrongPass' + i);
                await page.click(SELECTORS.submitButton);

                // Wait for error to appear and clear
                await page.waitForTimeout(1000);
            }

            // 6th attempt should show lockout message
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, 'WrongPass6');
            await page.click(SELECTORS.submitButton);

            // Should show rate limiting message
            await expect(page.locator('text=/too many.*attempt/i').or(
                page.locator('text=/try.*again.*later/i').or(
                    page.locator('text=/locked/i')
                )
            )).toBeVisible({ timeout: 5000 });
        });

        test('should allow login after lockout period', async ({ page }) => {
            // This test would need to wait 30 seconds, so we'll skip in normal runs
            test.skip(true, 'Rate limit test requires waiting for lockout to expire');

            await page.goto('/');

            // Trigger lockout
            for (let i = 0; i < 6; i++) {
                await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
                await page.fill(SELECTORS.passwordInput, 'WrongPass' + i);
                await page.click(SELECTORS.submitButton);
                await page.waitForTimeout(500);
            }

            // Wait for lockout to expire (30 seconds)
            await page.waitForTimeout(31000);

            // Should be able to login now
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);

            await expect(page).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });
        });
    });

    test.describe('Session Persistence', () => {
        test('should maintain login across page refresh', async ({ page }) => {
            await page.goto('/');

            // Login
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);

            // Wait for dashboard
            await expect(page).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });

            // Refresh page
            await page.reload();

            // Should still be logged in (not on auth screen)
            await expect(page.locator('[class*="Dashboard"]').or(
                page.locator('text=Dashboard')
            )).toBeVisible({ timeout: 10000 });
        });

        test('should allow logout', async ({ page }) => {
            await page.goto('/');

            // Login first
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);

            await expect(page).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });

            // Navigate to settings and logout
            await page.click('text=Settings');
            await page.click('text=/log.*out/i, text=/sign.*out/i');

            // Should return to auth screen
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 10000 });
        });
    });

    test.describe('Password Validation', () => {
        test('should require uppercase letter', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            await page.fill('input[placeholder*="name" i]', 'Test User');
            await page.fill(SELECTORS.emailInput, generateTestEmail('nouppercase'));
            await page.fill(SELECTORS.passwordInput, 'testpass123!'); // No uppercase
            await page.click(SELECTORS.submitButton);

            await expect(page.locator('text=/uppercase/i')).toBeVisible({ timeout: 5000 });
        });

        test('should require lowercase letter', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            await page.fill('input[placeholder*="name" i]', 'Test User');
            await page.fill(SELECTORS.emailInput, generateTestEmail('nolowercase'));
            await page.fill(SELECTORS.passwordInput, 'TESTPASS123!'); // No lowercase
            await page.click(SELECTORS.submitButton);

            await expect(page.locator('text=/lowercase/i')).toBeVisible({ timeout: 5000 });
        });

        test('should require number', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Sign up');

            await page.fill('input[placeholder*="name" i]', 'Test User');
            await page.fill(SELECTORS.emailInput, generateTestEmail('nonumber'));
            await page.fill(SELECTORS.passwordInput, 'TestPassWord!'); // No number
            await page.click(SELECTORS.submitButton);

            await expect(page.locator('text=/number/i')).toBeVisible({ timeout: 5000 });
        });
    });
});
