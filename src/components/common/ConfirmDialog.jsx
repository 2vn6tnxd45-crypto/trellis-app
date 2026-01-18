// src/components/common/ConfirmDialog.jsx
// ============================================
// CONFIRM DIALOG COMPONENT
// ============================================
// Reusable confirmation dialog that pairs with useConfirmAction hook.
// Supports danger, warning, and info variants with appropriate styling.

import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ButtonLoader } from './LoadingStates';

/**
 * Reusable confirmation dialog component.
 * Designed to work seamlessly with the useConfirmAction hook.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether to show the dialog
 * @param {Function} props.onConfirm - Called when user confirms
 * @param {Function} props.onCancel - Called when user cancels
 * @param {string} [props.title='Are you sure?'] - Dialog title
 * @param {string} [props.message='This action cannot be undone.'] - Dialog message
 * @param {string} [props.confirmText='Confirm'] - Confirm button text
 * @param {string} [props.cancelText='Cancel'] - Cancel button text
 * @param {'danger'|'warning'|'info'} [props.variant='danger'] - Dialog variant
 * @param {boolean} [props.loading=false] - Shows spinner on confirm button
 * @param {React.ReactNode} [props.children] - Custom content instead of message
 *
 * @example
 * // With useConfirmAction hook:
 * const deleteAction = useConfirmAction(
 *   async (item) => await deleteItem(item.id),
 *   { title: 'Delete Item?', variant: 'danger' }
 * );
 *
 * {deleteAction.isConfirming && (
 *   <ConfirmDialog
 *     isOpen={deleteAction.isConfirming}
 *     onConfirm={deleteAction.confirm}
 *     onCancel={deleteAction.cancel}
 *     loading={deleteAction.loading}
 *     {...deleteAction.config}
 *   />
 * )}
 */
export const ConfirmDialog = ({
    isOpen,
    onConfirm,
    onCancel,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false,
    children
}) => {
    // Handle Escape key press
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape' && !loading) {
            onCancel();
        }
    }, [onCancel, loading]);

    // Add/remove event listener and prevent body scroll
    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    // Don't render if not open
    if (!isOpen) return null;

    // Variant-based styling
    const variantStyles = {
        danger: {
            icon: AlertTriangle,
            iconColor: 'text-red-600',
            titleColor: 'text-red-600',
            iconBg: 'bg-red-100',
            confirmButton: 'bg-red-600 hover:bg-red-700 text-white'
        },
        warning: {
            icon: AlertCircle,
            iconColor: 'text-amber-600',
            titleColor: 'text-amber-600',
            iconBg: 'bg-amber-100',
            confirmButton: 'bg-amber-500 hover:bg-amber-600 text-white'
        },
        info: {
            icon: Info,
            iconColor: 'text-blue-600',
            titleColor: 'text-slate-800',
            iconBg: 'bg-blue-100',
            confirmButton: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }
    };

    const styles = variantStyles[variant] || variantStyles.danger;
    const IconComponent = styles.icon;

    // Handle overlay click
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !loading) {
            onCancel();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleOverlayClick}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
            >
                {/* Header with Icon and Title */}
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full ${styles.iconBg} shrink-0`}>
                        <IconComponent className={`w-6 h-6 ${styles.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2
                            id="confirm-dialog-title"
                            className={`text-lg font-bold ${styles.titleColor}`}
                        >
                            {title}
                        </h2>
                        {/* Message or custom children */}
                        {children ? (
                            <div className="mt-2 text-slate-600">
                                {children}
                            </div>
                        ) : (
                            <p className="mt-2 text-slate-600">
                                {message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`px-4 py-2 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center ${styles.confirmButton}`}
                    >
                        {loading ? (
                            <ButtonLoader size={18} className="text-white" />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
