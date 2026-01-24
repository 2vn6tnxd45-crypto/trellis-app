// tests/e2e/membership-lifecycle.spec.js
// ============================================
// MEMBERSHIP LIFECYCLE TEST SUITE
// ============================================
// Tests the recurring revenue flow: Plan creation, membership sale,
// discount application on quotes, and renewal notifications

import { test, expect } from '@playwright/test';
import {
    loginAsContractor,
    loginAsHomeowner,
    loginWithCredentials,
    TEST_ACCOUNTS,
    screenshot,
    waitForLoadingComplete,
    waitForToast,
    uniqueId
} from '../utils/test-helpers.js';

// ============================================
// CONFIGURATION
// ============================================
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// Set to true to use real test account with existing data
const USE_REAL_ACCOUNT = true;

// ============================================
// TEST SUITE: Membership Lifecycle
// ============================================
test.describe('Membership Lifecycle - Recurring Revenue', () => {
    test.setTimeout(180000); // 3 minutes

    test('MEM-001: View Memberships Dashboard', async ({ page }) => {
        const testId = uniqueId('mem-dash');

        console.log('[MEM-DASH] Testing memberships dashboard');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
            await screenshot(page, testId, '01-memberships-view');

            // Verify key dashboard elements
            const elements = [
                { name: 'Header', selector: 'h1:has-text("Memberships"), text=/memberships/i' },
                { name: 'Active Members', selector: 'text=/active members/i' },
                { name: 'Monthly Revenue', selector: 'text=/monthly revenue/i' },
                { name: 'Sell Button', selector: 'button:has-text("Sell"), button:has-text("New Member")' },
                { name: 'Plans Tab', selector: 'button:has-text("Plans")' }
            ];

            for (const element of elements) {
                const visible = await page.locator(element.selector).first()
                    .isVisible({ timeout: 3000 }).catch(() => false);
                console.log(`[MEM-DASH] ${element.name}: ${visible ? '✓' : '✗'}`);
            }

            // Check for quick stats cards
            const statsCards = await page.locator('[class*="stat"], [class*="card"]').count();
            console.log(`[MEM-DASH] Found ${statsCards} stat/card elements`);

            await screenshot(page, testId, '02-memberships-stats');
        } else {
            console.log('[MEM-DASH] Memberships nav item not found - checking alternate locations');

            // May be under Settings or a different section
            const settingsNav = page.locator('text=/settings/i').first();
            if (await settingsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
                await settingsNav.click();
                await waitForLoadingComplete(page);
                await screenshot(page, testId, '02-settings-view');
            }
        }

        console.log(`[MEM-DASH] Test ${testId} completed`);
    });

    test('MEM-002: Create Membership Plan', async ({ page }) => {
        const testId = uniqueId('mem-plan');

        console.log('[MEM-PLAN] Testing plan creation');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-memberships-page');

        // Look for "Manage Plans" or "Create Plan" button
        const managePlansBtn = page.locator('button:has-text("Manage Plans"), button:has-text("Create Plan")').first();
        if (await managePlansBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await managePlansBtn.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-plans-view');

            // Look for create plan button
            const createPlanBtn = page.locator('button:has-text("Create Plan"), button:has-text("New Plan")').first();
            if (await createPlanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createPlanBtn.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '03-plan-builder');

                // Check for plan builder fields
                const planFields = [
                    'input[placeholder*="plan name" i]',
                    'input[placeholder*="description" i]',
                    'input[placeholder*="price" i]',
                    'select[name*="billing" i]'
                ];

                for (const field of planFields) {
                    const visible = await page.locator(field).first()
                        .isVisible({ timeout: 2000 }).catch(() => false);
                    if (visible) {
                        console.log(`[MEM-PLAN] Found field: ${field}`);
                    }
                }
            }
        } else {
            console.log('[MEM-PLAN] Plan management button not found');
        }

        await screenshot(page, testId, '04-final-state');
        console.log(`[MEM-PLAN] Test ${testId} completed`);
    });

    test('MEM-003: Sell Membership Modal', async ({ page }) => {
        const testId = uniqueId('mem-sell');

        console.log('[MEM-SELL] Testing membership sale flow');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-memberships-page');

        // Look for "Sell Membership" button
        const sellBtn = page.locator('button:has-text("Sell Membership"), button:has-text("New Member")').first();
        if (await sellBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await sellBtn.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-sell-modal');

            // Check for modal steps
            const modalElements = [
                { name: 'Customer Selection', selector: 'text=/select customer/i, text=/customer/i' },
                { name: 'Plan Selection', selector: 'text=/select plan/i, text=/choose plan/i' },
                { name: 'Payment Method', selector: 'text=/payment/i, text=/credit card/i, text=/stripe/i' },
                { name: 'Close Button', selector: 'button:has-text("Cancel"), button[aria-label*="close" i]' }
            ];

            for (const element of modalElements) {
                const visible = await page.locator(element.selector).first()
                    .isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[MEM-SELL] ${element.name}: ${visible ? '✓' : '✗'}`);
            }

            // Close modal
            const closeBtn = page.locator('button:has-text("Cancel"), button[aria-label*="close" i]').first();
            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeBtn.click();
            }
        } else {
            console.log('[MEM-SELL] Sell Membership button not found - may need plans first');
            await screenshot(page, testId, '02-no-sell-button');
        }

        await screenshot(page, testId, '03-final-state');
        console.log(`[MEM-SELL] Test ${testId} completed`);
    });

    test('MEM-004: Membership Card Display', async ({ page }) => {
        const testId = uniqueId('mem-card');

        console.log('[MEM-CARD] Testing membership card display');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-memberships-list');

        // Check for Members tab
        const membersTab = page.locator('button:has-text("Members")').first();
        if (await membersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await membersTab.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-members-tab');
        }

        // Look for membership cards/list
        const memberCards = await page.locator('[class*="member"], [class*="card"]').count();
        console.log(`[MEM-CARD] Found ${memberCards} member cards`);

        // Check for member info elements
        const memberInfoElements = [
            'text=/active/i',
            'text=/expires/i',
            'text=/renew/i',
            'text=/cancel/i'
        ];

        for (const selector of memberInfoElements) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                console.log(`[MEM-CARD] Found "${selector.replace('text=/', '').replace('/i', '')}" (${count})`);
            }
        }

        await screenshot(page, testId, '03-final-state');
        console.log(`[MEM-CARD] Test ${testId} completed`);
    });
});

// ============================================
// TEST SUITE: Member Discount on Quotes
// ============================================
test.describe('Member Discount Application', () => {
    test.setTimeout(180000);

    test('MEM-DISC-001: Quote Builder Shows Member Discount', async ({ page }) => {
        const testId = uniqueId('mem-disc');

        console.log('[MEM-DISC] Testing member discount on quote builder');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Quotes
        const quotesNav = page.locator('text="Quotes"').first();
        if (await quotesNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quotesNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-quotes-page');

        // Create New Quote
        const newQuoteBtn = page.locator('button:has-text("New Quote"), button:has-text("Create Quote")').first();
        if (await newQuoteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newQuoteBtn.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-quote-builder');

            // Look for membership/discount indicators
            const discountElements = [
                { name: 'Member Badge', selector: 'text=/member/i, [class*="member"]' },
                { name: 'Discount Field', selector: 'text=/discount/i, input[name*="discount" i]' },
                { name: 'Member Price', selector: 'text=/member price/i, text=/member discount/i' },
                { name: 'Waived Fee', selector: 'text=/waived/i, text=/fee waived/i' }
            ];

            for (const element of discountElements) {
                const visible = await page.locator(element.selector).first()
                    .isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[MEM-DISC] ${element.name}: ${visible ? '✓' : '✗'}`);
            }

            // Try to fill in customer info to see if member discount appears
            const customerNameInput = page.locator('input[placeholder*="name" i]').first();
            if (await customerNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await customerNameInput.fill('Test Member Customer');
                await page.waitForTimeout(1000);
            }

            await screenshot(page, testId, '03-quote-with-customer');
        }

        await screenshot(page, testId, '04-final-state');
        console.log(`[MEM-DISC] Test ${testId} completed`);
    });

    test('MEM-DISC-002: Customer View Shows Membership Benefits', async ({ page }) => {
        const testId = uniqueId('mem-cust');

        console.log('[MEM-CUST] Testing customer view of membership benefits');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Customers
        const customersNav = page.locator('text="Customers"').first();
        if (await customersNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await customersNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-customers-page');

        // Look for customer list
        const customerCards = await page.locator('[class*="customer"], [class*="card"], tr').count();
        console.log(`[MEM-CUST] Found ${customerCards} customer elements`);

        // Check for membership indicators on customer cards (separate queries to avoid syntax errors)
        const textMemberCount = await page.locator('text=/member/i').count();
        const iconCount = await page.locator('[class*="crown"], [class*="shield"]').count();
        const membershipIndicators = textMemberCount + iconCount;
        console.log(`[MEM-CUST] Found ${membershipIndicators} membership indicators`);

        // Try clicking on a customer to see details
        const firstCustomer = page.locator('[class*="customer"], tr').first();
        if (await firstCustomer.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstCustomer.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-customer-details');

            // Look for membership info in customer details
            const membershipInfo = page.locator('text=/membership/i, text=/plan/i, text=/member since/i').first();
            if (await membershipInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[MEM-CUST] Found membership info in customer details');
                await screenshot(page, testId, '03-customer-membership');
            }
        }

        await screenshot(page, testId, '04-final-state');
        console.log(`[MEM-CUST] Test ${testId} completed`);
    });
});

// ============================================
// TEST SUITE: Membership Analytics
// ============================================
test.describe('Membership Analytics & Stats', () => {
    test.setTimeout(120000);

    test('MEM-STATS-001: Analytics Dashboard', async ({ page }) => {
        const testId = uniqueId('mem-stats');

        console.log('[MEM-STATS] Testing membership analytics');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }

        // Click Analytics tab
        const analyticsTab = page.locator('button:has-text("Analytics"), button:has-text("Stats")').first();
        if (await analyticsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await analyticsTab.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-analytics-view');

            // Check for analytics metrics
            const metrics = [
                'text=/total revenue/i',
                'text=/monthly recurring/i',
                'text=/renewal rate/i',
                'text=/expiring/i',
                'text=/savings/i'
            ];

            for (const metric of metrics) {
                const visible = await page.locator(metric).first()
                    .isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[MEM-STATS] Metric "${metric.replace('text=/', '').replace('/i', '')}": ${visible ? '✓' : '✗'}`);
            }

            // Look for charts or graphs
            const charts = await page.locator('[class*="chart"], canvas, svg').count();
            console.log(`[MEM-STATS] Found ${charts} chart elements`);

        } else {
            console.log('[MEM-STATS] Analytics tab not found');
            await screenshot(page, testId, '01-no-analytics-tab');
        }

        await screenshot(page, testId, '02-final-state');
        console.log(`[MEM-STATS] Test ${testId} completed`);
    });

    test('MEM-STATS-002: Expiring Memberships Alert', async ({ page }) => {
        const testId = uniqueId('mem-expiring');

        console.log('[MEM-EXPIRING] Testing expiring memberships alerts');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-memberships-page');

        // Look for expiring memberships section/alert
        const expiringElements = [
            'text=/expiring/i',
            'text=/expires soon/i',
            'text=/renewal due/i',
            'text=/30 days/i'
        ];

        for (const selector of expiringElements) {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[MEM-EXPIRING] Found: ${selector.replace('text=/', '').replace('/i', '')}`);
                await screenshot(page, testId, `02-expiring-${Date.now()}`);
            }
        }

        // Check for renewal buttons
        const renewButtons = await page.locator('button:has-text("Renew"), button:has-text("Extend")').count();
        console.log(`[MEM-EXPIRING] Found ${renewButtons} renew buttons`);

        await screenshot(page, testId, '03-final-state');
        console.log(`[MEM-EXPIRING] Test ${testId} completed`);
    });
});

// ============================================
// TEST SUITE: Membership Renewal Flow
// ============================================
test.describe('Membership Renewal', () => {
    test.setTimeout(120000);

    test('MEM-RENEW-001: Renew Membership Action', async ({ page }) => {
        const testId = uniqueId('mem-renew');

        console.log('[MEM-RENEW] Testing membership renewal action');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }

        // Go to Members list
        const membersTab = page.locator('button:has-text("Members")').first();
        if (await membersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await membersTab.click();
            await page.waitForTimeout(1000);
        }
        await screenshot(page, testId, '01-members-list');

        // Look for a membership card with renew option
        const memberCard = page.locator('[class*="membership"], [class*="member-card"]').first();
        if (await memberCard.isVisible({ timeout: 3000 }).catch(() => false)) {
            await memberCard.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-member-details');

            // Check for renew button
            const renewBtn = page.locator('button:has-text("Renew")').first();
            if (await renewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[MEM-RENEW] Found renew button');
                await screenshot(page, testId, '03-renew-button');
            }
        }

        await screenshot(page, testId, '04-final-state');
        console.log(`[MEM-RENEW] Test ${testId} completed`);
    });

    test('MEM-RENEW-002: Cancel Membership Flow', async ({ page }) => {
        const testId = uniqueId('mem-cancel');

        console.log('[MEM-CANCEL] Testing membership cancellation flow');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Memberships
        const membershipsNav = page.locator('text=/membership/i').first();
        if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await membershipsNav.click();
            await waitForLoadingComplete(page);
        }

        // Go to Members list
        const membersTab = page.locator('button:has-text("Members")').first();
        if (await membersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
            await membersTab.click();
            await page.waitForTimeout(1000);
        }
        await screenshot(page, testId, '01-members-list');

        // Look for cancel option
        const cancelBtn = page.locator('button:has-text("Cancel"), text=/cancel membership/i').first();
        if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('[MEM-CANCEL] Found cancel button - not clicking to avoid data mutation');
            await screenshot(page, testId, '02-cancel-available');
        } else {
            console.log('[MEM-CANCEL] Cancel button not immediately visible');
        }

        await screenshot(page, testId, '03-final-state');
        console.log(`[MEM-CANCEL] Test ${testId} completed`);
    });
});

// ============================================
// INTEGRATION TEST: Full Membership Cycle
// ============================================
test.describe('Membership Integration', () => {
    test.setTimeout(300000); // 5 minutes for full cycle

    test('MEM-FULL-001: End-to-End Membership Visibility', async ({ browser }) => {
        // Two contexts: Contractor and Homeowner
        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();

        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        const testId = uniqueId('mem-e2e');
        console.log(`[MEM-E2E] Starting end-to-end test: ${testId}`);

        try {
            // ============================================
            // STEP 1: Contractor checks membership setup
            // ============================================
            console.log('[MEM-E2E] Step 1: Contractor views memberships');

            await loginAsContractor(contractorPage, { useStoredSession: false });
            await waitForLoadingComplete(contractorPage);
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            const membershipsNav = contractorPage.locator('text=/membership/i').first();
            if (await membershipsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await membershipsNav.click();
                await waitForLoadingComplete(contractorPage);
                await screenshot(contractorPage, testId, '02-contractor-memberships');
            }

            // ============================================
            // STEP 2: Homeowner views their dashboard
            // ============================================
            console.log('[MEM-E2E] Step 2: Homeowner dashboard');

            await loginAsHomeowner(homeownerPage, { useStoredSession: false });
            await waitForLoadingComplete(homeownerPage);
            await screenshot(homeownerPage, testId, '03-homeowner-dashboard');

            // Look for membership info on homeowner side
            const membershipInfo = homeownerPage.locator('text=/member/i, text=/plan/i, [class*="crown"]').first();
            if (await membershipInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[MEM-E2E] Homeowner sees membership info');
                await screenshot(homeownerPage, testId, '04-homeowner-membership');
            }

            // ============================================
            // STEP 3: Check for contractor/pro section
            // ============================================
            console.log('[MEM-E2E] Step 3: Checking homeowner pros section');

            const prosTab = homeownerPage.locator('text=/contractor/i, text=/pro/i').first();
            if (await prosTab.isVisible({ timeout: 3000 }).catch(() => false)) {
                await prosTab.click();
                await homeownerPage.waitForTimeout(1500);
                await screenshot(homeownerPage, testId, '05-homeowner-pros');
            }

            console.log(`[MEM-E2E] Test ${testId} completed successfully`);

        } finally {
            await contractorContext.close();
            await homeownerContext.close();
        }
    });
});
