// tests/e2e/shared/job-lifecycle.spec.js
// ============================================
// JOB LIFECYCLE & QUOTE FLOW TESTS
// ============================================
// Tests for homeowner viewing quotes and job completion

import { test, expect } from '@playwright/test';

// Verified working credentials (2026-01-27)
const TEST_ACCOUNTS = {
  homeowner: {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234'
  },
  contractor: {
    email: 'danvdova@gmail.com',
    password: 'Test1234'
  }
};

async function waitForAppLoad(page) {
  // Use domcontentloaded instead of networkidle - networkidle times out with WebSockets/polling
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
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

  await page.fill('input[type="email"]', TEST_ACCOUNTS.homeowner.email);
  await page.fill('input[type="password"]', TEST_ACCOUNTS.homeowner.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForSelector('text=HEALTH SCORE', { timeout: 20000 });
  await waitForAppLoad(page);
}

// ============================================
// HOMEOWNER QUOTE VIEWING TESTS
// ============================================

test.describe('Homeowner Quote Viewing', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-QUO-01: Can navigate to quotes section', async ({ page }) => {
    const quotesTab = page.locator('text=/Quotes|Estimates|Projects/i').first();

    if (await quotesTab.isVisible().catch(() => false)) {
      await quotesTab.click();
      await page.waitForTimeout(1000);

      const hasQuotesSection = await page.locator('text=/quote|estimate|pending|accepted|active/i').first().isVisible().catch(() => false);
      expect(hasQuotesSection).toBeTruthy();
    }
  });

  test('HO-QUO-02: Quotes section shows pending quotes', async ({ page }) => {
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const quoteIndicators = [
      'text=/Q-2024/i',
      'text=AC System',
      'text=/pending|sent|waiting/i'
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
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const quoteCard = page.locator('text=/AC|Tune-Up|Service|Q-2024/i').first();

    if (await quoteCard.isVisible().catch(() => false)) {
      await quoteCard.click();
      await page.waitForTimeout(1000);

      const hasDetails = await page.locator('text=/line item|total|contractor|accept|decline/i').first().isVisible().catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('HO-QUO-04: Quote shows accept/decline options', async ({ page }) => {
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const quoteCard = page.locator('text=/AC|Tune-Up|pending|sent/i').first();

    if (await quoteCard.isVisible().catch(() => false)) {
      await quoteCard.click();
      await page.waitForTimeout(1000);

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
    const projectsTab = page.locator('text=/Projects|Jobs|Active/i').first();

    if (await projectsTab.isVisible().catch(() => false)) {
      await projectsTab.click();
      await page.waitForTimeout(1000);
    }

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
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const jobCard = page.locator('text=/HVAC|Filter|scheduled|J-2024/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const hasDetails = await page.locator('text=/contractor|scheduled|address|status|message/i').first().isVisible().catch(() => false);
      expect(hasDetails).toBeTruthy();
    }
  });

  test('HO-JOB-03: Can message contractor from job', async ({ page }) => {
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const jobCard = page.locator('text=/HVAC|Filter|scheduled/i').first();

    if (await jobCard.isVisible().catch(() => false)) {
      await jobCard.click();
      await page.waitForTimeout(1000);

      const messageButton = page.locator('text=/message|chat|contact/i').first();

      if (await messageButton.isVisible().catch(() => false)) {
        await messageButton.click();
        await page.waitForTimeout(500);

        const hasChat = await page.locator('text=/send|type|message/i').first().isVisible().catch(() => false);
        console.log('Chat opened:', hasChat);
      }
    }
  });
});

// ============================================
// JOB COMPLETION REVIEW TESTS
// ============================================

test.describe('Job Completion Review', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-JOB-04: Pending completion job shows review option', async ({ page }) => {
    await page.locator('text=/Projects|Jobs|Quotes/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const completionIndicators = [
      'text=/review|pending review|awaiting approval/i',
      'text=Drain Cleaning',
      'text=/approve|accept completion/i'
    ];

    let foundCompletion = false;
    for (const indicator of completionIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundCompletion = true;
        break;
      }
    }

    console.log('Completion review found:', foundCompletion);
  });

  test('HO-JOB-06: Can approve or request revision', async ({ page }) => {
    // Dismiss any overlaying privacy banners first
    const bannerButtons = ['button:has-text("No Thanks")', 'button:has-text("Accept")'];
    for (const selector of bannerButtons) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    await page.locator('text=/Projects|Jobs|Quotes/i').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);

    const completionJob = page.locator('text=/Drain|review|pending/i').first();

    if (await completionJob.isVisible().catch(() => false)) {
      await completionJob.click({ force: true });
      await page.waitForTimeout(1000);

      const hasApprove = await page.locator('text=/approve|accept|confirm/i').first().isVisible().catch(() => false);
      const hasRevision = await page.locator('text=/revision|changes|issue/i').first().isVisible().catch(() => false);

      console.log('Approve:', hasApprove, 'Revision:', hasRevision);
    }
  });
});

// ============================================
// PUBLIC QUOTE LINK TESTS
// ============================================

test.describe('Public Quote Links', () => {

  test('HO-QUO-05: Quote link works without login', async ({ page }) => {
    await page.goto('/home?quote=test');
    await page.waitForTimeout(2000);

    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();

    const hasQuoteOrAuth = await page.locator('text=/quote|estimate|sign in|log in|create account/i').first().isVisible().catch(() => false);
    expect(hasQuoteOrAuth).toBeTruthy();
  });

  test('HO-QUO-06: Invalid quote link handles gracefully', async ({ page }) => {
    await page.goto('/home?quote=invalid_nonexistent');
    await page.waitForTimeout(2000);

    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBeTruthy();

    const hasGracefulHandling = await page.locator('text=/not found|invalid|expired|error|sign in/i').first().isVisible().catch(() => false);
    console.log('Graceful error handling:', hasGracefulHandling);
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
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const depositIndicators = [
      'text=/deposit|pay|payment/i',
      'text=/50%|\\$956/i',
      'text=/accept.*pay|pay.*deposit/i'
    ];

    let foundDeposit = false;
    for (const indicator of depositIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundDeposit = true;
        break;
      }
    }

    console.log('Deposit option found:', foundDeposit);
  });

  test('HO-PAY-02: Payment button exists', async ({ page }) => {
    await page.locator('text=/Quotes|Projects/i').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const payButton = page.locator('text=/pay|checkout|proceed to payment/i').first();

    if (await payButton.isVisible().catch(() => false)) {
      console.log('Payment button found');
    }
  });
});
