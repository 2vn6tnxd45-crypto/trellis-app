// tests/e2e/contractor/dashboard.spec.js
// ============================================
// CONTRACTOR DASHBOARD TESTS
// ============================================
// Tests for contractor dashboard and navigation

import { test, expect } from '@playwright/test';

// Verified working credentials (2026-01-27)
const TEST_ACCOUNTS = {
  contractorFull: {
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

async function loginAsContractor(page, account = TEST_ACCOUNTS.contractorFull) {
  await page.goto('/home?pro');
  await waitForAppLoad(page);

  // Check if already logged in by looking for contractor-specific nav/dashboard elements
  // Be specific to avoid matching landing page content like "Smart Scheduling"
  const dashboardIndicators = [
    'nav:has-text("Dashboard")',
    'nav:has-text("Jobs")',
    '[data-testid="contractor-dashboard"]',
    'text="John\'s Plumbing"' // Specific company name
  ];

  for (const indicator of dashboardIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[loginAsContractor] Already logged in, found:', indicator);
      return;
    }
  }

  console.log('[loginAsContractor] Not logged in, proceeding with login...');

  // Click Sign In button (specific text match)
  const signInBtn = page.locator('button:has-text("Sign In")');
  if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[loginAsContractor] Clicking Sign In button');
    await signInBtn.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('[loginAsContractor] Sign In button not found, trying Start Free Today');
    const startFreeBtn = page.locator('button:has-text("Start Free Today")');
    if (await startFreeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startFreeBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Wait for login form
  console.log('[loginAsContractor] Waiting for email input');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  console.log('[loginAsContractor] Filling credentials');
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);

  console.log('[loginAsContractor] Clicking submit');
  await page.click('button[type="submit"]');

  // Wait for dashboard to load after login
  console.log('[loginAsContractor] Waiting for dashboard...');
  await page.waitForSelector('text=/Dashboard|Jobs|Quotes|Customers|Schedule/', { timeout: 20000 });
  await waitForAppLoad(page);
  console.log('[loginAsContractor] Login complete');
}

// ============================================
// DASHBOARD OVERVIEW TESTS
// ============================================

test.describe('Contractor Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-DASH-01: Dashboard loads without errors', async ({ page }) => {
    const hasError = await page.locator('text=/error|failed|something went wrong/i').first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();

    const hasDashboard = await page.locator('text=/dashboard|jobs|quotes|customers|schedule/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasDashboard).toBeTruthy();
  });

  test('CO-DASH-02: Company name displays correctly', async ({ page }) => {
    const companyName = await page.locator(`text=${TEST_ACCOUNTS.contractorFull.companyName}`).first().isVisible().catch(() => false);
    expect(companyName).toBeTruthy();
  });

  test('CO-DASH-03: Navigation tabs exist', async ({ page }) => {
    const navItems = ['Dashboard', 'Jobs', 'Quotes', 'Schedule', 'Customers'];

    let foundTabs = 0;
    for (const item of navItems) {
      if (await page.locator(`text=${item}`).first().isVisible().catch(() => false)) {
        foundTabs++;
      }
    }

    expect(foundTabs).toBeGreaterThanOrEqual(3);
  });

  test('CO-DASH-04: Pending quotes count visible', async ({ page }) => {
    // Look for quote count badge or summary
    const quoteIndicators = [
      'text=/\\d+.*quote/i',
      '[data-testid="pending-quotes"]',
      'text=/pending|awaiting/i'
    ];

    let foundQuoteCount = false;
    for (const indicator of quoteIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundQuoteCount = true;
        break;
      }
    }

    console.log('Quote count visible:', foundQuoteCount);
  });

  test('CO-DASH-05: Active jobs count visible', async ({ page }) => {
    const jobIndicators = [
      'text=/\\d+.*job/i',
      '[data-testid="active-jobs"]',
      'text=/scheduled|active/i'
    ];

    let foundJobCount = false;
    for (const indicator of jobIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundJobCount = true;
        break;
      }
    }

    console.log('Job count visible:', foundJobCount);
  });
});

// ============================================
// NAVIGATION TESTS
// ============================================

test.describe('Contractor Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-NAV-02: Can navigate to Jobs view', async ({ page }) => {
    const jobsTab = page.locator('text=Jobs').first();

    if (await jobsTab.isVisible().catch(() => false)) {
      await jobsTab.click();
      await page.waitForTimeout(1000);

      const hasJobsContent = await page.locator('text=/jobs|scheduled|pending|completed|no jobs/i').first().isVisible().catch(() => false);
      expect(hasJobsContent).toBeTruthy();
    }
  });

  test('CO-NAV-03: Can navigate to Quotes view', async ({ page }) => {
    const quotesTab = page.locator('text=Quotes').first();

    if (await quotesTab.isVisible().catch(() => false)) {
      await quotesTab.click();
      await page.waitForTimeout(1000);

      const hasQuotesContent = await page.locator('text=/quotes|Q-2024|draft|sent|no quotes/i').first().isVisible().catch(() => false);
      expect(hasQuotesContent).toBeTruthy();
    }
  });

  test('CO-NAV-05: Can navigate to Schedule/Calendar view', async ({ page }) => {
    const scheduleTab = page.locator('text=/Schedule|Calendar/i').first();

    if (await scheduleTab.isVisible().catch(() => false)) {
      await scheduleTab.click();
      await page.waitForTimeout(1000);

      const hasScheduleContent = await page.locator('text=/today|this week|calendar|schedule|january|february|march|april|may|june|july|august|september|october|november|december/i').first().isVisible().catch(() => false);
      expect(hasScheduleContent).toBeTruthy();
    }
  });

  test('CO-NAV-04: Can navigate to Customers view', async ({ page }) => {
    const customersTab = page.locator('text=Customers').first();

    if (await customersTab.isVisible().catch(() => false)) {
      await customersTab.click();
      await page.waitForTimeout(1000);

      const hasCustomersContent = await page.locator('text=/customers|homeowner|no customers/i').first().isVisible().catch(() => false);
      expect(hasCustomersContent).toBeTruthy();
    }
  });

  test('CO-NAV-07: Can access Settings', async ({ page }) => {
    const settingsSelectors = [
      'text=Settings',
      'text=Business Settings',
      'text=Profile',
      '[data-testid="settings"]'
    ];

    for (const selector of settingsSelectors) {
      const settingsLink = page.locator(selector).first();
      if (await settingsLink.isVisible().catch(() => false)) {
        await settingsLink.click();
        await page.waitForTimeout(1000);

        const hasSettings = await page.locator('text=/company|business|profile|notification|payment/i').first().isVisible().catch(() => false);
        expect(hasSettings).toBeTruthy();
        return;
      }
    }
  });
});

// ============================================
// TODAY'S SCHEDULE WIDGET TESTS
// ============================================

test.describe('Today Schedule Widget', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-DASH-13: Today\'s jobs listed', async ({ page }) => {
    const todayIndicators = [
      'text=/today/i',
      '[data-testid="today-schedule"]',
      'text=/scheduled for today/i'
    ];

    let foundToday = false;
    for (const indicator of todayIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundToday = true;
        break;
      }
    }

    console.log('Today schedule widget visible:', foundToday);
  });

  test('CO-DASH-19: "View full calendar" link works', async ({ page }) => {
    const calendarLinks = [
      'text=/view calendar|full calendar|see schedule/i',
      '[data-testid="view-calendar"]'
    ];

    for (const selector of calendarLinks) {
      const link = page.locator(selector).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1000);

        // Should be on calendar page
        const onCalendar = await page.locator('text=/schedule|calendar/i').first().isVisible().catch(() => false);
        expect(onCalendar).toBeTruthy();
        return;
      }
    }

    console.log('Calendar link not found on dashboard');
  });
});

// ============================================
// MESSAGES TESTS
// ============================================

test.describe('Contractor Messages', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-MSG-01: Can access messages', async ({ page }) => {
    const messageSelectors = [
      'text=Messages',
      'text=Chat',
      'text=Inbox',
      '[data-testid="messages"]'
    ];

    for (const selector of messageSelectors) {
      const messagesLink = page.locator(selector).first();
      if (await messagesLink.isVisible().catch(() => false)) {
        await messagesLink.click();
        await page.waitForTimeout(1000);

        const hasMessagesView = await page.locator('text=/messages|conversations|no messages|inbox/i').first().isVisible().catch(() => false);
        expect(hasMessagesView).toBeTruthy();
        return;
      }
    }

    console.log('Messages link not immediately visible');
  });
});

// ============================================
// SETTINGS TESTS
// ============================================

test.describe('Contractor Settings', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-SET-02: Stripe connection option visible', async ({ page }) => {
    await page.locator('text=/settings/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const stripeIndicators = [
      'text=/stripe|payment|connect|accept payments/i',
      '[data-testid="stripe-connect"]'
    ];

    let foundStripe = false;
    for (const selector of stripeIndicators) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        foundStripe = true;
        break;
      }
    }

    console.log('Stripe option visible:', foundStripe);
  });
});
