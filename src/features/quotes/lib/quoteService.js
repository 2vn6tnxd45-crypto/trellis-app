// src/features/quotes/lib/quoteService.js
// ============================================
// QUOTE SERVICE
// ============================================
// All quote-related database operations

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
    increment,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// Optional: Pro connection service (comment out if not available)
// import { createProConnection } from '../../pros/lib/proService';

// Collection paths
const CONTRACTORS_COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';
const QUOTES_SUBCOLLECTION = 'quotes';
const QUOTE_TEMPLATES_SUBCOLLECTION = 'quoteTemplates';
const JOBS_SUBCOLLECTION = 'jobs';

// ============================================
// QUOTE NUMBER GENERATION
// ============================================

/**
 * Generate a unique quote number
 * Format: Q-YYYY-XXX (e.g., Q-2024-001)
 */
export const generateQuoteNumber = async (contractorId) => {
    try {
        const year = new Date().getFullYear();
        const quotesRef = collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION);
        
        // Get quotes from current year to determine next number
        const q = query(
            quotesRef,
            where('createdYear', '==', year),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        
        let nextNumber = 1;
        if (!snapshot.empty) {
            const lastQuote = snapshot.docs[0].data();
            const lastNumber = parseInt(lastQuote.quoteNumber?.split('-')[2] || '0');
            nextNumber = lastNumber + 1;
        }
        
        return `Q-${year}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error generating quote number:', error);
        // Fallback to timestamp-based number
        return `Q-${Date.now()}`;
    }
};

// ============================================
// CREATE QUOTE
// ============================================

/**
 * Create a new quote
 */
export const createQuote = async (contractorId, quoteData) => {
    try {
        const quoteNumber = await generateQuoteNumber(contractorId);
        const year = new Date().getFullYear();
        
        // Calculate totals
        const subtotal = (quoteData.lineItems || []).reduce(
            (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 
            0
        );
        const taxRate = quoteData.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // Calculate Deposit if required
        let depositAmount = 0;
        if (quoteData.depositRequired) {
            if (quoteData.depositType === 'percentage') {
                depositAmount = total * ((quoteData.depositValue || 0) / 100);
            } else {
                depositAmount = quoteData.depositValue || 0;
            }
        }

        const quoteRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION));
        
        const quote = {
            id: quoteRef.id,
            quoteNumber,
            createdYear: year,
            status: quoteData.status || 'draft',
            
            // Customer info
            customer: {
                name: quoteData.customer?.name || '',
                email: quoteData.customer?.email || '',
                phone: quoteData.customer?.phone || '',
                address: quoteData.customer?.address || ''
            },
            customerId: quoteData.customerId || null,
            
            // Quote content
            title: quoteData.title || '',
            lineItems: quoteData.lineItems || [],
            
            // Calculations
            subtotal,
            taxRate: quoteData.taxRate || 0,
            taxAmount,
            total,
            
            // Financials
            depositRequired: quoteData.depositRequired || false,
            depositType: quoteData.depositType || 'percentage',
            depositValue: quoteData.depositValue || 0,
            depositAmount: depositAmount,

            // Content
            notes: quoteData.notes || '',
            exclusions: quoteData.exclusions || '',
            clientWarranty: quoteData.clientWarranty || '',
            terms: quoteData.terms || 'Quote valid for 14 days. Final payment due upon completion.',
            
            // NEW: Estimated Duration
            estimatedDuration: quoteData.estimatedDuration || null,
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            expiresAt: quoteData.expiresAt || null,
            sentAt: null,
            viewedAt: null,
            acceptedAt: null,
            declinedAt: null,
            
            // Tracking
            viewCount: 0,
            lastViewedAt: null,
            
            // Conversion tracking
            convertedToInvoiceId: null,
            convertedToJobId: null
        };
        
        await setDoc(quoteRef, quote);
        
        // Update contractor stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.totalQuotes': increment(1),
            updatedAt: serverTimestamp()
        });
        
        return { success: true, quoteId: quoteRef.id, quoteNumber };
    } catch (error) {
        console.error('Error creating quote:', error);
        throw error;
    }
};

// ============================================
// UPDATE QUOTE
// ============================================

/**
 * Update an existing quote
 */
export const updateQuote = async (contractorId, quoteId, quoteData) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        // Recalculate totals if line items changed
        let updates = { ...quoteData, updatedAt: serverTimestamp() };
        
        if (quoteData.lineItems) {
            const subtotal = quoteData.lineItems.reduce(
                (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 
                0
            );
            const taxRate = quoteData.taxRate ?? 0;
            const taxAmount = subtotal * (taxRate / 100);
            const total = subtotal + taxAmount;
            
            updates = {
                ...updates,
                subtotal,
                taxAmount,
                total
            };

            // Recalculate deposit if total changed
            if (updates.depositRequired) {
                 if (updates.depositType === 'percentage') {
                    updates.depositAmount = total * ((updates.depositValue || 0) / 100);
                } else {
                    updates.depositAmount = updates.depositValue || 0;
                }
            }
        }
        
        // Include estimatedDuration if provided
        if (quoteData.estimatedDuration !== undefined) {
            updates.estimatedDuration = quoteData.estimatedDuration || null;
        }
        
        await updateDoc(quoteRef, updates);
        
        return { success: true };
    } catch (error) {
        console.error('Error updating quote:', error);
        throw error;
    }
};

// ============================================
// DELETE QUOTE
// ============================================

/**
 * Delete a quote
 */
export const deleteQuote = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        await deleteDoc(quoteRef);
        
        // Update contractor stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.totalQuotes': increment(-1),
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting quote:', error);
        throw error;
    }
};

// ============================================
// GET QUOTE
// ============================================

/**
 * Get a single quote by ID
 */
export const getQuote = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            return null;
        }
        
        return { id: quoteSnap.id, ...quoteSnap.data() };
    } catch (error) {
        console.error('Error getting quote:', error);
        throw error;
    }
};

/**
 * Get all quotes for a contractor
 */
export const getQuotes = async (contractorId, options = {}) => {
    try {
        const quotesRef = collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION);
        
        let q = query(quotesRef, orderBy('createdAt', 'desc'));
        
        if (options.status) {
            q = query(quotesRef, where('status', '==', options.status), orderBy('createdAt', 'desc'));
        }
        
        if (options.limit) {
            q = query(q, limit(options.limit));
        }
        
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting quotes:', error);
        throw error;
    }
};

/**
 * Subscribe to quotes with real-time updates
 */
export const subscribeToQuotes = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const quotes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(quotes);
    }, (error) => {
        console.error('Quotes subscription error:', error);
        callback([]);
    });
};

// ============================================
// QUOTE ACTIONS
// ============================================

/**
 * Send a quote to customer
 * Generates share link and updates status
 */
export const sendQuote = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        // Generate a simple share token
        const shareToken = `${contractorId}_${quoteId}`;
        
        await updateDoc(quoteRef, {
            status: 'sent',
            sentAt: serverTimestamp(),
            shareToken,
            updatedAt: serverTimestamp()
        });
        
        return { 
            success: true, 
            shareToken,
            shareLink: `${window.location.origin}/quote/${shareToken}`
        };
    } catch (error) {
        console.error('Error sending quote:', error);
        throw error;
    }
};

/**
 * Mark quote as viewed (called when customer opens quote link)
 */
export const markQuoteViewed = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            throw new Error('Quote not found');
        }
        
        const quote = quoteSnap.data();
        
        // Only update to 'viewed' if currently 'sent'
        const updates = {
            viewCount: increment(1),
            lastViewedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        if (quote.status === 'sent') {
            updates.status = 'viewed';
            updates.viewedAt = serverTimestamp();
        }
        
        await updateDoc(quoteRef, updates);
        
        return { success: true };
    } catch (error) {
        console.error('Error marking quote as viewed:', error);
        throw error;
    }
};

/**
 * Generate a job number for new jobs
 */
const generateJobNumber = async (contractorId) => {
    try {
        const year = new Date().getFullYear();
        const jobsRef = collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION);
        
        const q = query(
            jobsRef,
            where('createdYear', '==', year),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        
        let nextNumber = 1;
        if (!snapshot.empty) {
            const lastJob = snapshot.docs[0].data();
            const lastNumber = parseInt(lastJob.jobNumber?.split('-')[2] || '0');
            nextNumber = lastNumber + 1;
        }
        
        return `J-${year}-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error generating job number:', error);
        return `J-${Date.now()}`;
    }
};

/**
 * Accept a quote - Creates a job and updates quote status
 */
export const acceptQuote = async (contractorId, quoteId) => {
    try {
        const batch = writeBatch(db);
        
        // Get the quote
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            throw new Error('Quote not found');
        }
        
        const quote = quoteSnap.data();
        
        // Generate job number
        const jobNumber = await generateJobNumber(contractorId);
        const year = new Date().getFullYear();
        
        // Determine customerId
        const customerId = quote.customerId || null;
        
        // Get contractor profile for connection
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        const contractorProfile = contractorSnap.exists() ? contractorSnap.data().profile : {};
        
        // Create the job document
        const jobRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, JOBS_SUBCOLLECTION));
        
        const job = {
            id: jobRef.id,
            jobNumber,
            createdYear: year,
            status: 'scheduled',
            
            // Link to quote
            sourceQuoteId: quoteId,
            sourceQuoteNumber: quote.quoteNumber,
            
            // Customer info (copied from quote)
            customer: quote.customer,
            customerId: customerId,
            
            // Job details (from quote)
            title: quote.title,
            description: quote.notes || '',
            lineItems: quote.lineItems,
            
            // Financials (from quote)
            subtotal: quote.subtotal,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            total: quote.total,
            depositRequired: quote.depositRequired,
            depositAmount: quote.depositAmount,
            depositPaid: false,
            
            // Scheduling (to be filled in)
            scheduledDate: null,
            scheduledTime: null,
            estimatedDuration: quote.estimatedDuration || null,
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: null
        };
        
        batch.set(jobRef, job);
        
        // Update quote status
        batch.update(quoteRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            convertedToJobId: jobRef.id,
            updatedAt: serverTimestamp()
        });
        
        // Update contractor stats
        batch.update(contractorRef, {
            'profile.stats.acceptedQuotes': increment(1),
            'profile.stats.totalJobValue': increment(quote.total || 0),
            'profile.stats.activeJobs': increment(1),
            updatedAt: serverTimestamp()
        });
        
        await batch.commit();
        
        console.log(`Quote ${quoteId} accepted → Job ${jobRef.id} created`);
        
        return { 
            success: true, 
            jobId: jobRef.id,
            jobNumber,
            customerId
        };
        
    } catch (error) {
        console.error('Error accepting quote:', error);
        throw error;
    }
};

/**
 * Decline a quote
 */
export const declineQuote = async (contractorId, quoteId, reason = '') => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            status: 'declined',
            declinedAt: serverTimestamp(),
            declineReason: reason,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error declining quote:', error);
        throw error;
    }
};

/**
 * Check for expired quotes and update their status
 */
export const checkExpiredQuotes = async (contractorId) => {
    try {
        const now = new Date();
        
        const q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
            where('status', 'in', ['sent', 'viewed']),
            where('expiresAt', '<=', Timestamp.fromDate(now))
        );
        
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let count = 0;
        
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                status: 'expired',
                updatedAt: serverTimestamp()
            });
            count++;
        });
        
        if (count > 0) {
            await batch.commit();
        }
        
        return { success: true, expiredCount: count };
    } catch (error) {
        console.error('Error checking expired quotes:', error);
        throw error;
    }
};

// ============================================
// QUOTE TEMPLATES
// ============================================

/**
 * Create a quote template
 */
export const createQuoteTemplate = async (contractorId, templateData) => {
    try {
        const templateRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION));
        
        const template = {
            id: templateRef.id,
            name: templateData.name || 'Untitled Template',
            category: templateData.category || 'General',
            lineItems: templateData.lineItems || [],
            defaultNotes: templateData.defaultNotes || '',
            defaultTerms: templateData.defaultTerms || '',
            defaultWarranty: templateData.defaultWarranty || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await setDoc(templateRef, template);
        
        return { success: true, templateId: templateRef.id };
    } catch (error) {
        console.error('Error creating template:', error);
        throw error;
    }
};

/**
 * Get all quote templates
 */
export const getQuoteTemplates = async (contractorId) => {
    try {
        const q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION),
            orderBy('name', 'asc')
        );
        
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting templates:', error);
        throw error;
    }
};

/**
 * Subscribe to quote templates
 */
export const subscribeToQuoteTemplates = (contractorId, callback) => {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION),
        orderBy('name', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const templates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(templates);
    }, (error) => {
        console.error('Templates subscription error:', error);
        callback([]);
    });
};

/**
 * Delete a quote template
 */
export const deleteQuoteTemplate = async (contractorId, templateId) => {
    try {
        const templateRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION, templateId);
        await deleteDoc(templateRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting template:', error);
        throw error;
    }
};

// ============================================
// CONVERSION OPERATIONS
// ============================================

/**
 * Convert a quote to an invoice
 * This creates a link between the quote and invoice
 */
export const linkQuoteToInvoice = async (contractorId, quoteId, invoiceId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            convertedToInvoiceId: invoiceId,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error linking quote to invoice:', error);
        throw error;
    }
};

/**
 * Link a quote to a job
 */
export const linkQuoteToJob = async (contractorId, quoteId, jobId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            convertedToJobId: jobId,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error linking quote to job:', error);
        throw error;
    }
};

// ============================================
// STATS
// ============================================

/**
 * Get quote statistics for dashboard
 */
export const getQuoteStats = async (contractorId) => {
    try {
        const quotesRef = collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION);
        const snapshot = await getDocs(quotesRef);
        
        const stats = {
            total: 0,
            draft: 0,
            sent: 0,
            viewed: 0,
            pending: 0,
            accepted: 0,
            declined: 0,
            expired: 0,
            totalValue: 0,
            acceptedValue: 0,
            conversionRate: 0
        };
        
        snapshot.docs.forEach(doc => {
            const quote = doc.data();
            stats.total++;
            stats.totalValue += quote.total || 0;
            
            switch (quote.status) {
                case 'draft':
                    stats.draft++;
                    break;
                case 'sent':
                    stats.sent++;
                    stats.pending++;
                    break;
                case 'viewed':
                    stats.viewed++;
                    stats.pending++;
                    break;
                case 'accepted':
                    stats.accepted++;
                    stats.acceptedValue += quote.total || 0;
                    break;
                case 'declined':
                    stats.declined++;
                    break;
                case 'expired':
                    stats.expired++;
                    break;
            }
        });
        
        // Calculate conversion rate (accepted / (accepted + declined))
        const responded = stats.accepted + stats.declined;
        stats.conversionRate = responded > 0 ? (stats.accepted / responded) * 100 : 0;
        
        return stats;
    } catch (error) {
        console.error('Error getting quote stats:', error);
        throw error;
    }
};

// ============================================
// PUBLIC QUOTE ACCESS
// ============================================

/**
 * Get a quote by its share token (for public quote view)
 */
export const getQuoteByShareToken = async (shareToken) => {
    try {
        // Parse the share token to get contractorId and quoteId
        const [contractorId, quoteId] = shareToken.split('_');
        
        if (!contractorId || !quoteId) {
            throw new Error('Invalid share token');
        }
        
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            return null;
        }
        
        // Get contractor info for display
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        
        const contractor = contractorSnap.exists() ? contractorSnap.data().profile : null;
        
        return {
            quote: { id: quoteSnap.id, ...quoteSnap.data() },
            contractor,
            contractorId
        };
    } catch (error) {
        console.error('Error getting quote by share token:', error);
        throw error;
    }
};

/**
 * Generate share link for a quote
 */
export const generateQuoteShareLink = (contractorId, quoteId) => {
    const shareToken = `${contractorId}_${quoteId}`;
    return `${window.location.origin}/quote/${shareToken}`;
};

// ============================================
// QUOTE CLAIMING (Homeowner claiming quote)
// ============================================

/**
 * Claim a quote to a user's profile
 */
export const claimQuote = async (contractorId, quoteId, userId, propertyId = null) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            throw new Error('Quote not found');
        }
        
        // Get contractor profile for pro connection
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        const contractorProfile = contractorSnap.exists() ? contractorSnap.data().profile : {};

        // Update quote with user claim
        const updateData = {
            customerId: userId,
            claimedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Optionally link property if provided
        if (propertyId) {
            updateData.propertyId = propertyId;
        }
        
        await updateDoc(quoteRef, updateData);
        
        // Optional: Create/Update Pro connection (uncomment if proService exists)
        // await createProConnection(userId, {
        //     contractorId,
        //     name: contractorProfile.companyName || 'Contractor',
        //     phone: contractorProfile.phone || null,
        //     email: contractorProfile.email || null,
        //     address: contractorProfile.address || null,
        //     logoUrl: contractorProfile.logoUrl || null,
        //     isOnPlatform: true,
        //     connectedVia: 'quote',
        //     connectedAt: serverTimestamp()
        // });
        
        return { success: true };
    } catch (error) {
        console.error('Error claiming quote:', error);
        throw error;
    }
};

/**
 * Remove a quote from a user's profile (Unclaim)
 */
export const unclaimQuote = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            customerId: null,
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error unclaiming quote:', error);
        throw error;
    }
};

export default {
    generateQuoteNumber,
    createQuote,
    updateQuote,
    deleteQuote,
    getQuote,
    getQuotes,
    subscribeToQuotes,
    sendQuote,
    markQuoteViewed,
    acceptQuote,
    declineQuote,
    checkExpiredQuotes,
    createQuoteTemplate,
    getQuoteTemplates,
    subscribeToQuoteTemplates,
    deleteQuoteTemplate,
    linkQuoteToInvoice,
    linkQuoteToJob,
    getQuoteStats,
    getQuoteByShareToken,
    generateQuoteShareLink,
    claimQuote,
    unclaimQuote
};
