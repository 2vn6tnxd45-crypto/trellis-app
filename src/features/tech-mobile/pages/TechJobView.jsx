// src/features/tech-mobile/pages/TechJobView.jsx
// ============================================
// TECH JOB DETAIL VIEW
// ============================================
// Full job details with actions for techs
// Start job, take photos, capture signature, complete

import React, { useState, useRef, useCallback } from 'react';
import {
    ArrowLeft, MapPin, User, Phone, Clock, Camera,
    CheckCircle, AlertCircle, Navigation, Play, FileText,
    DollarSign, MessageSquare, ChevronDown, ChevronUp,
    Upload, Loader2, PenTool, QrCode, X
} from 'lucide-react';
import { SignatureCapture } from '../../../components/SignatureCapture';
import { PaymentQRCode } from '../../../components/PaymentQRCode';
import { useTechJobs } from '../hooks/useTechJobs';
import { useTechSession } from '../hooks/useTechSession';
import { db, storage } from '../../../config/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';

// ============================================
// PHOTO UPLOAD HELPER
// ============================================
const uploadPhoto = async (jobId, file, type = 'completion') => {
    const timestamp = Date.now();
    const fileName = `${type}_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `jobs/${jobId}/photos/${fileName}`);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    return {
        id: `photo_${timestamp}`,
        url,
        fileName,
        type,
        uploadedAt: new Date().toISOString()
    };
};

// ============================================
// STATUS STEPS
// ============================================
const JOB_STEPS = [
    { id: 'arrive', label: 'Arrive', icon: MapPin },
    { id: 'photos_before', label: 'Before Photos', icon: Camera },
    { id: 'work', label: 'Do Work', icon: Play },
    { id: 'photos_after', label: 'After Photos', icon: Camera },
    { id: 'signature', label: 'Signature', icon: PenTool },
    { id: 'payment', label: 'Payment', icon: DollarSign },
    { id: 'complete', label: 'Complete', icon: CheckCircle }
];

// ============================================
// MAIN COMPONENT
// ============================================
export const TechJobView = ({ job, onBack, onComplete }) => {
    const { session, contractor } = useTechSession();
    const { checkIn, checkOut, pauseJob, updateJobStatus } = useTechJobs(
        session?.techId,
        session?.contractorId
    );

    // State
    const [currentStep, setCurrentStep] = useState(
        (job.status === 'in_progress') ? 'work' : 'arrive'
    );
    const [isLoading, setIsLoading] = useState(false);
    const [beforePhotos, setBeforePhotos] = useState(job.beforePhotos || []);
    const [afterPhotos, setAfterPhotos] = useState(job.completionData?.photos || []);
    const [signature, setSignature] = useState(job.completionData?.signature || null);
    const [notes, setNotes] = useState('');
    const [showPaymentQR, setShowPaymentQR] = useState(false);
    const [paymentCollected, setPaymentCollected] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [expandedSection, setExpandedSection] = useState('details');

    const photoInputRef = useRef(null);
    const [photoType, setPhotoType] = useState('before');

    // Calculate balance due
    const balanceDue = job.balanceDue ?? (
        (job.total || 0) - (job.depositPaid || 0)
    );

    // ============================================
    // HANDLE ARRIVE (CHECK IN)
    // ============================================
    const handleArrive = async () => {
        setIsLoading(true);
        try {
            // Get current location
            let location = null;
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 10000,
                            enableHighAccuracy: true
                        });
                    });
                    location = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    };
                } catch (geoErr) {
                    console.warn('Geolocation error:', geoErr);
                }
            }

            await checkIn(job.id, location);
            setCurrentStep('photos_before');
            toast.success('Checked in!');
        } catch (err) {
            toast.error('Failed to check in');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // HANDLE PHOTO UPLOAD
    // ============================================
    const handlePhotoSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadingPhoto(true);
        const loadingToast = toast.loading('Uploading photos...');

        try {
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    toast.error(`${file.name} is too large (max 10MB)`);
                    continue;
                }

                const result = await uploadPhoto(job.id, file, photoType);

                // Update Firestore
                const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
                const fieldName = photoType === 'before' ? 'beforePhotos' : 'completionPhotos';
                await updateDoc(jobRef, {
                    [fieldName]: arrayUnion(result),
                    lastActivity: serverTimestamp()
                });

                // Update local state
                if (photoType === 'before') {
                    setBeforePhotos(prev => [...prev, result]);
                } else {
                    setAfterPhotos(prev => [...prev, result]);
                }
            }

            toast.dismiss(loadingToast);
            toast.success('Photos uploaded!');
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error('Failed to upload photos');
            console.error(err);
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ============================================
    // HANDLE SIGNATURE CAPTURE
    // ============================================
    const handleSignatureCapture = async (sigData) => {
        setIsLoading(true);
        try {
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
            await updateDoc(jobRef, {
                'completionData.signature': {
                    ...sigData,
                    capturedBy: session.techId
                },
                lastActivity: serverTimestamp()
            });
            setSignature(sigData);
            setCurrentStep('payment');
            toast.success('Signature captured!');
        } catch (err) {
            toast.error('Failed to save signature');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // HANDLE COMPLETE JOB
    // ============================================
    const handleComplete = async () => {
        // Validate requirements
        if (afterPhotos.length === 0) {
            toast.error('Please add at least one after photo');
            setCurrentStep('photos_after');
            return;
        }

        setIsLoading(true);
        try {
            // Get location
            let location = null;
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 10000
                        });
                    });
                    location = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    };
                } catch (geoErr) {
                    console.warn('Geolocation error:', geoErr);
                }
            }

            await checkOut(job.id, location);

            // Update job with completion data
            const jobRef = doc(db, REQUESTS_COLLECTION_PATH, job.id);
            await updateDoc(jobRef, {
                status: 'pending_completion',
                completionData: {
                    photos: afterPhotos,
                    signature: signature,
                    notes: notes,
                    completedBy: session.techId,
                    completedAt: serverTimestamp(),
                    paymentCollected: paymentCollected,
                    completionLocation: location
                },
                lastActivity: serverTimestamp()
            });

            toast.success('Job completed! Awaiting customer approval.');
            onComplete?.();
        } catch (err) {
            toast.error('Failed to complete job');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // HANDLE PAUSE (END SHIFT)
    // ============================================
    const handlePause = async () => {
        if (!window.confirm('End shift for today? You can resume this job later.')) return;

        setIsLoading(true);
        try {
            // Get location
            let location = null;
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            timeout: 10000
                        });
                    });
                    location = {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude
                    };
                } catch (geoErr) {
                    console.warn('Geolocation error:', geoErr);
                }
            }

            await pauseJob(job.id, location);
            toast.success('Job paused. See you tomorrow!');
            onBack(); // Return to dashboard
        } catch (err) {
            toast.error('Failed to pause job');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 safe-area-top">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold text-gray-900 truncate">{job.title}</h1>
                        <p className="text-sm text-gray-500">#{job.jobNumber}</p>
                    </div>
                </div>
            </header>

            {/* Progress Steps */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                    {JOB_STEPS.map((step, idx) => {
                        const isActive = step.id === currentStep;
                        const isPast = JOB_STEPS.findIndex(s => s.id === currentStep) > idx;
                        const Icon = step.icon;

                        return (
                            <button
                                key={step.id}
                                onClick={() => isPast && setCurrentStep(step.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive
                                    ? 'bg-emerald-600 text-white'
                                    : isPast
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {step.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {/* STEP: ARRIVE */}
                {currentStep === 'arrive' && (
                    <div className="space-y-4">
                        {/* Customer & Address Card */}
                        <div className="bg-white rounded-2xl p-4 border border-gray-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                    <User className="w-6 h-6 text-gray-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{job.customerName}</p>
                                    {job.customerPhone && (
                                        <a
                                            href={`tel:${job.customerPhone}`}
                                            className="text-sm text-emerald-600 flex items-center gap-1"
                                        >
                                            <Phone className="w-3 h-3" />
                                            {job.customerPhone}
                                        </a>
                                    )}
                                </div>
                            </div>

                            <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(job.addressFormatted)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl"
                            >
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{job.addressFormatted}</p>
                                    <p className="text-sm text-blue-600">Tap for directions</p>
                                </div>
                                <Navigation className="w-5 h-5 text-blue-500" />
                            </a>
                        </div>

                        {/* Job Details */}
                        <div className="bg-white rounded-2xl p-4 border border-gray-200">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-5 h-5 text-gray-400" />
                                <span className="text-lg font-semibold text-gray-900">
                                    {job.scheduledDateTime?.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    }) || '--:--'}
                                </span>
                                {job.estimatedDuration && (
                                    <span className="text-gray-400">
                                        ({Math.floor(job.estimatedDuration / 60)}h {job.estimatedDuration % 60}m)
                                    </span>
                                )}
                            </div>

                            {job.notes && (
                                <div className="p-3 bg-amber-50 rounded-xl">
                                    <p className="text-xs font-medium text-amber-700 mb-1">Notes:</p>
                                    <p className="text-sm text-amber-900">{job.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Check In Button */}
                        <button
                            onClick={handleArrive}
                            disabled={isLoading}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    {job.status === 'paused' ? 'Resume Work' : "I've Arrived"}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* STEP: BEFORE PHOTOS */}
                {currentStep === 'photos_before' && (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <Camera className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                            <h2 className="text-lg font-bold text-gray-900">Take Before Photos</h2>
                            <p className="text-gray-500">Document the area before starting work</p>
                        </div>

                        {/* Photo Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            {beforePhotos.map((photo, idx) => (
                                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden">
                                    <img
                                        src={photo.url}
                                        alt={`Before ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    setPhotoType('before');
                                    photoInputRef.current?.click();
                                }}
                                disabled={uploadingPhoto}
                                className="aspect-square rounded-lg border-2 border-dashed border-emerald-300 flex flex-col items-center justify-center bg-emerald-50 hover:bg-emerald-100"
                            >
                                {uploadingPhoto ? (
                                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                                ) : (
                                    <>
                                        <Camera className="w-6 h-6 text-emerald-500 mb-1" />
                                        <span className="text-xs text-emerald-600">Add Photo</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={handlePhotoSelect}
                            className="hidden"
                        />

                        <button
                            onClick={() => setCurrentStep('work')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                        >
                            <Play className="w-5 h-5" />
                            Start Work
                        </button>
                    </div>
                )}

                {/* STEP: WORK IN PROGRESS */}
                {currentStep === 'work' && (
                    <div className="space-y-4">
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Play className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h2 className="text-lg font-bold text-emerald-800">Work in Progress</h2>
                            <p className="text-emerald-600 mt-1">Complete the job, then take after photos</p>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <a
                                href={`tel:${job.customerPhone}`}
                                className="p-4 bg-white rounded-xl border border-gray-200 text-center hover:bg-gray-50"
                            >
                                <Phone className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                                <span className="text-sm font-medium text-gray-700">Call Customer</span>
                            </a>
                            <button
                                onClick={() => {
                                    setPhotoType('work');
                                    photoInputRef.current?.click();
                                }}
                                className="p-4 bg-white rounded-xl border border-gray-200 text-center hover:bg-gray-50"
                            >
                                <Camera className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                                <span className="text-sm font-medium text-gray-700">Progress Photo</span>
                            </button>
                        </div>

                        <button
                            onClick={handlePause}
                            className="w-full py-4 bg-amber-100 text-amber-800 rounded-2xl font-bold hover:bg-amber-200 flex items-center justify-center gap-2"
                        >
                            <Clock className="w-5 h-5" />
                            End Shift (Continue Later)
                        </button>

                        <button
                            onClick={() => setCurrentStep('photos_after')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                        >
                            <Camera className="w-5 h-5" />
                            Work Complete - Take After Photos
                        </button>
                    </div>
                )}

                {/* STEP: AFTER PHOTOS */}
                {currentStep === 'photos_after' && (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <Camera className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                            <h2 className="text-lg font-bold text-gray-900">Take After Photos</h2>
                            <p className="text-gray-500">Document the completed work</p>
                        </div>

                        {/* Photo Grid */}
                        <div className="grid grid-cols-3 gap-2">
                            {afterPhotos.map((photo, idx) => (
                                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden">
                                    <img
                                        src={photo.url}
                                        alt={`After ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    setPhotoType('after');
                                    photoInputRef.current?.click();
                                }}
                                disabled={uploadingPhoto}
                                className="aspect-square rounded-lg border-2 border-dashed border-blue-300 flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100"
                            >
                                {uploadingPhoto ? (
                                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                ) : (
                                    <>
                                        <Camera className="w-6 h-6 text-blue-500 mb-1" />
                                        <span className="text-xs text-blue-600">Add Photo</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={handlePhotoSelect}
                            className="hidden"
                        />

                        {afterPhotos.length > 0 && (
                            <button
                                onClick={() => setCurrentStep('signature')}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                            >
                                <PenTool className="w-5 h-5" />
                                Get Customer Signature
                            </button>
                        )}
                    </div>
                )}

                {/* STEP: SIGNATURE */}
                {currentStep === 'signature' && (
                    <div className="space-y-4">
                        {signature ? (
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                    <span className="font-semibold text-emerald-800">Signature Captured</span>
                                </div>
                                <img
                                    src={signature.signatureImage}
                                    alt="Signature"
                                    className="h-20 mx-auto bg-white rounded p-2"
                                />
                                <p className="text-sm text-emerald-700 text-center mt-2">
                                    Signed by {signature.signerName}
                                </p>
                                <button
                                    onClick={() => setSignature(null)}
                                    className="mt-3 text-sm text-emerald-700 underline w-full text-center"
                                >
                                    Recapture signature
                                </button>
                            </div>
                        ) : (
                            <SignatureCapture
                                title="Customer Signature"
                                description="Please sign to confirm work completion"
                                signerName={job.customerName}
                                legalText={`I confirm that the work for "${job.title}" has been completed to my satisfaction.`}
                                onCapture={handleSignatureCapture}
                                captureLocation={true}
                            />
                        )}

                        {signature && (
                            <button
                                onClick={() => setCurrentStep('payment')}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700"
                            >
                                Continue to Payment
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setCurrentStep('payment');
                                toast('Customer will sign via email', { icon: 'ℹ️' });
                            }}
                            className="w-full py-3 text-gray-500 text-sm"
                        >
                            Skip - Customer not available
                        </button>
                    </div>
                )}

                {/* STEP: PAYMENT */}
                {currentStep === 'payment' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-gray-600">Balance Due</span>
                                <span className="text-2xl font-bold text-emerald-600">
                                    ${balanceDue.toFixed(2)}
                                </span>
                            </div>

                            {balanceDue > 0 && !paymentCollected ? (
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setShowPaymentQR(true)}
                                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2"
                                    >
                                        <QrCode className="w-5 h-5" />
                                        Show Payment QR Code
                                    </button>

                                    <button
                                        onClick={() => {
                                            setPaymentCollected(true);
                                            toast.success('Payment marked as collected');
                                        }}
                                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                                    >
                                        Mark as Paid (Cash/Check)
                                    </button>

                                    <button
                                        onClick={() => setCurrentStep('complete')}
                                        className="w-full py-2 text-gray-500 text-sm"
                                    >
                                        Skip - Send payment link later
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                                    <p className="font-semibold text-emerald-800">
                                        {balanceDue === 0 ? 'Fully Paid' : 'Payment Collected'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setCurrentStep('complete')}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700"
                        >
                            Continue to Complete
                        </button>
                    </div>
                )}

                {/* STEP: COMPLETE */}
                {currentStep === 'complete' && (
                    <div className="space-y-4">
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center">
                            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-3" />
                            <h2 className="text-xl font-bold text-emerald-800">Ready to Complete</h2>
                            <p className="text-emerald-600 mt-1">Review and submit job completion</p>
                        </div>

                        {/* Summary */}
                        <div className="bg-white rounded-2xl p-4 border border-gray-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Photos</span>
                                <span className={afterPhotos.length > 0 ? 'text-emerald-600 font-medium' : 'text-red-500'}>
                                    {afterPhotos.length > 0 ? `${afterPhotos.length} after photos` : 'Required'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Signature</span>
                                <span className={signature ? 'text-emerald-600 font-medium' : 'text-amber-500'}>
                                    {signature ? 'Captured' : 'Pending via email'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-600">Payment</span>
                                <span className={paymentCollected || balanceDue === 0 ? 'text-emerald-600 font-medium' : 'text-amber-500'}>
                                    {paymentCollected || balanceDue === 0 ? 'Collected' : 'Will send link'}
                                </span>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Completion Notes (Optional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any notes about the completed work..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 resize-none"
                            />
                        </div>

                        <button
                            onClick={handleComplete}
                            disabled={isLoading || afterPhotos.length === 0}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Complete Job
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Payment QR Modal */}
            {showPaymentQR && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="relative bg-white rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowPaymentQR(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <PaymentQRCode
                            amount={balanceDue}
                            jobId={job.id}
                            jobNumber={job.jobNumber}
                            description={job.title}
                            customerName={job.customerName}
                            customerEmail={job.customerEmail}
                            customerPhone={job.customerPhone}
                            contractorId={session?.contractorId}
                            contractorName={contractor?.businessName}
                            stripeAccountId={contractor?.stripeAccountId}
                            onPaymentSuccess={() => {
                                setPaymentCollected(true);
                                setShowPaymentQR(false);
                                toast.success('Payment received!');
                            }}
                            size="medium"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechJobView;
