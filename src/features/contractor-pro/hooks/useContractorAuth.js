// src/features/contractor-pro/hooks/useContractorAuth.js
// ============================================
// CONTRACTOR AUTH HOOK
// ============================================
// Manages authentication state for contractor accounts
// UPDATED: Now subscribes to profile changes in real-time

import { useState, useEffect, useCallback } from 'react';
import { 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // UPDATED: Added real-time imports
import { auth, db } from '../../../config/firebase'; // UPDATED: Added db import
import { 
    getContractorProfile, 
    saveContractorProfile,
    migrateAnonymousInvitations 
} from '../lib/contractorService';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';

const CONTRACTORS_COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';

export const useContractorAuth = () => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    
    // Listen to auth state changes AND profile changes
    useEffect(() => {
        let unsubscribeProfile = null;
        let loadingTimeout = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);

            // Clean up previous profile subscription if exists
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }

            // Clear any existing timeout
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }

            if (firebaseUser) {
                // Set a timeout fallback in case Firestore subscription never fires
                // This prevents infinite loading spinner if there's a permissions/network issue
                loadingTimeout = setTimeout(() => {
                    console.warn('[useContractorAuth] Profile load timeout - forcing loading=false');
                    setLoading(false);
                }, 10000); // 10 second timeout

                // Subscribe to real-time profile updates
                const profileRef = doc(db, CONTRACTORS_COLLECTION, firebaseUser.uid);

                unsubscribeProfile = onSnapshot(profileRef, (snap) => {
                    // Clear timeout since we got a response
                    if (loadingTimeout) {
                        clearTimeout(loadingTimeout);
                        loadingTimeout = null;
                    }

                    if (snap.exists()) {
                        const profileData = { id: snap.id, ...snap.data() };
                        setProfile(profileData);
                    } else {
                        console.log('[useContractorAuth] No profile found');
                        setProfile(null);
                    }
                    setLoading(false);
                }, (error) => {
                    // Clear timeout since we got a response (even if error)
                    if (loadingTimeout) {
                        clearTimeout(loadingTimeout);
                        loadingTimeout = null;
                    }

                    console.error('[useContractorAuth] Profile subscription error:', error);
                    setProfile(null);
                    setLoading(false);
                });
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
            if (loadingTimeout) clearTimeout(loadingTimeout);
        };
    }, []);
    
    // Sign up with email/password
    const signUp = useCallback(async (email, password, profileData) => {
        setAuthError(null);
        
        try {
            // Create Firebase auth account
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            const { user: newUser } = credential;
            
            // Create contractor profile
            await saveContractorProfile(newUser.uid, {
                displayName: profileData.name || '',
                companyName: profileData.company || '',
                phone: profileData.phone || '',
                email: email,
                trades: profileData.trades || [],
                public: false
            });
            
            // Check for existing invitations to migrate
            try {
                const migrationResult = await migrateAnonymousInvitations(newUser.uid, email);
                
                if (migrationResult.migratedCount > 0) {
                    toast.success(
                        `Found ${migrationResult.migratedCount} existing invitation${migrationResult.migratedCount !== 1 ? 's' : ''}!`,
                        { duration: 5000 }
                    );
                }
            } catch (migErr) {
                console.warn("Migration failed silently:", migErr);
            }
            
            // Profile state will update via the onSnapshot listener above
            
            return { success: true, user: newUser };
        } catch (error) {
            console.error('Sign up error:', error);
            setAuthError(getAuthErrorMessage(error.code));
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }, []);
    
    // Sign in with email/password
    const signIn = useCallback(async (email, password) => {
        setAuthError(null);
        
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            
            // Initial check to ensure they are actually a contractor before state updates
            // (Real-time listener handles the data loading, this just gates access)
            const contractorProfile = await getContractorProfile(credential.user.uid);
            
            if (!contractorProfile) {
                await firebaseSignOut(auth);
                setAuthError('This account is not registered as a contractor. Please sign up.');
                return { success: false, error: 'Not a contractor account' };
            }
            
            return { success: true, user: credential.user };
        } catch (error) {
            console.error('Sign in error:', error);
            setAuthError(getAuthErrorMessage(error.code));
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }, []);
    
    // Sign in with Google
    const signInWithGoogle = useCallback(async () => {
        setAuthError(null);
        
        try {
            const provider = new GoogleAuthProvider();
            const credential = await signInWithPopup(auth, provider);
            const { user: googleUser } = credential;
            
            // Check if contractor profile exists
            let contractorProfile = await getContractorProfile(googleUser.uid);
            
            if (!contractorProfile) {
                // New contractor - create profile with Google info
                await saveContractorProfile(googleUser.uid, {
                    displayName: googleUser.displayName || '',
                    companyName: '',
                    phone: googleUser.phoneNumber || '',
                    email: googleUser.email,
                    trades: [],
                    public: false
                });
                
                // Check for existing invitations
                if (googleUser.email) {
                    try {
                        const migrationResult = await migrateAnonymousInvitations(
                            googleUser.uid, 
                            googleUser.email
                        );
                        
                        if (migrationResult.migratedCount > 0) {
                            toast.success(
                                `Found ${migrationResult.migratedCount} existing invitation${migrationResult.migratedCount !== 1 ? 's' : ''}!`,
                                { duration: 5000 }
                            );
                        }
                    } catch (migErr) {
                        console.warn("Migration failed silently:", migErr);
                    }
                }
                
                // Profile will load via listener
            }
            
            return { success: true, user: googleUser, isNewUser: !contractorProfile };
        } catch (error) {
            console.error('Google sign in error:', error);
            setAuthError(getAuthErrorMessage(error.code));
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }, []);
    
    // Sign out
    const signOut = useCallback(async () => {
        try {
            await firebaseSignOut(auth);
            setProfile(null);
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    }, []);
    
    // Reset password
    const resetPassword = useCallback(async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success('Password reset email sent!');
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    }, []);
    
    // Update profile
    const updateProfile = useCallback(async (profileData) => {
        if (!user) return { success: false, error: 'Not authenticated' };
        
        try {
            await saveContractorProfile(user.uid, {
                ...profile?.profile,
                ...profileData
            });
            
            // No need to manually setProfile, the snapshot listener will pick it up
            
            toast.success('Profile updated!');
            return { success: true };
        } catch (error) {
            console.error('Update profile error:', error);
            toast.error('Failed to update profile');
            return { success: false, error: error.message };
        }
    }, [user, profile]);
    
    // Clear error
    const clearError = useCallback(() => {
        setAuthError(null);
    }, []);
    
    return {
        // State
        user,
        profile,
        loading,
        authError,
        isAuthenticated: !!user && !!profile,
        needsProfileSetup: !!user && (!profile || !profile.profile?.companyName),
        
        // Actions
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        updateProfile,
        clearError
    };
};

// ============================================
// HELPER: Auth error messages
// ============================================
const getAuthErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Try signing in instead.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/operation-not-allowed':
            return 'Email/password sign up is not enabled.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/popup-closed-by-user':
            return 'Sign in was cancelled.';
        default:
            return 'An error occurred. Please try again.';
    }
};

export default useContractorAuth;
