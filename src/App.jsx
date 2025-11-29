import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    GoogleAuthProvider, OAuthProvider, signInWithPopup, deleteUser, EmailAuthProvider, reauthenticateWithCredential
} from 'firebase/auth';
import { 
    getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, 
    doc, deleteDoc, setLogLevel, setDoc, getDoc, writeBatch, getDocs, updateDoc, where
} from 'firebase/firestore';
// FIX: Use the 'preview' path which is safer for build servers
import { getVertexAI, getGenerativeModel } from "firebase/vertexai-preview";
import { Trash2, PlusCircle, Home, Calendar, PaintBucket, HardHat, Info, FileText, ExternalLink, Camera, MapPin, Search, LogOut, Lock, Mail, ChevronDown, Hash, Layers, X, Printer, Map as MapIcon, ShoppingBag, Sun, Wind, Zap, AlertTriangle, UserMinus, Pencil, Send, CheckCircle, Link as LinkIcon, Clock, Palette, Key, User, Tag, Box, UploadCloud, Wrench, ListChecks } from 'lucide-react';

// --- Global Config & Init ---

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

const googleMapsApiKey = "AIzaSyC1gVI-IeB2mbLAlHgJDmrPKwcZTpVWPOw"; 
const PUBLIC_COLLECTION_PATH = `/artifacts/${appId}/public/data/house_records`;
const REQUESTS_COLLECTION_PATH = `/artifacts/${appId}/public/data/requests`;

// Initialize Firebase GLOBALLY
let app, auth, db;
try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // NEW: Start the AI engine
    const vertexAI = getVertexAI(app);
    // FIX: Updated to Gemini 2.0 Flash because 1.5 is retired
    window.geminiModel = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });

} catch (e) {
    console.error("Firebase Init Error:", e);
}

// --- Helper: Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 min-h-screen flex flex-col items-center justify-center text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mb-4" />
          <h1 className="text-2xl font-bold text-red-800 mb-2">Something went wrong.</h1>
          <p className="text-red-600 mb-4">The application encountered a critical error.</p>
          <div className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-lg w-full mb-4">
             <code className="text-xs text-red-500 font-mono">{this.state.error?.toString()}</code>
          </div>
          <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reload Page</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// --- HAUSKEY LOGO ---
const logoHausKey = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <!-- House Outline -->
  <path d="M50 10L15 40V90H85V40L50 10Z" stroke="#4F46E5" stroke-width="8" stroke-linejoin="round" fill="none"/>
  
  <!-- Key Shape (Integrated) -->
  <circle cx="50" cy="50" r="10" fill="#4F46E5"/>
  <rect x="46" y="55" width="8" height="25" rx="2" fill="#4F46E5"/>
  <rect x="54" y="65" width="6" height="4" fill="#4F46E5"/>
  <rect x="54" y="72" width="4" height="4" fill="#4F46E5"/>
  
  <!-- Key Hole Detail -->
  <circle cx="50" cy="50" r="3" fill="white"/>
</svg>
`)}`;

// --- Helper: Safe Logo Default ---
const logoSrc = logoHausKey;

// --- Helper Functions ---

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

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

// --- Date Helper for Maintenance ---
const calculateNextDate = (startDate, frequency) => {
    if (!startDate || !frequency || frequency === 'none') return null;
    
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null; // Invalid date check

    const freqMap = {
        'quarterly': 3,
        'semiannual': 6,
        'annual': 12,
        'biennial': 24,
        'quinquennial': 60
    };

    const monthsToAdd = freqMap[frequency];
    if (!monthsToAdd) return null;

    // Calculate next date by adding months
    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    
    return nextDate.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};


// --- CATEGORY & ROOM DEFINITIONS ---
const CATEGORIES = ["Paint & Finishes", "Appliances", "Flooring", "HVAC & Systems", "Plumbing", "Electrical", "Roof & Exterior", "Landscaping", "Service & Repairs", "Other"];
const ROOMS = ["Kitchen", "Living Room", "Dining Room", "Master Bedroom", "Bedroom", "Master Bathroom", "Bathroom", "Office", "Laundry Room", "Garage", "Basement", "Attic", "Exterior", "Hallway", "Entryway", "Patio/Deck", "Other (Custom)"];
const PAINT_SHEENS = ["Flat/Matte", "Eggshell", "Satin", "Semi-Gloss", "High-Gloss", "Exterior"];
const ROOF_MATERIALS = ["Asphalt Shingles", "Metal", "Clay/Concrete Tile", "Slate", "Wood Shake", "Composite", "Other"];
const FLOORING_TYPES = ["Hardwood", "Laminate", "Vinyl/LVP", "Tile", "Carpet", "Concrete", "Other"];
const MAINTENANCE_FREQUENCIES = [
    { label: "None (One-time)", value: "none", months: 0 },
    { label: "Quarterly (Every 3 Mo)", value: "quarterly", months: 3 },
    { label: "Bi-Annually (Every 6 Mo)", value: "semiannual", months: 6 },
    { label: "Annually (Every 12 Mo)", value: "annual", months: 12 },
    { label: "Every 2 Years", value: "biennial", months: 24 },
    { label: "Every 5 Years", value: "quinquennial", months: 60 }
];


const initialRecordState = {
    area: '', category: '', item: '', brand: '', model: '', serialNumber: '', 
    material: '', sheen: '', dateInstalled: '', contractor: '', contractorUrl: '',
    notes: '', purchaseLink: '', imageUrl: '', maintenanceFrequency: 'none', nextServiceDate: null, maintenanceTasks: [] // NEW FIELD
};

// --- Components ---
const GoogleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>);
const AppleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.74-3.12 1.84-2.6 5.75.64 7.13-.5 1.24-1.14 2.47-2.69 4.14zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.54 4.33-3.74 4.25z" /></svg>);

const ReauthModal = ({ onConfirm, onCancel, isLoading }) => { const [password, setPassword] = useState(''); const [error, setError] = useState(null); const handleSubmit = (e) => { e.preventDefault(); setError(null); if (!password) { setError("Password is required."); return; } onConfirm(password).catch(err => setError(err.message || "Re-authentication failed.")); }; return (<div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden"><div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full"><h3 className="text-xl font-semibold text-red-800 mb-2">Security Check</h3><p className="text-gray-600 mb-4 text-sm">Please re-enter your password to confirm permanent account deletion.</p><form onSubmit={handleSubmit} className="space-y-4"><input type="password" placeholder="Current Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" required />{error && <p className="text-red-600 text-xs">{error}</p>}<div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button><button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50">{isLoading ? 'Deleting...' : 'Confirm Deletion'}</button></div></form></div></div>); };
const CustomConfirm = ({ message, onConfirm, onCancel, type = 'delete' }) => (<div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden"><div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full"><h3 className="text-xl font-semibold text-gray-800 mb-4">{type === 'account' ? 'Confirm Account Deletion' : 'Confirm Action'}</h3><p className="text-gray-600 mb-6">{message}</p><div className="flex justify-end space-x-3"><button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"><X size={16} className="mr-1"/>Cancel</button><button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${type === 'account' ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'}`}>{type === 'account' ? 'Delete Permanently' : 'Delete'}</button></div></div></div>);
const AuthScreen = ({ onLogin, onGoogleLogin, onAppleLogin, onGuestLogin, error: authError }) => { const [isSignUp, setIsSignUp] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [localError, setLocalError] = useState(null); const [isLoading, setIsLoading] = useState(false); useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get('email')) { setEmail(params.get('email')); setIsSignUp(true); } }, []); const handleSubmit = async (e) => { e.preventDefault(); setLocalError(null); setIsLoading(true); try { await onLogin(email, password, isSignUp); } catch (err) { setLocalError(err.message); setIsLoading(false); } }; return (<div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans print:hidden"><style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style><div className="sm:mx-auto sm:w-full sm:max-w-md text-center"><img className="mx-auto h-24 w-24 rounded-xl shadow-md bg-white p-1" src={logoSrc} alt="HausKey" /><h2 className="mt-6 text-3xl font-extrabold text-indigo-900">{isSignUp ? 'Create your Pedigree' : 'Sign in to HausKey'}</h2><p className="mt-2 text-sm text-gray-600">The permanent record for your home.</p></div><div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"><div className="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10 border border-indigo-50"><div className="grid grid-cols-2 gap-3 mb-6"><button onClick={onGoogleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><span className="mr-2"><GoogleIcon /></span> Google</button><button onClick={onAppleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><span className="mr-2"><AppleIcon /></span> Apple</button></div><div className="relative mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with email</span></div></div><form className="space-y-6" onSubmit={handleSubmit}><div><label className="block text-sm font-medium text-gray-700">Email</label><div className="mt-1 relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={16} className="text-gray-400" /></div><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border" placeholder="you@example.com"/></div></div><div><label className="block text-sm font-medium text-gray-700">Password</label><div className="mt-1 relative rounded-md shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={16} className="text-gray-400" /></div><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-3 border" placeholder="••••••••"/></div></div>{(localError || authError) && <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-100">{localError || authError}</div>}<button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}</button></form><div className="mt-6 text-center"><button onClick={onGuestLogin} className="text-xs font-medium text-gray-400 hover:text-gray-600 underline">Try as a Guest</button></div></div></div></div>); };
const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => { const [formData, setFormData] = useState({ propertyName: '', streetAddress: '', city: '', state: '', zip: '', lat: null, lon: null, yearBuilt: '', sqFt: '', lotSize: '' }); const inputRef = useRef(null); useEffect(() => { window.gm_authFailure = () => { console.error("Google Maps Auth Failure detected"); alert("Google Maps API Key Error."); }; loadGoogleMapsScript().then(() => { if (inputRef.current && window.google && window.google.maps && window.google.maps.places) { try { const auto = new window.google.maps.places.Autocomplete(inputRef.current, { types: ['address'], fields: ['address_components', 'geometry', 'formatted_address'] }); inputRef.current.addEventListener('keydown', (e) => { if(e.key === 'Enter') e.preventDefault(); }); auto.addListener('place_changed', () => { const place = auto.getPlace(); if (!place.geometry) return; let streetNum = '', route = '', city = '', state = '', zip = ''; if (place.address_components) { place.address_components.forEach(comp => { if (comp.types.includes('street_number')) streetNum = comp.long_name; if (comp.types.includes('route')) route = comp.long_name; if (comp.types.includes('locality')) city = comp.long_name; if (comp.types.includes('administrative_area_level_1')) state = comp.short_name; if (comp.types.includes('postal_code')) zip = comp.long_name; }); } setFormData(prev => ({ ...prev, streetAddress: `${streetNum} ${route}`.trim(), city, state, zip, lat: place.geometry.location.lat(), lon: place.geometry.location.lng() })); if (inputRef.current) inputRef.current.value = `${streetNum} ${route}`.trim(); }); } catch (e) { console.warn("Google Auto fail", e); } } }).catch(err => console.error("Maps load error", err)); }, []); const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); }; const handleSubmit = (e) => { e.preventDefault(); const formDataObj = new FormData(e.target); if (inputRef.current) formDataObj.set('streetAddress', inputRef.current.value); onSave(formDataObj); }; return (<div className="flex items-center justify-center min-h-[90vh] print:hidden"><div className="max-w-lg w-full bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-indigo-600 text-center relative"><button onClick={onSignOut} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 flex items-center text-xs font-medium"><LogOut size={14} className="mr-1" /> Sign Out</button><div className="flex justify-center mb-6"><img src={logoSrc} alt="HausKey Logo" className="h-24 w-24 shadow-md rounded-xl" style={{height:'64px',width:'64px'}} /><h2 className="text-3xl font-extrabold text-indigo-900 mb-2">Property Setup</h2><p className="text-gray-500 mb-6 leading-relaxed text-sm">Start typing your address.</p></div><form onSubmit={handleSubmit} className="space-y-5 text-left relative"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nickname</label><input type="text" name="propertyName" value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div className="relative"><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Street Address</label><div className="relative"><MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} /><input ref={inputRef} type="text" name="streetAddress" defaultValue={formData.streetAddress} autoComplete="new-password" placeholder="Start typing address..." className="w-full rounded-lg border-gray-300 shadow-sm p-3 pl-10 border"/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">City</label><input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">State</label><input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div><div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Zip</label><input type="text" name="zip" value={formData.zip} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-3 border"/></div></div></div><div className="pt-4 border-t border-gray-100"><p className="text-xs text-indigo-600 font-semibold mb-3">Details (Optional)</p><div className="grid grid-cols-3 gap-3"><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Year Built</label><input type="number" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sq Ft</label><input type="number" name="sqFt" value={formData.sqFt} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lot Size</label><input type="text" name="lotSize" value={formData.lotSize} onChange={handleChange} className="w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div></div></div><input type="hidden" name="lat" value={formData.lat || ''} /><input type="hidden" name="lon" value={formData.lon || ''} /><button type="submit" disabled={isSaving} className="w-full py-3 px-4 rounded-lg shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 font-bold text-lg disabled:opacity-70">{isSaving ? 'Saving...' : 'Create My Home Log'}</button></form></div></div>); };

// --- NEW: Maintenance Dashboard Component ---
const MaintenanceDashboard = ({ records }) => {
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        if (records) {
            const maintenanceTasks = records
                .filter(r => r.maintenanceFrequency && r.maintenanceFrequency !== 'none' && r.nextServiceDate)
                .map(r => {
                    const today = new Date();
                    const serviceDate = new Date(r.nextServiceDate);
                    const timeDiff = serviceDate.getTime() - today.getTime();
                    const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    
                    let status = 'upcoming';
                    if (daysUntil < 0) status = 'overdue';
                    else if (daysUntil <= 30) status = 'due-soon';

                    return { ...r, daysUntil, status };
                })
                .sort((a, b) => a.daysUntil - b.daysUntil);
            
            setTasks(maintenanceTasks);
        }
    }, [records]);

    if (tasks.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-lg border-2 border-dashed border-indigo-200">
                <Wrench size={48} className="mx-auto text-indigo-400 mb-4"/>
                <p className="text-gray-600 font-medium text-lg">No maintenance scheduled.</p>
                <p className="text-gray-400 text-sm mt-2">Add maintenance frequency to your records to see upcoming tasks here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
                 <h2 className="text-2xl font-bold text-indigo-900 mb-4 flex items-center">
                    <Wrench className="mr-2 h-6 w-6 text-indigo-600" /> Maintenance Schedule
                </h2>
                <div className="grid gap-4">
                    {tasks.map(task => (
                        <div key={task.id} className={`p-4 rounded-lg border-l-4 shadow-sm bg-white ${
                            task.status === 'overdue' ? 'border-red-500 bg-red-50' : 
                            task.status === 'due-soon' ? 'border-yellow-500 bg-yellow-50' : 
                            'border-green-500'
                        }`}>
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h4 className="font-bold text-gray-800">{task.item}</h4>
                                    <p className="text-sm text-gray-600">{task.category} - {MAINTENANCE_FREQUENCIES.find(f => f.value === task.maintenanceFrequency)?.label}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${
                                        task.status === 'overdue' ? 'text-red-600' : 
                                        task.status === 'due-soon' ? 'text-yellow-600' : 
                                        'text-green-600'
                                    }`}>
                                        {task.status === 'overdue' ? `Overdue by ${Math.abs(task.daysUntil)} days` : `Due in ${task.daysUntil} days`}
                                    </p>
                                    <p className="text-xs text-gray-500">{new Date(task.nextServiceDate).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            {/* UPDATED: Show Tasks in Dashboard */}
                            {task.maintenanceTasks && task.maintenanceTasks.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200/50">
                                    <p className="text-xs font-bold text-gray-500 mb-1 flex items-center">
                                        <ListChecks size={12} className="mr-1"/> Recommended Tasks:
                                    </p>
                                    <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                                        {task.maintenanceTasks.map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// Contractor Form Component (Visual Redesign & Logo Fix)
const ContractorView = () => {
    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({ category: '', item: '', brand: '', model: '', notes: '', contractor: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0] });
    const [selectedFile, setSelectedFile] = useState(null);
    
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestId = params.get('requestId');
        if (!requestId) { setError("Invalid request link."); setLoading(false); return; }
        const fetchRequest = async () => {
            try {
                // Try anon auth, if it fails (disabled in console), assume public access is okay or user is logged in
                if (!auth.currentUser) { 
                    try { await signInAnonymously(auth); } catch(e) { console.warn("Anon auth failed, trying public access"); } 
                }
                const docRef = doc(db, REQUESTS_COLLECTION_PATH, requestId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().status === 'pending') {
                    setRequestData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError("This request has expired or does not exist.");
                }
            } catch (e) { 
                setError("Could not load request details. Please contact the homeowner."); 
                console.error(e); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchRequest();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(!requestData) return;
        setLoading(true);
        try {
            let imageUrl = '';
            if (selectedFile && selectedFile.size < 1048576) { imageUrl = await fileToBase64(selectedFile); }
            
            // Calculate next service date here too
            const nextServiceDate = calculateNextDate(formData.dateInstalled, formData.maintenanceFrequency);

            await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, requestData.id), {
                ...formData,
                imageUrl,
                nextServiceDate, // Save calculated date
                status: 'submitted',
                submittedAt: serverTimestamp()
            });
            setSubmitted(true);
        } catch (e) { setError("Submission failed: " + e.message); } finally { setLoading(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-indigo-600 font-medium">Loading Request...</div>;
    if (submitted) return (
        <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
            <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md border border-green-100">
                <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-12 w-12 text-green-600"/>
                </div>
                <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Submission Received!</h1>
                <p className="text-gray-500 text-lg">Thank you. The homeowner has been notified and the record is pending approval.</p>
            </div>
        </div>
    );
    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md border-t-4 border-red-500">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Unable to Load Request</h3>
                <p className="text-gray-500">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans flex justify-center">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-indigo-900 p-8 text-center relative overflow-hidden">
                     <div className="relative z-10 flex flex-col items-center">
                        {/* FIXED LOGO SIZE */}
                        <div className="bg-white p-3 rounded-2xl shadow-lg mb-4">
                            <img src={logoSrc} alt="HausKey Logo" className="object-contain" style={{ width: '64px', height: '64px' }} />
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Contractor Submission</h1>
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-800/50 border border-indigo-700 text-indigo-200 text-sm mt-2">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                            Active Request for {requestData?.propertyName}
                        </div>
                        <p className="text-indigo-200 mt-4 font-medium border-t border-indigo-800/50 pt-4 w-full max-w-xs mx-auto">
                           PROJECT: <span className="text-white font-bold uppercase tracking-wide">{requestData?.description || "Maintenance"}</span>
                        </p>
                     </div>
                     {/* Background Pattern */}
                     <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    
                    {/* Section 1: Who */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">1. Contractor Details</h4>
                        <div className="relative group">
                            <User className="absolute left-4 top-3.5 text-gray-400 h-5 w-5 group-focus-within:text-indigo-500 transition-colors"/>
                            <input type="text" placeholder="Your Name or Company Name" className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-gray-800" required value={formData.contractor} onChange={e=>setFormData({...formData, contractor: e.target.value})} />
                        </div>
                    </div>

                    {/* Section 2: What */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">2. Component Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative group">
                                <Tag className="absolute left-4 top-3.5 text-gray-400 h-5 w-5 group-focus-within:text-indigo-500 transition-colors"/>
                                <select className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-medium text-gray-700" required value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})}>
                                    <option value="" disabled>Select Category</option>
                                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-4 text-gray-400 h-4 w-4 pointer-events-none"/>
                            </div>
                            <div className="relative group">
                                <Box className="absolute left-4 top-3.5 text-gray-400 h-5 w-5 group-focus-within:text-indigo-500 transition-colors"/>
                                <input type="text" placeholder="Item Name (e.g. Furnace)" className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-gray-800" required value={formData.item} onChange={e=>setFormData({...formData, item: e.target.value})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Brand / Manufacturer</label>
                                <input type="text" placeholder="e.g. Trane" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Model / Serial #</label>
                                <input type="text" placeholder="e.g. TUD2C100A9V5" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} />
                            </div>
                        </div>
                        
                        {/* Maintenance for Contractor */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Date Work Completed</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/>
                                    <input type="date" className="w-full pl-10 p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.dateInstalled} onChange={e=>setFormData({...formData, dateInstalled: e.target.value})} required/>
                                </div>
                            </div>
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Recommended Maintenance</label>
                                 <div className="relative">
                                    <Clock className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/>
                                    <select className="w-full pl-10 p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.maintenanceFrequency} onChange={e=>setFormData({...formData, maintenanceFrequency: e.target.value})}>
                                        {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-4 text-gray-400 h-4 w-4 pointer-events-none"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Documentation */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">3. Documentation</h4>
                        <textarea placeholder="Notes, warranty expiration dates, filter sizes, or maintenance instructions..." className="w-full p-4 border border-gray-200 rounded-xl h-32 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-gray-700" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}></textarea>
                        
                        <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-8 text-center hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer relative group bg-gray-50">
                             <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" accept="image/*" onChange={e=>setSelectedFile(e.target.files[0])} />
                             <div className="flex flex-col items-center relative z-10">
                                <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <UploadCloud className="h-6 w-6 text-indigo-600"/>
                                </div>
                                <span className="text-indigo-900 font-bold text-lg group-hover:text-indigo-700">Upload Receipt or Photo</span>
                                <span className="text-gray-500 text-sm mt-1 max-w-xs">{selectedFile ? <span className="text-green-600 font-bold flex items-center justify-center"><CheckCircle className="h-3 w-3 mr-1"/> {selectedFile.name}</span> : "Drag and drop or click to browse (Max 1MB)"}</span>
                             </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center group">
                        <span>Submit Record</span>
                        <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform"/>
                    </button>
                </form>
            </div>
        </div>
    );
};

// Request Manager Component
const RequestManager = ({ userId, propertyName }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newRequestName, setNewRequestName] = useState('');

    useEffect(() => {
        const q = query(collection(db, REQUESTS_COLLECTION_PATH), where("userId", "==", userId));
        const unsub = onSnapshot(q, (snap) => {
            setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [userId]);

    const createRequest = async () => {
        if (!newRequestName.trim()) {
            alert("Please enter a contractor name or job description.");
            return;
        }
        setLoading(true);
        try {
            await addDoc(collection(db, REQUESTS_COLLECTION_PATH), {
                userId,
                propertyName,
                description: newRequestName, 
                status: 'pending',
                createdAt: serverTimestamp()
            });
            setNewRequestName(''); 
        } catch (e) { alert("Error creating request"); } finally { setLoading(false); }
    };

    const approveRequest = async (req) => {
        if (!confirm("Approve this record and add to your log?")) return;
        try {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/house_records`), {
                userId,
                propertyLocation: propertyName,
                category: req.category,
                item: req.item,
                brand: req.brand || '',
                model: req.model || '',
                notes: req.notes || '',
                contractor: req.contractor || '',
                imageUrl: req.imageUrl || '',
                dateInstalled: new Date().toISOString().split('T')[0], // Default to today
                timestamp: serverTimestamp(),
                maintenanceFrequency: req.maintenanceFrequency || 'none',
                nextServiceDate: req.nextServiceDate || null // Import date from request
            });
            await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, req.id));
        } catch(e) { alert("Approval failed: " + e.message); }
    };

    const copyLink = (id) => {
        const baseUrl = window.location.href.split('?')[0];
        const url = `${baseUrl}?requestId=${id}`;
        navigator.clipboard.writeText(url);
        alert("Link copied! Send this to your contractor.");
    };

    const sendEmail = (id, description) => {
        const baseUrl = window.location.href.split('?')[0];
        const url = `${baseUrl}?requestId=${id}`;
        const subject = encodeURIComponent(`Contractor Request: ${description}`);
        const body = encodeURIComponent(`Hello,\n\nPlease fill out the project details for ${description} here:\n\n${url}\n\nThanks!`);
        window.open(`mailto:?subject=${subject}&body=${body}`);
    };

    const deleteRequest = async (id) => {
        if(confirm("Delete this request?")) await deleteDoc(doc(db, REQUESTS_COLLECTION_PATH, id));
    }

    const pending = requests.filter(r => r.status === 'pending');
    const submitted = requests.filter(r => r.status === 'submitted');

    return (
        <div className="space-y-8">
            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-indigo-900">Request Links</h3>
                    <p className="text-sm text-indigo-600">Generate a unique link for a contractor to fill out the record.</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                     <input 
                        type="text" 
                        placeholder="e.g. Kitchen Painter" 
                        className="px-4 py-3 rounded-lg border border-indigo-200 flex-grow"
                        value={newRequestName}
                        onChange={(e) => setNewRequestName(e.target.value)}
                     />
                    <button onClick={createRequest} disabled={loading} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 flex items-center whitespace-nowrap">
                        <PlusCircle className="mr-2 h-5 w-5"/> Create
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Clock className="mr-2 h-4 w-4"/> Pending ({pending.length})</h4>
                    {pending.length === 0 ? <p className="text-sm text-gray-400 italic">No active links.</p> : (
                        <ul className="space-y-3">
                            {pending.map(r => (
                                <li key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="flex flex-col">
                                         <span className="text-sm font-bold text-gray-700">{r.description || "Untitled Request"}</span>
                                         <span className="text-xs text-gray-400 font-mono">ID: {r.id.slice(0,6)}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <button onClick={() => copyLink(r.id)} className="text-indigo-600 text-xs font-bold hover:underline flex items-center mr-3"><LinkIcon className="h-3 w-3 mr-1"/> Copy</button>
                                        <button onClick={() => sendEmail(r.id, r.description)} className="text-indigo-600 text-xs font-bold hover:underline flex items-center mr-3"><Mail className="h-3 w-3 mr-1"/> Email</button>
                                        <button onClick={() => deleteRequest(r.id)} className="text-gray-400 hover:text-red-500 transition-colors ml-3"><Trash2 size={16}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h4 className="font-bold text-green-700 mb-4 flex items-center"><CheckCircle className="mr-2 h-4 w-4"/> Ready for Approval ({submitted.length})</h4>
                     {submitted.length === 0 ? <p className="text-sm text-gray-400 italic">No new submissions.</p> : (
                        <ul className="space-y-3">
                            {submitted.map(r => (
                                <li key={r.id} className="p-3 bg-green-50 border border-green-100 rounded-lg">
                                    <div className="flex justify-between mb-2">
                                        <div>
                                            <span className="block font-bold text-green-900">{r.item}</span>
                                            <span className="text-xs text-green-800">For: {r.description}</span>
                                        </div>
                                        <span className="text-xs text-green-700 bg-green-200 px-2 py-1 rounded self-start">{r.category}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-3">By: {r.contractor}</p>
                                    <button onClick={() => approveRequest(r)} className="w-full py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700">Approve & Add to Log</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

// ... [EnvironmentalInsights, PropertyMap, PedigreeReport remain same] ...
const EnvironmentalInsights = ({ propertyProfile }) => { const { coordinates } = propertyProfile || {}; const [airQuality, setAirQuality] = useState(null); const [solarData, setSolarData] = useState(null); const [loading, setLoading] = useState(false); useEffect(() => { if (!coordinates?.lat || !coordinates?.lon || !googleMapsApiKey) return; const fetchData = async () => { setLoading(true); try { const aqRes = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleMapsApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: { latitude: coordinates.lat, longitude: coordinates.lon } }) }); if(aqRes.ok) { const aqData = await aqRes.json(); if (aqData.indexes?.[0]) setAirQuality(aqData.indexes[0]); } const solarRes = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${coordinates.lat}&location.longitude=${coordinates.lon}&requiredQuality=HIGH&key=${googleMapsApiKey}`); if (solarRes.ok) setSolarData(await solarRes.json()); } catch (err) { console.error("Env fetch failed", err); } finally { setLoading(false); } }; fetchData(); }, [coordinates]); if (!coordinates?.lat) return <div className="p-6 text-center text-gray-500">Location data missing.</div>; return (<div className="space-y-6"><h2 className="text-xl font-bold text-indigo-900 mb-2 flex items-center"><MapIcon className="mr-2 h-5 w-5" /> Environmental Insights</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Wind className="h-24 w-24 text-blue-500" /></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Air Quality</h3>{loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (airQuality ? (<div><div className="flex items-baseline"><span className="text-4xl font-extrabold text-gray-900">{airQuality.aqi}</span><span className="ml-2 text-sm font-medium text-gray-500">US AQI</span></div><p className="text-indigo-600 font-medium mt-1">{airQuality.category}</p></div>) : <p className="text-gray-500 text-sm">Data unavailable.</p>)}</div><div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Sun className="h-24 w-24 text-yellow-500" /></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Solar Potential</h3>{loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (solarData ? (<div><div className="flex items-baseline"><span className="text-4xl font-extrabold text-gray-900">{Math.round(solarData?.solarPotential?.maxSunshineHoursPerYear || 0)}</span><span className="ml-2 text-sm font-medium text-gray-500">Sun Hours/Year</span></div></div>) : <p className="text-gray-500 text-sm">Data unavailable.</p>)}</div></div><PropertyMap propertyProfile={propertyProfile} /></div>); };
const PropertyMap = ({ propertyProfile }) => { const address = propertyProfile?.address; const mapQuery = address ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : propertyProfile?.name || "Home"; const encodedQuery = encodeURIComponent(mapQuery); const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodedQuery}`; return (<div className="space-y-6"><div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100"><div className="w-full h-64 bg-gray-100 rounded-xl overflow-hidden relative"><iframe width="100%" height="100%" src={mapUrl} frameBorder="0" scrolling="no" title="Property Map" className="absolute inset-0"></iframe></div></div><div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100"><h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center"><ShoppingBag className="mr-2 h-5 w-5" /> Nearby Suppliers</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">The Home Depot <ExternalLink size={14}/></a><a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition text-indigo-800 font-medium text-sm group">Lowe's <ExternalLink size={14}/></a></div></div></div>); };
const RecordCard = ({ record, onDeleteClick, onEditClick }) => ( <div className="bg-white p-0 rounded-xl shadow-sm border border-indigo-100 transition-all hover:shadow-lg flex flex-col overflow-hidden break-inside-avoid"> {record.imageUrl && <div className="h-48 w-full bg-gray-100 relative group print:h-32"><img src={record.imageUrl} alt={record.item} className="w-full h-full object-cover"/></div>} <div className="p-5 flex flex-col space-y-3 flex-grow"> <div className="flex justify-between items-start border-b border-indigo-50 pb-2"> <div className="font-bold text-xl text-indigo-800 leading-tight">{String(record.item || 'Unknown')}</div> <div className="flex ml-2 print:hidden"> <button onClick={() => onEditClick(record)} className="p-1 text-indigo-500 hover:text-indigo-700 mr-1" title="Edit"><Pencil size={20} /></button> <button onClick={() => onDeleteClick(record.id)} className="p-1 text-red-500 hover:text-red-700" title="Delete"><Trash2 size={20} /></button> </div> </div> <div className="text-sm space-y-2"> <p className="flex items-center text-gray-700 font-medium"><Home size={16} className="mr-3 text-indigo-500 min-w-[16px]" /> {String(record.area || 'Unknown')} / {String(record.category || 'General')}</p> {record.brand && <p className="flex items-center text-gray-600"><PaintBucket size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.category === 'Paint & Finishes' ? 'Brand' : 'Make'}: {record.brand}</p>} {record.model && <p className="flex items-center text-gray-600"><Info size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.category === 'Paint & Finishes' ? 'Color' : 'Model'}: {record.model}</p>} {record.sheen && <p className="flex items-center text-gray-600"><Layers size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Sheen: {record.sheen}</p>} {record.serialNumber && <p className="flex items-center text-gray-600"><Hash size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Serial #: {record.serialNumber}</p>} {record.material && <p className="flex items-center text-gray-600"><Info size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> Material: {record.material}</p>} {record.dateInstalled && <p className="flex items-center text-gray-600"><Calendar size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.dateInstalled}</p>} {record.contractor && <p className="flex items-center text-gray-600"><HardHat size={16} className="mr-3 text-indigo-400 min-w-[16px]" /> {record.contractorUrl ? <a href={record.contractorUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1 print:no-underline print:text-gray-800">{record.contractor} <ExternalLink size={12} className="inline print:hidden"/></a> : record.contractor}</p>} {record.purchaseLink && <a href={record.purchaseLink} target="_blank" rel="noreferrer" className="flex items-center text-indigo-600 hover:underline print:hidden"><ExternalLink size={16} className="mr-3" /> Replacement Link</a>} {record.notes && <div className="mt-2 pt-3 border-t border-indigo-50 text-gray-500 text-xs italic bg-gray-50 p-2 rounded">{record.notes}</div>} {record.maintenanceFrequency && record.maintenanceFrequency !== 'none' && ( <div className="mt-2 text-xs font-bold text-blue-600 flex items-center bg-blue-50 p-1 rounded"> <Clock className="h-3 w-3 mr-1"/> Maintenance: {MAINTENANCE_FREQUENCIES.find(f=>f.value===record.maintenanceFrequency)?.label} </div> )}
                            
                            {/* UPDATED: Show Tasks in Record Card */}
                            {record.maintenanceTasks && record.maintenanceTasks.length > 0 && (
                                <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100">
                                    <p className="font-bold text-gray-500 mb-1 flex items-center">
                                        <ListChecks size={10} className="mr-1"/> Recommended Tasks:
                                    </p>
                                    <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                                        {record.maintenanceTasks.map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}
 </div> <div className="text-xs text-gray-400 pt-2 mt-auto text-right">Logged: {String(record.timestamp || 'Just now')}</div> </div> </div> );
const AddRecordForm = ({ onSave, isSaving, newRecord, onInputChange, onFileChange, fileInputRef, isEditing, onCancelEdit }) => { const showSheen = newRecord.category === "Paint & Finishes"; const showMaterial = ["Roof & Exterior", "Flooring"].includes(newRecord.category); const showSerial = ["Appliances", "HVAC & Systems", "Plumbing", "Electrical"].includes(newRecord.category); const [isCustomArea, setIsCustomArea] = useState(false); useEffect(() => { if (newRecord.area && !ROOMS.includes(newRecord.area)) { setIsCustomArea(true); } else if (!newRecord.area) { setIsCustomArea(false); } }, [newRecord.area]); const handleRoomChange = (e) => { if (e.target.value === "Other (Custom)") { setIsCustomArea(true); onInputChange({ target: { name: 'area', value: '' } }); } else { setIsCustomArea(false); onInputChange(e); } }; let brandLabel = "Brand"; let modelLabel = "Model/Color Code"; if (newRecord.category === "Paint & Finishes") { brandLabel = "Paint Brand"; modelLabel = "Color Name/Code"; } else if (newRecord.category === "Appliances") { brandLabel = "Manufacturer"; modelLabel = "Model Number"; } const safeRecord = newRecord || initialRecordState; 

    // --- NEW: AI Suggestion Logic (UPDATED) ---
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestedTasks, setSuggestedTasks] = useState([]); // NEW STATE

    const suggestMaintenance = async () => {
        if (!newRecord.item && !newRecord.category) {
            alert("Please enter an Item Name or Category first.");
            return;
        }

        setIsSuggesting(true);
        setSuggestedTasks([]); // Clear old suggestions

        try {
            // Updated Prompt: Ask for JSON with tasks
            const prompt = `
                I have a home maintenance record.
                Category: ${newRecord.category || 'Unknown'}
                Item: ${newRecord.item}
                Brand: ${newRecord.brand || 'Unknown'}
                
                1. Recommend a maintenance frequency (one of: quarterly, semiannual, annual, biennial, quinquennial, none).
                2. List 3-5 specific maintenance tasks for this item.
                
                Return ONLY valid JSON in this format:
                {
                  "frequency": "annual",
                  "tasks": ["Task 1", "Task 2", "Task 3"]
                }
            `;

            const result = await window.geminiModel.generateContent(prompt);
            const response = result.response;
            // Clean up code blocks if the model wraps the JSON in markdown
            const text = response.text().replace(/```json|```/g, '').trim(); 
            
            const data = JSON.parse(text); // Parse the JSON

            // Update Frequency
            if (data.frequency) {
                const validFreqs = ["quarterly", "semiannual", "annual", "biennial", "quinquennial", "none"];
                if (validFreqs.includes(data.frequency)) {
                    onInputChange({ target: { name: 'maintenanceFrequency', value: data.frequency } });
                }
            }

            // Update Tasks (and show them)
            if (data.tasks && Array.isArray(data.tasks)) {
                setSuggestedTasks(data.tasks);
                // Also update the parent state so it saves
                onInputChange({ target: { name: 'maintenanceTasks', value: data.tasks } });
            }

        } catch (error) {
            console.error("AI Error:", error);
            alert("Could not fetch details. Please try again.");
        } finally {
            setIsSuggesting(false);
        }
    };
    // --------------------------------

return ( <form onSubmit={onSave} className="p-6 bg-white rounded-xl shadow-2xl border-t-4 border-indigo-600 space-y-4"> <div className="flex justify-between items-center border-b pb-2 mb-2"> <h2 className="text-2xl font-bold text-indigo-700">{isEditing ? 'Edit Record' : 'Record New Home Data'}</h2> {isEditing && <button type="button" onClick={onCancelEdit} className="text-sm text-gray-500 hover:text-gray-700 flex items-center"><X size={16} className="mr-1"/> Cancel Edit</button>} </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700">Category *</label> <div className="relative mt-1"><select name="category" value={safeRecord.category} onChange={onInputChange} required className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div> </div> <div> <label className="block text-sm font-medium text-gray-700">Area/Room *</label> {!isCustomArea ? ( <div className="relative mt-1"><select name="area" value={ROOMS.includes(safeRecord.area) ? safeRecord.area : ""} onChange={handleRoomChange} required className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{ROOMS.map(r => <option key={r} value={r}>{r}</option>)}<option value="Other (Custom)">Other (Custom)</option></select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div> ) : ( <div className="relative mt-1 flex"><input type="text" name="area" value={safeRecord.area} onChange={onInputChange} required autoFocus placeholder="e.g. Guest House" className="block w-full rounded-l-lg border-gray-300 shadow-sm p-2 border"/><button type="button" onClick={() => {setIsCustomArea(false); onInputChange({target:{name:'area', value:''}})}} className="px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg"><X size={18}/></button></div> )} </div> </div> <div><label className="block text-sm font-medium text-gray-700">Item Name *</label><input type="text" name="item" value={safeRecord.item} onChange={onInputChange} required placeholder="e.g. North Wall" className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div> <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200"> <div><label className="block text-sm font-medium text-gray-700">{brandLabel}</label><input type="text" name="brand" value={safeRecord.brand} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div> <div><label className="block text-sm font-medium text-gray-700">{modelLabel}</label><input type="text" name="model" value={safeRecord.model} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div> {showSheen && <div><label className="block text-sm font-medium text-gray-700">Sheen</label><div className="relative mt-1"><select name="sheen" value={safeRecord.sheen} onChange={onInputChange} className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{PAINT_SHEENS.map(s => <option key={s} value={s}>{s}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div></div>} {showSerial && <div><label className="block text-sm font-medium text-gray-700">Serial #</label><input type="text" name="serialNumber" value={safeRecord.serialNumber} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div>} {showMaterial && <div><label className="block text-sm font-medium text-gray-700">Material</label><div className="relative mt-1"><select name="material" value={safeRecord.material} onChange={onInputChange} className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none"><option value="" disabled>Select</option>{(safeRecord.category==="Roof & Exterior"?ROOF_MATERIALS:FLOORING_TYPES).map(m=><option key={m} value={m}>{m}</option>)}</select><ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/></div></div>} </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> <div><label className="block text-sm font-medium text-gray-700">Date Installed</label><input type="date" name="dateInstalled" value={safeRecord.dateInstalled} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div> <div className="space-y-2"> <div><label className="block text-sm font-medium text-gray-700">Contractor</label><input type="text" name="contractor" value={safeRecord.contractor} onChange={onInputChange} placeholder="Company Name" className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div> <div><label className="block text-xs font-medium text-gray-500">Profile URL</label><input type="url" name="contractorUrl" value={safeRecord.contractorUrl} onChange={onInputChange} placeholder="https://..." className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border text-sm"/></div> </div> </div> 
    
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Maintenance Frequency</label>
            <button 
                type="button" 
                onClick={suggestMaintenance}
                disabled={isSuggesting}
                className="text-xs flex items-center bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors"
            >
                {isSuggesting ? (
                    <span className="animate-pulse">Thinking...</span> 
                ) : (
                    <>
                        <Zap size={12} className="mr-1 fill-indigo-700"/> Auto-Suggest
                    </>
                )}
            </button>
        </div>
        <div className="relative">
            <select name="maintenanceFrequency" value={safeRecord.maintenanceFrequency} onChange={onInputChange} className="block w-full rounded-lg border-gray-300 shadow-sm p-2 border appearance-none">
                {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-2 top-3 text-gray-500 pointer-events-none"/>
        </div>
        
        {/* NEW: Display Suggested Tasks */}
        {suggestedTasks.length > 0 && (
            <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-sm">
                <p className="font-bold text-indigo-900 mb-1 flex items-center">
                    <Wrench size={12} className="mr-1"/> Suggested Tasks:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-indigo-800">
                    {suggestedTasks.map((task, i) => (
                        <li key={i}>{task}</li>
                    ))}
                </ul>
            </div>
        )}
    </div>
    
    <div><label className="block text-sm font-medium text-gray-700">Product Link</label><input type="url" name="purchaseLink" value={safeRecord.purchaseLink} onChange={onInputChange} placeholder="https://..." className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border"/></div> <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100"><label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center"><Camera size={18} className="mr-2"/> Upload Photo</label><input type="file" accept="image/*" onChange={onFileChange} ref={fileInputRef} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer"/><p className="text-xs text-gray-500 mt-1">Max 1MB</p></div> <div><label className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" rows="3" value={safeRecord.notes} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border resize-none"></textarea></div> <button type="submit" disabled={isSaving} className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"> {isSaving ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? <><Pencil size={20} className="mr-2"/> Update Record</> : <><PlusCircle size={20} className="mr-2"/> Log New Home Component</>)} </button> </form> ); };
const PedigreeReport = ({ propertyProfile, records = [] }) => { const stats = useMemo(() => { const defaultVal = { age: 'N/A', date: 'No data' }; try { const calculateAge = (categoryKeyword, itemKeyword) => { if (!records || records.length === 0) return defaultVal; const record = records.find(r => { if (!r) return false; const cat = String(r.category || '').toLowerCase(); const item = String(r.item || '').toLowerCase(); return (cat.includes(categoryKeyword.toLowerCase()) || item.includes(itemKeyword.toLowerCase())) && r.dateInstalled; }); if (!record) return { age: 'N/A', date: 'No record' }; const installed = new Date(record.dateInstalled); if (isNaN(installed.getTime())) return { age: 'N/A', date: 'Invalid Date' }; const age = new Date().getFullYear() - installed.getFullYear(); return { age: `${age} Yrs`, date: `Installed ${installed.getFullYear()}` }; }; return { hvac: calculateAge('HVAC', 'hvac'), roof: calculateAge('Roof', 'roof'), heater: calculateAge('Plumbing', 'water heater') }; } catch (e) { return { hvac: defaultVal, roof: defaultVal, heater: defaultVal }; } }, [records]); const sortedRecords = useMemo(() => { if (!records) return []; return [...records].sort((a, b) => { const dateA = a.dateInstalled ? new Date(a.dateInstalled) : (a.timestamp && typeof a.timestamp === 'string' ? new Date(a.timestamp) : new Date(0)); const dateB = b.dateInstalled ? new Date(b.dateInstalled) : (b.timestamp && typeof b.timestamp === 'string' ? new Date(b.timestamp) : new Date(0)); return dateB - dateA; }); }, [records]); return ( <div className="bg-gray-50 min-h-screen pb-12"> <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center print:hidden pt-6 px-4"> <h2 className="text-2xl font-bold text-gray-800">Pedigree Report</h2> <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition"><Printer className="h-4 w-4 mr-2" /> Print / Save PDF</button> </div> <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 print:shadow-none print:border-0"> <div className="bg-indigo-900 text-white p-8 md:p-12 relative overflow-hidden"> <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12 translate-x-10 -translate-y-10"><img src={logoSrc} className="w-64 h-64 brightness-0 invert" alt="Watermark"/></div> <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center"> <div> <h1 className="text-4xl md:text-5xl font-extrabold mb-2 tracking-tight text-white">{propertyProfile?.name || 'My Property'}</h1> <p className="text-indigo-200 text-lg flex items-center"><MapPin className="h-5 w-5 mr-2" /> {propertyProfile?.address?.street ? `${propertyProfile.address.street}, ${propertyProfile.address.city || ''} ${propertyProfile.address.state || ''}` : 'No Address Listed'}</p> </div> <div className="mt-8 md:mt-0 text-left md:text-right"><p className="text-xs text-indigo-300 uppercase tracking-wide mb-1">Report Date</p><p className="font-mono text-lg font-bold">{new Date().toLocaleDateString()}</p></div> </div> </div> <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50 print:grid-cols-4"> <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">HVAC Age</p><p className="text-2xl font-extrabold text-indigo-900">{stats.hvac.age}</p><p className="text-xs text-gray-500 mt-1">{stats.hvac.date}</p></div> <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Roof Age</p><p className="text-2xl font-extrabold text-indigo-900">{stats.roof.age}</p><p className="text-xs text-gray-500 mt-1">{stats.roof.date}</p></div> <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Water Heater</p><p className="text-2xl font-extrabold text-indigo-900">{stats.heater.age}</p><p className="text-xs text-gray-500 mt-1">{stats.heater.date}</p></div> <div className="p-6 text-center"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Records</p><p className="text-2xl font-extrabold text-indigo-600">{records ? records.length : 0}</p></div> </div> <div className="p-8 md:p-10"> <div className="space-y-8 border-l-2 border-indigo-100 ml-3 pl-8 relative"> {sortedRecords.map(record => ( <div key={record.id} className="relative break-inside-avoid"> <div className="absolute -left-[41px] top-1 h-6 w-6 rounded-full bg-white border-4 border-indigo-600"></div> <div className="mb-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between"> <span className="font-bold text-lg text-gray-900 mr-3">{String(record.item || 'Unknown Item')}</span> <span className="text-sm font-mono text-gray-500">{record.dateInstalled || (typeof record.timestamp === 'string' ? record.timestamp : 'No Date')}</span> </div> <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm print:shadow-none print:border"> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-sm"> <div><span className="text-gray-400 uppercase text-xs font-bold">Category:</span> <span className="font-medium">{String(record.category || 'Uncategorized')}</span></div> {record.brand && <div><span className="text-gray-400 uppercase text-xs font-bold">Brand:</span> <span className="font-medium">{String(record.brand)}</span></div>} {record.contractor && <div><span className="text-gray-400 uppercase text-xs font-bold">Contractor:</span> <span className="font-medium">{String(record.contractor)}</span></div>} </div> {record.notes && <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 italic print:bg-transparent print:border-0">"{String(record.notes)}"</p>} {record.imageUrl && <div className="mt-3"><img src={record.imageUrl} alt="Record" className="h-32 w-auto rounded-lg border border-gray-200 object-cover print:h-24" /></div>} </div> </div> ))} </div> </div> </div> </div> ); };

// UPDATED MAIN APP COMPONENT to handle Routing
const AppContent = () => {
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showReauth, setShowReauth] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const fileInputRef = useRef(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [userId, setUserId] = useState(null); 
    
    // Check for Contractor Mode
    const [isContractorMode, setIsContractorMode] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('requestId')) {
            setIsContractorMode(true);
            setLoading(false); // Directly stop loading if contractor mode
        } else {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                setCurrentUser(user);
                if(user) setUserId(user.uid); else setUserId(null);
                setIsAuthReady(true); 
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, []);

    useEffect(() => {
        if (isContractorMode || !isAuthReady || !userId) { if(isAuthReady && !userId) setIsLoadingProfile(false); return; }
        const fetchProfile = async () => { try { const snap = await getDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'profile')); if(snap.exists()) setPropertyProfile(snap.data()); else setPropertyProfile(null); } catch(e){console.error(e);} finally { setIsLoadingProfile(false); setLoading(false); } };
        fetchProfile();
    }, [isAuthReady, userId, isContractorMode]);

    useEffect(() => {
        if (isContractorMode || !isAuthReady || !userId || !propertyProfile) return;
        const q = query(collection(db, PUBLIC_COLLECTION_PATH));
        const unsub = onSnapshot(q, (snap) => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate().toLocaleDateString() : 'N/A' }))); }, (err) => setError("Failed load"));
        return () => unsub();
    }, [isAuthReady, userId, propertyProfile?.name, isContractorMode]);

    const handleLogin = async (email, password, isSignUp) => { if(!auth) return; try { if(isSignUp) await createUserWithEmailAndPassword(auth, email, password); else await signInWithEmailAndPassword(auth, email, password); } catch(e) { throw new Error(e.message); } };
    const handleGoogleLogin = async () => { if(!auth) return; try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) { console.error(e); throw new Error("Google sign-in failed."); } };
    const handleAppleLogin = async () => { if(!auth) return; try { await signInWithPopup(auth, new OAuthProvider('apple.com')); } catch(e) { console.error(e); throw new Error("Apple sign-in failed."); } };
    const handleGuestLogin = async () => { if(!auth) return; await signInAnonymously(auth); };
    const handleSignOut = async () => { if(!auth) return; await signOut(auth); setCurrentUser(null); setUserId(null); setPropertyProfile(null); setRecords([]); };
    const deleteUserData = async (uid) => { const batch = writeBatch(db); batch.delete(doc(db, 'artifacts', appId, 'users', uid, 'settings', 'profile')); const snap = await getDocs(query(collection(db, PUBLIC_COLLECTION_PATH))); snap.docs.forEach(d => { if (d.data().userId === uid) batch.delete(d.ref); }); return batch.commit(); };
    const handleDeleteAccount = async (password = null) => { const user = auth.currentUser; if (!user || !db) { alert("Error finding user."); return; } try { if (user.providerData.some(p => p.providerId === 'password') && password) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password)); else if (user.providerData.some(p => p.providerId === 'password') && !password) { setShowReauth(true); return; } await deleteUserData(user.uid); await deleteUser(user); handleSignOut(); setError("Account deleted."); } catch (e) { setShowReauth(false); setError("Delete failed: " + e.message); } };
    const initiateAccountDeletion = () => { if (auth?.currentUser?.providerData.some(p => p.providerId === 'password')) setShowReauth(true); else setShowDeleteConfirm(true); };
    const handleSaveProfile = async (e) => { e.preventDefault(); const f = e.target; const name = f.querySelector('input[name="propertyName"]').value; if(!name) return; setIsSaving(true); try { const data = { name, address: { street: f.querySelector('input[name="streetAddress"]').value, city: f.querySelector('input[name="city"]').value, state: f.querySelector('input[name="state"]').value, zip: f.querySelector('input[name="zip"]').value }, yearBuilt: f.querySelector('input[name="yearBuilt"]')?.value, sqFt: f.querySelector('input[name="sqFt"]')?.value, lotSize: f.querySelector('input[name="lotSize"]')?.value, coordinates: (f.querySelector('input[name="lat"]')?.value && f.querySelector('input[name="lon"]')?.value) ? { lat: f.querySelector('input[name="lat"]').value, lon: f.querySelector('input[name="lon"]').value } : null, createdAt: serverTimestamp() }; await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile'), data); setPropertyProfile(data); } catch(e) { setError("Save failed: " + e.message); } finally { setIsSaving(false); } };
    const handleInputChange = useCallback((e) => { const { name, value } = e.target; setNewRecord(prev => ({ ...prev, [name]: value })); }, []);
    const handleFileChange = useCallback((e) => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }, []);
    const handleEditClick = (record) => { setNewRecord(record); setEditingId(record.id); setActiveTab('Add Record'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => { setNewRecord(initialRecordState); setEditingId(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
    const saveRecord = useCallback(async (e) => { e.preventDefault(); if (!db || !userId || isSaving) return; if (!newRecord.area || !newRecord.category || !newRecord.item) { setError("Missing fields."); return; } setIsSaving(true); setError(null); try { let finalImageUrl = ''; if (selectedFile) { if (selectedFile.size < 1048576) finalImageUrl = await fileToBase64(selectedFile); else throw new Error("Image too large (Max 1MB)"); } 
    
    // Calculate Next Service Date
    const nextServiceDate = calculateNextDate(newRecord.dateInstalled, newRecord.maintenanceFrequency);

    const recordData = { ...newRecord, nextServiceDate, propertyLocation: propertyProfile?.name || 'My Property', imageUrl: finalImageUrl || newRecord.imageUrl, userId: currentUser.uid, timestamp: editingId ? newRecord.timestamp : serverTimestamp(), maintenanceTasks: newRecord.maintenanceTasks || [] }; if (editingId) { await updateDoc(doc(db, PUBLIC_COLLECTION_PATH, editingId), recordData); } else { await addDoc(collection(db, PUBLIC_COLLECTION_PATH), recordData); } setNewRecord(initialRecordState); setEditingId(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; setActiveTab('View Records'); } catch (e) { setError("Save failed: " + e.message); } finally { setIsSaving(false); } }, [db, currentUser, isSaving, newRecord, selectedFile, propertyProfile, editingId]); 
    const handleDeleteConfirmed = async () => { if(!db || !confirmDelete) return; try { await deleteDoc(doc(db, PUBLIC_COLLECTION_PATH, confirmDelete)); setConfirmDelete(null); } catch(e){ setError("Delete failed."); } };
    const grouped = records.reduce((acc, r) => { const k = r.area || 'Uncategorized'; if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; }, {});

    if (isContractorMode) return <ContractorView />; 

    if (loading) return <div className="flex items-center justify-center min-h-screen text-lg font-medium text-gray-500">Initializing HausKey...</div>;
    if (!userId) return <AuthScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onAppleLogin={handleAppleLogin} onGuestLogin={handleGuestLogin} error={error} />;
    if (isLoadingProfile) return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading Profile...</div>;
    if (!propertyProfile) return <div className="min-h-screen bg-gray-50 p-4"><style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style><SetupPropertyForm onSave={handleSaveProfile} isSaving={isSaving} onSignOut={handleSignOut} /></div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
             {/* ... Header ... */}
             <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
                <link rel="icon" type="image/svg+xml" href={logoSrc} />
                <header className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center relative">
                    <div className="absolute top-0 right-0 flex space-x-3 items-center sm:mt-2 z-10">
                        <button onClick={initiateAccountDeletion} className="p-1.5 rounded-full text-red-500 hover:text-red-700 hover:bg-red-100" title="Delete Account"><UserMinus size={16} /></button>
                        <button onClick={handleSignOut} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Sign Out"><LogOut size={16} /></button>
                    </div>
                    <img src={logoSrc} alt="HausKey Logo" className="h-20 w-20 mb-4 sm:mb-0 sm:mr-6 shadow-sm rounded-xl" />
                    <div className="text-center sm:text-left">
                        {/* REBRANDED TITLE */}
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-900 tracking-tighter"><span className="text-indigo-600">HausKey</span> Home Log</h1>
                        <p className="text-gray-500 mt-2 text-lg">The official Property Pedigree for your home.</p>
                        <div className="mt-2 inline-flex items-center bg-white px-3 py-1 rounded-full shadow-sm border border-indigo-100"><MapPin size={14} className="text-indigo-500 mr-2" /><span className="text-gray-600 font-semibold text-sm">{propertyProfile.name}</span></div>
                    </div>
                </header>
                {/* ... rest of render ... */}
                {error && <div className="max-w-4xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">{error}<span className="float-right cursor-pointer" onClick={()=>setError(null)}>×</span></div>}
                
                <nav className="flex justify-center mb-6 max-w-lg mx-auto print:hidden">
                    <button onClick={() => setActiveTab('View Records')} className={`flex-1 px-2 py-3 text-sm font-semibold rounded-l-xl border-b-2 ${activeTab==='View Records'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>History</button>
                    <button onClick={() => setActiveTab('Maintenance')} className={`flex-1 px-2 py-3 text-sm font-semibold border-b-2 border-l-0 border-r-0 ${activeTab==='Maintenance'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Maintenance</button>
                    <button onClick={() => { setActiveTab('Add Record'); handleCancelEdit(); }} className={`flex-1 px-2 py-3 text-sm font-semibold border-b-2 border-l-0 border-r-0 ${activeTab==='Add Record'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Add</button>
                    <button onClick={() => setActiveTab('Requests')} className={`flex-1 px-2 py-3 text-sm font-semibold border-b-2 border-l-0 border-r-0 ${activeTab==='Requests'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Request</button>
                    <button onClick={() => setActiveTab('Report')} className={`flex-1 px-2 py-3 text-sm font-semibold border-b-2 border-l-0 border-r-0 ${activeTab==='Report'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Report</button>
                    <button onClick={() => setActiveTab('Insights')} className={`flex-1 px-2 py-3 text-sm font-semibold rounded-r-xl border-b-2 ${activeTab==='Insights'?'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-600 border-gray-200'}`}>Insights</button>
                </nav>

                <main className="max-w-4xl mx-auto">
                    {activeTab === 'Add Record' && <AddRecordForm onSave={saveRecord} isSaving={isSaving} newRecord={newRecord} onInputChange={handleInputChange} onFileChange={handleFileChange} fileInputRef={fileInputRef} isEditing={!!editingId} onCancelEdit={handleCancelEdit} />}
                    {activeTab === 'View Records' && <div className="space-y-10">{Object.keys(grouped).length>0 ? Object.keys(grouped).map(area => (
                        <section key={area} className="bg-white p-4 sm:p-6 rounded-3xl shadow-2xl border border-indigo-100">
                            <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center"><Home size={28} className="mr-3 text-indigo-600"/> {area}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{grouped[area].map(r => <RecordCard key={r.id} record={r} onDeleteClick={setConfirmDelete} onEditClick={handleEditClick} />)}</div>
                        </section>
                    )) : <div className="text-center p-12 bg-white rounded-xl shadow-lg border-2 border-dashed border-indigo-200"><FileText size={48} className="mx-auto text-indigo-400 mb-4"/><p className="text-gray-600 font-medium text-lg">Log is Empty.</p></div>}</div>}
                    {activeTab === 'Maintenance' && <MaintenanceDashboard records={records} />}
                    {activeTab === 'Report' && <PedigreeReport propertyProfile={propertyProfile} records={records} />}
                    {activeTab === 'Insights' && <EnvironmentalInsights propertyProfile={propertyProfile} />}
                    {/* NEW Requests Tab */}
                    {activeTab === 'Requests' && <RequestManager userId={userId} propertyName={propertyProfile.name} />}
                </main>
                {confirmDelete && <CustomConfirm message="Delete this record? Cannot be undone." onConfirm={handleDeleteConfirmed} onCancel={() => setConfirmDelete(null)} />}
                {showReauth && <ReauthModal isLoading={isSaving} onCancel={() => setShowReauth(false)} onConfirm={async (password) => { setIsSaving(true); try { await handleDeleteAccount(password); } catch (e) { setIsSaving(false); throw e; } }} />}
                {showDeleteConfirm && <CustomConfirm type="account" message="Delete account permanently?" onConfirm={async () => { setIsSaving(true); await handleDeleteAccount(); setIsSaving(false); }} onCancel={() => setShowDeleteConfirm(false)} />}
        </div>
    );
};

const App = () => {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
};

export default App;
