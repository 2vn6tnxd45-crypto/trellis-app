// src/features/contractor-pro/hooks/useTeam.js
// ============================================
// TEAM MANAGEMENT HOOK
// ============================================
// React hook for managing team members with skills and certifications
// Quick Win #1: Skills/Certifications support

import { useState, useEffect, useCallback } from 'react';
import {
    addTeamMember,
    updateTeamMember,
    getTeamMember,
    getTeamMembers,
    subscribeToTeam,
    deleteTeamMember,
    addSkillToMember,
    addCertificationToMember,
    removeSkillFromMember,
    addTimeOff,
    findEligibleTechs,
    SKILL_CATEGORIES,
    COMMON_SKILLS,
    COMMON_CERTIFICATIONS
} from '../lib/teamService';

/**
 * Hook for managing team members
 */
export const useTeam = (contractorId, options = {}) => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { realtime = true, activeOnly = true } = options;

    useEffect(() => {
        if (!contractorId) {
            setLoading(false);
            return;
        }

        if (realtime) {
            const unsubscribe = subscribeToTeam(
                contractorId,
                (data) => {
                    const filtered = activeOnly ? data.filter(m => m.isActive) : data;
                    setMembers(filtered);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } else {
            const fetch = async () => {
                try {
                    const data = await getTeamMembers(contractorId, { activeOnly });
                    setMembers(data);
                } catch (err) {
                    console.error('Error fetching team:', err);
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };

            fetch();
        }
    }, [contractorId, realtime, activeOnly]);

    // Add member
    const add = useCallback(async (memberData) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await addTeamMember(contractorId, memberData);
    }, [contractorId]);

    // Update member
    const update = useCallback(async (memberId, updates) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await updateTeamMember(contractorId, memberId, updates);
    }, [contractorId]);

    // Delete member
    const remove = useCallback(async (memberId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await deleteTeamMember(contractorId, memberId);
    }, [contractorId]);

    // Add skill to member
    const addSkill = useCallback(async (memberId, skill) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await addSkillToMember(contractorId, memberId, skill);
    }, [contractorId]);

    // Add certification to member
    const addCert = useCallback(async (memberId, certification) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await addCertificationToMember(contractorId, memberId, certification);
    }, [contractorId]);

    // Remove skill from member
    const removeSkill = useCallback(async (memberId, skillId) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await removeSkillFromMember(contractorId, memberId, skillId);
    }, [contractorId]);

    // Add time off
    const addPTO = useCallback(async (memberId, timeOffData) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await addTimeOff(contractorId, memberId, timeOffData);
    }, [contractorId]);

    // Find eligible techs for a job
    const findEligible = useCallback(async (jobRequirements) => {
        if (!contractorId) throw new Error('Contractor not authenticated');
        return await findEligibleTechs(contractorId, jobRequirements);
    }, [contractorId]);

    // Derived stats
    const stats = {
        total: members.length,
        active: members.filter(m => m.isActive).length,
        technicians: members.filter(m => m.role === 'technician').length,
        leads: members.filter(m => m.role === 'lead').length,
        managers: members.filter(m => m.role === 'manager').length
    };

    // Get all unique skills across team
    const teamSkills = [...new Set(
        members.flatMap(m => (m.skills || []).map(s => s.skillId))
    )];

    // Get all unique certifications across team
    const teamCertifications = [...new Set(
        members.flatMap(m => (m.certifications || []).map(c => c.certId))
    )];

    // Find members by skill
    const bySkill = (skillId) => members.filter(m =>
        (m.skills || []).some(s => s.skillId === skillId)
    );

    // Find members by certification
    const byCertification = (certId) => members.filter(m =>
        (m.certifications || []).some(c => c.certId === certId)
    );

    // Get member by ID
    const getMember = (memberId) => members.find(m => m.id === memberId);

    return {
        members,
        loading,
        error,
        stats,
        // Actions
        add,
        update,
        remove,
        addSkill,
        addCert,
        removeSkill,
        addPTO,
        findEligible,
        // Helpers
        teamSkills,
        teamCertifications,
        bySkill,
        byCertification,
        getMember,
        // Constants
        SKILL_CATEGORIES,
        COMMON_SKILLS,
        COMMON_CERTIFICATIONS
    };
};

/**
 * Hook for a single team member
 */
export const useTeamMember = (contractorId, memberId) => {
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!contractorId || !memberId) {
            setLoading(false);
            return;
        }

        const fetch = async () => {
            try {
                const data = await getTeamMember(contractorId, memberId);
                setMember(data);
            } catch (err) {
                console.error('Error fetching team member:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetch();
    }, [contractorId, memberId]);

    // Check if member has a specific skill
    const hasSkill = useCallback((skillId) => {
        return (member?.skills || []).some(s => s.skillId === skillId);
    }, [member]);

    // Check if member has a specific certification
    const hasCertification = useCallback((certId) => {
        return (member?.certifications || []).some(c => c.certId === certId);
    }, [member]);

    // Get skill proficiency
    const getSkillProficiency = useCallback((skillId) => {
        const skill = (member?.skills || []).find(s => s.skillId === skillId);
        return skill?.proficiency || null;
    }, [member]);

    // Check for expired certifications
    const expiredCerts = (member?.certifications || []).filter(c => {
        if (!c.expiresAt) return false;
        return new Date(c.expiresAt) < new Date();
    });

    // Check for expiring soon (within 30 days)
    const expiringSoonCerts = (member?.certifications || []).filter(c => {
        if (!c.expiresAt) return false;
        const expiryDate = new Date(c.expiresAt);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        return expiryDate > new Date() && expiryDate < thirtyDaysFromNow;
    });

    return {
        member,
        loading,
        error,
        hasSkill,
        hasCertification,
        getSkillProficiency,
        expiredCerts,
        expiringSoonCerts
    };
};

export default {
    useTeam,
    useTeamMember
};
