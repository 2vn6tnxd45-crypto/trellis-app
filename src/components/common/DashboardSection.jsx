// src/components/common/DashboardSection.jsx
// ============================================
// 📦 THEME-AWARE DASHBOARD SECTION COMPONENT
// ============================================
// Collapsible section with smooth animations
// FIXED: Now handles dynamic content that loads asynchronously
// UPDATED: Added priority prop for smart default expansion

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * DashboardSection - A collapsible card section with theme-aware styling
 *
 * @param {string} priority - 'high' (always open), 'medium' (open by default), 'low' (collapsed by default)
 * @param {string} testId - data-testid attribute for testing
 */
export const DashboardSection = ({
    title,
    icon: Icon,
    children,
    defaultOpen = false,
    priority = 'medium',  // 'high' | 'medium' | 'low'
    summary = null,
    className = '',
    testId = null,
    onToggle = null
}) => {
    // Determine initial open state based on priority
    const getInitialOpenState = () => {
        if (priority === 'high') return true;      // Always start open
        if (priority === 'low') return false;       // Always start collapsed
        return defaultOpen;                          // Use defaultOpen for 'medium'
    };

    const [isOpen, setIsOpen] = useState(getInitialOpenState());
    const [isHovered, setIsHovered] = useState(false);
    const contentRef = useRef(null);
    const [contentHeight, setContentHeight] = useState('auto');

    // Use ResizeObserver to track content height changes (fixes async loading issue)
    useEffect(() => {
        if (!contentRef.current) return;

        const updateHeight = () => {
            if (contentRef.current) {
                setContentHeight(contentRef.current.scrollHeight);
            }
        };

        // Initial measurement
        updateHeight();

        // Watch for size changes (handles async data loading)
        const resizeObserver = new ResizeObserver(() => {
            updateHeight();
        });

        resizeObserver.observe(contentRef.current);

        return () => resizeObserver.disconnect();
    }, [children]);

    const handleToggle = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (onToggle) {
            onToggle(newState);
        }
    };

    // Generate a stable ID for accessibility
    const sectionId = `section-content-${title.replace(/\s+/g, '-').toLowerCase()}`;
    const componentTestId = testId || `dashboard-section-${title.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div
            data-testid={componentTestId}
            className={`
                bg-white
                dark:bg-[var(--color-bg-card,#242320)]
                rounded-2xl
                border
                border-slate-200
                dark:border-[var(--color-border-default,#3d3c38)]
                overflow-hidden
                shadow-sm
                transition-all
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        >
            {/* Clickable Header */}
            <button
                onClick={handleToggle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                aria-expanded={isOpen}
                aria-controls={sectionId}
                aria-label={`${title} section, ${isOpen ? 'expanded' : 'collapsed'}. Click to ${isOpen ? 'collapse' : 'expand'}.`}
                data-testid={`${componentTestId}-toggle`}
                className={`
                    w-full 
                    p-4 
                    flex 
                    items-center 
                    justify-between 
                    transition-all 
                    duration-200 
                    group
                    bg-[var(--color-section-header-bg,#e8ebe3)]
                    dark:bg-[var(--color-section-header-bg,#2a2e26)]
                    ${isOpen 
                        ? 'border-b border-[var(--color-section-header-border,#d3d9c9)] dark:border-[var(--color-section-header-border,#3d4236)]' 
                        : ''
                    }
                    hover:brightness-[0.97] 
                    dark:hover:brightness-110
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[var(--color-accent,#566449)]
                    focus-visible:ring-offset-2
                `.trim().replace(/\s+/g, ' ')}
            >
                <div className="flex items-center gap-3">
                    {/* Icon Container */}
                    <div 
                        className={`
                            h-10 
                            w-10 
                            rounded-xl 
                            flex 
                            items-center 
                            justify-center 
                            transition-all
                            duration-200
                            bg-[var(--color-section-header-icon-bg,#d3d9c9)]
                            dark:bg-[var(--color-section-header-icon-bg,#32382d)]
                            text-[var(--color-accent,#566449)]
                            dark:text-[var(--color-accent,#97a67f)]
                            shadow-sm
                            group-hover:scale-105
                        `.trim().replace(/\s+/g, ' ')}
                    >
                        <Icon size={20} />
                    </div>
                    
                    {/* Title & Summary */}
                    <div className="text-left">
                        <p 
                            className={`
                                font-bold 
                                transition-colors
                                text-[var(--color-section-header-text,#26241f)]
                                dark:text-[var(--color-section-header-text,#f0efed)]
                            `.trim().replace(/\s+/g, ' ')}
                        >
                            {title}
                        </p>
                        
                        {/* Summary - only show when collapsed */}
                        {!isOpen && summary && (
                            <div 
                                className="
                                    flex 
                                    items-center 
                                    gap-2 
                                    mt-0.5 
                                    animate-in 
                                    fade-in 
                                    slide-in-from-left-1 
                                    duration-200
                                    text-[var(--color-section-header-subtext,#5f5a53)]
                                    dark:text-[var(--color-section-header-subtext,#a9a49b)]
                                    text-xs
                                "
                            >
                                {summary}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Chevron Toggle with Collapse/Expand indicator */}
                <div 
                    className={`
                        flex 
                        items-center 
                        gap-1.5 
                        px-3 
                        py-1.5 
                        rounded-full 
                        transition-all 
                        duration-200
                        ${isHovered 
                            ? 'bg-[var(--color-accent,#566449)]/10 dark:bg-[var(--color-accent,#97a67f)]/20 text-[var(--color-accent,#566449)] dark:text-[var(--color-accent,#97a67f)]' 
                            : 'bg-slate-200 dark:bg-[var(--color-bg-elevated,#2c2b27)] text-slate-600 dark:text-[var(--color-text-tertiary,#736d64)]'
                        }
                    `.trim().replace(/\s+/g, ' ')}
                >
                    {/* Collapse/Expand text - reveals on hover */}
                    <span 
                        className={`
                            text-xs 
                            font-medium 
                            transition-all 
                            duration-200 
                            overflow-hidden 
                            whitespace-nowrap
                            ${isHovered ? 'opacity-100 max-w-16' : 'opacity-0 max-w-0'}
                        `.trim().replace(/\s+/g, ' ')}
                    >
                        {isOpen ? 'Collapse' : 'Expand'}
                    </span>
                    
                    {/* Chevron icon */}
                    <ChevronDown 
                        size={18} 
                        className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>
            
            {/* FIXED: Smooth height-animated Collapsible Content */}
            <div
                id={sectionId}
                role="region"
                aria-labelledby={`${sectionId}-header`}
                className="transition-all duration-300 ease-in-out overflow-hidden"
                style={{
                    maxHeight: isOpen ? `${contentHeight}px` : '0px',
                    opacity: isOpen ? 1 : 0,
                }}
            >
                <div 
                    ref={contentRef}
                    className="
                        p-4 
                        bg-white 
                        dark:bg-[var(--color-bg-card,#242320)]
                    "
                >
                    {children}
                </div>
            </div>
        </div>
    );
};

// ============================================
// VARIANT: Settings Section (for Settings pages)
// ============================================
export const SettingsSection = ({ 
    title, 
    icon: Icon, 
    children, 
    danger = false,
    className = '' 
}) => {
    return (
        <div 
            className={`
                bg-white 
                dark:bg-[var(--color-bg-card,#242320)]
                rounded-2xl 
                border 
                ${danger 
                    ? 'border-red-200 dark:border-red-900/50' 
                    : 'border-slate-200 dark:border-[var(--color-border-default,#3d3c38)]'
                }
                overflow-hidden 
                shadow-sm
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        >
            {/* Header */}
            <div 
                className={`
                    p-4 
                    flex 
                    items-center 
                    gap-3 
                    border-b
                    ${danger 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30' 
                        : 'bg-[var(--color-section-header-bg,#e8ebe3)] dark:bg-[var(--color-section-header-bg,#2a2e26)] border-[var(--color-section-header-border,#d3d9c9)] dark:border-[var(--color-section-header-border,#3d4236)]'
                    }
                `.trim().replace(/\s+/g, ' ')}
            >
                <div 
                    className={`
                        h-10 
                        w-10 
                        rounded-xl 
                        flex 
                        items-center 
                        justify-center
                        ${danger 
                            ? 'bg-red-100 dark:bg-red-900/30' 
                            : 'bg-[var(--color-section-header-icon-bg,#d3d9c9)] dark:bg-[var(--color-section-header-icon-bg,#32382d)]'
                        }
                    `.trim().replace(/\s+/g, ' ')}
                >
                    <Icon 
                        size={20} 
                        className={
                            danger 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-[var(--color-accent,#566449)] dark:text-[var(--color-accent,#97a67f)]'
                        } 
                    />
                </div>
                <h3 
                    className={`
                        font-bold 
                        ${danger 
                            ? 'text-red-900 dark:text-red-200' 
                            : 'text-[var(--color-section-header-text,#26241f)] dark:text-[var(--color-section-header-text,#f0efed)]'
                        }
                    `.trim().replace(/\s+/g, ' ')}
                >
                    {title}
                </h3>
            </div>
            
            {/* Content */}
            <div className="divide-y divide-slate-100 dark:divide-[var(--color-border-subtle,#32302b)]">
                {children}
            </div>
        </div>
    );
};

// ============================================
// VARIANT: Compact Section (for sidebars/panels)
// ============================================
export const CompactSection = ({ 
    title, 
    children, 
    defaultOpen = true,
    className = '' 
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`${className}`}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="
                    w-full 
                    flex 
                    items-center 
                    justify-between 
                    py-2 
                    text-xs 
                    font-bold 
                    uppercase 
                    tracking-wider
                    text-[var(--color-text-tertiary,#8a847a)]
                    dark:text-[var(--color-text-tertiary,#736d64)]
                    hover:text-[var(--color-text-secondary,#5f5a53)]
                    dark:hover:text-[var(--color-text-secondary,#a9a49b)]
                    transition-colors
                "
            >
                {title}
                <ChevronDown 
                    size={14} 
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>
            
            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export default DashboardSection;
