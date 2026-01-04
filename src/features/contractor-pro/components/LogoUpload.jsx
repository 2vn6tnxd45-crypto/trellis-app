// src/features/contractor-pro/components/LogoUpload.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../config/firebase';
import { compressImage } from '../../../lib/images';
import toast from 'react-hot-toast';

export const LogoUpload = ({ currentLogo, onUpload, contractorId }) => {
    const [uploading, setUploading] = useState(false);
    const [imageError, setImageError] = useState(false); // Track load errors
    const fileInputRef = useRef(null);
    
    // Reset error when logo changes
    useEffect(() => {
        setImageError(false);
    }, [currentLogo]);
    
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
            toast.error('Please upload a PNG, JPG, or SVG file');
            return;
        }
        
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo must be under 2MB');
            return;
        }
        
        setUploading(true);
        setImageError(false);
        
        try {
            // Compress if not SVG
            const processedFile = file.type === 'image/svg+xml' 
                ? file 
                : await compressImage(file, 400, 0.8);
            
            // Ensure we have a valid contractor ID
            const pathId = contractorId;
            if (!pathId) {
                throw new Error('No contractor ID available for upload');
            }
            
            console.log('[LogoUpload] Uploading to path:', `contractors/${pathId}/logo_${Date.now()}`);
            const logoRef = ref(storage, `contractors/${pathId}/logo_${Date.now()}`);
            
            await uploadBytes(logoRef, processedFile);
            const logoUrl = await getDownloadURL(logoRef);
            
            console.log('[LogoUpload] Upload successful, URL:', logoUrl);
            onUpload(logoUrl);
            toast.success('Logo uploaded!');
        } catch (err) {
            console.error('[LogoUpload] Upload error:', err);
            toast.error(`Failed to upload logo: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };
    
    const handleImageError = (e) => {
        console.error('[LogoUpload] Failed to load image URL:', currentLogo);
        console.error('[LogoUpload] Browser error event:', e);
        setImageError(true);
    };
    
    return (
        <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">
                Company Logo
            </label>
            <div className="flex items-center gap-4">
                {currentLogo && !imageError ? (
                    <div className="relative group">
                        <img 
                            src={currentLogo} 
                            alt="Company Logo" 
                            className="w-20 h-20 rounded-xl object-contain bg-slate-50 border border-slate-200"
                            onError={handleImageError}
                            // REMOVED crossOrigin="anonymous" to prevent CORS blocks
                        />
                        <button
                            type="button"
                            onClick={() => onUpload(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <div 
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`w-20 h-20 rounded-xl border-2 border-dashed ${imageError ? 'border-red-300 bg-red-50' : 'border-slate-300'} 
                                   flex items-center justify-center cursor-pointer hover:border-emerald-500
                                   hover:bg-slate-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? (
                            <Loader2 className="animate-spin text-emerald-500" size={24} />
                        ) : imageError ? (
                            <div className="text-center">
                                <AlertCircle size={20} className="text-red-400 mx-auto" />
                                <span className="text-[10px] text-red-500 font-medium">Retry</span>
                            </div>
                        ) : (
                            <Upload size={24} className="text-slate-400" />
                        )}
                    </div>
                )}
                <div className="text-sm text-slate-500">
                    <p>PNG, JPG, or SVG</p>
                    <p className="text-xs text-slate-400">Max 2MB, 400×400px recommended</p>
                    {imageError && (
                        <p className="text-xs text-red-500 mt-1">
                            Failed to display image. Click box to try again.
                        </p>
                    )}
                </div>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    );
};

export default LogoUpload;
