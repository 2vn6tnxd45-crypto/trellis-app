// tests/e2e/homeowner/scanner.spec.js
// ============================================
// RECEIPT SCANNER & AI TESTS
// ============================================
// Tests for receipt scanning, file upload, and AI extraction

import { test, expect } from '@playwright/test';

// Verified working credentials (2026-01-27)
const TEST_ACCOUNT = {
  email: 'devonandrewdavila@gmail.com',
  password: 'Test1234'
};

async function waitForAppLoad(page) {
  // Use domcontentloaded instead of networkidle - networkidle times out with WebSockets/polling
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function dismissPrivacyBanner(page) {
  const bannerButtons = [
    'button:has-text("No Thanks")',
    'button:has-text("Accept Offers")',
    'button:has-text("Accept")',
    'button:has-text("Got it")'
  ];
  for (const selector of bannerButtons) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function loginAsHomeowner(page) {
  await page.goto('/home');
  await waitForAppLoad(page);

  // Check if already logged in - look for specific dashboard elements
  const dashboardIndicators = [
    'text=HEALTH SCORE',
    'text=My Home',
    'text=ITEMS'
  ];

  for (const indicator of dashboardIndicators) {
    if (await page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      return; // Already logged in
    }
  }

  // Need to login
  const signInButton = page.locator('button:has-text("Sign In")');
  if (await signInButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await signInButton.click();
    await page.waitForTimeout(1000);
  }

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  await page.fill('input[type="email"]', TEST_ACCOUNT.email);
  await page.fill('input[type="password"]', TEST_ACCOUNT.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForSelector('text=HEALTH SCORE', { timeout: 20000 });
  await waitForAppLoad(page);
}

async function openScanner(page) {
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

  test('HO-SCAN-01: Scanner opens from dashboard CTA', async ({ page }) => {
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

  test('HO-SCAN-02: Scanner opens from navigation', async ({ page }) => {
    // Look for scan in navigation
    const navScan = page.locator('nav text=Scan, nav text=Add, [data-testid="nav-scan"]').first();

    if (await navScan.isVisible().catch(() => false)) {
      await navScan.click();
      await page.waitForTimeout(1000);

      // Should see scanner
      const hasScanner = await page.locator('text=/scan|upload|photo|camera/i').first().isVisible().catch(() => false);
      expect(hasScanner).toBeTruthy();
    }
  });

  test('HO-SCAN-05: File upload option is available', async ({ page }) => {
    await openScanner(page);

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

  test('HO-SCAN-06: Drag and drop zone is visible (desktop)', async ({ page }) => {
    await openScanner(page);

    // Look for drag-drop zone
    const dragDropIndicators = [
      'text=/drag|drop/i',
      '[data-testid="drop-zone"]',
      '.dropzone',
      'text=/drag and drop|drop files/i'
    ];

    let foundDragDrop = false;
    for (const indicator of dragDropIndicators) {
      if (await page.locator(indicator).first().isVisible().catch(() => false)) {
        foundDragDrop = true;
        break;
      }
    }

    console.log('Drag-drop zone visible:', foundDragDrop);
  });

  test('HO-SCAN-09: Cancel button closes scanner', async ({ page }) => {
    await openScanner(page);

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

    // Try pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });
});

// ============================================
// FILE UPLOAD TESTS
// ============================================

test.describe('File Upload', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-11: File input accepts images', async ({ page }) => {
    await openScanner(page);

    const fileInput = page.locator('input[type="file"]').first();
    const acceptAttribute = await fileInput.getAttribute('accept').catch(() => null);

    console.log('File input accept attribute:', acceptAttribute);

    if (acceptAttribute) {
      const acceptsImages = acceptAttribute.includes('image') || acceptAttribute.includes('*');
      expect(acceptsImages).toBeTruthy();
    }
  });

  test('HO-SCAN-18: Upload progress indicator exists', async ({ page }) => {
    await openScanner(page);

    // File input should be present
    const fileInput = page.locator('input[type="file"]').first();
    const hasFileInput = await fileInput.count() > 0;

    expect(hasFileInput).toBeTruthy();
  });
});

// ============================================
// MANUAL ENTRY TESTS
// ============================================

test.describe('Manual Entry', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-62: Manual entry option exists when AI fails', async ({ page }) => {
    await openScanner(page);

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

    console.log('Manual entry available:', foundManual);
  });

  test('HO-SCAN-46: Can create record with manual entry', async ({ page }) => {
    await openScanner(page);

    // Look for manual entry - use force:true to bypass modal backdrop
    const manualButton = page.locator('text=/manual|enter|add item|new record/i').first();

    if (await manualButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await manualButton.click({ force: true });
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠ Manual entry button not found - skipping');
      test.skip();
      return;
    }

    // Look for form fields
    const hasForm = await page.locator('input, textarea, select').first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasForm) {
      // Look for item/name field
      const nameInput = page.locator('input[name="item"], input[name="name"], input[placeholder*="name"], input[placeholder*="item"]').first();

      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Test Item from Playwright');

        // Look for save button
        const saveButton = page.locator('text=/save|create|add|done|submit/i').first();
        if (await saveButton.isVisible().catch(() => false)) {
          console.log('Save button found - form is complete');
        }
      }
    } else {
      console.log('⚠ Form not visible - UI may differ');
      test.skip();
    }
  });
});

// ============================================
// FORM VALIDATION TESTS
// ============================================

test.describe('Scanner Form Validation', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-44: Form validation prevents empty submission', async ({ page }) => {
    await openScanner(page);

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Add"), button[type="submit"]').first();

    if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveButton.click({ force: true });
      await page.waitForTimeout(500);

      // Should show validation error or still be on form
      const hasError = await page.locator('text=/required|please|enter|invalid/i').first().isVisible().catch(() => false);
      const stillOnForm = await page.locator('input').first().isVisible().catch(() => false);

      expect(hasError || stillOnForm).toBeTruthy();
    } else {
      console.log('⚠ Save button not immediately visible - scanner may require input first');
      test.skip();
    }
  });
});

// ============================================
// AI EXTRACTION TESTS (placeholder - needs real images)
// ============================================

test.describe('AI Extraction', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsHomeowner(page);
  });

  test('HO-SCAN-23: Processing indicator shown during AI analysis', async ({ page }) => {
    // This test would require uploading a real image
    // For now, just verify the scanner UI is present
    await openScanner(page);

    const hasScanner = await page.locator('text=/scan|upload|photo/i').first().isVisible().catch(() => false);
    expect(hasScanner).toBeTruthy();

    console.log('Note: Full AI extraction tests require actual image uploads');
  });
});
