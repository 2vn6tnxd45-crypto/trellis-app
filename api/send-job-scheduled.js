// api/send-job-scheduled.js
// Serverless function to notify customer when their job is scheduled

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors
const BRAND = {
    primary: '#10b981',
    text: '#1e293b',
    textLight: '#64748b',
    background: '#f8fafc',
    white: '#ffffff',
    blue: '#3b82f6',
    blueBg: '#eff6ff'
};

// Helper to format date for Google Calendar (YYYYMMDDTHHmmssZ)
const formatGoogleDate = (date) => {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

// Generate Google Calendar URL
const generateGoogleCalendarUrl = ({ title, description, location, start, end }) => {
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title || 'Appointment',
        dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
        details: description || '',
        location: location || '',
        sf: 'true',
        output: 'xml'
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// Generate Outlook Web URL
const generateOutlookUrl = ({ title, description, location, start, end }) => {
    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: title || 'Appointment',
        body: description || '',
        location: location || '',
        startdt: new Date(start).toISOString(),
        enddt: new Date(end).toISOString()
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

function generateJobScheduledHtml({
    customerName,
    contractorName,
    contractorPhone,
    contractorEmail,
    jobTitle,
    jobNumber,
    scheduledDate,
    scheduledTime,
    estimatedDuration,
    serviceAddress,
    notes,
    jobLink,
    scheduledEndDate
}) {
    // Format the date nicely
    const dateObj = new Date(scheduledDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    // Format time if provided
    const formattedTime = scheduledTime || 'Time TBD';

    // Calculate end date for calendar (default 2 hours after start)
    const startDate = new Date(scheduledDate);
    const endDate = scheduledEndDate ? new Date(scheduledEndDate) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    // Build calendar event data
    const calendarEvent = {
        title: `${jobTitle || 'Service'} - ${contractorName || 'Contractor'}`,
        description: `Service: ${jobTitle || 'Home Service'}\\n\\nContractor: ${contractorName}${contractorPhone ? `\\nPhone: ${contractorPhone}` : ''}\\n\\nScheduled via Krib`,
        location: serviceAddress || '',
        start: startDate,
        end: endDate
    };

    const googleCalUrl = generateGoogleCalendarUrl(calendarEvent);
    const outlookUrl = generateOutlookUrl(calendarEvent);

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
                    <div style="background: ${BRAND.blueBg}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border: 3px solid ${BRAND.blue};">
                        <span style="font-size: 40px;">📅</span>
                    </div>
                    <h1 style="color: ${BRAND.text}; margin: 0; font-size: 26px; font-weight: 700;">
                        Your Appointment is Scheduled!
                    </h1>
                </div>
                
                <!-- Greeting -->
                <p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                    Hi ${customerName || 'there'}, <strong>${contractorName}</strong> has scheduled your service appointment.
                </p>
                
                <!-- Appointment Card -->
                <div style="background: ${BRAND.blueBg}; border-radius: 16px; padding: 24px; margin: 24px 0; border: 2px solid ${BRAND.blue};">
                    <div style="text-align: center;">
                        <p style="color: ${BRAND.blue}; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px; font-weight: 600;">
                            Appointment Date
                        </p>
                        <p style="color: ${BRAND.text}; font-size: 24px; font-weight: 700; margin: 0;">
                            ${formattedDate}
                        </p>
                        <p style="color: ${BRAND.blue}; font-size: 20px; font-weight: 600; margin: 8px 0 0;">
                            ${formattedTime}
                        </p>
                        ${estimatedDuration ? `
                        <p style="color: ${BRAND.textLight}; font-size: 14px; margin: 12px 0 0;">
                            Estimated duration: ${estimatedDuration}
                        </p>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Job Details -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        📋 Service Details
                    </p>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px; width: 100px;">Service</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px; font-weight: 500;">${jobTitle || 'Service'}</td>
                        </tr>
                        ${jobNumber ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px;">Job #</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px;">${jobNumber}</td>
                        </tr>
                        ` : ''}
                        ${serviceAddress ? `
                        <tr>
                            <td style="padding: 8px 0; color: ${BRAND.textLight}; font-size: 14px; vertical-align: top;">Location</td>
                            <td style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px;">${serviceAddress}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                
                <!-- Notes (if provided) -->
                ${notes ? `
                <div style="background: #fefce8; border-radius: 12px; padding: 16px 20px; margin: 24px 0; border-left: 4px solid #eab308;">
                    <p style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Note from ${contractorName}</p>
                    <p style="color: ${BRAND.text}; font-size: 14px; line-height: 1.6; margin: 0;">
                        ${notes}
                    </p>
                </div>
                ` : ''}
                
                <!-- Contractor Contact -->
                <div style="background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        👷 Your Contractor
                    </p>
                    <p style="color: ${BRAND.text}; font-size: 16px; font-weight: 600; margin: 0;">
                        ${contractorName}
                    </p>
                    <div style="margin-top: 12px;">
                        ${contractorPhone ? `
                        <p style="margin: 4px 0;">
                            <a href="tel:${contractorPhone}" style="color: ${BRAND.primary}; text-decoration: none; font-size: 14px;">📞 ${contractorPhone}</a>
                        </p>
                        ` : ''}
                        ${contractorEmail ? `
                        <p style="margin: 4px 0;">
                            <a href="mailto:${contractorEmail}" style="color: ${BRAND.primary}; text-decoration: none; font-size: 14px;">✉️ ${contractorEmail}</a>
                        </p>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Add to Calendar -->
                <div style="background: ${BRAND.blueBg}; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #dbeafe; text-align: center;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 16px; font-size: 14px;">
                        📅 Add to Your Calendar
                    </p>
                    <div style="display: inline-flex; gap: 12px;">
                        <a href="${googleCalUrl}" target="_blank" style="display: inline-block; background: white; color: ${BRAND.text}; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #e2e8f0;">
                            Google Calendar
                        </a>
                        <a href="${outlookUrl}" target="_blank" style="display: inline-block; background: white; color: ${BRAND.text}; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #e2e8f0;">
                            Outlook
                        </a>
                    </div>
                </div>

                <!-- What to Expect -->
                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
                    <p style="color: ${BRAND.text}; font-weight: 600; margin: 0 0 12px; font-size: 14px;">
                        ✅ What to Expect
                    </p>
                    <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
                        <li>The contractor will arrive at the scheduled time</li>
                        <li>Please ensure access to the service area</li>
                        <li>You can message the contractor with any questions</li>
                    </ul>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${jobLink}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        View Job Details →
                    </a>
                </div>
                
                <!-- Reschedule Note -->
                <p style="color: ${BRAND.textLight}; font-size: 13px; text-align: center; margin-top: 24px;">
                    Need to reschedule? Contact ${contractorName} directly${contractorPhone ? ` at ${contractorPhone}` : ''}.
                </p>
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
        customerEmail,
        customerName,
        contractorName,
        contractorPhone,
        contractorEmail,
        jobTitle,
        jobNumber,
        scheduledDate,
        scheduledTime,
        estimatedDuration,
        serviceAddress,
        notes,
        jobLink
    } = req.body;

    // Validate required fields
    if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
    }
    if (!scheduledDate) {
        return res.status(400).json({ error: 'Scheduled date is required' });
    }

    // Format date for subject line
    const dateObj = new Date(scheduledDate);
    const shortDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    try {
        const { data, error } = await resend.emails.send({
            from: 'Krib <hello@mykrib.app>',
            to: [customerEmail],
            subject: `📅 Appointment Confirmed: ${jobTitle || 'Service'} on ${shortDate}`,
            html: generateJobScheduledHtml({
                customerName,
                contractorName,
                contractorPhone,
                contractorEmail,
                jobTitle,
                jobNumber,
                scheduledDate,
                scheduledTime,
                estimatedDuration,
                serviceAddress,
                notes,
                jobLink: jobLink || 'https://mykrib.app/app/'
            }),
        });

        if (error) {
            console.error('[JobScheduled] Error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log('[JobScheduled] Sent to:', customerEmail, 'ID:', data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (err) {
        console.error('[JobScheduled] Exception:', err);
        return res.status(500).json({ error: err.message });
    }
}
