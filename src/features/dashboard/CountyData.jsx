// src/features/dashboard/CountyData.jsx
import React, { useState } from 'react';
import { Building2, Map, DollarSign, User, AlertCircle, Loader2, FileText, ExternalLink, Search, Sparkles } from 'lucide-react';
import { useCountyData } from '../../hooks/useCountyData';
import { useGemini } from '../../hooks/useGemini';

export const CountyData = ({ propertyProfile }) => {
    const { parcelData, loading, error, serviceUrl, detectedLocation } = useCountyData(propertyProfile?.coordinates, propertyProfile?.address);
    const { getCountyRecordGuide, isSearching } = useGemini();
    const [aiGuide, setAiGuide] = useState(null);

    const handleGetAiHelp = async () => {
        if (detectedLocation) {
            const guide = await getCountyRecordGuide(detectedLocation.county, detectedLocation.state);
            setAiGuide(guide);
        }
    };

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

    // ERROR STATE: But we know the county!
    if (error && detectedLocation) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <Building2 className="mr-2 h-5 w-5 text-emerald-600" /> 
                    County Records
                </h2>
                
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="bg-amber-100 p-3 rounded-xl">
                            <Map className="h-6 w-6 text-amber-700" />
                        </div>
                        <div className="flex-grow">
                            <h3 className="font-bold text-slate-800 text-lg">
                                Located in {detectedLocation.county}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                We couldn't automatically pull the parcel data, but we know where you are.
                            </p>
                            
                            {!aiGuide ? (
                                <button 
                                    onClick={handleGetAiHelp}
                                    disabled={isSearching}
                                    className="mt-4 flex items-center text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
                                >
                                    {isSearching ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Sparkles className="h-4 w-4 mr-2"/>}
                                    Find Search Portal for Me
                                </button>
                            ) : (
                                <div className="mt-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-xs font-bold text-emerald-600 uppercase mb-2">AI Recommendation</p>
                                    <p className="font-bold text-slate-800 mb-1">{aiGuide.department}</p>
                                    <p className="text-sm text-slate-600 mb-3">{aiGuide.tips}</p>
                                    <a 
                                        href={aiGuide.url} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        Visit Official Site <ExternalLink size={14} className="ml-2"/>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // GENERIC ERROR (Unknown location)
    if (error || !parcelData) {
        return null; // Or generic error UI
    }

    // SUCCESS STATE (Existing code...)
    const formatVal = (val) => val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : 'N/A';

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <Building2 className="mr-2 h-5 w-5 text-emerald-600" /> 
                County Assessor Data
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
                <div className="bg-emerald-50/50 p-4 border-b border-emerald-100 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Parcel ID / APN</p>
                        <p className="font-mono font-bold text-slate-800 text-lg">{parcelData.apn}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                </div>
                {/* ... Rest of the success UI ... */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="mb-4">
                            <p className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center"><User size={12} className="mr-1"/> Owner of Record</p>
                            <p className="font-bold text-slate-700 truncate" title={parcelData.owner}>{parcelData.owner}</p>
                        </div>
                        {/* Add other fields as needed */}
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-xs text-slate-500 font-medium">Assessed Value</span>
                            <span className="font-bold text-slate-800">{formatVal(parcelData.assessedValue)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
