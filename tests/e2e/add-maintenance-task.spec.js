// tests/e2e/add-maintenance-task.spec.js
// Manually add a maintenance task that is due TODAY

import { test, expect } from '@playwright/test';

async function dismissPrivacyBanner(page) {
    const btn = page.locator('button:has-text("No Thanks")').first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
    }
}

test('Add maintenance task due today', async ({ page }) => {
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

    // Go to Inventory
    console.log('Going to Inventory...');
    await page.locator('nav >> text=Inventory').click({ force: true });
    await page.waitForTimeout(2000);
    await dismissPrivacyBanner(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Find and expand Water Heater card
    console.log('Finding Water Heater card...');
    const cards = await page.locator('[class*="border"][class*="rounded"]').all();

    let waterHeaterCard = null;
    for (const card of cards) {
        const text = await card.textContent().catch(() => '');
        if (text.includes('Water Heater') && text.includes('XG50T06EC36U1')) {
            waterHeaterCard = card;
            break;
        }
    }

    if (waterHeaterCard) {
        await waterHeaterCard.click();
        await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'add-task-1-expanded.png', fullPage: true });

    // Look for Add Task - but be more specific to avoid Edit Item modal
    // The "+ Add Task" in the card should have specific styling
    console.log('Looking for + Add Task link in card (not Edit modal)...');

    // First, ensure no modal is open
    const editModal = page.locator('text="Edit Item"');
    if (await editModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Edit modal is open, closing...');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }

    // Now look for "+ Add Task" specifically within the card content (green link)
    // It should be inside the expanded Water Heater area
    const addTaskInCard = page.locator('text=/\\+ Add Task/').first();
    const addTaskVisible = await addTaskInCard.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`"+ Add Task" visible in card: ${addTaskVisible}`);

    if (addTaskVisible) {
        // Click it
        console.log('Clicking + Add Task...');
        await addTaskInCard.click();
        await page.waitForTimeout(1500);

        await page.screenshot({ path: 'add-task-2-after-add-click.png', fullPage: true });

        // Check what opened - is it Edit Item modal or something else?
        const modalTitle = await page.locator('.modal h2, [role="dialog"] h2, text=/Edit Item|Add Task|Create Task/').first().textContent().catch(() => '');
        console.log(`Modal/form title: "${modalTitle}"`);

        // If Edit Item modal opened, scroll to find Maintenance Tasks section
        if (modalTitle.includes('Edit Item') || await page.locator('text="Edit Item"').isVisible({ timeout: 500 }).catch(() => false)) {
            console.log('Edit Item modal opened. Scrolling to find Maintenance Tasks...');

            // Scroll within the modal
            const modal = page.locator('[role="dialog"], .modal, .fixed.inset-0').first();
            await modal.evaluate(el => el.scrollTo(0, 1000));
            await page.waitForTimeout(500);

            await page.screenshot({ path: 'add-task-3-modal-scrolled.png', fullPage: true });

            // Look for maintenance section
            const maintSection = page.locator('text=/Maintenance|Tasks/i');
            const maintCount = await maintSection.count();
            console.log(`Maintenance text found: ${maintCount}`);
        }
    }

    // Check for any task creation form
    const taskInputs = await page.locator('input[placeholder*="task" i], input[placeholder*="description" i]').count();
    console.log(`Task-specific inputs found: ${taskInputs}`);

    // Close any modal and go to Home to check current state
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await dismissPrivacyBanner(page);

    console.log('Going to Home...');
    await page.locator('nav >> text=Home').click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'add-task-final-home.png', fullPage: true });

    // Check for maintenance tasks
    const doneButtons = await page.locator('button:has-text("Done")').count();
    console.log(`\nDone buttons on Home: ${doneButtons}`);

    // Also check items count to verify nothing got corrupted
    const pageText = await page.locator('body').textContent();
    if (pageText.includes('2') && pageText.includes('ITEMS')) {
        console.log('✓ 2 items still in inventory');
    }

    console.log('\n✅ Test complete');
});
