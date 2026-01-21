// src/features/tech-mobile/hooks/useTechJobs.js
// ============================================
// TECH JOBS HOOK
// ============================================
// Fetches and manages jobs assigned to the current technician
// Real-time updates via Firestore subscription

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../config/firebase';
import {
    collection, query, where, orderBy, onSnapshot,
    doc, updateDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import { isTechAssigned, getAssignedTechIds } from '../../contractor-pro/lib/crewUtils';

/**
 * Hook for fetching jobs assigned to a technician
 * @param {string} techId - Technician's ID
 * @param {string} contractorId - Contractor's ID
 * @param {Object} options - Additional options
 * @returns {Object} Jobs data and utilities
 */
export const useTechJobs = (techId, contractorId, options = {}) => {
    const {
        dateRange = 'week', // 'today', 'week', 'all'
        includeCompleted = false
    } = options;

    // State
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // ============================================
    // CALCULATE DATE RANGE
    // ============================================
    const getDateRange = useCallback(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateRange === 'today') {
            const endOfToday = new Date(startOfToday);
            endOfToday.setDate(endOfToday.getDate() + 1);
            return { start: startOfToday, end: endOfToday };
        }

        if (dateRange === 'week') {
            // Get start of this week (Sunday)
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

            // End of week (Saturday)
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 7);

            return { start: startOfWeek, end: endOfWeek };
        }

        // 'all' - past 30 days to future 30 days
        const start = new Date(startOfToday);
        start.setDate(start.getDate() - 30);
        const end = new Date(startOfToday);
        end.setDate(end.getDate() + 30);

        return { start, end };
    }, [dateRange]);

    // ============================================
    // SUBSCRIBE TO JOBS
    // ============================================
    useEffect(() => {
        if (!techId || !contractorId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const { start, end } = getDateRange();

        // Query jobs - we'll filter by tech assignment client-side
        // since tech can be assigned in assignedTechId or assignedCrew array
        const jobsQuery = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where('contractorId', '==', contractorId),
            where('type', '==', 'accepted_quote'), // Only jobs (not requests/quotes)
            orderBy('scheduledDate', 'asc')
        );

        const unsubscribe = onSnapshot(
            jobsQuery,
            (snapshot) => {
                const allJobs = [];

                snapshot.forEach(doc => {
                    const job = { id: doc.id, ...doc.data() };

                    // Check if this tech is assigned
                    if (!isTechAssigned(job, techId)) {
                        return;
                    }

                    // Check date range
                    const jobDate = job.scheduledDate?.toDate?.() ||
                        (job.scheduledDate ? new Date(job.scheduledDate) : null);

                    if (jobDate) {
                        if (jobDate < start || jobDate >= end) {
                            return;
                        }
                    }

                    // Filter out completed if requested
                    const isCompleted = job.status === 'completed' ||
                        job.status === 'completion_accepted' ||
                        job.status === 'cancelled';

                    if (isCompleted && !includeCompleted) {
                        return;
                    }

                    // Parse and normalize job data
                    allJobs.push(normalizeJob(job, techId));
                });

                // Sort by date and time
                allJobs.sort((a, b) => {
                    const dateA = a.scheduledDateTime || new Date(0);
                    const dateB = b.scheduledDateTime || new Date(0);
                    return dateA - dateB;
                });

                setJobs(allJobs);
                setIsLoading(false);
            },
            (err) => {
                console.error('[useTechJobs] Subscription error:', err);
                setError(err.message);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [techId, contractorId, dateRange, includeCompleted, getDateRange]);

    // ============================================
    // NORMALIZE JOB DATA
    // ============================================
    const normalizeJob = (job, techId) => {
        // Parse scheduled date/time
        let scheduledDateTime = null;
        if (job.scheduledDate) {
            const date = job.scheduledDate?.toDate?.() || new Date(job.scheduledDate);
            if (job.scheduledTime) {
                const [hours, minutes] = job.scheduledTime.split(':').map(Number);
                date.setHours(hours || 9, minutes || 0, 0, 0);
            }
            scheduledDateTime = date;
        }

        // Get tech's role in this job
        const assignedCrew = job.assignedCrew || [];
        const techCrewMember = assignedCrew.find(c => c.techId === techId);
        const techRole = techCrewMember?.role || (job.assignedTechId === techId ? 'lead' : 'assigned');

        // Calculate estimated end time
        const duration = job.estimatedDuration || 60;
        let estimatedEndTime = null;
        if (scheduledDateTime) {
            estimatedEndTime = new Date(scheduledDateTime.getTime() + duration * 60 * 1000);
        }

        return {
            id: job.id,
            // Basic info
            title: job.title || job.description || 'Service Job',
            description: job.description || '',
            status: job.status || 'scheduled',
            jobNumber: job.jobNumber || job.id?.slice(-6),

            // Scheduling
            scheduledDate: job.scheduledDate,
            scheduledDateTime,
            scheduledTime: job.scheduledTime,
            estimatedDuration: duration,
            estimatedEndTime,

            // Customer info
            customerName: job.customer?.name || job.customerName || 'Customer',
            customerPhone: job.customer?.phone || job.customerPhone,
            customerEmail: job.customer?.email || job.customerEmail,

            // Address
            serviceAddress: job.serviceAddress,
            addressFormatted: formatAddress(job.serviceAddress),
            coordinates: job.coordinates || job.serviceAddress?.coordinates,

            // Tech assignment
            techRole,
            assignedCrew,
            crewSize: assignedCrew.length || 1,
            isLead: techRole === 'lead',

            // Job details
            category: job.category || job.serviceType,
            notes: job.notes || job.internalNotes,
            customerNotes: job.customerNotes || job.specialInstructions,

            // Photos
            beforePhotos: job.beforePhotos || [],
            afterPhotos: job.completionData?.photos || [],

            // Financials
            total: job.total || 0,
            balanceDue: job.balanceDue || job.total || 0,
            depositPaid: job.depositPaid || job.depositAmount || 0,

            // Completion
            completionData: job.completionData,
            signature: job.completionData?.signature,

            // Status tracking
            checkedIn: job.techCheckedIn || false,
            checkedInAt: job.techCheckedInAt,
            checkedOut: job.techCheckedOut || false,
            checkedOutAt: job.techCheckedOutAt,

            // Raw data for reference
            _raw: job
        };
    };

    // ============================================
    // FORMAT ADDRESS
    // ============================================
    const formatAddress = (address) => {
        if (!address) return 'Address not specified';
        if (typeof address === 'string') return address;

        const parts = [
            address.street,
            address.city,
            address.state,
            address.zip
        ].filter(Boolean);

        return parts.join(', ') || 'Address not specified';
    };

    // ============================================
    // GROUPED JOBS (BY DAY)
    // ============================================
    const jobsByDay = useMemo(() => {
        const grouped = {};

        jobs.forEach(job => {
            const date = job.scheduledDateTime || new Date();
            const dayKey = date.toISOString().split('T')[0];

            if (!grouped[dayKey]) {
                grouped[dayKey] = {
                    date: new Date(dayKey),
                    dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
                    dateFormatted: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    isToday: dayKey === new Date().toISOString().split('T')[0],
                    jobs: []
                };
            }

            grouped[dayKey].jobs.push(job);
        });

        return Object.values(grouped).sort((a, b) => a.date - b.date);
    }, [jobs]);

    // ============================================
    // TODAY'S JOBS
    // ============================================
    const todaysJobs = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return jobs.filter(job => {
            const jobDate = job.scheduledDateTime?.toISOString().split('T')[0];
            return jobDate === today;
        });
    }, [jobs]);

    // ============================================
    // NEXT JOB
    // ============================================
    const nextJob = useMemo(() => {
        const now = new Date();
        return jobs.find(job => {
            const jobTime = job.scheduledDateTime;
            if (!jobTime) return false;
            // Not completed and either scheduled for later today or a future date
            const isIncomplete = !['completed', 'completion_accepted', 'cancelled'].includes(job.status);
            return isIncomplete && jobTime >= now;
        }) || null;
    }, [jobs]);

    // ============================================
    // UPDATE JOB STATUS
    // ============================================
    const updateJobStatus = useCallback(async (jobId, newStatus, additionalData = {}) => {
        try {
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
            await updateDoc(jobRef, {
                status: newStatus,
                ...additionalData,
                lastActivity: serverTimestamp(),
                lastUpdatedBy: techId,
                lastUpdatedByType: 'tech'
            });
            return { success: true };
        } catch (err) {
            console.error('[useTechJobs] Update status error:', err);
            throw err;
        }
    }, [techId]);

    // ============================================
    // CHECK IN/OUT
    // ============================================
    const checkIn = useCallback(async (jobId, location = null) => {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        await updateDoc(jobRef, {
            techCheckedIn: true,
            techCheckedInAt: serverTimestamp(),
            techCheckedInBy: techId,
            techCheckedInLocation: location,
            status: 'in_progress',
            lastActivity: serverTimestamp()
        });
        return { success: true };
    }, [techId]);

    const checkOut = useCallback(async (jobId, location = null) => {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        await updateDoc(jobRef, {
            techCheckedOut: true,
            techCheckedOutAt: serverTimestamp(),
            techCheckedOutBy: techId,
            techCheckedOutLocation: location,
            lastActivity: serverTimestamp()
        });
        return { success: true };
    }, [techId]);

    const pauseJob = useCallback(async (jobId, location = null) => {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        await updateDoc(jobRef, {
            techCheckedIn: false,
            status: 'paused',
            lastActivity: serverTimestamp(),
            // Optional: Track pause history in a subcollection later
            lastPausedAt: serverTimestamp(),
            lastPausedBy: techId,
            lastPausedLocation: location
        });
        return { success: true };
    }, [techId]);

    // ============================================
    // REFRESH
    // ============================================
    const refresh = useCallback(() => {
        // The subscription handles real-time updates
        // This is a placeholder for manual refresh if needed
    }, []);

    return {
        // Data
        jobs,
        jobsByDay,
        todaysJobs,
        nextJob,

        // State
        isLoading,
        error,

        // Actions
        updateJobStatus,
        checkIn,
        checkOut,
        pauseJob,
        refresh,

        // Counts
        totalJobs: jobs.length,
        todayCount: todaysJobs.length
    };
};

export default useTechJobs;
