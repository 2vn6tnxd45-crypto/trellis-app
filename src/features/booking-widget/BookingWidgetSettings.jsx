// src/features/booking-widget/BookingWidgetSettings.jsx
// ============================================
// BOOKING WIDGET SETTINGS COMPONENT
// ============================================
// Configuration UI for the embeddable booking widget

import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar, Globe, Settings, Clock, Check, Copy, ExternalLink,
    Eye, Code, Palette, ChevronDown, ChevronRight, Save, Loader2,
    AlertCircle, Zap, List, MapPin, Phone, ToggleLeft, ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getBookingSettings,
    updateBookingSettings,
    DEFAULT_BOOKING_SETTINGS
} from './lib/availabilityService';

export const BookingWidgetSettings = ({ contractorId, profile, serviceTypes = [] }) => {
    const [settings, setSettings] = useState({
        ...DEFAULT_BOOKING_SETTINGS,
        allowedServices: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        general: true,
        services: false,
        requirements: false,
        customization: false,
        embed: true
    });

    // App URL for embed code
    const appUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://mykrib.app';

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            if (!contractorId) return;
            try {
                const loadedSettings = await getBookingSettings(contractorId);
                setSettings(prev => ({
                    ...prev,
                    ...loadedSettings,
                    customization: {
                        ...DEFAULT_BOOKING_SETTINGS.customization,
                        ...loadedSettings.customization
                    }
                }));
            } catch (error) {
                console.error('Error loading booking settings:', error);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, [contractorId]);

    // Save settings
    const handleSave = async () => {
        setSaving(true);
        try {
            await updateBookingSettings(contractorId, settings);
            toast.success('Booking widget settings saved!', { icon: '📅' });
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Update setting
    const updateSetting = (path, value) => {
        setSettings(prev => {
            const newSettings = { ...prev };
            const keys = path.split('.');
            let current = newSettings;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                } else {
                    current[keys[i]] = { ...current[keys[i]] };
                }
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
            return newSettings;
        });
    };

    // Toggle service
    const toggleService = (serviceId) => {
        setSettings(prev => {
            const allowed = prev.allowedServices || [];
            if (allowed.includes(serviceId)) {
                return { ...prev, allowedServices: allowed.filter(id => id !== serviceId) };
            } else {
                return { ...prev, allowedServices: [...allowed, serviceId] };
            }
        });
    };

    // Toggle section
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Generate embed code
    const embedCode = useMemo(() => {
        const servicesParam = settings.allowedServices?.length > 0
            ? `\n  data-services="${settings.allowedServices.join(',')}"`
            : '';

        return `<div id="krib-booking"></div>
<script
  src="${appUrl}/widget/booking.js"
  data-contractor="${contractorId}"
  data-color="${settings.customization?.primaryColor || '#10b981'}"${servicesParam}
></script>`;
    }, [contractorId, settings, appUrl]);

    // Copy embed code
    const copyEmbedCode = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        toast.success('Embed code copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2.5 rounded-xl">
                        <Globe className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Online Booking Widget</h2>
                        <p className="text-sm text-gray-500">Allow customers to book directly from your website</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save Changes
                </button>
            </div>

            {/* Master Enable Toggle */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${settings.enabled ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                            <Zap className={`w-6 h-6 ${settings.enabled ? 'text-emerald-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">Online Booking</h3>
                            <p className="text-sm text-gray-500">
                                {settings.enabled
                                    ? 'Customers can book appointments from your website'
                                    : 'Online booking is currently disabled'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => updateSetting('enabled', !settings.enabled)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            settings.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </div>

            {/* General Settings */}
            <SettingsSection
                title="Booking Rules"
                icon={<Clock className="w-5 h-5 text-blue-600" />}
                expanded={expandedSections.general}
                onToggle={() => toggleSection('general')}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Notice (hours)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="168"
                            value={settings.leadTimeHours}
                            onChange={(e) => updateSetting('leadTimeHours', parseInt(e.target.value) || 24)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">How far in advance customers must book</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Advance Booking (days)
                        </label>
                        <input
                            type="number"
                            min="7"
                            max="90"
                            value={settings.maxAdvanceDays}
                            onChange={(e) => updateSetting('maxAdvanceDays', parseInt(e.target.value) || 30)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">How far ahead customers can book</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Appointment Duration (min)
                        </label>
                        <select
                            value={settings.slotDurationMinutes}
                            onChange={(e) => updateSetting('slotDurationMinutes', parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Buffer Between Appointments (min)
                        </label>
                        <select
                            value={settings.bufferMinutes}
                            onChange={(e) => updateSetting('bufferMinutes', parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                            <option value={0}>No buffer</option>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                        </select>
                    </div>
                </div>
            </SettingsSection>

            {/* Service Types */}
            <SettingsSection
                title="Bookable Services"
                icon={<List className="w-5 h-5 text-purple-600" />}
                expanded={expandedSections.services}
                onToggle={() => toggleSection('services')}
            >
                <p className="text-sm text-gray-500 mb-4">
                    Select which services customers can book online. Leave all unchecked to allow all services.
                </p>
                <div className="space-y-2">
                    {(serviceTypes.length > 0 ? serviceTypes : profile?.serviceTypes || []).map((service) => {
                        const serviceId = service.id || service.value;
                        const isSelected = settings.allowedServices?.includes(serviceId);

                        return (
                            <label
                                key={serviceId}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                    isSelected ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleService(serviceId)}
                                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="font-medium text-gray-800">{service.name || service.label}</span>
                                {service.duration && (
                                    <span className="text-sm text-gray-500 ml-auto">~{service.duration} min</span>
                                )}
                            </label>
                        );
                    })}

                    {(!serviceTypes.length && !profile?.serviceTypes?.length) && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-4">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm">
                                No service types configured. Add services in your business profile to enable online booking.
                            </p>
                        </div>
                    )}
                </div>
            </SettingsSection>

            {/* Customer Requirements */}
            <SettingsSection
                title="Customer Information"
                icon={<MapPin className="w-5 h-5 text-orange-600" />}
                expanded={expandedSections.requirements}
                onToggle={() => toggleSection('requirements')}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="font-medium text-gray-800">Require Phone Number</p>
                                <p className="text-sm text-gray-500">Customer must provide phone to book</p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('requirePhone', !settings.requirePhone)}
                            className={`relative w-12 h-7 rounded-full transition-colors ${
                                settings.requirePhone ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                settings.requirePhone ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-gray-400" />
                            <div>
                                <p className="font-medium text-gray-800">Require Service Address</p>
                                <p className="text-sm text-gray-500">Customer must provide address to book</p>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('requireAddress', !settings.requireAddress)}
                            className={`relative w-12 h-7 rounded-full transition-colors ${
                                settings.requireAddress ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                settings.requireAddress ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                </div>
            </SettingsSection>

            {/* Customization */}
            <SettingsSection
                title="Widget Appearance"
                icon={<Palette className="w-5 h-5 text-pink-600" />}
                expanded={expandedSections.customization}
                onToggle={() => toggleSection('customization')}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Primary Color
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={settings.customization?.primaryColor || '#10b981'}
                                onChange={(e) => updateSetting('customization.primaryColor', e.target.value)}
                                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.customization?.primaryColor || '#10b981'}
                                onChange={(e) => updateSetting('customization.primaryColor', e.target.value)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                pattern="^#[0-9A-Fa-f]{6}$"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Header Text
                        </label>
                        <input
                            type="text"
                            value={settings.customization?.headerText || 'Schedule Service'}
                            onChange={(e) => updateSetting('customization.headerText', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            maxLength={30}
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Button Text
                        </label>
                        <input
                            type="text"
                            value={settings.customization?.buttonText || 'Book Now'}
                            onChange={(e) => updateSetting('customization.buttonText', e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            maxLength={20}
                        />
                    </div>
                </div>

                {/* Color presets */}
                <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Quick Colors</p>
                    <div className="flex gap-2">
                        {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'].map(color => (
                            <button
                                key={color}
                                onClick={() => updateSetting('customization.primaryColor', color)}
                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                                    settings.customization?.primaryColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                                }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            </SettingsSection>

            {/* Embed Code */}
            <SettingsSection
                title="Embed Code"
                icon={<Code className="w-5 h-5 text-gray-600" />}
                expanded={expandedSections.embed}
                onToggle={() => toggleSection('embed')}
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Copy this code and paste it into your website where you want the booking widget to appear.
                    </p>

                    <div className="relative">
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-sm overflow-x-auto">
                            <code>{embedCode}</code>
                        </pre>
                        <button
                            onClick={copyEmbedCode}
                            className={`absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                copied
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                            }`}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                        >
                            <Eye className="w-4 h-4" />
                            {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </button>

                        <a
                            href={`${appUrl}/widget/booking-frame.html?contractor=${contractorId}&color=${encodeURIComponent(settings.customization?.primaryColor || '#10b981')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open in New Tab
                        </a>
                    </div>

                    {showPreview && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <iframe
                                src={`${appUrl}/widget/booking-frame.html?contractor=${contractorId}&color=${encodeURIComponent(settings.customization?.primaryColor || '#10b981')}`}
                                className="w-full h-[600px] border-0"
                                title="Booking Widget Preview"
                            />
                        </div>
                    )}
                </div>
            </SettingsSection>

            {/* Help Text */}
            <div className="bg-blue-50 rounded-xl p-5">
                <h4 className="font-semibold text-blue-800 mb-2">Integration Tips</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• The widget works on any website - WordPress, Wix, Squarespace, or custom sites</li>
                    <li>• Bookings create jobs with "Pending Confirmation" status in your dashboard</li>
                    <li>• You'll receive email notifications for new bookings</li>
                    <li>• Customers receive confirmation emails automatically</li>
                    <li>• The widget automatically respects your working hours from Business Settings</li>
                </ul>
            </div>
        </div>
    );
};

// Settings Section Component
const SettingsSection = ({ title, icon, expanded, onToggle, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100">
                    {icon}
                </div>
                <h3 className="font-semibold text-gray-800">{title}</h3>
            </div>
            {expanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
        </button>
        {expanded && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                {children}
            </div>
        )}
    </div>
);

export default BookingWidgetSettings;
