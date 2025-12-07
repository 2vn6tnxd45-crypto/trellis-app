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
    
    // NEW: Store the location we detected, even if we fail to get data
    const [detectedLocation, setDetectedLocation] = useState(null);

    useEffect(() => {
        if (!address?.city && !coordinates) return;

        const fetchCountyData = async () => {
            setLoading(true);
            setError(null);
            
            let currentCounty = "";
            let currentState = address?.state || "";

            try {
                let targetCoords = coordinates;

                // 1. Resolve Coordinates & County Name
                const geocodeUrl = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
                
                if (!targetCoords || !targetCoords.lat) {
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
                    } catch (e) { console.warn("Reverse lookup failed"); }
                }

                // SAVE WHAT WE KNOW
                setDetectedLocation({ county: currentCounty, state: currentState });

                // 2. Try to find the actual data (The hard part)
                const countyTerm = cleanName(currentCounty || address.city);
                const stateTerm = currentState;

                const searchQueries = [
                    `title:"${countyTerm}" AND title:"${stateTerm}" AND (title:"parcel" OR title:"assessor") type:"Feature Service"`,
                    `title:"${stateTerm}" AND (title:"parcel" OR title:"assessor") type:"Feature Service"`
                ];

                const portalUrl = 'https://www.arcgis.com/sharing/rest/search';
                let foundData = null;
                let usedUrl = null;

                for (const query of searchQueries) {
                    if (foundData) break;
                    const searchParams = new URLSearchParams({ q: query, f: 'json', num: 5, sortField: 'numViews', sortOrder: 'desc' });
                    const searchRes = await fetch(`${portalUrl}?${searchParams.toString()}`);
                    const searchData = await searchRes.json();

                    if (!searchData.results) continue;

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
                            
                            const controller = new AbortController();
                            const id = setTimeout(() => controller.abort(), 3000);
                            const pRes = await fetch(`${qUrl}?${qParams.toString()}`, { signal: controller.signal });
                            clearTimeout(id);
                            
                            if (pRes.ok) {
                                const pJson = await pRes.json();
                                if (pJson.features?.length > 0) {
                                    foundData = pJson.features[0].attributes;
                                    usedUrl = result.url;
                                }
                            }
                        } catch (e) { continue; }
                    }
                }

                if (foundData) {
                    // ... (Normalization logic remains the same as previous)
                    setParcelData({
                        owner: foundData.OWNER || foundData.Owner || "Unknown",
                        apn: foundData.APN || foundData.PARCEL_ID || "Unknown",
                        assessedValue: foundData.TOTAL_VALUE || foundData.AssessedValue || null,
                        // ... add other fields as needed
                    });
                    setServiceUrl(usedUrl);
                } else {
                    throw new Error("No digital record found.");
                }

            } catch (err) {
                console.warn("County Data Error:", err);
                setError(err.message);
                // Note: detectedLocation is still set, so the UI can use it!
            } finally {
                setLoading(false);
            }
        };

        fetchCountyData();
    }, [coordinates, address]);

    return { parcelData, loading, error, serviceUrl, detectedLocation };
};
