// src/features/contractor-pro/components/ContractorPropertyIntel.jsx
// ============================================
// 🔧 CONTRACTOR PROPERTY INTEL (Simplified)
// ============================================
// Shows minimal property data for contractor needs
// Only: square footage and beds/baths

import React from 'react';
import {
    Home,
    Ruler,
    Wrench,
    MapPin,
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
        squareFootage,
        bedrooms,
        bathrooms,
        subdivision
    } = propertyData;

    // Check if we have anything to display
    const hasContent = squareFootage || bedrooms || bathrooms;

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

            <div className="p-4">
                {/* Access / Location */}
                {subdivision && (
                    <div className="mb-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Access
                        </p>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                            <MapPin size={14} className="text-slate-500" />
                            {subdivision}
                        </span>
                    </div>
                )}

                {/* Quick Stats */}
                <div className="flex items-center gap-4 text-sm text-slate-600">
                    {squareFootage && (
                        <span className="flex items-center gap-1">
                            <Ruler size={14} className="text-slate-400" />
                            {formatNumber(squareFootage)} sqft
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
