// src/components/common/LoadingStates.jsx
// ============================================
// SHARED LOADING COMPONENTS
// ============================================
// Consistent loading states across the app
//
// Components:
// - FullPageLoader: Full-screen overlay for initial app/page loads
// - SectionLoader: Loading state for sections/cards within a page
// - ButtonLoader: Inline spinner for buttons during async operations
// - SkeletonCard: Placeholder card while content loads
// - SkeletonText: Single line text placeholder for custom layouts
//
// Usage examples:
// <FullPageLoader message="Loading your dashboard..." />
// <SectionLoader size="sm" message="Fetching data..." />
// <button disabled={loading}>{loading ? <ButtonLoader /> : 'Save'}</button>
// <SkeletonCard lines={3} showImage />
// <SkeletonText width="w-3/4" />

import React from 'react';
import { Loader2 } from 'lucide-react';

// ============================================
// FULL PAGE LOADER
// ============================================
// Use for: Initial app load, full page transitions, blocking operations
export const FullPageLoader = ({ message = "Loading..." }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-600">{message}</p>
            </div>
        </div>
    );
};

// ============================================
// SECTION LOADER
// ============================================
// Use for: Loading state within a card, panel, or section of a page
export const SectionLoader = ({
    message = "Loading...",
    className = "",
    size = "md"
}) => {
    const sizeConfig = {
        sm: {
            padding: "py-6",
            spinner: "w-5 h-5",
            text: "text-sm"
        },
        md: {
            padding: "py-12",
            spinner: "w-6 h-6",
            text: "text-base"
        },
        lg: {
            padding: "py-16",
            spinner: "w-8 h-8",
            text: "text-lg"
        }
    };

    const config = sizeConfig[size] || sizeConfig.md;

    return (
        <div className={`flex flex-col items-center justify-center ${config.padding} ${className}`}>
            <Loader2 className={`${config.spinner} text-emerald-600 animate-spin mb-3`} />
            <p className={`text-slate-500 ${config.text}`}>{message}</p>
        </div>
    );
};

// ============================================
// BUTTON LOADER
// ============================================
// Use for: Inline loading indicator within buttons
// Inherits color from parent element
export const ButtonLoader = ({ size = 16, className = "" }) => {
    return (
        <Loader2
            size={size}
            className={`animate-spin ${className}`}
        />
    );
};

// ============================================
// SKELETON CARD
// ============================================
// Use for: Placeholder while card content loads
export const SkeletonCard = ({
    lines = 3,
    showImage = false,
    className = ""
}) => {
    // Generate varying widths for text lines to look more natural
    const lineWidths = ['w-3/4', 'w-full', 'w-5/6', 'w-4/6', 'w-2/3'];

    return (
        <div className={`bg-white rounded-2xl border border-slate-200 p-4 animate-pulse ${className}`}>
            <div className="flex gap-4">
                {/* Optional image placeholder */}
                {showImage && (
                    <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0" />
                )}

                {/* Text lines */}
                <div className="flex-1 space-y-2">
                    {Array.from({ length: lines }).map((_, index) => (
                        <div
                            key={index}
                            className={`${index === 0 ? 'h-4 w-3/4' : `h-3 ${lineWidths[index % lineWidths.length]}`} bg-slate-${index === 0 ? '200' : '100'} rounded`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================
// SKELETON TEXT
// ============================================
// Use for: Single line placeholder in custom layouts
export const SkeletonText = ({
    width = "w-full",
    height = "h-4",
    className = ""
}) => {
    return (
        <div className={`animate-pulse bg-slate-200 rounded ${width} ${height} ${className}`} />
    );
};

// ============================================
// SKELETON LIST
// ============================================
// Use for: Placeholder for list items
export const SkeletonList = ({
    count = 3,
    showAvatar = false,
    className = ""
}) => {
    return (
        <div className={`space-y-3 ${className}`}>
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 animate-pulse">
                    {showAvatar && (
                        <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// INLINE LOADER
// ============================================
// Use for: Small inline loading indicator with optional text
export const InlineLoader = ({
    message = "",
    size = 14,
    className = ""
}) => {
    return (
        <span className={`inline-flex items-center gap-2 text-slate-500 ${className}`}>
            <Loader2 size={size} className="animate-spin" />
            {message && <span className="text-sm">{message}</span>}
        </span>
    );
};

// Named exports
export default {
    FullPageLoader,
    SectionLoader,
    ButtonLoader,
    SkeletonCard,
    SkeletonText,
    SkeletonList,
    InlineLoader
};
