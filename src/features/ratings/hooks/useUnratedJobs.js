// src/features/ratings/hooks/useUnratedJobs.js
// ============================================
// USE UNRATED JOBS HOOK
// ============================================
// Returns completed jobs that haven't been rated by the homeowner

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';

/**
 * Returns completed jobs that haven't been rated by the homeowner
 *
 * @param {string} userId - The homeowner's user ID
 * @param {number} maxAgeDays - Only show jobs completed within this many days (default 14)
 * @returns {Object} { unratedJobs, loading, error }
 */
export const useUnratedJobs = (userId, maxAgeDays = 14) => {
    const [unratedJobs, setUnratedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userId) {
            setUnratedJobs([]);
            setLoading(false);
            return;
        }

        // Calculate the cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

        // Query for completed jobs by this user
        const jobsRef = collection(db, REQUESTS_COLLECTION_PATH);
        const q = query(
            jobsRef,
            where('createdBy', '==', userId),
            where('status', '==', 'completed'),
            orderBy('completedAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const jobs = [];

                snapshot.forEach((doc) => {
                    const data = doc.data();

                    // Check if already rated by homeowner
                    const hasRating = !!data.ratings?.homeownerToContractor;

                    // Check if dismissed too many times (3+)
                    const dismissCount = data.ratingDismissCount || 0;
                    const isDismissed = dismissCount >= 3;

                    // Check if within max age
                    const completedAt = data.completedAt || data.completion?.completedAt;
                    let isRecent = true;

                    if (completedAt) {
                        const completedDate = completedAt.toDate ? completedAt.toDate() : new Date(completedAt);
                        isRecent = completedDate >= cutoffDate;
                    }

                    // Include if: not rated, not dismissed, recent, has contractor
                    if (!hasRating && !isDismissed && isRecent && data.contractorId) {
                        jobs.push({
                            id: doc.id,
                            ...data
                        });
                    }
                });

                setUnratedJobs(jobs);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('[useUnratedJobs] Error:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId, maxAgeDays]);

    return { unratedJobs, loading, error };
};

export default useUnratedJobs;
