// src/features/contractor-pro/components/PaymentReminderSettings.jsx
// ============================================
// PAYMENT REMINDER SETTINGS
// ============================================
// UI for configuring automated payment reminder preferences

import React, { useState, useEffect } from 'react';
import {
    Bell, BellOff, Clock, Calendar, Mail, MessageSquare,
    ChevronDown, ChevronUp, Save, Loader2, AlertCircle,
    CheckCircle, Settings, DollarSign, Send, RefreshCw
} from 'lucide-react';
import {
    getReminderSettings,
    updateReminderSettings,
    DEFAULT_REMINDER_SETTINGS,
    processAllReminders,
    getJobsNeedingReminders
} from '../lib/paymentReminderService';
import toast from 'react-hot-toast';

// ============================================
// TOGGLE SWITCH COMPONENT
// ============================================
const Toggle = ({ enabled, onChange, disabled = false }) => (
    <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-emerald-500' : 'bg-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
        <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
        />
    </button>
);

// ============================================
// CHIP SELECTOR
// ============================================
const ChipSelector = ({ options, selected, onChange, disabled = false }) => (
    <div className="flex flex-wrap gap-2">
        {options.map(opt => {
            const isSelected = selected.includes(opt.value);
            return (
                <button
                    key={opt.value}
                    onClick={() => {
                        if (disabled) return;
                        if (isSelected) {
                            onChange(selected.filter(v => v !== opt.value));
                        } else {
                            onChange([...selected, opt.value].sort((a, b) => a - b));
                        }
                    }}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                            ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {opt.label}
                </button>
            );
        })}
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
export const PaymentReminderSettings = ({ contractorId }) => {
    const [settings, setSettings] = useState(DEFAULT_REMINDER_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [expandedSections, setExpandedSections] = useState(['schedule']);

    // Preview stats
    const [pendingReminders, setPendingReminders] = useState(null);
    const [isCheckingPending, setIsCheckingPending] = useState(false);

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const data = await getReminderSettings(contractorId);
                setSettings(data);
            } catch (error) {
                console.error('Error loading settings:', error);
                toast.error('Failed to load reminder settings');
            } finally {
                setIsLoading(false);
            }
        };

        if (contractorId) {
            loadSettings();
        }
    }, [contractorId]);

    // Update settings
    const updateSetting = (path, value) => {
        setSettings(prev => {
            const newSettings = { ...prev };
            const keys = path.split('.');
            let obj = newSettings;
            for (let i = 0; i < keys.length - 1; i++) {
                obj[keys[i]] = { ...obj[keys[i]] };
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = value;
            return newSettings;
        });
        setHasChanges(true);
    };

    // Save settings
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateReminderSettings(contractorId, settings);
            setHasChanges(false);
            toast.success('Reminder settings saved!');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    // Check pending reminders
    const checkPendingReminders = async () => {
        setIsCheckingPending(true);
        try {
            const jobs = await getJobsNeedingReminders(contractorId);
            setPendingReminders(jobs.length);
        } catch (error) {
            console.error('Error checking pending:', error);
        } finally {
            setIsCheckingPending(false);
        }
    };

    // Send test reminder
    const handleSendTestReminders = async () => {
        const loadingToast = toast.loading('Sending reminders...');
        try {
            const results = await processAllReminders(contractorId);
            toast.dismiss(loadingToast);
            toast.success(`Sent ${results.processed} reminder(s)`);
            setPendingReminders(0);
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error('Failed to send reminders');
        }
    };

    // Toggle section
    const toggleSection = (section) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Loading reminder settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Payment Reminders</h2>
                        <p className="text-sm text-gray-500">Automatically remind customers about unpaid balances</p>
                    </div>
                </div>

                {/* Master Toggle */}
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${settings.enabled ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {settings.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <Toggle
                        enabled={settings.enabled}
                        onChange={(val) => updateSetting('enabled', val)}
                    />
                </div>
            </div>

            {/* Pending Reminders Alert */}
            {settings.enabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <DollarSign className="w-5 h-5 text-amber-600" />
                            <div>
                                <p className="font-medium text-amber-800">
                                    {pendingReminders === null ? (
                                        'Check for pending reminders'
                                    ) : pendingReminders > 0 ? (
                                        `${pendingReminders} customer(s) need a reminder`
                                    ) : (
                                        'All caught up!'
                                    )}
                                </p>
                                <p className="text-sm text-amber-600">
                                    {pendingReminders > 0 && 'Click to send reminders now'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={checkPendingReminders}
                                disabled={isCheckingPending}
                                className="px-3 py-1.5 bg-white text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 border border-amber-200"
                            >
                                {isCheckingPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                            </button>
                            {pendingReminders > 0 && (
                                <button
                                    onClick={handleSendTestReminders}
                                    className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    Send Now
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Sections */}
            <div className={`space-y-4 ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* SCHEDULE SECTION */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => toggleSection('schedule')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">Reminder Schedule</span>
                        </div>
                        {expandedSections.includes('schedule') ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>

                    {expandedSections.includes('schedule') && (
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                            {/* Before Due */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Send reminders before due date
                                </label>
                                <ChipSelector
                                    options={[
                                        { value: 14, label: '14 days' },
                                        { value: 7, label: '7 days' },
                                        { value: 3, label: '3 days' },
                                        { value: 1, label: '1 day' }
                                    ]}
                                    selected={settings.schedule.beforeDue}
                                    onChange={(val) => updateSetting('schedule.beforeDue', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>

                            {/* After Due (Overdue) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Send reminders when overdue
                                </label>
                                <ChipSelector
                                    options={[
                                        { value: 1, label: '1 day' },
                                        { value: 3, label: '3 days' },
                                        { value: 7, label: '7 days' },
                                        { value: 14, label: '14 days' },
                                        { value: 30, label: '30 days' }
                                    ]}
                                    selected={settings.schedule.afterDue}
                                    onChange={(val) => updateSetting('schedule.afterDue', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>

                            {/* Max Reminders */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Maximum reminders per invoice
                                </label>
                                <select
                                    value={settings.schedule.maxReminders}
                                    onChange={(e) => updateSetting('schedule.maxReminders', parseInt(e.target.value))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    disabled={!settings.enabled}
                                >
                                    <option value={3}>3 reminders</option>
                                    <option value={5}>5 reminders</option>
                                    <option value={7}>7 reminders</option>
                                    <option value={10}>10 reminders</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* CHANNELS SECTION */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => toggleSection('channels')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">Notification Channels</span>
                        </div>
                        {expandedSections.includes('channels') ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>

                    {expandedSections.includes('channels') && (
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                            {/* Email */}
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <p className="font-medium text-gray-900">Email Reminders</p>
                                        <p className="text-sm text-gray-500">Send professional reminder emails</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.channels.email}
                                    onChange={(val) => updateSetting('channels.email', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>

                            {/* SMS */}
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3">
                                    <MessageSquare className="w-5 h-5 text-green-500" />
                                    <div>
                                        <p className="font-medium text-gray-900">SMS Reminders</p>
                                        <p className="text-sm text-gray-500">Send text message reminders</p>
                                    </div>
                                </div>
                                <Toggle
                                    enabled={settings.channels.sms}
                                    onChange={(val) => updateSetting('channels.sms', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* TIMING SECTION */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => toggleSection('timing')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">Timing & Quiet Hours</span>
                        </div>
                        {expandedSections.includes('timing') ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>

                    {expandedSections.includes('timing') && (
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                            {/* Quiet Hours */}
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="font-medium text-gray-900">Quiet Hours</p>
                                    <p className="text-sm text-gray-500">Don't send reminders late at night</p>
                                </div>
                                <Toggle
                                    enabled={settings.quietHours.enabled}
                                    onChange={(val) => updateSetting('quietHours.enabled', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>

                            {settings.quietHours.enabled && (
                                <div className="flex items-center gap-4 ml-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">From</label>
                                        <input
                                            type="time"
                                            value={settings.quietHours.start}
                                            onChange={(e) => updateSetting('quietHours.start', e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                            disabled={!settings.enabled}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">To</label>
                                        <input
                                            type="time"
                                            value={settings.quietHours.end}
                                            onChange={(e) => updateSetting('quietHours.end', e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                            disabled={!settings.enabled}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Weekends */}
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="font-medium text-gray-900">Send on Weekends</p>
                                    <p className="text-sm text-gray-500">Include Saturday and Sunday</p>
                                </div>
                                <Toggle
                                    enabled={settings.weekends.enabled}
                                    onChange={(val) => updateSetting('weekends.enabled', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* CUSTOMIZATION SECTION */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => toggleSection('customization')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <Settings className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">Customization</span>
                        </div>
                        {expandedSections.includes('customization') ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>

                    {expandedSections.includes('customization') && (
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                            {/* Tone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Message Tone
                                </label>
                                <div className="flex gap-2">
                                    {['friendly', 'professional', 'firm'].map(tone => (
                                        <button
                                            key={tone}
                                            onClick={() => updateSetting('customization.tone', tone)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                                settings.customization.tone === tone
                                                    ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                                            }`}
                                            disabled={!settings.enabled}
                                        >
                                            {tone}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Include payment link */}
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="font-medium text-gray-900">Include Payment Link</p>
                                    <p className="text-sm text-gray-500">Add a direct "Pay Now" button</p>
                                </div>
                                <Toggle
                                    enabled={settings.customization.includePaymentLink}
                                    onChange={(val) => updateSetting('customization.includePaymentLink', val)}
                                    disabled={!settings.enabled}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Button */}
            {hasChanges && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    );
};

export default PaymentReminderSettings;
