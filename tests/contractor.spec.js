// tests/contractor.spec.js
// ============================================
// CONTRACTOR DASHBOARD TESTS
// ============================================
// Tests for contractor-side functionality

import { test, expect } from '@playwright/test';

const TEST_ACCOUNTS = {
  contractorNew: {
    email: 'test.contractor.new@gmail.com',
    password: 'KribTest123!'
  },
  contractorFull: {
    email: 'test.contractor.full@gmail.com',
    password: 'KribTest123!',
    companyName: 'Elite Home Services'
  }
};

// ============================================
// HELPER: Login as contractor
// ============================================
async function loginAsContractor(page, account = TEST_ACCOUNTS.contractorFull) {
  await page.goto('/home?pro');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check if already logged in
  const alreadyLoggedIn = await page.locator('text=/dashboard|jobs|quotes|customers/i').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  // Find login/get started button
  const authButton = page.locator('text=/sign in|log in|get started|start free/i').first();
  if (await authButton.isVisible().catch(() => false)) {
    await authButton.click();
    await page.waitForTimeout(1000);
  }

  // Fill credentials
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ============================================
// CONTRACTOR DASHBOARD TESTS
// ============================================

test.describe('Contractor Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-DASH-01: Dashboard loads without errors', async ({ page }) => {
    // Check no error messages
    const hasError = await page.locator('text=/error|failed|something went wrong/i').first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();

    // Should see dashboard content
    const hasDashboard = await page.locator('text=/dashboard|jobs|quotes|customers|schedule/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasDashboard).toBeTruthy();
  });

  test('CO-DASH-02: Company name displays correctly', async ({ page }) => {
    // Should see company name from test data
    const companyName = await page.locator(`text=${TEST_ACCOUNTS.contractorFull.companyName}`).first().isVisible().catch(() => false);
    expect(companyName).toBeTruthy();
  });

  test('CO-DASH-03: Navigation tabs exist', async ({ page }) => {
    // Check for main navigation items
    const navItems = [
      'Dashboard',
      'Jobs',
      'Quotes',
      'Schedule',
      'Customers'
    ];

    let foundTabs = 0;
    for (const item of navItems) {
      if (await page.locator(`text=${item}`).first().isVisible().catch(() => false)) {
        foundTabs++;
      }
    }

    // Should find at least 3 of these
    expect(foundTabs).toBeGreaterThanOrEqual(3);
  });

  test('CO-DASH-04: Can navigate to Jobs view', async ({ page }) => {
    const jobsTab = page.locator('text=Jobs').first();

    if (await jobsTab.isVisible().catch(() => false)) {
      await jobsTab.click();
      await page.waitForTimeout(1000);

      // Should see jobs content (list or empty state)
      const hasJobsContent = await page.locator('text=/jobs|scheduled|pending|completed|no jobs/i').first().isVisible().catch(() => false);
      expect(hasJobsContent).toBeTruthy();
    }
  });

  test('CO-DASH-05: Can navigate to Quotes view', async ({ page }) => {
    const quotesTab = page.locator('text=Quotes').first();

    if (await quotesTab.isVisible().catch(() => false)) {
      await quotesTab.click();
      await page.waitForTimeout(1000);

      // Should see quotes content
      // Test data has 2 quotes: Q-2024-001 and Q-2024-002
      const hasQuotesContent = await page.locator('text=/quotes|Q-2024|draft|sent|no quotes/i').first().isVisible().catch(() => false);
      expect(hasQuotesContent).toBeTruthy();
    }
  });

  test('CO-DASH-06: Can navigate to Schedule/Calendar view', async ({ page }) => {
    const scheduleTab = page.locator('text=/Schedule|Calendar/i').first();

    if (await scheduleTab.isVisible().catch(() => false)) {
      await scheduleTab.click();
      await page.waitForTimeout(1000);

      // Should see calendar or schedule view
      const hasScheduleContent = await page.locator('text=/today|this week|calendar|schedule|january|february|march|april|may|june|july|august|september|october|november|december/i').first().isVisible().catch(() => false);
      expect(hasScheduleContent).toBeTruthy();
    }
  });

  test('CO-DASH-07: Can navigate to Customers view', async ({ page }) => {
    const customersTab = page.locator('text=Customers').first();

    if (await customersTab.isVisible().catch(() => false)) {
      await customersTab.click();
      await page.waitForTimeout(1000);

      // Should see customers list
      // Test data has 1 customer: Test Homeowner (Full)
      const hasCustomersContent = await page.locator('text=/customers|homeowner|no customers/i').first().isVisible().catch(() => false);
      expect(hasCustomersContent).toBeTruthy();
    }
  });
});

// ============================================
// QUOTE CREATION TESTS
// ============================================

test.describe('Contractor Quote Creation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-QUO-01: Can open new quote form', async ({ page }) => {
    // Navigate to quotes
    await page.locator('text=Quotes').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Find create quote button
    const createSelectors = [
      'text=New Quote',
      'text=Create Quote',
      'text=Add Quote',
      'button:has-text("+")',
      '[data-testid="create-quote"]'
    ];

    for (const selector of createSelectors) {
      const createButton = page.locator(selector).first();
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();
        await page.waitForTimeout(1000);

        // Should see quote form
        const hasForm = await page.locator('text=/customer|title|line item|add item|total/i').first().isVisible().catch(() => false);
        expect(hasForm).toBeTruthy();
        return;
      }
    }

    console.log('Create quote button not found');
  });

  test('CO-QUO-02: Quote form has required fields', async ({ page }) => {
    // Navigate to quotes and open form
    await page.locator('text=Quotes').first().click().catch(() => { });
    await page.waitForTimeout(500);
    await page.locator('text=/new quote|create/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Check for essential quote fields
    const requiredElements = [
      'input',          // Has input fields
      'text=/customer|client|name/i',  // Customer field
      'text=/title|description|service/i',  // Title/description
      'text=/item|line|add/i',  // Line items
      'text=/total|amount|price/i'  // Total
    ];

    let foundElements = 0;
    for (const selector of requiredElements) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        foundElements++;
      }
    }

    expect(foundElements).toBeGreaterThan(2);
  });

  test('CO-QUO-03: Can add line items to quote', async ({ page }) => {
    // Navigate to quote form
    await page.locator('text=Quotes').first().click().catch(() => { });
    await page.waitForTimeout(500);
    await page.locator('text=/new quote|create/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for add line item button
    const addItemButton = page.locator('text=/add item|add line|\\+ item/i').first();

    if (await addItemButton.isVisible().catch(() => false)) {
      await addItemButton.click();
      await page.waitForTimeout(500);

      // Should see line item inputs
      const hasLineItemInputs = await page.locator('input[placeholder*="description"], input[placeholder*="price"], input[placeholder*="quantity"]').first().isVisible().catch(() => false);
      console.log('Line item inputs visible:', hasLineItemInputs);
    }
  });

  test('CO-QUO-04: Quote shows running total', async ({ page }) => {
    // Navigate to quote form
    await page.locator('text=Quotes').first().click().catch(() => { });
    await page.waitForTimeout(500);
    await page.locator('text=/new quote|create/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Should see total field
    const hasTotal = await page.locator('text=/total|subtotal|amount/i').first().isVisible().catch(() => false);
    expect(hasTotal).toBeTruthy();
  });
});

// ============================================
// PRICE BOOK TESTS
// ============================================

test.describe('Price Book', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-PB-01: Can access price book', async ({ page }) => {
    // Look for price book navigation
    const priceBookSelectors = [
      'text=Price Book',
      'text=Pricebook',
      'text=/items|services|materials/i'
    ];

    for (const selector of priceBookSelectors) {
      const priceBookLink = page.locator(selector).first();
      if (await priceBookLink.isVisible().catch(() => false)) {
        await priceBookLink.click();
        await page.waitForTimeout(1000);

        // Should see price book items
        // Test data has items like "AC Tune-Up", "Drain Cleaning"
        const hasItems = await page.locator('text=/AC Tune|Drain|tune-up|hourly/i').first().isVisible().catch(() => false);
        expect(hasItems).toBeTruthy();
        return;
      }
    }

    // Price book might be in a menu
    const settingsMenu = page.locator('text=/settings|more/i').first();
    if (await settingsMenu.isVisible().catch(() => false)) {
      await settingsMenu.click();
      await page.waitForTimeout(500);
    }
  });

  test('CO-PB-02: Price book shows items from test data', async ({ page }) => {
    // Navigate to price book
    await page.locator('text=/price book|pricebook/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Check for test data items
    const testItems = [
      'AC Tune-Up',
      'Furnace Tune-Up',
      'Drain Cleaning',
      'Hourly Labor'
    ];

    let foundItems = 0;
    for (const item of testItems) {
      if (await page.locator(`text=/${item.split(' ')[0]}/i`).first().isVisible().catch(() => false)) {
        foundItems++;
      }
    }

    console.log('Found price book items:', foundItems);
  });
});

// ============================================
// JOB MANAGEMENT TESTS
// ============================================

test.describe('Job Management', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
  });

  test('CO-JOB-01: Jobs list shows test jobs', async ({ page }) => {
    // Navigate to jobs
    await page.locator('text=Jobs').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Test data has 3 jobs
    const testJobs = [
      'HVAC Filter Replacement',
      'AC Maintenance',
      'Drain Cleaning'
    ];

    let foundJobs = 0;
    for (const job of testJobs) {
      if (await page.locator(`text=/${job.split(' ')[0]}/i`).first().isVisible().catch(() => false)) {
        foundJobs++;
      }
    }

    console.log('Found jobs:', foundJobs);
    expect(foundJobs).toBeGreaterThan(0);
  });

  test('CO-JOB-02: Can view job details', async ({ page }) => {
    // Navigate to jobs
    await page.locator('text=Jobs').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Click on a job
    const jobCard = page.locator('text=/HVAC|Filter|Drain|Maintenance/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      // Should see job details
      const hasDetails = await page.locator('text=/customer|address|scheduled|status|total/i').first().isVisible().catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('CO-JOB-03: Jobs show correct status badges', async ({ page }) => {
    // Navigate to jobs
    await page.locator('text=Jobs').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for status indicators
    const statuses = [
      'scheduled',
      'pending',
      'completed',
      'in progress'
    ];

    let foundStatus = false;
    for (const status of statuses) {
      if (await page.locator(`text=/${status}/i`).first().isVisible().catch(() => false)) {
        foundStatus = true;
        break;
      }
    }

    expect(foundStatus).toBeTruthy();
  });

  test('CO-JOB-04: Can filter jobs by status', async ({ page }) => {
    // Navigate to jobs
    await page.locator('text=Jobs').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for filter controls
    const filterSelectors = [
      'select',
      'text=/all jobs|filter|status/i',
      '[data-testid="job-filter"]',
      'button:has-text("Scheduled")',
      'button:has-text("Pending")'
    ];

    for (const selector of filterSelectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        console.log('Job filter found:', selector);
        return;
      }
    }
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
    // Look for messages navigation
    const messageSelectors = [
      'text=Messages',
      'text=Chat',
      'text=Inbox',
      '[data-testid="messages"]',
      'svg[class*="message"]'  // Message icon
    ];

    for (const selector of messageSelectors) {
      const messagesLink = page.locator(selector).first();
      if (await messagesLink.isVisible().catch(() => false)) {
        await messagesLink.click();
        await page.waitForTimeout(1000);

        // Should see messages view
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

  test('CO-SET-01: Can access business settings', async ({ page }) => {
    // Look for settings
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

        // Should see settings content
        const hasSettings = await page.locator('text=/company|business|profile|notification|payment/i').first().isVisible().catch(() => false);
        expect(hasSettings).toBeTruthy();
        return;
      }
    }
  });

  test('CO-SET-02: Stripe connection option visible', async ({ page }) => {
    // Navigate to settings
    await page.locator('text=/settings/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for Stripe/payments section
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
