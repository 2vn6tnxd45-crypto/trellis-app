// src/features/invitations/InvitationClaimFlow.jsx
// ============================================
// INVITATION CLAIM FLOW
// ============================================
// This component handles the flow when a user clicks on an invitation link.
// It shows a preview of what they'll receive, handles auth, and imports records.

import React, { useState, useEffect } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    OAuthProvider,
    onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
    Home, Package, CheckCircle, AlertCircle, Loader2, 
    Mail, Lock, Eye, EyeOff, ArrowRight, User,
    Building2, Shield, Clock, Gift, Sparkles, ChevronDown
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { auth, db } from '../../config/firebase';
import { appId } from '../../config/constants';
import { validateInvitation, checkEmailMatch, claimInvitation, getInvitationPreview } from '../../lib/invitations';
import { Logo } from '../../components/common/Logo';

// ============================================
// LOADING STATE
// ============================================
const LoadingState = () => (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="text-center">
            <Loader2 className="animate-spin h-12 w-12 text-emerald-600 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">Loading invitation...</p>
        </div>
    </div>
);

// ============================================
// ERROR STATE
// ============================================
const ErrorState = ({ error, onGoHome }) => {
    const errorMessages = {
        'not_found': {
            title: 'Invitation Not Found',
            message: "This invitation link doesn't exist or may have been deleted."
        },
        'expired': {
            title: 'Invitation Expired',
            message: 'This invitation has expired. Please ask the contractor for a new link.'
        },
        'already_claimed': {
            title: 'Already Claimed',
            message: 'This invitation has already been claimed. If this was you, sign in to see your records.'
        },
        'email_mismatch': {
            title: 'Email Mismatch',
            message: 'This invitation was sent to a different email address. Please sign in with the correct email.'
        },
        'default': {
            title: 'Something Went Wrong',
            message: 'We encountered an error loading this invitation. Please try again.'
        }
    };
    
    const { title, message } = errorMessages[error] || errorMessages.default;
    
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[2rem] shadow-xl text-center max-w-md w-full border border-slate-100">
                <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
                <p className="text-slate-500 mb-8">{message}</p>
                <button
                    onClick={onGoHome}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                    Go to Krib
                </button>
            </div>
        </div>
    );
};

// ============================================
// SUCCESS STATE
// ============================================
const SuccessState = ({ importedCount, contractorName, onContinue }) => (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[2rem] shadow-xl text-center max-w-md w-full border border-emerald-100">
            <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-emerald-950 mb-2">Records Imported!</h1>
            <p className="text-slate-500 mb-2">
                {importedCount} item{importedCount !== 1 ? 's' : ''} from <span className="font-medium text-slate-700">{contractorName}</span> {importedCount !== 1 ? 'have' : 'has'} been added to your home.
            </p>
            <p className="text-sm text-slate-400 mb-8">
                You can now track maintenance, warranties, and more.
            </p>
            <button
                onClick={onContinue}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
                <Home size={18} />
                Go to My Home
            </button>
        </div>
    </div>
);

// ============================================
// AUTH FORM COMPONENT
// ============================================
const AuthForm = ({ onSuccess, invite, lockedEmail }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState(lockedEmail || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            onSuccess();
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            onSuccess();
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };
    
    const handleAppleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const provider = new OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');
            await signInWithPopup(auth, provider);
            onSuccess();
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                </div>
            )}
            
            {/* Social Login Buttons */}
            <div className="space-y-3">
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>
                
                <button
                    onClick={handleAppleLogin}
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-black text-white rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Continue with Apple
                </button>
            </div>
            
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500">or</span>
                </div>
            </div>
            
            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email
                    </label>
                    <div className="relative">
                        <Mail size={18} className="absolute left-4 top-3.5 text-slate-400" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@email.com"
                            required
                            disabled={!!lockedEmail}
                            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        />
                    </div>
                    {lockedEmail && (
                        <p className="mt-1 text-xs text-slate-500">
                            This invitation is locked to this email address
                        </p>
                    )}
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Password
                    </label>
                    <div className="relative">
                        <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={isLogin ? 'Your password' : 'Create a password'}
                            required
                            minLength={6}
                            className="w-full pl-11 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : (
                        <>
                            {isLogin ? 'Sign In' : 'Create Account'}
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </form>
            
            <p className="text-center text-sm text-slate-500">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-emerald-600 font-medium hover:underline"
                >
                    {isLogin ? 'Sign up' : 'Sign in'}
                </button>
            </p>
        </div>
    );
};

// ============================================
// PROPERTY SELECTOR (For existing users)
// ============================================
const PropertySelector = ({ properties, selectedId, onSelect, onCreateNew }) => {
    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 mb-2">
                Import to which property?
            </label>
            {properties.map(prop => (
                <button
                    key={prop.id}
                    onClick={() => onSelect(prop.id)}
                    className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors border-2 text-left ${
                        selectedId === prop.id 
                            ? 'bg-emerald-50 border-emerald-500' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <div className={`p-2 rounded-lg ${selectedId === prop.id ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Home size={18} className={selectedId === prop.id ? 'text-emerald-600' : 'text-slate-500'} />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">{prop.name}</p>
                        {prop.address && (
                            <p className="text-xs text-slate-500">
                                {typeof prop.address === 'string' 
                                    ? prop.address.split(',')[0]
                                    : prop.address.street}
                            </p>
                        )}
                    </div>
                    {selectedId === prop.id && (
                        <CheckCircle size={20} className="ml-auto text-emerald-600" />
                    )}
                </button>
            ))}
            <button
                onClick={onCreateNew}
                className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-medium hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
                <Home size={18} />
                Create New Property
            </button>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const InvitationClaimFlow = ({ token, onComplete, onCancel }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invite, setInvite] = useState(null);
    const [preview, setPreview] = useState(null);
    
    // Auth state
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    
    // Flow state
    const [step, setStep] = useState('preview'); // 'preview' | 'auth' | 'property' | 'importing' | 'success'
    const [selectedPropertyId, setSelectedPropertyId] = useState(null);
    const [importResult, setImportResult] = useState(null);
    
    // Validate the invitation on mount
    useEffect(() => {
        const validate = async () => {
            const result = await validateInvitation(token);
            
            if (!result.valid) {
                setError(result.error);
                setLoading(false);
                return;
            }
            
            setInvite(result.invite);
            setPreview(getInvitationPreview(result.invite));
            setLoading(false);
        };
        
        validate();
    }, [token]);
    
    // Check auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            
            if (firebaseUser) {
                // Load profile
                try {
                    const profileRef = doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'settings', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        setProfile(profileSnap.data());
                        // Auto-select first property if available
                        const props = profileSnap.data().properties || [];
                        if (props.length > 0) {
                            setSelectedPropertyId(props[0].id);
                        }
                    }
                } catch (err) {
                    console.error('Error loading profile:', err);
                }
            }
            
            setCheckingAuth(false);
        });
        
        return () => unsubscribe();
    }, []);
    
    // Handle auth success
    const handleAuthSuccess = async () => {
        // Re-check the user state
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        // Check email lock if applicable
        if (invite?.recipientEmail) {
            const { matches } = checkEmailMatch(invite, currentUser.email);
            if (!matches) {
                setError('email_mismatch');
                return;
            }
        }
        
        // Load profile to check for properties
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                setProfile(profileData);
                
                const props = profileData.properties || [];
                if (props.length > 0) {
                    setSelectedPropertyId(props[0].id);
                    setStep('property');
                } else {
                    // No properties - need to create one
                    setStep('property');
                }
            } else {
                // New user - will need to set up property
                setStep('property');
            }
        } catch (err) {
            console.error('Error loading profile:', err);
            // Still proceed, will create new property
            setStep('property');
        }
    };
    
    // Handle import
    const handleImport = async () => {
        if (!user || !invite) return;
        
        let propertyId = selectedPropertyId;
        
        // If no property selected, create a new one
        if (!propertyId) {
            try {
                const newPropertyId = Date.now().toString();
                const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
                
                const existingProfile = profile || {};
                const existingProperties = existingProfile.properties || [];
                
                const newProperty = {
                    id: newPropertyId,
                    name: 'My Home',
                    address: null,
                    coordinates: null
                };
                
                await setDoc(profileRef, {
                    ...existingProfile,
                    properties: [...existingProperties, newProperty],
                    activePropertyId: newPropertyId,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                
                propertyId = newPropertyId;
            } catch (err) {
                console.error('Error creating property:', err);
                toast.error('Failed to create property');
                return;
            }
        }
        
        setStep('importing');
        
        try {
            const result = await claimInvitation(invite.id, user.uid, propertyId);
            
            if (result.success) {
                setImportResult(result);
                setStep('success');
            } else {
                toast.error(result.error || 'Failed to import records');
                setStep('property');
            }
        } catch (err) {
            console.error('Error claiming invitation:', err);
            toast.error('Failed to import records');
            setStep('property');
        }
    };
    
    // Handle continue after success
    const handleContinue = () => {
        // Clear the URL param and reload to go to main app
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        
        if (onComplete) {
            onComplete();
        } else {
            window.location.reload();
        }
    };
    
    // Handle go home on error
    const handleGoHome = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        
        if (onCancel) {
            onCancel();
        } else {
            window.location.reload();
        }
    };
    
    // Loading state
    if (loading || checkingAuth) {
        return <LoadingState />;
    }
    
    // Error state
    if (error) {
        return <ErrorState error={error} onGoHome={handleGoHome} />;
    }
    
    // Success state
    if (step === 'success' && importResult) {
        return (
            <SuccessState 
                importedCount={importResult.importedCount}
                contractorName={importResult.contractorInfo?.company || importResult.contractorInfo?.name || 'the contractor'}
                onContinue={handleContinue}
            />
        );
    }
    
    // Importing state
    if (step === 'importing') {
        return (
            <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <Loader2 className="animate-spin h-12 w-12 text-emerald-600 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Importing your records...</p>
                </div>
            </div>
        );
    }
    
    // Main flow
    return (
        <div className="min-h-screen bg-emerald-50">
            <Toaster position="top-center" />
            
            {/* Header */}
            <header className="bg-white border-b border-emerald-100 sticky top-0 z-40">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                        <Logo className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="font-bold text-emerald-950">krib</h1>
                        <p className="text-xs text-slate-500">Your home's digital twin</p>
                    </div>
                </div>
            </header>
            
            {/* Main Content */}
            <div className="max-w-lg mx-auto px-4 py-8">
                {/* Preview Card */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-emerald-100 overflow-hidden mb-6">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                                <Gift size={24} />
                            </div>
                            <div>
                                <p className="text-emerald-100 text-sm font-medium">Invitation from</p>
                                <h2 className="text-xl font-bold">{preview?.contractorName}</h2>
                            </div>
                        </div>
                        <p className="text-emerald-100">
                            You've been invited to save your home maintenance records
                        </p>
                    </div>
                    
                    {/* Items Preview */}
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Package size={18} className="text-emerald-600" />
                            <span className="font-bold text-slate-800">
                                {preview?.recordCount} item{preview?.recordCount !== 1 ? 's' : ''} ready to import
                            </span>
                        </div>
                        
                        <div className="space-y-2 mb-6">
                            {preview?.recordPreviews.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <Package size={16} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{item.item}</p>
                                        <p className="text-xs text-slate-500">
                                            {item.category}
                                            {item.brand && ` • ${item.brand}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {preview?.recordCount > 5 && (
                                <p className="text-sm text-slate-500 text-center py-2">
                                    + {preview.recordCount - 5} more item{preview.recordCount - 5 !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                        
                        {/* Benefits */}
                        <div className="bg-emerald-50 rounded-xl p-4 mb-6">
                            <p className="font-medium text-emerald-800 mb-2">
                                By accepting, you'll get:
                            </p>
                            <ul className="space-y-2 text-sm text-emerald-700">
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-emerald-600" />
                                    Permanent record of work performed
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-emerald-600" />
                                    Warranty tracking & reminders
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-emerald-600" />
                                    Maintenance schedule suggestions
                                </li>
                            </ul>
                        </div>
                        
                        {/* Auth or Property Selection */}
                        {step === 'preview' && !user && (
                            <div>
                                <p className="text-center text-slate-600 mb-4">
                                    Create a free account or sign in to save these records
                                </p>
                                <AuthForm 
                                    onSuccess={handleAuthSuccess}
                                    invite={invite}
                                    lockedEmail={invite?.recipientEmail}
                                />
                            </div>
                        )}
                        
                        {step === 'preview' && user && (
                            <button
                                onClick={() => {
                                    if (profile?.properties?.length > 0) {
                                        setStep('property');
                                    } else {
                                        handleImport();
                                    }
                                }}
                                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Sparkles size={18} />
                                Accept & Import Records
                            </button>
                        )}
                        
                        {step === 'property' && (
                            <div>
                                {profile?.properties?.length > 0 ? (
                                    <>
                                        <PropertySelector
                                            properties={profile.properties}
                                            selectedId={selectedPropertyId}
                                            onSelect={setSelectedPropertyId}
                                            onCreateNew={() => setSelectedPropertyId(null)}
                                        />
                                        <button
                                            onClick={handleImport}
                                            disabled={!selectedPropertyId && profile?.properties?.length > 0}
                                            className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Sparkles size={18} />
                                            Import {preview?.recordCount} Item{preview?.recordCount !== 1 ? 's' : ''}
                                        </button>
                                    </>
                                ) : (
                                    <div>
                                        <p className="text-center text-slate-600 mb-4">
                                            We'll create your home profile and add these records
                                        </p>
                                        <button
                                            onClick={handleImport}
                                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Sparkles size={18} />
                                            Create Home & Import Records
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {step === 'auth' && (
                            <AuthForm 
                                onSuccess={handleAuthSuccess}
                                invite={invite}
                                lockedEmail={invite?.recipientEmail}
                            />
                        )}
                    </div>
                </div>
                
                {/* Privacy Note */}
                <p className="text-center text-xs text-slate-500">
                    <Shield size={12} className="inline mr-1" />
                    Your data is private and secure. 
                    <a href="/privacy_policy.html" className="underline ml-1">Privacy Policy</a>
                </p>
            </div>
        </div>
    );
};

export default InvitationClaimFlow;
