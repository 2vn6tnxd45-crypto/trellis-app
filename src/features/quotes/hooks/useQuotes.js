// src/features/quotes/lib/quoteService.js
// MINIMAL STUB VERSION - to isolate circular dependency issue

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    deleteDoc,
    addDoc,
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

// HARDCODED VALUES - NO IMPORTS FROM CONSTANTS
const appId = 'krib-app';
const CONTRACTORS_COLLECTION = `/artifacts/${appId}/public/data/contractors`;
const REQUESTS_COLLECTION_PATH = `/artifacts/${appId}/public/data/requests`;
const QUOTES_SUBCOLLECTION = 'quotes';
const QUOTE_TEMPLATES_SUBCOLLECTION = 'quoteTemplates';
const CUSTOMERS_SUBCOLLECTION = 'customers';

console.log('✅ quoteService.js loaded successfully');

export const JOB_STATUSES = {
    PENDING_SCHEDULE: 'pending_schedule',
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

export async function generateQuoteNumber(contractorId) {
    const year = new Date().getFullYear();
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
        where('createdYear', '==', year)
    );
    const snapshot = await getDocs(q);
    return `Q-${year}-${(snapshot.size + 1).toString().padStart(3, '0')}`;
}

export async function createQuote(contractorId, quoteData) {
    console.log('createQuote called:', contractorId);
    const quoteNumber = await generateQuoteNumber(contractorId);
    const year = new Date().getFullYear();
    
    const subtotal = (quoteData.lineItems || []).reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0
    );
    const taxAmount = subtotal * ((quoteData.taxRate || 0) / 100);
    const total = subtotal + taxAmount;
    
    let depositAmount = 0;
    if (quoteData.depositRequired) {
        depositAmount = quoteData.depositType === 'percentage' 
            ? total * ((quoteData.depositValue || 0) / 100)
            : quoteData.depositValue || 0;
    }

    const quoteRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION));
    
    await setDoc(quoteRef, {
        id: quoteRef.id,
        quoteNumber,
        createdYear: year,
        status: quoteData.status || 'draft',
        customer: {
            name: quoteData.customer?.name || '',
            email: quoteData.customer?.email || '',
            phone: quoteData.customer?.phone || '',
            address: quoteData.customer?.address || ''
        },
        customerId: quoteData.customerId || null,
        title: quoteData.title || '',
        lineItems: quoteData.lineItems || [],
        subtotal,
        taxRate: quoteData.taxRate || 0,
        taxAmount,
        total,
        depositRequired: quoteData.depositRequired || false,
        depositType: quoteData.depositType || 'percentage',
        depositValue: quoteData.depositValue || 0,
        depositAmount,
        notes: quoteData.notes || '',
        exclusions: quoteData.exclusions || '',
        clientWarranty: quoteData.clientWarranty || '',
        terms: quoteData.terms || 'Quote valid for 14 days.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expiresAt: quoteData.expiresAt || null,
        sentAt: null,
        viewedAt: null,
        acceptedAt: null,
        declinedAt: null,
        viewCount: 0,
        lastViewedAt: null,
        convertedToInvoiceId: null,
        convertedToJobId: null
    });
    
    return { success: true, quoteId: quoteRef.id, quoteNumber };
}

export async function updateQuote(contractorId, quoteId, quoteData) {
    console.log('updateQuote called:', contractorId, quoteId);
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, { ...quoteData, updatedAt: serverTimestamp() });
    return { success: true };
}

export async function deleteQuote(contractorId, quoteId) {
    console.log('deleteQuote called:', contractorId, quoteId);
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await deleteDoc(quoteRef);
    return { success: true };
}

export async function getQuote(contractorId, quoteId) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) return null;
    return { id: quoteSnap.id, ...quoteSnap.data() };
}

export async function getQuotes(contractorId) {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeToQuotes(contractorId, callback) {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => callback([]));
}

export async function sendQuote(contractorId, quoteId) {
    console.log('sendQuote called:', contractorId, quoteId);
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true };
}

export async function markQuoteViewed(contractorId, quoteId) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, {
        viewCount: increment(1),
        lastViewedAt: serverTimestamp(),
        status: 'viewed',
        viewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true };
}

export async function acceptQuote(contractorId, quoteId, customerMessage = '') {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        customerMessage: customerMessage || null,
        updatedAt: serverTimestamp()
    });
    return { success: true };
}

export async function declineQuote(contractorId, quoteId, reason = '') {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, {
        status: 'declined',
        declinedAt: serverTimestamp(),
        declineReason: reason,
        updatedAt: serverTimestamp()
    });
    return { success: true };
}

export async function checkExpiredQuotes() {
    return { expiredCount: 0 };
}

export async function createQuoteTemplate(contractorId, templateData) {
    const templateRef = doc(collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION));
    await setDoc(templateRef, {
        id: templateRef.id,
        name: templateData.name || 'Untitled',
        category: templateData.category || 'General',
        lineItems: templateData.lineItems || [],
        defaultNotes: templateData.defaultNotes || '',
        defaultTerms: templateData.defaultTerms || '',
        defaultWarranty: templateData.defaultWarranty || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return { success: true, templateId: templateRef.id };
}

export async function getQuoteTemplates(contractorId) {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION),
        orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function subscribeToQuoteTemplates(contractorId, callback) {
    const q = query(
        collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION),
        orderBy('name', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => callback([]));
}

export async function deleteQuoteTemplate(contractorId, templateId) {
    const templateRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION, templateId);
    await deleteDoc(templateRef);
    return { success: true };
}

export async function linkQuoteToInvoice(contractorId, quoteId, invoiceId) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, { convertedToInvoiceId: invoiceId, updatedAt: serverTimestamp() });
    return { success: true };
}

export async function linkQuoteToJob(contractorId, quoteId, jobId) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, { convertedToJobId: jobId, updatedAt: serverTimestamp() });
    return { success: true };
}

export async function getQuoteStats(contractorId) {
    const quotesRef = collection(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION);
    const snapshot = await getDocs(quotesRef);
    const quotes = snapshot.docs.map(d => d.data());
    return {
        total: quotes.length,
        draft: quotes.filter(q => q.status === 'draft').length,
        pending: quotes.filter(q => ['sent', 'viewed'].includes(q.status)).length,
        accepted: quotes.filter(q => q.status === 'accepted').length,
        declined: quotes.filter(q => q.status === 'declined').length,
        expired: quotes.filter(q => q.status === 'expired').length,
        totalValue: quotes.reduce((sum, q) => sum + (q.total || 0), 0),
        acceptedValue: quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + (q.total || 0), 0),
        conversionRate: quotes.length > 0 ? (quotes.filter(q => q.status === 'accepted').length / quotes.length * 100).toFixed(1) : 0
    };
}

export async function getQuoteByShareToken(shareToken) {
    const [contractorId, quoteId] = shareToken.split('_');
    if (!contractorId || !quoteId) throw new Error('Invalid share token');
    
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) return null;
    
    const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
    const contractorSnap = await getDoc(contractorRef);
    
    return {
        quote: { id: quoteSnap.id, ...quoteSnap.data() },
        contractor: contractorSnap.exists() ? contractorSnap.data().profile : null,
        contractorId
    };
}

export function generateQuoteShareLink(contractorId, quoteId) {
    return `${window.location.origin}/app/?quote=${contractorId}_${quoteId}`;
}

export async function claimQuote(contractorId, quoteId, userId, propertyId = null) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    const updateData = { customerId: userId, claimedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (propertyId) updateData.propertyId = propertyId;
    await updateDoc(quoteRef, updateData);
    return { success: true };
}

export async function unclaimQuote(contractorId, quoteId) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, { customerId: null, updatedAt: serverTimestamp() });
    return { success: true };
}
