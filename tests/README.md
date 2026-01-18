# Testing Guide for Krib App

## Overview

This test suite uses Playwright for E2E and visual regression testing. Tests are organized into:

- **E2E Tests** (`tests/e2e/`) - User journey and flow testing
- **Visual Tests** (`tests/visual/`) - Screenshot comparison testing
- **Fixtures** (`tests/fixtures/`) - Shared test data and helpers

## Quick Start

```bash
# Install Playwright and browsers
npm run test:install

# Run all tests
npm run test

# Run with UI (interactive mode)
npm run test:ui
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all Playwright tests |
| `npm run test:e2e` | Run E2E tests only |
| `npm run test:auth` | Run authentication tests |
| `npm run test:flows` | Run core flow tests |
| `npm run test:visual` | Run visual regression tests |
| `npm run test:ui` | Open Playwright UI mode |
| `npm run test:debug` | Run tests with debugger |
| `npm run test:report` | View HTML test report |
| `npm run visual:update` | Update visual baselines |
| `npm run visual:capture` | Capture new visual baselines |
| `npm run test:install` | Install Playwright browsers |

## Test Structure

```
tests/
├── e2e/
│   ├── auth.spec.js         # Authentication tests
│   └── core-flows.spec.js   # Main user journey tests
├── visual/
│   ├── visual-regression.config.js   # Visual test config
│   ├── visual-regression.spec.js     # Visual tests
│   └── visual-regression.spec.js-snapshots/  # Baseline images
├── fixtures/
│   └── test-data.js         # Test users, data, selectors
└── README.md                # This file
```

## Test Users

Located in `tests/fixtures/test-data.js`:

| User | Email | Password | Purpose |
|------|-------|----------|---------|
| New Homeowner | test.homeowner.new@krib.test | TestPass123! | Fresh account testing |
| Full Homeowner | test.homeowner.full@krib.test | TestPass123! | Established account testing |
| New Contractor | test.contractor.new@krib.test | TestPass123! | Fresh contractor testing |
| Full Contractor | test.contractor.full@krib.test | TestPass123! | Established contractor testing |

**Setup test accounts:**
```bash
node scripts/createTestAccounts.js
```

## E2E Tests

### Authentication (`auth.spec.js`)

Tests covered:
- Email signup (success + validation)
- Email login (success + failure)
- Google OAuth button presence
- Password reset flow
- Rate limiting (5 attempts → lockout)
- Session persistence
- Password validation rules

### Core Flows (`core-flows.spec.js`)

Tests covered:
- Homeowner onboarding with property
- Manual record creation (HVAC, Plumbing)
- Contractor quote creation with line items
- Quote acceptance flow
- Job completion flow
- Data import to house records

## Visual Regression Tests

### How It Works

1. **Baseline Capture**: First run captures baseline screenshots
2. **Comparison**: Subsequent runs compare against baselines
3. **Diff Generation**: Differences are highlighted for review

### Running Visual Tests

```bash
# First time - capture baselines
npm run visual:update

# Subsequent runs - compare to baselines
npm run test:visual

# After intentional UI changes - update baselines
npm run visual:update
```

### Pages Tested

- Auth screens (login, signup, forgot password)
- Homeowner dashboard
- Property records list
- Smart scanner UI
- Contractor dashboard
- Quote builder
- Job calendar
- Settings page

### Viewports Tested

- **Desktop**: 1440x900
- **Tablet**: 768x1024
- **Mobile**: 375x812 (iPhone X)

### Handling Dynamic Content

Dynamic elements are masked during capture:
- Timestamps
- User avatars
- Current time displays

Configure masks in `visual-regression.config.js`.

## Writing New Tests

### E2E Test Template

```javascript
import { test, expect } from '@playwright/test';
import { TEST_USERS, SELECTORS } from '../fixtures/test-data.js';

test.describe('Feature Name', () => {
    test.beforeEach(async ({ page }) => {
        // Login or setup
        await page.goto('/');
        await page.fill(SELECTORS.emailInput, TEST_USERS.fullHomeowner.email);
        await page.fill(SELECTORS.passwordInput, TEST_USERS.fullHomeowner.password);
        await page.click(SELECTORS.submitButton);
        await expect(page).toHaveURL(/.*\/(home|app)/, { timeout: 15000 });
    });

    test('should do something', async ({ page }) => {
        // Test steps
        await page.click('text=Button');
        await expect(page.locator('text=Expected')).toBeVisible();
    });
});
```

### Visual Test Template

```javascript
import { test, expect } from '@playwright/test';

test('Page Name - Viewport', async ({ page }) => {
    await page.goto('/path');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('page-name-viewport.png', {
        maxDiffPixelRatio: 0.01,
    });
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests failing after UI changes

If tests fail because of intentional UI changes:
```bash
npm run visual:update
```

### Tests timing out

Increase timeout in `playwright.config.js`:
```javascript
timeout: 60 * 1000, // 60 seconds
```

### Can't find elements

Use Playwright's codegen to find selectors:
```bash
npx playwright codegen localhost:5173
```

### Flaky tests

Add retry in `playwright.config.js`:
```javascript
retries: process.env.CI ? 2 : 0,
```

## Best Practices

1. **Test isolation**: Each test should work independently
2. **Cleanup**: Tests should clean up any data they create
3. **Stability**: Wait for network idle before assertions
4. **Selectors**: Prefer data-testid or semantic selectors
5. **Assertions**: Use specific assertions over generic ones
