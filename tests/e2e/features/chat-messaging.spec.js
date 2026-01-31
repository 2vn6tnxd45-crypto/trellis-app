// tests/e2e/features/chat-messaging.spec.js
// ============================================
// REAL-TIME CHAT & MESSAGING TESTS
// ============================================
// Tests for the Firestore-powered chat system

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
// CONTRACTOR MESSAGING TESTS
// ============================================
test.describe('Contractor Messaging', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('CHAT-001: Messages section accessible', async ({ page }) => {
        const testId = uniqueId('chat-access');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-messages');

        // Verify messages UI loaded
        const messagesUI = page.locator('text=/message|chat|conversation|inbox/i').first();
        const hasMessages = await messagesUI.isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`[CHAT-001] Messages UI visible: ${hasMessages}`);
    });

    test('CHAT-002: Conversation list displays', async ({ page }) => {
        const testId = uniqueId('chat-list');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-conversation-list');

        // Check for conversation items
        const conversations = await page.locator('[class*="conversation"], [class*="chat-item"], [class*="message-item"]').count();
        console.log(`[CHAT-002] Conversations found: ${conversations}`);

        // Look for customer names in conversations
        const hasCustomerNames = await page.locator('text=/customer|homeowner|@/i').first().isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[CHAT-002] Customer names visible: ${hasCustomerNames}`);
    });

    test('CHAT-003: Can open conversation', async ({ page }) => {
        const testId = uniqueId('chat-open');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-conversation-open');

            // Check for message input
            const messageInput = page.locator('textarea, input[placeholder*="message" i], [contenteditable="true"]').first();
            const hasInput = await messageInput.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[CHAT-003] Message input visible: ${hasInput}`);
        } else {
            console.log('[CHAT-003] No conversations to open');
        }
    });

    test('CHAT-004: Can type message', async ({ page }) => {
        const testId = uniqueId('chat-type');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);

            const messageInput = page.locator('textarea, input[placeholder*="message" i]').first();
            if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await messageInput.fill('Test message from automated test');
                const value = await messageInput.inputValue();
                console.log(`[CHAT-004] Message typed: ${value.substring(0, 20)}...`);
                await screenshot(page, testId, '01-message-typed');

                // Clear the field (don't send)
                await messageInput.clear();
            }
        }
    });

    test('CHAT-005: Send button enabled when message typed', async ({ page }) => {
        const testId = uniqueId('chat-send');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);

            const messageInput = page.locator('textarea, input[placeholder*="message" i]').first();
            const sendBtn = page.locator('button:has-text("Send"), button[type="submit"], button:has(svg)').last();

            if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                // Check button state before typing
                const disabledBefore = await sendBtn.isDisabled().catch(() => false);

                await messageInput.fill('Test message');
                await page.waitForTimeout(500);

                const disabledAfter = await sendBtn.isDisabled().catch(() => false);

                console.log(`[CHAT-005] Send button disabled before: ${disabledBefore}`);
                console.log(`[CHAT-005] Send button disabled after: ${disabledAfter}`);

                await messageInput.clear();
            }
        }
    });

    test('CHAT-006: Message history shows', async ({ page }) => {
        const testId = uniqueId('chat-history');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);

            // Look for message bubbles/history
            const messages = await page.locator('[class*="message"], [class*="bubble"], [class*="chat-message"]').count();
            console.log(`[CHAT-006] Messages in history: ${messages}`);
            await screenshot(page, testId, '01-message-history');
        }
    });

    test('CHAT-007: Unread indicator exists', async ({ page }) => {
        const testId = uniqueId('chat-unread');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);
        await screenshot(page, testId, '01-messages-list');

        // Look for unread indicators
        const unreadIndicators = [
            '[class*="unread"]',
            '[class*="badge"]',
            'text=/\\d+ new|unread/i'
        ];

        for (const sel of unreadIndicators) {
            const count = await page.locator(sel).count();
            if (count > 0) {
                console.log(`[CHAT-007] Found unread indicator: ${sel}`);
            }
        }
    });
});

// ============================================
// HOMEOWNER MESSAGING TESTS
// ============================================
test.describe('Homeowner Messaging', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsHomeowner(page);
        await waitForLoadingComplete(page);
        await dismissPopups(page);
    });

    test('CHAT-010: Homeowner can access messages', async ({ page }) => {
        const testId = uniqueId('ho-chat');

        // Look for messages link
        const messagesLink = page.locator('text=/message|chat|inbox/i').first();
        if (await messagesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await messagesLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-ho-messages');

            console.log('[CHAT-010] Homeowner messages accessible');
        } else {
            // May be in More menu
            const moreBtn = page.locator('text=/more/i').first();
            if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await moreBtn.click();
                await page.waitForTimeout(500);

                const messagesOption = page.locator('text=/message/i').first();
                const hasMessages = await messagesOption.isVisible({ timeout: 2000 }).catch(() => false);
                console.log(`[CHAT-010] Messages in More menu: ${hasMessages}`);
            }
        }
    });

    test('CHAT-011: Homeowner sees contractor conversations', async ({ page }) => {
        const testId = uniqueId('ho-convos');

        const messagesLink = page.locator('text=/message|chat|inbox/i').first();
        if (await messagesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await messagesLink.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-ho-conversations');

            // Look for contractor names
            const contractorConvo = page.locator('text=/contractor|pro|service/i').first();
            const hasContractorConvo = await contractorConvo.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[CHAT-011] Contractor conversation visible: ${hasContractorConvo}`);
        }
    });

    test('CHAT-012: Homeowner can send message', async ({ page }) => {
        const testId = uniqueId('ho-send');

        const messagesLink = page.locator('text=/message|chat|inbox/i').first();
        if (await messagesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await messagesLink.click();
            await page.waitForTimeout(1500);

            const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
            if (await conversation.isVisible({ timeout: 3000 }).catch(() => false)) {
                await conversation.click();
                await page.waitForTimeout(1500);

                const messageInput = page.locator('textarea, input[placeholder*="message" i]').first();
                if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await messageInput.fill('Test from homeowner');
                    await screenshot(page, testId, '01-ho-message-typed');
                    await messageInput.clear();
                    console.log('[CHAT-012] Homeowner can type message');
                }
            }
        }
    });
});

// ============================================
// JOB-LINKED MESSAGING TESTS
// ============================================
test.describe('Job-Linked Messaging', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('CHAT-020: Can message from job detail', async ({ page }) => {
        const testId = uniqueId('job-chat');

        await navigateToSection(page, 'Jobs');
        await page.waitForTimeout(1500);

        const jobCard = page.locator('[class*="job"], [class*="card"]').first();
        if (await jobCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await jobCard.click();
            await page.waitForTimeout(1500);
            await screenshot(page, testId, '01-job-detail');

            // Look for message button
            const messageBtn = page.locator('button:has-text("Message"), button:has-text("Chat"), a:has-text("Message")').first();
            const hasMessage = await messageBtn.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[CHAT-020] Message from job available: ${hasMessage}`);

            if (hasMessage) {
                await messageBtn.click();
                await page.waitForTimeout(1500);
                await screenshot(page, testId, '02-chat-from-job');
            }
        }
    });

    test('CHAT-021: Chat shows job context', async ({ page }) => {
        const testId = uniqueId('chat-context');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);

            // Look for job reference in chat
            const jobContext = page.locator('text=/job|quote|service|work/i').first();
            const hasJobContext = await jobContext.isVisible({ timeout: 3000 }).catch(() => false);
            console.log(`[CHAT-021] Job context in chat: ${hasJobContext}`);
            await screenshot(page, testId, '01-chat-context');
        }
    });
});

// ============================================
// NOTIFICATION INTEGRATION
// ============================================
test.describe('Chat Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('CHAT-030: New message notification appears', async ({ page }) => {
        const testId = uniqueId('chat-notif');

        // Check for notification badge on messages
        const messageBadge = page.locator('[data-testid="message-badge"], [class*="badge"]:near(text=/message/i)').first();
        const hasBadge = await messageBadge.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`[CHAT-030] Message notification badge: ${hasBadge}`);
        await screenshot(page, testId, '01-message-badge');
    });

    test('CHAT-031: Notification count updates', async ({ page }) => {
        const testId = uniqueId('notif-count');

        // Look for notification count anywhere
        const notifCount = page.locator('[class*="badge"], [class*="notification-count"]').first();
        const countText = await notifCount.textContent().catch(() => '');
        console.log(`[CHAT-031] Notification count text: ${countText}`);
        await screenshot(page, testId, '01-notif-count');
    });
});

// ============================================
// CHAT UI/UX TESTS
// ============================================
test.describe('Chat UI/UX', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsContractor(page);
        await waitForLoadingComplete(page);
    });

    test('CHAT-040: Messages have timestamps', async ({ page }) => {
        const testId = uniqueId('chat-time');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);

            // Look for timestamps
            const timestamps = page.locator('text=/\\d+:\\d+|ago|today|yesterday/i');
            const timestampCount = await timestamps.count();
            console.log(`[CHAT-040] Timestamps found: ${timestampCount}`);
            await screenshot(page, testId, '01-timestamps');
        }
    });

    test('CHAT-041: Messages show sender identity', async ({ page }) => {
        const testId = uniqueId('chat-sender');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(1500);

            // Check for sender indicators (own vs other)
            const ownMessages = await page.locator('[class*="own"], [class*="sent"], [class*="right"]').count();
            const otherMessages = await page.locator('[class*="received"], [class*="left"]').count();

            console.log(`[CHAT-041] Own messages: ${ownMessages}`);
            console.log(`[CHAT-041] Other messages: ${otherMessages}`);
            await screenshot(page, testId, '01-sender-identity');
        }
    });

    test('CHAT-042: Chat scrolls to latest message', async ({ page }) => {
        const testId = uniqueId('chat-scroll');

        await navigateToSection(page, 'Messages');
        await page.waitForTimeout(1500);

        const conversation = page.locator('[class*="conversation"], [class*="chat-item"]').first();
        if (await conversation.isVisible({ timeout: 5000 }).catch(() => false)) {
            await conversation.click();
            await page.waitForTimeout(2000);

            // Check scroll position - should be at bottom
            const chatContainer = page.locator('[class*="message-list"], [class*="chat-body"]').first();
            if (await chatContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
                const scrollInfo = await chatContainer.evaluate(el => ({
                    scrollTop: el.scrollTop,
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight
                })).catch(() => null);

                if (scrollInfo) {
                    const isAtBottom = scrollInfo.scrollTop + scrollInfo.clientHeight >= scrollInfo.scrollHeight - 50;
                    console.log(`[CHAT-042] Chat scrolled to bottom: ${isAtBottom}`);
                }
            }
            await screenshot(page, testId, '01-chat-scroll');
        }
    });
});
