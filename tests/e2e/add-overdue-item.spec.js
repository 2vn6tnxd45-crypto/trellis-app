// tests/e2e/add-overdue-item.spec.js
// Add an item with past installation date so maintenance task is due NOW

import { test, expect } from '@playwright/test';

async function dismissPrivacyBanner(page) {
    const btn = page.locator('button:has-text("No Thanks")').first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ force: true });
        console.log('✓ Dismissed privacy banner');
        await page.waitForTimeout(500);
    }
}

test('Add item with overdue maintenance', async ({ page }) => {
    // Login
    await page.goto('https://mykrib.app/home');
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('🔐 Logging in...');
        await emailInput.fill('devonandrewdavila@gmail.com');
        await page.locator('input[type="password"]').fill('Test1234');
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(3000);
    }

    await page.waitForSelector('nav', { timeout: 15000 });
    console.log('✓ Dashboard loaded');

    await dismissPrivacyBanner(page);

    // Click Add button
    console.log('Opening Add Item modal...');
    await page.locator('nav button').nth(2).click({ force: true });
    await page.waitForTimeout(2000);
    await dismissPrivacyBanner(page);

    // Click Type Manually
    await page.click('text="Type Manually"');
    await page.waitForTimeout(2000);

    console.log('✓ On Step 2 - filling form...');

    // STEP 2: Fill basic info
    // Item name
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('Water Heater');
    console.log('✓ Item name: Water Heater');

    // Category
    const categorySelect = page.locator('text="Select..."').first();
    if (await categorySelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await categorySelect.click();
        await page.waitForTimeout(500);
        const plumbingOption = page.locator('text=/Plumbing|HVAC|Appliance|Other/i').first();
        if (await plumbingOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await plumbingOption.click();
            console.log('✓ Selected category');
        }
    }

    // Room
    const areaSelect = page.locator('text="Select room..."').first();
    if (await areaSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await areaSelect.click();
        await page.waitForTimeout(500);
        const roomOption = page.locator('text=/Garage|Utility|Basement|Other/i').first();
        if (await roomOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await roomOption.click();
            console.log('✓ Selected room');
        }
    }

    // SET DATE INSTALLED TO 4 MONTHS AGO (so quarterly maintenance is overdue)
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Set date to 4 months ago (Oct 2025 if today is Jan 2026)
        const pastDate = new Date();
        pastDate.setMonth(pastDate.getMonth() - 4);
        const dateStr = pastDate.toISOString().split('T')[0]; // YYYY-MM-DD
        await dateInput.fill(dateStr);
        console.log(`✓ Set installation date to: ${dateStr} (4 months ago)`);
    }

    await page.screenshot({ path: 'overdue-item-step2.png', fullPage: true });

    // Click Next
    await page.locator('button:has-text("Next")').first().click({ force: true });
    await page.waitForTimeout(2000);

    console.log('✓ On Step 3 - adding details...');

    // STEP 3: Fill details
    // Brand
    const brandInput = page.locator('input[placeholder*="Samsung" i]').first();
    if (await brandInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await brandInput.fill('Rheem');
        console.log('✓ Brand: Rheem');
    }

    // Model
    const modelInput = page.locator('input[placeholder*="Model" i]').first();
    if (await modelInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await modelInput.fill('XG50T06EC36U1');
        console.log('✓ Model: XG50T06EC36U1');
    }

    // Cost
    const costInput = page.locator('input[placeholder="0.00"]').first();
    if (await costInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await costInput.fill('1200');
        console.log('✓ Cost: 1200');
    }

    // CRITICAL: Set maintenance to Monthly (so it's overdue faster)
    console.log('Setting maintenance frequency...');
    const maintenanceDropdown = page.locator('text="None (One-time)"').first();
    if (await maintenanceDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await maintenanceDropdown.click({ force: true });
        await page.waitForTimeout(1000);

        // Try Monthly first (more likely to be overdue)
        const monthlyOption = page.locator('text=/monthly|every month|1 month/i').first();
        const quarterlyOption = page.locator('text=/quarterly|every 3 month|3 month/i').first();

        if (await monthlyOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await monthlyOption.click();
            console.log('✓ Set MONTHLY maintenance');
        } else if (await quarterlyOption.isVisible({ timeout: 1000 }).catch(() => false)) {
            await quarterlyOption.click();
            console.log('✓ Set quarterly maintenance');
        } else {
            console.log('⚠ No recurring option found');
            await page.keyboard.press('Escape');
        }
    }

    await page.screenshot({ path: 'overdue-item-step3.png', fullPage: true });

    // Scroll down and save
    await page.keyboard.press('End');
    await page.waitForTimeout(500);

    // Click Save/Complete
    const saveSelectors = [
        'button:has-text("Save Item")',
        'button:has-text("Complete Setup")',
        'button:has-text("Save")',
        'button:has-text("Finish")',
    ];

    for (const sel of saveSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
            const btnText = await btn.textContent();
            console.log(`Clicking: "${btnText.trim()}"`);
            await btn.click({ force: true });
            await page.waitForTimeout(3000);
            break;
        }
    }

    await page.screenshot({ path: 'overdue-item-after-save.png', fullPage: true });

    // Navigate to Home
    console.log('Navigating to Home...');
    await dismissPrivacyBanner(page);
    await page.locator('nav >> text=Home').click({ force: true });
    await page.waitForTimeout(3000);

    await dismissPrivacyBanner(page);
    await page.screenshot({ path: 'overdue-item-home.png', fullPage: true });

    // Check for maintenance tasks
    console.log('\n========================================');
    console.log('CHECKING FOR MAINTENANCE TASKS');
    console.log('========================================\n');

    // Look for overdue/needs attention indicators
    const indicators = [
        { sel: 'button:has-text("Done")', name: 'Done buttons' },
        { sel: 'text=/overdue/i', name: 'Overdue text' },
        { sel: 'text=/needs attention/i', name: 'Needs Attention' },
        { sel: 'text=/due/i', name: 'Due text' },
        { sel: 'text=/Water Heater/i', name: 'Water Heater' },
    ];

    for (const { sel, name } of indicators) {
        const count = await page.locator(sel).count();
        console.log(`  ${name}: ${count}`);
    }

    // Check calendar for events
    console.log('\nChecking Calendar...');
    const calendarDots = await page.locator('.bg-orange-500, .bg-red-500, [class*="orange"], [class*="red"]').count();
    console.log(`  Calendar dots/indicators: ${calendarDots}`);

    // Scroll calendar to check for task markers
    await page.evaluate(() => {
        const calendar = document.querySelector('[class*="calendar"]');
        if (calendar) calendar.scrollIntoView();
    });
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'overdue-item-calendar.png', fullPage: true });

    const doneCount = await page.locator('button:has-text("Done")').count();
    console.log(`\n✅ Done buttons found: ${doneCount}`);

    if (doneCount > 0) {
        console.log('🎉 OVERDUE MAINTENANCE TASK CREATED SUCCESSFULLY!');
        console.log('Ready to test snooze bug.');
    } else {
        console.log('⚠ No Done buttons visible yet.');
        console.log('The maintenance system may need time to generate tasks.');
    }

    console.log('\n✅ Test complete');
});
