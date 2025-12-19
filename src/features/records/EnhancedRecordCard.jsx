// src/features/records/EnhancedRecordCard.jsx
import React, { useState } from 'react';
import { 
    Wrench, Calendar, CheckCircle, AlertTriangle, MoreVertical, 
    ChevronDown, Trash2, Edit2, Clock, Plus, Shield
} from 'lucide-react';
import { toProperCase } from '../../lib/utils';

// --- SUB-COMPONENT: Task Item (Replaces the Dropdown) ---
const TaskRow = ({ task, onComplete, onEdit, onDelete }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    // Calculate status color/text
    const isOverdue = task.daysUntil < 0;
    
    return (
        <div className="group flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all mb-2 relative">
            <div className="flex items-center gap-3 overflow-hidden">
                {/* Status Indicator / Quick Complete */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onComplete(task);
                    }}
                    className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center border transition-all ${
                        isOverdue 
                            ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-500 hover:text-white' 
                            : 'bg-white border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500'
                    }`}
                    title="Mark as Done"
                >
                    <CheckCircle size={16} />
                </button>
                
                <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${isOverdue ? 'text-red-700' : 'text-slate-700'}`}>
                        {task.taskName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Clock size={10} /> {toProperCase(task.frequency)}
                        </span>
                        {task.nextDue && (
                            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                • Due: {new Date(task.nextDue).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions: Replaces the Dropdown with a sleek Kebab Menu */}
            <div className="relative">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
                >
                    <MoreVertical size={16} />
                </button>
                
                {/* Popover Menu - Positioned absolute right */}
                {showMenu && (
                    <>
                        {/* Invisible backdrop to close menu on click outside */}
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                        
                        <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    onEdit(task); 
                                    setShowMenu(false); 
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <Edit2 size={12} /> Edit Task
                            </button>
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    onDelete(task); 
                                    setShowMenu(false); 
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                                <Trash2 size={12} /> Delete Task
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const EnhancedRecordCard = ({ 
    record, 
    onEditRecord, 
    onDeleteRecord, 
    onAddTask,
    onEditTask,
    onDeleteTask,
    onCompleteTask
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Safety check for tasks array
    const tasks = record.maintenanceTasks || [];
    const overdueCount = tasks.filter(t => (t.daysUntil || 0) < 0).length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-visible">
            {/* Header - Always Visible */}
            <div 
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Image / Icon */}
                <div className="h-14 w-14 shrink-0 bg-slate-100 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center">
                    {record.image ? (
                        <img src={record.image} alt={record.item} className="h-full w-full object-cover" />
                    ) : (
                        <Wrench className="text-slate-400" size={24} />
                    )}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{record.item}</h3>
                        {overdueCount > 0 && !isExpanded && (
                            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle size={10} /> {overdueCount} Overdue
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm truncate">{record.category || 'General'} • {record.model || 'No Model #'}</p>
                </div>

                <ChevronDown className={`text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                    <hr className="border-slate-100 mb-4" />
                    
                    {/* Quick Stats / Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Installed</p>
                            <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                                <Calendar size={14} className="text-emerald-500" />
                                {record.dateInstalled ? new Date(record.dateInstalled).toLocaleDateString() : 'Unknown'}
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Support</p>
                            <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                                <Shield size={14} className="text-blue-500" />
                                {record.contractor || 'No Pro Assigned'}
                            </div>
                        </div>
                    </div>

                    {/* Tasks Section */}
                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-3">
                            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <CheckCircle size={16} className="text-slate-400" />
                                Maintenance Tasks
                            </h4>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAddTask(record); }}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                            >
                                <Plus size={12} /> Add Task
                            </button>
                        </div>

                        {tasks.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-slate-400 text-xs">No tasks set for this item.</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {tasks.map((task, idx) => (
                                    <TaskRow 
                                        key={idx} 
                                        task={task} 
                                        onComplete={onCompleteTask} 
                                        onEdit={onEditTask} 
                                        onDelete={onDeleteTask} 
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEditRecord(record); }}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit2 size={14} /> Edit Details
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteRecord(record); }}
                            className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedRecordCard;
