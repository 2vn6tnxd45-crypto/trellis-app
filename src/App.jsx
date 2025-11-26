import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    GoogleAuthProvider, OAuthProvider, signInWithPopup
} from 'firebase/auth';
import { 
    getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, 
    doc, deleteDoc, setLogLevel, setDoc, getDoc
} from 'firebase/firestore';
import { Trash2, PlusCircle, Home, Calendar, PaintBucket, HardHat, Info, FileText, ExternalLink, Camera, MapPin, Search, LogOut, Lock, Mail, ChevronDown, Hash, Layers, X, Printer, Map as MapIcon, ShoppingBag, Sun, Wind, Zap } from 'lucide-react';

// --- Global Firebase & Auth Setup ---

const appId = 'trellis-home-log'; 

const firebaseConfig = {
  apiKey: "AIzaSyCS2JMaEpI_npBXkHjhjOk10ffZVg5ypaI",
  authDomain: "trellis-6cd18.firebaseapp.com",
  projectId: "trellis-6cd18",
  storageBucket: "trellis-6cd18.firebasestorage.app",
  messagingSenderId: "669423260428",
  appId: "1:669423260428:web:64a5452413682c257cef29",
  measurementId: "G-JBP9F27RN1"
};

// 3. GOOGLE MAPS CONFIG: Your API Key
const googleMapsApiKey = "AIzaSyC_hvAtqVO3GIWSFwRiQi5tQZppekkbRVM"; 

// Fallback for preview environment vs production
const finalConfig = (typeof __firebase_config !== 'undefined' && __firebase_config) 
    ? JSON.parse(__firebase_config) 
    : firebaseConfig;

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const PUBLIC_COLLECTION_PATH = `/artifacts/${appId}/public/data/house_records`;

// --- HELPER: Load Google Maps Script ---
// This allows us to use the Places Library for Autocomplete
const loadGoogleMapsScript = (callback) => {
    const existingScript = document.getElementById('googleMapsScript');
    if (existingScript) {
        if (window.google && window.google.maps && window.google.maps.places) {
            if (callback) callback();
        } else {
            existingScript.addEventListener('load', callback);
        }
        return;
    }

    const script = document.createElement('script');
    script.id = 'googleMapsScript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
        if (callback) callback();
    };
    document.head.appendChild(script);
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

// --- Embedded Logo Assets ---
const logoSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 755" fill="none">
  <path fill="#2A2A72" d="M1016.48,403h-77.99l-90.49-68.07v404.35l-.72.72H175.72l-.72-.72v-404.35l-90.49,68.07H5.6l236.4-184.52v-108.48h67v53.04L512.62,8.05l503.86,394.95ZM512.31,73.38l-63.66,47.66,63.59,56.85,60.52-52.73c1.11-1.17.82-2.88.31-4.23-1.06-2.76-11.8-11.12-14.76-13.56-9.99-8.27-20.81-16.75-31.28-24.4-2.18-1.6-12.96-9.75-14.72-9.59ZM429.75,134.76l-70.14,53.73c-.25,2.24-.97,5.73.68,7.46l66.98,58.18c5.72-4.25,11.17-8.92,16.57-13.56,10.71-9.2,21.99-19.04,32.16-28.8,2.72-2.61,17.32-16.66,17.27-19.22l-63.52-57.79ZM591.91,134.84l-63.59,56.76,68.39,64.47,68.37-64.41-73.17-56.82ZM337.99,205.4l-71.27,57.24,75.66,68.83,68.8-61.63-73.2-64.44ZM754.88,261.93l-70.71-56.58-70.88,64.97,64.01,61.65,77.58-70.04ZM443.84,270.55l66.06,61.41,67.82-59.79-65.57-63.95-68.31,62.32ZM695.36,345.45l68.4,64.78c6-7.71,14.94-12.23,22.09-18.7,8.66-7.83,9.76-12.08,10.33-23.75.88-17.95-1.43-35.92-1.96-53.76-.19-6.3.01-12.68.28-18.96l-24.25-18.74c-.39,4.52-5.89,7.04-9.13,9.83-21.28,18.34-40.61,38.86-62.16,56.88-1.01.85-2.34,2.01-3.59,2.42ZM248.45,279.32c-6.37.8-12.21,8.42-17.2,12.09-.88.64-2.94,1.11-3.25,2.03l-.58,87.31c.22,1.66,2.79,3.78,4.09,5.03,8.72,8.35,17.83,16.41,26.83,24.43l67.95-65.9-70.78-62.69c-2.36-1.75-3.97-2.68-7.06-2.29ZM493.2,345.52c-.14-.23-3.65-2.3-4.46-2.97-16.69-13.84-30.58-30.97-46.81-45.35-2.6-2.3-13.14-11.58-16.07-11.29l-64.08,62.12,65.89,59.74c9.91-7.94,19.65-16.19,29.13-24.65,10.4-9.27,25.11-21.53,33.58-32.18.85-1.07,3.55-4.17,2.81-5.43ZM528.43,344.1c-.29.5-.19,2.33-.08,3,.24,1.37,6.04,8.35,7.4,9.87,16.73,18.72,40.52,31.34,56.65,50.86l67.91-60.23-63.18-61.13-68.7,57.62ZM411.2,423.21l-68.4-61.47-65.99,64.1c15.88,14.8,30.93,30.57,47.02,45.13,2.44,2.21,16.6,15.02,18.48,15.09l68.88-62.85ZM678.89,361.81l-67.98,62.04,67.95,62.18,65.23-56.09c1.92-1.98,2.66-4.84,3.49-7.4l-68.7-60.73ZM443.84,423.21l65.58,60.44,65-55.38c2.06-2.05-.06-5.1.36-7.61l-62.61-56.46-68.33,59.02ZM227,413.12v23.76c0,.48,1.14.76,1.67.76,4.05,0,4.64-4.93,6.95-7.02,1.72-1.56,4.8-2.15,6.25-4.3l-14.87-13.2ZM794.72,437.12l-1.19-24-10.72,12.72,11.91,11.27ZM257.91,440.07c-8.25,9.78-21.28,17.17-28.26,27.9-3.73,5.73-3.51,12.62-3.75,19.29-.48,13.32-.15,27.06.52,40.32.2,4.01-.36,9.52,1.09,13.31,1.11,2.92,10.08,11.51,12.81,14.07,2.21,2.08,12.91,11.79,15.14,11.74l70.75-64.61-68.3-62.02ZM427.27,440.12l-67.88,61.63c-.16.93,9.57,9.12,11.01,10.49,12.38,11.75,24.32,24.05,36.95,35.53,2.38,2.17,15.52,14.2,17.54,14.15l68.35-62.22-65.97-59.58ZM591.99,440.07l-63.15,59.62,68.3,62.19c11.25-9.53,22.53-19.07,33.43-29,7.82-7.13,15.71-14.45,23.29-21.83,1.18-1.15,8.94-8.66,8.83-9.31l-70.7-61.67ZM695.39,501.45l68.95,65.19c.78.15,4.66-2.28,5.6-2.89,5.64-3.66,23.52-18.82,25.06-24.86l.12-69.26c-.45-2.21-5.9-7.23-7.8-9-7.52-7.05-16.49-12.61-23.14-20.58l-68.79,61.41ZM509.93,515.9l-68.45,62.03,70.76,64.16,65.99-64.1-68.3-62.1ZM679.28,517.85l-65.98,60.1,73.11,64.1,63.67-59.71-70.79-64.49ZM342.44,518.79c-12.38,7.63-23.26,17.72-33.97,27.53-10.24,9.38-21.86,20.07-31.21,30.23-.95,1.04-4.82,5.09-5.21,5.83-.63,1.22-1.01,3.1-.05,4.25l65.51,55.46,71.27-64.58-66.35-58.73ZM354.08,658.87l33.95,29.17c24.09-.02,48.43.64,72.39-.34l32.85-31.47-60.94-58.57c-2.99-2.33-5.63-5.54-9.87-3.62-21.4,20.86-43.89,40.59-65.5,61.22-.59.56-3.32,2.96-2.87,3.6ZM596.79,593.63l-68.46,64.53,33.93,29.9c20.59-.61,41.79,2.88,62.32,1.56,10.6-.68,23.62-11.86,31.43-18.97,2.59-2.37,10.02-9.35,11.54-11.98.69-1.19.59-2.45.35-3.77l-71.11-61.26ZM227,689h59.28c9.51-7.44,19.92-16.29,27.85-25.43,1.61-1.86,5.98-6.53,4.58-8.91l-63.15-55.81-28.56,25.59v64.56ZM795,689v-64.56c-4.89-5.8-10.71-11.26-16.57-16.07-2.59-2.13-10.23-8.48-13.07-9.04-.58-.11-1.12-.22-1.7-.01l-62.06,57.51.25,1.23,31.47,30.94h61.68ZM530.24,689l-20.4-16.82-16.08,16.82h36.48ZM353.6,689l-18.01-14.32-16.07,14.32h34.08ZM700.16,688.17l-16.08-13.94-16.08,13.22c6.46.79,12.94.52,19.43.72,3.82.12,7.61.67,11.53.48.54-.03,1.32.31,1.19-.47Z"/>
</svg>
`;
const logoSrc = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvgString)}`;

// Icons
const GoogleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>);
const AppleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.74-3.12 1.84-2.6 5.75.64 7.13-.5 1.24-1.14 2.47-2.69 4.14zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.54 4.33-3.74 4.25z" /></svg>);
const fileToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error); });

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

// ... (AuthScreen, RecordCard, AddRecordForm, etc. remain unchanged except for usage of updated logoSrc)
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
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with email</span></div>
                    </div>
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

const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => {
    const [formData, setFormData] = useState({ propertyName: '', streetAddress: '', city: '', state: '', zip: '', yearBuilt: '', sqFt: '', lotSize: '' });
    // Ref for Google Autocomplete input
    const inputRef = useRef(null);
    const [autocomplete, setAutocomplete] = useState(null);

    // Initialize Google Autocomplete
    useEffect(() => {
        loadGoogleMapsScript(() => {
            if (inputRef.current && window.google) {
                const auto = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'],
                    fields: ['address_components', 'geometry', 'formatted_address']
                });
                auto.addListener('place_changed', () => {
                    const place = auto.getPlace();
                    if (!place.geometry) return;

                    // Extract address components
                    let streetNum = '', route = '', city = '', state = '', zip = '';
                    place.address_components.forEach(comp => {
                        if (comp.types.includes('street_number')) streetNum = comp.long_name;
                        if (comp.types.includes('route')) route = comp.long_name;
                        if (comp.types.includes('locality')) city = comp.long_name;
                        if (comp.types.includes('administrative_area_level_1')) state = comp.short_name;
                        if (comp.types.includes('postal_code')) zip = comp.long_name;
                    });

                    setFormData(prev => ({
                        ...prev,
                        streetAddress: `${streetNum} ${route}`.trim(),
                        city,
                        state,
                        zip,
                        lat: place.geometry.location.lat(),
                        lon: place.geometry.location.lng()
                    }));
                });
                setAutocomplete(auto);
            }
        });
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
                <p className="text-gray-500 mb-6 leading-relaxed text-sm">Let's find your home. We'll use this to pull environmental insights.</p>
                <form onSubmit={onSave} className="space-y-4 text-left relative">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nickname</label><input type="text" name="propertyName" required value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div>
                    
                    {/* Google Places Autocomplete Input */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Street Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} />
                            <input 
                                ref={inputRef}
                                type="text" 
                                name="streetAddress" 
                                required 
                                value={formData.streetAddress} 
                                onChange={handleChange} 
                                autoComplete="off" 
                                placeholder="Start typing address..." 
                                className="w-full rounded-lg border-gray-300 shadow-sm p-3 pl-10 border transition-shadow"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">City</label><input type="text" name="city" required value={formData.city} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">State</label><input type="text" name="state" required value={formData.state} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Zip</label><input type="text" name="zip" required value={formData.zip} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div></div></div>
                    
                    {/* Estated Fields (Manual Entry for now) */}
                    <div className="pt-4 border-t border-gray-100">
                         <p className="text-xs text-indigo-600 font-semibold mb-3">Property Details (Optional)</p>
                         <div className="grid grid-cols-3 gap-3">
                             <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Year Built</label><input type="number" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} placeholder="1990" className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div>
                             <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sq Ft</label><input type="number" name="sqFt" value={formData.sqFt} onChange={handleChange} placeholder="2400" className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div>
                             <div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lot Size (Acres)</label><input type="text" name="lotSize" value={formData.lotSize} onChange={handleChange} placeholder="0.25" className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div>
                         </div>
                         <p className="text-xs text-gray-400 mt-2 italic">Note: Automated data lookup requires a paid Estated key.</p>
                    </div>

                    {/* Hidden fields for lat/lon */}
                    <input type="hidden" name="lat" value={formData.lat || ''} />
                    <input type="hidden" name="lon" value={formData.lon || ''} />

                    <button type="submit" disabled={isSaving} className="w-full py-3 px-4 rounded-lg shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-lg disabled:opacity-70">{isSaving ? 'Saving...' : 'Create My Home Log'}</button>
                </form>
            </div>
        </div>
    );
};

const EnvironmentalInsights = ({ propertyProfile }) => {
    const { address, coordinates } = propertyProfile || {};
    const [airQuality, setAirQuality] = useState(null);
    const [solarData, setSolarData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!coordinates?.lat || !coordinates?.lon || !googleMapsApiKey) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const aqUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleMapsApiKey}`;
                const aqRes = await fetch(aqUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: { latitude: coordinates.lat, longitude: coordinates.lon } })
                });
                const aqData = await aqRes.json();
                if (aqData.indexes && aqData.indexes[0]) {
                     setAirQuality(aqData.indexes[0]);
                }

                const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${coordinates.lat}&location.longitude=${coordinates.lon}&requiredQuality=HIGH&key=${googleMapsApiKey}`;
                const solarRes = await fetch(solarUrl);
                if (solarRes.ok) {
                    const solarJson = await solarRes.json();
                    setSolarData(solarJson);
                }
            } catch (err) {
                console.error("Environmental data fetch failed", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [coordinates]);

    if (!coordinates?.lat) return <div className="p-6 text-center text-gray-500">Location data missing. Please update your property address in setup.</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-indigo-900 mb-2 flex items-center">
                <MapIcon className="mr-2 h-5 w-5" /> Environmental Insights
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10"><Wind className="h-24 w-24 text-blue-500" /></div>
                     <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Air Quality</h3>
                     {loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (
                         airQuality ? (
                             <div>
                                 <div className="flex items-baseline">
                                     <span className="text-4xl font-extrabold text-gray-900">{airQuality.aqi}</span>
                                     <span className="ml-2 text-sm font-medium text-gray-500">US AQI</span>
                                 </div>
                                 <p className="text-indigo-600 font-medium mt-1">{airQuality.category}</p>
                                 <p className="text-xs text-gray-400 mt-4">Source: Google Air Quality API</p>
                             </div>
                         ) : <p className="text-gray-500 text-sm">Data unavailable for this location.</p>
                     )}
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10"><Sun className="h-24 w-24 text-yellow-500" /></div>
                     <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Solar Potential</h3>
                     {loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (
                         solarData ? (
                             <div>
                                 <div className="flex items-baseline">
                                     <span className="text-4xl font-extrabold text-gray-900">{Math.round(solarData.solarPotential.maxSunshineHoursPerYear)}</span>
                                     <span className="ml-2 text-sm font-medium text-gray-500">Sun Hours/Year</span>
                                 </div>
                                 <div className="mt-4 flex items-center">
                                     <Zap className="h-4 w-4 text-yellow-500 mr-1" />
                                     <span className="text-sm font-medium text-gray-700">Carbon Offset: {Math.round(solarData.solarPotential.carbonOffsetFactorKgPerMwh)} kg/MWh</span>
                                 </div>
                                 <p className="text-xs text-gray-400 mt-4">Source: Google Solar API</p>
                             </div>
                         ) : <p className="text-gray-500 text-sm">Solar data unavailable for this location (Check billing/coverage).</p>
                     )}
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
    
    let mapUrl;
    const isKeyValid = googleMapsApiKey && googleMapsApiKey.length > 20 && !googleMapsApiKey.includes("PASTE");
    if (isKeyValid) {
         mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodedQuery}`;
    } else {
        mapUrl = `https://maps.google.com/maps?q=${encodedQuery}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                <div className="w-full h-64 bg-gray-100 rounded-xl overflow-hidden relative">
                     <iframe width="100%" height="100%" src={mapUrl} frameBorder="0" scrolling="no" marginHeight="0" marginWidth="0" title="Property Map" className="absolute inset-0"></iframe>
                </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center"><ShoppingBag className="mr-2 h-5 w-5" /> Nearby Suppliers</h3>
                <p className="text-sm text-indigo-700 mb-4">Find parts and supplies quickly. These links search for stores near your property.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a href={`https://www.google.com/maps/search/Home+Depot+near+${encodedQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">The Home Depot <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600"/></a>
                    <a href={`https://www.google.com/maps/search/Lowe's+near+${encodedQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">Lowe's Home Improvement <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600"/></a>
                    <a href={`https://www.google.com/maps/search/Sherwin+Williams+near+${encodedQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">Sherwin-Williams Paint <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600"/></a>
                    <a href={`https://www.google.com/maps/search/Hardware+Store+near+${encodedQuery}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">Local Hardware Stores <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600"/></a>
                </div>
            </div>
        </div>
    );
};

// ... (RecordCard, AddRecordForm, PedigreeReport, App remain generally same logic, ensuring logoSvgString is used)
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
    // ... (Same logic as before for dynamic fields)
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

const PedigreeReport = ({ propertyProfile, records }) => {
    const calculateAge = (categoryKeyword, itemKeyword) => {
        const record = records.find(r => (r.category.includes(categoryKeyword) || (r.item && r.item.toLowerCase().includes(itemKeyword))) && r.dateInstalled);
        if (!record) return { age: 'N/A', date: 'No record' };
        const installed = new Date(record.dateInstalled);
        const now = new Date();
        return { age: `${now.getFullYear() - installed.getFullYear()} Yrs`, date: `Installed ${installed.getFullYear()}` };
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

    useEffect(() => {
        if (firebaseConfig) {
            try {
                const app = initializeApp(finalConfig);
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
        const { propertyName, streetAddress, city, state, zip } = e.target.elements;
        if(!propertyName.value) return;
        setIsSaving(true);
        try {
            const data = { name: propertyName.value, address: { street: streetAddress.value, city: city.value, state: state.value, zip: zip.value }, createdAt: serverTimestamp() };
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

    if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Initializing Trellis...</div>;
    if (!userId) return <AuthScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onAppleLogin={handleAppleLogin} onGuestLogin={handleGuestLogin} error={error} />;
    if (isLoadingProfile) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading Profile...</div>;
    if (!propertyProfile) return <div className="min-h-screen bg-gray-50 p-4"><style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style><SetupPropertyForm onSave={handleSaveProfile} isSaving={isSaving} onSignOut={handleSignOut} /></div>;

    return (
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
    );
};

export default App;
