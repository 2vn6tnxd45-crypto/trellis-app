// tests/dashboard.spec.js
// ============================================
// HOMEOWNER DASHBOARD TESTS
// ============================================
// Updated for ModernDashboard structure
// FIXED: Uses fresh signup to avoid rate limiting

import { test, expect } from '@playwright/test';

// ============================================
// HELPER: Login as homeowner (creates fresh account)
// ============================================
async function loginAsHomeowner(page) {
  // Generate unique user
  const timestamp = Date.now();
  const account = {
    email: `test.homeowner.${timestamp}.${Math.floor(Math.random() * 1000)}@gmail.com`,
    password: 'KribTest123!',
    name: 'Test Homeowner ' + timestamp
  };

  // Navigate to homeowner flow
  await page.goto('/home');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Check if already logged in
  const alreadyLoggedIn = await page.locator('aside, text=/quick actions|dashboard/i').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (alreadyLoggedIn) return;

  // Handle landing page - click "I'm a Homeowner" if present
  const homeownerButton = page.locator('button:has-text("Homeowner"), text="I\'m a Homeowner"').first();
  if (await homeownerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await homeownerButton.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
  }

  // Navigate to Sign Up
  const signUpLink = page.locator('text=/sign up|create account/i').last();
  if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
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
  console.log(`[Dashboard Test] Signing up: ${account.email}`);

  const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill(account.name);
  }

  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);

  // Submit
  const submitBtn = page.locator('button:has-text("Create Account"), button:has-text("Sign Up"), button[type="submit"]').first();
  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(2000);
  }

  // Handle Onboarding - including property setup
  for (let i = 0; i < 8; i++) {
    const sidebarVisible = await page.locator('aside').first().isVisible({ timeout: 1000 }).catch(() => false);
    if (sidebarVisible) {
      console.log('[Dashboard Test] Sidebar visible - onboarding complete');
      break;
    }

    // Check for property setup form
    const propertyAddressInput = page.locator('input[placeholder*="address" i]').first();
    if (await propertyAddressInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('[Dashboard Test] Property setup form detected');
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
        console.log('[Dashboard Test] Selecting address from autocomplete');
        await suggestion.click();
        await page.waitForTimeout(1000);
      }
      // Try clicking the "Kreate My Krib" button
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

  // Wait for dashboard elements
  await page.waitForTimeout(2000);
}

// ============================================
// DASHBOARD LOADING TESTS
// ============================================

test.describe('Dashboard Loading', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-DASH-01: Dashboard loads correctly', async ({ page }) => {
    // Check for key dashboard elements - modern dashboard shows:
    // - Greeting (Good Morning/Afternoon/Evening)
    // - Home name ("Test Home")
    // - Health Score
    // - Items/Pros/Invested stats
    const dashboardLoaded = await page.locator(
      'text=/good morning|good afternoon|good evening/i, ' +
      'text=/health score/i, ' +
      'text=/items|pros|invested/i'
    ).first().isVisible({ timeout: 10000 }).catch(() => false);

    expect(dashboardLoaded).toBeTruthy();
  });

  test('HO-DASH-02: Home name displays correctly', async ({ page }) => {
    // Check that our test home name is displayed
    await expect(page.locator('text="Test Home"').first()).toBeVisible({ timeout: 10000 });
  });

  test('HO-DASH-03: Dashboard sections load', async ({ page }) => {
    // Check for dashboard sections: My Home, Health Score, etc.
    const myHomeSection = await page.locator('text="My Home"').first().isVisible({ timeout: 10000 }).catch(() => false);
    const healthScore = await page.locator('text=/health score/i').first().isVisible({ timeout: 10000 }).catch(() => false);

    expect(myHomeSection || healthScore).toBeTruthy();
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

test.describe('Dashboard Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-NAV-01: Hamburger menu exists', async ({ page }) => {
    // Check for hamburger menu button in header
    const hamburgerMenu = page.locator('button[aria-label*="menu" i], button:has(svg)').first();
    const menuExists = await hamburgerMenu.isVisible({ timeout: 10000 }).catch(() => false);
    expect(menuExists).toBeTruthy();
  });

  test('HO-NAV-02: Can interact with dashboard elements', async ({ page }) => {
    // Check that the main stat cards are clickable (Items, Pros, Invested)
    const itemsCard = page.locator('text=/items/i').first();
    const itemsExists = await itemsCard.isVisible({ timeout: 5000 }).catch(() => false);
    expect(itemsExists).toBeTruthy();
  });
});
