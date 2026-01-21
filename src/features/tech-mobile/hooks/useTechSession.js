// src/features/tech-mobile/hooks/useTechSession.js
// ============================================
// TECH SESSION HOOK
// ============================================
// Manages technician authentication session for mobile PWA
// Integrates with techAuthService for PIN-based auth

import { useState, useEffect, useCallback } from 'react';
import {
    getTechSession,
    clearTechSession,
    isSessionValid,
    getTechPortalStatus
} from '../../contractor-pro/lib/techAuthService';
import { db } from '../../../config/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

/**
 * Hook for managing tech session in mobile PWA
 * Provides session state, tech profile, and auth utilities
 */
export const useTechSession = () => {
    // Session state
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Tech profile (full data from Firestore)
    const [techProfile, setTechProfile] = useState(null);
    const [contractor, setContractor] = useState(null);

    // Session validation
    const [sessionError, setSessionError] = useState(null);

    // ============================================
    // INITIALIZE SESSION
    // ============================================
    useEffect(() => {
        const initSession = async () => {
            setIsLoading(true);
            setSessionError(null);

            try {
                // Check for existing session
                const existingSession = getTechSession();

                if (!existingSession) {
                    setIsAuthenticated(false);
                    setIsLoading(false);
                    return;
                }

                // Validate session hasn't expired
                if (!isSessionValid()) {
                    clearTechSession();
                    setIsAuthenticated(false);
                    setSessionError('Session expired. Please sign in again.');
                    setIsLoading(false);
                    return;
                }

                // Verify portal access is still active
                const portalStatus = await getTechPortalStatus(
                    existingSession.contractorId,
                    existingSession.techId
                );

                if (portalStatus.status !== 'active') {
                    clearTechSession();
                    setIsAuthenticated(false);
                    setSessionError('Portal access has been revoked. Contact your manager.');
                    setIsLoading(false);
                    return;
                }

                // Session is valid
                setSession(existingSession);
                setIsAuthenticated(true);

                // Load full tech profile and contractor data
                await loadTechProfile(existingSession.contractorId, existingSession.techId);
                await loadContractor(existingSession.contractorId);

            } catch (error) {
                console.error('[useTechSession] Init error:', error);
                setSessionError(error.message);
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        initSession();
    }, []);

    // ============================================
    // LOAD TECH PROFILE
    // ============================================
    const loadTechProfile = async (contractorId, techId) => {
        try {
            const contractorRef = doc(db, 'contractors', contractorId);
            const contractorSnap = await getDoc(contractorRef);

            if (!contractorSnap.exists()) {
                throw new Error('Contractor not found');
            }

            const contractorData = contractorSnap.data();
            const teamMembers = contractorData.scheduling?.teamMembers || [];
            const tech = teamMembers.find(t => t.id === techId);

            if (!tech) {
                throw new Error('Tech profile not found');
            }

            setTechProfile(tech);
            return tech;
        } catch (error) {
            console.error('[useTechSession] Load profile error:', error);
            throw error;
        }
    };

    // ============================================
    // LOAD CONTRACTOR INFO
    // ============================================
    const loadContractor = async (contractorId) => {
        try {
            const contractorRef = doc(db, 'contractors', contractorId);
            const contractorSnap = await getDoc(contractorRef);

            if (contractorSnap.exists()) {
                const data = contractorSnap.data();
                setContractor({
                    id: contractorId,
                    businessName: data.businessName || data.name,
                    phone: data.phone,
                    email: data.email,
                    logoUrl: data.logoUrl,
                    timezone: data.timezone || 'America/New_York',
                    stripeAccountId: data.stripeAccountId
                });
            }
        } catch (error) {
            console.error('[useTechSession] Load contractor error:', error);
        }
    };

    // ============================================
    // SUBSCRIBE TO PROFILE UPDATES
    // ============================================
    useEffect(() => {
        if (!session?.contractorId) return;

        const unsubscribe = onSnapshot(
            doc(db, 'contractors', session.contractorId),
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    const teamMembers = data.scheduling?.teamMembers || [];
                    const tech = teamMembers.find(t => t.id === session.techId);

                    if (tech) {
                        setTechProfile(tech);

                        // Check if portal access was revoked
                        if (tech.portalAccess?.status !== 'active') {
                            clearTechSession();
                            setIsAuthenticated(false);
                            setSessionError('Portal access has been revoked');
                        }
                    }
                }
            },
            (error) => {
                console.error('[useTechSession] Subscription error:', error);
            }
        );

        return () => unsubscribe();
    }, [session?.contractorId, session?.techId]);

    // ============================================
    // LOGOUT
    // ============================================
    const logout = useCallback(() => {
        clearTechSession();
        setSession(null);
        setIsAuthenticated(false);
        setTechProfile(null);
        setContractor(null);
    }, []);

    // ============================================
    // REFRESH SESSION
    // ============================================
    const refreshSession = useCallback(async () => {
        if (!session) return false;

        try {
            const portalStatus = await getTechPortalStatus(
                session.contractorId,
                session.techId
            );

            if (portalStatus.status !== 'active') {
                logout();
                return false;
            }

            await loadTechProfile(session.contractorId, session.techId);
            return true;
        } catch (error) {
            console.error('[useTechSession] Refresh error:', error);
            return false;
        }
    }, [session, logout]);

    // ============================================
    // COMPUTED VALUES
    // ============================================
    const techName = session?.techName || techProfile?.name || 'Technician';
    const techColor = session?.techColor || techProfile?.color || '#10B981';
    const techInitials = techName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return {
        // Session state
        session,
        isLoading,
        isAuthenticated,
        sessionError,

        // Profile data
        techProfile,
        contractor,

        // Computed
        techName,
        techColor,
        techInitials,

        // Actions
        logout,
        refreshSession,
        loadTechProfile
    };
};

export default useTechSession;
