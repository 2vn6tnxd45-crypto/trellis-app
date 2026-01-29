// src/hooks/useStableArray.js
// ============================================
// STABLE ARRAY HOOK
// ============================================
// Prevents unnecessary re-renders when Firestore returns new array references
// with identical data. Uses referential equality checking on key fields.

import { useRef } from 'react';

/**
 * Hook that returns a stable array reference when the underlying data hasn't changed.
 * This prevents unnecessary re-renders caused by Firestore returning new array instances
 * on every snapshot even when the actual data is the same.
 *
 * @param {Array} array - The array to stabilize
 * @param {string[]} compareKeys - Keys to compare for equality (default: common job fields)
 * @returns {Array} - Stable array reference
 */
export const useStableArray = (array, compareKeys = ['id', 'status', 'scheduledTime', 'assignedTechId']) => {
    const ref = useRef(array);

    // If array is null/undefined, return cached value
    if (!array) return ref.current;

    // Quick length check - if length differs, data changed
    if (ref.current?.length !== array.length) {
        ref.current = array;
        return ref.current;
    }

    // Check if any relevant fields changed
    const hasChanged = array.some((item, index) => {
        const prev = ref.current?.[index];
        if (!prev) return true;

        return compareKeys.some(key => {
            const newVal = item[key];
            const oldVal = prev[key];

            // Handle Firestore Timestamps (compare seconds)
            if (newVal?.seconds !== undefined && oldVal?.seconds !== undefined) {
                return newVal.seconds !== oldVal.seconds;
            }

            // Handle Date objects
            if (newVal instanceof Date && oldVal instanceof Date) {
                return newVal.getTime() !== oldVal.getTime();
            }

            // Handle arrays (shallow comparison)
            if (Array.isArray(newVal) && Array.isArray(oldVal)) {
                if (newVal.length !== oldVal.length) return true;
                return newVal.some((v, i) => v !== oldVal[i]);
            }

            // Direct comparison for primitives and object references
            return newVal !== oldVal;
        });
    });

    // Only update reference if data actually changed
    if (hasChanged) {
        ref.current = array;
    }

    return ref.current;
};

export default useStableArray;
