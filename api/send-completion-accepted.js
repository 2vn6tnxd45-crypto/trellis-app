// api/send-completion-accepted.js
// ============================================
// COMPLETION ACCEPTED NOTIFICATION API
// ============================================
// Notifies contractor when homeowner accepts/approves job completion
// Includes payment collection info if balance due

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

function generateCompletionAcceptedHtml({
    contractorName,
    customerName,
    jobTitle,
    jobNumber,
    acceptedDate,
    balanceDue,
    total,
    itemsImported,
    customerRating,
    customerFeedback,
    dashboardLink
}) {
    const formattedBalance = balanceDue > 0 ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(balanceDue) : null;

    const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(total || 0);

    // Generate star rating display
    const renderStars = (rating) => {
        if (!rating) return '';
        const fullStars = Math.floor(rating);
        const emptyStars = 5 - fullStars;
        return '⭐'.repeat(fullStars) + '☆'.repeat(emptyStars);
    };

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
                        <span style="font-size: 40px;">🎉</span>
                    </div>
                    <h1 style="color: ${BRAND.success}; margin: 0; font-size: 26px; font-weight: 700;">
                        Job Approved!
                    </h1>
                    <p style="color: ${BRAND.textLight}; margin: 8px 0 0; font-size: 16px;">
                        ${customerName || 'Your customer'} has accepted the completed work
                    </p>
                </div>

                <!-- Job Summary Box -->
                <div style="background: ${BRAND.successBg}; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <div style="text-align: center;">
                        ${jobNumber ? `<p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Job #${jobNumber}</p>` : ''}
                        <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 4px 0 0; font-weight: 600;">
                            ${jobTitle || 'Service Completed'}
                        </h2>
                        ${acceptedDate ? `
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 8px 0 0;">
                            Accepted on ${acceptedDate}
                        </p>
                        ` : ''}
                    </div>

                    <div style="text-align: center; padding: 16px 0 0; margin-top: 16px; border-top: 1px solid #bbf7d0;">
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0;">Job Total</p>
                        <p style="color: ${BRAND.success}; font-size: 32px; font-weight: 700; margin: 4px 0 0;">${formattedTotal}</p>
                    </div>
                </div>

                ${customerRating ? `
                <!-- Customer Rating -->
                <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fcd34d; text-align: center;">
                    <p style="color: #92400e; font-size: 14px; margin: 0 0 8px;">Customer Rating</p>
                    <p style="font-size: 24px; margin: 0;">${renderStars(customerRating)}</p>
                    ${customerFeedback ? `
                    <p style="color: #a16207; font-size: 14px; margin: 12px 0 0; font-style: italic;">
                        "${customerFeedback}"
                    </p>
                    ` : ''}
                </div>
                ` : ''}

                ${formattedBalance ? `
                <!-- Balance Due -->
                <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bfdbfe;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 8px; font-size: 14px;">
                        💵 Balance Due: ${formattedBalance}
                    </p>
                    <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 0;">
                        The customer has been prompted to pay the remaining balance.
                    </p>
                </div>
                ` : `
                <!-- Fully Paid -->
                <div style="background: ${BRAND.successBg}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0; text-align: center;">
                    <p style="color: ${BRAND.success}; font-weight: 600; margin: 0; font-size: 14px;">
                        ✅ Job Fully Paid
                    </p>
                </div>
                `}

                ${itemsImported && itemsImported.length > 0 ? `
                <!-- Items Imported -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        🏠 Items Added to Customer's Home Record
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        ${itemsImported.slice(0, 5).map(item => `<li>${item}</li>`).join('')}
                        ${itemsImported.length > 5 ? `<li>...and ${itemsImported.length - 5} more</li>` : ''}
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
        contractorEmail,
        contractorName,
        customerName,
        jobTitle,
        jobNumber,
        acceptedDate,
        balanceDue,
        total,
        itemsImported,
        customerRating,
        customerFeedback,
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
            subject: `🎉 Job Approved! ${customerName || 'Customer'} accepted "${jobTitle || 'completed work'}"`,
            html: generateCompletionAcceptedHtml({
                contractorName,
                customerName,
                jobTitle,
                jobNumber,
                acceptedDate,
                balanceDue,
                total,
                itemsImported,
                customerRating,
                customerFeedback,
                dashboardLink: dashboardLink || 'https://mykrib.app/app/?pro'
            }),
        });

        if (error) {
            console.error('[CompletionAccepted] Error:', error);
            return res.status(500).json({ error: 'Failed to send notification email' });
        }

        console.log('[CompletionAccepted] Sent, ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[CompletionAccepted] Exception:', err);
        return res.status(500).json({ error: 'Failed to send notification email' });
    }
}
