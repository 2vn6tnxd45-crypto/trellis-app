// src/features/contractor-pro/components/SetupBusinessProfile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
    Building2, MapPin, Phone, Shield, CheckCircle, 
    ArrowRight, ArrowLeft, Clock, DollarSign, Percent, 
    Edit2, Save, Briefcase, BadgeCheck, Award, CreditCard, Plus, X
} from 'lucide-react';
import { Logo } from '../../../components/common/Logo';
import { googleMapsApiKey } from '../../../config/constants';
import { LogoUpload } from './LogoUpload';

// Define defaults clearly at the top
const DEFAULT_HOURS = {
    monday: { enabled: true, start: '08:00', end: '17:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '14:00' },
    sunday: { enabled: false, start: '09:00', end: '14:00' }
};

const PAYMENT_METHOD_OPTIONS = [
    'Credit Card',
    'Debit Card', 
    'Check',
    'Cash',
    'Bank Transfer',
    'Financing Available'
];

export const SetupBusinessProfile = ({ profile, onSave, saving }) => {
    // Determine contractorId from profile
    const contractorId = profile?.id || profile?.uid;
    const [step, setStep] = useState(1);
    const [isEditingHours, setIsEditingHours] = useState(false);
    const [newCertification, setNewCertification] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        // Profile Data (Step 1)
        companyName: profile?.profile?.companyName || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        logoUrl: profile?.profile?.logoUrl || null,
        
        // NEW: Credentials (Step 1)
        yearsInBusiness: profile?.profile?.yearsInBusiness || '',
        insured: profile?.profile?.insured || false,
        bonded: profile?.profile?.bonded || false,
        certifications: profile?.profile?.certifications || [],
        paymentMethods: profile?.profile?.paymentMethods || ['Credit Card', 'Check'],
        
        // Operations Data (Step 2)
        defaultLaborWarranty: '', 
        defaultTaxRate: 8.75,
        defaultDepositValue: 15,
        
        // Working Hours (Editable)
        workingHours: profile?.scheduling?.workingHours || DEFAULT_HOURS
    });

    // --- Phone Formatting ---
    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData({ ...formData, phone: formatted });
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

        if (step === 1) loadGoogleMaps();
    }, [step]);

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

    // --- Navigation & Submission ---
    const handleNext = (e) => {
        e.preventDefault();
        if (step === 1) {
            if (formData.companyName && formData.phone && formData.address) {
                setStep(2);
            }
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        console.log("Submitting profile setup...");
        
        // Construct payload
        const finalData = {
            profile: {
                companyName: formData.companyName,
                phone: formData.phone,
                address: formData.address,
                licenseNumber: formData.licenseNumber,
                logoUrl: formData.logoUrl,
                // NEW: Credentials
                yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null,
                insured: formData.insured,
                bonded: formData.bonded,
                certifications: formData.certifications,
                paymentMethods: formData.paymentMethods,
            },
            scheduling: {
                defaultLaborWarranty: formData.defaultLaborWarranty,
                defaultTaxRate: parseFloat(formData.defaultTaxRate) || 0,
                defaultDepositValue: parseFloat(formData.defaultDepositValue) || 0,
                defaultDepositType: 'percentage',
                workingHours: formData.workingHours
            }
        };
        
        console.log("Payload:", finalData);
        if (onSave) {
            onSave(finalData);
        } else {
            console.error("onSave prop is missing!");
        }
    };

    // --- Working Hours Helpers ---
    const updateHours = (day, field, value) => {
        setFormData(prev => ({
            ...prev,
            workingHours: {
                ...prev.workingHours,
                [day]: {
                    ...prev.workingHours[day],
                    [field]: value
                }
            }
        }));
    };

    const isStep1Complete = formData.companyName && formData.phone && formData.address;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Logo className="h-8 w-8 text-emerald-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        {step === 1 ? 'Business Profile' : 'Operations & Defaults'}
                    </h1>
                    <p className="text-slate-500 mt-2">
                        {step === 1 
                            ? 'These details will appear on your quotes and invoices.'
                            : 'Set up your standard terms to save time later.'}
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Progress Bar */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ width: step === 1 ? '50%' : '100%' }}
                            ></div>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Step {step} of 2</span>
                    </div>

                    <form onSubmit={handleNext} className="p-8 space-y-6">
                        
                        {step === 1 ? (
                            // === STEP 1: IDENTITY & CREDENTIALS ===
                            <>
                                <LogoUpload 
                                    currentLogo={formData.logoUrl}
                                    onUpload={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                                    contractorId={contractorId}
                                />

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Company Name *</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={formData.companyName}
                                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                            placeholder="e.g. Acme Plumbing"
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Business Phone *</label>
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

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Business Address *</label>
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
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                            License # <span className="text-slate-400 font-normal">(Optional)</span>
                                        </label>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={formData.licenseNumber}
                                                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                                                placeholder="LIC-12345"
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                            Years in Business
                                        </label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.yearsInBusiness}
                                                onChange={(e) => setFormData({ ...formData, yearsInBusiness: e.target.value })}
                                                placeholder="e.g. 15"
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Insurance & Bonding */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Insurance & Bonding</label>
                                    <div className="flex flex-wrap gap-3">
                                        <label 
                                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                formData.insured 
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.insured}
                                                onChange={(e) => setFormData({ ...formData, insured: e.target.checked })}
                                                className="sr-only"
                                            />
                                            <Shield size={18} className={formData.insured ? 'text-emerald-600' : 'text-slate-400'} />
                                            <span className="font-medium">Fully Insured</span>
                                            {formData.insured && <CheckCircle size={16} className="text-emerald-600" />}
                                        </label>
                                        
                                        <label 
                                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                formData.bonded 
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.bonded}
                                                onChange={(e) => setFormData({ ...formData, bonded: e.target.checked })}
                                                className="sr-only"
                                            />
                                            <BadgeCheck size={18} className={formData.bonded ? 'text-emerald-600' : 'text-slate-400'} />
                                            <span className="font-medium">Bonded</span>
                                            {formData.bonded && <CheckCircle size={16} className="text-emerald-600" />}
                                        </label>
                                    </div>
                                </div>

                                {/* Certifications */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                        Certifications <span className="text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <div className="relative flex-1">
                                            <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={newCertification}
                                                onChange={(e) => setNewCertification(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                                                placeholder="e.g. EPA Certified, NATE Certified"
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addCertification}
                                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                        >
                                            <Plus size={18} className="text-slate-600" />
                                        </button>
                                    </div>
                                    {formData.certifications.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {formData.certifications.map((cert, idx) => (
                                                <span 
                                                    key={idx}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm"
                                                >
                                                    <Award size={14} />
                                                    {cert}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCertification(cert)}
                                                        className="ml-1 hover:text-red-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Methods */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                                        <CreditCard size={14} className="inline mr-1" />
                                        Accepted Payment Methods
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {PAYMENT_METHOD_OPTIONS.map(method => (
                                            <label 
                                                key={method}
                                                className={`px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                                                    formData.paymentMethods.includes(method)
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
                            </>
                        ) : (
                            // === STEP 2: OPERATIONS ===
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Standard Labor Warranty</label>
                                    <div className="relative">
                                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.defaultLaborWarranty}
                                            onChange={(e) => setFormData({ ...formData, defaultLaborWarranty: e.target.value })}
                                            placeholder="e.g., 1 Year Workmanship Guarantee"
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Default Tax Rate</label>
                                        <div className="relative">
                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.defaultTaxRate}
                                                onChange={(e) => setFormData({ ...formData, defaultTaxRate: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Default Deposit %</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={formData.defaultDepositValue}
                                                onChange={(e) => setFormData({ ...formData, defaultDepositValue: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Working Hours */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-bold text-slate-700">Working Hours</label>
                                        <button 
                                            type="button"
                                            onClick={() => setIsEditingHours(!isEditingHours)}
                                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
                                        >
                                            {isEditingHours ? <Save size={14} /> : <Edit2 size={14} />}
                                            {isEditingHours ? 'Done' : 'Edit'}
                                        </button>
                                    </div>
                                    
                                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                                        {Object.entries(formData.workingHours).map(([day, hours]) => (
                                            <div key={day} className="flex items-center gap-3">
                                                <span className="w-24 text-sm font-medium capitalize text-slate-600">
                                                    {day.slice(0, 3)}
                                                </span>
                                                
                                                {isEditingHours ? (
                                                    <>
                                                        <label className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={hours.enabled}
                                                                onChange={(e) => updateHours(day, 'enabled', e.target.checked)}
                                                                className="rounded text-emerald-600"
                                                            />
                                                        </label>
                                                        <input
                                                            type="time"
                                                            value={hours.start}
                                                            onChange={(e) => updateHours(day, 'start', e.target.value)}
                                                            disabled={!hours.enabled}
                                                            className="px-2 py-1 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
                                                        />
                                                        <span className="text-slate-400">–</span>
                                                        <input
                                                            type="time"
                                                            value={hours.end}
                                                            onChange={(e) => updateHours(day, 'end', e.target.value)}
                                                            disabled={!hours.enabled}
                                                            className="px-2 py-1 border border-slate-200 rounded-lg text-sm disabled:opacity-50"
                                                        />
                                                    </>
                                                ) : (
                                                    <span className={`text-sm ${hours.enabled ? 'text-slate-800' : 'text-slate-400'}`}>
                                                        {hours.enabled 
                                                            ? `${hours.start} – ${hours.end}` 
                                                            : 'Closed'}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Navigation */}
                        <div className="flex gap-3 pt-4">
                            {step === 2 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft size={18} />
                                    Back
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={step === 1 && !isStep1Complete}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 
                                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Saving...
                                    </span>
                                ) : step === 1 ? (
                                    <>
                                        Next
                                        <ArrowRight size={18} />
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={18} />
                                        Finish Setup
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Skip for now */}
                {step === 1 && (
                    <p className="text-center text-slate-400 text-sm mt-4">
                        You can update these details anytime in Settings
                    </p>
                )}
            </div>
        </div>
    );
};

export default SetupBusinessProfile;
