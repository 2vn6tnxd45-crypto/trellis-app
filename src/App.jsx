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
// Vertex AI import
import { getVertexAI, getGenerativeModel } from "firebase/vertexai";
import { Trash2, PlusCircle, Home, Calendar, PaintBucket, HardHat, Info, FileText, ExternalLink, Camera, MapPin, Search, LogOut, Lock, Mail, ChevronDown, Hash, Layers, X, Printer, Map as MapIcon, ShoppingBag, Sun, Wind, Zap, AlertTriangle, UserMinus, Pencil, Send, CheckCircle, Link as LinkIcon, Clock, Palette, Key, User, Tag, Box, UploadCloud, Wrench, ListChecks, Plus, Sparkles, TrendingUp, ShieldCheck, ScanLine, ListPlus, Save, XCircle } from 'lucide-react';

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
const REQUESTS_COLLECTION_PATH = `/artifacts/${appId}/public/data/requests`;

// Initialize Firebase GLOBALLY
let app, auth, db;
try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Initialize Vertex AI
    try {
        const vertexAI = getVertexAI(app);
        window.geminiModel = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });
    } catch (aiError) {
        console.warn("AI Initialization failed (optional feature):", aiError);
    }

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
  <path d="M50 10L15 40V90H85V40L50 10Z" stroke="#0ea5e9" stroke-width="8" stroke-linejoin="round" fill="none"/>
  
  <!-- Key Shape (Integrated) -->
  <circle cx="50" cy="50" r="10" fill="#0c4a6e"/>
  <rect x="46" y="55" width="8" height="25" rx="2" fill="#0c4a6e"/>
  <rect x="54" y="65" width="6" height="4" fill="#0c4a6e"/>
  <rect x="54" y="72" width="4" height="4" fill="#0c4a6e"/>
  
  <!-- Key Hole Detail -->
  <circle cx="50" cy="50" r="3" fill="white"/>
</svg>
`)}`;

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

// NEW: Image Compression Helper
const compressImage = (file, maxWidth = 1024, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const getBase64Data = (dataUrl) => {
    return dataUrl.split(',')[1];
}

// NEW: Text Casing Helper
const toProperCase = (str) => {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
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

// --- DATA CONSTANTS ---
const STANDARD_MAINTENANCE_ITEMS = [
    { category: "HVAC & Systems", item: "Replace HVAC Filters", maintenanceFrequency: "quarterly", tasks: ["Check filter size", "Replace if dirty", "Mark installation date"] },
    { category: "HVAC & Systems", item: "Clean AC Condenser Unit", maintenanceFrequency: "annual", tasks: ["Remove leaves/debris", "Spray down fins with water", "Check for damage"] },
    { category: "Safety", item: "Test Smoke Detectors", maintenanceFrequency: "quarterly", tasks: ["Press test button", "Vacuum dust from cover"] },
    { category: "Plumbing", item: "Flush Water Heater", maintenanceFrequency: "annual", tasks: ["Connect hose to drain valve", "Flush sediment until clear", "Check anode rod"] },
    { category: "Appliances", item: "Clean Dryer Vent Duct", maintenanceFrequency: "annual", tasks: ["Disconnect duct", "Vacuum lint from hose and wall", "Check exterior flap"] },
    { category: "Appliances", item: "Clean Refrigerator Coils", maintenanceFrequency: "annual", tasks: ["Vacuum coils at bottom/back", "Clean drip pan"] },
    { category: "Roof & Exterior", item: "Clean Gutters", maintenanceFrequency: "semiannual", tasks: ["Remove debris", "Flush downspouts", "Check for leaks"] },
    { category: "Roof & Exterior", item: "Inspect Roof", maintenanceFrequency: "annual", tasks: ["Check for missing shingles", "Inspect flashing", "Look for moss growth"] },
    { category: "Plumbing", item: "Test Sump Pump", maintenanceFrequency: "semiannual", tasks: ["Pour water in pit", "Ensure float triggers pump", "Check discharge line"] },
    { category: "Interior", item: "Inspect Caulking", maintenanceFrequency: "annual", tasks: ["Check tubs/showers", "Check sink seals", "Re-caulk if peeling"] }
];

const calculateNextDate = (startDate, frequency) => {
    if (!startDate || !frequency || frequency === 'none') return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null; 
    const freqMap = { 'quarterly': 3, 'semiannual': 6, 'annual': 12, 'biennial': 24, 'quinquennial': 60 };
    const monthsToAdd = freqMap[frequency];
    if (!monthsToAdd) return null;
    const nextDate = new Date(start);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    return nextDate.toISOString().split('T')[0]; 
};

const CATEGORIES = ["Paint & Finishes", "Appliances", "Flooring", "HVAC & Systems", "Plumbing", "Electrical", "Roof & Exterior", "Landscaping", "Service & Repairs", "Safety", "Interior", "Other"];
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
    notes: '', purchaseLink: '', imageUrl: '', maintenanceFrequency: 'none', nextServiceDate: null, lastServiceDate: null, maintenanceTasks: [] 
};

// --- Components ---
const GoogleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>);
const AppleIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.64 3.4 1.74-3.12 1.84-2.6 5.75.64 7.13-.5 1.24-1.14 2.47-2.69 4.14zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.54 4.33-3.74 4.25z" /></svg>);

const WelcomeModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-sky-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-sky-100">
                <div className="bg-sky-900 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles className="h-32 w-32 text-white" />
                    </div>
                    <div className="relative z-10">
                        <div className="bg-sky-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-sky-700">
                            <Key className="text-sky-300 h-8 w-8" />
                        </div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Welcome to HausKey!</h2>
                        <p className="text-sky-200 text-sm mt-2 font-medium">Your home's digital pedigree starts here.</p>
                    </div>
                </div>
                <div className="p-8 space-y-6">
                    <div className="flex items-start space-x-4">
                        <div className="bg-sky-50 p-3 rounded-2xl shrink-0">
                            <ShieldCheck className="text-sky-600 h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sky-950 text-lg">Secure Your History</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mt-1">Stop losing receipts. Log repairs, upgrades, and paint colors permanently.</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="bg-sky-50 p-3 rounded-2xl shrink-0">
                            <Wrench className="text-sky-600 h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sky-950 text-lg">Automated Maintenance</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mt-1">Get smart reminders for filters, flushing heaters, and more.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-full py-4 bg-sky-900 text-white font-bold rounded-2xl shadow-lg shadow-sky-900/20 hover:bg-sky-800 hover:scale-[1.01] transition-all transform mt-4">Let's Get Started</button>
                </div>
            </div>
        </div>
    );
};

const ReauthModal = ({ onConfirm, onCancel, isLoading }) => { const [password, setPassword] = useState(''); const [error, setError] = useState(null); const handleSubmit = (e) => { e.preventDefault(); setError(null); if (!password) { setError("Password is required."); return; } onConfirm(password).catch(err => setError(err.message || "Re-authentication failed.")); }; return (<div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden"><div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full"><h3 className="text-xl font-semibold text-red-800 mb-2">Security Check</h3><p className="text-gray-600 mb-4 text-sm">Please re-enter your password to confirm permanent account deletion.</p><form onSubmit={handleSubmit} className="space-y-4"><input type="password" placeholder="Current Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" required />{error && <p className="text-red-600 text-xs">{error}</p>}<div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button><button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50">{isLoading ? 'Deleting...' : 'Confirm Deletion'}</button></div></form></div></div>); };
const CustomConfirm = ({ message, onConfirm, onCancel, type = 'delete' }) => (<div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center z-50 p-4 print:hidden"><div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full"><h3 className="text-xl font-semibold text-gray-800 mb-4">{type === 'account' ? 'Confirm Account Deletion' : 'Confirm Action'}</h3><p className="text-gray-600 mb-6">{message}</p><div className="flex justify-end space-x-3"><button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"><X size={16} className="mr-1"/>Cancel</button><button onClick={onConfirm} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${type === 'account' ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'}`}>{type === 'account' ? 'Delete Permanently' : 'Delete'}</button></div></div></div>);
const AuthScreen = ({ onLogin, onGoogleLogin, onAppleLogin, onGuestLogin, error: authError }) => { const [isSignUp, setIsSignUp] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [localError, setLocalError] = useState(null); const [isLoading, setIsLoading] = useState(false); useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get('email')) { setEmail(params.get('email')); setIsSignUp(true); } }, []); const handleSubmit = async (e) => { e.preventDefault(); setLocalError(null); setIsLoading(true); try { await onLogin(email, password, isSignUp); } catch (err) { setLocalError(err.message); setIsLoading(false); } }; return (<div className="min-h-screen bg-sky-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans print:hidden"><style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'); body { font-family: 'Outfit', sans-serif; }`}</style><div className="sm:mx-auto sm:w-full sm:max-w-md text-center"><img className="mx-auto h-24 w-24 rounded-3xl shadow-lg bg-white p-2" src={logoSrc} alt="HausKey" /><h2 className="mt-6 text-4xl font-extrabold text-sky-900 tracking-tight">{isSignUp ? 'Create your Pedigree' : 'Sign in to HausKey'}</h2><p className="mt-2 text-base text-sky-600/80">The permanent record for your home.</p></div><div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"><div className="bg-white py-8 px-4 shadow-xl shadow-sky-100/50 rounded-2xl sm:px-10 border border-sky-100"><div className="grid grid-cols-2 gap-3 mb-6"><button onClick={onGoogleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><span className="mr-2"><GoogleIcon /></span> Google</button><button onClick={onAppleLogin} className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"><span className="mr-2"><AppleIcon /></span> Apple</button></div><div className="relative mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">Or continue with email</span></div></div><form className="space-y-6" onSubmit={handleSubmit}><div><label className="block text-sm font-bold text-sky-900 mb-1">Email</label><div className="relative rounded-xl shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={18} className="text-gray-400" /></div><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-200 rounded-xl p-3 border focus:ring-sky-500 focus:border-sky-500" placeholder="you@example.com"/></div></div><div><label className="block text-sm font-bold text-sky-900 mb-1">Password</label><div className="relative rounded-xl shadow-sm"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={18} className="text-gray-400" /></div><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 sm:text-sm border-gray-200 rounded-xl p-3 border focus:ring-sky-500 focus:border-sky-500" placeholder="••••••••"/></div></div>{(localError || authError) && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{localError || authError}</div>}<button type="submit" disabled={isLoading} className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-sky-200 text-sm font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:opacity-50 transition-all">{isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}</button></form><div className="mt-6 text-center space-y-4"><button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-medium text-sky-600 hover:text-sky-800">{isSignUp ? 'Already have an account? Sign in' : 'Need an account? Create one'}</button><div className="border-t border-gray-100 pt-4"><button onClick={onGuestLogin} className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider">Try as a Guest</button></div></div></div></div></div>); };
const SetupPropertyForm = ({ onSave, isSaving, onSignOut }) => { const [formData, setFormData] = useState({ propertyName: '', streetAddress: '', city: '', state: '', zip: '', lat: null, lon: null, yearBuilt: '', sqFt: '', lotSize: '' }); const inputRef = useRef(null); useEffect(() => { window.gm_authFailure = () => { console.error("Google Maps Auth Failure detected"); alert("Google Maps API Key Error."); }; loadGoogleMapsScript().then(() => { if (inputRef.current && window.google && window.google.maps && window.google.maps.places) { try { const auto = new window.google.maps.places.Autocomplete(inputRef.current, { types: ['address'], fields: ['address_components', 'geometry', 'formatted_address'] }); inputRef.current.addEventListener('keydown', (e) => { if(e.key === 'Enter') e.preventDefault(); }); auto.addListener('place_changed', () => { const place = auto.getPlace(); if (!place.geometry) return; let streetNum = '', route = '', city = '', state = '', zip = ''; if (place.address_components) { place.address_components.forEach(comp => { if (comp.types.includes('street_number')) streetNum = comp.long_name; if (comp.types.includes('route')) route = comp.long_name; if (comp.types.includes('locality')) city = comp.long_name; if (comp.types.includes('administrative_area_level_1')) state = comp.short_name; if (comp.types.includes('postal_code')) zip = comp.long_name; }); } setFormData(prev => ({ ...prev, streetAddress: `${streetNum} ${route}`.trim(), city, state, zip, lat: place.geometry.location.lat(), lon: place.geometry.location.lng() })); if (inputRef.current) inputRef.current.value = `${streetNum} ${route}`.trim(); }); } catch (e) { console.warn("Google Auto fail", e); } } }).catch(err => console.error("Maps load error", err)); }, []); const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); }; const handleSubmit = (e) => { e.preventDefault(); const formDataObj = new FormData(e.target); if (inputRef.current) formDataObj.set('streetAddress', inputRef.current.value); onSave(formDataObj); }; return (<div className="flex items-center justify-center min-h-[90vh] print:hidden"><div className="max-w-lg w-full bg-white p-10 rounded-3xl shadow-2xl shadow-sky-100 border border-sky-100 text-center relative"><button onClick={onSignOut} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 flex items-center text-xs font-bold uppercase tracking-wider transition-colors"><LogOut size={14} className="mr-1" /> Sign Out</button><div className="flex flex-col items-center justify-center mb-8"><img src={logoSrc} alt="HausKey Logo" className="h-20 w-20 shadow-md rounded-2xl mb-4 bg-sky-50 p-2" /><h2 className="text-3xl font-extrabold text-sky-900 mb-1">Property Setup</h2><p className="text-sky-500/80 font-medium">Let's get your home logged.</p></div><form onSubmit={handleSubmit} className="space-y-6 text-left relative"><div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Property Nickname</label><input type="text" name="propertyName" value={formData.propertyName} onChange={handleChange} placeholder="e.g. The Lake House" className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border focus:ring-sky-500 focus:bg-white transition-all"/></div><div className="relative"><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Street Address</label><div className="relative"><MapPin className="absolute left-3.5 top-3.5 text-sky-400" size={18} /><input ref={inputRef} type="text" name="streetAddress" defaultValue={formData.streetAddress} autoComplete="new-password" placeholder="Start typing address..." className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 pl-10 border focus:ring-sky-500 focus:bg-white transition-all"/></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">City</label><input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border"/></div><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">State</label><input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border"/></div><div><label className="block text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Zip</label><input type="text" name="zip" value={formData.zip} onChange={handleChange} className="w-full rounded-xl border-gray-200 bg-sky-50/50 p-3.5 border"/></div></div></div><div className="pt-6 border-t border-gray-100"><p className="text-xs text-sky-400 font-bold uppercase tracking-widest mb-4">Details (Optional)</p><div className="grid grid-cols-3 gap-3"><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Year Built</label><input type="number" name="yearBuilt" value={formData.yearBuilt} onChange={handleChange} className="w-full rounded-xl border-gray-200 p-2.5 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sq Ft</label><input type="number" name="sqFt" value={formData.sqFt} onChange={handleChange} className="w-full rounded-xl border-gray-200 p-2.5 border text-sm"/></div><div><label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lot Size</label><input type="text" name="lotSize" value={formData.lotSize} onChange={handleChange} className="w-full rounded-xl border-gray-200 p-2.5 border text-sm"/></div></div></div><input type="hidden" name="lat" value={formData.lat || ''} /><input type="hidden" name="lon" value={formData.lon || ''} /><button type="submit" disabled={isSaving} className="w-full py-4 px-6 rounded-xl shadow-lg shadow-sky-900/20 text-white bg-sky-900 hover:bg-sky-800 font-bold text-lg disabled:opacity-70 transition-transform active:scale-[0.98]">{isSaving ? 'Saving...' : 'Create My Home Log'}</button></form></div></div>); };

// --- NEW: Maintenance Dashboard Component ---
const MaintenanceDashboard = ({ records, onCompleteTask, onAddStandardTask }) => {
    const [tasks, setTasks] = useState([]);
    const [suggestions, setSuggestions] = useState([]);

    useEffect(() => {
        // 1. Process Active Tasks from Records
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

            // 2. Identify Missing Standard Tasks (Deduplication Logic)
            const missing = STANDARD_MAINTENANCE_ITEMS.filter(std => {
                // Check if we have a record with this name
                const hasItem = records.some(r => r.item.toLowerCase().includes(std.item.toLowerCase()));
                // Check if any record has this task listed in its AI suggestions
                const hasTaskInAi = records.some(r => 
                    r.maintenanceTasks && r.maintenanceTasks.some(t => t.toLowerCase().includes(std.item.toLowerCase()))
                );
                return !hasItem && !hasTaskInAi;
            });
            setSuggestions(missing);
        }
    }, [records]);

    return (
        <div className="space-y-8">
            {/* Active Tasks Section */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-sky-100">
                 <h2 className="text-2xl font-bold text-sky-900 mb-6 flex items-center">
                    <div className="bg-sky-100 p-2 rounded-lg mr-3"><Wrench className="h-6 w-6 text-sky-700" /></div> Active Schedule
                </h2>
                {tasks.length === 0 ? (
                    <div className="text-center py-8 bg-sky-50/50 rounded-2xl border border-dashed border-sky-200">
                        <p className="text-sky-400 font-medium">No scheduled maintenance found.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {tasks.map(task => (
                            <div key={task.id} className={`p-5 rounded-2xl border-l-4 shadow-sm bg-white flex flex-col md:flex-row justify-between items-start md:items-center transition-all hover:shadow-md ${
                                task.status === 'overdue' ? 'border-red-500 bg-red-50/30' : 
                                task.status === 'due-soon' ? 'border-yellow-500 bg-yellow-50/30' : 
                                'border-green-500'
                            }`}>
                                <div className="mb-3 md:mb-0">
                                    <h4 className="font-bold text-slate-800 text-lg">{task.item}</h4>
                                    <p className="text-sm text-slate-500 font-medium">{task.category} • {MAINTENANCE_FREQUENCIES.find(f => f.value === task.maintenanceFrequency)?.label}</p>
                                    <p className={`text-sm font-bold mt-1 ${
                                        task.status === 'overdue' ? 'text-red-600' : 
                                        task.status === 'due-soon' ? 'text-yellow-600' : 
                                        'text-green-600'
                                    }`}>
                                        {task.status === 'overdue' ? `Overdue by ${Math.abs(task.daysUntil)} days` : `Due in ${task.daysUntil} days`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => onCompleteTask(task)}
                                    className="px-5 py-2.5 bg-white border border-sky-200 text-sky-700 rounded-xl shadow-sm hover:bg-sky-50 hover:border-sky-300 transition font-bold flex items-center text-sm"
                                >
                                    <CheckCircle size={18} className="mr-2 text-green-500"/> Mark Complete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Suggested Tasks Section */}
            {suggestions.length > 0 && (
                <div className="bg-sky-50 p-8 rounded-[2rem] border border-sky-100">
                    <h3 className="text-xl font-bold text-sky-900 mb-2 flex items-center">
                        <Zap className="mr-2 h-6 w-6 text-sky-600"/> Suggested Maintenance
                    </h3>
                    <p className="text-sm text-sky-700/70 mb-6 font-medium">Based on standard home care, you might be missing these items.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {suggestions.map((suggestion, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-sky-100 shadow-sm flex justify-between items-center hover:border-sky-300 transition-colors group">
                                <div>
                                    <p className="font-bold text-slate-800 text-sm group-hover:text-sky-900">{suggestion.item}</p>
                                    <p className="text-xs text-slate-400 font-medium">{suggestion.category}</p>
                                </div>
                                <button 
                                    onClick={() => onAddStandardTask(suggestion)}
                                    className="p-2 bg-sky-100 text-sky-700 rounded-full hover:bg-sky-600 hover:text-white transition shadow-sm"
                                    title="Add to Log"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
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

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-sky-50 text-sky-600 font-medium">Loading Request...</div>;
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
        <div className="min-h-screen bg-sky-50 py-12 px-4 sm:px-6 lg:px-8 font-sans flex justify-center">
            <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-sky-100 overflow-hidden border border-sky-50">
                {/* Header */}
                <div className="bg-sky-900 p-10 text-center relative overflow-hidden">
                     <div className="relative z-10 flex flex-col items-center">
                        {/* FIXED LOGO SIZE */}
                        <div className="bg-white p-3 rounded-2xl shadow-lg mb-4">
                            <img src={logoSrc} alt="HausKey Logo" className="object-contain" style={{ width: '64px', height: '64px' }} />
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Contractor Submission</h1>
                        <div className="inline-flex items-center px-3 py-1 rounded-full bg-sky-800/50 border border-sky-700 text-sky-200 text-sm mt-2">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                            Active Request for {requestData?.propertyName}
                        </div>
                        <p className="text-sky-200 mt-6 font-medium border-t border-sky-800/50 pt-6 w-full max-w-xs mx-auto text-sm uppercase tracking-widest">
                           PROJECT: <span className="text-white font-bold">{requestData?.description || "Maintenance"}</span>
                        </p>
                     </div>
                     {/* Background Pattern */}
                     <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                    
                    {/* Section 1: Who */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-sky-300 uppercase tracking-widest border-b border-gray-100 pb-2">1. Contractor Details</h4>
                        <div className="relative group">
                            <User className="absolute left-4 top-3.5 text-gray-400 h-5 w-5 group-focus-within:text-sky-500 transition-colors"/>
                            <input type="text" placeholder="Your Name or Company Name" className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all font-medium text-gray-800" required value={formData.contractor} onChange={e=>setFormData({...formData, contractor: e.target.value})} />
                        </div>
                    </div>

                    {/* Section 2: What */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-sky-300 uppercase tracking-widest border-b border-gray-100 pb-2">2. Component Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative group">
                                <Tag className="absolute left-4 top-3.5 text-gray-400 h-5 w-5 group-focus-within:text-sky-500 transition-colors"/>
                                <select className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none appearance-none font-medium text-gray-700" required value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})}>
                                    <option value="" disabled>Select Category</option>
                                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-4 text-gray-400 h-4 w-4 pointer-events-none"/>
                            </div>
                            <div className="relative group">
                                <Box className="absolute left-4 top-3.5 text-gray-400 h-5 w-5 group-focus-within:text-sky-500 transition-colors"/>
                                <input type="text" placeholder="Item Name (e.g. Furnace)" className="w-full pl-12 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition-all font-medium text-gray-800" required value={formData.item} onChange={e=>setFormData({...formData, item: e.target.value})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Brand / Manufacturer</label>
                                <input type="text" placeholder="e.g. Trane" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" value={formData.brand} onChange={e=>setFormData({...formData, brand: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Model / Serial #</label>
                                <input type="text" placeholder="e.g. TUD2C100A9V5" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none" value={formData.model} onChange={e=>setFormData({...formData, model: e.target.value})} />
                            </div>
                        </div>
                        
                        {/* Maintenance for Contractor */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Date Work Completed</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/>
                                    <input type="date" className="w-full pl-10 p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 outline-none" value={formData.dateInstalled} onChange={e=>setFormData({...formData, dateInstalled: e.target.value})} required/>
                                </div>
                            </div>
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 ml-1">Recommended Maintenance</label>
                                 <div className="relative">
                                    <Clock className="absolute left-3 top-3.5 text-gray-400 h-4 w-4"/>
                                    <select className="w-full pl-10 p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 outline-none" value={formData.maintenanceFrequency} onChange={e=>setFormData({...formData, maintenanceFrequency: e.target.value})}>
                                        {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-4 text-gray-400 h-4 w-4 pointer-events-none"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Documentation */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-sky-300 uppercase tracking-widest border-b border-gray-100 pb-2">3. Documentation</h4>
                        <textarea placeholder="Notes, warranty expiration dates, filter sizes, or maintenance instructions..." className="w-full p-4 border border-gray-200 rounded-xl h-32 focus:ring-2 focus:ring-sky-500 outline-none resize-none text-gray-700" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}></textarea>
                        
                        <div className="border-2 border-dashed border-sky-200 rounded-2xl p-8 text-center hover:bg-sky-50 hover:border-sky-300 transition-all cursor-pointer relative group bg-gray-50">
                             <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" accept="image/*" onChange={e=>setSelectedFile(e.target.files[0])} />
                             <div className="flex flex-col items-center relative z-10">
                                <div className="h-12 w-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <UploadCloud className="h-6 w-6 text-sky-600"/>
                                </div>
                                <span className="text-sky-900 font-bold text-lg group-hover:text-sky-700">Upload Receipt or Photo</span>
                                <span className="text-gray-500 text-sm mt-1 max-w-xs">{selectedFile ? <span className="text-green-600 font-bold flex items-center justify-center"><CheckCircle className="h-3 w-3 mr-1"/> {selectedFile.name}</span> : "Drag and drop or click to browse (Max 1MB)"}</span>
                             </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-sky-900 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-sky-200 hover:bg-sky-800 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center group">
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
            await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'house_records'), {
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
            <div className="bg-sky-50 p-8 rounded-[2rem] border border-sky-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-bold text-sky-900">Request Links</h3>
                    <p className="text-sm text-sky-600 font-medium mt-1">Generate a unique link for a contractor to fill out the record.</p>
                </div>
                <div className="flex w-full md:w-auto gap-3">
                     <input 
                        type="text" 
                        placeholder="e.g. Kitchen Painter" 
                        className="px-4 py-3 rounded-xl border border-sky-200 flex-grow focus:ring-sky-500"
                        value={newRequestName}
                        onChange={(e) => setNewRequestName(e.target.value)}
                     />
                    <button onClick={createRequest} disabled={loading} className="px-6 py-3 bg-sky-900 text-white rounded-xl font-bold shadow-lg hover:bg-sky-800 flex items-center whitespace-nowrap transition">
                        <PlusCircle className="mr-2 h-5 w-5"/> Create
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                    <h4 className="font-bold text-slate-700 mb-6 flex items-center"><Clock className="mr-2 h-5 w-5 text-slate-400"/> Pending ({pending.length})</h4>
                    {pending.length === 0 ? <p className="text-sm text-slate-400 italic">No active links.</p> : (
                        <ul className="space-y-4">
                            {pending.map(r => (
                                <li key={r.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex flex-col">
                                         <span className="text-sm font-bold text-slate-700">{r.description || "Untitled Request"}</span>
                                         <span className="text-xs text-slate-400 font-mono mt-1">ID: {r.id.slice(0,6)}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <button onClick={() => copyLink(r.id)} className="text-sky-600 text-xs font-bold hover:underline flex items-center mr-4"><LinkIcon className="h-3 w-3 mr-1"/> Copy</button>
                                        <button onClick={() => sendEmail(r.id, r.description)} className="text-sky-600 text-xs font-bold hover:underline flex items-center mr-4"><Mail className="h-3 w-3 mr-1"/> Email</button>
                                        <button onClick={() => deleteRequest(r.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                    <h4 className="font-bold text-green-700 mb-6 flex items-center"><CheckCircle className="mr-2 h-5 w-5"/> Ready for Approval ({submitted.length})</h4>
                     {submitted.length === 0 ? <p className="text-sm text-slate-400 italic">No new submissions.</p> : (
                        <ul className="space-y-4">
                            {submitted.map(r => (
                                <li key={r.id} className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                                    <div className="flex justify-between mb-2">
                                        <div>
                                            <span className="block font-bold text-green-900">{r.item}</span>
                                            <span className="text-xs text-green-800">For: {r.description}</span>
                                        </div>
                                        <span className="text-xs text-green-700 bg-green-200 px-2 py-1 rounded-full font-bold self-start">{r.category}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mb-4 font-medium">By: {r.contractor}</p>
                                    <button onClick={() => approveRequest(r)} className="w-full py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 shadow-sm transition">Approve & Add to Log</button>
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
const EnvironmentalInsights = ({ propertyProfile }) => { const { coordinates } = propertyProfile || {}; const [airQuality, setAirQuality] = useState(null); const [solarData, setSolarData] = useState(null); const [loading, setLoading] = useState(false); useEffect(() => { if (!coordinates?.lat || !coordinates?.lon || !googleMapsApiKey) return; const fetchData = async () => { setLoading(true); try { const aqRes = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${googleMapsApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: { latitude: coordinates.lat, longitude: coordinates.lon } }) }); if(aqRes.ok) { const aqData = await aqRes.json(); if (aqData.indexes?.[0]) setAirQuality(aqData.indexes[0]); } const solarRes = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${coordinates.lat}&location.longitude=${coordinates.lon}&requiredQuality=HIGH&key=${googleMapsApiKey}`); if (solarRes.ok) setSolarData(await solarRes.json()); } catch (err) { console.error("Env fetch failed", err); } finally { setLoading(false); } }; fetchData(); }, [coordinates]); if (!coordinates?.lat) return <div className="p-6 text-center text-gray-500">Location data missing.</div>; return (<div className="space-y-6"><h2 className="text-xl font-bold text-sky-900 mb-2 flex items-center"><MapIcon className="mr-2 h-5 w-5" /> Environmental Insights</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-sky-100 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Wind className="h-24 w-24 text-blue-500" /></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Air Quality</h3>{loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (airQuality ? (<div><div className="flex items-baseline"><span className="text-4xl font-extrabold text-gray-900">{airQuality.aqi}</span><span className="ml-2 text-sm font-medium text-gray-500">US AQI</span></div><p className="text-sky-600 font-medium mt-1">{airQuality.category}</p></div>) : <p className="text-gray-500 text-sm">Data unavailable.</p>)}</div><div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Sun className="h-24 w-24 text-yellow-500" /></div><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Solar Potential</h3>{loading ? <div className="animate-pulse h-8 w-24 bg-gray-200 rounded"></div> : (solarData ? (<div><div className="flex items-baseline"><span className="text-4xl font-extrabold text-gray-900">{Math.round(solarData?.solarPotential?.maxSunshineHoursPerYear || 0)}</span><span className="ml-2 text-sm font-medium text-gray-500">Sun Hours/Year</span></div></div>) : <p className="text-gray-500 text-sm">Data unavailable.</p>)}</div></div><PropertyMap propertyProfile={propertyProfile} /></div>); };
const PropertyMap = ({ propertyProfile }) => { const address = propertyProfile?.address; const mapQuery = address ? `${address.street}, ${address.city}, ${address.state} ${address.zip}` : propertyProfile?.name || "Home"; const encodedQuery = encodeURIComponent(mapQuery); const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodedQuery}`; return (<div className="space-y-6"><div className="bg-white p-4 rounded-2xl shadow-sm border border-sky-100"><div className="w-full h-64 bg-gray-100 rounded-xl overflow-hidden relative"><iframe width="100%" height="100%" src={mapUrl} frameBorder="0" scrolling="no" title="Property Map" className="absolute inset-0"></iframe></div></div><div className="bg-sky-50 p-6 rounded-2xl border border-sky-100"><h3 className="text-lg font-bold text-sky-900 mb-3 flex items-center"><ShoppingBag className="mr-2 h-5 w-5" /> Nearby Suppliers</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg border border-sky-100 hover:shadow-md transition text-sky-800 font-medium text-sm group">The Home Depot <ExternalLink size={14}/></a><a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg border border-sky-100 hover:shadow-md transition text-sky-800 font-medium text-sm group">Lowe's <ExternalLink size={14}/></a></div></div></div>); };
const RecordCard = ({ record, onDeleteClick, onEditClick }) => ( <div className="bg-white p-0 rounded-[1.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-slate-200 duration-300 cursor-pointer group relative overflow-hidden"> {record.imageUrl && <div className="h-48 w-full bg-gray-100 relative group print:h-32 rounded-t-[1.5rem] -mt-0 -mx-0 mb-6"><img src={record.imageUrl} alt={record.item} className="w-full h-full object-cover"/></div>} <div className={`p-8 ${record.imageUrl ? 'pt-0' : ''} flex flex-col h-full`}> <div className="flex justify-between items-start mb-6"> <div className="p-2.5 rounded-full bg-slate-100 text-slate-500 group-hover:bg-sky-900 group-hover:text-white transition-colors duration-300"> <Home size={20} /> </div> <span className="bg-white border border-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{String(record.category || 'General')}</span> </div> <div className="mb-4"> <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 group-hover:text-sky-500 transition-colors">Item</p> <h2 className="text-2xl font-bold text-slate-800 group-hover:text-slate-900 leading-tight">{String(record.item || 'Unknown')}</h2> </div> <div className="space-y-2 mb-6"> {record.brand && <p className="text-slate-500 text-sm flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>{record.brand}</p>} {record.dateInstalled && <p className="text-slate-500 text-sm flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></span>{record.dateInstalled}</p>} </div> <div className="flex justify-between items-center border-t border-slate-50 pt-4 mt-auto"> <div className="flex gap-2"> <button onClick={() => onEditClick(record)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-sky-600 transition"><Pencil size={16}/></button> <button onClick={() => onDeleteClick(record.id)} className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition"><Trash2 size={16}/></button> </div> {record.maintenanceFrequency !== 'none' && <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-md">{MAINTENANCE_FREQUENCIES.find(f=>f.value===record.maintenanceFrequency)?.label}</span>} </div> </div> </div> );
const AddRecordForm = ({ onSave, onBatchSave, isSaving, newRecord, onInputChange, onFileChange, fileInputRef, isEditing, onCancelEdit }) => { const showSheen = newRecord.category === "Paint & Finishes"; const showMaterial = ["Roof & Exterior", "Flooring"].includes(newRecord.category); const showSerial = ["Appliances", "HVAC & Systems", "Plumbing", "Electrical"].includes(newRecord.category); const [isCustomArea, setIsCustomArea] = useState(false); useEffect(() => { if (newRecord.area && !ROOMS.includes(newRecord.area)) { setIsCustomArea(true); } else if (!newRecord.area) { setIsCustomArea(false); } }, [newRecord.area]); const handleRoomChange = (e) => { if (e.target.value === "Other (Custom)") { setIsCustomArea(true); onInputChange({ target: { name: 'area', value: '' } }); } else { setIsCustomArea(false); onInputChange(e); } }; let brandLabel = "Brand"; let modelLabel = "Model/Color Code"; if (newRecord.category === "Paint & Finishes") { brandLabel = "Paint Brand"; modelLabel = "Color Name/Code"; } else if (newRecord.category === "Appliances") { brandLabel = "Manufacturer"; modelLabel = "Model Number"; } const safeRecord = newRecord || initialRecordState; 

    // --- NEW: AI Suggestion Logic (UPDATED) ---
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [suggestedTasks, setSuggestedTasks] = useState([]); 
    const [scannedItems, setScannedItems] = useState([]);
    const [scannedImagePreview, setScannedImagePreview] = useState(null);
    const [scannedImageBase64, setScannedImageBase64] = useState(null); // NEW: Store base64 for batch save
    const smartScanInputRef = useRef(null);

    // NEW: Global Fields for Bulk Update
    const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
    const [globalStore, setGlobalStore] = useState("");
    const [globalArea, setGlobalArea] = useState("General"); // NEW: Global Room

    const suggestMaintenance = async () => {
        if (!newRecord.item && !newRecord.category) {
            alert("Please enter an Item Name or Category first.");
            return;
        }
        setIsSuggesting(true);
        setSuggestedTasks([]); 

        try {
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
            const text = response.text().replace(/```json|```/g, '').trim(); 
            const data = JSON.parse(text);

            if (data.frequency) {
                const validFreqs = ["quarterly", "semiannual", "annual", "biennial", "quinquennial", "none"];
                if (validFreqs.includes(data.frequency)) {
                    onInputChange({ target: { name: 'maintenanceFrequency', value: data.frequency } });
                }
            }
            if (data.tasks && Array.isArray(data.tasks)) {
                setSuggestedTasks(data.tasks);
                onInputChange({ target: { name: 'maintenanceTasks', value: data.tasks } });
            }
        } catch (error) {
            console.error("AI Error:", error);
            alert("Could not fetch details. Please try again.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleSmartScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setScannedImagePreview(previewUrl);

        setIsScanning(true);
        setScannedItems([]);
        
        try {
            // Use the new compression helper instead of fileToBase64
            const base64Str = await compressImage(file);
            const base64Data = getBase64Data(base64Str);
            
            setScannedImageBase64(base64Str); // Store compressed data URI for saving

            const prompt = `
                Analyze this image. It is either a receipt, an invoice, or a product label.
                
                Identify all distinct line items or products.
                
                CRITICAL INSTRUCTION: Receipt text is often abbreviated and messy (e.g., "Gb 2-hand Bth Fauc"). 
                You MUST convert this into professional, human-readable text.
                - Expand abbreviations: "Bshd Nic" -> "Brushed Nickel", "Fauc" -> "Faucet", "Gb" -> "Glacier Bay".
                - Reformat: Make it look like a product catalog title.
                
                For EACH item, extract:
                - item: The CLEAN, FULL product name (e.g., "Glacier Bay 2-Handle Bath Faucet, Brushed Nickel").
                - category: Best guess from [Paint & Finishes, Appliances, Flooring, HVAC & Systems, Plumbing, Electrical, Roof & Exterior, Landscaping, Service & Repairs, Safety, Interior, Other].
                - brand: Full Manufacturer Name (e.g. "Glacier Bay").
                - model: Model # (if visible).
                - contractor: Store name (if receipt).
                - dateInstalled: Date on receipt (YYYY-MM-DD).

                Return a JSON object with a key "items" containing an array of these objects.
            `;

            const result = await window.geminiModel.generateContent([
                prompt,
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } } // Compress always returns jpeg
            ]);
            
            const response = result.response;
            const text = response.text().replace(/```json|```/g, '').trim();
            const data = JSON.parse(text);

            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                setScannedItems(data.items);
                
                if (data.items[0].dateInstalled) setGlobalDate(data.items[0].dateInstalled);
                if (data.items[0].contractor) setGlobalStore(toProperCase(data.items[0].contractor));
                
                if (data.items.length === 1) applyScannedItem(data.items[0]);
            } else {
                alert("No items detected in image.");
            }

        } catch (error) {
            console.error("Scan Error:", error);
            alert("Could not analyze image. Please try again.");
        } finally {
            setIsScanning(false);
            if (smartScanInputRef.current) smartScanInputRef.current.value = "";
        }
    };

    const applyScannedItem = (itemData) => {
        if (itemData.category) onInputChange({ target: { name: 'category', value: itemData.category } });
        if (itemData.item) onInputChange({ target: { name: 'item', value: toProperCase(itemData.item) } });
        if (itemData.brand) onInputChange({ target: { name: 'brand', value: toProperCase(itemData.brand) } });
        if (itemData.model) onInputChange({ target: { name: 'model', value: itemData.model } });
        if (itemData.dateInstalled) onInputChange({ target: { name: 'dateInstalled', value: itemData.dateInstalled } });
        if (itemData.contractor && itemData.contractor !== 'Unknown') onInputChange({ target: { name: 'contractor', value: toProperCase(itemData.contractor) } });
        // Auto-fill global room if set
        if (globalArea) onInputChange({ target: { name: 'area', value: globalArea } });
    };

    const updateScannedItem = (index, field, value) => {
        const updated = [...scannedItems];
        updated[index][field] = value;
        setScannedItems(updated);
    };

    const deleteScannedItem = (index) => {
        const updated = scannedItems.filter((_, i) => i !== index);
        setScannedItems(updated);
    };

    const handleBatchSaveClick = async () => {
        if (scannedItems.length === 0) return;
        
        // Apply global fields and attach the image to all items
        const finalItems = scannedItems.map(item => ({
            ...item,
            dateInstalled: globalDate || item.dateInstalled,
            contractor: globalStore || item.contractor,
            area: item.area || globalArea, // NEW: Prioritize item area, then global
            imageUrl: scannedImageBase64 // Attach the receipt image!
        }));

        if (confirm(`Are you sure you want to save all ${finalItems.length} items to your log?`)) {
           const success = await onBatchSave(finalItems);
           if (success) {
               setScannedItems([]);
               setScannedImagePreview(null);
               setScannedImageBase64(null);
           }
        }
    };
    // --------------------------------

return ( <form onSubmit={onSave} className="p-10 bg-white rounded-[2rem] shadow-xl border border-slate-100 space-y-6"> 
    
    {/* SMART SCAN HEADER */}
    <div className="bg-sky-50 rounded-2xl p-6 border border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
            <h3 className="font-bold text-sky-900 flex items-center"><ScanLine className="mr-2 h-5 w-5 text-sky-600"/> Smart Scan</h3>
            <p className="text-xs text-sky-600 mt-1">Take a photo of a label or receipt to auto-fill.</p>
        </div>
        <button 
            type="button" 
            onClick={() => smartScanInputRef.current?.click()}
            disabled={isScanning}
            className="px-5 py-3 bg-white text-sky-700 font-bold rounded-xl shadow-sm border border-sky-200 hover:bg-sky-50 transition flex items-center"
        >
            {isScanning ? <span className="animate-pulse">Analyzing...</span> : <><Camera className="mr-2 h-4 w-4"/> Auto-Fill from Photo</>}
        </button>
        <input type="file" ref={smartScanInputRef} className="hidden" accept="image/*" onChange={handleSmartScan} />
    </div>

    {/* NEW: INTERACTIVE REVIEW DECK */}
    {scannedItems.length > 0 && (
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 mb-8 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                <h4 className="font-bold text-slate-800 flex items-center"><ListChecks className="mr-2 h-5 w-5 text-sky-600"/> Review Scan Results</h4>
                <button type="button" onClick={handleBatchSaveClick} className="bg-sky-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-sky-800 shadow-lg shadow-sky-900/20 transition flex items-center">
                    <Save className="mr-2 h-4 w-4"/> Save All Items
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. IMAGE PREVIEW */}
                <div className="lg:col-span-1">
                    {scannedImagePreview && (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm h-full max-h-96 lg:max-h-full relative group">
                            <img src={scannedImagePreview} alt="Receipt" className="w-full h-full object-cover object-top" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-bold uppercase tracking-widest">Source Image</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. EDITABLE LIST */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Global Settings */}
                    <div className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                        <div className="col-span-full sm:col-span-3 text-xs font-bold text-sky-700 uppercase tracking-wider border-b border-slate-100 pb-2 mb-1">Global Settings (Applies to All)</div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                            <input type="date" value={globalDate} onChange={(e) => setGlobalDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-sky-500 focus:border-sky-500 w-full p-2" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store / Contractor</label>
                            <input type="text" value={globalStore} onChange={(e) => setGlobalStore(e.target.value)} placeholder="Store Name" className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-sky-500 focus:border-sky-500 w-full p-2" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Default Room</label>
                            <div className="relative">
                                <select value={globalArea} onChange={(e) => setGlobalArea(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-sky-500 focus:border-sky-500 w-full p-2 appearance-none">
                                    {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                    <option value="General">General</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-2 top-3 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                    </div>

                    {/* Item Cards */}
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {scannedItems.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start group hover:border-sky-300 transition-colors relative">
                                <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-3 w-full">
                                    <div className="sm:col-span-5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item Name</label>
                                        <input 
                                            type="text" 
                                            value={item.item} 
                                            onChange={(e) => updateScannedItem(idx, 'item', e.target.value)}
                                            className="w-full text-sm font-bold text-slate-800 border-0 border-b border-slate-200 focus:border-sky-500 focus:ring-0 px-0 py-1 bg-transparent"
                                        />
                                    </div>
                                    <div className="sm:col-span-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                                        <select 
                                            value={item.category} 
                                            onChange={(e) => updateScannedItem(idx, 'category', e.target.value)}
                                            className="w-full text-xs font-medium text-slate-600 border-0 border-b border-slate-200 focus:border-sky-500 focus:ring-0 px-0 py-1 bg-transparent"
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-3">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Room Override</label>
                                        <select 
                                            value={item.area || ""} 
                                            onChange={(e) => updateScannedItem(idx, 'area', e.target.value)}
                                            className="w-full text-xs font-medium text-slate-500 border-0 border-b border-slate-200 focus:border-sky-500 focus:ring-0 px-0 py-1 bg-transparent"
                                        >
                                            <option value="">(Use Global)</option>
                                            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => deleteScannedItem(idx)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-center"
                                    title="Remove Item"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )}

    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-2"> <h2 className="text-2xl font-bold text-slate-800">{isEditing ? 'Edit Record' : 'Manual Entry'}</h2> {isEditing && <button type="button" onClick={onCancelEdit} className="text-sm text-slate-400 hover:text-slate-600 flex items-center font-bold uppercase tracking-wider"><X size={14} className="mr-1"/> Cancel</button>} </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"> <div> <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Category *</label> <div className="relative"><select name="category" value={safeRecord.category} onChange={onInputChange} required className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white transition-colors appearance-none"><option value="" disabled>Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/></div> </div> <div> <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Area/Room *</label> {!isCustomArea ? ( <div className="relative"><select name="area" value={ROOMS.includes(safeRecord.area) ? safeRecord.area : ""} onChange={handleRoomChange} required className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white transition-colors appearance-none"><option value="" disabled>Select</option>{ROOMS.map(r => <option key={r} value={r}>{r}</option>)}<option value="Other (Custom)">Other (Custom)</option></select><ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/></div> ) : ( <div className="relative flex"><input type="text" name="area" value={safeRecord.area} onChange={onInputChange} required autoFocus placeholder="e.g. Guest House" className="block w-full rounded-l-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/><button type="button" onClick={() => {setIsCustomArea(false); onInputChange({target:{name:'area', value:''}})}} className="px-4 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-200"><X size={18}/></button></div> )} </div> </div> <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Item Name *</label><input type="text" name="item" value={safeRecord.item} onChange={onInputChange} required placeholder="e.g. North Wall" className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 focus:bg-white transition-colors"/></div> <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100"> <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{brandLabel}</label><input type="text" name="brand" value={safeRecord.brand} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div> <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{modelLabel}</label><input type="text" name="model" value={safeRecord.model} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div> {showSheen && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sheen</label><div className="relative"><select name="sheen" value={safeRecord.sheen} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm appearance-none"><option value="" disabled>Select</option>{PAINT_SHEENS.map(s => <option key={s} value={s}>{s}</option>)}</select><ChevronDown size={14} className="absolute right-2 top-3 text-slate-400 pointer-events-none"/></div></div>} {showSerial && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Serial #</label><input type="text" name="serialNumber" value={safeRecord.serialNumber} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div>} {showMaterial && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Material</label><div className="relative"><select name="material" value={safeRecord.material} onChange={onInputChange} className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm appearance-none"><option value="" disabled>Select</option>{(safeRecord.category==="Roof & Exterior"?ROOF_MATERIALS:FLOORING_TYPES).map(m=><option key={m} value={m}>{m}</option>)}</select><ChevronDown size={14} className="absolute right-2 top-3 text-slate-400 pointer-events-none"/></div></div>} </div> <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"> <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date Installed</label><input type="date" name="dateInstalled" value={safeRecord.dateInstalled} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div> <div className="space-y-2"> <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Contractor</label><input type="text" name="contractor" value={safeRecord.contractor} onChange={onInputChange} placeholder="Company Name" className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div> <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Profile URL</label><input type="url" name="contractorUrl" value={safeRecord.contractorUrl} onChange={onInputChange} placeholder="https://..." className="block w-full rounded-lg border-slate-200 p-2.5 border text-sm"/></div> </div> </div> 
    
    <div>
        <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Maintenance Schedule</label>
            <button 
                type="button" 
                onClick={suggestMaintenance}
                disabled={isSuggesting}
                className="text-xs flex items-center bg-sky-50 text-sky-700 px-3 py-1.5 rounded-full border border-sky-100 hover:bg-sky-100 transition-colors font-bold uppercase tracking-wide"
            >
                {isSuggesting ? (
                    <span className="animate-pulse">Thinking...</span> 
                ) : (
                    <>
                        <Zap size={12} className="mr-1 fill-sky-700"/> Auto-Suggest
                    </>
                )}
            </button>
        </div>
        <div className="relative">
            <select name="maintenanceFrequency" value={safeRecord.maintenanceFrequency} onChange={onInputChange} className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500 appearance-none">
                {MAINTENANCE_FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-4 text-slate-400 pointer-events-none"/>
        </div>
        
        {/* NEW: Display Suggested Tasks */}
        {suggestedTasks.length > 0 && (
            <div className="mt-4 p-4 bg-sky-50 rounded-xl border border-sky-100 text-sm">
                <p className="font-bold text-sky-900 mb-2 flex items-center">
                    <Wrench size={14} className="mr-2"/> Suggested Tasks:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sky-800">
                    {suggestedTasks.map((task, i) => (
                        <li key={i}>{task}</li>
                    ))}
                </ul>
            </div>
        )}
    </div>
    
    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Product Link</label><input type="url" name="purchaseLink" value={safeRecord.purchaseLink} onChange={onInputChange} placeholder="https://..." className="block w-full rounded-xl border-slate-200 bg-slate-50 p-3.5 border focus:ring-sky-500"/></div> <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 hover:border-sky-400 hover:bg-sky-50 transition-colors text-center cursor-pointer relative group"><label className="block text-sm font-bold text-slate-600 mb-2 group-hover:text-sky-700 pointer-events-none">Upload Receipt or Photo</label><input type="file" accept="image/*" onChange={onFileChange} ref={fileInputRef} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/><div className="text-slate-400 group-hover:text-sky-400"><Camera size={24} className="mx-auto mb-2"/></div><p className="text-xs text-slate-400 group-hover:text-sky-500">Max 1MB</p></div> <div><label className="block text-sm font-medium text-gray-700">Notes</label><textarea name="notes" rows="3" value={safeRecord.notes} onChange={onInputChange} className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2 border resize-none"></textarea></div> <button type="submit" disabled={isSaving} className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-lg shadow-sky-900/10 text-base font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:opacity-50 transition-transform active:scale-[0.98]"> {isSaving ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? <><Pencil size={18} className="mr-2"/> Update Record</> : <><PlusCircle size={18} className="mr-2"/> Log New Item</>)} </button> </form> ); };
const PedigreeReport = ({ propertyProfile, records = [] }) => { const stats = useMemo(() => { const defaultVal = { age: 'N/A', date: 'No data' }; try { const calculateAge = (categoryKeyword, itemKeyword) => { if (!records || records.length === 0) return defaultVal; const record = records.find(r => { if (!r) return false; const cat = String(r.category || '').toLowerCase(); const item = String(r.item || '').toLowerCase(); return (cat.includes(categoryKeyword.toLowerCase()) || item.includes(itemKeyword.toLowerCase())) && r.dateInstalled; }); if (!record) return { age: 'N/A', date: 'No record' }; const installed = new Date(record.dateInstalled); if (isNaN(installed.getTime())) return { age: 'N/A', date: 'Invalid Date' }; const age = new Date().getFullYear() - installed.getFullYear(); return { age: `${age} Yrs`, date: `Installed ${installed.getFullYear()}` }; }; return { hvac: calculateAge('HVAC', 'hvac'), roof: calculateAge('Roof', 'roof'), heater: calculateAge('Plumbing', 'water heater') }; } catch (e) { return { hvac: defaultVal, roof: defaultVal, heater: defaultVal }; } }, [records]); const sortedRecords = useMemo(() => { if (!records) return []; return [...records].sort((a, b) => { const dateA = a.dateInstalled ? new Date(a.dateInstalled) : (a.timestamp && typeof a.timestamp === 'string' ? new Date(a.timestamp) : new Date(0)); const dateB = b.dateInstalled ? new Date(b.dateInstalled) : (b.timestamp && typeof b.timestamp === 'string' ? new Date(b.timestamp) : new Date(0)); return dateB - dateA; }); }, [records]); return ( <div className="bg-sky-50 min-h-screen pb-12"> <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center print:hidden pt-6 px-4"> <h2 className="text-2xl font-bold text-sky-900">Pedigree Report</h2> <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-sky-900 text-white rounded-lg shadow-sm hover:bg-sky-800 transition"><Printer className="h-4 w-4 mr-2" /> Print / Save PDF</button> </div> <div className="max-w-5xl mx-auto bg-white rounded-[2rem] shadow-xl overflow-hidden border border-sky-100 print:shadow-none print:border-0"> <div className="bg-sky-900 text-white p-8 md:p-12 relative overflow-hidden"> <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12 translate-x-10 -translate-y-10"><img src={logoSrc} className="w-64 h-64 brightness-0 invert" alt="Watermark"/></div> <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center"> <div> <h1 className="text-4xl md:text-5xl font-extrabold mb-2 tracking-tight text-white">{propertyProfile?.name || 'My Property'}</h1> <p className="text-sky-200 text-lg flex items-center"><MapPin className="h-5 w-5 mr-2" /> {propertyProfile?.address?.street ? `${propertyProfile.address.street}, ${propertyProfile.address.city || ''} ${propertyProfile.address.state || ''}` : 'No Address Listed'}</p> </div> <div className="mt-8 md:mt-0 text-left md:text-right"><p className="text-xs text-sky-300 uppercase tracking-wide mb-1">Report Date</p><p className="font-mono text-lg font-bold">{new Date().toLocaleDateString()}</p></div> </div> </div> <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-sky-100 border-b border-sky-100 bg-sky-50 print:grid-cols-4"> <div className="p-6 text-center"><p className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">HVAC Age</p><p className="text-2xl font-extrabold text-sky-900">{stats.hvac.age}</p><p className="text-xs text-sky-500 mt-1">{stats.hvac.date}</p></div> <div className="p-6 text-center"><p className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">Roof Age</p><p className="text-2xl font-extrabold text-sky-900">{stats.roof.age}</p><p className="text-xs text-sky-500 mt-1">{stats.roof.date}</p></div> <div className="p-6 text-center"><p className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">Water Heater</p><p className="text-2xl font-extrabold text-sky-900">{stats.heater.age}</p><p className="text-xs text-sky-500 mt-1">{stats.heater.date}</p></div> <div className="p-6 text-center"><p className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">Total Records</p><p className="text-2xl font-extrabold text-sky-600">{records ? records.length : 0}</p></div> </div> <div className="p-8 md:p-10"> <div className="space-y-8 border-l-2 border-sky-100 ml-3 pl-8 relative"> {sortedRecords.map(record => ( <div key={record.id} className="relative break-inside-avoid"> <div className="absolute -left-[41px] top-1 h-6 w-6 rounded-full bg-white border-4 border-sky-600"></div> <div className="mb-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between"> <span className="font-bold text-lg text-slate-900 mr-3">{String(record.item || 'Unknown Item')}</span> <span className="text-sm font-mono text-slate-500">{record.dateInstalled || (typeof record.timestamp === 'string' ? record.timestamp : 'No Date')}</span> </div> <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm print:shadow-none print:border"> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3 text-sm"> <div><span className="text-sky-400 uppercase text-xs font-bold">Category:</span> <span className="font-medium text-slate-700">{String(record.category || 'Uncategorized')}</span></div> {record.brand && <div><span className="text-sky-400 uppercase text-xs font-bold">Brand:</span> <span className="font-medium text-slate-700">{String(record.brand)}</span></div>} {record.contractor && <div><span className="text-sky-400 uppercase text-xs font-bold">Contractor:</span> <span className="font-medium text-slate-700">{String(record.contractor)}</span></div>} </div> {record.notes && <p className="text-sm text-slate-600 bg-sky-50 p-3 rounded-xl border border-sky-100 italic print:bg-transparent print:border-0">"{String(record.notes)}"</p>} {record.imageUrl && <div className="mt-3"><img src={record.imageUrl} alt="Record" className="h-32 w-auto rounded-xl border border-sky-100 object-cover print:h-24" /></div>} </div> </div> ))} </div> </div> </div> </div> ); };

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
    
    // NEW: Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);

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
        // UPDATED: Now queries a USER-SPECIFIC path
        const q = query(collection(db, 'artifacts', appId, 'users', userId, 'house_records'));
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
    
    // UPDATED: Handle Save Profile triggers Onboarding
    const handleSaveProfile = async (formData) => { 
        // e.preventDefault();  <-- REMOVED: formData is not an event
        const name = formData.get('propertyName'); 
        if(!name) return; 
        setIsSaving(true); 
        try { 
            const data = { 
                name, 
                address: { 
                    street: formData.get('streetAddress'), 
                    city: formData.get('city'), 
                    state: formData.get('state'), 
                    zip: formData.get('zip') 
                }, 
                yearBuilt: formData.get('yearBuilt'), 
                sqFt: formData.get('sqFt'), 
                lotSize: formData.get('lotSize'), 
                coordinates: (formData.get('lat') && formData.get('lon')) ? { 
                    lat: parseFloat(formData.get('lat')), 
                    lon: parseFloat(formData.get('lon')) 
                } : null, 
                createdAt: serverTimestamp() 
            }; 
            await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'settings', 'profile'), data); 
            setPropertyProfile(data);
            // Trigger Welcome Modal
            setShowOnboarding(true);
        } catch(e) { 
            setError("Save failed: " + e.message); 
        } finally { 
            setIsSaving(false); 
        } 
    };

    const handleInputChange = useCallback((e) => { const { name, value } = e.target; setNewRecord(prev => ({ ...prev, [name]: value })); }, []);
    const handleFileChange = useCallback((e) => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }, []);
    const handleEditClick = (record) => { setNewRecord(record); setEditingId(record.id); setActiveTab('Add Record'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleCancelEdit = () => { setNewRecord(initialRecordState); setEditingId(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
    
    // UPDATED: saveRecord uses USER-SPECIFIC path
    const saveRecord = useCallback(async (e) => { 
        e.preventDefault(); 
        if (!db || !userId || isSaving) return; 
        if (!newRecord.area || !newRecord.category || !newRecord.item) { setError("Missing fields."); return; } 
        setIsSaving(true); 
        setError(null); 
        try { 
            let finalImageUrl = ''; 
            if (selectedFile) { 
                // Use compression for manually selected files too
                finalImageUrl = await compressImage(selectedFile);
            } 
            // Calculate Next Service Date
            const nextServiceDate = calculateNextDate(newRecord.dateInstalled, newRecord.maintenanceFrequency);

            const recordData = { 
                ...newRecord, 
                nextServiceDate, 
                propertyLocation: propertyProfile?.name || 'My Property', 
                imageUrl: finalImageUrl || newRecord.imageUrl, 
                userId: currentUser.uid, 
                timestamp: editingId ? newRecord.timestamp : serverTimestamp(), 
                maintenanceTasks: newRecord.maintenanceTasks || [] 
            }; 
            
            // UPDATED PATH
            const userRecordsRef = collection(db, 'artifacts', appId, 'users', userId, 'house_records');

            if (editingId) { 
                await updateDoc(doc(userRecordsRef, editingId), recordData); 
            } else { 
                await addDoc(userRecordsRef, recordData); 
            } 
            setNewRecord(initialRecordState); 
            setEditingId(null); 
            setSelectedFile(null); 
            if (fileInputRef.current) fileInputRef.current.value = ""; 
            setActiveTab('View Records'); 
        } catch (e) { setError("Save failed: " + e.message); } finally { setIsSaving(false); } 
    }, [db, currentUser, isSaving, newRecord, selectedFile, propertyProfile, editingId, userId]); 

    // --- NEW: Batch Save Handler ---
    const handleBatchSave = async (items) => {
        if (!db || !userId) return false;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const userRecordsRef = collection(db, 'artifacts', appId, 'users', userId, 'house_records');

            items.forEach(item => {
                const nextServiceDate = calculateNextDate(item.dateInstalled, item.maintenanceFrequency || 'none');
                const recordData = {
                    userId: currentUser.uid,
                    propertyLocation: propertyProfile?.name || 'My Property',
                    category: item.category || 'Other',
                    item: toProperCase(item.item),
                    brand: toProperCase(item.brand) || '',
                    model: item.model || '', // Keep models as-is
                    contractor: toProperCase(item.contractor) || '',
                    dateInstalled: item.dateInstalled || new Date().toISOString().split('T')[0],
                    area: item.area || 'General', // Default to general
                    maintenanceFrequency: 'none', // Default, user can edit later
                    nextServiceDate,
                    timestamp: serverTimestamp(),
                    maintenanceTasks: [],
                    // FIX: Read the image from the item itself
                    imageUrl: item.imageUrl || '' 
                };
                const docRef = doc(userRecordsRef); 
                batch.set(docRef, recordData);
            });

            await batch.commit();
            alert(`Successfully saved ${items.length} items to your log!`);
            setActiveTab('View Records');
            return true;
        } catch (e) {
            console.error("Batch Save Error:", e);
            alert("Batch save failed: " + e.message);
            return false;
        } finally {
            setIsSaving(false);
        }
    };
    
    // UPDATED: Deletion logic uses USER-SPECIFIC path
    const handleDeleteConfirmed = async () => { 
        if(!db || !confirmDelete || !userId) return; 
        try { 
            await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'house_records', confirmDelete)); 
            setConfirmDelete(null); 
        } catch(e){ setError("Delete failed."); } 
    };
    const grouped = records.reduce((acc, r) => { const k = r.area || 'Uncategorized'; if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc; }, {});
    
    // --- NEW: Handle Task Completion ---
    const handleCompleteTask = async (task) => {
        if (!confirm(`Mark "${task.item}" as complete?`)) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const nextDate = calculateNextDate(today, task.maintenanceFrequency);
            
            const userRecordsRef = collection(db, 'artifacts', appId, 'users', userId, 'house_records');

            // 1. Update the Active Record
            await updateDoc(doc(userRecordsRef, task.id), {
                lastServiceDate: today,
                nextServiceDate: nextDate
            });

            // 2. Create a Historical Log Entry
            await addDoc(userRecordsRef, {
                userId: currentUser.uid,
                propertyLocation: propertyProfile?.name || 'My Property',
                category: "Service & Repairs",
                item: `Maintenance: ${task.item}`,
                dateInstalled: today,
                timestamp: serverTimestamp(),
                notes: `Completed scheduled maintenance. Next due: ${nextDate}`,
                area: task.area || 'General',
                contractor: 'Self / Homeowner'
            });
            alert("Maintenance logged and schedule updated!");
        } catch (e) {
            console.error(e);
            alert("Error updating task: " + e.message);
        }
    };

    // --- NEW: Add Standard Task ---
    const handleAddStandardTask = async (stdItem) => {
        const today = new Date().toISOString().split('T')[0];
        const nextDate = calculateNextDate(today, stdItem.maintenanceFrequency);
        try {
            // UPDATED PATH
            await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'house_records'), {
                userId: currentUser.uid,
                propertyLocation: propertyProfile?.name || 'My Property',
                category: stdItem.category,
                item: stdItem.item,
                area: 'General', // Default area
                maintenanceFrequency: stdItem.maintenanceFrequency,
                maintenanceTasks: stdItem.tasks,
                dateInstalled: today,
                nextServiceDate: nextDate,
                timestamp: serverTimestamp(),
                notes: "Added from Standard Maintenance List"
            });
        } catch(e) {
            alert("Error adding task: " + e.message);
        }
    };


    if (isContractorMode) return <ContractorView />; 

    if (loading) return <div className="flex items-center justify-center min-h-screen text-lg font-medium text-sky-500">Initializing HausKey...</div>;
    if (!userId) return <AuthScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onAppleLogin={handleAppleLogin} onGuestLogin={handleGuestLogin} error={error} />;
    if (isLoadingProfile) return <div className="flex items-center justify-center min-h-screen text-sky-500">Loading Profile...</div>;
    if (!propertyProfile) return <div className="min-h-screen bg-sky-50 p-4"><style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'); body { font-family: 'Outfit', sans-serif; }`}</style><SetupPropertyForm onSave={handleSaveProfile} isSaving={isSaving} onSignOut={handleSignOut} /></div>;

    return (
        <div className="min-h-screen bg-sky-50 p-4 sm:p-8 font-sans relative">
             {/* ... Header ... */}
             <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'); body { font-family: 'Outfit', sans-serif; }`}</style>
                <link rel="icon" type="image/svg+xml" href={logoSrc} />
                <header className="text-center mb-8 flex flex-col sm:flex-row items-center justify-center relative">
                    <div className="absolute top-0 right-0 flex space-x-3 items-center sm:mt-2 z-10">
                        <button onClick={initiateAccountDeletion} className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete Account"><UserMinus size={18} /></button>
                        <button onClick={handleSignOut} className="p-2 rounded-full text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="Sign Out"><LogOut size={18} /></button>
                    </div>
                    <img src={logoSrc} alt="HausKey Logo" className="h-20 w-20 mb-4 sm:mb-0 sm:mr-6 shadow-sm rounded-3xl" />
                    <div className="text-center sm:text-left">
                        {/* REBRANDED TITLE: Navy Haus, Sky Key */}
                        <h1 className="text-4xl sm:text-6xl font-bold text-sky-900 tracking-tight">
                            Haus<span className="text-sky-500 font-normal">Key</span>
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg font-medium">The official Property Pedigree for your home.</p>
                        
                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                            <div className="inline-flex items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-sky-100">
                                <Home size={16} className="text-sky-500 mr-2.5" />
                                <span className="text-slate-800 font-bold text-sm">{propertyProfile.name}</span>
                            </div>
                            <div className="inline-flex items-center text-slate-500 bg-slate-100/50 px-4 py-1.5 rounded-full border border-slate-200 text-sm font-medium">
                                <MapPin size={16} className="text-slate-400 mr-2.5" />
                                <span>{propertyProfile.address?.street}, {propertyProfile.address?.city}</span>
                            </div>
                        </div>
                    </div>
                </header>
                {/* ... rest of render ... */}
                {error && <div className="max-w-4xl mx-auto bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-2xl mb-6 shadow-sm">{error}<span className="float-right cursor-pointer font-bold" onClick={()=>setError(null)}>×</span></div>}
                
                {/* UPDATED NAVIGATION FOR MOBILE: Overflow-X and No-Wrap */}
                <nav className="flex justify-start md:justify-center mb-8 max-w-lg mx-auto print:hidden overflow-x-auto pb-2 px-2 md:px-0 snap-x no-scrollbar scroll-smooth">
                    <div className="flex min-w-max gap-0">
                        <button onClick={() => setActiveTab('View Records')} className={`flex-1 px-4 py-3 text-sm font-bold rounded-l-2xl border transition-all whitespace-nowrap ${activeTab==='View Records'?'bg-sky-900 text-white border-sky-900 shadow-lg shadow-sky-900/20':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>History</button>
                        <button onClick={() => setActiveTab('Maintenance')} className={`flex-1 px-4 py-3 text-sm font-bold border-y transition-all whitespace-nowrap ${activeTab==='Maintenance'?'bg-sky-900 text-white border-sky-900 shadow-lg shadow-sky-900/20 z-10':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Maintenance</button>
                        <button onClick={() => { setActiveTab('Add Record'); handleCancelEdit(); }} className={`flex-1 px-4 py-3 text-sm font-bold border-y border-l transition-all whitespace-nowrap ${activeTab==='Add Record'?'bg-sky-900 text-white border-sky-900 shadow-lg shadow-sky-900/20 z-10':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Add</button>
                        <button onClick={() => setActiveTab('Requests')} className={`flex-1 px-4 py-3 text-sm font-bold border-y border-l transition-all whitespace-nowrap ${activeTab==='Requests'?'bg-sky-900 text-white border-sky-900 shadow-lg shadow-sky-900/20 z-10':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Request</button>
                        <button onClick={() => setActiveTab('Report')} className={`flex-1 px-4 py-3 text-sm font-bold border-y border-l transition-all whitespace-nowrap ${activeTab==='Report'?'bg-sky-900 text-white border-sky-900 shadow-lg shadow-sky-900/20 z-10':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Report</button>
                        <button onClick={() => setActiveTab('Insights')} className={`flex-1 px-4 py-3 text-sm font-bold rounded-r-2xl border border-l transition-all whitespace-nowrap ${activeTab==='Insights'?'bg-sky-900 text-white border-sky-900 shadow-lg shadow-sky-900/20':'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Insights</button>
                    </div>
                </nav>

                <main className="max-w-4xl mx-auto pb-20">
                    {activeTab === 'Add Record' && <AddRecordForm onSave={saveRecord} onBatchSave={handleBatchSave} isSaving={isSaving} newRecord={newRecord} onInputChange={handleInputChange} onFileChange={handleFileChange} fileInputRef={fileInputRef} isEditing={!!editingId} onCancelEdit={handleCancelEdit} />}
                    {activeTab === 'View Records' && <div className="space-y-12">{Object.keys(grouped).length>0 ? Object.keys(grouped).map(area => (
                        <section key={area} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-sky-100/50 border border-sky-50">
                            <h2 className="text-3xl font-bold text-sky-900 mb-8 flex items-center"><div className="bg-sky-100 p-2.5 rounded-2xl mr-4"><Home size={24} className="text-sky-600"/></div> {area}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{grouped[area].map(r => <RecordCard key={r.id} record={r} onDeleteClick={setConfirmDelete} onEditClick={handleEditClick} />)}</div>
                        </section>
                    )) : <div className="text-center p-16 bg-white rounded-[2.5rem] shadow-xl border border-dashed border-slate-200"><FileText size={64} className="mx-auto text-slate-300 mb-6"/><p className="text-slate-500 font-medium text-xl">Your log is empty.</p><p className="text-slate-400 mt-2">Click "Add" to start building your pedigree.</p></div>}</div>}
                    {activeTab === 'Maintenance' && <MaintenanceDashboard records={records} onCompleteTask={handleCompleteTask} onAddStandardTask={handleAddStandardTask} />}
                    {activeTab === 'Report' && <PedigreeReport propertyProfile={propertyProfile} records={records} />}
                    {activeTab === 'Insights' && <EnvironmentalInsights propertyProfile={propertyProfile} />}
                    {/* NEW Requests Tab */}
                    {activeTab === 'Requests' && <RequestManager userId={userId} propertyName={propertyProfile.name} />}
                </main>
                
                {/* Modals */}
                {showOnboarding && <WelcomeModal onClose={() => setShowOnboarding(false)} />}
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
