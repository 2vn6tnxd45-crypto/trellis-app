// src/hooks/usePropertyData.js
// ============================================
// PROPERTY DATA HOOK - RENTCAST API
// ============================================
// Fetches real property data from Rentcast API
// Returns null if unavailable - NO MOCK DATA

import { useState, useEffect, useMemo } from 'react';

// Cache key for localStorage
const CACHE_KEY = 'krib_property_data_v2';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// ============================================
// MAIN HOOK
// ============================================
export const usePropertyData = (address, coordinates) => {
    const [data, setData] = useState({ property: null, flood: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Build address string
    // Build address string
    const addressString = useMemo(() => {
        if (!address) return null;
        if (typeof address === 'string') return address;

        // If street contains a full address (common from Google Places), use it directly
        if (address.street && address.street.includes(',')) {
            return address.street;
        }

        // Otherwise, build from parts (need at least street + city or 3 parts)
        const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
        if (parts.length >= 2) {
            return parts.join(', ');
        }

        // Fallback: if we have any street value at all, try it
        if (address.street) {
            return address.street;
        }

        return null;
    }, [address]);

    // Fetch data
    useEffect(() => {
        if (!addressString) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            // Check cache first
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const cacheData = JSON.parse(cached);
                    const entry = cacheData[addressString];
                    if (entry && (Date.now() - entry.timestamp) < CACHE_DURATION) {
                        if (!cancelled) {
                            setData({ property: entry.property, flood: entry.flood });
                            setLoading(false);
                        }
                        return;
                    }
                }
            } catch (e) {
                console.warn('Cache read failed:', e);
            }

            // Try API
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
                        setData({ property: result.property, flood: result.flood });

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
                    // API failed - set null, no mock data
                    console.warn(`Property API returned ${response.status}`);
                    if (!cancelled) {
                        setError(`API returned ${response.status}`);
                        setData({ property: null, flood: null });
                    }
                }
            } catch (err) {
                // Network error - set null, no mock data
                console.warn('Property API fetch failed:', err.message);
                if (!cancelled) {
                    setError(err.message);
                    setData({ property: null, flood: null });
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
        const property = data.property;
        if (!property) {
            return {
                estimatedValue: null,
                pricePerSqft: null,
                appreciation: null,
                homeAge: null,
                maintenancePredictions: []
            };
        }

        const currentYear = new Date().getFullYear();
        const homeAge = property.yearBuilt ? currentYear - property.yearBuilt : null;

        const pricePerSqft = property.taxAssessment && property.squareFootage
            ? Math.round(property.taxAssessment / property.squareFootage)
            : null;

        const estimatedValue = property.taxAssessment
            ? Math.round(property.taxAssessment * 1.15)
            : null;

        const appreciation = property.lastSalePrice && estimatedValue ? {
            dollarChange: estimatedValue - property.lastSalePrice,
            percentChange: Math.round(((estimatedValue - property.lastSalePrice) / property.lastSalePrice) * 100),
            yearsPurchased: property.lastSaleDate ? currentYear - new Date(property.lastSaleDate).getFullYear() : null
        } : null;

        const maintenancePredictions = homeAge ? generateMaintenancePredictions(homeAge, property.yearBuilt) : [];

        return { estimatedValue, pricePerSqft, appreciation, homeAge, maintenancePredictions };
    }, [data.property]);

    return {
        propertyData: data.property,
        floodData: data.flood,
        loading,
        error,
        hasData: !!data.property,
        ...computed
    };
};

// ============================================
// MAINTENANCE PREDICTIONS
// ============================================
const COMPONENT_LIFESPANS = [
    { name: 'Roof (Asphalt Shingles)', category: 'Exterior', lifespan: 25 },
    { name: 'HVAC System', category: 'Systems', lifespan: 18 },
    { name: 'Water Heater', category: 'Plumbing', lifespan: 12 },
    { name: 'Exterior Paint', category: 'Exterior', lifespan: 10 },
    { name: 'Garage Door', category: 'Exterior', lifespan: 20 },
    { name: 'Windows', category: 'Exterior', lifespan: 25 },
    { name: 'Electrical Panel', category: 'Systems', lifespan: 30 },
    { name: 'Dishwasher', category: 'Appliances', lifespan: 10 },
    { name: 'Refrigerator', category: 'Appliances', lifespan: 14 },
    { name: 'Washer/Dryer', category: 'Appliances', lifespan: 12 },
    { name: 'Carpet', category: 'Interior', lifespan: 10 },
    { name: 'Hardwood Refinish', category: 'Interior', lifespan: 15 },
    { name: 'Deck/Patio', category: 'Exterior', lifespan: 15 },
    { name: 'Fencing', category: 'Exterior', lifespan: 15 },
    { name: 'Driveway (Concrete)', category: 'Exterior', lifespan: 30 },
];

function generateMaintenancePredictions(homeAge, yearBuilt) {
    const currentYear = new Date().getFullYear();

    return COMPONENT_LIFESPANS.map(component => {
        let replacementYear = yearBuilt + component.lifespan;
        while (replacementYear < currentYear) {
            replacementYear += component.lifespan;
        }

        const remainingYears = replacementYear - currentYear;

        let priority = 'good';
        if (remainingYears <= 2) priority = 'critical';
        else if (remainingYears <= 5) priority = 'warning';
        else if (remainingYears <= 10) priority = 'monitor';

        return {
            ...component,
            remainingYears,
            replacementYear,
            priority
        };
    }).sort((a, b) => a.remainingYears - b.remainingYears);
}

export default usePropertyData;
