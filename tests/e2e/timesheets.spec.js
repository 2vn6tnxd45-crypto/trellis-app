
import { test, expect } from '@playwright/test';
import {
    loginWithCredentials,
    waitForLoadingComplete,
    uniqueId
} from '../utils/test-helpers.js';
import { TEST_ACCOUNTS } from '../fixtures/accounts.js';

// Configuration
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';
const TEST_PIN = '1234'; // Default test PIN

test.describe.serial('Timesheet & Payroll Flow', () => {
    // Shared state between tests
    let techContext;
    let managerContext;
    let createdTimesheetId; // To track the specific record if needed

    test.beforeAll(async ({ browser }) => {
        // Create context for Technician (Mobile View)
        techContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true
        });

        // Create context for Manager (Desktop View)
        managerContext = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
    });

    test.afterAll(async () => {
        await techContext?.close();
        await managerContext?.close();
    });

    // ==========================================
    // 1. TECHNICIAN WORKFLOW
    // ==========================================
    test('Technician should be able to clock in and out', async () => {
        const page = await techContext.newPage();

        // 1. Navigate to Tech Portal
        await page.goto(`${BASE_URL}/tech`);

        // 2. Handle Login (PIN Entry)
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Check for login screen
        const hasLoginScreen = await page.locator(
            'input[type="password"], text=/enter.*pin/i, text=/sign in/i'
        ).first().isVisible({ timeout: 5000 }).catch(() => false);

        if (hasLoginScreen) {
            console.log('Login screen detected');
            // Try to find PIN input
            const pinInput = page.locator('input[type="password"]').first();
            if (await pinInput.isVisible()) {
                await pinInput.fill(TEST_PIN);
                await page.click('button:has-text("Enter"), button:has-text("Login")');
                await waitForLoadingComplete(page);
            }
        }

        // 3. Locate Time Clock Widget
        // Check for dashboard indicators first to ensure we are logged in
        await expect(page.locator('text=/today|jobs|schedule/i').first()).toBeVisible({ timeout: 15000 });

        // Now look for time clock
        const timeClockWidget = page.locator('text=/Time Clock|Working|Clocked Out/i').first();
        await expect(timeClockWidget).toBeVisible();

        // If minimized, expand it
        const isMinimized = await page.locator('button:has-text("Time Clock")').isVisible();
        if (isMinimized) {
            await page.click('button:has-text("Time Clock")');
        }

        // 4. Clock In
        // Ensure we are clocked out first
        const clockOutBtn = page.locator('button:has-text("Clock Out")');
        if (await clockOutBtn.isVisible()) {
            await clockOutBtn.click();
            await page.waitForTimeout(2000); // Wait for save
        }

        await page.click('button:has-text("Clock In")');

        // Verify UI updates to "Working" or timer
        await expect(page.locator('text=Working')).toBeVisible();
        await expect(page.locator('button:has-text("Clock Out")')).toBeVisible();

        // 5. Simulate work time (fast forward if possible, or just wait)
        // Since we can't easily jump server time, we'll just wait a few seconds
        // Real payroll tests usually require mocking or seeding past data, 
        // but for this UI test, a small duration is acceptable for "existence" checks.
        await page.waitForTimeout(3000);

        // 6. Clock Out
        await page.click('button:has-text("Clock Out")');

        // Verify status resets
        await expect(page.locator('text=Time Clock')).toBeVisible(); // Returns to minimized or "Clock In" state
        await expect(page.locator('button:has-text("Clock In")')).toBeVisible();
    });

    // ==========================================
    // 2. MANAGER APPROVAL WORKFLOW
    // ==========================================
    test('Manager should see and approve the timesheet', async () => {
        const page = await managerContext.newPage();

        // 1. Login as Contractor
        await page.goto(`${BASE_URL}/home?pro=dashboard`);
        // Use existing login helper
        await loginWithCredentials(page, TEST_ACCOUNTS.contractor.email, TEST_ACCOUNTS.contractor.password);
        await waitForLoadingComplete(page);

        // 2. Navigate to Timesheets
        // Desktop sidebar navigation
        await page.click('text=Timesheets');
        await waitForLoadingComplete(page);

        // 3. Verify Pending Approval Section
        await expect(page.locator('h2:has-text("Timesheet Approval")')).toBeVisible();

        // 4. Find the pending timesheet
        // It should be there from the tech's action
        const pendingCard = page.locator('div.bg-white.rounded-xl.border-2').first();
        await expect(pendingCard).toBeVisible();

        // Verify it matches the tech (check for tech icon or name)
        // Note: We don't strictly know the tech name without looking it up, but we assume it's the test tech.

        // 5. Approve
        const approveBtn = pendingCard.locator('button:has-text("Approve")');
        await approveBtn.click();

        // 6. Verify success
        // Card should disappear or status change
        await expect(pendingCard).not.toBeVisible();
        await expect(page.locator('text=Timesheet approved')).toBeVisible();
    });

    // ==========================================
    // 3. PAYROLL VERIFICATION WORKFLOW
    // ==========================================
    test('Approved hours should appear in Payroll Report', async () => {
        const page = await managerContext.newPage();

        // 1. Login/Navigate (reuse session)
        await page.goto(`${BASE_URL}/home?pro=dashboard`);
        await loginWithCredentials(page, TEST_ACCOUNTS.contractor.email, TEST_ACCOUNTS.contractor.password);

        await page.click('text=Timesheets');

        // 2. Navigate to Payroll Report Tab/Section
        // Assuming there is a tab or nav button "Payroll"
        const payrollTab = page.locator('button:has-text("Payroll Report"), a:has-text("Payroll")');
        if (await payrollTab.isVisible()) {
            await payrollTab.click();
        } else {
            // Alternatively checking if it's on the same page
            await expect(page.locator('h2:has-text("Payroll Report")')).toBeVisible();
        }

        await waitForLoadingComplete(page);

        // 3. Verify Totals
        // The total pay should be > $0.00
        const totalPayCard = page.locator('div').filter({ hasText: 'Total Payroll' }).last();
        await expect(totalPayCard).toBeVisible();

        // We might need to ensure we are viewing the 'Current Week'
        await page.click('button:has-text("This Week")');
        await page.waitForTimeout(1000);

        // Check that technician appears in the table
        // We just verified the "Total Payroll" is visible, now checking for row data
        const row = page.locator('tbody tr').first();
        await expect(row).toBeVisible();

        // We clocked in for a few seconds, so pay might be small but entry exists
        // Playwright assertions can check if text contains '$'
        await expect(row).toContainText('$');
    });
});
