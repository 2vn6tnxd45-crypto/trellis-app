// src/features/contractor-pro/components/FinancingSettings.jsx
// ============================================
// FINANCING SETTINGS COMPONENT
// ============================================
// Configuration UI for Wisetack consumer financing

import React, { useState, useEffect } from 'react';
import {
    CreditCard, Settings, DollarSign, Check, Save, Loader2,
    AlertCircle, Zap, ExternalLink, ChevronDown, ChevronRight,
    TrendingUp, Clock, CheckCircle, XCircle, Eye, EyeOff,
    HelpCircle, BarChart3, Banknote
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getFinancingSettings,
    updateFinancingSettings,
    getFinancingStats,
    getFinancingApplications,
    DEFAULT_FINANCING_SETTINGS,
    formatCurrency,
    FINANCING_STATUS,
    getStatusDisplay
} from '../../../lib/wisetackService';

export const FinancingSettings = ({ contractorId }) => {
    const [settings, setSettings] = useState(DEFAULT_FINANCING_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState(null);
    const [applications, setApplications] = useState([]);
    const [showApiKey, setShowApiKey] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        connection: true,
        settings: false,
        applications: false,
        stats: true
    });

    // Load settings and data
    useEffect(() => {
        const loadData = async () => {
            if (!contractorId) return;

            try {
                const [loadedSettings, loadedStats, loadedApps] = await Promise.all([
                    getFinancingSettings(contractorId),
                    getFinancingStats(contractorId),
                    getFinancingApplications(contractorId, { limit: 10 })
                ]);

                setSettings(loadedSettings);
                setStats(loadedStats);
                setApplications(loadedApps);
            } catch (error) {
                console.error('Error loading financing data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [contractorId]);

    // Save settings
    const handleSave = async () => {
        setSaving(true);
        try {
            await updateFinancingSettings(contractorId, settings);
            toast.success('Financing settings saved!', { icon: '💳' });
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Update setting
    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // Toggle section
    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
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
                    <div className="bg-indigo-100 p-2.5 rounded-xl">
                        <CreditCard className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Consumer Financing</h2>
                        <p className="text-sm text-gray-500">Offer financing through Wisetack</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
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
            {stats && stats.totalApplications > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Applications"
                        value={stats.totalApplications}
                        icon={<BarChart3 className="w-5 h-5" />}
                        color="blue"
                    />
                    <StatCard
                        label="Total Funded"
                        value={formatCurrency(stats.totalFunded)}
                        icon={<Banknote className="w-5 h-5" />}
                        color="emerald"
                    />
                    <StatCard
                        label="Approval Rate"
                        value={`${stats.approvalRate}%`}
                        icon={<CheckCircle className="w-5 h-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="Avg. Amount"
                        value={formatCurrency(stats.averageAmount)}
                        icon={<TrendingUp className="w-5 h-5" />}
                        color="amber"
                    />
                </div>
            )}

            {/* Master Enable Toggle */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${settings.enabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                            <Zap className={`w-6 h-6 ${settings.enabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">Consumer Financing</h3>
                            <p className="text-sm text-gray-500">
                                {settings.enabled
                                    ? 'Customers can apply for financing on quotes'
                                    : 'Financing is currently disabled'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => updateSetting('enabled', !settings.enabled)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.enabled ? 'bg-indigo-500' : 'bg-gray-300'
                        }`}
                    >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            settings.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            </div>

            {/* Wisetack Connection */}
            <SettingsSection
                title="Wisetack Connection"
                icon={<Settings className="w-5 h-5 text-gray-600" />}
                expanded={expandedSections.connection}
                onToggle={() => toggleSection('connection')}
            >
                {settings.merchantId ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <div>
                                <p className="font-medium text-emerald-800">Connected to Wisetack</p>
                                <p className="text-sm text-emerald-600">Merchant ID: {settings.merchantId}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Merchant ID
                                </label>
                                <input
                                    type="text"
                                    value={settings.merchantId || ''}
                                    onChange={(e) => updateSetting('merchantId', e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                                    placeholder="wt_merchant_xxx"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={settings.apiKey || ''}
                                        onChange={(e) => updateSetting('apiKey', e.target.value)}
                                        className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <div>
                                <p className="font-medium text-amber-800">Not Connected</p>
                                <p className="text-sm text-amber-600">
                                    Sign up for a Wisetack merchant account to offer financing
                                </p>
                            </div>
                        </div>

                        <a
                            href="https://wisetack.com/merchants"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Sign Up for Wisetack
                        </a>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Merchant ID
                                </label>
                                <input
                                    type="text"
                                    value={settings.merchantId || ''}
                                    onChange={(e) => updateSetting('merchantId', e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                                    placeholder="wt_merchant_xxx"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKey || ''}
                                    onChange={(e) => updateSetting('apiKey', e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                                    placeholder="Enter API key"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Benefits */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <h4 className="font-medium text-gray-800 mb-3">Why offer financing?</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <BenefitItem icon="💰" text="No cost to you" />
                        <BenefitItem icon="⚡" text="Instant approvals" />
                        <BenefitItem icon="🔒" text="Soft credit check" />
                        <BenefitItem icon="💳" text="Paid in full, fast" />
                    </div>
                </div>
            </SettingsSection>

            {/* Financing Settings */}
            <SettingsSection
                title="Financing Options"
                icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
                expanded={expandedSections.settings}
                onToggle={() => toggleSection('settings')}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Minimum Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                    type="number"
                                    min="100"
                                    max="1000"
                                    value={settings.minAmount}
                                    onChange={(e) => updateSetting('minAmount', parseInt(e.target.value) || 500)}
                                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Minimum quote amount for financing</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Maximum Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                    type="number"
                                    min="1000"
                                    max="50000"
                                    value={settings.maxAmount}
                                    onChange={(e) => updateSetting('maxAmount', parseInt(e.target.value) || 25000)}
                                    className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Maximum financeable amount</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Term (months)
                        </label>
                        <select
                            value={settings.defaultTermMonths}
                            onChange={(e) => updateSetting('defaultTermMonths', parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl"
                        >
                            <option value={6}>6 months</option>
                            <option value={12}>12 months</option>
                            <option value={18}>18 months</option>
                            <option value={24}>24 months</option>
                            <option value={36}>36 months</option>
                            <option value={48}>48 months</option>
                            <option value={60}>60 months</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Used for "as low as" payment estimates</p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-medium text-gray-800">Auto-show on Quotes</p>
                            <p className="text-sm text-gray-500">Automatically show financing on eligible quotes</p>
                        </div>
                        <button
                            onClick={() => updateSetting('autoShowOnQuotes', !settings.autoShowOnQuotes)}
                            className={`relative w-12 h-7 rounded-full transition-colors ${
                                settings.autoShowOnQuotes ? 'bg-indigo-500' : 'bg-gray-300'
                            }`}
                        >
                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                settings.autoShowOnQuotes ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                </div>
            </SettingsSection>

            {/* Recent Applications */}
            <SettingsSection
                title="Recent Applications"
                icon={<Clock className="w-5 h-5 text-blue-600" />}
                expanded={expandedSections.applications}
                onToggle={() => toggleSection('applications')}
                badge={applications.length > 0 ? applications.length : null}
            >
                {applications.length > 0 ? (
                    <div className="space-y-3">
                        {applications.map((app) => (
                            <ApplicationRow key={app.id} application={app} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No financing applications yet</p>
                        <p className="text-sm">Applications will appear here when customers apply</p>
                    </div>
                )}
            </SettingsSection>

            {/* Help Section */}
            <div className="bg-blue-50 rounded-xl p-5">
                <div className="flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-800 mb-2">How it works</h4>
                        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                            <li>Customer views quote and clicks "Check Your Rate"</li>
                            <li>Wisetack performs soft credit check (no impact to score)</li>
                            <li>Customer sees available terms and selects their preference</li>
                            <li>Upon approval, loan is funded and you receive full payment</li>
                            <li>Customer makes monthly payments directly to Wisetack</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard = ({ label, value, icon, color }) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600'
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
                {icon}
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
        </div>
    );
};

// Settings Section Component
const SettingsSection = ({ title, icon, expanded, onToggle, badge, children }) => (
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
                {badge && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {badge}
                    </span>
                )}
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

// Benefit Item Component
const BenefitItem = ({ icon, text }) => (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-gray-700">{text}</span>
    </div>
);

// Application Row Component
const ApplicationRow = ({ application }) => {
    const display = getStatusDisplay(application.status);

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex-1">
                <p className="font-medium text-gray-800">{application.customerName}</p>
                <p className="text-sm text-gray-500">
                    {formatCurrency(application.requestedAmount)} • {formatDate(application.createdAt)}
                </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${display.bgColor} ${display.textColor}`}>
                {display.label}
            </span>
        </div>
    );
};

export default FinancingSettings;
