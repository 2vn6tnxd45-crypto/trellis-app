// src/features/recurring/lib/recurringService.js
// ============================================
// RECURRING SERVICES
// ============================================
// Manage recurring job schedules for services like lawn care, pest control, etc.

import { db } from '../../../config/firebase';
import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
    query, where, orderBy, onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore';
import {
    RECURRING_SERVICES_PATH,
    REQUESTS_COLLECTION_PATH,
    RECURRING_FREQUENCIES
} from '../../../config/constants';

// ============================================
// HELPERS
// ============================================

/**
 * Calculate the next occurrence date based on frequency
 * @param {Date} fromDate - Starting date
 * @param {string} frequency - 'weekly', 'biweekly', 'monthly', 'quarterly'
 * @param {string} preferredDay - 'monday', 'tuesday', etc.
 * @returns {Date} Next occurrence date
 */
export const calculateNextDate = (fromDate, frequency, preferredDay = null) => {
    const date = new Date(fromDate);
    const freq = RECURRING_FREQUENCIES.find(f => f.value === frequency);
    const daysToAdd = freq?.days || 7;

    // Add the interval
    date.setDate(date.getDate() + daysToAdd);

    // Adjust to preferred day of week if specified
    if (preferredDay) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(preferredDay.toLowerCase());
        if (targetDay !== -1) {
            const currentDay = date.getDay();
            const diff = targetDay - currentDay;
            // Move to next occurrence of preferred day (within the week)
            if (diff !== 0) {
                date.setDate(date.getDate() + (diff > 0 ? diff : diff + 7));
            }
        }
    }

    return date;
};

/**
 * Combine a date and time string into a full Date object
 * @param {Date} date - The date
 * @param {string} time - Time string like '09:00'
 * @returns {Date}
 */
export const combineDateTime = (date, time) => {
    const result = new Date(date);
    if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        result.setHours(hours, minutes, 0, 0);
    }
    return result;
};

/**
 * Format frequency for display
 * @param {string} frequency
 * @returns {string}
 */
export const formatFrequency = (frequency) => {
    const freq = RECURRING_FREQUENCIES.find(f => f.value === frequency);
    return freq?.label || frequency;
};

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new recurring service
 * @param {Object} serviceData - Recurring service data
 * @returns {Promise<string>} The new document ID
 */
export const createRecurringService = async (serviceData) => {
    const {
        contractorId,
        customerId,
        propertyId,
        serviceName,
        serviceType,
        description,
        basePrice,
        estimatedDuration,
        frequency,
        preferredDay,
        preferredTime,
        assignedTechId,
        assignedTechName,
        customerName,
        customerEmail,
        propertyAddress
    } = serviceData;

    // Calculate initial next scheduled date
    const now = new Date();
    const nextDate = calculateNextDate(now, frequency, preferredDay);

    const docData = {
        contractorId,
        customerId,
        propertyId,
        serviceName,
        serviceType: serviceType || 'General',
        description: description || '',
        basePrice: basePrice || 0,
        estimatedDuration: estimatedDuration || 60,
        frequency,
        preferredDay: preferredDay || null,
        preferredTime: preferredTime || '09:00',
        assignedTechId: assignedTechId || null,
        assignedTechName: assignedTechName || null,
        customerName,
        customerEmail,
        propertyAddress,
        status: 'active',
        pausedUntil: null,
        nextScheduledDate: nextDate.toISOString(),
        lastJobId: null,
        totalCompletedJobs: 0,
        billingType: 'per_visit',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, RECURRING_SERVICES_PATH), docData);

    // Generate first two job instances
    await generateUpcomingInstances(docRef.id, docData, 2);

    return docRef.id;
};

/**
 * Update an existing recurring service
 * @param {string} serviceId
 * @param {Object} updates
 */
export const updateRecurringService = async (serviceId, updates) => {
    const serviceRef = doc(db, RECURRING_SERVICES_PATH, serviceId);
    await updateDoc(serviceRef, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

/**
 * Get a single recurring service
 * @param {string} serviceId
 * @returns {Promise<Object|null>}
 */
export const getRecurringService = async (serviceId) => {
    const docRef = doc(db, RECURRING_SERVICES_PATH, serviceId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
};

/**
 * Delete a recurring service (cancel it)
 * @param {string} serviceId
 */
export const cancelRecurringService = async (serviceId) => {
    await updateRecurringService(serviceId, { status: 'cancelled' });

    // Optionally: Cancel all future scheduled jobs for this service
    const q = query(
        collection(db, REQUESTS_COLLECTION_PATH),
        where('recurring.serviceId', '==', serviceId),
        where('status', '==', 'scheduled')
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
            status: 'cancelled',
            cancelledReason: 'Recurring service cancelled',
            lastActivity: serverTimestamp()
        });
    });

    await batch.commit();
};

/**
 * Pause a recurring service
 * @param {string} serviceId
 * @param {Date} resumeDate - Optional date to auto-resume
 */
export const pauseRecurringService = async (serviceId, resumeDate = null) => {
    await updateRecurringService(serviceId, {
        status: 'paused',
        pausedUntil: resumeDate ? resumeDate.toISOString() : null
    });
};

/**
 * Resume a paused recurring service
 * @param {string} serviceId
 */
export const resumeRecurringService = async (serviceId) => {
    const service = await getRecurringService(serviceId);
    if (!service) return;

    // Calculate new next date from today
    const nextDate = calculateNextDate(new Date(), service.frequency, service.preferredDay);

    await updateRecurringService(serviceId, {
        status: 'active',
        pausedUntil: null,
        nextScheduledDate: nextDate.toISOString()
    });

    // Generate upcoming instances
    await generateUpcomingInstances(serviceId, service, 2);
};

// ============================================
// SUBSCRIPTIONS (Real-time)
// ============================================

/**
 * Subscribe to recurring services for a contractor
 * @param {string} contractorId
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const subscribeToContractorRecurringServices = (contractorId, callback) => {
    const q = query(
        collection(db, RECURRING_SERVICES_PATH),
        where('contractorId', '==', contractorId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(services);
    }, (error) => {
        console.error('Recurring services subscription error:', error);
        callback([]);
    });
};

/**
 * Subscribe to recurring services for a customer (homeowner)
 * @param {string} customerId
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCustomerRecurringServices = (customerId, callback) => {
    const q = query(
        collection(db, RECURRING_SERVICES_PATH),
        where('customerId', '==', customerId),
        where('status', 'in', ['active', 'paused'])
    );

    return onSnapshot(q, (snapshot) => {
        const services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(services);
    }, (error) => {
        console.error('Customer recurring services subscription error:', error);
        callback([]);
    });
};

// ============================================
// JOB INSTANCE GENERATION
// ============================================

/**
 * Generate upcoming job instances for a recurring service
 * @param {string} serviceId
 * @param {Object} service - Service data
 * @param {number} count - Number of instances to generate (default 2)
 */
export const generateUpcomingInstances = async (serviceId, service, count = 2) => {
    // Check how many future scheduled jobs already exist
    const q = query(
        collection(db, REQUESTS_COLLECTION_PATH),
        where('recurring.serviceId', '==', serviceId),
        where('status', '==', 'scheduled')
    );

    const existingSnapshot = await getDocs(q);
    const existingCount = existingSnapshot.size;

    // Calculate how many more to create
    const toCreate = Math.max(0, count - existingCount);
    if (toCreate === 0) return;

    // Find the latest scheduled date
    let lastDate = new Date();
    existingSnapshot.docs.forEach(doc => {
        const jobDate = new Date(doc.data().scheduledTime || doc.data().scheduledDate);
        if (jobDate > lastDate) lastDate = jobDate;
    });

    // Get current instance number
    let instanceNumber = service.totalCompletedJobs || 0;
    instanceNumber += existingCount;

    // Create new job instances
    for (let i = 0; i < toCreate; i++) {
        instanceNumber++;
        const nextDate = calculateNextDate(lastDate, service.frequency, service.preferredDay);
        const scheduledTime = combineDateTime(nextDate, service.preferredTime);

        const jobData = {
            contractorId: service.contractorId,
            customerId: service.customerId,
            propertyId: service.propertyId,
            title: service.serviceName,
            description: service.description,
            serviceType: service.serviceType,
            estimatedDuration: service.estimatedDuration,
            estimate: { total: service.basePrice, status: 'approved' },
            scheduledDate: scheduledTime.toISOString(),
            scheduledTime: scheduledTime.toISOString(),
            assignedTechId: service.assignedTechId,
            assignedTechName: service.assignedTechName,
            customerName: service.customerName,
            customerEmail: service.customerEmail,
            customer: {
                name: service.customerName,
                email: service.customerEmail,
                address: service.propertyAddress
            },
            status: 'scheduled',
            recurring: {
                isRecurring: true,
                serviceId: serviceId,
                instanceNumber: instanceNumber,
                isAutoGenerated: true
            },
            createdAt: serverTimestamp(),
            lastActivity: serverTimestamp()
        };

        await addDoc(collection(db, REQUESTS_COLLECTION_PATH), jobData);
        lastDate = nextDate;
    }

    // Update service with new next scheduled date
    await updateRecurringService(serviceId, {
        nextScheduledDate: lastDate.toISOString()
    });
};

/**
 * Called when a recurring job is completed - generates the next instance
 * @param {string} jobId - The completed job ID
 */
export const onRecurringJobCompleted = async (jobId) => {
    // Get the completed job
    const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
    const jobSnap = await getDoc(jobRef);

    if (!jobSnap.exists()) return;

    const job = jobSnap.data();
    if (!job.recurring?.serviceId) return;

    const serviceId = job.recurring.serviceId;

    // Update the service stats
    const service = await getRecurringService(serviceId);
    if (!service || service.status !== 'active') return;

    await updateRecurringService(serviceId, {
        lastJobId: jobId,
        totalCompletedJobs: (service.totalCompletedJobs || 0) + 1
    });

    // Generate next instances (maintain 2 ahead)
    await generateUpcomingInstances(serviceId, service, 2);
};

/**
 * Skip the next occurrence of a recurring service
 * @param {string} serviceId
 */
export const skipNextOccurrence = async (serviceId) => {
    // Find the next scheduled job for this service
    const q = query(
        collection(db, REQUESTS_COLLECTION_PATH),
        where('recurring.serviceId', '==', serviceId),
        where('status', '==', 'scheduled'),
        orderBy('scheduledTime', 'asc')
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    // Cancel the first (next) job
    const nextJob = snapshot.docs[0];
    await updateDoc(nextJob.ref, {
        status: 'cancelled',
        cancelledReason: 'Skipped by customer',
        lastActivity: serverTimestamp()
    });

    // Generate a replacement further out
    const service = await getRecurringService(serviceId);
    if (service && service.status === 'active') {
        await generateUpcomingInstances(serviceId, service, 2);
    }
};

// ============================================
// UTILITIES
// ============================================

/**
 * Check if a job is part of a recurring service
 * @param {Object} job
 * @returns {boolean}
 */
export const isRecurringJob = (job) => {
    return job?.recurring?.isRecurring === true;
};

/**
 * Get recurring service info for display
 * @param {Object} job
 * @returns {Object|null}
 */
export const getRecurringInfo = (job) => {
    if (!isRecurringJob(job)) return null;

    return {
        serviceId: job.recurring.serviceId,
        instanceNumber: job.recurring.instanceNumber,
        isAutoGenerated: job.recurring.isAutoGenerated
    };
};

export default {
    // CRUD
    createRecurringService,
    updateRecurringService,
    getRecurringService,
    cancelRecurringService,
    pauseRecurringService,
    resumeRecurringService,
    // Subscriptions
    subscribeToContractorRecurringServices,
    subscribeToCustomerRecurringServices,
    // Job generation
    generateUpcomingInstances,
    onRecurringJobCompleted,
    skipNextOccurrence,
    // Helpers
    calculateNextDate,
    formatFrequency,
    isRecurringJob,
    getRecurringInfo
};
