// tests/fixtures/accounts.js
// Centralized test account credentials and session paths

/**
 * Test account credentials
 * These accounts should be dedicated test accounts, not production accounts
 */
export const TEST_ACCOUNTS = {
    homeowner: {
        email: 'danvdova@gmail.com',
        password: 'Password123',
        sessionPath: 'tests/auth/homeowner.json',
        name: 'Test Homeowner',
        phone: '5551234567'
    },
    contractor: {
        email: 'daviladevon@gmail.com',
        password: 'Password123',
        sessionPath: 'tests/auth/contractor.json',
        name: 'Test Contractor',
        companyName: 'Test Plumbing Co',
        phone: '5559876543'
    }
};

/**
 * Test environment configuration
 */
export const TEST_CONFIG = {
    baseUrl: process.env.LOCAL_TEST === '1'
        ? 'http://localhost:5173'
        : 'https://mykrib.app',
    timeout: {
        short: 3000,
        medium: 5000,
        long: 10000,
        navigation: 15000
    },
    retries: {
        login: 2,
        apiCall: 3
    }
};

/**
 * Vercel bypass configuration
 * Set VERCEL_BYPASS_TOKEN in your environment to skip bot protection
 */
export const VERCEL_CONFIG = {
    bypassHeader: 'x-vercel-protection-bypass',
    bypassToken: process.env.VERCEL_BYPASS_TOKEN || null
};

export default {
    TEST_ACCOUNTS,
    TEST_CONFIG,
    VERCEL_CONFIG
};
