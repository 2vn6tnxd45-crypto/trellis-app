// src/contexts/PropertyContext.jsx
// ============================================
// PROPERTY DATA CONTEXT
// ============================================
// Provides property data from RentCast API to all components
// Enables dynamic room options, maintenance predictions, etc.

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { generateRoomOptions, getDefaultRoomOptions } from '../utils/roomUtils';

// Create context
const PropertyContext = createContext(null);

// Cache settings
const CACHE_KEY = 'krib_property_data';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * PropertyProvider - Wraps app to provide property data everywhere
 */
export function PropertyProvider({ children, propertyProfile }) {
    const [propertyData, setPropertyData] = useState(null);
    const [floodData, setFloodData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Extract address from property profile - handle multiple formats and locations
    const addressString = useMemo(() => {

        // Try multiple possible address locations
        const address = propertyProfile?.address
            || propertyProfile?.serviceAddress
            || propertyProfile?.propertyAddress;

        if (!address || (typeof address === 'object' && Object.keys(address).length === 0)) {
            // Maybe the address is stored as a top-level string field
            if (propertyProfile?.street) return propertyProfile.street;
            if (propertyProfile?.formattedAddress) return propertyProfile.formattedAddress;
            if (propertyProfile?.fullAddress) return propertyProfile.fullAddress;
            return null;
        }

        // If it's already a string, use it directly
        if (typeof address === 'string') return address;

        // Try common address object formats
        // 1. Formatted/full address (from Google Places or pre-formatted)
        if (address.formatted) return address.formatted;
        if (address.full) return address.full;
        if (address.formattedAddress) return address.formattedAddress;

        // 2. Standard fields (street, city, state, zip)
        const street = address.street || address.line1 || address.addressLine1 || '';
        const city = address.city || '';
        const state = address.state || '';
        const zip = address.zip || address.zipCode || address.postalCode || '';

        // If street contains commas, it might be a full formatted address already
        if (street && street.includes(',')) {
            return street;
        }

        const parts = [street, city, state, zip].filter(Boolean);
        return parts.length >= 3 ? parts.join(', ') : null;
    }, [propertyProfile]);

    const coordinates = propertyProfile?.coordinates || propertyProfile?.serviceAddress?.coordinates;

    // Fetch property data
    useEffect(() => {
        console.log('[PropertyContext] Effect triggered, addressString:', addressString);

        if (!addressString) {
            console.log('[PropertyContext] No addressString, skipping fetch');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);

            // Check cache first
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const cacheData = JSON.parse(cached);
                    const entry = cacheData[addressString];
                    if (entry && (Date.now() - entry.timestamp) < CACHE_DURATION) {
                        console.log('[PropertyContext] Using cached data for:', addressString, 'source:', entry.property?.source);
                        if (!cancelled) {
                            setPropertyData(entry.property);
                            setFloodData(entry.flood);
                            setLoading(false);
                        }
                        return;
                    }
                }
            } catch (e) {
                console.warn('Cache read failed:', e);
            }

            // Fetch from API
            try {
                const params = new URLSearchParams({ address: addressString });
                if (coordinates?.lat && coordinates?.lon) {
                    params.append('lat', coordinates.lat);
                    params.append('lon', coordinates.lon);
                }

                console.log('[PropertyContext] Fetching from API:', `/api/property-data?${params}`);
                const response = await fetch(`/api/property-data?${params}`);

                if (response.ok) {
                    const result = await response.json();
                    console.log('[PropertyContext] API response:', result.property?.source, 'hasData:', !!result.property);
                    if (!cancelled) {
                        setPropertyData(result.property);
                        setFloodData(result.flood);

                        // Cache it
                        try {
                            const cached = localStorage.getItem(CACHE_KEY);
                            const cacheData = cached ? JSON.parse(cached) : {};
                            cacheData[addressString] = {
                                property: result.property,
                                flood: result.flood,
                                timestamp: Date.now()
                            };
                            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
                        } catch (e) {
                            console.warn('Cache write failed:', e);
                        }
                    }
                } else {
                    throw new Error(`API returned ${response.status}`);
                }
            } catch (err) {
                console.warn('[PropertyContext] Property API error:', err.message);
                if (!cancelled) {
                    setError(err.message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => { cancelled = true; };
    }, [addressString, coordinates]);

    // Computed values
    const computed = useMemo(() => {
        if (!propertyData) {
            return {
                pricePerSqft: null,
                homeAge: null,
                roomOptions: getDefaultRoomOptions()
            };
        }

        const currentYear = new Date().getFullYear();
        const homeAge = propertyData.yearBuilt ? currentYear - propertyData.yearBuilt : null;

        // Use estimated value if available, fallback to tax assessment
        const bestValue = propertyData.estimatedValue || propertyData.taxAssessment;
        const pricePerSqft = bestValue && propertyData.squareFootage
            ? Math.round(bestValue / propertyData.squareFootage)
            : null;

        // Generate dynamic room options based on property data
        const roomOptions = generateRoomOptions(propertyData);

        return {
            pricePerSqft,
            homeAge,
            roomOptions
        };
    }, [propertyData]);

    // Context value - expose ALL property data with elegant null fallbacks
    const value = useMemo(() => ({
        // ============================================
        // RAW DATA
        // ============================================
        propertyData,
        floodData,
        loading,
        error,

        // ============================================
        // COMPUTED VALUES
        // ============================================
        pricePerSqft: computed.pricePerSqft,
        homeAge: computed.homeAge,
        roomOptions: computed.roomOptions,

        // ============================================
        // BASIC PROPERTY INFO
        // ============================================
        bedrooms: propertyData?.bedrooms ?? null,
        bathrooms: propertyData?.bathrooms ?? null,
        squareFootage: propertyData?.squareFootage ?? null,
        lotSize: propertyData?.lotSize ?? null,
        yearBuilt: propertyData?.yearBuilt ?? null,
        propertyType: propertyData?.propertyType ?? null,

        // ============================================
        // BUILDING DETAILS (NEW)
        // ============================================
        stories: propertyData?.stories ?? null,
        roomCount: propertyData?.roomCount ?? null,
        architectureType: propertyData?.architectureType ?? null,
        foundationType: propertyData?.foundationType ?? null,
        roofType: propertyData?.roofType ?? null,
        exteriorType: propertyData?.exteriorType ?? null,
        constructionType: propertyData?.constructionType ?? null,
        quality: propertyData?.quality ?? null,
        condition: propertyData?.condition ?? null,

        // ============================================
        // UTILITIES (NEW - Critical for contractors!)
        // ============================================
        waterSource: propertyData?.waterSource ?? null,
        sewerType: propertyData?.sewerType ?? null,

        // ============================================
        // PARKING (NEW)
        // ============================================
        parkingType: propertyData?.parkingType ?? null,
        parkingSpaces: propertyData?.parkingSpaces ?? null,
        garageType: propertyData?.garageType ?? null,
        garageSpaces: propertyData?.garageSpaces ?? null,

        // ============================================
        // FEATURES (Expanded)
        // ============================================
        hasGarage: !!(propertyData?.garageSpaces || propertyData?.parkingType === 'Garage'),
        hasPool: !!propertyData?.features?.pool,
        hasFireplace: !!propertyData?.features?.fireplace,
        hasSpa: !!propertyData?.features?.spa,
        coolingType: propertyData?.features?.coolingType ?? null,
        heatingType: propertyData?.features?.heatingType ?? null,
        poolType: propertyData?.features?.poolType ?? null,
        features: propertyData?.features ?? {},

        // ============================================
        // OWNER INFORMATION (NEW)
        // ============================================
        ownerNames: propertyData?.ownerNames ?? [],
        ownerType: propertyData?.ownerType ?? null,
        ownerOccupied: propertyData?.ownerOccupied ?? null,

        // ============================================
        // FINANCIAL - VALUES (NEW)
        // ============================================
        estimatedValue: propertyData?.estimatedValue ?? null,
        estimatedValueLow: propertyData?.estimatedValueLow ?? null,
        estimatedValueHigh: propertyData?.estimatedValueHigh ?? null,
        taxAssessment: propertyData?.taxAssessment ?? null,
        lastSalePrice: propertyData?.lastSalePrice ?? null,
        lastSaleDate: propertyData?.lastSaleDate ?? null,
        rentEstimate: propertyData?.rentEstimate ?? null,
        annualPropertyTax: propertyData?.annualPropertyTax ?? null,

        // ============================================
        // LEGAL (NEW)
        // ============================================
        zoning: propertyData?.zoning ?? null,
        assessorID: propertyData?.assessorID ?? null,
        subdivision: propertyData?.subdivision ?? null,

        // ============================================
        // HOA (Expanded)
        // ============================================
        hoaFee: propertyData?.hoaFee ?? null,
        hoaFrequency: propertyData?.hoaFrequency ?? null,
        hoaName: propertyData?.hoaName ?? null,

        // ============================================
        // SOURCE INDICATORS
        // ============================================
        dataSource: propertyData?.source ?? null,
        isRealData: propertyData?.source === 'rentcast',
        isMockData: propertyData?.source === 'mock-data',
        fetchedAt: propertyData?.fetchedAt ?? null
    }), [propertyData, floodData, loading, error, computed]);

    return (
        <PropertyContext.Provider value={value}>
            {children}
        </PropertyContext.Provider>
    );
}

/**
 * useProperty - Hook to access property data from any component
 */
export function useProperty() {
    const context = useContext(PropertyContext);

    if (context === null) {
        // Return defaults if used outside provider (e.g., contractor invite page)
        // All fields have null/empty fallbacks for elegant handling
        return {
            // Raw data
            propertyData: null,
            floodData: null,
            loading: false,
            error: null,

            // Computed
            pricePerSqft: null,
            homeAge: null,
            roomOptions: getDefaultRoomOptions(),

            // Basic info
            bedrooms: null,
            bathrooms: null,
            squareFootage: null,
            lotSize: null,
            yearBuilt: null,
            propertyType: null,

            // Building details
            stories: null,
            roomCount: null,
            architectureType: null,
            foundationType: null,
            roofType: null,
            exteriorType: null,
            constructionType: null,
            quality: null,
            condition: null,

            // Utilities
            waterSource: null,
            sewerType: null,

            // Parking
            parkingType: null,
            parkingSpaces: null,
            garageType: null,
            garageSpaces: null,

            // Features
            hasGarage: false,
            hasPool: false,
            hasFireplace: false,
            hasSpa: false,
            coolingType: null,
            heatingType: null,
            poolType: null,
            features: {},

            // Owner info
            ownerNames: [],
            ownerType: null,
            ownerOccupied: null,

            // Financial
            estimatedValue: null,
            estimatedValueLow: null,
            estimatedValueHigh: null,
            taxAssessment: null,
            lastSalePrice: null,
            lastSaleDate: null,
            rentEstimate: null,
            annualPropertyTax: null,

            // Legal
            zoning: null,
            assessorID: null,
            subdivision: null,

            // HOA
            hoaFee: null,
            hoaFrequency: null,
            hoaName: null,

            // Source
            dataSource: null,
            isRealData: false,
            isMockData: false,
            fetchedAt: null
        };
    }

    return context;
}

export default PropertyContext;
