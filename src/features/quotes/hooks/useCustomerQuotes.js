// src/features/quotes/hooks/useCustomerQuotes.js
import { useState, useEffect, useCallback } from 'react';
import { collectionGroup, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export const useCustomerQuotes = (userId) => {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchQuotes = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            setError('no-user');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Use getDocs instead of onSnapshot to avoid persistent listener issues
            const q = query(
                collectionGroup(db, 'quotes'),
                where('customerId', '==', userId),
                orderBy('updatedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const results = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                contractorId: doc.ref.parent.parent.id
            }));

            setQuotes(results);
            setError(null);
        } catch (err) {
            console.error("Error fetching my quotes:", err);
            if (err.code === 'failed-precondition') {
                setError('missing-index');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchQuotes();
    }, [fetchQuotes]);

    // Expose refresh function for manual refetch
    return { quotes, loading, error, refresh: fetchQuotes };
};
