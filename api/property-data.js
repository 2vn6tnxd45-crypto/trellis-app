// api/property-data.js
// Vercel serverless function for property-specific data
// Uses RentCast API (50 free/month) + FEMA Flood API (unlimited)

export default async function handler(req, res) {
    const { address, lat, lon } = req.query;

    if (!address) {
        return res.status(400).json({ error: "Missing address parameter" });
    }

    // Get API key from environment (set in Vercel dashboard)
    const rentcastApiKey = process.env.RENTCAST_API_KEY;

    try {
        // Execute all fetches in parallel
        const [propertyData, floodData] = await Promise.all([
            // 1. RentCast Property API (50 free/month)
            fetchRentCast(address, rentcastApiKey),
            // 2. FEMA Flood Zone (free, unlimited)
            lat && lon ? fetchFloodZone(lat, lon) : Promise.resolve(null)
        ]);

        // Merge and return
        return res.status(200).json({
            property: propertyData,
            flood: floodData,
            fetchedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Property data fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch property data" });
    }
}

// ============================================
// RENTCAST API (Free tier: 50 requests/month)
// https://developers.rentcast.io/reference/property-records
// ============================================
async function fetchRentCast(address, apiKey) {
    if (!apiKey) {
        console.warn("No RentCast API key - returning mock data");
        return getMockPropertyData();
    }

    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://api.rentcast.io/v1/properties?address=${encodedAddress}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Api-Key': apiKey
            }
        });

        if (!response.ok) {
            console.error("RentCast API error:", response.status);
            // Return mock data on error so UI still works
            return getMockPropertyData();
        }

        const data = await response.json();
        
        // API returns array, get first result
        const property = Array.isArray(data) ? data[0] : data;
        
        if (!property) return getMockPropertyData();

        // Get most recent tax assessment
        const taxYears = property.taxAssessments ? Object.keys(property.taxAssessments).sort().reverse() : [];
        const latestTaxYear = taxYears[0];
        const latestAssessment = latestTaxYear ? property.taxAssessments[latestTaxYear] : null;

        return {
            // Basic Info
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            squareFootage: property.squareFootage,
            lotSize: property.lotSize,
            yearBuilt: property.yearBuilt,
            propertyType: property.propertyType,
            
            // Address (normalized)
            formattedAddress: property.formattedAddress,
            city: property.city,
            state: property.state,
            zipCode: property.zipCode,
            county: property.county,
            latitude: property.latitude,
            longitude: property.longitude,
            
            // Value Data
            lastSaleDate: property.lastSaleDate,
            lastSalePrice: property.lastSalePrice,
            taxAssessment: latestAssessment?.value || null,
            assessmentYear: latestAssessment?.year || null,
            taxAssessmentHistory: property.taxAssessments || {},
            
            // Property taxes
            propertyTaxes: property.propertyTaxes || {},
            
            // Sale history
            saleHistory: property.history || {},
            
            // Owner info
            ownerOccupied: property.ownerOccupied,
            
            // Features
            features: property.features || {},
            hoaFee: property.hoa?.fee || null,
            
            // Source tracking
            source: 'rentcast'
        };

    } catch (error) {
        console.error("RentCast fetch failed:", error);
        return getMockPropertyData();
    }
}

// ============================================
// FEMA FLOOD ZONE API (Free, unlimited)
// ============================================
async function fetchFloodZone(lat, lon) {
    try {
        const url = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?` +
            `where=1%3D1&` +
            `geometry=${lon}%2C${lat}&` +
            `geometryType=esriGeometryPoint&` +
            `inSR=4326&` +
            `spatialRel=esriSpatialRelIntersects&` +
            `outFields=FLD_ZONE%2CZONE_SUBTY%2CSFHA_TF&` +
            `returnGeometry=false&` +
            `f=json`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const attrs = data.features[0].attributes;
            const zone = attrs.FLD_ZONE || 'X';
            
            // Determine risk level from zone code
            let riskLevel = 'Minimal';
            let riskDescription = 'Outside flood hazard area';
            let requiresInsurance = false;
            
            if (['A', 'AE', 'AH', 'AO', 'AR', 'A99'].includes(zone)) {
                riskLevel = 'High';
                riskDescription = 'Special Flood Hazard Area (1% annual chance)';
                requiresInsurance = true;
            } else if (['V', 'VE'].includes(zone)) {
                riskLevel = 'Very High';
                riskDescription = 'Coastal flood zone with wave action';
                requiresInsurance = true;
            } else if (['B', 'X500', 'X (shaded)'].includes(zone) || attrs.ZONE_SUBTY === '0.2 PCT ANNUAL CHANCE FLOOD HAZARD') {
                riskLevel = 'Moderate';
                riskDescription = 'Moderate flood hazard (0.2% annual chance)';
            } else if (zone === 'D') {
                riskLevel = 'Undetermined';
                riskDescription = 'Flood hazard not determined';
            }

            return {
                zone,
                subtype: attrs.ZONE_SUBTY,
                riskLevel,
                riskDescription,
                requiresInsurance,
                inSFHA: attrs.SFHA_TF === 'T',
                source: 'fema-nfhl'
            };
        }

        return {
            zone: 'X',
            riskLevel: 'Minimal',
            riskDescription: 'Outside flood hazard area',
            requiresInsurance: false,
            inSFHA: false,
            source: 'fema-nfhl'
        };

    } catch (error) {
        console.error("FEMA flood fetch failed:", error);
        return null;
    }
}

// ============================================
// MOCK DATA (for development/demo without API key)
// ============================================
function getMockPropertyData() {
    return {
        bedrooms: 4,
        bathrooms: 2.5,
        squareFootage: 2150,
        lotSize: 7500,
        yearBuilt: 1998,
        propertyType: 'Single Family',
        formattedAddress: '123 Demo Street, Sample City, CA 90210',
        city: 'Sample City',
        state: 'CA',
        zipCode: '90210',
        county: 'Los Angeles',
        latitude: 34.0901,
        longitude: -118.4065,
        lastSaleDate: '2019-06-15T00:00:00.000Z',
        lastSalePrice: 485000,
        taxAssessment: 525000,
        assessmentYear: 2024,
        taxAssessmentHistory: {
            '2024': { year: 2024, value: 525000, land: 200000, improvements: 325000 },
            '2023': { year: 2023, value: 498000, land: 190000, improvements: 308000 },
            '2022': { year: 2022, value: 472000, land: 180000, improvements: 292000 }
        },
        propertyTaxes: {
            '2024': { year: 2024, total: 6300 },
            '2023': { year: 2023, total: 5976 }
        },
        saleHistory: {
            '2019-06-15': { event: 'Sale', date: '2019-06-15T00:00:00.000Z', price: 485000 },
            '2005-03-22': { event: 'Sale', date: '2005-03-22T00:00:00.000Z', price: 312000 }
        },
        ownerOccupied: true,
        features: {
            cooling: true,
            coolingType: 'Central',
            heating: true,
            heatingType: 'Forced Air',
            garage: true,
            garageSpaces: 2,
            pool: false,
            fireplace: true
        },
        hoaFee: null,
        source: 'mock-data'
    };
}api/property-data.js
