// src/features/jobs/lib/jobPhotoService.js
// ============================================
// JOB PHOTO SERVICE
// ============================================
// Handles photo upload, validation, and sync for job documentation
// Supports before/after photos with configurable requirements

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    serverTimestamp,
    arrayUnion,
    writeBatch
} from 'firebase/firestore';
import { db, storage } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CONTRACTORS_COLLECTION_PATH, appId } from '../../../config/constants';

// Helper to get the correct contractor path
const getContractorPath = (contractorId) => `${CONTRACTORS_COLLECTION_PATH}/${contractorId}`;

// ============================================
// CONSTANTS
// ============================================

export const PHOTO_TYPES = {
    BEFORE: 'before',
    AFTER: 'after',
    PROGRESS: 'progress',
    ISSUE: 'issue'
};

export const DEFAULT_PHOTO_REQUIREMENTS = {
    beforePhotosRequired: true,
    minBeforePhotos: 1,
    afterPhotosRequired: true,
    minAfterPhotos: 1,
    syncToPropertyRecord: true
};

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
];

// ============================================
// UPLOAD FUNCTIONS
// ============================================

/**
 * Upload a job photo to Firebase Storage
 * @param {string} jobId - The job document ID
 * @param {File} file - The file to upload
 * @param {string} type - Photo type (before, after, progress, issue)
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Photo metadata with URL
 */
export const uploadJobPhoto = async (jobId, file, type = PHOTO_TYPES.AFTER, options = {}) => {
    console.log('[JobPhotoService] ===== uploadJobPhoto START =====');
    console.log('[JobPhotoService] Params:', { jobId, type, options });
    console.log('[JobPhotoService] File:', file ? { name: file.name, size: file.size, type: file.type } : 'NULL');

    // Validate file
    if (!file) {
        console.error('[JobPhotoService] No file provided');
        throw new Error('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
        console.error('[JobPhotoService] File too large:', file.size);
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file type (allow any image/* if specific check fails)
    if (!file.type.startsWith('image/')) {
        console.error('[JobPhotoService] Invalid file type:', file.type);
        throw new Error('Only image files are allowed');
    }

    try {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `jobs/${jobId}/photos/${type}/${timestamp}_${sanitizedName}`;
        console.log('[JobPhotoService] Storage path:', storagePath);

        console.log('[JobPhotoService] Creating storage reference...');
        console.log('[JobPhotoService] Storage object exists:', !!storage);
        const storageRef = ref(storage, storagePath);
        console.log('[JobPhotoService] Storage ref created:', !!storageRef);

        // Upload with metadata
        const metadata = {
            contentType: file.type,
            customMetadata: {
                type,
                uploadedAt: new Date().toISOString(),
                originalName: file.name,
                ...(options.techId && { techId: options.techId }),
                ...(options.techName && { techName: options.techName })
            }
        };
        console.log('[JobPhotoService] Upload metadata:', metadata);

        console.log('[JobPhotoService] Starting uploadBytes...');
        const uploadResult = await uploadBytes(storageRef, file, metadata);
        console.log('[JobPhotoService] uploadBytes completed:', {
            bytesTransferred: uploadResult?.metadata?.size,
            fullPath: uploadResult?.ref?.fullPath
        });

        console.log('[JobPhotoService] Getting download URL...');
        const url = await getDownloadURL(storageRef);
        console.log('[JobPhotoService] Download URL obtained:', url?.substring(0, 100) + '...');

        const photoData = {
            id: `photo_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            url,
            type,
            storagePath,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            caption: options.caption || '',
            uploadedAt: new Date().toISOString(),
            uploadedBy: options.techId || null,
            uploadedByName: options.techName || null,
            location: options.location || null // For geo-tagging if available
        };

        console.log('[JobPhotoService] Photo data created:', photoData);
        console.log('[JobPhotoService] ===== uploadJobPhoto SUCCESS =====');
        return photoData;
    } catch (error) {
        console.error('[JobPhotoService] ===== UPLOAD ERROR =====');
        console.error('[JobPhotoService] Error name:', error.name);
        console.error('[JobPhotoService] Error message:', error.message);
        console.error('[JobPhotoService] Error code:', error.code);
        console.error('[JobPhotoService] Error serverResponse:', error.serverResponse);
        console.error('[JobPhotoService] Full error:', error);
        console.error('[JobPhotoService] ===== END ERROR =====');
        throw new Error(`Failed to upload photo: ${error.message}`);
    }
};

/**
 * Upload multiple photos at once
 * @param {string} jobId - The job document ID
 * @param {File[]} files - Array of files to upload
 * @param {string} type - Photo type for all files
 * @param {object} options - Additional options
 * @returns {Promise<object[]>} - Array of photo metadata
 */
export const uploadMultiplePhotos = async (jobId, files, type, options = {}) => {
    const results = [];
    const errors = [];

    for (const file of files) {
        try {
            const result = await uploadJobPhoto(jobId, file, type, options);
            results.push(result);
        } catch (error) {
            errors.push({ fileName: file.name, error: error.message });
        }
    }

    return { uploaded: results, errors };
};

/**
 * Delete a job photo from storage
 * @param {string} storagePath - The storage path of the photo
 * @returns {Promise<boolean>} - Success status
 */
export const deleteJobPhoto = async (storagePath) => {
    if (!storagePath) {
        throw new Error('Storage path is required');
    }

    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
        return true;
    } catch (error) {
        // If file doesn't exist, consider it a success
        if (error.code === 'storage/object-not-found') {
            console.warn('[JobPhotoService] Photo already deleted:', storagePath);
            return true;
        }
        console.error('[JobPhotoService] Delete error:', error);
        throw new Error(`Failed to delete photo: ${error.message}`);
    }
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate photo requirements for a job action
 * @param {object[]} photos - Array of photos with type field
 * @param {object} requirements - Photo requirements config
 * @param {string} action - 'start' or 'complete'
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export const validatePhotoRequirements = (photos = [], requirements = {}, action = 'complete') => {
    const config = { ...DEFAULT_PHOTO_REQUIREMENTS, ...requirements };
    const errors = [];

    if (action === 'start') {
        // Validate before photos for starting a job
        if (config.beforePhotosRequired) {
            const beforePhotos = photos.filter(p => p.type === PHOTO_TYPES.BEFORE);
            if (beforePhotos.length < config.minBeforePhotos) {
                errors.push(
                    `At least ${config.minBeforePhotos} before photo${config.minBeforePhotos > 1 ? 's' : ''} required`
                );
            }
        }
    } else if (action === 'complete') {
        // Validate after photos for completing a job
        if (config.afterPhotosRequired) {
            const afterPhotos = photos.filter(p => p.type === PHOTO_TYPES.AFTER);
            if (afterPhotos.length < config.minAfterPhotos) {
                errors.push(
                    `At least ${config.minAfterPhotos} after photo${config.minAfterPhotos > 1 ? 's' : ''} required`
                );
            }
        }

        // Also validate before photos exist (if required and not already uploaded)
        if (config.beforePhotosRequired) {
            const beforePhotos = photos.filter(p => p.type === PHOTO_TYPES.BEFORE);
            if (beforePhotos.length < config.minBeforePhotos) {
                errors.push(
                    `At least ${config.minBeforePhotos} before photo${config.minBeforePhotos > 1 ? 's' : ''} required`
                );
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        summary: {
            before: photos.filter(p => p.type === PHOTO_TYPES.BEFORE).length,
            after: photos.filter(p => p.type === PHOTO_TYPES.AFTER).length,
            progress: photos.filter(p => p.type === PHOTO_TYPES.PROGRESS).length,
            issue: photos.filter(p => p.type === PHOTO_TYPES.ISSUE).length,
            total: photos.length
        }
    };
};

/**
 * Get photo requirements for a contractor
 * @param {string} contractorId - The contractor ID
 * @returns {Promise<object>} - Photo requirements config
 */
export const getPhotoRequirements = async (contractorId) => {
    try {
        const contractorRef = doc(db, getContractorPath(contractorId));
        const contractorSnap = await getDoc(contractorRef);

        if (!contractorSnap.exists()) {
            return DEFAULT_PHOTO_REQUIREMENTS;
        }

        const data = contractorSnap.data();
        return {
            ...DEFAULT_PHOTO_REQUIREMENTS,
            ...(data.photoSettings || {})
        };
    } catch (error) {
        console.error('[JobPhotoService] Error fetching requirements:', error);
        return DEFAULT_PHOTO_REQUIREMENTS;
    }
};

// ============================================
// JOB PHOTO MANAGEMENT
// ============================================

/**
 * Save photos to a job document
 * @param {string} jobId - The job document ID
 * @param {object[]} photos - Array of photo metadata
 * @param {string} phase - 'before', 'progress', 'completion'
 * @returns {Promise<void>}
 */
export const savePhotosToJob = async (jobId, photos, phase = 'completion') => {
    if (!jobId || !photos || photos.length === 0) {
        return;
    }

    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);

        const fieldName = phase === 'before' ? 'beforePhotos' :
                          phase === 'progress' ? 'progressPhotos' :
                          'completion.photos';

        if (phase === 'completion') {
            // For completion, we append to the existing completion.photos array
            await updateDoc(jobRef, {
                'completion.photos': arrayUnion(...photos),
                lastActivity: serverTimestamp()
            });
        } else {
            // For before/progress, we use top-level arrays
            await updateDoc(jobRef, {
                [fieldName]: arrayUnion(...photos),
                lastActivity: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('[JobPhotoService] Error saving photos to job:', error);
        throw error;
    }
};

/**
 * Get all photos for a job organized by type
 * @param {string} jobId - The job document ID
 * @returns {Promise<object>} - Photos organized by type
 */
export const getJobPhotos = async (jobId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const job = jobSnap.data();

        // Collect photos from various locations
        const beforePhotos = job.beforePhotos || [];
        const progressPhotos = job.progressPhotos || [];
        const completionPhotos = job.completion?.photos || [];

        // Also check for legacy photo arrays
        const allPhotos = [
            ...beforePhotos.map(p => ({ ...p, type: p.type || PHOTO_TYPES.BEFORE })),
            ...progressPhotos.map(p => ({ ...p, type: p.type || PHOTO_TYPES.PROGRESS })),
            ...completionPhotos.map(p => ({ ...p, type: p.type || PHOTO_TYPES.AFTER }))
        ];

        // Organize by type
        return {
            before: allPhotos.filter(p => p.type === PHOTO_TYPES.BEFORE),
            after: allPhotos.filter(p => p.type === PHOTO_TYPES.AFTER),
            progress: allPhotos.filter(p => p.type === PHOTO_TYPES.PROGRESS),
            issue: allPhotos.filter(p => p.type === PHOTO_TYPES.ISSUE),
            all: allPhotos
        };
    } catch (error) {
        console.error('[JobPhotoService] Error getting job photos:', error);
        throw error;
    }
};

// ============================================
// PROPERTY RECORD SYNC
// ============================================

/**
 * Sync job photos to the homeowner's property record
 * Called when job is completed/approved
 * @param {string} jobId - The job document ID
 * @param {string} userId - The homeowner's user ID
 * @param {string} propertyId - The property ID
 * @returns {Promise<object>} - Sync result
 */
export const syncPhotosToPropertyRecord = async (jobId, userId, propertyId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const job = jobSnap.data();

        // Collect all photos
        const allPhotos = [
            ...(job.beforePhotos || []),
            ...(job.progressPhotos || []),
            ...(job.completion?.photos || [])
        ];

        if (allPhotos.length === 0) {
            return { success: true, photoCount: 0 };
        }

        // Create a document reference for property photos
        const propertyPhotosRef = collection(
            db,
            'artifacts', appId,
            'users', userId,
            'properties', propertyId,
            'photos'
        );

        const batch = writeBatch(db);
        let count = 0;

        for (const photo of allPhotos) {
            const photoDocRef = doc(propertyPhotosRef);
            batch.set(photoDocRef, {
                url: photo.url,
                type: photo.type,
                caption: photo.caption || '',
                sourceJobId: jobId,
                sourceJobTitle: job.title || job.description || 'Service',
                uploadedAt: photo.uploadedAt || new Date().toISOString(),
                syncedAt: serverTimestamp(),
                contractor: job.contractorName || (typeof job.contractor === 'string' ? job.contractor : job.contractor?.companyName || job.contractor?.name || ''),
                contractorId: job.contractorId || null
            });
            count++;
        }

        // Also update the property's main photo if it doesn't have one
        if (allPhotos.length > 0) {
            const afterPhoto = allPhotos.find(p => p.type === PHOTO_TYPES.AFTER);
            if (afterPhoto) {
                const propertyRef = doc(
                    db,
                    'artifacts', appId,
                    'users', userId,
                    'properties', propertyId
                );

                const propertySnap = await getDoc(propertyRef);
                if (propertySnap.exists() && !propertySnap.data().imageUrl) {
                    batch.update(propertyRef, {
                        imageUrl: afterPhoto.url,
                        imageUpdatedAt: serverTimestamp()
                    });
                }
            }
        }

        await batch.commit();

        // Mark job as photos synced
        await updateDoc(jobRef, {
            photosSyncedToProperty: true,
            photosSyncedAt: serverTimestamp()
        });

        return { success: true, photoCount: count };
    } catch (error) {
        console.error('[JobPhotoService] Error syncing to property:', error);
        throw error;
    }
};

// ============================================
// JOB START WITH PHOTOS
// ============================================

/**
 * Start a job with before photos
 * @param {string} jobId - The job document ID
 * @param {object[]} beforePhotos - Array of before photo metadata
 * @param {string} techId - The technician's ID
 * @param {string} techName - The technician's name
 * @returns {Promise<object>} - Result
 */
export const startJobWithPhotos = async (jobId, beforePhotos, techId, techName) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }

        const job = jobSnap.data();

        // Validate job status
        if (!['scheduled', 'pending_schedule'].includes(job.status)) {
            throw new Error(`Cannot start job with status: ${job.status}`);
        }

        // Get photo requirements
        const requirements = job.contractorId
            ? await getPhotoRequirements(job.contractorId)
            : DEFAULT_PHOTO_REQUIREMENTS;

        // Validate before photos if required
        if (requirements.beforePhotosRequired) {
            const validation = validatePhotoRequirements(beforePhotos, requirements, 'start');
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }
        }

        // Update job to in_progress with before photos
        await updateDoc(jobRef, {
            status: 'in_progress',
            beforePhotos: beforePhotos || [],
            startedAt: serverTimestamp(),
            startedBy: techId || null,
            startedByName: techName || null,
            lastActivity: serverTimestamp()
        });

        return {
            success: true,
            jobId,
            status: 'in_progress',
            photoCount: beforePhotos?.length || 0
        };
    } catch (error) {
        console.error('[JobPhotoService] Error starting job:', error);
        throw error;
    }
};

// ============================================
// IMAGE COMPRESSION (Client-side helper)
// ============================================

/**
 * Compress an image file before upload
 * @param {File} file - The original file
 * @param {object} options - Compression options
 * @returns {Promise<Blob>} - Compressed image blob
 */
export const compressImage = async (file, options = {}) => {
    console.log('[JobPhotoService] ===== compressImage START =====');
    console.log('[JobPhotoService] Input file:', { name: file?.name, size: file?.size, type: file?.type });
    console.log('[JobPhotoService] Options:', options);

    const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.85,
        type = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            console.log('[JobPhotoService] Image loaded:', { originalWidth: img.width, originalHeight: img.height });

            let { width, height } = img;

            // Calculate new dimensions
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                console.log('[JobPhotoService] Resizing to:', { width, height, ratio });
            } else {
                console.log('[JobPhotoService] No resize needed, dimensions within limits');
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            console.log('[JobPhotoService] Drawing to canvas...');
            ctx.drawImage(img, 0, 0, width, height);

            console.log('[JobPhotoService] Converting to blob with type:', type, 'quality:', quality);
            canvas.toBlob(
                (blob) => {
                    // Clean up the object URL
                    URL.revokeObjectURL(img.src);

                    if (blob) {
                        console.log('[JobPhotoService] Compression successful:', { blobSize: blob.size, blobType: blob.type });
                        console.log('[JobPhotoService] ===== compressImage SUCCESS =====');
                        resolve(blob);
                    } else {
                        console.error('[JobPhotoService] toBlob returned null');
                        reject(new Error('Failed to compress image - toBlob returned null'));
                    }
                },
                type,
                quality
            );
        };

        img.onerror = (error) => {
            console.error('[JobPhotoService] Failed to load image:', error);
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image for compression'));
        };

        console.log('[JobPhotoService] Creating object URL for file...');
        const objectUrl = URL.createObjectURL(file);
        console.log('[JobPhotoService] Object URL created:', objectUrl);
        img.src = objectUrl;
    });
};

/**
 * Convert HEIC/HEIF to JPEG
 * Requires heic2any library to be loaded
 * @param {File} file - The HEIC file
 * @returns {Promise<Blob>} - JPEG blob
 */
export const convertHeicToJpeg = async (file) => {
    // Check if heic2any is available
    if (typeof window !== 'undefined' && window.heic2any) {
        try {
            const blob = await window.heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.9
            });
            return blob;
        } catch (error) {
            console.error('[JobPhotoService] HEIC conversion error:', error);
            throw new Error('Failed to convert HEIC image');
        }
    }

    // If heic2any not available, return original
    // (will work if browser supports HEIC natively)
    return file;
};

// ============================================
// EXPORTS
// ============================================

export default {
    uploadJobPhoto,
    uploadMultiplePhotos,
    deleteJobPhoto,
    validatePhotoRequirements,
    getPhotoRequirements,
    savePhotosToJob,
    getJobPhotos,
    syncPhotosToPropertyRecord,
    startJobWithPhotos,
    compressImage,
    convertHeicToJpeg,
    PHOTO_TYPES,
    DEFAULT_PHOTO_REQUIREMENTS
};
