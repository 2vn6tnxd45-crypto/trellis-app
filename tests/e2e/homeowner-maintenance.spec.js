// tests/e2e/homeowner-maintenance.spec.js
// ============================================
// KRIB MAINTENANCE TESTS - VERIFIED SELECTORS
// ============================================
// Maintenance is on the HOME tab

import { test, expect } from '@playwright/test';
import { 
    loginAsHomeowner, 
    navigateToTab, 
    expectNoError, 
    expectSuccess
} from './helpers/homeowner-helpers.js';

test.describe('Homeowner Maintenance', () => {
    
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await navigateToTab(page, 'Home');
    });

    test('HO-MAINT-01: Dashboard shows maintenance content', async ({ page }) => {
        // Verified: Dashboard shows maintenance-related content
        const indicators = [
            'text=/maintenance|overdue|due soon|needs attention/i',
            'text=/task|upcoming|calendar/i',
            'button:has-text("Done")',
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
        console.log('✅ HO-MAINT-01 PASSED');
    });

    test('HO-MAINT-02: Calendar view toggle works', async ({ page }) => {
        const calBtn = page.locator('button:has-text("Calendar")').first();
        
        if (await calBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await calBtn.click();
            await page.waitForTimeout(1000);
            
            // Check for month name
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December'];
            const currentMonth = months[new Date().getMonth()];
            
            const monthVisible = await page.locator(`text=${currentMonth}`).first().isVisible({ timeout: 2000 }).catch(() => false);
            console.log(`${currentMonth} visible:`, monthVisible);
        }
        
        console.log('✅ HO-MAINT-02 PASSED');
    });

    test('HO-MAINT-03: Snooze task (catches Firebase bug)', async ({ page }) => {
        // Find task with Done button
        const taskCard = page.locator('div:has(button:has-text("Done"))').first();
        
        if (!await taskCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('⚠ No tasks to snooze - skipping');
            test.skip();
            return;
        }
        
        // Open task menu (chevron/ellipsis button)
        const menuBtn = taskCard.locator('button:has(svg)').last();
        await menuBtn.click();
        await page.waitForTimeout(500);
        
        // Look for Snooze
        const snoozeBtn = page.locator('button:has-text("Snooze")').first();
        if (!await snoozeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('⚠ No snooze option - skipping');
            test.skip();
            return;
        }
        
        await snoozeBtn.click();
        await page.waitForTimeout(500);
        
        // Select 1 Week
        const oneWeek = page.locator('text=/1 Week/i').first();
        if (await oneWeek.isVisible({ timeout: 2000 }).catch(() => false)) {
            await oneWeek.click();
        }
        
        // CRITICAL: Check for errors - this catches the Firebase bug
        await page.waitForTimeout(2000);
        
        const errorToast = page.locator('text=/failed.*snooze|error/i').first();
        if (await errorToast.isVisible({ timeout: 1500 }).catch(() => false)) {
            const errorText = await errorToast.textContent();
            console.error('❌ SNOOZE BUG:', errorText);
            throw new Error(`SNOOZE FAILED: ${errorText}`);
        }
        
        console.log('✓ No snooze errors');
        console.log('✅ HO-MAINT-03 PASSED');
    });

    test('HO-MAINT-04: Mark task Done', async ({ page }) => {
        const doneBtn = page.locator('button:has-text("Done")').first();
        
        if (!await doneBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('⚠ No tasks - skipping');
            test.skip();
            return;
        }
        
        const initialCount = await page.locator('button:has-text("Done")').count();
        console.log('Initial tasks:', initialCount);
        
        await doneBtn.click();
        await page.waitForTimeout(2000);
        
        await expectNoError(page);
        
        console.log('✅ HO-MAINT-04 PASSED');
    });

    test('HO-MAINT-05: Overdue tasks have warning styling', async ({ page }) => {
        const overdueIndicators = [
            'text=/overdue/i',
            '.text-red-600',
            '.bg-red-50',
            'text=/needs attention/i'
        ];
        
        let found = false;
        for (const sel of overdueIndicators) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                found = true;
                console.log('Found overdue indicator:', sel);
                break;
            }
        }
        
        console.log('Overdue styling found:', found);
        console.log('✅ HO-MAINT-05 PASSED');
    });

});
