// src/components/common/CalendarPicker.jsx
// ============================================
// CALENDAR DATE PICKER
// ============================================
// A compact, inline calendar for selecting dates

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================
// HELPERS
// ============================================

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

const isBeforeToday = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

// ============================================
// MAIN COMPONENT
// ============================================

export const CalendarPicker = ({ 
    selectedDate, 
    onSelectDate,
    minDate = null,  // Optional: earliest selectable date
    maxDate = null,  // Optional: latest selectable date
    disabledDays = [0], // Days of week to disable (0 = Sunday)
    highlightedDates = [], // Dates to highlight (e.g., dates with jobs)
    compact = false
}) => {
    const [viewDate, setViewDate] = useState(() => {
        if (selectedDate) return new Date(selectedDate);
        return new Date();
    });

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Navigate months
    const goToPrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const goToToday = () => {
        const today = new Date();
        setViewDate(today);
    };

    // Check if a date is selectable
    const isDateSelectable = (date) => {
        // Check if day of week is disabled
        if (disabledDays.includes(date.getDay())) return false;
        
        // Check if before min date
        if (minDate && date < minDate) return false;
        
        // Check if after max date
        if (maxDate && date > maxDate) return false;
        
        // Check if in the past
        if (isBeforeToday(date)) return false;
        
        return true;
    };

    // Check if a date has highlights (e.g., existing jobs)
    const hasHighlight = (date) => {
        return highlightedDates.some(d => isSameDay(new Date(d), date));
    };

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            days.push({ type: 'empty', key: `empty-${i}` });
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = isSameDay(date, today);
            const isSelected = selectedDate && isSameDay(date, new Date(selectedDate));
            const selectable = isDateSelectable(date);
            const highlighted = hasHighlight(date);

            days.push({
                type: 'day',
                key: `day-${day}`,
                day,
                date,
                isToday,
                isSelected,
                selectable,
                highlighted
            });
        }

        return days;
    }, [year, month, selectedDate, highlightedDates, disabledDays]);

    const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${compact ? 'text-xs' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-slate-100 bg-slate-50">
                <button
                    onClick={goToPrevMonth}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                    type="button"
                >
                    <ChevronLeft size={compact ? 14 : 16} className="text-slate-600" />
                </button>
                
                <div className="flex items-center gap-2">
                    <span className={`font-bold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
                        {monthName}
                    </span>
                    <button
                        onClick={goToToday}
                        className={`px-2 py-0.5 text-emerald-600 hover:bg-emerald-50 rounded font-medium ${compact ? 'text-[10px]' : 'text-xs'}`}
                        type="button"
                    >
                        Today
                    </button>
                </div>
                
                <button
                    onClick={goToNextMonth}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                    type="button"
                >
                    <ChevronRight size={compact ? 14 : 16} className="text-slate-600" />
                </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-slate-100">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div 
                        key={idx}
                        className={`py-1.5 text-center font-medium ${
                            disabledDays.includes(idx) 
                                ? 'text-slate-300' 
                                : 'text-slate-500'
                        } ${compact ? 'text-[10px]' : 'text-xs'}`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 p-1">
                {calendarDays.map((item) => {
                    if (item.type === 'empty') {
                        return <div key={item.key} className={compact ? 'h-6' : 'h-8'} />;
                    }

                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => item.selectable && onSelectDate(item.date)}
                            disabled={!item.selectable}
                            className={`
                                ${compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'}
                                mx-auto rounded-full flex items-center justify-center font-medium transition-all relative
                                ${item.isSelected 
                                    ? 'bg-emerald-600 text-white' 
                                    : item.isToday
                                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                                        : item.selectable
                                            ? 'hover:bg-slate-100 text-slate-700'
                                            : 'text-slate-300 cursor-not-allowed'
                                }
                            `}
                        >
                            {item.day}
                            {/* Highlight dot for dates with existing jobs */}
                            {item.highlighted && !item.isSelected && (
                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend (optional) */}
            {highlightedDates.length > 0 && (
                <div className="px-2 py-1.5 border-t border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>Has scheduled jobs</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// INLINE DATE PICKER (for forms)
// ============================================
// Shows selected date with click to open calendar

export const DatePickerInput = ({
    value,
    onChange,
    placeholder = "Select date...",
    disabledDays = [0],
    highlightedDates = [],
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const formattedDate = value 
        ? new Date(value).toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        })
        : null;

    const handleSelect = (date) => {
        // Convert to YYYY-MM-DD string
        const dateStr = date.toISOString().split('T')[0];
        onChange(dateStr);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2.5 border rounded-xl text-left transition-all ${
                    isOpen 
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                        : 'border-slate-200 hover:border-slate-300'
                } ${value ? 'text-slate-800' : 'text-slate-400'}`}
            >
                {formattedDate || placeholder}
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Calendar dropdown */}
                    <div className="absolute top-full left-0 mt-1 z-20 shadow-xl animate-in fade-in zoom-in-95">
                        <CalendarPicker
                            selectedDate={value}
                            onSelectDate={handleSelect}
                            disabledDays={disabledDays}
                            highlightedDates={highlightedDates}
                            compact={true}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default CalendarPicker;
