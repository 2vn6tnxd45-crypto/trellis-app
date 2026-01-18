// playwright.config.js
// ============================================
// KRIB PLAYWRIGHT CONFIGURATION
// ============================================
// This file tells Playwright how to run your tests

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Where your test files are
  testDir: './tests',
  
  // Run tests in parallel for speed (set to 1 if tests interfere with each other)
  workers: 1,
  
  // Retry failed tests once (helps with flaky tests)
  retries: 1,
  
  // Maximum time per test (2 minutes)
  timeout: 120000,
  
  // What to do when a test fails
  reporter: [
    ['list'],                          // Show results in terminal
    ['html', { open: 'never' }],       // Generate HTML report
    ['json', { outputFile: 'test-results/results.json' }]  // JSON for Claude Code
  ],
  
  // Settings that apply to all tests
  use: {
    // The URL of your app
    baseURL: 'https://mykrib.app',
    
    // Take screenshot when test fails
    screenshot: 'only-on-failure',
    
    // Record video when test fails
    video: 'retain-on-failure',
    
    // Save trace for debugging (viewable at trace.playwright.dev)
    trace: 'retain-on-failure',
    
    // Slow down actions by 500ms so you can see what's happening (remove for speed)
    // slowMo: 500,
    
    // Browser viewport size
    viewport: { width: 1280, height: 720 },
    
    // Don't wait forever for things
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Which browsers to test on
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment these to test on more browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 13'] },
    // },
  ],

  // Output folder for screenshots, videos, traces
  outputDir: 'test-results/',
});
