// src/features/booking-widget/lib/availabilityService.js
// ============================================
// AVAILABILITY CALCULATION SERVICE
// ============================================
// Calculates available booking slots based on contractor schedule and existing jobs

import { db } from '../../../config/firebase';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    Timestamp
} from 'firebase/firestore';

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_BOOKING_SETTINGS = {
    enabled: false,
    allowedServices: [],
    leadTimeHours: 24,
    maxAdvanceDays: 30,
    slotDurationMinutes: 60,
    bufferMinutes: 30,
    customization: {
        primaryColor: '#10b981',
        buttonText: 'Book Now',
        headerText: 'Schedule Service'
    },
    requirePhone: true,
    requireAddress: true
};

export const DEFAULT_WORKING_HOURS = {
    monday: { enabled: true, start: '08:00', end: '17:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '14:00' },
    sunday: { enabled: false, start: '09:00', end: '14:00' }
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse time string to minutes since midnight
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Convert minutes to time string
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time in HH:MM format
 */
const minutesToTimeString = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Format time for display
 * @param {string} timeStr - Time in HH:MM format
 * @returns {string} Formatted time (e.g., "9:00 AM")
 */
export const formatTimeDisplay = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Get date string in YYYY-MM-DD format
 * @param {Date} date - Date object
 * @returns {string} Date string
 */
const getDateString = (date) => {
    return date.toISOString().split('T')[0];
};

/**
 * Check if two time ranges overlap
 * @param {number} start1 - Start of range 1 (minutes)
 * @param {number} end1 - End of range 1 (minutes)
 * @param {number} start2 - Start of range 2 (minutes)
 * @param {number} end2 - End of range 2 (minutes)
 * @returns {boolean} True if ranges overlap
 */
const rangesOverlap = (start1, end1, start2, end2) => {
    return start1 < end2 && end1 > start2;
};

// ============================================
// MAIN AVAILABILITY FUNCTIONS
// ============================================

/**
 * Get contractor's booking widget settings
 * @param {string} contractorId - Contractor ID
 * @returns {Promise<Object>} Booking settings
 */
export const getBookingSettings = async (contractorId) => {
    try {
        const contractorRef = doc(db, 'contractors', contractorId);
        const contractorDoc = await getDoc(contractorRef);

        if (!contractorDoc.exists()) {
            return { ...DEFAULT_BOOKING_SETTINGS, error: 'Contractor not found' };
        }

        const data = contractorDoc.data();
        return {
            ...DEFAULT_BOOKING_SETTINGS,
            ...data.bookingWidget,
            workingHours: data.scheduling?.workingHours || DEFAULT_WORKING_HOURS,
            serviceTypes: data.serviceTypes || [],
            timezone: data.timezone || 'America/New_York'
        };
    } catch (error) {
        console.error('Error getting booking settings:', error);
        return { ...DEFAULT_BOOKING_SETTINGS, error: error.message };
    }
};

/**
 * Get contractor's existing jobs in a date range
 * @param {string} contractorId - Contractor ID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Promise<Array>} Array of scheduled jobs
 */
export const getScheduledJobs = async (contractorId, startDate, endDate) => {
    try {
        const jobsRef = collection(db, 'contractors', contractorId, 'jobs');

        // Query for jobs within date range
        const q = query(
            jobsRef,
            where('scheduledDate', '>=', Timestamp.fromDate(startDate)),
            where('scheduledDate', '<=', Timestamp.fromDate(endDate)),
            where('status', 'in', ['scheduled', 'confirmed', 'assigned', 'in_progress'])
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            scheduledDate: doc.data().scheduledDate?.toDate?.() || new Date(doc.data().scheduledDate)
        }));
    } catch (error) {
        console.error('Error getting scheduled jobs:', error);
        return [];
    }
};

/**
 * Get available time slots for a date range
 * @param {string} contractorId - Contractor ID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {string} serviceType - Optional service type filter
 * @returns {Promise<Object>} Available slots by date
 */
export const getAvailableSlots = async (contractorId, startDate, endDate, serviceType = null) => {
    try {
        // Get contractor settings
        const settings = await getBookingSettings(contractorId);

        if (!settings.enabled) {
            return { error: 'Online booking is not enabled', slots: {} };
        }

        // Get existing jobs
        const existingJobs = await getScheduledJobs(contractorId, startDate, endDate);

        // Calculate lead time cutoff
        const leadTimeCutoff = new Date();
        leadTimeCutoff.setHours(leadTimeCutoff.getHours() + settings.leadTimeHours);

        // Get slot duration (might vary by service type)
        let slotDuration = settings.slotDurationMinutes;
        if (serviceType && settings.serviceDurations?.[serviceType]) {
            slotDuration = settings.serviceDurations[serviceType];
        }

        const buffer = settings.bufferMinutes;
        const workingHours = settings.workingHours || DEFAULT_WORKING_HOURS;

        // Generate slots for each day
        const slotsByDate = {};
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = getDateString(currentDate);
            const dayName = DAY_NAMES[currentDate.getDay()];
            const dayConfig = workingHours[dayName];

            // Skip if day is not enabled
            if (!dayConfig?.enabled) {
                slotsByDate[dateStr] = { date: dateStr, dayName, slots: [], available: false };
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            // Generate slots for this day
            const dayStart = parseTimeToMinutes(dayConfig.start);
            const dayEnd = parseTimeToMinutes(dayConfig.end);

            // Get jobs for this specific day
            const dayJobs = existingJobs.filter(job => {
                const jobDate = new Date(job.scheduledDate);
                return getDateString(jobDate) === dateStr;
            });

            // Build blocked time ranges from existing jobs
            const blockedRanges = dayJobs.map(job => {
                const jobTime = new Date(job.scheduledDate);
                const jobStartMinutes = jobTime.getHours() * 60 + jobTime.getMinutes();
                const jobDuration = job.estimatedDuration || slotDuration;
                return {
                    start: jobStartMinutes - buffer,
                    end: jobStartMinutes + jobDuration + buffer
                };
            });

            // Generate available slots
            const slots = [];
            let currentSlotStart = dayStart;

            while (currentSlotStart + slotDuration <= dayEnd) {
                const slotEnd = currentSlotStart + slotDuration;

                // Check if slot conflicts with any blocked range
                const isBlocked = blockedRanges.some(range =>
                    rangesOverlap(currentSlotStart, slotEnd, range.start, range.end)
                );

                // Check if slot is past lead time cutoff
                const slotDateTime = new Date(currentDate);
                slotDateTime.setHours(Math.floor(currentSlotStart / 60), currentSlotStart % 60, 0, 0);
                const isPastCutoff = slotDateTime < leadTimeCutoff;

                const startTime = minutesToTimeString(currentSlotStart);
                const endTime = minutesToTimeString(slotEnd);

                slots.push({
                    start: startTime,
                    end: endTime,
                    startDisplay: formatTimeDisplay(startTime),
                    endDisplay: formatTimeDisplay(endTime),
                    available: !isBlocked && !isPastCutoff,
                    reason: isBlocked ? 'booked' : isPastCutoff ? 'past_cutoff' : null
                });

                // Move to next slot
                currentSlotStart += slotDuration;
            }

            slotsByDate[dateStr] = {
                date: dateStr,
                dayName,
                dayLabel: currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                slots,
                available: slots.some(s => s.available),
                availableCount: slots.filter(s => s.available).length
            };

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return {
            success: true,
            contractorId,
            startDate: getDateString(startDate),
            endDate: getDateString(endDate),
            slotDurationMinutes: slotDuration,
            leadTimeHours: settings.leadTimeHours,
            slots: slotsByDate
        };
    } catch (error) {
        console.error('Error calculating availability:', error);
        return { error: error.message, slots: {} };
    }
};

/**
 * Check if a specific slot is available
 * @param {string} contractorId - Contractor ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format
 * @param {number} duration - Duration in minutes
 * @returns {Promise<Object>} Availability result
 */
export const checkSlotAvailability = async (contractorId, date, time, duration = 60) => {
    try {
        const targetDate = new Date(date);
        const slots = await getAvailableSlots(contractorId, targetDate, targetDate);

        if (slots.error) {
            return { available: false, error: slots.error };
        }

        const daySlots = slots.slots[date];
        if (!daySlots) {
            return { available: false, error: 'Date not available' };
        }

        const slot = daySlots.slots.find(s => s.start === time);
        if (!slot) {
            return { available: false, error: 'Time slot not found' };
        }

        return {
            available: slot.available,
            slot,
            reason: slot.reason
        };
    } catch (error) {
        console.error('Error checking slot availability:', error);
        return { available: false, error: error.message };
    }
};

/**
 * Get next available dates (for quick display)
 * @param {string} contractorId - Contractor ID
 * @param {number} count - Number of dates to return
 * @returns {Promise<Array>} Array of next available dates
 */
export const getNextAvailableDates = async (contractorId, count = 5) => {
    try {
        const settings = await getBookingSettings(contractorId);
        if (!settings.enabled) {
            return [];
        }

        const startDate = new Date();
        startDate.setHours(startDate.getHours() + settings.leadTimeHours);

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + settings.maxAdvanceDays);

        const slots = await getAvailableSlots(contractorId, startDate, endDate);
        if (slots.error) {
            return [];
        }

        const availableDates = Object.values(slots.slots)
            .filter(day => day.available)
            .slice(0, count)
            .map(day => ({
                date: day.date,
                dayLabel: day.dayLabel,
                availableSlots: day.availableCount
            }));

        return availableDates;
    } catch (error) {
        console.error('Error getting next available dates:', error);
        return [];
    }
};

/**
 * Update contractor's booking widget settings
 * @param {string} contractorId - Contractor ID
 * @param {Object} settings - New settings
 * @returns {Promise<void>}
 */
export const updateBookingSettings = async (contractorId, settings) => {
    try {
        const { updateDoc, serverTimestamp } = await import('firebase/firestore');
        const contractorRef = doc(db, 'contractors', contractorId);

        await updateDoc(contractorRef, {
            bookingWidget: settings,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating booking settings:', error);
        throw error;
    }
};

export default {
    DEFAULT_BOOKING_SETTINGS,
    DEFAULT_WORKING_HOURS,
    getBookingSettings,
    getAvailableSlots,
    checkSlotAvailability,
    getNextAvailableDates,
    updateBookingSettings,
    formatTimeDisplay
};
