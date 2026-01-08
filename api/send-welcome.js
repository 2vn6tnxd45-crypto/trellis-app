// api/send-welcome.js
// Serverless function to send welcome email

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors (matching your app)
const BRAND = {
    primary: '#10b981',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc'
};

function generateWelcomeHtml(userName) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="background: ${BRAND.primary}; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 28px;">🏠</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 24px;">Welcome to Krib!</h1>
                </div>
                
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6;">
                    Hi ${userName || 'there'},
                </p>
                
                <p style="color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6;">
                    Thanks for joining Krib! We're here to help you stay on top of your home maintenance and never miss an important task.
                </p>
                
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px;">Here's what you can do:</p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li>Track all your home equipment & appliances</li>
                        <li>Get reminders before maintenance is due</li>
                        <li>Store warranties and contractor info</li>
                        <li>Connect with trusted local pros</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 32px;">
                    <a href="https://mykrib.app" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600;">
                        Open Krib →
                    </a>
                </div>
                
                <p style="color: ${BRAND.textLight}; font-size: 14px; text-align: center; margin-top: 32px;">
                    Questions? Just reply to this email!
                </p>
            </div>
            
            <p style="color: ${BRAND.textLight}; font-size: 12px; text-align: center; margin-top: 24px;">
                © ${new Date().getFullYear()} Krib • Your home, organized
            </p>
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

    const { email, userName } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <onboarding@resend.dev>', // Change to your domain later
            to: [email],
            subject: '🏠 Welcome to Krib!',
            html: generateWelcomeHtml(userName),
        });

        if (error) {
            console.error('[WelcomeEmail] Error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log('[WelcomeEmail] Sent to:', email);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[WelcomeEmail] Exception:', err);
        return res.status(500).json({ error: err.message });
    }
}
