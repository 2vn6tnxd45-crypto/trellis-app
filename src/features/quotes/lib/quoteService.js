// src/features/quotes/lib/quoteService.js
// ============================================
// QUOTE SERVICE - FIRESTORE OPERATIONS
// ============================================
// All database operations for contractor quotes

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
    increment,
    writeBatch
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH, REQUESTS_COLLECTION_PATH } from '../../../config/constants';

// Collection paths
const CONTRACTORS_COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';
const QUOTES_SUBCOLLECTION = 'quotes';
const QUOTE_TEMPLATES_SUBCOLLECTION = 'quoteTemplates';
const CUSTOMERS_SUBCOLLECTION = 'customers';

// ============================================
// JOB STATUS DEFINITIONS
// ============================================
export const JOB_STATUSES = {
    PENDING_SCHEDULE: 'pending_schedule',  // Just accepted, needs scheduling
    SCHEDULED: 'scheduled',                 // Date/time confirmed
    IN_PROGRESS: 'in_progress',            // Work has begun
    COMPLETED: 'completed',                 // Work finished
    CANCELLED: 'cancelled'                  // Job cancelled
};

// ============================================
// QUOTE NUMBER GENERATION
// ============================================

/**
 * Generate a unique quote number
 * Format: Q-YYYY-XXX (e.g., Q-2026-001)
 */
export const generateQuoteNumber = async (contractorId) => {
    const year = new Date().getFullYear();
    
    // Get count of quotes this year
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
        where('createdYear', '==', year)
    );
    
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    
    return `Q-${year}-${count.toString().padStart(3, '0')}`;
};

// ============================================
// JOB NUMBER GENERATION
// ============================================

/**
 * Generate a unique job number
 * Format: JOB-YYYYMM-XXXX
 */
const generateJobNumber = async (contractorId) => {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Simple approach: use timestamp + random for uniqueness
    const suffix = Date.now().toString().slice(-4);
    
    return `JOB-${year}${month}-${suffix}`;
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
        const taxAmount = subtotal * ((quoteData.taxRate || 0) / 100);
        const total = subtotal + taxAmount;
        
        // Calculate Deposit (New)
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
            
            // Financials (New)
            depositRequired: quoteData.depositRequired || false,
            depositType: quoteData.depositType || 'percentage', // 'percentage' or 'fixed'
            depositValue: quoteData.depositValue || 0,
            depositAmount: depositAmount,

            // Content
            notes: quoteData.notes || '',
            exclusions: quoteData.exclusions || '', // New Exclusions Field
            clientWarranty: quoteData.clientWarranty || '', // New Global Warranty Field
            terms: quoteData.terms || 'Quote valid for 14 days. Final payment due upon completion.',
            
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

// ============================================
// LIST QUOTES
// ============================================

/**
 * Get all quotes for a contractor with optional filters
 */
export const getQuotes = async (contractorId, options = {}) => {
    try {
        const { status, limitCount = 50 } = options;
        
        let constraints = [orderBy('createdAt', 'desc')];
        
        if (status && status !== 'all') {
            constraints.unshift(where('status', '==', status));
        }
        
        if (limitCount) {
            constraints.push(limit(limitCount));
        }
        
        const q = query(
            collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
            ...constraints
        );
        
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

// ============================================
// SUBSCRIBE TO QUOTES
// ============================================

/**
 * Subscribe to quotes for real-time updates
 */
export const subscribeToQuotes = (contractorId, callback, options = {}) => {
    const { limitCount = 50 } = options;
    
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
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
// QUOTE STATUS OPERATIONS
// ============================================

/**
 * Send a quote (change status from draft to sent)
 */
export const sendQuote = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            status: 'sent',
            sentAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error sending quote:', error);
        throw error;
    }
};

/**
 * Mark quote as viewed (called when customer opens the quote link)
 */
export const markQuoteViewed = async (contractorId, quoteId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            throw new Error('Quote not found');
        }
        
        const data = quoteSnap.data();
        
        // Only update if not already viewed
        const updates = {
            viewCount: increment(1),
            lastViewedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Change status to viewed only if it was 'sent'
        if (data.status === 'sent') {
            updates.status = 'viewed';
            updates.viewedAt = serverTimestamp();
        }
        
        await updateDoc(quoteRef, updates);
        
        return { success: true };
    } catch (error) {
        console.error('Error marking quote viewed:', error);
        throw error;
    }
};

/**
 * Accept a quote and trigger downstream workflows:
 * 1. Quote status → 'accepted'
 * 2. Job created → appears in "My Jobs"
 * 3. Customer upserted → appears in "Customers"
 * 4. Stats updated
 */
export const acceptQuote = async (contractorId, quoteId, customerMessage = '') => {
    const batch = writeBatch(db);
    
    try {
        // ============================================
        // STEP 1: Get the quote data
        // ============================================
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        
        if (!quoteSnap.exists()) {
            throw new Error('Quote not found');
        }
        
        const quote = quoteSnap.data();
        
        // Prevent double-acceptance
        if (quote.status === 'accepted') {
            throw new Error('Quote has already been accepted');
        }
        
        // ============================================
        // STEP 2: Get Contractor Profile for name
        // ============================================
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        const contractorProfile = contractorSnap.exists() ? contractorSnap.data().profile : null;
        
        // ============================================
        // STEP 3: Create the Job
        // ============================================
        const jobNumber = await generateJobNumber(contractorId);
        const jobRef = doc(collection(db, REQUESTS_COLLECTION_PATH));
        
        const jobData = {
            // Identity
            id: jobRef.id,
            jobNumber,
            
            // Link to source
            sourceType: 'quote',
            sourceQuoteId: quoteId,
            sourceQuoteNumber: quote.quoteNumber,
            
            // Contractor ownership
            contractorId,
            
            // NEW: Contractor display info
            contractorName: contractorProfile?.companyName || contractorProfile?.displayName || 'Contractor',
            contractorPhone: contractorProfile?.phone || null,
            contractorEmail: contractorProfile?.email || null,
            
            // Customer info (copied from quote)
            customer: {
                name: quote.customer?.name || '',
                email: quote.customer?.email || '',
                phone: quote.customer?.phone || '',
                address: quote.customer?.address || ''
            },
            customerId: quote.customerId || null,
            
            // FIX: Add createdBy to match direct service requests
            createdBy: quote.customerId || null,
            
            // Service address (for routing/display)
            serviceAddress: quote.customer?.address ? {
                formatted: quote.customer.address,
                street: quote.customer.address,
                // Note: For full geo support, you'd parse/geocode the address
            } : null,
            
            // Job details (from quote)
            title: quote.title,
            description: quote.notes || '',
            lineItems: quote.lineItems || [],
            
            // Financials
            subtotal: quote.subtotal || 0,
            taxRate: quote.taxRate || 0,
            taxAmount: quote.taxAmount || 0,
            total: quote.total || 0,
            
            // Status
            status: JOB_STATUSES.PENDING_SCHEDULE,
            
            // Scheduling (to be filled later)
            scheduledDate: null,
            scheduledTime: null,
            estimatedDuration: null,
            
            // Work tracking
            workNotes: [],
            attachments: [],
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActivity: serverTimestamp(),
            acceptedAt: serverTimestamp(),
            scheduledAt: null,
            startedAt: null,
            completedAt: null,
            
            // Customer message on acceptance
            customerAcceptanceMessage: customerMessage || null
        };
        
        batch.set(jobRef, jobData);
        
        // ============================================
        // STEP 4: Update the Quote
        // ============================================
        batch.update(quoteRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            customerMessage: customerMessage || null,
            convertedToJobId: jobRef.id,
            updatedAt: serverTimestamp()
        });
        
        // ============================================
        // STEP 5: Upsert Customer Record
        // ============================================
        const customerId = quote.customerId || 
            (quote.customer?.email 
                ? `email_${quote.customer.email.replace(/[^a-zA-Z0-9]/g, '_')}`
                : `quote_${quoteId}`);
        
        const customerRef = doc(
            db, 
            CONTRACTORS_COLLECTION, 
            contractorId, 
            CUSTOMERS_SUBCOLLECTION, 
            customerId
        );
        
        const customerSnap = await getDoc(customerRef);
        
        if (customerSnap.exists()) {
            // Update existing customer
            const existing = customerSnap.data();
            batch.update(customerRef, {
                customerName: quote.customer?.name || existing.customerName,
                email: quote.customer?.email || existing.email,
                phone: quote.customer?.phone || existing.phone,
                address: quote.customer?.address || existing.address,
                lastContact: serverTimestamp(),
                totalJobs: increment(1),
                totalSpend: increment(quote.total || 0),
                quoteIds: [...(existing.quoteIds || []), quoteId],
                jobIds: [...(existing.jobIds || []), jobRef.id],
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new customer
            batch.set(customerRef, {
                id: customerId,
                customerName: quote.customer?.name || '',
                email: quote.customer?.email || '',
                phone: quote.customer?.phone || '',
                address: quote.customer?.address || '',
                source: 'quote',
                firstContact: serverTimestamp(),
                lastContact: serverTimestamp(),
                totalJobs: 1,
                totalSpend: quote.total || 0,
                quoteIds: [quoteId],
                jobIds: [jobRef.id],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        // ============================================
        // STEP 6: Update Contractor Stats
        // ============================================
        // Reuse existing contractorRef from Step 2
        batch.update(contractorRef, {
            'profile.stats.acceptedQuotes': increment(1),
            'profile.stats.totalJobValue': increment(quote.total || 0),
            'profile.stats.activeJobs': increment(1),
            updatedAt: serverTimestamp()
        });
        
        // ============================================
        // STEP 7: Commit the batch
        // ============================================
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
            where('expiresAt', '<', now)
        );
        
        const snapshot = await getDocs(q);
        
        const updates = snapshot.docs.map(async (docSnap) => {
            await updateDoc(docSnap.ref, {
                status: 'expired',
                updatedAt: serverTimestamp()
            });
        });
        
        await Promise.all(updates);
        
        return { expiredCount: snapshot.size };
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
        
        await setDoc(templateRef, {
            id: templateRef.id,
            name: templateData.name || 'Untitled Template',
            category: templateData.category || 'General',
            lineItems: templateData.lineItems || [],
            defaultNotes: templateData.defaultNotes || '',
            defaultTerms: templateData.defaultTerms || '',
            defaultWarranty: templateData.defaultWarranty || '', // New field for template warranties
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
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
 * Convert a quote to a job
 * This creates a link between the quote and job
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
// QUOTE STATS
// ============================================

/**
 * Get quote statistics for the dashboard
 */
export const getQuoteStats = async (contractorId) => {
    try {
        const quotesRef = collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION);
        
        // Get all quotes
        const snapshot = await getDocs(quotesRef);
        const quotes = snapshot.docs.map(doc => doc.data());
        
        // Calculate stats
        const stats = {
            total: quotes.length,
            draft: quotes.filter(q => q.status === 'draft').length,
            pending: quotes.filter(q => ['sent', 'viewed'].includes(q.status)).length,
            accepted: quotes.filter(q => q.status === 'accepted').length,
            declined: quotes.filter(q => q.status === 'declined').length,
            expired: quotes.filter(q => q.status === 'expired').length,
            totalValue: quotes.reduce((sum, q) => sum + (q.total || 0), 0),
            acceptedValue: quotes
                .filter(q => q.status === 'accepted')
                .reduce((sum, q) => sum + (q.total || 0), 0),
            conversionRate: quotes.length > 0 
                ? (quotes.filter(q => q.status === 'accepted').length / quotes.length * 100).toFixed(1)
                : 0
        };
        
        return stats;
    } catch (error) {
        console.error('Error getting quote stats:', error);
        throw error;
    }
};

// ============================================
// PUBLIC QUOTE ACCESS (for customer viewing)
// ============================================

/**
 * Get a quote by its public share token
 * This is used when customers view their quote via a link
 */
export const getQuoteByShareToken = async (shareToken) => {
    try {
        // The share token format is: {contractorId}_{quoteId}
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
        
        const contractorProfile = contractorSnap.exists() 
            ? contractorSnap.data().profile 
            : null;
        
        return {
            quote: { id: quoteSnap.id, ...quoteSnap.data() },
            contractor: contractorProfile,
            contractorId
        };
    } catch (error) {
        console.error('Error getting quote by share token:', error);
        throw error;
    }
};

/**
 * Generate a share link for a quote
 */
export const generateQuoteShareLink = (contractorId, quoteId) => {
    const shareToken = `${contractorId}_${quoteId}`;
    // Updated to point to /app?quote=... to avoid hitting the marketing landing page
    return `${window.location.origin}/app/?quote=${shareToken}`;
};

/**
 * Claim a quote for a specific user (homeowner)
 */
export const claimQuote = async (contractorId, quoteId, userId) => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            customerId: userId,
            // Optional: You could also change status to 'viewed' or keep it as is
            updatedAt: serverTimestamp()
        });
        
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
