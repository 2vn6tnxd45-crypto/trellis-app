// src/features/contractor-pro/components/VehicleManagement.jsx
// ============================================
// VEHICLE FLEET MANAGEMENT
// ============================================
// Manage service vehicles with equipment, assignments, maintenance
// Used in Settings for contractors with multiple vehicles

import React, { useState, useEffect } from 'react';
import {
    Truck, Plus, X, Edit2, Save, Trash2,
    Wrench, Package, Calendar,
    CheckCircle, AlertCircle,
    Car, Settings, AlertTriangle,
    User, Gauge
} from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import toast from 'react-hot-toast';
import {
    VEHICLE_TYPES,
    VEHICLE_EQUIPMENT_OPTIONS,
    VEHICLE_STATUS,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    generateVehicleName,
    checkMaintenanceNeeded
} from '../lib/vehicleService';

// ============================================
// CONSTANTS
// ============================================

// Color options for vehicles (same as team members for consistency)
const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16'  // Lime
];

// Group equipment by category for better UX
const EQUIPMENT_BY_CATEGORY = VEHICLE_EQUIPMENT_OPTIONS.reduce((acc, eq) => {
    if (!acc[eq.category]) acc[eq.category] = [];
    acc[eq.category].push(eq);
    return acc;
}, {});

const CATEGORY_LABELS = {
    access: 'Access Equipment',
    tools: 'Tools',
    specialty: 'Specialty',
    hvac: 'HVAC',
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    power: 'Power',
    supplies: 'Supplies',
    safety: 'Safety'
};

// ============================================
// VEHICLE EDITOR MODAL
// ============================================

const VehicleEditorModal = ({ vehicle, teamMembers = [], onSave, onClose, isNew = false }) => {
    const [formData, setFormData] = useState({
        id: vehicle?.id || `vehicle_${Date.now()}`,
        name: vehicle?.name || '',
        type: vehicle?.type || 'van',
        licensePlate: vehicle?.licensePlate || '',
        year: vehicle?.year || null,
        make: vehicle?.make || '',
        model: vehicle?.model || '',
        color: vehicle?.color || COLORS[Math.floor(Math.random() * COLORS.length)],
        capacity: vehicle?.capacity || { passengers: 2, cargoLbs: 1000 },
        equipment: vehicle?.equipment || [],
        defaultTechId: vehicle?.defaultTechId || null,
        defaultTechName: vehicle?.defaultTechName || null,
        status: vehicle?.status || 'available',
        homeLocation: vehicle?.homeLocation || { address: '', coordinates: null },
        notes: vehicle?.notes || '',
        maintenanceNotes: vehicle?.maintenanceNotes || '',
        currentMileage: vehicle?.currentMileage || null,
        lastMaintenanceDate: vehicle?.lastMaintenanceDate || null,
        nextMaintenanceDate: vehicle?.nextMaintenanceDate || null
    });

    const [activeTab, setActiveTab] = useState('basic');
    const [isSaving, setIsSaving] = useState(false);

    // Auto-generate name if empty and type changes
    useEffect(() => {
        if (isNew && !formData.name) {
            setFormData(prev => ({
                ...prev,
                name: generateVehicleName(prev.type, [])
            }));
        }
    }, [isNew]);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Vehicle name is required');
            return;
        }
        setIsSaving(true);
        try {
            await onSave(formData);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleEquipment = (equipmentId) => {
        setFormData(prev => ({
            ...prev,
            equipment: prev.equipment.includes(equipmentId)
                ? prev.equipment.filter(e => e !== equipmentId)
                : [...prev.equipment, equipmentId]
        }));
    };

    const handleTechChange = (techId) => {
        const tech = teamMembers.find(t => t.id === techId);
        setFormData(prev => ({
            ...prev,
            defaultTechId: techId || null,
            defaultTechName: tech?.name || null
        }));
    };

    // Format date for input
    const formatDateForInput = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toISOString().split('T')[0];
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isNew ? 'Add Vehicle' : 'Edit Vehicle'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 shrink-0">
                    {[
                        { id: 'basic', label: 'Basic Info', icon: Car },
                        { id: 'equipment', label: 'Equipment', icon: Wrench },
                        { id: 'assignment', label: 'Assignment', icon: User },
                        { id: 'maintenance', label: 'Maintenance', icon: Settings }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'text-emerald-600 border-b-2 border-emerald-600'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <tab.icon size={16} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">

                    {/* ==================== BASIC INFO TAB ==================== */}
                    {activeTab === 'basic' && (
                        <div className="space-y-4">
                            {/* Color & Name Row */}
                            <div className="flex gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Color</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                                                className={`w-8 h-8 rounded-full transition-transform ${
                                                    formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                        Vehicle Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Van #1, Mike's Truck"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Type & License Plate */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type</label>
                                    <Select
                                        value={formData.type}
                                        onChange={(val) => setFormData(prev => ({ ...prev, type: val }))}
                                        options={VEHICLE_TYPES.map(t => ({ value: t.id, label: t.label }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">License Plate</label>
                                    <input
                                        type="text"
                                        value={formData.licensePlate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
                                        placeholder="ABC-1234"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                                    />
                                </div>
                            </div>

                            {/* Year, Make, Model */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Year</label>
                                    <input
                                        type="number"
                                        value={formData.year || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value ? parseInt(e.target.value) : null }))}
                                        placeholder="2020"
                                        min="1990"
                                        max={new Date().getFullYear() + 1}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Make</label>
                                    <input
                                        type="text"
                                        value={formData.make}
                                        onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                                        placeholder="Ford"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Model</label>
                                    <input
                                        type="text"
                                        value={formData.model}
                                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="Transit"
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Capacity */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Passengers</label>
                                    <Select
                                        value={formData.capacity.passengers}
                                        onChange={(val) => setFormData(prev => ({
                                            ...prev,
                                            capacity: { ...prev.capacity, passengers: parseInt(val) }
                                        }))}
                                        options={[1,2,3,4,5,6,7,8].map(n => ({ value: n, label: `${n} ${n === 1 ? 'person' : 'people'}` }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cargo Capacity (lbs)</label>
                                    <Select
                                        value={formData.capacity.cargoLbs}
                                        onChange={(val) => setFormData(prev => ({
                                            ...prev,
                                            capacity: { ...prev.capacity, cargoLbs: parseInt(val) }
                                        }))}
                                        options={[500, 1000, 1500, 2000, 3000, 5000, 10000].map(n => ({
                                            value: n,
                                            label: `${n.toLocaleString()} lbs`
                                        }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== EQUIPMENT TAB ==================== */}
                    {activeTab === 'equipment' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                Select equipment typically carried in this vehicle. This helps with smart job assignments.
                            </p>

                            {/* Selected count */}
                            <div className="flex items-center gap-2 text-sm">
                                <Package size={16} className="text-emerald-600" />
                                <span className="font-medium text-slate-700">
                                    {formData.equipment.length} items selected
                                </span>
                            </div>

                            {/* Equipment by category */}
                            {Object.entries(EQUIPMENT_BY_CATEGORY).map(([category, items]) => (
                                <div key={category} className="border border-slate-200 rounded-xl p-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                                        {CATEGORY_LABELS[category] || category}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {items.map(eq => (
                                            <button
                                                key={eq.id}
                                                onClick={() => toggleEquipment(eq.id)}
                                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                                    formData.equipment.includes(eq.id)
                                                        ? 'bg-emerald-100 text-emerald-700 font-medium'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {formData.equipment.includes(eq.id) && (
                                                    <CheckCircle size={14} className="inline mr-1" />
                                                )}
                                                {eq.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ==================== ASSIGNMENT TAB ==================== */}
                    {activeTab === 'assignment' && (
                        <div className="space-y-4">
                            {/* Default Technician */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Default Technician
                                </label>
                                <p className="text-xs text-slate-400 mb-2">
                                    This tech will be auto-suggested when assigning this vehicle
                                </p>
                                <Select
                                    value={formData.defaultTechId || ''}
                                    onChange={handleTechChange}
                                    options={[
                                        { value: '', label: 'No default (any tech)' },
                                        ...teamMembers.map(t => ({ value: t.id, label: t.name }))
                                    ]}
                                />
                            </div>

                            {/* Home Location */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Home Location / Parking
                                </label>
                                <p className="text-xs text-slate-400 mb-2">
                                    Where this vehicle is parked overnight (for route optimization)
                                </p>
                                <input
                                    type="text"
                                    value={formData.homeLocation?.address || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        homeLocation: { ...prev.homeLocation, address: e.target.value }
                                    }))}
                                    placeholder="123 Main St, City, State 12345"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            {/* Info Box */}
                            <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-xl">
                                <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700">
                                    When this vehicle's default tech is assigned to a job, this vehicle will be automatically suggested.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ==================== MAINTENANCE TAB ==================== */}
                    {activeTab === 'maintenance' && (
                        <div className="space-y-4">
                            {/* Status */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Current Status
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {VEHICLE_STATUS.map(status => (
                                        <button
                                            key={status.id}
                                            onClick={() => setFormData(prev => ({ ...prev, status: status.id }))}
                                            className={`p-3 rounded-xl border-2 transition-all text-left ${
                                                formData.status === status.id
                                                    ? 'border-emerald-500 bg-emerald-50'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: status.color }}
                                                />
                                                <span className="font-medium text-slate-800">{status.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mileage */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Current Mileage
                                </label>
                                <div className="relative">
                                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="number"
                                        value={formData.currentMileage || ''}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            currentMileage: e.target.value ? parseInt(e.target.value) : null
                                        }))}
                                        placeholder="50000"
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Maintenance Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                        Last Service Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formatDateForInput(formData.lastMaintenanceDate)}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            lastMaintenanceDate: e.target.value ? new Date(e.target.value) : null
                                        }))}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                        Next Service Due
                                    </label>
                                    <input
                                        type="date"
                                        value={formatDateForInput(formData.nextMaintenanceDate)}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            nextMaintenanceDate: e.target.value ? new Date(e.target.value) : null
                                        }))}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Maintenance Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    Maintenance Notes
                                </label>
                                <textarea
                                    value={formData.maintenanceNotes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
                                    placeholder="Oil change every 5000 miles, brake inspection..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                />
                            </div>

                            {/* General Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                    General Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Any other notes about this vehicle..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <Save size={18} />
                        )}
                        {isNew ? 'Add Vehicle' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// VEHICLE CARD
// ============================================

const VehicleCard = ({ vehicle, teamMembers = [], onEdit, onDelete }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Get maintenance status
    const maintenanceStatus = checkMaintenanceNeeded(vehicle);

    // Get status info
    const statusInfo = VEHICLE_STATUS.find(s => s.id === vehicle.status) || VEHICLE_STATUS[0];

    // Get type info
    const typeInfo = VEHICLE_TYPES.find(t => t.id === vehicle.type) || VEHICLE_TYPES[0];

    // Get assigned tech
    const assignedTech = teamMembers.find(t => t.id === vehicle.defaultTechId);

    // Equipment preview (first 3)
    const equipmentPreview = (vehicle.equipment || [])
        .slice(0, 3)
        .map(eqId => VEHICLE_EQUIPMENT_OPTIONS.find(e => e.id === eqId)?.label || eqId);
    const moreEquipment = (vehicle.equipment || []).length - 3;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
                {/* Vehicle Icon */}
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: vehicle.color || '#3B82F6' }}
                >
                    <Truck size={24} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800 truncate">{vehicle.name}</h3>
                        {/* Status Badge */}
                        <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                                backgroundColor: `${statusInfo.color}20`,
                                color: statusInfo.color
                            }}
                        >
                            {statusInfo.label}
                        </span>
                        {/* Maintenance Alert */}
                        {maintenanceStatus.needed && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                                maintenanceStatus.urgency === 'overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}>
                                <AlertTriangle size={12} />
                                {maintenanceStatus.urgency === 'overdue' ? 'Overdue' : 'Service Soon'}
                            </span>
                        )}
                    </div>

                    {/* Vehicle Details */}
                    <p className="text-sm text-slate-500 mt-1">
                        {typeInfo.label}
                        {vehicle.year && ` • ${vehicle.year}`}
                        {vehicle.make && ` ${vehicle.make}`}
                        {vehicle.model && ` ${vehicle.model}`}
                        {vehicle.licensePlate && ` • ${vehicle.licensePlate}`}
                    </p>

                    {/* Equipment preview */}
                    {equipmentPreview.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {equipmentPreview.map(eq => (
                                <span key={eq} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                    {eq}
                                </span>
                            ))}
                            {moreEquipment > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                                    +{moreEquipment} more
                                </span>
                            )}
                        </div>
                    )}

                    {/* Assigned Tech */}
                    {assignedTech && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                            <User size={12} />
                            <span>Assigned to {assignedTech.name}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => onEdit(vehicle)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit vehicle"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete vehicle"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-2">Delete {vehicle.name}?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onDelete(vehicle.id);
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

export const VehicleManagement = ({
    contractorId,
    vehicles = [],
    teamMembers = [],
    onUpdate
}) => {
    const [localVehicles, setLocalVehicles] = useState(vehicles);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync with props
    useEffect(() => {
        setLocalVehicles(vehicles);
    }, [vehicles]);

    // Get maintenance alerts
    const maintenanceAlerts = localVehicles.filter(v => {
        const status = checkMaintenanceNeeded(v);
        return status.needed;
    });

    const handleSaveVehicle = async (vehicleData) => {
        setIsSaving(true);
        try {
            if (editingVehicle) {
                // Update existing
                await updateVehicle(contractorId, vehicleData.id, vehicleData);
                setLocalVehicles(prev =>
                    prev.map(v => v.id === vehicleData.id ? vehicleData : v)
                );
                toast.success('Vehicle updated');
            } else {
                // Create new
                const newVehicle = await createVehicle(contractorId, vehicleData);
                setLocalVehicles(prev => [...prev, newVehicle]);
                toast.success('Vehicle added to fleet');
            }

            setEditingVehicle(null);
            setIsAddingNew(false);
            onUpdate?.(localVehicles);
        } catch (error) {
            console.error('Error saving vehicle:', error);
            toast.error('Failed to save vehicle');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteVehicle = async (vehicleId) => {
        try {
            await deleteVehicle(contractorId, vehicleId);
            setLocalVehicles(prev => prev.filter(v => v.id !== vehicleId));
            toast.success('Vehicle removed');
            onUpdate?.(localVehicles.filter(v => v.id !== vehicleId));
        } catch (error) {
            console.error('Error deleting vehicle:', error);
            toast.error('Failed to delete vehicle');
        }
    };

    // Stats
    const stats = {
        total: localVehicles.length,
        available: localVehicles.filter(v => v.status === 'available').length,
        inUse: localVehicles.filter(v => v.status === 'in_use').length,
        maintenance: localVehicles.filter(v => v.status === 'maintenance').length
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Truck size={20} />
                        Service Vehicles
                    </h3>
                    <p className="text-sm text-slate-500">
                        {stats.total} vehicle{stats.total !== 1 ? 's' : ''} • {stats.available} available
                    </p>
                </div>
                <button
                    onClick={() => setIsAddingNew(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                >
                    <Plus size={18} />
                    Add Vehicle
                </button>
            </div>

            {/* Maintenance Alerts */}
            {maintenanceAlerts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
                        <AlertTriangle size={16} />
                        Maintenance Needed
                    </div>
                    <p className="text-xs text-amber-600">
                        {maintenanceAlerts.length} vehicle{maintenanceAlerts.length !== 1 ? 's' : ''} may need service: {' '}
                        {maintenanceAlerts.map(v => v.name).join(', ')}
                    </p>
                </div>
            )}

            {/* Vehicle List */}
            {localVehicles.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <Truck className="mx-auto text-slate-300 mb-3" size={40} />
                    <p className="text-slate-600 font-medium mb-2">No vehicles yet</p>
                    <p className="text-sm text-slate-400 mb-4">
                        Add service vehicles to track equipment and enable smart dispatch
                    </p>
                    <button
                        onClick={() => setIsAddingNew(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors"
                    >
                        Add Your First Vehicle
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {localVehicles.map(vehicle => (
                        <VehicleCard
                            key={vehicle.id}
                            vehicle={vehicle}
                            teamMembers={teamMembers}
                            onEdit={(v) => setEditingVehicle(v)}
                            onDelete={handleDeleteVehicle}
                        />
                    ))}
                </div>
            )}

            {/* Stats Summary */}
            {localVehicles.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-2">
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                        <p className="text-lg font-bold text-slate-700">{stats.total}</p>
                        <p className="text-xs text-slate-500">Total</p>
                    </div>
                    <div className="text-center p-2 bg-emerald-50 rounded-lg">
                        <p className="text-lg font-bold text-emerald-700">{stats.available}</p>
                        <p className="text-xs text-emerald-500">Available</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                        <p className="text-lg font-bold text-blue-700">{stats.inUse}</p>
                        <p className="text-xs text-blue-500">In Use</p>
                    </div>
                    <div className="text-center p-2 bg-amber-50 rounded-lg">
                        <p className="text-lg font-bold text-amber-700">{stats.maintenance}</p>
                        <p className="text-xs text-amber-500">Maintenance</p>
                    </div>
                </div>
            )}

            {/* Editor Modal */}
            {(editingVehicle || isAddingNew) && (
                <VehicleEditorModal
                    vehicle={editingVehicle}
                    teamMembers={teamMembers}
                    isNew={isAddingNew}
                    onSave={handleSaveVehicle}
                    onClose={() => {
                        setEditingVehicle(null);
                        setIsAddingNew(false);
                    }}
                />
            )}
        </div>
    );
};

export default VehicleManagement;
