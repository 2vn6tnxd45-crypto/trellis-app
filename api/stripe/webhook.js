// api/stripe/webhook.js
// ============================================
// STRIPE WEBHOOK HANDLER
// ============================================
// Receives events from Stripe and updates our database
// Events: checkout.session.completed, payment_intent.succeeded, etc.

import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (if not already)
if (getApps().length === 0) {
    // In production, use service account from environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
            credential: cert(serviceAccount)
        });
    } else {
        // For development/testing without admin SDK
        console.warn('Firebase Admin not initialized - webhook will log but not update DB');
    }
}

const db = getApps().length > 0 ? getFirestore() : null;
const appId = 'krib-app';

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

// Helper to get raw body
async function getRawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        // Verify the webhook signature
        event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`📥 Stripe webhook received: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutComplete(event.data.object);
                break;
                
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(event.data.object);
                break;
                
            case 'payment_intent.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
                
            case 'account.updated':
                await handleAccountUpdated(event.data.object);
                break;
                
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('Webhook processing error:', error);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle successful checkout session
 */
async function handleCheckoutComplete(session) {
    console.log('✅ Checkout completed:', session.id);
    
    const metadata = session.metadata || {};
    const { type, quoteId, jobId, contractorId } = metadata;
    
    // Calculate amount paid
    const amountPaid = session.amount_total / 100; // Convert cents to dollars
    
    console.log(`   Type: ${type}, Amount: $${amountPaid}, Job: ${jobId}, Quote: ${quoteId}`);
    
    if (!db) {
        console.warn('   Firebase Admin not available - skipping DB update');
        return;
    }
    
    const paymentRecord = {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        type: type || 'payment',
        amount: amountPaid,
        currency: session.currency,
        status: 'succeeded',
        customerEmail: session.customer_email,
        paidAt: new Date().toISOString(),
        metadata: metadata
    };
    
    try {
        // Update quote if this was a deposit
        if (type === 'deposit' && quoteId && contractorId) {
            const quoteRef = db.doc(`artifacts/${appId}/public/data/contractors/${contractorId}/quotes/${quoteId}`);
            await quoteRef.update({
                'payment.deposit': paymentRecord,
                'payment.depositPaid': true,
                'payment.depositPaidAt': new Date(),
                updatedAt: new Date()
            });
            console.log(`   ✅ Updated quote ${quoteId} with deposit payment`);
        }
        
        // Update job if this was a balance or full payment
        if ((type === 'balance' || type === 'full_payment') && jobId) {
            const jobRef = db.doc(`artifacts/${appId}/public/data/requests/${jobId}`);
            await jobRef.update({
                'payment.final': paymentRecord,
                'payment.balancePaid': true,
                'payment.balancePaidAt': new Date(),
                'payment.fullyPaid': true,
                updatedAt: new Date()
            });
            console.log(`   ✅ Updated job ${jobId} with balance payment`);
        }
        
    } catch (error) {
        console.error('   ❌ Failed to update database:', error);
        throw error;
    }
}

/**
 * Handle successful payment intent (backup for checkout)
 */
async function handlePaymentSuccess(paymentIntent) {
    console.log('✅ Payment succeeded:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    console.log(`   Amount: $${paymentIntent.amount / 100}, Metadata:`, metadata);
    
    // Most logic handled in checkout.session.completed
    // This is a backup / for direct payment intents
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
    console.log('❌ Payment failed:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    const { jobId, quoteId, contractorId } = metadata;
    
    console.log(`   Job: ${jobId}, Quote: ${quoteId}, Error: ${paymentIntent.last_payment_error?.message}`);
    
    if (!db) return;
    
    // Could update job/quote to show payment failed
    // For now, just log it
}

/**
 * Handle Stripe Connect account updates
 */
async function handleAccountUpdated(account) {
    console.log('🔄 Account updated:', account.id);
    
    const isComplete = account.details_submitted && 
                      account.charges_enabled && 
                      account.payouts_enabled;
    
    console.log(`   Complete: ${isComplete}, Charges: ${account.charges_enabled}, Payouts: ${account.payouts_enabled}`);
    
    // Get contractor ID from metadata
    const contractorId = account.metadata?.contractorId;
    
    if (!db || !contractorId) return;
    
    try {
        const contractorRef = db.doc(`artifacts/${appId}/public/data/contractors/${contractorId}`);
        await contractorRef.update({
            'stripe.accountId': account.id,
            'stripe.isComplete': isComplete,
            'stripe.chargesEnabled': account.charges_enabled,
            'stripe.payoutsEnabled': account.payouts_enabled,
            'stripe.updatedAt': new Date()
        });
        console.log(`   ✅ Updated contractor ${contractorId} Stripe status`);
    } catch (error) {
        console.error('   ❌ Failed to update contractor:', error);
    }
}
