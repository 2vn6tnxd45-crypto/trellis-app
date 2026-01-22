// src/features/contractor-pro/hooks/useJobs.js
// ============================================
// JOBS HOOK
// ============================================
// React hook for managing jobs with real-time updates

import { useState, useEffect, useCallback } from 'react';
import {
    createJob,
    updateJob,
    updateJobStatus,
    getJob,
    getJobsByDate,
    getUnscheduledJobs,
    subscribeToJobs,
    assignJobToTech,
    rescheduleJob,
    JOB_STATUSES,
    JOB_STATUS_LABELS
} from '../lib/jobService';

/**
 * Hook for managing jobs for a contractor
 */
export const useJobs = (contractorId, options = {}) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { date, techId, statuses, realtime = true } = options;

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        if (realtime) {
            const unsubscribe = subscribeToJobs(
                contractorId,
                (data) => {
                    setJobs(data);
                    setLoading(false);
                },
                { date, techId, statuses }
            );

            return () => unsubscribe();
        } else {
            const fetch = async () => {
                try {
                    const data = date
                        ? await getJobsByDate(contractorId, date, { techId })
                        : await getUnscheduledJobs(contractorId);
                    setJobs(data);
                } catch (err) {
                    console.error('Error fetching jobs:', err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };

            fetch();
        }
    }, [contractorId, date, techId, statuses?.join(','), realtime]);

    // Create job
    const create = useCallback(async (jobData) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await createJob(contractorId, jobData);
    }, [contractorId]);

    // Update job
    const update = useCallback(async (jobId, updates) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await updateJob(contractorId, jobId, updates);
    }, [contractorId]);

    // Update status
    const changeStatus = useCallback(async (jobId, newStatus, metadata = {}) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await updateJobStatus(contractorId, jobId, newStatus, metadata);
    }, [contractorId]);

    // Assign to tech
    const assign = useCallback(async (jobId, techId, techName) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await assignJobToTech(contractorId, jobId, techId, techName);
    }, [contractorId]);

    // Reschedule
    const reschedule = useCallback(async (jobId, newSchedule) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await rescheduleJob(contractorId, jobId, newSchedule);
    }, [contractorId]);

    // Mark as running late (Quick Win #2)
    const markRunningLate = useCallback(async (jobId, reason) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await updateJobStatus(contractorId, jobId, JOB_STATUSES.RUNNING_LATE, { reason });
    }, [contractorId]);

    // Derived stats
    const stats = {
        total: jobs.length,
        scheduled: jobs.filter(j => j.status === JOB_STATUSES.SCHEDULED).length,
        inProgress: jobs.filter(j => j.status === JOB_STATUSES.IN_PROGRESS).length,
        runningLate: jobs.filter(j => j.status === JOB_STATUSES.RUNNING_LATE).length,
        completed: jobs.filter(j => j.status === JOB_STATUSES.COMPLETED).length,
        unscheduled: jobs.filter(j => j.status === JOB_STATUSES.PENDING_SCHEDULE).length
    };

    // Filter helpers
    const byStatus = (status) => jobs.filter(j => j.status === status);
    const byTech = (techId) => jobs.filter(j => j.assignedTechId === techId);
    const byPriority = (priority) => jobs.filter(j => j.priority === priority);

    return {
        jobs,
        loading,
        error,
        stats,
        // Actions
        create,
        update,
        changeStatus,
        assign,
        reschedule,
        markRunningLate,
        // Filters
        byStatus,
        byTech,
        byPriority,
        // Constants
        JOB_STATUSES,
        JOB_STATUS_LABELS
    };
};

/**
 * Hook for a single job
 */
export const useJob = (contractorId, jobId) => {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId || !jobId) {
            setLoading(false);
            return;
        }

        const fetch = async () => {
            try {
                const data = await getJob(contractorId, jobId);
                setJob(data);
            } catch (err) {
                console.error('Error fetching job:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetch();
    }, [contractorId, jobId]);

    return { job, loading, error };
};

/**
 * Hook for today's schedule
 */
export const useTodaySchedule = (contractorId, techId = null) => {
    const today = new Date().toISOString().split('T')[0];
    return useJobs(contractorId, { date: today, techId });
};

/**
 * Hook for unscheduled jobs
 */
export const useUnscheduledJobs = (contractorId) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        const fetch = async () => {
            try {
                const data = await getUnscheduledJobs(contractorId);
                setJobs(data);
            } catch (err) {
                console.error('Error fetching unscheduled jobs:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetch();
    }, [contractorId]);

    const refresh = useCallback(async () => {
        if (!contractorId) return;
        setLoading(true);
        try {
            const data = await getUnscheduledJobs(contractorId);
            setJobs(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [contractorId]);

    return { jobs, loading, error, refresh };
};

export default {
    useJobs,
    useJob,
    useTodaySchedule,
    useUnscheduledJobs
};
