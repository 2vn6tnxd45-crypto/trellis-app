// src/hooks/useNeighborhoodData.js
import { useState, useEffect } from 'react';
import { googleMapsApiKey } from '../config/constants';

export const useNeighborhoodData = (coordinates, address) => {
    const [data, setData] = useState({
        flood: null,
        broadband: null,
        wildfire: null,
        schools: null
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Guard clause
        if ((!coordinates || !coordinates.lat) && (!address || !address.city)) {
            console.log("DEBUG: No coordinates or address found. Skipping fetch.");
            return;
        }

        const fetchAll = async () => {
            setLoading(true);
            console.log("DEBUG: Starting fetch...", { coordinates, address });
            
            let targetLat = coordinates?.lat;
            let targetLon = coordinates?.lon;

            // FALLBACK: If no coords, geocode the address first
            if (!targetLat && address) {
                console.log("DEBUG: Coordinates missing. Attempting Geocode fallback...");
                try {
                    const query = `${address.street}, ${address.city}, ${address.state}`;
                    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleMapsApiKey}`;
                    
                    const geoRes = await fetch(geoUrl);
                    const geoJson = await geoRes.json();
                    
                    console.log("DEBUG: Geocode Response:", geoJson);

                    if (geoJson.status !== 'OK') {
                        console.error("DEBUG: Geocoding API Error:", geoJson.status, geoJson.error_message);
                    }
                    
                    if (geoJson.results?.[0]?.geometry?.location) {
                        targetLat = geoJson.results[0].geometry.location.lat;
                        targetLon = geoJson.results[0].geometry.location.lng;
                        console.log("DEBUG: Resolved Coordinates:", targetLat, targetLon);
                    }
                } catch (e) {
                    console.error("DEBUG: Geocoding fallback failed", e);
                }
            }

            if (!targetLat) {
                console.warn("DEBUG: Could not resolve location. Stopping.");
                setLoading(false);
                return;
            }

            const lat = Number(targetLat).toFixed(4);
            const lon = Number(targetLon).toFixed(4);

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
                    console.log("DEBUG: Flood Data:", json);
                    
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
                    const url = `https://broadbandmap.fcc.gov/api/public/map/list/broadband/${lat}/${lon}`;
                    const res = await fetch(url);
                    const json = await res.json();
                    console.log("DEBUG: Broadband Data:", json);
                    
                    if (json.data && json.data.length > 0) {
                        const fastProviders = json.data.filter(p => p.tech_code === 50 || p.tech_code === 40); 
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

            // 3. USDA WILDFIRE RISK
            const fetchWildfire = async () => {
                try {
                    const url = 'https://apps.fs.usda.gov/arcx/rest/services/rdw_Wildfire/Wildfire_Risk_to_Communities_Maps/MapServer/0/query';
                    const params = new URLSearchParams({
                        f: 'json',
                        geometry: `${lon},${lat}`,
                        geometryType: 'esriGeometryPoint',
                        spatialRel: 'esriSpatialRelIntersects',
                        outFields: 'RSL_SCORE',
                        returnGeometry: 'false',
                        inSR: '4326'
                    });

                    const res = await fetch(`${url}?${params.toString()}`);
                    const json = await res.json();
                    console.log("DEBUG: Wildfire Data:", json);

                    if (json.features && json.features.length > 0) {
                        const score = json.features[0].attributes.RSL_SCORE || 0;
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
    }, [coordinates, address]);

    return { ...data, loading };
};
