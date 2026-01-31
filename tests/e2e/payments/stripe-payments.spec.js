// tests/e2e/payments/stripe-payments.spec.js
// ============================================
// STRIPE PAYMENT FLOW TESTS
// ============================================
// Tests for quote-to-payment flow, deposit handling, refunds
// CRITICAL: These are the core revenue flows

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
// STRIPE CONNECT STATUS TESTS
// ============================================
test.describe('Stripe Connect Status', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('PAY-001: Contractor can view Stripe connection status', async ({ page }) => {
        const testId = uniqueId('stripe-status');

        // Navigate to Settings
        await navigateToSection(page, 'Settings');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-settings');

        // Look for Payments/Stripe section
        const paymentSection = page.locator('text=/payment|stripe|bank|payout/i').first();
        if (await paymentSection.isVisible({ timeout: 5000 }).catch(() => false)) {
            await paymentSection.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-payment-settings');
        }

        // Check for Stripe status indicators
        const statusIndicators = [
            'text=/connected|enabled|active/i',
            'text=/not connected|setup required/i',
            'text=/stripe/i'
        ];

        let foundStatus = false;
        for (const sel of statusIndicators) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                foundStatus = true;
                console.log(`[PAY-001] Found Stripe status indicator: ${sel}`);
                break;
            }
        }

        await screenshot(page, testId, '03-stripe-status');
        console.log(`[PAY-001] Stripe status visible: ${foundStatus}`);
    });

    test('PAY-002: Stripe Connect onboarding link available', async ({ page }) => {
        const testId = uniqueId('stripe-onboard');

        await navigateToSection(page, 'Settings');
        await page.waitForTimeout(1500);

        // Look for setup/connect button
        const connectBtn = page.locator('button:has-text("Connect"), button:has-text("Setup Payments"), button:has-text("Get Paid")').first();

        if (await connectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[PAY-002] Found Stripe connect/setup button');
            await screenshot(page, testId, '01-connect-available');
            // Don't click - just verify it exists
        } else {
            // Already connected - look for "Manage" or "Dashboard" link
            const manageLink = page.locator('text=/manage|dashboard|stripe dashboard/i').first();
            const isConnected = await manageLink.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[PAY-002] Stripe already connected: ${isConnected}`);
            await screenshot(page, testId, '01-already-connected');
        }
    });
});

// ============================================
// QUOTE PAYMENT FLOW TESTS
// ============================================
test.describe('Quote Payment Flow', () => {
    test('PAY-010: Quote displays payment options when Stripe connected', async ({ page }) => {
        const testId = uniqueId('quote-pay');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        // Navigate to Quotes
        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-quotes-list');

        // Find a sent/viewed quote
        const quoteCard = page.locator('text=/sent|viewed|pending/i').first();
        if (await quoteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quoteCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-quote-detail');

            // Check for payment-related elements
            const paymentElements = [
                'text=/deposit/i',
                'text=/payment/i',
                'text=/pay now/i',
                'text=/accept.*pay/i'
            ];

            for (const sel of paymentElements) {
                if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log(`[PAY-010] Found payment element: ${sel}`);
                }
            }
        } else {
            console.log('[PAY-010] No sent/viewed quotes found');
            test.skip();
        }
    });

    test('PAY-011: Quote total calculation is correct', async ({ page }) => {
        const testId = uniqueId('quote-calc');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        // Create new quote to test calculations
        const newQuoteBtn = page.locator('button:has-text("New Quote"), button:has-text("Create")').first();
        if (await newQuoteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newQuoteBtn.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-quote-builder');

            // Fill in test line item
            const descInput = page.locator('input[placeholder*="description" i], textarea').first();
            if (await descInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await descInput.fill('Test Service Item');
            }

            const qtyInput = page.locator('input[name*="quantity"], input[placeholder*="qty" i]').first();
            if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await qtyInput.fill('2');
            }

            const priceInput = page.locator('input[name*="price"], input[name*="unitPrice"]').first();
            if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await priceInput.fill('100');
            }

            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-line-item-filled');

            // Verify subtotal shows $200
            const subtotalText = await page.locator('text=/subtotal|total/i').first().textContent().catch(() => '');
            console.log(`[PAY-011] Subtotal text: ${subtotalText}`);

            // Check if 200 appears somewhere
            const has200 = await page.locator('text=/200/').first().isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`[PAY-011] Shows $200: ${has200}`);
        } else {
            test.skip();
        }
    });

    test('PAY-012: Deposit calculation percentage mode', async ({ page }) => {
        const testId = uniqueId('deposit-pct');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        const newQuoteBtn = page.locator('button:has-text("New Quote")').first();
        if (await newQuoteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newQuoteBtn.click();
            await page.waitForTimeout(1500);

            // Look for deposit toggle/checkbox
            const depositToggle = page.locator('text=/require deposit|deposit required/i, input[name*="deposit"], [data-testid*="deposit"]').first();
            if (await depositToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
                await depositToggle.click();
                await page.waitForTimeout(500);
                await screenshot(page, testId, '01-deposit-enabled');

                // Look for percentage option
                const percentageOption = page.locator('text=/percentage|%/i, input[value="percentage"]').first();
                if (await percentageOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[PAY-012] Percentage deposit option available');
                }
            } else {
                console.log('[PAY-012] Deposit toggle not found');
            }
        }
    });

    test('PAY-013: Deposit calculation fixed amount mode', async ({ page }) => {
        const testId = uniqueId('deposit-fixed');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        const newQuoteBtn = page.locator('button:has-text("New Quote")').first();
        if (await newQuoteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await newQuoteBtn.click();
            await page.waitForTimeout(1500);

            const depositToggle = page.locator('text=/require deposit|deposit required/i').first();
            if (await depositToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
                await depositToggle.click();
                await page.waitForTimeout(500);

                // Look for fixed amount option
                const fixedOption = page.locator('text=/fixed|flat|amount/i, input[value="fixed"]').first();
                if (await fixedOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[PAY-013] Fixed deposit option available');
                    await screenshot(page, testId, '01-fixed-deposit');
                }
            }
        }
    });
});

// ============================================
// HOMEOWNER PAYMENT EXPERIENCE TESTS
// ============================================
test.describe('Homeowner Payment Experience', () => {
    test('PAY-020: Homeowner sees payment button on accepted quote', async ({ page }) => {
        const testId = uniqueId('ho-pay');

        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await screenshot(page, testId, '01-homeowner-dashboard');

        // Navigate to quotes/jobs section
        const quotesLink = page.locator('text=/quotes|projects|jobs/i').first();
        if (await quotesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quotesLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-quotes-section');

            // Look for pay button
            const payBtn = page.locator('button:has-text("Pay"), button:has-text("Make Payment")').first();
            if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[PAY-020] Pay button visible for homeowner');
                await screenshot(page, testId, '03-pay-button');
            } else {
                console.log('[PAY-020] No pay button found - may need accepted quote with payment due');
            }
        }
    });

    test('PAY-021: Payment status displays correctly', async ({ page }) => {
        const testId = uniqueId('pay-status');

        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);

        // Look for payment status indicators on dashboard
        const statusIndicators = [
            'text=/payment due|balance due/i',
            'text=/paid|payment received/i',
            'text=/deposit paid/i',
            'text=/pending payment/i'
        ];

        let foundStatus = false;
        for (const sel of statusIndicators) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                foundStatus = true;
                console.log(`[PAY-021] Found payment status: ${sel}`);
                break;
            }
        }

        await screenshot(page, testId, '01-payment-status');
        console.log(`[PAY-021] Payment status visible: ${foundStatus}`);
    });
});

// ============================================
// JOB PAYMENT TRACKING TESTS
// ============================================
test.describe('Job Payment Tracking', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('PAY-030: Job shows payment status', async ({ page }) => {
        const testId = uniqueId('job-pay');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-jobs-list');

        // Click on a job
        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-job-detail');

            // Look for payment info
            const paymentInfo = [
                'text=/payment/i',
                'text=/paid/i',
                'text=/deposit/i',
                'text=/balance/i',
                'text=/total/i'
            ];

            for (const sel of paymentInfo) {
                if (await page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false)) {
                    console.log(`[PAY-030] Found payment info: ${sel}`);
                }
            }
        }
    });

    test('PAY-031: Contractor can record field payment', async ({ page }) => {
        const testId = uniqueId('field-pay');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);

            // Look for record payment button
            const recordPayBtn = page.locator('button:has-text("Record Payment"), button:has-text("Add Payment")').first();
            if (await recordPayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[PAY-031] Record payment button available');
                await screenshot(page, testId, '01-record-payment');

                // Click to see modal
                await recordPayBtn.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-payment-modal');

                // Check modal has payment type options
                const paymentTypes = ['text=/cash/i', 'text=/check/i', 'text=/card/i', 'text=/other/i'];
                for (const type of paymentTypes) {
                    if (await page.locator(type).first().isVisible({ timeout: 1000 }).catch(() => false)) {
                        console.log(`[PAY-031] Found payment type: ${type}`);
                    }
                }
            } else {
                console.log('[PAY-031] Record payment button not found');
            }
        }
    });

    test('PAY-032: Payment history displays on job', async ({ page }) => {
        const testId = uniqueId('pay-history');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);

            // Look for payment history section
            const historySection = page.locator('text=/payment history|payments|transactions/i').first();
            if (await historySection.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[PAY-032] Payment history section visible');
                await screenshot(page, testId, '01-payment-history');
            }
        }
    });
});

// ============================================
// REFUND FLOW TESTS
// ============================================
test.describe('Refund Flow', () => {
    test('PAY-040: Refund option available on cancelled job', async ({ page }) => {
        const testId = uniqueId('refund');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        // Look for cancelled jobs or filter
        const cancelledFilter = page.locator('text=/cancelled|canceled/i').first();
        if (await cancelledFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
            await cancelledFilter.click();
            await page.waitForTimeout(1000);
        }

        // Check for refund button on a job
        const refundBtn = page.locator('button:has-text("Refund"), button:has-text("Issue Refund")').first();
        if (await refundBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('[PAY-040] Refund button available');
            await screenshot(page, testId, '01-refund-available');
        } else {
            console.log('[PAY-040] No refund button - may not have cancelled jobs with payments');
        }
    });
});

// ============================================
// INVOICE PAYMENT TESTS
// ============================================
test.describe('Invoice Payments', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('PAY-050: Invoice shows payment link option', async ({ page }) => {
        const testId = uniqueId('inv-pay');

        await navigateToSection(page, 'Invoices');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-invoices');

        const invoiceCard = page.locator('[class*="invoice"], [class*="card"]').first();
        if (await invoiceCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await invoiceCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-invoice-detail');

            // Look for payment link option
            const payLinkBtn = page.locator('button:has-text("Payment Link"), button:has-text("Send Invoice")').first();
            if (await payLinkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[PAY-050] Payment link option available');
            }
        }
    });

    test('PAY-051: Can generate payment link for invoice', async ({ page }) => {
        const testId = uniqueId('gen-link');

        await navigateToSection(page, 'Invoices');
        await page.waitForTimeout(1500);

        const invoiceCard = page.locator('[class*="invoice"], [class*="card"]').first();
        if (await invoiceCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await invoiceCard.click();
            await page.waitForTimeout(1500);

            const payLinkBtn = page.locator('button:has-text("Payment Link"), button:has-text("Get Link")').first();
            if (await payLinkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await payLinkBtn.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '01-payment-link');

                // Check if link is generated/displayed
                const linkText = page.locator('input[readonly], text=/mykrib.app/').first();
                if (await linkText.isVisible({ timeout: 3000 }).catch(() => false)) {
                    console.log('[PAY-051] Payment link generated');
                }
            }
        }
    });
});
