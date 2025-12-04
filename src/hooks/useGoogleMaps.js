// src/hooks/useGoogleMaps.js
import { useEffect, useState } from 'react';
import { googleMapsApiKey } from '../config/constants';

let googleMapsScriptLoadingPromise = null;

const loadGoogleMapsScript = () => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.google && window.google.maps && window.google.maps.places) return Promise.resolve();
    if (googleMapsScriptLoadingPromise) return googleMapsScriptLoadingPromise;

    googleMapsScriptLoadingPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById('googleMapsScript');
        if (existingScript) {
            const checkInterval = setInterval(() => {
                 if (window.google && window.google.maps && window.google.maps.places) {
                     clearInterval(checkInterval);
                     resolve();
                 }
            }, 100);
            return;
        }
        const script = document.createElement('script');
        script.id = 'googleMapsScript';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => {
            googleMapsScriptLoadingPromise = null;
            reject(err);
        };
        document.head.appendChild(script);
    });
    return googleMapsScriptLoadingPromise;
};

export const useGoogleMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;
        loadGoogleMapsScript().then(() => {
            if (mounted) setIsLoaded(true);
        }).catch(err => console.error("Maps load error", err));
        
        return () => { mounted = false; };
    }, []);

    return isLoaded;
};
