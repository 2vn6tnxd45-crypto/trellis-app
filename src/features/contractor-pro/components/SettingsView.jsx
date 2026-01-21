// src/features/contractor-pro/components/SettingsView.jsx
// ============================================
// ACCOUNT SETTINGS VIEW
// ============================================
// Notification preferences and account management

import React, { useState } from 'react';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// DELETE ACCOUNT MODAL
// ============================================

const ContractorDeleteAccountModal = ({ isOpen, onClose, user, contractorId, onDeleteSuccess }) => {
    const [confirmText, setConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (confirmText !== 'DELETE') {
            toast.error('Please type DELETE to confirm');
            return;
        }

        setDeleting(true);
        try {
            // In production, this would call a backend function to delete the account
            // For now, just sign out
            toast.success('Account deletion initiated');
            onDeleteSuccess?.();
        } catch (error) {
            toast.error('Failed to delete account');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Delete Account</h3>
                        <p className="text-sm text-slate-500">This action cannot be undone</p>
                    </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-red-700">
                        Deleting your account will permanently remove:
                    </p>
                    <ul className="text-sm text-red-600 mt-2 space-y-1 list-disc list-inside">
                        <li>All your business data and settings</li>
                        <li>Customer records and job history</li>
                        <li>Quotes, invoices, and financial data</li>
                        <li>Team member information</li>
                    </ul>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Type <span className="font-bold text-red-600">DELETE</span> to confirm
                    </label>
                    <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={confirmText !== 'DELETE' || deleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {deleting ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <Trash2 size={18} />
                        )}
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN SETTINGS VIEW
// ============================================

export const SettingsView = ({ user, profile, onUpdateSettings, onSignOut }) => {
    const [settings, setSettings] = useState({
        emailNotifications: profile?.settings?.emailNotifications ?? true,
        smsNotifications: profile?.settings?.smsNotifications ?? false,
        weeklyDigest: profile?.settings?.weeklyDigest ?? true
    });
    const [saving, setSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await onUpdateSettings(profile.id, { settings });
            toast.success('Settings saved!');
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Notifications</h3>

                {[
                    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                    { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive text message alerts' },
                    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary of activity each week' }
                ].map(item => (
                    <label key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer">
                        <div>
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings[item.key]}
                            onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                            className="h-5 w-5 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                    </label>
                ))}

                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                >
                    {saving ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                    Save Settings
                </button>
            </div>

            {/* Sign Out */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-2">Session</h3>
                <p className="text-sm text-slate-500 mb-4">Sign out of your account on this device.</p>
                <button
                    onClick={onSignOut}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200"
                >
                    Sign Out
                </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <h3 className="font-bold text-red-800 mb-2">Danger Zone</h3>
                <p className="text-sm text-red-600 mb-4">Permanently delete your account and all data.</p>
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700"
                >
                    Delete Account
                </button>
            </div>

            <ContractorDeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                user={user}
                contractorId={profile?.id}
                onDeleteSuccess={onSignOut}
            />
        </div>
    );
};

export default SettingsView;
