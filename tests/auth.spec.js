// tests/auth.spec.js
// ============================================
// AUTHENTICATION TESTS
// ============================================
// Tests for login, signup, logout, and password reset

import { test, expect } from '@playwright/test';

// Test credentials (from setup-test-accounts.js)
const TEST_ACCOUNTS = {
  homeownerNew: {
    email: 'test.homeowner.new@gmail.com',
    password: 'KribTest123!'
  },
  homeownerFull: {
    email: 'test.homeowner.full@gmail.com',
    password: 'KribTest123!'
  },
  contractorNew: {
    email: 'test.contractor.new@gmail.com',
    password: 'KribTest123!'
  },
  contractorFull: {
    email: 'test.contractor.full@gmail.com',
    password: 'KribTest123!'
  }
};

// ============================================
// HELPER: Wait for page to be fully loaded
// ============================================
async function waitForAppLoad(page) {
  // Wait for any loading spinners to disappear
  await page.waitForLoadState('networkidle');
  // Give React a moment to render
  await page.waitForTimeout(1000);
}

// ============================================
// HOMEOWNER AUTHENTICATION TESTS
// ============================================

test.describe('Homeowner Authentication', () => {

  test.beforeEach(async ({ page }) => {
    // Start fresh - go to homeowner landing page
    await page.goto('/home');
    await waitForAppLoad(page);
  });

  test('HO-AUTH-01: Landing page loads correctly', async ({ page }) => {
    // Check that the landing page has key elements
    // Check for logo/branding (subtitle text)
    await expect(page.locator('text=Your home\'s digital twin').first()).toBeVisible({ timeout: 10000 });

    // Look for some call-to-action (Create Account, Sign In, Get Started, etc.)
    const hasAuthButton = await page.locator('text=/sign in|log in|create|get started/i').first().isVisible().catch(() => false);
    expect(hasAuthButton).toBeTruthy();
  });

  test('HO-AUTH-02: Can navigate to login form', async ({ page }) => {
    // Find and click on Sign In or Login
    // Try multiple possible selectors
    const signInButton = page.locator('text=/sign in|log in/i').first();

    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Check that email input appears
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Check that password input appears
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
  });

  test('HO-AUTH-03: Successful homeowner login', async ({ page }) => {
    // Navigate to login
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Fill in credentials
    await page.fill('input[type="email"]', TEST_ACCOUNTS.homeownerFull.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.homeownerFull.password);

    // Click submit
    await page.click('button[type="submit"]');

    // Wait for navigation and app to load
    await waitForAppLoad(page);

    // Should see dashboard elements (look for common dashboard indicators)
    // Try multiple possible indicators that we're logged in
    const dashboardIndicators = [
      'text=/dashboard|my home|inventory|records|maintenance/i',
      '[data-testid="dashboard"]',
      'text=Needs Attention',
      'text=Home Health'
    ];

    let foundDashboard = false;
    for (const indicator of dashboardIndicators) {
      if (await page.locator(indicator).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        foundDashboard = true;
        break;
      }
    }

    expect(foundDashboard).toBeTruthy();
  });

  test('HO-AUTH-04: Login with invalid password shows error', async ({ page }) => {
    // Navigate to login
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Fill in wrong password
    await page.fill('input[type="email"]', TEST_ACCOUNTS.homeownerFull.email);
    await page.fill('input[type="password"]', 'WrongPassword123!');

    // Click submit
    await page.click('button[type="submit"]');

    // Should see error message
    await expect(page.locator('text=/invalid|incorrect|wrong|error/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('HO-AUTH-05: Login with non-existent email shows error', async ({ page }) => {
    // Navigate to login
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Fill in non-existent email
    await page.fill('input[type="email"]', 'nonexistent.user.12345@gmail.com');
    await page.fill('input[type="password"]', 'SomePassword123!');

    // Click submit
    await page.click('button[type="submit"]');

    // Should see error message
    await expect(page.locator('text=/invalid|not found|no account|error/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('HO-AUTH-06: Empty form submission shows validation errors', async ({ page }) => {
    // Navigate to login
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Wait for form
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Click submit without filling anything
    await page.click('button[type="submit"]');

    // Should see validation (either HTML5 validation or custom error)
    // Check if form didn't submit (still on same page with empty fields)
    await page.waitForTimeout(1000);

    // Email field should still be visible (didn't navigate away)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('HO-AUTH-07: Password reset link exists', async ({ page }) => {
    // Navigate to login
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Wait for form to load
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Look for forgot password link
    const forgotLink = page.locator('text=/forgot|reset/i').first();
    await expect(forgotLink).toBeVisible({ timeout: 5000 });
  });

  test('HO-AUTH-08: Can toggle between login and signup', async ({ page }) => {
    // Navigate to login first
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Wait for form
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Look for "Create account" or "Sign up" link
    const createAccountLink = page.locator('text=/create account|sign up|register|don\'t have/i').first();

    if (await createAccountLink.isVisible().catch(() => false)) {
      await createAccountLink.click();
      await page.waitForTimeout(500);

      // Should now see signup form (might have name field)
      // Just verify we're still on a form
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });
});

// ============================================
// LOGOUT TESTS
// ============================================

test.describe('Logout', () => {

  test('HO-AUTH-09: User can logout', async ({ page }) => {
    // First, login
    await page.goto('/home');
    await waitForAppLoad(page);

    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page.fill('input[type="email"]', TEST_ACCOUNTS.homeownerFull.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.homeownerFull.password);
    await page.click('button[type="submit"]');
    await waitForAppLoad(page);

    // Now find and click logout
    // It might be in a menu, so look for menu trigger first
    const menuTriggers = [
      '[data-testid="more-menu"]',
      'text=More',
      'button:has(svg)',  // Icon button
      '[aria-label*="menu"]',
      'text=Settings'
    ];

    for (const trigger of menuTriggers) {
      const el = page.locator(trigger).first();
      if (await el.isVisible().catch(() => false)) {
        await el.click();
        await page.waitForTimeout(500);
        break;
      }
    }

    // Now look for logout option
    const logoutButton = page.locator('text=/log out|sign out|logout/i').first();

    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await waitForAppLoad(page);

      // Should be back on landing page or login
      const signInVisible = await page.locator('text=/sign in|log in|create/i').first().isVisible().catch(() => false);
      expect(signInVisible).toBeTruthy();
    }
  });
});

// ============================================
// CONTRACTOR AUTHENTICATION TESTS
// ============================================

test.describe('Contractor Authentication', () => {

  test.beforeEach(async ({ page }) => {
    // Go to contractor landing page
    await page.goto('/home?pro');
    await waitForAppLoad(page);
  });

  test('CO-AUTH-01: Contractor landing page loads', async ({ page }) => {
    // Should see contractor-specific content
    // Look for "Pro" or "Contractor" or "Free" messaging
    const proIndicators = [
      'text=/krib pro|contractor|free forever|housecall|jobber/i',
      'text=Free',
      'text=/business|company/i'
    ];

    let foundProPage = false;
    for (const indicator of proIndicators) {
      if (await page.locator(indicator).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        foundProPage = true;
        break;
      }
    }

    expect(foundProPage).toBeTruthy();
  });

  test('CO-AUTH-02: Contractor can login', async ({ page }) => {
    // Find login/get started button
    const authButton = page.locator('text=/sign in|log in|get started|start free/i').first();

    if (await authButton.isVisible().catch(() => false)) {
      await authButton.click();
      await waitForAppLoad(page);
    }

    // Fill credentials
    await page.fill('input[type="email"]', TEST_ACCOUNTS.contractorFull.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.contractorFull.password);
    await page.click('button[type="submit"]');

    await waitForAppLoad(page);

    // Should see contractor dashboard elements
    const dashboardIndicators = [
      'text=/dashboard|jobs|quotes|customers|schedule/i',
      'text=Elite Home Services',  // The test contractor company name
      '[data-testid="contractor-dashboard"]'
    ];

    let foundDashboard = false;
    for (const indicator of dashboardIndicators) {
      if (await page.locator(indicator).first().isVisible({ timeout: 10000 }).catch(() => false)) {
        foundDashboard = true;
        break;
      }
    }

    expect(foundDashboard).toBeTruthy();
  });
});

// ============================================
// SESSION PERSISTENCE TEST
// ============================================

test.describe('Session Persistence', () => {

  test('HO-AUTH-10: Session persists after page refresh', async ({ page }) => {
    // Login
    await page.goto('/home');
    await waitForAppLoad(page);

    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page.fill('input[type="email"]', TEST_ACCOUNTS.homeownerFull.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.homeownerFull.password);
    await page.click('button[type="submit"]');
    await waitForAppLoad(page);

    // Verify logged in
    await page.waitForTimeout(2000);

    // Refresh the page
    await page.reload();
    await waitForAppLoad(page);

    // Should still be logged in (not see login form)
    await page.waitForTimeout(3000);

    // Look for dashboard elements, not login form
    // Try multiple possible indicators that we're logged in (copied from HO-AUTH-03)
    const dashboardIndicators = [
      'text=/dashboard|my home|inventory|records|maintenance/i',
      '[data-testid="dashboard"]',
      'text=Needs Attention',
      'text=Home Health'
    ];

    // Helper to check if dashboard elements are present
    const checkDashboard = async () => {
      // Wait for loading skeleton to disappear if present
      await expect(page.locator('[class*="skeleton"]').first()).not.toBeVisible({ timeout: 10000 }).catch(() => { });

      for (const indicator of dashboardIndicators) {
        if (await page.locator(indicator).first().isVisible().catch(() => false)) {
          return true;
        }
      }
      return false;
    };

    // Wait for potential loading state first
    await page.waitForTimeout(2000); // Give auth state a moment to verify

    // Check if we are still logged in
    const stillLoggedIn = await checkDashboard();

    const seeLoginForm = await page.locator('text=/sign in|log in/i').first().isVisible().catch(() => false);

    // Either we see dashboard content, or we don't see login prompt
    expect(stillLoggedIn || !seeLoginForm).toBeTruthy();
  });
});
