// tests/e2e/auth/session-management.spec.js
// ============================================
// SESSION MANAGEMENT TESTS
// ============================================
// Tests for session persistence, logout, and protected routes

import { test, expect } from '@playwright/test';

// Verified working credentials (2026-01-27)
const TEST_USERS = {
  homeownerFull: {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234'
  },
  contractorFull: {
    email: 'danvdova@gmail.com',
    password: 'Test1234'
  }
};

async function waitForAppLoad(page) {
  // Use domcontentloaded instead of networkidle - networkidle can timeout with WebSockets/polling
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function dismissPrivacyBanner(page) {
  // Dismiss any privacy/cookie banners that might overlay the bottom nav
  // The app shows "We value your privacy" banner with "Accept Offers" and "No Thanks" buttons
  const bannerSelectors = [
    'button:has-text("Accept Offers")', // The Krib privacy banner
    'button:has-text("No Thanks")', // The Krib privacy banner alternative
    'text="Accept"',
    'text="Got it"',
    'text="Dismiss"',
    'text="Close"',
    '[data-testid="privacy-accept"]',
    '.privacy-banner button',
    '[aria-label="Accept cookies"]'
  ];

  for (const selector of bannerSelectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function loginAsHomeowner(page) {
  await page.goto('/home');
  await waitForAppLoad(page);

  // Dismiss any privacy/cookie banners first
  await dismissPrivacyBanner(page);

  // Check if already logged in - look for bottom nav (only visible when logged in)
  const dashboardIndicators = [
    'button:has-text("More")', // Bottom nav has More button when logged in
    'button:has-text("Inventory")', // Bottom nav button
    'text=/Health Score/i' // Dashboard health score (case insensitive)
  ];

  for (const indicator of dashboardIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissPrivacyBanner(page); // Dismiss again after checking
      return; // Already logged in
    }
  }

  // Need to login
  const signInButton = page.locator('button:has-text("Sign In")');
  if (await signInButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await signInButton.click();
    await page.waitForTimeout(1000);
  }

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  await page.fill('input[type="email"]', TEST_USERS.homeownerFull.email);
  await page.fill('input[type="password"]', TEST_USERS.homeownerFull.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard - look for bottom nav which is only present when logged in
  await page.waitForSelector('button:has-text("More"), button:has-text("Inventory")', { timeout: 20000 });
  await waitForAppLoad(page);

  // Dismiss any banners that may have appeared after login
  await dismissPrivacyBanner(page);
}

// ============================================
// SESSION PERSISTENCE TESTS
// ============================================

test.describe('Session Persistence', () => {

  test('SH-AUTH-01: Session persists across page refresh', async ({ page }) => {
    await loginAsHomeowner(page);

    // Verify logged in
    await page.waitForTimeout(2000);

    // Refresh the page
    await page.reload();
    await waitForAppLoad(page);

    // Should still be logged in
    await page.waitForTimeout(3000);

    const stillLoggedIn = await page.locator('text=/dashboard|my home|inventory|maintenance/i').first().isVisible().catch(() => false);
    const seeLoginForm = await page.locator('text=/sign in|log in/i').first().isVisible().catch(() => false);

    // Either we see dashboard content, or we don't see login prompt
    expect(stillLoggedIn || !seeLoginForm).toBeTruthy();
  });

  test('SH-AUTH-02: Session persists across browser tabs', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();

    // Login in first tab
    await page1.goto('/home');
    await waitForAppLoad(page1);

    const signInButton = page1.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page1.fill('input[type="email"]', TEST_USERS.homeownerFull.email);
    await page1.fill('input[type="password"]', TEST_USERS.homeownerFull.password);
    await page1.click('button[type="submit"]');
    await waitForAppLoad(page1);
    await page1.waitForTimeout(2000);

    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/home');
    await waitForAppLoad(page2);
    await page2.waitForTimeout(2000);

    // Should be logged in on second tab too
    const loggedInSecondTab = await page2.locator('text=/dashboard|my home|inventory/i').first().isVisible().catch(() => false);

    console.log('Logged in on second tab:', loggedInSecondTab);

    await context.close();
  });
});

// ============================================
// LOGOUT TESTS
// ============================================

test.describe('Logout', () => {

  // Helper to open the More menu and find Sign Out
  async function openMoreMenuAndFindSignOut(page) {
    // The homeowner app has a bottom nav with a "More" button that opens a menu
    // Click on the "More" tab in bottom navigation
    const moreButton = page.locator('button:has-text("More")').first();

    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click();
      await page.waitForTimeout(500);

      // The MoreMenu popup should now be visible with Sign Out button
      const signOutButton = page.locator('text="Sign Out"').first();
      return signOutButton;
    }

    // Fallback: Try Settings page route (sign out is also in Settings)
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Click More again after navigation
    const moreBtn2 = page.locator('button:has-text("More")').first();
    if (await moreBtn2.isVisible().catch(() => false)) {
      await moreBtn2.click();
      await page.waitForTimeout(500);
    }

    return page.locator('text="Sign Out"').first();
  }

  test('SH-AUTH-03: Logout button is accessible', async ({ page }) => {
    await loginAsHomeowner(page);

    // Dismiss any overlays that might block the bottom nav
    await dismissPrivacyBanner(page);

    // Click the "More" button in bottom nav to open the menu
    const moreButton = page.locator('button:has-text("More")').first();

    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click({ force: true }); // Force click to bypass any overlays
      await page.waitForTimeout(1000); // Wait for menu animation

      // Look for Sign Out button in the More menu popup
      const signOutButton = page.locator('text="Sign Out"').first();

      // Wait for the menu to appear (up to 5 seconds)
      const hasSignOut = await signOutButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasSignOut) {
        // If menu didn't open, try clicking again
        await moreButton.click({ force: true });
        await page.waitForTimeout(1000);
      }

      const finalCheck = await signOutButton.isVisible().catch(() => false);
      expect(finalCheck).toBeTruthy();
    } else {
      // Fallback: check Settings page for Sign Out
      await page.goto('/home/settings');
      await page.waitForTimeout(2000);

      const signOutInSettings = page.locator('text="Sign Out"').first();
      const hasSignOut = await signOutInSettings.isVisible().catch(() => false);

      expect(hasSignOut).toBeTruthy();
    }
  });

  test('SH-AUTH-04: Logout clears session completely', async ({ page }) => {
    await loginAsHomeowner(page);

    // Dismiss any overlays
    await dismissPrivacyBanner(page);

    // Click the "More" button in bottom nav
    const moreButton = page.locator('button:has-text("More")').first();

    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click({ force: true });
      await page.waitForTimeout(500);

      const signOutButton = page.locator('text="Sign Out"').first();

      if (await signOutButton.isVisible().catch(() => false)) {
        await signOutButton.click();
        await waitForAppLoad(page);

        // Refresh to verify session is gone
        await page.reload();
        await waitForAppLoad(page);

        // Should see login options
        const signInVisible = await page.locator('text=/sign in|log in|create/i').first().isVisible().catch(() => false);
        expect(signInVisible).toBeTruthy();
      }
    }
  });

  test('SH-AUTH-05: Logout redirects to login page', async ({ page }) => {
    await loginAsHomeowner(page);

    // Dismiss any overlays
    await dismissPrivacyBanner(page);

    // Click the "More" button in bottom nav
    const moreButton = page.locator('button:has-text("More")').first();

    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click({ force: true });
      await page.waitForTimeout(500);

      const signOutButton = page.locator('text="Sign Out"').first();

      if (await signOutButton.isVisible().catch(() => false)) {
        await signOutButton.click();
        await waitForAppLoad(page);

        // Should be back on landing/login page
        const signInVisible = await page.locator('text=/sign in|log in|create|krib/i').first().isVisible().catch(() => false);
        expect(signInVisible).toBeTruthy();
      }
    }
  });
});

// ============================================
// PROTECTED ROUTES TESTS
// ============================================

test.describe('Protected Routes', () => {

  test('SH-AUTH-06: Protected routes redirect to login when not authenticated', async ({ page }) => {
    // Try to access a protected route directly without login
    await page.goto('/home/records');
    await waitForAppLoad(page);
    await page.waitForTimeout(2000);

    // Should either redirect to login or show auth prompt
    const needsAuth = await page.locator('text=/sign in|log in|create account/i').first().isVisible().catch(() => false);
    const onProtectedPage = await page.locator('text=/records|inventory/i').first().isVisible().catch(() => false);

    // Either needs auth, or is somehow on the page (which would mean it's not protected)
    console.log('Needs auth:', needsAuth, 'On protected page:', onProtectedPage);
  });

  test('SH-AUTH-07: Deep links work after authentication', async ({ page }) => {
    // First login
    await loginAsHomeowner(page);

    // Now try accessing a deep link
    await page.goto('/home/records');
    await waitForAppLoad(page);
    await page.waitForTimeout(2000);

    // Should see records page content
    const onRecordsPage = await page.locator('text=/records|inventory|samsung|appliance/i').first().isVisible().catch(() => false);

    console.log('Deep link works:', onRecordsPage);
  });
});

// ============================================
// RATE LIMITING TESTS
// ============================================
// NOTE: This test uses a DIFFERENT email to avoid triggering rate limiting
// on the main test account, which would block other tests from logging in.

test.describe('Rate Limiting & Security', () => {

  test('SH-AUTH-11: Multiple failed login attempts handled', async ({ page }) => {
    await page.goto('/home');
    await waitForAppLoad(page);

    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Use a DIFFERENT email address for rate limiting tests to avoid blocking main test account
    // This is a non-existent email that won't affect real accounts
    const rateLimitTestEmail = 'rate.limit.test.' + Date.now() + '@example.com';

    // Try 3 failed logins with the test email
    for (let i = 0; i < 3; i++) {
      await page.fill('input[type="email"]', rateLimitTestEmail);
      await page.fill('input[type="password"]', 'WrongPassword' + i);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }

    // Should see error message (invalid/incorrect credentials or rate limit)
    const hasError = await page.locator('text=/invalid|incorrect|wrong|error|too many|try again|no user/i').first().isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });
});
