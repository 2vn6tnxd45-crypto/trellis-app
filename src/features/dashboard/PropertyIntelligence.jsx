// src/features/dashboard/PropertyIntelligence.jsx
import React, { useState } from 'react';
import { 
    Home, 
    TrendingUp, 
    TrendingDown,
    DollarSign, 
    Calendar, 
    Ruler, 
    BedDouble, 
    Bath,
    Droplets,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Loader2,
    Info,
    Wrench,
    Clock,
    Shield,
    Sparkles,
    Building2,
    LandPlot,
    CalendarClock,
    Flame,
    Wind,
    Car
} from 'lucide-react';
import { usePropertyData } from '../../hooks/usePropertyData';

// ============================================
// HELPERS
// ============================================
const formatCurrency = (value) => {
    if (!value) return '--';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);
};

const formatNumber = (value) => {
    if (!value) return '--';
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
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ icon: Icon, label, value, subvalue, iconColor = 'text-slate-400' }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors">
        <div className="flex items-center gap-2 mb-2">
            <Icon size={14} className={iconColor} />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {subvalue && <p className="text-xs text-slate-500 mt-0.5">{subvalue}</p>}
    </div>
);

// ============================================
// VALUE CARD (HERO)
// ============================================
const ValueCard = ({ estimatedValue, appreciation, lastSalePrice, lastSaleDate, loading }) => {
    const isPositive = appreciation?.percentChange > 0;
    
    if (loading) {
        return (
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 rounded-2xl text-white">
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 rounded-2xl text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute -top-4 -right-4 opacity-10">
                <Home size={120} />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-emerald-100 text-sm font-medium mb-1 flex items-center gap-1.5">
                            <Sparkles size={14} />
                            Estimated Home Value
                        </p>
                        <h2 className="text-4xl font-black tracking-tight">
                            {formatCurrency(estimatedValue)}
                        </h2>
                    </div>
                    
                    {appreciation && (
                        <div className={`px-3 py-1.5 rounded-lg ${isPositive ? 'bg-white/20' : 'bg-red-500/30'}`}>
                            <div className="flex items-center gap-1">
                                {isPositive ? (
                                    <TrendingUp size={16} className="text-emerald-200" />
                                ) : (
                                    <TrendingDown size={16} className="text-red-200" />
                                )}
                                <span className="font-bold text-lg">
                                    {isPositive ? '+' : ''}{appreciation.percentChange}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                
                {lastSalePrice && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
                        <div>
                            <p className="text-emerald-200 text-xs font-medium mb-0.5">Purchase Price</p>
                            <p className="font-bold text-lg">{formatCurrency(lastSalePrice)}</p>
                        </div>
                        <div>
                            <p className="text-emerald-200 text-xs font-medium mb-0.5">Purchase Date</p>
                            <p className="font-bold text-lg">{formatDate(lastSaleDate)}</p>
                        </div>
                    </div>
                )}
                
                {appreciation && appreciation.dollarChange !== 0 && (
                    <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                        <p className="text-sm">
                            {isPositive ? '📈' : '📉'} Your home has {isPositive ? 'gained' : 'lost'}{' '}
                            <span className="font-bold">{formatCurrency(Math.abs(appreciation.dollarChange))}</span>
                            {appreciation.yearsPurchased && (
                                <span className="text-emerald-200"> over {appreciation.yearsPurchased} years</span>
                            )}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// FLOOD RISK CARD
// ============================================
const FloodRiskCard = ({ floodData, loading }) => {
    if (loading || !floodData) {
        return null;
    }
    
    const riskConfig = {
        'Minimal': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
        'Moderate': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
        'High': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: AlertTriangle },
        'Very High': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertTriangle },
        'Undetermined': { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: Info }
    };
    
    const config = riskConfig[floodData.riskLevel] || riskConfig['Undetermined'];
    const Icon = config.icon;
    
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
// PROPERTY FEATURES CARD
// ============================================
const PropertyFeaturesCard = ({ features, hoaFee }) => {
    if (!features) return null;
    
    const featureItems = [];
    
    if (features.cooling) featureItems.push({ icon: Wind, label: features.coolingType || 'AC' });
    if (features.heating) featureItems.push({ icon: Flame, label: features.heatingType || 'Heat' });
    if (features.garage) featureItems.push({ icon: Car, label: `${features.garageSpaces || 1} Car Garage` });
    if (features.pool) featureItems.push({ icon: Droplets, label: 'Pool' });
    if (features.fireplace) featureItems.push({ icon: Flame, label: 'Fireplace' });
    
    if (featureItems.length === 0 && !hoaFee) return null;
    
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-slate-400" />
                Property Features
            </h4>
            <div className="flex flex-wrap gap-2">
                {featureItems.map((item, idx) => (
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
// MAINTENANCE PREDICTIONS CARD
// ============================================
const MaintenancePredictions = ({ predictions, homeAge }) => {
    const [expanded, setExpanded] = useState(false);
    
    if (!predictions || predictions.length === 0) {
        return null;
    }
    
    // Group by priority
    const critical = predictions.filter(p => p.priority === 'critical');
    const warning = predictions.filter(p => p.priority === 'warning');
    const visibleItems = expanded ? predictions : predictions.slice(0, 4);
    
    const priorityConfig = {
        critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
        warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' },
        monitor: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100' },
        good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100' }
    };
    
    return (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wrench size={18} className="text-slate-600" />
                    <h4 className="font-bold text-slate-800">Maintenance Predictions</h4>
                </div>
                {homeAge && (
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                        Home Age: {homeAge} years
                    </span>
                )}
            </div>
            
            {/* Summary badges */}
            {(critical.length > 0 || warning.length > 0) && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex gap-2">
                    {critical.length > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                            {critical.length} need attention soon
                        </span>
                    )}
                    {warning.length > 0 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                            {warning.length} upcoming
                        </span>
                    )}
                </div>
            )}
            
            <div className="divide-y divide-slate-100">
                {visibleItems.map((item, idx) => {
                    const config = priorityConfig[item.priority];
                    return (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${config.badge}`}>
                                    <Clock size={16} className={config.text} />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800">{item.name}</p>
                                    <p className="text-xs text-slate-500">{item.category}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${config.text}`}>
                                    {item.remainingYears <= 0 ? 'Due now' : `~${item.remainingYears} years`}
                                </p>
                                <p className="text-xs text-slate-400">Est. {item.replacementYear}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {predictions.length > 4 && (
                <button 
                    onClick={() => setExpanded(!expanded)}
                    className="w-full p-3 bg-slate-50 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                >
                    {expanded ? (
                        <>Show Less <ChevronUp size={16} /></>
                    ) : (
                        <>Show All {predictions.length} Items <ChevronDown size={16} /></>
                    )}
                </button>
            )}
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
        error,
        lastUpdated,
        refresh,
        estimatedValue,
        pricePerSqft,
        appreciation,
        homeAge,
        maintenancePredictions
    } = usePropertyData(address, coordinates);

    // Don't render if no address
    if (!address) {
        return null;
    }

    return (
        <div className="space-y-4">
            {/* Header with refresh */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-100">
                        <Home size={18} className="text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Property Intelligence</h3>
                        <p className="text-xs text-slate-500">Auto-discovered from public records</p>
                    </div>
                </div>
                <button 
                    onClick={refresh}
                    disabled={loading}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                    title="Refresh data"
                >
                    <RefreshCw size={16} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            
            {/* Error state */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    Unable to fetch property data. Please try again later.
                </div>
            )}
            
            {/* Value Card (Hero) */}
            <ValueCard 
                estimatedValue={estimatedValue}
                appreciation={appreciation}
                lastSalePrice={propertyData?.lastSalePrice}
                lastSaleDate={propertyData?.lastSaleDate}
                loading={loading}
            />
            
            {/* Quick Stats Grid */}
            {propertyData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard 
                        icon={BedDouble} 
                        label="Bedrooms" 
                        value={propertyData.bedrooms || '--'} 
                        iconColor="text-indigo-400"
                    />
                    <StatCard 
                        icon={Bath} 
                        label="Bathrooms" 
                        value={propertyData.bathrooms || '--'} 
                        iconColor="text-sky-400"
                    />
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
            )}
            
            {/* Property Details Row */}
            {propertyData && (
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
            )}
            
            {/* Property Features */}
            <PropertyFeaturesCard 
                features={propertyData?.features} 
                hoaFee={propertyData?.hoaFee} 
            />
            
            {/* Flood Risk */}
            <FloodRiskCard floodData={floodData} loading={loading} />
            
            {/* Maintenance Predictions */}
            <MaintenancePredictions 
                predictions={maintenancePredictions} 
                homeAge={homeAge} 
            />
            
            {/* Data source footer */}
            {lastUpdated && (
                <p className="text-xs text-center text-slate-400">
                    Data from public records • Updated {formatDate(lastUpdated)}
                </p>
            )}
        </div>
    );
};

export default PropertyIntelligence;
