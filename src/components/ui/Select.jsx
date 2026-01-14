import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';

export const Select = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select option',
    className = '',
    icon: Icon,
    label // Optional label above the input
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useClickOutside(containerRef, () => setIsOpen(false));

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    {label}
                </label>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl transition-all ${isOpen
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {Icon && <Icon size={18} className="text-slate-400" />}
                    {selectedOption?.icon && !Icon && (
                        <selectedOption.icon size={18} className="text-slate-500" />
                    )}
                    <span className={`truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            const OptionIcon = option.icon;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isSelected
                                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {OptionIcon && (
                                            <OptionIcon size={16} className={isSelected ? 'text-emerald-500' : 'text-slate-400'} />
                                        )}
                                        <span>{option.label}</span>
                                    </div>
                                    {isSelected && <Check size={14} className="text-emerald-500" />}
                                </button>
                            );
                        })}
                        {options.length === 0 && (
                            <div className="px-3 py-8 text-center text-slate-400 text-sm">
                                No options available
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
