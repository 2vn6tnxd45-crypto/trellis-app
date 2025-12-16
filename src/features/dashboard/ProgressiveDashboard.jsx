// src/features/dashboard/ProgressiveDashboard.jsx
import React, { useMemo } from 'react';
import { 
    Camera, Plus, Package, Sparkles, Home 
} from 'lucide-react';
import { ReportTeaser } from './ReportTeaser';
import { ModernDashboard } from './ModernDashboard';

// --- SUB-COMPONENTS ---

const EmptyHomeState = ({ propertyName, onAddItem, onScanReceipt }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-emerald-100 p-6 rounded-full mb-6 shadow-xl shadow-emerald-100">
            <Home className="h-12 w-12 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3">
            Welcome to {propertyName || 'Your Krib'}
        </h1>
        <p className="text-slate-500 max-w-md mb-10 text-lg leading-relaxed">
            Your home's history starts here. Add your first item to begin tracking value, maintenance, and records.
        </p>
        
        <div className="w-full max-w-sm space-y-4">
            <button 
                onClick={onScanReceipt}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
            >
                <Camera size={24} />
                Scan First Receipt
            </button>
            <button 
                onClick={onAddItem}
                className="w-full py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold text-lg hover:border-emerald-200 hover:bg-emerald-50 transition-all flex items-center justify-center gap-3"
            >
                <Plus size={24} />
                Add Manually
            </button>
        </div>
    </div>
);

const GettingStartedDashboard = ({ records, propertyName, onAddItem, onScanReceipt, onNavigateToItems }) => {
    const progress = Math.min(100, (records.length / 5) * 100);
    const remaining = 5 - records.length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Progress Card */}
            <div className="bg-gradient-to-br from-emerald-800 to-teal-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <Sparkles size={140} />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <p className="text-emerald-300 font-bold text-sm uppercase tracking-wider mb-1">Getting Started</p>
                            <h2 className="text-3xl font-extrabold">Building Your Profile</h2>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                            <span className="font-bold text-xl">{records.length}</span>
                            <span className="text-emerald-200 text-sm ml-1">/ 5 items</span>
                        </div>
                    </div>

                    <div className="bg-black/20 rounded-full h-4 w-full overflow-hidden mb-4">
                        <div 
                            className="bg-emerald-400 h-full rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <p className="text-emerald-100 font-medium">
                        {remaining > 0 
                            ? `Add ${remaining} more items to unlock your Home Health Score.` 
                            : "Profile baseline complete!"}
                    </p>
                </div>
            </div>

            {/* Action Grid */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={onScanReceipt} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all text-left group">
                    <div className="bg-emerald-50 w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Camera className="h-6 w-6 text-emerald-600" />
                    </div>
                    <span className="font-bold text-slate-800 block">Scan Receipt</span>
                    <span className="text-xs text-slate-500">Auto-extract details</span>
                </button>

                <button onClick={onAddItem} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all text-left group">
                    <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="font-bold text-slate-800 block">Add Item</span>
                    <span className="text-xs text-slate-500">Manual entry</span>
                </button>
            </div>

            {/* Report Teaser */}
            <ReportTeaser 
                recordCount={records.length} 
                requiredCount={5} 
                onAddMore={onAddItem}
            />

            {/* Recent Items List (Mini) */}
            {records.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="font-bold text-slate-800">Recent Additions</h3>
                        <button onClick={onNavigateToItems} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All</button>
                    </div>
                    <div className="space-y-3">
                        {records.slice(0, 3).map(record => (
                            <div key={record.id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center gap-4">
                                <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">{record.item}</p>
                                    <p className="text-xs text-slate-500">{record.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

export const ProgressiveDashboard = ({
    records = [],
    contractors = [],
    activeProperty,
    onScanReceipt,
    onAddRecord,
    onNavigateToItems,
    onNavigateToContractors,
    onNavigateToReports,
    onCreateContractorLink,
    onNavigateToMaintenance,
    // ⬇️ THESE WERE LIKELY MISSING IN YOUR FILE ⬇️
    onBookService, 
    onMarkTaskDone 
}) => {
    const stage = useMemo(() => {
        if (!records || records.length === 0) return 'empty';
        if (records.length < 5) return 'getting-started';
        return 'established';
    }, [records]);

    switch (stage) {
        case 'empty':
            return (
                <EmptyHomeState 
                    propertyName={activeProperty?.name} 
                    onAddItem={onAddRecord} 
                    onScanReceipt={onScanReceipt} 
                />
            );
        
        case 'getting-started':
            return (
                <GettingStartedDashboard 
                    records={records} 
                    propertyName={activeProperty?.name} 
                    onAddItem={onAddRecord} 
                    onScanReceipt={onScanReceipt} 
                    onNavigateToItems={onNavigateToItems} 
                />
            );
        
        case 'established':
        default:
            return (
                <ModernDashboard 
                    records={records}
                    contractors={contractors}
                    activeProperty={activeProperty}
                    onScanReceipt={onScanReceipt}
                    onAddRecord={onAddRecord}
                    onNavigateToItems={onNavigateToItems}
                    onNavigateToContractors={onNavigateToContractors}
                    onNavigateToReports={onNavigateToReports}
                    onCreateContractorLink={onCreateContractorLink}
                    onNavigateToMaintenance={onNavigateToMaintenance}
                    // ⬇️ CRITICAL: PASSING THEM DOWN ⬇️
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                />
            );
    }
};

export default ProgressiveDashboard;
