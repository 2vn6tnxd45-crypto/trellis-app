// api/neighborhood.js
// This function runs on Vercel's servers, not in the user's browser.
// It can securely fetch data from FEMA, FCC, and USDA without CORS errors.

export default async function handler(req, res) {
    // 1. Get coordinates from the request URL
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Missing lat/lon parameters" });
    }

    // Format for APIs (4 decimal places is standard)
    const latFixed = Number(lat).toFixed(4);
    const lonFixed = Number(lon).toFixed(4);

    try {
        // --- 2. Execute Fetches in Parallel ---
        
        // A. FEMA Flood Data
        const floodPromise = fetch(`https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?f=json&geometry=${lonFixed},${latFixed}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&inSR=4326`)
            .then(r => r.json())
            .then(data => {
                const features = data.features;
                if (features && features.length > 0) {
                    const attr = features[0].attributes;
                    return {
                        zone: attr.FLD_ZONE,
                        subtype: attr.ZONE_SUBTY,
                        isHighRisk: ['A', 'AE', 'AH', 'AO', 'VE'].includes(attr.FLD_ZONE)
                    };
                }
                return { zone: 'X', subtype: 'Area of Minimal Flood Hazard', isHighRisk: false };
            })
            .catch(err => {
                console.error("Flood fetch failed:", err);
                return null;
            });

        // B. FCC Broadband Data
        const broadbandPromise = fetch(`https://broadbandmap.fcc.gov/api/public/map/list/broadband/${latFixed}/${lonFixed}`)
            .then(r => r.json())
            .then(data => {
                const results = data.data;
                if (results && results.length > 0) {
                    const fastProviders = results.filter(p => p.tech_code === 50 || p.tech_code === 40); 
                    const speeds = results.map(p => p.max_ad_download).filter(s => s > 0);
                    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
                    const providerCount = new Set(results.map(p => p.provider_id)).size;
                    
                    return {
                        count: providerCount,
                        maxSpeed: maxSpeed,
                        hasFiber: results.some(p => p.tech_code === 50),
                        providers: fastProviders.slice(0, 3).map(p => p.provider_name)
                    };
                }
                return null;
            })
            .catch(err => {
                console.error("Broadband fetch failed:", err);
                return null;
            });

        // C. USDA Wildfire Data
        const wildfirePromise = fetch(`https://apps.fs.usda.gov/arcx/rest/services/rdw_Wildfire/Wildfire_Risk_to_Communities_Maps/MapServer/0/query?f=json&geometry=${lonFixed},${latFixed}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=RSL_SCORE&returnGeometry=false&inSR=4326`)
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

        // Wait for all to finish
        const [flood, broadband, wildfire] = await Promise.all([floodPromise, broadbandPromise, wildfirePromise]);

        // Send aggregated result back to app
        return res.status(200).json({ flood, broadband, wildfire });

    } catch (error) {
        console.error("Global fetch error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
