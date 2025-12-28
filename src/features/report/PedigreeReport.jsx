// src/features/report/PedigreeReport.jsx
import React, { useMemo } from 'react';
import { 
    Printer, MapPin, Key, Wrench, Calendar, ShieldCheck, 
    Home, Award, Clock, DollarSign, PenTool, CheckCircle2,
    Shield, Phone, Mail, AlertTriangle, Users
} from 'lucide-react';
import { useCountyData } from '../../hooks/useCountyData';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper to format currency
const formatCurrency = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

// Helper to format dates
const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ============================================
// WARRANTY UTILITIES (NEW)
// ============================================

const calculateWarrantyStatus = (warranty, installDate) => {
    // Handle no warranty
    if (!warranty) {
        return { status: 'none', partsRemaining: 0, laborRemaining: 0 };
    }
    
    // Handle structured warranty (warrantyDetails)
    if (typeof warranty === 'object' && warranty !== null && warranty.hasCoverage !== undefined) {
        const now = new Date();
        const start = new Date(warranty.startDate || installDate);
        const monthsElapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 30.44));
        
        const partsRemaining = Math.max(0, (warranty.partsMonths || 0) - monthsElapsed);
        const laborRemaining = Math.max(0, (warranty.laborMonths || 0) - monthsElapsed);
        
        let status = 'expired';
        if (partsRemaining > 0 || laborRemaining > 0) {
            const minRemaining = Math.min(
                partsRemaining > 0 ? partsRemaining : Infinity,
                laborRemaining > 0 ? laborRemaining : Infinity
            );
            if (minRemaining <= 3) status = 'critical';
            else if (minRemaining <= 6) status = 'expiring';
            else status = 'active';
        }
        
        return { status, partsRemaining, laborRemaining, monthsElapsed };
    }
    
    // Handle legacy string warranty
    if (typeof warranty === 'string' && warranty.length > 0) {
        return { status: 'unknown', partsRemaining: null, laborRemaining: null, legacy: true };
    }
    
    return { status: 'none', partsRemaining: 0, laborRemaining: 0 };
};

const formatMonthsRemaining = (months) => {
    if (months === null) return '—';
    if (months <= 0) return 'Expired';
    if (months < 12) return `${months} mo`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) return `${years} yr`;
    return `${years}y ${rem}m`;
};

const getStatusConfig = (status) => ({
    active:   { label: 'Active',    bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    expiring: { label: 'Expiring',  bg: 'bg-amber-500',   bgLight: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    critical: { label: 'Critical',  bg: 'bg-rose-500',    bgLight: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
    expired:  { label: 'Expired',   bg: 'bg-slate-400',   bgLight: 'bg-slate-50',   text: 'text-slate-500',   border: 'border-slate-200' },
    unknown:  { label: 'See Notes', bg: 'bg-blue-400',    bgLight: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
    none:     { label: 'None',      bg: 'bg-slate-300',   bgLight: 'bg-slate-50',   text: 'text-slate-400',   border: 'border-slate-100' }
}[status] || { label: 'Unknown', bg: 'bg-slate-300', bgLight: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-100' });

// ============================================
// WARRANTY MINI-GAUGE COMPONENT (NEW)
// ============================================

const WarrantyMiniGauge = ({ percentage, status, size = 48 }) => {
    const config = getStatusConfig(status);
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * Math.PI;
    const offset = circumference - (Math.max(0, percentage) / 100) * circumference;
    
    return (
        <div className="relative" style={{ width: size, height: size / 2 + 4 }}>
            <svg width={size} height={size / 2 + 4}>
                <path
                    d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                <path
                    d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className={config.text}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
        </div>
    );
};

// ============================================
// WARRANTY ROW COMPONENT (NEW)
// ============================================

const WarrantyRow = ({ record }) => {
    const warranty = record.warrantyDetails || record.warranty;
    const isStructured = typeof warranty === 'object' && warranty !== null;
    
    const { status, partsRemaining, laborRemaining } = calculateWarrantyStatus(warranty, record.dateInstalled);
    const config = getStatusConfig(status);
    const totalMonths = isStructured ? (warranty.partsMonths || 0) : 0;
    const percentage = totalMonths > 0 ? (partsRemaining / totalMonths) * 100 : 0;
    
    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl border ${config.border} ${config.bgLight} print:break-inside-avoid`}>
            {/* Mini Gauge */}
            <div className="shrink-0">
                <WarrantyMiniGauge percentage={percentage} status={status} />
            </div>
            
            {/* Item Info */}
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-800 truncate">{record.item}</h4>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${config.bg}`}>
                        {config.label}
                    </span>
                </div>
                <p className="text-xs text-slate-500">
                    {record.category} • Installed {formatDate(record.dateInstalled)}
                </p>
            </div>
            
            {/* Coverage Details */}
            <div className="shrink-0 text-right hidden sm:block">
                {isStructured ? (
                    <div className="space-y-1">
                        {partsRemaining > 0 && (
                            <p className="text-xs">
                                <span className="text-slate-400">Parts:</span>{' '}
                                <span className={`font-bold ${config.text}`}>{formatMonthsRemaining(partsRemaining)}</span>
                            </p>
                        )}
                        {laborRemaining > 0 && (
                            <p className="text-xs">
                                <span className="text-slate-400">Labor:</span>{' '}
                                <span className={`font-bold ${config.text}`}>{formatMonthsRemaining(laborRemaining)}</span>
                            </p>
                        )}
                        {partsRemaining === 0 && laborRemaining === 0 && status !== 'unknown' && (
                            <p className="text-xs text-slate-400 italic">Coverage ended</p>
                        )}
                    </div>
                ) : warranty ? (
                    <p className="text-xs text-slate-600 italic max-w-[150px] truncate">"{warranty}"</p>
                ) : (
                    <p className="text-xs text-slate-400">No warranty info</p>
                )}
            </div>
            
            {/* Contact Button (if available) */}
            {isStructured && warranty.contactPhone && (
                <a 
                    href={`tel:${warranty.contactPhone}`}
                    className="shrink-0 p-2 bg-white rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-colors print:hidden"
                    title="Call for warranty service"
                >
                    <Phone size={16} className="text-slate-600" />
                </a>
            )}
        </div>
    );
};

// ============================================
// WARRANTY COVERAGE SECTION (NEW)
// ============================================

const WarrantyCoverageSection = ({ records }) => {
    // Filter to items that have warranty info
    const warrantyItems = records.filter(r => r.warranty || r.warrantyDetails);
    
    // Group by status
    const grouped = useMemo(() => {
        const groups = { critical: [], expiring: [], active: [], expired: [], unknown: [] };
        
        warrantyItems.forEach(record => {
            const warranty = record.warrantyDetails || record.warranty;
            const { status } = calculateWarrantyStatus(warranty, record.dateInstalled);
            if (groups[status]) {
                groups[status].push(record);
            }
        });
        
        return groups;
    }, [warrantyItems]);
    
    const needsAttention = grouped.critical.length + grouped.expiring.length;
    
    if (warrantyItems.length === 0) {
        return (
            <section className="print:break-inside-avoid">
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                    <Shield className="mr-3 text-blue-600" /> Warranty Coverage
                </h3>
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center">
                    <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No warranty information recorded yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Add warranty details when scanning receipts.</p>
                </div>
            </section>
        );
    }
    
    return (
        <section className="print:break-inside-avoid">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900 flex items-center">
                    <Shield className="mr-3 text-blue-600" /> Warranty Coverage
                </h3>
                
                {/* Summary badges */}
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                        {grouped.active.length} Active
                    </span>
                    {needsAttention > 0 && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center gap-1">
                            <AlertTriangle size={12} /> {needsAttention} Need Attention
                        </span>
                    )}
                </div>
            </div>
            
            {/* Alert for critical items */}
            {grouped.critical.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4 flex items-start gap-3 print:bg-rose-50">
                    <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-bold text-rose-800">
                            {grouped.critical.length} warranty expires within 90 days
                        </p>
                        <p className="text-sm text-rose-600">
                            Consider extended coverage or budget for replacement.
                        </p>
                    </div>
                </div>
            )}
            
            {/* Warranty list */}
            <div className="space-y-2">
                {/* Critical first */}
                {grouped.critical.map(r => <WarrantyRow key={r.id} record={r} />)}
                {/* Then expiring */}
                {grouped.expiring.map(r => <WarrantyRow key={r.id} record={r} />)}
                {/* Then active */}
                {grouped.active.map(r => <WarrantyRow key={r.id} record={r} />)}
                {/* Then unknown (legacy string warranties) */}
                {grouped.unknown.map(r => <WarrantyRow key={r.id} record={r} />)}
                {/* Expired last (collapsed on print) */}
                {grouped.expired.length > 0 && (
                    <details className="print:open">
                        <summary className="cursor-pointer text-sm text-slate-500 py-2 hover:text-slate-700">
                            + {grouped.expired.length} expired warranties
                        </summary>
                        <div className="space-y-2 mt-2">
                            {grouped.expired.map(r => <WarrantyRow key={r.id} record={r} />)}
                        </div>
                    </details>
                )}
            </div>
        </section>
    );
};

// ============================================
// CONTRACTOR DIRECTORY SECTION (NEW)
// ============================================

const ContractorDirectorySection = ({ records }) => {
    const contractors = useMemo(() => {
        const map = new Map();
        
        records.forEach(r => {
            if (!r.contractor) return;
            const key = r.contractor.toLowerCase().trim();
            
            if (!map.has(key)) {
                map.set(key, {
                    name: r.contractor,
                    phone: r.contractorPhone,
                    email: r.contractorEmail,
                    categories: new Set(),
                    jobCount: 0,
                    totalSpent: 0,
                    lastJob: null
                });
            }
            
            const entry = map.get(key);
            entry.jobCount++;
            entry.totalSpent += parseFloat(r.cost) || 0;
            if (r.category) entry.categories.add(r.category);
            if (!entry.lastJob || new Date(r.dateInstalled) > new Date(entry.lastJob)) {
                entry.lastJob = r.dateInstalled;
            }
            // Update contact info if missing
            if (!entry.phone && r.contractorPhone) entry.phone = r.contractorPhone;
            if (!entry.email && r.contractorEmail) entry.email = r.contractorEmail;
        });
        
        return Array.from(map.values()).sort((a, b) => b.jobCount - a.jobCount);
    }, [records]);
    
    if (contractors.length === 0) return null;
    
    return (
        <section className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
                <Users className="mr-3 text-purple-600" /> Trusted Contractors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contractors.slice(0, 6).map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                            {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className="font-bold text-slate-800 truncate">{c.name}</p>
                            <p className="text-xs text-slate-500">
                                {c.jobCount} job{c.jobCount !== 1 ? 's' : ''} • {formatCurrency(c.totalSpent)}
                            </p>
                        </div>
                        <div className="flex gap-1 print:hidden">
                            {c.phone && (
                                <a href={`tel:${c.phone}`} className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-emerald-50">
                                    <Phone size={14} className="text-slate-600" />
                                </a>
                            )}
                            {c.email && (
                                <a href={`mailto:${c.email}`} className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-emerald-50">
                                    <Mail size={14} className="text-slate-600" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PedigreeReport = ({ propertyProfile, records = [] }) => {
    const { parcelData } = useCountyData(propertyProfile?.coordinates, propertyProfile?.address);

    // Calculate System Ages (PRESERVED - unchanged)
    const systemAges = useMemo(() => {
        const calculateAge = (keyword) => {
            const items = records.filter(r => 
                (r.item?.toLowerCase().includes(keyword) || r.category?.toLowerCase().includes(keyword)) && r.dateInstalled
            );
            if (items.length === 0) return null;
            // Find most recent
            const latest = items.sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled))[0];
            const age = new Date().getFullYear() - new Date(latest.dateInstalled).getFullYear();
            return { age, item: latest };
        };

        return {
            hvac: calculateAge('hvac') || calculateAge('ac') || calculateAge('furnace'),
            roof: calculateAge('roof'),
            waterHeater: calculateAge('water heater')
        };
    }, [records]);

    // Filter for "Capital Improvements" (PRESERVED - unchanged)
    const capitalImprovements = useMemo(() => {
        return records.filter(r => 
            (r.cost && parseFloat(r.cost) > 500) || 
            ['Roof & Exterior', 'HVAC & Systems', 'Flooring'].includes(r.category)
        ).sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled));
    }, [records]);

    // Group remaining records by year for the timeline (PRESERVED - unchanged)
    const timeline = useMemo(() => {
        return records.sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled));
    }, [records]);

    const totalInvestment = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

    // NEW: Calculate active warranties count
    const activeWarranties = useMemo(() => {
        return records.filter(r => {
            const warranty = r.warrantyDetails || r.warranty;
            if (!warranty) return false;
            const { status } = calculateWarrantyStatus(warranty, r.dateInstalled);
            return status === 'active' || status === 'expiring' || status === 'unknown';
        }).length;
    }, [records]);

    // NEW: Calculate unique contractors count
    const uniqueContractors = useMemo(() => {
        return new Set(records.map(r => r.contractor).filter(Boolean)).size;
    }, [records]);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 print:pb-0 print:max-w-none">
            
            {/* Action Bar (Hidden when printing) - PRESERVED */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm print:hidden">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Property Pedigree™</h2>
                    <p className="text-sm text-slate-500">Official history report for insurance or resale.</p>
                </div>
                <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                >
                    <Printer size={18} />
                    Print / Save PDF
                </button>
            </div>

            {/* REPORT DOCUMENT */}
            <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none print:border-none">
                
                {/* 1. HEADER - PRESERVED */}
                <div className="bg-slate-900 text-white p-12 relative overflow-hidden print:bg-slate-900 print:text-white print:p-8">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Home size={200} />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="bg-emerald-500/20 p-2 rounded-lg backdrop-blur-sm border border-emerald-500/30">
                                    <ShieldCheck className="text-emerald-400" size={24} />
                                </div>
                                <span className="text-emerald-400 font-bold uppercase tracking-widest text-sm">Verified Krib Report</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-2 leading-tight">
                                {propertyProfile?.address?.street || propertyProfile?.name || 'Property Report'}
                            </h1>
                            <p className="text-slate-400 text-lg flex items-center">
                                <MapPin size={18} className="mr-2" />
                                {propertyProfile?.address?.city}, {propertyProfile?.address?.state} {propertyProfile?.address?.zip}
                            </p>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-1">Report Generated</p>
                            <p className="text-2xl font-bold">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                {/* 2. PROPERTY VITALS GRID - MODIFIED (replaced Year Built & Assessment with Warranties & Contractors) */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50 print:bg-slate-50">
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Items Tracked</p>
                        <p className="text-3xl font-extrabold text-indigo-600">{records.length}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Investment</p>
                        <p className="text-3xl font-extrabold text-emerald-600">{formatCurrency(totalInvestment)}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Warranties</p>
                        <p className="text-3xl font-extrabold text-blue-600">{activeWarranties}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trusted Pros</p>
                        <p className="text-3xl font-extrabold text-purple-600">{uniqueContractors}</p>
                    </div>
                </div>

                <div className="p-12 space-y-12 print:p-8 print:space-y-8">
                    
                    {/* 3. WARRANTY COVERAGE - NEW SECTION */}
                    <WarrantyCoverageSection records={records} />

                    {/* 4. MAJOR SYSTEMS HEALTH - PRESERVED */}
                    <section>
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                            <Award className="mr-3 text-indigo-600" /> Major Systems Health
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: 'Roof', data: systemAges.roof, icon: Home },
                                { label: 'HVAC', data: systemAges.hvac, icon: Wrench },
                                { label: 'Water Heater', data: systemAges.waterHeater, icon: Clock }
                            ].map((sys) => (
                                <div key={sys.label} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{sys.label}</p>
                                        <p className="text-2xl font-extrabold text-slate-800">
                                            {sys.data ? `${sys.data.age} Years` : 'Unknown'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1 truncate max-w-[120px]">
                                            {sys.data?.item.brand || 'No record'}
                                        </p>
                                    </div>
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${sys.data && sys.data.age < 15 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <sys.icon size={20} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 5. CONTRACTOR DIRECTORY - NEW SECTION */}
                    <ContractorDirectorySection records={records} />

                    {/* 6. CAPITAL IMPROVEMENTS - PRESERVED */}
                    {capitalImprovements.length > 0 && (
                        <section className="print:break-inside-avoid">
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                                <DollarSign className="mr-3 text-emerald-600" /> Capital Improvements & Upgrades
                            </h3>
                            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Item / Project</th>
                                            <th className="p-4">Category</th>
                                            <th className="p-4 text-right">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {capitalImprovements.map((rec) => (
                                            <tr key={rec.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-mono text-slate-500">{rec.dateInstalled}</td>
                                                <td className="p-4 font-bold text-slate-800">
                                                    {rec.item}
                                                    {rec.contractor && <span className="block text-xs font-normal text-slate-400 mt-0.5">by {rec.contractor}</span>}
                                                </td>
                                                <td className="p-4 text-slate-600">{rec.category}</td>
                                                <td className="p-4 text-right font-bold text-emerald-700">{formatCurrency(rec.cost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* 7. COMPLETE MAINTENANCE LOG - PRESERVED (with warranty badge enhancement) */}
                    <section>
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
                            <Calendar className="mr-3 text-slate-600" /> Complete History Log
                        </h3>
                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pl-8 py-2">
                            {timeline.map((rec) => (
                                <div key={rec.id} className="relative group print:break-inside-avoid">
                                    {/* Timeline Dot */}
                                    <div className="absolute -left-[41px] top-1.5 h-5 w-5 rounded-full border-4 border-white bg-slate-300 group-hover:bg-indigo-500 transition-colors shadow-sm"></div>
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2">
                                        <h4 className="font-bold text-slate-800 text-lg">{rec.item}</h4>
                                        <span className="font-mono text-xs text-slate-400">{formatDate(rec.dateInstalled)}</span>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600">
                                        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                            <span>{rec.category}</span>
                                            {rec.brand && <span>• {rec.brand} {rec.model}</span>}
                                            {rec.contractor && <span>• {rec.contractor}</span>}
                                        </div>
                                        {rec.notes ? (
                                            <p className="italic">"{rec.notes}"</p>
                                        ) : (
                                            <p className="text-slate-400 italic">No additional notes recorded.</p>
                                        )}
                                        
                                        {/* NEW: Warranty Badge in Timeline */}
                                        {(rec.warranty || rec.warrantyDetails) && (
                                            <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                                <Shield size={12} className="text-blue-500" />
                                                <span className="text-xs text-blue-600">
                                                    {typeof rec.warranty === 'string' 
                                                        ? rec.warranty 
                                                        : rec.warrantyDetails?.partsMonths 
                                                            ? `${Math.floor(rec.warrantyDetails.partsMonths / 12)} year warranty`
                                                            : 'Warranty on file'
                                                    }
                                                </span>
                                            </div>
                                        )}
                                        
                                        {/* Attachment Indicators - PRESERVED */}
                                        {rec.attachments && rec.attachments.length > 0 && (
                                            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200/60">
                                                {rec.attachments.map((att, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-500">
                                                        <PenTool size={10} className="mr-1" /> {att.type || 'File'}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* DISCLAIMER FOOTER - PRESERVED */}
                    <div className="border-t border-slate-100 pt-8 text-center">
                        <div className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium mb-2">
                            <ShieldCheck size={16} /> Authenticated by Krib
                        </div>
                        <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            This report is generated based on user-submitted data and records stored in the Krib Home Management Platform. 
                            Krib verifies the existence of the digital record but does not physically inspect the property.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};
