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

    // Extract address from property profile
    const addressString = useMemo(() => {
        const address = propertyProfile?.address;
        if (!address) return null;
        if (typeof address === 'string') return address;
        const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
        return parts.length >= 3 ? parts.join(', ') : null;
    }, [propertyProfile?.address]);

    const coordinates = propertyProfile?.coordinates;

    // Fetch property data
    useEffect(() => {
        if (!addressString) {
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

                const response = await fetch(`/api/property-data?${params}`);

                if (response.ok) {
                    const result = await response.json();
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
                console.warn('Property API error:', err.message);
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
                estimatedValue: null,
                pricePerSqft: null,
                appreciation: null,
                homeAge: null,
                roomOptions: getDefaultRoomOptions()
            };
        }

        const currentYear = new Date().getFullYear();
        const homeAge = propertyData.yearBuilt ? currentYear - propertyData.yearBuilt : null;

        const pricePerSqft = propertyData.taxAssessment && propertyData.squareFootage
            ? Math.round(propertyData.taxAssessment / propertyData.squareFootage)
            : null;

        const estimatedValue = propertyData.taxAssessment
            ? Math.round(propertyData.taxAssessment * 1.15)
            : null;

        const appreciation = propertyData.lastSalePrice && estimatedValue ? {
            dollarChange: estimatedValue - propertyData.lastSalePrice,
            percentChange: Math.round(((estimatedValue - propertyData.lastSalePrice) / propertyData.lastSalePrice) * 100),
            yearsPurchased: propertyData.lastSaleDate ? currentYear - new Date(propertyData.lastSaleDate).getFullYear() : null
        } : null;

        // Generate dynamic room options based on property data
        const roomOptions = generateRoomOptions(propertyData);

        return {
            estimatedValue,
            pricePerSqft,
            appreciation,
            homeAge,
            roomOptions
        };
    }, [propertyData]);

    // Context value
    const value = useMemo(() => ({
        // Raw data
        propertyData,
        floodData,
        loading,
        error,
        
        // Computed values
        estimatedValue: computed.estimatedValue,
        pricePerSqft: computed.pricePerSqft,
        appreciation: computed.appreciation,
        homeAge: computed.homeAge,
        
        // Dynamic room options
        roomOptions: computed.roomOptions,
        
        // Property features (convenient access)
        bedrooms: propertyData?.bedrooms || null,
        bathrooms: propertyData?.bathrooms || null,
        squareFootage: propertyData?.squareFootage || null,
        yearBuilt: propertyData?.yearBuilt || null,
        hasGarage: propertyData?.features?.garage || false,
        hasPool: propertyData?.features?.pool || false,
        hasFireplace: propertyData?.features?.fireplace || false,
        
        // Source indicator
        dataSource: propertyData?.source || null,
        isRealData: propertyData?.source === 'rentcast',
        isMockData: propertyData?.source === 'mock-data'
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
        return {
            propertyData: null,
            floodData: null,
            loading: false,
            error: null,
            estimatedValue: null,
            pricePerSqft: null,
            appreciation: null,
            homeAge: null,
            roomOptions: getDefaultRoomOptions(),
            bedrooms: null,
            bathrooms: null,
            squareFootage: null,
            yearBuilt: null,
            hasGarage: false,
            hasPool: false,
            hasFireplace: false,
            dataSource: null,
            isRealData: false,
            isMockData: false
        };
    }
    
    return context;
}

export default PropertyContext;
