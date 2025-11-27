import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    GoogleAuthProvider, OAuthProvider, signInWithPopup, deleteUser, EmailAuthProvider, reauthenticateWithCredential
} from 'firebase/auth';
import { 
    getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, 
    doc, deleteDoc, setLogLevel, setDoc, getDoc, writeBatch, getDocs
} from 'firebase/firestore';
import { Trash2, PlusCircle, Home, Calendar, PaintBucket, HardHat, Info, FileText, ExternalLink, Camera, MapPin, Search, LogOut, Lock, Mail, ChevronDown, Hash, Layers, X, Printer, Map as MapIcon, ShoppingBag, Sun, Wind, Zap, AlertTriangle, UserMinus } from 'lucide-react';

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

const googleMapsApiKey = "AIzaSyC1gVI-IeB2mbLAlHgJDmrPKwcZTpVWPOw"; 
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
const logoSrc = '/logo.svg';

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
let googleMapsScriptLoadingPromise = null;
const loadGoogleMapsScript = () => {
    if (typeof window === 'undefined') return Promise.resolve();
    
    if (window.google && window.google.maps && window.google.maps.places) {
        return Promise.resolve();
    }
    
    if (googleMapsScriptLoadingPromise) {
        return googleMapsScriptLoadingPromise;
    }

    googleMapsScriptLoadingPromise = new Promise((resolve, reject) => {
        if (document.getElementById('googleMapsScript')) {
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

// Re-auth Modal for password re-authentication
const ReauthModal = ({ onConfirm, onCancel, isLoading }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        if (!password) {
            setError("Password is required.");
            return;
        }
        onConfirm(password).catch(err => {
            setError(err.message || "Re-authentication failed.");
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden">
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
                <h3 className="text-xl font-semibold text-red-800 mb-2">Security Check</h3>
                <p className="text-gray-600 mb-4 text-sm">Please re-enter your password to confirm permanent account deletion. This action cannot be reversed.</p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        placeholder="Current Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        required
                    />
                    {error && <p className="text-red-600 text-xs">{error}</p>}
                    
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50">
                            {isLoading ? 'Deleting...' : 'Confirm Deletion'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CustomConfirm = ({ message, onConfirm, onCancel, type = 'delete' }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">{type === 'account' ? 'Confirm Account Deletion' : 'Confirm Action'}</h3>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex justify-end space-x-3">
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                <button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${type === 'account' ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'}`}>
                    {type === 'account' ? 'Delete Permanently' : 'Delete'}
                </button>
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

// Setup Form with Address Autocomplete (FIXED)
const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => {
    const [formData, setFormData] = useState({
        propertyName: '', streetAddress: '', city: '', state: '', zip: '', lat: null, lon: null, yearBuilt: '', sqFt: '', lotSize: ''
    });
    const inputRef = useRef(null);

    useEffect(() => {
        // Global auth failure handler from Google Maps
        window.gm_authFailure = () => {
            console.error("Google Maps Auth Failure detected");
            alert("Google Maps API Key Error. Please check your 'Places API' and 'Maps Embed API' settings in Google Cloud.");
        };

        loadGoogleMapsScript().then(() => {
            if (inputRef.current && window.google && window.google.maps && window.google.maps.places) {
                try {
                    const auto = new window.google.maps.places.Autocomplete(inputRef.current, {
                        types: ['address'],
                        fields: ['address_components', 'geometry', 'formatted_address']
                    });
                    
                    // Prevent form submission on "Enter" key in address field
                    inputRef.current.addEventListener('keydown', (e) => {
                        if(e.key === 'Enter') e.preventDefault(); 
                    });

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

                        setFormData(prev => ({
                            ...prev,
                            streetAddress: `${streetNum} ${route}`.trim(),
                            city, state, zip,
                            lat: place.geometry.location.lat(),
                            lon: place.geometry.location.lng()
                        }));
                        
                        if (inputRef.current) {
                            inputRef.current.value = `${streetNum} ${route}`.trim();
                        }
                    });
                } catch (e) {
                    console.warn("Google Auto fail", e);
                }
            }
        }).catch(err => console.error("Maps load error", err));
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
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nickname</label><input type="text" name="propertyName" value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div>
                    
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Street Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} />
                            <input 
                                ref={inputRef} 
                                type="text" 
                                name="streetAddress" 
                                defaultValue={formData.streetAddress} 
                                // IMPORTANT: Removed onChange={handleChange} here to prevent React/Google conflict
                                autoComplete="new-password" 
                                placeholder="Start typing address..." 
                                className="w-full rounded-lg border-gray-300 shadow-sm p-3 pl-10 border"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">City</label><input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">State</label><input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Zip</label><input type="text" name="zip" value={formData.zip} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div></div></div>
                    
                    <div className="pt-4 border-t border-gray-100"><p className="text-xs text-indigo-600 font-semibold mb-3">Details (Optional)</p><div className="grid grid-cols-3 gap-3"><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Year Built</label><input type="number" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sq Ft</label><input type="number" name="sqFt" value={formData.sqFt} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lot Size</label><input type="text" name="lotSize" value={formData.lotSize} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div></div></div>
                    
                    {/* Hidden fields for lat/lon passed via form submission */}
                    <input type="hidden" name="lat" value={formData.lat || ''} />
                    <input type="hidden" name="lon" value={formData.lon || ''} />
                    
                    {/* Standard Submit Button */}
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
                const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleMapsApiKey}`;
                const aqRes = await fetch(aqUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: { latitude: coordinates.lat, longitude: coordinates.lon } }) });
                if(aqRes.ok) {
                     const aqData = await aqRes.json();
                     if (aqData.indexes?.[0]) setAirQuality(aqData.indexes[0]);
                }

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

const PedigreeReport = ({ propertyProfile, records }) => {
    const calculateAge = (categoryKeyword, itemKeyword) => {
        // SAFELY HANDLE RECORDS: Check if record exists, if category is a string, etc.
        const record = records.find(r => {
             // Defensive check for missing or malformed data
             if (!r || !r.category) return false;
             
             const catMatch = r.category.toString().includes(categoryKeyword);
             // Check item name defensively
             const itemMatch = r.item && r.item.toLowerCase().includes(itemKeyword);
             
             return (catMatch || itemMatch) && r.dateInstalled;
        });

        if (!record) return { age: 'N/A', date: 'No record' };
        
        const installed = new Date(record.dateInstalled);
        // Check if date is valid
        if (isNaN(installed.getTime())) return { age: 'N/A', date: 'Invalid Date' };

        const now = new Date();
        const age = now.getFullYear() - installed.getFullYear();
        return { age: `${age} Yrs`, date: `Installed ${installed.getFullYear()}` };
    };

    const hvacStats = calculateAge('HVAC', 'hvac');
    const roofStats = calculateAge('Roof', 'roof');
    const heaterStats = calculateAge('Plumbing', 'water heater');

    const sortedRecords = [...records].sort((a, b) => {
        const dateA = a.dateInstalled ? new Date(a.dateInstalled) : (a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0));
        const dateB = b.dateInstalled ? new Date(b.dateInstalled) : (b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0));
        return dateB - dateA;
    });

    return (
        <div className="bg-gray-50 min-h-screen pb-12">
            <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center print:hidden pt-6 px-4">
                <h2 className="text-2xl font-bold text-gray-800">Pedigree Report</h2>
                <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition"><Printer className="h-4 w-4 mr-2" /> Print / Save PDF</button>
            </div>

            <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 print:shadow-none print:border-0">
                <div className="bg-indigo-900 text-white p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12 translate-x-10 -translate-y-10"><img src={logoSrc} className="w-64 h-64 brightness-0 invert" alt="Watermark"/></div>
                     <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                             <div className="flex items-center mb-4"><span className="text-xs font-bold tracking-widest uppercase text-indigo-200 border border-indigo-700 px-2 py-1 rounded">Verified Pedigree</span></div>
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-2 tracking-tight text-white">{propertyProfile?.name || 'My Property'}</h1>
                            <p className="text-indigo-200 text-lg flex items-center"><MapPin className="h-5 w-5 mr-2" /> {propertyProfile?.address ? `${propertyProfile.address.street}, ${propertyProfile.address.city} ${propertyProfile.address.state}` : 'No Address Listed'}</p>
                        </div>
                        <div className="mt-8 md:mt-0 text-left md:text-right"><p className="text-xs text-indigo-300 uppercase tracking-wide mb-1">Report Date</p><p className="font-mono text-lg font-bold">{new Date().toLocaleDateString()}</p></div>
                     </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50 print:grid-cols-4">
                     <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">HVAC Age</p><p className="text-2xl font-extrabold text-indigo-900">{hvacStats.age}</p><p className="text-xs text-gray-500 mt-1">{hvacStats.date}</p></div>
                     <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Roof Age</p><p className="text-2xl font-extrabold text-indigo-900">{roofStats.age}</p><p className="text-xs text-gray-500 mt-1">{roofStats.date}</p></div>
                     <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Water Heater</p><p className="text-2xl font-extrabold text-indigo-900">{heaterStats.age}</p><p className="text-xs text-gray-500 mt-1">{heaterStats.date}</p></div>
                     <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Records</p><p className="text-2xl font-extrabold text-indigo-600">{records.length}</p></div>
                </div>

                <div className="p-8 md:p-10">
                     <div className="space-y-8 border-l-2 border-indigo-100 ml-3 pl-8 relative">
                        {sortedRecords.map(record => (
                            <div key={record.id} className="relative break-inside-avoid">
                                <div className="absolute -left-[41px] top-1 h-6 w-6 rounded-full bg-white border-4 border-indigo-600"></div>
                                <div className="mb-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between"><span className="font-bold text-lg text-gray-900 mr-3">{record.item}</span><span className="text-sm font-mono text-gray-500">{record.dateInstalled || (record.timestamp?.toDate ? record.timestamp.toDate().toLocaleDateString() : 'No Date')}</span></div>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm print:shadow-none print:border">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-sm">
                                        <div><span className="text-gray-400 uppercase text-xs font-bold">Category:</span> <span className="font-medium">{record.category}</span></div>
                                        {record.brand && <div><span className="text-gray-400 uppercase text-xs font-bold">Brand:</span> <span className="font-medium">{record.brand}</span></div>}
                                        {record.contractor && <div><span className="text-gray-400 uppercase text-xs font-bold">Contractor:</span> <span className="font-medium">{record.contractor}</span></div>}
                                     </div>
                                     {record.notes && <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 italic print:bg-transparent print:border-0">"{record.notes}"</p>}
                                     {record.imageUrl && <div className="mt-3"><img src={record.imageUrl} alt="Record" className="h-32 w-auto rounded-lg border border-gray-200 object-cover print:h-24" /></div>}
                                </div>
                            </div>
                        ))}
                     </div>
                </div>
                <div className="bg-gray-50 p-8 text-center border-t border-gray-200 print:bg-white"><p className="text-sm text-gray-500 flex items-center justify-center font-medium"><Lock className="h-4 w-4 mr-2 text-indigo-600" /> Authenticated by Trellis Property Data</p></div>
            </div>
        </div>
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
    // NEW: State for deletion confirmation and re-auth modal
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showReauth, setShowReauth] = useState(false);

    useEffect(() => {
        // Initialize Firebase (Safe check for existing apps)
        if (firebaseConfig) {
            try {
                const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);
                setLogLevel('error');
                setDb(firestore);
                setAuth(firebaseAuth);

                // Safety Timeout: If Auth doesn't resolve in 2s, force stop loading
                const safetyTimer = setTimeout(() => {
                     if (loading) setLoading(false);
                }, 2000);

                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    clearTimeout(safetyTimer);
                    if (user) setUserId(user.uid);
                    else setUserId(null);
                    setIsAuthReady(true); 
                    setLoading(false);
                });
                return () => unsubscribe();
            } catch (err) { 
                setError("Init failed: " + err.message); 
                setLoading(false); 
            }
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

    // NEW: Function to delete user data from Firestore
    const deleteUserData = async (uid) => {
        const batch = writeBatch(db);
        
        // 1. Delete User Profile
        const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'settings', 'profile');
        batch.delete(profileRef);

        // 2. Delete all Records associated with the user (Important for PUBLIC_COLLECTION)
        // NOTE: This assumes the records in the public collection are tied to a userId
        const userRecordsQuery = query(collection(db, PUBLIC_COLLECTION_PATH));
        const recordsSnapshot = await getDocs(userRecordsQuery); // <<< FIX: getDocs must be imported
        
        recordsSnapshot.docs.forEach((doc) => {
            // Only delete records created by THIS user, if using a shared collection
            if (doc.data().userId === uid) {
                batch.delete(doc.ref);
            }
        });

        return batch.commit();
    };

    // NEW: Main Deletion Logic
    const handleDeleteAccount = async (password = null) => {
        const user = auth.currentUser;
        if (!user || !db) {
             alert("Could not find user account to delete.");
             return;
        }

        try {
            // 1. Handle Re-authentication if it's an email/password user
            if (user.providerData.some(p => p.providerId === 'password') && password) {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
            } else if (user.providerData.some(p => p.providerId === 'password') && !password) {
                 // Should be caught by modal presentation, but safe check
                 setShowReauth(true);
                 return;
            }

            // 2. Delete all Firestore data first
            await deleteUserData(user.uid);

            // 3. Delete Auth account
            await deleteUser(user); 
            
            // Cleanup state (onAuthStateChanged should handle it, but for immediacy):
            handleSignOut(); 
            setError("Account permanently deleted. Goodbye!");
        } catch (e) {
            console.error("Account deletion failed:", e);
            setShowReauth(false);
            if (e.code === 'auth/requires-recent-login' || e.code === 'auth/wrong-password') {
                throw new Error("Invalid password or recent sign-in required.");
            } else if (e.code === 'permission-denied') {
                setError("Deletion failed. Check Firebase security rules.");
            } else {
                setError("Failed to delete account: " + e.message);
            }
        }
    };
    
    // NEW: Handler to start the deletion flow
    const initiateAccountDeletion = () => {
        const user = auth?.currentUser;
        if (!user) {
            console.error("No user found for deletion");
            return; 
        }

        // Check if the user needs re-authentication (only email/password users need it)
        const isEmailPassword = user.providerData.some(p => p.providerId === 'password');
        
        if (isEmailPassword) {
            setShowReauth(true);
        } else {
            // Google/Apple/Anonymous users can proceed directly to confirmation
            setShowDeleteConfirm(true);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        const form = e.target;
        // Correctly extract values from the form elements using standard names
        const propertyName = form.querySelector('input[name="propertyName"]').value;
        const streetAddress = form.querySelector('input[name="streetAddress"]').value;
        const city = form.querySelector('input[name="city"]').value;
        const state = form.querySelector('input[name="state"]').value;
        const zip = form.querySelector('input[name="zip"]').value;
        // Optional fields
        const yearBuilt = form.querySelector('input[name="yearBuilt"]')?.value || '';
        const sqFt = form.querySelector('input[name="sqFt"]')?.value || '';
        const lotSize = form.querySelector('input[name="lotSize"]')?.value || '';
        // Hidden fields populated by autocomplete
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
            let finalImageUrl = '';

            if (selectedFile) {
                if (selectedFile.size < 1048576) { 
                    finalImageUrl = await fileToBase64(selectedFile);
                } else {
                    throw new Error("Image is too large. Please use an image under 1MB.");
                }
            }

            const recordToSave = {
                ...newRecord,
                propertyLocation: propertyProfile?.name || 'My Property', 
                imageUrl: finalImageUrl,
                userId,
                timestamp: serverTimestamp(),
            };

            await addDoc(collection(db, PUBLIC_COLLECTION_PATH), recordToSave);

            setNewRecord(initialRecordState);
            setSelectedFile(null);
            document.getElementById('photo').value = ""; 
            setActiveTab('View Records');
        } catch (err) {
            console.error("Error saving record:", err);
            setError("Failed to save the record. " + err.message);
        } finally {
            setIsSaving(false);
        }
    }, [db, userId, isSaving, newRecord, selectedFile, propertyProfile]); 

    
    const handleDeleteConfirmed = async () => {
        if (!db || !confirmDelete) return;

        try {
            await deleteDoc(doc(db, PUBLIC_COLLECTION_PATH, confirmDelete));
            setConfirmDelete(null);
        } catch (err) {
            console.error("Error deleting document:", err);
            setError("Failed to delete the record.");
        }
    };

    const groupedRecords = records.reduce((acc, record) => {
        const key = record.area || 'Uncategorized';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(record);
        return acc;
    }, {});
    
    // --- Render Logic ---

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen text-lg font-medium text-gray-500">Initializing Trellis...</div>;
    }

    // 1. If NOT authenticated, show Login/Signup
    if (!userId) {
        return (
            <AuthScreen 
                onLogin={handleLogin} 
                onGoogleLogin={handleGoogleLogin}
                onAppleLogin={handleAppleLogin}
                onGuestLogin={handleGuestLogin} 
                error={error} 
            />
        );
    }

    // 2. If authenticated but NO profile, show Setup
    if (isLoadingProfile) {
        return <div className="flex items-center justify-center min-h-screen text-lg font-medium text-gray-500">Loading Profile...</div>;
    }

    if (!propertyProfile) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 font-sans">
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
                <SetupPropertyForm onSave={handleSaveProfile} isSaving={isSaving} onSignOut={handleSignOut} />
            </div>
        );
    }

    // 3. Main App UI (Authenticated & Setup Complete)
    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
                    body { font-family: 'Inter', sans-serif; }
                `}</style>
                
                <link rel="icon" type="image/svg+xml" href={logoSrc} />
                
                <header className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center relative">
                    
                    {/* NEW: Account Action Buttons */}
                    <div className="absolute top-0 right-0 flex space-x-3 items-center sm:mt-2 z-10">
                        <button 
                            onClick={initiateAccountDeletion}
                            className="p-1.5 rounded-full text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors"
                            title="Delete Account"
                        >
                            <UserMinus size={16} />
                        </button>
                        <button 
                            onClick={handleSignOut}
                            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center transition-colors"
                            title="Sign Out"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>


                    {/* Logo using standard file reference for consistency across all pages */}
                    <img src={logoSrc} alt="Trellis Logo" className="h-20 w-20 mb-4 sm:mb-0 sm:mr-6 shadow-sm rounded-xl" />
                    <div className="text-center sm:text-left">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-900 tracking-tighter"><span className="text-indigo-600">Trellis</span> Home Log</h1>
                        <p className="text-gray-500 mt-2 text-lg">The official Property Pedigree for your home.</p>
                        {/* Dynamic Property Name from Settings */}
                        <div className="mt-2 inline-flex items-center bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-100">
                            <MapPin size={14} className="text-indigo-500 mr-2" />
                            <span className="text-gray-600 font-semibold text-sm sm:text-base">
                                {propertyProfile.name} 
                                {propertyProfile.address?.city ? ` • ${propertyProfile.address.city}, ${propertyProfile.address.state}` : ''}
                            </span>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="max-w-4xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4 shadow-md" role="alert">
                        <strong className="font-bold">Error:</strong>
                        <span className="block sm:inline ml-2">{error}</span>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer" onClick={() => setError(null)}>
                            &times;
                        </span>
                    </div>
                )}

                <nav className="flex justify-center mb-6 max-w-lg mx-auto">
                    <button
                        onClick={() => setActiveTab('View Records')}
                        className={`flex-1 px-4 py-3 text-sm sm:text-base font-semibold rounded-l-xl transition-all border-b-2 ${
                            activeTab === 'View Records' 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-inner' 
                                : 'bg-white text-gray-600 hover:bg-indigo-50 border-gray-200'
                        }`}
                    >
                        View History ({records.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('Add Record')}
                        className={`flex-1 px-4 py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
                            activeTab === 'Add Record' 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-inner' 
                                : 'bg-white text-gray-600 hover:bg-indigo-50 border-gray-200'
                        }`}
                    >
                        Add New Component
                    </button>
                    <button
                        onClick={() => setActiveTab('Report')}
                        className={`flex-1 px-4 py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
                            activeTab === 'Report' 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-inner' 
                                : 'bg-white text-gray-600 hover:bg-indigo-50 border-gray-200'
                        }`}
                    >
                        Report
                    </button>
                    <button
                        onClick={() => setActiveTab('Insights')}
                        className={`flex-1 px-4 py-3 text-sm sm:text-base font-semibold rounded-r-xl transition-all border-b-2 ${
                            activeTab === 'Insights' 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-inner' 
                                : 'bg-white text-gray-600 hover:bg-indigo-50 border-gray-200'
                        }`}
                    >
                        Insights
                    </button>
                </nav>

                <main className="max-w-4xl mx-auto">
                    {activeTab === 'Add Record' && (
                        <AddRecordForm 
                            onSave={saveRecord}
                            isSaving={isSaving}
                            newRecord={newRecord}
                            onInputChange={handleInputChange}
                            onFileChange={handleFileChange}
                        />
                    )}
                    
                    {activeTab === 'View Records' && (
                        <div className="space-y-10">
                            {Object.keys(groupedRecords).length > 0 ? (
                                Object.keys(groupedRecords).map(area => (
                                    <section key={area} className="bg-white p-4 sm:p-6 rounded-3xl shadow-2xl border border-indigo-100">
                                        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
                                            <Home size={28} className="mr-3 text-indigo-600" />
                                            {area}
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{groupedRecords[area].map(r => <RecordCard key={r.id} record={r} onDeleteClick={setConfirmDelete} />)}</div>
                                    </section>
                                ))
                            ) : (
                                <div className="text-center p-12 bg-white rounded-xl shadow-lg border-2 border-dashed border-indigo-200"><FileText size={48} className="mx-auto text-indigo-400 mb-4"/><p className="text-gray-600 font-medium text-lg">Log is Empty.</p></div>
                            )}
                        </div>
                    )}
                    {activeTab === 'Report' && <PedigreeReport propertyProfile={propertyProfile} records={records} />}
                    {activeTab === 'Insights' && <EnvironmentalInsights propertyProfile={propertyProfile} />}
                </main>
                {confirmDelete && <CustomConfirm message="Delete this record? Cannot be undone." onConfirm={handleDeleteConfirmed} onCancel={() => setConfirmDelete(null)} />}
                {/* NEW: Re-auth Modal for Email/Password Users */}
                {showReauth && (
                    <ReauthModal
                        isLoading={isSaving}
                        onCancel={() => setShowReauth(false)}
                        onConfirm={async (password) => {
                            setIsSaving(true);
                            try {
                            // This calls the main delete function, which handles re-auth internally
                            await handleDeleteAccount(password);
                            } catch (e) {
                            setIsSaving(false);
                            throw e; // ReauthModal will catch and show the error
                            }
                        }}
                    />
                )}
                {/* NEW: Final Account Deletion Confirmation Modal (for Anon/Social users) */}
                {showDeleteConfirm && (
                    <CustomConfirm
                        type="account"
                        message="Are you sure you want to permanently delete your Trellis account and ALL associated data? This cannot be undone."
                        onConfirm={async () => {
                            setIsSaving(true);
                            await handleDeleteAccount();
                            setIsSaving(false);
                        }}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
};

export default App;
