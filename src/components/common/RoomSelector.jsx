// src/components/common/RoomSelector.jsx
// ============================================
// DYNAMIC ROOM SELECTOR
// ============================================
// Dropdown with property-aware room options
// Supports custom entry for rooms not in the list

import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown, Home, Plus, Check } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import { groupRoomsByCategory, getDefaultRoomOptions } from '../../utils/roomUtils';
import { useClickOutside } from '../../hooks/useClickOutside';

/**
 * RoomSelector - Dynamic room dropdown based on property data
 * 
 * @param {string} value - Currently selected room value
 * @param {function} onChange - Callback when room changes (receives value string)
 * @param {string} placeholder - Placeholder text
 * @param {boolean} allowCustom - Allow custom room entry (default: true)
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable the selector
 * @param {Array} customOptions - Override room options (for contractor invite without property context)
 */
export function RoomSelector({
    value,
    onChange,
    placeholder = 'Select room...',
    allowCustom = true,
    className = '',
    disabled = false,
    customOptions = null
}) {
    const { roomOptions: contextRoomOptions } = useProperty();
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customValue, setCustomValue] = useState('');

    // Use custom options if provided, otherwise use context options
    const roomOptions = customOptions || contextRoomOptions || getDefaultRoomOptions();

    // Group rooms by category for better UX
    const groupedRooms = useMemo(() => {
        return groupRoomsByCategory(roomOptions);
    }, [roomOptions]);

    // Check if current value exists in options
    const valueExists = useMemo(() => {
        return roomOptions.some(r => r.value === value);
    }, [roomOptions, value]);

    // Get display label for current value
    const displayLabel = useMemo(() => {
        if (!value) return null;
        const found = roomOptions.find(r => r.value === value);
        if (found) return found.label;
        // Custom value - format it nicely
        return value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }, [value, roomOptions]);

    // Custom Dropdown State
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    useClickOutside(containerRef, () => setIsOpen(false));

    const handleSelectOption = (optionValue) => {
        if (optionValue === '__custom__') {
            setShowCustomInput(true);
            setCustomValue('');
            setIsOpen(false);
        } else {
            onChange(optionValue);
            setIsOpen(false);
        }
    };

    if (showCustomInput) {
        return (
            <div className={`flex gap-2 ${className}`}>
                <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={handleCustomKeyDown}
                    placeholder="Enter room name..."
                    autoFocus
                    className="
                        flex-1
                        px-3 py-2
                        border border-slate-200 rounded-lg
                        text-sm text-slate-800
                        focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                        placeholder:text-slate-400
                    "
                />
                <button
                    type="button"
                    onClick={handleCustomSubmit}
                    disabled={!customValue.trim()}
                    className="
                        px-3 py-2
                        bg-emerald-500 text-white rounded-lg
                        text-sm font-medium
                        hover:bg-emerald-600
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors
                    "
                >
                    Add
                </button>
                <button
                    type="button"
                    onClick={() => { setShowCustomInput(false); setCustomValue(''); }}
                    className="
                        px-3 py-2
                        bg-slate-100 text-slate-600 rounded-lg
                        text-sm font-medium
                        hover:bg-slate-200
                        transition-colors
                    "
                >
                    Cancel
                </button>
            </div>
        );
    }

    // Find label for current value
    const currentLabel = value ? (
        roomOptions.find(r => r.value === value)?.label ||
        value.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ) : placeholder;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between
                    px-3 py-2
                    border rounded-lg
                    text-sm
                    bg-white
                    transition-all
                    ${isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}
                    ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'text-slate-800 cursor-pointer'}
                `}
            >
                <span className={`truncate ${!value ? 'text-slate-400' : ''}`}>
                    {currentLabel}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        {/* Grouped options */}
                        {Object.entries(groupedRooms).map(([category, rooms]) => (
                            <div key={category} className="mb-2 last:mb-0">
                                <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {category}
                                </div>
                                {rooms.map(room => (
                                    <button
                                        key={room.value}
                                        type="button"
                                        onClick={() => handleSelectOption(room.value)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                                            ${room.value === value
                                                ? 'bg-emerald-50 text-emerald-700 font-medium'
                                                : 'text-slate-600 hover:bg-slate-50'}
                                        `}
                                    >
                                        <span>{room.label}</span>
                                        {room.value === value && <Check size={14} className="text-emerald-500" />}
                                    </button>
                                ))}
                            </div>
                        ))}

                        {/* Current value if custom */}
                        {value && !valueExists && (
                            <div className="mb-2 border-t border-slate-100 pt-1">
                                <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Current Selection
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleSelectOption(value)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-emerald-50 text-emerald-700 font-medium"
                                >
                                    <span>{displayLabel}</span>
                                    <Check size={14} className="text-emerald-500" />
                                </button>
                            </div>
                        )}

                        {/* Custom entry option */}
                        {allowCustom && (
                            <div className="border-t border-slate-100 pt-1 mt-1">
                                <button
                                    type="button"
                                    onClick={() => handleSelectOption('__custom__')}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-emerald-600 font-medium hover:bg-emerald-50 transition-colors"
                                >
                                    <Plus size={14} />
                                    <span>Add custom room...</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * RoomSelectorSimple - Simpler version without grouping for compact UIs
 */
export function RoomSelectorSimple({
    value,
    onChange,
    placeholder = 'Select room...',
    className = '',
    disabled = false,
    options = null
}) {
    const { roomOptions: contextRoomOptions } = useProperty();
    const roomOptions = options || contextRoomOptions || getDefaultRoomOptions();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    useClickOutside(containerRef, () => setIsOpen(false));

    const selectedLabel = roomOptions.find(r => r.value === value)?.label || placeholder;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between
                    px-3 py-2
                    border rounded-lg
                    text-sm
                    bg-white
                    transition-all
                    ${isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}
                    ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'text-slate-800 cursor-pointer'}
                `}
            >
                <span className={`truncate ${!value ? 'text-slate-400' : ''}`}>
                    {selectedLabel}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        {roomOptions.map(room => (
                            <button
                                key={room.value}
                                type="button"
                                onClick={() => { onChange(room.value); setIsOpen(false); }}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                                    ${room.value === value
                                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50'}
                                `}
                            >
                                <span>{room.label}</span>
                                {room.value === value && <Check size={14} className="text-emerald-500" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default RoomSelector;
