// src/features/evaluations/components/CreateEvaluationRequest.jsx
// ============================================
// CREATE EVALUATION REQUEST
// ============================================
// Contractor interface for requesting pre-quote evaluations.

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    X, Send, Camera, Video, FileText, ChevronDown, ChevronUp,
    Plus, Trash2, Clock, DollarSign, AlertCircle, CheckCircle,
    Home, User, Mail, Phone, Clipboard, Eye, Loader2, MapPin
} from 'lucide-react';
import {
    EVALUATION_TYPES,
    DEFAULT_EXPIRATION_DAYS
} from '../lib/evaluationService';
import {
    JOB_CATEGORIES,
    CATEGORY_LABELS,
    PROMPT_TYPES,
    getTemplateForCategory,
    createCustomPrompt,
    SUGGESTED_EVAL_TYPE
} from '../lib/evaluationTemplates';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';

// ============================================
// UTILS
// ============================================
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

// ============================================
// MAIN COMPONENT
// ============================================

export const CreateEvaluationRequest = ({ 
    onSubmit, 
    onCancel,
    initialCustomer = null,  // Pre-fill from existing customer
    contractorId 
}) => {
    // ----------------------------------------
    // Form State
    // ----------------------------------------
    const [formData, setFormData] = useState({
        // Customer
        customerName: initialCustomer?.name || '',
        customerEmail: initialCustomer?.email || '',
        customerPhone: initialCustomer?.phone || '',
        propertyAddress: initialCustomer?.address || '',
        
        // Job
        jobCategory: JOB_CATEGORIES.GENERAL,
        jobDescription: '',
        
        // Evaluation type
        type: EVALUATION_TYPES.VIRTUAL,
        
        // Fee
        feeAmount: 0,
        feeWaivedIfHired: true,
        
        // Expiration
        expirationDays: DEFAULT_EXPIRATION_DAYS
    });

    const [customPrompts, setCustomPrompts] = useState([]);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // ----------------------------------------
    // Google Maps Autocomplete
    // ----------------------------------------
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);
    const mapsLoaded = useGoogleMaps();
    
    // Use ref to track current form values (avoids stale closure in autocomplete callback)
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);
    
    useEffect(() => {
        if (!mapsLoaded || !addressInputRef.current || autocompleteRef.current) return;
        
        try {
            autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'us' }
            });
            
            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current.getPlace();
                if (place.formatted_address) {
                    setFormData(prev => ({ ...prev, propertyAddress: place.formatted_address }));
                }
            });
        } catch (err) {
            console.warn('Autocomplete init error:', err);
        }
    }, [mapsLoaded]);

    // ----------------------------------------
    // Phone Handler
    // ----------------------------------------
    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData(prev => ({ ...prev, customerPhone: formatted }));
    };

    // ----------------------------------------
    // Template prompts based on category

    // ----------------------------------------
    // Template prompts based on category
    // ----------------------------------------
    const template = useMemo(() => 
        getTemplateForCategory(formData.jobCategory),
        [formData.jobCategory]
    );

    const [enabledPrompts, setEnabledPrompts] = useState(() => {
        // Start with all required prompts enabled
        const initial = {};
        template.prompts.forEach(p => {
            initial[p.id] = p.required;
        });
        return initial;
    });

    // Update enabled prompts when category changes
    const handleCategoryChange = useCallback((category) => {
        const newTemplate = getTemplateForCategory(category);
        const newEnabled = {};
        newTemplate.prompts.forEach(p => {
            newEnabled[p.id] = p.required;
        });
        setEnabledPrompts(newEnabled);
        setFormData(prev => ({
            ...prev,
            jobCategory: category,
            type: SUGGESTED_EVAL_TYPE[category] || EVALUATION_TYPES.VIRTUAL
        }));
    }, []);

    // ----------------------------------------
    // Prompt management
    // ----------------------------------------
    const togglePrompt = (promptId) => {
        const prompt = template.prompts.find(p => p.id === promptId);
        if (prompt?.required) return; // Can't disable required
        
        setEnabledPrompts(prev => ({
            ...prev,
            [promptId]: !prev[promptId]
        }));
    };

    const addCustomPrompt = (type) => {
        const newPrompt = createCustomPrompt({
            type,
            label: '',
            hint: '',
            required: false
        });
        setCustomPrompts(prev => [...prev, newPrompt]);
    };

    const updateCustomPrompt = (id, field, value) => {
        setCustomPrompts(prev => prev.map(p => 
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const removeCustomPrompt = (id) => {
        setCustomPrompts(prev => prev.filter(p => p.id !== id));
    };

    // ----------------------------------------
    // Validation
    // ----------------------------------------
    const validate = () => {
        const newErrors = {};
        
        if (!formData.customerName.trim()) {
            newErrors.customerName = 'Customer name is required';
        }
        if (!formData.customerEmail.trim() && !formData.customerPhone.trim()) {
            newErrors.contact = 'Email or phone is required';
        }
        if (formData.customerEmail && !/\S+@\S+\.\S+/.test(formData.customerEmail)) {
            newErrors.customerEmail = 'Invalid email format';
        }
        if (!formData.propertyAddress.trim()) {
            newErrors.propertyAddress = 'Property address is required';
        }
        if (!formData.jobDescription.trim()) {
            newErrors.jobDescription = 'Job description is required';
        }
        
        // Check custom prompts have labels
        customPrompts.forEach(p => {
            if (!p.label.trim()) {
                newErrors[`custom_${p.id}`] = 'Prompt label is required';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ----------------------------------------
    // Submit
    // ----------------------------------------
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validate()) return;

        setIsSubmitting(true);

        try {
            // Build final prompts array
            const finalPrompts = [
                ...template.prompts.filter(p => enabledPrompts[p.id]),
                ...customPrompts.filter(p => p.label.trim())
            ];

            await onSubmit({
                ...formData,
                prompts: finalPrompts
            });
        } catch (error) {
            console.error('Error creating evaluation:', error);
            setErrors({ submit: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ----------------------------------------
    // Render
    // ----------------------------------------
    return (
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-600">
                <div>
                    <h2 className="text-xl font-bold text-white">Request Evaluation</h2>
                    <p className="text-indigo-100 text-sm">Get info before quoting</p>
                </div>
                <button
                    onClick={onCancel}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                    
                    {/* Customer Info Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Customer Information
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.customerName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                        errors.customerName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    placeholder="Customer name"
                                />
                                {errors.customerName && (
                                    <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="email"
                                            value={formData.customerEmail}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                                errors.customerEmail ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                            }`}
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Property Address *
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={addressInputRef}
                                        type="text"
                                        defaultValue={formData.propertyAddress}
                                        onBlur={(e) => setFormData(prev => ({ ...prev, propertyAddress: e.target.value }))}
                                        className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                            errors.propertyAddress ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder="Start typing address..."
                                    />
                                </div>
                                </div>
                            </div>
                            {errors.contact && (
                                <p className="text-red-500 text-xs">{errors.contact}</p>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Property Address *
                                </label>
                                <div className="relative">
                                    <Home className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.propertyAddress}
                                        onChange={(e) => setFormData(prev => ({ ...prev, propertyAddress: e.target.value }))}
                                        className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                            errors.propertyAddress ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder="123 Main St, City, State ZIP"
                                    />
                                </div>
                                {errors.propertyAddress && (
                                    <p className="text-red-500 text-xs mt-1">{errors.propertyAddress}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Job Details Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Clipboard className="w-4 h-4" />
                            Job Details
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Job Category
                                </label>
                                <select
                                    value={formData.jobCategory}
                                    onChange={(e) => handleCategoryChange(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                >
                                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Job Description *
                                </label>
                                <textarea
                                    value={formData.jobDescription}
                                    onChange={(e) => setFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                                    rows={3}
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none ${
                                        errors.jobDescription ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                    }`}
                                    placeholder="Describe what the customer needs..."
                                />
                                {errors.jobDescription && (
                                    <p className="text-red-500 text-xs mt-1">{errors.jobDescription}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Evaluation Type */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Evaluation Type
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: EVALUATION_TYPES.VIRTUAL }))}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    formData.type === EVALUATION_TYPES.VIRTUAL
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <Camera className={`w-6 h-6 mb-2 ${
                                    formData.type === EVALUATION_TYPES.VIRTUAL ? 'text-indigo-600' : 'text-gray-400'
                                }`} />
                                <p className="font-semibold text-gray-900">Virtual</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Customer sends photos & info
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, type: EVALUATION_TYPES.SITE_VISIT }))}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    formData.type === EVALUATION_TYPES.SITE_VISIT
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <Home className={`w-6 h-6 mb-2 ${
                                    formData.type === EVALUATION_TYPES.SITE_VISIT ? 'text-indigo-600' : 'text-gray-400'
                                }`} />
                                <p className="font-semibold text-gray-900">Site Visit</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    Schedule in-person assessment
                                </p>
                            </button>
                        </div>
                    </section>

                    {/* Prompts Section (Virtual only) */}
                    {formData.type === EVALUATION_TYPES.VIRTUAL && (
                        <section>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                What to Request from Customer
                            </h3>
                            
                            {/* Template Prompts */}
                            <div className="space-y-2 mb-4">
                                {template.prompts.map((prompt) => (
                                    <PromptToggle
                                        key={prompt.id}
                                        prompt={prompt}
                                        enabled={enabledPrompts[prompt.id]}
                                        onToggle={() => togglePrompt(prompt.id)}
                                    />
                                ))}
                            </div>

                            {/* Custom Prompts */}
                            {customPrompts.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    <p className="text-xs font-medium text-gray-500 uppercase">Custom Prompts</p>
                                    {customPrompts.map((prompt) => (
                                        <CustomPromptEditor
                                            key={prompt.id}
                                            prompt={prompt}
                                            onUpdate={(field, value) => updateCustomPrompt(prompt.id, field, value)}
                                            onRemove={() => removeCustomPrompt(prompt.id)}
                                            error={errors[`custom_${prompt.id}`]}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Add Custom Prompt */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => addCustomPrompt(PROMPT_TYPES.PHOTO)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <Camera className="w-3.5 h-3.5" />
                                    Photo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addCustomPrompt(PROMPT_TYPES.TEXT)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <FileText className="w-3.5 h-3.5" />
                                    Question
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addCustomPrompt(PROMPT_TYPES.VIDEO)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <Video className="w-3.5 h-3.5" />
                                    Video
                                </button>
                            </div>
                        </section>
                    )}

                    {/* Advanced Options */}
                    <section>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            Advanced Options
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
                                {/* Fee */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Evaluation Fee
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="number"
                                                min="0"
                                                step="5"
                                                value={formData.feeAmount}
                                                onChange={(e) => setFormData(prev => ({ 
                                                    ...prev, 
                                                    feeAmount: parseFloat(e.target.value) || 0 
                                                }))}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        {formData.feeAmount > 0 && (
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.feeWaivedIfHired}
                                                    onChange={(e) => setFormData(prev => ({ 
                                                        ...prev, 
                                                        feeWaivedIfHired: e.target.checked 
                                                    }))}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                Waive if hired
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formData.feeAmount === 0 ? 'Free evaluation' : `$${formData.feeAmount} diagnostic fee`}
                                    </p>
                                </div>

                                {/* Expiration */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Request Expires In
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <select
                                            value={formData.expirationDays}
                                            onChange={(e) => setFormData(prev => ({ 
                                                ...prev, 
                                                expirationDays: parseInt(e.target.value) 
                                            }))}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                        >
                                            <option value={3}>3 days</option>
                                            <option value={5}>5 days</option>
                                            <option value={7}>7 days</option>
                                            <option value={14}>14 days</option>
                                            <option value={30}>30 days</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Customer has {formData.expirationDays} days to respond
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Error */}
                    {errors.submit && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm">{errors.submit}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Send Request
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ============================================
// PROMPT TOGGLE COMPONENT
// ============================================

const PromptToggle = ({ prompt, enabled, onToggle }) => {
    const getIcon = () => {
        switch (prompt.type) {
            case PROMPT_TYPES.PHOTO: return <Camera className="w-4 h-4" />;
            case PROMPT_TYPES.VIDEO: return <Video className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    };

    return (
        <label className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
            enabled 
                ? 'bg-indigo-50 border-indigo-200' 
                : 'bg-white border-gray-200 hover:border-gray-300'
        } ${prompt.required ? 'cursor-not-allowed' : ''}`}>
            <input
                type="checkbox"
                checked={enabled}
                onChange={onToggle}
                disabled={prompt.required}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className={`${enabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                {getIcon()}
            </span>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                    {prompt.label}
                    {prompt.required && <span className="text-red-500 ml-1">*</span>}
                </p>
                {prompt.hint && (
                    <p className="text-xs text-gray-400 truncate">{prompt.hint}</p>
                )}
            </div>
        </label>
    );
};

// ============================================
// CUSTOM PROMPT EDITOR
// ============================================

const CustomPromptEditor = ({ prompt, onUpdate, onRemove, error }) => {
    const getIcon = () => {
        switch (prompt.type) {
            case PROMPT_TYPES.PHOTO: return <Camera className="w-4 h-4 text-indigo-500" />;
            case PROMPT_TYPES.VIDEO: return <Video className="w-4 h-4 text-purple-500" />;
            default: return <FileText className="w-4 h-4 text-emerald-500" />;
        }
    };

    const getTypeLabel = () => {
        switch (prompt.type) {
            case PROMPT_TYPES.PHOTO: return 'Photo Request';
            case PROMPT_TYPES.VIDEO: return 'Video Request';
            default: return 'Question';
        }
    };

    return (
        <div className={`p-3 rounded-lg border ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-2 mb-2">
                {getIcon()}
                <span className="text-xs font-medium text-gray-500">{getTypeLabel()}</span>
                <button
                    type="button"
                    onClick={onRemove}
                    className="ml-auto p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <input
                type="text"
                value={prompt.label}
                onChange={(e) => onUpdate('label', e.target.value)}
                placeholder="What do you want to ask?"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2"
            />
            <input
                type="text"
                value={prompt.hint}
                onChange={(e) => onUpdate('hint', e.target.value)}
                placeholder="Hint for customer (optional)"
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
};

export default CreateEvaluationRequest;
