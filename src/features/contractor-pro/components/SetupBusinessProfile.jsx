// src/features/contractor-pro/components/SetupBusinessProfile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Building2, MapPin, Phone, Shield, CheckCircle } from 'lucide-react';
import { Logo } from '../../../components/common/Logo';
import { googleMapsApiKey } from '../../../config/constants';

export const SetupBusinessProfile = ({ profile, onSave, saving }) => {
    const [formData, setFormData] = useState({
        companyName: profile?.profile?.companyName || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
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
        onSave(formData);
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
