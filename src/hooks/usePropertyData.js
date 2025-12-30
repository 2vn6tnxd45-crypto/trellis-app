// src/hooks/usePropertyData.js
import { useState, useEffect, useCallback, useMemo } from 'react';

// Cache key for localStorage
const CACHE_KEY = 'krib_property_data';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// MOCK DATA GENERATOR
// ============================================
const generateMockData = (addressString) => {
    const hash = addressString ? addressString.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 100;
    const yearBuilt = 1970 + (hash % 50);
    const sqft = 1200 + (hash % 20) * 100;
    const beds = 2 + (hash % 4);
    const baths = 1 + (hash % 3) + ((hash % 2) * 0.5);
    const lastSalePrice = 200000 + (hash % 50) * 10000;
    const taxAssessment = Math.round(lastSalePrice * (1.1 + (hash % 20) / 100));
    
    return {
        property: {
            bedrooms: beds,
            bathrooms: baths,
            squareFootage: sqft,
            lotSize: sqft * 2 + (hash % 10) * 500,
            yearBuilt: yearBuilt,
            propertyType: 'Single Family',
            formattedAddress: addressString || '123 Sample Street',
            lastSaleDate: `${2015 + (hash % 8)}-${String(1 + (hash % 12)).padStart(2, '0')}-15T00:00:00.000Z`,
            lastSalePrice: lastSalePrice,
            taxAssessment: taxAssessment,
            assessmentYear: 2024,
            features: {
                cooling: true,
                coolingType: 'Central',
                heating: true,
                heatingType: 'Forced Air',
                garage: hash % 3 !== 0,
                garageSpaces: 2,
                pool: hash % 5 === 0,
                fireplace: hash % 2 === 0
            },
            hoaFee: hash % 4 === 0 ? 150 + (hash % 10) * 25 : null,
            source: 'mock-data'
        },
        flood: {
            zone: 'X',
            riskLevel: 'Minimal',
            riskDescription: 'Outside flood hazard area',
            requiresInsurance: false,
            source: 'mock-data'
        }
    };
};

// ============================================
// MAIN HOOK
// ============================================
export const usePropertyData = (address, coordinates) => {
    const [data, setData] = useState({ property: null, flood: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Build address string
    const addressString = useMemo(() => {
        if (!address) return null;
        if (typeof address === 'string') return address;
        const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
        return parts.length >= 3 ? parts.join(', ') : null;
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
                    throw new Error(`API returned ${response.status}`);
                }
            } catch (err) {
                console.warn('API fetch failed, using mock data:', err.message);
                if (!cancelled) {
                    const mock = generateMockData(addressString);
                    setData(mock);
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
