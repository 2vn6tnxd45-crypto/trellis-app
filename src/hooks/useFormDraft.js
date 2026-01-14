import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to automatically save form state to localStorage
 * @param {string} key - Unique key for storage
 * @param {any} initialState - Default state
 * @returns [state, setState, clearDraft]
 */
export const useFormDraft = (key, initialState) => {
    // Initialize state from existing draft or default
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                console.log(`[FormDraft] Found draft for ${key}`);
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('[FormDraft] Failed to load draft:', e);
        }
        return initialState;
    });

    // Update localStorage whenever state changes
    useEffect(() => {
        try {
            if (state !== initialState) {
                localStorage.setItem(key, JSON.stringify(state));
            }
        } catch (e) {
            console.warn('[FormDraft] Failed to save draft:', e);
        }
    }, [key, state, initialState]);

    // Helper to manually clear the draft (e.g. after submission)
    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setState(initialState);
            console.log(`[FormDraft] Cleared draft for ${key}`);
        } catch (e) {
            console.warn('[FormDraft] Failed to clear draft:', e);
        }
    }, [key, initialState]);

    return [state, setState, clearDraft];
};
