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
        if ((!coordinates || !coordinates.lat) && (!address || !address.city)) return;

        const fetchData = async () => {
            setLoading(true);
            
            let targetLat = coordinates?.lat;
            let targetLon = coordinates?.lon;

            // 1. Geocode Fallback (Client-side is fine for this part)
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
                } catch (e) { console.error("Geo fallback failed", e); }
            }

            if (!targetLat) {
                setLoading(false);
                return;
            }

            // 2. Call the Vercel API Route
            // This URL calls the file you just created in the api/ folder
            try {
                const apiUrl = `/api/neighborhood?lat=${targetLat}&lon=${targetLon}`;
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                    const result = await response.json();
                    setData({
                        flood: result.flood,
                        broadband: result.broadband,
                        wildfire: result.wildfire,
                        schools: null
                    });
                } else {
                    console.error("API Route failed:", response.status);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [coordinates, address]);

    return { ...data, loading };
};
