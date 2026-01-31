// src/features/jobs/components/updates/JobUpdateForm.jsx
// ============================================
// JOB UPDATE FORM COMPONENT
// ============================================
// Mobile-friendly form for crew members to add progress updates during a job

import React, { useState, useRef } from 'react';
import {
    X,
    Camera,
    Image as ImageIcon,
    Send,
    Loader2,
    Wrench,
    AlertTriangle,
    Package,
    Clock,
    Trash2
} from 'lucide-react';
import { addJobUpdate, UPDATE_TYPES } from '../../lib/jobUpdateService';
import { uploadJobPhoto, compressImage, PHOTO_TYPES } from '../../lib/jobPhotoService';
import toast from 'react-hot-toast';

// ============================================
// CONSTANTS
// ============================================

const UPDATE_TYPE_OPTIONS = [
    {
        value: UPDATE_TYPES.PROGRESS,
        label: 'Progress',
        icon: Wrench,
        color: 'emerald',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        activeColor: 'bg-emerald-600',
        description: 'Work update'
    },
    {
        value: UPDATE_TYPES.ISSUE,
        label: 'Issue Found',
        icon: AlertTriangle,
        color: 'red',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        activeColor: 'bg-red-600',
        description: 'Problem discovered'
    },
    {
        value: UPDATE_TYPES.MATERIAL,
        label: 'Material Note',
        icon: Package,
        color: 'blue',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        activeColor: 'bg-blue-600',
        description: 'Parts or supplies'
    },
    {
        value: UPDATE_TYPES.DELAY,
        label: 'Delay',
        icon: Clock,
        color: 'amber',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        activeColor: 'bg-amber-600',
        description: 'Timeline change'
    }
];

const MAX_PHOTOS = 5;

// ============================================
// MAIN COMPONENT
// ============================================

export const JobUpdateForm = ({
    job,
    techId,
    techName,
    onSuccess,
    onCancel
}) => {
    const [updateType, setUpdateType] = useState(UPDATE_TYPES.PROGRESS);
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const selectedTypeOption = UPDATE_TYPE_OPTIONS.find(t => t.value === updateType);

    // Handle file selection
    const handleFileSelect = async (e) => {
        console.log('[JobUpdateForm] ===== PHOTO UPLOAD START =====');
        console.log('[JobUpdateForm] Event target:', e.target);
        console.log('[JobUpdateForm] Files:', e.target.files);

        const files = Array.from(e.target.files || []);
        console.log('[JobUpdateForm] Files array length:', files.length);

        if (files.length === 0) {
            console.log('[JobUpdateForm] No files selected, returning');
            return;
        }

        const remaining = MAX_PHOTOS - photos.length;
        console.log('[JobUpdateForm] Remaining photo slots:', remaining);

        if (remaining <= 0) {
            toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
            return;
        }

        const filesToProcess = files.slice(0, remaining);
        console.log('[JobUpdateForm] Files to process:', filesToProcess.length);

        setUploading(true);
        const loadingToast = toast.loading('Uploading photos...');

        try {
            const uploadPromises = filesToProcess.map(async (file, index) => {
                console.log(`[JobUpdateForm] Processing file ${index + 1}:`, {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });

                // Compress image
                console.log(`[JobUpdateForm] Compressing file ${index + 1}...`);
                let fileToUpload;

                try {
                    const compressed = await compressImage(file, {
                        maxWidth: 1920,
                        maxHeight: 1920,
                        quality: 0.85
                    });
                    console.log(`[JobUpdateForm] Compression result for file ${index + 1}:`, {
                        originalSize: file.size,
                        compressedSize: compressed.size,
                        compressedType: compressed.type
                    });

                    fileToUpload = new File([compressed], file.name, {
                        type: 'image/jpeg'
                    });
                    console.log(`[JobUpdateForm] Created compressed File object for ${index + 1}:`, {
                        name: fileToUpload.name,
                        size: fileToUpload.size,
                        type: fileToUpload.type
                    });
                } catch (compressError) {
                    console.error(`[JobUpdateForm] Compression failed for file ${index + 1}:`, compressError);
                    console.log(`[JobUpdateForm] Using original file for ${index + 1}`);
                    fileToUpload = file;
                }

                // Upload to Firebase
                console.log(`[JobUpdateForm] Uploading file ${index + 1} to Firebase...`);
                console.log(`[JobUpdateForm] Upload params:`, {
                    jobId: job.id,
                    fileName: fileToUpload.name,
                    fileSize: fileToUpload.size,
                    photoType: PHOTO_TYPES.PROGRESS,
                    techId,
                    techName
                });

                const photoData = await uploadJobPhoto(
                    job.id,
                    fileToUpload,
                    PHOTO_TYPES.PROGRESS,
                    { techId, techName }
                );

                console.log(`[JobUpdateForm] Upload successful for file ${index + 1}:`, photoData);
                return photoData;
            });

            const results = await Promise.allSettled(uploadPromises);
            console.log('[JobUpdateForm] All upload results:', results);

            const successfulUploads = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);

            const failedResults = results.filter(r => r.status === 'rejected');
            const failedCount = failedResults.length;

            if (failedCount > 0) {
                console.error('[JobUpdateForm] Failed uploads:', failedResults.map(r => r.reason));
            }

            toast.dismiss(loadingToast);

            if (successfulUploads.length > 0) {
                console.log('[JobUpdateForm] Adding successful uploads to state:', successfulUploads);
                setPhotos(prev => [...prev, ...successfulUploads]);
                toast.success(`${successfulUploads.length} photo${successfulUploads.length > 1 ? 's' : ''} added`);
            }

            if (failedCount > 0) {
                toast.error(`${failedCount} photo${failedCount > 1 ? 's' : ''} failed to upload`);
            }
        } catch (error) {
            console.error('[JobUpdateForm] ===== UPLOAD ERROR =====');
            console.error('[JobUpdateForm] Error name:', error.name);
            console.error('[JobUpdateForm] Error message:', error.message);
            console.error('[JobUpdateForm] Error stack:', error.stack);
            console.error('[JobUpdateForm] ===== END ERROR =====');
            toast.dismiss(loadingToast);
            toast.error('Failed to upload photos');
        } finally {
            setUploading(false);
            if (e.target) {
                e.target.value = '';
            }
            console.log('[JobUpdateForm] ===== PHOTO UPLOAD END =====');
        }
    };

    // Remove a photo
    const handleRemovePhoto = (photoId) => {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
    };

    // Handle form submission
    const handleSubmit = async () => {
        // Validate notes
        if (!notes.trim()) {
            toast.error('Please add some notes about the update');
            return;
        }

        setSubmitting(true);

        try {
            const result = await addJobUpdate(
                job.id,
                {
                    type: updateType,
                    notes: notes.trim(),
                    photos
                },
                techId,
                techName
            );

            if (result.success) {
                toast.success('Update added!', { icon: '✓' });
                if (onSuccess) {
                    onSuccess(result.updateId);
                }
            } else {
                throw new Error(result.error || 'Failed to add update');
            }
        } catch (error) {
            console.error('[JobUpdateForm] Submit error:', error);
            toast.error(error.message || 'Failed to add update');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg mx-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <Send className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Add Update</h2>
                            <p className="text-indigo-100 text-sm">
                                {job.title || job.serviceType || 'Job'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
                {/* Update Type Selector */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Update Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {UPDATE_TYPE_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isSelected = updateType === option.value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setUpdateType(option.value)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                        isSelected
                                            ? `${option.bgColor} ${option.borderColor} ${option.textColor}`
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${
                                        isSelected ? option.activeColor : 'bg-gray-100'
                                    }`}>
                                        <Icon className={`w-4 h-4 ${
                                            isSelected ? 'text-white' : 'text-gray-500'
                                        }`} />
                                    </div>
                                    <div className="text-left">
                                        <p className={`font-medium text-sm ${
                                            isSelected ? option.textColor : 'text-gray-700'
                                        }`}>
                                            {option.label}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {option.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Notes Text Area */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Notes
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="What's happening on the job?"
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-gray-800 placeholder-gray-400"
                    />
                    <p className="text-xs text-gray-400 text-right">
                        Be descriptive - this can be shared with the customer
                    </p>
                </div>

                {/* Photo Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Photos <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <span className="text-xs text-gray-500">
                            {photos.length}/{MAX_PHOTOS}
                        </span>
                    </div>

                    {/* Photo Thumbnails */}
                    {photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {photos.map((photo) => (
                                <div
                                    key={photo.id}
                                    className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden group"
                                >
                                    <img
                                        src={photo.url}
                                        alt="Update photo"
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePhoto(photo.id)}
                                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Photo Buttons */}
                    {photos.length < MAX_PHOTOS && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={uploading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {uploading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Camera className="w-5 h-5" />
                                )}
                                Camera
                            </button>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ImageIcon className="w-5 h-5" />
                                Gallery
                            </button>
                        </div>
                    )}

                    {/* Hidden Inputs */}
                    <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.heic,.heif"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t bg-gray-50 flex gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !notes.trim()}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                        notes.trim()
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Adding...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Add Update
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default JobUpdateForm;
