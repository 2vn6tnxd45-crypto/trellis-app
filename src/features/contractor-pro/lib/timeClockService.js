// src/features/contractor-pro/lib/timeClockService.js
// ============================================
// TIME CLOCK INTEGRATION SERVICE
// ============================================
// Tracks tech work hours with automatic clock-in/out at job sites
// Integrates with job check-in/check-out for seamless time tracking

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db, getArtifactPath } from '../../../config/firebase';

// ============================================
// CONSTANTS
// ============================================

export const CLOCK_EVENTS = {
    CLOCK_IN: 'clock_in',
    CLOCK_OUT: 'clock_out',
    BREAK_START: 'break_start',
    BREAK_END: 'break_end',
    JOB_START: 'job_start',
    JOB_END: 'job_end'
};

export const CLOCK_STATUS = {
    CLOCKED_IN: 'clocked_in',
    ON_BREAK: 'on_break',
    CLOCKED_OUT: 'clocked_out'
};

// ============================================
// COLLECTION PATHS
// ============================================

const getTimeEntriesCollection = (contractorId, techId) =>
    `${getArtifactPath()}/contractors/${contractorId}/team/${techId}/time_entries`;

const getTechStatusDoc = (contractorId, techId) =>
    `${getArtifactPath()}/contractors/${contractorId}/team/${techId}`;

// ============================================
// CLOCK IN / OUT
// ============================================

/**
 * Clock in a tech for the day
 * @param {string} contractorId - Contractor ID
 * @param {string} techId - Tech ID
 * @param {Object} options - Additional options
 * @returns {Object} Result with time entry
 */
export const clockIn = async (contractorId, techId, options = {}) => {
    try {
        const { location, jobId, notes, autoFromJob = false } = options;

        const today = new Date().toISOString().split('T')[0];
        const entryId = `${today}_${Date.now()}`;

        const timeEntry = {
            id: entryId,
            date: today,
            techId,
            contractorId,
            eventType: CLOCK_EVENTS.CLOCK_IN,
            clockInTime: new Date().toISOString(),
            clockOutTime: null,
            location: location || null,
            jobId: jobId || null,
            autoFromJob,
            notes: notes || '',
            breaks: [],
            jobSegments: [],
            totalMinutes: 0,
            breakMinutes: 0,
            createdAt: serverTimestamp()
        };

        // Save time entry
        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), entryId);
        await setDoc(entryRef, timeEntry);

        // Update tech status
        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        await updateDoc(techRef, {
            clockStatus: CLOCK_STATUS.CLOCKED_IN,
            currentTimeEntryId: entryId,
            lastClockIn: serverTimestamp(),
            lastClockInLocation: location || null
        });

        return { success: true, timeEntry };
    } catch (error) {
        console.error('[TimeClock] Clock in error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Clock out a tech for the day
 * @param {string} contractorId - Contractor ID
 * @param {string} techId - Tech ID
 * @param {Object} options - Additional options
 * @returns {Object} Result with summary
 */
export const clockOut = async (contractorId, techId, options = {}) => {
    try {
        const { location, notes, autoFromJob = false } = options;

        // Get current time entry
        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        const techDoc = await getDoc(techRef);

        if (!techDoc.exists()) {
            return { success: false, error: 'Tech not found' };
        }

        const techData = techDoc.data();
        const currentEntryId = techData.currentTimeEntryId;

        if (!currentEntryId) {
            return { success: false, error: 'No active time entry' };
        }

        // Get the time entry
        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), currentEntryId);
        const entryDoc = await getDoc(entryRef);

        if (!entryDoc.exists()) {
            return { success: false, error: 'Time entry not found' };
        }

        const entry = entryDoc.data();
        const clockOutTime = new Date();
        const clockInTime = new Date(entry.clockInTime);

        // Calculate total minutes
        const totalMs = clockOutTime - clockInTime;
        const totalMinutes = Math.round(totalMs / (1000 * 60));

        // Calculate break minutes
        const breakMinutes = (entry.breaks || []).reduce((sum, brk) => {
            if (brk.endTime) {
                return sum + Math.round((new Date(brk.endTime) - new Date(brk.startTime)) / (1000 * 60));
            }
            return sum;
        }, 0);

        // Calculate job minutes
        const jobMinutes = (entry.jobSegments || []).reduce((sum, seg) => {
            return sum + (seg.minutes || 0);
        }, 0);

        // Update time entry
        await updateDoc(entryRef, {
            clockOutTime: clockOutTime.toISOString(),
            clockOutLocation: location || null,
            totalMinutes,
            breakMinutes,
            workMinutes: totalMinutes - breakMinutes,
            jobMinutes,
            notes: notes ? `${entry.notes || ''}\n${notes}`.trim() : entry.notes,
            autoClockOut: autoFromJob,
            updatedAt: serverTimestamp()
        });

        // Update tech status
        await updateDoc(techRef, {
            clockStatus: CLOCK_STATUS.CLOCKED_OUT,
            currentTimeEntryId: null,
            lastClockOut: serverTimestamp(),
            lastClockOutLocation: location || null
        });

        return {
            success: true,
            summary: {
                date: entry.date,
                clockIn: entry.clockInTime,
                clockOut: clockOutTime.toISOString(),
                totalMinutes,
                breakMinutes,
                workMinutes: totalMinutes - breakMinutes,
                jobMinutes,
                jobSegments: entry.jobSegments || []
            }
        };
    } catch (error) {
        console.error('[TimeClock] Clock out error:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// BREAK MANAGEMENT
// ============================================

/**
 * Start a break
 */
export const startBreak = async (contractorId, techId, options = {}) => {
    try {
        const { reason, location } = options;

        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        const techDoc = await getDoc(techRef);
        const techData = techDoc.data();
        const currentEntryId = techData?.currentTimeEntryId;

        if (!currentEntryId) {
            return { success: false, error: 'Not clocked in' };
        }

        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), currentEntryId);
        const entryDoc = await getDoc(entryRef);
        const entry = entryDoc.data();

        const breakEntry = {
            id: `break_${Date.now()}`,
            startTime: new Date().toISOString(),
            endTime: null,
            reason: reason || 'break',
            location: location || null
        };

        await updateDoc(entryRef, {
            breaks: [...(entry.breaks || []), breakEntry],
            currentBreakId: breakEntry.id,
            updatedAt: serverTimestamp()
        });

        await updateDoc(techRef, {
            clockStatus: CLOCK_STATUS.ON_BREAK
        });

        return { success: true, break: breakEntry };
    } catch (error) {
        console.error('[TimeClock] Start break error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * End a break
 */
export const endBreak = async (contractorId, techId) => {
    try {
        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        const techDoc = await getDoc(techRef);
        const techData = techDoc.data();
        const currentEntryId = techData?.currentTimeEntryId;

        if (!currentEntryId) {
            return { success: false, error: 'Not clocked in' };
        }

        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), currentEntryId);
        const entryDoc = await getDoc(entryRef);
        const entry = entryDoc.data();

        // Find and update the active break
        const breaks = (entry.breaks || []).map(brk => {
            if (brk.id === entry.currentBreakId) {
                return {
                    ...brk,
                    endTime: new Date().toISOString()
                };
            }
            return brk;
        });

        await updateDoc(entryRef, {
            breaks,
            currentBreakId: null,
            updatedAt: serverTimestamp()
        });

        await updateDoc(techRef, {
            clockStatus: CLOCK_STATUS.CLOCKED_IN
        });

        return { success: true };
    } catch (error) {
        console.error('[TimeClock] End break error:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// JOB TIME TRACKING
// ============================================

/**
 * Record job start for time tracking (called when tech checks in to job)
 */
export const recordJobStart = async (contractorId, techId, jobId, jobData = {}) => {
    try {
        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        const techDoc = await getDoc(techRef);
        const techData = techDoc.data();

        // Auto clock-in if not already clocked in
        if (techData?.clockStatus !== CLOCK_STATUS.CLOCKED_IN) {
            await clockIn(contractorId, techId, {
                jobId,
                autoFromJob: true,
                notes: `Auto clock-in from job: ${jobData.title || jobId}`
            });
        }

        const currentEntryId = techData?.currentTimeEntryId;
        if (!currentEntryId) {
            // Clock in was just created, get the new ID
            const refreshedDoc = await getDoc(techRef);
            const refreshedData = refreshedDoc.data();
            if (!refreshedData?.currentTimeEntryId) {
                return { success: false, error: 'Failed to get time entry' };
            }
        }

        // Record job segment start
        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), techData.currentTimeEntryId || (await getDoc(techRef)).data().currentTimeEntryId);
        const entryDoc = await getDoc(entryRef);
        const entry = entryDoc.data();

        const jobSegment = {
            id: `job_${jobId}_${Date.now()}`,
            jobId,
            jobTitle: jobData.title || jobData.description || '',
            customerName: jobData.customer?.name || jobData.customerName || '',
            startTime: new Date().toISOString(),
            endTime: null,
            minutes: 0
        };

        await updateDoc(entryRef, {
            jobSegments: [...(entry.jobSegments || []), jobSegment],
            currentJobSegmentId: jobSegment.id,
            updatedAt: serverTimestamp()
        });

        return { success: true, segment: jobSegment };
    } catch (error) {
        console.error('[TimeClock] Record job start error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Record job end for time tracking (called when tech checks out of job)
 */
export const recordJobEnd = async (contractorId, techId, jobId) => {
    try {
        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        const techDoc = await getDoc(techRef);
        const techData = techDoc.data();
        const currentEntryId = techData?.currentTimeEntryId;

        if (!currentEntryId) {
            return { success: false, error: 'No active time entry' };
        }

        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), currentEntryId);
        const entryDoc = await getDoc(entryRef);
        const entry = entryDoc.data();

        const endTime = new Date();

        // Update the job segment
        const jobSegments = (entry.jobSegments || []).map(seg => {
            if (seg.jobId === jobId && !seg.endTime) {
                const startTime = new Date(seg.startTime);
                const minutes = Math.round((endTime - startTime) / (1000 * 60));
                return {
                    ...seg,
                    endTime: endTime.toISOString(),
                    minutes
                };
            }
            return seg;
        });

        await updateDoc(entryRef, {
            jobSegments,
            currentJobSegmentId: null,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[TimeClock] Record job end error:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GET TIME DATA
// ============================================

/**
 * Get tech's current clock status
 */
export const getClockStatus = async (contractorId, techId) => {
    try {
        const techRef = doc(db, getTechStatusDoc(contractorId, techId));
        const techDoc = await getDoc(techRef);

        if (!techDoc.exists()) {
            return { status: CLOCK_STATUS.CLOCKED_OUT, entry: null };
        }

        const techData = techDoc.data();
        const currentEntryId = techData.currentTimeEntryId;

        if (!currentEntryId) {
            return { status: CLOCK_STATUS.CLOCKED_OUT, entry: null };
        }

        const entryRef = doc(db, getTimeEntriesCollection(contractorId, techId), currentEntryId);
        const entryDoc = await getDoc(entryRef);

        return {
            status: techData.clockStatus || CLOCK_STATUS.CLOCKED_OUT,
            entry: entryDoc.exists() ? entryDoc.data() : null
        };
    } catch (error) {
        console.error('[TimeClock] Get status error:', error);
        return { status: CLOCK_STATUS.CLOCKED_OUT, entry: null, error: error.message };
    }
};

/**
 * Get time entries for a date range
 */
export const getTimeEntries = async (contractorId, techId, startDate, endDate) => {
    try {
        const entriesRef = collection(db, getTimeEntriesCollection(contractorId, techId));
        const q = query(
            entriesRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('[TimeClock] Get entries error:', error);
        return [];
    }
};

/**
 * Get weekly summary for a tech
 */
export const getWeeklySummary = async (contractorId, techId, weekStartDate) => {
    try {
        const startDate = new Date(weekStartDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        const entries = await getTimeEntries(
            contractorId,
            techId,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        );

        const summary = {
            weekStart: startDate.toISOString().split('T')[0],
            weekEnd: endDate.toISOString().split('T')[0],
            totalMinutes: 0,
            workMinutes: 0,
            breakMinutes: 0,
            jobMinutes: 0,
            daysWorked: 0,
            entries: [],
            dailyBreakdown: {}
        };

        entries.forEach(entry => {
            summary.totalMinutes += entry.totalMinutes || 0;
            summary.workMinutes += entry.workMinutes || (entry.totalMinutes - (entry.breakMinutes || 0)) || 0;
            summary.breakMinutes += entry.breakMinutes || 0;
            summary.jobMinutes += entry.jobMinutes || 0;

            if (entry.clockOutTime) {
                summary.daysWorked++;
            }

            summary.dailyBreakdown[entry.date] = {
                totalMinutes: entry.totalMinutes || 0,
                workMinutes: entry.workMinutes || 0,
                breakMinutes: entry.breakMinutes || 0,
                jobCount: (entry.jobSegments || []).length
            };

            summary.entries.push(entry);
        });

        return summary;
    } catch (error) {
        console.error('[TimeClock] Get weekly summary error:', error);
        return null;
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format minutes to hours:minutes string
 */
export const formatMinutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Format minutes to human readable string
 */
export const formatMinutesToHuman = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

export default {
    CLOCK_EVENTS,
    CLOCK_STATUS,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    recordJobStart,
    recordJobEnd,
    getClockStatus,
    getTimeEntries,
    getWeeklySummary,
    formatMinutesToTime,
    formatMinutesToHuman
};
