import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    GoogleAuthProvider, OAuthProvider, signInWithPopup
} from 'firebase/auth';
import { 
    getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, 
    doc, deleteDoc, setLogLevel, setDoc, getDoc
} from 'firebase/firestore';
import { Trash2, PlusCircle, Home, Calendar, PaintBucket, HardHat, Info, FileText, ExternalLink, Camera, MapPin, Search, LogOut, Lock, Mail, ChevronDown, Hash, Layers, X, Printer, Map as MapIcon, ShoppingBag, Sun, Wind, Zap, AlertTriangle } from 'lucide-react';

// --- Global Config ---

const appId = 'trellis-home-log'; 

// YOUR KEYS (Hardcoded for Production Stability)
const firebaseConfig = {
  apiKey: "AIzaSyCS2JMaEpI_npBXkHjhjOk10ffZVg5ypaI",
  authDomain: "trellis-6cd18.firebaseapp.com",
  projectId: "trellis-6cd18",
  storageBucket: "trellis-6cd18.firebasestorage.app",
  messagingSenderId: "669423260428",
  appId: "1:669423260428:web:64a5452413682c257cef29",
  measurementId: "G-JBP9F27RN1"
};

const googleMapsApiKey = "AIzaSyC_hvAtqVO3GIWSFwRiQi5tQZppekkbRVM"; 
const PUBLIC_COLLECTION_PATH = `/artifacts/${appId}/public/data/house_records`;

// --- Helper: Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 min-h-screen flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
          <h1 className="text-2xl font-bold text-red-800 mb-2">Something went wrong.</h1>
          <p className="text-red-600 mb-4">The application encountered a critical error.</p>
          <div className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-lg w-full">
            <code className="text-xs text-red-500 font-mono">{this.state.error?.toString()}</code>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// --- Helper: Safe Logo ---
const logoSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="20" fill="white"/>
  <defs>
    <path id="h" d="M50 12L88 45V88H12V45L50 12Z" />
    <clipPath id="c"><use href="#h"/></clipPath>
  </defs>
  <use href="#h" fill="#2A2A72"/>
  <rect x="20" y="28" width="8" height="12" fill="#2A2A72"/>
  <g clip-path="url(#c)" stroke="white" stroke-width="5" stroke-linecap="round">
    <path d="M-10 70L70 -10"/><path d="M10 90L90 10"/><path d="M30 110L110 30"/>
    <path d="M110 70L30 -10"/><path d="M90 90L10 10"/><path d="M70 110L-10 30"/>
  </g>
  <use href="#h" stroke="#2A2A72" stroke-width="4" fill="none"/>
</svg>
`;
const logoSrc = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvgString)}`;

// Brand Icons
const GoogleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>);
const AppleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.74-3.12 1.84-2.6 5.75.64 7.13-.5 1.24-1.14 2.47-2.69 4.14zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.54 4.33-3.74 4.25z" /></svg>);

// --- Helper Functions ---

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Helper: Load Google Maps Script Robustly (Promise-based)
const loadGoogleMapsScript = (key) => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return resolve();
        if (window.google && window.google.maps && window.google.maps.places) {
            return resolve();
        }
        
        const scriptId = 'google-maps-script-loader';
        if (document.getElementById(scriptId)) {
            // Script already loading, poll for readiness
            const checkInterval = setInterval(() => {
                 if (window.google && window.google.maps && window.google.maps.places) {
                     clearInterval(checkInterval);
                     resolve();
                 }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
    });
};

// --- CATEGORY & ROOM DEFINITIONS ---

const CATEGORIES = [
    "Paint & Finishes", "Appliances", "Flooring", "HVAC & Systems", "Plumbing",
    "Electrical", "Roof & Exterior", "Landscaping", "Service & Repairs", "Other"
];

const ROOMS = [
    "Kitchen", "Living Room", "Dining Room", "Master Bedroom", "Bedroom", "Master Bathroom",
    "Bathroom", "Office", "Laundry Room", "Garage", "Basement", "Attic", "Exterior",
    "Hallway", "Entryway", "Patio/Deck", "Other (Custom)"
];

const PAINT_SHEENS = ["Flat/Matte", "Eggshell", "Satin", "Semi-Gloss", "High-Gloss", "Exterior"];
const ROOF_MATERIALS = ["Asphalt Shingles", "Metal", "Clay/Concrete Tile", "Slate", "Wood Shake", "Composite", "Other"];
const FLOORING_TYPES = ["Hardwood", "Laminate", "Vinyl/LVP", "Tile", "Carpet", "Concrete", "Other"];

const initialRecordState = {
    area: '', category: '', item: '', brand: '', model: '', serialNumber: '', 
    material: '', sheen: '', dateInstalled: '', contractor: '', contractorUrl: '',
    notes: '', purchaseLink: '', imageUrl: '',
};

// --- Components ---

const CustomConfirm = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Confirm Action</h3>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex justify-end space-x-3">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
        </div>
    </div>
);

const AuthScreen = ({ onLogin, onGoogleLogin, onAppleLogin, onGuestLogin, error: authError }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('email')) { setEmail(params.get('email')); setIsSignUp(true); }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null); setIsLoading(true);
        try { await onLogin(email, password, isSignUp); } catch (err) { setLocalError(err.message); setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans print:hidden">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <img className="mx-auto h-24 w-24 rounded-xl shadow-md bg-white p-1" src={logoSrc} alt="Trellis" />
                <h2 className="mt-6 text-3xl font-extrabold text-indigo-900">{isSignUp ? 'Create your Pedigree' : 'Sign in to Trellis'}</h2>
                <p className="mt-2 text-sm text-gray-600">The permanent record for your home.</p>
            </div>
            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10 border border-indigo-50">
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button onClick={onGoogleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            <span className="mr-2"><GoogleIcon /></span> Google
                        </button>
                        <button onClick={onAppleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            <span className="mr-2"><AppleIcon /></span> Apple
                        </button>
                    </div>
                    <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with email</span></div></div>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div><label className="block text-sm font-medium text-gray-700">Email</label><div className="mt-1 relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={16} className="text-gray-400" /></div><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border" placeholder="you@example.com"/></div></div>
                        <div><label className="block text-sm font-medium text-gray-700">Password</label><div className="mt-1 relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={16} className="text-gray-400" /></div><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border" placeholder="••••••••"/></div></div>
                        {(localError || authError) && <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-100">{localError || authError}</div>}
                        <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}</button>
                    </form>
                    <div className="mt-6 text-center"><button onClick={onGuestLogin} className="text-xs font-medium text-gray-400 hover:text-gray-600 underline">Try as a Guest</button></div>
                    <div className="mt-6 text-center border-t pt-4"><button onClick={() => { setIsSignUp(!isSignUp); setLocalError(null); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">{isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}</button></div>
                </div>
            </div>
        </div>
    );
};

// Clean Sheet Setup Form: No Photon, Pure Google Maps, Simplified Logic
const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => {
    const [formData, setFormData] = useState({
        propertyName: '', streetAddress: '', city: '', state: '', zip: '', lat: null, lon: null, yearBuilt: '', sqFt: '', lotSize: ''
    });
    const inputRef = useRef(null);

    // Initialize Google Autocomplete cleanly
    useEffect(() => {
        let autocomplete = null;
        
        loadGoogleMapsScript(googleMapsApiKey).then(() => {
             if (inputRef.current && window.google) {
                try {
                    autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
                        types: ['address'],
                        fields: ['address_components', 'geometry', 'formatted_address']
                    });
                    
                    autocomplete.addListener('place_changed', () => {
                        const place = autocomplete.getPlace();
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

                        // Important: Update state with new values. 
                        // This triggers re-render, but since we aren't binding 'value' strictly while typing, it won't freeze.
                        setFormData(prev => ({
                            ...prev,
                            streetAddress: `${streetNum} ${route}`.trim(),
                            city, state, zip,
                            lat: place.geometry.location.lat(),
                            lon: place.geometry.location.lng()
                        }));
                    });
                } catch (e) {
                    console.warn("Google Maps Auto Init Error", e);
                }
             }
        }).catch(err => console.error(err));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="flex items-center justify-center min-h-[90vh] print:hidden">
            <div className="max-w-lg w-full bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-indigo-600 text-center relative">
                <button onClick={onSignOut} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 flex items-center text-xs font-medium"><LogOut size={14} className="mr-1" /> Sign Out</button>
                <div className="flex justify-center mb-6"><img src={logoSrc} alt="Trellis Logo" className="h-24 w-24 shadow-md rounded-xl" /></div>
                <h2 className="text-3xl font-extrabold text-indigo-900 mb-2">Property Setup</h2>
                <p className="text-gray-500 mb-6 leading-relaxed text-sm">Start typing your address.</p>
                <form onSubmit={onSave} className="space-y-5 text-left relative">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nickname</label><input type="text" name="propertyName" required value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div>
                    
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Street Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} />
                            {/* Note: 'defaultValue' used instead of 'value' to prevent fighting with Google Maps during typing */}
                            <input 
                                ref={inputRef} 
                                type="text" 
                                name="streetAddress" 
                                required 
                                defaultValue={formData.streetAddress}
                                onChange={handleChange} 
                                placeholder="Start typing address..." 
                                className="w-full rounded-lg border-gray-300 shadow-sm p-3 pl-10 border"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">City</label><input type="text" name="city" required value={formData.city} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">State</label><input type="text" name="state" required value={formData.state} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Zip</label><input type="text" name="zip" required value={formData.zip} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div></div></div>
                    <div className="pt-4 border-t border-gray-100"><p className="text-xs text-indigo-600 font-semibold mb-3">Details (Optional)</p><div className="grid grid-cols-3 gap-3"><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Year Built</label><input type="number" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sq Ft</label><input type="number" name="sqFt" value={formData.sqFt} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lot Size</label><input type="text" name="lotSize" value={formData.lotSize} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div></div></div>
                    <input type="hidden" name="lat" value={formData.lat || ''} /><input type="hidden" name="lon" value={formData.lon || ''} />
                    <button type="submit" disabled={isSaving} className="w-full py-3 px-4 rounded-lg shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-lg disabled:opacity-70">{isSaving ? 'Saving...' : 'Create My Home Log'}</button>
                </form>
            </div>
        </div>
    );
};

const EnvironmentalInsights = ({ propertyProfile }) => {
    const { coordinates } = propertyProfile || {};
    const [airQuality, setAirQuality] = useState(null);
    const [solarData, setSolarData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!coordinates?.lat || !coordinates?.lon || !googleMapsApiKey) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                // Air Quality API
                const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleMapsApiKey}`;
                const aqRes = await fetch(aqUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: { latitude: coordinates.lat, longitude: coordinates.lon } }) });
                if(aqRes.ok) {
                     const aqData = await aqRes.json();
                     if (aqData.indexes?.[0]) setAirQuality(aqData.indexes[0]);
                }

                // Solar API
                const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${coordinates.lat}&location.longitude=${coordinates.lon}&requiredQuality=HIGH&key=${googleMapsApiKey}`;
                const solarRes = await fetch(solarUrl);
                if (solarRes.ok) setSolarData(await solarRes.json());
                
            } catch (err) { console.error("Env fetch failed", err); } finally { setLoading(false); }
        };
        fetchData();
    }, [coordinates]);

    if (!coordinates?.lat) return <div className="p-6 text-center text-gray-500">Location data missing.</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-indigo-900 mb-2 flex items-center"><MapIcon className="mr-2 h-5 w-5" /> Environmental Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10"><Wind className="h-24 w-24 text-blue-500" /></div>
                     <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Air Quality</h3>
                     {loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (airQuality ? (<div><div className="flex items-baseline"><span className="text-4xl font-extrabold text-gray-900">{airQuality.aqi}</span><span className="ml-2 text-sm font-medium text-gray-500">US AQI</span></div><p className="text-indigo-600 font-medium mt-1">{airQuality.category}</p></div>) : <p className="text-gray-500 text-sm">Data unavailable.</p>)}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10"><Sun className="h-24 w-24 text-yellow-500" /></div>
                     <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Solar Potential</h3>
                     {loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (solarData ? (<div><div className="flex items-baseline"><span className="text-4xl font-extrabold text-gray-900">{Math.round(solarData.solarPotential.maxSunshineHoursPerYear)}</span><span className="ml-2 text-sm font-medium text-gray-500">Sun Hours/Year</span></div></div>) : <p className="text-gray-500 text-sm">Data unavailable.</p>)}
                </div>
            </div>
            <PropertyMap propertyProfile={propertyProfile} />
        </div>
    );
};

const PropertyMap = ({ propertyProfile }) => {
    const address = propertyProfile?.address;
    const mapQuery = address ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : propertyProfile?.name || "Home";
    const encodedQuery = encodeURIComponent(mapQuery);
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodedQuery}`;

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                <div className="w-full h-64 bg-gray-100 rounded-xl overflow-hidden relative">
                     <iframe width="100%" height="100%" src={mapUrl} frameBorder="0" scrolling="no" title="Property Map" className="absolute inset-0"></iframe>
                </div>
            </div>
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center"><ShoppingBag className="mr-2 h-5 w-5" /> Nearby Suppliers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a href={`https://www.google.com/maps/search/Home+Depot+near+${encodedQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">The Home Depot <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600"/></a>
                    <a href={`https://www.google.com/maps/search/Lowe's+near+${encodedQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">Lowe's <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600"/></a>
                </div>
            </div>
        </div>
    );
};

const RecordCard = ({ record, onDeleteClick }) => (
    <div className="bg-white p-0 rounded-xl shadow-sm border border-indigo-100 transition-all hover:shadow-lg flex flex-col overflow-hidden break-inside-avoid">
        {record.imageUrl && <div className="h-48 w-full bg-gray-100 relative group print:h-32"><img src={record.imageUrl} alt={record.item} className="w-full h-full object-cover"/></div>}
        <div className="p-5 flex flex-col space-y-3 flex-grow">
            <div className="flex justify-between items-start border-b border-indigo-50 pb-2"><div className="font-bold text-xl text-indigo-800 leading-tight">{record.item}</div><button onClick={() => onDeleteClick(record.id)} className="p-1 text-red-500 hover:text-red-700 ml-2 print:hidden"><Trash2 size={20} /></button></div>
            <div className="text-sm space-y-2">
                <p className="flex items-center text-gray-700 font-medium"><Home size={16} className="mr-3 text-indigo-500 min-w-[16px]" /> {record.area} / {record.category}</p>
                {record.brand && <p className="flex items-center text-gray-600"><PaintBucket size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.category === 'Paint & Finishes' ? 'Brand' : 'Make'}: {record.brand}</p>}
                {record.model && <p className="flex items-center text-gray-600"><Info size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.category === 'Paint & Finishes' ? 'Color' : 'Model'}: {record.model}</p>}
                {record.sheen && <p className="flex items-center text-gray-600"><Layers size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Sheen: {record.sheen}</p>}
                {record.serialNumber && <p className="flex items-center text-gray-600"><Hash size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Serial #: {record.serialNumber}</p>}
                {record.material && <p className="flex items-center text-gray-600"><Info size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Material: {record.material}</p>}
                {record.dateInstalled && <p className="flex items-center text-gray-600"><Calendar size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.dateInstalled}</p>}
                {record.contractor && <p className="flex items-center text-gray-600"><HardHat size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.contractorUrl ? <a href={record.contractorUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1 print:no-underline print:text-gray-800">{record.contractor} <ExternalLink size={12} className="inline print:hidden"/></a> : record.contractor}</p>}
                {record.purchaseLink && <a href={record.purchaseLink} target="_blank" rel="noreferrer" className="flex items-center text-indigo-600 hover:underline print:hidden"><ExternalLink size={16} className="mr-3" /> Replacement Link</a>}
                {record.notes && <div className="mt-2 pt-3 border-t border-indigo-50 text-gray-500 text-xs italic bg-gray-50 p-2 rounded">{record.notes}</div>}
            </div>
            <div className="text-xs text-gray-400 pt-2 mt-auto text-right">Logged: {record.timestamp && typeof record.timestamp.toDate === 'function' ? record.timestamp.toDate().toLocaleDateString() : 'Just now'}</div>
        </div>
    </div>
);

const AddRecordForm = ({ onSave, isSaving, newRecord, onInputChange, onFileChange }) => {
    const showSheen = newRecord.category === "Paint & Finishes";
    const showMaterial = ["Roof & Exterior", "Flooring"].includes(newRecord.category);
    const showSerial = ["Appliances", "HVAC & Systems", "Plumbing", "Electrical"].includes(newRecord.category);
    const [isCustomArea, setIsCustomArea] = useState(false);
    useEffect(() => { if (newRecord.area && !ROOMS.includes(newRecord.area)) setIsCustomArea(true); }, [newRecord.area]);
    const handleRoomChange = (e) => { if (e.target.value === "Other (Custom)") { setIsCustomArea(true); onInputChange({ target: { name: 'area', value: '' } }); } else { setIsCustomArea(false); onInputChange(e); } };
    let brandLabel = "Brand"; let modelLabel = "Model/Color Code";
    if (newRecord.category === "Paint & Finishes") { brandLabel = "Paint Brand"; modelLabel = "Color Name/Code"; }
    else if (newRecord.category === "Appliances") { brandLabel = "Manufacturer"; modelLabel = "Model Number"; }

    return (
        <form onSubmit={onSave} className="p-6 bg-white rounded-xl shadow-2xl border-t-4 border-indigo-600 space-y-4">
            <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b pb-2">Record New Home Data</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Category *</label>
                    <div className="relative mt-1"><select name="category" value={newRecord.category} onChange={onInputChange} required className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Area/Room *</label>
                    {!isCustomArea ? (
                        <div className="relative mt-1"><select name="area" value={ROOMS.includes(newRecord.area) ? newRecord.area : ""} onChange={handleRoomChange} required className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{ROOMS.map(r => <option key={r} value={r}>{r}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div>
                    ) : (
                        <div className="relative mt-1 flex"><input type="text" name="area" value={newRecord.area} onChange={onInputChange} required autoFocus placeholder="e.g. Guest House" className="block w-full rounded-l-lg border-gray-300 shadow-sm p-2 border"/><button type="button" onClick={() => {setIsCustomArea(false); onInputChange({target:{name:'area', value:''}})}} className="px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg"><X size={18}/></button></div>
                    )}
                </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700">Item Name *</label><input type="text" name="item" value={newRecord.item} onChange={onInputChange} required placeholder="e.g. North Wall" className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div><label className="block text-sm font-medium text-gray-700">{brandLabel}</label><input type="text" name="brand" value={newRecord.brand} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>
                <div><label className="block text-sm font-medium text-gray-700">{modelLabel}</label><input type="text" name="model" value={newRecord.model} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>
                {showSheen && <div><label className="block text-sm font-medium text-gray-700">Sheen</label><div className="relative mt-1"><select name="sheen" value={newRecord.sheen} onChange={onInputChange} className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{PAINT_SHEENS.map(s => <option key={s} value={s}>{s}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div></div>}
                {showSerial && <div><label className="block text-sm font-medium text-gray-700">Serial #</label><input type="text" name="serialNumber" value={newRecord.serialNumber} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>}
                {showMaterial && <div><label className="block text-sm font-medium text-gray-700">Material</label><div className="relative mt-1"><select name="material" value={newRecord.material} onChange={onInputChange} className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{(newRecord.category==="Roof & Exterior"?ROOF_MATERIALS:FLOORING_TYPES).map(m=><option key={m} value={m}>{m}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div></div>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Date Installed</label><input type="date" name="dateInstalled" value={newRecord.dateInstalled} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>
                <div className="space-y-2">
                    <div><label className="block text-sm font-medium text-gray-700">Contractor</label><input type="text" name="contractor" value={newRecord.contractor} onChange={onInputChange} placeholder="Company Name" className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>
                    <div><label className="block text-xs font-medium text-gray-500">Profile URL</label><input type="url" name="contractorUrl" value={newRecord.contractorUrl} onChange={onInputChange} placeholder="https://..." className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div>
                </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700">Product Link</label><input type="url" name="purchaseLink" value={newRecord.purchaseLink} onChange={onInputChange} placeholder="https://..." className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100"><label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center"><Camera size={18} className="mr-2"/> Upload Photo</label><input type="file" accept="image/*" onChange={onFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"/><p className="text-xs text-gray-500 mt-1">Max 1MB</p></div>
            <div><label className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" rows="3" value={newRecord.notes} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border resize-none"></textarea></div>
            <button type="submit" disabled={isSaving} className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{isSaving ? 'Saving...' : <><PlusCircle size={20} className="mr-2"/> Log New Home Component</>}</button>
        </form>
    );
};

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [propertyProfile, setPropertyProfile] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [records, setRecords] = useState([]);
    const [newRecord, setNewRecord] = useState(initialRecordState);
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('View Records');
    const [confirmDelete, setConfirmDelete] = useState(null);

    useEffect(() => {
        if (firebaseConfig) {
            try {
                const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);
                setLogLevel('error');
                setDb(firestore);
                setAuth(firebaseAuth);
                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) setUserId(user.uid);
                    else if (initialAuthToken) { await signInWithCustomToken(firebaseAuth, initialAuthToken); setUserId(firebaseAuth.currentUser.uid); }
                    else setUserId(null);
                    setIsAuthReady(true); setLoading(false);
                });
                return () => unsubscribe();
            } catch (err) { setError("Init failed."); setLoading(false); }
        }
    }, []);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) { if(isAuthReady && !userId) setIsLoadingProfile(false); return; }
        const fetchProfile = async () => {
            try { const snap = await getDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile')); if(snap.exists()) setPropertyProfile(snap.data()); else setPropertyProfile(null); } catch(e){console.error(e);} finally { setIsLoadingProfile(false); setLoading(false); }
        };
        fetchProfile();
    }, [isAuthReady, db, userId]);

    useEffect(() => {
        if (!isAuthReady || !db || !propertyProfile) return;
        const q = query(collection(db, PUBLIC_COLLECTION_PATH));
        const unsub = onSnapshot(q, (snap) => {
            setRecords(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate().toLocaleDateString() || 'N/A' })));
        }, (err) => setError("Failed to load records."));
        return () => unsub();
    }, [isAuthReady, db, propertyProfile]);

    const handleLogin = async (email, password, isSignUp) => { if(!auth) return; try { if(isSignUp) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); } catch(e) { throw new Error(e.message); } };
    const handleGoogleLogin = async () => {
        if (!auth) return;
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Google login error", err);
            let msg = "Google sign-in failed. Please try again.";
            if (err.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
            if (err.code === 'auth/cancelled-popup-request') msg = "Sign-in cancelled.";
            if (err.code === 'auth/operation-not-allowed') msg = "Google Sign-in is not enabled in Firebase Console.";
            if (err.code === 'auth/unauthorized-domain') msg = "This domain is not authorized for OAuth operations in Firebase Console.";
            throw new Error(msg);
        }
    };

    const handleAppleLogin = async () => {
        if (!auth) return;
        try {
            const provider = new OAuthProvider('apple.com');
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Apple login error", err);
            let msg = "Apple sign-in failed. Please try again.";
            if (err.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
            if (err.code === 'auth/cancelled-popup-request') msg = "Sign-in cancelled.";
            if (err.code === 'auth/operation-not-allowed') msg = "Apple Sign-in is not enabled in Firebase Console.";
            if (err.code === 'auth/unauthorized-domain') msg = "This domain is not authorized for OAuth operations in Firebase Console.";
            throw new Error(msg);
        }
    };

    const handleGuestLogin = async () => { if(!auth) return; await signInAnonymously(auth); };
    const handleSignOut = async () => { if(!auth) return; await signOut(auth); setUserId(null); setPropertyProfile(null); setRecords([]); };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        const form = e.target;
        
        // Get values directly from form elements to avoid state issues
        const propertyName = form.querySelector('input[name="propertyName"]').value;
        const streetAddress = form.querySelector('input[name="streetAddress"]').value;
        const city = form.querySelector('input[name="city"]').value;
        const state = form.querySelector('input[name="state"]').value;
        const zip = form.querySelector('input[name="zip"]').value;
        const yearBuilt = form.querySelector('input[name="yearBuilt"]')?.value || '';
        const sqFt = form.querySelector('input[name="sqFt"]')?.value || '';
        const lotSize = form.querySelector('input[name="lotSize"]')?.value || '';
        const lat = form.querySelector('input[name="lat"]')?.value;
        const lon = form.querySelector('input[name="lon"]')?.value;

        if(!propertyName) return;
        setIsSaving(true);
        try {
            const data = { 
                name: propertyName, 
                address: { street: streetAddress, city, state, zip },
                yearBuilt, sqFt, lotSize,
                coordinates: (lat && lon) ? { lat, lon } : null,
                createdAt: serverTimestamp() 
            };
            await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile'), data);
            setPropertyProfile(data);
        } catch(e) { setError("Save failed: " + e.message); } finally { setIsSaving(false); }
    };

    const handleInputChange = useCallback((e) => { const { name, value } = e.target; setNewRecord(prev => ({ ...prev, [name]: value })); }, []);
    const handleFileChange = useCallback((e) => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }, []);

    const saveRecord = useCallback(async (e) => {
        e.preventDefault();
        if (!db || !userId || isSaving) return;
        if (!newRecord.area || !newRecord.category || !newRecord.item) { setError("Missing fields."); return; }
        setIsSaving(true); setError(null);
        try {
            let url = '';
            if (selectedFile) { if(selectedFile.size < 1048576) url = await fileToBase64(selectedFile); else throw new Error("Image too large"); }
            await addDoc(collection(db, PUBLIC_COLLECTION_PATH), { ...newRecord, propertyLocation: propertyProfile?.name, imageUrl: url, userId, timestamp: serverTimestamp() });
            setNewRecord(initialRecordState); setSelectedFile(null); document.getElementById('photo').value = ""; setActiveTab('View Records');
        } catch (e) { setError("Save failed: " + e.message); } finally { setIsSaving(false); }
    }, [db, userId, isSaving, newRecord, selectedFile, propertyProfile]);

    const deleteRec = async (id) => { if(!db) return; try { await deleteDoc(doc(db, PUBLIC_COLLECTION_PATH, id)); setConfirmDelete(null); } catch(e){ setError("Delete failed."); } };
    const grouped = records.reduce((acc, r) => { const k = r.area || 'Uncategorized'; if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; }, {});

    // Error Boundary for main app
    class ErrorBoundary extends React.Component {
        constructor(props) { super(props); this.state = { hasError: false, error: null }; }
        static getDerivedStateFromError(error) { return { hasError: true, error }; }
        render() { if (this.state.hasError) return <div className="p-8 text-red-600"><h1>Crash!</h1><pre>{this.state.error?.toString()}</pre></div>; return this.props.children; }
    }

    if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Initializing Trellis...</div>;
    
    return (
        <ErrorBoundary>
            {!userId ? (
                <AuthScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onAppleLogin={handleAppleLogin} onGuestLogin={handleGuestLogin} error={error} />
            ) : isLoadingProfile ? (
                <div className="flex items-center justify-center min-h-screen text-gray-500">Loading Profile...</div>
            ) : !propertyProfile ? (
                <div className="min-h-screen bg-gray-50 p-4"><style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style><SetupPropertyForm onSave={handleSaveProfile} isSaving={isSaving} onSignOut={handleSignOut} /></div>
            ) : (
                <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
                    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
                    <link rel="icon" type="image/svg+xml" href={logoSrc} />
                    <header className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center relative">
                        <button onClick={handleSignOut} className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 flex items-center text-xs font-medium sm:mt-2"><LogOut size={16} className="mr-1"/> Sign Out</button>
                        <img src={logoSrc} alt="Trellis Logo" className="h-20 w-20 mb-4 sm:mb-0 sm:mr-6 shadow-sm rounded-xl" />
                        <div className="text-center sm:text-left">
                            <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-900 tracking-tighter"><span className="text-indigo-600">Trellis</span> Home Log</h1>
                            <p className="text-gray-500 mt-2 text-lg">The official Property Pedigree for your home.</p>
                            <div className="mt-2 inline-flex items-center bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-100">
                                <MapPin size={14} className="text-indigo-500 mr-2" /><span className="text-gray-600 font-semibold text-sm">{propertyProfile.name} {propertyProfile.address?.city ? `• ${propertyProfile.address.city}` : ''}</span>
                            </div>
                        </div>
                    </header>
                    {error && <div className="max-w-4xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">{error}<span className="float-right cursor-pointer" onClick={()=>setError(null)}>&times;</span></div>}
                    {activeTab !== 'Report' && (
                        <nav className="flex justify-center mb-6 max-w-lg mx-auto print:hidden">
                            <button onClick={() => setActiveTab('View Records')} className={`flex-1 px-4 py-3 font-semibold rounded-l-xl border-b-2 ${activeTab==='View Records'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>View History ({records.length})</button>
                            <button onClick={() => setActiveTab('Add Record')} className={`flex-1 px-4 py-3 font-semibold border-b-2 border-l-0 border-r-0 ${activeTab==='Add Record'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Add New</button>
                            <button onClick={() => setActiveTab('Report')} className={`flex-1 px-4 py-3 font-semibold rounded-r-xl border-b-2 ${activeTab==='Report'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Report</button>
                            <button onClick={() => setActiveTab('Insights')} className={`flex-1 px-4 py-3 font-semibold rounded-r-xl border-b-2 ${activeTab==='Insights'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Insights</button>
                        </nav>
                    )}
                    {activeTab === 'Report' && (
                         <div className="max-w-5xl mx-auto mb-6 flex items-center print:hidden">
                            <button onClick={() => setActiveTab('View Records')} className="flex items-center text-gray-500 hover:text-indigo-600 transition"><Trash2 className="h-4 w-4 mr-1 rotate-180" style={{display: 'none'}} /><span className="text-sm font-medium">← Back to Dashboard</span></button>
                         </div>
                    )}
                    {activeTab === 'Insights' && (
                         <div className="max-w-5xl mx-auto mb-6 flex items-center print:hidden">
                            <button onClick={() => setActiveTab('View Records')} className="flex items-center text-gray-500 hover:text-indigo-600 transition"><Trash2 className="h-4 w-4 mr-1 rotate-180" style={{display: 'none'}} /><span className="text-sm font-medium">← Back to Dashboard</span></button>
                         </div>
                    )}

                    <main className="max-w-4xl mx-auto">
                        {activeTab === 'Add Record' && <AddRecordForm onSave={saveRecord} isSaving={isSaving} newRecord={newRecord} onInputChange={handleInputChange} onFileChange={handleFileChange} />}
                        {activeTab === 'View Records' && <div className="space-y-10">{Object.keys(grouped).length>0 ? Object.keys(grouped).map(area => (
                            <section key={area} className="bg-white p-6 rounded-3xl shadow-xl border border-indigo-100">
                                <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center"><Home size={28} className="mr-3 text-indigo-600"/> {area}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{grouped[area].map(r => <RecordCard key={r.id} record={r} onDeleteClick={setConfirmDelete} />)}</div>
                            </section>
                        )) : <div className="text-center p-12 bg-white rounded-xl shadow-lg border-2 border-dashed border-indigo-200"><FileText size={48} className="mx-auto text-indigo-400 mb-4"/><p className="text-gray-600 font-medium text-lg">Log is Empty.</p></div>}</div>}
                        {activeTab === 'Report' && <PedigreeReport propertyProfile={propertyProfile} records={records} />}
                        {activeTab === 'Insights' && <EnvironmentalInsights propertyProfile={propertyProfile} />}
                    </main>
                    {confirmDelete && <CustomConfirm message="Delete this record? Cannot be undone." onConfirm={handleDeleteConfirmed} onCancel={() => setConfirmDelete(null)} />}
                </div>
            )}
        </ErrorBoundary>
    );
};

export default App;
