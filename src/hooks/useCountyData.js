// src/hooks/useCountyData.js
import { useState, useEffect } from 'react';

const cleanName = (name) => {
    if (!name) return '';
    return name.replace(' County', '').replace(' Parish', '').replace(' Borough', '').trim();
};

export const useCountyData = (coordinates, address) => {
    const [parcelData, setParcelData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [serviceUrl, setServiceUrl] = useState(null);
    const [detectedLocation, setDetectedLocation] = useState(null);

    useEffect(() => {
        // Need at least a city/street OR coordinates to start
        if (!address?.city && !coordinates) return;

        const fetchCountyData = async () => {
            setLoading(true);
            setError(null);
            
            let currentCounty = "";
            let currentState = address?.state || "";
            let targetCoords = coordinates;

            try {
                // ---------------------------------------------------------
                // STEP 1: RESOLVE LOCATION (Geocode or Reverse Geocode)
                // ---------------------------------------------------------
                const geocodeUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
                
                if (!targetCoords || !targetCoords.lat) {
                    // Scenario A: Address -> Coordinates (Legacy users)
                    const findUrl = `${geocodeUrl}/findAddressCandidates`;
                    const params = new URLSearchParams({
                        SingleLine: `${address.street}, ${address.city}, ${address.state}`,
                        f: 'json',
                        maxLocations: 1,
                        outFields: 'Subregion,Region'
                    });

                    const geoRes = await fetch(`${findUrl}?${params.toString()}`);
                    const geoData = await geoRes.json();

                    if (geoData.candidates?.length > 0) {
                        const loc = geoData.candidates[0].location;
                        const attr = geoData.candidates[0].attributes;
                        targetCoords = { lat: loc.y, lon: loc.x };
                        currentCounty = attr.Subregion || "";
                        currentState = attr.Region || currentState;
                    }
                } else {
                    // Scenario B: Coordinates -> County Name (New users)
                    const reverseUrl = `${geocodeUrl}/reverseGeocode`;
                    const params = new URLSearchParams({
                        f: 'json',
                        location: `${targetCoords.lon},${targetCoords.lat}`,
                        outFields: 'Subregion,Region'
                    });
                    
                    try {
                        const revRes = await fetch(`${reverseUrl}?${params.toString()}`);
                        const revData = await revRes.json();
                        if (revData.address) {
                            currentCounty = revData.address.Subregion || "";
                            currentState = revData.address.Region || currentState;
                        }
                    } catch (e) { console.warn("Reverse lookup warning:", e); }
                }

                // Update state with what we found (even if data pull fails later)
                setDetectedLocation({ county: currentCounty, state: currentState });

                // ---------------------------------------------------------
                // STEP 2: FIND PARCEL DATA (The "County-First" Strategy)
                // ---------------------------------------------------------
                const countyTerm = cleanName(currentCounty || address.county || address.city);
                const stateTerm = currentState;

                const searchQueries = [
                    // Best: County + State + "Parcel"
                    `title:"${countyTerm}" AND title:"${stateTerm}" AND (title:"parcel" OR title:"assessor") type:"Feature Service"`,
                    // Fallback: County + "Land"
                    `title:"${countyTerm}" AND (title:"parcel" OR title:"land") type:"Feature Service"`,
                    // Last Resort: State + "Parcel" (The "Shotgun" approach)
                    `title:"${stateTerm}" AND (title:"parcel" OR title:"assessor") type:"Feature Service"`
                ];

                const portalUrl = 'https://www.arcgis.com/sharing/rest/search';
                let foundData = null;
                let usedUrl = null;

                for (const query of searchQueries) {
                    if (foundData) break;

                    const searchParams = new URLSearchParams({
                        q: query,
                        f: 'json',
                        num: 5,
                        sortField: 'numViews',
                        sortOrder: 'desc'
                    });

                    const searchRes = await fetch(`${portalUrl}?${searchParams.toString()}`);
                    const searchData = await searchRes.json();

                    if (!searchData.results) continue;

                    // Test candidates
                    for (const result of searchData.results) {
                        if (foundData) break;
                        try {
                            const qUrl = `${result.url}/0/query`;
                            const qParams = new URLSearchParams({
                                f: 'json',
                                geometry: `${targetCoords.lon},${targetCoords.lat}`,
                                geometryType: 'esriGeometryPoint',
                                spatialRel: 'esriSpatialRelIntersects',
                                outFields: '*',
                                returnGeometry: false,
                                inSR: 4326
                            });
                            
                            // Timeout to prevent hanging on dead servers
                            const controller = new AbortController();
                            const id = setTimeout(() => controller.abort(), 3500);
                            
                            const pRes = await fetch(`${qUrl}?${qParams.toString()}`, { signal: controller.signal });
                            clearTimeout(id);
                            
                            if (pRes.ok) {
                                const pJson = await pRes.json();
                                if (pJson.features?.length > 0) {
                                    const attrs = pJson.features[0].attributes;
                                    // Verify it has useful data
                                    if (attrs.OWNER || attrs.Owner || attrs.APN || attrs.PARCEL_ID || attrs.AssessValue) {
                                        foundData = attrs;
                                        usedUrl = result.url;
                                    }
                                }
                            }
                        } catch (e) { continue; }
                    }
                }

                if (foundData) {
                    setParcelData({
                        owner: foundData.OWNER || foundData.Owner || foundData.OWNER_NAME || foundData.OwnerName || "Unknown",
                        apn: foundData.APN || foundData.PARCEL_ID || foundData.PIN || foundData.ParcelID || "Unknown",
                        address: foundData.SITUS || foundData.SiteAddress || foundData.ADDRESS || "Unknown",
                        assessedValue: foundData.TOTAL_VALUE || foundData.AssessedValue || foundData.TOTAL_ASSED || foundData.TotalValue || null,
                        landValue: foundData.LAND_VALUE || foundData.LandValue || null,
                        improvementValue: foundData.IMPROVEMENT_VALUE || foundData.ImpValue || null,
                        legalDesc: foundData.LEGAL_DESC || foundData.LegalDescription || "N/A",
                        raw: foundData
                    });
                    setServiceUrl(usedUrl);
                } else {
                    throw new Error("No digital record found.");
                }

            } catch (err) {
                console.warn("County Data Error:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCountyData();
    }, [coordinates, address]);

    return { parcelData, loading, error, serviceUrl, detectedLocation };
};
