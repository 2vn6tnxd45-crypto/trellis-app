// src/lib/fileValidation.js
// ============================================
// FILE VALIDATION UTILITIES
// ============================================
// Centralized file validation for consistent security

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    IMAGE: 10 * 1024 * 1024,      // 10MB for images
    VIDEO: 50 * 1024 * 1024,      // 50MB for videos
    DOCUMENT: 15 * 1024 * 1024,   // 15MB for PDFs/docs
    LOGO: 2 * 1024 * 1024,        // 2MB for logos
};

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
    IMAGE: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/heic',
        'image/heif',
    ],
    VIDEO: [
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo',
        'video/x-m4v',
    ],
    DOCUMENT: [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
    ],
};

// Magic bytes for file type verification
const MAGIC_BYTES = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
    pdf: [0x25, 0x50, 0x44, 0x46],  // %PDF
    mp4: [null, null, null, null, 0x66, 0x74, 0x79, 0x70], // ftyp at offset 4
};

/**
 * Validates file size against limit
 * @param {File} file - The file to validate
 * @param {number} maxSize - Maximum size in bytes
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateFileSize = (file, maxSize) => {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (file.size > maxSize) {
        const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
        const fileMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `File too large (${fileMB}MB). Maximum size is ${maxMB}MB.`
        };
    }

    return { valid: true };
};

/**
 * Validates file MIME type
 * @param {File} file - The file to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateFileType = (file, allowedTypes) => {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed types: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`
        };
    }

    return { valid: true };
};

/**
 * Validates file using magic bytes (async)
 * @param {File} file - The file to validate
 * @param {string} expectedType - Expected type: 'image' | 'video' | 'pdf'
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export const validateFileMagicBytes = async (file, expectedType) => {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    try {
        const buffer = await file.slice(0, 12).arrayBuffer();
        const bytes = new Uint8Array(buffer);

        if (expectedType === 'image') {
            // Check for common image magic bytes
            const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
            const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
            const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
            const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

            if (!isJpeg && !isPng && !isGif && !isWebp) {
                return { valid: false, error: 'File does not appear to be a valid image' };
            }
        } else if (expectedType === 'pdf') {
            const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
            if (!isPdf) {
                return { valid: false, error: 'File does not appear to be a valid PDF' };
            }
        } else if (expectedType === 'video') {
            // MP4/MOV files have 'ftyp' at offset 4
            const hasFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
            // WebM files start with EBML header
            const isWebm = bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3;

            if (!hasFtyp && !isWebm) {
                return { valid: false, error: 'File does not appear to be a valid video' };
            }
        }

        return { valid: true };
    } catch (error) {
        console.error('Magic bytes validation error:', error);
        return { valid: true }; // Fail open if we can't read the file
    }
};

/**
 * Complete file validation (size + type + magic bytes)
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @param {string} options.category - 'image' | 'video' | 'document' | 'logo'
 * @param {boolean} options.checkMagicBytes - Whether to verify magic bytes (default: true)
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
export const validateFile = async (file, options = {}) => {
    const { category = 'image', checkMagicBytes = true } = options;

    // Determine limits based on category
    let maxSize, allowedTypes, magicType;

    switch (category) {
        case 'video':
            maxSize = FILE_SIZE_LIMITS.VIDEO;
            allowedTypes = ALLOWED_MIME_TYPES.VIDEO;
            magicType = 'video';
            break;
        case 'document':
            maxSize = FILE_SIZE_LIMITS.DOCUMENT;
            allowedTypes = ALLOWED_MIME_TYPES.DOCUMENT;
            magicType = file.type === 'application/pdf' ? 'pdf' : 'image';
            break;
        case 'logo':
            maxSize = FILE_SIZE_LIMITS.LOGO;
            allowedTypes = ALLOWED_MIME_TYPES.IMAGE;
            magicType = 'image';
            break;
        case 'image':
        default:
            maxSize = FILE_SIZE_LIMITS.IMAGE;
            allowedTypes = ALLOWED_MIME_TYPES.IMAGE;
            magicType = 'image';
            break;
    }

    // Size validation
    const sizeResult = validateFileSize(file, maxSize);
    if (!sizeResult.valid) return sizeResult;

    // Type validation
    const typeResult = validateFileType(file, allowedTypes);
    if (!typeResult.valid) return typeResult;

    // Magic bytes validation (optional but recommended)
    if (checkMagicBytes) {
        const magicResult = await validateFileMagicBytes(file, magicType);
        if (!magicResult.valid) return magicResult;
    }

    return { valid: true };
};

/**
 * Validates multiple files
 * @param {File[]} files - Array of files to validate
 * @param {Object} options - Validation options (same as validateFile)
 * @returns {Promise<{ valid: boolean, errors: string[], validFiles: File[] }>}
 */
export const validateFiles = async (files, options = {}) => {
    const errors = [];
    const validFiles = [];

    for (const file of files) {
        const result = await validateFile(file, options);
        if (result.valid) {
            validFiles.push(file);
        } else {
            errors.push(`${file.name}: ${result.error}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        validFiles
    };
};
