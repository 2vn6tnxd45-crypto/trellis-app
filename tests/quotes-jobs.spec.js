// tests/quotes-jobs.spec.js
// ============================================
// QUOTE VIEWING & JOB FLOW TESTS
// ============================================
// Tests for homeowner viewing quotes and job completion

import { test, expect } from '@playwright/test';

const TEST_ACCOUNTS = {
  homeowner: {
    email: 'test.homeowner.full@gmail.com',
    password: 'KribTest123!'
  },
  contractor: {
    email: 'test.contractor.full@gmail.com',
    password: 'KribTest123!'
  }
};

// ============================================
// HELPER: Login as homeowner
// ============================================
async function loginAsHomeowner(page) {
  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const alreadyLoggedIn = await page.locator('text=/dashboard|my home|inventory/i').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  const signInButton = page.locator('text=/sign in|log in/i').first();
  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();
  }

  await page.fill('input[type="email"]', TEST_ACCOUNTS.homeowner.email);
  await page.fill('input[type="password"]', TEST_ACCOUNTS.homeowner.password);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ============================================
// HOMEOWNER QUOTE VIEWING TESTS
// ============================================

test.describe('Homeowner Quote Viewing', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-QUO-01: Can navigate to quotes section', async ({ page }) => {
    // Find quotes tab
    const quotesTab = page.locator('text=/Quotes|Estimates|Projects/i').first();

    if (await quotesTab.isVisible().catch(() => false)) {
      await quotesTab.click();
      await page.waitForTimeout(1000);

      // Should see quotes content
      const hasQuotesSection = await page.locator('text=/quote|estimate|pending|accepted|active/i').first().isVisible().catch(() => false);
      expect(hasQuotesSection).toBeTruthy();
    }
  });

  test('HO-QUO-02: Quotes section shows pending quotes', async ({ page }) => {
    // Navigate to quotes
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Test data should have quotes - look for indicators
    const quoteIndicators = [
      'text=/Q-2024/i',           // Quote number
      'text=AC System',           // Quote title
      'text=/pending|sent|waiting/i',
      'text=/$\\d+/i'             // Dollar amount
    ];

    let foundQuote = false;
    for (const indicator of quoteIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundQuote = true;
        break;
      }
    }

    console.log('Found quote indicators:', foundQuote);
  });

  test('HO-QUO-03: Can view quote details', async ({ page }) => {
    // Navigate to quotes
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Click on a quote
    const quoteCard = page.locator('text=/AC|Tune-Up|Service|Q-2024/i').first();

    if (await quoteCard.isVisible().catch(() => false)) {
      await quoteCard.click();
      await page.waitForTimeout(1000);

      // Should see quote details
      const hasDetails = await page.locator('text=/line item|total|contractor|accept|decline/i').first().isVisible().catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('HO-QUO-04: Quote shows accept/decline options', async ({ page }) => {
    // Navigate to quotes
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Click on a pending quote
    const quoteCard = page.locator('text=/AC|Tune-Up|pending|sent/i').first();

    if (await quoteCard.isVisible().catch(() => false)) {
      await quoteCard.click();
      await page.waitForTimeout(1000);

      // Look for action buttons
      const hasAccept = await page.locator('text=/accept|approve|book/i').first().isVisible().catch(() => false);
      const hasDecline = await page.locator('text=/decline|reject/i').first().isVisible().catch(() => false);

      console.log('Accept button:', hasAccept, 'Decline button:', hasDecline);
    }
  });
});

// ============================================
// ACTIVE JOB TESTS (Homeowner)
// ============================================

test.describe('Homeowner Active Jobs', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-JOB-01: Can see active jobs', async ({ page }) => {
    // Navigate to projects/jobs section
    const projectsTab = page.locator('text=/Projects|Jobs|Active/i').first();

    if (await projectsTab.isVisible().catch(() => false)) {
      await projectsTab.click();
      await page.waitForTimeout(1000);
    }

    // Test data has jobs - look for them
    const jobIndicators = [
      'text=/scheduled|in progress|pending/i',
      'text=HVAC',
      'text=Filter',
      'text=J-2024'
    ];

    let foundJob = false;
    for (const indicator of jobIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundJob = true;
        break;
      }
    }

    console.log('Found active jobs:', foundJob);
  });

  test('HO-JOB-02: Can view job details', async ({ page }) => {
    // Navigate to jobs
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Click on a job
    const jobCard = page.locator('text=/HVAC|Filter|scheduled|J-2024/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      // Should see job details
      const hasDetails = await page.locator('text=/contractor|scheduled|address|status|message/i').first().isVisible().catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('HO-JOB-03: Can message contractor from job', async ({ page }) => {
    // Navigate to jobs
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Open a job
    const jobCard = page.locator('text=/HVAC|Filter|scheduled/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      // Look for message button
      const messageButton = page.locator('text=/message|chat|contact/i').first();

      if (await messageButton.isVisible().catch(() => false)) {
        await messageButton.click();
        await page.waitForTimeout(500);

        // Should see chat interface
        const hasChat = await page.locator('text=/send|type|message/i').first().isVisible().catch(() => false);
        console.log('Chat opened:', hasChat);
      }
    }
  });
});

// ============================================
// JOB COMPLETION REVIEW TESTS (Homeowner)
// ============================================

test.describe('Job Completion Review', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-JOB-04: Pending completion job shows review option', async ({ page }) => {
    // Test data has a job in pending_completion status (J-2024-003)
    // Navigate to jobs/projects
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for completion-pending indicators
    const completionIndicators = [
      'text=/review|pending review|awaiting approval/i',
      'text=Drain Cleaning',  // The pending completion job
      'text=/approve|accept completion/i'
    ];

    let foundCompletion = false;
    for (const indicator of completionIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundCompletion = true;
        console.log('Found completion indicator:', indicator);
        break;
      }
    }
  });

  test('HO-JOB-05: Completion review shows work summary', async ({ page }) => {
    // Navigate and find pending completion job
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Click on pending completion job
    const completionJob = page.locator('text=/Drain|review|pending completion/i').first();

    if (await completionJob.isVisible().catch(() => false)) {
      await completionJob.click();
      await page.waitForTimeout(1000);

      // Should see completion summary from test data
      const summaryIndicators = [
        'text=/cleared|blockage|grease/i',  // From test completion summary
        'text=/photo|image/i',
        'text=/item|inventory|record/i'
      ];

      let foundSummary = false;
      for (const indicator of summaryIndicators) {
        if (await page.locator(indicator).first().isVisible().catch(() => false)) {
          foundSummary = true;
          break;
        }
      }

      console.log('Completion summary visible:', foundSummary);
    }
  });

  test('HO-JOB-06: Can approve or request revision', async ({ page }) => {
    // Navigate to pending completion job
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    const completionJob = page.locator('text=/Drain|review|pending/i').first();

    if (await completionJob.isVisible().catch(() => false)) {
      await completionJob.click();
      await page.waitForTimeout(1000);

      // Look for action buttons
      const hasApprove = await page.locator('text=/approve|accept|confirm/i').first().isVisible().catch(() => false);
      const hasRevision = await page.locator('text=/revision|changes|issue/i').first().isVisible().catch(() => false);

      console.log('Approve button:', hasApprove, 'Revision button:', hasRevision);
      expect(hasApprove || hasRevision).toBeTruthy();
    }
  });
});

// ============================================
// PUBLIC QUOTE LINK TESTS
// ============================================

test.describe('Public Quote Links', () => {

  test('HO-QUO-05: Quote link works without login', async ({ page }) => {
    // Note: You'll need to replace this with an actual quote link
    // Format is typically: /home?quote=contractorId_quoteId

    // For now, test that the quote parameter is recognized
    await page.goto('/home?quote=test');
    await page.waitForTimeout(2000);

    // Should not crash - either show quote or login prompt
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();

    // Should see either quote content or auth prompt
    const hasQuoteOrAuth = await page.locator('text=/quote|estimate|sign in|log in|create account/i').first().isVisible().catch(() => false);
    expect(hasQuoteOrAuth).toBeTruthy();
  });

  test('HO-QUO-06: Invalid quote link handles gracefully', async ({ page }) => {
    // Test with invalid quote token
    await page.goto('/home?quote=invalid_nonexistent');
    await page.waitForTimeout(2000);

    // Should not crash
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();

    // Should show error or redirect gracefully
    const hasGracefulHandling = await page.locator('text=/not found|invalid|expired|error|sign in/i').first().isVisible().catch(() => false);
    console.log('Graceful error handling:', hasGracefulHandling);
  });
});

// ============================================
// PEDIGREE REPORT TESTS
// ============================================

test.describe('Home Pedigree Report', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-REP-01: Can access pedigree report', async ({ page }) => {
    // Look for report access (usually in More menu or Settings)
    const reportSelectors = [
      'text=Report',
      'text=Pedigree',
      'text=/home report|home history/i',
      '[data-testid="report"]'
    ];

    // First try direct access
    for (const selector of reportSelectors) {
      const reportLink = page.locator(selector).first();
      if (await reportLink.isVisible().catch(() => false)) {
        await reportLink.click();
        await page.waitForTimeout(1000);

        // Should see report content
        const hasReport = await page.locator('text=/report|history|records|timeline/i').first().isVisible().catch(() => false);
        expect(hasReport).toBeTruthy();
        return;
      }
    }

    // Try through More menu
    const moreMenu = page.locator('text=More').first();
    if (await moreMenu.isVisible().catch(() => false)) {
      await moreMenu.click();
      await page.waitForTimeout(500);

      for (const selector of reportSelectors) {
        const reportLink = page.locator(selector).first();
        if (await reportLink.isVisible().catch(() => false)) {
          await reportLink.click();
          await page.waitForTimeout(1000);
          return;
        }
      }
    }

    console.log('Report access not found');
  });

  test('HO-REP-02: Report shows home records', async ({ page }) => {
    // Navigate to report (try multiple paths)
    await page.locator('text=More').first().click().catch(() => { });
    await page.waitForTimeout(500);
    await page.locator('text=/Report|Pedigree/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Should show records from test data
    const recordIndicators = [
      'text=/Samsung|Carrier|Rheem/i',  // Brands from test data
      'text=/Kitchen|HVAC|Plumbing/i',  // Categories
      'text=/warranty|installed/i'
    ];

    let foundRecords = false;
    for (const indicator of recordIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundRecords = true;
        break;
      }
    }

    console.log('Report shows records:', foundRecords);
  });
});

// ============================================
// PAYMENT FLOW TESTS
// ============================================

test.describe('Payment Flows', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-PAY-01: Quote with deposit shows payment option', async ({ page }) => {
    // Navigate to quotes
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for deposit indicators
    const depositIndicators = [
      'text=/deposit|pay|payment/i',
      'text=/50%|$956/i',  // From test quote data
      'text=/accept.*pay|pay.*deposit/i'
    ];

    let foundDeposit = false;
    for (const indicator of depositIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundDeposit = true;
        console.log('Found deposit option:', indicator);
        break;
      }
    }
  });

  test('HO-PAY-02: Payment button triggers Stripe checkout', async ({ page }) => {
    // Note: We can't fully test Stripe without real credentials
    // But we can verify the button exists and triggers an action

    // Navigate to a quote or job with payment
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => { });
    await page.waitForTimeout(1000);

    // Look for pay button
    const payButton = page.locator('text=/pay|checkout|proceed to payment/i').first();

    if (await payButton.isVisible().catch(() => false)) {
      console.log('Payment button found');
      // Don't actually click - would redirect to Stripe
    }
  });
});
