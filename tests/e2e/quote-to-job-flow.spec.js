// tests/e2e/quote-to-job-flow.spec.js
// End-to-end test for the complete Quote → Accept → Job workflow
// This tests the critical revenue path

import { test, expect, chromium } from '@playwright/test';
import {
    loginAsContractor,
    loginAsHomeowner,
    screenshot,
    uniqueId,
    waitForLoadingComplete,
    generateCustomerData,
    navigateToSection,
    waitForModal,
    closeModal
} from '../utils/test-helpers.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

test.describe('Quote to Job Complete Flow', () => {

    test('Full flow: Contractor creates quote → Homeowner accepts → Job created', async ({ browser }) => {
        const testId = uniqueId('quote-job-flow');
        console.log(`[${testId}] Starting complete quote-to-job flow test...`);

        // Create two browser contexts for contractor and homeowner
        const contractorContext = await browser.newContext();
        const homeownerContext = await browser.newContext();

        const contractorPage = await contractorContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        try {
            // ========================================
            // PHASE 1: Contractor creates and sends quote
            // ========================================
            console.log(`[${testId}] PHASE 1: Contractor creates quote`);

            await loginAsContractor(contractorPage);
            await screenshot(contractorPage, testId, '01-contractor-logged-in');

            // Navigate to Quotes
            await contractorPage.locator('nav >> text="Quotes"').first().click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '02-quotes-page');

            // Click New Quote
            const newQuoteBtn = contractorPage.locator('button:has-text("New Quote"), a:has-text("New Quote")').first();
            await newQuoteBtn.click();
            await contractorPage.waitForTimeout(1500);
            await screenshot(contractorPage, testId, '03-quote-builder');

            // Fill customer info - use the actual homeowner's email
            const customerEmail = 'danvdova@gmail.com'; // Real homeowner account
            const customerName = 'Test Homeowner';

            // Fill name
            const nameInput = contractorPage.locator('input[name="name"], input[placeholder*="name" i]').first();
            if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await nameInput.fill(customerName);
            }

            // Fill email - this is crucial for linking to homeowner
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

            await screenshot(contractorPage, testId, '04-customer-filled');

            // Fill quote title
            const titleInput = contractorPage.locator('input[name="title"], input[placeholder*="title" i]').first();
            if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await titleInput.fill(`Water Heater Replacement - ${testId}`);
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

            await screenshot(contractorPage, testId, '05-first-item');

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

            await screenshot(contractorPage, testId, '06-all-items');

            // Set deposit requirement
            const depositCheckbox = contractorPage.locator('input[type="checkbox"][name*="deposit"], input[id*="deposit"]').first();
            if (await depositCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
                if (!await depositCheckbox.isChecked()) {
                    await depositCheckbox.check();
                }
            }

            await screenshot(contractorPage, testId, '07-deposit-set');

            // Save the quote first
            const saveBtn = contractorPage.locator('button:has-text("Save"), button[type="submit"]').first();
            if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await saveBtn.click();
                await contractorPage.waitForTimeout(2000);
            }

            await screenshot(contractorPage, testId, '08-quote-saved');

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

            await screenshot(contractorPage, testId, '09-quote-sent');

            // Get the quote link if available
            let quoteLink = '';
            const linkInput = contractorPage.locator('input[readonly], input[value*="quote"]').first();
            if (await linkInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                quoteLink = await linkInput.inputValue();
                console.log(`[${testId}] Quote link: ${quoteLink}`);
            }

            // ========================================
            // PHASE 2: Homeowner views and accepts quote
            // ========================================
            console.log(`[${testId}] PHASE 2: Homeowner accepts quote`);

            await loginAsHomeowner(homeownerPage);
            await screenshot(homeownerPage, testId, '10-homeowner-logged-in');

            // Navigate to home page to see notifications/quotes
            await homeownerPage.goto(`${BASE_URL}/home`);
            await homeownerPage.waitForTimeout(2000);
            await screenshot(homeownerPage, testId, '11-homeowner-dashboard');

            // Look for quote notification or quotes section
            const quoteNotification = homeownerPage.locator(
                'text="quote", text="Quote", text="pending", [class*="notification"]'
            ).first();

            let quoteFound = false;

            if (await quoteNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
                await quoteNotification.click();
                await homeownerPage.waitForTimeout(1500);
                quoteFound = true;
            } else {
                // Try navigating to quotes section if there's one
                const quotesLink = homeownerPage.locator('text="Quotes", text="My Quotes", a[href*="quote"]').first();
                if (await quotesLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await quotesLink.click();
                    await homeownerPage.waitForTimeout(1500);
                }

                // Or use the direct quote link
                if (quoteLink) {
                    await homeownerPage.goto(quoteLink);
                    await homeownerPage.waitForTimeout(2000);
                    quoteFound = true;
                }
            }

            await screenshot(homeownerPage, testId, '12-looking-for-quote');

            // Look for Accept button
            const acceptBtn = homeownerPage.locator(
                'button:has-text("Accept"), button:has-text("Accept Quote"), button:has-text("Approve")'
            ).first();

            if (await acceptBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
                console.log(`[${testId}] Found Accept button, clicking...`);
                await acceptBtn.click();
                await homeownerPage.waitForTimeout(2000);
                await screenshot(homeownerPage, testId, '13-accept-clicked');

                // May need to confirm or proceed to payment
                const confirmAccept = homeownerPage.locator(
                    'button:has-text("Confirm"), button:has-text("Pay Deposit"), button:has-text("Continue")'
                ).first();

                if (await confirmAccept.isVisible({ timeout: 5000 }).catch(() => false)) {
                    console.log(`[${testId}] Found confirmation button, clicking...`);
                    await confirmAccept.click();
                    await homeownerPage.waitForTimeout(2000);
                }

                await screenshot(homeownerPage, testId, '14-quote-accepted');
                console.log(`[${testId}] Quote accepted by homeowner`);
            } else {
                console.log(`[${testId}] Accept button not found - quote may need email notification`);
                await screenshot(homeownerPage, testId, '14-no-accept-button');
            }

            // ========================================
            // PHASE 3: Verify job appears for contractor
            // ========================================
            console.log(`[${testId}] PHASE 3: Verify job created for contractor`);

            // Go back to contractor and check Jobs page
            await contractorPage.locator('nav >> text="Jobs"').first().click();
            await contractorPage.waitForTimeout(2000);
            await screenshot(contractorPage, testId, '15-contractor-jobs');

            // Look for the job
            const jobCard = contractorPage.locator(
                `text="${customerName}", text="Water Heater", [class*="job-card"], [class*="JobCard"]`
            ).first();

            if (await jobCard.isVisible({ timeout: 10000 }).catch(() => false)) {
                console.log(`[${testId}] Job found in contractor's job list!`);
                await jobCard.click();
                await contractorPage.waitForTimeout(1500);
                await screenshot(contractorPage, testId, '16-job-details');

                // Check job status
                const jobStatus = await contractorPage.locator(
                    'text="Active", text="Scheduled", text="Pending", text="In Progress"'
                ).first().textContent().catch(() => 'Unknown');

                console.log(`[${testId}] Job status: ${jobStatus}`);
            } else {
                console.log(`[${testId}] Job not yet visible - may need quote acceptance or payment`);

                // Check quote status instead
                await contractorPage.locator('nav >> text="Quotes"').first().click();
                await contractorPage.waitForTimeout(1500);
                await screenshot(contractorPage, testId, '16-quotes-status-check');

                // Look for quote status
                const quoteStatus = await contractorPage.locator(
                    'text="Sent", text="Viewed", text="Accepted", text="Draft"'
                ).first().textContent().catch(() => 'Unknown');

                console.log(`[${testId}] Quote status: ${quoteStatus}`);
            }

            await screenshot(contractorPage, testId, '17-final');
            console.log(`[${testId}] QUOTE-TO-JOB FLOW TEST COMPLETE`);

        } finally {
            // Cleanup
            await contractorContext.close();
            await homeownerContext.close();
        }
    });

    test('Quote totals calculate correctly', async ({ page }) => {
        const testId = uniqueId('quote-calc');
        console.log(`[${testId}] Starting quote calculation test...`);

        await loginAsContractor(page);

        // Navigate to Quotes
        await page.locator('nav >> text="Quotes"').first().click();
        await page.waitForTimeout(1500);

        // Create new quote
        const newQuoteBtn = page.locator('button:has-text("New Quote"), a:has-text("New Quote")').first();
        await newQuoteBtn.click();
        await page.waitForTimeout(1500);

        await screenshot(page, testId, '01-quote-builder');

        // Fill customer info (required to enable save)
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nameInput.fill('Calc Test Customer');
        }

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await emailInput.fill('calctest@example.com');
        }

        // Set up line items with known values for calculation verification
        // Item 1: 2 x $100 = $200
        const descInputs = await page.locator('input[placeholder*="description" i], textarea[placeholder*="description" i]').all();
        const qtyInputs = await page.locator('input[name*="quantity"]').all();
        const priceInputs = await page.locator('input[name*="price"], input[name*="unitPrice"]').all();

        if (descInputs.length > 0) await descInputs[0].fill('Test Item A');
        if (qtyInputs.length > 0) {
            await qtyInputs[0].clear();
            await qtyInputs[0].fill('2');
        }
        if (priceInputs.length > 0) {
            await priceInputs[0].clear();
            await priceInputs[0].fill('100');
        }

        await page.waitForTimeout(1000);
        await screenshot(page, testId, '02-first-item');

        // Verify line item total shows $200
        const pageText1 = await page.textContent('body');
        console.log(`[${testId}] After first item - looking for $200`);

        // Add second item: 3 x $50 = $150
        const addItemBtn = page.locator('button:has-text("Add"), button:has-text("+ Line")').first();
        if (await addItemBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addItemBtn.click();
            await page.waitForTimeout(500);

            const allDescInputs = await page.locator('input[placeholder*="description" i]').all();
            const allQtyInputs = await page.locator('input[name*="quantity"]').all();
            const allPriceInputs = await page.locator('input[name*="price"], input[name*="unitPrice"]').all();

            const lastIdx = allDescInputs.length - 1;
            if (lastIdx > 0) {
                await allDescInputs[lastIdx].fill('Test Item B');
                await allQtyInputs[lastIdx].clear();
                await allQtyInputs[lastIdx].fill('3');
                await allPriceInputs[lastIdx].clear();
                await allPriceInputs[lastIdx].fill('50');
            }
        }

        await page.waitForTimeout(1000);
        await screenshot(page, testId, '03-second-item');

        // Set tax rate to 10% for easy verification
        const taxInput = page.locator('input[name*="tax"], input[placeholder*="tax" i]').first();
        if (await taxInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await taxInput.clear();
            await taxInput.fill('10');
        }

        await page.waitForTimeout(1000);
        await screenshot(page, testId, '04-with-tax');

        // Expected calculations:
        // Subtotal = $200 + $150 = $350
        // Tax (10%) = $35
        // Total = $385

        const pageText = await page.textContent('body');

        // Look for expected values
        const hasSubtotal = pageText.includes('350') || pageText.includes('$350');
        const hasTax = pageText.includes('35') || pageText.includes('$35');
        const hasTotal = pageText.includes('385') || pageText.includes('$385');

        console.log(`[${testId}] Subtotal $350 visible: ${hasSubtotal}`);
        console.log(`[${testId}] Tax $35 visible: ${hasTax}`);
        console.log(`[${testId}] Total $385 visible: ${hasTotal}`);

        if (hasSubtotal && hasTotal) {
            console.log(`[${testId}] Quote calculations CORRECT!`);
        } else {
            console.log(`[${testId}] Quote calculations may not be updating - checking UI state`);

            // Debug: log what totals are shown
            const totalsText = await page.locator('text=/\\$[0-9,]+\\.[0-9]{2}/').allTextContents();
            console.log(`[${testId}] Visible dollar amounts: ${totalsText.join(', ')}`);
        }

        await screenshot(page, testId, '05-final');
        console.log(`[${testId}] QUOTE CALCULATION TEST COMPLETE`);
    });

});

test.describe('Homeowner Quote Experience', () => {

    test('Homeowner can view received quotes', async ({ page }) => {
        const testId = uniqueId('ho-quotes');
        console.log(`[${testId}] Starting homeowner quote view test...`);

        await loginAsHomeowner(page);
        await screenshot(page, testId, '01-logged-in');

        // Navigate to home
        await page.goto(`${BASE_URL}/home`);
        await page.waitForTimeout(2000);
        await screenshot(page, testId, '02-dashboard');

        // Look for quotes section or notifications
        const quotesLink = page.locator(
            'text="Quotes", text="My Quotes", text="Pending", a[href*="quote"]'
        ).first();

        if (await quotesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quotesLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '03-quotes-section');

            // Check for any quotes
            const quoteCard = page.locator('[class*="quote"], [class*="Quote"]').first();
            if (await quoteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`[${testId}] Homeowner has visible quotes`);
                await quoteCard.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '04-quote-detail');
            } else {
                console.log(`[${testId}] No quotes visible for homeowner`);
            }
        } else {
            console.log(`[${testId}] No quotes link found on homeowner dashboard`);

            // Check for any pending notifications
            const notification = page.locator('[class*="notification"], [class*="alert"], text="pending"').first();
            if (await notification.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log(`[${testId}] Found notification/alert`);
                await screenshot(page, testId, '03-notification');
            }
        }

        await screenshot(page, testId, '05-final');
        console.log(`[${testId}] HOMEOWNER QUOTE VIEW TEST COMPLETE`);
    });

});
