// api/stripe/refund.js
// ============================================
// STRIPE REFUND API ENDPOINT
// ============================================
// Processes refunds for cancelled jobs through Stripe Connect

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        paymentIntentId,
        chargeId,
        amount,          // Amount in cents to refund (if partial)
        reason,          // 'duplicate' | 'fraudulent' | 'requested_by_customer'
        jobId,
        contractorId,
        stripeAccountId  // Contractor's connected account
    } = req.body;

    // Validate required fields
    if (!paymentIntentId && !chargeId) {
        return res.status(400).json({ error: 'Either paymentIntentId or chargeId is required' });
    }

    if (!stripeAccountId) {
        return res.status(400).json({ error: 'stripeAccountId is required for connected account refunds' });
    }

    try {
        let refundParams = {
            reason: reason || 'requested_by_customer',
            metadata: {
                jobId: jobId || '',
                contractorId: contractorId || '',
                refundedAt: new Date().toISOString(),
                initiatedBy: 'contractor'
            }
        };

        // Either use payment_intent or charge
        if (paymentIntentId) {
            refundParams.payment_intent = paymentIntentId;
        } else if (chargeId) {
            refundParams.charge = chargeId;
        }

        // If partial refund, specify amount in cents
        if (amount && amount > 0) {
            refundParams.amount = Math.round(amount); // Ensure it's an integer
        }

        console.log('[Stripe Refund] Creating refund:', {
            paymentIntentId,
            chargeId,
            amount,
            stripeAccountId
        });

        // Create refund through the connected account
        const refund = await stripe.refunds.create(refundParams, {
            stripeAccount: stripeAccountId
        });

        console.log('[Stripe Refund] Refund created:', refund.id);

        return res.status(200).json({
            success: true,
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount,
            currency: refund.currency
        });

    } catch (error) {
        console.error('[Stripe Refund] Error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeCardError') {
            return res.status(400).json({ error: 'Card refund failed: ' + error.message });
        }

        if (error.code === 'charge_already_refunded') {
            return res.status(400).json({ error: 'This charge has already been refunded' });
        }

        if (error.code === 'charge_disputed') {
            return res.status(400).json({ error: 'Cannot refund a disputed charge' });
        }

        if (error.code === 'charge_exceeds_source_limit') {
            return res.status(400).json({ error: 'Refund amount exceeds the original charge amount' });
        }

        return res.status(500).json({
            error: 'Failed to process refund',
            details: error.message
        });
    }
}

export const config = {
    api: {
        bodyParser: true
    }
};
