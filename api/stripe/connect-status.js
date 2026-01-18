// api/stripe/connect-status.js
// ============================================
// STRIPE CONNECT STATUS CHECK
// ============================================
// Checks if a contractor's Stripe account is fully set up
// and ready to receive payments

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
        const { stripeAccountId } = req.body;

        if (!stripeAccountId) {
            return res.status(400).json({ 
                error: 'Missing stripeAccountId' 
            });
        }

        // Retrieve the account
        const account = await stripe.accounts.retrieve(stripeAccountId);

        // Check if onboarding is complete
        const isComplete = account.details_submitted && 
                          account.charges_enabled && 
                          account.payouts_enabled;

        // Get any requirements that need attention
        const requirements = account.requirements;
        const hasErrors = requirements?.errors?.length > 0;
        const hasPastDue = requirements?.past_due?.length > 0;
        const hasCurrentlyDue = requirements?.currently_due?.length > 0;

        return res.status(200).json({
            success: true,
            accountId: account.id,
            status: {
                isComplete,
                detailsSubmitted: account.details_submitted,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                hasErrors,
                hasPastDue,
                hasCurrentlyDue
            },
            businessProfile: {
                name: account.business_profile?.name,
                supportEmail: account.business_profile?.support_email
            },
            requirements: {
                currentlyDue: requirements?.currently_due || [],
                pastDue: requirements?.past_due || [],
                errors: requirements?.errors || []
            }
        });

    } catch (error) {
        console.error('Stripe Connect status error:', error);
        
        // Handle specific Stripe errors
        if (error.code === 'account_invalid') {
            return res.status(404).json({
                error: 'Stripe account not found',
                message: 'The connected account may have been deleted'
            });
        }
        
        return res.status(500).json({
            error: 'Failed to check account status'
        });
    }
}
