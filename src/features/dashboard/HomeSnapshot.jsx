// src/features/dashboard/HomeSnapshot.jsx
import React, { useMemo } from 'react';
import {
    Sun,
    Shield,
    AlertTriangle,
    CheckCircle2,
    Flame,
    Users,
    DollarSign,
    Home,
    Thermometer,
    MapPin
} from 'lucide-react';
import { useNeighborhoodData } from '../../hooks/useNeighborhoodData';
import { useProperty } from '../../contexts/PropertyContext';

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

// Helper to format currency compactly
const formatCompactCurrency = (value) => {
    if (!value) return '--';
    if (value >= 1000000) {
        return '$' + (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
        return '$' + (value / 1000).toFixed(0) + 'K';
    }
    return '$' + value.toLocaleString();
};

export const HomeSnapshot = ({ propertyProfile }) => {
    const { coordinates, address } = propertyProfile || {};

    // Get RentCast coordinates as fallback from PropertyContext
    const { propertyData } = useProperty();

    // Build effective coordinates: prefer propertyProfile.coordinates, fallback to RentCast
    const effectiveCoordinates = useMemo(() => {
        // First try propertyProfile coordinates
        if (coordinates?.lat && coordinates?.lon) {
            return coordinates;
        }
        // Fallback to RentCast coordinates from PropertyContext
        if (propertyData?.latitude && propertyData?.longitude) {
            return {
                lat: propertyData.latitude,
                lon: propertyData.longitude
            };
        }
        return null;
    }, [coordinates, propertyData?.latitude, propertyData?.longitude]);

    const { wildfire, census, climate, amenities, loading: neighborhoodLoading } = useNeighborhoodData(effectiveCoordinates, address);

    const loading = neighborhoodLoading;

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-emerald-600" />
                    Property & Neighborhood Insights
                </h2>
            </div>

            <div className="p-6 space-y-6">

                {/* Row 1: Wildfire Risk + Census Quick Stats */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Risk & Demographics
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                        {/* Wildfire Risk */}
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

                        {/* Census Quick Stats */}
                        <div className="p-4 rounded-xl border bg-violet-50 border-violet-100">
                            <div className="flex items-start justify-between mb-2">
                                <Users className="h-5 w-5 text-violet-600" />
                                {census?.countyName && (
                                    <span className="text-[10px] font-bold text-violet-600 bg-white px-2 py-0.5 rounded-full">
                                        {census.countyName}
                                    </span>
                                )}
                            </div>
                            <p className="font-bold text-slate-800 text-sm">Neighborhood</p>
                            {loading ? (
                                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mt-1" />
                            ) : census ? (
                                <p className="text-xs text-slate-500 mt-1">
                                    {formatCompactCurrency(census.medianIncome)} income • {formatCompactCurrency(census.medianHomeValue)} home value
                                </p>
                            ) : (
                                <p className="text-xs text-slate-400 mt-1">Data unavailable</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Row 2: Climate + Amenities Summary */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                        <Thermometer size={12} className="mr-1.5" />
                        Local Insights
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                        {/* Climate Summary */}
                        <div className="p-4 rounded-xl border bg-sky-50 border-sky-100">
                            {loading ? (
                                <div className="space-y-2">
                                    <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                                </div>
                            ) : climate ? (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm mb-1">Climate</p>
                                        <div className="flex items-center gap-3">
                                            <div className="text-center">
                                                <p className="text-lg font-extrabold text-orange-500">{climate.avgHighF}°</p>
                                                <p className="text-[10px] text-slate-400">Avg High</p>
                                            </div>
                                            <div className="text-slate-300">|</div>
                                            <div className="text-center">
                                                <p className="text-lg font-extrabold text-blue-500">{climate.avgLowF}°</p>
                                                <p className="text-[10px] text-slate-400">Avg Low</p>
                                            </div>
                                            <div className="text-slate-300">|</div>
                                            <div className="text-center">
                                                <p className="text-lg font-extrabold text-sky-600">{climate.annualRainfallIn}"</p>
                                                <p className="text-[10px] text-slate-400">Rain/yr</p>
                                            </div>
                                        </div>
                                    </div>
                                    <Sun className="h-8 w-8 text-amber-300" />
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">Climate data unavailable</p>
                            )}
                        </div>

                        {/* Amenities Summary */}
                        <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-100">
                            {loading ? (
                                <div className="space-y-2">
                                    <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                                </div>
                            ) : amenities ? (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm mb-1">Nearby (~1 mi)</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs bg-white px-2 py-1 rounded-full text-slate-600">
                                                🌳 {amenities.parks} parks
                                            </span>
                                            <span className="text-xs bg-white px-2 py-1 rounded-full text-slate-600">
                                                🏫 {amenities.schools} schools
                                            </span>
                                            <span className="text-xs bg-white px-2 py-1 rounded-full text-slate-600">
                                                🛒 {amenities.groceryStores} stores
                                            </span>
                                        </div>
                                    </div>
                                    <MapPin className="h-6 w-6 text-emerald-400" />
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400">Amenities data unavailable</p>
                            )}
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};
