// src/features/contractor-pro/lib/contractorService.js
// ============================================
// CONTRACTOR PRO - FIRESTORE SERVICE
// ============================================
// All database operations for contractor accounts

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    deleteDoc, // ADDED: Import deleteDoc
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    onSnapshot, 
    serverTimestamp, 
    writeBatch, 
    increment
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { 
    CONTRACTORS_COLLECTION_PATH, 
    INVITATIONS_COLLECTION_PATH,
    REQUESTS_COLLECTION_PATH 
} from '../../../config/constants';

// Collection paths
// Fallback to 'contractors' if the constant is missing, but it should be there
const CONTRACTORS_COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';
const INVITATIONS_SUBCOLLECTION = 'invitations';
const CUSTOMERS_SUBCOLLECTION = 'customers';

// ============================================
// CONTRACTOR PROFILE
// ============================================

/**
 * Get contractor profile by UID
 */
export const getContractorProfile = async (contractorId) => {
    try {
        const docRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            return null;
        }
        
        return { id: docSnap.id, ...docSnap.data() };
    } catch (error) {
        console.error('Error getting contractor profile:', error);
        throw error;
    }
};

/**
 * Create or update contractor profile
 */
export const saveContractorProfile = async (contractorId, profileData) => {
    try {
        const docRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            // Update existing
            await updateDoc(docRef, {
                profile: profileData,
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new
            await setDoc(docRef, {
                uid: contractorId,
                profile: {
                    ...profileData,
                    stats: {
                        totalCustomers: 0,
                        totalInvitations: 0,
                        claimRate: 0
                    }
                },
                settings: {
                    emailNotifications: true,
                    smsNotifications: false,
                    weeklyDigest: true
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error saving contractor profile:', error);
        throw error;
    }
};

/**
 * Update contractor settings
 */
export const updateContractorSettings = async (contractorId, settings) => {
    try {
        const docRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(docRef, {
            settings,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating settings:', error);
        throw error;
    }
};

// ============================================
// INVITATIONS
// ============================================

/**
 * Link an invitation to a contractor account
 * Called when a logged-in contractor creates an invitation
 */
export const linkInvitationToContractor = async (contractorId, invitationData) => {
    try {
        const inviteRef = doc(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            INVITATIONS_SUBCOLLECTION, invitationData.inviteId
        );
        
        await setDoc(inviteRef, {
            mainInviteId: invitationData.inviteId,
            claimToken: invitationData.claimToken,
            link: invitationData.link,
            createdAt: serverTimestamp(),
            status: 'pending',
            claimedAt: null,
            claimedBy: null,
            customerName: null,
            customerPropertyName: null,
            recordCount: invitationData.recordCount || 0,
            recordSummary: invitationData.recordSummary || [],
            totalValue: invitationData.totalValue || 0,
            recipientEmail: invitationData.recipientEmail || null
        });
        
        // Update stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.totalInvitations': increment(1),
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error linking invitation:', error);
        throw error;
    }
};

/**
 * Get all invitations for a contractor
 */
export const getContractorInvitations = async (contractorId, options = {}) => {
    try {
        const { status, limitCount = 50 } = options;
        
        let q = collection(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            INVITATIONS_SUBCOLLECTION
        );
        
        const constraints = [orderBy('createdAt', 'desc')];
        
        if (status) {
            constraints.unshift(where('status', '==', status));
        }
        
        if (limitCount) {
            constraints.push(limit(limitCount));
        }
        
        q = query(q, ...constraints);
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting invitations:', error);
        throw error;
    }
};

/**
 * Subscribe to invitations for real-time updates
 */
export const subscribeToInvitations = (contractorId, callback, options = {}) => {
    const { limitCount = 20 } = options;
    
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, INVITATIONS_SUBCOLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );
    
    return onSnapshot(q, (snapshot) => {
        const invitations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(invitations);
    }, (error) => {
        console.error('Invitations subscription error:', error);
    });
};

/**
 * Mark invitation as claimed (called from claim flow)
 */
export const markInvitationClaimed = async (contractorId, invitationId, claimData) => {
    try {
        const inviteRef = doc(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            INVITATIONS_SUBCOLLECTION, invitationId
        );
        
        await updateDoc(inviteRef, {
            status: 'claimed',
            claimedAt: serverTimestamp(),
            claimedBy: claimData.userId,
            customerName: claimData.customerName || null,
            customerPropertyName: claimData.propertyName || null
        });
        
        // Update contractor stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        
        if (contractorSnap.exists()) {
            const stats = contractorSnap.data().profile?.stats || {};
            const totalInvitations = stats.totalInvitations || 1;
            const currentClaimed = Math.round((stats.claimRate || 0) * totalInvitations);
            const newClaimRate = (currentClaimed + 1) / totalInvitations;
            
            await updateDoc(contractorRef, {
                'profile.stats.totalCustomers': increment(1),
                'profile.stats.claimRate': newClaimRate,
                updatedAt: serverTimestamp()
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error marking invitation claimed:', error);
        throw error;
    }
};

// ============================================
// CUSTOMERS
// ============================================

/**
 * Add or update a customer relationship
 */
export const upsertCustomer = async (contractorId, customerData) => {
    try {
        const customerRef = doc(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            CUSTOMERS_SUBCOLLECTION, customerData.userId
        );
        
        const customerSnap = await getDoc(customerRef);
        
        if (customerSnap.exists()) {
            // Update existing customer
            const existing = customerSnap.data();
            await updateDoc(customerRef, {
                lastContact: serverTimestamp(),
                totalJobs: increment(1),
                totalSpend: increment(customerData.jobValue || 0),
                recordIds: [...new Set([...(existing.recordIds || []), ...customerData.recordIds])]
            });
        } else {
            // Create new customer
            await setDoc(customerRef, {
                userId: customerData.userId,
                propertyId: customerData.propertyId,
                propertyName: customerData.propertyName,
                customerName: customerData.customerName || null,
                firstContact: serverTimestamp(),
                lastContact: serverTimestamp(),
                totalJobs: 1,
                totalSpend: customerData.jobValue || 0,
                recordIds: customerData.recordIds || []
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error upserting customer:', error);
        throw error;
    }
};

/**
 * Get all customers for a contractor
 */
export const getContractorCustomers = async (contractorId, options = {}) => {
    try {
        const { sortBy = 'lastContact', limitCount = 100 } = options;
        
        const q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, CUSTOMERS_SUBCOLLECTION),
            orderBy(sortBy, 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting customers:', error);
        throw error;
    }
};

/**
 * Subscribe to customers for real-time updates
 */
export const subscribeToCustomers = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, CUSTOMERS_SUBCOLLECTION),
        orderBy('lastContact', 'desc'),
        limit(50)
    );
    
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(customers);
    }, (error) => {
        console.error('Customers subscription error:', error);
    });
};

// ============================================
// MIGRATION
// ============================================

/**
 * Migrate anonymous invitations to a contractor account
 * Called when a contractor signs up with an email that matches previous invitations
 */
export const migrateAnonymousInvitations = async (contractorId, email) => {
    // IMPORTANT: Return early if no email to avoid empty query error
    if (!email) return { migratedCount: 0 };
    
    try {
        // Use the proper collection path for invitations, or default to standard invitations collection
        // This ensures we respect the app's artifact path structure
        const inviteCollectionPath = INVITATIONS_COLLECTION_PATH || 'invitations';
        
        const q = query(
            collection(db, inviteCollectionPath),
            where('contractorInfo.email', '==', email.toLowerCase())
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { migratedCount: 0 };
        }
        
        const batch = writeBatch(db);
        let claimedCount = 0;
        
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            
            // Create invitation in contractor's subcollection
            const inviteRef = doc(
                db, 
                CONTRACTORS_COLLECTION, contractorId, 
                INVITATIONS_SUBCOLLECTION, docSnap.id
            );
            
            batch.set(inviteRef, {
                mainInviteId: docSnap.id,
                claimToken: data.claimToken,
                createdAt: data.createdAt,
                status: data.claimed ? 'claimed' : 'pending',
                claimedAt: data.claimedAt || null,
                claimedBy: data.claimedBy || null,
                recordCount: data.records?.length || 0,
                recordSummary: (data.records || []).slice(0, 5).map(r => ({
                    item: r.item,
                    category: r.category
                })),
                totalValue: (data.records || []).reduce((sum, r) => sum + (r.cost || 0), 0),
                migratedAt: serverTimestamp()
            });
            
            if (data.claimed) claimedCount++;
        });
        
        // Update contractor stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const totalInvitations = snapshot.size;
        const claimRate = totalInvitations > 0 ? claimedCount / totalInvitations : 0;
        
        batch.update(contractorRef, {
            'profile.stats.totalInvitations': increment(totalInvitations),
            'profile.stats.totalCustomers': increment(claimedCount),
            'profile.stats.claimRate': claimRate
        });
        
        await batch.commit();
        
        return { 
            migratedCount: snapshot.size,
            claimedCount
        };
    } catch (error) {
        // Log error but DO NOT THROW. This prevents login/signup failures due to
        // migration issues (like permission errors).
        console.warn('Migration warning (non-fatal):', error);
        return { migratedCount: 0, error: error.message };
    }
};

// ============================================
// STATS
// ============================================

/**
 * Get dashboard stats for a contractor
 */
export const getContractorStats = async (contractorId) => {
    try {
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        
        if (!contractorSnap.exists()) {
            return {
                totalCustomers: 0,
                totalInvitations: 0,
                claimRate: 0,
                pendingInvitations: 0
            };
        }
        
        const profile = contractorSnap.data().profile || {};
        const stats = profile.stats || {};
        
        // Get pending count
        const pendingQuery = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, INVITATIONS_SUBCOLLECTION),
            where('status', '==', 'pending')
        );
        const pendingSnap = await getDocs(pendingQuery);
        
        return {
            totalCustomers: stats.totalCustomers || 0,
            totalInvitations: stats.totalInvitations || 0,
            claimRate: stats.claimRate || 0,
            pendingInvitations: pendingSnap.size
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        throw error;
    }
};

// ============================================
// ACTIVE JOBS
// ============================================

/**
 * Subscribe to active jobs/requests for a contractor
 */
export const subscribeToContractorJobs = (contractorId, callback) => {
    const q = query(
        collection(db, REQUESTS_COLLECTION_PATH),
        where('contractorId', '==', contractorId),
        orderBy('lastActivity', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const jobs = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        callback(jobs);
    }, (error) => {
        console.error('Jobs subscription error:', error);
        callback([]); 
    });
};

// ============================================
// ACCOUNT DELETION
// ============================================

/**
 * Delete contractor account and data
 * Note: This deletes the profile data. Auth deletion requires client-side re-auth.
 */
export const deleteContractorAccount = async (contractorId) => {
    try {
        // 1. Delete Profile
        await deleteDoc(doc(db, CONTRACTORS_COLLECTION, contractorId));
        
        // 2. Optional: You could trigger a Cloud Function here to clean up 
        // invitations/customers recursively, but for MVP, profile deletion is sufficient 
        // to "hide" the user.
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
};

// ... existing imports

// ============================================
// INVOICES
// ============================================

/**
 * Subscribe to invoices for a contractor
 */
export const subscribeToContractorInvoices = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'invoices'),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const invoices = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        callback(invoices);
    }, (error) => {
        console.error('Invoices subscription error:', error);
        callback([]); 
    });
};
