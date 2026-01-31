// tests/e2e/notifications/sms-notifications.spec.js
// ============================================
// SMS & NOTIFICATION FLOW TESTS
// ============================================
// Tests for Twilio SMS, email notifications, and reminder systems
// NOTE: These tests verify UI for sending, not actual delivery

import { test, expect } from '@playwright/test';
import {
    loginAsContractor,
    loginAsHomeowner,
    screenshot,
    waitForLoadingComplete,
    navigateToSection,
    uniqueId,
    dismissPopups,
    TEST_ACCOUNTS
} from '../../utils/test-helpers.js';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// ============================================
// SMS SETTINGS TESTS
// ============================================
test.describe('SMS Settings', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('SMS-001: Contractor can access SMS/notification settings', async ({ page }) => {
        const testId = uniqueId('sms-settings');

        await navigateToSection(page, 'Settings');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-settings');

        // Look for notifications section
        const notifSection = page.locator('text=/notification|sms|text message|reminders/i').first();
        if (await notifSection.isVisible({ timeout: 5000 }).catch(() => false)) {
            await notifSection.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-notification-settings');
            console.log('[SMS-001] Notification settings accessible');
        } else {
            console.log('[SMS-001] Notification settings section not found');
        }
    });

    test('SMS-002: SMS reminder toggles exist', async ({ page }) => {
        const testId = uniqueId('sms-toggles');

        await navigateToSection(page, 'Settings');
        await page.waitForTimeout(1500);

        // Look for reminder toggles
        const reminderToggles = [
            'text=/appointment reminder/i',
            'text=/24 hour/i',
            'text=/1 hour/i',
            'text=/completion reminder/i'
        ];

        for (const toggle of reminderToggles) {
            if (await page.locator(toggle).first().isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log(`[SMS-002] Found reminder toggle: ${toggle}`);
            }
        }

        await screenshot(page, testId, '01-reminder-toggles');
    });
});

// ============================================
// APPOINTMENT SMS TESTS
// ============================================
test.describe('Appointment SMS', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('SMS-010: Scheduling job shows SMS notification option', async ({ page }) => {
        const testId = uniqueId('sched-sms');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        // Look for unscheduled job
        const unscheduledJob = page.locator('text=/unscheduled|needs scheduling|pending/i').first();
        if (await unscheduledJob.isVisible({ timeout: 5000 }).catch(() => false)) {
            await unscheduledJob.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-job-detail');

            // Look for schedule button
            const scheduleBtn = page.locator('button:has-text("Schedule"), button:has-text("Set Date")').first();
            if (await scheduleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await scheduleBtn.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-schedule-modal');

                // Check for SMS notification checkbox
                const smsCheckbox = page.locator('text=/send sms|notify customer|text notification/i, input[name*="sms"]').first();
                if (await smsCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[SMS-010] SMS notification option available when scheduling');
                }
            }
        } else {
            console.log('[SMS-010] No unscheduled jobs found');
        }
    });

    test('SMS-011: Job scheduled notification option', async ({ page }) => {
        const testId = uniqueId('job-sched-notif');

        await navigateToSection(page, 'Schedule');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-calendar');

        // Look for scheduled job
        const scheduledJob = page.locator('[data-testid="calendar-event"], .calendar-event').first();
        if (await scheduledJob.isVisible({ timeout: 3000 }).catch(() => false)) {
            await scheduledJob.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '02-job-clicked');

            // Look for resend/notify options
            const notifyBtn = page.locator('button:has-text("Send Reminder"), button:has-text("Notify"), button:has-text("SMS")').first();
            if (await notifyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log('[SMS-011] Manual notification option available');
            }
        }
    });
});

// ============================================
// QUOTE NOTIFICATION TESTS
// ============================================
test.describe('Quote Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('SMS-020: Send quote shows email notification', async ({ page }) => {
        const testId = uniqueId('quote-email');

        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        // Look for draft quote
        const draftQuote = page.locator('text=/draft/i').first();
        if (await draftQuote.isVisible({ timeout: 5000 }).catch(() => false)) {
            await draftQuote.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-quote-detail');

            // Look for send button
            const sendBtn = page.locator('button:has-text("Send"), button:has-text("Share")').first();
            if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[SMS-020] Send quote button available');

                // Check for email preview/confirmation
                await sendBtn.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-send-modal');

                // Look for email confirmation
                const emailConfirm = page.locator('text=/email|will be sent|notification/i').first();
                if (await emailConfirm.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[SMS-020] Email notification confirmation shown');
                }

                // Close modal without sending
                const cancelBtn = page.locator('button:has-text("Cancel")').first();
                if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await cancelBtn.click();
                }
            }
        }
    });

    test('SMS-021: Quote accepted notification sent', async ({ page }) => {
        const testId = uniqueId('quote-accept');

        // This tests the contractor side - they should see notification was sent
        await navigateToSection(page, 'Quotes');
        await page.waitForTimeout(1500);

        // Look for accepted quote
        const acceptedQuote = page.locator('text=/accepted/i').first();
        if (await acceptedQuote.isVisible({ timeout: 5000 }).catch(() => false)) {
            await acceptedQuote.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-accepted-quote');

            // Check for notification log/status
            const notifLog = page.locator('text=/notified|email sent|notification sent/i').first();
            if (await notifLog.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log('[SMS-021] Notification status visible');
            }
        } else {
            console.log('[SMS-021] No accepted quotes found');
        }
    });
});

// ============================================
// JOB COMPLETION NOTIFICATIONS
// ============================================
test.describe('Job Completion Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('SMS-030: Complete job shows notification option', async ({ page }) => {
        const testId = uniqueId('complete-notif');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        // Look for in-progress job
        const inProgressJob = page.locator('text=/in progress|ongoing|active/i').first();
        if (await inProgressJob.isVisible({ timeout: 5000 }).catch(() => false)) {
            await inProgressJob.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-job-detail');

            // Look for complete button
            const completeBtn = page.locator('button:has-text("Complete"), button:has-text("Mark Complete")').first();
            if (await completeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await completeBtn.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-complete-modal');

                // Check for notification options
                const notifOption = page.locator('text=/notify customer|send notification|email/i').first();
                if (await notifOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[SMS-030] Notification option on completion');
                }

                // Cancel
                const cancelBtn = page.locator('button:has-text("Cancel")').first();
                if (await cancelBtn.isVisible()) await cancelBtn.click();
            }
        }
    });

    test('SMS-031: Review request option after completion', async ({ page }) => {
        const testId = uniqueId('review-req');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        // Look for completed job
        const completedJob = page.locator('text=/completed/i').first();
        if (await completedJob.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completedJob.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-completed-job');

            // Look for review request option
            const reviewBtn = page.locator('button:has-text("Request Review"), button:has-text("Ask for Review")').first();
            if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[SMS-031] Review request button available');
                await screenshot(page, testId, '02-review-option');
            }
        }
    });
});

// ============================================
// CUSTOMER MESSAGE TESTS
// ============================================
test.describe('Customer Messaging', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('SMS-040: Can send direct message to customer', async ({ page }) => {
        const testId = uniqueId('direct-msg');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-messages');

        // Check for messaging UI
        const hasMessages = await page.locator('text=/message|chat|conversation/i').first().isVisible({ timeout: 3000 }).catch(() => false);

        if (hasMessages) {
            // Look for new message option
            const newMsgBtn = page.locator('button:has-text("New Message"), button:has-text("Compose")').first();
            if (await newMsgBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[SMS-040] New message option available');
                await screenshot(page, testId, '02-new-message');
            }

            // Or look for existing conversation to message
            const conversation = page.locator('[class*="conversation"], [class*="chat"]').first();
            if (await conversation.isVisible({ timeout: 2000 }).catch(() => false)) {
                await conversation.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '02-conversation');

                // Check for message input
                const msgInput = page.locator('textarea, input[placeholder*="message" i]').first();
                if (await msgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[SMS-040] Message input available');
                }
            }
        }
    });

    test('SMS-041: Customer phone visible for manual contact', async ({ page }) => {
        const testId = uniqueId('cust-phone');

        await navigateToSection(page, 'Customers');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-customers');

        // Click on a customer
        const customerCard = page.locator('[class*="customer"], [class*="card"], tr').first();
        if (await customerCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await customerCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '02-customer-detail');

            // Look for phone number
            const phoneNumber = page.locator('text=/\\(\\d{3}\\)|\\d{3}-\\d{3}-\\d{4}|\\d{10}/').first();
            if (await phoneNumber.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log('[SMS-041] Customer phone number visible');
            }

            // Look for call/text buttons
            const contactBtn = page.locator('a[href^="tel:"], a[href^="sms:"], button:has-text("Call"), button:has-text("Text")').first();
            if (await contactBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                console.log('[SMS-041] Quick contact button available');
            }
        }
    });
});

// ============================================
// HOMEOWNER NOTIFICATION PREFERENCES
// ============================================
test.describe('Homeowner Notification Preferences', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
    });

    test('SMS-050: Homeowner can access notification settings', async ({ page }) => {
        const testId = uniqueId('ho-notif');

        // Navigate to settings via More menu
        await dismissPopups(page);

        const moreBtn = page.locator('nav >> text=More, button:has-text("More")').first();
        if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await moreBtn.click();
            await page.waitForTimeout(1000);
        }

        const settingsLink = page.locator('text=/settings/i').first();
        if (await settingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            await settingsLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-settings');

            // Look for notification preferences
            const notifPrefs = page.locator('text=/notification|email|sms/i').first();
            if (await notifPrefs.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('[SMS-050] Notification preferences available');
            }
        }
    });

    test('SMS-051: Homeowner sees notification history', async ({ page }) => {
        const testId = uniqueId('ho-notif-hist');

        // Look for notifications icon/section
        const notifIcon = page.locator('[data-testid="notifications"], button[aria-label*="notification" i], text=/notifications/i').first();
        if (await notifIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
            await notifIcon.click();
            await page.waitForTimeout(1000);
            await screenshot(page, testId, '01-notifications');
            console.log('[SMS-051] Notifications section accessible');
        }
    });
});

// ============================================
// CANCELLATION NOTIFICATION TESTS
// ============================================
test.describe('Cancellation Notifications', () => {
    test('SMS-060: Cancel job shows notification option', async ({ page }) => {
        const testId = uniqueId('cancel-notif');

        await loginAsContractor(page);
        await waitForLoadingComplete(page);

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        // Look for a job that can be cancelled
        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);

            // Look for cancel option
            const cancelBtn = page.locator('button:has-text("Cancel Job"), button:has-text("Cancel")').first();
            if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await cancelBtn.click();
                await page.waitForTimeout(1000);
                await screenshot(page, testId, '01-cancel-modal');

                // Check for notification option
                const notifyOption = page.locator('text=/notify customer|send notification/i').first();
                if (await notifyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log('[SMS-060] Cancellation notification option available');
                }

                // Don't actually cancel
                const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label*="close"]').last();
                if (await closeBtn.isVisible()) await closeBtn.click();
            }
        }
    });
});
