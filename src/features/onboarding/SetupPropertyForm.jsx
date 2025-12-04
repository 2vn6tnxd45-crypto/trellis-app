// src/features/onboarding/SetupPropertyForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { LogOut, MapPin } from 'lucide-react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { Logo } from '../../components/common/Logo';

export const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => {
    const [formData, setFormData] = useState({ propertyName: '', streetAddress: '', city: '', state: '', zip: '', lat: null, lon: null, yearBuilt: '', sqFt: '', lotSize: '' });
    const inputRef = useRef(null);
    const mapsLoaded = useGoogleMaps(); // Use our new hook!

    useEffect(() => {
        if (mapsLoaded && inputRef.current && window.google && window.google.maps && window.google.maps.places) {
            try {
                const auto = new window.google.maps.places.Autocomplete(inputRef.current, { types: ['address'], fields: ['address_components', 'geometry', 'formatted_address'] });
                inputRef.current.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
                auto.addListener('place_changed', () => {
                    const place = auto.getPlace();
                    if (!place.geometry) return;
                    let streetNum = '', route = '', city = '', state = '', zip = '';
                    if (place.address_components) {
                        place.address_components.forEach(comp => {
                            if (comp.types.includes('street_number')) streetNum = comp.long_name;
                            if (comp.types.includes('route')) route = comp.long_name;
                            if (comp.types.includes('locality')) city = comp.long_name;
                            if (comp.types.includes('administrative_area_level_1')) state = comp.short_name;
                            if (comp.types.includes('postal_code')) zip = comp.long_name;
                        });
                    }
                    setFormData(prev => ({ ...prev, streetAddress: `${streetNum} ${route}`.trim(), city, state, zip, lat: place.geometry.location.lat(), lon: place.geometry.location.lng() }));
                    if (inputRef.current) inputRef.current.value = `${streetNum} ${route}`.trim();
                });
            } catch (e) {
                console.warn("Google Auto fail", e);
            }
        }
    }, [mapsLoaded]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formDataObj = new FormData(e.target);
        if (inputRef.current) formDataObj.set('streetAddress', inputRef.current.value);
        onSave(formDataObj);
    };

    return (
        <div className="flex items-center justify-center min-h-[90vh] print:hidden">
            <div className="max-w-lg w-full bg-white p-10 rounded-3xl shadow-2xl shadow-sky-100 border border-sky-100 text-center relative">
                <button onClick={onSignOut} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 flex items-center text-xs font-bold uppercase tracking-wider transition-colors"><LogOut size={14} className="mr-1" /> Sign Out</button>
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="h-20 w-20 shadow-md rounded-2xl mb-4 bg-sky-50 p-2 flex items-center justify-center">
                         <Logo className="h-16 w-16" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-sky-900 mb-1">Property Setup</h2>
                    <p className="text-sky-500/80 font-medium">Let's get your home logged.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6 text-left relative">
                    <div>
                        <label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Property Nickname</label>
                        <input type="text" name="propertyName" value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border focus:ring-sky-500 focus:bg-white transition-all" />
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Street Address</label>
                        <div className="relative"><MapPin className="absolute left-3.5 top-3.5 text-sky-400" size={18} /><input ref={inputRef} type="text" name="streetAddress" defaultValue={formData.streetAddress} autoComplete="new-password" placeholder="Start typing address..." className="block w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 pl-10 border focus:ring-sky-500 focus:bg-white transition-all" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">City</label><input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border" /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">State</label><input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border" /></div>
                            <div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Zip</label><input type="text" name="zip" value={formData.zip} onChange={handleChange} className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border" /></div>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-gray-100">
                        <p className="text-xs text-sky-400 font-bold uppercase tracking-widest mb-4">Details (Optional)</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Year Built</label><input type="number" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} className="w-full rounded-xl border-gray-200 p-2.5 border text-sm" /></div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sq Ft</label><input type="number" name="sqFt" value={formData.sqFt} onChange={handleChange} className="w-full rounded-xl border-gray-200 p-2.5 border text-sm" /></div>
                            <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lot Size</label><input type="text" name="lotSize" value={formData.lotSize} onChange={handleChange} className="w-full rounded-xl border-gray-200 p-2.5 border text-sm" /></div>
                        </div>
                    </div>
                    <input type="hidden" name="lat" value={formData.lat || ''} /><input type="hidden" name="lon" value={formData.lon || ''} />
                    <button type="submit" disabled={isSaving} className="w-full py-4 px-6 rounded-xl shadow-lg shadow-sky-900/20 text-white bg-sky-900 hover:bg-sky-800 font-bold text-lg disabled:opacity-70 transition-transform active:scale-[0.98]">{isSaving ? 'Saving...' : 'Create My Home Log'}</button>
                </form>
            </div>
        </div>
    );
};
