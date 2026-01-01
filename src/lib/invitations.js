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

// --- CRITICAL FIX: CIRCULAR DEPENDENCY ---
// Instead of destructuring immediately, we import the namespace.
// This prevents the app from freezing if the module isn't fully loaded yet.
import * as ContractorProService from '../features/contractor-pro';

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
    console.log('[invitations.js] createContractorInvitation called');
    console.log('[invitations.js] contractorInfo:', contractorInfo);
    console.log('[invitations.js] records count:', records?.length);
    
    // Ensure we use the correct path constant
    const collectionPath = INVITATIONS_COLLECTION_PATH || 'invitations';
    console.log('[invitations.js] Using collection path:', collectionPath);

    const claimToken = generateSecureToken();
    console.log('[invitations.js] Generated token:', claimToken.substring(0, 8) + '...');
    
    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Prepare records with proper structure
    const preparedRecords = records.map((record, idx) => {
        // console.log(`[invitations.js] Preparing record ${idx}:`, record.item);
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
        // FIX: Added optional chaining to prevent crash when email is null/undefined
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
        // FIX: Use regular Date instead of serverTimestamp to avoid offline persistence hangs
        createdAt: new Date(),
        expiresAt: expiresAt
    };
    
    try {
        const inviteRef = await addDoc(collection(db, collectionPath), inviteDoc);
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
 * @returns {Object} - { valid: boolean, invite?: Object, error?: string }
 */
export const validateInvitation = async (token) => {
    if (!token) {
        return { valid: false, error: 'no_token' };
    }
    
    try {
        console.log('[invitations.js] Validating token:', token);
        const collectionPath = INVITATIONS_COLLECTION_PATH || 'invitations';
        
        const q = query(
            collection(db, collectionPath),
            where('claimToken', '==', token)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            console.warn('[invitations.js] Token not found in DB');
            return { valid: false, error: 'not_found' };
        }
        
        const inviteDoc = snapshot.docs[0];
        const invite = { id: inviteDoc.id, ...inviteDoc.data() };
        
        console.log('[invitations.js] Invitation found:', invite.id);
        
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
        console.error('[invitations.js] Error validating invitation:', error);
        // Return a specific error code if permissions failed
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            return { valid: false, error: 'permission_denied' };
        }
        return { valid: false, error: 'fetch_error' };
    }
};

// ============================================
// CHECK EMAIL MATCH
// ============================================
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
 */
export const claimInvitation = async (inviteId, userId, propertyId, propertyName = null) => {
    try {
        const collectionPath = INVITATIONS_COLLECTION_PATH || 'invitations';
        const inviteRef = doc(db, collectionPath, inviteId);
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
        
        // --- SAFE NOTIFICATION LOGIC ---
        // Notify contractor's dashboard (if they have a Pro account)
        if (invite.contractorInfo?.email) {
            try {
                // Ensure the service functions exist before calling them
                // This protects against circular dependency issues where imports might be undefined
                if (ContractorProService && ContractorProService.markInvitationClaimed) {
                    
                    // Find contractor by email
                    // Note: We use the 'contractors' collection path directly here or via constant if available
                    const contractorsQuery = query(
                        collection(db, 'contractors'), // Or use CONTRACTORS_COLLECTION_PATH if available globally
                        where('profile.email', '==', invite.contractorInfo.email.toLowerCase())
                    );
                    const contractorSnap = await getDocs(contractorsQuery);
                    
                    if (!contractorSnap.empty) {
                        const contractorId = contractorSnap.docs[0].id;
                        
                        // Mark invitation as claimed in contractor's subcollection
                        await ContractorProService.markInvitationClaimed(contractorId, inviteId, {
                            userId,
                            propertyName
                        });
                        
                        // Create/update customer relationship
                        if (ContractorProService.upsertCustomer) {
                            await ContractorProService.upsertCustomer(contractorId, {
                                userId,
                                propertyId,
                                propertyName,
                                jobValue: invite.records?.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0) || 0,
                                recordIds: []
                            });
                        }
                        
                        console.log('[invitations.js] Updated contractor dashboard for:', contractorId);
                    }
                } else {
                    console.warn('[invitations.js] ContractorService not available, skipping dashboard update');
                }
            } catch (contractorErr) {
                // Don't fail the claim if contractor update fails
                console.warn('[invitations.js] Could not update contractor dashboard:', contractorErr);
            }
        }
        
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
// GET INVITATION PREVIEW
// ============================================
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
