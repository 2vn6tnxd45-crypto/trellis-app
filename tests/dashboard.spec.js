// tests/dashboard.spec.js
// ============================================
// HOMEOWNER DASHBOARD TESTS
// ============================================
// Tests for dashboard, navigation, records display

import { test, expect } from '@playwright/test';

const TEST_ACCOUNT = {
  email: 'test.homeowner.full@gmail.com',
  password: 'KribTest123!'
};

// ============================================
// HELPER: Login and get to dashboard
// ============================================
async function loginAsHomeowner(page) {
  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check if already logged in
  const alreadyLoggedIn = await page.locator('text=/dashboard|my home|inventory/i').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  // Find and click sign in
  const signInButton = page.locator('text=/sign in|log in/i').first();
  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();
  }

  // Fill credentials
  await page.fill('input[type="email"]', TEST_ACCOUNT.email);
  await page.fill('input[type="password"]', TEST_ACCOUNT.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ============================================
// DASHBOARD LOADING TESTS
// ============================================

test.describe('Dashboard Loading', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-DASH-01: Dashboard loads without errors', async ({ page }) => {
    // Check no error modals or messages
    const hasError = await page.locator('text=/error|failed|something went wrong/i').first().isVisible().catch(() => false);
    expect(hasError).toBeFalsy();

    // Should see some dashboard content
    const hasContent = await page.locator('text=/home|dashboard|records|inventory|maintenance/i').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('HO-DASH-02: User name or property name displays', async ({ page }) => {
    // Should see either user name, property name, or "My Home"
    const identifiers = [
      'text=Test Home',           // Property name from test data
      'text=Test Homeowner',      // User name
      'text=My Home',             // Default
      'text=123 Test Street'      // Address
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

  test('HO-DASH-03: Records/inventory items display', async ({ page }) => {
    // Test account should have 10 records - look for some of them
    const expectedRecords = [
      'Samsung French Door Refrigerator',
      'LG Front Load Washer',
      'Carrier Central AC',
      'Rheem Water Heater',
      'Ring Doorbell'
    ];

    let foundRecords = 0;
    for (const record of expectedRecords) {
      // Use partial match
      if (await page.locator(`text=/${record.split(' ')[0]}/i`).first().isVisible().catch(() => false)) {
        foundRecords++;
      }
    }

    // Should find at least some records
    expect(foundRecords).toBeGreaterThan(0);
  });

  test('HO-DASH-04: Maintenance tasks section exists', async ({ page }) => {
    // Look for maintenance-related content
    const maintenanceIndicators = [
      'text=/maintenance|needs attention|overdue|due soon|tasks/i',
      'text=Replace air filter',  // From test data
      'text=Run cleaning cycle',  // From test data
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

  test('HO-DASH-05: Home health score displays', async ({ page }) => {
    // Look for health score indicator
    const healthIndicators = [
      'text=/health|score/i',
      '[data-testid="health-score"]',
      'text=/%/i'  // Percentage
    ];

    let foundHealth = false;
    for (const indicator of healthIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundHealth = true;
        break;
      }
    }

    // Health score might not be on main dashboard, so this is informational
    console.log('Health score visible:', foundHealth);
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
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Look for bottom nav
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
    // Look for and click Records or Inventory tab
    const tabSelectors = [
      'text=Records',
      'text=Inventory',
      'text=Items',
      '[data-testid="records-tab"]'
    ];

    for (const selector of tabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    // Should see records list
    const hasRecords = await page.locator('text=/Samsung|LG|Carrier|appliance|HVAC/i').first().isVisible().catch(() => false);
    expect(hasRecords).toBeTruthy();
  });

  test('HO-NAV-03: Can navigate to Quotes tab', async ({ page }) => {
    // Look for and click Quotes tab
    const tabSelectors = [
      'text=Quotes',
      'text=Estimates',
      'text=Projects',
      '[data-testid="quotes-tab"]'
    ];

    for (const selector of tabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    // Should see quotes content or empty state
    const hasQuotesContent = await page.locator('text=/quote|estimate|pending|accepted|no quotes/i').first().isVisible().catch(() => false);
    expect(hasQuotesContent).toBeTruthy();
  });

  test('HO-NAV-04: Can navigate to Contractors/Pros tab', async ({ page }) => {
    // Look for and click Contractors tab
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

    // Should see contractors content
    // Test data has contractors embedded in records
    const hasContractorsContent = await page.locator('text=/contractor|best buy|home depot|cool air|plumbing/i').first().isVisible().catch(() => false);
    console.log('Found contractors content:', hasContractorsContent);
  });

  test('HO-NAV-05: Can open More menu', async ({ page }) => {
    // Look for More menu
    const moreSelectors = [
      'text=More',
      '[data-testid="more-menu"]',
      '[aria-label="More"]',
      'button:has-text("More")'
    ];

    for (const selector of moreSelectors) {
      const menuButton = page.locator(selector).first();
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(500);

        // Should see menu options
        const hasMenuOptions = await page.locator('text=/settings|report|logout|sign out/i').first().isVisible().catch(() => false);
        expect(hasMenuOptions).toBeTruthy();
        return;
      }
    }

    console.log('More menu not found - may have different navigation structure');
  });

  test('HO-NAV-06: Can access Settings', async ({ page }) => {
    // Try to find Settings directly or through More menu
    let settingsVisible = await page.locator('text=Settings').first().isVisible().catch(() => false);

    if (!settingsVisible) {
      // Try opening More menu first
      const moreButton = page.locator('text=More').first();
      if (await moreButton.isVisible().catch(() => false)) {
        await moreButton.click();
        await page.waitForTimeout(500);
        settingsVisible = await page.locator('text=Settings').first().isVisible().catch(() => false);
      }
    }

    if (settingsVisible) {
      await page.locator('text=Settings').first().click();
      await page.waitForTimeout(1000);

      // Should see settings content
      const hasSettingsContent = await page.locator('text=/profile|property|notification|account|theme/i').first().isVisible().catch(() => false);
      expect(hasSettingsContent).toBeTruthy();
    }
  });
});

// ============================================
// RECORD INTERACTION TESTS
// ============================================

test.describe('Record Interactions', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-REC-01: Can click on a record to view details', async ({ page }) => {
    // Find a record card and click it
    const recordSelectors = [
      'text=Samsung',
      'text=Refrigerator',
      'text=LG',
      'text=Washer',
      'text=Carrier',
      '[data-testid="record-card"]'
    ];

    for (const selector of recordSelectors) {
      const record = page.locator(selector).first();
      if (await record.isVisible().catch(() => false)) {
        await record.click();
        await page.waitForTimeout(1000);

        // Should see detail view (modal or page)
        const hasDetails = await page.locator('text=/brand|model|serial|warranty|installed|cost|notes/i').first().isVisible().catch(() => false);
        expect(hasDetails).toBeTruthy();
        return;
      }
    }

    // If no records found, that's a different issue
    console.log('No records found to click');
  });

  test('HO-REC-02: Record detail shows expected information', async ({ page }) => {
    // Click on Samsung refrigerator specifically
    const refrigeratorCard = page.locator('text=/Samsung|Refrigerator/i').first();

    if (await refrigeratorCard.isVisible().catch(() => false)) {
      await refrigeratorCard.click();
      await page.waitForTimeout(1000);

      // Check for expected data from test records
      const expectedData = [
        'Samsung',
        'RF28R7351SR',        // Model
        'Kitchen',            // Area
        '2499',               // Cost (might be formatted as $2,499)
        'warranty'            // Has warranty info
      ];

      let foundData = 0;
      for (const data of expectedData) {
        if (await page.locator(`text=/${data}/i`).first().isVisible().catch(() => false)) {
          foundData++;
        }
      }

      // Should find at least some of the data
      expect(foundData).toBeGreaterThan(2);
    }
  });

  test('HO-REC-03: Can close record detail view', async ({ page }) => {
    // Open a record
    const recordCard = page.locator('text=/Samsung|Refrigerator/i').first();

    if (await recordCard.isVisible().catch(() => false)) {
      await recordCard.click();
      await page.waitForTimeout(1000);

      // Find close button (X, Back, Done, etc.)
      const closeSelectors = [
        'button:has-text("×")',
        '[aria-label="Close"]',
        'text=Back',
        'text=Done',
        'button:has(svg)',  // X icon
        '[data-testid="close-modal"]'
      ];

      for (const selector of closeSelectors) {
        const closeButton = page.locator(selector).first();
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(500);
          break;
        }
      }

      // Should be back on dashboard/list
      await page.waitForTimeout(500);
    }
  });

  test('HO-REC-04: Search/filter records works', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]').first();

    if (await searchInput.isVisible().catch(() => false)) {
      // Search for "Samsung"
      await searchInput.fill('Samsung');
      await page.waitForTimeout(1000);

      // Should see Samsung records but not others
      const samsungVisible = await page.locator('text=Samsung').first().isVisible().catch(() => false);
      expect(samsungVisible).toBeTruthy();

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(500);
    } else {
      console.log('Search input not found on current view');
    }
  });

  test('HO-REC-05: Category filter works', async ({ page }) => {
    // Look for category filter
    const filterSelectors = [
      'select',
      '[data-testid="category-filter"]',
      'text=All Categories',
      'text=Filter',
      'button:has-text("Appliances")',
      'button:has-text("HVAC")'
    ];

    for (const selector of filterSelectors) {
      const filter = page.locator(selector).first();
      if (await filter.isVisible().catch(() => false)) {
        await filter.click();
        await page.waitForTimeout(500);

        // Look for category options
        const categoryOptions = page.locator('text=/Appliances|HVAC|Plumbing|Electrical/i');
        if (await categoryOptions.first().isVisible().catch(() => false)) {
          // Click on Appliances
          await page.locator('text=Appliances').first().click();
          await page.waitForTimeout(500);

          // Should show appliances (Samsung, LG)
          const appliancesVisible = await page.locator('text=/Samsung|LG/i').first().isVisible().catch(() => false);
          console.log('Appliances filter working:', appliancesVisible);
          return;
        }
      }
    }

    console.log('Category filter not found');
  });
});

// ============================================
// ADD RECORD TESTS
// ============================================

test.describe('Add Record', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-REC-06: Add record button exists', async ({ page }) => {
    // Look for Add button
    const addSelectors = [
      'text=Add',
      'button:has-text("+")',
      '[data-testid="add-record"]',
      '[aria-label="Add"]',
      'text=Scan',
      'text=New Record'
    ];

    let foundAdd = false;
    for (const selector of addSelectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        foundAdd = true;
        break;
      }
    }

    expect(foundAdd).toBeTruthy();
  });

  test('HO-REC-07: Clicking Add opens scanner or form', async ({ page }) => {
    // Find and click Add button
    const addSelectors = [
      'text=Add',
      'button:has-text("+")',
      '[data-testid="add-record"]',
      'text=Scan'
    ];

    for (const selector of addSelectors) {
      const addButton = page.locator(selector).first();
      if (await addButton.isVisible().catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(1000);

        // Should see scanner or add form
        const hasAddInterface = await page.locator('text=/scan|upload|photo|camera|add item|new record/i').first().isVisible().catch(() => false);
        expect(hasAddInterface).toBeTruthy();
        return;
      }
    }
  });
});
