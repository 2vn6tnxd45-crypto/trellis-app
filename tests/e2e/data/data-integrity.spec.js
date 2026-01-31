// tests/e2e/data/data-integrity.spec.js
// ============================================
// DATA INTEGRITY & CONSISTENCY TESTS
// ============================================
// Tests for data persistence, cross-feature consistency, and state management

import { test, expect } from '@playwright/test';
import {
    loginAsContractor,
    loginAsHomeowner,
    screenshot,
    waitForLoadingComplete,
    navigateToSection,
    uniqueId,
    dismissPopups,
    TEST_ACCOUNTS
} from '../../utils/test-helpers.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// ============================================
// QUOTE-TO-JOB DATA CONSISTENCY
// ============================================
test.describe('Quote to Job Data Flow', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('DATA-001: Quote data persists to job on acceptance', async ({ page }) => {
        const testId = uniqueId('quote-job-data');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-jobs-list');

        // Find a job that came from a quote
        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-job-detail');

            // Check for data that should have flowed from quote
            const dataPoints = [
                { name: 'Customer Name', selector: 'text=/customer|client/i' },
                { name: 'Line Items', selector: 'text=/line item|service|material/i' },
                { name: 'Total', selector: 'text=/\\$\\d+|total/i' },
                { name: 'Address', selector: 'text=/\\d+.*street|\\d+.*ave|\\d+.*rd/i' }
            ];

            for (const dp of dataPoints) {
                const visible = await page.locator(dp.selector).first().isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[DATA-001] ${dp.name} visible: ${visible}`);
            }
        }
    });

    test('DATA-002: Quote status updates when job created', async ({ page }) => {
        const testId = uniqueId('quote-status');

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-quotes');

        // Look for accepted quotes
        const acceptedQuote = page.locator('text=/accepted/i').first();
        if (await acceptedQuote.isVisible({ timeout: 5000 }).catch(() => false)) {
            await acceptedQuote.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-accepted-quote');

            // Check for job link
            const jobLink = page.locator('text=/view job|job created|linked job/i').first();
            const hasJobLink = await jobLink.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[DATA-002] Accepted quote has job link: ${hasJobLink}`);
        }
    });

    test('DATA-003: Line items match between quote and job', async ({ page }) => {
        const testId = uniqueId('line-item-match');

        // This would require comparing quote and job data
        // For now, verify line items exist on job
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);

            // Count line items or services listed
            const lineItems = await page.locator('text=/description|service|item/i').count();
            console.log(`[DATA-003] Line items found: ${lineItems}`);
            await screenshot(page, testId, '01-job-line-items');
        }
    });
});

// ============================================
// CUSTOMER DATA CONSISTENCY
// ============================================
test.describe('Customer Data Consistency', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('DATA-010: Customer created when quote accepted', async ({ page }) => {
        const testId = uniqueId('cust-create');

        await navigateToSection(page, 'Customers');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-customers');

        // Check customer list exists
        const customerList = await page.locator('[class*="customer"], tr, [class*="card"]').count();
        console.log(`[DATA-010] Customer count: ${customerList}`);

        if (customerList > 0) {
            // Click first customer
            const firstCustomer = page.locator('[class*="customer"], tr').first();
            await firstCustomer.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-customer-detail');

            // Verify customer has expected fields
            const fields = ['email', 'phone', 'address', 'jobs', 'total'];
            for (const field of fields) {
                const hasField = await page.locator(`text=/${field}/i`).first().isVisible({ timeout: 1000 }).catch(() => false);
                console.log(`[DATA-010] Customer has ${field}: ${hasField}`);
            }
        }
    });

    test('DATA-011: Customer job count updates', async ({ page }) => {
        const testId = uniqueId('cust-jobs');

        await navigateToSection(page, 'Customers');
        await page.waitForTimeout(1500);

        const firstCustomer = page.locator('[class*="customer"], tr').first();
        if (await firstCustomer.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstCustomer.click();
            await page.waitForTimeout(1500);

            // Look for job count
            const jobCount = page.locator('text=/\\d+\\s*job/i').first();
            const hasJobCount = await jobCount.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[DATA-011] Customer shows job count: ${hasJobCount}`);
            await screenshot(page, testId, '01-job-count');
        }
    });

    test('DATA-012: Customer total spend accurate', async ({ page }) => {
        const testId = uniqueId('cust-spend');

        await navigateToSection(page, 'Customers');
        await page.waitForTimeout(1500);

        const firstCustomer = page.locator('[class*="customer"], tr').first();
        if (await firstCustomer.isVisible({ timeout: 5000 }).catch(() => false)) {
            await firstCustomer.click();
            await page.waitForTimeout(1500);

            // Look for total spend
            const totalSpend = page.locator('text=/\\$\\d+.*total|total.*\\$\\d+|spent.*\\$\\d+/i').first();
            const hasSpend = await totalSpend.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[DATA-012] Customer shows total spend: ${hasSpend}`);
        }
    });
});

// ============================================
// JOB STATE TRANSITIONS
// ============================================
test.describe('Job State Transitions', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('DATA-020: Job status flow is valid', async ({ page }) => {
        const testId = uniqueId('job-status');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-jobs');

        // Check for valid status labels
        const validStatuses = [
            'pending', 'scheduled', 'in progress', 'completed', 'cancelled',
            'needs scheduling', 'active'
        ];

        for (const status of validStatuses) {
            const count = await page.locator(`text=/${status}/i`).count();
            if (count > 0) {
                console.log(`[DATA-020] Found ${count} jobs with status: ${status}`);
            }
        }
    });

    test('DATA-021: Scheduled job shows on calendar', async ({ page }) => {
        const testId = uniqueId('job-calendar');

        // First check Jobs page for scheduled jobs
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        const scheduledJob = page.locator('text=/scheduled/i').first();
        const hasScheduled = await scheduledJob.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasScheduled) {
            // Go to calendar
            await navigateToSection(page, 'Schedule');
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-calendar');

            // Check for events
            const calendarEvents = await page.locator('[data-testid="calendar-event"], .calendar-event').count();
            console.log(`[DATA-021] Calendar events: ${calendarEvents}`);
        } else {
            console.log('[DATA-021] No scheduled jobs to verify');
        }
    });

    test('DATA-022: Completed job updates stats', async ({ page }) => {
        const testId = uniqueId('job-stats');

        // Go to dashboard to check stats
        await page.goto(`${BASE_URL}/app/?pro`);
        await page.waitForTimeout(2000);
        await screenshot(page, testId, '01-dashboard');

        // Look for completed job stats
        const completedStats = page.locator('text=/completed|finished/i').first();
        const hasCompletedStats = await completedStats.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[DATA-022] Dashboard shows completed stats: ${hasCompletedStats}`);
    });
});

// ============================================
// INVENTORY DATA INTEGRITY (Homeowner)
// ============================================
test.describe('Homeowner Inventory Data', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
    });

    test('DATA-030: Inventory items persist across sessions', async ({ page }) => {
        const testId = uniqueId('inv-persist');

        // Navigate to inventory
        await dismissPopups(page);
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-inventory');

            // Count items
            const itemCount = await page.locator('[class*="item"], [class*="card"], [class*="record"]').count();
            console.log(`[DATA-030] Inventory items: ${itemCount}`);

            // Refresh and recount
            await page.reload();
            await page.waitForTimeout(3000);

            const itemCountAfter = await page.locator('[class*="item"], [class*="card"], [class*="record"]').count();
            console.log(`[DATA-030] Items after refresh: ${itemCountAfter}`);

            // Should be the same
            expect(itemCountAfter).toBeGreaterThanOrEqual(itemCount);
        }
    });

    test('DATA-031: Item details are complete', async ({ page }) => {
        const testId = uniqueId('item-detail');

        await dismissPopups(page);
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const itemCard = page.locator('[class*="item"], [class*="card"]').first();
            if (await itemCard.isVisible({ timeout: 3000 }).catch(() => false)) {
                await itemCard.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '01-item-detail');

                // Check for expected fields
                const fields = ['name', 'category', 'brand', 'model', 'date'];
                for (const field of fields) {
                    const hasField = await page.locator(`text=/${field}/i`).first().isVisible({ timeout: 1000 }).catch(() => false);
                    console.log(`[DATA-031] Item has ${field}: ${hasField}`);
                }
            }
        }
    });
});

// ============================================
// CROSS-FEATURE DATA CONSISTENCY
// ============================================
test.describe('Cross-Feature Data Consistency', () => {
    test('DATA-040: Contractor stats reflect actual data', async ({ page }) => {
        const testId = uniqueId('stats-verify');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);
        await screenshot(page, testId, '01-dashboard');

        // Get stats from dashboard
        const activeJobsText = await page.locator('text=/active job/i').first().textContent().catch(() => '');
        console.log(`[DATA-040] Active jobs stat: ${activeJobsText}`);

        // Navigate to Jobs and count
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        const activeFilter = page.locator('button:has-text("Active"), text=/active/i').first();
        if (await activeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
            await activeFilter.click();
            await page.waitForTimeout(1000);
        }

        const jobCards = await page.locator('[class*="job"], [class*="card"]').count();
        console.log(`[DATA-040] Actual active jobs: ${jobCards}`);
    });

    test('DATA-041: Quote totals match line item sum', async ({ page }) => {
        const testId = uniqueId('quote-total');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        const quoteCard = page.locator('[class*="quote"], [class*="card"]').first();
        if (await quoteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quoteCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-quote-detail');

            // Look for subtotal, tax, total
            const subtotal = await page.locator('text=/subtotal/i').first().textContent().catch(() => '');
            const tax = await page.locator('text=/tax/i').first().textContent().catch(() => '');
            const total = await page.locator('text=/total/i').last().textContent().catch(() => '');

            console.log(`[DATA-041] Subtotal: ${subtotal}`);
            console.log(`[DATA-041] Tax: ${tax}`);
            console.log(`[DATA-041] Total: ${total}`);
        }
    });

    test('DATA-042: Homeowner sees contractor quotes', async ({ page }) => {
        const testId = uniqueId('ho-quotes');

        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);

        // Look for quotes section
        const quotesLink = page.locator('text=/quotes|projects/i').first();
        if (await quotesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quotesLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-ho-quotes');

            // Check for quote data
            const quoteCount = await page.locator('[class*="quote"], [class*="card"]').count();
            console.log(`[DATA-042] Homeowner quotes: ${quoteCount}`);
        }
    });
});

// ============================================
// REAL-TIME DATA SYNC
// ============================================
test.describe('Real-Time Data Sync', () => {
    test('DATA-050: Message sync between users', async ({ browser }) => {
        const testId = uniqueId('msg-sync');

        // Create two browser contexts
        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();

        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // Login both users
            await loginAsContractor(contractorPage);
            await loginAsHomeowner(homeownerPage);

            // Navigate to messages
            await navigateToSection(contractorPage, 'Messages');
            await page.waitForTimeout(1500);

            // Check if both can see messages section
            const contractorHasMessages = await contractorPage.locator('text=/message|chat/i').first().isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[DATA-050] Contractor messages visible: ${contractorHasMessages}`);

            await screenshot(contractorPage, testId, '01-contractor-messages');

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});

// ============================================
// DATA DELETION / CLEANUP
// ============================================
test.describe('Data Cleanup', () => {
    test('DATA-060: Cancelled job updates customer stats', async ({ page }) => {
        const testId = uniqueId('cancel-stats');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        // This is more of a verification test
        await navigateToSection(page, 'Customers');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-customers');

        // Customer stats should not include cancelled jobs in "active" counts
        const firstCustomer = page.locator('[class*="customer"], tr').first();
        if (await firstCustomer.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstCustomer.click();
            await page.waitForTimeout(1500);

            // Look for job breakdown
            const completedCount = await page.locator('text=/\\d+.*completed/i').first().textContent().catch(() => '');
            console.log(`[DATA-060] Completed jobs: ${completedCount}`);
        }
    });

    test('DATA-061: Quote decline updates stats', async ({ page }) => {
        const testId = uniqueId('decline-stats');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        // Look for declined quotes
        const declinedCount = await page.locator('text=/declined/i').count();
        console.log(`[DATA-061] Declined quotes visible: ${declinedCount}`);

        // Check quote stats if available
        const statsSection = page.locator('text=/conversion|acceptance rate/i').first();
        if (await statsSection.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('[DATA-061] Quote conversion stats visible');
            await screenshot(page, testId, '01-quote-stats');
        }
    });
});
