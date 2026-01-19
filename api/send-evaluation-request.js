// api/send-evaluation-request.js
// Serverless function to send evaluation request notification email to customers

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

function generateEvaluationEmailHtml({
    customerName,
    contractorName,
    contractorPhone,
    jobDescription,
    evaluationType,
    evaluationLink,
    expiresAt
}) {
    const expiryText = expiresAt
        ? `Please respond by ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
        : 'Please respond at your earliest convenience.';

    const isVirtual = evaluationType === 'virtual';
    const typeLabel = isVirtual ? 'Virtual Evaluation' : 'Site Visit';
    const typeDescription = isVirtual
        ? 'Send photos and info from your phone — no appointment needed!'
        : 'We\'ll schedule a time to visit and assess the situation in person.';

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
                        <span style="font-size: 28px;">${isVirtual ? '📸' : '🏠'}</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        ${contractorName} Needs Your Help
                    </h1>
                    <p style="color: ${BRAND.textLight}; margin: 8px 0 0; font-size: 14px;">
                        ${typeLabel} Request
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Hi ${customerName || 'there'},
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    <strong style="color: ${BRAND.text};">${contractorName}</strong> would like some information before sending you a quote.
                </p>

                <!-- Job Description Box -->
                ${jobDescription ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">
                        Regarding
                    </p>
                    <p style="color: ${BRAND.text}; font-size: 16px; margin: 0; line-height: 1.5;">
                        ${jobDescription}
                    </p>
                </div>
                ` : ''}

                <!-- What's Requested Box -->
                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 8px; font-size: 14px;">
                        ${isVirtual ? '📷 What they need:' : '📅 Next step:'}
                    </p>
                    <p style="color: ${BRAND.textLight}; margin: 0; font-size: 14px; line-height: 1.6;">
                        ${typeDescription}
                    </p>
                </div>

                <!-- Expiry Notice -->
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin-bottom: 24px;">
                    ${expiryText}
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${evaluationLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        ${isVirtual ? 'Send Photos & Info →' : 'Schedule Visit →'}
                    </a>
                </div>

                <!-- Benefits -->
                <div style="text-align: center; margin: 24px 0;">
                    <p style="color: ${BRAND.textLight}; font-size: 13px; margin: 0;">
                        ✓ Takes less than 5 minutes &nbsp;&nbsp; ✓ Get an accurate quote faster
                    </p>
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
                    You received this email because ${contractorName} requested information through Krib.
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
        jobDescription,
        evaluationType,
        evaluationLink,
        expiresAt
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
    }
    if (!evaluationLink) {
        return res.status(400).json({ error: 'Evaluation link is required' });
    }

    try {
        const isVirtual = evaluationType === 'virtual';
        const subject = isVirtual
            ? `📸 ${contractorName || 'Your Contractor'} needs photos for your quote`
            : `🏠 ${contractorName || 'Your Contractor'} wants to schedule an evaluation`;

        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [customerEmail],
            subject: subject,
            html: generateEvaluationEmailHtml({
                customerName,
                contractorName,
                contractorPhone,
                jobDescription,
                evaluationType,
                evaluationLink,
                expiresAt
            }),
        });

        if (error) {
            console.error('[SendEvaluationRequest] Error:', error);
            return res.status(500).json({ error: 'Failed to send evaluation request email' });
        }

        console.log('[SendEvaluationRequest] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[SendEvaluationRequest] Exception:', err);
        return res.status(500).json({ error: 'Failed to send evaluation request email' });
    }
}
