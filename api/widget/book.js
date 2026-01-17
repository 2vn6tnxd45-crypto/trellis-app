// api/widget/book.js
// ============================================
// PUBLIC BOOKING API
// ============================================
// Creates new booking from widget submission

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

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

// Rate limiting - simple in-memory store
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 bookings per IP per hour

const checkRateLimit = (ip) => {
    const now = Date.now();
    const key = `booking_${ip}`;
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

// Validate email format
const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Validate phone format
const isValidPhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
};

// Format phone to E.164
const formatPhoneE164 = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
};

// Generate booking confirmation code
const generateConfirmationCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Send notification email (via external service or queue)
const sendNotificationEmail = async (type, data) => {
    // In production, this would call SendGrid/Mailgun/etc.
    // For now, we'll just log and store in a notifications collection
    console.log(`[Booking] Email notification: ${type}`, data);

    try {
        const db = getFirebaseAdmin();
        await db.collection('emailQueue').add({
            type,
            data,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('Failed to queue email:', e);
    }
};

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).set(corsHeaders).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).set(corsHeaders).json({ error: 'Method not allowed' });
    }

    try {
        // Rate limiting
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
        if (!checkRateLimit(clientIP)) {
            return res.status(429).set(corsHeaders).json({
                error: 'Too many booking requests. Please try again later.'
            });
        }

        const {
            contractorId,
            serviceType,
            date,
            time,
            customerName,
            customerEmail,
            customerPhone,
            serviceAddress,
            description,
            referralSource,
            recaptchaToken
        } = req.body;

        // Validate required fields
        if (!contractorId || !serviceType || !date || !time || !customerName || !customerEmail) {
            return res.status(400).set(corsHeaders).json({
                error: 'Missing required fields',
                required: ['contractorId', 'serviceType', 'date', 'time', 'customerName', 'customerEmail']
            });
        }

        // Validate email
        if (!isValidEmail(customerEmail)) {
            return res.status(400).set(corsHeaders).json({ error: 'Invalid email address' });
        }

        const db = getFirebaseAdmin();

        // Get contractor data
        const contractorRef = db.collection('contractors').doc(contractorId);
        const contractorDoc = await contractorRef.get();

        if (!contractorDoc.exists) {
            return res.status(404).set(corsHeaders).json({ error: 'Contractor not found' });
        }

        const contractorData = contractorDoc.data();
        const bookingWidget = contractorData.bookingWidget || {};

        if (!bookingWidget.enabled) {
            return res.status(403).set(corsHeaders).json({ error: 'Online booking is not enabled' });
        }

        // Validate phone if required
        if (bookingWidget.requirePhone && !customerPhone) {
            return res.status(400).set(corsHeaders).json({ error: 'Phone number is required' });
        }
        if (customerPhone && !isValidPhone(customerPhone)) {
            return res.status(400).set(corsHeaders).json({ error: 'Invalid phone number' });
        }

        // Validate address if required
        if (bookingWidget.requireAddress && !serviceAddress) {
            return res.status(400).set(corsHeaders).json({ error: 'Service address is required' });
        }

        // Validate service type is allowed
        if (bookingWidget.allowedServices?.length > 0 &&
            !bookingWidget.allowedServices.includes(serviceType)) {
            return res.status(400).set(corsHeaders).json({
                error: 'Selected service type is not available for online booking'
            });
        }

        // Verify reCAPTCHA if configured
        if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
            try {
                const recaptchaResponse = await fetch(
                    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
                    { method: 'POST' }
                );
                const recaptchaResult = await recaptchaResponse.json();
                if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
                    return res.status(400).set(corsHeaders).json({ error: 'reCAPTCHA verification failed' });
                }
            } catch (e) {
                console.warn('reCAPTCHA verification error:', e);
            }
        }

        // Verify slot is still available
        const bookingDate = new Date(date);
        const existingJobsSnapshot = await db.collection('contractors')
            .doc(contractorId)
            .collection('jobs')
            .where('scheduledDate', '>=', bookingDate)
            .where('scheduledDate', '<=', new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000))
            .where('status', 'in', ['scheduled', 'confirmed', 'assigned', 'in_progress', 'pending_confirmation'])
            .get();

        const [bookingHour, bookingMinute] = time.split(':').map(Number);
        const slotDuration = bookingWidget.slotDurationMinutes || 60;
        const buffer = bookingWidget.bufferMinutes || 30;

        const isSlotTaken = existingJobsSnapshot.docs.some(doc => {
            const jobData = doc.data();
            const jobDate = jobData.scheduledDate?.toDate?.() || new Date(jobData.scheduledDate);
            const jobHour = jobDate.getHours();
            const jobMinute = jobDate.getMinutes();
            const jobDuration = jobData.estimatedDuration || slotDuration;

            const bookingStart = bookingHour * 60 + bookingMinute;
            const bookingEnd = bookingStart + slotDuration;
            const jobStart = jobHour * 60 + jobMinute - buffer;
            const jobEnd = jobStart + jobDuration + buffer * 2;

            return bookingStart < jobEnd && bookingEnd > jobStart;
        });

        if (isSlotTaken) {
            return res.status(409).set(corsHeaders).json({
                error: 'This time slot is no longer available. Please select a different time.'
            });
        }

        // Generate confirmation code
        const confirmationCode = generateConfirmationCode();

        // Create scheduled date/time
        const scheduledDate = new Date(date);
        scheduledDate.setHours(bookingHour, bookingMinute, 0, 0);

        // Get service type info
        const serviceTypeInfo = (contractorData.serviceTypes || []).find(
            st => st.id === serviceType || st.value === serviceType
        );

        // Create job document
        const jobData = {
            // Job details
            status: 'pending_confirmation',
            serviceType: serviceType,
            serviceTypeName: serviceTypeInfo?.name || serviceTypeInfo?.label || serviceType,
            description: description || '',
            estimatedDuration: serviceTypeInfo?.duration || slotDuration,

            // Scheduling
            scheduledDate: scheduledDate,
            scheduledTime: time,
            bookingConfirmationCode: confirmationCode,

            // Customer info
            customerName: customerName.trim(),
            customerEmail: customerEmail.toLowerCase().trim(),
            customerPhone: customerPhone ? formatPhoneE164(customerPhone) : null,

            // Address
            serviceAddress: serviceAddress ? {
                formatted: typeof serviceAddress === 'string' ? serviceAddress : serviceAddress.formatted,
                ...(typeof serviceAddress === 'object' ? serviceAddress : {})
            } : null,

            // Metadata
            source: 'booking_widget',
            referralSource: referralSource || null,
            contractorId: contractorId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),

            // Tracking
            widgetBooking: {
                bookedAt: new Date().toISOString(),
                clientIP: clientIP,
                userAgent: req.headers['user-agent'] || null
            }
        };

        // Create the job
        const jobRef = await db.collection('contractors')
            .doc(contractorId)
            .collection('jobs')
            .add(jobData);

        // Update job with its own ID
        await jobRef.update({ id: jobRef.id });

        // Create notification for contractor
        await db.collection('notifications').add({
            type: 'new_booking',
            contractorId: contractorId,
            jobId: jobRef.id,
            customerName: customerName,
            serviceType: serviceTypeInfo?.name || serviceType,
            scheduledDate: scheduledDate.toISOString(),
            confirmationCode: confirmationCode,
            read: false,
            createdAt: FieldValue.serverTimestamp()
        });

        // Send notification emails
        const companyName = contractorData.businessName || contractorData.companyName || 'Service Provider';

        // Email to contractor
        await sendNotificationEmail('contractor_new_booking', {
            to: contractorData.email,
            contractorName: contractorData.ownerName || companyName,
            customerName,
            customerEmail,
            customerPhone: customerPhone || 'Not provided',
            serviceType: serviceTypeInfo?.name || serviceType,
            scheduledDate: scheduledDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            scheduledTime: time,
            serviceAddress: typeof serviceAddress === 'string' ? serviceAddress : serviceAddress?.formatted,
            description,
            confirmationCode,
            jobId: jobRef.id
        });

        // Email to customer
        await sendNotificationEmail('customer_booking_confirmation', {
            to: customerEmail,
            customerName,
            companyName,
            serviceType: serviceTypeInfo?.name || serviceType,
            scheduledDate: scheduledDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            scheduledTime: time,
            confirmationCode,
            contractorPhone: contractorData.phone || null,
            contractorEmail: contractorData.email
        });

        console.log(`[Booking] Created job ${jobRef.id} for contractor ${contractorId}`);

        return res.status(201).set(corsHeaders).json({
            success: true,
            booking: {
                id: jobRef.id,
                confirmationCode,
                scheduledDate: scheduledDate.toISOString(),
                scheduledTime: time,
                serviceType: serviceTypeInfo?.name || serviceType,
                customerName,
                customerEmail,
                companyName
            },
            message: 'Booking confirmed! You will receive an email confirmation shortly.'
        });

    } catch (error) {
        console.error('[Booking API] Error:', error);
        return res.status(500).set(corsHeaders).json({ error: 'Failed to create booking. Please try again.' });
    }
}

export const config = {
    api: {
        bodyParser: true
    }
};
