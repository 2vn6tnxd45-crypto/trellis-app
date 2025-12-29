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
// src/lib/invitations.js

export const createContractorInvitation = async (contractorInfo, records, recipientEmail = null) => {
    console.log('[invitations.js] createContractorInvitation called');
    console.log('[invitations.js] contractorInfo:', contractorInfo);
    console.log('[invitations.js] records count:', records?.length);
    
    const claimToken = generateSecureToken();
    console.log('[invitations.js] Generated token:', claimToken.substring(0, 8) + '...');
    
    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Prepare records with proper structure
    const preparedRecords = records.map((record, idx) => {
        console.log(`[invitations.js] Preparing record ${idx}:`, record.item);
        return {
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
            maintenanceTasks: record.maintenanceTasks || [],
            contractor: contractorInfo.company || contractorInfo.name || '',
            contractorPhone: contractorInfo.phone || '',
            contractorEmail: contractorInfo.email || '',
            attachments: record.attachments || [],
            // Metadata
            importedFrom: 'contractor_invitation'
        };
    });
    
    console.log('[invitations.js] Prepared records:', preparedRecords.length);
    
    const inviteDoc = {
        claimToken,
        // FIX: Added optional chaining (?.trim()) to prevent crash when email is null/undefined
        recipientEmail: recipientEmail?.toLowerCase()?.trim() || null,
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
        // FIX: Use regular Date instead of serverTimestamp() to avoid offline persistence hanging
        // serverTimestamp() is a sentinel value that requires server confirmation, which can hang
        // when Firestore's offline persistence is enabled and there are sync issues
        createdAt: new Date(),
        expiresAt: expiresAt
    };
    
    console.log('[invitations.js] About to call addDoc...');
    console.log('[invitations.js] Collection path:', INVITATIONS_COLLECTION_PATH);
    
    try {
        const inviteRef = await addDoc(collection(db, INVITATIONS_COLLECTION_PATH), inviteDoc);
        console.log('[invitations.js] addDoc succeeded, id:', inviteRef.id);
        
        // Generate the claim link
        const baseUrl = typeof window !== 'undefined' 
            ? `${window.location.origin}${window.location.pathname}`
            : '';
        
        const result = {
            inviteId: inviteRef.id,
            claimToken,
            link: `${baseUrl}?invite=${claimToken}`
        };
        
        console.log('[invitations.js] Returning result:', result);
        return result;
    } catch (error) {
        console.error('[invitations.js] addDoc FAILED:', error);
        throw error;
    }
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
        return { valid: false, error: 'fetch_error' };
    }
};

// ============================================
// CHECK EMAIL MATCH
// ============================================
/**
 * Checks if the user's email matches the invitation's recipient email (if locked)
 * @param {Object} invite - The invitation object
 * @param {string} userEmail - The user's email
 * @returns {boolean} - True if email matches or no lock exists
 */
export const checkEmailMatch = (invite, userEmail) => {
    if (!invite.recipientEmail) {
        return true; // No email lock
    }
    return invite.recipientEmail.toLowerCase() === userEmail?.toLowerCase();
};

// ============================================
// CLAIM INVITATION (Import Records)
// ============================================
/**
 * Claims an invitation and imports records to the user's account
 * @param {string} inviteId - The invitation document ID
 * @param {string} userId - The claiming user's ID
 * @param {string} propertyId - The property to import records to
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
