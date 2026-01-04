// src/features/report/PedigreeReportTeaser.jsx
// ============================================
// PEDIGREE REPORT TEASER
// ============================================
// Shows progress towards unlocking the full report
// Used on the Dashboard for new users

import React from 'react';
import { Lock, FileText } from 'lucide-react';

export const PedigreeReportTeaser = ({ itemCount = 0, requiredItems = 5, onAddItem }) => {
    const progress = Math.min((itemCount / requiredItems) * 100, 100);
    const isUnlocked = itemCount >= requiredItems;
    const remaining = requiredItems - itemCount;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 relative overflow-hidden mb-6">
            {/* Blurred preview background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="p-4 blur-sm">
                    <div className="h-4 w-32 bg-slate-300 rounded mb-2" />
                    <div className="h-3 w-48 bg-slate-200 rounded mb-4" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-16 bg-slate-200 rounded" />
                        <div className="h-16 bg-slate-200 rounded" />
                    </div>
                </div>
            </div>
            
            {/* Content */}
            <div className="relative z-10 flex items-center gap-4">
                <div className="bg-slate-100 p-3 rounded-xl">
                    <Lock className="h-6 w-6 text-slate-400" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800">Property Pedigree Report</h3>
                    <p className="text-slate-500 text-sm">
                        {isUnlocked 
                            ? 'Your comprehensive home report is ready!'
                            : `Add ${remaining} more item${remaining !== 1 ? 's' : ''} to unlock`
                        }
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Upload receipts or scan appliance labels to build your report
                    </p>
                </div>
                {!isUnlocked && (
                    <button
                        onClick={onAddItem}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                    >
                        Add Items
                    </button>
                )}
            </div>
            
            {/* Progress bar */}
            <div className="relative z-10 mt-4">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">{itemCount} of {requiredItems} items</span>
                    <span className={isUnlocked ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                        {Math.round(progress)}%
                    </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all ${isUnlocked ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PedigreeReportTeaser;
