// api/sms/status-callback.js
// ============================================
// TWILIO SMS STATUS CALLBACK
// ============================================
// Receives delivery status updates from Twilio

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
    const url = `${process.env.VERCEL_URL || process.env.APP_URL}/api/sms/status-callback`;

    return twilio.validateRequest(authToken, twilioSignature, url, req.body);
};

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Validate Twilio signature in production
        if (process.env.NODE_ENV === 'production') {
            const isValid = validateTwilioSignature(req);
            if (!isValid) {
                console.error('[SMS Status] Invalid signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }
        }

        const {
            MessageSid: messageSid,
            MessageStatus: status,
            ErrorCode: errorCode,
            ErrorMessage: errorMessage,
            To: to,
            From: from
        } = req.body;

        console.log(`[SMS Status] ${messageSid}: ${status}${errorCode ? ` (Error: ${errorCode})` : ''}`);

        // Initialize Firebase
        const db = getFirebaseAdmin();

        // Find and update the SMS log entry
        const smsQuery = await db.collection('smsLogs')
            .where('messageSid', '==', messageSid)
            .limit(1)
            .get();

        if (!smsQuery.empty) {
            const smsRef = smsQuery.docs[0].ref;
            const updateData = {
                status: status,
                statusUpdatedAt: FieldValue.serverTimestamp()
            };

            if (errorCode) {
                updateData.errorCode = errorCode;
                updateData.errorMessage = errorMessage || null;
            }

            // Track delivery metrics
            if (status === 'delivered') {
                updateData.deliveredAt = FieldValue.serverTimestamp();
            } else if (status === 'failed' || status === 'undelivered') {
                updateData.failedAt = FieldValue.serverTimestamp();
            }

            await smsRef.update(updateData);
        } else {
            // Log orphaned status callback (message not found in our logs)
            console.warn(`[SMS Status] No log found for message ${messageSid}`);

            // Still create a record for tracking
            await db.collection('smsLogs').add({
                messageSid: messageSid,
                status: status,
                errorCode: errorCode || null,
                errorMessage: errorMessage || null,
                to: to,
                from: from,
                direction: 'outbound',
                orphaned: true,
                createdAt: FieldValue.serverTimestamp()
            });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[SMS Status Error]', error);
        return res.status(500).json({ error: error.message });
    }
}

// Export config for Vercel
export const config = {
    api: {
        bodyParser: true
    }
};
