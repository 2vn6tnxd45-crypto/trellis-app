// src/features/jobs/components/CreateJobModal.jsx
// Modal for creating jobs directly (without quote workflow)

import React, { useState, useRef, useEffect } from 'react';
import { X, Briefcase, User, MapPin, Phone, Mail, Clock, DollarSign, Calendar, Save, Loader2, Users } from 'lucide-react';
import { createJobDirect, JOB_PRIORITY } from '../lib/jobService';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';

const CreateJobModal = ({ isOpen, onClose, contractorId, onJobCreated }) => {
    const [loading, setLoading] = useState(false);
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
        crewSize: 1
    });

    // Google Maps autocomplete
    const mapsLoaded = useGoogleMaps();
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);
    const formDataRef = useRef(formData);

    // Keep formData ref current
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

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
                }
            });
        } catch (err) {
            console.warn('Autocomplete init error:', err);
        }

        return () => {
            // Cleanup autocomplete on unmount
            if (autocompleteRef.current) {
                window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
            }
        };
    }, [mapsLoaded, isOpen]);

    // Reset autocomplete ref when modal closes
    useEffect(() => {
        if (!isOpen) {
            autocompleteRef.current = null;
        }
    }, [isOpen]);

    const categories = [
        'General',
        'HVAC',
        'Plumbing',
        'Electrical',
        'Roofing',
        'Landscaping',
        'Painting',
        'Flooring',
        'Appliance Repair',
        'Pest Control',
        'Cleaning',
        'Handyman',
        'Other'
    ];

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title || !formData.customerName || !formData.propertyAddress) {
            alert('Please fill in required fields: Job Title, Customer Name, and Address');
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
                onJobCreated?.(result.job);
                onClose();
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
                    crewSize: 1
                });
            } else {
                alert(result.error || 'Failed to create job');
            }
        } catch (error) {
            console.error('Error creating job:', error);
            alert('Failed to create job: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Briefcase className="text-emerald-600" size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">Create Job</h2>
                            <p className="text-xs text-slate-500">Add a new job directly</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Job Details Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Job Details</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Job Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="e.g., AC Repair, Roof Inspection"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => handleChange('category', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="">Select...</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => handleChange('priority', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Customer Info</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                <User size={14} className="inline mr-1" />
                                Customer Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.customerName}
                                onChange={(e) => handleChange('customerName', e.target.value)}
                                placeholder="John Smith"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                required
                            />
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
                                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
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
                                    placeholder="john@email.com"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
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
                                placeholder="Start typing address..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                required
                            />
                            <p className="text-xs text-slate-400 mt-1">Address suggestions powered by Google</p>
                        </div>
                    </div>

                    {/* Scheduling & Pricing Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Schedule & Pricing</h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Calendar size={14} className="inline mr-1" />
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.scheduledDate}
                                    onChange={(e) => handleChange('scheduledDate', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Clock size={14} className="inline mr-1" />
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

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Clock size={14} className="inline mr-1" />
                                    Duration (mins)
                                </label>
                                <input
                                    type="number"
                                    value={formData.estimatedDuration}
                                    onChange={(e) => handleChange('estimatedDuration', e.target.value)}
                                    min="15"
                                    step="15"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Users size={14} className="inline mr-1" />
                                    Crew Size
                                </label>
                                <input
                                    type="number"
                                    value={formData.crewSize}
                                    onChange={(e) => handleChange('crewSize', e.target.value)}
                                    min="1"
                                    max="10"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <DollarSign size={14} className="inline mr-1" />
                                    Price
                                </label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => handleChange('price', e.target.value)}
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Any additional notes..."
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
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
