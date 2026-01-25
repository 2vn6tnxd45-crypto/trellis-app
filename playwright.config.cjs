// playwright.config.js
// ============================================
// KRIB PLAYWRIGHT CONFIGURATION
// ============================================
// This file tells Playwright how to run your tests

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Where your test files are
  testDir: './tests',

  // Run tests sequentially - CRITICAL for live production with single user accounts
  workers: 1,

  // Retry failed tests (helps with network variance)
  retries: 2,

  // Maximum time per test (3 minutes for complex E2E tests)
  timeout: 180000,

  // What to do when a test fails
  reporter: [
    ['list'],                                              // Show results in terminal
    ['html', { open: 'never' }],                          // Generate HTML report
    ['json', { outputFile: 'test-results/results.json' }] // Keep JSON for tools
  ],

  // Settings that apply to all tests
  use: {
    // The URL of your app - Live Production
    baseURL: 'https://mykrib.app',

    // ALWAYS take screenshots for visual verification
    screenshot: 'on',

    // Record video for debugging
    video: 'retain-on-failure',

    // Save trace for debugging (viewable at trace.playwright.dev)
    trace: 'retain-on-failure',

    // Browser viewport size
    viewport: { width: 1280, height: 720 },

    // Generous timeouts to handle real-world network variance on the live site
    actionTimeout: 20000,
    navigationTimeout: 45000,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
  },

  // Expect settings
  expect: {
    timeout: 15000, // Assertion timeout
  },

  // Which browsers to test on
  projects: [
    // Primary browser - Chrome
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Output folder for screenshots, videos, traces
  outputDir: 'test-results/',
});
