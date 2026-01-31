// tests/helpers/navigation-helpers.js
// ============================================
// NAVIGATION HELPER FUNCTIONS
// ============================================

/**
 * Navigate to a tab/section by trying multiple selectors
 * @param {Page} page - Playwright page object
 * @param {string[]} selectors - Array of possible selectors to try
 * @returns {boolean} - Whether navigation was successful
 */
export async function navigateToSection(page, selectors) {
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible().catch(() => false)) {
      await element.click();
      await page.waitForTimeout(1000);
      return true;
    }
  }
  return false;
}

/**
 * Navigate to Records/Inventory section
 */
export async function goToRecords(page) {
  return navigateToSection(page, [
    'text=Records',
    'text=Inventory',
    'text=Items',
    '[data-testid="records-tab"]',
    '[data-testid="nav-records"]'
  ]);
}

/**
 * Navigate to Quotes section (homeowner)
 */
export async function goToQuotes(page) {
  return navigateToSection(page, [
    'text=Quotes',
    'text=Estimates',
    'text=Projects',
    '[data-testid="quotes-tab"]'
  ]);
}

/**
 * Navigate to Contractors/Pros section
 */
export async function goToContractors(page) {
  return navigateToSection(page, [
    'text=Contractors',
    'text=Pros',
    'text=My Pros',
    '[data-testid="contractors-tab"]'
  ]);
}

/**
 * Navigate to Jobs section (contractor)
 */
export async function goToJobs(page) {
  return navigateToSection(page, [
    'text=Jobs',
    '[data-testid="jobs-tab"]',
    '[data-testid="nav-jobs"]'
  ]);
}

/**
 * Navigate to Calendar/Schedule section (contractor)
 */
export async function goToCalendar(page) {
  return navigateToSection(page, [
    'text=Schedule',
    'text=Calendar',
    '[data-testid="calendar-tab"]',
    '[data-testid="nav-calendar"]'
  ]);
}

/**
 * Navigate to Customers section (contractor)
 */
export async function goToCustomers(page) {
  return navigateToSection(page, [
    'text=Customers',
    'text=Clients',
    '[data-testid="customers-tab"]'
  ]);
}

/**
 * Navigate to Team section (contractor)
 */
export async function goToTeam(page) {
  return navigateToSection(page, [
    'text=Team',
    'text=Crew',
    '[data-testid="team-tab"]'
  ]);
}

/**
 * Navigate to Settings
 */
export async function goToSettings(page) {
  // First try direct access
  let found = await navigateToSection(page, [
    'text=Settings',
    '[data-testid="settings"]'
  ]);

  if (!found) {
    // Try through More menu
    const moreButton = page.locator('text=More').first();
    if (await moreButton.isVisible().catch(() => false)) {
      await moreButton.click();
      await page.waitForTimeout(500);
      found = await navigateToSection(page, ['text=Settings']);
    }
  }

  return found;
}

/**
 * Open the scanner/add record interface
 */
export async function openScanner(page) {
  const addSelectors = [
    'text=Scan',
    'text=Add',
    'button:has-text("+")',
    '[data-testid="add-record"]',
    '[data-testid="scan-button"]',
    '[aria-label="Add"]'
  ];

  for (const selector of addSelectors) {
    const addButton = page.locator(selector).first();
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1000);
      return true;
    }
  }

  return false;
}

/**
 * Close a modal or overlay
 */
export async function closeModal(page) {
  const closeSelectors = [
    'button:has-text("×")',
    '[aria-label="Close"]',
    'text=Close',
    'text=Cancel',
    'text=Back',
    '[data-testid="close-modal"]',
    '[data-testid="modal-close"]'
  ];

  for (const selector of closeSelectors) {
    const closeButton = page.locator(selector).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
      return true;
    }
  }

  // Try pressing Escape as fallback
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  return true;
}

export default {
  navigateToSection,
  goToRecords,
  goToQuotes,
  goToContractors,
  goToJobs,
  goToCalendar,
  goToCustomers,
  goToTeam,
  goToSettings,
  openScanner,
  closeModal
};
