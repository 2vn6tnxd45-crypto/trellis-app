// src/features/report/PedigreeReport.jsx
import React, { useMemo } from 'react';
import { 
    Printer, MapPin, Key, Wrench, Calendar, ShieldCheck, 
    Home, Award, Clock, DollarSign, PenTool, CheckCircle2
} from 'lucide-react';
import { useCountyData } from '../../hooks/useCountyData';

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

export const PedigreeReport = ({ propertyProfile, records = [] }) => {
    const { parcelData } = useCountyData(propertyProfile?.coordinates, propertyProfile?.address);

    // Calculate System Ages
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

    // Filter for "Capital Improvements" (Cost > $500 or major categories)
    const capitalImprovements = useMemo(() => {
        return records.filter(r => 
            (r.cost && parseFloat(r.cost) > 500) || 
            ['Roof & Exterior', 'HVAC & Systems', 'Flooring'].includes(r.category)
        ).sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled));
    }, [records]);

    // Group remaining records by year for the timeline
    const timeline = useMemo(() => {
        return records.sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled));
    }, [records]);

    const totalInvestment = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 print:pb-0 print:max-w-none">
            
            {/* Action Bar (Hidden when printing) */}
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
                
                {/* 1. HEADER */}
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

                {/* 2. PROPERTY VITALS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50 print:bg-slate-50">
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Year Built</p>
                        <p className="text-3xl font-extrabold text-slate-800">{parcelData?.yearBuilt || '—'}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tracked Items</p>
                        <p className="text-3xl font-extrabold text-indigo-600">{records.length}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Investment</p>
                        <p className="text-3xl font-extrabold text-emerald-600">{formatCurrency(totalInvestment)}</p>
                    </div>
                    <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Assessment</p>
                        <p className="text-3xl font-extrabold text-slate-800">
                            {parcelData?.assessedValue ? `$${(parcelData.assessedValue / 1000).toFixed(0)}k` : '—'}
                        </p>
                    </div>
                </div>

                <div className="p-12 space-y-12 print:p-8 print:space-y-8">
                    
                    {/* 3. MAJOR SYSTEMS HEALTH */}
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

                    {/* 4. CAPITAL IMPROVEMENTS */}
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

                    {/* 5. COMPLETE MAINTENANCE LOG */}
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
                                        
                                        {/* Attachment Indicators */}
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

                    {/* DISCLAIMER FOOTER */}
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
