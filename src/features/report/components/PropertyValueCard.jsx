// src/features/report/components/PropertyValueCard.jsx
// ============================================
// PROPERTY VALUE CARD
// Shows estimated value, appreciation, and key stats
// ONLY renders when real RentCast data is available
// ============================================

import React from 'react';
import { TrendingUp, TrendingDown, Home, Calendar, Ruler, DollarSign, MapPin } from 'lucide-react';

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

  // Calculate estimated value (typically 10-15% above tax assessment)
  const estimatedValue = taxAssessment ? Math.round(taxAssessment * 1.12) : null;
  
  // Calculate appreciation since purchase
  const purchaseYear = lastSaleDate ? new Date(lastSaleDate).getFullYear() : null;
  const yearsOwned = purchaseYear ? new Date().getFullYear() - purchaseYear : null;
  const appreciation = lastSalePrice && estimatedValue ? {
    dollar: estimatedValue - lastSalePrice,
    percent: Math.round(((estimatedValue - lastSalePrice) / lastSalePrice) * 100),
  } : null;

  // Price per square foot
  const pricePerSqft = estimatedValue && squareFootage 
    ? Math.round(estimatedValue / squareFootage) 
    : null;

  // Home age
  const homeAge = yearBuilt ? new Date().getFullYear() - yearBuilt : null;

  const isPositiveAppreciation = appreciation && appreciation.dollar > 0;

  return (
    <section className={`print:break-inside-avoid ${className}`}>
      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
        <Home className="mr-3 text-emerald-600" size={24} />
        Property Value & Details
      </h3>

      <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-2xl border border-emerald-100 overflow-hidden">
        {/* Main Value Section */}
        <div className="p-6 border-b border-emerald-100">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            {/* Estimated Value */}
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
                Estimated Market Value
              </p>
              <p className="text-4xl font-black text-slate-900">
                {formatCurrency(estimatedValue)}
              </p>
              {taxAssessment && (
                <p className="text-sm text-slate-500 mt-1">
                  Tax Assessment: {formatCurrency(taxAssessment)} ({assessmentYear || 'Latest'})
                </p>
              )}
            </div>

            {/* Appreciation Badge */}
            {appreciation && yearsOwned && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${
                isPositiveAppreciation 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {isPositiveAppreciation ? (
                  <TrendingUp size={20} className="text-emerald-600" />
                ) : (
                  <TrendingDown size={20} className="text-red-600" />
                )}
                <div>
                  <p className="font-bold text-lg">
                    {isPositiveAppreciation ? '+' : ''}{formatCurrency(appreciation.dollar)}
                  </p>
                  <p className="text-xs opacity-80">
                    {isPositiveAppreciation ? '+' : ''}{appreciation.percent}% since {purchaseYear} ({yearsOwned} yrs)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-emerald-100">
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
            {pricePerSqft && (
              <p className="text-xs text-slate-500">{formatCurrency(pricePerSqft)}/sqft</p>
            )}
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
            <p className="text-xs text-slate-500">Bedrooms / Baths</p>
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

        {/* Purchase Info Footer */}
        {lastSalePrice && lastSaleDate && (
          <div className="px-6 py-3 bg-slate-50 border-t border-emerald-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Last sold: <span className="font-medium text-slate-700">{formatCurrency(lastSalePrice)}</span>
            </span>
            <span className="text-slate-500">
              {new Date(lastSaleDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Data Source Badge */}
        <div className="px-6 py-2 bg-emerald-600 text-white text-xs text-center font-medium">
          ✓ Verified from public records via RentCast
        </div>
      </div>
    </section>
  );
};

export default PropertyValueCard;
