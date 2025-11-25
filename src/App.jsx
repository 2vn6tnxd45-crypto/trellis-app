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
import { Trash2, PlusCircle, Home, Calendar, PaintBucket, HardHat, Info, FileText, ExternalLink, Camera, MapPin, Search, LogOut, Lock, Mail, ChevronDown, Hash, Layers } from 'lucide-react';

// --- Global Firebase & Auth Setup ---

// 1. APP ID: This organizes your data in the database
const appId = 'trellis-home-log'; 

// 2. FIREBASE CONFIG: Keys provided by user
const firebaseConfig = {
  apiKey: "AIzaSyCS2JMaEpI_npBXkHjhjOk10ffZVg5ypaI",
  authDomain: "trellis-6cd18.firebaseapp.com",
  projectId: "trellis-6cd18",
  storageBucket: "trellis-6cd18.firebasestorage.app",
  messagingSenderId: "669423260428",
  appId: "1:669423260428:web:64a5452413682c257cef29",
  measurementId: "G-JBP9F27RN1"
};

// Logic to switch between Preview Environment (here) and Production (Vercel)
const finalConfig = (typeof __firebase_config !== 'undefined' && __firebase_config) 
    ? JSON.parse(__firebase_config) 
    : firebaseConfig;

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The collection path for public, shared app data
const PUBLIC_COLLECTION_PATH = `/artifacts/${appId}/public/data/house_records`;

// --- CATEGORY DEFINITIONS & LOGIC ---

const CATEGORIES = [
    "Paint & Finishes",
    "Appliances",
    "Flooring",
    "HVAC & Systems",
    "Plumbing",
    "Electrical",
    "Roof & Exterior",
    "Landscaping",
    "Service & Repairs",
    "Other"
];

const PAINT_SHEENS = ["Flat/Matte", "Eggshell", "Satin", "Semi-Gloss", "High-Gloss", "Exterior"];
const ROOF_MATERIALS = ["Asphalt Shingles", "Metal", "Clay/Concrete Tile", "Slate", "Wood Shake", "Composite", "Other"];
const FLOORING_TYPES = ["Hardwood", "Laminate", "Vinyl/LVP", "Tile", "Carpet", "Concrete", "Other"];

// State structure for a single record
const initialRecordState = {
    area: '',
    category: '',
    item: '',
    brand: '',
    model: '',
    serialNumber: '', // New field
    material: '',     // New field for Roof/Flooring
    sheen: '',        // New field for Paint
    dateInstalled: '',
    contractor: '',
    contractorUrl: '', // NEW: Link to Yelp, Thumbtack, or Google Maps profile
    notes: '',
    purchaseLink: '',
    imageUrl: '',
};

// --- Embedded Logo Assets ---
const logoSvgString = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="20" fill="white"/>
  <path d="M50 15L85 45V85H15V45L50 15Z" fill="#2A2A72"/>
  <mask id="m" maskUnits="userSpaceOnUse" x="15" y="15" width="70" height="70">
    <path d="M50 15L85 45V85H15V45L50 15Z" fill="white"/>
  </mask>
  <g mask="url(#m)">
    <path d="M15 85L85 15" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <path d="M-5 85L65 15" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <path d="M35 105L105 35" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <path d="M85 85L15 15" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <path d="M105 85L35 15" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <path d="M65 105L-5 35" stroke="white" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>
`;
const logoSrc = `data:image/svg+xml;utf8,${encodeURIComponent(logoSvgString)}`;

// Brand Icons
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const AppleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.74-3.12 1.84-2.6 5.75.64 7.13-.5 1.24-1.14 2.47-2.69 4.14zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.54 4.33-3.74 4.25z" />
    </svg>
);

// --- Helper Functions ---

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// --- Components ---

const CustomConfirm = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4">
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
        const emailParam = params.get('email');
        if (emailParam) {
            setEmail(emailParam);
            setIsSignUp(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);
        setIsLoading(true);
        
        try {
            await onLogin(email, password, isSignUp);
        } catch (err) {
            setLocalError(err.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <img className="mx-auto h-20 w-20 rounded-xl shadow-md" src={logoSrc} alt="Trellis" />
                <h2 className="mt-6 text-3xl font-extrabold text-indigo-900">
                    {isSignUp ? 'Create your Pedigree' : 'Sign in to Trellis'}
                </h2>
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
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={16} className="text-gray-400" /></div>
                                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border" placeholder="you@example.com"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={16} className="text-gray-400" /></div>
                                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border" placeholder="••••••••"/>
                            </div>
                        </div>
                        {(localError || authError) && <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-100">{localError || authError}</div>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                            </button>
                        </div>
                    </form>
                    <div className="mt-6 text-center">
                        <button onClick={onGuestLogin} className="text-xs font-medium text-gray-400 hover:text-gray-600 underline">Try as a Guest (Data will not be saved permanently)</button>
                    </div>
                    <div className="mt-6 text-center border-t pt-4">
                        <button onClick={() => { setIsSignUp(!isSignUp); setLocalError(null); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => {
    const [formData, setFormData] = useState({
        propertyName: '', streetAddress: '', city: '', state: '', zip: ''
    });
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'streetAddress') {
            if (value.length > 2) fetchAddressSuggestions(value);
            else { setSuggestions([]); setShowSuggestions(false); }
        }
    };

    const timeoutRef = useRef(null);
    const fetchAddressSuggestions = (query) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsSearching(true);
            fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`)
                .then(res => res.json())
                .then(data => {
                    setSuggestions(data.features);
                    setShowSuggestions(true);
                    setIsSearching(false);
                })
                .catch(err => { console.error("Address lookup failed", err); setIsSearching(false); });
        }, 400);
    };

    const selectSuggestion = (feature) => {
        const props = feature.properties;
        const streetPart = props.street || '';
        const numberPart = props.housenumber || '';
        const fullStreet = numberPart ? `${numberPart} ${streetPart}` : (props.name || streetPart);
        setFormData(prev => ({
            ...prev, streetAddress: fullStreet, city: props.city || props.town || props.village || '', state: props.state || '', zip: props.postcode || ''
        }));
        setShowSuggestions(false);
    };

    return (
        <div className="flex items-center justify-center min-h-[90vh]">
            <div className="max-w-lg w-full bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-indigo-600 text-center relative">
                <button onClick={onSignOut} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 flex items-center text-xs font-medium">
                    <LogOut size={14} className="mr-1" /> Sign Out
                </button>
                <div className="flex justify-center mb-6"><img src={logoSrc} alt="Trellis Logo" className="h-24 w-24 shadow-md rounded-xl" /></div>
                <h2 className="text-3xl font-extrabold text-indigo-900 mb-2">Property Setup</h2>
                <p className="text-gray-500 mb-8 leading-relaxed text-sm">Start typing your address to auto-fill your property details.</p>
                <form onSubmit={onSave} className="space-y-5 text-left relative">
                    <div>
                        <label htmlFor="propertyName" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Property Nickname</label>
                        <input type="text" name="propertyName" id="propertyName" required value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border transition-shadow"/>
                    </div>
                    <div className="relative">
                        <label htmlFor="streetAddress" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Street Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} />
                            <input type="text" name="streetAddress" id="streetAddress" required value={formData.streetAddress} onChange={handleChange} autoComplete="off" placeholder="Start typing address..." className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 pl-10 border transition-shadow"/>
                            {isSearching && <div className="absolute right-3 top-3.5"><Search className="animate-spin text-indigo-500" size={18} /></div>}
                        </div>
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-auto divide-y divide-gray-100">
                                {suggestions.map((item, index) => (
                                    <li key={index} onClick={() => selectSuggestion(item)} className="p-3 hover:bg-indigo-50 cursor-pointer transition-colors text-sm text-gray-700 flex flex-col">
                                        <span className="font-bold text-indigo-900">{item.properties.name || `${item.properties.housenumber || ''} ${item.properties.street || ''}`}</span>
                                        <span className="text-gray-500 text-xs">{item.properties.city}, {item.properties.state} {item.properties.postcode}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="city" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">City</label>
                            <input type="text" name="city" id="city" required value={formData.city} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border transition-shadow bg-gray-50"/>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label htmlFor="state" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">State</label>
                                <input type="text" name="state" id="state" required value={formData.state} onChange={handleChange} maxLength="20" className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border transition-shadow bg-gray-50"/>
                            </div>
                            <div>
                                <label htmlFor="zip" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Zip</label>
                                <input type="text" name="zip" id="zip" required value={formData.zip} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border transition-shadow bg-gray-50"/>
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={isSaving} className="w-full py-3 px-4 rounded-lg shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center mt-4">
                        {isSaving ? 'Saving Profile...' : 'Create My Home Log'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const RecordCard = ({ record, onDeleteClick }) => (
    <div className="bg-white p-0 rounded-xl shadow-sm border border-indigo-100 transition-all hover:shadow-lg flex flex-col overflow-hidden">
        {record.imageUrl && (
            <div className="h-48 w-full bg-gray-100 relative overflow-hidden group">
                <img src={record.imageUrl} alt={record.item} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
            </div>
        )}
        <div className="p-5 flex flex-col space-y-3 flex-grow">
            <div className="flex justify-between items-start border-b border-indigo-50 pb-2">
                <div className="font-bold text-xl text-indigo-800 leading-tight">{record.item}</div>
                <button onClick={() => onDeleteClick(record.id)} className="p-1 text-red-500 hover:text-red-700 transition-colors rounded-full bg-red-50 hover:bg-red-100 ml-2" title="Delete Record">
                    <Trash2 size={20} />
                </button>
            </div>
            <div className="text-sm space-y-2">
                <p className="flex items-center text-gray-700 font-medium"><Home size={16} className="mr-3 text-indigo-500 min-w-[16px]" /> Area: {record.area}</p>
                <p className="flex items-center text-gray-600"><FileText size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Category: {record.category}</p>
                {record.brand && <p className="flex items-center text-gray-600"><PaintBucket size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.category === 'Paint & Finishes' ? 'Paint Brand' : 'Brand'}: {record.brand}</p>}
                {record.model && <p className="flex items-center text-gray-600"><Info size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.category === 'Paint & Finishes' ? 'Color Name/Code' : 'Model/Code'}: {record.model}</p>}
                
                {/* Dynamic Fields */}
                {record.sheen && <p className="flex items-center text-gray-600"><Layers size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Sheen: {record.sheen}</p>}
                {record.serialNumber && <p className="flex items-center text-gray-600"><Hash size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Serial #: {record.serialNumber}</p>}
                {record.material && <p className="flex items-center text-gray-600"><Info size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Material: {record.material}</p>}
                
                {record.dateInstalled && <p className="flex items-center text-gray-600"><Calendar size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Installed: {record.dateInstalled}</p>}
                
                {/* Updated Contractor Field with Link Support */}
                {record.contractor && (
                    <p className="flex items-center text-gray-600">
                        <HardHat size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> 
                        Contractor: 
                        {record.contractorUrl ? (
                            <a 
                                href={record.contractorUrl.startsWith('http') ? record.contractorUrl : `https://${record.contractorUrl}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-1 text-indigo-600 hover:text-indigo-800 hover:underline font-medium flex items-center"
                            >
                                {record.contractor} <ExternalLink size={12} className="ml-1" />
                            </a>
                        ) : (
                            <span className="ml-1">{record.contractor}</span>
                        )}
                    </p>
                )}
                
                {record.purchaseLink && (
                    <a href={record.purchaseLink.startsWith('http') ? record.purchaseLink : `https://${record.purchaseLink}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-indigo-600 font-semibold hover:text-indigo-800 transition-colors underline pt-1" title={`Go to: ${record.purchaseLink}`}>
                        <ExternalLink size={16} className="mr-3 min-w-[16px]" /> View Replacement Link
                    </a>
                )}
                {record.notes && (
                    <div className="mt-2 pt-3 border-t border-indigo-50">
                        <p className="font-semibold text-gray-700 mb-1">Notes / Warranty:</p>
                        <p className="whitespace-pre-wrap text-xs text-gray-500 bg-gray-50 p-3 rounded-lg shadow-inner">{record.notes}</p>
                    </div>
                )}
            </div>
            <div className="text-xs text-gray-400 pt-2 mt-auto text-right"><p>Logged: {record.timestamp}</p></div>
        </div>
    </div>
);

const AddRecordForm = ({ onSave, isSaving, newRecord, onInputChange, onFileChange }) => {
    // Define dynamic fields logic
    const showSheen = newRecord.category === "Paint & Finishes";
    const showMaterial = ["Roof & Exterior", "Flooring"].includes(newRecord.category);
    const showSerial = ["Appliances", "HVAC & Systems", "Plumbing", "Electrical"].includes(newRecord.category);
    
    // Dynamic Labels
    let brandLabel = "Brand";
    let modelLabel = "Model/Color Code";
    
    if (newRecord.category === "Paint & Finishes") {
        brandLabel = "Paint Brand";
        modelLabel = "Color Name/Code";
    } else if (newRecord.category === "Appliances") {
        brandLabel = "Manufacturer";
        modelLabel = "Model Number";
    }

    return (
        <form onSubmit={onSave} className="p-6 bg-white rounded-xl shadow-2xl border-t-4 border-indigo-600 space-y-4">
            <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b pb-2">Record New Home Data</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 required-label">Category <span className="text-red-500">*</span></label>
                    <div className="relative mt-1">
                        <select
                            name="category"
                            id="category"
                            value={newRecord.category}
                            onChange={onInputChange}
                            required
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow appearance-none bg-white"
                        >
                            <option value="" disabled>Select Category</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>
                 <div>
                    <label htmlFor="area" className="block text-sm font-medium text-gray-700 required-label">Area/Room <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        name="area"
                        id="area"
                        value={newRecord.area}
                        onChange={onInputChange}
                        required
                        placeholder="e.g., Kitchen"
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="item" className="block text-sm font-medium text-gray-700 required-label">Item Name/Service <span className="text-red-500">*</span></label>
                <input
                    type="text"
                    name="item"
                    id="item"
                    value={newRecord.item}
                    onChange={onInputChange}
                    required
                    placeholder={newRecord.category === 'Paint & Finishes' ? "e.g. North Wall Accent" : "e.g. Refrigerator"}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                />
            </div>

             {/* Dynamic Fields Block */}
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                {/* Brand - Always visible but label changes */}
                <div>
                    <label htmlFor="brand" className="block text-sm font-medium text-gray-700">{brandLabel}</label>
                    <input
                        type="text"
                        name="brand"
                        id="brand"
                        value={newRecord.brand}
                        onChange={onInputChange}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                    />
                </div>

                {/* Model - Always visible but label changes */}
                <div>
                    <label htmlFor="model" className="block text-sm font-medium text-gray-700">{modelLabel}</label>
                    <input
                        type="text"
                        name="model"
                        id="model"
                        value={newRecord.model}
                        onChange={onInputChange}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                    />
                </div>

                 {/* Paint Sheen (Conditional) */}
                 {showSheen && (
                    <div>
                        <label htmlFor="sheen" className="block text-sm font-medium text-gray-700">Sheen</label>
                         <div className="relative mt-1">
                            <select
                                name="sheen"
                                id="sheen"
                                value={newRecord.sheen}
                                onChange={onInputChange}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow appearance-none bg-white"
                            >
                                <option value="" disabled>Select Sheen</option>
                                {PAINT_SHEENS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Serial Number (Conditional) */}
                {showSerial && (
                     <div>
                        <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700">Serial Number</label>
                        <input
                            type="text"
                            name="serialNumber"
                            id="serialNumber"
                            value={newRecord.serialNumber}
                            onChange={onInputChange}
                            placeholder="See warranty card"
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                        />
                    </div>
                )}

                {/* Material Type (Conditional) */}
                {showMaterial && (
                    <div>
                        <label htmlFor="material" className="block text-sm font-medium text-gray-700">Material Type</label>
                         <div className="relative mt-1">
                            <select
                                name="material"
                                id="material"
                                value={newRecord.material}
                                onChange={onInputChange}
                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow appearance-none bg-white"
                            >
                                <option value="" disabled>Select Material</option>
                                {(newRecord.category === "Roof & Exterior" ? ROOF_MATERIALS : FLOORING_TYPES).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>
                )}
             </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="dateInstalled" className="block text-sm font-medium text-gray-700">Date Installed / Service Date</label>
                    <input
                        type="date"
                        name="dateInstalled"
                        id="dateInstalled"
                        value={newRecord.dateInstalled}
                        onChange={onInputChange}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                    />
                </div>
                 
                 {/* Updated Contractor Section with URL */}
                 <div className="space-y-2">
                    <div>
                        <label htmlFor="contractor" className="block text-sm font-medium text-gray-700">Contractor/Company</label>
                        <input
                            type="text"
                            name="contractor"
                            id="contractor"
                            value={newRecord.contractor}
                            onChange={onInputChange}
                            placeholder="e.g. Joe's Plumbing"
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                        />
                    </div>
                    <div>
                        <label htmlFor="contractorUrl" className="block text-xs font-medium text-gray-500">Profile Link (Yelp/Thumbtack/Google)</label>
                        <input
                            type="url"
                            name="contractorUrl"
                            id="contractorUrl"
                            value={newRecord.contractorUrl}
                            onChange={onInputChange}
                            placeholder="https://yelp.com/biz/..."
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow text-sm"
                        />
                    </div>
                </div>
            </div>
            
            <div>
                <label htmlFor="purchaseLink" className="block text-sm font-medium text-gray-700">Replacement Purchase Link</label>
                <input
                    type="url"
                    name="purchaseLink"
                    id="purchaseLink"
                    value={newRecord.purchaseLink}
                    onChange={onInputChange}
                    placeholder="e.g. https://www.homedepot.com/..."
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow"
                />
            </div>

            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <label htmlFor="photo" className="block text-sm font-bold text-indigo-900 mb-2 flex items-center">
                    <Camera size={18} className="mr-2" /> Upload Photo (Receipt, Label, etc.)
                </label>
                <input
                    type="file"
                    id="photo"
                    accept="image/*"
                    onChange={onFileChange}
                    className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-100 file:text-indigo-700
                        hover:file:bg-indigo-200
                        cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">Supported: JPG, PNG. Max 1MB recommended.</p>
            </div>

            <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes & Warranty Details</label>
                <textarea
                    name="notes"
                    id="notes"
                    rows="4"
                    value={newRecord.notes}
                    onChange={onInputChange}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border transition-shadow resize-none"
                ></textarea>
            </div>
            
            <button
                type="submit"
                disabled={isSaving}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
                {isSaving ? (
                    'Saving Record...'
                ) : (
                    <>
                        <PlusCircle size={20} className="mr-2" />
                        Log New Home Component
                    </>
                )}
            </button>
        </form>
    );
};

// --- Main Application Component ---

const App = () => {
    // Firebase State
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    // Storage state removed for now
    // const [storage, setStorage] = useState(null); 
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Property Profile State
    const [propertyProfile, setPropertyProfile] = useState(null); 
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Application State
    const [records, setRecords] = useState([]);
    const [newRecord, setNewRecord] = useState(initialRecordState);
    const [selectedFile, setSelectedFile] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('View Records'); 
    const [confirmDelete, setConfirmDelete] = useState(null);

    // 1. Initialize Firebase
    useEffect(() => {
        if (firebaseConfig) {
            try {
                const app = initializeApp(finalConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);
                // const firebaseStorage = getStorage(app); // Paused
                
                setLogLevel('error'); 
                
                setDb(firestore);
                setAuth(firebaseAuth);
                // setStorage(firebaseStorage);

                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else if (initialAuthToken) {
                        await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        setUserId(firebaseAuth.currentUser.uid);
                    } else {
                        // No more auto sign-in here! We wait for user action.
                        setUserId(null);
                    }
                    setIsAuthReady(true);
                    setLoading(false); // Stop loading spinner once we know auth state
                });

                return () => unsubscribe();
            } catch (err) {
                console.error("Firebase initialization failed:", err);
                setError("Could not initialize Firebase services.");
                setLoading(false);
            }
        } else {
            setError("Firebase configuration is missing or invalid.");
            setLoading(false);
        }
    }, []);

    // 2. Fetch Property Profile (Global Settings)
    useEffect(() => {
        if (!isAuthReady || !db || !userId) {
            if (isAuthReady && !userId) {
                setIsLoadingProfile(false); // Stop profile loading if not logged in
            }
            return;
        }

        const fetchProfile = async () => {
            try {
                const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile');
                const profileSnap = await getDoc(profileRef);

                if (profileSnap.exists()) {
                    setPropertyProfile(profileSnap.data());
                } else {
                    setPropertyProfile(null);
                }
            } catch (err) {
                console.error("Error fetching profile:", err);
            } finally {
                setIsLoadingProfile(false);
                setLoading(false);
            }
        };

        fetchProfile();
    }, [isAuthReady, db, userId]);

    // 3. Load Records (Only if profile is set)
    useEffect(() => {
        if (!isAuthReady || !db || !propertyProfile) return;

        const q = query(collection(db, PUBLIC_COLLECTION_PATH));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate().toLocaleDateString() || 'N/A'
            }));
            setRecords(fetchedRecords);
        }, (err) => {
            console.error("Error fetching records:", err);
            setError("Failed to load maintenance records.");
        });

        return () => unsubscribe();
    }, [isAuthReady, db, propertyProfile]);

    // --- Handlers ---

    // Auth Handlers
    const handleLogin = async (email, password, isSignUp) => {
        if (!auth) return;
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            // onAuthStateChanged will trigger updates
        } catch (err) {
            let msg = "Authentication failed.";
            if (err.code === 'auth/user-not-found') msg = "No account found with this email.";
            if (err.code === 'auth/wrong-password') msg = "Incorrect password.";
            if (err.code === 'auth/email-already-in-use') msg = "Email already in use.";
            if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
            throw new Error(msg);
        }
    };

    // New Google Login Handler
    const handleGoogleLogin = async () => {
        if (!auth) return;
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Google login error", err);
            throw new Error("Google sign-in failed. Please try again.");
        }
    };

    // New Apple Login Handler
    const handleAppleLogin = async () => {
        if (!auth) return;
        try {
            const provider = new OAuthProvider('apple.com');
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Apple login error", err);
            throw new Error("Apple sign-in failed. Please try again.");
        }
    };

    const handleGuestLogin = async () => {
        if (!auth) return;
        try {
            await signInAnonymously(auth);
        } catch (err) {
            throw new Error("Guest login failed.");
        }
    };

    const handleSignOut = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setUserId(null);
            setPropertyProfile(null);
            setRecords([]);
        } catch (err) {
            console.error("Sign out error", err);
        }
    };

    const handleSavePropertyProfile = async (e) => {
        e.preventDefault();
        
        const name = e.target.propertyName.value;
        const street = e.target.streetAddress.value;
        const city = e.target.city.value;
        const state = e.target.state.value;
        const zip = e.target.zip.value;

        if (!name || !street || !zip || !db || !userId) return;

        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            const profileData = { 
                name,
                address: { street, city, state, zip },
                createdAt: serverTimestamp() 
            };
            
            await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile'), profileData);
            setPropertyProfile(profileData); 
        } catch (err) {
            console.error("Error saving profile:", err);
            // Improved error message for debugging
            if (err.code === 'permission-denied') {
                setError("Permission denied. Please check your Firestore Database Rules in the Firebase Console.");
            } else {
                setError("Could not save property details: " + err.message);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setNewRecord(prev => ({ ...prev, [name]: value }));
    }, []); 

    const handleFileChange = useCallback((e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    }, []);

    const saveRecord = useCallback(async (e) => {
        e.preventDefault();
        if (!db || !userId || isSaving) return;

        if (!newRecord.area || !newRecord.category || !newRecord.item) {
            setError("Please fill in Area/Room, Category, and Item Name.");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            let finalImageUrl = '';

            if (selectedFile) {
                // Simplified for no-cost storage: Convert to Base64 string
                // Note: Large strings in Firestore can be expensive/slow, so we limit size strictly.
                if (selectedFile.size < 1048576) { // 1MB limit
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
    }, [db, userId, isSaving, newRecord, selectedFile, /* storage, */ propertyProfile]); // Removed storage from dependency array

    
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
                <SetupPropertyForm onSave={handleSavePropertyProfile} isSaving={isSaving} onSignOut={handleSignOut} />
            </div>
        );
    }

    // 3. Main App UI (Authenticated & Setup Complete)
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
                body { font-family: 'Inter', sans-serif; }
            `}</style>
            
            <link rel="icon" type="image/svg+xml" href={logoSrc} />
            
            <header className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center relative">
                <button 
                    onClick={handleSignOut}
                    className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 flex items-center text-xs font-medium sm:mt-2"
                    title="Sign Out"
                >
                    <LogOut size={16} className="mr-1" /> Sign Out
                </button>

                <img src={logoSrc} alt="Trellis Logo" className="h-20 w-20 mb-4 sm:mb-0 sm:mr-6 shadow-sm rounded-xl" />
                <div className="text-center sm:text-left">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-900 tracking-tighter">
                        <span className="text-indigo-600">Trellis</span> Home Log
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        The official Property Pedigree for your home's maintenance and upgrades.
                    </p>
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
                    className={`flex-1 px-4 py-3 text-sm sm:text-base font-semibold rounded-r-xl transition-all border-b-2 ${
                        activeTab === 'Add Record' 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-inner' 
                            : 'bg-white text-gray-600 hover:bg-indigo-50 border-gray-200'
                    }`}
                >
                    Add New Component
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {groupedRecords[area].map(record => (
                                            <RecordCard 
                                                key={record.id} 
                                                record={record} 
                                                onDeleteClick={setConfirmDelete}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))
                        ) : (
                            <div className="text-center p-12 bg-white rounded-xl shadow-lg border-2 border-dashed border-indigo-200">
                                <FileText size={48} className="mx-auto text-indigo-400 mb-4" />
                                <p className="text-gray-600 font-medium text-lg">Your Trellis Log is Empty.</p>
                                <p className="text-gray-500 mt-2">Start by logging your HVAC, flooring, or paint details in the "Add New Component" tab.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
            
            {confirmDelete && (
                <CustomConfirm
                    message="Are you absolutely sure you want to delete this home record? This action cannot be reversed."
                    onConfirm={handleDeleteConfirmed}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
};

export default App;
