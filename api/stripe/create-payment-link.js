// api/stripe/create-payment-link.js
// ============================================
// STRIPE PAYMENT LINK CREATION
// ============================================
// Creates a Stripe Payment Link for field payment collection
// Used for QR code generation and SMS/Email payment links
// These links don't require the customer to have an account

import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (singleton)
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}
const db = getFirestore();

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            stripeAccountId,
            amount,              // Amount in cents
            description,
            metadata = {},
            customerEmail,
            customerName,
            allowFutureUsage = false,
            successUrl,
            cancelUrl
        } = req.body;

        // Validate required fields
        if (!stripeAccountId) {
            return res.status(400).json({
                error: 'Stripe account ID is required',
                code: 'MISSING_STRIPE_ACCOUNT'
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'Valid amount is required',
                code: 'INVALID_AMOUNT'
            });
        }

        // Verify the connected account is active
        try {
            const account = await stripe.accounts.retrieve(stripeAccountId);
            if (!account.charges_enabled) {
                return res.status(400).json({
                    error: 'This account cannot accept payments yet. Please complete payment setup.',
                    code: 'ACCOUNT_NOT_READY'
                });
            }
        } catch (accountError) {
            console.error('Account verification error:', accountError);
            return res.status(400).json({
                error: 'Invalid Stripe account',
                code: 'INVALID_ACCOUNT'
            });
        }

        // Base URL for redirects
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://mykrib.app';

        // Create a Price for this specific payment
        // Payment Links require a Price object (unlike Checkout Sessions)
        const price = await stripe.prices.create({
            currency: 'usd',
            unit_amount: amount,
            product_data: {
                name: description || 'Service Payment',
            },
        }, {
            stripeAccount: stripeAccountId
        });

        // Create the Payment Link on the connected account
        const paymentLink = await stripe.paymentLinks.create({
            line_items: [
                {
                    price: price.id,
                    quantity: 1,
                },
            ],
            // Success and cancel URLs with context
            after_completion: {
                type: 'redirect',
                redirect: {
                    url: successUrl || `${baseUrl}/app/?payment=success&job=${metadata.jobId || ''}`
                }
            },
            // Optional: Collect customer info
            billing_address_collection: 'auto',
            // Allow saving card for future use (for card-on-file functionality)
            payment_intent_data: {
                setup_future_usage: allowFutureUsage ? 'off_session' : undefined,
                metadata: {
                    ...metadata,
                    platform: 'krib',
                    source: 'payment_link'
                }
            },
            // Metadata on the link itself
            metadata: {
                ...metadata,
                platform: 'krib',
                customerEmail: customerEmail || '',
                customerName: customerName || ''
            },
            // Custom branding options
            custom_text: {
                submit: {
                    message: 'Your payment helps support local service providers. Thank you!'
                }
            },
            // Only allow the link to be used once
            restrictions: {
                completed_sessions: {
                    limit: 1
                }
            }
        }, {
            stripeAccount: stripeAccountId
        });

        console.log(`✅ Created payment link: ${paymentLink.id} for $${(amount / 100).toFixed(2)}`);

        // Try to generate a short URL (if we have a URL shortener service)
        // For now, use the full Stripe URL
        let shortUrl = paymentLink.url;

        // Optional: Use a URL shortener service like Bitly or TinyURL
        // This would be implemented here if needed
        // shortUrl = await shortenUrl(paymentLink.url);

        return res.status(200).json({
            success: true,
            paymentLinkId: paymentLink.id,
            url: paymentLink.url,
            shortUrl: shortUrl,
            active: paymentLink.active,
            // Return amount for display purposes
            amount: amount / 100,
            amountInCents: amount
        });

    } catch (error) {
        console.error('Payment link creation error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return res.status(400).json({
                error: error.message,
                code: error.code
            });
        }

        return res.status(500).json({
            error: 'Failed to create payment link',
            message: error.message
        });
    }
}
