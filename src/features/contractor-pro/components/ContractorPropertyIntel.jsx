// src/features/contractor-pro/components/ContractorPropertyIntel.jsx
// ============================================
// 🔧 CONTRACTOR PROPERTY INTEL
// ============================================
// Shows property data optimized for contractor needs
// Highlights building materials, utilities, access points
// Only shows real Rentcast data - hides if missing

import React from 'react';
import {
    Home,
    Building2,
    Triangle,
    Square,
    Layers,
    Wrench,
    Droplets,
    Flame,
    Wind,
    Car,
    Ruler,
    Calendar,
    MapPin,
    AlertTriangle,
    Info
} from 'lucide-react';

// ============================================
// HELPERS
// ============================================
const formatNumber = (value) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-US').format(value);
};

// ============================================
// MAIN COMPONENT
// ============================================
export const ContractorPropertyIntel = ({ propertyData, className = '' }) => {
    // Don't render if no real data
    if (!propertyData || propertyData.source === 'mock-data' || !propertyData.source) {
        return null;
    }

    const {
        // Basics
        squareFootage,
        yearBuilt,
        bedrooms,
        bathrooms,
        stories,
        // Building Materials
        roofType,
        exteriorType,
        foundationType,
        constructionType,
        quality,
        condition,
        // Utilities
        waterSource,
        sewerType,
        // HVAC
        features,
        // Parking
        garageSpaces,
        garageType,
        parkingType,
        // Location
        subdivision,
        zoning
    } = propertyData;

    const currentYear = new Date().getFullYear();
    const homeAge = yearBuilt ? currentYear - yearBuilt : null;
    const roofAge = homeAge; // Roof is typically same age as home unless replaced

    // Check for contractor alerts
    const isSeptic = sewerType?.toLowerCase().includes('septic');
    const isWell = waterSource?.toLowerCase().includes('well');
    const isOldRoof = roofAge && roofAge > 20;
    const hasBasement = foundationType?.toLowerCase().includes('basement');
    const hasCrawlspace = foundationType?.toLowerCase().includes('crawl');

    // Collect building materials
    const materials = [
        exteriorType && { icon: Building2, label: 'Exterior', value: exteriorType },
        roofType && {
            icon: Triangle,
            label: 'Roof',
            value: roofType,
            alert: isOldRoof ? `${roofAge} yrs old` : null
        },
        foundationType && {
            icon: Square,
            label: 'Foundation',
            value: foundationType,
            highlight: hasBasement || hasCrawlspace
        },
        constructionType && { icon: Wrench, label: 'Construction', value: constructionType }
    ].filter(Boolean);

    // Collect utilities (critical for contractors!)
    const utilities = [];
    if (waterSource) {
        utilities.push({
            icon: Droplets,
            label: 'Water',
            value: waterSource,
            alert: isWell
        });
    }
    if (sewerType) {
        utilities.push({
            icon: Building2,
            label: 'Sewer',
            value: sewerType,
            alert: isSeptic
        });
    }

    // HVAC
    const hvac = [];
    if (features?.coolingType) {
        hvac.push({ icon: Wind, label: features.coolingType });
    } else if (features?.cooling) {
        hvac.push({ icon: Wind, label: 'A/C' });
    }
    if (features?.heatingType) {
        hvac.push({ icon: Flame, label: features.heatingType });
    } else if (features?.heating) {
        hvac.push({ icon: Flame, label: 'Heating' });
    }

    // Access info
    const access = [];
    if (stories) access.push({ icon: Layers, label: `${stories} ${stories === 1 ? 'Story' : 'Stories'}` });
    if (garageSpaces) {
        access.push({ icon: Car, label: `${garageSpaces}-Car ${garageType || 'Garage'}` });
    } else if (parkingType) {
        access.push({ icon: Car, label: parkingType });
    }
    if (subdivision) access.push({ icon: MapPin, label: subdivision });

    // Quality info
    const qualityInfo = [];
    if (quality) qualityInfo.push({ label: 'Quality', value: quality });
    if (condition) qualityInfo.push({ label: 'Condition', value: condition });

    // Check if we have anything to display
    const hasContent = materials.length > 0 || utilities.length > 0 || hvac.length > 0 ||
        access.length > 0 || squareFootage || yearBuilt;

    if (!hasContent) return null;

    return (
        <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Wrench size={16} className="text-emerald-600" />
                    Property Intel
                </h4>
                <p className="text-xs text-slate-500">Key details for your estimate</p>
            </div>

            <div className="p-4 space-y-4">
                {/* Alerts (if any) */}
                {(isSeptic || isWell || isOldRoof) && (
                    <div className="flex flex-wrap gap-2">
                        {isSeptic && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
                                <AlertTriangle size={16} />
                                Septic System
                            </div>
                        )}
                        {isWell && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium">
                                <AlertTriangle size={16} />
                                Well Water
                            </div>
                        )}
                        {isOldRoof && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm font-medium">
                                <AlertTriangle size={16} />
                                Roof: {roofAge}+ years old
                            </div>
                        )}
                    </div>
                )}

                {/* Building Materials */}
                {materials.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Building Materials
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {materials.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-2 p-2 rounded-lg ${item.highlight ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'
                                        }`}
                                >
                                    <item.icon size={14} className={item.highlight ? 'text-blue-500' : 'text-slate-400'} />
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500">{item.label}</p>
                                        <p className="text-sm font-medium text-slate-800 truncate">{item.value}</p>
                                        {item.alert && (
                                            <p className="text-xs text-orange-600">{item.alert}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Utilities */}
                {utilities.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Utilities
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {utilities.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-2 p-2 rounded-lg ${item.alert ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                                        }`}
                                >
                                    <item.icon size={14} className={item.alert ? 'text-amber-500' : 'text-slate-400'} />
                                    <div>
                                        <p className="text-xs text-slate-500">{item.label}</p>
                                        <p className={`text-sm font-medium ${item.alert ? 'text-amber-700' : 'text-slate-800'}`}>
                                            {item.value}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* HVAC */}
                {hvac.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            HVAC
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {hvac.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                                    <item.icon size={14} className="text-slate-500" />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Access & Parking */}
                {access.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Access
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {access.map((item, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                                    <item.icon size={14} className="text-slate-500" />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quality & Condition */}
                {qualityInfo.length > 0 && (
                    <div className="flex gap-4">
                        {qualityInfo.map((item, idx) => (
                            <div key={idx}>
                                <p className="text-xs text-slate-500">{item.label}</p>
                                <p className="text-sm font-medium text-slate-800">{item.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Stats Footer */}
                {(squareFootage || yearBuilt || bedrooms) && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-4 text-sm text-slate-600">
                        {squareFootage && (
                            <span className="flex items-center gap-1">
                                <Ruler size={14} className="text-slate-400" />
                                {formatNumber(squareFootage)} sqft
                            </span>
                        )}
                        {yearBuilt && (
                            <span className="flex items-center gap-1">
                                <Calendar size={14} className="text-slate-400" />
                                Built {yearBuilt}
                                {homeAge && <span className="text-slate-400">({homeAge} yrs)</span>}
                            </span>
                        )}
                        {(bedrooms || bathrooms) && (
                            <span className="flex items-center gap-1">
                                <Home size={14} className="text-slate-400" />
                                {bedrooms && `${bedrooms}bd`}
                                {bedrooms && bathrooms && '/'}
                                {bathrooms && `${bathrooms}ba`}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Data Source */}
            <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100">
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <Info size={12} />
                    Public records via RentCast
                </p>
            </div>
        </div>
    );
};

export default ContractorPropertyIntel;
