// src/features/contractor-pro/components/SMSSettings.jsx
// ============================================
// SMS SETTINGS COMPONENT
// ============================================
// Configuration UI for SMS appointment reminders and notifications

import React, { useState, useEffect } from 'react';
import {
    MessageSquare, Bell, Navigation, Settings, Check, X, Save,
    ChevronRight, ChevronDown, AlertCircle, Phone, Clock, Loader2,
    Edit3, Eye, RefreshCw, ToggleLeft, ToggleRight, Info, Zap
} from 'lucide-react';
import {
    getSMSSettings,
    updateSMSSettings,
    getDefaultSMSSettings,
    getSMSStats
} from '../../../lib/twilioService';
import {
    DEFAULT_TEMPLATES,
    TEMPLATE_CATEGORIES,
    TEMPLATE_VARIABLES,
    previewTemplate,
    getCharacterWarning
} from '../lib/smsTemplates';
import toast from 'react-hot-toast';

export const SMSSettings = ({ contractorId, companyName }) => {
    const [settings, setSettings] = useState(getDefaultSMSSettings());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        reminders: true,
        onTheWay: false,
        templates: false
    });
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [previewMode, setPreviewMode] = useState(null);

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            if (!contractorId) return;

            try {
                const [loadedSettings, loadedStats] = await Promise.all([
                    getSMSSettings(contractorId),
                    getSMSStats(contractorId)
                ]);
                setSettings(loadedSettings);
                setStats(loadedStats);
            } catch (error) {
                console.error('Error loading SMS settings:', error);
                toast.error('Failed to load SMS settings');
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
            await updateSMSSettings(contractorId, settings);
            toast.success('SMS settings saved!', { icon: '💬' });
        } catch (error) {
            console.error('Error saving SMS settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Toggle section
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Update nested setting
    const updateSetting = (path, value) => {
        setSettings(prev => {
            const newSettings = { ...prev };
            const keys = path.split('.');
            let current = newSettings;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
            return newSettings;
        });
    };

    // Update template
    const updateTemplate = (templateId, value) => {
        updateSetting(`templates.${templateId}`, value);
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
                    <div className="bg-blue-100 p-2.5 rounded-xl">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">SMS Notifications</h2>
                        <p className="text-sm text-gray-500">Configure appointment reminders & notifications</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Save Changes
                </button>
            </div>

            {/* Stats Overview */}
            {stats && stats.total > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                        <p className="text-sm text-gray-500">Total Sent</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <p className="text-2xl font-bold text-emerald-600">{stats.delivered}</p>
                        <p className="text-sm text-gray-500">Delivered</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                        <p className="text-sm text-gray-500">Pending</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <p className="text-2xl font-bold text-blue-600">{stats.deliveryRate}%</p>
                        <p className="text-sm text-gray-500">Delivery Rate</p>
                    </div>
                </div>
            )}

            {/* Master Enable Toggle */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${settings.enabled ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                            <Zap className={`w-6 h-6 ${settings.enabled ? 'text-emerald-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">SMS Notifications</h3>
                            <p className="text-sm text-gray-500">
                                {settings.enabled
                                    ? 'Customers will receive SMS reminders and notifications'
                                    : 'SMS notifications are currently disabled'}
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

                {!settings.twilioConfigured && settings.enabled && (
                    <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">
                            Twilio credentials need to be configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment variables.
                        </p>
                    </div>
                )}
            </div>

            {/* Appointment Reminders */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('reminders')}
                    className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-100 p-2.5 rounded-xl">
                            <Bell className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-gray-800">Appointment Reminders</h3>
                            <p className="text-sm text-gray-500">Automated 24-hour and 2-hour reminders</p>
                        </div>
                    </div>
                    {expandedSections.reminders ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                </button>

                {expandedSections.reminders && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                        {/* Enable Reminders */}
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium text-gray-700">Enable Reminders</p>
                                <p className="text-sm text-gray-500">Send automated appointment reminders</p>
                            </div>
                            <button
                                onClick={() => updateSetting('reminders.enabled', !settings.reminders?.enabled)}
                                className={`relative w-12 h-7 rounded-full transition-colors ${
                                    settings.reminders?.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                                }`}
                            >
                                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                    settings.reminders?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>

                        {settings.reminders?.enabled && (
                            <>
                                {/* 24-Hour Reminder */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-700">24-Hour Reminder</p>
                                                <p className="text-sm text-gray-500">Sent day before appointment</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateSetting('reminders.send24hReminder', !settings.reminders?.send24hReminder)}
                                            className={`relative w-12 h-7 rounded-full transition-colors ${
                                                settings.reminders?.send24hReminder ? 'bg-emerald-500' : 'bg-gray-300'
                                            }`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                                settings.reminders?.send24hReminder ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>
                                </div>

                                {/* 2-Hour Reminder */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-700">2-Hour Reminder</p>
                                                <p className="text-sm text-gray-500">Sent 2 hours before appointment</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => updateSetting('reminders.send2hReminder', !settings.reminders?.send2hReminder)}
                                            className={`relative w-12 h-7 rounded-full transition-colors ${
                                                settings.reminders?.send2hReminder ? 'bg-emerald-500' : 'bg-gray-300'
                                            }`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                                settings.reminders?.send2hReminder ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* On The Way Notifications */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('onTheWay')}
                    className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-2.5 rounded-xl">
                            <Navigation className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-gray-800">On The Way Notifications</h3>
                            <p className="text-sm text-gray-500">Alert customers when technician is en route</p>
                        </div>
                    </div>
                    {expandedSections.onTheWay ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                </button>

                {expandedSections.onTheWay && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                        {/* Enable On The Way */}
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="font-medium text-gray-700">Enable "On The Way" SMS</p>
                                <p className="text-sm text-gray-500">Notify customers when tech starts traveling</p>
                            </div>
                            <button
                                onClick={() => updateSetting('onTheWay.enabled', !settings.onTheWay?.enabled)}
                                className={`relative w-12 h-7 rounded-full transition-colors ${
                                    settings.onTheWay?.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                                }`}
                            >
                                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                    settings.onTheWay?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>

                        {settings.onTheWay?.enabled && (
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-700">Auto-send on Travel Start</p>
                                        <p className="text-sm text-gray-500">Automatically send when tech marks "traveling"</p>
                                    </div>
                                    <button
                                        onClick={() => updateSetting('onTheWay.autoSend', !settings.onTheWay?.autoSend)}
                                        className={`relative w-12 h-7 rounded-full transition-colors ${
                                            settings.onTheWay?.autoSend ? 'bg-emerald-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                            settings.onTheWay?.autoSend ? 'translate-x-5' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Message Templates */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                    onClick={() => toggleSection('templates')}
                    className="w-full flex items-center justify-between p-5 hover:bg-gray-50"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-100 p-2.5 rounded-xl">
                            <Edit3 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-gray-800">Message Templates</h3>
                            <p className="text-sm text-gray-500">Customize your SMS message content</p>
                        </div>
                    </div>
                    {expandedSections.templates ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                </button>

                {expandedSections.templates && (
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                        {/* Template Variables Info */}
                        <div className="bg-blue-50 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-blue-800">Available Variables</p>
                                    <p className="text-sm text-blue-600 mt-1">
                                        Use these placeholders in your templates:
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {Object.keys(TEMPLATE_VARIABLES).slice(0, 8).map(key => (
                                            <code key={key} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                                {`{{${key}}}`}
                                            </code>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 24-Hour Reminder Template */}
                        <TemplateEditor
                            label="24-Hour Reminder"
                            templateId="reminder24h"
                            value={settings.templates?.reminder24h || DEFAULT_TEMPLATES.reminder24h.template}
                            defaultValue={DEFAULT_TEMPLATES.reminder24h.template}
                            onChange={(value) => updateTemplate('reminder24h', value)}
                            companyName={companyName}
                        />

                        {/* 2-Hour Reminder Template */}
                        <TemplateEditor
                            label="2-Hour Reminder"
                            templateId="reminder2h"
                            value={settings.templates?.reminder2h || DEFAULT_TEMPLATES.reminder2h.template}
                            defaultValue={DEFAULT_TEMPLATES.reminder2h.template}
                            onChange={(value) => updateTemplate('reminder2h', value)}
                            companyName={companyName}
                        />

                        {/* On The Way Template */}
                        <TemplateEditor
                            label="On The Way"
                            templateId="onTheWay"
                            value={settings.templates?.onTheWay || DEFAULT_TEMPLATES.onTheWay.template}
                            defaultValue={DEFAULT_TEMPLATES.onTheWay.template}
                            onChange={(value) => updateTemplate('onTheWay', value)}
                            companyName={companyName}
                        />

                        {/* Confirmation Template */}
                        <TemplateEditor
                            label="Confirmation Response"
                            templateId="confirmation"
                            value={settings.templates?.confirmation || DEFAULT_TEMPLATES.confirmation.template}
                            defaultValue={DEFAULT_TEMPLATES.confirmation.template}
                            onChange={(value) => updateTemplate('confirmation', value)}
                            companyName={companyName}
                        />
                    </div>
                )}
            </div>

            {/* Customer Responses Info */}
            <div className="bg-gray-50 rounded-xl p-5">
                <h4 className="font-semibold text-gray-800 mb-3">Customer Response Handling</h4>
                <p className="text-sm text-gray-600 mb-4">
                    Customers can reply to SMS messages with these keywords:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <code className="text-emerald-600 font-semibold">CONFIRM</code>
                        <p className="text-xs text-gray-500 mt-1">Confirms appointment</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <code className="text-amber-600 font-semibold">RESCHEDULE</code>
                        <p className="text-xs text-gray-500 mt-1">Request new time</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <code className="text-red-600 font-semibold">CANCEL</code>
                        <p className="text-xs text-gray-500 mt-1">Cancel appointment</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <code className="text-gray-600 font-semibold">STOP</code>
                        <p className="text-xs text-gray-500 mt-1">Opt out of SMS</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Template Editor Component
const TemplateEditor = ({ label, templateId, value, defaultValue, onChange, companyName }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const [showPreview, setShowPreview] = useState(false);

    const charWarning = getCharacterWarning(localValue);
    const preview = previewTemplate(localValue).replace('{{companyName}}', companyName || 'Your Company');

    const handleSave = () => {
        onChange(localValue);
        setIsEditing(false);
    };

    const handleReset = () => {
        setLocalValue(defaultValue);
    };

    return (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <p className="font-medium text-gray-700">{label}</p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"
                        title="Preview"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"
                        title="Edit"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {isEditing ? (
                <div className="space-y-2">
                    <textarea
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={4}
                    />
                    <div className="flex items-center justify-between">
                        <span className={`text-xs ${
                            charWarning.type === 'success' ? 'text-gray-500' :
                            charWarning.type === 'warning' ? 'text-amber-600' : 'text-red-600'
                        }`}>
                            {charWarning.message}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Reset
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            ) : showPreview ? (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-400 mb-1">Preview:</p>
                    <p className="text-sm text-gray-700">{preview}</p>
                </div>
            ) : (
                <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">
                    {value}
                </p>
            )}
        </div>
    );
};

export default SMSSettings;
