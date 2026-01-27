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
            const results = snapshot.docs.map(doc => {
                const data = doc.data();

                // BUG-047 FIX: Extract contractorId correctly based on document path
                // Quotes can be stored in two locations:
                // 1. /artifacts/krib-app/public/data/contractors/{contractorId}/quotes/{quoteId} (correct)
                // 2. /artifacts/krib-app/public/data/quotes/{quoteId} (legacy - no contractor context)
                // Use stored contractorId field if available, otherwise extract from path
                let contractorId = data.contractorId;

                if (!contractorId) {
                    // Try to extract from path - check if parent collection is under a contractor
                    const pathSegments = doc.ref.path.split('/');
                    const contractorsIndex = pathSegments.indexOf('contractors');
                    if (contractorsIndex !== -1 && pathSegments[contractorsIndex + 1]) {
                        contractorId = pathSegments[contractorsIndex + 1];
                    }
                }

                return {
                    id: doc.id,
                    ...data,
                    contractorId
                };
            });

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
