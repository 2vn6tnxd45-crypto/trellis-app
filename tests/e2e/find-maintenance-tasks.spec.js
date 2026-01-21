// tests/e2e/find-maintenance-tasks.spec.js
// Debug test to find where maintenance tasks are displayed

import { test, expect } from '@playwright/test';

async function dismissPrivacyBanner(page) {
    const btn = page.locator('button:has-text("No Thanks")').first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
    }
}

test('Find where maintenance tasks are displayed', async ({ page }) => {
    // Login
    await page.goto('https://mykrib.app/home');
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailInput.fill('test.homeowner.full@gmail.com');
        await page.locator('input[type="password"]').fill('TestPass123!');
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(3000);
    }

    await page.waitForSelector('nav', { timeout: 15000 });
    await dismissPrivacyBanner(page);

    console.log('\n========================================');
    console.log('EXPLORING PAGE STRUCTURE');
    console.log('========================================\n');

    // Get all section headers
    const sections = await page.locator('h1, h2, h3, h4, [class*="section"], [class*="card"]').all();
    console.log(`Found ${sections.length} potential sections`);

    // Look for specific text content
    const searchTerms = [
        'Maintenance',
        'Tasks',
        'Upcoming',
        'Overdue',
        'Needs Attention',
        'Due',
        'Water Heater',
        'Test AC Unit',
        'Done',
        'Snooze',
        'Schedule'
    ];

    console.log('\nSearching for key terms...');
    for (const term of searchTerms) {
        const count = await page.locator(`text=${term}`).count();
        if (count > 0) {
            const first = page.locator(`text=${term}`).first();
            const visible = await first.isVisible().catch(() => false);
            console.log(`  "${term}": count=${count}, visible=${visible}`);
        }
    }

    // Look for collapsible sections and expand them
    console.log('\nLooking for expandable sections...');
    const expandButtons = await page.locator('button:has(svg[class*="chevron"]), [class*="collapse"], [class*="expand"]').all();
    console.log(`Found ${expandButtons.length} potential expand buttons`);

    // Click on each section to expand
    const sectionHeaders = ['My Home', 'Home Calendar', 'My Contractors', 'History & Archive', 'Quick Actions'];
    for (const header of sectionHeaders) {
        const section = page.locator(`text="${header}"`).first();
        if (await section.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log(`  Clicking on "${header}"...`);
            await section.click();
            await page.waitForTimeout(500);
        }
    }

    await page.screenshot({ path: 'find-tasks-1-expanded.png', fullPage: true });

    // Check inventory for items with maintenance
    console.log('\nChecking Inventory tab...');
    await page.locator('nav >> text=Inventory').click({ force: true });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'find-tasks-2-inventory.png', fullPage: true });

    // Look for items
    const items = await page.locator('[class*="card"], [class*="item"]').all();
    console.log(`Found ${items.length} card/item elements in Inventory`);

    // Check if items show maintenance status
    const waterHeater = page.locator('text="Water Heater"').first();
    if (await waterHeater.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✓ Water Heater found in Inventory');
        // Click on it to see details
        await waterHeater.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'find-tasks-3-item-details.png', fullPage: true });

        // Check for maintenance info
        const maintInfo = await page.locator('text=/maintenance|next due|overdue|schedule/i').count();
        console.log(`  Maintenance-related text in details: ${maintInfo}`);
    }

    // Go back to Home and check calendar dates
    console.log('\nGoing back to Home to check calendar...');
    await page.locator('nav >> text=Home').click({ force: true });
    await page.waitForTimeout(2000);

    // Click on today's date in calendar
    const today = new Date().getDate().toString();
    console.log(`Looking for today (${today}) in calendar...`);
    const todayCell = page.locator(`text="${today}"`).first();
    if (await todayCell.isVisible({ timeout: 1000 }).catch(() => false)) {
        await todayCell.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'find-tasks-4-calendar-click.png', fullPage: true });
    }

    // Check for any modal or popup that appeared
    const modal = await page.locator('[class*="modal"], [class*="popup"], [class*="overlay"]').first();
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Modal/popup appeared after clicking calendar date');
        await page.screenshot({ path: 'find-tasks-5-modal.png', fullPage: true });
    }

    // Navigate to past dates where maintenance might be due
    console.log('\nNavigating to October 2025 (when water heater was installed)...');
    const prevBtn = page.locator('button:has(svg), [aria-label*="previous"]').first();
    for (let i = 0; i < 3; i++) {  // Go back 3 months
        if (await prevBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await prevBtn.click();
            await page.waitForTimeout(500);
        }
    }

    await page.screenshot({ path: 'find-tasks-6-past-calendar.png', fullPage: true });

    console.log('\n✅ Exploration complete - check screenshots');
});
