// src/features/marketplace/components/ServiceRequestCreator.jsx
// ============================================
// SERVICE REQUEST CREATOR
// ============================================
// "Send up a flare" - Homeowner creates a broadcast request
// for contractors in their area. Free, competitive bidding.

import React, { useState, useRef } from 'react';
import { 
    Megaphone, MapPin, Clock, DollarSign, Camera, X, Upload,
    Shield, Award, AlertTriangle, ChevronRight, ChevronLeft,
    Thermometer, Droplet, Zap, Home, Wrench, HelpCircle,
    Sparkles, Check, Loader2
} from 'lucide-react';
import { 
    SERVICE_CATEGORIES, 
    URGENCY_LEVELS, 
    createServiceRequest 
} from '../lib/serviceRequestService';

// Icon mapping for categories
const CATEGORY_ICONS = {
    hvac: Thermometer,
    plumbing: Droplet,
    electrical: Zap,
    roofing: Home,
    handyman: Wrench,
    cleaning: Sparkles,
    other: HelpCircle
};

const ServiceRequestCreator = ({ 
    userId, 
    property, 
    onSuccess, 
    onCancel 
}) => {
    // Multi-step form state
    const [step, setStep] = useState(1);
    const totalSteps = 4;
    
    // Form data
    const [category, setCategory] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState(URGENCY_LEVELS.THIS_WEEK);
    const [photos, setPhotos] = useState([]);
    const [budgetMin, setBudgetMin] = useState('');
    const [budgetMax, setBudgetMax] = useState('');
    const [showBudget, setShowBudget] = useState(false);
    
    // Requirements
    const [mustBeInsured, setMustBeInsured] = useState(false);
    const [mustBeLicensed, setMustBeLicensed] = useState(false);
    
    // Contact preferences
    const [allowCalls, setAllowCalls] = useState(true);
    const [allowTexts, setAllowTexts] = useState(true);
    const [allowMessages, setAllowMessages] = useState(true);
    
    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    
    // Derived values
    const zipCode = property?.address?.zip || property?.zip || '';
    const city = property?.address?.city || property?.city || '';
    const state = property?.address?.state || property?.state || '';
    
    // ============================================
    // PHOTO HANDLING
    // ============================================
    
    const handlePhotoUpload = (e) => {
        const files = Array.from(e.target.files);
        const maxPhotos = 5;
        
        if (photos.length + files.length > maxPhotos) {
            setError(`Maximum ${maxPhotos} photos allowed`);
            return;
        }
        
        files.forEach(file => {
            if (!file.type.startsWith('image/')) {
                setError('Please upload only images');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                setPhotos(prev => [...prev, {
                    file,
                    preview: event.target.result,
                    name: file.name
                }]);
            };
            reader.readAsDataURL(file);
        });
        
        setError(null);
    };
    
    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };
    
    // ============================================
    // FORM SUBMISSION
    // ============================================
    
    const handleSubmit = async () => {
        if (!category || !title) {
            setError('Please select a category and provide a title');
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            // In production, upload photos to storage first
            // For MVP, we'll just include the base64 previews
            const photoUrls = photos.map(p => p.preview);
            
            const result = await createServiceRequest(userId, {
                propertyId: property?.id,
                category,
                title,
                description,
                photos: photoUrls,
                zipCode,
                city,
                state,
                urgency,
                budgetRange: showBudget ? {
                    min: budgetMin ? parseInt(budgetMin) : null,
                    max: budgetMax ? parseInt(budgetMax) : null
                } : null,
                showBudget,
                mustBeInsured,
                mustBeLicensed,
                allowCalls,
                allowTexts,
                allowMessages,
                preferredMethod: 'message'
            });
            
            if (result.success) {
                onSuccess?.(result.requestId);
            } else {
                setError(result.error || 'Failed to create request');
            }
        } catch (err) {
            setError(err.message || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // ============================================
    // STEP NAVIGATION
    // ============================================
    
    const canProceed = () => {
        switch (step) {
            case 1: return !!category;
            case 2: return !!title && title.length >= 5;
            case 3: return true; // Optional step
            case 4: return true; // Review step
            default: return false;
        }
    };
    
    const nextStep = () => {
        if (canProceed() && step < totalSteps) {
            setStep(step + 1);
        }
    };
    
    const prevStep = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };
    
    // ============================================
    // RENDER STEPS
    // ============================================
    
    const renderStep1 = () => (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-slate-800">What do you need help with?</h2>
                <p className="text-slate-500 mt-1">Select a category</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SERVICE_CATEGORIES.map(cat => {
                    const Icon = CATEGORY_ICONS[cat.id] || HelpCircle;
                    const isSelected = category === cat.id;
                    
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`
                                p-4 rounded-xl border-2 text-left transition-all
                                ${isSelected 
                                    ? 'border-emerald-500 bg-emerald-50' 
                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                }
                            `}
                        >
                            <Icon 
                                size={24} 
                                className={isSelected ? 'text-emerald-600' : 'text-slate-400'} 
                            />
                            <p className={`mt-2 font-medium text-sm ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                                {cat.label}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
    
    const renderStep2 = () => (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-slate-800">Describe what you need</h2>
                <p className="text-slate-500 mt-1">Be specific to get better responses</p>
            </div>
            
            {/* Title */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Brief Title *
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., AC not cooling, Leaky faucet, Outlet not working"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    maxLength={100}
                />
                <p className="text-xs text-slate-400 mt-1">{title.length}/100 characters</p>
            </div>
            
            {/* Description */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Details <span className="font-normal text-slate-400">(optional but helpful)</span>
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="When did the issue start? What have you tried? Any other details contractors should know..."
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    maxLength={1000}
                />
            </div>
            
            {/* Photos */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Photos <span className="font-normal text-slate-400">(helps contractors understand the issue)</span>
                </label>
                
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                />
                
                <div className="flex flex-wrap gap-3">
                    {photos.map((photo, index) => (
                        <div key={index} className="relative w-20 h-20">
                            <img 
                                src={photo.preview} 
                                alt={`Upload ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    
                    {photos.length < 5 && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition"
                        >
                            <Camera size={24} />
                            <span className="text-xs mt-1">Add</span>
                        </button>
                    )}
                </div>
            </div>
            
            {/* Urgency */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    How urgent is this?
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { id: URGENCY_LEVELS.EMERGENCY, label: 'Emergency', sublabel: 'Same day', icon: AlertTriangle, color: 'red' },
                        { id: URGENCY_LEVELS.THIS_WEEK, label: 'This Week', sublabel: '1-7 days', icon: Clock, color: 'amber' },
                        { id: URGENCY_LEVELS.FLEXIBLE, label: 'Flexible', sublabel: '2+ weeks', icon: Clock, color: 'slate' }
                    ].map(opt => {
                        const isSelected = urgency === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setUrgency(opt.id)}
                                className={`
                                    p-3 rounded-xl border-2 text-center transition-all
                                    ${isSelected 
                                        ? `border-${opt.color}-500 bg-${opt.color}-50` 
                                        : 'border-slate-200 hover:border-slate-300'
                                    }
                                `}
                            >
                                <p className={`font-medium text-sm ${isSelected ? `text-${opt.color}-700` : 'text-slate-700'}`}>
                                    {opt.label}
                                </p>
                                <p className="text-xs text-slate-400">{opt.sublabel}</p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
    
    const renderStep3 = () => (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-slate-800">Preferences</h2>
                <p className="text-slate-500 mt-1">Optional - filter who can respond</p>
            </div>
            
            {/* Requirements */}
            <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">
                    Contractor Requirements
                </label>
                
                <label className="flex items-center p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                    <input
                        type="checkbox"
                        checked={mustBeInsured}
                        onChange={(e) => setMustBeInsured(e.target.checked)}
                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <Shield size={20} className="ml-3 text-slate-400" />
                    <span className="ml-3 font-medium text-slate-700">Must be insured</span>
                </label>
                
                <label className="flex items-center p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                    <input
                        type="checkbox"
                        checked={mustBeLicensed}
                        onChange={(e) => setMustBeLicensed(e.target.checked)}
                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <Award size={20} className="ml-3 text-slate-400" />
                    <span className="ml-3 font-medium text-slate-700">Must be licensed</span>
                </label>
            </div>
            
            {/* Budget */}
            <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showBudget}
                        onChange={(e) => setShowBudget(e.target.checked)}
                        className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-3 font-bold text-slate-700">Share my budget range</span>
                    <span className="ml-2 text-sm text-slate-400">(optional)</span>
                </label>
                
                {showBudget && (
                    <div className="flex items-center gap-3 ml-8">
                        <div className="flex items-center">
                            <DollarSign size={16} className="text-slate-400" />
                            <input
                                type="number"
                                value={budgetMin}
                                onChange={(e) => setBudgetMin(e.target.value)}
                                placeholder="Min"
                                className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        <span className="text-slate-400">to</span>
                        <div className="flex items-center">
                            <DollarSign size={16} className="text-slate-400" />
                            <input
                                type="number"
                                value={budgetMax}
                                onChange={(e) => setBudgetMax(e.target.value)}
                                placeholder="Max"
                                className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>
            
            {/* Contact Preferences */}
            <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">
                    How can contractors reach you?
                </label>
                
                <div className="flex flex-wrap gap-3">
                    <label className={`flex items-center px-4 py-2 rounded-full border-2 cursor-pointer transition ${allowMessages ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                        <input
                            type="checkbox"
                            checked={allowMessages}
                            onChange={(e) => setAllowMessages(e.target.checked)}
                            className="sr-only"
                        />
                        <span className={allowMessages ? 'text-emerald-700' : 'text-slate-600'}>Messages</span>
                        {allowMessages && <Check size={16} className="ml-2 text-emerald-600" />}
                    </label>
                    
                    <label className={`flex items-center px-4 py-2 rounded-full border-2 cursor-pointer transition ${allowCalls ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                        <input
                            type="checkbox"
                            checked={allowCalls}
                            onChange={(e) => setAllowCalls(e.target.checked)}
                            className="sr-only"
                        />
                        <span className={allowCalls ? 'text-emerald-700' : 'text-slate-600'}>Phone Calls</span>
                        {allowCalls && <Check size={16} className="ml-2 text-emerald-600" />}
                    </label>
                    
                    <label className={`flex items-center px-4 py-2 rounded-full border-2 cursor-pointer transition ${allowTexts ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                        <input
                            type="checkbox"
                            checked={allowTexts}
                            onChange={(e) => setAllowTexts(e.target.checked)}
                            className="sr-only"
                        />
                        <span className={allowTexts ? 'text-emerald-700' : 'text-slate-600'}>Text Messages</span>
                        {allowTexts && <Check size={16} className="ml-2 text-emerald-600" />}
                    </label>
                </div>
            </div>
        </div>
    );
    
    const renderStep4 = () => {
        const selectedCategory = SERVICE_CATEGORIES.find(c => c.id === category);
        
        return (
            <div className="space-y-6">
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-slate-800">Review Your Request</h2>
                    <p className="text-slate-500 mt-1">Make sure everything looks right</p>
                </div>
                
                {/* Summary Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase">
                                {selectedCategory?.label}
                            </span>
                            <h3 className="text-lg font-bold text-slate-800 mt-2">{title}</h3>
                        </div>
                        <span className={`
                            px-3 py-1 rounded-full text-xs font-bold uppercase
                            ${urgency === URGENCY_LEVELS.EMERGENCY ? 'bg-red-100 text-red-700' : ''}
                            ${urgency === URGENCY_LEVELS.THIS_WEEK ? 'bg-amber-100 text-amber-700' : ''}
                            ${urgency === URGENCY_LEVELS.FLEXIBLE ? 'bg-slate-100 text-slate-700' : ''}
                        `}>
                            {urgency === URGENCY_LEVELS.EMERGENCY && 'Emergency'}
                            {urgency === URGENCY_LEVELS.THIS_WEEK && 'This Week'}
                            {urgency === URGENCY_LEVELS.FLEXIBLE && 'Flexible'}
                        </span>
                    </div>
                    
                    {description && (
                        <p className="text-slate-600">{description}</p>
                    )}
                    
                    {photos.length > 0 && (
                        <div className="flex gap-2">
                            {photos.map((photo, i) => (
                                <img 
                                    key={i}
                                    src={photo.preview} 
                                    alt=""
                                    className="w-16 h-16 object-cover rounded-lg"
                                />
                            ))}
                        </div>
                    )}
                    
                    <div className="flex items-center text-slate-500 text-sm">
                        <MapPin size={16} className="mr-1" />
                        {city && state ? `${city}, ${state}` : zipCode}
                    </div>
                    
                    {showBudget && (budgetMin || budgetMax) && (
                        <div className="flex items-center text-slate-500 text-sm">
                            <DollarSign size={16} className="mr-1" />
                            Budget: {budgetMin ? `$${budgetMin}` : 'Any'} - {budgetMax ? `$${budgetMax}` : 'Any'}
                        </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        {mustBeInsured && (
                            <span className="flex items-center text-xs text-slate-500">
                                <Shield size={14} className="mr-1" /> Insured
                            </span>
                        )}
                        {mustBeLicensed && (
                            <span className="flex items-center text-xs text-slate-500">
                                <Award size={14} className="mr-1" /> Licensed
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-sm text-blue-700">
                        <strong>What happens next?</strong> Your request will be visible to contractors 
                        in your area who match your criteria. They can respond with quotes and availability. 
                        You'll choose who to work with.
                    </p>
                </div>
            </div>
        );
    };
    
    // ============================================
    // MAIN RENDER
    // ============================================
    
    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <Megaphone className="text-emerald-600 mr-3" size={28} />
                    <h1 className="text-2xl font-bold text-slate-800">Request Help</h1>
                </div>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-600 transition"
                    >
                        <X size={24} />
                    </button>
                )}
            </div>
            
            {/* Progress Bar */}
            <div className="flex items-center gap-2 mb-8">
                {[1, 2, 3, 4].map(s => (
                    <div
                        key={s}
                        className={`
                            h-2 flex-1 rounded-full transition-all
                            ${s <= step ? 'bg-emerald-500' : 'bg-slate-200'}
                        `}
                    />
                ))}
            </div>
            
            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                    {error}
                </div>
            )}
            
            {/* Step Content */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </div>
            
            {/* Navigation */}
            <div className="flex justify-between">
                <button
                    type="button"
                    onClick={step === 1 ? onCancel : prevStep}
                    className="flex items-center px-6 py-3 text-slate-600 font-medium hover:text-slate-800 transition"
                >
                    <ChevronLeft size={20} className="mr-1" />
                    {step === 1 ? 'Cancel' : 'Back'}
                </button>
                
                {step < totalSteps ? (
                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={!canProceed()}
                        className="flex items-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Continue
                        <ChevronRight size={20} className="ml-1" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={20} className="mr-2 animate-spin" />
                                Posting...
                            </>
                        ) : (
                            <>
                                <Megaphone size={20} className="mr-2" />
                                Post Request
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ServiceRequestCreator;
