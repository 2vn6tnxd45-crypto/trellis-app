// src/features/jobs/lib/jobService.js
// JOB SERVICE - Direct job creation for contractors

import { doc, collection, addDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH, REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { extractCrewRequirements } from '../../contractor-pro/lib/crewRequirementsService';
import { isMultiDayJob, createMultiDaySchedule } from '../../contractor-pro/lib/multiDayUtils';

export const JOB_STATUSES = {
    PENDING: 'pending',
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ON_HOLD: 'on_hold'
};

export const JOB_SOURCE_TYPES = {
    QUOTE: 'quote',
    DIRECT: 'direct',
    RECURRING: 'recurring',
    EVALUATION: 'evaluation'
};

export const JOB_PRIORITY = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent'
};

const generateJobNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `JOB-${timestamp}-${random}`;
};

const normalizeDate = (date) => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toISOString();
    if (date.toDate) return date.toDate().toISOString();
    return null;
};

// Build proper schedule fields from date + time inputs
// Handles both single-day and multi-day jobs
const buildScheduleFields = (jobData, workingHours = {}) => {
    if (!jobData.scheduledDate) {
        return {
            scheduledDate: null,
            scheduledTime: null,
            scheduledEndTime: null,
            multiDaySchedule: null
        };
    }

    // Combine date and time into full ISO timestamp
    const datePart = jobData.scheduledDate; // "2026-01-19"
    const timePart = jobData.scheduledTime || '09:00'; // "09:00" or default to 9am
    const scheduledDateTime = new Date(`${datePart}T${timePart}:00`);

    const durationMinutes = jobData.estimatedDuration || 60;

    // Check if this is a multi-day job (> 8 hours = 480 minutes)
    if (isMultiDayJob(durationMinutes)) {
        const multiDaySchedule = createMultiDaySchedule(scheduledDateTime, durationMinutes, workingHours);

        // For multi-day, use first segment's times
        const firstSegment = multiDaySchedule.segments[0];
        const [startH, startM] = firstSegment.startTime.split(':').map(Number);
        const [endH, endM] = firstSegment.endTime.split(':').map(Number);

        const startDateTime = new Date(scheduledDateTime);
        startDateTime.setHours(startH, startM, 0, 0);

        const endDateTime = new Date(scheduledDateTime);
        endDateTime.setHours(endH, endM, 0, 0);

        return {
            scheduledDate: startDateTime.toISOString(),
            scheduledTime: startDateTime.toISOString(),
            scheduledEndTime: endDateTime.toISOString(),
            multiDaySchedule: {
                ...multiDaySchedule,
                dailyStartTime: firstSegment.startTime,
                dailyEndTime: firstSegment.endTime
            }
        };
    }

    // Single-day job - calculate end time based on duration
    const endDateTime = new Date(scheduledDateTime.getTime() + durationMinutes * 60 * 1000);

    return {
        scheduledDate: scheduledDateTime.toISOString(),
        scheduledTime: scheduledDateTime.toISOString(),
        scheduledEndTime: endDateTime.toISOString(),
        multiDaySchedule: null
    };
};

export const createJobDirect = async (contractorId, jobData) => {
    try {
        if (!contractorId) {
            return { success: false, error: 'Contractor ID is required' };
        }
        if (!jobData.title || !jobData.customerName || !jobData.propertyAddress) {
            return { success: false, error: 'Title, customer name, and address are required' };
        }

        const jobNumber = generateJobNumber();
        const crewSize = parseInt(jobData.crewSize) || 1;

        // Build job document - matches structure expected by subscribeToContractorJobs
        const job = {
            // Identity & Source
            jobNumber,
            contractorId,
            source: JOB_SOURCE_TYPES.DIRECT,
            type: 'job', // Marks this as a job in the requests collection

            // Job Details
            title: jobData.title,
            description: jobData.description || jobData.title,
            category: jobData.category || 'General',
            serviceType: jobData.category || 'General',
            estimatedDuration: jobData.estimatedDuration || 60,
            price: jobData.price || null,
            notes: jobData.notes || '',
            priority: jobData.priority || JOB_PRIORITY.NORMAL,

            // Customer Info
            customer: {
                name: jobData.customerName,
                phone: jobData.customerPhone || '',
                email: jobData.customerEmail || '',
                address: jobData.propertyAddress
            },
            customerName: jobData.customerName, // Duplicate for backwards compatibility
            customerPhone: jobData.customerPhone || '',
            customerEmail: jobData.customerEmail || '',

            // Location
            propertyAddress: jobData.propertyAddress,
            serviceLocation: {
                address: jobData.propertyAddress,
                coordinates: jobData.coordinates || null
            },

            // Status & Scheduling
            status: jobData.scheduledDate ? JOB_STATUSES.SCHEDULED : JOB_STATUSES.PENDING,
            ...buildScheduleFields(jobData),
            scheduledTimezone: jobData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,

            // Assignment
            assignedTechId: jobData.assignedTechId || null,
            assignedTechName: jobData.assignedTechName || null,
            assignedVehicleId: jobData.assignedVehicleId || null,
            assignedCrew: jobData.assignedCrew || [],
            assignedCrewIds: jobData.assignedCrewIds || [],

            // Crew Requirements
            crewRequirements: {
                required: crewSize,
                minimum: Math.max(1, crewSize - 1),
                maximum: crewSize + 2,
                source: jobData.crewSize ? 'specified' : 'default',
                requiresMultipleTechs: crewSize > 1,
                totalLaborHours: (jobData.estimatedDuration || 60) / 60 * crewSize,
                notes: crewSize > 1 ? [`Direct job: ${crewSize} techs specified`] : [],
                extractedAt: new Date().toISOString()
            },
            requiredCrewSize: crewSize,

            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActivity: serverTimestamp(), // Important for ordering in subscription

            // Metadata
            createdBy: jobData.createdBy || 'contractor',
            quoteId: null,
            requestId: null,
            evaluationId: null,
            completedAt: null,
            completion: null
        };

        // Write to the main requests collection (same as quote-based jobs)
        const jobsRef = collection(db, REQUESTS_COLLECTION_PATH);
        const docRef = await addDoc(jobsRef, job);
        console.log('[jobService] Created direct job in requests collection:', docRef.id, jobNumber);

        return { success: true, jobId: docRef.id, jobNumber, job: { id: docRef.id, ...job } };
    } catch (error) {
        console.error('[jobService] Error creating direct job:', error);
        return { success: false, error: error.message };
    }
};

export const updateJobStatus = async (contractorId, jobId, newStatus, statusData = {}) => {
    try {
        // Jobs are stored in the main requests collection
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const updates = { status: newStatus, updatedAt: serverTimestamp(), ...statusData };

        if (newStatus === JOB_STATUSES.COMPLETED) {
            updates.completedAt = serverTimestamp();
            updates.completion = {
                completedAt: new Date().toISOString(),
                completedBy: statusData.completedBy || 'system',
                notes: statusData.completionNotes || ''
            };
        }

        await updateDoc(jobRef, updates);
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error updating job status:', error);
        return { success: false, error: error.message };
    }
};

export const assignJobResources = async (contractorId, jobId, resources) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const updates = { updatedAt: serverTimestamp() };

        if (resources.techId !== undefined) {
            updates.assignedTechId = resources.techId;
            updates.assignedTechName = resources.techName || null;
        }
        if (resources.vehicleId !== undefined) {
            updates.assignedVehicleId = resources.vehicleId;
        }
        if (resources.crewIds !== undefined) {
            updates.assignedCrewIds = resources.crewIds;
        }

        await updateDoc(jobRef, updates);
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error assigning resources:', error);
        return { success: false, error: error.message };
    }
};

export const scheduleJob = async (contractorId, jobId, scheduleData) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const updates = {
            status: JOB_STATUSES.SCHEDULED,
            scheduledDate: normalizeDate(scheduleData.date),
            scheduledTime: scheduleData.time || null,
            scheduledTimezone: scheduleData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            updatedAt: serverTimestamp()
        };

        if (scheduleData.techId) {
            updates.assignedTechId = scheduleData.techId;
            updates.assignedTechName = scheduleData.techName || null;
        }
        if (scheduleData.vehicleId) {
            updates.assignedVehicleId = scheduleData.vehicleId;
        }

        await updateDoc(jobRef, updates);
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error scheduling job:', error);
        return { success: false, error: error.message };
    }
};

export const getJob = async (contractorId, jobId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return { success: false, error: 'Job not found' };
        }

        return { success: true, job: { id: jobSnap.id, ...jobSnap.data() } };
    } catch (error) {
        console.error('[jobService] Error getting job:', error);
        return { success: false, error: error.message };
    }
};

export const updateJob = async (contractorId, jobId, updates) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        await updateDoc(jobRef, { ...updates, updatedAt: serverTimestamp() });
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error updating job:', error);
        return { success: false, error: error.message };
    }
};
