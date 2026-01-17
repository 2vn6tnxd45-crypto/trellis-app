// src/components/common/DeleteConfirmModal.jsx
import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

export const DeleteConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Delete Item?",
    message = "This action cannot be undone.",
    itemCount = 1,
    isLoading = false
}) => {
    if (!isOpen) return null;

    const isBatch = itemCount > 1;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-1.5rem)] sm:max-w-sm animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-slate-900">
                                {isBatch ? `Delete ${itemCount} Items?` : title}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {isBatch
                                    ? `You're about to permanently delete ${itemCount} items. This action cannot be undone.`
                                    : message
                                }
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -m-1 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
                            disabled={isLoading}
                            aria-label="Close"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 min-h-[44px] py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50 touch-manipulation"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 min-h-[44px] py-3 px-4 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 active:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 touch-manipulation"
                    >
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Trash2 size={16} />
                                Delete{isBatch ? ` (${itemCount})` : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmModal;
