// src/features/contractor-pro/components/TeamManagement.jsx
// ============================================
// TEAM MANAGEMENT
// ============================================
// Manage technicians with skills, availability, capacity
// Used in Settings for team-based contractors

import React, { useState, useEffect } from 'react';
import {
    Users, Plus, X, Edit2, Save, Trash2,
    Clock, MapPin, Award, Briefcase, Calendar,
    ChevronDown, ChevronUp, CheckCircle, AlertCircle,
    User, Phone, Mail, Palette, DollarSign, Truck,
    Shield, FileText, Camera, Heart
} from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import toast from 'react-hot-toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// ============================================
// CONSTANTS
// ============================================

const SKILL_OPTIONS = [
    'HVAC', 'Plumbing', 'Electrical', 'Appliance Repair',
    'Refrigeration', 'Heating', 'Cooling', 'Water Heater',
    'Drain Cleaning', 'Gas Lines', 'Ductwork', 'Insulation',
    'General Maintenance', 'Installation', 'Diagnostics'
];

const CERTIFICATION_OPTIONS = [
    'EPA 608', 'EPA 609', 'NATE Certified', 'Master Plumber',
    'Journeyman Electrician', 'Master Electrician', 'OSHA 10',
    'OSHA 30', 'R-410A Certified', 'Backflow Certified'
];

const DEFAULT_HOURS = {
    monday: { enabled: true, start: '08:00', end: '17:00' },
    tuesday: { enabled: true, start: '08:00', end: '17:00' },
    wednesday: { enabled: true, start: '08:00', end: '17:00' },
    thursday: { enabled: true, start: '08:00', end: '17:00' },
    friday: { enabled: true, start: '08:00', end: '17:00' },
    saturday: { enabled: false, start: '09:00', end: '14:00' },
    sunday: { enabled: false, start: '09:00', end: '14:00' }
};

const COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
    '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'
];

// ============================================
// TECH EDITOR MODAL
// ============================================

const TechEditorModal = ({ tech, onSave, onClose, isNew = false, vehicles = [], companyHours }) => {
    // For new techs, use company hours as default if available
    const getDefaultHours = () => {
        if (tech?.workingHours) return tech.workingHours;
        if (companyHours) return { ...companyHours };
        return { ...DEFAULT_HOURS };
    };

    const [formData, setFormData] = useState({
        id: tech?.id || `tech_${Date.now()}`,
        name: tech?.name || '',
        email: tech?.email || '',
        phone: tech?.phone || '',
        role: tech?.role || 'technician',
        color: tech?.color || COLORS[Math.floor(Math.random() * COLORS.length)],
        skills: tech?.skills || [],
        certifications: tech?.certifications || [],
        homeZip: tech?.homeZip || '',
        maxTravelMiles: tech?.maxTravelMiles || 25,
        maxJobsPerDay: tech?.maxJobsPerDay || 4,
        maxHoursPerDay: tech?.maxHoursPerDay || 8,
        defaultBufferMinutes: tech?.defaultBufferMinutes || 30,
        workingHours: getDefaultHours(),
        // New enhanced profile fields
        hourlyRate: tech?.hourlyRate || '',
        primaryVehicleId: tech?.primaryVehicleId || '',
        hireDate: tech?.hireDate || '',
        notes: tech?.notes || '',
        photoUrl: tech?.photoUrl || '',
        emergencyContact: tech?.emergencyContact || {
            name: '',
            phone: '',
            relationship: ''
        },
        certificationExpiry: tech?.certificationExpiry || {}
    });

    // For new techs, prompt to set schedule after basic info
    const [activeTab, setActiveTab] = useState(isNew ? 'basic' : 'basic');
    const [showSchedulePrompt, setShowSchedulePrompt] = useState(false);
    const [newSkill, setNewSkill] = useState('');
    const [newCert, setNewCert] = useState('');

    const handleSave = () => {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        // For new techs, prompt about schedule if they haven't visited the schedule tab
        if (isNew && !showSchedulePrompt && activeTab === 'basic') {
            setShowSchedulePrompt(true);
            return;
        }

        onSave(formData);
    };

    const handleSaveWithoutSchedule = () => {
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }
        onSave(formData);
    };

    const handleGoToSchedule = () => {
        setShowSchedulePrompt(false);
        setActiveTab('schedule');
    };

    const toggleSkill = (skill) => {
        setFormData(prev => ({
            ...prev,
            skills: prev.skills.includes(skill)
                ? prev.skills.filter(s => s !== skill)
                : [...prev.skills, skill]
        }));
    };

    const addCustomSkill = () => {
        if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
            setFormData(prev => ({
                ...prev,
                skills: [...prev.skills, newSkill.trim()]
            }));
            setNewSkill('');
        }
    };

    const toggleCert = (cert) => {
        setFormData(prev => ({
            ...prev,
            certifications: prev.certifications.includes(cert)
                ? prev.certifications.filter(c => c !== cert)
                : [...prev.certifications, cert]
        }));
    };

    const updateHours = (day, field, value) => {
        setFormData(prev => ({
            ...prev,
            workingHours: {
                ...prev.workingHours,
                [day]: {
                    ...prev.workingHours[day],
                    [field]: value
                }
            }
        }));
    };

    const updateEmergencyContact = (field, value) => {
        setFormData(prev => ({
            ...prev,
            emergencyContact: {
                ...prev.emergencyContact,
                [field]: value
            }
        }));
    };

    const updateCertExpiry = (cert, date) => {
        setFormData(prev => ({
            ...prev,
            certificationExpiry: {
                ...prev.certificationExpiry,
                [cert]: date
            }
        }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isNew ? 'Add Team Member' : 'Edit Team Member'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto">
                    {[
                        { id: 'basic', label: 'Basic', icon: User },
                        { id: 'employment', label: 'Employment', icon: Briefcase },
                        { id: 'skills', label: 'Skills', icon: Award },
                        { id: 'schedule', label: 'Schedule', icon: Calendar },
                        { id: 'capacity', label: 'Capacity', icon: Clock }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'text-emerald-600 border-b-2 border-emerald-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Basic Info Tab */}
                    {activeTab === 'basic' && (
                        <div className="space-y-4">
                            {/* Color & Name */}
                            <div className="flex gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Color</label>
                                    <div className="flex gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                                                className={`w-8 h-8 rounded-full transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Mike Johnson"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="mike@company.com"
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="(555) 123-4567"
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Role</label>
                                <Select
                                    value={formData.role}
                                    onChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                                    options={[
                                        { value: 'technician', label: 'Technician' },
                                        { value: 'senior_tech', label: 'Senior Technician' },
                                        { value: 'lead', label: 'Team Lead' },
                                        { value: 'apprentice', label: 'Apprentice' }
                                    ]}
                                />
                            </div>

                            {/* Location */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Home Zip Code</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            value={formData.homeZip}
                                            onChange={(e) => setFormData(prev => ({ ...prev, homeZip: e.target.value }))}
                                            placeholder="90210"
                                            maxLength={5}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Travel (miles)</label>
                                    <input
                                        type="number"
                                        value={formData.maxTravelMiles}
                                        onChange={(e) => setFormData(prev => ({ ...prev, maxTravelMiles: parseInt(e.target.value) || 25 }))}
                                        min={5}
                                        max={100}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Employment Tab */}
                    {activeTab === 'employment' && (
                        <div className="space-y-6">
                            {/* Hourly Rate & Hire Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Hourly Rate</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="number"
                                            value={formData.hourlyRate}
                                            onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                                            placeholder="25.00"
                                            step="0.50"
                                            min="0"
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">For labor cost calculations</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Hire Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            value={formData.hireDate}
                                            onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value }))}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Primary Vehicle */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Primary Vehicle</label>
                                <div className="relative">
                                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <select
                                        value={formData.primaryVehicleId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, primaryVehicleId: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
                                    >
                                        <option value="">No vehicle assigned</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.name || v.make} {v.model} ({v.licensePlate || 'No plate'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Default vehicle for routing</p>
                            </div>

                            {/* Emergency Contact */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
                                    <span className="flex items-center gap-2">
                                        <Heart size={14} className="text-red-400" />
                                        Emergency Contact
                                    </span>
                                </label>
                                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={formData.emergencyContact.name}
                                                onChange={(e) => updateEmergencyContact('name', e.target.value)}
                                                placeholder="Contact name"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Phone</label>
                                            <input
                                                type="tel"
                                                value={formData.emergencyContact.phone}
                                                onChange={(e) => updateEmergencyContact('phone', e.target.value)}
                                                placeholder="(555) 123-4567"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Relationship</label>
                                        <input
                                            type="text"
                                            value={formData.emergencyContact.relationship}
                                            onChange={(e) => updateEmergencyContact('relationship', e.target.value)}
                                            placeholder="Spouse, Parent, etc."
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Internal Notes</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Private notes about this team member..."
                                        rows={3}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Only visible to managers</p>
                            </div>
                        </div>
                    )}

                    {/* Skills Tab */}
                    {activeTab === 'skills' && (
                        <div className="space-y-6">
                            {/* Skills */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Skills & Specialties</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {SKILL_OPTIONS.map(skill => (
                                        <button
                                            key={skill}
                                            onClick={() => toggleSkill(skill)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.skills.includes(skill)
                                                    ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                                                    : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:border-slate-300'
                                                }`}
                                        >
                                            {skill}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom skill */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newSkill}
                                        onChange={(e) => setNewSkill(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addCustomSkill()}
                                        placeholder="Add custom skill..."
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <button
                                        onClick={addCustomSkill}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {/* Custom skills list */}
                                {formData.skills.filter(s => !SKILL_OPTIONS.includes(s)).length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {formData.skills.filter(s => !SKILL_OPTIONS.includes(s)).map(skill => (
                                            <span key={skill} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                                {skill}
                                                <button onClick={() => toggleSkill(skill)} className="hover:text-red-500">
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Certifications */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Certifications</label>
                                <div className="flex flex-wrap gap-2">
                                    {CERTIFICATION_OPTIONS.map(cert => (
                                        <button
                                            key={cert}
                                            onClick={() => toggleCert(cert)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.certifications.includes(cert)
                                                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                                    : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:border-slate-300'
                                                }`}
                                        >
                                            {cert}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule Tab */}
                    {activeTab === 'schedule' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500 mb-4">
                                Set individual working hours. Leave disabled for days off.
                            </p>

                            {Object.entries(formData.workingHours).map(([day, hours]) => (
                                <div
                                    key={day}
                                    className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${hours.enabled ? 'bg-emerald-50' : 'bg-slate-50'
                                        }`}
                                >
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={hours.enabled}
                                            onChange={(e) => updateHours(day, 'enabled', e.target.checked)}
                                            className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <span className={`font-medium capitalize w-24 ${hours.enabled ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {day}
                                        </span>
                                    </label>

                                    {hours.enabled && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={hours.start}
                                                onChange={(e) => updateHours(day, 'start', e.target.value)}
                                                className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                            <span className="text-slate-400">to</span>
                                            <input
                                                type="time"
                                                value={hours.end}
                                                onChange={(e) => updateHours(day, 'end', e.target.value)}
                                                className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Capacity Tab */}
                    {activeTab === 'capacity' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Jobs per Day</label>
                                    <input
                                        type="number"
                                        value={formData.maxJobsPerDay}
                                        onChange={(e) => setFormData(prev => ({ ...prev, maxJobsPerDay: parseInt(e.target.value) || 4 }))}
                                        min={1}
                                        max={10}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Maximum jobs to assign per day</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Hours per Day</label>
                                    <input
                                        type="number"
                                        value={formData.maxHoursPerDay}
                                        onChange={(e) => setFormData(prev => ({ ...prev, maxHoursPerDay: parseInt(e.target.value) || 8 }))}
                                        min={4}
                                        max={12}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Total work hours limit</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Buffer Between Jobs (minutes)</label>
                                <input
                                    type="number"
                                    value={formData.defaultBufferMinutes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, defaultBufferMinutes: parseInt(e.target.value) || 30 }))}
                                    min={0}
                                    max={120}
                                    step={15}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Travel time between jobs</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Schedule Prompt for New Techs */}
                {showSchedulePrompt && (
                    <div className="p-4 bg-blue-50 border-t border-blue-100">
                        <div className="flex items-start gap-3">
                            <Calendar className="text-blue-600 shrink-0 mt-0.5" size={20} />
                            <div className="flex-1">
                                <p className="font-bold text-blue-800">Set Working Schedule?</p>
                                <p className="text-sm text-blue-600 mt-1">
                                    Define which days {formData.name || 'this tech'} works. This helps with dispatch scheduling.
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={handleGoToSchedule}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Set Schedule
                                    </button>
                                    <button
                                        onClick={handleSaveWithoutSchedule}
                                        className="px-4 py-2 text-blue-700 text-sm font-medium hover:bg-blue-100 rounded-lg transition-colors"
                                    >
                                        Skip (Use Mon-Fri Default)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                {!showSchedulePrompt && (
                    <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <Save size={16} />
                            {isNew ? 'Add Member' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================
// TECH CARD
// ============================================

// Visual week grid showing which days a tech works
const WeekScheduleGrid = ({ workingHours }) => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="flex gap-0.5">
            {days.map((day, i) => {
                const fullDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][i];
                const isEnabled = workingHours?.[fullDay]?.enabled;
                const noSchedule = !workingHours;

                return (
                    <div
                        key={day}
                        className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                            noSchedule
                                ? 'bg-slate-100 text-slate-400'
                                : isEnabled
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-300'
                        }`}
                        title={`${fullDay}: ${noSchedule ? 'No schedule set' : isEnabled ? 'Working' : 'Off'}`}
                    >
                        {dayLabels[i]}
                    </div>
                );
            })}
        </div>
    );
};

const TechCard = ({ tech, onEdit, onDelete }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: tech.color || '#10B981' }}
                >
                    {tech.name?.charAt(0) || 'T'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 truncate">{tech.name}</h3>
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">
                            {tech.role?.replace('_', ' ') || 'Technician'}
                        </span>
                    </div>

                    {/* Skills preview */}
                    {tech.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {tech.skills.slice(0, 3).map(skill => (
                                <span key={skill} className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                                    {skill}
                                </span>
                            ))}
                            {tech.skills.length > 3 && (
                                <span className="text-xs text-slate-400">+{tech.skills.length - 3}</span>
                            )}
                        </div>
                    )}

                    {/* Capacity & Schedule */}
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <Briefcase size={12} />
                                {tech.maxJobsPerDay || 4}/day
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {tech.maxHoursPerDay || 8}h
                            </span>
                            {tech.hourlyRate && (
                                <span className="flex items-center gap-1 text-emerald-600">
                                    <DollarSign size={12} />
                                    ${tech.hourlyRate}/hr
                                </span>
                            )}
                        </div>
                        {/* Visual Week Schedule */}
                        <WeekScheduleGrid workingHours={tech.workingHours} />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                    <button
                        onClick={() => onEdit(tech)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">Delete {tech.name}?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onDelete(tech.id);
                                setShowDeleteConfirm(false);
                            }}
                            className="flex-1 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const TeamManagement = ({ contractorId, teamMembers = [], onUpdate, vehicles = [], companyHours }) => {
    const [members, setMembers] = useState(teamMembers);
    const [editingTech, setEditingTech] = useState(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync with props
    useEffect(() => {
        setMembers(teamMembers);
    }, [teamMembers]);

    const handleSaveTech = async (techData) => {
        setIsSaving(true);
        try {
            let updatedMembers;

            if (editingTech) {
                // Update existing
                updatedMembers = members.map(m =>
                    m.id === techData.id ? techData : m
                );
            } else {
                // Add new
                updatedMembers = [...members, techData];
            }

            // Save to Firestore
            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'scheduling.teamMembers': updatedMembers,
                updatedAt: serverTimestamp()
            });

            setMembers(updatedMembers);
            setEditingTech(null);
            setIsAddingNew(false);
            toast.success(editingTech ? 'Team member updated' : 'Team member added');
            onUpdate?.(updatedMembers);
        } catch (error) {
            console.error('Error saving team member:', error);
            toast.error('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTech = async (techId) => {
        try {
            const updatedMembers = members.filter(m => m.id !== techId);

            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'scheduling.teamMembers': updatedMembers,
                updatedAt: serverTimestamp()
            });

            setMembers(updatedMembers);
            toast.success('Team member removed');
            onUpdate?.(updatedMembers);
        } catch (error) {
            console.error('Error deleting team member:', error);
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Users size={20} />
                        Team Members
                    </h3>
                    <p className="text-sm text-slate-500">
                        {members.length} technician{members.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setIsAddingNew(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                >
                    <Plus size={18} />
                    Add Tech
                </button>
            </div>

            {/* Team List */}
            {members.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Users className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-600 font-medium mb-2">No team members yet</p>
                    <p className="text-sm text-slate-400 mb-4">
                        Add technicians to enable dispatch board and AI scheduling
                    </p>
                    <button
                        onClick={() => setIsAddingNew(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                    >
                        Add Your First Tech
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {members.map(tech => (
                        <TechCard
                            key={tech.id}
                            tech={tech}
                            onEdit={(t) => setEditingTech(t)}
                            onDelete={handleDeleteTech}
                        />
                    ))}
                </div>
            )}

            {/* Editor Modal */}
            {(editingTech || isAddingNew) && (
                <TechEditorModal
                    tech={editingTech}
                    isNew={isAddingNew}
                    onSave={handleSaveTech}
                    onClose={() => {
                        setEditingTech(null);
                        setIsAddingNew(false);
                    }}
                    vehicles={vehicles}
                    companyHours={companyHours}
                />
            )}
        </div>
    );
};

// ============================================
// TEAM SCHEDULE VIEW
// ============================================
// Shows all techs across the week in a unified grid

export const TeamScheduleView = ({ teamMembers = [], onUpdateMember, contractorId }) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const [isSaving, setIsSaving] = useState(false);

    const toggleDay = async (tech, dayName) => {
        if (isSaving) return;

        setIsSaving(true);
        try {
            const currentHours = tech.workingHours || { ...DEFAULT_HOURS };
            const currentDayEnabled = currentHours[dayName]?.enabled;

            const updatedHours = {
                ...currentHours,
                [dayName]: {
                    ...currentHours[dayName],
                    enabled: !currentDayEnabled,
                    start: currentHours[dayName]?.start || '08:00',
                    end: currentHours[dayName]?.end || '17:00'
                }
            };

            const updatedTech = { ...tech, workingHours: updatedHours };

            // Update in Firestore
            const updatedMembers = teamMembers.map(m =>
                m.id === tech.id ? updatedTech : m
            );

            const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
            await updateDoc(contractorRef, {
                'scheduling.teamMembers': updatedMembers,
                updatedAt: serverTimestamp()
            });

            onUpdateMember?.(updatedMembers);
            toast.success(`${tech.name}: ${dayName} ${!currentDayEnabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error updating schedule:', error);
            toast.error('Failed to update schedule');
        } finally {
            setIsSaving(false);
        }
    };

    if (teamMembers.length === 0) {
        return (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                <Users className="mx-auto text-slate-300 mb-3" size={40} />
                <p className="text-slate-600 font-medium">No team members</p>
                <p className="text-sm text-slate-400 mt-1">
                    Add technicians first to manage their schedules
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header Row */}
            <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
                <div className="p-3 font-bold text-slate-700 text-sm">
                    Technician
                </div>
                {dayLabels.map((label, i) => (
                    <div
                        key={days[i]}
                        className="p-3 text-center font-bold text-slate-700 text-sm border-l border-slate-200"
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* Tech Rows */}
            {teamMembers.map((tech) => (
                <div
                    key={tech.id}
                    className="grid grid-cols-8 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                >
                    {/* Tech Name */}
                    <div className="p-3 flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: tech.color || '#10B981' }}
                        >
                            {tech.name?.charAt(0) || 'T'}
                        </div>
                        <span className="font-medium text-slate-800 text-sm truncate">
                            {tech.name}
                        </span>
                    </div>

                    {/* Day Toggles */}
                    {days.map((day) => {
                        const isEnabled = tech.workingHours?.[day]?.enabled;
                        const noSchedule = !tech.workingHours;
                        const hours = tech.workingHours?.[day];

                        return (
                            <div
                                key={day}
                                className="p-2 border-l border-slate-100 flex items-center justify-center"
                            >
                                <button
                                    onClick={() => toggleDay(tech, day)}
                                    disabled={isSaving}
                                    className={`w-full h-10 rounded-lg transition-all flex flex-col items-center justify-center gap-0.5 ${
                                        isSaving ? 'opacity-50 cursor-wait' :
                                        noSchedule
                                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                                            : isEnabled
                                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                                    }`}
                                    title={`Click to ${isEnabled ? 'disable' : 'enable'} ${day}`}
                                >
                                    {isEnabled ? (
                                        <>
                                            <CheckCircle size={14} />
                                            {hours?.start && (
                                                <span className="text-[9px]">
                                                    {hours.start.replace(':00', '')}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <X size={14} />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            ))}

            {/* Legend */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-emerald-100 rounded flex items-center justify-center">
                        <CheckCircle size={10} className="text-emerald-700" />
                    </div>
                    Working
                </span>
                <span className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-slate-100 rounded flex items-center justify-center">
                        <X size={10} className="text-slate-400" />
                    </div>
                    Off
                </span>
                <span className="text-slate-400 ml-auto">
                    Click any cell to toggle
                </span>
            </div>
        </div>
    );
};

export default TeamManagement;
