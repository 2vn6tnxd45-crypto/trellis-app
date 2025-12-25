// src/lib/invitations.js
// Utility functions for contractor invitation system

import { 
    collection, 
    addDoc, 
    doc, 
    getDoc, 
    getDocs,
    updateDoc, 
    query, 
    where, 
    serverTimestamp,
    writeBatch 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { appId, INVITATIONS_COLLECTION_PATH } from '../config/constants';

// ============================================
// GENERATE SECURE TOKEN
// ============================================
export const generateSecureToken = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};

// ============================================
// CREATE INVITATION (Contractor Side)
// ============================================
/**
 * Creates a new contractor invitation with pre-populated records
 * @param {Object} contractorInfo - Contractor details (name, company, phone, email)
 * @param {Array} records - Array of record objects to pre-populate
 * @param {string|null} recipientEmail - Optional email lock for the invitation
 * @returns {Object} - { inviteId, claimToken, link }
 */
export const createContractorInvitation = async (contractorInfo, records, recipientEmail = null) => {
    const claimToken = generateSecureToken();
    
    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Prepare records with proper structure
    const preparedRecords = records.map(record => ({
        item: record.item || '',
        category: record.category || 'Other',
        area: record.area || 'General',
        brand: record.brand || '',
        model: record.model || '',
        serialNumber: record.serialNumber || '',
        dateInstalled: record.dateInstalled || new Date().toISOString().split('T')[0],
        cost: record.cost || null,
        laborCost: record.laborCost || null,
        partsCost: record.partsCost || null,
        warranty: record.warranty || '',
        notes: record.notes || '',
        maintenanceFrequency: record.maintenanceFrequency || 'annual',
        contractor: contractorInfo.company || contractorInfo.name || '',
        contractorPhone: contractorInfo.phone || '',
        contractorEmail: contractorInfo.email || '',
        attachments: record.attachments || [],
        // Metadata
        importedFrom: 'contractor_invitation'
    }));
    
    const inviteDoc = {
        claimToken,
        recipientEmail: recipientEmail?.toLowerCase().trim() || null,
        claimed: false,
        claimedBy: null,
        claimedAt: null,
        records: preparedRecords,
        contractorInfo: {
            name: contractorInfo.name || '',
            company: contractorInfo.company || '',
            phone: contractorInfo.phone || '',
            email: contractorInfo.email || ''
        },
        createdAt: serverTimestamp(),
        expiresAt: expiresAt
    };
    
    const inviteRef = await addDoc(collection(db, INVITATIONS_COLLECTION_PATH), inviteDoc);
    
    // Generate the claim link
    const baseUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}${window.location.pathname}`
        : '';
    
    return {
        inviteId: inviteRef.id,
        claimToken,
        link: `${baseUrl}?invite=${claimToken}`
    };
};

// ============================================
// VALIDATE INVITATION (Homeowner Side)
// ============================================
/**
 * Validates an invitation token and checks if it can be claimed
 * @param {string} token - The claim token from the URL
 * @param {string|null} userEmail - The email of the user trying to claim (if signed in)
 * @returns {Object} - { valid: boolean, invite?: Object, error?: string }
 */
export const validateInvitation = async (token) => {
    if (!token) {
        return { valid: false, error: 'no_token' };
    }
    
    try {
        const q = query(
            collection(db, INVITATIONS_COLLECTION_PATH),
            where('claimToken', '==', token)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { valid: false, error: 'not_found' };
        }
        
        const inviteDoc = snapshot.docs[0];
        const invite = { id: inviteDoc.id, ...inviteDoc.data() };
        
        // Check if already claimed
        if (invite.claimed) {
            return { valid: false, error: 'already_claimed', invite };
        }
        
        // Check expiration
        const expiresAt = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
        if (expiresAt < new Date()) {
            return { valid: false, error: 'expired', invite };
        }
        
        return { valid: true, invite };
        
    } catch (error) {
        console.error('Error validating invitation:', error);
        return { valid: false, error: 'validation_error' };
    }
};

// ============================================
// CHECK EMAIL MATCH (For email-locked invitations)
// ============================================
/**
 * Checks if a user's email matches the invitation's recipient email (if set)
 * @param {Object} invite - The invitation object
 * @param {string} userEmail - The user's email
 * @returns {Object} - { matches: boolean, required: boolean }
 */
export const checkEmailMatch = (invite, userEmail) => {
    // If no recipient email is set, anyone can claim
    if (!invite.recipientEmail) {
        return { matches: true, required: false };
    }
    
    // Check if emails match (case-insensitive)
    const matches = invite.recipientEmail.toLowerCase() === userEmail?.toLowerCase();
    
    return { matches, required: true };
};

// ============================================
// CLAIM INVITATION (Import Records)
// ============================================
/**
 * Claims an invitation and imports all records to the user's account
 * @param {string} inviteId - The Firestore document ID of the invitation
 * @param {string} userId - The Firebase user ID
 * @param {string} propertyId - The property ID to import records into
 * @returns {Object} - { success: boolean, importedCount?: number, error?: string }
 */
export const claimInvitation = async (inviteId, userId, propertyId) => {
    try {
        const inviteRef = doc(db, INVITATIONS_COLLECTION_PATH, inviteId);
        const inviteSnap = await getDoc(inviteRef);
        
        if (!inviteSnap.exists()) {
            return { success: false, error: 'Invitation not found' };
        }
        
        const invite = inviteSnap.data();
        
        // Double-check it hasn't been claimed
        if (invite.claimed) {
            return { success: false, error: 'This invitation has already been claimed' };
        }
        
        // Use a batch write for atomicity
        const batch = writeBatch(db);
        
        // Import all records
        const recordsRef = collection(db, 'artifacts', appId, 'users', userId, 'house_records');
        let importedCount = 0;
        
        for (const record of invite.records) {
            const newRecordRef = doc(recordsRef);
            batch.set(newRecordRef, {
                ...record,
                propertyId,
                importedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });
            importedCount++;
        }
        
        // Mark invitation as claimed
        batch.update(inviteRef, {
            claimed: true,
            claimedBy: userId,
            claimedAt: serverTimestamp()
        });
        
        await batch.commit();
        
        return { 
            success: true, 
            importedCount,
            contractorInfo: invite.contractorInfo 
        };
        
    } catch (error) {
        console.error('Error claiming invitation:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// GET INVITATION PREVIEW (For display before auth)
// ============================================
/**
 * Gets a safe preview of an invitation for display before the user signs in
 * @param {Object} invite - The full invitation object
 * @returns {Object} - Safe preview data
 */
export const getInvitationPreview = (invite) => {
    if (!invite) return null;
    
    return {
        contractorName: invite.contractorInfo?.company || invite.contractorInfo?.name || 'A contractor',
        recordCount: invite.records?.length || 0,
        recordPreviews: (invite.records || []).slice(0, 5).map(r => ({
            item: r.item,
            category: r.category,
            brand: r.brand
        })),
        hasEmailLock: !!invite.recipientEmail,
        // Don't expose the actual email for privacy
        emailHint: invite.recipientEmail 
            ? `${invite.recipientEmail.charAt(0)}***@${invite.recipientEmail.split('@')[1]}`
            : null
    };
};
