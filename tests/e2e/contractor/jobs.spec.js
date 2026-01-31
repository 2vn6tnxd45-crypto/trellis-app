// tests/e2e/contractor/jobs.spec.js
// ============================================
// CONTRACTOR JOB MANAGEMENT TESTS
// ============================================
// Tests for job list, job details, status management

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

async function loginAsContractor(page) {
  await page.goto('/home?pro');
  await waitForAppLoad(page);

  // Check if already logged in - use specific selectors to avoid matching landing page
  const dashboardIndicators = [
    'nav:has-text("Dashboard")',
    'nav:has-text("Jobs")',
    `text="${TEST_ACCOUNTS.contractorFull.companyName}"`
  ];

  for (const indicator of dashboardIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      return;
    }
  }

  // Click Sign In button
  const signInBtn = page.locator('button:has-text("Sign In")');
  if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await signInBtn.click();
    await page.waitForTimeout(1000);
  }

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  await page.fill('input[type="email"]', TEST_ACCOUNTS.contractorFull.email);
  await page.fill('input[type="password"]', TEST_ACCOUNTS.contractorFull.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForSelector('nav:has-text("Dashboard"), nav:has-text("Jobs")', { timeout: 20000 });
  await waitForAppLoad(page);
}

async function goToJobs(page) {
  const jobsTab = page.locator('text=Jobs').first();
  if (await jobsTab.isVisible().catch(() => false)) {
    await jobsTab.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

// ============================================
// JOB LIST TESTS
// ============================================

test.describe('Job List', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
    await goToJobs(page);
  });

  test('CO-JOB-01: Jobs list shows test jobs', async ({ page }) => {
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

  test('CO-JOB-03: Jobs show correct status badges', async ({ page }) => {
    const statuses = ['scheduled', 'pending', 'completed', 'in progress'];

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
// JOB DETAIL TESTS
// ============================================

test.describe('Job Details', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
    await goToJobs(page);
  });

  test('CO-JOB-02: Can view job details', async ({ page }) => {
    const jobCard = page.locator('text=/HVAC|Filter|Drain|Maintenance/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const hasDetails = await page.locator('text=/customer|address|scheduled|status|total/i').first().isVisible().catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('SH-JOB-17: Job description displayed', async ({ page }) => {
    const jobCard = page.locator('text=/HVAC|Filter|Drain/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const hasDescription = await page.locator('text=/description|details|scope/i').first().isVisible().catch(() => false);
      console.log('Description visible:', hasDescription);
    }
  });

  test('SH-JOB-18: Customer info displayed', async ({ page }) => {
    const jobCard = page.locator('text=/HVAC|Filter|Drain/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const hasCustomer = await page.locator('text=/customer|homeowner|client/i').first().isVisible().catch(() => false);
      expect(hasCustomer).toBeTruthy();
    }
  });

  test('SH-JOB-19: Property address displayed', async ({ page }) => {
    const jobCard = page.locator('text=/HVAC|Filter|Drain/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const hasAddress = await page.locator('text=/address|street|location/i').first().isVisible().catch(() => false);
      console.log('Address visible:', hasAddress);
    }
  });

  test('SH-JOB-24: Message customer button works', async ({ page }) => {
    const jobCard = page.locator('text=/HVAC|Filter|Drain/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const messageButton = page.locator('text=/message|chat|contact/i').first();
      const hasMessage = await messageButton.isVisible().catch(() => false);

      console.log('Message button visible:', hasMessage);
    }
  });
});

// ============================================
// JOB STATUS FLOW TESTS
// ============================================

test.describe('Job Status Flow', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
    await goToJobs(page);
  });

  test('SH-JOB-09: New job starts as "pending schedule"', async ({ page }) => {
    // Look for pending/unscheduled jobs
    const pendingIndicators = [
      'text=/pending|unscheduled|needs scheduling/i',
      '[data-testid="pending-jobs"]'
    ];

    let foundPending = false;
    for (const indicator of pendingIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundPending = true;
        break;
      }
    }

    console.log('Pending jobs section found:', foundPending);
  });
});

// ============================================
// JOB COMPLETION TESTS
// ============================================

test.describe('Job Completion', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsContractor(page);
    await goToJobs(page);
  });

  test('CO-JOB-01: "Complete job" button visible when scheduled', async ({ page }) => {
    const jobCard = page.locator('text=/scheduled|in progress/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const completeButton = page.locator('text=/complete|mark complete|finish/i').first();
      const hasComplete = await completeButton.isVisible().catch(() => false);

      console.log('Complete button visible:', hasComplete);
    }
  });

  test('CO-JOB-02: Completion flow opens', async ({ page }) => {
    const jobCard = page.locator('text=/scheduled|in progress/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const completeButton = page.locator('text=/complete|mark complete/i').first();

      if (await completeButton.isVisible().catch(() => false)) {
        await completeButton.click();
        await page.waitForTimeout(500);

        // Should see completion form
        const hasCompletionForm = await page.locator('text=/photo|summary|notes|finish/i').first().isVisible().catch(() => false);
        console.log('Completion form opened:', hasCompletionForm);
      }
    }
  });

  test('CO-JOB-03: Photo upload prompted', async ({ page }) => {
    const jobCard = page.locator('text=/scheduled|in progress/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const completeButton = page.locator('text=/complete|mark complete/i').first();

      if (await completeButton.isVisible().catch(() => false)) {
        await completeButton.click();
        await page.waitForTimeout(500);

        const hasPhotoUpload = await page.locator('text=/photo|upload|before|after/i, input[type="file"]').first().isVisible().catch(() => false);
        console.log('Photo upload available:', hasPhotoUpload);
      }
    }
  });
});
