// src/features/contractor-pro/components/OfferTimeSlotsModal.jsx
// ============================================
// OFFER TIME SLOTS MODAL - WITH AI SUGGESTIONS
// ============================================
// Allows contractors to offer multiple time windows to customers
// Now with AI-powered suggestions!

import React, { useState, useMemo } from 'react';
import { 
    X, Calendar, Clock, Plus, Trash2, Send, 
    Sparkles, MapPin, User, DollarSign, AlertCircle,
    Sun, Coffee, Moon, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';
import { AISuggestionPanel, QuickSuggestions } from './AISuggestionPanel';

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
const getNextBusinessDays = (count = 14) => {
    const days = [];
    const date = new Date();
    date.setDate(date.getDate() + 1); // Start tomorrow
    
    while (days.length < count) {
        if (date.getDay() !== 0) { // Skip Sundays
            days.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export const OfferTimeSlotsModal = ({ 
    job, 
    allJobs = [],
    schedulingPreferences,
    onClose, 
    onSuccess 
}) => {
    const [slots, setSlots] = useState([
        { id: 'slot_1', date: '', startTime: '09:00', endTime: '12:00' }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [showAISuggestions, setShowAISuggestions] = useState(true);
    const [showManualEntry, setShowManualEntry] = useState(false);

    const nextDays = useMemo(() => getNextBusinessDays(14), []);
    
    // Get customer preferences from last scheduling request
    const customerPrefs = useMemo(() => {
        const requests = job.schedulingRequests || [];
        return requests.length > 0 ? requests[requests.length - 1] : null;
    }, [job]);

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

    // Apply AI suggestion
    const applyAISuggestion = (suggestion) => {
        const dateStr = suggestion.date.toISOString().split('T')[0];
        
        // Check if we already have this slot
        const existingSlot = slots.find(s => 
            s.date === dateStr && s.startTime === suggestion.startTime
        );
        
        if (existingSlot) {
            toast('This time is already added');
            return;
        }
        
        // If first slot is empty, update it
        if (slots.length === 1 && !slots[0].date) {
            setSlots([{
                id: 'slot_1',
                date: dateStr,
                startTime: suggestion.startTime,
                endTime: suggestion.endTime
            }]);
        } else if (slots.length < 5) {
            // Add as new slot
            setSlots(prev => [...prev, {
                id: `slot_${Date.now()}`,
                date: dateStr,
                startTime: suggestion.startTime,
                endTime: suggestion.endTime
            }]);
        } else {
            toast.error('Maximum 5 slots - remove one first');
        }
        
        toast.success(`Added ${suggestion.dateFormatted}`);
    };

    // Quick fill with AI recommendations
    const quickFillAI = () => {
        // This will be handled by selecting from AI suggestions
        setShowAISuggestions(true);
        setShowManualEntry(false);
    };

    // Legacy quick fill
    const quickFillManual = () => {
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
                'scheduling.requestedNewTimes': false,
                
                // Update status
                status: 'slots_offered',
                schedulingStatus: 'slots_offered',
                
                // Legacy support
                proposedTimes: arrayUnion({
                    date: offeredSlots[0].start,
                    proposedBy: 'contractor',
                    createdAt: new Date().toISOString(),
                    type: 'multi_slot',
                    slotCount: offeredSlots.length
                }),
                
                lastActivity: serverTimestamp()
            });

            toast.success(`Sent ${offeredSlots.length} time option${offeredSlots.length > 1 ? 's' : ''} to customer`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error offering time slots:', error);
            toast.error('Failed to send time slots');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filledSlotsCount = slots.filter(s => s.date).length;

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
                            <p className="text-xs text-slate-500">Send availability to customer</p>
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

                    {/* AI Suggestions Section */}
                    <div className="mb-5">
                        <button
                            onClick={() => setShowAISuggestions(!showAISuggestions)}
                            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl hover:from-violet-100 hover:to-purple-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-1.5 rounded-lg">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <span className="font-bold text-violet-800">AI Suggestions</span>
                            </div>
                            {showAISuggestions ? <ChevronUp size={18} className="text-violet-500" /> : <ChevronDown size={18} className="text-violet-500" />}
                        </button>
                        
                        {showAISuggestions && (
                            <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                                <AISuggestionPanel
                                    job={job}
                                    allJobs={allJobs}
                                    preferences={schedulingPreferences}
                                    customerPreferences={customerPrefs}
                                    onSelectSuggestion={applyAISuggestion}
                                    selectedSuggestion={null}
                                    compact={true}
                                />
                            </div>
                        )}
                    </div>

                    {/* Selected Slots */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                Selected Times
                                {filledSlotsCount > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                                        {filledSlotsCount}
                                    </span>
                                )}
                            </p>
                            <button
                                onClick={() => setShowManualEntry(!showManualEntry)}
                                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                            >
                                {showManualEntry ? 'Hide' : 'Add manually'}
                                {showManualEntry ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        </div>

                        {/* Display selected slots */}
                        {filledSlotsCount > 0 && (
                            <div className="space-y-2 mb-3">
                                {slots.filter(s => s.date).map((slot, idx) => {
                                    const date = new Date(slot.date + 'T00:00:00');
                                    const dateLabel = date.toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric' 
                                    });
                                    const startLabel = TIME_OPTIONS.find(t => t.value === slot.startTime)?.label || slot.startTime;
                                    const endLabel = TIME_OPTIONS.find(t => t.value === slot.endTime)?.label || slot.endTime;
                                    
                                    return (
                                        <div 
                                            key={slot.id}
                                            className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
                                        >
                                            <div>
                                                <p className="font-bold text-emerald-800 text-sm">{dateLabel}</p>
                                                <p className="text-xs text-emerald-600">{startLabel} - {endLabel}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (slots.length === 1) {
                                                        setSlots([{ id: 'slot_1', date: '', startTime: '09:00', endTime: '12:00' }]);
                                                    } else {
                                                        removeSlot(slot.id);
                                                    }
                                                }}
                                                className="p-1.5 text-emerald-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {filledSlotsCount === 0 && (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <Calendar size={24} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-sm text-slate-500">No times selected</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Click an AI suggestion above or add manually
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Manual Entry Section */}
                    {showManualEntry && (
                        <div className="mb-5 p-4 bg-slate-50 rounded-xl">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Add Manually</p>
                            
                            <div className="space-y-3">
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
                                        <select
                                            value={slot.date}
                                            onChange={(e) => updateSlot(slot.id, 'date', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
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

                                        {/* Custom time */}
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={slot.startTime}
                                                onChange={(e) => updateSlot(slot.id, 'startTime', e.target.value)}
                                                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                                            >
                                                {TIME_OPTIONS.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                            <span className="text-slate-400 text-xs">to</span>
                                            <select
                                                value={slot.endTime}
                                                onChange={(e) => updateSlot(slot.id, 'endTime', e.target.value)}
                                                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                                            >
                                                {TIME_OPTIONS.map(t => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}

                                {slots.length < 5 && (
                                    <button
                                        onClick={addSlot}
                                        className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Plus size={16} />
                                        Add Another
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Optional Message */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Message <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g., Let me know which time works best!"
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
                        disabled={isSubmitting || filledSlotsCount === 0}
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
                                Send {filledSlotsCount} Option{filledSlotsCount !== 1 ? 's' : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OfferTimeSlotsModal;
