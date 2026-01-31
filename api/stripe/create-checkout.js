// api/stripe/create-checkout.js
// ============================================
// STRIPE CHECKOUT SESSION
// ============================================
// Creates a Stripe Checkout session for collecting payments
// Supports: deposits on quote acceptance, balance payments on completion

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
    // CORS headers - restrict to allowed origins
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
            // Context - used to fetch source of truth
            type,               // 'deposit' | 'balance' | 'full_payment'
            quoteId,
            jobId,
            contractorId,

            // Customer info
            customerEmail,
            customerName,

            // Display
            title,              // e.g., "HVAC System Installation"
            description,        // Line item description

            // URLs
            successUrl,
            cancelUrl
        } = req.body;

        // Validate required context
        if (!contractorId) {
            return res.status(400).json({ error: 'Contractor ID is required' });
        }
        if (!quoteId && !jobId) {
            return res.status(400).json({ error: 'Quote ID or Job ID is required' });
        }

        // Fetch source of truth from Firestore to calculate amount server-side
        let verifiedAmount = 0;
        let stripeAccountId = null;
        let sourceDoc = null;

        // Get contractor's Stripe account
        const contractorDoc = await db.collection('contractors').doc(contractorId).get();
        if (!contractorDoc.exists) {
            return res.status(400).json({ error: 'Contractor not found' });
        }
        stripeAccountId = contractorDoc.data()?.stripeAccountId;

        if (!stripeAccountId) {
            return res.status(400).json({
                error: 'Contractor has not connected Stripe yet'
            });
        }

        // Calculate amount from source document
        if (quoteId) {
            const quoteDoc = await db.collection('contractors').doc(contractorId)
                .collection('quotes').doc(quoteId).get();
            if (!quoteDoc.exists) {
                return res.status(400).json({ error: 'Quote not found' });
            }
            sourceDoc = quoteDoc.data();

            // Verify quote is in acceptable state
            if (sourceDoc.status !== 'sent' && sourceDoc.status !== 'viewed' && sourceDoc.status !== 'accepted') {
                return res.status(400).json({ error: 'Quote is not in a payable state' });
            }

            // Calculate amount based on payment type
            const total = sourceDoc.total || 0;
            const depositPercent = sourceDoc.depositPercent || 0;
            const depositPaid = sourceDoc.depositPaid || false;

            if (type === 'deposit') {
                verifiedAmount = (total * depositPercent) / 100;
            } else if (type === 'balance') {
                const depositAmount = (total * depositPercent) / 100;
                verifiedAmount = total - (depositPaid ? depositAmount : 0);
            } else {
                verifiedAmount = total;
            }
        } else if (jobId) {
            const jobDoc = await db.collection('contractors').doc(contractorId)
                .collection('jobs').doc(jobId).get();
            if (!jobDoc.exists) {
                return res.status(400).json({ error: 'Job not found' });
            }
            sourceDoc = jobDoc.data();

            // For jobs, calculate remaining balance
            const total = sourceDoc.total || sourceDoc.quoteTotal || 0;
            const amountPaid = sourceDoc.amountPaid || 0;
            verifiedAmount = total - amountPaid;
        }

        // Final validation
        if (!verifiedAmount || verifiedAmount <= 0) {
            return res.status(400).json({
                error: 'Invalid payment amount calculated'
            });
        }

        // Convert dollars to cents
        const amountInCents = Math.round(verifiedAmount * 100);

        // Base URLs
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}`
            : 'https://mykrib.app';

        // Build success/cancel URLs with context
        // Quote needs full share token format: contractorId_quoteId
        const quoteToken = quoteId && contractorId ? `${contractorId}_${quoteId}` : '';
        const defaultSuccessUrl = `${baseUrl}/payment/success?type=${type}&job=${jobId || ''}&quote=${quoteToken}`;
        const defaultCancelUrl = `${baseUrl}/payment/cancelled?type=${type}&job=${jobId || ''}&quote=${quoteToken}`;

        // Create line item description
        const lineItemName = type === 'deposit' 
            ? `Deposit for: ${title || 'Service'}`
            : type === 'balance'
                ? `Balance Due: ${title || 'Service'}`
                : title || 'Service Payment';

        // Create Checkout Session
        // Using "destination" charge - funds go to contractor, Krib takes no cut
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: customerEmail || undefined,
            
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: lineItemName,
                            description: description || undefined,
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            
            // Send payment to contractor's connected account
            payment_intent_data: {
                // Direct charge to connected account
                transfer_data: {
                    destination: stripeAccountId,
                },
                // Metadata for tracking
                metadata: {
                    type: type || 'payment',
                    quoteId: quoteId || '',
                    jobId: jobId || '',
                    contractorId: contractorId || '',
                    platform: 'krib'
                },
                // Description that appears on bank statement
                statement_descriptor_suffix: 'KRIB',
            },
            
            // Metadata on the session itself
            metadata: {
                type: type || 'payment',
                quoteId: quoteId || '',
                jobId: jobId || '',
                contractorId: contractorId || '',
                customerName: customerName || '',
                platform: 'krib'
            },
            
            success_url: successUrl || defaultSuccessUrl,
            cancel_url: cancelUrl || defaultCancelUrl,
            
            // Collect billing address for receipts
            billing_address_collection: 'auto',
            
            // Allow promotion codes (future feature)
            allow_promotion_codes: false,
        });

        console.log(`✅ Created checkout session: ${session.id} for ${type} payment of $${verifiedAmount}`);

        return res.status(200).json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            amount: verifiedAmount,
            amountInCents: amountInCents
        });

    } catch (error) {
        console.error('Stripe checkout error:', error);
        
        return res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
}
