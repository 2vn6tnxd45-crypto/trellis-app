// src/lib/fieldPaymentService.js
// ============================================
// FIELD PAYMENT SERVICE
// ============================================
// Enables on-site payment collection via QR codes, payment links, and tap-to-pay
// Integrates with Stripe for secure payment processing

import { db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../config/constants';

// ============================================
// CONSTANTS
// ============================================

export const PAYMENT_METHODS = {
    QR_CODE: 'qr_code',
    SMS_LINK: 'sms_link',
    EMAIL_LINK: 'email_link',
    TAP_TO_PAY: 'tap_to_pay',
    CARD_ON_FILE: 'card_on_file',
    MANUAL_ENTRY: 'manual_entry'
};

export const PAYMENT_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    EXPIRED: 'expired'
};

// Link expiration time (24 hours)
const LINK_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// ============================================
// PAYMENT LINK GENERATION
// ============================================

/**
 * Create a Stripe Payment Link for field collection
 *
 * @param {Object} params
 * @param {string} params.stripeAccountId - Contractor's connected Stripe account
 * @param {number} params.amount - Amount in dollars
 * @param {string} params.jobId - Associated job ID
 * @param {string} params.contractorId - Contractor's ID
 * @param {string} params.description - Payment description (shown to customer)
 * @param {string} [params.customerEmail] - Customer email for receipts
 * @param {string} [params.customerName] - Customer name
 * @param {string} [params.jobNumber] - Job reference number
 * @param {string} [params.type] - Payment type: 'balance' | 'deposit' | 'full'
 * @returns {Promise<{paymentLinkId: string, url: string, expiresAt: Date}>}
 */
export const createFieldPaymentLink = async ({
    stripeAccountId,
    amount,
    jobId,
    contractorId,
    description,
    customerEmail,
    customerName,
    jobNumber,
    type = 'balance'
}) => {
    if (!stripeAccountId) {
        throw new Error('Stripe account not configured. Please complete payment setup.');
    }

    if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
    }

    try {
        const response = await fetch('/api/stripe/create-payment-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stripeAccountId,
                amount: Math.round(amount * 100), // Convert to cents
                description: description || `Payment for Job #${jobNumber || jobId?.slice(-6)}`,
                metadata: {
                    jobId,
                    contractorId,
                    jobNumber,
                    type,
                    source: 'field_payment'
                },
                customerEmail,
                customerName,
                // Allow saving card for future use
                allowFutureUsage: true,
                // Success/cancel URLs for web redirects
                successUrl: `${window.location.origin}/app/?payment=success&job=${jobId}`,
                cancelUrl: `${window.location.origin}/app/?payment=cancelled&job=${jobId}`
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create payment link');
        }

        // Store payment link record for tracking
        const expiresAt = new Date(Date.now() + LINK_EXPIRATION_MS);

        await storePaymentLinkRecord({
            paymentLinkId: data.paymentLinkId,
            url: data.url,
            shortUrl: data.shortUrl,
            jobId,
            contractorId,
            amount,
            type,
            expiresAt,
            customerEmail,
            customerName
        });

        return {
            paymentLinkId: data.paymentLinkId,
            url: data.url,
            shortUrl: data.shortUrl || data.url,
            expiresAt
        };
    } catch (error) {
        console.error('[fieldPaymentService] Error creating payment link:', error);
        throw error;
    }
};

/**
 * Store payment link record for tracking
 */
const storePaymentLinkRecord = async (data) => {
    try {
        const linksRef = collection(db, 'paymentLinks');
        await addDoc(linksRef, {
            ...data,
            status: PAYMENT_STATUS.PENDING,
            createdAt: serverTimestamp(),
            expiresAt: data.expiresAt
        });
    } catch (error) {
        console.warn('[fieldPaymentService] Failed to store payment link record:', error);
        // Non-blocking - link was still created
    }
};

// ============================================
// QR CODE DATA GENERATION
// ============================================

/**
 * Generate QR code data for a payment
 * Returns the data needed to render a QR code (use with qrcode library or component)
 *
 * @param {Object} params
 * @param {string} params.paymentUrl - The Stripe payment link URL
 * @param {number} params.amount - Amount for display
 * @param {string} params.jobNumber - Job reference
 * @returns {{qrData: string, displayInfo: Object}}
 */
export const generateQRCodeData = ({
    paymentUrl,
    amount,
    jobNumber,
    customerName
}) => {
    return {
        qrData: paymentUrl, // The URL encoded in the QR code
        displayInfo: {
            amount,
            amountFormatted: formatCurrency(amount),
            jobNumber,
            customerName,
            instructions: 'Scan with your phone camera to pay'
        }
    };
};

// ============================================
// SMS/EMAIL PAYMENT LINK DELIVERY
// ============================================

/**
 * Send payment link via SMS
 *
 * @param {Object} params
 * @param {string} params.phone - Customer phone number
 * @param {string} params.paymentUrl - Payment link URL
 * @param {number} params.amount - Payment amount
 * @param {string} params.contractorName - Contractor/business name
 * @param {string} params.jobDescription - Brief job description
 * @param {string} params.contractorId - For tracking
 * @returns {Promise<{success: boolean, messageId?: string}>}
 */
export const sendPaymentLinkSMS = async ({
    phone,
    paymentUrl,
    amount,
    contractorName,
    jobDescription,
    contractorId
}) => {
    if (!phone) {
        throw new Error('Customer phone number required');
    }

    try {
        const response = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: phone,
                message: formatPaymentSMS({
                    amount,
                    contractorName,
                    jobDescription,
                    paymentUrl
                }),
                type: 'payment_link',
                contractorId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send SMS');
        }

        return { success: true, messageId: data.messageId };
    } catch (error) {
        console.error('[fieldPaymentService] SMS send error:', error);
        throw error;
    }
};

/**
 * Send payment link via Email
 *
 * @param {Object} params
 * @param {string} params.email - Customer email
 * @param {string} params.paymentUrl - Payment link URL
 * @param {number} params.amount - Payment amount
 * @param {string} params.contractorName - Contractor/business name
 * @param {string} params.jobDescription - Brief job description
 * @param {string} params.customerName - Customer name
 * @returns {Promise<{success: boolean, emailId?: string}>}
 */
export const sendPaymentLinkEmail = async ({
    email,
    paymentUrl,
    amount,
    contractorName,
    jobDescription,
    customerName
}) => {
    if (!email) {
        throw new Error('Customer email required');
    }

    try {
        const response = await fetch('/api/email/send-payment-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: email,
                customerName,
                contractorName,
                amount,
                jobDescription,
                paymentUrl
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send email');
        }

        return { success: true, emailId: data.id };
    } catch (error) {
        console.error('[fieldPaymentService] Email send error:', error);
        throw error;
    }
};

// ============================================
// CARD ON FILE CHARGING
// ============================================

/**
 * Charge a customer's saved card
 *
 * @param {Object} params
 * @param {string} params.customerId - Stripe customer ID
 * @param {string} params.paymentMethodId - Saved payment method ID
 * @param {number} params.amount - Amount in dollars
 * @param {string} params.stripeAccountId - Contractor's account
 * @param {string} params.jobId - Associated job
 * @param {string} params.description - Payment description
 * @returns {Promise<{success: boolean, paymentIntentId: string, status: string}>}
 */
export const chargeCardOnFile = async ({
    customerId,
    paymentMethodId,
    amount,
    stripeAccountId,
    jobId,
    description
}) => {
    if (!customerId || !paymentMethodId) {
        throw new Error('No card on file for this customer');
    }

    try {
        const response = await fetch('/api/stripe/charge-saved-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId,
                paymentMethodId,
                amount: Math.round(amount * 100),
                stripeAccountId,
                description,
                metadata: {
                    jobId,
                    source: 'field_payment_card_on_file'
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Card charge failed');
        }

        return {
            success: true,
            paymentIntentId: data.paymentIntentId,
            status: data.status
        };
    } catch (error) {
        console.error('[fieldPaymentService] Card charge error:', error);
        throw error;
    }
};

// ============================================
// PAYMENT RECORDING
// ============================================

/**
 * Record a field payment on a job
 * Called after successful payment completion
 *
 * @param {string} jobId
 * @param {Object} paymentData
 * @param {number} paymentData.amount - Amount paid
 * @param {string} paymentData.method - Payment method used
 * @param {string} paymentData.paymentIntentId - Stripe payment intent ID
 * @param {string} [paymentData.receiptUrl] - Stripe receipt URL
 * @param {string} collectedBy - Tech ID who collected payment
 */
export const recordFieldPayment = async (jobId, paymentData, collectedBy) => {
    if (!jobId) throw new Error('Job ID required');

    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

    // Get current job data
    const jobSnap = await getDoc(jobRef);
    if (!jobSnap.exists()) {
        throw new Error('Job not found');
    }

    const job = jobSnap.data();
    const existingPayments = job.payments || [];

    const newPayment = {
        id: `pmt_${Date.now()}`,
        amount: paymentData.amount,
        method: paymentData.method,
        paymentIntentId: paymentData.paymentIntentId,
        receiptUrl: paymentData.receiptUrl,
        collectedBy,
        collectedAt: new Date().toISOString(),
        status: PAYMENT_STATUS.COMPLETED,
        type: 'field_collection'
    };

    // Calculate totals
    const totalPaid = [...existingPayments, newPayment]
        .filter(p => p.status === PAYMENT_STATUS.COMPLETED)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

    const invoiceTotal = job.invoiceData?.total || job.total || 0;
    const balanceDue = Math.max(0, invoiceTotal - totalPaid);

    await updateDoc(jobRef, {
        payments: [...existingPayments, newPayment],
        totalPaid,
        balanceDue,
        paymentStatus: balanceDue <= 0 ? 'paid' : 'partial',
        lastPaymentAt: serverTimestamp(),
        lastActivity: serverTimestamp()
    });

    return {
        success: true,
        paymentId: newPayment.id,
        totalPaid,
        balanceDue,
        isPaidInFull: balanceDue <= 0
    };
};

// ============================================
// PAYMENT STATUS HELPERS
// ============================================

/**
 * Get payment status for a job
 */
export const getJobPaymentStatus = (job) => {
    const invoiceTotal = job.invoiceData?.total || job.total || 0;
    const depositPaid = job.depositAmount || job.depositPaid || 0;
    const totalPaid = job.totalPaid || depositPaid;
    const balanceDue = job.balanceDue ?? Math.max(0, invoiceTotal - totalPaid);

    return {
        invoiceTotal,
        depositPaid,
        totalPaid,
        balanceDue,
        isPaidInFull: balanceDue <= 0,
        hasDeposit: depositPaid > 0,
        paymentPercentage: invoiceTotal > 0 ? Math.round((totalPaid / invoiceTotal) * 100) : 0
    };
};

/**
 * Check if contractor can accept field payments
 */
export const canAcceptFieldPayments = (contractor) => {
    return contractor?.stripe?.isComplete &&
           contractor?.stripe?.chargesEnabled;
};

// ============================================
// FORMATTING HELPERS
// ============================================

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
};

const formatPaymentSMS = ({ amount, contractorName, jobDescription, paymentUrl }) => {
    return `${contractorName}: Your payment of ${formatCurrency(amount)} is ready for "${jobDescription}". Pay securely: ${paymentUrl}`;
};

// ============================================
// EXPORT
// ============================================

export default {
    // Constants
    PAYMENT_METHODS,
    PAYMENT_STATUS,

    // Link generation
    createFieldPaymentLink,
    generateQRCodeData,

    // Delivery
    sendPaymentLinkSMS,
    sendPaymentLinkEmail,

    // Card on file
    chargeCardOnFile,

    // Recording
    recordFieldPayment,

    // Helpers
    getJobPaymentStatus,
    canAcceptFieldPayments
};
