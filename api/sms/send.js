// api/sms/send.js
// ============================================
// TWILIO SMS SEND API ENDPOINT
// ============================================
// Vercel serverless function to send SMS via Twilio
// Keeps Twilio credentials secure on server-side

import twilio from 'twilio';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

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

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to, message, jobId, contractorId, type, metadata } = req.body;

        console.log('[SMS Send] ===== REQUEST =====');
        console.log('[SMS Send] To:', to);
        console.log('[SMS Send] Message length:', message?.length);
        console.log('[SMS Send] Job ID:', jobId);
        console.log('[SMS Send] Contractor ID:', contractorId);
        console.log('[SMS Send] Type:', type);

        // Validate required fields
        if (!to || !message) {
            console.error('[SMS Send] Missing required fields');
            return res.status(400).json({ error: 'Missing required fields: to, message' });
        }

        // Validate phone format
        if (!isValidE164(to)) {
            console.error('[SMS Send] Invalid E.164 format:', to);
            return res.status(400).json({ error: 'Invalid phone number format. Must be E.164 format (e.g., +14155551234)' });
        }

        // Validate message length (SMS limit is 160 chars, but Twilio handles concatenation)
        if (message.length > 1600) {
            console.error('[SMS Send] Message too long:', message.length);
            return res.status(400).json({ error: 'Message too long. Maximum 1600 characters.' });
        }

        // Check rate limit
        if (contractorId && !checkRateLimit(contractorId)) {
            console.error('[SMS Send] Rate limit exceeded for:', contractorId);
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }

        // Check Twilio credentials
        console.log('[SMS Send] Checking Twilio credentials...');
        console.log('[SMS Send] TWILIO_ACCOUNT_SID exists:', !!process.env.TWILIO_ACCOUNT_SID);
        console.log('[SMS Send] TWILIO_AUTH_TOKEN exists:', !!process.env.TWILIO_AUTH_TOKEN);
        console.log('[SMS Send] TWILIO_PHONE_NUMBER exists:', !!process.env.TWILIO_PHONE_NUMBER);

        // Initialize Twilio client
        const client = getTwilioClient();
        const fromNumber = getTwilioPhoneNumber();

        console.log('[SMS Send] From number:', fromNumber);

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

        console.log(`[SMS] Sent: ${twilioMessage.sid} - Status: ${twilioMessage.status}`);

        return res.status(200).json({
            success: true,
            messageSid: twilioMessage.sid,
            status: twilioMessage.status,
            dateCreated: twilioMessage.dateCreated,
            to: twilioMessage.to,
            segmentCount: twilioMessage.numSegments
        });

    } catch (error) {
        console.error('[SMS Send] ===== ERROR =====');
        console.error('[SMS Send] Error name:', error.name);
        console.error('[SMS Send] Error message:', error.message);
        console.error('[SMS Send] Error code:', error.code);
        console.error('[SMS Send] Error status:', error.status);
        console.error('[SMS Send] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error('[SMS Send] ===== END ERROR =====');

        // Handle credential errors first
        if (error.message === 'Twilio credentials not configured') {
            return res.status(500).json({
                error: 'SMS service not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.',
                code: 'TWILIO_NOT_CONFIGURED'
            });
        }

        if (error.message === 'Twilio phone number not configured') {
            return res.status(500).json({
                error: 'Twilio phone number not configured. Please set TWILIO_PHONE_NUMBER.',
                code: 'TWILIO_PHONE_MISSING'
            });
        }

        // Handle specific Twilio errors
        if (error.code) {
            const errorMessages = {
                21211: 'Invalid phone number',
                21608: 'Phone number not verified for trial account. Add this number to your verified numbers in Twilio.',
                21610: 'Message blocked - recipient has opted out',
                21614: 'Invalid destination phone number',
                21408: 'Region not enabled for your account',
                20003: 'Invalid Twilio credentials (Account SID or Auth Token)',
                20404: 'Twilio phone number not found or not configured',
                21606: 'From phone number not valid for this account',
                21612: 'The From phone number is not a valid, SMS-capable Twilio number',
                30008: 'Unknown destination handset'
            };

            const errorMessage = errorMessages[error.code] || `SMS send failed (Twilio error ${error.code})`;
            console.error('[SMS Send] Twilio error code:', error.code, '-', errorMessage);

            return res.status(error.code === 20003 ? 401 : 400).json({
                error: errorMessage,
                code: error.code
            });
        }

        return res.status(500).json({
            error: error.message || 'Internal server error',
            code: 'UNKNOWN_ERROR'
        });
    }
}

// Export config for Vercel
export const config = {
    api: {
        bodyParser: true
    }
};
