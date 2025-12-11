// src/features/dashboard/NeighborhoodData.jsx
import React from 'react';
import { CloudRain, Wifi, GraduationCap, Users, Zap, ExternalLink, AlertTriangle, CheckCircle2, Loader2, BookOpen } from 'lucide-react';
import { useNeighborhoodData } from '../../hooks/useNeighborhoodData';

export const NeighborhoodData = ({ propertyProfile }) => {
    const { coordinates, address } = propertyProfile || {};
    // UPDATED: Pass address to the hook
    const { flood, broadband, wildfire, loading } = useNeighborhoodData(coordinates, address);

    if (loading) return <div className="p-8 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2"/>Loading neighborhood intel...</div>;

    const zip = address?.zip || '';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
            
            {/* 1. Natural Hazards & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Flood Card */}
                <div className={`p-5 rounded-2xl border ${flood?.isHighRisk ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl ${flood?.isHighRisk ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <CloudRain size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Flood Risk</h3>
                            {flood ? (
                                <>
                                    <p className={`text-lg font-extrabold ${flood.isHighRisk ? 'text-red-700' : 'text-emerald-700'}`}>
                                        Zone {flood.zone}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">{flood.subtype || (flood.isHighRisk ? "High Risk Area" : "Minimal Flood Hazard")}</p>
                                    {flood.isHighRisk && (
                                        <div className="mt-3 flex items-center text-xs font-bold text-red-600 bg-white px-2 py-1 rounded border border-red-100 inline-block">
                                            <AlertTriangle size={12} className="mr-1"/> Flood Insurance Required
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-slate-400">Data unavailable</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Wildfire Card */}
                <div className={`p-5 rounded-2xl border ${wildfire?.isHighRisk ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl ${wildfire?.isHighRisk ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Wildfire Risk</h3>
                            {wildfire ? (
                                <>
                                    <p className={`text-lg font-extrabold ${wildfire.isHighRisk ? 'text-orange-700' : 'text-amber-700'}`}>
                                        {wildfire.riskLevel}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">USDA Score: {Math.round(wildfire.score)}/100</p>
                                    <a href={`https://wildfirerisk.org/explore/${zip}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">
                                        View Map <ExternalLink size={12} className="ml-1"/>
                                    </a>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400">Data unavailable</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Digital Connectivity */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><Wifi size={20} /></div>
                        <h3 className="font-bold text-slate-800">Connectivity</h3>
                    </div>
                    {broadband?.hasFiber && (
                        <span className="mt-2 sm:mt-0 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full flex items-center">
                            <CheckCircle2 size={12} className="mr-1"/> Fiber Available
                        </span>
                    )}
                </div>
                
                {broadband ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-bold text-slate-400 uppercase">Max Speed</p>
                            <p className="text-xl font-extrabold text-slate-800">{broadband.maxSpeed} <span className="text-sm font-medium text-slate-500">Mbps</span></p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-bold text-slate-400 uppercase">Providers</p>
                            <p className="text-xl font-extrabold text-slate-800">{broadband.count}</p>
                        </div>
                        {broadband.providers.length > 0 && (
                            <div className="col-span-2">
                                <p className="text-xs text-slate-400 mb-1">Top Providers:</p>
                                <div className="flex flex-wrap gap-2">
                                    {broadband.providers.map(p => (
                                        <span key={p} className="text-xs font-medium bg-white border border-slate-200 px-2 py-1 rounded text-slate-600">{p}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">Broadband data unavailable.</p>
                )}
            </div>

            {/* 3. Community Vitals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a href={`https://nces.ed.gov/globallocator/index.asp?State=${address?.state}&City=${address?.city}&ZipCode=${zip}`} target="_blank" rel="noreferrer" className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                    <div className="mb-3 bg-violet-50 w-10 h-10 flex items-center justify-center rounded-xl text-violet-600 group-hover:scale-110 transition-transform">
                        <GraduationCap size={20} />
                    </div>
                    <h4 className="font-bold text-slate-700 text-sm">Schools</h4>
                    <p className="text-xs text-slate-400 mt-1">Find district ratings</p>
                </a>

                <a href={`https://censusreporter.org/profiles/86000US${zip}-${zip}/`} target="_blank" rel="noreferrer" className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                    <div className="mb-3 bg-indigo-50 w-10 h-10 flex items-center justify-center rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                        <Users size={20} />
                    </div>
                    <h4 className="font-bold text-slate-700 text-sm">Census Data</h4>
                    <p className="text-xs text-slate-400 mt-1">Income & population</p>
                </a>

                <a href={`https://www.dsireusa.org/`} target="_blank" rel="noreferrer" className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                    <div className="mb-3 bg-yellow-50 w-10 h-10 flex items-center justify-center rounded-xl text-yellow-600 group-hover:scale-110 transition-transform">
                        <Zap size={20} />
                    </div>
                    <h4 className="font-bold text-slate-700 text-sm">Rebates</h4>
                    <p className="text-xs text-slate-400 mt-1">Energy incentives</p>
                </a>
            </div>
        </div>
    );
};
