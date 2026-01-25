const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('Navigating to login...');
        await page.goto('https://mykrib.app/auth/login');

        // Wait for login form
        await page.waitForTimeout(2000);

        // Handle if redirected to home (already logged in? unlikely in fresh context)
        if (page.url().includes('login') || page.url().includes('signin')) {
            console.log('Logging in...');
            await page.fill('input[type="email"]', 'devonandrewdavila@gmail.com');
            await page.fill('input[type="password"]', 'Test1234');
            await page.click('button[type="submit"]');

            await page.waitForNavigation({ timeout: 15000 }).catch(() => console.log('Navigation timeout, checking URL...'));
        }

        console.log('Waiting for auth state...');
        await page.waitForTimeout(5000);

        // Extract UID from localStorage
        const uid = await page.evaluate(() => {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key.includes('firebase:authUser')) {
                    const val = JSON.parse(localStorage.getItem(key));
                    return val.uid;
                }
            }
            return null;
        });

        if (uid) {
            console.log(`UID: ${uid}`);
        } else {
            console.log('UID not found in localStorage');
            // Print all keys for debug
            const allKeys = await page.evaluate(() => Object.keys(localStorage));
            console.log('Keys:', allKeys);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
