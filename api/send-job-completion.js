// api/send-job-completion.js
// ============================================
// JOB COMPLETION NOTIFICATION API
// ============================================
// Notifies homeowner when contractor submits job completion
// Includes balance due information and CTA to review/approve

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors
const BRAND = {
    primary: '#10b981',
    primaryDark: '#059669',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    success: '#22c55e',
    successBg: '#f0fdf4',
    blue: '#3b82f6',
    blueBg: '#eff6ff'
};

function generateJobCompletionHtml({
    homeownerName,
    contractorName,
    jobTitle,
    jobNumber,
    completionDate,
    balanceDue,
    depositPaid,
    total,
    itemsInstalled,
    notes,
    photoCount,
    reviewLink,
    autoApproveDate
}) {
    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(balanceDue || 0);

    const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(total || 0);

    const formattedDeposit = depositPaid > 0 ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(depositPaid) : null;

    const hasBalance = balanceDue > 0;

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
                    <div style="background: ${BRAND.successBg}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border: 3px solid ${BRAND.success};">
                        <span style="font-size: 40px;">✅</span>
                    </div>
                    <h1 style="color: ${BRAND.success}; margin: 0; font-size: 26px; font-weight: 700;">
                        Job Completed!
                    </h1>
                    <p style="color: ${BRAND.textLight}; margin: 8px 0 0; font-size: 16px;">
                        ${contractorName || 'Your contractor'} has marked your job as complete
                    </p>
                </div>

                <!-- Main Message -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                    Hi ${homeownerName || 'there'},<br>
                    Great news! The work on your property has been completed.
                </p>

                <!-- Job Summary Box -->
                <div style="background: ${BRAND.successBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <div style="text-align: center; margin-bottom: 16px;">
                        ${jobNumber ? `<p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Job #${jobNumber}</p>` : ''}
                        <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 4px 0 0; font-weight: 600;">
                            ${jobTitle || 'Service Completed'}
                        </h2>
                    </div>

                    ${completionDate ? `
                    <p style="text-align: center; color: ${BRAND.textLight}; font-size: 14px; margin: 0;">
                        Completed on ${completionDate}
                    </p>
                    ` : ''}
                </div>

                <!-- Invoice Summary -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        💰 Payment Summary
                    </p>

                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px;">Job Total</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 500; text-align: right;">${formattedTotal}</td>
                        </tr>
                        ${formattedDeposit ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.success}; font-size: 14px;">Deposit Paid</td>
                            <td style="padding: 8px 0; color: ${BRAND.success}; font-size: 14px; font-weight: 500; text-align: right;">-${formattedDeposit}</td>
                        </tr>
                        ` : ''}
                        <tr style="border-top: 2px solid #e2e8f0;">
                            <td style="padding: 12px 0 8px; color: ${BRAND.text}; font-size: 16px; font-weight: 700;">
                                ${hasBalance ? 'Balance Due' : 'Amount Paid'}
                            </td>
                            <td style="padding: 12px 0 8px; color: ${hasBalance ? BRAND.primary : BRAND.success}; font-size: 20px; font-weight: 700; text-align: right;">
                                ${formattedBalance}
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Items Installed (if any) -->
                ${itemsInstalled && itemsInstalled.length > 0 ? `
                <div style="background: ${BRAND.blueBg}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        🏠 Items Added to Your Home Record
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        ${itemsInstalled.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                <!-- Contractor Notes (if any) -->
                ${notes ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid ${BRAND.primary};">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Notes from ${contractorName || 'contractor'}</p>
                    <p style="color: ${BRAND.text}; font-size: 14px; line-height: 1.6; margin: 0;">
                        "${notes}"
                    </p>
                </div>
                ` : ''}

                <!-- Photos Info -->
                ${photoCount > 0 ? `
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin: 16px 0;">
                    📷 ${photoCount} photo${photoCount !== 1 ? 's' : ''} included with this completion
                </p>
                ` : ''}

                <!-- Action Required -->
                <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fcd34d;">
                    <p style="color: #92400e; font-weight: 600; margin: 0 0 8px; font-size: 14px;">
                        ⚡ Action Required
                    </p>
                    <p style="color: #a16207; font-size: 14px; line-height: 1.6; margin: 0;">
                        Please review the completed work and approve it within 7 days.
                        ${autoApproveDate ? `<br><br>If no action is taken, this job will be automatically approved on <strong>${autoApproveDate}</strong>.` : ''}
                    </p>
                </div>

                <!-- CTA Buttons -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${reviewLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Review & Approve →
                    </a>
                </div>

                ${hasBalance ? `
                <p style="color: ${BRAND.textLight}; font-size: 13px; text-align: center; margin: 16px 0;">
                    After approval, you'll be prompted to pay the remaining balance of ${formattedBalance}
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

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        homeownerEmail,
        homeownerName,
        contractorName,
        jobTitle,
        jobNumber,
        completionDate,
        balanceDue,
        depositPaid,
        total,
        itemsInstalled,
        notes,
        photoCount,
        reviewLink,
        autoApproveDate
    } = req.body;

    // Validate required fields
    if (!homeownerEmail) {
        return res.status(400).json({ error: 'Homeowner email is required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [homeownerEmail],
            subject: `✅ Job Completed: ${jobTitle || 'Your service'} - Please Review`,
            html: generateJobCompletionHtml({
                homeownerName,
                contractorName,
                jobTitle,
                jobNumber,
                completionDate,
                balanceDue,
                depositPaid,
                total,
                itemsInstalled,
                notes,
                photoCount,
                reviewLink: reviewLink || 'https://mykrib.app/app',
                autoApproveDate
            }),
        });

        if (error) {
            console.error('[JobCompletion] Error:', error);
            return res.status(500).json({ error: 'Failed to send completion email' });
        }

        console.log('[JobCompletion] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[JobCompletion] Exception:', err);
        return res.status(500).json({ error: 'Failed to send completion email' });
    }
}
