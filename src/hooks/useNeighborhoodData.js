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
        // Guard clause: Need either coordinates OR a full address string
        if ((!coordinates || !coordinates.lat) && (!address || !address.city)) return;

        const fetchAll = async () => {
            setLoading(true);
            
            let targetLat = coordinates?.lat;
            let targetLon = coordinates?.lon;

            // 1. FALLBACK: Geocode address if coordinates are missing
            if (!targetLat && address) {
                try {
                    const query = `${address.street}, ${address.city}, ${address.state}`;
                    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${googleMapsApiKey}`;
                    const geoRes = await fetch(geoUrl);
                    const geoJson = await geoRes.json();
                    
                    if (geoJson.results?.[0]?.geometry?.location) {
                        targetLat = geoJson.results[0].geometry.location.lat;
                        targetLon = geoJson.results[0].geometry.location.lng;
                    }
                } catch (e) {
                    console.error("Geocoding fallback failed", e);
                }
            }

            if (!targetLat) {
                setLoading(false);
                return;
            }

            // FCC and ArcGIS APIs prefer 4 decimal places
            const lat = Number(targetLat).toFixed(4);
            const lon = Number(targetLon).toFixed(4);

            // HELPER: Use a CORS Proxy to bypass browser blocks
            // We use 'allorigins' to wrap the request
            const fetchWithProxy = async (url) => {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
                return response.json();
            };

            // 2. FEMA FLOOD DATA (Via Proxy)
            const fetchFlood = async () => {
                try {
                    const baseUrl = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';
                    const params = new URLSearchParams({
                        f: 'json',
                        geometry: `${lon},${lat}`,
                        geometryType: 'esriGeometryPoint',
                        spatialRel: 'esriSpatialRelIntersects',
                        outFields: 'FLD_ZONE,ZONE_SUBTY',
                        returnGeometry: 'false',
                        inSR: '4326'
                    });
                    
                    // USE PROXY HERE
                    const json = await fetchWithProxy(`${baseUrl}?${params.toString()}`);
                    
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

            // 3. FCC BROADBAND DATA (Via Proxy)
            const fetchBroadband = async () => {
                try {
                    const url = `https://broadbandmap.fcc.gov/api/public/map/list/broadband/${lat}/${lon}`;
                    
                    // USE PROXY HERE
                    const json = await fetchWithProxy(url);
                    
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

            // 4. USDA WILDFIRE RISK (Via Proxy for safety)
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

                    // USE PROXY HERE
                    const json = await fetchWithProxy(`${url}?${params.toString()}`);

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
