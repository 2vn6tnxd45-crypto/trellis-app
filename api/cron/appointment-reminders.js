// api/cron/appointment-reminders.js
// ============================================
// APPOINTMENT REMINDERS CRON JOB
// ============================================
// Runs hourly to send day-before and morning-of reminders
// Schedule: Every hour at minute 0

import { Resend } from 'resend';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = getFirestore();
const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors
const BRAND = {
    primary: '#10b981',
    primaryDark: '#059669',
    blue: '#3b82f6',
    amber: '#f59e0b',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff'
};

// Helper to format date
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

// Helper to format time
const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

// Generate Google Calendar URL
const generateGoogleCalendarUrl = ({ title, description, location, start, end }) => {
    const formatGoogleDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title || 'Appointment',
        dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
        details: description || '',
        location: location || '',
        sf: 'true',
        output: 'xml'
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// ============================================
// DAY-BEFORE REMINDER EMAIL
// ============================================
function generateDayBeforeHtml({
    customerName,
    contractorName,
    contractorPhone,
    jobTitle,
    scheduledDate,
    scheduledTime,
    serviceAddress,
    jobLink,
    calendarUrl
}) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

            <!-- Main Card -->
            <div style="background: ${BRAND.white}; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">

                <!-- Header -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="background: #fef3c7; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">📅</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        Reminder: Appointment Tomorrow
                    </h1>
                    <p style="color: ${BRAND.amber}; font-size: 14px; margin-top: 8px; font-weight: 600;">
                        Don't forget your scheduled service!
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Hi ${customerName || 'there'},
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Just a friendly reminder that <strong style="color: ${BRAND.text};">${contractorName}</strong> is scheduled to arrive <strong style="color: ${BRAND.text};">tomorrow</strong>.
                </p>

                <!-- Appointment Card -->
                <div style="background: #fffbeb; border-radius: 16px; padding: 24px; margin: 24px 0; border: 2px solid ${BRAND.amber};">
                    <div style="text-align: center;">
                        <p style="color: ${BRAND.amber}; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px; font-weight: 600;">
                            Tomorrow
                        </p>
                        <p style="color: ${BRAND.text}; font-size: 22px; font-weight: 700; margin: 0;">
                            ${formatDate(scheduledDate)}
                        </p>
                        <p style="color: ${BRAND.amber}; font-size: 18px; font-weight: 600; margin: 8px 0 0;">
                            ${scheduledTime || formatTime(scheduledDate)}
                        </p>
                    </div>
                </div>

                <!-- Job Details -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px; width: 100px;">Service</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 500;">${jobTitle || 'Service Appointment'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px;">Contractor</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 500;">${contractorName}</td>
                        </tr>
                        ${serviceAddress ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px; vertical-align: top;">Location</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px;">${serviceAddress}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>

                <!-- Preparation Tips -->
                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        ✅ Preparation Checklist
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        <li>Ensure clear access to the work area</li>
                        <li>Secure pets if needed</li>
                        <li>Have payment method ready if applicable</li>
                        <li>Note any specific concerns to discuss</li>
                    </ul>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${jobLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        View Appointment Details
                    </a>
                </div>

                <!-- Calendar Link -->
                ${calendarUrl ? `
                <div style="text-align: center; margin: 16px 0;">
                    <a href="${calendarUrl}" target="_blank" style="color: ${BRAND.blue}; text-decoration: none; font-size: 14px;">
                        📅 Add to Calendar
                    </a>
                </div>
                ` : ''}

                <!-- Contact -->
                ${contractorPhone ? `
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin-top: 24px;">
                    Questions? Contact <strong style="color: ${BRAND.text};">${contractorName}</strong> at
                    <a href="tel:${contractorPhone}" style="color: ${BRAND.primary}; text-decoration: none;">${contractorPhone}</a>
                </p>
                ` : ''}
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0;">
                    Powered by <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">Krib</a> • Your home, organized
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// ============================================
// MORNING-OF REMINDER EMAIL
// ============================================
function generateMorningOfHtml({
    customerName,
    contractorName,
    contractorPhone,
    jobTitle,
    scheduledTime,
    serviceAddress,
    jobLink
}) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

            <!-- Main Card -->
            <div style="background: ${BRAND.white}; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">

                <!-- Header -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="background: #dcfce7; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">🔔</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        Your Appointment is Today!
                    </h1>
                    <p style="color: ${BRAND.primary}; font-size: 16px; margin-top: 8px; font-weight: 600;">
                        ${scheduledTime || 'Coming up soon'}
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Good morning, ${customerName || 'there'}!
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Just a quick reminder that <strong style="color: ${BRAND.text};">${contractorName}</strong> is scheduled to arrive <strong style="color: ${BRAND.primary};">today</strong>.
                </p>

                <!-- Today Banner -->
                <div style="background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark}); border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
                    <p style="color: rgba(255,255,255,0.9); font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px; font-weight: 600;">
                        Today's Appointment
                    </p>
                    <p style="color: white; font-size: 28px; font-weight: 700; margin: 0;">
                        ${scheduledTime || 'Time TBD'}
                    </p>
                    <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 8px 0 0;">
                        ${jobTitle || 'Service Appointment'}
                    </p>
                </div>

                <!-- Quick Info -->
                <div style="display: flex; gap: 16px; margin: 24px 0;">
                    <div style="flex: 1; background: ${BRAND.background}; border-radius: 12px; padding: 16px; text-align: center;">
                        <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Contractor</p>
                        <p style="color: ${BRAND.text}; font-size: 14px; font-weight: 600; margin: 0;">${contractorName}</p>
                    </div>
                    ${contractorPhone ? `
                    <div style="flex: 1; background: ${BRAND.background}; border-radius: 12px; padding: 16px; text-align: center;">
                        <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Call</p>
                        <a href="tel:${contractorPhone}" style="color: ${BRAND.primary}; font-size: 14px; font-weight: 600; text-decoration: none;">${contractorPhone}</a>
                    </div>
                    ` : ''}
                </div>

                ${serviceAddress ? `
                <!-- Location -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 16px; margin: 24px 0;">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Service Location</p>
                    <p style="color: ${BRAND.text}; font-size: 14px; margin: 0;">${serviceAddress}</p>
                </div>
                ` : ''}

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${jobLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        View Job Details
                    </a>
                </div>

                <!-- Tip -->
                <div style="background: #fef3c7; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; border: 1px solid #fde68a;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                        💡 Tip: Keep your phone nearby in case the contractor needs to reach you!
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0;">
                    Powered by <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">Krib</a> • Your home, organized
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
    // Verify cron request
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[AppointmentReminders] Starting cron job...');

    const now = new Date();
    const currentHour = now.getHours();

    // Calculate tomorrow's date range (for day-before reminders)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Calculate today's date range (for morning-of reminders)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    let dayBeforeCount = 0;
    let morningOfCount = 0;
    let errors = [];

    try {
        // ====================================
        // DAY-BEFORE REMINDERS (Run at 6 PM)
        // ====================================
        if (currentHour === 18) {
            console.log('[AppointmentReminders] Sending day-before reminders...');

            // Query jobs scheduled for tomorrow
            const tomorrowJobsSnapshot = await db.collectionGroup('jobs')
                .where('status', '==', 'scheduled')
                .where('scheduledTime', '>=', tomorrow.toISOString())
                .where('scheduledTime', '<=', tomorrowEnd.toISOString())
                .get();

            console.log(`[AppointmentReminders] Found ${tomorrowJobsSnapshot.size} jobs for tomorrow`);

            for (const doc of tomorrowJobsSnapshot.docs) {
                const job = doc.data();
                const jobId = doc.id;

                // Skip if already sent
                if (job.reminders?.dayBeforeSent) {
                    console.log(`[AppointmentReminders] Day-before already sent for job ${jobId}`);
                    continue;
                }

                // Get customer email
                const customerEmail = job.customer?.email || job.customerEmail;
                if (!customerEmail) {
                    console.log(`[AppointmentReminders] No customer email for job ${jobId}`);
                    continue;
                }

                // Check if customer has reminders enabled (default: true)
                // We'd check their profile preferences here if available

                try {
                    const scheduledDate = new Date(job.scheduledTime);
                    const endDate = job.scheduledEndTime
                        ? new Date(job.scheduledEndTime)
                        : new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000);

                    const calendarUrl = generateGoogleCalendarUrl({
                        title: `${job.title || 'Service'} - ${job.contractorName || 'Contractor'}`,
                        description: `Service: ${job.title || 'Home Service'}`,
                        location: job.serviceAddress || job.customer?.address || '',
                        start: scheduledDate,
                        end: endDate
                    });

                    await resend.emails.send({
                        from: 'Krib <hello@mykrib.app>',
                        to: [customerEmail],
                        subject: `📅 Reminder: ${job.contractorName || 'Contractor'} arriving tomorrow`,
                        html: generateDayBeforeHtml({
                            customerName: job.customer?.name || job.customerName,
                            contractorName: job.contractorName,
                            contractorPhone: job.contractorPhone,
                            jobTitle: job.title || job.description,
                            scheduledDate: job.scheduledTime,
                            scheduledTime: formatTime(job.scheduledTime),
                            serviceAddress: job.serviceAddress || job.customer?.address,
                            jobLink: `https://mykrib.app/dashboard?job=${jobId}`,
                            calendarUrl
                        })
                    });

                    // Mark as sent
                    await doc.ref.update({
                        'reminders.dayBeforeSent': new Date().toISOString()
                    });

                    dayBeforeCount++;
                    console.log(`[AppointmentReminders] Day-before sent to ${customerEmail} for job ${jobId}`);
                } catch (err) {
                    console.error(`[AppointmentReminders] Error sending day-before for job ${jobId}:`, err);
                    errors.push({ jobId, type: 'dayBefore', error: err.message });
                }
            }
        }

        // ====================================
        // MORNING-OF REMINDERS (Run at 7 AM)
        // ====================================
        if (currentHour === 7) {
            console.log('[AppointmentReminders] Sending morning-of reminders...');

            // Query jobs scheduled for today
            const todayJobsSnapshot = await db.collectionGroup('jobs')
                .where('status', '==', 'scheduled')
                .where('scheduledTime', '>=', todayStart.toISOString())
                .where('scheduledTime', '<=', todayEnd.toISOString())
                .get();

            console.log(`[AppointmentReminders] Found ${todayJobsSnapshot.size} jobs for today`);

            for (const doc of todayJobsSnapshot.docs) {
                const job = doc.data();
                const jobId = doc.id;

                // Skip if already sent
                if (job.reminders?.morningOfSent) {
                    console.log(`[AppointmentReminders] Morning-of already sent for job ${jobId}`);
                    continue;
                }

                // Get customer email
                const customerEmail = job.customer?.email || job.customerEmail;
                if (!customerEmail) {
                    console.log(`[AppointmentReminders] No customer email for job ${jobId}`);
                    continue;
                }

                try {
                    await resend.emails.send({
                        from: 'Krib <hello@mykrib.app>',
                        to: [customerEmail],
                        subject: `🔔 Today: ${job.contractorName || 'Contractor'} arriving at ${formatTime(job.scheduledTime)}`,
                        html: generateMorningOfHtml({
                            customerName: job.customer?.name || job.customerName,
                            contractorName: job.contractorName,
                            contractorPhone: job.contractorPhone,
                            jobTitle: job.title || job.description,
                            scheduledTime: formatTime(job.scheduledTime),
                            serviceAddress: job.serviceAddress || job.customer?.address,
                            jobLink: `https://mykrib.app/dashboard?job=${jobId}`
                        })
                    });

                    // Mark as sent
                    await doc.ref.update({
                        'reminders.morningOfSent': new Date().toISOString()
                    });

                    morningOfCount++;
                    console.log(`[AppointmentReminders] Morning-of sent to ${customerEmail} for job ${jobId}`);
                } catch (err) {
                    console.error(`[AppointmentReminders] Error sending morning-of for job ${jobId}:`, err);
                    errors.push({ jobId, type: 'morningOf', error: err.message });
                }
            }
        }

        console.log(`[AppointmentReminders] Complete. Day-before: ${dayBeforeCount}, Morning-of: ${morningOfCount}, Errors: ${errors.length}`);

        return res.status(200).json({
            success: true,
            dayBeforeReminders: dayBeforeCount,
            morningOfReminders: morningOfCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error('[AppointmentReminders] Fatal error:', err);
        return res.status(500).json({ error: err.message });
    }
}
