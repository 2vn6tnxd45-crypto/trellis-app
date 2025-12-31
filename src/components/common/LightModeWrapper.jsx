// src/components/common/LightModeWrapper.jsx
// ============================================
// 🌞 LIGHT MODE WRAPPER
// ============================================
// Wraps contractor-facing pages to force light mode.
// This prevents the dark mode styling issues on pro pages.
//
// Usage:
// import { LightModeWrapper } from './components/common/LightModeWrapper';
// 
// <LightModeWrapper>
//   <ContractorInviteCreator />
// </LightModeWrapper>

import React, { useEffect, useRef } from 'react';

export const LightModeWrapper = ({ children, className = '' }) => {
    const wrapperRef = useRef(null);

    useEffect(() => {
        // Remove dark class from html element when this component mounts
        const htmlElement = document.documentElement;
        const wasDark = htmlElement.classList.contains('dark');
        
        if (wasDark) {
            htmlElement.classList.remove('dark');
        }
        
        // Restore dark class when component unmounts (if it was previously dark)
        return () => {
            if (wasDark) {
                htmlElement.classList.add('dark');
            }
        };
    }, []);

    return (
        <div 
            ref={wrapperRef}
            className={`light-mode-forced ${className}`}
            data-theme="light"
        >
            {children}
        </div>
    );
};

// Alternative: Simple CSS class approach
// Add this to krib-theme.css:
/*
.force-light-mode,
.force-light-mode * {
    --color-bg-primary: #ffffff;
    --color-bg-secondary: #f8fafc;
    --color-bg-tertiary: #f1f5f9;
    --color-bg-card: #ffffff;
    --color-bg-elevated: #f8fafc;
    --color-text-primary: #1e293b;
    --color-text-secondary: #475569;
    --color-text-tertiary: #94a3b8;
    --color-border-default: #e2e8f0;
    --color-border-subtle: #f1f5f9;
    --color-border-strong: #cbd5e1;
}

.force-light-mode .bg-white {
    background-color: #ffffff !important;
}

.force-light-mode .bg-slate-50 {
    background-color: #f8fafc !important;
}

.force-light-mode .bg-slate-100 {
    background-color: #f1f5f9 !important;
}

.force-light-mode .text-slate-800 {
    color: #1e293b !important;
}

.force-light-mode .text-slate-600 {
    color: #475569 !important;
}

.force-light-mode .border-slate-200 {
    border-color: #e2e8f0 !important;
}
*/

export default LightModeWrapper;
