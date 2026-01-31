// api/send-customer-update.js
// ============================================
// CUSTOMER UPDATE EMAIL API
// ============================================
// Sends progress update emails to customers during active jobs

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
    blue: '#3b82f6',
    blueBg: '#eff6ff'
};

function generateCustomerUpdateHtml({
    customerName,
    message,
    jobTitle,
    companyName,
    contractorPhone,
    photos
}) {
    const firstName = customerName?.split(' ')[0] || 'there';
    const hasPhotos = photos && photos.length > 0;

    // Generate photo grid HTML if photos provided
    const photoGridHtml = hasPhotos ? `
        <div style="margin: 24px 0;">
            <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                📷 Photos from the job
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${photos.slice(0, 4).map(photoUrl => `
                    <a href="${photoUrl}" target="_blank" style="display: block; width: calc(50% - 4px); aspect-ratio: 1; border-radius: 8px; overflow: hidden;">
                        <img src="${photoUrl}" alt="Job photo" style="width: 100%; height: 100%; object-fit: cover;" />
                    </a>
                `).join('')}
            </div>
            ${photos.length > 4 ? `
                <p style="color: ${BRAND.textLight}; font-size: 12px; text-align: center; margin-top: 8px;">
                    + ${photos.length - 4} more photo${photos.length - 4 > 1 ? 's' : ''}
                </p>
            ` : ''}
        </div>
    ` : '';

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
                    <div style="background: ${BRAND.blueBg}; width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border: 2px solid #bfdbfe;">
                        <span style="font-size: 36px;">🔧</span>
                    </div>
                    <h1 style="color: ${BRAND.blue}; margin: 0; font-size: 24px; font-weight: 700;">
                        Update on Your Job
                    </h1>
                    <p style="color: ${BRAND.textLight}; margin: 8px 0 0; font-size: 15px;">
                        ${jobTitle || 'Your Service'}
                    </p>
                </div>

                <!-- Message -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${BRAND.primary};">
                    <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${message || 'No message provided.'}</p>
                </div>

                <!-- Photos -->
                ${photoGridHtml}

                <!-- Contact Info -->
                ${contractorPhone ? `
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0 0 8px;">
                        Questions? Give us a call:
                    </p>
                    <a href="tel:${contractorPhone}" style="color: ${BRAND.primary}; font-size: 18px; font-weight: 600; text-decoration: none;">
                        ${contractorPhone}
                    </a>
                </div>
                ` : ''}

                <!-- Footer Message -->
                <p style="color: ${BRAND.textLight}; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 24px;">
                    Thank you for your business. We'll keep you updated on our progress.
                </p>

            </div>

            <!-- Company Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.text}; font-size: 14px; font-weight: 600; margin: 0;">
                    ${companyName || 'Your Service Team'}
                </p>
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 8px 0 0;">
                    Powered by <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">Krib</a>
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
        message,
        jobTitle,
        companyName,
        contractorPhone,
        photos
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!companyName) {
        return res.status(400).json({ error: 'Company name is required' });
    }

    try {
        const subject = `Update on your ${jobTitle || 'service'} - ${companyName}`;

        const { data, error } = await resend.emails.send({
            from: `${companyName} <notifications@mykrib.app>`,
            to: [customerEmail],
            subject,
            html: generateCustomerUpdateHtml({
                customerName,
                message,
                jobTitle,
                companyName,
                contractorPhone,
                photos
            }),
        });

        if (error) {
            console.error('[CustomerUpdate] Error:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }

        console.log('[CustomerUpdate] Sent, ID:', data.id);
        return res.status(200).json({ success: true, messageId: data.id });
    } catch (err) {
        console.error('[CustomerUpdate] Exception:', err);
        return res.status(500).json({ error: 'Failed to send email' });
    }
}
