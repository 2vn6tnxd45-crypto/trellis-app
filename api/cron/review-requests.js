// api/cron/review-requests.js
// ============================================
// REVIEW REQUEST CRON JOB
// ============================================
// Runs every hour to send review request emails
// for jobs that have been approved by homeowners
// after the contractor's configured delay period

import { Resend } from 'resend';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    yelp: '#d32323'
};

// ============================================
// EMAIL TEMPLATE (same as send-review-request.js)
// ============================================
function generateReviewRequestHtml({
    customerName,
    contractorName,
    companyName,
    jobTitle,
    completedDate,
    googleUrl,
    yelpUrl,
    customMessage,
    contractorPhone,
    contractorEmail
}) {
    const defaultMessage = `Thank you for choosing ${companyName || contractorName} for your recent ${jobTitle || 'service'}! We hope you're completely satisfied with our work.

If you have a moment, we'd really appreciate it if you could share your experience with a review. Your feedback helps us improve and helps other homeowners find quality service providers.`;

    const message = customMessage || defaultMessage;

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

                <!-- Header with Star Icon -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 40px;">⭐</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 28px; font-weight: 700;">
                        How Did We Do?
                    </h1>
                    <p style="color: ${BRAND.textLight}; font-size: 16px; margin-top: 8px;">
                        Your feedback means the world to us
                    </p>
                </div>

                <!-- Greeting & Message -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                    Hi ${customerName || 'there'},
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.7; margin-bottom: 24px; white-space: pre-wrap;">
                    ${message}
                </p>

                <!-- Job Reference Card -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">
                        Your Recent Service
                    </p>
                    <p style="color: ${BRAND.text}; font-size: 18px; font-weight: 600; margin: 0;">
                        ${jobTitle || 'Service Completed'}
                    </p>
                    ${completedDate ? `
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 8px 0 0;">
                        Completed ${completedDate}
                    </p>
                    ` : ''}
                </div>

                <!-- Primary CTA - Google Review -->
                ${googleUrl ? `
                <div style="text-align: center; margin: 32px 0 16px;">
                    <a href="${googleUrl}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 18px 48px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
                        ⭐ Leave a Google Review
                    </a>
                </div>
                <p style="text-align: center; color: ${BRAND.textLight}; font-size: 14px; margin-bottom: 24px;">
                    Takes less than 2 minutes
                </p>
                ` : ''}

                <!-- Secondary CTA - Yelp -->
                ${yelpUrl ? `
                <div style="text-align: center; margin: 16px 0 32px;">
                    <a href="${yelpUrl}" style="display: inline-block; background: ${BRAND.white}; color: ${BRAND.yelp}; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; border: 2px solid ${BRAND.yelp};">
                        Or review us on Yelp
                    </a>
                </div>
                ` : ''}

                <!-- Why Reviews Matter -->
                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 8px; font-size: 14px;">
                        💚 Why your review matters
                    </p>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; line-height: 1.6; margin: 0;">
                        Reviews help small businesses like ours grow and help other homeowners make informed decisions. We read every review and use your feedback to improve.
                    </p>
                </div>

                <!-- Contractor Contact -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0 0 12px;">
                        Questions or concerns? Reach out directly:
                    </p>
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0;">
                        ${companyName || contractorName}
                    </p>
                    ${contractorPhone ? `
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 4px 0 0;">
                        📞 ${contractorPhone}
                    </p>
                    ` : ''}
                    ${contractorEmail ? `
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 4px 0 0;">
                        ✉️ ${contractorEmail}
                    </p>
                    ` : ''}
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0;">
                    Sent via <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">Krib</a> • Your home, organized
                </p>
                <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
                    You received this email because you completed a service with ${companyName || contractorName}
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

    console.log('[ReviewRequests] Starting cron job...');

    const now = new Date();
    let sentCount = 0;
    let skippedCount = 0;
    let errors = [];

    try {
        const appId = process.env.FIREBASE_APP_ID || 'krib-app';

        // Query all completed jobs that haven't had review requests sent
        // Status must be 'completed' (fully approved by homeowner)
        const jobsRef = db.collection(`artifacts/${appId}/requests`);
        const completedJobsSnapshot = await jobsRef
            .where('status', '==', 'completed')
            .where('reviewRequestSent', '!=', true)
            .get();

        console.log(`[ReviewRequests] Found ${completedJobsSnapshot.size} completed jobs without review requests`);

        // Build a map of contractors to fetch them in batch
        const contractorIds = new Set();
        completedJobsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.contractorId) {
                contractorIds.add(data.contractorId);
            }
        });

        // Fetch all contractors
        const contractorsMap = new Map();
        for (const cId of contractorIds) {
            const cSnap = await db.collection('contractors').doc(cId).get();
            if (cSnap.exists) {
                contractorsMap.set(cId, cSnap.data());
            }
        }

        console.log(`[ReviewRequests] Loaded ${contractorsMap.size} contractors`);

        // Process each job
        for (const docSnap of completedJobsSnapshot.docs) {
            const job = docSnap.data();
            const jobId = docSnap.id;

            try {
                // Get contractor data
                const contractor = contractorsMap.get(job.contractorId);
                if (!contractor) {
                    console.log(`[ReviewRequests] Contractor not found for job ${jobId}`);
                    skippedCount++;
                    continue;
                }

                const reviewSettings = contractor.reviewSettings || {};

                // Skip if auto-request is disabled
                if (!reviewSettings.autoRequestReviews) {
                    skippedCount++;
                    continue;
                }

                // Skip if no Google URL configured
                if (!reviewSettings.googleBusinessUrl) {
                    skippedCount++;
                    continue;
                }

                // Check if enough time has passed since approval
                const approvedAt = job.completion?.approvedAt;
                if (!approvedAt) {
                    // Also check completedAt as fallback
                    const completedAt = job.completedAt || job.completion?.completedAt;
                    if (!completedAt) {
                        console.log(`[ReviewRequests] No approval date for job ${jobId}`);
                        skippedCount++;
                        continue;
                    }
                }

                const approvalDate = (approvedAt || job.completedAt)?.toDate
                    ? (approvedAt || job.completedAt).toDate()
                    : new Date(approvedAt || job.completedAt);

                const delayHours = reviewSettings.delayHours || 24;
                const delayMs = delayHours * 60 * 60 * 1000;
                const timeSinceApproval = now.getTime() - approvalDate.getTime();

                if (timeSinceApproval < delayMs) {
                    // Not enough time has passed
                    const hoursRemaining = Math.ceil((delayMs - timeSinceApproval) / (60 * 60 * 1000));
                    console.log(`[ReviewRequests] Job ${jobId}: ${hoursRemaining}h until review request`);
                    skippedCount++;
                    continue;
                }

                // Get customer email
                const customerEmail = job.customerEmail || job.customer?.email;
                if (!customerEmail) {
                    console.log(`[ReviewRequests] No customer email for job ${jobId}`);
                    skippedCount++;
                    continue;
                }

                // Format completed date
                const completedDate = approvalDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });

                // Send the email
                const { data, error } = await resend.emails.send({
                    from: 'Krib <hello@mykrib.app>',
                    to: [customerEmail],
                    subject: `⭐ How was your experience with ${contractor.profile?.companyName || contractor.profile?.displayName || 'us'}?`,
                    html: generateReviewRequestHtml({
                        customerName: job.customerName || job.customer?.name,
                        contractorName: contractor.profile?.displayName,
                        companyName: contractor.profile?.companyName,
                        jobTitle: job.title || job.description,
                        completedDate,
                        googleUrl: reviewSettings.googleBusinessUrl,
                        yelpUrl: reviewSettings.yelpUrl,
                        customMessage: reviewSettings.customMessage,
                        contractorPhone: contractor.profile?.phone,
                        contractorEmail: contractor.profile?.email
                    })
                });

                if (error) {
                    console.error(`[ReviewRequests] Resend error for job ${jobId}:`, error);
                    errors.push({ jobId, error: error.message });
                    continue;
                }

                // Mark job as review request sent
                await docSnap.ref.update({
                    reviewRequestSent: true,
                    reviewRequestSentAt: Timestamp.now()
                });

                // Increment contractor stats
                await db.collection('contractors').doc(job.contractorId).update({
                    'stats.reviewRequestsSent': (contractor.stats?.reviewRequestsSent || 0) + 1
                });

                sentCount++;
                console.log(`[ReviewRequests] Sent review request for job ${jobId} to ${customerEmail}`);

            } catch (jobError) {
                console.error(`[ReviewRequests] Error processing job ${jobId}:`, jobError);
                errors.push({ jobId, error: jobError.message });
            }
        }

        console.log(`[ReviewRequests] Complete. Sent: ${sentCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`);

        return res.status(200).json({
            success: true,
            sent: sentCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error('[ReviewRequests] Fatal error:', err);
        return res.status(500).json({ error: err.message });
    }
}
