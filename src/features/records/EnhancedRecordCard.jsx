// src/features/records/EnhancedRecordCard.jsx
// ============================================
// 📦 ENHANCED RECORD CARD
// ============================================
// Record card with:
// 1. Request Service button for easy contractor links
// 2. Better visual hierarchy
// 3. Quick actions on hover

import React, { useState } from 'react';
import { 
    ShieldAlert, ShieldCheck, Loader2, Pencil, Trash2, Paperclip, 
    ExternalLink, Calendar, Paintbrush, Plug, Grid, Fan, Droplet, 
    Zap, Hammer, Sun, Wrench, Shield, Armchair, Box, Bug, Send,
    ChevronDown, DollarSign, MapPin, Clock, MoreHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { useRecalls } from '../../hooks/useRecalls';

const CATEGORY_CONFIG = {
    "Paint & Finishes": { icon: Paintbrush, color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200", iconColor: "text-fuchsia-600", bgLight: "bg-fuchsia-50" },
    "Appliances": { icon: Plug, color: "bg-cyan-100 text-cyan-700 border-cyan-200", iconColor: "text-cyan-600", bgLight: "bg-cyan-50" },
    "Flooring": { icon: Grid, color: "bg-amber-100 text-amber-700 border-amber-200", iconColor: "text-amber-600", bgLight: "bg-amber-50" },
    "HVAC & Systems": { icon: Fan, color: "bg-blue-100 text-blue-700 border-blue-200", iconColor: "text-blue-600", bgLight: "bg-blue-50" },
    "Plumbing": { icon: Droplet, color: "bg-indigo-100 text-indigo-700 border-indigo-200", iconColor: "text-indigo-600", bgLight: "bg-indigo-50" },
    "Electrical": { icon: Zap, color: "bg-yellow-100 text-yellow-700 border-yellow-200", iconColor: "text-yellow-600", bgLight: "bg-yellow-50" },
    "Roof & Exterior": { icon: Hammer, color: "bg-stone-100 text-stone-700 border-stone-200", iconColor: "text-stone-600", bgLight: "bg-stone-50" },
    "Landscaping": { icon: Sun, color: "bg-emerald-100 text-emerald-700 border-emerald-200", iconColor: "text-emerald-600", bgLight: "bg-emerald-50" },
    "Service & Repairs": { icon: Wrench, color: "bg-red-100 text-red-700 border-red-200", iconColor: "text-red-600", bgLight: "bg-red-50" },
    "Safety": { icon: Shield, color: "bg-orange-100 text-orange-700 border-orange-200", iconColor: "text-orange-600", bgLight: "bg-orange-50" },
    "Interior": { icon: Armchair, color: "bg-violet-100 text-violet-700 border-violet-200", iconColor: "text-violet-600", bgLight: "bg-violet-50" },
    "Pest Control": { icon: Bug, color: "bg-rose-100 text-rose-700 border-rose-200", iconColor: "text-rose-600", bgLight: "bg-rose-50" },
    "Other": { icon: Box, color: "bg-slate-100 text-slate-700 border-slate-200", iconColor: "text-slate-500", bgLight: "bg-slate-50" }
};

const formatCurrency = (amount) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const EnhancedRecordCard = ({ 
    record, 
    onDeleteClick, 
    onEditClick, 
    onRequestService,
    showServiceButton = true 
}) => {
    const { checkSafety, status: recallStatus, loading: checkingRecall } = useRecalls();
    const [isExpanded, setIsExpanded] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const handleCheckSafety = (e) => {
        e.stopPropagation();
        checkSafety(record.brand, record.model);
    };

    const style = CATEGORY_CONFIG[record.category] || CATEGORY_CONFIG["Other"];
    const CategoryIcon = style.icon;
    
    // Calculate if maintenance is due
    const getMaintenanceStatus = () => {
        if (!record.nextServiceDate) return null;
        const daysUntil = Math.ceil((new Date(record.nextServiceDate) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) return { status: 'overdue', days: Math.abs(daysUntil), color: 'text-red-600 bg-red-50' };
        if (daysUntil <= 30) return { status: 'soon', days: daysUntil, color: 'text-amber-600 bg-amber-50' };
        return null;
    };
    
    const maintenanceStatus = getMaintenanceStatus();

    return (
        <div 
            className="bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md group overflow-hidden"
        > 
            {/* Main Content - Always visible */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="p-5 cursor-pointer"
            >
                <div className="flex items-start gap-4">
                    {/* Category Icon */}
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${style.color}`}>
                        <CategoryIcon size={24} className={style.iconColor} />
                    </div>

                    {/* Item Info */}
                    <div className="flex-grow min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">
                                    {record.item || 'Unknown Item'}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                    {record.brand && (
                                        <span className="text-sm text-slate-500 font-medium">{record.brand}</span>
                                    )}
                                    {record.model && (
                                        <span className="text-xs text-slate-400">• {record.model}</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Badges */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                {recallStatus?.status === 'warning' && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase flex items-center animate-pulse">
                                        <ShieldAlert size={10} className="mr-1" /> Recall
                                    </span>
                                )}
                                {maintenanceStatus && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${maintenanceStatus.color}`}>
                                        {maintenanceStatus.status === 'overdue' 
                                            ? `${maintenanceStatus.days}d overdue`
                                            : `Due in ${maintenanceStatus.days}d`
                                        }
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* Quick Stats Row */}
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            {record.cost > 0 && (
                                <span className="text-sm font-bold text-emerald-600 flex items-center">
                                    <DollarSign size={14} className="mr-0.5" />
                                    {formatCurrency(record.cost)}
                                </span>
                            )}
                            {record.dateInstalled && (
                                <span className="text-xs text-slate-400 flex items-center">
                                    <Calendar size={12} className="mr-1" />
                                    {formatDate(record.dateInstalled)}
                                </span>
                            )}
                            {record.area && (
                                <span className="text-xs text-slate-400 flex items-center">
                                    <MapPin size={12} className="mr-1" />
                                    {record.area}
                                </span>
                            )}
                            {record.contractor && (
                                <span className="text-xs text-slate-400 flex items-center">
                                    <Wrench size={12} className="mr-1" />
                                    {record.contractor}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    {/* Expand Indicator */}
                    <ChevronDown 
                        size={20} 
                        className={`text-slate-300 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-50 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="pt-4 space-y-4">
                        
                        {/* Image */}
                        {record.imageUrl && (
                            <div className="h-40 w-full bg-slate-100 rounded-xl overflow-hidden">
                                <img 
                                    src={record.imageUrl} 
                                    alt={record.item} 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {record.model && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Model</p>
                                    <p className="font-medium text-slate-700">{record.model}</p>
                                </div>
                            )}
                            {record.serialNumber && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Serial #</p>
                                    <p className="font-medium text-slate-700 font-mono text-xs">{record.serialNumber}</p>
                                </div>
                            )}
                            {record.maintenanceFrequency && record.maintenanceFrequency !== 'none' && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Maintenance</p>
                                    <p className="font-medium text-emerald-600">
                                        {MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency)?.label}
                                    </p>
                                </div>
                            )}
                            {record.contractor && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Contractor</p>
                                    <p className="font-medium text-slate-700">{record.contractor}</p>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {record.notes && (
                            <div className={`p-3 rounded-xl border ${style.bgLight} border-slate-100`}>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                                <p className="text-xs text-slate-600 italic">"{record.notes}"</p>
                            </div>
                        )}

                        {/* Attachments */}
                        {record.attachments && record.attachments.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Documents</p>
                                <div className="flex flex-wrap gap-2">
                                    {record.attachments.map((att, i) => (
                                        <a 
                                            key={i} 
                                            href={att.url} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-xs font-medium text-slate-700"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Paperclip size={12} className="mr-1.5 text-slate-400" />
                                            {att.name || 'Document'}
                                            <ExternalLink size={10} className="ml-1.5 text-slate-300" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Safety Check */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <div>
                                {!recallStatus ? (
                                    <button 
                                        onClick={handleCheckSafety} 
                                        disabled={checkingRecall || !record.model}
                                        className="text-xs flex items-center text-slate-400 hover:text-emerald-600 transition font-medium disabled:opacity-50"
                                    >
                                        {checkingRecall ? (
                                            <Loader2 className="animate-spin mr-1 h-3 w-3" />
                                        ) : (
                                            <ShieldCheck className="mr-1 h-3 w-3" />
                                        )}
                                        {record.model ? "Check Safety" : "Add model to check safety"}
                                    </button>
                                ) : recallStatus.status === 'warning' ? (
                                    <a 
                                        href={recallStatus.url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-xs text-red-600 font-bold flex items-center hover:underline"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <ShieldAlert size={12} className="mr-1" /> View Recall Details
                                    </a>
                                ) : (
                                    <span className="text-xs text-emerald-600 font-medium flex items-center">
                                        <ShieldCheck size={12} className="mr-1" /> No Recalls Found
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            {showServiceButton && onRequestService && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onRequestService(record); }}
                                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <Send size={14} />
                                    Request Service
                                </button>
                            )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEditClick(record); }}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-1 text-sm"
                            >
                                <Pencil size={14} />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteClick(record.id); }}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 font-bold rounded-xl transition-colors flex items-center justify-center gap-1 text-sm"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div> 
    );
};
