// api/send-job-cancelled.js
// Serverless function to notify contractor when a job is cancelled

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors
const BRAND = {
    primary: '#10b981',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    red: '#ef4444',
    redBg: '#fef2f2',
    amber: '#f59e0b',
    amberBg: '#fffbeb'
};

function generateJobCancelledHtml({ 
    contractorName,
    customerName, 
    customerEmail,
    customerPhone,
    jobTitle, 
    jobNumber,
    jobTotal,
    depositPaid,
    cancellationReason,
    isRequest, // true = requesting cancellation, false = cancelled outright
    dashboardLink
}) {
    const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(jobTotal || 0);

    const formattedDeposit = depositPaid ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(depositPaid) : null;

    const headerEmoji = isRequest ? '⚠️' : '❌';
    const headerText = isRequest ? 'Cancellation Requested' : 'Job Cancelled';
    const headerColor = isRequest ? BRAND.amber : BRAND.red;
    const headerBg = isRequest ? BRAND.amberBg : BRAND.redBg;

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
                    ${isRequest 
                        ? `<strong>${customerName || 'A customer'}</strong> is requesting to cancel a job.`
                        : `<strong>${customerName || 'A customer'}</strong> has cancelled a job.`
                    }
                </p>
                
                <!-- Job Summary Box -->
                <div style="background: ${headerBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid ${isRequest ? '#fcd34d' : '#fecaca'};">
                    <div style="text-align: center; margin-bottom: 16px;">
                        ${jobNumber ? `<p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Job ${jobNumber}</p>` : ''}
                        <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 4px 0 0; font-weight: 600;">
                            ${jobTitle || 'Service Job'}
                        </h2>
                    </div>
                    
                    <div style="text-align: center; padding-top: 16px; border-top: 1px solid ${isRequest ? '#fcd34d' : '#fecaca'};">
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0;">Job Value</p>
                        <p style="color: ${BRAND.text}; font-size: 24px; font-weight: 700; margin: 4px 0 0;">${formattedTotal}</p>
                    </div>
                </div>
                
                <!-- Deposit Warning (if applicable) -->
                ${formattedDeposit ? `
                <div style="background: ${BRAND.amberBg}; border-radius: 12px; padding: 16px 20px; margin: 24px 0; border-left: 4px solid ${BRAND.amber};">
                    <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                        💰 Deposit Paid: ${formattedDeposit}
                    </p>
                    <p style="color: #a16207; font-size: 13px; margin: 8px 0 0;">
                        ${isRequest 
                            ? 'Please review this cancellation request and respond regarding the deposit.'
                            : 'You may need to process a refund for this deposit.'
                        }
                    </p>
                </div>
                ` : ''}
                
                <!-- Cancellation Reason -->
                ${cancellationReason ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid ${BRAND.textLight};">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Reason Given</p>
                    <p style="color: ${BRAND.text}; font-size: 14px; line-height: 1.6; margin: 0;">
                        "${cancellationReason}"
                    </p>
                </div>
                ` : ''}
                
                <!-- Customer Contact -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        📋 Customer Contact
                    </p>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px; width: 80px;">Name</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 500;">${customerName || 'Not provided'}</td>
                        </tr>
                        ${customerEmail ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px;">Email</td>
                            <td style="padding: 8px 0;">
                                <a href="mailto:${customerEmail}" style="color: ${BRAND.primary}; text-decoration: none; font-size: 14px;">${customerEmail}</a>
                            </td>
                        </tr>
                        ` : ''}
                        ${customerPhone ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px;">Phone</td>
                            <td style="padding: 8px 0;">
                                <a href="tel:${customerPhone}" style="color: ${BRAND.primary}; text-decoration: none; font-size: 14px;">${customerPhone}</a>
                            </td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                
                <!-- Action Required (for requests) -->
                ${isRequest ? `
                <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        ⚡ Action Required
                    </p>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; line-height: 1.6; margin: 0;">
                        Please review this request and contact the customer to discuss:
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 12px 0 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        <li>Whether to approve the cancellation</li>
                        <li>Deposit refund amount (if applicable)</li>
                        <li>Any cancellation fees per your policy</li>
                    </ul>
                </div>
                ` : ''}
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${dashboardLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        ${isRequest ? 'Review Request →' : 'View Dashboard →'}
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
        contractorEmail,
        contractorName,
        customerName,
        customerEmail,
        customerPhone,
        jobTitle,
        jobNumber,
        jobTotal,
        depositPaid,
        cancellationReason,
        isRequest,
        dashboardLink
    } = req.body;

    // Validate required fields
    if (!contractorEmail) {
        return res.status(400).json({ error: 'Contractor email is required' });
    }

    const subjectPrefix = isRequest ? '⚠️ Cancellation Request:' : '❌ Job Cancelled:';

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [contractorEmail],
            subject: `${subjectPrefix} ${jobTitle || 'Service Job'} - ${customerName || 'Customer'}`,
            html: generateJobCancelledHtml({
                contractorName,
                customerName,
                customerEmail,
                customerPhone,
                jobTitle,
                jobNumber,
                jobTotal,
                depositPaid,
                cancellationReason,
                isRequest: isRequest || false,
                dashboardLink: dashboardLink || 'https://mykrib.app/app/?pro'
            }),
        });

        if (error) {
            console.error('[JobCancelled] Error:', error);
            return res.status(500).json({ error: 'Failed to send cancellation email' });
        }

        console.log('[JobCancelled] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[JobCancelled] Exception:', err);
        return res.status(500).json({ error: 'Failed to send cancellation email' });
    }
}
