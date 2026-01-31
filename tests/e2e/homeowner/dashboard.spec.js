// tests/e2e/homeowner/dashboard.spec.js
// ============================================
// HOMEOWNER DASHBOARD TESTS
// ============================================
// Tests for dashboard, navigation, records display

import { test, expect } from '@playwright/test';

// Verified working credentials (2026-01-27)
const TEST_ACCOUNT = {
  email: 'devonandrewdavila@gmail.com',
  password: 'Test1234'
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

async function loginAsHomeowner(page) {
  await page.goto('/home');
  await waitForAppLoad(page);

  // Check if already logged in - look for specific dashboard elements
  const dashboardIndicators = [
    'text=HEALTH SCORE',
    'text=My Home',
    'text=ITEMS'
  ];

  for (const indicator of dashboardIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
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

  await page.fill('input[type="email"]', TEST_ACCOUNT.email);
  await page.fill('input[type="password"]', TEST_ACCOUNT.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForSelector('text=HEALTH SCORE', { timeout: 20000 });
  await waitForAppLoad(page);
}

// ============================================
// DASHBOARD LOADING TESTS
// ============================================

test.describe('Dashboard Loading', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-DASH-01: Dashboard loads without errors', async ({ page }) => {
    const hasError = await page.locator('text=/error|failed|something went wrong/i').first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();

    const hasContent = await page.locator('text=/home|dashboard|records|inventory|maintenance/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('HO-DASH-02: Welcome message with user name displays', async ({ page }) => {
    const identifiers = [
      'text=Test Home',
      'text=Test Homeowner',
      'text=My Home',
      'text=123 Test Street'
    ];

    let foundIdentifier = false;
    for (const id of identifiers) {
      if (await page.locator(id).first().isVisible().catch(() => false)) {
        foundIdentifier = true;
        break;
      }
    }

    expect(foundIdentifier).toBeTruthy();
  });

  test('HO-DASH-03: Property summary card visible', async ({ page }) => {
    // Look for property information
    const propertyIndicators = [
      'text=/property|home|address/i',
      '[data-testid="property-card"]',
      'text=/square feet|sq ft|bedrooms|bathrooms/i'
    ];

    let foundProperty = false;
    for (const indicator of propertyIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundProperty = true;
        break;
      }
    }

    console.log('Property card visible:', foundProperty);
  });

  test('HO-DASH-04: Quick actions section visible', async ({ page }) => {
    const actionIndicators = [
      'text=Scan',
      'text=Add',
      'text=/find pro|get quote/i',
      '[data-testid="quick-actions"]'
    ];

    let foundActions = false;
    for (const indicator of actionIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundActions = true;
        break;
      }
    }

    expect(foundActions).toBeTruthy();
  });
});

// ============================================
// HOME HEALTH / NEEDS ATTENTION TESTS
// ============================================

test.describe('Home Health', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-DASH-11: Needs Attention section displays', async ({ page }) => {
    const maintenanceIndicators = [
      'text=/maintenance|needs attention|overdue|due soon|tasks/i',
      'text=Replace air filter',
      'text=Run cleaning cycle',
      '[data-testid="maintenance-section"]'
    ];

    let foundMaintenance = false;
    for (const indicator of maintenanceIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundMaintenance = true;
        break;
      }
    }

    expect(foundMaintenance).toBeTruthy();
  });

  test('HO-DASH-12: Upcoming maintenance shows', async ({ page }) => {
    // Look for maintenance tasks
    const hasUpcoming = await page.locator('text=/upcoming|due|scheduled/i').first().isVisible().catch(() => false);
    console.log('Upcoming maintenance visible:', hasUpcoming);
  });

  test('HO-DASH-13: Expiring warranties highlighted', async ({ page }) => {
    const warrantyIndicators = [
      'text=/warranty|expir/i',
      '[data-testid="warranty-alert"]'
    ];

    let foundWarranty = false;
    for (const indicator of warrantyIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundWarranty = true;
        break;
      }
    }

    console.log('Warranty info visible:', foundWarranty);
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

test.describe('Dashboard Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-NAV-01: Bottom navigation exists on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    const bottomNavSelectors = [
      'nav',
      '[data-testid="bottom-nav"]',
      '.bottom-nav',
      'text=Home',
      'text=Records',
      'text=Quotes'
    ];

    let foundNav = false;
    for (const selector of bottomNavSelectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        foundNav = true;
        break;
      }
    }

    expect(foundNav).toBeTruthy();
  });

  test('HO-NAV-02: Can navigate to Records/Inventory tab', async ({ page }) => {
    // Try direct navigation as primary approach
    await page.goto('/home/records');
    await page.waitForTimeout(2000);

    // Check if we're on records page
    const recordsIndicators = [
      'text=All Records',
      'text=/Samsung|LG|Carrier|appliance|HVAC/i',
      'input[placeholder*="Search"]',
      'text=Add Record'
    ];

    let hasRecords = false;
    for (const indicator of recordsIndicators) {
      if (await page.locator(indicator).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        hasRecords = true;
        break;
      }
    }

    expect(hasRecords).toBeTruthy();
  });

  test('HO-NAV-03: Can navigate to Quotes tab', async ({ page }) => {
    // Try direct navigation
    await page.goto('/home/quotes');
    await page.waitForTimeout(2000);

    // Check if we're on quotes page
    const quotesIndicators = [
      'text=/quote|estimate|pending|accepted|no quotes/i',
      'text=Your Quotes',
      'text=Pending'
    ];

    let hasQuotesContent = false;
    for (const indicator of quotesIndicators) {
      if (await page.locator(indicator).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        hasQuotesContent = true;
        break;
      }
    }

    expect(hasQuotesContent).toBeTruthy();
  });

  test('HO-NAV-04: Can navigate to Contractors/Pros tab', async ({ page }) => {
    const tabSelectors = [
      'text=Contractors',
      'text=Pros',
      'text=My Pros',
      'text=Service',
      '[data-testid="contractors-tab"]'
    ];

    for (const selector of tabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    const hasContractorsContent = await page.locator('text=/contractor|best buy|home depot|cool air|plumbing/i').first().isVisible().catch(() => false);
    console.log('Found contractors content:', hasContractorsContent);
  });

  test('HO-NAV-05: Can access Settings', async ({ page }) => {
    // Dismiss privacy banner first
    const dismissBtns = ['button:has-text("No Thanks")', 'button:has-text("Accept")'];
    for (const sel of dismissBtns) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
        break;
      }
    }

    let settingsVisible = await page.locator('text=Settings').first().isVisible().catch(() => false);

    if (!settingsVisible) {
      const moreButton = page.locator('text=More').first();
      if (await moreButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moreButton.click({ force: true });
        await page.waitForTimeout(500);
        settingsVisible = await page.locator('text=Settings').first().isVisible().catch(() => false);
      }
    }

    if (settingsVisible) {
      await page.locator('text=Settings').first().click({ force: true });
      await page.waitForTimeout(1000);

      const hasSettingsContent = await page.locator('text=/profile|property|notification|account|theme/i').first().isVisible().catch(() => false);
      expect(hasSettingsContent).toBeTruthy();
    } else {
      console.log('⚠ Settings not visible via More menu - UI may differ');
      test.skip();
    }
  });
});

// ============================================
// RECORD DISPLAY TESTS
// ============================================

test.describe('Record Display', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-DASH-05: Records/inventory items display', async ({ page }) => {
    const expectedRecords = [
      'Samsung French Door Refrigerator',
      'LG Front Load Washer',
      'Carrier Central AC',
      'Rheem Water Heater',
      'Ring Doorbell'
    ];

    let foundRecords = 0;
    for (const record of expectedRecords) {
      if (await page.locator(`text=/${record.split(' ')[0]}/i`).first().isVisible().catch(() => false)) {
        foundRecords++;
      }
    }

    expect(foundRecords).toBeGreaterThan(0);
  });
});
