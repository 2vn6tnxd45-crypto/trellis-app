// src/features/contractor-pro/components/TimezoneSelector.jsx
// ============================================
// TIMEZONE SELECTOR COMPONENT
// ============================================
// Allows contractors to select their business timezone

import React, { useState } from 'react';
import { Globe, Check, AlertCircle, Loader2 } from 'lucide-react';
import { US_TIMEZONES, getTimezoneAbbreviation, detectTimezone } from '../lib/timezoneUtils';

export const TimezoneSelector = ({
    currentTimezone,
    onTimezoneChange,
    saving = false,
    showBrowserWarning = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const browserTimezone = detectTimezone();
    const showMismatchWarning = showBrowserWarning &&
        currentTimezone &&
        browserTimezone &&
        currentTimezone !== browserTimezone;

    const currentTzInfo = US_TIMEZONES.find(tz => tz.value === currentTimezone) || {
        value: currentTimezone,
        label: currentTimezone,
        abbr: getTimezoneAbbreviation(currentTimezone)
    };

    const handleSelect = async (timezone) => {
        setIsOpen(false);
        if (timezone !== currentTimezone) {
            await onTimezoneChange(timezone);
        }
    };

    return (
        <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase">
                Business Timezone
            </label>

            {/* Current Selection / Dropdown Trigger */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={saving}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-left"
                >
                    <div className="flex items-center gap-3">
                        <Globe size={18} className="text-slate-400" />
                        <div>
                            <p className="font-medium text-slate-800">
                                {currentTzInfo.label}
                            </p>
                            <p className="text-xs text-slate-500">
                                Currently {getTimezoneAbbreviation(currentTimezone)}
                            </p>
                        </div>
                    </div>
                    {saving ? (
                        <Loader2 size={18} className="animate-spin text-emerald-600" />
                    ) : (
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                        {US_TIMEZONES.map(tz => (
                            <button
                                key={tz.value}
                                onClick={() => handleSelect(tz.value)}
                                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                                    tz.value === currentTimezone ? 'bg-emerald-50' : ''
                                }`}
                            >
                                <div>
                                    <p className="font-medium text-slate-800">{tz.label}</p>
                                    <p className="text-xs text-slate-500">{tz.abbr}</p>
                                </div>
                                {tz.value === currentTimezone && (
                                    <Check size={18} className="text-emerald-600" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Browser Mismatch Warning */}
            {showMismatchWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                        <p className="font-medium text-amber-800">
                            Timezone mismatch detected
                        </p>
                        <p className="text-amber-700 mt-0.5">
                            Your browser is set to {getTimezoneAbbreviation(browserTimezone)} but your business timezone is {getTimezoneAbbreviation(currentTimezone)}.
                        </p>
                        <button
                            onClick={() => handleSelect(browserTimezone)}
                            className="mt-2 text-amber-800 font-medium underline hover:no-underline"
                        >
                            Use browser timezone instead
                        </button>
                    </div>
                </div>
            )}

            <p className="text-xs text-slate-500">
                All scheduled times will be displayed in this timezone. Make sure it matches where you operate.
            </p>
        </div>
    );
};

export default TimezoneSelector;
