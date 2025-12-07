// src/hooks/useCountyData.js
import { useState, useEffect } from 'react';

// Common stop words to clean up county names for better searching
const cleanCountyName = (name) => {
    if (!name) return '';
    return name.replace(' County', '').replace(' Parish', '').replace(' Borough', '').trim();
};

export const useCountyData = (coordinates, address) => {
    const [parcelData, setParcelData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [countyServiceUrl, setCountyServiceUrl] = useState(null);

    useEffect(() => {
        // We need at least an address to work with
        if (!address?.street && !address?.city) return;

        const fetchCountyData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                let targetCoords = coordinates;

                // ---------------------------------------------------------
                // STEP 1: SELF-REPAIR (Geocoding Fallback)
                // If we don't have saved coordinates (Legacy users), fetch them now.
                // ---------------------------------------------------------
                if (!targetCoords || !targetCoords.lat) {
                    // Use ArcGIS World Geocoding Service (Public/Free for low volume)
                    const geocodeUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
                    const fullAddress = `${address.street}, ${address.city}, ${address.state}`;
                    
                    const geoParams = new URLSearchParams({
                        SingleLine: fullAddress,
                        f: 'json',
                        maxLocations: 1,
                        outFields: '*'
                    });

                    const geoRes = await fetch(`${geocodeUrl}?${geoParams.toString()}`);
                    const geoData = await geoRes.json();

                    if (geoData.candidates && geoData.candidates.length > 0) {
                        const location = geoData.candidates[0].location;
                        targetCoords = { lat: location.y, lon: location.x };
                        // Optional: You could infer the county name here from geoData attributes if needed
                    } else {
                        throw new Error("Could not locate this address on the map.");
                    }
                }

                // ---------------------------------------------------------
                // STEP 2: FIND COUNTY SERVER
                // ---------------------------------------------------------
                const countyName = cleanCountyName(address.county || address.city); 
                const stateName = address.state;

                const portalUrl = 'https://www.arcgis.com/sharing/rest/search';
                
                // Broader search query to catch more counties
                const query = `(title:"parcels" OR title:"assessor" OR title:"cadastral" OR title:"landbase") AND (title:"${stateName}") AND type:"Feature Service"`;
                
                const searchParams = new URLSearchParams({
                    q: query,
                    f: 'json',
                    num: 20, // Fetch more candidates
                    sortField: 'numViews',
                    sortOrder: 'desc'
                });

                const searchRes = await fetch(`${portalUrl}?${searchParams.toString()}`);
                const searchData = await searchRes.json();

                if (!searchData.results || searchData.results.length === 0) {
                    throw new Error("Could not find a public county record service.");
                }

                // ---------------------------------------------------------
                // STEP 3: QUERY LAYERS (Try multiple candidates)
                // ---------------------------------------------------------
                let foundData = null;
                let usedUrl = null;

                // Try the top 3 most popular services found for this state
                // This is a "shotgun approach" because we can't be sure which one is the *specific* county 
                // without complex spatial queries, but usually the local county server will respond to the coordinate.
                for (const result of searchData.results.slice(0, 3)) {
                    if (foundData) break;

                    try {
                        const serviceUrl = result.url;
                        // Try Layer 0 (most common)
                        const queryLayerUrl = `${serviceUrl}/0/query`;
                        
                        const queryParams = new URLSearchParams({
                            f: 'json',
                            geometry: `${targetCoords.lon},${targetCoords.lat}`,
                            geometryType: 'esriGeometryPoint',
                            spatialRel: 'esriSpatialRelIntersects',
                            outFields: '*', 
                            returnGeometry: false,
                            inSR: 4326
                        });

                        // Set a timeout so we don't hang on dead servers
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout

                        const parcelRes = await fetch(`${queryLayerUrl}?${queryParams.toString()}`, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        if (!parcelRes.ok) continue; 
                        
                        const parcelJson = await parcelRes.json();

                        if (parcelJson.features && parcelJson.features.length > 0) {
                            const attributes = parcelJson.features[0].attributes;
                            
                            // Basic validation: Does it look like a parcel?
                            if (attributes.APN || attributes.PARCEL_ID || attributes.OWNER || attributes.Owner) {
                                foundData = attributes;
                                usedUrl = serviceUrl;
                            }
                        }
                    } catch (e) {
                        // Continue to next candidate if this one fails
                        continue;
                    }
                }

                if (foundData) {
                    // Normalize data
                    const normalized = {
                        owner: foundData.OWNER || foundData.Owner || foundData.OWNER_NAME || foundData.OwnerName || "Unknown",
                        apn: foundData.APN || foundData.PARCEL_ID || foundData.PIN || foundData.ParcelID || foundData.APN_D || "Unknown",
                        address: foundData.SITUS || foundData.SiteAddress || foundData.ADDRESS || foundData.Location || "Unknown",
                        assessedValue: foundData.TOTAL_VALUE || foundData.AssessedValue || foundData.TOTAL_ASSED || foundData.TotalValue || foundData.NET_VALUE || null,
                        landValue: foundData.LAND_VALUE || foundData.LandValue || null,
                        improvementValue: foundData.IMPROVEMENT_VALUE || foundData.ImpValue || null,
                        yearBuilt: foundData.YEAR_BUILT || foundData.YearBuilt || foundData.EFF_YEAR_BUILT || null,
                        legalDesc: foundData.LEGAL_DESC || foundData.LegalDescription || "N/A",
                        raw: foundData
                    };
                    
                    setParcelData(normalized);
                    setCountyServiceUrl(usedUrl);
                } else {
                    throw new Error("Location found, but no public parcel record could be linked.");
                }

            } catch (err) {
                console.warn("County Data Error:", err);
                setError(err.message || "Failed to fetch county records.");
            } finally {
                setLoading(false);
            }
        };

        fetchCountyData();
    }, [coordinates, address]); // Re-run if address changes

    return { parcelData, loading, error, serviceUrl: countyServiceUrl };
};
