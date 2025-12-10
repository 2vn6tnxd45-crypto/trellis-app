// src/features/dashboard/HomeSnapshot.jsx
import React, { useState } from 'react';
import { 
    CloudRain, Wifi, Sun, Share2, 
    Shield, AlertTriangle, CheckCircle2, Zap, ExternalLink, Check, Flame
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNeighborhoodData } from '../../hooks/useNeighborhoodData';
import { useCountyData } from '../../hooks/useCountyData';

const RiskBadge = ({ level, label }) => {
    const config = {
        low: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
        medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
        high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle }
    };
    const style = config[level] || config.low;
    const Icon = style.icon;
    
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text} border ${style.border}`}>
            <Icon size={12} className="mr-1" />
            {label}
        </span>
    );
};

export const HomeSnapshot = ({ propertyProfile }) => {
    const { coordinates, address } = propertyProfile || {};
    const { flood, broadband, wildfire, loading: neighborhoodLoading } = useNeighborhoodData(coordinates);
    const { parcelData, detectedLocation } = useCountyData(coordinates, address);
    
    // We only need loading state for the insights now
    const loading = neighborhoodLoading;

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-emerald-600" />
                    Property & Risk Insights
                </h2>
            </div>
            
            <div className="p-6 space-y-6">
                
                {/* Risk Assessment */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Natural Hazards
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Flood Risk */}
                        <div className={`p-4 rounded-xl border ${flood?.isHighRisk ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-start justify-between mb-2">
                                <CloudRain className={`h-5 w-5 ${flood?.isHighRisk ? 'text-red-600' : 'text-slate-400'}`} />
                                {loading ? (
                                    <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                                ) : (
                                    <RiskBadge 
                                        level={flood?.isHighRisk ? 'high' : 'low'} 
                                        label={flood?.isHighRisk ? 'High' : 'Low'} 
                                    />
                                )}
                            </div>
                            <p className="font-bold text-slate-800 text-sm">Flood Risk</p>
                            {flood && (
                                <p className="text-xs text-slate-500 mt-1">Zone {flood.zone} • {flood.subtype}</p>
                            )}
                        </div>
                        
                        {/* Wildfire Risk (UPDATED) */}
                        <div className={`p-4 rounded-xl border ${wildfire?.isHighRisk ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-start justify-between mb-2">
                                <Flame className={`h-5 w-5 ${wildfire?.isHighRisk ? 'text-orange-600' : 'text-slate-400'}`} />
                                {loading ? (
                                    <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
                                ) : (
                                    <RiskBadge 
                                        level={wildfire?.isHighRisk ? 'high' : wildfire?.riskLevel === 'Moderate' ? 'medium' : 'low'} 
                                        label={wildfire?.riskLevel || 'Unknown'} 
                                    />
                                )}
                            </div>
                            <p className="font-bold text-slate-800 text-sm">Wildfire Risk</p>
                            <p className="text-xs text-slate-500 mt-1">USDA Score: {wildfire?.score ? Math.round(wildfire.score) : '--'}/100</p>
                        </div>
                    </div>
                </div>
                
                {/* Connectivity */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                        <Wifi size={12} className="mr-1.5" />
                        Connectivity
                    </h3>
                    <div className={`p-4 rounded-xl border ${broadband?.hasFiber ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                        {loading ? (
                            <div className="space-y-2">
                                <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                            </div>
                        ) : broadband ? (
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-2xl font-extrabold text-slate-800">{broadband.maxSpeed}</p>
                                        <span className="text-sm font-medium text-slate-500">Mbps max</span>
                                        {broadband.hasFiber && (
                                            <span className="bg-blue-200 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                FIBER
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {broadband.count} provider{broadband.count !== 1 ? 's' : ''} available
                                    </p>
                                </div>
                                <Zap className={`h-8 w-8 ${broadband.hasFiber ? 'text-blue-400' : 'text-slate-300'}`} />
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">Broadband data unavailable for this location.</p>
                        )}
                    </div>
                </div>
                
                {/* County Data Link */}
                {detectedLocation?.county && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-800 text-sm">
                                    {detectedLocation.county}, {detectedLocation.state}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {parcelData?.apn ? `Parcel: ${parcelData.apn}` : 'County records detected'}
                                </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 bg-white px-2 py-1 rounded border border-slate-200">
                                {parcelData?.yearBuilt ? `Built ${parcelData.yearBuilt}` : 'Public Data'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
