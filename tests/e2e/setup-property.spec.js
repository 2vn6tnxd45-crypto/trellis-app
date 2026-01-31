// tests/e2e/setup-property.spec.js
// ============================================
// ONE-TIME SETUP: Complete property onboarding for test account
// ============================================

import { test, expect } from '@playwright/test';

const TEST_ACCOUNT = {
    email: 'devonandrewdavila@gmail.com',
    password: 'Test1234'
};

const BASE_URL = 'https://mykrib.app';

test.describe('Setup Test Account Property', () => {

    test('Complete property setup if needed', async ({ page }) => {
        // Go to app
        await page.goto(`${BASE_URL}/home`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        console.log('Page URL:', page.url());
        await page.screenshot({ path: 'setup-1-initial.png', fullPage: true });

        // Check if we need to login
        const emailInput = page.locator('input[type="email"]');
        if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('Logging in...');
            await emailInput.fill(TEST_ACCOUNT.email);
            await page.locator('input[type="password"]').fill(TEST_ACCOUNT.password);
            await page.locator('button[type="submit"]').click();

            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(3000);
        }

        await page.screenshot({ path: 'setup-2-after-login.png', fullPage: true });
        console.log('After login URL:', page.url());

        // Check if we're on the onboarding/setup page
        const setupIndicators = [
            'text=/set up your krib/i',
            'text=/property nickname/i',
            'text=/kreate my krib/i',
            'text=/welcome.*let.*get started/i',
            'text=/name your property/i'
        ];

        let onSetupPage = false;
        for (const sel of setupIndicators) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                onSetupPage = true;
                console.log('Found setup indicator:', sel);
                break;
            }
        }

        if (onSetupPage) {
            console.log('\n========================================');
            console.log('COMPLETING PROPERTY SETUP');
            console.log('========================================\n');

            // Step 1: Fill property nickname FIRST
            const nicknameInput = page.locator('input[placeholder*="Our First Home" i], input[placeholder*="Beach House" i]').first();
            if (await nicknameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nicknameInput.fill('Test Home');
                console.log('Filled nickname: Test Home');
            } else {
                // Try the first input on the page
                const firstInput = page.locator('input').first();
                if (await firstInput.isVisible().catch(() => false)) {
                    await firstInput.fill('Test Home');
                    console.log('Filled first input as nickname');
                }
            }

            await page.screenshot({ path: 'setup-3-nickname-filled.png', fullPage: true });
            await page.waitForTimeout(500);

            // Step 2: Fill address and SELECT from Google Places dropdown
            const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="street" i]').first();
            if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Clear and type the address
                await addressInput.click();
                await addressInput.fill('1234 Main Street, Austin, TX');
                console.log('Filled address');

                // Wait for Google Places autocomplete suggestions
                await page.waitForTimeout(2000);

                // Click the FIRST suggestion from Google Places dropdown (pac-container)
                const pacItem = page.locator('.pac-item').first();
                if (await pacItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await pacItem.click();
                    console.log('Selected address from Google Places dropdown');
                    await page.waitForTimeout(1000);
                } else {
                    // If no dropdown, press Escape to dismiss any overlay and Tab to move focus
                    console.log('No dropdown found, pressing Escape and Tab');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(300);
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(500);
                }
            }

            await page.screenshot({ path: 'setup-4-address-filled.png', fullPage: true });

            // Step 3: Dismiss any remaining overlay by clicking outside or pressing Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Step 4: Click the submit button (Kreate My Krib)
            const submitSelectors = [
                'button:has-text("Kreate My Krib")',
                'button:has-text("Create")',
                'button:has-text("Continue")',
                'button:has-text("Get Started")',
                'button:has-text("Next")',
                'button[type="submit"]'
            ];

            for (const sel of submitSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    console.log('Clicking:', sel);
                    // Use force click if needed to bypass any overlay
                    await btn.click({ force: true });
                    break;
                }
            }

            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(3000);

            await page.screenshot({ path: 'setup-5-after-submit.png', fullPage: true });
            console.log('After submit URL:', page.url());
        } else {
            console.log('Not on setup page - may already be set up');
        }

        // Now check if we're on the dashboard
        console.log('\n========================================');
        console.log('VERIFYING DASHBOARD');
        console.log('========================================\n');

        await page.screenshot({ path: 'setup-6-final.png', fullPage: true });

        // Check for bottom nav
        const navCheck = await page.locator('nav').count();
        console.log('Nav elements found:', navCheck);

        const bottomNavLabels = ['Home', 'Inventory', 'Pros', 'More'];
        for (const label of bottomNavLabels) {
            const found = await page.locator(`text=${label}`).first().isVisible({ timeout: 1000 }).catch(() => false);
            console.log(`  "${label}": ${found ? 'FOUND' : 'not found'}`);
        }

        // Check for dashboard content
        const dashboardIndicators = [
            'text=/maintenance/i',
            'text=/needs attention/i',
            'text=/due soon/i',
            'text=/overdue/i',
            'button:has-text("Done")'
        ];

        console.log('\nDashboard content:');
        for (const sel of dashboardIndicators) {
            const found = await page.locator(sel).first().isVisible({ timeout: 500 }).catch(() => false);
            if (found) console.log(`  Found: ${sel}`);
        }

        console.log('\n========================================');
        console.log('SETUP COMPLETE');
        console.log('========================================\n');
    });

});
