// src/features/settings/SettingsPage.jsx
import React, { useState, useCallback } from 'react';
import { 
    User, Mail, Shield, Bell, Palette, Moon, Sun, Monitor,
    Download, Trash2, LogOut, ChevronRight, Check, X,
    Home, Building2, MapPin, ExternalLink, FileText, 
    HelpCircle, MessageSquare, Star, Bug, Smartphone,
    ToggleLeft, ToggleRight, Clock, Calendar, Lock,
    AlertTriangle, Loader2, Copy, CheckCircle2
} from 'lucide-react';
import { signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { doc, deleteDoc, collection, getDocs, writeBatch, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { appId } from '../../config/constants';
import toast from 'react-hot-toast';

// ============================================
// TOGGLE COMPONENT
// ============================================
const Toggle = ({ enabled, onChange, disabled = false }) => (
    <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
    >
        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
        }`} />
    </button>
);

// ============================================
// SETTINGS SECTION COMPONENT
// ============================================
const SettingsSection = ({ title, icon: Icon, children, danger = false }) => (
    <div className={`bg-white rounded-2xl border ${danger ? 'border-red-200' : 'border-slate-100'} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${danger ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-slate-50'} flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${danger ? 'bg-red-100' : 'bg-white'}`}>
                <Icon size={18} className={danger ? 'text-red-600' : 'text-slate-600'} />
            </div>
            <h3 className={`font-bold ${danger ? 'text-red-900' : 'text-slate-800'}`}>{title}</h3>
        </div>
        <div className="divide-y divide-slate-100">
            {children}
        </div>
    </div>
);

// ============================================
// SETTINGS ROW COMPONENT
// ============================================
const SettingsRow = ({ 
    label, 
    description, 
    children, 
    onClick, 
    icon: Icon,
    danger = false,
    disabled = false 
}) => {
    const Wrapper = onClick ? 'button' : 'div';
    
    return (
        <Wrapper
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={`w-full px-5 py-4 flex items-center justify-between gap-4 text-left ${
                onClick && !disabled ? 'hover:bg-slate-50 transition-colors cursor-pointer' : ''
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {Icon && (
                    <div className={`p-2 rounded-lg ${danger ? 'bg-red-50' : 'bg-slate-100'}`}>
                        <Icon size={16} className={danger ? 'text-red-600' : 'text-slate-500'} />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className={`font-medium ${danger ? 'text-red-700' : 'text-slate-800'}`}>{label}</p>
                    {description && (
                        <p className="text-sm text-slate-500 truncate">{description}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {children}
                {onClick && !children && <ChevronRight size={18} className="text-slate-400" />}
            </div>
        </Wrapper>
    );
};

// ============================================
// DELETE ACCOUNT MODAL
// ============================================
const DeleteAccountModal = ({ isOpen, onClose, user, onDeleteSuccess }) => {
    const [step, setStep] = useState(1);
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
    const isEmailUser = user?.providerData?.some(p => p.providerId === 'password');

    const handleReauthenticate = async () => {
        setError('');
        try {
            if (isGoogleUser) {
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
            } else if (isEmailUser) {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
            }
            setStep(2);
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    const handleDelete = async () => {
        if (confirmText !== 'DELETE') return;
        
        setIsDeleting(true);
        setError('');
        
        try {
            // Delete user data from Firestore
            const batch = writeBatch(db);
            
            // Delete all records
            const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'house_records');
            const recordsSnap = await getDocs(recordsRef);
            recordsSnap.forEach(doc => batch.delete(doc.ref));
            
            // Delete profile
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            batch.delete(profileRef);
            
            await batch.commit();
            
            // Delete Firebase Auth user
            await deleteUser(user);
            
            toast.success('Account deleted successfully');
            onDeleteSuccess();
        } catch (err) {
            console.error('Delete account error:', err);
            setError(err.message.replace('Firebase: ', ''));
            setIsDeleting(false);
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setPassword('');
        setConfirmText('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 bg-red-50 border-b border-red-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-full">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-900">Delete Account</h2>
                            <p className="text-sm text-red-700">This action cannot be undone</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <>
                            <p className="text-slate-600">
                                To delete your account, please verify your identity first.
                            </p>
                            
                            {isGoogleUser ? (
                                <button
                                    onClick={handleReauthenticate}
                                    className="w-full p-3 border border-slate-300 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors font-medium"
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Verify with Google
                                </button>
                            ) : isEmailUser ? (
                                <div className="space-y-3">
                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-700">Enter your password</span>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            placeholder="••••••••"
                                        />
                                    </label>
                                    <button
                                        onClick={handleReauthenticate}
                                        disabled={!password}
                                        className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Continue
                                    </button>
                                </div>
                            ) : (
                                <p className="text-slate-600">
                                    Please sign out and sign back in to delete your account.
                                </p>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-amber-800 text-sm font-medium mb-2">
                                    You are about to permanently delete:
                                </p>
                                <ul className="text-amber-700 text-sm space-y-1">
                                    <li>• All your property data</li>
                                    <li>• All inventory records</li>
                                    <li>• All maintenance history</li>
                                    <li>• Your account and profile</li>
                                </ul>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block">
                                    <span className="text-sm font-medium text-slate-700">
                                        Type <span className="font-mono bg-slate-100 px-1 rounded">DELETE</span> to confirm
                                    </span>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                        className="mt-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                                        placeholder="DELETE"
                                    />
                                </label>
                            </div>

                            <button
                                onClick={handleDelete}
                                disabled={confirmText !== 'DELETE' || isDeleting}
                                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5" />
                                        Permanently Delete Account
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        onClick={resetAndClose}
                        className="w-full py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// EXPORT DATA MODAL
// ============================================
const ExportDataModal = ({ isOpen, onClose, records, profile, properties }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [format, setFormat] = useState('json');

    const handleExport = async () => {
        setIsExporting(true);
        
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                profile: profile,
                properties: properties,
                records: records,
                totalRecords: records.length
            };

            let content, filename, type;

            if (format === 'json') {
                content = JSON.stringify(exportData, null, 2);
                filename = `krib-export-${new Date().toISOString().split('T')[0]}.json`;
                type = 'application/json';
            } else {
                // CSV format - flatten records
                const headers = ['Item', 'Brand', 'Model', 'Category', 'Room', 'Date Installed', 'Cost', 'Contractor', 'Warranty', 'Maintenance Frequency'];
                const rows = records.map(r => [
                    r.item || '',
                    r.brand || '',
                    r.model || '',
                    r.category || '',
                    r.area || '',
                    r.dateInstalled || '',
                    r.cost || '',
                    r.contractor || '',
                    r.warranty || '',
                    r.maintenanceFrequency || ''
                ]);
                content = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
                filename = `krib-export-${new Date().toISOString().split('T')[0]}.csv`;
                type = 'text/csv';
            }

            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Exported ${records.length} records`);
            onClose();
        } catch (err) {
            toast.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 rounded-full">
                            <Download className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Export Your Data</h2>
                            <p className="text-sm text-slate-500">{records.length} records to export</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Export Format</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setFormat('json')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    format === 'json' 
                                        ? 'border-emerald-500 bg-emerald-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <FileText className={`h-6 w-6 mx-auto mb-2 ${format === 'json' ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <p className={`font-medium ${format === 'json' ? 'text-emerald-700' : 'text-slate-600'}`}>JSON</p>
                                <p className="text-xs text-slate-500">Full data backup</p>
                            </button>
                            <button
                                onClick={() => setFormat('csv')}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    format === 'csv' 
                                        ? 'border-emerald-500 bg-emerald-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <FileText className={`h-6 w-6 mx-auto mb-2 ${format === 'csv' ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <p className={`font-medium ${format === 'csv' ? 'text-emerald-700' : 'text-slate-600'}`}>CSV</p>
                                <p className="text-xs text-slate-500">Spreadsheet format</p>
                            </button>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-600">
                            <strong>Included:</strong> All inventory records, property info, maintenance history, and contractor details.
                        </p>
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isExporting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Download className="h-5 w-5" />
                        )}
                        Export
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MANAGE PROPERTIES MODAL  
// ============================================
const ManagePropertiesModal = ({ isOpen, onClose, properties, activePropertyId, onSwitchProperty, onAddProperty }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 rounded-full">
                            <Building2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Your Properties</h2>
                            <p className="text-sm text-slate-500">{properties.length} properties</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto">
                    <div className="space-y-2">
                        {properties.map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    onSwitchProperty(p.id);
                                    onClose();
                                }}
                                className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors ${
                                    p.id === activePropertyId 
                                        ? 'bg-emerald-50 border-2 border-emerald-500' 
                                        : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                                }`}
                            >
                                <Home size={20} className={p.id === activePropertyId ? 'text-emerald-600' : 'text-slate-400'} />
                                <div className="text-left flex-1">
                                    <p className="font-bold text-slate-800">{p.name}</p>
                                    {p.address && (
                                        <p className="text-xs text-slate-500">
                                            {typeof p.address === 'string' 
                                                ? p.address 
                                                : `${p.address.city}, ${p.address.state}`}
                                        </p>
                                    )}
                                </div>
                                {p.id === activePropertyId && (
                                    <CheckCircle2 size={20} className="text-emerald-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={() => {
                            onAddProperty();
                            onClose();
                        }}
                        className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-bold flex items-center justify-center gap-2 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                    >
                        <Home size={18} />
                        Add New Property
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// NOTIFICATION SETTINGS MODAL
// ============================================
const NotificationSettingsModal = ({ isOpen, onClose, profile, onSave }) => {
    const [settings, setSettings] = useState({
        maintenanceReminders: profile?.notifications?.maintenanceReminders ?? true,
        reminderDays: profile?.notifications?.reminderDays ?? 7,
        emailDigest: profile?.notifications?.emailDigest ?? false,
        contractorMessages: profile?.notifications?.contractorMessages ?? true
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ notifications: settings });
            toast.success('Notification settings updated');
            onClose();
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 rounded-full">
                            <Bell className="h-6 w-6 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Notifications</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Maintenance Reminders */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Maintenance Reminders</p>
                            <p className="text-sm text-slate-500">Get notified when tasks are due</p>
                        </div>
                        <Toggle 
                            enabled={settings.maintenanceReminders} 
                            onChange={(v) => setSettings(s => ({ ...s, maintenanceReminders: v }))} 
                        />
                    </div>

                    {/* Reminder Timing */}
                    {settings.maintenanceReminders && (
                        <div className="pl-4 border-l-2 border-emerald-200">
                            <p className="text-sm font-medium text-slate-700 mb-2">Remind me</p>
                            <div className="flex gap-2 flex-wrap">
                                {[3, 7, 14, 30].map(days => (
                                    <button
                                        key={days}
                                        onClick={() => setSettings(s => ({ ...s, reminderDays: days }))}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            settings.reminderDays === days
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {days} days before
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Email Digest */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Weekly Email Digest</p>
                            <p className="text-sm text-slate-500">Summary of upcoming tasks</p>
                        </div>
                        <Toggle 
                            enabled={settings.emailDigest} 
                            onChange={(v) => setSettings(s => ({ ...s, emailDigest: v }))} 
                        />
                    </div>

                    {/* Contractor Messages */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-800">Contractor Messages</p>
                            <p className="text-sm text-slate-500">When contractors respond</p>
                        </div>
                        <Toggle 
                            enabled={settings.contractorMessages} 
                            onChange={(v) => setSettings(s => ({ ...s, contractorMessages: v }))} 
                        />
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN SETTINGS PAGE COMPONENT
// ============================================
export const SettingsPage = ({ 
    user, 
    profile, 
    properties, 
    activePropertyId,
    records,
    useEnhancedCards,
    setUseEnhancedCards,
    onSwitchProperty,
    onAddProperty,
    onUpdateProfile,
    onSignOut
}) => {
    // Modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showPropertiesModal, setShowPropertiesModal] = useState(false);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);
    
    // Local settings state
    const [theme, setTheme] = useState(localStorage.getItem('krib-theme') || 'system');

    // Get linked providers
    const providers = user?.providerData?.map(p => p.providerId) || [];
    const isGoogleLinked = providers.includes('google.com');
    const isAppleLinked = providers.includes('apple.com');
    const isEmailLinked = providers.includes('password');

    // Theme handler
    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('krib-theme', newTheme);
        
        // Apply theme
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // System preference
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
        
        toast.success(`Theme set to ${newTheme}`);
    };

    // Profile update handler
    const handleUpdateProfile = async (updates) => {
        if (!user) return;
        try {
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
            await updateDoc(profileRef, updates);
            if (onUpdateProfile) onUpdateProfile(updates);
        } catch (err) {
            console.error('Update profile error:', err);
            throw err;
        }
    };

    // Sign out handler
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            toast.success('Signed out successfully');
            if (onSignOut) onSignOut();
        } catch (err) {
            toast.error('Failed to sign out');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-2xl font-bold text-emerald-950">Settings</h2>

            {/* Account Section */}
            <SettingsSection title="Account" icon={User}>
                <SettingsRow 
                    icon={Mail}
                    label="Email" 
                    description={user?.email || 'Not set'}
                />
                <SettingsRow 
                    icon={Shield}
                    label="Linked Accounts"
                    description={[
                        isGoogleLinked && 'Google',
                        isAppleLinked && 'Apple',
                        isEmailLinked && 'Email'
                    ].filter(Boolean).join(', ') || 'None'}
                />
            </SettingsSection>

            {/* Properties Section */}
            <SettingsSection title="Properties" icon={Building2}>
                <SettingsRow 
                    icon={Home}
                    label="Manage Properties"
                    description={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
                    onClick={() => setShowPropertiesModal(true)}
                />
            </SettingsSection>

            {/* Notifications Section */}
            <SettingsSection title="Notifications" icon={Bell}>
                <SettingsRow 
                    icon={Clock}
                    label="Notification Settings"
                    description="Reminders, digests, and alerts"
                    onClick={() => setShowNotificationsModal(true)}
                />
            </SettingsSection>

    
                
                {/* PRESERVED: Enhanced Cards toggle - exact same functionality */}
                <SettingsRow 
                    label="Enhanced Cards"
                    description="Rich inventory cards with quick actions"
                >
                    <Toggle 
                        enabled={useEnhancedCards} 
                        onChange={setUseEnhancedCards} 
                    />
                </SettingsRow>
            </SettingsSection>

            {/* Data & Privacy Section */}
            <SettingsSection title="Data & Privacy" icon={Shield}>
                <SettingsRow 
                    icon={Download}
                    label="Export My Data"
                    description={`${records.length} records`}
                    onClick={() => setShowExportModal(true)}
                />
                <SettingsRow 
                    icon={FileText}
                    label="Privacy Policy"
                    onClick={() => window.open('/privacy_policy.html', '_blank')}
                />
            </SettingsSection>

            {/* Help & Support Section */}
            <SettingsSection title="Help & Support" icon={HelpCircle}>
                <SettingsRow 
                    icon={MessageSquare}
                    label="Contact Support"
                    description="support@mykrib.app"
                    onClick={() => window.location.href = 'mailto:support@mykrib.app'}
                />
                <SettingsRow 
                    icon={Bug}
                    label="Report a Bug"
                    onClick={() => window.location.href = 'mailto:support@mykrib.app?subject=Bug%20Report'}
                />
                <SettingsRow 
                    icon={Star}
                    label="Rate the App"
                    onClick={() => toast('App store link coming soon!')}
                />
            </SettingsSection>

            {/* About Section */}
            <SettingsSection title="About" icon={Smartphone}>
                <SettingsRow 
                    label="Version"
                    description="1.0.0"
                >
                    <span className="text-sm text-slate-400">Build 2024.12</span>
                </SettingsRow>
            </SettingsSection>

            {/* Danger Zone */}
            <SettingsSection title="Account Actions" icon={AlertTriangle} danger>
                <SettingsRow 
                    icon={LogOut}
                    label="Sign Out"
                    description="You can sign back in anytime"
                    onClick={handleSignOut}
                />
                <SettingsRow 
                    icon={Trash2}
                    label="Delete Account"
                    description="Permanently delete all your data"
                    onClick={() => setShowDeleteModal(true)}
                    danger
                />
            </SettingsSection>

            {/* Footer */}
            <div className="text-center py-4">
                <p className="text-sm text-slate-400">Made with ❤️ by Krib</p>
            </div>

            {/* Modals */}
            <DeleteAccountModal 
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                user={user}
                onDeleteSuccess={() => {
                    setShowDeleteModal(false);
                    if (onSignOut) onSignOut();
                }}
            />

            <ExportDataModal 
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                records={records}
                profile={profile}
                properties={properties}
            />

            <ManagePropertiesModal 
                isOpen={showPropertiesModal}
                onClose={() => setShowPropertiesModal(false)}
                properties={properties}
                activePropertyId={activePropertyId}
                onSwitchProperty={onSwitchProperty}
                onAddProperty={onAddProperty}
            />

            <NotificationSettingsModal 
                isOpen={showNotificationsModal}
                onClose={() => setShowNotificationsModal(false)}
                profile={profile}
                onSave={handleUpdateProfile}
            />
        </div>
    );
};

export default SettingsPage;
