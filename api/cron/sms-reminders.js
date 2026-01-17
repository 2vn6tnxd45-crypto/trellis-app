// api/cron/sms-reminders.js
// ============================================
// SMS REMINDERS CRON JOB
// ============================================
// Runs every 15 minutes to send appointment reminders
// Sends 24-hour and 2-hour reminders based on scheduled times

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

// Initialize Twilio client
const getTwilioClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
    }

    return twilio(accountSid, authToken);
};

// Default templates
const DEFAULT_TEMPLATES = {
    reminder24h: "Hi {{customerName}}! This is a reminder of your {{serviceType}} appointment tomorrow, {{date}} at {{time}}. Reply CONFIRM to confirm or RESCHEDULE to change. - {{companyName}}",
    reminder2h: "Hi {{customerName}}! {{techName}} will arrive for your {{serviceType}} in about 2 hours at {{time}}. Reply YES to confirm you're ready. - {{companyName}}"
};

// Interpolate template
const interpolateTemplate = (template, variables) => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
    });
};

// Format date for display
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
};

// Format time for display
const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

// Check if opted out
const isOptedOut = async (db, phone, contractorId) => {
    // Check contractor-specific opt-out
    const contractorOptOut = await db.collection('smsOptOuts')
        .doc(`${contractorId}_${phone}`)
        .get();

    if (contractorOptOut.exists && contractorOptOut.data().optedOut) {
        return true;
    }

    // Check global opt-out
    const globalOptOut = await db.collection('smsOptOuts')
        .doc(phone)
        .get();

    return globalOptOut.exists && globalOptOut.data().optedOut;
};

// Check if reminder already sent
const isReminderSent = async (db, jobId, reminderType) => {
    const sentReminders = await db.collection('smsLogs')
        .where('jobId', '==', jobId)
        .where('type', '==', reminderType)
        .where('status', 'in', ['queued', 'sending', 'sent', 'delivered'])
        .limit(1)
        .get();

    return !sentReminders.empty;
};

// Send SMS
const sendSMS = async (client, fromNumber, to, message) => {
    return client.messages.create({
        body: message,
        from: fromNumber,
        to: to,
        statusCallback: `${process.env.VERCEL_URL || process.env.APP_URL}/api/sms/status-callback`
    });
};

export default async function handler(req, res) {
    // Verify cron secret for security
    const cronSecret = req.headers['authorization'];
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[SMS Cron] Starting reminder job...');

    const stats = {
        jobsChecked: 0,
        reminders24hSent: 0,
        reminders2hSent: 0,
        skipped: 0,
        errors: 0
    };

    try {
        const db = getFirebaseAdmin();
        const client = getTwilioClient();
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        const now = new Date();

        // Time windows for reminders
        const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
        const window24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25 hours from now
        const window2hStart = new Date(now.getTime() + 1.5 * 60 * 60 * 1000); // 1.5 hours from now
        const window2hEnd = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);   // 2.5 hours from now

        // Get all contractors with SMS enabled
        const contractorsSnapshot = await db.collection('contractors')
            .where('smsSettings.enabled', '==', true)
            .get();

        console.log(`[SMS Cron] Found ${contractorsSnapshot.size} contractors with SMS enabled`);

        for (const contractorDoc of contractorsSnapshot.docs) {
            const contractor = contractorDoc.data();
            const contractorId = contractorDoc.id;
            const smsSettings = contractor.smsSettings || {};

            if (!smsSettings.reminders?.enabled) {
                continue;
            }

            // Get jobs for this contractor
            const jobsSnapshot = await db.collection('contractors')
                .doc(contractorId)
                .collection('jobs')
                .where('status', 'in', ['scheduled', 'confirmed', 'assigned'])
                .get();

            for (const jobDoc of jobsSnapshot.docs) {
                const job = jobDoc.data();
                const jobId = jobDoc.id;
                stats.jobsChecked++;

                // Get scheduled time
                const scheduledTime = job.scheduledTime
                    ? new Date(job.scheduledTime)
                    : job.scheduledDate
                        ? new Date(job.scheduledDate)
                        : null;

                if (!scheduledTime) {
                    continue;
                }

                // Get customer phone
                const customerPhone = job.customer?.phone || job.customerPhone;
                if (!customerPhone) {
                    continue;
                }

                // Format phone to E.164
                const formattedPhone = formatPhoneE164(customerPhone);
                if (!formattedPhone) {
                    continue;
                }

                // Check opt-out
                if (await isOptedOut(db, formattedPhone, contractorId)) {
                    stats.skipped++;
                    continue;
                }

                // Template variables
                const templateVars = {
                    customerName: job.customer?.name || job.customerName || 'Valued Customer',
                    serviceType: job.serviceType || job.title || 'service',
                    date: formatDate(scheduledTime),
                    time: formatTime(scheduledTime),
                    techName: job.assignedTechName || 'our technician',
                    companyName: contractor.businessName || contractor.companyName || 'Our team'
                };

                // Check 24-hour reminder window
                if (smsSettings.reminders?.send24hReminder &&
                    scheduledTime >= window24hStart &&
                    scheduledTime <= window24hEnd) {

                    const reminderType = 'reminder_24h';
                    if (await isReminderSent(db, jobId, reminderType)) {
                        continue;
                    }

                    try {
                        const template = smsSettings.templates?.reminder24h || DEFAULT_TEMPLATES.reminder24h;
                        const message = interpolateTemplate(template, templateVars);

                        const twilioMessage = await sendSMS(client, fromNumber, formattedPhone, message);

                        // Log the message
                        await db.collection('smsLogs').add({
                            direction: 'outbound',
                            to: formattedPhone,
                            message: message,
                            messageSid: twilioMessage.sid,
                            status: twilioMessage.status,
                            type: reminderType,
                            jobId: jobId,
                            contractorId: contractorId,
                            scheduledTime: scheduledTime.toISOString(),
                            createdAt: FieldValue.serverTimestamp()
                        });

                        stats.reminders24hSent++;
                        console.log(`[SMS Cron] 24h reminder sent for job ${jobId}`);
                    } catch (error) {
                        console.error(`[SMS Cron] Error sending 24h reminder for job ${jobId}:`, error);
                        stats.errors++;
                    }
                }

                // Check 2-hour reminder window
                if (smsSettings.reminders?.send2hReminder &&
                    scheduledTime >= window2hStart &&
                    scheduledTime <= window2hEnd) {

                    const reminderType = 'reminder_2h';
                    if (await isReminderSent(db, jobId, reminderType)) {
                        continue;
                    }

                    try {
                        const template = smsSettings.templates?.reminder2h || DEFAULT_TEMPLATES.reminder2h;
                        const message = interpolateTemplate(template, templateVars);

                        const twilioMessage = await sendSMS(client, fromNumber, formattedPhone, message);

                        // Log the message
                        await db.collection('smsLogs').add({
                            direction: 'outbound',
                            to: formattedPhone,
                            message: message,
                            messageSid: twilioMessage.sid,
                            status: twilioMessage.status,
                            type: reminderType,
                            jobId: jobId,
                            contractorId: contractorId,
                            scheduledTime: scheduledTime.toISOString(),
                            createdAt: FieldValue.serverTimestamp()
                        });

                        stats.reminders2hSent++;
                        console.log(`[SMS Cron] 2h reminder sent for job ${jobId}`);
                    } catch (error) {
                        console.error(`[SMS Cron] Error sending 2h reminder for job ${jobId}:`, error);
                        stats.errors++;
                    }
                }
            }
        }

        console.log('[SMS Cron] Complete:', stats);

        return res.status(200).json({
            success: true,
            stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[SMS Cron Error]', error);
        return res.status(500).json({
            error: error.message,
            stats
        });
    }
}

// Format phone to E.164
function formatPhoneE164(phone, defaultCountry = '1') {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 10) {
        return `+${defaultCountry}${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
    } else if (digits.length > 10) {
        return `+${digits}`;
    }

    return null;
}

// Export config for Vercel
export const config = {
    api: {
        bodyParser: true
    }
};
