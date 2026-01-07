// src/features/evaluations/components/EvaluationSubmission.jsx
// ============================================
// EVALUATION SUBMISSION (HOMEOWNER VIEW)
// ============================================
// Public page where homeowners submit photos/info
// in response to a contractor's evaluation request.
// Now includes full account creation + property setup flow.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Camera, Video, FileText, Upload, X, Check, Clock, AlertCircle,
    ChevronRight, Loader2, CheckCircle, Home, User, Phone, Mail,
    MessageSquare, Send, Image, Play, Trash2, AlertTriangle,
    Lock, Eye, EyeOff, MapPin, Sparkles
} from 'lucide-react';
import { useSingleEvaluation, useEvaluationCountdown } from '../hooks/useEvaluations';
import { PROMPT_TYPES } from '../lib/evaluationTemplates';
import { EVALUATION_STATUS, uploadEvaluationFile } from '../lib/evaluationService';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    updateProfile,
    onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, waitForPendingWrites } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { appId, googleMapsApiKey } from '../../../config/constants';
import { addContractorToProsList } from '../../quotes/lib/quoteService';
import toast from 'react-hot-toast';

// ============================================
// MAIN COMPONENT
// ============================================

export const EvaluationSubmission = ({ 
    contractorId, 
    evaluationId,
    contractor = null  // Contractor info for display
}) => {
    const {
        evaluation,
        loading,
        error,
        isExpired,
        canSubmit,
        hasSubmissions,
        submitMedia,
        markComplete
    } = useSingleEvaluation(contractorId, evaluationId);

    const [submissions, setSubmissions] = useState({
        photos: [],
        videos: [],
        answers: {}
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    
    // Flow step: 'form' | 'account' | 'property' | 'complete'
    const [flowStep, setFlowStep] = useState('form');
    
    // Account creation state
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [accountName, setAccountName] = useState('');
    const [authError, setAuthError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    
    // Property setup state
    const [isSavingProperty, setIsSavingProperty] = useState(false);
    
    // Check if user is already logged in
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);
    
    // Pre-fill email from evaluation
    useEffect(() => {
        if (evaluation?.customerEmail && !accountEmail) {
            setAccountEmail(evaluation.customerEmail);
        }
        if (evaluation?.customerName && !accountName) {
            setAccountName(evaluation.customerName);
        }
    }, [evaluation]);

    // Initialize from existing submissions
    useEffect(() => {
        if (evaluation?.submissions) {
            setSubmissions({
                photos: evaluation.submissions.photos || [],
                videos: evaluation.submissions.videos || [],
                answers: evaluation.submissions.answers || {}
            });
        }
    }, [evaluation]);

    // ----------------------------------------
    // Handlers
    // ----------------------------------------

    const handlePhotoAdd = useCallback((promptId, photoData) => {
        setSubmissions(prev => ({
            ...prev,
            photos: [...prev.photos, { promptId, ...photoData, addedAt: new Date().toISOString() }]
        }));
    }, []);

    const handlePhotoRemove = useCallback((index) => {
        setSubmissions(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    }, []);

    const handleVideoAdd = useCallback((promptId, videoData) => {
        setSubmissions(prev => ({
            ...prev,
            videos: [...prev.videos, { promptId, ...videoData, addedAt: new Date().toISOString() }]
        }));
    }, []);

    const handleVideoRemove = useCallback((index) => {
        setSubmissions(prev => ({
            ...prev,
            videos: prev.videos.filter((_, i) => i !== index)
        }));
    }, []);

    const handleAnswerChange = useCallback((promptId, value) => {
        setSubmissions(prev => ({
            ...prev,
            answers: { ...prev.answers, [promptId]: value }
        }));
    }, []);

    // ----------------------------------------
    // Save Evaluation to Profile Helper
    // ----------------------------------------
    const saveEvaluationToProfile = async (userId, propertyId) => {
        const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
        
        await setDoc(profileRef, {
            updatedAt: serverTimestamp(),
            pendingEvaluations: [{
                evaluationId,
                contractorId,
                contractorName: contractor?.profile?.companyName || contractor?.companyName || 'Contractor',
                propertyAddress: evaluation?.propertyAddress || '',
                jobDescription: evaluation?.jobDescription || '',
                submittedAt: new Date().toISOString(),
                status: 'awaiting_quote'
            }]
        }, { merge: true });
        
        // Add contractor to homeowner's Pros list
        try {
            await addContractorToProsList(userId, {
                contractorId,
                companyName: contractor?.profile?.companyName || contractor?.companyName,
                email: contractor?.profile?.email || contractor?.email,
                phone: contractor?.profile?.phone || contractor?.phone,
                logoUrl: contractor?.profile?.logoUrl || contractor?.logoUrl
            }, evaluation?.jobDescription || 'Evaluation Request');
        } catch (err) {
            console.warn('Could not add contractor to pros list:', err);
        }
    };

    // ----------------------------------------
    // Account Creation
    // ----------------------------------------
    const handleCreateAccount = async (e) => {
        e.preventDefault();
        setAuthError('');
        setIsCreatingAccount(true);
        
        try {
            const credential = await createUserWithEmailAndPassword(auth, accountEmail, accountPassword);
            
            if (accountName.trim()) {
                await updateProfile(credential.user, { displayName: accountName.trim() });
            }
            
            await new Promise(r => setTimeout(r, 500));
            setCurrentUser(credential.user);
            setFlowStep('property');
            
        } catch (err) {
            console.error('Account creation error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setAuthError('This email already has an account. Try signing in instead.');
            } else if (err.code === 'auth/weak-password') {
                setAuthError('Password should be at least 6 characters.');
            } else {
                setAuthError(err.message.replace('Firebase: ', ''));
            }
        } finally {
            setIsCreatingAccount(false);
        }
    };
    
    const handleSignIn = async (e) => {
        e.preventDefault();
        setAuthError('');
        setIsCreatingAccount(true);
        
        try {
            const credential = await signInWithEmailAndPassword(auth, accountEmail, accountPassword);
            await new Promise(r => setTimeout(r, 500));
            setCurrentUser(credential.user);
            
            const profileRef = doc(db, 'artifacts', appId, 'users', credential.user.uid, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists() && profileSnap.data().properties?.length > 0) {
                await saveEvaluationToProfile(credential.user.uid, profileSnap.data().activePropertyId);
                setFlowStep('complete');
            } else {
                setFlowStep('property');
            }
            
        } catch (err) {
            console.error('Sign in error:', err);
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setAuthError('Invalid email or password.');
            } else if (err.code === 'auth/user-not-found') {
                setAuthError('No account found with this email.');
            } else {
                setAuthError(err.message.replace('Firebase: ', ''));
            }
        } finally {
            setIsCreatingAccount(false);
        }
    };
    
    const handleGoogleSignIn = async () => {
        setAuthError('');
        setIsCreatingAccount(true);
        
        try {
            const credential = await signInWithPopup(auth, new GoogleAuthProvider());
            await new Promise(r => setTimeout(r, 500));
            setCurrentUser(credential.user);
            
            const profileRef = doc(db, 'artifacts', appId, 'users', credential.user.uid, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists() && profileSnap.data().properties?.length > 0) {
                await saveEvaluationToProfile(credential.user.uid, profileSnap.data().activePropertyId);
                setFlowStep('complete');
            } else {
                setFlowStep('property');
            }
            
        } catch (err) {
            console.error('Google sign in error:', err);
            if (err.code !== 'auth/popup-closed-by-user') {
                setAuthError('Failed to sign in with Google. Please try again.');
            }
        } finally {
            setIsCreatingAccount(false);
        }
    };
    
    // ----------------------------------------
    // Property Setup
    // ----------------------------------------
    const handlePropertySetup = async (propertyData) => {
        if (!currentUser) return;
        
        setIsSavingProperty(true);
        
        try {
            await currentUser.getIdToken(true);
            await new Promise(r => setTimeout(r, 500));
            
            const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
            const profileSnap = await getDoc(profileRef);
            const existingProfile = profileSnap.exists() ? profileSnap.data() : {};
            
            const newPropertyId = Date.now().toString();
            const newProperty = {
                id: newPropertyId,
                name: propertyData.name || 'My Home',
                address: propertyData.address,
                coordinates: propertyData.coordinates || null
            };
            
            const existingProperties = existingProfile.properties || [];
            const updatedProperties = [...existingProperties, newProperty];
            
            await setDoc(profileRef, {
                ...existingProfile,
                name: accountName || existingProfile.name || '',
                email: accountEmail || currentUser.email || existingProfile.email || '',
                properties: updatedProperties,
                activePropertyId: newPropertyId,
                hasSeenWelcome: true,
                pendingEvaluations: [{
                    evaluationId,
                    contractorId,
                    contractorName: contractor?.profile?.companyName || contractor?.companyName || 'Contractor',
                    propertyAddress: evaluation?.propertyAddress || '',
                    jobDescription: evaluation?.jobDescription || '',
                    submittedAt: new Date().toISOString(),
                    status: 'awaiting_quote'
                }],
                createdAt: existingProfile.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            try {
                await addContractorToProsList(currentUser.uid, {
                    contractorId,
                    companyName: contractor?.profile?.companyName || contractor?.companyName,
                    email: contractor?.profile?.email || contractor?.email,
                    phone: contractor?.profile?.phone || contractor?.phone,
                    logoUrl: contractor?.profile?.logoUrl || contractor?.logoUrl
                }, evaluation?.jobDescription || 'Evaluation Request');
            } catch (err) {
                console.warn('Could not add contractor to pros list:', err);
            }
            
            await waitForPendingWrites(db).catch(() => {});
            toast.success('Home created successfully!');
            setFlowStep('complete');
            
        } catch (err) {
            console.error('Error creating property:', err);
            toast.error('Failed to create home. Please try again.');
        } finally {
            setIsSavingProperty(false);
        }
    };
    
    const handleSkipAccount = () => {
        setFlowStep('complete');
    };
    
    const handleGoToDashboard = () => {
        waitForPendingWrites(db).catch(() => {});
        setTimeout(() => {
            window.location.href = '/app?from=evaluation';
        }, 300);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            await submitMedia(submissions);
            await markComplete();
            setSubmitted(true);
            
            if (currentUser) {
                const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);
                
                if (profileSnap.exists() && profileSnap.data().properties?.length > 0) {
                    await saveEvaluationToProfile(currentUser.uid, profileSnap.data().activePropertyId);
                    setFlowStep('complete');
                } else {
                    setFlowStep('property');
                }
            } else {
                setFlowStep('account');
            }
        } catch (err) {
            console.error('Submission error:', err);
            setSubmitError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ----------------------------------------
    // Loading State
    // ----------------------------------------
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-500">Loading evaluation request...</p>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Not Found
    // ----------------------------------------
    if (!evaluation) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Request Not Found</h2>
                    <p className="text-slate-500">This evaluation request doesn't exist or has been removed.</p>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Expired State
    // ----------------------------------------
    if (isExpired) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Request Expired</h2>
                    <p className="text-slate-500 mb-6">This evaluation request has expired. Please contact the contractor for a new request.</p>
                    {contractor?.phone && (
                        <a href={`tel:${contractor.phone}`} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                            <Phone className="w-5 h-5" />
                            Call {contractor.companyName || 'Contractor'}
                        </a>
                    )}
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Already Completed (before submission in this session)
    // ----------------------------------------
    if (!submitted && (evaluation.status === EVALUATION_STATUS.COMPLETED || evaluation.status === EVALUATION_STATUS.QUOTED)) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Already Submitted</h2>
                    <p className="text-slate-500 mb-6">
                        This evaluation has already been submitted. {contractor?.profile?.companyName || contractor?.companyName || 'The contractor'} is working on your quote.
                    </p>
                    <a href="/app" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">
                        <Home className="w-5 h-5" />
                        Go to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Flow Step: Account Creation
    // ----------------------------------------
    if (flowStep === 'account') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Submission Received!</h2>
                        <p className="text-slate-500">
                            {contractor?.profile?.companyName || contractor?.companyName || 'The contractor'} will review your information and follow up with a quote.
                        </p>
                    </div>
                    
                    <div className="border-t border-slate-200 pt-6">
                        <div className="bg-indigo-50 rounded-xl p-4 mb-4">
                            <h3 className="font-bold text-indigo-900 mb-1">Track Your Quote</h3>
                            <p className="text-sm text-indigo-700">
                                Create a free account to get notified when your quote is ready and track all your home service requests.
                            </p>
                        </div>
                        
                        <AccountCreationForm 
                            email={accountEmail}
                            setEmail={setAccountEmail}
                            password={accountPassword}
                            setPassword={setAccountPassword}
                            name={accountName}
                            setName={setAccountName}
                            error={authError}
                            isLoading={isCreatingAccount}
                            onSubmit={handleCreateAccount}
                            onSignIn={handleSignIn}
                            onGoogleSignIn={handleGoogleSignIn}
                        />
                        
                        <button onClick={handleSkipAccount} className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700">
                            Maybe later
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Flow Step: Property Setup
    // ----------------------------------------
    if (flowStep === 'property') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Home className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Set Up Your Property</h2>
                        <p className="text-slate-500">Tell us about your home to track this quote and all future services.</p>
                    </div>
                    
                    <PropertySetupForm
                        defaultAddress={evaluation?.propertyAddress || ''}
                        onComplete={handlePropertySetup}
                        isSaving={isSavingProperty}
                    />
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Flow Step: Complete
    // ----------------------------------------
    if (flowStep === 'complete') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">You're All Set!</h2>
                    <p className="text-slate-500 mb-6">
                        We'll notify you when {contractor?.profile?.companyName || contractor?.companyName || 'the contractor'} sends your quote.
                    </p>
                    
                    <button onClick={handleGoToDashboard} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                        <Home className="w-5 h-5" />
                        Go to Dashboard
                    </button>
                    
                    <p className="text-xs text-slate-400 mt-6">
                        Powered by <a href="/" className="text-emerald-600 hover:underline">Krib</a>
                    </p>
                </div>
            </div>
        );
    }

    // ----------------------------------------
    // Main Submission Form
    // ----------------------------------------
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-bold text-slate-800">{contractor?.companyName || 'Contractor'} needs info</h1>
                            <p className="text-sm text-slate-500">{evaluation.jobCategory?.replace('_', ' ')} evaluation</p>
                        </div>
                        <CountdownBadge expiresAt={evaluation.expiresAt} />
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-800">{evaluation.propertyAddress}</p>
                            <p className="text-sm text-slate-500 mt-1">{evaluation.jobDescription}</p>
                        </div>
                    </div>
                </div>

                {evaluation.messages?.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Messages from Contractor
                        </h3>
                        <div className="space-y-3">
                            {evaluation.messages.map((msg) => (
                                <div key={msg.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-sm text-amber-800">{msg.message}</p>
                                    <p className="text-xs text-amber-600 mt-2">{new Date(msg.createdAt).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Please Provide</h3>
                    {evaluation.prompts?.map((prompt, index) => (
                        <PromptInput
                            key={prompt.id}
                            prompt={prompt}
                            index={index}
                            submissions={submissions}
                            onPhotoAdd={handlePhotoAdd}
                            onPhotoRemove={handlePhotoRemove}
                            onVideoAdd={handleVideoAdd}
                            onVideoRemove={handleVideoRemove}
                            onAnswerChange={handleAnswerChange}
                            contractorId={contractorId}
                            evaluationId={evaluationId}
                        />
                    ))}
                </div>

                {submitError && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{submitError}</p>
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
                <div className="max-w-2xl mx-auto">
                    <SubmissionProgress prompts={evaluation.prompts || []} submissions={submissions} />
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                        ) : (
                            <><Send className="w-5 h-5" />Submit to Contractor</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// PROPERTY SETUP FORM (mirrors quote flow)
// ============================================

const PropertySetupForm = ({ defaultAddress, onComplete, isSaving }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '', placeId: '' });
    const [coordinates, setCoordinates] = useState(null);
    const [useDefaultAddress, setUseDefaultAddress] = useState(true);
    const autocompleteRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (defaultAddress && useDefaultAddress) {
            setAddress({ street: defaultAddress, city: '', state: '', zip: '', placeId: '' });
        }
    }, [defaultAddress, useDefaultAddress]);

    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google?.maps?.places) { initAutocomplete(); return; }
            if (!googleMapsApiKey) return;
            
            const existingScript = document.getElementById('googleMapsScript');
            if (existingScript) { existingScript.addEventListener('load', initAutocomplete); return; }
            
            const script = document.createElement('script');
            script.id = 'googleMapsScript';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = initAutocomplete;
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!inputRef.current || autocompleteRef.current) return;
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'],
                    componentRestrictions: { country: 'us' }
                });
                
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (!place.address_components) return;
                    
                    const get = (type) => place.address_components.find(c => c.types.includes(type))?.long_name || '';
                    
                    setUseDefaultAddress(false);
                    setAddress({
                        street: `${get('street_number')} ${get('route')}`.trim(),
                        city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
                        state: get('administrative_area_level_1'),
                        zip: get('postal_code'),
                        placeId: place.place_id || '',
                    });
                    
                    if (place.geometry?.location) {
                        setCoordinates({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
                    }
                });
            } catch (err) {
                console.error('Autocomplete init error:', err);
            }
        };
        
        loadGoogleMaps();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!address.street && !defaultAddress) { toast.error('Please enter an address'); return; }
        onComplete({
            name: name || 'My Home',
            address: address.street ? address : { street: defaultAddress, city: '', state: '', zip: '' },
            coordinates
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Property Name</label>
                <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My Home, Beach House, etc."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Property Address *</label>
                
                {defaultAddress && useDefaultAddress && (
                    <div className="mb-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-medium text-emerald-800">{defaultAddress}</span>
                            </div>
                            <button type="button" onClick={() => setUseDefaultAddress(false)} className="text-xs text-emerald-600 hover:underline">
                                Change
                            </button>
                        </div>
                    </div>
                )}
                
                {(!defaultAddress || !useDefaultAddress) && (
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            defaultValue={useDefaultAddress ? '' : (address.street || '')}
                            onChange={(e) => { setUseDefaultAddress(false); setAddress(prev => ({ ...prev, street: e.target.value })); }}
                            placeholder="Start typing your address..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        />
                    </div>
                )}
                
                {!useDefaultAddress && address.street && address.city && (
                    <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm">
                        <p className="font-medium text-emerald-900">{address.street}</p>
                        <p className="text-emerald-700">{address.city}, {address.state} {address.zip}</p>
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isSaving ? (<><Loader2 className="h-5 w-5 animate-spin" />Creating...</>) : (<><Sparkles size={18} />Create My Home</>)}
            </button>
        </form>
    );
};

// ============================================
// COUNTDOWN BADGE
// ============================================

const CountdownBadge = ({ expiresAt }) => {
    const timeRemaining = useEvaluationCountdown(expiresAt);
    if (!timeRemaining) return null;

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            timeRemaining.urgent ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
        }`}>
            <Clock className="w-4 h-4" />
            {timeRemaining.display}
        </div>
    );
};

// ============================================
// SUBMISSION PROGRESS
// ============================================

const SubmissionProgress = ({ prompts, submissions }) => {
    const requiredPrompts = prompts.filter(p => p.required);
    const completedRequired = requiredPrompts.filter(p => {
        if (p.type === PROMPT_TYPES.PHOTO) return submissions.photos.some(photo => photo.promptId === p.id);
        if (p.type === PROMPT_TYPES.VIDEO) return submissions.videos.some(video => video.promptId === p.id);
        return submissions.answers[p.id] !== undefined && submissions.answers[p.id] !== '';
    });

    const progress = requiredPrompts.length > 0 ? Math.round((completedRequired.length / requiredPrompts.length) * 100) : 100;

    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-600">{completedRequired.length} of {requiredPrompts.length} required items</span>
                <span className={`font-medium ${progress === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
};

// ============================================
// PROMPT INPUT COMPONENT
// ============================================

const PromptInput = ({ prompt, index, submissions, onPhotoAdd, onPhotoRemove, onVideoAdd, onVideoRemove, onAnswerChange, contractorId, evaluationId }) => {
    switch (prompt.type) {
        case PROMPT_TYPES.PHOTO:
            return <PhotoPrompt prompt={prompt} index={index} photos={submissions.photos.filter(p => p.promptId === prompt.id)} onAdd={(data) => onPhotoAdd(prompt.id, data)} onRemove={onPhotoRemove} allPhotos={submissions.photos} contractorId={contractorId} evaluationId={evaluationId} />;
        case PROMPT_TYPES.VIDEO:
            return <VideoPrompt prompt={prompt} index={index} videos={submissions.videos.filter(v => v.promptId === prompt.id)} onAdd={(data) => onVideoAdd(prompt.id, data)} onRemove={onVideoRemove} allVideos={submissions.videos} contractorId={contractorId} evaluationId={evaluationId} />;
        case PROMPT_TYPES.SELECT:
            return <SelectPrompt prompt={prompt} index={index} value={submissions.answers[prompt.id] || ''} onChange={(value) => onAnswerChange(prompt.id, value)} />;
        case PROMPT_TYPES.YES_NO:
            return <YesNoPrompt prompt={prompt} index={index} value={submissions.answers[prompt.id]} onChange={(value) => onAnswerChange(prompt.id, value)} />;
        case PROMPT_TYPES.NUMBER:
            return <NumberPrompt prompt={prompt} index={index} value={submissions.answers[prompt.id] || ''} onChange={(value) => onAnswerChange(prompt.id, value)} />;
        default:
            return <TextPrompt prompt={prompt} index={index} value={submissions.answers[prompt.id] || ''} onChange={(value) => onAnswerChange(prompt.id, value)} />;
    }
};

// ============================================
// PHOTO PROMPT
// ============================================

const PhotoPrompt = ({ prompt, index, photos, onAdd, onRemove, allPhotos, contractorId, evaluationId }) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setIsUploading(true);
        
        for (const file of files) {
            try {
                setUploadProgress(`Uploading ${file.name}...`);
                const uploadedPhoto = await uploadEvaluationFile(contractorId, evaluationId, file, 'photo');
                onAdd({ ...uploadedPhoto, promptId: prompt.id });
            } catch (error) {
                console.error('Failed to upload photo:', error);
                alert(`Failed to upload ${file.name}. Please try again.`);
            }
        }
        
        setIsUploading(false);
        setUploadProgress('');
        if (inputRef.current) inputRef.current.value = '';
    };

    const photoIndices = photos.map(p => allPhotos.indexOf(p));

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Camera className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">{prompt.label}{prompt.required && <span className="text-red-500 ml-1">*</span>}</p>
                    {prompt.hint && <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>}
                </div>
            </div>

            {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {photos.map((photo, i) => (
                        <div key={i} className="relative group">
                            <img src={photo.url} alt={photo.name} className="w-20 h-20 object-cover rounded-lg" />
                            <button onClick={() => onRemove(photoIndices[i])} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
            <button onClick={() => inputRef.current?.click()} disabled={isUploading} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                {isUploading ? (<><Loader2 className="w-5 h-5 animate-spin" />{uploadProgress || 'Uploading...'}</>) : (<><Upload className="w-5 h-5" />{photos.length > 0 ? 'Add More Photos' : 'Upload Photo'}</>)}
            </button>
        </div>
    );
};

// ============================================
// VIDEO PROMPT
// ============================================

const VideoPrompt = ({ prompt, index, videos, onAdd, onRemove, allVideos, contractorId, evaluationId }) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        setUploadProgress(`Uploading ${file.name}...`);
        
        try {
            const uploadedVideo = await uploadEvaluationFile(contractorId, evaluationId, file, 'video');
            onAdd({ ...uploadedVideo, promptId: prompt.id, duration: null });
        } catch (error) {
            console.error('Failed to upload video:', error);
            alert(`Failed to upload ${file.name}. Please try again.`);
        }
        
        setIsUploading(false);
        setUploadProgress('');
        if (inputRef.current) inputRef.current.value = '';
    };

    const videoIndices = videos.map(v => allVideos.indexOf(v));

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Video className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                    <p className="font-medium text-slate-800">{prompt.label}{prompt.required && <span className="text-red-500 ml-1">*</span>}</p>
                    {prompt.hint && <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>}
                </div>
            </div>

            {videos.length > 0 && (
                <div className="space-y-2 mb-3">
                    {videos.map((video, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Play className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{video.name}</p>
                                <p className="text-xs text-slate-500">{(video.size / (1024 * 1024)).toFixed(1)} MB</p>
                            </div>
                            <button onClick={() => onRemove(videoIndices[i])} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <input ref={inputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            <button onClick={() => inputRef.current?.click()} disabled={isUploading} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-2">
                {isUploading ? (<><Loader2 className="w-5 h-5 animate-spin" />{uploadProgress || 'Uploading...'}</>) : (<><Video className="w-5 h-5" />{videos.length > 0 ? 'Replace Video' : 'Upload Video'}</>)}
            </button>
        </div>
    );
};

// ============================================
// TEXT PROMPT
// ============================================

const TextPrompt = ({ prompt, index, value, onChange }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-slate-800">{prompt.label}{prompt.required && <span className="text-red-500 ml-1">*</span>}</p>
                {prompt.hint && <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>}
            </div>
        </div>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" placeholder="Type your answer..." />
    </div>
);

// ============================================
// SELECT PROMPT
// ============================================

const SelectPrompt = ({ prompt, index, value, onChange }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-slate-800">{prompt.label}{prompt.required && <span className="text-red-500 ml-1">*</span>}</p>
                {prompt.hint && <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            {prompt.options?.map((option) => (
                <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`p-3 rounded-lg border-2 text-left transition-all ${value === option.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                    <span className="text-sm font-medium">{option.label}</span>
                </button>
            ))}
        </div>
    </div>
);

// ============================================
// YES/NO PROMPT
// ============================================

const YesNoPrompt = ({ prompt, index, value, onChange }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
                <p className="font-medium text-slate-800">{prompt.label}{prompt.required && <span className="text-red-500 ml-1">*</span>}</p>
            </div>
        </div>
        <div className="flex gap-3">
            <button type="button" onClick={() => onChange(true)} className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${value === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>Yes</button>
            <button type="button" onClick={() => onChange(false)} className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${value === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>No</button>
        </div>
    </div>
);

// ============================================
// NUMBER PROMPT
// ============================================

const NumberPrompt = ({ prompt, index, value, onChange }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-600 font-bold text-sm">#</span>
            </div>
            <div className="flex-1">
                <p className="font-medium text-slate-800">{prompt.label}{prompt.required && <span className="text-red-500 ml-1">*</span>}</p>
                {prompt.hint && <p className="text-sm text-slate-500 mt-0.5">{prompt.hint}</p>}
            </div>
        </div>
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Enter a number" />
    </div>
);

// ============================================
// ACCOUNT CREATION FORM
// ============================================

const AccountCreationForm = ({ email, setEmail, password, setPassword, name, setName, error, isLoading, onSubmit, onSignIn, onGoogleSignIn }) => {
    const [mode, setMode] = useState('signup');
    const [showPassword, setShowPassword] = useState(false);
    
    return (
        <div className="space-y-4">
            <button type="button" onClick={onGoogleSignIn} disabled={isLoading} className="w-full py-3 px-4 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
            </button>
            
            <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-500">or</span></div>
            </div>
            
            <form onSubmit={mode === 'signup' ? onSubmit : onSignIn} className="space-y-3">
                {mode === 'signup' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                
                {error && <p className="text-red-600 text-sm">{error}</p>}
                
                <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'signup' ? 'Create Account' : 'Sign In')}
                </button>
            </form>
            
            <p className="text-center text-sm text-slate-500">
                {mode === 'signup' ? (<>Already have an account? <button onClick={() => setMode('signin')} className="text-indigo-600 font-medium hover:underline">Sign in</button></>) : (<>Need an account? <button onClick={() => setMode('signup')} className="text-indigo-600 font-medium hover:underline">Sign up</button></>)}
            </p>
        </div>
    );
};

export default EvaluationSubmission;
