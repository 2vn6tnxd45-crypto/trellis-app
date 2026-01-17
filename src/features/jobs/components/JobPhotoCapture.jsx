// src/features/jobs/components/JobPhotoCapture.jsx
// ============================================
// JOB PHOTO CAPTURE COMPONENT
// ============================================
// Mobile-friendly photo capture for before/after job documentation
// Supports camera capture, gallery selection, and GPS tagging

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Camera,
    Image as ImageIcon,
    X,
    Plus,
    Trash2,
    RotateCcw,
    Check,
    Loader2,
    MapPin,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ZoomIn
} from 'lucide-react';
import {
    uploadJobPhoto,
    compressImage,
    convertHeicToJpeg,
    PHOTO_TYPES
} from '../lib/jobPhotoService';
import toast from 'react-hot-toast';

// ============================================
// CONSTANTS
// ============================================

const PHOTO_TYPE_CONFIG = {
    [PHOTO_TYPES.BEFORE]: {
        label: 'Before',
        icon: '📷',
        color: 'orange',
        description: 'Document the current state before work begins'
    },
    [PHOTO_TYPES.AFTER]: {
        label: 'After',
        icon: '✨',
        color: 'green',
        description: 'Show the completed work'
    },
    [PHOTO_TYPES.PROGRESS]: {
        label: 'Progress',
        icon: '🔧',
        color: 'blue',
        description: 'Document work in progress'
    },
    [PHOTO_TYPES.ISSUE]: {
        label: 'Issue',
        icon: '⚠️',
        color: 'red',
        description: 'Document any problems found'
    }
};

// ============================================
// MAIN COMPONENT
// ============================================

export const JobPhotoCapture = ({
    jobId,
    type = PHOTO_TYPES.AFTER,
    minPhotos = 1,
    maxPhotos = 10,
    existingPhotos = [],
    onPhotosChange,
    onComplete,
    techId,
    techName,
    allowTypeChange = false,
    compactMode = false,
    showGeoTag = true
}) => {
    const [photos, setPhotos] = useState(existingPhotos);
    const [uploading, setUploading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [currentType, setCurrentType] = useState(type);
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const typeConfig = PHOTO_TYPE_CONFIG[currentType] || PHOTO_TYPE_CONFIG[PHOTO_TYPES.AFTER];

    // Get current location for geo-tagging
    useEffect(() => {
        if (showGeoTag && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    console.warn('[JobPhotoCapture] Location error:', error.message);
                    setLocationError('Location unavailable');
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, [showGeoTag]);

    // Notify parent of photo changes
    useEffect(() => {
        if (onPhotosChange) {
            onPhotosChange(photos);
        }
    }, [photos, onPhotosChange]);

    // Process and upload a file
    const processFile = async (file) => {
        try {
            let processedFile = file;

            // Convert HEIC if needed
            if (file.type === 'image/heic' || file.type === 'image/heif' ||
                file.name.toLowerCase().endsWith('.heic') ||
                file.name.toLowerCase().endsWith('.heif')) {
                try {
                    const converted = await convertHeicToJpeg(file);
                    processedFile = new File([converted], file.name.replace(/\.heic$/i, '.jpg'), {
                        type: 'image/jpeg'
                    });
                } catch (e) {
                    console.warn('[JobPhotoCapture] HEIC conversion failed, using original');
                }
            }

            // Compress image
            const compressed = await compressImage(processedFile, {
                maxWidth: 1920,
                maxHeight: 1920,
                quality: 0.85
            });

            // Create file from blob
            const compressedFile = new File([compressed], processedFile.name, {
                type: 'image/jpeg'
            });

            // Upload to Firebase
            const photoData = await uploadJobPhoto(jobId, compressedFile, currentType, {
                techId,
                techName,
                location,
                caption: ''
            });

            return photoData;
        } catch (error) {
            console.error('[JobPhotoCapture] Process error:', error);
            throw error;
        }
    };

    // Handle file selection (from gallery or camera)
    const handleFileSelect = useCallback(async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Check max photos
        const remaining = maxPhotos - photos.length;
        if (remaining <= 0) {
            toast.error(`Maximum ${maxPhotos} photos allowed`);
            return;
        }

        const filesToProcess = files.slice(0, remaining);
        setUploading(true);

        try {
            const uploadPromises = filesToProcess.map(processFile);
            const results = await Promise.allSettled(uploadPromises);

            const successfulUploads = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);

            const failedCount = results.filter(r => r.status === 'rejected').length;

            if (successfulUploads.length > 0) {
                setPhotos(prev => [...prev, ...successfulUploads]);
                toast.success(`${successfulUploads.length} photo${successfulUploads.length > 1 ? 's' : ''} uploaded`);
            }

            if (failedCount > 0) {
                toast.error(`${failedCount} photo${failedCount > 1 ? 's' : ''} failed to upload`);
            }
        } catch (error) {
            toast.error('Failed to upload photos');
            console.error(error);
        } finally {
            setUploading(false);
            // Reset input
            if (e.target) {
                e.target.value = '';
            }
        }
    }, [jobId, currentType, techId, techName, location, photos.length, maxPhotos]);

    // Remove a photo
    const handleRemovePhoto = (photoId) => {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
        toast.success('Photo removed');
    };

    // Update photo caption
    const handleCaptionChange = (photoId, caption) => {
        setPhotos(prev => prev.map(p =>
            p.id === photoId ? { ...p, caption } : p
        ));
    };

    // Check if minimum photos met
    const isComplete = photos.length >= minPhotos;

    // Handle done button
    const handleDone = () => {
        if (!isComplete) {
            toast.error(`Please add at least ${minPhotos} photo${minPhotos > 1 ? 's' : ''}`);
            return;
        }
        if (onComplete) {
            onComplete(photos);
        }
    };

    // ============================================
    // RENDER
    // ============================================

    if (compactMode) {
        return (
            <CompactPhotoCapture
                photos={photos}
                typeConfig={typeConfig}
                currentType={currentType}
                uploading={uploading}
                minPhotos={minPhotos}
                maxPhotos={maxPhotos}
                onCameraClick={() => cameraInputRef.current?.click()}
                onGalleryClick={() => fileInputRef.current?.click()}
                onRemove={handleRemovePhoto}
                onFileSelect={handleFileSelect}
                fileInputRef={fileInputRef}
                cameraInputRef={cameraInputRef}
            />
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${
                typeConfig.color === 'orange' ? 'from-orange-500 to-amber-500' :
                typeConfig.color === 'green' ? 'from-emerald-500 to-green-500' :
                typeConfig.color === 'blue' ? 'from-blue-500 to-indigo-500' :
                'from-red-500 to-rose-500'
            } px-5 py-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{typeConfig.icon}</span>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {typeConfig.label} Photos
                            </h3>
                            <p className="text-white/80 text-sm">
                                {typeConfig.description}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full">
                        <span className="text-white font-medium text-sm">
                            {photos.length}/{maxPhotos}
                        </span>
                    </div>
                </div>
            </div>

            {/* Type Selector (if allowed) */}
            {allowTypeChange && (
                <div className="px-5 py-3 bg-gray-50 border-b flex gap-2 overflow-x-auto">
                    {Object.entries(PHOTO_TYPE_CONFIG).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setCurrentType(key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                                currentType === key
                                    ? `bg-${config.color}-100 text-${config.color}-700 ring-2 ring-${config.color}-500`
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <span>{config.icon}</span>
                            {config.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Photo Grid */}
            <div className="p-5">
                {photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {photos.map((photo) => (
                            <PhotoCard
                                key={photo.id}
                                photo={photo}
                                onRemove={() => handleRemovePhoto(photo.id)}
                                onCaptionChange={(caption) => handleCaptionChange(photo.id, caption)}
                                onView={() => setSelectedPhoto(photo)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl mb-4">
                        <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No photos yet</p>
                        <p className="text-gray-400 text-sm mt-1">
                            Add at least {minPhotos} {typeConfig.label.toLowerCase()} photo{minPhotos > 1 ? 's' : ''}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                {photos.length < maxPhotos && (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-green-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                        >
                            {uploading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Camera className="w-5 h-5" />
                            )}
                            Take Photo
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
                        >
                            <ImageIcon className="w-5 h-5" />
                            From Gallery
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

                {/* Location Indicator */}
                {showGeoTag && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                        {location ? (
                            <>
                                <MapPin className="w-4 h-4 text-emerald-500" />
                                <span className="text-gray-500">Location captured</span>
                            </>
                        ) : locationError ? (
                            <>
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <span className="text-gray-400">{locationError}</span>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                <span className="text-gray-400">Getting location...</span>
                            </>
                        )}
                    </div>
                )}

                {/* Minimum Photos Indicator */}
                {!isComplete && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <p className="text-amber-800 text-sm font-medium">
                                {minPhotos - photos.length} more photo{minPhotos - photos.length > 1 ? 's' : ''} required
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {onComplete && (
                <div className="px-5 py-4 border-t bg-gray-50">
                    <button
                        onClick={handleDone}
                        disabled={!isComplete || uploading}
                        className={`w-full py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                            isComplete
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-gray-300 cursor-not-allowed'
                        }`}
                    >
                        <Check className="w-5 h-5" />
                        Done ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                    </button>
                </div>
            )}

            {/* Photo Viewer Modal */}
            {selectedPhoto && (
                <PhotoViewer
                    photo={selectedPhoto}
                    photos={photos}
                    onClose={() => setSelectedPhoto(null)}
                    onNavigate={setSelectedPhoto}
                />
            )}
        </div>
    );
};

// ============================================
// PHOTO CARD COMPONENT
// ============================================

const PhotoCard = ({ photo, onRemove, onCaptionChange, onView }) => {
    const [showCaption, setShowCaption] = useState(false);

    return (
        <div className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-square">
            <img
                src={photo.url}
                alt={photo.caption || 'Job photo'}
                className="w-full h-full object-cover cursor-pointer"
                onClick={onView}
            />

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
                {/* Remove button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                    <Trash2 className="w-4 h-4" />
                </button>

                {/* View button */}
                <button
                    onClick={onView}
                    className="absolute top-2 left-2 p-2 bg-white/90 text-gray-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
            </div>

            {/* Type badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                {showCaption ? (
                    <input
                        type="text"
                        value={photo.caption || ''}
                        onChange={(e) => onCaptionChange(e.target.value)}
                        onBlur={() => setShowCaption(false)}
                        placeholder="Add caption..."
                        autoFocus
                        className="w-full bg-white/90 text-gray-800 text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <p
                        className="text-white text-xs truncate cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); setShowCaption(true); }}
                    >
                        {photo.caption || 'Tap to add caption...'}
                    </p>
                )}
            </div>
        </div>
    );
};

// ============================================
// COMPACT PHOTO CAPTURE (For inline use)
// ============================================

const CompactPhotoCapture = ({
    photos,
    typeConfig,
    currentType,
    uploading,
    minPhotos,
    maxPhotos,
    onCameraClick,
    onGalleryClick,
    onRemove,
    onFileSelect,
    fileInputRef,
    cameraInputRef
}) => {
    const isComplete = photos.length >= minPhotos;

    return (
        <div className="space-y-3">
            {/* Photo thumbnails */}
            {photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {photos.map((photo) => (
                        <div
                            key={photo.id}
                            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden"
                        >
                            <img
                                src={photo.url}
                                alt="Job photo"
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => onRemove(photo.id)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
                <button
                    onClick={onCameraClick}
                    disabled={uploading || photos.length >= maxPhotos}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {uploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Camera className="w-5 h-5" />
                    )}
                    Camera
                </button>

                <button
                    onClick={onGalleryClick}
                    disabled={uploading || photos.length >= maxPhotos}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ImageIcon className="w-5 h-5" />
                    Gallery
                </button>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                    {photos.length}/{maxPhotos} photos
                </span>
                {!isComplete && (
                    <span className="text-amber-600 font-medium">
                        {minPhotos - photos.length} more required
                    </span>
                )}
                {isComplete && (
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Complete
                    </span>
                )}
            </div>

            {/* Hidden inputs */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileSelect}
                className="hidden"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={onFileSelect}
                className="hidden"
            />
        </div>
    );
};

// ============================================
// PHOTO VIEWER MODAL
// ============================================

const PhotoViewer = ({ photo, photos, onClose, onNavigate }) => {
    const currentIndex = photos.findIndex(p => p.id === photo.id);

    const goNext = () => {
        if (currentIndex < photos.length - 1) {
            onNavigate(photos[currentIndex + 1]);
        }
    };

    const goPrev = () => {
        if (currentIndex > 0) {
            onNavigate(photos[currentIndex - 1]);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-3 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-colors"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Navigation */}
            {currentIndex > 0 && (
                <button
                    onClick={goPrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}

            {currentIndex < photos.length - 1 && (
                <button
                    onClick={goNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-colors"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}

            {/* Image */}
            <img
                src={photo.url}
                alt={photo.caption || 'Job photo'}
                className="max-w-full max-h-full object-contain"
            />

            {/* Caption and info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="text-center">
                    {photo.caption && (
                        <p className="text-white text-lg mb-2">{photo.caption}</p>
                    )}
                    <p className="text-white/60 text-sm">
                        {currentIndex + 1} of {photos.length}
                        {photo.uploadedAt && (
                            <span className="ml-3">
                                {new Date(photo.uploadedAt).toLocaleString()}
                            </span>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default JobPhotoCapture;
