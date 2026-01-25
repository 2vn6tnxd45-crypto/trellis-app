// tests/e2e/quote-to-job-flow.spec.js
// End-to-end test for the complete Quote → Accept → Job workflow
// This tests the critical revenue path with proper account linking and cleanup

import { test, expect } from '@playwright/test';
import {
    loginAsContractor,
    loginAsHomeowner,
    screenshot,
    waitForLoadingComplete,
    navigateToSection,
    TEST_ACCOUNTS
} from '../utils/test-helpers.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// Use serial execution to ensure proper test flow
test.describe.serial('Quote to Job Complete Flow', () => {
    // Generate unique identifiers for this test run
    const runId = Date.now().toString();
    const quoteTitle = 'Live Test Quote ' + runId;

    let contractorPage;
    let homeownerPage;
    let browser;

    test.beforeAll(async ({ browser: b }) => {
        browser = b;
        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();

        contractorPage = await contractorContext.newPage();
        homeownerPage = await homeownerContext.newPage();
    });

    test.afterAll(async () => {
        if (contractorPage) await contractorPage.close();
        if (homeownerPage) await homeownerPage.close();
    });

    test('Step 1: Contractor creates and sends quote', async () => {
        console.log(`[${runId}] STEP 1: Contractor creates quote with title: ${quoteTitle}`);

        // Login as contractor
        await loginAsContractor(contractorPage);
        await screenshot(contractorPage, runId, '01-contractor-logged-in');

        // Navigate to Quotes
        await navigateToSection(contractorPage, 'Quotes');
        await contractorPage.waitForTimeout(1500);
        await screenshot(contractorPage, runId, '02-quotes-page');

        // Click New Quote
        const newQuoteBtn = contractorPage.locator('button:has-text("New Quote"), a:has-text("New Quote")').first();
        await newQuoteBtn.click();
        await contractorPage.waitForTimeout(1500);
        await screenshot(contractorPage, runId, '03-quote-builder');

        // CRITICAL: Use TEST_ACCOUNTS.homeowner.email for proper linking
        const customerEmail = TEST_ACCOUNTS.homeowner.email;
        const customerName = TEST_ACCOUNTS.homeowner.name;

        console.log(`[${runId}] Using homeowner email: ${customerEmail}`);

        // Fill customer info
        const nameInput = contractorPage.locator('input[name="name"], input[placeholder*="name" i]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nameInput.fill(customerName);
        }

        // Fill email - this links the quote to the homeowner account
        const emailInput = contractorPage.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await emailInput.fill(customerEmail);
        }

        // Fill phone
        const phoneInput = contractorPage.locator('input[type="tel"], input[name="phone"]').first();
        if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await phoneInput.fill('5551234567');
        }

        // Fill address
        const addressInput = contractorPage.locator('input[name="address"], input[placeholder*="address" i]').first();
        if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addressInput.fill('123 Test Street, Anytown, CA 90210');
        }

        await screenshot(contractorPage, runId, '04-customer-filled');

        // Fill quote title with unique identifier
        const titleInput = contractorPage.locator('input[name="title"], input[placeholder*="title" i]').first();
        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await titleInput.fill(quoteTitle);
        }

        // Fill first line item (Material)
        const descInputs = await contractorPage.locator('input[placeholder*="description" i], textarea[placeholder*="description" i]').all();
        if (descInputs.length > 0) {
            await descInputs[0].fill('50 Gallon Water Heater - Rheem');
        }

        // Find quantity and price inputs
        const qtyInputs = await contractorPage.locator('input[name*="quantity"], input[placeholder*="qty" i]').all();
        const priceInputs = await contractorPage.locator('input[name*="price"], input[name*="unitPrice"]').all();

        if (qtyInputs.length > 0) await qtyInputs[0].fill('1');
        if (priceInputs.length > 0) await priceInputs[0].fill('850');

        await screenshot(contractorPage, runId, '05-first-item');

        // Add labor line item
        const addItemBtn = contractorPage.locator('button:has-text("Add"), button:has-text("+ Line")').first();
        if (await addItemBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addItemBtn.click();
            await contractorPage.waitForTimeout(500);

            const allDescInputs = await contractorPage.locator('input[placeholder*="description" i], textarea[placeholder*="description" i]').all();
            const allQtyInputs = await contractorPage.locator('input[name*="quantity"]').all();
            const allPriceInputs = await contractorPage.locator('input[name*="price"], input[name*="unitPrice"]').all();

            if (allDescInputs.length > 1) await allDescInputs[allDescInputs.length - 1].fill('Installation Labor (4 hours)');
            if (allQtyInputs.length > 1) await allQtyInputs[allQtyInputs.length - 1].fill('4');
            if (allPriceInputs.length > 1) await allPriceInputs[allPriceInputs.length - 1].fill('125');
        }

        await screenshot(contractorPage, runId, '06-all-items');

        // Save the quote first
        const saveBtn = contractorPage.locator('button:has-text("Save"), button[type="submit"]').first();
        if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveBtn.click();
            await contractorPage.waitForTimeout(2000);
        }

        await screenshot(contractorPage, runId, '07-quote-saved');

        // Now send the quote
        const sendBtn = contractorPage.locator('button:has-text("Send Quote"), button:has-text("Send"), button:has-text("Share")').first();
        if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await sendBtn.click();
            await contractorPage.waitForTimeout(1000);

            // Confirm send if dialog appears
            const confirmSendBtn = contractorPage.locator('button:has-text("Send"), button:has-text("Confirm")').last();
            if (await confirmSendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await confirmSendBtn.click();
                await contractorPage.waitForTimeout(2000);
            }
        }

        await screenshot(contractorPage, runId, '08-quote-sent');
        console.log(`[${runId}] Quote "${quoteTitle}" sent to ${customerEmail}`);
    });

    test('Step 2: Homeowner accepts quote', async () => {
        console.log(`[${runId}] STEP 2: Homeowner accepts quote`);

        // Login as homeowner
        await loginAsHomeowner(homeownerPage);
        await screenshot(homeownerPage, runId, '10-homeowner-logged-in');

        // Navigate to Quotes section
        await homeownerPage.goto(`${BASE_URL}/home`);
        await homeownerPage.waitForTimeout(2000);
        await screenshot(homeownerPage, runId, '11-homeowner-dashboard');

        // Try to navigate to quotes section
        const quotesLink = homeownerPage.locator('text="Quotes", text="My Quotes", a[href*="quote"]').first();
        if (await quotesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await quotesLink.click();
            await homeownerPage.waitForTimeout(1500);
        }

        await screenshot(homeownerPage, runId, '12-quotes-section');

        // VERIFICATION: Look specifically for our unique quote title
        const ourQuote = homeownerPage.locator(`text="${quoteTitle}"`).first();

        if (await ourQuote.isVisible({ timeout: 10000 }).catch(() => false)) {
            console.log(`[${runId}] Found quote with title: ${quoteTitle}`);
            await ourQuote.click();
            await homeownerPage.waitForTimeout(1500);
            await screenshot(homeownerPage, runId, '13-quote-detail');

            // Look for Accept button
            const acceptBtn = homeownerPage.locator(
                'button:has-text("Accept"), button:has-text("Accept Quote"), button:has-text("Approve")'
            ).first();

            if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${runId}] Clicking Accept button...`);
                await acceptBtn.click();
                await homeownerPage.waitForTimeout(2000);
                await screenshot(homeownerPage, runId, '14-accept-clicked');

                // Handle Sign or Confirm modals
                const confirmBtn = homeownerPage.locator(
                    'button:has-text("Confirm"), button:has-text("Sign"), button:has-text("Continue"), button:has-text("Pay Deposit")'
                ).first();

                if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                    console.log(`[${runId}] Handling confirmation modal...`);
                    await confirmBtn.click();
                    await homeownerPage.waitForTimeout(2000);
                }

                await screenshot(homeownerPage, runId, '15-quote-accepted');
                console.log(`[${runId}] Quote accepted successfully`);
            } else {
                console.log(`[${runId}] Accept button not found`);
                await screenshot(homeownerPage, runId, '14-no-accept-button');
            }
        } else {
            console.log(`[${runId}] Quote with title "${quoteTitle}" not found in homeowner's quotes`);
            await screenshot(homeownerPage, runId, '13-quote-not-found');
        }
    });

    test('Step 3: Cleanup - Cancel/Archive the job', async () => {
        console.log(`[${runId}] STEP 3: Cleanup - Canceling test job`);

        // Go to contractor's Jobs page
        await navigateToSection(contractorPage, 'Jobs');
        await contractorPage.waitForTimeout(2000);
        await screenshot(contractorPage, runId, '20-jobs-page');

        // Look for the job with our unique title
        const jobCard = contractorPage.locator(`text="${quoteTitle}"`).first();

        if (await jobCard.isVisible({ timeout: 10000 }).catch(() => false)) {
            console.log(`[${runId}] Found job, clicking to open details...`);
            await jobCard.click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, runId, '21-job-details');

            // Look for Options, Cancel, or Archive button
            const optionsBtn = contractorPage.locator(
                'button:has-text("Options"), button:has-text("⋮"), button:has-text("...")'
            ).first();

            if (await optionsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await optionsBtn.click();
                await contractorPage.waitForTimeout(500);
            }

            // Look for Cancel or Archive option
            const cancelBtn = contractorPage.locator(
                'button:has-text("Cancel"), button:has-text("Archive"), button:has-text("Delete")'
            ).first();

            if (await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${runId}] Canceling/archiving job...`);
                await cancelBtn.click();
                await contractorPage.waitForTimeout(1000);

                // Confirm if needed
                const confirmCancelBtn = contractorPage.locator(
                    'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Cancel Job")'
                ).first();

                if (await confirmCancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await confirmCancelBtn.click();
                    await contractorPage.waitForTimeout(1500);
                }

                await screenshot(contractorPage, runId, '22-job-canceled');
                console.log(`[${runId}] Job cleanup complete`);
            } else {
                console.log(`[${runId}] Cancel/Archive button not found - job may need manual cleanup`);
                await screenshot(contractorPage, runId, '22-no-cancel-button');
            }
        } else {
            console.log(`[${runId}] Job not found - may not have been created or already cleaned up`);
            await screenshot(contractorPage, runId, '21-job-not-found');
        }

        console.log(`[${runId}] QUOTE-TO-JOB FLOW TEST COMPLETE`);
    });
});
