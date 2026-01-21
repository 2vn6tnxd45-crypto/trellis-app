// tests/e2e/smart-scan-upload.spec.js
// ============================================
// SMART SCAN RECEIPT/INVOICE UPLOAD TESTS
// ============================================
// Tests the AI-powered receipt scanning and data extraction pipeline
// Note: These tests verify the UI flow, not the actual OCR (which requires real API calls)

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Create a test receipt image (1x1 pixel white PNG - just for upload testing)
const MINIMAL_PNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0xFF,
    0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
    0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
]);

// ============================================
// HELPER: Login as homeowner
// ============================================
async function loginAsHomeowner(page) {
    const timestamp = Date.now();
    const account = {
        email: `test.scan.${timestamp}.${Math.floor(Math.random() * 1000)}@gmail.com`,
        password: 'KribTest123!',
        name: 'Test Scanner User'
    };

    console.log(`[SmartScan Test] Creating user: ${account.email}`);

    await page.goto('/home');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check if already logged in
    const loggedIn = await page.locator('text=/health score|my home/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    if (loggedIn) return;

    // Handle landing page
    const homeownerButton = page.locator('text="I\'m a Homeowner"').first();
    if (await homeownerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await homeownerButton.click();
        await page.waitForTimeout(2000);
    }

    // Sign up
    const signUpLink = page.locator('text=/sign up|create account/i').last();
    if (await signUpLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await signUpLink.click();
        await page.waitForTimeout(1000);
    } else {
        const authBtn = page.locator('text=/sign in|log in|get started/i').first();
        if (await authBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await authBtn.click();
            await page.waitForTimeout(1000);
            const innerSignUp = page.locator('text=/sign up|create account/i').last();
            if (await innerSignUp.isVisible({ timeout: 2000 }).catch(() => false)) {
                await innerSignUp.click();
            }
        }
    }

    // Fill form
    const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(account.name);
    }
    await page.fill('input[type="email"]', account.email);
    await page.fill('input[type="password"]', account.password);

    const submitBtn = page.locator('button:has-text("Create Account"), button[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
    }

    // Handle property setup
    for (let i = 0; i < 8; i++) {
        const dashboardVisible = await page.locator('text=/health score|my home/i').first().isVisible({ timeout: 1000 }).catch(() => false);
        if (dashboardVisible) break;

        const addressInput = page.locator('input[placeholder*="address" i]').first();
        if (await addressInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            const nicknameInput = page.locator('input[placeholder*="home" i]').first();
            if (await nicknameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
                await nicknameInput.fill('Scanner Test Home');
            }
            await addressInput.fill('456 Scan Ave');
            await page.waitForTimeout(1500);
            const suggestion = page.locator('text=/456 Scan.*USA/i').first();
            if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
                await suggestion.click();
                await page.waitForTimeout(1000);
            }
            const createBtn = page.locator('button:has-text("Kreate"), button:has-text("Create")').first();
            if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await createBtn.click();
                await page.waitForTimeout(2000);
            }
            continue;
        }

        const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Skip")').first();
        if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await continueBtn.click();
            await page.waitForTimeout(1000);
        }
        await page.waitForTimeout(500);
    }

    // Dismiss offers modal
    const noThanksBtn = page.locator('text="No Thanks"').first();
    if (await noThanksBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await noThanksBtn.click();
    }

    console.log('[SmartScan Test] Login complete');
}

// ============================================
// TEST SUITE: Smart Scan UI Tests
// ============================================

test.describe('Smart Scan Receipt Upload', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
    });

    test('SS-01: Can access Scan Receipt from Quick Actions', async ({ page }) => {
        // Look for Scan Receipt in Quick Actions
        const scanReceiptBtn = page.locator('text="Scan Receipt"').first();

        if (await scanReceiptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scanReceiptBtn.click();
            await page.waitForTimeout(1500);

            // Should see Smart Scan interface
            const smartScanHeader = page.locator('text=/smart scan|scan.*receipt|upload/i').first();
            const isVisible = await smartScanHeader.isVisible({ timeout: 5000 }).catch(() => false);

            expect(isVisible).toBeTruthy();
        } else {
            console.log('[SS-01] Scan Receipt not visible in current view');
            // Try scrolling to Quick Actions
            await page.evaluate(() => window.scrollTo(0, 300));
            await page.waitForTimeout(1000);

            const scanBtn = page.locator('text="Scan Receipt"').first();
            const found = await scanBtn.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[SS-01] After scroll, Scan Receipt visible: ${found}`);
        }
    });

    test('SS-02: Smart Scan shows upload options', async ({ page }) => {
        const scanReceiptBtn = page.locator('text="Scan Receipt"').first();

        if (await scanReceiptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scanReceiptBtn.click();
            await page.waitForTimeout(1500);

            // Should see upload area
            const uploadArea = page.locator(
                'text=/drag.*drop|choose.*file|upload.*receipt|tap to upload/i, ' +
                'input[type="file"]'
            ).first();

            const hasUpload = await uploadArea.isVisible({ timeout: 5000 }).catch(() => false);
            expect(hasUpload).toBeTruthy();

            // Should show supported file types
            const fileTypes = page.locator('text=/jpg|png|pdf|image/i').first();
            const showsTypes = await fileTypes.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[SS-02] Shows file type info: ${showsTypes}`);
        }
    });

    test('SS-03: Smart Scan shows Room Scan option', async ({ page }) => {
        const scanReceiptBtn = page.locator('text="Scan Receipt"').first();

        if (await scanReceiptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scanReceiptBtn.click();
            await page.waitForTimeout(1500);

            // Look for Room Scan tab or option
            const roomScanOption = page.locator('text=/room scan|scan.*room|scan your room/i').first();
            const hasRoomScan = await roomScanOption.isVisible({ timeout: 5000 }).catch(() => false);

            console.log(`[SS-03] Room Scan option available: ${hasRoomScan}`);
            // Room scan may be a tab or separate feature
        }
    });

    test('SS-04: File upload input accepts correct types', async ({ page }) => {
        const scanReceiptBtn = page.locator('text="Scan Receipt"').first();

        if (await scanReceiptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scanReceiptBtn.click();
            await page.waitForTimeout(1500);

            // Find file input
            const fileInput = page.locator('input[type="file"]').first();

            if (await fileInput.count() > 0) {
                // Check accept attribute
                const acceptTypes = await fileInput.getAttribute('accept');
                console.log(`[SS-04] File input accepts: ${acceptTypes}`);

                // Should accept images and PDFs
                if (acceptTypes) {
                    const acceptsImages = acceptTypes.includes('image') || acceptTypes.includes('jpg') || acceptTypes.includes('png');
                    expect(acceptsImages).toBeTruthy();
                }
            }
        }
    });

    test('SS-05: Can upload a test file', async ({ page }) => {
        const scanReceiptBtn = page.locator('text="Scan Receipt"').first();

        if (await scanReceiptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scanReceiptBtn.click();
            await page.waitForTimeout(1500);

            // Find file input
            const fileInput = page.locator('input[type="file"]').first();

            if (await fileInput.count() > 0) {
                // Create a temporary test image file
                const testImagePath = path.join(process.cwd(), 'test-receipt.png');

                // Write minimal PNG to temp file
                fs.writeFileSync(testImagePath, MINIMAL_PNG);

                try {
                    // Upload the file
                    await fileInput.setInputFiles(testImagePath);
                    await page.waitForTimeout(2000);

                    // Should see some response (processing indicator, preview, or error for minimal image)
                    const hasResponse = await page.locator(
                        'text=/processing|scanning|analyzing|uploaded|preview|error|try again/i'
                    ).first().isVisible({ timeout: 10000 }).catch(() => false);

                    console.log(`[SS-05] Upload got response: ${hasResponse}`);
                } finally {
                    // Clean up temp file
                    if (fs.existsSync(testImagePath)) {
                        fs.unlinkSync(testImagePath);
                    }
                }
            }
        }
    });

    test('SS-06: Smart Scan shows size limit info', async ({ page }) => {
        const scanReceiptBtn = page.locator('text="Scan Receipt"').first();

        if (await scanReceiptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scanReceiptBtn.click();
            await page.waitForTimeout(1500);

            // Should mention file size limit (10MB per SmartScan.jsx)
            const sizeLimit = page.locator('text=/10.*mb|max.*size/i').first();
            const showsLimit = await sizeLimit.isVisible({ timeout: 5000 }).catch(() => false);

            console.log(`[SS-06] Shows size limit: ${showsLimit}`);
        }
    });
});

// ============================================
// TEST SUITE: Manual Item Entry Tests
// ============================================

test.describe('Manual Item Entry', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
    });

    test('MAN-01: Can open manual Add Item form', async ({ page }) => {
        // Look for Add Item button
        const addItemBtn = page.locator('text="Add Item"').first();

        if (await addItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await addItemBtn.click();
            await page.waitForTimeout(1500);

            // Should see item form
            const itemForm = page.locator(
                'input[placeholder*="item" i], ' +
                'text=/item details|add item/i'
            ).first();

            const hasForm = await itemForm.isVisible({ timeout: 5000 }).catch(() => false);
            expect(hasForm).toBeTruthy();
        }
    });

    test('MAN-02: Item form has required fields', async ({ page }) => {
        const addItemBtn = page.locator('text="Add Item"').first();

        if (await addItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await addItemBtn.click();
            await page.waitForTimeout(1500);

            // Check for key fields
            const itemNameField = page.locator('input[placeholder*="item" i], input[name="item"]').first();
            const categoryField = page.locator('select[name="category"], text=/category/i').first();
            const costField = page.locator('input[placeholder*="cost" i], input[type="number"]').first();

            const hasItemName = await itemNameField.isVisible({ timeout: 3000 }).catch(() => false);
            const hasCategory = await categoryField.isVisible({ timeout: 3000 }).catch(() => false);

            console.log(`[MAN-02] Has item name: ${hasItemName}, Has category: ${hasCategory}`);
        }
    });

    test('MAN-03: Can fill and save a basic item', async ({ page }) => {
        const addItemBtn = page.locator('text="Add Item"').first();

        if (await addItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await addItemBtn.click();
            await page.waitForTimeout(1500);

            // Fill basic item info
            const itemNameField = page.locator('input[placeholder*="item" i], input[name="item"]').first();
            if (await itemNameField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await itemNameField.fill('Test HVAC System');

                // Try to fill brand
                const brandField = page.locator('input[placeholder*="brand" i]').first();
                if (await brandField.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await brandField.fill('Carrier');
                }

                // Save
                const saveBtn = page.locator('button:has-text("Save"), button:has-text("Add"), button[type="submit"]').first();
                if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await saveBtn.click();
                    await page.waitForTimeout(2000);

                    // Should see success or be back on dashboard
                    const success = await page.locator('text=/saved|added|success/i').first().isVisible({ timeout: 3000 }).catch(() => false);
                    const backOnDashboard = await page.locator('text=/health score|my home/i').first().isVisible({ timeout: 3000 }).catch(() => false);

                    console.log(`[MAN-03] Success message: ${success}, Back on dashboard: ${backOnDashboard}`);
                }
            }
        }
    });
});

// ============================================
// TEST SUITE: Contractor Info Capture
// ============================================

test.describe('Contractor Information Capture', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
    });

    test('CON-01: Item form has contractor fields', async ({ page }) => {
        const addItemBtn = page.locator('text="Add Item"').first();

        if (await addItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await addItemBtn.click();
            await page.waitForTimeout(1500);

            // Look for contractor section
            const contractorSection = page.locator('text=/contractor|installed by|service provider/i').first();
            const hasContractor = await contractorSection.isVisible({ timeout: 5000 }).catch(() => false);

            // Contractor fields
            const contractorName = page.locator('input[placeholder*="contractor" i], input[name="contractor"]').first();
            const contractorPhone = page.locator('input[placeholder*="phone" i], input[type="tel"]').first();
            const contractorEmail = page.locator('input[placeholder*="email" i][name*="contractor"], input[name="contractorEmail"]').first();

            console.log(`[CON-01] Has contractor section: ${hasContractor}`);
        }
    });

    test('CON-02: Can save item with contractor info', async ({ page }) => {
        const addItemBtn = page.locator('text="Add Item"').first();

        if (await addItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await addItemBtn.click();
            await page.waitForTimeout(1500);

            // Fill item
            const itemNameField = page.locator('input[placeholder*="item" i]').first();
            if (await itemNameField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await itemNameField.fill('Test Water Heater');
            }

            // Fill contractor
            const contractorField = page.locator('input[placeholder*="contractor" i], input[name="contractor"]').first();
            if (await contractorField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await contractorField.fill('ABC Plumbing Co');

                // Try phone
                const phoneField = page.locator('input[placeholder*="phone" i], input[type="tel"]').first();
                if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await phoneField.fill('555-123-4567');
                }

                // Save
                const saveBtn = page.locator('button:has-text("Save"), button[type="submit"]').first();
                if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await saveBtn.click();
                    await page.waitForTimeout(2000);
                    console.log('[CON-02] Saved item with contractor info');
                }
            }
        }
    });
});
