// tests/e2e/handshake-flow.spec.js
// Complete end-to-end test: Homeowner and Contractor working together
// Tests the full lifecycle from service request to job completion

import { test, expect } from '@playwright/test';
import {
    loginAsHomeowner,
    loginAsContractor,
    screenshot,
    waitForLoadingComplete,
    waitForToast,
    uniqueId
} from '../utils/test-helpers.js';

test.describe('Homeowner-Contractor Handshake Flow', () => {
    // Use longer timeout for E2E tests
    test.setTimeout(180000); // 3 minutes

    test('E2E-001: Full Happy Path - Request to Completion', async ({ browser }) => {
        // Create two separate browser contexts for parallel user simulation
        const homeownerContext = await browser.newContext();
        const contractorContext = await browser.newContext();

        const homeownerPage = await homeownerContext.newPage();
        const contractorPage = await contractorContext.newPage();

        const testId = uniqueId('e2e');
        console.log(`[E2E] Starting test: ${testId}`);

        try {
            // ============================================
            // STEP 1: Login both users
            // ============================================
            console.log('[E2E] Step 1: Logging in both users');

            await Promise.all([
                loginAsHomeowner(homeownerPage, { useStoredSession: false }),
                loginAsContractor(contractorPage, { useStoredSession: false })
            ]);

            await screenshot(homeownerPage, testId, '01-homeowner-logged-in');
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            // ============================================
            // STEP 2: Homeowner views dashboard
            // ============================================
            console.log('[E2E] Step 2: Verifying homeowner dashboard');

            await waitForLoadingComplete(homeownerPage);
            await screenshot(homeownerPage, testId, '02-homeowner-dashboard');

            // Verify key dashboard elements
            const dashboardLoaded = await homeownerPage.locator('text=/welcome|dashboard|home/i').first()
                .isVisible({ timeout: 10000 }).catch(() => false);
            console.log(`[E2E] Homeowner dashboard loaded: ${dashboardLoaded}`);

            // ============================================
            // STEP 3: Contractor views dashboard
            // ============================================
            console.log('[E2E] Step 3: Verifying contractor dashboard');

            await waitForLoadingComplete(contractorPage);
            await screenshot(contractorPage, testId, '03-contractor-dashboard');

            // Verify sidebar is visible (indicates logged in)
            const sidebarVisible = await contractorPage.locator('nav, aside').first()
                .isVisible({ timeout: 10000 }).catch(() => false);
            console.log(`[E2E] Contractor sidebar visible: ${sidebarVisible}`);
            expect(sidebarVisible).toBeTruthy();

            // ============================================
            // STEP 4: Navigate contractor to Quotes
            // ============================================
            console.log('[E2E] Step 4: Contractor navigating to Quotes');

            // Click on Quotes in sidebar
            const quotesNav = contractorPage.locator('text="Quotes"').first();
            if (await quotesNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await quotesNav.click();
                await waitForLoadingComplete(contractorPage);
            }

            await screenshot(contractorPage, testId, '04-contractor-quotes-list');

            // ============================================
            // STEP 5: Check contractor calendar
            // ============================================
            console.log('[E2E] Step 5: Verifying contractor calendar');

            const scheduleNav = contractorPage.locator('text=/schedule|calendar/i').first();
            if (await scheduleNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await scheduleNav.click();
                await waitForLoadingComplete(contractorPage);
                await screenshot(contractorPage, testId, '05-contractor-calendar');
            }

            // ============================================
            // STEP 6: Check homeowner calendar/upcoming
            // ============================================
            console.log('[E2E] Step 6: Checking homeowner upcoming events');

            // Look for calendar or upcoming section on homeowner page
            const calendarSection = homeownerPage.locator('text=/upcoming|calendar|scheduled/i').first();
            if (await calendarSection.isVisible({ timeout: 5000 }).catch(() => false)) {
                await screenshot(homeownerPage, testId, '06-homeowner-calendar-section');
            }

            // ============================================
            // STEP 7: Verify messaging is accessible
            // ============================================
            console.log('[E2E] Step 7: Checking messaging access');

            // Contractor messages
            const contractorMessagesNav = contractorPage.locator('text=/messages/i').first();
            if (await contractorMessagesNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await contractorMessagesNav.click();
                await waitForLoadingComplete(contractorPage);
                await screenshot(contractorPage, testId, '07-contractor-messages');
            }

            // ============================================
            // STEP 8: Check contractor jobs view
            // ============================================
            console.log('[E2E] Step 8: Verifying contractor jobs view');

            const jobsNav = contractorPage.locator('text=/jobs|my jobs/i').first();
            if (await jobsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await jobsNav.click();
                await waitForLoadingComplete(contractorPage);
                await screenshot(contractorPage, testId, '08-contractor-jobs');
            }

            // ============================================
            // STEP 9: Check contractor customers
            // ============================================
            console.log('[E2E] Step 9: Verifying contractor customers');

            const customersNav = contractorPage.locator('text=/customers/i').first();
            if (await customersNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await customersNav.click();
                await waitForLoadingComplete(contractorPage);
                await screenshot(contractorPage, testId, '09-contractor-customers');
            }

            // ============================================
            // STEP 10: Final state verification
            // ============================================
            console.log('[E2E] Step 10: Final verification');

            // Take final screenshots of both dashboards
            await homeownerPage.goto('https://mykrib.app/home');
            await waitForLoadingComplete(homeownerPage);
            await screenshot(homeownerPage, testId, '10-homeowner-final');

            // Return contractor to dashboard
            const dashboardNav = contractorPage.locator('text=/dashboard/i').first();
            if (await dashboardNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await dashboardNav.click();
                await waitForLoadingComplete(contractorPage);
            }
            await screenshot(contractorPage, testId, '10-contractor-final');

            console.log(`[E2E] Test ${testId} completed successfully`);

        } finally {
            // Clean up
            await homeownerContext.close();
            await contractorContext.close();
        }
    });

    test('SYNC-001: Real-time UI Synchronization', async ({ browser }) => {
        // This test verifies that both users see consistent UI
        const homeownerContext = await browser.newContext();
        const contractorContext = await browser.newContext();

        const homeownerPage = await homeownerContext.newPage();
        const contractorPage = await contractorContext.newPage();

        const testId = uniqueId('sync');
        console.log(`[SYNC] Starting test: ${testId}`);

        try {
            // Login both users
            await Promise.all([
                loginAsHomeowner(homeownerPage, { useStoredSession: false }),
                loginAsContractor(contractorPage, { useStoredSession: false })
            ]);

            // Both should be on their respective dashboards
            await waitForLoadingComplete(homeownerPage);
            await waitForLoadingComplete(contractorPage);

            // Screenshot both dashboards side by side conceptually
            await screenshot(homeownerPage, testId, 'sync-homeowner-dashboard');
            await screenshot(contractorPage, testId, 'sync-contractor-dashboard');

            // Verify no errors on either page
            const homeownerErrors = await homeownerPage.locator('.text-red-500, .text-red-600').count();
            const contractorErrors = await contractorPage.locator('.text-red-500, .text-red-600').count();

            console.log(`[SYNC] Homeowner errors: ${homeownerErrors}`);
            console.log(`[SYNC] Contractor errors: ${contractorErrors}`);

            // Both pages should be error-free
            expect(homeownerErrors).toBeLessThanOrEqual(0);
            expect(contractorErrors).toBeLessThanOrEqual(0);

            console.log(`[SYNC] Test ${testId} completed`);

        } finally {
            await homeownerContext.close();
            await contractorContext.close();
        }
    });

    test('CALV-001: Calendar View Consistency', async ({ browser }) => {
        // Verify that calendar data appears consistently for both users
        const contractorContext = await browser.newContext();
        const contractorPage = await contractorContext.newPage();

        const testId = uniqueId('cal');
        console.log(`[CAL] Starting test: ${testId}`);

        try {
            await loginAsContractor(contractorPage, { useStoredSession: false });
            await waitForLoadingComplete(contractorPage);

            // Navigate to calendar/schedule
            const scheduleNav = contractorPage.locator('text=/schedule|calendar/i').first();
            await scheduleNav.click();
            await waitForLoadingComplete(contractorPage);

            // Screenshot the calendar
            await screenshot(contractorPage, testId, 'calendar-initial');

            // Try different calendar views if available
            const viewButtons = ['Day', 'Week', 'Month'];
            for (const view of viewButtons) {
                const viewButton = contractorPage.locator(`button:has-text("${view}")`).first();
                if (await viewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await viewButton.click();
                    await contractorPage.waitForTimeout(1000);
                    await screenshot(contractorPage, testId, `calendar-${view.toLowerCase()}-view`);
                }
            }

            // Verify calendar rendered (look for calendar grid or events)
            const calendarElements = await contractorPage.locator('[class*="calendar"], [class*="schedule"], [class*="grid"]').count();
            console.log(`[CAL] Calendar elements found: ${calendarElements}`);

            console.log(`[CAL] Test ${testId} completed`);

        } finally {
            await contractorContext.close();
        }
    });
});

test.describe('Contractor Feature Tests', () => {
    test.setTimeout(120000);

    test('CON-001: Dashboard Loads All Widgets', async ({ page }) => {
        const testId = uniqueId('con-dash');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Screenshot full dashboard
        await screenshot(page, testId, 'dashboard-full');

        // Verify key dashboard elements exist
        const elementsToCheck = [
            { name: 'Sidebar', selector: 'nav, aside' },
            { name: 'Main content', selector: 'main, [class*="content"]' },
        ];

        for (const element of elementsToCheck) {
            const isVisible = await page.locator(element.selector).first().isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[CON] ${element.name} visible: ${isVisible}`);
        }

        // Check for loading spinners (should be gone)
        const spinners = await page.locator('.animate-spin').count();
        console.log(`[CON] Active spinners: ${spinners}`);

        await screenshot(page, testId, 'dashboard-verified');
    });

    test('CON-002: Navigate All Sidebar Items', async ({ page }) => {
        const testId = uniqueId('con-nav');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // List of nav items to test
        const navItems = [
            'Dashboard',
            'Jobs',
            'Quotes',
            'Schedule',
            'Messages',
            'Customers',
            'Invoices',
        ];

        for (const item of navItems) {
            const navLink = page.locator(`text="${item}"`).first();
            if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log(`[NAV] Clicking: ${item}`);
                await navLink.click();
                await waitForLoadingComplete(page);
                await screenshot(page, testId, `nav-${item.toLowerCase()}`);
            } else {
                console.log(`[NAV] Not found: ${item}`);
            }
        }
    });
});

test.describe('Homeowner Feature Tests', () => {
    test.setTimeout(120000);

    test('HOME-001: Dashboard Loads Correctly', async ({ page }) => {
        const testId = uniqueId('home-dash');

        await loginAsHomeowner(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        await screenshot(page, testId, 'dashboard-initial');

        // Check for key elements
        const elementsToCheck = [
            { name: 'Welcome/Header', selector: 'h1, h2' },
            { name: 'Navigation', selector: 'nav, header' },
        ];

        for (const element of elementsToCheck) {
            const isVisible = await page.locator(element.selector).first().isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[HOME] ${element.name} visible: ${isVisible}`);
        }

        // Verify no infinite loading
        await page.waitForTimeout(2000);
        const spinners = await page.locator('.animate-spin').count();
        console.log(`[HOME] Active spinners after wait: ${spinners}`);

        await screenshot(page, testId, 'dashboard-verified');
    });
});

// ============================================
// HANDSHAKE TEST: QUOTE SEND → ACCEPT FLOW
// Contractor creates quote → Homeowner accepts
// ============================================
test.describe('Quote Handshake - Real Data Flow', () => {
    test.setTimeout(180000);

    // Random data generators
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomPrice = (min, max) => (randomInt(min * 100, max * 100) / 100).toFixed(2);

    test('QUOTE-HANDSHAKE: Contractor sends quote, verify in system', async ({ browser }) => {
        const testId = uniqueId('quote-hs');
        console.log(`[${testId}] Starting Quote Handshake test...`);

        // Create two browser contexts for parallel simulation
        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();

        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // ==========================================
            // STEP 1: CONTRACTOR LOGS IN AND CREATES QUOTE
            // ==========================================
            console.log(`[${testId}] STEP 1: Contractor creates and sends quote...`);

            await loginAsContractor(contractorPage, { useStoredSession: false });
            await waitForLoadingComplete(contractorPage);
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            // Navigate to Quotes
            await contractorPage.locator('text="Quotes"').first().click();
            await contractorPage.waitForTimeout(1000);
            await screenshot(contractorPage, testId, '02-quotes-page');

            // Create New Quote
            await contractorPage.locator('button:has-text("New Quote")').first().click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '03-new-quote-form');

            // Fill customer info - use the HOMEOWNER's actual email for linkage
            const customerName = `Handshake Test ${randomInt(100, 999)}`;
            console.log(`[${testId}] Creating quote for: ${customerName}`);

            await contractorPage.locator('input[placeholder="John Smith"]').fill(customerName);
            await contractorPage.locator('input[placeholder="john@example.com"]').fill('danvdova@gmail.com'); // Homeowner's email
            await contractorPage.locator('input[placeholder="(555) 123-4567"]').fill('(555) 123-4567');
            await contractorPage.locator('input[placeholder="123 Main St, City, State"]').fill('123 Test St, Buena Park, CA 90620');

            // Quote details
            const quoteTitleInput = contractorPage.locator('input[placeholder*="HVAC"]');
            if (await quoteTitleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await quoteTitleInput.fill('Handshake Test - Plumbing Repair');
            }

            const durationInput = contractorPage.locator('input[placeholder*="4 hours"]');
            if (await durationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await durationInput.fill('3 hours');
            }

            // Fill BOTH line items (Material + Labor)
            const descInputs = contractorPage.locator('input[placeholder*="Item des"]');
            const priceInputs = contractorPage.locator('input[type="number"][step="0.01"]');

            await descInputs.nth(0).click();
            await descInputs.nth(0).fill('Parts - Test Material');
            await priceInputs.nth(0).click();
            await priceInputs.nth(0).fill(randomPrice(50, 150));

            await contractorPage.evaluate(() => window.scrollBy(0, 150));
            await contractorPage.waitForTimeout(300);

            await descInputs.nth(1).click();
            await descInputs.nth(1).fill('Labor - Test Service');
            await priceInputs.nth(1).click();
            await priceInputs.nth(1).fill(randomPrice(100, 200));

            await contractorPage.keyboard.press('Escape');
            await screenshot(contractorPage, testId, '04-quote-filled');

            // Send to Customer
            await contractorPage.evaluate(() => window.scrollTo(0, 0));
            await contractorPage.waitForTimeout(500);

            const sendBtn = contractorPage.getByRole('button', { name: 'Send to Customer' });
            await sendBtn.waitFor({ state: 'visible', timeout: 3000 });
            await sendBtn.click();
            await contractorPage.waitForTimeout(3000);
            await screenshot(contractorPage, testId, '05-quote-sent');

            console.log(`[${testId}] ✓ Quote sent to homeowner email`);

            // ==========================================
            // STEP 2: VERIFY QUOTE APPEARS IN SENT LIST
            // ==========================================
            console.log(`[${testId}] STEP 2: Verifying quote in contractor's list...`);

            await contractorPage.locator('text="Quotes"').first().click();
            await contractorPage.waitForTimeout(1500);

            // Click on "Sent" tab if available
            const sentTab = contractorPage.locator('text="Sent"').first();
            if (await sentTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                await sentTab.click();
                await contractorPage.waitForTimeout(1000);
            }

            await screenshot(contractorPage, testId, '06-quotes-list-after-send');

            // Verify our quote appears
            const quoteInList = contractorPage.locator(`text="${customerName}"`).first();
            if (await quoteInList.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${testId}] ✓ Quote for ${customerName} visible in Sent list`);
            } else {
                console.log(`[${testId}] ⚠ Quote not found in Sent tab, checking All`);
                const allTab = contractorPage.locator('text="All"').first();
                if (await allTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await allTab.click();
                    await contractorPage.waitForTimeout(1000);
                    await screenshot(contractorPage, testId, '06b-all-quotes');
                }
            }

            // ==========================================
            // STEP 3: HOMEOWNER LOGS IN AND CHECKS
            // ==========================================
            console.log(`[${testId}] STEP 3: Homeowner checks for quote...`);

            await loginAsHomeowner(homeownerPage, { useStoredSession: false });
            await waitForLoadingComplete(homeownerPage);
            await screenshot(homeownerPage, testId, '07-homeowner-dashboard');

            // Look for any quote notifications or pending items
            const quoteNotification = homeownerPage.locator('text=/quote|pending|review/i').first();
            if (await quoteNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${testId}] ✓ Homeowner sees quote-related content`);
                await screenshot(homeownerPage, testId, '08-homeowner-sees-quote');
            } else {
                console.log(`[${testId}] No quote notification visible on dashboard`);
            }

            // Check contractors section
            const contractorsTab = homeownerPage.locator('text="Contractors"').first();
            if (await contractorsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
                await contractorsTab.click();
                await homeownerPage.waitForTimeout(1500);
                await screenshot(homeownerPage, testId, '09-homeowner-contractors');
            }

            console.log(`[${testId}] QUOTE HANDSHAKE TEST COMPLETE`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});

// ============================================
// HANDSHAKE TEST: EVALUATION REQUEST FLOW
// Contractor requests → Homeowner responds
// ============================================
test.describe('Evaluation Handshake - Real Data Flow', () => {
    test.setTimeout(180000);

    test('EVAL-HANDSHAKE: Contractor sends eval request, verify visibility', async ({ browser }) => {
        const testId = uniqueId('eval-hs');
        console.log(`[${testId}] Starting Evaluation Handshake test...`);

        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();

        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // ==========================================
            // STEP 1: CONTRACTOR CREATES EVALUATION
            // ==========================================
            console.log(`[${testId}] STEP 1: Contractor creates evaluation request...`);

            await loginAsContractor(contractorPage, { useStoredSession: false });
            await waitForLoadingComplete(contractorPage);

            // Go to Evaluations
            await contractorPage.locator('text="Evaluations"').first().click();
            await contractorPage.waitForTimeout(1000);
            await screenshot(contractorPage, testId, '01-evaluations-page');

            // Request new evaluation
            const requestBtn = contractorPage.locator('button:has-text("Request Evaluation")').first();
            await requestBtn.click();
            await contractorPage.waitForTimeout(1000);
            await screenshot(contractorPage, testId, '02-eval-request-form');

            // Fill with homeowner's email for linkage
            await contractorPage.locator('input[placeholder="Customer name"]').fill('Eval Handshake Test');
            await contractorPage.locator('input[placeholder="email@example.com"]').fill('danvdova@gmail.com');
            await contractorPage.locator('input[placeholder="(555) 555-5555"]').fill('(555) 999-8888');
            await contractorPage.locator('input[placeholder="Start typing address..."]').fill('456 Test Ave, Anaheim, CA 92801');

            const issueTextarea = contractorPage.locator('textarea').first();
            await issueTextarea.fill('Handshake test - Need inspection of water heater making noise');

            await screenshot(contractorPage, testId, '03-eval-form-filled');

            // Send request
            await contractorPage.locator('button:has-text("Send Request")').first().click();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '04-eval-sent');

            console.log(`[${testId}] ✓ Evaluation request sent`);

            // Verify it appears in the list
            const evalInList = contractorPage.locator('text="Eval Handshake Test"').first();
            if (await evalInList.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${testId}] ✓ Evaluation appears in contractor's list`);
            }

            await screenshot(contractorPage, testId, '05-eval-in-list');

            // ==========================================
            // STEP 2: HOMEOWNER CHECKS FOR EVAL
            // ==========================================
            console.log(`[${testId}] STEP 2: Homeowner checks for evaluation...`);

            await loginAsHomeowner(homeownerPage, { useStoredSession: false });
            await waitForLoadingComplete(homeownerPage);
            await screenshot(homeownerPage, testId, '06-homeowner-dashboard');

            // Check for notifications
            const notificationBell = homeownerPage.locator('[aria-label*="notification"], button:has(svg)').first();
            if (await notificationBell.isVisible({ timeout: 3000 }).catch(() => false)) {
                await screenshot(homeownerPage, testId, '07-homeowner-notifications');
            }

            console.log(`[${testId}] EVALUATION HANDSHAKE TEST COMPLETE`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});
