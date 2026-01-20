// src/components/common/QuickActionsButton.jsx
// ============================================
// FLOATING QUICK ACTIONS BUTTON
// ============================================
// A floating action button that provides quick access to primary actions
// Positioned above the bottom navigation for easy thumb access

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Camera, FileText, Hammer, Package } from 'lucide-react';

/**
 * QuickActionsButton - Floating action button with expandable menu
 *
 * @param {function} onScanReceipt - Handler for scanning receipt action
 * @param {function} onAddItem - Handler for adding item manually
 * @param {function} onViewReport - Handler for viewing report
 * @param {function} onServiceLink - Handler for creating service link
 */
export const QuickActionsButton = ({
    onScanReceipt,
    onAddItem,
    onViewReport,
    onServiceLink,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleAction = (action) => {
        setIsOpen(false);
        if (action) action();
    };

    const actions = [
        {
            id: 'scan-receipt',
            icon: Camera,
            label: 'Scan Receipt',
            sublabel: 'AI-powered',
            onClick: onScanReceipt,
            primary: true,
        },
        {
            id: 'add-item',
            icon: Package,
            label: 'Add Item',
            sublabel: 'Manual entry',
            onClick: onAddItem,
        },
        {
            id: 'view-report',
            icon: FileText,
            label: 'View Report',
            sublabel: 'Home pedigree',
            onClick: onViewReport,
        },
        {
            id: 'service-link',
            icon: Hammer,
            label: 'Service Link',
            sublabel: 'For contractors',
            onClick: onServiceLink,
        },
    ];

    return (
        <>
            {/* Backdrop overlay when menu is open */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                    aria-hidden="true"
                />
            )}

            {/* Floating container - positioned above bottom nav */}
            <div className="fixed bottom-24 right-4 z-50" data-testid="quick-actions-fab">
                {/* Expandable action menu */}
                {isOpen && (
                    <div
                        ref={menuRef}
                        className="absolute bottom-16 right-0 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200"
                        role="menu"
                        aria-label="Quick Actions Menu"
                    >
                        <div className="bg-white dark:bg-[var(--color-bg-card,#242320)] rounded-2xl shadow-2xl border border-slate-200 dark:border-[var(--color-border-default,#3d3c38)] overflow-hidden min-w-[200px]">
                            {actions.map((action, index) => {
                                const Icon = action.icon;
                                return (
                                    <button
                                        key={action.id}
                                        onClick={() => handleAction(action.onClick)}
                                        data-testid={`fab-action-${action.id}`}
                                        role="menuitem"
                                        className={`
                                            w-full flex items-center gap-3 p-3 text-left
                                            transition-colors duration-150
                                            hover:bg-slate-50 dark:hover:bg-[var(--color-bg-elevated,#2c2b27)]
                                            focus:outline-none focus:bg-slate-50 dark:focus:bg-[var(--color-bg-elevated,#2c2b27)]
                                            ${index !== actions.length - 1 ? 'border-b border-slate-100 dark:border-[var(--color-border-subtle,#32302b)]' : ''}
                                            ${action.primary ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}
                                        `.trim()}
                                    >
                                        <div
                                            className={`
                                                p-2 rounded-xl
                                                ${action.primary
                                                    ? 'bg-emerald-100 dark:bg-emerald-800/30 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-slate-100 dark:bg-[var(--color-bg-elevated,#2c2b27)] text-slate-600 dark:text-slate-400'
                                                }
                                            `.trim()}
                                        >
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`
                                                font-bold text-sm
                                                ${action.primary
                                                    ? 'text-emerald-700 dark:text-emerald-300'
                                                    : 'text-slate-800 dark:text-slate-200'
                                                }
                                            `.trim()}>
                                                {action.label}
                                            </p>
                                            {action.sublabel && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {action.sublabel}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Main FAB button */}
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
                    aria-haspopup="menu"
                    data-testid="quick-actions-fab-button"
                    className={`
                        h-14 w-14 rounded-full
                        flex items-center justify-center
                        shadow-lg hover:shadow-xl
                        transition-all duration-200
                        focus:outline-none focus:ring-4 focus:ring-emerald-500/30
                        ${isOpen
                            ? 'bg-slate-800 dark:bg-slate-700 rotate-45'
                            : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                        }
                    `.trim()}
                >
                    {isOpen ? (
                        <X size={24} className="text-white transition-transform" />
                    ) : (
                        <Plus size={24} className="text-white" />
                    )}
                </button>
            </div>
        </>
    );
};

export default QuickActionsButton;
