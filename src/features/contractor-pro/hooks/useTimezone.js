// src/features/contractor-pro/hooks/useTimezone.js
// ============================================
// TIMEZONE HOOK
// ============================================
// React hook for timezone-aware scheduling operations

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';
import {
    detectTimezone,
    getContractorTimezone,
    formatTimeInTimezone,
    formatDateInTimezone,
    formatDateTimeInTimezone,
    getTimezoneAbbreviation,
    isSameDayInTimezone,
    createDateInTimezone,
    parseTimeInTimezone,
    isValidTimezone,
    US_TIMEZONES
} from '../lib/timezoneUtils';

/**
 * Hook for managing contractor timezone settings and formatting
 * @param {Object} contractorProfile - Contractor profile from useContractorAuth
 * @param {string} contractorId - Contractor ID for saving settings
 * @returns {Object} Timezone utilities and state
 */
export const useTimezone = (contractorProfile, contractorId) => {
    const [saving, setSaving] = useState(false);

    // Get the contractor's timezone or detect from browser
    const timezone = useMemo(() => {
        return getContractorTimezone(contractorProfile);
    }, [contractorProfile]);

    // Detected browser timezone (for comparison/suggestions)
    const browserTimezone = useMemo(() => detectTimezone(), []);

    // Check if contractor timezone matches browser
    const timezoneMatchesBrowser = timezone === browserTimezone;

    // Get abbreviation for display
    const timezoneAbbr = useMemo(() => {
        return getTimezoneAbbreviation(timezone);
    }, [timezone]);

    // Save timezone to contractor profile
    const setTimezone = useCallback(async (newTimezone) => {
        if (!contractorId || !isValidTimezone(newTimezone)) return;

        setSaving(true);
        try {
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'scheduling.timezone': newTimezone
            });
        } catch (error) {
            console.error('Failed to save timezone:', error);
            throw error;
        } finally {
            setSaving(false);
        }
    }, [contractorId]);

    // Format helpers bound to contractor timezone
    const formatTime = useCallback((date, includeTimezone = false) => {
        return formatTimeInTimezone(date, timezone, includeTimezone);
    }, [timezone]);

    const formatDate = useCallback((date, format = 'medium') => {
        return formatDateInTimezone(date, timezone, format);
    }, [timezone]);

    const formatDateTime = useCallback((date, includeTimezone = true) => {
        return formatDateTimeInTimezone(date, timezone, includeTimezone);
    }, [timezone]);

    // Check if two dates are same day in contractor's timezone
    const isSameDay = useCallback((date1, date2) => {
        return isSameDayInTimezone(date1, date2, timezone);
    }, [timezone]);

    // Create a date from components in contractor's timezone
    const createDate = useCallback((year, month, day, hour, minute) => {
        return createDateInTimezone(year, month, day, hour, minute, timezone);
    }, [timezone]);

    // Parse a time string in contractor's timezone
    const parseTime = useCallback((timeStr, baseDate) => {
        return parseTimeInTimezone(timeStr, baseDate, timezone);
    }, [timezone]);

    // Get today's date formatted in contractor's timezone
    const today = useMemo(() => {
        return formatDateInTimezone(new Date(), timezone, 'full');
    }, [timezone]);

    return {
        // Current timezone
        timezone,
        timezoneAbbr,
        browserTimezone,
        timezoneMatchesBrowser,

        // Actions
        setTimezone,
        saving,

        // Format helpers
        formatTime,
        formatDate,
        formatDateTime,

        // Date helpers
        isSameDay,
        createDate,
        parseTime,
        today,

        // Constants
        availableTimezones: US_TIMEZONES
    };
};

export default useTimezone;
