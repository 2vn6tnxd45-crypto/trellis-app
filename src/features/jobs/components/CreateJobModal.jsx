// src/features/jobs/components/CreateJobModal.jsx
// ============================================
// ENHANCED JOB CREATION MODAL
// ============================================
// Full-featured job creation with validation, tech assignment, and AI suggestions

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    X, Briefcase, User, MapPin, Phone, Mail, Clock,
    Calendar, Save, Loader2, Users, AlertCircle, CheckCircle,
    Sparkles, ChevronDown, ChevronUp, Truck, Info
} from 'lucide-react';
import { createJobDirect, JOB_PRIORITY, linkJobToHomeowner } from '../lib/jobService';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import toast from 'react-hot-toast';
import JobLineItemsSection, { createNewLineItem } from './JobLineItemsSection';

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
// DURATION PRESETS
// ============================================
const DURATION_PRESETS = [
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '1.5 hours', value: 90 },
    { label: '2 hours', value: 120 },
    { label: '3 hours', value: 180 },
    { label: '4 hours', value: 240 },
    { label: 'Half day', value: 240 },
    { label: 'Full day', value: 480 },
    { label: '2 days', value: 960 },
    { label: '3 days', value: 1440 },
    { label: '4 days', value: 1920 },
    { label: '5 days', value: 2400 },
    { label: 'Custom', value: 'custom' }
];

// ============================================
// DURATION PICKER COMPONENT
// ============================================
const DurationPicker = ({ value, onChange, onTouched }) => {
    const [showCustom, setShowCustom] = useState(false);
    const [customHours, setCustomHours] = useState(Math.floor(value / 60));
    const [customMinutes, setCustomMinutes] = useState(value % 60);

    const isMultiDay = value > 480;
    const estimatedDays = Math.ceil(value / 480);

    const matchingPreset = DURATION_PRESETS.find(p => p.value === value);

    // Auto-show custom if no matching preset and value exists
    useEffect(() => {
        if (!matchingPreset && value) {
            setShowCustom(true);
            setCustomHours(Math.floor(value / 60));
            setCustomMinutes(value % 60);
        }
    }, [value, matchingPreset]);

    const handlePresetSelect = (preset) => {
        if (preset.value === 'custom') {
            setShowCustom(true);
        } else {
            onChange(preset.value);
            setShowCustom(false);
            onTouched?.();
        }
    };

    const handleCustomChange = () => {
        const totalMinutes = (parseInt(customHours) || 0) * 60 + (parseInt(customMinutes) || 0);
        if (totalMinutes > 0) {
            onChange(totalMinutes);
            onTouched?.();
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
                <Clock size={14} className="inline mr-1" />
                Duration
            </label>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.slice(0, 8).map(preset => (
                    <button
                        key={preset.value}
                        type="button"
                        onClick={() => handlePresetSelect(preset)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${value === preset.value
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                    >
                        {preset.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setShowCustom(!showCustom)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${showCustom
                        ? 'bg-slate-100 border-slate-300 text-slate-700 shadow-inner' // Active state
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                >
                    Custom
                </button>
            </div>

            {/* Custom inputs - Always visible if showCustom is true */}
            {showCustom && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Hours</label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                value={customHours}
                                onChange={(e) => {
                                    setCustomHours(e.target.value);
                                    // Live update if valid
                                    const h = parseInt(e.target.value) || 0;
                                    const m = parseInt(customMinutes) || 0;
                                    onChange(h * 60 + m);
                                }}
                                min="0"
                                className="w-20 px-2 py-1.5 border border-slate-200 rounded-l-lg text-sm focus:ring-2 focus:ring-emerald-500 z-10"
                                placeholder="0"
                            />
                            <div className="bg-white border-y border-r border-slate-200 px-2 py-1.5 rounded-r-lg text-slate-500 text-sm">hr</div>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Minutes</label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                value={customMinutes}
                                onChange={(e) => {
                                    setCustomMinutes(e.target.value);
                                    // Live update
                                    const m = parseInt(e.target.value) || 0;
                                    const h = parseInt(customHours) || 0;
                                    onChange(h * 60 + m);
                                }}
                                min="0"
                                max="59"
                                step="15"
                                className="w-20 px-2 py-1.5 border border-slate-200 rounded-l-lg text-sm focus:ring-2 focus:ring-emerald-500 z-10"
                                placeholder="0"
                            />
                            <div className="bg-white border-y border-r border-slate-200 px-2 py-1.5 rounded-r-lg text-slate-500 text-sm">min</div>
                        </div>
                    </div>

                    <div className="flex-1 text-right text-xs text-slate-400 self-end mb-2">
                        Total: {parseInt(customHours || 0) * 60 + parseInt(customMinutes || 0)} mins
                    </div>
                </div>
            )}

            {/* Multi-day presets */}
            {(isMultiDay) && !showCustom && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {DURATION_PRESETS.slice(8, 12).map(preset => (
                        <button
                            key={preset.value}
                            type="button"
                            onClick={() => handlePresetSelect(preset)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${value === preset.value
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Multi-day indicator */}
            {isMultiDay && (
                <div className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <Calendar size={14} className="text-indigo-600" />
                    <span className="text-xs font-medium text-indigo-700">
                        Multi-day job: ~{estimatedDays} work days
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================
// MULTI-CREW SELECTOR COMPONENT (Multi-Day Aware)
// ============================================
const MultiCrewSelector = ({
    teamMembers,
    selectedIds,
    onSelect,
    crewSizeRequired,
    scheduledDate,
    estimatedDuration,
    workingHours = {},
    existingJobs = [],
    onPerDayAssignmentChange
}) => {
    const [showPerDayView, setShowPerDayView] = useState(false);
    const [perDayAssignment, setPerDayAssignment] = useState({});

    // Check if this is a multi-day job
    const isMultiDay = estimatedDuration > 480; // More than 8 hours

    // Generate day segments for multi-day jobs
    const segments = useMemo(() => {
        if (!isMultiDay || !scheduledDate) return [];

        const startDate = new Date(scheduledDate);
        const segments = [];
        let remainingMinutes = estimatedDuration;
        let currentDate = new Date(startDate);
        let dayNumber = 1;

        while (remainingMinutes > 0 && dayNumber <= 30) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const dayConfig = workingHours[dayName];

            if (dayConfig?.enabled !== false) {
                const startTime = dayConfig?.start || '08:00';
                const endTime = dayConfig?.end || '17:00';
                const [startH, startM] = startTime.split(':').map(Number);
                const [endH, endM] = endTime.split(':').map(Number);
                const availableMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                const dayMinutes = Math.min(remainingMinutes, availableMinutes);

                const year = currentDate.getFullYear();
                const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
                const day = currentDate.getDate().toString().padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                segments.push({
                    date: dateStr,
                    dayNumber,
                    dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
                    startTime,
                    endTime,
                    durationMinutes: dayMinutes
                });

                remainingMinutes -= dayMinutes;
                dayNumber++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return segments;
    }, [isMultiDay, scheduledDate, estimatedDuration, workingHours]);

    // Calculate per-member availability across all days
    const memberAvailability = useMemo(() => {
        if (!teamMembers?.length) return new Map();
        if (!isMultiDay || segments.length === 0) {
            // Single day - just check the scheduled date
            if (!scheduledDate) return new Map();

            const date = new Date(scheduledDate);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

            const availability = new Map();
            teamMembers.forEach(tech => {
                const hours = tech.workingHours?.[dayName];
                const isAvailable = hours?.enabled !== false;
                availability.set(tech.id, {
                    memberId: tech.id,
                    memberName: tech.name,
                    fullyAvailable: isAvailable,
                    partiallyAvailable: false,
                    unavailableDays: isAvailable ? [] : [{ date: scheduledDate, reason: 'day_off', message: `Off on ${dayName}s` }],
                    conflicts: [],
                    availableDayCount: isAvailable ? 1 : 0
                });
            });
            return availability;
        }

        // Multi-day availability check
        const availability = new Map();
        teamMembers.forEach(member => {
            const unavailableDays = [];
            const conflicts = [];

            segments.forEach(segment => {
                const segmentDate = new Date(segment.date);
                const dayName = segmentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

                // Check working hours
                const dayConfig = member.workingHours?.[dayName];
                if (dayConfig?.enabled === false) {
                    unavailableDays.push({
                        date: segment.date,
                        dayNumber: segment.dayNumber,
                        reason: 'day_off',
                        message: `Off on ${dayName}s`
                    });
                    return;
                }

                // Check for job conflicts
                const memberJobs = existingJobs.filter(job => {
                    if (job.assignedTechId !== member.id && !job.assignedCrewIds?.includes(member.id)) return false;
                    const jobDate = job.scheduledTime || job.scheduledDate;
                    if (!jobDate) return false;
                    const jobDateObj = new Date(jobDate);
                    const year = jobDateObj.getFullYear();
                    const month = (jobDateObj.getMonth() + 1).toString().padStart(2, '0');
                    const day = jobDateObj.getDate().toString().padStart(2, '0');
                    return `${year}-${month}-${day}` === segment.date;
                });

                if (memberJobs.length > 0) {
                    conflicts.push({
                        date: segment.date,
                        dayNumber: segment.dayNumber,
                        jobCount: memberJobs.length,
                        message: `Has ${memberJobs.length} other job(s)`
                    });
                }
            });

            availability.set(member.id, {
                memberId: member.id,
                memberName: member.name,
                fullyAvailable: unavailableDays.length === 0 && conflicts.length === 0,
                partiallyAvailable: (unavailableDays.length > 0 || conflicts.length > 0) &&
                    (unavailableDays.length + conflicts.length) < segments.length,
                unavailableDays,
                conflicts,
                availableDayCount: segments.length - unavailableDays.length -
                    conflicts.filter(c => !unavailableDays.some(u => u.date === c.date)).length
            });
        });

        return availability;
    }, [teamMembers, segments, scheduledDate, isMultiDay, existingJobs]);

    // Calculate crew summary for multi-day jobs
    const crewSummary = useMemo(() => {
        if (!isMultiDay || segments.length === 0) return null;

        const dayBreakdown = segments.map(segment => {
            const availableCrewForDay = selectedIds.filter(crewId => {
                const avail = memberAvailability.get(crewId);
                if (!avail) return true;
                const unavailOnDay = avail.unavailableDays.some(u => u.date === segment.date);
                const conflictOnDay = avail.conflicts.some(c => c.date === segment.date);
                return !unavailOnDay && !conflictOnDay;
            });

            return {
                date: segment.date,
                dayNumber: segment.dayNumber,
                dayName: segment.dayName,
                availableCount: availableCrewForDay.length,
                shortage: Math.max(0, crewSizeRequired - availableCrewForDay.length),
                meetsRequirement: availableCrewForDay.length >= crewSizeRequired
            };
        });

        const daysWithShortage = dayBreakdown.filter(d => d.shortage > 0);

        return {
            dayBreakdown,
            hasShortage: daysWithShortage.length > 0,
            daysWithShortage
        };
    }, [isMultiDay, segments, selectedIds, memberAvailability, crewSizeRequired]);

    const toggleMember = (memberId) => {
        const newSelection = selectedIds.includes(memberId)
            ? selectedIds.filter(id => id !== memberId)
            : [...selectedIds, memberId];
        onSelect(newSelection);
    };

    if (!teamMembers?.length) return null;

    const meetsRequirement = selectedIds.length >= crewSizeRequired;

    return (
        <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Users size={16} className="text-slate-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Assign Crew</span>
                </div>
                <div className="flex items-center gap-2">
                    {isMultiDay && segments.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setShowPerDayView(!showPerDayView)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            {showPerDayView ? 'Simple view' : `View ${segments.length} days`}
                        </button>
                    )}
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${meetsRequirement
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                        }`}>
                        {selectedIds.length}/{crewSizeRequired} selected
                    </span>
                </div>
            </div>

            {/* Multi-day warning banner */}
            {isMultiDay && crewSummary?.hasShortage && selectedIds.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-medium text-amber-800">Crew shortage on some days</p>
                            <div className="mt-1 text-amber-700 text-xs">
                                {crewSummary.daysWithShortage.map(d => (
                                    <span key={d.date} className="inline-block mr-2">
                                        Day {d.dayNumber} ({d.dayName}): {d.availableCount}/{crewSizeRequired}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Per-day view for multi-day jobs */}
            {showPerDayView && isMultiDay && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                        <p className="text-xs font-semibold text-slate-600">Crew availability by day</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                        {crewSummary?.dayBreakdown.map(day => (
                            <div
                                key={day.date}
                                className={`px-4 py-2.5 border-b border-slate-100 last:border-b-0 flex items-center justify-between ${day.meetsRequirement ? 'bg-white' : 'bg-amber-50'
                                    }`}
                            >
                                <div>
                                    <span className="text-sm font-medium text-slate-700">
                                        Day {day.dayNumber}
                                    </span>
                                    <span className="text-xs text-slate-500 ml-1">
                                        ({day.dayName})
                                    </span>
                                </div>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${day.meetsRequirement
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {day.availableCount}/{crewSizeRequired} crew
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Crew member selection - Horizontal cards */}
            <div className="flex flex-wrap gap-3">
                {teamMembers.map(tech => {
                    const isSelected = selectedIds.includes(tech.id);
                    const availability = memberAvailability.get(tech.id);
                    const isFullyAvailable = availability?.fullyAvailable !== false;
                    const isPartiallyAvailable = availability?.partiallyAvailable === true;

                    return (
                        <button
                            key={tech.id}
                            type="button"
                            onClick={() => toggleMember(tech.id)}
                            className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200 ${isSelected
                                ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                }`}
                        >
                            {/* Avatar with selection indicator */}
                            <div className="relative">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}
                                    style={{ backgroundColor: tech.color || '#64748B' }}
                                >
                                    {tech.name?.charAt(0)}
                                </div>
                                {isSelected && (
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                                        <CheckCircle size={12} className="text-white" />
                                    </div>
                                )}
                                {isPartiallyAvailable && isMultiDay && !isSelected && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white" />
                                )}
                            </div>

                            {/* Name and role */}
                            <div className="text-left">
                                <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                                    {tech.name}
                                </p>
                                {isMultiDay && segments.length > 1 ? (
                                    <p className={`text-xs ${isFullyAvailable ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {isFullyAvailable
                                            ? `All ${segments.length} days`
                                            : `${availability?.availableDayCount || 0}/${segments.length} days`
                                        }
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500">{tech.role || 'technician'}</p>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Requirement warnings */}
            {!meetsRequirement && selectedIds.length > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 px-3 py-2 rounded-lg">
                    <AlertCircle size={12} />
                    Select {crewSizeRequired - selectedIds.length} more to meet crew requirement
                </p>
            )}

            {/* Multi-day all-clear indicator */}
            {isMultiDay && meetsRequirement && !crewSummary?.hasShortage && selectedIds.length > 0 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-lg">
                    <CheckCircle size={12} />
                    Full crew available for all {segments.length} days
                </p>
            )}
        </div>
    );
};


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
    vehicles = [],
    workingHours = {},
    existingJobs = [],
    contractorSettings = {}
}) => {
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [showAiSuggestion, setShowAiSuggestion] = useState(false);

    // Get defaults from contractor settings
    const defaultTaxRate = contractorSettings?.defaultTaxRate ?? 8.75;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        propertyAddress: '',
        estimatedDuration: 60,
        priority: 'normal',
        scheduledDate: '',
        scheduledTime: '',
        notes: '',
        crewSize: 1,
        assignedTechId: null,
        assignedTechName: null,
        // Enhanced fields
        assignedCrewIds: [],
        vehicleId: null,
        accessInstructions: '',
        poNumber: '',
        // Line items (replaces pricing breakdown)
        lineItems: [createNewLineItem('material')],
        // Tax and deposit
        taxRate: defaultTaxRate,
        depositRequired: false,
        depositType: 'percentage', // 'percentage' or 'fixed'
        depositValue: 50, // 50% or $50 depending on type
        depositCollected: false
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
            // Calculate totals from line items
            const lineItems = formData.lineItems || [];
            const subtotal = lineItems.reduce((sum, item) => {
                return sum + ((item.quantity || 0) * (item.unitPrice || 0));
            }, 0);

            // Calculate tax
            const taxRate = formData.taxRate || 0;
            const taxAmount = subtotal * (taxRate / 100);
            const total = subtotal + taxAmount;

            // Calculate deposit if required
            let depositAmount = 0;
            if (formData.depositRequired && !formData.depositCollected) {
                if (formData.depositType === 'percentage') {
                    depositAmount = total * (formData.depositValue / 100);
                } else {
                    depositAmount = formData.depositValue || 0;
                }
            }

            // Extract inventory intents from line items
            const inventoryIntents = lineItems
                .filter(item => item.inventoryIntent)
                .map(item => ({
                    ...item.inventoryIntent,
                    // Ensure the cost is synced
                    cost: (item.quantity || 1) * (item.unitPrice || 0)
                }));

            const jobData = {
                ...formData,
                price: total,
                estimatedDuration: parseInt(formData.estimatedDuration) || 60,
                crewSize: parseInt(formData.crewSize) || 1,
                // Line items with full details
                lineItems: lineItems.map(item => ({
                    id: item.id,
                    type: item.type,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    brand: item.brand || '',
                    model: item.model || '',
                    warranty: item.warranty || '',
                    category: item.category || 'Service & Repairs',
                    amount: (item.quantity || 1) * (item.unitPrice || 0)
                })),
                // Inventory intents for homeowner records
                inventoryIntents,
                // Pricing summary (enhanced with tax and deposit)
                pricing: {
                    subtotal,
                    taxRate,
                    taxAmount,
                    total,
                    itemCount: lineItems.length,
                    // Deposit info
                    depositRequired: formData.depositRequired,
                    depositType: formData.depositType,
                    depositValue: formData.depositValue,
                    depositAmount,
                    depositCollected: formData.depositCollected
                },
                // Crew assignment
                assignedCrewIds: formData.assignedCrewIds || [],
                // Additional fields
                vehicleId: formData.vehicleId || null,
                accessInstructions: formData.accessInstructions || '',
                poNumber: formData.poNumber || ''
            };

            const result = await createJobDirect(contractorId, jobData);

            if (result.success) {
                // Link to homeowner if customer email is provided
                let linkResult = null;
                if (formData.customerEmail) {
                    try {
                        linkResult = await linkJobToHomeowner(contractorId, result.jobId, formData.customerEmail);
                        console.log('[CreateJobModal] Job linking result:', linkResult);
                    } catch (linkError) {
                        // Don't fail the job creation, just log the error
                        console.warn('[CreateJobModal] Failed to link job to homeowner:', linkError);
                    }
                }

                // Show success with notification info
                if (linkResult?.userFound) {
                    toast.success(`Job ${result.jobNumber} created! Customer has been notified.`, {
                        duration: 4000,
                        icon: '🔔'
                    });
                } else {
                    toast.success(`Job ${result.jobNumber} created successfully!`);
                }
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
                    priority: 'normal',
                    scheduledDate: '',
                    scheduledTime: '',
                    notes: '',
                    crewSize: 1,
                    assignedTechId: null,
                    assignedTechName: null,
                    assignedCrewIds: [],
                    vehicleId: null,
                    accessInstructions: '',
                    poNumber: '',
                    lineItems: [createNewLineItem('material')],
                    // Tax and deposit reset
                    taxRate: defaultTaxRate,
                    depositRequired: false,
                    depositType: 'percentage',
                    depositValue: 50,
                    depositCollected: false
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
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${touched.title && errors.title ? 'border-red-300 bg-red-50' : 'border-slate-200'
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
                                    className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 ${formData.priority === 'urgent' ? 'bg-red-50 text-red-700' :
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
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${touched.customerName && errors.customerName ? 'border-red-300 bg-red-50' : 'border-slate-200'
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
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${touched.customerPhone && errors.customerPhone ? 'border-red-300 bg-red-50' : 'border-slate-200'
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
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${touched.customerEmail && errors.customerEmail ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                        }`}
                                />
                                {touched.customerEmail && errors.customerEmail && <ValidationError message={errors.customerEmail} />}
                                {formData.customerEmail && isValidEmail(formData.customerEmail) && !errors.customerEmail && (
                                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                        <CheckCircle size={10} />
                                        Job will be visible in customer's account
                                    </p>
                                )}
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
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${touched.propertyAddress && errors.propertyAddress ? 'border-red-300 bg-red-50' : 'border-slate-200'
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

                    {/* Duration Section */}
                    <DurationPicker
                        value={formData.estimatedDuration}
                        onChange={(val) => handleChange('estimatedDuration', val)}
                        onTouched={() => setTouched(prev => ({ ...prev, estimatedDuration: true }))}
                    />

                    {/* Crew Size Input - Enhanced with Helper Text */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Users size={14} className="inline mr-1" />
                                    Required Crew Size
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    How many technicians are typically needed for this job?
                                </p>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleChange('crewSize', Math.max(1, (formData.crewSize || 1) - 1))}
                                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                    >
                                        -
                                    </button>
                                    <span className="font-bold text-slate-800 w-8 text-center">{formData.crewSize || 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleChange('crewSize', (formData.crewSize || 1) + 1)}
                                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-2 rounded-lg flex items-start gap-2">
                                <Info size={14} className="mt-0.5 shrink-0" />
                                <span>
                                    <strong>Note:</strong> This helps our AI suggest the best crew, but you can manually assign any number of technicians in the assignment section below.
                                </span>
                            </div>
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

                        {!formData.scheduledDate && (
                            <p className="text-xs text-amber-600 flex items-center gap-1 bg-amber-50 p-2 rounded">
                                <Info size={12} />
                                Job will be created as "Pending" - schedule it later from the Jobs view
                            </p>
                        )}
                    </div>

                    {/* Crew Assignment Section */}
                    {teamMembers?.length > 0 && (
                        <MultiCrewSelector
                            teamMembers={teamMembers}
                            selectedIds={formData.assignedCrewIds}
                            onSelect={(ids) => {
                                handleChange('assignedCrewIds', ids);
                                // Also set primary tech for backward compatibility
                                if (ids.length > 0) {
                                    const primaryTech = teamMembers.find(t => t.id === ids[0]);
                                    setFormData(prev => ({
                                        ...prev,
                                        assignedTechId: ids[0],
                                        assignedTechName: primaryTech?.name || null
                                    }));
                                } else {
                                    setFormData(prev => ({
                                        ...prev,
                                        assignedTechId: null,
                                        assignedTechName: null
                                    }));
                                }
                            }}
                            crewSizeRequired={formData.crewSize || 1}
                            scheduledDate={formData.scheduledDate}
                            estimatedDuration={formData.estimatedDuration}
                            workingHours={workingHours}
                            existingJobs={existingJobs}
                        />
                    )}

                    {/* Vehicle Assignment */}
                    {vehicles?.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">
                                <Truck size={14} className="inline mr-1" />
                                Assign Vehicle
                            </label>
                            <select
                                value={formData.vehicleId || ''}
                                onChange={(e) => handleChange('vehicleId', e.target.value || null)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">No vehicle assigned</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.name || v.make} {v.model} - {v.licensePlate || v.plate}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Line Items Section */}
                    <JobLineItemsSection
                        lineItems={formData.lineItems}
                        onChange={(items) => setFormData(prev => ({ ...prev, lineItems: items }))}
                        // Tax props
                        taxRate={formData.taxRate}
                        onTaxRateChange={(rate) => setFormData(prev => ({ ...prev, taxRate: rate }))}
                        // Deposit props
                        depositRequired={formData.depositRequired}
                        onDepositRequiredChange={(required) => setFormData(prev => ({ ...prev, depositRequired: required }))}
                        depositType={formData.depositType}
                        onDepositTypeChange={(type) => setFormData(prev => ({ ...prev, depositType: type }))}
                        depositValue={formData.depositValue}
                        onDepositValueChange={(value) => setFormData(prev => ({ ...prev, depositValue: value }))}
                        depositCollected={formData.depositCollected}
                        onDepositCollectedChange={(collected) => setFormData(prev => ({ ...prev, depositCollected: collected }))}
                    />

                    {/* Additional Job Details */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                            <Info size={14} />
                            Additional Details
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    PO Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.poNumber}
                                    onChange={(e) => handleChange('poNumber', e.target.value)}
                                    placeholder="Optional PO #"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Access Instructions
                                </label>
                                <input
                                    type="text"
                                    value={formData.accessInstructions}
                                    onChange={(e) => handleChange('accessInstructions', e.target.value)}
                                    placeholder="Gate code, key location..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                />
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
                <div className="p-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 flex gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-5 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-white hover:border-slate-300 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !isFormValid}
                        className="flex-[2] px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 hover:shadow-emerald-300"
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
