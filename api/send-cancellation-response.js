// api/send-cancellation-response.js
// ============================================
// CANCELLATION RESPONSE NOTIFICATION API
// ============================================
// Notifies homeowner when contractor approves or denies their cancellation request
// Includes refund information if approved

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors
const BRAND = {
    primary: '#10b981',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    success: '#22c55e',
    successBg: '#f0fdf4',
    red: '#ef4444',
    redBg: '#fef2f2',
    amber: '#f59e0b',
    amberBg: '#fffbeb'
};

function generateCancellationResponseHtml({
    customerName,
    contractorName,
    jobTitle,
    jobNumber,
    approved,
    refundAmount,
    contractorMessage,
    dashboardLink
}) {
    const formattedRefund = refundAmount > 0 ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(refundAmount) : null;

    const headerEmoji = approved ? '✅' : '❌';
    const headerText = approved ? 'Cancellation Approved' : 'Cancellation Denied';
    const headerColor = approved ? BRAND.success : BRAND.red;
    const headerBg = approved ? BRAND.successBg : BRAND.redBg;
    const borderColor = approved ? '#bbf7d0' : '#fecaca';

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
                    ${approved
                        ? `<strong>${contractorName || 'Your contractor'}</strong> has approved your cancellation request.`
                        : `<strong>${contractorName || 'Your contractor'}</strong> was unable to approve your cancellation request at this time.`
                    }
                </p>

                <!-- Job Summary Box -->
                <div style="background: ${headerBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid ${borderColor};">
                    <div style="text-align: center;">
                        ${jobNumber ? `<p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Job #${jobNumber}</p>` : ''}
                        <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 4px 0 0; font-weight: 600;">
                            ${jobTitle || 'Service Job'}
                        </h2>
                        <p style="color: ${headerColor}; font-size: 14px; margin: 8px 0 0; font-weight: 600;">
                            ${approved ? '🗑️ Cancelled' : '📋 Still Active'}
                        </p>
                    </div>
                </div>

                ${approved && formattedRefund ? `
                <!-- Refund Information -->
                <div style="background: ${BRAND.successBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <div style="text-align: center;">
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0;">Refund Amount</p>
                        <p style="color: ${BRAND.success}; font-size: 32px; font-weight: 700; margin: 8px 0 0;">${formattedRefund}</p>
                        <p style="color: ${BRAND.textLight}; font-size: 13px; margin: 12px 0 0;">
                            💳 This refund will be processed to your original payment method within 5-10 business days.
                        </p>
                    </div>
                </div>
                ` : ''}

                ${approved && refundAmount === 0 ? `
                <!-- No Refund Notice -->
                <div style="background: ${BRAND.amberBg}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fcd34d;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; text-align: center;">
                        <strong>Note:</strong> No refund will be issued for this cancellation per the contractor's policy.
                    </p>
                </div>
                ` : ''}

                <!-- Contractor Message (if provided) -->
                ${contractorMessage ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid ${BRAND.primary};">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Message from ${contractorName || 'contractor'}</p>
                    <p style="color: ${BRAND.text}; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">
                        "${contractorMessage}"
                    </p>
                </div>
                ` : ''}

                ${!approved ? `
                <!-- Next Steps for Denied Request -->
                <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        💡 What's Next?
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        <li>Your job is still scheduled as planned</li>
                        <li>Contact the contractor directly if you have questions</li>
                        <li>You can message them through your dashboard</li>
                    </ul>
                </div>
                ` : ''}

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${dashboardLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        View Dashboard →
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

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        customerEmail,
        customerName,
        contractorName,
        jobTitle,
        jobNumber,
        approved,
        refundAmount,
        contractorMessage,
        dashboardLink
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
    }

    if (approved === undefined) {
        return res.status(400).json({ error: 'Approved status is required' });
    }

    const subjectEmoji = approved ? '✅' : '❌';
    const subjectText = approved ? 'Cancellation Approved' : 'Cancellation Request Denied';

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [customerEmail],
            subject: `${subjectEmoji} ${subjectText} - ${jobTitle || 'Your Job'}`,
            html: generateCancellationResponseHtml({
                customerName,
                contractorName,
                jobTitle,
                jobNumber,
                approved,
                refundAmount: refundAmount || 0,
                contractorMessage,
                dashboardLink: dashboardLink || 'https://mykrib.app/app'
            }),
        });

        if (error) {
            console.error('[CancellationResponse] Error:', error);
            return res.status(500).json({ error: 'Failed to send cancellation response email' });
        }

        console.log('[CancellationResponse] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[CancellationResponse] Exception:', err);
        return res.status(500).json({ error: 'Failed to send cancellation response email' });
    }
}
