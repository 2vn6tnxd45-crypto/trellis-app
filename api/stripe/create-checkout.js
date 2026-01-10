// api/stripe/create-checkout.js
// ============================================
// STRIPE CHECKOUT SESSION
// ============================================
// Creates a Stripe Checkout session for collecting payments
// Supports: deposits on quote acceptance, balance payments on completion

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
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
            // Required
            stripeAccountId,    // Contractor's connected account
            amount,             // Amount in dollars (we'll convert to cents)
            
            // Context
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

        // Validation
        if (!stripeAccountId) {
            return res.status(400).json({ 
                error: 'Contractor has not connected Stripe yet' 
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                error: 'Invalid payment amount' 
            });
        }

        // Convert dollars to cents
        const amountInCents = Math.round(amount * 100);

        // Base URLs
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}`
            : 'https://mykrib.app';

        // Build success/cancel URLs with context
        // Quote needs full share token format: contractorId_quoteId
        const quoteToken = quoteId && contractorId ? `${contractorId}_${quoteId}` : '';
        const defaultSuccessUrl = `${baseUrl}/app/?payment=success&type=${type}&job=${jobId || ''}&quote=${quoteToken}`;
        const defaultCancelUrl = `${baseUrl}/app/?payment=cancelled&type=${type}&job=${jobId || ''}&quote=${quoteToken}`;

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

        console.log(`✅ Created checkout session: ${session.id} for ${type} payment of $${amount}`);

        return res.status(200).json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            amount: amount,
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
