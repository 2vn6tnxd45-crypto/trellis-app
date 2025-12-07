// src/hooks/useCountyData.js
import { useState, useEffect } from 'react';

// Common stop words to clean up county names for better searching
const cleanCountyName = (name) => {
    return name.replace(' County', '').replace(' Parish', '').replace(' Borough', '').trim();
};

export const useCountyData = (coordinates, address) => {
    const [parcelData, setParcelData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [countyServiceUrl, setCountyServiceUrl] = useState(null);

    useEffect(() => {
        if (!coordinates || !address?.city) return;

        const fetchCountyData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                // 1. Identify County
                // We use the address data. If administrative_area_level_2 isn't available, 
                // we rely on the search.
                // Assuming address object has: street, city, state, zip. 
                // We really need the County name for this to work well.
                // Since SetupPropertyForm might not save "County" explicitly, we can try to guess or use City+State.
                
                // Construct a search query for ArcGIS Portal
                // We look for "Parcel" or "Assessor" feature services in the specific area.
                
                const countyName = cleanCountyName(address.county || address.city); // Fallback to city if county missing
                const stateName = address.state;

                const portalUrl = 'https://www.arcgis.com/sharing/rest/search';
                
                // Strategy: Search for a public Feature Service matching the location tags
                // We prioritize "Parcel" and "Cadastral" layers.
                const query = `(title:"parcels" OR title:"assessor" OR title:"cadastral") AND (title:"${countyName}" OR tags:"${countyName}") AND (title:"${stateName}" OR tags:"${stateName}") AND type:"Feature Service"`;
                
                const searchParams = new URLSearchParams({
                    q: query,
                    f: 'json',
                    num: 5,
                    sortField: 'numViews', // Get popular/official ones first
                    sortOrder: 'desc'
                });

                const searchRes = await fetch(`${portalUrl}?${searchParams.toString()}`);
                const searchData = await searchRes.json();

                if (!searchData.results || searchData.results.length === 0) {
                    throw new Error("Could not find a public county record service.");
                }

                // 2. Find a queryable layer
                // We take the top result URL
                const serviceUrl = searchData.results[0].url;
                setCountyServiceUrl(serviceUrl);

                // 3. Query the Feature Service for the specific point
                // Usually Layer 0 is the main parcel layer, but we can try 0, 1, or search layers.
                // We'll default to Layer 0.
                const queryLayerUrl = `${serviceUrl}/0/query`;
                
                const queryParams = new URLSearchParams({
                    f: 'json',
                    geometry: `${coordinates.lon},${coordinates.lat}`,
                    geometryType: 'esriGeometryPoint',
                    spatialRel: 'esriSpatialRelIntersects',
                    outFields: '*', // Get all fields
                    returnGeometry: false,
                    inSR: 4326 // Input Spatial Reference (WGS84)
                });

                const parcelRes = await fetch(`${queryLayerUrl}?${queryParams.toString()}`);
                const parcelJson = await parcelRes.json();

                if (parcelJson.features && parcelJson.features.length > 0) {
                    const attributes = parcelJson.features[0].attributes;
                    
                    // Normalize data (different counties use different field names)
                    const normalized = {
                        owner: attributes.OWNER || attributes.Owner || attributes.OWNER_NAME || attributes.OwnerName || "Unknown",
                        apn: attributes.APN || attributes.PARCEL_ID || attributes.PIN || attributes.ParcelID || "Unknown",
                        address: attributes.SITUS || attributes.SiteAddress || attributes.ADDRESS || attributes.Location || "Unknown",
                        assessedValue: attributes.TOTAL_VALUE || attributes.AssessedValue || attributes.TOTAL_ASSED || attributes.TotalValue || null,
                        landValue: attributes.LAND_VALUE || attributes.LandValue || null,
                        improvementValue: attributes.IMPROVEMENT_VALUE || attributes.ImpValue || null,
                        yearBuilt: attributes.YEAR_BUILT || attributes.YearBuilt || attributes.EFF_YEAR_BUILT || null,
                        legalDesc: attributes.LEGAL_DESC || attributes.LegalDescription || "N/A",
                        raw: attributes // Keep raw for debugging/extra fields
                    };
                    
                    setParcelData(normalized);
                } else {
                    // Try searching layer 1 if layer 0 failed (common in some map services)
                     const queryLayerUrl1 = `${serviceUrl}/1/query`;
                     const parcelRes1 = await fetch(`${queryLayerUrl1}?${queryParams.toString()}`);
                     const parcelJson1 = await parcelRes1.json();
                     
                     if (parcelJson1.features && parcelJson1.features.length > 0) {
                         // ... (Duplicate logic for brevity, ideally refactor)
                         const attributes = parcelJson1.features[0].attributes;
                         setParcelData({
                            owner: attributes.OWNER || attributes.OwnerName || "Unknown",
                            apn: attributes.APN || attributes.ParcelID || "Unknown",
                             // ... simplistic mapping
                            raw: attributes
                         });
                     } else {
                        throw new Error("Location found, but no parcel record at this coordinate.");
                     }
                }

            } catch (err) {
                console.warn("County Data Error:", err);
                setError(err.message || "Failed to fetch county records.");
            } finally {
                setLoading(false);
            }
        };

        fetchCountyData();
    }, [coordinates, address]);

    return { parcelData, loading, error, serviceUrl: countyServiceUrl };
};
