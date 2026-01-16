// src/lib/calendarExport.js
// ============================================
// CALENDAR EXPORT UTILITIES
// ============================================
// Generate calendar files and URLs for various calendar apps

/**
 * Format date to Google Calendar format (YYYYMMDDTHHmmssZ)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
const formatGoogleDate = (date) => {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Format date to ICS format (YYYYMMDDTHHMMSS)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string for ICS
 */
const formatICSDate = (date) => {
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');

    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

/**
 * Escape special characters for ICS format
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const escapeICS = (text) => {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
};

/**
 * Generate a unique ID for calendar events
 * @returns {string} Unique event ID
 */
const generateUID = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@mykrib.app`;
};

/**
 * Generate Google Calendar URL
 * Opens Google Calendar with pre-filled event details
 *
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {string} event.description - Event description
 * @param {string} event.location - Event location
 * @param {Date|string} event.start - Start date/time
 * @param {Date|string} event.end - End date/time
 * @returns {string} Google Calendar URL
 */
export const generateGoogleCalendarUrl = (event) => {
    const { title, description, location, start, end } = event;

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

/**
 * Generate ICS file content
 * Compatible with Apple Calendar, Outlook, and other calendar apps
 *
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {string} event.description - Event description
 * @param {string} event.location - Event location
 * @param {Date|string} event.start - Start date/time
 * @param {Date|string} event.end - End date/time
 * @param {Object} event.organizer - Optional organizer { name, email }
 * @returns {string} ICS file content
 */
export const generateICSContent = (event) => {
    const { title, description, location, start, end, organizer } = event;
    const uid = generateUID();
    const now = formatICSDate(new Date());

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Krib//Scheduling//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:${escapeICS(title || 'Appointment')}
DESCRIPTION:${escapeICS(description || '')}
LOCATION:${escapeICS(location || '')}
STATUS:CONFIRMED`;

    if (organizer?.email) {
        icsContent += `\nORGANIZER;CN=${escapeICS(organizer.name || 'Contractor')}:mailto:${organizer.email}`;
    }

    icsContent += `
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: ${escapeICS(title || 'Appointment')}
END:VALARM
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Tomorrow: ${escapeICS(title || 'Appointment')}
END:VALARM
END:VEVENT
END:VCALENDAR`;

    return icsContent;
};

/**
 * Download ICS file
 * Creates and downloads a .ics file that can be opened by calendar apps
 *
 * @param {Object} event - Event details
 * @param {string} filename - Optional filename (without extension)
 */
export const downloadICSFile = (event, filename = 'appointment') => {
    const icsContent = generateICSContent(event);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

    // Create download link
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/[^a-z0-9]/gi, '-')}.ics`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    URL.revokeObjectURL(link.href);
};

/**
 * Generate Apple Calendar URL
 * Uses webcal:// protocol or data URL for iOS compatibility
 * Note: Works best on iOS/macOS devices
 *
 * @param {Object} event - Event details
 * @returns {string} Data URL that triggers calendar app
 */
export const generateAppleCalendarUrl = (event) => {
    const icsContent = generateICSContent(event);
    // Use data URL for broader compatibility
    const base64 = btoa(unescape(encodeURIComponent(icsContent)));
    return `data:text/calendar;base64,${base64}`;
};

/**
 * Generate Outlook Web URL
 * Opens Outlook.com with pre-filled event details
 *
 * @param {Object} event - Event details
 * @returns {string} Outlook Web URL
 */
export const generateOutlookUrl = (event) => {
    const { title, description, location, start, end } = event;

    const startDate = new Date(start);
    const endDate = new Date(end);

    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: title || 'Appointment',
        body: description || '',
        location: location || '',
        startdt: startDate.toISOString(),
        enddt: endDate.toISOString()
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

/**
 * Generate Yahoo Calendar URL
 * Opens Yahoo Calendar with pre-filled event details
 *
 * @param {Object} event - Event details
 * @returns {string} Yahoo Calendar URL
 */
export const generateYahooCalendarUrl = (event) => {
    const { title, description, location, start, end } = event;

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Yahoo uses a different date format
    const formatYahooDate = (d) => {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    };

    const params = new URLSearchParams({
        v: '60',
        title: title || 'Appointment',
        desc: description || '',
        in_loc: location || '',
        st: formatYahooDate(startDate),
        et: formatYahooDate(endDate)
    });

    return `https://calendar.yahoo.com/?${params.toString()}`;
};

/**
 * Create event object from job data
 * Helper function to transform job data into calendar event format
 *
 * @param {Object} job - Job object from Firestore
 * @param {Object} contractor - Contractor info
 * @returns {Object} Event object ready for calendar export
 */
export const createEventFromJob = (job, contractor = {}) => {
    const title = `${job.title || 'Service Appointment'} - ${contractor.companyName || 'Contractor'}`;

    const descriptionLines = [
        `Service: ${job.title || job.description || 'Home Service'}`,
        '',
        `Contractor: ${contractor.companyName || job.contractorName || 'Your Contractor'}`
    ];

    if (contractor.phone || job.contractorPhone) {
        descriptionLines.push(`Phone: ${contractor.phone || job.contractorPhone}`);
    }

    if (job.notes || job.customerNotes) {
        descriptionLines.push('', `Notes: ${job.notes || job.customerNotes}`);
    }

    descriptionLines.push('', 'Scheduled via Krib - https://mykrib.app');

    // Handle location
    const location = job.serviceAddress ||
                    job.customer?.address ||
                    job.address ||
                    '';

    // Handle dates - check for multi-day jobs
    let start, end;

    if (job.scheduledTime) {
        start = new Date(job.scheduledTime.toDate ? job.scheduledTime.toDate() : job.scheduledTime);
    } else if (job.scheduledDate) {
        start = new Date(job.scheduledDate.toDate ? job.scheduledDate.toDate() : job.scheduledDate);
    } else {
        start = new Date();
    }

    if (job.scheduledEndTime) {
        end = new Date(job.scheduledEndTime.toDate ? job.scheduledEndTime.toDate() : job.scheduledEndTime);
    } else if (job.multiDaySchedule?.endDate) {
        // Multi-day job: use the end date with daily end time
        const endDate = new Date(job.multiDaySchedule.endDate);
        if (job.multiDaySchedule.dailyEndTime) {
            const [hours, minutes] = job.multiDaySchedule.dailyEndTime.split(':');
            endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
            endDate.setHours(17, 0, 0, 0); // Default 5 PM
        }
        end = endDate;
    } else {
        // Default to 2 hours after start
        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    }

    return {
        title,
        description: descriptionLines.join('\n'),
        location,
        start,
        end,
        organizer: contractor.email ? {
            name: contractor.companyName || 'Contractor',
            email: contractor.email
        } : undefined
    };
};

export default {
    generateGoogleCalendarUrl,
    generateICSContent,
    downloadICSFile,
    generateAppleCalendarUrl,
    generateOutlookUrl,
    generateYahooCalendarUrl,
    createEventFromJob
};
