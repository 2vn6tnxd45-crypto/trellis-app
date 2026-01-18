#!/usr/bin/env node
// scripts/capture-visual-baselines.js
/**
 * Visual Regression Baseline Capture Script
 *
 * This script captures initial baseline screenshots for visual regression testing.
 * Run this when:
 * - Setting up visual testing for the first time
 * - After intentional UI changes that should become the new baseline
 * - When adding new pages to visual testing
 *
 * Usage:
 *   npm run visual:update     # Update all baselines
 *   npm run visual:capture    # Alias for update
 *
 * The baselines are stored in:
 *   tests/visual/visual-regression.spec.js-snapshots/
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
    console.log('\n' + '='.repeat(60));
    log(message, 'bright');
    console.log('='.repeat(60) + '\n');
}

function logStep(step, message) {
    log(`[${step}] ${message}`, 'blue');
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logWarning(message) {
    log(`⚠ ${message}`, 'yellow');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

async function main() {
    logHeader('Visual Regression Baseline Capture');

    // Step 1: Check prerequisites
    logStep(1, 'Checking prerequisites...');

    const playwrightConfigPath = join(projectRoot, 'playwright.config.js');
    if (!existsSync(playwrightConfigPath)) {
        logError('playwright.config.js not found!');
        logWarning('Please ensure Playwright is configured correctly.');
        process.exit(1);
    }
    logSuccess('Playwright config found');

    const visualTestPath = join(projectRoot, 'tests', 'visual', 'visual-regression.spec.js');
    if (!existsSync(visualTestPath)) {
        logError('Visual regression test file not found!');
        process.exit(1);
    }
    logSuccess('Visual regression tests found');

    // Step 2: Ensure snapshot directory exists
    logStep(2, 'Preparing snapshot directory...');

    const snapshotDir = join(projectRoot, 'tests', 'visual', 'visual-regression.spec.js-snapshots');
    if (!existsSync(snapshotDir)) {
        mkdirSync(snapshotDir, { recursive: true });
        logSuccess(`Created snapshot directory: ${snapshotDir}`);
    } else {
        // Count existing snapshots
        const existingSnapshots = readdirSync(snapshotDir).filter(f => f.endsWith('.png'));
        if (existingSnapshots.length > 0) {
            logWarning(`Found ${existingSnapshots.length} existing baseline(s) - will be updated`);
        }
    }

    // Step 3: Check if dev server is running
    logStep(3, 'Checking development server...');

    try {
        const response = await fetch('http://localhost:5173', { method: 'HEAD' });
        logSuccess('Development server is running on port 5173');
    } catch {
        logWarning('Development server not detected on port 5173');
        log('Playwright will start the dev server automatically', 'yellow');
    }

    // Step 4: Run visual tests with update flag
    logStep(4, 'Capturing visual baselines...');
    log('This may take a few minutes...', 'yellow');

    try {
        execSync('npx playwright test tests/visual --update-snapshots --reporter=list', {
            cwd: projectRoot,
            stdio: 'inherit',
            env: {
                ...process.env,
                CI: 'false', // Ensure we're not in CI mode
            },
        });
        logSuccess('Visual baselines captured successfully!');
    } catch (error) {
        logError('Some tests failed during baseline capture');
        logWarning('Review the output above for details');
        logWarning('Failed tests will not have baselines until fixed');
    }

    // Step 5: Summary
    logHeader('Baseline Capture Summary');

    if (existsSync(snapshotDir)) {
        const snapshots = readdirSync(snapshotDir).filter(f => f.endsWith('.png'));

        log(`Total baselines: ${snapshots.length}`, 'green');
        log(`Location: ${snapshotDir}`, 'blue');

        // Group by viewport
        const byViewport = {
            desktop: snapshots.filter(s => s.includes('desktop')).length,
            mobile: snapshots.filter(s => s.includes('mobile')).length,
            tablet: snapshots.filter(s => s.includes('tablet')).length,
            other: snapshots.filter(s =>
                !s.includes('desktop') && !s.includes('mobile') && !s.includes('tablet')
            ).length,
        };

        console.log('\nBy viewport:');
        Object.entries(byViewport).forEach(([viewport, count]) => {
            if (count > 0) {
                log(`  ${viewport}: ${count}`, 'blue');
            }
        });

        // Calculate total size
        let totalSize = 0;
        snapshots.forEach(file => {
            const stat = statSync(join(snapshotDir, file));
            totalSize += stat.size;
        });
        log(`\nTotal size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`, 'blue');
    }

    console.log('\n' + '-'.repeat(60));
    log('Next steps:', 'bright');
    log('1. Review the captured baselines in the snapshot directory');
    log('2. Commit the baselines to version control');
    log('3. Run "npm run visual:test" to verify the baselines work');
    console.log('-'.repeat(60) + '\n');
}

main().catch(error => {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
});
