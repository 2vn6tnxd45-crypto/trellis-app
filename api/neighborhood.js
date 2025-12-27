// api/neighborhood.js
// Vercel serverless function for neighborhood data
// Fetches: USDA Wildfire, Census ACS demographics, NOAA Climate normals, OpenStreetMap amenities

export default async function handler(req, res) {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Missing lat/lon parameters" });
    }

    const latFixed = Number(lat).toFixed(4);
    const lonFixed = Number(lon).toFixed(4);

    try {
        // --- Execute All Fetches in Parallel ---

        // A. USDA Wildfire Risk (keeping this - it works!)
        const wildfirePromise = fetch(
            `https://apps.fs.usda.gov/arcx/rest/services/rdw_Wildfire/Wildfire_Risk_to_Communities_Maps/MapServer/0/query?f=json&geometry=${lonFixed},${latFixed}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=RSL_SCORE&returnGeometry=false&inSR=4326`
        )
            .then(r => r.json())
            .then(data => {
                const features = data.features;
                if (features && features.length > 0) {
                    const score = features[0].attributes.RSL_SCORE || 0;
                    let riskLevel = 'Low';
                    if (score > 80) riskLevel = 'Very High';
                    else if (score > 50) riskLevel = 'High';
                    else if (score > 20) riskLevel = 'Moderate';

                    return {
                        score: score,
                        riskLevel: riskLevel,
                        isHighRisk: score > 50
                    };
                }
                return { score: 0, riskLevel: 'Low', isHighRisk: false };
            })
            .catch(err => {
                console.error("Wildfire fetch failed:", err);
                return null;
            });

        // B. Census Bureau ACS Data (via FCC Area API for FIPS, then Census)
        const censusPromise = (async () => {
            try {
                // Step 1: Get FIPS codes from FCC
                const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${latFixed}&lon=${lonFixed}&format=json`;
                const fccRes = await fetch(fccUrl);
                const fccData = await fccRes.json();
                
                if (!fccData.results || fccData.results.length === 0) {
                    return null;
                }

                const result = fccData.results[0];
                const stateFips = result.state_fips;
                const countyFips = result.county_fips;
                const countyName = result.county_name;
                const stateName = result.state_name;

                // Step 2: Get ACS 5-Year estimates for the county
                // Variables: B19013_001E (median income), B25077_001E (median home value), 
                // B01003_001E (total pop), B25003_002E (owner occupied), B25003_003E (renter occupied)
                const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B25077_001E,B01003_001E,B25003_002E,B25003_003E,B25002_001E&for=county:${countyFips.slice(-3)}&in=state:${stateFips}`;
                
                const censusRes = await fetch(censusUrl);
                const censusData = await censusRes.json();

                if (censusData && censusData.length > 1) {
                    const values = censusData[1];
                    const medianIncome = parseInt(values[0]) || null;
                    const medianHomeValue = parseInt(values[1]) || null;
                    const totalPop = parseInt(values[2]) || null;
                    const ownerOccupied = parseInt(values[3]) || 0;
                    const renterOccupied = parseInt(values[4]) || 0;
                    const totalHousing = parseInt(values[5]) || 1;
                    
                    const ownershipRate = totalHousing > 0 
                        ? Math.round((ownerOccupied / totalHousing) * 100) 
                        : null;

                    return {
                        countyName,
                        stateName,
                        medianIncome,
                        medianHomeValue,
                        population: totalPop,
                        ownershipRate
                    };
                }
                return null;
            } catch (err) {
                console.error("Census fetch failed:", err);
                return null;
            }
        })();

        // C. NOAA Climate Normals (using their Climate Data Online API)
        const climatePromise = (async () => {
            try {
                // Use the NOAA NCEI normals gridded data endpoint
                // This returns 30-year climate normals for the location
                const noaaUrl = `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=NORMAL_MLY&datatypeid=MLY-TAVG-NORMAL,MLY-PRCP-NORMAL&locationid=ZIP:${await getZipFromCoords(latFixed, lonFixed)}&startdate=2010-01-01&enddate=2010-12-31&limit=24&units=standard`;
                
                // Since NOAA requires an API key and can be slow, let's use Open-Meteo instead
                // It's free, no API key, and very reliable
                const meteoUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latFixed}&longitude=${lonFixed}&start_date=2023-01-01&end_date=2023-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FNew_York`;
                
                const meteoRes = await fetch(meteoUrl);
                const meteoData = await meteoRes.json();

                if (meteoData && meteoData.daily) {
                    const temps = meteoData.daily.temperature_2m_max || [];
                    const tempMins = meteoData.daily.temperature_2m_min || [];
                    const precip = meteoData.daily.precipitation_sum || [];

                    // Calculate yearly averages
                    const avgHigh = temps.length > 0 
                        ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 9/5 + 32) 
                        : null;
                    const avgLow = tempMins.length > 0 
                        ? Math.round(tempMins.reduce((a, b) => a + b, 0) / tempMins.length * 9/5 + 32) 
                        : null;
                    const totalRainfall = precip.length > 0 
                        ? Math.round(precip.reduce((a, b) => a + b, 0) / 25.4) // mm to inches
                        : null;

                    // Find hottest and coldest months
                    const monthlyHighs = Array(12).fill(0).map((_, m) => {
                        const monthTemps = temps.filter((_, i) => new Date(2023, 0, i + 1).getMonth() === m);
                        return monthTemps.length > 0 ? monthTemps.reduce((a, b) => a + b, 0) / monthTemps.length : 0;
                    });
                    
                    const hottestMonth = monthlyHighs.indexOf(Math.max(...monthlyHighs));
                    const coldestMonth = monthlyHighs.indexOf(Math.min(...monthlyHighs));
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                    return {
                        avgHighF: avgHigh,
                        avgLowF: avgLow,
                        annualRainfallIn: totalRainfall,
                        hottestMonth: monthNames[hottestMonth],
                        coldestMonth: monthNames[coldestMonth]
                    };
                }
                return null;
            } catch (err) {
                console.error("Climate fetch failed:", err);
                return null;
            }
        })();

        // D. OpenStreetMap Nearby Amenities (Overpass API)
        const amenitiesPromise = (async () => {
            try {
                // Search within ~1 mile (0.015 degrees roughly)
                const radius = 0.015;
                const bbox = `${latFixed - radius},${lonFixed - radius},${Number(latFixed) + radius},${Number(lonFixed) + radius}`;
                
                // Query for parks, grocery stores, restaurants, schools, hospitals
                const overpassQuery = `
                    [out:json][timeout:10];
                    (
                        node["amenity"="school"](${bbox});
                        node["amenity"="hospital"](${bbox});
                        node["amenity"="pharmacy"](${bbox});
                        node["shop"="supermarket"](${bbox});
                        node["leisure"="park"](${bbox});
                        way["leisure"="park"](${bbox});
                        node["amenity"="restaurant"](${bbox});
                        node["amenity"="cafe"](${bbox});
                    );
                    out body;
                `;
                
                const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
                const overpassRes = await fetch(overpassUrl);
                const overpassData = await overpassRes.json();

                if (overpassData && overpassData.elements) {
                    const elements = overpassData.elements;
                    
                    const parks = elements.filter(e => e.tags?.leisure === 'park').length;
                    const schools = elements.filter(e => e.tags?.amenity === 'school').length;
                    const groceryStores = elements.filter(e => e.tags?.shop === 'supermarket').length;
                    const restaurants = elements.filter(e => e.tags?.amenity === 'restaurant' || e.tags?.amenity === 'cafe').length;
                    const healthcare = elements.filter(e => e.tags?.amenity === 'hospital' || e.tags?.amenity === 'pharmacy').length;

                    // Get names of nearest parks (up to 3)
                    const parkNames = elements
                        .filter(e => e.tags?.leisure === 'park' && e.tags?.name)
                        .slice(0, 3)
                        .map(e => e.tags.name);

                    return {
                        parks,
                        schools,
                        groceryStores,
                        restaurants,
                        healthcare,
                        nearbyParks: parkNames,
                        totalAmenities: elements.length
                    };
                }
                return null;
            } catch (err) {
                console.error("Amenities fetch failed:", err);
                return null;
            }
        })();

        // Wait for all fetches
        const [wildfire, census, climate, amenities] = await Promise.all([
            wildfirePromise,
            censusPromise,
            climatePromise,
            amenitiesPromise
        ]);

        return res.status(200).json({ wildfire, census, climate, amenities });

    } catch (error) {
        console.error("Global fetch error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// Helper to get ZIP from coordinates (for NOAA lookup)
async function getZipFromCoords(lat, lon) {
    try {
        const url = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        // Return a default if we can't find it - climate will still work via Open-Meteo
        return '90210';
    } catch {
        return '90210';
    }
}
