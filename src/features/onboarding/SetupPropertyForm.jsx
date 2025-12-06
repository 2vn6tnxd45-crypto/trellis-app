// src/features/onboarding/SetupPropertyForm.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Home, MapPin, Loader2 } from 'lucide-react';
import { googleMapsApiKey } from '../../config/constants';
import { Logo } from '../../components/common/Logo';

export const SetupPropertyForm = ({ onSave, isSaving }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '', placeId: '' });
    const autocompleteRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const loadGoogleMaps = () => {
            if (window.google?.maps?.places) {
                initAutocomplete();
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = initAutocomplete;
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!inputRef.current || autocompleteRef.current) return;
            autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                types: ['address'],
                componentRestrictions: { country: 'us' },
            });
            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current.getPlace();
                if (!place.address_components) return;
                const get = (type) => place.address_components.find(c => c.types.includes(type))?.short_name || '';
                setAddress({
                    street: `${get('street_number')} ${get('route')}`.trim(),
                    city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
                    state: get('administrative_area_level_1'),
                    zip: get('postal_code'),
                    placeId: place.place_id || '',
                });
            });
        };
        loadGoogleMaps();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!address.street) { alert("Please select an address."); return; }
        onSave({ name: name || `${address.street}`, address });
    };

    return (
        <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg">
                <div className="text-center mb-10">
                    <Logo className="h-16 w-16 mx-auto mb-4" />
                    <h1 className="text-3xl font-extrabold text-emerald-950">Set up your Krib</h1>
                    <p className="text-slate-500 mt-2">Tell us about your home to get started.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-xl p-8 border border-emerald-100 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Property Nickname</label>
                        <div className="relative">
                            <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Our First Home, Beach House"
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Property Address *</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Start typing your address..."
                                required
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                            />
                        </div>
                        {address.street && (
                            <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-sm">
                                <p className="font-semibold text-emerald-900">{address.street}</p>
                                <p className="text-emerald-700">{address.city}, {address.state} {address.zip}</p>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                        {isSaving ? <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Creating...</> : 'Create My Krib'}
                    </button>
                </form>
            </div>
        </div>
    );
};
