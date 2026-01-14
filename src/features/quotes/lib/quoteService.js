// src/features/quotes/lib/quoteService.js
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
import { parseAddressString } from '../../../lib/addressUtils';

// HARDCODED to avoid circular dependency issues
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

const generateJobNumber = async () => {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const suffix = Date.now().toString().slice(-4);
    return `JOB-${year}${month}-${suffix}`;
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

    // Extract inventory intents from line items that have "Add to Home Record" enabled
    const inventoryIntents = (quoteData.lineItems || [])
        .filter(item => item.addToHomeRecord && item.inventoryIntent)
        .map(item => ({
            ...item.inventoryIntent,
            linkedLineItemId: item.id,
            // Sync key fields from line item to intent
            item: item.inventoryIntent.item || item.description || '',
            brand: item.inventoryIntent.brand || item.brand || '',
            model: item.inventoryIntent.model || item.model || '',
            warranty: item.inventoryIntent.warranty || item.warranty || '',
            cost: (item.quantity || 1) * (item.unitPrice || 0),
        }));

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
        // NEW: Store inventory intents separately for easy access
        inventoryIntents: inventoryIntents,
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
        estimatedDuration: quoteData.estimatedDuration || '',

        // FINANCING: Ready for future integration with GreenSky, Wisetack, Hearth, etc.
        financing: {
            offered: false,
            status: 'not_offered',  // not_offered | offered | applied | approved | declined | funded
            provider: null,
            applicationId: null,
            approvedAmount: null,
            terms: null,            // { apr, termMonths, monthlyPayment }
            appliedAt: null,
            approvedAt: null,
            fundedAt: null
        },

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

    // Get the quote data first
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    const quoteSnap = await getDoc(quoteRef);

    if (!quoteSnap.exists()) {
        throw new Error('Quote not found');
    }

    const quote = quoteSnap.data();

    // Get contractor profile for name/phone
    const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
    const contractorSnap = await getDoc(contractorRef);
    const contractorProfile = contractorSnap.exists() ? contractorSnap.data().profile : null;

    // Update quote status
    await updateDoc(quoteRef, {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Send email notification to customer (non-blocking)
    if (quote.customer?.email) {
        const quoteLink = `https://mykrib.app/app/?quote=${contractorId}_${quoteId}`;

        fetch('/api/send-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerEmail: quote.customer.email,
                customerName: quote.customer.name || 'there',
                contractorName: contractorProfile?.companyName || contractorProfile?.displayName || 'Your Contractor',
                contractorPhone: contractorProfile?.phone || null,
                quoteTitle: quote.title || 'Service Quote',
                quoteTotal: quote.total || 0,
                lineItemCount: quote.lineItems?.length || 1,
                quoteLink: quoteLink,
                expiresAt: quote.validUntil || null
            })
        }).then(res => {
            if (res.ok) {
                console.log('[sendQuote] Email sent to customer:', quote.customer.email);
            } else {
                console.warn('[sendQuote] Email failed:', res.status);
            }
        }).catch(err => {
            console.warn('[sendQuote] Email error:', err);
        });
    } else {
        console.warn('[sendQuote] No customer email - skipping notification');
    }

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

// ============================================
// ACCEPT QUOTE - FULL VERSION THAT CREATES JOB
// ============================================
export async function acceptQuote(contractorId, quoteId, customerMessage = '') {
    const batch = writeBatch(db);

    try {
        // STEP 1: Get the quote data
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

        // STEP 2: Get Contractor Profile
        const contractorRef = doc(db, CONTRACTORS_COLLECTION, contractorId);
        const contractorSnap = await getDoc(contractorRef);
        const contractorProfile = contractorSnap.exists() ? contractorSnap.data().profile : null;

        // STEP 3: Create the Job
        const jobNumber = await generateJobNumber();
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
            contractorName: contractorProfile?.companyName || contractorProfile?.displayName || 'Contractor',
            contractorPhone: contractorProfile?.phone || null,
            contractorEmail: contractorProfile?.email || null,

            // Stripe info for payment processing on job completion
            stripeAccountId: contractorSnap.exists() ? (contractorSnap.data().stripe?.accountId || null) : null,
            stripeReady: contractorSnap.exists() ? Boolean(contractorSnap.data().stripe?.isComplete && contractorSnap.data().stripe?.chargesEnabled) : false,

            // Customer info (copied from quote)
            customer: {
                name: quote.customer?.name || '',
                email: quote.customer?.email || '',
                phone: quote.customer?.phone || '',
                address: quote.customer?.address || ''
            },
            customerId: quote.customerId || null,
            createdBy: quote.customerId || null,

            // Service address - parse the formatted string into components
            serviceAddress: quote.customer?.address ? {
                formatted: quote.customer.address,
                ...parseAddressString(quote.customer.address)
            } : null,

            // Job details
            title: quote.title,
            description: quote.notes || '',
            lineItems: quote.lineItems || [],

            // INVENTORY INTENTS: Items that will become home records on completion
            // These flow from Quote → Job → Completion → House Record
            inventoryIntents: quote.inventoryIntents || [],

            // Financials
            // Financials
            subtotal: quote.subtotal || 0,
            taxRate: quote.taxRate || 0,
            taxAmount: quote.taxAmount || 0,
            total: quote.total || 0,

            // Financing (carried from quote)
            financing: quote.financing || {
                offered: false,
                status: 'not_offered',
                provider: null,
                applicationId: null,
                approvedAmount: null,
                terms: null,
                appliedAt: null,
                approvedAt: null,
                fundedAt: null
            },

            // Status - PENDING_SCHEDULE so homeowner sees it in Active Projects
            status: JOB_STATUSES.PENDING_SCHEDULE,

            // Scheduling (to be filled later)
            scheduledDate: null,
            scheduledTime: null,
            estimatedDuration: quote.estimatedDuration || null,

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
        console.log('Creating job with customerId:', quote.customerId, 'createdBy:', quote.customerId);

        // STEP 4: Update the Quote
        batch.update(quoteRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            customerMessage: customerMessage || null,
            convertedToJobId: jobRef.id,
            updatedAt: serverTimestamp()
        });

        // STEP 5: Upsert Customer Record
        const customerId = quote.customerId ||
            (quote.customer?.email
                ? quote.customer.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
                : `customer_${Date.now()}`);

        const customerRef = doc(db, CONTRACTORS_COLLECTION, contractorId, CUSTOMERS_SUBCOLLECTION, customerId);
        const customerSnap = await getDoc(customerRef);

        if (customerSnap.exists()) {
            batch.update(customerRef, {
                totalJobs: increment(1),
                totalSpend: increment(quote.total || 0),
                lastContact: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } else {
            batch.set(customerRef, {
                id: customerId,
                customerName: quote.customer?.name || '',
                email: quote.customer?.email || '',
                phone: quote.customer?.phone || '',
                propertyName: quote.customer?.address || '',
                totalJobs: 1,
                totalSpend: quote.total || 0,
                firstContact: serverTimestamp(),
                lastContact: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        // STEP 6: Update Contractor Stats
        batch.update(contractorRef, {
            'profile.stats.acceptedQuotes': increment(1),
            'profile.stats.totalJobValue': increment(quote.total || 0),
            'profile.stats.activeJobs': increment(1),
            updatedAt: serverTimestamp()
        });

        // STEP 7: Commit the batch
        // STEP 7: Commit the batch
        await batch.commit();

        console.log(`✅ Quote ${quoteId} accepted → Job ${jobRef.id} created`);

        // STEP 8: Send email notification to contractor (non-blocking)
        if (contractorProfile?.email) {
            fetch('/api/send-quote-accepted', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractorEmail: contractorProfile.email,
                    contractorName: contractorProfile.companyName || contractorProfile.displayName || 'there',
                    customerName: quote.customer?.name || 'A customer',
                    customerEmail: quote.customer?.email || null,
                    customerPhone: quote.customer?.phone || null,
                    customerAddress: quote.customer?.address || null,
                    quoteTitle: quote.title || 'Service Quote',
                    quoteNumber: quote.quoteNumber || '',
                    quoteTotal: quote.total || 0,
                    customerMessage: customerMessage || null,
                    dashboardLink: 'https://mykrib.app/app/?pro'
                })
            }).then(res => {
                if (res.ok) {
                    console.log('[acceptQuote] Email sent to contractor:', contractorProfile.email);
                } else {
                    console.warn('[acceptQuote] Email failed:', res.status);
                }
            }).catch(err => {
                console.warn('[acceptQuote] Email error:', err);
            });
        } else {
            console.warn('[acceptQuote] No contractor email - skipping notification');
        }

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

export async function updateQuoteTemplate(contractorId, templateId, templateData) {
    const templateRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTE_TEMPLATES_SUBCOLLECTION, templateId);
    await updateDoc(templateRef, {
        ...templateData,
        updatedAt: serverTimestamp()
    });
    return { success: true };
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

    // Get both profile and stripe data for payment processing
    const contractorData = contractorSnap.exists() ? contractorSnap.data() : null;

    return {
        quote: { id: quoteSnap.id, ...quoteSnap.data() },
        contractor: contractorData ? {
            ...contractorData.profile,
            stripe: contractorData.stripe || null
        } : null,
        contractorId
    };
}

export function generateQuoteShareLink(contractorId, quoteId) {
    return `${window.location.origin}/app/?quote=${contractorId}_${quoteId}`;
}

export async function claimQuote(contractorId, quoteId, userId, propertyId = null) {
    console.log('claimQuote called:', { contractorId, quoteId, userId, propertyId });
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    const updateData = {
        customerId: userId,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };
    if (propertyId) updateData.propertyId = propertyId;
    await updateDoc(quoteRef, updateData);
    console.log('✅ Quote claimed, customerId set to:', userId);
    return { success: true };
}

export async function unclaimQuote(contractorId, quoteId) {
    const quoteRef = doc(db, CONTRACTORS_COLLECTION, contractorId, QUOTES_SUBCOLLECTION, quoteId);
    await updateDoc(quoteRef, { customerId: null, updatedAt: serverTimestamp() });
    return { success: true };
}

// ============================================
// ADD CONTRACTOR TO HOMEOWNER'S PROS LIST
// ============================================
/**
 * Adds a contractor to homeowner's "My Pros" list when they claim a quote.
 * Checks for duplicates first - won't add if contractor already exists.
 */
export async function addContractorToProsList(userId, contractorData, quoteTitle = '') {
    if (!userId || !contractorData?.contractorId) {
        console.warn('addContractorToProsList: Missing userId or contractorId');
        return { success: false, reason: 'missing-params' };
    }

    try {
        const prosRef = collection(db, 'artifacts', appId, 'users', userId, 'pros');

        // Check if this contractor already exists in pros list
        const existingQuery = query(prosRef, where('contractorId', '==', contractorData.contractorId));
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
            console.log('Contractor already in pros list, skipping add');
            return { success: true, alreadyExists: true };
        }

        // Add to pros list
        await addDoc(prosRef, {
            name: contractorData.companyName || contractorData.displayName || 'Contractor',
            contractorId: contractorData.contractorId,
            phone: contractorData.phone || null,
            email: contractorData.email || null,
            logoUrl: contractorData.logoUrl || null,
            specialty: quoteTitle || null,
            isOnPlatform: true,
            addedAt: serverTimestamp(),
            addedFrom: 'quote'
        });

        console.log('✅ Contractor added to pros list:', contractorData.companyName);
        return { success: true, alreadyExists: false };

    } catch (error) {
        console.warn('Could not add contractor to pros list:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// CREATE CHAT CHANNEL FOR QUOTE DISCUSSION
// ============================================
/**
 * Creates a chat channel between homeowner and contractor for quote discussion.
 * This enables messaging before quote acceptance (negotiation).
 */
export async function createQuoteChatChannel(
    homeownerId,
    contractorId,
    contractorName,
    homeownerName,
    quoteId,
    quoteTitle
) {
    if (!homeownerId || !contractorId) {
        console.warn('createQuoteChatChannel: Missing homeownerId or contractorId');
        return { success: false, reason: 'missing-params' };
    }

    try {
        // Channel ID format: homeownerId_contractorId
        const channelId = `${homeownerId}_${contractorId}`;
        const channelRef = doc(db, 'channels', channelId);

        // Check if channel already exists
        const channelSnap = await getDoc(channelRef);

        const channelData = {
            channelId,
            participants: [homeownerId, contractorId],
            homeownerName: homeownerName || 'Homeowner',
            contractorName: contractorName || 'Contractor',
            source: 'quote',
            linkedQuoteId: quoteId || null,
            scopeOfWork: quoteTitle || null,
            lastMessageTime: serverTimestamp(),
            createdAt: channelSnap.exists() ? channelSnap.data().createdAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(channelRef, channelData, { merge: true });

        console.log('✅ Chat channel created/updated:', channelId);
        return { success: true, channelId };

    } catch (error) {
        console.warn('Could not create chat channel:', error);
        return { success: false, error: error.message };
    }
}
