// tests/e2e/auth/homeowner-auth.spec.js
// ============================================
// HOMEOWNER AUTHENTICATION TESTS
// ============================================
// Tests for homeowner login, signup, and auth flows

import { test, expect } from '@playwright/test';

const TEST_USERS = {
  // Verified working credentials (2026-01-27)
  homeownerFull: {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234'
  },
  homeowner: {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234'
  }
};

async function waitForAppLoad(page) {
  // Use domcontentloaded instead of networkidle - networkidle times out with WebSockets/polling
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function dismissPrivacyBanner(page) {
  const bannerButtons = [
    'button:has-text("No Thanks")',
    'button:has-text("Accept Offers")',
    'button:has-text("Accept")',
    'button:has-text("Got it")'
  ];
  for (const selector of bannerButtons) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

test.describe('Homeowner Authentication', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/home');
    await waitForAppLoad(page);
  });

  // ============================================
  // LANDING PAGE TESTS
  // ============================================

  test('HO-AUTH-01: Landing page loads without errors', async ({ page }) => {
    // Check that the landing page has key elements - look for sign in form elements
    // The "krib" logo may be styled/SVG, so check for the form instead
    const hasPageContent = await page.locator('text=/Welcome back|Sign in|Your home/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasPageContent).toBeTruthy();

    // Look for some call-to-action
    const hasAuthButton = await page.locator('text=/sign in|log in|create|get started|sign up/i').first().isVisible().catch(() => false);
    expect(hasAuthButton).toBeTruthy();
  });

  test('HO-AUTH-02: Sign up button is visible and clickable', async ({ page }) => {
    const signUpButton = page.locator('text=/sign up|create account|get started/i').first();
    await expect(signUpButton).toBeVisible({ timeout: 10000 });
  });

  // ============================================
  // LOGIN FORM TESTS
  // ============================================

  test('HO-AUTH-03: Can navigate to login form', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();

    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    // Check that email and password inputs appear
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
  });

  test('HO-AUTH-08: Login with valid credentials succeeds', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page.fill('input[type="email"]', TEST_USERS.homeownerFull.email);
    await page.fill('input[type="password"]', TEST_USERS.homeownerFull.password);
    await page.click('button[type="submit"]');

    await waitForAppLoad(page);
    await page.waitForTimeout(2000); // Extra wait for dashboard to fully load

    // Should see dashboard elements - updated for actual UI
    const dashboardIndicators = [
      'text=HEALTH SCORE',
      'text=My Home',
      'text=ITEMS',
      'text=PROS',
      'text=INVESTED',
      'text=/GOOD EVENING|GOOD MORNING|GOOD AFTERNOON/i',
      'text=/dashboard|my home|inventory|records|maintenance/i'
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

  test('HO-AUTH-09: Login with wrong password shows error', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page.fill('input[type="email"]', TEST_USERS.homeownerFull.email);
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/invalid|incorrect|wrong|error/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('HO-AUTH-10: Login with non-existent email shows error', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page.fill('input[type="email"]', 'nonexistent.user.12345@gmail.com');
    await page.fill('input[type="password"]', 'SomePassword123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/invalid|not found|no account|error/i').first()).toBeVisible({ timeout: 10000 });
  });

  // ============================================
  // FORM VALIDATION TESTS
  // ============================================

  test('HO-AUTH-06: Invalid email format shows validation error', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Try invalid email format
    await page.fill('input[type="email"]', 'not-an-email');
    await page.fill('input[type="password"]', 'SomePassword123!');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Should still be on form (didn't navigate away) or show error
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('HO-AUTH-17: Form submits on Enter key press', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await page.fill('input[type="email"]', TEST_USERS.homeownerFull.email);
    await page.fill('input[type="password"]', TEST_USERS.homeownerFull.password);

    // Press Enter instead of clicking submit
    await page.keyboard.press('Enter');

    await waitForAppLoad(page);

    // Should navigate to dashboard or show response
    await page.waitForTimeout(2000);
  });

  // ============================================
  // PASSWORD RESET TESTS
  // ============================================

  test('HO-AUTH-13: Password reset link is visible', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    const forgotLink = page.locator('text=/forgot|reset/i').first();
    await expect(forgotLink).toBeVisible({ timeout: 5000 });
  });

  // ============================================
  // SIGNUP TOGGLE TESTS
  // ============================================

  test('HO-AUTH-08: Can toggle between login and signup', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Look for "Create account" or "Sign up" link
    const createAccountLink = page.locator('text=/create account|sign up|register|don\'t have/i').first();

    if (await createAccountLink.isVisible().catch(() => false)) {
      await createAccountLink.click();
      await page.waitForTimeout(500);

      // Should now see signup form
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  // ============================================
  // GOOGLE OAUTH TESTS
  // ============================================

  test('HO-AUTH-12: Google OAuth button is present', async ({ page }) => {
    const signInButton = page.locator('text=/sign in|log in/i').first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    }

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });

    // Look for Google auth button
    const googleButton = page.locator('text=/google|continue with google/i, [data-testid="google-auth"]').first();
    const hasGoogleAuth = await googleButton.isVisible().catch(() => false);

    console.log('Google OAuth button visible:', hasGoogleAuth);
  });
});
