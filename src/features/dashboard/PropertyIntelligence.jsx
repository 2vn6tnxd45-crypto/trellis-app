// src/features/dashboard/PropertyIntelligence.jsx
// ============================================
// 🏠 PROPERTY INTELLIGENCE
// ============================================
// Shows property data from public records (Rentcast API).
// UPDATED: All fields hide if missing - no placeholders, no mock data display.
// Only shows real data from Rentcast; if source is 'mock-data', shows nothing.

import React from 'react';
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
    Layers,
    Triangle,
    Square,
    Wrench,
    Zap,
    MapPin
} from 'lucide-react';
import usePropertyData from '../../hooks/usePropertyData';

// ============================================
// HELPERS
// ============================================
const formatCurrency = (value) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

const formatNumber = (value) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('en-US').format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return null;
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
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-100">
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse mb-2" />
                    <div className="h-6 w-12 bg-slate-200 rounded animate-pulse" />
                </div>
            ))}
        </div>
    </div>
);

// ============================================
// PROPERTY VALUE CARD (HERO)
// ============================================
const PropertyValueCard = ({ propertyData }) => {
    const {
        estimatedValue,
        estimatedValueLow,
        estimatedValueHigh,
        taxAssessment,
        assessmentYear,
        lastSalePrice,
        lastSaleDate,
        annualPropertyTax,
        rentEstimate
    } = propertyData || {};

    // Calculate time since purchase
    const purchaseYear = lastSaleDate ? new Date(lastSaleDate).getFullYear() : null;
    const yearsOwned = purchaseYear ? new Date().getFullYear() - purchaseYear : null;

    // Need at least one value to display
    const hasValue = estimatedValue || taxAssessment || lastSalePrice;
    if (!hasValue) return null;

    return (
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 rounded-2xl text-white relative overflow-hidden">
            <div className="absolute -top-4 -right-4 opacity-10">
                <Home size={120} />
            </div>

            <div className="relative z-10">
                {/* Main Values */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Estimated Value (preferred) or Tax Assessment */}
                    {estimatedValue ? (
                        <div>
                            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                                <DollarSign size={14} />
                                Estimated Value
                            </p>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                                {formatCurrency(estimatedValue)}
                            </h2>
                            {(estimatedValueLow && estimatedValueHigh) && (
                                <p className="text-emerald-200 text-sm mt-1">
                                    Range: {formatCurrency(estimatedValueLow)} – {formatCurrency(estimatedValueHigh)}
                                </p>
                            )}
                        </div>
                    ) : taxAssessment ? (
                        <div>
                            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                                <FileText size={14} />
                                Tax Assessment {assessmentYear && `(${assessmentYear})`}
                            </p>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                                {formatCurrency(taxAssessment)}
                            </h2>
                            {annualPropertyTax && (
                                <p className="text-emerald-200 text-sm mt-1">
                                    {formatCurrency(annualPropertyTax)}/year taxes
                                </p>
                            )}
                        </div>
                    ) : null}

                    {/* Last Sale or Rent Estimate */}
                    {lastSalePrice ? (
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
                                    {yearsOwned > 0 && ` (${yearsOwned} year${yearsOwned !== 1 ? 's' : ''} ago)`}
                                </p>
                            )}
                        </div>
                    ) : rentEstimate ? (
                        <div>
                            <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                                <Home size={14} />
                                Rent Estimate
                            </p>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                                {formatCurrency(rentEstimate)}/mo
                            </h2>
                        </div>
                    ) : null}
                </div>

                {/* Info note */}
                <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                    <p className="text-sm text-emerald-100">
                        <Info size={14} className="inline mr-1.5 opacity-70" />
                        Values from public records. Consult a professional for current market estimates.
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// QUICK STATS BAR
// ============================================
const QuickStats = ({ propertyData, pricePerSqft, homeAge }) => {
    const { bedrooms, bathrooms, squareFootage, yearBuilt } = propertyData || {};

    // Count how many stats we actually have
    const stats = [
        bedrooms && { icon: BedDouble, label: 'Bed', value: bedrooms, color: 'text-indigo-400' },
        bathrooms && { icon: Bath, label: 'Bath', value: bathrooms, color: 'text-sky-400' },
        squareFootage && {
            icon: Ruler,
            label: 'Sqft',
            value: formatNumber(squareFootage),
            subvalue: pricePerSqft ? `${formatCurrency(pricePerSqft)}/sqft` : null,
            color: 'text-amber-400'
        },
        yearBuilt && {
            icon: CalendarClock,
            label: 'Built',
            value: yearBuilt,
            subvalue: homeAge ? `${homeAge} yrs old` : null,
            color: 'text-emerald-400'
        }
    ].filter(Boolean);

    if (stats.length === 0) return null;

    return (
        <div className={`grid grid-cols-${Math.min(stats.length, 4)} gap-3`}>
            {stats.map((stat, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                        <stat.icon size={14} className={stat.color} />
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {stat.label}
                        </span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                    {stat.subvalue && <p className="text-xs text-slate-500 mt-0.5">{stat.subvalue}</p>}
                </div>
            ))}
        </div>
    );
};

// ============================================
// BUILDING DETAILS (NEW)
// ============================================
const BuildingDetails = ({ propertyData }) => {
    const {
        stories,
        architectureType,
        foundationType,
        roofType,
        exteriorType,
        constructionType,
        lotSize,
        quality,
        condition
    } = propertyData || {};

    const details = [
        stories && { icon: Layers, label: 'Stories', value: stories },
        architectureType && { icon: Home, label: 'Style', value: architectureType },
        foundationType && { icon: Square, label: 'Foundation', value: foundationType },
        roofType && { icon: Triangle, label: 'Roof', value: roofType },
        exteriorType && { icon: Building2, label: 'Exterior', value: exteriorType },
        constructionType && { icon: Wrench, label: 'Construction', value: constructionType },
        lotSize && { icon: LandPlot, label: 'Lot', value: `${(lotSize / 43560).toFixed(2)} acres` },
        quality && { icon: Zap, label: 'Quality', value: quality },
        condition && { icon: FileText, label: 'Condition', value: condition }
    ].filter(Boolean);

    if (details.length === 0) return null;

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-slate-400" />
                Building Details
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {details.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                        <detail.icon size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="text-slate-500">{detail.label}:</span>
                        <span className="font-medium text-slate-700">{detail.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// UTILITIES & SYSTEMS (NEW - Critical for contractors!)
// ============================================
const UtilitiesAndSystems = ({ propertyData }) => {
    const {
        waterSource,
        sewerType,
        features,
        parkingType,
        garageType,
        garageSpaces
    } = propertyData || {};

    const items = [];

    // Utilities (highlighted if non-standard)
    if (waterSource) {
        const isWell = waterSource.toLowerCase().includes('well');
        items.push({
            icon: Droplets,
            label: `Water: ${waterSource}`,
            highlight: isWell,
            highlightColor: 'amber'
        });
    }

    if (sewerType) {
        const isSeptic = sewerType.toLowerCase().includes('septic');
        items.push({
            icon: Building2,
            label: `Sewer: ${sewerType}`,
            highlight: isSeptic,
            highlightColor: 'amber'
        });
    }

    // HVAC
    if (features?.coolingType) {
        items.push({ icon: Wind, label: features.coolingType });
    } else if (features?.cooling) {
        items.push({ icon: Wind, label: 'A/C' });
    }

    if (features?.heatingType) {
        items.push({ icon: Flame, label: features.heatingType });
    } else if (features?.heating) {
        items.push({ icon: Flame, label: 'Heating' });
    }

    // Parking
    if (garageSpaces && garageType) {
        items.push({ icon: Car, label: `${garageSpaces}-Car ${garageType} Garage` });
    } else if (garageSpaces) {
        items.push({ icon: Car, label: `${garageSpaces}-Car Garage` });
    } else if (parkingType) {
        items.push({ icon: Car, label: parkingType });
    }

    // Other features
    if (features?.pool) {
        items.push({ icon: Droplets, label: features.poolType || 'Pool' });
    }
    if (features?.fireplace) {
        const count = features.fireplaceCount;
        items.push({ icon: Flame, label: count ? `${count} Fireplace${count > 1 ? 's' : ''}` : 'Fireplace' });
    }
    if (features?.spa) {
        items.push({ icon: Droplets, label: 'Spa/Hot Tub' });
    }

    if (items.length === 0) return null;

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Wrench size={16} className="text-slate-400" />
                Systems & Utilities
            </h4>
            <div className="flex flex-wrap gap-2">
                {items.map((item, idx) => (
                    <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${item.highlight
                                ? `bg-${item.highlightColor}-50 border border-${item.highlightColor}-200 text-${item.highlightColor}-700 font-medium`
                                : 'bg-slate-100 text-slate-700'
                            }`}
                    >
                        <item.icon size={14} className={item.highlight ? `text-${item.highlightColor}-500` : 'text-slate-500'} />
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

// ============================================
// HOA & ZONING
// ============================================
const HoaAndZoning = ({ propertyData }) => {
    const { hoaFee, hoaFrequency, zoning, subdivision } = propertyData || {};

    const items = [];

    if (hoaFee) {
        const freq = hoaFrequency?.toLowerCase() === 'annually' ? '/year' : '/mo';
        items.push({ icon: DollarSign, label: `HOA: ${formatCurrency(hoaFee)}${freq}`, color: 'amber' });
    }
    if (zoning) {
        items.push({ icon: MapPin, label: `Zoning: ${zoning}`, color: 'slate' });
    }
    if (subdivision) {
        items.push({ icon: LandPlot, label: subdivision, color: 'slate' });
    }

    if (items.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item, idx) => (
                <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-${item.color}-50 border border-${item.color}-200 text-${item.color}-700`}
                >
                    <item.icon size={14} />
                    {item.label}
                </span>
            ))}
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
                    {floodData.riskDescription && (
                        <p className="text-sm text-slate-600 mt-1">{floodData.riskDescription}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {floodData.zone && <span>Zone: <strong>{floodData.zone}</strong></span>}
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
// DATA SOURCE BANNER
// ============================================
const DataSourceBanner = ({ source }) => {
    if (source !== 'rentcast') return null;

    return (
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg">
            <Database size={12} />
            <span>Data from public records via RentCast</span>
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

    // No data or mock data - don't show anything
    if (!propertyData || propertyData.source === 'mock-data') {
        return null;
    }

    // Full content - only show sections that have data
    return (
        <div className="space-y-4">
            {/* Property Value Card */}
            <PropertyValueCard propertyData={propertyData} />

            {/* Quick Stats */}
            <QuickStats
                propertyData={propertyData}
                pricePerSqft={pricePerSqft}
                homeAge={homeAge}
            />

            {/* Building Details */}
            <BuildingDetails propertyData={propertyData} />

            {/* Systems & Utilities */}
            <UtilitiesAndSystems propertyData={propertyData} />

            {/* HOA & Zoning */}
            <HoaAndZoning propertyData={propertyData} />

            {/* Flood Risk */}
            <FloodRiskCard floodData={floodData} />

            {/* Data Source */}
            <DataSourceBanner source={propertyData.source} />
        </div>
    );
};

export default PropertyIntelligence;
