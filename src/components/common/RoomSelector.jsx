// src/components/common/RoomSelector.jsx
// ============================================
// DYNAMIC ROOM SELECTOR
// ============================================
// Dropdown with property-aware room options
// Supports custom entry for rooms not in the list

import React, { useState, useMemo } from 'react';
import { ChevronDown, Home, Plus } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import { groupRoomsByCategory, getDefaultRoomOptions } from '../../utils/roomUtils';

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

    const handleSelectChange = (e) => {
        const newValue = e.target.value;
        
        if (newValue === '__custom__') {
            setShowCustomInput(true);
            setCustomValue('');
        } else {
            setShowCustomInput(false);
            onChange(newValue);
        }
    };
    
    const handleCustomSubmit = () => {
        if (customValue.trim()) {
            // Convert to slug format for storage
            const slug = customValue.trim().toLowerCase().replace(/\s+/g, '-');
            onChange(slug);
            setShowCustomInput(false);
            setCustomValue('');
        }
    };
    
    const handleCustomKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCustomSubmit();
        } else if (e.key === 'Escape') {
            setShowCustomInput(false);
            setCustomValue('');
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

    return (
        <div className={`relative ${className}`}>
            <select
                value={value || ''}
                onChange={handleSelectChange}
                disabled={disabled}
                className="
                    w-full
                    appearance-none
                    px-3 py-2 pr-10
                    border border-slate-200 rounded-lg
                    text-sm text-slate-800
                    bg-white
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                    cursor-pointer
                "
            >
                <option value="">{placeholder}</option>
                
                {/* Grouped options */}
                {Object.entries(groupedRooms).map(([category, rooms]) => (
                    <optgroup key={category} label={category}>
                        {rooms.map(room => (
                            <option key={room.value} value={room.value}>
                                {room.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
                
                {/* Show current value if it's not in the list (legacy/custom) */}
                {value && !valueExists && (
                    <optgroup label="Current Selection">
                        <option value={value}>{displayLabel}</option>
                    </optgroup>
                )}
                
                {/* Custom entry option */}
                {allowCustom && (
                    <optgroup label="─────────────">
                        <option value="__custom__">+ Add custom room...</option>
                    </optgroup>
                )}
            </select>
            
            {/* Dropdown arrow */}
            <ChevronDown 
                size={16} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
            />
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

    return (
        <div className={`relative ${className}`}>
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="
                    w-full
                    appearance-none
                    px-3 py-2 pr-10
                    border border-slate-200 rounded-lg
                    text-sm text-slate-800
                    bg-white
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                    cursor-pointer
                "
            >
                <option value="">{placeholder}</option>
                {roomOptions.map(room => (
                    <option key={room.value} value={room.value}>
                        {room.label}
                    </option>
                ))}
            </select>
            
            <ChevronDown 
                size={16} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
            />
        </div>
    );
}

export default RoomSelector;
