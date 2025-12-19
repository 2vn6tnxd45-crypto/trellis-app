// src/features/dashboard/ModernDashboard.jsx
import React, { useMemo, useState } from 'react';
import { 
    Sparkles, ChevronRight, Plus, Camera,
    Clock, Package, FileText, ArrowRight,
    AlertTriangle, Wrench, Shield, CheckCircle2,
    Info, TrendingUp, ChevronDown, Check, User,
    Calendar, Phone, Mail, MessageCircle, Link as LinkIcon,
    X, ExternalLink, Hammer, MapPin 
} from 'lucide-react';
import { EnvironmentalInsights } from './EnvironmentalInsights';
import { CountyData } from './CountyData';
import { useHomeHealth } from '../../hooks/useHomeHealth';
import { MaintenanceDashboard } from './MaintenanceDashboard'; 

// --- CONFIG & HELPERS ---
const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    } catch (e) { return '$0'; }
};

const getSeasonalTheme = () => {
    const month = new Date().getMonth();
    if (month === 11 || month <= 1) return { name: 'Winter', gradient: 'from-slate-900 via-blue-950 to-slate-900', accent: 'text-blue-400' };
    if (month >= 2 && month <= 4) return { name: 'Spring', gradient: 'from-emerald-900 via-teal-900 to-emerald-950', accent: 'text-emerald-400' };
    if (month >= 5 && month <= 7) return { name: 'Summer', gradient: 'from-amber-900 via-orange-900 to-amber-950', accent: 'text-amber-400' };
    return { name: 'Fall', gradient: 'from-orange-950 via-red-950 to-orange-950', accent: 'text-orange-400' };
};

const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

// HealthScoreCard with Close Option
const HealthScoreCard = ({ breakdown, score, onClose }) => (
    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 z-30 animate-in fade-in zoom-in-95 slide-in-from-top-2 text-slate-800">
        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
            <h3 className="font-bold text-slate-900">Score Breakdown</h3>
            <span className={`font-black text-lg ${score >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{score}</span>
        </div>
        <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Wrench size={16} className="text-slate-400" /> <span className="text-slate-600">Maintenance</span></div>
                <span className={`font-bold ${breakdown.maintenance === 50 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.maintenance}/50</span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><Package size={16} className="text-slate-400" /> <span className="text-slate-600">Coverage</span></div>
                <span className={`font-bold ${breakdown.profile >= 40 ? 'text-emerald-600' : 'text-amber-500'}`}>{breakdown.profile}/50</span>
            </div>
        </div>
        <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-full mt-4 pt-2 border-t border-slate-50 text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
        >
            Tap to close
        </button>
    </div>
);

const ActionButton = ({ icon: Icon, label, sublabel, onClick, variant = 'default' }) => (
    <button onClick={onClick} className={`flex items-center gap-3 w-full p-3 rounded-2xl border transition-all group hover:shadow-md active:scale-[0.98] ${variant === 'primary' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'}`}>
        <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 ${variant === 'primary' ? 'bg-emerald-100' : 'bg-slate-100'}`}><Icon size={22} /></div>
        <div><p className="font-bold text-sm">{label}</p>{sublabel && <p className="text-xs opacity-70 font-medium">{sublabel}</p>}</div>
    </button>
);

const SectionHeader = ({ title, action, actionLabel }) => (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {action && <button onClick={action} className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">{actionLabel} <ChevronRight size={16} /></button>}
    </div>
);

export const ModernDashboard = ({
    records = [], contractors = [], activeProperty, onScanReceipt, onAddRecord,
    onNavigateToItems, onNavigateToContractors, onNavigateToReports, onCreateContractorLink,
    onNavigateToMaintenance, onBookService, onMarkTaskDone
}) => {
    const season = getSeasonalTheme();
    const greeting = getGreeting();
    const [showFullInsights, setShowFullInsights] = useState(false);
    
    // Toggle state for health score
    const [showScoreDetails, setShowScoreDetails] = useState(false);
    
    const validRecords = Array.isArray(records) ? records : [];
    const healthData = useHomeHealth(validRecords);

    const totalSpent = useMemo(() => {
        return validRecords.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);
    }, [validRecords]);

    return (
        <div className="space-y-8 pb-8">
            <div className="relative overflow-visible rounded-[2.5rem] shadow-xl z-20">
                <div className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${season.gradient}`} />
                <div className="relative p-8 text-white flex flex-col items-center text-center">
                    <p className="text-white/60 text-sm font-bold mb-1 uppercase tracking-wider">{greeting}</p>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">{activeProperty?.name || 'My Home'}</h1>
                    
                    {/* NEW: Address Display */}
                    {activeProperty?.address && (
                        <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 mb-6 animate-in fade-in zoom-in-95 duration-500">
                            <MapPin size={14} className="text-white/80" />
                            <p className="text-white/90 text-sm font-medium">
                                {activeProperty.address.city}, {activeProperty.address.state}
                            </p>
                        </div>
                    )}
                    
                    {/* Health Score Circle with Toggle */}
                    <div className="relative group mb-8">
                        <div 
                            className="relative h-24 w-24 cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setShowScoreDetails(!showScoreDetails)}
                        >
                            <svg className="transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" className="stroke-white/20" strokeWidth="10" fill="none" />
                                <circle cx="50" cy="50" r="45" className={healthData?.score >= 80 ? 'stroke-emerald-400' : healthData?.score >= 50 ? 'stroke-amber-400' : 'stroke-red-400'} strokeWidth="10" fill="none" strokeDasharray={`${(healthData?.score || 0) * 2.83} 283`} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-black">{healthData?.score || 0}</span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mt-2">Health Score</p>
                        
                        {/* Popup Card */}
                        {showScoreDetails && (
                            <HealthScoreCard 
                                breakdown={healthData?.breakdown || {profile: 0, maintenance: 0}} 
                                score={healthData?.score || 0} 
                                onClose={() => setShowScoreDetails(false)}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
                        <button onClick={onNavigateToItems} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{validRecords.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Items</p></button>
                        <button onClick={onNavigateToContractors} className="bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5 transition-colors"><p className="text-2xl font-extrabold">{contractors.length}</p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Pros</p></button>
                        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"><p className={`text-2xl font-extrabold ${season.accent}`}>{formatCurrency(totalSpent).replace('$','')}<span className="text-sm align-top text-white/60">$</span></p><p className="text-[10px] text-white/60 font-bold uppercase tracking-wide">Invested</p></div>
                    </div>
                </div>
            </div>
            
            {/* Maintenance Schedule (Using the Unified Component) */}
            <div>
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="font-bold text-slate-800 text-lg">Maintenance Schedule</h3>
                </div>
                {/* This component contains the logic for rendering the 
                   Call / Text / Email buttons for contractors.
                */}
                <MaintenanceDashboard 
                    records={records}
                    onAddRecord={onAddRecord}
                    onBookService={onBookService}
                    onMarkTaskDone={onMarkTaskDone}
                    onNavigateToRecords={onNavigateToItems}
                />
            </div>
            
            <div className="space-y-4">
                <SectionHeader title="Quick Actions" />
                <div className="grid grid-cols-2 gap-3">
                    <ActionButton icon={Camera} label="Scan Receipt" sublabel="AI-powered" onClick={onScanReceipt} variant="primary" />
                    <ActionButton icon={Plus} label="Add Item" sublabel="Manual entry" onClick={onAddRecord} />
                    <ActionButton icon={FileText} label="View Report" sublabel="Home pedigree" onClick={onNavigateToReports} />
                    <ActionButton icon={Hammer} label="Service Link" sublabel="For contractors" onClick={onCreateContractorLink} />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button onClick={() => setShowFullInsights(!showFullInsights)} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3"><div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center"><Info size={20} className="text-blue-600" /></div><div className="text-left"><p className="font-bold text-slate-800">Local Insights</p><p className="text-xs text-slate-500">{showFullInsights ? 'Tap to hide details' : 'Environmental, County & Risk Data'}</p></div></div>
                    <div className={`p-2 bg-slate-100 rounded-full transition-transform duration-300 ${showFullInsights ? 'rotate-180' : ''}`}><ChevronDown size={20} className="text-slate-500" /></div>
                </button>
                {showFullInsights && <div className="p-4 pt-0 border-t border-slate-100 mt-2 animate-in slide-in-from-top-2 fade-in"><div className="space-y-8 pt-6"><EnvironmentalInsights propertyProfile={activeProperty} /><CountyData propertyProfile={activeProperty} /></div></div>}
            </div>
        </div>
    );
};

export default ModernDashboard;
