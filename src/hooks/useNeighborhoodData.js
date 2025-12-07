// src/hooks/useNeighborhoodData.js
import { useState, useEffect } from 'react';

export const useNeighborhoodData = (coordinates, zipCode) => {
    const [data, setData] = useState({
        flood: null,
        broadband: null,
        schools: null
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!coordinates || !coordinates.lat) return;

        const fetchAll = async () => {
            setLoading(true);
            const lat = coordinates.lat;
            const lon = coordinates.lon;

            // 1. FEMA FLOOD DATA (ArcGIS REST)
            const fetchFlood = async () => {
                try {
                    // FEMA National Flood Hazard Layer (NFHL)
                    const url = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';
                    const params = new URLSearchParams({
                        f: 'json',
                        geometry: `${lon},${lat}`,
                        geometryType: 'esriGeometryPoint',
                        spatialRel: 'esriSpatialRelIntersects',
                        outFields: 'FLD_ZONE,ZONE_SUBTY',
                        returnGeometry: 'false',
                        inSR: '4326'
                    });
                    
                    const res = await fetch(`${url}?${params.toString()}`);
                    const json = await res.json();
                    
                    if (json.features && json.features.length > 0) {
                        const attr = json.features[0].attributes;
                        return {
                            zone: attr.FLD_ZONE,
                            subtype: attr.ZONE_SUBTY,
                            isHighRisk: ['A', 'AE', 'AH', 'AO', 'VE'].includes(attr.FLD_ZONE)
                        };
                    }
                    return { zone: 'X', subtype: 'Area of Minimal Flood Hazard', isHighRisk: false }; // Default if point not found in high risk layer
                } catch (e) {
                    console.warn("Flood fetch failed", e);
                    return null;
                }
            };

            // 2. FCC BROADBAND DATA (Public API)
            const fetchBroadband = async () => {
                try {
                    // FCC National Broadband Map API
                    const url = `https://broadbandmap.fcc.gov/api/public/map/list/broadband/${lat}/${lon}`;
                    const res = await fetch(url);
                    const json = await res.json();
                    
                    if (json.data && json.data.length > 0) {
                        // Filter for high-speed providers (Fiber or Cable)
                        const fastProviders = json.data.filter(p => p.tech_code === 50 || p.tech_code === 40); // 50=Fiber, 40=Cable
                        const maxSpeed = Math.max(...json.data.map(p => p.max_ad_download));
                        const providerCount = new Set(json.data.map(p => p.provider_id)).size;
                        
                        return {
                            count: providerCount,
                            maxSpeed: maxSpeed,
                            hasFiber: json.data.some(p => p.tech_code === 50),
                            providers: fastProviders.slice(0, 3).map(p => p.provider_name)
                        };
                    }
                    return null;
                } catch (e) {
                    console.warn("Broadband fetch failed", e);
                    return null;
                }
            };

            // Execute parallel fetches
            const [floodData, broadbandData] = await Promise.all([
                fetchFlood(),
                fetchBroadband()
            ]);

            setData({
                flood: floodData,
                broadband: broadbandData,
                schools: null // Schools often require premium API, we will use a smart link strategy in the UI instead
            });
            setLoading(false);
        };

        fetchAll();
    }, [coordinates]);

    return { ...data, loading };
};
