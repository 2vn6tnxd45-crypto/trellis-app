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
    increment
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CONTRACTORS_COLLECTION_PATH } from '../../../config/constants';

// Collection paths
const CONTRACTORS_COLLECTION = CONTRACTORS_COLLECTION_PATH || 'contractors';
const QUOTES_SUBCOLLECTION = 'quotes';
const QUOTE_TEMPLATES_SUBCOLLECTION = 'quoteTemplates';

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
            
            // Content
            notes: quoteData.notes || '',
            terms: quoteData.terms || 'Quote valid for 14 days. 50% deposit required to schedule work.',
            
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
 * Accept a quote
 */
export const acceptQuote = async (contractorId, quoteId, customerMessage = '') => {
    try {
        const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
        
        await updateDoc(quoteRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            customerMessage,
            updatedAt: serverTimestamp()
        });
        
        // Update contractor stats
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        await updateDoc(contractorRef, {
            'profile.stats.acceptedQuotes': increment(1),
            updatedAt: serverTimestamp()
        });
        
        return { success: true };
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
    return `${window.location.origin}/app?quote=${shareToken}`;
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
    generateQuoteShareLink
};
