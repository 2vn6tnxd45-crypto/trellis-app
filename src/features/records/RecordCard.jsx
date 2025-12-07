// src/features/records/RecordCard.jsx
import React, { useState } from 'react';
import { 
    ShieldAlert, ShieldCheck, AlertCircle, Loader2, Pencil, Trash2, Paperclip, 
    ChevronDown, ChevronUp, ExternalLink, Calendar, DollarSign, // Added DollarSign
    Paintbrush, Plug, Grid, Fan, Droplet, Zap, Hammer, Sun, Wrench, Shield, Armchair, Box 
} from 'lucide-react';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { useRecalls } from '../../hooks/useRecalls';

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
    "Other": { icon: Box, color: "bg-slate-100 text-slate-700 border-slate-200", iconColor: "text-slate-500" }
};

export const RecordCard = ({ record, onDeleteClick, onEditClick }) => {
    const { checkSafety, status: recallStatus, loading: checkingRecall } = useRecalls();
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCheckSafety = (e) => {
        e.stopPropagation();
        checkSafety(record.brand, record.model);
    };

    const formatCost = (amount) => {
        if (!amount) return null;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const docCount = record.attachments ? record.attachments.length : (record.imageUrl ? 1 : 0);
    const style = CATEGORY_CONFIG[record.category] || CATEGORY_CONFIG["Other"];
    const CategoryIcon = style.icon;

    return (
        <div 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md cursor-pointer overflow-hidden group mb-4"
        > 
            <div className="p-5 flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${style.color}`}>
                    <CategoryIcon size={24} className={style.iconColor} />
                </div>

                <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold text-slate-800 leading-tight truncate pr-2">
                                {record.item || 'Unknown Item'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 font-medium truncate">
                                <span>{record.brand || 'No Brand'}</span>
                                
                                {/* NEW: Cost Display */}
                                {record.cost > 0 && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-xs">
                                            {formatCost(record.cost)}
                                        </span>
                                    </>
                                )}

                                {record.dateInstalled && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span className="flex items-center shrink-0"><Calendar size={12} className="mr-1"/> {record.dateInstalled}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            {recallStatus && recallStatus.status === 'warning' && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase tracking-wide flex items-center animate-pulse">
                                    <ShieldAlert size={10} className="mr-1"/> Recall
                                </span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${style.color}`}>
                                {record.category}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="px-5 pb-5 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="border-t border-slate-100 pt-4 mt-2 space-y-4">
                        
                        {record.imageUrl && (
                            <div className="h-40 w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                                <img src={record.imageUrl} alt={record.item} className="w-full h-full object-cover"/>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {record.model && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Model</p>
                                    <p className="font-medium text-slate-700">{record.model}</p>
                                </div>
                            )}
                            {record.cost > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cost</p>
                                    <p className="font-bold text-emerald-600">{formatCost(record.cost)}</p>
                                </div>
                            )}
                            {record.contractor && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Source / Pro</p>
                                    <p className="font-medium text-slate-700">{record.contractor}</p>
                                </div>
                            )}
                            {record.maintenanceFrequency !== 'none' && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Maintenance</p>
                                    <p className="font-medium text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded">
                                        {MAINTENANCE_FREQUENCIES.find(f=>f.value===record.maintenanceFrequency)?.label}
                                    </p>
                                </div>
                            )}
                        </div>

                        {record.notes && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes & Warranty</p>
                                <p className="text-xs text-slate-600 italic">"{record.notes}"</p>
                            </div>
                        )}

                        {record.attachments && record.attachments.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Documents</p>
                                <div className="space-y-2">
                                    {record.attachments.map((att, i) => (
                                        <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center p-2 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 transition group/file" onClick={e => e.stopPropagation()}>
                                            <Paperclip size={14} className="text-slate-400 mr-2 group-hover/file:text-emerald-500"/>
                                            <span className="text-xs font-bold text-slate-700 truncate flex-grow">{att.name}</span>
                                            <ExternalLink size={12} className="text-slate-300"/>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2">
                            <div className="flex-grow">
                                {!recallStatus ? (
                                    <button onClick={handleCheckSafety} disabled={checkingRecall} className="text-xs flex items-center text-slate-400 hover:text-emerald-600 transition font-bold px-2 py-1 -ml-2 rounded hover:bg-emerald-50">
                                        {checkingRecall ? <Loader2 className="animate-spin mr-1 h-3 w-3"/> : <ShieldCheck className="mr-1 h-3 w-3"/>} 
                                        {record.model ? "Check Safety" : "Add Model to Check"}
                                    </button>
                                ) : recallStatus.url ? (
                                    <a href={recallStatus.url} target="_blank" rel="noreferrer" className="text-xs text-red-600 underline hover:text-red-800 font-bold flex items-center" onClick={e => e.stopPropagation()}>
                                        <ShieldAlert size={12} className="mr-1"/> View Official Recall
                                    </a>
                                ) : (
                                    <span className="text-xs text-green-600 font-bold flex items-center"><ShieldCheck size={12} className="mr-1"/> No Recalls Found</span>
                                )}
                            </div>

                            <div className="flex gap-2"> 
                                <button onClick={(e) => { e.stopPropagation(); onEditClick(record); }} className="p-2 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-lg transition border border-slate-200 hover:border-emerald-200">
                                    <Pencil size={16}/>
                                </button> 
                                <button onClick={(e) => { e.stopPropagation(); onDeleteClick(record.id); }} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition border border-slate-200 hover:border-red-200">
                                    <Trash2 size={16}/>
                                </button> 
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {!isExpanded && (
                <div className="h-1 bg-slate-50 group-hover:bg-emerald-50 transition-colors mx-5 mb-2 rounded-full w-12 opacity-0 group-hover:opacity-100 mx-auto"></div>
            )}
        </div> 
    );
};
