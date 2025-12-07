// src/features/dashboard/CountyData.jsx
import React from 'react';
import { Building2, Map, DollarSign, User, AlertCircle, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useCountyData } from '../../hooks/useCountyData';

export const CountyData = ({ propertyProfile }) => {
    // We assume propertyProfile has { coordinates: {lat, lon}, address: { city, state... } }
    // If address contains county, pass it. Otherwise hook infers from city/state.
    const { parcelData, loading, error, serviceUrl } = useCountyData(propertyProfile?.coordinates, propertyProfile?.address);

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center justify-center h-48">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Searching county records...</p>
                </div>
            </div>
        );
    }

    if (error || !parcelData) {
        return (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center">
                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h3 className="font-bold text-slate-600 mb-1">Public Records Not Found</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    We couldn't automatically connect to this county's open data portal. You may need to visit the county assessor's site directly.
                </p>
            </div>
        );
    }

    const formatVal = (val) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <Building2 className="mr-2 h-5 w-5 text-emerald-600" /> 
                County Assessor Data
            </h2>

            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
                {/* Header with APN */}
                <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Parcel ID / APN</p>
                        <p className="font-mono font-bold text-slate-800 text-lg">{parcelData.apn}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                </div>

                {/* Grid Details */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="mb-4">
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center"><User size={12} className="mr-1"/> Owner of Record</p>
                            <p className="font-bold text-slate-700 truncate" title={parcelData.owner}>{parcelData.owner}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center"><Map size={12} className="mr-1"/> Legal Description</p>
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{parcelData.legalDesc}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-xs text-slate-500 font-medium">Assessed Value</span>
                            <span className="font-bold text-slate-800">{formatVal(parcelData.assessedValue)}</span>
                        </div>
                        {parcelData.landValue && (
                            <div className="flex justify-between items-center px-3">
                                <span className="text-xs text-slate-400">Land</span>
                                <span className="text-xs font-mono text-slate-600">{formatVal(parcelData.landValue)}</span>
                            </div>
                        )}
                        {parcelData.improvementValue && (
                            <div className="flex justify-between items-center px-3">
                                <span className="text-xs text-slate-400">Improvements</span>
                                <span className="text-xs font-mono text-slate-600">{formatVal(parcelData.improvementValue)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Link */}
                <div className="bg-slate-50 p-3 border-t border-slate-100 text-center">
                    <a href={serviceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center justify-center">
                        View Source Record <ExternalLink size={10} className="ml-1" />
                    </a>
                </div>
            </div>
        </div>
    );
};
