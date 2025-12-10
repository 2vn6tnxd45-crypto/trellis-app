// src/hooks/useNeighborhoodData.js
import { useState, useEffect } from 'react';

export const useNeighborhoodData = (coordinates) => {
    const [data, setData] = useState({
        flood: null,
        broadband: null,
        wildfire: null, // NEW
        schools: null
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!coordinates || !coordinates.lat) return;

        const fetchAll = async () => {
            setLoading(true);
            // FCC and ArcGIS APIs prefer 4 decimal places to avoid precision errors
            const lat = Number(coordinates.lat).toFixed(4);
            const lon = Number(coordinates.lon).toFixed(4);

            // 1. FEMA FLOOD DATA
            const fetchFlood = async () => {
                try {
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
                    return { zone: 'X', subtype: 'Area of Minimal Flood Hazard', isHighRisk: false }; 
                } catch (e) {
                    console.warn("Flood fetch failed", e);
                    return null;
                }
            };

            // 2. FCC BROADBAND DATA
            const fetchBroadband = async () => {
                try {
                    // FIXED: Ensure coordinates are clean numbers
                    const url = `https://broadbandmap.fcc.gov/api/public/map/list/broadband/${lat}/${lon}`;
                    const res = await fetch(url);
                    const json = await res.json();
                    
                    if (json.data && json.data.length > 0) {
                        const fastProviders = json.data.filter(p => p.tech_code === 50 || p.tech_code === 40); 
                        // Handle cases where max_ad_download might be missing or 0
                        const speeds = json.data.map(p => p.max_ad_download).filter(s => s > 0);
                        const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
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

            // 3. USDA WILDFIRE RISK (NEW)
            const fetchWildfire = async () => {
                try {
                    // Wildfire Risk to Communities (ArcGIS REST)
                    // MapServer 0 is usually the "Risk to Potential Structures" layer
                    const url = 'https://apps.fs.usda.gov/arcx/rest/services/rdw_Wildfire/Wildfire_Risk_to_Communities_Maps/MapServer/0/query';
                    const params = new URLSearchParams({
                        f: 'json',
                        geometry: `${lon},${lat}`,
                        geometryType: 'esriGeometryPoint',
                        spatialRel: 'esriSpatialRelIntersects',
                        outFields: 'RSL_SCORE', // Risk Score (0-100) or similar field
                        returnGeometry: 'false',
                        inSR: '4326'
                    });

                    const res = await fetch(`${url}?${params.toString()}`);
                    const json = await res.json();

                    if (json.features && json.features.length > 0) {
                        const score = json.features[0].attributes.RSL_SCORE || 0;
                        // Normalize 0-100 score to Low/Med/High
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
                } catch (e) {
                    console.warn("Wildfire fetch failed", e);
                    return null;
                }
            };

            // Execute parallel fetches
            const [floodData, broadbandData, wildfireData] = await Promise.all([
                fetchFlood(),
                fetchBroadband(),
                fetchWildfire()
            ]);

            setData({
                flood: floodData,
                broadband: broadbandData,
                wildfire: wildfireData,
                schools: null
            });
            setLoading(false);
        };

        fetchAll();
    }, [coordinates]);

    return { ...data, loading };
};
