// src/features/auth/AuthScreen.jsx
import React, { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { appId } from '../../config/constants';
import { linkQuotesByEmail } from '../quotes/lib/quoteService';
import { matchJobsToHomeowner } from '../jobs/lib/jobService';
import { linkEvaluationsByEmail } from '../evaluations/lib/evaluationService';
import { Logo } from '../../components/common/Logo';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export const AuthScreen = () => {
    // CHANGED: from isLogin boolean to mode string
    const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'reset'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);  // ← ADDED

    // Rate limiting state
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState(null);

    // ADDED: Helper variables for cleaner code
    const isLogin = mode === 'signin';
    const isSignUp = mode === 'signup';
    const isReset = mode === 'reset';

    /**
     * Save the user's name to their profile document and handle new user setup
     * This is called after signup (email or Google) to persist the name.
     * For new users: sends welcome email and links any existing quotes.
     * For returning users (Google sign-in): skips welcome email.
     */
    const saveUserName = async (userId, userName, userEmail, isNewUser = false) => {
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');

            // Check if profile already exists (for Google sign-in detection)
            const existingProfile = await getDoc(profileRef);
            const isExistingUser = existingProfile.exists() && existingProfile.data()?.createdAt;

            await setDoc(profileRef, {
                name: userName,
                email: userEmail,
                ...(isExistingUser ? {} : { createdAt: serverTimestamp() }),
                updatedAt: serverTimestamp()
            }, { merge: true });
            console.log('[AuthScreen] Saved user name to profile:', userName);

            // Also store email at root user document for efficient querying
            // This allows contractors to look up users by email when creating jobs
            const userRef = doc(db, 'artifacts', appId, 'users', userId);
            await setDoc(userRef, {
                email: userEmail.toLowerCase().trim(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            console.log('[AuthScreen] Stored email at user root for querying');

            // ALWAYS run linking on every login/signup to catch new evaluations/quotes/jobs
            // This ensures evaluations sent after account creation are linked when user logs in
            console.log('[AuthScreen] Running entity linking tasks for:', userEmail);

            // Link any quotes sent to this email (non-blocking)
            linkQuotesByEmail(userId, userEmail).then((result) => {
                if (result.linked > 0) {
                    console.log(`[AuthScreen] Linked ${result.linked} quotes to user`);
                }
            }).catch((err) => {
                console.warn('[AuthScreen] Quote linking failed:', err);
            });

            // Link any evaluations sent to this email (non-blocking)
            linkEvaluationsByEmail(userId, userEmail).then((result) => {
                if (result.linked > 0) {
                    console.log(`[AuthScreen] Linked ${result.linked} evaluations to user`);
                }
            }).catch((err) => {
                console.warn('[AuthScreen] Evaluation linking failed:', err);
            });

            // Link any jobs created for this email (non-blocking)
            matchJobsToHomeowner(userId, userEmail).then((result) => {
                if (result.linked > 0) {
                    console.log(`[AuthScreen] Linked ${result.linked} jobs to user`);
                }
            }).catch((err) => {
                console.warn('[AuthScreen] Job linking failed:', err);
            });

            // Only for NEW users: send welcome email
            if (isNewUser || !isExistingUser) {
                console.log('[AuthScreen] New user detected, sending welcome email');
                fetch('/api/send-welcome', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail, userName })
                }).then(() => {
                    console.log('[AuthScreen] Welcome email sent');
                }).catch((err) => {
                    console.warn('[AuthScreen] Welcome email failed:', err);
                });
            }

        } catch (err) {
            // Don't fail signup if profile save fails - it can be added later
            console.warn('[AuthScreen] Could not save name to profile:', err);
        }
    };

    // EDGE CASE: Password strength validation
    const validatePassword = (pwd) => {
        if (pwd.length < 8) {
            return 'Password must be at least 8 characters';
        }
        if (!/[A-Z]/.test(pwd)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(pwd)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(pwd)) {
            return 'Password must contain at least one number';
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Client-side rate limiting check
        if (lockoutUntil && Date.now() < lockoutUntil) {
            const seconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
            setError(`Too many attempts. Please try again in ${seconds} seconds.`);
            return;
        }

        // EDGE CASE: Validate password strength during signup
        if (isSignUp) {
            const passwordError = validatePassword(password);
            if (passwordError) {
                setError(passwordError);
                return;
            }
            // Also validate name is provided
            if (!name.trim()) {
                setError('Please enter your name');
                return;
            }
        }

        setLoading(true);

        try {
            if (isLogin) {
                // LOGIN: Sign in and run linking logic for any new evaluations/quotes/jobs
                const credential = await signInWithEmailAndPassword(auth, email, password);

                // Run entity linking on every login to catch evaluations/quotes sent after account creation
                // This is non-blocking and runs in the background
                const userId = credential.user.uid;
                const userEmail = credential.user.email;

                linkEvaluationsByEmail(userId, userEmail).then((result) => {
                    if (result.linked > 0) {
                        console.log(`[AuthScreen] Linked ${result.linked} evaluations on login`);
                    }
                }).catch((err) => {
                    console.warn('[AuthScreen] Evaluation linking failed on login:', err);
                });

                linkQuotesByEmail(userId, userEmail).then((result) => {
                    if (result.linked > 0) {
                        console.log(`[AuthScreen] Linked ${result.linked} quotes on login`);
                    }
                }).catch((err) => {
                    console.warn('[AuthScreen] Quote linking failed on login:', err);
                });

                matchJobsToHomeowner(userId, userEmail).then((result) => {
                    if (result.linked > 0) {
                        console.log(`[AuthScreen] Linked ${result.linked} jobs on login`);
                    }
                }).catch((err) => {
                    console.warn('[AuthScreen] Job linking failed on login:', err);
                });
            } else {
                // SIGNUP: Create account, set display name, save to profile
                const credential = await createUserWithEmailAndPassword(auth, email, password);

                // Set Firebase Auth display name (useful for other Firebase features)
                if (name.trim()) {
                    await updateProfile(credential.user, {
                        displayName: name.trim()
                    });

                    // Also save to Firestore profile for our app to use
                    // Pass isNewUser=true since this is email signup (always new)
                    await saveUserName(credential.user.uid, name.trim(), email, true);
                }
            }
            // Success - reset failed attempts
            setFailedAttempts(0);
            setLockoutUntil(null);
        } catch (err) {
            // Track failed attempts for rate limiting
            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);

            // Lock out after 5 failed attempts for 30 seconds
            if (newAttempts >= 5) {
                setLockoutUntil(Date.now() + 30000);
                setFailedAttempts(0);
            }

            // EDGE CASE: Provide user-friendly error messages
            const errorCode = err.code;
            if (errorCode === 'auth/email-already-in-use') {
                setError('An account with this email already exists. Try signing in instead.');
                setMode('signin'); // Switch to sign-in mode
            } else if (errorCode === 'auth/invalid-email') {
                setError('Please enter a valid email address');
            } else if (errorCode === 'auth/weak-password') {
                setError('Password is too weak. Please use a stronger password');
            } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
                setError('Invalid email or password');
            } else if (errorCode === 'auth/invalid-credential') {
                setError('Invalid email or password. Please check your credentials and try again.');
            } else if (errorCode === 'auth/too-many-requests') {
                setError('Too many failed attempts. Please try again later');
            } else if (errorCode === 'auth/network-request-failed') {
                setError('Network error. Please check your connection');
            } else if (errorCode === 'auth/user-disabled') {
                setError('This account has been disabled. Please contact support.');
            } else if (errorCode === 'auth/operation-not-allowed') {
                setError('This sign-in method is not enabled. Please try another method.');
            } else {
                // Generic fallback - sanitize Firebase prefix and code format
                const cleanMessage = err.message
                    .replace('Firebase: ', '')
                    .replace(/\(auth\/[^)]+\)\.?/g, '')
                    .trim();
                setError(cleanMessage || 'An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ← ADDED: New password reset handler
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!email) {
            setError('Please enter your email address');
            return;
        }

        setError('');
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setResetSent(true);
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                setError('No account found with this email address');
            } else if (err.code === 'auth/invalid-email') {
                setError('Please enter a valid email address');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Too many requests. Please wait a few minutes and try again.');
            } else {
                // Generic fallback - sanitize Firebase prefix and code format
                const cleanMessage = err.message
                    .replace('Firebase: ', '')
                    .replace(/\(auth\/[^)]+\)\.?/g, '')
                    .trim();
                setError(cleanMessage || 'Unable to send reset email. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');

        try {
            const credential = await signInWithPopup(auth, new GoogleAuthProvider());

            // Google provides displayName automatically
            // Save it to our profile document for consistency
            if (credential.user.displayName) {
                await saveUserName(
                    credential.user.uid,
                    credential.user.displayName,
                    credential.user.email
                );
            }
        } catch (err) {
            // Handle Google sign-in specific errors
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign-in was cancelled. Please try again.');
            } else if (err.code === 'auth/popup-blocked') {
                setError('Pop-up was blocked. Please allow pop-ups for this site.');
            } else if (err.code === 'auth/cancelled-popup-request') {
                // User clicked multiple times - ignore silently
                return;
            } else {
                const cleanMessage = err.message
                    .replace('Firebase: ', '')
                    .replace(/\(auth\/[^)]+\)\.?/g, '')
                    .trim();
                setError(cleanMessage || 'Unable to sign in with Google. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center mb-2">
                        <Logo className="h-10" />
                    </div>
                    <p className="text-slate-500 mt-1">Your home's digital twin</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-emerald-100">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        {isReset ? 'Reset Password' : (isLogin ? 'Welcome back' : 'Create your Krib')}
                    </h2>
                    <p className="text-slate-500 text-sm mb-6">
                        {isReset
                            ? "Enter your email and we'll send you a reset link."
                            : (isLogin ? 'Sign in to access your home records.' : 'Start tracking your home today.')
                        }
                    </p>

                    {/* Google Sign In - CHANGED: Hide during reset */}
                    {!isReset && (
                        <>
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full py-3.5 px-4 bg-white border-2 border-slate-200 rounded-xl font-semibold text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>

                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-slate-200"></div>
                                <span className="text-slate-400 text-xs font-medium">OR</span>
                                <div className="flex-1 h-px bg-slate-200"></div>
                            </div>
                        </>
                    )}

                    <form onSubmit={isReset ? handlePasswordReset : handleSubmit} className="space-y-4">
                        {/* NAME FIELD - Only shown during signup */}
                        {isSignUp && (
                            <div>
                                <label htmlFor="auth-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Your Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                                    <input
                                        id="auth-name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Smith"
                                        data-testid="auth-name-input"
                                        aria-describedby="name-help"
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <p id="name-help" className="text-xs text-slate-400 mt-1">
                                    This helps contractors know who they're working with
                                </p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                                <input
                                    id="auth-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    data-testid="auth-email-input"
                                    autoComplete="email"
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* PASSWORD FIELD - CHANGED: Hide during reset mode */}
                        {!isReset && (
                            <div>
                                <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                                    <input
                                        id="auth-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                        required
                                        minLength={8}
                                        data-testid="auth-password-input"
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                        className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ← ADDED: Forgot Password Link - Only show on signin */}
                        {isLogin && (
                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMode('reset');
                                        setError('');
                                        setResetSent(false);
                                    }}
                                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        {/* ← ADDED: Reset Success Message */}
                        {isReset && resetSent && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <p className="text-emerald-700 text-sm font-medium">
                                    ✓ Password reset email sent! Check your inbox.
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* CHANGED: Submit button handles all 3 modes */}
                        {!(isReset && resetSent) && (
                            <button
                                type="submit"
                                disabled={loading}
                                data-testid="auth-submit-button"
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                            >
                                {loading ? 'Please wait...' : (
                                    isReset ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account')
                                )}
                            </button>
                        )}
                    </form>

                    {/* CHANGED: Mode toggle now handles reset mode */}
                    <p className="text-center text-sm text-slate-500 mt-6">
                        {isReset ? (
                            <button
                                onClick={() => { setMode('signin'); setError(''); setResetSent(false); }}
                                className="text-emerald-600 font-semibold hover:text-emerald-700"
                            >
                                ← Back to Sign In
                            </button>
                        ) : (
                            <>
                                {isLogin ? "Don't have an account?" : "Already have an account?"}
                                <button
                                    onClick={() => { setMode(isLogin ? 'signup' : 'signin'); setError(''); setName(''); }}
                                    className="ml-1 text-emerald-600 font-semibold hover:text-emerald-700"
                                >
                                    {isLogin ? 'Sign up' : 'Sign in'}
                                </button>
                            </>
                        )}
                    </p>
                </div>

                <p className="text-center text-xs text-slate-400 mt-8">
                    By continuing, you agree to our <a href="/privacy_policy.html" className="underline hover:text-emerald-600">Privacy Policy</a>.
                </p>

                {/* Contractor portal link */}
                {/* Contractor portal link */}
                <div className="text-center mt-6 pt-6 border-t border-slate-200">
                    <p className="text-sm text-slate-500 mb-2">Are you a contractor or service pro?</p>
                    <a
                        href="?pro"
                        className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                        Free tools for your business →
                    </a>
                </div>
            </div>
        </div>
    );
};
