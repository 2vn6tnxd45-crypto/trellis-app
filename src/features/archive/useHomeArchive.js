// src/features/archive/useHomeArchive.js
// ============================================
// HOME ARCHIVE HOOK
// ============================================
// Fetches historical/closed items for homeowners:
// - Completed jobs
// - Declined quotes
// - Expired quotes  
// - Canceled jobs
// - Completed evaluations

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    collection, 
    collectionGroup,
    query, 
    where, 
    orderBy, 
    getDocs,
    onSnapshot 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';

// ============================================
// ARCHIVE ITEM TYPES
// ============================================
export const ARCHIVE_TYPES = {
    COMPLETED_JOB: 'completed_job',
    CANCELED_JOB: 'canceled_job',
    DECLINED_QUOTE: 'declined_quote',
    EXPIRED_QUOTE: 'expired_quote',
    ACCEPTED_QUOTE: 'accepted_quote', // Quote that became a job (for reference)
};

// ============================================
// MAIN HOOK
// ============================================
export const useHomeArchive = (userId) => {
    const [jobs, setJobs] = useState([]);
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ----------------------------------------
    // Fetch Archived Jobs (Completed + Canceled)
    // ----------------------------------------
    useEffect(() => {
        if (!userId) {
            setJobs([]);
            return;
        }

        const q = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where('createdBy', '==', userId),
            where('status', 'in', ['completed', 'cancelled', 'canceled']),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const results = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    archiveType: doc.data().status === 'completed' 
                        ? ARCHIVE_TYPES.COMPLETED_JOB 
                        : ARCHIVE_TYPES.CANCELED_JOB
                }));
                setJobs(results);
            },
            (err) => {
                console.error('Error fetching archived jobs:', err);
                // Don't set error for missing index - just return empty
                if (err.code !== 'failed-precondition') {
                    setError(err.message);
                }
                setJobs([]);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    // ----------------------------------------
    // Fetch Archived Quotes (Declined, Expired, Accepted)
    // ----------------------------------------
    const fetchArchivedQuotes = useCallback(async () => {
        if (!userId) {
            setQuotes([]);
            setLoading(false);
            return;
        }

        try {
            // Query for quotes claimed by this user that are closed
            const q = query(
                collectionGroup(db, 'quotes'),
                where('customerId', '==', userId),
                where('status', 'in', ['declined', 'expired', 'accepted']),
                orderBy('updatedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const results = snapshot.docs.map(doc => {
                const data = doc.data();
                let archiveType = ARCHIVE_TYPES.ACCEPTED_QUOTE;
                if (data.status === 'declined') archiveType = ARCHIVE_TYPES.DECLINED_QUOTE;
                if (data.status === 'expired') archiveType = ARCHIVE_TYPES.EXPIRED_QUOTE;
                
                return {
                    id: doc.id,
                    ...data,
                    contractorId: doc.ref.parent.parent.id,
                    archiveType
                };
            });

            setQuotes(results);
        } catch (err) {
            console.error('Error fetching archived quotes:', err);
            // Don't fail on missing index
            if (err.code !== 'failed-precondition') {
                setError(err.message);
            }
            setQuotes([]);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchArchivedQuotes();
    }, [fetchArchivedQuotes]);

    // ----------------------------------------
    // Combine and Sort All Archive Items
    // ----------------------------------------
    const allItems = useMemo(() => {
        const combined = [
            ...jobs.map(j => ({
                ...j,
                itemType: 'job',
                sortDate: j.completedAt || j.updatedAt || j.createdAt
            })),
            ...quotes.map(q => ({
                ...q,
                itemType: 'quote',
                sortDate: q.declinedAt || q.acceptedAt || q.updatedAt || q.createdAt
            }))
        ];

        // Sort by most recent first
        return combined.sort((a, b) => {
            const dateA = a.sortDate?.toDate ? a.sortDate.toDate() : new Date(a.sortDate || 0);
            const dateB = b.sortDate?.toDate ? b.sortDate.toDate() : new Date(b.sortDate || 0);
            return dateB - dateA;
        });
    }, [jobs, quotes]);

    // ----------------------------------------
    // Filter Helpers
    // ----------------------------------------
    const completedJobs = useMemo(() => 
        jobs.filter(j => j.archiveType === ARCHIVE_TYPES.COMPLETED_JOB), 
        [jobs]
    );

    const canceledJobs = useMemo(() => 
        jobs.filter(j => j.archiveType === ARCHIVE_TYPES.CANCELED_JOB), 
        [jobs]
    );

    const declinedQuotes = useMemo(() => 
        quotes.filter(q => q.archiveType === ARCHIVE_TYPES.DECLINED_QUOTE), 
        [quotes]
    );

    const expiredQuotes = useMemo(() => 
        quotes.filter(q => q.archiveType === ARCHIVE_TYPES.EXPIRED_QUOTE), 
        [quotes]
    );

    const acceptedQuotes = useMemo(() => 
        quotes.filter(q => q.archiveType === ARCHIVE_TYPES.ACCEPTED_QUOTE), 
        [quotes]
    );

    // ----------------------------------------
    // Stats
    // ----------------------------------------
    const stats = useMemo(() => ({
        totalItems: allItems.length,
        completedJobs: completedJobs.length,
        canceledJobs: canceledJobs.length,
        declinedQuotes: declinedQuotes.length,
        expiredQuotes: expiredQuotes.length,
        acceptedQuotes: acceptedQuotes.length,
        totalSpent: completedJobs.reduce((sum, j) => sum + (j.total || 0), 0),
        totalDeclinedValue: declinedQuotes.reduce((sum, q) => sum + (q.total || 0), 0),
    }), [allItems, completedJobs, canceledJobs, declinedQuotes, expiredQuotes, acceptedQuotes]);

    return {
        // All items combined
        allItems,
        
        // Filtered lists
        completedJobs,
        canceledJobs,
        declinedQuotes,
        expiredQuotes,
        acceptedQuotes,
        
        // Raw data
        jobs,
        quotes,
        
        // Stats
        stats,
        
        // State
        loading,
        error,
        
        // Actions
        refresh: fetchArchivedQuotes,
    };
};

export default useHomeArchive;
