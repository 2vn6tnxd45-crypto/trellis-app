// src/features/records/EnhancedRecordCard.jsx
import React, { useState } from 'react';
import { 
    Wrench, Calendar, CheckCircle, AlertTriangle, MoreVertical, 
    ChevronDown, Trash2, Edit2, Clock, Plus, Shield,
    // NEW: Icons for category styling and attachments
    Paintbrush, Plug, Grid, Fan, Droplet, Zap, Hammer, Sun, 
    Armchair, Box, Bug, Paperclip, ExternalLink
} from 'lucide-react';
import { toProperCase } from '../../lib/utils';

// --- NEW: Category configuration from RecordCard for colored icons ---
const CATEGORY_CONFIG = {
    "Paint & Finishes": { icon: Paintbrush, color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200", iconColor: "text-fuchsia-600" },
    "Appliances": { icon: Plug, color: "bg-cyan-100 text-cyan-700 border-cyan-200", iconColor: "text-cyan-600" },
    "Flooring": { icon: Grid, color: "bg-amber-100 text-amber-700 border-amber-200", iconColor: "text-amber-600" },
    "HVAC & Systems": { icon: Fan, color: "bg-blue-100 text-blue-700 border-blue-200", iconColor: "text-blue-600" },
    "Plumbing": { icon: Droplet, color: "bg-indigo-100 text-indigo-700 border-indigo-200", iconColor: "text-indigo-600" },
    "Electrical": { icon: Zap, color: "bg-yellow-100 text-yellow-700 border-yellow-200", iconColor: "text-yellow-600" },
    "Roof & Exterior": { icon: Hammer, color: "bg-stone-100 text-stone-700 border-stone-200", iconColor: "text-stone-600" },
    "Landscaping": { icon: Sun, color: "bg-emerald-100 text-emerald-700 border-emerald-200", iconColor: "text-emerald-600" },
    "Service & Repairs": { icon: Wrench, color: "bg-red-100 text-red-700 border-red-200", iconColor: "text-red-600" },
    "Safety": { icon: Shield, color: "bg-orange-100 text-orange-700 border-orange-200", iconColor: "text-orange-600" },
    "Interior": { icon: Armchair, color: "bg-violet-100 text-violet-700 border-violet-200", iconColor: "text-violet-600" },
    "Pest Control": { icon: Bug, color: "bg-rose-100 text-rose-700 border-rose-200", iconColor: "text-rose-600" },
    "Other": { icon: Box, color: "bg-slate-100 text-slate-700 border-slate-200", iconColor: "text-slate-500" }
};

// --- SUB-COMPONENT: Task Item ---
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
                        // Task now includes recordId, so this should work
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

            {/* Actions: Kebab Menu */}
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
                
                {/* Popover Menu */}
                {showMenu && (
                    <>
                        {/* Invisible backdrop to close menu */}
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
    // CRITICAL FIX: Attach recordId to each task so handlers can find the parent record
    const tasks = (record.maintenanceTasks || []).map(t => ({
        ...t,
        recordId: record.id,
        taskName: t.task || t.taskName, // normalize task name field
        frequency: t.frequency || 'annual',
        nextDue: t.nextDue,
        daysUntil: t.nextDue ? Math.ceil((new Date(t.nextDue) - new Date()) / (1000 * 60 * 60 * 24)) : null
    }));
    
    const overdueCount = tasks.filter(t => (t.daysUntil || 0) < 0).length;

    // NEW: Get category styling
    const style = CATEGORY_CONFIG[record.category] || CATEGORY_CONFIG["Other"];
    const CategoryIcon = style.icon;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-visible">
            {/* Header - Always Visible */}
            <div 
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* UPDATED: Category-colored Icon (instead of generic wrench) */}
                <div className={`h-14 w-14 shrink-0 rounded-xl overflow-hidden border flex items-center justify-center ${style.color}`}>
                    {record.image ? (
                        <img src={record.image} alt={record.item} className="h-full w-full object-cover" />
                    ) : (
                        <CategoryIcon className={style.iconColor} size={24} />
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

                    {/* NEW: Image/Invoice Preview (if available) */}
                    {(record.imageUrl || (record.attachments && record.attachments.length > 0 && record.attachments.find(a => a.type === 'Photo' || a.type === 'Document'))) && (
                        <div className="mb-4">
                            <div className="h-40 w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                <img 
                                    src={record.imageUrl || record.attachments?.find(a => a.url)?.url} 
                                    alt={record.item} 
                                    className="h-full w-full object-cover object-center"
                                />
                            </div>
                        </div>
                    )}
                    
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

                    {/* NEW: Notes & Warranty (if available) */}
                    {record.notes && (
                        <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes & Warranty</p>
                            <p className="text-xs text-slate-600 italic">"{record.notes}"</p>
                        </div>
                    )}

                    {/* NEW: Documents/Attachments Section */}
                    {record.attachments && record.attachments.length > 0 && (
                        <div className="mb-6">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Documents</p>
                            <div className="space-y-2">
                                {record.attachments.map((att, i) => (
                                    <a 
                                        key={i} 
                                        href={att.url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="flex items-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 transition group/file" 
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <Paperclip size={14} className="text-slate-400 mr-2 group-hover/file:text-emerald-500"/>
                                        <span className="text-xs font-bold text-slate-700 truncate flex-grow">{att.name}</span>
                                        <ExternalLink size={12} className="text-slate-300"/>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

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
