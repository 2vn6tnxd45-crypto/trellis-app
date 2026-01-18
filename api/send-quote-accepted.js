// api/send-quote-accepted.js
// Serverless function to notify contractor when a quote is accepted

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
    successBg: '#f0fdf4'
};

function generateQuoteAcceptedHtml({ 
    contractorName,
    customerName, 
    customerEmail,
    customerPhone,
    customerAddress,
    quoteTitle, 
    quoteNumber,
    quoteTotal,
    customerMessage,
    dashboardLink
}) {
    const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(quoteTotal || 0);

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
                
                <!-- Header - Celebration! -->
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="background: ${BRAND.successBg}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border: 3px solid ${BRAND.success};">
                        <span style="font-size: 40px;">🎉</span>
                    </div>
                    <h1 style="color: ${BRAND.success}; margin: 0; font-size: 28px; font-weight: 700;">
                        Quote Accepted!
                    </h1>
                    <p style="color: ${BRAND.textLight}; margin: 8px 0 0; font-size: 16px;">
                        Great news, ${contractorName || 'there'}!
                    </p>
                </div>
                
                <!-- Main Message -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                    <strong>${customerName || 'A customer'}</strong> has accepted your quote.
                </p>
                
                <!-- Quote Summary Box -->
                <div style="background: ${BRAND.successBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <div style="text-align: center; margin-bottom: 16px;">
                        <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Quote ${quoteNumber || ''}</p>
                        <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 4px 0 0; font-weight: 600;">
                            ${quoteTitle || 'Service Quote'}
                        </h2>
                    </div>
                    
                    <div style="text-align: center; padding: 16px 0; border-top: 1px solid #bbf7d0;">
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0;">Amount</p>
                        <p style="color: ${BRAND.success}; font-size: 32px; font-weight: 700; margin: 4px 0 0;">${formattedTotal}</p>
                    </div>
                </div>
                
                <!-- Customer Message (if provided) -->
                ${customerMessage ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid ${BRAND.primary};">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Message from ${customerName || 'customer'}</p>
                    <p style="color: ${BRAND.text}; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">
                        "${customerMessage}"
                    </p>
                </div>
                ` : ''}
                
                <!-- Customer Details -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        📋 Customer Details
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
                        ${customerAddress ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px; vertical-align: top;">Address</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px;">${customerAddress}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                
                <!-- Next Steps -->
                <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        ⚡ Next Steps
                    </p>
                    <ol style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        <li>Reach out to schedule the appointment</li>
                        <li>Confirm the job details with the customer</li>
                        <li>Update the job status in your dashboard</li>
                    </ol>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${dashboardLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Open Dashboard →
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
        customerAddress,
        quoteTitle,
        quoteNumber,
        quoteTotal,
        customerMessage,
        dashboardLink
    } = req.body;

    // Validate required fields
    if (!contractorEmail) {
        return res.status(400).json({ error: 'Contractor email is required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [contractorEmail],
            subject: `🎉 Quote Accepted! ${customerName || 'Customer'} accepted "${quoteTitle || 'your quote'}"`,
            html: generateQuoteAcceptedHtml({
                contractorName,
                customerName,
                customerEmail,
                customerPhone,
                customerAddress,
                quoteTitle,
                quoteNumber,
                quoteTotal,
                customerMessage,
                dashboardLink: dashboardLink || 'https://mykrib.app/app/?pro'
            }),
        });

        if (error) {
            console.error('[QuoteAccepted] Error:', error);
            return res.status(500).json({ error: 'Failed to send notification email' });
        }

        console.log('[QuoteAccepted] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[QuoteAccepted] Exception:', err);
        return res.status(500).json({ error: 'Failed to send notification email' });
    }
}
