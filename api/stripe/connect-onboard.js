// api/stripe/connect-onboard.js
// ============================================
// STRIPE CONNECT ONBOARDING
// ============================================
// Creates a Stripe Connect Express account for contractors
// and returns an onboarding link for them to complete setup

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
            contractorId, 
            email, 
            businessName,
            returnUrl,
            refreshUrl 
        } = req.body;

        if (!contractorId || !email) {
            return res.status(400).json({ 
                error: 'Missing required fields: contractorId and email' 
            });
        }

        // Base URLs for redirects
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}`
            : 'https://mykrib.app';
        
        const defaultReturnUrl = `${baseUrl}/app/?pro&stripe=success`;
        const defaultRefreshUrl = `${baseUrl}/app/?pro&stripe=refresh`;

        // Check if contractor already has a Stripe account
        // (We'll store the account ID in Firebase, passed from frontend)
        let accountId = req.body.existingStripeAccountId;

        if (!accountId) {
            // Create a new Express Connect account
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US',
                email: email,
                business_type: 'individual', // Can be 'company' too
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_profile: {
                    name: businessName || undefined,
                    product_description: 'Home services contractor',
                    mcc: '1520', // General Contractors
                },
                metadata: {
                    contractorId: contractorId,
                    platform: 'krib'
                }
            });
            
            accountId = account.id;
            console.log(`✅ Created Stripe Connect account: ${accountId} for contractor: ${contractorId}`);
        }

        // Create an account link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl || defaultRefreshUrl,
            return_url: returnUrl || defaultReturnUrl,
            type: 'account_onboarding',
        });

        return res.status(200).json({
            success: true,
            accountId: accountId,
            onboardingUrl: accountLink.url,
            expiresAt: accountLink.expires_at
        });

    } catch (error) {
        console.error('Stripe Connect onboarding error:', error);
        
        return res.status(500).json({
            error: 'Failed to create onboarding link',
            message: error.message
        });
    }
}
