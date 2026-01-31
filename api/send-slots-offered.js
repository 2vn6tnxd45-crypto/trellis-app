// api/send-slots-offered.js
// Serverless function to send email notification when contractor offers time slots

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors (matching your app)
const BRAND = {
    primary: '#10b981',
    primaryDark: '#059669',
    blue: '#3b82f6',
    blueDark: '#2563eb',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff'
};

// Helper to format a single time slot
function formatSlot(slot) {
    if (!slot.start) return 'Time TBD';

    const start = new Date(slot.start);
    const end = slot.end ? new Date(slot.end) : null;

    const dateStr = start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    const startTime = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    if (end) {
        const endTime = end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        return `${dateStr} at ${startTime} - ${endTime}`;
    }

    return `${dateStr} at ${startTime}`;
}

function generateSlotsEmailHtml({
    customerName,
    contractorName,
    contractorPhone,
    jobTitle,
    slots,
    message,
    jobLink
}) {
    const slotCount = slots?.length || 0;

    // Generate slot list HTML
    const slotsHtml = slots && slots.length > 0
        ? slots.map((slot, index) => `
            <div style="display: flex; align-items: center; padding: 12px 16px; background: ${index % 2 === 0 ? '#f8fafc' : BRAND.white}; border-radius: 8px; margin-bottom: 8px;">
                <div style="width: 32px; height: 32px; background: ${BRAND.blue}; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <span style="color: white; font-weight: 600; font-size: 14px;">${index + 1}</span>
                </div>
                <span style="color: ${BRAND.text}; font-size: 14px; font-weight: 500;">
                    ${formatSlot(slot)}
                </span>
            </div>
        `).join('')
        : '<p style="color: #94a3b8; font-size: 14px;">No specific times listed - contact contractor for details.</p>';

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
                    <div style="background: ${BRAND.blue}; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">📅</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: 700;">
                        Times Available!
                    </h1>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin-top: 8px;">
                        ${slotCount} time option${slotCount !== 1 ? 's' : ''} for your service
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    Hi ${customerName || 'there'},
                </p>

                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    <strong style="color: ${BRAND.text};">${contractorName}</strong> has ${slotCount} time${slotCount !== 1 ? 's' : ''} available for:
                </p>

                <!-- Job Title Box -->
                <div style="background: #eff6ff; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid ${BRAND.blue};">
                    <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 0; font-weight: 600;">
                        ${jobTitle || 'Your Service Request'}
                    </h2>
                </div>

                ${message ? `
                <!-- Contractor Message -->
                <div style="background: #fefce8; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid #fef08a;">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; font-weight: 600;">
                        Message from ${contractorName}
                    </p>
                    <p style="color: ${BRAND.text}; font-size: 14px; margin: 0; line-height: 1.5;">
                        "${message}"
                    </p>
                </div>
                ` : ''}

                <!-- Available Time Slots -->
                <div style="margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        Available Times:
                    </p>
                    ${slotsHtml}
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${jobLink}" style="display: inline-block; background: ${BRAND.blue}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Choose Your Time →
                    </a>
                </div>

                <!-- Urgency Notice -->
                <div style="background: #fef3c7; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0; border: 1px solid #fde68a;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                        ⏰ Respond soon to secure your preferred time!
                    </p>
                </div>

                <!-- Contractor Contact -->
                ${contractorPhone ? `
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin-top: 24px;">
                    Questions? Call <strong style="color: ${BRAND.text};">${contractorName}</strong> at
                    <a href="tel:${contractorPhone}" style="color: ${BRAND.blue}; text-decoration: none;">${contractorPhone}</a>
                </p>
                ` : ''}
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 0;">
                    Powered by <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">Krib</a> • Your home, organized
                </p>
                <p style="color: #94a3b8; font-size: 11px; margin-top: 8px;">
                    You received this email because ${contractorName} offered scheduling times through Krib.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

export default async function handler(req, res) {
    // CORS headers - restrict to allowed origins
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        customerEmail,
        customerName,
        contractorName,
        contractorPhone,
        jobTitle,
        jobId,
        slots,
        message
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
    }
    if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
    }

    // Build job link
    const jobLink = `https://mykrib.app/dashboard?job=${jobId}`;

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [customerEmail],
            subject: `📅 ${contractorName || 'Your Contractor'} has times available for your ${jobTitle || 'service'}`,
            html: generateSlotsEmailHtml({
                customerName,
                contractorName,
                contractorPhone,
                jobTitle,
                slots: slots || [],
                message,
                jobLink
            }),
        });

        if (error) {
            console.error('[SendSlotsOffered] Error:', error);
            return res.status(500).json({ error: 'Failed to send slots email' });
        }

        console.log('[SendSlotsOffered] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[SendSlotsOffered] Exception:', err);
        return res.status(500).json({ error: 'Failed to send slots email' });
    }
}
