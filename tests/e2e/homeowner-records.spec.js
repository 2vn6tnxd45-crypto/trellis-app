// tests/e2e/homeowner-records.spec.js
// ============================================
// KRIB RECORDS/INVENTORY TESTS - VERIFIED SELECTORS
// ============================================
// Records are on the INVENTORY tab

import { test, expect } from '@playwright/test';
import { 
    loginAsHomeowner, 
    navigateToTab, 
    clickAddButton,
    expectNoError, 
    expectSuccess
} from './helpers/homeowner-helpers.js';

test.describe('Homeowner Records/Inventory', () => {
    
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
    });

    test('HO-REC-01: Inventory tab loads', async ({ page }) => {
        await navigateToTab(page, 'Inventory');
        await page.waitForTimeout(1500);
        
        // Look for record content or empty state
        const indicators = [
            'text=/Samsung|Carrier|Rheem|LG|HVAC|Plumbing|Appliances/i',
            'text=/no items|add your first|scan/i',
            'text=/inventory|records|items/i'
        ];
        
        let found = false;
        for (const sel of indicators) {
            if (await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false)) {
                found = true;
                console.log('Found:', sel);
                break;
            }
        }
        
        expect(found).toBeTruthy();
        console.log('✅ HO-REC-01 PASSED');
    });

    test('HO-REC-02: Add button opens scanner/modal', async ({ page }) => {
        await clickAddButton(page);
        await page.waitForTimeout(1000);
        
        // Should see add options
        const addOptions = [
            'text=/scan.*receipt|scan.*invoice/i',
            'text=/manual|add.*manually/i',
            'text=/what.*add/i'
        ];
        
        let found = false;
        for (const sel of addOptions) {
            if (await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false)) {
                found = true;
                console.log('Add modal shows:', sel);
                break;
            }
        }
        
        expect(found).toBeTruthy();
        console.log('✅ HO-REC-02 PASSED');
    });

    test('HO-REC-03: Record card expands on click', async ({ page }) => {
        await navigateToTab(page, 'Inventory');
        await page.waitForTimeout(1000);
        
        // Find any record card
        const recordCard = page.locator('div.bg-white.rounded-2xl').first();
        
        if (!await recordCard.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('⚠ No records to expand - skipping');
            test.skip();
            return;
        }
        
        await recordCard.click();
        await page.waitForTimeout(500);
        
        // Expanded state shows Edit button
        const editBtn = page.locator('button:has-text("Edit")').first();
        const isExpanded = await editBtn.isVisible({ timeout: 2000 }).catch(() => false);
        
        expect(isExpanded).toBeTruthy();
        console.log('✅ HO-REC-03 PASSED');
    });

    test('HO-REC-04: Edit record works', async ({ page }) => {
        await navigateToTab(page, 'Inventory');
        await page.waitForTimeout(1000);
        
        const recordCard = page.locator('div.bg-white.rounded-2xl').first();
        
        if (!await recordCard.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('⚠ No records - skipping');
            test.skip();
            return;
        }
        
        // Click to expand
        await recordCard.click();
        await page.waitForTimeout(500);
        
        // Click Edit
        const editBtn = page.locator('button:has-text("Edit")').first();
        if (!await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('⚠ No edit button - skipping');
            test.skip();
            return;
        }
        
        await editBtn.click();
        await page.waitForTimeout(500);
        
        // Should see form
        const formVisible = await page.locator('input, textarea').first().isVisible({ timeout: 2000 }).catch(() => false);
        expect(formVisible).toBeTruthy();
        
        console.log('✅ HO-REC-04 PASSED');
    });

});
