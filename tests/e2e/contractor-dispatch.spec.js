import { test, expect } from '@playwright/test';
import { loginAsContractor, TEST_ACCOUNTS, navigateToSection, waitForLoadingComplete } from '../utils/test-helpers';

test.describe.serial('Contractor Dispatch Board Flow', () => {
    // Unique identifier for this test run to ensure isolation
    const runId = Date.now();
    const jobTitle = `Dispatch Test Job ${runId}`;
    const customerName = 'Dispatch Test Customer';

    // We reuse the existing homeowner account for the customer
    const customerEmail = TEST_ACCOUNTS.homeowner.email;
    const customerPhone = '5551234444';
    const customerAddress = '6534 San Haroldo Way, Buena Park';

    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
    });

    test('DISPATCH-01: Create job, assign via drag-and-drop, view map, and cleanup', async ({ page }) => {
        console.log(`[Test] Starting Dispatch Flow for Job: "${jobTitle}"`);

        // ==========================================
        // 1. CREATE ASSIGNABLE JOB
        // ==========================================
        console.log('[Test] Step 1: Creating new job via Jobs Page (to ensure Unscheduled)...');

        await navigateToSection(page, 'Jobs');

        const createJobBtn = page.locator('button:has-text("New Job"), button:has-text("Create Job")').first();
        await createJobBtn.click();

        // Wait for Modal and scope
        const modal = page.locator('[role="dialog"], .fixed.inset-0.z-50').first();
        await expect(modal).toBeVisible();

        // Fill Job Details
        console.log('[Test] Filling job details...');
        await modal.locator('label:has-text("Job Title")').locator('..').locator('input').fill(jobTitle);

        // Category
        const categorySelect = modal.locator('select, [role="combobox"]').first();
        if (await categorySelect.isVisible()) {
            const tagName = await categorySelect.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'select') {
                await categorySelect.selectOption({ index: 1 });
            } else {
                await categorySelect.click();
                await page.waitForTimeout(500);
                await page.locator('[role="option"], .select-item').first().click();
            }
        }

        // Customer Info
        await modal.locator('label:has-text("Customer Name")').locator('..').locator('input').fill(customerName);

        // Phone
        const phoneInput = modal.locator('input[type="tel"], label:has-text("Phone") + input, input[name="phone"]');
        if (await phoneInput.count() > 0 && await phoneInput.first().isVisible()) {
            await phoneInput.first().fill(customerPhone);
        }

        // Email
        const emailInput = modal.locator('input[type="email"]');
        if (await emailInput.count() > 0 && await emailInput.first().isVisible()) {
            await emailInput.first().fill(customerEmail);
        }

        // Service Address (Required - Scroll to find)
        console.log('[Test] Filling Address...');
        const addressInput = modal.locator('label').filter({ hasText: /Address|Location/i }).locator('..').locator('input, textarea').first();

        if (await addressInput.count() > 0) {
            await addressInput.scrollIntoViewIfNeeded();
            await addressInput.fill(customerAddress);
            await page.waitForTimeout(1000);
            const prediction = page.locator('.pac-item, [role="option"]').filter({ hasText: 'Buena Park' }).first();
            if (await prediction.isVisible()) {
                await prediction.click();
            } else {
                await addressInput.press('Enter');
            }
        }

        // Submit creation
        const createSubmitBtn = modal.locator('button:has-text("Create Job"), button[type="submit"]').last();
        await createSubmitBtn.scrollIntoViewIfNeeded();
        await createSubmitBtn.click();

        // Check for Validation Error
        await page.waitForTimeout(1000);
        const errorMsg = modal.locator('.text-red-500, [role="alert"]').first();
        if (await errorMsg.isVisible()) {
            const msg = await errorMsg.textContent();
            console.log('[Test] Validation Error detected:', msg);
            throw new Error(`Validation Error: ${msg}`);
        }

        await waitForLoadingComplete(page);
        await expect(createSubmitBtn).not.toBeVisible({ timeout: 10000 });

        // ==========================================
        // 2. NAVIGATE TO DISPATCH BOARD
        // ==========================================
        console.log('[Test] Step 2: Navigating to Dispatch Board...');
        await navigateToSection(page, 'Schedule');

        const dispatchToggle = page.locator('button:has-text("Dispatch")');
        if (await dispatchToggle.isVisible()) {
            await dispatchToggle.click();
        }

        await expect(page.locator('text=Unassigned').first()).toBeVisible({ timeout: 10000 });

        // ==========================================
        // 3. VERIFY JOB IN SIDEBAR (UNASSIGNED)
        // ==========================================
        console.log('[Test] Step 3: Verifying job in Unassigned column...');

        const backlogBtn = page.locator('button:has-text("All Backlog")');
        if (await backlogBtn.isVisible()) {
            await backlogBtn.click();
            await page.waitForTimeout(1000);
        }

        const jobCard = page.locator(`text=${jobTitle}`).first();
        await expect(jobCard).toBeVisible({ timeout: 15000 });
        console.log('[Test] Found unassigned job card');

        // ==========================================
        // 4. DRAG AND DROP ASSIGNMENT (WITH CONFLICT HANDLING)
        // ==========================================
        console.log('[Test] Step 4: Dragging job to Tech column...');

        const techColumn = page.locator('[class*="TechColumn"], [class*="min-w-[280px]"]').first();

        await jobCard.dragTo(techColumn);
        await page.waitForTimeout(2000);

        // Handle possible Conflict Modal
        const conflictModal = page.locator('text=Scheduling Conflict').first();
        if (await conflictModal.isVisible({ timeout: 3000 })) {
            console.log('[Test] Detected Scheduling Conflict modal - Overriding...');
            await page.locator('button:has-text("Override & Assign")').click();
            await page.waitForTimeout(1000);
        }

        await expect(jobCard).toBeVisible();

        // ==========================================
        // 5. MAP VIEW TOGGLE
        // ==========================================
        console.log('[Test] Step 5: Toggling Map View...');
        await page.locator('button:has-text("Map")').click();
        await page.waitForTimeout(1000);
        await expect(page.locator('h2:has-text("Route Map")').first()).toBeVisible();

        await page.locator('button:has-text("Dispatch")').click();

        // ==========================================
        // 6. CLEANUP (CANCEL JOB)
        // ==========================================
        console.log('[Test] Step 6: Cleaning up (Cancelling Job)...');

        const cancelJobBtn = page.locator(`div:has-text("${jobTitle}") button[title="Cancel job"]`).first();

        if (await cancelJobBtn.isVisible()) {
            await cancelJobBtn.click();
        } else {
            await jobCard.click();
            await page.waitForTimeout(1000);
            await page.locator('button:has-text("Cancel Job")').click();
        }

        const confirmBtn = page.locator('button:has-text("Yes, Cancel"), button:has-text("Confirm")').last();
        if (await confirmBtn.isVisible({ timeout: 3000 })) {
            await confirmBtn.click();
        }

        await page.waitForTimeout(2000);
        await expect(page.locator(`text=${jobTitle}`)).not.toBeVisible();
        console.log('[Test] Job successfully cancelled');
    });
});
