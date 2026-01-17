// src/components/common/LoadingOverlay.jsx
// ============================================
// LOADING OVERLAY
// ============================================
// Full-screen loading overlay for async operations
// Use when user action triggers a process that blocks further interaction

import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingOverlay = ({
    isVisible,
    message = "Loading...",
    submessage = null,
    transparent = false
}) => {
    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-[150] flex items-center justify-center ${
                transparent ? 'bg-black/30' : 'bg-white/90'
            } backdrop-blur-sm animate-in fade-in duration-200`}
            role="status"
            aria-live="polite"
            aria-label={message}
        >
            <div className="text-center p-6">
                <div className="relative mb-4">
                    {/* Outer ring */}
                    <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-emerald-100 mx-auto" />
                    {/* Spinning loader */}
                    <Loader2 className="h-12 w-12 text-emerald-600 animate-spin mx-auto" />
                </div>
                <p className="text-lg font-bold text-slate-800">{message}</p>
                {submessage && (
                    <p className="text-sm text-slate-500 mt-1">{submessage}</p>
                )}
            </div>
        </div>
    );
};

export default LoadingOverlay;
