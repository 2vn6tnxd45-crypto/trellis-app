// src/components/common/ConfirmationModal.jsx
// ============================================
// GENERIC CONFIRMATION MODAL
// ============================================
// Reusable modal for confirming actions (delete, cancel, submit, etc.)
// Supports different variants: danger (red), warning (amber), info (blue), success (emerald)

import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, Info, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const variantConfig = {
    danger: {
        icon: AlertTriangle,
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        confirmBg: 'bg-red-500 hover:bg-red-600',
        confirmText: 'text-white'
    },
    warning: {
        icon: AlertCircle,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        confirmBg: 'bg-amber-500 hover:bg-amber-600',
        confirmText: 'text-white'
    },
    info: {
        icon: Info,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        confirmBg: 'bg-blue-500 hover:bg-blue-600',
        confirmText: 'text-white'
    },
    success: {
        icon: CheckCircle,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        confirmBg: 'bg-emerald-500 hover:bg-emerald-600',
        confirmText: 'text-white'
    }
};

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
    isLoading = false,
    icon: CustomIcon = null
}) => {
    const modalRef = useRef(null);
    const cancelButtonRef = useRef(null);

    // Auto-focus cancel button on mount for accessibility
    useEffect(() => {
        if (isOpen && cancelButtonRef.current) {
            cancelButtonRef.current.focus();
        }
    }, [isOpen]);

    // Trap focus within modal
    useEffect(() => {
        if (!isOpen) return;

        const handleFocusTrap = (e) => {
            if (e.key !== 'Tab' || !modalRef.current) return;

            const focusable = modalRef.current.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };

        document.addEventListener('keydown', handleFocusTrap);
        return () => document.removeEventListener('keydown', handleFocusTrap);
    }, [isOpen]);

    if (!isOpen) return null;

    const config = variantConfig[variant] || variantConfig.danger;
    const IconComponent = CustomIcon || config.icon;

    // Close on escape key
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && !isLoading) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-3 sm:p-4 animate-in fade-in duration-200"
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-modal-title"
        >
            <div
                ref={modalRef}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-1.5rem)] sm:max-w-sm animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}>
                            <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1">
                            <h3
                                id="confirmation-modal-title"
                                className="text-lg font-bold text-slate-900"
                            >
                                {title}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {message}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -m-1 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
                            disabled={isLoading}
                            aria-label="Close modal"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex gap-3">
                    <button
                        ref={cancelButtonRef}
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 min-h-[44px] py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 touch-manipulation focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 min-h-[44px] py-3 px-4 rounded-xl ${config.confirmBg} ${config.confirmText} font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 touch-manipulation active:opacity-90 focus:ring-2 focus:ring-offset-2 focus:ring-current`}
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
