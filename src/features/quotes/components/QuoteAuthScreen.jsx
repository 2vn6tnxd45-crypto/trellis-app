// src/features/quotes/components/QuoteAuthScreen.jsx
// ============================================
// QUOTE AUTH SCREEN
// ============================================
// Contextual auth screen shown when a user needs to sign in/up
// to accept or save a quote. Maintains quote context throughout.

import React, { useState } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import { 
    User, Mail, Lock, Eye, EyeOff, X, CheckCircle,
    MessageSquare, Calendar, Shield, FileText, Loader2
} from 'lucide-react';

// ============================================
// QUOTE SUMMARY CARD
// ============================================
const QuoteSummaryCard = ({ quote, contractor }) => {
    const total = quote?.total || quote?.lineItems?.reduce((sum, item) => 
        sum + (parseFloat(item.total) || 0), 0
    ) || 0;
    
    return (
        <div className="bg-gradient-to-br from-emerald-50 to-slate-50 rounded-2xl p-5 border border-emerald-100">
            <div className="flex items-start gap-4">
                {/* Contractor Logo/Avatar */}
                {contractor?.logoUrl ? (
                    <img 
                        src={contractor.logoUrl} 
                        alt={contractor.companyName}
                        className="h-14 w-14 rounded-xl object-cover border-2 border-white shadow-sm"
                    />
                ) : (
                    <div className="h-14 w-14 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
                        {(contractor?.companyName || 'C').charAt(0)}
                    </div>
                )}
                
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">
                        Quote from
                    </p>
                    <h3 className="font-bold text-slate-800 truncate">
                        {contractor?.companyName || 'Contractor'}
                    </h3>
                    <p className="text-sm text-slate-500 truncate">
                        {quote?.title || quote?.description || 'Service Quote'}
                    </p>
                </div>
                
                {/* Amount */}
                <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-emerald-600">
                        ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// BENEFITS LIST
// ============================================
const BenefitsList = ({ action }) => {
    const getTitle = () => {
        switch (action) {
            case 'accept': return 'Create your account to accept this quote:';
            case 'question': return 'Create your account to message the contractor:';
            default: return 'Create your account to:';
        }
    };
    
    return (
        <div className="space-y-3 my-6">
            <p className="text-sm font-medium text-slate-700">{getTitle()}</p>
            <div className="grid grid-cols-2 gap-2">
                {[
                    { icon: CheckCircle, text: action === 'accept' ? 'Accept & schedule' : 'Accept this quote' },
                    { icon: MessageSquare, text: action === 'question' ? 'Ask questions directly' : 'Message contractor' },
                    { icon: Calendar, text: 'Track job progress' },
                    { icon: Shield, text: 'Store warranty' },
                ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-sm text-slate-600">
                        <Icon size={16} className="text-emerald-500 flex-shrink-0" />
                        <span>{text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const QuoteAuthScreen = ({ 
    quote, 
    contractor, 
    onSuccess, 
    onClose,
    action = 'save', // 'save', 'accept', or 'question'
    initialMode = 'signup' // 'signup' or 'signin'
}) => {
    const [mode, setMode] = useState(initialMode);
    const [name, setName] = useState('');
    const [email, setEmail] = useState(quote?.customer?.email || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    /**
     * Save the user's name to their profile document
     */
    const saveUserProfile = async (userId, userName, userEmail) => {
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
            await setDoc(profileRef, {
                name: userName,
                email: userEmail,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (err) {
            console.warn('[QuoteAuthScreen] Could not save profile:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            if (mode === 'signin') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                // Sign up
                const credential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Set display name in Firebase Auth
                if (name.trim()) {
                    await updateProfile(credential.user, {
                        displayName: name.trim()
                    });
                    
                    // Save to Firestore profile
                    await saveUserProfile(credential.user.uid, name.trim(), email);
                }
            }
            
            onSuccess?.();
        } catch (err) {
            console.error('Auth error:', err);
            
            // Handle specific errors
            if (err.code === 'auth/email-already-in-use') {
                setError('This email already has an account. Try signing in instead.');
                setMode('signin');
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else if (err.code === 'auth/user-not-found') {
                setError('No account found with this email. Try signing up.');
                setMode('signup');
            } else {
                setError(err.message.replace('Firebase: ', ''));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        setError('');
        
        try {
            const credential = await signInWithPopup(auth, new GoogleAuthProvider());
            
            // Save Google displayName to profile
            if (credential.user.displayName) {
                await saveUserProfile(
                    credential.user.uid, 
                    credential.user.displayName, 
                    credential.user.email
                );
            }
            
            onSuccess?.();
        } catch (err) {
            console.error('Google auth error:', err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign in cancelled.');
            } else {
                setError('Failed to sign in with Google. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const isSignUp = mode === 'signup';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Close button */}
                {onClose && (
                    <div className="flex justify-end mb-4">
                        <button 
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                )}

                {/* Quote Context Card */}
                <QuoteSummaryCard quote={quote} contractor={contractor} />

                {/* Main Auth Card */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mt-4 border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 mb-1">
                        {isSignUp ? 'Create your account' : 'Welcome back'}
                    </h2>
                    <p className="text-slate-500 text-sm mb-4">
                        {isSignUp 
                            ? (action === 'accept' 
                                ? 'Sign up to accept this quote and get started.'
                                : action === 'question'
                                ? 'Sign up to message the contractor directly.'
                                : 'Sign up to save this quote and track your project.')
                            : 'Sign in to continue with this quote.'
                        }
                    </p>

                    {/* Benefits - only show on signup */}
                    {isSignUp && <BenefitsList action={action} />}

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleAuth}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-5">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="text-slate-400 text-xs font-medium">OR</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Field - Only on signup */}
                        {isSignUp && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Your Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="John Smith"
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    So {contractor?.companyName || 'the contractor'} knows who you are
                                </p>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={isSignUp ? 'Create a password' : 'Your password'}
                                    required
                                    minLength={6}
                                    className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    {isSignUp 
                                        ? (action === 'accept' 
                                            ? 'Create Account & Accept' 
                                            : action === 'question'
                                            ? 'Create Account & Message'
                                            : 'Create Account & Save')
                                        : 'Sign In & Continue'
                                    }
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle Sign In / Sign Up */}
                    <p className="text-center text-sm text-slate-500 mt-5">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            onClick={() => { 
                                setMode(isSignUp ? 'signin' : 'signup'); 
                                setError(''); 
                            }}
                            className="ml-1 text-emerald-600 font-semibold hover:text-emerald-700"
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400 mt-6">
                    By continuing, you agree to our{' '}
                    <a href="/privacy_policy.html" className="underline hover:text-emerald-600">
                        Privacy Policy
                    </a>
                </p>
            </div>
        </div>
    );
};

export default QuoteAuthScreen;
