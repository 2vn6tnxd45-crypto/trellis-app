// src/features/contractor-pro/lib/teamService.js
// ============================================
// TEAM MANAGEMENT SERVICE
// ============================================
// Manages team members (technicians) with skills, certifications, and availability
// Quick Win #1: Skills/Certifications support built-in

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';

// Collection paths
const CONTRACTORS_COLLECTION = 'contractors';
const TEAM_SUBCOLLECTION = 'team';

// ============================================
// SKILL & CERTIFICATION CONSTANTS
// ============================================

// Common trade skills
export const SKILL_CATEGORIES = {
    HVAC: 'hvac',
    PLUMBING: 'plumbing',
    ELECTRICAL: 'electrical',
    APPLIANCE: 'appliance',
    GENERAL: 'general'
};

export const COMMON_SKILLS = {
    [SKILL_CATEGORIES.HVAC]: [
        { id: 'hvac_install', name: 'HVAC Installation', level: 'advanced' },
        { id: 'hvac_repair', name: 'HVAC Repair', level: 'intermediate' },
        { id: 'hvac_maintenance', name: 'HVAC Maintenance', level: 'basic' },
        { id: 'ductwork', name: 'Ductwork', level: 'intermediate' },
        { id: 'refrigerant', name: 'Refrigerant Handling', level: 'advanced' },
        { id: 'heat_pump', name: 'Heat Pump Systems', level: 'advanced' },
        { id: 'mini_split', name: 'Mini-Split Installation', level: 'intermediate' }
    ],
    [SKILL_CATEGORIES.PLUMBING]: [
        { id: 'plumbing_repair', name: 'Plumbing Repair', level: 'intermediate' },
        { id: 'water_heater', name: 'Water Heater Install/Repair', level: 'intermediate' },
        { id: 'drain_cleaning', name: 'Drain Cleaning', level: 'basic' },
        { id: 'pipe_replacement', name: 'Pipe Replacement', level: 'advanced' },
        { id: 'gas_lines', name: 'Gas Line Work', level: 'advanced' }
    ],
    [SKILL_CATEGORIES.ELECTRICAL]: [
        { id: 'electrical_repair', name: 'Electrical Repair', level: 'intermediate' },
        { id: 'panel_work', name: 'Panel Upgrades', level: 'advanced' },
        { id: 'wiring', name: 'Wiring', level: 'intermediate' },
        { id: 'ev_charger', name: 'EV Charger Installation', level: 'advanced' }
    ],
    [SKILL_CATEGORIES.APPLIANCE]: [
        { id: 'appliance_repair', name: 'Appliance Repair', level: 'intermediate' },
        { id: 'appliance_install', name: 'Appliance Installation', level: 'basic' }
    ],
    [SKILL_CATEGORIES.GENERAL]: [
        { id: 'diagnostics', name: 'Diagnostics', level: 'intermediate' },
        { id: 'customer_service', name: 'Customer Service', level: 'basic' },
        { id: 'training', name: 'Can Train Others', level: 'advanced' }
    ]
};

// Common certifications
export const COMMON_CERTIFICATIONS = [
    { id: 'epa_608', name: 'EPA 608 Certification', category: 'hvac', required: true },
    { id: 'nate', name: 'NATE Certified', category: 'hvac', required: false },
    { id: 'epa_608_universal', name: 'EPA 608 Universal', category: 'hvac', required: false },
    { id: 'r410a', name: 'R-410A Certified', category: 'hvac', required: false },
    { id: 'journeyman_plumber', name: 'Journeyman Plumber License', category: 'plumbing', required: true },
    { id: 'master_plumber', name: 'Master Plumber License', category: 'plumbing', required: false },
    { id: 'journeyman_electrician', name: 'Journeyman Electrician License', category: 'electrical', required: true },
    { id: 'master_electrician', name: 'Master Electrician License', category: 'electrical', required: false },
    { id: 'osha_10', name: 'OSHA 10', category: 'general', required: false },
    { id: 'osha_30', name: 'OSHA 30', category: 'general', required: false },
    { id: 'cpr_first_aid', name: 'CPR/First Aid', category: 'general', required: false }
];

// ============================================
// TEAM MEMBER CRUD
// ============================================

/**
 * Add a team member with skills and certifications
 */
export const addTeamMember = async (contractorId, memberData) => {
    try {
        const memberRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION));

        const member = {
            // Basic info
            name: memberData.name || '',
            email: memberData.email || '',
            phone: memberData.phone || '',
            role: memberData.role || 'technician', // technician, lead, manager

            // Quick Win #1: Skills & Certifications
            skills: memberData.skills || [], // Array of skill IDs with proficiency
            certifications: memberData.certifications || [], // Array of certification objects

            // Example skills format:
            // [{ skillId: 'hvac_install', proficiency: 'expert', yearsExperience: 5 }]

            // Example certifications format:
            // [{ certId: 'epa_608', expiresAt: '2025-12-31', verified: true }]

            // Availability
            isActive: memberData.isActive !== false,
            workingHours: memberData.workingHours || {
                monday: { start: '08:00', end: '17:00', available: true },
                tuesday: { start: '08:00', end: '17:00', available: true },
                wednesday: { start: '08:00', end: '17:00', available: true },
                thursday: { start: '08:00', end: '17:00', available: true },
                friday: { start: '08:00', end: '17:00', available: true },
                saturday: { start: null, end: null, available: false },
                sunday: { start: null, end: null, available: false }
            },

            // Time off / unavailability
            timeOff: memberData.timeOff || [], // [{ startDate, endDate, reason }]

            // Location / routing
            homeBase: memberData.homeBase || null, // { address, lat, lng }
            maxDriveTimeMinutes: memberData.maxDriveTimeMinutes || 60,

            // Performance tracking
            stats: {
                totalJobs: 0,
                completedJobs: 0,
                averageRating: 0,
                firstTimeFixRate: 0,
                onTimeRate: 0
            },

            // Hourly rate (for profitability tracking)
            hourlyRate: memberData.hourlyRate || 0,

            // Metadata
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(memberRef, member);

        return {
            success: true,
            memberId: memberRef.id
        };
    } catch (error) {
        console.error('Error adding team member:', error);
        throw error;
    }
};

/**
 * Update team member
 */
export const updateTeamMember = async (contractorId, memberId, updates) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);

        await updateDoc(memberRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error updating team member:', error);
        throw error;
    }
};

/**
 * Get team member by ID
 */
export const getTeamMember = async (contractorId, memberId) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
            return null;
        }

        return { id: memberSnap.id, ...memberSnap.data() };
    } catch (error) {
        console.error('Error getting team member:', error);
        throw error;
    }
};

/**
 * Get all team members
 */
export const getTeamMembers = async (contractorId, options = {}) => {
    try {
        const { activeOnly = true } = options;

        let q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION),
            orderBy('name')
        );

        const snapshot = await getDocs(q);
        let members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (activeOnly) {
            members = members.filter(m => m.isActive);
        }

        return members;
    } catch (error) {
        console.error('Error getting team members:', error);
        throw error;
    }
};

/**
 * Subscribe to team members for real-time updates
 */
export const subscribeToTeam = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION),
        orderBy('name')
    );

    return onSnapshot(q, (snapshot) => {
        const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(members);
    }, (error) => {
        console.error('Team subscription error:', error);
    });
};

/**
 * Delete team member
 */
export const deleteTeamMember = async (contractorId, memberId) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);
        await deleteDoc(memberRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting team member:', error);
        throw error;
    }
};

// ============================================
// SKILLS & CERTIFICATIONS MANAGEMENT
// ============================================

/**
 * Add skill to team member
 */
export const addSkillToMember = async (contractorId, memberId, skill) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
            throw new Error('Team member not found');
        }

        const currentSkills = memberSnap.data().skills || [];

        // Check if skill already exists
        const existingIndex = currentSkills.findIndex(s => s.skillId === skill.skillId);

        if (existingIndex >= 0) {
            // Update existing skill
            currentSkills[existingIndex] = { ...currentSkills[existingIndex], ...skill };
        } else {
            // Add new skill
            currentSkills.push({
                skillId: skill.skillId,
                proficiency: skill.proficiency || 'intermediate', // beginner, intermediate, advanced, expert
                yearsExperience: skill.yearsExperience || 0,
                addedAt: new Date().toISOString()
            });
        }

        await updateDoc(memberRef, {
            skills: currentSkills,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error adding skill:', error);
        throw error;
    }
};

/**
 * Add certification to team member
 */
export const addCertificationToMember = async (contractorId, memberId, certification) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
            throw new Error('Team member not found');
        }

        const currentCerts = memberSnap.data().certifications || [];

        // Check if certification already exists
        const existingIndex = currentCerts.findIndex(c => c.certId === certification.certId);

        if (existingIndex >= 0) {
            // Update existing certification
            currentCerts[existingIndex] = { ...currentCerts[existingIndex], ...certification };
        } else {
            // Add new certification
            currentCerts.push({
                certId: certification.certId,
                name: certification.name,
                issuedAt: certification.issuedAt || new Date().toISOString(),
                expiresAt: certification.expiresAt || null,
                certificateNumber: certification.certificateNumber || null,
                verified: certification.verified || false,
                verifiedAt: null
            });
        }

        await updateDoc(memberRef, {
            certifications: currentCerts,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error adding certification:', error);
        throw error;
    }
};

/**
 * Remove skill from team member
 */
export const removeSkillFromMember = async (contractorId, memberId, skillId) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
            throw new Error('Team member not found');
        }

        const currentSkills = memberSnap.data().skills || [];
        const updatedSkills = currentSkills.filter(s => s.skillId !== skillId);

        await updateDoc(memberRef, {
            skills: updatedSkills,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error removing skill:', error);
        throw error;
    }
};

// ============================================
// AVAILABILITY MANAGEMENT
// ============================================

/**
 * Add time off for a team member
 */
export const addTimeOff = async (contractorId, memberId, timeOffData) => {
    try {
        const memberRef = doc(db, CONTRACTORS_COLLECTION, contractorId, TEAM_SUBCOLLECTION, memberId);
        const memberSnap = await getDoc(memberRef);

        if (!memberSnap.exists()) {
            throw new Error('Team member not found');
        }

        const currentTimeOff = memberSnap.data().timeOff || [];

        currentTimeOff.push({
            id: `pto_${Date.now()}`,
            startDate: timeOffData.startDate,
            endDate: timeOffData.endDate,
            reason: timeOffData.reason || 'Time off',
            approved: timeOffData.approved || false,
            createdAt: new Date().toISOString()
        });

        await updateDoc(memberRef, {
            timeOff: currentTimeOff,
            updatedAt: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error adding time off:', error);
        throw error;
    }
};

/**
 * Check if team member is available on a specific date/time
 */
export const checkMemberAvailability = (member, date, startTime, endTime) => {
    if (!member.isActive) {
        return { available: false, reason: 'Team member is inactive' };
    }

    // Check time off
    const checkDate = new Date(date);
    for (const pto of (member.timeOff || [])) {
        const ptoStart = new Date(pto.startDate);
        const ptoEnd = new Date(pto.endDate);
        if (checkDate >= ptoStart && checkDate <= ptoEnd) {
            return { available: false, reason: `Time off: ${pto.reason}` };
        }
    }

    // Check working hours
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[checkDate.getDay()];
    const workingHours = member.workingHours?.[dayName];

    if (!workingHours?.available) {
        return { available: false, reason: `Not scheduled to work on ${dayName}` };
    }

    // Check if requested time is within working hours
    if (startTime && workingHours.start && startTime < workingHours.start) {
        return { available: false, reason: `Starts before working hours (${workingHours.start})` };
    }

    if (endTime && workingHours.end && endTime > workingHours.end) {
        return { available: false, reason: `Ends after working hours (${workingHours.end})` };
    }

    return { available: true, reason: null };
};

// ============================================
// CONSTRAINT MATCHING (For Scheduling Engine)
// ============================================

/**
 * Check if team member has required skills for a job
 */
export const memberHasRequiredSkills = (member, requiredSkills) => {
    if (!requiredSkills || requiredSkills.length === 0) {
        return { hasSkills: true, missingSkills: [] };
    }

    const memberSkillIds = (member.skills || []).map(s => s.skillId);
    const missingSkills = requiredSkills.filter(skill => !memberSkillIds.includes(skill));

    return {
        hasSkills: missingSkills.length === 0,
        missingSkills
    };
};

/**
 * Check if team member has required certifications for a job
 */
export const memberHasRequiredCertifications = (member, requiredCerts) => {
    if (!requiredCerts || requiredCerts.length === 0) {
        return { hasCerts: true, missingCerts: [], expiredCerts: [] };
    }

    const memberCerts = member.certifications || [];
    const now = new Date();
    const missingCerts = [];
    const expiredCerts = [];

    for (const reqCert of requiredCerts) {
        const memberCert = memberCerts.find(c => c.certId === reqCert);

        if (!memberCert) {
            missingCerts.push(reqCert);
        } else if (memberCert.expiresAt && new Date(memberCert.expiresAt) < now) {
            expiredCerts.push(reqCert);
        }
    }

    return {
        hasCerts: missingCerts.length === 0 && expiredCerts.length === 0,
        missingCerts,
        expiredCerts
    };
};

/**
 * Find eligible techs for a job based on skills, certs, and availability
 */
export const findEligibleTechs = async (contractorId, jobRequirements) => {
    try {
        const members = await getTeamMembers(contractorId, { activeOnly: true });
        const eligibleTechs = [];

        for (const member of members) {
            // Check availability
            const availability = checkMemberAvailability(
                member,
                jobRequirements.date,
                jobRequirements.startTime,
                jobRequirements.endTime
            );

            if (!availability.available) {
                continue;
            }

            // Check skills
            const skillCheck = memberHasRequiredSkills(member, jobRequirements.requiredSkills);
            if (!skillCheck.hasSkills) {
                continue;
            }

            // Check certifications
            const certCheck = memberHasRequiredCertifications(member, jobRequirements.requiredCertifications);
            if (!certCheck.hasCerts) {
                continue;
            }

            // Tech is eligible
            eligibleTechs.push({
                ...member,
                matchScore: calculateMatchScore(member, jobRequirements)
            });
        }

        // Sort by match score (highest first)
        eligibleTechs.sort((a, b) => b.matchScore - a.matchScore);

        return eligibleTechs;
    } catch (error) {
        console.error('Error finding eligible techs:', error);
        throw error;
    }
};

/**
 * Calculate how well a tech matches a job (for sorting/recommendations)
 */
const calculateMatchScore = (member, jobRequirements) => {
    let score = 0;

    // Score based on skill proficiency
    for (const reqSkill of (jobRequirements.requiredSkills || [])) {
        const memberSkill = (member.skills || []).find(s => s.skillId === reqSkill);
        if (memberSkill) {
            const proficiencyScores = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
            score += proficiencyScores[memberSkill.proficiency] || 1;
            score += Math.min(memberSkill.yearsExperience || 0, 10) * 0.5;
        }
    }

    // Bonus for first-time fix rate
    score += (member.stats?.firstTimeFixRate || 0) * 10;

    // Bonus for on-time rate
    score += (member.stats?.onTimeRate || 0) * 5;

    // Bonus for higher rating
    score += (member.stats?.averageRating || 0) * 2;

    return score;
};

export default {
    SKILL_CATEGORIES,
    COMMON_SKILLS,
    COMMON_CERTIFICATIONS,
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
    checkMemberAvailability,
    memberHasRequiredSkills,
    memberHasRequiredCertifications,
    findEligibleTechs
};
