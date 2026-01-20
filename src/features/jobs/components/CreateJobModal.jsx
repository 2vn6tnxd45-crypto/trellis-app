// src/features/jobs/components/CreateJobModal.jsx
// ============================================
// ENHANCED JOB CREATION MODAL
// ============================================
// Full-featured job creation with validation, tech assignment, and AI suggestions

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    X, Briefcase, User, MapPin, Phone, Mail, Clock, DollarSign,
    Calendar, Save, Loader2, Users, AlertCircle, CheckCircle,
    Sparkles, ChevronDown, ChevronUp, Truck, Info
} from 'lucide-react';
import { createJobDirect, JOB_PRIORITY } from '../lib/jobService';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import toast from 'react-hot-toast';

// ============================================
// VALIDATION HELPERS
// ============================================
const isValidEmail = (email) => {
    if (!email) return true; // Optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => {
    if (!phone) return true; // Optional field
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
};

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
// CATEGORY DURATION SUGGESTIONS
// ============================================
const CATEGORY_DEFAULTS = {
    'General': { duration: 60, crewSize: 1 },
    'HVAC': { duration: 120, crewSize: 1 },
    'Plumbing': { duration: 90, crewSize: 1 },
    'Electrical': { duration: 90, crewSize: 1 },
    'Roofing': { duration: 240, crewSize: 2 },
    'Landscaping': { duration: 180, crewSize: 2 },
    'Painting': { duration: 240, crewSize: 2 },
    'Flooring': { duration: 300, crewSize: 2 },
    'Appliance Repair': { duration: 60, crewSize: 1 },
    'Pest Control': { duration: 45, crewSize: 1 },
    'Cleaning': { duration: 120, crewSize: 2 },
    'Handyman': { duration: 90, crewSize: 1 },
    'Other': { duration: 60, crewSize: 1 }
};

const CATEGORIES = Object.keys(CATEGORY_DEFAULTS);

// ============================================
// VALIDATION ERROR DISPLAY
// ============================================
const ValidationError = ({ message }) => (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
        <AlertCircle size={12} />
        {message}
    </p>
);

// ============================================
// TECH SELECTOR COMPONENT
// ============================================
const TechSelector = ({ teamMembers, selectedTechId, onSelect, scheduledDate }) => {
    const [isOpen, setIsOpen] = useState(false);

    const availableTechs = useMemo(() => {
        if (!scheduledDate || !teamMembers?.length) return teamMembers || [];

        const date = new Date(scheduledDate);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        return teamMembers.filter(tech => {
            const hours = tech.workingHours?.[dayName];
            return hours?.enabled !== false;
        });
    }, [teamMembers, scheduledDate]);

    const selectedTech = teamMembers?.find(t => t.id === selectedTechId);

    if (!teamMembers?.length) return null;

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                <Users size={14} className="inline mr-1" />
                Assign Technician
            </label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-left flex items-center justify-between hover:border-slate-300 focus:ring-2 focus:ring-emerald-500"
            >
                {selectedTech ? (
                    <div className="flex items-center gap-2">
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: selectedTech.color || '#64748B' }}
                        >
                            {selectedTech.name?.charAt(0)}
                        </div>
                        <span className="text-slate-700">{selectedTech.name}</span>
                    </div>
                ) : (
                    <span className="text-slate-400">Select technician (optional)</span>
                )}
                <ChevronDown size={16} className="text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button
                        type="button"
                        onClick={() => { onSelect(null); setIsOpen(false); }}
                        className="w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-50 text-sm"
                    >
                        No assignment (schedule later)
                    </button>
                    {availableTechs.map(tech => (
                        <button
                            key={tech.id}
                            type="button"
                            onClick={() => { onSelect(tech); setIsOpen(false); }}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2"
                        >
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: tech.color || '#64748B' }}
                            >
                                {tech.name?.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm text-slate-700">{tech.name}</p>
                                <p className="text-xs text-slate-400 capitalize">{tech.role || 'Technician'}</p>
                            </div>
                        </button>
                    ))}
                    {scheduledDate && availableTechs.length < teamMembers.length && (
                        <p className="px-3 py-2 text-xs text-amber-600 bg-amber-50">
                            Some techs unavailable on selected date
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
const CreateJobModal = ({
    isOpen,
    onClose,
    contractorId,
    onJobCreated,
    teamMembers = [],
    vehicles = []
}) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [showAiSuggestion, setShowAiSuggestion] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        propertyAddress: '',
        estimatedDuration: 60,
        price: '',
        priority: 'normal',
        scheduledDate: '',
        scheduledTime: '',
        notes: '',
        crewSize: 1,
        assignedTechId: null,
        assignedTechName: null
    });

    // Google Maps autocomplete
    const mapsLoaded = useGoogleMaps();
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (!mapsLoaded || !addressInputRef.current || autocompleteRef.current || !isOpen) return;

        try {
            autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'us' }
            });

            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current.getPlace();
                if (place.formatted_address) {
                    setFormData(prev => ({ ...prev, propertyAddress: place.formatted_address }));
                    setTouched(prev => ({ ...prev, propertyAddress: true }));
                }
            });
        } catch (err) {
            console.warn('Autocomplete init error:', err);
        }

        return () => {
            if (autocompleteRef.current) {
                window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
            }
        };
    }, [mapsLoaded, isOpen]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            autocompleteRef.current = null;
            setErrors({});
            setTouched({});
        }
    }, [isOpen]);

    // Validate form
    const validate = () => {
        const newErrors = {};

        if (!formData.title.trim()) {
            newErrors.title = 'Job title is required';
        }

        if (!formData.customerName.trim()) {
            newErrors.customerName = 'Customer name is required';
        }

        if (!formData.propertyAddress.trim()) {
            newErrors.propertyAddress = 'Service address is required';
        }

        if (formData.customerEmail && !isValidEmail(formData.customerEmail)) {
            newErrors.customerEmail = 'Please enter a valid email';
        }

        if (formData.customerPhone && !isValidPhone(formData.customerPhone)) {
            newErrors.customerPhone = 'Please enter a valid phone number';
        }

        if (formData.price && (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0)) {
            newErrors.price = 'Please enter a valid price';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle field change
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Auto-suggest duration and crew size based on category
        if (field === 'category' && value && CATEGORY_DEFAULTS[value]) {
            const defaults = CATEGORY_DEFAULTS[value];
            if (!touched.estimatedDuration) {
                setFormData(prev => ({ ...prev, estimatedDuration: defaults.duration }));
            }
            if (!touched.crewSize) {
                setFormData(prev => ({ ...prev, crewSize: defaults.crewSize }));
            }
            setShowAiSuggestion(true);
            setTimeout(() => setShowAiSuggestion(false), 3000);
        }
    };

    // Handle field blur (mark as touched)
    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    // Handle phone change with formatting
    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData(prev => ({ ...prev, customerPhone: formatted }));
    };

    // Handle tech selection
    const handleTechSelect = (tech) => {
        setFormData(prev => ({
            ...prev,
            assignedTechId: tech?.id || null,
            assignedTechName: tech?.name || null
        }));
    };

    // Handle submit
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mark all fields as touched
        setTouched({
            title: true,
            customerName: true,
            propertyAddress: true,
            customerEmail: true,
            customerPhone: true,
            price: true
        });

        if (!validate()) {
            toast.error('Please fix the errors before submitting');
            return;
        }

        setLoading(true);
        try {
            const jobData = {
                ...formData,
                price: formData.price ? parseFloat(formData.price) : null,
                estimatedDuration: parseInt(formData.estimatedDuration) || 60,
                crewSize: parseInt(formData.crewSize) || 1
            };

            const result = await createJobDirect(contractorId, jobData);

            if (result.success) {
                toast.success(`Job ${result.jobNumber} created successfully!`);
                onJobCreated?.(result.job);
                onClose();

                // Reset form
                setFormData({
                    title: '',
                    description: '',
                    category: '',
                    customerName: '',
                    customerPhone: '',
                    customerEmail: '',
                    propertyAddress: '',
                    estimatedDuration: 60,
                    price: '',
                    priority: 'normal',
                    scheduledDate: '',
                    scheduledTime: '',
                    notes: '',
                    crewSize: 1,
                    assignedTechId: null,
                    assignedTechName: null
                });
                setTouched({});
            } else {
                toast.error(result.error || 'Failed to create job');
            }
        } catch (error) {
            console.error('Error creating job:', error);
            toast.error('Failed to create job: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Check if form is valid for button state
    const isFormValid = formData.title && formData.customerName && formData.propertyAddress;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Briefcase className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Create New Job</h2>
                            <p className="text-xs text-emerald-100">Add a job directly without a quote</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* AI Suggestion Toast */}
                {showAiSuggestion && (
                    <div className="mx-4 mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2">
                        <Sparkles size={16} className="text-purple-600" />
                        <span className="text-sm text-purple-700">
                            Duration and crew size auto-suggested based on category
                        </span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Job Details Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                            <Briefcase size={14} />
                            Job Details
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Job Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                onBlur={() => handleBlur('title')}
                                placeholder="e.g., AC Repair, Water Heater Installation"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                    touched.title && errors.title ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                }`}
                            />
                            {touched.title && errors.title && <ValidationError message={errors.title} />}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleChange('category', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="">Select category...</option>
                                    {CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => handleChange('priority', e.target.value)}
                                    className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                        formData.priority === 'urgent' ? 'bg-red-50 text-red-700' :
                                        formData.priority === 'high' ? 'bg-amber-50 text-amber-700' : ''
                                    }`}
                                >
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                placeholder="Describe the work to be done..."
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Customer Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                            <User size={14} />
                            Customer Information
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Customer Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.customerName}
                                onChange={(e) => handleChange('customerName', e.target.value)}
                                onBlur={() => handleBlur('customerName')}
                                placeholder="John Smith"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                    touched.customerName && errors.customerName ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                }`}
                            />
                            {touched.customerName && errors.customerName && <ValidationError message={errors.customerName} />}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Phone size={14} className="inline mr-1" />
                                    Phone
                                </label>
                                <input
                                    type="tel"
                                    value={formData.customerPhone}
                                    onChange={handlePhoneChange}
                                    onBlur={() => handleBlur('customerPhone')}
                                    placeholder="(555) 123-4567"
                                    maxLength={14}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                        touched.customerPhone && errors.customerPhone ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                    }`}
                                />
                                {touched.customerPhone && errors.customerPhone && <ValidationError message={errors.customerPhone} />}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Mail size={14} className="inline mr-1" />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.customerEmail}
                                    onChange={(e) => handleChange('customerEmail', e.target.value)}
                                    onBlur={() => handleBlur('customerEmail')}
                                    placeholder="john@email.com"
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                        touched.customerEmail && errors.customerEmail ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                    }`}
                                />
                                {touched.customerEmail && errors.customerEmail && <ValidationError message={errors.customerEmail} />}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                <MapPin size={14} className="inline mr-1" />
                                Service Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                ref={addressInputRef}
                                type="text"
                                value={formData.propertyAddress}
                                onChange={(e) => handleChange('propertyAddress', e.target.value)}
                                onBlur={() => handleBlur('propertyAddress')}
                                placeholder="Start typing address..."
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                    touched.propertyAddress && errors.propertyAddress ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                }`}
                            />
                            {touched.propertyAddress && errors.propertyAddress && <ValidationError message={errors.propertyAddress} />}
                            {!errors.propertyAddress && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <MapPin size={10} />
                                    Address suggestions powered by Google
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Scheduling Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                            <Calendar size={14} />
                            Scheduling
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.scheduledDate}
                                    onChange={(e) => handleChange('scheduledDate', e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Time
                                </label>
                                <input
                                    type="time"
                                    value={formData.scheduledTime}
                                    onChange={(e) => handleChange('scheduledTime', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Tech Assignment */}
                        {teamMembers?.length > 0 && (
                            <TechSelector
                                teamMembers={teamMembers}
                                selectedTechId={formData.assignedTechId}
                                onSelect={handleTechSelect}
                                scheduledDate={formData.scheduledDate}
                            />
                        )}

                        {!formData.scheduledDate && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 bg-amber-50 p-2 rounded">
                                <Info size={12} />
                                Job will be created as "Pending" - schedule it later from the Jobs view
                            </p>
                        )}
                    </div>

                    {/* Pricing & Resources Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                            <DollarSign size={14} />
                            Pricing & Resources
                        </h3>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Duration (mins)
                                </label>
                                <input
                                    type="number"
                                    value={formData.estimatedDuration}
                                    onChange={(e) => { handleChange('estimatedDuration', e.target.value); setTouched(prev => ({ ...prev, estimatedDuration: true })); }}
                                    min="15"
                                    step="15"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Crew Size
                                </label>
                                <input
                                    type="number"
                                    value={formData.crewSize}
                                    onChange={(e) => { handleChange('crewSize', e.target.value); setTouched(prev => ({ ...prev, crewSize: true })); }}
                                    min="1"
                                    max="10"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Price ($)
                                </label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => handleChange('price', e.target.value)}
                                    onBlur={() => handleBlur('price')}
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                        touched.price && errors.price ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                    }`}
                                />
                                {touched.price && errors.price && <ValidationError message={errors.price} />}
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Any additional notes for your team..."
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !isFormValid}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                Create Job
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateJobModal;
