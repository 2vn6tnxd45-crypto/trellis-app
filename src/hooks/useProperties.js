// src/hooks/useProperties.js
// ============================================
// PROPERTIES HOOK
// ============================================
// Handles property management for homeowner accounts
// Can be used standalone or as part of useAppLogic

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { appId } from '../config/constants';
import { debug } from '../lib/debug';
import { normalizeAddress } from '../lib/addressUtils';
import { removeUndefined } from '../lib/utils';
import toast from 'react-hot-toast';

/**
 * Custom hook for property management
 * @param {Object} user - Firebase user object
 * @param {Object} profile - User profile data
 * @returns {Object} Property state and methods
 */
export const useProperties = (user, profile) => {
    const [activePropertyId, setActivePropertyId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);

    // Derive properties from profile
    const properties = useMemo(() => {
        if (!profile) return [];
        if (profile.properties && Array.isArray(profile.properties)) {
            // Filter out any properties without a valid address or name
            return profile.properties.filter(p => {
                const hasValidAddress = p.address && (
                    typeof p.address === 'string' && p.address.trim().length > 0 ||
                    typeof p.address === 'object' && (p.address.street || p.address.city)
                );
                const hasValidName = p.name && p.name.trim().length > 0 && p.name !== profile.name;
                return hasValidAddress || hasValidName;
            });
        }
        // Handle legacy single-property format - only if there's an actual address
        if (profile.address) {
            const hasValidAddress = typeof profile.address === 'string'
                ? profile.address.trim().length > 0
                : (profile.address.street || profile.address.city);

            if (hasValidAddress) {
                const propertyName = typeof profile.address === 'string'
                    ? profile.address.split(',')[0]
                    : profile.address.street || 'My Home';
                return [{
                    id: 'legacy',
                    name: propertyName,
                    address: profile.address,
                    coordinates: profile.coordinates
                }];
            }
        }
        return [];
    }, [profile]);

    // Get active property
    const activeProperty = useMemo(() => {
        return properties.find(p => p.id === activePropertyId) || properties[0] || null;
    }, [properties, activePropertyId]);

    // Initialize active property from profile
    useEffect(() => {
        if (profile && !activePropertyId) {
            const defaultId = profile.activePropertyId || profile.properties?.[0]?.id || 'legacy';
            setActivePropertyId(defaultId);
        }
    }, [profile, activePropertyId]);

    // Helper to sanitize address
    const sanitizeAddress = useCallback((addr) => {
        if (!addr) return { street: '', city: '', state: '', zip: '' };
        if (typeof addr === 'string') {
            return { street: addr, city: '', state: '', zip: '' };
        }
        return {
            street: addr.street || '',
            city: addr.city || '',
            state: addr.state || '',
            zip: addr.zip || ''
        };
    }, []);

    // Save a new property
    const saveProperty = useCallback(async (formData) => {
        if (!user) {
            debug.error('[useProperties] saveProperty: No authenticated user');
            toast.error('Authentication error. Please try signing in again.');
            return false;
        }

        if (!appId) {
            debug.error('[useProperties] saveProperty: appId is missing');
            toast.error('Configuration error. Please refresh the page.');
            return false;
        }

        setIsSaving(true);

        try {
            // Refresh token to ensure permissions
            await user.getIdToken(true);
            await new Promise(r => setTimeout(r, 200));

            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);
            const existingProfile = profileSnap.exists() ? profileSnap.data() : {};

            const newPropertyId = Date.now().toString();
            const newProperty = {
                id: newPropertyId,
                name: formData.name || 'My Home',
                address: sanitizeAddress(formData.address),
                coordinates: formData.coordinates || null
            };

            let existingProperties = existingProfile.properties || [];

            // Convert legacy data if needed
            if (existingProperties.length === 0 && existingProfile.name) {
                existingProperties = [{
                    id: 'legacy',
                    name: existingProfile.name || 'My Home',
                    address: sanitizeAddress(existingProfile.address),
                    coordinates: existingProfile.coordinates || null
                }];
            }

            const updatedProperties = [...existingProperties, newProperty];

            const newProfile = {
                properties: updatedProperties,
                activePropertyId: newPropertyId,
                updatedAt: serverTimestamp()
            };

            // Preserve existing fields
            if (existingProfile.name) newProfile.name = existingProfile.name;
            if (existingProfile.email) newProfile.email = existingProfile.email;
            if (existingProfile.hasSeenWelcome) newProfile.hasSeenWelcome = existingProfile.hasSeenWelcome;
            if (existingProfile.createdAt) newProfile.createdAt = existingProfile.createdAt;

            // Clean undefined values
            const cleanedProfile = removeUndefined ? removeUndefined(newProfile) : newProfile;

            await setDoc(profileRef, cleanedProfile, { merge: true });

            setActivePropertyId(newPropertyId);
            toast.success(existingProperties.length === 0 ? "Krib created!" : "Property added!");

            setIsSaving(false);
            setIsAdding(false);
            return true;

        } catch (error) {
            debug.error('[useProperties] saveProperty failed:', error);
            toast.error("Failed to save: " + (error?.message || 'Unknown error'));
            setIsSaving(false);
            return false;
        }
    }, [user, sanitizeAddress]);

    // Switch active property
    const switchProperty = useCallback(async (propertyId) => {
        if (!user || !propertyId) return;

        setIsSwitching(true);

        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            await setDoc(profileRef, { activePropertyId: propertyId }, { merge: true });
            setActivePropertyId(propertyId);
            toast.success('Switched property');
        } catch (error) {
            debug.error('[useProperties] switchProperty failed:', error);
            toast.error('Failed to switch property');
        } finally {
            setIsSwitching(false);
        }
    }, [user]);

    return {
        // State
        properties,
        activeProperty,
        activePropertyId,
        setActivePropertyId,
        isSaving,
        isAdding,
        setIsAdding,
        isSwitching,
        setIsSwitching,

        // Actions
        saveProperty,
        switchProperty
    };
};

export default useProperties;
