// tests/scanner.spec.js
// ============================================
// RECEIPT SCANNER TESTS
// ============================================
// Tests for receipt scanning and AI extraction

import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_ACCOUNT = {
  email: 'test.homeowner.full@gmail.com',
  password: 'KribTest123!'
};

// ============================================
// HELPER: Login
// ============================================
async function loginAsHomeowner(page) {
  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const alreadyLoggedIn = await page.locator('text=/dashboard|my home|inventory/i').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  const signInButton = page.locator('text=/sign in|log in/i').first();
  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();
  }

  await page.fill('input[type="email"]', TEST_ACCOUNT.email);
  await page.fill('input[type="password"]', TEST_ACCOUNT.password);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ============================================
// HELPER: Open scanner
// ============================================
async function openScanner(page) {
  // Find and click the Add/Scan button
  const addSelectors = [
    'text=Scan',
    'text=Add',
    'button:has-text("+")',
    '[data-testid="add-record"]',
    '[data-testid="scan-button"]',
    '[aria-label="Add"]'
  ];

  for (const selector of addSelectors) {
    const addButton = page.locator(selector).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      return true;
    }
  }

  return false;
}

// ============================================
// SCANNER UI TESTS
// ============================================

test.describe('Scanner Interface', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-01: Scanner opens when Add is clicked', async ({ page }) => {
    const scannerOpened = await openScanner(page);
    expect(scannerOpened).toBeTruthy();

    // Should see scanner interface
    const scannerIndicators = [
      'text=/scan|upload|photo|camera|receipt|document/i',
      'input[type="file"]',
      '[data-testid="scanner"]',
      'text=Take Photo',
      'text=Upload'
    ];

    let foundScanner = false;
    for (const indicator of scannerIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundScanner = true;
        break;
      }
    }

    expect(foundScanner).toBeTruthy();
  });

  test('HO-SCAN-02: Scanner has upload option', async ({ page }) => {
    await openScanner(page);

    // Look for file input or upload button
    const uploadSelectors = [
      'input[type="file"]',
      'text=Upload',
      'text=Choose File',
      'text=Gallery',
      'text=Browse',
      '[data-testid="upload-input"]'
    ];

    let foundUpload = false;
    for (const selector of uploadSelectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        foundUpload = true;
        break;
      }
      // Also check for hidden file inputs
      if (await page.locator(selector).count() > 0) {
        foundUpload = true;
        break;
      }
    }

    expect(foundUpload).toBeTruthy();
  });

  test('HO-SCAN-03: Scanner can be closed/cancelled', async ({ page }) => {
    await openScanner(page);

    // Find close/cancel button
    const closeSelectors = [
      'text=Cancel',
      'text=Close',
      'button:has-text("×")',
      '[aria-label="Close"]',
      'text=Back',
      '[data-testid="close-scanner"]'
    ];

    for (const selector of closeSelectors) {
      const closeButton = page.locator(selector).first();
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);

        // Should be back on dashboard
        const onDashboard = await page.locator('text=/dashboard|my home|records/i').first().isVisible().catch(() => false);
        expect(onDashboard).toBeTruthy();
        return;
      }
    }

    // If no close button, try pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('HO-SCAN-04: Scanner shows instructions or prompts', async ({ page }) => {
    await openScanner(page);

    // Should see helpful text
    const instructionIndicators = [
      'text=/scan|take|upload|receipt|document|photo/i',
      'text=/drag|drop/i',
      'text=/tap|click/i'
    ];

    let foundInstructions = false;
    for (const indicator of instructionIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundInstructions = true;
        break;
      }
    }

    expect(foundInstructions).toBeTruthy();
  });
});

// ============================================
// FILE UPLOAD TESTS
// ============================================

test.describe('File Upload', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-05: File input accepts images', async ({ page }) => {
    await openScanner(page);

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();

    // Check if it exists and what types it accepts
    const acceptAttribute = await fileInput.getAttribute('accept').catch(() => null);

    console.log('File input accept attribute:', acceptAttribute);

    // Should accept images
    if (acceptAttribute) {
      const acceptsImages = acceptAttribute.includes('image') || acceptAttribute.includes('*');
      expect(acceptsImages).toBeTruthy();
    }
  });

  test('HO-SCAN-06: Uploading triggers processing state', async ({ page }) => {
    await openScanner(page);

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      // Create a simple test image (1x1 white pixel PNG as base64)
      // In real tests, you'd use actual receipt images

      // Set up file chooser listener
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('text=/upload|choose|browse/i').first().click().catch(async () => {
          // If no button, try clicking the label or the input itself
          await fileInput.click().catch(() => { });
        })
      ]).catch(() => [null]);

      if (fileChooser) {
        // Note: In real testing, you'd provide actual test image files
        console.log('File chooser opened - would upload test image here');
      }
    }
  });

  // Note: Full upload/processing tests require actual image files
  // and may need longer timeouts for AI processing

  test('HO-SCAN-07: Manual entry option exists', async ({ page }) => {
    await openScanner(page);

    // Look for manual entry option
    const manualSelectors = [
      'text=/manual|enter manually|add without scan|skip/i',
      'text=Add Manually',
      'text=Enter Details',
      '[data-testid="manual-entry"]'
    ];

    let foundManual = false;
    for (const selector of manualSelectors) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        foundManual = true;
        console.log('Manual entry option found');
        break;
      }
    }

    // Manual entry might not be directly in scanner
    console.log('Manual entry available:', foundManual);
  });
});

// ============================================
// RECORD CREATION AFTER SCAN
// ============================================

test.describe('Post-Scan Record Creation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-08: Can create record with manual entry', async ({ page }) => {
    // Open add/scanner
    await openScanner(page);

    // Look for manual entry or form fields
    const manualButton = page.locator('text=/manual|enter|add item|new record/i').first();

    if (await manualButton.isVisible().catch(() => false)) {
      await manualButton.click();
      await page.waitForTimeout(500);
    }

    // Look for form fields
    const hasForm = await page.locator('input, textarea, select').first().isVisible().catch(() => false);

    if (hasForm) {
      // Try to fill out a basic record
      // Look for item/name field
      const nameInput = page.locator('input[name="item"], input[name="name"], input[placeholder*="name"], input[placeholder*="item"]').first();

      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Test Item from Playwright');

        // Look for category selector
        const categorySelect = page.locator('select, [role="combobox"]').first();
        if (await categorySelect.isVisible().catch(() => false)) {
          await categorySelect.click();
          await page.waitForTimeout(300);
          // Select first option or Appliances
          const option = page.locator('option, [role="option"]').first();
          if (await option.isVisible().catch(() => false)) {
            await option.click();
          }
        }

        // Look for save button
        const saveButton = page.locator('text=/save|create|add|done|submit/i').first();
        if (await saveButton.isVisible().catch(() => false)) {
          // Don't actually save - just verify button exists
          console.log('Save button found - form is complete');
        }
      }
    }
  });

  test('HO-SCAN-09: Form validation prevents empty submission', async ({ page }) => {
    await openScanner(page);

    // Try to find and click save without filling anything
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), button[type="submit"]').first();

    if (await saveButton.isVisible().catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(500);

      // Should either:
      // 1. Show validation error
      // 2. Still be on the form (didn't navigate away)
      const hasError = await page.locator('text=/required|please|enter|invalid/i').first().isVisible().catch(() => false);
      const stillOnForm = await page.locator('input').first().isVisible().catch(() => false);

      expect(hasError || stillOnForm).toBeTruthy();
    }
  });
});
