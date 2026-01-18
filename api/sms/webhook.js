// api/sms/webhook.js
// ============================================
// TWILIO INCOMING SMS WEBHOOK
// ============================================
// Handles incoming SMS messages from customers
// Processes CONFIRM, RESCHEDULE, CANCEL, STOP responses

import twilio from 'twilio';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

// Validate Twilio webhook signature
const validateTwilioSignature = (req) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSignature = req.headers['x-twilio-signature'];
    const url = `${process.env.VERCEL_URL || process.env.APP_URL}/api/sms/webhook`;

    return twilio.validateRequest(authToken, twilioSignature, url, req.body);
};

// Parse customer response
const parseCustomerResponse = (body) => {
    const normalized = body.trim().toUpperCase();

    // Direct matches
    const responses = {
        'CONFIRM': 'confirm',
        'YES': 'confirm',
        'Y': 'confirm',
        'CONFIRMED': 'confirm',
        'RESCHEDULE': 'reschedule',
        'CHANGE': 'reschedule',
        'CANCEL': 'cancel',
        'STOP': 'stop',
        'UNSUBSCRIBE': 'stop',
        'OPTOUT': 'stop',
        'OPT OUT': 'stop',
        'NO': 'decline',
        'N': 'decline'
    };

    return responses[normalized] || 'unknown';
};

// Generate TwiML response
const generateTwiML = (message) => {
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    if (message) {
        twiml.message(message);
    }
    return twiml.toString();
};

// Response messages
const RESPONSE_MESSAGES = {
    confirm: "Thanks for confirming! We'll see you at your scheduled appointment time.",
    reschedule: "We've received your reschedule request. A team member will contact you shortly to find a new time that works for you.",
    cancel: "We've received your cancellation request. A team member will contact you to confirm.",
    stop: "You've been unsubscribed from SMS notifications. Reply START to opt back in.",
    start: "Welcome back! You've been re-subscribed to SMS notifications.",
    unknown: "Sorry, we didn't understand that response. Reply CONFIRM to confirm, RESCHEDULE to change your appointment, or STOP to unsubscribe."
};

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    try {
        // Validate Twilio signature in production
        if (process.env.NODE_ENV === 'production') {
            const isValid = validateTwilioSignature(req);
            if (!isValid) {
                console.error('[SMS Webhook] Invalid signature');
                return res.status(403).send('Invalid signature');
            }
        }

        const {
            From: from,
            To: to,
            Body: body,
            MessageSid: messageSid,
            AccountSid: accountSid
        } = req.body;

        console.log(`[SMS Webhook] Received from ${from}: "${body}"`);

        // Initialize Firebase
        const db = getFirebaseAdmin();

        // Parse the response
        const responseType = parseCustomerResponse(body);

        // Find the customer and recent job by phone number
        const customerData = await findCustomerByPhone(db, from);

        // Log incoming message
        await db.collection('smsLogs').add({
            direction: 'inbound',
            from: from,
            to: to,
            body: body,
            messageSid: messageSid,
            responseType: responseType,
            customerId: customerData?.customerId || null,
            jobId: customerData?.recentJobId || null,
            contractorId: customerData?.contractorId || null,
            processedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp()
        });

        // Handle response type
        let responseMessage = RESPONSE_MESSAGES[responseType];

        switch (responseType) {
            case 'confirm':
                if (customerData?.recentJobId) {
                    await handleConfirmation(db, customerData.recentJobId, from);
                }
                break;

            case 'reschedule':
                if (customerData?.recentJobId) {
                    await handleRescheduleRequest(db, customerData.recentJobId, from, customerData.contractorId);
                }
                break;

            case 'cancel':
                if (customerData?.recentJobId) {
                    await handleCancellationRequest(db, customerData.recentJobId, from, customerData.contractorId);
                }
                break;

            case 'stop':
                await handleOptOut(db, from, customerData?.contractorId);
                break;

            default:
                // Check if it's a START message to re-subscribe
                if (body.trim().toUpperCase() === 'START') {
                    await handleOptIn(db, from, customerData?.contractorId);
                    responseMessage = RESPONSE_MESSAGES.start;
                }
                break;
        }

        // Send TwiML response
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(generateTwiML(responseMessage));

    } catch (error) {
        console.error('[SMS Webhook Error]', error);

        // Still return a valid TwiML response on error
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(generateTwiML(
            "We encountered an issue processing your message. Please try again or contact us directly."
        ));
    }
}

// Find customer by phone number
async function findCustomerByPhone(db, phone) {
    try {
        // Normalize phone for lookup
        const normalizedPhone = phone.replace(/\D/g, '');
        const e164Phone = phone.startsWith('+') ? phone : `+${normalizedPhone}`;

        // Look for recent SMS sent to this number
        const recentSMS = await db.collection('smsLogs')
            .where('to', '==', e164Phone)
            .where('direction', '==', 'outbound')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (!recentSMS.empty) {
            const smsDoc = recentSMS.docs[0].data();
            return {
                customerId: smsDoc.customerId || null,
                recentJobId: smsDoc.jobId || null,
                contractorId: smsDoc.contractorId || null
            };
        }

        // Alternative: Search jobs by customer phone
        const jobsSnapshot = await db.collectionGroup('jobs')
            .where('customerPhone', '==', e164Phone)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        if (!jobsSnapshot.empty) {
            const jobDoc = jobsSnapshot.docs[0];
            const jobData = jobDoc.data();
            return {
                customerId: jobData.customerId || null,
                recentJobId: jobDoc.id,
                contractorId: jobData.contractorId || null
            };
        }

        return null;
    } catch (error) {
        console.error('[SMS] Find customer error:', error);
        return null;
    }
}

// Handle confirmation
async function handleConfirmation(db, jobId, customerPhone) {
    try {
        // Find the job document
        const jobsQuery = await db.collectionGroup('jobs')
            .where('id', '==', jobId)
            .limit(1)
            .get();

        if (!jobsQuery.empty) {
            const jobRef = jobsQuery.docs[0].ref;
            await jobRef.update({
                'customerConfirmed': true,
                'customerConfirmedAt': FieldValue.serverTimestamp(),
                'customerConfirmedVia': 'sms'
            });
            console.log(`[SMS] Job ${jobId} confirmed by customer via SMS`);
        }
    } catch (error) {
        console.error('[SMS] Handle confirmation error:', error);
    }
}

// Handle reschedule request
async function handleRescheduleRequest(db, jobId, customerPhone, contractorId) {
    try {
        // Create a reschedule request notification
        await db.collection('notifications').add({
            type: 'reschedule_request',
            jobId: jobId,
            customerPhone: customerPhone,
            contractorId: contractorId,
            source: 'sms',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp()
        });

        // Update job with reschedule request flag
        const jobsQuery = await db.collectionGroup('jobs')
            .where('id', '==', jobId)
            .limit(1)
            .get();

        if (!jobsQuery.empty) {
            const jobRef = jobsQuery.docs[0].ref;
            await jobRef.update({
                'rescheduleRequested': true,
                'rescheduleRequestedAt': FieldValue.serverTimestamp(),
                'rescheduleRequestedVia': 'sms'
            });
        }

        console.log(`[SMS] Reschedule request created for job ${jobId}`);
    } catch (error) {
        console.error('[SMS] Handle reschedule error:', error);
    }
}

// Handle cancellation request
async function handleCancellationRequest(db, jobId, customerPhone, contractorId) {
    try {
        // Create a cancellation request notification
        await db.collection('notifications').add({
            type: 'cancellation_request',
            jobId: jobId,
            customerPhone: customerPhone,
            contractorId: contractorId,
            source: 'sms',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp()
        });

        // Update job with cancellation request flag
        const jobsQuery = await db.collectionGroup('jobs')
            .where('id', '==', jobId)
            .limit(1)
            .get();

        if (!jobsQuery.empty) {
            const jobRef = jobsQuery.docs[0].ref;
            await jobRef.update({
                'cancellationRequested': true,
                'cancellationRequestedAt': FieldValue.serverTimestamp(),
                'cancellationRequestedVia': 'sms'
            });
        }

        console.log(`[SMS] Cancellation request created for job ${jobId}`);
    } catch (error) {
        console.error('[SMS] Handle cancellation error:', error);
    }
}

// Handle opt-out
async function handleOptOut(db, phone, contractorId) {
    try {
        const optOutData = {
            phone: phone,
            optedOut: true,
            optedOutAt: FieldValue.serverTimestamp(),
            source: 'sms'
        };

        if (contractorId) {
            // Contractor-specific opt-out
            await db.collection('smsOptOuts').doc(`${contractorId}_${phone}`).set(optOutData, { merge: true });
        }

        // Global opt-out
        await db.collection('smsOptOuts').doc(phone).set({
            ...optOutData,
            global: true
        }, { merge: true });

        console.log(`[SMS] Opt-out recorded`);
    } catch (error) {
        console.error('[SMS] Handle opt-out error:', error);
    }
}

// Handle opt-in
async function handleOptIn(db, phone, contractorId) {
    try {
        const optInData = {
            optedOut: false,
            optedInAt: FieldValue.serverTimestamp(),
            source: 'sms'
        };

        if (contractorId) {
            await db.collection('smsOptOuts').doc(`${contractorId}_${phone}`).update(optInData);
        }

        await db.collection('smsOptOuts').doc(phone).update(optInData);

        console.log(`[SMS] Opt-in recorded`);
    } catch (error) {
        console.error('[SMS] Handle opt-in error:', error);
    }
}

// Export config for Vercel
export const config = {
    api: {
        bodyParser: true
    }
};
