// api/property-data.js
// Vercel serverless function for property-specific data
// Uses RentCast API (50 free/month) + FEMA Flood API (unlimited)

export default async function handler(req, res) {
    // Log incoming request for debugging
    console.log('Property data request:', req.query);
    
    const { address, lat, lon } = req.query;

    if (!address) {
        console.log('Error: Missing address parameter');
        return res.status(400).json({ error: "Missing address parameter" });
    }

    try {
        // Get API key from environment (set in Vercel dashboard)
        const rentcastApiKey = process.env.RENTCAST_API_KEY;
        console.log('RentCast API key present:', !!rentcastApiKey);

        // Execute fetches - use Promise.allSettled to handle partial failures
        const results = await Promise.allSettled([
            fetchRentCast(address, rentcastApiKey),
            lat && lon ? fetchFloodZone(lat, lon) : Promise.resolve(null)
        ]);

        // Extract results, using null for any failures
        const propertyData = results[0].status === 'fulfilled' ? results[0].value : getMockPropertyData(address);
        const floodData = results[1].status === 'fulfilled' ? results[1].value : null;

        // Log any failures
        if (results[0].status === 'rejected') {
            console.error('Property fetch failed:', results[0].reason);
        }
        if (results[1].status === 'rejected') {
            console.error('Flood fetch failed:', results[1].reason);
        }

        // Return whatever we got
        return res.status(200).json({
            property: propertyData,
            flood: floodData,
            fetchedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Property data handler error:", error);
        
        // Even on error, return mock data so the UI works
        return res.status(200).json({
            property: getMockPropertyData(address),
            flood: null,
            fetchedAt: new Date().toISOString(),
            _error: error.message
        });
    }
}

// ============================================
// RENTCAST API (Free tier: 50 requests/month)
// https://developers.rentcast.io/reference/property-records
// ============================================
async function fetchRentCast(address, apiKey) {
    if (!apiKey) {
        console.log("No RentCast API key - returning mock data");
        return getMockPropertyData(address);
    }

    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://api.rentcast.io/v1/properties?address=${encodedAddress}`;
        
        console.log('Fetching from RentCast:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Api-Key': apiKey
            }
        });

        console.log('RentCast response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("RentCast API error:", response.status, errorText);
            return getMockPropertyData(address);
        }

        const data = await response.json();
        console.log('RentCast returned data:', !!data);
        
        // API returns array, get first result
        const property = Array.isArray(data) ? data[0] : data;
        
        if (!property) {
            console.log('No property found, using mock data');
            return getMockPropertyData(address);
        }

        // Get most recent tax assessment
        const taxYears = property.taxAssessments ? Object.keys(property.taxAssessments).sort().reverse() : [];
        const latestTaxYear = taxYears[0];
        const latestAssessment = latestTaxYear ? property.taxAssessments[latestTaxYear] : null;

        return {
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            squareFootage: property.squareFootage,
            lotSize: property.lotSize,
            yearBuilt: property.yearBuilt,
            propertyType: property.propertyType,
            formattedAddress: property.formattedAddress,
            city: property.city,
            state: property.state,
            zipCode: property.zipCode,
            county: property.county,
            latitude: property.latitude,
            longitude: property.longitude,
            lastSaleDate: property.lastSaleDate,
            lastSalePrice: property.lastSalePrice,
            taxAssessment: latestAssessment?.value || null,
            assessmentYear: latestAssessment?.year || null,
            taxAssessmentHistory: property.taxAssessments || {},
            propertyTaxes: property.propertyTaxes || {},
            saleHistory: property.history || {},
            ownerOccupied: property.ownerOccupied,
            features: property.features || {},
            hoaFee: property.hoa?.fee || null,
            source: 'rentcast'
        };

    } catch (error) {
        console.error("RentCast fetch exception:", error);
        return getMockPropertyData(address);
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

        console.log('Fetching flood data from FEMA');
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await response.json();

        if (data.features && data.features.length > 0) {
            const attrs = data.features[0].attributes;
            const zone = attrs.FLD_ZONE || 'X';
            
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
        console.error("FEMA flood fetch failed:", error.message);
        // Return null instead of throwing - we'll handle missing flood data gracefully
        return null;
    }
}

// ============================================
// MOCK DATA (for development/demo without API key)
// ============================================
function getMockPropertyData(address) {
    // Generate semi-random but consistent data based on address
    const hash = address ? address.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 100;
    const yearBuilt = 1970 + (hash % 50);
    const sqft = 1200 + (hash % 20) * 100;
    const beds = 2 + (hash % 4);
    const baths = 1 + (hash % 3) + ((hash % 2) * 0.5);
    const lastSalePrice = 200000 + (hash % 50) * 10000;
    const taxAssessment = Math.round(lastSalePrice * (1.1 + (hash % 20) / 100));
    
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
}
