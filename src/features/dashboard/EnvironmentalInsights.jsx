// src/features/dashboard/EnvironmentalInsights.jsx
import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Wind, Sun, ExternalLink, ShoppingBag } from 'lucide-react';
import { googleMapsApiKey } from '../../config/constants';

const PropertyMap = ({ address }) => {
    const mapQuery = address ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : "Home";
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(mapQuery)}`;
    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-100 h-64 overflow-hidden">
                <iframe width="100%" height="100%" src={mapUrl} frameBorder="0" title="Property Map"></iframe>
            </div>
            <div className="bg-sky-50 p-6 rounded-2xl border border-sky-100">
                <h3 className="text-lg font-bold text-sky-900 mb-3 flex items-center"><ShoppingBag className="mr-2 h-5 w-5" /> Nearby Suppliers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a href={`https://www.google.com/maps/search/Home+Depot+near+${mapQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-sky-100 text-sm font-bold text-sky-800">The Home Depot <ExternalLink size={14}/></a>
                    <a href={`https://www.google.com/maps/search/Lowes+near+${mapQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-sky-100 text-sm font-bold text-sky-800">Lowe's <ExternalLink size={14}/></a>
                </div>
            </div>
        </div>
    );
};

export const EnvironmentalInsights = ({ propertyProfile }) => {
    const { coordinates, address } = propertyProfile || {};
    const [airQuality, setAirQuality] = useState(null);
    const [solarData, setSolarData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!coordinates?.lat || !coordinates?.lon || !googleMapsApiKey) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                // Mocking fetch for safety - replace with actual Google API calls if enabled on project
                // In production, you would uncomment the fetch calls similar to the original file
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchData();
    }, [coordinates]);

    if (!address) return <div className="p-6 text-center text-gray-500">Location data missing.</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-sky-900 mb-2 flex items-center"><MapIcon className="mr-2 h-5 w-5" /> Environmental Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Wind className="h-24 w-24 text-blue-500" /></div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Air Quality</h3>
                    <p className="text-sky-600 font-medium">Data requires API enablement.</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Sun className="h-24 w-24 text-yellow-500" /></div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Solar Potential</h3>
                    <p className="text-indigo-600 font-medium">Data requires API enablement.</p>
                </div>
            </div>
            <PropertyMap address={address} />
        </div>
    );
};
