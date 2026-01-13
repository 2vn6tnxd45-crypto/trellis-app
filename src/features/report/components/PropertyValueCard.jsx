// src/features/report/components/PropertyValueCard.jsx
// ============================================
// PROPERTY DETAILS CARD
// Shows FACTUAL property data from public records
// NO mock data display - only real RentCast data
// All fields hide if missing
// ============================================

import React from 'react';
import {
  Home,
  Calendar,
  Ruler,
  DollarSign,
  MapPin,
  FileText,
  Layers,
  Triangle,
  Square,
  Building2,
  Wrench,
  Flame,
  Wind,
  Car,
  Droplets,
  TrendingUp
} from 'lucide-react';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('en-US').format(value);
};

export const PropertyValueCard = ({ propertyData, className = '' }) => {
  // Don't render if no real data or if it's mock data
  if (!propertyData || propertyData.source === 'mock-data' || !propertyData.source) {
    return null;
  }

  const {
    // Values
    estimatedValue,
    estimatedValueLow,
    estimatedValueHigh,
    taxAssessment,
    assessmentYear,
    annualPropertyTax,
    taxAssessmentLand,
    taxAssessmentImprovement,
    lastSalePrice,
    lastSaleDate,
    rentEstimate,
    pricePerSquareFoot,
    // Basics
    squareFootage,
    yearBuilt,
    bedrooms,
    bathrooms,
    lotSize,
    stories,
    // Building
    architectureType,
    foundationType,
    roofType,
    exteriorType,
    // Systems
    features,
    waterSource,
    sewerType,
    garageSpaces,
    garageType,
    parkingType,
    // Other
    hoaFee,
    hoaFrequency,
    zoning
  } = propertyData;

  // Calculate derived values
  const currentYear = new Date().getFullYear();
  const homeAge = yearBuilt ? currentYear - yearBuilt : null;
  const purchaseYear = lastSaleDate ? new Date(lastSaleDate).getFullYear() : null;
  const yearsOwned = purchaseYear ? currentYear - purchaseYear : null;

  // Appreciation since purchase
  const appreciationValue = (estimatedValue && lastSalePrice) ? estimatedValue - lastSalePrice : null;
  const appreciationPercent = (appreciationValue && lastSalePrice)
    ? ((appreciationValue / lastSalePrice) * 100).toFixed(1)
    : null;

  // Computed price per sqft if not provided
  const effectivePricePerSqft = pricePerSquareFoot ||
    (estimatedValue && squareFootage ? Math.round(estimatedValue / squareFootage) : null) ||
    (taxAssessment && squareFootage ? Math.round(taxAssessment / squareFootage) : null);

  // Collect building details that exist
  const buildingDetails = [
    stories && { icon: Layers, label: 'Stories', value: stories },
    architectureType && { icon: Home, label: 'Style', value: architectureType },
    foundationType && { icon: Square, label: 'Foundation', value: foundationType },
    roofType && { icon: Triangle, label: 'Roof', value: roofType },
    exteriorType && { icon: Building2, label: 'Exterior', value: exteriorType }
  ].filter(Boolean);

  // Collect systems that exist
  const systems = [];
  if (features?.coolingType) systems.push({ icon: Wind, label: features.coolingType });
  else if (features?.cooling) systems.push({ icon: Wind, label: 'A/C' });
  if (features?.heatingType) systems.push({ icon: Flame, label: features.heatingType });
  else if (features?.heating) systems.push({ icon: Flame, label: 'Heating' });
  if (garageSpaces) systems.push({ icon: Car, label: `${garageSpaces}-Car ${garageType || 'Garage'}` });
  else if (parkingType) systems.push({ icon: Car, label: parkingType });
  if (features?.pool) systems.push({ icon: Droplets, label: features.poolType || 'Pool' });
  if (features?.fireplace) systems.push({ icon: Flame, label: 'Fireplace' });

  // Check if we have any utility alerts
  const isSeptic = sewerType?.toLowerCase().includes('septic');
  const isWell = waterSource?.toLowerCase().includes('well');

  return (
    <section className={`print:break-inside-avoid ${className}`}>
      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
        <Home className="mr-3 text-emerald-600" size={24} />
        Property Details
      </h3>

      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 overflow-hidden">

        {/* Main Values Section */}
        <div className="p-6 border-b border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Estimated Value or Tax Assessment */}
            {estimatedValue ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={14} className="text-emerald-500" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Estimated Value
                  </p>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  {formatCurrency(estimatedValue)}
                </p>
                {(estimatedValueLow && estimatedValueHigh) && (
                  <p className="text-sm text-slate-500 mt-1">
                    Range: {formatCurrency(estimatedValueLow)} – {formatCurrency(estimatedValueHigh)}
                  </p>
                )}
                {effectivePricePerSqft && (
                  <p className="text-sm text-slate-500">
                    {formatCurrency(effectivePricePerSqft)}/sqft
                  </p>
                )}
              </div>
            ) : taxAssessment ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tax Assessment {assessmentYear && `(${assessmentYear})`}
                  </p>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  {formatCurrency(taxAssessment)}
                </p>
                {effectivePricePerSqft && (
                  <p className="text-sm text-slate-500 mt-1">
                    {formatCurrency(effectivePricePerSqft)}/sqft assessed
                  </p>
                )}
              </div>
            ) : null}

            {/* Last Sale with Appreciation */}
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
                    {yearsOwned > 0 && ` (${yearsOwned} years ago)`}
                  </p>
                )}
                {(appreciationValue && appreciationValue > 0) && (
                  <p className="text-sm text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <TrendingUp size={14} />
                    +{formatCurrency(appreciationValue)} ({appreciationPercent}%) since purchase
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tax Breakdown & Rent Estimate Row */}
          {(annualPropertyTax || rentEstimate || (taxAssessmentLand && taxAssessmentImprovement)) && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-4">
              {annualPropertyTax && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Annual Taxes</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(annualPropertyTax)}/yr</p>
                </div>
              )}
              {rentEstimate && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Rent Estimate</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(rentEstimate)}/mo</p>
                </div>
              )}
              {(taxAssessmentLand && taxAssessmentImprovement) && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Assessment Breakdown</p>
                  <p className="text-sm text-slate-600">
                    Land: {formatCurrency(taxAssessmentLand)} • Improvement: {formatCurrency(taxAssessmentImprovement)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Property Stats Grid */}
        {(yearBuilt || squareFootage || bedrooms || lotSize) && (
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {yearBuilt && (
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
                  <Calendar size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">Built</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{yearBuilt}</p>
                {homeAge && <p className="text-xs text-slate-500">{homeAge} years old</p>}
              </div>
            )}

            {squareFootage && (
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
                  <Ruler size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">Sqft</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">{formatNumber(squareFootage)}</p>
              </div>
            )}

            {(bedrooms || bathrooms) && (
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
                  <Home size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">Bed/Bath</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {bedrooms || '-'} / {bathrooms || '-'}
                </p>
              </div>
            )}

            {lotSize && (
              <div className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-400 mb-1">
                  <MapPin size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">Lot</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {(lotSize / 43560).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">Acres</p>
              </div>
            )}
          </div>
        )}

        {/* Building Details */}
        {buildingDetails.length > 0 && (
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Building Details</p>
            <div className="flex flex-wrap gap-2">
              {buildingDetails.map((detail, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                  <detail.icon size={14} className="text-slate-500" />
                  {detail.label}: {detail.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Systems & Utilities */}
        {(systems.length > 0 || isSeptic || isWell || hoaFee || zoning) && (
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Systems & Utilities</p>
            <div className="flex flex-wrap gap-2">
              {/* Utility alerts first */}
              {isSeptic && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700 font-medium">
                  <Wrench size={14} />
                  Septic System
                </span>
              )}
              {isWell && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700 font-medium">
                  <Droplets size={14} />
                  Well Water
                </span>
              )}
              {systems.map((system, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                  <system.icon size={14} className="text-slate-500" />
                  {system.label}
                </span>
              ))}
              {hoaFee && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700">
                  <DollarSign size={14} />
                  HOA: {formatCurrency(hoaFee)}{hoaFrequency?.toLowerCase() === 'annually' ? '/yr' : '/mo'}
                </span>
              )}
              {zoning && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700">
                  <MapPin size={14} className="text-slate-500" />
                  Zoning: {zoning}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Data Source Badge */}
        <div className="px-6 py-2 bg-emerald-600 text-white text-xs text-center font-medium">
          ✓ Data from public records via RentCast
        </div>
      </div>
    </section>
  );
};

export default PropertyValueCard;
