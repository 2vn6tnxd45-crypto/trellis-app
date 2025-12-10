// src/features/dashboard/HomeSnapshot.jsx
// ============================================
// 🏠 HOME SNAPSHOT
// ============================================
// Provides INSTANT value to users by showing property intelligence
// even before they add a single item. This is the "magic moment"
// that converts signups into engaged users.

import React, { useState } from 'react';
import { 
    MapPin, CloudRain, Wifi, Sun, Building2, Calendar, 
    Share2, Download, ChevronRight, Shield, AlertTriangle,
    CheckCircle2, Zap, ExternalLink, Copy, Check
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

const StatCard = ({ icon: Icon, label, value, subtext, color = "emerald" }) => (
    <div className={`bg-${color}-50 rounded-xl p-4 border border-${color}-100`}>
        <div className="flex items-start justify-between">
            <div>
                <p className={`text-xs font-bold text-${color}-600 uppercase tracking-wide mb-1`}>{label}</p>
                <p className={`text-2xl font-extrabold text-${color}-900`}>{value}</p>
                {subtext && <p className={`text-xs text-${color}-600 mt-1`}>{subtext}</p>}
            </div>
            <div className={`bg-white p-2 rounded-lg shadow-sm border border-${color}-100`}>
                <Icon className={`h-5 w-5 text-${color}-600`} />
            </div>
        </div>
    </div>
);

export const HomeSnapshot = ({ propertyProfile, recordCount = 0, onAddFirstItem }) => {
    const { coordinates, address, name } = propertyProfile || {};
    const { flood, broadband, loading: neighborhoodLoading } = useNeighborhoodData(coordinates);
    const { parcelData, loading: countyLoading, detectedLocation } = useCountyData(coordinates, address);
    const [copied, setCopied] = useState(false);
    
    const loading = neighborhoodLoading || countyLoading;
    
    // Calculate home age if we have county data
    const homeAge = parcelData?.yearBuilt 
        ? new Date().getFullYear() - parcelData.yearBuilt 
        : null;
    
    // Generate shareable summary
    const generateShareText = () => {
        let text = `🏠 ${name || 'My Home'}\n`;
        text += `📍 ${address?.street}, ${address?.city}, ${address?.state}\n\n`;
        
        if (flood) {
            text += `🌊 Flood Risk: Zone ${flood.zone} (${flood.isHighRisk ? 'High Risk' : 'Low Risk'})\n`;
        }
        if (broadband) {
            text += `📡 Internet: Up to ${broadband.maxSpeed} Mbps${broadband.hasFiber ? ' (Fiber!)' : ''}\n`;
        }
        if (parcelData?.assessedValue) {
            text += `💰 Assessed Value: $${parcelData.assessedValue.toLocaleString()}\n`;
        }
        
        text += `\n📱 Powered by Krib - krib.io`;
        return text;
    };
    
    const handleCopySnapshot = () => {
        navigator.clipboard.writeText(generateShareText());
        setCopied(true);
        toast.success('Snapshot copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleShare = async () => {
        const shareData = {
            title: `${name || 'Home'} Snapshot`,
            text: generateShareText(),
        };
        
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                handleCopySnapshot();
            }
        } else {
            handleCopySnapshot();
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <span className="text-emerald-100 font-bold text-xs uppercase tracking-wider">Home Snapshot</span>
                        </div>
                        <button 
                            onClick={handleShare}
                            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors backdrop-blur-sm"
                        >
                            {copied ? <Check size={14} /> : <Share2 size={14} />}
                            {copied ? 'Copied!' : 'Share'}
                        </button>
                    </div>
                    
                    <h2 className="text-2xl font-extrabold mb-1">{name || 'My Home'}</h2>
                    {address && (
                        <p className="text-emerald-100 flex items-center text-sm">
                            <MapPin size={14} className="mr-1.5" />
                            {address.street}, {address.city}, {address.state} {address.zip}
                        </p>
                    )}
                </div>
            </div>
            
            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50">
                <div className="p-4 text-center">
                    <p className="text-2xl font-extrabold text-slate-800">{recordCount}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Items Tracked</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-2xl font-extrabold text-slate-800">
                        {homeAge !== null ? homeAge : '—'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Years Old</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-2xl font-extrabold text-emerald-600">
                        {parcelData?.assessedValue 
                            ? `$${Math.round(parcelData.assessedValue / 1000)}k`
                            : '—'
                        }
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Assessed</p>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="p-6 space-y-6">
                
                {/* Risk Assessment */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                        <Shield size={12} className="mr-1.5" />
                        Risk Assessment
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {/* Flood Risk */}
                        <div className={`p-4 rounded-xl border ${flood?.isHighRisk ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="flex items-start justify-between mb-2">
                                <CloudRain className={`h-5 w-5 ${flood?.isHighRisk ? 'text-red-600' : 'text-emerald-600'}`} />
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
                                <p className="text-xs text-slate-500 mt-1">Zone {flood.zone}</p>
                            )}
                        </div>
                        
                        {/* Wildfire - Link to external */}
                        <a 
                            href={`https://wildfirerisk.org/explore/${address?.zip || ''}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-4 rounded-xl border bg-orange-50 border-orange-100 hover:border-orange-200 transition-colors group"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                                <ExternalLink size={14} className="text-orange-400 group-hover:text-orange-600 transition-colors" />
                            </div>
                            <p className="font-bold text-slate-800 text-sm">Wildfire Risk</p>
                            <p className="text-xs text-slate-500 mt-1">Check USDA Map →</p>
                        </a>
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
                            <p className="text-sm text-slate-400">Broadband data unavailable</p>
                        )}
                    </div>
                </div>
                
                {/* Solar Potential Teaser */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-sm border border-amber-100">
                                <Sun className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Solar Potential</p>
                                <p className="text-xs text-slate-500">See full analysis in Property tab</p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-amber-400" />
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
                                    {parcelData?.apn ? `Parcel: ${parcelData.apn}` : 'County records available'}
                                </p>
                            </div>
                            <a 
                                href="#"
                                onClick={(e) => { e.preventDefault(); /* Navigate to Property tab */ }}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                            >
                                View Details →
                            </a>
                        </div>
                    </div>
                )}
            </div>
            
            {/* CTA Footer */}
            {recordCount === 0 && (
                <div className="p-6 pt-0">
                    <button
                        onClick={onAddFirstItem}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Zap size={18} />
                        Add Your First Item
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-3">
                        Start with your HVAC, water heater, or roof
                    </p>
                </div>
            )}
        </div>
    );
};
