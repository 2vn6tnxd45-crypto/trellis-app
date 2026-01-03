// src/features/invitations/InvitationClaimFlow.jsx
// ============================================
// INVITATION CLAIM FLOW
// ============================================
// This component handles the flow when a user clicks on an invitation link.
// It shows a preview of what they'll receive, handles auth, and imports records.
//
// UPDATED: Now detects contractor sessions and prompts sign-out

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // ADDED: For navigation with state
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged,
    signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
    Home, Package, CheckCircle, AlertCircle, Loader2, 
    Mail, Lock, Eye, EyeOff, ArrowRight, User,
    Building2, Shield, Clock, Gift, Sparkles, ChevronDown, MapPin
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { auth, db } from '../../config/firebase';
import { appId, googleMapsApiKey } from '../../config/constants';
import { validateInvitation, checkEmailMatch, claimInvitation, getInvitationPreview } from '../../lib/invitations';
import { Logo } from '../../components/common/Logo';
import { waitForAuthReady, retryWithBackoff } from '../../lib/authHelpers';

// Import contractor profile check
import { getContractorProfile } from '../contractor-pro/lib/contractorService';

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
        'permission_denied': {
            title: 'Access Denied',
            message: 'We could not access this invitation. The link may be invalid or restricted.'
        },
        'timeout': {
            title: 'Connection Timed Out',
            message: 'The server took too long to respond. Please check your connection and try again.'
        },
        'default': {
            title: 'Something Went Wrong',
            message: 'We encountered an error loading this invitation. Please try again.'
        }
    };
    
    // Check if error is an object (from try/catch) or string
    const errorKey = typeof error === 'string' ? error : 'default';
    const { title, message } = errorMessages[errorKey] || errorMessages.default;
    
    // If it's a real error object, log it for debugging
    if (typeof error === 'object') {
        console.error("Invitation Error:", error);
    }
    
    return (
        <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">{title}</h1>
                <p className="text-slate-600 mb-6">{message}</p>
                <button
                    onClick={onGoHome}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                    Go to Home
                </button>
            </div>
        </div>
    );
};

// ============================================
// CONTRACTOR SESSION WARNING (NEW)
// ============================================
const ContractorSessionWarning = ({ contractorProfile, onSignOut, onCancel, isSigningOut }) => (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="bg-amber-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            
            <h1 className="text-xl font-bold text-slate-800 mb-2">
                Contractor Account Detected
            </h1>
            
            <p className="text-slate-600 mb-4">
                You're currently logged in as a contractor
                {contractorProfile?.profile?.companyName && (
                    <span className="font-medium"> ({contractorProfile.profile.companyName})</span>
                )}.
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-amber-800 font-medium">
                    To claim this invitation as a homeowner:
                </p>
                <p className="text-sm text-amber-700 mt-1">
                    Sign out of your contractor account first, then sign in or create a homeowner account.
                </p>
            </div>
            
            <div className="space-y-3">
                <button
                    onClick={onSignOut}
                    disabled={isSigningOut}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSigningOut ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                        <>
                            <ArrowRight size={18} />
                            Sign Out & Continue
                        </>
                    )}
                </button>
                
                <button
                    onClick={onCancel}
                    disabled={isSigningOut}
                    className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                >
                    Cancel
                </button>
            </div>
            
            <p className="text-xs text-slate-400 mt-4">
                You can log back into your contractor account anytime at the Pro dashboard.
            </p>
        </div>
    </div>
);

// ============================================
// SUCCESS STATE
// ============================================
const SuccessState = ({ importedCount, contractorName, onContinue }) => (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="bg-emerald-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
                Records Imported!
            </h1>
            <p className="text-slate-600 mb-6">
                {importedCount} item{importedCount !== 1 ? 's' : ''} from {contractorName} {importedCount !== 1 ? 'have' : 'has'} been added to your home.
            </p>
            <button
                onClick={onContinue}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
                <Sparkles size={18} />
                View My Home
            </button>
        </div>
    </div>
);

// ============================================
// AUTH FORM
// ============================================
const AuthForm = ({ onSuccess, invite, lockedEmail }) => {
    const [isSignUp, setIsSignUp] = useState(true);
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
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            onSuccess();
        } catch (err) {
            console.error('Auth error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Email already exists. Try signing in instead.');
                setIsSignUp(false);
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
            onSuccess();
        } catch (err) {
            console.error('Google sign in error:', err);
            setError('Failed to sign in with Google');
        } finally {
            setLoading(false);
        }
    };
    
    
    return (
        <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-center mb-4">
                {isSignUp ? 'Create your account' : 'Sign in to continue'}
            </h3>
            
            {/* Social Sign In */}
            <div className="space-y-2">
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-3 bg-white border border-slate-200 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                </button>
            </div>
            
            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-400">or</span>
                </div>
            </div>
            
            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        required
                        disabled={!!lockedEmail}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none disabled:opacity-60"
                    />
                </div>
                
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        minLength={6}
                        className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
                
                {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                )}
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                        <>
                            {isSignUp ? 'Create Account' : 'Sign In'}
                            <ArrowRight size={18} />
                        </>
                    )}
                </button>
            </form>
            
            <p className="text-center text-sm text-slate-500">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-emerald-600 font-medium hover:underline"
                >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
            </p>
        </div>
    );
};

// ============================================
// ADDRESS SETUP STEP
// ============================================
const AddressSetupStep = ({ onComplete, isSaving }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '', placeId: '' });
    const [coordinates, setCoordinates] = useState(null);
    const autocompleteRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google?.maps?.places) {
                initAutocomplete();
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = initAutocomplete;
            script.onerror = () => {
                console.error('Failed to load Google Maps');
            };
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!inputRef.current || autocompleteRef.current) return;
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'],
                    componentRestrictions: { country: 'us' },
                });
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (!place.address_components) return;
                    
                    // Capture Coordinates
                    if (place.geometry && place.geometry.location) {
                        setCoordinates({
                            lat: place.geometry.location.lat(),
                            lon: place.geometry.location.lng()
                        });
                    }

                    const get = (type) => place.address_components.find(c => c.types.includes(type))?.short_name || '';
                    setAddress({
                        street: `${get('street_number')} ${get('route')}`.trim(),
                        city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
                        state: get('administrative_area_level_1'),
                        zip: get('postal_code'),
                        placeId: place.place_id || '',
                    });
                });
            } catch (err) {
                console.error('Autocomplete init error:', err);
            }
        };
        loadGoogleMaps();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!address.street) { 
            toast.error("Please select an address from the dropdown suggestions."); 
            return; 
        }
        
        onComplete({ 
            name: name || address.street, 
            address, 
            coordinates 
        });
    };

    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <div className="bg-emerald-100 p-3 rounded-full w-14 h-14 mx-auto mb-3 flex items-center justify-center">
                    <Home className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Set up your home</h3>
                <p className="text-slate-500 text-sm">Add your address to unlock local insights and features</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Property Nickname</label>
                    <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Our First Home, Beach House"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Property Address *</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Start typing your address..."
                            required
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                    </div>
                    {address.street && (
                        <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm">
                            <p className="font-semibold text-emerald-900">{address.street}</p>
                            <p className="text-emerald-700">{address.city}, {address.state} {address.zip}</p>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="animate-spin h-5 w-5" /> 
                            Creating...
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} />
                            Create Home & Import Records
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

// ============================================
// PROPERTY SELECTOR
// ============================================
const PropertySelector = ({ properties, selectedId, onSelect, onCreateNew }) => (
    <div className="space-y-3">
        <p className="text-sm text-slate-600 mb-3">
            Choose which property to add these records to:
        </p>
        
        {properties.map(prop => (
            <button
                key={prop.id}
                onClick={() => onSelect(prop.id)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                    selectedId === prop.id 
                        ? 'border-emerald-500 bg-emerald-50' 
                        : 'border-slate-200 hover:border-emerald-200'
                }`}
            >
                <Home className={`h-5 w-5 ${selectedId === prop.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className="flex-1">
                    <p className="font-bold text-slate-800">{prop.name}</p>
                    {prop.address && (
                        <p className="text-sm text-slate-500">
                            {typeof prop.address === 'string' 
                                ? prop.address 
                                : `${prop.address.city}, ${prop.address.state}`}
                        </p>
                    )}
                </div>
                {selectedId === prop.id && (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                )}
            </button>
        ))}
        
        <button
            onClick={onCreateNew}
            className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
        >
            <Building2 size={18} />
            Add New Property
        </button>
    </div>
);

// ============================================
// SAFE PROFILE LOADER
// ============================================
const loadProfileSafely = async (userId) => {
    if (!userId || !appId) return null;
    
    try {
        const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            return profileSnap.data();
        }
        return null;
    } catch (err) {
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
    const navigate = useNavigate(); // ADDED: Hook for navigation
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invite, setInvite] = useState(null);
    const [preview, setPreview] = useState(null);
    
    // Auth state
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    
    // Contractor detection state
    const [isContractor, setIsContractor] = useState(false);
    const [contractorProfile, setContractorProfile] = useState(null);
    const [isSigningOut, setIsSigningOut] = useState(false);
    
    // Flow state
    const [step, setStep] = useState('preview');
    const [selectedPropertyId, setSelectedPropertyId] = useState(null);
    const [importResult, setImportResult] = useState(null);
    
    // Address setup state
    const [newPropertyData, setNewPropertyData] = useState(null);
    const [isSavingProperty, setIsSavingProperty] = useState(false);
    
    // Validate the invitation on mount - FIXED WITH TIMEOUT AND TRY/CATCH
    useEffect(() => {
        let isMounted = true;
        const validate = async () => {
            console.log('[ClaimFlow] Starting validation for token:', token);
            try {
                // FORCE TIMEOUT: If validation takes > 5s, throw error
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Validation timed out')), 5000)
                );
                
                const result = await Promise.race([
                    validateInvitation(token),
                    timeoutPromise
                ]);

                if (!isMounted) return;

                if (!result.valid) {
                    console.error('[ClaimFlow] Validation invalid:', result.error);
                    setError(result.error);
                } else {
                    console.log('[ClaimFlow] Validation success');
                    setInvite(result.invite);
                    setPreview(getInvitationPreview(result.invite));
                }
            } catch (err) {
                console.error('[ClaimFlow] Validation failed:', err);
                if (isMounted) {
                    // Check specifically for permission issues or timeouts
                    if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                        setError('permission_denied');
                    } else if (err.message?.includes('time')) {
                        setError('timeout');
                    } else {
                        setError('default');
                    }
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        
        validate();
        return () => { isMounted = false; };
    }, [token]);
    
    // Check auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            
            if (firebaseUser) {
                try {
                    const contractorData = await getContractorProfile(firebaseUser.uid);
                    
                    if (contractorData) {
                        console.log('[InvitationClaimFlow] Contractor session detected');
                        setIsContractor(true);
                        setContractorProfile(contractorData);
                        setCheckingAuth(false);
                        return; // Don't load homeowner profile
                    }
                } catch (err) {
                    // Not a contractor, continue normally
                    console.log('[InvitationClaimFlow] Not a contractor account');
                }
                
                // Reset contractor state
                setIsContractor(false);
                setContractorProfile(null);
                
                // Load homeowner profile safely
                const profileData = await loadProfileSafely(firebaseUser.uid);
                
                if (profileData) {
                    setProfile(profileData);
                    const props = profileData.properties || [];
                    if (props.length > 0) {
                        setSelectedPropertyId(props[0].id);
                    }
                }
            } else {
                // No user - reset all state
                setIsContractor(false);
                setContractorProfile(null);
                setProfile(null);
            }
            
            setCheckingAuth(false);
        });
        
        return () => unsubscribe();
    }, []);
    
    // Handle auth success
    const handleAuthSuccess = async () => {
        try {
            const currentUser = await waitForAuthReady();
            
            if (!currentUser) {
                toast.error('Authentication failed. Please try again.');
                return;
            }
            
            if (invite?.recipientEmail) {
                const matches = checkEmailMatch(invite, currentUser.email);
                if (!matches) {
                    setError('email_mismatch');
                    return;
                }
            }
            
            const profileData = await loadProfileSafely(currentUser.uid);
            
            if (profileData) {
                setProfile(profileData);
                const props = profileData.properties || [];
                if (props.length > 0) {
                    setSelectedPropertyId(props[0].id);
                    setStep('property');
                } else {
                    setStep('setup');
                }
            } else {
                setStep('setup');
            }
        } catch (err) {
            console.error('Auth verification error:', err);
            toast.error('Please try signing in again.');
        }
    };
    
    // Handle address setup completion
    const handleAddressSetupComplete = (propertyData) => {
        setNewPropertyData(propertyData);
        handleImportWithNewProperty(propertyData);
    };
    
    // Handle import with new property
    const handleImportWithNewProperty = async (propertyData) => {
        if (!invite) return;
        
        setIsSavingProperty(true);
        setStep('importing');
        
        let currentUser;
        try {
            currentUser = await waitForAuthReady();
        } catch (err) {
            console.error('Auth not ready:', err);
            toast.error('Authentication error. Please try again.');
            setStep('setup');
            setIsSavingProperty(false);
            return;
        }
        
        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const newPropertyId = Date.now().toString();
                const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                
                const existingProfile = profile || {};
                const existingProperties = existingProfile.properties || [];
                
                const newProperty = {
                    id: newPropertyId,
                    name: propertyData.name || 'My Home',
                    address: propertyData.address,
                    coordinates: propertyData.coordinates || null
                };
                
                await setDoc(profileRef, {
                    ...existingProfile,
                    properties: [...existingProperties, newProperty],
                    activePropertyId: newPropertyId,
                    updatedAt: serverTimestamp()
                }, { merge: true });
                
                const result = await claimInvitation(invite.id, currentUser.uid, newPropertyId);
                
                if (result.success) {
                    setImportResult(result);
                    setStep('success');
                    return;
                } else {
                    throw new Error(result.error || 'Failed to import records');
                }
                
            } catch (err) {
                lastError = err;
                console.error(`Attempt ${attempt} failed:`, err);
                
                if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 1000 * attempt));
                        try {
                            await currentUser.getIdToken(true);
                        } catch (tokenErr) {
                            console.error('Token refresh failed:', tokenErr);
                        }
                        continue;
                    }
                }
                break;
            }
        }
        
        console.error('All import attempts failed:', lastError);
        toast.error('Failed to create home. Please try again.');
        setStep('setup');
        setIsSavingProperty(false);
    };
    
    // Handle import (for existing properties)
    const handleImport = async () => {
        if (!user || !invite) return;
        
        let propertyId = selectedPropertyId;
        
        if (!propertyId) {
            setStep('setup');
            return;
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
    
    const handleContinue = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        
        if (onComplete) {
            onComplete();
        } else {
            // UPDATED: Navigate to onboarding with skip flag
            navigate('/onboarding', { state: { skipWelcome: true } });
        }
    };
    
    const handleGoHome = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
        
        if (onCancel) {
            onCancel();
        } else {
            // UPDATED: Navigate to home/dashboard
            navigate('/');
        }
    };
    
    const handleContractorSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut(auth);
            toast.success('Signed out. You can now claim the invitation.');
        } catch (err) {
            console.error('Sign out error:', err);
            toast.error('Failed to sign out');
        } finally {
            setIsSigningOut(false);
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
    
    // Contractor session detected
    if (isContractor && contractorProfile) {
        return (
            <ContractorSessionWarning
                contractorProfile={contractorProfile}
                onSignOut={handleContractorSignOut}
                onCancel={handleGoHome}
                isSigningOut={isSigningOut}
            />
        );
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
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
                    <div className="text-center">
                        <div className="relative mx-auto w-16 h-16 mb-6">
                            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25" />
                            <div className="relative bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center">
                                <Home className="h-8 w-8 text-emerald-600" />
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-slate-800 mb-2">
                            Setting up your home...
                        </h3>
                        <p className="text-slate-500 text-sm mb-6">
                            This may take a moment
                        </p>
                        
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full animate-pulse"
                                style={{ width: '70%' }}
                            />
                        </div>
                        
                        <div className="space-y-2 text-left">
                            <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <CheckCircle size={16} />
                                <span>Account verified</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Importing {preview?.recordCount || ''} records...</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                                <span>Finalizing</span>
                            </div>
                        </div>
                    </div>
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
                    {(step === 'preview' || step === 'auth') && (
                        <div className="mb-6">
                            <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Package size={18} className="text-emerald-600" />
                                {preview?.recordCount} Item{preview?.recordCount !== 1 ? 's' : ''} Included
                            </h2>
                            
                            <div className="space-y-2">
                                {preview?.recordPreviews?.map((record, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                        <div className="bg-emerald-100 p-2 rounded-lg">
                                            <Package size={16} className="text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 truncate">{record.item}</p>
                                            <p className="text-sm text-slate-500">{record.brand} • {record.category}</p>
                                        </div>
                                    </div>
                                ))}
                                {preview?.recordCount > 5 && (
                                    <p className="text-sm text-slate-400 text-center py-2">
                                        + {preview.recordCount - 5} more item{preview.recordCount - 5 !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {step === 'preview' && !user && (
                        <button
                            onClick={() => setStep('auth')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Sparkles size={18} />
                            Claim These Records
                        </button>
                    )}
                    
                    {step === 'preview' && user && (
                        <button
                            onClick={() => {
                                if (profile?.properties?.length > 0) {
                                    setStep('property');
                                } else {
                                    setStep('setup');
                                }
                            }}
                            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Sparkles size={18} />
                            Accept & Import Records
                        </button>
                    )}
                    
                    {step === 'auth' && (
                        <AuthForm 
                            onSuccess={handleAuthSuccess}
                            invite={invite}
                            lockedEmail={invite?.recipientEmail}
                        />
                    )}
                    
                    {step === 'setup' && (
                        <AddressSetupStep 
                            onComplete={handleAddressSetupComplete}
                            isSaving={isSavingProperty}
                        />
                    )}
                    
                    {step === 'property' && (
                        <div>
                            {profile?.properties?.length > 0 ? (
                                <>
                                    <PropertySelector
                                        properties={profile.properties}
                                        selectedId={selectedPropertyId}
                                        onSelect={setSelectedPropertyId}
                                        onCreateNew={() => setStep('setup')}
                                    />
                                    <button
                                        onClick={handleImport}
                                        disabled={!selectedPropertyId}
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
                                        onClick={() => setStep('setup')}
                                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Sparkles size={18} />
                                        Set Up Home & Import Records
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <p className="text-center text-xs text-slate-500 mt-6 px-4">
                <Shield size={12} className="inline mr-1" />
                Your data is private and secure. Only you can access your records.
            </p>
        </div>
    );
};

export default InvitationClaimFlow;
