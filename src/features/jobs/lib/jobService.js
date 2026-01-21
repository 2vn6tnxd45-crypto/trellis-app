// src/features/jobs/lib/jobService.js
// JOB SERVICE - Direct job creation for contractors

import { doc, collection, addDoc, updateDoc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH, REQUESTS_COLLECTION_PATH, appId } from '../../../config/constants';
import { extractCrewRequirements } from '../../contractor-pro/lib/crewRequirementsService';
import { isMultiDayJob, createMultiDaySchedule } from '../../contractor-pro/lib/multiDayUtils';
import { addressesMatch, formatAddress } from '../../../lib/addressUtils';

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

// ============================================
// HOMEOWNER LINKING FUNCTIONS
// ============================================

/**
 * Look up homeowner by email and link job to their property
 * If user exists, immediately link and notify them
 * Also matches the job address to one of their properties if they have multiple
 * @param {string} contractorId - Contractor ID
 * @param {string} jobId - Job ID
 * @param {string} customerEmail - Customer email to look up
 * @returns {Promise<{success: boolean, homeownerId?: string, propertyId?: string, userFound?: boolean, propertyMatched?: boolean}>}
 */
export const linkJobToHomeowner = async (contractorId, jobId, customerEmail) => {
    if (!customerEmail) {
        return { success: false, error: 'Customer email is required' };
    }

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return { success: false, error: 'Job not found' };
        }

        const jobData = jobSnap.data();
        const normalizedEmail = customerEmail.toLowerCase().trim();
        const jobAddress = jobData.propertyAddress || jobData.customer?.address || '';

        // Check if user exists in the system
        // Use collectionGroup query to search across all profile subcollections
        // This works because profiles are stored at: /artifacts/{appId}/users/{uid}/settings/profile
        // and contain the user's email

        const { collectionGroup } = await import('firebase/firestore');

        // Query all profile documents for matching email
        const profilesQuery = query(
            collectionGroup(db, 'profile'),
            where('email', '==', normalizedEmail)
        );
        const profileSnapshot = await getDocs(profilesQuery);
        let userId = null;
        let foundViaProfile = false;

        console.log('[jobService] Searching for email via profile collectionGroup:', normalizedEmail);
        console.log('[jobService] Found matching profiles:', profileSnapshot.docs.length);

        if (!profileSnapshot.empty) {
            // Profile path is: /artifacts/{appId}/users/{userId}/settings/profile
            // We need to extract the userId from the path
            const profileDoc = profileSnapshot.docs[0];
            const pathParts = profileDoc.ref.path.split('/');
            // Path structure: artifacts / {appId} / users / {userId} / settings / profile
            // Index:              0           1        2        3          4        5
            const userIdIndex = pathParts.indexOf('users') + 1;
            if (userIdIndex > 0 && userIdIndex < pathParts.length) {
                userId = pathParts[userIdIndex];
                foundViaProfile = true;
                console.log('[jobService] Found user by profile email:', normalizedEmail, 'userId:', userId);
            } else {
                console.warn('[jobService] Could not extract userId from profile path:', profileDoc.ref.path);
            }
        } else {
            // Also try lowercase email match in case profile has mixed case
            const profilesQueryLower = query(
                collectionGroup(db, 'profile'),
                where('email', '>=', normalizedEmail),
                where('email', '<=', normalizedEmail + '\uf8ff')
            );
            const lowerSnapshot = await getDocs(profilesQueryLower);

            for (const profileDoc of lowerSnapshot.docs) {
                const profileData = profileDoc.data();
                const profileEmail = profileData?.email?.toLowerCase()?.trim();

                if (profileEmail === normalizedEmail) {
                    const pathParts = profileDoc.ref.path.split('/');
                    const userIdIndex = pathParts.indexOf('users') + 1;
                    if (userIdIndex > 0 && userIdIndex < pathParts.length) {
                        userId = pathParts[userIdIndex];
                        foundViaProfile = true;
                        console.log('[jobService] Found user by profile email (case-insensitive):', normalizedEmail, 'userId:', userId);
                        break;
                    }
                }
            }
        }

        if (!userId) {
            console.log('[jobService] No user found with email:', normalizedEmail);
        }

        if (userId) {
            // User EXISTS - link immediately and notify them
            console.log('[jobService] Found existing user for email:', normalizedEmail, 'userId:', userId);

            // Try to find matching property from user's profile
            let matchedPropertyId = null;
            let matchedPropertyName = null;

            // Get user's profile to access their properties
            const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists() && jobAddress) {
                const profileData = profileSnap.data();
                const properties = profileData.properties || [];

                // Try to match job address to one of the user's properties
                for (const property of properties) {
                    const propertyAddress = property.address;
                    const propertyFormatted = typeof propertyAddress === 'string'
                        ? propertyAddress
                        : formatAddress(propertyAddress);

                    if (addressesMatch(jobAddress, propertyFormatted)) {
                        matchedPropertyId = property.id;
                        matchedPropertyName = property.name || propertyFormatted;
                        console.log('[jobService] Matched job to property:', matchedPropertyId, matchedPropertyName);
                        break;
                    }
                }

                // If no match found but user only has one property, use that
                if (!matchedPropertyId && properties.length === 1) {
                    matchedPropertyId = properties[0].id;
                    matchedPropertyName = properties[0].name;
                    console.log('[jobService] Single property, using:', matchedPropertyId);
                }

                // If still no match, this might be a NEW property for them
                if (!matchedPropertyId && properties.length > 0) {
                    console.log('[jobService] No property match found for address:', jobAddress);
                    // We'll still link to user, but propertyId will be null
                    // The notification will indicate this is for a new/unknown property
                }
            }

            // Update job with direct link (including property if matched)
            const updates = {
                'customer.email': normalizedEmail,
                homeownerId: userId,
                homeownerLinked: true,
                homeownerLinkedAt: serverTimestamp(),
                homeownerLookupPending: false,
                homeownerLookupEmail: normalizedEmail,
                homeownerLookupAddress: jobAddress,
                updatedAt: serverTimestamp()
            };

            // Add property link if we found a match
            if (matchedPropertyId) {
                updates.propertyId = matchedPropertyId;
                updates.propertyName = matchedPropertyName;
            }

            await updateDoc(jobRef, updates);

            // Create notification for the homeowner (include property info)
            await createJobNotificationForHomeowner(userId, jobId, jobData, contractorId, matchedPropertyId, matchedPropertyName);

            return {
                success: true,
                userFound: true,
                homeownerId: userId,
                propertyId: matchedPropertyId,
                propertyMatched: !!matchedPropertyId,
                message: matchedPropertyId
                    ? `Job linked to user and property "${matchedPropertyName}". Notification sent.`
                    : 'Job linked to user. Notification sent (property not matched).',
                lookupEmail: normalizedEmail
            };
        }

        // User does NOT exist - store for future matching
        const updates = {
            'customer.email': normalizedEmail,
            homeownerLookupPending: true,
            homeownerLookupEmail: normalizedEmail,
            homeownerLookupAddress: jobAddress,
            updatedAt: serverTimestamp()
        };

        await updateDoc(jobRef, updates);

        return {
            success: true,
            userFound: false,
            message: 'Job marked for homeowner linking. Will be matched when homeowner signs up.',
            lookupEmail: normalizedEmail
        };
    } catch (error) {
        console.error('[jobService] Error linking job to homeowner:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create a notification for the homeowner about a new job
 * Stores notification in their user document for in-app display
 * @param {string} userId - Homeowner user ID
 * @param {string} jobId - Job ID
 * @param {Object} jobData - Job data
 * @param {string} contractorId - Contractor ID
 * @param {string|null} propertyId - Matched property ID (if found)
 * @param {string|null} propertyName - Matched property name (if found)
 */
const createJobNotificationForHomeowner = async (userId, jobId, jobData, contractorId, propertyId = null, propertyName = null) => {
    try {
        // Get contractor info for the notification
        let contractorName = 'A contractor';
        try {
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            const contractorSnap = await getDoc(contractorRef);
            if (contractorSnap.exists()) {
                const contractorData = contractorSnap.data();
                contractorName = contractorData.businessName || contractorData.displayName || 'A contractor';
            }
        } catch (e) {
            console.warn('[jobService] Could not fetch contractor name:', e);
        }

        // Build message based on whether property was matched
        let message;
        if (propertyId && propertyName) {
            message = `${contractorName} has created a job for ${propertyName}: ${jobData.title || 'Service'}`;
        } else {
            message = `${contractorName} has created a job at ${jobData.propertyAddress || 'your property'}: ${jobData.title || 'Service'}`;
        }

        // Create notification in user's notifications subcollection
        const notificationPath = `artifacts/${appId}/users/${userId}/notifications`;
        console.log('[jobService] Creating notification at path:', notificationPath);

        const notificationsRef = collection(db, 'artifacts', appId, 'users', userId, 'notifications');
        const notifDoc = await addDoc(notificationsRef, {
            type: 'new_job',
            title: 'New Job Scheduled',
            message,
            jobId: jobId,
            jobNumber: jobData.jobNumber,
            contractorId: contractorId,
            contractorName: contractorName,
            propertyId: propertyId,
            propertyName: propertyName,
            propertyAddress: jobData.propertyAddress,
            scheduledDate: jobData.scheduledDate || null,
            // If no property matched, flag it so homeowner can assign to a property
            requiresPropertyAssignment: !propertyId && !!jobData.propertyAddress,
            read: false,
            createdAt: serverTimestamp()
        });

        console.log('[jobService] Created notification for homeowner:', userId, 'notificationId:', notifDoc.id);
    } catch (error) {
        // Don't fail the job creation if notification fails
        console.error('[jobService] Error creating notification for homeowner:', error);
    }
};

/**
 * Directly link a job to a known homeowner and property
 * Used when we already know the homeowner ID (e.g., from quote or evaluation)
 */
export const setJobHomeownerLink = async (jobId, homeownerId, propertyId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        await updateDoc(jobRef, {
            homeownerId,
            propertyId,
            homeownerLinked: true,
            homeownerLinkedAt: serverTimestamp(),
            homeownerLookupPending: false,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('[jobService] Error setting homeowner link:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all jobs for a homeowner (by email or userId)
 * This allows homeowners to see jobs from contractors
 */
export const getJobsForHomeowner = async (identifier, identifierType = 'email') => {
    try {
        const { collection: firestoreCollection, query: firestoreQuery, where, getDocs, orderBy } = await import('firebase/firestore');

        let q;
        if (identifierType === 'email') {
            // Look up by email (case-insensitive)
            q = firestoreQuery(
                firestoreCollection(db, REQUESTS_COLLECTION_PATH),
                where('customer.email', '==', identifier.toLowerCase().trim()),
                where('type', '==', 'job'),
                orderBy('createdAt', 'desc')
            );
        } else if (identifierType === 'userId') {
            // Look up by homeowner ID
            q = firestoreQuery(
                firestoreCollection(db, REQUESTS_COLLECTION_PATH),
                where('homeownerId', '==', identifier),
                where('type', '==', 'job'),
                orderBy('createdAt', 'desc')
            );
        } else {
            return { success: false, error: 'Invalid identifier type' };
        }

        const snapshot = await getDocs(q);
        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, jobs };
    } catch (error) {
        console.error('[jobService] Error getting homeowner jobs:', error);
        return { success: false, error: error.message, jobs: [] };
    }
};

/**
 * Get upcoming jobs for a homeowner (scheduled, not yet completed)
 */
export const getUpcomingJobsForHomeowner = async (identifier, identifierType = 'email') => {
    const result = await getJobsForHomeowner(identifier, identifierType);

    if (!result.success) return result;

    const upcomingStatuses = [JOB_STATUSES.PENDING, JOB_STATUSES.SCHEDULED, JOB_STATUSES.IN_PROGRESS, JOB_STATUSES.ON_HOLD];
    const upcomingJobs = result.jobs.filter(job => upcomingStatuses.includes(job.status));

    return { success: true, jobs: upcomingJobs };
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

            // Line Items & Inventory Intents (for homeowner records)
            lineItems: jobData.lineItems || [],
            inventoryIntents: jobData.inventoryIntents || [],
            pricing: jobData.pricing || { subtotal: 0, total: 0, itemCount: 0 },

            // Additional fields
            vehicleId: jobData.vehicleId || null,
            accessInstructions: jobData.accessInstructions || '',
            poNumber: jobData.poNumber || '',

            // Metadata
            createdBy: jobData.createdBy || 'contractor',
            quoteId: null,
            requestId: null,
            evaluationId: null,
            completedAt: null,
            completion: null,

            // Homeowner linking flags
            homeownerLinked: false,
            homeownerLookupPending: !!jobData.customerEmail,
            homeownerLookupEmail: jobData.customerEmail?.toLowerCase()?.trim() || null
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

// ============================================
// ENHANCED JOB FUNCTIONS - Timesheet & Homeowner Integration
// ============================================

/**
 * Start a job - Updates status to in_progress and optionally auto-clocks in assigned tech
 * @param {string} contractorId - Contractor ID
 * @param {string} jobId - Job ID
 * @param {Object} options - Options for starting job
 * @param {boolean} options.autoClockIn - Whether to auto-clock in the assigned tech (default: true)
 * @param {string} options.startedBy - Who started the job (techId or 'dispatcher')
 * @param {Object} options.location - GPS location if available
 * @returns {Promise<{success: boolean, timesheetEntry?: Object}>}
 */
export const startJob = async (contractorId, jobId, options = {}) => {
    const {
        autoClockIn = true,
        startedBy = null,
        location = null
    } = options;

    try {
        // Get current job data
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return { success: false, error: 'Job not found' };
        }

        const jobData = jobSnap.data();

        // Validate job can be started
        if (jobData.status === JOB_STATUSES.IN_PROGRESS) {
            return { success: false, error: 'Job is already in progress' };
        }
        if (jobData.status === JOB_STATUSES.COMPLETED) {
            return { success: false, error: 'Cannot start a completed job' };
        }
        if (jobData.status === JOB_STATUSES.CANCELLED) {
            return { success: false, error: 'Cannot start a cancelled job' };
        }

        // Get assigned tech(s) for timesheet
        const assignedTechId = startedBy || jobData.assignedTechId;
        const assignedCrewIds = jobData.assignedCrewIds || [];

        // Update job status
        const updates = {
            status: JOB_STATUSES.IN_PROGRESS,
            startedAt: serverTimestamp(),
            startedBy: startedBy || assignedTechId || 'system',
            updatedAt: serverTimestamp()
        };

        // Track which techs we clocked in
        const clockedInTechs = [];
        let timesheetEntry = null;

        // Auto clock-in for timesheet integration
        if (autoClockIn && assignedTechId) {
            try {
                // Import timesheet service dynamically to avoid circular deps
                const { clockIn, getActiveTimeEntry } = await import('../../timesheets/lib/timesheetService');

                // Check if tech is already clocked in
                const existingEntry = await getActiveTimeEntry(contractorId, assignedTechId);

                if (existingEntry) {
                    // Already clocked in - just link to this job if not already linked
                    if (!existingEntry.jobId) {
                        const { updateTimeEntryJob } = await import('../../timesheets/lib/timesheetService');
                        if (updateTimeEntryJob) {
                            await updateTimeEntryJob(contractorId, assignedTechId, existingEntry.id, jobId);
                        }
                    }
                    timesheetEntry = existingEntry;
                    clockedInTechs.push({ techId: assignedTechId, existing: true });
                } else {
                    // Clock in with job link
                    timesheetEntry = await clockIn(contractorId, assignedTechId, {
                        jobId,
                        location,
                        notes: `Auto clock-in for job: ${jobData.title || jobData.jobNumber || jobId}`
                    });
                    clockedInTechs.push({ techId: assignedTechId, existing: false });
                }

                updates.timesheetLinked = true;
                updates.timesheetEntryId = timesheetEntry?.id || null;
            } catch (timesheetError) {
                // Don't fail the job start if timesheet fails - just log it
                console.warn('[jobService] Timesheet auto-clock-in failed:', timesheetError.message);
                updates.timesheetLinked = false;
                updates.timesheetError = timesheetError.message;
            }
        }

        await updateDoc(jobRef, updates);

        return {
            success: true,
            timesheetEntry,
            clockedInTechs,
            message: clockedInTechs.length > 0
                ? `Job started and ${clockedInTechs[0].existing ? 'linked to existing' : 'auto-clocked in'} timesheet`
                : 'Job started'
        };
    } catch (error) {
        console.error('[jobService] Error starting job:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Complete a job - Updates status and optionally auto-clocks out assigned tech
 * @param {string} contractorId - Contractor ID
 * @param {string} jobId - Job ID
 * @param {Object} options - Options for completing job
 * @param {boolean} options.autoClockOut - Whether to auto-clock out (default: true)
 * @param {string} options.completedBy - Who completed the job
 * @param {Object} options.location - GPS location if available
 * @param {string} options.notes - Completion notes
 * @returns {Promise<{success: boolean, timesheetEntry?: Object}>}
 */
export const completeJob = async (contractorId, jobId, options = {}) => {
    const {
        autoClockOut = true,
        completedBy = null,
        location = null,
        notes = ''
    } = options;

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return { success: false, error: 'Job not found' };
        }

        const jobData = jobSnap.data();
        const assignedTechId = completedBy || jobData.assignedTechId;

        // Calculate duration if job was started
        let actualDurationMinutes = null;
        if (jobData.startedAt) {
            const startTime = jobData.startedAt.toDate ? jobData.startedAt.toDate() : new Date(jobData.startedAt);
            const endTime = new Date();
            actualDurationMinutes = Math.round((endTime - startTime) / 60000);
        }

        const updates = {
            status: JOB_STATUSES.COMPLETED,
            completedAt: serverTimestamp(),
            completedBy: completedBy || assignedTechId || 'system',
            actualDurationMinutes,
            completion: {
                completedAt: new Date().toISOString(),
                completedBy: completedBy || assignedTechId || 'system',
                notes
            },
            updatedAt: serverTimestamp()
        };

        let timesheetEntry = null;

        // Auto clock-out for timesheet integration
        if (autoClockOut && assignedTechId && jobData.timesheetLinked) {
            try {
                const { clockOut, getActiveTimeEntry } = await import('../../timesheets/lib/timesheetService');

                const activeEntry = await getActiveTimeEntry(contractorId, assignedTechId);

                // Only clock out if the active entry is for THIS job
                if (activeEntry && activeEntry.jobId === jobId) {
                    timesheetEntry = await clockOut(contractorId, assignedTechId, {
                        location,
                        notes: `Auto clock-out for job completion: ${jobData.title || jobData.jobNumber || jobId}`
                    });
                    updates.timesheetClockOutAt = serverTimestamp();
                } else if (activeEntry) {
                    // Tech has a different job - don't clock them out
                    console.log('[jobService] Tech has different active job, not auto-clocking out');
                }
            } catch (timesheetError) {
                console.warn('[jobService] Timesheet auto-clock-out failed:', timesheetError.message);
            }
        }

        await updateDoc(jobRef, updates);

        return {
            success: true,
            actualDurationMinutes,
            timesheetEntry
        };
    } catch (error) {
        console.error('[jobService] Error completing job:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Pause a job - For multi-day jobs or lunch breaks
 * Optionally pauses timesheet too
 */
export const pauseJob = async (contractorId, jobId, options = {}) => {
    const { reason = 'break', pauseTimesheet = true } = options;

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return { success: false, error: 'Job not found' };
        }

        const jobData = jobSnap.data();

        if (jobData.status !== JOB_STATUSES.IN_PROGRESS) {
            return { success: false, error: 'Job is not in progress' };
        }

        const updates = {
            status: JOB_STATUSES.ON_HOLD,
            pausedAt: serverTimestamp(),
            pauseReason: reason,
            pauseHistory: [
                ...(jobData.pauseHistory || []),
                { pausedAt: new Date().toISOString(), reason }
            ],
            updatedAt: serverTimestamp()
        };

        // Pause timesheet if linked
        if (pauseTimesheet && jobData.timesheetLinked && jobData.assignedTechId) {
            try {
                const { startBreak, getActiveTimeEntry } = await import('../../timesheets/lib/timesheetService');
                const activeEntry = await getActiveTimeEntry(contractorId, jobData.assignedTechId);

                if (activeEntry && activeEntry.jobId === jobId) {
                    await startBreak(contractorId, jobData.assignedTechId);
                }
            } catch (timesheetError) {
                console.warn('[jobService] Timesheet pause failed:', timesheetError.message);
            }
        }

        await updateDoc(jobRef, updates);
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error pausing job:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Resume a paused job
 */
export const resumeJob = async (contractorId, jobId, options = {}) => {
    const { resumeTimesheet = true } = options;

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return { success: false, error: 'Job not found' };
        }

        const jobData = jobSnap.data();

        if (jobData.status !== JOB_STATUSES.ON_HOLD) {
            return { success: false, error: 'Job is not paused' };
        }

        const updates = {
            status: JOB_STATUSES.IN_PROGRESS,
            resumedAt: serverTimestamp(),
            pauseHistory: [
                ...(jobData.pauseHistory || []).slice(0, -1),
                {
                    ...(jobData.pauseHistory || []).slice(-1)[0],
                    resumedAt: new Date().toISOString()
                }
            ],
            updatedAt: serverTimestamp()
        };

        // Resume timesheet if linked
        if (resumeTimesheet && jobData.timesheetLinked && jobData.assignedTechId) {
            try {
                const { endBreak, getActiveTimeEntry } = await import('../../timesheets/lib/timesheetService');
                const activeEntry = await getActiveTimeEntry(contractorId, jobData.assignedTechId);

                if (activeEntry && activeEntry.status === 'on_break') {
                    await endBreak(contractorId, jobData.assignedTechId);
                }
            } catch (timesheetError) {
                console.warn('[jobService] Timesheet resume failed:', timesheetError.message);
            }
        }

        await updateDoc(jobRef, updates);
        return { success: true };
    } catch (error) {
        console.error('[jobService] Error resuming job:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// HOMEOWNER EMAIL MATCHING ON LOGIN
// ============================================

/**
 * Match and link jobs to homeowner when they log in
 * Finds all jobs with homeownerLookupPending=true that match the homeowner's email
 * and links them to the homeowner's account
 *
 * @param {string} userId - The homeowner's user ID
 * @param {string} userEmail - The homeowner's email address
 * @param {string} [propertyId] - Optional default property ID to link to
 * @returns {Promise<{success: boolean, linked: number, jobs: Array}>}
 */
export const matchJobsToHomeowner = async (userId, userEmail, propertyId = null) => {
    if (!userId || !userEmail) {
        return { success: false, linked: 0, jobs: [], error: 'Missing userId or userEmail' };
    }

    try {
        const normalizedEmail = userEmail.toLowerCase().trim();
        console.log('[jobService] Matching jobs for homeowner:', normalizedEmail);

        // Import Firestore query functions
        const { collection: firestoreCollection, query: firestoreQuery, where, getDocs, writeBatch } = await import('firebase/firestore');

        // Query 1: Find jobs with pending homeowner lookup matching this email
        const pendingQuery = firestoreQuery(
            firestoreCollection(db, REQUESTS_COLLECTION_PATH),
            where('homeownerLookupPending', '==', true),
            where('homeownerLookupEmail', '==', normalizedEmail)
        );

        // Query 2: Also find jobs by customer.email that aren't linked yet
        const emailQuery = firestoreQuery(
            firestoreCollection(db, REQUESTS_COLLECTION_PATH),
            where('customer.email', '==', normalizedEmail),
            where('homeownerLinked', '==', false)
        );

        // Run both queries
        const [pendingSnapshot, emailSnapshot] = await Promise.all([
            getDocs(pendingQuery),
            getDocs(emailQuery)
        ]);

        // Combine results, deduplicating by job ID
        const jobsMap = new Map();

        pendingSnapshot.docs.forEach(doc => {
            jobsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        emailSnapshot.docs.forEach(doc => {
            if (!jobsMap.has(doc.id)) {
                jobsMap.set(doc.id, { id: doc.id, ...doc.data() });
            }
        });

        const jobsToLink = Array.from(jobsMap.values());

        if (jobsToLink.length === 0) {
            console.log('[jobService] No pending jobs found for homeowner');
            return { success: true, linked: 0, jobs: [] };
        }

        console.log(`[jobService] Found ${jobsToLink.length} jobs to link for homeowner`);

        // Batch update all matching jobs
        const batch = writeBatch(db);
        const linkedJobs = [];

        for (const job of jobsToLink) {
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);

            batch.update(jobRef, {
                homeownerId: userId,
                homeownerLinked: true,
                homeownerLinkedAt: serverTimestamp(),
                homeownerLookupPending: false,
                // Link to property if provided
                ...(propertyId && !job.propertyId ? { propertyId } : {}),
                // Also set createdBy if not already set (for homeowner dashboard queries)
                ...(!job.createdBy ? { createdBy: userId } : {}),
                updatedAt: serverTimestamp()
            });

            linkedJobs.push({
                jobId: job.id,
                jobNumber: job.jobNumber,
                title: job.title,
                contractorName: job.contractorName,
                status: job.status
            });
        }

        await batch.commit();

        console.log(`[jobService] Successfully linked ${linkedJobs.length} jobs to homeowner ${userId}`);

        return {
            success: true,
            linked: linkedJobs.length,
            jobs: linkedJobs
        };

    } catch (error) {
        console.error('[jobService] Error matching jobs to homeowner:', error);
        return { success: false, linked: 0, jobs: [], error: error.message };
    }
};

/**
 * Get count of jobs waiting to be linked for a specific email
 * Useful for showing "X jobs found" message during onboarding
 */
export const getPendingJobCountForEmail = async (email) => {
    if (!email) return 0;

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const { collection: firestoreCollection, query: firestoreQuery, where, getDocs } = await import('firebase/firestore');

        const q = firestoreQuery(
            firestoreCollection(db, REQUESTS_COLLECTION_PATH),
            where('customer.email', '==', normalizedEmail),
            where('type', '==', 'job')
        );

        const snapshot = await getDocs(q);
        return snapshot.size;

    } catch (error) {
        console.error('[jobService] Error getting pending job count:', error);
        return 0;
    }
};

// End of file
