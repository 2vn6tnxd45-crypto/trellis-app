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

// CHANGE: Removed static import of ContractorPro to prevent circular dependency deadlocks.
// We will use dynamic import() inside the function instead.

// Helper to log with timestamp for debugging
const log = (msg, data) => console.log(`[Invitations Lib ${new Date().toISOString().split('T')[1]}] ${msg}`, data || '');

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
export const createContractorInvitation = async (contractorInfo, records, recipientEmail = null) => {
    log('createContractorInvitation called');
    
    // Ensure path exists - default to root if constant missing
    const path = INVITATIONS_COLLECTION_PATH || 'invitations';
    log('Using collection path:', path);
    
    const claimToken = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const preparedRecords = records.map((record, idx) => ({
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
        importedFrom: 'contractor_invitation'
    }));
    
    const inviteDoc = {
        claimToken,
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
        createdAt: new Date(),
        expiresAt: expiresAt
    };
    
    try {
        const inviteRef = await addDoc(collection(db, path), inviteDoc);
        log('Invitation created with ID:', inviteRef.id);
        
        const baseUrl = typeof window !== 'undefined' 
            ? `${window.location.origin}${window.location.pathname}`
            : '';
        
        return {
            inviteId: inviteRef.id,
            claimToken,
            link: `${baseUrl}?invite=${claimToken}`
        };
    } catch (error) {
        console.error('[Invitations] Create FAILED:', error);
        throw error;
    }
};

// ============================================
// VALIDATE INVITATION (Homeowner Side)
// ============================================
/**
 * Validates an invitation token and checks if it can be claimed.
 * Now implements a fallback strategy to check multiple paths.
 */
export const validateInvitation = async (token) => {
    log('validateInvitation called with token:', token?.substring(0, 5) + '...');
    
    if (!token) {
        return { valid: false, error: 'no_token' };
    }
    
    // Strategy: Define paths to check. 
    // 1. The specific artifact path (primary)
    // 2. The root 'invitations' path (fallback for legacy or permissions issues)
    const pathsToCheck = [];
    if (INVITATIONS_COLLECTION_PATH) pathsToCheck.push(INVITATIONS_COLLECTION_PATH);
    pathsToCheck.push('invitations'); // Always check root as fallback
    
    // Deduplicate
    const uniquePaths = [...new Set(pathsToCheck)];
    
    for (const path of uniquePaths) {
        try {
            log(`Checking path: ${path}`);
            
            const q = query(
                collection(db, path),
                where('claimToken', '==', token)
            );
            
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const inviteDoc = snapshot.docs[0];
                const invite = { id: inviteDoc.id, ...inviteDoc.data() };
                log(`Found invitation at ${path}:`, invite.id);
                
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
            }
        } catch (err) {
            console.warn(`Failed to check path ${path}:`, err.message);
            // Continue to next path if this one fails (e.g. permission denied)
        }
    }
    
    // If we get here, we found nothing in any path
    log('Token not found in any checked paths');
    return { valid: false, error: 'not_found' };
};

// ============================================
// CHECK EMAIL MATCH
// ============================================
export const checkEmailMatch = (invite, userEmail) => {
    if (!invite.recipientEmail) {
        return true;
    }
    return invite.recipientEmail.toLowerCase() === userEmail?.toLowerCase();
};

// ============================================
// CLAIM INVITATION (Import Records)
// ============================================
export const claimInvitation = async (inviteId, userId, propertyId, propertyName = null) => {
    try {
        // We need to find *where* this invitation lives since we support multiple paths now
        let inviteRef = null;
        let inviteData = null;
        
        const pathsToCheck = [];
        if (INVITATIONS_COLLECTION_PATH) pathsToCheck.push(INVITATIONS_COLLECTION_PATH);
        pathsToCheck.push('invitations');
        const uniquePaths = [...new Set(pathsToCheck)];

        // Find the document again to get the correct reference
        for (const path of uniquePaths) {
            try {
                const testRef = doc(db, path, inviteId);
                const snap = await getDoc(testRef);
                if (snap.exists()) {
                    inviteRef = testRef;
                    inviteData = snap.data();
                    break;
                }
            } catch (e) { /* ignore */ }
        }
        
        if (!inviteRef || !inviteData) {
            return { success: false, error: 'Invitation not found' };
        }
        
        if (inviteData.claimed) {
            return { success: false, error: 'This invitation has already been claimed' };
        }
        
        const batch = writeBatch(db);
        const recordsRef = collection(db, 'artifacts', appId, 'users', userId, 'house_records');
        let importedCount = 0;
        
        for (const record of inviteData.records) {
            const newRecordRef = doc(recordsRef);
            batch.set(newRecordRef, {
                ...record,
                propertyId,
                importedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });
            importedCount++;
        }
        
        batch.update(inviteRef, {
            claimed: true,
            claimedBy: userId,
            claimedAt: serverTimestamp()
        });
        
        await batch.commit();
        
        // Notify contractor if possible
        if (inviteData.contractorInfo?.email) {
            try {
                // DYNAMIC IMPORT to avoid circular dependency
                const ContractorProService = await import('../features/contractor-pro');
                
                if (ContractorProService && ContractorProService.markInvitationClaimed) {
                    // Find contractor by email
                    // Try to find the contractor in the standard collection first
                    const contractorsQuery = query(
                        collection(db, 'contractors'), // Or try constants path if available
                        where('profile.email', '==', inviteData.contractorInfo.email.toLowerCase())
                    );
                    const contractorSnap = await getDocs(contractorsQuery);
                    
                    if (!contractorSnap.empty) {
                        const contractorId = contractorSnap.docs[0].id;
                        
                        await ContractorProService.markInvitationClaimed(contractorId, inviteId, {
                            userId,
                            propertyName
                        });
                        
                        if (ContractorProService.upsertCustomer) {
                            await ContractorProService.upsertCustomer(contractorId, {
                                userId,
                                propertyId,
                                propertyName,
                                jobValue: inviteData.records?.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0) || 0,
                                recordIds: []
                            });
                        }
                        console.log('[invitations.js] Updated contractor dashboard');
                    }
                }
            } catch (err) {
                console.warn('[Invitations] Failed to update contractor dashboard (non-fatal):', err);
            }
        }
        
        return { 
            success: true, 
            importedCount,
            contractorInfo: inviteData.contractorInfo 
        };
        
    } catch (error) {
        console.error('[Invitations] Claim Error:', error);
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
        emailHint: invite.recipientEmail 
            ? `${invite.recipientEmail.charAt(0)}***@${invite.recipientEmail.split('@')[1]}`
            : null
    };
};
