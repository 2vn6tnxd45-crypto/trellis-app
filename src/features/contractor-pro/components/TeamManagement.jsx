// src/features/contractor-pro/components/TeamManagement.jsx
// ============================================
// TEAM MANAGEMENT COMPONENT
// ============================================
// Quick Win #1: Manage team members with skills and certifications

import React, { useState } from 'react';
import {
    Users, Plus, X, Award, Briefcase, Clock, MapPin,
    ChevronDown, ChevronUp, Check, AlertTriangle, Edit2, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTeam } from '../hooks/useTeam';

// ============================================
// SKILL BADGE
// ============================================
const SkillBadge = ({ skill, onRemove }) => {
    const proficiencyColors = {
        beginner: 'bg-slate-100 text-slate-700',
        intermediate: 'bg-blue-100 text-blue-700',
        advanced: 'bg-emerald-100 text-emerald-700',
        expert: 'bg-purple-100 text-purple-700'
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${proficiencyColors[skill.proficiency] || proficiencyColors.intermediate}`}>
            {skill.skillId.replace(/_/g, ' ')}
            {onRemove && (
                <button onClick={() => onRemove(skill.skillId)} className="ml-1 hover:text-red-600">
                    <X size={12} />
                </button>
            )}
        </span>
    );
};

// ============================================
// CERTIFICATION BADGE
// ============================================
const CertificationBadge = ({ cert }) => {
    const isExpired = cert.expiresAt && new Date(cert.expiresAt) < new Date();
    const isExpiringSoon = cert.expiresAt && !isExpired && new Date(cert.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isExpired
            ? 'bg-red-100 text-red-700'
            : isExpiringSoon
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}>
            <Award size={12} />
            {cert.name || cert.certId}
            {isExpired && <AlertTriangle size={12} />}
        </span>
    );
};

// ============================================
// TEAM MEMBER CARD
// ============================================
const TeamMemberCard = ({ member, onEdit, onDelete, onAddSkill, onRemoveSkill }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${member.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}>
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">{member.name}</h3>
                        <p className="text-sm text-slate-500 capitalize">{member.role}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onEdit(member)}
                        className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="px-4 pb-4 flex gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                    <Briefcase size={14} />
                    {member.stats?.completedJobs || 0} jobs
                </span>
                <span className="flex items-center gap-1">
                    <Clock size={14} />
                    ${member.hourlyRate || 0}/hr
                </span>
            </div>

            {/* Skills Preview */}
            <div className="px-4 pb-4 flex flex-wrap gap-2">
                {(member.skills || []).slice(0, 3).map(skill => (
                    <SkillBadge key={skill.skillId} skill={skill} />
                ))}
                {(member.skills?.length || 0) > 3 && (
                    <span className="text-xs text-slate-500">+{member.skills.length - 3} more</span>
                )}
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
                    {/* Contact */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Contact</h4>
                        <p className="text-sm text-slate-700">{member.email}</p>
                        <p className="text-sm text-slate-700">{member.phone}</p>
                    </div>

                    {/* All Skills */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Skills</h4>
                        <div className="flex flex-wrap gap-2">
                            {(member.skills || []).map(skill => (
                                <SkillBadge
                                    key={skill.skillId}
                                    skill={skill}
                                    onRemove={(skillId) => onRemoveSkill(member.id, skillId)}
                                />
                            ))}
                            <button
                                onClick={() => onAddSkill(member)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-600 hover:bg-slate-300"
                            >
                                <Plus size={12} /> Add
                            </button>
                        </div>
                    </div>

                    {/* Certifications */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Certifications</h4>
                        <div className="flex flex-wrap gap-2">
                            {(member.certifications || []).map(cert => (
                                <CertificationBadge key={cert.certId} cert={cert} />
                            ))}
                            {(member.certifications || []).length === 0 && (
                                <span className="text-sm text-slate-400">No certifications added</span>
                            )}
                        </div>
                    </div>

                    {/* Performance */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Performance</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Rating:</span>
                                <span className="ml-2 font-bold text-slate-700">
                                    {member.stats?.averageRating?.toFixed(1) || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-500">First-time fix:</span>
                                <span className="ml-2 font-bold text-slate-700">
                                    {member.stats?.firstTimeFixRate ? `${Math.round(member.stats.firstTimeFixRate * 100)}%` : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => onDelete(member.id)}
                            className="flex-1 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                            Remove from team
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// ADD MEMBER MODAL
// ============================================
const AddMemberModal = ({ isOpen, onClose, onSave, COMMON_SKILLS, COMMON_CERTIFICATIONS }) => {
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'technician',
        hourlyRate: '',
        selectedSkills: [],
        selectedCerts: []
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }

        await onSave({
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            hourlyRate: parseFloat(form.hourlyRate) || 0,
            skills: form.selectedSkills.map(s => ({
                skillId: s,
                proficiency: 'intermediate',
                yearsExperience: 0
            })),
            certifications: form.selectedCerts.map(c => ({
                certId: c,
                name: COMMON_CERTIFICATIONS.find(cert => cert.id === c)?.name || c
            }))
        });

        setForm({
            name: '',
            email: '',
            phone: '',
            role: 'technician',
            hourlyRate: '',
            selectedSkills: [],
            selectedCerts: []
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Add Team Member</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Basic Info */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            placeholder="John Smith"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="technician">Technician</option>
                                <option value="lead">Lead Tech</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate</label>
                            <input
                                type="number"
                                value={form.hourlyRate}
                                onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Skills Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Skills</label>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3 space-y-2">
                            {Object.entries(COMMON_SKILLS).map(([category, skills]) => (
                                <div key={category}>
                                    <p className="text-xs font-bold text-slate-500 uppercase">{category}</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {skills.map(skill => (
                                            <button
                                                key={skill.id}
                                                type="button"
                                                onClick={() => {
                                                    const isSelected = form.selectedSkills.includes(skill.id);
                                                    setForm({
                                                        ...form,
                                                        selectedSkills: isSelected
                                                            ? form.selectedSkills.filter(s => s !== skill.id)
                                                            : [...form.selectedSkills, skill.id]
                                                    });
                                                }}
                                                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${form.selectedSkills.includes(skill.id)
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {skill.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Certifications Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Certifications</label>
                        <div className="flex flex-wrap gap-2">
                            {COMMON_CERTIFICATIONS.slice(0, 8).map(cert => (
                                <button
                                    key={cert.id}
                                    type="button"
                                    onClick={() => {
                                        const isSelected = form.selectedCerts.includes(cert.id);
                                        setForm({
                                            ...form,
                                            selectedCerts: isSelected
                                                ? form.selectedCerts.filter(c => c !== cert.id)
                                                : [...form.selectedCerts, cert.id]
                                        });
                                    }}
                                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${form.selectedCerts.includes(cert.id)
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {cert.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                        >
                            Add Member
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const TeamManagement = ({ contractorId }) => {
    const {
        members,
        loading,
        error,
        stats,
        add,
        update,
        remove,
        addSkill,
        removeSkill,
        COMMON_SKILLS,
        COMMON_CERTIFICATIONS
    } = useTeam(contractorId);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);

    const handleAddMember = async (memberData) => {
        try {
            await add(memberData);
            toast.success('Team member added');
        } catch (err) {
            toast.error('Failed to add team member');
        }
    };

    const handleDeleteMember = async (memberId) => {
        if (!confirm('Remove this team member?')) return;
        try {
            await remove(memberId);
            toast.success('Team member removed');
        } catch (err) {
            toast.error('Failed to remove team member');
        }
    };

    const handleRemoveSkill = async (memberId, skillId) => {
        try {
            await removeSkill(memberId, skillId);
            toast.success('Skill removed');
        } catch (err) {
            toast.error('Failed to remove skill');
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Team</h1>
                    <p className="text-slate-500">{stats.active} active members</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2"
                >
                    <Plus size={18} />
                    Add Member
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Technicians</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.technicians}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Lead Techs</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.leads}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Managers</p>
                    <p className="text-2xl font-bold text-slate-800">{stats.managers}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-emerald-600">{stats.total}</p>
                </div>
            </div>

            {/* Team Members */}
            {members.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="font-bold text-slate-800 mb-2">No team members yet</h3>
                    <p className="text-slate-500 mb-4">Add your first team member to get started</p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700"
                    >
                        Add Member
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {members.map(member => (
                        <TeamMemberCard
                            key={member.id}
                            member={member}
                            onEdit={setEditingMember}
                            onDelete={handleDeleteMember}
                            onAddSkill={(m) => console.log('Add skill to', m.name)}
                            onRemoveSkill={handleRemoveSkill}
                        />
                    ))}
                </div>
            )}

            {/* Add Modal */}
            <AddMemberModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={handleAddMember}
                COMMON_SKILLS={COMMON_SKILLS}
                COMMON_CERTIFICATIONS={COMMON_CERTIFICATIONS}
            />
        </div>
    );
};

export default TeamManagement;
