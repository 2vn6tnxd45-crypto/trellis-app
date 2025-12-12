// src/features/dashboard/ReportTeaser.jsx
// ============================================
// 📊 REPORT TEASER
// ============================================
// Teases the Property Pedigree Report on dashboard
// Shows locked state for new users, preview for established users

import React from 'react';
import { FileText, Lock, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';

export const ReportTeaser = ({ 
    recordCount = 0, 
    requiredCount = 5,
    isUnlocked = false,
    onAddMore,
    onViewReport 
}) => {
    const progress = Math.min(100, (recordCount / requiredCount) * 100);
    const itemsNeeded = Math.max(0, requiredCount - recordCount);
    
    if (isUnlocked || recordCount >= requiredCount) {
        // Unlocked state - show preview
        return (
            <button 
                onClick={onViewReport}
                className="w-full bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5 text-left hover:shadow-lg hover:border-purple-200 transition-all group"
            >
                <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-500 p-3 rounded-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                        <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-800">Property Pedigree Report</h3>
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Ready
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Your complete home documentation — perfect for insurance, selling, or contractors.
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="text-purple-600 font-bold">{recordCount} items documented</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">PDF export available</span>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all mt-1" />
                </div>
            </button>
        );
    }
    
    // Locked state - show progress
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <div className="flex items-start gap-4">
                <div className="bg-slate-200 p-3 rounded-xl relative">
                    <FileText className="h-6 w-6 text-slate-400" />
                    <div className="absolute -bottom-1 -right-1 bg-slate-300 p-1 rounded-full">
                        <Lock className="h-3 w-3 text-slate-500" />
                    </div>
                </div>
                <div className="flex-grow">
                    <h3 className="font-bold text-slate-800 mb-1">Property Pedigree Report</h3>
                    <p className="text-sm text-slate-500 mb-3">
                        A professional PDF of everything about your home. Add {itemsNeeded} more item{itemsNeeded !== 1 ? 's' : ''} to unlock.
                    </p>
                    
                    {/* Progress bar */}
                    <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">{recordCount} of {requiredCount} items</span>
                            <span className="text-emerald-600 font-bold">{Math.round(progress)}%</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    
                    {/* Unlock checklist */}
                    <div className="flex flex-wrap gap-2">
                        {[...Array(requiredCount)].map((_, i) => (
                            <div 
                                key={i}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    i < recordCount 
                                        ? 'bg-emerald-100 text-emerald-600' 
                                        : 'bg-slate-200 text-slate-400'
                                }`}
                            >
                                {i < recordCount ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    i + 1
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {onAddMore && (
                <button 
                    onClick={onAddMore}
                    className="w-full mt-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all"
                >
                    Add item to unlock
                </button>
            )}
        </div>
    );
};

export default ReportTeaser;
