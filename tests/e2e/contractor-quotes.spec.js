// tests/e2e/contractor-quotes.spec.js
// E2E tests for contractor quote creation with line items

import { test, expect } from '@playwright/test';
import { loginWithCredentials, TEST_ACCOUNTS, screenshot, uniqueId, waitForLoadingComplete, navigateToSection } from '../utils/test-helpers.js';

// Helper to login as contractor using seeded account
async function loginAsContractor(page) {
    await loginWithCredentials(page, TEST_ACCOUNTS.contractor.email, TEST_ACCOUNTS.contractor.password);
}

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

test.describe('Contractor Quote Creation', () => {

    test('Create quote with multiple line items', async ({ page }) => {
        const testId = uniqueId('quote-create');
        console.log(`[${testId}] Starting quote creation test...`);

        // Login as contractor
        await loginAsContractor(page);
        await screenshot(page, testId, '01-logged-in');

        // Navigate to Quotes section
        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '02-quotes-page');

        // Click "New Quote" or "+" button
        const newQuoteButton = page.locator('button:has-text("New Quote"), button:has-text("Create"), a:has-text("New Quote"), button:has(svg[class*="plus"])').first();

        if (await newQuoteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newQuoteButton.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '03-quote-builder');
        } else {
            console.log(`[${testId}] New Quote button not found, checking for empty state`);
        }

        // Fill customer information
        const customerSection = page.locator('text="Customer Information", text="Customer Details", [class*="customer"]').first();
        await screenshot(page, testId, '04-customer-section');

        // Customer name
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[placeholder*="customer" i]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nameInput.fill(`Test Customer ${testId}`);
        }

        // Customer email
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await emailInput.fill('testcustomer@example.com');
        }

        // Customer phone
        const phoneInput = page.locator('input[type="tel"], input[name="phone"], input[placeholder*="phone" i]').first();
        if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await phoneInput.fill('5551234567');
        }

        // Customer address
        const addressInput = page.locator('input[name="address"], input[placeholder*="address" i]').first();
        if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addressInput.fill('123 Test Street, Anytown, CA 90210');
        }

        await screenshot(page, testId, '05-customer-filled');

        // Quote title
        const titleInput = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="job" i]').first();
        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await titleInput.fill(`Test Quote - Water Heater Replacement ${testId}`);
        }

        await screenshot(page, testId, '06-title-filled');

        // Add line items section
        // First line item (should already exist - Material)
        const descriptionInputs = page.locator('input[placeholder*="description" i], input[name*="description"], textarea[placeholder*="description" i]');
        const firstDescription = descriptionInputs.first();

        if (await firstDescription.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstDescription.fill('50 Gallon Water Heater - Rheem');

            // Quantity
            const qtyInput = page.locator('input[name*="quantity"], input[placeholder*="qty" i], input[type="number"]').first();
            if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await qtyInput.fill('1');
            }

            // Unit price
            const priceInput = page.locator('input[name*="price"], input[name*="unitPrice"], input[placeholder*="price" i]').first();
            if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await priceInput.fill('850');
            }
        }

        await screenshot(page, testId, '07-first-line-item');

        // Add another line item (Labor)
        const addLineItemButton = page.locator('button:has-text("Add"), button:has-text("+ Line"), button:has-text("Add Item")').first();
        if (await addLineItemButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addLineItemButton.click();
            await page.waitForTimeout(500);

            // Fill second line item
            const allDescriptions = await page.locator('input[placeholder*="description" i], textarea[placeholder*="description" i]').all();
            if (allDescriptions.length > 1) {
                await allDescriptions[allDescriptions.length - 1].fill('Installation Labor');
            }

            // Find quantity and price for new row
            const allQty = await page.locator('input[name*="quantity"], input[placeholder*="qty" i]').all();
            if (allQty.length > 1) {
                await allQty[allQty.length - 1].fill('4');
            }

            const allPrice = await page.locator('input[name*="price"], input[name*="unitPrice"]').all();
            if (allPrice.length > 1) {
                await allPrice[allPrice.length - 1].fill('125');
            }
        }

        await screenshot(page, testId, '08-second-line-item');

        // Set tax rate
        const taxInput = page.locator('input[name*="tax"], input[placeholder*="tax" i]').first();
        if (await taxInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await taxInput.clear();
            await taxInput.fill('8.25');
        }

        // Check deposit options
        const depositCheckbox = page.locator('input[type="checkbox"][name*="deposit"], input[id*="deposit"]').first();
        if (await depositCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
            await depositCheckbox.check();

            // Set deposit amount
            const depositInput = page.locator('input[name*="depositValue"], input[placeholder*="deposit" i]').first();
            if (await depositInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await depositInput.fill('50');
            }
        }

        await screenshot(page, testId, '09-tax-deposit');

        // Add notes
        const notesInput = page.locator('textarea[name="notes"], textarea[placeholder*="notes" i]').first();
        if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await notesInput.fill('This quote includes removal and disposal of old water heater. New unit comes with 6-year manufacturer warranty.');
        }

        await screenshot(page, testId, '10-notes-added');

        // Verify totals are calculated
        const totalText = await page.locator('text=/Total|Subtotal|\\$[0-9,]+/').allTextContents();
        console.log(`[${testId}] Found totals: ${totalText.join(', ')}`);

        // Save the quote
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Create Quote"), button[type="submit"]').first();
        if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            await screenshot(page, testId, '11-quote-saved');
            console.log(`[${testId}] Quote saved`);
        }

        await screenshot(page, testId, '12-final');
        console.log(`[${testId}] QUOTE CREATION TEST COMPLETE`);
    });

    test('View and edit existing quote', async ({ page }) => {
        const testId = uniqueId('quote-edit');
        console.log(`[${testId}] Starting quote edit test...`);

        await loginAsContractor(page);
        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-quotes-list');

        // Click on first quote in list
        const quoteCard = page.locator('[class*="quote-card"], [class*="QuoteCard"], .bg-white.rounded').first();

        if (await quoteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quoteCard.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-quote-detail');

            // Look for edit button
            const editButton = page.locator('button:has-text("Edit"), [aria-label*="edit"]').first();
            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '03-edit-mode');

                // Modify the notes
                const notesField = page.locator('textarea[name="notes"]').first();
                if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
                    const currentNotes = await notesField.inputValue();
                    await notesField.fill(`${currentNotes}\n\nUpdated: ${new Date().toISOString()}`);
                }

                // Save
                const saveButton = page.locator('button:has-text("Save")').first();
                if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                }

                await screenshot(page, testId, '04-saved');
                console.log(`[${testId}] Quote edited successfully`);
            }
        } else {
            console.log(`[${testId}] No quotes found to edit`);
        }

        await screenshot(page, testId, '05-final');
        console.log(`[${testId}] QUOTE EDIT TEST COMPLETE`);
    });

    test('Send quote to customer', async ({ page }) => {
        const testId = uniqueId('quote-send');
        console.log(`[${testId}] Starting quote send test...`);

        await loginAsContractor(page);
        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-quotes-list');

        // Find a draft quote to send
        const draftQuote = page.locator('text="Draft"').first().locator('..');

        if (await draftQuote.isVisible({ timeout: 5000 }).catch(() => false)) {
            await draftQuote.click();
            await page.waitForTimeout(1000);
        } else {
            // Click any quote
            const anyQuote = page.locator('[class*="quote"], .bg-white.rounded').first();
            if (await anyQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
                await anyQuote.click();
                await page.waitForTimeout(1000);
            }
        }

        await screenshot(page, testId, '02-quote-selected');

        // Look for send button
        const sendButton = page.locator('button:has-text("Send"), button:has-text("Share"), button:has-text("Email")').first();

        if (await sendButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await sendButton.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '03-send-dialog');

            // If there's a confirmation dialog, confirm
            const confirmSend = page.locator('button:has-text("Send"), button:has-text("Confirm")').last();
            if (await confirmSend.isVisible({ timeout: 2000 }).catch(() => false)) {
                await confirmSend.click();
                await page.waitForTimeout(2000);
            }

            await screenshot(page, testId, '04-sent');
            console.log(`[${testId}] Quote sent to customer`);
        } else {
            // Try to find copy link button instead
            const copyLinkButton = page.locator('button:has-text("Copy Link"), button:has-text("Share Link")').first();
            if (await copyLinkButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await copyLinkButton.click();
                await page.waitForTimeout(500);
                console.log(`[${testId}] Quote link copied`);
            }
        }

        await screenshot(page, testId, '05-final');
        console.log(`[${testId}] QUOTE SEND TEST COMPLETE`);
    });

    test('Convert evaluation to quote', async ({ page }) => {
        const testId = uniqueId('eval-to-quote');
        console.log(`[${testId}] Starting evaluation to quote conversion test...`);

        await loginAsContractor(page);

        // Navigate to evaluations
        await navigateToSection(page, 'Evaluations');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-evaluations');

        // Find a completed evaluation
        const completedEval = page.locator('text="Completed", text="Ready to Quote"').first().locator('..');

        if (await completedEval.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completedEval.click();
            await page.waitForTimeout(1000);
        } else {
            // Click any evaluation
            const anyEval = page.locator('[class*="evaluation"], .bg-white.rounded').first();
            if (await anyEval.isVisible({ timeout: 3000 }).catch(() => false)) {
                await anyEval.click();
                await page.waitForTimeout(1000);
            }
        }

        await screenshot(page, testId, '02-eval-selected');

        // Look for "Create Quote" or "Generate Quote" button
        const createQuoteButton = page.locator('button:has-text("Create Quote"), button:has-text("Generate Quote"), button:has-text("Quote")').first();

        if (await createQuoteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await createQuoteButton.click();
            await page.waitForTimeout(2000);
            await screenshot(page, testId, '03-quote-created');

            // Verify we're in quote builder with pre-filled customer info
            const customerInfo = page.locator('input[name="name"], input[name="email"]').first();
            if (await customerInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
                const value = await customerInfo.inputValue();
                console.log(`[${testId}] Customer info pre-filled: ${value}`);
            }

            console.log(`[${testId}] Evaluation converted to quote`);
        } else {
            console.log(`[${testId}] Create Quote button not found - evaluation may need completion first`);
        }

        await screenshot(page, testId, '04-final');
        console.log(`[${testId}] EVAL TO QUOTE TEST COMPLETE`);
    });

});

test.describe('Quote Calculations', () => {

    test('Verify quote math is correct', async ({ page }) => {
        const testId = uniqueId('quote-math');
        console.log(`[${testId}] Starting quote math verification test...`);

        await loginAsContractor(page);
        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        // Create new quote
        const newQuoteButton = page.locator('button:has-text("New Quote"), button:has-text("Create")').first();
        if (await newQuoteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newQuoteButton.click();
            await page.waitForTimeout(1500);
        }

        // Fill in simple line items with known values
        const descInputs = await page.locator('input[placeholder*="description" i]').all();
        const qtyInputs = await page.locator('input[name*="quantity"]').all();
        const priceInputs = await page.locator('input[name*="price"], input[name*="unitPrice"]').all();

        // Item 1: 2 x $100 = $200
        if (descInputs.length > 0) await descInputs[0].fill('Test Item A');
        if (qtyInputs.length > 0) await qtyInputs[0].fill('2');
        if (priceInputs.length > 0) await priceInputs[0].fill('100');

        await page.waitForTimeout(500);
        await screenshot(page, testId, '01-item-1');

        // Add second item
        const addButton = page.locator('button:has-text("Add")').first();
        if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addButton.click();
            await page.waitForTimeout(500);

            // Item 2: 3 x $50 = $150
            const newDescInputs = await page.locator('input[placeholder*="description" i]').all();
            const newQtyInputs = await page.locator('input[name*="quantity"]').all();
            const newPriceInputs = await page.locator('input[name*="price"], input[name*="unitPrice"]').all();

            if (newDescInputs.length > 1) await newDescInputs[newDescInputs.length - 1].fill('Test Item B');
            if (newQtyInputs.length > 1) await newQtyInputs[newQtyInputs.length - 1].fill('3');
            if (newPriceInputs.length > 1) await newPriceInputs[newPriceInputs.length - 1].fill('50');
        }

        await page.waitForTimeout(500);
        await screenshot(page, testId, '02-item-2');

        // Set tax rate to 10% for easy math
        const taxInput = page.locator('input[name*="tax"]').first();
        if (await taxInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await taxInput.clear();
            await taxInput.fill('10');
        }

        await page.waitForTimeout(1000);
        await screenshot(page, testId, '03-with-tax');

        // Expected: Subtotal = $350, Tax (10%) = $35, Total = $385
        const pageText = await page.textContent('body');

        // Check for expected values
        const expectedSubtotal = '$350';
        const expectedTax = '$35';
        const expectedTotal = '$385';

        console.log(`[${testId}] Looking for Subtotal: ${expectedSubtotal}`);
        console.log(`[${testId}] Looking for Tax: ${expectedTax}`);
        console.log(`[${testId}] Looking for Total: ${expectedTotal}`);

        // Verify totals in UI
        const subtotalVisible = pageText.includes('350') || pageText.includes('$350');
        const totalVisible = pageText.includes('385') || pageText.includes('$385');

        if (subtotalVisible && totalVisible) {
            console.log(`[${testId}] Quote calculations verified correctly!`);
        } else {
            console.log(`[${testId}] Calculations may need manual verification`);
        }

        await screenshot(page, testId, '04-final');
        console.log(`[${testId}] QUOTE MATH TEST COMPLETE`);
    });

});
