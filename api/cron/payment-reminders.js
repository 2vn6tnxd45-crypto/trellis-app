// api/cron/payment-reminders.js
// ============================================
// AUTOMATED PAYMENT REMINDER CRON JOB
// ============================================
// Runs daily to send payment reminders for:
// - Jobs with unpaid balances (after completion accepted)
// - Invoices approaching due date
// - Overdue invoices

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors for email
const BRAND = {
    primary: '#10b981',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    amber: '#f59e0b',
    amberBg: '#fffbeb',
    red: '#ef4444',
    redBg: '#fef2f2'
};

function generatePaymentReminderHtml({
    customerName,
    contractorName,
    jobTitle,
    jobNumber,
    balanceDue,
    dueDate,
    isOverdue,
    daysOverdue,
    paymentLink
}) {
    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(balanceDue || 0);

    const headerColor = isOverdue ? BRAND.red : BRAND.amber;
    const headerBg = isOverdue ? BRAND.redBg : BRAND.amberBg;
    const borderColor = isOverdue ? '#fecaca' : '#fcd34d';
    const headerEmoji = isOverdue ? '⚠️' : '💵';
    const headerText = isOverdue ? 'Payment Overdue' : 'Payment Reminder';

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
                    <div style="background: ${headerBg}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border: 3px solid ${headerColor};">
                        <span style="font-size: 40px;">${headerEmoji}</span>
                    </div>
                    <h1 style="color: ${headerColor}; margin: 0; font-size: 26px; font-weight: 700;">
                        ${headerText}
                    </h1>
                </div>

                <!-- Main Message -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                    Hi ${customerName || 'there'},<br>
                    ${isOverdue
                        ? `Your payment for services from <strong>${contractorName || 'your contractor'}</strong> is overdue.`
                        : `This is a friendly reminder about your upcoming payment to <strong>${contractorName || 'your contractor'}</strong>.`
                    }
                </p>

                <!-- Payment Summary Box -->
                <div style="background: ${headerBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid ${borderColor};">
                    <div style="text-align: center;">
                        ${jobNumber ? `<p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Job #${jobNumber}</p>` : ''}
                        <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 4px 0 0; font-weight: 600;">
                            ${jobTitle || 'Service'}
                        </h2>
                    </div>

                    <div style="text-align: center; padding: 16px 0 0; margin-top: 16px; border-top: 1px solid ${borderColor};">
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0;">Balance Due</p>
                        <p style="color: ${headerColor}; font-size: 32px; font-weight: 700; margin: 4px 0 0;">${formattedBalance}</p>
                        ${dueDate ? `
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 8px 0 0;">
                            ${isOverdue
                                ? `Was due on ${dueDate} (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue)`
                                : `Due by ${dueDate}`
                            }
                        </p>
                        ` : ''}
                    </div>
                </div>

                ${isOverdue ? `
                <!-- Overdue Warning -->
                <div style="background: ${BRAND.redBg}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fecaca;">
                    <p style="color: #991b1b; font-size: 14px; margin: 0; text-align: center;">
                        <strong>Please pay as soon as possible</strong> to avoid any service interruptions or late fees.
                    </p>
                </div>
                ` : `
                <!-- Friendly Reminder -->
                <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <p style="color: #1e40af; font-size: 14px; margin: 0; text-align: center;">
                        Pay on time to maintain your good standing with ${contractorName || 'your contractor'}!
                    </p>
                </div>
                `}

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${paymentLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Pay Now →
                    </a>
                </div>

                <p style="color: ${BRAND.textLight}; font-size: 13px; text-align: center; margin: 16px 0;">
                    If you've already made this payment, please disregard this reminder.
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

// This would typically connect to Firebase to fetch pending payments
// For now, it's a template that can be called by the scheduler
export default async function handler(req, res) {
    // Verify cron secret for security
    const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
    if (cronSecret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Allow manual trigger with specific job data for testing
    if (req.method === 'POST' && req.body.manualTrigger) {
        const {
            customerEmail,
            customerName,
            contractorName,
            jobTitle,
            jobNumber,
            balanceDue,
            dueDate,
            isOverdue,
            daysOverdue,
            paymentLink
        } = req.body;

        if (!customerEmail) {
            return res.status(400).json({ error: 'Customer email is required' });
        }

        try {
            const { data, error } = await resend.emails.send({
                from: 'Krib <hello@mykrib.app>',
                to: [customerEmail],
                subject: isOverdue
                    ? `⚠️ Payment Overdue: ${jobTitle || 'Your service'}`
                    : `💵 Payment Reminder: ${jobTitle || 'Your service'}`,
                html: generatePaymentReminderHtml({
                    customerName,
                    contractorName,
                    jobTitle,
                    jobNumber,
                    balanceDue,
                    dueDate,
                    isOverdue: isOverdue || false,
                    daysOverdue: daysOverdue || 0,
                    paymentLink: paymentLink || 'https://mykrib.app/app'
                }),
            });

            if (error) {
                console.error('[PaymentReminder] Error:', error);
                return res.status(500).json({ error: 'Failed to send reminder' });
            }

            return res.status(200).json({ success: true, id: data.id });
        } catch (err) {
            console.error('[PaymentReminder] Exception:', err);
            return res.status(500).json({ error: 'Failed to send reminder' });
        }
    }

    // TODO: Automated batch processing
    // This would query Firebase for:
    // 1. Completed jobs with balance_due > 0 and no recent reminder sent
    // 2. Invoices with dueDate approaching (3 days, 1 day)
    // 3. Overdue invoices (1 day, 7 days overdue)

    return res.status(200).json({
        message: 'Payment reminder cron endpoint ready',
        note: 'Use POST with manualTrigger: true for manual reminders'
    });
}

// Export the email generator for use in other services
export { generatePaymentReminderHtml };
