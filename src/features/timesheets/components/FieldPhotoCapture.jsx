// src/features/timesheets/components/FieldPhotoCapture.jsx
// ============================================
// FIELD PHOTO CAPTURE COMPONENT
// ============================================
// Streamlined photo capture for field technicians
// Optimized for mobile workflow: before, progress, and after photos

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Camera, Image as ImageIcon, X, Plus, Trash2, Check, Loader2,
    MapPin, AlertCircle, ChevronLeft, ChevronRight, ZoomIn,
    Upload, Sparkles, Wrench, AlertTriangle
} from 'lucide-react';
import {
    uploadJobPhoto,
    uploadMultiplePhotos,
    compressImage,
    convertHeicToJpeg,
    PHOTO_TYPES,
    getPhotoRequirements,
    validatePhotoRequirements,
    savePhotosToJob
} from '../../jobs/lib/jobPhotoService';
import toast from 'react-hot-toast';

// ============================================
// PHOTO TYPE CONFIG
// ============================================

const FIELD_PHOTO_TYPES = {
    [PHOTO_TYPES.BEFORE]: {
        label: 'Before',
        shortLabel: 'Before',
        icon: Camera,
        emoji: '📷',
        color: 'orange',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-300',
        description: 'Current state before work'
    },
    [PHOTO_TYPES.PROGRESS]: {
        label: 'In Progress',
        shortLabel: 'Progress',
        icon: Wrench,
        emoji: '🔧',
        color: 'blue',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-300',
        description: 'Work in progress'
    },
    [PHOTO_TYPES.AFTER]: {
        label: 'After',
        shortLabel: 'After',
        icon: Sparkles,
        emoji: '✨',
        color: 'emerald',
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-300',
        description: 'Completed work'
    },
    [PHOTO_TYPES.ISSUE]: {
        label: 'Issue',
        shortLabel: 'Issue',
        icon: AlertTriangle,
        emoji: '⚠️',
        color: 'red',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-300',
        description: 'Problem documentation'
    }
};

// ============================================
// PHOTO THUMBNAIL COMPONENT
// ============================================

const PhotoThumbnail = ({ photo, onRemove, onView, isUploading }) => {
    return (
        <div className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200">
            {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                    <Loader2 size={24} className="animate-spin text-emerald-500" />
                </div>
            ) : (
                <>
                    <img
                        src={photo.url || photo.preview}
                        alt="Job photo"
                        className="w-full h-full object-cover"
                        onClick={() => onView?.(photo)}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                    {/* Type badge */}
                    {photo.type && FIELD_PHOTO_TYPES[photo.type] && (
                        <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${FIELD_PHOTO_TYPES[photo.type].bgColor} ${FIELD_PHOTO_TYPES[photo.type].textColor}`}>
                            {FIELD_PHOTO_TYPES[photo.type].shortLabel}
                        </span>
                    )}

                    {/* Remove button */}
                    {onRemove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(photo); }}
                            className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                            <X size={12} />
                        </button>
                    )}

                    {/* View/zoom button */}
                    <button
                        onClick={() => onView?.(photo)}
                        className="absolute bottom-1 right-1 p-1.5 bg-white/80 text-slate-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    >
                        <ZoomIn size={12} />
                    </button>
                </>
            )}
        </div>
    );
};

// ============================================
// PHOTO VIEWER MODAL
// ============================================

const PhotoViewerModal = ({ photo, photos, onClose, onPrev, onNext }) => {
    if (!photo) return null;

    const currentIndex = photos.findIndex(p => p.id === photo.id || p.preview === photo.preview);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < photos.length - 1;

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col" onClick={onClose}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50">
                <div className="flex items-center gap-2">
                    {photo.type && FIELD_PHOTO_TYPES[photo.type] && (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${FIELD_PHOTO_TYPES[photo.type].bgColor} ${FIELD_PHOTO_TYPES[photo.type].textColor}`}>
                            {FIELD_PHOTO_TYPES[photo.type].emoji} {FIELD_PHOTO_TYPES[photo.type].label}
                        </span>
                    )}
                    <span className="text-white/70 text-sm">
                        {currentIndex + 1} of {photos.length}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Image */}
            <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                <img
                    src={photo.url || photo.preview}
                    alt="Full size"
                    className="max-w-full max-h-full object-contain"
                />
            </div>

            {/* Navigation */}
            {photos.length > 1 && (
                <div className="flex items-center justify-between p-4">
                    <button
                        onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                        disabled={!hasPrev}
                        className="p-3 bg-white/20 text-white rounded-full disabled:opacity-30 hover:bg-white/30 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                        disabled={!hasNext}
                        className="p-3 bg-white/20 text-white rounded-full disabled:opacity-30 hover:bg-white/30 transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            )}

            {/* Caption */}
            {photo.caption && (
                <div className="p-4 bg-black/50">
                    <p className="text-white text-center">{photo.caption}</p>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN FIELD PHOTO CAPTURE COMPONENT
// ============================================

export const FieldPhotoCapture = ({
    jobId,
    contractorId,
    techId,
    techName,
    photoType = PHOTO_TYPES.AFTER,
    minPhotos = 0,
    maxPhotos = 10,
    existingPhotos = [],
    onPhotosChange,
    onComplete,
    showTypeSelector = true,
    autoUpload = true,
    compact = false
}) => {
    const [photos, setPhotos] = useState(existingPhotos);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [currentType, setCurrentType] = useState(photoType);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [viewingPhoto, setViewingPhoto] = useState(null);
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const typeConfig = FIELD_PHOTO_TYPES[currentType];

    // Get current location for geo-tagging
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    });
                },
                (err) => {
                    console.warn('[FieldPhotoCapture] Location error:', err.message);
                    setLocationError('Location unavailable');
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, []);

    // Notify parent of changes
    useEffect(() => {
        onPhotosChange?.(photos);
    }, [photos, onPhotosChange]);

    // Process a file (compress, convert HEIC, etc.)
    const processFile = async (file) => {
        let processedFile = file;

        // Convert HEIC if needed
        if (file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') ||
            file.name.toLowerCase().endsWith('.heif')) {
            try {
                const converted = await convertHeicToJpeg(file);
                processedFile = new File([converted], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
                    type: 'image/jpeg'
                });
            } catch (e) {
                console.warn('[FieldPhotoCapture] HEIC conversion failed');
            }
        }

        // Compress image
        const compressed = await compressImage(processedFile, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.85
        });

        return new File([compressed], processedFile.name, { type: 'image/jpeg' });
    };

    // Handle file selection
    const handleFileSelect = async (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        // Check max photos
        const availableSlots = maxPhotos - photos.length;
        if (files.length > availableSlots) {
            toast.error(`Maximum ${maxPhotos} photos allowed`);
            return;
        }

        // Create preview entries
        const newPending = files.map(file => ({
            id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview: URL.createObjectURL(file),
            type: currentType,
            isUploading: false
        }));

        setPendingFiles(prev => [...prev, ...newPending]);

        // Auto upload if enabled
        if (autoUpload) {
            await uploadPendingPhotos([...pendingFiles, ...newPending]);
        }

        // Reset input
        event.target.value = '';
    };

    // Upload pending photos
    const uploadPendingPhotos = async (pending = pendingFiles) => {
        if (pending.length === 0) return;

        setUploading(true);
        setUploadProgress(0);

        const uploadedPhotos = [];
        let completed = 0;

        for (const item of pending) {
            try {
                // Mark as uploading
                setPendingFiles(prev =>
                    prev.map(p => p.id === item.id ? { ...p, isUploading: true } : p)
                );

                // Process file
                const processedFile = await processFile(item.file);

                // Upload
                const result = await uploadJobPhoto(jobId, processedFile, item.type, {
                    techId,
                    techName,
                    location
                });

                if (result.success) {
                    uploadedPhotos.push({
                        id: result.photoId,
                        url: result.url,
                        type: item.type,
                        storagePath: result.storagePath,
                        uploadedAt: new Date().toISOString(),
                        uploadedBy: techId,
                        uploadedByName: techName,
                        location
                    });
                }

                completed++;
                setUploadProgress(Math.round((completed / pending.length) * 100));
            } catch (error) {
                console.error('[FieldPhotoCapture] Upload error:', error);
                toast.error(`Failed to upload ${item.file.name}`);
            }
        }

        // Update state
        setPhotos(prev => [...prev, ...uploadedPhotos]);
        setPendingFiles([]);
        setUploading(false);
        setUploadProgress(0);

        if (uploadedPhotos.length > 0) {
            toast.success(`${uploadedPhotos.length} photo${uploadedPhotos.length > 1 ? 's' : ''} uploaded`);
        }
    };

    // Remove a photo
    const handleRemovePhoto = (photo) => {
        if (photo.id?.startsWith('pending_')) {
            // Remove pending
            setPendingFiles(prev => prev.filter(p => p.id !== photo.id));
            URL.revokeObjectURL(photo.preview);
        } else {
            // Remove uploaded
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
        }
    };

    // View photo in fullscreen
    const handleViewPhoto = (photo) => {
        setViewingPhoto(photo);
    };

    // Navigate photos in viewer
    const allPhotos = [...photos, ...pendingFiles.filter(p => !p.isUploading)];
    const viewerIndex = viewingPhoto ? allPhotos.findIndex(p =>
        p.id === viewingPhoto.id || p.preview === viewingPhoto.preview
    ) : -1;

    const handlePrevPhoto = () => {
        if (viewerIndex > 0) {
            setViewingPhoto(allPhotos[viewerIndex - 1]);
        }
    };

    const handleNextPhoto = () => {
        if (viewerIndex < allPhotos.length - 1) {
            setViewingPhoto(allPhotos[viewerIndex + 1]);
        }
    };

    // Complete handler
    const handleComplete = async () => {
        // Upload any remaining pending
        if (pendingFiles.length > 0) {
            await uploadPendingPhotos();
        }

        // Save to job
        if (photos.length > 0) {
            await savePhotosToJob(jobId, photos, currentType);
        }

        onComplete?.(photos);
    };

    // Get photos by type
    const getPhotosByType = (type) => {
        return [...photos, ...pendingFiles].filter(p => p.type === type);
    };

    // Compact mode - inline thumbnail grid
    if (compact) {
        return (
            <div className="space-y-2">
                {/* Photo count indicator */}
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${typeConfig.textColor}`}>
                        {typeConfig.emoji} {typeConfig.label} Photos
                    </span>
                    <span className="text-xs text-slate-500">
                        {photos.length}/{maxPhotos}
                    </span>
                </div>

                {/* Thumbnail grid */}
                <div className="flex flex-wrap gap-2">
                    {[...photos, ...pendingFiles].map((photo) => (
                        <div key={photo.id} className="w-16 h-16">
                            <PhotoThumbnail
                                photo={photo}
                                onRemove={handleRemovePhoto}
                                onView={handleViewPhoto}
                                isUploading={photo.isUploading}
                            />
                        </div>
                    ))}

                    {/* Add button */}
                    {photos.length + pendingFiles.length < maxPhotos && (
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            className={`w-16 h-16 rounded-xl border-2 border-dashed ${typeConfig.borderColor} ${typeConfig.bgColor} flex items-center justify-center hover:opacity-80 transition-opacity`}
                        >
                            <Plus size={20} className={typeConfig.textColor} />
                        </button>
                    )}
                </div>

                {/* Hidden inputs */}
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {/* Photo viewer */}
                {viewingPhoto && (
                    <PhotoViewerModal
                        photo={viewingPhoto}
                        photos={allPhotos}
                        onClose={() => setViewingPhoto(null)}
                        onPrev={handlePrevPhoto}
                        onNext={handleNextPhoto}
                    />
                )}
            </div>
        );
    }

    // Full mode
    return (
        <div className="space-y-4">
            {/* Type selector */}
            {showTypeSelector && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {Object.entries(FIELD_PHOTO_TYPES).map(([type, config]) => {
                        const count = getPhotosByType(type).length;
                        const isActive = currentType === type;
                        const Icon = config.icon;

                        return (
                            <button
                                key={type}
                                onClick={() => setCurrentType(type)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                                    isActive
                                        ? `${config.bgColor} ${config.textColor} ring-2 ring-offset-1 ring-${config.color}-400`
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <Icon size={16} />
                                {config.shortLabel}
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/50' : 'bg-slate-200'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Current type header */}
            <div className={`p-3 rounded-xl ${typeConfig.bgColor} ${typeConfig.borderColor} border-2`}>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{typeConfig.emoji}</span>
                    <div>
                        <p className={`font-bold ${typeConfig.textColor}`}>{typeConfig.label} Photos</p>
                        <p className="text-xs text-slate-600">{typeConfig.description}</p>
                    </div>
                </div>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-3 gap-3">
                {[...photos, ...pendingFiles]
                    .filter(p => p.type === currentType)
                    .map((photo) => (
                        <PhotoThumbnail
                            key={photo.id}
                            photo={photo}
                            onRemove={handleRemovePhoto}
                            onView={handleViewPhoto}
                            isUploading={photo.isUploading}
                        />
                    ))}

                {/* Add photo buttons */}
                {photos.filter(p => p.type === currentType).length + pendingFiles.filter(p => p.type === currentType).length < maxPhotos && (
                    <>
                        {/* Camera button */}
                        <button
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={uploading}
                            className={`aspect-square rounded-xl border-2 border-dashed ${typeConfig.borderColor} ${typeConfig.bgColor} flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-50`}
                        >
                            <Camera size={24} className={typeConfig.textColor} />
                            <span className={`text-xs font-medium ${typeConfig.textColor}`}>Camera</span>
                        </button>

                        {/* Gallery button */}
                        <button
                            onClick={() => galleryInputRef.current?.click()}
                            disabled={uploading}
                            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition-colors disabled:opacity-50"
                        >
                            <ImageIcon size={24} className="text-slate-500" />
                            <span className="text-xs font-medium text-slate-500">Gallery</span>
                        </button>
                    </>
                )}
            </div>

            {/* Upload progress */}
            {uploading && (
                <div className="bg-emerald-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-emerald-700">Uploading photos...</span>
                        <span className="text-sm text-emerald-600">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Location indicator */}
            {location && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={12} />
                    <span>Location tagged ({location.accuracy.toFixed(0)}m accuracy)</span>
                </div>
            )}
            {locationError && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertCircle size={12} />
                    <span>{locationError} - photos will not be geo-tagged</span>
                </div>
            )}

            {/* Min photos warning */}
            {minPhotos > 0 && photos.filter(p => p.type === currentType).length < minPhotos && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                        At least {minPhotos} {currentType.toLowerCase()} photo{minPhotos > 1 ? 's' : ''} required
                    </p>
                </div>
            )}

            {/* Hidden file inputs */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
            />
            <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Complete button */}
            {onComplete && (
                <button
                    onClick={handleComplete}
                    disabled={uploading || (minPhotos > 0 && photos.filter(p => p.type === currentType).length < minPhotos)}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                    {uploading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Check size={18} />
                            Done ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                        </>
                    )}
                </button>
            )}

            {/* Photo viewer modal */}
            {viewingPhoto && (
                <PhotoViewerModal
                    photo={viewingPhoto}
                    photos={allPhotos}
                    onClose={() => setViewingPhoto(null)}
                    onPrev={handlePrevPhoto}
                    onNext={handleNextPhoto}
                />
            )}
        </div>
    );
};

// ============================================
// PHOTO CAPTURE MODAL
// ============================================

export const FieldPhotoCaptureModal = ({
    isOpen,
    onClose,
    jobId,
    contractorId,
    techId,
    techName,
    photoType,
    title,
    subtitle,
    minPhotos = 0,
    existingPhotos = [],
    onComplete
}) => {
    const [photos, setPhotos] = useState(existingPhotos);

    if (!isOpen) return null;

    const handleComplete = async (capturedPhotos) => {
        setPhotos(capturedPhotos);
        onComplete?.(capturedPhotos);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div>
                        <h2 className="font-bold text-slate-800">{title || 'Capture Photos'}</h2>
                        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    <FieldPhotoCapture
                        jobId={jobId}
                        contractorId={contractorId}
                        techId={techId}
                        techName={techName}
                        photoType={photoType}
                        minPhotos={minPhotos}
                        existingPhotos={photos}
                        onPhotosChange={setPhotos}
                        onComplete={handleComplete}
                        showTypeSelector={!photoType}
                    />
                </div>
            </div>
        </div>
    );
};

export default FieldPhotoCapture;
