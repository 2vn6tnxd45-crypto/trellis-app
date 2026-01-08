// functions/src/emailService.js
// ============================================
// EMAIL SERVICE - Powered by Resend
// ============================================

const { Resend } = require('resend');
const { 
    generateWelcomeHtml, 
    generateDigestHtml, 
    generateOverdueHtml,
    generateWarrantyAlertHtml 
} = require('./emailTemplates');

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

// Your verified sending domain (use Resend's test domain until you verify your own)
const FROM_EMAIL = 'Krib <onboarding@resend.dev>'; // Change to your domain later: notifications@mykrib.app

// ============================================
// SEND EMAIL HELPER
// ============================================
async function sendEmail({ to, subject, html, replyTo = null }) {
    try {
        const emailData = {
            from: FROM_EMAIL,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        };
        
        if (replyTo) {
            emailData.reply_to = replyTo;
        }

        const { data, error } = await resend.emails.send(emailData);

        if (error) {
            console.error('[EmailService] Send failed:', error);
            return { success: false, error };
        }

        console.log('[EmailService] Email sent successfully:', data.id);
        return { success: true, id: data.id };
    } catch (err) {
        console.error('[EmailService] Exception:', err);
        return { success: false, error: err.message };
    }
}

// ============================================
// EMAIL TYPES
// ============================================

/**
 * Send welcome email to new users
 */
async function sendWelcomeEmail({ to, userName }) {
    const html = generateWelcomeHtml({ userName });
    return sendEmail({
        to,
        subject: '🏠 Welcome to Krib!',
        html
    });
}

/**
 * Send maintenance digest (weekly or monthly)
 */
async function sendDigestEmail({ 
    to, 
    userName, 
    propertyAddress,
    overdueTasks = [],
    upcomingTasks = [],
    completedThisMonth = 0,
    isWeekly = true 
}) {
    const html = generateDigestHtml({
        userName,
        propertyAddress,
        overdueTasks,
        upcomingTasks,
        completedThisMonth,
        isWeekly
    });
    
    const overdueCount = overdueTasks.length;
    const subject = overdueCount > 0 
        ? `🚨 ${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''} need attention`
        : `📋 Your ${isWeekly ? 'weekly' : 'monthly'} home update`;
    
    return sendEmail({ to, subject, html });
}

/**
 * Send overdue task alert
 */
async function sendOverdueAlert({ to, userName, task, propertyAddress, daysOverdue }) {
    const html = generateOverdueHtml({
        userName,
        task,
        propertyAddress,
        daysOverdue
    });
    
    return sendEmail({
        to,
        subject: `🚨 Maintenance overdue: ${task.taskName}`,
        html
    });
}

/**
 * Send warranty expiration alert
 */
async function sendWarrantyAlert({ to, userName, warranty, daysUntilExpiry }) {
    const html = generateWarrantyAlertHtml({
        userName,
        warranty,
        daysUntilExpiry
    });
    
    const urgent = daysUntilExpiry <= 30;
    const subject = urgent
        ? `⚠️ Warranty expiring soon: ${warranty.itemName}`
        : `📋 Warranty reminder: ${warranty.itemName}`;
    
    return sendEmail({ to, subject, html });
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendDigestEmail,
    sendOverdueAlert,
    sendWarrantyAlert
};
