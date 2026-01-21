// src/features/jobs/components/StartJobWithPhotosModal.jsx
// ============================================
// START JOB WITH BEFORE PHOTOS MODAL
// ============================================
// Requires technician to capture before photos when starting a job

import React, { useState, useEffect } from 'react';
import {
    X, Camera, Wrench, AlertCircle, Check, Loader2, MapPin, Clock
} from 'lucide-react';
import { JobPhotoCapture } from './JobPhotoCapture';
import {
    startJobWithPhotos,
    getPhotoRequirements,
    PHOTO_TYPES,
    DEFAULT_PHOTO_REQUIREMENTS
} from '../lib/jobPhotoService';
import toast from 'react-hot-toast';

// Helper to safely extract address string (prevents React Error #310)
const safeAddress = (addr) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
        if (addr.formatted) return addr.formatted;
        if (addr.full) return addr.full;
        if (addr.street) return addr.street;
        return '';
    }
    return String(addr);
};

// Helper to safely format timestamp/date
const safeFormatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
};

export const StartJobWithPhotosModal = ({
    job,
    contractorId,
    techId,
    techName,
    onClose,
    onSuccess
}) => {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [requirements, setRequirements] = useState(DEFAULT_PHOTO_REQUIREMENTS);
    const [showCapture, setShowCapture] = useState(false);

    // Load photo requirements
    useEffect(() => {
        const loadRequirements = async () => {
            if (contractorId) {
                const reqs = await getPhotoRequirements(contractorId);
                setRequirements(reqs);
            }
        };
        loadRequirements();
    }, [contractorId]);

    const minBeforePhotos = requirements.beforePhotosRequired
        ? requirements.minBeforePhotos || 1
        : 0;

    const canStart = !requirements.beforePhotosRequired || photos.length >= minBeforePhotos;

    const handleStartJob = async () => {
        if (!canStart) {
            toast.error(`Please take at least ${minBeforePhotos} before photo${minBeforePhotos > 1 ? 's' : ''}`);
            return;
        }

        setLoading(true);
        try {
            await startJobWithPhotos(job.id, photos, techId, techName);
            toast.success('Job started!', { icon: '🔧' });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error starting job:', error);
            toast.error(error.message || 'Failed to start job');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotosComplete = (capturedPhotos) => {
        setPhotos(capturedPhotos);
        setShowCapture(false);
    };

    if (showCapture) {
        return (
            <div className="fixed inset-0 z-[100] bg-white">
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b bg-orange-50">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-xl">
                                <Camera className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-800">Before Photos</h2>
                                <p className="text-sm text-gray-500">Document current state</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCapture(false)}
                            className="p-2 hover:bg-gray-100 rounded-xl"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Photo Capture */}
                    <div className="flex-1 overflow-auto p-4">
                        <JobPhotoCapture
                            jobId={job.id}
                            type={PHOTO_TYPES.BEFORE}
                            minPhotos={minBeforePhotos}
                            maxPhotos={10}
                            existingPhotos={photos}
                            onPhotosChange={setPhotos}
                            onComplete={handlePhotosComplete}
                            techId={techId}
                            techName={techName}
                            allowTypeChange={false}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <Wrench className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Start Job</h2>
                            <p className="text-amber-100 text-sm">
                                {job.title || job.serviceType || 'Service Request'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Job Info */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{safeAddress(job.customer?.address) || safeAddress(job.serviceAddress) || 'No address'}</span>
                        </div>
                        {job.scheduledTime && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>Scheduled for {safeFormatTime(job.scheduledTime)}</span>
                            </div>
                        )}
                    </div>

                    {/* Before Photos Section */}
                    {requirements.beforePhotosRequired && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-800">Before Photos</h3>
                                <span className={`text-sm font-medium ${
                                    photos.length >= minBeforePhotos
                                        ? 'text-emerald-600'
                                        : 'text-amber-600'
                                }`}>
                                    {photos.length}/{minBeforePhotos} required
                                </span>
                            </div>

                            {photos.length > 0 ? (
                                <div className="space-y-3">
                                    {/* Photo thumbnails */}
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {photos.map((photo) => (
                                            <div
                                                key={photo.id}
                                                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden"
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt="Before"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add more button */}
                                    <button
                                        onClick={() => setShowCapture(true)}
                                        className="w-full py-2.5 border-2 border-dashed border-orange-300 text-orange-600 rounded-xl font-medium hover:bg-orange-50 flex items-center justify-center gap-2"
                                    >
                                        <Camera className="w-4 h-4" />
                                        Add More Photos
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowCapture(true)}
                                    className="w-full py-6 bg-orange-50 border-2 border-dashed border-orange-200 rounded-xl hover:bg-orange-100 hover:border-orange-300 transition-colors"
                                >
                                    <Camera className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                                    <p className="text-orange-600 font-semibold">
                                        Take Before Photos
                                    </p>
                                    <p className="text-orange-500 text-sm mt-1">
                                        Document the current state before starting work
                                    </p>
                                </button>
                            )}

                            {/* Warning if not enough photos */}
                            {photos.length < minBeforePhotos && (
                                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm">
                                        Take at least {minBeforePhotos} before photo{minBeforePhotos > 1 ? 's' : ''} to start
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* No photo requirement message */}
                    {!requirements.beforePhotosRequired && (
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-blue-700 text-sm">
                                Before photos are optional. Tap "Start Job" when ready.
                            </p>
                            <button
                                onClick={() => setShowCapture(true)}
                                className="mt-3 text-blue-600 font-medium text-sm hover:underline flex items-center justify-center gap-1"
                            >
                                <Camera className="w-4 h-4" />
                                Take photos anyway
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleStartJob}
                        disabled={loading || !canStart}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                            canStart
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Starting...
                            </>
                        ) : (
                            <>
                                <Wrench className="w-5 h-5" />
                                Start Job
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StartJobWithPhotosModal;
