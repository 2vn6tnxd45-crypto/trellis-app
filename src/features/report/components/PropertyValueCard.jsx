// src/features/report/components/PropertyValueCard.jsx
// ============================================
// PROPERTY DETAILS CARD
// Shows FACTUAL property data from public records
// NO made-up estimates - only verified data
// ONLY renders when real RentCast data is available
// ============================================

import React from 'react';
import { Home, Calendar, Ruler, DollarSign, MapPin, FileText } from 'lucide-react';

const formatCurrency = (value) => {
  if (!value) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value) => {
  if (!value) return '--';
  return new Intl.NumberFormat('en-US').format(value);
};

export const PropertyValueCard = ({ propertyData, className = '' }) => {
  // Don't render if no real data or if it's mock data
  if (!propertyData || propertyData.source === 'mock-data' || !propertyData.source) {
    return null;
  }

  const {
    taxAssessment,
    assessmentYear,
    lastSalePrice,
    lastSaleDate,
    squareFootage,
    yearBuilt,
    bedrooms,
    bathrooms,
    lotSize,
  } = propertyData;

  // Home age
  const homeAge = yearBuilt ? new Date().getFullYear() - yearBuilt : null;

  // Price per square foot based on tax assessment (factual)
  const assessedPricePerSqft = taxAssessment && squareFootage 
    ? Math.round(taxAssessment / squareFootage) 
    : null;

  // Calculate time since purchase
  const purchaseYear = lastSaleDate ? new Date(lastSaleDate).getFullYear() : null;
  const yearsOwned = purchaseYear ? new Date().getFullYear() - purchaseYear : null;

  return (
    <section className={`print:break-inside-avoid ${className}`}>
      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
        <Home className="mr-3 text-emerald-600" size={24} />
        Property Details
      </h3>

      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
        
        {/* Main Values Section - Tax Assessment & Last Sale */}
        <div className="p-6 border-b border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Tax Assessment */}
            {taxAssessment && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tax Assessment {assessmentYear ? `(${assessmentYear})` : ''}
                  </p>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  {formatCurrency(taxAssessment)}
                </p>
                {assessedPricePerSqft && (
                  <p className="text-sm text-slate-500 mt-1">
                    {formatCurrency(assessedPricePerSqft)}/sqft assessed
                  </p>
                )}
              </div>
            )}

            {/* Last Sale */}
            {lastSalePrice && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Last Sale Price
                  </p>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  {formatCurrency(lastSalePrice)}
                </p>
                {lastSaleDate && (
                  <p className="text-sm text-slate-500 mt-1">
                    {new Date(lastSaleDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    {yearsOwned && ` (${yearsOwned} years ago)`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Property Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
          {/* Year Built */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
              <Calendar size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Built</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{yearBuilt || '--'}</p>
            {homeAge && (
              <p className="text-xs text-slate-500">{homeAge} years old</p>
            )}
          </div>

          {/* Square Footage */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
              <Ruler size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Sqft</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatNumber(squareFootage)}</p>
          </div>

          {/* Bed/Bath */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
              <Home size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Bed/Bath</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {bedrooms || '--'} / {bathrooms || '--'}
            </p>
          </div>

          {/* Lot Size */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
              <MapPin size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Lot</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {lotSize ? `${(lotSize / 43560).toFixed(2)}` : '--'}
            </p>
            <p className="text-xs text-slate-500">Acres</p>
          </div>
        </div>

        {/* Data Source Badge */}
        <div className="px-6 py-2 bg-emerald-600 text-white text-xs text-center font-medium">
          ✓ Data from public records via RentCast
        </div>
      </div>
    </section>
  );
};

export default PropertyValueCard;
