// src/components/navigation/NotificationPanel.jsx
import React from 'react';
import { X, Bell, AlertTriangle, Clock, FileText, ChevronRight } from 'lucide-react';

export const NotificationPanel = ({ 
    isOpen, 
    onClose, 
    dueTasks = [], 
    newSubmissions = [],
    onTaskClick,
    onSubmissionClick 
}) => {
    if (!isOpen) return null;
    
    const totalCount = dueTasks.length + newSubmissions.length;
    
    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]" 
                onClick={onClose} 
            />
            
            {/* Panel */}
            <div className="fixed top-16 right-4 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                {/* Header */}
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
                    <button 
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>
                
                {/* Content */}
                <div className="max-h-80 overflow-y-auto">
                    {totalCount === 0 ? (
                        <div className="p-8 text-center">
                            <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell size={20} className="text-slate-400" />
                            </div>
                            <p className="text-slate-500 text-sm">No notifications</p>
                            <p className="text-slate-400 text-xs mt-1">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {/* Due Tasks Section */}
                            {dueTasks.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                        Maintenance Due
                                    </p>
                                    {dueTasks.map((task, idx) => (
                                        <button
                                            key={task.id || idx}
                                            onClick={() => {
                                                onTaskClick?.(task);
                                                onClose();
                                            }}
                                            className="w-full text-left p-3 rounded-xl hover:bg-amber-50 transition-colors flex items-start gap-3 group"
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
                                                    {task.nextDue ? new Date(task.nextDue).toLocaleDateString() : 'Due soon'}
                                                </p>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {/* New Submissions Section */}
                            {newSubmissions.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                        New Submissions
                                    </p>
                                    {newSubmissions.map((submission, idx) => (
                                        <button
                                            key={submission.id || idx}
                                            onClick={() => {
                                                onSubmissionClick?.(submission);
                                                onClose();
                                            }}
                                            className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 transition-colors flex items-start gap-3 group"
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
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-1" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default NotificationPanel;
