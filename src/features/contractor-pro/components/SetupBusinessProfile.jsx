// src/features/contractor-pro/components/SetupBusinessProfile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Building2, MapPin, Phone, Shield, CheckCircle, Upload, X, Loader2 } from 'lucide-react';
import { Logo } from '../../../components/common/Logo';
import { googleMapsApiKey } from '../../../config/constants';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../config/firebase';
import { compressImage } from '../../../lib/images';
import toast from 'react-hot-toast';

// New Logo Upload Component with Fixes
const LogoUpload = ({ currentLogo, onUpload, contractorId }) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    
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
            console.error('[LogoUpload] Error code:', err.code);
            console.error('[LogoUpload] Error message:', err.message);
            toast.error(`Failed to upload logo: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };
    
    return (
        <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">
                Company Logo
            </label>
            <div className="flex items-center gap-4">
                {currentLogo ? (
                    <div className="relative group">
                        <img 
                            src={currentLogo} 
                            alt="Company Logo" 
                            className="w-20 h-20 rounded-xl object-contain bg-slate-50 border border-slate-200"
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
                        className={`w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 
                                   flex items-center justify-center cursor-pointer hover:border-emerald-500
                                   hover:bg-slate-50 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? (
                            <Loader2 className="animate-spin text-emerald-500" size={24} />
                        ) : (
                            <Upload size={24} className="text-slate-400" />
                        )}
                    </div>
                )}
                <div className="text-sm text-slate-500">
                    <p>PNG, JPG, or SVG</p>
                    <p className="text-xs text-slate-400">Max 2MB, 400×400px recommended</p>
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

export const SetupBusinessProfile = ({ profile, onSave, saving }) => {
    // Determine contractorId from profile if possible
    const contractorId = profile?.id || profile?.uid;

    const [formData, setFormData] = useState({
        companyName: profile?.profile?.companyName || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        logoUrl: profile?.profile?.logoUrl || null, // Ensure logoUrl is tracked
    });
    
    // Refs for Google Maps
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    // --- 1. Phone Number Standardization ---
    const formatPhoneNumber = (value) => {
        if (!value) return value;
        const phoneNumber = value.replace(/[^\d]/g, '');
        const phoneNumberLength = phoneNumber.length;
        if (phoneNumberLength < 4) return phoneNumber;
        if (phoneNumberLength < 7) {
            return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        }
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    };

    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData(prev => ({ ...prev, phone: formatted }));
    };

    // --- 2. Google Maps Address Selector ---
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
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!addressInputRef.current || autocompleteRef.current) return;
            
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                    types: ['establishment', 'geocode'], // Allow businesses or addresses
                    componentRestrictions: { country: 'us' },
                });

                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (place.formatted_address) {
                        setFormData(prev => ({ 
                            ...prev, 
                            address: place.formatted_address 
                        }));
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
        onSave({
            companyName: formData.companyName,
            phone: formData.phone,
            address: formData.address,
            licenseNumber: formData.licenseNumber,
            logoUrl: formData.logoUrl, // <-- Include logoUrl in submission
        });
    };

    const isComplete = formData.companyName && formData.phone && formData.address;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Logo className="h-8 w-8 text-emerald-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Complete Your Business Profile</h1>
                    <p className="text-slate-500 mt-2">
                        These details will appear on your quotes and invoices so customers know who they are hiring.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Progress Bar */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-1/2"></div>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Step 2 of 2</span>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        
                        {/* Logo Upload */}
                        <LogoUpload 
                            currentLogo={formData.logoUrl}
                            onUpload={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                            contractorId={contractorId}
                        />

                        {/* Company Name */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Company / Business Name *
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={formData.companyName}
                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    placeholder="e.g. Acme Plumbing & Heating"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Business Phone *
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    placeholder="(555) 123-4567"
                                    maxLength={14}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Address with Google Maps Autocomplete */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                Business Address *
                            </label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    ref={addressInputRef}
                                    type="text"
                                    required
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Start typing to search..."
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">This will be displayed on your official quotes.</p>
                        </div>

                        {/* License (Optional) */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                License Number <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={formData.licenseNumber}
                                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                                    placeholder="e.g. LIC-12345678"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!isComplete || saving}
                            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
                        >
                            {saving ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    Complete Setup
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
