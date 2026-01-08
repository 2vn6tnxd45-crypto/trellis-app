// api/send-quote.js
// Serverless function to send quote notification email to customers

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors (matching your app)
const BRAND = {
    primary: '#10b981',
    primaryDark: '#059669',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff'
};

function generateQuoteEmailHtml({ 
    customerName, 
    contractorName, 
    contractorPhone,
    quoteTitle, 
    quoteTotal, 
    lineItemCount,
    quoteLink,
    expiresAt
}) {
    const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(quoteTotal || 0);
    
    const expiryText = expiresAt 
        ? `This quote is valid until ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
        : 'Please review at your earliest convenience.';

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
                    <div style="background: ${BRAND.primary}; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">📋</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        You've Received a Quote!
                    </h1>
                </div>
                
                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Hi ${customerName || 'there'},
                </p>
                
                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    <strong style="color: ${BRAND.text};">${contractorName}</strong> has sent you a quote for your review.
                </p>
                
                <!-- Quote Summary Box -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
                    <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 0 0 16px; font-weight: 600;">
                        ${quoteTitle || 'Service Quote'}
                    </h2>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: ${BRAND.textLight}; font-size: 14px;">Items</span>
                        <span style="color: ${BRAND.text}; font-size: 14px; font-weight: 500;">${lineItemCount || 1} service${lineItemCount !== 1 ? 's' : ''}</span>
                    </div>
                    
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: ${BRAND.text}; font-size: 16px; font-weight: 600;">Total</span>
                            <span style="color: ${BRAND.primary}; font-size: 24px; font-weight: 700;">${formattedTotal}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Expiry Notice -->
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin-bottom: 24px;">
                    ${expiryText}
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${quoteLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        View Quote →
                    </a>
                </div>
                
                <!-- What You Can Do -->
                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        What you can do:
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        <li>Review the detailed breakdown</li>
                        <li>Accept the quote instantly</li>
                        <li>Message ${contractorName} with questions</li>
                        <li>Schedule your appointment</li>
                    </ul>
                </div>
                
                <!-- Contractor Contact -->
                ${contractorPhone ? `
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin-top: 24px;">
                    Questions? Call <strong style="color: ${BRAND.text};">${contractorName}</strong> at 
                    <a href="tel:${contractorPhone}" style="color: ${BRAND.primary}; text-decoration: none;">${contractorPhone}</a>
                </p>
                ` : ''}
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0;">
                    Powered by <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">Krib</a> • Your home, organized
                </p>
                <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
                    You received this email because ${contractorName} sent you a quote through Krib.
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
        contractorPhone,
        quoteTitle,
        quoteTotal,
        lineItemCount,
        quoteLink,
        expiresAt
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
    }
    if (!quoteLink) {
        return res.status(400).json({ error: 'Quote link is required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [customerEmail],
            subject: `📋 New Quote from ${contractorName || 'Your Contractor'}`,
            html: generateQuoteEmailHtml({
                customerName,
                contractorName,
                contractorPhone,
                quoteTitle,
                quoteTotal,
                lineItemCount,
                quoteLink,
                expiresAt
            }),
        });

        if (error) {
            console.error('[SendQuote] Error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log('[SendQuote] Sent to:', customerEmail, 'ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[SendQuote] Exception:', err);
        return res.status(500).json({ error: err.message });
    }
}
