// src/features/dashboard/PropertyIntelligence.jsx
// ============================================
// 🏠 PROPERTY INTELLIGENCE
// ============================================
// Shows property data from public records.
// UPDATED: Shows only FACTUAL data - no made-up estimates.
// Tax assessment and last sale price are real; "estimated value" was removed.

import React, { useState } from 'react';
import { 
    Home, 
    DollarSign, 
    Ruler, 
    BedDouble, 
    Bath,
    Droplets,
    AlertTriangle,
    Loader2,
    Info,
    Building2,
    LandPlot,
    CalendarClock,
    Flame,
    Wind,
    Car,
    Database,
    FileText,
    Calendar
} from 'lucide-react';
import usePropertyData from '../../hooks/usePropertyData';

// ============================================
// HELPERS
// ============================================
const formatCurrency = (value) => {
    if (!value && value !== 0) return '--';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);
};

const formatNumber = (value) => {
    if (!value && value !== 0) return '--';
    return new Intl.NumberFormat('en-US').format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
    });
};

// ============================================
// LOADING STATE
// ============================================
const LoadingState = () => (
    <div className="space-y-4">
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 rounded-2xl">
            <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-white/60" />
            </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-100">
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse mb-2" />
                    <div className="h-6 w-12 bg-slate-200 rounded animate-pulse" />
                </div>
            ))}
        </div>
    </div>
);

// ============================================
// STAT CARD
// ============================================
const StatCard = ({ icon: Icon, label, value, subvalue, iconColor = 'text-slate-400' }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
            <Icon size={14} className={iconColor} />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {subvalue && <p className="text-xs text-slate-500 mt-0.5">{subvalue}</p>}
    </div>
);

// ============================================
// PROPERTY VALUE CARD (HERO) - FACTUAL DATA ONLY
// ============================================
const PropertyValueCard = ({ taxAssessment, assessmentYear, lastSalePrice, lastSaleDate }) => {
    // Calculate time since purchase
    const purchaseYear = lastSaleDate ? new Date(lastSaleDate).getFullYear() : null;
    const yearsOwned = purchaseYear ? new Date().getFullYear() - purchaseYear : null;
    
    return (
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 rounded-2xl text-white relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10">
                <Home size={120} />
            </div>
            
            <div className="relative z-10">
                {/* Main Values - Tax Assessment & Last Sale */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tax Assessment */}
                    {taxAssessment && (
                        <div>
                            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                                <FileText size={14} />
                                Tax Assessment {assessmentYear ? `(${assessmentYear})` : ''}
                            </p>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                                {formatCurrency(taxAssessment)}
                            </h2>
                        </div>
                    )}

                    {/* Last Sale */}
                    {lastSalePrice && (
                        <div>
                            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                                <DollarSign size={14} />
                                Purchase Price
                            </p>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                                {formatCurrency(lastSalePrice)}
                            </h2>
                            {lastSaleDate && (
                                <p className="text-emerald-200 text-sm mt-1">
                                    {formatDate(lastSaleDate)}
                                    {yearsOwned !== null && yearsOwned > 0 && ` (${yearsOwned} year${yearsOwned !== 1 ? 's' : ''} ago)`}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Info note */}
                <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <p className="text-sm text-emerald-100">
                        <Info size={14} className="inline mr-1.5 opacity-70" />
                        Values shown are from public records. For current market estimates, consult a real estate professional.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// FLOOD RISK CARD
// ============================================
const FloodRiskCard = ({ floodData }) => {
    if (!floodData) return null;
    
    const riskConfig = {
        'Minimal': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
        'Moderate': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
        'High': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
        'Very High': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
        'Undetermined': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' }
    };
    
    const config = riskConfig[floodData.riskLevel] || riskConfig['Undetermined'];
    
    return (
        <div className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${config.bg}`}>
                    <Droplets size={20} className={config.text} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">Flood Risk</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${config.bg} ${config.text} border ${config.border}`}>
                            {floodData.riskLevel}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{floodData.riskDescription}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>Zone: <strong>{floodData.zone}</strong></span>
                        {floodData.requiresInsurance && (
                            <span className="text-orange-600 font-medium">• Insurance Required</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// PROPERTY FEATURES
// ============================================
const PropertyFeatures = ({ features, hoaFee }) => {
    if (!features) return null;
    
    const items = [];
    if (features.cooling) items.push({ icon: Wind, label: features.coolingType || 'AC' });
    if (features.heating) items.push({ icon: Flame, label: features.heatingType || 'Heat' });
    if (features.garage) items.push({ icon: Car, label: `${features.garageSpaces || 1} Car Garage` });
    if (features.pool) items.push({ icon: Droplets, label: 'Pool' });
    if (features.fireplace) items.push({ icon: Flame, label: 'Fireplace' });
    
    if (items.length === 0 && !hoaFee) return null;
    
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-slate-400" />
                Property Features
            </h4>
            <div className="flex flex-wrap gap-2">
                {items.map((item, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                        <item.icon size={14} className="text-slate-500" />
                        {item.label}
                    </span>
                ))}
                {hoaFee && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700">
                        <DollarSign size={14} />
                        HOA: {formatCurrency(hoaFee)}/mo
                    </span>
                )}
            </div>
        </div>
    );
};

// ============================================
// DATA SOURCE BANNER
// ============================================
const DataSourceBanner = ({ source }) => {
    if (source === 'rentcast') {
        return (
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                <Database size={12} />
                <span>Data from public records via RentCast</span>
            </div>
        );
    }
    
    return (
        <div className="flex items-center justify-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
            <Info size={12} />
            <span>Sample data shown • Add RentCast API key for real property data</span>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const PropertyIntelligence = ({ propertyProfile }) => {
    const { address, coordinates } = propertyProfile || {};
    
    const {
        propertyData,
        floodData,
        loading,
        pricePerSqft,
        homeAge,
    } = usePropertyData(address, coordinates);

    // Don't render if no address
    if (!address) {
        return (
            <div className="p-6 text-center text-slate-400">
                <Home size={32} className="mx-auto mb-2 opacity-50" />
                <p>Add an address to see property intelligence</p>
            </div>
        );
    }

    // Loading state
    if (loading) {
        return <LoadingState />;
    }

    // No data state
    if (!propertyData) {
        return (
            <div className="p-6 text-center text-slate-400">
                <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                <p>Unable to load property data</p>
            </div>
        );
    }

    // Full content
    return (
        <div className="space-y-4">
            {/* Property Value Card - Factual Data Only */}
            <PropertyValueCard 
                taxAssessment={propertyData.taxAssessment}
                assessmentYear={propertyData.assessmentYear}
                lastSalePrice={propertyData.lastSalePrice}
                lastSaleDate={propertyData.lastSaleDate}
            />
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={BedDouble} label="Bedrooms" value={propertyData.bedrooms || '--'} iconColor="text-indigo-400" />
                <StatCard icon={Bath} label="Bathrooms" value={propertyData.bathrooms || '--'} iconColor="text-sky-400" />
                <StatCard 
                    icon={Ruler} 
                    label="Square Feet" 
                    value={formatNumber(propertyData.squareFootage)} 
                    subvalue={pricePerSqft ? `${formatCurrency(pricePerSqft)}/sqft` : null}
                    iconColor="text-amber-400" 
                />
                <StatCard 
                    icon={CalendarClock} 
                    label="Year Built" 
                    value={propertyData.yearBuilt || '--'} 
                    subvalue={homeAge ? `${homeAge} years old` : null}
                    iconColor="text-emerald-400" 
                />
            </div>
            
            {/* Property Details */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard 
                    icon={LandPlot} 
                    label="Lot Size" 
                    value={propertyData.lotSize ? `${formatNumber(propertyData.lotSize)} sqft` : '--'} 
                    iconColor="text-green-400" 
                />
                <StatCard 
                    icon={DollarSign} 
                    label="Tax Assessment" 
                    value={formatCurrency(propertyData.taxAssessment)} 
                    subvalue={propertyData.assessmentYear ? `(${propertyData.assessmentYear})` : null}
                    iconColor="text-emerald-400" 
                />
            </div>
            
            {/* Features */}
            <PropertyFeatures features={propertyData.features} hoaFee={propertyData.hoaFee} />
            
            {/* Flood Risk */}
            <FloodRiskCard floodData={floodData} />
            
            {/* Data Source */}
            <DataSourceBanner source={propertyData.source} />
        </div>
    );
};

export default PropertyIntelligence;
