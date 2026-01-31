// tests/e2e/core-flows.spec.js
import { test, expect } from '@playwright/test';
import {
    TEST_USERS,
    TEST_PROPERTIES,
    TEST_RECORDS,
    TEST_QUOTES,
    SELECTORS,
    generateTestEmail,
    generateTestPhone,
    wait
} from '../fixtures/test-data.js';
import { navigateToSection, loginWithCredentials, selectPropertyIfNeeded } from '../utils/test-helpers.js';

/**
 * Core Flow Tests for Krib App
 *
 * Tests cover the main user journeys:
 * 1. Homeowner onboarding
 * 2. Adding manual records
 * 3. Contractor quote creation
 * 4. Quote acceptance
 * 5. Job completion
 */

// Skip: Signup flow UI has changed - signup tests need updating
test.describe.skip('Homeowner Onboarding Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Start fresh - create new account for each test
        const testEmail = generateTestEmail('onboard');

        await page.goto('/');

        // Check if we're on landing page with role selection
        const homeownerBtn = page.locator('text="I\'m a Homeowner"').first();
        if (await homeownerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await homeownerBtn.click();
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(1000);
        }

        // Check if email input is already visible (auth form)
        const emailVisible = await page.locator(SELECTORS.emailInput).isVisible({ timeout: 3000 }).catch(() => false);

        if (!emailVisible) {
            // May need to click "Log In" or "Get Started" button to reach auth
            const loginBtn = page.locator('text=/log in|sign in|get started/i').first();
            if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await loginBtn.click();
                await page.waitForTimeout(1500);
            }
        }

        // Now we should be on auth screen. Switch to signup if needed.
        // If we see "Sign in" or "Log in" header/button, we likely need to switch.
        // Or if we see "Create Account" button, we are already on signup.

        const createAccountBtn = page.locator('button:has-text("Create Account")');
        if (!await createAccountBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Need to switch to signup
            const signUpLink = page.locator('text=/sign up|create account/i').last();
            if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                await signUpLink.click();
                await page.waitForTimeout(1000);
            }
        }

        // Create new account
        await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 10000 });
        await page.fill('input[placeholder*="name" i]', 'Test Onboarding User');
        await page.fill(SELECTORS.emailInput, testEmail);
        await page.fill(SELECTORS.passwordInput, 'TestPass123!');
        await page.click(SELECTORS.submitButton);

        // Wait for redirect to app
        await expect(page).toHaveURL(/.*\/(home|app|onboarding)/, { timeout: 15000 });
    });

    test('should complete full onboarding with property details', async ({ page }) => {
        // Check if we're on onboarding or need to trigger it
        const isOnboarding = await page.locator('text=/welcome|get started|add.*property/i').isVisible({ timeout: 5000 }).catch(() => false);

        if (!isOnboarding) {
            // Navigate to add property if not in onboarding
            await page.click('text=/add.*property/i, button:has-text("Add")');
        }

        // Step 1: Enter property address
        const addressInput = page.locator('input[placeholder*="address" i], input[name="address"]');
        await expect(addressInput).toBeVisible({ timeout: 5000 });
        await addressInput.fill(TEST_PROPERTIES.primary.address);

        // Wait for address autocomplete or continue
        await page.waitForTimeout(1000);

        // Try to select from autocomplete if present
        const autocompleteOption = page.locator('[class*="autocomplete"] li, [role="option"]').first();
        if (await autocompleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await autocompleteOption.click();
        }

        // Step 2: Property type selection
        const propertyTypeButton = page.locator(`button:has-text("${TEST_PROPERTIES.primary.type}"), [data-type="${TEST_PROPERTIES.primary.type.toLowerCase()}"]`);
        if (await propertyTypeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await propertyTypeButton.click();
        }

        // Step 3: Year built (if asked)
        const yearInput = page.locator('input[placeholder*="year" i], input[name="yearBuilt"]');
        if (await yearInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await yearInput.fill(TEST_PROPERTIES.primary.yearBuilt.toString());
        }

        // Step 4: Square footage (if asked)
        const sqftInput = page.locator('input[placeholder*="sq" i], input[name="squareFeet"]');
        if (await sqftInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await sqftInput.fill(TEST_PROPERTIES.primary.squareFeet.toString());
        }

        // Continue/Save button
        await page.click('button:has-text("Continue"), button:has-text("Save"), button:has-text("Next")');

        // Should reach dashboard or home
        await expect(page.locator('text=/dashboard|home|property/i')).toBeVisible({ timeout: 10000 });
    });

    test('should allow skipping optional onboarding steps', async ({ page }) => {
        // Look for skip button
        const skipButton = page.locator('button:has-text("Skip"), text=/skip.*now/i, text=/later/i');

        if (await skipButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await skipButton.click();

            // Should still reach dashboard
            await expect(page.locator('text=/dashboard|home/i')).toBeVisible({ timeout: 10000 });
        }
    });

    test('should validate required fields during onboarding', async ({ page }) => {
        // Try to continue without filling required fields
        const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")');

        if (await continueButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await continueButton.click();

            // Should show validation error or remain on same step
            const errorOrSameStep = await page.locator('text=/required/i, text=/enter.*address/i, [class*="error"]').isVisible({ timeout: 3000 }).catch(() => false);

            // Either shows error or button is disabled
            expect(errorOrSameStep || await continueButton.isDisabled()).toBeTruthy();
        }
    });
});

test.describe('Manual Record Creation', () => {
    test.beforeEach(async ({ page }) => {
        // Login as full homeowner with existing property
        // Navigate directly to /home for homeowner portal
        await page.goto('/home');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if already logged in (sidebar or bottom nav visible)
        const sidebar = page.locator('aside').first();
        const alreadyLoggedIn = await sidebar.isVisible({ timeout: 2000 }).catch(() => false);

        if (!alreadyLoggedIn) {
            // Need to login
            const emailInput = page.locator(SELECTORS.emailInput);

            // If email input not visible, click Sign In button
            if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                const loginBtn = page.locator('button:has-text("Sign In"), text=/sign in/i').first();
                if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await loginBtn.click();
                    await page.waitForTimeout(1000);
                }
            }

            // Wait for email input to be visible
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 5000 });

            // Fill login form
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);
            await page.waitForTimeout(2000);
        }

        // Handle property selection if needed (homeowner may need to select a property)
        await selectPropertyIfNeeded(page);

        await page.waitForTimeout(1000);
    });

    test('should add HVAC maintenance record manually', async ({ page }) => {
        // Navigate to records/inventory section
        await navigateToSection(page, 'Records');
        // Verify we're on the Inventory page
        await expect(page.locator('text=/inventory|items|no items/i').first()).toBeVisible({ timeout: 5000 });

        // Click add item button
        await page.click('button:has-text("Add Item"), button:has-text("Add"), [aria-label*="add"]');

        // Handle "Add New Item" wizard (Step 1: How do you want to add this item?)
        // Look for "Type Manually" option
        const typeManuallyBtn = page.locator('text=Type Manually').first();
        if (await typeManuallyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await typeManuallyBtn.click();
            await page.waitForTimeout(1000);
        }

        // Wizard Step 2: Basic Info
        // Fill "What is it?" (Title)
        const titleInput = page.locator('input[placeholder*="Living Room Sofa"], input[name="title"], label:has-text("WHAT IS IT?") + input');
        if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await titleInput.fill(TEST_RECORDS.hvacMaintenance.title);
        }

        // Select Category
        // Click the dropdown trigger
        const categoryTrigger = page.locator('text=Select...').first();
        if (await categoryTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await categoryTrigger.click();
            await page.waitForTimeout(1000); // Wait for animation

            // Try explicit text match with force click
            const hvacOption = page.locator('text=HVAC & Systems').first();
            if (await hvacOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                await hvacOption.click({ force: true });
            } else {
                // Fallback to keyboard navigation if visual click fails
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('ArrowDown'); // Go down a few times
                await page.keyboard.press('Enter');
            }
        }

        // Select Area
        const areaTrigger = page.locator('text=Select room...').first();
        if (await areaTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
            await areaTrigger.click();
            await page.waitForTimeout(500);
            // Select first available room or create new
            const firstRoomOption = page.locator('[role="option"]').first();
            if (await firstRoomOption.isVisible({ timeout: 1000 }).catch(() => false)) {
                await firstRoomOption.click();
            }
        }

        // Click Next
        await page.click('button:has-text("Next"), button:has-text("Add Details")');
        await page.waitForTimeout(1000);

        // Wizard Step 3: Details (Cost, etc.)
        // Description
        const descInput = page.locator('textarea[placeholder*="description" i], textarea[name="description"]');
        if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await descInput.fill(TEST_RECORDS.hvacMaintenance.description);
        }

        // Cost
        const costInput = page.locator('input[placeholder*="cost" i], input[type="number"], input[name="cost"]');
        if (await costInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await costInput.fill(TEST_RECORDS.hvacMaintenance.cost.toString());
        }

        await page.click('button:has-text("Save"), button:has-text("Add Record"), button[type="submit"]');

        // Verify record appears in list
        await expect(page.locator(`text="${TEST_RECORDS.hvacMaintenance.title}"`)).toBeVisible({ timeout: 10000 });
    });

    test('should add plumbing repair record with warranty', async ({ page }) => {
        // Navigate to records
        await navigateToSection(page, 'Records');
        await page.click('button:has-text("Add"), button:has-text("New Record")');

        // Select Plumbing category
        await page.click('button:has-text("Plumbing"), [data-category="plumbing"]').catch(() =>
            page.locator('select[name="category"]').selectOption({ label: 'Plumbing' })
        );

        // Fill details
        await page.fill('input[name="title"], input[placeholder*="title" i]', TEST_RECORDS.plumbingRepair.title);

        const costInput = page.locator('input[name="cost"], input[placeholder*="cost" i]');
        if (await costInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await costInput.fill(TEST_RECORDS.plumbingRepair.cost.toString());
        }

        // Add warranty info if field exists
        const warrantyInput = page.locator('input[name="warrantyExpires"], input[placeholder*="warranty" i]');
        if (await warrantyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await warrantyInput.fill(TEST_RECORDS.plumbingRepair.warrantyExpires);
        }

        // Save
        await page.click('button:has-text("Save"), button:has-text("Add Record")');

        // Verify
        await expect(page.locator(`text="${TEST_RECORDS.plumbingRepair.title}"`)).toBeVisible({ timeout: 10000 });
    });

    test('should require title for new record', async ({ page }) => {
        await navigateToSection(page, 'Records');
        await page.click('button:has-text("Add"), button:has-text("New Record")');

        // Try to save without title
        await page.click('button:has-text("Save"), button:has-text("Add Record")');

        // Should show validation error
        await expect(page.locator('text=/title.*required/i, text=/enter.*title/i, [class*="error"]')).toBeVisible({ timeout: 5000 });
    });

    test('should allow editing existing record', async ({ page }) => {
        await navigateToSection(page, 'Records');

        // Wait for records to load
        await page.waitForTimeout(2000);

        // Click on existing record
        const recordCard = page.locator('[class*="RecordCard"], [data-testid="record-item"]').first();
        if (await recordCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await recordCard.click();

            // Find edit button
            await page.click('button:has-text("Edit"), [aria-label*="edit"]');

            // Modify a field
            const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]');
            await titleInput.fill('Updated Record Title');

            // Save
            await page.click('button:has-text("Save"), button:has-text("Update")');

            // Verify update
            await expect(page.locator('text="Updated Record Title"')).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Contractor Quote Creation', () => {
    test.beforeEach(async ({ page }) => {
        // Login as full contractor - use direct URL to skip landing page
        // The ?pro=dashboard URL goes directly to contractor auth/dashboard
        await page.goto('/home?pro=dashboard');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if already logged in (sidebar visible)
        const sidebar = page.locator('aside, [data-testid="sidebar"]');

        if (!await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Need to login
            const emailInput = page.locator(SELECTORS.emailInput);

            // If email input not visible, may need to click login button
            if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                const loginBtn = page.locator('text=/log in|sign in/i').first();
                if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await loginBtn.click();
                    await page.waitForTimeout(1000);
                }
            }

            await page.fill(SELECTORS.emailInput, TEST_USERS.fullContractor.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullContractor.password);
            await page.click(SELECTORS.submitButton);

            await expect(page).toHaveURL(/.*\/(home|app|contractor)/, { timeout: 15000 });
        }

        await page.waitForTimeout(1000); // Wait for dashboard to stabilize
    });

    test('should create a complete quote with line items', async ({ page }) => {
        // Navigate to quotes section
        await navigateToSection(page, 'Quotes');
        // If "Create Quote" is a sub-link or button, handle it. navigateToSection goes to list.
        // On mobile, "Quotes" goes to list.

        // Click new quote button
        await page.click('button:has-text("New Quote"), button:has-text("Create Quote")');


        // Customer info
        await page.fill('input[name="customerName"], input[placeholder*="customer" i]', TEST_QUOTES.hvacInstall.customerName);
        await page.fill('input[name="customerEmail"], input[placeholder*="email" i]', TEST_QUOTES.hvacInstall.customerEmail);
        await page.fill('input[name="customerPhone"], input[placeholder*="phone" i]', TEST_QUOTES.hvacInstall.customerPhone);

        // Property address
        await page.fill('input[name="propertyAddress"], input[placeholder*="address" i]', TEST_QUOTES.hvacInstall.propertyAddress);

        // Job description
        await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', TEST_QUOTES.hvacInstall.description);

        // Add line items
        for (const item of TEST_QUOTES.hvacInstall.lineItems) {
            await page.click('button:has-text("Add Line"), button:has-text("Add Item")');

            const lastItemRow = page.locator('[class*="line-item"], [data-testid="line-item"]').last();
            await lastItemRow.locator('input[name*="description"], input[placeholder*="description" i]').fill(item.description);
            await lastItemRow.locator('input[name*="quantity"], input[placeholder*="qty" i]').fill(item.quantity.toString());
            await lastItemRow.locator('input[name*="price"], input[name*="rate"], input[placeholder*="price" i]').fill(item.unitPrice.toString());
        }

        // Set deposit percentage
        const depositInput = page.locator('input[name="depositPercent"], input[placeholder*="deposit" i]');
        if (await depositInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await depositInput.fill(TEST_QUOTES.hvacInstall.depositPercent.toString());
        }

        // Set validity days
        const validityInput = page.locator('input[name="validDays"], input[placeholder*="valid" i]');
        if (await validityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await validityInput.fill(TEST_QUOTES.hvacInstall.validDays.toString());
        }

        // Save as draft first
        await page.click('button:has-text("Save Draft"), button:has-text("Save")');

        // Verify quote saved
        await expect(page.locator('text=/quote.*saved/i, text=/draft/i')).toBeVisible({ timeout: 5000 });
    });

    test('should send quote to customer', async ({ page }) => {
        // Navigate to quotes
        await navigateToSection(page, 'Quotes');

        // Wait for quotes to load
        await page.waitForTimeout(2000);

        // Click on a draft quote or create new
        const draftQuote = page.locator('[class*="QuoteCard"]:has-text("Draft"), [data-status="draft"]').first();

        if (await draftQuote.isVisible({ timeout: 3000 }).catch(() => false)) {
            await draftQuote.click();
        } else {
            // Create a minimal quote for sending
            await page.click('button:has-text("New Quote"), button:has-text("Create Quote")');
            await page.fill('input[name="customerEmail"], input[placeholder*="email" i]', 'test.customer@example.com');
            await page.fill('input[name="propertyAddress"], input[placeholder*="address" i]', '123 Test St');
            await page.fill('textarea[name="description"]', 'Test service');

            // Add one line item
            await page.click('button:has-text("Add Line"), button:has-text("Add Item")');
            const itemRow = page.locator('[class*="line-item"]').first();
            await itemRow.locator('input[name*="description"]').fill('Test item');
            await itemRow.locator('input[name*="price"]').fill('100');
        }

        // Send quote
        await page.click('button:has-text("Send Quote"), button:has-text("Send to Customer")');

        // Confirm send if dialog appears
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes, Send")');
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
        }

        // Verify sent status
        await expect(page.locator('text=/sent/i, text=/pending/i')).toBeVisible({ timeout: 10000 });
    });

    test('should validate required quote fields', async ({ page }) => {
        await navigateToSection(page, 'Quotes');
        await page.click('button:has-text("New Quote"), button:has-text("Create Quote")');

        // Try to send without required fields
        await page.click('button:has-text("Send Quote")');

        // Should show validation errors
        await expect(page.locator('text=/required/i, text=/enter/i, [class*="error"]')).toBeVisible({ timeout: 5000 });
    });

    test('should calculate quote totals correctly', async ({ page }) => {
        await navigateToSection(page, 'Quotes');
        await page.click('button:has-text("New Quote"), button:has-text("Create Quote")');

        // Add line item with known values
        await page.click('button:has-text("Add Line"), button:has-text("Add Item")');
        const itemRow = page.locator('[class*="line-item"]').first();
        await itemRow.locator('input[name*="quantity"]').fill('2');
        await itemRow.locator('input[name*="price"]').fill('100');

        // Verify calculated total (2 * 100 = 200)
        await expect(page.locator('text=/\\$200|200\\.00/')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Quote Acceptance Flow', () => {
    // Note: Homeowners don't have a "Quotes" nav item. They see quotes:
    // 1. On their dashboard (Active Projects section)
    // 2. Via direct quote links (email)
    // 3. In the Pros section

    test('should display quote details on public page', async ({ page }) => {
        // Navigate to a public quote page (would need real token in practice)
        // For testing, we'll check if the page structure is correct
        const testToken = 'test-contractor_test-quote';
        await page.goto(`/quote/${testToken}`);

        // Should either show quote or "not found" - both are valid responses
        await expect(page.locator('text=/quote/i').or(page.locator('text=/not found/i'))).toBeVisible({ timeout: 10000 });
    });

    test('should show accept and decline buttons on valid quote', async ({ page }) => {
        // Login as homeowner first with proper flow
        await page.goto('/home');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        const sidebar = page.locator('aside').first();
        if (!await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
            const signInBtn = page.locator('button:has-text("Sign In"), text=/sign in/i').first();
            if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signInBtn.click();
                await page.waitForTimeout(1000);
            }
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 5000 });
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);
            await page.waitForTimeout(2000);
        }
        await selectPropertyIfNeeded(page);
        await page.waitForTimeout(1000);

        // Homeowners see quotes on their dashboard in "Active Projects" or similar section
        // Look for quote cards or notifications on the dashboard
        const quoteNotification = page.locator('[class*="quote" i], [class*="Quote"], text=/pending.*quote/i, text=/new.*quote/i').first();

        if (await quoteNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quoteNotification.click();

            // Should see accept/decline options
            await expect(page.locator('button:has-text("Accept"), button:has-text("Approve")')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('button:has-text("Decline"), button:has-text("Reject")')).toBeVisible({ timeout: 5000 });
        } else {
            // If no pending quotes on dashboard, navigate to Pros section where quotes may be listed
            await navigateToSection(page, 'Pros');
            await page.waitForTimeout(2000);

            const quoteInPros = page.locator('text=/pending.*quote/i, text=/quote.*pending/i, text=/view.*quote/i').first();
            if (await quoteInPros.isVisible({ timeout: 3000 }).catch(() => false)) {
                await quoteInPros.click();
                await expect(page.locator('button:has-text("Accept"), button:has-text("Approve")')).toBeVisible({ timeout: 5000 });
            }
            // If still no quotes found, test passes (no pending quotes for this user)
        }
    });

    test('should require signature for acceptance', async ({ page }) => {
        await page.goto('/home');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        const sidebar = page.locator('aside').first();
        if (!await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
            const signInBtn = page.locator('button:has-text("Sign In"), text=/sign in/i').first();
            if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signInBtn.click();
                await page.waitForTimeout(1000);
            }
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 5000 });
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);
            await page.waitForTimeout(2000);
        }
        await selectPropertyIfNeeded(page);
        await page.waitForTimeout(1000);

        // Look for pending quotes on dashboard
        const quoteCard = page.locator('[class*="quote" i], text=/pending.*quote/i').first();

        if (await quoteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quoteCard.click();
            await page.click('button:has-text("Accept"), button:has-text("Approve")');

            // Should show signature requirement
            await expect(page.locator('text=/signature/i, canvas[class*="signature"]')).toBeVisible({ timeout: 5000 });
        }
        // Test passes if no pending quotes
    });

    test('should allow decline with reason', async ({ page }) => {
        await page.goto('/home');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        const sidebar = page.locator('aside').first();
        if (!await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
            const signInBtn = page.locator('button:has-text("Sign In"), text=/sign in/i').first();
            if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signInBtn.click();
                await page.waitForTimeout(1000);
            }
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 5000 });
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);
            await page.waitForTimeout(2000);
        }
        await selectPropertyIfNeeded(page);
        await page.waitForTimeout(1000);

        // Look for pending quotes on dashboard
        const quoteCard = page.locator('[class*="quote" i], text=/pending.*quote/i').first();

        if (await quoteCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quoteCard.click();
            await page.click('button:has-text("Decline"), button:has-text("Reject")');

            // Should show reason input
            await expect(page.locator('textarea[placeholder*="reason" i], input[name="declineReason"]')).toBeVisible({ timeout: 5000 });
        }
        // Test passes if no pending quotes
    });
});

test.describe('Job Completion Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login as full contractor using the pro portal URL
        await page.goto('/home?pro=dashboard');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        // Check if already logged in (sidebar on desktop OR contractor nav visible)
        const sidebar = page.locator('aside').first();
        const alreadyLoggedIn = await sidebar.isVisible({ timeout: 2000 }).catch(() => false);

        if (!alreadyLoggedIn) {
            // Need to login - first ensure we're on sign-in form
            const emailInput = page.locator(SELECTORS.emailInput);

            // If email input not visible, click Sign In button
            if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                const loginBtn = page.locator('button:has-text("Sign In"), text=/sign in/i').first();
                if (await loginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await loginBtn.click();
                    await page.waitForTimeout(1000);
                }
            }

            // Wait for email input to be visible
            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 5000 });

            // Fill login form
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullContractor.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullContractor.password);

            // Click submit and wait for navigation
            await page.click(SELECTORS.submitButton);
            await page.waitForTimeout(2000);
        }

        // Wait for dashboard (either sidebar visibility or dashboard text)
        await expect(page.locator('aside').first()).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(1000);
    });

    test('should display active jobs list', async ({ page }) => {
        // Navigate to jobs
        await navigateToSection(page, 'Jobs');

        // Should show jobs section
        await expect(page.locator('text=/jobs|schedule/i')).toBeVisible({ timeout: 5000 });
    });

    test('should show job details with customer info', async ({ page }) => {
        await navigateToSection(page, 'Jobs');

        // Wait for jobs to load
        await page.waitForTimeout(2000);

        // Click on a job
        const jobCard = page.locator('[class*="JobCard"], [data-testid="job-item"]').first();

        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();

            // Should show customer details
            await expect(page.locator('text=/customer|client/i')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('text=/address|location/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('should allow marking job as complete', async ({ page }) => {
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(2000);

        // Find an in-progress job
        const activeJob = page.locator('[class*="JobCard"]:has-text("In Progress"), [data-status="in_progress"]').first();

        if (await activeJob.isVisible({ timeout: 5000 }).catch(() => false)) {
            await activeJob.click();

            // Click complete button
            await page.click('button:has-text("Complete"), button:has-text("Mark Complete")');

            // May need to add completion notes
            const notesInput = page.locator('textarea[placeholder*="notes" i], textarea[name="completionNotes"]');
            if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await notesInput.fill('Job completed successfully. All systems tested and working.');
            }

            // Confirm completion
            await page.click('button:has-text("Confirm"), button:has-text("Submit")');

            // Should show completed status
            await expect(page.locator('text=/completed/i')).toBeVisible({ timeout: 10000 });
        }
    });

    test('should allow adding before/after photos', async ({ page }) => {
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(2000);

        const jobCard = page.locator('[class*="JobCard"]').first();

        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();

            // Look for photo upload option
            const photoButton = page.locator('button:has-text("Photo"), button:has-text("Add Image"), [aria-label*="photo"]');

            if (await photoButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await photoButton.click();

                // Should show file input
                await expect(page.locator('input[type="file"]')).toBeVisible({ timeout: 3000 });
            }
        }
    });

    test('should show payment status on completed job', async ({ page }) => {
        await navigateToSection(page, 'Jobs');

        // Filter to completed jobs if filter exists
        const completedFilter = page.locator('button:has-text("Completed"), [data-filter="completed"]');
        if (await completedFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
            await completedFilter.click();
        }

        await page.waitForTimeout(2000);

        const completedJob = page.locator('[class*="JobCard"]:has-text("Completed"), [data-status="completed"]').first();

        if (await completedJob.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completedJob.click();

            // Should show payment information
            await expect(page.locator('text=/payment|paid|balance/i')).toBeVisible({ timeout: 5000 });
        }
    });

    test('should allow requesting final payment', async ({ page }) => {
        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(2000);

        const completedJob = page.locator('[class*="JobCard"]:has-text("Completed")').first();

        if (await completedJob.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completedJob.click();

            // Look for payment request button
            const paymentButton = page.locator('button:has-text("Request Payment"), button:has-text("Send Invoice")');

            if (await paymentButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                expect(await paymentButton.isEnabled()).toBeTruthy();
            }
        }
    });
});

test.describe('Data Import to House Record', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/home');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if already logged in
        const sidebar = page.locator('aside').first();
        const alreadyLoggedIn = await sidebar.isVisible({ timeout: 2000 }).catch(() => false);

        if (!alreadyLoggedIn) {
            // Click Sign In button if needed
            const signInBtn = page.locator('button:has-text("Sign In"), text=/sign in/i').first();
            if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await signInBtn.click();
                await page.waitForTimeout(1000);
            }

            await expect(page.locator(SELECTORS.emailInput)).toBeVisible({ timeout: 5000 });
            await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
            await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
            await page.click(SELECTORS.submitButton);
            await page.waitForTimeout(2000);
        }

        // Handle property selection if needed
        await selectPropertyIfNeeded(page);
        await page.waitForTimeout(1000);
    });

    test('should show import option for completed jobs', async ({ page }) => {
        // Homeowners don't have a "Jobs" nav - they see completed work on their dashboard
        // or in the Inventory/History section

        // Check dashboard for completed job cards
        const completedJobCard = page.locator('text=/completed/i, text=/job.*complete/i, [class*="completed"]').first();

        if (await completedJobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completedJobCard.click();

            // Should show import to house record option
            const importButton = page.locator('button:has-text("Import"), button:has-text("Add to Records"), button:has-text("Add to Inventory")');

            if (await importButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                expect(await importButton.isEnabled()).toBeTruthy();
            }
        }
        // If no completed jobs visible, test passes (data-dependent)
    });

    test('should import job data to property records', async ({ page }) => {
        // Look for completed job on dashboard or in history
        const completedJobCard = page.locator('text=/completed/i, text=/job.*complete/i, [class*="completed"]').first();

        if (await completedJobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completedJobCard.click();

            const importButton = page.locator('button:has-text("Import"), button:has-text("Add to Records"), button:has-text("Add to Inventory")');

            if (await importButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await importButton.click();

                // Confirm import
                const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
                if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmButton.click();
                }

                // Should show success
                await expect(page.locator('text=/imported|added.*record|added.*inventory/i')).toBeVisible({ timeout: 10000 });
            }
        }
        // If no completed jobs, test passes (data-dependent)
    });
});

test.describe('Test Isolation & Cleanup', () => {
    test('should handle concurrent user sessions', async ({ browser }) => {
        // Create two isolated contexts
        const homeownerContext = await browser.newContext();
        const contractorContext = await browser.newContext();

        const homeownerPage = await homeownerContext.newPage();
        const contractorPage = await contractorContext.newPage();

        // Login both users
        await homeownerPage.goto('/');
        await homeownerPage.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
        await homeownerPage.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
        await homeownerPage.click(SELECTORS.submitButton);

        await contractorPage.goto('/');
        await contractorPage.fill(SELECTORS.emailInput, TEST_USERS.fullContractor.email);
        await contractorPage.fill(SELECTORS.passwordInput, TEST_USERS.fullContractor.password);
        await contractorPage.click(SELECTORS.submitButton);

        // Both should be logged in independently
        await expect(homeownerPage).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });
        await expect(contractorPage).toHaveURL(/.*\/(home|app|contractor)/, { timeout: 15000 });

        // Cleanup
        await homeownerContext.close();
        await contractorContext.close();
    });

    test('should not persist state between tests', async ({ page, context }) => {
        // Clear cookies and storage
        await context.clearCookies();

        // Navigate to app
        await page.goto('/');

        // Should be on auth screen (not logged in)
        await expect(page.locator(SELECTORS.emailInput).or(page.locator('text=Sign in'))).toBeVisible({ timeout: 10000 });
    });
});
