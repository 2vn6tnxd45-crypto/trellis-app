// src/hooks/usePropertyData.js
import { useState, useEffect, useCallback } from 'react';

// Cache key for localStorage
const CACHE_KEY = 'krib_property_data';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// MOCK DATA (used when API unavailable)
// ============================================
const getMockPropertyData = (address) => {
    // Generate semi-random but consistent data based on address
    const hash = address ? address.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 100;
    const yearBuilt = 1970 + (hash % 50); // 1970-2020
    const sqft = 1200 + (hash % 20) * 100; // 1200-3200
    const beds = 2 + (hash % 4); // 2-5
    const baths = 1 + (hash % 3) + ((hash % 2) * 0.5); // 1-3.5
    const lastSalePrice = 200000 + (hash % 50) * 10000; // 200k-700k
    const taxAssessment = Math.round(lastSalePrice * (1.1 + (hash % 20) / 100)); // 10-30% above purchase
    
    return {
        bedrooms: beds,
        bathrooms: baths,
        squareFootage: sqft,
        lotSize: sqft * 2 + (hash % 10) * 500,
        yearBuilt: yearBuilt,
        propertyType: 'Single Family',
        formattedAddress: address || '123 Sample Street',
        city: 'Your City',
        state: 'ST',
        zipCode: '00000',
        county: 'Your County',
        lastSaleDate: `${2015 + (hash % 8)}-${String(1 + (hash % 12)).padStart(2, '0')}-15T00:00:00.000Z`,
        lastSalePrice: lastSalePrice,
        taxAssessment: taxAssessment,
        assessmentYear: 2024,
        ownerOccupied: true,
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
    };
};

const getMockFloodData = () => ({
    zone: 'X',
    riskLevel: 'Minimal',
    riskDescription: 'Outside flood hazard area',
    requiresInsurance: false,
    inSFHA: false,
    source: 'mock-data'
});

export const usePropertyData = (address, coordinates) => {
    const [propertyData, setPropertyData] = useState(null);
    const [floodData, setFloodData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Build full address string from object or use string directly
    const getAddressString = useCallback(() => {
        if (!address) return null;
        if (typeof address === 'string') return address;
        
        const parts = [
            address.street,
            address.city,
            address.state,
            address.zip
        ].filter(Boolean);
        
        return parts.length >= 3 ? parts.join(', ') : null;
    }, [address]);

    // Check cache for existing data
    const getCachedData = useCallback((addressKey) => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            const entry = cacheData[addressKey];
            
            if (entry && (Date.now() - entry.timestamp) < CACHE_DURATION) {
                return entry;
            }
            
            return null;
        } catch (e) {
            console.warn('Cache read error:', e);
            return null;
        }
    }, []);

    // Save data to cache
    const setCachedData = useCallback((addressKey, data) => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            const cacheData = cached ? JSON.parse(cached) : {};
            
            cacheData[addressKey] = {
                ...data,
                timestamp: Date.now()
            };
            
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (e) {
            console.warn('Cache write error:', e);
        }
    }, []);

    // Force refresh (bypasses cache)
    const refresh = useCallback(async () => {
        const addressString = getAddressString();
        if (!addressString) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const params = new URLSearchParams({
                address: addressString
            });
            
            if (coordinates?.lat && coordinates?.lon) {
                params.append('lat', coordinates.lat);
                params.append('lon', coordinates.lon);
            }
            
            const response = await fetch(`/api/property-data?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            setPropertyData(data.property);
            setFloodData(data.flood);
            setLastUpdated(data.fetchedAt);
            
            setCachedData(addressString, {
                property: data.property,
                flood: data.flood,
                fetchedAt: data.fetchedAt
            });
            
        } catch (err) {
            console.warn('Property API unavailable, using mock data:', err.message);
            // Use mock data instead of showing error
            const mockProperty = getMockPropertyData(addressString);
            const mockFlood = getMockFloodData();
            
            setPropertyData(mockProperty);
            setFloodData(mockFlood);
            setLastUpdated(new Date().toISOString());
            setError(null); // Clear error since we have fallback data
        } finally {
            setLoading(false);
        }
    }, [getAddressString, coordinates, setCachedData]);

    // Initial fetch with cache check
    useEffect(() => {
        const addressString = getAddressString();
        if (!addressString) {
            setLoading(false);
            return;
        }
        
        // Check cache first
        const cached = getCachedData(addressString);
        if (cached) {
            setPropertyData(cached.property);
            setFloodData(cached.flood);
            setLastUpdated(cached.fetchedAt);
            setLoading(false);
            return;
        }
        
        // No cache, try to fetch
        setLoading(true);
        
        const fetchData = async () => {
            try {
                const params = new URLSearchParams({
                    address: addressString
                });
                
                if (coordinates?.lat && coordinates?.lon) {
                    params.append('lat', coordinates.lat);
                    params.append('lon', coordinates.lon);
                }
                
                const response = await fetch(`/api/property-data?${params.toString()}`);
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                setPropertyData(data.property);
                setFloodData(data.flood);
                setLastUpdated(data.fetchedAt);
                
                setCachedData(addressString, {
                    property: data.property,
                    flood: data.flood,
                    fetchedAt: data.fetchedAt
                });
                
            } catch (err) {
                console.warn('Property API unavailable, using mock data:', err.message);
                // Use mock data instead of showing error
                const mockProperty = getMockPropertyData(addressString);
                const mockFlood = getMockFloodData();
                
                setPropertyData(mockProperty);
                setFloodData(mockFlood);
                setLastUpdated(new Date().toISOString());
                setError(null);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [getAddressString, coordinates, getCachedData, setCachedData]);

    // Calculated/derived values
    const calculations = useComputedValues(propertyData);

    return {
        propertyData,
        floodData,
        loading,
        error,
        lastUpdated,
        refresh,
        ...calculations
    };
};

// ============================================
// COMPUTED VALUES HOOK
// ============================================
function useComputedValues(propertyData) {
    if (!propertyData) {
        return {
            estimatedValue: null,
            pricePerSqft: null,
            appreciation: null,
            homeAge: null,
            maintenancePredictions: []
        };
    }

    const currentYear = new Date().getFullYear();
    const homeAge = propertyData.yearBuilt 
        ? currentYear - propertyData.yearBuilt 
        : null;

    const pricePerSqft = propertyData.taxAssessment && propertyData.squareFootage
        ? Math.round(propertyData.taxAssessment / propertyData.squareFootage)
        : null;

    const estimatedValue = propertyData.taxAssessment
        ? Math.round(propertyData.taxAssessment * 1.15)
        : null;

    const appreciation = propertyData.lastSalePrice && estimatedValue
        ? {
            dollarChange: estimatedValue - propertyData.lastSalePrice,
            percentChange: Math.round(((estimatedValue - propertyData.lastSalePrice) / propertyData.lastSalePrice) * 100),
            yearsPurchased: propertyData.lastSaleDate 
                ? currentYear - new Date(propertyData.lastSaleDate).getFullYear()
                : null
        }
        : null;

    const maintenancePredictions = generateMaintenancePredictions(homeAge, propertyData.yearBuilt);

    return {
        estimatedValue,
        pricePerSqft,
        appreciation,
        homeAge,
        maintenancePredictions
    };
}

// ============================================
// MAINTENANCE PREDICTIONS
// ============================================
const COMPONENT_LIFESPANS = [
    { name: 'Roof (Asphalt Shingles)', category: 'Exterior', lifespan: 25, icon: 'roof' },
    { name: 'HVAC System', category: 'Systems', lifespan: 18, icon: 'hvac' },
    { name: 'Water Heater', category: 'Plumbing', lifespan: 12, icon: 'water' },
    { name: 'Exterior Paint', category: 'Exterior', lifespan: 10, icon: 'paint' },
    { name: 'Garage Door', category: 'Exterior', lifespan: 20, icon: 'garage' },
    { name: 'Windows', category: 'Exterior', lifespan: 25, icon: 'window' },
    { name: 'Electrical Panel', category: 'Systems', lifespan: 30, icon: 'electrical' },
    { name: 'Dishwasher', category: 'Appliances', lifespan: 10, icon: 'appliance' },
    { name: 'Refrigerator', category: 'Appliances', lifespan: 14, icon: 'appliance' },
    { name: 'Washer/Dryer', category: 'Appliances', lifespan: 12, icon: 'appliance' },
    { name: 'Carpet', category: 'Interior', lifespan: 10, icon: 'flooring' },
    { name: 'Hardwood Refinish', category: 'Interior', lifespan: 15, icon: 'flooring' },
    { name: 'Deck/Patio', category: 'Exterior', lifespan: 15, icon: 'deck' },
    { name: 'Fencing', category: 'Exterior', lifespan: 15, icon: 'fence' },
    { name: 'Driveway (Concrete)', category: 'Exterior', lifespan: 30, icon: 'driveway' },
];

function generateMaintenancePredictions(homeAge, yearBuilt) {
    if (!homeAge || homeAge < 0) return [];
    
    const currentYear = new Date().getFullYear();
    
    return COMPONENT_LIFESPANS.map(component => {
        const componentAge = homeAge;
        const estimatedReplacementYear = yearBuilt + component.lifespan;
        
        let adjustedReplacementYear = estimatedReplacementYear;
        while (adjustedReplacementYear < currentYear) {
            adjustedReplacementYear += component.lifespan;
        }
        
        const adjustedRemainingYears = adjustedReplacementYear - currentYear;
        const percentLifeUsed = Math.min(100, Math.round((componentAge % component.lifespan) / component.lifespan * 100));
        
        let priority = 'good';
        if (adjustedRemainingYears <= 2) priority = 'critical';
        else if (adjustedRemainingYears <= 5) priority = 'warning';
        else if (adjustedRemainingYears <= 10) priority = 'monitor';
        
        return {
            ...component,
            componentAge: componentAge % component.lifespan,
            remainingYears: adjustedRemainingYears,
            replacementYear: adjustedReplacementYear,
            percentLifeUsed,
            priority
        };
    }).sort((a, b) => a.remainingYears - b.remainingYears);
}

export default usePropertyData;
