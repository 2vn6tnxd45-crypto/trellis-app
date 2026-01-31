// src/features/dashboard/components/EmergencyQuickAccess.jsx
// ============================================
// EMERGENCY QUICK ACCESS COMPONENT
// ============================================
// Gives homeowners instant access to critical emergency info:
// - One-tap call buttons for emergency contractors
// - Shutoff locations (water, gas, electrical)
// - Insurance information
// - Custom emergency contacts and notes

import React, { useState, useEffect, useCallback } from 'react';
import {
    Phone, Droplets, Flame, Zap, Shield, AlertTriangle,
    MapPin, Plus, X, Edit2, Save, ChevronRight, FileText,
    Loader2, PhoneCall, Building2
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { appId } from '../../../config/constants';
import toast from 'react-hot-toast';

// ============================================
// CONSTANTS
// ============================================

const EMERGENCY_TRADES = {
    plumbing: { icon: Droplets, label: 'Plumber', color: 'blue' },
    plumber: { icon: Droplets, label: 'Plumber', color: 'blue' },
    electrical: { icon: Zap, label: 'Electrician', color: 'yellow' },
    electrician: { icon: Zap, label: 'Electrician', color: 'yellow' },
    hvac: { icon: Flame, label: 'HVAC', color: 'red' },
    'hvac & systems': { icon: Flame, label: 'HVAC', color: 'red' },
    heating: { icon: Flame, label: 'HVAC', color: 'red' },
    cooling: { icon: Flame, label: 'HVAC', color: 'red' },
    handyman: { icon: Building2, label: 'Handyman', color: 'slate' },
    general: { icon: Building2, label: 'General', color: 'slate' },
    roofing: { icon: Building2, label: 'Roofer', color: 'amber' },
    roofer: { icon: Building2, label: 'Roofer', color: 'amber' },
};

const DEFAULT_EMERGENCY_DATA = {
    waterShutoff: '',
    gasShutoff: '',
    electricalPanel: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insurancePhone: '',
    insuranceAgentName: '',
    insuranceAgentPhone: '',
    emergencyContacts: [],
    emergencyNotes: '',
};

// ============================================
// HELPERS
// ============================================

/**
 * Filter contractors to those with emergency-relevant trades and phone numbers
 */
const getEmergencyContractors = (contractors) => {
    if (!contractors || !Array.isArray(contractors)) return [];

    return contractors.filter(c => {
        // Must have a valid phone number
        if (!c.phone || c.phone.length < 5) return false;

        const trade = (c.trade || c.specialty || '').toLowerCase();
        if (EMERGENCY_TRADES[trade]) return true;

        // Check job categories
        const categories = c.jobs?.map(j => (j.category || '').toLowerCase()) || [];
        return categories.some(cat =>
            Object.keys(EMERGENCY_TRADES).some(key => cat.includes(key))
        );
    }).map(c => {
        const trade = (c.trade || c.specialty || '').toLowerCase();
        const matchedTrade = EMERGENCY_TRADES[trade] ||
            Object.entries(EMERGENCY_TRADES).find(([key]) =>
                c.jobs?.some(j => (j.category || '').toLowerCase().includes(key))
            )?.[1] ||
            { icon: Phone, label: 'Pro', color: 'slate' };

        return { ...c, emergencyInfo: matchedTrade };
    });
};

/**
 * Format phone number for display
 */
const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
};

/**
 * Get color classes for shutoff cards
 */
const getShutoffColors = (type) => {
    switch (type) {
        case 'water':
            return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', hover: 'hover:border-blue-300' };
        case 'gas':
            return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', hover: 'hover:border-amber-300' };
        case 'electrical':
            return { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', hover: 'hover:border-yellow-300' };
        default:
            return { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'text-slate-600', hover: 'hover:border-slate-300' };
    }
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * One-tap call button for emergency contacts
 */
const CallButton = ({ icon: Icon, label, phone, variant = 'default', contractorName }) => {
    const isEmergency = variant === 'emergency';

    return (
        <a
            href={`tel:${phone}`}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-full transition-all min-h-[44px] ${
                isEmergency
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                    : 'bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md text-slate-700'
            }`}
        >
            <Icon size={18} className={isEmergency ? 'text-white' : ''} />
            <span className="font-semibold text-sm whitespace-nowrap">
                {contractorName || label}
            </span>
        </a>
    );
};

/**
 * Shutoff location card
 */
const ShutoffCard = ({ type, icon: Icon, label, value, editing, onChange }) => {
    const colors = getShutoffColors(type);

    return (
        <div className={`p-4 rounded-xl border ${colors.bg} ${colors.border} ${colors.hover} transition-all`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon size={18} className={colors.icon} />
                <span className="font-semibold text-slate-700 text-sm">{label}</span>
            </div>
            {editing ? (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="e.g., Front yard near sidewalk"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
            ) : (
                <p className={`text-sm ${value ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                    {value || 'Tap edit to add location'}
                </p>
            )}
        </div>
    );
};

/**
 * Custom emergency contact row
 */
const EmergencyContactRow = ({ contact, editing, onUpdate, onDelete }) => {
    if (editing) {
        return (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <input
                    type="text"
                    value={contact.name || ''}
                    onChange={(e) => onUpdate({ ...contact, name: e.target.value })}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                    type="tel"
                    value={contact.phone || ''}
                    onChange={(e) => onUpdate({ ...contact, phone: e.target.value })}
                    placeholder="Phone"
                    className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                    type="text"
                    value={contact.label || ''}
                    onChange={(e) => onUpdate({ ...contact, label: e.target.value })}
                    placeholder="Label"
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                    onClick={onDelete}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <Phone size={16} className="text-slate-500" />
                </div>
                <div>
                    <p className="font-medium text-slate-700 text-sm">{contact.name}</p>
                    {contact.label && (
                        <p className="text-xs text-slate-500">{contact.label}</p>
                    )}
                </div>
            </div>
            <a
                href={`tel:${contact.phone}`}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
                {formatPhone(contact.phone)}
            </a>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const EmergencyQuickAccess = ({ userId, contractors = [], activeProperty }) => {
    // State
    const [emergencyData, setEmergencyData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ ...DEFAULT_EMERGENCY_DATA });
    const [saving, setSaving] = useState(false);

    // Derived data
    const emergencyContractors = getEmergencyContractors(contractors);

    // Load emergency data from Firestore
    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const loadEmergencyData = async () => {
            try {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/emergencyInfo`, 'data');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setEmergencyData(data);
                    setEditForm(data);
                } else {
                    setEmergencyData(null);
                    setEditForm({ ...DEFAULT_EMERGENCY_DATA });
                }
            } catch (error) {
                console.error('[EmergencyQuickAccess] Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadEmergencyData();
    }, [userId]);

    // Handle save
    const handleSave = useCallback(async () => {
        if (!userId) return;

        setSaving(true);
        try {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/emergencyInfo`, 'data');
            await setDoc(docRef, {
                ...editForm,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setEmergencyData(editForm);
            setEditing(false);
            toast.success('Emergency info saved');
        } catch (error) {
            console.error('[EmergencyQuickAccess] Error saving:', error);
            toast.error('Failed to save — try again');
        } finally {
            setSaving(false);
        }
    }, [userId, editForm]);

    // Handle cancel
    const handleCancel = useCallback(() => {
        setEditForm(emergencyData || { ...DEFAULT_EMERGENCY_DATA });
        setEditing(false);
    }, [emergencyData]);

    // Update form field
    const updateField = useCallback((field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    }, []);

    // Add emergency contact
    const addEmergencyContact = useCallback(() => {
        if (editForm.emergencyContacts.length >= 5) {
            toast.error('Maximum 5 custom contacts allowed');
            return;
        }
        setEditForm(prev => ({
            ...prev,
            emergencyContacts: [
                ...prev.emergencyContacts,
                { id: `ec_${Date.now()}`, name: '', phone: '', label: '' }
            ]
        }));
    }, [editForm.emergencyContacts.length]);

    // Update emergency contact
    const updateEmergencyContact = useCallback((index, updatedContact) => {
        setEditForm(prev => ({
            ...prev,
            emergencyContacts: prev.emergencyContacts.map((c, i) =>
                i === index ? updatedContact : c
            )
        }));
    }, []);

    // Delete emergency contact
    const deleteEmergencyContact = useCallback((index) => {
        setEditForm(prev => ({
            ...prev,
            emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index)
        }));
    }, []);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
        );
    }

    const displayData = editing ? editForm : (emergencyData || DEFAULT_EMERGENCY_DATA);
    const hasData = emergencyData && (
        emergencyData.waterShutoff ||
        emergencyData.gasShutoff ||
        emergencyData.electricalPanel ||
        emergencyData.insuranceCompany ||
        emergencyData.emergencyContacts?.length > 0
    );

    return (
        <div className="space-y-6">
            {/* Header with Edit button */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Quick access to critical info during emergencies
                </p>
                {!editing ? (
                    <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                        <Edit2 size={14} />
                        Edit
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                        </button>
                    </div>
                )}
            </div>

            {/* ONE-TAP CALL BUTTONS */}
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <PhoneCall size={16} className="text-emerald-600" />
                    One-Tap Call
                </h4>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                    {/* 911 Emergency - Always first */}
                    <CallButton
                        icon={AlertTriangle}
                        label="911"
                        phone="911"
                        variant="emergency"
                    />

                    {/* Emergency contractors */}
                    {emergencyContractors.map((contractor) => {
                        const Icon = contractor.emergencyInfo?.icon || Phone;
                        return (
                            <CallButton
                                key={contractor.id || contractor.phone}
                                icon={Icon}
                                label={contractor.emergencyInfo?.label || 'Pro'}
                                phone={contractor.phone}
                                contractorName={contractor.companyName || contractor.name}
                            />
                        );
                    })}

                    {/* Show prompt if no contractors */}
                    {emergencyContractors.length === 0 && (
                        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-full bg-slate-50 border border-dashed border-slate-300 text-slate-500">
                            <Plus size={16} />
                            <span className="text-sm">Add contractors with phone numbers</span>
                        </div>
                    )}
                </div>
            </div>

            {/* SHUTOFF LOCATIONS */}
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-600" />
                    Shutoff Locations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ShutoffCard
                        type="water"
                        icon={Droplets}
                        label="Water Shutoff"
                        value={displayData.waterShutoff}
                        editing={editing}
                        onChange={(v) => updateField('waterShutoff', v)}
                    />
                    <ShutoffCard
                        type="gas"
                        icon={Flame}
                        label="Gas Shutoff"
                        value={displayData.gasShutoff}
                        editing={editing}
                        onChange={(v) => updateField('gasShutoff', v)}
                    />
                    <ShutoffCard
                        type="electrical"
                        icon={Zap}
                        label="Electrical Panel"
                        value={displayData.electricalPanel}
                        editing={editing}
                        onChange={(v) => updateField('electricalPanel', v)}
                    />
                </div>
            </div>

            {/* INSURANCE INFO */}
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-emerald-600" />
                    Insurance
                </h4>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                    {editing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Company</label>
                                <input
                                    type="text"
                                    value={displayData.insuranceCompany || ''}
                                    onChange={(e) => updateField('insuranceCompany', e.target.value)}
                                    placeholder="e.g., State Farm"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Policy Number</label>
                                <input
                                    type="text"
                                    value={displayData.insurancePolicyNumber || ''}
                                    onChange={(e) => updateField('insurancePolicyNumber', e.target.value)}
                                    placeholder="Policy #"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Claims Phone</label>
                                <input
                                    type="tel"
                                    value={displayData.insurancePhone || ''}
                                    onChange={(e) => updateField('insurancePhone', e.target.value)}
                                    placeholder="Claims line"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Agent Name</label>
                                <input
                                    type="text"
                                    value={displayData.insuranceAgentName || ''}
                                    onChange={(e) => updateField('insuranceAgentName', e.target.value)}
                                    placeholder="Your agent"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Agent Phone</label>
                                <input
                                    type="tel"
                                    value={displayData.insuranceAgentPhone || ''}
                                    onChange={(e) => updateField('insuranceAgentPhone', e.target.value)}
                                    placeholder="Agent direct line"
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                    ) : displayData.insuranceCompany ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-700">{displayData.insuranceCompany}</p>
                                    {displayData.insurancePolicyNumber && (
                                        <p className="text-sm text-slate-500">Policy: {displayData.insurancePolicyNumber}</p>
                                    )}
                                </div>
                                {displayData.insurancePhone && (
                                    <a
                                        href={`tel:${displayData.insurancePhone}`}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-100 transition-colors"
                                    >
                                        Claims: {formatPhone(displayData.insurancePhone)}
                                    </a>
                                )}
                            </div>
                            {displayData.insuranceAgentName && (
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <p className="text-sm text-slate-600">Agent: {displayData.insuranceAgentName}</p>
                                    {displayData.insuranceAgentPhone && (
                                        <a
                                            href={`tel:${displayData.insuranceAgentPhone}`}
                                            className="text-sm text-emerald-600 font-medium hover:underline"
                                        >
                                            {formatPhone(displayData.insuranceAgentPhone)}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-2">
                            Tap edit to add your insurance info
                        </p>
                    )}
                </div>
            </div>

            {/* CUSTOM EMERGENCY CONTACTS */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Phone size={16} className="text-emerald-600" />
                        Custom Contacts
                    </h4>
                    {editing && displayData.emergencyContacts.length < 5 && (
                        <button
                            onClick={addEmergencyContact}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                            <Plus size={14} />
                            Add
                        </button>
                    )}
                </div>

                {displayData.emergencyContacts.length > 0 ? (
                    <div className="space-y-2">
                        {displayData.emergencyContacts.map((contact, index) => (
                            <EmergencyContactRow
                                key={contact.id || index}
                                contact={contact}
                                editing={editing}
                                onUpdate={(updated) => updateEmergencyContact(index, updated)}
                                onDelete={() => deleteEmergencyContact(index)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                        <p className="text-sm text-slate-400">
                            {editing
                                ? 'Click "Add" to add emergency contacts like neighbors, landlord, etc.'
                                : 'No custom contacts added yet'}
                        </p>
                    </div>
                )}
            </div>

            {/* EMERGENCY NOTES */}
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-600" />
                    Emergency Notes
                </h4>
                {editing ? (
                    <textarea
                        value={displayData.emergencyNotes || ''}
                        onChange={(e) => updateField('emergencyNotes', e.target.value)}
                        placeholder="e.g., Neighbor has spare key: Jane at 123 Oak St. Water valve requires special wrench (in garage toolbox)."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                ) : displayData.emergencyNotes ? (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{displayData.emergencyNotes}</p>
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
                        <p className="text-sm text-slate-400 italic">
                            Tap edit to add notes (spare keys, special tools needed, etc.)
                        </p>
                    </div>
                )}
            </div>

            {/* Setup prompt for empty state */}
            {!hasData && !editing && (
                <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-800 text-sm">Set up your emergency info</p>
                            <p className="text-xs text-amber-700 mt-1">
                                Add shutoff locations, insurance details, and emergency contacts so you can find them quickly when you need them most.
                            </p>
                            <button
                                onClick={() => setEditing(true)}
                                className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmergencyQuickAccess;
