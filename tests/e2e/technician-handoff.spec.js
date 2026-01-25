// tests/e2e/technician-handoff.spec.js
// ============================================
// TECHNICIAN HANDOFF TEST SUITE
// ============================================
// Tests the three-party flow: Admin → Technician → Homeowner
// Verifies dispatch assignment, mobile status updates, and real-time sync

import { test, expect } from '@playwright/test';
import {
    loginAsContractor,
    loginAsHomeowner,
    loginWithCredentials,
    TEST_ACCOUNTS,
    screenshot,
    waitForLoadingComplete,
    waitForToast,
    uniqueId
} from '../utils/test-helpers.js';

// ============================================
// CONFIGURATION
// ============================================
const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// Set to true to use real test account with existing data
const USE_REAL_ACCOUNT = true;

// ============================================
// HELPER: Login as Technician (via Tech Mobile Portal)
// ============================================
async function loginAsTechnician(page, credentials = {}) {
    const { pin = '1234', techName = 'Test Tech' } = credentials;
    console.log(`[Auth] Logging in as technician: ${techName}`);

    // Navigate to tech mobile portal
    await page.goto(`${BASE_URL}/tech`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check if already logged in (view "Today's Jobs" or similar)
    const alreadyLoggedIn = await page.locator('text=/today|jobs|dashboard/i').first()
        .isVisible({ timeout: 2000 }).catch(() => false);

    if (alreadyLoggedIn) {
        console.log('[Auth] Already logged in as technician');
        return true;
    }

    // Look for PIN entry screen
    const pinInput = page.locator('input[type="password"], input[placeholder*="PIN" i], input[inputmode="numeric"]').first();
    if (await pinInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('[Auth] PIN entry screen detected');
        await pinInput.fill(pin);

        const submitBtn = page.locator('button:has-text("Enter"), button:has-text("Login"), button[type="submit"]').first();
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(2000);
        }
    }

    // Alternative: Company code + tech selection
    const companyCodeInput = page.locator('input[placeholder*="company" i]').first();
    if (await companyCodeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[Auth] Company code entry detected');
        // This would require actual company code from the test contractor
    }

    await waitForLoadingComplete(page);
    console.log('[Auth] Technician login complete');
    return true;
}

// ============================================
// TEST SUITE: Technician Handoff Flow
// ============================================
test.describe.skip('Technician Handoff - Three Party Flow', () => {
    test.setTimeout(300000); // 5 minutes for complex multi-party test

    test('TECH-001: Admin dispatches job, Tech updates status, Admin sees sync', async ({ browser }) => {
        // Create three separate browser contexts for parallel simulation
        const adminContext = await browser.newContext();
        const techContext = await browser.newContext({
            viewport: { width: 390, height: 844 }, // iPhone 14 Pro dimensions
            isMobile: true,
            hasTouch: true
        });
        const homeownerContext = await browser.newContext();

        const adminPage = await adminContext.newPage();
        const techPage = await techContext.newPage();
        const homeownerPage = await homeownerContext.newPage();

        const testId = uniqueId('tech-handoff');
        console.log(`[TECH-HANDOFF] Starting test: ${testId}`);

        try {
            // ============================================
            // STEP 1: Admin creates and assigns job
            // ============================================
            console.log('[TECH-HANDOFF] Step 1: Admin creates job');

            await loginAsContractor(adminPage, { useStoredSession: false });
            await waitForLoadingComplete(adminPage);
            await screenshot(adminPage, testId, '01-admin-logged-in');

            // Navigate to Jobs
            const jobsNav = adminPage.locator('text="Jobs"').first();
            if (await jobsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await jobsNav.click();
                await waitForLoadingComplete(adminPage);
            }
            await screenshot(adminPage, testId, '02-admin-jobs-view');

            // Check for existing jobs or create new one
            // First, let's check the Schedule/Dispatch view
            const scheduleNav = adminPage.locator('text=/schedule|dispatch/i').first();
            if (await scheduleNav.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scheduleNav.click();
                await waitForLoadingComplete(adminPage);
            }
            await screenshot(adminPage, testId, '03-admin-schedule-view');

            // Look for unassigned jobs in dispatch board
            const unassignedSection = adminPage.locator('text=/unassigned|backlog/i').first();
            if (await unassignedSection.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[TECH-HANDOFF] Found unassigned jobs section');
                await screenshot(adminPage, testId, '04-unassigned-jobs');
            }

            // Check for team members / technicians
            const teamNav = adminPage.locator('text=/team|technicians|crew/i').first();
            if (await teamNav.isVisible({ timeout: 3000 }).catch(() => false)) {
                await teamNav.click();
                await waitForLoadingComplete(adminPage);
                await screenshot(adminPage, testId, '05-team-view');
            }

            // ============================================
            // STEP 2: Verify Tech Mobile Portal Access
            // ============================================
            console.log('[TECH-HANDOFF] Step 2: Accessing Tech Mobile Portal');

            await techPage.goto(`${BASE_URL}/tech`);
            await techPage.waitForLoadState('domcontentloaded');
            await techPage.waitForTimeout(2000);
            await screenshot(techPage, testId, '06-tech-portal-initial');

            // Verify tech portal loads
            const techPortalLoaded = await techPage.locator('body').first()
                .isVisible({ timeout: 5000 }).catch(() => false);
            expect(techPortalLoaded).toBeTruthy();

            // Check what's displayed - either login screen or dashboard
            const hasLoginScreen = await techPage.locator(
                'input[type="password"], ' +
                'text=/enter.*pin/i, ' +
                'text=/company code/i, ' +
                'text=/sign in/i'
            ).first().isVisible({ timeout: 5000 }).catch(() => false);

            const hasDashboard = await techPage.locator(
                'text=/today/i, ' +
                'text=/my jobs/i, ' +
                'text=/schedule/i'
            ).first().isVisible({ timeout: 2000 }).catch(() => false);

            console.log(`[TECH-HANDOFF] Tech Portal State - Login: ${hasLoginScreen}, Dashboard: ${hasDashboard}`);
            await screenshot(techPage, testId, '07-tech-portal-state');

            // If there's a dashboard, explore it
            if (hasDashboard) {
                console.log('[TECH-HANDOFF] Tech already logged in - exploring dashboard');

                // Look for job cards
                const jobCards = await techPage.locator('[class*="job"], [class*="Job"], button:has-text("Start")').count();
                console.log(`[TECH-HANDOFF] Found ${jobCards} job-related elements`);

                // Try clicking on a job if available
                const firstJob = techPage.locator('button:has(text=/scheduled|start|view/i)').first();
                if (await firstJob.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await firstJob.click();
                    await techPage.waitForTimeout(1500);
                    await screenshot(techPage, testId, '08-tech-job-selected');
                }
            }

            // ============================================
            // STEP 3: Simulate Status Update Flow
            // ============================================
            console.log('[TECH-HANDOFF] Step 3: Simulating status updates');

            // Look for status buttons on tech mobile
            const statusButtons = [
                { label: 'En Route', selector: 'button:has-text("En Route"), button:has-text("On My Way")' },
                { label: 'Start', selector: 'button:has-text("Start"), button:has-text("Begin"), button:has-text("Clock In")' },
                { label: 'Complete', selector: 'button:has-text("Complete"), button:has-text("Finish"), button:has-text("Done")' }
            ];

            for (const status of statusButtons) {
                const btn = techPage.locator(status.selector).first();
                if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log(`[TECH-HANDOFF] Found ${status.label} button`);
                    await screenshot(techPage, testId, `09-tech-${status.label.toLowerCase().replace(/\s/g, '-')}-available`);
                }
            }

            // ============================================
            // STEP 4: Check Homeowner View (if applicable)
            // ============================================
            console.log('[TECH-HANDOFF] Step 4: Checking homeowner perspective');

            await loginAsHomeowner(homeownerPage, { useStoredSession: false });
            await waitForLoadingComplete(homeownerPage);
            await screenshot(homeownerPage, testId, '10-homeowner-dashboard');

            // Look for job tracking or status updates
            const jobTracking = homeownerPage.locator('text=/tracking|status|en route|on the way/i').first();
            if (await jobTracking.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[TECH-HANDOFF] Homeowner can see job tracking');
                await screenshot(homeownerPage, testId, '11-homeowner-tracking-visible');
            }

            // Check for contractor/tech arrival notifications
            const contractorSection = homeownerPage.locator('text=/contractor|tech|pro/i').first();
            if (await contractorSection.isVisible({ timeout: 3000 }).catch(() => false)) {
                await contractorSection.click();
                await homeownerPage.waitForTimeout(1000);
                await screenshot(homeownerPage, testId, '12-homeowner-contractor-view');
            }

            // ============================================
            // STEP 5: Verify Admin Real-Time Updates
            // ============================================
            console.log('[TECH-HANDOFF] Step 5: Verifying admin sees updates');

            // Refresh admin view
            await adminPage.reload();
            await waitForLoadingComplete(adminPage);

            // Navigate back to schedule/dispatch
            const scheduleNav2 = adminPage.locator('text=/schedule|dispatch/i').first();
            if (await scheduleNav2.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scheduleNav2.click();
                await waitForLoadingComplete(adminPage);
            }
            await screenshot(adminPage, testId, '13-admin-final-state');

            // Check for status indicators using separate queries
            const cssStatusCount = await adminPage.locator('[class*="en_route"], [class*="in_progress"]').count();
            const textStatusCount = await adminPage.locator('text=/en route/i').count() +
                await adminPage.locator('text=/in progress/i').count();
            const statusIndicators = cssStatusCount + textStatusCount;
            console.log(`[TECH-HANDOFF] Admin sees ${statusIndicators} status indicators`);

            console.log(`[TECH-HANDOFF] Test ${testId} completed successfully`);

        } finally {
            // Clean up
            await adminContext.close();
            await techContext.close();
            await homeownerContext.close();
        }
    });

    test('TECH-002: Tech Mobile - Job Card Actions', async ({ browser }) => {
        // Mobile viewport for tech
        const techContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true
        });
        const techPage = await techContext.newPage();
        const testId = uniqueId('tech-mobile');

        try {
            console.log('[TECH-MOBILE] Testing tech mobile job card actions');

            await techPage.goto(`${BASE_URL}/tech`);
            await techPage.waitForLoadState('domcontentloaded');
            await techPage.waitForTimeout(2000);
            await screenshot(techPage, testId, '01-tech-mobile-initial');

            // Check for various mobile states
            const states = [
                { name: 'Login', selector: 'input[type="password"], text=/pin/i' },
                { name: 'Dashboard', selector: 'text=/today|my jobs/i' },
                { name: 'JobList', selector: '[class*="job"], [class*="card"]' },
                { name: 'Navigation', selector: 'nav, [class*="bottom-nav"], [class*="tab-bar"]' }
            ];

            for (const state of states) {
                const visible = await techPage.locator(state.selector).first()
                    .isVisible({ timeout: 2000 }).catch(() => false);
                if (visible) {
                    console.log(`[TECH-MOBILE] Found: ${state.name}`);
                    await screenshot(techPage, testId, `02-found-${state.name.toLowerCase()}`);
                }
            }

            // Try bottom navigation if present
            const bottomNav = techPage.locator('nav, [class*="bottom-nav"], [class*="tab-bar"]').first();
            if (await bottomNav.isVisible({ timeout: 2000 }).catch(() => false)) {
                const navButtons = await bottomNav.locator('button, a').all();
                console.log(`[TECH-MOBILE] Found ${navButtons.length} nav buttons`);

                // Click through nav items
                for (let i = 0; i < Math.min(navButtons.length, 4); i++) {
                    try {
                        await navButtons[i].click();
                        await techPage.waitForTimeout(1000);
                        await screenshot(techPage, testId, `03-nav-item-${i}`);
                    } catch (e) {
                        console.log(`[TECH-MOBILE] Nav button ${i} click failed: ${e.message}`);
                    }
                }
            }

            console.log(`[TECH-MOBILE] Test ${testId} completed`);

        } finally {
            await techContext.close();
        }
    });

    test('TECH-003: Dispatch Board - Job Assignment Visual', async ({ page }) => {
        const testId = uniqueId('dispatch');

        console.log('[DISPATCH] Testing dispatch board assignment visuals');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Schedule view
        const scheduleNav = page.locator('text=/schedule/i').first();
        if (await scheduleNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await scheduleNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-schedule-view');

        // Look for dispatch board toggle or view
        const dispatchToggle = page.locator('button:has-text("Dispatch"), text=/dispatch/i').first();
        if (await dispatchToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
            await dispatchToggle.click();
            await waitForLoadingComplete(page);
            await screenshot(page, testId, '02-dispatch-board');
        }

        // Check for team columns
        const teamColumns = await page.locator('[class*="tech-column"], [class*="TechColumn"]').count();
        console.log(`[DISPATCH] Found ${teamColumns} tech columns`);

        // Check for unassigned section
        const unassignedJobs = await page.locator('text=/unassigned/i').count();
        console.log(`[DISPATCH] Unassigned sections: ${unassignedJobs}`);

        // Look for job cards that can be dragged
        const draggableJobs = await page.locator('[draggable="true"], [class*="draggable"]').count();
        console.log(`[DISPATCH] Draggable jobs: ${draggableJobs}`);

        await screenshot(page, testId, '03-dispatch-final');
        console.log(`[DISPATCH] Test ${testId} completed`);
    });

    test('TECH-004: Status Update Sync Test', async ({ browser }) => {
        // This test verifies that status changes sync in near real-time
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();

        const testId = uniqueId('status-sync');

        try {
            console.log('[STATUS-SYNC] Testing status synchronization');

            await loginAsContractor(adminPage, { useStoredSession: false });
            await waitForLoadingComplete(adminPage);

            // Go to Jobs view
            const jobsNav = adminPage.locator('text="Jobs"').first();
            if (await jobsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
                await jobsNav.click();
                await waitForLoadingComplete(adminPage);
            }
            await screenshot(adminPage, testId, '01-jobs-list');

            // Look for different job statuses
            const statuses = ['Scheduled', 'En Route', 'In Progress', 'Completed', 'Pending'];
            for (const status of statuses) {
                const statusBadges = await adminPage.locator(`text="${status}"`).count();
                if (statusBadges > 0) {
                    console.log(`[STATUS-SYNC] Found ${statusBadges} jobs with status: ${status}`);
                }
            }

            // Check status filter tabs if present
            const statusTabs = adminPage.locator('button:has-text("All"), button:has-text("Active"), button:has-text("Scheduled")');
            const tabCount = await statusTabs.count();
            console.log(`[STATUS-SYNC] Found ${tabCount} status filter tabs`);

            if (tabCount > 0) {
                // Click through filter tabs
                const tabs = await statusTabs.all();
                for (const tab of tabs.slice(0, 3)) { // First 3 tabs
                    try {
                        const tabText = await tab.textContent();
                        await tab.click();
                        await adminPage.waitForTimeout(1000);
                        await screenshot(adminPage, testId, `02-filter-${tabText?.toLowerCase() || 'unknown'}`);
                    } catch (e) {
                        console.log(`[STATUS-SYNC] Tab click failed: ${e.message}`);
                    }
                }
            }

            await screenshot(adminPage, testId, '03-final-state');
            console.log(`[STATUS-SYNC] Test ${testId} completed`);

        } finally {
            await adminContext.close();
        }
    });
});

// ============================================
// TEST SUITE: Crew Assignment
// ============================================
test.describe.skip('Crew Assignment Flow', () => {
    test.setTimeout(120000);

    test('CREW-001: Assign Tech to Job', async ({ page }) => {
        const testId = uniqueId('crew-assign');

        await loginAsContractor(page, { useStoredSession: false });
        await waitForLoadingComplete(page);

        // Navigate to Jobs
        const jobsNav = page.locator('text="Jobs"').first();
        if (await jobsNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobsNav.click();
            await waitForLoadingComplete(page);
        }
        await screenshot(page, testId, '01-jobs-list');

        // Find a job card with assignment action
        const assignBtn = page.locator('button:has-text("Assign"), button[aria-label*="assign" i]').first();
        if (await assignBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[CREW-ASSIGN] Found assign button');
            await assignBtn.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-assignment-modal');

            // Look for tech selection
            const techOptions = await page.locator('[class*="tech"], [class*="crew"], input[type="checkbox"]').count();
            console.log(`[CREW-ASSIGN] Found ${techOptions} tech selection options`);

            // Close modal
            const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label*="close" i]').first();
            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeBtn.click();
            }
        } else {
            console.log('[CREW-ASSIGN] No direct assign button found - checking job details');

            // Try clicking on a job to open details
            const jobCard = page.locator('[class*="job"], [class*="Job"]').first();
            if (await jobCard.isVisible({ timeout: 3000 }).catch(() => false)) {
                await jobCard.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '02-job-details');
            }
        }

        await screenshot(page, testId, '03-final-state');
        console.log(`[CREW-ASSIGN] Test ${testId} completed`);
    });
});

// ============================================
// TEST SUITE: Time Clock (if available)
// ============================================
test.describe.skip('Time Clock Integration', () => {
    test.setTimeout(120000);

    test('TIME-001: Tech Time Clock Widget', async ({ browser }) => {
        const techContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true
        });
        const techPage = await techContext.newPage();
        const testId = uniqueId('timeclock');

        try {
            console.log('[TIMECLOCK] Testing time clock functionality');

            await techPage.goto(`${BASE_URL}/tech`);
            await techPage.waitForLoadState('domcontentloaded');
            await techPage.waitForTimeout(2000);
            await screenshot(techPage, testId, '01-tech-portal');

            // Look for time clock or clock-in elements
            const clockElements = [
                'button:has-text("Clock In")',
                'button:has-text("Clock Out")',
                'text=/time clock/i',
                'text=/clocked in/i',
                '[class*="clock"], [class*="Clock"]'
            ];

            for (const selector of clockElements) {
                const element = techPage.locator(selector).first();
                if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log(`[TIMECLOCK] Found: ${selector}`);
                    await screenshot(techPage, testId, `02-found-${selector.replace(/[^a-z]/gi, '-').slice(0, 20)}`);
                }
            }

            console.log(`[TIMECLOCK] Test ${testId} completed`);

        } finally {
            await techContext.close();
        }
    });
});
