// src/features/dashboard/NeighborhoodData.jsx
import React from 'react';
import {
    Users,
    Home,
    DollarSign,
    Thermometer,
    CloudRain,
    TreePine,
    ShoppingCart,
    GraduationCap,
    Heart,
    Utensils,
    AlertTriangle,
    ExternalLink,
    Loader2,
    MapPin,
    Sun,
    Snowflake
} from 'lucide-react';
import { useNeighborhoodData } from '../../hooks/useNeighborhoodData';
import { formatCurrency } from '../../lib/utils';

// Helper to format large numbers
const formatNumber = (value) => {
    if (!value) return '--';
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'K';
    }
    return value.toLocaleString();
};

export const NeighborhoodData = ({ propertyProfile }) => {
    const { coordinates, address } = propertyProfile || {};
    const { wildfire, census, climate, amenities, loading } = useNeighborhoodData(coordinates, address);

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading neighborhood intel...
            </div>
        );
    }

    const zip = address?.zip || '';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">

            {/* Row 1: Wildfire Risk + Census Demographics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Wildfire Risk Card */}
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
                                    <a
                                        href={`https://wildfirerisk.org/explore/${zip}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-3 inline-flex items-center text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                                    >
                                        View Map <ExternalLink size={12} className="ml-1" />
                                    </a>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400">Data unavailable</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Census Demographics Card */}
                <div className="p-5 rounded-2xl border bg-white border-slate-100">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
                            <Users size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800">Neighborhood Profile</h3>
                            {census ? (
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {census.countyName}, {census.stateName}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    {census ? (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="p-2.5 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <DollarSign size={12} />
                                    <span className="text-[10px] font-bold uppercase">Median Income</span>
                                </div>
                                <p className="text-sm font-extrabold text-slate-800">
                                    {formatCurrency(census.medianIncome)}
                                </p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Home size={12} />
                                    <span className="text-[10px] font-bold uppercase">Home Value</span>
                                </div>
                                <p className="text-sm font-extrabold text-slate-800">
                                    {formatCurrency(census.medianHomeValue)}
                                </p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Users size={12} />
                                    <span className="text-[10px] font-bold uppercase">Population</span>
                                </div>
                                <p className="text-sm font-extrabold text-slate-800">
                                    {formatNumber(census.population)}
                                </p>
                            </div>
                            <div className="p-2.5 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                    <Home size={12} />
                                    <span className="text-[10px] font-bold uppercase">Ownership</span>
                                </div>
                                <p className="text-sm font-extrabold text-slate-800">
                                    {census.ownershipRate}% owners
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 mt-3">Census data unavailable</p>
                    )}
                </div>
            </div>

            {/* Row 2: Climate Card */}
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-6 rounded-2xl border border-sky-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                        <Thermometer size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Climate Overview</h3>
                        <p className="text-xs text-slate-500">Based on 2023 weather data</p>
                    </div>
                </div>

                {climate ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white/70 p-3 rounded-xl text-center">
                            <Sun className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">Avg High</p>
                            <p className="text-xl font-extrabold text-slate-800">{climate.avgHighF}°F</p>
                        </div>
                        <div className="bg-white/70 p-3 rounded-xl text-center">
                            <Snowflake className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">Avg Low</p>
                            <p className="text-xl font-extrabold text-slate-800">{climate.avgLowF}°F</p>
                        </div>
                        <div className="bg-white/70 p-3 rounded-xl text-center">
                            <CloudRain className="h-5 w-5 text-sky-500 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">Annual Rain</p>
                            <p className="text-xl font-extrabold text-slate-800">{climate.annualRainfallIn}"</p>
                        </div>
                        <div className="bg-white/70 p-3 rounded-xl text-center">
                            <Thermometer className="h-5 w-5 text-red-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">Hottest</p>
                            <p className="text-xl font-extrabold text-slate-800">{climate.hottestMonth}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400">Climate data unavailable</p>
                )}
            </div>

            {/* Row 3: Nearby Amenities */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                        <MapPin size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Nearby Amenities</h3>
                        <p className="text-xs text-slate-500">Within ~1 mile radius</p>
                    </div>
                </div>

                {amenities ? (
                    <>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
                            <div className="text-center p-3 bg-emerald-50 rounded-xl">
                                <TreePine className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                                <p className="text-lg font-extrabold text-slate-800">{amenities.parks}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Parks</p>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-xl">
                                <GraduationCap className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                                <p className="text-lg font-extrabold text-slate-800">{amenities.schools}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Schools</p>
                            </div>
                            <div className="text-center p-3 bg-amber-50 rounded-xl">
                                <ShoppingCart className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                                <p className="text-lg font-extrabold text-slate-800">{amenities.groceryStores}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Grocery</p>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded-xl">
                                <Utensils className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                                <p className="text-lg font-extrabold text-slate-800">{amenities.restaurants}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Dining</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded-xl">
                                <Heart className="h-5 w-5 text-red-500 mx-auto mb-1" />
                                <p className="text-lg font-extrabold text-slate-800">{amenities.healthcare}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Health</p>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 space-y-3">
                            {amenities.nearbyParks && amenities.nearbyParks.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1"><TreePine size={10} /> Nearby Parks:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {amenities.nearbyParks.map((name, i) => (
                                            <span key={i} className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {amenities.nearbySchools && amenities.nearbySchools.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1"><GraduationCap size={10} /> Nearby Schools:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {amenities.nearbySchools.map((name, i) => (
                                            <span key={i} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {amenities.nearbyGrocery && amenities.nearbyGrocery.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1"><ShoppingCart size={10} /> Grocery:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {amenities.nearbyGrocery.map((name, i) => (
                                            <span key={i} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-md">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {amenities.nearbyDining && amenities.nearbyDining.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1"><Utensils size={10} /> Local Dining:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {amenities.nearbyDining.map((name, i) => (
                                            <span key={i} className="text-[10px] font-bold bg-orange-50 text-orange-700 px-2 py-1 rounded-md">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-slate-400">Amenities data unavailable</p>
                )}
            </div>
        </div>
    );
};
