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
    deleteDoc,
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
const CONTRACTORS_COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';
const INVITATIONS_SUBCOLLECTION = 'invitations';
const CUSTOMERS_SUBCOLLECTION = 'customers';

// All subcollections that need to be deleted with the account
const ALL_CONTRACTOR_SUBCOLLECTIONS = [
    'invitations',
    'customers',
    'quotes',
    'quoteTemplates',
    'expenses',
    'priceBook',
    'vehicles',
    'invoices',
    'ratings',
    'team',
    'timesheets',
    'memberships'
];

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
            // Update existing - merge profile data
            const updateData = {
                'profile.displayName': profileData.displayName ?? '',
                'profile.companyName': profileData.companyName ?? '',
                'profile.phone': profileData.phone ?? '',
                'profile.email': profileData.email ?? '',
                'profile.address': profileData.address ?? '',
                'profile.licenseNumber': profileData.licenseNumber ?? '',
                'profile.specialty': profileData.specialty ?? '',
                'profile.logoUrl': profileData.logoUrl ?? null,
                'profile.trades': profileData.trades ?? [],
                'profile.public': profileData.public ?? false,
                
                // NEW: Credential fields
                'profile.yearsInBusiness': profileData.yearsInBusiness ?? null,
                'profile.insured': profileData.insured ?? false,
                'profile.bonded': profileData.bonded ?? false,
                'profile.certifications': profileData.certifications ?? [],
                'profile.paymentMethods': profileData.paymentMethods ?? [],
                
                updatedAt: serverTimestamp()
            };
            
            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });
            
            await updateDoc(docRef, updateData);
        } else {
            // Create new
            await setDoc(docRef, {
                uid: contractorId,
                profile: {
                    displayName: profileData.displayName || '',
                    companyName: profileData.companyName || '',
                    phone: profileData.phone || '',
                    email: profileData.email || '',
                    address: profileData.address || '',
                    licenseNumber: profileData.licenseNumber || '',
                    specialty: profileData.specialty || '',
                    logoUrl: profileData.logoUrl || null,
                    trades: profileData.trades || [],
                    public: profileData.public || false,
                    
                    // NEW: Credential fields
                    yearsInBusiness: profileData.yearsInBusiness || null,
                    insured: profileData.insured || false,
                    bonded: profileData.bonded || false,
                    certifications: profileData.certifications || [],
                    paymentMethods: profileData.paymentMethods || [],
                    
                    stats: {
                        totalCustomers: 0,
                        totalInvitations: 0,
                        claimRate: 0,
                        totalQuotes: 0,
                        acceptedQuotes: 0,
                        totalJobValue: 0,
                        activeJobs: 0
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

/**
 * Update just the profile portion (for profile editor)
 */
export const updateContractorProfile = async (contractorId, profileFields) => {
    try {
        const docRef = doc(db, CONTRACTORS_COLLECTION, contractorId);

        // Build update object with profile. prefix
        const updateData = {
            updatedAt: serverTimestamp()
        };

        Object.keys(profileFields).forEach(key => {
            if (profileFields[key] !== undefined) {
                updateData[`profile.${key}`] = profileFields[key];
            }
        });

        await updateDoc(docRef, updateData);
        return { success: true };
    } catch (error) {
        console.error('Error updating contractor profile:', error);
        throw error;
    }
};

/**
 * Update review settings for auto-requesting Google/Yelp reviews
 */
export const updateReviewSettings = async (contractorId, reviewSettings) => {
    try {
        const docRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(docRef, {
            reviewSettings: {
                googleBusinessUrl: reviewSettings.googleBusinessUrl || '',
                yelpUrl: reviewSettings.yelpUrl || '',
                autoRequestReviews: reviewSettings.autoRequestReviews ?? true,
                delayHours: reviewSettings.delayHours ?? 24,
                customMessage: reviewSettings.customMessage || ''
            },
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating review settings:', error);
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
            email: invitationData.email || null
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
export const getContractorInvitations = async (contractorId) => {
    try {
        const invitationsRef = collection(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            INVITATIONS_SUBCOLLECTION
        );
        
        const q = query(invitationsRef, orderBy('createdAt', 'desc'), limit(100));
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
 * Subscribe to invitations with real-time updates
 */
export const subscribeToContractorInvitations = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, INVITATIONS_SUBCOLLECTION),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const invitations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(invitations);
    }, (error) => {
        console.error('Invitations subscription error:', error);
        callback([]);
    });
};

/**
 * Update invitation when claimed
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
        
        // Update stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.totalCustomers': increment(1),
            updatedAt: serverTimestamp()
        });
        
        // Recalculate claim rate
        await recalculateClaimRate(contractorId);
        
        return { success: true };
    } catch (error) {
        console.error('Error marking invitation claimed:', error);
        throw error;
    }
};

/**
 * Delete an invitation
 */
export const deleteContractorInvitation = async (contractorId, invitationId) => {
    try {
        const inviteRef = doc(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            INVITATIONS_SUBCOLLECTION, invitationId
        );
        
        await deleteDoc(inviteRef);
        
        // Update stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.totalInvitations': increment(-1),
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting invitation:', error);
        throw error;
    }
};

/**
 * Recalculate claim rate for a contractor
 */
const recalculateClaimRate = async (contractorId) => {
    try {
        const invitationsRef = collection(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            INVITATIONS_SUBCOLLECTION
        );
        
        const snapshot = await getDocs(invitationsRef);
        
        let total = 0;
        let claimed = 0;
        
        snapshot.docs.forEach(doc => {
            total++;
            if (doc.data().status === 'claimed') {
                claimed++;
            }
        });
        
        const claimRate = total > 0 ? (claimed / total) * 100 : 0;
        
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.claimRate': claimRate
        });
        
        return { success: true, claimRate };
    } catch (error) {
        console.error('Error recalculating claim rate:', error);
        throw error;
    }
};

// ============================================
// CUSTOMERS
// ============================================

/**
 * Get all customers for a contractor
 */
export const getContractorCustomers = async (contractorId) => {
    try {
        const customersRef = collection(
            db, 
            CONTRACTORS_COLLECTION, contractorId, 
            CUSTOMERS_SUBCOLLECTION
        );
        
        const q = query(customersRef, orderBy('customerName', 'asc'));
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
 * Subscribe to customers with real-time updates
 */
export const subscribeToContractorCustomers = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, CUSTOMERS_SUBCOLLECTION),
        orderBy('customerName', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(customers);
    }, (error) => {
        console.error('Customers subscription error:', error);
        callback([]);
    });
};

/**
 * Add or update a customer
 */
export const saveContractorCustomer = async (contractorId, customerData) => {
    try {
        const customerRef = customerData.id 
            ? doc(db, CONTRACTORS_COLLECTION, contractorId, CUSTOMERS_SUBCOLLECTION, customerData.id)
            : doc(collection(db, CONTRACTORS_COLLECTION, contractorId, CUSTOMERS_SUBCOLLECTION));
        
        const customer = {
            customerName: customerData.customerName || '',
            email: customerData.email || '',
            phone: customerData.phone || '',
            propertyName: customerData.propertyName || '',
            address: customerData.address || '',
            notes: customerData.notes || '',
            totalSpend: customerData.totalSpend || 0,
            jobCount: customerData.jobCount || 0,
            lastContact: customerData.lastContact || null,
            updatedAt: serverTimestamp()
        };
        
        if (!customerData.id) {
            customer.createdAt = serverTimestamp();
        }
        
        await setDoc(customerRef, customer, { merge: true });
        
        return { success: true, customerId: customerRef.id };
    } catch (error) {
        console.error('Error saving customer:', error);
        throw error;
    }
};

// ============================================
// MIGRATION (Anonymous invitations)
// ============================================

/**
 * Migrate anonymous invitations to a contractor account
 * Called after signup/login to link any invitations created before account creation
 */
export const migrateAnonymousInvitations = async (contractorId, email) => {
    try {
        if (!email) {
            return { migratedCount: 0 };
        }
        
        // Find invitations created with this email but not yet linked
        const invitationsRef = collection(db, INVITATIONS_COLLECTION_PATH);
        const q = query(
            invitationsRef,
            where('contractorEmail', '==', email.toLowerCase()),
            where('contractorId', '==', null)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return { migratedCount: 0 };
        }
        
        const batch = writeBatch(db);
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        let claimedCount = 0;
        
        snapshot.docs.forEach(docSnap => {
            const invitation = docSnap.data();
            
            // Update the main invitation with contractor ID
            batch.update(docSnap.ref, {
                contractorId,
                linkedAt: serverTimestamp()
            });
            
            // Create a copy in contractor's invitations subcollection
            const subInviteRef = doc(
                db, 
                CONTRACTORS_COLLECTION, contractorId, 
                INVITATIONS_SUBCOLLECTION, docSnap.id
            );
            
            batch.set(subInviteRef, {
                mainInviteId: docSnap.id,
                claimToken: invitation.claimToken,
                link: invitation.link,
                createdAt: invitation.createdAt || serverTimestamp(),
                status: invitation.status || 'pending',
                claimedAt: invitation.claimedAt || null,
                claimedBy: invitation.claimedBy || null,
                customerName: invitation.customerName || null,
                customerPropertyName: invitation.propertyName || null,
                email: invitation.email || null
            });
            
            if (invitation.status === 'claimed') {
                claimedCount++;
            }
        });
        
        // Update contractor stats
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
 * Delete all documents in a subcollection
 * Firestore batches have a limit of 500 operations, so we may need multiple batches
 * @param {string} contractorId - The contractor ID
 * @param {string} subcollectionName - Name of the subcollection to delete
 * @returns {Promise<number>} Number of documents deleted
 */
const deleteSubcollection = async (contractorId, subcollectionName) => {
    const subcollectionRef = collection(
        db,
        CONTRACTORS_COLLECTION,
        contractorId,
        subcollectionName
    );

    const snapshot = await getDocs(subcollectionRef);

    if (snapshot.empty) {
        return 0;
    }

    // Firestore batch limit is 500 operations
    const BATCH_SIZE = 500;
    const docs = snapshot.docs;
    let deletedCount = 0;

    // Process in chunks of 500
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + BATCH_SIZE);

        chunk.forEach(docSnapshot => {
            batch.delete(docSnapshot.ref);
        });

        await batch.commit();
        deletedCount += chunk.length;
    }

    console.log(`[deleteSubcollection] Deleted ${deletedCount} docs from ${subcollectionName}`);
    return deletedCount;
};

/**
 * Delete contractor account and ALL associated data
 * Note: This deletes the profile data. The Firebase Auth user must be deleted separately.
 *
 * Deletes the following subcollections:
 * - invitations, customers, quotes, quoteTemplates, expenses, priceBook,
 *   vehicles, invoices, ratings, team, timesheets, memberships
 *
 * @param {string} contractorId - The contractor ID to delete
 * @returns {Promise<{success: boolean, deletedCounts: Object}>}
 */
export const deleteContractorAccount = async (contractorId) => {
    try {
        console.log(`[deleteContractorAccount] Starting deletion for contractor: ${contractorId}`);

        const deletedCounts = {};

        // Delete all subcollections
        for (const subcollection of ALL_CONTRACTOR_SUBCOLLECTIONS) {
            try {
                const count = await deleteSubcollection(contractorId, subcollection);
                deletedCounts[subcollection] = count;
            } catch (subError) {
                console.warn(`[deleteContractorAccount] Error deleting ${subcollection}:`, subError);
                deletedCounts[subcollection] = { error: subError.message };
            }
        }

        // Delete the main contractor document
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await deleteDoc(contractorRef);

        console.log(`[deleteContractorAccount] Deletion complete. Deleted counts:`, deletedCounts);

        return {
            success: true,
            deletedCounts
        };
    } catch (error) {
        console.error('Error deleting contractor account:', error);
        throw error;
    }
};

// ============================================
// INVOICES
// ============================================

/**
 * Subscribe to invoices for a contractor
 */
export const subscribeToContractorInvoices = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, 'invoices'),
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

// ============================================
// ALIAS EXPORTS (for backwards compatibility)
// ============================================
// These aliases match what useContractorData.js and index.js import
export const subscribeToInvitations = subscribeToContractorInvitations;
export const subscribeToCustomers = subscribeToContractorCustomers;
export const upsertCustomer = saveContractorCustomer;

export default {
    getContractorProfile,
    saveContractorProfile,
    updateContractorSettings,
    updateContractorProfile,
    linkInvitationToContractor,
    getContractorInvitations,
    subscribeToContractorInvitations,
    markInvitationClaimed,
    deleteContractorInvitation,
    getContractorCustomers,
    subscribeToContractorCustomers,
    saveContractorCustomer,
    migrateAnonymousInvitations,
    getContractorStats,
    subscribeToContractorJobs,
    subscribeToContractorInvoices,
    deleteContractorAccount
};
