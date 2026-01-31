// tests/helpers/auth-helpers.js
// ============================================
// AUTHENTICATION HELPER FUNCTIONS
// ============================================

import { TEST_USERS } from '../fixtures/test-users.js';

/**
 * Wait for page to be fully loaded
 */
export async function waitForAppLoad(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/**
 * Login as a homeowner
 * @param {Page} page - Playwright page object
 * @param {Object} account - User account (defaults to homeownerFull)
 */
export async function loginAsHomeowner(page, account = TEST_USERS.homeownerFull) {
  await page.goto('/home');
  await waitForAppLoad(page);

  // Check if already logged in
  const alreadyLoggedIn = await page.locator('text=/dashboard|my home|inventory|records/i').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  // Find and click sign in
  const signInButton = page.locator('text=/sign in|log in/i').first();
  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();
    await page.waitForTimeout(500);
  }

  // Fill credentials
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await waitForAppLoad(page);
  await page.waitForTimeout(1000);
}

/**
 * Login as a contractor
 * @param {Page} page - Playwright page object
 * @param {Object} account - User account (defaults to contractorFull)
 */
export async function loginAsContractor(page, account = TEST_USERS.contractorFull) {
  await page.goto('/home?pro');
  await waitForAppLoad(page);

  // Check if already logged in
  const alreadyLoggedIn = await page.locator('text=/dashboard|jobs|quotes|customers|schedule/i').first().isVisible().catch(() => false);
  if (alreadyLoggedIn) return;

  // Find login button
  const authButton = page.locator('text=/sign in|log in|get started|start free/i').first();
  if (await authButton.isVisible().catch(() => false)) {
    await authButton.click();
    await page.waitForTimeout(500);
  }

  // Fill credentials
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await waitForAppLoad(page);
  await page.waitForTimeout(1000);
}

/**
 * Logout current user
 * @param {Page} page - Playwright page object
 */
export async function logout(page) {
  // Try to find logout in various locations
  const menuTriggers = [
    '[data-testid="more-menu"]',
    'text=More',
    'text=Settings',
    '[aria-label*="menu"]'
  ];

  for (const trigger of menuTriggers) {
    const el = page.locator(trigger).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.waitForTimeout(500);
      break;
    }
  }

  // Click logout
  const logoutButton = page.locator('text=/log out|sign out|logout/i').first();
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    await waitForAppLoad(page);
  }
}

export default {
  waitForAppLoad,
  loginAsHomeowner,
  loginAsContractor,
  logout
};
