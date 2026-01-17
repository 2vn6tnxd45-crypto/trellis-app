// src/hooks/useRecords.js
// ============================================
// RECORDS HOOK
// ============================================
// Handles house records (inventory items) with Firestore realtime sync
// Can be used standalone or as part of useAppLogic

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    doc,
    updateDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { appId } from '../config/constants';
import { debug } from '../lib/debug';
import toast from 'react-hot-toast';

/**
 * Custom hook for house records management
 * @param {Object} user - Firebase user object
 * @param {Object} activeProperty - Currently active property
 * @returns {Object} Records state and methods
 */
export const useRecords = (user, activeProperty) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Ref for cleanup to prevent stale closures
    const unsubscribeRef = useRef(null);

    // Subscribe to records collection
    useEffect(() => {
        if (!user) {
            setRecords([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        // Cleanup previous listener
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        const q = query(
            collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'),
            orderBy('dateInstalled', 'desc')
        );

        unsubscribeRef.current = onSnapshot(
            q,
            (snapshot) => {
                debug.log('[useRecords] Snapshot received:', snapshot.docs.length, 'records');
                const recordsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setRecords(recordsData);
                setLoading(false);
            },
            (err) => {
                debug.error('[useRecords] Snapshot error:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [user]);

    // Filter records by active property
    const activePropertyRecords = useMemo(() => {
        if (!activeProperty) return records;
        return records.filter(r =>
            r.propertyId === activeProperty.id ||
            (!r.propertyId && activeProperty.id === 'legacy')
        );
    }, [records, activeProperty]);

    // Calculate due tasks (items due for maintenance within 30 days)
    const dueTasks = useMemo(() => {
        if (!activeProperty || records.length === 0) return [];

        const now = new Date();
        return activePropertyRecords
            .filter(r => {
                if (!r.nextServiceDate) return false;
                const diff = Math.ceil((new Date(r.nextServiceDate) - now) / 86400000);
                return diff <= 30;
            })
            .map(r => ({
                ...r,
                diffDays: Math.ceil((new Date(r.nextServiceDate) - now) / 86400000)
            }))
            .sort((a, b) => a.diffDays - b.diffDays);
    }, [records, activeProperty, activePropertyRecords]);

    // Helper to get record document reference
    const getRecordRef = useCallback((recordId, propertyId = null) => {
        if (propertyId && propertyId !== 'legacy') {
            return doc(db, 'artifacts', appId, 'users', user.uid, 'properties', propertyId, 'records', recordId);
        }
        return doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', recordId);
    }, [user]);

    // Update a record
    const updateRecord = useCallback(async (recordId, updates, propertyId = null) => {
        if (!user) {
            toast.error('Not authenticated');
            return false;
        }

        try {
            const recordRef = getRecordRef(recordId, propertyId);
            await updateDoc(recordRef, updates);
            return true;
        } catch (err) {
            debug.error('[useRecords] updateRecord error:', err);
            toast.error('Failed to update record: ' + err.message);
            return false;
        }
    }, [user, getRecordRef]);

    // Delete a record
    const deleteRecord = useCallback(async (recordId, propertyId = null) => {
        if (!user) {
            toast.error('Not authenticated');
            return false;
        }

        try {
            const recordRef = getRecordRef(recordId, propertyId);
            await deleteDoc(recordRef);
            toast.success('Record deleted');
            return true;
        } catch (err) {
            debug.error('[useRecords] deleteRecord error:', err);
            toast.error('Failed to delete record: ' + err.message);
            return false;
        }
    }, [user, getRecordRef]);

    // Get a single record by ID
    const getRecord = useCallback((recordId) => {
        return records.find(r => r.id === recordId) || null;
    }, [records]);

    return {
        // State
        records,
        loading,
        error,
        activePropertyRecords,
        dueTasks,

        // Actions
        updateRecord,
        deleteRecord,
        getRecord,
        getRecordRef
    };
};

export default useRecords;
