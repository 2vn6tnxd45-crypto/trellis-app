// src/features/contractor-pro/components/QuickServiceCallButton.jsx
// ============================================
// QUICK SERVICE CALL FLOATING BUTTON
// ============================================
// Always-visible floating action button for quick service calls

import React, { useState } from 'react';
import { Phone, Plus, X } from 'lucide-react';

export const QuickServiceCallButton = ({
    onClick,
    position = 'bottom-right', // 'bottom-right' | 'bottom-left' | 'bottom-center'
    showLabel = true,
    variant = 'default' // 'default' | 'minimal' | 'expanded'
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // Position classes
    const positionClasses = {
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6',
        'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2'
    };

    // Minimal variant - just an icon
    if (variant === 'minimal') {
        return (
            <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`fixed ${positionClasses[position]} z-40 w-14 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center group`}
                title="Quick Service Call"
            >
                <Phone size={24} className={`transition-transform ${isHovered ? 'scale-110' : ''}`} />

                {/* Tooltip */}
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
                    <div className="bg-slate-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                        Quick Service Call
                        <div className="absolute top-full right-4 -mt-1">
                            <div className="border-4 border-transparent border-t-slate-800" />
                        </div>
                    </div>
                </div>
            </button>
        );
    }

    // Expanded variant - always shows label
    if (variant === 'expanded') {
        return (
            <button
                onClick={onClick}
                className={`fixed ${positionClasses[position]} z-40 flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all`}
            >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Phone size={20} />
                </div>
                <div className="text-left">
                    <p className="font-bold text-sm">New Call</p>
                    <p className="text-xs text-emerald-100">Quick schedule</p>
                </div>
            </button>
        );
    }

    // Default variant - expands on hover
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`fixed ${positionClasses[position]} z-40 flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all overflow-hidden`}
            style={{
                padding: isHovered && showLabel ? '12px 20px 12px 12px' : '14px',
                minWidth: isHovered && showLabel ? '160px' : '56px'
            }}
        >
            <div className={`flex items-center justify-center transition-transform ${isHovered ? 'scale-110' : ''}`}>
                <Phone size={24} />
            </div>

            {/* Label that appears on hover */}
            {showLabel && (
                <span
                    className={`font-semibold text-sm whitespace-nowrap transition-all ${
                        isHovered ? 'opacity-100 max-w-32' : 'opacity-0 max-w-0'
                    }`}
                >
                    + New Call
                </span>
            )}

            {/* Pulse animation ring */}
            <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-20" style={{ animationDuration: '2s' }} />
        </button>
    );
};

// ============================================
// QUICK SERVICE CALL FAB WITH TOOLTIP
// ============================================
// Alternative version with more prominent tooltip

export const QuickServiceCallFAB = ({
    onClick,
    unreadCount = 0,
    position = 'bottom-right'
}) => {
    const positionClasses = {
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6',
        'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2'
    };

    return (
        <div className={`fixed ${positionClasses[position]} z-40 group`}>
            {/* Main button */}
            <button
                onClick={onClick}
                className="relative w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
            >
                <Plus size={28} strokeWidth={2.5} />

                {/* Badge for unread/pending */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Expanded tooltip on hover */}
            <div className="absolute bottom-full right-0 mb-3 hidden group-hover:block">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden w-48">
                    <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-600">
                        <p className="text-white font-semibold text-sm">Quick Service Call</p>
                        <p className="text-emerald-100 text-xs">Schedule in 60 seconds</p>
                    </div>
                    <div className="p-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2 mb-1">
                            <Phone size={12} />
                            Customer search + quick add
                        </div>
                        <div className="flex items-center gap-2">
                            <Plus size={12} />
                            Auto SMS confirmation
                        </div>
                    </div>
                </div>
                {/* Arrow */}
                <div className="absolute top-full right-6 -mt-1">
                    <div className="border-8 border-transparent border-t-white" />
                </div>
            </div>
        </div>
    );
};

export default QuickServiceCallButton;
