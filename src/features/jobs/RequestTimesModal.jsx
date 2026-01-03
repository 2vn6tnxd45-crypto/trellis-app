// src/features/jobs/RequestTimesModal.jsx
// ============================================
// REQUEST DIFFERENT TIMES MODAL
// ============================================
// Allows homeowners to request new time options from the contractor

import React, { useState } from 'react';
import { X, Clock, Calendar, Send, Sun, Moon, Coffee } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';
import toast from 'react-hot-toast';

const TIME_PREFERENCES = [
    { id: 'morning', label: 'Mornings', sublabel: '8 AM - 12 PM', icon: Coffee },
    { id: 'afternoon', label: 'Afternoons', sublabel: '12 PM - 5 PM', icon: Sun },
    { id: 'evening', label: 'Evenings', sublabel: '5 PM - 8 PM', icon: Moon },
    { id: 'flexible', label: 'Flexible', sublabel: 'Any time works', icon: Clock }
];

const DAY_PREFERENCES = [
    { id: 'weekdays', label: 'Weekdays', sublabel: 'Mon - Fri' },
    { id: 'weekends', label: 'Weekends', sublabel: 'Sat - Sun' },
    { id: 'any', label: 'Any Day', sublabel: 'Flexible' }
];

export const RequestTimesModal = ({ job, onClose, onSuccess }) => {
    const [timePrefs, setTimePrefs] = useState([]);
    const [dayPref, setDayPref] = useState('');
    const [message, setMessage] = useState('');
    const [specificDates, setSpecificDates] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleTimePref = (id) => {
        setTimePrefs(prev => 
            prev.includes(id) 
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        if (timePrefs.length === 0 && !dayPref && !message && !specificDates) {
            toast.error('Please provide some scheduling preferences');
            return;
        }

        setIsSubmitting(true);
        try {
            // Build the request message
            const preferences = {
                timeOfDay: timePrefs.map(id => TIME_PREFERENCES.find(t => t.id === id)?.label).filter(Boolean),
                dayPreference: DAY_PREFERENCES.find(d => d.id === dayPref)?.label || null,
                specificDates: specificDates || null,
                additionalNotes: message || null,
                requestedAt: new Date().toISOString(),
                requestedBy: 'homeowner'
            };

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, job.id), {
                // Add to scheduling requests history
                schedulingRequests: arrayUnion(preferences),
                // Update status to indicate homeowner needs new times
                schedulingStatus: 'needs_new_times',
                lastActivity: serverTimestamp(),
                // Clear any offered slots that weren't selected
                'scheduling.requestedNewTimes': true,
                'scheduling.requestedNewTimesAt': serverTimestamp()
            });

            toast.success('Request sent to contractor');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error requesting new times:', error);
            toast.error('Failed to send request');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <Calendar className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Request Different Times</h3>
                            <p className="text-xs text-slate-500">Let the contractor know your availability</p>
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
                        <p className="font-bold text-slate-800">
                            {job.title || job.description || 'Service Request'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            {job.contractorName || job.customer?.name || 'Contractor'}
                        </p>
                    </div>

                    {/* Time of Day Preferences */}
                    <div className="mb-5">
                        <p className="text-sm font-bold text-slate-700 mb-3">
                            What times work best? <span className="text-slate-400 font-normal">(select all that apply)</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {TIME_PREFERENCES.map(pref => {
                                const Icon = pref.icon;
                                const isSelected = timePrefs.includes(pref.id);
                                return (
                                    <button
                                        key={pref.id}
                                        onClick={() => toggleTimePref(pref.id)}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            isSelected 
                                                ? 'border-emerald-300 bg-emerald-50' 
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon size={16} className={isSelected ? 'text-emerald-600' : 'text-slate-400'} />
                                            <span className={`text-sm font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                {pref.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">{pref.sublabel}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Day Preferences */}
                    <div className="mb-5">
                        <p className="text-sm font-bold text-slate-700 mb-3">
                            What days work best?
                        </p>
                        <div className="flex gap-2">
                            {DAY_PREFERENCES.map(pref => (
                                <button
                                    key={pref.id}
                                    onClick={() => setDayPref(pref.id)}
                                    className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                                        dayPref === pref.id 
                                            ? 'border-emerald-300 bg-emerald-50' 
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <span className={`text-sm font-medium block ${dayPref === pref.id ? 'text-emerald-700' : 'text-slate-700'}`}>
                                        {pref.label}
                                    </span>
                                    <span className="text-xs text-slate-500">{pref.sublabel}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Specific Dates */}
                    <div className="mb-5">
                        <p className="text-sm font-bold text-slate-700 mb-2">
                            Any specific dates that work? <span className="text-slate-400 font-normal">(optional)</span>
                        </p>
                        <input
                            type="text"
                            value={specificDates}
                            onChange={(e) => setSpecificDates(e.target.value)}
                            placeholder="e.g., Jan 15, Jan 18, or anytime next week"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    {/* Additional Message */}
                    <div>
                        <p className="text-sm font-bold text-slate-700 mb-2">
                            Anything else the contractor should know? <span className="text-slate-400 font-normal">(optional)</span>
                        </p>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g., I work from home on Tuesdays, so that would be ideal..."
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                            rows={3}
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
                        disabled={isSubmitting}
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
                                Send Request
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RequestTimesModal;
