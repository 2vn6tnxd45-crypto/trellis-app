// playwright.config.js
// ============================================
// KRIB PLAYWRIGHT CONFIGURATION
// ============================================

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Run tests in parallel (set to 1 if tests interfere)
  workers: 1,

  // Retry failed tests once
  retries: 1,

  // Maximum time per test (2 minutes)
  timeout: 120000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  // Global settings
  use: {
    // Base URL of your app
    baseURL: 'https://mykrib.app',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Trace on failure
    trace: 'retain-on-failure',

    // Browser viewport
    viewport: { width: 1280, height: 720 },

    // Action timeout
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
  },

  // Browser projects
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for additional browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 13'] },
    // },
  ],

  // Output folder
  outputDir: 'test-results/',

  // Fail fast - stop on first failure (useful for Ralph Wiggum)
  // Set to false to run all tests
  // fullyParallel: false,
});
