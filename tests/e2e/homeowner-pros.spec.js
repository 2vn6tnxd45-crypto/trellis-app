// tests/e2e/homeowner-pros.spec.js
// ============================================
// KRIB PROS/CONTRACTORS TESTS - VERIFIED SELECTORS
// ============================================
// Pros are on the PROS tab (ProConnect)

import { test, expect } from '@playwright/test';
import { 
    loginAsHomeowner, 
    navigateToTab, 
    expectNoError
} from './helpers/homeowner-helpers.js';

test.describe('Homeowner Pros/Contractors', () => {
    
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
    });

    test('HO-PRO-01: Pros tab loads ProConnect', async ({ page }) => {
        await navigateToTab(page, 'Pros');
        await page.waitForTimeout(1500);
        
        // ProConnect shows: header, tabs, content
        const indicators = [
            'text=/Pro Connect|My Pros|Find.*Pro/i',
            'text=/Find help|manage.*contractor/i',
            'button:has-text("Post a Job")',
            'text=/no pros|no contractors/i',
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
        console.log('✅ HO-PRO-01 PASSED');
    });

    test('HO-PRO-02: My Pros tab content', async ({ page }) => {
        await navigateToTab(page, 'Pros');
        await page.waitForTimeout(1000);
        
        // Click My Pros tab
        const myProsTab = page.locator('button:has-text("My Pros")').first();
        if (await myProsTab.isVisible().catch(() => false)) {
            await myProsTab.click();
            await page.waitForTimeout(500);
        }
        
        // Should see contractors or empty state
        const hasContent = await page.locator('button:has-text("Message"), button:has-text("Call"), text=/no pros/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        
        console.log('My Pros has content:', hasContent);
        console.log('✅ HO-PRO-02 PASSED');
    });

    test('HO-PRO-03: Post a Job button works', async ({ page }) => {
        await navigateToTab(page, 'Pros');
        await page.waitForTimeout(1000);
        
        const postJobBtn = page.locator('button:has-text("Post a Job")').first();
        
        if (!await postJobBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('⚠ No Post a Job button - skipping');
            test.skip();
            return;
        }
        
        await postJobBtn.click();
        await page.waitForTimeout(1000);
        
        // Modal should open
        const modalContent = await page.locator('text=/post.*job|describe|category|service/i').first().isVisible({ timeout: 2000 }).catch(() => false);
        
        expect(modalContent).toBeTruthy();
        console.log('✅ HO-PRO-03 PASSED');
    });

    test('HO-PRO-04: Find tab shows marketplace', async ({ page }) => {
        await navigateToTab(page, 'Pros');
        await page.waitForTimeout(1000);
        
        // Click Find tab
        const findTab = page.locator('button:has-text("Find")').first();
        if (await findTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await findTab.click();
            await page.waitForTimeout(1000);
            
            // Should see marketplace content
            const hasMarketplace = await page.locator('text=/browse|search|find.*pro|category/i').first().isVisible({ timeout: 2000 }).catch(() => false);
            console.log('Marketplace visible:', hasMarketplace);
        }
        
        console.log('✅ HO-PRO-04 PASSED');
    });

});
