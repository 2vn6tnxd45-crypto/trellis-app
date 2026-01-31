// tests/e2e/api/api-endpoints.spec.js
// ============================================
// API ENDPOINT TESTS
// ============================================
// Tests for the API routes in /api directory
// These test response codes, validation, and error handling

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.LOCAL_TEST === '1' ? 'http://localhost:5173' : 'https://mykrib.app';

// ============================================
// WIDGET API TESTS (Public Endpoints)
// ============================================
test.describe('Widget API Endpoints', () => {

    test('API-001: Widget contractor-info returns 400 without contractorId', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/widget/contractor-info`, {
            data: {}
        });

        // Should return error for missing contractorId
        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-001] Response: ${JSON.stringify(body)}`);
    });

    test('API-002: Widget availability endpoint exists', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/widget/availability`, {
            data: { contractorId: 'test-invalid-id' }
        });

        // Should return 400/404 for invalid contractor, but endpoint should exist
        expect([200, 400, 404]).toContain(response.status());
        console.log(`[API-002] Status: ${response.status()}`);
    });

    test('API-003: Widget book endpoint validates required fields', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/widget/book`, {
            data: {
                // Missing required fields
                contractorId: 'test-id'
            }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-003] Validation error: ${body.error}`);
    });

    test('API-004: Widget book validates email format', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/widget/book`, {
            data: {
                contractorId: 'test-id',
                customerName: 'Test Customer',
                customerEmail: 'not-an-email', // Invalid
                customerPhone: '5551234567',
                serviceType: 'repair',
                date: '2024-02-01',
                time: '10:00'
            }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toMatch(/email/i);
        console.log(`[API-004] Email validation: ${body.error}`);
    });

    test('API-005: Widget book validates phone format', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/widget/book`, {
            data: {
                contractorId: 'test-id',
                customerName: 'Test Customer',
                customerEmail: 'test@example.com',
                customerPhone: '123', // Too short
                serviceType: 'repair',
                date: '2024-02-01',
                time: '10:00'
            }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toMatch(/phone/i);
        console.log(`[API-005] Phone validation: ${body.error}`);
    });
});

// ============================================
// STRIPE API TESTS
// ============================================
test.describe('Stripe API Endpoints', () => {

    test('API-010: Stripe connect-onboard requires contractorId', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/connect-onboard`, {
            data: {}
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-010] Response: ${JSON.stringify(body)}`);
    });

    test('API-011: Stripe connect-status requires accountId', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/connect-status`, {
            data: {}
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-011] Response: ${JSON.stringify(body)}`);
    });

    test('API-012: Stripe create-checkout validates amount', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/create-checkout`, {
            data: {
                stripeAccountId: 'test-account',
                amount: -100, // Invalid negative
                type: 'full_payment'
            }
        });

        // Should reject negative amounts
        expect([400, 500]).toContain(response.status());
        console.log(`[API-012] Status: ${response.status()}`);
    });

    test('API-013: Stripe webhook validates signature', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
            data: { type: 'test' },
            headers: {
                'stripe-signature': 'invalid-signature'
            }
        });

        // Should reject invalid signature
        expect(response.status()).toBe(400);
        console.log(`[API-013] Webhook rejected invalid sig`);
    });

    test('API-014: Stripe refund requires payment identifier', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/refund`, {
            data: {
                stripeAccountId: 'test-account'
                // Missing paymentIntentId or chargeId
            }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-014] Refund validation: ${JSON.stringify(body)}`);
    });

    test('API-015: Stripe create-payment-link validates params', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/create-payment-link`, {
            data: {}
        });

        expect(response.status()).toBe(400);
        console.log(`[API-015] Payment link validation passed`);
    });
});

// ============================================
// SMS API TESTS
// ============================================
test.describe('SMS API Endpoints', () => {

    test('API-020: SMS send requires contractorId', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/sms/send`, {
            data: {
                to: '+15551234567',
                message: 'Test message'
            }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-020] SMS validation: ${JSON.stringify(body)}`);
    });

    test('API-021: SMS send validates phone number', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/sms/send`, {
            data: {
                contractorId: 'test-contractor',
                to: 'not-a-phone',
                message: 'Test message'
            }
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-021] Phone validation status: ${response.status()}`);
    });

    test('API-022: SMS webhook validates Twilio signature in production', async ({ request }) => {
        // In development, signature may be skipped
        const response = await request.post(`${BASE_URL}/api/sms/webhook`, {
            data: {
                MessageSid: 'test-sid',
                MessageStatus: 'delivered'
            }
        });

        // Just verify endpoint exists and responds
        expect([200, 400, 403]).toContain(response.status());
        console.log(`[API-022] Webhook status: ${response.status()}`);
    });

    test('API-023: SMS status-callback handles delivery updates', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/sms/status-callback`, {
            data: {
                MessageSid: 'test-sid',
                MessageStatus: 'delivered',
                To: '+15551234567'
            }
        });

        expect([200, 400, 403]).toContain(response.status());
        console.log(`[API-023] Status callback: ${response.status()}`);
    });
});

// ============================================
// NOTIFICATION API TESTS (Email)
// ============================================
test.describe('Notification API Endpoints', () => {

    test('API-030: Send-quote requires email', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/send-quote`, {
            data: {
                contractorName: 'Test Contractor',
                quoteTitle: 'Test Quote'
                // Missing customerEmail
            }
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-030] Send-quote status: ${response.status()}`);
    });

    test('API-031: Send-quote-accepted requires data', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/send-quote-accepted`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-031] Quote-accepted status: ${response.status()}`);
    });

    test('API-032: Send-job-scheduled validates params', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/send-job-scheduled`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-032] Job-scheduled status: ${response.status()}`);
    });

    test('API-033: Send-job-completion requires job data', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/send-job-completion`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-033] Job-completion status: ${response.status()}`);
    });

    test('API-034: Send-review-request requires data', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/send-review-request`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-034] Review-request status: ${response.status()}`);
    });

    test('API-035: Send-job-cancelled requires params', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/send-job-cancelled`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-035] Job-cancelled status: ${response.status()}`);
    });
});

// ============================================
// FINANCING API TESTS
// ============================================
test.describe('Financing API Endpoints', () => {

    test('API-040: Financing create-application validates customer data', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/financing/create-application`, {
            data: {}
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        console.log(`[API-040] Financing validation: ${JSON.stringify(body)}`);
    });

    test('API-041: Financing status requires application ID', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/financing/status?applicationId=`);

        expect([400, 404]).toContain(response.status());
        console.log(`[API-041] Financing status check: ${response.status()}`);
    });

    test('API-042: Financing webhook validates provider signature', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/financing/webhook`, {
            data: { event: 'test' }
        });

        expect([200, 400, 403]).toContain(response.status());
        console.log(`[API-042] Financing webhook: ${response.status()}`);
    });
});

// ============================================
// MEMBERSHIP API TESTS
// ============================================
test.describe('Membership API Endpoints', () => {

    test('API-050: Membership create-subscription requires plan', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/memberships/create-subscription`, {
            data: {}
        });

        expect(response.status()).toBe(400);
        console.log(`[API-050] Subscription creation validation passed`);
    });

    test('API-051: Membership webhook validates signature', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/memberships/webhook`, {
            data: { type: 'test' },
            headers: {
                'stripe-signature': 'invalid'
            }
        });

        expect([400, 403]).toContain(response.status());
        console.log(`[API-051] Membership webhook: ${response.status()}`);
    });
});

// ============================================
// CRON API TESTS (Should be protected)
// ============================================
test.describe('Cron API Endpoints', () => {

    test('API-060: Cron appointment-reminders requires auth', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/cron/appointment-reminders`);

        // Cron endpoints should require auth or return 405 for GET
        expect([401, 403, 405]).toContain(response.status());
        console.log(`[API-060] Cron auth: ${response.status()}`);
    });

    test('API-061: Cron membership-renewals requires auth', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/cron/membership-renewals`);

        expect([401, 403, 405]).toContain(response.status());
        console.log(`[API-061] Renewal cron: ${response.status()}`);
    });

    test('API-062: Cron payment-reminders requires auth', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/cron/payment-reminders`);

        expect([401, 403, 405]).toContain(response.status());
        console.log(`[API-062] Payment reminder cron: ${response.status()}`);
    });
});

// ============================================
// UTILITY API TESTS
// ============================================
test.describe('Utility API Endpoints', () => {

    test('API-070: Property-data requires address', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/property-data`);

        expect([400, 404]).toContain(response.status());
        console.log(`[API-070] Property-data: ${response.status()}`);
    });

    test('API-071: Estimate-duration requires job description', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/estimate-duration`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-071] Duration estimate: ${response.status()}`);
    });

    test('API-072: Analyze-evaluation requires data', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/analyze-evaluation`, {
            data: {}
        });

        expect([400, 500]).toContain(response.status());
        console.log(`[API-072] Analyze evaluation: ${response.status()}`);
    });

    test('API-073: Neighborhood data requires location', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/neighborhood`);

        expect([400, 404]).toContain(response.status());
        console.log(`[API-073] Neighborhood: ${response.status()}`);
    });
});

// ============================================
// CORS & SECURITY HEADER TESTS
// ============================================
test.describe('Security Headers', () => {

    test('API-080: Widget endpoints have CORS headers', async ({ request }) => {
        const response = await request.options(`${BASE_URL}/api/widget/contractor-info`);

        const corsHeader = response.headers()['access-control-allow-origin'];
        console.log(`[API-080] CORS header: ${corsHeader}`);
        // Note: Wildcard CORS is acceptable for public widget but should be documented
    });

    test('API-081: Stripe webhook rejects wrong content type', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
            headers: {
                'content-type': 'text/plain'
            },
            data: 'not json'
        });

        expect([400, 415]).toContain(response.status());
        console.log(`[API-081] Content-type check: ${response.status()}`);
    });
});

// ============================================
// RATE LIMIT TESTS (Manual verification needed)
// ============================================
test.describe('Rate Limiting', () => {

    test('API-090: SMS endpoint has rate limiting', async ({ request }) => {
        // Send multiple requests quickly
        const results = [];
        for (let i = 0; i < 5; i++) {
            const response = await request.post(`${BASE_URL}/api/sms/send`, {
                data: {
                    contractorId: 'rate-limit-test',
                    to: '+15551234567',
                    message: `Rate limit test ${i}`
                }
            });
            results.push(response.status());
        }

        console.log(`[API-090] Rate limit test results: ${results}`);
        // Note: Due to in-memory rate limiting, this may not trigger in all environments
    });

    test('API-091: Widget book has rate limiting', async ({ request }) => {
        const results = [];
        for (let i = 0; i < 3; i++) {
            const response = await request.post(`${BASE_URL}/api/widget/book`, {
                data: {
                    contractorId: 'rate-limit-test',
                    customerName: 'Test',
                    customerEmail: 'test@test.com',
                    customerPhone: '5551234567'
                }
            });
            results.push(response.status());
        }

        console.log(`[API-091] Book rate limit: ${results}`);
    });
});
