import { useState, useEffect } from 'react';
import { collectionGroup, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';

export const useCustomerQuotes = (userId) => {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userId) {
            console.warn('[useCustomerQuotes] No userId provided - cannot fetch quotes');
            setLoading(false);
            setError('no-user');
            return;
        }

        // Reset state when userId changes
        setLoading(true);
        setError(null);

        // QUERY: Find ALL quotes where customerId matches the logged-in user
        // This requires a "Collection Group Index" in Firestore
        const q = query(
            collectionGroup(db, 'quotes'),
            where('customerId', '==', userId),
            orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // We also need the contractorId to build the link
                contractorId: doc.ref.parent.parent.id 
            }));
            setQuotes(results);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching my quotes:", err);
            // This specific error code means you need to create the index
            if (err.code === 'failed-precondition') {
                setError('missing-index');
                console.error(
                    'Missing Firestore index for quotes collection group.',
                    'Please create a composite index: customerId (asc) + updatedAt (desc)'
                );
            } else {
                setError(err.message);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return { quotes, loading, error };
};
