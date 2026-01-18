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
            _error: 'Failed to fetch property data'
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

        // Get most recent property tax
        const taxHistoryYears = property.propertyTaxes ? Object.keys(property.propertyTaxes).sort().reverse() : [];
        const latestTaxHistoryYear = taxHistoryYears[0];
        const latestPropertyTax = latestTaxHistoryYear ? property.propertyTaxes[latestTaxHistoryYear] : null;

        return {
            // ============================================
            // BASIC PROPERTY INFO
            // ============================================
            bedrooms: property.bedrooms ?? null,
            bathrooms: property.bathrooms ?? null,
            squareFootage: property.squareFootage ?? null,
            lotSize: property.lotSize ?? null,
            yearBuilt: property.yearBuilt ?? null,
            propertyType: property.propertyType ?? null,

            // ============================================
            // LOCATION
            // ============================================
            formattedAddress: property.formattedAddress ?? null,
            addressLine1: property.addressLine1 ?? null,
            addressLine2: property.addressLine2 ?? null,
            city: property.city ?? null,
            state: property.state ?? null,
            zipCode: property.zipCode ?? null,
            county: property.county ?? null,
            latitude: property.latitude ?? null,
            longitude: property.longitude ?? null,

            // ============================================
            // OWNER INFORMATION (NEW)
            // ============================================
            ownerNames: property.ownerNames ?? [],
            ownerType: property.ownerType ?? null, // 'Individual', 'Corporation', 'Trust'
            ownerOccupied: property.ownerOccupied ?? null,
            ownerMailingAddress: property.ownerMailingAddress ?? null,

            // ============================================
            // BUILDING DETAILS (NEW)
            // ============================================
            stories: property.stories ?? null,
            units: property.units ?? null,
            roomCount: property.roomCount ?? null,
            architectureType: property.architectureType ?? null, // 'Ranch', 'Colonial', etc.
            foundationType: property.foundationType ?? null, // 'Slab', 'Basement', 'Crawl Space'
            roofType: property.roofType ?? null, // 'Shingle', 'Tile', 'Metal'
            exteriorType: property.exteriorType ?? null, // 'Brick', 'Vinyl', 'Stucco'

            // ============================================
            // CONSTRUCTION DETAILS (NEW)
            // ============================================
            constructionType: property.constructionType ?? null, // 'Frame', 'Masonry', 'Steel'
            quality: property.quality ?? null, // 'Average', 'Above Average', 'Luxury'
            condition: property.condition ?? null, // 'Good', 'Fair', 'Poor'

            // ============================================
            // PARKING (NEW)
            // ============================================
            parkingType: property.parkingType ?? null, // 'Garage', 'Carport', 'None'
            parkingSpaces: property.parkingSpaces ?? null,
            garageType: property.garageType ?? null,
            garageSpaces: property.garageSpaces ?? null,

            // ============================================
            // UTILITIES (NEW - Critical for contractors!)
            // ============================================
            waterSource: property.waterSource ?? null, // 'Public', 'Well'
            sewerType: property.sewerType ?? null, // 'Public', 'Septic'

            // ============================================
            // FEATURES (Expanded)
            // ============================================
            features: {
                cooling: property.features?.cooling ?? null,
                coolingType: property.features?.coolingType ?? null,
                heating: property.features?.heating ?? null,
                heatingType: property.features?.heatingType ?? null,
                fireplace: property.features?.fireplace ?? null,
                fireplaceCount: property.features?.fireplaceCount ?? null,
                pool: property.features?.pool ?? null,
                poolType: property.features?.poolType ?? null,
                spa: property.features?.spa ?? null,
                view: property.features?.view ?? null,
                viewType: property.features?.viewType ?? null,
                waterfront: property.features?.waterfront ?? null,
                waterfrontType: property.features?.waterfrontType ?? null,
            },

            // ============================================
            // FINANCIAL - SALE HISTORY
            // ============================================
            lastSaleDate: property.lastSaleDate ?? null,
            lastSalePrice: property.lastSalePrice ?? null,
            saleHistory: property.history ?? {},

            // ============================================
            // FINANCIAL - TAX ASSESSMENT
            // ============================================
            taxAssessment: latestAssessment?.value ?? null,
            taxAssessmentLand: latestAssessment?.land ?? null,
            taxAssessmentImprovement: latestAssessment?.improvements ?? null,
            assessmentYear: latestTaxYear ?? null,
            taxAssessmentHistory: property.taxAssessments ?? {},

            // ============================================
            // FINANCIAL - PROPERTY TAXES
            // ============================================
            annualPropertyTax: latestPropertyTax?.total ?? null,
            propertyTaxYear: latestTaxHistoryYear ?? null,
            propertyTaxes: property.propertyTaxes ?? {},

            // ============================================
            // FINANCIAL - VALUE ESTIMATES (NEW)
            // ============================================
            estimatedValue: property.estimatedValue ?? null, // Rentcast AVM
            estimatedValueLow: property.estimatedValueLow ?? null,
            estimatedValueHigh: property.estimatedValueHigh ?? null,
            pricePerSquareFoot: property.pricePerSquareFoot ?? null,
            pricePerSquareFootLand: property.pricePerSquareFootLand ?? null,
            rentEstimate: property.rentEstimate ?? null, // Monthly rent estimate
            rentEstimateLow: property.rentEstimateLow ?? null,
            rentEstimateHigh: property.rentEstimateHigh ?? null,

            // ============================================
            // LEGAL INFORMATION (NEW)
            // ============================================
            assessorID: property.assessorID ?? null, // Assessor Parcel Number
            taxID: property.taxID ?? null,
            legalDescription: property.legalDescription ?? null,
            zoning: property.zoning ?? null, // 'R1', 'R2', 'C1'
            subdivision: property.subdivision ?? null,

            // ============================================
            // HOA
            // ============================================
            hoaFee: property.hoa?.fee ?? null,
            hoaFrequency: property.hoa?.frequency ?? null, // 'Monthly', 'Annually'
            hoaName: property.hoa?.name ?? null,

            // ============================================
            // META
            // ============================================
            source: 'rentcast',
            fetchedAt: new Date().toISOString()
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
    const estimatedValue = Math.round(lastSalePrice * (1.15 + (hash % 25) / 100));
    const stories = (hash % 3) + 1;

    // Randomized building materials based on hash
    const roofTypes = ['Shingle', 'Tile', 'Metal', 'Slate'];
    const exteriorTypes = ['Brick', 'Vinyl Siding', 'Stucco', 'Wood'];
    const foundationTypes = ['Slab', 'Basement', 'Crawl Space'];
    const architectureTypes = ['Ranch', 'Colonial', 'Contemporary', 'Craftsman', 'Split Level'];

    return {
        // Basic Info
        bedrooms: beds,
        bathrooms: baths,
        squareFootage: sqft,
        lotSize: sqft * 2 + (hash % 10) * 500,
        yearBuilt: yearBuilt,
        propertyType: 'Single Family',

        // Location
        formattedAddress: address || '123 Sample Street',
        addressLine1: address || '123 Sample Street',
        addressLine2: null,
        city: 'Your City',
        state: 'ST',
        zipCode: '00000',
        county: 'Your County',
        latitude: null,
        longitude: null,

        // Owner Info (not available in mock)
        ownerNames: [],
        ownerType: null,
        ownerOccupied: true,
        ownerMailingAddress: null,

        // Building Details
        stories: stories,
        units: 1,
        roomCount: beds + 3 + (hash % 3),
        architectureType: architectureTypes[hash % architectureTypes.length],
        foundationType: foundationTypes[hash % foundationTypes.length],
        roofType: roofTypes[hash % roofTypes.length],
        exteriorType: exteriorTypes[hash % exteriorTypes.length],

        // Construction
        constructionType: 'Frame',
        quality: 'Average',
        condition: 'Good',

        // Parking
        parkingType: hash % 3 !== 0 ? 'Garage' : 'Carport',
        parkingSpaces: hash % 3 !== 0 ? 2 : 1,
        garageType: hash % 3 !== 0 ? 'Attached' : null,
        garageSpaces: hash % 3 !== 0 ? 2 : 0,

        // Utilities
        waterSource: 'Public',
        sewerType: hash % 10 === 0 ? 'Septic' : 'Public',

        // Features
        features: {
            cooling: true,
            coolingType: 'Central',
            heating: true,
            heatingType: 'Forced Air',
            fireplace: hash % 2 === 0,
            fireplaceCount: hash % 2 === 0 ? 1 : 0,
            pool: hash % 5 === 0,
            poolType: hash % 5 === 0 ? 'In-ground' : null,
            spa: hash % 8 === 0,
            view: null,
            viewType: null,
            waterfront: false,
            waterfrontType: null,
        },

        // Sale History
        lastSaleDate: `${2015 + (hash % 8)}-${String(1 + (hash % 12)).padStart(2, '0')}-15T00:00:00.000Z`,
        lastSalePrice: lastSalePrice,
        saleHistory: {},

        // Tax Assessment
        taxAssessment: taxAssessment,
        taxAssessmentLand: Math.round(taxAssessment * 0.3),
        taxAssessmentImprovement: Math.round(taxAssessment * 0.7),
        assessmentYear: 2024,
        taxAssessmentHistory: {},

        // Property Taxes
        annualPropertyTax: Math.round(taxAssessment * 0.012),
        propertyTaxYear: 2024,
        propertyTaxes: {},

        // Value Estimates
        estimatedValue: estimatedValue,
        estimatedValueLow: Math.round(estimatedValue * 0.95),
        estimatedValueHigh: Math.round(estimatedValue * 1.05),
        pricePerSquareFoot: Math.round(estimatedValue / sqft),
        pricePerSquareFootLand: null,
        rentEstimate: Math.round(estimatedValue * 0.005),
        rentEstimateLow: Math.round(estimatedValue * 0.0045),
        rentEstimateHigh: Math.round(estimatedValue * 0.0055),

        // Legal
        assessorID: null,
        taxID: null,
        legalDescription: null,
        zoning: 'R1',
        subdivision: null,

        // HOA
        hoaFee: hash % 4 === 0 ? 150 + (hash % 10) * 25 : null,
        hoaFrequency: hash % 4 === 0 ? 'Monthly' : null,
        hoaName: null,

        // Meta
        source: 'mock-data',
        fetchedAt: new Date().toISOString()
    };
}
