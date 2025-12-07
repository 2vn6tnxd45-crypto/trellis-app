// src/features/dashboard/EnvironmentalInsights.jsx
import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Wind, Sun, ExternalLink, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { googleMapsApiKey } from '../../config/constants';
import { NeighborhoodData } from './NeighborhoodData'; // NEW IMPORT

const PropertyMap = ({ address }) => {
    const mapQuery = address ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : "Home";
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(mapQuery)}`;

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 h-64 overflow-hidden">
                <iframe 
                    width="100%" 
                    height="100%" 
                    src={mapUrl} 
                    frameBorder="0" 
                    title="Property Map"
                    allowFullScreen
                    loading="lazy"
                ></iframe>
            </div>
            {/* REMOVED NEARBY SUPPLIERS SECTION HERE */}
        </div>
    );
};

export const EnvironmentalInsights = ({ propertyProfile }) => {
    const { coordinates, address } = propertyProfile || {};
    const [airQuality, setAirQuality] = useState(null);
    const [solarData, setSolarData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!coordinates?.lat || !coordinates?.lon || !googleMapsApiKey) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const aqRes = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleMapsApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: { latitude: coordinates.lat, longitude: coordinates.lon } })
                });
                
                if (aqRes.ok) {
                    const aqData = await aqRes.json();
                    setAirQuality(aqData.indexes?.[0]); 
                }

                const solarRes = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${coordinates.lat}&location.longitude=${coordinates.lon}&requiredQuality=HIGH&key=${googleMapsApiKey}`);
                
                if (solarRes.ok) {
                    const solarData = await solarRes.json();
                    setSolarData(solarData.solarPotential);
                }

            } catch (err) { 
                console.error("Env Data Error:", err);
                setError("Could not load some environmental data.");
            } finally { 
                setLoading(false); 
            }
        };
        fetchData();
    }, [coordinates]);

    if (!address) return <div className="p-6 text-center text-gray-500">Location data missing.</div>;

    const getAqiColor = (aqiCode) => {
        if (!aqiCode) return 'text-gray-500';
        if (aqiCode === 'uq') return 'text-purple-600'; 
        const code = aqiCode.toLowerCase();
        if (['good', 'low'].includes(code)) return 'text-emerald-600'; 
        if (['moderate', 'medium'].includes(code)) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <h2 className="text-xl font-bold text-emerald-900 mb-2 flex items-center">
                <MapIcon className="mr-2 h-5 w-5" /> Location Intelligence
            </h2>
            
            <PropertyMap address={address} />

            {/* Environmental Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Air Quality Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wind className="h-24 w-24 text-blue-500" /></div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Air Quality (AQI)</h3>
                    
                    {loading ? <Loader2 className="animate-spin text-emerald-500"/> : airQuality ? (
                        <div>
                            <p className={`text-4xl font-extrabold ${getAqiColor(airQuality.category)}`}>
                                {airQuality.aqi || '--'}
                            </p>
                            <p className="text-slate-500 font-medium mt-1">{airQuality.category || 'Unknown'}</p>
                            <p className="text-xs text-slate-400 mt-2">Source: Google Air Quality API</p>
                        </div>
                    ) : (
                        <p className="text-slate-400 text-sm flex items-center"><AlertCircle size={14} className="mr-1"/> Data unavailable</p>
                    )}
                </div>

                {/* Solar Potential Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Sun className="h-24 w-24 text-yellow-500" /></div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Solar Potential</h3>
                    
                    {loading ? <Loader2 className="animate-spin text-indigo-500"/> : solarData ? (
                        <div>
                            <p className="text-4xl font-extrabold text-indigo-900">
                                {solarData.maxSunshineHoursPerYear ? Math.round(solarData.maxSunshineHoursPerYear) : '--'}
                            </p>
                            <p className="text-indigo-600 font-medium mt-1">Sunshine Hours / Year</p>
                            <p className="text-xs text-slate-400 mt-2">Panels Capacity: {solarData.maxArrayPanelsCount || 0} units</p>
                        </div>
                    ) : (
                         <p className="text-slate-400 text-sm flex items-center"><AlertCircle size={14} className="mr-1"/> Data unavailable</p>
                    )}
                </div>
            </div>
            
            {/* NEW: Neighborhood Data Integration */}
            <NeighborhoodData propertyProfile={propertyProfile} />
        </div>
    );
};
