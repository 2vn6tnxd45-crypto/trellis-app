// src/lib/stripeService.js
// ============================================
// STRIPE SERVICE
// ============================================
// Frontend service for Stripe Connect and payments
// Handles contractor onboarding and customer payments

// ============================================
// CONTRACTOR: CONNECT ONBOARDING
// ============================================

/**
 * Start Stripe Connect onboarding for a contractor
 * Creates a connected account and returns the onboarding URL
 * 
 * @param {object} params
 * @param {string} params.contractorId - The contractor's ID
 * @param {string} params.email - Contractor's email
 * @param {string} params.businessName - Company name
 * @param {string} [params.existingStripeAccountId] - If reconnecting
 * @returns {Promise<{accountId: string, onboardingUrl: string}>}
 */
import { formatCurrency } from './utils';
export const startStripeOnboarding = async ({ 
    contractorId, 
    email, 
    businessName,
    existingStripeAccountId = null 
}) => {
    try {
        const response = await fetch('/api/stripe/connect-onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contractorId,
                email,
                businessName,
                existingStripeAccountId,
                returnUrl: `${window.location.origin}/app/?pro&stripe=success`,
                refreshUrl: `${window.location.origin}/app/?pro&stripe=refresh`
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to start onboarding');
        }
        
        return data;
    } catch (error) {
        console.error('Stripe onboarding error:', error);
        throw error;
    }
};

/**
 * Check the status of a contractor's Stripe account
 * 
 * @param {string} stripeAccountId - The Stripe account ID
 * @returns {Promise<{isComplete: boolean, chargesEnabled: boolean, ...}>}
 */
export const checkStripeStatus = async (stripeAccountId) => {
    try {
        const response = await fetch('/api/stripe/connect-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stripeAccountId })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to check status');
        }
        
        return data;
    } catch (error) {
        console.error('Stripe status check error:', error);
        throw error;
    }
};

// ============================================
// CUSTOMER: PAYMENTS
// ============================================

/**
 * Create a checkout session for payment
 * Redirects customer to Stripe Checkout
 * 
 * @param {object} params
 * @param {string} params.stripeAccountId - Contractor's connected account
 * @param {number} params.amount - Amount in dollars
 * @param {string} params.type - 'deposit' | 'balance' | 'full_payment'
 * @param {string} [params.quoteId] - Associated quote
 * @param {string} [params.jobId] - Associated job
 * @param {string} params.contractorId - Contractor's ID
 * @param {string} params.title - Description for line item
 * @param {string} [params.customerEmail] - Pre-fill customer email
 * @param {string} [params.customerName] - Customer name
 * @returns {Promise<{checkoutUrl: string}>}
 */
export const createPaymentCheckout = async ({
    stripeAccountId,
    amount,
    type,
    quoteId,
    jobId,
    contractorId,
    title,
    description,
    customerEmail,
    customerName
}) => {
    try {
        const response = await fetch('/api/stripe/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stripeAccountId,
                amount,
                type,
                quoteId,
                jobId,
                contractorId,
                title,
                description,
                customerEmail,
                customerName,
                successUrl: `${window.location.origin}/payment/success?type=${type}&job=${jobId || ''}&quote=${quoteId || ''}`,
                cancelUrl: `${window.location.origin}/payment/cancelled?type=${type}&job=${jobId || ''}&quote=${quoteId || ''}`
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout');
        }
        
        return data;
    } catch (error) {
        console.error('Payment checkout error:', error);
        throw error;
    }
};

/**
 * Redirect to Stripe Checkout
 * Convenience function that creates session and redirects
 */
export const redirectToCheckout = async (params) => {
    const { checkoutUrl } = await createPaymentCheckout(params);
    window.location.href = checkoutUrl;
};

// ============================================
// HELPERS
// ============================================

/**
 * Calculate deposit amount based on quote settings
 */
export const calculateDepositAmount = (quote) => {
    if (!quote.depositRequired) return 0;
    
    const total = quote.total || 0;
    
    if (quote.depositType === 'percentage') {
        return total * ((quote.depositValue || 0) / 100);
    }
    
    return quote.depositValue || 0;
};

/**
 * Calculate balance amount (total minus deposit)
 */
export const calculateBalanceAmount = (quote, depositPaid = false) => {
    const total = quote.total || 0;
    
    if (!depositPaid) return total;
    
    const deposit = calculateDepositAmount(quote);
    return total - deposit;
};

/**
 * Check if contractor can accept payments
 */
export const canAcceptPayments = (contractor) => {
    return contractor?.stripe?.isComplete &&
           contractor?.stripe?.chargesEnabled;
};

// ============================================
// REFUNDS
// ============================================

/**
 * Process a refund for a cancelled job
 *
 * @param {object} params
 * @param {string} params.paymentIntentId - The Stripe payment intent ID
 * @param {string} [params.chargeId] - Alternative: The Stripe charge ID
 * @param {number} [params.amount] - Amount in DOLLARS to refund (omit for full refund)
 * @param {string} params.stripeAccountId - Contractor's connected account ID
 * @param {string} [params.jobId] - Job ID for metadata
 * @param {string} [params.contractorId] - Contractor ID for metadata
 * @param {string} [params.reason] - 'duplicate' | 'fraudulent' | 'requested_by_customer'
 * @returns {Promise<{success: boolean, refundId: string, status: string, amount: number}>}
 */
export const processRefund = async ({
    paymentIntentId,
    chargeId,
    amount,
    stripeAccountId,
    jobId,
    contractorId,
    reason = 'requested_by_customer'
}) => {
    if (!paymentIntentId && !chargeId) {
        throw new Error('Either paymentIntentId or chargeId is required');
    }

    if (!stripeAccountId) {
        throw new Error('stripeAccountId is required for connected account refunds');
    }

    try {
        const response = await fetch('/api/stripe/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paymentIntentId,
                chargeId,
                amount: amount ? Math.round(amount * 100) : undefined, // Convert dollars to cents
                stripeAccountId,
                jobId,
                contractorId,
                reason
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to process refund');
        }

        return data;
    } catch (error) {
        console.error('Refund processing error:', error);
        throw error;
    }
};

/**
 * Format refund status for display
 */
export const formatRefundStatus = (status) => {
    const statusMap = {
        'succeeded': 'Refund Completed',
        'pending': 'Refund Pending',
        'failed': 'Refund Failed',
        'canceled': 'Refund Cancelled'
    };
    return statusMap[status] || status;
};

export default {
    startStripeOnboarding,
    checkStripeStatus,
    createPaymentCheckout,
    redirectToCheckout,
    calculateDepositAmount,
    calculateBalanceAmount,
    canAcceptPayments,
    processRefund,
    formatRefundStatus
};

export { formatCurrency };
