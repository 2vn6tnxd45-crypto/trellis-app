// src/features/contractor-pro/lib/timeOffService.js
// ============================================
// TIME-OFF MANAGEMENT SERVICE
// ============================================
// Manages time-off entries for team members
// Supports: vacation, sick days, personal time, holidays

import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

export const TIME_OFF_TYPES = {
    VACATION: 'vacation',
    SICK: 'sick',
    PERSONAL: 'personal',
    HOLIDAY: 'holiday',
    TRAINING: 'training',
    OTHER: 'other'
};

export const TIME_OFF_STATUS = {
    APPROVED: 'approved',
    PENDING: 'pending',
    DENIED: 'denied'
};

// ============================================
// HELPERS
// ============================================

/**
 * Normalize date to YYYY-MM-DD string
 */
const normalizeDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string') {
        // If already YYYY-MM-DD, return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        // Otherwise parse
        return new Date(date).toISOString().split('T')[0];
    }
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    // Firestore Timestamp
    if (date.toDate) {
        return date.toDate().toISOString().split('T')[0];
    }
    return null;
};

/**
 * Check if a date falls within a time-off period
 */
export const isDateBlockedByTimeOff = (date, timeOffEntries = []) => {
    const checkDate = normalizeDate(date);
    if (!checkDate) return false;

    for (const entry of timeOffEntries) {
        // Skip non-approved entries
        if (entry.status && entry.status !== TIME_OFF_STATUS.APPROVED) continue;

        const startDate = normalizeDate(entry.startDate);
        const endDate = normalizeDate(entry.endDate || entry.startDate);

        if (!startDate) continue;

        // Check if checkDate falls within the range
        if (checkDate >= startDate && checkDate <= endDate) {
            return {
                blocked: true,
                reason: entry.type || 'time-off',
                notes: entry.notes || ''
            };
        }
    }

    return { blocked: false };
};

/**
 * Check if a tech is available on a specific date (considering time-off)
 */
export const isTechAvailableOnDate = (tech, date) => {
    const timeOff = tech.timeOff || tech.scheduling?.timeOff || [];
    const result = isDateBlockedByTimeOff(date, timeOff);

    if (result.blocked) {
        return {
            available: false,
            reason: `On ${result.reason}${result.notes ? `: ${result.notes}` : ''}`
        };
    }

    return { available: true };
};

/**
 * Get all time-off entries for a tech within a date range
 */
export const getTimeOffInRange = (timeOffEntries = [], startDate, endDate) => {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);

    if (!start || !end) return [];

    return timeOffEntries.filter(entry => {
        const entryStart = normalizeDate(entry.startDate);
        const entryEnd = normalizeDate(entry.endDate || entry.startDate);

        // Check for any overlap
        return entryStart <= end && entryEnd >= start;
    });
};

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Add a time-off entry for a team member
 */
export const addTimeOff = async (contractorId, techId, timeOffEntry) => {
    try {
        const entry = {
            id: `timeoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            techId,
            startDate: normalizeDate(timeOffEntry.startDate),
            endDate: normalizeDate(timeOffEntry.endDate || timeOffEntry.startDate),
            type: timeOffEntry.type || TIME_OFF_TYPES.OTHER,
            status: timeOffEntry.status || TIME_OFF_STATUS.APPROVED,
            notes: timeOffEntry.notes || '',
            createdAt: new Date().toISOString(),
            createdBy: timeOffEntry.createdBy || 'system'
        };

        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);

        // Add to timeOff array in scheduling settings
        await updateDoc(contractorRef, {
            [`scheduling.timeOff`]: arrayUnion(entry),
            'scheduling.updatedAt': serverTimestamp()
        });

        return { success: true, entry };
    } catch (error) {
        console.error('[timeOffService] Error adding time-off:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Remove a time-off entry
 */
export const removeTimeOff = async (contractorId, timeOffEntry) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);

        await updateDoc(contractorRef, {
            [`scheduling.timeOff`]: arrayRemove(timeOffEntry),
            'scheduling.updatedAt': serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[timeOffService] Error removing time-off:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update a time-off entry (remove old, add new)
 */
export const updateTimeOff = async (contractorId, oldEntry, newEntry) => {
    try {
        const updated = {
            ...oldEntry,
            ...newEntry,
            startDate: normalizeDate(newEntry.startDate || oldEntry.startDate),
            endDate: normalizeDate(newEntry.endDate || oldEntry.endDate || newEntry.startDate || oldEntry.startDate),
            updatedAt: new Date().toISOString()
        };

        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);

        // Remove old, add new
        await updateDoc(contractorRef, {
            [`scheduling.timeOff`]: arrayRemove(oldEntry)
        });

        await updateDoc(contractorRef, {
            [`scheduling.timeOff`]: arrayUnion(updated),
            'scheduling.updatedAt': serverTimestamp()
        });

        return { success: true, entry: updated };
    } catch (error) {
        console.error('[timeOffService] Error updating time-off:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get time-off for a specific tech
 */
export const getTimeOffForTech = (timeOffEntries = [], techId) => {
    return timeOffEntries.filter(entry => entry.techId === techId);
};

/**
 * Get upcoming time-off for display (next 90 days)
 */
export const getUpcomingTimeOff = (timeOffEntries = [], days = 90) => {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return getTimeOffInRange(timeOffEntries, today, endDate)
        .filter(entry => entry.status !== TIME_OFF_STATUS.DENIED)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
};
