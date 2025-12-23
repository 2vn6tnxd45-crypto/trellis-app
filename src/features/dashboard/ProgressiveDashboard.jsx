// src/features/dashboard/ProgressiveDashboard.jsx
import React, { useMemo } from 'react';
import { 
    Camera, Plus, Package, Sparkles, Home 
} from 'lucide-react';
import { ReportTeaser } from './ReportTeaser';
import { ModernDashboard } from './ModernDashboard';
import { MaintenanceDashboard } from './MaintenanceDashboard';
import { MapPin } from 'lucide-react';

// --- SUB-COMPONENTS ---

const EmptyHomeState = ({ propertyName, activeProperty, onAddItem, onScanReceipt }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-emerald-100 p-6 rounded-full mb-6 shadow-xl shadow-emerald-100">
            <Home className="h-12 w-12 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            Welcome to {propertyName || 'Your Krib'}
        </h1>
        
        {/* ✅ NEW: Add Address Display */}
        {activeProperty?.address && (
            <div className="inline-flex items-center bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 mb-4">
                <MapPin size={14} className="text-emerald-500 mr-2" />
                <p className="text-emerald-700 text-sm font-medium">
                    {typeof activeProperty.address === 'string' 
                        ? activeProperty.address 
                        : `${activeProperty.address.street}, ${activeProperty.address.city}, ${activeProperty.address.state}`
                    }
                </p>
            </div>
        )}
        
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

const GettingStartedDashboard = ({ 
    records, 
    propertyName,
    activeProperty,  // ✅ NEW PROP
    onAddItem, 
    onScanReceipt, 
    onNavigateToItems,
    // ... existing props
    onBookService,
    onMarkTaskDone,
    onDeleteHistoryItem,
    onRestoreHistoryItem,
    onDeleteTask,
    onScheduleTask,
    onSnoozeTask
}) => {
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
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-emerald-300 font-bold text-sm uppercase tracking-wider mb-1">Your Krib</p>
                            {/* ✅ CHANGED: Show property name instead of "Building Your Profile" */}
                            <h2 className="text-3xl font-extrabold">{propertyName || 'My Home'}</h2>
                            
                            {/* ✅ NEW: Add Address Display */}
                            {activeProperty?.address && (
                                <div className="inline-flex items-center bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 mt-3">
                                    <MapPin size={12} className="text-emerald-300 mr-1.5" />
                                    <p className="text-emerald-50 text-xs font-medium">
                                        {typeof activeProperty.address === 'string' 
                                            ? activeProperty.address 
                                            : `${activeProperty.address.street}, ${activeProperty.address.city}, ${activeProperty.address.state}`
                                        }
                                    </p>
                                </div>
                            )}
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
                            ? `Add ${remaining} more item${remaining > 1 ? 's' : ''} to unlock your Home Report`
                            : "🎉 You've unlocked your Home Report!"
                        }
                    </p>
                </div>
            </div>

            {/* Quick Add Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={onScanReceipt}
                    className="p-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex flex-col items-center gap-3 hover:border-emerald-400 hover:bg-emerald-100 transition-all group"
                >
                    <div className="bg-emerald-100 p-3 rounded-xl group-hover:bg-emerald-200 transition-colors">
                        <Camera className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-800">Scan Receipt</p>
                        <p className="text-xs text-slate-500">AI-powered</p>
                    </div>
                </button>
                <button 
                    onClick={onAddItem}
                    className="p-6 bg-white border-2 border-slate-200 rounded-2xl flex flex-col items-center gap-3 hover:border-slate-300 hover:bg-slate-50 transition-all group"
                >
                    <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-slate-200 transition-colors">
                        <Plus className="h-6 w-6 text-slate-600" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-800">Add Manually</p>
                        <p className="text-xs text-slate-500">Enter details</p>
                    </div>
                </button>
            </div>

            {/* Maintenance Schedule (if any tasks exist) */}
            <div>
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="font-bold text-slate-800 text-lg">Maintenance Schedule</h3>
                </div>
                <MaintenanceDashboard 
                    records={records}
                    onAddRecord={onAddItem}
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                    onNavigateToRecords={onNavigateToItems}
                    onDeleteHistoryItem={onDeleteHistoryItem}
                    onRestoreHistoryItem={onRestoreHistoryItem}
                    // NEW PROPS:
                    onDeleteTask={onDeleteTask}
                    onScheduleTask={onScheduleTask}
                    onSnoozeTask={onSnoozeTask}
                />
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
    onBookService, 
    onMarkTaskDone,
    onDeleteHistoryItem,
    onRestoreHistoryItem,
    // NEW PROPS:
    onDeleteTask,
    onScheduleTask,
    onSnoozeTask
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
                activeProperty={activeProperty}  // ✅ ADD THIS
                onAddItem={onAddRecord} 
                onScanReceipt={onScanReceipt} 
            />
        );
    
    case 'getting-started':
        return (
            <GettingStartedDashboard 
                records={records} 
                propertyName={activeProperty?.name}
                activeProperty={activeProperty}  // ✅ ADD THIS
                onAddItem={onAddRecord} 
                onScanReceipt={onScanReceipt} 
                onNavigateToItems={onNavigateToItems}  
                    // Existing props
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                    onDeleteHistoryItem={onDeleteHistoryItem}
                    onRestoreHistoryItem={onRestoreHistoryItem}
                    // NEW PROPS:
                    onDeleteTask={onDeleteTask}
                    onScheduleTask={onScheduleTask}
                    onSnoozeTask={onSnoozeTask}
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
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                    onDeleteHistoryItem={onDeleteHistoryItem}
                    onRestoreHistoryItem={onRestoreHistoryItem}
                    // NEW PROPS:
                    onDeleteTask={onDeleteTask}
                    onScheduleTask={onScheduleTask}
                    onSnoozeTask={onSnoozeTask}
                />
            );
    }
};

export default ProgressiveDashboard;
