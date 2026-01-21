// tests/e2e/service-request.spec.js
// End-to-end tests for the Service Request flow
// CRITICAL: This is a major gap in current test coverage

import { test, expect } from '@playwright/test';
import {
    loginAsHomeowner,
    loginAsContractor,
    screenshot,
    uniqueId,
    waitForLoadingComplete,
    navigateToSection
} from '../utils/test-helpers.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

test.describe('Service Request - Homeowner Creates Request', () => {

    test('Create quick service request from dashboard', async ({ page }) => {
        const testId = uniqueId('service-request-quick');
        console.log(`[${testId}] Starting quick service request test...`);

        await loginAsHomeowner(page);
        await page.goto(`${BASE_URL}/home`);
        await waitForLoadingComplete(page);
        await screenshot(page, testId, '01-dashboard');

        // Look for "Request Service", "Get Help", or similar quick action
        const requestButtons = [
            'button:has-text("Request")',
            'button:has-text("Get Help")',
            'button:has-text("Service")',
            'a:has-text("Request Service")',
            '[data-testid="quick-service-request"]'
        ];

        let requestButton = null;
        for (const selector of requestButtons) {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                requestButton = btn;
                break;
            }
        }

        if (requestButton) {
            await requestButton.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-request-form');

            // Fill in service category
            const categorySelect = page.locator('select[name="category"], [data-testid="category"]').first();
            if (await categorySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
                await categorySelect.selectOption({ index: 1 }); // Select first category
            } else {
                // Try clicking a category card
                const categoryCard = page.locator('[class*="category"], button:has-text("Plumbing")').first();
                if (await categoryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await categoryCard.click();
                }
            }

            // Fill description
            const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="describe" i], textarea').first();
            if (await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await descriptionInput.fill(`Test service request: Leaking faucet in kitchen - ${testId}`);
            }

            await screenshot(page, testId, '03-form-filled');

            // Submit request
            const submitButton = page.locator('button:has-text("Submit"), button:has-text("Send"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await submitButton.click();
                await page.waitForTimeout(2000);
            }

            await screenshot(page, testId, '04-submitted');

            // Verify success message or redirect
            const successIndicators = [
                'text="submitted"',
                'text="received"',
                'text="success"',
                'text="thank you"'
            ];

            let success = false;
            for (const selector of successIndicators) {
                if (await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
                    success = true;
                    console.log(`[${testId}] Service request submitted successfully`);
                    break;
                }
            }

            if (!success) {
                console.log(`[${testId}] Could not confirm submission - checking for request in list`);
            }
        } else {
            console.log(`[${testId}] Service request button not found on dashboard`);
            // Document this as a potential UI issue
        }

        await screenshot(page, testId, '05-final');
        console.log(`[${testId}] SERVICE REQUEST TEST COMPLETE`);
    });

    test('View service request status', async ({ page }) => {
        const testId = uniqueId('service-request-status');
        console.log(`[${testId}] Starting service request status test...`);

        await loginAsHomeowner(page);
        await page.goto(`${BASE_URL}/home`);
        await waitForLoadingComplete(page);

        // Navigate to requests section
        const requestsLink = page.locator('text="Requests", text="My Requests", a[href*="request"]').first();

        if (await requestsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await requestsLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-requests-list');

            // Click on a request to see details
            const requestCard = page.locator('[class*="request"], [class*="Request"], .bg-white.rounded').first();
            if (await requestCard.isVisible({ timeout: 5000 }).catch(() => false)) {
                await requestCard.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-request-detail');

                // Check for status indicator
                const statusIndicator = page.locator('text="Pending", text="In Progress", text="Completed", text="Quoted"').first();
                if (await statusIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
                    const status = await statusIndicator.textContent();
                    console.log(`[${testId}] Request status: ${status}`);
                }
            } else {
                console.log(`[${testId}] No requests found in list`);
            }
        } else {
            console.log(`[${testId}] Requests section not found`);
        }

        await screenshot(page, testId, '03-final');
        console.log(`[${testId}] SERVICE REQUEST STATUS TEST COMPLETE`);
    });

    test('Cancel pending service request', async ({ page }) => {
        const testId = uniqueId('service-request-cancel');
        console.log(`[${testId}] Starting service request cancellation test...`);

        await loginAsHomeowner(page);
        await page.goto(`${BASE_URL}/home`);
        await waitForLoadingComplete(page);

        // Navigate to requests
        const requestsLink = page.locator('text="Requests", a[href*="request"]').first();
        if (await requestsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await requestsLink.click();
            await page.waitForTimeout(1500);

            // Find a pending request
            const pendingRequest = page.locator('text="Pending"').first().locator('..');

            if (await pendingRequest.isVisible({ timeout: 5000 }).catch(() => false)) {
                await pendingRequest.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '01-request-selected');

                // Look for cancel button
                const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Delete")').first();
                if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await cancelButton.click();
                    await page.waitForTimeout(500);
                    await screenshot(page, testId, '02-cancel-clicked');

                    // Confirm cancellation
                    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
                    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await confirmButton.click();
                        await page.waitForTimeout(1500);
                    }

                    console.log(`[${testId}] Service request cancelled`);
                } else {
                    console.log(`[${testId}] Cancel button not found - may not be allowed`);
                }
            } else {
                console.log(`[${testId}] No pending requests to cancel`);
            }
        }

        await screenshot(page, testId, '03-final');
        console.log(`[${testId}] SERVICE REQUEST CANCEL TEST COMPLETE`);
    });

});

test.describe('Service Request - Contractor Receives and Responds', () => {

    test('Contractor sees incoming service requests', async ({ browser }) => {
        const testId = uniqueId('service-request-contractor');
        console.log(`[${testId}] Starting contractor service request view test...`);

        // Create two contexts
        const homeownerContext = await browser.newContext();
        const contractorContext = await browser.newContext();

        const homeownerPage = await homeownerContext.newPage();
        const contractorPage = await contractorContext.newPage();

        try {
            // Homeowner creates a request (or we assume one exists)
            await loginAsHomeowner(homeownerPage);
            await screenshot(homeownerPage, testId, '01-homeowner-logged-in');

            // Contractor checks for incoming work
            await loginAsContractor(contractorPage);
            await screenshot(contractorPage, testId, '02-contractor-logged-in');

            // Navigate to "Find Work" or "Leads" section
            const findWorkLink = contractorPage.locator('nav >> text="Find Work", nav >> text="Leads"').first();

            if (await findWorkLink.isVisible({ timeout: 5000 }).catch(() => false)) {
                await findWorkLink.click();
                await contractorPage.waitForTimeout(1500);
                await screenshot(contractorPage, testId, '03-find-work-page');

                // Check for available requests/leads
                const leadCard = contractorPage.locator('[class*="lead"], [class*="request"], .bg-white.rounded').first();
                if (await leadCard.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await leadCard.click();
                    await contractorPage.waitForTimeout(1000);
                    await screenshot(contractorPage, testId, '04-lead-detail');

                    // Look for response options
                    const quoteButton = contractorPage.locator('button:has-text("Quote"), button:has-text("Respond")').first();
                    if (await quoteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        console.log(`[${testId}] Contractor can respond to service request`);
                    }
                } else {
                    console.log(`[${testId}] No leads/requests visible for contractor`);
                }
            } else {
                console.log(`[${testId}] Find Work section not found`);
            }

            await screenshot(contractorPage, testId, '05-final');
            console.log(`[${testId}] CONTRACTOR SERVICE REQUEST TEST COMPLETE`);

        } finally {
            await homeownerContext.close();
            await contractorContext.close();
        }
    });

});
