// src/features/contractor-pro/components/OfferTimeSlotsModal.jsx
// ============================================
// OFFER TIME SLOTS MODAL
// ============================================
// Allows contractors to offer multiple time windows to customers

import React, { useState, useMemo } from 'react';
import { 
    X, Calendar, Clock, Plus, Trash2, Send, 
    Sparkles, MapPin, User, DollarSign, AlertCircle,
    Sun, Coffee, Moon
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';

// Quick time presets
const TIME_PRESETS = [
    { id: 'morning', label: 'Morning', icon: Coffee, start: '08:00', end: '12:00' },
    { id: 'afternoon', label: 'Afternoon', icon: Sun, start: '12:00', end: '17:00' },
    { id: 'evening', label: 'Evening', icon: Moon, start: '17:00', end: '20:00' }
];

// Generate time options
const generateTimeOptions = () => {
    const options = [];
    for (let h = 6; h <= 20; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = h.toString().padStart(2, '0');
            const min = m.toString().padStart(2, '0');
            const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${min} ${h >= 12 ? 'PM' : 'AM'}`;
            options.push({ value: `${hour}:${min}`, label });
        }
    }
    return options;
};

const TIME_OPTIONS = generateTimeOptions();

// Get next N business days
const getNextBusinessDays = (count = 7) => {
    const days = [];
    const date = new Date();
    date.setDate(date.getDate() + 1); // Start tomorrow
    
    while (days.length < count) {
        // Skip Sundays (day 0) - you could customize this
        if (date.getDay() !== 0) {
            days.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export const OfferTimeSlotsModal = ({ 
    job, 
    schedulingPreferences,
    onClose, 
    onSuccess 
}) => {
    const [slots, setSlots] = useState([
        { id: 'slot_1', date: '', startTime: '09:00', endTime: '12:00' }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const nextDays = useMemo(() => getNextBusinessDays(14), []);

    // Add a new slot
    const addSlot = () => {
        if (slots.length >= 5) {
            toast.error('Maximum 5 time slots');
            return;
        }
        setSlots(prev => [...prev, {
            id: `slot_${Date.now()}`,
            date: '',
            startTime: '09:00',
            endTime: '12:00'
        }]);
    };

    // Remove a slot
    const removeSlot = (id) => {
        if (slots.length === 1) {
            toast.error('At least one time slot required');
            return;
        }
        setSlots(prev => prev.filter(s => s.id !== id));
    };

    // Update a slot
    const updateSlot = (id, field, value) => {
        setSlots(prev => prev.map(s => 
            s.id === id ? { ...s, [field]: value } : s
        ));
    };

    // Apply preset to a slot
    const applyPreset = (slotId, preset) => {
        setSlots(prev => prev.map(s => 
            s.id === slotId 
                ? { ...s, startTime: preset.start, endTime: preset.end }
                : s
        ));
    };

    // Quick fill: Add common slots
    const quickFill = () => {
        const nextThreeDays = nextDays.slice(0, 3);
        const newSlots = nextThreeDays.map((date, idx) => ({
            id: `slot_${idx}`,
            date: date.toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '12:00'
        }));
        setSlots(newSlots);
        toast.success('Added 3 morning slots');
    };

    // Validate slots
    const validateSlots = () => {
        const filledSlots = slots.filter(s => s.date);
        if (filledSlots.length === 0) {
            toast.error('Please select at least one date');
            return false;
        }
        return true;
    };

    // Submit slots
    const handleSubmit = async () => {
        if (!validateSlots()) return;

        setIsSubmitting(true);
        try {
            const filledSlots = slots.filter(s => s.date);
            
            // Build the offered slots array
            const offeredSlots = filledSlots.map(slot => {
                const startDateTime = new Date(`${slot.date}T${slot.startTime}:00`);
                const endDateTime = new Date(`${slot.date}T${slot.endTime}:00`);
                
                return {
                    id: slot.id,
                    start: startDateTime.toISOString(),
                    end: endDateTime.toISOString(),
                    status: 'offered',
                    offeredAt: new Date().toISOString()
                };
            });

            // Update the job
            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                // New scheduling model
                'scheduling.offeredSlots': offeredSlots,
                'scheduling.offeredAt': serverTimestamp(),
                'scheduling.offeredMessage': message || null,
                'scheduling.requestedNewTimes': false, // Clear the request flag
                
                // Update status
                status: 'slots_offered',
                
                // Also add to legacy proposedTimes for backward compatibility
                proposedTimes: arrayUnion({
                    date: offeredSlots[0].start, // First slot as primary
                    proposedBy: 'contractor',
                    createdAt: new Date().toISOString(),
                    type: 'multi_slot',
                    slotCount: offeredSlots.length
                }),
                
                lastActivity: serverTimestamp()
            });

            toast.success(`Sent ${offeredSlots.length} time options to customer`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error offering time slots:', error);
            toast.error('Failed to send time slots');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Customer preferences display
    const customerPrefs = job.schedulingRequests?.[job.schedulingRequests.length - 1];

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <Calendar className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Offer Time Slots</h3>
                            <p className="text-xs text-slate-500">Send availability options to customer</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-5 overflow-y-auto flex-1">
                    {/* Job Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-5">
                        <h4 className="font-bold text-slate-800 mb-1">
                            {job.title || job.description || 'Service Request'}
                        </h4>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <User size={12} />
                                {job.customer?.name || 'Customer'}
                            </span>
                            {job.customer?.address && (
                                <span className="flex items-center gap-1">
                                    <MapPin size={12} />
                                    {job.customer.address.split(',')[0]}
                                </span>
                            )}
                            {job.total > 0 && (
                                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                    <DollarSign size={12} />
                                    {job.total.toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Customer Preferences (if they requested new times) */}
                    {customerPrefs && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-bold text-amber-800 mb-1">Customer Preferences:</p>
                                    {customerPrefs.timeOfDay?.length > 0 && (
                                        <p className="text-amber-700">
                                            Prefers: {customerPrefs.timeOfDay.join(', ')}
                                        </p>
                                    )}
                                    {customerPrefs.dayPreference && (
                                        <p className="text-amber-700">
                                            Days: {customerPrefs.dayPreference}
                                        </p>
                                    )}
                                    {customerPrefs.specificDates && (
                                        <p className="text-amber-700">
                                            Dates: {customerPrefs.specificDates}
                                        </p>
                                    )}
                                    {customerPrefs.additionalNotes && (
                                        <p className="text-amber-600 mt-1 italic">
                                            "{customerPrefs.additionalNotes}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-bold text-slate-700">Time Slots</p>
                        <button
                            onClick={quickFill}
                            className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                        >
                            <Sparkles size={12} />
                            Quick fill (3 days)
                        </button>
                    </div>

                    {/* Time Slots */}
                    <div className="space-y-3 mb-5">
                        {slots.map((slot, idx) => (
                            <div 
                                key={slot.id}
                                className="bg-white border border-slate-200 rounded-xl p-3"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-400">
                                        Option {idx + 1}
                                    </span>
                                    {slots.length > 1 && (
                                        <button
                                            onClick={() => removeSlot(slot.id)}
                                            className="p-1 text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                
                                {/* Date picker */}
                                <div className="mb-2">
                                    <select
                                        value={slot.date}
                                        onChange={(e) => updateSlot(slot.id, 'date', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="">Select date...</option>
                                        {nextDays.map(date => (
                                            <option 
                                                key={date.toISOString()} 
                                                value={date.toISOString().split('T')[0]}
                                            >
                                                {date.toLocaleDateString('en-US', { 
                                                    weekday: 'short', 
                                                    month: 'short', 
                                                    day: 'numeric' 
                                                })}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Time presets */}
                                <div className="flex gap-2 mb-2">
                                    {TIME_PRESETS.map(preset => {
                                        const Icon = preset.icon;
                                        const isActive = slot.startTime === preset.start && slot.endTime === preset.end;
                                        return (
                                            <button
                                                key={preset.id}
                                                onClick={() => applyPreset(slot.id, preset)}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
                                                    isActive
                                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <Icon size={12} />
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom time range */}
                                <div className="flex items-center gap-2">
                                    <select
                                        value={slot.startTime}
                                        onChange={(e) => updateSlot(slot.id, 'startTime', e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        {TIME_OPTIONS.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <span className="text-slate-400 text-xs">to</span>
                                    <select
                                        value={slot.endTime}
                                        onChange={(e) => updateSlot(slot.id, 'endTime', e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        {TIME_OPTIONS.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}

                        {/* Add Slot Button */}
                        {slots.length < 5 && (
                            <button
                                onClick={addSlot}
                                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1"
                            >
                                <Plus size={16} />
                                Add Another Option
                            </button>
                        )}
                    </div>

                    {/* Optional Message */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Message to Customer <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g., Let me know which time works best for you!"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                            rows={2}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !slots.some(s => s.date)}
                        className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Send {slots.filter(s => s.date).length} Option{slots.filter(s => s.date).length !== 1 ? 's' : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OfferTimeSlotsModal;
