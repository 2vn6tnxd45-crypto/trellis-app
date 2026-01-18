// api/financing/webhook.js
// ============================================
// WISETACK WEBHOOK HANDLER
// ============================================
// Receives status updates from Wisetack

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Initialize Firebase Admin
const getFirebaseAdmin = () => {
    if (getApps().length === 0) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
        initializeApp({
            credential: cert(serviceAccount)
        });
    }
    return getFirestore();
};

// Verify Wisetack webhook signature
const verifyWebhookSignature = (payload, signature, secret) => {
    if (!signature || !secret) return false;

    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch (error) {
        console.error('[Webhook] Signature verification error:', error);
        return false;
    }
};

// Map Wisetack status to our status
const mapStatus = (wisetackStatus) => {
    const statusMap = {
        'pending': 'pending',
        'in_progress': 'pending',
        'approved': 'approved',
        'conditionally_approved': 'approved',
        'denied': 'denied',
        'declined': 'denied',
        'funded': 'funded',
        'settled': 'funded',
        'expired': 'expired',
        'cancelled': 'cancelled',
        'canceled': 'cancelled'
    };

    return statusMap[wisetackStatus?.toLowerCase()] || 'pending';
};

// Send notification email
const sendNotificationEmail = async (db, type, data) => {
    try {
        await db.collection('emailQueue').add({
            type,
            data,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('[Webhook] Failed to queue email:', e);
    }
};

// Create notification
const createNotification = async (db, data) => {
    try {
        await db.collection('notifications').add({
            ...data,
            read: false,
            createdAt: FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('[Webhook] Failed to create notification:', e);
    }
};

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = getFirebaseAdmin();

        // Get webhook signature
        const signature = req.headers['x-wisetack-signature'] || req.headers['x-webhook-signature'];
        const webhookSecret = process.env.WISETACK_WEBHOOK_SECRET;

        // Verify signature if secret is configured
        if (webhookSecret) {
            const isValid = verifyWebhookSignature(req.body, signature, webhookSecret);
            if (!isValid) {
                console.error('[Webhook] Invalid signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        const {
            event_type,
            application_id,
            status,
            loan_amount,
            approved_amount,
            apr,
            monthly_payment,
            term_months,
            funded_amount,
            metadata
        } = req.body;

        console.log(`[Webhook] Received event: ${event_type} for application ${application_id}`);

        if (!application_id) {
            return res.status(400).json({ error: 'Missing application_id' });
        }

        // Get application from Firestore
        const appRef = db.collection('financingApplications').doc(application_id);
        const appDoc = await appRef.get();

        if (!appDoc.exists) {
            console.warn(`[Webhook] Application not found: ${application_id}`);
            // Still return 200 to acknowledge receipt
            return res.status(200).json({ received: true, warning: 'Application not found' });
        }

        const applicationData = appDoc.data();
        const { quoteId, contractorId, customerEmail, customerName } = applicationData;

        // Map the status
        const mappedStatus = mapStatus(status);

        // Update application document
        const updateData = {
            status: mappedStatus,
            lastWebhookAt: FieldValue.serverTimestamp(),
            lastEventType: event_type
        };

        if (approved_amount) {
            updateData.approvedAmount = approved_amount / 100; // Convert from cents
        }
        if (apr) {
            updateData.apr = apr;
        }
        if (monthly_payment) {
            updateData.monthlyPayment = monthly_payment / 100;
        }
        if (term_months) {
            updateData.termMonths = term_months;
        }
        if (funded_amount) {
            updateData.fundedAmount = funded_amount / 100;
        }

        // Add timestamp for specific status changes
        if (mappedStatus === 'approved') {
            updateData.approvedAt = FieldValue.serverTimestamp();
        } else if (mappedStatus === 'funded') {
            updateData.fundedAt = FieldValue.serverTimestamp();
        } else if (mappedStatus === 'denied') {
            updateData.deniedAt = FieldValue.serverTimestamp();
        }

        await appRef.update(updateData);

        // Update quote document
        if (quoteId && contractorId) {
            const quoteRef = db.collection('contractors').doc(contractorId).collection('quotes').doc(quoteId);
            const quoteDoc = await quoteRef.get();

            if (quoteDoc.exists) {
                const quoteUpdateData = {
                    'financing.status': mappedStatus,
                    'financing.lastUpdated': FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                };

                if (approved_amount) {
                    quoteUpdateData['financing.approvedAmount'] = approved_amount / 100;
                }
                if (apr) {
                    quoteUpdateData['financing.apr'] = apr;
                }
                if (monthly_payment) {
                    quoteUpdateData['financing.monthlyPayment'] = monthly_payment / 100;
                }
                if (term_months) {
                    quoteUpdateData['financing.termMonths'] = term_months;
                }

                await quoteRef.update(quoteUpdateData);
            }
        }

        // Log the event
        await db.collection('financingEvents').add({
            type: `webhook_${event_type}`,
            applicationId: application_id,
            quoteId,
            contractorId,
            status: mappedStatus,
            rawStatus: status,
            approvedAmount: approved_amount ? approved_amount / 100 : null,
            apr,
            monthlyPayment: monthly_payment ? monthly_payment / 100 : null,
            timestamp: FieldValue.serverTimestamp()
        });

        // Get contractor info for notifications
        let contractorData = null;
        if (contractorId) {
            const contractorDoc = await db.collection('contractors').doc(contractorId).get();
            if (contractorDoc.exists) {
                contractorData = contractorDoc.data();
            }
        }

        // Handle specific events
        switch (event_type) {
            case 'application_approved':
            case 'loan_approved': {
                // Notify contractor
                await createNotification(db, {
                    type: 'financing_approved',
                    contractorId,
                    quoteId,
                    applicationId: application_id,
                    customerName,
                    approvedAmount: approved_amount ? approved_amount / 100 : null,
                    monthlyPayment: monthly_payment ? monthly_payment / 100 : null
                });

                // Email to contractor
                if (contractorData?.email) {
                    await sendNotificationEmail(db, 'contractor_financing_approved', {
                        to: contractorData.email,
                        contractorName: contractorData.ownerName || contractorData.businessName,
                        customerName,
                        approvedAmount: approved_amount ? (approved_amount / 100).toFixed(2) : null,
                        monthlyPayment: monthly_payment ? (monthly_payment / 100).toFixed(2) : null,
                        apr,
                        termMonths: term_months,
                        quoteId
                    });
                }

                // Email to customer
                if (customerEmail) {
                    await sendNotificationEmail(db, 'customer_financing_approved', {
                        to: customerEmail,
                        customerName,
                        companyName: contractorData?.businessName || 'Service Provider',
                        approvedAmount: approved_amount ? (approved_amount / 100).toFixed(2) : null,
                        monthlyPayment: monthly_payment ? (monthly_payment / 100).toFixed(2) : null,
                        apr,
                        termMonths: term_months,
                        quoteUrl: `${process.env.APP_URL}/quotes/${quoteId}`
                    });
                }
                break;
            }

            case 'application_denied':
            case 'loan_denied': {
                // Notify contractor
                await createNotification(db, {
                    type: 'financing_denied',
                    contractorId,
                    quoteId,
                    applicationId: application_id,
                    customerName
                });

                // Email to customer with alternatives
                if (customerEmail) {
                    await sendNotificationEmail(db, 'customer_financing_denied', {
                        to: customerEmail,
                        customerName,
                        companyName: contractorData?.businessName || 'Service Provider',
                        quoteUrl: `${process.env.APP_URL}/quotes/${quoteId}`
                    });
                }
                break;
            }

            case 'loan_funded':
            case 'loan_settled': {
                // Notify contractor that payment is coming
                await createNotification(db, {
                    type: 'financing_funded',
                    contractorId,
                    quoteId,
                    applicationId: application_id,
                    customerName,
                    fundedAmount: funded_amount ? funded_amount / 100 : approved_amount ? approved_amount / 100 : null
                });

                // Email to contractor
                if (contractorData?.email) {
                    await sendNotificationEmail(db, 'contractor_financing_funded', {
                        to: contractorData.email,
                        contractorName: contractorData.ownerName || contractorData.businessName,
                        customerName,
                        fundedAmount: (funded_amount || approved_amount) ? ((funded_amount || approved_amount) / 100).toFixed(2) : null,
                        quoteId
                    });
                }

                // Auto-create job if quote has that setting
                const quoteDoc = await db.collection('contractors').doc(contractorId).collection('quotes').doc(quoteId).get();
                if (quoteDoc.exists) {
                    const quoteData = quoteDoc.data();
                    if (quoteData.autoCreateJobOnFunding) {
                        // Create job from quote
                        await createJobFromQuote(db, contractorId, quoteId, quoteData);
                    }
                }
                break;
            }

            case 'application_expired': {
                // Just log, no notifications needed
                console.log(`[Webhook] Application expired: ${application_id}`);
                break;
            }

            default:
                console.log(`[Webhook] Unhandled event type: ${event_type}`);
        }

        console.log(`[Webhook] Processed ${event_type} for ${application_id}, status: ${mappedStatus}`);

        return res.status(200).json({
            received: true,
            applicationId: application_id,
            status: mappedStatus
        });

    } catch (error) {
        console.error('[Webhook] Error:', error);
        // Still return 200 to prevent Wisetack from retrying
        return res.status(200).json({
            received: true,
            error: error.message
        });
    }
}

// Helper: Create job from funded quote
async function createJobFromQuote(db, contractorId, quoteId, quoteData) {
    try {
        const jobData = {
            status: 'scheduled',
            source: 'financing_funded',
            quoteId,
            customerId: quoteData.customerId,
            customerName: quoteData.customerName,
            customerEmail: quoteData.customerEmail,
            customerPhone: quoteData.customerPhone,
            serviceAddress: quoteData.serviceAddress,
            title: quoteData.title,
            description: quoteData.description,
            serviceType: quoteData.serviceType,
            total: quoteData.total || quoteData.grandTotal,
            lineItems: quoteData.lineItems,
            financing: quoteData.financing,
            contractorId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        const jobRef = await db.collection('contractors').doc(contractorId).collection('jobs').add(jobData);
        await jobRef.update({ id: jobRef.id });

        // Update quote with job reference
        await db.collection('contractors').doc(contractorId).collection('quotes').doc(quoteId).update({
            jobId: jobRef.id,
            status: 'converted',
            updatedAt: FieldValue.serverTimestamp()
        });

        console.log(`[Webhook] Created job ${jobRef.id} from quote ${quoteId}`);
        return jobRef.id;
    } catch (error) {
        console.error('[Webhook] Error creating job from quote:', error);
        return null;
    }
}

export const config = {
    api: {
        bodyParser: true
    }
};
