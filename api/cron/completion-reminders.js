// api/cron/completion-reminders.js
// ============================================
// COMPLETION REMINDER CRON JOB
// ============================================
// Runs daily at 9 AM to send Day 3 and Day 6 reminders
// for jobs pending homeowner review

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
    amber: '#f59e0b',
    red: '#ef4444',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff'
};

// ============================================
// EMAIL TEMPLATES
// ============================================

// Day 3 Reminder (4 days remaining)
function generateDay3ReminderHtml({
    customerName,
    contractorName,
    jobTitle,
    itemCount,
    itemPreviews,
    daysRemaining,
    jobLink
}) {
    const itemsHtml = itemPreviews && itemPreviews.length > 0
        ? itemPreviews.map(item => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                <div style="width: 8px; height: 8px; background: ${BRAND.primary}; border-radius: 50%;"></div>
                <span style="color: ${BRAND.text}; font-size: 14px;">
                    ${item.item || item.description || 'Item'}
                    ${item.brand ? `<span style="color: ${BRAND.textLight};"> (${item.brand})</span>` : ''}
                </span>
            </div>
        `).join('')
        : '';

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
                        <span style="font-size: 28px;">📋</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        Reminder: Review Your Completed Job
                    </h1>
                    <p style="color: ${BRAND.amber}; font-size: 14px; margin-top: 8px; font-weight: 600;">
                        ${daysRemaining} days left to review
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                    Hi ${customerName || 'there'},
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    <strong style="color: ${BRAND.text};">${contractorName}</strong> submitted completion details for your job. Please review to ensure everything looks correct before items are added to your home inventory.
                </p>

                <!-- Job Card -->
                <div style="background: #fffbeb; border-radius: 16px; padding: 20px; margin: 24px 0; border: 2px solid ${BRAND.amber};">
                    <p style="color: ${BRAND.amber}; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px; font-weight: 600;">
                        Awaiting Your Review
                    </p>
                    <p style="color: ${BRAND.text}; font-size: 20px; font-weight: 700; margin: 0;">
                        ${jobTitle || 'Service Job'}
                    </p>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 8px 0 0;">
                        by ${contractorName}
                    </p>
                </div>

                <!-- Items Preview -->
                ${itemCount > 0 ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        📦 ${itemCount} item${itemCount !== 1 ? 's' : ''} ready to add to your home record
                    </p>
                    ${itemsHtml}
                    ${itemCount > 3 ? `
                    <p style="color: ${BRAND.textLight}; font-size: 13px; margin-top: 12px;">
                        +${itemCount - 3} more item${itemCount - 3 !== 1 ? 's' : ''}
                    </p>
                    ` : ''}
                </div>
                ` : ''}

                <!-- Why Review Matters -->
                <div style="background: #f0fdf4; border-radius: 12px; padding: 16px 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 8px; font-size: 14px;">
                        Why review matters
                    </p>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; line-height: 1.6; margin: 0;">
                        Reviewing ensures all details are correct before items become part of your permanent home inventory. You can also request revisions if something isn't right.
                    </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${jobLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Review Now
                    </a>
                </div>

                <!-- Auto-close note -->
                <p style="color: ${BRAND.textLight}; font-size: 13px; text-align: center; margin-top: 24px;">
                    If you don't review within ${daysRemaining} days, items will be automatically added to your home inventory.
                </p>
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

// Day 6 Reminder (1 day remaining - URGENT)
function generateDay6ReminderHtml({
    customerName,
    contractorName,
    jobTitle,
    itemCount,
    itemPreviews,
    jobLink
}) {
    const itemsHtml = itemPreviews && itemPreviews.length > 0
        ? itemPreviews.map(item => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #fecaca;">
                <div style="width: 8px; height: 8px; background: ${BRAND.red}; border-radius: 50%;"></div>
                <span style="color: ${BRAND.text}; font-size: 14px;">
                    ${item.item || item.description || 'Item'}
                    ${item.brand ? `<span style="color: ${BRAND.textLight};"> (${item.brand})</span>` : ''}
                </span>
            </div>
        `).join('')
        : '';

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
            <div style="background: ${BRAND.white}; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 2px solid ${BRAND.red};">

                <!-- URGENT Header -->
                <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center; border: 1px solid #fecaca;">
                    <p style="color: ${BRAND.red}; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 700;">
                        ⚠️ Final Reminder - Action Required
                    </p>
                </div>

                <!-- Header -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="background: #fee2e2; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">⏰</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        Last Chance to Review
                    </h1>
                    <p style="color: ${BRAND.red}; font-size: 16px; margin-top: 8px; font-weight: 700;">
                        Auto-approval tomorrow!
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                    Hi ${customerName || 'there'},
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    This is your <strong style="color: ${BRAND.red};">final reminder</strong> to review your completed job from <strong style="color: ${BRAND.text};">${contractorName}</strong>.
                </p>

                <!-- Job Card -->
                <div style="background: #fef2f2; border-radius: 16px; padding: 20px; margin: 24px 0; border: 2px solid ${BRAND.red};">
                    <p style="color: ${BRAND.red}; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px; font-weight: 600;">
                        Review Required Today
                    </p>
                    <p style="color: ${BRAND.text}; font-size: 20px; font-weight: 700; margin: 0;">
                        ${jobTitle || 'Service Job'}
                    </p>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 8px 0 0;">
                        by ${contractorName}
                    </p>
                </div>

                <!-- Items Preview -->
                ${itemCount > 0 ? `
                <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fecaca;">
                    <p style="color: ${BRAND.red}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        📦 ${itemCount} item${itemCount !== 1 ? 's' : ''} will be automatically added tomorrow
                    </p>
                    ${itemsHtml}
                </div>
                ` : ''}

                <!-- Warning Box -->
                <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fde68a;">
                    <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;">
                        <strong>What happens if you don't review:</strong><br>
                        Items will be automatically added to your home inventory tomorrow. You can still edit them later, but it's easier to review now.
                    </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${jobLink}" style="display: inline-block; background: ${BRAND.red}; color: white; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 18px;">
                        Review Now - Last Chance
                    </a>
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

    console.log('[CompletionReminders] Starting cron job...');

    const now = new Date();
    let day3Count = 0;
    let day6Count = 0;
    let errors = [];

    try {
        // Query all jobs with pending_completion status
        const jobsSnapshot = await db.collectionGroup('jobs')
            .where('status', '==', 'pending_completion')
            .get();

        // Also check the requests collection (main job storage)
        const requestsRef = db.collection(`artifacts/${process.env.FIREBASE_APP_ID || 'krib-app'}/requests`);
        const requestsSnapshot = await requestsRef
            .where('status', '==', 'pending_completion')
            .get();

        // Combine results
        const allDocs = [...jobsSnapshot.docs, ...requestsSnapshot.docs];
        console.log(`[CompletionReminders] Found ${allDocs.length} pending completion jobs`);

        for (const docSnap of allDocs) {
            const job = docSnap.data();
            const jobId = docSnap.id;
            const completion = job.completion || {};

            // Skip if no autoCloseAt
            if (!completion.autoCloseAt) {
                console.log(`[CompletionReminders] No autoCloseAt for job ${jobId}`);
                continue;
            }

            // Calculate days remaining
            const autoCloseDate = completion.autoCloseAt.toDate
                ? completion.autoCloseAt.toDate()
                : new Date(completion.autoCloseAt);
            const daysRemaining = Math.ceil((autoCloseDate - now) / (1000 * 60 * 60 * 24));

            // Get customer email
            const customerEmail = job.customerEmail || job.customer?.email;
            if (!customerEmail) {
                console.log(`[CompletionReminders] No customer email for job ${jobId}`);
                continue;
            }

            const customerName = job.customerName || job.customer?.name || 'there';
            const contractorName = job.contractorName || job.contractor?.name || 'Your Contractor';
            const jobTitle = job.title || job.description || 'Service Job';
            const itemsToImport = completion.itemsToImport || [];
            const itemCount = itemsToImport.length;
            const itemPreviews = itemsToImport.slice(0, 3);
            const jobLink = `https://mykrib.app/app?jobId=${jobId}`;

            // Day 3 reminder (4 days remaining)
            if (daysRemaining === 4 && !completion.reminders?.day3Sent) {
                try {
                    await resend.emails.send({
                        from: 'Krib <hello@mykrib.app>',
                        to: [customerEmail],
                        subject: `📋 Reminder: Review your completed job from ${contractorName}`,
                        html: generateDay3ReminderHtml({
                            customerName,
                            contractorName,
                            jobTitle,
                            itemCount,
                            itemPreviews,
                            daysRemaining,
                            jobLink
                        })
                    });

                    // Mark as sent
                    await docSnap.ref.update({
                        'completion.reminders.day3Sent': Timestamp.now()
                    });

                    day3Count++;
                    console.log(`[CompletionReminders] Day 3 reminder sent for job ${jobId}`);
                } catch (err) {
                    console.error(`[CompletionReminders] Error sending Day 3 for job ${jobId}:`, err);
                    errors.push({ jobId, type: 'day3', error: err.message });
                }
            }

            // Day 6 reminder (1 day remaining)
            if (daysRemaining === 1 && !completion.reminders?.day6Sent) {
                try {
                    await resend.emails.send({
                        from: 'Krib <hello@mykrib.app>',
                        to: [customerEmail],
                        subject: `⚠️ Action Required: Final day to review ${jobTitle}`,
                        html: generateDay6ReminderHtml({
                            customerName,
                            contractorName,
                            jobTitle,
                            itemCount,
                            itemPreviews,
                            jobLink
                        })
                    });

                    // Mark as sent
                    await docSnap.ref.update({
                        'completion.reminders.day6Sent': Timestamp.now()
                    });

                    day6Count++;
                    console.log(`[CompletionReminders] Day 6 reminder sent for job ${jobId}`);
                } catch (err) {
                    console.error(`[CompletionReminders] Error sending Day 6 for job ${jobId}:`, err);
                    errors.push({ jobId, type: 'day6', error: err.message });
                }
            }
        }

        console.log(`[CompletionReminders] Complete. Day 3: ${day3Count}, Day 6: ${day6Count}, Errors: ${errors.length}`);

        return res.status(200).json({
            success: true,
            day3Reminders: day3Count,
            day6Reminders: day6Count,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error('[CompletionReminders] Fatal error:', err);
        return res.status(500).json({ error: err.message });
    }
}
