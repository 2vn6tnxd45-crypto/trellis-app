// src/features/contractor-pro/components/CrewAssignmentModal.jsx
// ============================================
// CREW ASSIGNMENT MODAL
// ============================================
// Select multiple technicians for a job with roles

import React, { useState, useMemo } from 'react';
import {
    X, Users, Plus, Trash2, CheckCircle,
    AlertCircle, Sparkles, ChevronDown, ChevronUp,
    Award, Save, Loader2
} from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import toast from 'react-hot-toast';
import {
    CREW_ROLES,
    legacyToCrewFormat,
    assignCrewToJob,
    suggestCrewForJob,
    checkCrewConflicts
} from '../lib/crewService';

// ============================================
// TECH SELECTOR ROW
// ============================================

const TechSelectorRow = ({
    member,
    index,
    availableTechs,
    vehicles,
    selectedTechIds,
    onUpdate,
    onRemove,
    isLead
}) => {
    const tech = availableTechs.find(t => t.id === member.techId);

    return (
        <div className={`p-3 rounded-xl border-2 transition-all ${
            isLead ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
        }`}>
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: member.color || tech?.color || '#64748B' }}
                >
                    {member.techName?.charAt(0) || '?'}
                </div>

                {/* Tech Selector */}
                <div className="flex-1 min-w-0">
                    <Select
                        value={member.techId}
                        onChange={(newTechId) => {
                            const newTech = availableTechs.find(t => t.id === newTechId);
                            if (newTech) {
                                onUpdate({
                                    ...member,
                                    techId: newTech.id,
                                    techName: newTech.name,
                                    color: newTech.color
                                });
                            }
                        }}
                        options={availableTechs
                            .filter(t => t.id === member.techId || !selectedTechIds.includes(t.id))
                            .map(t => ({
                                value: t.id,
                                label: t.name
                            }))}
                        placeholder="Select technician..."
                    />
                </div>

                {/* Role Selector */}
                <div className="w-32">
                    <Select
                        value={member.role}
                        onChange={(newRole) => onUpdate({ ...member, role: newRole })}
                        options={CREW_ROLES.map(r => ({ value: r.id, label: r.label }))}
                    />
                </div>

                {/* Vehicle Selector (optional) */}
                {vehicles.length > 0 && (
                    <div className="w-32">
                        <Select
                            value={member.vehicleId || ''}
                            onChange={(vehicleId) => {
                                const vehicle = vehicles.find(v => v.id === vehicleId);
                                onUpdate({
                                    ...member,
                                    vehicleId: vehicle?.id || null,
                                    vehicleName: vehicle?.name || null
                                });
                            }}
                            options={[
                                { value: '', label: 'No vehicle' },
                                ...vehicles.map(v => ({ value: v.id, label: v.name }))
                            ]}
                        />
                    </div>
                )}

                {/* Remove Button */}
                <button
                    onClick={() => onRemove(index)}
                    className="p-2 rounded-lg transition-colors text-slate-400 hover:text-red-500 hover:bg-red-50"
                    title="Remove from crew"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Role badge */}
            {isLead && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                    <Award size={12} />
                    <span>Lead Technician - Primary contact for customer</span>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN MODAL
// ============================================

export const CrewAssignmentModal = ({
    job,
    teamMembers = [],
    vehicles = [],
    existingJobs = [],
    onSave,
    onClose
}) => {
    // Initialize crew from job (supporting legacy format)
    const initialCrew = useMemo(() => {
        const existing = legacyToCrewFormat(job);
        if (existing.length > 0) return existing;

        // Start with empty crew member slot
        return [{ techId: '', techName: '', role: 'lead', vehicleId: null, vehicleName: null, color: '#64748B' }];
    }, [job]);

    const [crew, setCrew] = useState(initialCrew);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Get scheduled date
    const scheduledDate = useMemo(() => {
        if (!job.scheduledDate) return new Date();
        return job.scheduledDate.toDate ? job.scheduledDate.toDate() : new Date(job.scheduledDate);
    }, [job]);

    // Selected tech IDs (for preventing duplicates)
    const selectedTechIds = useMemo(() =>
        crew.filter(m => m.techId).map(m => m.techId),
        [crew]
    );

    // Available techs (those not already on another job at same time)
    const availableTechs = useMemo(() => {
        return teamMembers.filter(tech => {
            // Check if working that day
            const dayName = scheduledDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const hours = tech.workingHours?.[dayName];
            return hours?.enabled !== false;
        });
    }, [teamMembers, scheduledDate]);

    // AI Suggestions
    const suggestions = useMemo(() => {
        if (!showSuggestions) return null;
        return suggestCrewForJob(job, teamMembers, existingJobs, scheduledDate);
    }, [job, teamMembers, existingJobs, scheduledDate, showSuggestions]);

    // Conflict checking
    const conflicts = useMemo(() => {
        const validCrew = crew.filter(m => m.techId);
        if (validCrew.length === 0) return { hasConflicts: false, conflicts: [] };
        return checkCrewConflicts(validCrew, existingJobs, scheduledDate, teamMembers);
    }, [crew, existingJobs, scheduledDate, teamMembers]);

    // Handlers
    const handleAddMember = () => {
        setCrew(prev => [
            ...prev,
            { techId: '', techName: '', role: 'helper', vehicleId: null, vehicleName: null, color: '#64748B' }
        ]);
    };

    const handleUpdateMember = (index, updatedMember) => {
        setCrew(prev => prev.map((m, i) => i === index ? updatedMember : m));
    };

    const handleRemoveMember = (index) => {
        if (crew.length <= 1) {
            toast.error("Crew must have at least one member");
            return;
        }

        const removedWasLead = crew[index].role === 'lead';
        let newCrew = crew.filter((_, i) => i !== index);

        // If we removed the lead, promote first remaining member
        if (removedWasLead && newCrew.length > 0) {
            newCrew[0] = { ...newCrew[0], role: 'lead' };
        }

        setCrew(newCrew);
    };

    const handleApplySuggestions = () => {
        if (suggestions?.suggestedCrew?.length > 0) {
            setCrew(suggestions.suggestedCrew);
            setShowSuggestions(false);
            toast.success('AI suggestions applied');
        }
    };

    const handleSave = async () => {
        // Validate
        const validCrew = crew.filter(m => m.techId);
        if (validCrew.length === 0) {
            toast.error('Select at least one technician');
            return;
        }

        // Check for errors (not warnings)
        if (conflicts.hasErrors) {
            toast.error('Cannot assign: ' + conflicts.conflicts.find(c => c.severity === 'error')?.message);
            return;
        }

        setIsSaving(true);
        try {
            await assignCrewToJob(job.id, validCrew, 'manual');
            toast.success(`Crew of ${validCrew.length} assigned`);
            onSave?.(validCrew);
            onClose();
        } catch (error) {
            console.error('Failed to assign crew:', error);
            toast.error('Failed to assign crew');
        } finally {
            setIsSaving(false);
        }
    };

    // Job info
    const jobTitle = job.title || job.serviceType || job.description || 'Job';
    const customerName = job.customer?.name || job.customerName || 'Customer';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Users size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Assign Crew</h2>
                            <p className="text-emerald-100 text-sm">{jobTitle} • {customerName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* AI Suggestions Toggle */}
                    <div className="mb-4">
                        <button
                            onClick={() => setShowSuggestions(!showSuggestions)}
                            className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        >
                            <Sparkles size={16} />
                            {showSuggestions ? 'Hide AI Suggestions' : 'Get AI Suggestions'}
                            {showSuggestions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showSuggestions && suggestions && (
                            <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-emerald-800">AI Recommendation</h4>
                                    <button
                                        onClick={handleApplySuggestions}
                                        disabled={suggestions.suggestedCrew.length === 0}
                                        className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                        Apply
                                    </button>
                                </div>
                                <ul className="space-y-1 text-sm text-emerald-700">
                                    {suggestions.reasoning.map((reason, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle size={14} className="mt-0.5 shrink-0" />
                                            {reason}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Crew Members */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Crew Members ({crew.filter(m => m.techId).length})</h3>
                            <button
                                onClick={handleAddMember}
                                disabled={crew.length >= teamMembers.length}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
                            >
                                <Plus size={16} />
                                Add Tech
                            </button>
                        </div>

                        {crew.map((member, index) => (
                            <TechSelectorRow
                                key={index}
                                member={member}
                                index={index}
                                availableTechs={availableTechs}
                                vehicles={vehicles}
                                selectedTechIds={selectedTechIds}
                                onUpdate={(updated) => handleUpdateMember(index, updated)}
                                onRemove={handleRemoveMember}
                                isLead={member.role === 'lead'}
                            />
                        ))}
                    </div>

                    {/* Conflicts Warning */}
                    {conflicts.hasConflicts && (
                        <div className={`mt-4 p-3 rounded-xl ${
                            conflicts.hasErrors ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                        }`}>
                            <div className={`flex items-center gap-2 font-medium text-sm mb-1 ${
                                conflicts.hasErrors ? 'text-red-700' : 'text-amber-700'
                            }`}>
                                <AlertCircle size={16} />
                                {conflicts.hasErrors ? 'Cannot Assign' : 'Warnings'}
                            </div>
                            <ul className={`text-sm space-y-1 ${
                                conflicts.hasErrors ? 'text-red-600' : 'text-amber-600'
                            }`}>
                                {conflicts.conflicts.map((c, i) => (
                                    <li key={i}>• {c.message}</li>
                                ))}
                            </ul>
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
                        disabled={isSaving || crew.filter(m => m.techId).length === 0 || conflicts.hasErrors}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Assign Crew ({crew.filter(m => m.techId).length})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CrewAssignmentModal;
