// src/features/contractor-pro/components/ContractorSettings.jsx
// ============================================
// CONTRACTOR SETTINGS - Tabbed Interface
// ============================================
// Reorganized settings with:
// - Tab-based navigation
// - Search functionality
// - Logical groupings
// - Better mobile experience

import React, { useState, useMemo } from 'react';
import {
    Building2, Users, Truck, FileText, Bell, Plug,
    User, Search, ChevronRight, Clock, MapPin,
    Calendar, DollarSign, Camera, CreditCard, MessageSquare,
    Star, Globe, Wallet, Settings as SettingsIcon, X,
    Smartphone, Link2, Copy, Check, RefreshCw, Shield,
    ShieldOff, AlertCircle, Send, ChevronDown, ChevronUp,
    CheckCircle, XCircle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BusinessSettings } from './BusinessSettings';
import { TeamManagement } from './TeamManagement';
import { VehicleManagement } from './VehicleManagement';
import { ReviewSettings } from './ReviewSettings';
import { SMSSettings } from './SMSSettings';
import { SMSLog } from './SMSLog';
import { FinancingSettings } from './FinancingSettings';
import { BookingWidgetSettings } from '../../booking-widget/BookingWidgetSettings';
import { SettingsView } from './SettingsView';
import {
    generateTechInvite,
    resetPin,
    revokePortalAccess
} from '../lib/techAuthService';

// ============================================
// TAB CONFIGURATION
// ============================================

const SETTINGS_TABS = [
    {
        id: 'business',
        label: 'Business',
        icon: Building2,
        description: 'Hours, scheduling, location',
        keywords: ['working hours', 'schedule', 'buffer', 'timezone', 'home base', 'address', 'service radius']
    },
    {
        id: 'team',
        label: 'Team',
        icon: Users,
        description: 'Crew members & skills',
        keywords: ['technician', 'crew', 'employee', 'member', 'skills', 'certifications', 'availability'],
        conditional: (profile) => profile?.scheduling?.teamType === 'team'
    },
    {
        id: 'portal',
        label: 'Tech Portal',
        icon: Smartphone,
        description: 'Mobile access for techs',
        keywords: ['portal', 'mobile', 'pin', 'login', 'field', 'tech access', 'invite'],
        conditional: (profile) => profile?.scheduling?.teamType === 'team'
    },
    {
        id: 'fleet',
        label: 'Fleet',
        icon: Truck,
        description: 'Vehicles & equipment',
        keywords: ['vehicle', 'truck', 'van', 'equipment', 'maintenance', 'fleet'],
        conditional: (profile) => profile?.scheduling?.teamType === 'team' || profile?.scheduling?.vehicles > 1
    },
    {
        id: 'quotes',
        label: 'Quotes & Pricing',
        icon: FileText,
        description: 'Defaults, tax, deposits',
        keywords: ['quote', 'price', 'tax', 'deposit', 'warranty', 'labor', 'markup']
    },
    {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'SMS, email, reminders',
        keywords: ['sms', 'text', 'email', 'notification', 'reminder', 'alert', 'message']
    },
    {
        id: 'integrations',
        label: 'Integrations',
        icon: Plug,
        description: 'Payments, financing, booking',
        keywords: ['stripe', 'payment', 'wisetack', 'financing', 'booking', 'widget', 'calendar', 'google']
    },
    {
        id: 'account',
        label: 'Account',
        icon: User,
        description: 'Profile & preferences',
        keywords: ['account', 'profile', 'password', 'email', 'sign out', 'delete']
    }
];

// ============================================
// SEARCH RESULTS COMPONENT
// ============================================

const SearchResults = ({ query, tabs, onSelectTab }) => {
    const results = useMemo(() => {
        if (!query || query.length < 2) return [];

        const lowerQuery = query.toLowerCase();
        return tabs
            .filter(tab => {
                const matchesLabel = tab.label.toLowerCase().includes(lowerQuery);
                const matchesDescription = tab.description.toLowerCase().includes(lowerQuery);
                const matchesKeywords = tab.keywords.some(k => k.toLowerCase().includes(lowerQuery));
                return matchesLabel || matchesDescription || matchesKeywords;
            })
            .map(tab => ({
                ...tab,
                matchType: tab.label.toLowerCase().includes(lowerQuery) ? 'label' :
                    tab.description.toLowerCase().includes(lowerQuery) ? 'description' : 'keyword'
            }));
    }, [query, tabs]);

    if (results.length === 0) return null;

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
            {results.map(result => {
                const Icon = result.icon;
                return (
                    <button
                        key={result.id}
                        onClick={() => onSelectTab(result.id)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                    >
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <Icon size={16} className="text-slate-600" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-slate-800">{result.label}</p>
                            <p className="text-xs text-slate-500">{result.description}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-400" />
                    </button>
                );
            })}
        </div>
    );
};

// ============================================
// TAB BUTTON COMPONENT
// ============================================

const TabButton = ({ tab, isActive, onClick, isMobile }) => {
    const Icon = tab.icon;

    if (isMobile) {
        return (
            <button
                onClick={onClick}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[72px] ${
                    isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-slate-500 hover:bg-slate-100'
                }`}
            >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
        >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isActive ? 'bg-emerald-100' : 'bg-slate-100'
            }`}>
                <Icon size={18} className={isActive ? 'text-emerald-600' : 'text-slate-500'} />
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-medium ${isActive ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {tab.label}
                </p>
                <p className="text-xs text-slate-500 truncate">{tab.description}</p>
            </div>
            {isActive && (
                <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
            )}
        </button>
    );
};

// ============================================
// SETTINGS CONTENT SECTIONS
// ============================================

const BusinessSettingsSection = ({ contractorId, profile, onUpdate }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Business Settings</h2>
            <p className="text-sm text-slate-500 mt-1">Configure your working hours, scheduling preferences, and service area</p>
        </div>
        <BusinessSettings
            contractorId={contractorId}
            profile={profile}
            onUpdate={onUpdate}
        />
    </div>
);

const TeamSettingsSection = ({ contractorId, profile, onUpdate }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Team Management</h2>
            <p className="text-sm text-slate-500 mt-1">Add and manage your technicians, their skills, and availability</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <TeamManagement
                contractorId={contractorId}
                teamMembers={profile?.scheduling?.teamMembers || []}
                onUpdate={onUpdate}
            />
        </div>
    </div>
);

// ============================================
// TECH PORTAL ACCESS COMPONENTS
// ============================================

const PortalStatusBadge = ({ status }) => {
    const configs = {
        active: { icon: CheckCircle, label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
        invited: { icon: Send, label: 'Invited', className: 'bg-amber-100 text-amber-700' },
        revoked: { icon: XCircle, label: 'Revoked', className: 'bg-red-100 text-red-700' },
        none: { icon: Shield, label: 'No Access', className: 'bg-slate-100 text-slate-500' }
    };
    const config = configs[status] || configs.none;
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
            <Icon size={12} />
            {config.label}
        </span>
    );
};

const TechPortalCard = ({ tech, contractorId, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [inviteUrl, setInviteUrl] = useState(null);
    const [newPin, setNewPin] = useState(null);
    const [copied, setCopied] = useState(false);

    const portalAccess = tech.portalAccess || {};
    const status = portalAccess.status || 'none';

    const handleSendInvite = async () => {
        setIsLoading(true);
        try {
            const result = await generateTechInvite(contractorId, tech.id);
            if (result.success) {
                setInviteUrl(result.inviteUrl);
                toast.success('Invite link generated!');
                onUpdate?.();
            } else {
                toast.error(result.error || 'Failed to generate invite');
            }
        } catch (error) {
            toast.error('Failed to generate invite');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPin = async () => {
        if (!window.confirm(`Reset PIN for ${tech.name}? They will need to use the new PIN to log in.`)) return;
        setIsLoading(true);
        try {
            const result = await resetPin(contractorId, tech.id);
            if (result.success) {
                setNewPin(result.newPin);
                toast.success('PIN reset successfully!');
                onUpdate?.();
            } else {
                toast.error(result.error || 'Failed to reset PIN');
            }
        } catch (error) {
            toast.error('Failed to reset PIN');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevokeAccess = async () => {
        if (!window.confirm(`Revoke portal access for ${tech.name}?`)) return;
        setIsLoading(true);
        try {
            const result = await revokePortalAccess(contractorId, tech.id);
            if (result.success) {
                toast.success('Portal access revoked');
                onUpdate?.();
            } else {
                toast.error(result.error || 'Failed to revoke access');
            }
        } catch (error) {
            toast.error('Failed to revoke access');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: tech.color || '#10B981' }}
                >
                    {tech.name?.charAt(0) || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 truncate">{tech.name}</span>
                        <PortalStatusBadge status={status} />
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                        {tech.email || tech.phone || 'No contact info'}
                    </div>
                </div>
                <div className="text-slate-400">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-4">
                    {status === 'active' && (
                        <div className="bg-emerald-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                                <CheckCircle size={16} />Portal Access Active
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                <div><span className="text-slate-400">Last login:</span><br />{formatDate(portalAccess.lastLogin)}</div>
                                <div><span className="text-slate-400">PIN set:</span><br />{formatDate(portalAccess.pinSetAt)}</div>
                            </div>
                        </div>
                    )}

                    {status === 'invited' && (
                        <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                                <Send size={16} />Invite Sent - Pending Setup
                            </div>
                            <div className="text-xs text-slate-600">
                                <span className="text-slate-400">Expires:</span> {formatDate(portalAccess.inviteExpiry)}
                            </div>
                        </div>
                    )}

                    {status === 'revoked' && (
                        <div className="bg-red-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                                <XCircle size={16} />Access Revoked
                            </div>
                        </div>
                    )}

                    {inviteUrl && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-700 mb-2 font-medium">Share this link with {tech.name}:</p>
                            <div className="flex gap-2">
                                <input type="text" value={inviteUrl} readOnly className="flex-1 text-xs bg-white border border-blue-200 rounded px-2 py-1.5 text-slate-600" />
                                <button onClick={() => copyToClipboard(inviteUrl)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1">
                                    {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                    )}

                    {newPin && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <p className="text-xs text-purple-700 mb-2 font-medium">New PIN for {tech.name}:</p>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-mono font-bold text-purple-700 tracking-widest">{newPin}</span>
                                <button onClick={() => copyToClipboard(newPin)} className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex items-center gap-1">
                                    {copied ? <Check size={12} /> : <Copy size={12} />}Copy
                                </button>
                            </div>
                            <p className="text-xs text-purple-600 mt-2">Share this PIN securely. It won't be shown again.</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {(status === 'none' || status === 'invited' || status === 'revoked') && (
                            <button onClick={handleSendInvite} disabled={isLoading} className="flex-1 min-w-[120px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                                {status === 'invited' ? 'Resend Invite' : 'Send Invite'}
                            </button>
                        )}
                        {status === 'active' && (
                            <button onClick={handleResetPin} disabled={isLoading} className="flex-1 min-w-[120px] px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Reset PIN
                            </button>
                        )}
                        {(status === 'active' || status === 'invited') && (
                            <button onClick={handleRevokeAccess} disabled={isLoading} className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:bg-slate-100 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}Revoke
                            </button>
                        )}
                    </div>

                    {!tech.email && !tech.phone && status === 'none' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">Add an email or phone for this tech to send them the invite link.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const TechPortalSettingsSection = ({ contractorId, profile, onUpdate }) => {
    const teamMembers = profile?.scheduling?.teamMembers || [];
    const activeCount = teamMembers.filter(t => t.portalAccess?.status === 'active').length;
    const invitedCount = teamMembers.filter(t => t.portalAccess?.status === 'invited').length;

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold text-slate-800">Tech Field Portal</h2>
                <p className="text-sm text-slate-500 mt-1">Manage mobile portal access for your technicians</p>
            </div>

            {teamMembers.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Smartphone className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-600 font-medium mb-2">No team members</p>
                    <p className="text-sm text-slate-400">Add team members in the Team tab first to enable portal access</p>
                </div>
            ) : (
                <>
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                                <Smartphone size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Portal Status</h3>
                                <p className="text-xs text-slate-500">Mobile access for your team</p>
                            </div>
                        </div>
                        <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-emerald-500" />
                                <span className="text-slate-600">{activeCount} active</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Send size={14} className="text-amber-500" />
                                <span className="text-slate-600">{invitedCount} pending</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Shield size={14} className="text-slate-400" />
                                <span className="text-slate-600">{teamMembers.length - activeCount - invitedCount} no access</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="font-medium text-blue-800 text-sm mb-2">How Tech Portal Works</h4>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li>1. Send an invite link to each technician</li>
                            <li>2. They open the link and create a 4-digit PIN</li>
                            <li>3. Techs use their PIN to log in daily from their phone</li>
                            <li>4. They can view jobs, clock in/out, and update status</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        {teamMembers.map(tech => (
                            <TechPortalCard key={tech.id} tech={tech} contractorId={contractorId} onUpdate={onUpdate} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const FleetSettingsSection = ({ contractorId, profile, vehicles, vehiclesLoading, onUpdate }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Fleet Management</h2>
            <p className="text-sm text-slate-500 mt-1">Manage your service vehicles, equipment, and maintenance schedules</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            {vehiclesLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
            ) : (
                <VehicleManagement
                    contractorId={contractorId}
                    vehicles={vehicles}
                    teamMembers={profile?.scheduling?.teamMembers || []}
                    onUpdate={onUpdate}
                />
            )}
        </div>
    </div>
);

const QuotesSettingsSection = ({ contractorId, profile }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Quotes & Pricing</h2>
            <p className="text-sm text-slate-500 mt-1">Set default values for quotes, tax rates, and deposit requirements</p>
        </div>

        {/* Quote Defaults Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <FileText size={20} className="text-emerald-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">Quote Defaults</h3>
                    <p className="text-xs text-slate-500">Pre-filled values for new quotes</p>
                </div>
            </div>

            <div className="grid gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Default Labor Warranty</label>
                    <input
                        type="text"
                        defaultValue={profile?.scheduling?.defaultLaborWarranty || ''}
                        placeholder="e.g., 1 Year Labor Warranty on all work"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Default Tax Rate (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            defaultValue={profile?.scheduling?.defaultTaxRate || 8.75}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Default Deposit (%)</label>
                        <input
                            type="number"
                            defaultValue={profile?.scheduling?.defaultDepositValue || 15}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                These defaults are applied to new quotes. You can override them for individual quotes.
            </p>
        </div>

        {/* Photo Requirements Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Camera size={20} className="text-orange-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">Job Photo Requirements</h3>
                    <p className="text-xs text-slate-500">Require before/after documentation</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <span>📷</span>
                        <span className="font-medium text-slate-700">Before Photos Required</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={profile?.photoSettings?.beforePhotosRequired !== false} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-300 peer-checked:bg-orange-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <span>✨</span>
                        <span className="font-medium text-slate-700">After Photos Required</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={profile?.photoSettings?.afterPhotosRequired !== false} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-300 peer-checked:bg-emerald-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                </div>
            </div>
        </div>
    </div>
);

const NotificationsSettingsSection = ({ contractorId, profile }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Notifications</h2>
            <p className="text-sm text-slate-500 mt-1">Configure SMS reminders, review requests, and notification preferences</p>
        </div>

        {/* SMS Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <SMSSettings
                contractorId={contractorId}
                companyName={profile?.businessName || profile?.companyName}
            />
        </div>

        {/* Review Request Settings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <ReviewSettings
                contractorId={contractorId}
                profile={profile}
                onUpdate={(settings) => console.log('Review settings updated:', settings)}
            />
        </div>

        {/* SMS Log */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <SMSLog contractorId={contractorId} />
        </div>
    </div>
);

const IntegrationsSettingsSection = ({ contractorId, profile }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Integrations</h2>
            <p className="text-sm text-slate-500 mt-1">Connect payment processing, financing, and booking tools</p>
        </div>

        {/* Payment Processing - Stripe */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <CreditCard size={20} className="text-indigo-600" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">Payment Processing</h3>
                    <p className="text-xs text-slate-500">Accept card payments via Stripe</p>
                </div>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl">
                Payment processing settings are available in the Business Settings tab under Stripe Connect.
            </p>
        </div>

        {/* Consumer Financing - Wisetack */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <FinancingSettings
                contractorId={contractorId}
                profile={profile}
            />
        </div>

        {/* Online Booking Widget */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <BookingWidgetSettings
                contractorId={contractorId}
                profile={profile}
                serviceTypes={profile?.serviceTypes || []}
            />
        </div>

        {/* Google Calendar Integration (Coming Soon) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 opacity-75">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Calendar size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800">Google Calendar</h3>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">COMING SOON</span>
                    </div>
                    <p className="text-xs text-slate-500">Sync jobs to crew calendars</p>
                </div>
            </div>
            <p className="text-sm text-slate-500">
                Two-way calendar sync will allow crew members to see their schedules on any device
                and automatically import personal calendar blocks for availability management.
            </p>
        </div>
    </div>
);

const AccountSettingsSection = ({ user, profile, onUpdateSettings, onSignOut }) => (
    <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800">Account Settings</h2>
            <p className="text-sm text-slate-500 mt-1">Manage your account, notifications, and preferences</p>
        </div>

        <SettingsView
            user={user}
            profile={profile}
            onUpdateSettings={onUpdateSettings}
            onSignOut={onSignOut}
        />
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const ContractorSettings = ({
    contractorId,
    profile,
    user,
    vehicles = [],
    vehiclesLoading = false,
    onUpdateProfile,
    onUpdateSettings,
    onSignOut
}) => {
    const [activeTab, setActiveTab] = useState('business');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Filter tabs based on conditions
    const visibleTabs = useMemo(() => {
        return SETTINGS_TABS.filter(tab => {
            if (tab.conditional) {
                return tab.conditional(profile);
            }
            return true;
        });
    }, [profile]);

    const handleSelectTab = (tabId) => {
        setActiveTab(tabId);
        setSearchQuery('');
        setShowSearch(false);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'business':
                return (
                    <BusinessSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                        onUpdate={onUpdateProfile}
                    />
                );
            case 'team':
                return (
                    <TeamSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                        onUpdate={onUpdateProfile}
                    />
                );
            case 'portal':
                return (
                    <TechPortalSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                        onUpdate={onUpdateProfile}
                    />
                );
            case 'fleet':
                return (
                    <FleetSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                        vehicles={vehicles}
                        vehiclesLoading={vehiclesLoading}
                        onUpdate={onUpdateProfile}
                    />
                );
            case 'quotes':
                return (
                    <QuotesSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                    />
                );
            case 'notifications':
                return (
                    <NotificationsSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                    />
                );
            case 'integrations':
                return (
                    <IntegrationsSettingsSection
                        contractorId={contractorId}
                        profile={profile}
                    />
                );
            case 'account':
                return (
                    <AccountSettingsSection
                        user={user}
                        profile={profile}
                        onUpdateSettings={onUpdateSettings}
                        onSignOut={onSignOut}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
                            <p className="text-sm text-slate-500">Manage your business preferences</p>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            {showSearch ? (
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search settings..."
                                            autoFocus
                                            className="pl-9 pr-4 py-2 w-64 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                        />
                                        <SearchResults
                                            query={searchQuery}
                                            tabs={visibleTabs}
                                            onSelectTab={handleSelectTab}
                                        />
                                    </div>
                                    <button
                                        onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                                        className="p-2 hover:bg-slate-100 rounded-lg"
                                    >
                                        <X size={18} className="text-slate-500" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSearch(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 text-sm transition-colors"
                                >
                                    <Search size={16} />
                                    <span className="hidden sm:inline">Search settings</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Mobile Tab Scroll */}
                    <div className="lg:hidden mt-4 -mx-4 px-4 overflow-x-auto">
                        <div className="flex gap-2 pb-2">
                            {visibleTabs.map(tab => (
                                <TabButton
                                    key={tab.id}
                                    tab={tab}
                                    isActive={activeTab === tab.id}
                                    onClick={() => handleSelectTab(tab.id)}
                                    isMobile
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="flex gap-6">
                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:block w-64 shrink-0">
                        <div className="sticky top-28 space-y-2">
                            {visibleTabs.map(tab => (
                                <TabButton
                                    key={tab.id}
                                    tab={tab}
                                    isActive={activeTab === tab.id}
                                    onClick={() => handleSelectTab(tab.id)}
                                    isMobile={false}
                                />
                            ))}
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        {renderContent()}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ContractorSettings;
