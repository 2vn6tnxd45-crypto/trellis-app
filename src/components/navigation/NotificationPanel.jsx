// src/components/navigation/NotificationPanel.jsx
// ENHANCED: Added dismiss, clear all, quick actions
// ALL EXISTING FUNCTIONALITY PRESERVED - new props are optional

import React, { useState } from 'react';
import { 
    X, Bell, AlertTriangle, Clock, FileText, ChevronRight, 
    Check, AlarmClock, CheckCheck 
} from 'lucide-react';

// Quick Snooze Menu Component
const QuickSnoozeMenu = ({ onSnooze, onClose }) => {
    const options = [
        { label: '1 Week', days: 7 },
        { label: '2 Weeks', days: 14 },
        { label: '1 Month', days: 30 },
    ];
    
    return (
        <div 
            className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[120px] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
        >
            {options.map(opt => (
                <button
                    key={opt.days}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSnooze(opt.days);
                        onClose();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

export const NotificationPanel = ({ 
    // === EXISTING PROPS (unchanged, required) ===
    isOpen, 
    onClose, 
    dueTasks = [], 
    newSubmissions = [],
    onTaskClick,
    onSubmissionClick,
    
    // === NEW OPTIONAL PROPS (backward compatible - all have defaults) ===
    dismissedIds = new Set(),           // Set of dismissed notification IDs
    onDismiss,                          // (id, type) => void - dismiss single notification
    onClearAll,                         // () => void - clear all notifications
    onQuickComplete,                    // (task) => void - mark task done from panel
    onQuickSnooze,                      // (task, days) => void - snooze task from panel
}) => {
    const [showSnoozeFor, setShowSnoozeFor] = useState(null);
    
    // Early return preserved exactly as before
    if (!isOpen) return null;
    
    // Filter out dismissed notifications (if dismissedIds provided)
    const visibleTasks = dueTasks.filter(task => {
        const taskId = task.id || `${task.recordId}-${task.taskName}`;
        return !dismissedIds.has(taskId);
    });
    
    const visibleSubmissions = newSubmissions.filter(sub => {
        return !dismissedIds.has(sub.id);
    });
    
    const totalCount = visibleTasks.length + visibleSubmissions.length;
    const hasQuickActions = onQuickComplete || onQuickSnooze;
    
    // Handle dismiss with stopPropagation
    const handleDismiss = (e, id, type) => {
        e.stopPropagation();
        onDismiss?.(id, type);
    };
    
    // Handle quick complete
    const handleQuickComplete = (e, task) => {
        e.stopPropagation();
        onQuickComplete?.(task);
    };
    
    // Handle quick snooze
    const handleQuickSnooze = (task, days) => {
        onQuickSnooze?.(task, days);
        setShowSnoozeFor(null);
    };
    
    return (
        <>
            {/* Backdrop - UNCHANGED */}
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]" 
                onClick={onClose} 
            />
            
            {/* Panel - ENHANCED but structure preserved */}
            <div className="fixed top-16 right-4 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                {/* Header - ENHANCED with Clear All button */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-slate-600" />
                        <h3 className="font-bold text-slate-800">Notifications</h3>
                        {totalCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {totalCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* NEW: Clear All Button (only shows if there are notifications and handler exists) */}
                        {totalCount > 0 && onClearAll && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClearAll();
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                                title="Clear all"
                            >
                                <CheckCheck size={16} />
                            </button>
                        )}
                        {/* EXISTING: Close button - unchanged */}
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X size={16} className="text-slate-400" />
                        </button>
                    </div>
                </div>
                
                {/* Content - ENHANCED with quick actions */}
                <div className="max-h-80 overflow-y-auto">
                    {totalCount === 0 ? (
                        // Empty state - UNCHANGED
                        <div className="p-8 text-center">
                            <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell size={20} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500 text-sm">No notifications</p>
                            <p className="text-slate-400 text-xs mt-1">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {/* Due Tasks Section - ENHANCED */}
                            {visibleTasks.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                        Maintenance Due
                                    </p>
                                    {visibleTasks.map((task, idx) => {
                                        const taskId = task.id || `${task.recordId}-${task.taskName}`;
                                        const isShowingSnooze = showSnoozeFor === taskId;
                                        
                                        return (
                                            <div
                                                key={taskId}
                                                className="relative group"
                                            >
                                                <button
                                                    onClick={() => {
                                                        onTaskClick?.(task);
                                                        onClose();
                                                    }}
                                                    className="w-full text-left p-3 rounded-xl hover:bg-amber-50 transition-colors flex items-start gap-3"
                                                >
                                                    <div className="bg-amber-100 p-2 rounded-lg text-amber-600 flex-shrink-0">
                                                        <AlertTriangle size={14} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-800 text-sm truncate">
                                                            {task.taskName || task.item}
                                                        </p>
                                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Clock size={10} />
                                                            {task.nextDue 
                                                                ? new Date(task.nextDue).toLocaleDateString() 
                                                                : task.nextServiceDate
                                                                    ? new Date(task.nextServiceDate).toLocaleDateString()
                                                                    : 'Due soon'}
                                                        </p>
                                                    </div>
                                                    
                                                    {/* Quick Actions OR Chevron */}
                                                    {hasQuickActions ? (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                            {/* Quick Complete */}
                                                            {onQuickComplete && (
                                                                <button
                                                                    onClick={(e) => handleQuickComplete(e, task)}
                                                                    className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                                                                    title="Mark as done"
                                                                >
                                                                    <Check size={12} />
                                                                </button>
                                                            )}
                                                            {/* Quick Snooze */}
                                                            {onQuickSnooze && (
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setShowSnoozeFor(isShowingSnooze ? null : taskId);
                                                                        }}
                                                                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                                        title="Snooze"
                                                                    >
                                                                        <AlarmClock size={12} />
                                                                    </button>
                                                                    {isShowingSnooze && (
                                                                        <QuickSnoozeMenu 
                                                                            onSnooze={(days) => handleQuickSnooze(task, days)}
                                                                            onClose={() => setShowSnoozeFor(null)}
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* Dismiss */}
                                                            {onDismiss && (
                                                                <button
                                                                    onClick={(e) => handleDismiss(e, taskId, 'task')}
                                                                    className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-red-100 hover:text-red-500 transition-colors"
                                                                    title="Dismiss"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <ChevronRight size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1" />
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {/* New Submissions Section - ENHANCED with dismiss */}
                            {visibleSubmissions.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                        New Submissions
                                    </p>
                                    {visibleSubmissions.map((submission, idx) => (
                                        <div
                                            key={submission.id || idx}
                                            className="relative group"
                                        >
                                            <button
                                                onClick={() => {
                                                    onSubmissionClick?.(submission);
                                                    onClose();
                                                }}
                                                className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 transition-colors flex items-start gap-3"
                                            >
                                                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 flex-shrink-0">
                                                    <FileText size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-800 text-sm truncate">
                                                        {submission.contractorName || 'New submission'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                                        {submission.itemName || submission.description || 'Service completed'}
                                                    </p>
                                                </div>
                                                
                                                {/* Dismiss button for submissions */}
                                                {onDismiss ? (
                                                    <button
                                                        onClick={(e) => handleDismiss(e, submission.id, 'submission')}
                                                        className="p-1.5 opacity-0 group-hover:opacity-100 bg-slate-100 text-slate-400 rounded-lg hover:bg-red-100 hover:text-red-500 transition-all flex-shrink-0"
                                                        title="Dismiss"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                ) : (
                                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-1" />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* NEW: Footer with helpful hint (only shows when there are notifications and quick actions) */}
                {totalCount > 0 && hasQuickActions && (
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                        <p className="text-xs text-slate-400 text-center">
                            Hover for quick actions • Click to view details
                        </p>
                    </div>
                )}
            </div>
        </>
    );
};

export default NotificationPanel;
