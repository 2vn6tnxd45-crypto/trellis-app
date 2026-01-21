// tests/e2e/helpers/homeowner-helpers.js
// ============================================
// KRIB E2E HELPERS - VERIFIED WORKING SELECTORS
// ============================================
// Tested and confirmed working on 2024-01-18

import { expect } from '@playwright/test';

export const TEST_ACCOUNT = {
    email: 'test.homeowner.full@gmail.com',
    password: 'TestPass123!'
};

export const BASE_URL = 'https://mykrib.app';

// ============================================
// VERIFIED NAV STRUCTURE:
// [Home:0] [Inventory:1] [+Add:2] [Pros:3] [More:4]
// ============================================

/**
 * Login and handle onboarding if needed
 */
export async function loginAsHomeowner(page) {
    await page.goto(`${BASE_URL}/home`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if already on dashboard (nav visible)
    const navVisible = await page.locator('nav >> text=Home').isVisible({ timeout: 3000 }).catch(() => false);
    if (navVisible) {
        console.log('✓ Already logged in');
        return true;
    }
    
    // Check for login form
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔐 Logging in...');
        await emailInput.fill(TEST_ACCOUNT.email);
        await page.locator('input[type="password"]').fill(TEST_ACCOUNT.password);
        await page.locator('button[type="submit"]').click();
        
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    }
    
    // Check for onboarding screen ("Set up your Krib")
    const onboarding = page.locator('text=Set up your Krib');
    if (await onboarding.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('📋 Completing onboarding...');
        
        // Fill property nickname
        await page.locator('input[placeholder*="First Home"]').fill('Test Home');
        
        // Fill address (type and wait for autocomplete)
        const addressInput = page.locator('input[placeholder*="address"]');
        await addressInput.fill('1234 Main St, Austin, TX');
        await page.waitForTimeout(1000);
        
        // Click first autocomplete option if visible
        const autocomplete = page.locator('[class*="autocomplete"], [class*="suggestion"]').first();
        if (await autocomplete.isVisible({ timeout: 2000 }).catch(() => false)) {
            await autocomplete.click();
        }
        
        // Submit
        await page.locator('button:has-text("Kreate")').click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    }
    
    // Verify we reached dashboard
    const dashboardReady = await page.locator('nav >> text=Home').isVisible({ timeout: 10000 }).catch(() => false);
    if (!dashboardReady) {
        throw new Error('Failed to reach dashboard after login');
    }
    
    console.log('✓ Login successful, dashboard ready');
    return true;
}

/**
 * Navigate using VERIFIED selectors
 */
export async function navigateToTab(page, tabName) {
    // Map aliases to actual nav labels
    const labelMap = {
        'Dashboard': 'Home',
        'Records': 'Inventory',
        'Items': 'Inventory',
        'Maintenance': 'Home',
        'Contractors': 'Pros',
    };
    
    const actualLabel = labelMap[tabName] || tabName;
    
    // Use the VERIFIED selector: nav >> text=Label
    const navButton = page.locator(`nav >> text=${actualLabel}`);
    
    if (await navButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await navButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        console.log(`✓ Navigated to ${actualLabel}`);
        return true;
    }
    
    console.warn(`⚠ Could not find tab: ${actualLabel}`);
    return false;
}

/**
 * Open More menu and click an item
 */
export async function openMoreMenuItem(page, itemName) {
    // Click More in nav
    const moreBtn = page.locator('nav >> text=More');
    await moreBtn.click();
    await page.waitForTimeout(500);
    
    // Click menu item (Reports, Settings, Help)
    const menuItem = page.locator(`text=${itemName}`).first();
    if (await menuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menuItem.click();
        await page.waitForTimeout(1000);
        console.log(`✓ Opened ${itemName}`);
        return true;
    }
    
    console.warn(`⚠ Could not find menu item: ${itemName}`);
    return false;
}

/**
 * Click the center Add button (index 2)
 */
export async function clickAddButton(page) {
    const addBtn = page.locator('nav button').nth(2);
    await addBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ Clicked Add button');
    return true;
}

/**
 * Check NO error toast appeared
 */
export async function expectNoError(page) {
    const errorToast = page.locator('text=/failed|error|could not|unable/i').first();
    if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await errorToast.textContent();
        console.error(`❌ ERROR: ${text}`);
        throw new Error(`Action failed: ${text}`);
    }
    console.log('✓ No errors');
    return true;
}

/**
 * Check success toast appeared
 */
export async function expectSuccess(page, patterns = ['saved', 'success', 'created', 'updated', 'added', 'deleted', 'snoozed', 'completed', 'done']) {
    const regex = new RegExp(patterns.join('|'), 'i');
    const toast = page.locator(`text=/${regex.source}/i`).first();
    
    if (await toast.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✓ Success toast');
        return true;
    }
    console.warn('⚠ No success toast');
    return false;
}

/**
 * Count elements
 */
export async function countElements(page, selector) {
    await page.waitForTimeout(300);
    return await page.locator(selector).count();
}
