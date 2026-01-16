// src/features/settings/NotificationSettingsModal.jsx
// UPDATED: Added digest frequency selection (daily/weekly/monthly)
// Replaces the notification settings portion of SettingsPage

import React, { useState } from 'react';
import { Bell, X, Clock, Mail, MessageSquare, AlertTriangle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

// Toggle Component
const Toggle = ({ enabled, onChange, disabled = false }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
      enabled ? 'bg-emerald-600' : 'bg-slate-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <div
      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// Frequency Selector Component
const FrequencySelector = ({ value, onChange, disabled = false }) => {
  const options = [
    { value: 'daily', label: 'Daily', description: 'Every morning' },
    { value: 'weekly', label: 'Weekly', description: 'Every Monday' },
    { value: 'monthly', label: 'Monthly', description: '1st of month' },
  ];
  
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-emerald-600 text-white shadow-sm'
              : disabled
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <div className="font-bold">{opt.label}</div>
          <div className={`text-[10px] mt-0.5 ${value === opt.value ? 'text-emerald-100' : 'text-slate-400'}`}>
            {opt.description}
          </div>
        </button>
      ))}
    </div>
  );
};

// Setting Row Component
const SettingRow = ({ icon: Icon, title, description, children }) => (
  <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0">
    <div className="flex items-start gap-3 flex-1">
      {Icon && (
        <div className="p-2 bg-slate-100 rounded-lg mt-0.5">
          <Icon size={16} className="text-slate-500" />
        </div>
      )}
      <div className="flex-1">
        <p className="font-medium text-slate-800">{title}</p>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
    <div className="ml-4 flex-shrink-0">
      {children}
    </div>
  </div>
);

// Main Modal Component
export const NotificationSettingsModal = ({ 
  isOpen, 
  onClose, 
  profile, 
  onSave 
}) => {
  // Initialize state from profile
  const [settings, setSettings] = useState({
    maintenanceReminders: profile?.notifications?.maintenanceReminders ?? true,
    reminderDays: profile?.notifications?.reminderDays ?? 7,
    emailDigest: profile?.notifications?.emailDigest ?? false,
    digestFrequency: profile?.notifications?.digestFrequency ?? 'monthly',
    overdueAlerts: profile?.notifications?.overdueAlerts ?? true,
    warrantyAlerts: profile?.notifications?.warrantyAlerts ?? true,
    contractorMessages: profile?.notifications?.contractorMessages ?? true,
    // Appointment reminder settings
    appointmentDayBefore: profile?.notifications?.appointmentDayBefore ?? true,
    appointmentMorningOf: profile?.notifications?.appointmentMorningOf ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ notifications: settings });
      toast.success('Notification settings updated');
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-full">
              <Bell className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Notifications</h2>
              <p className="text-sm text-slate-500">Manage how you receive alerts</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          
          {/* IN-APP NOTIFICATIONS */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              In-App Notifications
            </h3>
            
            <SettingRow
              icon={Bell}
              title="Maintenance Reminders"
              description="Get notified when tasks are coming due"
            >
              <Toggle 
                enabled={settings.maintenanceReminders} 
                onChange={(v) => setSettings(s => ({ ...s, maintenanceReminders: v }))} 
              />
            </SettingRow>
            
            {/* Reminder Days - only show if reminders enabled */}
            {settings.maintenanceReminders && (
              <div className="ml-11 py-3 border-b border-slate-100">
                <p className="text-sm text-slate-600 mb-2">Remind me this many days before due:</p>
                <div className="flex gap-2">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => setSettings(s => ({ ...s, reminderDays: days }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        settings.reminderDays === days
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* EMAIL NOTIFICATIONS */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Email Notifications
            </h3>
            
            <SettingRow
              icon={Mail}
              title="Email Digest"
              description="Summary of upcoming and overdue tasks"
            >
              <Toggle 
                enabled={settings.emailDigest} 
                onChange={(v) => setSettings(s => ({ ...s, emailDigest: v }))} 
              />
            </SettingRow>
            
            {/* Digest Frequency - only show if digest enabled */}
            {settings.emailDigest && (
              <div className="ml-11 py-3 border-b border-slate-100">
                <p className="text-sm text-slate-600 mb-3">How often?</p>
                <FrequencySelector
                  value={settings.digestFrequency}
                  onChange={(v) => setSettings(s => ({ ...s, digestFrequency: v }))}
                />
              </div>
            )}
            
            <SettingRow
              icon={AlertTriangle}
              title="Overdue Alerts"
              description="Immediate email when a task becomes overdue"
            >
              <Toggle 
                enabled={settings.overdueAlerts} 
                onChange={(v) => setSettings(s => ({ ...s, overdueAlerts: v }))} 
              />
            </SettingRow>
            
            <SettingRow
              icon={Clock}
              title="Warranty Alerts"
              description="Notify when warranties are expiring soon"
            >
              <Toggle
                enabled={settings.warrantyAlerts}
                onChange={(v) => setSettings(s => ({ ...s, warrantyAlerts: v }))}
              />
            </SettingRow>
          </div>

          {/* APPOINTMENT REMINDERS */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Appointment Reminders
            </h3>

            <SettingRow
              icon={Calendar}
              title="Day Before Reminder"
              description="Email reminder the evening before your appointment"
            >
              <Toggle
                enabled={settings.appointmentDayBefore}
                onChange={(v) => setSettings(s => ({ ...s, appointmentDayBefore: v }))}
              />
            </SettingRow>

            <SettingRow
              icon={Bell}
              title="Morning Of Reminder"
              description="Quick reminder on the morning of your appointment"
            >
              <Toggle
                enabled={settings.appointmentMorningOf}
                onChange={(v) => setSettings(s => ({ ...s, appointmentMorningOf: v }))}
              />
            </SettingRow>
          </div>

          {/* OTHER */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Other
            </h3>
            
            <SettingRow
              icon={MessageSquare}
              title="Contractor Messages"
              description="When contractors respond to requests"
            >
              <Toggle 
                enabled={settings.contractorMessages} 
                onChange={(v) => setSettings(s => ({ ...s, contractorMessages: v }))} 
              />
            </SettingRow>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-slate-100 flex gap-3">
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
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsModal;
