// src/features/dashboard/ProgressiveDashboard.jsx
import React, { useMemo } from 'react';
import { 
    Camera, Plus, Package, FileText, Wrench, ChevronRight,
    Sparkles, Home, ArrowRight, DollarSign, TrendingUp, AlertTriangle, Clock
} from 'lucide-react';
import { ReportTeaser } from './ReportTeaser';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';
// IMPORTANT: Import the ModernDashboard to restore hover functionality
import { ModernDashboard } from './ModernDashboard';

// ... (Helper functions getNextServiceDate, formatCurrency, getGreeting remain the same as existing file) ...
const getNextServiceDate = (record) => {
    if (!record.dateInstalled || record.maintenanceFrequency === 'none') return null;
    const freq = MAINTENANCE_FREQUENCIES.find(f => f.value === record.maintenanceFrequency);
    if (!freq || freq.months === 0) return null;
    const installed = new Date(record.dateInstalled);
    const next = new Date(installed);
    next.setMonth(next.getMonth() + freq.months);
    while (next < new Date()) next.setMonth(next.getMonth() + freq.months);
    return next;
};

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
};

// ... (EmptyHomeState and GettingStartedDashboard components remain the same) ...
const EmptyHomeState = ({ propertyName, onAddItem, onScanReceipt }) => (
    <div className="space-y-8">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] p-8 text-white overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
            <div className="relative z-10 text-center py-8">
                <div className="relative mx-auto w-32 h-32 mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl rotate-6 opacity-80" />
                    <div className="absolute inset-0 bg-white rounded-3xl flex items-center justify-center shadow-2xl"><Home className="h-16 w-16 text-slate-800" /></div>
                    <div className="absolute -top-2 -right-4 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-bounce">✨</div>
                </div>
                <h1 className="text-3xl font-extrabold mb-3">Welcome to {propertyName || 'your home'}</h1>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">Every paint color, every appliance, every repair — Krib remembers it all.</p>
            </div>
        </div>
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 px-1">Get started</h2>
            <button onClick={onScanReceipt} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6 rounded-2xl shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform"><Camera className="h-8 w-8" /></div>
                    <div className="flex-grow"><h3 className="text-xl font-bold">Snap a photo</h3><p className="text-emerald-100 text-sm mt-1">Receipt, appliance label, paint can — AI does the rest</p></div>
                    <ArrowRight className="h-6 w-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
            </button>
            <button onClick={onAddItem} className="w-full bg-white border-2 border-slate-200 hover:border-emerald-300 p-5 rounded-2xl transition-all text-left group">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-3 rounded-xl group-hover:bg-emerald-50 transition-colors"><Plus className="h-6 w-6 text-slate-600 group-hover:text-emerald-600" /></div>
                    <div><h3 className="font-bold text-slate-800">Add manually</h3><p className="text-slate-500 text-sm">Type in details yourself</p></div>
                </div>
            </button>
        </div>
    </div>
);

const GettingStartedDashboard = ({ records, propertyName, onAddItem, onScanReceipt, onNavigateToItems }) => {
    const totalItems = records.length;
    const targetItems = 5;
    const progress = Math.min(100, (totalItems / targetItems) * 100);
    const totalSpent = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
    
    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-[2rem] p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-5 w-5" /><span className="text-emerald-100 text-sm font-bold uppercase tracking-wide">Building Your Profile</span></div>
                    <h2 className="text-2xl font-bold mb-4">{totalItems} item{totalItems !== 1 ? 's' : ''} tracked</h2>
                    <div className="bg-white/20 rounded-full h-3 mb-2 overflow-hidden"><div className="bg-white h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} /></div>
                    <p className="text-emerald-100 text-sm">Add {targetItems - totalItems} more to unlock your Home Health Score</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={onScanReceipt} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group">
                    <div className="bg-emerald-50 p-3 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform"><Camera className="h-6 w-6 text-emerald-600" /></div>
                    <h3 className="font-bold text-slate-800">Scan</h3><p className="text-xs text-slate-500 mt-1">Photo or receipt</p>
                </button>
                <button onClick={onNavigateToItems} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group">
                    <div className="bg-slate-100 p-3 rounded-xl w-fit mb-3 group-hover:scale-110 transition-transform"><Package className="h-6 w-6 text-slate-600" /></div>
                    <h3 className="font-bold text-slate-800">View Items</h3><p className="text-xs text-slate-500 mt-1">{totalItems} recorded</p>
                </button>
            </div>
            <ReportTeaser recordCount={totalItems} requiredCount={5} onAddMore={onScanReceipt} />
        </div>
    );
};

// ============================================
// MAIN EXPORT
// ============================================

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
}) => {
    // Determine user stage
    const stage = useMemo(() => {
        if (records.length === 0) return 'empty';
        if (records.length < 5) return 'getting-started';
        // Once user has 5+ items, switch to the full ModernDashboard
        return 'established';
    }, [records.length]);

    switch (stage) {
        case 'empty':
            return <EmptyHomeState propertyName={activeProperty?.name} onAddItem={onAddRecord} onScanReceipt={onScanReceipt} />;
        
        case 'getting-started':
            return <GettingStartedDashboard records={records} propertyName={activeProperty?.name} onAddItem={onAddRecord} onScanReceipt={onScanReceipt} onNavigateToItems={onNavigateToItems} />;
        
        case 'established':
        default:
            // RESTORED: Pass all props to ModernDashboard so hover functionality works
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
                />
            );
    }
};

export default ProgressiveDashboard;
