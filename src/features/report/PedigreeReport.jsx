// src/features/report/PedigreeReport.jsx
import React from 'react';
import { Printer, ExternalLink, MapPin, Key, Wrench, HardHat, Clock, Calendar } from 'lucide-react';
import { MAINTENANCE_FREQUENCIES } from '../../config/constants';

export const PedigreeReport = ({ propertyProfile, records }) => {
    // Helper to calculate age
    const calculateAge = (categoryFilter) => {
        const filtered = records.filter(categoryFilter);
        if (filtered.length === 0) return { age: 'N/A', year: 'N/A' };
        const latest = filtered.reduce((a, b) => new Date(a.dateInstalled) > new Date(b.dateInstalled) ? a : b);
        const year = new Date(latest.dateInstalled).getFullYear();
        return { age: isNaN(year) ? 'N/A' : new Date().getFullYear() - year, year };
    };

    const hvacAge = calculateAge(r => r.category === "HVAC & Systems");
    const roofAge = calculateAge(r => r.item.toLowerCase().includes('roof'));
    const waterHeaterAge = calculateAge(r => r.item.toLowerCase().includes('water heater'));
    const timelineRecords = [...records].sort((a, b) => new Date(b.dateInstalled) - new Date(a.dateInstalled));

    return (
        <div className="space-y-8 print:p-0">
             <div className="flex justify-between items-center mb-6 no-print">
                <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700"><Printer className="h-4 w-4 mr-2" /> Print Report</button>
            </div>
            <div className="bg-sky-950 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden print:bg-white print:text-black">
                <div className="relative z-10">
                    <div className="flex items-center mb-6"><Key className="h-8 w-8 text-sky-200 mr-4"/><span className="text-xl font-bold tracking-widest uppercase text-sky-200">Official Pedigree</span></div>
                    <h1 className="text-4xl font-extrabold mb-2">{propertyProfile.name}</h1>
                    <p className="text-sky-200 text-lg flex items-center"><MapPin className="h-5 w-5 mr-2" /> {propertyProfile.address?.street}, {propertyProfile.address?.city}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border border-slate-100 rounded-[2rem] bg-white shadow-lg">
                {[
                    { label: "Total Records", val: records.length },
                    { label: "HVAC Age", val: hvacAge.age + " Yrs" },
                    { label: "Roof Age", val: roofAge.age + " Yrs" },
                    { label: "Water Heater", val: waterHeaterAge.age + " Yrs" }
                ].map((stat, i) => (
                    <div key={i} className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
                        <p className="text-3xl font-extrabold text-sky-900">{stat.val}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900 mb-10 flex items-center"><Wrench className="h-6 w-6 mr-3 text-sky-600"/> History Timeline</h2>
                <div className="space-y-10 border-l-2 border-slate-100 ml-3 pl-10 relative">
                    {timelineRecords.map(record => (
                        <div key={record.id} className="relative group">
                            <div className="absolute -left-[49px] top-1 h-5 w-5 rounded-full bg-sky-500 border-4 border-white shadow-sm ring-1 ring-slate-100"></div>
                            <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
                                <span className="font-bold text-xl text-slate-900">{record.item}</span>
                                <span className="text-sm font-mono text-slate-400">{record.dateInstalled}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
                                    <div><p className="text-xs text-slate-400 uppercase font-bold mb-1">Category</p><p className="font-bold text-slate-800">{record.category}</p></div>
                                    {record.contractor && <div><p className="text-xs text-slate-400 uppercase font-bold mb-1">Provider</p><p className="font-medium text-slate-800 flex items-center"><HardHat className="h-3 w-3 mr-1.5 text-sky-500"/> {record.contractor}</p></div>}
                                </div>
                                {record.notes && <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm italic mb-4">"{record.notes}"</div>}
                                {record.imageUrl && <img src={record.imageUrl} alt="Proof" className="h-32 rounded-lg border border-slate-200 object-cover"/>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
