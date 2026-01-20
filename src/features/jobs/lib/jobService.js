// src/features/jobs/lib/jobService.js
// JOB SERVICE - Direct job creation for contractors

import { doc, collection, addDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

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

export const createJobDirect = async (contractorId, jobData) => {
    try {
        if (!contractorId) {
            return { success: false, error: 'Contractor ID is required' };
        }
        if (!jobData.title || !jobData.customerName || !jobData.propertyAddress) {
            return { success: false, error: 'Title, customer name, and address are required' };
        }

        const jobNumber = generateJobNumber();
        const job = {
            jobNumber,
            contractorId,
            source: JOB_SOURCE_TYPES.DIRECT,
            title: jobData.title,
            description: jobData.description || jobData.title,
            category: jobData.category || 'General',
            estimatedDuration: jobData.estimatedDuration || 60,
            price: jobData.price || null,
            notes: jobData.notes || '',
            priority: jobData.priority || JOB_PRIORITY.NORMAL,
            customer: {
                name: jobData.customerName,
                phone: jobData.customerPhone || '',
                email: jobData.customerEmail || ''
            },
            propertyAddress: jobData.propertyAddress,
            serviceLocation: { address: jobData.propertyAddress, coordinates: jobData.coordinates || null },
            status: jobData.scheduledDate ? JOB_STATUSES.SCHEDULED : JOB_STATUSES.PENDING,
            scheduledDate: normalizeDate(jobData.scheduledDate),
            scheduledTime: jobData.scheduledTime || null,
            scheduledTimezone: jobData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            assignedTechId: jobData.assignedTechId || null,
            assignedTechName: jobData.assignedTechName || null,
            assignedVehicleId: jobData.assignedVehicleId || null,
            assignedCrewIds: jobData.assignedCrewIds || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: jobData.createdBy || 'contractor',
            quoteId: null,
            requestId: null,
            evaluationId: null,
            completedAt: null,
            completion: null
        };

        const jobsRef = collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'jobs');
        const docRef = await addDoc(jobsRef, job);
        console.log('[jobService] Created direct job:', docRef.id, jobNumber);

        return { success: true, jobId: docRef.id, jobNumber, job: { id: docRef.id, ...job } };
    } catch (error) {
        console.error('[jobService] Error creating direct job:', error);
        return { success: false, error: error.message };
    }
};

export const updateJobStatus = async (contractorId, jobId, newStatus, statusData = {}) => {
    try {
        const jobRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'jobs', jobId);
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
        const jobRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'jobs', jobId);
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
        const jobRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'jobs', jobId);
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
        const jobRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'jobs', jobId);
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
        const jobRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'jobs', jobId);
        await updateDoc(jobRef, { ...updates, updatedAt: serverTimestamp() });
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error updating job:', error);
        return { success: false, error: error.message };
    }
};
