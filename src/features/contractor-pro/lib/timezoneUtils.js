// src/features/contractor-pro/lib/timezoneUtils.js
// ============================================
// TIMEZONE UTILITIES
// ============================================
// Handles timezone detection, storage, and conversion for scheduling

/**
 * Get the browser's detected timezone (IANA identifier)
 * @returns {string} IANA timezone identifier (e.g., 'America/New_York')
 */
export const detectTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        console.warn('Failed to detect timezone, defaulting to UTC:', e);
        return 'UTC';
    }
};

/**
 * Common US timezones for selection
 */
export const US_TIMEZONES = [
    { value: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'ET' },
    { value: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CT' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MT' },
    { value: 'America/Phoenix', label: 'Arizona (MST)', abbr: 'MST' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PT' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)', abbr: 'AKT' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', abbr: 'HST' }
];

/**
 * Get timezone abbreviation for display
 * @param {string} ianaTimezone - IANA timezone identifier
 * @param {Date} date - Date to check (for DST)
 * @returns {string} Timezone abbreviation (e.g., 'EST', 'EDT')
 */
export const getTimezoneAbbreviation = (ianaTimezone, date = new Date()) => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: ianaTimezone,
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(date);
        const tzPart = parts.find(p => p.type === 'timeZoneName');
        return tzPart?.value || ianaTimezone;
    } catch (e) {
        return ianaTimezone;
    }
};

/**
 * Get the UTC offset for a timezone
 * @param {string} ianaTimezone - IANA timezone identifier
 * @param {Date} date - Date to check (for DST)
 * @returns {number} Offset in minutes from UTC
 */
export const getTimezoneOffset = (ianaTimezone, date = new Date()) => {
    try {
        // Get the time in UTC
        const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
        // Get the time in the target timezone
        const tzDate = new Date(date.toLocaleString('en-US', { timeZone: ianaTimezone }));
        // Return the difference in minutes
        return (tzDate - utcDate) / (1000 * 60);
    } catch (e) {
        return 0;
    }
};

/**
 * Convert a date from one timezone to another
 * @param {Date|string} date - The date to convert
 * @param {string} fromTimezone - Source IANA timezone
 * @param {string} toTimezone - Target IANA timezone
 * @returns {Date} Converted date
 */
export const convertTimezone = (date, fromTimezone, toTimezone) => {
    if (!date) return null;

    const inputDate = typeof date === 'string' ? new Date(date) : date;

    // Get the offset difference
    const fromOffset = getTimezoneOffset(fromTimezone, inputDate);
    const toOffset = getTimezoneOffset(toTimezone, inputDate);
    const diffMinutes = toOffset - fromOffset;

    // Apply the offset
    return new Date(inputDate.getTime() + diffMinutes * 60 * 1000);
};

/**
 * Format a date/time in a specific timezone
 * @param {Date|string} date - The date to format
 * @param {string} timezone - IANA timezone identifier
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatInTimezone = (date, timezone, options = {}) => {
    if (!date) return '';

    const inputDate = typeof date === 'string' ? new Date(date) : date;

    const defaultOptions = {
        timeZone: timezone,
        ...options
    };

    try {
        return new Intl.DateTimeFormat('en-US', defaultOptions).format(inputDate);
    } catch (e) {
        console.warn('Failed to format date in timezone:', e);
        return inputDate.toLocaleString();
    }
};

/**
 * Format time only in a specific timezone
 * @param {Date|string} date - The date to format
 * @param {string} timezone - IANA timezone identifier
 * @param {boolean} includeTimezone - Whether to include timezone abbreviation
 * @returns {string} Formatted time string (e.g., "2:30 PM EST")
 */
export const formatTimeInTimezone = (date, timezone, includeTimezone = false) => {
    if (!date) return '';

    const options = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };

    if (includeTimezone) {
        options.timeZoneName = 'short';
    }

    return formatInTimezone(date, timezone, options);
};

/**
 * Format date only in a specific timezone
 * @param {Date|string} date - The date to format
 * @param {string} timezone - IANA timezone identifier
 * @param {string} format - 'short', 'medium', 'long', 'full'
 * @returns {string} Formatted date string
 */
export const formatDateInTimezone = (date, timezone, format = 'medium') => {
    if (!date) return '';

    const formats = {
        short: { month: 'numeric', day: 'numeric' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { month: 'long', day: 'numeric', year: 'numeric' },
        full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    };

    return formatInTimezone(date, timezone, formats[format] || formats.medium);
};

/**
 * Format date and time in a specific timezone
 * @param {Date|string} date - The date to format
 * @param {string} timezone - IANA timezone identifier
 * @param {boolean} includeTimezone - Whether to include timezone abbreviation
 * @returns {string} Formatted date/time string
 */
export const formatDateTimeInTimezone = (date, timezone, includeTimezone = true) => {
    if (!date) return '';

    const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };

    if (includeTimezone) {
        options.timeZoneName = 'short';
    }

    return formatInTimezone(date, timezone, options);
};

/**
 * Create a date in a specific timezone
 * This is useful when the user selects a time and you need to store it as UTC
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {number} day - Day of month
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute
 * @param {string} timezone - IANA timezone identifier
 * @returns {Date} Date object representing the time in UTC
 */
export const createDateInTimezone = (year, month, day, hour, minute, timezone) => {
    // Create a date string in the target timezone
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

    // Get the offset for this date in the target timezone
    const tempDate = new Date(dateStr);
    const offset = getTimezoneOffset(timezone, tempDate);

    // Adjust for the offset to get UTC
    return new Date(tempDate.getTime() - offset * 60 * 1000);
};

/**
 * Parse a time string (e.g., "14:30" or "2:30 PM") and create a Date
 * @param {string} timeStr - Time string
 * @param {Date} baseDate - Base date to use for year/month/day
 * @param {string} timezone - IANA timezone identifier
 * @returns {Date} Date object
 */
export const parseTimeInTimezone = (timeStr, baseDate, timezone) => {
    if (!timeStr || !baseDate) return null;

    let hours, minutes;

    // Try parsing 24-hour format (HH:MM)
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
        hours = parseInt(match24[1], 10);
        minutes = parseInt(match24[2], 10);
    } else {
        // Try parsing 12-hour format (H:MM AM/PM)
        const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match12) {
            hours = parseInt(match12[1], 10);
            minutes = parseInt(match12[2], 10);
            const isPM = match12[3].toUpperCase() === 'PM';

            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
        } else {
            return null;
        }
    }

    const base = typeof baseDate === 'string' ? new Date(baseDate) : baseDate;

    return createDateInTimezone(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        hours,
        minutes,
        timezone
    );
};

/**
 * Check if two dates are the same day in a specific timezone
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @param {string} timezone - IANA timezone identifier
 * @returns {boolean} True if same day
 */
export const isSameDayInTimezone = (date1, date2, timezone) => {
    if (!date1 || !date2) return false;

    // Use 'medium' format which includes year, month, and day
    const d1 = formatDateInTimezone(date1, timezone, 'medium');
    const d2 = formatDateInTimezone(date2, timezone, 'medium');

    return d1 === d2;
};

/**
 * Get start of day in a specific timezone
 * @param {Date|string} date - The date
 * @param {string} timezone - IANA timezone identifier
 * @returns {Date} Start of day in UTC
 */
export const getStartOfDayInTimezone = (date, timezone) => {
    const inputDate = typeof date === 'string' ? new Date(date) : date;

    // Get the date parts in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(inputDate);
    const year = parseInt(parts.find(p => p.type === 'year').value, 10);
    const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
    const day = parseInt(parts.find(p => p.type === 'day').value, 10);

    return createDateInTimezone(year, month, day, 0, 0, timezone);
};

/**
 * Get end of day in a specific timezone
 * @param {Date|string} date - The date
 * @param {string} timezone - IANA timezone identifier
 * @returns {Date} End of day in UTC (23:59:59)
 */
export const getEndOfDayInTimezone = (date, timezone) => {
    const inputDate = typeof date === 'string' ? new Date(date) : date;

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(inputDate);
    const year = parseInt(parts.find(p => p.type === 'year').value, 10);
    const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
    const day = parseInt(parts.find(p => p.type === 'day').value, 10);

    return createDateInTimezone(year, month, day, 23, 59, timezone);
};

/**
 * Get the contractor's stored timezone or detect it
 * @param {Object} contractorProfile - Contractor profile object
 * @returns {string} IANA timezone identifier
 */
export const getContractorTimezone = (contractorProfile) => {
    return contractorProfile?.scheduling?.timezone ||
        contractorProfile?.settings?.timezone ||
        detectTimezone();
};

/**
 * Validate if a string is a valid IANA timezone
 * @param {string} timezone - Timezone string to validate
 * @returns {boolean} True if valid
 */
export const isValidTimezone = (timezone) => {
    if (!timezone || typeof timezone !== 'string') return false;

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
    } catch (e) {
        return false;
    }
};

export default {
    detectTimezone,
    US_TIMEZONES,
    getTimezoneAbbreviation,
    getTimezoneOffset,
    convertTimezone,
    formatInTimezone,
    formatTimeInTimezone,
    formatDateInTimezone,
    formatDateTimeInTimezone,
    createDateInTimezone,
    parseTimeInTimezone,
    isSameDayInTimezone,
    getStartOfDayInTimezone,
    getEndOfDayInTimezone,
    getContractorTimezone,
    isValidTimezone
};
