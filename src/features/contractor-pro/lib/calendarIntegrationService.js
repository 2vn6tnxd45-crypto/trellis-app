// src/features/contractor-pro/lib/calendarIntegrationService.js
// ============================================
// GOOGLE CALENDAR INTEGRATION SERVICE
// ============================================
// Two-way sync between contractor calendar and crew Google Calendars
// - Jobs sync TO crew member calendars
// - Personal blocks sync FROM crew calendars to availability
// - Real-time availability updates

import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

export const CALENDAR_SYNC_STATUS = {
    NOT_CONNECTED: 'not_connected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error',
    SYNCING: 'syncing'
};

export const AVAILABILITY_BLOCK_TYPES = {
    PERSONAL: 'personal',           // Personal appointment
    DOCTOR: 'doctor',               // Medical appointment
    FAMILY: 'family',               // Family obligation
    TRAINING: 'training',           // Internal training/meeting
    PARTIAL_DAY: 'partial_day',     // Can only work part of day
    RECURRING: 'recurring',         // Recurring weekly block
    GOOGLE_CALENDAR: 'google_cal',  // Synced from Google Calendar
    SICK: 'sick',                   // Called in sick
    EMERGENCY: 'emergency'          // Emergency/unexpected
};

export const SYNC_DIRECTIONS = {
    TO_GOOGLE: 'to_google',         // Jobs -> Google Calendar
    FROM_GOOGLE: 'from_google',     // Google Calendar -> Availability blocks
    BIDIRECTIONAL: 'bidirectional'  // Both directions
};

// ============================================
// AVAILABILITY BLOCK SCHEMA
// ============================================

/**
 * @typedef {Object} AvailabilityBlock
 * @property {string} id - Unique identifier
 * @property {string} techId - Team member ID
 * @property {string} type - One of AVAILABILITY_BLOCK_TYPES
 * @property {string} startDate - YYYY-MM-DD
 * @property {string} endDate - YYYY-MM-DD (same as start for single day)
 * @property {string|null} startTime - HH:MM (null = all day)
 * @property {string|null} endTime - HH:MM (null = all day)
 * @property {boolean} isAllDay - Whether this blocks the entire day
 * @property {boolean} isRecurring - Whether this repeats
 * @property {string|null} recurringRule - RRULE string if recurring
 * @property {string} title - Display title
 * @property {string|null} notes - Additional notes
 * @property {string|null} googleEventId - Linked Google Calendar event ID
 * @property {string} source - 'manual' | 'google_sync' | 'system'
 * @property {string} status - 'active' | 'cancelled'
 * @property {string} createdAt - ISO timestamp
 * @property {string|null} createdBy - User who created it
 */

// ============================================
// GOOGLE CALENDAR CONFIGURATION
// ============================================

/**
 * @typedef {Object} CalendarConfig
 * @property {string} techId - Team member ID
 * @property {string|null} googleCalendarId - Connected Google Calendar ID
 * @property {string|null} accessToken - OAuth access token (encrypted)
 * @property {string|null} refreshToken - OAuth refresh token (encrypted)
 * @property {string} syncDirection - One of SYNC_DIRECTIONS
 * @property {boolean} syncJobsToCalendar - Push jobs to their calendar
 * @property {boolean} syncBlocksFromCalendar - Pull busy blocks from their calendar
 * @property {string[]} blockKeywords - Event titles that mark them unavailable (e.g., "busy", "blocked", "off")
 * @property {string} status - One of CALENDAR_SYNC_STATUS
 * @property {string|null} lastSyncAt - Last successful sync timestamp
 * @property {string|null} lastError - Last sync error message
 */

// ============================================
// HELPERS
// ============================================

/**
 * Generate unique ID for availability block
 */
const generateBlockId = () => {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Normalize time string to HH:MM format
 */
const normalizeTime = (time) => {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    return `${h.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
};

/**
 * Normalize date to YYYY-MM-DD
 */
const normalizeDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

/**
 * Check if two time ranges overlap
 */
const timeRangesOverlap = (start1, end1, start2, end2) => {
    // Convert to minutes for comparison
    const toMinutes = (time) => {
        if (!time) return null;
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    // If any is all-day (null), they overlap
    if (s1 === null || s2 === null) return true;

    return !(e1 <= s2 || e2 <= s1);
};

// ============================================
// AVAILABILITY BLOCK OPERATIONS
// ============================================

/**
 * Create an availability block
 * @param {Object} blockData - Block data
 * @returns {AvailabilityBlock}
 */
export const createAvailabilityBlock = (blockData) => {
    return {
        id: blockData.id || generateBlockId(),
        techId: blockData.techId,
        type: blockData.type || AVAILABILITY_BLOCK_TYPES.PERSONAL,
        startDate: normalizeDate(blockData.startDate),
        endDate: normalizeDate(blockData.endDate || blockData.startDate),
        startTime: normalizeTime(blockData.startTime),
        endTime: normalizeTime(blockData.endTime),
        isAllDay: !blockData.startTime || !blockData.endTime,
        isRecurring: blockData.isRecurring || false,
        recurringRule: blockData.recurringRule || null,
        title: blockData.title || getDefaultTitle(blockData.type),
        notes: blockData.notes || null,
        googleEventId: blockData.googleEventId || null,
        source: blockData.source || 'manual',
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: blockData.createdBy || null
    };
};

/**
 * Get default title for block type
 */
const getDefaultTitle = (type) => {
    const titles = {
        [AVAILABILITY_BLOCK_TYPES.PERSONAL]: 'Personal Time',
        [AVAILABILITY_BLOCK_TYPES.DOCTOR]: 'Medical Appointment',
        [AVAILABILITY_BLOCK_TYPES.FAMILY]: 'Family Obligation',
        [AVAILABILITY_BLOCK_TYPES.TRAINING]: 'Training/Meeting',
        [AVAILABILITY_BLOCK_TYPES.PARTIAL_DAY]: 'Partial Availability',
        [AVAILABILITY_BLOCK_TYPES.RECURRING]: 'Recurring Block',
        [AVAILABILITY_BLOCK_TYPES.GOOGLE_CALENDAR]: 'Calendar Event',
        [AVAILABILITY_BLOCK_TYPES.SICK]: 'Sick Day',
        [AVAILABILITY_BLOCK_TYPES.EMERGENCY]: 'Emergency'
    };
    return titles[type] || 'Unavailable';
};

/**
 * Add availability block for a team member
 */
export const addAvailabilityBlock = async (contractorId, blockData) => {
    try {
        const block = createAvailabilityBlock(blockData);

        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const docSnap = await getDoc(contractorRef);

        if (!docSnap.exists()) {
            throw new Error('Contractor not found');
        }

        const currentBlocks = docSnap.data().scheduling?.availabilityBlocks || [];
        const updatedBlocks = [...currentBlocks, block];

        await updateDoc(contractorRef, {
            'scheduling.availabilityBlocks': updatedBlocks,
            'scheduling.updatedAt': serverTimestamp()
        });

        return { success: true, block };
    } catch (error) {
        console.error('[calendarIntegration] Error adding availability block:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Remove availability block
 */
export const removeAvailabilityBlock = async (contractorId, blockId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const docSnap = await getDoc(contractorRef);

        if (!docSnap.exists()) {
            throw new Error('Contractor not found');
        }

        const currentBlocks = docSnap.data().scheduling?.availabilityBlocks || [];
        const updatedBlocks = currentBlocks.filter(b => b.id !== blockId);

        await updateDoc(contractorRef, {
            'scheduling.availabilityBlocks': updatedBlocks,
            'scheduling.updatedAt': serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[calendarIntegration] Error removing availability block:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update availability block
 */
export const updateAvailabilityBlock = async (contractorId, blockId, updates) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const docSnap = await getDoc(contractorRef);

        if (!docSnap.exists()) {
            throw new Error('Contractor not found');
        }

        const currentBlocks = docSnap.data().scheduling?.availabilityBlocks || [];
        const updatedBlocks = currentBlocks.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    ...updates,
                    startDate: updates.startDate ? normalizeDate(updates.startDate) : b.startDate,
                    endDate: updates.endDate ? normalizeDate(updates.endDate) : b.endDate,
                    startTime: updates.startTime !== undefined ? normalizeTime(updates.startTime) : b.startTime,
                    endTime: updates.endTime !== undefined ? normalizeTime(updates.endTime) : b.endTime,
                    isAllDay: updates.startTime === null || updates.endTime === null,
                    updatedAt: new Date().toISOString()
                };
            }
            return b;
        });

        await updateDoc(contractorRef, {
            'scheduling.availabilityBlocks': updatedBlocks,
            'scheduling.updatedAt': serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[calendarIntegration] Error updating availability block:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// AVAILABILITY CHECKING
// ============================================

/**
 * Get all availability blocks for a tech on a specific date
 * @param {Array} availabilityBlocks - All blocks
 * @param {string} techId - Tech ID
 * @param {string|Date} date - Date to check
 * @returns {AvailabilityBlock[]}
 */
export const getBlocksForTechOnDate = (availabilityBlocks = [], techId, date) => {
    const checkDate = normalizeDate(date);
    if (!checkDate) return [];

    return availabilityBlocks.filter(block => {
        if (block.techId !== techId) return false;
        if (block.status !== 'active') return false;

        // Check if date falls within block range
        if (checkDate < block.startDate || checkDate > block.endDate) {
            // Check for recurring blocks
            if (block.isRecurring && block.recurringRule) {
                return isDateInRecurringRule(checkDate, block);
            }
            return false;
        }

        return true;
    });
};

/**
 * Check if a date matches a recurring rule (simplified - weekly only for now)
 */
const isDateInRecurringRule = (checkDate, block) => {
    // Simple weekly recurring check
    if (block.recurringRule?.includes('WEEKLY')) {
        const blockDay = new Date(block.startDate).getDay();
        const checkDay = new Date(checkDate).getDay();
        return blockDay === checkDay;
    }
    return false;
};

/**
 * Check if a tech is available at a specific date/time
 * @param {Object} tech - Team member object
 * @param {Array} availabilityBlocks - All availability blocks
 * @param {string|Date} date - Date to check
 * @param {string|null} startTime - Start time (HH:MM)
 * @param {string|null} endTime - End time (HH:MM)
 * @returns {{available: boolean, blocks: AvailabilityBlock[], reason: string|null}}
 */
export const checkTechAvailability = (tech, availabilityBlocks, date, startTime = null, endTime = null) => {
    const checkDate = normalizeDate(date);
    const blocks = getBlocksForTechOnDate(availabilityBlocks, tech.id, checkDate);

    if (blocks.length === 0) {
        return { available: true, blocks: [], reason: null };
    }

    // Check for all-day blocks
    const allDayBlocks = blocks.filter(b => b.isAllDay);
    if (allDayBlocks.length > 0) {
        return {
            available: false,
            blocks: allDayBlocks,
            reason: allDayBlocks[0].title || 'Unavailable (all day)'
        };
    }

    // If no specific time provided, just return all blocks as warnings
    if (!startTime || !endTime) {
        return {
            available: true,
            blocks,
            reason: `Has ${blocks.length} time block(s) on this day`,
            partialBlocks: blocks
        };
    }

    // Check for time overlap
    const overlappingBlocks = blocks.filter(b =>
        timeRangesOverlap(startTime, endTime, b.startTime, b.endTime)
    );

    if (overlappingBlocks.length > 0) {
        return {
            available: false,
            blocks: overlappingBlocks,
            reason: overlappingBlocks[0].title || 'Time conflict'
        };
    }

    return {
        available: true,
        blocks,
        reason: null,
        partialBlocks: blocks
    };
};

/**
 * Get comprehensive availability for a tech across multiple days
 * Combines: working hours, time off, availability blocks, existing jobs
 */
export const getComprehensiveAvailability = (
    tech,
    availabilityBlocks = [],
    timeOffEntries = [],
    existingJobs = [],
    startDate,
    endDate
) => {
    const result = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dateStr = normalizeDate(current);
        const dayName = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        const dayResult = {
            date: dateStr,
            dayName,
            available: true,
            workingHours: null,
            blocks: [],
            jobs: [],
            reasons: []
        };

        // Check working hours
        const workingHours = tech.workingHours?.[dayName];
        if (!workingHours?.enabled) {
            dayResult.available = false;
            dayResult.reasons.push('Day off (working hours)');
        } else {
            dayResult.workingHours = {
                start: workingHours.start || '08:00',
                end: workingHours.end || '17:00'
            };
        }

        // Check time off
        const timeOff = timeOffEntries.filter(to => {
            const toStart = normalizeDate(to.startDate);
            const toEnd = normalizeDate(to.endDate || to.startDate);
            return dateStr >= toStart && dateStr <= toEnd && to.techId === tech.id;
        });
        if (timeOff.length > 0) {
            dayResult.available = false;
            dayResult.reasons.push(`Time off: ${timeOff[0].type || 'scheduled'}`);
        }

        // Check availability blocks
        const blocks = getBlocksForTechOnDate(availabilityBlocks, tech.id, dateStr);
        dayResult.blocks = blocks;
        const allDayBlocks = blocks.filter(b => b.isAllDay);
        if (allDayBlocks.length > 0) {
            dayResult.available = false;
            dayResult.reasons.push(allDayBlocks[0].title);
        }

        // Check existing jobs
        const jobsOnDay = existingJobs.filter(job => {
            if (!job.assignedTechId && !job.assignedCrewIds?.includes(tech.id)) return false;
            if (job.assignedTechId !== tech.id && !job.assignedCrewIds?.includes(tech.id)) return false;
            const jobDate = normalizeDate(job.scheduledTime || job.scheduledDate);
            return jobDate === dateStr;
        });
        dayResult.jobs = jobsOnDay;

        result.push(dayResult);
        current.setDate(current.getDate() + 1);
    }

    return result;
};

// ============================================
// GOOGLE CALENDAR SYNC (Placeholder for OAuth flow)
// ============================================

/**
 * Initialize Google Calendar connection for a team member
 * This would redirect to Google OAuth flow
 */
export const initGoogleCalendarConnect = async (contractorId, techId) => {
    // In production, this would:
    // 1. Generate OAuth URL with proper scopes
    // 2. Redirect user to Google consent screen
    // 3. Handle callback with auth code
    // 4. Exchange for access/refresh tokens
    // 5. Store tokens securely

    // For now, return placeholder
    return {
        success: true,
        message: 'Google Calendar integration requires OAuth setup',
        authUrl: null // Would be Google OAuth URL
    };
};

/**
 * Disconnect Google Calendar for a team member
 */
export const disconnectGoogleCalendar = async (contractorId, techId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        const docSnap = await getDoc(contractorRef);

        if (!docSnap.exists()) {
            throw new Error('Contractor not found');
        }

        const teamMembers = docSnap.data().teamMembers || [];
        const updatedMembers = teamMembers.map(m => {
            if (m.id === techId) {
                return {
                    ...m,
                    calendarConfig: {
                        ...m.calendarConfig,
                        status: CALENDAR_SYNC_STATUS.NOT_CONNECTED,
                        accessToken: null,
                        refreshToken: null,
                        googleCalendarId: null,
                        lastSyncAt: null
                    }
                };
            }
            return m;
        });

        await updateDoc(contractorRef, {
            teamMembers: updatedMembers,
            updatedAt: serverTimestamp()
        });

        // Also remove any Google-synced availability blocks
        const blocks = docSnap.data().scheduling?.availabilityBlocks || [];
        const filteredBlocks = blocks.filter(b =>
            !(b.techId === techId && b.source === 'google_sync')
        );

        await updateDoc(contractorRef, {
            'scheduling.availabilityBlocks': filteredBlocks
        });

        return { success: true };
    } catch (error) {
        console.error('[calendarIntegration] Error disconnecting calendar:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Sync jobs to Google Calendar (push)
 * Would be called when a job is scheduled/rescheduled
 */
export const syncJobToGoogleCalendar = async (job, techCalendarConfig) => {
    // In production, this would:
    // 1. Check if tech has calendar connected
    // 2. Use Google Calendar API to create/update event
    // 3. Store Google event ID in job for future updates

    console.log('[calendarIntegration] Would sync job to Google Calendar:', job.id);
    return { success: true, googleEventId: null };
};

/**
 * Sync blocks from Google Calendar (pull)
 * Would be called periodically or on-demand
 */
export const syncFromGoogleCalendar = async (contractorId, techId, calendarConfig) => {
    // In production, this would:
    // 1. Use Google Calendar API to fetch events
    // 2. Filter for events matching blockKeywords
    // 3. Create/update availability blocks
    // 4. Handle deleted events

    console.log('[calendarIntegration] Would sync from Google Calendar for tech:', techId);
    return { success: true, blocksCreated: 0, blocksUpdated: 0 };
};

// ============================================
// QUICK AVAILABILITY BLOCKS (Common patterns)
// ============================================

/**
 * Mark a tech as sick for today
 */
export const markSickToday = async (contractorId, techId, createdBy) => {
    const today = normalizeDate(new Date());
    return addAvailabilityBlock(contractorId, {
        techId,
        type: AVAILABILITY_BLOCK_TYPES.SICK,
        startDate: today,
        endDate: today,
        startTime: null,
        endTime: null,
        title: 'Sick Day',
        source: 'manual',
        createdBy
    });
};

/**
 * Block a partial day (e.g., leaving early)
 */
export const blockPartialDay = async (contractorId, techId, date, startTime, endTime, reason, createdBy) => {
    return addAvailabilityBlock(contractorId, {
        techId,
        type: AVAILABILITY_BLOCK_TYPES.PARTIAL_DAY,
        startDate: date,
        endDate: date,
        startTime,
        endTime,
        title: reason || 'Unavailable',
        source: 'manual',
        createdBy
    });
};

/**
 * Create recurring weekly block (e.g., every Tuesday 2-4pm for physical therapy)
 */
export const createRecurringBlock = async (contractorId, techId, dayOfWeek, startTime, endTime, title, createdBy) => {
    // Get next occurrence of this day of week
    const today = new Date();
    const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayOfWeek.toLowerCase());
    const daysUntil = (targetDay - today.getDay() + 7) % 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + daysUntil);

    return addAvailabilityBlock(contractorId, {
        techId,
        type: AVAILABILITY_BLOCK_TYPES.RECURRING,
        startDate: normalizeDate(startDate),
        endDate: normalizeDate(startDate), // Recurring rule handles expansion
        startTime,
        endTime,
        isRecurring: true,
        recurringRule: `RRULE:FREQ=WEEKLY;BYDAY=${dayOfWeek.substring(0, 2).toUpperCase()}`,
        title,
        source: 'manual',
        createdBy
    });
};

// ============================================
// EXPORTS
// ============================================

export default {
    // Constants
    CALENDAR_SYNC_STATUS,
    AVAILABILITY_BLOCK_TYPES,
    SYNC_DIRECTIONS,

    // Block operations
    createAvailabilityBlock,
    addAvailabilityBlock,
    removeAvailabilityBlock,
    updateAvailabilityBlock,

    // Availability checking
    getBlocksForTechOnDate,
    checkTechAvailability,
    getComprehensiveAvailability,

    // Google Calendar
    initGoogleCalendarConnect,
    disconnectGoogleCalendar,
    syncJobToGoogleCalendar,
    syncFromGoogleCalendar,

    // Quick actions
    markSickToday,
    blockPartialDay,
    createRecurringBlock
};
