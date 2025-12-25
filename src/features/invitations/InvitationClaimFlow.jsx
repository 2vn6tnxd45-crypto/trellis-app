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
    
    const { title, message } = errorMessages[error] || errorMessages['default'];
    
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
                <p className="text-slate-600 mb-6">{message}</p>
                <button
                    onClick={onGoHome}
                    className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors"
                >
                    Go to Home
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
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="bg-emerald-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Records Imported!</h2>
            <p className="text-slate-600 mb-2">
                {importedCount} record{importedCount !== 1 ? 's' : ''} from <span className="font-medium text-slate-700">{contractorName}</span> {importedCount !== 1 ? 'have' : 'has'} been added to your home.
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
            {/* Social Login Buttons */}
            <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
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
                type="button"
                onClick={handleAppleLogin}
                disabled={loading}
                className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Continue with Apple
            </button>
            
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">or</span>
                </div>
            </div>
            
            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            required
                            disabled={!!lockedEmail}
                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-50"
                        />
                    </div>
                    {lockedEmail && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <Lock size={12} />
                            This invitation is locked to this email
                        </p>
                    )}
                </div>
                
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                
                {error && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
                )}
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
            
            <p className="text-center text-sm text-slate-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-emerald-600 font-medium hover:underline"
                >
                    {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
            </p>
        </div>
    );
};

// ============================================
// PROPERTY SELECTOR COMPONENT
// ============================================
const PropertySelector = ({ properties, selectedId, onSelect, onCreateNew }) => {
    return (
        <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 mb-2">
                Choose which property to add these records to:
            </p>
            {properties.map((prop) => (
                <button
                    key={prop.id}
                    onClick={() => onSelect(prop.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        selectedId === prop.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
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
// HELPER: Safe profile loader
// ============================================
// This helper loads a user's profile silently, returning null if not found
// instead of throwing errors. This handles new users gracefully.
const loadProfileSafely = async (userId) => {
    if (!userId || !appId) return null;
    
    try {
        const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            return profileSnap.data();
        }
        // Profile doesn't exist yet - this is normal for new users
        return null;
    } catch (err) {
        // Only log if it's NOT a permission error (which is expected for some cases)
        // Permission errors during claim flow are expected and handled by proceeding without profile
        if (!err.message?.includes('permission') && !err.code?.includes('permission')) {
            console.error('Error loading profile:', err);
        }
        return null;
    }
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
                // Load profile safely - won't throw or show errors for missing profiles
                const profileData = await loadProfileSafely(firebaseUser.uid);
                
                if (profileData) {
                    setProfile(profileData);
                    // Auto-select first property if available
                    const props = profileData.properties || [];
                    if (props.length > 0) {
                        setSelectedPropertyId(props[0].id);
                    }
                }
                // If no profile, that's fine - user will create one during import
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
        
        // Load profile safely to check for properties
        const profileData = await loadProfileSafely(currentUser.uid);
        
        if (profileData) {
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
            <div className="bg-emerald-600 text-white p-6 pb-16">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Gift size={24} />
                        </div>
                        <div>
                            <p className="text-emerald-100 text-sm">Invitation from</p>
                            <h1 className="text-xl font-bold">{preview?.contractorName}</h1>
                        </div>
                    </div>
                    <p className="text-emerald-100">
                        You've been invited to save your home maintenance records
                    </p>
                </div>
            </div>
            
            {/* Content Card */}
            <div className="max-w-md mx-auto px-4 -mt-10">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    {/* Preview Items */}
                    <div className="mb-6">
                        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Package size={18} className="text-emerald-600" />
                            {preview?.recordCount} Item{preview?.recordCount !== 1 ? 's' : ''} Included
                        </h2>
                        <div className="space-y-2">
                            {preview?.recordPreviews?.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                    <div className="bg-emerald-100 p-2 rounded-lg">
                                        <Package size={16} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{item.item}</p>
                                        <p className="text-xs text-slate-500">
                                            {item.brand && `${item.brand} • `}{item.category}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Benefits */}
                    <div className="bg-emerald-50 rounded-xl p-4 mb-6">
                        <p className="text-sm font-medium text-emerald-800 mb-2">What you'll get:</p>
                        <ul className="space-y-2 text-sm text-emerald-700">
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-emerald-600" />
                                Complete warranty & install info
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-emerald-600" />
                                Contractor contact details saved
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
            <p className="text-center text-xs text-slate-500 mt-6 px-4">
                <Shield size={12} className="inline mr-1" />
                Your data is private and secure. Only you can access your records.
            </p>
        </div>
    );
};

export default InvitationClaimFlow;
