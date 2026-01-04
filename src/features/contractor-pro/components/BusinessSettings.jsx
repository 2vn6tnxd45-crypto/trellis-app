// src/features/contractor-pro/components/BusinessSettings.jsx
// ============================================
// BUSINESS SETTINGS - Team, Hours & Scheduling Preferences
// ============================================
// Collects information to power AI scheduling suggestions

import React, { useState, useEffect, useRef } from 'react';
import { 
    Users, Truck, Clock, MapPin, Calendar, Sparkles,
    ChevronDown, ChevronUp, Save, Info, Building2,
    Plus, Trash2, Check, FileText
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';
import toast from 'react-hot-toast';
import { googleMapsApiKey } from '../../../config/constants';

// Default working hours
const DEFAULT_HOURS = {
    monday: { enabled: true, start: '08:00', end: '17:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '14:00' },
    sunday: { enabled: false, start: '09:00', end: '14:00' }
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Time options for dropdowns
const TIME_OPTIONS = [];
for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
        const hour = h.toString().padStart(2, '0');
        const min = m.toString().padStart(2, '0');
        const label = `${h > 12 ? h - 12 : h}:${min} ${h >= 12 ? 'PM' : 'AM'}`;
        TIME_OPTIONS.push({ value: `${hour}:${min}`, label });
    }
}

// Section wrapper with collapse
const SettingsSection = ({ title, icon: Icon, children, defaultOpen = true, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-xl">
                        <Icon size={20} className="text-slate-600" />
                    </div>
                    <span className="font-bold text-slate-800">{title}</span>
                    {badge && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            {badge}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
            </button>
            {isOpen && (
                <div className="p-4 pt-0 border-t border-slate-100">
                    {children}
                </div>
            )}
        </div>
    );
};

// AI Insight banner
const AIInsightBanner = ({ completionPercent }) => (
    <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-white mb-6">
        <div className="flex items-start gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
                <Sparkles size={20} />
            </div>
            <div className="flex-1">
                <h3 className="font-bold">AI Scheduling Assistant</h3>
                <p className="text-sm text-white/80 mt-1">
                    The more details you provide, the smarter our scheduling suggestions become.
                </p>
                <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                        <span>Profile completeness</span>
                        <span className="font-bold">{completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{ width: `${completionPercent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export const BusinessSettings = ({ contractorId, profile, onUpdate }) => {
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        // Team
        teamType: profile?.scheduling?.teamType || 'solo',
        teamSize: profile?.scheduling?.teamSize || 1,
        vehicles: profile?.scheduling?.vehicles || 1,
        
        // Working hours
        workingHours: profile?.scheduling?.workingHours || DEFAULT_HOURS,
        
        // Scheduling preferences
        bufferMinutes: profile?.scheduling?.bufferMinutes || 30,
        defaultJobDuration: profile?.scheduling?.defaultJobDuration || 120,
        serviceRadiusMiles: profile?.scheduling?.serviceRadiusMiles || 25,
        maxJobsPerDay: profile?.scheduling?.maxJobsPerDay || 4,

        // Quote Defaults (New)
        defaultLaborWarranty: profile?.scheduling?.defaultLaborWarranty || '',
        defaultTaxRate: profile?.scheduling?.defaultTaxRate !== undefined ? profile?.scheduling?.defaultTaxRate : 8.75,
        defaultDepositType: profile?.scheduling?.defaultDepositType || 'percentage',
        defaultDepositValue: profile?.scheduling?.defaultDepositValue !== undefined ? profile?.scheduling?.defaultDepositValue : 15,
        
        // Home base
        homeBase: profile?.scheduling?.homeBase || {
            address: profile?.profile?.address || '',
            // coordinates would be added via geocoding
        },
        
        // Team members (if not solo)
        teamMembers: profile?.scheduling?.teamMembers || []
    });

    // Refs for Google Maps Autocomplete
    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    // Initialize Autocomplete for Home Base
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
            if (!addressInputRef.current || autocompleteRef.current) return;
            try {
                autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                    types: ['geocode', 'establishment'],
                    componentRestrictions: { country: 'us' },
                });
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current.getPlace();
                    if (place.formatted_address && place.geometry?.location) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();
                        
                        setSettings(s => ({ 
                            ...s, 
                            homeBase: { 
                                address: place.formatted_address,
                                coordinates: { lat, lng } // Save exact coordinates
                            }
                        }));
                    }
                });
            } catch (err) {
                console.error('Autocomplete init error:', err);
            }
        };

        loadGoogleMaps();
    }, []);

    // Calculate profile completeness
    const calculateCompleteness = () => {
        let score = 0;
        let total = 8; // Increased total to account for quote defaults
        
        if (settings.teamType) score++;
        if (settings.teamSize > 0) score++;
        if (settings.vehicles > 0) score++;
        if (settings.homeBase?.address) score++;
        if (settings.serviceRadiusMiles > 0) score++;
        if (Object.values(settings.workingHours).some(d => d.enabled)) score++;
        if (settings.bufferMinutes >= 0) score++;
        if (settings.defaultLaborWarranty || settings.defaultTaxRate) score++; // Bonus for quote defaults
        
        return Math.round((score / total) * 100);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';
            const contractorRef = doc(db, COLLECTION, contractorId);
            
            await updateDoc(contractorRef, {
                'scheduling': settings,
                'updatedAt': serverTimestamp()
            });
            
            toast.success('Settings saved!');
            if (onUpdate) onUpdate(settings);
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const updateWorkingHours = (day, field, value) => {
        setSettings(prev => ({
            ...prev,
            workingHours: {
                ...prev.workingHours,
                [day]: {
                    ...prev.workingHours[day],
                    [field]: value
                }
            }
        }));
    };

    const addTeamMember = () => {
        setSettings(prev => ({
            ...prev,
            teamMembers: [
                ...prev.teamMembers,
                {
                    id: `member_${Date.now()}`,
                    name: '',
                    role: 'technician',
                    color: `#${Math.floor(Math.random()*16777215).toString(16)}`
                }
            ]
        }));
    };

    const updateTeamMember = (id, field, value) => {
        setSettings(prev => ({
            ...prev,
            teamMembers: prev.teamMembers.map(m => 
                m.id === id ? { ...m, [field]: value } : m
            )
        }));
    };

    const removeTeamMember = (id) => {
        setSettings(prev => ({
            ...prev,
            teamMembers: prev.teamMembers.filter(m => m.id !== id)
        }));
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Business Settings</h1>
                <p className="text-slate-500">Configure your team and scheduling preferences</p>
            </div>

            <AIInsightBanner completionPercent={calculateCompleteness()} />

            {/* Team Size */}
            <SettingsSection title="Team & Resources" icon={Users}>
                <div className="space-y-4 pt-4">
                    {/* Solo vs Team */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Operation Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSettings(s => ({ ...s, teamType: 'solo', teamSize: 1 }))}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    settings.teamType === 'solo'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Users size={18} className={settings.teamType === 'solo' ? 'text-emerald-600' : 'text-slate-400'} />
                                    <span className="font-bold text-slate-800">Solo</span>
                                </div>
                                <p className="text-xs text-slate-500">Just me</p>
                            </button>
                            <button
                                onClick={() => setSettings(s => ({ ...s, teamType: 'team' }))}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    settings.teamType === 'team'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Users size={18} className={settings.teamType === 'team' ? 'text-emerald-600' : 'text-slate-400'} />
                                    <span className="font-bold text-slate-800">Team</span>
                                </div>
                                <p className="text-xs text-slate-500">Multiple technicians</p>
                            </button>
                        </div>
                    </div>

                    {/* Team size & vehicles */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {settings.teamType === 'solo' ? 'Technicians' : 'Team Size'}
                            </label>
                            <select
                                value={settings.teamSize}
                                onChange={(e) => setSettings(s => ({ ...s, teamSize: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {[1,2,3,4,5,6,7,8,9,10,15,20,25,30].map(n => (
                                    <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Service Vehicles
                            </label>
                            <select
                                value={settings.vehicles}
                                onChange={(e) => setSettings(s => ({ ...s, vehicles: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                    <option key={n} value={n}>{n} {n === 1 ? 'vehicle' : 'vehicles'}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Team members list (if team) */}
                    {settings.teamType === 'team' && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-700">
                                    Team Members <span className="font-normal text-slate-400">(optional)</span>
                                </label>
                                <button
                                    onClick={addTeamMember}
                                    className="text-xs text-emerald-600 font-bold hover:text-emerald-700 flex items-center gap-1"
                                >
                                    <Plus size={14} /> Add Member
                                </button>
                            </div>
                            <div className="space-y-2">
                                {settings.teamMembers.map(member => (
                                    <div key={member.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                                        <div 
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: member.color }}
                                        />
                                        <input
                                            type="text"
                                            value={member.name}
                                            onChange={(e) => updateTeamMember(member.id, 'name', e.target.value)}
                                            placeholder="Name"
                                            className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded-lg"
                                        />
                                        <select
                                            value={member.role}
                                            onChange={(e) => updateTeamMember(member.id, 'role', e.target.value)}
                                            className="px-2 py-1 text-sm border border-slate-200 rounded-lg"
                                        >
                                            <option value="technician">Technician</option>
                                            <option value="lead">Lead Tech</option>
                                            <option value="apprentice">Apprentice</option>
                                        </select>
                                        <button
                                            onClick={() => removeTeamMember(member.id)}
                                            className="p-1 text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {settings.teamMembers.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center py-2">
                                        No team members added yet
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Info tip */}
                    <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-xl">
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            Team size and vehicles help us suggest optimal scheduling. 
                            With 2 vehicles, we can suggest parallel jobs in different areas.
                        </p>
                    </div>
                </div>
            </SettingsSection>

            {/* Working Hours */}
            <SettingsSection title="Working Hours" icon={Clock}>
                <div className="space-y-3 pt-4">
                    {DAYS.map((day, idx) => (
                        <div key={day} className="flex items-center gap-3">
                            <button
                                onClick={() => updateWorkingHours(day, 'enabled', !settings.workingHours[day]?.enabled)}
                                className={`w-12 text-xs font-bold py-1.5 rounded-lg transition-colors ${
                                    settings.workingHours[day]?.enabled
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {DAY_LABELS[idx]}
                            </button>
                            
                            {settings.workingHours[day]?.enabled ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <select
                                        value={settings.workingHours[day]?.start || '08:00'}
                                        onChange={(e) => updateWorkingHours(day, 'start', e.target.value)}
                                        className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                    >
                                        {TIME_OPTIONS.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                    <span className="text-slate-400">to</span>
                                    <select
                                        value={settings.workingHours[day]?.end || '17:00'}
                                        onChange={(e) => updateWorkingHours(day, 'end', e.target.value)}
                                        className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                                    >
                                        {TIME_OPTIONS.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400">Closed</span>
                            )}
                        </div>
                    ))}
                </div>
            </SettingsSection>

            {/* Scheduling Preferences */}
            <SettingsSection title="Scheduling Preferences" icon={Calendar}>
                <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Buffer Between Jobs
                            </label>
                            <select
                                value={settings.bufferMinutes}
                                onChange={(e) => setSettings(s => ({ ...s, bufferMinutes: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value={0}>No buffer</option>
                                <option value={15}>15 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={45}>45 minutes</option>
                                <option value={60}>1 hour</option>
                                <option value={90}>1.5 hours</option>
                            </select>
                            <p className="text-xs text-slate-400 mt-1">Travel/prep time between jobs</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Default Job Duration
                            </label>
                            <select
                                value={settings.defaultJobDuration}
                                onChange={(e) => setSettings(s => ({ ...s, defaultJobDuration: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value={30}>30 minutes</option>
                                <option value={60}>1 hour</option>
                                <option value={90}>1.5 hours</option>
                                <option value={120}>2 hours</option>
                                <option value={180}>3 hours</option>
                                <option value={240}>4 hours</option>
                                <option value={480}>Full day</option>
                            </select>
                            <p className="text-xs text-slate-400 mt-1">For jobs without estimates</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Service Radius
                            </label>
                            <select
                                value={settings.serviceRadiusMiles}
                                onChange={(e) => setSettings(s => ({ ...s, serviceRadiusMiles: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value={10}>10 miles</option>
                                <option value={15}>15 miles</option>
                                <option value={25}>25 miles</option>
                                <option value={50}>50 miles</option>
                                <option value={75}>75 miles</option>
                                <option value={100}>100+ miles</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Max Jobs Per Day
                            </label>
                            <select
                                value={settings.maxJobsPerDay}
                                onChange={(e) => setSettings(s => ({ ...s, maxJobsPerDay: parseInt(e.target.value) }))}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {[1,2,3,4,5,6,7,8,10,12,15,20].map(n => (
                                    <option key={n} value={n}>{n} jobs</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </SettingsSection>

            {/* Quote Defaults */}
            <SettingsSection title="Quote Defaults" icon={FileText}>
                <div className="space-y-4 pt-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Default Labor Warranty
                        </label>
                        <input
                            type="text"
                            value={settings.defaultLaborWarranty || ''}
                            onChange={(e) => setSettings(s => ({ 
                                ...s, 
                                defaultLaborWarranty: e.target.value 
                            }))}
                            placeholder="e.g., 1 Year Labor Warranty on all work"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Auto-filled on new quotes
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Default Tax Rate (%)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={settings.defaultTaxRate}
                            onChange={(e) => setSettings(s => ({ 
                                ...s, 
                                defaultTaxRate: parseFloat(e.target.value) 
                            }))}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Default Deposit Requirement
                        </label>
                        <div className="flex items-center gap-3">
                            <select
                                value={settings.defaultDepositType || 'percentage'}
                                onChange={(e) => setSettings(s => ({ 
                                    ...s, 
                                    defaultDepositType: e.target.value 
                                }))}
                                className="px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed Amount</option>
                            </select>
                            <input
                                type="number"
                                value={settings.defaultDepositValue}
                                onChange={(e) => setSettings(s => ({ 
                                    ...s, 
                                    defaultDepositValue: parseFloat(e.target.value) 
                                }))}
                                className="w-32 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <span className="text-slate-500">
                                {settings.defaultDepositType === 'percentage' ? '%' : '$'}
                            </span>
                        </div>
                    </div>
                </div>
            </SettingsSection>

            {/* Home Base */}
            <SettingsSection title="Home Base Location" icon={MapPin}>
                <div className="space-y-4 pt-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Starting Location
                        </label>
                        <input
                            ref={addressInputRef}
                            type="text"
                            value={settings.homeBase?.address || ''}
                            onChange={(e) => setSettings(s => ({ 
                                ...s, 
                                homeBase: { ...s.homeBase, address: e.target.value }
                            }))}
                            placeholder="e.g., 123 Business Ave, La Mirada, CA"
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Where your day typically starts. Used for route optimization.
                        </p>
                    </div>
                </div>
            </SettingsSection>

            {/* Save Button */}
            <div className="sticky bottom-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default BusinessSettings;
