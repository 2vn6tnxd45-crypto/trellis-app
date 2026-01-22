// src/features/contractor-pro/components/ContractorProfileEditor.jsx
// ============================================
// CONTRACTOR PROFILE EDITOR
// ============================================
// Full profile editing component with all credential fields
// Can be used in Settings or as a standalone view

import React, { useState, useEffect, useRef } from 'react';
import {
    Building2, MapPin, Phone, Shield, CheckCircle, Save, Loader2,
    Briefcase, BadgeCheck, Award, CreditCard, Plus, X, Mail, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { googleMapsApiKey } from '../../../config/constants';
import { LogoUpload } from './LogoUpload';

const PAYMENT_METHOD_OPTIONS = [
    'Credit Card',
    'Debit Card',
    'Check',
    'Cash',
    'Bank Transfer',
    'Financing Available'
];

export const ContractorProfileEditor = ({ profile, onUpdateProfile }) => {
    const contractorId = profile?.id || profile?.uid;
    const [newCertification, setNewCertification] = useState('');
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        // Basic Info
        companyName: profile?.profile?.companyName || '',
        displayName: profile?.profile?.displayName || '',
        email: profile?.profile?.email || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        specialty: profile?.profile?.specialty || '',
        logoUrl: profile?.profile?.logoUrl || null,

        // Credentials
        yearsInBusiness: profile?.profile?.yearsInBusiness || '',
        insured: profile?.profile?.insured || false,
        bonded: profile?.profile?.bonded || false,
        certifications: profile?.profile?.certifications || [],
        paymentMethods: profile?.profile?.paymentMethods || [],
    });

    // Update form when profile changes
    useEffect(() => {
        if (profile) {
            setFormData({
                companyName: profile?.profile?.companyName || '',
                displayName: profile?.profile?.displayName || '',
                email: profile?.profile?.email || '',
                phone: profile?.profile?.phone || '',
                address: profile?.profile?.address || '',
                licenseNumber: profile?.profile?.licenseNumber || '',
                specialty: profile?.profile?.specialty || '',
                logoUrl: profile?.profile?.logoUrl || null,
                yearsInBusiness: profile?.profile?.yearsInBusiness || '',
                insured: profile?.profile?.insured || false,
                bonded: profile?.profile?.bonded || false,
                certifications: profile?.profile?.certifications || [],
                paymentMethods: profile?.profile?.paymentMethods || [],
            });
        }
    }, [profile]);

    // --- Phone Formatting ---
    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData(prev => ({ ...prev, phone: formatted }));
    };

    const formatPhoneNumber = (value) => {
        if (!value) return value;
        const phoneNumber = value.replace(/[^\d]/g, '');
        const len = phoneNumber.length;
        if (len < 4) return phoneNumber;
        if (len < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    };

    // --- Google Maps Autocomplete ---
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google?.maps?.places) {
                initAutocomplete();
                return;
            }
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
            if (existingScript) {
                existingScript.addEventListener('load', initAutocomplete);
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
                    types: ['address'],
                    componentRestrictions: { country: 'us' }
                });
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (place.formatted_address) {
                        setFormData(prev => ({ ...prev, address: place.formatted_address }));
                    }
                });
            } catch (err) {
                console.error('Autocomplete init error:', err);
            }
        };

        loadGoogleMaps();
    }, []);

    // --- Certification Management ---
    const addCertification = () => {
        if (newCertification.trim() && !formData.certifications.includes(newCertification.trim())) {
            setFormData(prev => ({
                ...prev,
                certifications: [...prev.certifications, newCertification.trim()]
            }));
            setNewCertification('');
        }
    };

    const removeCertification = (cert) => {
        setFormData(prev => ({
            ...prev,
            certifications: prev.certifications.filter(c => c !== cert)
        }));
    };

    // --- Payment Methods ---
    const togglePaymentMethod = (method) => {
        setFormData(prev => ({
            ...prev,
            paymentMethods: prev.paymentMethods.includes(method)
                ? prev.paymentMethods.filter(m => m !== method)
                : [...prev.paymentMethods, method]
        }));
    };

    // --- Save ---
    const handleSave = async () => {
        // Validation
        if (!formData.companyName?.trim()) return toast.error('Company Name is required');
        if (!formData.displayName?.trim()) return toast.error('Your Name is required');
        if (!formData.email?.trim()) return toast.error('Email is required');
        if (!formData.phone?.trim()) return toast.error('Phone number is required');

        // Basic Phone Validation (10 digits)
        const digits = formData.phone.replace(/\D/g, '');
        if (digits.length < 10) return toast.error('Please enter a valid 10-digit phone number');

        setSaving(true);
        try {
            await onUpdateProfile({
                ...formData,
                yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null,
            });
            toast.success('Profile updated!');
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Logo */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Company Logo</h3>
                <LogoUpload
                    currentLogo={formData.logoUrl}
                    onUpload={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                    contractorId={contractorId}
                />
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={formData.displayName}
                                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={handlePhoneChange}
                                maxLength={14}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                ref={addressInputRef}
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Start typing to search..."
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">License Number</label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                value={formData.licenseNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                                placeholder="LIC-12345"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Years in Business</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="number"
                                min="0"
                                value={formData.yearsInBusiness}
                                onChange={(e) => setFormData(prev => ({ ...prev, yearsInBusiness: e.target.value }))}
                                placeholder="e.g. 15"
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Specialty / Trade</label>
                        <input
                            type="text"
                            value={formData.specialty}
                            onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                            placeholder="e.g. HVAC, Plumbing, Electrical"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Insurance & Bonding */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Insurance & Bonding</h3>
                <p className="text-sm text-slate-500 mb-4">These badges will appear on your quotes to build customer trust.</p>

                <div className="flex flex-wrap gap-3">
                    <label
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${formData.insured
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <input
                            type="checkbox"
                            checked={formData.insured}
                            onChange={(e) => setFormData(prev => ({ ...prev, insured: e.target.checked }))}
                            className="sr-only"
                        />
                        <Shield size={18} className={formData.insured ? 'text-emerald-600' : 'text-slate-400'} />
                        <span className="font-medium">Fully Insured</span>
                        {formData.insured && <CheckCircle size={16} className="text-emerald-600" />}
                    </label>

                    <label
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${formData.bonded
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <input
                            type="checkbox"
                            checked={formData.bonded}
                            onChange={(e) => setFormData(prev => ({ ...prev, bonded: e.target.checked }))}
                            className="sr-only"
                        />
                        <BadgeCheck size={18} className={formData.bonded ? 'text-emerald-600' : 'text-slate-400'} />
                        <span className="font-medium">Bonded</span>
                        {formData.bonded && <CheckCircle size={16} className="text-emerald-600" />}
                    </label>
                </div>
            </div>

            {/* Certifications */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Certifications</h3>
                <p className="text-sm text-slate-500 mb-4">Add any professional certifications or licenses.</p>

                <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                        <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={newCertification}
                            onChange={(e) => setNewCertification(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                            placeholder="e.g. EPA Certified, NATE Certified, Master Plumber"
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={addCertification}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {formData.certifications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {formData.certifications.map((cert, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm"
                            >
                                <Award size={14} />
                                {cert}
                                <button
                                    type="button"
                                    onClick={() => removeCertification(cert)}
                                    className="ml-1 hover:text-red-600 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">No certifications added yet</p>
                )}
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Accepted Payment Methods</h3>
                <p className="text-sm text-slate-500 mb-4">Let customers know how they can pay you.</p>

                <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHOD_OPTIONS.map(method => (
                        <label
                            key={method}
                            className={`px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${formData.paymentMethods.includes(method)
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                        >
                            <input
                                type="checkbox"
                                checked={formData.paymentMethods.includes(method)}
                                onChange={() => togglePaymentMethod(method)}
                                className="sr-only"
                            />
                            {method}
                        </label>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 
                               disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Changes
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ContractorProfileEditor;
