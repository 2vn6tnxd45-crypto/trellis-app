// src/components/common/DashboardSection.jsx
// ============================================
// 📦 THEME-AWARE DASHBOARD SECTION COMPONENT
// ============================================
// Collapsible section with Sage Tinted headers
// Works in both light and dark mode
//
// Usage:
// import { DashboardSection } from '../../components/common/DashboardSection';
//
// <DashboardSection 
//     title="Quick Actions" 
//     icon={Sparkles} 
//     defaultOpen={true}
//     summary={<span className="text-xs">4 shortcuts</span>}
// >
//     {children}
// </DashboardSection>

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * DashboardSection - A collapsible card section with theme-aware styling
 * 
 * @param {string} title - Section title
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {React.ReactNode} children - Section content
 * @param {boolean} defaultOpen - Whether section starts expanded (default: false)
 * @param {React.ReactNode} summary - Optional summary shown when collapsed
 * @param {string} className - Additional classes for the container
 * @param {function} onToggle - Optional callback when section is toggled
 */
export const DashboardSection = ({ 
    title, 
    icon: Icon, 
    children, 
    defaultOpen = false, 
    summary = null,
    className = '',
    onToggle = null
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [isHovered, setIsHovered] = useState(false);
    const contentRef = useRef(null);
    const [contentHeight, setContentHeight] = useState(0);

    // Measure content height for smooth animation
    useEffect(() => {
        if (contentRef.current) {
            setContentHeight(contentRef.current.scrollHeight);
        }
    }, [children, isOpen]);

    const handleToggle = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (onToggle) {
            onToggle(newState);
        }
    };

    return (
        <div 
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
                aria-controls={`section-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
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
                
                {/* IMPROVED: Chevron Toggle with Collapse/Expand indicator */}
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
            
            {/* IMPROVED: Smooth height-animated Collapsible Content */}
            <div 
                id={`section-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
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
// A simpler variant without the collapse animation,
// designed for settings/preferences pages

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
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        >
            {/* Header */}
            <div 
                className={`
                    px-5 
                    py-4 
                    border-b 
                    flex 
                    items-center 
                    gap-3
                    ${danger 
                        ? 'border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/30' 
                        : 'border-[var(--color-section-header-border,#d3d9c9)] dark:border-[var(--color-section-header-border,#3d4236)] bg-[var(--color-section-header-bg,#e8ebe3)] dark:bg-[var(--color-section-header-bg,#2a2e26)]'
                    }
                `.trim().replace(/\s+/g, ' ')}
            >
                <div 
                    className={`
                        p-2 
                        rounded-lg 
                        ${danger 
                            ? 'bg-red-100 dark:bg-red-900/50' 
                            : 'bg-[var(--color-section-header-icon-bg,#d3d9c9)] dark:bg-[var(--color-section-header-icon-bg,#32382d)]'
                        }
                    `.trim().replace(/\s+/g, ' ')}
                >
                    <Icon 
                        size={18} 
                        className={danger 
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
