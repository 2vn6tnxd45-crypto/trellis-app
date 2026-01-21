// src/components/CustomerPreferencesEditor.jsx
// ============================================
// CUSTOMER COMMUNICATION PREFERENCES EDITOR
// ============================================
// Allows viewing and editing customer contact preferences
// Can be used in job detail, customer profile, or standalone modal

import React, { useState, useEffect } from 'react';
import {
    MessageSquare,
    Mail,
    Phone,
    Bell,
    BellOff,
    Clock,
    Check,
    X,
    Loader2,
    ChevronDown,
    ChevronUp,
    Settings,
    Globe
} from 'lucide-react';
import {
    getCustomerPreferences,
    saveCustomerPreferences,
    CONTACT_METHODS,
    NOTIFICATION_TYPES,
    CONTACT_METHOD_LABELS,
    NOTIFICATION_TYPE_LABELS,
    DEFAULT_PREFERENCES
} from '../lib/customerPreferencesService';

// ============================================
// CONTACT METHOD ICON MAP
// ============================================
const CONTACT_ICONS = {
    [CONTACT_METHODS.SMS]: MessageSquare,
    [CONTACT_METHODS.EMAIL]: Mail,
    [CONTACT_METHODS.PHONE_CALL]: Phone,
    [CONTACT_METHODS.ANY]: Globe
};

// ============================================
// MAIN COMPONENT
// ============================================

export const CustomerPreferencesEditor = ({
    contractorId,
    customer, // { name, phone, email }
    onSave,
    onClose,
    compact = false // Compact mode for inline display
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [expanded, setExpanded] = useState(!compact);
    const [hasChanges, setHasChanges] = useState(false);

    // ----------------------------------------
    // Load preferences
    // ----------------------------------------
    useEffect(() => {
        const loadPreferences = async () => {
            if (!contractorId || !customer) return;

            setLoading(true);
            try {
                const prefs = await getCustomerPreferences(contractorId, customer);
                setPreferences(prefs);
            } catch (error) {
                console.error('Error loading preferences:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPreferences();
    }, [contractorId, customer?.phone, customer?.email]);

    // ----------------------------------------
    // Update a preference
    // ----------------------------------------
    const updatePreference = (key, value) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const updateNotification = (type, enabled) => {
        setPreferences(prev => ({
            ...prev,
            notifications: { ...prev.notifications, [type]: enabled }
        }));
        setHasChanges(true);
    };

    const updateQuietHours = (key, value) => {
        setPreferences(prev => ({
            ...prev,
            quietHours: { ...prev.quietHours, [key]: value }
        }));
        setHasChanges(true);
    };

    // ----------------------------------------
    // Save preferences
    // ----------------------------------------
    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await saveCustomerPreferences(contractorId, customer, preferences);
            if (result.success) {
                setHasChanges(false);
                onSave?.(preferences);
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------
    // Loading state
    // ----------------------------------------
    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    // ----------------------------------------
    // Compact summary view
    // ----------------------------------------
    if (compact && !expanded) {
        const PreferredIcon = CONTACT_ICONS[preferences.preferredContact] || Globe;
        const enabledNotifs = Object.values(preferences.notifications).filter(Boolean).length;
        const totalNotifs = Object.keys(preferences.notifications).length;

        return (
            <button
                onClick={() => setExpanded(true)}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                            <Settings size={16} className="text-slate-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-700">
                                Communication Preferences
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <PreferredIcon size={12} />
                                <span>{CONTACT_METHOD_LABELS[preferences.preferredContact]}</span>
                                <span>•</span>
                                <span>{enabledNotifs}/{totalNotifs} notifications</span>
                            </div>
                        </div>
                    </div>
                    <ChevronDown size={16} className="text-slate-400" />
                </div>
            </button>
        );
    }

    // ----------------------------------------
    // Full editor view
    // ----------------------------------------
    return (
        <div className={`${compact ? 'bg-white rounded-xl border border-slate-200 p-4' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Settings size={18} className="text-slate-500" />
                    <h3 className="font-semibold text-slate-800">
                        Communication Preferences
                    </h3>
                </div>
                {compact && (
                    <button
                        onClick={() => setExpanded(false)}
                        className="p-1 hover:bg-slate-100 rounded"
                    >
                        <ChevronUp size={16} className="text-slate-400" />
                    </button>
                )}
            </div>

            {/* Customer Info */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="font-medium text-slate-700">{customer?.name}</p>
                <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1">
                    {customer?.phone && (
                        <span className="flex items-center gap-1">
                            <Phone size={12} />
                            {customer.phone}
                        </span>
                    )}
                    {customer?.email && (
                        <span className="flex items-center gap-1">
                            <Mail size={12} />
                            {customer.email}
                        </span>
                    )}
                </div>
            </div>

            {/* Preferred Contact Method */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Preferred Contact Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CONTACT_METHODS).map(([key, value]) => {
                        const Icon = CONTACT_ICONS[value];
                        const isSelected = preferences.preferredContact === value;
                        const isDisabled =
                            (value === CONTACT_METHODS.SMS && !customer?.phone) ||
                            (value === CONTACT_METHODS.EMAIL && !customer?.email) ||
                            (value === CONTACT_METHODS.PHONE_CALL && !customer?.phone);

                        return (
                            <button
                                key={key}
                                onClick={() => !isDisabled && updatePreference('preferredContact', value)}
                                disabled={isDisabled}
                                className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                                    isSelected
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : isDisabled
                                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                }`}
                            >
                                <Icon size={16} />
                                <span className="text-sm font-medium">
                                    {CONTACT_METHOD_LABELS[value]}
                                </span>
                                {isSelected && (
                                    <Check size={14} className="ml-auto text-indigo-600" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* SMS/Email Opt-In */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Channels
                </label>
                <div className="space-y-2">
                    <ToggleRow
                        icon={MessageSquare}
                        label="Text Messages (SMS)"
                        description="Receive appointment reminders and updates via text"
                        enabled={preferences.smsOptIn}
                        onChange={(v) => updatePreference('smsOptIn', v)}
                        disabled={!customer?.phone}
                    />
                    <ToggleRow
                        icon={Mail}
                        label="Email"
                        description="Receive confirmations and invoices via email"
                        enabled={preferences.emailOptIn}
                        onChange={(v) => updatePreference('emailOptIn', v)}
                        disabled={!customer?.email}
                    />
                </div>
            </div>

            {/* Notification Types */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notification Preferences
                </label>
                <div className="space-y-2">
                    {Object.entries(NOTIFICATION_TYPES).map(([key, value]) => (
                        <ToggleRow
                            key={key}
                            icon={preferences.notifications[value] ? Bell : BellOff}
                            label={NOTIFICATION_TYPE_LABELS[value]}
                            enabled={preferences.notifications[value]}
                            onChange={(v) => updateNotification(value, v)}
                            compact
                        />
                    ))}
                </div>
            </div>

            {/* Quiet Hours */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock size={14} />
                        Quiet Hours
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={preferences.quietHours?.enabled}
                            onChange={(e) => updateQuietHours('enabled', e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
                {preferences.quietHours?.enabled && (
                    <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
                        <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Start</label>
                            <input
                                type="time"
                                value={preferences.quietHours.start}
                                onChange={(e) => updateQuietHours('start', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                            />
                        </div>
                        <span className="text-slate-400 mt-4">to</span>
                        <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">End</label>
                            <input
                                type="time"
                                value={preferences.quietHours.end}
                                onChange={(e) => updateQuietHours('end', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
                            />
                        </div>
                    </div>
                )}
                <p className="text-xs text-slate-400 mt-1">
                    No notifications will be sent during quiet hours
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Check size={14} />
                            Save Preferences
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// ============================================
// TOGGLE ROW COMPONENT
// ============================================

const ToggleRow = ({ icon: Icon, label, description, enabled, onChange, disabled, compact }) => (
    <div className={`flex items-center justify-between p-3 rounded-lg ${
        disabled ? 'bg-slate-50 opacity-50' : 'bg-slate-50 hover:bg-slate-100'
    } transition-colors`}>
        <div className="flex items-center gap-3">
            <Icon size={16} className={enabled ? 'text-indigo-600' : 'text-slate-400'} />
            <div>
                <p className={`font-medium ${compact ? 'text-sm' : ''} text-slate-700`}>{label}</p>
                {description && !compact && (
                    <p className="text-xs text-slate-500">{description}</p>
                )}
            </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => !disabled && onChange(e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </label>
    </div>
);

// ============================================
// MODAL WRAPPER
// ============================================

export const CustomerPreferencesModal = ({
    isOpen,
    onClose,
    contractorId,
    customer,
    onSave
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
                <CustomerPreferencesEditor
                    contractorId={contractorId}
                    customer={customer}
                    onSave={(prefs) => {
                        onSave?.(prefs);
                        onClose();
                    }}
                    onClose={onClose}
                />
            </div>
        </div>
    );
};

export default CustomerPreferencesEditor;
