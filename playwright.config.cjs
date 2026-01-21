// playwright.config.js
// ============================================
// KRIB PLAYWRIGHT CONFIGURATION
// ============================================
// This file tells Playwright how to run your tests

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Where your test files are
  testDir: './tests',

  // Run tests in parallel - limited to 2 workers to avoid rate limiting
  // Set to 1 for sequential execution if needed
  workers: 2,

  // Retry failed tests (helps with rate limiting and flaky tests)
  retries: 2,

  // Maximum time per test (3 minutes for complex E2E tests)
  timeout: 180000,

  // Global setup/teardown for session management
  // globalSetup: './tests/global-setup.js',
  // globalTeardown: './tests/global-teardown.js',

  // What to do when a test fails
  reporter: [
    ['list'],                                              // Show results in terminal
    ['html', { open: 'never' }],                          // Generate HTML report
    ['json', { outputFile: 'test-results/results.json' }] // JSON for Claude Code
  ],

  // Settings that apply to all tests
  use: {
    // The URL of your app
    baseURL: 'https://mykrib.app',

    // ALWAYS take screenshots for visual verification
    screenshot: 'on',

    // Record video for debugging
    video: 'retain-on-failure',

    // Save trace for debugging (viewable at trace.playwright.dev)
    trace: 'retain-on-failure',

    // Slow down actions slightly to avoid rate limiting and improve stability
    // slowMo: 100,

    // Browser viewport size
    viewport: { width: 1280, height: 720 },

    // Generous timeouts to handle slow network/Firebase
    actionTimeout: 20000,
    navigationTimeout: 45000,

    // Ignore HTTPS errors (useful for development)
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
    // Uncomment for cross-browser testing:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Output folder for screenshots, videos, traces
  outputDir: 'test-results/',

  // Folder for test artifacts (auth state, etc.)
  // snapshotDir: './tests/snapshots/',

  // Web server config (if you want to start local server)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});
