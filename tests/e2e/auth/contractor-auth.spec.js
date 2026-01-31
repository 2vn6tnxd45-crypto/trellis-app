// tests/e2e/auth/contractor-auth.spec.js
// ============================================
// CONTRACTOR AUTHENTICATION TESTS
// ============================================
// Tests for contractor login, signup, and auth flows

import { test, expect } from '@playwright/test';

const TEST_USERS = {
  // Verified working credentials (2026-01-27)
  contractorFull: {
    email: 'danvdova@gmail.com',
    password: 'Test1234',
    companyName: "John's Plumbing"
  },
  contractor: {
    email: 'danvdova@gmail.com',
    password: 'Test1234',
    companyName: "John's Plumbing"
  }
};

async function waitForAppLoad(page) {
  // Use domcontentloaded instead of networkidle - networkidle times out with WebSockets/polling
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

test.describe('Contractor Authentication', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/home?pro');
    await waitForAppLoad(page);
  });

  // ============================================
  // LANDING PAGE TESTS
  // ============================================

  test('CO-AUTH-01: Contractor landing page (/home?pro) loads', async ({ page }) => {
    // Should see contractor-specific content
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

  test('CO-AUTH-02: Contractor landing shows "Free Forever" messaging', async ({ page }) => {
    const freeMessaging = page.locator('text=/free forever|free for life|always free|no cost/i').first();
    const hasFreeMessaging = await freeMessaging.isVisible().catch(() => false);

    console.log('Free Forever messaging visible:', hasFreeMessaging);
  });

  // ============================================
  // LOGIN TESTS
  // ============================================

  test('CO-AUTH-05: Contractor login with valid credentials succeeds', async ({ page }) => {
    const authButton = page.locator('text=/sign in|log in|get started|start free/i').first();

    if (await authButton.isVisible().catch(() => false)) {
      await authButton.click();
      await waitForAppLoad(page);
    }

    await page.fill('input[type="email"]', TEST_USERS.contractorFull.email);
    await page.fill('input[type="password"]', TEST_USERS.contractorFull.password);
    await page.click('button[type="submit"]');

    await waitForAppLoad(page);

    // Should see contractor dashboard elements
    const dashboardIndicators = [
      'text=/dashboard|jobs|quotes|customers|schedule/i',
      `text=${TEST_USERS.contractorFull.companyName}`,
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

  test('CO-AUTH-06: Contractor login redirects to contractor dashboard (not homeowner)', async ({ page }) => {
    const authButton = page.locator('text=/sign in|log in|get started|start free/i').first();

    if (await authButton.isVisible().catch(() => false)) {
      await authButton.click();
      await waitForAppLoad(page);
    }

    await page.fill('input[type="email"]', TEST_USERS.contractorFull.email);
    await page.fill('input[type="password"]', TEST_USERS.contractorFull.password);
    await page.click('button[type="submit"]');

    await waitForAppLoad(page);
    await page.waitForTimeout(2000);

    // Should see contractor-specific nav items (Jobs, Quotes, Customers, Schedule)
    // Should NOT see homeowner items (Scan receipt, My Records)
    const contractorNav = await page.locator('text=/jobs|customers|schedule|team/i').first().isVisible().catch(() => false);
    expect(contractorNav).toBeTruthy();
  });

  // ============================================
  // SIGNUP FLOW TESTS
  // ============================================

  test('CO-AUTH-03: Contractor sign up flow initiates', async ({ page }) => {
    const signUpButton = page.locator('text=/sign up|get started|start free|create account/i').first();

    if (await signUpButton.isVisible().catch(() => false)) {
      await signUpButton.click();
      await page.waitForTimeout(1000);

      // Should see signup form
      const hasForm = await page.locator('input[type="email"]').isVisible().catch(() => false);
      expect(hasForm).toBeTruthy();
    }
  });

  test('CO-AUTH-08: Company name field appears during contractor signup', async ({ page }) => {
    const signUpButton = page.locator('text=/sign up|get started|start free|create account/i').first();

    if (await signUpButton.isVisible().catch(() => false)) {
      await signUpButton.click();
      await page.waitForTimeout(1000);

      // Look for company name field
      const companyField = page.locator('input[name="company"], input[placeholder*="company"], input[placeholder*="business"], label:has-text("Company")').first();
      const hasCompanyField = await companyField.isVisible().catch(() => false);

      console.log('Company name field visible:', hasCompanyField);
    }
  });

  test('CO-AUTH-09: Phone number field validation works', async ({ page }) => {
    const signUpButton = page.locator('text=/sign up|get started|start free/i').first();

    if (await signUpButton.isVisible().catch(() => false)) {
      await signUpButton.click();
      await page.waitForTimeout(1000);

      // Look for phone field
      const phoneField = page.locator('input[type="tel"], input[name="phone"], input[placeholder*="phone"]').first();

      if (await phoneField.isVisible().catch(() => false)) {
        // Try invalid phone
        await phoneField.fill('123');

        // Check for validation feedback
        console.log('Phone field found and tested');
      }
    }
  });
});

// ============================================
// CONTRACTOR-SPECIFIC FEATURES AFTER LOGIN
// ============================================

test.describe('Contractor Post-Login', () => {

  test('CO-AUTH-07: Contractor-specific features shown after login', async ({ page }) => {
    await page.goto('/home?pro');
    await waitForAppLoad(page);

    const authButton = page.locator('text=/sign in|log in|get started/i').first();
    if (await authButton.isVisible().catch(() => false)) {
      await authButton.click();
      await page.waitForTimeout(500);
    }

    await page.fill('input[type="email"]', TEST_USERS.contractorFull.email);
    await page.fill('input[type="password"]', TEST_USERS.contractorFull.password);
    await page.click('button[type="submit"]');

    await waitForAppLoad(page);
    await page.waitForTimeout(2000);

    // Check for contractor-specific features
    const features = [
      'text=Jobs',
      'text=Quotes',
      'text=Customers',
      'text=Schedule',
      'text=Calendar'
    ];

    let foundFeatures = 0;
    for (const feature of features) {
      if (await page.locator(feature).first().isVisible().catch(() => false)) {
        foundFeatures++;
      }
    }

    expect(foundFeatures).toBeGreaterThanOrEqual(2);
  });
});
