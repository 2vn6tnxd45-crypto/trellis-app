// src/hooks/useNeighborhoodData.js
import { useState, useEffect } from 'react';
import { googleMapsApiKey } from '../config/constants';

export const useNeighborhoodData = (coordinates, address) => {
    const [data, setData] = useState({
        wildfire: null,
        census: null,
        climate: null,
        amenities: null
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if ((!coordinates || !coordinates.lat) && (!address || !address.city)) return;

        const fetchData = async () => {
            setLoading(true);
            
            let targetLat = coordinates?.lat;
            let targetLon = coordinates?.lon;

            // 1. Geocode Fallback (if we only have address)
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
                    console.error("Geo fallback failed", e); 
                }
            }

            if (!targetLat) {
                setLoading(false);
                return;
            }

            // 2. Call the Vercel API Route
            try {
                const apiUrl = `/api/neighborhood?lat=${targetLat}&lon=${targetLon}`;
                const response = await fetch(apiUrl);
                
                if (response.ok) {
                    const result = await response.json();
                    setData({
                        wildfire: result.wildfire,
                        census: result.census,
                        climate: result.climate,
                        amenities: result.amenities
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
