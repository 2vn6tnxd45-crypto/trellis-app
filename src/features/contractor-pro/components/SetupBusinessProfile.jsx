// src/features/contractor-pro/components/SetupBusinessProfile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { 
    Building2, MapPin, Phone, Shield, CheckCircle, 
    ArrowRight, ArrowLeft, Clock, DollarSign, Percent, 
    Edit2, Save
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

export const SetupBusinessProfile = ({ profile, onSave, saving }) => {
    // Determine contractorId from profile
    const contractorId = profile?.id || profile?.uid;
    const [step, setStep] = useState(1);
    const [isEditingHours, setIsEditingHours] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        // Profile Data
        companyName: profile?.profile?.companyName || '',
        phone: profile?.profile?.phone || '',
        address: profile?.profile?.address || '',
        licenseNumber: profile?.profile?.licenseNumber || '',
        logoUrl: profile?.profile?.logoUrl || null,
        
        // Operations Data
        defaultLaborWarranty: '', 
        defaultTaxRate: 8.75,
        defaultDepositValue: 15,
        
        // Working Hours (Editable)
        workingHours: DEFAULT_HOURS
    });
    
    // Refs for Google Maps
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    // --- Phone Formatter ---
    const formatPhoneNumber = (value) => {
        if (!value) return value;
        const phoneNumber = value.replace(/[^\d]/g, '');
        if (phoneNumber.length < 4) return phoneNumber;
        if (phoneNumber.length < 7) return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    };

    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData(prev => ({ ...prev, phone: formatted }));
    };

    // --- Google Maps Init ---
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
                    types: ['establishment', 'geocode'],
                    componentRestrictions: { country: 'us' },
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
            },
            scheduling: {
                defaultLaborWarranty: formData.defaultLaborWarranty,
                defaultTaxRate: parseFloat(formData.defaultTaxRate) || 0,
                defaultDepositValue: parseFloat(formData.defaultDepositValue) || 0,
                defaultDepositType: 'percentage',
                workingHours: formData.workingHours // Use edited hours
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
                            // === STEP 1: IDENTITY ===
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

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">License Number <span className="text-slate-400 font-normal">(Optional)</span></label>
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
                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Deposit Request</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="number"
                                                value={formData.defaultDepositValue}
                                                onChange={(e) => setFormData({ ...formData, defaultDepositValue: e.target.value })}
                                                className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Working Hours Section */}
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Clock className="text-emerald-600" size={20} />
                                            <span className="font-bold text-slate-800">Working Hours</span>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setIsEditingHours(!isEditingHours)}
                                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                        >
                                            {isEditingHours ? <Save size={14} /> : <Edit2 size={14} />}
                                            {isEditingHours ? 'Done' : 'Edit'}
                                        </button>
                                    </div>

                                    {!isEditingHours ? (
                                        // View Mode
                                        <div>
                                            <p className="text-sm text-slate-600">
                                                Standard schedule set. 
                                                {Object.values(formData.workingHours).some(d => d.enabled) 
                                                    ? ' Custom hours applied.' 
                                                    : ' No hours enabled.'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">Used for AI scheduling suggestions.</p>
                                        </div>
                                    ) : (
                                        // Edit Mode
                                        <div className="space-y-2">
                                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                                                <div key={day} className="flex items-center gap-2">
                                                    <div className="w-20 text-xs font-bold capitalize text-slate-600">{day}</div>
                                                    <input 
                                                        type="checkbox"
                                                        checked={formData.workingHours[day]?.enabled}
                                                        onChange={(e) => updateHours(day, 'enabled', e.target.checked)}
                                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                                    />
                                                    {formData.workingHours[day]?.enabled && (
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <input 
                                                                type="time" 
                                                                value={formData.workingHours[day]?.start}
                                                                onChange={(e) => updateHours(day, 'start', e.target.value)}
                                                                className="border border-slate-200 rounded px-1 py-0.5"
                                                            />
                                                            <span>-</span>
                                                            <input 
                                                                type="time" 
                                                                value={formData.workingHours[day]?.end}
                                                                onChange={(e) => updateHours(day, 'end', e.target.value)}
                                                                className="border border-slate-200 rounded px-1 py-0.5"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex gap-3 pt-2">
                            {step === 2 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="px-6 py-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            
                            <button
                                type="submit"
                                disabled={(step === 1 && !isStep1Complete) || saving}
                                className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
                            >
                                {saving ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                ) : step === 1 ? (
                                    <>
                                        Next: Operations
                                        <ArrowRight size={20} />
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        Complete Setup
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
