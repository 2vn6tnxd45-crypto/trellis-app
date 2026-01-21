// src/features/onboarding/SetupPropertyForm.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Home, MapPin, Loader2, LogOut, ClipboardList, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { googleMapsApiKey, appId } from '../../config/constants';
import { Logo } from '../../components/common/Logo';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAuth } from 'firebase/auth';

export const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => {
    const [name, setName] = useState('');
    const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '', placeId: '' });
    const [coordinates, setCoordinates] = useState(null);
    const [debugInfo, setDebugInfo] = useState(''); // For debugging
    const [pendingEvaluations, setPendingEvaluations] = useState([]);
    const [addressInputValue, setAddressInputValue] = useState(''); // Track manual input
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [showAddressHint, setShowAddressHint] = useState(false);
    const autocompleteRef = useRef(null);
    const inputRef = useRef(null);

    // Fetch pending evaluations for this user
    useEffect(() => {
        const fetchPendingEvaluations = async () => {
            try {
                const auth = getAuth();
                const user = auth.currentUser;
                if (!user) return;

                const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);

                if (profileSnap.exists()) {
                    const profile = profileSnap.data();
                    const evals = profile.pendingEvaluations || [];
                    // Filter out completed evaluations
                    const pending = evals.filter(e => e.status !== 'quote_received' && e.status !== 'completed');
                    setPendingEvaluations(pending);
                }
            } catch (err) {
                console.error('Error fetching pending evaluations:', err);
            }
        };

        fetchPendingEvaluations();
    }, []);

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
            script.onerror = () => {
                console.error('Failed to load Google Maps');
                setDebugInfo('Google Maps failed to load');
            };
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!inputRef.current || autocompleteRef.current) return;
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'],
                    componentRestrictions: { country: 'us' },
                });
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (!place.address_components) return;

                    // Hide hint and show success
                    setShowAddressHint(false);

                    // Capture Coordinates
                    if (place.geometry && place.geometry.location) {
                        setCoordinates({
                            lat: place.geometry.location.lat(),
                            lon: place.geometry.location.lng()
                        });
                    }

                    const get = (type) => place.address_components.find(c => c.types.includes(type))?.short_name || '';
                    const newAddress = {
                        street: `${get('street_number')} ${get('route')}`.trim(),
                        city: get('locality') || get('sublocality') || get('administrative_area_level_2'),
                        state: get('administrative_area_level_1'),
                        zip: get('postal_code'),
                        placeId: place.place_id || '',
                    };
                    setAddress(newAddress);
                    // Update input value to show selected address
                    setAddressInputValue(place.formatted_address || `${newAddress.street}, ${newAddress.city}, ${newAddress.state}`);
                });
            } catch (err) {
                console.error('Autocomplete init error:', err);
                setDebugInfo('Autocomplete failed: ' + err.message);
            }
        };
        loadGoogleMaps();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // ✅ DEBUG: Log what's happening
        console.log('[SetupPropertyForm] handleSubmit called');
        console.log('[SetupPropertyForm] address:', address);
        console.log('[SetupPropertyForm] name:', name);
        console.log('[SetupPropertyForm] onSave exists:', typeof onSave === 'function');
        console.log('[SetupPropertyForm] isSaving:', isSaving);
        
        if (!address.street) { 
            alert("Please select an address from the dropdown suggestions."); 
            return; 
        }
        
        // ✅ FIX: Check if onSave is actually a function
        if (typeof onSave !== 'function') {
            console.error('[SetupPropertyForm] onSave is not a function!', onSave);
            alert('Error: Save handler not configured. Please refresh the page.');
            return;
        }
        
        // ✅ DEBUG: Log before calling onSave
        const formData = { 
            name: name || address.street, 
            address, 
            coordinates 
        };
        console.log('[SetupPropertyForm] Calling onSave with:', formData);
        
        // Call the save function
        onSave(formData);
    };

    return (
        <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6">
            {/* ✅ FIX: Add Sign Out button in top corner */}
            {onSignOut && (
                <button
                    onClick={onSignOut}
                    className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-red-600 transition-colors shadow-sm"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            )}
            
            <div className="w-full max-w-lg">
                {/* Pending Evaluations Alert */}
                {pendingEvaluations.length > 0 && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-amber-900">You have pending evaluation requests!</h2>
                                <p className="text-sm text-amber-700">
                                    Complete your property setup to view and respond to these requests.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {pendingEvaluations.slice(0, 3).map((evalItem, index) => (
                                <div key={evalItem.evaluationId || index} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 truncate">
                                            {evalItem.jobDescription || 'Service Request'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            From: {evalItem.contractorName || 'Contractor'}
                                        </p>
                                    </div>
                                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium shrink-0 ml-2">
                                        <Clock className="h-3 w-3" />
                                        Awaiting
                                    </span>
                                </div>
                            ))}
                            {pendingEvaluations.length > 3 && (
                                <p className="text-xs text-amber-600 text-center font-medium">
                                    +{pendingEvaluations.length - 3} more pending
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="text-center mb-10">
                    <Logo className="h-16 w-16 mx-auto mb-4" />
                    <h1 className="text-3xl font-extrabold text-emerald-950">Set up your Krib</h1>
                    <p className="text-slate-500 mt-2">Tell us about your home to get started.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-xl p-8 border border-emerald-100 space-y-6">
                    {/* REMOVED: ReportTeaser was here */}

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
                        <label htmlFor="property-address" className="block text-sm font-bold text-slate-700 mb-2">
                            Property Address *
                        </label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                            <input
                                ref={inputRef}
                                id="property-address"
                                type="text"
                                placeholder="Start typing your address..."
                                required
                                data-testid="property-address-input"
                                aria-describedby="address-hint"
                                value={addressInputValue}
                                onChange={(e) => {
                                    setAddressInputValue(e.target.value);
                                    // Clear address if user edits after selection
                                    if (address.street) {
                                        setAddress({ street: '', city: '', state: '', zip: '', placeId: '' });
                                    }
                                    // Show hint after typing a few characters
                                    if (e.target.value.length > 3 && !address.street) {
                                        setShowAddressHint(true);
                                    }
                                }}
                                onFocus={() => {
                                    if (addressInputValue.length > 3 && !address.street) {
                                        setShowAddressHint(true);
                                    }
                                }}
                                onBlur={() => {
                                    // Delay hiding hint to allow clicking suggestions
                                    setTimeout(() => setShowAddressHint(false), 200);
                                }}
                                className={`w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-colors ${
                                    address.street
                                        ? 'border-emerald-300 bg-emerald-50/50'
                                        : 'border-slate-200'
                                }`}
                            />
                            {/* Loading indicator */}
                            {isLoadingSuggestions && (
                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                            )}
                            {/* Success checkmark when address is selected */}
                            {address.street && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Hint to select from dropdown */}
                        {showAddressHint && !address.street && (
                            <p id="address-hint" className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Please select an address from the dropdown suggestions
                            </p>
                        )}

                        {/* Selected address confirmation */}
                        {address.street && (
                            <div className="mt-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-emerald-100 rounded-lg shrink-0">
                                        <MapPin className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-emerald-900">{address.street}</p>
                                        <p className="text-emerald-700">{address.city}, {address.state} {address.zip}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving || !address.street}
                        data-testid="setup-property-submit"
                        className={`w-full py-4 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center ${
                            address.street
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        } disabled:opacity-50`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                Creating...
                            </>
                        ) : !address.street ? (
                            'Select an address to continue'
                        ) : (
                            'Kreate My Krib'
                        )}
                    </button>
                    
                    {/* ✅ DEBUG: Show debug info in development */}
                    {debugInfo && (
                        <p className="text-xs text-red-500 text-center mt-2">{debugInfo}</p>
                    )}
                </form>
                
                {/* ✅ DEBUG: Status indicator */}
                <div className="mt-4 text-center text-xs text-slate-400">
                    {address.street ? '✓ Address selected' : '○ Select an address from dropdown'}
                    {' • '}
                    {typeof onSave === 'function' ? '✓ Save handler ready' : '✗ Save handler missing'}
                </div>
            </div>
        </div>
    );
};
