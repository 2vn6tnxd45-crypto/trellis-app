// src/features/jobs/lib/jobCompletionService.js
// ============================================
// JOB COMPLETION SERVICE
// ============================================
// All database operations for job completion flow

import {
    doc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../config/firebase';
import {
    REQUESTS_COLLECTION_PATH,
    CONTRACTORS_COLLECTION_PATH,
    appId
} from '../../../config/constants';
import { formatAddress } from '../../../lib/addressUtils';

// ============================================
// CONSTANTS
// ============================================

export const AUTO_CLOSE_DAYS = 7;
export const REMINDER_DAYS = 2;

export const COMPLETION_STATUS = {
    PENDING_COMPLETION: 'pending_completion',
    REVISION_REQUESTED: 'revision_requested',
    COMPLETED: 'completed'
};

export const RATING_CATEGORIES = {
    homeownerToContractor: ['quality', 'timeliness', 'communication', 'value'],
    contractorToHomeowner: ['propertyAccess', 'communication', 'payment']
};

// ============================================
// INVOICE GENERATION
// ============================================

/**
 * Generate a draft invoice from job data
 * Called automatically when contractor submits job completion
 * @param {object} jobData - The job document data
 * @param {string} jobId - The job document ID
 * @param {string} contractorId - The contractor's ID
 * @returns {object} - { invoiceId, invoiceNumber } or null if no line items
 */
const generateDraftInvoiceFromJob = async (jobData, jobId, contractorId) => {
    try {
        // Only generate if job has line items with pricing
        const lineItems = jobData.lineItems || jobData.quoteItems || [];
        if (lineItems.length === 0) {
            console.log('No line items found, skipping invoice generation');
            return null;
        }

        // Generate invoice number
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

        // Map line items to invoice format
        const invoiceItems = lineItems.map((item, idx) => {
            const quantity = item.quantity || 1;
            const unitPrice = item.unitPrice || item.price || 0;
            const totalCost = item.amount || item.cost || (unitPrice * quantity);

            return {
                id: idx + 1,
                description: item.description || item.item || item.name || 'Service',
                cost: totalCost.toString(),
                notes: item.notes || ''
            };
        });

        // Calculate total
        const total = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);

        // Get customer info from job
        const customerName = jobData.customerName || jobData.customer?.name || 'Customer';
        const customerEmail = jobData.customerEmail || jobData.customer?.email || '';
        const customerAddress = jobData.serviceAddress
            ? formatAddress(jobData.serviceAddress)
            : (jobData.propertyName || '');

        // Set due date to 7 days from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        // Create the invoice document
        const invoiceData = {
            invoiceNumber,
            customerId: jobData.createdBy || '',
            customerName,
            customerEmail,
            customerAddress,
            date: new Date().toISOString().split('T')[0],
            dueDate: dueDate.toISOString().split('T')[0],
            items: invoiceItems,
            taxRate: 0,
            notes: 'Thank you for your business!',
            status: 'draft',
            total,
            contractorId,
            contractorName: jobData.contractorName || jobData.contractor || '',
            // Link back to job
            sourceJobId: jobId,
            sourceQuoteId: jobData.sourceQuoteId || null,
            createdAt: serverTimestamp(),
            generatedFrom: 'job_completion'
        };

        // Save to contractor's invoices collection
        const invoiceCollectionRef = collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'invoices');
        const invoiceDocRef = await addDoc(invoiceCollectionRef, invoiceData);

        console.log('Draft invoice generated:', invoiceDocRef.id);

        return {
            invoiceId: invoiceDocRef.id,
            invoiceNumber,
            total
        };

    } catch (error) {
        // Log but don't throw - invoice generation is non-critical
        console.error('Error generating draft invoice:', error);
        return null;
    }
};

// ============================================
// CONTRACTOR ACTIONS
// ============================================

/**
 * Submit job completion from contractor side
 * @param {string} jobId - The job/request document ID
 * @param {object} completionData - All completion data
 * @param {string} contractorId - The contractor's ID
 */
export const submitJobCompletion = async (jobId, completionData, contractorId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);
        
        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }
        
        const jobData = jobSnap.data();
        
        // Validate job is in correct status
        if (!['scheduled', 'in_progress'].includes(jobData.status)) {
            throw new Error(`Cannot complete job with status: ${jobData.status}`);
        }
        
        // Calculate auto-close date
        const autoCloseAt = new Date();
        autoCloseAt.setDate(autoCloseAt.getDate() + AUTO_CLOSE_DAYS);
        
        // Prepare completion object
        const completion = {
            submittedAt: serverTimestamp(),
            submittedBy: 'contractor',
            contractorId: contractorId,
            
            // Invoice data (required)
            invoice: completionData.invoice,
            
            // Items to import
            itemsToImport: (completionData.items || []).map((item, idx) => ({
                id: `item_${Date.now()}_${idx}`,
                ...item,
                importStatus: 'pending'
            })),
            
            // Notes and recommendations
            notes: completionData.notes || '',
            recommendations: completionData.recommendations || '',
            nextServiceSuggestion: completionData.nextServiceSuggestion || null,
            
            // Photos
            photos: completionData.photos || [],
            
            // Review status
            reviewedAt: null,
            reviewedBy: null,
            reviewStatus: 'pending',
            
            // Auto-close
            autoCloseAt: Timestamp.fromDate(autoCloseAt),
            wasAutoCompleted: false
        };
        
        // Handle partial completion
        if (completionData.isPartial) {
            completion.partialCompletion = {
                isPartial: true,
                completedItems: completionData.completedItemIds || [],
                remainingItems: completionData.remainingItemIds || [],
                reason: completionData.partialReason || '',
                followUpJobId: null
            };
        }

        // Generate draft invoice from job line items (if available)
        const invoiceResult = await generateDraftInvoiceFromJob(jobData, jobId, contractorId);

        // Update the job document
        const updateData = {
            status: COMPLETION_STATUS.PENDING_COMPLETION,
            completion: completion,
            lastActivity: serverTimestamp()
        };

        // If invoice was generated, link it to the job
        if (invoiceResult) {
            updateData.generatedInvoiceId = invoiceResult.invoiceId;
            updateData.generatedInvoiceNumber = invoiceResult.invoiceNumber;
        }

        await updateDoc(jobRef, updateData);

        return {
            success: true,
            jobId,
            invoiceGenerated: !!invoiceResult,
            invoiceId: invoiceResult?.invoiceId || null,
            invoiceNumber: invoiceResult?.invoiceNumber || null
        };
        
    } catch (error) {
        console.error('Error submitting job completion:', error);
        throw error;
    }
};

/**
 * Upload invoice file and return URL
 */
export const uploadInvoiceFile = async (jobId, file, contractorId) => {
    try {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storagePath = `jobs/${jobId}/invoices/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        return {
            url,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            storagePath
        };
    } catch (error) {
        console.error('Error uploading invoice:', error);
        throw error;
    }
};

/**
 * Upload completion photo
 */
export const uploadCompletionPhoto = async (jobId, file, type = 'work') => {
    try {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storagePath = `jobs/${jobId}/photos/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        return {
            url,
            type,
            caption: '',
            uploadedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error uploading photo:', error);
        throw error;
    }
};

/**
 * Resubmit after revision request
 */
export const resubmitAfterRevision = async (jobId, updates, contractorId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);
        
        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }
        
        const jobData = jobSnap.data();
        
        if (jobData.status !== COMPLETION_STATUS.REVISION_REQUESTED) {
            throw new Error('Job is not in revision requested status');
        }
        
        // Calculate new auto-close date
        const autoCloseAt = new Date();
        autoCloseAt.setDate(autoCloseAt.getDate() + AUTO_CLOSE_DAYS);
        
        // Merge updates with existing completion
        const updatedCompletion = {
            ...jobData.completion,
            ...updates,
            resubmittedAt: serverTimestamp(),
            reviewStatus: 'pending',
            autoCloseAt: Timestamp.fromDate(autoCloseAt),
            revisionRequest: {
                ...jobData.completion.revisionRequest,
                resolvedAt: serverTimestamp()
            }
        };
        
        await updateDoc(jobRef, {
            status: COMPLETION_STATUS.PENDING_COMPLETION,
            completion: updatedCompletion,
            lastActivity: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error resubmitting completion:', error);
        throw error;
    }
};

/**
 * Rate homeowner (contractor action)
 */
export const rateHomeowner = async (jobId, contractorId, rating) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        
        const ratingData = {
            overall: rating.overall,
            categories: {
                propertyAccess: rating.propertyAccess || rating.overall,
                communication: rating.communication || rating.overall,
                payment: rating.payment || rating.overall
            },
            notes: rating.notes || '',
            submittedAt: serverTimestamp(),
            isPublic: false // Homeowner ratings are always private
        };
        
        await updateDoc(jobRef, {
            'ratings.contractorToHomeowner': ratingData
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error rating homeowner:', error);
        throw error;
    }
};

// ============================================
// HOMEOWNER ACTIONS
// ============================================

/**
 * Accept job completion and import items to inventory
 */
export const acceptJobCompletion = async (jobId, userId, propertyId, itemSelections = null) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);
        
        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }
        
        const jobData = jobSnap.data();
        
        if (jobData.status !== COMPLETION_STATUS.PENDING_COMPLETION) {
            throw new Error('Job is not pending completion');
        }
        
        const completion = jobData.completion;
        const itemsToImport = completion.itemsToImport || [];
        
        // Use batch for atomic operations
        const batch = writeBatch(db);
        const importedRecordIds = [];
        
        // Import selected items to house_records
        const recordsRef = collection(db, 'artifacts', appId, 'users', userId, 'house_records');
        
        for (const item of itemsToImport) {
            // Check if item should be imported
            const selection = itemSelections?.[item.id];
            if (selection?.skip) {
                continue;
            }
            
            // Merge any modifications from homeowner
            const finalItem = selection?.modifications 
                ? { ...item, ...selection.modifications }
                : item;
            
            // Determine install date
            const installDate = finalItem.dateInstalled || new Date().toISOString().split('T')[0];
            
            // Process maintenance tasks (add nextDueDate to each)
            const processedTasks = processMaintenanceTasks(
                finalItem.maintenanceTasks, 
                installDate
            );
            
            // Calculate overall frequency from tasks (use shortest interval)
            // Fall back to item's maintenanceFrequency if no tasks
            const overallFrequency = processedTasks.length > 0
                ? getShortestFrequencyFromTasks(finalItem.maintenanceTasks)
                : (finalItem.maintenanceFrequency || 'none');
            
            // Process warranty details (set start date)
            const processedWarranty = processWarrantyDetails(
                finalItem.warrantyDetails,
                installDate
            );
            
            // Create house record
            const recordData = {
                // Core item data
                item: finalItem.item || finalItem.description || 'Unnamed Item',
                category: finalItem.category || 'Service & Repairs',
                area: finalItem.area || 'General',
                brand: finalItem.brand || '',
                model: finalItem.model || '',
                serialNumber: finalItem.serialNumber || '',
                
                // Dates
                dateInstalled: installDate,
                createdAt: serverTimestamp(),
                
                // Costs
                cost: finalItem.cost || null,
                laborCost: finalItem.laborCost || null,
                partsCost: finalItem.partsCost || null,
                
                // Warranty (both string and structured)
                warranty: finalItem.warranty || '',
                warrantyDetails: processedWarranty,
                
                // Maintenance (enhanced with processed tasks)
                maintenanceFrequency: overallFrequency,
                maintenanceTasks: processedTasks,
                nextServiceDate: calculateNextServiceDate(installDate, overallFrequency),
                
                // Job linkage
                sourceJobId: jobId,
                importedFrom: 'job_completion',
                importedAt: serverTimestamp(),
                
                // Contractor linkage (critical for "Book Again" feature)
                contractor: jobData.contractorName || jobData.contractor || '',
                contractorId: completion.contractorId || jobData.contractorId || null,
                contractorPhone: jobData.contractorPhone || jobData.customer?.phone || '',
                contractorEmail: jobData.contractorEmail || jobData.customer?.email || '',
                
                // Property
                propertyId: propertyId,
                userId: userId,
                
                // Tracking (for inventory intent system)
                inventoryIntentId: finalItem.inventoryIntentId || null,
                sourceQuoteId: jobData.sourceQuoteId || null,
                
                // Attachments (include invoice and any item photos)
                attachments: [
                    ...(finalItem.attachments || []),
                    ...(finalItem.photos || []).map(p => ({
                        name: p.caption || 'Completion Photo',
                        type: 'Image',
                        url: p.url,
                        dateAdded: new Date().toISOString()
                    })),
                    ...(completion.invoice?.url ? [{
                        name: 'Invoice',
                        type: 'Document',
                        url: completion.invoice.url,
                        dateAdded: new Date().toISOString()
                    }] : [])
                ],
                imageUrl: finalItem.photos?.[0]?.url || finalItem.attachments?.[0]?.url || ''
            };
            const newRecordRef = doc(recordsRef);
            batch.set(newRecordRef, recordData);
            importedRecordIds.push(newRecordRef.id);
        }
        
        // Update job completion status
        batch.update(jobRef, {
            status: COMPLETION_STATUS.COMPLETED,
            'completion.reviewedAt': serverTimestamp(),
            'completion.reviewedBy': userId,
            'completion.reviewStatus': 'accepted',
            importedRecordIds: importedRecordIds,
            completedAt: serverTimestamp(),
            lastActivity: serverTimestamp()
        });
        
        // Commit all changes
        await batch.commit();
        
        return { 
            success: true, 
            importedCount: importedRecordIds.length,
            importedRecordIds 
        };
        
    } catch (error) {
        console.error('Error accepting job completion:', error);
        throw error;
    }
};

/**
 * Request revision from contractor
 */
export const requestRevision = async (jobId, userId, reason) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);
        
        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }
        
        const jobData = jobSnap.data();
        
        if (jobData.status !== COMPLETION_STATUS.PENDING_COMPLETION) {
            throw new Error('Job is not pending completion');
        }
        
        await updateDoc(jobRef, {
            status: COMPLETION_STATUS.REVISION_REQUESTED,
            'completion.reviewStatus': 'revision_requested',
            'completion.revisionRequest': {
                requestedAt: serverTimestamp(),
                requestedBy: userId,
                reason: reason,
                resolvedAt: null
            },
            lastActivity: serverTimestamp()
        });
        
        return { success: true };
        
    } catch (error) {
        console.error('Error requesting revision:', error);
        throw error;
    }
};

/**
 * Rate contractor (homeowner action)
 */
export const rateContractor = async (jobId, contractorId, userId, rating) => {
    try {
        const batch = writeBatch(db);
        
        // 1. Save rating to job document
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);
        
        if (!jobSnap.exists()) {
            throw new Error('Job not found');
        }
        
        const jobData = jobSnap.data();
        
        const ratingData = {
            overall: rating.overall,
            categories: {
                quality: rating.quality || rating.overall,
                timeliness: rating.timeliness || rating.overall,
                communication: rating.communication || rating.overall,
                value: rating.value || rating.overall
            },
            review: rating.review || '',
            submittedAt: serverTimestamp(),
            isPublic: true
        };
        
        batch.update(jobRef, {
            'ratings.homeownerToContractor': ratingData
        });
        
        // 2. Add to contractor's public ratings collection
        const contractorRatingsRef = collection(
            db, 
            CONTRACTORS_COLLECTION_PATH, 
            contractorId, 
            'ratings'
        );
        
        // Get customer name for display (anonymized)
        const customerName = getAnonymizedName(jobData.customerName || jobData.propertyName || 'Customer');
        
        const publicRating = {
            jobId: jobId,
            homeownerId: userId,
            overall: rating.overall,
            categories: ratingData.categories,
            review: rating.review || '',
            createdAt: serverTimestamp(),
            customerName: customerName,
            jobDescription: jobData.description || jobData.item || 'Service',
            jobDate: jobData.scheduledDate || jobData.completedAt || null
        };
        
        const newRatingRef = doc(contractorRatingsRef);
        batch.set(newRatingRef, publicRating);
        
        // 3. Update contractor's rating summary
        await batch.commit();
        
        // Update aggregate ratings (separate call to avoid transaction issues)
        await updateContractorRatingSummary(contractorId);
        
        return { success: true };
        
    } catch (error) {
        console.error('Error rating contractor:', error);
        throw error;
    }
};

// ============================================
// RATING AGGREGATION
// ============================================

/**
 * Update contractor's aggregate rating summary
 */
export const updateContractorRatingSummary = async (contractorId) => {
    try {
        const ratingsRef = collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'ratings');
        const ratingsSnap = await getDocs(ratingsRef);
        
        if (ratingsSnap.empty) {
            return;
        }
        
        let totalRating = 0;
        let count = 0;
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        const categoryTotals = { quality: 0, timeliness: 0, communication: 0, value: 0 };
        
        ratingsSnap.docs.forEach(doc => {
            const data = doc.data();
            const rating = Math.round(data.overall);
            
            totalRating += data.overall;
            count++;
            
            if (breakdown[rating] !== undefined) {
                breakdown[rating]++;
            }
            
            if (data.categories) {
                Object.keys(categoryTotals).forEach(cat => {
                    if (data.categories[cat]) {
                        categoryTotals[cat] += data.categories[cat];
                    }
                });
            }
        });
        
        const summary = {
            averageRating: count > 0 ? Math.round((totalRating / count) * 10) / 10 : 0,
            totalReviews: count,
            breakdown: breakdown,
            categoryAverages: {
                quality: count > 0 ? Math.round((categoryTotals.quality / count) * 10) / 10 : 0,
                timeliness: count > 0 ? Math.round((categoryTotals.timeliness / count) * 10) / 10 : 0,
                communication: count > 0 ? Math.round((categoryTotals.communication / count) * 10) / 10 : 0,
                value: count > 0 ? Math.round((categoryTotals.value / count) * 10) / 10 : 0
            },
            lastUpdated: serverTimestamp()
        };
        
        const contractorRef = doc(db, CONTRACTORS_COLLECTION_PATH, contractorId);
        await updateDoc(contractorRef, {
            ratingsSummary: summary
        });
        
        return summary;
        
    } catch (error) {
        console.error('Error updating rating summary:', error);
        // Don't throw - this is a non-critical operation
    }
};

// ============================================
// AUTO-CLOSE
// ============================================

/**
 * Process auto-close for a single job
 */
export const processAutoClose = async (jobId) => {
    try {
        const jobRef = doc(db, REQUESTS_COLLECTION_PATH, jobId);
        const jobSnap = await getDoc(jobRef);
        
        if (!jobSnap.exists()) {
            return { success: false, reason: 'Job not found' };
        }
        
        const jobData = jobSnap.data();
        
        if (jobData.status !== COMPLETION_STATUS.PENDING_COMPLETION) {
            return { success: false, reason: 'Job not pending completion' };
        }
        
        // Accept completion automatically
        const result = await acceptJobCompletion(
            jobId,
            jobData.createdBy, // homeowner userId
            jobData.propertyId || null,
            null // Accept all items by default
        );
        
        // Mark as auto-completed
        await updateDoc(jobRef, {
            'completion.wasAutoCompleted': true
        });
        
        return { success: true, ...result };
        
    } catch (error) {
        console.error('Error auto-closing job:', error);
        return { success: false, reason: error.message };
    }
};

/**
 * Get jobs that need auto-close processing
 * (Call this from a scheduled function or on app load)
 */
export const getJobsNeedingAutoClose = async () => {
    try {
        const now = Timestamp.now();
        
        const q = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where('status', '==', COMPLETION_STATUS.PENDING_COMPLETION),
            where('completion.autoCloseAt', '<=', now)
        );
        
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
    } catch (error) {
        console.error('Error getting auto-close jobs:', error);
        return [];
    }
};

// ============================================
// QUERIES
// ============================================

/**
 * Get pending completion jobs for homeowner
 */
export const getPendingCompletionJobs = async (userId) => {
    try {
        const q = query(
            collection(db, REQUESTS_COLLECTION_PATH),
            where('createdBy', '==', userId),
            where('status', '==', COMPLETION_STATUS.PENDING_COMPLETION)
        );
        
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
    } catch (error) {
        console.error('Error getting pending completion jobs:', error);
        return [];
    }
};

/**
 * Get contractor's public ratings
 */
export const getContractorRatings = async (contractorId, options = {}) => {
    try {
        const { limit: maxResults = 10 } = options;
        
        const ratingsRef = collection(db, CONTRACTORS_COLLECTION_PATH, contractorId, 'ratings');
        const snapshot = await getDocs(ratingsRef);
        
        const ratings = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const aTime = a.createdAt?.toDate?.() || new Date(0);
                const bTime = b.createdAt?.toDate?.() || new Date(0);
                return bTime - aTime;
            })
            .slice(0, maxResults);
        
        return ratings;
        
    } catch (error) {
        console.error('Error getting contractor ratings:', error);
        return [];
    }
};

// ============================================
// HELPERS
// ============================================

/**
 * Calculate next service date based on frequency
 */
function calculateNextServiceDate(startDate, frequency) {
    if (!startDate || !frequency || frequency === 'none') {
        return null;
    }
    
    const date = new Date(startDate);
    
    switch (frequency) {
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() + 3);
            break;
        case 'semiannual':
            date.setMonth(date.getMonth() + 6);
            break;
        case 'annual':
            date.setFullYear(date.getFullYear() + 1);
            break;
        case 'biennial':
            date.setFullYear(date.getFullYear() + 2);
            break;
        default:
            return null;
    }
    
    return date.toISOString().split('T')[0];
}

/**
 * Get anonymized customer name for public display
 * "John Smith" -> "John S."
 */
function getAnonymizedName(fullName) {
    if (!fullName) return 'Customer';
    
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
        return parts[0];
    }
    
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    
    return `${firstName} ${lastInitial}.`;
}

/**
 * Get the shortest maintenance frequency from a list of tasks
 * Used to set the overall item frequency for "next service date" calculation
 */
function getShortestFrequencyFromTasks(tasks) {
    if (!tasks || tasks.length === 0) return 'none';
    
    const selectedTasks = tasks.filter(t => t.selected !== false);
    if (selectedTasks.length === 0) return 'none';
    
    const frequencyMonths = {
        'monthly': 1,
        'quarterly': 3,
        'semiannual': 6,
        'annual': 12,
        'every 2 years': 24,
        'every 3 years': 36,
        'every 5 years': 60,
        'biennial': 24
    };
    
    let shortestMonths = Infinity;
    let shortestFrequency = 'annual';
    
    selectedTasks.forEach(task => {
        const months = task.months || frequencyMonths[task.frequency] || 12;
        if (months < shortestMonths) {
            shortestMonths = months;
            shortestFrequency = task.frequency || 'annual';
        }
    });
    
    return shortestFrequency;
}

/**
 * Process maintenance tasks for storage
 * - Filters to selected tasks only
 * - Adds nextDueDate to each task based on install date
 */
function processMaintenanceTasks(tasks, installDate) {
    if (!tasks || tasks.length === 0) return [];
    
    const frequencyMonths = {
        'monthly': 1,
        'quarterly': 3,
        'semiannual': 6,
        'annual': 12,
        'every 2 years': 24,
        'every 3 years': 36,
        'every 5 years': 60,
        'biennial': 24
    };
    
    return tasks
        .filter(t => t.selected !== false)
        .map(task => {
            const months = task.months || frequencyMonths[task.frequency] || 12;
            const nextDate = new Date(installDate);
            nextDate.setMonth(nextDate.getMonth() + months);
            
            return {
                task: task.task,
                frequency: task.frequency,
                months: months,
                notes: task.notes || '',
                nextDue: nextDate.toISOString().split('T')[0]
            };
        });
}

/**
 * Process warranty details for storage
 * - Sets startDate to install date if not already set
 */
function processWarrantyDetails(warrantyDetails, installDate) {
    if (!warrantyDetails || !warrantyDetails.hasCoverage) {
        return null;
    }
    
    return {
        ...warrantyDetails,
        startDate: warrantyDetails.startDate || installDate
    };
}
