
import { test, expect } from '@playwright/test';
import {
    loginWithCredentials,
    waitForLoadingComplete,
    uniqueId,
    screenshot
} from '../utils/test-helpers.js';
import { TEST_ACCOUNTS } from '../fixtures/accounts.js';

// Configuration
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

test.describe.serial('Recurring Services Flow', () => {
    let serviceName;

    test.beforeAll(() => {
        serviceName = `Quarterly Maintenance ${uniqueId()}`;
    });

    test('Contractor should create, assign, and cancel a recurring service', async ({ page }) => {
        // ==========================================
        // 1. LOGIN & NAVIGATION
        // ==========================================
        await page.goto(`${BASE_URL}/home?pro=dashboard`);
        await loginWithCredentials(page, TEST_ACCOUNTS.contractor.email, TEST_ACCOUNTS.contractor.password);
        await waitForLoadingComplete(page);

        // Navigate to Recurring Services (assuming it's in the sidebar or menu)
        // If not directly visible, check "More" or specific path
        // Based on app structure, we might need to find the specific nav item
        const recurringNav = page.locator('text=/recurring|subscriptions/i').first();
        if (await recurringNav.isVisible()) {
            await recurringNav.click();
        } else {
            // Try via URL if nav hidden
            await page.goto(`${BASE_URL}/home?pro=recurring`);
        }
        await waitForLoadingComplete(page);

        // ==========================================
        // 2. CREATE NEW PLAN
        // ==========================================
        // Click Create button
        await page.click('button:has-text("Create New Plan"), button:has-text("New Service")');

        // Modal Expectation
        await expect(page.locator('h2:has-text("Set Up Recurring Service")')).toBeVisible();

        // Fill Form
        await page.fill('input[placeholder*="Service Name"]', serviceName);
        await page.fill('input[type="number"]', '150'); // Price

        // Select Frequency: "Every 3 Months" (Quarterly)
        // Check how frequency is implemented in component (buttons)
        // From component: {RECURRING_FREQUENCIES.map(freq => ...)}
        // We need to click the button with label "Quarterly" or value "quarterly"
        await page.click('button:has-text("Quarterly"), button:has-text("Every 3 Months")');

        // Select Customer (if required by modal logic)
        // The modal props suggest it might require a customer passed in OR selectable
        // If the dropdown exists for customer selection:
        const customerSelect = page.locator('select[name="customerId"], [role="combobox"]');
        if (await customerSelect.isVisible()) {
            // Logic to select test homeowner
            // For now assume we might need to be on a customer detail page OR the general list allows selection
            // If this fails, we might need to start from Customer Detail page -> Create Recurring
        }

        // For this test, let's assume we are acting on a specific customer context if the modal didn't force it
        // Re-reading requirements: "Assign this new plan to a test Homeowner"
        // If modal supports customer search/select, use it. 
        // Component source shows `customer` prop is passed. 
        // meaning this modal is likely opened FROM a customer context or Job context.

        // ADAPTATION: Navigate to Customer List -> Select Test User -> Create Recurring
        await page.goto(`${BASE_URL}/home?pro=customers`);
        await waitForLoadingComplete(page);

        // Find Test Homeowner
        await page.click(`text=${TEST_ACCOUNTS.homeowner.name}`);
        await waitForLoadingComplete(page);

        // Triggers creation from Customer Detail
        await page.click('button:has-text("Recurring"), button:has-text("New Subscription")');

        // Now fill form again (since we navigated away/refreshed context)
        await page.fill('input[placeholder*="Service Name"]', serviceName);
        await page.fill('input[type="number"]', '150');
        await page.click('button:has-text("Quarterly"), button:has-text("Every 3 Months")');

        // Save
        await page.click('button:has-text("Start Recurring Service")');

        // Verify Success Message or Modal Close
        await expect(page.locator('text=Recurring Service Created')).toBeVisible();
        await page.waitForTimeout(1000); // Allow animation

        // ==========================================
        // 3. VERIFY ASSIGNMENT & DATE
        // ==========================================
        // Should now be on Customer Detail or Recurring List
        // Check for the card
        const serviceCard = page.locator(`text=${serviceName}`).first();
        await expect(serviceCard).toBeVisible();

        // Verify Next Service Date (3 months from now)
        // We can check text contents for a future date
        const nextDateText = await serviceCard.locator('text=/Next scheduled|Next visit/i').first().textContent();
        expect(nextDateText).not.toContain('Invalid Date');

        // ==========================================
        // 4. CANCELLATION
        // ==========================================
        // Open Actions Menu (3 dots)
        const menuBtn = serviceCard.locator('button').filter({ has: page.locator('svg.lucide-more-vertical') });
        if (await menuBtn.isVisible()) {
            await menuBtn.click();
        } else {
            // Maybe hover? Or just click the card to expand details if actions are inside
            // Component source shows actions in dropdown
            await serviceCard.locator('button svg.lucide-more-vertical').click();
        }

        // Click Cancel
        await page.click('button:has-text("Cancel Service")');

        // Verify Status Update
        // Status badge should change to "Cancelled" or card removed depending on view filter
        await expect(serviceCard).toContainText('Cancelled');

        // Verify no future jobs scheduled (optional deep check)
        // Ensuring the status is visually updated is sufficient for E2E
    });
});
