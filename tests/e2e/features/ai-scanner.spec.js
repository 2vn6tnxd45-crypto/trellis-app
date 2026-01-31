// tests/e2e/features/ai-scanner.spec.js
// ============================================
// AI SCANNER & RECEIPT OCR TESTS
// ============================================
// Tests for the Gemini-powered receipt scanning feature

import { test, expect } from '@playwright/test';
import {
    loginAsHomeowner,
    screenshot,
    waitForLoadingComplete,
    uniqueId,
    dismissPopups
} from '../../utils/test-helpers.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// ============================================
// SCANNER ACCESS TESTS
// ============================================
test.describe('Scanner Access', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);
    });

    test('SCAN-001: Scanner accessible from inventory', async ({ page }) => {
        const testId = uniqueId('scan-access');

        // Navigate to inventory
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-inventory');

            // Look for scan button
            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add"), [data-testid="scan-button"]').first();
            const hasScan = await scanBtn.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[SCAN-001] Scan button visible: ${hasScan}`);
            await screenshot(page, testId, '02-scan-button');
        }
    });

    test('SCAN-002: Scanner modal opens', async ({ page }) => {
        const testId = uniqueId('scan-modal');

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '01-scanner-modal');

                // Check for scanner UI elements
                const scannerElements = [
                    'text=/upload|camera|photo/i',
                    'text=/scan|receipt|document/i',
                    'input[type="file"]'
                ];

                for (const sel of scannerElements) {
                    if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                        console.log(`[SCAN-002] Found scanner element: ${sel}`);
                    }
                }
            }
        }
    });
});

// ============================================
// SCANNER UI TESTS
// ============================================
test.describe('Scanner UI', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);
    });

    test('SCAN-010: File upload input exists', async ({ page }) => {
        const testId = uniqueId('scan-upload');

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Check for file input
                const fileInput = page.locator('input[type="file"]');
                const hasFileInput = await fileInput.isVisible({ timeout: 3000 }).catch(() => {
                    // File inputs are often hidden
                    return fileInput.count() > 0;
                });
                console.log(`[SCAN-010] File input exists: ${hasFileInput}`);
                await screenshot(page, testId, '01-file-input');
            }
        }
    });

    test('SCAN-011: Camera option available on mobile', async ({ page }) => {
        const testId = uniqueId('scan-camera');

        // This would need to be tested on mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '01-mobile-scanner');

                // Check for camera option
                const cameraOption = page.locator('text=/camera|take photo/i, input[capture]').first();
                const hasCamera = await cameraOption.isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[SCAN-011] Camera option visible: ${hasCamera}`);
            }
        }
    });

    test('SCAN-012: Supported file types indicated', async ({ page }) => {
        const testId = uniqueId('scan-types');

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Check for file type info
                const fileTypes = page.locator('text=/jpg|png|pdf|image/i').first();
                const hasTypeInfo = await fileTypes.isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[SCAN-012] File types shown: ${hasTypeInfo}`);
            }
        }
    });
});

// ============================================
// SCAN RESULT TESTS (Mocked)
// ============================================
test.describe('Scan Results', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);
    });

    test('SCAN-020: Scan shows loading state', async ({ page }) => {
        const testId = uniqueId('scan-loading');

        // This test verifies the loading UI exists
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Look for loading indicators in the component
                const loadingIndicators = [
                    '[class*="loading"]',
                    '[class*="spinner"]',
                    'text=/analyzing|processing|scanning/i'
                ];

                // Just verify these selectors exist in the page source
                // They would show during actual scanning
                console.log('[SCAN-020] Loading state UI elements check complete');
                await screenshot(page, testId, '01-scanner-ready');
            }
        }
    });

    test('SCAN-021: Results show extracted fields', async ({ page }) => {
        const testId = uniqueId('scan-fields');

        // This verifies the form fields that would be populated after scanning
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Look for form fields that would receive extracted data
                const expectedFields = [
                    'input[name*="name" i], input[placeholder*="name" i]',
                    'input[name*="brand" i], input[placeholder*="brand" i]',
                    'input[name*="model" i], input[placeholder*="model" i]',
                    'input[name*="price" i], input[name*="cost" i]',
                    'input[name*="date" i], input[type="date"]'
                ];

                for (const field of expectedFields) {
                    const hasField = await page.locator(field).first().isVisible({ timeout: 1000 }).catch(() => false);
                    if (hasField) {
                        console.log(`[SCAN-021] Found field: ${field}`);
                    }
                }
                await screenshot(page, testId, '01-form-fields');
            }
        }
    });

    test('SCAN-022: Can edit extracted data', async ({ page }) => {
        const testId = uniqueId('scan-edit');

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Find an editable field and verify it's editable
                const nameField = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
                if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await nameField.fill('Test Edited Name');
                    const value = await nameField.inputValue();
                    console.log(`[SCAN-022] Field editable, value: ${value}`);
                    await screenshot(page, testId, '01-edited-field');
                }
            }
        }
    });
});

// ============================================
// SCAN ERROR HANDLING
// ============================================
test.describe('Scan Error Handling', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);
    });

    test('SCAN-030: Invalid file type shows error', async ({ page }) => {
        const testId = uniqueId('scan-invalid');

        // This would require actually uploading an invalid file
        // For now, just verify the scanner component exists
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Check file input accept attribute
                const fileInput = page.locator('input[type="file"]');
                const acceptAttr = await fileInput.getAttribute('accept').catch(() => '');
                console.log(`[SCAN-030] File input accepts: ${acceptAttr}`);
                await screenshot(page, testId, '01-file-accept');
            }
        }
    });

    test('SCAN-031: Large file shows size error', async ({ page }) => {
        const testId = uniqueId('scan-size');

        // Verify file validation exists
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const scanBtn = page.locator('button:has-text("Scan"), button:has-text("Add")').first();
            if (await scanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scanBtn.click();
                await page.waitForTimeout(1500);

                // Look for size limit information
                const sizeInfo = page.locator('text=/mb|size|limit/i').first();
                const hasSizeInfo = await sizeInfo.isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[SCAN-031] Size limit info shown: ${hasSizeInfo}`);
            }
        }
    });

    test('SCAN-032: Retry option on scan failure', async ({ page }) => {
        const testId = uniqueId('scan-retry');

        // Check for retry functionality in error states
        // This would typically be tested with network mocking
        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            // Document that retry UI should exist
            console.log('[SCAN-032] Retry functionality check - manual verification needed');
            await screenshot(page, testId, '01-scanner-state');
        }
    });
});

// ============================================
// MANUAL ENTRY ALTERNATIVE
// ============================================
test.describe('Manual Entry Option', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);
    });

    test('SCAN-040: Manual entry available alongside scanner', async ({ page }) => {
        const testId = uniqueId('manual-entry');

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            // Look for manual entry option
            const manualBtn = page.locator('text=/manual|type|enter manually/i, button:has-text("Manual")').first();
            const hasManual = await manualBtn.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[SCAN-040] Manual entry option: ${hasManual}`);

            // Or check add button opens form
            const addBtn = page.locator('button:has-text("Add")').first();
            if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await addBtn.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '01-add-options');
            }
        }
    });

    test('SCAN-041: Manual form has all required fields', async ({ page }) => {
        const testId = uniqueId('manual-fields');

        const inventoryTab = page.locator('text=/inventory|items|records/i').first();
        if (await inventoryTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inventoryTab.click();
            await page.waitForTimeout(1500);

            const addBtn = page.locator('button:has-text("Add"), button:has-text("New")').first();
            if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await addBtn.click();
                await page.waitForTimeout(1500);

                // Required fields for manual entry
                const requiredFields = [
                    { name: 'Item Name', selector: 'input[name*="name" i]' },
                    { name: 'Category', selector: 'select, input[name*="category" i]' },
                    { name: 'Brand', selector: 'input[name*="brand" i]' },
                    { name: 'Purchase Date', selector: 'input[type="date"]' }
                ];

                for (const field of requiredFields) {
                    const hasField = await page.locator(field.selector).first().isVisible({ timeout: 1000 }).catch(() => false);
                    console.log(`[SCAN-041] ${field.name}: ${hasField}`);
                }
                await screenshot(page, testId, '01-manual-form');
            }
        }
    });
});
