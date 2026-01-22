// src/features/contractor-pro/lib/jobService.js
// ============================================
// JOB MANAGEMENT SERVICE
// ============================================
// All database operations for jobs, scheduling, and dispatch

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    increment,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';

// Collection paths
const CONTRACTORS_COLLECTION = 'contractors';
const JOBS_SUBCOLLECTION = 'jobs';
const TEAM_SUBCOLLECTION = 'team';

// ============================================
// JOB STATUS CONSTANTS
// ============================================
export const JOB_STATUSES = {
    PENDING_SCHEDULE: 'pending_schedule',
    SCHEDULED: 'scheduled',
    EN_ROUTE: 'en_route',
    ON_SITE: 'on_site',
    IN_PROGRESS: 'in_progress',
    RUNNING_LATE: 'running_late',  // Quick Win #2: New status for disruption detection
    WAITING: 'waiting',            // Waiting on parts, approval, etc.
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

export const JOB_STATUS_LABELS = {
    [JOB_STATUSES.PENDING_SCHEDULE]: 'Pending Schedule',
    [JOB_STATUSES.SCHEDULED]: 'Scheduled',
    [JOB_STATUSES.EN_ROUTE]: 'En Route',
    [JOB_STATUSES.ON_SITE]: 'On Site',
    [JOB_STATUSES.IN_PROGRESS]: 'In Progress',
    [JOB_STATUSES.RUNNING_LATE]: 'Running Late',
    [JOB_STATUSES.WAITING]: 'Waiting',
    [JOB_STATUSES.COMPLETED]: 'Completed',
    [JOB_STATUSES.CANCELLED]: 'Cancelled'
};

// ============================================
// JOB NUMBER GENERATION
// ============================================
const generateJobNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `JOB-${year}${month}-${random}`;
};

// ============================================
// JOB CRUD OPERATIONS
// ============================================

/**
 * Create a new job
 */
export const createJob = async (contractorId, jobData) => {
    try {
        const jobNumber = generateJobNumber();
        const jobRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION));

        const job = {
            jobNumber,
            status: jobData.scheduledDate ? JOB_STATUSES.SCHEDULED : JOB_STATUSES.PENDING_SCHEDULE,

            // Customer info
            customerId: jobData.customerId || null,
            customerName: jobData.customerName || '',
            customerPhone: jobData.customerPhone || '',
            customerEmail: jobData.customerEmail || '',

            // Location
            serviceAddress: jobData.serviceAddress || '',
            serviceLocation: jobData.serviceLocation || null, // {lat, lng}

            // Job details
            title: jobData.title || '',
            description: jobData.description || '',
            category: jobData.category || 'General',

            // Requirements (for constraint-aware scheduling)
            requiredSkills: jobData.requiredSkills || [],
            requiredCertifications: jobData.requiredCertifications || [],
            requiredParts: jobData.requiredParts || [],

            // Scheduling
            scheduledDate: jobData.scheduledDate || null,
            scheduledStartTime: jobData.scheduledStartTime || null,
            scheduledEndTime: jobData.scheduledEndTime || null,
            estimatedDurationMinutes: jobData.estimatedDurationMinutes || 60,

            // Assignment
            assignedTechId: jobData.assignedTechId || null,
            assignedTechName: jobData.assignedTechName || null,

            // SLA / Priority
            priority: jobData.priority || 'normal', // low, normal, high, urgent
            slaDeadline: jobData.slaDeadline || null,
            customerTier: jobData.customerTier || 'standard', // standard, premium, vip

            // Financial
            quoteId: jobData.quoteId || null,
            estimatedCost: jobData.estimatedCost || 0,
            actualCost: 0,

            // Tracking
            travelTimeMinutes: null,
            actualStartTime: null,
            actualEndTime: null,
            actualDurationMinutes: null,

            // Notes & attachments
            notes: jobData.notes || '',
            internalNotes: jobData.internalNotes || '',
            photos: [],

            // Metadata
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: jobData.createdBy || null
        };

        await setDoc(jobRef, job);

        return {
            success: true,
            jobId: jobRef.id,
            jobNumber
        };
    } catch (error) {
        console.error('Error creating job:', error);
        throw error;
    }
};

/**
 * Update job
 */
export const updateJob = async (contractorId, jobId, updates) => {
    try {
        const jobRef = doc(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION, jobId);

        await updateDoc(jobRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating job:', error);
        throw error;
    }
};

/**
 * Update job status with tracking
 */
export const updateJobStatus = async (contractorId, jobId, newStatus, metadata = {}) => {
    try {
        const jobRef = doc(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const job = jobSnap.data();
        const now = Timestamp.now();

        const updates = {
            status: newStatus,
            updatedAt: serverTimestamp()
        };

        // Track timing based on status transitions
        if (newStatus === JOB_STATUSES.IN_PROGRESS && !job.actualStartTime) {
            updates.actualStartTime = now;
        }

        if (newStatus === JOB_STATUSES.COMPLETED) {
            updates.actualEndTime = now;
            if (job.actualStartTime) {
                const startMs = job.actualStartTime.toMillis();
                const endMs = now.toMillis();
                updates.actualDurationMinutes = Math.round((endMs - startMs) / 60000);
            }
        }

        // Quick Win #2: Running late detection
        if (newStatus === JOB_STATUSES.RUNNING_LATE) {
            updates.markedLateAt = now;
            updates.lateReason = metadata.reason || 'unspecified';
        }

        // Add any additional metadata
        if (metadata.notes) {
            updates.statusNotes = metadata.notes;
        }

        await updateDoc(jobRef, updates);

        return { success: true };
    } catch (error) {
        console.error('Error updating job status:', error);
        throw error;
    }
};

/**
 * Get job by ID
 */
export const getJob = async (contractorId, jobId) => {
    try {
        const jobRef = doc(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return null;
        }

        return { id: jobSnap.id, ...jobSnap.data() };
    } catch (error) {
        console.error('Error getting job:', error);
        throw error;
    }
};

/**
 * Get jobs for a specific date
 */
export const getJobsByDate = async (contractorId, date, options = {}) => {
    try {
        const { techId, includeCompleted = false } = options;

        // Create date range for the entire day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        let q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION),
            where('scheduledDate', '>=', startOfDay.toISOString().split('T')[0]),
            where('scheduledDate', '<=', endOfDay.toISOString().split('T')[0]),
            orderBy('scheduledDate'),
            orderBy('scheduledStartTime')
        );

        const snapshot = await getDocs(q);
        let jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter by tech if specified
        if (techId) {
            jobs = jobs.filter(j => j.assignedTechId === techId);
        }

        // Filter out completed if requested
        if (!includeCompleted) {
            jobs = jobs.filter(j => j.status !== JOB_STATUSES.COMPLETED && j.status !== JOB_STATUSES.CANCELLED);
        }

        return jobs;
    } catch (error) {
        console.error('Error getting jobs by date:', error);
        throw error;
    }
};

/**
 * Get unscheduled jobs
 */
export const getUnscheduledJobs = async (contractorId, limitCount = 50) => {
    try {
        const q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION),
            where('status', '==', JOB_STATUSES.PENDING_SCHEDULE),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting unscheduled jobs:', error);
        throw error;
    }
};

/**
 * Subscribe to jobs for real-time updates
 */
export const subscribeToJobs = (contractorId, callback, options = {}) => {
    const { date, techId, statuses, limitCount = 100 } = options;

    let constraints = [];

    if (date) {
        constraints.push(where('scheduledDate', '==', date));
    }

    if (techId) {
        constraints.push(where('assignedTechId', '==', techId));
    }

    if (statuses && statuses.length > 0) {
        constraints.push(where('status', 'in', statuses));
    }

    constraints.push(orderBy('scheduledDate', 'desc'));
    constraints.push(limit(limitCount));

    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION),
        ...constraints
    );

    return onSnapshot(q, (snapshot) => {
        const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(jobs);
    }, (error) => {
        console.error('Jobs subscription error:', error);
    });
};

/**
 * Assign job to tech
 */
export const assignJobToTech = async (contractorId, jobId, techId, techName) => {
    try {
        const jobRef = doc(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION, jobId);

        await updateDoc(jobRef, {
            assignedTechId: techId,
            assignedTechName: techName,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error assigning job:', error);
        throw error;
    }
};

/**
 * Reschedule job
 */
export const rescheduleJob = async (contractorId, jobId, newSchedule) => {
    try {
        const jobRef = doc(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION, jobId);

        await updateDoc(jobRef, {
            scheduledDate: newSchedule.date,
            scheduledStartTime: newSchedule.startTime,
            scheduledEndTime: newSchedule.endTime,
            status: JOB_STATUSES.SCHEDULED,
            updatedAt: serverTimestamp(),
            rescheduledAt: serverTimestamp(),
            rescheduledReason: newSchedule.reason || null
        });

        return { success: true };
    } catch (error) {
        console.error('Error rescheduling job:', error);
        throw error;
    }
};

// ============================================
// BATCH OPERATIONS (for AI Dispatch)
// ============================================

/**
 * Batch assign multiple jobs (for AI dispatch)
 */
export const batchAssignJobs = async (contractorId, assignments) => {
    try {
        const batch = writeBatch(db);

        for (const assignment of assignments) {
            const jobRef = doc(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION, assignment.jobId);

            batch.update(jobRef, {
                assignedTechId: assignment.techId,
                assignedTechName: assignment.techName,
                scheduledDate: assignment.scheduledDate,
                scheduledStartTime: assignment.scheduledStartTime,
                scheduledEndTime: assignment.scheduledEndTime,
                status: JOB_STATUSES.SCHEDULED,
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();

        return { success: true, assignedCount: assignments.length };
    } catch (error) {
        console.error('Error batch assigning jobs:', error);
        throw error;
    }
};

/**
 * Get jobs that need rescheduling (for disruption handling)
 */
export const getJobsNeedingReschedule = async (contractorId) => {
    try {
        const q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION),
            where('status', 'in', [JOB_STATUSES.RUNNING_LATE, JOB_STATUSES.WAITING]),
            orderBy('scheduledDate')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error getting jobs needing reschedule:', error);
        throw error;
    }
};

export default {
    JOB_STATUSES,
    JOB_STATUS_LABELS,
    createJob,
    updateJob,
    updateJobStatus,
    getJob,
    getJobsByDate,
    getUnscheduledJobs,
    subscribeToJobs,
    assignJobToTech,
    rescheduleJob,
    batchAssignJobs,
    getJobsNeedingReschedule
};
