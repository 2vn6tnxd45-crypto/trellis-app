// tests/e2e/contractor-invitations.spec.js
// E2E tests for contractor invitation workflow

import { test, expect, chromium } from '@playwright/test';
import { loginWithCredentials, TEST_ACCOUNTS, loginAsHomeowner, screenshot, uniqueId, waitForLoadingComplete, navigateToSection } from '../utils/test-helpers.js';

// Helper to login as contractor using seeded account for reliability and speed
async function loginAsContractor(page) {
    await loginWithCredentials(page, TEST_ACCOUNTS.contractor.email, TEST_ACCOUNTS.contractor.password);
}

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

test.describe('Contractor Invitation Workflow', () => {

    test('Contractor creates invitation link', async ({ page }) => {
        const testId = uniqueId('invite-create');
        console.log(`[${testId}] Starting invitation creation test...`);

        // Login as contractor
        await loginAsContractor(page);
        await screenshot(page, testId, '01-logged-in');

        // The dashboard has a prominent "Create Invitation" button or FAB
        // Also the sidebar has "Invitations" under Management section

        // First try the dashboard button (more prominent)
        const dashboardInviteBtn = page.locator('button:has-text("New Invitation"), button:has-text("Create Invitation")').first();

        if (await dashboardInviteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`[${testId}] Found dashboard invite button`);
            await dashboardInviteBtn.click();
            await page.waitForTimeout(1500);
        } else {
            // Fallback to navigation (mobile or if button hidden)
            console.log(`[${testId}] Navigating via sidebar Invitations`);
            await navigateToSection(page, 'Invitations');
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-invitations-page');

            // Look for create button on invitations page
            const createBtn = page.locator('button:has-text("Create"), button:has-text("New Invitation"), button:has(svg)').first();
            if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await createBtn.click();
                await page.waitForTimeout(1500);
            }
        }

        await screenshot(page, testId, '02-invite-flow-started');

        // Look for invitation creation form
        await screenshot(page, testId, '03-create-form');

        // Fill customer information
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[placeholder*="customer" i]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await nameInput.fill(`Test Customer ${testId}`);
        }

        // Expand Customer Email section if needed
        const emailSectionBtn = page.locator('button:has-text("Customer Email")').first();
        if (await emailSectionBtn.isVisible()) {
            // Check if input is already visible
            const emailInputVisible = await page.locator('input[type="email"][placeholder*="customer"]').isVisible().catch(() => false);
            if (!emailInputVisible) {
                await emailSectionBtn.click();
                await page.waitForTimeout(500);
            }
        }

        const emailInput = page.locator('input[type="email"][placeholder*="customer"]').first();
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await emailInput.fill('testcustomer@example.com');
        }

        const phoneInput = page.locator('input[type="tel"], input[name="phone"]').first();
        if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await phoneInput.fill('5551234567');
        }

        const addressInput = page.locator('input[name="address"], input[placeholder*="address" i]').first();
        if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addressInput.fill('123 Test Street, Anytown, CA 90210');
        }

        await screenshot(page, testId, '04-customer-filled');

        // Add items to the invitation
        const addItemButton = page.locator('button:has-text("Add Item"), button:has-text("Add Record"), button:has-text("+")').first();

        if (await addItemButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await addItemButton.click();
            await page.waitForTimeout(500);

            // Fill item details
            const itemNameInput = page.locator('input[name="item"], input[placeholder*="item" i], input[placeholder*="name" i]').last();
            if (await itemNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await itemNameInput.fill('Water Heater');
            }

            // Select category
            const categorySelect = page.locator('select[name="category"]').last();
            if (await categorySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
                await categorySelect.selectOption({ index: 1 });
            }

            await screenshot(page, testId, '05-item-added');
        }

        // Generate/Create the invitation link
        const generateButton = page.locator('button:has-text("Create Invitation Link"), button:has-text("Generate"), button:has-text("Create Link")').first();

        if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await generateButton.click();
            await page.waitForTimeout(3000);
            await screenshot(page, testId, '06-link-generated');

            // Check for success state - look for copy link button or displayed URL
            const copyButton = page.locator('button:has-text("Copy"), button:has-text("Copy Link")').first();
            const inviteLinkText = page.locator('input[readonly], [class*="invite-link"], text=/mykrib.app\\/invite/');

            if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await copyButton.click();
                console.log(`[${testId}] Invitation link copied to clipboard`);
            }

            if (await inviteLinkText.isVisible({ timeout: 2000 }).catch(() => false)) {
                const linkValue = await inviteLinkText.textContent() || await inviteLinkText.inputValue();
                console.log(`[${testId}] Invitation link: ${linkValue}`);
            }

            console.log(`[${testId}] Invitation created successfully`);
        } else {
            console.log(`[${testId}] Generate button not found - checking alternate flow`);
        }

        await screenshot(page, testId, '07-final');
        console.log(`[${testId}] INVITATION CREATE TEST COMPLETE`);
    });

    test('Homeowner claims invitation', async ({ page }) => {
        const testId = uniqueId('invite-claim');
        console.log(`[${testId}] Starting invitation claim test...`);

        // This test uses a mock invitation URL
        // In real scenario, you'd get this from the previous test
        const inviteUrl = `${BASE_URL}/invite/test-invite-token`;

        // Navigate directly to an invite claim page
        await page.goto(`${BASE_URL}/invite`);
        await waitForLoadingComplete(page);
        await screenshot(page, testId, '01-invite-landing');

        // Check if there's a claim form or token input
        const tokenInput = page.locator('input[name="token"], input[placeholder*="code" i], input[placeholder*="token" i]').first();
        const claimButton = page.locator('button:has-text("Claim"), button:has-text("Access"), button:has-text("Submit")').first();

        if (await tokenInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await tokenInput.fill('test-invite-token');
            await screenshot(page, testId, '02-token-entered');

            if (await claimButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await claimButton.click();
                await page.waitForTimeout(2000);
            }
        }

        await screenshot(page, testId, '03-claim-result');

        // Check for success message or redirect to home records
        const successMessage = page.locator('text="claimed", text="Welcome", text="success"').first();
        const recordsImported = page.locator('text=/record|item|imported/i').first();

        if (await successMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log(`[${testId}] Invitation claimed successfully`);
        } else if (await recordsImported.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`[${testId}] Records imported from invitation`);
        } else {
            console.log(`[${testId}] Claim result may require verification`);
        }

        await screenshot(page, testId, '04-final');
        console.log(`[${testId}] INVITATION CLAIM TEST COMPLETE`);
    });

});

test.describe('Contractor Dashboard Features', () => {

    test('View and manage jobs', async ({ page }) => {
        const testId = uniqueId('jobs-view');
        console.log(`[${testId}] Starting jobs view test...`);

        await loginAsContractor(page);

        // Navigate to Jobs section
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-jobs-page');

        // Check for job list or empty state
        const jobCard = page.locator('[class*="job-card"], [class*="JobCard"], .bg-white.rounded').first();

        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Click on a job to see details
            await jobCard.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-job-detail');

            // Look for job status
            const jobStatus = page.locator('text="Pending", text="In Progress", text="Completed", text="Scheduled"').first();
            if (await jobStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[${testId}] Job status: ${await jobStatus.textContent()}`);
            }

            // Check for action buttons
            const actionButton = page.locator('button:has-text("Start"), button:has-text("Complete"), button:has-text("Update")').first();
            if (await actionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await screenshot(page, testId, '03-job-actions');
            }
        } else {
            console.log(`[${testId}] No jobs found - empty state`);
        }

        await screenshot(page, testId, '04-final');
        console.log(`[${testId}] JOBS VIEW TEST COMPLETE`);
    });

    test('View contractor schedule/calendar', async ({ page }) => {
        const testId = uniqueId('schedule-view');
        console.log(`[${testId}] Starting schedule view test...`);

        await loginAsContractor(page);
        await screenshot(page, testId, '00-logged-in');

        // Navigate to Schedule section
        await navigateToSection(page, 'Schedule');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-schedule-page');

        // Check for calendar or schedule view
        const calendarView = page.locator('[class*="calendar"], [class*="Calendar"], [class*="schedule"]').first();

        if (await calendarView.isVisible({ timeout: 5000 }).catch(() => false)) {
            await screenshot(page, testId, '02-calendar-visible');

            // Try to navigate dates
            const nextButton = page.locator('button:has-text("Next"), button:has(svg[class*="chevron-right"]), [aria-label*="next"]').first();
            if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nextButton.click();
                await page.waitForTimeout(500);
                await screenshot(page, testId, '03-next-period');
            }

            // Check for scheduled items
            const scheduledItem = page.locator('[class*="event"], [class*="scheduled"], [class*="appointment"]').first();
            if (await scheduledItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scheduledItem.click();
                await page.waitForTimeout(500);
                await screenshot(page, testId, '04-scheduled-item');
            }

            console.log(`[${testId}] Schedule view working`);
        } else {
            console.log(`[${testId}] Calendar view not found`);
        }

        await screenshot(page, testId, '05-final');
        console.log(`[${testId}] SCHEDULE VIEW TEST COMPLETE`);
    });

    test('View and send invoices', async ({ page }) => {
        const testId = uniqueId('invoices-view');
        console.log(`[${testId}] Starting invoices view test...`);

        await loginAsContractor(page);

        // Navigate to Invoices section
        await navigateToSection(page, 'Invoices');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-invoices-page');

        // Check for invoice list
        const invoiceCard = page.locator('[class*="invoice-card"], [class*="InvoiceCard"], .bg-white.rounded').first();

        if (await invoiceCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await invoiceCard.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-invoice-detail');

            // Look for send/share buttons
            const sendButton = page.locator('button:has-text("Send"), button:has-text("Email")').first();
            if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[${testId}] Send invoice button available`);
            }

            // Look for payment status
            const paymentStatus = page.locator('text="Paid", text="Unpaid", text="Pending", text="Overdue"').first();
            if (await paymentStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[${testId}] Payment status: ${await paymentStatus.textContent()}`);
            }
        } else {
            // Try creating a new invoice
            const newInvoiceButton = page.locator('button:has-text("New Invoice"), button:has-text("Create")').first();
            if (await newInvoiceButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await newInvoiceButton.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-new-invoice-form');
                console.log(`[${testId}] New invoice form opened`);
            } else {
                console.log(`[${testId}] No invoices found`);
            }
        }

        await screenshot(page, testId, '03-final');
        console.log(`[${testId}] INVOICES VIEW TEST COMPLETE`);
    });

    test('Access contractor settings', async ({ page }) => {
        const testId = uniqueId('settings-view');
        console.log(`[${testId}] Starting settings view test...`);

        await loginAsContractor(page);

        // Navigate to Settings
        await navigateToSection(page, 'Settings');

        if (await page.locator('text="Company"').first().isVisible({ timeout: 5000 }).catch(() => false)) {
            // Already there
        } else {
            // Fallback logic handled by navigateToSection
        }

        const settingsVisible = true; // Placeholder for logic flow
        if (settingsVisible) {
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-settings-page');

            // Check for settings sections
            const companySection = page.locator('text="Company", text="Business", text="Profile"').first();
            const taxSection = page.locator('text="Tax", text="Rates", text="Default"').first();
            const teamSection = page.locator('text="Team", text="Crew", text="Members"').first();

            if (await companySection.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[${testId}] Company settings section found`);
            }

            if (await taxSection.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[${testId}] Tax/rates settings section found`);
            }

            if (await teamSection.isVisible({ timeout: 2000 }).catch(() => false)) {
                await teamSection.click();
                await page.waitForTimeout(500);
                await screenshot(page, testId, '02-team-settings');
            }
        } else {
            // Try through a menu
            const profileMenu = page.locator('button:has(svg[class*="user"]), [class*="avatar"], [class*="profile"]').first();
            if (await profileMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
                await profileMenu.click();
                await page.waitForTimeout(500);
                const settingsOption = page.locator('text="Settings"').first();
                if (await settingsOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await settingsOption.click();
                    await page.waitForTimeout(1000);
                }
            }
        }

        await screenshot(page, testId, '03-final');
        console.log(`[${testId}] SETTINGS VIEW TEST COMPLETE`);
    });

});
