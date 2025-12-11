// src/features/records/EnhancedRecordCard.jsx
import React, { useState } from 'react';
import { 
    MoreHorizontal, Calendar, MapPin, Wrench, 
    ShieldAlert, ShieldCheck, DollarSign, Package
} from 'lucide-react';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { useRecalls } from '../../hooks/useRecalls';

const formatCurrency = (amount) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

export const EnhancedRecordCard = ({ 
    record, 
    onDeleteClick, 
    onEditClick, 
    onRequestService 
}) => {
    const { status: recallStatus } = useRecalls();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Close menu when clicking outside (simple implementation)
    // In a real production app, consider using a click-outside hook
    const toggleMenu = (e) => {
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <div className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-visible">
            
            {/* 1. HERO IMAGE AREA */}
            <div className="relative h-32 w-full bg-slate-50 rounded-t-2xl overflow-hidden">
                {record.imageUrl ? (
                    <img 
                        src={record.imageUrl} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        alt={record.item} 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="text-slate-200 h-10 w-10" />
                    </div>
                )}
                
                {/* Gradient Overlay for text readability if needed, or just style */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Floating Category Badge */}
                <div className="absolute bottom-2 left-2">
                    <span className="text-[10px] font-bold text-slate-700 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                        {record.category}
                    </span>
                </div>

                {/* Recall Badge (Floating Top Left) */}
                {recallStatus?.status === 'warning' && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-sm animate-pulse">
                        <ShieldAlert size={10} className="mr-1" /> Recall
                    </div>
                )}
            </div>

            {/* 2. CONTENT AREA */}
            <div className="p-4">
                <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-800 leading-tight truncate">
                            {record.item}
                        </h3>
                        <p className="text-sm text-slate-500 font-medium truncate mt-0.5">
                            {record.brand} {record.model}
                        </p>
                    </div>

                    {/* 3. MEATBALL MENU */}
                    <div className="relative shrink-0">
                        <button 
                            onClick={toggleMenu} 
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <MoreHorizontal size={20} />
                        </button>
                        
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1 animate-in fade-in zoom-in-95 origin-top-right">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onEditClick(record); setIsMenuOpen(false); }} 
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                                >
                                    Edit Details
                                </button>
                                {onRequestService && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRequestService(record); setIsMenuOpen(false); }} 
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                                    >
                                        Request Service Link
                                    </button>
                                )}
                                <div className="border-t border-slate-100 my-1"></div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteClick(record.id); setIsMenuOpen(false); }} 
                                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center"
                                >
                                    Delete Item
                                </button>
                            </div>
                        )}
                        {/* Overlay to close menu */}
                        {isMenuOpen && (
                            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                        )}
                    </div>
                </div>

                {/* 4. METADATA FOOTER */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400 font-medium">
                    {record.cost > 0 && (
                        <div className="flex items-center text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                            <DollarSign size={10} className="mr-0.5" /> 
                            {formatCurrency(record.cost).replace('$', '')}
                        </div>
                    )}
                    {record.area && (
                        <div className="flex items-center gap-1 truncate">
                            <MapPin size={12} /> {record.area}
                        </div>
                    )}
                    {record.dateInstalled && (
                        <div className="flex items-center gap-1">
                            <Calendar size={12} /> {new Date(record.dateInstalled).getFullYear()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
