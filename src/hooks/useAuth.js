// src/hooks/useAuth.js
// ============================================
// AUTHENTICATION HOOK
// ============================================
// Handles Firebase authentication state and actions
// Can be used standalone or as part of useAppLogic

import { useState, useEffect, useCallback } from 'react';
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { debug } from '../lib/debug';

/**
 * Custom hook for Firebase authentication
 * @returns {Object} Auth state and methods
 */
export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Listen to auth state changes
    useEffect(() => {
        debug.log('[useAuth] Setting up auth listener...');

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            debug.log('[useAuth] Auth state changed:', {
                hasUser: !!currentUser,
                email: currentUser?.email
            });

            setUser(currentUser);
            setLoading(false);
            setError(null);
        });

        return () => {
            debug.log('[useAuth] Cleanup auth listener');
            unsubscribe();
        };
    }, []);

    // Sign up with email and password
    const signUp = useCallback(async (email, password) => {
        setError(null);
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Sign in with email and password
    const signIn = useCallback(async (email, password) => {
        setError(null);
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Sign out
    const logout = useCallback(async () => {
        setError(null);
        try {
            await signOut(auth);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Combined handler (matching existing useAppLogic signature)
    const handleAuth = useCallback(async (email, password, isSignUp) => {
        return isSignUp
            ? signUp(email, password)
            : signIn(email, password);
    }, [signUp, signIn]);

    // Refresh token (useful after sign-up to ensure Firestore permissions work)
    const refreshToken = useCallback(async () => {
        if (!user) return null;
        try {
            const token = await user.getIdToken(true);
            debug.log('[useAuth] Token refreshed');
            return token;
        } catch (err) {
            debug.warn('[useAuth] Token refresh failed:', err);
            throw err;
        }
    }, [user]);

    return {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        signUp,
        signIn,
        logout,
        handleAuth,
        refreshToken
    };
};

export default useAuth;
