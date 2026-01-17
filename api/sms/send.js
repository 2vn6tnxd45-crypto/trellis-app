// api/sms/send.js
// ============================================
// TWILIO SMS SEND API ENDPOINT
// ============================================
// Vercel serverless function to send SMS via Twilio
// Keeps Twilio credentials secure on server-side

import twilio from 'twilio';

// Initialize Twilio client
const getTwilioClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
    }

    return twilio(accountSid, authToken);
};

// Get Twilio phone number
const getTwilioPhoneNumber = () => {
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!phoneNumber) {
        throw new Error('Twilio phone number not configured');
    }
    return phoneNumber;
};

// Validate E.164 phone format
const isValidE164 = (phone) => {
    return /^\+[1-9]\d{1,14}$/.test(phone);
};

// Rate limiting - simple in-memory store (for production, use Redis)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 messages per minute per contractor

const checkRateLimit = (contractorId) => {
    const now = Date.now();
    const key = `ratelimit_${contractorId}`;
    const record = rateLimitStore.get(key);

    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitStore.set(key, { windowStart: now, count: 1 });
        return true;
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return false;
    }

    record.count++;
    return true;
};

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to, message, jobId, contractorId, type, metadata } = req.body;

        // Validate required fields
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields: to, message' });
        }

        // Validate phone format
        if (!isValidE164(to)) {
            return res.status(400).json({ error: 'Invalid phone number format. Must be E.164 format (e.g., +14155551234)' });
        }

        // Validate message length (SMS limit is 160 chars, but Twilio handles concatenation)
        if (message.length > 1600) {
            return res.status(400).json({ error: 'Message too long. Maximum 1600 characters.' });
        }

        // Check rate limit
        if (contractorId && !checkRateLimit(contractorId)) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }

        // Initialize Twilio client
        const client = getTwilioClient();
        const fromNumber = getTwilioPhoneNumber();

        // Build message options
        const messageOptions = {
            body: message,
            from: fromNumber,
            to: to,
            // Status callback for delivery tracking
            statusCallback: `${process.env.VERCEL_URL || process.env.APP_URL}/api/sms/status-callback`
        };

        // Send message
        const twilioMessage = await client.messages.create(messageOptions);

        console.log(`[SMS] Sent to ${to}: ${twilioMessage.sid} - Status: ${twilioMessage.status}`);

        return res.status(200).json({
            success: true,
            messageSid: twilioMessage.sid,
            status: twilioMessage.status,
            dateCreated: twilioMessage.dateCreated,
            to: twilioMessage.to,
            segmentCount: twilioMessage.numSegments
        });

    } catch (error) {
        console.error('[SMS Send Error]', error);

        // Handle specific Twilio errors
        if (error.code) {
            switch (error.code) {
                case 21211:
                    return res.status(400).json({ error: 'Invalid phone number' });
                case 21608:
                    return res.status(400).json({ error: 'Phone number not verified for trial account' });
                case 21610:
                    return res.status(400).json({ error: 'Message blocked - recipient has opted out' });
                case 21614:
                    return res.status(400).json({ error: 'Invalid destination phone number' });
                case 21408:
                    return res.status(403).json({ error: 'Region not enabled for your account' });
                case 20003:
                    return res.status(401).json({ error: 'Invalid Twilio credentials' });
                default:
                    return res.status(500).json({
                        error: 'SMS send failed',
                        code: error.code,
                        details: error.message
                    });
            }
        }

        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}

// Export config for Vercel
export const config = {
    api: {
        bodyParser: true
    }
};
