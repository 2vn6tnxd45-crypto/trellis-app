// src/features/recurring/components/CreateRecurringServiceModal.jsx
// ============================================
// CREATE RECURRING SERVICE MODAL
// ============================================
// Modal for contractors to set up recurring services

import React, { useState } from 'react';
import {
    X, RotateCcw, Calendar, Clock, User, DollarSign,
    ChevronRight, Loader2, CheckCircle
} from 'lucide-react';
import { RECURRING_FREQUENCIES } from '../../../config/constants';

const DAYS_OF_WEEK = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
];

const TIME_OPTIONS = [];
for (let h = 7; h <= 18; h++) {
    const hour = h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    TIME_OPTIONS.push({
        value: `${h.toString().padStart(2, '0')}:00`,
        label: `${hour}:00 ${ampm}`
    });
    if (h < 18) {
        TIME_OPTIONS.push({
            value: `${h.toString().padStart(2, '0')}:30`,
            label: `${hour}:30 ${ampm}`
        });
    }
}

/**
 * CreateRecurringServiceModal - Set up a recurring service
 * @param {Object} props
 * @param {Object} props.job - Optional: Existing job to convert to recurring
 * @param {Object} props.customer - Customer info
 * @param {Array} props.teamMembers - Optional: Team members for assignment
 * @param {Function} props.onCreate - Called with service data
 * @param {Function} props.onClose - Close modal
 */
export const CreateRecurringServiceModal = ({
    job = null,
    customer,
    teamMembers = [],
    onCreate,
    onClose
}) => {
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        serviceName: job?.title || job?.description || '',
        description: job?.description || '',
        basePrice: job?.estimate?.total || job?.total || '',
        estimatedDuration: job?.estimatedDuration || 60,
        frequency: 'biweekly',
        preferredDay: 'tuesday',
        preferredTime: '09:00',
        assignedTechId: job?.assignedTechId || '',
        assignedTechName: job?.assignedTechName || ''
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Auto-set tech name when tech selected
        if (field === 'assignedTechId') {
            const tech = teamMembers.find(t => t.id === value);
            setFormData(prev => ({
                ...prev,
                assignedTechId: value,
                assignedTechName: tech?.name || ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.serviceName.trim()) {
            return;
        }

        setSaving(true);
        try {
            await onCreate({
                ...formData,
                customerId: customer?.id || customer?.userId,
                propertyId: customer?.propertyId,
                customerName: customer?.name || customer?.customerName,
                customerEmail: customer?.email,
                propertyAddress: customer?.address || customer?.propertyAddress,
                basePrice: parseFloat(formData.basePrice) || 0,
                estimatedDuration: parseInt(formData.estimatedDuration) || 60
            });

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Failed to create recurring service:', error);
            setSaving(false);
        }
    };

    // Success state
    if (success) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Recurring Service Created!</h3>
                    <p className="text-slate-500">
                        The first visits have been scheduled automatically.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                            <RotateCcw size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800">Set Up Recurring Service</h2>
                            <p className="text-xs text-slate-500">
                                {customer?.name || customer?.customerName || 'Customer'}
                            </p>
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
                <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Service Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Service Name *
                        </label>
                        <input
                            type="text"
                            value={formData.serviceName}
                            onChange={(e) => handleChange('serviceName', e.target.value)}
                            placeholder="e.g., Lawn Care, Pest Control, Pool Cleaning"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            required
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Price per Visit
                        </label>
                        <div className="relative">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="number"
                                value={formData.basePrice}
                                onChange={(e) => handleChange('basePrice', e.target.value)}
                                placeholder="75"
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Frequency
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {RECURRING_FREQUENCIES.map(freq => (
                                <button
                                    key={freq.value}
                                    type="button"
                                    onClick={() => handleChange('frequency', freq.value)}
                                    className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${formData.frequency === freq.value
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    {freq.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preferred Day */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Preferred Day
                        </label>
                        <select
                            value={formData.preferredDay}
                            onChange={(e) => handleChange('preferredDay', e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                        >
                            {DAYS_OF_WEEK.map(day => (
                                <option key={day.value} value={day.value}>
                                    {day.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Preferred Time */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Preferred Time
                        </label>
                        <select
                            value={formData.preferredTime}
                            onChange={(e) => handleChange('preferredTime', e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                        >
                            {TIME_OPTIONS.map(time => (
                                <option key={time.value} value={time.value}>
                                    {time.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tech Assignment (if team) */}
                    {teamMembers.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Assign to Technician
                            </label>
                            <select
                                value={formData.assignedTechId}
                                onChange={(e) => handleChange('assignedTechId', e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                            >
                                <option value="">Auto-assign each visit</option>
                                {teamMembers.map(tech => (
                                    <option key={tech.id} value={tech.id}>
                                        {tech.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">
                                Same technician for every visit, or auto-assign based on availability
                            </p>
                        </div>
                    )}

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Estimated Duration
                        </label>
                        <select
                            value={formData.estimatedDuration}
                            onChange={(e) => handleChange('estimatedDuration', e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                        >
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                            <option value={180}>3 hours</option>
                            <option value={240}>4 hours</option>
                        </select>
                    </div>

                    {/* Summary Box */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs font-medium text-slate-500 mb-2">SERVICE SUMMARY</p>
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Service</span>
                                <span className="font-medium text-slate-800">
                                    {formData.serviceName || '—'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Schedule</span>
                                <span className="font-medium text-slate-800">
                                    {RECURRING_FREQUENCIES.find(f => f.value === formData.frequency)?.label} on {formData.preferredDay}s
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Price</span>
                                <span className="font-medium text-slate-800">
                                    ${formData.basePrice || 0}/visit
                                </span>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-slate-600 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || !formData.serviceName.trim()}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <RotateCcw size={18} />
                                Start Recurring Service
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateRecurringServiceModal;
