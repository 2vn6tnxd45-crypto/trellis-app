// api/send-job-update.js
// ============================================
// JOB UPDATE NOTIFICATION API
// ============================================
// Sends progress update emails to customers during active jobs
// Uses AI-generated or edited summaries from crew notes

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors (consistent with other KRIB emails)
const BRAND = {
    primary: '#10b981',
    primaryDark: '#059669',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    blue: '#3b82f6',
    blueBg: '#eff6ff',
    amber: '#f59e0b',
    amberBg: '#fffbeb',
    red: '#ef4444',
    redBg: '#fef2f2',
    indigo: '#6366f1',
    indigoBg: '#eef2ff'
};

// Update type styling
const UPDATE_STYLES = {
    progress: {
        icon: '🔧',
        color: BRAND.primary,
        bgColor: '#ecfdf5',
        label: 'Progress Update',
        borderColor: '#a7f3d0'
    },
    issue: {
        icon: '⚠️',
        color: BRAND.amber,
        bgColor: BRAND.amberBg,
        label: 'Important Update',
        borderColor: '#fde68a'
    },
    material: {
        icon: '📦',
        color: BRAND.blue,
        bgColor: BRAND.blueBg,
        label: 'Material Update',
        borderColor: '#bfdbfe'
    },
    delay: {
        icon: '⏰',
        color: BRAND.amber,
        bgColor: BRAND.amberBg,
        label: 'Schedule Update',
        borderColor: '#fde68a'
    }
};

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://mykrib.app',
    'https://www.mykrib.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

function generateUpdateEmailHtml({
    customerName,
    jobTitle,
    companyName,
    message,
    updateType
}) {
    const style = UPDATE_STYLES[updateType] || UPDATE_STYLES.progress;
    const firstName = customerName?.split(' ')[0] || 'there';

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
                    <div style="background: ${style.bgColor}; width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border: 2px solid ${style.borderColor};">
                        <span style="font-size: 36px;">${style.icon}</span>
                    </div>
                    <h1 style="color: ${style.color}; margin: 0; font-size: 24px; font-weight: 700;">
                        ${style.label}
                    </h1>
                    <p style="color: ${BRAND.textLight}; margin: 8px 0 0; font-size: 15px;">
                        ${jobTitle || 'Your Service'}
                    </p>
                </div>

                <!-- Message -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid ${style.color};">
                    <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.7; margin: 0; white-space: pre-wrap;">
${message || 'No message provided.'}
                    </p>
                </div>

                <!-- Footer Message -->
                <p style="color: ${BRAND.textLight}; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 24px;">
                    If you have any questions, please reply to this email or contact us directly.
                </p>

            </div>

            <!-- Company Footer -->
            <div style="text-align: center; margin-top: 24px;">
                <p style="color: ${BRAND.textLight}; font-size: 14px; font-weight: 500; margin: 0;">
                    ${companyName || 'Your Service Team'}
                </p>
                <p style="color: ${BRAND.textLight}; font-size: 12px; margin: 8px 0 0;">
                    Sent via <a href="https://mykrib.app" style="color: ${BRAND.primary}; text-decoration: none;">KRIB</a>
                </p>
            </div>

        </div>
    </body>
    </html>
    `;
}

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('[send-job-update] Processing request');

    const {
        customerEmail,
        customerName,
        jobTitle,
        companyName,
        message,
        updateType,
        jobId,
        contractorId
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        console.log('[send-job-update] Missing customerEmail');
        return res.status(400).json({ error: 'Customer email is required' });
    }

    if (!message) {
        console.log('[send-job-update] Missing message');
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!companyName) {
        console.log('[send-job-update] Missing companyName');
        return res.status(400).json({ error: 'Company name is required' });
    }

    try {
        // Check for API key
        if (!process.env.RESEND_API_KEY) {
            console.error('[send-job-update] RESEND_API_KEY not configured');
            return res.status(500).json({ error: 'Email service not configured' });
        }

        const style = UPDATE_STYLES[updateType] || UPDATE_STYLES.progress;
        const subject = `${style.icon} ${style.label}: ${jobTitle || 'Your Service'}`;

        console.log('[send-job-update] Sending email to:', customerEmail);
        console.log('[send-job-update] Subject:', subject);

        const html = generateUpdateEmailHtml({
            customerName,
            jobTitle,
            companyName,
            message,
            updateType
        });

        const { data, error } = await resend.emails.send({
            from: `${companyName} <updates@mykrib.app>`,
            to: [customerEmail],
            subject,
            html,
            tags: [
                { name: 'type', value: 'job_update' },
                { name: 'update_type', value: updateType || 'progress' },
                { name: 'job_id', value: jobId || 'unknown' },
                { name: 'contractor_id', value: contractorId || 'unknown' }
            ]
        });

        if (error) {
            console.error('[send-job-update] Resend error:', error);
            return res.status(500).json({ error: error.message || 'Failed to send email' });
        }

        console.log('[send-job-update] Email sent successfully:', data?.id);

        return res.status(200).json({
            success: true,
            messageId: data?.id
        });

    } catch (error) {
        console.error('[send-job-update] Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to send email' });
    }
}
