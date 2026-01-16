// api/cron/rating-reminders.js
// ============================================
// RATING REMINDER CRON JOB
// ============================================
// Sends reminder emails for unrated completed jobs
// Runs daily at 10 AM

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';

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

export default async function handler(req, res) {
    // Verify this is a cron job request
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const results = {
            processed: 0,
            sent: 0,
            skipped: 0,
            errors: []
        };

        // Find jobs completed 3 days ago (within a 24-hour window)
        const now = new Date();
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const fourDaysAgo = new Date(now);
        fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

        const threeDaysAgoTimestamp = Timestamp.fromDate(threeDaysAgo);
        const fourDaysAgoTimestamp = Timestamp.fromDate(fourDaysAgo);

        // Query for completed jobs that:
        // - Were completed 3-4 days ago
        // - Haven't been rated by homeowner
        // - Haven't received a rating reminder
        const jobsSnapshot = await db.collection('apps/krib/requests')
            .where('status', '==', 'completed')
            .where('completedAt', '<=', threeDaysAgoTimestamp)
            .where('completedAt', '>', fourDaysAgoTimestamp)
            .get();

        console.log(`[RatingReminders] Found ${jobsSnapshot.size} jobs completed 3 days ago`);

        for (const jobDoc of jobsSnapshot.docs) {
            results.processed++;
            const job = { id: jobDoc.id, ...jobDoc.data() };

            try {
                // Skip if already rated
                if (job.ratings?.homeownerToContractor) {
                    console.log(`[RatingReminders] Job ${job.id}: Already rated, skipping`);
                    results.skipped++;
                    continue;
                }

                // Skip if reminder already sent
                if (job.ratingReminderSent) {
                    console.log(`[RatingReminders] Job ${job.id}: Reminder already sent, skipping`);
                    results.skipped++;
                    continue;
                }

                // Skip if no customer email
                const customerEmail = job.customer?.email || job.customerEmail;
                if (!customerEmail) {
                    console.log(`[RatingReminders] Job ${job.id}: No customer email, skipping`);
                    results.skipped++;
                    continue;
                }

                // Get contractor name
                const contractorName = job.contractorName
                    || job.contractor?.companyName
                    || 'your contractor';

                // Get job title
                const jobTitle = job.title || job.description || 'your service';

                // Send reminder email
                const emailResult = await resend.emails.send({
                    from: 'Trellis <notifications@trellis-app.com>',
                    to: customerEmail,
                    subject: `How was your experience with ${contractorName}?`,
                    html: generateRatingReminderEmail({
                        customerName: job.customer?.name || job.customerName || 'there',
                        contractorName,
                        jobTitle,
                        jobId: job.id
                    })
                });

                console.log(`[RatingReminders] Job ${job.id}: Email sent to ${customerEmail}`);

                // Mark reminder as sent
                await jobDoc.ref.update({
                    ratingReminderSent: true,
                    ratingReminderSentAt: Timestamp.now()
                });

                results.sent++;

            } catch (error) {
                console.error(`[RatingReminders] Error processing job ${job.id}:`, error);
                results.errors.push({
                    jobId: job.id,
                    error: error.message
                });
            }
        }

        console.log(`[RatingReminders] Complete:`, results);

        return res.status(200).json({
            success: true,
            message: 'Rating reminders processed',
            ...results
        });

    } catch (error) {
        console.error('[RatingReminders] Fatal error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Generate rating reminder email HTML
 */
function generateRatingReminderEmail({ customerName, contractorName, jobTitle, jobId }) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trellis-app.com';
    const rateUrl = `${appUrl}/dashboard?rate=${jobId}`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rate Your Experience</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 32px 24px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                                How was your experience?
                            </h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 24px;">
                            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                                Hi ${customerName}!
                            </p>

                            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                                Your <strong>${jobTitle}</strong> with <strong>${contractorName}</strong> was completed a few days ago. We'd love to hear how it went!
                            </p>

                            <!-- Star Preview -->
                            <div style="text-align: center; padding: 24px 0; background-color: #f8fafc; border-radius: 12px; margin-bottom: 24px;">
                                <p style="color: #64748b; font-size: 14px; margin: 0 0 12px;">
                                    Rate your experience:
                                </p>
                                <div style="font-size: 32px; letter-spacing: 4px;">
                                    ★ ★ ★ ★ ★
                                </div>
                            </div>

                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${rateUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px;">
                                            Leave a Review
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                                Your feedback helps other homeowners find great contractors.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                                You're receiving this because you completed a job on Trellis.
                                <br>
                                <a href="${appUrl}/settings/notifications" style="color: #64748b; text-decoration: underline;">
                                    Manage email preferences
                                </a>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}
